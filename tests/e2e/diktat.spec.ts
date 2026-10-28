import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openSettings, screen, type Theme } from './fixtures';
import { RECALLED, TYPE_MODE, dump, planPatch } from './trainerHelpers';
import { ankiPatch } from './wortschatzHelpers';
import { exDeKey } from '../../src/domain/srs/exDeKey';

// Relaunch Stufe 1 P7 S1-DIKTAT (docs/relaunch/stufe1-plan.md §7): Laptop-Diktat-Probe in Einstellungen › Diagnose, die EINE
// Diktat-Aussage der Sprechaufgabe „Sag es“ am Laptop (in der Tastenzeile, Nora G2 Muss 1+2) und „Später am Handy sprechen“
// (= „Pause, später weiter“, Textknopf in der Knopfzeile).
// Diktat wird simuliert über `keyboard.insertText` (ein `beforeinput` „insertText“ ohne `keydown`), Tippen über `keyboard.type`.
// Die Tests laufen auf Linux-Chromium: Ein Init-Skript gibt sich als Chrome auf macOS aus (`navigator.userAgentData`).

type Doc = Record<string, unknown>;
const SEED = JSON.parse(readFileSync(new URL('../../seed/sample-data.json', import.meta.url), 'utf8')) as Record<string, Doc>;
const OUT = process.env.P7_SHOTS ?? '/tmp/claude-0/-home-user-lingo-engine-x/6af5333d-eebb-5460-9a49-5f84302bde29/scratchpad/p7-shots/runde2';
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

