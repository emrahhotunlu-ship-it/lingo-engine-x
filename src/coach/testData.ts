import { bank } from '../bank/words';
import type { FsrsStored } from '../data/schemas';
import { addDays, dayKeyNoon, isoWeek } from '../domain/date';
import { hash32, mulberry32, shuffle } from '../domain/random';
import { intervalDays, type TopicState } from './grammarModel';
import type { BriefRec, CardRec, CheckRec, DayRec, InLog, InLogEntry, InputItem, Placement, ProfileDoc } from './types';

// Beispieldaten für die Testwerkzeuge (nur im Test-Build für den Test-Link, siehe src/app/testBuild.ts).
// Alles ist erfunden und deterministisch: gleiche Eingabe, gleiche Daten. Reine Berechnung, kein
// Schreiben; geschrieben wird in src/coach/testActions.ts über den Schreibpfad von store.ts.

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Test-Profil: Beginn des Fahrplans vor so vielen Tagen. */
export const TEST_PLAN_DAYS = 25;
/** Beispiel-Fortschritt: so viele Tage zurück, so viele Karten, davon so viele jetzt fällig. */
export const SAMPLE_DAYS = 28;
export const SAMPLE_CARDS = 150;
export const SAMPLE_DUE = 30;
/** Kennung der Beispiel-Beiträge im Input: nur diese werden beim erneuten Setzen ersetzt. */
export const TEST_INPUT_PREFIX = 'test-';

// ── Test-Profil (Niveau B2, ohne Einstufung) ────────────────────────────────────────────────────
// Die Werte hängen zusammen: Die Bänder ergeben 4.200 Wörter, die ersten fünf (X-Lex-Bereich) 3.700
// = B2; die Kernthemen der Grammatik liegen im Mittel bei 0,725 = B2. Mehrere Themen sind schwach.

export const TEST_BANDS: readonly number[] = [1, 0.95, 0.8, 0.6, 0.33, 0.25, 0.15, 0.1, 0.02];

export const TEST_GRAMMAR: Readonly<Record<string, number>> = {
  'pres-simple-cont': 0.95,
  'past-simple-perfect': 0.55,
  'pres-perf-cont': 0.8,
  'past-perfect': 0.85,
  'future-forms': 0.95,
  'future-perf-cont': 0.6,
  'used-to': 0.9,
  conditionals: 0.85,
  'mixed-cond': 0.45,
  passive: 0.85,
  reported: 0.65,
  relative: 0.9,
  'modals-deduction': 0.6,
  'gerund-inf': 0.8,
  prepositions: 0.5,
  articles: 0.4,
  'c1-hedging': 0.55,
  'c1-diplomacy': 0.5,
  'c1-emphasis': 0.6,
  'c1-discourse': 0.65,
  'c1-nominal': 0.5,
  'c1-participle': 0.6,
  'c1-precision': 0.55,
};

/** Zeitpunkte der Beispieldaten liegen auf dem Mittag eines Tages: Zweimal Drücken am selben Tag ändert nichts. */
export function testPlacement(today: string): Placement {
  return { at: dayKeyNoon(addDays(today, -TEST_PLAN_DAYS)), size: 4200, bands: [...TEST_BANDS], falseAlarm: 0.06, grammar: { ...TEST_GRAMMAR }, level: 'B2' };
}

/** Was das Test-Profil ins Profil schreibt. `imported` nur, wenn es noch fehlt (sonst wartet „Heute" auf die Übernahme). */
export function testProfilePatch(today: string, nowMs: number, hasImported: boolean): Partial<ProfileDoc> {
  return {
    placement: testPlacement(today),
    planStart: addDays(today, -TEST_PLAN_DAYS),
    ...(hasImported ? {} : { imported: { at: nowMs, cards: 0, days: [], grammar: {} } }),
  };
}

// ── Beispiel-Fortschritt (4 Wochen) ─────────────────────────────────────────────────────────────

/** Tage vor heute mit bewertetem Input (Beispiel-Beiträge). Alle anderen Tage ohne „i". */
export const INPUT_OFFSETS: readonly number[] = [1, 2, 4, 5, 6, 8, 9, 11, 12, 14, 15, 16, 19, 21];
/** Ruhetage: einer je Kalenderwoche, damit die Serie trotzdem läuft. */
const REST_OFFSETS = new Set([3, 10, 17, 24]);

