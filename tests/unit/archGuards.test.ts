import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Architektur-Wächter (Gesamtkonzept Kap. 6, eine Quelle je Zahl): Außerhalb von `src/domain/metrics` (und der Umstellung der alten App)
// darf niemand `buildTrainCards` oder `computeStreak` direkt aus ihren Ursprungsdateien holen, und niemand rechnet „fällig“ oder „Fest“
// selbst. Dieselben Regeln prüft ESLint (`no-restricted-imports`); dieser Test hält sie auch ohne Lint fest.

const ROOT = join(import.meta.dirname, '../../src');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const all = files(ROOT).map((p) => ({ rel: relative(ROOT, p).replaceAll('\\', '/'), text: readFileSync(p, 'utf8') }));
const outside = all.filter((f) => !f.rel.startsWith('domain/metrics/') && !f.rel.startsWith('domain/migration/'));

describe('Architektur: eine Quelle je Zahl', () => {
  it('buildTrainCards wird nur über domain/metrics importiert', () => {
    const bad = outside.filter((f) => /import\s*(type\s*)?\{[^}]*\bbuildTrainCards\b[^}]*\}\s*from\s*'[^']*srs\/cards'/.test(f.text) && f.rel !== 'domain/srs/cards.ts').map((f) => f.rel);
    expect(bad).toEqual([]);
  });

  it('computeStreak wird nur über domain/metrics aufgerufen (Umstellung ausgenommen)', () => {
    const bad = outside.filter((f) => /\bcomputeStreak\s*\(|\{[^}]*\bcomputeStreak\b[^}]*\}\s*from/.test(f.text) && f.rel !== 'domain/streak.ts').map((f) => f.rel);
    expect(bad).toEqual([]);
  });

  it('„fällig“ und „überfällig“ gegen die Lerntagsgrenze rechnet nur domain/metrics (Karten-Ebene)', () => {
    const bad = outside.filter((f) => /\.fsrs\.due\s*<\s*(learningDay(End|Start)|end\b|start\b)/.test(f.text)).map((f) => f.rel);
    expect(bad).toEqual([]);
  });

  it('„Fest“ (Stufe und 21 Tage) steht nur in domain/metrics', () => {
    const bad = outside.filter((f) => /stability\s*>=\s*(21|MATURE_DAYS|FEST_DAYS)/.test(f.text)).map((f) => f.rel);
    expect(bad).toEqual([]);
  });
});

// Relaunch Stufe 1 P5 S1-ZAHL (docs/relaunch/stufe1-plan.md §5.2), Nacharbeit: Erlaubnisliste statt Sperrliste. Die Namen aus
// `SCREEN_NUMBER_NAMES` dürfen nur in `src/domain/**` und in den Lernlogik-Dateien (`SCREEN_NUMBER_OK`) ankommen, egal auf welchem Weg:
// benannter Import, `import * as ns` mit `ns.name`, `export … from`, `export * from` und dynamisches `import()`. Die Lernlogik-Dateien
// reichen sie nicht weiter. Anzeige-Dateien holen dazu die rohen Zählfunktionen (`DISPLAY_RAW_NAMES`) nicht selbst. Die Listen stehen
// gleichlautend in eslint.config.js (eigener Test unten).
const SCREEN_NUMBER_NAMES = ['minutesLeft', 'dutyMinutes', 'dutyChannelMinutes', 'dutyFills', 'newQuotaLeft', 'topicP'];
const SCREEN_NUMBER_OK = [
  'src/features/grammar/GrammarItem.tsx',
  'src/features/c1x/useC1Item.ts',
  'src/features/c1x/resolve.ts',
  'src/features/drills/session.ts',
  'src/features/grammar/generate.ts',
  'src/features/today/store.ts',
  'src/features/vocab/session.ts',
];
const DISPLAY_RAW_NAMES = ['dueErrors', 'cardStats', 'fixedStats', 'truthParts', 'newMilestones', 'topicsFest'];
const allowed = (rel: string): boolean => rel.startsWith('domain/') || SCREEN_NUMBER_OK.includes(`src/${rel}`);
const isDisplay = (rel: string): boolean =>
  ((rel.startsWith('features/') && /Screen\.tsx$/.test(rel)) ||
    rel.startsWith('features/progress/') ||
    rel.startsWith('features/vocab/hub/') ||
    rel.startsWith('ui/') ||
    rel.startsWith('features/today/') ||
    rel === 'features/grammar/PathList.tsx' ||
    rel === 'features/learn/ui.tsx') &&
  rel !== 'features/today/store.ts' &&
  rel !== 'features/today/state.ts';

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Quelltext ohne Kommentare (Zeilen- und Blockkommentare; `://` in Adressen bleibt stehen). */
const stripComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
/** Erster Name eines Import-/Export-Bausteins: `type a as b` → `a`, `a: b` (Destrukturierung) → `a`. */
const specNames = (list: string): string[] =>
  list
    .split(',')
    .map((x) => x.trim().replace(/^type\s+/, '').split(/\s+as\s+|\s*:\s*/)[0]?.trim() ?? '')
    .filter(Boolean);

