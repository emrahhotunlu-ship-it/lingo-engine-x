import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openSettings, screen } from './fixtures';
import { RECALLED, TYPE_MODE, dump, planPatch } from './trainerHelpers';
import { ankiPatch } from './wortschatzHelpers';
import { exDeKey } from '../../src/domain/srs/exDeKey';

// Relaunch Stufe 1 P7 S1-DIKTAT (docs/relaunch/stufe1-plan.md §7): Laptop-Diktat-Probe in Einstellungen › Diagnose, Hinweiszeile
// über dem Antwortfeld der Sprechaufgabe „Sag es“ und „Am Handy sprechen“ (= „Pause, später weiter“).
// Diktat wird simuliert über `keyboard.insertText` (ein `beforeinput` „insertText“ ohne `keydown`), Tippen über `keyboard.type`.
// Die Tests laufen auf Linux-Chromium: Ein Init-Skript gibt sich als Chrome auf macOS aus (`navigator.userAgentData`).

type Doc = Record<string, unknown>;
const SEED = JSON.parse(readFileSync(new URL('../../seed/sample-data.json', import.meta.url), 'utf8')) as Record<string, Doc>;
const OUT = process.env.P7_SHOTS ?? '/tmp/claude-0/-home-user-lingo-engine-x/6af5333d-eebb-5460-9a49-5f84302bde29/scratchpad/p7-shots';
mkdirSync(OUT, { recursive: true });

const TARGET = "I'll send you the revised quote by Friday.";
const LAPTOP = { width: 1440, height: 900 };

async function asMac(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'userAgentData', {
      configurable: true,
      get: () => ({ platform: 'macOS', mobile: false, brands: [{ brand: 'Google Chrome', version: '141' }] }),
    });
  });
}

async function openProbe(page: Page): Promise<void> {
  await openSettings(page);
  const dialog = page.getByRole('dialog');
  await dialog.getByTestId('diag-toggle').click();
  await dialog.getByTestId('dk-open').click();
  await expect(dialog.getByTestId('dk-probe')).toBeVisible();
}

const SAY_IT_DE: Doc = { [exDeKey('Try to avoid driving in rush hour.')]: 'Versuche, Fahrten im Berufsverkehr zu vermeiden.' };
const SAY_IT: Doc = {
  ...SEED['vocab/avoid'],
  state: 'learning',
  stage: 4,
  S: 1,
  D: 5,
  due: 1_690_000_000_000,
  last: 1_689_900_000_000,
  reps: 3,
  lapses: 0,
  na: 9,
  fsrs: undefined,
  hist: RECALLED,
  intro: '2023-07-01',
  exDe: SAY_IT_DE,
  xs: { say_it: { c: 0, w: 6 }, cloze: { c: 6, w: 0 }, type: { c: 6, w: 0 }, colloc: { c: 6, w: 0 }, produce: { c: 6, w: 0 }, dictation: { c: 6, w: 0 } },
};

/** Nur die „Sag es“-Karte in der Pflicht-Runde; `dk` wahlweise mit erfolgreicher Mac-Probe. */
async function bootSayIt(page: Page, dk?: Doc) {
  const profile = { ...planPatch(1), ...(dk ? { dk } : {}) };
  const booted = await boot(page, { migrated: true, fake: { patch: { ...ankiPatch(0).patch, ...TYPE_MODE, 'app/profile': profile, 'vocab/avoid': SAY_IT } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'say_it');
  return booted;
}

test.describe('Diktat-Probe am Laptop', () => {
  test.use({ viewport: LAPTOP });

  test('Erfolg: diktierter Satz ohne Taste, Ergebnis in app/profile.dk (kleiner als 200 Byte)', async ({ page }) => {
    await asMac(page);
    const { errors } = await boot(page, { migrated: true });
    await screen(page, 'today');
    await openProbe(page);
    const probe = page.getByTestId('dk-probe');
    await expect(page.getByTestId('dk-status-mac')).toContainText('nicht geprüft');
    await expect(probe).toContainText('Wozu:');
    await expect(page.getByTestId('dk-target')).toHaveText(TARGET);
    await expect(page.getByTestId('dk-input')).toHaveAttribute('lang', 'en');
    await expect(page.getByTestId('dk-input')).toHaveAttribute('autocorrect', 'off');
    await expect(page.getByTestId('dk-input')).toHaveAttribute('spellcheck', 'false');
    await expect(page.getByTestId('dk-input')).toHaveAttribute('enterkeyhint', 'go');
    await page.screenshot({ path: `${OUT}/p7-01-diagnose-eintrag-1440.png` });
    await page.getByTestId('dk-input').focus();
    await page.keyboard.insertText('I will send you the revised quote by Friday');
    await page.getByTestId('dk-check').click();
    await expect(probe).toHaveAttribute('data-state', 'ok');
    await expect(page.getByTestId('dk-ok')).toContainText('✓ Diktat funktioniert');
    await expect(page.getByTestId('dk-retry')).toHaveCount(0);
    await expect.poll(async () => ((await dump(page))['app/profile']?.dk as Doc | undefined)?.mac).toMatchObject({ ok: true, sig: 'macos-chrome' });
    const dk = (await dump(page))['app/profile']?.dk as Doc;
    expect(JSON.stringify(dk).length).toBeLessThan(200);
    expect(Object.keys(dk).sort()).toEqual(['mac', 'v']);
    await expect(page.getByTestId('dk-status-mac')).toContainText('funktioniert');
    expect(await layoutProblems(page)).toEqual([]);
    await page.screenshot({ path: `${OUT}/p7-02-probe-erfolg-1440.png` });
    expect(errors).toEqual([]);
  });

  test('Misserfolg mit Grund, genau ein zweiter Versuch auf Wunsch, danach keine Schleife', async ({ page }) => {
    await asMac(page);
    const { errors } = await boot(page, { migrated: true });
    await screen(page, 'today');
    await openProbe(page);
    const probe = page.getByTestId('dk-probe');
    // Versuch 1: getippt.
    await page.getByTestId('dk-input').click();
    await page.keyboard.type(TARGET, { delay: 5 });
    await page.getByTestId('dk-check').click();
    await expect(probe).toHaveAttribute('data-state', 'fail');
    await expect(page.getByTestId('dk-fail')).toContainText('Diktat hat nicht geklappt');
    await expect(page.getByTestId('dk-reason')).toHaveText('Der Text kam mit Tastendrücken, nicht per Diktat.');
    await expect.poll(async () => ((await dump(page))['app/profile']?.dk as Doc | undefined)?.mac).toMatchObject({ ok: false, sig: 'macos-chrome' });
    await page.screenshot({ path: `${OUT}/p7-03-probe-misserfolg-1440.png` });
    // Versuch 2: diktiert, aber Deutsch.
    await page.getByTestId('dk-retry').click();
    await page.getByTestId('dk-input').focus();
    await page.keyboard.insertText('Ich schicke dir das Angebot bis Freitag');
    await page.getByTestId('dk-check').click();
    await expect(page.getByTestId('dk-fail')).toHaveAttribute('data-reason', 'notEnglish');
    await expect(page.getByTestId('dk-retry')).toHaveCount(0);
    await expect(page.getByTestId('dk-no-more')).toBeVisible();
    // Zuklappen und wieder öffnen startet keine dritte Runde.
    await page.getByTestId('dk-open').click();
    await page.getByTestId('dk-open').click();
    await expect(page.getByTestId('dk-input')).toHaveCount(0);
    await expect(page.getByTestId('dk-no-more')).toBeVisible();
    // Schreiben nur bei Änderung prüft tests/unit/dictationProbe.test.ts (`dkStep`); hier steht weiter der Misserfolg.
    await expect.poll(async () => ((await dump(page))['app/profile']?.dk as Doc | undefined)?.mac).toMatchObject({ ok: false });
    expect(errors).toEqual([]);
  });

  test('unter 1024 px gibt es weder Probe noch Hinweiszeile', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 800 });
    await asMac(page);
    await bootSayIt(page);
    await expect(page.getByTestId('dictation-hint')).toHaveCount(0);
    await openSettings(page);
    await page.getByRole('dialog').getByTestId('diag-toggle').click();
    await expect(page.getByTestId('diag')).toBeVisible();
    await expect(page.getByTestId('dk-entry')).toHaveCount(0);
  });
});

