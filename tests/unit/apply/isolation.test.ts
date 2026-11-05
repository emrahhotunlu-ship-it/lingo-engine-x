import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// Architektur-Wächter des Moduls Anwenden (F3, nach dem Vorbild tests/unit/read/isolation.test.ts):
//  1. Im Modul importieren nur `shared.ts` (Logik) und `sharedUi.ts` (Oberfläche) aus dem Rest der App, je aus ihrer Erlaubnisliste.
//  2. Tiefe höchstens 2 (`src/modules/apply/<unter>/<datei>`).
//  3. Von außen sind nur `index` und `registry` erreichbar; die Berührungsliste ist abgezählt.
//  4. `registry.ts` (früh geladen von den Texten und von Heute) erreicht weder `shared.ts` noch die Oberfläche (keine Import-Schleife, kleine Einstiegsdatei).
//  5. Gegenproben: absichtliche Fremdimporte schlagen an (hier und in der ESLint-Konfiguration).

const ROOT = join(import.meta.dirname, '../../..');
const MODULE = 'src/modules/apply';
const SHARED = `${MODULE}/shared.ts`;
const SHARED_UI = `${MODULE}/sharedUi.ts`;

const ALLOWED_SHARED: RegExp[] = [
  /^src\/domain\/(random|text\/chunkMatch|repair\/(norm|repair)|tutor\/(edits|mail|ctx|ctx2|patList)|nbdrill\/outDoc|c1\/prod|grammar\/patterns)$/,
  /^src\/platform\/diagnostics$/,
  /^src\/content\/nb\/(load|schemas)$/,
  /^src\/prompts\/(common|applyReply|applySummary|applyKeypoints|applyCommon|c1Mail)$/,
];
const ALLOWED_SHARED_UI: RegExp[] = [
  /^src\/app\/(registry|nav|clock|unit\/done)$/,
  /^src\/i18n$/,
  /^src\/ui\/(Button|Icon|Disclosure|AiRunPanel|AiMark|Skeleton|RowList|chat\/keyboard)$/,
  /^src\/features\/(system\/Chrome|learn\/ui|tutor\/clinicSave|repair\/store|today\/(store|state)|apply\/ComboSentence|drills\/session)$/,
  /^src\/ai\/(useAsk|scope|tutorBudget)$/,
  /^src\/platform\/(capabilities|storage|input|diagnostics)$/,
  /^src\/data(\/(live|reads))?$/,
  /^src\/domain\/(nbdrill\/outDoc|c1\/prod|metrics|content)$/,
  /^src\/modules\/read\/registry$/,
  // F2: Wort-Belege an die Wörter-App (eine Tür).
  /^src\/modules\/vocab\/api$/,
];
const ALLOWED_PACKAGES = new Set(['zod', 'react', 'react/jsx-runtime']);
const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

export const importsOf = (text: string): string[] => [...text.matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2] ?? m[3] ?? '').filter(Boolean);
export const resolveImport = (fromRel: string, spec: string): string | null =>
  spec.startsWith('.') ? posix.normalize(posix.join(posix.dirname(fromRel), spec)).replace(/\.(tsx?|jsx?)$/, '') : null;

export function moduleViolation(fileRel: string, spec: string): string | null {
  const target = resolveImport(fileRel, spec);
  if (target === null) return ALLOWED_PACKAGES.has(spec) ? null : `Paket "${spec}" ist im Modul nicht erlaubt`;
  if (fileRel === SHARED || fileRel === SHARED_UI) {
    if (target.startsWith(`${MODULE}/`)) return null;
    const list = fileRel === SHARED ? ALLOWED_SHARED : ALLOWED_SHARED_UI;
    return list.some((re) => re.test(target)) ? null : `${posix.basename(fileRel)} importiert "${target}" (nicht in der Erlaubnisliste)`;
  }
  if (!target.startsWith(`${MODULE}/`)) return `"${spec}" verlässt das Modul; Fremdes nur über shared.ts bzw. sharedUi.ts`;
  return null;
}

