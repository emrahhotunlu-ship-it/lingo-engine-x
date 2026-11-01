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
const SHARED_UI = `${MODULE}/sharedUi.ts`;

const ALLOWED_SHARED: RegExp[] = [/^src\/domain\/date$/, /^src\/domain\/text\/british$/, /^src\/domain\/text\/lemma$/, /^src\/data\/writer$/, /^src\/platform\/diagnostics$/];
// V3 Schritt 2b-2: zweite Tür nur für die Oberfläche (Lernkarte, Band, Runde); nie von registry.ts/api.ts statisch erreichbar.
const ALLOWED_SHARED_UI: RegExp[] = [
  /^src\/app\/(registry|nav)$/,
  /^src\/i18n$/,
  /^src\/ui\/(exercise|Button|Skeleton|Toast)$/,
  /^src\/engine\/(EnglishText|KineticGap|HiddenInput|useHotkeys|wordTap)$/,
  /^src\/domain\/answer\/mask$/,
  /^src\/domain\/lexicon\/dict$/,
  /^src\/data(\/live|\/reads)?$/,
  /^src\/platform\/(capabilities|storage)$/,
];
const ALLOWED_PACKAGES = new Set(['zod', 'ts-fsrs', 'react', 'react/jsx-runtime']);
const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

const importsOf = (text: string): string[] => [...text.matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2] ?? m[3] ?? '').filter(Boolean);
const resolveImport = (fromRel: string, spec: string): string | null =>
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
    for (const must of ['api.ts', 'registry.ts', 'shared.ts', 'sharedUi.ts']) expect(names).toContain(must);
    for (const n of names) expect(n.split('/').length, n).toBeLessThanOrEqual(2);
  });

  it('sharedUi.ts reicht nur durch (keine eigene Logik)', () => {
    const text = moduleFiles.find((f) => f.rel === SHARED_UI)!.text;
    const code = text.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//'));
    for (const l of code) expect(l, l).toMatch(/^export (type )?\{[^}]*\} from '[^']+';$/);
  });

  it('Importkreis: von registry.ts und api.ts ist die Oberfläche (sharedUi, ui/) statisch nie erreichbar', () => {
    const byRel = new Map(moduleFiles.map((f) => [f.rel.replace(/\.tsx?$/, ''), f.text]));
    for (const door of ['registry', 'api']) {
      const seen = new Set<string>();
      const stack = [`${MODULE}/${door}`];
      while (stack.length) {
        const cur = stack.pop()!;
        if (seen.has(cur)) continue;
        seen.add(cur);
        const text = byRel.get(cur);
        if (!text) continue;
        // nur statische Importe (`import()` ist erlaubt und wird nicht verfolgt)
        for (const m of text.matchAll(/^(?:import|export)\s+(?:type\s+)?[^;]*?from\s*'([^']+)'/gm)) {
          const t = resolveImport(`${cur}.ts`, m[1]!);
          if (t && t.startsWith(`${MODULE}/`)) stack.push(t);
        }
      }
      const ui = [...seen].filter((r) => r === `${MODULE}/sharedUi` || r.startsWith(`${MODULE}/ui/`));
      expect(ui, door).toEqual([]);
    }
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
    // V1: nur die Datenschicht (Schemas für COLLECTIONS). V3 Schritt 1: Zählung (reads) und Sicherung (snapshot) der trägen Sammlung vlog über registry.
    // Heute, Wort-Popup, C1-Aufgaben docken ab V3 an.
    // V3 Schritt 2b-2: der Bereich Wortschatz bindet den Lernbildschirm über api.loadScreens() (nachgeladen) an.
    expect(touching.sort()).toEqual(['src/areas/wortschatz.tsx', 'src/data/paths.ts', 'src/data/reads.ts', 'src/data/snapshot.ts', 'src/data/writer.ts']);
  });

  it('Gegenprobe: die Regeln erkennen Verstöße', () => {
    expect(moduleViolation(`${MODULE}/domain/planner.ts`, '../../../domain/srs/scheduler')).toMatch(/verlässt/);
    expect(moduleViolation(SHARED, '../../domain/srs/scheduler')).toMatch(/Erlaubnisliste/);
    expect(moduleViolation(`${MODULE}/domain/planner.ts`, 'framer-motion')).toMatch(/Paket/);
    expect(moduleViolation(SHARED_UI, '../../features/vocab/session')).toMatch(/Erlaubnisliste/);
    expect(moduleViolation(SHARED_UI, '../../ui/Button')).toBeNull();
    expect(moduleViolation(`${MODULE}/ui/LearnCard.tsx`, '../../../ui/Button')).toMatch(/verlässt/);
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
    // Sicherung/Import über COLLECTIONS schreibt vlog/vmod dauerhaft zurück (gewollt, kein Literal); sonst schreibt nur das Modul.
    const bad = appFiles.filter((f) => /['"`]v(log|mod)\//.test(f.text)).map((f) => f.rel);
    expect(bad).toEqual([]);
  });

  it('Schreibgrenze: wer nach vocab/ bzw. chunk/ schreibt, steht einzeln auf der Erlaubnisliste (mit Ablaufpaket); die Liste schrumpft mit', () => {
    // plan.md §2.1: alter Bereich bis V5 (Rückweg), Umstellung und Import/Export dauerhaft, Neuanlage-Wege ab V3/V5 über addLexeme.
    // Erkennung: Schreibaufruf UND Pfad-Literal `vocab/`/`chunk/` in derselben Datei. Schreiben über Pfadhelfer erkennt dieser Suchtest
    // nicht (Grenze, im Bericht V1 genannt); der Präfix-Wächter im Test-Writer kommt mit dem ersten Andocken (V3).
    const ALLOW: Record<string, 'V5' | 'V3→addLexeme' | 'V5→addLexeme' | 'dauerhaft'> = {
      'src/domain/activation/actDoc.ts': 'V5',
      'src/domain/c1pack/pack.ts': 'V3→addLexeme',
      'src/domain/migration/v1.ts': 'dauerhaft',
      'src/domain/tutor/sentenceBank.ts': 'V5',
      'src/features/lookup/store.ts': 'V3→addLexeme',
      'src/features/progress/dayJobs.ts': 'V5',
      'src/features/progress/persist.ts': 'dauerhaft',
      'src/features/speak/persist.ts': 'V5',
      'src/features/today/store.ts': 'V5',
      'src/features/tutor/explainSave.ts': 'V5',
      'src/features/vocab/atlas/add.ts': 'V5→addLexeme',
      'src/features/vocab/colCharge.ts': 'V5',
      'src/features/vocab/list/actions.ts': 'V5',
      'src/features/vocab/mnemonic.tsx': 'V5',
      'src/features/vocab/persist.ts': 'V5',
      'src/features/vocab/sentenceBank.ts': 'V5',
      'src/features/vocab/session.ts': 'V5',
      'src/features/vocab/wordCtx.ts': 'V5',
    };
    const writers = appFiles
      .filter((f) => /\b(saveCard|writer\.(set|patch|transform|createIfMissing|update)|getWriter\(\)\??\.(set|patch|transform|createIfMissing|update))\b/.test(f.text) && /[`'"](vocab|chunk)\//.test(f.text))
      .map((f) => f.rel)
      .sort();
    expect(writers).toEqual(Object.keys(ALLOW).sort());
  });

  it('Ladezeit: api.ts importiert statisch nur leichte Teile (kein Planer, kein ts-fsrs)', () => {
    const api = moduleFiles.find((f) => f.rel === `${MODULE}/api.ts`)!;
    const statics = [...api.text.matchAll(/^import\s+(type\s+)?[^;]*?from\s*'([^']+)'/gm)].filter((m) => !m[1]).map((m) => m[2]);
    expect(statics.sort()).toEqual(['./data/lex', './data/schemas', './domain/dupes', './domain/ladder', './domain/types', './shared'].sort());
    // Auch nachgezogen (statische Importe und `export … from`, ohne `import type`): kein Planer, keine Runde, kein ts-fsrs.
    const byRel = new Map(moduleFiles.map((f) => [f.rel.replace(/\.tsx?$/, ''), f.text]));
    const seen = new Set<string>();
    const stack = [`${MODULE}/api`];
    while (stack.length) {
      const cur = stack.pop()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      const text = byRel.get(cur);
      if (!text) continue;
      for (const m of text.matchAll(/^(?:import|export)\s+(type\s+)?[^;]*?from\s*'([^']+)'/gm)) {
        if (m[1]) continue;
        const spec = m[2]!;
        if (!spec.startsWith('.')) {
          expect(spec, `${cur} zieht ${spec}`).not.toBe('ts-fsrs');
          continue;
        }
        stack.push(resolveImport(`${cur}.ts`, spec)!);
      }
    }
    for (const heavy of ['domain/planner', 'domain/tracks', 'domain/session', 'domain/day', 'data/store', 'data/migrate']) expect(seen.has(`${MODULE}/${heavy}`), heavy).toBe(false);
  });
});
