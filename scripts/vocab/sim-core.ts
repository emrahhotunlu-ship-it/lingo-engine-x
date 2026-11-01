// Vokabeln V0: Kern der 60-Tage-Simulation. Rein, deterministisch (fester Startwert), ohne echte Daten.
//
// Der Kern kennt nur den erfundenen LERNER und die MESSUNG. Den Planer bringt ein Adapter mit (`PlannerAdapter`):
// `adapter-current.ts` ruft die heutige Logik der App auf (importiert), Paket V1 schreibt `adapter-v1.ts` für den neuen Planer.
// So läuft dieselbe Messung vorher und nachher (Emrahs Abnahmekriterium 1).

/** `meaning` = Bedeutung frei nennen (rezeptiv), `transfer` = Schreibaufgabe mit mehreren Lexemen (2–4 Min.). */
export type InputKind = 'choice' | 'typed' | 'hint' | 'sentence' | 'meaning' | 'transfer';
export type Verdict = 'correct' | 'near' | 'wrong';

/** Eine Aufgabe, die der Planer stellt. `step` = Lernschritt (Tag 0 oder Wiedervorlage nach Fehler am selben Tag). */
/** V2: `cue` = an der Lücke steht die deutsche Bedeutung („Gesucht: …“, M25); nur gemeldet, der Lerner wertet es (noch) nicht. */
export type Task = { lexeme: string; ex: string; input: InputKind; stage: number; step: boolean; intro?: boolean; sentence?: string; group?: string[]; due?: boolean; cue?: boolean };
/** Seit V1: Arten der Runde. `extra` = freiwillige Runde, `evening` = Abend-Check, `week` = Wochen-Check, `word` = „Dieses Wort üben“. */
export type SimKind = 'pflicht' | 'extra' | 'evening' | 'week' | 'word';
/** Beleg aus einem anderen Bereich (C1-Aufgabe), V1: `reportEvidence`. */
export type SimEvidence = { lexeme: string; kind: 'recalled' | 'used'; typed: boolean; cued: boolean; ok: boolean; t: number };
/** Ein erfundener Altbestand für Szenario D (Start mit Rückstand), im Format der alten Karten (`vocab/<id>`). */
export type LegacyDoc = Record<string, unknown>;
export type Outcome = { verdict: Verdict; submitMs: number; firstKeyMs: number; chars: number };

export type SimWord = { id: string; word: string; pos: 'noun' | 'verb' | 'adjective'; de: string; def: string; ex: string; src: string; added: string; order: number };

export interface PlannerSession {
  /** Nächste Aufgabe oder `null`, wenn die Runde zu Ende ist. */
  next(nowMs: number): Task | null;
  /** Ergebnis der zuletzt gestellten Aufgabe (bei `intro` ohne Ergebnis aufrufen). */
  answer(task: Task, outcome: Outcome | null, nowMs: number, group?: Outcome[]): { planned: boolean } | void;
}

export interface PlannerAdapter {
  name: string;
  /** Neuer Zustand aus den erfundenen Wörtern (alle neu). */
  init(words: readonly SimWord[], nowMs: number, legacy?: readonly LegacyDoc[]): void;
  /** Pflichtrunde des Tages (Tagesplan), freiwillige Extra-Runde und die Nebenwege. `word` übt `target`. */
  session(kind: SimKind, nowMs: number, target?: string): PlannerSession;
  /** Beleg aus einem anderen Bereich; liefert, ob er den Plan verändert hat. */
  evidence?(e: SimEvidence): { planned: boolean };
  /** Erwartete Minuten an den nächsten `n` Lerntagen (Index 0 = morgen). Fehlt sie, rechnet der Kern Lexeme × mittlere Abfragezeit. */
  forecastMinutes?(nowMs: number, n: number): number[];
  /** Wie oft wurde ein Lexem höchstens wegen Rückstand verschoben? */
  moved?(): number;
  /** Fällige Lexeme, die schon vor dem heutigen Lerntag fällig waren. */
  overdue(nowMs: number): number;
  /** Wie viele Lexeme an den nächsten `n` Lerntagen fällig werden (Index 0 = morgen). */
  forecast(nowMs: number, n: number): number[];
}

// ------------------------------------------------------------------ Zufall (mulberry32)
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ Erfundene Wörter
const SYL = ['bra', 'cen', 'dor', 'fal', 'gri', 'hep', 'jun', 'kel', 'lom', 'mav', 'nor', 'pel', 'quin', 'ros', 'sul', 'tav', 'ven', 'wim', 'zar', 'trel'];
/** Kunstwörter (keine echten Wörter, keine Inhalte), mit einem Satz, der das Wort enthält. */
export function makeWords(n: number, seed: number): SimWord[] {
  const r = rng(seed);
  const out: SimWord[] = [];
  const used = new Set<string>();
  const pick = () => SYL[Math.floor(r() * SYL.length)] as string;
  for (let i = 0; out.length < n; i++) {
    const w = pick() + pick() + (r() < 0.5 ? pick() : '');
    if (used.has(w)) continue;
    used.add(w);
    const pos = (['noun', 'verb', 'adjective'] as const)[i % 3] as SimWord['pos'];
    const ex =
      pos === 'noun' ? `The ${w} was ready before the meeting on Monday.` : pos === 'verb' ? `We need to ${w} the plan before Friday.` : `It was a very ${w} decision for the whole team.`;
    out.push({ id: `sim-${String(out.length + 1).padStart(3, '0')}`, word: w, pos, de: `Kunstwort ${out.length + 1}`, def: `made-up meaning ${out.length + 1}`, ex, src: out.length % 4 === 0 ? 'lookup' : 'pack', added: '2026-11-01', order: 900 + out.length });
  }
  return out;
}

