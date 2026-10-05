import { create } from 'zustand';
import { useClock } from '../../app/clock';
import { useSettings } from '../../app/settings';
import { invalidIdsOf, useLive } from '../../data/live';
import { appendCheck, CHECK_MIN_SAVE, checkDoneThisWeek, checkRecord, readChecks, type CheckRecord, type ResultItem } from '../../domain/check/record';
import { selectCheck, type CheckItem } from '../../domain/check/select';
import { dayKey, learningDayEnd } from '../../domain/date';
import type { GrammarAnswer } from '../../domain/learn/types';
import { applyUpdate, cardPatch } from '../../domain/srs/applyReview';
import { buildTrainCards } from '../../domain/metrics';
import { toTrainCard } from '../../domain/srs/cards';
import { buildExercise } from '../../domain/srs/exercise';
import type { AnswerEvent, Exercise, Lang, TrainCard } from '../../domain/srs/types';
import { logWarn } from '../../platform/diagnostics';
import { useLearnInputs } from '../learn/inputs';
import { learnRecorder, nextT, recordAnswer, recordProfileFields, recordRoundEnd } from '../progress/persist';
import { saveCard } from '../vocab/persist';
import type { Answer, FirstKind } from '../vocab/session';

// Wochen-Check (Funktionsabgleich M10): 12 gemischte Aufgaben ohne Tipps aus den vorhandenen
// Bausteinen (Vokabel-Übung, Wendung/Kollokation, Grammatikaufgabe). Freiwillig (Extra), höchstens
// einmal je Kalenderwoche, zählt NIE als Pflicht: alle Antworten laufen mit `ctx:'xtra'`, das
// Rundenende mit `act:'check'` (kein Pflichtkanal). Antworten werden wie jede Übung gespeichert
// (Karte, Thema, Protokoll); das Ergebnis kommt im Format der alten App nach `profile.checks[]`.

type Doc = Record<string, unknown>;

export type CheckRow = ResultItem;

type State = {
  active: boolean;
  status: 'running' | 'summary';
  day: string;
  lang: Lang;
  items: CheckItem[];
  cards: Map<string, TrainCard>;
  pool: TrainCard[];
  pos: number;
  step: number;
  exercise: Exercise | null;
  results: CheckRow[];
  startedAt: number;
  /** Gespeichertes Ergebnis (nach dem Ende). */
  record: CheckRecord | null;
  /** Letzter gespeicherter Check vor diesem (Vergleich). */
  prev: CheckRecord | null;
  saved: 'idle' | 'saving' | 'saved' | 'failed';
  /** Neubau (P1): Block der Tageseinheit am Sonntag – Antworten zählen als Pflicht (`ctx:'duty'`). */
  unit: boolean;
};

const initial = (): State => ({
  active: false,
  status: 'running',
  day: '',
  lang: 'de',
  items: [],
  cards: new Map(),
  pool: [],
  pos: 0,
  step: 0,
  exercise: null,
  results: [],
  startedAt: 0,
  record: null,
  prev: null,
  saved: 'idle',
  unit: false,
});

export const useCheck = create<State>(initial);

let runNo = 0;

/** Checks aus dem Live-Profil (älteste zuerst). */
export const liveChecks = (): CheckRecord[] => readChecks(useLive.getState().docs['app/profile']);

/** Darf der Check jetzt angeboten werden? Einmal je Kalenderwoche (Mo–So, Lerntag). */
export function checkAvailable(profile: unknown, today: string): boolean {
  return !checkDoneThisWeek(readChecks(profile), today, dayKey);
}

function exerciseFor(s: Pick<State, 'items' | 'cards' | 'pool' | 'lang'>, pos: number): Exercise | null {
  const it = s.items[pos];
  if (!it || it.kind !== 'v') return null;
  const card = s.cards.get(it.key);
  return card ? buildExercise(card, it.ex, s.lang, s.pool, `check|${runNo}|${pos}`) : null;
}

export type CheckKind = 'typed' | 'choice' | null;

function kindOf(s: Pick<State, 'items'>, pos: number, ex: Exercise | null): CheckKind {
  const it = s.items[pos];
  if (!it) return null;
  if (it.kind === 'v') return ex ? (ex.input === 'typed' ? 'typed' : 'choice') : null;
  return it.task.type === 'mc' ? 'choice' : 'typed';
}

