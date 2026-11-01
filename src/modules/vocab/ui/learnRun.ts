import { addDays, dayKey, dayStartOf, daysBetween, logError, logWarn } from '../shared';
import { teachOf } from '../content';
import { lexOf } from '../data/lex';
import { vocabModuleMarkSchema } from '../data/schemas';
import { freezeDay, replayDraft, type VocabDeps, writeAnswer, writeIntro, writeProbe } from '../data/store';
import type { Band } from '../domain/band';
import { Catalog } from '../domain/catalog';
import type { Check, CheckDict } from '../domain/check';
import { buildDayPlan, type DayPlan } from '../domain/day';
import { type Reason, reasonOf } from '../domain/reason';
import { answerOf, type CardModel, cardOf, headOf, type Draft, evaluate, type Frozen, isDraft, planCtxOf, previewOf, resultOf } from '../domain/flow';
import { type Answer, type AnswerResult, introduce } from '../domain/planner';
import { type RoundReport, type SessionKind, SessionRun, type Task } from '../domain/session';
import { groupOf } from '../domain/ladder';
import type { FormStats, Lex, VocabCfg } from '../domain/types';
import { vocabCfg } from '../api';

// Wörter-Modul V3 Schritt 2b-2: Steuerung EINER Lernrunde, ohne React (testbar). Sie hält Runde, Bestand im Speicher und die gezeigte Karte,
// rechnet jede Antwort rein (flow.ts) und bucht erst beim Weiter bzw. beim Verlassen, genau einmal (v3-bau.md §3). Bis die Buchung steht,
// liegt sie als Entwurf im Browser (`lx:vm-pending`) und wird beim nächsten Start nachgebucht, wenn das Lexem sie noch nicht kennt.
// Geschrieben wird nur bei `vcfg.mod = 1` UND `app/schema.vocabModule.state = 'done'` (data-guard V2); sonst zeigt die Runde einen ruhigen Hinweis.

type Doc = Record<string, unknown>;

/** Was die Antwort ist: normale Antwort, Einführung eines neuen Worts oder „Kenne ich schon“-Probe. */
export type AnswerKind = Draft['kind'];
/** „Das wusste ich eigentlich“ oder „Später prüfen lassen“ gewählt (bis zum Weiter rückgängig zu machen). */
export type Choice = 'knewIt' | 'later' | null;
/** Ergebnis von „Aufgabe melden“ (Hinweistext): zählt nicht · kommt gleich in neuem Satz · zählt trotzdem. */
export type UnfairResult = 'void' | 'again' | 'counts';

export type LearnView =
  | { k: 'loading' }
  | { k: 'closed'; why: 'off' | 'migrate' | 'error' }
  | { k: 'card'; card: CardModel; task: Task; kind: AnswerKind; n: number; left: number; canProbe: boolean; tip: boolean }
  | { k: 'band'; card: CardModel; task: Task; kind: AnswerKind; n: number; left: number; given: string; check: Check; band: Band; choice: Choice }
  /** Start der Pflicht-Runde (V3 Schritt 4, Bild B8/B11): einmal am Lerntag vor der ersten Karte. */
  | { k: 'start'; s: StartInfo }
  /** `fresh` neue Wörter, `review` geplante Wiederholungen, `extra` Übung ohne Planwirkung (je Wort einmal gezählt); `sum` = Abschluss-Übersicht. */
  | { k: 'done'; n: number; fresh: number; review: number; extra: number; sum: DoneSummary | null };

/**
 * Start-Bildschirm: Zahlen aus dem eingefrorenen Plan. `back` = letzter Lerntag liegt ≥ 2 Tage zurück („Willkommen zurück“);
 * `sp` = Rückstand je Lerntag (fehlt ohne Rückstand); `fewer` = weniger neue als üblich, weil viel fällig ist.
 */
export type StartInfo = { min: number; due: number; ahead: number; fresh: number; fewer: boolean; back: boolean; today: string; sp: [string, number][] | null };