export function outsideViolation(fileRel: string, spec: string): string | null {
  const target = resolveImport(fileRel, spec);
  if (target === null || !(target === MODULE || target.startsWith(`${MODULE}/`))) return null;
  return target === `${MODULE}/index` || target === `${MODULE}/registry` ? null : `"${spec}" greift an den Türen des Anwenden-Moduls vorbei`;
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const rel = (p: string): string => relative(ROOT, p).replaceAll('\\', '/');
const moduleFiles = files(join(ROOT, MODULE)).map((p) => ({ rel: rel(p), text: readFileSync(p, 'utf8') }));

describe('Anwenden-Modul: Isolation', () => {
  it('Türen vorhanden, höchstens zwei Ebenen tief', () => {
    const names = moduleFiles.map((f) => f.rel.slice(MODULE.length + 1));
    for (const must of ['index.ts', 'registry.ts', 'shared.ts', 'sharedUi.ts']) expect(names).toContain(must);
    for (const n of names) expect(n.split('/').length, n).toBeLessThanOrEqual(2);
  });

  it('nur shared.ts und sharedUi.ts verlassen das Modul, und nur zu Zielen ihrer Erlaubnisliste', () => {
    const bad = moduleFiles.flatMap((f) => importsOf(f.text).map((s) => moduleViolation(f.rel, s)).filter(Boolean).map((v) => `${f.rel}: ${v}`));
    expect(bad).toEqual([]);
  });

  it('shared.ts und sharedUi.ts reichen nur durch (keine eigene Logik)', () => {
    for (const r of [SHARED, SHARED_UI]) {
      const text = moduleFiles.find((f) => f.rel === r)?.text ?? '';
      const code = text.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//'));
      expect(code.length, r).toBeGreaterThan(0);
      for (const l of code) expect(l, `${r}: ${l}`).toMatch(/^export (type )?\{[^}]*\} from '[^']+';$/);
    }
  });

  it('registry.ts erreicht statisch weder shared.ts noch sharedUi.ts noch die Oberfläche', () => {
    const byRel = new Map(moduleFiles.map((f) => [f.rel.replace(/\.tsx?$/, ''), f.text]));
    const seen = new Set<string>();
    const stack = [`${MODULE}/registry`];
    while (stack.length) {
      const cur = stack.pop() ?? '';
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const m of (byRel.get(cur) ?? '').matchAll(/^(?:import|export)\s+(?:type\s+)?[^;]*?from\s*'([^']+)'/gm)) {
        const t = resolveImport(`${cur}.ts`, m[1] ?? '');
        if (t === null) continue;
        expect(t.startsWith(`${MODULE}/`), `${cur} → ${t}`).toBe(true);
        stack.push(t);
      }
    }
    expect([...seen].filter((r) => r === `${MODULE}/shared` || r === `${MODULE}/sharedUi` || r.startsWith(`${MODULE}/ui/`))).toEqual([]);
  });

  it('von außen nur über index und registry; die Berührungsliste ist abgezählt', () => {
    const outside = [...files(join(ROOT, 'src')), ...files(join(ROOT, 'tests'))]
      .map((p) => ({ rel: rel(p), text: readFileSync(p, 'utf8') }))
      .filter((f) => !f.rel.startsWith(`${MODULE}/`) && !f.rel.startsWith('tests/unit/apply/'));
    const bad: string[] = [];
    const touching = new Set<string>();
    for (const f of outside)
      for (const spec of importsOf(f.text)) {
        const v = outsideViolation(f.rel, spec);
        if (v) bad.push(`${f.rel}: ${v}`);
        const t = resolveImport(f.rel, spec);
        if (t !== null && f.rel.startsWith('src/') && (t === MODULE || t.startsWith(`${MODULE}/`))) touching.add(f.rel);
      }
    expect(bad).toEqual([]);
    // Wächst diese Liste, hängt ein weiteres Fremdfile am Modul: bewusst entscheiden.
    // areas: Bereich und Seite (index), Schritt 3 (registry: kurzer Tag); Texte (registry); Heute friert die Disziplin ein, der Tagesweg zählt erledigte Anwenden-Tage (registry).
    expect([...touching].sort()).toEqual(['src/areas/anwenden.tsx', 'src/areas/index.ts', 'src/features/today/store.ts', 'src/features/unit/run.ts', 'src/i18n/de.ts', 'src/i18n/en.ts']);
  });
});

describe('Gegenproben: absichtliche Fremdimporte schlagen an', () => {
  it('Modul-Dateien und Türen', () => {
    expect(moduleViolation(`${MODULE}/domain/x.ts`, '../../../ai/gate')).toMatch(/verlässt/);
    expect(moduleViolation(`${MODULE}/registry.ts`, '../../i18n')).toMatch(/verlässt/);
    expect(moduleViolation(`${MODULE}/domain/x.ts`, 'lodash')).toMatch(/nicht erlaubt/);
    expect(moduleViolation(`${MODULE}/domain/x.ts`, '../shared')).toBeNull();
    expect(moduleViolation(SHARED, '../../features/vocab/session')).toMatch(/Erlaubnisliste/);
    expect(moduleViolation(SHARED, '../../ui/Button')).toMatch(/Erlaubnisliste/);
    expect(moduleViolation(SHARED_UI, '../../ui/Button')).toBeNull();
    expect(moduleViolation(SHARED_UI, '../read/domain/recent')).toMatch(/Erlaubnisliste/);
    expect(outsideViolation('src/features/today/store.ts', '../../modules/apply/domain/count')).toMatch(/vorbei/);
    expect(outsideViolation('src/features/today/store.ts', '../../modules/apply/registry')).toBeNull();
    expect(outsideViolation('src/areas/anwenden.tsx', '../modules/apply/index')).toBeNull();
  });

  it('ESLint-Konfiguration: Modul-Dateien dürfen nur über die Türen hinaus', async () => {
    const eslint = new ESLint({ cwd: ROOT });
    const patternsFor = async (file: string): Promise<Array<{ regex: string }>> => {
      const cfg = (await eslint.calculateConfigForFile(file)) as { rules?: Record<string, unknown> };
      const rule = cfg.rules?.['no-restricted-imports'] as [unknown, { patterns?: Array<{ regex: string; importNames?: string[] }> }] | undefined;
      return (rule?.[1]?.patterns ?? []).filter((p) => !p.importNames);
    };
    const hits = (patterns: Array<{ regex: string }>, spec: string): boolean => patterns.some((p) => new RegExp(p.regex).test(spec));
    const top = await patternsFor(join(ROOT, MODULE, 'registry.ts'));
    expect(hits(top, '../ai/gate')).toBe(true);
    expect(hits(top, './domain/count')).toBe(false);
    const nested = await patternsFor(join(ROOT, MODULE, 'ui', 'TaskScreen.tsx'));
    expect(hits(nested, '../../../ai/gate')).toBe(true);
    expect(hits(nested, '../sharedUi')).toBe(false);
    const door = await patternsFor(join(ROOT, MODULE, 'sharedUi.ts'));
    expect(hits(door, '../../ui/Button')).toBe(false);
    // Relative Wege ins Lesen-Modul (`../read/…`) sieht die ESLint-Sperre nicht; die Türen des Lesen-Moduls hält tests/unit/read/isolation.test.ts.
    expect(hits(door, '../../modules/vocab/domain/planner')).toBe(true);
  }, 60_000);
});
