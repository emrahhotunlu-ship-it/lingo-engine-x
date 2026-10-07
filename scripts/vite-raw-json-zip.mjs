// Build-Plugin: JSON-Inhalte, die als `?raw` geladen werden, kommen minimiert und deflate-komprimiert
// (base64) in die eine HTML-Datei und werden beim Laden einmal entpackt (fflate, synchron).
// Nur im Produktions-Build; Tests und Dev-Server lesen die Dateien unverändert.
import { readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';

const MIN_BYTES = 12_000;

export function rawJsonZip() {
  return {
    name: 'lx-raw-json-zip',
    apply: 'build',
    enforce: 'pre',
    load(id) {
      if (id === RESOLVED) return LAZY_SOURCE;
      const [file, query] = id.split('?');
      if (query !== 'raw' || !file.endsWith('.json')) return null;
      const text = readFileSync(file, 'utf8');
      const min = JSON.stringify(JSON.parse(text));
      if (min.length < MIN_BYTES) return `export default ${JSON.stringify(min)};`;
      const b64 = deflateRawSync(Buffer.from(min, 'utf8'), { level: 9 }).toString('base64');
      // Entpackt wird erst beim ersten Gebrauch (Startzeit, perf.spec 4×): `JSON.parse(text)` und `text.indexOf/slice` lösen es aus.
      return `import { lazyText } from '${VIRTUAL}';\nexport default lazyText(${JSON.stringify(b64)});`;
    },
    resolveId(id) {
      return id === VIRTUAL ? RESOLVED : null;
    },
  };
}

const VIRTUAL = 'virtual:lx-lazy-text';
const RESOLVED = '\0' + VIRTUAL;

/** Ein Text, der wie ein String benutzt wird (JSON.parse, String(), indexOf, slice, length), aber erst beim ersten Zugriff entpackt. */
const LAZY_SOURCE = `import { inflateSync, strFromU8 } from 'fflate';
class LazyText {
  constructor(b64) { this.b64 = b64; this.s = null; }
  get value() {
    if (this.s === null) {
      const b = atob(this.b64);
      const u = new Uint8Array(b.length);
      for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
      this.s = strFromU8(inflateSync(u));
      this.b64 = '';
    }
    return this.s;
  }
  get length() { return this.value.length; }
  toString() { return this.value; }
  valueOf() { return this.value; }
  [Symbol.toPrimitive]() { return this.value; }
  indexOf(a, b) { return this.value.indexOf(a, b); }
  slice(a, b) { return this.value.slice(a, b); }
  includes(a, b) { return this.value.includes(a, b); }
  trim() { return this.value.trim(); }
}
export const lazyText = (b64) => new LazyText(b64);
`;
