import { retypeIfAsked } from './learnHelpers';
import { expect, test, type Page } from '@playwright/test';
import { boot, bootAt, MIGRATED, SEED_EVENING, screen } from './fixtures';
import { forcedPatch, planPatch, TYPE_MODE } from './trainerHelpers';

// Bedienung der Lücke (UX-Neuanfang 02.11.2026, Teil A): freier Cursor in jeder Lücke (Pfeile, Pos1/Ende, Markieren, Strg+A, Klick bzw.
// Tippen auf einen Buchstaben), sichtbarer Cursor, jede neue Aufgabe sofort tippbereit (Laptop und Handy mit Touch), Tippen ohne Fokus
// landet in der Lücke, und der Knopf „Claude erklärt“ steht schon vor dem Prüfen da (Handy oben rechts in der Übungsleiste).

type Doc = Record<string, unknown>;
const NOW = Date.parse(SEED_EVENING);

/** Text der Lücke aus den Buchstaben (ohne ausblendende Buchstaben, die gerade gelöscht wurden). */
const gapText = (page: Page): Promise<string> =>
  page.locator('[data-testid="gap"] [data-letter]').evaluateAll((els) =>
    els
      .filter((e) => getComputedStyle(e).opacity !== '0' || e.getAttribute('data-landed') === 'false')
      .map((e) => (e.textContent ?? '').replace(/\u00a0/g, ' '))
      .join(''),
  );
const active = (page: Page): Promise<string | null> => page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null);

/** Klick bzw. Tippen auf den linken Rand des n-ten Buchstabens (Cursor davor). */
async function pointAtLetter(page: Page, n: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('[data-testid="gap"] [data-letter]').nth(n).boundingBox();
  expect(box).not.toBeNull();
  return { x: (box?.x ?? 0) + Math.max(1, (box?.width ?? 4) * 0.2), y: (box?.y ?? 0) + (box?.height ?? 10) / 2 };
}

async function startTypeCard(page: Page, tap = false): Promise<string[]> {
  const { errors } = await boot(page, { migrated: true, fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), 'vocab/struggle': forcedPatch()['vocab/struggle'] ?? {} } } });
  await screen(page, 'today');
  if (tap) await page.getByTestId('start').tap();
  else await page.getByTestId('start').click();
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'type');
  return errors;
}

/** Kern (03.11.2026): neue Wörter kommen erst mit der Einführungskarte – durchtippen bis zur ersten Lücke. */
async function pastIntros(page: Page, tap = false): Promise<void> {
  const go = page.getByTestId('vm-intro-go');
  await expect(go.or(page.getByTestId('vm-check')).first()).toBeVisible();
  for (let i = 0; i < 5 && (await go.isVisible()); i++) {
    if (tap) await go.tap();
    else await go.click();
    await page.waitForTimeout(150);
  }
}

/** Neues Lexem der Wörter-App (wie in vlearn.spec.ts). */
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
  sync: 0,
  mig: null,
  intro: null,
});
function vocabPatch(): Record<string, Doc> {
  const p: Record<string, Doc> = {
    'app/schema': { ...MIGRATED['app/schema'], vocabModule: { v: 1, t: NOW - 3_600_000, state: 'done' } },
    'app/profile': { vcfg: { min: 15, ret: 0.9, mod: 1 } },
  };
  for (const path of ['vocab/access-rights', 'vocab/achieve', 'vocab/affect']) p[path] = { lex: newLex() };
  return p;
}

