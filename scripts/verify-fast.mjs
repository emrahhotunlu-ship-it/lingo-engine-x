#!/usr/bin/env node
// Schneller Lauf nach jeder Änderung: `npm run verify:fast` (docs/umbau/arbeitsweise.md §10). Ziel: unter 5 Minuten.
// Der Gesamtlauf `npm run verify` bleibt unverändert und läuft einmal vor jedem Test-Link.
//
// Ablauf (jede Stufe meldet ok / FEHLER / nicht gelaufen mit Grund):
//  1. Typprüfung (beide tsconfig, inkrementell) und Lint (nur geänderte Dateien, mit Cache) – gleichzeitig.
//  2. Unit-Tests: `vitest related` über die geänderten Dateien (Importgraph) plus geänderte Testdateien.
//  3. Build (App + Test-Laufzeit), dann nur die E2E-Specs der geänderten Bereiche (Tabelle scripts/verify-fast-map.mjs).
//  4. check:platform auf dem frischen Build.
// Geändert = `git diff <Basis>` (Commits seit der Basis UND nicht festgehaltene Änderungen) plus neue, nicht ignorierte Dateien.
// Basis: `--base <ref>` oder VF_BASE, sonst der gemeinsame Stand mit claude/umbau-fokus (ohne ihn: HEAD).
//
// Keine Wiederholung ohne Änderung (A2): Ein grüner Lauf merkt sich einen Fingerabdruck aus Basis, HEAD und Inhalt aller Änderungen
// (.cache/verify-fast/). Gleicher Fingerabdruck → kein neuer Lauf (außer `--force`). Bricht ein Lauf ab, laufen beim nächsten Aufruf
// nur die Stufen, die für diesen Fingerabdruck noch nicht grün sind (wiederaufnehmbar wie der Treiber scratchpad/vr/run.sh).
//
// Optionen: --base <ref> · --force · --all-e2e-smoke (nur Rauch-Auswahl) · --specs a.spec.ts,b.spec.ts (Auswahl von Hand) · --dry (nur anzeigen)

import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RULES, SMOKE, NO_TEST } from './verify-fast-map.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const CACHE = join(ROOT, '.cache', 'verify-fast');
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? '') : undefined;
};
const FORCE = args.includes('--force');
const DRY = args.includes('--dry');
const ONLY_SMOKE = args.includes('--all-e2e-smoke');
const HAND_SPECS = opt('--specs');

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim();
const tryGit = (...a) => {
  try {
    return git(...a);
  } catch {
    return '';
  }
};

// ------------------------------------------------------------------ Was hat sich geändert?
const base = opt('--base') || process.env.VF_BASE || tryGit('merge-base', 'HEAD', 'claude/umbau-fokus') || 'HEAD';
const head = git('rev-parse', 'HEAD');
// dist/ entsteht durch den Build selbst und zählt nie als Änderung (sonst änderte jeder Lauf den Fingerabdruck).
const NOT_DIST = ['--', '.', ':(exclude)dist'];
const committedAndWorking = git('diff', '--name-only', base, ...NOT_DIST).split('\n').filter(Boolean);
const untracked = git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean);
const changed = [...new Set([...committedAndWorking, ...untracked])].filter((f) => existsSync(join(ROOT, f)) || committedAndWorking.includes(f)).sort();

const fingerprint = createHash('sha1')
  .update(`${base}\n${head}\n${git('diff', base, ...NOT_DIST)}\n`)
  .update(untracked.map((f) => `${f}\n${existsSync(join(ROOT, f)) ? readFileSync(join(ROOT, f)) : ''}`).join('\n'))
  .digest('hex')
  .slice(0, 16);
const RUN_DIR = join(CACHE, fingerprint);

const isTest = (f) => /^tests\/(unit|tutor)\/.*\.test\.ts$/.test(f);
const isSpec = (f) => /^tests\/e2e\/[^/]+\.spec\.ts$/.test(f);
const isE2eHelper = (f) => /^tests\/e2e\/[^/]+\.ts$/.test(f) && !isSpec(f);
const isCode = (f) => /\.(ts|tsx|mjs|js)$/.test(f);
const exists = (f) => existsSync(join(ROOT, f));
const allSpecs = readdirSync(join(ROOT, 'tests/e2e')).filter((f) => f.endsWith('.spec.ts'));

// ------------------------------------------------------------------ Auswahl
const relevant = changed.filter((f) => !NO_TEST.some((re) => re.test(f)));
const why = [];

