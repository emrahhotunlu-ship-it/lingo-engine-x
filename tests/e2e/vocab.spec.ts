import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { shardOf } from '../../src/coach/store';
import { boot, layoutProblems, NOW, placedProfile, type Theme } from './fixtures';

// Mein Wortschatz, eigene Wörter, Preply-Brücke (Paket B) gegen den echten Produktions-Build.

const NOW_MS = Date.parse(NOW);
const DAY = 86_400_000;

type Rec = Record<string, unknown>;
const fsrs = (due: number, o: Rec = {}): Rec => ({ v: 1, due, stability: 5, difficulty: 5, state: 2, reps: 3, lapses: 0, last: due - 3 * DAY, scheduledDays: 3, learningSteps: 0, src: 'lx', ...o });
const rec = (o: Rec = {}, f: Rec = {}): Rec => ({ src: 'bank', lv: 2, add: NOW_MS - 20 * DAY, f: fsrs(NOW_MS + 3 * DAY, f), ...o });

/** Karten in ihre Teilstücke (coach/cards-N) verteilen. */
function cardsPatch(cards: Record<string, Rec>): Record<string, Record<string, unknown>> {
  const out: Record<string, { c: Record<string, Rec> }> = {};
  for (const [id, r] of Object.entries(cards)) (out[shardOf(id)] ??= { c: {} }).c[id] = r;
  return out;
}

const SMALL: Record<string, Rec> = {
  negotiate: rec({ lv: 3 }),
  reliable: rec({ lv: 1, bad: 3 }, { due: NOW_MS - DAY, stability: 1, last: NOW_MS - 4 * DAY }),
  executive: rec({ lv: 0, add: NOW_MS - 30 * DAY }, { state: 0, reps: 0, last: null, stability: 0, due: NOW_MS }),
  'my-own': rec({ src: 'user', w: 'flibbertigibbet', de: 'Plappermaul', lv: 4 }),
  'ch-touch-base': rec({ src: 'legacy', w: 'to touch base', de: 'sich kurz abstimmen', lv: 2 }),
};

async function open(page: Page, cards: Record<string, Rec> = SMALL, extra: Record<string, Record<string, unknown> | null> = {}) {
  const run = await boot(page, { fake: { seed: 'empty', patch: { 'coach/profile': placedProfile(), ...cardsPatch(cards), ...extra } } });
  await expect(page.getByTestId('home')).toBeVisible();
  return run;
}

const dump = (page: Page) => page.evaluate(() => window.__LINGO_FAKE__!.db.dump());
const cardOf = async (page: Page, id: string): Promise<Rec | undefined> => {
  const d = (await dump(page)) as Record<string, { c?: Record<string, Rec> }>;
  for (const [path, doc] of Object.entries(d)) if (path.startsWith('coach/cards-') && doc.c?.[id]) return doc.c[id];
  return undefined;
};

