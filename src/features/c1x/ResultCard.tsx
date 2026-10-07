import type { ReactNode } from 'react';
import type { C1Item, C1Reason, C1Score } from '../../domain/c1x/types';
import type { WhyRule } from '../../domain/explain/types';
import { useT, type MessageKey } from '../../i18n';
import { PartBar } from './PartBar';
import { WhyList } from './WhyList';

// Ergebnis-Teile des Rahmens (Lernplattform 3.0 §3.5, P14), die in das Gerüst `ExerciseShell` einhängen: Urteilszeile mit Punkten und Grund,
// Teilpunkte unter dem Urteil, „Warum nicht …?“ unter der Erklär-Karte. Die Erklär-Karte selbst (Muster, Deine Antwort, Warum, Beispiele) kommt aus
// `grammarExplanation`; das Gerüst bestimmt Reihenfolge und Darstellung.

const REASON: Record<C1Reason, MessageKey> = {
  key: 'cxReasonKey',
  length: 'cxReasonLength',
  trap: 'cxReasonTrap',
  family: 'cxReasonFamily',
  falseAlarm: 'cxReasonFalseAlarm',
  missed: 'cxReasonMissed',
  typo: 'cxReasonTypo',
  unsure: 'cxReasonUnsure',
};

/** Die Zeile unter dem Urteil: „1 von 2 · Das Schlüsselwort muss unverändert dastehen.“ (nur was zutrifft). */
export function useResultSub(score: C1Score): string | null {
  const { t } = useT();
  const parts: string[] = [];
  if (score.max > 1) parts.push(t('cxPoints', { got: score.got, max: score.max }));
  if (score.reason) parts.push(t(REASON[score.reason]));
  if (score.us) parts.push(t('cxUsHint', { us: score.us }));
  return parts.length ? parts.join(' · ') : null;
}

export function ResultParts({ score }: { score: C1Score }): ReactNode {
  return <PartBar parts={score.parts} />;
}

export function ResultAfter({ item, matched }: { item: C1Item; matched: WhyRule | null }) {
  const { t } = useT();
  return (
    <>
      <WhyList item={item} matched={matched} />
      {item.kind === 'kwt' && (
        <p className="lx-t-meta mt-2 text-muted" data-testid="cambridge-note">
          {t('cxCambridge')}
        </p>
      )}
    </>
  );
}
