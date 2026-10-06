import type { Page } from '@playwright/test';
import type { InputProfile } from '../../src/platform/input';

// Setzt den Testschalter `window.__LINGO_INPUT__` (Lernplattform 2.0 §4.1) vor dem Start der Seite.
// Die Einstellung `lx:input` hat Vorrang vor ihm; der Entwicklungs-Adapter wird dafür nicht geändert.
export async function setInputProfile(page: Page, profile: InputProfile): Promise<void> {
  await page.addInitScript((p: InputProfile) => {
    window.__LINGO_INPUT__ = p;
  }, profile);
}
