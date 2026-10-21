import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
import { answerOnly, dump } from './trainerHelpers';
import { ankiPatch } from './wortschatzHelpers';

// Wort-Lernen 2, Paket „Kern“ (docs/umbau/wort-fest-plan.md, 21.10.2026): In der Pflichtrunde (Modus „auto“) gibt es für junge und neue Karten keine
// Aufdeckkarte mit Selbsturteil mehr, sondern die getippte Leiter. Neue Wörter: Abruf 1 (Anfangsbuchstabe) und Abruf 2 (frei) am Tag 0; erst ein
// freier richtiger Abruf beendet die Lernphase. Am nächsten Lerntag steht der „Gestern-Check“ (frei getippt) am Anfang der Runde.

type Doc = Record<string, unknown>;

/** Erfundene Testwörter, die weder im Seed noch im C1-Paket stehen (sonst lieferte das Paket dasselbe Stichwort). */
const WORDS: Record<string, { word: string; de: string; def: string; ex: string }> = {
  'wk-galvanize': { word: 'galvanize', de: 'aufrütteln', def: 'to shock or excite someone into taking action', ex: 'The new target will [galvanize] the whole sales team.' },
  'wk-obfuscate': { word: 'obfuscate', de: 'verschleiern', def: 'to make something unclear on purpose', ex: 'Please do not [obfuscate] the real costs in the report.' },
};
const fresh = (id: string, order: number): Doc => ({ ...WORDS[id], pos: 'verb', state: 'new', stage: 0, S: 0, D: 5, due: 0, last: 0, reps: 0, lapses: 0, src: 'lookup', added: '2026-09-20', order });

type Seen = { ex: string; card: string; label: string; verdict: string };

const recallLabel = async (page: Page): Promise<string> => (await page.locator('[data-step]').innerText()).split('\n').find((l) => /Abruf|Gestern-Check|Erster Abruf/.test(l)) ?? '';

/** Spielt die Runde bis zum Ende. Einführungen: „Weiß ich nicht“ → „Weiter“ → „Weiter“. Testwörter werden getippt, Seed-Karten wie sonst beantwortet. */
async function playRound(page: Page, max = 40): Promise<Seen[]> {
  const seen: Seen[] = [];
  for (let i = 0; i < max; i++) {
    await expect(page.getByTestId('exercise').or(page.getByTestId('intro')).or(page.getByTestId('intro-ask-dontknow')).or(page.getByTestId('session-end')).first()).toBeVisible();
    if (await page.getByTestId('session-end').isVisible()) return seen;
    if (await page.getByTestId('intro-ask-dontknow').isVisible()) {
      await page.getByTestId('intro-ask-dontknow').click();
      await page.getByTestId('intro-ask-next').click();
      continue;
    }
    if (await page.getByTestId('intro').isVisible()) {
      await page.getByTestId('intro-continue').click();
      continue;
    }
    await expect(page.locator('[data-step]')).toHaveCount(1);
    const ex = page.getByTestId('exercise');
    const card = (await ex.getAttribute('data-card')) ?? '';
    const s: Seen = { ex: (await ex.getAttribute('data-ex')) ?? '', card, label: await recallLabel(page), verdict: '' };
    const own = WORDS[card];
    if (own) {
      await page.getByTestId('gap-input').click();
      await page.keyboard.type(own.word, { delay: 20 });
      await page.keyboard.press('Enter');
    } else {
      await answerOnly(page);
    }
    await expect(page.getByTestId('verdict')).toBeVisible();
    s.verdict = (await page.getByTestId('verdict').getAttribute('data-verdict')) ?? '';
    seen.push(s);
    await page.keyboard.press('Enter');
  }
  throw new Error(`Runde endet nicht: ${JSON.stringify(seen)}`);
}

test.use({ viewport: { width: 1440, height: 900 } });

