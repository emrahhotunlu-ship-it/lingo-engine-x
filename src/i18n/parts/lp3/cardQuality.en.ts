// Card quality (Oct 26, 2026, docs/umbau/card-quality.md): save word groups only as fixed units, resting reading cards. Prefix `ttCq`.

export const ttCardQualityEn = {
  ttCqNotUnit: 'Not a fixed phrase, so no card.',
  ttCqBetterLabel: 'The usual phrase is:',
  ttCqByClaude: 'Claude’s assessment, may contain mistakes.',
  ttCqSaveSingle: 'Save only “{word}”',
  ttCqSingleSaved: '“{word}” saved',
  ttCqHeldRow: 'Resting reading cards (not a fixed phrase): {n}',
  ttCqHeldHint: 'These cards from articles are free word groups. They rest and stay out of training. Nothing was deleted.',
  ttCqHeldList: 'Resting reading cards',
  ttCqRelease: 'Learn anyway',
  ttCqReleaseAria: 'Learn anyway: {word}',
  ttCqReleased: 'Back in training',
  ttCqReleaseFailed: 'Not saved. Please tap again.',
} as const;
