import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { contentStore } from '../../../scripts/content/vite-plugin.mjs';
import { rawJsonZip } from '../../../scripts/vite-raw-json-zip.mjs';

// Baut den Leser-Prüfstand (tests/e2e/readHarness/index.html) als eine HTML-Datei nach test-results/read-harness. Wie vite.config.ts,
// aber mit anderem Einstieg; nie Teil von dist/. Aufruf aus der Spec: `build({ configFile })`.
export default defineConfig({
  define: { __LX_BUILD__: JSON.stringify('read-harness') },
  plugins: [contentStore({ multi: false }), rawJsonZip(), react(), tailwindcss(), viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    target: ['es2022', 'safari16'],
    outDir: 'test-results/read-harness',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    reportCompressedSize: false,
    modulePreload: false,
    rollupOptions: { input: 'tests/e2e/readHarness/index.html' },
  },
  base: '/',
});
