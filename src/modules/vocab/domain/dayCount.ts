// Wörter-Modul: EINE Zählregel für den eingefrorenen Tagesplan `vmod/day` (K11/K12/K13, Emrah 04.11.2026). Heute und die laufende Runde
// zählen damit dieselben einzelnen Wörter: ein Eintrag ist erledigt, sobald seine Wiederholung heute gebucht bzw. das neue Wort heute
// eingeführt ist. Lernschritte, Wiederkehr nach Fehlern und Kontrastkarten sind keine eigenen Einträge – ein Fehler erhöht die Gesamtzahl nie.
// Leicht (ohne Planer-Code), damit `api.ts` es für Heute nutzen kann (tests/unit/vocab/isolation.test.ts „Ladezeit“).

/** Was die Zählung vom Lexem braucht (Abruf-Tag, Erkennen-Tag, Einführungstag). */
export type DayMark = { day: string | null; dayU: string | null; intro: string | null };

/** Eintrag des Tagesplans: `[Pfad, Spur, Form]`, Spur `n` = neues Wort. */
export type PlanEntry = readonly [string, string, string];

/**
 * Heute schon gebucht? `day` (Abruf-Spur) ODER `dayU` (Erkennen, z. B. Aufdecken im Anki-Modus). Vorher prüfte die Runde nur `day`: im
 * Anki-Modus kamen schon aufgedeckte Wörter nach dem Verlassen und Wiedereinstieg erneut (Emrah 04.11.2026 „muss von vorne anfangen“).
 */
export function doneToday(l: { day: string | null; dayU: string | null }, day: string): boolean {
  return l.day === day || l.dayU === day;
}

/**
 * Stand des Tagesplans: `done` erledigte, `total` zählbare Einträge (Einträge ohne Lexem – gelöscht, ausgeblendet, zusammengeführt – zählen
 * weder hier noch in der Runde, die sie überspringt).
 */
export function planCount(plan: readonly PlanEntry[], lexOf: (path: string) => DayMark | null, day: string): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const [path, track] of plan) {
    const l = lexOf(path);
    if (!l) continue;
    total++;
    if (track === 'n' ? l.intro === day : doneToday(l, day)) done++;
  }
  return { done, total };
}
