import { checkTyped } from '../answer/check';
import { topicP } from '../grammar/bkt';
import { topicCat, radarEvent } from '../grammar/radar';
import { seedTasks } from '../grammar/tasks';
import type { GrammarTask, RadarEvent, SprintEntry } from '../learn/types';
import { hash32, mulberry32, shuffle } from '../random';
import { meaningOf, shortMeaning } from '../srs/cards';
import type { Lang, TrainCard } from '../srs/types';

// Sprint (phase2-plan §5.7): 90 s nur Bekanntes, verschachtelt (nie zwei gleiche Arten
// hintereinander): Karten ab Stufe 3, Grammatikthemen mit p ≥ .50, Kollokationen. Fehler
// beenden die Runde nicht. Geschrieben werden nur `sprints`, `act.sprint` und Radar `s` –
// kein FSRS, kein BKT, kein Log (wie die alte App).

export const SPRINT_MS = 90_000;
export const SPRINT_MIN_ITEMS = 20;
export const SPRINTS_MAX = 60;
export const SPRINT_STAGE_MIN = 3;
export const SPRINT_P_MIN = 0.5;

export type SprintKind = 'card-mc' | 'card-type' | 'gram-mc' | 'gram-gap' | 'colloc';
export type SprintItem = {
  id: string;
  k: SprintKind;
  prompt: string;
  answer: string;
  /** Auswahl (mc) oder `null` (tippen). */
  opts: string[] | null;
  topic?: string;
  cardId?: string;
  lemma?: string;
};

const family = (k: SprintKind) => (k.startsWith('card') ? 'card' : k.startsWith('gram') ? 'gram' : 'colloc');

export const sprintCard = (c: TrainCard): boolean => !c.hidden && !c.isNew && c.stage >= SPRINT_STAGE_MIN;

export function buildSprintDeck(i: {
  cards: readonly TrainCard[];
  grammarDocs: ReadonlyMap<string, Readonly<Record<string, unknown>>>;
  pool?: readonly GrammarTask[];
  lang: Lang;
  nowMs: number;
  seed: string;
  max?: number;
}): SprintItem[] {
  const rng = mulberry32(hash32(i.seed));
  const cards = i.cards.filter(sprintCard);
  const byFamily: Record<'card' | 'gram' | 'colloc', SprintItem[]> = { card: [], gram: [], colloc: [] };
  const meanings = cards.map((c) => meaningOf(c, i.lang)).filter((m): m is string => !!m).map((m) => shortMeaning(m, i.lang));
  for (const c of cards) {
    const m = meaningOf(c, i.lang);
    if (m) {
      const others = shuffle(meanings.filter((x) => x !== shortMeaning(m, i.lang)), rng).slice(0, 3);
      if (others.length === 3) byFamily.card.push({ id: `mc:${c.id}`, k: 'card-mc', prompt: c.word, answer: shortMeaning(m, i.lang), opts: shuffle([shortMeaning(m, i.lang), ...others], rng), cardId: c.id });
      byFamily.card.push({ id: `type:${c.id}`, k: 'card-type', prompt: shortMeaning(m, i.lang), answer: c.word, opts: null, cardId: c.id, lemma: c.lemma });
    }
    for (const col of c.col) {
      if (!col.p || !col.gap || col.opts.length < 2) continue;
      byFamily.colloc.push({ id: `col:${c.id}#${col.index}`, k: 'colloc', prompt: col.p, answer: col.gap, opts: shuffle([col.gap, ...col.opts.slice(0, 3)], rng), cardId: c.id });
    }
  }
  const tasks = [...(i.pool ?? []), ...seedTasks()];
  const seen = new Set<string>();
  for (const t of tasks) {
    if (seen.has(t.key) || (t.type !== 'mc' && t.type !== 'gap')) continue;
    if (topicP(t.topic, i.grammarDocs.get(t.topic), i.nowMs) < SPRINT_P_MIN) continue;
    seen.add(t.key);
    byFamily.gram.push({ id: `g:${t.key}`, k: t.type === 'mc' ? 'gram-mc' : 'gram-gap', prompt: t.hint && t.type === 'gap' ? `${t.prompt} ${t.hint}` : t.prompt, answer: t.answer, opts: t.options ? shuffle(t.options, rng) : null, topic: t.topic });
  }
  const queues = (Object.keys(byFamily) as Array<keyof typeof byFamily>).map((f) => shuffle(byFamily[f], rng));
  const out: SprintItem[] = [];
  const max = i.max ?? 80;
  let turn = 0;
  while (out.length < max && queues.some((q) => q.length)) {
    const q = queues[turn % queues.length] as SprintItem[];
    turn++;
    const next = q[0];
    if (!next) continue;
    const prev = out[out.length - 1];
    if (prev && family(prev.k) === family(next.k) && queues.some((o) => o !== q && o.length)) continue;
    out.push(q.shift() as SprintItem);
  }
  return out;
}

