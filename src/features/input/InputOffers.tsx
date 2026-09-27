import { useEffect, useMemo } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useClock } from '../../app/clock';
import { INPUT_MODULES } from '../../app/modules';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { addDays } from '../../domain/date';
import { isItemDone } from '../../domain/discover/steps';
import { channelDone, channelExecutable, lastDoneDaysAgo } from '../../domain/plan/inputChannels';
import { useT } from '../../i18n';
import { useSpeech } from '../../platform/speech';
import { Icon } from '../../ui/Icon';
import { InputIcon } from '../../ui/InputIcon';
import { loadFeedOnce, useFeedItems } from '../discover/feedStore';
import { usePending } from '../progress/persist';
import { dbArticles, dbListening, listenRows, readAll } from './derive';
import { LEGACY_ARTICLES, LEGACY_LISTENING } from '../../domain/input/items';
import { ensureLibrary, useInputLibrary } from './library';

// Angebote auf Heute (Plan §4.6): nach der Pflicht, klar als Extra getrennt (Kap. 2.6).
// „Lesen · zuletzt vor 4 Tagen" bzw. „Entdecken · 3 neue Beiträge". Eine Zeile verschwindet,
// sobald der Kanal heute erledigt ist (`channelDone`, die eine Ableitung – Kap. 2.2).

export function useChannelState() {
  const today = useClock((s) => s.today);
  const profile = useLive((s) => s.docs['app/profile']);
  const pendingAct = usePending((s) => s.units[today]);
  const tts = useSpeech((s) => s.status);
  const ai = useAiAvailable();
  const status = useInputLibrary((s) => s.status);
  const docs = useInputLibrary((s) => s.docs);
  const { items } = useFeedItems();

  useEffect(() => {
    void ensureLibrary();
    void loadFeedOnce();
  }, []);

  return useMemo(() => {
    const read = readAll(docs.reading);
    const heard = new Set(listenRows(profile).map((r) => r.id));
    const unread = [...dbArticles(docs.articles), ...LEGACY_ARTICLES].some((a) => !read.has(a.id));
    const unheard = [...dbListening(docs.lpool), ...LEGACY_LISTENING].some((l) => !heard.has(l.id));
    const since = addDays(today, -7);
    const feedOpen = items.filter((i) => i.d >= since && !isItemDone(profile?.disc, i)).length;
    const env = { tts, ai, lib: { read: unread, listen: unheard }, feedOpen };
    const rows = INPUT_MODULES.map((m) => {
      const id = m.id;
      return {
        module: m,
        done: channelDone(id, today, profile, pendingAct),
        executable: status === 'ready' ? channelExecutable(id, env) : false,
        ago: lastDoneDaysAgo(id, profile, today),
      };
    });
    return { rows, feedOpen, ready: status === 'ready' };
  }, [docs, profile, today, pendingAct, tts, ai, items, status]);
}

export function InputOffers() {
  const { t, tn } = useT();
  const go = useNav((s) => s.go);
  const { rows, feedOpen, ready } = useChannelState();
  const open = rows.filter((r) => !r.done && r.executable);
  if (!ready || open.length === 0) return null;
  return (
    <section aria-labelledby="td-input" className="flex flex-col gap-2" data-testid="input-offers">
      <p id="td-input" className="lx-eyebrow">
        {t('inOfferTitle')}
      </p>
      <ul className="flex flex-col gap-2">
        {open.map(({ module: m, ago }) => {
          const detail = m.id === 'discover' ? tn('inOfferNew', feedOpen) : ago === null ? t('agoNever') : ago === 0 ? t('agoToday') : tn('agoDaysN', ago);
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => go(m.route)}
                data-testid="offer"
                data-channel={m.id}
                className="lx-glass flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-card)] px-4 py-3 text-left transition-colors hover:bg-surface-strong"
              >
                <span className="inline-flex size-9 flex-none items-center justify-center rounded-xl bg-surface" style={{ color: `var(--lx-ch-${m.channel})` }}>
                  <InputIcon name={m.icon} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{t(m.label)}</span>
                  <span className="text-xs text-muted">{detail}</span>
                </span>
                <Icon name="arrowRight" size={18} className="flex-none text-subtle" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
