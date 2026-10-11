import { chapterState } from '../c1/state';
import { programChapters, topicExists } from '../c1/chapters';
import type { ProdInput } from '../c1/prod';
import { wordCountOf } from '../chunks/newChunk';
import { patternsOf } from '../grammar/patterns';
import { patsOf } from '../metrics/pattern';
import { hash32 } from '../random';
import { repairsFromText, STYLE_CATS } from '../repair/sources';
import type { AnalysisSlot, Turn } from './types';

// Rollenspiel+ (Lernplattform 3.0 P51, KI-Tutor T7), die reinen Teile: die Musterliste des aktuellen Kapitels (für `pat` in turn-analysis@3), das
// Kapitelziel im Szenenstart („In diesem Gespräch: 2 × A, 1 × B“), sein Stand aus den Treffern der Analyse (`used`) und der K7-Eintrag `s: 'talk'`
// aus den eigenen Zügen. Nichts davon schreibt selbst; gespeichert wird nur der K7-Eintrag über `addProd` (useRoleplay).

type Doc = Readonly<Record<string, unknown>>;

/** Höchstens so viele Kennungen stehen im Prompt (KT T7: ≤ 30). */
export const TALK_PATS_MAX = 30;

export type TalkPat = { id: string; topic: string; en: string; de: string };

export type ChapterTalk = {
  /** Kapitelnummer 1 bis 7. */
  ch: number;
  name: { de: string; en: string };
  /** Die Muster des Kapitels (Lehrreihenfolge, ≤ 30): nur daraus darf `pat` kommen. */
  pats: TalkPat[];
  /** Das Kapitelziel: nur eingeführte Muster (≥ 2: 2× und 1×; genau 1: 2×; keins: leer, `pats` bleibt für `pat`). */
  goal: Array<{ id: string; need: number }>;
};

const introduced = (e: { i?: string; n?: number } | undefined): boolean => !!e && (e.i !== undefined || (e.n ?? 0) > 0);

/**
 * Kapitel, Musterliste und Kapitelziel für ein Gespräch. Rein: dieselben Daten und dieselbe Szene ergeben dasselbe Ziel (Szenenstart und Gespräch
 * zeigen deshalb dasselbe). Ohne aktuelles Kapitel oder ohne Muster: `null` (dann gibt es weder `pat` noch ein Ziel). Ins Ziel kommen nur
 * eingeführte Muster (geübt, nicht neu): mindestens zwei → 2 × A, 1 × B (per Hash je Szene); genau eins → 2 × A; keins → kein Ziel.
 */
export function chapterTalk(i: { docs: ReadonlyMap<string, Doc>; today: string; nowMs?: number; sceneId: string; chosen?: number | null }): ChapterTalk | null {
  const st = chapterState({ docs: i.docs, today: i.today, ...(i.nowMs !== undefined ? { nowMs: i.nowMs } : {}), chosen: i.chosen ?? null });
  const ch = programChapters()[st.current];
  if (!ch) return null;
  const pats: TalkPat[] = [];
  const intro: string[] = [];
  for (const topic of ch.topics) {
    if (!topicExists(topic)) continue;
    const tp = patternsOf(topic);
    if (!tp) continue;
    const entries = patsOf(i.docs.get(topic));
    for (const p of tp.patterns) {
      if (pats.length >= TALK_PATS_MAX) break;
      pats.push({ id: p.id, topic, en: p.name.en, de: p.name.de });
      if (introduced(entries[p.id])) intro.push(p.id);
    }
  }
  if (!pats.length) return null;
  let goal: ChapterTalk['goal'] = [];
  if (intro.length === 1) goal = [{ id: intro[0] as string, need: 2 }];
  else if (intro.length >= 2) {
    const start = hash32(`${i.sceneId}|${ch.id}`) % intro.length;
    goal = [
      { id: intro[start] as string, need: 2 },
      { id: intro[(start + 1) % intro.length] as string, need: 1 },
    ];
  }
  return { ch: ch.n, name: ch.name, pats, goal };
}

