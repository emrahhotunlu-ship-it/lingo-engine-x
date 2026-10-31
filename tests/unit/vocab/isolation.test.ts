import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// Architektur-Wächter des Wörter-Moduls (docs/umbau/vokabeln/plan.md §2.1, nach dem Vorbild tests/unit/read/isolation.test.ts):
//  1. Im Modul importiert nur `shared.ts` aus dem Rest der App, und nur aus der Erlaubnisliste. Kein Import aus src/domain/srs.
//  2. Von außen sind nur `api` und `registry` erreichbar (Ausnahmen: scripts/vocab/**, tests/unit/vocab/**).
//  3. Gegenproben: absichtliche Fremdimporte schlagen an (hier und in der ESLint-Konfiguration).
//  4. Schreibgrenze: `vlog/` und `vmod/` schreibt nur das Modul; neue Schreiber nach `vocab/`/`chunk/` außerhalb der Erlaubnisliste fallen auf.

const ROOT = join(import.meta.dirname, '../../..');
const MODULE = 'src/modules/vocab';
const SHARED = `${MODULE}/shared.ts`;

const ALLOWED_SHARED: RegExp[] = [/^src\/domain\/date$/, /^src\/data\/writer$/, /^src\/platform\/diagnostics$/];
const ALLOWED_PACKAGES = new Set(['zod', 'ts-fsrs']);
const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

const importsOf = (text: string): string[] => [...text.matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2] ?? m[3] ?? '').filter(Boolean);
const resolveImport = (fromRel: string, spec: string): string | null =>
  spec.startsWith('.') ? posix.normalize(posix.join(posix.dirname(fromRel), spec)).replace(/\.(tsx?|jsx?)$/, '') : null;

export function moduleViolation(fileRel: string, spec: string): string | null {
  const target = resolveImport(fileRel, spec);
  if (target === null) return ALLOWED_PACKAGES.has(spec) ? null : `Paket "${spec}" ist im Modul nicht erlaubt`;
  if (fileRel === SHARED) {
    if (target.startsWith(`${MODULE}/`)) return null;
    return ALLOWED_SHARED.some((re) => re.test(target)) ? null : `shared.ts importiert "${target}" (nicht in der Erlaubnisliste)`;
  }
  if (!target.startsWith(`${MODULE}/`)) return `"${spec}" verlässt das Modul; Fremdes nur über shared.ts`;
  return null;
}

