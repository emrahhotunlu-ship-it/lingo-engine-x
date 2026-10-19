import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { bootAt, layoutProblems, screen, type Theme } from './fixtures';
import { NO_GRAMMAR_ERRORS } from './heuteHelpers';
import { setInputProfile } from './input';
import { dump } from './trainerHelpers';

// Paket FK (docs/umbau/wort-lernen-plan.md): „Fehler korrigieren“ – Ausschlussregeln beim Lesen, „Kann ich nicht nachvollziehen“,
// neue Aufgabenformen B1 „Richtig sagen“ und B2 „Welche Fassung?“, gespeicherter Kontext. Stichtag der Testdaten: 20.09.2026 (Abend).

type Doc = Record<string, unknown>;
const SEED = JSON.parse(readFileSync(new URL('../../seed/sample-data.json', import.meta.url), 'utf8')) as Record<string, Doc>;
const DAY = 86_400_000;
const T = Date.parse('2026-09-16T10:00:00+02:00');
const rep = (id: string, wrong: string, right: string, extra: Doc = {}): Doc => ({ id, wrong, right, why: 'Test.', src: 'say', t: T, box: 0, due: T + DAY, ...extra });
const FIRST = rep('fk1', 'It depends of the budget for this project.', 'It depends on the budget for this project.', { ctx: 'Mail an einen Kunden' });
const SECOND = rep('fk2', 'We are working on it since two years now.', 'We have been working on it for two years now.', { due: T + 2 * DAY });
const BROKEN = rep('fk3', 'to overcome', 'I need to overcome my fear of public speaking.', { src: 'write', due: T });
const repairs = async (page: Page): Promise<Doc[]> => (((await dump(page))['app/repair'] as { items?: Doc[] } | undefined)?.items ?? []);

/** Thema `used-to` mit genau einem fälligen Fehler (Muster `ut.used-to`), Box und Verlauf frei wählbar. */
const usedTo = (box: number, rh: unknown[], extra: Doc = {}): Record<string, Doc> => ({
  ...NO_GRAMMAR_ERRORS,
  'grammar/used-to': {
    ...SEED['grammar/used-to'],
    errors: [{ q: 'My grandmother ___ (be) very strict when I was young.', given: 'was used to being', ans: 'used to be', t: T, src: 'test', pat: 'ut.used-to', box, due: T + DAY, rh, ...extra }],
  },
});

