import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { useSettings } from '../../app/settings';
import { readCollection } from '../../data/reads';
import { FEED_LIMIT, watchFeed, type FeedDocs } from '../../data/watch';
import { flattenFeed } from '../../domain/discover/feedItems';
import type { FeedItem } from '../../domain/input/types';
import { getDb, useCapabilities } from '../../platform/capabilities';
import { logError } from '../../platform/diagnostics';

// Beiträge des Tagesauftrags (Plan §2.6, F24): EIN Abo auf `feed` nur solange Entdecken oder
// ein Beitrag offen ist (useEffect, Abmelden beim Verlassen). Heute liest einmal per `get()`.
// Gespeichert werden die Rohdokumente; die Beiträge je Oberflächensprache leitet die Ansicht ab.

type FeedState = { status: 'idle' | 'loading' | 'ready' | 'error'; docs: FeedDocs };

export const useFeed = create<FeedState>(() => ({ status: 'idle', docs: [] }));

let once: Promise<void> | null = null;

/** Einmal lesen (für Heute), ohne Abo. */
export function loadFeedOnce(): Promise<void> {
  if (once) return once;
  const db = getDb();
  if (!db) return Promise.resolve();
  if (useFeed.getState().status === 'idle') useFeed.setState({ status: 'loading' });
  once = readCollection(db, 'feed', { orderBy: 'd', dir: 'desc', limit: FEED_LIMIT })
    .then((r) => {
      // Ein laufendes Abo ist maßgeblich – nicht mit älterem Stand überschreiben.
      if (useFeed.getState().status !== 'ready') useFeed.setState({ status: 'ready', docs: [...r.valid.entries()].map(([id, doc]) => ({ id, doc })) });
    })
    .catch((err: unknown) => {
      logError('discover:feed', err);
      if (useFeed.getState().status !== 'ready') useFeed.setState({ status: 'error' });
      once = null;
    });
  return once;
}

/** Abo für die Dauer des Bildschirms (genau eines, auch wenn Liste und Beitrag wechseln). */
export function useFeedSubscription(): void {
  const dbStatus = useCapabilities((s) => s.db);
  useEffect(() => {
    if (dbStatus !== 'ready') return;
    const db = getDb();
    if (!db) return;
    if (useFeed.getState().status === 'idle') useFeed.setState({ status: 'loading' });
    return watchFeed(
      db,
      (docs) => useFeed.setState({ status: 'ready', docs }),
      () => {
        if (useFeed.getState().status !== 'ready') useFeed.setState({ status: 'error' });
      },
    );
  }, [dbStatus]);
}

/** Beiträge in der Oberflächensprache, neueste zuerst. */
export function useFeedItems(): { status: FeedState['status']; items: FeedItem[] } {
  const status = useFeed((s) => s.status);
  const docs = useFeed((s) => s.docs);
  const lang = useSettings((s) => s.lang);
  const items = useMemo(() => flattenFeed(docs, lang), [docs, lang]);
  return { status, items };
}

/** Nur für Tests. */
export function resetFeed(): void {
  once = null;
  useFeed.setState({ status: 'idle', docs: [] });
}
