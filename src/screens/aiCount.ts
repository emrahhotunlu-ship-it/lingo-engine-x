import { emptyDay, saveDay, useCoach } from '../coach/store';

/** Eine KI-Anfrage im Tageswert zählen (Anzeige in den Einstellungen, docs/neustart.md §8). */
export function countAiCall(day: string): void {
  const cur = useCoach.getState().days[day] ?? emptyDay();
  void saveDay(day, { ...cur, ai: (cur.ai ?? 0) + 1 });
}