test.describe('Mein Wortschatz', () => {
  test('Zähler, Suche, Filter und Sortierung', async ({ page }) => {
    const { errors, external } = await open(page);
    await page.getByTestId('tab-vocab').click();
    await expect(page.getByTestId('vocab')).toBeVisible();
    await expect(page.getByTestId('stat-total')).toContainText('5');
    await expect(page.getByTestId('stat-solid')).toContainText('2'); // negotiate (3) und eigenes Wort (4)
    await expect(page.getByTestId('stat-due')).toContainText('1');
    await expect(page.getByTestId('vocab-row')).toHaveCount(5);

    // Suche: Englisch, Deutsch, kein Treffer
    const search = page.getByTestId('vocab-search');
    await search.fill('negotiat');
    await expect(page.getByTestId('vocab-row')).toHaveCount(1);
    await search.fill('Plappermaul');
    await expect(page.getByTestId('vocab-row')).toHaveAttribute('data-id', 'my-own');
    await search.fill('verhandeln');
    await expect(page.getByTestId('vocab-row').first()).toContainText('negotiate');
    await search.fill('gibtesnicht');
    await expect(page.getByTestId('vocab-nomatch')).toBeVisible();
    await search.fill('');

    // Filter: Sicherheit, fällig, Herkunft
    await page.getByTestId('lv-1').click();
    await expect(page.getByTestId('vocab-row')).toHaveCount(1);
    await expect(page.getByTestId('vocab-row')).toHaveAttribute('data-id', 'reliable');
    await page.getByTestId('lv-all').click();
    await page.getByTestId('filter-due').click();
    await expect(page.getByTestId('vocab-row')).toHaveAttribute('data-id', 'reliable');
    await page.getByTestId('filter-due').click();
    await page.getByTestId('vocab-origin').selectOption('legacy');
    await expect(page.getByTestId('vocab-row')).toHaveAttribute('data-id', 'ch-touch-base');
    await page.getByTestId('vocab-origin').selectOption('all');

    // Sortierung: alphabetisch und am unsichersten zuerst
    await page.getByTestId('vocab-sort').selectOption('alpha');
    await expect(page.getByTestId('vocab-row').first()).toHaveAttribute('data-id', 'executive');
    await page.getByTestId('vocab-sort').selectOption('weak');
    await expect(page.getByTestId('vocab-row').first()).toHaveAttribute('data-id', 'executive');
    await expect(page.getByTestId('vocab-row').nth(1)).toHaveAttribute('data-id', 'reliable');

    // Wort der Bank, das noch keine Karte ist: eigener Abschnitt bei offener Suche
    await search.fill('accommodate');
    await expect(page.getByTestId('vocab-bank-row').first()).toContainText('accommodate');
    expect(await layoutProblems(page)).toEqual([]);
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Wort sperren, wiederfinden, rückgängig machen', async ({ page }) => {
    await open(page);
    await page.getByTestId('tab-vocab').click();
    await expect(page.getByTestId('stat-due')).toContainText('1');
    await page.getByTestId('vocab-row').and(page.locator('[data-id="reliable"]')).click();
    await expect(page.getByTestId('word-sheet')).toBeVisible();
    await page.getByTestId('word-hide').click();
    await expect(page.getByTestId('word-hidden')).toBeVisible();
    await expect.poll(async () => (await cardOf(page, 'reliable'))?.hide).toBe(1);
    // Die Karte bleibt vollständig erhalten (nur `hide` kommt dazu).
    await expect.poll(() => cardOf(page, 'reliable')).toMatchObject({ lv: 1, bad: 3, src: 'bank' });
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('word-sheet')).toHaveCount(0);

    // Aus der Standardliste und aus „fällig" verschwunden, unter „Gesperrt" auffindbar.
    await expect(page.locator('[data-testid="vocab-row"][data-id="reliable"]')).toHaveCount(0);
    await expect(page.getByTestId('stat-due')).toContainText('0');
    await expect(page.getByTestId('stat-total')).toContainText('4');
    await page.getByTestId('filter-hidden').click();
    const hidden = page.locator('[data-testid="vocab-row"][data-id="reliable"]');
    await expect(hidden).toHaveCount(1);
    await expect(hidden).toContainText('gesperrt');
    await hidden.click();
    await page.getByTestId('word-unhide').click();
    await expect(page.getByTestId('word-hidden')).toHaveCount(0);
    await expect.poll(async () => (await cardOf(page, 'reliable'))?.hide).toBe(0);
    await page.keyboard.press('Escape');
    await page.getByTestId('filter-hidden').click();
    await expect(page.locator('[data-testid="vocab-row"][data-id="reliable"]')).toHaveCount(1);
    await expect(page.getByTestId('stat-due')).toContainText('1');
  });

  test('als bekannt markieren: Stufe und Planung wie beim Sortieren', async ({ page }) => {
    await open(page);
    await page.getByTestId('tab-vocab').click();
    await page.locator('[data-testid="vocab-row"][data-id="executive"]').click();
    await page.getByTestId('word-known').click();
    await expect.poll(() => cardOf(page, 'executive')).toMatchObject({ lv: 3, known: 1 });
    expect(((await cardOf(page, 'executive'))?.f as { state: number }).state).not.toBe(0);
    // Schon sichere Karte: der Knopf ist weg.
    await page.keyboard.press('Escape');
    await page.locator('[data-testid="vocab-row"][data-id="negotiate"]').click();
    await expect(page.getByTestId('word-known')).toHaveCount(0);
  });

  test('Wort aus der Wortbank sperren: legt eine gesperrte Karte an', async ({ page }) => {
    await open(page);
    await page.getByTestId('tab-vocab').click();
    await page.getByTestId('vocab-search').fill('accommodate');
    await page.getByTestId('vocab-bank-row').first().click();
    await page.getByTestId('word-hide').click();
    await expect.poll(() => cardOf(page, 'accommodate')).toMatchObject({ src: 'bank', hide: 1 });
  });

  test('Eigenes Wort: anlegen, Duplikate melden', async ({ page }) => {
    await open(page);
    await page.getByTestId('tab-vocab').click();
    await page.getByTestId('vocab-add').click();
    await page.getByTestId('own-save').click();
    await expect(page.getByTestId('own-need')).toBeVisible();
    await page.getByTestId('own-en').fill('to bikeshed');
    await page.getByTestId('own-de').fill('sich in Nebensachen verzetteln');
    await page.getByTestId('own-ex').fill('Let us not bikeshed about the logo.');
    await page.getByTestId('own-save').click();
    await expect(page.getByTestId('own-word')).toHaveCount(0);
    await expect.poll(() => cardOf(page, 'bikeshed')).toMatchObject({ src: 'user', w: 'to bikeshed', de: 'sich in Nebensachen verzetteln', ex: 'Let us not bikeshed about the logo.', lv: 0 });
    await page.getByTestId('vocab-search').fill('Nebensachen');
    await expect(page.getByTestId('vocab-row')).toHaveAttribute('data-id', 'bikeshed');

    // Duplikat 1: Karte schon da (alte Karte unter anderer Kennung) – Hinweis, nichts doppelt.
    await page.getByTestId('vocab-add').click();
    await page.getByTestId('own-en').fill('touch base');
    await page.getByTestId('own-de').fill('abstimmen');
    await page.getByTestId('own-save').click();
    await expect(page.getByTestId('own-dup')).toHaveAttribute('data-dup', 'card');
    expect(await cardOf(page, 'touch-base')).toBeUndefined();
    await page.getByTestId('own-dup-open').click();
    await expect(page.getByTestId('word-sheet')).toContainText('to touch base');
    await page.keyboard.press('Escape');

    // Duplikat 2: steckt schon in der Wortbank – Hinweis, auf Wunsch gleich ins Training.
    await page.getByTestId('vocab-add').click();
    await page.getByTestId('own-en').fill('accommodate');
    await page.getByTestId('own-de').fill('unterbringen');
    await page.getByTestId('own-save').click();
    await expect(page.getByTestId('own-dup')).toHaveAttribute('data-dup', 'bank');
    expect(await cardOf(page, 'accommodate')).toBeUndefined();
    await page.getByTestId('own-dup-take').click();
    await expect.poll(() => cardOf(page, 'accommodate')).toMatchObject({ src: 'bank', lv: 0 });
  });

  test('Wendungen sind ganz normale Karten: Wortschatz, Wort-Blatt, Training', async ({ page }) => {
    await open(page, { 'ph-take-sth-into-account': rec({ lv: 1, add: NOW_MS - DAY }, { due: NOW_MS - DAY }) });
    await page.getByTestId('tab-vocab').click();
    const row = page.locator('[data-testid="vocab-row"][data-id="ph-take-sth-into-account"]');
    await expect(row).toContainText('take sth into account');
    await row.click();
    await expect(page.getByTestId('word-sheet')).toContainText('Wendung');
    await expect(page.getByTestId('word-sheet')).toContainText('Wechselkurs');
    await page.keyboard.press('Escape');
    // Training: die fällige Wendung wird abgefragt (Stufe 1 ohne Lücke → frei abrufen), „something" gilt als richtig.
    await page.getByTestId('tab-home').click();
    await page.getByTestId('start-training').click();
    const exercise = page.getByTestId('exercise');
    await expect(exercise).toBeVisible();
    await expect(exercise).toHaveAttribute('data-format', 'recall');
    await page.locator('.lx-hidden-input').click();
    await page.keyboard.type('take something into account');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('feedback')).toHaveAttribute('data-verdict', 'correct');
  });
});

