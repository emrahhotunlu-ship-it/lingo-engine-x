import type { GrammarAnswer } from './types';

/**
 * Zählt die Antwort als richtig? Die eine Regel für Beherrschung (BKT), Fehlersätze, Protokoll und Zähler.
 * Alte Aufgaben: nicht „Weiß ich nicht“ und nicht falsch (fast richtig zählt als richtig).
 * c1x-Aufgaben (`pts` gesetzt, Lernplattform 3.0 §3.4): **nur die volle Punktzahl** — „1 von 2“ ist „Fast“, hebt nichts und wird ein Fehlersatz.
 */
export function answerRight(a: Pick<GrammarAnswer, 'dontKnow' | 'verdict' | 'pts'>): boolean {
  if (a.dontKnow) return false;
  if (a.pts) return a.pts[0] >= a.pts[1] && a.verdict === 'correct';
  return a.verdict !== 'wrong';
}
