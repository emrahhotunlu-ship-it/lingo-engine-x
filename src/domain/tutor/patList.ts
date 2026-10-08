import { patternsOf, topicsWithPatterns } from '../grammar/patterns';

// Kurzliste aller Grammatikmuster für die Tutor-Vorlagen (Lernplattform 3.0 P46/P47, KT T4/T6): „thema: id, id, …“, eine Zeile je Thema.
// Claude darf als `pat` nur Kennungen daraus nennen; alles andere wird zu `null` (`keepEdits`). Ungefähr 2 KB.

export const PAT_LIST_MAX = 3_000;

let cache: string | null = null;

/** Die Liste (gleich bei jedem Aufruf; die Muster sind Inhalt, kein Nutzerdatum). */
export function patListText(): string {
  if (cache !== null) return cache;
  const lines: string[] = [];
  for (const topic of topicsWithPatterns()) {
    const tp = patternsOf(topic);
    if (!tp) continue;
    lines.push(`${topic}: ${tp.patterns.map((p) => p.id).join(', ')}`);
  }
  let out = lines.join('\n');
  if (out.length > PAT_LIST_MAX) out = out.slice(0, out.lastIndexOf('\n', PAT_LIST_MAX));
  cache = out;
  return out;
}

const ID_RE = /\b[a-z0-9]{2,6}\.[a-z0-9-]{2,32}\b/g;

/** Alle Kennungen aus einer Liste im Format von `patListText` (die Vorlage prüft damit die Antwort). */
export function patIdsOf(list: string): Set<string> {
  return new Set(list.match(ID_RE) ?? []);
}