test('Tag 0 in der Pflichtrunde: keine Aufdeckkarte; neue Wörter mit Abruf 1 (Anfangsbuchstabe), dann Abruf 2 (frei)', async ({ page }) => {
  // Drei junge Wiederholungskarten (Stufe 1): früher im Modus „auto“ als Aufdeckkarte, jetzt getippte Leiter.
  const { patch } = ankiPatch(3);
  Object.keys(WORDS).forEach((id, i) => (patch[`vocab/${id}`] = fresh(id, i)));
  const profile = { newPerDay: 2, plan: { d: '2026-09-20', v: 1, ids: [], why: [], duty: ['review'], goal: { review: 5, new: 2 }, lesson: null, at: 1 } };
  const { errors } = await boot(page, { migrated: true, fake: { patch: { ...patch, 'app/profile': profile } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  const seen = await playRound(page);
  const info = JSON.stringify(seen);
  // Kein Aufdecken mit Selbsturteil in der Pflichtrunde.
  expect(seen.filter((s) => s.ex === 'flip'), info).toEqual([]);
  for (const id of Object.keys(WORDS)) {
    const mine = seen.filter((s) => s.card === id);
    // Abruf 1: Lücke mit Anfangsbuchstaben; Abruf 2: frei getippt. Nur getippte Arten, beschriftet.
    expect(mine.map((s) => s.ex), info).toEqual(['cloze_hint', 'cloze']);
    expect(mine[0]!.label, info).toContain('Abruf 1');
    expect(mine[1]!.label, info).toContain('Abruf 2');
    expect(mine.every((s) => s.verdict === 'ok'), info).toBe(true);
  }
  // Abruf 2 kommt nicht direkt nach Abruf 1: dazwischen liegt mindestens eine andere Aufgabe.
  const first = seen.findIndex((s) => s.card === 'wk-galvanize');
  const second = seen.findIndex((s, i) => i > first && s.card === 'wk-galvanize');
  expect(second - first, info).toBeGreaterThan(1);
  // Gespeichert: eingeführt heute, im Review-Zustand (der freie Abruf hat die Lernphase beendet), fällig am nächsten Lerntag (Deckel 1 Tag).
  const db = await dump(page);
  for (const id of Object.keys(WORDS)) {
    const d = db[`vocab/${id}`] ?? {};
    expect(d.intro, id).toBe('2026-09-20');
    const f = d.fsrs as { state: number; due: number };
    expect(f.state, id).toBe(2);
    expect(f.due, id).toBeLessThanOrEqual(Date.parse('2026-09-21T04:00:00+02:00'));
  }
  expect(errors).toEqual([]);
});

test('Tag 1: der Gestern-Check (frei getippt) steht am Anfang der Pflichtrunde', async ({ page }) => {
  const { patch } = ankiPatch(3);
  const t0 = Date.parse('2026-09-20T10:00:00+02:00');
  const dueDay1 = Date.parse('2026-09-21T04:00:00+02:00');
  patch['vocab/wk-galvanize'] = {
    ...fresh('wk-galvanize', 0),
    state: 'review',
    stage: 1,
    S: 1,
    reps: 2,
    last: t0 + 600_000,
    due: dueDay1,
    intro: '2026-09-20',
    hist: [
      { t: t0, m: 'cloze', g: 3, x: 'cloze_hint', s: 'sA' },
      { t: t0 + 600_000, m: 'cloze', g: 3, x: 'cloze', s: 'sA' },
    ],
    fsrs: { v: 1, due: dueDay1, stability: 1.2, difficulty: 5, state: 2, reps: 2, lapses: 0, last: t0 + 600_000, scheduledDays: 1, learningSteps: 0, src: 'lx' },
  };
  const profile = { newPerDay: 0, plan: { d: '2026-09-21', v: 1, ids: [], why: [], duty: ['review'], goal: { review: 4 }, lesson: null, at: 1 } };
  const { errors } = await boot(page, { migrated: true, now: '2026-09-21T10:00:00+02:00', fake: { patch: { ...patch, 'app/profile': profile } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-card', 'wk-galvanize');
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'cloze');
  expect(await recallLabel(page)).toContain('Gestern-Check');
  const seen = await playRound(page);
  expect(seen[0]).toMatchObject({ card: 'wk-galvanize', ex: 'cloze', verdict: 'ok' });
  expect(seen.filter((s) => s.ex === 'flip'), JSON.stringify(seen)).toEqual([]);
  // Nach dem bestandenen Gestern-Check höchstens 3 Tage Abstand (Deckel), nicht mehr.
  const f = (await dump(page))['vocab/wk-galvanize']?.fsrs as { due: number };
  expect(f.due).toBeLessThanOrEqual(Date.parse('2026-09-24T04:00:00+02:00'));
  expect(errors).toEqual([]);
});
