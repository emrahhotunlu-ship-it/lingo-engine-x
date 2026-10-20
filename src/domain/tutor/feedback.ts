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
//   - Handlung: Zielform schreiben (Auch richtig, Ziel verfehlt) · „Als richtig werten“ (Claude: trifft das Ziel) · „Claude fragen“ (Knopf) · Weiter.
//   - Emrahs Entscheidung (`by: 'me'`) und „unsicher“ bekommen eine neutrale Zeile statt „Richtig: …“ (kein Widerspruch zum Kopf).
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
  texts: {
    altNoCount: string;
    /** Emrahs Einspruch, „Als richtig werten“ oder ein früher gemerkter Einspruch (`by: 'me'`): neutrale Zeile statt „Richtig: …“ (UX-Prüfung 19.10.2026). */
    byMe?: { head: string; text: string } | null;
    /** Unsicher (lokal nicht prüfbar): „Erwartet war …“ statt „Richtig: …“ unter „Fast richtig“. */
    unsure?: { head: string; text: string } | null;
    /** Überschrift einer Begründung von Claude („Claude sagt“), damit die Herkunft an der Zeile steht. */
    claudeHead?: string;
  };
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

/** Begründung von Claude knapp (≤ 140 Zeichen, ganze Sätze; am Handy höchstens drei Zeilen). */
export function brief(text: string, max = 140): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const parts = t.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [];
  let out = '';
  for (const p of parts) {
    if ((out + p).trim().length > max) break;
    out += p;
  }
  if (out.trim()) return out.trim();
  const cut = t.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 20)).trimEnd()} …`;
}

export function composeFeedback(i: FeedbackIn): FeedbackOut {
  const L = i.base.lines;
  const goal = L.filter((l): l is Extract<ExplainLine, { k: 'pattern' }> => l.k === 'pattern').slice(0, 1);
  // Emrahs Entscheidung gilt (Einspruch, „Als richtig werten“, früher gemerkt): die Karte widerspricht ihr nicht mit „Richtig: …“ – eine
  // neutrale Zeile sagt, was passiert ist (vorgemerkt, der Lehrer schaut es an). Kein Zusatz, keine Handlung.
  if (i.by === 'me' && i.texts.byMe && !i.dontKnow) {
    const body: ExplainLine[] = [{ k: 'yours', given: '', text: i.texts.byMe.text, head: i.texts.byMe.head }];
    return { model: { ...i.base, lines: [...goal, ...body], ai: false }, extra: null, action: 'next', lines: body.length, proof: null };
  }
  const altOk = i.v === 'alt_ok' && !i.override;
  // Unsicher: „Erwartet war …“ statt der Begründung der Lösung („Richtig: …“ neben „Nicht sicher prüfbar“ widerspräche sich).
  const unsure = i.v === 'unsure' && !i.dontKnow && !i.override && i.texts.unsure ? i.texts.unsure : null;
  const yours: ExplainLine[] = unsure ? [{ k: 'yours', given: '', text: unsure.text, head: unsure.head }] : altOk ? [] : L.filter((l) => l.k === 'yours').slice(0, 1);
  const fromAi = !i.altWhy && altOk && !!i.aiWhy;
  const ownWhy = i.altWhy ?? (altOk && i.aiWhy ? brief(i.aiWhy) : null);
  const why: ExplainLine[] = ownWhy
    ? [{ k: 'why', text: ownWhy, ...(fromAi && i.texts.claudeHead ? { head: i.texts.claudeHead } : {}) }]
    : altOk || unsure
      ? []
      : L.filter((l) => l.k === 'why').slice(0, 1);

  const proof = contrastProof(i.dx, i.pat, i.hyps);
  let extra: FeedbackExtra = null;
  let extraLine: ExplainLine | null = null;
  if (altOk && i.fitsGoal !== true) {
    extra = 'note';
    extraLine = { k: 'note', text: i.texts.altNoCount };
  } else if (fromAi) {
    // Nach Claudes Urteil kein Inhalt der Aufgabe zwischen Claudes Begründung und „von Claude“ (UX-Prüfung 19.10.2026).
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
