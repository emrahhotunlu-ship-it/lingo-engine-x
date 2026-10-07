// Vite-Plugin „Inhaltsspeicher“ (P10): virtuelle Module `virtual:content/<name>` (Base64 des deflate-raw-Bündels),
// `virtual:content/manifest` (Zahl, Rohbytes, gepackte Bytes je Bündel) und `virtual:content/loaders` (je Bündel ein `import()`).
import { readFileSync } from 'node:fs';
import { packBundle } from './pack.mjs';

const ROOTS = new URL('./roots.json', import.meta.url);
const PREFIX = 'virtual:content/';

export function contentStore() {
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
        return `export const loaders = {\n${lines.join('\n')}\n};`;
      }
      return `export default ${JSON.stringify(pack(name).b64)};`;
    },
  };
}
