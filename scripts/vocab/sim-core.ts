// Vokabeln V0: Kern der 60-Tage-Simulation. Rein, deterministisch (fester Startwert), ohne echte Daten.
//
// Der Kern kennt nur den erfundenen LERNER und die MESSUNG. Den Planer bringt ein Adapter mit (`PlannerAdapter`):
// `adapter-current.ts` ruft die heutige Logik der App auf (importiert), Paket V1 schreibt `adapter-v1.ts` für den neuen Planer.
// So läuft dieselbe Messung vorher und nachher (Emrahs Abnahmekriterium 1).

/** `meaning` = Bedeutung frei nennen (rezeptiv), `transfer` = Schreibaufgabe mit mehreren Lexemen (2–4 Min.). */
export type InputKind = 'choice' | 'typed' | 'hint' | 'sentence' | 'meaning' | 'transfer';
export type Verdict = 'correct' | 'near' | 'wrong';

/** Eine Aufgabe, die der Planer stellt. `step` = Lernschritt (Tag 0 oder Wiedervorlage nach Fehler am selben Tag). */
export type Task = { lexeme: string; ex: string; input: InputKind; stage: number; step: boolean; intro?: boolean; sentence?: string };
export type Outcome = { verdict: Verdict; submitMs: number; firstKeyMs: number; chars: number };

export type SimWord = { id: string; word: string; pos: 'noun' | 'verb' | 'adjective'; de: string; def: string; ex: string; src: string; added: string; order: number };

export interface PlannerSession {
  /** Nächste Aufgabe oder `null`, wenn die Runde zu Ende ist. */
  next(nowMs: number): Task | null;
  /** Ergebnis der zuletzt gestellten Aufgabe (bei `intro` ohne Ergebnis aufrufen). */
  answer(task: Task, outcome: Outcome | null, nowMs: number): void;
}

export interface PlannerAdapter {
  name: string;
  /** Neuer Zustand aus den erfundenen Wörtern (alle neu). */
  init(words: readonly SimWord[], nowMs: number): void;
  /** Pflichtrunde des Tages (Tagesplan) bzw. freiwillige Extra-Runde. */
  session(kind: 'pflicht' | 'extra', nowMs: number): PlannerSession;
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
const BIND = 0.12;

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
  /** Lexeme mit wahrer produktiver Abrufwahrscheinlichkeit ≥ `min` zum Zeitpunkt `at` (ohne weiteres Üben). */
  countAbove(at: number, min: number): number {
    let n = 0;
    for (const m of this.mem.values()) if (m.seen && recall(m.p, at) >= min) n++;
    return n;
  }
}

// ------------------------------------------------------------------ Szenarien
export type Scenario = { key: string; name: string; extraProb: number; pause: readonly [number, number] | null };
export const SCENARIOS: readonly Scenario[] = [
  { key: 'A', name: 'jeden Tag nur die Pflichtrunde', extraProb: 0, pause: null },
  { key: 'B', name: 'Pflicht jeden Tag, an etwa jedem zweiten Tag eine Extra-Runde', extraProb: 0.5, pause: null },
  { key: 'C', name: 'wie B, aber 7 Tage Pause (Tag 31–37)', extraProb: 0.5, pause: [31, 37] },
];

type Q = { day: number; lexeme: string; input: InputKind; stage: number; step: boolean; ok: boolean; firstOfDay: boolean; dueTruth: number };
export type DayRow = { day: number; studied: boolean; queries: number; distinct: number; multi: number; multiNoStep: number; choice: number; typed: number; overdue: number; minutes: number; dutyMinutes: number };
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
    yield60: number;
    yield90: number;
    yieldPerHour: number;
    forecastPeak: number;
    wordDays: number;
    multiDays: number;
    multiShare: number;
    multiNoStep: number;
    choiceShare: number;
    activeShareStage3: number;
    introduced: number;
    gapMedian: number;
    gapP90: number;
    gapMax: number;
    gapsOver14: number;
    weakGapsOver14: number;
    overdueEnd: number;
    overdueMaxAge: number;
    forecast14: number[];
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