async function openProbe(page: Page, shot?: string): Promise<void> {
  await openSettings(page);
  const dialog = page.getByRole('dialog');
  await dialog.getByTestId('diag-toggle').click();
  await expect(dialog.getByTestId('dk-entry')).toBeVisible();
  if (shot) {
    await dialog.getByTestId('dk-entry').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/${shot}` });
  }
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
async function bootSayIt(page: Page, dk?: Doc, theme?: Theme) {
  const profile = { ...planPatch(1), ...(dk ? { dk } : {}) };
  const booted = await boot(page, { migrated: true, ...(theme ? { theme } : {}), fake: { patch: { ...ankiPatch(0).patch, ...TYPE_MODE, 'app/profile': profile, 'vocab/avoid': SAY_IT } } });
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
    await openProbe(page, 'p7-r2-05-diagnose-zu-1440.png');
    const probe = page.getByTestId('dk-probe');
    // Nur das eigene Betriebssystem: Mac steht da, Windows ohne Ergebnis nicht.
    await expect(page.getByTestId('dk-status-mac')).toHaveText('nicht geprüft');
    await expect(page.getByTestId('dk-status-win')).toHaveCount(0);
    await expect(page.getByTestId('dk-open')).toHaveCount(0);
    await expect(probe).toContainText('Wozu:');
    await expect(page.getByTestId('dk-how')).toHaveText('Klick ins Feld, starte das Diktat (Mikrofon-Taste (F5) oder zweimal die Globus-Taste) und sprich den Satz. Nichts tippen.');
    await expect(probe).not.toContainText('Windows');
    await expect(page.getByTestId('dk-close')).toHaveText('Schließen');
    await expect(page.getByTestId('dk-target')).toHaveText(TARGET);
    await expect(page.getByTestId('dk-input')).toHaveAttribute('lang', 'en');
    await expect(page.getByTestId('dk-input')).toHaveAttribute('autocorrect', 'off');
    await expect(page.getByTestId('dk-input')).toHaveAttribute('spellcheck', 'false');
    await expect(page.getByTestId('dk-input')).toHaveAttribute('enterkeyhint', 'go');
    await page.getByTestId('dk-entry').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: `${OUT}/p7-r2-06-diagnose-auf-1440.png` });
    await page.getByTestId('dk-input').focus();
    await page.keyboard.insertText('I will send you the revised quote by Friday');
    await page.getByTestId('dk-check').click();
    await expect(probe).toHaveAttribute('data-state', 'ok');
    await expect(page.getByTestId('dk-ok')).toContainText('✓ Diktat funktioniert');
    await expect(page.getByTestId('dk-retry')).toHaveCount(0);
    // Nach dem Ergebnis steht die Anleitung nicht mehr da; Satz und Ergebnis bleiben, Schließen heißt jetzt „Fertig“.
    await expect(page.getByTestId('dk-how')).toHaveCount(0);
    await expect(probe).not.toContainText('Wozu:');
    await expect(page.getByTestId('dk-target')).toBeVisible();
    await expect(page.getByTestId('dk-close')).toHaveText('Fertig');
    await expect(probe).toHaveAttribute('data-save', 'saved');
    await expect(page.getByTestId('dk-ok')).toContainText('Ab jetzt nennt „Sag es“ am Laptop die Diktat-Taste.');
    await expect.poll(async () => ((await dump(page))['app/profile']?.dk as Doc | undefined)?.mac).toMatchObject({ ok: true, sig: 'macos-chrome' });
    const dk = (await dump(page))['app/profile']?.dk as Doc;
    expect(JSON.stringify(dk).length).toBeLessThan(200);
    expect(Object.keys(dk).sort()).toEqual(['mac', 'v']);
    await expect(page.getByTestId('dk-status-mac')).toHaveText('funktioniert');
    expect(await layoutProblems(page)).toEqual([]);
    await page.screenshot({ path: `${OUT}/p7-r2-07-probe-erfolg-1440.png` });
    // „Fertig“ klappt zu, der Fokus geht zurück auf „Prüfen“.
    await page.getByTestId('dk-close').click();
    await expect(probe).toHaveCount(0);
    await expect(page.getByTestId('dk-open')).toBeFocused();
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
    // Prozentwert nur beim Grund „mismatch“.
    await expect(page.getByTestId('dk-tech')).not.toContainText('%');
    await expect(page.getByTestId('dk-close')).toHaveText('Schließen');
    await expect.poll(async () => ((await dump(page))['app/profile']?.dk as Doc | undefined)?.mac).toMatchObject({ ok: false, sig: 'macos-chrome' });
    await page.screenshot({ path: `${OUT}/p7-r2-08-probe-misserfolg-1440.png` });
    // Versuch 2: diktiert, aber Deutsch.
    await page.getByTestId('dk-retry').click();
    await page.getByTestId('dk-input').focus();
    await page.keyboard.insertText('Ich schicke dir das Angebot bis Freitag');
    await page.getByTestId('dk-check').click();
    await expect(page.getByTestId('dk-fail')).toHaveAttribute('data-reason', 'notEnglish');
    await expect(page.getByTestId('dk-retry')).toHaveCount(0);
    await expect(page.getByTestId('dk-no-more')).toHaveText('Mehr Versuche gibt es hier nicht. Schick Claude ein Foto dieser Seite.');
    // Zuklappen und wieder öffnen startet keine dritte Runde.
    await page.getByTestId('dk-close').click();
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
    // Schmal: alles wie am Handy (Aufgabe mit Mikrofon, Tipp-Zeile, kein Handy-Knopf).
    await expect(page.getByTestId('speak-on-phone')).toHaveCount(0);
    await expect(page.getByTestId('say-it-tip')).toHaveCount(1);
    await openSettings(page);
    await page.getByRole('dialog').getByTestId('diag-toggle').click();
    await expect(page.getByTestId('diag')).toBeVisible();
    await expect(page.getByTestId('dk-entry')).toHaveCount(0);
  });
});

test.describe('„Sag es“ am Laptop: eine Diktat-Aussage', () => {
  test.use({ viewport: LAPTOP });

  /** Genau eine Diktat-Aussage: Aufgabe ohne Mikrofon, keine Tipp-Zeile, keine eigene Zeile über dem Feld; der Text steht in der Tastenzeile. */
  async function oneStatement(page: Page, keys: string): Promise<void> {
    await expect(page.getByTestId('task')).toHaveText('Sag den Satz auf Englisch.');
    await expect(page.getByTestId('say-it-tip')).toHaveCount(0);
    await expect(page.getByTestId('dictation-hint')).toHaveCount(0);
    await expect(page.getByTestId('keys-hint')).toHaveText(keys);
    await expect(page.getByTestId('exercise')).not.toContainText('Mikrofon');
    await expect(page.getByTestId('speak-on-phone')).toHaveText('Später am Handy sprechen');
    // Textknopf links in der Knopfzeile, vor „Weiß ich nicht“; höchstens zwei Nebenknöpfe.
    const sec = page.locator('[data-slot="secondary"] [data-secondary]');
    await expect(sec).toHaveCount(2);
    await expect(sec.nth(0)).toHaveAttribute('data-secondary', 'phone');
    await expect(sec.nth(1)).toHaveAttribute('data-secondary', 'dontKnow');
  }

  test('ohne Probe: „Laut sprechen: am Handy“ in der Tastenzeile; nach Erfolg nur die eigene Diktat-Taste', async ({ page }) => {
    await asMac(page);
    const { errors } = await bootSayIt(page, undefined, 'dark');
    await oneStatement(page, 'Enter prüft · Laut sprechen: am Handy');
    expect(await layoutProblems(page)).toEqual([]);
    await page.screenshot({ path: `${OUT}/p7-r2-01-sag-es-ohne-probe-dunkel-1440.png` });
    // Probe im laufenden Trainer (Einstellungen über das Menü „…“): die Tastenzeile tauscht.
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
    await oneStatement(page, 'Enter prüft · Diktat: 2× Globus-Taste');
    await expect(page.getByText('Laut sprechen: am Handy')).toHaveCount(0);
    await expect(page.getByTestId('exercise')).not.toContainText('Win + H');
    expect(await layoutProblems(page)).toEqual([]);
    await page.screenshot({ path: `${OUT}/p7-r2-04-sag-es-nach-erfolg-1440.png` });
    // Nach der Antwort: kein Handy-Knopf, keine Diktat-Zeile mehr.
    await page.getByTestId('say-it-input').fill('We try to avoid long meetings on Fridays.');
    await page.getByTestId('check').click();
    await expect(page.getByTestId('verdict')).toBeVisible();
    await expect(page.getByTestId('speak-on-phone')).toHaveCount(0);
    await expect(page.getByTestId('keys-hint')).not.toContainText('Diktat');
    expect(errors).toEqual([]);
  });

  test('hell 1440 ohne Probe: dieselbe eine Aussage',async ({ page }) => {
    await asMac(page);
    const { errors } = await bootSayIt(page, undefined, 'light');
    await oneStatement(page, 'Enter prüft · Laut sprechen: am Handy');
    expect(await layoutProblems(page)).toEqual([]);
    await page.screenshot({ path: `${OUT}/p7-r2-02-sag-es-ohne-probe-hell-1440.png` });
    expect(errors).toEqual([]);
  });

  test('1024 px ohne Probe: dieselbe eine Aussage', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await asMac(page);
    const { errors } = await bootSayIt(page, undefined, 'dark');
    await oneStatement(page, 'Enter prüft · Laut sprechen: am Handy');
    expect(await layoutProblems(page)).toEqual([]);
    await page.screenshot({ path: `${OUT}/p7-r2-03-sag-es-ohne-probe-dunkel-1024.png` });
    expect(errors).toEqual([]);
  });

  test('Windows nach Erfolg: nur Win + H', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'userAgentData', {
        configurable: true,
        get: () => ({ platform: 'Windows', mobile: false, brands: [{ brand: 'Microsoft Edge', version: '141' }] }),
      });
    });
    const { errors } = await bootSayIt(page, { v: 1, win: { ok: true, t: 1_789_920_000_000, sig: 'windows-edge' } });
    await oneStatement(page, 'Enter prüft · Diktat: Win + H');
    await expect(page.getByTestId('exercise')).not.toContainText('Globus');
    expect(errors).toEqual([]);
  });

  test('„Später am Handy sprechen“ legt die Runde zurück wie „Pause, später weiter“', async ({ page }) => {
    await asMac(page);
    const { errors } = await bootSayIt(page, { v: 1, mac: { ok: true, t: 1_789_920_000_000, sig: 'macos-chrome' } });
    await expect(page.getByTestId('keys-hint')).toHaveText('Enter prüft · Diktat: 2× Globus-Taste');
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