// ------------------------------------------------------------------ Erfundener Lerner
// Wahres Gedächtnis je Lexem, unabhängig vom Planer, mit ZWEI Spuren (Prüfung learning-scientist V0, Befund 11):
//  - rezeptiv (Bedeutung erkennen/nennen) und produktiv (Form selbst bilden); die produktive startet niedriger.
//  - Potenzkurve R = (1 + t / (9·S))^-1 (bei t = S ist R = 0,9).
//  - Freier Abruf der Form stärkt beide Spuren, Bedeutungsabruf und Auswahl nur die rezeptive (Testeffekt; rezeptiv ≠ produktiv).
//  - Zuwachs steigt mit sinkendem R bis R = 0,7 (erwünschte Erschwernis), über 0,9 gedämpft (Abruf, der zu leicht war, bringt wenig).
//  - Satzbindung: Im Ankersatz (erster gesehener Satz) gelingt der Abruf leichter, in neuen Sätzen schwerer; die Bindung sinkt mit der
//    Zahl verschiedener Sätze. Wirkt nur, wenn der Adapter den Satz meldet (`Task.sentence`); sonst neutral.
//  - Zeit je Form: Auswahl 3–7 s, Tippen 6–12 s, Bedeutung 6–10 s, Satz 45–90 s, Transfer 120–240 s.
// Alle Zahlen sind Annahmen (keine Messwerte); sie gelten für heutigen und neuen Planer gleich.
type Trace = { S: number; t: number };
type Mem = { r: Trace; p: Trace; d: number; seen: boolean; anchor: string | null; sentences: Set<string> };
const DAY = 86_400_000;
const recall = (tr: Trace, now: number): number => 1 / (1 + Math.max(0, now - tr.t) / DAY / (9 * tr.S));
// V2: Empfindlichkeitslauf `VOCAB_BIND=0|0.06|0.12` (learning-scientist V2 Befund 12); Standard wie V0/V1.
const BIND = Number(process.env.VOCAB_BIND ?? 0.12);

export class Learner {
  private mem = new Map<string, Mem>();
  constructor(private r: () => number) {}
  private get(id: string): Mem {
    let m = this.mem.get(id);
    if (!m) {
      m = { r: { S: 0.05, t: 0 }, p: { S: 0.03, t: 0 }, d: 0.15 + 0.7 * this.r(), seen: false, anchor: null, sentences: new Set() };
      this.mem.set(id, m);
    }
    return m;
  }
  intro(id: string, now: number): void {
    const m = this.get(id);
    m.seen = true;
    m.r = { S: Math.max(m.r.S, 0.3 * (1.2 - 0.5 * m.d)), t: now };
    m.p = { S: Math.max(m.p.S, 0.12 * (1.2 - 0.5 * m.d)), t: now };
  }
  private grow(tr: Trace, R: number, w: number, d: number, now: number, floor: number): Trace {
    const f = Math.min(1, (1 - R) / 0.3) * (R > 0.9 ? 0.5 : 1);
    return { S: Math.max(tr.S * (1 + w * 2.6 * (1 - 0.5 * d) * f + 0.03), floor), t: now };
  }
  attempt(task: Task, now: number): Outcome {
    const m = this.get(task.lexeme);
    if (!m.seen) this.intro(task.lexeme, now);
    const receptive = task.input === 'choice' || task.input === 'meaning';
    const Rr = recall(m.r, now);
    const Rp = recall(m.p, now);
    let R = receptive ? Rr : Rp;
    if (task.sentence) {
      if (!m.anchor) m.anchor = task.sentence;
      const bind = BIND / Math.max(1, m.sentences.size);
      R = Math.max(0, Math.min(1, R + (task.sentence === m.anchor ? bind : -bind)));
      m.sentences.add(task.sentence);
    }
    const p =
      task.input === 'choice' ? R + (1 - R) * 0.4 : task.input === 'hint' ? Math.min(1, R * 0.97 + 0.12) : task.input === 'sentence' || task.input === 'transfer' ? R * 0.9 : R * 0.97;
    const ok = this.r() < p;
    const near = ok && (task.input === 'typed' || task.input === 'hint') && this.r() < 0.05;
    const base = 0.8 * (1.2 - 0.5 * m.d);
    if (ok) {
      if (receptive) m.r = this.grow(m.r, Rr, task.input === 'choice' ? 0.35 : 1, m.d, now, task.input === 'choice' ? m.r.S : base);
      else {
        const w = task.input === 'hint' ? 0.7 : 1;
        m.p = this.grow(m.p, Rp, w, m.d, now, w >= 1 ? base * 0.8 : m.p.S);
        m.r = this.grow(m.r, Rr, 0.6 * w, m.d, now, m.r.S);
      }
    } else {
      // Fehler: die gezeigte Lösung frischt auf, die Stabilität sinkt.
      if (receptive) m.r = { S: Math.max(0.12, m.r.S * 0.4), t: now };
      else {
        m.p = { S: Math.max(0.08, m.p.S * 0.4), t: now };
        m.r = { S: Math.max(0.12, m.r.S * 0.8), t: now };
      }
    }
    const fk = 1500 + 4000 * (1 - R) + 1500 * this.r();
    const chars = 9;
    const submitMs =
      task.input === 'choice'
        ? 2500 + 3000 * (1 - R) + 1500 * this.r()
        : task.input === 'meaning'
          ? 4000 + 4000 * (1 - R) + 2000 * this.r()
          : task.input === 'sentence'
            ? 45_000 + 45_000 * this.r()
            : task.input === 'transfer'
              ? 120_000 + 120_000 * this.r()
              : fk + 250 * chars + 2000 * this.r();
    return { verdict: ok ? (near ? 'near' : 'correct') : 'wrong', submitMs: Math.round(submitMs), firstKeyMs: Math.round(fk), chars };
  }
  /** Wahre Abrufwahrscheinlichkeit der produktiven Spur (für Behaltensquote und Ertrag). */
  truth(id: string, now: number): number {
    const m = this.get(id);
    return m.seen ? recall(m.p, now) : 0;
  }
  /** Szenario D: ein schon gelerntes Lexem mit wahren Stabilitäten (Tage) und letzter Abfrage `t`. */
  preset(id: string, rS: number, pS: number, t: number): void {
    const m = this.get(id);
    m.seen = true;
    m.r = { S: rS, t };
    m.p = { S: pS, t };
  }
  /** Lexeme mit wahrer produktiver Abrufwahrscheinlichkeit ≥ `min` zum Zeitpunkt `at` (ohne weiteres Üben). */
  countAbove(at: number, min: number): number {
    let n = 0;
    for (const m of this.mem.values()) if (m.seen && recall(m.p, at) >= min) n++;
    return n;
  }
  /**
   * V2: wie `countAbove`, aber in einem NEUEN Satz (Emrahs Ziel: das Wort außerhalb des gewohnten Satzes benutzen). Die Satzbindung des
   * Lerners (oben) gibt im Ankersatz einen Vorteil und in neuen Sätzen einen gleich großen Nachteil, der mit der Zahl verschiedener gesehener
   * Sätze sinkt; hier wird der Nachteil abgezogen. Wörter ohne gesehenen Satz (nur ohne Satz geübt) haben keine Bindung.
   */
  countAboveNew(at: number, min: number): number {
    let n = 0;
    for (const m of this.mem.values()) if (m.seen && recall(m.p, at) - (m.anchor ? BIND / Math.max(1, m.sentences.size) : 0) >= min) n++;
    return n;
  }
}

