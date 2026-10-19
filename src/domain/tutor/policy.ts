import { dayKey, daysBetween } from '../date';
import type { ExplainExample, ExplainLine } from '../explain/types';
import type { Pattern } from '../grammar/patternTypes';
import type { SlotRole } from '../grammar/slotPlan';
import { wantTypes, wholeSentence, type InputProfile } from '../grammar/tasks';
import { answerRight } from '../learn/right';
import type { GrammarAnswer, GrammarTask, GrammarTaskType, TaskSlot } from '../learn/types';
import { hash32 } from '../random';
import type { LearnerModel, PatternKnow } from './learner';

// Zug-Entscheidung der Tutor-Engine (docs/umbau/tutor-engine-v3.md §2.2, Scheiben S2/S3 verkleinert). Rein: gleiche Eingabe, gleiches Ergebnis;
// nichts wird gelesen oder gespeichert. Die Sitzung (`Session`) lebt nur im Speicher (`features/tutor/sessionStore.ts`), es entstehen keine Dokumente.
//
// Rang (die erste zutreffende Regel gewinnt):
//   1 hint       erster Versuch falsch (nicht bei Auswahl) → vorhandener Zweitversuch mit Leitfrage; dazu die Hinweisleiter `hintLadder`.
//   2 win        3 getippte Antworten in Folge falsch → ein Muster mit p > 0,7 in einer leichteren Form („Kurz etwas Bekanntes, dann weiter.“).
//                Höchstens einmal je Runde. Steht zugleich eine Mini-Lektion an (Rang 3), hat sie Vorrang: Wer dreimal am selben Grund
//                scheitert, braucht die Regel, keine Ablenkung. „Weiß ich nicht“ ohne vorherigen Tippversuch verlängert die Serie nicht.
//   3 explain    2 Fehler mit derselben Ursache am selben Muster in dieser Sitzung → Mini-Lektion (≤ 3 Erklärzeilen), danach eine Stufe leichter.
//   4 review     Fälliges im Slot: macht schon `selectRound` (Fehlersätze vorn), hier nicht noch einmal.
//   5/6 Stufe    Quote der letzten 20 NEU gestellten Grammatikaufgaben > 85 % → eine Stufe freier, < 75 % → eine Stufe gestützter;
//                höchstens ein Wechsel je 5 Antworten (Glättung) und nur mit mindestens 5 Antworten im Fenster.
//   7 ask        sonst: nach `nextTasks`, mit Grund (`WhyCode`).
// Schutzregeln: nie zwei `explain` ohne `ask` dazwischen · Pflicht wird leichter, aber nie kürzer (ersetzt wird, nie gestrichen) · die Verschiebung
// liegt als −1/0/+1 auf der p-gesteuerten Form (`wantTypes`), der gespeicherte Plan bleibt unberührt.

export type Move = 'ask' | 'hint' | 'explain' | 'review' | 'win';
/**
 * Grund einer Aufgabe. Ursächlich sind nur der Platz, für den `selectRound` sie gewählt hat (`GrammarTask.slot`: due/intro/chapter/focus/need/
 * family/chosen/mix; ohne Platz `plan`), und der Zug der Sitzung (known/freer/supported). Datenbelege, die die Wahl nicht ausgelöst haben,
 * stehen nur als Zusatz daneben (`WhyExtra`).
 */
export type WhyCode = 'due' | 'intro' | 'chapter' | 'focus' | 'need' | 'family' | 'chosen' | 'mix' | 'plan' | 'known' | 'freer' | 'supported';
export type Shift = -1 | 0 | 1;

