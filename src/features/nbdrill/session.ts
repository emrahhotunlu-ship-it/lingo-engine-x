import { create } from 'zustand';
import type { Resumable } from '../../app/resume';
import type { RouteOf } from '../../app/router/types';
import { collocations, phrasalVerbs, registerLadder, transforms, transitionDrills, wordFormation } from '../../content/nb/load';
import type { Colloc } from '../../content/nb/schemas';
import { checkMotor, fromPhrasal, fromRegister, fromTransform, fromTransition, fromWordFormation, motorFilled, type MotorCheck, type MotorItem, type MotorSet } from '../../domain/nbdrill/motor';
import { collocDone, collocGiveUp, collocTry, collocVerdict, newCollocState, type CollocState, type CollocStep } from '../../domain/nbdrill/colloc';
import { outId, outRef } from '../../domain/nbdrill/outDoc';
import { pickRotating } from '../../domain/nbdrill/pick';
import type { MessageKey } from '../../i18n';
import { currentDay, logAnswers, nextRound, restoreSaved, saveOut, type NbLogType, type UnitRun } from './shared';

// Sitzung des Tipp-Drill-Motors (Plan N101/N102): Kollokationen und Satz-Umformung. Die Sitzung
// wird SYNCHRON im Klick gebaut (iPhone-Tastatur), die Momentaufnahme hält nur Kennungen,
// Position und den Zustand der aktuellen Aufgabe (architektur.md §3.2). Jede beendete Aufgabe
// geht sofort ins Tagesprotokoll, die ganze Runde als ein Eintrag in `out/<Monat>`.

export type DrillSet = 'colloc' | MotorSet;
export const DRILL_SETS: readonly DrillSet[] = ['colloc', 'transform', 'wordform', 'register', 'phrasal', 'transition'];
export const DRILL_N = 5;

export type ItemVerdict = 'ok' | 'close' | 'wrong';
export type ItemResult = { id: string; verdict: ItemVerdict; given: string; ms: number };

export type GapState = { tries: number; given: string[]; check: MotorCheck | null; final: boolean };

export type DrillSession = {
  v: 1;
  set: DrillSet;
  ids: string[];
  pos: number;
  results: ItemResult[];
  colloc: CollocState | null;
  gap: GapState | null;
  day: string;
  t0: number;
  lang: 'de' | 'en';
  unit: UnitRun | null;
  done: boolean;
};

type Store = { s: DrillSession | null };
export const useDrill = create<Store>(() => ({ s: null }));

const newGap = (): GapState => ({ tries: 0, given: [], check: null, final: false });

const motorCache = new Map<MotorSet, readonly MotorItem[]>();
export function motorItems(set: MotorSet): readonly MotorItem[] {
  let list = motorCache.get(set);
  if (!list) {
    list =
      set === 'transform'
        ? transforms().map(fromTransform)
        : set === 'wordform'
          ? wordFormation().map(fromWordFormation)
          : set === 'register'
            ? registerLadder().map(fromRegister)
            : set === 'phrasal'
              ? phrasalVerbs().map(fromPhrasal)
              : transitionDrills().flatMap(fromTransition);
    motorCache.set(set, list);
  }
  return list;
}

function itemsOf(set: DrillSet): ReadonlyArray<{ id: string }> {
  return set === 'colloc' ? collocations() : motorItems(set);
}

export function collocOf(s: DrillSession): Colloc | null {
  if (s.set !== 'colloc') return null;
  const id = s.ids[s.pos];
  return collocations().find((c) => c.id === id) ?? null;
}

export function motorOf(s: DrillSession): MotorItem | null {
  if (s.set === 'colloc') return null;
  const id = s.ids[s.pos];
  return motorItems(s.set).find((c) => c.id === id) ?? null;
}

const transformFor = (m: MotorItem) => (m.set === 'transform' ? (transforms().find((x) => x.id === m.id) ?? null) : null);

const logType = (set: DrillSet): NbLogType => `nb-${set}`;