export const sprintFeasible = (deck: readonly SprintItem[]): boolean => deck.length >= SPRINT_MIN_ITEMS;

export function isSprintCorrect(item: SprintItem, given: string): boolean {
  if (item.opts) return given === item.answer;
  return checkTyped(given, [item.answer], { lemma: item.lemma ?? item.answer }).verdict === 'correct';
}

export type SprintState = {
  score: number;
  ok: number;
  n: number;
  combo: number;
  bestCombo: number;
  /** Antwortzeiten der richtigen Antworten. */
  ms: number[];
  answers: Array<{ item: SprintItem; given: string; ok: boolean; ms: number }>;
};

export const sprintStart = (): SprintState => ({ score: 0, ok: 0, n: 0, combo: 0, bestCombo: 0, ms: [], answers: [] });

/** Eine Antwort. Fehler beenden die Runde nie; es endet nur die Zeit. Punkte wie die alte App. */
export function sprintAnswer(s: SprintState, item: SprintItem, given: string, ms: number): SprintState {
  const ok = isSprintCorrect(item, given);
  const combo = ok ? s.combo + 1 : 0;
  return {
    score: s.score + (ok ? 10 + Math.min(combo - 1, 5) * 2 : 0),
    ok: s.ok + (ok ? 1 : 0),
    n: s.n + 1,
    combo,
    bestCombo: Math.max(s.bestCombo, combo),
    ms: ok ? [...s.ms, ms] : s.ms,
    answers: [...s.answers, { item, given, ok, ms }],
  };
}

/** Eintrag für `app/profile.sprints` (Form der alten App). */
export function sprintEntry(s: SprintState, t: number): SprintEntry {
  const avgMs = s.ms.length ? Math.round(s.ms.reduce((a, b) => a + b, 0) / s.ms.length) : 0;
  return { t, score: s.score, ok: s.ok, n: s.n, avgMs, combo: s.bestCombo };
}

/** Radar-Ereignis für eine falsche Sprint-Antwort (Grammatik → Themenkategorie, Kollokation → wordchoice). */
export function sprintRadar(item: SprintItem, given: string, t: number): RadarEvent | null {
  if (item.k === 'gram-mc' || item.k === 'gram-gap') return radarEvent(topicCat(item.topic ?? ''), 's', t, { q: item.prompt, g: given, a: item.answer });
  if (item.k === 'colloc') return radarEvent('wordchoice', 's', t, { q: item.prompt, g: given, a: item.answer });
  return null;
}

/** Richtige je Minute. */
export const tempoPerMin = (ok: number, durMs = SPRINT_MS): number => Math.round((ok / Math.max(1, durMs)) * 60_000 * 10) / 10;

/** Wochenschnitt „richtige/Min." aus `profile.sprints` der letzten 7 Tage (alte Einträge: 60 s). */
export function weekTempo(sprints: unknown, nowMs: number): number | null {
  const list = Array.isArray(sprints) ? sprints : [];
  const week = list.filter((s): s is { t: number; ok: number; dur?: number } => !!s && typeof s === 'object' && typeof (s as { t?: unknown }).t === 'number' && nowMs - (s as { t: number }).t <= 7 * 86_400_000 && typeof (s as { ok?: unknown }).ok === 'number');
  if (!week.length) return null;
  const vals = week.map((s) => tempoPerMin(s.ok, typeof s.dur === 'number' ? s.dur : 60_000));
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

/** `sprints` nach dem Anhängen, höchstens 60 (frischer Stand). */
export function appendSprint(current: unknown, e: SprintEntry): unknown[] {
  const list: unknown[] = Array.isArray(current) ? (current as unknown[]) : [];
  return [...list.filter((x) => !(x && typeof x === 'object' && (x as { t?: unknown }).t === e.t)), e].slice(-SPRINTS_MAX);
}