export type Session = {
  /** Richtig (ohne Hilfe) je neu gestellter Grammatikaufgabe, die letzten 20. */
  lastNew20: readonly boolean[];
  /** Getippte Antworten in Folge falsch. */
  wrongRun: number;
  /** Fehler je `muster|ursache` in dieser Sitzung. */
  sameCause: Readonly<Record<string, number>>;
  /** Antworten seit dem letzten Stufenwechsel. */
  sinceShift: number;
  shift: Shift;
  lastMove: Move | null;
  /** Pflichtrunde (wird leichter, nie kürzer). */
  duty: boolean;
  /** `win` gab es in dieser Runde schon (höchstens einmal je Runde). */
  won: boolean;
  /** Muster der letzten Mini-Lektion, bis die nächste Antwort zu diesem Muster kommt (Beobachtung „Erfolg nach Mini-Lektion“). */
  lessonPat: string | null;
  /** Nur beobachtet, steuert nichts: Antworten zum Muster direkt nach einer Mini-Lektion und davon richtig ohne Hilfe (Konzept §2.2). */
  afterLesson: { n: number; ok: number };
};

export const QUOTA_WINDOW = 20;
export const QUOTA_MIN = 5;
export const SHIFT_EVERY = 5;
export const QUOTA_HIGH = 0.85;
export const QUOTA_LOW = 0.75;
export const WIN_AFTER = 3;
export const EXPLAIN_AFTER = 2;
/** Ab hier gilt ein Muster als „bekannt“ (Rang 2). */
export const KNOWN_P = 0.7;
/** Ursachen ohne Lehrwert für eine Mini-Lektion (Tippfehler, unklar). */
const NO_LESSON = new Set(['typo', 'unknown']);

export const newSession = (duty: boolean): Session => ({
  lastNew20: [],
  wrongRun: 0,
  sameCause: {},
  sinceShift: 0,
  shift: 0,
  lastMove: null,
  duty,
  won: false,
  lessonPat: null,
  afterLesson: { n: 0, ok: 0 },
});

/** Was eine Antwort für die Sitzung bedeutet. */
export type AnswerFact = {
  /** Getippt (freier Abruf): keine Auswahl, kein Bedeutungspaar; c1x nur mit `free`. */
  typed: boolean;
  /** Falsch (auch „Weiß ich nicht“). */
  wrong: boolean;
  /** Richtig im ersten Versuch und ohne Hilfe (die Quote). */
  ok: boolean;
  /** Neu gestellte Grammatikaufgabe (keine Wiederholung, kein Fehlersatz, kein Test, nicht von der Engine eingesetzt): zählt für die Quote. */
  fresh: boolean;
  pat: string | null;
  /** Ursache der Diagnose (`tj.h`), sonst `null`. */
  cause: string | null;
  /** „Weiß ich nicht“ ohne vorherigen Tippversuch: verlängert die Serie falscher Antworten nicht (sonst ließe sich `win` erzwingen). */
  blind: boolean;
};

const CHOICE: ReadonlySet<GrammarTaskType> = new Set<GrammarTaskType>(['mc', 'meaning']);

export function factOf(a: Pick<GrammarAnswer, 'task' | 'verdict' | 'dontKnow' | 'pts' | 'firstWrong' | 'free' | 'c1k' | 'tj' | 'help'>, fresh: boolean): AnswerFact {
  const c1 = a.c1k ?? a.task.c1?.kind ?? null;
  const typed = c1 ? a.free === true : !CHOICE.has(a.task.type);
  const right = answerRight(a);
  return {
    typed,
    wrong: !right,
    ok: right && a.firstWrong === undefined && a.help.level === 0,
    fresh,
    pat: a.task.pat ?? null,
    cause: a.tj?.h ?? null,
    blind: a.dontKnow && a.firstWrong === undefined,
  };
}

/** Antwort in die Sitzung eintragen (rein). */
export function recordAnswer(s: Session, f: AnswerFact): Session {
  const sameCause = { ...s.sameCause };
  if (f.wrong && f.pat && f.cause && !NO_LESSON.has(f.cause)) {
    const k = `${f.pat}|${f.cause}`;
    sameCause[k] = (sameCause[k] ?? 0) + 1;
  }
  const after = s.lessonPat !== null && f.pat === s.lessonPat;
  return {
    ...s,
    lastNew20: f.fresh ? [...s.lastNew20, f.ok].slice(-QUOTA_WINDOW) : s.lastNew20,
    wrongRun: f.typed ? (f.wrong ? (f.blind ? s.wrongRun : s.wrongRun + 1) : 0) : s.wrongRun,
    sameCause,
    sinceShift: s.sinceShift + 1,
    ...(after ? { lessonPat: null, afterLesson: { n: s.afterLesson.n + 1, ok: s.afterLesson.ok + (f.ok ? 1 : 0) } } : {}),
  };
}

