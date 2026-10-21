import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, screen } from './fixtures';
import { dump, forcedPatch, planPatch, TYPE_MODE } from './trainerHelpers';

// Mehrwort-Markierung (Emrahs Wunsch, 21.10.2026): mehrere Wörter eines Satzes als Wortgruppe nachschlagen. Laptop: Umschalt-Klick oder
// Ziehen mit der Maus; Handy: „Mehrere Wörter markieren“, dann das letzte Wort antippen. Bedeutung aus Wörterbuch/Karte oder von Claude
// (einmal, Tagesbremse), ohne Claude ehrlich mit den Einzelwörtern; „Als Karte merken“ legt genau eine Karte mit Ursprungssatz an.
// Satz der Übung: „Try to [avoid] driving in rush hour.“ – während der Frage ist „avoid“ die Lücke und nie Teil einer Gruppe.

type Calls = Array<{ id: string | null; tier: string; input: string }>;
const lookupCalls = async (page: Page): Promise<Calls> =>
  (await page.evaluate(() => [...(window as unknown as { __LINGO_FAKE__: { sampleCalls: Calls } }).__LINGO_FAKE__.sampleCalls])).filter((c) => c.id === 'word-lookup');

const avoid = () => ({ ...(forcedPatch()['vocab/avoid'] ?? {}), hist: [] });
const word = (page: Page, w: string) => page.getByTestId('sentence').locator(`button.lx-word[data-word="${w}"]`);
const SHOTS = process.env.LX_SHOTS_DIR ?? '';

async function startTrainer(page: Page, o: { sample?: boolean; localStorage?: Record<string, string> } = {}) {
  const booted = await boot(page, {
    migrated: true,
    ...(o.localStorage ? { localStorage: o.localStorage } : {}),
    fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), 'vocab/avoid': avoid() }, ...(o.sample === false ? { capabilities: { sample: false } } : {}) },
  });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  return booted;
}

async function drag(page: Page, from: string, to: string): Promise<void> {
  const a = await word(page, from).boundingBox();
  const b = await word(page, to).boundingBox();
  if (!a || !b) throw new Error('word box');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
  await page.mouse.up();
}

const axe = async (page: Page): Promise<string[]> =>
  (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);

