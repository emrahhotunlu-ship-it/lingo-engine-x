import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, bootAt, layoutProblems, openTab, screen } from './fixtures';
import { openAllChapters } from './learnHelpers';

// Struktur-Film (Lernplattform 3.0 P61, Erlebnis-Engine §5.3): erst Vorhersage (Schritt 0), dann der Satz in Bewegung, am Ende „Nochmal“/„Fertig“.
// Drei Einstiege: Kapitelblatt, Einführungskarte (IntroFlow), Menü ⋯ „Zeig es mir“. Bei Effekt-Stufe „Aus“ läuft nichts von selbst (Knopf „Weiter“).
// Schalter `film` (und `program` für die Karte) per `lx:flags`.

const OLD = Date.parse('2020-01-01T10:00:00+01:00');

async function chapterFilm(page: Page, fx: 'full' | 'off') {
  const booted = await boot(page, { migrated: true, localStorage: { 'lx:flags': 'program,film', 'lx:fx': fx } });
  await screen(page, 'today');
  await openTab(page, 'learn');
  await page.locator('[data-testid="program-chapter"][data-chapter="k7"] [data-testid="program-chapter-open"]').click();
  const sheet = page.getByTestId('chapter-sheet');
  await expect(sheet.getByTestId('chapter-film')).toBeVisible();
  await sheet.getByTestId('film-open').click();
  const film = page.getByTestId('film');
  await expect(film).toHaveAttribute('data-phase', 'predict');
  return { ...booted, film };
}

/** Vorhersage beantworten (Wahl- oder Antipp-Frage): erst danach lässt sich der Film starten. */
async function predict(page: Page) {
  const film = page.getByTestId('film');
  await expect(film.getByTestId('film-question')).toBeVisible();
  await expect(film.getByTestId('film-play')).toBeDisabled();
  const opts = film.getByTestId('film-option');
  if (await opts.count()) await opts.first().click();
  else await film.getByTestId('film-word').first().click();
  await expect(film.getByTestId('film-guess')).toBeVisible();
  await expect(film.getByTestId('film-play')).toBeEnabled();
}

