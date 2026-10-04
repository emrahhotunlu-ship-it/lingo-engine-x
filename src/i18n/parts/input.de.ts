// Oberflächentexte von Phase 4 (Lesen, Hören, Schreiben, Entdecken), Deutsch.
// Werden in de.ts per Spread eingebunden. Einfache Sprache, keine Fachwörter (CLAUDE.md A2).

export const inputDe = {
  // ---------------------------------------------------------------- gemeinsam
  agoNever: 'noch nie geübt',
  agoDaysN_one: 'zuletzt gestern',
  agoDaysN_other: 'zuletzt vor {n} Tagen',
  // ---------------------------------------------------------------- Lesen
  // ---------------------------------------------------------------- Hören
  // ---------------------------------------------------------------- Schreiben
  // ---------------------------------------------------------------- Entdecken
};

export type InputMessageKey = keyof typeof inputDe;
