import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, bootAt, openTab, screen, type BootOptions, type Lang, type Theme } from './fixtures';
import { typeInGap } from './learnHelpers';

// Kurse im Reiter „Lesen“ (Paket L8, docs/umbau/lesen-kurse.md, docs/umbau/lesen-routine-kurse.md): Kursübersicht, Lektionsliste, Lektion lesen,
// Fragen, Anwenden mit Musterlösung und „Claude prüfen“, Fortschritt (fertig = Zustand), Karten mitnehmen, Aufwärmen, Sperren, Handy und Desktop,
// drei Modi, beide Sprachen. Alle Daten erfunden (seed/read-courses.json: zwei Lektionen von K1; der Fortschritt `read/cp` fehlt = frischer Start).

type Dump = Record<string, Record<string, unknown>>;
const dump = (page: Page): Promise<Dump> => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { dump(): Dump } } }).__LINGO_FAKE__.db.dump());
const sampleCalls = (page: Page, id: string): Promise<number> =>
  page.evaluate((i) => (window as unknown as { __LINGO_FAKE__: { sampleCalls: Array<{ id: string }> } }).__LINGO_FAKE__.sampleCalls.filter((c) => c.id === i).length, id);

type Item = Record<string, unknown>;
/** Fortschritt, in dem Lektion 1 genug Lesezeit hat (die App wertet „Text gelesen“ erst nach 2 Sekunden je Satz). */
const CP_TIME: Record<string, Record<string, unknown>> = { 'read/cp': { v: 1, items: [{ id: 'k1-01', course: 'k1', n: 1, sec: 300, pos: 1 }] } };
const PH1 = [
  { w: 'run the tests', de: 'die Tests ausführen', e: 'It can fix a bug after you describe the symptoms, and it can run the tests to check the fix.' },
  { w: 'stay in control', de: 'die Kontrolle behalten', e: 'It asks for your approval before it edits a file or runs a command, so you stay in control.' },
];
const LESSON1_DONE: Item = { id: 'k1-01', course: 'k1', n: 1, sec: 400, rd: true, qa: 3, qok: 3, ap: true, mine: 'I stay in control. We run the tests.', done: true, tD: Date.parse('2026-09-19T10:00:00+02:00'), ph: PH1 };

const GOOD = 'Claude Code works inside my project and I stay in control of every change. It can also handle routine chores, so I see problems early.';

async function expectNoOverflow(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}
async function openRead(page: Page): Promise<void> {
  await openTab(page, 'read');
  await expect(page.getByTestId('read')).toHaveAttribute('data-load', 'ready');
  await expect(page.getByTestId('read-courses')).toHaveAttribute('data-load', 'ready');
}
const open = async (page: Page, opts: BootOptions = {}, id = 'k1-01'): Promise<ReturnType<typeof boot>> => {
  const booted = await bootAt(page, { name: 'readLesson', id }, opts);
  await screen(page, 'readLesson');
  return booted;
};

// ---------------------------------------------------------------- Übersicht und Kursseite

