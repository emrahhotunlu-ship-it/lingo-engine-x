import type { FsrsStored } from '../../data/schemas';
import { topicById } from '../content';
import type { GrammarTask } from '../learn/types';
import { legacyToFsrs } from '../srs/legacyFsrs';
import { reviewFsrs } from '../srs/scheduler';
import type { Grade } from '../srs/types';
import { isDictWord } from '../lexicon/dict';
import { lemmaCandidates } from '../text/lemma';
import { addLocalDays, learningDayEnd } from '../date';
import { legacyNorm, legacyTaskKey } from './key';
import { isRetired, mapEntryOf } from './patterns';
import { seedExplOf } from './seedExpl';

// Fehler-Wiederholung (phase2-plan D1, §4.3, §5.3): Die Boxen 1/3/9 der alten App steuern
// (`box`, `due`, `done`, `last`). FSRS läuft nur als Schatten in `errors[i].fsrs` mit (ab der
// ersten Wiederholung) und bestimmt nichts. Alte Einträge ohne `box` werden gelesen mit
// `due = e.due ?? e.t + 1 Tag` und erst beim Wiederholen ergänzt.

type Doc = Record<string, unknown>;

export const REVIEW_DAYS = [1, 3, 9] as const;
export const ERRORS_MAX = 10;
export const GIVEN_MAX = 160;

export type ErrorEntry = Doc & {
  q?: unknown;
  given?: unknown;
  ans?: unknown;
  t?: unknown;
  box?: unknown;
  due?: unknown;
  done?: unknown;
  last?: unknown;
  fsrs?: unknown;
  /** Muster-Kennung (Lernplattform 2.0 §5.7): ein offener Eintrag je Muster. */
  pat?: unknown;
  /** Weitere falsche Sätze desselben Musters (höchstens 3, `{q, given, ans, t}`). */
  more?: unknown;
  /** Verlauf der Wiederholungen (höchstens 6, `[t, Box vor der Antwort, 1 = richtig | 0 = falsch]`). */
  rh?: unknown;
};

export const MORE_MAX = 3;
export const RH_MAX = 6;
/** Höchstlänge von `q` und `ans` der Zusatzsätze in `more`. */
export const MORE_TEXT_MAX = 300;
export const PAT_MAX = 40;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Fälligkeit eines Fehlereintrags (Regel der alten App; „+ 1 Tag“ als Kalendertag, nicht als 24 Stunden). */
export const errorDue = (e: ErrorEntry): number => num(e.due) ?? addLocalDays(num(e.t) ?? 0, 1);

/** Fällig heißt: Fälligkeit vor dem Ende des laufenden Lerntags (04:00 Uhr), nicht auf die Millisekunde. */
export const isDueToday = (due: number, nowMs: number): boolean => due < learningDayEnd(nowMs);

/** Fehlerliste eines Themas, tolerant gelesen (nur Objekte). */
export function errorsOf(doc: Readonly<Doc> | undefined): ErrorEntry[] {
  const list = doc?.errors;
  return Array.isArray(list) ? (list.filter((e) => e && typeof e === 'object' && !Array.isArray(e)) as ErrorEntry[]) : [];
}

/**
 * Fehlerliste ohne stillgelegte Einträge (`content/grammar/retired.json`, §3.9). Zählende und anzeigende Leser benutzen diese
 * Funktion; schreibende Pfade bleiben bei `errorsOf`, damit nichts verloren geht. Ohne `topic` zählt der Schlüssel des Satzes allein.
 */
export function liveErrorsOf(doc: Readonly<Doc> | undefined, topic?: string): ErrorEntry[] {
  return errorsOf(doc).filter((e) => !isRetired(e.q, topic));
}

/**
 * Auf höchstens `max` Einträge kürzen: nur erledigte Einträge (die ältesten zuerst) werden verdrängt.
 * Sind alle offen, bleibt die Liste länger – offene Fehlersätze werden nie gelöscht.
 */
export function capErrors(list: readonly ErrorEntry[], max = ERRORS_MAX): ErrorEntry[] {
  const out = [...list];
  while (out.length > max) {
    const doneIdx = out.findIndex((e) => e.done === true);
    if (doneIdx < 0) break;
    out.splice(doneIdx, 1);
  }
  return out;
}

