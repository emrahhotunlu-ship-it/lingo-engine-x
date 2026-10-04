import { expect, test, type Page } from '@playwright/test';
import { boot, screen, openEntry } from './fixtures';
import { dump } from './trainerHelpers';

// Kurs-Erweiterung (Kap. 6.2): Sind alle 24 Lektionen erledigt, erzeugt Claude auf Knopfdruck
// eine neue Einheit mit vier Lektionen ab l25 (course-extend@1). Gespeichert wird nur neu
// (`lesson/l25…` mit Lehrplan `plan`), der Kurs zeigt sie als Einheit 7, die nächste Lektion ist
// l25, „Lektion vorbereiten“ ergänzt den Inhalt ohne den Lehrplan zu verlieren.

type Doc = Record<string, unknown>;

const ALL = Array.from({ length: 24 }, (_, i) => `l${String(i + 1).padStart(2, '0')}`);
const allDone = (): Doc => ({ done: Object.fromEntries(ALL.map((id, i) => [id, { d: '2026-09-1' + (i % 10), t: 1_790_000_000_000 + i, n: 10, ok: 8 }])), res: {} });

async function openCourse(page: Page): Promise<void> {
  await screen(page, 'today');
  await openEntry(page, 'hub-course');
  await expect(page.getByTestId('course')).toBeVisible();
}

test('Alle 24 erledigt: „Neue Lektionen erstellen“ legt l25–l28 als Einheit 7 an, l25 ist die nächste und vorbereitbar', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true, fake: { patch: { 'app/course': allDone() } } });
  await openCourse(page);
  await expect(page.getByTestId('lesson-row')).toHaveCount(24);
  const card = page.getByTestId('course-extend');
  await expect(card).toHaveAttribute('data-all-done', 'true');
  const before = await seedLessons(page);
  await card.getByTestId('course-extend-submit').click();
  await expect(page.getByTestId('course-extend-done')).toContainText('Einheit 7');
  await expect(page.getByTestId('lesson-row')).toHaveCount(28);
  await expect(page.locator('[data-testid="unit"][data-unit="u7"]')).toBeVisible();
  await expect(page.locator('[data-testid="unit"][data-unit="u7"] [data-testid="unit-ext"]')).toBeVisible();
  await expect(page.locator('[data-testid="lesson-row"][data-lesson="l25"]')).toHaveAttribute('data-state', 'next');
  await expect(page.getByTestId('course-extend')).toHaveCount(0);

  const d = await dump(page);
  for (const id of ['l25', 'l26', 'l27', 'l28']) {
    const doc = d[`lesson/${id}`] as Doc;
    expect(doc.plan).toMatchObject({ unit: { id: 'u7', n: 7 }, pv: 'course-extend@1' });
    expect(((doc.plan as Doc).words as unknown[]).length).toBe(6);
    expect(doc.words).toBeUndefined();
  }
  // Bestehende Lektionen unberührt.
  expect(await seedLessons(page)).toEqual(before);

  await page.locator('[data-testid="lesson-row"][data-lesson="l25"]').click();
  await expect(page.getByTestId('lesson')).toHaveAttribute('data-lesson', 'l25');
  await page.getByTestId('lesson-prepare').click();
  await expect(page.getByTestId('lesson-start')).toBeVisible();
  const l25 = (await dump(page))['lesson/l25'] as Doc;
  expect((l25.words as Array<{ en: string }>).map((w) => w.en)).toEqual(((l25.plan as Doc).words as string[][]).map(([en]) => en));
  expect(l25.plan).toBeTruthy();
  expect(l25.lx).toMatchObject({ pv: 'lesson-content@2', ext: true });
  expect((l25.lx as Doc).regen).toBeUndefined();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

async function seedLessons(page: Page): Promise<Record<string, unknown>> {
  const d = await dump(page);
  return Object.fromEntries(Object.entries(d).filter(([k]) => /^lesson\/l(0\d|1\d|2[0-4])$/.test(k)));
}

test('Auf Wunsch vor dem Ende: ruhiges Angebot; Fehler der KI → Hinweis und „Erneut versuchen“, nichts gespeichert', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true, fake: { sampleFail: { 'course-extend': 'upstream_error' } } });
  await openCourse(page);
  const card = page.getByTestId('course-extend');
  await expect(card).toBeVisible();
  await expect(card).not.toHaveAttribute('data-all-done', 'true');
  await card.getByTestId('course-extend-submit').click();
  await expect(card.getByRole('alert')).toBeVisible();
  await expect(card.getByTestId('course-extend-submit')).toContainText('Erneut');
  expect(Object.keys(await dump(page)).filter((k) => /^lesson\/l(2[5-9]|[3-9]\d)$/.test(k))).toEqual([]);
  await page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { setSampleFail(id: string, c: null): void } }).__LINGO_FAKE__.setSampleFail('course-extend', null));
  await card.getByTestId('course-extend-submit').click();
  await expect(page.getByTestId('course-extend-done')).toBeVisible();
  await expect(page.getByTestId('lesson-row')).toHaveCount(28);
  // Die nächste Lektion bleibt eine des Lehrplans (Lehrplan zuerst).
  const next = await page.locator('[data-testid="lesson-row"][data-state="next"]').getAttribute('data-lesson');
  expect(Number(next?.slice(1))).toBeLessThanOrEqual(24);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
