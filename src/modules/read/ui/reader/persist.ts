import type { ReadView } from '../../schemas';
import { READ_PREFS_PATH } from '../../domain/paths';
import { logError, type Writer } from '../../shared';

// Schreiben des Lesers (nur auf eine Handlung hin): die gewählte Ansicht in `read/p`. Der Lesezustand geht über `saveReadState` (store.ts).

/** Ansicht in `read/p` merken. Gleicher Wert = nichts schreiben. Fehler werden protokolliert und nicht weitergereicht (Komfort, kein Lernstand). */
export async function saveView(writer: Writer, view: ReadView): Promise<void> {
  try {
    await writer.transform(READ_PREFS_PATH, (cur) => {
      if (!cur) return { set: { v: 1, view } };
      if (cur.view === view) return null;
      return { update: { view } };
    });
  } catch (err) {
    logError('read:view', err, READ_PREFS_PATH);
  }
}
