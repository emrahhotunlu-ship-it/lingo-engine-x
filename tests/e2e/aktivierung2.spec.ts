import { expect, test, type Browser, type Page } from '@playwright/test';
import { boot, layoutProblems, screen } from './fixtures';
import { DAY, RECALLED, TYPE_MODE, dump, planPatch } from './trainerHelpers';

// Wörter aktivieren, Stufe 2 (docs/umbau/aktivierung.md): Fahrplan A1–A5 im Schritt „Wörter wiederholen“. Handy-Profil (390 px, Touch): Mini-Szene (A2),
// Aktivierung ohne gezeigtes Wort (A4, „Weiß ich nicht“) und Kundenmail mit Partnerwörtern (A5). Die Aktivierung ERSETZT die fällige Wiederholung: der Pflicht-Zähler
// von „Heute“ bleibt, wie er ist. Gegen den Produktions-Build mit eingespieltem Adapter (feste Testantworten von `activate-check@1`).

type Doc = Record<string, unknown>;
const DAY_MS = 86_400_000;
const at = (key: string, hour = 10): number => Date.parse(`${key}T${String(hour).padStart(2, '0')}:00:00+02:00`);
/** Stichtag der Testdaten: 20.09.2026. */
const back = (days: number): number => at(DAY) - days * DAY_MS;

async function phone(browser: Browser): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'Europe/Berlin', locale: 'de-DE' });
  return { page: await context.newPage(), close: () => context.close() };
}

/** Richtige Abrufe an verschiedenen Tagen (Barcroft-Leitplanke) plus die Aktivierungen `acts` ([Tage zurück, Note, Art, Code]). */
const hist = (extraRecalls: number, acts: Array<[number, number, string, string?]> = []): Doc[] => [
  ...RECALLED,
  ...Array.from({ length: extraRecalls }, (_, i) => ({ t: back(40 - i * 3), m: 'type', g: 3, x: 'type' })),
  ...acts.map(([d, g, x, a]) => ({ t: back(d), m: 'produce', g, x, ...(a ? { a } : {}) })),
];
// Wie `forcedDoc` der Trainer-Specs: die Karte ist als erste fällig (sehr niedrige Abrufwahrscheinlichkeit), die Aktivierungs-Abstände stehen im Verlauf.
const card = (stage: number, h: Doc[], over: Doc = {}, i = 0): Doc => ({ state: 'learning', stage, S: 1, D: 5, due: 1_690_000_000_000 + i, last: 1_689_900_000_000, reps: 3, lapses: 0, xs: {}, hist: h, ...over });

async function startRound(page: Page, patch: Record<string, Doc>, opts: { sample?: boolean } = {}) {
  const booted = await boot(page, {
    migrated: true,
    fake: { patch: { ...TYPE_MODE, 'app/profile': { ...planPatch(1), autoNext: false }, ...patch }, ...(opts.sample === false ? { capabilities: { sample: false } } : {}) },
  });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  return booted;
}

/** Satz, der die Besonderheit der Mini-Szene einhält (Code der Vorgabe: …/Besonderheit am Ende) und das Zielwort enthält. */
async function sceneSentence(page: Page, target: string): Promise<string> {
  const code = (await page.getByTestId('act-panel').getAttribute('data-code')) ?? '';
  const shape = code.split('.').at(-1) ?? 's';
  return shape === 'q'
    ? `Do we ${target} long meetings on Friday afternoons?`
    : shape === 'n'
      ? `In our team we never ${target} long meetings on Friday afternoons.`
      : shape === 'i'
        ? `If we ${target} long meetings on Friday afternoons, we save time.`
        : `In our team we ${target} long meetings on Friday afternoons.`;
}