test.describe('Kurse: Übersicht auf „Lesen“ und Lektionsliste (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('acht Kurse, nur K1 und K5 aktiv (die übrigen zugeklappt); der Artikel ist der eine Hauptknopf, die Lektion steht in der eigenen Zeile „Kurs“ ohne „Heute:“', async ({ page }) => {
    const { errors, external } = await boot(page, { migrated: true });
    await screen(page, 'today');
    await openRead(page);
    const rows = page.getByTestId('read-course');
    // Zugeklappt: nur die aktiven Kurse; die sechs weiteren hinter „Weitere Kurse (6) folgen“.
    await expect(rows).toHaveCount(2);
    await expect(page.getByTestId('read-courses-later')).toContainText('Weitere Kurse (6) folgen');
    await page.getByTestId('read-courses-later').click();
    await expect(rows).toHaveCount(8);
    const active = await rows.evaluateAll((els) => els.map((el) => `${el.getAttribute('data-course')}:${el.getAttribute('data-active')}`));
    expect(active).toEqual(['k1:true', 'k5:true', 'k2:false', 'k3:false', 'k4:false', 'k6:false', 'k7:false', 'k8:false']);
    await expect(rows.nth(0)).toContainText('Claude Code in 10 Tagen');
    await expect(rows.nth(0)).toContainText('10 Lektionen');
    await expect(rows.nth(0)).toContainText('0 von 10');
    await expect(rows.nth(1)).toContainText('KI im Unternehmen');
    await expect(rows.nth(6)).toContainText('12 Lektionen');
    await expect(rows.nth(2)).toContainText('Später');
    // Nur die aktiven Kurse sind antippbar.
    expect(await rows.nth(2).evaluate((el) => el.tagName)).toBe('DIV');
    expect(await rows.nth(0).evaluate((el) => el.tagName)).toBe('BUTTON');
    // Ein gefüllter Hauptknopf: der Artikel. Die Lektion steht getrennt in der Zeile „Kurs“, kurz und ohne Umbruch.
    const primary = page.getByTestId('read-primary');
    await expect(primary).toHaveCount(1);
    await expect(primary).toHaveAttribute('data-kind', 'read');
    const lesson = page.getByTestId('read-lesson');
    await expect(lesson).toHaveText(/^Lektion 1 · 10\s*Min$/);
    await expect(lesson).not.toContainText('Heute');
    await expect(page.getByTestId('read-next-lesson')).toContainText('Kurs');
    const box = await lesson.boundingBox();
    expect(box!.height).toBeLessThan(70); // eine Zeile
    for (const el of await page.getByTestId('read').locator('button').all()) {
      const b = await el.boundingBox();
      if (b) expect(b.height, (await el.textContent()) ?? '').toBeGreaterThanOrEqual(43.5);
    }
    await expectNoOverflow(page);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('Kursseite: zehn Lektionen, die erste offen, alle weiteren gesperrt (Lektion n+1 nach n); der Hauptknopf öffnet die Lektion', async ({ page }) => {
    await boot(page, { migrated: true });
    await openRead(page);
    await page.getByTestId('read-course').first().click();
    await screen(page, 'readCourse');
    await expect(page.getByTestId('course-title')).toHaveText('Claude Code in 10 Tagen');
    const lessons = page.getByTestId('course-lesson');
    await expect(lessons).toHaveCount(10);
    const states = await lessons.evaluateAll((els) => els.map((el) => el.getAttribute('data-state')));
    expect(states).toEqual(['open', ...Array<string>(9).fill('locked')]);
    await expect(lessons.first()).toContainText('Was Claude Code ist');
    await expect(lessons.nth(1)).toContainText('Eine Aufgabe briefen');
    // Gesperrte Lektionen sind Zustand, kein Knopf.
    expect(await lessons.nth(1).evaluate((el) => el.tagName)).toBe('DIV');
    expect(await lessons.first().evaluate((el) => el.tagName)).toBe('BUTTON');
    await expect(page.getByTestId('course-hero')).toContainText('0 von 10 fertig');
    // Der Gesperrt-Satz steht einmal unter der Liste, nicht an jeder Zeile.
    await expect(page.getByTestId('course-locked-note')).toHaveCount(1);
    await expect(lessons.nth(1)).not.toContainText('Wird frei');
    const primary = page.getByTestId('course-primary');
    await expect(primary).toHaveText(/^Lektion 1 · 10\s*Min$/);
    await expectNoOverflow(page);
    await primary.click();
    await screen(page, 'readLesson');
    await expect(page.getByTestId('lsn')).toHaveAttribute('data-lesson', 'k1-01');
    await expect(page.getByTestId('tabbar')).toBeVisible();
  });

  test('Lektion fehlt (die Routine hat sie noch nicht geschrieben) oder ist kaputt: „Wird vorbereitet“, kein Hauptknopf für Lektionen, Artikel bleibt Hauptknopf', async ({ page }) => {
    const broken = { v: 1, by: 'routine', course: 'k1', n: 1, title: 'Broken', paras: [] };
    await boot(page, { migrated: true, fake: { patch: { 'read/c-k1-01': broken, 'read/c-k1-02': null } } });
    await openRead(page);
    const before = JSON.stringify((await dump(page))['read/c-k1-01']);
    expect((await dump(page))['read/c-k1-01']?.paras).toEqual([]);
    await expect(page.getByTestId('read-primary')).toHaveAttribute('data-kind', 'read');
    await expect(page.getByTestId('read-article')).toHaveCount(0);
    await page.getByTestId('read-course').first().click();
    await screen(page, 'readCourse');
    const lessons = page.getByTestId('course-lesson');
    expect(await lessons.evaluateAll((els) => els.map((el) => el.getAttribute('data-state')))).toEqual(['pending', ...Array<string>(9).fill('locked')]);
    await expect(page.getByTestId('course-pending')).toContainText('Claude schreibt diese Lektion für dich');
    await expect(page.getByTestId('course-primary')).toHaveCount(0);
    // Die kaputte Lektion wurde nicht überschrieben oder gelöscht.
    expect(JSON.stringify((await dump(page))['read/c-k1-01'])).toBe(before);
  });

  test('eine gesperrte Lektion lässt sich auch über die Adresse nicht öffnen', async ({ page }) => {
    await bootAt(page, { name: 'readLesson', id: 'k1-02' }, { migrated: true });
    await screen(page, 'readLesson');
    await expect(page.getByTestId('lsn-unavailable')).toHaveAttribute('data-status', 'locked');
    await expect(page.getByTestId('lsn-unavailable')).toContainText('wird frei, sobald die Lektion davor fertig ist');
  });
});

