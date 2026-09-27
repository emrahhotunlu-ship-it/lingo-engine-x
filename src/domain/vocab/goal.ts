import type { TrainCard } from '../srs/types';
import { addDays } from '../date';

// Wortschatzziel 8.000 für C1 mit Tempo-Prognose (Kap. 6.3, phase1-plan §4.9, Plan §7).
// Messwert: letzter Wortschatztest (`profile.vtests[].passive`), sonst letzter `history[].vs`.
// Dazu die seit der Messung gefestigten Karten (Einführung ab Messtag, Stabilität ≥ 7 Tage).

export const VOCAB_TARGET = 8000;

export type VocabGoal = {
  target: number;
  now: number | null;
  band: [number, number] | null;
  measuredOn: string | null;
  perWeek: number;
  weeks: number | null;
  reached: boolean;
  measured: boolean;
};

type Doc = Readonly<Record<string, unknown>>;
const arr = (v: unknown): Doc[] => (Array.isArray(v) ? v.filter((x): x is Doc => !!x && typeof x === 'object') : []);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function vocabGoal(i: { profile: Doc | null | undefined; cards: readonly TrainCard[]; today: string }): VocabGoal {
  const p = i.profile ?? {};
  const tests = arr(p.vtests)
    .filter((v) => num(v.passive) !== null)
    .sort((a, b) => (num(a.t) ?? 0) - (num(b.t) ?? 0));
  const last = tests[tests.length - 1];
  let v0: number | null = null;
  let band: [number, number] | null = null;
  let measuredOn: string | null = null;
  if (last) {
    v0 = num(last.passive);
    const lo = num(last.pLo);
    const hi = num(last.pHi);
    band = lo !== null && hi !== null ? [lo, hi] : null;
    measuredOn = typeof last.d === 'string' ? last.d : null;
  } else {
    const hist = arr(p.history).filter((h) => num(h.vs) !== null);
    const h = hist[hist.length - 1];
    if (h) {
      v0 = num(h.vs);
      measuredOn = typeof h.d === 'string' ? h.d : null;
    }
  }
  const vocab = i.cards.filter((c) => !c.hidden && c.path.startsWith('vocab/'));
  const learned = measuredOn ? vocab.filter((c) => c.intro !== null && c.intro >= (measuredOn ?? '') && c.fsrs.stability >= 7).length : 0;
  const from = addDays(i.today, -27);
  const recent = vocab.filter((c) => c.intro !== null && c.intro >= from && c.intro <= i.today).length;
  const perWeek = Math.round((recent * 7) / 28 * 10) / 10;
  const now = v0 === null ? null : Math.round(v0 + learned);
  const reached = now !== null && now >= VOCAB_TARGET;
  const weeks = now === null || reached || perWeek < 1 ? null : Math.ceil((VOCAB_TARGET - now) / perWeek);
  return { target: VOCAB_TARGET, now, band, measuredOn, perWeek, weeks, reached, measured: v0 !== null };
}