/**
 * Abschluss (Bild B8): Minuten (aktive Zeit), Pflicht oder Extra, neue Wörter (Stichwörter), aufgestiegene (ohne neue; `w` = Beispiel,
 * `produce` = jetzt in „Selbst schreiben“), gestolperte mit nächstem Termin (Lerntag), morgen (Vorschau aus dem Planer, ohne Speichern).
 */
export type DoneSummary = {
  min: number;
  duty: boolean;
  learned: string[];
  up: { n: number; w: string | null; lv: number; produce: boolean };
  slips: { n: number; list: { w: string; day: string }[] };
  tomorrow: { min: number; due: number; fresh: number } | null;
  today: string;
};

/** Kleiner Speicher für den Entwurf (im Browser `lx:vm-pending`; Tests geben eine Map hinein). */
export type DraftStore = { get(): string | null; set(v: string): void; remove(): void };

export type LearnEnv = {
  deps: VocabDeps;
  dict: CheckDict;
  /** Oberflächensprache zum Zeitpunkt des Prüfens. */
  lang: () => 'de' | 'en';
  drafts: DraftStore;
  /** `vmod/day` frisch lesen (`null` = fehlt oder ungültig). */
  readDay: () => Promise<Doc | null>;
  now: () => number;
  meaningOf?: (w: string) => string | null;
};

export type LearnStart = { kind: SessionKind; docs: Iterable<readonly [string, Doc]>; profile: Doc | null; schema: Doc | null; paths?: string[] };

/** Eingabe beim Prüfen (von der Oberfläche gemessen): Dauer und Zeit bis zum ersten Zeichen ohne Nachschlage-Pausen. */
export type Measured = { ms: number; fk: number };

/** Schutz gegen eine endlose Folge von Aufgaben ohne Karte (spätere Formen werden übersprungen). */
const SKIP_MAX = 500;
/** Aktive Zeit je Karte höchstens so lange (Pause, Telefonat): für die Minuten im Abschluss. */
const CARD_MS_MAX = 120_000;
/** „Willkommen zurück“ ab so vielen Tagen seit dem letzten Lerntag. */
const BACK_DAYS = 2;
/** Im Abschluss höchstens so viele Stichwörter je Zeile. */
const LIST_MAX = 3;

type Pending = {
  task: Task;
  card: CardModel;
  kind: AnswerKind;
  before: Lex;
  given: string;
  check: Check;
  f: Frozen;
  choice: Choice;
  a: Answer;
  result: AnswerResult;
  committed: boolean;
};

/** Einwilligung zum Schreiben: Schalter an UND Umrechnung fertig. */
export function writeGate(profile: Doc | null, schema: Doc | null): 'ok' | 'off' | 'migrate' {
  if (vocabCfg(profile).mod !== 1) return 'off';
  const raw = schema?.vocabModule;
  const mark = raw && typeof raw === 'object' ? vocabModuleMarkSchema.safeParse(raw) : null;
  return mark?.success && mark.data.state === 'done' ? 'ok' : 'migrate';
}

/** Entwürfe aus dem Speicher (eine Liste; ein einzelner Entwurf aus älterem Stand wird zur Liste). Kaputtes wird verworfen und gemeldet. */
export function readDrafts(s: DraftStore): Draft[] {
  const raw = s.get();
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    const list = Array.isArray(v) ? v : [v];
    const ok = list.filter(isDraft);
    if (ok.length !== list.length) logWarn('vocab:draft', 'Entwurf verworfen (ungültig)', String(list.length - ok.length));
    return ok;
  } catch (err) {
    logError('vocab:draft', err, 'lx:vm-pending');
    return [];
  }
}

function writeDrafts(s: DraftStore, list: readonly Draft[]): void {
  if (list.length) s.set(JSON.stringify(list));
  else s.remove();
}

