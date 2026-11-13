import { getWriter } from '../../data';
import { validateDoc } from '../../data/validate';
import { bridgeStatPatch } from '../../domain/apply/bridgeTime';
import { freeUsePatch } from '../../domain/grammar/freeUse';
import { logError } from '../../platform/diagnostics';

// Schreibwege der Brücken-Sätze außerhalb der Wörter-App (Großpaket P „Politur“, P4). Jeder ist ein `transform` auf dem FRISCHEN Dokument, rein
// ergänzend (`update` mit genau einem kleinen Feld), nur bei Änderung, nie in ein ungültiges Dokument (Kap. 9), nie angelegt, nie gelöscht.
//  - `saveFreeUse`: Beleg-Zähler „frei verwendet“ je Muster, `grammar/<thema>.fu[muster]` (`domain/grammar/freeUse.ts`); nie ein BKT-Schritt.
//  - `saveBridgeStat`: gemessene Zeit je Satz, `app/profile.abm` (`domain/apply/bridgeTime.ts`), für die ehrlichen Minuten von Schritt 3.

/** `true` = gezählt; `false` = nichts geschrieben (heute schon gezählt, Dokument fehlt oder ungültig, kein Schreibweg, Fehler). */
export async function saveFreeUse(topic: string, pat: string, day: string): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  const path = `grammar/${topic}`;
  let done = false;
  try {
    await writer.transform(path, (cur) => {
      if (!cur || !validateDoc(path, cur).ok) return null;
      const patch = freeUsePatch(cur, pat, day);
      if (!patch) return null;
      done = true;
      return { update: patch };
    });
  } catch (err) {
    logError('apply:freeUse', err, path);
    return false;
  }
  return done;
}

/**
 * Satzdauern einer Runde in das gleitende Mittel `app/profile.abm` übernehmen; `true` = geschrieben. `round` = Marke der Runde: dieselbe
 * Runde wird höchstens einmal übernommen (auf dem frischen Stand geprüft, `bridgeStatPatch`).
 */
export async function saveBridgeStat(durations: readonly number[], round?: string): Promise<boolean> {
  const writer = getWriter();
  if (!writer || !durations.length) return false;
  const path = 'app/profile';
  let done = false;
  try {
    await writer.transform(path, (cur) => {
      if (!cur || !validateDoc(path, cur).ok) return null;
      const patch = bridgeStatPatch(cur, durations, round);
      if (!patch) return null;
      done = true;
      return { update: patch };
    });
  } catch (err) {
    logError('apply:bridgeStat', err, path);
    return false;
  }
  return done;
}