const actDocs = (d: Record<string, Doc>): Doc[] => Object.entries(d).filter(([p]) => p.startsWith('act/')).map(([, v]) => v);
// Die Testdaten bringen zwei Beispiel-Einträge (`act/2026-09`, andere Karten) mit; gezählt werden nur die Einträge der Karte `avoid`.
const entriesOf = (d: Record<string, Doc>): Doc[] => actDocs(d).flatMap((doc) => Object.values((doc.e as Record<string, Doc>) ?? {})).filter((e) => e.c === 'vocab/avoid');

test('A2 am Handy: Mini-Szene ersetzt die fällige Wiederholung – Vorgaben sichtbar, Zähler na, Sammelakte, Pflicht-Zähler unverändert', async ({ browser }) => {
  const { page, close } = await phone(browser);
  // Eine Aktivierung (A1) vor 6 Tagen geschafft → heute ist A2 dran (Abstand ≥ 5 Tage, Stufe 4, ≥ 3 Abruftage).
  const { errors, external } = await startRound(page, { 'vocab/avoid': card(4, hist(1, [[6, 3, 'produce', 'j05.q.-.-']]), { na: 1 }) });
  const ex = page.getByTestId('exercise');
  await expect(ex).toHaveAttribute('data-ex', 'act_scene');
  await expect(ex).toHaveAttribute('data-card', 'avoid');
  await expect(page.getByTestId('act-panel')).toBeVisible();
  await expect(page.getByTestId('task')).not.toBeEmpty();
  // Zielwort, Lage und Gegenüber stehen da; kein Lücken- oder Auswahlbild.
  await expect(page.getByTestId('target-chip')).toContainText('avoid');
  await expect(page.getByTestId('act-event')).not.toBeEmpty();
  await expect(page.getByTestId('act-role')).toBeVisible();
  await expect(page.getByTestId('act-input')).toBeVisible();
  expect(await layoutProblems(page)).toEqual([]);

  // Vorprüfung ohne KI: ein Satz ohne das Wort wird einmal zurückgegeben (kein Claude-Aufruf), dann der richtige.
  await page.getByTestId('act-input').fill('The meeting starts at nine in the morning.');
  await page.getByTestId('check').click();
  await expect(page.getByTestId('hint-line')).toBeVisible();
  await expect(page.getByTestId('verdict')).toHaveCount(0);
  await page.getByTestId('act-input').fill(await sceneSentence(page, 'avoid'));
  await page.getByTestId('check').click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
  await expect(page.getByTestId('explanation')).toBeVisible();
  await expect(page.locator('button[data-grade]')).toHaveCount(0);
  expect(await layoutProblems(page)).toEqual([]);
  await page.getByTestId('next').click();
  // Die Karte steht noch in Lernschritten und kommt in der Runde einmal wieder (als gewöhnliche Wiederholung, nie als zweite Aktivierung).
  await expect.poll(async () => entriesOf(await dump(page)).length).toBe(1);
  await expect(page.getByTestId('exercise')).not.toHaveAttribute('data-ex', /^act_/);

  const d = await dump(page);
  const avoid = d['vocab/avoid'] as Doc & { hist: Doc[] };
  // Der Hinweis der Vorprüfung zählt als Hilfe: Der richtige Satz danach ist höchstens „Schwer“ (Note 2), nie „Leicht“, und er rückt den Fahrplan NICHT weiter
  // (na bleibt 1, der Verlaufseintrag trägt u = 1; Lernwissenschaft H1: nur geprüfte Leistung ohne Hilfe zählt). ac (Fähigkeit) ist ein anderes Feld.
  expect(avoid.na).toBe(1);
  const last = avoid.hist.at(-1)!;
  expect(last).toMatchObject({ x: 'act_scene', g: 2, u: 1 });
  expect(String(last.a)).toMatch(/^sc\./);
  // Sammelakte: genau ein Eintrag, geprüft, wiederverwendbar.
  const entries = entriesOf(d);
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ c: 'vocab/avoid', st: 2, f: 'sc', k: 1, v: 'c', g: 2, r: 1 });
  expect(String(entries[0]!.s)).toContain('avoid');
  expect(actDocs(d).every((x) => !Array.isArray(x.e))).toBe(true);
  // „Heute“: eine Antwort = eine Wiederholung, die Aktivierung zählt nicht als zusätzliche Pflicht.
  await expect.poll(async () => ((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined)?.filter((e) => e.id === 'avoid' && e.ctx === 'rev').length).toBe(1);
  expect(((await dump(page))[`log/${DAY}`]?.entries as Doc[]).filter((e) => e.ctx === 'rev')).toHaveLength(1);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await close();
});

