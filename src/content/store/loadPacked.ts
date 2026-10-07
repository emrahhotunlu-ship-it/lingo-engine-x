// Gepackte Inhalte laden (Lernplattform 3.0 K-3): Base64 → Uint8Array → Blob.stream() → DecompressionStream('deflate-raw')
// → Response.text() → JSON.parse. Nie `fetch('data:…')` (fetch ist verboten). Ergebnis je Bündel einmal im Speicher.
import { logError, logWarn } from '../../platform/diagnostics';
import { loaders } from 'virtual:content/loaders';

export type Bundle<T> = { v: 1; items: T[] };

const cache = new Map<string, Promise<Bundle<unknown> | null>>();
let warned = false;

/** `DecompressionStream` fehlt vor Safari 16.4: dann bieten die Arten, die gepackte Inhalte brauchen, sich nicht an. */
export function packedSupported(): boolean {
  return typeof DecompressionStream !== 'undefined' && typeof Blob !== 'undefined' && typeof Response !== 'undefined';
}

/** Entpackt Base64 (deflate-raw) zu Text. Getrennt von `loadPacked`, damit Tests und Messungen es einzeln nutzen. */
export async function inflateBase64(b64: string): Promise<string> {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

/** Lädt ein Bündel; bei Fehler oder fehlender Unterstützung `null` (und ein Protokolleintrag, keine Ausnahme). */
export function loadPacked<T>(name: string): Promise<Bundle<T> | null> {
  const hit = cache.get(name);
  if (hit) return hit as Promise<Bundle<T> | null>;
  const p = (async (): Promise<Bundle<T> | null> => {
    if (!packedSupported()) {
      if (!warned) {
        warned = true;
        logWarn('content:packed', { message: 'DecompressionStream fehlt: gepackte Inhalte werden nicht angeboten.' }, name);
      }
      return null;
    }
    const load = loaders[name];
    if (!load) {
      logError('content:packed', { message: `Unbekanntes Bündel "${name}".` });
      return null;
    }
    try {
      const mod = await load();
      const doc = JSON.parse(await inflateBase64(mod.default)) as Bundle<T>;
      if (doc?.v !== 1 || !Array.isArray(doc.items)) throw new Error('Bündel hat nicht die Form { v: 1, items }.');
      return doc;
    } catch (e) {
      logError('content:packed', e, name);
      cache.delete(name);
      return null;
    }
  })();
  cache.set(name, p);
  return p;
}

/** Nur für Tests. */
export function resetPackedCache(): void {
  cache.clear();
  warned = false;
}
