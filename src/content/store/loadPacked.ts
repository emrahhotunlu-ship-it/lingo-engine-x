// Gepackte Inhalte laden (Lernplattform 3.0 K-3): Base64 → Uint8Array → Blob.stream() → DecompressionStream('deflate-raw')
// → Response.text() → JSON.parse. Nie `fetch('data:…')` (fetch ist verboten). Ergebnis je Bündel einmal im Speicher.
import { logError, logWarn } from '../../platform/diagnostics';
import { loaders, remote } from 'virtual:content/loaders';

export type Bundle<T> = { v: 1; items: T[] };

const cache = new Map<string, Promise<Bundle<unknown> | null>>();
let warned = false;
/** Bleibt als Zeichenkette im Build erhalten (Kommentare tun das nicht): check-platform erlaubt `fetch(` nur in der Datei mit diesem Marker. */
const FETCH_MARKER = 'lx:content-fetch';

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

/** Entpackt rohe deflate-Bytes (Mehr-Datei-Build: Antwort-Strom direkt, ohne Base64). */
/* eslint-disable no-restricted-globals -- einziger erlaubter fetch: relative Inhaltsdatei im Mehr-Datei-Build (docs/umbau/mehr-datei.md), geprüft von check-platform */
async function inflateResponse(res: Response): Promise<string> {
  if (!res.ok || !res.body) throw new Error(`Inhaltsdatei nicht ladbar (HTTP ${res.status}).`);
  return new Response(res.body.pipeThrough(new DecompressionStream('deflate-raw'))).text();
}

/**
 * Mehr-Datei-Build: holt die Bündeldatei neben dem Skript (flacher relativer Pfad, kein fremder Host).
 * Marker `FETCH_MARKER`: scripts/check-platform.mjs erlaubt `fetch(` im Mehr-Datei-Modus nur in der Datei, die ihn enthält.
 * Ein zweiter Versuch nach kurzer Pause fängt kurze Netzaussetzer ab (genau einer, kein Schleifenversuch; danach Fehlerzustand,
 * der nächste Aufruf von `loadPacked` versucht es frisch, weil der Eintrag im Speicher verworfen wird).
 */
async function fetchBundleText(file: string): Promise<string> {
  const url = new URL(file, import.meta.url).href;
  try {
    return await inflateResponse(await fetch(url));
  } catch (first) {
    logWarn('content:packed', first, `${file} (zweiter Versuch, ${FETCH_MARKER})`);
    await new Promise((r) => setTimeout(r, 400));
    return inflateResponse(await fetch(url));
  }
}

/* eslint-enable no-restricted-globals */

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
    const file = remote?.[name];
    const load = loaders[name];
    if (!file && !load) {
      logError('content:packed', { message: `Unbekanntes Bündel "${name}".` });
      return null;
    }
    try {
      const text = file ? await fetchBundleText(file) : await inflateBase64((await load!()).default);
      const doc = JSON.parse(text) as Bundle<T>;
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
