import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { boot, layoutProblems, openOverview, screen, type Lang, type Theme } from './fixtures';
import { learnTour } from './learnHelpers';
import { inputTour } from './inputHelpers';
import { playCheck, progressTour } from './progressHelpers';

// Jeder Bildschirm rendert auf 390, 1440 und 2560 px, in allen drei Modi und beiden
// Sprachen: keine JS-Fehler, kein undefined/NaN/{0}, kein Querscrollen, nichts
// abgeschnitten, keine Mischsprache (Kap. 12). Screenshots gehen an den ux-reviewer.

const VIEWPORTS = [
  { name: 'handy', width: 390, height: 844, mobile: true },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'gross', width: 2560, height: 1440, mobile: false },
] as const;
const THEMES: Theme[] = ['dark', 'dim', 'light'];
const LANGS: Lang[] = ['de', 'en'];
const BG: Record<Theme, string> = { dark: 'rgb(11, 15, 25)', dim: 'rgb(26, 32, 48)', light: 'rgb(245, 246, 250)' };
const SHOTS = 'test-results/screens';
mkdirSync(SHOTS, { recursive: true });

const GERMAN_IN_EN = /[äöüÄÖÜß]|\b(und|nicht|wird|Karten|Tage|Einstellungen|Serie|Passiv|Indirekte|Relativsätze|Modalverben|Zukunft|Infinitiv|Artikel)\b/;
const ENGLISH_UI_IN_DE = /\b(Settings|Loading|Streak|Vocabulary|Course|Assessment|Where you stand)\b/;

for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    for (const lang of LANGS) {
      for (const migrated of [false, true]) {
        const name = `${migrated ? 'stand' : 'umstellung'}-${vp.name}-${theme}-${lang}`;
        test(name, async ({ browser }) => {
          const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            isMobile: vp.mobile,
            hasTouch: vp.mobile,
            deviceScaleFactor: vp.mobile ? 2 : 1,
            timezoneId: 'Europe/Berlin',
            locale: lang === 'de' ? 'de-DE' : 'en-US',
          });
          const page = await context.newPage();
          const { errors, external } = await boot(page, { theme, lang, migrated });
          if (migrated) await openOverview(page);
        else await screen(page, 'migration');
          if (!migrated) await expect(page.getByTestId('mig-streak')).toBeVisible();

          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await expect(page.locator('html')).toHaveAttribute('lang', lang);
          expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe(BG[theme]);

          expect(await layoutProblems(page)).toEqual([]);
          const text = await page.locator('body').innerText();
          if (lang === 'en') expect(GERMAN_IN_EN.exec(text)?.[0] ?? null, 'Deutsch in der englischen Oberfläche').toBeNull();
          else expect(ENGLISH_UI_IN_DE.exec(text)?.[0] ?? null, 'Englische Bedienelemente in der deutschen Oberfläche').toBeNull();

          await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
          expect(errors).toEqual([]);
          expect(external).toEqual([]);
          await context.close();
        });
      }
    }
  }
}

// Phase 2 (phase2-plan §9.3): jeder Lernen-Bildschirm in allen Breiten, Modi und Sprachen.
for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    for (const lang of LANGS) {
      test(`lernen-${vp.name}-${theme}-${lang}`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          isMobile: vp.mobile,
          hasTouch: vp.mobile,
          deviceScaleFactor: vp.mobile ? 2 : 1,
          timezoneId: 'Europe/Berlin',
          locale: lang === 'de' ? 'de-DE' : 'en-US',
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        const { errors, external } = await boot(page, { theme, lang, migrated: true });
        await screen(page, 'today');
        await learnTour(page, async (name) => {
          expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), name).toBe(BG[theme]);
          expect(await layoutProblems(page), name).toEqual([]);
          // Zitierte Wörter („würde") gehören zur Erklärung, nicht zur Oberfläche.
          const text = (await page.locator('body').innerText()).replace(/„[^“”]*[“”]|“[^”]*”|"[^"]*"/g, ' ');
          if (lang === 'en') expect(GERMAN_IN_EN.exec(text)?.[0] ?? null, `${name}: Deutsch in der englischen Oberfläche`).toBeNull();
          else expect(ENGLISH_UI_IN_DE.exec(text)?.[0] ?? null, `${name}: Englische Bedienelemente in der deutschen Oberfläche`).toBeNull();
          await page.screenshot({ path: `${SHOTS}/${name}-${vp.name}-${theme}-${lang}.png`, fullPage: true });
        });
        expect(errors).toEqual([]);
        expect(external).toEqual([]);
        await context.close();
      });
    }
  }
}

