import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as Zustand from 'zustand';
import { addDays } from '../../src/domain/date';
import type { StoredPlan } from '../../src/domain/plan/types';
import { berlin, loadSeed, SEED_ANCHOR, type Doc } from './helpers';

// Startbild ↔ echte Tageskarte (Relaunch Stufe 1 P6, Tarek S2, Kap. 2 Nr. 2 „keine Widersprüche“): Das Startbild aus `deriveTodayDoc`
// zeigt dieselben Restminuten, dasselbe „x von N“, denselben Titel, denselben Knopf und dieselben Zeilen (Name, Minuten, Zustand) wie die
// echte Karte aus demselben Plan und Tagesstand. Vier Fälle: Einheit, Kapitel-Thema, neues Thema, alter Plan. Erfundene Daten (Seed).

vi.mock('../../src/data', () => ({ getWriter: () => null }));
// renderToStaticMarkup liest bei zustand sonst den Anfangszustand (wie metricsGolden.test.ts).
vi.mock('zustand', async (orig) => {
  const real = await orig<typeof Zustand>();
  const { createStore } = await import('zustand/vanilla');
  const impl = (init: never) => {
    const api = createStore(init);
    api.getInitialState = api.getState;
    const hook = (sel?: (s: unknown) => unknown) => (sel ? real.useStore(api, sel) : real.useStore(api));
    Object.assign(hook, api);
    return hook;
  };
  return { ...real, create: (init?: never) => (init ? impl(init) : impl) };
});

const { useClock } = await import('../../src/app/clock');
const { useSettings } = await import('../../src/app/settings');
const { useLive, LIVE_DOCS, LIVE_COLLECTIONS } = await import('../../src/data/live');
const store = await import('../../src/features/today/store');
const { useUnitMarks } = await import('../../src/features/today/marks');
const { computeToday } = await import('../../src/features/today/state');
const { viewPlan } = await import('../../src/features/today/device');
const { deriveTodayDoc } = await import('../../src/features/today/startDoc');
const { StartCard } = await import('../../src/features/today/DayCard');
const { HiddenInputProvider } = await import('../../src/engine/HiddenInput');
const { TodayScreen } = await import('../../src/features/today/TodayScreen');
const { todayDocFor } = await import('../../src/data/todayDoc');

// Dienstag nach dem Stichtag (Sonntag hat die Form „Wochen-Check“ ohne Grammatikschritt).
const DAY = addDays(SEED_ANCHOR, 2);
const SEED = loadSeed();

/** Lerntag mit Seed-Daten und optional Wiederhol-Einträgen im Tagesprotokoll. */
function setDay(lang: 'de' | 'en', entries: Doc[]): number {
  const now = berlin(DAY, 10);
  vi.setSystemTime(now);
  useSettings.setState({ lang });
  useClock.setState({ now, today: DAY });
  const docs: Record<string, Doc | null> = {};
  for (const p of LIVE_DOCS) docs[p] = SEED[p] ?? null;
  const collections: Record<string, Map<string, Doc>> = {};
  for (const c of LIVE_COLLECTIONS) {
    const m = new Map<string, Doc>();
    for (const [p, d] of Object.entries(SEED)) if (p.startsWith(`${c}/`) && p.split('/').length === 2) m.set(p.slice(c.length + 1), d);
    collections[c] = m;
  }
  useLive.setState({ status: 'ready', docs, collections, invalid: {}, day: { key: DAY, doc: { date: DAY, entries }, invalid: false } });
  useUnitMarks.setState({ done: {} });
  return now;
}

function reviewEntries(n: number): Doc[] {
  const ids = [...(useLive.getState().collections.vocab?.keys() ?? [])].slice(0, n);
  return ids.map((id, i) => ({ t: 1_000 + i, k: 'v', id, ok: true, ctx: 'rev' }));
}

const render = (c: ComponentType<never>, props: Record<string, unknown> = {}): string =>
  renderToStaticMarkup(createElement(HiddenInputProvider, null, createElement(c as ComponentType<Record<string, unknown>>, props)));

const text = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Inhalt des ersten Elements mit `data-testid` (bis zum schließenden Tag gleicher Art). */
function inner(html: string, id: string): string | null {
  const a = html.indexOf(`data-testid="${id}"`);
  if (a < 0) return null;
  const tag = html.slice(html.lastIndexOf('<', a) + 1).match(/^[a-z0-9]+/)?.[0] ?? 'div';
  return html.slice(html.indexOf('>', a) + 1, html.indexOf(`</${tag}>`, a));
}

