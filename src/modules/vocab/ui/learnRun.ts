import { logError, logWarn } from '../shared';
import { teachOf } from '../content';
import { lexOf } from '../data/lex';
import { vocabModuleMarkSchema } from '../data/schemas';
import { freezeDay, replayDraft, type VocabDeps, writeAnswer, writeIntro, writeProbe } from '../data/store';
import type { Band } from '../domain/band';
import { Catalog } from '../domain/catalog';
import type { Check, CheckDict } from '../domain/check';
import type { DayPlan } from '../domain/day';
import { answerOf, type CardModel, cardOf, type Draft, evaluate, type Frozen, isDraft, planCtxOf, previewOf, resultOf } from '../domain/flow';
import { type Answer, type AnswerResult, introduce } from '../domain/planner';
import { type SessionKind, SessionRun, type Task } from '../domain/session';
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

export type LearnView =
  | { k: 'loading' }
  | { k: 'closed'; why: 'off' | 'migrate' | 'error' }
  | { k: 'card'; card: CardModel; task: Task; kind: AnswerKind; n: number; left: number; canProbe: boolean; tip: boolean }
  | { k: 'band'; card: CardModel; task: Task; kind: AnswerKind; n: number; left: number; given: string; check: Check; band: Band; choice: Choice }
  /** `fresh` neue Wörter, `review` geplante Wiederholungen, `extra` Übung ohne Planwirkung (je Wort einmal gezählt). */
  | { k: 'done'; n: number; fresh: number; review: number; extra: number };

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
        items.push({ path, lex, order: typeof doc.order === 'number' ? doc.order : i++ });
      }
      const cat = new Catalog(items);
      this.cat = cat;
      await this.replay();
      const nowMs = this.env.now();
      let plan: DayPlan | null = null;
      if (s.kind === 'pflicht') {
        // freezeDay nimmt den heutigen Plan unverändert, wenn er schon steht (auch von einem anderen Gerät).
        plan = await freezeDay(this.env.deps, cat, nowMs, cfg, this.med, await this.env.readDay());
      }
      this.run = new SessionRun(s.kind, cat, plan, nowMs, { cfg, ...(s.paths ? { paths: s.paths } : {}) });
      this.advance();
    } catch (err) {
      logError('vocab:learn-start', err);
      this.set({ k: 'closed', why: 'error' });
    }
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
        this.set({ k: 'card', card, task, kind: task.intro ? 'intro' : 'answer', n: this.n, left: run.remaining(), canProbe: task.intro, tip: false });
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

  /** Weiter: buchen (einmal), Bestand und Runde nachführen, nächste Karte. */
  next(): void {
    const p = this.pending;
    const run = this.run;
    const cat = this.cat;
    if (!p || !run || !cat) return;
    this.book(p);
    this.pending = null;
    const failedProbe = p.kind === 'probe' && p.check.outcome !== 'ok';
    // Nicht bestandene Probe und die folgende Einführung sind eine Karte (Zähler und Fortschritt zählen sie einmal; UX-Prüfung V3 Nr. 7).
    if (!failedProbe) this.n += 1;
    (p.kind !== 'answer' ? this.tally.fresh : p.task.planned ? this.tally.review : this.tally.extra).add(p.card.path);
    // Probe nicht bestanden: das Wort wird jetzt normal eingeführt (ohne zweite Probe).
    if (failedProbe) {
      const card = this.cardFor(p.task);
      if (card) {
        this.set({ k: 'card', card, task: p.task, kind: 'intro', n: this.n, left: run.remaining(), canProbe: false, tip: false });
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
    return { k: 'done', n: this.n, fresh: fresh.size, review: rev.length, extra: [...extra].filter((x) => !fresh.has(x) && !review.has(x)).length };
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
