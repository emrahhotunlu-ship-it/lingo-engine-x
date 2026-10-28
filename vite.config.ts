import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { execSync } from 'node:child_process';
import { rawJsonZip } from './scripts/vite-raw-json-zip.mjs';
import { contentStore } from './scripts/content/vite-plugin.mjs';
import { bootFirst } from './scripts/vite-boot-first.mjs';

// Versionskennung für die Diagnose (Emrah sieht, ob er den neuesten Stand offen hat).
const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
})();
const BUILD_ID = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} · ${commit}`;

// Zwei Bauweisen (Umschaltung per Umgebungsvariable LX_BUILD, siehe docs/umbau/mehr-datei.md, Relaunch-Entscheidung 1):
//  - multi (STANDARD seit Stufe 1, `npm run build`): dist/index.html + flache Zusatzdateien (JS-Chunks, CSS, Schriften, Inhalts-Bündel)
//    und das Vite-Manifest dist/.vite/manifest.json (nur Bau-Metadaten für scripts/check-budget.mjs, wird nie veröffentlicht).
//  - single (Rückfall, `npm run build:single` = LX_BUILD=single): genau eine selbstständige dist/index.html (Kap. 3.1).
// Der Dev-Server bleibt bei eingebetteten Inhalten (die .bin-Dateien entstehen erst beim Bauen).
const multiFor = (command: string): boolean => command === 'build' && process.env.LX_BUILD !== 'single';

// Der Entwicklungs-Adapter ist nur im Dev-Server aktiv (import.meta.env.DEV)
// und wird im Build als toter Zweig entfernt; scripts/check-platform.mjs prüft das.
export default defineConfig(({ command }) => {
  const MULTI = multiFor(command);
  return {
    define: { __LX_BUILD__: JSON.stringify(BUILD_ID) },
    // bootFirst (U2) steht NACH viteSingleFile: es schiebt das eingebettete Skript hinter das Start-Bild (scripts/vite-boot-first.mjs).
    plugins: [contentStore({ multi: MULTI }), rawJsonZip(), react(), tailwindcss(), ...(MULTI ? [] : [viteSingleFile({ removeViteModuleLoader: true }), bootFirst()])],
    build: {
      target: ['es2022', 'safari16'],
      outDir: 'dist',
      emptyOutDir: true,
      // single: alles inline. multi: nur Kleinkram inline, Schriften/Bilder werden eigene Dateien.
      assetsInlineLimit: MULTI ? 4096 : 100_000_000,
      cssCodeSplit: false,
      // multi: Manifest (Einstieg, Stücke, Importe) für das Budget-Tor (scripts/check-budget.mjs, P0 S1-TOR).
      manifest: MULTI,
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
  };
});
