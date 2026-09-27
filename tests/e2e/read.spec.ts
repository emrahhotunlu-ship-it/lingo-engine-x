import { expect, test } from '@playwright/test';
import { boot, layoutProblems } from './fixtures';
import { ARTICLE_OWN, ARTICLE_Q, DAY, answerAll, dump, entriesOf, openModule, sampleCalls } from './inputHelpers';

// Lesen (Plan §4.1, §8.3): Artikel lesen → Wort antippen → Karte speichern → Fragen mit Beleg →
// Abschluss ohne KI → Zusammenfassung prüfen lassen (App-Aufgabe) → reading/r*, Radar, act.read.

const PATCH = { [`articles/${ARTICLE_OWN}`]: null };

test('Lesen: kompletter Durchlauf mit Karte, Fragen, Zusammenfassung und Schreibwegen', async ({ page }) => {
  test.setTimeout(90_000);
  const { errors, external } = await boot(page, { migrated: true, fake: { patch: PATCH } });
  await openModule(page, 'read');
  const unit = page.getByTestId('unit');
  await expect(unit).toHaveAttribute('data-kind', 'read');
  await expect(unit).toHaveAttribute('data-state', 'reading');
  await expect(page.getByTestId('article')).toHaveAttribute('data-id', ARTICLE_Q);
  await expect(page.getByTestId('article')).toHaveAttribute('lang', 'en');
  await expect(page.getByTestId('unit-status')).toContainText('Lesen · B2 · Beruf');
  expect(await layoutProblems(page)).toEqual([]);

  // Wort antippen → als Karte speichern (Herkunft Lesen, Ursprungssatz aus dem Text).
  await page.getByTestId('article').locator('button.lx-word[data-lookup="benefit"]').first().click();
  await expect(page.getByTestId('lookup')).toBeVisible();
  await page.getByTestId('lk-save').click();
  await expect(page.getByTestId('lk-saved')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('lookup')).toHaveCount(0);

  await page.getByTestId('read-done').click();
  await expect(unit).toHaveAttribute('data-state', 'questions');
  await expect(page.getByTestId('question-status')).toContainText('Frage 1 von 4');
  // Nach der Wahl: Beleg im Text und Erklärung in der Oberflächensprache – auch bei richtiger Antwort.
  await page.getByTestId('option').first().click();
  await expect(page.getByTestId('evidence')).toBeVisible();
  await expect(page.getByTestId('explain')).toBeVisible();
  await page.getByTestId('next').click();
  await answerAll(page, 3, 1);

  // Abschluss: Einheit erledigt (ohne KI), dann die freiwillige Zusammenfassung.
  await expect(page.getByTestId('unit-done')).toBeVisible();
  await expect(page.getByTestId('summary-step')).toBeVisible();
  await page.getByTestId('summary-draft').fill('AI tools help office workers to summarise long texts and informations quickly, but people must always check the results carefully.');
  await page.getByTestId('summary-check').click();
  await expect(page.getByTestId('reading-review')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('covered')).toContainText('von 5 Kernpunkten getroffen');
  await expect(page.getByTestId('error-mark').first()).toBeVisible();

  const db = await dump(page);
  const reading = Object.entries(db).filter(([p, d]) => p.startsWith('reading/') && d.articleId === ARTICLE_Q);
  expect(reading).toHaveLength(1);
  const r = reading[0]?.[1] as Record<string, unknown> & { quiz: { n: number; ok: number }; res: Record<string, unknown> };
  expect(r).toMatchObject({ date: DAY, level: 'B2', domain: 'work', ref: `articles/${ARTICLE_Q}` });
  expect(r.quiz.n).toBe(4);
  expect(String(r.summary)).toContain('summarise');
  expect(r.res).toMatchObject({ lang: 'de', pv: 'reading-check@1' });
  const radar = db['app/radar'] as { events: Array<Record<string, unknown>> };
  expect(radar.events.filter((e) => e.s === 'r').length).toBeGreaterThanOrEqual(1);
  // UK-Schreibweise ist nie ein Fehler im Radar.
  expect(radar.events.some((e) => e.g === 'summarise')).toBe(false);
  const profile = db['app/profile'] as { act: Record<string, Record<string, number>>; mix: { work: number } };
  expect(profile.act[DAY]?.read).toBe(1);
  expect(profile.mix.work).toBe(42);
  const logRead = entriesOf(db).filter((e) => e.type === 'read');
  expect(logRead).toHaveLength(4);
  for (const e of logRead) {
    expect(e).not.toHaveProperty('id');
    expect(e).not.toHaveProperty('k');
    expect(e).toMatchObject({ ref: `articles/${ARTICLE_Q}`, ctx: 'xtra' });
  }
  const card = Object.values(db).find((d) => (d as { origin?: { kind?: string } }).origin?.kind === 'read');
  expect(card).toMatchObject({ src: 'read', origin: { ref: `articles/${ARTICLE_Q}` } });
  expect(String(card?.ex)).toMatch(/\[.+\]/);
  expect((await sampleCalls(page)).map((c) => c.id)).toEqual(['reading-check']);

  // Wieder öffnen: erledigt ist Zustand, kein Neustart der Einheit.
  await page.getByTestId('unit-close').click();
  await openModule(page, 'read');
  await expect(page.getByTestId('unit')).toHaveAttribute('data-state', 'done');
  await expect(page.getByTestId('read-done')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Lesen ohne KI: Startbestand-Fragen, keine KI-Knöpfe, abschließbar, Zusammenfassung ohne Urteil', async ({ page }) => {
  test.setTimeout(60_000);
  const { errors } = await boot(page, { migrated: true, fake: { capabilities: { sample: false }, patch: PATCH } });
  await openModule(page, 'read');
  await expect(page.locator('[data-ai]')).toHaveCount(0);
  await page.getByTestId('read-done').click();
  await answerAll(page, 4);
  await expect(page.getByTestId('unit-done')).toBeVisible();
  await expect(page.locator('[data-ai]')).toHaveCount(0);
  await expect(page.locator('button[data-grade]')).toHaveCount(0);
  await page.getByTestId('summary-draft').fill('Many office workers now use AI tools every day, but humans still need to check the results before sending them.');
  await page.getByTestId('summary-save').click();
  await expect(page.getByTestId('summary-result')).toBeVisible();
  await expect(page.getByTestId('keypoints')).toBeVisible();
  await expect(page.getByTestId('reading-review')).toHaveCount(0);
  const db = await dump(page);
  const r = Object.values(db).find((d) => d.articleId === ARTICLE_Q && typeof d.summary === 'string' && d.summary);
  expect(r).toBeTruthy();
  expect(r?.res).toBeUndefined();
  expect(errors).toEqual([]);
});

// Alles gelesen: Startbestand und Datenbank-Artikel als gelesen markieren, nur die Erzeugung bleibt.
const READ_ALL: Record<string, Record<string, unknown>> = {};
['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', ARTICLE_Q].forEach((id, i) => {
  READ_ALL[`reading/r${1789000000000 + i}`] = { t: 1789000000000 + i, date: '2026-09-01', articleId: id, title: id, level: 'B2' };
});

test('Lesen: neuer Text mit Themenwahl (M12) – genau ein Aufruf, gespeichert und sofort lesbar', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page, { migrated: true, fake: { patch: { ...PATCH, ...READ_ALL } } });
  await openModule(page, 'read');
  await expect(page.getByTestId('empty-state')).toBeVisible();
  await page.locator('[data-testid="topic-chip"][data-topic="tech"]').click();
  await expect(page.locator('[data-testid="topic-chip"][data-topic="tech"]')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('gen-new').click();
  await expect(page.getByTestId('article')).toBeVisible({ timeout: 15_000 });
  const db = await dump(page);
  const gen = Object.entries(db).find(([p, d]) => p.startsWith('articles/') && p !== `articles/${ARTICLE_Q}` && d.pv === 'reading-text@1' && d.src === 'ai' && Array.isArray(d.questions) && (d.questions as unknown[]).length === 4);
  expect(gen?.[1]).toMatchObject({ domain: 'work', level: 'B2+' });
  expect((db['app/profile'] as { gen: { ar: string } }).gen.ar).toBe(DAY);
  expect(await sampleCalls(page)).toEqual([{ id: 'reading-text', tier: 'default' }]);
  await page.getByTestId('read-done').click();
  await expect(page.getByTestId('question')).toBeVisible();
});

test('Lesen: eigener Text als Lese-Einheit in articles/* – nie in feed/* (M16)', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page, { migrated: true, fake: { capabilities: { sample: false }, patch: { ...PATCH, ...READ_ALL } } });
  await openModule(page, 'read');
  await expect(page.getByTestId('empty-state')).toBeVisible();
  const feedBefore = Object.keys(await dump(page)).filter((p) => p.startsWith('feed/'));
  await page.getByTestId('own-open').click();
  await page.getByTestId('own-draft').fill(Array.from({ length: 70 }, (_, i) => (i % 10 === 9 ? 'meeting.' : 'partner')).join(' '));
  await page.getByTestId('own-save').click();
  await expect(page.getByTestId('article')).toBeVisible();
  const db = await dump(page);
  const own = Object.entries(db).filter(([p, d]) => p.startsWith('articles/') && d.src === 'own' && String(d.text).startsWith('partner'));
  expect(own).toHaveLength(1);
  expect(Object.keys(db).filter((p) => p.startsWith('feed/'))).toEqual(feedBefore);
  // Ohne Fragen: „Fertig gelesen" schließt die Einheit direkt ab.
  await page.getByTestId('read-done').click();
  await expect(page.getByTestId('unit-done')).toBeVisible();
});