/** Aufgaben synchron im Klick zusammenstellen (Tastatur am iPhone). Rückgabe: Eingabeart der ersten Aufgabe. */
export function startCheck(opts: { unit?: boolean } = {}): CheckKind | 'empty' {
  const live = useLive.getState();
  const now = useClock.getState().now;
  const day = useClock.getState().today;
  const lang = useSettings.getState().lang;
  const inputs = useLearnInputs.getState();
  runNo++;
  const all = buildTrainCards(live.collections.vocab ?? new Map<string, Doc>(), now, invalidIdsOf(live.invalid, 'vocab'));
  const pool = all.filter((c) => !c.hidden);
  const items = selectCheck({
    cards: all,
    grammarDocs: live.collections.grammar ?? new Map<string, Doc>(),
    sources: [inputs.dailyOpen, inputs.pool],
    nowMs: now,
    dayEndMs: learningDayEnd(now),
    lang,
    seed: `${day}|check|${runNo}`,
  });
  if (items.length < CHECK_MIN_SAVE) {
    useCheck.setState({ ...initial(), active: false });
    return 'empty';
  }
  const base = { items, cards: new Map(all.map((c) => [c.key, c])), pool, lang };
  const exercise = exerciseFor(base, 0);
  useCheck.setState({
    ...initial(),
    ...base,
    active: true,
    status: 'running',
    unit: !!opts.unit,
    day,
    step: useCheck.getState().step + 1,
    exercise,
    startedAt: performance.now(),
    prev: liveChecks().at(-1) ?? null,
  });
  return kindOf(base, 0, exercise);
}

function advance(s: State, row: CheckRow, cards = s.cards): CheckKind {
  const results = [...s.results, row];
  const pos = s.pos + 1;
  const done = pos >= s.items.length;
  const exercise = done ? null : exerciseFor({ ...s, cards }, pos);
  useCheck.setState({ cards, results, pos, step: s.step + 1, exercise, status: done ? 'summary' : 'running' });
  if (done) void finish(false);
  return done ? null : kindOf(s, pos, exercise);
}

/** Antwort auf eine Vokabel- bzw. Wendungsaufgabe (Schreibweg wie im Wörter-Schritt der Lektion). */
/** `step` = Aufgabe, zu der die Antwort gehört; eine verspätete (z. B. doppelt getippt beim Ausblenden) wird ignoriert. */
export function commitCheckWord(ans: Answer, step: number): FirstKind {
  const s = useCheck.getState();
  const it = s.items[s.pos];
  const e = s.exercise;
  if (!s.active || s.step !== step || !it || it.kind !== 'v' || !e) return null;
  const card = e.card;
  const a: AnswerEvent = {
    t: nextT(),
    day: s.day,
    kind: 'v',
    id: card.id,
    ex: e.ex,
    grade: ans.grade,
    given: ans.given,
    ans: e.accepted[0] ?? card.word,
    ms: ans.ms,
    lang: s.lang,
    ctx: s.unit ? 'duty' : 'xtra',
  };
  if (e.ex === 'colloc' && e.colloc) a.colIndex = e.colloc.index;
  if (ans.override) a.override = true;
  void saveCard(a, card.inDb ? null : { ...card.doc });
  recordAnswer(a, false);
  const nextDoc = applyUpdate({ ...card.doc }, cardPatch({ ...card.doc }, a));
  const cards = new Map(s.cards);
  cards.set(card.key, toTrainCard(card.id, nextDoc, true, a.t) ?? card);
  return advance(s, { kind: 'v', id: card.id, colloc: e.ex === 'colloc', ok: ans.ok }, cards);
}

/** Antwort auf eine Grammatikaufgabe (gleicher Schreibweg wie jede Grammatikrunde, `ctx:'xtra'`). */
export function commitCheckGrammar(a: GrammarAnswer, step: number): CheckKind {
  const s = useCheck.getState();
  const it = s.items[s.pos];
  if (!s.active || s.step !== step || !it || it.kind !== 'g') return null;
  void learnRecorder.grammar(a);
  return advance(s, { kind: 'g', topic: a.task.topic, ok: !a.dontKnow && a.verdict !== 'wrong' });
}

/** Ende (vollständig oder abgebrochen): Rundenende und – ab 6 Antworten – das Ergebnis speichern. */
async function finish(aborted: boolean): Promise<void> {
  const s = useCheck.getState();
  const n = s.results.length;
  if (n < 1) return;
  const activeMs = Math.max(0, performance.now() - s.startedAt);
  void recordRoundEnd({ day: s.day, act: 'check', partial: aborted && s.pos < s.items.length, n, right: s.results.filter((r) => r.ok).length, activeMs: Math.min(activeMs, 30 * 60_000) });
  if (n < CHECK_MIN_SAVE) return;
  const rec = checkRecord(s.results, s.day, Date.now());
  useCheck.setState({ record: rec, saved: 'saving' });
  const out: { skip: string | null } = { skip: null };
  const ok = await recordProfileFields('check:save', (cur) => {
    const r = appendCheck(cur, rec, dayKey);
    if ('skip' in r) {
      out.skip = r.skip;
      return null;
    }
    return r.patch;
  });
  if (out.skip) logWarn('check:save', { code: out.skip, message: 'Wochen-Check nicht gespeichert' }, 'app/profile');
  if (useCheck.getState().record === rec) useCheck.setState({ saved: ok && (!out.skip || out.skip === 'duplicate') ? 'saved' : 'failed' });
}

/** Check verlassen: Beantwortetes ist gespeichert bzw. vorgemerkt. */
export function leaveCheck(): void {
  const s = useCheck.getState();
  if (!s.active) return;
  if (s.status === 'running') void finish(true);
  useCheck.setState({ active: false, exercise: null });
}
