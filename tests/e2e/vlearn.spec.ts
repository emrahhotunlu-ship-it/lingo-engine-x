import { retypeIfAsked } from './learnHelpers';
import { passPick } from './wortschatzHelpers';
import { expect, test, type Page } from '@playwright/test';
import { boot, bootAt, layoutProblems, MIGRATED, SEED_EVENING, screen } from './fixtures';
import { TUE_9 } from './heuteHelpers';
import { dump } from './trainerHelpers';

// Wörter-Modul V3 Schritt 2b-2: neue Lernrunde (Route `vlearn`) hinter dem Schalter `vcfg.mod = 1` und der fertigen Umrechnung.
// Ohne Schalter: ruhiger Hinweis, nichts geschrieben. Mit Schalter: Karte → Aufdecken/„Weiß ich nicht“ → Band → Weiter, je Antwort ein Verlaufseintrag.

type Doc = Record<string, unknown>;
const NOW = Date.parse(SEED_EVENING);
const PATHS = ['vocab/access-rights', 'vocab/achieve', 'vocab/affect'];

/** Neues Lexem (Form wie `emptyLex` im Modul; hier als Literal, weil Tests außerhalb des Moduls nur die Türen nutzen). */
const newLex = (): Doc => ({
  v: 1,
  k: 'w',
  of: null,
  core: null,
  sense: null,
  lv: 1,
  u: { due: NOW, s: 0, d: 0, st: 0, reps: 0, lapses: 0, last: null, sd: 0, ls: 0 },
  b: null,
  day: null,
  dayU: null,
  step: null,
  ev: { f: [], o: 0, s: 0 },
  sn: [],
  gr: null,
  reg: null,
  pri: 'core',
  lc: 0,
  pair: null,
  mv: 0,
  // Wie nach der Umrechnung: die alten Antworten sind schon übernommen (sonst holte der Start sie nach).
  sync: NOW,
  mig: null,
  intro: null,
});

function patch(on: boolean): Record<string, Doc> {
  const p: Record<string, Doc> = {
    'app/schema': { ...MIGRATED['app/schema'], ...(on ? { vocabModule: { v: 1, t: NOW - 3_600_000, state: 'done' } } : {}) },
    'app/profile': { vcfg: { min: 15, ret: 0.9, mod: on ? 1 : 0 } },
  };
  for (const path of PATHS) p[path] = { lex: newLex() };
  return p;
}

/** Die Pflicht-Runde durchklicken: Einführungen aufdecken, Abfragen mit „Weiß ich nicht“, bis der Abschluss steht. */
async function playRound(page: Page, base: number): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const check = page.getByTestId('vm-check');
    const go = page.getByTestId('vm-intro-go');
    await expect(check.or(go).or(page.getByTestId('vm-done')).or(page.getByTestId('vm-pick')).first()).toBeVisible();
    if (await page.getByTestId('vm-done').isVisible()) return;
    if (await passPick(page)) continue;
    await page.clock.setFixedTime(new Date(base + (i + 1) * 60_000));
    // Kern (03.11.2026): neue Wörter zeigen erst die Einführungskarte – „Verstanden – weiter“ bucht sie und geht direkt weiter.
    if (await go.isVisible()) {
      await go.click();
      continue;
    }
    if ((await check.textContent()) === 'Aufdecken') await check.click();
    else await page.getByTestId('vm-dunno').click();
    await retypeIfAsked(page);
    await page.getByTestId('vm-next').click();
  }
}

const vlogEntries = (d: Record<string, Doc>): number =>
  Object.entries(d)
    .filter(([p]) => /^vlog\/\d/.test(p))
    .reduce((n, [, doc]) => n + Object.values((doc.e as Doc | undefined) ?? {}).filter(Boolean).length, 0);

