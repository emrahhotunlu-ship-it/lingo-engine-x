import { local } from '../../platform/storage';

// Merkzettel der Wortschatz-Aufgaben (`wf`), die dieses Gerät schon gezeigt hat (Lernplattform 3.0 P38). Lexik-Aufgaben haben kein Grammatikthema und
// damit kein `seen` in der Datenbank; die Wortbildungs-Runden nehmen deshalb zuerst, was hier fehlt. Nur Bequemlichkeit je Gerät (kein Lernstand):
// fehlt der Speicher, kommen die Aufgaben nach Startwert gemischt, ein paar Wiederholungen sind dann möglich.

const KEY = 'lx:lexdone';
const MAX = 400;

/** Die schon gezeigten Aufgaben-IDs (neueste zuletzt). */
export function lexDoneList(): string[] {
  const v = local.getJson<unknown>(KEY);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export const lexDoneSet = (): ReadonlySet<string> => new Set(lexDoneList());

/** Merkt sich eine gezeigte Aufgabe (ohne Doppelte, höchstens 400). */
export function rememberLex(id: string): void {
  const list = lexDoneList().filter((x) => x !== id);
  list.push(id);
  local.set(KEY, JSON.stringify(list.slice(-MAX)));
}
