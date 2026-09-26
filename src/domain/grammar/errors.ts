import type { FsrsStored } from '../../data/schemas';
import { topicById } from '../content';
import type { GrammarTask } from '../learn/types';
import { legacyToFsrs } from '../srs/legacyFsrs';
import { reviewFsrs } from '../srs/scheduler';
import type { Grade } from '../srs/types';
import { isDictWord } from '../lexicon/dict';
import { lemmaCandidates } from '../text/lemma';
import { legacyNorm, legacyTaskKey } from './key';

// Fehler-Wiederholung (phase2-plan D1, §4.3, §5.3): Die Boxen 1/3/9 der alten App steuern
// (`box`, `due`, `done`, `last`). FSRS läuft nur als Schatten in `errors[i].fsrs` mit (ab der
// ersten Wiederholung) und bestimmt nichts. Alte Einträge ohne `box` werden gelesen mit
// `due = e.due ?? e.t + 1 Tag` und erst beim Wiederholen ergänzt.

type Doc = Record<string, unknown>;
const DAY = 86_400_000;

export const REVIEW_DAYS = [1, 3, 9] as const;
export const ERRORS_MAX = 10;
export const GIVEN_MAX = 160;

export type ErrorEntry = Doc & { q?: unknown; given?: unknown; ans?: unknown; t?: unknown; box?: unknown; due?: unknown; done?: unknown; last?: unknown; fsrs?: unknown };

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Fälligkeit eines Fehlereintrags (Regel der alten App). */
export const errorDue = (e: ErrorEntry): number => num(e.due) ?? (num(e.t) ?? 0) + DAY;

/** Fehlerliste eines Themas, tolerant gelesen (nur Objekte). */
export function errorsOf(doc: Readonly<Doc> | undefined): ErrorEntry[] {
  const list = doc?.errors;
  return Array.isArray(list) ? (list.filter((e) => e && typeof e === 'object' && !Array.isArray(e)) as ErrorEntry[]) : [];
}

/**
 * Auf höchstens `max` Einträge kürzen: zuerst die ältesten erledigten, erst dann die ältesten
 * offenen (bewusst verlustärmer als die alte App, die einfach die ältesten abschnitt).
 */
export function capErrors(list: readonly ErrorEntry[], max = ERRORS_MAX): ErrorEntry[] {
  const out = [...list];
  while (out.length > max) {
    const doneIdx = out.findIndex((e) => e.done === true);
    out.splice(doneIdx >= 0 ? doneIdx : 0, 1);
  }
  return out;
}

/** Neuer Fehler in der alten Form `{q, given, ans, t, src}`. */
export function addError(list: readonly ErrorEntry[], e: { q: string; given: string; ans: string; t: number; src: string }): ErrorEntry[] {
  return capErrors([...list, { q: e.q, given: e.given.slice(0, GIVEN_MAX), ans: e.ans, t: e.t, src: e.src }]);
}

/**
 * Ergebnis einer Fehler-Wiederholung eintragen. `null`, wenn der Eintrag fehlt oder diese
 * Antwort schon angewendet ist (`e.last >= t`). Richtig: Box +1 (ab Box 3 erledigt), sonst Box 0.
 */
export function reviewError(
  list: readonly ErrorEntry[],
  errorT: number,
  r: { ok: boolean; given: string; grade: Grade; t: number },
): ErrorEntry[] | null {
  const idx = list.findIndex((e) => num(e.t) === errorT);
  if (idx < 0) return null;
  const e = list[idx] as ErrorEntry;
  const last = num(e.last);
  if (last !== null && last >= r.t) return null;
  const next: ErrorEntry = { ...e };
  if (r.ok) {
    const box = (num(e.box) ?? 0) + 1;
    next.box = box;
    next.done = box >= REVIEW_DAYS.length;
    next.due = r.t + REVIEW_DAYS[Math.min(box, REVIEW_DAYS.length - 1)]! * DAY;
  } else {
    next.box = 0;
    next.done = false;
    next.due = r.t + DAY;
    next.given = r.given.slice(0, GIVEN_MAX);
  }
  next.last = r.t;
  next.fsrs = shadowFsrs(e.fsrs, r.grade, r.t);
  const out = [...list];
  out[idx] = next;
  return out;
}