/** Neue Runde (SYNCHRON im Klick). `false` = keine Inhalte. */
export function startDrill(set: DrillSet, opts: { unit?: UnitRun | null; lang: 'de' | 'en'; n?: number }): boolean {
  const list = itemsOf(set);
  const picked = pickRotating(list, opts.n ?? DRILL_N, nextRound(set));
  if (!picked.length) return false;
  const s: DrillSession = {
    v: 1,
    set,
    ids: picked.map((x) => x.id),
    pos: 0,
    results: [],
    colloc: set === 'colloc' ? newCollocState() : null,
    gap: set !== 'colloc' ? newGap() : null,
    day: opts.unit?.day ?? currentDay(),
    t0: Date.now(),
    lang: opts.lang,
    unit: opts.unit ?? null,
    done: false,
  };
  useDrill.setState({ s });
  return true;
}

const put = (s: DrillSession) => useDrill.setState({ s });

function record(s: DrillSession, r: ItemResult, q: string, ans: string): DrillSession {
  logAnswers([
    {
      type: logType(s.set),
      ref: outRef({ id: outId(s.set, s.t0), d: s.day }),
      q,
      given: r.given,
      ans,
      ok: r.verdict !== 'wrong',
      ms: r.ms,
      day: s.day,
      lang: s.lang,
      duty: !!s.unit,
      t: Date.now(),
    },
  ]);
  return { ...s, results: [...s.results, r] };
}

/** Kollokation: ein getipptes Verb. */
export function collocSubmit(given: string, ms: number): CollocStep {
  const s = useDrill.getState().s;
  const c = s ? collocOf(s) : null;
  if (!s || !c || !s.colloc) return { kind: 'empty' };
  const r = collocTry(c, s.colloc, given);
  let next: DrillSession = { ...s, colloc: r.state };
  if (collocDone(c, r.state) && !collocDone(c, s.colloc)) {
    next = record(next, { id: c.id, verdict: collocVerdict(c, r.state), given: [...r.state.found, ...r.state.tried].join(', '), ms }, c.noun, c.verbs.map((v) => v.v).join(', '));
  }
  put(next);
  return r.step;
}

/** Aufgabe aufgeben: Lösung zeigen (zählt als falsch). */
export function giveUp(ms: number): void {
  const s = useDrill.getState().s;
  if (!s) return;
  const c = collocOf(s);
  if (c && s.colloc && !collocDone(c, s.colloc)) {
    const st = collocGiveUp(s.colloc);
    put(record({ ...s, colloc: st }, { id: c.id, verdict: collocVerdict(c, st), given: [...st.found, ...st.tried].join(', '), ms }, c.noun, c.verbs.map((v) => v.v).join(', ')));
    return;
  }
  const m = motorOf(s);
  if (m && s.gap && !s.gap.final) {
    const check = checkMotor(m, '', transformFor(m));
    put(record({ ...s, gap: { ...s.gap, check, final: true } }, { id: m.id, verdict: 'wrong', given: '', ms }, `${m.source ?? m.gap ?? ''} (${m.chip})`, motorFilled(m, m.answers[0] ?? '')));
  }
}

/** Umformung: ein Versuch. Erst Hinweis, dann zweiter Versuch, dann Lösung. */
export function gapSubmit(given: string, ms: number): MotorCheck | null {
  const s = useDrill.getState().s;
  const t = s ? motorOf(s) : null;
  if (!s || !t || !s.gap || s.gap.final || !given.trim()) return null;
  const check = checkMotor(t, given, transformFor(t));
  const tries = s.gap.tries + 1;
  const final = check.verdict === 'ok' || tries >= 2;
  let next: DrillSession = { ...s, gap: { tries, given: [...s.gap.given, given.trim()], check, final } };
  if (final) {
    const verdict: ItemVerdict = check.verdict === 'ok' ? (tries === 1 ? 'ok' : 'close') : check.verdict === 'close' ? 'close' : 'wrong';
    next = record(next, { id: t.id, verdict, given: given.trim(), ms }, `${t.source ?? t.gap ?? ''} (${t.chip})`, motorFilled(t, t.answers[0] ?? ''));
  }
  put(next);
  return check;
}

