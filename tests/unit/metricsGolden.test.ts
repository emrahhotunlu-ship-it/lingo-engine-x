import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type * as Zustand from 'zustand';
import type * as Input from '../../src/platform/input';
import { addDays, dayKey } from '../../src/domain/date';
import type { StoredPlan } from '../../src/domain/plan/types';
import { berlin, loadSeed, SEED_ANCHOR, type Doc } from './helpers';

// Golden-Test der Kennzahlen (Relaunch Stufe 1, P5 S1-ZAHL, Abnahme A11; docs/relaunch/stufe1-plan.md 5.3).
// Aufgenommen auf dem Stand VOR dem Umbau. Er hält jede angezeigte Zahl von Heute, Wörtern, Grammatik und Fortschritt fest:
// die echten Bildschirme werden mit Daten gezeichnet (renderToStaticMarkup), festgehalten werden alle Zahlen im Text und alle
// `data-*`-Zustände. Drei Datensätze (Seed, Großdatensatz Seed × 10, leer), 30 Lerntage rund um den Stichtag, mehrere
// Tagesstände (nichts erledigt, Wiederholen halb, Schritt 1 + 2 erledigt, Plan der alten Form) und beide Sprachen.
// Nacharbeit P5 (Technik-Prüfung): dazu Heute „fertig“ (Erledigt-Karte und Extra-Zeile), „fast“ (Wiederholen bis auf eine Karte voll,
// 95-%-Deckel im Ring), breiter Bildschirm (Spalte „Dein Stand“) und 02:30 Uhr Berliner Zeit (Fenster 0–4 Uhr, Tageswechsel 04:00).
// Diese Fälle sind zusätzlich auf dem Stand vor P5 (Commit 7f4828e) aufgenommen worden und dort identisch.
//
// ZWEI TEILE, ZWEI REGELN
//  Teil A „Kennzahlen“ (`__golden__/metrics-kennzahlen.json`): nur benannte Werte – Restminuten `today-min`, Tagesring `data-fills`,
//    „x von N“-Zähler (`today-status`, `chapter-safe`, `topic-pats`, `cando-count`, Wiedereinstiegs-Tag, Wiederholen „x von N“),
//    `quota`, `gr-raw`, Fortschritt-Kacheln, Wörter-Zähler (`ws-counts`, `ws-behind`, `ws-new-left` …); die Liste ist `KENN_IDS`.
//    Teil A ist aus den Werten von Teil B abgeleitet (gleiche Zahlen, jeder Lauf prüft das) und wird per `toEqual` gegen die Datei
//    verglichen, nicht per Schnappschuss: `vitest -u` schreibt Teil A nie neu. Teil A darf im Umbau NIE neu geschrieben werden.
//  Teil B „Struktur“ (`metrics-today.json`, `metrics-screens.json`, `metrics-today-extra.json`): alle übrigen Ziffern und `data-*`.
//    Darf nur nach Diff-Prüfung durch die Hauptsitzung neu geschrieben werden (`vitest -u` auf dieser Datei, dann `git diff` lesen).
// Vor jedem Vergleich muss die Golden-Datei existieren: Eine gelöschte Datei entsteht nicht still neu.
// Eine Abweichung ist ein Fehler, keine Anpassung.

// Ohne Schreibzugriff: Der Test liest nur.
vi.mock('../../src/data', () => ({ getWriter: () => null }));
// renderToStaticMarkup liest bei zustand sonst den ANFANGSzustand jedes Stores (getServerSnapshot = getInitialState);
// hier zeigt der Server-Schnappschuss den aktuellen Stand, wie im Browser.
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
// Blätter und Aufklapper zeigen ihren Inhalt direkt (kein Portal, nichts eingeklappt), damit ihre Zahlen mitgezählt werden.
vi.mock('../../src/ui/Sheet', async (orig) => ({ ...(await orig<Record<string, unknown>>()), Sheet: ({ open, children }: { open: boolean; children?: unknown }) => (open ? children : null) }));
vi.mock('../../src/ui/Disclosure', async (orig) => ({ ...(await orig<Record<string, unknown>>()), Disclosure: ({ children }: { children?: unknown }) => children }));
// Breiter Bildschirm (Heute ab 1.024 px, `useMediaQuery('(min-width: 1024px)')` in TodayScreen): im Server-Bild sonst immer schmal.
const media = vi.hoisted(() => ({ wide: false }));
vi.mock('../../src/platform/input', async (orig) => {
  const real = await orig<typeof Input>();
  return {
    ...real,
    useMediaQuery: (q: string): boolean => {
      const m = real.useMediaQuery(q);
      return m || (media.wide && q === '(min-width: 1024px)');
    },
  };
});

