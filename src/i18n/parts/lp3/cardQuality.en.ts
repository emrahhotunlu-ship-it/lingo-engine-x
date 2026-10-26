// Card quality (Oct 26, 2026, docs/umbau/card-quality.md): save word groups only as set phrases, paused reading cards. Prefix `ttCq`.

export const ttCardQualityEn = {
  ttCqNotUnit: 'Correct English, but not a set phrase, so no card.',
  ttCqBetterLabel: 'Related set phrase:',
  ttCqByClaude: 'Claude’s assessment; it may be wrong.',
  ttCqSaveSingle: 'Save only “{word}”',
  ttCqSingleSaved: '“{word}” saved',
  ttCqHeldRow: 'Paused reading cards (not a set phrase): {n}',
  ttCqHeldHint: 'These article cards are free word combinations. They’re paused and won’t come up in practice. Nothing was deleted.',
  ttCqHeldList: 'Paused reading cards',
  ttCqRelease: 'Learn anyway',
  ttCqReleaseAria: 'Learn anyway: {word}',
  ttCqReleased: 'Back in practice',
  ttCqReleaseFailed: 'Not saved. Please try again.',
} as const;
