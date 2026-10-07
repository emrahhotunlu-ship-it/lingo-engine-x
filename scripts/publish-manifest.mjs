// Veröffentlichungs-Hilfe für den Mehr-Datei-Build (docs/umbau/mehr-datei.md).
// Liest dist/ (nach `npm run build:multi`) und gibt JSON für den Artifact-Aufruf aus:
//   page   = Quelldatei der Seite (`file_path`)
//   files  = { "<veröffentlichter flacher Pfad>": "<absoluter Quellpfad>" } (die `files`-Map; index.html steht NICHT darin)
//   stale  = Hinweis auf Dateien der vorigen Version, die nach dem Veröffentlichen als „alt“ stehen bleiben (nur mit --previous <manifest.json>)
// Aufruf: node scripts/publish-manifest.mjs [--out datei.json] [--previous alt.json]
// Prüft vorher die Grenzen (flach, erlaubte Typen, < 16 MB je Datei, Summe ≤ 64 MB, höchstens 255 Dateien je Veröffentlichung).
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkMulti } from './check-platform.mjs';

const MAX_FILES = 255;
const TEXT = new Set(['.js', '.css', '.json', '.svg']);

/** Baut das Manifest aus einer Dateiliste `{ name, size }` (rein, testbar). */
export function buildManifest(entries, dir, previous) {
  const files = {};
  let total = 0;
  for (const e of entries) {
    total += e.size;
    if (e.name !== 'index.html') files[e.name] = resolve(dir, e.name);
  }
  const out = { page: resolve(dir, 'index.html'), files, count: entries.length, totalBytes: total, note: 'Nicht mehr referenzierte Dateien früherer Versionen bleiben im Artefakt stehen (mit `null` in `files` entfernbar).' };
  if (previous && typeof previous === 'object') {
    out.stale = Object.keys(previous.files ?? {}).filter((n) => !(n in files));
    out.removeMap = Object.fromEntries(out.stale.map((n) => [n, null]));
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const arg = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
  const dir = fileURLToPath(new URL('../dist/', import.meta.url));
  const entries = readdirSync(dir, { withFileTypes: true }).map((e) => {
    if (e.isDirectory()) return { name: `${e.name}/`, size: 0 };
    const p = resolve(dir, e.name);
    return { name: e.name, size: statSync(p).size, text: TEXT.has(extname(e.name).toLowerCase()) || e.name === 'index.html' ? readFileSync(p, 'utf8') : undefined };
  });
  const check = checkMulti(entries);
  if (entries.length > MAX_FILES) check.problems.push(`${entries.length} Dateien: mehr als ${MAX_FILES} je Veröffentlichung`);
  if (check.problems.length) {
    console.error('Manifest abgebrochen, Plattform-Prüfung nicht bestanden:');
    check.problems.forEach((p) => console.error(`  - ${p}`));
    process.exit(1);
  }
  const prevPath = arg('--previous');
  const manifest = buildManifest(entries, dir, prevPath ? JSON.parse(readFileSync(prevPath, 'utf8')) : undefined);
  const json = JSON.stringify(manifest, null, 2);
  const outPath = arg('--out');
  if (outPath) writeFileSync(outPath, json + '\n');
  else console.log(json);
  check.notes.forEach((n) => console.error(n));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
