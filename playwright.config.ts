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
  // `PW_CHROMIUM` (optional): fester Browser-Pfad, wenn die vorinstallierte Chromium-Version nicht zur festgelegten Playwright-Version passt
  // (Cloud-Umgebung 31.10.2026: /opt/pw-browsers/chromium). Ohne die Variable bleibt alles wie bisher.
  use: { browserName: 'chromium', trace: 'retain-on-failure', timezoneId: 'Europe/Berlin', locale: 'de-DE', ...(process.env.PW_CHROMIUM ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } } : {}) },
  projects: [
    { name: 'main', testIgnore: /perf\.spec\.ts$/ },
    { name: 'perf', testMatch: /perf\.spec\.ts$/, workers: 1, dependencies: ['main'] },
  ],
});