/** Aus einem Fehler (Lücke oder Satzkorrektur) die beiden Sätze „falsch → richtig“ bilden. */
export function errorSentences(q: string, given: string, fill: string): { wrong: string; right: string } {
  if (!q.includes('___')) return { wrong: q, right: fill };
  const g = given.trim();
  return { wrong: q.replace('___', g || '…'), right: q.replace('___', fill) };
}

/** Ist dieselbe Frage schon als offener Fehler da? (Dann ist „nichts anlegen“ richtig und kein Überlauf.) */
export const hasOpenError = (list: readonly ErrorEntry[], q: string): boolean => list.some((x) => x.done !== true && legacyNorm(x.q) === legacyNorm(q));

export const EXPL_MAX = 300;
/** Erklärung der Aufgabe für das „Warum“ beim Wiederholen: nur nicht leere Teile, gekürzt; sonst `null`. */
function explPair(v: { de: string | null; en: string | null } | null | undefined): { de?: string; en?: string } | null {
  const de = v?.de?.trim().slice(0, EXPL_MAX);
  const en = v?.en?.trim().slice(0, EXPL_MAX);
  return de || en ? { ...(de ? { de } : {}), ...(en ? { en } : {}) } : null;
}

/**
 * Neuer Fehler in der alten Form `{q, given, ans, t, src}`. Genau einer je Fehler: Ist dieselbe Frage
 * schon offen, ändert sich nichts. Ist das Thema voll (Deckel 10) und alle Einträge sind offen, wird
 * der neue nicht angelegt – lieber nichts Neues als etwas Offenes zu löschen. Liefert dann dieselbe Liste.
 */
export function addError(
  list: readonly ErrorEntry[],
  e: { q: string; given: string; ans: string; t: number; src: string; expl?: { de: string | null; en: string | null } | null; pat?: string | null },
  max = ERRORS_MAX,
): readonly ErrorEntry[] {
  const k = legacyNorm(e.q);
  if (list.some((x) => x.done !== true && legacyNorm(x.q) === k)) return list;
  const pat = typeof e.pat === 'string' && e.pat.trim() ? e.pat.trim().slice(0, PAT_MAX) : '';
  // Ein offener Eintrag je Muster (§5.7): Ein zweiter Fehler auf dasselbe Muster setzt den vorhandenen auf Box 0, morgen fällig,
  // und hängt den neuen falschen Satz an `more` an. Der Eintrag selbst und seine Felder bleiben erhalten; nur der älteste Zusatzsatz in `more` wird verdrängt, wenn es mehr als 3 werden (die Regel zählt, nicht der Satz).
  if (pat) {
    const idx = list.findIndex((x) => x.done !== true && x.pat === pat);
    if (idx >= 0) {
      const cur = list[idx] as ErrorEntry;
      const dup = Array.isArray(cur.more) && (cur.more as unknown[]).some((m) => m && typeof m === 'object' && legacyNorm((m as Doc).q) === k);
      if (dup) return list;
      const more = [...(Array.isArray(cur.more) ? (cur.more as unknown[]) : []), { q: e.q.slice(0, MORE_TEXT_MAX), given: e.given.slice(0, GIVEN_MAX), ans: e.ans.slice(0, MORE_TEXT_MAX), t: e.t }].slice(-MORE_MAX);
      const out = [...list];
      // `rh`, `last` und `fsrs` bleiben stehen; der Rückfall auf Box 0 ist die Regel des Plans (§5.7), kein Eintrag in `rh`.
      out[idx] = { ...cur, box: 0, done: false, due: addLocalDays(e.t, 1), more };
      return out;
    }
  }
  const out = capErrors(list, max - 1);
  if (out.length >= max) return list;
  const expl = explPair(e.expl);
  return [...out, { q: e.q, given: e.given.slice(0, GIVEN_MAX), ans: e.ans, t: e.t, src: e.src, ...(pat ? { pat } : {}), ...(expl ? { expl } : {}) }];
}

