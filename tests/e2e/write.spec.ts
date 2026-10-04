import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { CANNED_WRITE_TEXT } from '../../src/platform/dev/cannedWrite';
import { boot, layoutProblems, NOW, placedProfile, type Theme } from './fixtures';

// Schreiben, Reparatur und Stolpersteine (Paket A) gegen den echten Produktions-Build.

const NOW_MS = Date.parse(NOW);
const DAY = 86_400_000;
/** Profil ohne neue Wörter: Die Einheit beginnt gleich mit Mix und Grammatik. */
const profile = () => placedProfile({ newPerDay: 0 });

type Slots = Record<string, Record<string, unknown>>;
const dump = (page: Page, path: string): Promise<{ e: Slots } | undefined> => page.evaluate((p) => window.__LINGO_FAKE__!.db.dump()[p] as { e: Slots } | undefined, path);
const writeCalls = (page: Page): Promise<number> => page.evaluate(() => window.__LINGO_FAKE__!.sampleCalls.filter((c) => c.id === 'write-review').length);

/** Die Reparatur-Einträge so tun lassen, als wäre ein Tag vergangen (fällig seit gestern). */
async function makeDue(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const db = window.__LINGO_FAKE__!.db;
    const cur = (db.dump()['coach/repair'] as { e: Record<string, unknown> }).e;
    const e: Record<string, { due: number }> = {};
    Object.keys(cur).forEach((slot, i) => (e[slot] = { due: i + 1 }));
    await db.db.doc('coach/repair').update({ e });
  });
}

/** Mix, Regel und Grammatik der Einheit überspringen, bis die erste Reparatur-Aufgabe da ist. */
async function toRepair(page: Page): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const repair = page.getByTestId('repair-task');
    const rule = page.getByTestId('rule-go');
    const mix = page.getByTestId('mix-options');
    const skip = page.getByTestId('grammar-skip');
    await repair.or(rule).or(mix).or(skip).first().waitFor();
    if (await repair.isVisible()) return;
    if (await rule.isVisible()) await rule.click();
    else if (await mix.isVisible()) {
      await mix.getByRole('button').first().click();
      await page.getByTestId('next').click();
    } else if (await skip.isVisible()) await skip.click();
  }
  throw new Error('Keine Reparatur-Aufgabe erreicht');
}

