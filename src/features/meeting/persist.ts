import { getWriter } from '../../data';
import { meetingPath, patchMeetingItem, upsertMeetingItem, withDebrief, type DebriefEntry, type MeetingItem, type MeetingPrep } from '../../domain/meeting/meetingDoc';
import { logError } from '../../platform/diagnostics';

// Schreibwege von „Mein nächster Termin“ (Lernberatung 27.09., V4): nur über den einen Writer,
// nur auf Handlungen hin (Vorbereitung erstellt, Generalprobe gestartet, Nachbesprechung).
// Immer ein `transform` auf dem frischen Stand von `meeting/<Monat>`.

export async function saveMeeting(item: MeetingItem): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  try {
    await writer.transform(meetingPath(item.day), (cur) => upsertMeetingItem(cur, item));
    return true;
  } catch (err) {
    logError('meeting:save', err, item.id);
    return false;
  }
}

/** Vorbereitung am vorhandenen Termin nachtragen (nur dieses Feld, aus dem frischen Stand). */
export async function setMeetingPrep(day: string, id: string, prep: MeetingPrep): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  try {
    await writer.transform(meetingPath(day), (cur) => patchMeetingItem(cur, id, (it) => ({ ...it, prep })));
    return true;
  } catch (err) {
    logError('meeting:prep', err, id);
    return false;
  }
}

/** Kennung der Generalprobe-Szene am Termin vermerken (nur, wenn noch keine da ist). */
export async function setMeetingScene(day: string, id: string, sceneId: string): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  try {
    await writer.transform(meetingPath(day), (cur) => patchMeetingItem(cur, id, (it) => (typeof it.sceneId === 'string' && it.sceneId ? null : { ...it, sceneId })));
    return true;
  } catch (err) {
    logError('meeting:scene', err, id);
    return false;
  }
}

/** Nachbesprechung am Termin anhängen. */
export async function addMeetingDebrief(day: string, id: string, entries: readonly DebriefEntry[]): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  try {
    await writer.transform(meetingPath(day), (cur) => patchMeetingItem(cur, id, (it) => withDebrief(it, entries)));
    return true;
  } catch (err) {
    logError('meeting:debrief', err, id);
    return false;
  }
}