/** Quote der letzten 20 neu gestellten Aufgaben; `null` unter 5 Antworten. */
export function quota(s: Pick<Session, 'lastNew20'>): number | null {
  if (s.lastNew20.length < QUOTA_MIN) return null;
  return s.lastNew20.filter(Boolean).length / s.lastNew20.length;
}

/** Bekannte Muster (p > 0,7, nicht neu), sicherste zuerst. */
export function knownPatterns(m: LearnerModel): PatternKnow[] {
  return [...m.patterns.values()].filter((k) => k.p > KNOWN_P && k.state !== 'new').sort((a, b) => b.p - a.p || (a.pat < b.pat ? -1 : 1));
}

/** Muster|Ursache mit den meisten Fehlern (≥ 2), sonst `null`. */
export function lessonKey(s: Pick<Session, 'sameCause'>): { pat: string; cause: string } | null {
  let best: [string, number] | null = null;
  for (const [k, n] of Object.entries(s.sameCause)) if (n >= EXPLAIN_AFTER && (!best || n > best[1] || (n === best[1] && k < best[0]))) best = [k, n];
  if (!best) return null;
  const i = best[0].lastIndexOf('|');
  return { pat: best[0].slice(0, i), cause: best[0].slice(i + 1) };
}

/**
 * Nächster Zug nach der Antwort (die Antwort ist in `s` schon eingetragen, `recordAnswer`). `firstTryWrong`: Prüfen im ersten Versuch falsch
 * (dann zuerst der Zweitversuch). Ohne Lernermodell (`null`) gibt es kein `win` (kein Beleg für „bekannt“). `noWin`: `win` ließ sich nicht
 * umsetzen (keine bekannte Aufgabe, Ende des gezählten Teils) → die nächste Regel entscheidet.
 */
export function decideMove(s: Session, m: LearnerModel | null, firstTryWrong: boolean, opts: { noWin?: boolean } = {}): { move: Move; why: WhyCode } {
  if (firstTryWrong) return { move: 'hint', why: 'mix' };
  const explainOpen = s.lastMove !== 'explain' && !!lessonKey(s);
  // Mini-Lektion vor `win`: Steht eine an, kommt sie zuerst (auch bei drei Fehlern in Folge).
  if (!explainOpen && !opts.noWin && !s.won && s.wrongRun >= WIN_AFTER && m && knownPatterns(m).length) return { move: 'win', why: 'known' };
  if (explainOpen) return { move: 'explain', why: 'supported' };
  const q = quota(s);
  if (q !== null && s.sinceShift >= SHIFT_EVERY) {
    if (q > QUOTA_HIGH && s.shift < 1) return { move: 'ask', why: 'freer' };
    if (q < QUOTA_LOW && s.shift > -1) return { move: 'ask', why: 'supported' };
  }
  return { move: 'ask', why: 'mix' };
}

/** Den Zug in der Sitzung festhalten (rein). `hint` ist kein Zug der Sitzung. */
export function applyMove(s: Session, d: { move: Move; why: WhyCode }): Session {
  if (d.move === 'hint') return s;
  const out: Session = { ...s, lastMove: d.move };
  if (d.move === 'win') {
    out.wrongRun = 0;
    out.won = true;
  }
  if (d.move === 'explain') {
    const k = lessonKey(s);
    if (k) {
      const sc = { ...s.sameCause };
      delete sc[`${k.pat}|${k.cause}`];
      out.sameCause = sc;
      out.lessonPat = k.pat;
    }
  }
  if (d.move === 'ask' && d.why === 'freer') {
    out.shift = Math.min(1, s.shift + 1) as Shift;
    out.sinceShift = 0;
  }
  if (d.move === 'ask' && d.why === 'supported') {
    out.shift = Math.max(-1, s.shift - 1) as Shift;
    out.sinceShift = 0;
  }
  return out;
}

