// Veröffentlichungs-Hilfe für den Mehr-Datei-Build (docs/umbau/mehr-datei.md, Veröffentlichungsweg: docs/relaunch/publish/README.md).
// Liest dist/ (nach `npm run build`) und gibt JSON für den Artifact-Aufruf aus:
//   page     = Quelldatei der Seite (`file_path`)
//   files    = { "<veröffentlichter flacher Pfad>": "<absoluter Quellpfad>" } (die `files`-Map; index.html steht NICHT darin)
//   stale    = Dateien der vorigen Veröffentlichung, die die neue nicht mehr hat (nur mit --previous <manifest.json>)
//   removeMap = { "<alter Pfad>": null } – geht zusammen mit `files` in DENSELBEN Artifact-Aufruf, damit alte Stücke gelöscht werden
// Aufruf: node scripts/publish-manifest.mjs [--out datei.json] [--previous docs/relaunch/publish/<link>.json] [--dist <ordner>]
//   --dist: anderer Bau-Ordner als dist/ (z. B. der v86-Stand aus scripts/v86-checkout.mjs für den Rückweg auf die Einzeldatei)
// Prüft vorher die Grenzen aus scripts/limits.mjs (über checkMulti: flach, erlaubte Typen, Größe je Datei, Summe, Dateizahl je Veröffentlichung).
// dist/.vite/ (Vite-Manifest) ist Bau-Metadatum und wird nie veröffentlicht.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkHtml, checkMulti, distEntries } from './check-platform.mjs';

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
  const distArg = arg('--dist');
  const dir = distArg ? resolve(distArg) : fileURLToPath(new URL('../dist/', import.meta.url));
  const entries = distEntries(dir).map((e) => {
    if (e.isDirectory()) return { name: `${e.name}/`, size: 0 };
    const p = resolve(dir, e.name);
    return { name: e.name, size: statSync(p).size, text: TEXT.has(extname(e.name).toLowerCase()) || e.name === 'index.html' ? readFileSync(p, 'utf8') : undefined };
  });
  // Einzeldatei (nur index.html, z. B. Rückweg auf v86): Prüfung wie check:platform im Einzeldatei-Modus.
  const single = entries.length === 1 && entries[0].name === 'index.html';
  const check = single ? checkHtml(entries[0].text ?? '', entries[0].size) : checkMulti(entries);
  if (check.problems.length) {
    console.error('Manifest abgebrochen, Plattform-Prüfung nicht bestanden:');
    check.problems.forEach((p) => console.error(`  - ${p}`));
    process.exit(1);
  }
  const prevPath = arg('--previous');
  const manifest = buildManifest(entries, dir, prevPath ? JSON.parse(readFileSync(prevPath, 'utf8')) : undefined);
  // Stand, aus dem gebaut wurde (für den Rückweg und die Notiz in docs/umbau/stand.md). Beim v86-Rückweg (`--dist .cache/v86/dist`)
  // steht er in der Datei COMMIT daneben (scripts/v86-checkout.mjs), sonst ist es HEAD.
  const stamp = resolve(dir, '..', 'COMMIT');
  try {
    manifest.commit = distArg && existsSync(stamp)
      ? readFileSync(stamp, 'utf8').split('\n')[0].slice(0, 7)
      : execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8', cwd: fileURLToPath(new URL('..', import.meta.url)) }).trim();
  } catch (err) {
    console.error('Hinweis: Commit nicht lesbar –', err instanceof Error ? err.message : err);
  }
  const json = JSON.stringify(manifest, null, 2);
  const outPath = arg('--out');
  if (outPath) writeFileSync(outPath, json + '\n');
  else console.log(json);
  check.notes.forEach((n) => console.error(n));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
