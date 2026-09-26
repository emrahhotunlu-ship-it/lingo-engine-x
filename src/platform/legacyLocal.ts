import { local } from './storage';

// Die alte App spiegelt jedes Dokument in localStorage (`sw2:<pfad>`) und merkt sich in
// `sw2:__dirty` die Pfade, deren lokaler Stand neuer ist als die Datenbank
// (docs/altapp-analyse.md, Abschnitt 8). Beim Umzug auf dieselbe Adresse liegen diese
// Einträge im selben Browser. Gelesen wird nur; verändert wird hier nichts.

export type LegacyLocal = {
  /** Pfad → Zeitpunkt (ms), zu dem der lokale Stand als neuer markiert wurde. */
  dirty: Record<string, number>;
  /** Lokale Kopien der markierten Pfade. */
  docs: Record<string, Record<string, unknown>>;
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function readLegacyLocal(): LegacyLocal {
  const rawDirty = local.getJson<unknown>('sw2:__dirty');
  const dirty: Record<string, number> = {};
  const docs: Record<string, Record<string, unknown>> = {};
  if (!isObject(rawDirty)) return { dirty, docs };
  for (const [path, t] of Object.entries(rawDirty)) {
    if (typeof t !== 'number' || !path.includes('/')) continue;
    dirty[path] = t;
    const doc = local.getJson<unknown>(`sw2:${path}`);
    if (isObject(doc)) docs[path] = doc;
  }
  return { dirty, docs };
}
