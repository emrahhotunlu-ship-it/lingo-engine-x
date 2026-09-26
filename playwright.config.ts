import { defineConfig } from '@playwright/test';

// Chromium ist in der Cloud-Umgebung vorinstalliert (/opt/pw-browsers).
// Die Tests laden den Produktions-Build dist/index.html (siehe tests/e2e/fixtures.ts).
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  workers: 4,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: { browserName: 'chromium', trace: 'retain-on-failure', timezoneId: 'Europe/Berlin', locale: 'de-DE' },
});
