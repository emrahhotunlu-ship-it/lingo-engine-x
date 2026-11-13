import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openTab, screen } from './fixtures';
import { TUE_9, TW_DUTY, profileWith, reviewedLog } from './heuteHelpers';
import { dump } from './trainerHelpers';

// F3 Anwenden (docs/umbau/fokus2/anwenden-plan.md): Seite „Anwenden“, die Schreibübungen Antworten/Schreiben/Zusammenfassen am Handy (390) und Laptop (1440),
// seit Großpaket P, P4 (E2) frei geübt („Frei üben“); Schritt 3 sind die Brücken-Sätze (`anwendenBruecke.spec.ts`), ältere Pläne mit `u.ap` bleiben lesbar,
// Zähler `apc`, kurzer Tag. Die Testlaufzeit antwortet fest (`src/platform/dev/canned/apply.ts`,
// Fehler aus der Tabelle der Satz-Klinik: „discussed about“, „informations“, „depends of“ …).

type Doc = Record<string, unknown>;
type Fake = { sampleCalls: Array<{ id: string | null; tier: string }> };
const TUE = '2026-09-22';
const AXE = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const calls = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: Fake }).__LINGO_FAKE__.sampleCalls.filter((c) => /^(apply-|c1-mail)/.test(c.id ?? '')).map((c) => `${c.id}:${c.tier}`));
const profile = async (page: Page): Promise<Doc> => (await dump(page))['app/profile'] ?? {};
const outItems = async (page: Page): Promise<Doc[]> => (((await dump(page))['out/2026-09'] as { items?: Doc[] } | undefined)?.items ?? []);
const writeRepairs = async (page: Page): Promise<Doc[]> => (((await dump(page))['app/repair'] as { items?: Doc[] } | undefined)?.items ?? []).filter((r) => r.src === 'write');
const axe = async (page: Page): Promise<string[]> => {
  await page.waitForTimeout(400);
  return (await new AxeBuilder({ page }).withTags(AXE).analyze()).violations.map((v) => v.id);
};

