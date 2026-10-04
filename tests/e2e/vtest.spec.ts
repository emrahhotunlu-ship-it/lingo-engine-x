import { expect, test, type Page } from '@playwright/test';
import { boot } from './fixtures';
import { startVtest } from './profilHelpers';

// Phase 6 (Plan §8, §13): Wortschatztest per Tastatur und Touch; Ergebnis in profile.vtests,
// Wortschatzziel aktualisiert; Abbruch speichert nichts.

type Dump = Record<string, Record<string, unknown>>;
const dump = (page: Page) => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { dump(): Dump } } }).__LINGO_FAKE__.db.dump());

async function openTest(page: Page) {
  await startVtest(page);
}

test('Durchlauf per Tastatur: J/N, Ziffern, Enter; vtests ergänzt, Wortschatzziel neu', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { errors } = await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await openTest(page);
  const before = ((await dump(page))['app/profile']?.vtests as unknown[]).length;
  // Teil 1: echte Wörter der ersten 6 Bänder „kenne ich", alles andere nicht.
  const known = new Set(['listen', 'reason', 'carry', 'early', 'decide', 'enough', 'increase', 'whole', 'remember', 'church', 'shoulder', 'borrow', 'ordinary', 'hide', 'customer', 'weigh', 'proud', 'quiet', 'deny', 'anywhere']);
  for (let k = 0; k < 112; k++) {
    const w = (await page.getByTestId('vt-word').innerText()).trim();
    await page.keyboard.press(known.has(w) ? 'j' : 'n');
  }
  // Teil 2: Bedeutung per Ziffer, dann Enter.
  await expect(page.getByTestId('vtest')).toHaveAttribute('data-state', 'meaning');
  while ((await page.getByTestId('vtest').getAttribute('data-state')) === 'meaning') {
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
  }
  // Teil 3: Wort in die Lücke tippen, Enter prüft, Enter weiter.
  await expect(page.getByTestId('vtest')).toHaveAttribute('data-state', 'active');
  while ((await page.getByTestId('vtest').getAttribute('data-state')) === 'active') {
    await page.keyboard.type('x');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('vt-verdict')).toBeVisible();
    await page.keyboard.press('Enter');
  }
  await expect(page.getByTestId('vt-result')).toBeVisible();
  const passive = Number(await page.getByTestId('vt-result').getAttribute('data-passive'));
  expect(passive).toBeGreaterThan(0);
  const p = (await dump(page))['app/profile']!;
  const list = p.vtests as Array<Record<string, unknown>>;
  expect(list).toHaveLength(before + 1);
  expect(list.at(-1)).toMatchObject({ v: 'lx1', passive, faN: 12, pseudoN: 12, d: '2026-09-20' });
  expect((p.act as Record<string, Record<string, number>>)['2026-09-20']?.vtest).toBe(1);
  await page.getByTestId('vt-done').click();
  await expect(page.getByTestId('tab-path')).toHaveAttribute('aria-selected', 'true');
  expect(Number(await page.getByTestId('vocab-goal').getAttribute('data-now'))).toBeGreaterThanOrEqual(passive);
  expect(errors).toEqual([]);
});

test('Durchlauf per Touch am Handy', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'Europe/Berlin', locale: 'de-DE' });
  const page = await context.newPage();
  await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await openTest(page);
  for (let k = 0; k < 112; k++) await page.getByTestId(k % 3 === 0 ? 'vt-yes' : 'vt-no').tap();
  while ((await page.getByTestId('vtest').getAttribute('data-state')) === 'meaning') {
    await page.getByTestId('choice').first().tap();
    await page.getByTestId('vt-next').tap();
  }
  while ((await page.getByTestId('vtest').getAttribute('data-state')) === 'active') {
    await page.getByTestId('vt-check').tap();
    await page.getByTestId('vt-next').tap();
  }
  await expect(page.getByTestId('vt-result')).toBeVisible();
  await context.close();
});

test('Abbruch mit Rückfrage speichert nichts', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await openTest(page);
  const before = JSON.stringify((await dump(page))['app/profile']?.vtests);
  await page.getByTestId('vt-yes').click();
  await page.getByTestId('vt-cancel').click();
  await page.getByTestId('vt-resume').click();
  await expect(page.getByTestId('vt-word')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByTestId('vt-cancel-yes').click();
  await expect(page.getByTestId('vtest')).toHaveAttribute('data-state', 'cancelled');
  expect(JSON.stringify((await dump(page))['app/profile']?.vtests)).toBe(before);
});