test('A2 ohne Hinweis: der richtige Satz beim ersten Mal ist „Gut“ und rückt den Fahrplan weiter (na 2)', async ({ browser }) => {
  const { page, close } = await phone(browser);
  const { errors } = await startRound(page, { 'vocab/avoid': card(4, hist(1, [[6, 3, 'produce', 'j05.q.-.-']]), { na: 1 }) });
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'act_scene');
  await page.getByTestId('act-input').fill(await sceneSentence(page, 'avoid'));
  await page.getByTestId('check').click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
  // Die drei Schichten sind sichtbar prüfbar: Die Testantwort liefert bei „richtig“ auch eine natürlichere Fassung und das Warum.
  await page.getByTestId('next').click();
  await expect.poll(async () => ((await dump(page))['vocab/avoid'])?.na).toBe(2);
  const last = ((await dump(page))['vocab/avoid'] as Doc & { hist: Doc[] }).hist.at(-1)!;
  expect(last).toMatchObject({ x: 'act_scene', g: 3 });
  expect(last.u).toBeUndefined();
  expect(errors).toEqual([]);
  await close();
});

test('ohne Claude gibt es keine Aktivierung: die gewöhnliche Wiederholung kommt, na bleibt', async ({ browser }) => {
  const { page, close } = await phone(browser);
  const { errors } = await startRound(page, { 'vocab/avoid': card(4, hist(1, [[6, 3, 'produce', 'j05.q.-.-']]), { na: 1 }) }, { sample: false });
  const ex = (await page.getByTestId('exercise').getAttribute('data-ex')) ?? '';
  expect(ex).not.toMatch(/^act_/);
  expect(ex).not.toBe('produce');
  await expect(page.getByTestId('act-panel')).toHaveCount(0);
  expect(errors).toEqual([]);
  await close();
});

test('zu früh: nur 3 Tage nach der letzten Aktivierung gibt es noch keine neue', async ({ browser }) => {
  const { page, close } = await phone(browser);
  await startRound(page, { 'vocab/avoid': card(4, hist(1, [[3, 3, 'produce', 'j05.q.-.-']]), { na: 1 }) });
  const ex = (await page.getByTestId('exercise').getAttribute('data-ex')) ?? '';
  expect(ex).not.toMatch(/^act_/);
  await close();
});

test('A4 am Handy: das Zielwort steht nicht da, nur seine Bedeutung – „Weiß ich nicht“ zeigt die Lösung, die Karte bekommt Nochmal', async ({ browser }) => {
  const { page, close } = await phone(browser);
  const { errors } = await startRound(page, { 'vocab/avoid': card(5, hist(3, [[40, 3, 'produce', 'j05.q.-.-'], [28, 3, 'act_scene', 'sc.e01.cfo.-.n.pr.s'], [20, 3, 'act_rewrite', 'tw.e05.team.slack.c.-.-']]), { na: 3 }) });
  const ex = page.getByTestId('exercise');
  await expect(ex).toHaveAttribute('data-ex', 'act_impulse');
  await expect(page.getByTestId('act-meaning')).toBeVisible();
  await expect(page.getByTestId('target-chip')).toHaveCount(0);
  await expect(page.getByTestId('act-hidden-note')).toBeVisible();
  // Das Wort steht nirgends auf der Frage (weder in der Aufgabe noch in den Vorgaben).
  await expect(ex).not.toContainText(/\bavoid\b/i);
  expect(await layoutProblems(page)).toEqual([]);

  // Ohne das Wort: die Vorprüfung nennt die Bedeutung, nie das Wort selbst.
  await page.getByTestId('act-input').fill('The meeting starts at nine in the morning.');
  await page.getByTestId('check').click();
  await expect(page.getByTestId('hint-line')).toBeVisible();
  await expect(page.getByTestId('hint-line')).not.toContainText(/\bavoid\b/i);
  await page.getByTestId('dont-know').click();
  await expect(page.getByTestId('verdict')).toBeVisible();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'dontKnow');
  await expect(page.getByTestId('result')).toContainText(/avoid/i);
  await page.getByTestId('next').click();

  await expect.poll(async () => ((await dump(page))['vocab/avoid']?.hist as Doc[] | undefined)?.at(-1)?.g).toBe(1);
  const d = await dump(page);
  expect((d['vocab/avoid'] as Doc).na).toBe(3);
  expect(entriesOf(d)).toHaveLength(0);
  expect(errors).toEqual([]);
  await close();
});

