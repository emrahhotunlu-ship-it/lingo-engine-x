import { useEffect, useMemo } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useClock } from '../../app/clock';
import { INPUT_MODULES } from '../../app/modules';
import { useLive } from '../../data/live';
import { addDays } from '../../domain/date';
import { isItemDone } from '../../domain/discover/steps';
import { channelDone, channelExecutable, lastDoneDaysAgo } from '../../domain/plan/inputChannels';
import { useSpeech } from '../../platform/speech';
import { loadFeedOnce, useFeedItems } from '../discover/feedStore';
import { usePending } from '../progress/persist';
import { dbArticles, dbListening, listenRows, readAll } from './derive';
import { LEGACY_ARTICLES, LEGACY_LISTENING } from '../../domain/input/items';
import { ensureLibrary, useInputLibrary } from './library';

// Zustand der Kanäle Lesen, Hören, Schreiben, Entdecken (Plan §4.6): heute erledigt, machbar,
// zuletzt vor n Tagen. Die Angebotsliste auf „Heute" entfällt seit der UX-Beratung 27.09.
// (alles Freiwillige lebt in „Üben"); der Zustand speist „heute geübt" in „Üben".

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
