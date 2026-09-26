import { local, KEY_PREFIX } from './storage';

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

// Welche vorgemerkten Kopien in DIESEM Browser schon behandelt sind (ergänzt oder bewusst
// übersprungen). Die `sw2:`-Einträge der alten App selbst bleiben unverändert stehen.
const HANDLED_KEY = `${KEY_PREFIX}legacy-rescue`;

export function readHandled(): Record<string, number> {
  const v = local.getJson<unknown>(HANDLED_KEY);
  const out: Record<string, number> = {};
  if (isObject(v)) for (const [k, t] of Object.entries(v)) if (typeof t === 'number') out[k] = t;
  return out;
}

export function markHandled(entries: Record<string, number>): void {
  local.set(HANDLED_KEY, JSON.stringify({ ...readHandled(), ...entries }));
}

/** Vorgemerkte Kopien, die in diesem Browser noch nicht behandelt wurden. */
export function pendingLegacyLocal(): LegacyLocal {
  const all = readLegacyLocal();
  const handled = readHandled();
  const dirty: Record<string, number> = {};
  const docs: Record<string, Record<string, unknown>> = {};
  for (const [path, t] of Object.entries(all.dirty)) {
    if (handled[path] === t) continue;
    dirty[path] = t;
    const d = all.docs[path];
    if (d) docs[path] = d;
  }
  return { dirty, docs };
}
