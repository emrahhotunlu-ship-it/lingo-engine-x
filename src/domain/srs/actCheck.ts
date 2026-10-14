import { HIDES_TARGET } from './actBrief';
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
/** Sätze: Satzzeichen mit Abstand oder am Ende, plus ein Rest ohne Schlusspunkt (am Handy fehlt der Schlusspunkt oft, Englischlehrer A6). */
export function sentenceCount(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  const marks = (t.match(/[.!?]+(?=\s|$)/g) ?? []).length;
  return marks + (/[.!?]\s*$/.test(t) ? 0 : 1);
}

/** Steht ein Wort derselben Wortfamilie im Text? Einzelwort ab sechs Buchstaben: gleicher Anfang (Grundform ohne die letzten zwei Buchstaben). */
function sameFamily(text: string, t: Pick<ActTask['targets'][number], 'lemma' | 'kind'>): boolean {
  if (t.kind !== 'vocab') return false;
  const lemma = t.lemma.trim().toLowerCase();
  if (/\s/.test(lemma) || lemma.replace(/[^a-z]/g, '').length < 6) return false;
  const stem = lemma.slice(0, lemma.length - 2);
  return (text.toLowerCase().match(/[a-z']+/g) ?? []).some((w) => w.startsWith(stem));
}

/** Mindestzahl Wörter je Format: genug für einen echten Satz, ohne kurze Antworten zu bestrafen. */
export const MIN_WORDS: Readonly<Record<ActTask['fmt'], number>> = { sc: 5, tw: 4, rw: 3, ex: 6, im: 4, lg: 4, kb: 6, ml: 14 };
/** Die Kundenmail braucht mindestens so viele Sätze. */
export const MAIL_MIN_SENTENCES = 2;

const SHAPE_RE: Readonly<Record<string, RegExp>> = {
  r: /\b(?:because|since|as|so that|due to|owing to|thanks to|given that|the reason|in order to|to avoid|to make sure|for\s+(?:\w+\s+){0,2}reasons?)\b/i,
  c: /\b(?:so|therefore|hence|thus|which means|as a result|resulting in|leading to|that is why|this means|consequently|then|otherwise|and that)\b/i,
  e: /\b(?:for example|for instance|such as|e\.g\.|like|including)\b/i,
  x: /\b(?:but|however|although|though|while|whereas|yet|despite|in spite of|nevertheless|instead|rather than|unlike|even if|on the other hand|still)\b/i,
};

/** Die ersten zwei Wörter: „The team …“ gegen „The team …“ ist derselbe Anfang, „The rollout …“ ein anderer (Englischlehrer, Vorprüfung). */
const opening = (s: string): string => (s.trim().toLowerCase().match(/[a-z']+/g) ?? []).slice(0, 2).join(' ');

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
    if (shape === 'k') return !source || wordCount(text) < wordCount(source.text);
    if (shape === 'o') return !source || opening(text) !== opening(source.text);
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
  // Bei verdecktem Wort zählt auch ein Wort derselben Familie (postponement für postpone): Der Lernende sieht die Wortart nicht (Englischlehrer A4).
  const hidden = HIDES_TARGET.has(task.fmt);
  const missing = task.targets.filter((t) => !usesTarget(text, t) && !(hidden && sameFamily(text, t))).map((t) => t.word);
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
 * Note einer Aktivierung aus Claudes Prüfung (nie „Leicht“): NUR das Hauptzielwort (`targets[0]`) und der Satz entscheiden – ein Fehler am Partnerwort einer
 * Kombi-Aufgabe oder Kundenmail bestraft die Karte der Aufgabe nicht (Lernwissenschaft H2). Fehlt das Hauptwort oder ist es falsch benutzt → Nochmal;
 * sonst bei kleinem Fehler (oder verfehlter Vorgabe, oder mit Hinweis der Vorprüfung) → Schwer; sonst Gut. `mainVerdict` = Urteil ohne Partnerwörter
 * (fehlt es, gilt das Gesamturteil; „falsch“ bei richtigem Hauptwort zählt dann wie „kleiner Fehler“).
 */
export function activateGrade(
  out: { verdict: 'correct' | 'minor' | 'wrong'; mainVerdict?: 'correct' | 'minor' | 'wrong'; alt?: string; targets: ReadonlyArray<{ used: boolean; correct: boolean }> },
  helped: boolean,
): Grade {
  const main = out.targets[0];
  // Ein richtiges Ersatzwort statt des verdeckten Zielworts (A4) ist ein Teilerfolg: „Schwer“, nicht „Nochmal“ (Englischlehrer A4).
  if (!main || !main.used || !main.correct) return out.alt?.trim() ? 2 : 1;
  const mv = out.mainVerdict ?? out.verdict;
  if (mv !== 'correct') return 2;
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
