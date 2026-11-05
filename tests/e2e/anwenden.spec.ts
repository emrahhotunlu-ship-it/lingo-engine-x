import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openTab, screen } from './fixtures';
import { TUE_9, TW_DUTY, profileWith, reviewedLog } from './heuteHelpers';
import { dump } from './trainerHelpers';

// F3 Anwenden (docs/umbau/fokus2/anwenden-plan.md): Seite „Anwenden“, die Schreibübungen Antworten/Schreiben/Zusammenfassen am Handy (390) und Laptop (1440),
// Tagesweg Schritt 3 mit der eingefrorenen Disziplin (`u.ap`), Zähler `apc`, kurzer Tag. Die Testlaufzeit antwortet fest (`src/platform/dev/canned/apply.ts`,
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

  test('Seite: Heute dran aus dem eingefrorenen Plan (Zähler 1 → Antworten), vier Disziplinen; Antwort mit einem Feld je Pflichtpunkt, erst selbst verbessern, dann Lösung; Schritt 3 erledigt, Zähler +1', async ({ page }) => {
    const { errors, external } = await boot(page, { migrated: true, now: TUE_9, localStorage: { 'lx:input': 'touch' }, fake: { patch: { 'app/profile': { apc: { n: 1, d: '2026-09-21' } } } } });
    await screen(page, 'today');
    await expect.poll(async () => ((await profile(page)).plan as { u?: { ap?: string } } | undefined)?.u?.ap).toBe('reply');
    await openTab(page, 'apply');
    await expect(page.getByTestId('apply-hub')).toHaveAttribute('data-v', '2');
    await expect(page.getByTestId('ax-today-start')).toHaveAttribute('data-kind', 'reply');
    await expect(page.getByTestId('ax-all').locator('button')).toHaveCount(4);
    for (const id of ['hub-combo-own', 'ax-row-reply', 'ax-row-write', 'ax-row-summary']) await expect(page.getByTestId(id)).toBeEnabled();
    expect(await layoutProblems(page)).toEqual([]);
    expect(await axe(page)).toEqual([]);

    await page.getByTestId('ax-today-start').click();
    await screen(page, 'applyTask');
    await expect(page.getByTestId('ax-flow')).toHaveAttribute('data-device', 'touch');
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
    const parts = [
      'Hi, thank you for your message, I fully understand that your team is very busy at the moment.',
      'We discussed about the setup and it really needs only a few hours from your team in total.',
      'I can send a short summary with all the informations your managing director needs.',
      'Shall we talk again after the year-end closing in February?',
    ];
    for (let k = 0; k < n - 1; k++) await page.getByTestId(`ax-part-${k}`).fill(parts[k] ?? 'It depends of your plans for the next quarter, of course.');
    await page.getByTestId(`ax-part-${n - 1}`).fill('Best regards');
    await expect(page.getByTestId('ax-check')).toBeEnabled();
    await page.getByTestId('ax-check').click();

    // Erst selbst verbessern: Stellen mit Fehlerart, ohne Lösung.
    await expect(page.getByTestId('ax-self')).toBeVisible();
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
    await expect(page.getByTestId('ax-point-1')).toHaveAttribute('data-covered', 'yes');
    await expect(page.getByTestId('ax-tone')).toHaveAttribute('data-fit', 'fits');
    await expect(page.getByTestId('ax-length')).toBeVisible();
    await expect(page.getByTestId('ax-spot-0')).toHaveAttribute('data-self', 'ok');
    await expect(page.getByTestId('ax-spot-0')).toContainText('discussed');
    // Feste Reihenfolge: Pflichtpunkte → Ton → Länge → Fehlerstellen.
    const ys = await Promise.all(['ax-points', 'ax-tone', 'ax-length', 'ax-spots'].map(async (id) => (await page.getByTestId(id).boundingBox())?.y ?? 0));
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    await page.getByTestId('ax-better').click();
    await expect(page.getByTestId('ax-better-text')).toContainText('Best regards');
    await expect(page.getByTestId('ax-repairs')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    expect(await axe(page)).toEqual([]);

    // Gespeichert: `out/2026-09` (Art reply), höchstens 3 Fehlersätze `src: 'write'` mit Situation.
    await expect.poll(async () => (await outItems(page)).filter((i) => i.k === 'reply').length).toBe(1);
    const reps = await writeRepairs(page);
    expect(reps.length).toBeGreaterThan(0);
    expect(reps.length).toBeLessThanOrEqual(3);
    expect(reps.every((r) => typeof r.ctx === 'string' && r.ctx.length > 0)).toBe(true);

    await page.getByTestId('ax-done').click();
    await page.locator('[data-screen="unitCard"]').waitFor();
    await expect.poll(async () => ((await profile(page)).act as Record<string, Doc>)[TUE]?.['u-task']).toBe(1);
    await expect.poll(async () => (await profile(page)).apc).toEqual({ n: 2, d: TUE });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('Kurzer Tag: Schritt 3 ist ein eigener Satz mit EINEM Satz; der Zähler zählt nicht (die Disziplin wandert)', async ({ page }) => {
    const { errors } = await boot(page, {
      migrated: true,
      now: TUE_9,
      localStorage: { 'lx:input': 'touch' },
      fake: { patch: { ...profileWith(TUE, twPlan('write'), ['u-focus'], { apc: { n: 2, d: '2026-09-21' }, kt: { [TUE]: 1 } }), ...reviewedLog(TUE) } },
    });
    await screen(page, 'today');
    await openTab(page, 'apply');
    await expect(page.getByTestId('ax-today-start')).toHaveAttribute('data-kind', 'combo');
    await expect(page.getByTestId('ax-today-start')).toContainText('Kurzer Tag');
    await page.getByTestId('ax-today-start').click();
    await screen(page, 'comboSentence');
    await expect(page.getByTestId('combo-item')).toBeVisible();
    await page.getByTestId('combo-skip').click();
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

  test('Tagesweg Schritt 3 „Artikel zusammenfassen“: Artikel beim Schreiben eingeklappt, Einfügen gesperrt, Hinweis „eigene Worte“; Kernpunkte einmal festgelegt; Rückmeldung in fester Reihenfolge', async ({ page }) => {
    const { errors, external } = await boot(page, {
      migrated: true,
      now: TUE_9,
      localStorage: { 'lx:input': 'keys' },
      fake: { patch: { ...profileWith(TUE, twPlan('summary'), ['u-focus']), ...reviewedLog(TUE) } },
    });
    await screen(page, 'today');
    await expect(page.getByTestId('start')).toHaveAttribute('data-duty', 'ch:u-task');
    await page.getByTestId('start').click();
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
    await page.locator('[data-screen="unitCard"]').waitFor();
    await expect.poll(async () => (await profile(page)).apc).toEqual({ n: 1, d: TUE });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('Kein Artikel: im Tagesweg geht es mit eigenen Sätzen weiter', async ({ page }) => {
    const { errors } = await boot(page, {
      migrated: true,
      now: TUE_9,
      localStorage: { 'lx:input': 'keys' },
      fake: { patch: { ...profileWith(TUE, twPlan('summary'), ['u-focus']), ...reviewedLog(TUE), 'read/r-2026-09-20': null } },
    });
    await screen(page, 'today');
    await page.getByTestId('start').click();
    await screen(page, 'applyTask');
    await expect(page.getByTestId('ax-nomaterial')).toBeVisible();
    await page.getByTestId('ax-combo-instead').click();
    await screen(page, 'comboSentence');
    expect(errors).toEqual([]);
  });

  test('Frei üben „Eine Mail schreiben“: Wochen-Mail-Prüfung (c1-mail@1), Ergebnis mit Urteil, Länge, Fehlerstellen; Eintrag c1mail, Pflicht unberührt', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true, now: TUE_9, localStorage: { 'lx:input': 'keys' } });
    await screen(page, 'today');
    await openTab(page, 'apply');
    await page.getByTestId('ax-row-write').click();
    await screen(page, 'applyTask');
    await expect(page.getByTestId('ax-brief')).toContainText('Empfänger');
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
    expect(await calls(page)).toEqual(['c1-mail:default']);
    await expect.poll(async () => (await outItems(page)).filter((i) => i.k === 'c1mail').length).toBe(1);
    await page.getByTestId('ax-done').click();
    await screen(page, 'apply');
    expect(((await profile(page)).act as Record<string, Doc>)[TUE]?.['u-task']).toBeUndefined();
    expect(errors).toEqual([]);
  });
});