function isFsrs(v: unknown): v is FsrsStored {
  if (!v || typeof v !== 'object') return false;
  const f = v as Doc;
  return ['due', 'stability', 'difficulty', 'state', 'reps', 'lapses', 'scheduledDays', 'learningSteps'].every((k) => typeof f[k] === 'number');
}

/** FSRS-Schatten: nur mitgeschrieben, nie steuernd. Die Uhr läuft nie rückwärts (max(jetzt, last)). */
export function shadowFsrs(cur: unknown, grade: Grade, nowMs: number): FsrsStored {
  const base = isFsrs(cur) ? cur : legacyToFsrs({ state: 'new' }, nowMs);
  const t = Math.max(nowMs, typeof base.last === 'number' ? base.last : 0);
  return reviewFsrs(base, grade, t);
}

// Grundform für den Hinweis einer wiederholten Lücke (Port von `reviewBase` der alten App):
// „will have finished" → finish. Ohne sie hätte „By June, I ___ my course." keine findbare Lösung.
const REV_AUX = new Set(['will', 'would', 'shall', 'should', 'have', 'has', 'had', 'be', 'been', 'being', 'am', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'not', 'never', 'already', 'just', 'still', 'yet', 'to', 'used', 'get', 'gets', 'got']);

export function reviewBase(ans: string): string {
  const words = ans
    .toLowerCase()
    .replace(/n't\b/g, ' not')
    .replace(/[^a-z' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length || words.length > 4) return '';
  const content = words.filter((w) => !REV_AUX.has(w));
  const last = words[words.length - 1] ?? '';
  const w = content[0] ?? (words.length <= 2 && last !== 'not' && last !== 'never' ? last : '');
  if (!w) return '';
  if (!/(ing|ed|ies|es|s)$/.test(w) && isDictWord(w)) return w;
  const cands = lemmaCandidates(w).filter((c) => c !== w);
  // Wie die alte App: die erste Grundform, die das Wörterbuch kennt; sonst die erste Vermutung.
  return cands.find((c) => isDictWord(c)) ?? cands[0] ?? w;
}

/** Aufgabe aus einem Fehlereintrag (Port von `reviewItem`): Lücke oder Satzkorrektur. */
export function errorTask(topic: string, e: ErrorEntry): GrammarTask | null {
  const q = str(e.q).trim();
  const ans = str(e.ans).trim();
  const t = num(e.t);
  if (!q || !ans || e.done === true || t === null || legacyNorm(q) === legacyNorm(ans) || !topicById(topic)) return null;
  const gap = q.includes('___');
  const base = gap && !/\([^)]*\)/.test(q) ? reviewBase(ans) : '';
  return {
    key: legacyTaskKey(q),
    topic,
    type: gap ? 'gap' : 'correct',
    prompt: q,
    answer: ans,
    accepted: [],
    options: null,
    hint: base ? `(${base})` : null,
    expl: { de: null, en: null },
    src: 'review',
    ref: `grammar/${topic}`,
    errorT: t,
  };
}

export type DueError = { topic: string; e: ErrorEntry; box: number; due: number; task: GrammarTask };

/** Fällige Fehler aller Themen, älteste Fälligkeit zuerst; dieselbe Frage nur einmal. */
export function dueErrors(grammarDocs: ReadonlyMap<string, Readonly<Doc>>, nowMs: number): DueError[] {
  const out: DueError[] = [];
  const seen = new Set<string>();
  for (const [topic, doc] of grammarDocs) {
    for (const e of [...errorsOf(doc)].reverse()) {
      const k = legacyNorm(e.q);
      if (seen.has(k)) continue;
      seen.add(k);
      const due = errorDue(e);
      if (due > nowMs) continue;
      const task = errorTask(topic, e);
      if (task) out.push({ topic, e, box: num(e.box) ?? 0, due, task });
    }
  }
  return out.sort((a, b) => a.due - b.due || (a.task.errorT ?? 0) - (b.task.errorT ?? 0));
}