test.describe('Fehler korrigieren: Kann ich nicht nachvollziehen', () => {
  test('nimmt den Satz dauerhaft heraus (Merker, nichts gelöscht), zählt nicht als falsch und steht in der Zusammenfassung', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setInputProfile(page, 'keys');
    const { errors, external } = await bootAt(page, { name: 'unitAgain' }, { fake: { patch: { ...NO_GRAMMAR_ERRORS, 'app/repair': { items: [FIRST, SECOND, BROKEN] } } } });
    await screen(page, 'unitAgain');
    // Der kaputte Satz („to overcome“) erscheint nie als Aufgabe; der erste echte Satz zeigt seinen gespeicherten Kontext.
    await expect(page.getByTestId('repair-item')).toHaveAttribute('data-id', 'fk1');
    await expect(page.getByTestId('repair-context')).toContainText('Mail an einen Kunden');
    expect(await layoutProblems(page)).toEqual([]);
    await page.getByTestId('repair-unclear').click();
    await expect(page.getByTestId('repair-item')).toHaveAttribute('data-id', 'fk2');
    await page.getByTestId('repair-input').fill('We have been working on it for two years now.');
    await page.getByTestId('repair-check').click();
    await expect(page.getByTestId('result')).toHaveAttribute('data-verdict', 'ok');
    await page.getByTestId('repair-next').click();
    await expect(page.getByTestId('summary')).toBeVisible();
    await expect(page.getByTestId('again-unclear-note')).toHaveText('1 Satz herausgenommen – kommt nicht wieder, zählt nicht als falsch.');
    // Der Hinweis steht unter der Zusammenfassung, nicht darüber; die Überschrift bleibt neutral.
    await expect(page.getByTestId('summary').getByTestId('again-unclear-note')).toBeVisible();
    // Merker gesetzt, Eintrag bleibt (nie löschen), Box und Fälligkeit unverändert, nichts im Tagesprotokoll.
    await expect.poll(async () => (await repairs(page)).find((e) => e.id === 'fk1')?.unclear).toEqual(expect.any(Number));
    const all = await repairs(page);
    expect(all.map((e) => e.id).sort()).toEqual(['fk1', 'fk2', 'fk3']);
    expect(all.find((e) => e.id === 'fk1')).toMatchObject({ box: 0, due: T + DAY });
    expect(all.find((e) => e.id === 'fk1')?.last).toBeUndefined();
    expect(all.find((e) => e.id === 'fk3')?.unclear).toBeUndefined();
    const log = ((await dump(page))['log/2026-09-20']?.entries as Doc[] | undefined) ?? [];
    expect(log.some((e) => e.id === 'fk1')).toBe(false);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('ein einziger Satz, herausgenommen: ruhiger Abschluss statt „0 von 0“', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setInputProfile(page, 'keys');
    const { errors } = await bootAt(page, { name: 'unitAgain' }, { fake: { patch: { ...NO_GRAMMAR_ERRORS, 'app/repair': { items: [FIRST] } } } });
    await screen(page, 'unitAgain');
    await page.getByTestId('repair-unclear').click();
    await expect(page.getByTestId('again-empty')).toContainText('kommen nicht wieder');
    expect(errors).toEqual([]);
  });

  test('bei einem Grammatik-Fehler steht der Merker am Fehlereintrag des Themas', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setInputProfile(page, 'keys');
    const { errors } = await bootAt(page, { name: 'unitAgain' }, { fake: { patch: { ...usedTo(0, []), 'app/repair': null } } });
    await screen(page, 'unitAgain');
    await expect(page.getByTestId('repair-item')).toHaveAttribute('data-form', 'field');
    // Fehlerart-Etikett und damalige Aufgabe samt Lückenhinweis stehen über dem Satz.
    await expect(page.getByTestId('repair-context')).toContainText('Fehlerart');
    await expect(page.getByTestId('repair-context')).toContainText('Hinweis der damaligen Aufgabe: be');
    await page.getByTestId('repair-unclear').click();
    await expect.poll(async () => ((await dump(page))['grammar/used-to']?.errors as Doc[] | undefined)?.[0]?.unclear).toEqual(expect.any(Number));
    const e = ((await dump(page))['grammar/used-to']?.errors as Doc[])[0]!;
    expect(e).toMatchObject({ box: 0, q: 'My grandmother ___ (be) very strict when I was young.' });
    expect(e.last).toBeUndefined();
    expect(errors).toEqual([]);
  });
});

