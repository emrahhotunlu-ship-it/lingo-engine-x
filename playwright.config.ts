import { defineConfig } from '@playwright/test';

// Chromium ist in der Cloud-Umgebung vorinstalliert (/opt/pw-browsers).
// Die Tests laden den Produktions-Build aus dist/ (Standard: Mehr-Datei, `npm run build`; Rückfall Einzeldatei in `npm run verify:single`),
// ausgeliefert von tests/e2e/dist.ts. rueckweg.spec.ts lädt stattdessen den v86-Stand (scripts/v86-checkout.mjs).
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  workers: 4,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: { browserName: 'chromium', trace: 'retain-on-failure', timezoneId: 'Europe/Berlin', locale: 'de-DE' },
  projects: [
    { name: 'main', testIgnore: /perf\.spec\.ts$/ },
    { name: 'perf', testMatch: /perf\.spec\.ts$/, workers: 1, dependencies: ['main'] },
  ],
});