// ---------------------------------------------------------------- Die Lektion: lesen, Fragen, Anwenden, fertig

test.describe('Lektion lesen und abschließen (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Aufbau: Ziel, Wendungen, Text als Satzpaare in Ansicht B, Wort antippbar, Sprachtipp, drei Fragen, Anwenden', async ({ page }) => {
    const { errors, external } = await open(page, { migrated: true });
    await expect(page.getByTestId('rdr-topic')).toHaveText('K1 · Lektion 1 von 10');
    await expect(page.getByTestId('rdr-title')).toHaveText('What Claude Code Is');
    await expect(page.getByTestId('rdr-byclaude')).toContainText('Von Claude für diesen Kurs geschrieben · Stand: Oktober 2026');
    await expect(page.getByTestId('lsn-goal-text')).toContainText('Du kannst erklären, was Claude Code ist');
    await expect(page.getByTestId('lsn-phrase')).toHaveCount(5);
    await expect(page.getByTestId('lsn-warmup')).toHaveCount(0); // noch keine fertige Lektion
    // Ansicht B: Englisch allein, Deutsch auf Tipp.
    await expect(page.getByTestId('rdr')).toHaveAttribute('data-view', 'b');
    const first = page.locator('[data-testid="rdr-sentence"][data-n="1"]');
    await expect(first.getByTestId('rdr-de')).toHaveCount(0);
    await first.getByTestId('rdr-marker').click();
    await expect(first.getByTestId('rdr-de')).toContainText('Viele Menschen lernen Claude zunächst in einem Chatfenster kennen');
    // Wörter sind antippbar (ein Knopf je Wort).
    expect(await page.locator('[data-testid="rdr-text"] button.lx-word').count()).toBeGreaterThan(100);
    // Sprachtipp als Mini-Aufgabe: erst der falsche Satz mit „Wo steckt der Fehler?“, dann aufdecken (freiwillig).
    await expect(page.getByTestId('lsn-tip-find')).toContainText('Wo steckt der Fehler?');
    await expect(page.getByTestId('lsn-tip-sentence')).toContainText('I use Claude Code since two weeks.');
    await expect(page.getByTestId('lsn-tip-right')).toHaveCount(0);
    await page.getByTestId('lsn-tip-input').fill('I have been using Claude Code for two weeks.');
    await page.getByTestId('lsn-tip-reveal').click();
    await expect(page.getByTestId('lsn-tip-mine')).toContainText('I have been using Claude Code for two weeks.');
    await expect(page.getByTestId('lsn-tip-wrong')).toContainText('I use Claude Code since two weeks.');
    await expect(page.getByTestId('lsn-tip-right')).toContainText('I have been using Claude Code for two weeks.');
    await expect(page.getByTestId('lsn-tip-why')).toContainText('Present Perfect');
    await expect(page.getByTestId('rdr-q')).toHaveCount(3);
    await expect(page.getByTestId('lsn-apply')).toBeVisible();
    await expect(page.getByTestId('lsn-apply-target')).toHaveText([/stay in control/, /handle routine chores/]);
    await expect(page.getByTestId('lsn-sources')).toContainText('Claude Code overview');
    await expect(page.getByTestId('lsn-step')).toHaveCount(3);
    await expect(page.getByTestId('lsn-end')).toHaveCount(0); // fertig ist ein Zustand, vorher gibt es keinen Knopf
    await expectNoOverflow(page);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('Fragen, Anwenden (lokale Prüfung, Musterlösung, Claude prüfen) und Abschluss: fertig = Zustand, Fortschritt in read/cp, Lektionsdokumente unberührt', async ({ page }) => {
    const { errors, external } = await open(page, { migrated: true, fake: { patch: CP_TIME, sampleTickMs: 4 } });
    const lessonBefore = JSON.stringify((await dump(page))['read/c-k1-01']);
    const steps = page.getByTestId('lsn-step');
    // Drei Fragen mit Begründung.
    const q = page.getByTestId('rdr-q');
    for (const [i, right] of [1, 0, 2].entries()) {
      await q.nth(i).scrollIntoViewIfNeeded();
      await q.nth(i).getByTestId('rdr-opt').nth(right).click();
      await expect(q.nth(i)).toHaveAttribute('data-answered', 'right');
      await expect(q.nth(i).getByTestId('rdr-q-feedback')).toContainText('Warum');
    }
    await expect(steps.nth(1)).toHaveAttribute('data-state', 'done');
    await expect(steps.nth(1)).toContainText('3 von 3');
    await expect.poll(async () => ((await dump(page))['read/cp']?.items as Item[] | undefined)?.[0]).toMatchObject({ id: 'k1-01', qa: 3, qok: 3 });
    // Anwenden: zu kurz, nicht englisch, dann gut.
    const input = page.getByTestId('lsn-apply-input');
    await input.scrollIntoViewIfNeeded();
    await input.fill('Hello there.');
    await page.getByTestId('lsn-apply-send').click();
    await expect(page.getByTestId('lsn-apply-problem')).toContainText('mindestens zwei Sätze');
    await input.fill('Ich behalte die Kontrolle über das Projekt. Die Tests laufen jede Nacht automatisch durch.');
    await page.getByTestId('lsn-apply-send').click();
    await expect(page.getByTestId('lsn-apply-problem')).toContainText('auf Englisch');
    await expect(page.getByTestId('lsn-apply')).not.toHaveAttribute('data-sent', 'true');
    await input.fill(GOOD);
    await page.getByTestId('lsn-apply-send').click();
    await expect(page.getByTestId('lsn-apply')).toHaveAttribute('data-sent', 'true');
    await expect(page.getByTestId('lsn-apply-allused')).toHaveText('Du hast alle Wendungen benutzt.');
    await expect(page.getByTestId('lsn-apply-target')).toHaveText([/stay in control/, /handle routine chores/]);
    await expect(page.getByTestId('lsn-apply-target').first()).toHaveAttribute('data-state', 'used');
    await expect(page.getByTestId('lsn-model')).toContainText('Claude Code works inside my project, and I stay in control');
    await expect(input).toHaveAttribute('readonly', '');
    // Claude prüfen: drei Schichten (korrigiert · gehobene Fassung · warum), ein quick-Aufruf auf Tipp.
    expect(await sampleCalls(page, 'read-apply')).toBe(0);
    await page.getByTestId('lsn-claude-go').click();
    const reply = page.getByTestId('lsn-claude-reply');
    await expect(reply).toHaveAttribute('data-verdict', 'right');
    // Nichts doppelt (Kap. 15): Der Text war schon richtig, also „Keine Korrektur nötig“; die natürlichere Fassung ist hier die Musterlösung und entfällt.
    await expect(page.getByTestId('lsn-claude-nofix')).toHaveText('Keine Korrektur nötig');
    await expect(page.getByTestId('lsn-claude-fixed')).toHaveCount(0);
    await expect(page.getByTestId('lsn-claude-c1')).toHaveCount(0);
    await expect(page.getByTestId('lsn-claude-why')).toContainText('Wendung');
    expect(await sampleCalls(page, 'read-apply')).toBe(1);
    // Abschluss: alles erledigt, Zustand statt Knopf, ein Hauptknopf zur nächsten Lektion.
    const stepsCard = page.getByTestId('lsn-steps');
    await expect(stepsCard).toHaveAttribute('data-done', 'true');
    await expect(stepsCard).toContainText('Lektion fertig');
    await expect(steps).toHaveText([/Text gelesen/, /Fragen beantwortet \(3 von 3\)/, /Eigene Sätze abgeschickt/]);
    for (let i = 0; i < 3; i++) await expect(steps.nth(i)).toHaveAttribute('data-state', 'done');
    // Heute fertig: Ruhezeile und „Fertig für heute“ als Hauptknopf, die nächste Lektion nur leise (kein Zwang, Tempo 3–4 je Woche).
    await expect(page.getByTestId('lsn-rest')).toContainText('Für heute geschafft');
    await expect(page.getByTestId('lsn-end')).toHaveAttribute('data-kind', 'rest');
    await expect(page.getByTestId('lsn-end')).toHaveText('Fertig für heute');
    await expect(page.getByTestId('lsn-next-now')).toHaveText('Lektion 2 schon jetzt');
    // Fortschritt gespeichert: nur read/cp, mit eigenem Text und den behaltenen Wendungen; die Lektion selbst ist unverändert.
    await expect
      .poll(async () => ((await dump(page))['read/cp']?.items as Item[] | undefined)?.[0])
      .toMatchObject({ id: 'k1-01', course: 'k1', n: 1, rd: true, qa: 3, ap: true, done: true, mine: GOOD });
    const cp = ((await dump(page))['read/cp']?.items as Array<{ ph?: unknown[]; tD?: number }>)[0];
    expect(cp?.ph?.length).toBeGreaterThanOrEqual(4);
    expect(typeof cp?.tD).toBe('number');
    expect(JSON.stringify((await dump(page))['read/c-k1-01'])).toBe(lessonBefore);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    // Weiter zur nächsten Lektion: sie ist frei, das Aufwärmen baut zwei Lücken aus Lektion 1.
    await page.getByTestId('lsn-next-now').click();
    await screen(page, 'readLesson');
    await expect(page.getByTestId('lsn')).toHaveAttribute('data-lesson', 'k1-02');
    await expect(page.getByTestId('rdr-title')).toHaveText('Briefing a Task');
    await expect(page.getByTestId('lsn-warm-item')).toHaveCount(1); // eine Lücke nach der anderen
  });

  test('Wendungen als Lernkarten mitnehmen: Ursprungssatz aus dem Lektionstext, origin.ref = Kurs und Lektion', async ({ page }) => {
    await open(page, { migrated: true });
    const kw = page.getByTestId('rdr-kw');
    await expect(kw).toHaveCount(5);
    const first = kw.first();
    await first.scrollIntoViewIfNeeded();
    await first.getByTestId('rdr-kw-save').click();
    await expect(first.getByTestId('rdr-kw-saved')).toBeVisible();
    await expect
      .poll(async () => Object.values(await dump(page)).find((d) => (d.origin as { ref?: string } | undefined)?.ref === 'c-k1-01'))
      .toMatchObject({ src: 'read', core: true, origin: { kind: 'read', ref: 'c-k1-01', title: 'What Claude Code Is' }, state: 'new' });
    const card = Object.values(await dump(page)).find((d) => (d.origin as { ref?: string } | undefined)?.ref === 'c-k1-01') as { ex: string; word: string };
    expect(card.ex).toMatch(/\[[^\]]+\]/); // Ursprungssatz mit markierter Fundstelle
  });

  test('Aufwärmen aus einer früheren Lektion: eine Lücke nach der anderen, getippt wird IN die Lücke; gebeugte Eingabe gilt (grün), falsche zeigt die Lösung (rot, eigene Eingabe sichtbar) und das Warum; zählt nicht für „fertig“', async ({ page }) => {
    await open(page, { migrated: true, fake: { patch: { 'read/cp': { v: 1, items: [LESSON1_DONE] } } } }, 'k1-02');
    await expect(page.getByTestId('lsn-warmup')).toBeVisible();
    await expect(page.getByTestId('lsn-warmup')).toContainText('so festigst du sie');
    const items = page.getByTestId('lsn-warm-item');
    // Zuerst nur die erste Lücke; die Eingabe sitzt in der Lücke (kein Feld unter dem Satz).
    await expect(items).toHaveCount(1);
    await expect(items.first().getByTestId('gap')).toBeVisible();
    await expect(items.first().locator('input.lx-field')).toHaveCount(0);
    await expect(page.getByTestId('lsn-warm-gap').first()).toContainText('and it can');
    await expect(page.getByTestId('lsn-warm-gap').first()).toContainText('to check the fix');
    await typeInGap(page, 'running the tests');
    await items.nth(0).getByTestId('lsn-warm-check').click();
    await expect(items.nth(0)).toHaveAttribute('data-state', 'right');
    await expect(items.nth(0).getByTestId('gap')).toHaveAttribute('data-state', 'correct');
    await expect(items.nth(0).getByTestId('lsn-warm-why')).toContainText('(aus Lektion 1)');
    // Jetzt erscheint die zweite Lücke (das Eingabefeld hängt erst nach dem Zeichnen an ihr: warten, bis es ihre Beschriftung trägt).
    await expect(items).toHaveCount(2);
    await expect(page.getByTestId('gap-input')).toHaveAttribute('aria-label', 'Lücke 2');
    await typeInGap(page, 'keep calm');
    await items.nth(1).getByTestId('lsn-warm-check').click();
    await expect(items.nth(1)).toHaveAttribute('data-state', 'wrong');
    await expect(items.nth(1).getByTestId('lsn-warm-result')).toContainText('Gesucht war: stay in control');
    await expect(items.nth(1).getByTestId('gap-given')).toContainText('keep calm');
    await expect(items.nth(1).getByTestId('gap-solution')).toContainText('stay in control');
    await expect(items.nth(1).getByTestId('lsn-warm-why')).toContainText('die Kontrolle behalten');
    // Aufwärmen verändert den Fortschritt nicht.
    await expect(page.getByTestId('lsn-steps')).not.toHaveAttribute('data-done', 'true');
    await page.getByTestId('lsn-warm-toggle').click();
    await expect(items).toHaveCount(0);
  });

  test('Claude fällt aus oder liefert Unbrauchbares: ruhige Fehlerkarte mit „Erneut versuchen“, Musterlösung bleibt; ohne Claude nur die Musterlösung', async ({ page }) => {
    await open(page, { migrated: true, fake: { patch: CP_TIME, sampleTickMs: 4 } });
    await page.getByTestId('lsn-apply-input').scrollIntoViewIfNeeded();
    await page.getByTestId('lsn-apply-input').fill(`${GOOD} zzjson`);
    await page.getByTestId('lsn-apply-send').click();
    await page.getByTestId('lsn-claude-go').click();
    await expect(page.getByTestId('ai-error')).toBeVisible();
    await expect(page.getByTestId('ai-retry')).toBeVisible();
    await expect(page.getByTestId('lsn-model')).toBeVisible();
    await expect(page.getByTestId('lsn-claude-reply')).toHaveCount(0);
    expect(await sampleCalls(page, 'read-apply')).toBe(1); // kein automatischer zweiter Versuch bei kaputtem JSON
  });

  test('ohne sample (Claude nicht verfügbar): Abschicken und Musterlösung gehen, „Claude prüfen“ fehlt', async ({ page }) => {
    await open(page, { migrated: true, fake: { patch: CP_TIME, capabilities: { sample: false } } });
    await page.getByTestId('lsn-apply-input').scrollIntoViewIfNeeded();
    await page.getByTestId('lsn-apply-input').fill(GOOD);
    await page.getByTestId('lsn-apply-send').click();
    await expect(page.getByTestId('lsn-model')).toBeVisible();
    await expect(page.getByTestId('lsn-claude-go')).toHaveCount(0);
    await expect(page.getByTestId('lsn-claude-off')).toBeVisible();
  });

  test('nach der fertigen Lektion bietet der Hauptknopf nicht gleich die nächste an; die Kursseite zeigt Fortschritt, die zweite Lektion ist frei', async ({ page }) => {
    await boot(page, { migrated: true, fake: { patch: { 'read/cp': { v: 1, items: [{ ...LESSON1_DONE, tD: Date.parse('2026-09-20T18:00:00+02:00') }] } } } });
    await openRead(page);
    await expect(page.getByTestId('read-primary')).toHaveAttribute('data-kind', 'read'); // heute schon eine Lektion fertig: Lektionen sind Extra
    await expect(page.getByTestId('read-lesson')).toHaveCount(0); // und die Zeile „Kurs“ bietet keine zweite an
    await expect(page.getByTestId('read-course').first()).toContainText('1 von 10');
    await page.getByTestId('read-course').first().click();
    await screen(page, 'readCourse');
    const states = await page.getByTestId('course-lesson').evaluateAll((els) => els.map((el) => el.getAttribute('data-state')));
    expect(states).toEqual(['done', 'open', ...Array<string>(8).fill('locked')]);
    await expect(page.getByTestId('course-primary')).toHaveText(/^Lektion 2 · 10\s*Min$/);
    // Eine fertige Lektion bleibt antippbar (zum Nachlesen), zeigt aber ihren eigenen Text und kein „Abschicken“ mehr.
    await page.getByTestId('course-lesson').first().click();
    await screen(page, 'readLesson');
    await expect(page.getByTestId('lsn-apply')).toHaveAttribute('data-sent', 'true');
    await expect(page.getByTestId('lsn-apply-input')).toHaveValue('I stay in control. We run the tests.');
    await expect(page.getByTestId('lsn-apply-send')).toHaveCount(0);
  });

  test('eine angefangene Lektion steht immer in der Zeile „Kurs“ („Weiter mit Lektion 2“), auch wenn heute schon eine fertig wurde', async ({ page }) => {
    await boot(page, { migrated: true, fake: { patch: { 'read/cp': { v: 1, items: [{ ...LESSON1_DONE, tD: Date.parse('2026-09-20T18:00:00+02:00') }, { id: 'k1-02', course: 'k1', n: 2, sec: 30, pos: 3 }] } } } });
    await openRead(page);
    await expect(page.getByTestId('read-lesson')).toHaveAttribute('data-kind', 'lesson');
    await expect(page.getByTestId('read-lesson')).toHaveText('Weiter mit Lektion 2');
    await expect(page.getByTestId('read-primary')).toHaveAttribute('data-kind', 'read');
  });
});