test.describe('Mehrwort-Markierung Laptop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Umschalt-Klick: Wortgruppe aus dem Wörterbuch, beide Wörter markiert, Esc schließt zuerst das Fenster', async ({ page }) => {
    const { errors } = await startTrainer(page);
    await word(page, 'rush').click();
    await expect(page.getByTestId('lk-headword')).toHaveText('rush');
    await expect(page.getByTestId('lk-multi')).toBeVisible();
    await word(page, 'hour').click({ modifiers: ['Shift'] });
    const lk = page.getByTestId('lookup');
    // Das Einzelwort-Fenster blendet noch aus; geprüft wird das neue Fenster der Gruppe.
    const ph = page.getByRole('dialog', { name: 'Wortgruppe nachschlagen: rush hour' });
    await expect(ph.getByTestId('lk-phrase')).toBeVisible();
    await expect(ph.getByTestId('lk-headword')).toHaveText('rush hour');
    await expect(ph.getByTestId('lk-meaning')).toContainText('Hauptverkehrszeit');
    await expect(ph.getByTestId('ph-sentence')).toContainText('Try to ___ driving in rush hour.');
    await expect(ph.getByTestId('ph-sentence')).not.toContainText('avoid');
    await expect(lk).toHaveCount(1);
    await expect(word(page, 'rush')).toHaveAttribute('data-active', 'true');
    await expect(word(page, 'hour')).toHaveAttribute('data-active', 'true');
    await expect(word(page, 'driving')).not.toHaveAttribute('data-active', /.*/);
    // Aus dem Wörterbuch: keine Claude-Anfrage.
    expect(await lookupCalls(page)).toEqual([]);
    expect(await axe(page)).toEqual([]);
    if (SHOTS) {
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/wortgruppe-1440.png` });
    }
    // Aussprache der ganzen Gruppe.
    await ph.getByTestId('lk-listen').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { spoken: string[] } }).__LINGO_FAKE__.spoken)).toContain('rush hour');
    await page.keyboard.press('Escape');
    await expect(lk).toHaveCount(0);
    await expect(page.getByTestId('trainer')).toBeVisible();
    await expect(page.getByTestId('gap-input')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Ziehen mit der Maus: Claude erklärt im Zusammenhang (einmal, ohne Lösung), „Als Karte merken“ legt genau eine Karte an', async ({ page }) => {
    const { errors } = await startTrainer(page);
    const before = Object.keys(await dump(page)).filter((p) => p.startsWith('vocab/'));
    await drag(page, 'driving', 'hour');
    const lk = page.getByTestId('lookup');
    await expect(lk.getByTestId('lk-headword')).toHaveText('driving in rush hour');
    await expect(lk.getByTestId('lk-phrase')).toHaveAttribute('data-words', '4');
    await expect(lk.getByTestId('lk-sense')).toBeVisible();
    await expect(lk.getByTestId('lk-meaning')).not.toBeEmpty();
    const calls = await lookupCalls(page);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.tier).toBe('quick');
    expect(calls[0]?.input).toContain('driving in rush hour');
    expect(calls[0]?.input).not.toMatch(/\bavoid\b/i);
    // Tagesbremse gezählt.
    expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('lx:tutor-day') ?? '{}') as { n?: number })).toMatchObject({ n: 1 });
    await lk.getByTestId('lk-save').click();
    await expect(lk.getByTestId('lk-saved')).toBeVisible();
    await expect(lk.getByTestId('lk-save')).toHaveCount(0);
    await expect.poll(async () => Object.keys(await dump(page)).filter((p) => p.startsWith('vocab/') && !before.includes(p))).toHaveLength(1);
    const d = await dump(page);
    const added = Object.keys(d).filter((p) => p.startsWith('vocab/') && !before.includes(p));
    expect(d[added[0] ?? '']).toMatchObject({ word: 'driving in rush hour', src: 'lookup', state: 'new', ex: 'Try to avoid [driving in rush hour].', origin: { v: 1, kind: 'trainer', ref: 'vocab/avoid' } });
    // Noch einmal markieren: schon gespeichert, kein zweites Dokument.
    await page.keyboard.press('Escape');
    await drag(page, 'driving', 'hour');
    await expect(lk.getByTestId('lk-saved')).toBeVisible();
    await expect(lk.getByTestId('lk-save')).toHaveCount(0);
    expect(Object.keys(await dump(page)).filter((p) => p.startsWith('vocab/') && !before.includes(p))).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('ohne Claude: ehrlicher Hinweis und die Einzelwörter aus dem Wörterbuch, kein KI-Knopf', async ({ page }) => {
    const { errors } = await startTrainer(page, { sample: false });
    await drag(page, 'driving', 'in');
    const lk = page.getByTestId('lookup');
    await expect(lk.getByTestId('lk-headword')).toHaveText('driving in');
    await expect(lk.getByTestId('ph-words')).toHaveAttribute('data-reason', 'noai');
    await expect(lk.getByTestId('ph-word')).toHaveCount(2);
    await expect(lk.getByTestId('lk-ask')).toHaveCount(0);
    await expect(lk.getByTestId('lk-save')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Tagesbremse erreicht: keine Anfrage, Hinweis mit den Einzelwörtern', async ({ page }) => {
    await startTrainer(page, { localStorage: { 'lx:tutor-day': JSON.stringify({ d: '2026-09-20', n: 20 }) } });
    await drag(page, 'driving', 'in');
    await expect(page.getByTestId('lookup').getByTestId('ph-words')).toHaveAttribute('data-reason', 'limit');
    expect(await lookupCalls(page)).toEqual([]);
  });
});

test.describe('Mehrwort-Markierung Handy', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('„Mehrere Wörter markieren“, dann das letzte Wort antippen: Blatt mit der Wortgruppe; Abbrechen beendet die Auswahl', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true, fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), 'vocab/avoid': avoid() } } });
    await screen(page, 'today');
    await page.getByTestId('start').tap();
    await screen(page, 'trainer');
    // Abbrechen.
    await word(page, 'rush').tap();
    await page.getByTestId('lk-multi').tap();
    await expect(page.getByTestId('lookup')).toHaveCount(0);
    await expect(page.getByTestId('ph-pick')).toBeVisible();
    await expect(word(page, 'rush')).toHaveAttribute('data-anchor', 'true');
    const cancel = await page.getByTestId('ph-pick-cancel').boundingBox();
    expect(cancel?.height ?? 0).toBeGreaterThanOrEqual(44);
    await page.getByTestId('ph-pick-cancel').tap();
    await expect(page.getByTestId('ph-pick')).toHaveCount(0);
    await expect(word(page, 'rush')).not.toHaveAttribute('data-anchor', /.*/);
    // Auswahl: erstes Wort, dann letztes Wort.
    const top = await page.getByTestId('sentence').boundingBox();
    await word(page, 'driving').tap();
    await page.getByTestId('lk-multi').tap();
    await expect(page.getByTestId('ph-pick')).toBeVisible();
    // Kein Layoutsprung durch die Hinweisleiste.
    expect((await page.getByTestId('sentence').boundingBox())?.y).toBe(top?.y);
    expect(await axe(page)).toEqual([]);
    if (SHOTS) {
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SHOTS}/wortgruppe-auswahl-390.png` });
    }
    await word(page, 'hour').tap();
    const lk = page.getByTestId('lookup');
    await expect(lk).toHaveAttribute('aria-modal', 'true');
    await expect(lk.getByTestId('lk-headword')).toHaveText('driving in rush hour');
    await expect(page.getByTestId('ph-pick')).toHaveCount(0);
    await expect(lk.getByTestId('lk-sense')).toBeVisible();
    const box = await lk.boundingBox();
    expect(box && Math.round(box.y + box.height)).toBeGreaterThanOrEqual(840);
    expect(await layoutProblems(page)).toEqual([]);
    expect(await axe(page)).toEqual([]);
    if (SHOTS) {
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOTS}/wortgruppe-390.png` });
    }
    await lk.getByTestId('lk-close').tap();
    await expect(lk).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