export class LearnRun {
  private view: LearnView = { k: 'loading' };
  private readonly subs = new Set<() => void>();
  private cat: Catalog | null = null;
  private run: SessionRun | null = null;
  private docs = new Map<string, Doc>();
  private cfg: VocabCfg | null = null;
  private med: FormStats = {};
  private sbGate: unknown = null;
  private readonly lastSent = new Map<string, string>();
  private pending: Pending | null = null;
  private chain: Promise<void> = Promise.resolve();
  private n = 0;
  private tally = { fresh: new Set<string>(), review: new Set<string>(), extra: new Set<string>() };
  private started = false;
  private kind: SessionKind = 'pflicht';
  /** Stufe je Wort beim ersten Kontakt in dieser Runde (für „Aufgestiegen“). */
  private readonly lv0 = new Map<string, number>();
  /** Falsch beantwortet in dieser Runde (für „Gestolpert“). */
  private readonly slips = new Set<string>();
  private activeMs = 0;
  private shownAt: number | null = null;
  private right = 0;
  private day: string | null = null;
  private reported = false;
  private endFn: ((r: RoundReport) => void) | null = null;

  constructor(private readonly env: LearnEnv) {}

  subscribe = (fn: () => void): (() => void) => {
    this.subs.add(fn);
    return () => {
      this.subs.delete(fn);
    };
  };
  get = (): LearnView => this.view;

  private set(v: LearnView): void {
    this.view = v;
    for (const f of this.subs) f();
  }

  /** Runde starten (einmal): Sperre prüfen, offene Entwürfe nachbuchen, Tagesplan einfrieren (Pflicht), erste Karte. */
  async start(s: LearnStart): Promise<void> {
    if (this.started) return;
    this.started = true;
    const gate = writeGate(s.profile, s.schema);
    if (gate !== 'ok') {
      this.set({ k: 'closed', why: gate });
      return;
    }
    try {
      const cfg = vocabCfg(s.profile);
      this.cfg = cfg;
      this.sbGate = s.profile?.sbGate ?? null;
      const items = [];
      let i = 0;
      for (const [path, doc] of s.docs) {
        const lex = lexOf(doc);
        if (!lex || doc.hidden === true) continue;
        this.docs.set(path, doc);
        // Lehrer-Falle des Stichworts (falscher Freund / Paar): steuert Kontrastkarte und Paar-Regel (catalog.ts `trap`).
        const tc = teachOf(headOf(path, doc));
        items.push({ path, lex, order: typeof doc.order === 'number' ? doc.order : i++, trap: tc.ff ? ('ff' as const) : tc.pair ? ('pair' as const) : null });
      }
      const cat = new Catalog(items);
      this.cat = cat;
      await this.replay();
      const nowMs = this.env.now();
      this.day = dayKey(nowMs);
      let plan: DayPlan | null = null;
      if (s.kind === 'pflicht') {
        // freezeDay nimmt den heutigen Plan unverändert, wenn er schon steht (auch von einem anderen Gerät).
        plan = await freezeDay(this.env.deps, cat, nowMs, cfg, this.med, await this.env.readDay());
      }
      this.run = new SessionRun(s.kind, cat, plan, nowMs, { cfg, ...(s.paths ? { paths: s.paths } : {}) });
      this.kind = s.kind;
      const info = plan ? this.startInfo(cat, plan, cfg, nowMs) : null;
      if (info) this.set({ k: 'start', s: info });
      else this.advance();
    } catch (err) {
      logError('vocab:learn-start', err);
      this.set({ k: 'closed', why: 'error' });
    }
  }