// ------------------------------------------------------------------ Szenarien
// V1 (plan.md §10, Zeile V1): Die Nebenwege laufen mit, damit die Messung fair ist (V0 hatte sie nicht simuliert):
//  - `evening` Abend-Check (heute eingeführte Wörter, getippt), `word` „Dieses Wort üben“ (ein heute gesehenes Wort), `week` Wochen-Check
//    (jeden 7. Lerntag), `evidence` eine C1-Aufgabe mit Wortbeleg (die Hälfte mit vorgegebenem Wort, `cued`).
//  - Szenario D startet aus einem erfundenen Altbestand (250 Wörter, ≈ 112 überfällig wie bei Emrah) – der neue Planer bekommt ihn über die Umrechnung.
export type Scenario = {
  key: string;
  name: string;
  extraProb: number;
  pause: readonly [number, number] | null;
  side?: { evening: number; word: number; weekEvery: number; evidence: number };
  legacy?: boolean;
};
const SIDE = { evening: 0.3, word: 0.25, weekEvery: 7, evidence: 0.3 };
export const SCENARIOS: readonly Scenario[] = [
  { key: 'A', name: 'jeden Tag nur die Pflichtrunde', extraProb: 0, pause: null },
  { key: 'B', name: 'Pflicht, Extra-Runden (≈ jeder 2. Tag) und alle Nebenwege', extraProb: 0.5, pause: null, side: SIDE },
  { key: 'C', name: 'wie B, aber 7 Tage Pause (Tag 31–37)', extraProb: 0.5, pause: [31, 37], side: SIDE },
  { key: 'D', name: 'wie B, Start mit Altbestand (250 Wörter, ≈ 112 überfällig)', extraProb: 0.5, pause: null, side: SIDE, legacy: true },
];

type Q = { day: number; lexeme: string; input: InputKind; stage: number; step: boolean; ok: boolean; firstOfDay: boolean; dueTruth: number; planned: boolean; noSentence: boolean; kind: SimKind; due: boolean };
export type DayRow = {
  day: number;
  studied: boolean;
  queries: number;
  distinct: number;
  multi: number;
  multiNoStep: number;
  multiOwn: number;
  choice: number;
  typed: number;
  overdue: number;
  minutes: number;
  dutyMinutes: number;
  transfer: number;
  stage4: boolean;
  afterExtra: boolean;
};
export type ScenarioResult = {
  scenario: Scenario;
  rows: DayRow[];
  summary: {
    queries: number;
    perDayMean: number;
    cvAll: number;
    cvStudy: number;
    cvMinutesStudy: number;
    cvDutyStudy: number;
    cvDutySteady: number;
    dutyMean: number;
    dutyAfterExtra: number;
    dutyWithin120: number;
    yield60: number;
    yield90: number;
    yieldPerHour: number;
    durablePerHour: number;
    yield60New: number;
    yield90New: number;
    learnHours: number;
    forecastPeak: number;
    forecastPeakMin: number;
    wordDays: number;
    multiDays: number;
    multiShare: number;
    multiNoStep: number;
    multiOwn: number;
    choiceShare: number;
    choiceOutsideSteps: number;
    activeShareStage3: number;
    cappedShareStage3: number;
    noSentenceStage4: number;
    transferDays: number;
    introduced: number;
    gapMedian: number;
    gapP90: number;
    gapMax: number;
    gapsOver14: number;
    weakGapsOver14: number;
    overdueEnd: number;
    overdueMaxAge: number;
    backlogDays: number;
    movedMax: number;
    forecast14: number[];
    forecast14Min: number[];
    retention: number;
    newDaysBelow2: number;
  };
};

