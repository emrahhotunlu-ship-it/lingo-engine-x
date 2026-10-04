import { create } from 'zustand';
import type { Resumable } from '../../app/resume';
import type { RouteOf } from '../../app/router/types';
import { numberDrills, stressWords } from '../../content/nb/load';
import type { NumberItem, StressItem } from '../../content/nb/schemas';
import { outId, outRef } from '../../domain/nbdrill/outDoc';
import { pickRotating } from '../../domain/nbdrill/pick';
import { NUMBERS_N, STRESS_N, stressedWord, stressOk } from '../../domain/nbdrill/stress';
import { currentDay, logAnswers, nextRound, restoreSaved, saveOut } from '../nbdrill/shared';

// Aussprache-Minute (Soll N109): Wortbetonung (betonte Silbe antippen, die Sprachausgabe bestätigt)
// und Zahlen/Daten/Beträge (laut sagen, dann Lösung hören). Ohne KI, ohne Selbstbewertung:
// Betonung wird lokal geprüft, Zahlen werden nicht gewertet.

export type PronDrillKind = 'stress' | 'numbers';

export type PronDrillSession = {
  v: 1;
  kind: PronDrillKind;
  ids: string[];
  pos: number;
  /** Betonung: angetippte Silbe; Zahlen: `-1` = Lösung gezeigt. `null` = offen. */
  tapped: number | null;
  results: { id: string; ok: boolean }[];
  day: string;
  t0: number;
  lang: 'de' | 'en';
  done: boolean;
  ms?: number;
};

export const usePronDrill = create<{ s: PronDrillSession | null }>(() => ({ s: null }));
const put = (s: PronDrillSession) => usePronDrill.setState({ s });
const get = () => usePronDrill.getState().s;

export const stressOf = (s: PronDrillSession): StressItem | null => (s.kind === 'stress' ? (stressWords().find((x) => x.id === s.ids[s.pos]) ?? null) : null);
export const numberOf = (s: PronDrillSession): NumberItem | null => (s.kind === 'numbers' ? (numberDrills().find((x) => x.id === s.ids[s.pos]) ?? null) : null);

export function startPronDrill(kind: PronDrillKind, lang: 'de' | 'en'): boolean {
  const list: ReadonlyArray<{ id: string }> = kind === 'stress' ? stressWords() : numberDrills();
  const picked = pickRotating(list, kind === 'stress' ? STRESS_N : NUMBERS_N, nextRound(kind));
  if (!picked.length) return false;
  put({ v: 1, kind, ids: picked.map((x) => x.id), pos: 0, tapped: null, results: [], day: currentDay(), t0: Date.now(), lang, done: false });
  return true;
}

/** Betonung: Silbe antippen (einmal je Wort). */
export function tapSyllable(i: number): boolean | null {
  const s = get();
  const w = s ? stressOf(s) : null;
  if (!s || !w || s.tapped !== null) return null;
  const ok = stressOk(w.stress, i);
  logAnswers([{ type: 'nb-stress', ref: outRef({ id: outId('stress', s.t0), d: s.day }), q: w.word, given: w.syll[i] ?? '', ans: stressedWord(w.syll, w.stress), ok, ms: 0, day: s.day, lang: s.lang, duty: false, t: Date.now() }]);
  put({ ...s, tapped: i, results: [...s.results, { id: w.id, ok }] });
  return ok;
}

/** Zahlen: Lösung aufdecken (nicht gewertet). */
export function revealNumber(): void {
  const s = get();
  const n = s ? numberOf(s) : null;
  if (!s || !n || s.tapped !== null) return;
  put({ ...s, tapped: -1, results: [...s.results, { id: n.id, ok: true }] });
}

export function nextPron(): void {
  const s = get();
  if (!s || s.done || s.tapped === null) return;
  if (s.pos + 1 >= s.ids.length) {
    const done = { ...s, done: true, ms: Math.max(0, Date.now() - s.t0) };
    put(done);
    const right = s.results.filter((r) => r.ok).length;
    void saveOut({ id: outId(s.kind, s.t0), k: s.kind, d: s.day, t: s.t0, ok: s.kind === 'numbers' || right * 2 >= s.results.length, text: s.ids.join(' '), fb: { right, total: s.results.length }, ms: done.ms });
    return;
  }
  put({ ...s, pos: s.pos + 1, tapped: null });
}

/** Fehlergrenze: ohne Bewertung weiter. */
export function skipPron(): void {
  const s = get();
  if (!s) return;
  if (s.pos + 1 >= s.ids.length) put({ ...s, done: true, ms: Math.max(0, Date.now() - s.t0) });
  else put({ ...s, pos: s.pos + 1, tapped: null });
}

export function endPronDrill(): void {
  usePronDrill.setState({ s: null });
}

function isSession(x: unknown): x is PronDrillSession {
  if (!x || typeof x !== 'object') return false;
  const s = x as Partial<PronDrillSession>;
  return s.v === 1 && (s.kind === 'stress' || s.kind === 'numbers') && Array.isArray(s.ids) && typeof s.pos === 'number' && Array.isArray(s.results) && typeof s.day === 'string';
}

export const pronDrillResume: Resumable<PronDrillSession> = {
  id: 'pronDrill',
  version: 1,
  origin: 'speak',
  snapshot: () => {
    const s = get();
    return s && !s.done ? s : null;
  },
  subscribe: (cb) => usePronDrill.subscribe(cb),
  restore: (s) => {
    if (!isSession(s)) return false;
    const known = new Set<string>((s.kind === 'stress' ? stressWords() : numberDrills()).map((x) => x.id));
    if (!s.ids.every((id) => known.has(id)) || s.pos >= s.ids.length) return false;
    put({ ...s, done: false });
    return true;
  },
  route: (s) => ({ name: 'pron', kind: s.kind }),
  label: (s, t) => t(s.kind === 'stress' ? 'nbTrainingResumeStress' : 'nbTrainingResumeNumbers', { n: s.pos + 1, total: s.ids.length }),
};

export function ensurePronDrill(route: RouteOf<'pron'>, lang: 'de' | 'en'): boolean {
  if (route.kind === 'shadow') return false;
  const s = get();
  if (s && s.kind === route.kind) return true;
  if (restoreSaved(pronDrillResume, currentDay())) {
    const r = get();
    if (r && r.kind === route.kind) return true;
  }
  return startPronDrill(route.kind, lang);
}