/** Datei-Inhalt eines relativen Moduls (`.ts`, `.tsx`, `/index.ts`), sonst `null`. */
function resolveModule(fromRel: string, spec: string, byRel: Map<string, string>): string | null {
  if (!spec.startsWith('.')) return null;
  const base = join(fromRel, '..', spec).replaceAll('\\', '/');
  for (const c of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`, base]) {
    const hit = byRel.get(c);
    if (hit !== undefined) return hit;
  }
  return null;
}

/**
 * Welche der Namen erreichen die Datei? Erkennt benannte Importe und Re-Exporte, `import * as ns` mit Zugriff `ns.name` / `ns['name']`,
 * `export * from` (wenn das Zielmodul den Namen exportiert), dynamisches `import()` mit Destrukturierung, `.then(({ … }) =>` oder Zugriff.
 */
function reachedNames(text: string, rel: string, names: string[], byRel: Map<string, string>): string[] {
  const src = stripComments(text);
  const found = new Set<string>();
  const add = (list: string) => {
    for (const n of specNames(list)) if (names.includes(n)) found.add(n);
  };
  for (const m of src.matchAll(/\b(?:import|export)\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]/g)) add(m[1] ?? '');
  const nsBindings: string[] = [];
  for (const m of src.matchAll(/\bimport\s*(?:type\s*)?\*\s*as\s+([A-Za-z_$][\w$]*)\s+from/g)) nsBindings.push(m[1] ?? '');
  for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+import\s*\(/g)) nsBindings.push(m[1] ?? '');
  for (const m of src.matchAll(/\bimport\s*\([^)]*\)\s*\.then\(\s*\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>/g)) nsBindings.push(m[1] ?? '');
  for (const ns of nsBindings.filter(Boolean)) {
    for (const n of names) if (new RegExp(`\\b${esc(ns)}\\s*(?:\\?\\.|\\.)\\s*${n}\\b|\\b${esc(ns)}\\s*\\[\\s*['"\`]${n}['"\`]\\s*\\]`).test(src)) found.add(n);
  }
  for (const m of src.matchAll(/\{([^}]*)\}\s*=\s*await\s+import\s*\(/g)) add(m[1] ?? '');
  for (const m of src.matchAll(/\bimport\s*\([^)]*\)\s*\.then\(\s*\(\s*\{([^}]*)\}/g)) add(m[1] ?? '');
  for (const n of names) if (new RegExp(`\\(\\s*await\\s+import\\s*\\([^)]*\\)\\s*\\)\\s*(?:\\?\\.|\\.)\\s*${n}\\b`).test(src)) found.add(n);
  for (const m of src.matchAll(/\bexport\s*\*\s*(?:as\s+[\w$]+\s*)?from\s*['"]([^'"]+)['"]/g)) {
    const target = resolveModule(rel, m[1] ?? '', byRel);
    if (target === null) continue;
    for (const n of names) if (new RegExp(`\\bexport\\s+(?:async\\s+)?(?:function\\*?|const|let|class)\\s+${n}\\b|\\bexport\\s*\\{[^}]*\\b${n}\\b`).test(target)) found.add(n);
  }
  return [...found];
}

const byRel = new Map(all.map((f) => [f.rel, f.text]));

describe('Architektur: Anzeige-Zahlen nur aus domain/metrics (P5 S1-ZAHL)', () => {
  it('der Wächter erkennt jeden Importweg (Selbsttest an erfundenen Quelltexten)', () => {
    const fake = new Map([['domain/q.ts', 'export function topicP() {}\nexport const newQuotaLeft = 1;']]);
    const hit = (code: string) => reachedNames(code, 'features/x/A.tsx', SCREEN_NUMBER_NAMES, fake).sort();
    expect(hit("import { topicP } from '../../domain/q';")).toEqual(['topicP']);
    expect(hit("import { type topicP as P, newQuotaLeft as q } from '../../domain/q';")).toEqual(['newQuotaLeft', 'topicP']);
    expect(hit("import * as Q from '../../domain/q';\nconst a = Q.topicP();")).toEqual(['topicP']);
    expect(hit("import type * as Q from '../../domain/q';\ntype A = typeof Q.topicP;")).toEqual(['topicP']);
    expect(hit("import * as Q from '../../domain/q';\nconst a = Q['newQuotaLeft'];")).toEqual(['newQuotaLeft']);
    expect(hit("import * as Q from '../../domain/q';\nconst a = Q.other;")).toEqual([]);
    expect(hit("export { topicP } from '../../domain/q';")).toEqual(['topicP']);
    expect(hit("export * from '../../domain/q';")).toEqual(['newQuotaLeft', 'topicP']);
    expect(hit("const { topicP: p } = await import('../../domain/q');")).toEqual(['topicP']);
    expect(hit("const m = await import('../../domain/q');\nm.newQuotaLeft;")).toEqual(['newQuotaLeft']);
    expect(hit("void import('../../domain/q').then(({ topicP }) => topicP());")).toEqual(['topicP']);
    expect(hit("void import('../../domain/q').then((m) => m.topicP());")).toEqual(['topicP']);
    expect(hit("const a = (await import('../../domain/q')).newQuotaLeft;")).toEqual(['newQuotaLeft']);
    expect(hit("// import { topicP } from '../../domain/q';\n/* import * as Q from 'x'; Q.topicP */")).toEqual([]);
  });

  it('die Namen aus SCREEN_NUMBER_NAMES kommen nur in src/domain und den Lernlogik-Dateien an (Erlaubnisliste)', () => {
    for (const ok of SCREEN_NUMBER_OK) expect(byRel.has(ok.slice(4)), ok).toBe(true);
    const bad = all.filter((f) => !allowed(f.rel)).flatMap((f) => reachedNames(f.text, f.rel, SCREEN_NUMBER_NAMES, byRel).map((n) => `${f.rel}: ${n}`));
    expect(bad).toEqual([]);
  });

  it('die Lernlogik-Dateien reichen diese Namen nicht weiter (kein Umweg an der Erlaubnisliste vorbei)', () => {
    const bad = all
      .filter((f) => SCREEN_NUMBER_OK.includes(`src/${f.rel}`))
      .flatMap((f) => {
        const src = stripComments(f.text);
        const names = [...src.matchAll(/\bexport\s*(?:type\s*)?\{([^}]*)\}/g)].flatMap((m) => specNames(m[1] ?? ''));
        const star = /\bexport\s*\*/.test(src);
        return [...SCREEN_NUMBER_NAMES.filter((n) => names.includes(n)), ...(star ? ['export *'] : [])].map((n) => `${f.rel}: ${n}`);
      });
    expect(bad).toEqual([]);
  });

  it('Anzeige-Dateien (auch Heute, Grammatik-Lernweg, Lern-Bausteine) holen keine rohen Zählfunktionen', () => {
    const display = all.filter((f) => isDisplay(f.rel));
    expect(display.length).toBeGreaterThan(10);
    for (const rel of ['features/today/TodayScreen.tsx', 'features/today/StandSide.tsx', 'features/today/doneFacts.ts', 'features/today/ExtraRow.tsx', 'features/grammar/PathList.tsx', 'features/learn/ui.tsx']) expect(display.map((f) => f.rel), rel).toContain(rel);
    const bad = display.flatMap((f) => reachedNames(f.text, f.rel, DISPLAY_RAW_NAMES, byRel).map((n) => `${f.rel}: ${n}`));
    expect(bad).toEqual([]);
  });

  it('eslint.config.js sperrt dieselben Listen', () => {
    const cfg = readFileSync(join(import.meta.dirname, '../../eslint.config.js'), 'utf8');
    const list = (name: string): string[] => {
      const m = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`).exec(cfg);
      return m ? [...(m[1] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1] ?? '') : [];
    };
    expect(list('SCREEN_NUMBER_NAMES')).toEqual(SCREEN_NUMBER_NAMES);
    expect(list('SCREEN_NUMBER_OK')).toEqual(SCREEN_NUMBER_OK);
    expect(list('DISPLAY_RAW_NAMES')).toEqual(DISPLAY_RAW_NAMES);
  });

  it('die Ringfüllung (höchstens 95 % offen) steht nur in domain/metrics', () => {
    const bad = outside.filter((f) => /\bdutyFills\b|Math\.min\(\s*0\.95\s*,/.test(f.text)).map((f) => f.rel);
    expect(bad).toEqual([]);
  });

  it('domain/metrics bietet die Quellen an, die die Anzeige nutzt', () => {
    const index = all.find((f) => f.rel === 'domain/metrics/index.ts')?.text ?? '';
    for (const n of ['todaySummary', 'ringFills', 'newQuotaToday', 'topicShown', 'errorsDueByTopic', 'doneDay', 'overdueUnits', 'wrongToday']) expect(index).toMatch(new RegExp(`\\b${n}\\b`));
    expect(index).not.toMatch(/\bdayLeft\b/);
  });
});
