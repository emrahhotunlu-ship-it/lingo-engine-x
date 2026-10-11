// Kapitel-Arbeit (K1, `docs/umbau/kapitel-plan.md`): EINE Quelle für „das Kapitel, in dem Emrah gerade ist“. Hat er ein Kapitel gewählt
// (`app/c1.ch.n`, 1-basiert), gilt die Wahl; sonst das abgeleitete Kapitel (`currentChapter`). „Du bist hier“, „Als Nächstes“, Heute und
// der Tagesplan lesen alle diese Funktion, deshalb können sie sich nicht widersprechen.

/** Gibt den 0-basierten Index des wirksamen Kapitels zurück. `chosen` ist 1-basiert (wie `app/c1.ch.n`), `derived` 0-basiert. */
export function effectiveChapter(chosen: number | null | undefined, derived: number, count = 7): number {
  if (typeof chosen === 'number' && Number.isInteger(chosen) && chosen >= 1 && chosen <= count) return chosen - 1;
  return derived;
}