/** Tageswerte der letzten 28 Tage (ohne heute). Die Treffer steigen leicht, an Ruhetagen fehlt der Eintrag. */
export function sampleDays(today: string): Record<string, DayRec> {
  const out: Record<string, DayRec> = {};
  const withInput = new Set(INPUT_OFFSETS);
  for (let i = 1; i <= SAMPLE_DAYS; i++) {
    if (REST_OFFSETS.has(i)) continue;
    const rng = mulberry32(hash32(`test-day-${i}`));
    const t = (SAMPLE_DAYS - i) / (SAMPLE_DAYS - 1); // 0 = ältester Tag, 1 = gestern
    const ans = 55 + Math.floor(rng() * 46);
    const rate = 0.72 + 0.14 * t + (rng() - 0.5) * 0.06;
    out[addDays(today, -i)] = {
      min: 24 + Math.floor(rng() * 10),
      ans,
      ok: Math.round(ans * rate),
      nw: 8 + Math.floor(rng() * 3),
      ...(i % 5 === 0 ? { kn: 3 } : {}),
      core: 1,
      w: 1,
      g: 1,
      i: withInput.has(i) ? 1 : 0,
    };
  }
  return out;
}

const LEVELS: ReadonlyArray<{ lv: number; n: number; s: readonly [number, number]; reps: readonly [number, number] }> = [
  { lv: 0, n: 30, s: [1, 3], reps: [2, 4] },
  { lv: 1, n: 35, s: [3, 8], reps: [3, 6] },
  { lv: 2, n: 35, s: [8, 20], reps: [5, 9] },
  { lv: 3, n: 30, s: [20, 45], reps: [8, 14] },
  { lv: 4, n: 20, s: [45, 90], reps: [12, 20] },
];
/** Die ersten Karten der Stufe 0 sind „hartnäckig" (oft falsch): So zeigt Heute den Hinweis auf schwierige Wörter. */
const STUBBORN = 6;

function between(rng: () => number, [lo, hi]: readonly [number, number]): number {
  return lo + rng() * (hi - lo);
}

/**
 * 150 Bankkarten in allen Stufen, Termine über die nächsten Wochen verteilt, 30 davon jetzt fällig.
 * Ältere echte Karten (angelegt vor mehr als 35 Tagen) werden nie überschrieben; Beispielkarten schon,
 * damit zweimal Drücken dieselben Karten ergibt statt doppelt so vieler.
 */
export function sampleCards(nowMs: number, existing: ReadonlyMap<string, CardRec> = new Map()): Array<[string, CardRec]> {
  const protectedBefore = nowMs - 35 * DAY;
  const isOldReal = (id: string): boolean => {
    const add = existing.get(id)?.add;
    return add !== undefined && add < protectedBefore;
  };
  const pool = bank().words.filter((w) => w.r <= 4500 && w.ex && w.ex.length > 0 && !isOldReal(w.i));
  const picks = shuffle(pool, mulberry32(hash32('test-cards'))).slice(0, SAMPLE_CARDS);
  const out: Array<[string, CardRec]> = [];
  let k = 0;
  for (const spec of LEVELS) {
    for (let j = 0; j < spec.n; j++, k++) {
      const word = picks[k];
      if (!word) return out;
      const rng = mulberry32(hash32(`test-card-${word.i}`));
      const stubborn = spec.lv === 0 && j < STUBBORN;
      const s = stubborn ? 0.8 : Math.round(between(rng, spec.s) * 10) / 10;
      const reps = Math.round(between(rng, spec.reps));
      const lapses = stubborn ? 2 : rng() < 0.2 ? 1 : 0;
      const due = k % 5 === 0;
      // Fällig: der Termin lag vor 5 bis 53 Stunden. Sonst: noch 0,1 bis s Tage hin.
      const dueMs = due ? nowMs - Math.round((5 + rng() * 48) * HOUR) : nowMs + Math.round(Math.max(0.1, s - rng() * 0.9 * s) * DAY);
      const scheduledDays = Math.max(1, Math.round(s));
      const f: FsrsStored = {
        v: 1,
        due: dueMs,
        stability: s,
        difficulty: stubborn ? 7 : Math.round((3.5 + rng() * 4) * 100) / 100,
        state: stubborn ? 3 : 2,
        reps,
        lapses,
        last: dueMs - scheduledDays * DAY,
        scheduledDays,
        learningSteps: 0,
        src: 'lx',
      };
      const known = spec.lv >= 3 && j % 4 === 0;
      const rec: CardRec = {
        src: 'bank',
        f,
        lv: spec.lv,
        add: nowMs - Math.round((6 + rng() * 21) * DAY),
        ok: stubborn ? 1 : Math.max(1, reps - lapses),
        bad: stubborn ? 3 : lapses,
        ...(known ? { known: 1 as const, ok: 1, bad: 0 } : {}),
      };
      out.push([word.i, rec]);
    }
  }
  return out;
}

