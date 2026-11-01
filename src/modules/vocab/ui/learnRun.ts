import { addDays, dayKey, dayStartOf, daysBetween, logError, logWarn } from '../shared';
import { teachOf } from '../content';
import { lexOf } from '../data/lex';
import { vocabModuleMarkSchema } from '../data/schemas';
import { addLater, dropLater, freezeDay, markLife, replayDraft, type UseDoc, readUseDoc, type VocabDeps, writeAnswer, writeIntro, writeProbe, writeUse } from '../data/store';
import type { UseLater } from '../data/schemas';
import { applyUse, EV_MIN_LV, sentenceWith, type UseInput, type UseResult } from '../domain/apply';
import { openWhys, answerOfUse, type UseModel, modelOfUse } from '../domain/use';
import { type FirstVerdict, milder } from '../prompts/common';
import { type ExtraFix, isEvade, type WordJudgement } from '../prompts/judge';
import type { Band } from '../domain/band';
import { Catalog, type Item } from '../domain/catalog';
import { srcOf, weightsOf } from '../domain/sources';
import type { SourceData } from '../data/refill';
import { VMOD_PLACE_PATH } from '../registry';
import type { Check, CheckDict } from '../domain/check';
import { buildDayPlan, type DayPlan } from '../domain/day';
import { type Reason, reasonOf } from '../domain/reason';
import { answerOf, type CardModel, cardOf, headOf, type Draft, evaluate, type Frozen, isDraft, planCtxOf, previewOf, resultOf } from '../domain/flow';
import { type Answer, type AnswerResult, introduce } from '../domain/planner';
import { type RoundReport, type SessionKind, SessionRun, type Task } from '../domain/session';
import { groupOf } from '../domain/ladder';
import { type FormStats, type Grade, type Lex, OS_TEXT_MAX, type VocabCfg } from '../domain/types';
import { vocabCfg } from '../api';
import { type ReadDoc, readVlogRecent } from '../data/history';
import { retention, RET_WINDOW_DAYS, youngBoost } from '../domain/stats';

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
  | { k: 'card'; card: CardModel; task: Task; kind: AnswerKind; n: number; left: number; canProbe: boolean; tip: boolean; flip?: FlipBack | null }
  | { k: 'band'; card: CardModel; task: Task; kind: AnswerKind; n: number; left: number; given: string; check: Check; band: Band; choice: Choice }
  /** Start der Pflicht-Runde (V3 Schritt 4, Bild B8/B11): einmal am Lerntag vor der ersten Karte. */
  | { k: 'start'; s: StartInfo }
  /** Anwenden oder eigener Satz (Großpaket A S5c, Bilder s2-07 … s2-12); `later` = Nachprüfung eines gemerkten Textes (nur Belege). */
  | { k: 'use'; m: UseModel; task: Task; n: number; left: number; text: string; spoken: boolean; spokenKeys: readonly string[] | null; st: UseState; later: UseLater | null }
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

/**
 * Wirkung je Wort in Worten (Bild s2-08 „Zählt als Wiederholung …“): `up` rückt weiter · `soon` kommt bald wieder · `none` ohne Planwirkung.
 * `ev` = eigene, geprüfte Sätze für Stufe 7 nach dieser Buchung (nur ab Stufe 5, sonst `null`); `evNew` = dieser zählt dazu;
 * `evS` = davon gesprochen; `core` = Kernwort (für Stufe 7 muss einer der Sätze gesprochen sein, ladder.ts).
 */
export type UseRow = WordJudgement & { path: string; head: string; fx: 'up' | 'soon' | 'none'; ev: number | null; evNew: boolean; evS: number; core: boolean };

/**
 * Zustand der Anwenden-Karte: schreiben (mit Fehlertext nach einem fehlgeschlagenen Prüfen, Knopf „Erneut versuchen“) → Claude prüft →
 * Urteil je Wort (Erklärungen falsch vor fast richtig, höchstens zwei offen; „Nochmal selbst schreiben“ und dann erst die bessere Fassung;
 * „War das auch richtig?“ einmal) · ohne Claude: Muster und Selbstvergleich (`later` = „Später prüfen lassen“ gewählt).
 */
