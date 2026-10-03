import { getWriter } from '../../data';
import { useLive } from '../../data/live';
import { levelsPatch, readEntry, type Level, type LevelKind } from '../../domain/levels/levels';
import { logError } from '../../platform/diagnostics';

// Schreibweg für `app/levels` (Lernpfad, docs/lernpfad-plan.md): ein `transform` auf dem frischen Stand, nur der eine
// Eintrag der Aufgabenart wird ersetzt, alles andere bleibt. Einmal je abgeschlossener Runde, nie in einer Schleife.

export const LEVELS_PATH = 'app/levels';

/** Aktuelle Stufe aus den Live-Daten (fehlt das Dokument: die Startstufe). */
export const currentLevel = (kind: LevelKind): Level => readEntry(useLive.getState().docs[LEVELS_PATH], kind).l;

/** Stufe nach dieser Runde (Vorschau aus dem aktuellen Stand, gleiche Regeln wie beim Speichern). */
export const nextLevel = (kind: LevelKind, scores: readonly number[], day: string): Level => readEntry(levelsPatch(useLive.getState().docs[LEVELS_PATH] ?? undefined, kind, scores, day), kind).l;

/** Ergebnisse einer Runde eintragen. true = gespeichert. */
export async function recordLevel(kind: LevelKind, scores: readonly number[], day: string): Promise<boolean> {
  const writer = getWriter();
  if (!writer || !scores.length) return false;
  try {
    await writer.transform(LEVELS_PATH, (cur) => {
      if (cur && cur.k != null && (typeof cur.k !== 'object' || Array.isArray(cur.k))) {
        logError('levels:save', new Error('app/levels unerwarteter Aufbau – nicht geschrieben'));
        return null;
      }
      const patch = levelsPatch(cur, kind, scores, day);
      return cur ? { update: patch } : { set: patch };
    });
    return true;
  } catch (err) {
    logError('levels:save', err, kind);
    return false;
  }
}