/**
 * Ergebnis einer Fehler-Wiederholung eintragen. `null`, wenn der Eintrag fehlt oder diese
 * Antwort schon angewendet ist (`e.last >= t`). Richtig: Box +1 (ab Box 3 erledigt), falsch: eine Box zurück (Box 0 bleibt 0).
 * Jede Antwort steht zusätzlich in `rh` (`[t, Box vor der Antwort, 1|0]`, höchstens 6).
 * „Fast richtig“ (`near`): Box unverändert, morgen wieder, Note 2 im FSRS-Schatten.
 * `variant`: die Antwort galt einem anderen Satz desselben Musters; `given` des Eintrags bleibt dann unverändert.
 */
export function reviewError(
  list: readonly ErrorEntry[],
  errorT: number,
  r: { ok: boolean; given: string; grade: Grade; t: number; near?: boolean; variant?: boolean },
): ErrorEntry[] | null {
  const idx = list.findIndex((e) => num(e.t) === errorT);
  if (idx < 0) return null;
  const e = list[idx] as ErrorEntry;
  const last = num(e.last);
  if (last !== null && last >= r.t) return null;
  const next: ErrorEntry = { ...e };
  if (r.near) {
    next.done = false;
    next.due = addLocalDays(r.t, 1);
  } else if (r.ok) {
    const box = (num(e.box) ?? 0) + 1;
    next.box = box;
    next.done = box >= REVIEW_DAYS.length;
    next.due = addLocalDays(r.t, REVIEW_DAYS[Math.min(box, REVIEW_DAYS.length - 1)]!);
  } else {
    next.box = Math.max(0, (num(e.box) ?? 0) - 1);
    next.done = false;
    next.due = addLocalDays(r.t, 1);
    // Bei einer Variante (anderer Satz desselben Musters) gehört die Antwort nicht zum Eintrag: `given` bleibt beim Originalsatz.
    if (!r.variant) next.given = r.given.slice(0, GIVEN_MAX);
  }
  next.last = r.t;
  if (!r.near) next.rh = [...(Array.isArray(e.rh) ? (e.rh as unknown[]) : []), [r.t, num(e.box) ?? 0, r.ok ? 1 : 0]].slice(-RH_MAX);
  next.fsrs = shadowFsrs(e.fsrs, r.near ? 2 : r.grade, r.t);
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

const squash = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Was in die Lücke gehört. Normal ist `ans` genau das fehlende Stück. Enthält `ans` auch den
 * Text vor bzw. hinter der Lücke (ganzer Satz), wird dieser abgezogen; bleibt nichts, ist die
 * Antwort leer.
 */
export function gapFill(q: string, ans: string): string {
  const i = q.indexOf('___');
  const before = squash(q.slice(0, i).replace(/\([^)]*\)/g, ''));
  const after = squash(q.slice(i).replace(/^_+/, '').replace(/\([^)]*\)/g, ''));
  const a = ans.replace(/\s+/g, ' ').trim();
  const low = a.toLowerCase();
  const hasBefore = before !== '' && low.startsWith(before + ' ');
  const hasAfter = after !== '' && low.length > after.length && low.endsWith(after) && (/^[^\p{L}\p{N}]/u.test(after) || low.endsWith(' ' + after));
  if (!hasBefore && !hasAfter) return a;
  // Nur eine Seite passt, die andere ist nicht leer: unklar, welcher Teil fehlt → keine Aufgabe.
  if ((before !== '' && !hasBefore) || (after !== '' && !hasAfter)) return '';
  return a.slice(hasBefore ? before.length : 0, a.length - (hasAfter ? after.length : 0)).trim();
}

/** Erklärung zum Fehlersatz: die im Eintrag gespeicherte, sonst die aufgabengenaue Begründung, sonst die der Startaufgabe mit gleichem Schlüssel. */
function explOfError(topic: string, e: ErrorEntry, q: string): { de: string | null; en: string | null } {
  const own = e.expl && typeof e.expl === 'object' && !Array.isArray(e.expl) ? (e.expl as Doc) : null;
  const de = typeof own?.de === 'string' && own.de.trim() ? own.de.trim() : null;
  const en = typeof own?.en === 'string' && own.en.trim() ? own.en.trim() : null;
  if (de || en) return { de, en };
  const key = legacyTaskKey(q);
  const why = mapEntryOf(topic, key)?.why?.ok;
  if (why) return { de: why.de, en: why.en };
  return seedExplOf(key) ?? { de: null, en: null };
}