export type UseState =
  | { s: 'write'; fail: string | null }
  | { s: 'checking' }
  | {
      s: 'judged';
      rows: UseRow[];
      open: string[];
      extra: ExtraFix | null;
      fixed: string;
      fixedUnsure: boolean;
      better: string;
      reveal: boolean;
      redo: string | null;
      recheck: 'can' | 'busy' | 'done' | 'failed';
    }
  | { s: 'self'; later: boolean };

/** Fehler beim Prüfen, schon eingeordnet (die Oberfläche übersetzt `AiFailure`): abgebrochen · Claude fehlt (Muster) · später erneut (Text). */
/** Fehlschlag der Prüfung: abgebrochen, Claude nicht nutzbar (→ Selbstvergleich) oder „Erneut versuchen“ (mit Text-Schlüssel). */
export class UseFail extends Error {
  constructor(
    readonly kind: 'cancelled' | 'noai' | 'retry',
    readonly key: string | null = null,
  ) {
    super(`use-check: ${kind}`);
    this.name = 'UseFail';
  }
}
/** Urteil von Claude, je Zielwort in der Reihenfolge der Ziele (`key` w1 …). */
export type UseVerdicts = { words: WordJudgement[]; extra: ExtraFix | null; fixed: string; fixedUnsure: boolean; better: string };
export type UseQuery = { m: UseModel; text: string; spoken: boolean; first: FirstVerdict[] | null };
/** KI-Tor für Anwenden, von außen (wortschatz.tsx): `ready` = Claude nutzbar; `check` wirft `UseFail`. */
export type UseAi = { ready(): boolean; check(q: UseQuery, signal: AbortSignal): Promise<UseVerdicts> };

const isUseFail = (e: unknown): e is UseFail => e instanceof UseFail;

/** Gemerkte Texte („Später prüfen lassen“), die eine Runde am Anfang zeigt, höchstens so viele. */
export const LATER_PER_ROUND = 2;

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
  /** Claude für Anwenden und eigenen Satz (fehlt = nie bereit: Muster und Selbstvergleich). */
  ai?: UseAi;
  /** `vmod/use` frisch lesen (Alltags-Lage, „Später prüfen lassen“); fehlt = leer. */
  readUse?: () => Promise<Doc | null>;
  /** Ein Dokument frisch lesen (Verlauf `vmod/ix`, `vlog/…` für „Junge Wörter früher“); fehlt = kein Nachsteuern. */
  read?: ReadDoc;
  /** Quellen neuer Wörter (S7; die App lädt sie per dynamischem Import). Fehlt = kein Nachfüllen. */
  loadSources?: () => Promise<SourceData>;
};

export type LearnStart = { kind: SessionKind; docs: Iterable<readonly [string, Doc]>; profile: Doc | null; schema: Doc | null; paths?: string[] };

/** Eingabe beim Prüfen (von der Oberfläche gemessen): Dauer und Zeit bis zum ersten Zeichen ohne Nachschlage-Pausen. */
export type Measured = { ms: number; fk: number };

/**
 * Anki-Modus, Rückseite (S6b-3): je Note der nächste Termin, wie er gebucht würde (`soon` = heute noch einmal, `day` = Lerntag, `none` = ohne
 * Planwirkung, z. B. Übung oder heute schon gebucht), dazu Warum und Wortpartner aus dem Band der Note „Gut“ (Kap. 2 Nr. 4: auch bei richtig).
 */
export type FlipWhen = { k: 'soon' } | { k: 'day'; day: string } | { k: 'none' };
export type FlipBack = { opts: { g: Grade; when: FlipWhen }[]; why: Band['why'] | null; partners: Band['partners'] };