const START = Date.UTC(2026, 10, 2, 18, 0, 0); // 2.11.2026, 19:00 Berlin
const mean = (a: readonly number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const cv = (a: readonly number[]) => {
  const m = mean(a);
  if (!m) return 0;
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2))) / m;
};
const quant = (a: readonly number[], q: number) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))] as number;
};
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Erfundener Altbestand für Szenario D: 250 Wörter, eingeführt in den 45 Tagen vor dem Start, ≈ 45 % überfällig. Kein echtes Datum, kein echtes Wort. */
export function makeLegacy(words: readonly SimWord[], seed: number, now: number): { docs: LegacyDoc[]; truth: { id: string; rS: number; pS: number; t: number }[] } {
  const r = rng(seed + 7);
  const docs: LegacyDoc[] = [];
  const truth: { id: string; rS: number; pS: number; t: number }[] = [];
  for (const w of words.slice(0, 250)) {
    const introAgo = 2 + Math.floor(r() * 44);
    const S = Math.max(0.5, Math.round(Math.exp(Math.log(6.8) + (r() - 0.5) * 2.4) * 100) / 100);
    const D = Math.round((3 + r() * 5) * 100) / 100;
    const lastAgo = Math.min(introAgo, Math.floor(r() * Math.min(introAgo, 30)));
    const last = now - lastAgo * DAY - 3_600_000;
    // ≈ 112 von 250 überfällig: Termin = letzte Abfrage + S, bei einem Teil um einige Tage überzogen.
    const overdue = r() < 0.45;
    const due = overdue ? now - (1 + Math.floor(r() * 20)) * DAY : last + Math.max(1, Math.round(S)) * DAY + DAY;
    const stage = S >= 21 ? 5 : S >= 7 ? 4 : S >= 3 ? 3 : r() < 0.5 ? 2 : 1;
    const reps = 2 + Math.floor(r() * 8);
    const lapses = Math.floor(r() * 3);
    const introDay = new Date(now - introAgo * DAY).toISOString().slice(0, 10);
    const hist = r() < 0.5 ? [] : Array.from({ length: 3 }, (_, k) => ({ t: last - (2 - k) * 2 * DAY, g: 3, x: 'cloze' }));
    docs.push({
      id: w.id, word: w.word, pos: w.pos, de: w.de, def: w.def, ex: w.ex, level: 'C1', src: w.src, order: w.order, col: [], added: w.added, intro: introDay,
      state: 'review', stage, S, D, due, last, reps, lapses, hist,
      fsrs: { v: 1, due, stability: S, difficulty: D, state: 2, reps, lapses, last, scheduledDays: Math.max(1, Math.round((due - last) / DAY)), learningSteps: 0, src: 'lx' },
    });
    truth.push({ id: w.id, rS: S * (0.7 + 0.6 * r()), pS: S * (0.35 + 0.4 * r()), t: last });
  }
  return { docs, truth };
}

