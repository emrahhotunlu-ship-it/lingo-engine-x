import { expect, test } from '@playwright/test';
import { boot, openTab, screen } from './fixtures';
import { dump } from './trainerHelpers';

// Lehrer-Feedback einfügen (28.09.2026, ersetzt die Preply-Brücke): großes Textfeld,
// „Verarbeiten“ (nur auf Tipp), Kartenvorschläge → Wortschatz (Stapel/Quelle „Lehrer“),
// Korrekturen → Reparatur-Sätze, „Jetzt üben“ → die vorhandene Übung „Mach mir eine
// Übung dazu“ (claudeDrill), kein neuer Übungstyp. Beide Einstiege: Wortschatz ›
// „Hinzufügen“ und eine Zeile unter Üben.

test('Wortschatz › Hinzufügen → Lehrer-Feedback → Karten übernehmen, Korrektur übernehmen, Übung starten', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await openTab(page, 'vocab');
  await page.getByTestId('vocab-add').click();
  await page.getByTestId('add-teacher-feedback').click();
  await expect(page.getByTestId('teacher-feedback')).toBeVisible();

  await page.getByTestId('tf-input').fill('Teacher: "depend of" -> depend on. New phrase: would rather.');
  await page.getByTestId('tf-go').click();

  // Kartenvorschlag übernehmen.
  await expect(page.getByTestId('tf-words')).toBeVisible();
  const word = page.getByTestId('tf-word').first();
  await expect(word).toBeVisible();
  await word.getByTestId('tf-word-take').click();
  await expect(word.getByTestId('tf-word-take')).toHaveText('In deinen Karten');
  await expect
    .poll(async () => Object.entries(await dump(page)).some(([k, d]) => k.startsWith('vocab/') && (d as Record<string, unknown>).src === 'teacher'))
    .toBe(true);
  const saved = Object.entries(await dump(page)).find(([k, d]) => k.startsWith('vocab/') && (d as Record<string, unknown>).src === 'teacher');
  expect(saved?.[1]).toMatchObject({ src: 'teacher', word: 'would rather' });

  // Korrektur als Reparatur-Satz übernehmen.
  await expect(page.getByTestId('tf-corrections')).toBeVisible();
  await page.getByTestId('tf-corr-apply').click();
  await expect(page.getByTestId('tf-corr-apply')).toHaveText('In deinen Karten');
  await expect
    .poll(async () => ((await dump(page))['app/repair']?.items as Array<Record<string, unknown>> | undefined)?.some((r) => r.src === 'teacher'))
    .toBe(true);

  // Ergebnis gespeichert in teacher/<Monat>.
  const teacherDoc = Object.entries(await dump(page)).find(([k]) => k.startsWith('teacher/'));
  expect(teacherDoc).toBeTruthy();
  const items = (teacherDoc?.[1] as Record<string, unknown>).items as Array<Record<string, unknown>>;
  expect(items.length).toBeGreaterThan(0);
  expect(items[0]).toMatchObject({ title: 'Präpositionen und Vorlieben' });

  // Jetzt üben: nutzt die vorhandene Übung „Mach mir eine Übung dazu“ (claudeDrill).
  await page.getByTestId('tf-practice').click();
  await expect(page.getByTestId('claude-drill')).toBeVisible();
  await expect(page.getByTestId('cd-item')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Zeile unter Üben führt ebenfalls zu Lehrer-Feedback', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await openTab(page, 'learn');
  await page.getByTestId('entry-teacher-feedback').click();
  await expect(page.getByTestId('teacher-feedback')).toBeVisible();
  expect(errors).toEqual([]);
});

test('ohne Claude: Hinweis und einfacher Zeilen-Rückfall statt Kartenvorschlägen', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await screen(page, 'today');
  await openTab(page, 'vocab');
  await page.getByTestId('vocab-add').click();
  await page.getByTestId('add-teacher-feedback').click();
  await expect(page.getByTestId('teacher-feedback')).toBeVisible();
  await expect(page.getByTestId('tf-no-ai')).toBeVisible();
  await expect(page.getByTestId('tf-go')).toHaveCount(0);
  await page.getByTestId('tf-input').fill('depend on - abhängen von\nrely on - sich verlassen auf');
  await expect(page.getByTestId('tf-fallback')).toBeVisible();
  await expect(page.getByTestId('tf-fallback')).toContainText('abhängen von');
  expect(errors).toEqual([]);
});

test('Alle übernehmen speichert alle Kartenvorschläge auf einmal; schon vorhandene Wörter werden erkannt', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await openTab(page, 'vocab');
  await page.getByTestId('vocab-add').click();
  await page.getByTestId('add-teacher-feedback').click();

  // Zwei Kartenvorschläge, auf einen Klick übernommen (Emrahs Wunsch, 28.09.). „phase out“ ist in
  // den Testdaten schon eine Karte – damit prüft dieselbe Aktion auch das Erkennen von Dopplungen.
  await page.getByTestId('tf-input').fill('New phrases from today: would rather, phase out. zzmulti');
  await page.getByTestId('tf-go').click();
  await expect(page.getByTestId('tf-words')).toBeVisible();
  await expect(page.getByTestId('tf-word')).toHaveCount(2);
  await page.getByTestId('tf-words-take-all').click();
  const buttons = page.getByTestId('tf-word-take');
  await expect(buttons.nth(0)).toHaveText('In deinen Karten');
  await expect(buttons.nth(1)).toHaveText('Schon im Wortschatz');
  await expect
    .poll(async () => Object.entries(await dump(page)).some(([k, d]) => k.startsWith('vocab/') && (d as Record<string, unknown>).src === 'teacher' && (d as Record<string, unknown>).word === 'would rather'))
    .toBe(true);
  expect(errors).toEqual([]);
});
