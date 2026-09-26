import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Produktions-Build: genau eine selbstständige dist/index.html (Kap. 3.1).
// Der Entwicklungs-Adapter ist nur im Dev-Server aktiv (import.meta.env.DEV)
// und wird im Build als toter Zweig entfernt; scripts/check-platform.mjs prüft das.
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile({ removeViteModuleLoader: true })],
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
