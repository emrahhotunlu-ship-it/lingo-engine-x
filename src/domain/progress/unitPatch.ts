import { validateDoc } from '../../data/validate';
import type { Domain, InputKind } from '../input/types';
import { EMA_ALPHA } from './profilePatch';

// Abschluss einer Einheit aus Lesen, Hören, Schreiben oder Entdecken (Phase 4, Plan §3.2, F5–F9).
// Wirkt im SELBEN Sammel-Schreibvorgang wie die Trainer-Zähler (persist.ts): der Patch aus
// `profilePatch` wird um die Einheiten ergänzt – absolute Werte aus frischem Stand plus Delta,
// geschützt durch dieselbe Folgenummer `lxSeq[gerät]` (zweimal angewendet wirkt wie einmal).

type Doc = Record<string, unknown>;

export type ListenRecord = { id: string; level: string; n: number; ok: number; plays: number; rate: number; help: boolean; t: number };

export type UnitEnd = {
  day: string;
  act: InputKind;
  /** Nur Verständnisfragen zählen als Antworten (F9). */
  answers: number;
  right: number;
  /** Ergebnis je Frage in Reihenfolge (für die gleitende Trefferquote beim Hören). */
  oks?: readonly boolean[];
  activeMs: number;
  domain: Domain | null;
  listen?: ListenRecord;
};

export const UNIT_BONUS = 15;
export const LISTEN_MAX = 80;
const EMA_START_LISTEN = 0.5;
const EMA_START_ALL = 0.55;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const round4 = (v: number) => Math.round(v * 10_000) / 10_000;

/** Minuten einer Einheit: mindestens 1, höchstens 30 (Plan §3.2). */
export const unitMinutes = (u: Pick<UnitEnd, 'activeMs'>): number => Math.min(30, Math.max(1, Math.round(Math.max(0, u.activeMs) / 60_000)));

/** XP einer Einheit: +10 je richtige, +3 je falsche Antwort, +15 Einheitsbonus. */
export const unitXp = (u: Pick<UnitEnd, 'answers' | 'right'>): number => u.right * 10 + Math.max(0, u.answers - u.right) * 3 + UNIT_BONUS;

/**
 * Ergänzt `base` (Ergebnis von `profilePatch` oder `null`) um die Wirkung der Einheiten.
 * Ohne Einheiten bleibt `base` unverändert. `null` = nichts zu schreiben (ungültiges Profil,
 * Folgenummer schon angewendet oder keinerlei Deltas).
 */
export function unitsPatch(cur: Doc, base: Doc | null, units: readonly UnitEnd[], ctx: { deviceId: string | null; seq: number }): Doc | null {
  if (!units.length) return base;
  if (!validateDoc('app/profile', cur).ok) return null;
  // Schon angewendet: nur der Rest aus `profilePatch` (z. B. `pflicht`) bleibt.
  if (ctx.deviceId && num(obj(cur.lxSeq)[ctx.deviceId]) >= ctx.seq) return base;

  const patch: Doc = { ...(base ?? {}) };
  const days: Doc = { ...obj(patch.days) };
  const xpDays: Doc = { ...obj(patch.xpDays) };
  const minutes: Doc = { ...obj(patch.minutes) };
  const act: Doc = { ...obj(patch.act) };
  const curDays = obj(cur.days);
  const curXpDays = obj(cur.xpDays);
  const curMinutes = obj(cur.minutes);
  const curAct = obj(cur.act);
  let xp = typeof patch.xp === 'number' ? patch.xp : num(cur.xp);
  let answers = typeof patch.answers === 'number' ? patch.answers : num(cur.answers);
  const mix: Doc = {};
  const curMix = obj(cur.mix);
  let listen: unknown[] | null = null;
  let ema: Doc | null = null;
  let n: Doc | null = null;

  for (const u of units) {
    const a = Math.max(0, Math.round(u.answers));
    const r = Math.min(a, Math.max(0, Math.round(u.right)));
    if (a > 0) {
      days[u.day] = num(days[u.day] ?? curDays[u.day]) + a;
      answers += a;
    }
    const gained = unitXp({ answers: a, right: r });
    xpDays[u.day] = num(xpDays[u.day] ?? curXpDays[u.day]) + gained;
    xp += gained;
    const dayAct = { ...obj(curAct[u.day]), ...obj(act[u.day]) };
    act[u.day] = { ...obj(act[u.day]), [u.act]: num(dayAct[u.act]) + 1 };
    minutes[u.day] = num(minutes[u.day] ?? curMinutes[u.day]) + unitMinutes(u);
    if (u.domain) mix[u.domain] = num(mix[u.domain] ?? curMix[u.domain]) + 1;
    if (u.listen) {
      listen ??= Array.isArray(cur.listen) ? [...(cur.listen as unknown[])] : [];
      listen.push({ ...u.listen });
      // Gleitende Trefferquote wie in Phase 1: Kanal „listen" und „all", je Antwort.
      ema ??= { ...obj(cur.ema), ...obj(patch.ema) };
      n ??= { ...obj(cur.n), ...obj(patch.n) };
      const oks = u.oks && u.oks.length === a ? u.oks : Array.from({ length: a }, (_, i) => i < r);
      for (const ok of oks) {
        for (const ch of ['listen', 'all']) {
          const prev = typeof ema[ch] === 'number' ? num(ema[ch]) : ch === 'all' ? EMA_START_ALL : EMA_START_LISTEN;
          ema[ch] = round4(prev * (1 - EMA_ALPHA) + (ok ? 1 : 0) * EMA_ALPHA);
        }
        n.listen = num(n.listen) + 1;
      }
    }
  }

  patch.days = days;
  if (!Object.keys(days).length) delete patch.days;
  patch.xpDays = xpDays;
  patch.xp = xp;
  if (answers !== num(cur.answers) || typeof patch.answers === 'number') patch.answers = answers;
  patch.act = act;
  patch.minutes = minutes;
  if (Object.keys(mix).length) patch.mix = mix;
  if (listen) patch.listen = listen.slice(-LISTEN_MAX);
  if (ema) patch.ema = ema;
  if (n) patch.n = n;
  if (ctx.deviceId) patch.lxSeq = { ...obj(patch.lxSeq), [ctx.deviceId]: ctx.seq };
  return patch;
}
