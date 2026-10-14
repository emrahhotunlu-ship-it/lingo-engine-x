import type { ActTask } from './actTask';
import { fitsForm, germanHints, BLOCKING_HINTS, closestShown, jaccard, targetSkip, usesTarget, type GermanHintId } from './produce';
import type { Grade } from './types';

// Lokale Vorprüfung der Aktivierungs-Aufgaben A2–A5 (Wörter aktivieren, Stufe 2): läuft VOR jedem Claude-Aufruf, ohne KI. Fällt der Text durch, gibt es sofort
// eine Rückmeldung und einmal die Chance nachzubessern. Geprüft wird nur, was sich sicher prüfen lässt: alle Zielwörter vorhanden, Länge, Neuheit (auch gegen
// frühere eigene Sätze), Satzform bzw. Umschreib-/Erweiterungsart, eindeutige Deutsch-Fehler. Ton, Zeitform und Textsorte beurteilt Claude.

export type ActIssue = 'target' | 'short' | 'copied' | 'same' | 'shape' | 'german';
export type ActPrecheck = {
  issue: ActIssue | null;
  /** Bei `target`: die fehlenden Zielwörter (Grundformen/Wendungen), in der Reihenfolge der Aufgabe. */
  missing: string[];
  /** Bei `copied`: der Satz, dem der eigene zu ähnlich ist. */
  closest?: string;
  hints: GermanHintId[];
  block: GermanHintId[];
};

const wordCount = (s: string): number => s.split(/[^A-Za-z0-9'’]+/).filter(Boolean).length;
const sentenceCount = (s: string): number => (s.match(/[.!?](?:\s|$)/g) ?? []).length || (s.trim() ? 1 : 0);

/** Mindestzahl Wörter je Format: genug für einen echten Satz, ohne kurze Antworten zu bestrafen. */
export const MIN_WORDS: Readonly<Record<ActTask['fmt'], number>> = { sc: 5, tw: 4, rw: 3, ex: 6, im: 4, lg: 4, kb: 6, ml: 14 };
/** Die Kundenmail braucht mindestens so viele Sätze. */
export const MAIL_MIN_SENTENCES = 2;

const SHAPE_RE: Readonly<Record<string, RegExp>> = {
  r: /\b(?:because|since|as|so that|due to|given that|the reason|in order to|to avoid|to make sure)\b/i,
  c: /\b(?:so|therefore|which means|as a result|that is why|this means|consequently|then|otherwise|and that)\b/i,
  e: /\b(?:for example|for instance|such as|e\.g\.|like|including)\b/i,
  x: /\b(?:but|however|although|though|while|whereas|yet|even if|on the other hand|still)\b/i,
};

const firstWord = (s: string): string => (s.trim().toLowerCase().match(/[a-z']+/)?.[0] ?? '');

/** Hält der Text die Besonderheit der Aufgabe ein (soweit lokal prüfbar)? */
export function fitsShape(text: string, task: Pick<ActTask, 'fmt' | 'shape' | 'source'>): boolean {
  const { fmt, shape, source } = task;
  if (fmt === 'sc' || fmt === 'im' || fmt === 'lg') return fitsForm(text, shape as 's' | 'q' | 'n' | 'i');
  if (fmt === 'ex') {
    const re = SHAPE_RE[shape];
    // Erweitert heißt länger als der Ausgangssatz und mit dem passenden Verbinder.
    return (!source || wordCount(text) > wordCount(source.text)) && (!re || re.test(text));
  }
  if (fmt === 'rw') {
    if (shape === 'k') return !source || wordCount(text) <= wordCount(source.text);
    if (shape === 'o') return !source || firstWord(text) !== firstWord(source.text);
    return true;
  }
  if (fmt === 'ml') return sentenceCount(text) >= MAIL_MIN_SENTENCES;
  return true;
}

/**
 * Vorprüfung in fester Reihenfolge: Zielwort fehlt → zu kurz → abgeschrieben/unverändert → Besonderheit nicht eingehalten → typischer Deutsch-Fehler.
 * `shown` = Sätze, die die Karte schon zeigte (Ursprung, Beispiele, Rotation), `own` = frühere eigene Sätze der Karte. Rein, ohne KI.
 */
export function precheckAct(text: string, task: ActTask, shown: readonly string[], own: readonly string[] = []): ActPrecheck {
  const hints = germanHints(text, 10);
  const block = hints.filter((h) => BLOCKING_HINTS.has(h));
  const missing = task.targets.filter((t) => !usesTarget(text, t)).map((t) => t.word);
  if (missing.length) return { issue: 'target', missing, hints, block };
  if (wordCount(text) < MIN_WORDS[task.fmt]) return { issue: 'short', missing: [], hints, block };
  const src = task.source?.text ?? null;
  // Beim Umformen ist der Ausgangssatz erlaubt – aber nicht unverändert.
  if (src && (jaccard(text, src) >= 0.95 || text.trim().toLowerCase() === src.trim().toLowerCase())) return { issue: 'same', missing: [], hints, block };
  const skip = new Set<string>();
  for (const t of task.targets) for (const w of targetSkip(t)) skip.add(w);
  const refs = [...shown.filter((s) => !src || s !== src), ...own.filter((s) => s !== src)];
  const near = closestShown(text, refs, skip);
  if (near?.copied) return { issue: 'copied', missing: [], closest: near.sentence, hints, block };
  if (!fitsShape(text, task)) return { issue: 'shape', missing: [], hints, block };
  if (block.length) return { issue: 'german', missing: [], hints, block };
  return { issue: null, missing: [], hints, block };
}

/** Mängel, bei denen der Text auch nach dem Nachbessern lokal als „Noch nicht“ endet; Besonderheit und Deutsch-Fehler gehen danach zu Claude. */
export const ACT_HARD_ISSUES: ReadonlySet<ActIssue> = new Set<ActIssue>(['target', 'short', 'copied', 'same']);

/**
 * Note einer Aktivierung aus Claudes Prüfung (nie „Leicht“): Das Hauptzielwort entscheidet (`targets[0]`). Fehlt es oder ist es falsch benutzt → Nochmal;
 * sonst bei kleinem Fehler (oder verfehlter Vorgabe, oder mit Hinweis der Vorprüfung) → Schwer; sonst Gut.
 */
export function activateGrade(out: { verdict: 'correct' | 'minor' | 'wrong'; targets: ReadonlyArray<{ used: boolean; correct: boolean }> }, helped: boolean): Grade {
  const main = out.targets[0];
  if (!main || !main.used || !main.correct) return 1;
  if (out.verdict !== 'correct') return 2;
  return helped ? 2 : 3;
}

/** Lokales Urteil ohne Claude (Claude nicht erreichbar): höchstens „Schwer“, ungeprüft. Alle Zielwörter da, lang genug, nicht abgeschrieben → 2, sonst 1. */
export function selfCheckAct(text: string, task: ActTask, shown: readonly string[], own: readonly string[] = []): { grade: Grade; pre: ActPrecheck } {
  const pre = precheckAct(text, task, shown, own);
  const main = task.targets[0];
  const mainOk = !!main && usesTarget(text, main);
  const grade: Grade = !mainOk || pre.issue === 'short' || pre.issue === 'copied' || pre.issue === 'same' || pre.issue === 'target' ? 1 : 2;
  return { grade, pre };
}
