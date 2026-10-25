import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
import { planPatch } from './trainerHelpers';
import { ankiPatch } from './wortschatzHelpers';

// Nutzer-Sicht-Audit 12.10.2026: Aufgabe, Lücke, Hinweis und Lösung müssen auf dem Bildschirm zusammenpassen (erfundene Karten).

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

type Doc = Record<string, unknown>;
const base = (over: Doc): Doc => ({ level: 'C1', state: 'review', stage: 4, S: 3, D: 5, due: 1_500_000_000_000, last: 1_499_000_000_000, reps: 3, lapses: 0, src: 'lookup', added: '2026-09-01', intro: '2026-09-01', col: [], hist: [], ...over });
const FILL: Record<string, Doc> = Object.fromEntries(
  ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'].map((w, i) => [`vocab/${w}`, base({ word: w, de: `Füllwort ${i}`, def: `filler number ${i}`, ex: `A [${w}] sits here.`, pos: 'noun', due: 1_700_000_000_000 + i })]),
);

async function open(page: Page, doc: Doc, opts: { mode: 'flip' | 'type'; weak?: string }) {
  const { patch } = ankiPatch(0);
  const card = base({ ...doc, ...(opts.weak ? { xs: { [opts.weak]: { c: 0, w: 6 } } } : {}) });
  const { errors } = await boot(page, { theme: 'dark', migrated: true, fake: { patch: { ...patch, 'app/profile': planPatch(1), 'app/decks': { v: 1, prefs: { mode: opts.mode, dir: 'de-en', grades: 4 } }, ...FILL, 'vocab/zz-audit': card } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  return errors;
}

test('Wortpartner-Lücke aus dem Paket: die Bedeutung der Wendung steht über den Optionen', async ({ page }) => {
  const errors = await open(page, { word: 'address concerns', pos: 'phrase', de: 'Bedenken ausräumen', def: 'to deal with worries', stage: 3, ex: 'We would like to [address concerns] about data security.' }, { mode: 'type', weak: 'colloc_gap' });
  await expect(page.getByTestId('cue')).toContainText('Bedenken ausräumen');
  await expect(page.getByTestId('choices')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Zuordnen ohne passenden Satz: keine Aufgabe „in die Lücke“, die Bedeutung ist die Frage', async ({ page }) => {
  const errors = await open(page, { word: 'to put something in writing', pos: 'phrase', de: 'schriftlich festhalten', def: 'to record in a document', stage: 2, ex: 'The manager asked the team to [put] the new timeline [in writing].' }, { mode: 'type', weak: 'match' });
  await expect(page.getByTestId('cue-meaning')).toHaveText('schriftlich festhalten');
  await expect(page.getByText('in die Lücke')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Aufdeck-Karte: ein Satz, in dem das Wort zweimal steht, zeigt vorn nur die Bedeutung', async ({ page }) => {
  const errors = await open(page, { word: 'to pour', pos: 'verb', de: 'gießen', def: 'to make a liquid flow', stage: 3, ex: 'Imagine [pouring] water into a bucket. You can pour faster and faster.' }, { mode: 'flip' });
  await expect(page.getByTestId('flip-front')).toHaveText('gießen');
  await expect(page.getByTestId('flip-sentence')).toHaveCount(0);
  await page.getByTestId('flip-show').click();
  await expect(page.getByTestId('flip-origin')).toContainText('You can pour faster');
  expect(errors).toEqual([]);
});

test('Hinweis über der Lücke enthält das englische Wort nicht (Lehnwort in der Bedeutung)', async ({ page }) => {
  const errors = await open(page, { word: 'nuance', pos: 'noun', de: 'feiner Unterschied, Nuance', def: 'a small difference in meaning', stage: 4, ex: 'He noticed the [nuance] in her answer at once.' }, { mode: 'type', weak: 'cloze' });
  await expect(page.getByTestId('cue')).toHaveText('Gesucht: feiner Unterschied');
  expect(errors).toEqual([]);
});
