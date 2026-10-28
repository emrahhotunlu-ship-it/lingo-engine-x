// Budget-Tor (Stufe 1, P0 S1-TOR Nr. 3–5; Plan docs/relaunch/stufe1-plan.md §5.4): misst den Mehr-Datei-Build und vergleicht mit scripts/budget.json.
//
// Gemessen wird die gepackte Größe (gzip, zlib-Standardstufe 6) jedes Stücks laut Vite-Manifest (dist/.vite/manifest.json):
//   entry  = Skript des Manifest-Eintrags `index.html` samt seiner statischen Importe (der „Einstieg“, der vor dem Start geladen wird)
//   css    = alle Stylesheets
//   html   = dist/index.html selbst
//   lazy   = jedes nachgeladene Skript-Stück einzeln (Schlüssel = Quellpfad im Manifest, unabhängig vom Hash im Dateinamen)
//   bin    = jedes Inhalts-Bündel `content-<name>-<hash>.bin` einzeln (Schlüssel `content-<name>`)
//   files  = Zahl der Dateien in dist/ (ohne dist/.vite/), total = Summe der Rohgrößen (nur Hinweis, Grenze aus scripts/limits.mjs)
//
// Sperrklinke (Plan P0 Nr. 4): Grenze = `basis` + Summe der eingetragenen `zuwachs`-Beträge (je Paketname). Ein Zuwachs darf
// höchstens so groß sein wie der vorab genannte Betrag unter `vorab`; mehr ist ein G0-Befund und braucht die Zustimmung der
// Hauptsitzung (Eintrag als `{ "bytes": n, "freigabe": "wer, wann, warum" }`). Kein pauschaler Prozent-Spielraum.
//
// Aufruf: node scripts/check-budget.mjs [--dist <ordner>] [--budget <budget.json>] [--json]
// Exit 0 = im Budget, 1 = über dem Budget oder Budget-Datei fehlerhaft, 2 = kein Mehr-Datei-Build (Manifest fehlt).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { MAX_FILES_PER_PUBLISH, WARN_TOTAL_BYTES, mb } from './limits.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const MANIFEST = join('.vite', 'manifest.json');
const BIN_KEY = /^(content-.+)-[0-9a-f]{6,}\.bin$/;

/** Gepackte Größe in Byte (gzip, Standardstufe). */
export const gz = (buf) => gzipSync(buf).length;

/**
 * Misst einen Mehr-Datei-Build. `dir` = Bau-Ordner mit `.vite/manifest.json`.
 * @returns {{ entry: number, entryFiles: string[], css: number, html: number, lazy: Record<string, { file: string, gz: number }>, bin: Record<string, { file: string, gz: number }>, files: number, total: number }}
 */
export function measure(dir) {
  const manifestPath = join(dir, MANIFEST);
  if (!existsSync(manifestPath)) throw Object.assign(new Error(`Kein Vite-Manifest unter ${manifestPath}: erst \`npm run build\` (Mehr-Datei) ausführen`), { code: 'no_manifest' });
  /** @type {Record<string, { file: string, isEntry?: boolean, isDynamicEntry?: boolean, imports?: string[] }>} */
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const names = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
  const size = (f) => statSync(join(dir, f)).size;
  const gzOf = (f) => gz(readFileSync(join(dir, f)));

  // Einstieg: Eintrag `index.html` und alle statischen Importe (rekursiv).
  const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry && k === 'index.html') ?? Object.keys(manifest).find((k) => manifest[k].isEntry);
  if (!entryKey) throw Object.assign(new Error('Vite-Manifest ohne Einstieg (isEntry)'), { code: 'no_entry' });
  const entryFiles = new Set();
  const walk = (k) => {
    const m = manifest[k];
    if (!m || entryFiles.has(m.file)) return;
    entryFiles.add(m.file);
    (m.imports ?? []).forEach(walk);
  };
  walk(entryKey);

  const keyOfFile = new Map(Object.entries(manifest).map(([k, m]) => [m.file, k]));
  const lazy = {};
  const bin = {};
  let css = 0;
  for (const f of names) {
    const ext = extname(f).toLowerCase();
    if (ext === '.js' && !entryFiles.has(f)) lazy[keyOfFile.get(f) ?? f.replace(/-[^-]+\.js$/, '')] = { file: f, gz: gzOf(f) };
    else if (ext === '.css') css += gzOf(f);
    else if (ext === '.bin') bin[BIN_KEY.exec(f)?.[1] ?? f] = { file: f, gz: gzOf(f) };
  }
  return {
    entry: [...entryFiles].reduce((a, f) => a + gzOf(f), 0),
    entryFiles: [...entryFiles],
    css,
    html: names.includes('index.html') ? gzOf('index.html') : 0,
    lazy,
    bin,
    files: names.length,
    total: names.reduce((a, f) => a + size(f), 0),
  };
}

const zuwachsBytes = (z) => (typeof z === 'number' ? z : z && typeof z === 'object' && typeof z.bytes === 'number' ? z.bytes : NaN);

/** Grenze einer Größe: `basis` + eingetragene Zuwächse; prüft jeden Zuwachs gegen `vorab`. */
/** Form einer Freigabe: Wer, Datum (TT.MM.JJJJ oder JJJJ-MM-TT), Doppelpunkt, Grund. */
export const FREIGABE = /^\S.*\b(\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})\s*:\s*\S.{4,}$/;

