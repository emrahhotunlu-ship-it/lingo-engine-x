// Build-Plugin: JSON-Inhalte, die als `?raw` geladen werden, kommen minimiert und deflate-komprimiert (base64) in den Build und werden
// beim ersten Gebrauch entpackt (fflate, synchron). Nur im Produktions-Build; Tests und Dev-Server lesen die Dateien unverändert.
//
// Großpaket C „schneller Start“ (04.11.2026, Plan Stufe 1 P9): Im Mehr-Datei-Build (`multi`) steht der Text NICHT mehr im Skript.
// Jede `?raw`-JSON-Datei steht in einer Sammeldatei `raw-<ordner>-<hash>.txt` (Base64 des rohen deflate von `{ key: text }`), das Modul
// liefert nur einen Platzhalter (`remoteText(key)` aus src/content/store/rawText.ts). Beim Start lädt `loadRawTexts()` alle Dateien
// parallel über den einen Ladeweg (`loadPacked.ts`, Marker lx:content-fetch); die App zeigt bis dahin das Startbild, und der Tagesplan
// wird erst gerechnet, wenn alle Inhalte da sind (W6). Welche Dateien es gibt, steht vorab fest: `buildStart` sucht alle `?raw`-JSON-
// Importe (direkt und `import.meta.glob`) im Quelltext; die Liste liefert das virtuelle Modul `virtual:lx-raw-list`.
import { createHash } from 'node:crypto';
import { globSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { deflateRawSync } from 'node:zlib';

const MIN_BYTES = 12_000;
/** Rohtext je Sammeldatei (vor dem Packen), damit keine Datei sehr groß wird. */
const GROUP_BYTES = 600_000;
const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const SRC = join(ROOT, 'src');
const RAWTEXT = join(SRC, 'content/store/rawText.ts');
const LIST = 'virtual:lx-raw-list';
const LIST_RESOLVED = '\0' + LIST;

const minify = (file) => JSON.stringify(JSON.parse(readFileSync(file, 'utf8')));
const keyOf = (file) => relative(SRC, file).replace(/\\/g, '/');

/** Alle `?raw`-JSON-Dateien, die der Quelltext lädt (direkte Importe und `import.meta.glob(..., { query: '?raw' })`). */
function rawFiles() {
  const out = new Set();
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name === 'dev' || name === 'node_modules') continue;
        walk(p);
      } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) {
        const text = readFileSync(p, 'utf8');
        for (const m of text.matchAll(/from\s+['"]([^'"]+\.json)\?raw['"]/g)) out.add(resolve(dirname(p), m[1]));
        for (const m of text.matchAll(/import\.meta\.glob\(\s*['"]([^'"]+\.json)['"]\s*,\s*\{[^}]*query:\s*['"]\?raw['"]/g)) {
          for (const f of globSync(m[1], { cwd: dirname(p) })) out.add(resolve(dirname(p), f));
        }
      }
    }
  };
  walk(SRC);
  return [...out].sort();
}

export function rawJsonZip(opts = {}) {
  const multi = opts.multi === true;
  let isBuild = false;
  /** key → Sammeldatei (nur Mehr-Datei-Build) */
  let remote = new Map();
  /** Sammeldatei → Base64 des rohen deflate von `{ key: text }` */
  let groups = new Map();
  return {
    name: 'lx-raw-json-zip',
    enforce: 'pre',
    configResolved(c) {
      isBuild = c.command === 'build';
    },
    buildStart() {
      remote = new Map();
      groups = new Map();
      if (!isBuild || !multi) return;
      // Alle `?raw`-JSON-Dateien (auch kleine) kommen in wenige Sammeldateien je Inhaltsordner, höchstens ~GROUP_BYTES Rohtext je Datei
      // (eine einzelne größere Datei bleibt für sich). So bleibt die Dateizahl klein (Budget < 100) und die Startdatei frei von Inhalten.
      const byDir = new Map();
      for (const file of rawFiles()) {
        const key = keyOf(file);
        const dir = key.split('/').slice(0, 2).join('/');
        if (!byDir.has(dir)) byDir.set(dir, []);
        byDir.get(dir).push({ key, min: minify(file) });
      }
      for (const [dir, items] of byDir) {
        let part = [];
        let size = 0;
        let n = 0;
        const flush = () => {
          if (!part.length) return;
          const json = JSON.stringify(Object.fromEntries(part.map((x) => [x.key, x.min])));
          const hash = createHash('sha1').update(json).digest('hex').slice(0, 8);
          const name = dir.replace(/^content\//, '').replace(/[^a-z0-9]+/gi, '-');
          const fileName = `raw-${name}${n ? `-${n}` : ''}-${hash}.txt`;
          groups.set(fileName, deflateRawSync(Buffer.from(json, 'utf8'), { level: 9 }).toString('base64'));
          for (const x of part) remote.set(x.key, fileName);
          part = [];
          size = 0;
          n++;
        };
        for (const it of items) {
          if (size && size + it.min.length > GROUP_BYTES) flush();
          part.push(it);
          size += it.min.length;
        }
        flush();
      }
    },
    generateBundle() {
      for (const [fileName, b64] of groups) this.emitFile({ type: 'asset', fileName, source: b64 });
    },
    load(id) {
      if (id === RESOLVED) return LAZY_SOURCE;
      if (id === LIST_RESOLVED) return `export default ${JSON.stringify(Object.fromEntries(remote))};`;
      if (!isBuild) return null;
      const [file, query] = id.split('?');
      if (query !== 'raw' || !file.endsWith('.json')) return null;
      const key = keyOf(file);
      // Oberste-Ebene-await: jedes Modul, das den Text braucht, wird erst ausgewertet, wenn die Sammeldatei da ist (viele Module lesen ihn
      // schon beim Laden, z. B. `JSON.parse(raw)` ganz oben). Die Dateien laden parallel, sobald der erste Inhalt gebraucht wird.
      if (remote.has(key)) return `import { rawTextReady } from ${JSON.stringify(RAWTEXT)};\nexport default await rawTextReady(${JSON.stringify(key)});`;
      const min = minify(file);
      if (min.length < MIN_BYTES) return `export default ${JSON.stringify(min)};`;
      const b64 = deflateRawSync(Buffer.from(min, 'utf8'), { level: 9 }).toString('base64');
      // Entpackt wird erst beim ersten Gebrauch (Startzeit, perf.spec 4×): `JSON.parse(text)` und `text.indexOf/slice` lösen es aus.
      return `import { lazyText } from '${VIRTUAL}';\nexport default lazyText(${JSON.stringify(b64)});`;
    },
    resolveId(id) {
      if (id === VIRTUAL) return RESOLVED;
      if (id === LIST) return LIST_RESOLVED;
      return null;
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