const { useClock } = await import('../../src/app/clock');
const { useSettings } = await import('../../src/app/settings');
const { useLive, LIVE_DOCS, LIVE_COLLECTIONS } = await import('../../src/data/live');
const { TOPICS } = await import('../../src/domain/content');
const store = await import('../../src/features/today/store');
const { useUnitMarks } = await import('../../src/features/today/marks');
const { HiddenInputProvider } = await import('../../src/engine/HiddenInput');
const { TodayScreen } = await import('../../src/features/today/TodayScreen');
const { GrammarScreen, TopicSheet } = await import('../../src/features/grammar/GrammarScreen');
const { PathTab } = await import('../../src/features/progress/PathTab');
const { ProgressScreen } = await import('../../src/features/progress/ProgressScreen');
const { VocabHub } = await import('../../src/features/vocab/hub/VocabHub');
const { useQuota, useVocabCards } = await import('../../src/features/vocab/hub/data');

const D = 86_400_000;
type Lang = 'de' | 'en';

// ------------------------------------------------------------------ Golden-Dateien (Teil A und Teil B)

const GOLDEN_DIR = join(import.meta.dirname, '__golden__');
const KENN_FILE = 'metrics-kennzahlen.json';

/** Teil B: Schnappschuss-Vergleich, aber nur gegen eine VORHANDENE Datei (sonst schriebe vitest sie still neu). */
async function matchB(out: unknown, file: string): Promise<void> {
  expect(existsSync(join(GOLDEN_DIR, file)), `Golden-Datei fehlt: ${file}`).toBe(true);
  await expect(JSON.stringify(out, null, 1)).toMatchFileSnapshot(`./__golden__/${file}`);
}

/** Eine Golden-Datei lesen (Teil A oder Teil B); vorher muss sie existieren. */
function readGolden(file: string): Record<string, unknown> {
  expect(existsSync(join(GOLDEN_DIR, file)), `Golden-Datei fehlt: ${file}`).toBe(true);
  return JSON.parse(readFileSync(join(GOLDEN_DIR, file), 'utf8')) as Record<string, unknown>;
}

/**
 * Teil A: die benannten Kennzahlen. Je Element (Zeile aus `states`) zählt es, wenn eine seiner Kennungen hier steht.
 * Heute: Ring, „x von N“, Wiedereinstieg (Tag n von 7), „noch da“, Zähler der Erledigt-Karte. Wörter: Zähler, Rückstand, neue Wörter,
 * Schätzung. Grammatik: sicher x/y je Kapitel und Thema, Fehlersätze je Kapitel. Fortschritt: Kacheln und Kann-Zähler.
 */
const KENN_IDS = new Set([
  'today-ring',
  'today-status',
  'comeback-band',
  'still-there',
  'odometer',
  'quota',
  'ws-counts',
  'ws-behind',
  'ws-new-left',
  'ws-goal-now',
  'ws-evening',
  'chapter-safe',
  'chapter-due',
  'topic-pats',
  'stand-fest',
  'vocab-goal',
  'retention-28',
  'ready-measure',
  'cando-count',
  'fest-card',
]);
const kenn = (lines: unknown): string[] => (lines as string[]).filter((l) => l.split(' ').some((tok) => !tok.includes('=') && KENN_IDS.has(tok)));

type Shown = { n: string; s: string[] };
/** Benannte Zusatzwerte der neuen Heute-Fälle (Teil B `metrics-today-extra.json`), alle Kennzahlen. */
const TODAY_NAMED = ['rev', 'stand', 'truth', 'goal', 'streak'] as const;

function kennToday(cases: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, raw] of Object.entries(cases)) {
    const c = raw as Shown & Record<string, unknown>;
    const e: Record<string, unknown> = { min: c.min, restart: c.restart, k: kenn(c.s) };
    for (const n of TODAY_NAMED) if (n in c) e[n] = c[n];
    out[k] = e;
  }
  return out;
}

