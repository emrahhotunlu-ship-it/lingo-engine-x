import { readChecks } from '../check/record';

// Wochen-Check und Wortschatztest für „Fortschritt“ (Gesamtkonzept 3.5, K7 und K8): gezeigt wird erst, wenn die
// Zahl etwas aussagt. Rein, nur Lesen.

type Doc = Readonly<Record<string, unknown>>;
const DAY_MS = 86_400_000;
/** Ein einzelner Check hat 12 Aufgaben (± 23 Prozentpunkte, 95 %); deshalb erst ab 3 Checks zeigen. */
export const CHECKS_MIN = 3;
/** Gemittelt werden die letzten 4 Checks. */
export const CHECKS_MEAN_OF = 4;
/** Ein Wortschatztest gilt 90 Tage als belastbar. */
export const VTEST_VALID_DAYS = 90;

export type CheckMean = { n: number; enough: boolean; k: number; vocab: number | null; gram: number | null };

const pct = (ok: number, n: number): number | null => (n > 0 ? Math.round((ok / n) * 100) : null);

/** Mittel der letzten 4 Checks, Wörter (mit Wendungen) und Grammatik getrennt, jeweils über alle Aufgaben. */
export function checkMean(profile: unknown): CheckMean {
  const all = readChecks(profile);
  const last = all.slice(-CHECKS_MEAN_OF);
  const sum = (f: (c: (typeof last)[number]) => { ok: number; n: number }) => last.reduce((a, c) => ({ ok: a.ok + f(c).ok, n: a.n + f(c).n }), { ok: 0, n: 0 });
  const v = sum((c) => ({ ok: c.vocab.ok + c.colloc.ok, n: c.vocab.n + c.colloc.n }));
  const g = sum((c) => c.gram);
  const enough = all.length >= CHECKS_MIN;
  return { n: all.length, enough, k: last.length, vocab: enough ? pct(v.ok, v.n) : null, gram: enough ? pct(g.ok, g.n) : null };
}

export type VtestView = { state: 'none' } | { state: 'old'; t: number } | { state: 'valid'; t: number; passive: number; lo: number | null; hi: number | null };

/** Letzter Wortschatztest: ohne Test `none`, nach 90 Tagen `old` (keine Zahl), sonst die Zahl mit Spanne, wenn gemessen. */
export function vtestView(profile: Doc | null | undefined, nowMs: number): VtestView {
  const list = (Array.isArray(profile?.vtests) ? (profile.vtests as unknown[]) : [])
    .filter((v): v is Doc => !!v && typeof v === 'object' && typeof (v as Doc).passive === 'number')
    .sort((a, b) => (typeof a.t === 'number' ? a.t : 0) - (typeof b.t === 'number' ? b.t : 0));
  const v = list[list.length - 1];
  if (!v) return { state: 'none' };
  const t = typeof v.t === 'number' ? v.t : 0;
  if (!t || nowMs - t > VTEST_VALID_DAYS * DAY_MS) return { state: 'old', t };
  const lo = typeof v.pLo === 'number' ? v.pLo : null;
  const hi = typeof v.pHi === 'number' ? v.pHi : null;
  return { state: 'valid', t, passive: v.passive as number, lo, hi };
}
