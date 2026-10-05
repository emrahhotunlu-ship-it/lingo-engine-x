import { validateDoc } from '../../data/validate';
import { defaultTopic, topicById } from '../content';
import type { GrammarAnswer } from '../learn/types';
import { bktStep, displayP, nextDue, p0Of } from './bkt';
import type { NewRepair } from '../repair/repair';
import { addError, errorSentences, errorsOf, gapFill, hasOpenError, reviewError } from './errors';

// Schreibweg `grammar/<topic>` je bewerteter Antwort (phase2-plan §4.3, 1:1 wie `updateTopic`
// der alten App, session.js:431–436). Rein; ausgeführt im Writer per `transform` auf dem
// frischen Stand. Der Zeitstempel der Antwort (`a.t`, aus `nextT()`) ist zugleich der
// Idempotenzschlüssel: `last === a.t` heißt „schon angewendet".
//
// Mehr-Tab: Der letzte Schreiber gewinnt. Schlimmstenfalls fehlt eine Antwort in `n`/`c`,
// doppelt gezählt wird nie (akzeptiert, getestet).

type Doc = Record<string, unknown>;

export type GrammarSkip = 'unknown_topic' | 'invalid' | 'already_applied' | 'stale_answer';
/**
 * `overflow`: Das Thema hat schon 10 offene Fehlersätze – der neue Fehler wird nicht verworfen, sondern als Reparatur-Satz
 * angeboten (`app/repair`, Prüfbefund S1); den Schreibweg übernimmt der Aufrufer.
 */
export type GrammarWrite = { kind: 'create'; doc: Doc; overflow?: NewRepair } | { kind: 'update'; patch: Doc; overflow?: NewRepair } | { kind: 'skip'; reason: GrammarSkip };

export const HIST_MAX = 40;
export const RECENT_MAX = 10;
export const SEEN_MAX = 80;
export const SEEN_TEXT_MAX = 20;

const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** Nur die geänderten Felder für eine Antwort; `cur` = frischer Stand (`defaultTopic` bei Neuanlage). */
function patchFor(cur: Doc, a: GrammarAnswer): { patch: Doc; overflow?: NewRepair } {
  const topic = a.task.topic;
  const p0 = p0Of(topic);
  const t = a.t;
  // Richtig erst nach Hinweis (Lernwissenschaft 27.09.): für Beherrschung, Fälligkeit und Fehler falsch.
  const ok = !a.dontKnow && a.verdict !== 'wrong' && a.firstWrong === undefined;
  const pNow = displayP(num(cur.p, p0), p0, typeof cur.last === 'number' && cur.last > 0 ? cur.last : null, t);
  const step = bktStep({
    p: pNow,
    anchor: typeof cur.anchor === 'number' ? cur.anchor : null,
    anchorD: typeof cur.anchorD === 'string' ? cur.anchorD : null,
    day: a.day,
    ok,
    type: a.task.type,
    nOptions: a.task.options?.length ?? null,
    helpLevel: a.help.level,
  });
  const patch: Doc = {
    p: step.p,
    n: num(cur.n, 0) + 1,
    c: num(cur.c, 0) + (ok ? 1 : 0),
    last: t,
    due: nextDue(ok, step.p, t),
  };
  if (step.anchorChanged) {
    patch.anchor = step.anchor;
    patch.anchorD = step.anchorD;
  }
  const hist = arr(cur.hist).slice();
  const lastH = hist[hist.length - 1] as Doc | undefined;
  const entry = { d: a.day, p: round3(step.p) };
  if (lastH && typeof lastH === 'object' && lastH.d === a.day) hist[hist.length - 1] = entry;
  else hist.push(entry);
  patch.hist = hist.slice(-HIST_MAX);
  patch.recent = [...arr(cur.recent), ok ? 1 : 0].slice(-RECENT_MAX);
  patch.seen = [...arr(cur.seen), a.task.key].slice(-SEEN_MAX);
  patch.seenText = [...arr(cur.seenText), a.task.prompt].slice(-SEEN_TEXT_MAX);

  const errors = errorsOf(cur);
  let overflow: NewRepair | undefined;
  if (a.task.errorT !== null) {
    const next = reviewError(errors, a.task.errorT, { ok, given: a.dontKnow ? '' : a.given, grade: a.grade, t });
    if (next) patch.errors = next;
  } else if (!ok) {
    // Jede falsche Antwort und auch „Weiß ich nicht“ (`given` leer, die Anzeige sagt dann „Weiß ich nicht“) ergibt genau einen Fehlersatz.
    const next = addError(errors, { q: a.task.prompt, given: a.dontKnow ? '' : (a.firstWrong ?? a.given), ans: a.task.answer, t, src: a.task.src, expl: a.task.expl });
    if (next !== errors) patch.errors = next;
    else if (!hasOpenError(errors, a.task.prompt)) overflow = overflowRepair(a);
  }
  return { patch, ...(overflow ? { overflow } : {}) };
}

/** Der Fehler als Reparatur-Satz („falsch → richtig“ mit Erklärung), wenn das Thema voll ist. */
function overflowRepair(a: GrammarAnswer): NewRepair | undefined {
  const q = a.task.prompt.trim();
  const fill = q.includes('___') ? gapFill(q, a.task.answer) : a.task.answer;
  if (!q || !fill) return undefined;
  const { wrong, right } = errorSentences(q, a.dontKnow ? '' : (a.firstWrong ?? a.given), fill);
  const why = a.lang === 'de' ? (a.task.expl.de ?? a.task.expl.en) : (a.task.expl.en ?? a.task.expl.de);
  return { wrong, right, why: why ?? null, src: 'lesson' };
}

export function grammarWrite(cur: Readonly<Doc> | undefined, a: GrammarAnswer): GrammarWrite {
  const topic = a.task.topic;
  const tp = topicById(topic);
  if (!cur) {
    if (!tp) return { kind: 'skip', reason: 'unknown_topic' };
    const base = defaultTopic(tp);
    const r = patchFor(base, a);
    return { kind: 'create', doc: { ...base, ...r.patch }, ...(r.overflow ? { overflow: r.overflow } : {}) };
  }
  if (!validateDoc(`grammar/${topic}`, cur).ok) return { kind: 'skip', reason: 'invalid' };
  const last = typeof cur.last === 'number' ? cur.last : 0;
  if (last === a.t) return { kind: 'skip', reason: 'already_applied' };
  if (last > a.t) return { kind: 'skip', reason: 'stale_answer' };
  const r = patchFor({ ...cur }, a);
  return { kind: 'update', patch: r.patch, ...(r.overflow ? { overflow: r.overflow } : {}) };
}
