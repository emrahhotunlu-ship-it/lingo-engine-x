import { defineConfig } from 'vitest/config';
import { contentStore } from '../../content/vite-plugin.mjs';

// G1-Werkzeug (Großpaket G): läuft nur auf Zuruf, nie in `npm test`.
//   G1_MODE=export G1_OUT=<ordner> npx vitest run --config scripts/grammar/g1/vitest.config.mjs
//   G1_MODE=score  G1_OUT=<ordner> npx vitest run --config scripts/grammar/g1/vitest.config.mjs
process.env.TZ = 'Europe/Berlin';
export default defineConfig({
  root: new URL('../../..', import.meta.url).pathname,
  plugins: [contentStore()],
  test: { include: ['scripts/grammar/g1/*.g1.ts'], environment: 'node' },
});
