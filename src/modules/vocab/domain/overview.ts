import { addDays, dayKey } from '../shared';
import { type Catalog, forecastMinutes, isNewLex } from './catalog';
import { freshFor, newCostMs, reviewCapMs } from './day';
import { planMed } from './pace';
import type { FormStats, VocabCfg } from './types';

// Großpaket A S6 (Bild s2-04, Übersicht): „Die nächsten 14 Tage · Minuten Wörter“. Wiederholungen aus den Terminen (forecastMinutes),
// dazu die neuen Wörter, wie der Tagesplan sie vergeben würde – dieselbe Regel wie `buildDayPlan` (Politur P2, E3): Wiederholungen zuerst
// (`reviewCapMs`), neue = was übrig bleibt, mindestens 2, höchstens das Tempo (`freshFor`); bei Tempo 0 keine. Gerechnet wird mit denselben
// Zeiten wie der Plan (`planMed`: gemessen, sonst realistische Startwerte) – vorher mit den bloßen Antwortzeiten, die Vorschau war dreimal zu klein.
// Rein und ohne Uhr: `nowMs` kommt von außen.

export type OutlookDay = { d: string; review: number; fresh: number; nFresh: number };
export type Outlook = { days: OutlookDay[]; avg: number; peak: number };

const round1 = (x: number): number => Math.round(x * 10) / 10;

/** Vorschau für die nächsten `n` Lerntage (Index 0 = morgen). Der Vorrat neuer Wörter wird mitgezählt und kann aufgebraucht werden. */
export function outlook(cat: Catalog, med0: FormStats, nowMs: number, cfg: Pick<VocabCfg, 'min' | 'newPerDay'>, n = 14): Outlook {
  const med = planMed(med0);
  const review = forecastMinutes(cat, med, nowMs, n);
  const nc = newCostMs(med);
  const budget = cfg.min * 60_000;
  let left = cat.items().filter((it) => isNewLex(it.lex)).length;
  const today = dayKey(nowMs);
  const days = review.map((r, i): OutlookDay => {
    const quota = cfg.newPerDay;
    // Wie im Plan: die Wiederholungen belegen höchstens ihren Deckel (der Rest wird verteilt), die neuen bekommen, was übrig bleibt.
    const reviewMs = Math.min(r * 60_000, reviewCapMs(quota, budget, nc));
    const nFresh = Math.min(freshFor({ quota, budgetMs: budget, reviewMs, nc }), left);
    left -= nFresh;
    return { d: addDays(today, i + 1), review: r, fresh: round1((nFresh * nc) / 60_000), nFresh };
  });
  const totals = days.map((x) => x.review + x.fresh);
  const avg = totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0;
  return { days, avg, peak: Math.round(Math.max(0, ...totals)) };
}
