import { expect, test, type Page } from '@playwright/test';
import { boot, openTab, screen } from './fixtures';
import { planPatch } from './trainerHelpers';
import { barAction } from './learnHelpers';
import { ankiPatch } from './wortschatzHelpers';

// Schwebefenster und Pille verdecken nie die Aktionsleiste oder die untere Reiterleiste; Mindestbreite;
// Querformat; Tastatur (niedrige Höhe blendet die Zeilen aus).

async function trainer(page: Page): Promise<void> {
  const { patch } = ankiPatch(3);
  await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(3), ...patch, 'app/decks': { v: 1, prefs: { mode: 'flip', dir: 'de-en', grades: 4 } } } } });
  await screen(page, 'today');
  await openTab(page, 'vocab');
  await page.getByTestId('ws-review').click();
  await screen(page, 'trainer');
  await expect(page.getByTestId('flip')).toBeVisible();
}

async function settled(page: Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector<HTMLElement>('[data-testid="companion"]');
    return !!el && getComputedStyle(el).transform === 'none' && el.getAnimations().length === 0;
  });
  await page.waitForTimeout(150);
}

/** Überlappt das Fenster eine der Leisten (Aktionsleiste, untere Reiterleiste)? */
async function overlap(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const w = document.querySelector('[data-testid="companion"]')?.getBoundingClientRect();
    if (!w) return ['kein Fenster'];
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('[data-testid="actionbar"], .dz-tabbar')) {
      const r = el.getBoundingClientRect();
      if (r.height < 8 || r.top < window.innerHeight * 0.4) continue;
      const hit = !(w.right <= r.left || w.left >= r.right || w.bottom <= r.top + 1 || w.top >= r.bottom);
      if (hit) out.push(`${el.getAttribute('data-testid') ?? el.className}: Fenster ${Math.round(w.top)}-${Math.round(w.bottom)} / Leiste ab ${Math.round(r.top)}`);
    }
    return out;
  });
}

for (const vp of [
  { width: 1440, height: 900 },
  { width: 2560, height: 1440 },
]) {
  test.describe(`Desktop ${vp.width}`, () => {
    test.use({ viewport: vp });
    test('Fenster und Pille verdecken die Aktionsleiste nicht', async ({ page }) => {
      await trainer(page);
      await barAction(page, 'open-companion');
      await settled(page);
      expect(await overlap(page)).toEqual([]);
      await page.getByTestId('companion-min').click();
      await settled(page);
      expect(await overlap(page)).toEqual([]);
    });
  });
}

test.describe('Handy 390', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('Fenster über der Leiste, Pille oben rechts unter den Kopf-Symbolen, eigenes Symbol zum Wiederherstellen', async ({ page }) => {
    await trainer(page);
    await barAction(page, 'open-companion', 'tap');
    await settled(page);
    expect(await overlap(page)).toEqual([]);
    // Kopfzeile: nichts bricht ab, Schließen ganz sichtbar.
    const close = await page.getByTestId('companion-close').boundingBox();
    expect((close?.x ?? 0) + (close?.width ?? 0)).toBeLessThanOrEqual(390);
    const foot = await page.getByTestId('companion-foot').boundingBox();
    expect(foot?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expect(page.getByTestId('companion-grab')).toBeVisible();
    const minIcon = await page.getByTestId('companion-min').innerHTML();
    await page.getByTestId('companion-min').tap();
    await settled(page);
    const pill = await page.getByTestId('companion').boundingBox();
    expect(pill?.y ?? 9999).toBeLessThan(160);
    expect((pill?.x ?? 0) + (pill?.width ?? 0)).toBeLessThanOrEqual(390);
    expect(await overlap(page)).toEqual([]);
    const restoreIcon = await page.getByTestId('companion-min').innerHTML();
    expect(restoreIcon).not.toBe(minIcon);
    // „Vollbild“ und „Wiederherstellen“ sind verschiedene Symbole.
    await page.getByTestId('companion-min').tap();
    await settled(page);
    const fullIcon = await page.getByTestId('companion-mode').innerHTML();
    expect(fullIcon).not.toBe(restoreIcon);
  });
});

test.describe('Handy quer 844x390', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  test('gilt als Handy: Fenster rechts, vollständig im Bild, Verlauf mindestens 120 px', async ({ page }) => {
    await boot(page, { migrated: true });
    await screen(page, 'today');
    await page.getByTestId('open-companion').tap();
    await settled(page);
    const b = await page.getByTestId('companion').boundingBox();
    expect(b?.width ?? 0).toBeGreaterThanOrEqual(340);
    expect((b?.x ?? 0) + (b?.width ?? 0)).toBeLessThanOrEqual(845);
    expect((b?.y ?? 0) + (b?.height ?? 0)).toBeLessThanOrEqual(391);
    await expect(page.getByTestId('companion-sub')).toBeHidden();
    await expect(page.getByTestId('companion')).toHaveAttribute('data-phone', '');
    await page.getByTestId('companion-tab-chat').tap();
    const log = await page.getByTestId('chat-log').boundingBox();
    expect(log?.height ?? 0).toBeGreaterThanOrEqual(120);
  });
});

test.describe('Schmal 340', () => {
  test.use({ viewport: { width: 340, height: 700 } });
  test('Kopfzeile bricht nichts ab, sieht-gerade-Zeile und Schnell/Gründlich stehen untereinander', async ({ page }) => {
    await boot(page, { migrated: true });
    await screen(page, 'today');
    await page.getByTestId('open-companion').click();
    await settled(page);
    const win = await page.getByTestId('companion').boundingBox();
    const close = await page.getByTestId('companion-close').boundingBox();
    expect((close?.x ?? 0) + (close?.width ?? 0)).toBeLessThanOrEqual((win?.x ?? 0) + (win?.width ?? 0) + 1);
    await page.getByTestId('companion-tab-chat').click();
    const see = await page.getByTestId('seeing').boundingBox();
    const tier = await page.getByTestId('chat-tier-quick').boundingBox();
    if (see && tier) expect(tier.y).toBeGreaterThanOrEqual(see.y + see.height - 1);
  });
});
