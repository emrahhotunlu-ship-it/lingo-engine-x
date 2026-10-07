import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useT } from '../../i18n';
import { invalidIdsOf, useLive } from '../../data/live';
import { buildTrainCards, expectedKnown } from '../../domain/metrics';
import { logWarn } from '../../platform/diagnostics';

// „Das ist noch da“ (Lernplattform 3.0 P27, Motivation §4.10 Nr. 1): Ab 7 Lerntagen Pause steht im Band bzw. auf der Willkommens-Karte, wie viel von
// den gelernten Wörtern voraussichtlich noch sitzt. Dieselbe Quelle wie die Karte „Wie gut sitzt es?“ (`expectedKnown`). Ein ruhiger Fakt, nie ein Vorwurf.

/** Ab so vielen Lerntagen Pause erscheint die Zeile. */
export const STILL_THERE_GAP = 7;

export function StillThere({ gap, className = '' }: { gap: number | null; className?: string }) {
  const { t } = useT();
  const now = useClock((s) => s.now);
  const vocab = useLive((s) => s.collections.vocab);
  const show = gap !== null && gap >= STILL_THERE_GAP;
  const nums = useMemo(() => {
    if (!show) return null;
    try {
      const live = useLive.getState();
      const cards = buildTrainCards(vocab ?? new Map(), now, invalidIdsOf(live.invalid, 'vocab'));
      const learned = cards.filter((c) => !c.hidden && !c.isNew).length;
      return learned > 0 ? { n: learned, k: Math.min(learned, expectedKnown(cards, now)) } : null;
    } catch (err) {
      logWarn('today:stillThere', err);
      return null;
    }
  }, [show, vocab, now]);
  if (!nums) return null;
  return (
    <span className={`lx-tnum block ${className}`.trim()} data-testid="still-there" data-known={nums.k} data-learned={nums.n}>
      {t('moStillThere', nums)}
    </span>
  );
}