function kennScreens(cases: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, raw] of Object.entries(cases)) {
    const c = raw as Record<string, unknown>;
    const e: Record<string, unknown> = { quota: kenn(c.quota) };
    for (const part of ['vocab', 'grammar', 'progress', 'pathGoal', 'pathCando']) e[part] = kenn((c[part] as Shown).s);
    if (c.topics) e.topics = Object.fromEntries(Object.entries(c.topics as Record<string, { raw: string }>).map(([id, tp]) => [id, tp.raw]));
    out[k] = e;
  }
  return out;
}

/** Teil A prüfen: (1) aus den Werten von Teil B abgeleitet, (2) der jetzige Lauf zeigt dieselben Kennzahlen. */
function matchA(section: 'today' | 'screens' | 'extra', current: Record<string, unknown>, fileB: string): void {
  const a = readGolden(KENN_FILE)[section];
  const derive = section === 'screens' ? kennScreens : kennToday;
  expect(derive(readGolden(fileB)), `Teil A „${section}“ ist nicht aus ${fileB} abgeleitet`).toEqual(a);
  expect(derive(current)).toEqual(a);
}

// ------------------------------------------------------------------ Datensätze (erfunden)

type Data = { docs: Record<string, Doc>; cols: Record<string, Map<string, Doc>>; logs: Record<string, Doc> };

function split(all: Record<string, Doc>): Data {
  const out: Data = { docs: {}, cols: {}, logs: {} };
  for (const [p, d] of Object.entries(all)) {
    const [head, ...rest] = p.split('/');
    const id = rest.join('/');
    if (head === 'app') out.docs[p] = d;
    else if (head === 'log') out.logs[id] = d;
    else if ((LIVE_COLLECTIONS as readonly string[]).includes(head!)) (out.cols[head!] ??= new Map()).set(id, d);
  }
  return out;
}

/** Großdatensatz (Plan 5.3): jede Karte und Wendung zehnmal, je Kopie um k Tage früher fällig und zuletzt geübt. */
function big(seed: Record<string, Doc>): Record<string, Doc> {
  const out: Record<string, Doc> = {};
  for (const [p, d] of Object.entries(seed)) {
    out[p] = d;
    if (!p.startsWith('vocab/') && !p.startsWith('chunk/')) continue;
    for (let k = 1; k < 10; k++) {
      const c: Doc = { ...d };
      if (typeof c.due === 'number') c.due = c.due - k * D;
      if (typeof c.last === 'number' && c.last > 0) c.last = c.last - k * D;
      out[`${p}~${k}`] = c;
    }
  }
  return out;
}

const SEED = loadSeed();
const SETS: Record<string, Data> = {
  seed: split(SEED),
  gross: split(big(SEED)),
  leer: split({ 'app/profile': { days: {}, xpDays: {}, act: {}, answers: 0, vAnswers: 0, gAnswers: 0, xp: 0 } }),
};

/** 30 Lerntage: eine Woche vor dem Stichtag bis gut drei Wochen danach (Pause → Wiedereinstieg, Neustart-Woche). */
const DAYS = Array.from({ length: 30 }, (_, i) => addDays(SEED_ANCHOR, i - 6));

// ------------------------------------------------------------------ Aufbau eines Tages

/** Lerntag `day` zum Zeitpunkt `now` (Standard 10:00 desselben Kalendertags; 02:30 liegt am Kalendertag danach). */
function setDay(set: Data, day: string, lang: Lang, entries: Doc[] = [], now = berlin(day, 10)): number {
  vi.setSystemTime(now);
  useSettings.setState({ lang });
  useClock.setState({ now, today: day });
  const docs: Record<string, Doc | null> = {};
  for (const p of LIVE_DOCS) docs[p] = set.docs[p] ?? null;
  const collections: Record<string, Map<string, Doc>> = {};
  for (const c of LIVE_COLLECTIONS) collections[c] = set.cols[c] ?? new Map<string, Doc>();
  const log = set.logs[day];
  const base = Array.isArray(log?.entries) ? (log.entries as Doc[]) : [];
  useLive.setState({ status: 'ready', docs, collections, invalid: {}, day: { key: day, doc: { date: day, ...(log ?? {}), entries: [...base, ...entries] }, invalid: false } });
  useUnitMarks.setState({ done: {} });
  return now;
}

/** Fester Zufall je Bild (falls ein Bildschirm würfelt). */
function seedRandom(): void {
  let s = 42;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  });
}

