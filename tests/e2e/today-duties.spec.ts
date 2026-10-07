import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
import { DAY, dump, writes } from './trainerHelpers';

// Heute mit Tagesplan v2 (phase2-plan §6, §9.3): Zähler, Häkchen, Statuszeile, Heldenkarte und
// Reiter-Zahl sagen bei 0, 1 und 2 von 2 dasselbe (Kap. 2.2); Erledigtes ist Zustand ohne
// bedienbares Kind; Wechsel um 04:00; ein schon gespeicherter Plan von heute bleibt unverändert.

type Doc = Record<string, unknown>;
const SEED = JSON.parse(readFileSync(new URL('../../seed/sample-data.json', import.meta.url), 'utf8')) as Record<string, Doc>;
const LABEL: Record<string, string> = { review: 'Wiederholen', 'ch:order': 'Satzbau' };
// Seit dem Fokus-Umbau gibt es die Lektion nicht mehr als Pflichtpunkt: zwei Punkte.
const DUTIES = ['review', 'ch:order'] as const;

/** Plan v2 von heute mit fester Zielmenge (2 Karten), Pflichtkanal Satzbau. */
const PLAN = {
  d: DAY,
  v: 1,
  ids: ['order', 'cloze'],
  why: [[['agoNever']], [['whyRotation']]],
  duty: [...DUTIES],
  goal: { review: 2, due: 2, new: 0, ahead: 0, ch: 6 },
  lesson: null,
  at: 1,
};

/** Anfangsbestand, in dem genau die Punkte `done` erledigt sind. */
function statePatch(done: ReadonlySet<string>): Record<string, Doc> {
  const profile = SEED['app/profile'] as Doc;
  const act = { ...(profile.act as Record<string, Doc>) };
  const dayAct = { ...(act[DAY] ?? {}) };
  delete dayAct.order;
  if (done.has('ch:order')) dayAct.order = 1;
  act[DAY] = dayAct;
  const entries = done.has('review')
    ? [
        { t: 1, ok: true, lang: 'de', k: 'v', id: 'avoid', m: 'tr-type', given: 'avoid', ans: 'avoid', g: 3, ms: 1000, ctx: 'rev' },
        { t: 2, ok: true, lang: 'de', k: 'v', id: 'handle', m: 'tr-type', given: 'handle', ans: 'handle', g: 3, ms: 1000, ctx: 'rev' },
      ]
    : [];
  const p: Doc = { plan: PLAN, act };
  if (profile.pflicht && typeof profile.pflicht === 'object') p.pflicht = { ...(profile.pflicht as Doc), [DAY]: undefined };
  return { 'app/profile': p, [`log/${DAY}`]: { date: DAY, entries } };
}

async function checkConsistent(page: Page, done: ReadonlySet<string>): Promise<void> {
  const n = done.size;
  const open = DUTIES.filter((d) => !done.has(d));
  const status = page.getByTestId('today-status');
  await expect(status).toHaveAttribute('data-done', String(n));
  await expect(status).toHaveAttribute('data-total', '2');
  if (n === 2) {
    await expect(status).toHaveText('Fertig für heute');
    await expect(status).toHaveAttribute('data-status', 'allDone');
    // Fertig ist Zustand: keine Blockliste, kein Knopf in der Karte (Kap. 2.2).
    await expect(page.getByTestId('duty')).toHaveCount(0);
    await expect(page.getByTestId('today-card').locator('button')).toHaveCount(0);
  } else {
    await expect(status).toHaveText(new RegExp(`^${n} von 2 · noch ca\\. \\d+ Min\\.$`));
    await expect(status).toHaveAttribute('data-status', 'open');
    // Häkchen: genau die erledigten Punkte, in Plan-Reihenfolge.
    const items = page.getByTestId('duty');
    await expect(items).toHaveCount(2);
    expect(await items.evaluateAll((els) => els.map((e) => [e.getAttribute('data-duty'), e.getAttribute('data-state')]))).toEqual(DUTIES.map((d) => [d, done.has(d) ? 'done' : 'open']));
    // Erledigt ist Zustand: keine Zeile hat ein bedienbares Kind; bedienbar ist nur der eine Startknopf.
    await expect(page.locator('[data-testid="duty"] :is(button, a, input, select, textarea, [tabindex])')).toHaveCount(0);
    for (const d of open) await expect(page.locator(`[data-testid="duty"][data-duty="${d}"]`)).toContainText(LABEL[d] ?? d);
    for (const d of DUTIES) if (done.has(d)) await expect(page.locator(`[data-testid="duty"][data-duty="${d}"]`)).toContainText('erledigt');
    await expect(page.locator(`[data-testid="duty"][data-duty="${open[0] ?? ''}"]`)).toHaveAttribute('data-now', 'true');
  }
  // Tageskarte = erster offener Punkt, genau ein Primärknopf; alles erledigt → kein Knopf, Extra sichtbar.
  if (open.length) {
    await expect(page.getByTestId('hero')).toHaveAttribute('data-duty', open[0] ?? '');
    await expect(page.getByTestId('start')).toHaveCount(1);
    await expect(page.getByTestId('start')).toHaveAttribute('data-duty', open[0] ?? '');
    await expect(page.getByTestId('tab-badge')).toHaveText(String(open.length));
    await expect(page.getByTestId('today-extra')).toHaveCount(0);
  } else {
    await expect(page.getByTestId('hero')).toHaveCount(0);
    await expect(page.getByTestId('start')).toHaveCount(0);
    await expect(page.getByTestId('tab-badge')).toHaveCount(0);
    // Nach der Pflicht genau eine Zeile „Extra ›“ (Lernplattform 2.0 §2.2).
    await expect(page.getByTestId('today-extra')).toBeVisible();
    await expect(page.getByTestId('offer')).toHaveCount(0);
  }
}

