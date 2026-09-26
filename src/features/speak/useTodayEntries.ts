import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { mergeEntries, type DayEntry } from '../../domain/plan/buildPlan';
import { activityCounts, speakDutyDone } from '../../domain/speak/duty';
import { usePending } from '../vocab/persist';

// Einträge des heutigen Lerntags (Datenbank ⊕ Puffer), reaktiv – für Statuszeilen von Sprechen
// und Business. Dieselbe Quelle wie „Heute“, damit Häkchen und Zähler nie widersprechen (Kap. 2.2).

const EMPTY: DayEntry[] = [];

export function useTodayEntries(): { entries: DayEntry[]; loaded: boolean } {
  const today = useClock((s) => s.today);
  const day = useLive((s) => s.day);
  const pending = usePending((s) => s.entries);
  const live = day?.key === today && day.doc && Array.isArray(day.doc.entries) ? (day.doc.entries as DayEntry[]) : EMPTY;
  const loaded = day?.key === today && day.doc !== undefined;
  const entries = useMemo(
    () =>
      mergeEntries(
        live,
        pending.filter((e) => e.day === today),
      ),
    [live, pending, today],
  );
  return { entries, loaded };
}

export function useSpeakToday(): { done: boolean; talks: number; biz: number; loaded: boolean } {
  const { entries, loaded } = useTodayEntries();
  return useMemo(() => ({ done: speakDutyDone(entries), ...activityCounts(entries), loaded }), [entries, loaded]);
}