test.describe('Neue Aufgabenformen', () => {
  test('B1 „Richtig sagen“: Lage und Absicht, freie Antwort, richtig bucht Box +1 am Original, Fehlerart-Hinweis, Warum', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setInputProfile(page, 'keys');
    // Box 1 und eine frühere Antwort: gerade Summe, also B1 (B2 wechselt sich ab).
    const { errors, external } = await bootAt(page, { name: 'unitAgain' }, { fake: { patch: { ...usedTo(1, [[T, 0, 0]]), 'app/repair': null } } });
    await screen(page, 'unitAgain');
    const item = page.getByTestId('repair-item');
    await expect(item).toHaveAttribute('data-form', 'b1');
    await expect(page.getByTestId('fk-sit')).toBeVisible();
    await expect(page.getByTestId('fk-intent')).toContainText('Früher haben wir alle Verträge auf Papier abgelegt.');
    await expect(page.getByTestId('fk-hint')).toContainText('Achte auf');
    await expect(page.getByTestId('repair-right')).toHaveCount(0);
    expect(await layoutProblems(page)).toEqual([]);
    await page.getByTestId('repair-input').fill('We used to file all contracts on paper.');
    await page.getByTestId('repair-check').click();
    await expect(page.getByTestId('result')).toHaveAttribute('data-verdict', 'ok');
    await expect(page.getByTestId('repair-right')).toContainText('We used to file all contracts on paper.');
    await expect(page.getByTestId('result')).toContainText('Gewohnheit');
    // Gebucht am Original: Box +1; `given` bleibt beim Original (Antwort galt einem neuen Satz).
    await expect.poll(async () => ((await dump(page))['grammar/used-to']?.errors as Doc[] | undefined)?.[0]?.box).toBe(2);
    expect(((await dump(page))['grammar/used-to']?.errors as Doc[])[0]).toMatchObject({ given: 'was used to being' });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('B1: der typische Fehler ist falsch, „Weiß ich nicht“ zeigt die Musterlösung ohne Vorwurf, Box fällt', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setInputProfile(page, 'keys');
    const { errors } = await bootAt(page, { name: 'unitAgain' }, { fake: { patch: { ...usedTo(2, [[T, 1, 1], [T, 0, 0]]), 'app/repair': null } } });
    await screen(page, 'unitAgain');
    await expect(page.getByTestId('repair-item')).toHaveAttribute('data-form', 'b1');
    await page.getByTestId('repair-dontknow').click();
    await expect(page.getByTestId('result')).toHaveAttribute('data-verdict', 'wrong');
    await expect(page.getByTestId('repair-right')).toContainText('We used to file all contracts on paper.');
    await expect.poll(async () => ((await dump(page))['grammar/used-to']?.errors as Doc[] | undefined)?.[0]?.box).toBe(1);
    expect(errors).toEqual([]);
  });

  test('B2 „Welche Fassung?“: zwei Fassungen, Begründung, neuer Satz mit zwei Stellen; alles richtig bucht Box +1', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setInputProfile(page, 'keys');
    // Box 1 ohne frühere Antwort: ungerade Summe, also B2.
    const { errors, external } = await bootAt(page, { name: 'unitAgain' }, { fake: { patch: { ...usedTo(1, []), 'app/repair': null } } });
    await screen(page, 'unitAgain');
    await expect(page.getByTestId('repair-item')).toHaveAttribute('data-form', 'b2');
    // Kopf ohne Box und ohne „Fehlersatz“ doppelt (UX-Prüfung W-1/W-2); die Box steht hinter dem (i).
    await expect(page.getByTestId('status')).not.toContainText('Box');
    const choices = page.getByTestId('fk-b2-choices').getByTestId('choice');
    await expect(choices).toHaveCount(2);
    expect(await layoutProblems(page)).toEqual([]);
    await choices.filter({ hasText: 'to get used to the new expense system' }).click();
    await page.getByTestId('repair-check').click();
    // Begründung steht direkt nach der Wahl, bevor der neue Satz kommt.
    await expect(page.getByTestId('hint-line')).toContainText('Gewöhnens');
    await page.getByTestId('fk-b2-continue').click();
    await expect(page.getByTestId('repair-item')).toHaveAttribute('data-step', 'gap1');
    await page.getByTestId('fk-b2-choices').getByTestId('choice').filter({ has: page.getByText('used to', { exact: true }) }).click();
    await page.getByTestId('fk-b2-gap-next').click();
    await expect(page.getByTestId('repair-item')).toHaveAttribute('data-step', 'gap2');
    await page.getByTestId('fk-b2-choices').getByTestId('choice').filter({ has: page.getByText('using', { exact: true }) }).click();
    await page.getByTestId('repair-check').click();
    await expect(page.getByTestId('result')).toHaveAttribute('data-verdict', 'ok');
    await expect(page.getByTestId('repair-right')).toContainText("I used to use the old tool every day, so I'm still getting used to using the new one.");
    await expect.poll(async () => ((await dump(page))['grammar/used-to']?.errors as Doc[] | undefined)?.[0]?.box).toBe(2);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('B2: falsche Fassung gewählt – „nicht ganz“ mit Begründung, Box fällt, nichts bleibt hängen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setInputProfile(page, 'keys');
    const { errors } = await bootAt(page, { name: 'unitAgain' }, { fake: { patch: { ...usedTo(1, []), 'app/repair': null } } });
    await screen(page, 'unitAgain');
    await page.getByTestId('fk-b2-choices').getByTestId('choice').filter({ hasText: 'to be used to the new expense system' }).click();
    await page.getByTestId('repair-check').click();
    await page.getByTestId('fk-b2-continue').click();
    await page.getByTestId('fk-b2-choices').getByTestId('choice').first().click();
    await page.getByTestId('fk-b2-gap-next').click();
    await page.getByTestId('fk-b2-choices').getByTestId('choice').first().click();
    await page.getByTestId('repair-check').click();
    await expect(page.getByTestId('result')).toHaveAttribute('data-verdict', 'wrong');
    // „Richtig:“ zeigt die Musterlösung des neuen Satzes, nicht die eigene Eingabe (W-3/W-5).
    await expect(page.getByTestId('diff-correct')).toHaveText(await page.getByTestId('repair-right').innerText());
    await expect.poll(async () => ((await dump(page))['grammar/used-to']?.errors as Doc[] | undefined)?.[0]?.box).toBe(0);
    expect(errors).toEqual([]);
  });

  test('ausgeblendeter Grammatik-Fehler (Dopplung) kommt als B1 wieder, der Eintrag bleibt unverändert', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setInputProfile(page, 'keys');
    const broken = { q: 'I ___ (be) used to driving here.', given: 'I I be used to driving here. here.', ans: 'am', t: T, src: 'test', pat: 'ut.be-used-to', box: 0, due: T + DAY };
    const { errors } = await bootAt(page, { name: 'unitAgain' }, { fake: { patch: { ...NO_GRAMMAR_ERRORS, 'grammar/used-to': { ...SEED['grammar/used-to'], errors: [broken] }, 'app/repair': null } } });
    await screen(page, 'unitAgain');
    await expect(page.getByTestId('repair-item')).toHaveAttribute('data-form', 'b1');
    await expect(page.getByTestId('fk-intent')).toContainText('links zu fahren');
    expect(((await dump(page))['grammar/used-to']?.errors as Doc[])[0]).toMatchObject({ q: broken.q, given: broken.given });
    expect(errors).toEqual([]);
  });
});