test.describe('Laptop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('freier Cursor: „trade“, 3× ←, „X“ → „trXade“; Klick auf einen Buchstaben, Pos1/Entf, Strg+A; Cursor sichtbar', async ({ page }) => {
    const errors = await startTypeCard(page);
    // Sofort tippbereit: ohne Klick in die Lücke.
    await page.keyboard.type('trade');
    await expect.poll(() => gapText(page)).toBe('trade');
    await expect(page.getByTestId('gap-input')).toBeFocused();
    await expect(page.getByTestId('gap-caret')).toBeVisible();
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft');
    await page.keyboard.type('X');
    await expect.poll(() => gapText(page)).toBe('trXade');
    await expect(page.getByTestId('gap-input')).toHaveValue('trXade');
    // Der sichtbare Cursor steht hinter dem „X“ (vor dem „a“).
    // Gemessen, sobald Flieger und Feder zur Ruhe gekommen sind.
    await expect
      .poll(async () => {
        const a = await pointAtLetter(page, 3);
        const caret = await page.getByTestId('gap-caret').boundingBox();
        return Math.abs((caret?.x ?? 0) - (a.x - 1));
      })
      .toBeLessThan(6);
    // Rücktaste wirkt an der Cursorstelle.
    await page.keyboard.press('Backspace');
    await expect.poll(() => gapText(page)).toBe('trade');
    // Klick auf einen Buchstaben setzt den Cursor davor.
    const r = await pointAtLetter(page, 1);
    await page.mouse.click(r.x, r.y);
    await page.keyboard.type('Q');
    await expect.poll(() => gapText(page)).toBe('tQrade');
    // Pos1 + Entf löscht den ersten Buchstaben; Ende + Rücktaste den letzten.
    await page.keyboard.press('Home');
    await page.keyboard.press('Delete');
    await page.keyboard.press('End');
    await page.keyboard.press('Backspace');
    await expect.poll(() => gapText(page)).toBe('Qrad');
    // Shift-Markieren und überschreiben.
    await page.keyboard.press('Shift+ArrowLeft');
    await page.keyboard.press('Shift+ArrowLeft');
    await expect(page.locator('[data-testid="gap"] [data-letter][data-sel]')).toHaveCount(2);
    await page.keyboard.type('ug');
    await expect.poll(() => gapText(page)).toBe('Qrug');
    // Strg/Cmd+A und neu tippen.
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('struggle');
    await expect.poll(() => gapText(page)).toBe('struggle');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    expect(errors).toEqual([]);
  });

  test('„Claude erklärt“ steht vor dem Prüfen da; Tipp öffnet Claude mit der Aufgabe; Hilfsknöpfe nehmen der Lücke den Fokus nicht', async ({ page }) => {
    const errors = await startTypeCard(page);
    const btn = page.getByTestId('claude-explain');
    await expect(btn).toBeVisible();
    // Kern (03.11.2026): der Knopf heißt „Frag Claude“ und steht oben in der Übungsleiste.
    await expect(btn).toHaveText('Frag Claude');
    // Trefferfläche ≥ 44 px (nach dem Einblenden der Karte gemessen).
    await expect.poll(async () => Math.round((await btn.boundingBox())?.height ?? 0)).toBeGreaterThanOrEqual(44);
    await page.keyboard.type('str');
    // „Wozu?“ mit der Maus: der Cursor bleibt in der Lücke, weitertippen geht.
    await page.getByTestId('purpose-info').click();
    await expect(page.getByTestId('gap-input')).toBeFocused();
    await page.keyboard.type('ug');
    await expect.poll(() => gapText(page)).toBe('strug');
    // Tab-Reihenfolge: aus der Lücke zum nächsten Bedienelement danach, Shift+Tab zurück in die Lücke.
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('gap-input')).not.toBeFocused();
    expect(await page.evaluate(() => !!document.activeElement && document.activeElement !== document.body)).toBe(true);
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByTestId('gap-input')).toBeFocused();
    await page.keyboard.type('g');
    await expect.poll(() => gapText(page)).toBe('strugg');
    await btn.click();
    await expect(page.getByTestId('companion')).toBeVisible();
    // Vor dem Prüfen: Claude bekommt die Aufgabe, nie die Lösung.
    await expect(page.getByTestId('companion')).toContainText('ohne die Lösung zu verraten');
    // Esc schließt das Fenster; die Übung bleibt.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('companion')).toHaveCount(0);
    await expect(page.getByTestId('exercise')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Grammatik und C1-Aufgabe: „Claude erklärt“ steht vor dem Prüfen in der Aufgabenzeile', async ({ page }) => {
    const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'xtra' });
    await expect(page.getByTestId('gr-item')).toBeVisible();
    // Kern: „Frag Claude“ steht oben in der Übungsleiste (nicht mehr in der Aufgabenzeile).
    await expect(page.getByTestId('exercise-bar').getByTestId('claude-explain')).toBeVisible();
    await expect(page.getByTestId('claude-explain')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('C1-Aufgabe (Umformen): „Claude erklärt“ vor dem Prüfen', async ({ page }) => {
    const OLD = Date.parse('2020-01-01T10:00:00+01:00');
    const err: Doc = {
      q: 'The company ___ planning to move its headquarters.',
      given: '',
      ans: 'is said to be',
      t: OLD,
      due: OLD,
      box: 0,
      src: 'seed',
      cid: 'kwt-9001',
      pat: 'pp.personal',
      pts: [0, 2],
    };
    const topic: Doc = {
      id: 'passive-plus',
      p: 0.9,
      anchor: 0.9,
      anchorD: '2026-09-15',
      n: 8,
      c: 6,
      due: OLD,
      last: OLD,
      recent: [1, 1, 1, 1],
      seen: [],
      seenText: [],
      hist: [{ d: '2026-09-15', p: 0.9 }],
      errors: [err],
    };
    const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'errors' }, { localStorage: { 'lx:flags': 'kwt' }, fake: { patch: { 'grammar/passive-plus': topic } } });
    await expect(page.getByTestId('c1x-kwt')).toBeVisible();
    await expect(page.getByTestId('claude-explain')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Wörter-App: nächste Karte sofort tippbereit; ein Buchstabe ohne Fokus landet in der Lücke', async ({ page }) => {
    const { errors } = await bootAt(page, { name: 'vlearn', kind: 'more5' }, { migrated: false, fake: { patch: vocabPatch() } });
    await screen(page, 'vlearn');
    await pastIntros(page);
    await expect(page.getByTestId('vm-check')).toBeVisible();
    await expect(page.getByTestId('claude-explain')).toBeVisible();
    await expect(page.getByTestId('gap-input')).toBeFocused();
    await page.getByTestId('vm-check').click();
    await retypeIfAsked(page);
    await page.getByTestId('vm-next').click();
    await expect(page.getByTestId('vm-check')).toBeVisible();
    await expect(page.getByTestId('gap-input')).toBeFocused();
    // Fokus weg (z. B. nach einem Klick ins Leere): ein Buchstabe landet trotzdem in der Lücke.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    expect(await active(page)).toBeNull();
    await page.keyboard.type('ac');
    await expect.poll(() => gapText(page)).toBe('ac');
    await expect(page.getByTestId('gap-input')).toBeFocused();
    expect(errors).toEqual([]);
  });
});