/** Treffer je Zielmuster aus den fertigen Analysen (`used`), gekappt auf die Sollzahl. Züge mit eingefügter Wendung oder eingefügtem Text zählen nicht. Rein. */
export function goalProgress(goal: ChapterTalk['goal'], analyses: Readonly<Record<number, AnalysisSlot>>, turns: readonly Turn[] = []): Array<{ id: string; need: number; have: number }> {
  const hits = new Map<string, number>();
  for (const [k, a] of Object.entries(analyses)) {
    const t = turns[Number(k)];
    if (t?.usedChip === true || t?.pasted === true) continue;
    if (a.state !== 'done' || !a.data?.english) continue;
    for (const id of new Set(a.data.used ?? [])) hits.set(id, (hits.get(id) ?? 0) + 1);
  }
  return goal.map((g) => ({ ...g, have: Math.min(g.need, hits.get(g.id) ?? 0) }));
}

/** Nur echte Fehler (Grammatik, Wort, Bedeutung): Stil, Ton, Register, Zeichensetzung nie. Gilt für K7, „Sag’s nochmal“ und dessen Markierung. Rein. */
export function realErrors<T extends { cat: string }>(errors: readonly T[]): T[] {
  return errors.filter((e) => !STYLE_CATS.has(e.cat));
}

/**
 * Ziel für „Sag’s nochmal“ (P51): der ganze Zug mit allen echten Korrekturen (auch über mehrere Sätze), der Grund nur aus echten Fehlern und die zu
 * markierenden Stellen. `null`, wenn es keinen echten, im Satz auffindbaren Fehler gibt (dann gibt es die Übung nicht; nie aus `upgraded`). Rein.
 */
export function retryTarget(text: string, errors: ReadonlyArray<{ wrong: string; right: string; cat: string; why: string; pat?: string }>): { right: string; why: string; wrongs: string[] } | null {
  const real = realErrors(errors);
  if (!real.length) return null;
  const reps = repairsFromText(text, real, 'talk');
  if (!reps.length) return null;
  const right = reps.reduce((txt, r) => txt.replace(r.wrong, r.right), text);
  if (right === text) return null;
  return { right, why: reps.map((r) => r.why).join(' ').trim(), wrongs: real.map((e) => e.wrong) };
}

/** Fehler eines Zugs für K7: nur echte Fehler (Stil/Ton nie), Mittelwert mit Claudes zweiter Zählung (wie die Wochen-Mail, höchstens Liste + 2). */
export function turnErrors(errors: ReadonlyArray<{ cat: string }>, count: number | null | undefined): number {
  const listed = realErrors(errors).length;
  if (count === null || count === undefined || !Number.isFinite(count) || count <= listed) return listed;
  return Math.min(listed + 2, Math.round(((listed + count) / 2) * 2) / 2);
}

/** Kennung des K7-Eintrags eines Gesprächs (Doppelschutz in `addProd` nach `id`). */
export const talkProdId = (runId: string): string => `talk:${runId}`;

/**
 * K7-Eintrag aus den eigenen Zügen eines Gesprächs: `w` = Wörter der eigenen, fertig analysierten englischen Züge (ohne Züge mit eingefügter
 * Wendung), `e` = deren Fehler (`turnErrors`). Ein eingefügter Zug (Paste) macht den ganzen Eintrag ungültig (`pasted`, `addProd` lehnt ab).
 * `null`, wenn kein Zug zählt. Rein.
 */
export function talkProd(i: { turns: readonly Turn[]; analyses: Readonly<Record<number, AnalysisSlot>>; day: string; runId: string; pastedTexts?: ReadonlySet<string> }): ProdInput | null {
  let w = 0;
  let e = 0;
  let pasted = false;
  i.turns.forEach((t, k) => {
    if (t.role !== 'me') return;
    if (t.pasted === true || i.pastedTexts?.has(t.text.trim())) pasted = true;
    if (t.usedChip === true) return;
    const a = i.analyses[k];
    if (a?.state !== 'done' || !a.data?.english) return;
    w += wordCountOf(t.text);
    e += turnErrors(a.data.errors, a.data.count);
  });
  if (w < 1) return null;
  return { d: i.day, s: 'talk', w, e, pasted, id: talkProdId(i.runId) };
}
