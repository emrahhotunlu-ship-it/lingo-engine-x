import { capability } from './runtime';
import { logError, logWarn } from './diagnostics';

// Rückmeldung per Kommentar (Emrah 03.11.2026: „Bereiche anklicken und kommentieren“). Fähigkeit `comments` in der
// Form `composer_only` (contract/comments.d.ts): die App öffnet nur das Kommentarfeld von claude.ai an der angetippten
// Stelle; Schreiben, Anzeigen und Absender macht claude.ai selbst. Keine Zustimmung nötig, die App schreibt nichts.

export type CommentOpen = 'opened' | 'busy' | 'unavailable' | 'error';

/** Ist das Kommentieren in dieser Ansicht möglich? (`null` von der Laufzeit = nein.) */
export async function commentsAvailable(): Promise<boolean> {
  return (await capability('comments')) !== null;
}

/** Öffnet das Kommentarfeld von claude.ai an `el`. Nur aus einem Tipp des Nutzers aufrufen. */
export async function openCommentAt(el: Element): Promise<CommentOpen> {
  const ns = await capability('comments');
  if (!ns) return 'unavailable';
  try {
    const res = await ns.openComposer({ element: el });
    return res.opened ? 'opened' : 'busy';
  } catch (err) {
    const code = err && typeof err === 'object' ? (err as { code?: unknown }).code : undefined;
    if (code === 'rate_limited') {
      logWarn('comments:open', err);
      return 'busy';
    }
    if (code === 'invalid' || code === 'transform_error') {
      logError('comments:open', err);
      return 'error';
    }
    // unavailable, not_granted, capability_disabled/removed und Unbekanntes: für diese Ansicht aus.
    logWarn('comments:open', err);
    return 'unavailable';
  }
}
