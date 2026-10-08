import { expect, type Page } from '@playwright/test';
import { boot, openOverview, type BootOptions } from './fixtures';

// Gemeinsame Bausteine für P49 (Wochen-Diagnose): erfundene Fehlerdaten im 28-Tage-Fenster und das Öffnen von Fortschritt › Grammatik mit Schalter.
// Stichtag der Testlaufzeit: Sonntag 20.09.2026 21:00 (KW 38, Lerntag 20.09.).

type Doc = Record<string, unknown>;
export const WEEK = '2026-W38';
const T = (day: string, hhmm: string): number => Date.parse(`${day}T${hhmm}:00+02:00`);

export const wrongEntry = (pat: string, day: string, k: number, ok = false): Doc => ({
  t: T(day, '10:00') + k * 60_000,
  ok,
  lang: 'de',
  k: 'g',
  topic: 'articles',
  type: 'gap',
  q: `Satz ${k} ___ .`,
  given: 'x',
  ans: 'y',
  src: 'seed',
  m: 'gr-gap',
  g: ok ? 3 : 1,
  ms: 3000,
  ctx: 'xtra',
  pat,
});

/** 16 falsche Antworten (10 in `art.definite`, 6 in `art.indefinite`) in zwei Protokolltagen plus drei Fehlersätze mit `cf`. */
export function diagPatch(opts: { wrong?: number } = {}): Record<string, Doc> {
  const n = opts.wrong ?? 16;
  const d1 = Array.from({ length: Math.min(n, 10) }, (_, k) => wrongEntry('art.definite', '2026-09-19', k)).concat([wrongEntry('art.definite', '2026-09-19', 20, true)]);
  const d2 = Array.from({ length: Math.max(0, n - 10) }, (_, k) => wrongEntry('art.indefinite', '2026-09-18', k));
  const errors = [0, 1, 2].map((k) => ({ q: `We need ___ approval ${k}.`, given: 'the', ans: 'an', t: T('2026-09-1' + (6 + k), '11:00'), pat: 'art.indefinite', cf: 'art.definite', box: 1 }));
  return {
    'log/2026-09-19': { date: '2026-09-19', entries: d1 },
    'log/2026-09-18': { date: '2026-09-18', entries: d2 },
    'grammar/articles': { id: 'articles', p: 0.5, n: 5, errors },
  };
}

export const FLAGS = { 'lx:flags': JSON.stringify({ tutor: { diagnose: true } }) };

type Fake = NonNullable<Exclude<BootOptions['fake'], false>>;

export async function openDiagnose(page: Page, opts: BootOptions & { patch?: Record<string, Doc> } = {}) {
  const { patch, fake, ...rest } = opts;
  const fk: Fake = { ...(fake as Fake | undefined), patch: { ...diagPatch(), ...(fake as Fake | undefined)?.patch, ...(patch ?? {}) } };
  const booted = await boot(page, { migrated: true, ...rest, localStorage: { ...FLAGS, ...(rest.localStorage ?? {}) }, fake: fk });
  await openOverview(page);
  await page.getByTestId('tab-grammar').click();
  await expect(page.getByTestId('tab-grammar')).toHaveAttribute('aria-selected', 'true');
  return booted;
}

type Call = { id: string | null; tier: string; input: string };
type FakeCtl = { sampleCalls: Call[]; diagnoseMode?: string; db: { dump(): Record<string, Doc> } };
export const diagCalls = (page: Page): Promise<Array<{ tier: string }>> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: FakeCtl }).__LINGO_FAKE__.sampleCalls.filter((c) => c.id === 'diagnose').map((c) => ({ tier: c.tier })));
export const setDiagMode = (page: Page, m: string): Promise<void> => page.evaluate((v) => void ((window as unknown as { __LINGO_FAKE__: FakeCtl }).__LINGO_FAKE__.diagnoseMode = v), m);
export const dumpDb = (page: Page): Promise<Record<string, Doc>> => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: FakeCtl }).__LINGO_FAKE__.db.dump());
