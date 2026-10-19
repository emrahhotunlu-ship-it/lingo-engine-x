import { cardStatus } from '../../domain/metrics';
import { FREE_DAYS_GOAL } from '../../domain/metrics/cardStatus';
import type { TrainCard } from '../../domain/srs/types';
import { useT } from '../../i18n';
import { StateDots } from './StateDots';
import { STATE_WORD, mindAdds, mindLine, statusDetail } from './statusText';

// Der EINE Status im Wortblatt (Paket ST): oben eine Zeile „Zustand · Beleg · zuletzt falsch“, darunter „Jetzt im Kopf“ und die Leiter der Belege.
// Liste, Übung, Hub und Fortschritt lesen dieselbe Rechnung (`cardStatus`) und dieselben Texte (`statusText`).

type Card = Pick<TrainCard, 'isNew' | 'stage' | 'fsrs' | 'doc'>;

export function StatusHeader({ card, now }: { card: Card; now: number }) {
  const { t, dateShort } = useT();
  const st = cardStatus(card, now);
  return (
    <>
      <div className="flex flex-col gap-1" data-testid="word-status" data-state={st.tier}>
        <p className="m-0 flex items-center gap-2 text-sm font-medium text-fg">
          <StateDots state={st.tier} />
          <span data-testid="word-status-word">{t(STATE_WORD[st.tier])}</span>
        </p>
        <p className="m-0 text-sm text-muted" data-testid="word-status-detail">
          {statusDetail(st, t, dateShort)}
        </p>
      </div>
      {!card.isNew && mindAdds(st) && (
        <p className="text-sm text-muted" data-testid="word-mind" data-mind={st.mind}>
          {mindLine(st, t)}
          {st.mind === 'noGap' && <span className="text-subtle"> · {t('stxMindNoGapHint')}</span>}
        </p>
      )}
    </>
  );
}

export function StatusLadder({ card, now }: { card: Card; now: number }) {
  const { t } = useT();
  if (card.isNew) return null;
  const st = cardStatus(card, now);
  const rows: ReadonlyArray<readonly [string, string, boolean, string | null]> = [
    ['recognize', t('stxStepRecognize'), st.recognizes, null],
    ['help', t('stxStepHelp'), st.helped, null],
    ['free', t('stxStepFree'), st.freeDays > 0, t('stxStepFreeOf', { n: Math.min(FREE_DAYS_GOAL, st.freeDays) })],
    ['sentence', t('stxStepNewSentence'), st.newSentence, null],
    ['own', t('stxStepOwn'), st.own, null],
  ];
  return (
    <section className="flex flex-col gap-1.5" data-testid="word-ladder">
      <p className="lx-eyebrow">{t('stxLadderTitle')}</p>
      <ul className="flex flex-col gap-1 text-sm">
        {rows.map(([id, label, done, extra]) => (
          <li key={id} className="flex items-baseline justify-between gap-3" data-step={id} data-done={done || undefined}>
            <span className={done ? '' : 'text-muted'}>{label}</span>
            <span className={`lx-tnum ${done ? 'text-ok-text' : 'text-subtle'}`}>{extra && done ? extra : done ? t('stxYes') : t('stxNot')}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-subtle">{t('stxExplain')}</p>
    </section>
  );
}