// ------------------------------------------------------------------ Formstufen und nextTasks

/** Formstufe nach Beherrschung (wie `wantTypes`): 0 erkennen, 1 ergänzen/finden, 2 selbst bauen. */
export const levelOf = (p: number): 0 | 1 | 2 => (p < 0.4 ? 0 : p <= 0.7 ? 1 : 2);
const LEVEL_P: readonly [number, number, number] = [0.2, 0.55, 0.85];

/** Wunschformen eines Musters mit Verschiebung (−1 gestützter, +1 freier; nach einer Mini-Lektion bis −2); die p-gesteuerte Form bleibt die Grundlage. */
export function formsFor(p: number, shift: number, profile: InputProfile = 'keys'): GrammarTaskType[] {
  const lv = Math.max(0, Math.min(2, levelOf(p) + shift)) as 0 | 1 | 2;
  return wantTypes(LEVEL_P[lv], profile);
}

export type Planned = { task: GrammarTask; why: WhyCode; ref: string | null };
export type NextOpts = {
  profile?: InputProfile;
  /** Diese Aufgaben-Schlüssel nicht (schon in der Runde, schon gesehen). */
  exclude?: ReadonlySet<string>;
  /** Nur dieses Muster (Mini-Lektion, Stufenwechsel an Ort und Stelle). */
  pat?: string | null;
  /** Diese Muster nicht (z. B. das gerade falsche bei `win`). */
  avoid?: ReadonlySet<string>;
};

/**
 * Aufgaben für `n` Plätze (rein, deterministisch über `seed`). Jede Aufgabe trägt ihr Muster als `ref` und einen Grund.
 * - `known` (Rang 2): Muster mit p > 0,7, eine Form leichter als ihre Stufe.
 * - sonst: Muster mit dem größten Bedarf (1 − p) zuerst, Form nach `formsFor(p, shift)`; `due` nimmt zuerst das zuletzt falsche Muster.
 * Nur feste Aufgaben (keine Fehlersätze), je Muster höchstens eine, solange es genug Muster gibt. Fehlt die Wunschform, gibt es keinen Ersatz
 * aus einer anderen Form: dann bleibt der Platz leer (der Aufrufer behält seine Aufgabe).
 */
export function nextTasks(m: LearnerModel, pool: readonly GrammarTask[], slot: SlotRole | 'known', seed: string, n: number, shift: number, opts: NextOpts = {}): readonly Planned[] {
  if (n <= 0) return [];
  const profile = opts.profile ?? 'keys';
  const ex = opts.exclude ?? new Set<string>();
  const usable = pool.filter((t) => t.errorT === null && !!t.pat && !ex.has(t.key) && (profile === 'keys' || !wholeSentence(t)) && (!opts.pat || t.pat === opts.pat) && !opts.avoid?.has(t.pat ?? ''));
  const byPat = new Map<string, GrammarTask[]>();
  for (const t of usable) {
    const list = byPat.get(t.pat as string);
    if (list) list.push(t);
    else byPat.set(t.pat as string, [t]);
  }
  const tie = (s: string): number => hash32(`${seed}|${s}`);
  let pats: Array<{ k: PatternKnow; forms: GrammarTaskType[] }>;
  if (slot === 'known') {
    pats = knownPatterns(m)
      .filter((k) => byPat.has(k.pat))
      .map((k) => ({ k, forms: formsFor(k.p, -1, profile) }));
  } else {
    const known = [...byPat.keys()].map((id) => m.patterns.get(id)).filter((k): k is PatternKnow => !!k);
    const need = (k: PatternKnow): number => 1 - k.p;
    known.sort((a, b) => (slot === 'due' ? (b.lastWrong ?? 0) - (a.lastWrong ?? 0) : 0) || need(b) - need(a) || tie(a.pat) - tie(b.pat));
    pats = known.map((k) => ({ k, forms: formsFor(k.p, shift, profile) }));
  }
  const why: WhyCode = slot === 'known' ? 'known' : shift > 0 ? 'freer' : shift < 0 ? 'supported' : slot === 'due' ? 'due' : slot === 'chapter' || slot === 'intro' ? 'chapter' : 'mix';
  const out: Planned[] = [];
  const used = new Set<string>();
  for (let round = 0; out.length < n && round < n; round++) {
    let added = false;
    for (const { k, forms } of pats) {
      if (out.length >= n) break;
      const cands = (byPat.get(k.pat) ?? []).filter((t) => forms.includes(t.type) && !used.has(t.key));
      if (!cands.length) continue;
      cands.sort((a, b) => forms.indexOf(a.type) - forms.indexOf(b.type) || tie(a.key) - tie(b.key));
      const t = cands[0] as GrammarTask;
      used.add(t.key);
      out.push({ task: t, why, ref: k.pat });
      added = true;
    }
    if (!added) break;
  }
  return out;
}