const CASES: Array<{ name: string; done: string[] }> = [
  { name: '0 von 2', done: [] },
  { name: '1 von 2 (Wiederholen)', done: ['review'] },
  { name: '1 von 2 (nur Satzbau)', done: ['ch:order'] },
  { name: '2 von 2', done: ['review', 'ch:order'] },
];

for (const c of CASES) {
  test(`widerspruchsfrei bei ${c.name}: Statuszeile, Häkchen, Heldenkarte, Reiter-Zahl`, async ({ page }) => {
    const done = new Set(c.done);
    const { errors, external } = await boot(page, { migrated: true, fake: { patch: statePatch(done) } });
    await screen(page, 'today');
    await checkConsistent(page, done);
    // Der gespeicherte Plan wird nicht neu geschrieben (Kap. 15: nie neu gewürfelt).
    await page.waitForTimeout(300);
    expect((await dump(page))['app/profile']?.plan).toEqual(PLAN);
    // Pflicht erledigt → pflicht[heute] = 1 (Regel 1); sonst nie gesetzt.
    if (done.size === 2) await expect.poll(async () => ((await dump(page))['app/profile']?.pflicht as Doc | undefined)?.[DAY]).toBe(1);
    else expect(((await dump(page))['app/profile']?.pflicht as Doc | undefined)?.[DAY]).toBeUndefined();
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}

test('Plan bleibt nach dem Neuladen gleich (Zähler und Häkchen auch)', async ({ page }) => {
  const done = new Set(['review']);
  const { errors } = await boot(page, { migrated: true, fake: { persist: true, patch: statePatch(done) } });
  await screen(page, 'today');
  await checkConsistent(page, done);
  await page.reload();
  await screen(page, 'today');
  await checkConsistent(page, done);
  await page.waitForTimeout(300);
  expect((await writes(page)).filter((w) => w.path === 'app/profile')).toHaveLength(0);
  expect((await dump(page))['app/profile']?.plan).toEqual(PLAN);
  expect(errors).toEqual([]);
});

test('Plan von heute bleibt nach dem Update gleich: Phase-1-Plan gilt bis 04:00, kein pflichtSince', async ({ page }) => {
  const phase1 = { d: DAY, v: 1, ids: [], why: [], duty: ['review'], goal: { review: 12 }, lesson: null, at: 1 };
  const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': { plan: phase1 } } } });
  await screen(page, 'today');
  await expect(page.getByTestId('today-status')).toHaveAttribute('data-total', '1');
  await expect(page.getByTestId('duty')).toHaveCount(1);
  await expect(page.getByTestId('hero')).toHaveAttribute('data-duty', 'review');
  await page.waitForTimeout(500);
  const d = await dump(page);
  expect(d['app/profile']?.plan).toEqual(phase1);
  // Erst ein Phase-2-Plan von heute setzt pflichtSince (§6.3, Regel 2).
  expect(d['app/schema']?.pflichtSince).toBeUndefined();
  expect((await writes(page)).filter((w) => w.path === 'app/profile' || w.path === 'app/schema')).toHaveLength(0);
  expect(errors).toEqual([]);
});

test('Wechsel um 04:00: bis 03:59 gilt der Plan von gestern, ab 04:00 ein neuer Plan', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, now: '2026-09-21T03:59:00+02:00', fake: { patch: statePatch(new Set(['review'])) } });
  await screen(page, 'today');
  await checkConsistent(page, new Set(['review']));
  // Kopfzeile zeigt den Lerntag (wie der Plan), nicht schon den neuen Kalendertag.
  await expect(page.getByTestId('today-date')).toHaveText('Sonntag, 20. September');
  await page.waitForTimeout(300);
  expect(((await dump(page))['app/profile']?.plan as Doc).d).toBe(DAY);
  // 04:00: neuer Lerntag – ein neuer Plan, alle Punkte offen, nichts vom Vortag.
  await page.clock.setFixedTime(new Date('2026-09-21T04:00:30+02:00'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(async () => ((await dump(page))['app/profile']?.plan as Doc).d).toBe('2026-09-21');
  await expect(page.getByTestId('today-date')).toHaveText('Montag, 21. September');
  const plan = (await dump(page))['app/profile']?.plan as { duty: string[] };
  const status = page.getByTestId('today-status');
  await expect(status).toHaveAttribute('data-done', '0');
  await expect(status).toHaveAttribute('data-total', String(plan.duty.length));
  await expect(page.locator('[data-testid="duty"][data-state="done"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