// Phase 4 (Plan §8.3): Lesen, Hören, Schreiben, Entdecken, Beitrag, Verlauf in allen Breiten, Modi
// und Sprachen. Englische Inhalte (lang="en") zählen in der DE-Oberfläche nicht als Mischsprache.
const P4_GERMAN_IN_EN = /[äöüÄÖÜß]|\b(und|nicht|wird|Karten|Tage|Lesen|Hören|Schreiben|Entdecken|Verlauf|Weiter)\b/;
const P4_ENGLISH_UI_IN_DE = /\b(Reading|Listening|Writing|Discover|History|Next|Submit|Done reading)\b/;

for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    for (const lang of LANGS) {
      test(`input-${vp.name}-${theme}-${lang}`, async ({ browser }) => {
        test.setTimeout(90_000);
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          isMobile: vp.mobile,
          hasTouch: vp.mobile,
          deviceScaleFactor: vp.mobile ? 2 : 1,
          timezoneId: 'Europe/Berlin',
          locale: lang === 'de' ? 'de-DE' : 'en-US',
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        const { errors, external } = await boot(page, { theme, lang, migrated: true });
        await screen(page, 'today');
        await inputTour(page, async (name) => {
          expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), name).toBe(BG[theme]);
          expect(await layoutProblems(page), name).toEqual([]);
          const text = await page.evaluate(() => {
            const clone = document.querySelector('main')?.cloneNode(true) as HTMLElement | undefined;
            if (!clone) return '';
            clone.querySelectorAll('[lang]').forEach((n) => {
              if (n.getAttribute('lang') !== document.documentElement.lang) n.remove();
            });
            return clone.innerText;
          });
          if (lang === 'en') expect(P4_GERMAN_IN_EN.exec(text)?.[0] ?? null, `${name}: Deutsch in der englischen Oberfläche`).toBeNull();
          else expect(P4_ENGLISH_UI_IN_DE.exec(text)?.[0] ?? null, `${name}: Englische Bedienelemente in der deutschen Oberfläche`).toBeNull();
          if (theme !== 'dim') await page.screenshot({ path: `${SHOTS}/input-${name}-${vp.name}-${theme}-${lang}.png`, fullPage: true });
        });
        expect(errors).toEqual([]);
        expect(external).toEqual([]);
        await context.close();
      });
    }
  }
}

test('reduzierte Bewegung: alles erscheint ohne Animation vollständig', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Berlin' });
  const page = await context.newPage();
  const { errors } = await boot(page, { migrated: true });
  await openOverview(page);
  await expect(page.getByTestId('streak-count')).toHaveText('12');
  expect(errors).toEqual([]);
  await context.close();
});

// Prüfbericht W2: Reiterleiste bei 390 px – jede Beschriftung einzeilig, mit Abstand zum
// Nachbarn, Touch-Ziele ≥ 44 px (beide Sprachen).
for (const lang of LANGS) {
  test(`Reiterleiste 390 px einzeilig mit Abstand (${lang})`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'Europe/Berlin' });
    const page = await context.newPage();
    const { errors } = await boot(page, { lang, migrated: true });
    await screen(page, 'today');
    const boxes = await page.getByTestId('tabbar').locator('button').evaluateAll((els) =>
      els.map((el) => {
        const text = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
        const range = document.createRange();
        if (text) range.selectNodeContents(text);
        const lines = text ? new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size : 0;
        const tr = range.getBoundingClientRect();
        const b = el.getBoundingClientRect();
        return { label: text?.textContent ?? '', lines, h: b.height, w: b.width, left: b.left, right: b.right, textLeft: tr.left, textRight: tr.right };
      }),
    );
    expect(boxes).toHaveLength(5);
    for (const b of boxes) {
      expect(b.lines, b.label).toBe(1);
      expect(b.h, b.label).toBeGreaterThanOrEqual(44);
      // Text bleibt im Knopf, mit Luft zum Rand.
      expect(b.textLeft - b.left, b.label).toBeGreaterThanOrEqual(2);
      expect(b.right - b.textRight, b.label).toBeGreaterThanOrEqual(2);
    }
    for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.textLeft - boxes[i - 1]!.textRight).toBeGreaterThanOrEqual(8);
    expect(errors).toEqual([]);
    await context.close();
  });
}

// Phase 6 (Plan §13, P7-2): Dein Stand mit vier Reitern und der Wortschatztest in allen Breiten,
// Modi und Sprachen. Englische Inhalte (lang="en") zählen in der DE-Oberfläche nicht als Mischsprache.
const P6_GERMAN_IN_EN = /[äöüÄÖÜß]|\b(und|nicht|wird|Karten|Tage|Urteil|Fehler|Verlauf|Weiter|Kenne)\b/;
const P6_ENGLISH_UI_IN_DE = /\b(Judgment|Mistakes|History|Next|Skills|Strengths|Practice|Start test)\b/;

