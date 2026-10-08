import { useEffect, useMemo, useState } from 'react';
import { useClock } from '../../app/clock';
import { useSettings } from '../../app/settings';
import { invalidIdsOf, useLive } from '../../data/live';
import { readC1 } from '../../domain/c1/c1doc';
import { cardStats, fixedStats, newMilestones, topicsFest, truthParts, type Milestone } from '../../domain/plan/dayStats';
import { buildTrainCards, festUnits } from '../../domain/metrics';
import { buildChunkCards } from '../../domain/srs/chunkCards';
import { logWarn } from '../../platform/diagnostics';
import { goalLine, type TextRef } from './goalLine';
import { claimMilestone } from './milestoneClaim';
import type { TodayView } from './state';

// Abschluss von „Heute“ (Gesamtkonzept 3.2): Die Wahrheitszeile „Heute neu sicher: n · Fehler weg: n · überfällig −n“ und der
// Meilenstein-Satz. Alles wird aus dem Stand abgeleitet; die Morgenwerte (überfällig, sicher) stehen additiv im eingefrorenen
// Plan (`plan.u.ov`, `plan.u.sure`). Fehlt ein Morgenwert (Plan von früher), entfällt der Teil – es wird nie etwas behauptet,
// was nicht belegt ist. Der Meilenstein wird einmal gezeigt und in `app/profile.ms` gemerkt.

export type DoneFacts = {
  sure: number | null;
  fixed: number | null;
  over: number | null;
  milestone: Milestone | null;
  /** Das eine nächste Ziel (Kennung aus dem Plan von heute, Zahlen live); `null` ohne Kennung oder wenn es erreicht ist. */
  goal: TextRef | null;
};

const EMPTY_FACTS: DoneFacts = { sure: null, fixed: null, over: null, milestone: null, goal: null };
const EMPTY = new Map<string, Record<string, unknown>>();

/** Meilenstein des Tages, einmal bestimmt: bleibt den ganzen Lerntag sichtbar, auch nachdem er gemerkt wurde. */
const shown = new Map<string, Milestone | null>();
const marking = new Set<string>();

export function useDoneFacts(view: Pick<TodayView, 'plan' | 'status'>, active: boolean): DoneFacts {
  const today = useClock((s) => s.today);
  const now = useClock((s) => s.now);
  const lang = useSettings((s) => s.lang);
  const profile = useLive((s) => s.docs['app/profile']);
  const repairDoc = useLive((s) => s.docs['app/repair']);
  const c1Raw = useLive((s) => s.docs['app/c1']);
  const vocab = useLive((s) => s.collections.vocab) ?? EMPTY;
  const chunk = useLive((s) => s.collections.chunk) ?? EMPTY;
  const grammar = useLive((s) => s.collections.grammar) ?? EMPTY;
  const plan = view.plan;

  const calc = useMemo(() => {
    if (!active) return null;
    try {
      const live = useLive.getState();
      const cards = buildTrainCards(vocab, now, invalidIdsOf(live.invalid, 'vocab'));
      const all = [...cards, ...buildChunkCards(chunk, now, invalidIdsOf(live.invalid, 'chunk'))];
      const st = cardStats(all, lang, now);
      const fixed = fixedStats({ grammarDocs: grammar, repairDoc, today });
      const ov = plan?.u?.ov ?? null;
      const sure0 = plan?.u?.sure ?? null;
      const parts = truthParts({ sure: st.sure, sure0, fixed: fixed.today, overdue: st.overdue, overdue0: ov });
      // Wort-Marken zählen Wörter UND Wendungen (`festUnits`, K-14); die Umstellung merkt schon erreichte Marken still (`pickMilestone`).
      const fest = festUnits(all);
      const c1 = readC1(c1Raw);
      const ms = newMilestones({
        fest,
        topicsFest: topicsFest(grammar, now),
        fixTotal: fixed.total,
        overdue0: ov,
        overdue: ov === null ? null : st.overdue,
        seen: profile?.ms as Record<string, unknown> | undefined,
        chapters: c1.gates.filter((g) => g.ok).map((g) => g.ch),
        place: !!c1.place,
        checks: c1.checks.length,
      });
      const goal = goalLine({ nx: plan?.u?.nx, festUnits: festUnits(all), vocabFest: festUnits(cards), history: profile?.history, today });
      return { parts, ms, goal };
    } catch (err) {
      logWarn('today:done', err);
      return null;
    }
  }, [active, vocab, chunk, grammar, repairDoc, c1Raw, profile, plan, lang, now, today]);

  // Meilenstein beanspruchen (ein Schritt auf dem frischen Stand): nur das Gerät, das den Eintrag anlegt, zeigt die Karte; der Tag behält sie.
  const [, bump] = useState(0);
  useEffect(() => {
    if (!calc || !calc.ms.length) return;
    const key = `${today}:${calc.ms.map((m) => m.id).join(',')}`;
    if (marking.has(key)) return;
    marking.add(key);
    // Schreiben gescheitert: Merker lösen, damit diese Sitzung es erneut versucht (sonst Eintrag ohne Karte).
    void claimMilestone(calc.ms, profile?.ms as Record<string, unknown> | undefined, today, { onFail: () => marking.delete(key) }).then((m) => {
      if (m && !shown.get(today)) {
        shown.set(today, m);
        bump((x) => x + 1);
      }
    });
  }, [calc, profile, today]);

  if (!calc) return EMPTY_FACTS;
  return { sure: calc.parts.sure, fixed: calc.parts.fixed, over: calc.parts.over, milestone: shown.get(today) ?? null, goal: calc.goal };
}

/** Nur für Tests. */
export function resetDoneFactsForTests(): void {
  shown.clear();
  marking.clear();
}
