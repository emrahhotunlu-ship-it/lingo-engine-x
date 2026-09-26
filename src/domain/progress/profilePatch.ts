import { validateDoc } from '../../data/validate';
import { exerciseDef } from '../srs/modes';
import type { AnswerEvent } from '../srs/types';

// Zähler in app/profile (Daten-Entwurf §3.1/3.2): aus dem frischen Stand plus Deltas, als
// absolute Werte. `lxSeq[gerät]` verhindert, dass ein wiederholter Sammel-Schreibvorgang doppelt
// wirkt („do NOT build monotonic counters from read-modify-update", db.d.ts).

type Doc = Record<string, unknown>;

export type RoundEnd = {
  day: string;
  act: 'review' | 'cards' | 'speak' | 'biz';
  partial: boolean;
  n: number;
  right: number;
  activeMs: number;
  /**
   * Phase 3 (Plan §3.6): zählt zusätzlich als so viele Antworten in `days[day]` und `answers`
   * (Sprechen: eigene Züge, Business: 1). Trefferquoten (`ema`, `n`) bleiben unberührt.
   */
  countAs?: number;
};

export const EMA_ALPHA = 0.12;
const EMA_START: Record<string, number> = { recog: 0.6, write: 0.5, listen: 0.5, colloc: 0.6, all: 0.55 };

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const round4 = (v: number) => Math.round(v * 10_000) / 10_000;

/** Kanal der gleitenden Trefferquote für eine Übung (Formel der alten App). */
export function emaChannel(a: AnswerEvent): 'recog' | 'colloc' | 'listen' | 'write' {
  const mode = exerciseDef(a.ex).mode;
  return mode === 'recog' ? 'recog' : mode === 'colloc' ? 'colloc' : mode === 'listen' ? 'listen' : 'write';
}

/** Minuten einer Runde: nur mit mindestens einer Antwort, 1–30. */
export const roundMinutes = (r: RoundEnd): number => (r.n >= 1 ? Math.min(30, Math.max(1, Math.round(r.activeMs / 60_000))) : 0);

export const ROUND_BONUS = {
  review: (n: number) => (n >= 8 ? 20 : 5),
  cards: (n: number) => (n >= 10 ? 15 : 5),
  speak: (n: number) => Math.min(150, 10 * n),
  biz: (n: number) => (n >= 1 ? 15 : 0),
};

/** Mindestdokument, falls app/profile ganz fehlt (leere Datenbank). */
export function minimalProfile(day: string): Doc {
  return { days: {}, xpDays: {}, minutes: {}, act: {}, answers: 0, vAnswers: 0, gAnswers: 0, xp: 0, ema: { ...EMA_START }, n: { recog: 0, write: 0, listen: 0, colloc: 0 }, created: day };
}

/**
 * Nur geänderte Schlüssel; `null` = nichts zu schreiben (ungültiges Profil, schon angewendet
 * oder keine Deltas). Zweimal mit demselben `seq` angewendet wirkt wie einmal.
 */
export function profilePatch(cur: Doc, answers: readonly AnswerEvent[], rounds: readonly RoundEnd[], ctx: { deviceId: string | null; seq: number }): Doc | null {
  if (!validateDoc('app/profile', cur).ok) return null;
  if (!answers.length && !rounds.length) return null;
  if (ctx.deviceId && num(obj(cur.lxSeq)[ctx.deviceId]) >= ctx.seq) return null;

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

  let extraAnswers = 0;
  const ema: Doc = { ...obj(cur.ema) };
  const n: Doc = { ...obj(cur.n) };
  for (const a of answers) {
    days[a.day] = num(days[a.day] ?? curDays[a.day]) + 1;
    addXp(a.day, a.grade > 1 ? 10 : 3);
    const ok = a.grade > 1 ? 1 : 0;
    for (const ch of [emaChannel(a), 'all']) {
      const prev = typeof ema[ch] === 'number' ? num(ema[ch]) : (EMA_START[ch] ?? 0.5);
      ema[ch] = round4(prev * (1 - EMA_ALPHA) + ok * EMA_ALPHA);
    }
    const ch = emaChannel(a);
    n[ch] = num(n[ch]) + 1;
  }
  for (const r of rounds) {
    if (r.n < 1) continue;
    const key = r.partial ? `${r.act}~` : r.act;
    const dayAct = { ...obj(curAct[r.day]), ...obj(act[r.day]) };
    act[r.day] = { ...obj(act[r.day]), [key]: num(dayAct[key]) + 1 };
    minutes[r.day] = num(minutes[r.day] ?? curMinutes[r.day]) + roundMinutes(r);
    addXp(r.day, ROUND_BONUS[r.act](r.n));
    const extra = Math.max(0, Math.round(num(r.countAs)));
    if (extra) {
      days[r.day] = num(days[r.day] ?? curDays[r.day]) + extra;
      extraAnswers += extra;
    }
  }

  const patch: Doc = {};
  if (Object.keys(days).length) patch.days = days;
  if (Object.keys(xpDays).length) patch.xpDays = xpDays;
  if (xp) patch.xp = num(cur.xp) + xp;
  if (answers.length || extraAnswers) patch.answers = num(cur.answers) + answers.length + extraAnswers;
  if (answers.length) {
    patch.vAnswers = num(cur.vAnswers) + answers.length;
    patch.ema = ema;
    patch.n = n;
  }
  if (Object.keys(act).length) patch.act = act;
  if (Object.keys(minutes).length) patch.minutes = minutes;
  if (ctx.deviceId) patch.lxSeq = { [ctx.deviceId]: ctx.seq };
  return patch;
}
