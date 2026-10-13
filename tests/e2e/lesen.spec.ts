import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, openTab, screen, type BootOptions, type Lang, type Theme } from './fixtures';

// Reiter „Lesen“ (Paket L3, docs/umbau/lesen-plan.md §2.1, §3, §6): sechster Reiter, Liste, Artikel holen (Dev-Adapter), Stopp, Fehlerzustände,
// Themen, Reiterleiste bei 360/390/412 px und am Desktop, Barrierefreiheit in drei Modi. Alle Daten erfunden (seed/sample-data.json, `read/…`).

const EVENING_19 = '2026-09-19T21:00:00+02:00';
type Dump = Record<string, Record<string, unknown>>;
const dump = (page: Page): Promise<Dump> => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { dump(): Dump } } }).__LINGO_FAKE__.db.dump());
const calls = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { sampleCalls: Array<{ id: string }> } }).__LINGO_FAKE__.sampleCalls.filter((c) => c.id === 'read-article').length);

/** Ohne `read/…`-Dokumente: erste Nutzung. */
const NO_READ: BootOptions['fake'] = { patch: { 'read/p': null, 'read/m-2026-09': null, 'read/d-2026-09-17': null, 'read/d-2026-09-19': null }, sampleTickMs: 1 };

async function openRead(page: Page): Promise<void> {
  await openTab(page, 'read');
  await expect(page.getByTestId('read')).toHaveAttribute('data-load', 'ready');
}

async function expectNoOverflow(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

// ---------------------------------------------------------------- sechs Reiter am Handy und am Desktop

for (const lang of ['de', 'en'] as const satisfies readonly Lang[]) {
  for (const w of [360, 390, 412]) {
    test(`Reiterleiste mit sechs Reitern bei ${w} px einzeilig und mit Luft (${lang})`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true, timezoneId: 'Europe/Berlin' });
      const page = await context.newPage();
      const { errors } = await boot(page, { lang, migrated: true });
      await screen(page, 'today');
      const boxes = await page.getByTestId('tabbar').locator('button').evaluateAll((els) =>
        els.map((el) => {
          const label = [...el.querySelectorAll('span')].find((sp) => [...sp.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) && !sp.closest('[data-testid="tab-badge"]'));
          const text = label ? [...label.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) : undefined;
          const range = document.createRange();
          if (text) range.selectNodeContents(text);
          const lines = text ? new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size : 0;
          const tr = range.getBoundingClientRect();
          const b = el.getBoundingClientRect();
          return { id: el.getAttribute('data-tab') ?? '', label: text?.textContent ?? '', lines, h: b.height, left: b.left, right: b.right, textLeft: tr.left, textRight: tr.right };
        }),
      );
      expect(boxes.map((b) => b.id)).toEqual(['today', 'vocab', 'learn', 'apply', 'read', 'progress']);
      expect(boxes.map((b) => b.label)[4]).toBe(lang === 'de' ? 'Lesen' : 'Read');
      for (const b of boxes) {
        expect(b.lines, b.label).toBe(1);
        expect(b.h, b.label).toBeGreaterThanOrEqual(44);
        expect(b.left, b.label).toBeGreaterThanOrEqual(0);
        expect(b.right, b.label).toBeLessThanOrEqual(w);
        // Text bleibt im Knopf, mit Luft zum Rand.
        expect(b.textLeft - b.left, b.label).toBeGreaterThanOrEqual(2);
        expect(b.right - b.textRight, b.label).toBeGreaterThanOrEqual(2);
      }
      // Luft zwischen den Beschriftungen: bei 360 px knapp (gemessen ≥ 7,7 px), ab 390 px mindestens 8 px.
      const minGap = w <= 360 ? 6 : 8;
      for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.textLeft - boxes[i - 1]!.textRight, `${boxes[i - 1]!.label} | ${boxes[i]!.label}`).toBeGreaterThanOrEqual(minGap);
      await expectNoOverflow(page);
      expect(errors).toEqual([]);
      await context.close();
    });
  }
}

test('Desktop: sechs Reiter in der Pillen-Leiste, Lesen öffnet den Bildschirm', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'Europe/Berlin' });
  const page = await context.newPage();
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await expect(page.getByTestId('tabbar').locator('button')).toHaveCount(6);
  await openRead(page);
  await expect(page.getByTestId('read-title')).toHaveText('Lesen');
  await expectNoOverflow(page);
  expect(errors).toEqual([]);
  await context.close();
});

