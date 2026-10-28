import { defineConfig } from 'vitest/config';
import { contentStore } from './scripts/content/vite-plugin.mjs';

// Die Unit-Tests rechnen in Berliner Zeit (Tageswechsel 04:00). Auch ein direkter Aufruf ohne `npm test` bekommt sie,
// sonst weichen zeitabhängige Tests (z. B. metricsGolden) still ab.
process.env.TZ = 'Europe/Berlin';

export default defineConfig({
  plugins: [contentStore()],
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/tutor/**/*.test.ts'],
    environment: 'node',
  },
});
