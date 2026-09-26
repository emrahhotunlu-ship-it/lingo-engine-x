import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { preplyList } from '../../domain/preply/docs';
import { useT } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { usePreply } from './store';

// „Heute" (Phase 5 §8.4): Eine heute gehaltene Preply-Stunde erscheint als Extra – Zustand,
// kein Knopf – und zählt NICHT zu „x von y" (Kap. 2.6: Pflicht und Freiwillig getrennt).

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function PreplyTodayLine() {
  const { t } = useT();
  const today = useClock((s) => s.today);
  const profile = useLive((s) => s.docs['app/profile']);
  const docs = usePreply((s) => s.docs);
  const count = Number(obj(obj(obj(profile).act)[today]).preply ?? 0);
  const minutes = useMemo(
    () =>
      preplyList(docs)
        .filter((v) => v.kind === 'plan' && v.done && v.heldDay === today)
        .reduce((n, v) => n + (v.kind === 'plan' ? v.heldMin : 0), 0),
    [docs, today],
  );
  if (!(count >= 1)) return null;
  return (
    <p className="flex items-center gap-2 text-sm text-muted" data-testid="td-extra-preply" data-state="done">
      <Icon name="check" size={16} className="text-accent-text" />
      {minutes > 0 ? t('tdExtraPreply', { min: minutes }) : t('tdExtraPreplyPlain')}
    </p>
  );
}
