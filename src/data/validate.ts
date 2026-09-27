import { schemaForPath } from './paths';

// Jeder gelesene Datensatz wird geprüft (Kap. 9, Regel 6). Ungültige Dokumente werden
// gemeldet und ausgelassen – nie überschrieben, nie gelöscht.

export type Validated<T = Record<string, unknown>> =
  | { ok: true; path: string; value: T }
  | { ok: false; path: string; issues: string[] };

export function validateDoc(path: string, data: unknown): Validated {
  const schema = schemaForPath(path);
  if (!schema) return { ok: true, path, value: (data ?? {}) as Record<string, unknown> };
  const res = schema.safeParse(data);
  if (res.success) return { ok: true, path, value: res.data as Record<string, unknown> };
  return {
    ok: false,
    path,
    issues: res.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '(Dokument)'}: ${i.message}`),
  };
}

// ---------------------------------------------------------------- Zwischenspeicher (A7 H6)
// Die Laufzeit liefert ein unverändertes Dokument über Lieferungen hinweg als DASSELBE,
// eingefrorene Objekt (contract/db.d.ts, DocumentSnapshot). Ein Abo auf `vocab` prüft sonst bei
// jeder geänderten Karte alle ~1.500 Karten erneut mit zod. Der Zwischenspeicher hängt am
// Objekt (WeakMap, räumt sich mit dem Objekt selbst auf) und am Pfad (das Schema hängt am Pfad).
// Ergebnis: dasselbe geprüfte `value`-Objekt – stabile Referenzen auch für Memos der Oberfläche.

const cache = new WeakMap<object, { path: string; res: Validated }>();
const stats = { hits: 0, misses: 0, ms: 0 };

/** Wie `validateDoc`, aber je Dokument-Objekt und Pfad nur einmal geprüft. */
export function validateCached(path: string, data: unknown): Validated {
  const key = data !== null && typeof data === 'object' ? data : null;
  if (key) {
    const hit = cache.get(key);
    if (hit && hit.path === path) {
      stats.hits++;
      return hit.res;
    }
  }
  stats.misses++;
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const res = validateDoc(path, data);
  if (typeof performance !== 'undefined') stats.ms += performance.now() - t0;
  if (key) cache.set(key, { path, res });
  return res;
}

/** Messwerte des Zwischenspeichers (Diagnose, Tests): Treffer, echte Prüfungen, Zeit der Prüfungen. */
export function validationStats(): Readonly<{ hits: number; misses: number; ms: number }> {
  return { ...stats };
}

/** Nur für Tests: Zähler zurücksetzen. */
export function resetValidationStats(): void {
  stats.hits = 0;
  stats.misses = 0;
  stats.ms = 0;
}
