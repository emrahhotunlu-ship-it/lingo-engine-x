import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, placedProfile, type Theme } from './fixtures';

// Testwerkzeuge (nur im Test-Build) und Desktop-Layout. Die E2E laufen gegen den Test-Build
// (`npm run build:test`); dass der normale Build das Panel NICHT enthält, prüft `check:platform --prod`.

const TODAY = '2026-09-20';

const dump = (page: Page) => page.evaluate(() => window.__LINGO_FAKE__!.db.dump());

async function openSettings(page: Page) {
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('lx-test-tools')).toBeVisible();
}

async function runTool(page: Page, id: string, toastText: string) {
  await page.getByTestId(id).click();
  // Bei zweimal Drücken steht kurz dieselbe Meldung zweimal da: die neueste prüfen.
  await expect(page.getByRole('status').filter({ hasText: toastText }).last()).toBeVisible();
}

async function closeSettings(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('settings')).toHaveCount(0);
}

/** Erst prüfen, wenn die Einblendung fertig ist (halbe Deckkraft senkt den Kontrast). */
async function scan(page: Page, where: string) {
  await page.waitForFunction(() => Array.from(document.querySelectorAll('main > div, [role="dialog"]')).every((e) => getComputedStyle(e).opacity === '1'));
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(res.violations.map((v) => `${where}: ${v.id} – ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
  expect(await layoutProblems(page)).toEqual([]);
}

test.describe('Schnellstart ohne Einstufung', () => {
  test('Heute: „Einstufung überspringen" führt direkt zu einem Plan für heute', async ({ page }) => {
    const { external, errors } = await boot(page, { fake: { seed: 'empty' } });
    await expect(page.getByTestId('start-placement')).toBeVisible();
    await expect(page.getByTestId('tt-skip-placement')).toHaveText('Test: Einstufung überspringen (B2)');
    await page.getByTestId('tt-skip-placement').click();
    await expect(page.getByTestId('start-training')).toBeVisible();
    await expect(page.getByTestId('brief')).toContainText('neue Wörter');
    await expect(page.getByTestId('home-way')).toBeVisible();
    // Erledigt heißt erledigt: Mit Einstufung gibt es den Schnellstart nicht mehr.
    await expect(page.getByTestId('tt-skip-placement')).toHaveCount(0);
    await expect(page.getByTestId('start-placement')).toHaveCount(0);
    await expect
      .poll(async () => {
        const p = (await dump(page))['coach/profile'] as { placement?: { level?: string; size?: number }; planStart?: string; imported?: unknown } | undefined;
        return [p?.placement?.level, p?.placement?.size, p?.planStart, !!p?.imported];
      })
      .toEqual(['B2', 4200, '2026-08-26', true]);
    expect(await layoutProblems(page)).toEqual([]);
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Einstufung: der Schnellstart steht auch auf dem Einstiegsbildschirm', async ({ page }) => {
    await boot(page, { fake: { seed: 'empty' } });
    await expect(page.getByTestId('start-placement')).toBeEnabled();
    await page.getByTestId('start-placement').click();
    await expect(page.getByTestId('placement-start')).toBeVisible();
    await page.getByTestId('tt-skip-placement').click();
    await expect(page.getByTestId('home')).toBeVisible();
    await expect(page.getByTestId('start-training')).toBeVisible();
  });

  test('Test-Profil aus den Einstellungen setzen', async ({ page }) => {
    await boot(page, { fake: { seed: 'empty' } });
    await openSettings(page);
    await runTool(page, 'tt-profile', 'Test-Profil gesetzt');
    await closeSettings(page);
    await expect(page.getByTestId('start-training')).toBeVisible();
    await page.getByTestId('tab-plan').click();
    await expect(page.getByTestId('plan')).toContainText('B2');
  });
});

test.describe('Beispieldaten', () => {
  test('Beispiel-Fortschritt füllt Serie, Kurve, Prognose und Fahrplan', async ({ page }) => {
    const { errors } = await boot(page, { fake: { seed: 'empty' } });
    await page.getByTestId('tt-skip-placement').click();
    await openSettings(page);
    await runTool(page, 'tt-progress', 'Beispiel-Fortschritt gesetzt: 150 Karten, 24 Trainingstage');
    await closeSettings(page);
    await expect(page.getByTestId('streak')).toContainText('Tage in Folge');
    const streak = Number(/\d+/.exec(await page.getByTestId('streak').innerText())![0]);
    expect(streak).toBeGreaterThanOrEqual(24);
    // 30 Karten sind fällig: Heute nennt Wiederholungen.
    await expect(page.getByTestId('brief')).toContainText('Wiederholungen');
    await page.getByTestId('tab-plan').click();
    await expect(page.getByTestId('curve')).toBeVisible();
    await expect(page.getByTestId('curve-text')).toContainText('4.350');
    await expect(page.getByTestId('forecast')).toContainText('C1-Wortschatz');
    await expect(page.getByTestId('forecast')).not.toContainText('Die Prognose kommt');
    await expect(page.getByTestId('brief-text')).toContainText('Beispiel-Brief');
    await expect(page.getByTestId('meter-vocab')).toContainText('4.2');
    // 14 bewertete Beiträge plus eigene Zeit: 216 Minuten = 3,6 Stunden.
    await expect(page.getByTestId('meter-input')).toContainText('3,6 von 150 Stunden');
    expect(await layoutProblems(page)).toEqual([]);
    await expect.poll(async () => Object.keys(await dump(page)).filter((p) => p.startsWith('coach/cards-')).length).toBeGreaterThan(10);
    const d = await dump(page);
    expect(d['coach/checks']).toBeTruthy();
    expect(d['coach/briefs']).toBeTruthy();
    expect(Object.keys(d).some((p) => p.startsWith('coach/inlog-'))).toBe(true);
    expect(errors).toEqual([]);
  });

  test('Beispiel-Input legt zwei Beiträge an, zweimal Drücken verdoppelt nichts', async ({ page }) => {
    const { errors } = await boot(page, { fake: { seed: 'empty' } });
    await page.getByTestId('tt-skip-placement').click();
    await openSettings(page);
    await runTool(page, 'tt-input', 'Zwei Beispiel-Beiträge');
    await closeSettings(page);
    await page.getByTestId('tab-input').click();
    await expect(page.getByTestId('input-item')).toHaveCount(2);
    await expect(page.getByTestId('input')).toContainText('Beispiel: A short talk from the TED channel');
    await expect(page.getByTestId('input')).toContainText('Beispiel: Technology news from the BBC');
    await expect(page.locator('[data-testid="input-item"] a[href="https://www.youtube.com/@TED"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-item"] a[href="https://www.bbc.com/news/technology"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-item"][data-done="1"]')).toHaveCount(0);
    await openSettings(page);
    await runTool(page, 'tt-input', 'Zwei Beispiel-Beiträge');
    await closeSettings(page);
    await expect(page.getByTestId('input-item')).toHaveCount(2);
    expect(errors).toEqual([]);
  });

  test('Karten fällig machen: ohne Karten ein Hinweis, mit Karten gibt es Wiederholungen', async ({ page }) => {
    await boot(page, { fake: { seed: 'empty' } });
    await page.getByTestId('tt-skip-placement').click();
    await openSettings(page);
    await runTool(page, 'tt-due', 'Es gibt noch keine Karten');
    await runTool(page, 'tt-progress', 'Beispiel-Fortschritt gesetzt');
    await runTool(page, 'tt-due', '25 Karten sind jetzt fällig');
    await closeSettings(page);
    await expect(page.getByTestId('brief')).toContainText('55 Wiederholungen');
  });
});

test.describe('Heute zurücksetzen', () => {
  test('Einheit und Input sind wieder offen, die Einheit ist erneut startbar', async ({ page }) => {
    const done = { min: 22, ans: 40, ok: 33, nw: 10, core: 1, w: 1, g: 1, i: 1, ai: 1 };
    const item = { id: 'a', kind: 'article', title: 'Ein Artikel', source: 'Quelle', url: 'https://example.org/artikel', mins: 5 };
    const { errors } = await boot(page, {
      fake: {
        seed: 'empty',
        patch: {
          'coach/profile': placedProfile(),
          'coach/days-2026': { d: { [TODAY]: done } },
          'input/2026-09-20': { d: TODAY, items: [item] },
          'coach/inlog-2026-09': { it: { [`${TODAY}-a`]: { d: TODAY, m: 5, t: 'Ein Artikel', r: 'ok', l: 'right' } }, own: { [TODAY]: 20 } },
        },
      },
    });
    await expect(page.getByTestId('today-done')).toBeVisible();
    await expect(page.getByTestId('start-training')).toHaveCount(0);
    await openSettings(page);
    await runTool(page, 'tt-reset', 'Heute zurückgesetzt');
    await closeSettings(page);
    await expect(page.getByTestId('today-done')).toHaveCount(0);
    await expect(page.getByTestId('part-training')).toHaveAttribute('data-done', '0');
    await expect(page.getByTestId('part-input')).toHaveAttribute('data-done', '0');
    await expect(page.getByTestId('start-training')).toBeVisible();
    await expect
      .poll(async () => {
        const days = (await dump(page))['coach/days-2026'] as { d: Record<string, Record<string, number>> };
        const t = days.d[TODAY]!;
        return [t.core, t.w, t.g, t.i, t.ans, t.nw, t.ai];
      })
      .toEqual([0, 0, 0, 0, 0, 0, 1]);
    await page.getByTestId('start-training').click();
    await expect(page.getByTestId('session')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('Panel im Test-Build', () => {
  for (const theme of ['dark', 'light'] as Theme[]) {
    test.describe(`Handy, ${theme}`, () => {
      test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
      test('Einstellungen mit Testwerkzeugen: kein axe-Befund, kein Querscrollen', async ({ page }) => {
        await boot(page, { theme, fake: { seed: 'empty' } });
        await scan(page, 'Heute mit Schnellstart');
        await openSettings(page);
        await expect(page.getByTestId('lx-test-tools').getByRole('button')).toHaveCount(5);
        await scan(page, 'Einstellungen');
      });
    });
  }

  test('Version nennt den Test-Build', async ({ page }) => {
    await boot(page, { fake: { seed: 'empty' } });
    await page.getByTestId('open-settings').click();
    await expect(page.getByTestId('settings')).toContainText('Test-Build');
  });
});

// ── Desktop-Layout ab 1024 px ───────────────────────────────────────────────────────────────────

const inputDoc = {
  d: TODAY,
  items: [
    { id: 'a', kind: 'video', title: 'Beispiel: A short talk', source: 'TED', url: 'https://www.youtube.com/@TED', mins: 12, level: 'B2', topic: 'science', why_de: 'Warum dieser Beitrag.', tip_de: 'Ein Tipp.', words: [{ en: 'habit', de: 'Gewohnheit' }] },
    { id: 'b', kind: 'article', title: 'Beispiel: Tech news', source: 'BBC', url: 'https://www.bbc.com/news/technology', mins: 8, level: 'B2+', topic: 'tech', why_de: 'Noch ein Grund.', tip_de: 'Noch ein Tipp.', words: [{ en: 'launch', de: 'einführen' }] },
  ],
};
const desktopSeed = { seed: 'empty', patch: { 'coach/profile': placedProfile(), 'input/2026-09-20': inputDoc } } as const;

/** Inhalt mittig und breit genug, aber nicht über die Seite hinaus. */
async function contentBox(page: Page, testId: string) {
  return page.evaluate((id) => {
    const r = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
    return { left: r.left, right: window.innerWidth - r.right, width: r.width, vw: window.innerWidth };
  }, testId);
}

for (const theme of ['dark', 'light'] as Theme[]) {
  test.describe(`Desktop 1440 px, ${theme}`, () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('Navigation oben in der Kopfleiste, Heute · Input · Fahrplan · Übung · Einstufung ohne Befund', async ({ page }) => {
      const { external, errors } = await boot(page, { theme, fake: desktopSeed });
      await expect(page.getByTestId('home')).toBeVisible();
      // Genau eine Navigation, oben in der Kopfleiste; keine Leiste am unteren Rand.
      const nav = page.getByRole('navigation', { name: 'Navigation' });
      await expect(nav).toHaveCount(1);
      await expect(page.locator('header').getByRole('navigation', { name: 'Navigation' })).toBeVisible();
      const box = (await nav.boundingBox())!;
      expect(box.y + box.height).toBeLessThan(80);
      await expect(page.getByTestId('tab-home')).toHaveAttribute('aria-current', 'page');
      await scan(page, 'Heute');
      const home = await contentBox(page, 'home');
      expect(Math.abs(home.left - home.right)).toBeLessThan(2);
      expect(home.width).toBeLessThanOrEqual(1100);

      await page.getByTestId('tab-input').click();
      await expect(page.getByTestId('input-item')).toHaveCount(2);
      await expect(page.getByTestId('tab-input')).toHaveAttribute('aria-current', 'page');
      // Zwei Beiträge nebeneinander.
      const [a, b] = await page.getByTestId('input-item').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
      expect(Math.abs(a! - b!)).toBeLessThan(2);
      await scan(page, 'Input');

      await page.getByTestId('tab-plan').click();
      await expect(page.getByTestId('plan')).toBeVisible();
      await scan(page, 'Fahrplan');
      // Fahrplan zweispaltig: Messwerte links, Kurve rechts.
      const cols = await page.evaluate(() => [document.querySelector('[data-testid="meter-vocab"]')!, document.querySelector('[data-testid="check-card"]')!].map((e) => e.getBoundingClientRect().left));
      expect(cols[1]! - cols[0]!).toBeGreaterThan(300);

      await page.getByTestId('tab-home').click();
      await page.getByTestId('start-training').click();
      await expect(page.getByTestId('session')).toBeVisible();
      await expect(nav).toHaveCount(0);
      await scan(page, 'Übung');
      const session = await contentBox(page, 'session');
      expect(Math.abs(session.left - session.right)).toBeLessThan(2);

      expect(external).toEqual([]);
      expect(errors).toEqual([]);
    });

    test('Einstufung am Desktop', async ({ page }) => {
      await boot(page, { theme, fake: { seed: 'empty' } });
      await expect(page.getByTestId('start-placement')).toBeEnabled();
      await page.getByTestId('start-placement').click();
      await expect(page.getByTestId('placement-start')).toBeVisible();
      await scan(page, 'Einstufung');
      await page.getByTestId('placement-start').click();
      await expect(page.getByTestId('vocab-test')).toBeVisible();
      await scan(page, 'Einstufung, Wortschatz');
      const box = await contentBox(page, 'placement');
      expect(Math.abs(box.left - box.right)).toBeLessThan(2);
    });

    test('Einstellungen als Seitenleiste mit Testwerkzeugen', async ({ page }) => {
      await boot(page, { theme, fake: desktopSeed });
      await openSettings(page);
      await scan(page, 'Einstellungen');
    });
  });
}

test.describe('Desktop 2560 px', () => {
  test.use({ viewport: { width: 2560, height: 1440 } });

  test('nichts verloren, kein Querscrollen: Heute, Input, Fahrplan, Übung, Einstufung', async ({ page }) => {
    await boot(page, { theme: 'dark', fake: desktopSeed });
    const fits = async (testId: string) => {
      await expect(page.getByTestId(testId)).toBeVisible();
      expect(await layoutProblems(page)).toEqual([]);
      const box = await contentBox(page, testId);
      expect(Math.abs(box.left - box.right), testId).toBeLessThan(2);
      // Der Inhalt füllt einen sinnvollen Teil der Breite, ist aber nicht über die Seite gezogen.
      expect(box.width, testId).toBeGreaterThan(box.vw * 0.3);
      expect(box.width, testId).toBeLessThan(box.vw * 0.75);
    };
    await fits('home');
    await page.getByTestId('tab-input').click();
    await expect(page.getByTestId('input-item')).toHaveCount(2);
    await fits('input');
    await page.getByTestId('tab-plan').click();
    await fits('plan');
    await page.getByTestId('tab-home').click();
    await page.getByTestId('start-training').click();
    await fits('session');
    await page.getByTestId('session-quit').click();
    await expect(page.getByTestId('home')).toBeVisible();
  });

  test('Einstufung bei 2560 px', async ({ page }) => {
    await boot(page, { theme: 'light', fake: { seed: 'empty' } });
    await expect(page.getByTestId('start-placement')).toBeEnabled();
    await page.getByTestId('start-placement').click();
    await expect(page.getByTestId('placement')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    const box = await contentBox(page, 'placement');
    expect(Math.abs(box.left - box.right)).toBeLessThan(2);
    expect(box.width).toBeGreaterThan(box.vw * 0.25);
  });
});

test.describe('Handy bleibt unverändert', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('Reiterleiste unten, keine Navigation in der Kopfleiste', async ({ page }) => {
    await boot(page, { fake: { seed: 'empty', patch: { 'coach/profile': placedProfile() } } });
    await expect(page.getByTestId('home')).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Navigation' });
    await expect(nav).toHaveCount(1);
    await expect(page.locator('header').getByRole('navigation')).toHaveCount(0);
    const box = (await nav.boundingBox())!;
    expect(box.y).toBeGreaterThan(844 - 100);
    await page.getByTestId('tab-plan').click();
    await expect(page.getByTestId('plan')).toBeVisible();
  });
});
