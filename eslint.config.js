import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/** Entwicklungs-Adapter und Testdaten gehören nie in den Build (Lernplattform 3.0 §10.4 P9): eine Musterkonstante für alle `src/**`-Blöcke. */
const DEV_PATTERN = {
  regex: '(^|/)(seed|platform/dev)(/|$)',
  message: 'Seed und Entwicklungs-Adapter nur in src/platform und Tests (Kap. 3.3, check:platform).',
};
const DEV_IMPORT_SYNTAX = {
  selector: "ImportExpression[source.value=/(^|\\/)(seed|platform\\/dev)(\\/|$)/]",
  message: 'Kein dynamisches import() von Seed oder Entwicklungs-Adapter (nur src/main.tsx).',
};
const PLATFORM_SYNTAX = [
  { selector: "MemberExpression[property.name='claude']", message: 'claude.use nur in src/platform (Kap. 3.3).' },
  { selector: "Identifier[name='localStorage']", message: 'localStorage nur über src/platform/storage.ts.' },
  DEV_IMPORT_SYNTAX,
  { selector: "Identifier[name='sessionStorage']", message: 'sessionStorage nur über src/platform/storage.ts.' },
  { selector: "CallExpression[callee.property.name='matchMedia'][arguments.0.value=/^\\(\\s*(any-)?pointer/]", message: 'Eingabeprofil nur über src/platform/input.ts (Lernplattform 2.0 §4.1).' },
  { selector: "Literal[value=/(^|[\\s\"'`])text-\\[/]", message: 'Keine freien Schriftgrößen (text-[…]); Schriftstufen aus den Tokens (Lernplattform 2.0 §7).' },
  { selector: 'TemplateElement[value.raw=/(^|[\\s])text-\\[/]', message: 'Keine freien Schriftgrößen (text-[…]); Schriftstufen aus den Tokens (Lernplattform 2.0 §7).' },
];
const LAYOUT_SYNTAX = [
  { selector: 'JSXAttribute[name.name=/^(layout|layoutId)$/]', message: 'Keine Layout-Animationen (layout/layoutId) – nur Deckkraft/Verschieben (leistung.md §4 Nr. 8).' },
];
const STORE_SYNTAX = [
  {
    selector: 'CallExpression[callee.name=/^(useLive|usePending|useNav|useSettings|useToday|useSession)$/][arguments.length=0]',
    message: 'Store-Hooks nur mit Selektor (leistung.md §4 Nr. 7), z. B. useNav((s) => s.go).',
  },
];
/** Dauerhaft erlaubte Layout-Animationen (architektur.md §3.3). */
// Reiterleiste: gleitende Pille per `layoutId` (Lernplattform 3.0 P54, wie im Umschalter).
const LAYOUT_OK = ['src/ui/Segmented.tsx', 'src/ui/Switch.tsx', 'src/ui/Sheet.tsx', 'src/engine/Tiles.tsx', 'src/app/shell/TabBar.tsx'];
/** Befristet: Listen-Flüge der Besitzer-Pakete (P3 Wortliste, P4 Entdecken, P5 Szenen/Bausteine). */
const LAYOUT_TEMP = ['src/features/vocab/list/VocabScreen.tsx', 'src/features/speak/SceneCard.tsx'];
/** Befristet: `useToday()`/`usePending()` ohne Selektor (P1 stellt um). */
const STORE_TEMP = [
  'src/features/today/state.ts',
  'src/features/today/TodayScreen.tsx',
  'src/features/learn/ui.tsx',
  'src/areas/heute.tsx',
  'src/areas/wortschatz.tsx',
];

/** Ordner der Bereiche, die der Umbau „Fokus Wörter und Grammatik“ gelöscht hat (Entfernungs-Audit, tests/unit/removalAudit.test.ts). */
const GONE_AREAS = 'input|read|listen|discover|write|business|pron|inbox|fluency|meeting|tones|say|compare';

