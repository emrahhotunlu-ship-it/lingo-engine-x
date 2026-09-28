import { create } from 'zustand';

// Optimistisch erledigte Blöcke der Tageseinheit (Lerntag → `u-*`), bis `app/profile.act` sie trägt.
// Gleiches Prinzip wie der Sammel-Puffer (live ⊕ Puffer, Kap. 2.2): Zähler, Häkchen und
// „Weiter“ springen sofort, auch wenn der Schreibvorgang noch läuft. Nur im Speicher.

type Marks = { done: Readonly<Record<string, readonly string[]>> };

export const useUnitMarks = create<Marks>(() => ({ done: {} }));

export function markUnitLocal(day: string, key: string): void {
  const cur = useUnitMarks.getState().done[day] ?? [];
  if (cur.includes(key)) return;
  useUnitMarks.setState((s) => {
    const days = Object.keys(s.done).sort().slice(-2);
    const done: Record<string, readonly string[]> = {};
    for (const d of days) if (d !== day) done[d] = s.done[d] ?? [];
    done[day] = [...cur, key];
    return { done };
  });
}

export function resetUnitMarksForTests(): void {
  useUnitMarks.setState({ done: {} });
}
