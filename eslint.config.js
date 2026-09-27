import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const PLATFORM_SYNTAX = [
  { selector: "MemberExpression[property.name='claude']", message: 'claude.use nur in src/platform (Kap. 3.3).' },
  { selector: "Identifier[name='localStorage']", message: 'localStorage nur über src/platform/storage.ts.' },
  { selector: "Identifier[name='sessionStorage']", message: 'sessionStorage nur über src/platform/storage.ts.' },
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
const LAYOUT_OK = ['src/ui/Segmented.tsx', 'src/ui/Switch.tsx', 'src/ui/Sheet.tsx', 'src/engine/Tiles.tsx'];
/** Befristet: Listen-Flüge der Besitzer-Pakete (P3 Wortliste, P4 Entdecken, P5 Szenen/Bausteine). */
const LAYOUT_TEMP = [
  'src/features/vocab/list/VocabScreen.tsx',
  'src/features/speak/SceneCard.tsx',
  'src/features/business/TilePicker.tsx',
  'src/features/discover/DiscoverScreen.tsx',
  'src/features/discover/ItemScreen.tsx',
];
/** Befristet: `useToday()`/`usePending()` ohne Selektor (P1 stellt um). */
const STORE_TEMP = [
  'src/features/today/state.ts',
  'src/features/today/TodayScreen.tsx',
  'src/features/learn/ui.tsx',
  'src/features/say/SayScreen.tsx',
  'src/areas/heute.tsx',
  'src/areas/wortschatz.tsx',
];

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
    // Der Vertrag (contract/sample.d.ts, db.d.ts) verlangt Fehler als schlichte Objekte
    // `{code, message}`, nicht als Error – der Entwicklungs-Adapter bildet genau das nach.
    files: ['src/platform/dev/**/*.ts'],
    rules: {
      '@typescript-eslint/only-throw-error': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
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
