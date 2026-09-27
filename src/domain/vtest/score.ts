import { PSEUDO_N, VT_BANDS, VT_WORDS } from './build';

// Rechnung des Wortschatztests (Plan §8.2, dokumentiert in docs/vtest.md):
//   Fehlalarmquote f = fa/faN; je Band k_b = max(0, (h_b − f)/(1 − f)), bei f = 1 gilt k_b = 0.
//   Bedeutungsquote m' = (richtig + 1)/(geprüft + 2), ohne Probe m' = 1.
//   bands[b] = round2(k_b · m'); passive = round50(Σ 1000 · bands[b]).
//   SE = √Σ (1000² · x(1 − x)/10), pLo/pHi = passive ∓ 1,64 · SE (0–10.000).
//   aAcc = (richtig + 1)/(n + 2), active = round50(passive · aAcc), aLo/aHi analog.
// Ergebnis im Format der alten App (`profile.vtests[]`, Anhang B).

export type VtestAnswers = {
  /** „Kenne ich" je Wort bzw. Pseudowort. */
  yes: ReadonlySet<string>;
  /** Gezeigte Pseudowörter. */
  pseudoShown: readonly string[];
  meaning: { right: number; n: number };
  active: { right: number; n: number };
};

export type VtestResult = {
  t: number;
  d: string;
  passive: number;
  pLo: number;
  pHi: number;
  active: number;
  aLo: number;
  aHi: number;
  bands: number[];
  fa: number;
  faN: number;
  pseudoN: number;
  mAcc: number;
  aAcc: number;
  /** Dauer in Sekunden (wie die alte App). */
  dur: number;
};

const round2 = (x: number) => Math.round(x * 100) / 100;
const round50 = (x: number) => Math.round(x / 50) * 50;
const clamp = (x: number) => Math.max(0, Math.min(VT_BANDS * 1000, x));

export function scoreVtest(a: VtestAnswers, meta: { t: number; d: string; dur: number }): VtestResult {
  const faN = a.pseudoShown.length || PSEUDO_N;
  const fa = a.pseudoShown.filter((p) => a.yes.has(p)).length;
  const f = fa / faN;
  const m = a.meaning.n > 0 ? (a.meaning.right + 1) / (a.meaning.n + 2) : 1;
  const bands: number[] = [];
  for (let b = 1; b <= VT_BANDS; b++) {
    const words = VT_WORDS.filter((w) => w.band === b);
    const h = words.length ? words.filter((w) => a.yes.has(w.w)).length / words.length : 0;
    const k = f >= 1 ? 0 : Math.max(0, (h - f) / (1 - f));
    bands.push(round2(Math.min(1, k * m)));
  }
  const passive = round50(clamp(bands.reduce((s, x) => s + 1000 * x, 0)));
  const se = Math.sqrt(bands.reduce((s, x) => s + (1000 * 1000 * x * (1 - x)) / 10, 0));
  const pLo = round50(clamp(passive - 1.64 * se));
  const pHi = round50(clamp(passive + 1.64 * se));
  const aAcc = (a.active.right + 1) / (a.active.n + 2);
  return {
    t: meta.t,
    d: meta.d,
    passive,
    pLo,
    pHi,
    active: round50(passive * aAcc),
    aLo: round50(pLo * aAcc),
    aHi: round50(pHi * aAcc),
    bands,
    fa,
    faN,
    pseudoN: faN,
    mAcc: round2(m),
    aAcc: round2(aAcc),
    // Dauer in Sekunden wie die alte App (`vtests[].dur`, Befund H4); `meta.dur` kommt in ms.
    dur: Math.max(0, Math.round(meta.dur / 1000)),
  };
}
