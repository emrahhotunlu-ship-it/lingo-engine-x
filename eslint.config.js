import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

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
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/platform/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: "MemberExpression[property.name='claude']", message: 'claude.use nur in src/platform (Kap. 3.3).' },
        { selector: "Identifier[name='localStorage']", message: 'localStorage nur über src/platform/storage.ts.' },
        { selector: "Identifier[name='sessionStorage']", message: 'sessionStorage nur über src/platform/storage.ts.' },
      ],
    },
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