test.describe('Hinweiszeile bei „Sag es“', () => {
  test.use({ viewport: LAPTOP });

  test('ohne Probe: „Am Laptop tippst du …“, nach Erfolg nur die Diktier-Tasten, nie beide', async ({ page }) => {
    await asMac(page);
    const { errors } = await bootSayIt(page);
    const hint = page.getByTestId('dictation-hint');
    await expect(hint).toHaveAttribute('data-state', 'type');
    await expect(page.getByTestId('dictation-hint-line')).toHaveCount(1);
    await expect(page.getByTestId('dictation-hint-line')).toHaveText('Am Laptop tippst du deine Antworten. Gesprochen wird am Handy.');
    await expect(page.getByTestId('speak-on-phone')).toBeVisible();
    // Probe im laufenden Trainer (Einstellungen über das Menü „…“): die Zeile tauscht.
    await openSettings(page);
    const dialog = page.getByRole('dialog');
    await dialog.getByTestId('diag-toggle').click();
    await dialog.getByTestId('dk-open').click();
    await page.getByTestId('dk-input').focus();
    await page.keyboard.insertText(TARGET);
    await page.getByTestId('dk-check').click();
    await expect(page.getByTestId('dk-ok')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(hint).toHaveAttribute('data-state', 'dictate');
    await expect(page.getByTestId('dictation-hint-line')).toHaveCount(1);
    await expect(page.getByTestId('dictation-hint-line')).toHaveText('Mac: Diktier- oder Globus-Taste zweimal drücken · Windows: Win + H');
    await expect(page.getByText('Am Laptop tippst du deine Antworten.')).toHaveCount(0);
    expect(await layoutProblems(page)).toEqual([]);
    await page.screenshot({ path: `${OUT}/p7-04-hinweiszeile-band-1440.png` });
    // Nach der Antwort steht keine Hinweiszeile mehr.
    await page.getByTestId('say-it-input').fill('We try to avoid long meetings on Fridays.');
    await page.getByTestId('check').click();
    await expect(page.getByTestId('verdict')).toBeVisible();
    await expect(hint).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('„Am Handy sprechen“ legt die Runde zurück wie „Pause, später weiter“', async ({ page }) => {
    await asMac(page);
    const { errors } = await bootSayIt(page, { v: 1, mac: { ok: true, t: 1_789_920_000_000, sig: 'macos-chrome' } });
    await expect(page.getByTestId('dictation-hint')).toHaveAttribute('data-state', 'dictate');
    const before = (await dump(page))['vocab/avoid'];
    await page.getByTestId('speak-on-phone').click();
    await screen(page, 'today');
    await expect(page.getByRole('status').filter({ hasText: 'Gespeichert. Du kannst jederzeit weitermachen.' })).toBeVisible();
    const kept = await page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.startsWith('lx:resume:')));
    expect(kept).toContain('lx:resume:trainer');
    await expect(page.getByTestId('resume-row')).toBeVisible();
    // Nichts bewertet: die Karte ist unverändert.
    expect((await dump(page))['vocab/avoid']).toEqual(before);
    expect(errors).toEqual([]);
  });
});
