import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, openSpeak, layoutProblems, screen } from './fixtures';
import { DAY, dump } from './trainerHelpers';

// Business-Suite (Phase 3, Plan §9.2): Refiner mit Bausteinen (Tipp und Ziffern), Kopieren mit
// Rückfall, Baukasten ohne Claude bis zu den Wendungen plus Drill, Präsentations-Coach.

const SHOTS = 'test-results/screens';
mkdirSync(SHOTS, { recursive: true });
type Doc = Record<string, unknown>;

async function openHub(page: Page): Promise<void> {
  await screen(page, 'today');
  // Business ist ein Bereich von „Sprechen“ (UX-Beratung Nr. 7), kein eigener Hub mehr.
  await openSpeak(page, 'business');
  await expect(page.getByTestId('biz-hub')).toBeVisible();
}

const MAIL = 'Dear Mr Walker,\n\nThe scanners come two weeks later because our supplier has problems. We must delay the training too.\n\nBest regards\nEmrah';

test('E-Mail-Refiner: Bausteine per Tipp und Ziffer, fertige Mail, Kopieren mit Rückfall, gespeichert', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors, external } = await boot(page, { migrated: true });
  await openHub(page);
  await page.getByTestId('biz-mail').click();
  await screen(page, 'mail');
  await page.getByTestId('mail-input').fill(MAIL);
  await page.getByTestId('mail-refine').click();
  const segs = page.getByTestId('mail-seg');
  await expect(segs.first()).toBeVisible();
  await expect(page.locator('[data-testid="mail-seg"][data-status="ok"]').first()).toBeVisible();
  const weak = page.locator('[data-testid="mail-seg"]:not([data-status="ok"])');
  await expect(weak).toHaveCount(2);
  // Tipp auf einen Baustein.
  await weak.nth(0).locator('[data-testid="tile"][data-opt="0"]').click();
  await expect(weak.nth(0).getByTestId('tile-slot')).toHaveAttribute('data-chosen', '0');
  // Ziffer 3 (= zweite Option) im zweiten Satz.
  await weak.nth(1).getByRole('group').focus();
  await page.keyboard.press('3');
  await expect(weak.nth(1).getByTestId('tile-slot')).toHaveAttribute('data-chosen', '1');
  expect(await layoutProblems(page)).toEqual([]);
  await page.screenshot({ path: `${SHOTS}/business-refiner-390.png`, fullPage: true });
  await page.getByTestId('mail-finish').click();
  await expect(page.getByTestId('mail-final')).toContainText('I wanted to let you know that');
  await expect(page.getByTestId('mail-final')).toContainText('Just a quick note:');
  await expect(page.getByTestId('mail-stats')).toContainText('2 Änderungen');
  // Zwischenablage gesperrt → markiert, Hinweis.
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true }));
  await page.getByTestId('mail-copy').click();
  await expect(page.getByTestId('mail-copy-manual')).toBeVisible();
  await expect.poll(async () => (((await dump(page))['biz/2026-09'] as { items: Doc[] }).items ?? []).filter((i) => i.kind === 'mail').length).toBe(2);
  const d = await dump(page);
  const item = (d['biz/2026-09'] as { items: Doc[] }).items.find((i) => i.kind === 'mail' && i.day === DAY)!;
  expect(item).toMatchObject({ changes: 2, recipient: 'client', intent: 'inform' });
  const e = (d[`log/${DAY}`] as { entries: Doc[] }).entries.find((x) => x.type === 'biz')!;
  expect(e).toMatchObject({ m: 'biz-mail', ctx: 'biz' });
  expect(((d['app/profile'] as Doc).act as Record<string, Doc>)[DAY]).toMatchObject({ biz: 1 });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Baukasten ohne Claude: bis zu den Wendungen, Mitnehmen, Drill mit 6 Fragen', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await openHub(page);
  await expect(page.getByTestId('biz-mail')).toBeDisabled();
  await expect(page.getByTestId('biz-pitch')).toBeDisabled();
  await page.getByTestId('biz-playbook').click();
  await screen(page, 'playbook');
  await expect(page.getByTestId('pb-card')).toHaveCount(4);
  await page.locator('[data-testid="pb-card"][data-id="decline"]').click();
  const firstOption = page.getByTestId('pb-option').first();
  const level1 = await firstOption.innerText();
  await firstOption.click();
  // Erst klicken, wenn die nächste Ebene steht (sonst trifft der Klick die ausblendende Ebene).
  await expect(firstOption).not.toHaveText(level1);
  await firstOption.click();
  await expect(page.getByTestId('pb-phrase')).toHaveCount(3);
  await expect(page.getByTestId('pb-adapt')).toHaveCount(0);
  const take = page.getByTestId('pb-phrase').first().getByTestId('take-chunk');
  await take.getByRole('button').click();
  await expect(take).toHaveAttribute('data-state', 'taken');
  const chunk = (await dump(page))['chunk/c-what-we-can-do-instead-is'] as Doc;
  expect(chunk).toMatchObject({ en: 'what we can do instead is', de: 'was wir stattdessen tun können, ist' });
  expect((chunk.src as Doc).kind).toBe('biz');
  // Esc geht eine Ebene zurück.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('pb-option')).toHaveCount(2);
  await page.getByTestId('drill-start').click();
  for (let i = 0; i < 6; i++) {
    await expect(page.getByTestId('drill-q')).toHaveAttribute('data-pos', String(i));
    await page.keyboard.press('1');
    await expect(page.getByTestId('drill-feedback')).toBeVisible();
    await page.getByTestId('drill-next').click();
  }
  await expect(page.getByTestId('drill-result')).toHaveAttribute('data-n', '6');
  await expect.poll(async () => (((await dump(page))['biz/2026-09'] as { items: Doc[] }).items ?? []).some((i) => i.kind === 'play' && i.day === DAY)).toBe(true);
  expect(errors).toEqual([]);
});

test('Präsentations-Coach: Folie → Sprechfassung → Versuch → Abdeckung und drei Schichten', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await openHub(page);
  await page.getByTestId('biz-pitch').click();
  await screen(page, 'pitch');
  await page.getByTestId('pitch-input').fill('Cloud archive for small businesses. Setup in one day. Retention rules built in.');
  await page.getByTestId('pitch-make').click();
  await expect(page.getByTestId('pitch-script')).toBeVisible();
  await expect(page.getByTestId('pitch-line')).toHaveCount(5);
  await expect(page.locator('[data-testid="pitch-line"][data-signpost]')).toHaveCount(3);
  await page.getByTestId('pitch-attempt').fill('We must explain the setup in one day for small businesses.');
  await page.getByTestId('pitch-submit').click();
  await expect(page.getByTestId('pitch-feedback')).toBeVisible();
  await expect(page.getByTestId('pitch-coverage')).toHaveAttribute('data-total', '3');
  await expect(page.getByTestId('pitch-coverage')).toHaveAttribute('data-covered', '2');
  await expect(page.getByTestId('an-upgraded')).toBeVisible();
  await expect(page.getByTestId('an-error')).toHaveCount(1);
  await expect.poll(async () => ((await dump(page))['app/radar'] as { events: Doc[] }).events.some((e) => e.s === 'b')).toBe(true);
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  expect(errors).toEqual([]);
});

test('Business-Übersicht · 1440px · hell · EN · axe', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page, { migrated: true, theme: 'light', lang: 'en' });
  await openHub(page);
  expect(await layoutProblems(page)).toEqual([]);
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  await page.screenshot({ path: `${SHOTS}/business-1440-light-en.png`, fullPage: true });
});
