// Kartenqualität (26.10.2026, docs/umbau/card-quality.md): Wortgruppen nur als feste Einheit speichern, ruhende Lesekarten. Präfix `ttCq`.

export const ttCardQualityDe = {
  ttCqNotUnit: 'Keine feste Wendung, darum keine Karte.',
  ttCqBetterLabel: 'Üblich ist:',
  ttCqByClaude: 'Einschätzung von Claude, kann Fehler enthalten.',
  ttCqSaveSingle: 'Nur „{word}“ speichern',
  ttCqSingleSaved: '„{word}“ gespeichert',
  ttCqHeldRow: 'Ruhende Lesekarten (keine feste Wendung): {n}',
  ttCqHeldHint: 'Diese Karten aus Artikeln sind freie Wortgruppen. Sie ruhen und kommen nicht ins Training. Gelöscht ist nichts.',
  ttCqHeldList: 'Ruhende Lesekarten',
  ttCqRelease: 'Doch lernen',
  ttCqReleaseAria: 'Doch lernen: {word}',
  ttCqReleased: 'Kommt wieder ins Training',
  ttCqReleaseFailed: 'Nicht gespeichert. Bitte noch einmal tippen.',
} as const;
