import { expect, test } from '@playwright/test';
import { bootAt, layoutProblems, MIGRATED, SEED_EVENING, screen } from './fixtures';
import { dump } from './trainerHelpers';

// Wörter-Modul V3 Schritt 2b-2: neue Lernrunde (Route `vlearn`) hinter dem Schalter `vcfg.mod = 1` und der fertigen Umrechnung.
// Ohne Schalter: ruhiger Hinweis, nichts geschrieben. Mit Schalter: Karte → Aufdecken/„Weiß ich nicht“ → Band → Weiter, je Antwort ein Verlaufseintrag.

type Doc = Record<string, unknown>;
const NOW = Date.parse(SEED_EVENING);
const PATHS = ['vocab/access-rights', 'vocab/achieve', 'vocab/affect'];

/** Neues Lexem (Form wie `emptyLex` im Modul; hier als Literal, weil Tests außerhalb des Moduls nur die Türen nutzen). */
const newLex = (): Doc => ({
  v: 1, k: 'w', of: null, core: null, sense: null, lv: 1,
  u: { due: NOW, s: 0, d: 0, st: 0, reps: 0, lapses: 0, last: null, sd: 0, ls: 0 },
  b: null, day: null, dayU: null, step: null, ev: { f: [], o: 0, s: 0 }, sn: [], gr: null, reg: null, pri: 'core', lc: 0, pair: null, mv: 0, sync: 0, mig: null, intro: null,
});

function patch(on: boolean): Record<string, Doc> {
  const p: Record<string, Doc> = {
    'app/schema': { ...MIGRATED['app/schema'], ...(on ? { vocabModule: { v: 1, t: NOW - 3_600_000, state: 'done' } } : {}) },
    'app/profile': { vcfg: { min: 15, ret: 0.9, mod: on ? 1 : 0 } },
  };
  for (const path of PATHS) p[path] = { lex: newLex() };
  return p;
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
    await expect(page.getByTestId('vm-check')).toBeVisible();
    await expect(page.getByTestId('vm-knowit')).toBeVisible();
    // Die eine Übungsleiste: ✕, Fortschritt, „Extra“ (UX-Prüfung V3 Nr. 1).
    await expect(page.getByTestId('vm-close')).toBeVisible();
    await expect(page.getByTestId('vm-progress').first()).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    // Einführung ohne Eingabe: Aufdecken zeigt die Lösung im Band.
    await expect(page.getByTestId('vm-check')).toHaveText('Aufdecken');
    await page.getByTestId('vm-check').click();
    await expect(page.getByTestId('vm-next')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    await page.getByTestId('vm-next').click();
    await expect.poll(async () => vlogEntries(await dump(page))).toBe(1);
    // Genau ein Wort ist eingeführt (Lernschritt A steht im Lexem).
    await expect.poll(async () => {
      const d = await dump(page);
      return PATHS.filter((p) => ((d[p]?.lex as Doc | undefined)?.intro ?? null) !== null).length;
    }).toBe(1);
    // Nächste Karte steht (Einführung des nächsten Worts oder Lernschritt).
    await expect(page.getByTestId('vm-check')).toBeVisible();
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
    for (let i = 0; i < 10 && (await page.getByTestId('vm-check').textContent()) === 'Aufdecken'; i++) {
      await page.getByTestId('vm-check').click();
      await page.getByTestId('vm-next').click();
      await expect(page.getByTestId('vm-check')).toBeVisible();
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
    await expect(page.getByTestId('vm-start-title')).toContainText(/Wörter · ca\. \d+ Min\./);
    await expect(page.getByTestId('vm-start-why')).toContainText('neue, eingestreut');
    await expect(page.getByTestId('vm-start-lock')).toContainText('Der Plan steht für heute fest');
    expect(await layoutProblems(page)).toEqual([]);
    await page.getByTestId('vm-start-go').click();
    // Durch die Runde: Einführungen aufdecken, Abfragen mit „Weiß ich nicht“ (Lernschritte kommen wieder, die Runde endet trotzdem).
    for (let i = 0; i < 60; i++) {
      if (await page.getByTestId('vm-done').isVisible()) break;
      const check = page.getByTestId('vm-check');
      await expect(check.or(page.getByTestId('vm-done'))).toBeVisible();
      if (await page.getByTestId('vm-done').isVisible()) break;
      await page.clock.setFixedTime(new Date(NOW + (i + 1) * 60_000));
      if ((await check.textContent()) === 'Aufdecken') await check.click();
      else await page.getByTestId('vm-dunno').click();
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
});


