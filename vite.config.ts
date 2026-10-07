import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { execSync } from 'node:child_process';
import { rawJsonZip } from './scripts/vite-raw-json-zip.mjs';
import { contentStore } from './scripts/content/vite-plugin.mjs';

// Versionskennung für die Diagnose (Emrah sieht, ob er den neuesten Stand offen hat).
const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
})();
const BUILD_ID = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} · ${commit}`;

// Produktions-Build: genau eine selbstständige dist/index.html (Kap. 3.1).
// Der Entwicklungs-Adapter ist nur im Dev-Server aktiv (import.meta.env.DEV)
// und wird im Build als toter Zweig entfernt; scripts/check-platform.mjs prüft das.
export default defineConfig({
  define: { __LX_BUILD__: JSON.stringify(BUILD_ID) },
  plugins: [contentStore(), rawJsonZip(), react(), tailwindcss(), viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    target: ['es2022', 'safari16'],
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    reportCompressedSize: false,
    modulePreload: false,
  },
});
