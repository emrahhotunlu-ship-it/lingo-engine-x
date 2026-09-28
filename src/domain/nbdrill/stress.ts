// Wortbetonung und Zahlen (Lehrer P1, P4, Plan N109): lokal aus den P7a-Listen, ohne KI.

export const STRESS_N = 8;
export const NUMBERS_N = 6;

/** Anzeige mit betonter Silbe in Großbuchstaben: DOC·u·ment. */
export function stressedWord(syll: readonly string[], stress: number): string {
  return syll.map((s, i) => (i === stress ? s.toUpperCase() : s)).join('·');
}

/** Richtig getippt? (Index der betonten Silbe) */
export const stressOk = (stress: number, tapped: number): boolean => stress === tapped;
