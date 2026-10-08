import type { useLive } from '../../data/live';
import { invalidIdsOf } from '../../data/live';
import { addDays } from '../../domain/date';
import { c1ItemById } from '../../domain/c1x/preload';
import { c1Way, type Way } from '../../domain/c1/way';
import { C1_LOG_DAYS } from '../../domain/metrics/c1';
import { buildTrainCards } from '../../domain/metrics';
import { buildChunkCards } from '../../domain/srs/chunkCards';

// Eingaben für „Weg zu C1“ aus den Live-Daten (P45): EIN Weg für das Blatt und die Einschätzung assess@4, damit beide dieselben Zahlen sehen.
// Protokolle (28 Tage) und `app/patterns` sind nicht abonniert; sie liest der Aufrufer einmal (Blatt: beim Öffnen, Einschätzung: im Lauf).

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();
type LiveState = ReturnType<typeof useLive.getState>;

/** Die Protokoll-Pfade der letzten 28 Tage, neuester zuerst. */
export const wayLogPaths = (today: string): string[] => Array.from({ length: C1_LOG_DAYS }, (_, k) => `log/${addDays(today, -k)}`);

export const PATTERNS_DOC = 'app/patterns';

export function wayFromLive(live: Pick<LiveState, 'docs' | 'collections' | 'invalid'>, i: { today: string; nowMs: number; logs: readonly Doc[] | null; patterns: unknown }): Way {
  const cards = [
    ...buildTrainCards(live.collections.vocab ?? EMPTY, i.nowMs, invalidIdsOf(live.invalid, 'vocab')),
    ...buildChunkCards(live.collections.chunk ?? EMPTY, i.nowMs, invalidIdsOf(live.invalid, 'chunk')),
  ];
  return c1Way({
    today: i.today,
    nowMs: i.nowMs,
    c1: live.docs['app/c1'],
    grammar: live.collections.grammar ?? EMPTY,
    profile: live.docs['app/profile'] ?? undefined,
    cards,
    patterns: i.patterns,
    logs: i.logs,
    itemOf: c1ItemById,
  });
}