/** E2E-Specs zu den geänderten Dateien. */
function selectSpecs() {
  if (HAND_SPECS) return { specs: HAND_SPECS.split(',').map((s) => s.trim()).filter(Boolean), note: 'von Hand (--specs)' };
  if (ONLY_SMOKE) return { specs: [...SMOKE], note: 'nur Rauch-Auswahl (--all-e2e-smoke)' };
  const out = new Set();
  let smoke = false;
  for (const f of relevant) {
    if (isSpec(f)) {
      if (exists(f)) out.add(f.slice('tests/e2e/'.length));
      continue;
    }
    if (isE2eHelper(f)) {
      const name = f.slice('tests/e2e/'.length).replace(/\.ts$/, '');
      for (const s of allSpecs) if (new RegExp(`from '\\./${name}'`).test(readFileSync(join(ROOT, 'tests/e2e', s), 'utf8'))) out.add(s);
      if (name === 'fixtures' || name === 'dist') smoke = true;
      continue;
    }
    const hits = RULES.filter((r) => f.startsWith(r.prefix));
    for (const r of hits) {
      r.specs.forEach((s) => out.add(s));
      if (r.smoke) smoke = true;
    }
    if (!hits.length && (f.startsWith('src/') || f.startsWith('scripts/content/') || /^vite.*\.config\.ts$/.test(f))) {
      smoke = true;
      why.push(`keine Regel für ${f} → Rauch-Auswahl`);
    }
  }
  if (smoke) SMOKE.forEach((s) => out.add(s));
  const unknown = [...out].filter((s) => !allSpecs.includes(s));
  if (unknown.length) throw new Error(`verify-fast-map.mjs nennt Specs, die es nicht gibt: ${unknown.join(', ')}`);
  return { specs: [...out].sort(), note: smoke ? 'Tabelle + Rauch-Auswahl' : 'Tabelle' };
}

const needsBuild = relevant.some((f) => f.startsWith('src/') || f.startsWith('scripts/') || f === 'index.html' || /^vite.*\.config\.ts$/.test(f) || f === 'package.json' || f.startsWith('seed/'));
const { specs, note } = selectSpecs();
const unitGlobal = relevant.some((f) => f === 'package.json' || f === 'vitest.config.ts' || f.startsWith('scripts/content/') || f.startsWith('tests/fixtures/'));
const unitFiles = relevant.filter((f) => isCode(f) && (f.startsWith('src/') || f.startsWith('scripts/') || f.startsWith('seed/') || isTest(f)) && exists(f));
const lintFiles = relevant.filter((f) => /\.(ts|tsx|mjs|js)$/.test(f) && exists(f));
const lintAll = relevant.some((f) => f === 'eslint.config.js' || f === 'package.json');
const typeNeeded = relevant.some((f) => isCode(f) || /^tsconfig.*\.json$/.test(f) || f === 'package.json');

