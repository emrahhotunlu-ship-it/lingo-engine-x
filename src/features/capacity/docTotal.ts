import { useEffect } from 'react';
import { LIVE_COLLECTIONS, useLive } from '../../data/live';
import { countDocuments } from '../../data/reads';
import { onDocBlocked, setDocTotal } from '../../domain/capacity/docGuard';
import { useSettings } from '../../app/settings';
import { formatNumber, translate } from '../../i18n';
import { getDb, useCapabilities } from '../../platform/capabilities';
import { logWarn } from '../../platform/diagnostics';
import { toast } from '../../ui/Toast';

// Pflegt den Zählerstand für den Dokumenten-Wächter (`domain/capacity/docGuard`): Die Live-Sammlungen sind immer aktuell,
// alles andere (Protokolle, Sätze, Aufträge …) kommt aus einer Zählung je Sitzung (`countDocuments`) und wird als fester
// Aufschlag dazugerechnet. Vor der Zählung gilt nur der Live-Stand (ein zu kleiner Wert sperrt nie fälschlich).

const liveSize = (s: ReturnType<typeof useLive.getState>): number => LIVE_COLLECTIONS.reduce((a, c) => a + (s.collections[c]?.size ?? 0), 0) + Object.keys(s.docs).length;

let extra = 0;
let notified = false;

function refresh(): void {
  setDocTotal(liveSize(useLive.getState()) + extra);
}

/** Einmal je Sitzung starten, sobald die Datenbank bereit ist. */
export function useDocTotal(): void {
  const db = useCapabilities((s) => s.db);
  useEffect(() => {
    onDocBlocked((total) => {
      // Höchstens ein Hinweis je Sitzung (kein Dauerfeuer bei mehreren abgewiesenen Karten).
      if (notified) return;
      notified = true;
      const lang = useSettings.getState().lang;
      toast(translate(lang, 'capDocsFull', { n: formatNumber(lang, total) }));
    });
    return () => onDocBlocked(null);
  }, []);
  useEffect(() => {
    if (db !== 'ready') return;
    refresh();
    const stop = useLive.subscribe(refresh);
    const handle = getDb();
    let alive = true;
    if (handle) {
      countDocuments(handle).then(
        (c) => {
          if (!alive) return;
          const total = Object.values(c.byCollection).reduce((a, b) => a + b, 0);
          // Aufschlag = alles, was nicht live mitgezählt wird (nie negativ).
          extra = Math.max(0, total - liveSize(useLive.getState()));
          refresh();
        },
        (err: unknown) => logWarn('capacity:count', err),
      );
    }
    return () => {
      alive = false;
      stop();
    };
  }, [db]);
}