export function runScenario(adapter: PlannerAdapter, sc: Scenario, days: number, seed: number): ScenarioResult {
  const words = makeWords(400, seed);
  const learner = new Learner(rng(seed + 1));
  const habit = rng(seed + 2);
  adapter.init(words, START - DAY);
  const qs: Q[] = [];
  const rows: DayRow[] = [];
  const introducedDay = new Map<string, number>();
  for (let d = 1; d <= days; d++) {
    const dayStart = START + (d - 1) * DAY;
    const studied = !(sc.pause && d >= sc.pause[0] && d <= sc.pause[1]);
    let now = dayStart;
    let ms = 0;
    let dutyMs = 0;
    const seenToday = new Set<string>();
    const errToday = new Set<string>();
    const dayQs: Q[] = [];
    const run = (kind: 'pflicht' | 'extra') => {
      const s = adapter.session(kind, now);
      const before = ms;
      for (let guard = 0; guard < 400; guard++) {
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
        if (!introducedDay.has(t.lexeme)) introducedDay.set(t.lexeme, d);
        const truth = learner.truth(t.lexeme, now);
        const o = learner.attempt(t, now);
        // Lernschritt laut Emrahs Auftrag: am Einführungstag oder nach einem Fehler am selben Tag (Neulernen). Allein der Kern entscheidet;
        // das Flag des Adapters (`t.step`) zählt nicht, sonst könnte ein Planer seine Mehrfachabfragen selbst zu Lernschritten erklären.
        const step = introducedDay.get(t.lexeme) === d || errToday.has(t.lexeme);
        const q: Q = { day: d, lexeme: t.lexeme, input: t.input, stage: t.stage, step, ok: o.verdict !== 'wrong', firstOfDay: !seenToday.has(t.lexeme), dueTruth: truth };
        seenToday.add(t.lexeme);
        if (o.verdict === 'wrong') errToday.add(t.lexeme);
        dayQs.push(q);
        s.answer(t, o, now);
        const dur = o.submitMs + 5000;
        now += dur;
        ms += dur;
      }
      if (kind === 'pflicht') dutyMs += ms - before;
    };
    if (studied) {
      run('pflicht');
      if (habit() < sc.extraProb) {
        now += 30 * 60_000;
        run('extra');
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
      multiNoStep: multi.filter((l) => l.slice(1).some((q) => !q.step)).length,
      choice: dayQs.filter((q) => q.input === 'choice').length,
      typed: dayQs.filter((q) => q.input !== 'choice').length,
      overdue: adapter.overdue(dayStart + 20 * 3_600_000),
      minutes: Math.round(ms / 60_000),
      dutyMinutes: Math.round(dutyMs / 6_000) / 10,
    });
  }
  // Lücken zwischen zwei Abfragetagen je Lexem
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
      // Stufe vor der Abfrage am Ende der Lücke ≤ 2: Das Wort war noch nicht sicher und trotzdem über 14 Tage weg.
      if (g > 14 && (stageOn.get(`${id}|${l[i] as number}`) ?? 0) <= 2) weakGapsOver14++;
    }
  }
  const end = START + (days - 1) * DAY + 20 * 3_600_000;
  const overdueMaxAge = Math.max(0, ...[...daysOf.values()].map((l) => days - (l.at(-1) as number)));
  const wordDays = rows.reduce((a, r) => a + r.distinct, 0);
  const multiDays = rows.reduce((a, r) => a + r.multi, 0);
  const st3 = qs.filter((q) => q.stage >= 3);
  const reviewsFirst = qs.filter((q) => q.firstOfDay && !q.step);
  const studyRows = rows.filter((r) => r.studied);
  const fc = adapter.forecast(end, 14);
  const peak = mean(fc) ? Math.round((Math.max(...fc) / mean(fc)) * 100) / 100 : 0;
  return {
    scenario: sc,
    rows,
    summary: {
      queries: qs.length,
      perDayMean: Math.round(mean(rows.map((r) => r.queries)) * 10) / 10,
      cvAll: Math.round(cv(rows.map((r) => r.queries)) * 100) / 100,
      cvStudy: Math.round(cv(studyRows.map((r) => r.queries)) * 100) / 100,
      cvMinutesStudy: Math.round(cv(studyRows.map((r) => r.minutes)) * 100) / 100,
      cvDutyStudy: Math.round(cv(studyRows.map((r) => r.dutyMinutes)) * 100) / 100,
      yield60: learner.countAbove(end, 0.9),
      yield90: learner.countAbove(end + 30 * DAY, 0.7),
      yieldPerHour: Math.round((learner.countAbove(end, 0.9) / Math.max(1, rows.reduce((a, r) => a + r.minutes, 0) / 60)) * 10) / 10,
      forecastPeak: peak,
      wordDays,
      multiDays,
      multiShare: wordDays ? Math.round((multiDays / wordDays) * 1000) / 10 : 0,
      multiNoStep: rows.reduce((a, r) => a + r.multiNoStep, 0),
      choiceShare: qs.length ? Math.round((qs.filter((q) => q.input === 'choice').length / qs.length) * 1000) / 10 : 0,
      activeShareStage3: st3.length ? Math.round((st3.filter((q) => q.input !== 'choice').length / st3.length) * 1000) / 10 : 0,
      introduced: introducedDay.size,
      gapMedian: quant(gaps, 0.5),
      gapP90: quant(gaps, 0.9),
      gapMax: Math.max(0, ...gaps),
      gapsOver14: gaps.filter((g) => g > 14).length,
      weakGapsOver14,
      overdueEnd: adapter.overdue(end),
      overdueMaxAge,
      forecast14: fc,
      retention: reviewsFirst.length ? Math.round((reviewsFirst.filter((q) => q.ok).length / reviewsFirst.length) * 1000) / 10 : 0,
      newDaysBelow2: studyRows.filter((r) => [...introducedDay.values()].filter((x) => x === r.day).length < 2).length,
    },
  };
}