  /**
   * Start-Bildschirm nur beim ersten Öffnen am Lerntag (noch nichts gebucht) und mit Inhalt; danach (Neuöffnen mitten in der Runde) direkt
   * zur Karte. Zahlen aus dem eingefrorenen Plan, damit Start, Heute-Zeile und Runde dasselbe sagen (Kap. 2 Nr. 2).
   */
  private startInfo(cat: Catalog, plan: DayPlan, cfg: VocabCfg, nowMs: number): StartInfo | null {
    const today = dayKey(nowMs);
    if (!plan.plan.length || plan.d !== today) return null;
    let last: string | null = null;
    for (const it of cat.items()) {
      for (const d of [it.lex.day, it.lex.dayU, it.lex.intro]) {
        if (d === today) return null;
        if (d && d < today && (!last || d > last)) last = d;
      }
    }
    const sp = Array.isArray(plan.sp) && plan.sp.length ? plan.sp : null;
    return {
      min: Math.max(1, Math.round(plan.min)),
      due: plan.due,
      ahead: plan.ahead,
      fresh: plan.fresh,
      fewer: plan.fresh < cfg.newPerDay && plan.due > 0,
      back: !!last && daysBetween(last, today) >= BACK_DAYS,
      today,
      sp,
    };
  }

  /** „Los geht's“ auf dem Start-Bildschirm: erste Karte. */
  begin(): void {
    if (this.view.k === 'start') this.advance();
  }

  /** Offene Entwürfe aus dem Browser nachbuchen (nur, was das Lexem noch nicht kennt); Erfolgreiches verschwindet aus der Liste. */
  private async replay(): Promise<void> {
    const cat = this.cat;
    const cfg = this.cfg;
    if (!cat || !cfg) return;
    const left: Draft[] = [];
    for (const d of readDrafts(this.env.drafts)) {
      try {
        await replayDraft(this.env.deps, d, { cfg, cat, med: this.med });
      } catch (err) {
        logError('vocab:draft-replay', err, d.path);
        left.push(d);
      }
    }
    writeDrafts(this.env.drafts, left);
  }

  // `left`: Karten nach dieser; ein neues Wort bringt seinen Schritt A mit (kommt in dieser Runde, session.ts `remaining`).
  /** Nächste Aufgabe mit Karte zeigen; Aufgaben ohne Karte (Formen späterer Schritte) laufen ohne Buchung durch. */
  private advance(): void {
    const run = this.run;
    const cat = this.cat;
    if (!run || !cat) return;
    for (let i = 0; i < SKIP_MAX; i++) {
      const nowMs = this.env.now();
      const task = run.next(nowMs);
      if (!task) {
        this.set(this.doneView());
        return;
      }
      const card = this.cardFor(task);
      if (card) {
        this.shownAt = nowMs;
        this.set({ k: 'card', card, task, kind: task.intro ? 'intro' : 'answer', n: this.n, left: run.remaining() + (task.intro ? 1 : 0), canProbe: task.intro, tip: false });
        return;
      }
      run.done(task, nowMs);
    }
    logWarn('vocab:learn', 'zu viele Aufgaben ohne Karte', String(SKIP_MAX));
    this.set(this.doneView());
  }

  private cardFor(task: Task): CardModel | null {
    const doc = this.docs.get(task.path);
    const lex = this.cat?.get(task.path)?.lex;
    if (!doc || !lex) return null;
    const head = task.path.startsWith('chunk/') ? doc.en : doc.word;
    return cardOf({ task, doc, lex, teach: teachOf(typeof head === 'string' ? head : ''), nowMs: this.env.now(), sbGate: this.sbGate, avoid: this.lastSent.get(task.path) ?? null });
  }

  /** Tipp (Anfang + Wortzahl): zählt als Hilfe. */
  tip(): void {
    const v = this.view;
    if (v.k === 'card' && !v.tip) this.set({ ...v, tip: true });
  }

  /** „Kenne ich schon“ bei der Einführung: freie Probe ohne Satz. */
  probe(): void {
    const v = this.view;
    if (v.k !== 'card' || !v.canProbe) return;
    const card = this.cardFor({ ...v.task, form: 'probe' });
    if (card) this.set({ ...v, card, kind: 'probe', canProbe: false, tip: false });
  }

