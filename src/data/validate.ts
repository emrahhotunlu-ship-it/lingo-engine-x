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