export function outsideViolation(fileRel: string, spec: string): string | null {
  const target = resolveImport(fileRel, spec);
  if (target === null || !(target === MODULE || target.startsWith(`${MODULE}/`))) return null;
  return target === `${MODULE}/api` || target === `${MODULE}/registry` ? null : `"${spec}" greift an den Türen des Wörter-Moduls vorbei`;
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const rel = (p: string): string => relative(ROOT, p).replaceAll('\\', '/');
const moduleFiles = files(join(ROOT, MODULE)).map((p) => ({ rel: rel(p), text: readFileSync(p, 'utf8') }));
const appFiles = files(join(ROOT, 'src'))
  .map((p) => ({ rel: rel(p), text: readFileSync(p, 'utf8') }))
  .filter((f) => !f.rel.startsWith(`${MODULE}/`));

describe('Wörter-Modul: Isolation', () => {
  it('Türen vorhanden, höchstens zwei Ebenen tief', () => {
    const names = moduleFiles.map((f) => f.rel.slice(MODULE.length + 1));
    for (const must of ['api.ts', 'registry.ts', 'shared.ts']) expect(names).toContain(must);
    for (const n of names) expect(n.split('/').length, n).toBeLessThanOrEqual(2);
  });

  it('im Modul: Fremdes nur über shared.ts aus der Erlaubnisliste; kein domain/srs', () => {
    const bad = moduleFiles.flatMap((f) => importsOf(f.text).map((s) => moduleViolation(f.rel, s)).filter(Boolean).map((v) => `${f.rel}: ${v}`));
    expect(bad).toEqual([]);
    expect(moduleFiles.filter((f) => /domain\/srs/.test(importsOf(f.text).join(' '))).map((f) => f.rel)).toEqual([]);
  });

  it('außerhalb: nur api und registry; die Berührungsliste ist abgezählt', () => {
    const bad = appFiles.flatMap((f) => importsOf(f.text).map((s) => outsideViolation(f.rel, s)).filter(Boolean).map((v) => `${f.rel}: ${v}`));
    expect(bad).toEqual([]);
    const touching = appFiles.filter((f) => importsOf(f.text).some((s) => (resolveImport(f.rel, s) ?? '').startsWith(MODULE))).map((f) => f.rel);
    // V1: nur die Datenschicht (Schemas für COLLECTIONS). Heute, Wort-Popup, C1-Aufgaben docken ab V3 an.
    expect(touching.sort()).toEqual(['src/data/paths.ts']);
  });

  it('Gegenprobe: die Regeln erkennen Verstöße', () => {
    expect(moduleViolation(`${MODULE}/domain/planner.ts`, '../../../domain/srs/scheduler')).toMatch(/verlässt/);
    expect(moduleViolation(SHARED, '../../domain/srs/scheduler')).toMatch(/Erlaubnisliste/);
    expect(moduleViolation(`${MODULE}/domain/planner.ts`, 'react')).toMatch(/Paket/);
    expect(outsideViolation('src/features/today/store.ts', '../../modules/vocab/domain/planner')).toMatch(/vorbei/);
    expect(outsideViolation('src/features/today/store.ts', '../../modules/vocab/api')).toBeNull();
  });

  it('ESLint-Konfiguration: die Sperren greifen für Modul-Dateien und Dateien außerhalb', async () => {
    const eslint = new ESLint({ cwd: ROOT });
    const patternsFor = async (file: string): Promise<Array<{ regex: string }>> => {
      const cfg = (await eslint.calculateConfigForFile(file)) as { rules?: Record<string, unknown> };
      const rule = cfg.rules?.['no-restricted-imports'] as [unknown, { patterns?: Array<{ regex: string; importNames?: string[] }> }] | undefined;
      return (rule?.[1]?.patterns ?? []).filter((p) => !p.importNames);
    };
    const hits = (patterns: Array<{ regex: string }>, spec: string): boolean => patterns.some((p) => new RegExp(p.regex).test(spec));
    // Außerhalb (verschiedene Blöcke: allgemein, Anzeige-Dateien, Lesen-Tür): nur api und registry.
    for (const f of ['src/features/today/TodayScreen.tsx', 'src/features/vocab/session.ts', 'src/data/paths.ts', 'src/modules/read/shared.ts', 'src/domain/plan/buildPlan.ts']) {
      const pats = await patternsFor(join(ROOT, f));
      expect(hits(pats, '../../modules/vocab/domain/planner'), f).toBe(true);
      expect(hits(pats, '../../modules/vocab/api'), f).toBe(false);
      expect(hits(pats, '../modules/vocab/registry'), f).toBe(false);
    }
    const top = await patternsFor(join(ROOT, MODULE, 'api.ts'));
    expect(hits(top, '../../domain/srs/scheduler')).toBe(true);
    expect(hits(top, './shared')).toBe(false);
    const nested = await patternsFor(join(ROOT, MODULE, 'domain', 'planner.ts'));
    expect(hits(nested, '../../../domain/srs/scheduler')).toBe(true);
    expect(hits(nested, '../shared')).toBe(false);
    const shared = await patternsFor(join(ROOT, SHARED));
    expect(hits(shared, '../../domain/srs/scheduler')).toBe(true);
    expect(hits(shared, '../../domain/date')).toBe(false);
  }, 60_000);

  it('Schreibgrenze: `vlog/` und `vmod/` kommen außerhalb des Moduls nicht als Pfad vor', () => {
    // Ausnahme: der Name der Sammlung bzw. `vmod/day` als ersetzbarer Zwischenspeicher in der Datenschicht (Registrierung, kein Schreiben).
    const bad = appFiles.filter((f) => /['"`]v(log|mod)\//.test(f.text) && f.rel !== 'src/data/writer.ts').map((f) => f.rel);
    expect(bad).toEqual([]);
  });

  it('Schreibgrenze: wer nach vocab/ bzw. chunk/ schreibt, steht auf der Erlaubnisliste (mit Ablaufpaket)', () => {
    // Erlaubnisliste (plan.md §2.1): alter Bereich bis V5 (Rückweg), Umstellung dauerhaft, Import/Export dauerhaft, dazu die heutigen
    // Neuanlage-Wege (Wort-Popup, Lehrer, Lesen, C1), die ab V3/V5 über addLexeme gehen. Neue Schreiber fallen hier auf.
    const writers = appFiles
      .filter((f) => /\b(saveCard|writer\.(set|patch|transform|createIfMissing|update)|getWriter\(\)\??\.(set|patch|transform|createIfMissing|update))\b/.test(f.text) && /[`'"](vocab|chunk)\//.test(f.text))
      .map((f) => f.rel)
      .sort();
    // Stand 31.10.2026: alter Bereich und heutige Neuanlage-Wege (Ablauf: V5 bzw. Umstellung auf addLexeme), Umstellung und Export dauerhaft.
    const ALLOW = /^src\/(features\/(vocab|lookup|teacher|c1x|c1|check|settings|today|learn|grammar|drills|speak|progress|tutor)|domain\/(srs|migration|vocab|activation|c1pack|tutor)|data|areas|app)\//;
    expect(writers.filter((r) => !ALLOW.test(r))).toEqual([]);
  });
});