  /** Prüfen (bzw. Aufdecken/„Weiß ich nicht“ mit `dunno`). */
  check(given: string, m: Measured, dunno = false): void {
    const v = this.view;
    const cat = this.cat;
    if (v.k !== 'card' || !cat) return;
    const before = cat.get(v.task.path)?.lex;
    if (!before) return;
    const t = this.env.now();
    const c = evaluate(v.card, given, this.env.dict, dunno || !given.trim());
    const f: Frozen = { t, ms: Math.max(0, Math.round(m.ms)), fk: Math.max(0, Math.round(m.fk)), hint: v.tip ? 1 : 0 };
    const p: Pending = { task: v.task, card: v.card, kind: v.kind, before, given, check: c, f, choice: null, a: answerOf(v.card, c, f), result: this.compute(v.kind, v.card, v.task, before, answerOf(v.card, c, f)), committed: false };
    this.pending = p;
    if (v.card.sentence) this.lastSent.set(v.task.path, v.card.sentence.sent.key);
    this.showBand(v.n, v.left);
  }

  /** Rein gerechnetes Ergebnis je Art (gebucht wird dasselbe auf dem frischen Dokument). */
  private compute(kind: AnswerKind, card: CardModel, task: Task, before: Lex, a: Answer): AnswerResult {
    if (kind === 'intro') return { lex: introduce(before, a.t), grade: null, booked: [], note: 0, track: 0, events: [], speed: null };
    const ctx = planCtxOf(this.cat!, this.med, card.path, a.t, this.cfg!, task.planned);
    if (kind === 'probe') return a.outcome === 'ok' ? resultOf(before, a, ctx, true) : { lex: before, grade: null, booked: [], note: 0, track: 0, events: [], speed: null };
    return resultOf(before, a, ctx);
  }

  private showBand(n: number, left: number): void {
    const p = this.pending;
    if (!p) return;
    const band = previewOf({ m: p.card, check: p.check, given: p.given, lang: this.env.lang(), before: p.before, result: p.result, planned: p.task.planned, t: p.f.t, ...(this.env.meaningOf ? { meaningOf: this.env.meaningOf } : {}) });
    if (!band) {
      // Abfrage, die nicht zählt: ohne Band weiter (kommt in V3 mit „Aufgabe war unfair“).
      this.next();
      return;
    }
    // Einführung und Probe: kein Einspruch (es gibt keine Note), danach „gleich noch einmal“.
    const fixed: Band =
      p.kind === 'answer' ? band : { ...band, knewIt: false, alsoRight: false, ...(p.kind === 'probe' && p.check.outcome !== 'ok' ? { next: { kind: 'step', mode: 'same', thenTomorrow: false } } : {}) };
    this.set({ k: 'band', card: p.card, task: p.task, kind: p.kind, n, left, given: p.given, check: p.check, band: fixed, choice: p.choice });
  }

  /** „Das wusste ich eigentlich“ / „Später prüfen lassen“ wählen oder zurücknehmen (`null`), bis zum Weiter. */
  choose(choice: Choice): void {
    const v = this.view;
    const p = this.pending;
    if (v.k !== 'band' || !p || p.kind !== 'answer' || p.committed) return;
    if (choice === 'knewIt' && !v.band.knewIt && p.choice !== 'knewIt') return;
    if (choice === 'later' && !v.band.alsoRight && p.choice !== 'later') return;
    const a = answerOf(p.card, p.check, p.f, { ...(choice === 'knewIt' ? { override: true } : {}), ...(choice === 'later' ? { later: true } : {}), step: p.task.step > 0 });
    p.choice = choice;
    p.a = a;
    p.result = this.compute(p.kind, p.card, p.task, p.before, a);
    // Urteil und Lösung bleiben, wie geprüft; nur „Kommt wieder“ folgt der neuen Buchung.
    const band = previewOf({ m: p.card, check: p.check, given: p.given, lang: this.env.lang(), before: p.before, result: p.result, planned: p.task.planned, t: p.f.t });
    this.set({ ...v, choice, band: band ? { ...v.band, next: band.next } : v.band });
  }