export type RunOpts = { dutyCapMin?: number };
export function runScenario(adapter: PlannerAdapter, sc: Scenario, days: number, seed: number, opts: RunOpts = {}): ScenarioResult {
  // D braucht neben dem Altbestand (250) genug neue Wörter für 60 Tage.
  const words = makeWords(sc.legacy ? 650 : 400, seed);
  const learner = new Learner(rng(seed + 1));
  const habit = rng(seed + 2);
  const side = rng(seed + 3);
  const introducedDay = new Map<string, number>();
  if (sc.legacy) {
    const leg = makeLegacy(words, seed, START - DAY);
    for (const t of leg.truth) {
      learner.preset(t.id, t.rS, t.pS, t.t);
      introducedDay.set(t.id, 0);
    }
    adapter.init(words, START - DAY, leg.docs);
  } else adapter.init(words, START - DAY);
  const qs: Q[] = [];
  const rows: DayRow[] = [];
  let lastExtraDay = -1;
  let studyNo = 0;
  for (let d = 1; d <= days; d++) {
    const dayStart = START + (d - 1) * DAY;
    const studied = !(sc.pause && d >= sc.pause[0] && d <= sc.pause[1]);
    let now = dayStart;
    let ms = 0;
    let dutyMs = 0;
    let transfer = 0;
    const seenToday = new Set<string>();
    const errToday = new Set<string>();
    const dayQs: Q[] = [];
    const ask = (t: Task, kind: SimKind): { o: Outcome; group?: Outcome[] } => {
      if (!introducedDay.has(t.lexeme)) introducedDay.set(t.lexeme, d);
      const lexemes = t.group ?? [t.lexeme];
      const outs: Outcome[] = [];
      for (const id of lexemes) {
        const truth = learner.truth(id, now);
        const o = learner.attempt(id === t.lexeme ? t : { ...t, lexeme: id }, now);
        outs.push(o);
        const step = introducedDay.get(id) === d || errToday.has(id);
        dayQs.push({ day: d, lexeme: id, input: t.input, stage: t.stage, step, ok: o.verdict !== 'wrong', firstOfDay: !seenToday.has(id), dueTruth: truth, planned: true, noSentence: t.input !== 'choice' && !t.sentence, kind, due: t.due !== false && id === t.lexeme });
        seenToday.add(id);
        if (o.verdict === 'wrong') errToday.add(id);
      }
      return { o: outs[0] as Outcome, group: t.group ? outs : undefined };
    };
    const run = (kind: SimKind, target?: string) => {
      const s = adapter.session(kind, now, target);
      const before = ms;
      for (let guard = 0; guard < 400; guard++) {
        // V2: Vergleich bei gleicher Pflichtzeit (Emrahs Lesart 01.11.2026): Pflicht endet nach `dutyCapMin` Minuten, für jeden Planer gleich.
        if (kind === 'pflicht' && opts.dutyCapMin && ms - before >= opts.dutyCapMin * 60_000) break;
        const t = s.next(now);
        if (!t) break;
        if (t.intro) {
          learner.intro(t.lexeme, now);
          if (!introducedDay.has(t.lexeme)) introducedDay.set(t.lexeme, d);
          s.answer(t, null, now);
          now += 20_000;
          ms += 20_000;
          continue;
        }
        const n0 = dayQs.length;
        const { o, group } = ask(t, kind);
        if (t.input === 'transfer') transfer++;
        const res = s.answer(t, o, now, group);
        if (res && res.planned === false) for (let k = n0; k < dayQs.length; k++) (dayQs[k] as Q).planned = false;
        const dur = o.submitMs + 5000;
        now += dur;
        ms += dur;
      }
      if (kind === 'pflicht') dutyMs += ms - before;
    };
    let extraToday = false;
    if (studied) {
      studyNo++;
      run('pflicht');
      if (habit() < sc.extraProb) {
        now += 30 * 60_000;
        run('extra');
        extraToday = true;
      }
      if (sc.side) {
        if (side() < sc.side.evidence && adapter.evidence) {
          const pool = [...introducedDay.keys()].filter((id) => introducedDay.get(id)! < d);
          if (pool.length) {
            const id = pool[Math.floor(side() * pool.length)] as string;
            const cued = side() < 0.5;
            const o = learner.attempt({ lexeme: id, ex: 'c1x', input: 'typed', stage: 0, step: false }, now);
            adapter.evidence({ lexeme: id, kind: 'used', typed: true, cued, ok: o.verdict !== 'wrong', t: now });
          }
        }
        if (side() < sc.side.evening) {
          now += 3 * 3_600_000;
          run('evening');
        }
        if (side() < sc.side.word && seenToday.size) {
          const list = [...seenToday].sort();
          now += 10 * 60_000;
          run('word', list[Math.floor(side() * list.length)]);
        }
        if (studyNo % sc.side.weekEvery === 0) {
          now += 10 * 60_000;
          run('week');
        }
      }
    } else habit();
    qs.push(...dayQs);
    const per = new Map<string, Q[]>();
    for (const q of dayQs) per.set(q.lexeme, [...(per.get(q.lexeme) ?? []), q]);
    const multi = [...per.values()].filter((l) => l.length > 1);
    rows.push({
      day: d,
      studied,
      queries: dayQs.length,
      distinct: per.size,
      multi: multi.length,
      // Mehrfach DURCH DEN PLANER: eine weitere Abfrage desselben Tages mit Planwirkung, die kein Lernschritt ist (Kern entscheidet).
      multiNoStep: multi.filter((l) => l.slice(1).some((q) => !q.step && q.planned)).length,
      // Mehrfach nur durch eigenen Start, ohne Planwirkung (getrennt berichtet, plan.md §1).
      multiOwn: multi.filter((l) => l.slice(1).some((q) => !q.step && !q.planned) && !l.slice(1).some((q) => !q.step && q.planned)).length,
      choice: dayQs.filter((q) => q.input === 'choice').length,
      typed: dayQs.filter((q) => q.input !== 'choice').length,
      overdue: adapter.overdue(dayStart + 20 * 3_600_000),
      minutes: Math.round(ms / 60_000),
      dutyMinutes: Math.round(dutyMs / 6_000) / 10,
      transfer,
      stage4: dayQs.some((q) => q.stage >= 4),
      afterExtra: lastExtraDay === d - 1,
    });
    if (extraToday) lastExtraDay = d;
  }
  const daysOf = new Map<string, number[]>();
  const stageOn = new Map<string, number>();
  for (const q of qs) {
    const l = daysOf.get(q.lexeme) ?? [];
    if (l.at(-1) !== q.day) {
      l.push(q.day);
      stageOn.set(`${q.lexeme}|${q.day}`, q.stage);
    }
    daysOf.set(q.lexeme, l);
  }
  const gaps: number[] = [];
  let weakGapsOver14 = 0;
  for (const [id, l] of daysOf) {
    for (let i = 1; i < l.length; i++) {
      const g = (l[i] as number) - (l[i - 1] as number);
      gaps.push(g);
      if (g > 14 && (stageOn.get(`${id}|${l[i] as number}`) ?? 0) <= 2) weakGapsOver14++;
    }
  }
  const end = START + (days - 1) * DAY + 20 * 3_600_000;
  const overdueMaxAge = Math.max(0, ...[...daysOf.values()].map((l) => days - (l.at(-1) as number)));
  const wordDays = rows.reduce((a, r) => a + r.distinct, 0);
  const multiDays = rows.reduce((a, r) => a + r.multi, 0);
  const st3 = qs.filter((q) => q.stage >= 3);
  // Abrufe EINES Lexems (Anwenden mit mehreren Lexemen ist eine eigene Aufgabe und zählt hier nicht, M27).
  const st4 = qs.filter((q) => q.stage >= 4 && q.input !== 'choice' && q.input !== 'meaning' && q.input !== 'transfer' && !q.step);
  // Echte Behaltensrate (learning-scientist V1, Befund 4): nur erste Abfrage des Tages, kein Lernschritt, FÄLLIG und planwirksam.
  const reviewsFirst = qs.filter((q) => q.firstOfDay && !q.step && q.due && q.planned && (q.kind === 'pflicht' || q.kind === 'extra'));
  const studyRows = rows.filter((r) => r.studied);
  const fc = adapter.forecast(end, 14);
  const minPerQ = qs.length ? rows.reduce((a, r) => a + r.minutes, 0) / qs.length : 0;
  const fcMin = adapter.forecastMinutes ? adapter.forecastMinutes(end, 14) : fc.map((n) => Math.round(n * minPerQ * 10) / 10);
  const peak = mean(fc) ? r2(Math.max(...fc) / mean(fc)) : 0;
  const peakMin = mean(fcMin) ? r2(Math.max(...fcMin) / mean(fcMin)) : 0;
  // Rückstand: Lerntage bis „überfällig“ wieder auf dem Stand vor der Pause (C) bzw. ≤ 5 (D); 0 = kein Rückstand.
  let backlogDays = 0;
  if (sc.pause || sc.legacy) {
    const from = sc.pause ? sc.pause[1] + 1 : 1;
    const base = sc.pause ? Math.max(5, rows[sc.pause[0] - 2]?.overdue ?? 0) : 5;
    const idx = rows.findIndex((r) => r.day >= from && r.overdue <= base);
    backlogDays = idx < 0 ? days : (rows[idx] as DayRow).day - from + 1;
  }
  const dutyMean = mean(studyRows.map((r) => r.dutyMinutes));
  const after = studyRows.filter((r) => r.afterExtra);
  const days4 = studyRows.filter((r) => r.stage4);
  return {
    scenario: sc,
    rows,
    summary: {
      queries: qs.length,
      perDayMean: Math.round(mean(rows.map((r) => r.queries)) * 10) / 10,
      cvAll: r2(cv(rows.map((r) => r.queries))),
      cvStudy: r2(cv(studyRows.map((r) => r.queries))),
      cvMinutesStudy: r2(cv(studyRows.map((r) => r.minutes))),
      cvDutyStudy: r2(cv(studyRows.map((r) => r.dutyMinutes))),
      // Nach dem Einlaufen (ab Tag 15) und, bei Pause, nach dem Abbau (ab 8 Lerntage nach der Pause).
      cvDutySteady: r2(cv(studyRows.filter((r) => r.day >= 15 && (!sc.pause || r.day < sc.pause[0] || r.day > sc.pause[1] + 7)).map((r) => r.dutyMinutes))),
      dutyMean: Math.round(dutyMean * 10) / 10,
      dutyAfterExtra: Math.round(mean(after.map((r) => r.dutyMinutes)) * 10) / 10,
      dutyWithin120: studyRows.length ? Math.round((studyRows.filter((r) => r.dutyMinutes <= 1.2 * Math.max(15, dutyMean)).length / studyRows.length) * 1000) / 10 : 0,
      yield60: learner.countAbove(end, 0.9),
      yield90: learner.countAbove(end + 30 * DAY, 0.7),
      yieldPerHour: Math.round((learner.countAbove(end, 0.9) / Math.max(1, rows.reduce((a, r) => a + r.minutes, 0) / 60)) * 10) / 10,
      durablePerHour: Math.round((learner.countAbove(end + 30 * DAY, 0.7) / Math.max(1, rows.reduce((a, r) => a + r.minutes, 0) / 60)) * 10) / 10,
      yield60New: learner.countAboveNew(end, 0.9),
      yield90New: learner.countAboveNew(end + 30 * DAY, 0.7),
      learnHours: Math.round((rows.reduce((a, r) => a + r.minutes, 0) / 60) * 10) / 10,
      forecastPeak: peak,
      forecastPeakMin: peakMin,
      wordDays,
      multiDays,
      multiShare: wordDays ? Math.round((multiDays / wordDays) * 1000) / 10 : 0,
      multiNoStep: rows.reduce((a, r) => a + r.multiNoStep, 0),
      multiOwn: rows.reduce((a, r) => a + r.multiOwn, 0),
      choiceShare: qs.length ? Math.round((qs.filter((q) => q.input === 'choice').length / qs.length) * 1000) / 10 : 0,
      choiceOutsideSteps: qs.length ? Math.round((qs.filter((q) => q.input === 'choice' && !q.step).length / qs.length) * 1000) / 10 : 0,
      // V2: Anteil der Abfragen mit Stütze („höchstens Hard“, Eingabe `hint`) ab Stufe 3 außerhalb der Lernschritte (Ziel ≤ 20 %).
      cappedShareStage3: st3.filter((q) => !q.step).length ? Math.round((st3.filter((q) => !q.step && q.input === 'hint').length / st3.filter((q) => !q.step).length) * 1000) / 10 : 0,
      activeShareStage3: st3.length ? Math.round((st3.filter((q) => q.input !== 'choice').length / st3.length) * 1000) / 10 : 0,
      noSentenceStage4: st4.length ? Math.round((st4.filter((q) => q.noSentence).length / st4.length) * 1000) / 10 : 0,
      transferDays: days4.length ? Math.round((days4.filter((r) => r.transfer > 0).length / days4.length) * 1000) / 10 : 0,
      introduced: [...introducedDay.values()].filter((x) => x > 0).length,
      gapMedian: quant(gaps, 0.5),
      gapP90: quant(gaps, 0.9),
      gapMax: Math.max(0, ...gaps),
      gapsOver14: gaps.filter((g) => g > 14).length,
      weakGapsOver14,
      overdueEnd: adapter.overdue(end),
      overdueMaxAge,
      backlogDays,
      movedMax: adapter.moved ? adapter.moved() : 0,
      forecast14: fc,
      forecast14Min: fcMin,
      retention: reviewsFirst.length ? Math.round((reviewsFirst.filter((q) => q.ok).length / reviewsFirst.length) * 1000) / 10 : 0,
      newDaysBelow2: studyRows.filter((r) => [...introducedDay.values()].filter((x) => x === r.day).length < 2).length,
    },
  };
}

