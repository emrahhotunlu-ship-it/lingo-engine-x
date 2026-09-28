import { expect, test, type Page } from '@playwright/test';
import { boot, screen, openEntry } from './fixtures';
import { grammarKey, L07_OUTPUT, lessonMeta, playLesson, storedL07 } from './learnHelpers';
import { DAY, dump } from './trainerHelpers';

// Kurs und Lektion (phase2-plan §5.1, §9.3): Kursstand weitergeführt, eine Lektion vollständig
// (gespeicherter Inhalt, Grundfassung ohne KI, „Lektion vorbereiten"), Abschluss in app/course,
// Pflichtpunkt „Lektion" auf Heute erledigt, Wiedereinstieg im selben Schritt.

type Doc = Record<string, unknown>;

async function openCourse(page: Page): Promise<void> {
  await screen(page, 'today');
  await openEntry(page, 'hub-course');
  await expect(page.getByTestId('course')).toBeVisible();
}

async function openLesson(page: Page, id: string): Promise<void> {
  await openCourse(page);
  await page.locator(`[data-testid="lesson-row"][data-lesson="${id}"]`).click();
  await expect(page.getByTestId('lesson')).toHaveAttribute('data-lesson', id);
}

const words = (id: string) => lessonMeta(id).words.map(([en, de]) => ({ en, de }));