test.describe('Große Datenmenge', () => {
  test('6.000 Karten: Liste öffnet in unter einer Sekunde und rendert nur ein Stück', async ({ page }) => {
    const many: Record<string, Rec> = {};
    for (let i = 0; i < 6000; i++) many[`wx${i}`] = rec({ src: 'user', w: `wordx${i}`, de: `Wort ${i}`, lv: i % 5 }, { due: NOW_MS + ((i % 40) - 5) * DAY, last: NOW_MS - (i % 90) * DAY });
    await open(page, many);
    await expect(page.getByTestId('stat-total')).toBeHidden(); // Wortschatz-Reiter noch nicht offen
    // Vom Tippen auf den Reiter bis zur ersten Zeile, in der Seite gemessen (einschließlich der Bildschirm-Überblendung).
    const openMs = () =>
      page.evaluate(async () => {
        const t0 = performance.now();
        document.querySelector<HTMLElement>('[data-testid="tab-vocab"]')!.click();
        await new Promise<void>((resolve) => {
          const check = () => (document.querySelector('[data-testid="vocab-row"]') ? resolve() : requestAnimationFrame(check));
          check();
        });
        return performance.now() - t0;
      });
    const first = await openMs();
    await page.getByTestId('tab-home').click();
    await expect(page.getByTestId('home')).toBeVisible();
    const second = await openMs();
    const ms = Math.min(first, second);
    expect(ms, `Liste öffnet in ${Math.round(first)} / ${Math.round(second)} ms`).toBeLessThan(1000);
    await expect(page.getByTestId('stat-total')).toContainText('6.000');
    expect(await page.getByTestId('vocab-row').count()).toBeLessThanOrEqual(50);
    await expect(page.getByTestId('vocab-more')).toContainText('5.950');
    await page.getByTestId('vocab-more').click();
    await expect(page.getByTestId('vocab-row')).toHaveCount(100);
    // Suche und Filter bleiben schnell.
    const t1 = Date.now();
    await page.getByTestId('vocab-search').fill('wordx59');
    await expect(page.getByTestId('vocab-count')).toContainText('111');
    expect(Date.now() - t1).toBeLessThan(1500);
    expect(await layoutProblems(page)).toEqual([]);
  });
});