/** Aufgabe aus einem Fehlereintrag (Port von `reviewItem`): Lücke oder Satzkorrektur. */
export function errorTask(topic: string, e: ErrorEntry): GrammarTask | null {
  const q = str(e.q).trim();
  const ans = str(e.ans).trim();
  const t = num(e.t);
  if (!q || !ans || e.done === true || t === null || legacyNorm(q) === legacyNorm(ans) || !topicById(topic)) return null;
  const gap = q.includes('___');
  // Absicherung (Prüfbericht H1): steht bei einer Lücke der GANZE Satz in `ans`, würde er sonst
  // doppelt in die Lücke gesetzt („I I finished … yesterday. the report yesterday."). Dann den
  // Text vor und hinter der Lücke abziehen; passt er nicht, gibt es keine Aufgabe.
  const fill = gap ? gapFill(q, ans) : ans;
  if (!fill) return null;
  const task: GrammarTask = {
    key: legacyTaskKey(q),
    topic,
    type: gap ? 'gap' : 'correct',
    prompt: q,
    answer: fill,
    accepted: [],
    options: null,
    hint: null,
    expl: { de: null, en: null },
    src: 'review',
    ref: `grammar/${topic}`,
    errorT: t,
  };
  // Hinweis (Grundform) erst beim ersten Lesen: `reviewBase` braucht das Wörterbuch (≈100 ms
  // Parsen bei 4×), `dueErrors` zählt aber schon auf dem Startpfad (leistung.md §3.2 Nr. 3, N45).
  if (gap && !/\([^)]*\)/.test(q)) lazyHint(task, fill);
  // Erklärung ebenfalls erst beim ersten Lesen: Die Startaufgaben und die Zuordnungstabelle zu parsen kostet, `dueErrors` zählt nur.
  lazyExpl(task, topic, e, q);
  return task;
}

function lazyExpl(task: GrammarTask, topic: string, e: ErrorEntry, q: string): void {
  Object.defineProperty(task, 'expl', {
    enumerable: true,
    configurable: true,
    get() {
      const v = explOfError(topic, e, q);
      Object.defineProperty(task, 'expl', { value: v, enumerable: true, writable: true, configurable: true });
      return v;
    },
    set(v: { de: string | null; en: string | null }) {
      Object.defineProperty(task, 'expl', { value: v, enumerable: true, writable: true, configurable: true });
    },
  });
}

function lazyHint(task: GrammarTask, fill: string): void {
  const fix = (v: string | null) => Object.defineProperty(task, 'hint', { value: v, enumerable: true, writable: true, configurable: true });
  Object.defineProperty(task, 'hint', {
    enumerable: true,
    configurable: true,
    get() {
      const base = reviewBase(fill);
      const v = base ? `(${base})` : null;
      fix(v);
      return v;
    },
    set(v: string | null) {
      fix(v);
    },
  });
}

export type DueError = { topic: string; e: ErrorEntry; box: number; due: number; task: GrammarTask };

/** Fällige Fehler aller Themen, älteste Fälligkeit zuerst; dieselbe Frage nur einmal. */
export function dueErrors(grammarDocs: ReadonlyMap<string, Readonly<Doc>>, nowMs: number): DueError[] {
  const out: DueError[] = [];
  const seen = new Set<string>();
  for (const [topic, doc] of grammarDocs) {
    for (const e of [...liveErrorsOf(doc, topic)].reverse()) {
      const k = legacyNorm(e.q);
      if (seen.has(k)) continue;
      seen.add(k);
      const due = errorDue(e);
      if (!isDueToday(due, nowMs)) continue;
      const task = errorTask(topic, e);
      if (task) out.push({ topic, e, box: num(e.box) ?? 0, due, task });
    }
  }
  return out.sort((a, b) => a.due - b.due || (a.task.errorT ?? 0) - (b.task.errorT ?? 0));
}
