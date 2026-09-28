// Messmarke `lx:card` (leistung.md §4 Nr. 10, plan.md N29): „Weiter“/Bewertung → nächste Karte im
// Bild. `cardGo()` beim Übernehmen der Antwort, `cardShown()` nach dem Zeichnen der neuen Karte
// (nächster Frame). Das Ergebnis steht als `performance.measure('lx:card')` für Diagnose und Tests.

let goAt = 0;

export function cardGo(): void {
  goAt = performance.now();
}

export function cardShown(): void {
  if (!goAt) return;
  const start = goAt;
  goAt = 0;
  requestAnimationFrame(() => {
    try {
      performance.measure('lx:card', { start, end: performance.now() });
    } catch {
      // Ältere Browser ohne Optionen-Objekt: Messung entfällt (reine Diagnose, kein Fehlerfall).
      goAt = 0;
    }
  });
}