// ---------------------------------------------------------------- Englisch und Desktop

test.describe('Kurse auf Englisch und am Desktop', () => {
  test('Englisch: Übersicht, Knopf, Kursseite und Lektion in der Sprache der Oberfläche', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const { errors } = await boot(page, { migrated: true, lang: 'en' });
    await openRead(page);
    await expect(page.getByTestId('read-lesson')).toHaveText(/^Lesson 1 · 10\s*min$/);
    await expect(page.getByTestId('read-course').first()).toContainText('Claude Code in 10 Days');
    await page.getByTestId('read-courses-later').click();
    await expect(page.getByTestId('read-course').nth(2)).toContainText('Later');
    await page.getByTestId('read-lesson').click();
    await screen(page, 'readLesson');
    await expect(page.getByTestId('rdr-topic')).toHaveText('K1 · Lesson 1 of 10');
    await expect(page.getByTestId('lsn-goal')).toContainText('Goal of this lesson');
    // Sprachtreue: Ziel, Lage und Begründungen stehen auf Englisch, wenn die Lektion sie mitbringt (kein Deutsch daneben).
    await expect(page.getByTestId('lsn-goal-text')).toContainText('You can explain what Claude Code is');
    await expect(page.getByTestId('lsn-goal-text')).toHaveAttribute('lang', 'en');
    await expect(page.getByTestId('lsn-apply-situation')).toContainText('Your colleague Jonas asks');
    await page.getByTestId('lsn-tip-reveal').click();
    await expect(page.getByTestId('lsn-tip-why')).toContainText('present perfect');
    await expect(page.getByTestId('lsn-tip-why')).toHaveAttribute('lang', 'en');
    const q = page.getByTestId('rdr-q');
    await q.first().scrollIntoViewIfNeeded();
    await q.first().getByTestId('rdr-opt').nth(0).click();
    await expect(q.first().getByTestId('rdr-q-feedback')).toContainText('Why: The lesson describes');
    await expect(page.getByTestId('lsn-tip')).toContainText('Language tip');
    await expect(page.getByTestId('lsn-apply')).toContainText('Use it yourself');
    await expectNoOverflow(page);
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------- Barrierefreiheit in drei Modi

for (const theme of ['dark', 'dim', 'light'] as const satisfies readonly Theme[]) {
  for (const [width, lang] of [[390, 'de'], [1280, 'en']] as const satisfies ReadonlyArray<readonly [number, Lang]>) {
    test(`axe · Kurse · ${theme} · ${width}px · ${lang}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await boot(page, { theme, lang, migrated: true, fake: { patch: { 'read/cp': { v: 1, items: [LESSON1_DONE] } } } });
      await openRead(page);
      const run = async (label: string): Promise<void> => {
        const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(res.violations.map((v) => `${label} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
      };
      await run('lesen');
      await page.getByTestId('read-course').first().click();
      await screen(page, 'readCourse');
      await run('kurs');
      await page.getByTestId('course-primary').click();
      await screen(page, 'readLesson');
      await expect(page.getByTestId('lsn-warmup')).toBeVisible();
      await page.getByTestId('lsn-apply-input').scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await run('lektion');
    });
  }
}