const render = (c: ComponentType<never>, props: Record<string, unknown> = {}): string => {
  seedRandom();
  return renderToStaticMarkup(createElement(HiddenInputProvider, null, createElement(c as ComponentType<Record<string, unknown>>, props)));
};

// ------------------------------------------------------------------ Auslesen

const text = (html: string): string =>
  html
    .replace(/<(style|script)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Alle Zahlen des sichtbaren Texts in Reihenfolge. */
const nums = (html: string): string => (text(html).match(/\d[\d.,]*/g) ?? []).join(' ');

/** Alle Elemente mit Zustandsangaben (`data-*` außer `data-testid` allein), je Element eine Zeile. */
function states(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<[a-z][^>]*>/g)) {
    const attrs = [...m[0].matchAll(/ (data-[a-z-]+)="([^"]*)"/g)].map((a) => [a[1]!, a[2]!] as const);
    // Wörter im Satz (`data-word`/`data-lookup`, antippbar) sind Inhalt, keine Kennzahl.
    if (!attrs.some(([k]) => k !== 'data-testid' && k !== 'data-word' && k !== 'data-lookup')) continue;
    out.push(attrs.map(([k, v]) => (k === 'data-testid' ? v : `${k.slice(5)}=${v}`)).join(' '));
  }
  return out;
}

/** Ausschnitt ab einem `data-testid` bis zum nächsten genannten (oder Ende). */
function section(html: string, from: string, to?: string): string {
  const a = html.indexOf(`data-testid="${from}"`);
  if (a < 0) return '';
  // Bis zum Anfang des Elements mit `to` bzw. bis zum Ende des Elements mit `from` (erstes schließendes Tag gleicher Art).
  const tag = html.slice(html.lastIndexOf('<', a) + 1).match(/^[a-z0-9]+/)?.[0] ?? 'div';
  const b = to ? html.lastIndexOf('<', html.indexOf(`data-testid="${to}"`, a)) : html.indexOf(`</${tag}>`, a);
  return html.slice(html.indexOf('>', a) + 1, b < a ? undefined : b);
}

const screen = (html: string): { n: string; s: string[] } => ({ n: nums(html), s: states(html) });

// ------------------------------------------------------------------ Heute

/**
 * Tagesstände: nichts erledigt, Wiederholen ein Drittel, Schritt 1 + 2, alter Plan; neu: alles erledigt, Wiederholen bis auf eine Karte,
 * „bilanz“ = alles erledigt mit Morgenwerten im Plan (7 mehr überfällig, 3 weniger sicher als jetzt), damit die Wahrheitszeile Zahlen zeigt.
 */
type Variant = 'leer' | 'halb' | 'zwei' | 'alt' | 'fertig' | 'fast' | 'bilanz';

/** Plan der alten Form (Phase 1/2, ohne `u`): gilt nach einem Update noch bis 04:00. */
const legacyPlan = (day: string): StoredPlan => ({ d: day, ids: [], why: [], v: 1, duty: ['review', 'ch:gram', 'lesson'], goal: { review: 12 }, lesson: null, at: 0 });

function reviewEntries(set: Data, n: number): Doc[] {
  const ids = [...(set.cols.vocab?.keys() ?? [])].slice(0, n);
  return ids.map((id, i) => ({ t: 1_000 + i, k: 'v', id, ok: i % 3 !== 2, ctx: 'rev' }));
}

/** Heute zeichnen: Lerntag, Tagesstand, Zeitpunkt (`now`, sonst 10:00) und Bildschirmbreite. */
function renderToday(set: Data, day: string, lang: Lang, v: Variant, o: { now?: number; wide?: boolean } = {}): string {
  const now = setDay(set, day, lang, [], o.now);
  store.resetTodayForTests();
  const built = store.buildTodayPlan(day, now);
  const plan = v === 'alt' ? legacyPlan(day) : v === 'bilanz' && built.u ? { ...built, u: { ...built.u, ov: (built.u.ov ?? 0) + 7, sure: Math.max(0, (built.u.sure ?? 0) - 3) } } : built;
  const goal = plan.duty.includes('review') ? plan.goal.review : 0;
  const entries = v === 'halb' ? reviewEntries(set, Math.ceil(goal / 3)) : v === 'alt' ? reviewEntries(set, 4) : v === 'fast' ? reviewEntries(set, Math.max(0, goal - 1)) : [];
  setDay(set, day, lang, entries, o.now);
  const allDone = v === 'fertig' || v === 'bilanz';
  store.useTodayPlan.setState({ day, plan, status: 'ready', exhausted: v === 'zwei' || allDone ? day : null });
  if (v === 'zwei') {
    const ch = plan.duty.find((d) => d !== 'review');
    if (ch?.startsWith('ch:')) useUnitMarks.setState({ done: { [day]: [ch.slice(3)] } });
  }
  if (allDone) useUnitMarks.setState({ done: { [day]: plan.duty.filter((d) => d.startsWith('ch:')).map((d) => d.slice(3)) } });
  media.wide = !!o.wide;
  try {
    return render(TodayScreen as ComponentType<never>);
  } finally {
    media.wide = false;
  }
}