// ------------------------------------------------------------------ „Warum diese Aufgabe?“

/** Datenbeleg als Zusatz („Passt dazu: …“): offene Fehlerannahme (`hyp`), Quote ohne Hilfe der letzten 28 Tage (`weakQ`), letzter Fehler (`weakD`). */
export type WhyExtra = { k: 'hyp'; n: number; vs: string } | { k: 'weakQ'; n: number; ok: number } | { k: 'weakD'; days: number };
/** Grund einer Aufgabe (ursächlich) und höchstens ein Datenbeleg als Zusatz; Zahlen nur aus Daten (fehlt ein Wert, fehlt er im Satz). */
export type WhyFact = { code: WhyCode; pat: string | null; topic: string; days?: number; extra?: WhyExtra };

const WEAK_RATE = 0.75;
const WEAK_DAYS = 14;

const SLOT_CODE: Readonly<Record<TaskSlot, WhyCode>> = { intro: 'intro', chapter: 'chapter', focus: 'focus', need: 'need', family: 'family', chosen: 'chosen', mix: 'mix' };

/** Datenbeleg zum Muster (nur Zusatz, nie der Grund): Annahme → schwache Quote (≥ 3 Antworten, unter 75 % ohne Hilfe) → Fehler in den letzten 14 Tagen. */
function extraOf(pat: string | null, m: LearnerModel | null): WhyExtra | null {
  if (!m || !pat) return null;
  const hyp = m.hyps.find((h) => h.state === 'open' && h.from === pat);
  if (hyp) return { k: 'hyp', n: hyp.n, vs: hyp.to };
  const k = m.patterns.get(pat);
  if (k && k.q28.n >= 3 && k.q28.ok / k.q28.n < WEAK_RATE) return { k: 'weakQ', n: k.q28.n, ok: k.q28.ok };
  if (k && k.lastWrong) {
    const days = daysBetween(dayKey(k.lastWrong), m.day);
    if (days >= 0 && days <= WEAK_DAYS) return { k: 'weakD', days };
  }
  return null;
}

/**
 * „Warum diese Aufgabe?“ (S2): der Grund, aus dem die Aufgabe wirklich in der Runde steht. Reihenfolge: Zug der Sitzung (`mark`: known/freer/
 * supported) → Fehlersatz (`due`, mit Tagen) → Platz aus `selectRound` (`task.slot`) → ohne Platz `plan` („gehört zu deiner Runde“). Ein
 * Datenbeleg, der die Wahl nicht ausgelöst hat, kommt nur als Zusatz (`extra`); beim Zug der Sitzung keiner.
 */
