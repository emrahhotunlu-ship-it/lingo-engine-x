import type { WordOp } from '../domain/learn/types';
import { EnglishText } from './EnglishText';
import type { WordTapArea } from './wordTap';

// Wort-für-Wort-Vergleich nach dem Prüfen (phase2-plan §5.0 Nr. 1): „Deine Antwort" mit
// markierten Abweichungen (fehlend, zu viel, ersetzt, Tippfehler), darunter „Richtig" als
// antippbarer Satz. Nie Farbe allein: Abweichungen sind zusätzlich durch-/unterstrichen und
// fehlende Wörter als eigene Markierung eingefügt.

type Props = {
  ops: readonly WordOp[];
  /** Eingabe, wie sie gewertet wurde (wenn `ops` leer ist, wird sie unverändert gezeigt). */
  given: string;
  /** Richtige Fassung (ganzer Satz oder Lösung). */
  correct: string;
  labels: { yours: string; correct: string; empty: string; missing: string };
  area?: WordTapArea;
  source?: string | null;
  /** Nur die richtige Fassung zeigen (z. B. bei richtiger Antwort). */
  onlyCorrect?: boolean;
};

export function SentenceDiff({ ops, given, correct, labels, area = 'trainer', source = null, onlyCorrect = false }: Props) {
  return (
    <div className="flex flex-col gap-1.5 text-[0.95rem] leading-relaxed" data-testid="sentence-diff">
      {!onlyCorrect && (
        <p>
          <span className="text-muted">{labels.yours}: </span>
          <span lang="en" data-testid="diff-given">
            {!given.trim() ? (
              <span className="text-muted">{labels.empty}</span>
            ) : ops.length ? (
              ops.map((o, i) => {
                const sep = i > 0 ? ' ' : '';
                switch (o.op) {
                  case 'eq':
                    return <span key={i}>{sep + (o.given ?? '')}</span>;
                  case 'typo':
                    return (
                      <span key={i}>
                        {sep}
                        <span className="lx-diff-near" data-op="typo">
                          {o.given}
                        </span>
                      </span>
                    );
                  case 'sub':
                  case 'ins':
                    return (
                      <span key={i}>
                        {sep}
                        <span className="lx-diff-off" data-op={o.op}>
                          {o.given}
                        </span>
                      </span>
                    );
                  case 'del':
                    return (
                      <span key={i}>
                        {sep}
                        <span className="lx-diff-missing" data-op="del" title={labels.missing} aria-label={`${labels.missing}: ${o.expected ?? ''}`}>
                          {o.expected}
                        </span>
                      </span>
                    );
                  default:
                    return null;
                }
              })
            ) : (
              given
            )}
          </span>
        </p>
      )}
      <p>
        <span className="text-muted">{labels.correct}: </span>
        <EnglishText as="span" text={correct} area={area} source={source} testId="diff-correct" className="font-semibold" />
      </p>
    </div>
  );
}
