import { useMemo } from 'react';
import { useClock } from '../../../app/clock';
import { useWeek } from '../../../app/useWeek';
import { invalidIdsOf, useLive } from '../../../data/live';
import { buildTrainCards } from '../../../domain/srs/cards';
import { buildChunkCards } from '../../../domain/srs/chunkCards';
import type { DeckCtx } from '../../../domain/srs/decks';
import { weekStartMs } from '../../../domain/srs/flip';
import { newQuotaLeft } from '../../../domain/srs/queue';
import type { TrainCard } from '../../../domain/srs/types';
import { isThemeCard } from '../../../domain/week/cards';

// Karten des Wortschatz-Bereichs (Vokabeln + Wendungen) – einmal je Datenstand gebaut. Die Hubs
// abonnieren nur die beiden Sammlungen und leiten Zahlen ab (architektur.md §3.4 „Selektoren“).

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();

export function useVocabCards(): TrainCard[] {
  const now = useClock((s) => s.now);
  const vocab = useLive((s) => s.collections.vocab) ?? EMPTY;
  const chunks = useLive((s) => s.collections.chunk) ?? EMPTY;
  const invalid = useLive((s) => s.invalid);
  return useMemo(() => [...buildTrainCards(vocab, now, invalidIdsOf(invalid, 'vocab')), ...buildChunkCards(chunks, now, invalidIdsOf(invalid, 'chunk'))], [vocab, chunks, now, invalid]);
}

/** Rest-Kontingent neuer Karten heute (EIN Kontingent für alle Wege, anki-regeln §5) und Tageswert. */
export function useQuota(cards: readonly TrainCard[]): { left: number; perDay: unknown } {
  const today = useClock((s) => s.today);
  const perDay = useLive((s) => s.docs['app/profile']?.newPerDay);
  return useMemo(() => {
    const intro = cards.filter((c) => c.intro === today);
    return { left: newQuotaLeft(perDay, intro.length, intro.filter((c) => c.src === 'lesson').length), perDay };
  }, [cards, today, perDay]);
}

export function useDeckCtx(): DeckCtx {
  const now = useClock((s) => s.now);
  const { theme } = useWeek();
  return useMemo(() => ({ nowMs: now, weekStartMs: weekStartMs(now), isTheme: theme ? (c: TrainCard) => isThemeCard(c, theme) : undefined }), [now, theme]);
}