  /** „Warum heute?“ der gezeigten Karte (Menü „…“), aus dem Lexem vor der Antwort; erst beim Öffnen gerechnet. */
  reason(): Reason | null {
    const v = this.view;
    if (v.k !== 'card' && v.k !== 'band') return null;
    return reasonOf(v.task, this.cat?.get(v.task.path)?.lex ?? null, this.env.now());
  }

  /** „Aufgabe war unfair“ geht nur bei einer echten Abfrage (nicht bei Einführung und Probe) und solange nichts gebucht ist. */
  canUnfair(): boolean {
    const v = this.view;
    return (v.k === 'card' || v.k === 'band') && v.kind === 'answer' && !(v.k === 'band' && this.pending?.committed);
  }

  /**
   * „Aufgabe war unfair“ (M43). Vor dem Prüfen oder nach richtiger Antwort: die Abfrage zählt nicht (keine Note, kein Termin, kein Lernschritt;
   * `void`). Nach falscher Antwort darf Melden den Fehler nicht folgenlos löschen (learning-scientist V3 S3, B2): derselbe Weg wie „Später
   * prüfen lassen“ (Wiederkehr nach 4 Karten in einem neuen Satz, dort höchstens „Schwer“; `again`); ist dieser Weg heute schon verbraucht,
   * zählt die Antwort normal (`counts`). Immer: Verlaufseintrag mit FLAG.unfair und Diagnose für die Inhaltsprüfung. Danach weiter.
   */
  unfair(): UnfairResult | null {
    const v = this.view;
    const cat = this.cat;
    if (!cat || !this.canUnfair() || (v.k !== 'card' && v.k !== 'band')) return null;
    const c: Check = { outcome: 'unfair' };
    let p = this.pending;
    let res: UnfairResult = 'void';
    if (v.k === 'card') {
      const before = cat.get(v.task.path)?.lex;
      if (!before) return null;
      const f: Frozen = { t: this.env.now(), ms: 0, fk: 0, hint: v.tip ? 1 : 0 };
      const a = answerOf(v.card, c, f, { step: v.task.step > 0 });
      p = { task: v.task, card: v.card, kind: v.kind, before, given: '', check: c, f, choice: null, a, result: this.compute(v.kind, v.card, v.task, before, a), committed: false };
      this.pending = p;
      if (v.card.sentence) this.lastSent.set(v.task.path, v.card.sentence.sent.key);
    } else {
      if (!p) return null;
      p.choice = null;
      const plain = answerOf(p.card, p.check, p.f, { step: p.task.step > 0 });
      // Kontrastkarte ohne Note: falsch beantwortet zählt sie trotzdem (Termin höchstens morgen), der Kontrast ist danach erledigt (R2).
      const wrongContrast = p.card.form === 'contrast' && p.check.outcome !== 'ok' && p.check.outcome !== 'typo';
      const wrong = !wrongContrast && this.compute(p.kind, p.card, p.task, p.before, plain).grade === 1;
      if (wrongContrast) {
        p.a = answerOf(p.card, p.check, p.f, { unfair: true, step: p.task.step > 0 });
        p.result = this.compute(p.kind, p.card, p.task, p.before, p.a);
        res = 'counts';
      } else if (wrong) {
        p.a = answerOf(p.card, p.check, p.f, { later: true, unfair: true, step: p.task.step > 0 });
        p.result = this.compute(p.kind, p.card, p.task, p.before, p.a);
        res = p.result.grade === null ? 'again' : 'counts';
      } else {
        p.check = c;
        p.a = answerOf(p.card, c, p.f, { step: p.task.step > 0 });
        p.result = this.compute(p.kind, p.card, p.task, p.before, p.a);
      }
    }
    logWarn('vocab:unfair', 'Aufgabe als unfair gemeldet (Inhaltsprüfung)', `${p.card.path} · ${p.card.form} · ${p.card.sentence?.sent.key ?? '-'} · ${res}`);
    this.next();
    return res;
  }