test.describe('Handy 390', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('Schalter aus: ruhiger Hinweis mit Zurück, nichts geschrieben', async ({ page }) => {
    const { errors } = await bootAt(page, { name: 'vlearn', kind: 'more5' }, { migrated: false, fake: { patch: patch(false) } });
    await screen(page, 'vlearn');
    await expect(page.getByTestId('vm-notice')).toContainText('Die neue Wörter-App ist noch nicht eingeschaltet');
    await expect(page.getByTestId('vm-back')).toBeVisible();
    expect(vlogEntries(await dump(page))).toBe(0);
    expect(errors).toEqual([]);
  });

  test('Schalter an: neues Wort einführen → Band → Weiter; je Antwort ein Verlaufseintrag; ohne Querüberstand', async ({ page }) => {
    const { errors, external } = await bootAt(page, { name: 'vlearn', kind: 'more5' }, { migrated: false, fake: { patch: patch(true) } });
    await screen(page, 'vlearn');
    // Kern (03.11.2026): neues Wort = Einführungskarte mit EINEM Knopf; „Kenne ich schon“ steht dort nicht (Wort und Bedeutung sind schon sichtbar).
    await expect(page.getByTestId('vm-intro-go')).toBeVisible();
    await expect(page.getByTestId('vm-knowit')).toHaveCount(0);
    // Die eine Übungsleiste: ✕, Fortschritt, „Extra“ (UX-Prüfung V3 Nr. 1).
    await expect(page.getByTestId('vm-close')).toBeVisible();
    await expect(page.getByTestId('vm-progress').first()).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    // Einführung gelesen: „Verstanden – weiter“ bucht sie und zeigt die nächste Karte.
    await page.getByTestId('vm-intro-go').click();
    await expect.poll(async () => vlogEntries(await dump(page))).toBe(1);
    // Genau ein Wort ist eingeführt (Lernschritt A steht im Lexem).
    await expect
      .poll(async () => {
        const d = await dump(page);
        return PATHS.filter((p) => ((d[p]?.lex as Doc | undefined)?.intro ?? null) !== null).length;
      })
      .toBe(1);
    // Nächste Karte steht (Einführung des nächsten Worts oder Lernschritt).
    await expect(page.getByTestId('vm-check').or(page.getByTestId('vm-intro-go')).first()).toBeVisible();
    // ✕ verlässt die Runde ohne Nachfrage; nichts zusätzlich gebucht.
    await page.getByTestId('vm-close').click();
    await expect(page.locator('[data-screen="vlearn"]')).toHaveCount(0);
    expect(vlogEntries(await dump(page))).toBe(1);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
  test('Menü „…“: „Warum diese Aufgabe?“ nennt den Grund; „Aufgabe melden“ nach einer falschen Abfrage löscht den Fehler nicht und wird vermerkt', async ({ page }) => {
    const { errors } = await bootAt(page, { name: 'vlearn', kind: 'more5' }, { migrated: false, fake: { patch: patch(true) } });
    await screen(page, 'vlearn');
    // Einführung: der Grund steht im Menü („Neues Wort für heute.“); melden gibt es dort nicht (keine Abfrage).
    await page.getByTestId('exercise-menu').click();
    const list = page.getByTestId('exercise-menu-list');
    await expect(list.getByTestId('menu-report')).toHaveCount(0);
    await list.getByTestId('menu-whyTask').click();
    await expect(page.getByTestId('why-line').first()).toContainText('Neues Wort für heute.');
    // Bis zur ersten echten Abfrage (Lernschritt A): Einführungen aufdecken und weiter.
    for (let i = 0; i < 10 && (await page.getByTestId('vm-intro-go').or(page.getByTestId('vm-pick')).first().isVisible()); i++) {
      if (!(await passPick(page))) await page.getByTestId('vm-intro-go').click();
      await expect(page.getByTestId('vm-check').or(page.getByTestId('vm-intro-go')).or(page.getByTestId('vm-pick')).first()).toBeVisible();
    }
    await expect(page.getByTestId('vm-check')).toHaveText('Prüfen');
    // Die Uhr steht in den E2E-Tests (setFixedTime); eine Minute weiter, damit der Verlaufseintrag einen eigenen Zeitschlüssel hat.
    await page.clock.setFixedTime(new Date(NOW + 60_000));
    await page.getByTestId('vm-check').click();
    await expect(page.getByTestId('vm-next')).toBeVisible();
    await page.getByTestId('exercise-menu').click();
    await page.getByTestId('exercise-menu-list').getByTestId('menu-report').click();
    // Falsch am Einführungstag (Lernschritt A): Melden löscht den Fehler nicht, die Antwort zählt; der Verlauf trägt das Kennzeichen „unfair“ (4).
    await expect(page.getByText('Danke, gemeldet. Die Antwort zählt trotzdem, die Aufgabe wird geprüft.')).toBeVisible();
    await expect
      .poll(async () =>
        Object.entries(await dump(page))
          .filter(([p]) => /^vlog\/\d/.test(p))
          .flatMap(([, d]) => Object.values((d as { e: Record<string, unknown[] | null> }).e))
          .some((e) => Array.isArray(e) && typeof e[11] === 'number' && (e[11] & 4) === 4),
      )
      .toBe(true);
    expect(errors).toEqual([]);
  });
  test('Pflicht: Start „Wörter · ca. X Min.“ → Runde → Abschluss „Wörter erledigt“ mit morgen; „Fertig“ führt zu Heute', async ({ page }) => {
    test.setTimeout(90_000);
    const { errors } = await bootAt(page, { name: 'vlearn', kind: 'pflicht' }, { migrated: false, fake: { patch: patch(true) } });
    await screen(page, 'vlearn');
    await expect(page.getByTestId('vm-start')).toBeVisible();
    await expect(page.getByTestId('vm-start-title')).toContainText(/Wörter\s·\sca\.\s\d+\sMin\./);
    await expect(page.getByTestId('vm-start-why')).toContainText(/neue(, eingestreut| Wörter)/);
    await expect(page.getByTestId('vm-start-lock')).toContainText('Der Plan steht für heute fest');
    expect(await layoutProblems(page)).toEqual([]);
    await page.getByTestId('vm-start-go').click();
    // Durch die Runde: Einführungen aufdecken, Abfragen mit „Weiß ich nicht“ (Lernschritte kommen wieder, die Runde endet trotzdem).
    for (let i = 0; i < 60; i++) {
      if (await page.getByTestId('vm-done').isVisible()) break;
      const check = page.getByTestId('vm-check');
      const go = page.getByTestId('vm-intro-go');
      await expect(check.or(go).or(page.getByTestId('vm-done')).or(page.getByTestId('vm-pick')).first()).toBeVisible();
      if (await page.getByTestId('vm-done').isVisible()) break;
      if (await passPick(page)) continue;
      await page.clock.setFixedTime(new Date(NOW + (i + 1) * 60_000));
      if (await go.isVisible()) {
        await go.click();
        continue;
      }
      if ((await check.textContent()) === 'Aufdecken') await check.click();
      else await page.getByTestId('vm-dunno').click();
      await retypeIfAsked(page);
      await page.getByTestId('vm-next').click();
    }
    await expect(page.getByTestId('vm-done')).toBeVisible();
    await expect(page.getByTestId('vm-done')).toContainText('Wörter erledigt');
    await expect(page.getByTestId('vm-done-min')).toContainText('zählt zu deiner Pflicht');
    await expect(page.getByTestId('vm-done-learned')).toBeVisible();
    await expect(page.getByTestId('vm-done-tomorrow')).toContainText(/ca\. \d+ Min\./);
    expect(await layoutProblems(page)).toEqual([]);
    await page.getByTestId('vm-back').click();
    await expect(page.locator('[data-screen="vlearn"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Rausgehen und wieder rein (Emrah 04.11.2026): die Wörter-Runde zählt weiter, beantwortete Wörter kommen nicht noch einmal', async ({ page }) => {
    test.setTimeout(90_000);
    const base = Date.parse(TUE_9);
    const { errors } = await boot(page, { migrated: false, now: TUE_9, fake: { capabilities: { sample: false }, patch: patch(true) } });
    await screen(page, 'today');
    await expect.poll(async () => !!(await dump(page))['vmod/day']).toBe(true);
    await page.getByTestId('start').click();
    await screen(page, 'vlearn');
    await page.getByTestId('vm-start-go').click();
    const progress = page.getByTestId('vm-progress');
    await expect(progress).toHaveText(/^1 von \d+$/);
    const total = Number(/von (\d+)/.exec((await progress.textContent()) ?? '')![1]);
    expect(total).toBeGreaterThan(3);
    // Zwei Karten beantworten (Einführung „Verstanden“ oder Abfrage mit „Weiß ich nicht“).
    for (let i = 0; i < 2; i++) {
      await page.clock.setFixedTime(new Date(base + (i + 1) * 60_000));
      const go = page.getByTestId('vm-intro-go');
      const check = page.getByTestId('vm-check');
      await expect(check.or(go).first()).toBeVisible();
      if (await go.isVisible()) {
        await go.click();
        continue;
      }
      if ((await check.textContent()) === 'Aufdecken') await check.click();
      else await page.getByTestId('vm-dunno').click();
      await retypeIfAsked(page);
      await page.getByTestId('vm-next').click();
    }
    await expect(progress).toHaveText(`3 von ${total}`);
    await page.getByTestId('vm-close').click();
    await screen(page, 'today');
    // Wieder rein: der Zähler macht bei 3 weiter, die Gesamtzahl bleibt gleich.
    await page.getByTestId('start').click();
    await screen(page, 'vlearn');
    const go = page.getByTestId('vm-start-go');
    if (await go.isVisible().catch(() => false)) await go.click();
    await expect(progress).toHaveText(`3 von ${total}`);
    expect(errors).toEqual([]);
  });

  test('Heute (V3 Schritt 4b): Block „Wörter“ startet die neue Runde; Abschluss zählt für Heute und die Serie; „Fertig“ führt in die Einheit weiter', async ({ page }) => {
    test.setTimeout(90_000);
    const DAY = '2026-09-22';
    const { errors, external } = await boot(page, { migrated: false, now: TUE_9, fake: { capabilities: { sample: false }, patch: patch(true) } });
    await screen(page, 'today');
    await expect(page.getByTestId('start')).toHaveAttribute('data-duty', 'review');
    await expect(page.locator('[data-testid="duty"][data-duty="review"]')).toContainText('Deine Wörter für heute, passend zu deiner Zeit');
    // Block 1 hat die Minuten des eingefrorenen Wörter-Tagesplans (höchstens die Einstellung 15 Min.), dieselbe Zahl wie der Start der Runde.
    const blockMin = async () => ((await dump(page))['app/profile']?.plan as { u?: { b: [number, string, number][] } } | undefined)?.u?.b[0];
    await expect.poll(async () => (await blockMin())?.[1]).toBe('review');
    const min = (await blockMin())![2];
    expect(min).toBeGreaterThanOrEqual(1);
    expect(min).toBeLessThanOrEqual(15);
    expect((await dump(page))['vmod/day']).toBeTruthy();
    // Block-Name „Wörter“ wie in der Runde (Befund ux 4b Nr. 2).
    await expect(page.locator('[data-testid="duty"][data-duty="review"]')).toContainText('Wörter');
    await page.getByTestId('start').click();
    await screen(page, 'vlearn');
    await expect(page.getByTestId('vm-start')).toBeVisible();
    await expect(page.getByTestId('vm-start-title')).toContainText(new RegExp(`ca\\.\\s${min}\\sMin\\.`));
    await page.getByTestId('vm-start-go').click();
    await playRound(page, Date.parse(TUE_9));
    await expect(page.getByTestId('vm-done')).toContainText('Wörter erledigt');
    // Rundenende gespeichert: act.review (Heute „erledigt“, geräteübergreifend) und Antworten in days (Serie).
    await expect.poll(async () => (((await dump(page))['app/profile']?.act as Record<string, Doc> | undefined)?.[DAY] ?? {}).review).toBe(1);
    expect((((await dump(page))['app/profile']?.days as Record<string, number> | undefined)?.[DAY] ?? 0) > 0).toBe(true);
    // Politur P1 (13.11.2026): EIN Abschluss je Schritt – der Hauptknopf nennt den nächsten Schritt und startet ihn direkt (keine Zwischenkarte).
    await expect(page.getByTestId('vm-back')).toContainText(/Weiter: .+/);
    await page.getByTestId('vm-back').click();
    await expect(page.locator('[data-screen="vlearn"]')).toHaveCount(0);
    await expect(page.getByTestId('unit-between')).toHaveCount(0);
    await expect(page.locator('[data-screen="today"]')).toHaveCount(0);
    await expect(page.locator('[data-screen]').first()).toBeVisible();
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
});