/** Hauptknopf nach ui-standard §3: mindestens 52 px hoch. */
const tall = async (page: Page, id: string): Promise<void> => {
  expect((await page.getByTestId(id).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(52);
};

/** Nachgebildetes `visualViewport` (Chromium hat keine Bildschirmtastatur), wie stand-gaps.spec.ts „Kap. 4.1“. */
const fakeViewport = (page: Page): Promise<void> =>
  page.addInitScript(() => {
    const vv = Object.assign(new EventTarget(), { height: window.innerHeight, width: window.innerWidth, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
  });

/** Tastatur „öffnet sich“: nur noch die obersten `h` px sind sichtbar. */
const openKeyboard = (page: Page, h: number): Promise<void> =>
  page.evaluate((height) => {
    const vv = window.visualViewport as unknown as EventTarget & { height: number };
    vv.height = height;
    vv.dispatchEvent(new Event('resize'));
  }, h);

/** Liegt das Element ganz im Bereich [0, h] des Fensters? */
const within = (page: Page, id: string, h: number): Promise<boolean> =>
  page.getByTestId(id).evaluate((el, max) => {
    const r = el.getBoundingClientRect();
    return r.top >= -1 && r.bottom <= max + 1 && r.height > 0;
  }, h);

/** Tagesweg-Plan vom Dienstag mit eingefrorener Disziplin (`u.ap`). */
function twPlan(ap: string): Doc {
  return {
    d: TUE,
    v: 1,
    ids: [],
    why: [],
    duty: TW_DUTY,
    goal: { review: 2, due: 2, new: 0, ahead: 0 },
    lesson: null,
    at: 1,
    u: { v: 1, shape: 'full', goalMin: 25, theme: '', min: 25, rv: 2, tw: 1, ap, b: [[1, 'review', 10, { repairs: 0 }], [2, 'grammar', 10, { errs: 0 }], [3, 'task.apply', 5]] },
  };
}

test.describe('Handy 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Seite: Pflicht sind die eigenen Sätze (auch beim Zähler 1, früher „Antworten“); Mails frei mit ehrlicher Zeit; Antwort mit einem Feld je Pflichtpunkt, erst selbst verbessern, dann Lösung; frei geübt zählt nicht zur Pflicht', async ({ page }) => {
    const { errors, external } = await boot(page, { migrated: true, now: TUE_9, localStorage: { 'lx:input': 'touch' }, fake: { patch: { 'app/profile': { apc: { n: 1, d: '2026-09-21' } } } } });
    await screen(page, 'today');
    // Großpaket P, P4 (E2): neue Pläne frieren immer den eigenen Satz ein; der Zähler `apc` bleibt lesbar, steuert aber nicht mehr die Disziplin.
    await expect.poll(async () => ((await profile(page)).plan as { u?: { ap?: string } } | undefined)?.u?.ap).toBe('combo');
    await openTab(page, 'apply');
    await expect(page.getByTestId('apply-hub')).toHaveAttribute('data-v', '3');
    await expect(page.getByTestId('ax-today-start')).toHaveAttribute('data-kind', 'bridge');
    await expect(page.getByTestId('ax-today-start')).toContainText('ca. 3 Min.');
    // Die eigenen Sätze stehen nicht noch einmal unter „Frei üben“ (der einzige Weg zur Pflicht ist Schritt 3); Mails und Zusammenfassung frei.
    await expect(page.getByTestId('ax-all').locator('button')).toHaveCount(3);
    await expect(page.getByTestId('hub-combo-own')).toHaveCount(0);
    for (const id of ['ax-row-reply', 'ax-row-write', 'ax-row-summary']) {
      await expect(page.getByTestId(id)).toBeEnabled();
      await expect(page.getByTestId(id)).toContainText('6–9 Min.');
    }
    expect(await layoutProblems(page)).toEqual([]);
    expect(await axe(page)).toEqual([]);

    await page.getByTestId('ax-row-reply').click();
    await screen(page, 'applyTask');
    await expect(page.getByTestId('ax-flow')).toHaveAttribute('data-device', 'touch');
    await expect(page.getByTestId('ax-bar-title')).toHaveText('Antworten');
    await expect(page.getByTestId('ax-task')).toContainText('Antworte auf die Mail von');
    await expect(page.getByTestId('ax-purpose')).toContainText('Wozu:');
    await expect(page.getByTestId('ax-mail')).toBeVisible();
    await expect(page.getByTestId('ax-target-word')).toHaveCount(2);
    // Am Handy gegliedert: ein Feld je Pflichtpunkt und eins für den Gruß; ohne Autokorrektur und Vorschläge.
    const fields = page.getByTestId('ax-parts').locator('textarea');
    const n = await fields.count();
    expect(n).toBeGreaterThanOrEqual(3);
    const first = page.getByTestId('ax-part-0');
    await expect(first).toHaveAttribute('autocorrect', 'off');
    await expect(first).toHaveAttribute('spellcheck', 'false');
    await expect(first).toHaveAttribute('autocomplete', 'off');
    await expect(first).toHaveAttribute('name', 'lx-apply-text');
    await expect(page.getByTestId('ax-check')).toBeDisabled();
    // W5 K7: eigenes Anrede-Feld, leer (Anrede wird mitbewertet); Lehrer-Prüfung W5b: weder Feld noch Hinweis nennen die fertige Anrede oder den Gruß.
    await expect(page.getByTestId('ax-part-greet')).toHaveValue('');
    await expect(page.getByTestId(`ax-part-${n - 1}`)).toHaveAttribute('placeholder', 'Gruß und dein Name');
    await expect(page.getByTestId('ax-greet-hint')).toHaveCount(0);
    // W5 K9: Starthilfe erst auf Wunsch, dann drei Satzanfänge (zählt als Hilfe).
    await expect(page.getByTestId('ax-starters')).toHaveCount(0);
    await page.getByTestId('ax-starter').click();
    await expect(page.getByTestId('ax-starters').locator('li')).toHaveCount(3);
    await expect(page.getByTestId('ax-starter-0')).toContainText('…');
    const parts = [
      'Hi, thank you for your message, I fully understand that your team is very busy at the moment.',
      'We discussed about the setup and it really needs only a few hours from your team in total.',
      'I can send a short summary with all the informations your managing director needs.',
      'Shall we talk again after the year-end closing in February?',
    ];
    for (let k = 0; k < n - 1; k++) await page.getByTestId(`ax-part-${k}`).fill(parts[k] ?? 'It depends of your plans for the next quarter, of course.');
    await page.getByTestId(`ax-part-${n - 1}`).fill('Best regards');
    await expect(page.getByTestId('ax-check')).toBeEnabled();
    await tall(page, 'ax-check');
    await page.getByTestId('ax-check').click();

    // Erst selbst verbessern: Stellen mit Fehlerart, ohne Lösung. UX-Befund 3: die Seite springt dorthin, der eigene Text ist zu einer Zeile eingeklappt.
    await expect(page.getByTestId('ax-self')).toBeVisible();
    await expect(page.getByTestId('ax-self')).toBeInViewport();
    await expect(page.getByTestId('ax-parts')).toHaveCount(0);
    await expect(page.getByTestId('ax-yourtext')).toHaveAttribute('data-open', 'false');
    await tall(page, 'ax-reveal');
    // Der Sprung setzt den Fokus auf die Überschrift, nicht in ein Feld: die Leiste bleibt ohne Knopf, keine Tastatur.
    await expect(page.getByTestId('ax-dock')).toHaveCount(0);
    await page.getByTestId('ax-self-input-0').focus();
    await expect(page.getByTestId('ax-dock-reveal')).toBeVisible();
    expect(await calls(page)).toEqual(['apply-reply:default']);
    await expect(page.getByTestId('ax-self-0')).toHaveAttribute('data-kind', 'grammar');
    await expect(page.getByTestId('ax-self-input-0')).toHaveValue('discussed about');
    // T8: darüber der ganze Satz aus dem eigenen Text, die Stelle markiert.
    await expect(page.getByTestId('ax-self-mark-0')).toHaveText('discussed about');
    await expect(page.getByTestId('ax-self-sentence-0')).toContainText(/\S+ discussed about \S+/);
    await expect(page.getByTestId('ax-result')).toHaveCount(0);
    await page.getByTestId('ax-self-input-0').fill('discussed');
    await page.getByTestId('ax-reveal').click();

    const result = page.getByTestId('ax-result');
    await expect(result).toHaveAttribute('data-kind', 'reply');
    await expect(result).toBeInViewport();
    await expect(page.getByTestId('ax-result-head')).toBeFocused();
    await expect(page.getByTestId('ax-point-1')).toHaveAttribute('data-covered', 'yes');
    await expect(page.getByTestId('ax-tone')).toHaveAttribute('data-fit', 'fits');
    await expect(page.getByTestId('ax-length')).toBeVisible();
    await expect(page.getByTestId('ax-spot-0')).toHaveAttribute('data-self', 'ok');
    await expect(page.getByTestId('ax-spot-0')).toContainText('discussed');
    // W5 K7: Anrede und Gruß beim Ton bewertet, der Vorschlag erst hier; K1: „So klingt es professioneller“ getrennt von den Fehlern, mit Zitat, besserer Fassung und Warum; K9 vermerkt.
    await expect(page.getByTestId('ax-greet')).toHaveAttribute('data-fit', 'fits');
    await expect(page.getByTestId('ax-greet-suggest')).toContainText(/Vorschlag: Anrede „(Hi|Hello|Dear|Hey) .+,“ · Gruß „.+,“/);
    await expect(page.getByTestId('ax-style')).toHaveAttribute('data-n', '2');
    await expect(page.getByTestId('ax-style-0')).toContainText('very busy');
    await expect(page.getByTestId('ax-style-0')).toContainText('stretched thin');
    await expect(page.getByTestId('ax-style-0')).toContainText('Warum');
    await expect(page.getByTestId('ax-style-0').locator('s')).toHaveCount(0);
    await expect(page.getByTestId('ax-helped')).toBeVisible();
    // Feste Reihenfolge: Kurz gesagt (Mail-Vorlagen @3) → Pflichtpunkte → Ton → Länge → Fehlerstellen; höchstens drei Fehlerkarten offen.
    await expect(page.getByTestId('ax-gist')).toContainText('Kurz gesagt');
    const cards = page.locator('[data-testid^="ax-spot-"][data-self]');
    expect(await cards.count()).toBeLessThanOrEqual(3);
    if ((await page.getByTestId('ax-spots-more').count()) > 0) {
      await page.getByTestId('ax-spots-more').click();
      expect(await cards.count()).toBeGreaterThan(3);
    }
    const ys = await Promise.all(['ax-gist', 'ax-points', 'ax-tone', 'ax-length', 'ax-spots'].map(async (id) => (await page.getByTestId(id).boundingBox())?.y ?? 0));
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    // UX-Befund 8: „Melden“ nur mit aufgeklappter Fassung; der Gruß steht darin genau einmal (Befund 9).
    await expect(page.getByTestId('ax-mark')).toHaveCount(0);
    await page.getByTestId('ax-better').click();
    await expect(page.getByTestId('ax-better-text')).toContainText('Best regards');
    expect(((await page.getByTestId('ax-better-text').textContent()) ?? '').match(/Best regards/g)?.length).toBe(1);
    await expect(page.getByTestId('ax-mark')).toBeVisible();
    await page.getByTestId('ax-yourtext-toggle').click();
    await expect(page.getByTestId('ax-yourtext-text')).toContainText('Shall we talk again');
    await tall(page, 'ax-done');
    await expect(page.getByTestId('ax-repairs')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    expect(await axe(page)).toEqual([]);

    // Gespeichert: `out/2026-09` (Art reply), höchstens 3 Fehlersätze `src: 'write'` mit Situation.
    await expect.poll(async () => (await outItems(page)).filter((i) => i.k === 'reply').length).toBe(1);
    expect((await outItems(page)).find((i) => i.k === 'reply')?.fb).toMatchObject({ st: [['very busy', 'stretched thin'], ['really needs', 'requires']], gr: 'fits', help: 1 });
    const reps = await writeRepairs(page);
    expect(reps.length).toBeGreaterThan(0);
    expect(reps.length).toBeLessThanOrEqual(3);
    expect(reps.every((r) => typeof r.ctx === 'string' && r.ctx.length > 0)).toBe(true);

    // Frei geübt: zurück auf die Seite Anwenden; Schritt 3 bleibt offen, der Zähler der Anwenden-Tage unverändert.
    await page.getByTestId('ax-done').click();
    await screen(page, 'apply');
    await expect(page.getByTestId('ax-today-start')).toBeVisible();
    expect(((await profile(page)).act as Record<string, Doc> | undefined)?.[TUE]?.['u-task']).toBeUndefined();
    expect((await profile(page)).apc).toEqual({ n: 1, d: '2026-09-21' });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('Tastatur (UX-Befund 1): Aufgabe, aktives Feld und Prüfen-Knopf bleiben über der Tastatur; der Knopf in der Leiste prüft', async ({ page }) => {
    await fakeViewport(page);
    const { errors } = await boot(page, { migrated: true, now: TUE_9, localStorage: { 'lx:input': 'touch' } });
    await screen(page, 'today');
    await openTab(page, 'apply');
    await page.getByTestId('ax-row-summary').click();
    await screen(page, 'applyTask');
    await expect(page.getByTestId('ax-dock')).toHaveCount(0);
    const input = page.getByTestId('ax-input');
    await input.focus();
    await expect(page.getByTestId('ax-dock-check')).toBeVisible();
    await input.pressSequentially('A security team warns that tiny AI programs might soon copy themselves onto cheap home gadgets.');
    // iPhone 390 × 844: die Tastatur nimmt rund 364 px, sichtbar bleiben die obersten 480 px.
    await openKeyboard(page, 480);
    // Feld zwischen Leiste und Tastatur, Kurztitel und Knopf in der klebenden Leiste.
    await expect.poll(() => within(page, 'ax-input', 480)).toBe(true);
    for (const id of ['ax-bar-title', 'ax-dock-check']) expect(await within(page, id, 480)).toBe(true);
    const barBottom = (await page.getByTestId('exercise-bar').boundingBox())?.y ?? 0;
    const inputTop = (await input.boundingBox())?.y ?? 0;
    expect(inputTop).toBeGreaterThanOrEqual(barBottom);
    await expect(input).toBeFocused();
    await expect(page.getByTestId('ax-dock-check')).toBeDisabled();
    await input.pressSequentially(' Such devices rarely get updates, so a network of them would be hard to stop. In tests, the models ran even on weak TV boxes.');
    await expect(page.getByTestId('ax-dock-check')).toBeEnabled();
    // Tippen auf den Knopf in der Leiste prüft; danach ist die Leiste wieder ohne Knopf.
    await page.getByTestId('ax-dock-check').click();
    await expect(page.getByTestId('ax-result')).toBeVisible();
    await expect(page.getByTestId('ax-dock')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Kurzer Tag mit älterem Plan (eingefroren „Mail schreiben“): Schritt 3 ist ein eigener Satz mit EINEM Satz; der Zähler zählt nicht', async ({ page }) => {
    const { errors } = await boot(page, {
      migrated: true,
      now: TUE_9,
      localStorage: { 'lx:input': 'touch' },
      fake: { patch: { ...profileWith(TUE, twPlan('write'), ['u-focus'], { apc: { n: 2, d: '2026-09-21' }, kt: { [TUE]: 1 } }), ...reviewedLog(TUE) } },
    });
    await screen(page, 'today');
    await openTab(page, 'apply');
    // Großpaket P, P4: der ältere Plan bleibt lesbar (`ap: 'write'` steht weiter darin), Schritt 3 startet trotzdem die Brücken-Sätze.
    await expect(page.getByTestId('ax-today-start')).toHaveAttribute('data-kind', 'bridge');
    await expect(page.getByTestId('ax-today-start')).toContainText('Kurzer Tag');
    expect(((await profile(page)).plan as { u?: { ap?: string } }).u?.ap).toBe('write');
    await page.getByTestId('ax-today-start').click();
    await screen(page, 'applyBridge');
    await expect(page.getByTestId('bx-item')).toBeVisible();
    await expect(page.getByTestId('exercise')).toContainText('Satz 1 von 1');
    await page.getByTestId('bx-skip').click();
    await page.locator('[data-screen="unitCard"]').waitFor();
    await expect.poll(async () => ((await profile(page)).act as Record<string, Doc>)[TUE]?.['u-task']).toBe(1);
    expect((await profile(page)).apc).toEqual({ n: 2, d: '2026-09-21' });
    expect(errors).toEqual([]);
  });

  test('Ohne Claude: Disziplinen gesperrt mit Grund, kein toter Knopf', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true, now: TUE_9, fake: { capabilities: { sample: false } } });
    await screen(page, 'today');
    await openTab(page, 'apply');
    await expect(page.getByTestId('ax-row-reply')).toBeDisabled();
    await expect(page.getByTestId('ax-row-reply')).toContainText('Braucht Claude');
    expect(errors).toEqual([]);
  });
});

test.describe('Laptop 1440 px', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Frei üben „Artikel zusammenfassen“ (auch mit älterem Plan, eingefroren „Zusammenfassen“): Artikel beim Schreiben eingeklappt, Einfügen gesperrt, Hinweis „eigene Worte“; Kernpunkte einmal festgelegt; Rückmeldung in fester Reihenfolge', async ({ page }) => {
    const { errors, external } = await boot(page, {
      migrated: true,
      now: TUE_9,
      localStorage: { 'lx:input': 'keys' },
      fake: { patch: { ...profileWith(TUE, twPlan('summary'), ['u-focus']), ...reviewedLog(TUE) } },
    });
    await screen(page, 'today');
    await openTab(page, 'apply');
    await page.getByTestId('ax-row-summary').click();
    await screen(page, 'applyTask');
    await expect(page.getByTestId('ax-flow')).toHaveAttribute('data-kind', 'summary');
    await expect(page.getByTestId('ax-task')).toContainText('3 bis 5 Sätzen');
    await expect(page.getByTestId('ax-article')).toHaveAttribute('data-open', 'true');
    await expect(page.getByTestId('ax-article-text')).toContainText('red team');
    const input = page.getByTestId('ax-input');
    await expect(input).toHaveAttribute('autocorrect', 'off');
    // Einfügen ist gesperrt.
    await input.evaluate((el) => el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: new DataTransfer() })));
    await expect(page.getByTestId('ax-nopaste')).toBeVisible();
    // Wörtlich übernommen → Hinweis; der Artikel klappt beim Schreiben ein.
    await input.fill('Small AI models could within months begin to spread on their own across ordinary internet-connected devices.');
    await expect(page.getByTestId('ax-article')).toHaveAttribute('data-open', 'false');
    await expect(page.getByTestId('ax-copyhint')).toBeVisible();
    const own =
      'A security team warns that tiny AI programs might soon copy themselves onto cheap home gadgets. I think this is the biggest danger of our time. Such devices rarely get updates, so a network of them would be hard to stop. In tests, the models ran even on weak TV boxes.';
    await input.fill(own);
    await expect(page.getByTestId('ax-copyhint')).toHaveCount(0);
    await page.getByTestId('ax-check').click();
    await expect(page.getByTestId('ax-result')).toBeVisible();
    expect(await calls(page)).toEqual(['apply-keypoints:default', 'apply-summary:default']);
    await expect(page.getByTestId('ax-faithful')).toHaveAttribute('data-ok', 'false');
    await expect(page.getByTestId('ax-faithful')).toContainText('I think this is the biggest danger of our time');
    await expect(page.getByTestId('ax-own')).toHaveAttribute('data-hint', 'false');
    await expect(page.getByTestId('ax-point-1')).toBeVisible();
    // UX-Befund 5: Der Kernpunkt, der genau die erfundene Stelle zitiert, ist nicht „getroffen“ und zeigt das Zitat nicht noch einmal.
    await expect(page.getByTestId('ax-point-2')).toHaveAttribute('data-covered', 'partly');
    await expect(page.getByTestId('ax-point-2')).not.toContainText('I think');
    await expect(page.getByTestId('ax-point-doubt-2')).toBeVisible();
    // Feste Reihenfolge: Kernpunkte → richtig wiedergegeben → eigene Worte → Länge → Fehlerstellen; ohne Fehler „Das sitzt“ mit Zitat.
    const ys = await Promise.all(['ax-points', 'ax-faithful', 'ax-own', 'ax-length', 'ax-spots'].map(async (id) => (await page.getByTestId(id).boundingBox())?.y ?? 0));
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    await expect(page.getByTestId('ax-nospots')).toBeVisible();
    await expect(page.getByTestId('ax-sits')).toContainText('„');
    // Kernpunkte gespeichert (`sumkp`), die Zusammenfassung als `summary`; Überarbeiten fragt die Kernpunkte nicht neu an.
    await expect.poll(async () => (await outItems(page)).map((i) => String(i.k)).filter((k) => k === 'sumkp' || k === 'summary').sort()).toEqual(['sumkp', 'summary']);
    await page.getByTestId('ax-revise').click();
    await input.fill(`${own} Experts now ask for better update rules.`);
    await page.getByTestId('ax-check').click();
    await expect(page.getByTestId('ax-result')).toHaveAttribute('data-check', '2');
    expect(await calls(page)).toEqual(['apply-keypoints:default', 'apply-summary:default', 'apply-summary:default']);
    expect(await layoutProblems(page)).toEqual([]);
    expect(await axe(page)).toEqual([]);
    await page.getByTestId('ax-done').click();
    await screen(page, 'apply');
    // Frei geübt: kein Anwenden-Tag gezählt, Schritt 3 bleibt offen (die Pflicht sind die eigenen Sätze).
    expect((await profile(page)).apc).toBeUndefined();
    await expect(page.getByTestId('ax-today-start')).toHaveAttribute('data-kind', 'bridge');
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('W5 K8: Kein Tagesartikel → ein Text aus dem geprüften Vorrat mit festen Kernpunkten (keine Kernpunkt-Anfrage), Stil-Verbesserung nach den Fehlern', async ({ page }) => {
    const { errors } = await boot(page, {
      migrated: true,
      now: TUE_9,
      localStorage: { 'lx:input': 'keys' },
      fake: { patch: { ...profileWith(TUE, twPlan('summary'), ['u-focus']), ...reviewedLog(TUE), 'read/r-2026-09-20': null } },
    });
    await screen(page, 'today');
    await openTab(page, 'apply');
    await page.getByTestId('ax-row-summary').click();
    await screen(page, 'applyTask');
    await expect(page.getByTestId('ax-nomaterial')).toHaveCount(0);
    await expect(page.getByTestId('ax-flow')).toHaveAttribute('data-material', /^av\d{2}$/);
    await expect(page.getByTestId('ax-article-toggle')).toContainText('Textsammlung');
    await expect(page.getByTestId('ax-greet-hint')).toHaveCount(0);
    await page
      .getByTestId('ax-input')
      .fill('The article explains a change that many companies are facing. Teams find the old way hard to stop, so they test new tools step by step. In the end, clear rules matter more than the software.');
    await page.getByTestId('ax-check').click();
    await expect(page.getByTestId('ax-result')).toBeVisible();
    expect(await calls(page)).toEqual(['apply-summary:default']);
    await expect(page.getByTestId('ax-points').locator('li')).toHaveCount(4);
    await expect(page.getByTestId('ax-style-0')).toContainText('difficult to contain');
    const ys = await Promise.all(['ax-spots', 'ax-style'].map(async (id) => (await page.getByTestId(id).boundingBox())?.y ?? 0));
    expect(ys[0]).toBeLessThan(ys[1] ?? 0);
    await expect(page.getByTestId('ax-greet')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('W5 K14: dieselbe Mail kommt frühestens nach 14 Tagen wieder (gespeicherte Ergebnisse in out/<Monat>); Empfänger und Anrede beim Schreiben', async ({ page }) => {
    // Alle Mails außer m07 in den letzten 3 bis 13 Tagen beantwortet → m07 kommt dran, egal welche Mail der Tag sonst wählen würde.
    const ids = Array.from({ length: 16 }, (_, k) => `m${String(k + 1).padStart(2, '0')}`).filter((id) => id !== 'm07');
    const items = ids.map((theme, k) => ({ id: `reply-x${k}`, k: 'reply', d: `2026-09-${String(9 + (k % 11)).padStart(2, '0')}`, t: k + 1, theme }));
    const { errors } = await boot(page, {
      migrated: true,
      now: TUE_9,
      localStorage: { 'lx:input': 'keys' },
      fake: { patch: { 'out/2026-09': { v: 1, items } } },
    });
    await screen(page, 'today');
    await openTab(page, 'apply');
    await page.getByTestId('ax-row-reply').click();
    await screen(page, 'applyTask');
    await expect(page.getByTestId('ax-flow')).toHaveAttribute('data-material', 'm07');
    // Lehrer-Prüfung W5b: nur Empfänger und Ton, nicht die fertige Anrede.
    await expect(page.getByTestId('ax-greet-hint')).toHaveText('Anrede und Gruß passend wählen: extern, höflich');
    expect(errors).toEqual([]);
  });

  test('Frei üben „Eine Mail schreiben“: Wochen-Mail-Prüfung (c1-mail@2), Ergebnis mit Urteil, Länge, Fehlerstellen; Eintrag c1mail, Pflicht unberührt', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true, now: TUE_9, localStorage: { 'lx:input': 'keys' } });
    await screen(page, 'today');
    await openTab(page, 'apply');
    await page.getByTestId('ax-row-write').click();
    await screen(page, 'applyTask');
    await expect(page.getByTestId('ax-brief')).toContainText('Empfänger');
    // W5 K7: Empfänger mit Namen und passende Anrede als Hinweis.
    await expect(page.getByTestId('ax-greet-hint')).toHaveText(/^Anrede und Gruß passend wählen: (intern|extern), (förmlich|höflich|locker)$/);
    await expect(page.getByTestId('ax-task')).toHaveText('Lies, worum es geht, und schreib deine Mail auf Englisch.');
    await expect(page.getByTestId('ax-target-rule')).toContainText('Regel:');
    const mail = `Dear Ms Weber,

thank you for your message. We discussed about the budget yesterday and the team agreed on a first plan. I will tell you the details next week, because we still need more informations from the finance department. In the meantime, please let me know if you have any questions about the timeline or the next steps we have planned for the rollout.

Best regards
Emrah`;
    await page.getByTestId('ax-input').fill(mail);
    await page.getByTestId('ax-check').click();
    await expect(page.getByTestId('ax-self')).toBeVisible();
    await page.getByTestId('ax-reveal').click();
    await expect(page.getByTestId('ax-result')).toHaveAttribute('data-kind', 'write');
    await expect(page.getByTestId('ax-gist')).toContainText('Gut gegliedert');
    await expect(page.getByTestId('ax-spot-0')).toHaveAttribute('data-self', 'tried');
    // W5 K1: ohne eigenes Feld der Testantwort gelten die belegten Verbesserungen der Liste („tell you“ → „let you know“).
    await expect(page.getByTestId('ax-style-0')).toContainText('let you know');
    expect(await calls(page)).toEqual(['c1-mail:default']);
    await expect.poll(async () => (await outItems(page)).filter((i) => i.k === 'c1mail').length).toBe(1);
    await page.getByTestId('ax-done').click();
    await screen(page, 'apply');
    expect(((await profile(page)).act as Record<string, Doc>)[TUE]?.['u-task']).toBeUndefined();
    expect(errors).toEqual([]);
  });
});
