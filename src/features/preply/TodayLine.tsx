import { useEffect, useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { watchCollectionDocs } from '../../data/watch';
import { heldMinutesOn, preplyList } from '../../domain/preply/docs';
import { useT } from '../../i18n';
import { getDb, useCapabilities } from '../../platform/capabilities';
import { Icon } from '../../ui/Icon';
import { receivePreply, usePreply } from './store';

// „Heute" (Phase 5 §8.4): Eine heute gehaltene Preply-Stunde erscheint als Extra – Zustand,
// kein Knopf – und zählt NICHT zu „x von y" (Kap. 2.6: Pflicht und Freiwillig getrennt).

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Heute gehaltene Preply-Stunden: Anzahl (`act[tag].preply`) und Minuten (aus `preply/*`). */
export function usePreplyToday(): { count: number; minutes: number } {
  const today = useClock((s) => s.today);
  const profile = useLive((s) => s.docs['app/profile']);
  const docs = usePreply((s) => s.docs);
  const count = Number(obj(obj(obj(profile).act)[today]).preply ?? 0);
  const minutes = useMemo(() => heldMinutesOn(preplyList(docs), today), [docs, today]);
  return { count: Number.isFinite(count) ? count : 0, minutes };
}

export function PreplyTodayLine() {
  const { t } = useT();
  const db = useCapabilities((s) => s.db);
  const loaded = usePreply((s) => s.loaded);
  const { count, minutes } = usePreplyToday();
  const held = count >= 1;

  // Nur wenn heute eine Stunde gehalten wurde und die Sammlung noch nicht geladen ist: ein Abo,
  // solange „Heute" offen ist – für die Minuten (Extra, getrennt vom Minutenziel).
  useEffect(() => {
    if (!held || loaded || db !== 'ready') return;
    const handle = getDb();
    if (!handle) return;
    return watchCollectionDocs(handle, 'preply', (w) => receivePreply(w.docs));
  }, [held, loaded, db]);

  if (!held) return null;
  return (
    <p className="flex items-center gap-2 text-sm text-muted" data-testid="td-extra-preply" data-state="done" data-min={minutes}>
      <Icon name="check" size={16} className="text-accent-text" />
      {minutes > 0 ? t('tdExtraPreply', { min: minutes }) : t('tdExtraPreplyPlain')}
    </p>
  );
}
