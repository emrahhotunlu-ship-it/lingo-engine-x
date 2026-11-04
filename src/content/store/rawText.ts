import { create } from 'zustand';
import list from 'virtual:lx-raw-list';
import { logError } from '../../platform/diagnostics';
import { fetchRawText } from './loadPacked';

// Großpaket C „schneller Start“ (04.11.2026, Plan Stufe 1 P9): Große JSON-Inhalte (`?raw`) stehen im Mehr-Datei-Build nicht mehr in der
// ersten Datei, sondern in wenigen Sammeldateien (`raw-*.txt`, scripts/vite-raw-json-zip.mjs). Das Modul liefert einen Platzhalter mit derselben
// Bedienung wie ein Text (JSON.parse, indexOf, slice, length); sein Inhalt kommt aus `loadRawTexts()`, das beim Start alle Dateien
// parallel lädt. Bis dahin zeigt die App das Startbild und rechnet keinen Tagesplan (`useScreen`, Startknopf), damit nie ein Plan aus
// halben Inhalten entsteht (W6, Kap. 15). Im Einzeldatei-Build und in Tests ist die Liste leer und alles sofort bereit.

const texts = new Map<string, string>();
const keys = Object.keys(list);

export const useRawReady = create<{ ready: boolean; failed: boolean }>(() => ({ ready: keys.length === 0, failed: false }));

class RemoteText {
  constructor(private readonly key: string) {}
  get value(): string {
    const s = texts.get(this.key);
    if (s === undefined) throw new Error(`Inhalt „${this.key}“ ist noch nicht geladen (loadRawTexts).`);
    return s;
  }
  get length(): number {
    return this.value.length;
  }
  toString(): string {
    return this.value;
  }
  valueOf(): string {
    return this.value;
  }
  [Symbol.toPrimitive](): string {
    return this.value;
  }
  indexOf(a: string, b?: number): number {
    return this.value.indexOf(a, b);
  }
  slice(a?: number, b?: number): string {
    return this.value.slice(a, b);
  }
  includes(a: string, b?: number): boolean {
    return this.value.includes(a, b);
  }
  trim(): string {
    return this.value.trim();
  }
}

/** Platzhalter für eine nachgeladene Datei (nur vom Build-Plugin erzeugt). Wird wie der Text selbst benutzt. */
export function remoteText(key: string): string {
  return new RemoteText(key) as unknown as string;
}

let running: Promise<boolean> | null = null;

/** Alle Rohtext-Dateien parallel laden (einmal; nach einem Fehler startet der nächste Aufruf frisch, keine Schleife). */
export function loadRawTexts(): Promise<boolean> {
  if (useRawReady.getState().ready) return Promise.resolve(true);
  if (running) return running;
  running = (async () => {
    try {
      // Sammeldateien (scripts/vite-raw-json-zip.mjs): je Datei `{ key: text }`, jede Datei genau einmal.
      const files = [...new Set(keys.filter((k) => !texts.has(k)).map((k) => list[k]!))];
      await Promise.all(
        files.map(async (file) => {
          const doc = JSON.parse(await fetchRawText(file)) as Record<string, unknown>;
          for (const [k, v] of Object.entries(doc)) if (typeof v === 'string') texts.set(k, v);
        }),
      );
      const missing = keys.filter((k) => !texts.has(k));
      if (missing.length) throw new Error(`Inhalte fehlen nach dem Laden: ${missing.slice(0, 3).join(', ')}`);
      useRawReady.setState({ ready: true, failed: false });
      return true;
    } catch (err) {
      logError('content:raw', err);
      useRawReady.setState({ failed: true });
      return false;
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Sind alle Rohtexte da? (für nicht-React-Aufrufer, z. B. den Startknopf) */
export const rawReadyNow = (): boolean => useRawReady.getState().ready;
