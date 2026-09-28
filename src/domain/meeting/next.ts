import { listMeetings, readMeeting, type MeetingItem } from './meetingDoc';

// „Mein nächster Termin“ auf der Sprechen-Wurzel (Neubau plan.md §1.3): der nächste noch nicht
// besprochene Termin. Rein und getestet; `when` ist ein Datum `JJJJ-MM-TT` (Formular) oder leer.

type Doc = Record<string, unknown>;

/** Höchstens so viele Tage nach dem Anlegen gilt ein Termin ohne Datum noch als „nächster“. */
export const MEETING_OPEN_DAYS = 14;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function dayDiff(a: string, b: string): number {
  const ms = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  return Math.round((ms(b) - ms(a)) / 86_400_000);
}

/**
 * Nächster Termin: mit Datum heute oder später (frühester zuerst); sonst der jüngste ohne Datum,
 * ohne Nachbesprechung und höchstens `MEETING_OPEN_DAYS` alt. Vergangene Termine zählen nicht.
 */
export function nextMeeting(docs: ReadonlyMap<string, Doc> | undefined | null, today: string): MeetingItem | null {
  if (!docs) return null;
  const all = listMeetings(docs)
    .map(readMeeting)
    .filter((m): m is MeetingItem => !!m && m.debrief.length === 0);
  const dated = all.filter((m) => DAY.test(m.when) && m.when >= today).sort((a, b) => a.when.localeCompare(b.when));
  if (dated[0]) return dated[0];
  return all.filter((m) => !DAY.test(m.when) && DAY.test(m.day) && dayDiff(m.day, today) <= MEETING_OPEN_DAYS).sort((a, b) => b.t - a.t)[0] ?? null;
}

/** Tage bis zum nächsten Termin (für die Generalprobe am Donnerstag, `UnitPrefs.meetingInDays`). */
export function daysUntil(m: MeetingItem | null, today: string): number | null {
  if (!m || !DAY.test(m.when)) return null;
  return dayDiff(today, m.when);
}