test.describe('Handy mit Touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('Tippen auf einen Buchstaben setzt den Cursor; „Claude erklärt“ oben rechts in der Leiste, vor dem Prüfen', async ({ page }) => {
    const errors = await startTypeCard(page, true);
    const bar = page.getByTestId('exercise-bar');
    await expect(bar.getByTestId('claude-explain')).toBeVisible();
    await expect(page.getByTestId('claude-explain')).toHaveCount(1);
    await expect.poll(async () => Math.round((await bar.getByTestId('claude-explain').boundingBox())?.height ?? 0)).toBeGreaterThanOrEqual(44);
    await page.getByTestId('gap-input').tap();
    await expect(page.getByTestId('gap-input')).toBeFocused();
    await page.keyboard.type('trade');
    await expect.poll(() => gapText(page)).toBe('trade');
    const r = await pointAtLetter(page, 2);
    await page.touchscreen.tap(r.x, r.y);
    await page.keyboard.type('X');
    await expect.poll(() => gapText(page)).toBe('trXade');
    expect(errors).toEqual([]);
  });

  test('Wörter-App: nach „Weiter“ steht der Fokus sofort in der neuen Lücke (Tastatur bleibt offen)', async ({ page }) => {
    const { errors } = await bootAt(page, { name: 'vlearn', kind: 'more5' }, { migrated: false, fake: { patch: vocabPatch() } });
    await screen(page, 'vlearn');
    await pastIntros(page, true);
    await expect(page.getByTestId('exercise-bar').getByTestId('claude-explain')).toBeVisible();
    await page.getByTestId('gap-input').tap();
    await page.getByTestId('vm-check').tap();
    await retypeIfAsked(page);
    await page.getByTestId('vm-next').tap();
    await expect(page.getByTestId('vm-check')).toBeVisible();
    await expect(page.getByTestId('gap-input')).toBeFocused();
    await page.keyboard.type('ab');
    await expect.poll(() => gapText(page)).toBe('ab');
    expect(errors).toEqual([]);
  });
});