test('Schreiben: eine Korrektur, Fehler mit Warum, Reparatur in der nächsten Einheit, Box 3', async ({ page }) => {
  const { errors } = await boot(page, { fake: { seed: 'empty', patch: { 'coach/profile': profile() } } });
  await page.getByTestId('tab-plan').click();
  await expect(page.getByTestId('plan-writing')).toContainText('Noch kein Text');
  await page.getByTestId('plan-write-start').click();

  // Aufgabe, Schlüsselwörter zum Antippen, Zähler.
  await expect(page.getByTestId('write-task')).toBeVisible();
  await expect(page.getByTestId('write-words').getByRole('button')).toHaveCount(4);
  await expect(page.getByTestId('write-submit')).toBeDisabled();
  await expect(page.getByTestId('write-swap')).toBeVisible();
  // Schlüsselwort antippen: Bedeutung aus dem Wörterbuch, ohne KI.
  await page.getByTestId('write-words').getByRole('button').first().click();
  await expect(page.getByTestId('word-sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('word-sheet')).toHaveCount(0);
  await page.getByTestId('write-input').fill(CANNED_WRITE_TEXT);
  // Wer schon schreibt, kann die Aufgabe nicht mehr versehentlich wechseln.
  await expect(page.getByTestId('write-swap')).toHaveCount(0);
  await expect(page.getByTestId('write-count')).toHaveText(/^50 Wörter · Ziel \d+–\d+$/);
  await expect(page.getByTestId('write-submit')).toBeEnabled();
  await page.getByTestId('write-submit').click();

  // Genau eine Anfrage, drei Fehler, jeder mit Warum, dazu Niveau, korrigierter Text, eine Aufwertung.
  await expect(page.getByTestId('write-result')).toBeVisible();
  expect(await writeCalls(page)).toBe(1);
  await expect(page.getByTestId('write-error-item')).toHaveCount(3);
  await expect(page.getByTestId('write-error-item').first()).toContainText('We are working on it since March');
  await expect(page.getByTestId('write-error-item').first()).toContainText('Warum');
  await expect(page.getByTestId('write-corrected')).toContainText('We have a meeting next week');
  await expect(page.getByTestId('write-level')).toContainText('B2+');
  await expect(page.getByTestId('write-upgrade')).toHaveCount(1);
  await expect(page.getByTestId('write-repair-note')).toContainText('3 Fehler');
  // Erledigt heißt erledigt: Der Knopf „Korrigieren“ ist weg, Wiederholen gibt es nicht.
  await expect(page.getByTestId('write-submit')).toHaveCount(0);
  await expect(page.getByTestId('write-retry')).toHaveCount(0);

  // Gespeichert: Text mit Korrektur, Fehlern, Niveau und Datum; drei Reparatur-Einträge in Box 1.
  await expect.poll(async () => Object.keys((await dump(page, 'coach/repair'))?.e ?? {}).length).toBe(3);
  const month = (await dump(page, 'coach/writing-2026-09'))!.e;
  expect(Object.keys(month)).toEqual(['w0']);
  expect(month.w0).toMatchObject({ d: '2026-09-20', lv: 'B2+', wl: 'de' });
  expect((month.w0!.e as unknown[]).length).toBe(3);
  const rep = (await dump(page, 'coach/repair'))!.e;
  expect(Object.values(rep).map((r) => r.box)).toEqual([1, 1, 1]);
  expect(Object.values(rep).map((r) => r.src)).toEqual(['write', 'write', 'write']);
  expect(Math.min(...Object.values(rep).map((r) => r.due as number))).toBeGreaterThan(NOW_MS);

  // Fahrplan: ein Text, Niveau sichtbar. Heute: noch nichts fällig (erste Wiederholung morgen).
  await page.getByTestId('write-done').click();
  await expect(page.getByTestId('home')).toBeVisible();
  await expect(page.getByTestId('brief')).not.toContainText('Sätze zum Reparieren');
  await page.getByTestId('tab-plan').click();
  await expect(page.getByTestId('plan-writing-count')).toContainText('1 Text geschrieben');
  await expect(page.getByTestId('plan-writing-levels')).toContainText('B2+');
  await expect(page.getByTestId('stumble-item').first()).toBeVisible();

  // Ein Tag später: Heute kündigt die Sätze an, die Einheit bringt sie nach der Grammatik.
  await makeDue(page);
  await page.getByTestId('tab-home').click();
  await expect(page.getByTestId('brief')).toContainText('3 Sätze zum Reparieren');
  await page.getByTestId('start-training').click();
  await toRepair(page);

  // 1. richtig: Der Satz mit dem Fehler steht schon im Feld; Box 3 und „kommt in 3 Tagen wieder“.
  await expect(page.getByTestId('repair-input')).toHaveValue('We are working on it since March');
  await page.getByTestId('repair-input').fill('We have been working on it since March');
  await page.getByTestId('repair-check').click();
  await expect(page.getByTestId('repair-feedback')).toHaveAttribute('data-verdict', 'correct');
  await expect(page.getByTestId('repair-why')).toContainText('Warum');
  await expect(page.getByTestId('repair-due')).toContainText('3 Tagen');
  await page.getByTestId('repair-next').click();
  // 2. „Weiß ich nicht“: Lösung und Warum werden gezeigt, der Eintrag bleibt in Box 1.
  await expect(page.getByTestId('repair-input')).toHaveValue('We have an meeting');
  await page.getByTestId('repair-skip').click();
  await expect(page.getByTestId('repair-solution')).toHaveText('We have a meeting');
  await expect(page.getByTestId('repair-due')).toContainText('morgen');
  await page.getByTestId('repair-next').click();
  // 3. unverändert abgeschickt zählt nicht, die richtige Fassung schon.
  await page.getByTestId('repair-check').click();
  await expect(page.getByTestId('repair-feedback')).toHaveAttribute('data-verdict', 'wrong');
  await expect(page.getByTestId('repair-solution')).toHaveText('for three years');
  await page.getByTestId('repair-next').click();
  await expect(page.getByTestId('session-done')).toBeVisible();
  // Die richtige Antwort steht in Box 3; die beiden anderen bleiben in Box 1 und kommen morgen wieder.
  const after = (await dump(page, 'coach/repair'))!.e;
  const byFix = (fix: string) => Object.values(after).find((r) => r.fix === fix)!;
  expect(byFix('We have been working on it since March')).toMatchObject({ box: 3, done: 0 });
  expect(byFix('We have a meeting')).toMatchObject({ box: 1, done: 0 });
  expect(byFix('for three years')).toMatchObject({ box: 1, done: 0 });
  expect(errors).toEqual([]);
});

test('Reparatur: richtige Antworten rücken in Box 3, Falsches bleibt in Box 1, danach ist die Pflicht erledigt', async ({ page }) => {
  const entry = (k: string, orig: string, fix: string, due: number) => ({ k, orig, fix, why: 'Weil es so heißt.', wl: 'de', cat: 'tenses', src: 'write', topic: '', box: 1, due, add: NOW_MS - 3 * DAY, done: 0 });
  await boot(page, {
    fake: {
      seed: 'empty',
      patch: {
        'coach/profile': profile(),
        'coach/repair': {
          e: {
            s0: entry('w-a', 'He work here', 'He works here', 1),
            s1: entry('w-b', 'She have a car', 'She has a car', 2),
            // Noch nicht fällig und schon erledigt: kommen nicht.
            s2: entry('w-c', 'I goes home', 'I go home', NOW_MS + 5 * DAY),
            s3: { ...entry('w-d', 'It cost much', 'It costs a lot', 3), done: 1, box: 9 },
          },
        },
      },
    },
  });
  await expect(page.getByTestId('brief')).toContainText('2 Sätze zum Reparieren');
  await page.getByTestId('start-training').click();
  await toRepair(page);
  await page.getByTestId('repair-input').fill('He works here');
  await page.getByTestId('repair-check').click();
  await page.getByTestId('repair-next').click();
  await page.getByTestId('repair-input').fill('She have a car');
  await page.getByTestId('repair-check').click();
  await expect(page.getByTestId('repair-feedback')).toHaveAttribute('data-verdict', 'wrong');
  await page.getByTestId('repair-next').click();
  await expect(page.getByTestId('session-done')).toBeVisible();
  const rep = (await dump(page, 'coach/repair'))!.e;
  expect(rep.s0).toMatchObject({ box: 3, done: 0 });
  expect(rep.s1).toMatchObject({ box: 1, done: 0 });
  expect(rep.s2).toMatchObject({ box: 1, due: NOW_MS + 5 * DAY });
  expect(rep.s3).toMatchObject({ done: 1, box: 9 });
  // Die Pflicht (Grammatik-Block samt Reparatur) ist damit erledigt.
  await page.getByTestId('to-home').click();
  await expect(page.getByTestId('today-done')).toBeVisible();
});

test('Reparatur: eine falsch beantwortete Grammatik-Aufgabe kommt zurück, ohne sie neu zu erfinden', async ({ page }) => {
  await boot(page, { fake: { seed: 'empty', patch: { 'coach/profile': profile() } } });
  await page.getByTestId('start-training').click();
  // Alle Grammatik-Aufgaben überspringen („Weiß ich nicht“): getippte Aufgaben werden Reparatur-Einträge.
  for (let i = 0; i < 40; i++) {
    const done = page.getByTestId('session-done');
    const rule = page.getByTestId('rule-go');
    const mix = page.getByTestId('mix-options');
    const skip = page.getByTestId('grammar-skip');
    await done.or(rule).or(mix).or(skip).first().waitFor();
    if (await done.isVisible()) break;
    if (await rule.isVisible()) await rule.click();
    else if (await mix.isVisible()) {
      await mix.getByRole('button').first().click();
      await page.getByTestId('next').click();
    } else if (await skip.isVisible()) await skip.click();
  }
  const rep = (await dump(page, 'coach/repair'))!.e;
  const grammar = Object.values(rep).filter((r) => r.src === 'grammar');
  expect(grammar.length).toBeGreaterThan(0);
  for (const r of grammar) expect(r).toMatchObject({ box: 1, done: 0, cat: 'grammar' });
  expect(new Set(grammar.map((r) => r.k)).size).toBe(grammar.length);
});

test('Schreiben: bei einem Fehler genau ein Knopf „Erneut versuchen“, kein zweiter Versuch von allein', async ({ page }) => {
  await boot(page, { fake: { seed: 'empty', patch: { 'coach/profile': profile() }, sampleFailOnce: { 'write-review': 'upstream_error' } } });
  await page.getByTestId('tab-plan').click();
  await page.getByTestId('plan-write-start').click();
  await page.getByTestId('write-input').fill(CANNED_WRITE_TEXT);
  await expect(page.getByTestId('write-retry')).toHaveCount(0);
  await page.getByTestId('write-submit').click();
  await expect(page.getByTestId('write-error')).toBeVisible();
  await expect(page.getByTestId('write-retry')).toBeVisible();
  await expect(page.getByTestId('write-submit')).toHaveCount(0);
  // Der Text bleibt erhalten.
  await expect(page.getByTestId('write-input')).toHaveValue(CANNED_WRITE_TEXT);
  expect(await writeCalls(page)).toBe(1);
  await page.getByTestId('write-retry').click();
  await expect(page.getByTestId('write-result')).toBeVisible();
  expect(await writeCalls(page)).toBe(2);
  // Nichts wurde vor dem Ergebnis gespeichert, danach genau einmal.
  await expect.poll(async () => Object.keys((await dump(page, 'coach/writing-2026-09'))?.e ?? {}).length).toBe(1);
});

test('Input: nach der Bewertung „Schreib 3–4 Sätze dazu“ mit den Schlüsselwörtern des Beitrags', async ({ page }) => {
  const item = {
    id: 'ai-chips',
    kind: 'article',
    title: 'Why AI chips are so hard to make',
    source: 'The Verge',
    url: 'https://www.theverge.com/example',
    mins: 8,
    level: 'B2+',
    topic: 'tech',
    why_de: 'Passt zu deinem Interesse an KI.',
    why_en: 'Fits your interest in AI.',
    words: [{ en: 'supply chain', de: 'Lieferkette' }],
  };
  await boot(page, { fake: { seed: 'empty', patch: { 'coach/profile': profile(), 'input/2026-09-20': { d: '2026-09-20', items: [item] } } } });
  await page.getByTestId('tab-input').click();
  await expect(page.getByTestId('input-write')).toHaveCount(0);
  await page.getByTestId('input-finish').click();
  await page.getByRole('radio', { name: 'Spannend' }).click();
  await page.getByRole('radio', { name: 'Passend' }).click();
  await page.getByTestId('input-save').click();
  await page.getByTestId('input-write').click();
  await expect(page.getByTestId('write-task')).toContainText('Why AI chips are so hard to make');
  await expect(page.getByTestId('write-words')).toContainText('supply chain');
  await expect(page.getByTestId('write-swap')).toHaveCount(0);
  await page.getByTestId('write-close').click();
  await expect(page.getByTestId('input')).toBeVisible();
});

test('Fahrplan: Stolpersteine mit Trend, Texte und Niveau; Zusammenfassung bekommt weakCats', async ({ page }) => {
  const e = (cat: string) => ({ orig: 'a', fix: 'b', why: 'w', cat });
  const w = (at: string, d: string, lv: string, cats: string[]) => ({ at: Date.parse(`${at}T12:00:00+02:00`), d, tid: 'weekend', title: 'Your weekend', t: '', c: '', e: cats.map(e), up: [], lv, pr: '', n: 50, wl: 'de' });
  const g = (k: string, topic: string, add: string) => ({ k, orig: 'x', fix: 'y', why: '', wl: '', cat: 'grammar', src: 'grammar', topic, box: 1, due: NOW_MS + DAY, add: Date.parse(`${add}T12:00:00+02:00`), done: 0 });
  await boot(page, {
    fake: {
      seed: 'empty',
      patch: {
        'coach/profile': profile(),
        'coach/writing-2026-09': {
          e: {
            w0: w('2026-09-02', '2026-09-02', 'B1+', ['articles']),
            w1: w('2026-09-12', '2026-09-12', 'B2', ['articles', 'articles', 'tenses']),
            w2: w('2026-09-18', '2026-09-18', 'B2+', ['articles', 'word-order', 'spelling', 'register', 'vocabulary', 'other']),
          },
        },
        'coach/repair': { e: { s0: g('g-1', 'pres-perf-cont', '2026-09-15'), s1: g('g-2', 'pres-perf-cont', '2026-09-16') } },
      },
    },
  });
  await page.getByTestId('tab-plan').click();
  const items = page.getByTestId('stumble-item');
  await expect(items).toHaveCount(5);
  await expect(items.first()).toHaveAttribute('data-key', 'articles');
  await expect(items.first()).toContainText('Artikel');
  await expect(items.first()).toContainText('4×');
  await expect(items.first()).toHaveAttribute('data-trend', 'up');
  await expect(items.nth(1)).toContainText('Present Perfect Continuous');
  await expect(page.getByTestId('plan-writing-count')).toContainText('3 Texte geschrieben');
  await expect(page.getByTestId('plan-writing-levels')).toContainText('B1+ → B2 → B2+');
  expect(await layoutProblems(page)).toEqual([]);
  await expect
    .poll(async () => JSON.stringify((await page.evaluate(() => window.__LINGO_FAKE__!.db.dump()['coach/summary'])) ?? {}), { timeout: 8000 })
    .toContain('"weakCats":["articles","Present Perfect Continuous"');
});

for (const theme of ['dark', 'light'] as Theme[]) {
  test.describe(`Modus ${theme}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('Schreiben, Reparatur und Stolpersteine ohne axe-Befund und ohne Querscrollen', async ({ page }) => {
      const entry = { k: 'w-a', orig: 'He work here', fix: 'He works here', why: 'Dritte Person: -s.', wl: 'de', cat: 'tenses', src: 'write', topic: '', box: 1, due: 1, add: NOW_MS - 3 * DAY, done: 0 };
      const gram = { k: 'g-1', orig: 'x', fix: 'y', why: '', wl: '', cat: 'grammar', src: 'grammar', topic: 'articles', box: 1, due: NOW_MS + DAY, add: NOW_MS - DAY, done: 0 };
      await boot(page, { theme, fake: { seed: 'empty', patch: { 'coach/profile': profile(), 'coach/repair': { e: { s0: entry, s1: gram } } } } });
      const scan = async (where: string) => {
        // Erst prüfen, wenn die Einblendung fertig ist (halbe Deckkraft senkt den Kontrast).
        await page.waitForFunction(() => Array.from(document.querySelectorAll('main > div, [role="dialog"]')).every((el) => getComputedStyle(el).opacity === '1'));
        const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        expect(res.violations.map((v) => `${where}: ${v.id} – ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
        expect(await layoutProblems(page)).toEqual([]);
      };
      await page.getByTestId('tab-plan').click();
      await expect(page.getByTestId('plan-stumble')).toBeVisible();
      await scan('Fahrplan');
      await page.getByTestId('plan-write-start').click();
      await expect(page.getByTestId('write')).toBeVisible();
      await page.getByTestId('write-input').fill(CANNED_WRITE_TEXT);
      await scan('Schreiben');
      await page.getByTestId('write-submit').click();
      await expect(page.getByTestId('write-result')).toBeVisible();
      await scan('Korrektur');
      await page.getByTestId('write-done').click();
      await page.getByTestId('start-training').click();
      await toRepair(page);
      await scan('Reparatur');
      await page.getByTestId('repair-skip').click();
      await expect(page.getByTestId('repair-feedback')).toBeVisible();
      await scan('Reparatur, Antwort');
    });
  });
}
