import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// Architektur-Wächter des Lesen-Moduls (docs/umbau/lesen-plan.md §5.3, wie tests/unit/archGuards.test.ts):
//  1. Im Modul importiert nur `shared.ts` aus dem Rest der App, und nur aus der Erlaubnisliste (§5.2).
//  2. Tiefe höchstens 2 (`src/modules/read/<unter>/<datei>`); nichts im Modul greift zwei Ebenen hoch.
//  3. Von außen sind nur `index` und `registry` erreichbar; die Berührungsliste (§5.4) ist abgezählt.
//  4. Gegenproben: absichtliche Fremdimporte schlagen an (hier und in der ESLint-Konfiguration).

const ROOT = join(import.meta.dirname, '../../..');
const MODULE = 'src/modules/read';

/** Erlaubnisliste für shared.ts (Plan §5.2), als Pfade ab Projektwurzel ohne Endung. */
const ALLOWED_SHARED: RegExp[] = [
  /^src\/engine\/(EnglishText|wordTap|SpeakButton)$/,
  /^src\/ui\/[A-Za-z]+$/,
  /^src\/i18n(\/[A-Za-z.]+)?$/,
  /^src\/platform\/(speech|diagnostics|storage|input|capabilities)$/,
  /^src\/ai\/(gate|useAsk|scope|errors|types)$/,
  /^src\/prompts\/(common|types)$/,
  /^src\/domain\/(date|lang\/detect|text\/tokenize|capacity\/docGuard)$/,
  /^src\/data\/(writer|validate|live)$/,
  /^src\/app\/(nav|registry)$/,
  /^src\/features\/lookup\/store$/,
];
/** Fremde Pakete, die überall im Modul erlaubt sind. */
const ALLOWED_PACKAGES = new Set(['zod', 'react', 'react/jsx-runtime', 'framer-motion']);

const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

export function importsOf(text: string): string[] {
  return [...text.matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2] ?? m[3] ?? '').filter(Boolean);
}

/** Löst einen Importpfad ab der Projektwurzel auf (ohne Endung); `null` bei einem Paket. */
export function resolveImport(fromRel: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  return posix.normalize(posix.join(posix.dirname(fromRel), spec)).replace(/\.(tsx?|jsx?)$/, '');
}

/** Regel für eine Datei IM Modul. `fileRel` ab Projektwurzel. Liefert den Verstoß oder null. */
export function moduleViolation(fileRel: string, spec: string): string | null {
  const target = resolveImport(fileRel, spec);
  if (target === null) return ALLOWED_PACKAGES.has(spec) ? null : `Paket "${spec}" ist im Modul nicht erlaubt`;
  if (fileRel === `${MODULE}/shared.ts`) {
    if (target.startsWith(`${MODULE}/`)) return null;
    return ALLOWED_SHARED.some((re) => re.test(target)) ? null : `shared.ts importiert "${target}", das nicht in der Erlaubnisliste (Plan §5.2) steht`;
  }
  if (!target.startsWith(`${MODULE}/`)) return `"${spec}" verlässt das Modul; Fremdes nur über shared.ts`;
  return null;
}