// ---------------------------------------------------------------- Bildschirm: Liste, Zustände, Woche

test.describe('Bildschirm „Lesen“ (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Lerntag mit Artikeln: Liste mit Zuständen, ein Hauptknopf „Weiterlesen“, Wochenzeile, frühere Artikel; Tippen öffnet den Leser (Platzhalter)', async ({ page }) => {
    const { errors, external } = await boot(page, { migrated: true, now: EVENING_19 });
    await screen(page, 'today');
    await openRead(page);
    await expect(page.getByTestId('read-byline')).toContainText('Von Claude geschrieben');
    const rows = page.getByTestId('read-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute('data-state', 'started');
    await expect(rows.nth(1)).toHaveAttribute('data-state', 'open');
    await expect(rows.nth(0)).toContainText('Why Partnerships Take Longer Than Anyone Plans');
    await expect(rows.nth(0)).toContainText('Business Development');
    await expect(rows.nth(0)).toContainText(/≈ \d+ Min · \d+ Wörter/);
    // Genau ein gefüllter Hauptknopf; er nennt den angefangenen Artikel.
    const primary = page.getByTestId('read-primary');
    await expect(primary).toHaveCount(1);
    await expect(primary).toContainText('Weiterlesen: Why Partnerships Take Longer Than Anyone Plans');
    // Zwei von drei Artikeln da: der fehlende wird still angeboten (kein zweiter Hauptknopf).
    await expect(page.getByTestId('read-fetch')).toHaveText('Artikel für heute holen');
    // Wochenzeile (KW 38: ein gelesener Artikel am 17.09., 500 s ≈ 8 Min) und frühere Artikel.
    await expect(page.getByTestId('read-week')).toHaveText('Diese Woche: 1 Artikel · 8 Min');
    await expect(page.getByTestId('read-earlier-row')).toHaveCount(1);
    await expect(page.getByTestId('read-earlier-row')).toContainText('Why Clear Feedback Beats Frequent Meetings');
    // Touch-Ziele ≥ 44 px
    for (const el of await page.getByTestId('read').locator('button').all()) {
      const b = await el.boundingBox();
      if (b) expect(b.height, (await el.textContent()) ?? '').toBeGreaterThanOrEqual(43.5);
    }
    await expectNoOverflow(page);
    await primary.click();
    await screen(page, 'readArticle');
    await expect(page.getByTestId('rdr')).toHaveAttribute('data-article', /^a-2026-09-19-1-/);
    await expect(page.getByTestId('tabbar')).toBeVisible();
    await page.getByTestId('back').first().click();
    await screen(page, 'read');
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('alles gelesen: ruhiger Zustand statt Knopf, „Noch einen holen“ als Nebenknopf', async ({ page }) => {
    const done = { sec: 300, pos: 8, done: true, open: 5, saved: 0 };
    const items = [
      { id: 'a-2026-09-19-1-k3m9qa', day: '2026-09-19', title: 'Why Partnerships Take Longer Than Anyone Plans', topic: 'bizdev', mins: 2, words: 280, st: done },
      { id: 'a-2026-09-19-2-p7d2xe', day: '2026-09-19', title: 'What Language Models Change About Everyday Work', topic: 'ai', mins: 2, words: 280, st: done },
      { id: 'a-2026-09-19-3-zzzzzz', day: '2026-09-19', title: 'A third one', topic: 'saas', mins: 2, words: 280, st: done },
    ];
    await boot(page, { migrated: true, now: EVENING_19, fake: { patch: { 'read/m-2026-09': { v: 1, items } } } });
    await screen(page, 'today');
    await openRead(page);
    await expect(page.getByTestId('read-primary')).toHaveCount(0);
    await expect(page.getByTestId('read-today')).toContainText('Heute alles gelesen');
    await expect(page.getByTestId('read-today')).toHaveAttribute('data-tone', 'done');
    await expect(page.getByTestId('read-fetch')).toHaveText('Noch einen holen (neues Thema)');
    await expect(page.getByTestId('read-row').first()).toHaveAttribute('data-state', 'done');
  });

  test('erste Nutzung: freundlicher Leerzustand, ein großer Knopf, Skelett beim Laden', async ({ page }) => {
    await boot(page, { migrated: true, fake: NO_READ });
    await screen(page, 'today');
    await page.getByTestId('tab-read').click();
    await screen(page, 'read');
    await expect(page.getByTestId('read')).toHaveAttribute('data-load', 'ready');
    await expect(page.getByTestId('read-today')).toContainText('Dein erster Artikel wartet');
    const primary = page.getByTestId('read-primary');
    await expect(primary).toHaveText('Artikel für heute holen');
    await expect(primary).toHaveAttribute('data-kind', 'fetch');
    await expect(page.getByTestId('read-row')).toHaveCount(0);
    await expect(page.getByTestId('read-earlier')).toHaveCount(0);
    await expect(page.getByTestId('read-week')).toHaveText('Diese Woche noch nichts gelesen');
    expect((await primary.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test('ohne Claude (sample fehlt): Reiter bleibt, alte Artikel lesbar, Holen ausgeblendet', async ({ page }) => {
    await boot(page, { migrated: true, now: EVENING_19, fake: { capabilities: { sample: false } } });
    await screen(page, 'today');
    await openRead(page);
    await expect(page.getByTestId('read-row')).toHaveCount(2);
    await expect(page.getByTestId('read-fetch')).toHaveCount(0);
    await expect(page.getByTestId('read-today')).toContainText('Claude ist in dieser Ansicht nicht verfügbar');
    await expect(page.getByTestId('read-suggest')).toHaveCount(0);
    // Der Hauptknopf liest weiter.
    await expect(page.getByTestId('read-primary')).toHaveAttribute('data-kind', 'read');
  });

  test('Englisch: Texte der Oberfläche auf Englisch, Artikelinhalt bleibt Lerntext', async ({ page }) => {
    await boot(page, { migrated: true, now: EVENING_19, lang: 'en' });
    await screen(page, 'today');
    await openRead(page);
    await expect(page.getByTestId('read-title')).toHaveText('Read');
    await expect(page.getByTestId('read-primary')).toContainText('Keep reading: Why Partnerships Take Longer Than Anyone Plans');
    await expect(page.getByTestId('read-fetch')).toHaveText('Get today’s articles');
    await expect(page.getByTestId('read-week')).toContainText('This week: 1 article · 8 min');
  });
});

// ---------------------------------------------------------------- Artikel holen

test.describe('Artikel holen (Dev-Adapter)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Knopf holt drei Artikel nacheinander mit Fortschritt, speichert jeden, Liste und Hauptknopf folgen', async ({ page }) => {
    const { errors, external } = await boot(page, { migrated: true, fake: { ...NO_READ, sampleTickMs: 4 } });
    await screen(page, 'today');
    await openRead(page);
    await page.getByTestId('read-primary').click();
    const progress = page.getByTestId('read-progress');
    await expect(progress).toBeVisible();
    await expect(progress).toContainText('Claude schreibt … Artikel 1 von 3');
    await expect(page.getByTestId('read-primary')).toHaveCount(0); // ein Knopf weniger während des Holens, dafür Stopp
    await expect(page.getByTestId('ai-stop')).toBeVisible();
    await expect(progress).toContainText('Artikel 2 von 3', { timeout: 20_000 });
    await expect(page.getByTestId('read-row')).toHaveCount(3, { timeout: 30_000 });
    await expect(progress).toHaveCount(0);
    const primary = page.getByTestId('read-primary');
    await expect(primary).toHaveAttribute('data-kind', 'read');
    await expect(primary).toContainText('Lesen: ');
    await expect(page.getByTestId('read-fetch')).toHaveCount(0); // alle drei da
    // Gespeichert: Tagesdokument mit drei Artikeln, Monatsindex, Lerntage in read/p (für die Zählung ohne Texte).
    const db = await dump(page);
    const dayKey = Object.keys(db).find((k) => k.startsWith('read/d-'));
    expect(dayKey).toBeTruthy();
    expect((db[dayKey!]!.items as unknown[]).length).toBe(3);
    const month = Object.keys(db).find((k) => k.startsWith('read/m-'))!;
    expect((db[month]!.items as unknown[]).length).toBe(3);
    expect(db['read/p']!.days).toEqual([dayKey!.slice('read/d-'.length)]);
    expect((db['read/p']!.gen as { n: number }).n).toBe(3);
    expect(await calls(page)).toBe(3);
    // Titel unterscheiden sich (Neuheits-Bias), Themen wechseln.
    const titles = (await page.getByTestId('read-row').locator('span.font-semibold').allTextContents()).map((t) => t.trim());
    expect(new Set(titles).size).toBe(3);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    // Zurück auf den Reiter: die Artikel stehen weiter da (aus der Datenbank, nicht nur im Speicher).
    await openTab(page, 'today');
    await openRead(page);
    await expect(page.getByTestId('read-row')).toHaveCount(3);
  });

  test('Anzahl pro Tag ist einstellbar: bei 2 holt der Knopf zwei Artikel', async ({ page }) => {
    await boot(page, { migrated: true, fake: NO_READ });
    await screen(page, 'today');
    await openRead(page);
    await expect(page.getByTestId('read-perday-n')).toHaveText('3');
    await page.getByTestId('read-perday-less').click();
    await expect(page.getByTestId('read-perday-n')).toHaveText('2');
    await expect.poll(async () => (await dump(page))['read/p']?.perDay).toBe(2);
    await page.getByTestId('read-primary').click();
    await expect(page.getByTestId('read-row')).toHaveCount(2, { timeout: 30_000 });
    expect(await calls(page)).toBe(2);
  });

  test('Stopp: der Knopf hält an, es entsteht kein Fehler, nichts Halbes wird gespeichert', async ({ page }) => {
    await boot(page, { migrated: true, fake: { ...NO_READ, sampleTickMs: 150 } });
    await screen(page, 'today');
    await openRead(page);
    await page.getByTestId('read-primary').click();
    await expect(page.getByTestId('read-progress')).toBeVisible();
    await page.getByTestId('ai-stop').click();
    const outcome = page.getByTestId('read-outcome');
    await expect(outcome).toHaveAttribute('data-kind', 'stopped');
    await expect(page.getByTestId('read-partial')).toHaveText('Angehalten. 0 von 3 Artikeln sind fertig.');
    await expect(page.getByTestId('read-error')).toHaveCount(0);
    await expect(page.getByTestId('read-primary')).toBeVisible();
    const db = await dump(page);
    expect(Object.keys(db).filter((k) => k.startsWith('read/d-'))).toEqual([]);
  });

  test('Claude braucht eine Pause (rate_limited): ruhiger Hinweis, kein Neustart-Knopf, kein weiterer Aufruf', async ({ page }) => {
    await boot(page, { migrated: true, fake: { ...NO_READ, sampleFail: { 'read-article': 'rate_limited' } } });
    await screen(page, 'today');
    await openRead(page);
    await page.getByTestId('read-primary').click();
    await expect(page.getByTestId('read-error')).toContainText('Claude braucht gerade eine Pause');
    await expect(page.getByTestId('read-retry')).toHaveCount(0);
    await expect(page.getByTestId('read-primary')).toHaveCount(0);
    await expect(page.getByTestId('read-fetch')).toHaveCount(0);
    expect(await calls(page)).toBe(1); // nie in einer Schleife wiederholt
  });

  test('Fehler mit „Erneut versuchen“: ein Tipp, ein neuer Aufruf, danach klappt es', async ({ page }) => {
    await boot(page, { migrated: true, fake: { ...NO_READ, sampleFailOnce: { 'read-article': 'upstream_error' } } });
    await screen(page, 'today');
    await openRead(page);
    await page.getByTestId('read-primary').click();
    const retry = page.getByTestId('read-retry');
    await expect(retry).toBeVisible();
    await expect(page.getByTestId('read-error')).toBeVisible();
    expect(await calls(page)).toBe(1);
    await retry.click();
    await expect(page.getByTestId('read-row')).toHaveCount(3, { timeout: 30_000 });
    await expect(page.getByTestId('read-error')).toHaveCount(0);
    expect(await calls(page)).toBe(4);
  });

  test('Claude nicht erlaubt (not_granted) im Lauf: Funktion verschwindet, alte Artikel bleiben lesbar', async ({ page }) => {
    await boot(page, { migrated: true, now: EVENING_19, fake: { sampleMode: 'not_granted' } });
    await screen(page, 'today');
    await openRead(page);
    await page.getByTestId('read-fetch').click();
    await expect(page.getByTestId('read-error')).toBeVisible();
    await expect(page.getByTestId('read-fetch')).toHaveCount(0);
    await expect(page.getByTestId('read-retry')).toHaveCount(0);
    await expect(page.getByTestId('read-row')).toHaveCount(2);
    await expect(page.getByTestId('read-primary')).toHaveAttribute('data-kind', 'read');
  });

  test('ungültige Antwort (kein JSON): verständlicher Fehler und „Erneut versuchen“, nichts gespeichert', async ({ page }) => {
    await boot(page, { migrated: true, fake: NO_READ });
    await screen(page, 'today');
    await openRead(page);
    await page.getByTestId('read-newtopic').click();
    await page.getByTestId('read-topic-input').fill('zzjson');
    await page.getByTestId('read-topic-add').click();
    await expect(page.getByTestId('read-custom')).toHaveCount(1);
    await page.getByTestId('read-primary').click();
    await expect(page.getByTestId('read-error')).toContainText('Dieser Artikel war nicht in Ordnung');
    await expect(page.getByTestId('read-retry')).toBeVisible();
    const db = await dump(page);
    expect(Object.keys(db).filter((k) => k.startsWith('read/d-'))).toEqual([]);
  });
});

// ---------------------------------------------------------------- Themen

test.describe('Themen und „Neues Thema“', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Chips wählen und abwählen, werden in read/p gespeichert und bestimmen das Thema', async ({ page }) => {
    await boot(page, { migrated: true, fake: NO_READ });
    await screen(page, 'today');
    await openRead(page);
    const ai = page.locator('[data-testid="read-topic"][data-topic="ai"]');
    await expect(ai).toHaveAttribute('aria-pressed', 'false');
    await ai.click();
    await expect(ai).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await dump(page))['read/p']?.topics).toEqual({ ai: 1 });
    await page.getByTestId('read-primary').click();
    await expect(page.getByTestId('read-row')).toHaveCount(3, { timeout: 30_000 });
    for (const t of await page.getByTestId('read-row').allTextContents()) expect(t).toContain('KI');
    await ai.click();
    await expect(ai).toHaveAttribute('aria-pressed', 'false');
  });

  test('Neues Thema: eigenes Thema anlegen, Fehlermeldungen, entfernen; „Claude schlägt vor“ liefert Vorschläge', async ({ page }) => {
    await boot(page, { migrated: true, fake: NO_READ });
    await screen(page, 'today');
    await openRead(page);
    await page.getByTestId('read-newtopic').click();
    await page.getByTestId('read-topic-add').click();
    await expect(page.getByTestId('read-topic-msg')).toHaveText('Bitte gib ein Thema ein.');
    await page.getByTestId('read-topic-input').fill('  Pricing   for dev tools ');
    await page.getByTestId('read-topic-add').click();
    await expect(page.getByTestId('read-custom')).toHaveText(/Pricing for dev tools/);
    await expect.poll(async () => (await dump(page))['read/p']?.custom).toEqual(['Pricing for dev tools']);
    await page.getByTestId('read-suggest').click();
    const sugg = page.getByTestId('read-suggestion');
    await expect(sugg).toHaveCount(6);
    await sugg.first().click();
    await expect(page.getByTestId('read-custom')).toHaveCount(2);
    await page.getByTestId('read-custom-remove').first().click();
    await expect(page.getByTestId('read-custom')).toHaveCount(1);
    await expect.poll(async () => ((await dump(page))['read/p']?.custom as string[]).length).toBe(1);
  });
});

// ---------------------------------------------------------------- Barrierefreiheit in drei Modi

for (const theme of ['dark', 'dim', 'light'] as const satisfies readonly Theme[]) {
  for (const width of [390, 1280]) {
    test(`axe · Lesen · ${theme} · ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await boot(page, { theme, migrated: true, now: EVENING_19 });
      await screen(page, 'today');
      await openRead(page);
      // Zusätzlich offen: das Panel „Neues Thema“, damit auch das Formular geprüft wird.
      await page.getByTestId('read-newtopic').click();
      await page.waitForTimeout(500);
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
}
