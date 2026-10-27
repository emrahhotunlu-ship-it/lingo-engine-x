import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { evaluate, gz, loadBudget, measure, type Budget } from '../../scripts/check-budget.mjs';

// Budget-Tor (Stufe 1, P0 S1-TOR): ein künstlicher Mehr-Datei-Build mit Vite-Manifest. Passt er, endet das Skript mit 0;
// ist ein Stück künstlich vergrößert, mit 1. Ohne Manifest (Einzeldatei) mit 2.
const SCRIPT = new URL('../../scripts/check-budget.mjs', import.meta.url).pathname;
const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** Zufällige, schlecht packbare Bytes: gzip-Größe ≈ Rohgröße. */
const noise = (n: number): Buffer => randomBytes(n);

function fakeBuild(opts: { entryBytes?: number; lazyBytes?: number; manifest?: boolean } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'lx-budget-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'index.html'), '<!doctype html><html lang="de"><head><title>X</title><script type="module" src="./index-a1.js"></script></head></html>');
  writeFileSync(join(dir, 'index-a1.js'), noise(opts.entryBytes ?? 2000));
  writeFileSync(join(dir, 'shared-b2.js'), noise(500));
  writeFileSync(join(dir, 'Sky-c3.js'), noise(opts.lazyBytes ?? 800));
  writeFileSync(join(dir, 'style-d4.css'), 'a{color:red}'.repeat(50));
  writeFileSync(join(dir, 'content-c1x-err-0123abcd.bin'), noise(300));
  if (opts.manifest !== false) {
    mkdirSync(join(dir, '.vite'));
    writeFileSync(
      join(dir, '.vite', 'manifest.json'),
      JSON.stringify({
        'index.html': { file: 'index-a1.js', isEntry: true, imports: ['_shared.js'], dynamicImports: ['src/Sky.tsx'] },
        '_shared.js': { file: 'shared-b2.js' },
        'src/Sky.tsx': { file: 'Sky-c3.js', isDynamicEntry: true, imports: ['index.html'] },
        'style.css': { file: 'style-d4.css' },
      }),
    );
  }
  return dir;
}

const BUDGET: Budget & { grenzen: { entry: { zuwachs: NonNullable<Budget['grenzen']['entry']['zuwachs']> } } } = {
  grenzen: {
    entry: { basis: 4000, zuwachs: {} },
    css: { basis: 200, zuwachs: {} },
    html: { basis: 300, zuwachs: {} },
    lazy: { 'src/Sky.tsx': { basis: 1500, zuwachs: {} } },
    lazyNeu: 1000,
    bin: 1000,
    files: 99,
  },
  vorab: { 'P2 S1-SHELL': { entry: 1000 } },
};

function run(dir: string, budget: unknown): { code: number | null; out: string } {
  const path = join(dir, 'budget-test.json');
  writeFileSync(path, JSON.stringify(budget));
  const r = spawnSync(process.execPath, [SCRIPT, '--dist', dir, '--budget', path], { encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe('measure', () => {
  it('Einstieg = Manifest-Eintrag index.html samt statischer Importe; nachgeladene Stücke und Bündel einzeln', () => {
    const dir = fakeBuild();
    const m = measure(dir);
    expect(m.entryFiles.sort()).toEqual(['index-a1.js', 'shared-b2.js']);
    expect(m.entry).toBe(gz(readFileSync(join(dir, 'index-a1.js'))) + gz(readFileSync(join(dir, 'shared-b2.js'))));
    expect(Object.keys(m.lazy)).toEqual(['src/Sky.tsx']);
    expect(Object.keys(m.bin)).toEqual(['content-c1x-err']);
    // dist/.vite/ zählt nicht als Datei.
    expect(m.files).toBe(6);
  });
});

describe('check-budget (Exit-Code)', () => {
  it('passender Build → 0', () => {
    const r = run(fakeBuild(), BUDGET);
    expect(r.out).toContain('BUDGET-TOR: im Budget');
    expect(r.code).toBe(0);
  });
  it('künstlich vergrößerter Einstieg → 1', () => {
    const r = run(fakeBuild({ entryBytes: 6000 }), BUDGET);
    expect(r.out).toContain('entry:');
    expect(r.code).toBe(1);
  });
  it('künstlich vergrößertes nachgeladenes Stück → 1', () => {
    const r = run(fakeBuild({ lazyBytes: 3000 }), BUDGET);
    expect(r.out).toContain('lazy src/Sky.tsx');
    expect(r.code).toBe(1);
  });
  it('ohne Vite-Manifest (Einzeldatei-Build) → 2', () => {
    expect(run(fakeBuild({ manifest: false }), BUDGET).code).toBe(2);
  });
});

describe('Sperrklinke (evaluate)', () => {
  const big = () => measure(fakeBuild({ entryBytes: 4200 }));
  it('vorab genannter Zuwachs mit Paketname hebt die Grenze genau um seinen Betrag', () => {
    const b = structuredClone(BUDGET);
    b.grenzen.entry.zuwachs = { 'P2 S1-SHELL': 1000 };
    expect(evaluate(big(), b).problems).toEqual([]);
  });
  it('mehr als vorab genannt ist ein Befund – außer mit Freigabe der Hauptsitzung', () => {
    const b = structuredClone(BUDGET);
    b.grenzen.entry.zuwachs = { 'P2 S1-SHELL': 1500 };
    expect(evaluate(big(), b).problems.join()).toContain('Zustimmung der Hauptsitzung');
    b.grenzen.entry.zuwachs = { 'P2 S1-SHELL': { bytes: 1500, freigabe: 'Hauptsitzung 28.10.2026: Kontextspalte größer' } };
    expect(evaluate(big(), b).problems).toEqual([]);
  });
  it('Zuwachs eines Pakets ohne vorab genannten Betrag ist ein Befund', () => {
    const b = structuredClone(BUDGET);
    b.grenzen.entry.zuwachs = { 'P9 S1-INHALT': 10 };
    expect(evaluate(measure(fakeBuild()), b).problems.join()).toContain('P9 S1-INHALT');
  });
  it('neues nachgeladenes Stück: Grenze lazyNeu und Hinweis zum Eintragen', () => {
    const b = structuredClone(BUDGET);
    b.grenzen.lazy = {};
    const res = evaluate(measure(fakeBuild()), b);
    expect(res.problems).toEqual([]);
    expect(res.notes.join()).toContain('src/Sky.tsx');
  });
});

describe('scripts/budget.json', () => {
  it('ist gültig: jede Größe hat eine Basis, jeder Zuwachs ist vorab genannt', () => {
    const budget = loadBudget();
    const m = { entry: 0, entryFiles: [], css: 0, html: 0, lazy: {}, bin: {}, files: 1, total: 1 };
    expect(evaluate(m, budget).problems).toEqual([]);
    expect(Object.keys(budget.vorab ?? {})).toEqual(['P1 S1-TOK', 'P2 S1-SHELL', 'P3 S1-BAND', 'P4 S1-ZEIT', 'P5 S1-ZAHL', 'P6 S1-START', 'P7 S1-DIKTAT']);
  });
});