export function whyOf(task: Pick<GrammarTask, 'topic' | 'pat' | 'errorT' | 'slot'>, m: LearnerModel | null, mark?: WhyCode | null): WhyFact {
  const pat = task.pat ?? null;
  const base = { pat, topic: task.topic };
  if (mark) return { code: mark, ...base };
  const extra = extraOf(pat, m);
  const plus = extra ? { extra } : {};
  if (task.errorT !== null) {
    const days = m ? Math.max(0, daysBetween(dayKey(task.errorT), m.day)) : undefined;
    return { code: 'due', ...base, ...(days !== undefined ? { days } : {}), ...plus };
  }
  return { code: task.slot ? SLOT_CODE[task.slot] : 'plan', ...base, ...plus };
}

// ------------------------------------------------------------------ Mini-Lektion und Hinweisleiter

export const LESSON_MAX_LINES = 3;

/** Erster Satz eines Textes. */
const firstSentence = (s: string): string => (s.trim().split(/(?<=[.!?])\s+/)[0] ?? s).trim();

/**
 * Mini-Lektion (Rang 3): die eigene Antwort mit Grund (`own`: Zeile `yours` oder `mistake` der Rückmeldung, Pflichtfrage 3/4), die Regel in
 * einem Satz, dann Kontrast nur mit Beleg (`proof`: Verwechslung in dieser Antwort oder offene Annahme), sonst ein Beispiel aus dem Beruf
 * (Besprechung oder Mail zuerst). Höchstens 3 Erklärzeilen (das Beispiel zählt mit; es fällt zuerst weg); die Zielzeile (Muster) zählt nicht und
 * kommt vom Aufrufer. Reihenfolge wie im Erklärmodell: yours → why → mistake → contrast.
 */
export function miniLesson(
  p: Pick<Pattern, 'use' | 'ex' | 'contrast'>,
  proof: 'confuse' | 'hyp' | null,
  lang: 'de' | 'en',
  own: ExplainLine | null = null,
): { lines: ExplainLine[]; examples: ExplainExample[] } {
  const mine = own && (own.k === 'yours' || own.k === 'mistake') ? own : null;
  const rule: ExplainLine = { k: 'why', text: firstSentence(lang === 'de' ? p.use.de : p.use.en) };
  const lines: ExplainLine[] = mine?.k === 'yours' ? [mine, rule] : mine ? [rule, mine] : [rule];
  if (proof && p.contrast) lines.push({ k: 'contrast', a: p.contrast.a, b: p.contrast.b, diff: lang === 'de' ? p.contrast.diff.de : p.contrast.diff.en });
  const kept = lines.slice(0, LESSON_MAX_LINES);
  const ex = p.ex.find((e) => e.ctx === 'meeting' || e.ctx === 'mail') ?? p.ex[0];
  const examples: ExplainExample[] = ex && kept.length < LESSON_MAX_LINES ? [{ en: ex.en, ...(ex.de ? { de: ex.de } : {}), ctx: ex.ctx }] : [];
  return { lines: kept, examples };
}

/**
 * Hinweisleiter (Rang 1, vor dem Prüfen): 1 Leitfrage · 2 Formel · 3 erster Buchstabe (nur bei Lücken, deren Lösung das Feld zeigt: `gap`,
 * `transform`). `kwt` hat keine dritte Stufe: Die Maske zeigt dort keinen Buchstaben, der Knopf hätte sonst keine Wirkung.
 */
export type HintStep = 'nudge' | 'formula' | 'firstLetter';
export function hintLadder(task: Pick<GrammarTask, 'type' | 'prompt'>): readonly HintStep[] {
  const gapLike = (task.type === 'gap' || task.type === 'transform') && !wholeSentence(task);
  return gapLike ? ['nudge', 'formula', 'firstLetter'] : ['nudge', 'formula'];
}
export const maxHint = (task: Pick<GrammarTask, 'type' | 'prompt'>): number => hintLadder(task).length;

// ------------------------------------------------------------------ Zug in der laufenden Runde umsetzen

