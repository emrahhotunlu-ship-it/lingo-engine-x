import type { ExplainLine, ExplanationModel } from '../explain/types';
import type { Diagnosis } from './diagnose';
import type { Verdict } from './tutorTypes';

// Rückmeldung der Tutor-Engine (docs/umbau/tutor-engine-v3.md §5): rein, ohne Oberfläche und ohne Texte im Code (die Texte kommen fertig
// übersetzt herein, `texts`). Reihenfolge: Ziel → Urteil → seine Form → Grund → höchstens ein Extra → Handlung.
//   - Ziel = die Musterzeile (`pattern`); sie zählt nicht zu den Erklärzeilen.
//   - Urteil steht im Kopf der Karte (Titel/Untertitel des Gerüsts), nicht in den Zeilen.
//   - Höchstens 3 Erklärzeilen: „Deine Antwort“ (seine Form), „Warum“ (Grund) und genau ein Extra.
//   - Extra: Kontrast („Nicht verwechseln“) nur mit Beleg – Ursache `confuse` in DIESER Antwort oder eine offene Annahme zum eigenen Muster;
//     sonst der typische Fehler (Lernphase) oder ein Hinweis. Bei „Auch richtig“ ist das Extra der Hinweis „zählt noch nicht als geübt“.
//   - Handlung: Zielform schreiben (Auch richtig, Ziel verfehlt) · „Zählt“ (Claude: trifft das Ziel) · „Claude fragen“ (Knopf) · Weiter.
// Die Ausgabe ist wieder ein `ExplanationModel` (Beispiele, Markierung und Herkunft bleiben aus `grammarExplanation`).

export type FeedbackAction = 'next' | 'targetForm' | 'counts' | 'askAi';
export type FeedbackExtra = 'contrast' | 'mistake' | 'note' | null;

export type FeedbackIn = {
  /** Erklärung aus dem Muster der Aufgabe (`grammarExplanation`, schon gekürzt). */
  base: ExplanationModel;
  v: Verdict;
  by: 'local' | 'ai' | 'me';
  fitsGoal: boolean | null;
  dontKnow: boolean;
  override: boolean;
  dx: Diagnosis | null;
  /** Muster der Aufgabe (für offene Annahmen). */
  pat: string | null;
  /** Offene, stille und erledigte Annahmen des Lernermodells (nur `open` zählt als Beleg). */
  hyps: ReadonlyArray<{ from: string; to: string; state: string }>;
  /** Begründung von Claude (Sprache schon gewählt) bzw. einer anderen gültigen Korrektur (`errAlt`). */
  aiWhy: string | null;
  altWhy: string | null;
  askAi: 'auto' | 'button' | 'no';
  /** Zweitversuch „Zielform“ schon gemacht (dann nicht noch einmal anbieten). */
  targetTried: boolean;
  texts: { altNoCount: string };
};

export type FeedbackOut = {
  model: ExplanationModel;
  extra: FeedbackExtra;
  action: FeedbackAction;
  /** Erklärzeilen ohne Ziel (≤ 3). */
  lines: number;
  /** Beleg für den Kontrast (nur Diagnose und Tests). */
  proof: 'confuse' | 'hyp' | null;
};

export const FEEDBACK_MAX_LINES = 3;

/** Beleg für „Nicht verwechseln“: Verwechslung in dieser Antwort oder offene Annahme zum geübten Muster. */
export function contrastProof(dx: Diagnosis | null, pat: string | null, hyps: FeedbackIn['hyps']): 'confuse' | 'hyp' | null {
  if (dx?.cause === 'confuse') return 'confuse';
  if (pat && hyps.some((h) => h.state === 'open' && h.from === pat)) return 'hyp';
  return null;
}

export function composeFeedback(i: FeedbackIn): FeedbackOut {
  const L = i.base.lines;
  const goal = L.filter((l): l is Extract<ExplainLine, { k: 'pattern' }> => l.k === 'pattern').slice(0, 1);
  const altOk = i.v === 'alt_ok' && !i.override;
  const yours = altOk ? [] : L.filter((l) => l.k === 'yours').slice(0, 1);
  const ownWhy = i.altWhy ?? (altOk ? i.aiWhy : null);
  const why: ExplainLine[] = ownWhy ? [{ k: 'why', text: ownWhy }] : altOk ? [] : L.filter((l) => l.k === 'why').slice(0, 1);

  const proof = contrastProof(i.dx, i.pat, i.hyps);
  let extra: FeedbackExtra = null;
  let extraLine: ExplainLine | null = null;
  if (altOk && i.fitsGoal !== true) {
    extra = 'note';
    extraLine = { k: 'note', text: i.texts.altNoCount };
  } else {
    const contrast = L.find((l) => l.k === 'contrast');
    const mistake = L.find((l) => l.k === 'mistake');
    const note = L.find((l) => l.k === 'note');
    if (contrast && proof) [extra, extraLine] = ['contrast', contrast];
    else if (mistake) [extra, extraLine] = ['mistake', mistake];
    else if (note) [extra, extraLine] = ['note', note];
  }

  const body: ExplainLine[] = [...yours, ...why, ...(extraLine ? [extraLine] : [])].slice(0, FEEDBACK_MAX_LINES);
  const action: FeedbackAction =
    altOk && i.fitsGoal !== true && !i.targetTried && !i.dontKnow
      ? 'targetForm'
      : altOk && i.by === 'ai' && i.fitsGoal === true
        ? 'counts'
        : !i.dontKnow && !i.override && (i.v === 'wrong' || i.v === 'unsure') && i.askAi === 'button'
          ? 'askAi'
          : 'next';
  return {
    model: { ...i.base, lines: [...goal, ...body], ai: i.base.ai || (altOk && !!i.aiWhy && i.by === 'ai') },
    extra: body.includes(extraLine as ExplainLine) ? extra : null,
    action,
    lines: body.length,
    proof,
  };
}
