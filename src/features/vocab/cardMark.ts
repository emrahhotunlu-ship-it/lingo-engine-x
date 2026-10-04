// Messmarke `lx:card` (leistung.md §4 Nr. 10, plan.md N29): „Weiter“/Bewertung → nächste Karte im
// Bild. `cardGo()` beim Übernehmen der Antwort, `cardShown()` nach dem Zeichnen der neuen Karte
// (nächster Frame). Das Ergebnis steht als `performance.measure('lx:card')` für Diagnose und Tests.

let goAt = 0;
let pending = false;

export function cardGo(): void {
  goAt = performance.now();
  pending = true;
}

export function cardShown(): void {
  if (!pending) return;
  pending = false;
  const start = goAt;
  requestAnimationFrame(() => {
    const end = performance.now();
    // Letzter Wert auch am Trainer (Diagnose, Tests: data-card-ms) – ohne Test-Code im Build.
    document.querySelector('[data-testid="trainer"]')?.setAttribute('data-card-ms', String(Math.round((end - start) * 10) / 10));
    try {
      performance.measure('lx:card', { start, end });
    } catch {
      // Ältere Browser ohne Optionen-Objekt: Messung entfällt (reine Diagnose, kein Fehlerfall).
      pending = false;
    }
  });
}