// Screenshots für die Prüfung (Handy 390 und Desktop 1280, drei Modi) – ohne weitere Behauptung außer „kein waagrechter Bildlauf“.
const THEMES: Theme[] = ['dark', 'dim', 'light'];
const SHOTS = '/tmp/claude-0/-home-user-lingo-engine-x/6af5333d-eebb-5460-9a49-5f84302bde29/scratchpad/fk';
for (const theme of THEMES) {
  for (const [name, width, height] of [['handy', 390, 844], ['desktop', 1280, 900]] as const) {
    test(`Bilder ${name} ${theme}: B3 mit Etikett, B1, B2 (Auswahl und neuer Satz)`, async ({ page, browser }) => {
      // Jede Ansicht in eigenem Browser-Kontext: sonst setzt die gespeicherte Sitzung (Fortsetzen) die vorige Aufgabe fort.
      const fresh = async () => (await browser.newContext({ timezoneId: 'Europe/Berlin', locale: 'de-DE', viewport: { width, height } })).newPage();
      await page.setViewportSize({ width, height });
      await setInputProfile(page, 'keys');
      const take = async (what: string): Promise<void> => {
        await page.waitForTimeout(500);
        expect(await layoutProblems(page)).toEqual([]);
        await page.screenshot({ path: `${SHOTS}/${what}-${name}-${theme}.png`, fullPage: true });
      };
      await bootAt(page, { name: 'unitAgain' }, { theme, fake: { patch: { ...usedTo(0, []), 'app/repair': null } } });
      await screen(page, 'unitAgain');
      await take('b3');
      const b1 = await fresh();
      await setInputProfile(b1, 'keys');
      await bootAt(b1, { name: 'unitAgain' }, { theme, fake: { patch: { ...usedTo(1, [[T, 0, 0]]), 'app/repair': null } } });
      await screen(b1, 'unitAgain');
      await b1.setViewportSize({ width, height });
      await b1.waitForTimeout(500);
      await b1.getByTestId('repair-input').fill('We used to file all contracts on paper.');
      await b1.getByTestId('repair-check').click();
      await b1.waitForTimeout(600);
      await b1.screenshot({ path: `${SHOTS}/b1-${name}-${theme}.png`, fullPage: true });
      expect(await layoutProblems(b1)).toEqual([]);
      const b2 = await fresh();
      await setInputProfile(b2, 'keys');
      await bootAt(b2, { name: 'unitAgain' }, { theme, fake: { patch: { ...usedTo(1, []), 'app/repair': null } } });
      await screen(b2, 'unitAgain');
      await b2.setViewportSize({ width, height });
      await b2.waitForTimeout(500);
      await b2.screenshot({ path: `${SHOTS}/b2-wahl-${name}-${theme}.png`, fullPage: true });
      await b2.getByTestId('fk-b2-choices').getByTestId('choice').filter({ hasText: 'to get used to the new expense system' }).click();
      await b2.getByTestId('repair-check').click();
      await b2.getByTestId('fk-b2-continue').click();
      await b2.waitForTimeout(500);
      await b2.screenshot({ path: `${SHOTS}/b2-satz-${name}-${theme}.png`, fullPage: true });
      expect(await layoutProblems(b2)).toEqual([]);
    });
  }
}
