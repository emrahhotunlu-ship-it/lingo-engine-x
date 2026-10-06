import { gradeAnswer } from '../grade';
import type { Grade } from '../srs/types';
import type { GrammarTaskType, Help, Timing, Verdict } from './types';

// Note für Grammatik und Übungen (phase2-plan §5.0, CLAUDE.md A7 „keine Selbstbewertung"):
// allein aus Richtigkeit, Zeit und genutzter Hilfe. Gleiches Muster wie `autoGrade` des
// Vokabeltrainers (srs/grade.ts): falsch → 1, fast richtig → 2, richtig → nach Zeit 2/3/4,
// gedeckelt durch Hilfe (Hilfe 1 → höchstens 3, Hilfe 2 → höchstens 2).

export type LearnKind = GrammarTaskType | 'dictate' | 'cloze' | 'order';

export function learnGrade(kind: LearnKind, verdict: Verdict, timing: Timing, help: Help): Grade {
  // Die Tabelle steht in `domain/grade` (eine Notentabelle für Wörter und Grammatik).
  // Vorläufig (Lernplattform 2.0 §10.0): meaning → mc, find → correct, kwt → transform, bis P4/P5 eigene Schlüssel liefern.
  const kinds = { mc: 'mc', gap: 'gap', transform: 'transform', correct: 'correct', meaning: 'mc', find: 'correct', kwt: 'transform', dictate: 'dictate', cloze: 'cloze', order: 'order' } as const;
  return gradeAnswer({
    key: kinds[kind],
    verdict,
    timeMs: timing.submitMs,
    firstKeyMs: timing.firstKeyMs,
    units: timing.units,
    replays: Math.max(help.replays ?? 0, timing.replays ?? 0),
    help: help.level,
  });
}
