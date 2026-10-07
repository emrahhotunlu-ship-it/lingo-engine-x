// Vite-Plugin „Inhaltsspeicher“ (P10): virtuelle Module `virtual:content/<name>` (Base64 des deflate-raw-Bündels),
// `virtual:content/manifest` (Zahl, Rohbytes, gepackte Bytes je Bündel) und `virtual:content/loaders` (je Bündel ein `import()`).
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { packBundle } from './pack.mjs';

const ROOTS = new URL('./roots.json', import.meta.url);
const PREFIX = 'virtual:content/';

/**
 * @param {{ multi?: boolean }} [opts] multi = Mehr-Datei-Build (LX_BUILD=multi): jedes Bündel wird als eigene flache Datei
 *   `content-<name>-<hash>.bin` (rohes deflate) ausgeliefert und zur Laufzeit per fetch nachgeladen, statt als Base64 im Skript zu stehen.
 */
export function contentStore(opts = {}) {
  const multi = opts.multi === true;
  const fileOf = (name) => {
    const b = pack(name);
    const hash = createHash('sha1').update(b.json).digest('hex').slice(0, 8);
    return `content-${name}-${hash}.bin`;
  };
  /** @type {Map<string, ReturnType<typeof packBundle>>} */
  let cache = new Map();
  const bundles = () => JSON.parse(readFileSync(ROOTS, 'utf8')).bundles;
  const pack = (name) => {
    if (!cache.has(name)) {
      const spec = bundles()[name];
      if (!spec) throw new Error(`Unbekanntes Inhalts-Bündel "${name}" (scripts/content/roots.json)`);
      cache.set(name, packBundle(spec));
    }
    return cache.get(name);
  };
  return {
    name: 'lx-content-store',
    enforce: 'pre',
    buildStart() {
      cache = new Map();
      // Jeder Build prüft alle Bündel (doppelte id, Marker) – auch solche, die niemand importiert.
      for (const name of Object.keys(bundles())) pack(name);
    },
    generateBundle() {
      if (!multi) return;
      for (const name of Object.keys(bundles())) {
        this.emitFile({ type: 'asset', fileName: fileOf(name), source: deflateRawSync(Buffer.from(pack(name).json, 'utf8'), { level: 9 }) });
      }
    },
    resolveId(id) {
      return id.startsWith(PREFIX) ? `\0${id}` : null;
    },
    load(id) {
      if (!id.startsWith(`\0${PREFIX}`)) return null;
      const name = id.slice(PREFIX.length + 1);
      if (name === 'manifest') {
        const m = {};
        for (const n of Object.keys(bundles())) {
          const p = pack(n);
          m[n] = { count: p.count, rawBytes: p.rawBytes, packedBytes: p.packedBytes };
        }
        return `export default ${JSON.stringify(m)};`;
      }
      if (name === 'loaders') {
        const lines = Object.keys(bundles()).map((n) => `  ${JSON.stringify(n)}: () => import(${JSON.stringify(PREFIX + n)}),`);
        if (multi) {
          // Mehr-Datei: kein Base64 im Skript. `remote` = Dateiname je Bündel, `loadPacked` holt die Datei per fetch (relativ).
          const files = Object.fromEntries(Object.keys(bundles()).map((n) => [n, fileOf(n)]));
          return `export const loaders = {};\nexport const remote = ${JSON.stringify(files)};`;
        }
        return `export const remote = null;\nexport const loaders = {\n${lines.join('\n')}\n};`;
      }
      return `export default ${JSON.stringify(pack(name).b64)};`;
    },
  };
}
