import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { bootAt } from './fixtures';

// Rundenbau über die Prioritätstabelle (Lernplattform 3.0 P15): Mit dem Schalter `slots` kommen die Aufgaben der Runde aus eingeführten Mustern,
// c1x-Aufgaben (Pilot) stehen dort, wo die Art eingeschaltet ist; nicht eingeführte Muster erscheinen nie.

const OLD = Date.parse('2020-01-01T10:00:00+01:00');
const doc = (topic: string, pats: Record<string, unknown>): Record<string, unknown> => ({
  id: topic,
  p: 0.5,
  anchor: 0.5,
  anchorD: '2026-09-15',
  n: 6,
  c: 4,
  due: OLD,
  last: OLD,
  recent: [1, 1, 0, 1],
  seen: [],
  seenText: [],
  hist: [{ d: '2026-09-15', p: 0.5 }],
  errors: [],
  pats,
});
const entry = { n: 4, c: 2, last: OLD, h: 0, r: 1, k: 1, dd: [], i: '2026-09-01' };

/** Alle Themen ohne offene Fehlersätze (sonst stehen die Fehlersätze der Beispieldaten vor der Runde); `passive-plus` mit dem eingeführten Muster. */
const TOPIC_IDS = (JSON.parse(readFileSync(new URL('../../src/content/grammar/path.json', import.meta.url), 'utf8')) as { chapters: Array<{ topics: string[] }> }).chapters.flatMap((c) => c.topics);
const patches = (): Record<string, Record<string, unknown>> => ({
  ...Object.fromEntries(TOPIC_IDS.map((t) => [`grammar/${t}`, doc(t, {})])),
  'grammar/passive-plus': doc('passive-plus', { 'pp.personal': entry }),
});

test.use({ viewport: { width: 1440, height: 900 } });

test('Pflichtrunde mit Schalter „slots“: nur eingeführte Muster, c1x-Pilotaufgabe dabei, keine Fehler', async ({ page }) => {
  const { errors } = await bootAt(
    page,
    { name: 'grammarSession', mode: 'xtra' },
    { localStorage: { 'lx:flags': 'slots,kwt' }, fake: { patch: patches() } },
  );
  const item = page.getByTestId('gr-item');
  await expect(item).toBeVisible();
  // Das einzige eingeführte Muster bestimmt den ersten Platz; die erlaubte Art ist die eingeschaltete (kwt).
  await expect(item).toHaveAttribute('data-pat', '1');
  await expect(item).toHaveAttribute('data-c1x', 'kwt');
  expect(errors).toEqual([]);
});

test('ohne den Schalter bleibt der Rundenbau wie bisher (keine c1x-Aufgabe)', async ({ page }) => {
  const { errors } = await bootAt(
    page,
    { name: 'grammarSession', mode: 'xtra' },
    { localStorage: { 'lx:flags': 'kwt' }, fake: { patch: patches() } },
  );
  await expect(page.getByTestId('gr-item')).toBeVisible();
  await expect(page.getByTestId('gr-item')).not.toHaveAttribute('data-c1x', /.+/);
  expect(errors).toEqual([]);
});
