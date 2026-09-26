// Browser-Speicher nur für Bequemlichkeit (Kap. 3.1): Entwürfe, zuletzt offener Reiter,
// Darstellung für den ersten Aufbau. Lernfortschritt gehört immer in db.
// Jeder Zugriff kann werfen (privates Fenster, gesperrte Website-Daten) und wird abgefangen.

type Reporter = (scope: string, err: unknown, detail?: string) => void;

let report: Reporter = (scope, err) => {
  console.warn(scope, err);
};

/** Die Diagnose meldet sich hier an; so entsteht keine Import-Schleife. */
export function setStorageReporter(fn: Reporter): void {
  report = fn;
}

function area(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch (err) {
    report('storage:open', err);
    return null;
  }
}

export const local = {
  get(key: string): string | null {
    try {
      return area()?.getItem(key) ?? null;
    } catch (err) {
      report('storage:get', err, key);
      return null;
    }
  },
  set(key: string, value: string): boolean {
    try {
      const a = area();
      if (!a) return false;
      a.setItem(key, value);
      return true;
    } catch (err) {
      report('storage:set', err, key);
      return false;
    }
  },
  remove(key: string): void {
    try {
      area()?.removeItem(key);
    } catch (err) {
      report('storage:remove', err, key);
    }
  },
  keys(): string[] {
    try {
      const a = area();
      if (!a) return [];
      const out: string[] = [];
      for (let i = 0; i < a.length; i++) {
        const k = a.key(i);
        if (k !== null) out.push(k);
      }
      return out;
    } catch (err) {
      report('storage:keys', err);
      return [];
    }
  },
  getJson<T>(key: string): T | null {
    const raw = local.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      report('storage:parse', err, key);
      return null;
    }
  },
};

/** Schlüssel-Präfix der neuen App; die alte App nutzt `sw2:`. */
export const KEY_PREFIX = 'lx:';
