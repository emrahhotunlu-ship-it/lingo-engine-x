import { existsSync } from 'node:fs';
import { chromium, defineConfig } from '@playwright/test';

// Chromium ist in der Cloud-Umgebung vorinstalliert (/opt/pw-browsers).
// Die Tests laden den Produktions-Build dist/index.html (siehe tests/e2e/fixtures.ts).
// Passt die vorinstallierte Browser-Version nicht mehr zu @playwright/test (Umgebung aktualisiert),
// wird der vorinstallierte Chromium direkt genommen – nie `playwright install` (CLAUDE.md A8).
const PREINSTALLED = '/opt/pw-browsers/chromium';
const launchOptions = !existsSync(chromium.executablePath()) && existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {};

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  workers: 4,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: { browserName: 'chromium', trace: 'retain-on-failure', timezoneId: 'Europe/Berlin', locale: 'de-DE', launchOptions },
});