export type RunResult = { adapter: string; days: number; seed: number; results: ScenarioResult[]; seeds: number[]; spread: Record<string, ScenarioResult['summary'][]> };

export function runAll(adapter: PlannerAdapter, o: { days: number; seed: number; seeds?: number; only?: string[]; dutyCapMin?: number }): RunResult {
  // Abgenommen wird der SCHLECHTESTE Wert über 5 Startwerte (Prüfung learning-scientist V0, Befund 9); die Haupttabelle zeigt den ersten.
  const seeds = Array.from({ length: Math.max(1, o.seeds ?? 5) }, (_, i) => o.seed + i);
  const scs = SCENARIOS.filter((x) => !o.only || o.only.includes(x.key));
  const ro: RunOpts = o.dutyCapMin ? { dutyCapMin: o.dutyCapMin } : {};
  const results = scs.map((sc) => runScenario(adapter, sc, o.days, o.seed, ro));
  const spread: Record<string, ScenarioResult['summary'][]> = {};
  for (const sc of scs) spread[sc.key] = [results.find((r) => r.scenario.key === sc.key)!.summary, ...seeds.slice(1).map((sd) => runScenario(adapter, sc, o.days, sd, ro).summary)];
  return { adapter: adapter.name, days: o.days, seed: o.seed, results, seeds, spread };
}