/** Nächste Aufgabe; nach der letzten ist die Runde fertig (Ergebnis in `out/<Monat>`). */
export function nextItem(): void {
  const s = useDrill.getState().s;
  if (!s || s.done) return;
  const pos = s.pos + 1;
  if (pos >= s.ids.length) {
    const done: DrillSession = { ...s, pos: s.ids.length - 1, done: true };
    put(done);
    void saveRound(done);
    return;
  }
  put({ ...s, pos, colloc: s.set === 'colloc' ? newCollocState() : null, gap: s.set !== 'colloc' ? newGap() : null });
}

/** Fehlergrenze: Aufgabe ohne Bewertung überspringen. */
export const skipItem = nextItem;

export function drillRight(s: DrillSession): number {
  return s.results.filter((r) => r.verdict !== 'wrong').length;
}

export function drillMs(s: DrillSession): number {
  return s.results.reduce((a, r) => a + r.ms, 0);
}

function saveRound(s: DrillSession): Promise<boolean> {
  const right = drillRight(s);
  const text = s.results.map((r) => `${r.id}: ${r.given || '–'} (${r.verdict})`).join('\n');
  return saveOut({
    id: outId(s.set, s.t0),
    k: s.set,
    d: s.day,
    t: s.t0,
    ...(s.unit?.theme ? { theme: s.unit.theme } : {}),
    ok: right * 2 >= Math.max(1, s.results.length),
    text,
    fb: { right, total: s.results.length, items: s.results.map((r) => ({ id: r.id, v: r.verdict })) },
    ms: drillMs(s),
  });
}

export function endDrill(): void {
  useDrill.setState({ s: null });
}

// ------------------------------------------------------------------ Fortsetzen

const RESUME_KEY: Record<DrillSet, MessageKey> = { colloc: 'nbTrainingResumeColloc', transform: 'nbTrainingResumeTransform', wordform: 'nbTrainingResumeMotor', register: 'nbTrainingResumeMotor', phrasal: 'nbTrainingResumeMotor', transition: 'nbTrainingResumeMotor' };

function isSession(x: unknown): x is DrillSession {
  if (!x || typeof x !== 'object') return false;
  const s = x as Partial<DrillSession>;
  return s.v === 1 && typeof s.set === 'string' && (DRILL_SETS as readonly string[]).includes(s.set) && Array.isArray(s.ids) && typeof s.pos === 'number' && Array.isArray(s.results) && typeof s.day === 'string';
}

export const drillResume: Resumable<DrillSession> = {
  id: 'nbdrill',
  version: 1,
  origin: 'apply',
  snapshot: () => {
    const s = useDrill.getState().s;
    return s && !s.done ? s : null;
  },
  subscribe: (cb) => useDrill.subscribe(cb),
  restore: (s) => {
    if (!isSession(s)) return false;
    // Nur Aufgaben, die es noch gibt; beantwortete bleiben beantwortet (kein doppeltes Schreiben).
    const known = new Set(itemsOf(s.set).map((x) => x.id));
    if (!s.ids.every((id) => known.has(id)) || s.pos >= s.ids.length) return false;
    useDrill.setState({ s: { ...s, done: false } });
    return true;
  },
  route: (s) => ({ name: 'nbdrill', set: s.set }),
  label: (s, t) => t(RESUME_KEY[s.set], { n: s.pos + 1, total: s.ids.length }),
};

/**
 * Sitzung zur Route sicherstellen (Player/`ensure`, Deep-Link, Neuladen): aktiv → gut; sonst aus
 * der Momentaufnahme herstellen; sonst eine neue Runde als Extra.
 */
export function ensureDrill(route: RouteOf<'nbdrill'>, lang: 'de' | 'en'): boolean {
  const s = useDrill.getState().s;
  if (s && s.set === route.set) return true;
  if (restoreSaved(drillResume, currentDay())) {
    const r = useDrill.getState().s;
    if (r && r.set === route.set) return true;
  }
  return startDrill(route.set, { lang, ...(route.n ? { n: route.n } : {}) });
}
