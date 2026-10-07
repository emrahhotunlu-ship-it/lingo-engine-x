// Build-Plugin: JSON-Inhalte, die als `?raw` geladen werden, kommen minimiert und deflate-komprimiert
// (base64) in die eine HTML-Datei und werden beim Laden einmal entpackt (fflate, synchron).
// Nur im Produktions-Build; Tests und Dev-Server lesen die Dateien unverändert.
import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const MIN_BYTES = 12_000;

export function rawJsonZip() {
  return {
    name: 'lx-raw-json-zip',
    apply: 'build',
    enforce: 'pre',
    load(id) {
      const [file, query] = id.split('?');
      if (query !== 'raw' || !file.endsWith('.json')) return null;
      const text = readFileSync(file, 'utf8');
      const min = JSON.stringify(JSON.parse(text));
      if (min.length < MIN_BYTES) return `export default ${JSON.stringify(min)};`;
      const b64 = deflateSync(Buffer.from(min, 'utf8'), { level: 9 }).toString('base64');
      return `import { inflateSync, strFromU8 } from 'fflate';\nconst b = atob(${JSON.stringify(b64)});\nconst u = new Uint8Array(b.length);\nfor (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);\nexport default strFromU8(inflateSync(u));`;
    },
  };
}