/** Zeilen: Name (erste Text-Spanne), Minuten/Zustand-Text rechts und `data-state`/`data-now`. */
function rows(html: string, id: 'duty' | 'start-duty'): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(new RegExp(`<li[^>]*data-testid="${id}"[^>]*>([\\s\\S]*?)</li>`, 'g'))) {
    const head = m[0].slice(0, m[0].indexOf('>') + 1);
    const name = /<span class="text-base[^"]*">([^<]*)<\/span>/.exec(m[1]!)?.[1] ?? '?';
    const right = /<span class="lx-tnum[^"]*">([\s\S]*?)<\/span>\s*$/.exec(m[1]!)?.[1] ?? '';
    const st = / data-state="([^"]*)"/.exec(head)?.[1];
    const now = / data-now="true"/.test(head) ? ' now' : '';
    out.push(`${/ data-duty="([^"]*)"/.exec(head)?.[1]} | ${name} | ${text(right)} | ${st}${now}`);
  }
  return out;
}

type Face = { min: string | null; status: string | null; title: string | null; go: string | null; rows: string[] };

const realFace = (html: string): Face => ({
  min: text(inner(html, 'today-min') ?? ''),
  status: text(inner(html, 'today-status') ?? ''),
  title: text(inner(html, 'today-title') ?? ''),
  go: text(inner(html, 'start') ?? ''),
  rows: rows(html, 'duty'),
});
const startFace = (html: string): Face => ({
  min: text(inner(html, 'start-min') ?? ''),
  status: text(inner(html, 'start-status') ?? ''),
  title: text(inner(html, 'start-title') ?? ''),
  go: text(inner(html, 'start-go') ?? ''),
  rows: rows(html, 'start-duty'),
});

/** Beide Karten aus demselben Plan und Tagesstand zeichnen. */
function both(plan: StoredPlan, lang: 'de' | 'en', reviews: number): { real: Face; start: Face } {
  setDay(lang, []);
  setDay(lang, reviewEntries(reviews));
  store.useTodayPlan.setState({ day: DAY, plan, status: 'ready', exhausted: null });
  const real = render(TodayScreen as ComponentType<never>);
  const items = computeToday(DAY).duties.items;
  const doc = deriveTodayDoc({ day: DAY, plan: viewPlan(plan) ?? plan, items, at: 1 });
  expect(doc).not.toBeNull();
  const valid = todayDocFor(JSON.parse(JSON.stringify(doc)), DAY);
  expect(valid).not.toBeNull();
  const out = { real: realFace(real), start: startFace(render(StartCard as ComponentType<never>, { doc: valid })) };
  // Die echte Karte steht wirklich da (sonst verglichen wir zwei leere Bilder).
  for (const k of ['min', 'status', 'title', 'go'] as const) expect(out.real[k], k).toBeTruthy();
  for (const r of out.real.rows) expect(r).toMatch(/^\S+ \| \S.* \| \S.* \| (done|open)/);
  return out;
}

/** Plan der Einheit (aus dem Seed gebaut), mit eingefrorenem Thema `gt`. */
function unitPlan(gt?: NonNullable<StoredPlan['u']>['gt']): StoredPlan {
  store.resetTodayForTests();
  setDay('de', []);
  const built = store.buildTodayPlan(DAY, berlin(DAY, 10));
  expect(built.u).toBeTruthy();
  return gt ? { ...built, u: { ...built.u!, gt } } : built;
}

/** Wiederholen voll → der nächste Schritt ist der zweite Block (bei der Einheit: Grammatik). */
const fullReview = (p: StoredPlan): number => (p.duty.includes('review') ? p.goal.review : 0);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Startbild gleicht der echten Karte (Tarek S2)', () => {
  vi.useFakeTimers({ toFake: ['Date'] });

  for (const lang of ['de', 'en'] as const) {
    it(`Einheit, nichts erledigt (${lang})`, () => {
      const { real, start } = both(unitPlan(), lang, 0);
      expect(real.rows.length).toBeGreaterThan(1);
      expect(start).toEqual(real);
    });

    it(`Kapitel-Thema, Grammatik ist dran (${lang})`, () => {
      const p = unitPlan({ intro: null, pats: [], topics: ['passive'], ch: 3 });
      const { real, start } = both(p, lang, fullReview(p));
      expect(real.title).toMatch(/3/);
      expect(start).toEqual(real);
    });

    it(`neues Thema, Grammatik ist dran (${lang})`, () => {
      const p = unitPlan({ intro: 'conditionals', pats: [], topics: [] });
      const { real, start } = both(p, lang, fullReview(p));
      expect(real.title).toMatch(/neu|new/i);
      expect(start).toEqual(real);
    });

    it(`alter Plan ohne Einheit (${lang})`, () => {
      const p: StoredPlan = { d: DAY, ids: [], why: [], v: 1, duty: ['review', 'ch:gram', 'lesson'], goal: { review: 12 }, lesson: null, at: 0 };
      const { real, start } = both(p, lang, 4);
      expect(real.rows.length).toBeGreaterThan(1);
      expect(start).toEqual(real);
    });
  }
});