for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    for (const lang of LANGS) {
      test(`stand6-${vp.name}-${theme}-${lang}`, async ({ browser }) => {
        test.setTimeout(120_000);
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          isMobile: vp.mobile,
          hasTouch: vp.mobile,
          deviceScaleFactor: vp.mobile ? 2 : 1,
          timezoneId: 'Europe/Berlin',
          locale: lang === 'de' ? 'de-DE' : 'en-US',
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        const { errors, external } = await boot(page, { theme, lang, migrated: true });
        await progressTour(page, async (name) => {
          expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), name).toBe(BG[theme]);
          expect(await layoutProblems(page), name).toEqual([]);
          const text = await page.evaluate(() => {
            const clone = document.querySelector('main')?.cloneNode(true) as HTMLElement | undefined;
            if (!clone) return '';
            clone.querySelectorAll('[lang]').forEach((n) => {
              if (n.getAttribute('lang') !== document.documentElement.lang) n.remove();
            });
            return clone.innerText;
          });
          if (lang === 'en') expect(P6_GERMAN_IN_EN.exec(text)?.[0] ?? null, `${name}: Deutsch in der englischen Oberfläche`).toBeNull();
          else expect(P6_ENGLISH_UI_IN_DE.exec(text)?.[0] ?? null, `${name}: Englische Bedienelemente in der deutschen Oberfläche`).toBeNull();
          if (theme !== 'dim') await page.screenshot({ path: `${SHOTS}/p6-${name}-${vp.name}-${theme}-${lang}.png`, fullPage: true });
        });
        expect(errors).toEqual([]);
        expect(external).toEqual([]);
        await context.close();
      });
    }
  }
}

// Lücken aus dem Abgleich: „Was ist neu" und Nachtragen-Hinweis auf Heute, Wochen-Check-Angebot,
// Wochen-Check (Aufgabe und Ergebnis), Einstellungen mit Farbthema und beruflichem Kontext – in
// allen Breiten, Modi und Sprachen. Englische Inhalte (lang="en") zählen nicht als Mischsprache.
for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    for (const lang of LANGS) {
      test(`neu-${vp.name}-${theme}-${lang}`, async ({ browser }) => {
        test.setTimeout(90_000);
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          isMobile: vp.mobile,
          hasTouch: vp.mobile,
          deviceScaleFactor: vp.mobile ? 2 : 1,
          timezoneId: 'Europe/Berlin',
          locale: lang === 'de' ? 'de-DE' : 'en-US',
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        const { errors, external } = await boot(page, {
          theme,
          lang,
          migrated: true,
          whatsNew: true,
          fake: { patch: { 'app/profile': { newPerDay: 0, plan: { d: '2026-09-20', v: 1, ids: [], why: [], duty: [], goal: { review: 0 }, lesson: null, at: 1 } } } },
          localStorage: {
            'sw2:__dirty': JSON.stringify({ 'vocab/vom-handy': 1_789_950_000_000 }),
            'sw2:vocab/vom-handy': JSON.stringify({ word: 'from the phone', de: 'vom Handy', state: 'new', S: 0 }),
          },
        });
        const check = async (name: string) => {
          expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), name).toBe(BG[theme]);
          expect(await layoutProblems(page), name).toEqual([]);
          const text = await page.evaluate(() => {
            const clone = document.body.cloneNode(true) as HTMLElement;
            clone.querySelectorAll('[lang]').forEach((n) => {
              if (n.getAttribute('lang') !== document.documentElement.lang) n.remove();
            });
            clone.querySelectorAll('.sr-only').forEach((n) => n.remove());
            return clone.innerText;
          });
          if (lang === 'en') expect(P6_GERMAN_IN_EN.exec(text)?.[0] ?? null, `${name}: Deutsch in der englischen Oberfläche`).toBeNull();
          else expect(P6_ENGLISH_UI_IN_DE.exec(text)?.[0] ?? null, `${name}: Englische Bedienelemente in der deutschen Oberfläche`).toBeNull();
          if (theme !== 'dim') await page.screenshot({ path: `${SHOTS}/neu-${name}-${vp.name}-${theme}-${lang}.png`, fullPage: true });
        };
        await screen(page, 'today');
        await expect(page.getByTestId('late-rescue-hint')).toBeVisible();
        await expect(page.getByTestId('check-offer')).toBeVisible();
        await page.getByTestId('whats-new-more').click();
        await check('heute');
        await page.getByTestId('check-offer-start').click();
        await expect(page.getByTestId('check-item')).toBeVisible();
        await check('wochencheck');
        await playCheck(page);
        await check('wochencheck-ergebnis');
        await page.getByTestId('summary-back').click();
        await screen(page, 'overview');
        await page.getByTestId('open-settings').click();
        await expect(page.getByTestId('work-ctx')).toBeVisible();
        await check('einstellungen');
        expect(errors).toEqual([]);
        expect(external).toEqual([]);
        await context.close();
      });
    }
  }
}