// ------------------------------------------------------------------ Ausführen
const results = [];
const t0 = Date.now();
const fmt = (ms) => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}`;

function run(cmd, cmdArgs, logName, env = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    mkdirSync(RUN_DIR, { recursive: true });
    const logPath = join(RUN_DIR, `${logName}.log`);
    const chunks = [];
    const p = spawn(cmd, cmdArgs, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    p.stdout.on('data', (d) => chunks.push(d));
    p.stderr.on('data', (d) => chunks.push(d));
    p.on('close', (code) => {
      writeFileSync(logPath, Buffer.concat(chunks));
      resolve({ code: code ?? 1, ms: Date.now() - started, logPath });
    });
  });
}

/** Eine Stufe: läuft nur, wenn sie für diesen Fingerabdruck noch nicht grün ist. */
async function step(name, cmds) {
  const mark = join(RUN_DIR, `${name}.ok`);
  if (existsSync(mark) && !FORCE) {
    results.push({ name, status: 'ok (schon grün für diesen Stand)', ms: 0 });
    return true;
  }
  process.stdout.write(`▶ ${name} …\n`);
  const outs = await Promise.all(cmds.map(([c, a, log, env]) => run(c, a, log, env)));
  const ms = Math.max(...outs.map((o) => o.ms));
  const failed = outs.filter((o) => o.code !== 0);
  if (failed.length) {
    results.push({ name, status: 'FEHLER', ms, logs: failed.map((o) => o.logPath) });
    for (const o of failed) process.stdout.write(tail(o.logPath));
    return false;
  }
  writeFileSync(mark, new Date().toISOString());
  results.push({ name, status: 'ok', ms });
  return true;
}

function tail(path, n = 40) {
  const lines = readFileSync(path, 'utf8').split('\n');
  return `--- ${path} (letzte ${n} Zeilen)\n${lines.slice(-n).join('\n')}\n`;
}

function skip(name, reason) {
  results.push({ name, status: `nicht gelaufen: ${reason}`, ms: 0 });
}

async function main() {
  console.log(`verify:fast · Basis ${base.slice(0, 9)} · HEAD ${head.slice(0, 9)} · ${changed.length} geänderte Dateien · Fingerabdruck ${fingerprint}`);
  for (const f of changed.slice(0, 40)) console.log(`  · ${f}`);
  if (changed.length > 40) console.log(`  … und ${changed.length - 40} weitere`);
  console.log(`E2E-Auswahl (${note}): ${specs.length ? specs.join(' ') : '–'}`);
  for (const w of why) console.log(`  (${w})`);

  const okMark = join(RUN_DIR, 'ALL.ok');
  if (existsSync(okMark) && !FORCE) {
    console.log('\nKeine Änderung seit dem letzten grünen Lauf (gleicher Fingerabdruck) – kein neuer Lauf. Mit --force trotzdem laufen lassen.');
    return 0;
  }
  if (!relevant.length) {
    console.log('\nNur Texte/Notizen geändert (docs, *.md) – nichts zu testen.');
    return 0;
  }
  if (DRY) return 0;

  const npx = 'npx';
  let ok = true;
  // 1. Typprüfung + Lint gleichzeitig.
  const first = [];
  if (typeNeeded) {
    first.push([npx, ['tsc', '-p', 'tsconfig.app.json', '--noEmit', '--incremental', '--tsBuildInfoFile', join(CACHE, 'app.tsbuildinfo')], 'typecheck-app']);
    first.push([npx, ['tsc', '-p', 'tsconfig.json', '--noEmit', '--incremental', '--tsBuildInfoFile', join(CACHE, 'all.tsbuildinfo')], 'typecheck-all']);
  }
  if (lintAll || lintFiles.length) {
    first.push([npx, ['eslint', '--cache', '--cache-strategy', 'content', '--cache-location', join(CACHE, 'eslintcache'), ...(lintAll ? ['.'] : lintFiles)], 'lint']);
  }
  if (first.length) ok = (await step('typecheck+lint', first)) && ok;
  else skip('typecheck+lint', 'kein Code geändert');

  // 2. Unit-Tests (Importgraph).
  if (unitGlobal) ok = (await step('unit', [[npx, ['vitest', 'run'], 'unit', { TZ: 'Europe/Berlin' }]])) && ok;
  else if (unitFiles.length) ok = (await step('unit', [[npx, ['vitest', 'related', '--run', '--passWithNoTests', ...unitFiles], 'unit', { TZ: 'Europe/Berlin' }]])) && ok;
  else skip('unit', 'keine Datei mit Unit-Bezug geändert');

  // 3. Build + E2E-Auswahl.
  const e2eNeeded = specs.length > 0;
  if (needsBuild || e2eNeeded) {
    const built = await step('build', [['bash', ['-c', 'npm run build && npm run build:runtime'], 'build']]);
    ok = built && ok;
    if (!built) skip('e2e', 'Build fehlgeschlagen');
    else if (e2eNeeded) {
      // perf.spec misst Rechenzeit und läuft wie im Gesamtlauf zuletzt und allein (Projekt `perf`, 1 Worker).
      const main = specs.filter((s) => s !== 'perf.spec.ts');
      if (main.length) ok = (await step('e2e', [[npx, ['playwright', 'test', '--no-deps', '--project=main', ...main.map((s) => `tests/e2e/${s}`)], 'e2e']])) && ok;
      if (specs.includes('perf.spec.ts')) ok = (await step('e2e-perf', [[npx, ['playwright', 'test', '--no-deps', '--project=perf'], 'e2e-perf']])) && ok;
    } else skip('e2e', 'keine Spec betroffen');
    // 4. Plattform-Prüfung auf dem frischen Build.
    if (built) ok = (await step('check:platform', [['node', ['scripts/check-platform.mjs'], 'platform']])) && ok;
    else skip('check:platform', 'Build fehlgeschlagen');
  } else {
    skip('build', 'nichts am App-Code geändert');
    skip('e2e', 'nichts am App-Code und keine Spec geändert');
    skip('check:platform', 'kein neuer Build');
  }

  if (ok) writeFileSync(okMark, new Date().toISOString());
  console.log(`\nErgebnis verify:fast (${fmt(Date.now() - t0)} min, Fingerabdruck ${fingerprint})`);
  for (const r of results) console.log(`  ${r.status.startsWith('ok') ? '✓' : r.status.startsWith('nicht') ? '–' : '✘'} ${r.name.padEnd(15)} ${r.ms ? fmt(r.ms) : '    '}  ${r.status}${r.logs ? `  (${r.logs.join(', ')})` : ''}`);
  console.log(ok ? '\nGRÜN. Vor einem Test-Link zusätzlich einmal `npm run verify` (Gesamtlauf).' : '\nROT. Ursache beheben, dann erneut `npm run verify:fast` (neuer Stand = neuer Fingerabdruck = alle Stufen neu).');
  // Alte Läufe aufräumen (nur die letzten 10 Fingerabdrücke behalten).
  try {
    const dirs = readdirSync(CACHE, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ d: d.name, t: statSync(join(CACHE, d.name)).mtimeMs }))
      .sort((a, b) => a.t - b.t);
    for (const { d } of dirs.slice(0, Math.max(0, dirs.length - 10))) if (d !== fingerprint) rmSync(join(CACHE, d), { recursive: true, force: true });
  } catch (err) {
    console.warn('Aufräumen von .cache/verify-fast übersprungen:', err instanceof Error ? err.message : err);
  }
  return ok ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(2);
  },
);