function todayOf(html: string): Record<string, unknown> {
  const ring = /data-testid="today-min"[^>]*>(\d+)</.exec(html)?.[1] ?? null;
  const restart = /data-testid="restart-start"[^>]*>([\s\S]*?)<\/button>/.exec(html);
  return {
    min: ring,
    restart: restart ? nums(restart[1]!) : null,
    ...screen(html),
  };
}

function todayCase(set: Data, day: string, lang: Lang, v: Variant): Record<string, unknown> {
  return todayOf(renderToday(set, day, lang, v));
}

/** Neue Fälle: dazu benannte Kennzahlen aus Text (Wiederholen „x von N“, Spalte „Dein Stand“, Erledigt-Karte). `null` = nicht gezeichnet. */
function extraCase(set: Data, day: string, lang: Lang, v: Variant, o: { now?: number; wide?: boolean } = {}): Record<string, unknown> {
  const html = renderToday(set, day, lang, v, o);
  const named = (id: string): string | null => (html.includes(`data-testid="${id}"`) ? nums(section(html, id)) : null);
  const rev = /data-duty="review"[^>]*>[\s\S]*?data-testid="reason"[^>]*>([^<]*)</.exec(html);
  return {
    ...todayOf(html),
    rev: rev ? nums(rev[1]!) : null,
    stand: named('today-stand'),
    truth: named('today-truth'),
    goal: named('today-goal'),
    streak: named('today-streak'),
  };
}

// ------------------------------------------------------------------ Wörter, Grammatik, Fortschritt

function QuotaProbe() {
  const q = useQuota(useVocabCards());
  return createElement('span', { 'data-testid': 'quota', 'data-left': q.left, 'data-per-day': String(q.perDay) });
}

function screensCase(set: Data, day: string, lang: Lang, sheets: boolean): Record<string, unknown> {
  setDay(set, day, lang);
  store.resetTodayForTests();
  store.useTodayPlan.setState({ day, plan: store.buildTodayPlan(day, berlin(day, 10)), status: 'ready', exhausted: null });
  const out: Record<string, unknown> = {
    quota: states(render(QuotaProbe as ComponentType<never>)),
    vocab: screen(render(VocabHub as ComponentType<never>)),
    grammar: screen(render(GrammarScreen as ComponentType<never>)),
    progress: screen(render(ProgressScreen as ComponentType<never>)),
    pathGoal: screen(render(PathTab as ComponentType<never>, { part: 'goal' })),
    pathCando: screen(render(PathTab as ComponentType<never>, { part: 'cando' })),
  };
  if (sheets) {
    const topics: Record<string, unknown> = {};
    for (const tp of TOPICS) {
      const html = render(TopicSheet as ComponentType<never>, { topic: tp.id, onClose: () => undefined });
      topics[tp.id] = { raw: nums(section(html, 'gr-raw')), cert: text(section(html, 'rule-certainty', 'lernweg')), weg: states(`<ol>${section(html, 'lernweg')}`) };
    }
    out.topics = topics;
  }
  return out;
}