function limitOf(name, spec, vorab, problems) {
  if (!spec || typeof spec.basis !== 'number') {
    problems.push(`budget.json: \`${name}\` ohne Zahl \`basis\``);
    return Infinity;
  }
  let sum = spec.basis;
  for (const [paket, z] of Object.entries(spec.zuwachs ?? {})) {
    const bytes = zuwachsBytes(z);
    if (!Number.isFinite(bytes) || bytes < 0) {
      problems.push(`budget.json: Zuwachs ${paket} bei \`${name}\` ist keine Zahl ≥ 0`);
      continue;
    }
    const allowed = vorab?.[paket]?.[name] ?? 0;
    // Freigabe nur mit Verantwortlichem, Datum und Grund (platform-guard S4): „Hauptsitzung 28.10.2026: Grund“.
    const freigabe = typeof z === 'object' && typeof z.freigabe === 'string' && FREIGABE.test(z.freigabe.trim());
    if (bytes > allowed && !freigabe) problems.push(`budget.json: ${paket} erhöht \`${name}\` um ${bytes} B, vorab genannt sind ${allowed} B – mehr braucht die Zustimmung der Hauptsitzung (\`freigabe\`)`);
    sum += bytes;
  }
  return sum;
}

/**
 * Vergleicht eine Messung mit dem Budget. Rein und testbar.
 * @returns {{ problems: string[], notes: string[], rows: Array<{ name: string, gz: number, limit: number, ok: boolean }> }}
 */
export function evaluate(m, budget) {
  const problems = [];
  const notes = [];
  const rows = [];
  const g = budget?.grenzen;
  if (!g || typeof g !== 'object') return { problems: ['budget.json: Abschnitt `grenzen` fehlt'], notes, rows };
  const vorab = budget.vorab ?? {};
  const row = (name, value, limit) => {
    const ok = value <= limit;
    rows.push({ name, gz: value, limit, ok });
    if (!ok) problems.push(`${name}: ${value} B gzip über der Grenze ${limit} B (+${value - limit} B)`);
  };
  row('entry', m.entry, limitOf('entry', g.entry, vorab, problems));
  row('css', m.css, limitOf('css', g.css, vorab, problems));
  row('html', m.html, limitOf('html', g.html, vorab, problems));
  for (const [key, piece] of Object.entries(m.lazy)) {
    const spec = g.lazy?.[key];
    if (spec) row(`lazy ${key}`, piece.gz, limitOf(`lazy ${key}`, spec, vorab, problems));
    else {
      row(`lazy ${key} (neu)`, piece.gz, g.lazyNeu ?? 0);
      notes.push(`Neues nachgeladenes Stück ${key} (${piece.file}): gilt die Grenze für neue Stücke (lazyNeu); bitte mit Paketname in budget.json unter grenzen.lazy eintragen`);
    }
  }
  for (const [key, piece] of Object.entries(m.bin)) row(`bin ${key}`, piece.gz, g.bin ?? 0);
  const maxFiles = Math.min(g.files ?? MAX_FILES_PER_PUBLISH, MAX_FILES_PER_PUBLISH);
  rows.push({ name: 'files', gz: m.files, limit: maxFiles, ok: m.files <= maxFiles });
  if (m.files > maxFiles) problems.push(`files: ${m.files} Dateien, Grenze ${maxFiles}`);
  if (m.total > WARN_TOTAL_BYTES) notes.push(`Achtung: Gesamtgröße ${mb(m.total)} über der Warnschwelle von ${mb(WARN_TOTAL_BYTES)}`);
  // Vorab genannte Zuwächse nur für bekannte Größen (Tippfehler im Paketplan fallen sofort auf).
  for (const [paket, sizes] of Object.entries(vorab)) {
    for (const name of Object.keys(sizes ?? {})) if (!['entry', 'css', 'html'].includes(name) && !(g.lazy && name in g.lazy)) problems.push(`budget.json: vorab ${paket} nennt unbekannte Größe \`${name}\``);
  }
  return { problems, notes, rows };
}

export function loadBudget(path = join(ROOT, 'scripts', 'budget.json')) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function main() {
  const args = process.argv.slice(2);
  const arg = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
  const dir = arg('--dist') ? resolve(arg('--dist')) : join(ROOT, 'dist');
  const budgetPath = arg('--budget') ? resolve(arg('--budget')) : join(ROOT, 'scripts', 'budget.json');
  let m;
  try {
    m = measure(dir);
  } catch (err) {
    console.error(`BUDGET-TOR: nicht messbar – ${err instanceof Error ? err.message : err}`);
    process.exit(err && typeof err === 'object' && 'code' in err && err.code === 'no_manifest' ? 2 : 1);
  }
  let budget;
  try {
    budget = loadBudget(budgetPath);
  } catch (err) {
    console.error(`BUDGET-TOR: ${budgetPath} nicht lesbar – ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
  const res = evaluate(m, budget);
  if (args.includes('--json')) console.log(JSON.stringify({ messung: m, ...res }, null, 2));
  else {
    console.log(`Budget-Tor (gzip): ${m.files} Dateien, ${mb(m.total)} roh gesamt, Einstieg ${m.entryFiles.join(' + ')}`);
    for (const r of res.rows) console.log(`  ${r.ok ? '✓' : '✘'} ${r.name.padEnd(46)} ${String(r.gz).padStart(9)} / ${String(r.limit).padStart(9)}`);
  }
  res.notes.forEach((n) => console.log(n));
  if (res.problems.length) {
    console.error(`BUDGET-TOR: ÜBERSCHRITTEN (${res.problems.length})`);
    res.problems.forEach((p) => console.error(`  - ${p}`));
    process.exit(1);
  }
  console.log('BUDGET-TOR: im Budget');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