export type RoundMoveIn = {
  tasks: readonly GrammarTask[];
  /** Position der nächsten Aufgabe. */
  pos: number;
  /** Ende des gezählten Teils (Beginn der freiwilligen Wiederholung, sonst die Länge). */
  end: number;
  d: { move: Move; why: WhyCode };
  m: LearnerModel;
  /** Verschiebung NACH dem Zug (`applyMove`). */
  shift: Shift;
  profile: InputProfile;
  seed: string;
  pool: readonly GrammarTask[];
  /** Schon gesehene Aufgaben (bevorzugt ungesehene; fehlen sie, auch gesehene). */
  seen: ReadonlySet<string>;
  /** Muster der gerade beantworteten Aufgabe. */
  pat: string | null;
};

/**
 * Den Zug in der eingefrorenen Runde umsetzen (rein). Die Zahl der Aufgaben bleibt gleich (Pflicht wird leichter, nie kürzer); ersetzt wird nur
 * eine feste Aufgabe (nie ein Fehlersatz, nie im Wiederholungsteil). Rückgabe `at` = ersetzte Stelle (sonst `null`), `why` = Grund für die Anzeige,
 * `displaced` = die verdrängte Aufgabe bei `win` (der Aufrufer nimmt sie vorrangig in die freiwillige Wiederholung auf).
 * - win: eine bekannte Aufgabe (anderes Muster als das gerade falsche) rückt an `pos`; dafür fällt die erste feste Aufgabe ab `pos` weg.
 * - explain: die nächste Aufgabe wird dasselbe Muster eine Stufe leichter.
 * - ask mit Verschiebung ≠ 0: passt die Form der nächsten Aufgabe nicht zur verschobenen Stufe, kommt dasselbe Muster in passender Form.
 */
export function roundMove(i: RoundMoveIn): { tasks: GrammarTask[]; at: number | null; why: WhyCode | null; displaced?: GrammarTask } {
  const same = { tasks: [...i.tasks], at: null, why: null };
  const cur = i.tasks[i.pos];
  if (!cur || i.pos >= i.end) return same;
  const inRound = new Set(i.tasks.map((t) => t.key));
  const pick = (slot: SlotRole | 'known', shift: number, opts: NextOpts): Planned | null =>
    nextTasks(i.m, i.pool, slot, i.seed, 1, shift, { profile: i.profile, ...opts, exclude: new Set([...inRound, ...i.seen]) })[0] ??
    nextTasks(i.m, i.pool, slot, i.seed, 1, shift, { profile: i.profile, ...opts, exclude: inRound })[0] ??
    null;
  if (i.d.move === 'win') {
    let j = -1;
    for (let k = i.pos; k < i.end; k++)
      if (i.tasks[k]?.errorT === null) {
        j = k;
        break;
      }
    if (j < 0) return same;
    const p = pick('known', 0, i.pat ? { avoid: new Set([i.pat]) } : {});
    if (!p) return same;
    const out = [...i.tasks];
    const [displaced] = out.splice(j, 1);
    out.splice(i.pos, 0, p.task);
    return { tasks: out, at: i.pos, why: 'known', ...(displaced ? { displaced } : {}) };
  }
  if (cur.errorT !== null) return same;
  if (i.d.move === 'explain') {
    if (!i.pat || !i.m.patterns.has(i.pat)) return same;
    const p = pick('mix', i.shift - 1, { pat: i.pat });
    if (!p) return same;
    const out = [...i.tasks];
    out[i.pos] = p.task;
    return { tasks: out, at: i.pos, why: 'supported' };
  }
  if (i.d.move === 'ask' && i.shift !== 0 && cur.pat && !cur.c1) {
    const k = i.m.patterns.get(cur.pat);
    if (!k || formsFor(k.p, i.shift, i.profile).includes(cur.type)) return same;
    const p = pick('mix', i.shift, { pat: cur.pat });
    if (!p) return same;
    const out = [...i.tasks];
    out[i.pos] = p.task;
    return { tasks: out, at: i.pos, why: i.shift > 0 ? 'freer' : 'supported' };
  }
  return same;
}
