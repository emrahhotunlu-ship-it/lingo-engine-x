// Vergleich von JSON-Werten unabhängig von der Schlüsselreihenfolge.

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => jsonEqual(x, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a).filter((k) => a[k] !== undefined);
    const kb = Object.keys(b).filter((k) => b[k] !== undefined);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => jsonEqual(a[k], b[k]));
  }
  return false;
}

/** Würde `update(patch)` auf `current` nichts ändern? (Objekte verschmelzen, alles andere ersetzt.) */
export function patchIsNoop(current: Record<string, unknown>, patch: Record<string, unknown>): boolean {
  return Object.entries(patch).every(([k, v]) => {
    const cur = current[k];
    if (isPlainObject(v) && isPlainObject(cur)) return patchIsNoop(cur, v);
    return jsonEqual(cur, v);
  });
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
