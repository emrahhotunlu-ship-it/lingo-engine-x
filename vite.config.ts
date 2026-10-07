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

// Zwei Bauweisen (Umschaltung per Umgebungsvariable LX_BUILD, siehe docs/umbau/mehr-datei.md):
//  - single (Standard, Rückfall): genau eine selbstständige dist/index.html (Kap. 3.1).
//  - multi (LX_BUILD=multi): dist/index.html + flache Zusatzdateien (JS-Chunks, CSS, Schriften, Inhalts-Bündel).
const MULTI = process.env.LX_BUILD === 'multi';

// Produktions-Build: single = genau eine selbstständige dist/index.html (Kap. 3.1).
// Der Entwicklungs-Adapter ist nur im Dev-Server aktiv (import.meta.env.DEV)
// und wird im Build als toter Zweig entfernt; scripts/check-platform.mjs prüft das.
export default defineConfig({
  define: { __LX_BUILD__: JSON.stringify(BUILD_ID) },
  plugins: [contentStore({ multi: MULTI }), rawJsonZip(), react(), tailwindcss(), ...(MULTI ? [] : [viteSingleFile({ removeViteModuleLoader: true })])],
  build: {
    target: ['es2022', 'safari16'],
    outDir: 'dist',
    emptyOutDir: true,
    // single: alles inline. multi: nur Kleinkram inline, Schriften/Bilder werden eigene Dateien.
    assetsInlineLimit: MULTI ? 4096 : 100_000_000,
    cssCodeSplit: false,
    reportCompressedSize: false,
    modulePreload: false,
    // multi: FLACHE Pfade (kein assets/-Unterordner), relativ referenziert; der Artefakt-Host kennt nur flache Pfade.
    ...(MULTI
      ? {
          rollupOptions: {
            output: {
              entryFileNames: '[name]-[hash].js',
              chunkFileNames: '[name]-[hash].js',
              assetFileNames: '[name]-[hash][extname]',
            },
          },
        }
      : {}),
  },
  base: MULTI ? './' : '/',
});