  /** Weiter: buchen (einmal), Bestand und Runde nachführen, nächste Karte. */
  next(): void {
    const p = this.pending;
    const run = this.run;
    const cat = this.cat;
    if (!p || !run || !cat) return;
    this.book(p);
    this.pending = null;
    const now = this.env.now();
    if (this.shownAt !== null) this.activeMs += Math.min(CARD_MS_MAX, Math.max(0, now - this.shownAt));
    this.shownAt = now;
    if (!this.lv0.has(p.card.path)) this.lv0.set(p.card.path, p.before.lv);
    if (p.kind === 'answer' && p.result.grade === 1) this.slips.add(p.card.path);
    if (p.kind === 'answer' && (p.result.grade ?? 0) > 1 && p.check.outcome !== 'unfair') this.right += 1;
    const failedProbe = p.kind === 'probe' && p.check.outcome !== 'ok';
    // Nicht bestandene Probe und die folgende Einführung sind eine Karte (Zähler und Fortschritt zählen sie einmal; UX-Prüfung V3 Nr. 7).
    if (!failedProbe) this.n += 1;
    // Eine als unfair gemeldete Abfrage hat nicht stattgefunden: sie zählt im Abschluss weder als Wiederholung noch als Übung.
    if (p.check.outcome !== 'unfair') (p.kind !== 'answer' ? this.tally.fresh : p.task.planned ? this.tally.review : this.tally.extra).add(p.card.path);
    // Probe nicht bestanden: das Wort wird jetzt normal eingeführt (ohne zweite Probe).
    if (failedProbe) {
      const card = this.cardFor(p.task);
      if (card) {
        this.set({ k: 'card', card, task: p.task, kind: 'intro', n: this.n, left: run.remaining() + 1, canProbe: false, tip: false });
        return;
      }
    }
    run.done(p.task, this.env.now());
    this.advance();
  }

  private doneView(): LearnView {
    const { fresh, review, extra } = this.tally;
    // Ein neues Wort zählt nur als neu, auch wenn es heute schon seine Lernschritte hatte; eine Wiederholung zählt nicht zusätzlich als Übung.
    const rev = [...review].filter((x) => !fresh.has(x));
    return { k: 'done', n: this.n, fresh: fresh.size, review: rev.length, extra: [...extra].filter((x) => !fresh.has(x) && !review.has(x)).length, sum: this.summary() };
  }

  private head(path: string): string {
    const doc = this.docs.get(path);
    return doc ? headOf(path, doc) : '';
  }

  /** Abschluss-Übersicht aus dem Bestand im Speicher (schon nachgeführt); „Morgen“ rechnet der Planer, gespeichert wird nichts. */
  private summary(): DoneSummary | null {
    const cat = this.cat;
    const cfg = this.cfg;
    if (!cat || !cfg || this.n === 0) return null;
    const nowMs = this.env.now();
    const today = dayKey(nowMs);
    const fresh = this.tally.fresh;
    const learned = [...fresh].map((p) => this.head(p)).filter(Boolean);
    let upN = 0;
    let best: { w: string; lv: number; produce: boolean } | null = null;
    for (const [path, lv0] of this.lv0) {
      const lv = cat.get(path)?.lex.lv ?? lv0;
      if (fresh.has(path) || lv <= lv0) continue;
      upN++;
      const produce = groupOf(lv) === 'produce' && groupOf(lv0) !== 'produce';
      if (!best || (produce && !best.produce) || (produce === best.produce && lv > best.lv)) best = { w: this.head(path), lv, produce };
    }
    const slipList: { w: string; day: string }[] = [];
    for (const path of this.slips) {
      const lex = cat.get(path)?.lex;
      if (!lex) continue;
      const at = Math.min(lex.u.due, lex.b?.due ?? Infinity);
      const d = dayKey(at);
      slipList.push({ w: this.head(path), day: d <= today ? addDays(today, 1) : d });
    }
    slipList.sort((a, b) => a.day.localeCompare(b.day) || a.w.localeCompare(b.w));
    let tomorrow: DoneSummary['tomorrow'] = null;
    try {
      const t = buildDayPlan(cat, dayStartOf(addDays(today, 1)) + 3_600_000, cfg, this.med).plan;
      tomorrow = { min: Math.max(1, Math.round(t.min)), due: t.due + t.ahead, fresh: t.fresh };
    } catch (err) {
      logError('vocab:done-tomorrow', err);
    }
    return {
      min: Math.max(1, Math.round(this.activeMs / 60_000)),
      duty: this.kind === 'pflicht',
      learned: learned.slice(0, LIST_MAX),
      up: { n: upN, w: best?.w ?? null, lv: best?.lv ?? 0, produce: best?.produce ?? false },
      slips: { n: slipList.length, list: slipList.slice(0, 2) },
      tomorrow,
      today,
    };
  }

