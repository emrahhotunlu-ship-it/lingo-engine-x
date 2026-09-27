import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { stepsFor, stepState, isItemDone } from '../../domain/discover/steps';
import type { FeedItem } from '../../domain/input/types';
import { useT } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { InputIcon, type InputIconName } from '../../ui/InputIcon';
import { Skeleton } from '../../ui/Skeleton';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { Button } from '../../ui/Button';
import { useFeedItems, useFeedSubscription } from './feedStore';
import { useCompanionSee } from '../companion/seeing';

// Entdecken (Kap. 6.9, Plan §4.4 Nr. 1): Beiträge der letzten 21 Feed-Dokumente, getrennt in
// „Neu" und „Erledigt". Erledigte Beiträge sind Zustand ohne Knopf (F13, Kap. 15).

export const KIND_ICON: Record<FeedItem['kind'], InputIconName> = { article: 'article', listen: 'headphones', watch: 'video' };

export function DiscoverScreen() {
  const { t } = useT();
  const go = useNav((s) => s.go);
  useFeedSubscription();
  useCompanionSee({ area: 'discover', label: t('dcTitle'), phase: 'idle' });
  const { status, items } = useFeedItems();
  const disc = useLive((s) => s.docs['app/profile']?.disc);
  const { open, done } = useMemo(() => {
    const o: FeedItem[] = [];
    const d: FeedItem[] = [];
    for (const it of items) (isItemDone(disc, it) ? d : o).push(it);
    return { open: o, done: d };
  }, [items, disc]);

  return (
    <section className="flex flex-col gap-6 py-6 sm:py-10" data-testid="discover">
      {/* Eigener Reiter (M13): Navigation über die Reiter, kein ✕. */}
      <header className="flex items-center gap-2">
        <h1 className="flex-1 text-2xl font-semibold tracking-tight">{t('dcTitle')}</h1>
        <Button variant="ghost" onClick={() => go({ name: 'history', kind: 'discover' })} data-testid="open-history">
          {t('inHistory')}
        </Button>
      </header>
      {status === 'idle' || status === 'loading' ? (
        <div className="flex flex-col gap-3" role="status" aria-label={t('inSkeleton')}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : status === 'error' ? (
        <p className="text-sm text-danger-text" role="alert">
          {t('inLoadFailed')}
        </p>
      ) : items.length === 0 ? (
        <p className="text-base text-muted" data-testid="empty-state">
          {t('dcEmpty')}
        </p>
      ) : (
        <div className="flex flex-col gap-6" data-testid="feed-list">
          <section className="flex flex-col gap-3" aria-labelledby="dc-new">
            <h2 id="dc-new" className="lx-eyebrow">
              {t('dcNew')}
            </h2>
            {open.length === 0 ? <p className="text-sm text-muted">{t('dcNone')}</p> : open.map((it) => <FeedCard key={it.itemId} item={it} disc={disc} done={false} />)}
          </section>
          {done.length > 0 && (
            <section className="flex flex-col gap-3" aria-labelledby="dc-done">
              <h2 id="dc-done" className="lx-eyebrow">
                {t('dcDone')}
              </h2>
              {done.map((it) => (
                <FeedCard key={it.itemId} item={it} disc={disc} done />
              ))}
            </section>
          )}
        </div>
      )}
    </section>
  );
}

function FeedCard({ item, disc, done }: { item: FeedItem; disc: unknown; done: boolean }) {
  const { t, tn, lang } = useT();
  const go = useNav((s) => s.go);
  const steps = stepsFor(item.kind, item.questions.length > 0);
  const st = stepState(disc, item.itemId, steps);
  const meta = [t(`dcKind_${item.kind}`), item.source, item.level, item.mins ? t('inAbout', { n: item.mins }) : null].filter(Boolean).join(' · ');
  const topic = item.topic[lang] ?? null;
  const inner = (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex size-9 flex-none items-center justify-center rounded-xl bg-surface" style={{ color: 'var(--lx-ch-discover)' }}>
        <InputIcon name={KIND_ICON[item.kind]} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <motion.p layoutId={`disc-${item.itemId}`} className="font-semibold" lang="en">
          {item.title}
        </motion.p>
        <p className="lx-tnum text-xs text-muted">{meta}</p>
        {topic && <p className="text-sm text-muted">{topic}</p>}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {item.own && <span className="rounded-full bg-surface-strong px-2 py-0.5 font-medium">{t('dcOwn')}</span>}
          <span className={done ? 'inline-flex items-center gap-1 text-accent-text' : 'text-subtle'}>
            {done && <Icon name="check" size={14} />}
            {done ? t('dcItemDone') : tn('dcSteps', st.done.size)}
          </span>
        </div>
      </div>
      {!done && <Icon name="arrowRight" size={18} className="mt-1 flex-none text-subtle" />}
    </div>
  );
  const cls = 'lx-glass w-full rounded-[var(--radius-card)] p-4 text-left';
  const style = { boxShadow: 'inset 3px 0 0 0 var(--lx-ch-discover), var(--lx-shadow)' };
  if (done) {
    return (
      <motion.div className={cls} style={style} data-testid="feed-item" data-kind={item.kind} data-state="done" data-id={item.itemId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: DURATION.base, ease: EASE_OUT }}>
        {inner}
      </motion.div>
    );
  }
  return (
    <motion.button
      type="button"
      className={`${cls} transition-colors hover:bg-surface-strong`}
      style={style}
      data-testid="feed-item"
      data-kind={item.kind}
      data-state="new"
      data-id={item.itemId}
      onClick={() => go({ name: 'discoverItem', feedId: item.feedId, itemId: item.itemId, ctx: 'extra' })}
      whileTap={{ scale: 0.99 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
    >
      {inner}
    </motion.button>
  );
}
