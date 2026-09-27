// Herkunft `src` einer per Wort-Antippen gespeicherten Karte (Plan F21): In Lesen, Hören und
// Schreiben gelten die Altwerte der alten App (read, listen, write); Entdecken ist Lesen.
// Der Übersetzer behält `translate` (Phase 5). Alle anderen Bereiche bleiben bei `lookup` wie in Phase 1.

export type TapCardSrc = 'lookup' | 'read' | 'listen' | 'write' | 'translate';

export function cardSrcFor(area: string): TapCardSrc {
  if (area === 'read' || area === 'discover') return 'read';
  if (area === 'listen') return 'listen';
  if (area === 'write') return 'write';
  if (area === 'translate') return 'translate';
  return 'lookup';
}