test('A5: Kundenmail oder Kombi-Satz mit mehreren Zielwörtern – Partnerwörter bekommen nur den Eintrag, nicht die Karte', async ({ browser }) => {
  const { page, close } = await phone(browser);
  const partner = (i: number): Doc => card(4, hist(1), { due: 1_690_000_100_000 + i * 1000 }, i);
  const { errors } = await startRound(page, {
    'vocab/avoid': card(5, hist(4, [[60, 3, 'produce', 'j05.q.-.-'], [45, 3, 'act_scene', 'sc.e01.cfo.-.n.pr.s'], [32, 3, 'act_rewrite', 'tw.e05.team.slack.c.-.-'], [20, 3, 'act_impulse', 'im.-.boss.-.c.pa.q']]), { na: 4, src: 'lesson' }),
    'vocab/affect': partner(1),
    'vocab/achieve': partner(2),
    'vocab/convince': partner(3),
  });
  const ex = page.getByTestId('exercise');
  const kind = (await ex.getAttribute('data-ex')) ?? '';
  expect(['act_mail', 'act_combo']).toContain(kind);
  await expect(ex).toHaveAttribute('data-card', 'avoid');
  const chips = (await page.getByTestId('target-chip').allInnerTexts()).map((t) => t.trim().replace(/^to\s+/i, ''));
  expect(chips.length).toBeGreaterThanOrEqual(2);
  expect(chips.length).toBeLessThanOrEqual(3);
  expect(chips[0]).toBe('avoid');
  if (kind === 'act_mail') await expect(page.getByTestId('act-mail')).toBeVisible();
  expect(await layoutProblems(page)).toEqual([]);

  const text = `${chips.map((c, i) => (i === 0 ? c.charAt(0).toUpperCase() + c.slice(1) : c)).join(', ')} are all part of our plan for this client. We will check every step together with the whole team before Friday.`;
  await page.getByTestId('act-input').fill(text);
  await page.getByTestId('check').click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
  expect(await layoutProblems(page)).toEqual([]);
  await page.getByTestId('next').click();

  await expect.poll(async () => ((await dump(page))['vocab/avoid'])?.na).toBe(5);
  const d = await dump(page);
  const e = entriesOf(d);
  expect(e).toHaveLength(1);
  expect(e[0]).toMatchObject({ c: 'vocab/avoid', st: 5, k: 1, v: 'c' });
  const ts = e[0]!.ts as Array<[string, string]>;
  expect(ts.length).toBe(chips.length);
  expect(ts[0]![0]).toBe('vocab/avoid');
  // Die Partnerkarten wurden nicht angefasst: kein Zähler, kein neuer Verlaufseintrag.
  for (const id of ['affect', 'achieve', 'convince']) {
    const p = d[`vocab/${id}`] as Doc;
    expect(p.na).toBeUndefined();
    expect((p.hist as Doc[]).length).toBe(hist(1).length);
  }
  expect(errors).toEqual([]);
  await close();
});
