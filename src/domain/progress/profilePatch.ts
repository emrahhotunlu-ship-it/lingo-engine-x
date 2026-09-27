import { validateDoc } from '../../data/validate';
import { appendSprint } from '../drills/sprint';
import type { LearnAct, SprintEntry } from '../learn/types';
import { exerciseDef } from '../srs/modes';
import type { AnswerEvent } from '../srs/types';

// Zähler in app/profile (Daten-Entwurf §3.1/3.2, phase2-plan §4.5): aus dem frischen Stand plus
// Deltas, als absolute Werte. `lxSeq[tab]` verhindert, dass ein wiederholter Sammel-Schreibvorgang
// doppelt wirkt („do NOT build monotonic counters from read-modify-update", db.d.ts).
// Nie geschrieben: history, canDo, theme, lang, unbekannte Felder. Nie gekürzt: days, xpDays,
// act, minutes, pflicht.

type Doc = Record<string, unknown>;

export type RoundEnd = {
  day: string;
  /** `check` = Wochen-Check (M10): zählt als Extra, nie zu einem Pflichtkanal. */
  /** `fluency` = Flüssigkeit 90 – 60 – 45 (Lernberatung V6): freiwillig, nie ein Pflichtkanal. */
  act: 'review' | 'cards' | LearnAct | 'speak' | 'biz' | 'preply' | 'check' | 'say' | 'fluency' | 'tones';
  partial: boolean;
  n: number;
  right: number;
  activeMs: number;
  /** Lektion: Produktion von der KI geprüft (+15 XP). */
  lessonAi?: boolean;
  /** Sprint: Punktzahl (XP 10 + score/5). */
  sprintScore?: number;
  /**
   * Phase 3 (Plan §3.6): zählt zusätzlich als so viele Antworten in `days[day]` und `answers`
   * (Sprechen: eigene Züge, Business: 1). Trefferquoten (`ema`, `n`) bleiben unberührt.
   */
  countAs?: number;
};

/** Eine gezählte Antwort außerhalb des Vokabeltrainers (Grammatik, Übungen), Kanalzuordnung §4.5. */
export type CountEvent = { day: string; kind: 'v' | 'g'; channel: 'recog' | 'colloc' | 'listen' | 'write' | null; ok: boolean };

export type PatchCtx = {
  deviceId: string | null;
  seq: number;
  /** An diesem Lerntag (bzw. diesen Lerntagen, B1) ist die Pflicht erfüllt → `pflicht[day] = 1` (nur wenn noch nicht gesetzt). */
  pflichtDay?: string | readonly string[] | null;
  counts?: readonly CountEvent[];
  sprints?: readonly SprintEntry[];
  /** `lxSeq`-Einträge mit kleinerer Folgenummer (ms, älter als 14 Tage) werden auf `null` gesetzt (D7). */
  pruneSeqBefore?: number;
};

export const EMA_ALPHA = 0.12;
const EMA_START: Record<string, number> = { recog: 0.6, write: 0.5, listen: 0.5, colloc: 0.6, all: 0.55 };
export const SEQ_KEEP_MS = 14 * 86_400_000;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const round4 = (v: number) => Math.round(v * 10_000) / 10_000;

/** Kanal der gleitenden Trefferquote für eine Übung (Formel der alten App). */
export function emaChannel(a: AnswerEvent): 'recog' | 'colloc' | 'listen' | 'write' {
  const mode = exerciseDef(a.ex).mode;
  return mode === 'recog' ? 'recog' : mode === 'colloc' ? 'colloc' : mode === 'listen' ? 'listen' : 'write';
}

/** Minuten einer Runde: nur mit mindestens einer Antwort, 1–30 (gehaltene Preply-Stunde: 1–120). */
export const roundMinutes = (r: Pick<RoundEnd, 'n' | 'activeMs'> & { act?: RoundEnd['act'] }): number =>
  r.n >= 1 ? Math.min(r.act === 'preply' ? 120 : 30, Math.max(1, Math.round(r.activeMs / 60_000))) : 0;

