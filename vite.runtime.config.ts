import { defineConfig } from 'vite';

// Baut die nachgebildete claude.use-Laufzeit (Entwicklungs-Adapter) als eigenes
// Skript für die E2E-Tests. Sie wird per Playwright addInitScript in den
// Produktions-Build eingespielt und ist nie Teil von dist/index.html.
export default defineConfig({
  build: {
    outDir: 'tests/.runtime',
    emptyOutDir: true,
    minify: false,
    target: 'es2022',
    lib: {
      entry: 'src/platform/dev/inject.ts',
      formats: ['iife'],
      name: 'LingoFakeRuntime',
      fileName: () => 'fake-claude.js',
    },
  },
});
