import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, screen } from './fixtures';
import { BY_ID, answerItem, chapterOnePatch, mark, openChapterOne, runGate, since, start, topicDoc, type Doc } from './gateHelpers';
import { MON, MON_9, VG_BLOCKS, profileWith, reviewedLog, vgPlan } from './heuteHelpers';
import { dump } from './trainerHelpers';

// Kapitelprüfung (Lernplattform 3.0 §4.4, P42): Karte auf Heute und Abschnitt im Kapitelblatt nur, wenn alles stimmt; das Blatt mit Grammatikaufgaben aus dem
// Vorrat (`c1x-gate`) und Kapitelwörtern; Abbrechen speichert nichts; Bestehen schreibt nur `app/c1.gates` und `app/profile.ms` (nie ein Thema, nie die Serie),
// zeigt den Aufstieg und gibt drei eigene Sätze als Beleg; Nichtbestehen sagt „Noch nicht.“ mit dem nächsten Termin.

test.describe('Handy 390', () => {
  test.setTimeout(150_000);
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Kapitelblatt: bereit, Start, 14 Grammatikaufgaben aus dem Vorrat + Kapitelwörter, nichts wird vorher geschrieben', async ({ page }) => {
    const { errors } = await start(page, chapterOnePatch());
    await openChapterOne(page);
    await expect(page.getByTestId('gate-section')).toHaveAttribute('data-state', 'ready');
    await expect(page.getByTestId('gate-start-sheet')).toBeVisible();
    const w0 = await mark(page);
    await page.getByTestId('gate-start-sheet').click();
    await expect(page.getByTestId('gate-intro')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    await page.getByTestId('gate-go').click();
    await expect(page.getByTestId('gate-part')).toContainText('Teil 1 von 2');
    const first = await page.getByTestId('place-item').getAttribute('data-id');
    expect(BY_ID.get(first ?? '')?.kind).toMatch(/^(ocl|kwt|err)$/);
    // Keine Rückmeldung, kein Tipp, kein Wörterbuch während der Prüfung.
    await expect(page.getByTestId('verdict')).toHaveCount(0);
    await expect(page.getByTestId('explanation')).toHaveCount(0);
    expect(await since(page, w0)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('bestanden: Ergebnis mit Ziel, Einsatz-Satz, drei Belegsätzen; geschrieben wird nur app/c1.gates und app/profile.ms; Aufstieg; danach „Bestanden“', async ({ page }) => {
    const { errors } = await start(page, chapterOnePatch());
    const before = await dump(page);
    await openChapterOne(page);
    const w0 = await mark(page);
    await page.getByTestId('gate-start-sheet').click();
    const { items, wordsAnswered } = await runGate(page, { grammarRight: true, wordsRight: true });
    expect(items).toHaveLength(14);
    expect(new Set(items).size).toBe(14);
    expect(wordsAnswered).toBeGreaterThanOrEqual(7);
    const res = page.getByTestId('gate-result');
    await expect(res).toHaveAttribute('data-ok', 'true');
    await expect(res).toContainText('Kapitel 1 abgeschlossen');
    await expect(page.getByTestId('gate-res-grammar')).toContainText('14 von 14');
    await expect(page.getByTestId('gate-res-goal')).not.toBeEmpty();
    await expect(page.getByTestId('gate-res-use').locator('li').first()).toBeVisible();
    expect(await page.getByTestId('gate-res-proofs').locator('li').count()).toBe(3);
    await expect(page.getByTestId('gate-res-next')).toContainText('Kapitel 2');
    // Kein „durchgefallen“-Ton, kein Ausrufezeichen, kein Niveau.
    const text = (await res.innerText()).replace(/\s+/g, ' ');
    expect(text).not.toMatch(/durchgefallen|!|\b(B2|C1)\b/);
    // Gespeichert: genau ein Versuch, bestanden; Meilenstein ch1 gemerkt.
    await expect.poll(async () => ((await dump(page))['app/c1'] as { gates?: Doc[] } | undefined)?.gates?.length).toBe(1);
    const after = await dump(page);
    expect((after['app/c1'] as { gates: Array<{ ch: number; ok: boolean; g: number[] }> }).gates[0]).toMatchObject({ ch: 1, ok: true, g: [14, 14] });
    await expect.poll(async () => (((await dump(page))['app/profile'] as { ms?: Doc } | undefined)?.ms ?? {}).ch1).toBeTruthy();
    // Aufstieg des Meilensteins „Kapitel 1“ (einmal): Karte mit Emblem; Weiter schließt.
    await expect(page.getByTestId('levelup')).toBeVisible();
    await expect(page.getByTestId('levelup')).toHaveAttribute('data-id', 'ch1');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('levelup')).toHaveCount(0);
    // Nur diese beiden Dokumente wurden geschrieben: keine Themen, kein Tagesprotokoll, keine Serie.
    const w = await since(page, w0);
    expect(w.filter((p) => p.startsWith('grammar/') || p.startsWith('log/') || p.startsWith('vocab/'))).toEqual([]);
    expect(new Set(w)).toEqual(new Set(['app/c1', 'app/profile']));
    for (const k of Object.keys(before).filter((k) => k.startsWith('grammar/'))) expect(after[k]).toEqual(before[k]);
    const prof = (await dump(page))['app/profile'] as Doc;
    expect(prof.pflicht ?? {}).toEqual((before['app/profile'] as Doc).pflicht ?? {});
    // Schließen: der Abschnitt im Kapitelblatt sagt „Bestanden“, kein Startknopf mehr.
    await page.getByTestId('gate-done').click();
    await expect(page.getByTestId('gate')).toHaveCount(0);
    await expect(page.getByTestId('gate-section')).toHaveAttribute('data-state', 'passed');
    await expect(page.getByTestId('gate-status')).toContainText('Bestanden am');
    await expect(page.getByTestId('gate-start-sheet')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('nicht bestanden: „Noch nicht.“ mit Themen und neuem Termin; ein Versuch gespeichert, kein Meilenstein; danach Pause', async ({ page }) => {
    const { errors } = await start(page, chapterOnePatch());
    await openChapterOne(page);
    await page.getByTestId('gate-start-sheet').click();
    await runGate(page, { grammarRight: false, wordsRight: false });
    const res = page.getByTestId('gate-result');
    await expect(res).toHaveAttribute('data-ok', 'false');
    await expect(res).toContainText('Noch nicht.');
    await expect(page.getByTestId('gate-res-retry')).toHaveAttribute('data-from', '2026-09-27');
    await expect(page.getByTestId('gate-res-weak')).toBeVisible();
    await expect(page.getByTestId('gate-res-proofs')).toHaveCount(0);
    const text = (await res.innerText()).replace(/\s+/g, ' ');
    expect(text).not.toMatch(/durchgefallen|gescheitert|verloren|!/i);
    await expect.poll(async () => ((await dump(page))['app/c1'] as { gates?: Doc[] } | undefined)?.gates?.length).toBe(1);
    expect(((await dump(page))['app/c1'] as { gates: Doc[] }).gates[0]).toMatchObject({ ch: 1, ok: false, g: [0, 14] });
    expect((((await dump(page))['app/profile'] as { ms?: Doc } | undefined)?.ms ?? {}).ch1).toBeUndefined();
    await expect(page.getByTestId('levelup')).toHaveCount(0);
    await page.getByTestId('gate-done').click();
    await expect(page.getByTestId('gate-section')).toHaveAttribute('data-state', 'pause');
    await expect(page.getByTestId('gate-start-sheet')).toHaveCount(0);
    await expect(page.getByTestId('gate-status')).toContainText('Neuer Versuch ab');
    expect(errors).toEqual([]);
  });

  test('Abbrechen speichert nichts und zählt nicht als Versuch (Schließen mit Escape ebenso)', async ({ page }) => {
    const { errors } = await start(page, chapterOnePatch());
    await openChapterOne(page);
    const w0 = await mark(page);
    await page.getByTestId('gate-start-sheet').click();
    await page.getByTestId('gate-go').click();
    await answerItem(page, false);
    await page.getByTestId('gate-cancel').click();
    await expect(page.getByTestId('gate')).toHaveCount(0);
    await page.getByTestId('gate-start-sheet').click();
    await page.getByTestId('gate-go').click();
    await answerItem(page, false);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('gate')).toHaveCount(0);
    expect(await since(page, w0)).toEqual([]);
    expect((await dump(page))['app/c1']).toBeUndefined();
    await page.getByTestId('gate-start-sheet').click();
    await expect(page.getByTestId('gate-intro')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('nicht bereit: der Abschnitt nennt den Grund und hat keinen Startknopf (Themen fehlen, Einführung zu frisch, Thema zu schwach)', async ({ page }) => {
    const { errors } = await start(page, chapterOnePatch({ skip: ['past-perfect'] }));
    await openChapterOne(page);
    await expect(page.getByTestId('gate-section')).toHaveAttribute('data-state', 'locked');
    await expect(page.getByTestId('gate-status')).toContainText('alle Themen des Kapitels kennengelernt');
    await expect(page.getByTestId('gate-start-sheet')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Einführung zu frisch: nennt das früheste Datum', async ({ page }) => {
    const { errors } = await start(page, chapterOnePatch({ intro: '2026-09-10' }));
    await openChapterOne(page);
    await expect(page.getByTestId('gate-section')).toHaveAttribute('data-state', 'locked');
    await expect(page.getByTestId('gate-status')).toContainText('24. September');
    await expect(page.getByTestId('gate-start-sheet')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Thema unter p 0,6: nennt das Thema; kein Startknopf', async ({ page }) => {
    const patch = chapterOnePatch();
    patch['grammar/used-to'] = topicDoc('used-to', { p: 0.45 });
    const { errors } = await start(page, patch);
    await openChapterOne(page);
    await expect(page.getByTestId('gate-status')).toContainText('noch ein wenig üben');
    await expect(page.getByTestId('gate-start-sheet')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Heute (Tag geschafft): Karte „Kapitel 1 · Abschlussprüfung“ als Extra, kein Pflichtpunkt; der Tageszähler ändert sich nicht', async ({ page }) => {
    const plan = { ...vgPlan(MON), u: { ...(vgPlan(MON).u as Doc), b: VG_BLOCKS } };
    const { errors } = await boot(page, {
      migrated: true,
      now: MON_9,
      fake: { patch: { ...chapterOnePatch(), ...profileWith(MON, plan, ['u-focus', 'u-task', 'u-again'], {}), ...reviewedLog(MON) } },
    });
    await screen(page, 'today');
    await expect(page.getByTestId('today-card')).toHaveAttribute('data-done', 'true');
    const card = page.getByTestId('gate-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Kapitel 1 · Abschlussprüfung');
    await expect(card).toContainText('Extra');
    const status = page.getByTestId('today-status');
    const done = await status.getAttribute('data-done');
    const total = await status.getAttribute('data-total');
    await page.getByTestId('gate-start').click();
    await expect(page.getByTestId('gate-intro')).toBeVisible();
    await page.getByTestId('gate-cancel').click();
    await expect(page.getByTestId('gate')).toHaveCount(0);
    expect(await status.getAttribute('data-done')).toBe(done);
    expect(await status.getAttribute('data-total')).toBe(total);
    expect(await layoutProblems(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Heute (Tag geschafft) ohne bereite Prüfung: keine Karte', async ({ page }) => {
    const plan = { ...vgPlan(MON), u: { ...(vgPlan(MON).u as Doc), b: VG_BLOCKS } };
    await boot(page, { migrated: true, now: MON_9, fake: { patch: { ...profileWith(MON, plan, ['u-focus', 'u-task', 'u-again'], {}), ...reviewedLog(MON) } } });
    await screen(page, 'today');
    await expect(page.getByTestId('today-card')).toHaveAttribute('data-done', 'true');
    await expect(page.getByTestId('gate-card')).toHaveCount(0);
  });

  test('Heute: bestandene Prüfung → Meilenstein „Kapitel 1“ steht auf der Abschlusskarte, der Aufstieg läuft einmal, die Wort-Marken schweigen bei der Umstellung', async ({ page }) => {
    const plan = { ...vgPlan(MON), u: { ...(vgPlan(MON).u as Doc), b: VG_BLOCKS } };
    const c1 = { v: 1, checks: [], gates: [{ d: '2026-09-18', ch: 1, g: [13, 14], w: [8, 8], ok: true }], prod: [], bad: [] };
    const { errors } = await boot(page, {
      migrated: true,
      now: MON_9,
      fake: { patch: { ...chapterOnePatch(), 'app/c1': c1, ...profileWith(MON, plan, ['u-focus', 'u-task', 'u-again'], {}), ...reviewedLog(MON) } },
    });
    await screen(page, 'today');
    await expect(page.getByTestId('today-milestone')).toHaveAttribute('data-id', 'ch1');
    await expect(page.getByTestId('today-milestone')).toContainText('Kapitel 1 abgeschlossen');
    await expect(page.getByTestId('today-goal')).toHaveCount(0);
    await expect(page.getByTestId('levelup')).toBeVisible();
    await expect(page.getByTestId('levelup')).toHaveAttribute('data-id', 'ch1');
    await page.getByTestId('levelup-continue').click();
    await expect(page.getByTestId('levelup')).toHaveCount(0);
    // Gemerkt als Tag (gezeigt), die Umstellung auf festUnits ist vermerkt; die Prüfungskarte ist weg (bestanden).
    const ms = ((await dump(page))['app/profile'] as { ms?: Doc }).ms ?? {};
    expect(ms.ch1).toBe(MON);
    expect(ms.fu).toBe(MON);
    await expect(page.getByTestId('gate-card')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Handy 390: kein Querscrollen und axe 0 in allen Schritten der Prüfung', async ({ page }) => {
    const { errors } = await start(page, chapterOnePatch());
    await openChapterOne(page);
    const axe = async (): Promise<string[]> => (await new AxeBuilder({ page }).include('[data-testid="gate"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => v.id);
    await page.getByTestId('gate-start-sheet').click();
    expect(await layoutProblems(page)).toEqual([]);
    expect(await axe()).toEqual([]);
    await page.getByTestId('gate-go').click();
    await expect(page.getByTestId('place-item')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    expect(await axe()).toEqual([]);
    await runRest(page);
    await expect(page.getByTestId('gate-result')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    expect(await axe()).toEqual([]);
    expect(errors).toEqual([]);
  });
});

/** Rest der Prüfung schnell beenden (alles „Weiß ich nicht“). */
async function runRest(page: Page): Promise<void> {
  for (let k = 0; k < 40; k++) {
    await expect(page.getByTestId('place-item').or(page.getByTestId('gate-word')).or(page.getByTestId('gate-result'))).toBeVisible();
    if (await page.getByTestId('place-item').count()) await page.getByTestId('place-dontknow').click();
    else if (await page.getByTestId('gate-word').count()) await page.getByTestId('gate-word-dontknow').click();
    else break;
  }
}

test.describe('Laptop 1280', () => {
  test.setTimeout(60_000);
  test.use({ viewport: { width: 1280, height: 800 } });

  test('Kapitelblatt und Prüfung am Laptop: Blatt öffnet, Intro, erste Aufgabe, Esc schließt ohne zu schreiben', async ({ page }) => {
    const { errors } = await start(page, chapterOnePatch());
    await page.locator('[data-testid="program-chapter"][data-chapter="k1"] [data-testid="program-chapter-open"]').first().click();
    await page.getByTestId('program-more').click();
    await expect(page.getByTestId('chapter-sheet')).toBeVisible();
    const w0 = await mark(page);
    await page.getByTestId('gate-start-sheet').click();
    await expect(page.getByTestId('gate-intro')).toBeVisible();
    await page.getByTestId('gate-go').click();
    await expect(page.getByTestId('place-item')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('gate')).toHaveCount(0);
    expect(await since(page, w0)).toEqual([]);
    expect(errors).toEqual([]);
  });
});