export type RunResult = { adapter: string; days: number; seed: number; results: ScenarioResult[]; seeds: number[]; spread: Record<string, ScenarioResult['summary'][]> };

export function runAll(adapter: PlannerAdapter, o: { days: number; seed: number; seeds?: number }): RunResult {
  // Abgenommen wird der SCHLECHTESTE Wert über 5 Startwerte (Prüfung learning-scientist V0, Befund 9); die Haupttabelle zeigt den ersten.
  const seeds = Array.from({ length: Math.max(1, o.seeds ?? 5) }, (_, i) => o.seed + i);
  const results = SCENARIOS.map((sc) => runScenario(adapter, sc, o.days, o.seed));
  const spread: Record<string, ScenarioResult['summary'][]> = {};
  for (const sc of SCENARIOS) spread[sc.key] = [results.find((r) => r.scenario.key === sc.key)!.summary, ...seeds.slice(1).map((sd) => runScenario(adapter, sc, o.days, sd).summary)];
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
  row('Wort-Tage (Wort mit ≥ 1 Abfrage an einem Tag)', (s) => s.wordDays);
  row('davon Wort mehrfach am selben Tag', (s) => `${s.multiDays} (${s.multiShare} %)`);
  row('davon mehrfach **außerhalb** der Lernschritte', (s) => s.multiNoStep);
  row('Anteil Auswahl an allen Abfragen', (s) => `${s.choiceShare} %`);
  row('Anteil aktiv (Tippen/Bilden) ab Stufe 3', (s) => `${s.activeShareStage3} %`);
  row('eingeführte Wörter', (s) => s.introduced);
  row('Lerntage mit < 2 neuen Wörtern', (s) => s.newDaysBelow2);
  row('Lücke zwischen Abfragetagen: Median / 90 % / längste', (s) => `${s.gapMedian} / ${s.gapP90} / ${s.gapMax} Tage`);
  row('Lücken über 14 Tage', (s) => s.gapsOver14);
  row('davon bei Wörtern bis Stufe 2 (noch nicht sicher)', (s) => s.weakGapsOver14);
  row('überfällig am Ende', (s) => s.overdueEnd);
  row('längste Zeit seit letzter Abfrage am Ende', (s) => `${s.overdueMaxAge} Tage`);
  row('fällig in den nächsten 14 Tagen', (s) => s.forecast14.join(' · '));
  row('14-Tage-Vorschau: größter Tag ÷ Mittel', (s) => s.forecastPeak);
  row('simulierte Trefferquote (erste Abfrage des Tages, kein Lernschritt)', (s) => `${s.retention} %`);
  row('Ertrag: Lexeme mit wahrem R(produktiv) ≥ 0,9 an Tag 60', (s) => s.yield60);
  row('Haltbarkeit: davon R ≥ 0,7 nach 30 Tagen ohne Üben', (s) => s.yield90);
  row('Ertrag je Lernstunde', (s) => s.yieldPerHour);
  out.push('', `**Über ${r.seeds.length} Startwerte** (${r.seeds.join(', ')}): kleinster – größter Wert`, '');
  out.push('| Kennzahl | ' + r.results.map((x) => x.scenario.key).join(' | ') + ' |');
  out.push('|---|' + r.results.map(() => '---').join('|') + '|');
  const span = (label: string, f: (s: ScenarioResult['summary']) => number) =>
    out.push(`| ${label} | ` + r.results.map((x) => { const v = (r.spread[x.scenario.key] ?? []).map(f); return `${Math.min(...v)} – ${Math.max(...v)}`; }).join(' | ') + ' |');
  span('mehrfach außerhalb der Lernschritte', (s) => s.multiNoStep);
  span('Variationskoeffizient Pflichtminuten', (s) => s.cvDutyStudy);
  span('Variationskoeffizient Tagesminuten', (s) => s.cvMinutesStudy);
  span('14-Tage-Vorschau größter Tag ÷ Mittel', (s) => s.forecastPeak);
  span('überfällig am Ende', (s) => s.overdueEnd);
  span('Anteil Auswahl (%)', (s) => s.choiceShare);
  span('Trefferquote erste Abfrage (%)', (s) => s.retention);
  span('Ertrag Tag 60', (s) => s.yield60);
  span('Haltbarkeit +30 Tage', (s) => s.yield90);
  span('Ertrag je Lernstunde', (s) => s.yieldPerHour);
  out.push('', '**Je Tag** (Abfragen · davon mehrfach · Auswahl · überfällig · Minuten):', '');
  for (const x of r.results) {
    out.push(`<details><summary>${x.scenario.key}: ${x.scenario.name}</summary>`, '', '| Tag | Abfragen | Wörter | mehrfach | mehrfach ohne Lernschritt | Auswahl | getippt | überfällig | Min. | Pflicht-Min. |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const d of x.rows) out.push(`| ${d.day}${d.studied ? '' : ' (Pause)'} | ${d.queries} | ${d.distinct} | ${d.multi} | ${d.multiNoStep} | ${d.choice} | ${d.typed} | ${d.overdue} | ${d.minutes} | ${d.dutyMinutes} |`);
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