export function toJson(r: RunResult) {
  return { adapter: r.adapter, days: r.days, seed: r.seed, seeds: r.seeds, spread: r.spread, results: r.results.map((x) => ({ scenario: x.scenario, summary: x.summary, rows: x.rows })) };
}

export function toMarkdown(r: RunResult): string {
  const out: string[] = [];
  out.push(`Planer: **${r.adapter}** · ${r.days} Tage · Startwert ${r.seed} · 400 Kunstwörter · Lerner erfunden und deterministisch`, '');
  out.push('| Kennzahl | ' + r.results.map((x) => `${x.scenario.key}: ${x.scenario.name}`).join(' | ') + ' |');
  out.push('|---|' + r.results.map(() => '---').join('|') + '|');
  const row = (label: string, f: (s: ScenarioResult['summary']) => string | number) => out.push(`| ${label} | ` + r.results.map((x) => String(f(x.summary))).join(' | ') + ' |');
  row('Abfragen gesamt', (s) => s.queries);
  row('Abfragen je Tag (Mittel)', (s) => s.perDayMean);
  row('Variationskoeffizient Tageslast, alle Tage', (s) => s.cvAll);
  row('Variationskoeffizient Tageslast, nur Lerntage', (s) => s.cvStudy);
  row('Variationskoeffizient Tagesminuten, nur Lerntage', (s) => s.cvMinutesStudy);
  row('Variationskoeffizient **Pflicht**minuten, nur Lerntage', (s) => s.cvDutyStudy);
  row('… ab Tag 15 (nach dem Einlaufen; C: ohne Pause und 7 Abbau-Tage)', (s) => s.cvDutySteady);
  row('Pflichtminuten: Mittel / am Tag nach einer Extra-Runde', (s) => `${s.dutyMean} / ${s.dutyAfterExtra}`);
  row('Lerntage mit Pflicht ≤ Zielzeit + 20 %', (s) => `${s.dutyWithin120} %`);
  row('Wort-Tage (Wort mit ≥ 1 Abfrage an einem Tag)', (s) => s.wordDays);
  row('davon Wort mehrfach am selben Tag', (s) => `${s.multiDays} (${s.multiShare} %)`);
  row('davon mehrfach **durch den Planer** außerhalb der Lernschritte', (s) => s.multiNoStep);
  row('davon mehrfach nur durch eigenen Start, ohne Planwirkung', (s) => s.multiOwn);
  row('Anteil Auswahl an allen Abfragen / außerhalb der Lernschritte', (s) => `${s.choiceShare} % / ${s.choiceOutsideSteps} %`);
  row('Anteil aktiv (Tippen/Bilden) ab Stufe 3', (s) => `${s.activeShareStage3} %`);
  row('ohne Satz ab Stufe 4 (Benutzen-Abrufe)', (s) => `${s.noSentenceStage4} %`);
  row('Lerntage mit Anwenden (sobald Stufe 4 vorkommt)', (s) => `${s.transferDays} %`);
  row('eingeführte Wörter', (s) => s.introduced);
  row('Lerntage mit < 2 neuen Wörtern', (s) => s.newDaysBelow2);
  row('Lücke zwischen Abfragetagen: Median / 90 % / längste', (s) => `${s.gapMedian} / ${s.gapP90} / ${s.gapMax} Tage`);
  row('Lücken über 14 Tage', (s) => s.gapsOver14);
  row('davon bei Wörtern bis Stufe 2 (noch nicht sicher)', (s) => s.weakGapsOver14);
  row('überfällig am Ende', (s) => s.overdueEnd);
  row('Abbau Rückstand (Lerntage)', (s) => s.backlogDays);
  row('höchstens so oft verschoben (je Lexem)', (s) => s.movedMax);
  row('längste Zeit seit letzter Abfrage am Ende', (s) => `${s.overdueMaxAge} Tage`);
  row('fällig in den nächsten 14 Tagen (Lexeme)', (s) => s.forecast14.join(' · '));
  row('… in Minuten', (s) => s.forecast14Min.join(' · '));
  row('14-Tage-Vorschau: größter Tag ÷ Mittel (Lexeme / **Minuten**)', (s) => `${s.forecastPeak} / ${s.forecastPeakMin}`);
  row('echte Behaltensrate (erste fällige, planwirksame Abfrage des Tages)', (s) => `${s.retention} %`);
  row('Ertrag: Lexeme mit wahrem R(produktiv) ≥ 0,9 an Tag 60', (s) => s.yield60);
  row('Haltbarkeit: davon R ≥ 0,7 nach 30 Tagen ohne Üben', (s) => s.yield90);
  row('Ertrag je Lernstunde', (s) => s.yieldPerHour);
  row('Haltbarkeit je Lernstunde', (s) => s.durablePerHour);
  row('V2: Ertrag im NEUEN Satz (R − Satzbindung ≥ 0,9) an Tag 60', (s) => s.yield60New);
  row('V2: Haltbarkeit im NEUEN Satz (+30 Tage, ≥ 0,7)', (s) => s.yield90New);
  row('Lernzeit gesamt (Stunden)', (s) => s.learnHours);
  out.push('', `**Über ${r.seeds.length} Startwerte** (${r.seeds.join(', ')}): kleinster – größter Wert`, '');
  out.push('| Kennzahl | ' + r.results.map((x) => x.scenario.key).join(' | ') + ' |');
  out.push('|---|' + r.results.map(() => '---').join('|') + '|');
  const span = (label: string, f: (s: ScenarioResult['summary']) => number) =>
    out.push(`| ${label} | ` + r.results.map((x) => { const v = (r.spread[x.scenario.key] ?? []).map(f); return `${Math.min(...v)} – ${Math.max(...v)}`; }).join(' | ') + ' |');
  span('mehrfach durch den Planer außerhalb der Lernschritte', (s) => s.multiNoStep);
  span('mehrfach nur durch eigenen Start (ohne Planwirkung)', (s) => s.multiOwn);
  span('Variationskoeffizient Pflichtminuten', (s) => s.cvDutyStudy);
  span('Variationskoeffizient Pflichtminuten ab Tag 15', (s) => s.cvDutySteady);
  span('Variationskoeffizient Tagesminuten', (s) => s.cvMinutesStudy);
  span('Pflichtminuten am Tag nach Extra-Runde', (s) => s.dutyAfterExtra);
  span('14-Tage-Vorschau größter Tag ÷ Mittel (Minuten)', (s) => s.forecastPeakMin);
  span('überfällig am Ende', (s) => s.overdueEnd);
  span('Abbau Rückstand (Lerntage)', (s) => s.backlogDays);
  span('höchstens verschoben', (s) => s.movedMax);
  span('Anteil Auswahl außerhalb Lernschritte (%)', (s) => s.choiceOutsideSteps);
  span('ohne Satz ab Stufe 4 (%)', (s) => s.noSentenceStage4);
  span('Lerntage mit Anwenden (%)', (s) => s.transferDays);
  span('Lerntage mit < 2 neuen', (s) => s.newDaysBelow2);
  span('echte Behaltensrate (%)', (s) => s.retention);
  span('Ertrag Tag 60', (s) => s.yield60);
  span('Haltbarkeit +30 Tage', (s) => s.yield90);
  span('Ertrag je Lernstunde', (s) => s.yieldPerHour);
  span('Haltbarkeit je Lernstunde', (s) => s.durablePerHour);
  span('Haltbarkeit im neuen Satz +30 Tage', (s) => s.yield90New);
  span('Lernzeit gesamt (Stunden)', (s) => s.learnHours);
  span('Anteil aktiv ab Stufe 3 (%)', (s) => s.activeShareStage3);
  span('Anteil mit Stütze (höchstens Hard) ab Stufe 3 (%)', (s) => s.cappedShareStage3);
  out.push('', '**Je Tag** (Abfragen · mehrfach · Auswahl · überfällig · Minuten):', '');
  for (const x of r.results) {
    out.push(`<details><summary>${x.scenario.key}: ${x.scenario.name}</summary>`, '', '| Tag | Abfragen | Wörter | mehrfach | durch Planer | eigener Start | Auswahl | getippt | überfällig | Min. | Pflicht-Min. | Anwenden |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const d of x.rows) out.push(`| ${d.day}${d.studied ? '' : ' (Pause)'} | ${d.queries} | ${d.distinct} | ${d.multi} | ${d.multiNoStep} | ${d.multiOwn} | ${d.choice} | ${d.typed} | ${d.overdue} | ${d.minutes} | ${d.dutyMinutes} | ${d.transfer} |`);
    out.push('', '</details>', '');
  }
  return out.join('\n');
}

/** Die Simulation ist „grün“, wenn sie vollständig durchläuft und plausible Werte liefert (keine Abnahme des Planers!). */
export function selfCheck(r: RunResult): string[] {
  const bad: string[] = [];
  for (const x of r.results) {
    if (x.rows.length !== r.days) bad.push(`${x.scenario.key}: ${x.rows.length} statt ${r.days} Tage`);
    if (x.summary.queries <= 0) bad.push(`${x.scenario.key}: keine Abfragen`);
    if (x.summary.introduced <= 0) bad.push(`${x.scenario.key}: keine neuen Wörter`);
  }
  return bad;
}
