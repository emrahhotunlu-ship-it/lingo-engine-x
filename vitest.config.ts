import { defineConfig } from 'vitest/config';
import { contentStore } from './scripts/content/vite-plugin.mjs';

export default defineConfig({
  plugins: [contentStore()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
