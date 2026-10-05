import { getWriter } from '../../data';
import { mayCreateDoc } from '../../domain/capacity/docGuard';
import { useLive } from '../../data/live';
import { nextPackEntries, packDoc, packOp, packState } from '../../domain/c1pack/pack';
import { normalizeNewPerDay } from '../../domain/srs/queue';
import { logError } from '../../platform/diagnostics';

// Täglicher Zulauf aus dem C1-Paket (Emrah 02.10.2026, `domain/c1pack/pack.ts`): höchstens 2 Einträge je Lerntag als normale
// neue Karten, solange die Einstellung „Neue Wörter pro Tag“ größer als 0 ist. Läuft einmal je Seitenaufruf und Lerntag nach
// dem Tagesplan (wie der Zulauf des Tagesauftrags), nie in einer Schleife. Jede Karte wird nur angelegt, wenn es sie noch nicht
// gibt (`transform` auf dem frischen Stand); die Datenbank-Grenze je Tag und der Vorrat (`PACK_STOCK`) stehen in `nextPackEntries`.

let packDay: string | null = null;

/** Legt die heutigen Einträge an. Liefert, wie viele neu geschrieben wurden. Ohne geladene Daten: 0, später erneut. */
export async function packTopUp(today: string, nowMs: number): Promise<number> {
  if (packDay === today) return 0;
  const writer = getWriter();
  const live = useLive.getState();
  const vocab = live.collections.vocab;
  const chunks = live.collections.chunk;
  const profile = live.docs['app/profile'];
  if (!writer || !vocab || !chunks || !profile) return 0;
  packDay = today;
  const picks = nextPackEntries(packState(vocab, chunks, today, nowMs), normalizeNewPerDay(profile.newPerDay));
  let written = 0;
  let failed = false;
  for (const e of picks) {
    const made = packDoc(e, today, nowMs);
    if (!made) continue;
    try {
      let wrote = false;
      await writer.transform(made.path, (cur) => {
        // Datenbank fast voll (Gesamtzahl): kein Zulauf, laut gemeldet (Prüfbefund S8).
        if (!cur && !mayCreateDoc(made.path)) return null;
        const op = packOp(cur, made);
        wrote = op !== null;
        return op;
      });
      if (wrote) written++;
    } catch (err) {
      failed = true;
      logError('day:pack', err, made.path);
    }
  }
  // Nach einem Schreibfehler später am Tag noch einmal versuchen (nie in einer Schleife, nur beim nächsten Tagesstart der Seite).
  if (failed) packDay = null;
  return written;
}

/** Nur für Tests. */
export function resetPackTopUp(): void {
  packDay = null;
}