test.describe('Handy 360', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

  test('Kapitelblatt: Vorhersage → Film läuft von selbst bis zum Ende, Nochmal und Fertig; kein Querscrollen, axe 0', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const { errors, film } = await chapterFilm(page, 'full');
    expect(await layoutProblems(page)).toEqual([]);
    await predict(page);
    await film.getByTestId('film-play').click();
    await expect(film).toHaveAttribute('data-phase', 'play');
    await expect(film.getByTestId('film-note')).not.toBeEmpty();
    const dots = await film.getByTestId('film-dot').count();
    expect(dots).toBeGreaterThanOrEqual(2);
    await expect(film).toHaveAttribute('data-phase', 'end', { timeout: 20_000 });
    await expect(film).toHaveAttribute('data-step', String(dots - 1));
    await expect(film.getByTestId('film-end')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    const res = await new AxeBuilder({ page }).include('[data-testid="film"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(res.violations.map((v) => v.id)).toEqual([]);
    // Ruhe nach dem Ende: keine laufenden Animationen mehr im Film.
    await page.waitForTimeout(1200);
    const running = await film.evaluate((el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length);
    expect(running).toBe(0);
    await film.getByTestId('film-again').click();
    await expect(film).toHaveAttribute('data-phase', 'play');
    expect(errors).toEqual([]);
  });

  test('Effekt-Stufe Aus: nichts läuft von selbst, „Weiter“ führt Schritt für Schritt zum Ende', async ({ page }) => {
    const { errors, film } = await chapterFilm(page, 'off');
    await expect(film).toHaveAttribute('data-manual', 'true');
    await film.getByTestId('film-skip-predict').click();
    await expect(film).toHaveAttribute('data-step', '0');
    await page.waitForTimeout(4000);
    await expect(film).toHaveAttribute('data-step', '0');
    const dots = await film.getByTestId('film-dot').count();
    for (let i = 1; i < dots; i++) {
      await film.getByTestId('film-next').click();
      await expect(film).toHaveAttribute('data-step', String(i));
    }
    await film.getByTestId('film-next').click();
    await expect(film).toHaveAttribute('data-phase', 'end');
    expect(await film.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
    expect(errors).toEqual([]);
  });
});

test.describe('Handy 390', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Menü ⋯ „Zeig es mir“ in einer Aufgabe mit Film öffnet das Blatt mit dem Film zum Muster', async ({ page }) => {
    const err = { q: 'The company ___ planning to move its headquarters.', given: '', ans: 'is said to be', t: OLD, due: OLD, box: 0, src: 'seed', cid: 'kwt-9001', pat: 'pp.personal', pts: [0, 2] };
    const doc = { id: 'passive-plus', p: 0.5, anchor: 0.5, anchorD: '2026-09-15', n: 8, c: 6, due: OLD, last: OLD, recent: [1, 1, 1, 1], seen: [], seenText: [], hist: [{ d: '2026-09-15', p: 0.5 }], errors: [err] };
    const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'errors' }, { localStorage: { 'lx:flags': 'kwt,film', 'lx:fx': 'off' }, fake: { patch: { 'grammar/passive-plus': doc } } });
    await expect(page.getByTestId('gr-item')).toBeVisible();
    // Das Menü ⋯ gibt es nach der Antwort (Rückmeldung): Umformung mit Bausteinen legen und prüfen.
    for (const w of ['is', 'SAID', 'to', 'be']) await page.locator(`[data-testid="tile-pool"] [data-testid="tile"][data-tile="${w}"]`).first().click();
    await page.getByTestId('check').click();
    await expect(page.getByTestId('verdict')).toBeVisible();
    await page.getByTestId('exercise-menu').click();
    await page.getByTestId('menu-showMe').click();
    const film = page.getByTestId('film');
    await expect(film).toHaveAttribute('data-film', 'f.pp.personal');
    await predict(page);
    expect(await layoutProblems(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('film')).toHaveCount(0);
    await expect(page.getByTestId('gr-item')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Ohne Schalter `film`: kein Einstieg im Menü und im Kapitelblatt', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true, localStorage: { 'lx:flags': '{"program":true,"fx":{"film":false}}' } });
    await screen(page, 'today');
    await openTab(page, 'learn');
    await page.locator('[data-testid="program-chapter"][data-chapter="k7"] [data-testid="program-chapter-open"]').click();
    await expect(page.getByTestId('chapter-sheet')).toBeVisible();
    await expect(page.getByTestId('chapter-film')).toHaveCount(0);
    await expect(page.getByTestId('film-open')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Einführungskarte eines neuen C1-Themas bietet den Film an', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true, localStorage: { 'lx:flags': 'film', 'lx:fx': 'off' } });
    await screen(page, 'today');
    await openTab(page, 'learn');
    await openAllChapters(page);
    await page.locator('[data-testid="topic"][data-topic="inversion"]').click();
    await page.getByTestId('topic-start').click();
    await expect(page.getByTestId('intro-flow')).toHaveAttribute('data-topic', 'inversion');
    const launch = page.getByTestId('intro-context').getByTestId('film-open');
    await expect(launch).toBeVisible();
    await launch.click();
    await expect(page.getByTestId('film')).toHaveAttribute('data-phase', 'predict');
    expect(await layoutProblems(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
});

test.describe('Vorhersage verrät nichts', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Vor der Antwort leuchtet kein Wort; nach der Antwort zeigt Schritt 0 seine Signalwörter', async ({ page }) => {
    const { errors, film } = await chapterFilm(page, 'full');
    await expect(film.getByTestId('film-word').first()).toBeVisible();
    await expect(film.locator('[data-testid="film-word"][data-hi]')).toHaveCount(0);
    await predict(page);
    // Schritt 0 hat in jedem Film Signalwörter (Struktur-Filme der Charge 1 und der Piloten): erst jetzt sind sie sichtbar.
    await expect(film.locator('[data-testid="film-word"][data-hi]').first()).toBeVisible();
    expect(errors).toEqual([]);
  });
});
