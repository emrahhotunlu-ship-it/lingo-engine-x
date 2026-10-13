// Schnellprüfung für das Lesen-Modul (docs/umbau/lesen-plan.md §5.5): Sekunden bis wenige Minuten statt 20 Minuten Gesamtlauf.
// Schritte (jeder meldet sein Ergebnis; der Lauf bricht nicht beim ersten Fehler ab, damit alles auf einmal sichtbar ist):
//  1. Modul-Tests            vitest run tests/unit/read
//  2. Typprüfung App         tsc -p tsconfig.app.json (ganze App, weil das Modul in COLLECTIONS und TEMPLATES hängt)
//  3. Typprüfung Tests       tsc -p tsconfig.json, gemeldet werden NUR Fehler in src/modules/read, tests/unit/read, tests/e2e/read*
//                            (Fehler in fremden Testdateien gehören nicht zu dieser Prüfung und werden nur gezählt)
//  4. Lint                   eslint src/modules/read tests/unit/read
//  5. Plattform              npm run check:platform (verlangt einen vorherigen `npm run build`, sonst Hinweis und Fehlschlag)
// Aufruf: npm run check:read     (nur Modul-Tests: npm run test:read)

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const MINE = /^(src\/modules\/read\/|tests\/unit\/read\/|tests\/e2e\/read)/;
const results = [];

function run(name, cmd, args, opts = {}) {
  const t0 = Date.now();
  const res = spawnSync(cmd, args, { encoding: 'utf8', env: { ...process.env, TZ: 'Europe/Berlin' }, shell: false });
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  const ok = opts.judge ? opts.judge(out, res.status ?? 1) : res.status === 0;
  results.push({ name, ok, ms: Date.now() - t0 });
  if (!ok || opts.show) process.stdout.write(`\n--- ${name} ---\n${opts.filter ? opts.filter(out) : out}\n`);
  return out;
}

const bin = (n) => `node_modules/.bin/${n}`;

run('1 Modul-Tests', bin('vitest'), ['run', 'tests/unit/read']);

run('2 Typprüfung App', bin('tsc'), ['-p', 'tsconfig.app.json', '--noEmit']);

let foreign = 0;
run('3 Typprüfung Tests (nur Modul)', bin('tsc'), ['-p', 'tsconfig.json', '--noEmit'], {
  judge: (out) => {
    const errs = out.split('\n').filter((l) => /\berror TS\d+/.test(l));
    foreign = errs.filter((l) => !MINE.test(l)).length;
    return errs.every((l) => !MINE.test(l));
  },
  filter: (out) => out.split('\n').filter((l) => MINE.test(l)).join('\n'),
});

run('4 Lint (Modul und Modul-Tests)', bin('eslint'), ['src/modules/read', 'tests/unit/read']);

if (existsSync('dist/index.html')) run('5 Plattform (check:platform)', 'node', ['scripts/check-platform.mjs'], { show: false });
else {
  results.push({ name: '5 Plattform (check:platform)', ok: false, ms: 0 });
  process.stdout.write('\n--- 5 Plattform (check:platform) ---\ndist/index.html fehlt: erst `npm run build`, dann erneut `npm run check:read`.\n');
}

process.stdout.write('\nErgebnis check:read\n');
for (const r of results) process.stdout.write(`  ${r.ok ? 'OK    ' : 'FEHLER'}  ${r.name}  (${(r.ms / 1000).toFixed(1)} s)\n`);
if (foreign > 0) process.stdout.write(`  Hinweis: ${foreign} Typfehler in fremden Testdateien (nicht Teil dieser Prüfung).\n`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