/** Grammatik-Stände einiger Themen (Werte der Einstufung, dazu Antworten und Termine). Teils fällig. */
export function sampleGrammar(nowMs: number): Record<string, TopicState> {
  const ids = ['articles', 'prepositions', 'past-simple-perfect', 'mixed-cond', 'reported', 'modals-deduction', 'future-perf-cont', 'conditionals', 'passive', 'relative', 'gerund-inf', 'pres-simple-cont'];
  const out: Record<string, TopicState> = {};
  for (const id of ids) {
    const h = hash32(`test-grammar-${id}`);
    const p = TEST_GRAMMAR[id] ?? 0.5;
    const n = 8 + (h % 10);
    const last = nowMs - (1 + (h % 9)) * DAY;
    out[id] = { p, n, c: Math.round(n * p), last, due: last + intervalDays(p) * DAY };
  }
  return out;
}

/** Schlüssel eines Protokoll-Eintrags: wie `logKey` in src/screens/InputScreen.tsx (Tag des Beitrags + Kennung). */
export const inLogKey = (day: string, id: string): string => `${day}-${id}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 120);

const SAMPLE_READS: ReadonlyArray<{ title: string; source: string; kind: 'article' | 'video'; topic: string; mins: number }> = [
  { title: 'Beispiel: Why inflation cools slowly', source: 'Beispielquelle', kind: 'article', topic: 'economy', mins: 9 },
  { title: 'Beispiel: How AI tools change daily work', source: 'Beispielquelle', kind: 'video', topic: 'tech', mins: 14 },
  { title: 'Beispiel: Pricing a new product', source: 'Beispielquelle', kind: 'article', topic: 'business', mins: 8 },
  { title: 'Beispiel: Why the second half decides matches', source: 'Beispielquelle', kind: 'video', topic: 'sport', mins: 11 },
  { title: 'Beispiel: How habits form', source: 'Beispielquelle', kind: 'video', topic: 'science', mins: 12 },
  { title: 'Beispiel: What makes a startup raise money', source: 'Beispielquelle', kind: 'article', topic: 'business', mins: 10 },
];
const RATINGS: ReadonlyArray<NonNullable<InLogEntry['r']>> = ['great', 'ok', 'great', 'boring', 'great', 'ok', 'great'];
const LEVELS_RATED: ReadonlyArray<NonNullable<InLogEntry['l']>> = ['right', 'right', 'hard', 'right', 'easy', 'right', 'right', 'hard'];

/** Input-Protokoll: bewertete Beispiel-Beiträge an 14 Tagen, dazu eigene Zeit an drei Ruhetagen. */
export function sampleInLog(today: string): InLog {
  const it: Record<string, InLogEntry> = {};
  INPUT_OFFSETS.forEach((off, n) => {
    const day = addDays(today, -off);
    const read = SAMPLE_READS[n % SAMPLE_READS.length]!;
    it[inLogKey(day, `test-${n}`)] = {
      d: day,
      r: RATINGS[n % RATINGS.length]!,
      l: LEVELS_RATED[n % LEVELS_RATED.length]!,
      m: read.mins,
      t: read.title,
      s: read.source,
      k: read.kind,
      topic: read.topic,
    };
  });
  return { it, own: { [addDays(today, -3)]: 20, [addDays(today, -10)]: 30, [addDays(today, -17)]: 15 } };
}

/** Protokoll nach Monaten trennen (je Monat ein Dokument `coach/inlog-JJJJ-MM`). Schlüssel: JJJJ-MM. */
export function inLogByMonth(log: InLog): Record<string, InLog> {
  const out: Record<string, InLog> = {};
  const bucket = (month: string): InLog => (out[month] ??= { it: {}, own: {} });
  for (const [k, e] of Object.entries(log.it)) bucket(e.d.slice(0, 7)).it[k] = e;
  for (const [d, m] of Object.entries(log.own)) bucket(d.slice(0, 7)).own[d] = m;
  return out;
}

/** Ein Monats-Check vor 12 Tagen (zweiter Punkt der Kurve). Schlüssel: Monat dieses Tages. */
export function sampleChecks(today: string): Record<string, CheckRec> {
  const day = addDays(today, -12);
  return { [day.slice(0, 7)]: { at: dayKeyNoon(day), size: 4350, level: 'B2+', gOk: 15, gN: 23 } };
}

/** Ein Trainer-Brief für die letzte Woche (der dieser Woche fehlt, damit der Knopf „Brief schreiben" sichtbar bleibt). */
export function sampleBriefs(today: string): Record<string, BriefRec> {
  return {
    [isoWeek(addDays(today, -7))]: {
      at: dayKeyNoon(addDays(today, -6)),
      lang: 'de',
      text: 'Beispiel-Brief, nur zum Ausprobieren: Du hast letzte Woche an 6 von 7 Tagen trainiert und 84 % der Antworten richtig gehabt. Am meisten hakt es bei den Artikeln und bei Verbindungen mit Präpositionen. Fokus für diese Woche: Artikel und feste Präpositionen. Dein Wortschatz wächst gleichmäßig, etwa 9 neue Wörter pro Tag.',
    },
  };
}

// ── Beispiel-Input für heute ────────────────────────────────────────────────────────────────────

/**
 * Zwei Beispiel-Beiträge. Keine erfundenen Adressen: nur stabile Startseiten, Titel klar als Beispiel
 * gekennzeichnet. Kennungen beginnen mit `test-`.
 */
export function sampleInput(): InputItem[] {
  return [
    {
      id: `${TEST_INPUT_PREFIX}video`,
      kind: 'video',
      title: 'Beispiel: A short talk from the TED channel',
      source: 'TED (Startseite des Kanals)',
      url: 'https://www.youtube.com/@TED',
      mins: 12,
      level: 'B2',
      topic: 'science',
      why_de: 'Beispiel zum Ausprobieren: Such dir auf dem Kanal einen Vortrag zu Psychologie oder Wissenschaft aus, etwa 10 bis 15 Minuten lang.',
      why_en: 'Example for trying things out: pick a talk on psychology or science on the channel, about 10 to 15 minutes long.',
      tip_de: 'Stell die englischen Untertitel an und achte auf die fünf Schlüsselwörter.',
      tip_en: 'Turn on the English subtitles and listen for the five key words.',
      words: [
        { en: 'attention', de: 'Aufmerksamkeit' },
        { en: 'evidence', de: 'Beleg, Nachweis' },
        { en: 'habit', de: 'Gewohnheit' },
        { en: 'overcome', de: 'überwinden' },
        { en: 'reveal', de: 'zeigen, offenbaren' },
      ],
    },
    {
      id: `${TEST_INPUT_PREFIX}article`,
      kind: 'article',
      title: 'Beispiel: Technology news from the BBC',
      source: 'BBC News (Startseite Technik)',
      url: 'https://www.bbc.com/news/technology',
      mins: 8,
      level: 'B2+',
      topic: 'tech',
      why_de: 'Beispiel zum Ausprobieren: Wähle auf der Seite einen Artikel über KI oder Software, der dich interessiert.',
      why_en: 'Example for trying things out: choose an article about AI or software that interests you.',
      tip_de: 'Lies die Überschrift und den ersten Absatz, dann den Rest ohne Wörterbuch.',
      tip_en: 'Read the headline and the first paragraph, then the rest without a dictionary.',
      words: [
        { en: 'launch', de: 'einführen, starten' },
        { en: 'regulation', de: 'Regulierung' },
        { en: 'breakthrough', de: 'Durchbruch' },
        { en: 'concern', de: 'Bedenken, Sorge' },
        { en: 'rely on', de: 'sich verlassen auf' },
      ],
    },
  ];
}

/** Beiträge des Tages nach dem Setzen: eigene Beiträge (vom Tagesauftrag) bleiben, Beispiele werden ersetzt. */
export function mergeSampleInput(existing: readonly InputItem[]): InputItem[] {
  return [...existing.filter((it) => !it.id.startsWith(TEST_INPUT_PREFIX)), ...sampleInput()];
}

// ── Heute zurücksetzen und Karten fällig machen ─────────────────────────────────────────────────

/** Tageswerte auf null: Tagesteile, Kern und Zähler. Die Blitzrunde und die KI-Zählung bleiben stehen. */
export function resetDayRec(rec: DayRec | undefined): DayRec {
  return { ...(rec ?? {}), min: 0, ans: 0, ok: 0, nw: 0, kn: 0, core: 0, w: 0, g: 0, i: 0 };
}

/** Bis zu `n` Karten, die als Nächstes dran wären, jetzt fällig machen (neue Karten bleiben unberührt). */
export function dueUp(cards: ReadonlyMap<string, CardRec>, nowMs: number, n = 25): Array<[string, CardRec]> {
  return [...cards]
    .filter(([, c]) => c.f.state !== 0 && c.f.due > nowMs)
    .sort((a, b) => a[1].f.due - b[1].f.due || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([id, c], i): [string, CardRec] => [id, { ...c, f: { ...c.f, due: nowMs - (i + 1) * 60_000 } }]);
}