const WEEK_CARDS: Record<string, Rec> = {
  negotiate: rec({ lv: 0, bad: 6 }),
  reliable: rec({ lv: 1, bad: 4 }),
  'my-own': rec({ src: 'user', w: 'hedge', de: 'absichern', lv: 0, bad: 3 }),
};
const INLOG = { it: { 'a-1': { d: '2026-09-19', m: 8, t: 'Why AI chips are so hard to make', s: 'The Verge', k: 'article' } }, own: {} };

test.describe('Preply-Brücke', () => {
  test('Vorbereitungstext erzeugen und kopieren', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://lingo.artifact.test' });
    const { errors } = await open(page, WEEK_CARDS, { 'coach/inlog-2026-09': INLOG });
    await page.getByTestId('open-preply').click();
    await expect(page.getByTestId('preply')).toBeVisible();
    const text = page.getByTestId('preply-text');
    await expect(text).toHaveValue(/• negotiate – verhandeln/);
    await expect(text).toHaveValue(/• hedge – absichern/);
    await expect(text).toHaveValue(/Why AI chips are so hard to make \(The Verge\)/);
    await expect(text).toHaveValue(/Mein Niveau: B2/);
    await expect(text).toHaveValue(/Preparation for my Preply lesson/);
    await expect(text).toHaveValue(/Words I keep getting wrong:/);
    // Kein KI-Aufruf
    expect(await page.evaluate(() => window.__LINGO_FAKE__!.sampleCalls.length)).toBe(0);
    await page.getByTestId('preply-copy').click();
    await expect(page.getByTestId('preply-copy')).toContainText('Kopiert');
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(await text.inputValue());
    expect(errors).toEqual([]);
  });

  test('Kopieren nicht möglich: der Text bleibt markierbar, ein Hinweis erscheint', async ({ page }) => {
    await open(page, WEEK_CARDS);
    await page.getByTestId('open-preply').click();
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true });
    });
    await page.getByTestId('preply-copy').click();
    await expect(page.getByTestId('preply-copy-fail')).toBeVisible();
    await expect(page.getByTestId('preply-text')).toBeFocused();
    const selected = await page.evaluate(() => {
      const el = document.getElementById('preply-text') as HTMLTextAreaElement;
      return el.value.slice(el.selectionStart, el.selectionEnd).length;
    });
    expect(selected).toBeGreaterThan(50);
  });

  test('englische Oberfläche: nur der englische Brief', async ({ page }) => {
    await boot(page, { lang: 'en', fake: { seed: 'empty', patch: { 'coach/profile': placedProfile(), ...cardsPatch(WEEK_CARDS) } } });
    await page.getByTestId('open-preply').click();
    const v = await page.getByTestId('preply-text').inputValue();
    expect(v.startsWith('Preparation for my Preply lesson')).toBe(true);
    expect(v).not.toContain('Vorbereitung');
    expect(v).toContain('• negotiate – to have a formal discussion');
  });

  test('nach der Stunde: Dauer und Wörter eintragen, Duplikate melden, nur Extra für den Fahrplan', async ({ page }) => {
    await open(page, WEEK_CARDS);
    await page.getByTestId('open-preply').click();
    await expect(page.getByTestId('preply-week')).toContainText('noch keine Stunde');
    await expect(page.getByTestId('preply-save')).toBeDisabled();
    await page.getByTestId('dur-45').click();
    await page.getByTestId('preply-words').fill(['state-of-the-art – neuester Stand', 'negotiate – verhandeln', 'take sth into account – etw. beachten', 'nurenglisch', 'executive – Führungskraft', 'to dogfood sth – etw. selbst im Alltag nutzen'].join('\n'));
    await page.getByTestId('preply-save').click();
    const result = page.getByTestId('preply-result');
    await expect(result).toContainText('Eingetragen: 45 Min.');
    await expect(result).toContainText('2 neue Karten angelegt');
    await expect(page.getByTestId('preply-dups')).toContainText('negotiate'); // schon in den Karten
    await expect(page.getByTestId('preply-dups')).toContainText('take sth into account'); // steckt schon in der Wortbank (Wendung)
    await expect(page.getByTestId('preply-dups')).toContainText('executive'); // steckt schon in der Wortbank (Wort)
    await expect(page.getByTestId('preply-bad')).toContainText('nurenglisch');
    await expect(page.getByTestId('preply-week')).toContainText('1 Stunde gehalten (45 Min.)');

    // Gespeichert: Karten (eigene) und Stunde (coach/preply).
    await expect.poll(() => cardOf(page, 'state-of-the-art')).toMatchObject({ src: 'user', w: 'state-of-the-art', de: 'neuester Stand' });
    await expect.poll(() => cardOf(page, 'dogfood-sth')).toMatchObject({ src: 'user', w: 'to dogfood sth', de: 'etw. selbst im Alltag nutzen' });
    expect(await cardOf(page, 'take-sth-into-account')).toBeUndefined();
    expect(await cardOf(page, 'executive')).toBeUndefined();
    const d = (await dump(page)) as Record<string, { s?: Record<string, { d: string; min: number; n: number }> }>;
    expect(Object.values(d['coach/preply']?.s ?? {})).toEqual([{ d: '2026-09-20', min: 45, n: 2 }]);

    // Fahrplan: als Extra bei den Input-Stunden (45 Min. = 0,8 Std.), Heute bleibt unverändert (keine Pflicht, keine Serie).
    await page.getByTestId('tab-plan').click();
    await expect(page.getByTestId('plan-preply-week')).toContainText('1 Stunde gehalten');
    await expect(page.getByTestId('meter-input')).toContainText('0,8');
    await page.getByTestId('tab-home').click();
    await expect(page.getByTestId('start-training')).toBeVisible();
    await expect(page.getByTestId('today-done')).toHaveCount(0);
    await expect(page.getByTestId('streak')).toContainText('2');
    const days = (await dump(page))['coach/days-2026'];
    expect(days).toBeUndefined();
  });

  test('Dauer „Andere" braucht gültige Minuten', async ({ page }) => {
    await open(page, WEEK_CARDS);
    await page.getByTestId('open-preply').click();
    await page.getByTestId('dur-other').click();
    await expect(page.getByTestId('preply-save')).toBeDisabled();
    await page.getByTestId('preply-other').fill('2');
    await expect(page.getByTestId('preply-save')).toBeDisabled();
    await page.getByTestId('preply-other').fill('50');
    await expect(page.getByTestId('preply-save')).toBeEnabled();
    await page.getByTestId('preply-save').click();
    await expect(page.getByTestId('preply-result')).toContainText('50 Min.');
    await expect(page.getByTestId('preply-recent')).toContainText('50 Min.');
  });

  test('Fahrplan führt zur Preply-Seite, Zurück führt nach Heute', async ({ page }) => {
    await open(page, WEEK_CARDS);
    await page.getByTestId('tab-plan').click();
    await page.getByTestId('plan-open-preply').click();
    await expect(page.getByTestId('preply')).toBeVisible();
    await page.getByTestId('preply-back').click();
    await expect(page.getByTestId('home')).toBeVisible();
  });
});