  /**
   * Rundenende einmal melden: beim Abschluss (`partial = false`) oder beim Verlassen mitten in der Runde (`partial = true`).
   * `null`, wenn schon gemeldet, die Runde nie lief oder (beim Verlassen) noch keine Karte beantwortet ist.
   */
  report(partial: boolean): RoundReport | null {
    if (this.reported || !this.day || !this.run) return null;
    if (partial && this.n < 1) return null;
    this.reported = true;
    return { kind: this.kind, day: this.day, n: this.n, right: this.right, activeMs: this.activeMs, partial };
  }

  /** Empfänger des Rundenendes (Heute, Serie); die Oberfläche setzt ihn. */
  onEnd(fn: ((r: RoundReport) => void) | null): void {
    this.endFn = fn;
  }

  /** Rundenende melden (höchstens einmal, siehe `report`) und an den Empfänger geben. */
  end(partial: boolean): void {
    const r = this.report(partial);
    if (!r || !this.endFn) return;
    try {
      this.endFn(r);
    } catch (err) {
      logError('vocab:round-end', err);
    }
  }

  /** Beim Verlassen (Bildschirmwechsel, `pagehide`, `visibilitychange`): offene Antwort sofort buchen, ohne weiterzugehen. */
  leave(): Promise<void> {
    if (this.pending) this.book(this.pending);
    return this.chain;
  }

  /** Alle Buchungen abgeschlossen (für Tests und den Abschluss). */
  settled(): Promise<void> {
    return this.chain;
  }

  private book(p: Pending): void {
    if (p.committed) return;
    p.committed = true;
    const cat = this.cat!;
    const cfg = this.cfg!;
    // Bestand im Speicher sofort nachführen (die Runde plant mit dem neuen Stand); geschrieben wird dahinter, der Reihe nach.
    if (p.result.lex !== p.before) cat.set(p.card.path, p.result.lex);
    const draft: Draft = { v: 1, kind: p.kind, path: p.card.path, planned: p.task.planned, a: p.a };
    writeDrafts(this.env.drafts, [...readDrafts(this.env.drafts), draft]);
    const deps = this.env.deps;
    const opts = { cfg, cat, med: this.med, planned: p.task.planned };
    this.chain = this.chain.then(async () => {
      try {
        if (p.kind === 'intro') await writeIntro(deps, draft.path, draft.a, cat);
        else if (p.kind === 'probe') await writeProbe(deps, draft.path, draft.a, opts);
        else await writeAnswer(deps, draft.path, draft.a, opts);
        writeDrafts(
          this.env.drafts,
          readDrafts(this.env.drafts).filter((d) => !(d.path === draft.path && d.a.t === draft.a.t && d.kind === draft.kind)),
        );
      } catch (err) {
        // Der Entwurf bleibt im Browser und wird beim nächsten Start nachgebucht.
        logError('vocab:book', err, draft.path);
      }
    });
  }
}
