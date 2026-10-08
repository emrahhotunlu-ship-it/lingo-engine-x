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

/** Sind alle Live-Daten da, aus denen „Weg zu C1“ rechnet? (`undefined` = noch nicht geladen; `null` = Dokument fehlt, das ist geladen.) */
export function wayLiveLoaded(live: Pick<LiveState, 'docs' | 'collections'>): boolean {
  const { docs, collections } = live;
  return docs['app/c1'] !== undefined && docs['app/profile'] !== undefined && collections.vocab !== undefined && collections.chunk !== undefined && collections.grammar !== undefined;
}

/**
 * Ladezustand des Blatts (rein): `error`, wenn die Datenbank fehlt oder das Live-Abo gescheitert ist (sonst hinge das Skelett für immer),
 * `loading` bis Protokolle und Live-Daten da sind, sonst `ready`.
 */
export function wayLoadState(i: { db: 'pending' | 'ready' | 'absent'; liveStatus: 'waiting' | 'ready' | 'error'; onceStatus: 'loading' | 'ready' | 'error'; liveLoaded: boolean }): 'loading' | 'error' | 'ready' {
  if (i.db === 'absent' || i.liveStatus === 'error') return 'error';
  return i.onceStatus === 'loading' || !i.liveLoaded ? 'loading' : 'ready';
}

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
