import { getWriter } from '../../data';
import { reviewWrite, type SkipReason } from '../../domain/srs/applyReview';
import type { AnswerEvent } from '../../domain/srs/types';
import { logError, logWarn } from '../../platform/diagnostics';
import { flush, usePending } from '../progress/persist';

// Schreibweg der Karte (Daten-Entwurf §1.3/1.4): sofort nach jeder bewerteten Antwort per
// `transform` auf dem frischen Stand. Zähler, Tagesprotokoll und Rundenende laufen über die
// EINE Sammel-Warteschlange in features/progress/persist.ts (phase2-plan D5) – hier nur
// wieder ausgeführt, damit der Trainer unverändert bleibt.

export { flush, installFlushOnHide, nextT, recordAnswer, recordRoundEnd, usePending, type PendingEntry } from '../progress/persist';

type Doc = Record<string, unknown>;

const IGNORABLE: ReadonlySet<SkipReason> = new Set(['already_applied']);

/** Karte speichern. `seedDefault` = Startvokabel ohne Dokument (wird dann vollständig angelegt). */
export async function saveCard(a: AnswerEvent, seedDefault: Doc | null): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  const path = `vocab/${a.id}`;
  let skipped: SkipReason | null = null;
  try {
    await writer.transform(path, (cur) => {
      const w = reviewWrite(path, cur, a, seedDefault);
      if (w.kind === 'skip') {
        skipped = w.reason;
        return null;
      }
      return w.kind === 'create' ? { set: w.doc } : { update: w.patch };
    });
    if (skipped && !IGNORABLE.has(skipped)) logWarn('trainer:card', { code: skipped, message: `${path} nicht geschrieben` }, path);
    usePending.setState((s) => ({ failedCards: s.failedCards.filter((f) => f.t !== a.t) }));
    return true;
  } catch (err) {
    logError('trainer:card', err, path);
    usePending.setState((s) => ({ failedCards: s.failedCards.some((f) => f.t === a.t) ? s.failedCards : [...s.failedCards, a] }));
    return false;
  }
}

/** Gescheiterte Karten erneut anwenden (derselbe Zeitstempel: nie doppelt). */
export async function retryFailed(seedDefaults: ReadonlyMap<string, Doc>): Promise<void> {
  for (const a of usePending.getState().failedCards) await saveCard(a, seedDefaults.get(a.id) ?? null);
  await flush();
}
