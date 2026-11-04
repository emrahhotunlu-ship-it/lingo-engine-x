import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
import { TUE_9 } from './heuteHelpers';
import { retypeIfAsked } from './learnHelpers';
import { dump } from './trainerHelpers';

// TEMPORÄR (nicht einchecken): Vorher-/Nachher-Bilder für K4, K11, K14 (docs/review/k-rest-2026-11-04/).
const TAG = process.env.SHOT_TAG ?? 'vorher';
const DIR = process.env.SHOT_DIR ?? 'test-results/k-rest';
const BASE = Date.parse(TUE_9);

async function start(page: Page) {
  await boot(page, { migrated: true, vocabAuto: true, grammarNew: true, now: TUE_9, theme: 'dark', fake: { capabilities: { sample: false } } });
  await screen(page, 'today');
  await expect.poll(async () => ((await dump(page))['app/profile']?.vcfg as { mod?: number } | undefined)?.mod, { timeout: 20_000 }).toBe(1);
  await page.waitForTimeout(5500);
}

async function answer(page: Page, i: number, wrong: boolean) {
  await page.clock.setFixedTime(new Date(BASE + (i + 1) * 60_000));
  const go = page.getByTestId('vm-intro-go');
  const check = page.getByTestId('vm-check');
  await expect(check.or(go).first()).toBeVisible();
  if (await go.isVisible()) {
    await go.click();
    return;
  }
  if ((await check.textContent()) === 'Aufdecken') await check.click();
  else if (wrong) await page.getByTestId('vm-dunno').click();
  else await page.getByTestId('vm-dunno').click();
  await retypeIfAsked(page);
  await page.getByTestId('vm-next').click();
}

for (const w of [390, 1440, 2560]) {
  test(`K14/K11 Heute ${w}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: w, height: w === 390 ? 844 : w === 1440 ? 900 : 1440 });
    await start(page);
    if (w === 2560) await page.screenshot({ path: `${DIR}/${TAG}-k14-heute-2560.png` });
    await page.getByTestId('start').click();
    await screen(page, 'vlearn');
    const sg = page.getByTestId('vm-start-go');
    await expect(sg.or(page.getByTestId('vm-check')).or(page.getByTestId('vm-intro-go')).first()).toBeVisible();
    if (await sg.isVisible().catch(() => false)) await sg.click();
    let shotCard = false;
    for (let i = 0; i < 8; i++) {
      await answer(page, i, true);
      if (!shotCard && w !== 2560 && (await page.getByTestId('vm-check').isVisible()) && (await page.getByTestId('status').isVisible())) {
        const t = (await page.getByTestId('status').innerText()).replace(/\s+/g, ' ');
        if (i >= 2) {
          await page.screenshot({ path: `${DIR}/${TAG}-k4-wort-${w}.png` });
          shotCard = true;
          console.log('status', t);
        }
      }
    }
    console.log('progress', await page.getByTestId('vm-progress').first().getAttribute('aria-label').catch(() => null), await page.locator('.lx-kbar-count').first().innerText().catch(() => ''));
    await page.getByTestId('vm-close').click();
    await screen(page, 'today');
    await page.waitForTimeout(800);
    if (w === 1440) await page.screenshot({ path: `${DIR}/${TAG}-k11-heute-nach-runde-1440.png` });
    if (w === 390) await page.screenshot({ path: `${DIR}/${TAG}-k11-heute-nach-runde-390.png`, fullPage: true });
    console.log('heute', w, (await page.locator('[data-duty="review"]').first().innerText()).replace(/\s+/g, ' '));
  });
}