// ------------------------------------------------------------------ Lauf

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterAll(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Kennzahlen-Golden (A11: jede Zahl vor und nach dem Umbau gleich)', () => {
  it('Heute: Rest, Ring, Blockzähler je Datensatz, Lerntag und Tagesstand', async () => {
    const out: Record<string, unknown> = {};
    for (const [name, set] of Object.entries(SETS)) {
      for (const day of DAYS) {
        for (const v of ['leer', 'halb', 'zwei', 'alt'] as const) out[`${name} ${day} ${v}`] = todayCase(set, day, 'de', v);
      }
    }
    for (const day of DAYS.filter((_, i) => i % 5 === 0)) out[`seed ${day} leer en`] = todayCase(SETS.seed!, day, 'en', 'leer');
    matchA('today', out, 'metrics-today.json');
    await matchB(out, 'metrics-today.json');
  }, 120_000);

  it('Heute, Nacharbeit: fertig, fast voll, breiter Bildschirm, 02:30 Uhr', async () => {
    const out: Record<string, unknown> = {};
    for (const [name, set] of Object.entries(SETS)) {
      DAYS.forEach((day, i) => {
        if (name !== 'seed' && i % 3 !== 0) return;
        out[`${name} ${day} fertig`] = extraCase(set, day, 'de', 'fertig');
        out[`${name} ${day} fast`] = extraCase(set, day, 'de', 'fast');
        if (name !== 'leer') out[`${name} ${day} bilanz`] = extraCase(set, day, 'de', 'bilanz');
      });
    }
    // Breit (≥ 1.024 px): Tageskarte und „Dein Stand“ nebeneinander, offen und erledigt.
    DAYS.forEach((day, i) => {
      if (i % 5 !== 0) return;
      for (const v of ['leer', 'fertig'] as const) out[`seed ${day} ${v} breit`] = extraCase(SETS.seed!, day, 'de', v, { wide: true });
    });
    out[`gross ${DAYS[6]} halb breit`] = extraCase(SETS.gross!, DAYS[6]!, 'de', 'halb', { wide: true });
    out[`leer ${DAYS[6]} leer breit`] = extraCase(SETS.leer!, DAYS[6]!, 'de', 'leer', { wide: true });
    // 02:30 Uhr am Kalendertag danach: gehört noch zum Lerntag `day` (Tageswechsel 04:00).
    for (const [name, set] of Object.entries(SETS)) {
      DAYS.forEach((day, i) => {
        if (i % (name === 'seed' ? 3 : 5) !== 0) return;
        const now = berlin(addDays(day, 1), 2, 30);
        expect(dayKey(now)).toBe(day);
        for (const v of ['leer', 'halb'] as const) out[`${name} ${day} ${v} 02:30`] = extraCase(set, day, 'de', v, { now });
      });
    }
    for (const day of DAYS.filter((_, i) => i % 5 === 0)) out[`seed ${day} fertig en`] = extraCase(SETS.seed!, day, 'en', 'fertig');

    // Die Fälle zeigen, was sie zeigen sollen (sonst prüfte der Golden-Test nichts).
    const cases = Object.entries(out) as Array<[string, { s: string[]; stand: string | null; min: string | null }]>;
    const fertig = cases.filter(([k]) => / (fertig|bilanz)/.test(k));
    expect(fertig.length).toBeGreaterThan(0);
    for (const [k, c] of fertig) expect(c.s.some((l) => l.includes('today-card done=true') || l.includes('status=nothing')), k).toBe(true);
    expect(fertig.some(([, c]) => c.s.some((l) => l.includes('status=allDone')))).toBe(true);
    expect(cases.some(([k, c]) => / fast/.test(k) && c.s.some((l) => /today-ring .*fills=0\.95/.test(l))), 'kein Fall mit 95-%-Deckel').toBe(true);
    expect(cases.some(([k, c]) => / bilanz/.test(k) && !!(c as { truth?: string | null }).truth), 'keine Wahrheitszeile mit Zahlen').toBe(true);
    for (const [k, c] of cases.filter(([k]) => / breit/.test(k))) expect(c.stand, k).not.toBeNull();
    expect(cases.filter(([k, c]) => / 02:30/.test(k) && c.min !== null).length).toBeGreaterThan(0);

    matchA('extra', out, 'metrics-today-extra.json');
    await matchB(out, 'metrics-today-extra.json');
  }, 240_000);

  it('Wörter, Grammatik, Fortschritt: alle Zahlen und Zustände je Datensatz und Lerntag', async () => {
    const out: Record<string, unknown> = {};
    for (const [name, set] of Object.entries(SETS)) {
      DAYS.forEach((day, i) => {
        if (i % 3 !== 0) return;
        out[`${name} ${day}`] = screensCase(set, day, 'de', i % 9 === 0);
      });
    }
    out[`seed ${DAYS[6]} en`] = screensCase(SETS.seed!, DAYS[6]!, 'en', true);
    matchA('screens', out, 'metrics-screens.json');
    await matchB(out, 'metrics-screens.json');
  }, 120_000);
});
