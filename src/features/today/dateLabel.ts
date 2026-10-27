import { dayKeyNoon } from '../../domain/date';
import type { Lang } from '../../app/settings';

/** Lerntag (Wechsel um 04:00), dieselbe Datumsfunktion wie der Plan: nachts gilt noch der Vortag. Der Titel von Heute ist das Datum (§2.2).
 *  Das Start-Bild in index.html rechnet dasselbe in reinem JS (U2) – beide Formate gleich halten. */
export function dateLabelOf(today: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(dayKeyNoon(today));
}