export default defineConfig(
  {
    ignores: ['dist/**', 'tests/.runtime/**', 'node_modules/**', 'contract/**', 'test-results/**', 'playwright-report/**', '.claude/worktrees/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser },
    },
    rules: {
      // Kap. 3 / 12: keine leeren catch-Blöcke, kein any
      'no-empty': ['error', { allowEmptyCatch: false }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat.recommended,
  },
  {
    // Kap. 3.3: Nur /src/platform spricht mit der Artefakt-Laufzeit und dem Browser-Speicher.
    // Neubau (plan.md §4.1 WP0a Nr. 7, leistung.md §4 Nr. 7/8): keine Layout-Animationen und
    // Store-Hooks nur mit Selektor.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/platform/**'],
    rules: { 'no-restricted-syntax': ['error', ...PLATFORM_SYNTAX, ...LAYOUT_SYNTAX, ...STORE_SYNTAX] },
  },
  {
    // Erlaubte Layout-Animationen: Umschalter, Schalter, Blatt-Titel, Bausteine (architektur.md §3.3).
    // BEFRISTET (leistung.md §3 Nr. 6): Listen-Flüge, die ihre Besitzer-Pakete entfernen; der
    // Integrator streicht diese Ausnahmen am Schluss.
    files: [...LAYOUT_OK, ...LAYOUT_TEMP],
    rules: { 'no-restricted-syntax': ['error', ...PLATFORM_SYNTAX, ...STORE_SYNTAX] },
  },
  {
    // BEFRISTET: abgeleitete Heute-Daten (`useToday()`, `usePending()`) ohne Selektor, bis P1 sie
    // einmal im Store berechnet (leistung.md §3 Nr. 5, §4 Nr. 7).
    files: STORE_TEMP,
    rules: { 'no-restricted-syntax': ['error', ...PLATFORM_SYNTAX, ...LAYOUT_SYNTAX] },
  },
  {
    // src/main.tsx lädt den Entwicklungs-Adapter im Dev-Server dynamisch (toter Zweig im Build, check:platform prüft das).
    files: ['src/main.tsx'],
    rules: { 'no-restricted-syntax': ['error', ...PLATFORM_SYNTAX.filter((r) => r !== DEV_IMPORT_SYNTAX), ...LAYOUT_SYNTAX, ...STORE_SYNTAX] },
  },
  {
    // Der Vertrag (contract/sample.d.ts, db.d.ts) verlangt Fehler als schlichte Objekte
    // `{code, message}`, nicht als Error – der Entwicklungs-Adapter bildet genau das nach.
    files: ['src/platform/dev/**/*.ts'],
    rules: {
      '@typescript-eslint/only-throw-error': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
    },
  },
  {
    // Entfernungs-Audit: Importe aus den gelöschten Bereichen sind verboten (sonst käme der Code unbemerkt zurück).
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ regex: `/(features|domain)/(${GONE_AREAS})(/|$)`, message: 'Dieser Bereich wurde im Umbau „Fokus Wörter und Grammatik“ gelöscht (docs/umbau/gesamtkonzept.md Kap. 6).' }] },
      ],
    },
  },
  {
    // Eine Quelle je Zahl (Gesamtkonzept Kap. 6, tests/unit/archGuards.test.ts): Karten und Serie nur über `domain/metrics`.
    // (Die Umstellung der alten App rechnet die alte Serie bewusst selbst.) Wiederholt das Entfernungs-Audit, weil `no-restricted-imports` je Datei nur einmal gilt.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/domain/metrics/**', 'src/domain/migration/**', 'src/platform/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { regex: `/(features|domain)/(${GONE_AREAS})(/|$)`, message: 'Dieser Bereich wurde im Umbau „Fokus Wörter und Grammatik“ gelöscht (docs/umbau/gesamtkonzept.md Kap. 6).' },
            { regex: '(^|/)srs/cards$', importNames: ['buildTrainCards'], message: 'Karten nur über domain/metrics (eine Quelle je Zahl).' },
            { regex: '(^|/)streak$', importNames: ['computeStreak'], message: 'Serie nur über domain/metrics (streak, streakWeek).' },
            DEV_PATTERN,
          ],
        },
      ],
    },
  },
  {
    // Dieselbe Regel für die beiden Ordner, die die Block oben auslässt (metrics, migration), mit Seed-/Adapter-Sperre.
    files: ['src/domain/metrics/**/*.{ts,tsx}', 'src/domain/migration/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ regex: `/(features|domain)/(${GONE_AREAS})(/|$)`, message: 'Dieser Bereich wurde im Umbau „Fokus Wörter und Grammatik“ gelöscht (docs/umbau/gesamtkonzept.md Kap. 6).' }, DEV_PATTERN] },
      ],
    },
  },
  {
    // Kein Netzzugriff aus dem Code (K-3, check:platform): `fetch` ist überall in src verboten (auch `window.fetch`, `globalThis.fetch`).
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': ['error', { name: 'fetch', message: 'Kein fetch (Artefakt-Regel, Kap. 3.1); gepackte Inhalte über src/content/store.' }],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'fetch', message: 'Kein fetch (Artefakt-Regel, Kap. 3.1).' },
        { object: 'globalThis', property: 'fetch', message: 'Kein fetch (Artefakt-Regel, Kap. 3.1).' },
        { object: 'self', property: 'fetch', message: 'Kein fetch (Artefakt-Regel, Kap. 3.1).' },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: { ...globals.node },
    },
    // Kommandozeilen-Skripte melden ihr Ergebnis auf der Konsole.
    rules: { ...tseslint.configs.disableTypeChecked.rules, 'no-console': 'off' },
  },
  {
    files: ['tests/**/*.ts', '*.config.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