/** XP-Bonus je Runde (Werte der alten App). */
export function roundBonus(r: RoundEnd): number {
  switch (r.act) {
    case 'review':
    case 'gram':
    case 'check':
      return r.n >= 8 ? 20 : 5;
    case 'cards':
      return r.n >= 10 ? 15 : 5;
    case 'lesson':
      return 25 + (r.lessonAi ? 15 : 0);
    case 'sprint':
      return 10 + Math.round(num(r.sprintScore) / 5);
    case 'dictate':
    case 'cloze':
    case 'order':
      return r.right * 12 + (r.n > 0 && r.right === r.n ? 20 : 0);
    case 'speak':
      return Math.min(150, 10 * r.n);
    case 'biz':
      return r.n >= 1 ? 15 : 0;
    // „Sag es“ (Lernberatung V1): eine freie Antwort mit zweitem Durchgang.
    case 'say':
      return r.n >= 1 ? 20 : 0;
    // Flüssigkeit 90 – 60 – 45 (Lernberatung V6): drei Runden zum selben Inhalt.
    case 'fluency':
      return r.n >= 3 ? 15 : 0;
    // „Eine Botschaft, drei Tonlagen“ (Lernberatung, Vorschlag 8): freiwillig, drei Fassungen.
    case 'tones':
      return r.n >= 1 ? 15 : 0;
    case 'preply':
      return 0;
  }
}

/** Mindestdokument, falls app/profile ganz fehlt (leere Datenbank). */
export function minimalProfile(day: string): Doc {
  return { days: {}, xpDays: {}, minutes: {}, act: {}, answers: 0, vAnswers: 0, gAnswers: 0, xp: 0, ema: { ...EMA_START }, n: { recog: 0, write: 0, listen: 0, colloc: 0 }, created: day };
}

/**
 * Nur geänderte Schlüssel; `null` = nichts zu schreiben (ungültiges Profil, schon angewendet
 * oder keine Deltas). Zweimal mit demselben `seq` angewendet wirkt wie einmal – nur `pflicht`
 * wird unabhängig davon ergänzt (Selbstheilung), weil es nie etwas hochzählt.
 */