for (const theme of ['dark', 'light'] as Theme[]) {
  test.describe(`Modus ${theme}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('Wortschatz, Eigenes Wort, Wort-Blatt und Preply ohne axe-Befund und ohne Querscrollen', async ({ page }) => {
      await boot(page, { theme, fake: { seed: 'empty', patch: { 'coach/profile': placedProfile(), ...cardsPatch({ ...SMALL, ...WEEK_CARDS }), 'coach/inlog-2026-09': INLOG } } });
      const scan = async (where: string) => {
        await page.waitForFunction(() => Array.from(document.querySelectorAll('main > div, [role="dialog"]')).every((e) => getComputedStyle(e).opacity === '1'));
        const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        expect(res.violations.map((v) => `${where}: ${v.id} – ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
        expect(await layoutProblems(page)).toEqual([]);
      };
      await expect(page.getByTestId('home')).toBeVisible();
      await scan('Heute');
      await page.getByTestId('tab-vocab').click();
      await expect(page.getByTestId('vocab-row').first()).toBeVisible();
      await scan('Wortschatz');
      await page.getByTestId('vocab-search').fill('accommodate');
      await expect(page.getByTestId('vocab-bank-row').first()).toBeVisible();
      await scan('Wortschatz mit Wortbank-Treffer');
      await page.getByTestId('vocab-search').fill('');
      await page.locator('[data-testid="vocab-row"][data-id="reliable"]').click();
      await expect(page.getByTestId('word-hide')).toBeVisible();
      await scan('Wort-Blatt');
      await page.getByTestId('word-hide').click();
      await expect(page.getByTestId('word-unhide')).toBeVisible();
      await scan('Wort-Blatt gesperrt');
      await page.keyboard.press('Escape');
      await page.getByTestId('vocab-add').click();
      await page.getByTestId('own-en').fill('negotiate');
      await page.getByTestId('own-de').fill('verhandeln');
      await page.getByTestId('own-save').click();
      await expect(page.getByTestId('own-dup')).toBeVisible();
      await scan('Eigenes Wort mit Hinweis');
      await page.keyboard.press('Escape');
      await page.getByTestId('tab-home').click();
      await page.getByTestId('open-preply').click();
      await expect(page.getByTestId('preply')).toBeVisible();
      await scan('Preply');
      await page.getByTestId('dur-60').click();
      await page.getByTestId('preply-words').fill('hedge – absichern\nzork');
      await page.getByTestId('preply-save').click();
      await expect(page.getByTestId('preply-result')).toBeVisible();
      await scan('Preply nach der Stunde');
      await page.getByTestId('preply-back').click();
      await page.getByTestId('tab-plan').click();
      await expect(page.getByTestId('plan-preply')).toBeVisible();
      await scan('Fahrplan mit Preply');
    });
  });
}
