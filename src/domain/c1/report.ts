import { hash32 } from '../random';

// Gemeldete Aufgaben (UX-Neuanfang D, 02.11.2026): Kennungen in `app/c1.bad` (`gr:<Aufgabe>` aus Grammatik, `c1:<Aufgabe>` aus Anwenden).
// Rein, damit die Auswahl (Grammatik-Runde, c1x) gemeldete Aufgaben sperren kann (learning-scientist 02.11.: nie wieder stellen).

export const TASK_REPORT_PREFIXES = ['gr:', 'c1:'] as const;
const MAX_LEN = 32;

export const isTaskReport = (id: string): boolean => TASK_REPORT_PREFIXES.some((p) => id.startsWith(p));

/** Kurze, stabile Kennung: unverändert bis 32 Zeichen, sonst Anfang + `#` + Prüfsumme (Basis 36) der vollen Kennung. */
export function reportId(id: string): string {
  if (id.length <= MAX_LEN) return id;
  const h = hash32(id).toString(36);
  return `${id.slice(0, MAX_LEN - 1 - h.length)}#${h}`;
}

/** Wurde die Grammatik-Aufgabe mit diesem Schlüssel gemeldet (`gr:<key>`; c1x-Aufgaben auch über `c1:<id>`)? */
export function isReportedTask(bad: ReadonlySet<string> | undefined, key: string): boolean {
  if (!bad?.size) return false;
  if (bad.has(reportId(`gr:${key}`))) return true;
  return key.startsWith('c1:') && bad.has(reportId(key));
}

/** Menge der Meldungen aus `app/c1` (tolerant gelesen). */
export function reportedSetOf(c1: unknown): Set<string> {
  const bad = c1 && typeof c1 === 'object' ? (c1 as { bad?: unknown }).bad : undefined;
  return new Set(Array.isArray(bad) ? bad.filter((x): x is string => typeof x === 'string') : []);
}
