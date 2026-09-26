import { expect, test } from '@playwright/test';
import { boot, layoutProblems } from './fixtures';
import { DAY, activeSubscriptions, answerAll, dump, entriesOf, openModule } from './inputHelpers';

// Entdecken (Kap. 6.9, Plan §4.4, §8.3): Liste „Neu"/„Erledigt", Artikel in vier Schritten,
// Video/Podcast in drei ohne Zitat und ohne Fragen, sichere Links, `disc` im Altformat,
// Beiträge des Tagesauftrags werden nie verändert, das Feed-Abo endet beim Verlassen.

test('Entdecken: Artikel in vier Schritten, Schreibwege, Feed unverändert, Abo beendet', async ({ page }) => {
  test.setTimeout(90_000);
  const { errors, external } = await boot(page, { migrated: true });
  const before = await dump(page);
  const baseSubs = await activeSubscriptions(page);
  await openModule(page, 'discover');
  await expect(page.getByTestId('feed-list')).toBeVisible();
  expect(await activeSubscriptions(page)).toBe(baseSubs + 1);
  expect(await layoutProblems(page)).toEqual([]);

  // Erledigt ist Zustand ohne Knopf.
  const done = page.locator('[data-testid="feed-item"][data-state="done"]');
  await expect(done).toHaveCount(2);
  for (const el of await done.all()) {
    expect(await el.evaluate((n) => n.tagName)).not.toBe('BUTTON');
    await expect(el.locator('button, a')).toHaveCount(0);
  }
  await expect(page.locator('[data-testid="feed-item"][data-id="own-sales-2609"]')).toContainText('Selbst hinzugefügt');

  await page.locator('[data-testid="feed-item"][data-id="vida-ey"]').click();
  const unit = page.getByTestId('unit');
  await expect(unit).toHaveAttribute('data-state', 'prep');
  await expect(page.getByTestId('step')).toHaveCount(4);
  await expect(page.getByTestId('chunk-row')).toHaveCount(8);
  await page.getByTestId('next').click();

  await expect(unit).toHaveAttribute('data-state', 'take');
  await expect(page.locator('[data-testid="step"][data-step="prep"]')).toHaveAttribute('data-state', 'done');
  await expect(page.locator('[data-testid="step"][data-state="done"] button')).toHaveCount(0);
  await expect(page.getByTestId('gist')).toBeVisible();
  await expect(page.getByTestId('excerpt')).toBeVisible();
  const link = page.getByTestId('source-link');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(link).toHaveAttribute('href', /^https:\/\//);
  await page.getByTestId('next').click();

  await expect(unit).toHaveAttribute('data-state', 'check');
  await answerAll(page, 4);

  await expect(unit).toHaveAttribute('data-state', 'use');
  const chips = page.getByTestId('task-chunk');
  await expect(chips).toHaveCount(3);
  await expect(chips.first()).toHaveAttribute('data-used', 'false');
  await page
    .getByTestId('draft')
    .fill('For our company, e-invoicing is not only a legal duty but also leverage for investment in better processes. Near real-time reporting will change how our customers work, and it is a fundamental shift in how data flows.');
  await expect(chips.first()).toHaveAttribute('data-used', 'true');
  await page.getByTestId('submit').click();
  await expect(unit).toHaveAttribute('data-state', 'done');
  await expect(page.getByTestId('discover-done')).toBeVisible();

  const db = await dump(page);
  const profile = db['app/profile'] as { disc: Record<string, Record<string, string>>; act: Record<string, Record<string, number>> };
  expect(profile.disc['vida-ey']).toEqual({ prep: DAY, take: DAY, check: DAY, use: DAY });
  expect(profile.disc['fed-hike-2609']).toEqual((before['app/profile'] as { disc: Record<string, unknown> }).disc['fed-hike-2609']);
  expect(profile.act[DAY]?.discover).toBe(1);
  const log = entriesOf(db).filter((e) => e.type === 'discover');
  expect(log).toHaveLength(4);
  expect(log[0]).toMatchObject({ ref: 'feed/2026-09-19#vida-ey', ctx: 'xtra', lang: 'de' });
  // Beiträge des Tagesauftrags: byte-gleich, nie geschrieben.
  for (const p of Object.keys(before).filter((k) => k.startsWith('feed/'))) expect(JSON.stringify(db[p])).toBe(JSON.stringify(before[p]));

  // Verlassen: das Feed-Abo ist beendet.
  await page.getByTestId('unit-close').click();
  await page.locator('[data-screen="discover"]').waitFor();
  await page.getByTestId('unit-close').click();
  await page.locator('[data-screen="today"]').waitFor();
  await expect.poll(() => activeSubscriptions(page)).toBe(baseSubs);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Entdecken: Video in drei Schritten ohne Zitat und ohne Fragen; ungültiger Link wird nicht verlinkt', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page, { migrated: true, lang: 'en' });
  await openModule(page, 'discover');
  await page.locator('[data-testid="feed-item"][data-id="infoq-arch"]').click();
  await expect(page.getByTestId('step')).toHaveCount(3);
  await expect(page.locator('[data-testid="step"][data-step="check"]')).toHaveCount(0);
  await page.getByTestId('next').click();
  await expect(page.getByTestId('guide')).toBeVisible();
  await expect(page.getByTestId('excerpt')).toHaveCount(0);
  await expect(page.getByTestId('question')).toHaveCount(0);
  await page.getByTestId('next').click();
  await expect(page.getByTestId('unit')).toHaveAttribute('data-state', 'use');
  await expect(page.getByTestId('question')).toHaveCount(0);
  const db = await dump(page);
  expect((db['app/profile'] as { disc: Record<string, Record<string, string>> }).disc['infoq-arch']).toEqual({ prep: DAY, take: DAY });

  // Selbst hinzugefügter Beitrag mit javascript:-Link: kein Link.
  await page.getByTestId('unit-close').click();
  await page.locator('[data-testid="feed-item"][data-id="own-bad-link"]').click();
  await page.getByTestId('next').click();
  await expect(page.getByTestId('gist')).toBeVisible();
  await expect(page.getByTestId('source-link')).toHaveCount(0);
});

test('Entdecken: Wiedereinstieg im ersten offenen Schritt, erledigte Schritte sind Zustand', async ({ page }) => {
  await boot(page, { migrated: true });
  await openModule(page, 'discover');
  await page.locator('[data-testid="feed-item"][data-id="ai-safety-2609"]').click();
  await expect(page.getByTestId('unit')).toHaveAttribute('data-state', 'check');
  await expect(page.locator('[data-testid="step"][data-step="prep"]')).toHaveAttribute('data-state', 'done');
  await expect(page.locator('[data-testid="step"][data-step="take"]')).toHaveAttribute('data-state', 'done');
  await expect(page.locator('[data-testid="step"][data-step="check"]')).toHaveAttribute('data-state', 'current');
});
