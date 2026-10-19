// Vergleichsform der Fehlersätze, eigenes Modul ohne Abhängigkeiten: der Entwicklungs-Adapter (`platform/dev/canned/repairCheck.ts`) braucht
// nur sie und darf den Eintritts-Wächter (`gate.ts`, zieht die Inhalte nach) nicht mitbündeln.

/** Vergleichsform: klein, ohne Satzzeichen und doppelte Leerzeichen. */
export function repairNorm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