export function profilePatch(cur: Doc, answers: readonly AnswerEvent[], rounds: readonly RoundEnd[], ctx: PatchCtx): Doc | null {
  if (!validateDoc('app/profile', cur).ok) return null;
  const counts = ctx.counts ?? [];
  const sprints = ctx.sprints ?? [];
  const patch: Doc = {};
  const applied = !!ctx.deviceId && num(obj(cur.lxSeq)[ctx.deviceId]) >= ctx.seq;
  const hasDeltas = answers.length > 0 || rounds.length > 0 || counts.length > 0 || sprints.length > 0;

  if (hasDeltas && !applied) {
    const days: Doc = {};
    const xpDays: Doc = {};
    const minutes: Doc = {};
    const act: Doc = {};
    const curDays = obj(cur.days);
    const curXpDays = obj(cur.xpDays);
    const curMinutes = obj(cur.minutes);
    const curAct = obj(cur.act);
    let xp = 0;
    const addXp = (day: string, v: number) => {
      xpDays[day] = num(xpDays[day] ?? curXpDays[day]) + v;
      xp += v;
    };
    const ema: Doc = { ...obj(cur.ema) };
    const n: Doc = { ...obj(cur.n) };
    const bumpEma = (ch: string, ok: boolean) => {
      const prev = typeof ema[ch] === 'number' ? num(ema[ch]) : (EMA_START[ch] ?? 0.5);
      ema[ch] = round4(prev * (1 - EMA_ALPHA) + (ok ? 1 : 0) * EMA_ALPHA);
    };
    let vAnswers = 0;
    let gAnswers = 0;
    let extraAnswers = 0;
    const count = (day: string, kind: 'v' | 'g', channel: string | null, ok: boolean) => {
      days[day] = num(days[day] ?? curDays[day]) + 1;
      addXp(day, ok ? 10 : 3);
      if (channel) {
        bumpEma(channel, ok);
        n[channel] = num(n[channel]) + 1;
      }
      bumpEma('all', ok);
      if (kind === 'v') vAnswers++;
      else gAnswers++;
    };
    for (const a of answers) count(a.day, 'v', emaChannel(a), a.grade > 1);
    for (const c of counts) count(c.day, c.kind, c.channel, c.ok);
    for (const r of rounds) {
      if (r.n < 1) continue;
      const key = r.partial ? `${r.act}~` : r.act;
      const dayAct = { ...obj(curAct[r.day]), ...obj(act[r.day]) };
      act[r.day] = { ...obj(act[r.day]), [key]: num(dayAct[key]) + 1 };
      minutes[r.day] = num(minutes[r.day] ?? curMinutes[r.day]) + roundMinutes(r);
      // Gehaltene Preply-Stunde (Phase 5, A7 27.09.): nur Aktivität und Minuten, nie XP/Serie.
      if (r.act !== 'preply') addXp(r.day, roundBonus(r));
      const extra = Math.max(0, Math.round(num(r.countAs)));
      if (extra) {
        days[r.day] = num(days[r.day] ?? curDays[r.day]) + extra;
        extraAnswers += extra;
      }
    }
    if (Object.keys(days).length) patch.days = days;
    if (Object.keys(xpDays).length) patch.xpDays = xpDays;
    if (xp) patch.xp = num(cur.xp) + xp;
    if (vAnswers + gAnswers + extraAnswers) patch.answers = num(cur.answers) + vAnswers + gAnswers + extraAnswers;
    if (vAnswers + gAnswers) {
      if (vAnswers) patch.vAnswers = num(cur.vAnswers) + vAnswers;
      if (gAnswers) patch.gAnswers = num(cur.gAnswers) + gAnswers;
      patch.ema = ema;
      patch.n = n;
    }
    if (Object.keys(act).length) patch.act = act;
    if (Object.keys(minutes).length) patch.minutes = minutes;
    if (sprints.length) {
      let list: unknown = cur.sprints;
      for (const s of sprints) list = appendSprint(list, s);
      patch.sprints = list;
    }
    if (ctx.deviceId) {
      const seqs: Doc = { [ctx.deviceId]: ctx.seq };
      if (ctx.pruneSeqBefore !== undefined) {
        for (const [k, v] of Object.entries(obj(cur.lxSeq))) if (k !== ctx.deviceId && typeof v === 'number' && v < ctx.pruneSeqBefore) seqs[k] = null;
      }
      patch.lxSeq = seqs;
    }
  }
  // B1: auch mehrere Lerntage (Stapel über den Tageswechsel); nur setzen, nie entfernen.
  const pflichtDays = ctx.pflichtDay ? (typeof ctx.pflichtDay === 'string' ? [ctx.pflichtDay] : ctx.pflichtDay) : [];
  const pf: Doc = {};
  for (const d of pflichtDays) if (d && !obj(cur.pflicht)[d]) pf[d] = 1;
  if (Object.keys(pf).length) patch.pflicht = pf;
  return Object.keys(patch).length ? patch : null;
}

/**
 * H2: `lxSeq` ohne die per `pruneSeqBefore` stillgelegten `null`-Einträge. Ein `update` kann Schlüssel
 * nur auf `null` setzen, nie entfernen (Felder werden verschmolzen) – entfernt werden sie deshalb beim
 * Verdichten des ganzen Profils (`profileWithout`, ganzes Dokument per `set`). Zahlen bleiben.
 */
export function compactSeq(lxSeq: unknown): Doc | undefined {
  if (!lxSeq || typeof lxSeq !== 'object' || Array.isArray(lxSeq)) return undefined;
  const out: Doc = {};
  for (const [k, v] of Object.entries(lxSeq as Doc)) if (v !== null) out[k] = v;
  return out;
}