test('Kurs: l01–l06 erledigt, genau eine nächste Lektion, Einheit 1 als Meilenstein', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true });
  await openCourse(page);
  const rows = page.getByTestId('lesson-row');
  await expect(rows).toHaveCount(24);
  const states = await rows.evaluateAll((els) => els.map((e) => [e.getAttribute('data-lesson'), e.getAttribute('data-state')]));
  expect(states.slice(0, 6).every(([, s]) => s === 'done')).toBe(true);
  expect(states.filter(([, s]) => s === 'next')).toHaveLength(1);
  expect(states.slice(6).every(([, s]) => s !== 'done')).toBe(true);
  await expect(page.getByTestId('unit')).toHaveCount(6);
  await expect(page.locator('[data-testid="unit"][data-complete]')).toHaveCount(1);
  await expect(page.getByTestId('milestone')).toHaveCount(1);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('l07 mit gespeichertem Inhalt vollständig: course.done.l07, Pflichtpunkt „Lektion" erledigt', async ({ page }) => {
  const l07 = storedL07();
  const { errors, external } = await boot(page, { migrated: true, fake: { patch: { 'lesson/l07': l07 } } });
  await openLesson(page, 'l07');
  await expect(page.getByTestId('lesson')).toHaveAttribute('data-source', 'db');
  const answers: Record<string, string> = {};
  for (const q of l07.questions as Array<{ q: string; answer: string }>) answers[q.q] = q.answer;
  await playLesson(page, { words: words('l07'), solve: grammarKey([l07]), answers, output: L07_OUTPUT });
  await expect(page.getByTestId('lesson-cando')).toContainText('Ich kann beschreiben');
  await expect(page.locator('button[data-grade]')).toHaveCount(0);

  await expect.poll(async () => ((await dump(page))['app/course']?.done as Doc | undefined)?.l07).toMatchObject({ d: DAY });
  const d = await dump(page);
  const done = (d['app/course']?.done ?? {}) as Record<string, { n: number; ok: number }>;
  expect(Object.keys(done).sort()).toEqual(['l01', 'l02', 'l03', 'l04', 'l05', 'l06', 'l07']);
  expect(done.l07?.n).toBeGreaterThan(0);
  expect(done.l07?.ok).toBeGreaterThan(0);
  // Der gespeicherte Inhalt bleibt unberührt (§4.8: das Gespeicherte gilt).
  expect(d['lesson/l07']).toEqual(l07);
  // Lektionswörter werden Karten mit Ursprung und Dialogsatz (D17, Kap. 15).
  const card = d['vocab/invoice'];
  expect(card).toMatchObject({ src: 'lesson', lesson: 'l07' });
  expect(String(card?.ex)).toContain('invoice');
  await expect.poll(async () => (((await dump(page))['app/profile']?.act as Record<string, Doc> | undefined)?.[DAY] ?? {}).lesson).toBe(1);

  // Heute: Pflichtpunkt „Lektion" ist Zustand, kein Knopf.
  await page.getByTestId('summary-back').click();
  await page.getByTestId('tab-today').click();
  await screen(page, 'today');
  const duty = page.locator('[data-testid="duty"][data-duty="lesson"]');
  await expect(duty).toHaveAttribute('data-state', 'done');
  await expect(duty.locator('button, a, input')).toHaveCount(0);
  await expect(page.getByTestId('today-status')).toHaveAttribute('data-done', '1');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Lektion der alten App: Umformung und Lücke ohne ___ als Ganzsatz-Eingabe', async ({ page }) => {
  const l07 = storedL07();
  // Form der alten App (lesson/<lid>.tasks): Auftrag im Satz, keine Lücke, Lösung ist der ganze Satz.
  const noSlot = [
    { topic: 'passive', type: 'transform', prompt: 'Active: "Our team checks every invoice." Change to passive.', options: null, answer: 'Every invoice is checked.', accepted: ['Every invoice is checked by our team.'], hint: '(Aktiv → Passiv, Präsens)', expl: 'Objekt wird Subjekt.', expl_en: 'The object becomes the subject.' },
    { topic: 'passive', type: 'gap', prompt: 'Rewrite in the passive: The auditor approved the report.', options: null, answer: 'The report was approved.', accepted: ['The report was approved by the auditor.'], hint: '', expl: 'Vergangenheit → was + Partizip.', expl_en: 'Past → was + past participle.' },
  ];
  l07.tasks = [...noSlot, ...(l07.tasks as Doc[]).slice(0, 1)];
  const { errors, external } = await boot(page, { migrated: true, fake: { patch: { 'lesson/l07': l07 } } });
  await openLesson(page, 'l07');
  const answers: Record<string, string> = {};
  for (const q of l07.questions as Array<{ q: string; answer: string }>) answers[q.q] = q.answer;
  const shown: string[] = [];
  await playLesson(page, {
    words: words('l07'),
    solve: grammarKey([l07]),
    answers,
    output: L07_OUTPUT,
    onGrammar: async (phase) => {
      const item = page.getByTestId('gr-item');
      if (!(await item.locator('[data-testid="correct-input"][data-whole]').count())) return;
      if (phase === 'after') {
        await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'correct');
        return;
      }
      {
        // Feld ist leer und beschreibbar, der Auftrag steht darüber.
        await expect(item.getByTestId('correct-input')).toHaveValue('');
        await expect(item.getByTestId('correct-input')).toBeEditable();
        shown.push(await item.getByTestId('transform-from').innerText());
      }
    },
  });
  expect(shown.sort()).toEqual(noSlot.map((t) => t.prompt).sort());
  await expect.poll(async () => ((await dump(page))['app/course']?.done as Doc | undefined)?.l07).toMatchObject({ d: DAY });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Lektion: nach dem Neuladen im selben Schritt', async ({ page }) => {
  const l07 = storedL07();
  const { errors } = await boot(page, { migrated: true, fake: { persist: true, patch: { 'lesson/l07': l07 } } });
  await openLesson(page, 'l07');
  await page.getByTestId('lesson-start').click();
  await expect(page.getByTestId('lesson')).toHaveAttribute('data-step', 'words');
  await page.reload();
  await openLesson(page, 'l07');
  await expect(page.getByTestId('lesson')).toHaveAttribute('data-step', 'words');
  await expect(page.getByTestId('intro').or(page.getByTestId('exercise')).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('l09 ohne KI (?fake=nosample): Grundfassung vollständig, keine KI-Knöpfe', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await openLesson(page, 'l09');
  await expect(page.getByTestId('lesson-base')).toBeVisible();
  await expect(page.locator('[data-ai]')).toHaveCount(0);
  await page.getByTestId('lesson-base').click();
  await expect(page.getByTestId('lesson')).toHaveAttribute('data-source', 'base');
  const meta = lessonMeta('l09');
  const output = `Next week I am going to ${meta.words.map(([en]) => en.replace(/^to\s+/i, '')).slice(0, 3).join(' and then ')} with the whole sales team in London because the fair starts on Monday morning.`;
  await playLesson(page, { words: words('l09'), solve: grammarKey(), output });
  await expect(page.locator('[data-ai]')).toHaveCount(0);
  await expect.poll(async () => ((await dump(page))['app/course']?.done as Doc | undefined)?.l09).toMatchObject({ d: DAY });
  // Die Grundfassung wird nie gespeichert (D11).
  expect((await dump(page))['lesson/l09']).toBeUndefined();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('„Lektion vorbereiten" speichert lesson/l09 im Format der alten App', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true });
  await openLesson(page, 'l09');
  const prep = page.getByTestId('lesson-prepare');
  await expect(prep).toHaveAttribute('data-ai', '');
  await prep.click();
  await expect(page.getByTestId('lesson-start')).toBeVisible();
  await expect(page.getByTestId('lesson')).toHaveAttribute('data-source', 'ai');
  const doc = (await dump(page))['lesson/l09'] as Doc;
  const meta = lessonMeta('l09');
  expect((doc.words as Array<{ en: string }>).map((w) => w.en)).toEqual(meta.words.map(([en]) => en));
  expect((doc.tasks as Doc[]).every((t) => t.src === 'lesson' && t.topic === meta.grammar)).toBe(true);
  expect(doc.lx).toMatchObject({ pv: 'lesson-content@2', lang: 'de' });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