/** Regel für eine Datei AUSSERHALB des Moduls: nur `index` und `registry` sind Türen. */
export function outsideViolation(fileRel: string, spec: string): string | null {
  const target = resolveImport(fileRel, spec);
  if (target === null || !(target === MODULE || target.startsWith(`${MODULE}/`))) return null;
  return target === MODULE || target === `${MODULE}/index` || target === `${MODULE}/registry` ? null : `"${spec}" greift an den Türen des Lesen-Moduls vorbei`;
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const rel = (p: string): string => relative(ROOT, p).replaceAll('\\', '/');
const moduleFiles = files(join(ROOT, MODULE)).map((p) => ({ rel: rel(p), text: readFileSync(p, 'utf8') }));

describe('Lesen-Modul: Isolation', () => {
  it('das Modul besteht aus den erwarteten Türen und liegt höchstens zwei Ebenen tief', () => {
    const names = moduleFiles.map((f) => f.rel.slice(MODULE.length + 1));
    for (const must of ['index.ts', 'registry.ts', 'shared.ts']) expect(names).toContain(must);
    for (const n of names) expect(n.split('/').length, n).toBeLessThanOrEqual(2);
  });

  it('nur shared.ts verlässt das Modul, und nur zu Zielen der Erlaubnisliste', () => {
    const bad: string[] = [];
    for (const f of moduleFiles) for (const spec of importsOf(f.text)) {
      const v = moduleViolation(f.rel, spec);
      if (v) bad.push(`${f.rel}: ${v}`);
    }
    expect(bad).toEqual([]);
    const leaving = moduleFiles.filter((f) => importsOf(f.text).some((s) => (resolveImport(f.rel, s) ?? MODULE + '/').startsWith(`${MODULE}/`) === false)).map((f) => f.rel);
    expect(leaving).toEqual([`${MODULE}/shared.ts`]);
  });

  it('shared.ts hat nur Durchreichen, keine eigene Logik', () => {
    const shared = moduleFiles.find((f) => f.rel === `${MODULE}/shared.ts`)?.text ?? '';
    const code = shared.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//'));
    expect(code.every((l) => /^export (type )?\{[^}]*\} from '[^']+';$/.test(l.trim()))).toBe(true);
  });

  it('von außen nur über index und registry; die Berührungsliste ist abgezählt (Plan §5.4)', () => {
    const outside = [...files(join(ROOT, 'src')), ...files(join(ROOT, 'tests'))].map((p) => ({ rel: rel(p), text: readFileSync(p, 'utf8') })).filter((f) => !f.rel.startsWith(`${MODULE}/`) && !f.rel.startsWith('tests/unit/read/') && !f.rel.startsWith('tests/e2e/read'));
    const bad: string[] = [];
    const touching = new Set<string>();
    for (const f of outside) for (const spec of importsOf(f.text)) {
      const v = outsideViolation(f.rel, spec);
      if (v) bad.push(`${f.rel}: ${v}`);
      const t = resolveImport(f.rel, spec);
      if (t !== null && f.rel.startsWith('src/') && (t === MODULE || t.startsWith(`${MODULE}/`))) touching.add(f.rel);
    }
    expect(bad).toEqual([]);
    // Wächst diese Liste, ist ein weiteres Fremdfile vom Modul abhängig: bewusst entscheiden und Plan §5.4 nachziehen.
    expect([...touching].sort()).toEqual(['src/data/paths.ts', 'src/prompts/registry.ts']);
  });

  it('der Rest der App liest nichts aus dem Modul außer über registry (Schema, Vorlagen)', () => {
    const paths = readFileSync(join(ROOT, 'src/data/paths.ts'), 'utf8');
    const reg = readFileSync(join(ROOT, 'src/prompts/registry.ts'), 'utf8');
    expect(importsOf(paths).filter((s) => s.includes('modules/read'))).toEqual(['../modules/read/registry']);
    expect(importsOf(reg).filter((s) => s.includes('modules/read'))).toEqual(['../modules/read/registry']);
  });
});

describe('Gegenproben: absichtliche Fremdimporte schlagen an', () => {
  it('Modul-Dateien: Importe nach außen sind Verstöße', () => {
    expect(moduleViolation(`${MODULE}/domain/x.ts`, '../../ai/gate')).toMatch(/verlässt das Modul/);
    expect(moduleViolation(`${MODULE}/store.ts`, '../data/paths')).toMatch(/verlässt das Modul/);
    expect(moduleViolation(`${MODULE}/prompt.ts`, '../../prompts/common')).toMatch(/verlässt das Modul/);
    expect(moduleViolation(`${MODULE}/domain/x.ts`, 'lodash')).toMatch(/nicht erlaubt/);
    expect(moduleViolation(`${MODULE}/domain/x.ts`, '../shared')).toBeNull();
    expect(moduleViolation(`${MODULE}/store.ts`, './domain/day')).toBeNull();
    expect(moduleViolation(`${MODULE}/domain/x.ts`, 'zod')).toBeNull();
  });

  it('shared.ts: nur die Erlaubnisliste; verbotene Ziele (srs, unit, plan, features außer lookup/store) schlagen an', () => {
    const f = `${MODULE}/shared.ts`;
    expect(moduleViolation(f, '../../features/vocab/session')).toMatch(/Erlaubnisliste/);
    expect(moduleViolation(f, '../../domain/srs/guard')).toMatch(/Erlaubnisliste/);
    expect(moduleViolation(f, '../../domain/unit/planFor')).toMatch(/Erlaubnisliste/);
    expect(moduleViolation(f, '../../domain/plan/x')).toMatch(/Erlaubnisliste/);
    expect(moduleViolation(f, '../../app/unit/x')).toMatch(/Erlaubnisliste/);
    expect(moduleViolation(f, '../../data/paths')).toMatch(/Erlaubnisliste/);
    expect(moduleViolation(f, '../../features/lookup/store')).toBeNull();
    expect(moduleViolation(f, '../../ai/gate')).toBeNull();
    expect(moduleViolation(f, '../../domain/lang/detect')).toBeNull();
    expect(moduleViolation(f, '../../data/writer')).toBeNull();
  });

  it('Dateien außerhalb: an index/registry vorbei ist ein Verstoß', () => {
    expect(outsideViolation('src/areas/index.ts', '../modules/read/accept')).toMatch(/vorbei/);
    expect(outsideViolation('src/data/paths.ts', '../modules/read/shared')).toMatch(/vorbei/);
    expect(outsideViolation('src/features/x/y.ts', '../../modules/read/domain/day')).toMatch(/vorbei/);
    expect(outsideViolation('src/data/paths.ts', '../modules/read/registry')).toBeNull();
    expect(outsideViolation('src/areas/index.ts', '../modules/read/index')).toBeNull();
    expect(outsideViolation('src/areas/index.ts', '../modules/read')).toBeNull();
    expect(outsideViolation('src/areas/index.ts', '../app/registry')).toBeNull();
  });

  it('ESLint-Konfiguration: die Sperren greifen für Modul-Dateien und Dateien außerhalb', async () => {
    const eslint = new ESLint({ cwd: ROOT });
    const patternsFor = async (file: string): Promise<Array<{ regex: string }>> => {
      const cfg = (await eslint.calculateConfigForFile(file)) as { rules?: Record<string, unknown> };
      const rule = cfg.rules?.['no-restricted-imports'] as [unknown, { patterns?: Array<{ regex: string }> }] | undefined;
      return rule?.[1]?.patterns ?? [];
    };
    const hits = (patterns: Array<{ regex: string }>, spec: string): boolean => patterns.some((p) => new RegExp(p.regex).test(spec));

    const top = await patternsFor(join(ROOT, MODULE, 'store.ts'));
    expect(hits(top, '../ai/gate')).toBe(true);
    expect(hits(top, '../shared')).toBe(true); // eine Ebene höher ist auf Modulebene schon draußen
    expect(hits(top, './shared')).toBe(false);
    expect(hits(top, './domain/day')).toBe(false);

    const nested = await patternsFor(join(ROOT, MODULE, 'domain', 'day.ts'));
    expect(hits(nested, '../../ai/gate')).toBe(true);
    expect(hits(nested, '../shared')).toBe(false);
    expect(hits(nested, './docs')).toBe(false);

    const shared = await patternsFor(join(ROOT, MODULE, 'shared.ts'));
    expect(hits(shared, '../../ai/gate')).toBe(false);
    expect(hits(shared, '../../features/read/x')).toBe(true); // die alte Sperre für features/read bleibt

    for (const file of ['src/areas/index.ts', 'src/data/paths.ts', 'src/domain/metrics/x.ts', 'tests/unit/archGuards.test.ts']) {
      const out = await patternsFor(join(ROOT, file));
      expect(hits(out, '../modules/read/accept'), file).toBe(true);
      expect(hits(out, '../modules/read/registry'), file).toBe(false);
      expect(hits(out, '../modules/read/index'), file).toBe(false);
      expect(hits(out, '../features/read/x'), file).toBe(true);
    }
    const own = await patternsFor(join(ROOT, 'tests/unit/read/data.test.ts'));
    expect(hits(own, '../../../src/modules/read/domain/day')).toBe(false);
  }, 60_000);
});
