import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { boot, bootAt, layoutProblems, openLearnPage, openTab, screen } from './fixtures';
import { answerGrammar, grammarKey, nextItem } from './learnHelpers';
import { NO_GRAMMAR_ERRORS, profileWith, vgPlan } from './heuteHelpers';
import { DAY, dump, type Dump } from './trainerHelpers';

// Großpaket G5 (Schalter `gcfg.mod` an, wie bei Emrah): Grammatik-Reiter als EIN Themen-Weg (Als Nächstes / Sitzt schon) statt
// Kapitelliste plus zweiter Themenliste; Fehlersätze mit Überschrift an EINEM Ort (nicht zusätzlich unter Anwenden).
// Handy (390) und Desktop (1280).

const DUE = Date.parse('2026-09-19T12:00:00+02:00');
const A = { id: 'ra1', wrong: 'We are working on it since two years.', right: 'We have been working on it for two years.', why: 'Für eine Dauer bis jetzt: Present Perfect Continuous und „for“.', src: 'say', t: DUE - 86_400_000, box: 0, due: DUE };

const SIZES = [
  { name: 'Handy', width: 390, height: 844 },
  { name: 'Desktop', width: 1280, height: 900 },
] as const;

for (const size of SIZES) {
  test(`Neue Grammatik (${size.name}): ein Themen-Weg, Fehlersätze mit Überschrift, keine zweite Themenliste`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const { errors, external } = await boot(page, { migrated: true, grammarNew: true });
    await screen(page, 'today');
    await openLearnPage(page);
    const hub = page.getByTestId('learn-hub');
    await expect(hub.getByTestId('hub-next-start')).toBeVisible();
    const path = hub.getByTestId('gpath');
    await expect(path).toBeVisible();
    // „Als Nächstes“: höchstens drei Themen, nicht das aktuelle der Karte darüber (keine Wiederholung auf einem Bildschirm, Kap. 15).
    const next = path.getByTestId('gpath-next').getByTestId('gpath-topic');
    const n = await next.count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(3);
    const current = await hub.getByTestId('hub-next-topic').getAttribute('data-topic');
    for (const id of await next.evaluateAll((els) => els.map((e) => e.getAttribute('data-topic')))) expect(id).not.toBe(current);
    // Kein zweiter Themen-Katalog und keine Kapitelliste mehr auf der Wurzel.
    await expect(hub.getByTestId('hub-all-topics')).toHaveCount(0);
    await expect(hub.getByTestId('path-chapter')).toHaveCount(0);
    await expect(hub.getByTestId('hub-errors-head')).toBeVisible();
    await expect(hub.getByTestId('hub-errors-list').locator('[data-testid^="hub-errors"]')).toHaveCount(1);
    expect(await layoutProblems(page)).toEqual([]);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    // Ein Thema antippen öffnet sein Regelblatt.
    const first = await next.first().getAttribute('data-topic');
    await next.first().click();
    await expect(page.getByTestId('rule-sheet')).toHaveAttribute('data-topic', first ?? '');
    await page.keyboard.press('Escape');
    // Leiser Weg zu allen Kapiteln (die Reise).
    await hub.getByTestId('gpath-all').click();
    await screen(page, 'journey');
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}

test('Neue Grammatik: fällige Fehlersätze stehen nicht zusätzlich als Runde unter Anwenden', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const sunPlan = { ...vgPlan(DAY), duty: ['review', 'ch:u-check', 'ch:u-again'] };
  const { errors } = await boot(page, { migrated: true, grammarNew: true, fake: { patch: { ...NO_GRAMMAR_ERRORS, ...profileWith(DAY, sunPlan, ['u-again']), 'app/repair': { items: [A] } } } });
  await screen(page, 'today');
  await openTab(page, 'apply');
  await expect(page.getByTestId('apply-hub')).toBeVisible();
  await expect(page.getByTestId('hub-repair-round')).toHaveCount(0);
  expect(errors).toEqual([]);
});

type Doc = Record<string, unknown>;
const solve = grammarKey();
const gLog = (d: Dump): number => ((d[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => e.k === 'g').length;
const flags = (d: Dump): Doc[] => (d[`log/${DAY}`]?.flags as Doc[] | undefined) ?? [];

test('Neue Grammatik G6: „Aufgabe war unfair?“ sichtbar bei falsch – zählt nicht, Spur im Tagesprotokoll (flags)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'xtra' }, { grammarNew: true });
  await expect(page.getByTestId('gr-item')).toBeVisible();
  const before = await dump(page);
  await answerGrammar(page, solve, { wrong: true });
  const link = page.getByTestId('gm-unfair');
  await expect(link).toBeVisible();
  await link.click();
  // Das Melde-Blatt ist am Handy nur so hoch wie sein Inhalt (M14).
  const sheet = page.getByTestId('report-sheet');
  await expect(sheet).toBeVisible();
  const box = await page.getByRole('dialog').boundingBox();
  expect(box?.height ?? 999).toBeLessThan(844 * 0.7);
  await page.getByTestId('report-solution').click();
  await expect(page.getByText('Diese Aufgabe zählt nicht.')).toBeVisible();
  await expect(link).toHaveCount(0);
  await expect.poll(async () => flags(await dump(page)).length).toBe(1);
  const f = flags(await dump(page))[0]!;
  expect(f).toMatchObject({ id: expect.stringMatching(/^gr:/), r: 'solution', topic: expect.any(String), q: expect.any(String), ans: expect.any(String) });
  expect(f.c).toBeUndefined();
  await nextItem(page);
  await expect(page.getByTestId('gr-item')).toBeVisible();
  await page.waitForTimeout(600);
  expect(gLog(await dump(page))).toBe(gLog(before));
  expect(errors).toEqual([]);
});