/** Gestolperte Wörter im Abschluss höchstens so viele mit Namen (gruppiert nach Tag, der Rest als „+n“). */
const SLIP_MAX = 12;
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
  /** Anki-Modus: eingefrorene Zeit beim Aufdecken (Antwortzeit = Zeit bis zum Aufdecken). */
  private flipF: Frozen | null = null;
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
  /** `vmod/use` beim Start (Alltag dieser Woche, gemerkte Texte). */
  private useDoc: UseDoc = { life: null, later: [] };
  /** Gemerkte Texte, die diese Runde zuerst prüft (nur mit Claude). */
  private laterQ: UseLater[] = [];
  /** Wörter mit heute gezähltem Beleg (je Wort höchstens einer am Tag, apply.ts). */
  private readonly evToday = new Set<string>();
  /** Laufende Prüfung (Abbruch beim Verlassen) und Schreibzeit des Textes. */
  private useCtl: AbortController | null = null;
  private useMs = 0;
  /** Angezeigte Anwenden-Karte schon gebucht (Weiter und Verlassen zugleich). */
  private useBooked = false;

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
      const { cat, cfg, plan, nowMs } = await this.setup(s);
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
   * Tagesplan der Wörter vorab einfrieren (Heute öffnet, Befund ux 4b Nr. 1): dieselben Schritte wie der Start einer Pflichtrunde (Bestand,
   * Entwürfe nachbuchen, `freezeDay`), aber ohne Karte. Liefert die Minuten des Plans, damit Heute und die Runde dieselbe Zahl nennen;
   * `null`, wenn nicht geschrieben werden darf oder etwas fehlschlägt (dann bleibt die gewählte Wörter-Zeit stehen).
   */
  async prepare(s: Omit<LearnStart, 'kind' | 'paths'>): Promise<number | null> {
    if (this.started || writeGate(s.profile, s.schema) !== 'ok') return null;
    this.started = true;
    try {
      const { plan } = await this.setup({ ...s, kind: 'pflicht' });
      return plan && plan.plan.length ? Math.max(1, Math.round(plan.min)) : null;
    } catch (err) {
      logError('vocab:prepare-day', err);
      return null;
    }
  }

  /** Gemeinsamer Anfang von Start und Vorab-Einfrieren: Bestand im Speicher, Entwürfe nachbuchen, bei Pflicht den Tagesplan einfrieren. */
  private async setup(s: LearnStart): Promise<{ cat: Catalog; cfg: VocabCfg; plan: DayPlan | null; nowMs: number }> {
    const cfg = vocabCfg(s.profile);
    this.cfg = cfg;
    this.sbGate = s.profile?.sbGate ?? null;
    const items = [];
    let i = 0;
    // Eigener Satz (Stufe 5/6) nur, wenn Claude ihn prüfen kann (forms.ts `available('own')`); sonst die Grundformen.
    const ai = this.aiReady();
    for (const [path, doc] of s.docs) {
      const lex = lexOf(doc);
      if (!lex || doc.hidden === true) continue;
      this.docs.set(path, doc);
      // Lehrer-Falle des Stichworts (falscher Freund / Paar): steuert Kontrastkarte und Paar-Regel (catalog.ts `trap`).
      const tc = teachOf(headOf(path, doc));
      items.push({ path, lex, order: typeof doc.order === 'number' ? doc.order : i++, trap: tc.ff ? ('ff' as const) : tc.pair ? ('pair' as const) : null, av: { de: true, ai, anki: !!cfg.anki }, src: srcOf(doc.src) });
    }
    // Großpaket A S7: Vor dem ersten Pflicht-Plan des Lerntags fehlende neue Wörter aus den Quellen anlegen (Wortpartner, Beruf, Häufigkeitsliste).
    const dayNow = this.env.now();
    const cur = await this.env.readDay();
    if (s.kind === 'pflicht' && this.env.loadSources && !(cur && cur.d === dayKey(dayNow))) {
      for (const [path, doc] of await this.refill(s.docs, items, cfg, dayNow)) {
        const lex = lexOf(doc);
        if (!lex) continue;
        this.docs.set(path, doc);
        items.push({ path, lex, order: typeof doc.order === 'number' ? doc.order : i++, trap: null, av: { de: true, ai, anki: !!cfg.anki }, src: srcOf(doc.src) });
      }
    }
    const cat = new Catalog(items);
    this.cat = cat;
    // „Junge Wörter früher“ (Großpaket A S6): steht fest im heutigen Plan; nur ein neuer Pflicht-Plan rechnet es aus dem Verlauf.
    if (cur && cur.d === dayKey(dayNow)) cfg.retY = typeof cur.ry === 'number' ? cur.ry : null;
    else if (s.kind === 'pflicht') cfg.retY = await this.youngTarget(cfg, dayNow);
    await this.replay();
    await this.loadUse();
    const nowMs = this.env.now();
    this.day = dayKey(nowMs);
    // freezeDay nimmt den heutigen Plan unverändert, wenn er schon steht (auch von einem anderen Gerät).
    const plan = s.kind === 'pflicht' ? await freezeDay(this.env.deps, cat, nowMs, cfg, this.med, cur) : null;
    if (plan) cfg.retY = plan.ry ?? null;
    return { cat, cfg, plan, nowMs };
  }

  /** Nachfüllen (S7): Quellen per dynamischem Import, Einstufung aus `vmod/place`; jeder Fehler lässt den Tag mit dem Bestand laufen. */
  private async refill(docs: Iterable<readonly [string, Doc]>, items: Item[], cfg: VocabCfg, nowMs: number): Promise<[string, Doc][]> {
    const load = this.env.loadSources;
    if (!load) return [];
    try {
      const { refillFresh, readPlace } = await import('../data/refill');
      // Einstufung: fehlt = Grenze 4.500; vorhanden, aber nicht lesbar = Häufigkeitsliste heute auslassen; ein Lesefehler wirft und lässt das
      // Nachfüllen heute ganz aus (unten protokolliert, data-guard S7b).
      const raw = this.env.read ? await this.env.read(VMOD_PLACE_PATH) : null;
      const place = raw === null ? null : (readPlace(raw) ?? 'skip');
      return await refillFresh(this.env.deps.writer, { docs: new Map(docs), items, quota: cfg.newPerDay, nowMs, place, w: weightsOf(cfg.w), load });
    } catch (err) {
      logError('vocab:refill', err);
      return [];
    }
  }

  /** Ziel für junge Wörter aus der echten Rate der letzten 30 Tage (`null` = nicht nachsteuern; ein Lesefehler steuert nie nach). */
  private async youngTarget(cfg: VocabCfg, nowMs: number): Promise<number | null> {
    const read = this.env.read;
    if (!read) return null;
    try {
      return youngBoost(cfg.ret, retention(await readVlogRecent(read, nowMs, RET_WINDOW_DAYS), nowMs));
    } catch (err) {
      logError('vocab:young-target', err);
      return null;
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

  private aiReady(): boolean {
    try {
      return !!this.env.ai?.ready();
    } catch (err) {
      logError('vocab:use-ai', err);
      return false;
    }
  }

  /** `vmod/use` lesen; gemerkte Texte kommen am Anfang der Runde dran, wenn Claude bereit ist (älteste zuerst). */
  private async loadUse(): Promise<void> {
    if (!this.env.readUse) return;
    try {
      this.useDoc = readUseDoc(await this.env.readUse());
    } catch (err) {
      logError('vocab:use-read', err);
    }
    this.laterQ = this.aiReady() ? this.useDoc.later.slice(0, LATER_PER_ROUND) : [];
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
    while (this.laterQ.length) if (this.showLater(this.laterQ.shift()!)) return;
    for (let i = 0; i < SKIP_MAX; i++) {
      const nowMs = this.env.now();
      const task = run.next(nowMs);
      if (!task) {
        this.set(this.doneView());
        return;
      }
      if (task.form === 'transfer' || task.form === 'own') {
        const m = this.useFor(task, nowMs);
        if (m) {
          this.shownAt = nowMs;
          this.useBooked = false;
          this.set({ k: 'use', m, task, n: this.n, left: run.remaining(), text: '', spoken: false, spokenKeys: null, st: { s: 'write', fail: null }, later: null });
          return;
        }
        run.done(task, nowMs);
        continue;
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

  private lookup = (path: string) => {
    const doc = this.docs.get(path);
    const lex = this.cat?.get(path)?.lex;
    return doc && lex ? { doc, lex, teach: teachOf(headOf(path, doc)) } : null;
  };

  private useFor(task: Task, nowMs: number): UseModel | null {
    return modelOfUse({ task, lookup: this.lookup, nowMs, sbGate: this.sbGate, lastLife: this.useDoc.life });
  }

  /** Gemerkten Text zur Prüfung zeigen (Rahmen und Lage wie beim Schreiben; Wörter, die es nicht mehr gibt, fallen weg). */
  private showLater(it: UseLater): boolean {
    const paths = it.w.map(([p]) => p);
    const task: Task = { path: paths[0]!, form: it.form, step: 0, intro: false, planned: false, why: 'later', ...(it.form === 'transfer' ? { group: paths } : {}), sent: '-', cue: false };
    const m = this.useFor(task, it.t);
    if (!m) return false;
    this.useBooked = false;
    this.set({ k: 'use', m: { ...m, frame: it.frame, sit: it.sit, evidence: true }, task, n: this.n, left: this.run?.remaining() ?? 0, text: it.text, spoken: it.spoken, spokenKeys: null, st: { s: 'write', fail: null }, later: it });
    return true;
  }

  /** Stufe beim Schreiben: beim gemerkten Text die gemerkte, sonst die jetzige. */
  private lvAt(v: Extract<LearnView, { k: 'use' }>, path: string): number {
    const kept = v.later?.w.find(([p]) => p === path);
    return kept ? kept[1] : (this.cat?.get(path)?.lex.lv ?? 0);
  }

  /** „Deine Sätze“: beim eigenen Satz der ganze Text, beim Anwenden der Satz mit der Fundstelle (sonst nichts). */
  private sentOf(v: Extract<LearnView, { k: 'use' }>, at: string): { sent?: string } {
    const text = v.text.trim();
    const sent = v.m.form === 'own' ? (text.length <= OS_TEXT_MAX ? text : null) : sentenceWith(text, at);
    return sent ? { sent } : {};
  }

  /** Verwendung je Ziel aus dem Urteil (Zeit `t + i`, damit jeder Verlaufseintrag eigen ist). */
  private inputs(v: Extract<LearnView, { k: 'use' }>, words: readonly WordJudgement[], t: number): { path: string; u: UseInput }[] {
    const out: { path: string; u: UseInput }[] = [];
    v.m.targets.forEach((tg, i) => {
      const w = words.find((x) => x.key === tg.key);
      if (!w) return;
      out.push({
        path: tg.path,
        u: { t: t + i, form: v.m.form, v: w.v, err: w.err, at: w.at, evade: isEvade(w), spoken: v.spokenKeys ? v.spokenKeys.includes(tg.key) : v.spoken, lvAt: this.lvAt(v, tg.path), evidenceOnly: v.m.evidence || !!v.later, evDone: this.evToday.has(tg.path), ...this.sentOf(v, w.at) },
      });
    });
    return out;
  }

  /** Rein gerechnete Wirkung je Wort (gebucht wird dasselbe beim Weiter auf dem frischen Dokument). */
  private rowsOf(v: Extract<LearnView, { k: 'use' }>, words: readonly WordJudgement[], t: number): UseRow[] {
    const rows: UseRow[] = [];
    for (const { path, u } of this.inputs(v, words, t)) {
      const lex = this.cat?.get(path)?.lex;
      const w = words.find((x) => x.key === v.m.targets.find((tg) => tg.path === path)?.key)!;
      const tg = v.m.targets.find((x) => x.path === path)!;
      const r: UseResult | null = lex ? applyUse(lex, u, planCtxOf(this.cat!, this.med, path, u.t, this.cfg!, v.task.planned && !u.evidenceOnly)) : null;
      const g = r?.grade ?? null;
      rows.push({ ...w, path, head: tg.word, fx: g === null ? 'none' : g >= 3 ? 'up' : 'soon', ev: u.lvAt >= EV_MIN_LV && r ? r.lex.ev.o : null, evNew: !!r?.ev, evS: r?.lex.ev.s ?? 0, core: lex?.pri === 'core' });
    }
    return rows;
  }

  private judged(v: Extract<LearnView, { k: 'use' }>, out: UseVerdicts, t: number): Extract<UseState, { s: 'judged' }> {
    const rows = this.rowsOf(v, out.words, t);
    return { s: 'judged', rows, open: [...openWhys(rows)], extra: out.extra, fixed: out.fixed, fixedUnsure: out.fixedUnsure, better: out.better, reveal: false, redo: null, recheck: 'can' };
  }

  /** Kann Claude gerade prüfen? (Wozu-Text der Anwenden-Karte sagt es vorher, Kap. 2 Nr. 2.) */
  canCheck(): boolean {
    return this.aiReady();
  }

  /**
   * Text prüfen lassen (Anwenden-Karte). Ohne Claude: Muster und Selbstvergleich; Fehler: Text bleibt, „Erneut versuchen“.
   * `spoken` = Text überwiegend diktiert (fürs Prompt); `spokenKeys` = Zielwörter, die in einem diktierten Stück stehen (gesprochener Beleg je Wort).
   */
  useCheck(text: string, spoken: boolean, m: Measured, spokenKeys?: readonly string[]): void {
    const v = this.view;
    if (v.k !== 'use' || (v.st.s !== 'write' && v.st.s !== 'self') || !text.trim()) return;
    this.useMs = Math.max(0, Math.round(m.ms));
    const base = { ...v, text: v.later ? v.later.text : text.trim(), spoken: v.later ? v.later.spoken : spoken, spokenKeys: v.later || !spokenKeys ? null : [...spokenKeys] };
    const ai = this.env.ai;
    if (!ai || !this.aiReady()) {
      this.set({ ...base, st: { s: 'self', later: false } });
      return;
    }
    this.set({ ...base, st: { s: 'checking' } });
    void this.ask(base, null).then(
      (out) => {
        const cur = this.view;
        if (cur.k !== 'use' || cur.task !== v.task || cur.st.s !== 'checking') return;
        this.set({ ...cur, st: this.judged(cur, out, this.env.now()) });
      },
      (f: UseFail) => {
        const cur = this.view;
        if (cur.k !== 'use' || cur.task !== v.task || cur.st.s !== 'checking') return;
        this.set({ ...cur, st: f.kind === 'noai' ? { s: 'self', later: false } : { s: 'write', fail: f.kind === 'retry' ? (f.key ?? 'aiFailed') : null } });
      },
    );
  }

  private async ask(v: Extract<LearnView, { k: 'use' }>, first: FirstVerdict[] | null): Promise<UseVerdicts> {
    this.useCtl?.abort();
    const ctl = new AbortController();
    this.useCtl = ctl;
    try {
      return await this.env.ai!.check({ m: v.m, text: v.text, spoken: v.spoken, first }, ctl.signal);
    } catch (err) {
      if (isUseFail(err)) throw err;
      logError('vocab:use-check', err);
      throw new UseFail('retry');
    } finally {
      if (this.useCtl === ctl) this.useCtl = null;
    }
  }

  /** „War das auch richtig?“ (einmal): zweite Prüfung, je Wort gilt nur ein milderes Urteil. */
  useRecheck(): void {
    const v = this.view;
    if (v.k !== 'use' || v.st.s !== 'judged' || v.st.recheck !== 'can' || this.useBooked) return;
    const st = v.st;
    const first: FirstVerdict[] = st.rows.map((r) => ({ key: r.key, v: r.v, err: r.err, why: r.why }));
    this.set({ ...v, st: { ...st, recheck: 'busy' } });
    const done = (patch: Partial<Extract<UseState, { s: 'judged' }>>) => {
      const cur = this.view;
      if (cur.k !== 'use' || cur.task !== v.task || cur.st.s !== 'judged') return;
      this.set({ ...cur, st: { ...cur.st, ...patch } });
    };
    void this.ask(v, first).then(
      (out) => {
        const words = st.rows.map((r) => {
          const second = out.words.find((w) => w.key === r.key);
          const keep: WordJudgement = { key: r.key, v: r.v, err: r.err, at: r.at, why: r.why };
          return second ? milder(keep, second) : keep;
        });
        const rows = this.rowsOf(v, words, this.env.now());
        done({ rows, open: [...openWhys(rows)], recheck: 'done' });
      },
      (f: UseFail) => done({ recheck: f.kind === 'cancelled' ? 'can' : 'failed' }),
    );
  }

  /** „Nochmal selbst schreiben“: zweiter eigener Versuch (bucht nichts), danach die korrigierte und die bessere Fassung. */
  useRedo(text: string): void {
    const v = this.view;
    if (v.k !== 'use' || v.st.s !== 'judged' || !text.trim()) return;
    this.set({ ...v, st: { ...v.st, redo: text.trim(), reveal: true } });
  }

  /** „Bessere Fassung zeigen“ ohne zweiten Versuch. */
  useReveal(): void {
    const v = this.view;
    if (v.k === 'use' && v.st.s === 'judged' && !v.st.reveal) this.set({ ...v, st: { ...v.st, reveal: true } });
  }

  /** Ohne Claude: „Später prüfen lassen“ an/aus (gemerkt wird beim Weiter; ein gemerkter Text bleibt ohnehin in der Liste). */
  useLater(on: boolean): void {
    const v = this.view;
    if (v.k === 'use' && v.st.s === 'self' && !v.later) this.set({ ...v, st: { s: 'self', later: on } });
  }

  /** Gemerkten Text verwerfen (Nachprüfung): aus der Liste nehmen, weiter. */
  useDrop(): void {
    const v = this.view;
    if (v.k !== 'use' || !v.later || v.st.s === 'checking') return;
    const t = v.later.t;
    this.useBooked = true;
    this.chain = this.chain.then(async () => {
      try {
        await dropLater(this.env.deps, t);
      } catch (err) {
        logError('vocab:use-later', err);
      }
    });
    this.advance();
  }

  /** Anwenden-Karte buchen (einmal): Urteil je Wort → Entwurf und Buchung; ohne Claude nichts außer „später prüfen“. */
  private bookUse(v: Extract<LearnView, { k: 'use' }>): void {
    if (this.useBooked) return;
    this.useBooked = true;
    this.useCtl?.abort();
    const deps = this.env.deps;
    const cat = this.cat!;
    const cfg = this.cfg!;
    const jobs: (() => Promise<unknown>)[] = [];
    if (v.st.s === 'judged') {
      const t0 = this.env.now();
      const drafts: Draft[] = [];
      for (const { path, u } of this.inputs(v, v.st.rows, t0)) {
        const lex = cat.get(path)?.lex;
        if (!lex) continue;
        const planned = v.task.planned && !u.evidenceOnly;
        const r = applyUse(lex, u, planCtxOf(cat, this.med, path, u.t, cfg, planned));
        if (r.lex !== lex) cat.set(path, r.lex);
        if (r.ev) this.evToday.add(path);
        if (!this.lv0.has(path)) this.lv0.set(path, lex.lv);
        if (r.grade === 1) this.slips.add(path);
        const d: Draft = { v: 1, kind: 'use', path, planned, a: answerOfUse(u, lex.k, this.useMs, !!v.later), u };
        drafts.push(d);
        jobs.push(async () => {
          await writeUse(deps, path, d.a, u, { cfg, cat, med: this.med, planned });
          writeDrafts(this.env.drafts, readDrafts(this.env.drafts).filter((x) => !(x.path === d.path && x.a.t === d.a.t && x.kind === 'use')));
        });
      }
      writeDrafts(this.env.drafts, [...readDrafts(this.env.drafts), ...drafts]);
      if (v.later) {
        const t = v.later.t;
        jobs.push(() => dropLater(deps, t));
      }
    } else if (v.st.s === 'self' && v.st.later && !v.later) {
      const item: UseLater = { t: this.env.now(), form: v.m.form, frame: v.m.frame, sit: v.m.sit, text: v.text.slice(0, 1200), spoken: v.spoken, w: v.m.targets.map((x) => [x.path, Math.max(0, Math.min(7, x.lv))] as [string, number]) };
      jobs.push(() => addLater(deps, item, item.t));
    }
    if (!v.later && v.m.frame === 'life' && v.st.s !== 'write' && v.st.s !== 'checking') {
      const day = dayKey(this.env.now());
      this.useDoc = { ...this.useDoc, life: day };
      jobs.push(() => markLife(deps, day));
    }
    for (const job of jobs)
      this.chain = this.chain.then(async () => {
        try {
          await job();
        } catch (err) {
          // Entwürfe bleiben im Browser und werden beim nächsten Start nachgebucht.
          logError('vocab:book-use', err);
        }
      });
  }

  /** Weiter auf der Anwenden-Karte: buchen, zählen, nächste Karte. Ohne Prüfung (noch beim Schreiben) geht es nicht weiter. */
  private useNext(v: Extract<LearnView, { k: 'use' }>): void {
    if (v.st.s === 'write' || v.st.s === 'checking') return;
    this.bookUse(v);
    const now = this.env.now();
    if (this.shownAt !== null) this.activeMs += Math.min(CARD_MS_MAX * 2, Math.max(0, now - this.shownAt));
    this.shownAt = now;
    if (v.later) {
      this.advance();
      return;
    }
    // Die Pflicht zählt auch ohne Claude (Bild s2-09); die Wörter zählen nur mit geprüftem Urteil.
    this.n += 1;
    if (v.st.s === 'judged') {
      for (const r of v.st.rows) (v.task.planned && !v.m.evidence ? this.tally.review : this.tally.extra).add(r.path);
      if (v.st.rows.every((r) => r.v === 'ok')) this.right += 1;
    }
    this.run?.done(v.task, now);
    this.advance();
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

  /** Satz vor dem Prüfen anhören (Einstellung, Standard an). */
  listenFirst(): boolean {
    return this.cfg?.pre !== false;
  }

  /** Anki-Modus: aufdecken. Die Zeit bis hier ist die Antwortzeit; je Note wird der nächste Termin rein gerechnet. */
  flipOpen(m: Measured): void {
    const v = this.view;
    const cat = this.cat;
    if (v.k !== 'card' || v.card.mode !== 'flip' || v.flip || !cat) return;
    const before = cat.get(v.task.path)?.lex;
    if (!before) return;
    const t = this.env.now();
    const f: Frozen = { t, ms: Math.max(0, Math.round(m.ms)), fk: Math.max(0, Math.round(m.fk)), hint: 0 };
    this.flipF = f;
    const day = dayKey(t);
    const opts = ([1, 2, 3, 4] as const).map((g) => {
      const r = this.compute('answer', v.card, v.task, before, this.flipAnswer(v.card, v.task, f, g));
      const when: FlipWhen = r.lex.step && dayKey(r.lex.step.at) === day ? { k: 'soon' } : r.booked.includes('u') ? { k: 'day', day: dayKey(r.lex.u.due) } : { k: 'none' };
      return { g, when };
    });
    const good = this.compute('answer', v.card, v.task, before, this.flipAnswer(v.card, v.task, f, 3));
    const band = previewOf({ m: v.card, check: { outcome: 'ok' }, given: v.card.answer, lang: this.env.lang(), before, result: good, planned: v.task.planned, t, ...(this.env.meaningOf ? { meaningOf: this.env.meaningOf } : {}) });
    this.set({ ...v, flip: { opts, why: band?.why ?? null, partners: band?.partners ?? [] } });
  }

  private flipAnswer(card: CardModel, task: Task, f: Frozen, g: Grade): Answer {
    return answerOf(card, { outcome: g === 1 ? 'wrong' : 'ok' }, f, { self: g, step: task.step > 0 });
  }

  /** Anki-Modus: Selbsturteil 1–4 (A7). Wirkt nur auf Verstehen (Planer, F3); gebucht wird wie jede Antwort, dann sofort weiter. */
  flipGrade(g: Grade): void {
    const v = this.view;
    const cat = this.cat;
    const f = this.flipF;
    if (v.k !== 'card' || v.card.mode !== 'flip' || !v.flip || !f || !cat) return;
    const before = cat.get(v.task.path)?.lex;
    if (!before) return;
    const a = this.flipAnswer(v.card, v.task, f, g);
    const check: Check = { outcome: a.outcome };
    this.pending = { task: v.task, card: v.card, kind: 'answer', before, given: '', check, f, choice: null, a, result: this.compute('answer', v.card, v.task, before, a), committed: false };
    if (v.card.sentence) this.lastSent.set(v.task.path, v.card.sentence.sent.key);
    this.flipF = null;
    this.next();
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
    if (v.k !== 'card' && v.k !== 'band' && v.k !== 'use') return null;
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
    const v = this.view;
    if (v.k === 'use') {
      this.useNext(v);
      return;
    }
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
      slips: { n: slipList.length, list: slipList.slice(0, SLIP_MAX) },
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

  /**
   * Beim Verlassen (Bildschirmwechsel, `pagehide`, `visibilitychange`): offene Antwort sofort buchen, ohne weiterzugehen. `abort = false`
   * (nur im Hintergrund): eine laufende Prüfung durch Claude läuft weiter.
   */
  leave(abort = true): Promise<void> {
    const v = this.view;
    if (v.k === 'use') {
      // Ein gezeigtes Urteil und „Später prüfen lassen“ werden gebucht; eine laufende Prüfung bricht beim Bildschirmwechsel ab (A6 Nr. 2).
      if (v.st.s === 'judged' || (v.st.s === 'self' && v.st.later)) this.bookUse(v);
      else if (abort) this.useCtl?.abort();
    }
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
