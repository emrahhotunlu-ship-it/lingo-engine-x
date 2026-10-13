import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dayKey, logError } from '../shared';
import type { AiPhase } from '../shared';
import { getDb, getWriter, readDoc, useAiAvailable, useAiScope } from '../sharedUi';
import type { AiMessageKey } from '../shared';
import { loadHome, savePrefs } from '../store';
import type { Home } from '../store';
import { runFetch } from '../run';
import type { RunFailure, RunResult } from '../run';
import { suggestTopics } from '../suggest';
import { CUSTOM_TOPICS_MAX, PER_DAY_MAX } from '../domain/docs';
import { sanitizeCustomTopic } from '../domain/topics';
import { earlierEntries, entriesOfDay, fetchCount, nextToRead, weekStats } from '../domain/view';
import type { WeekStats } from '../domain/view';
import type { IndexItem } from '../schemas';

// Zustand und Handlungen des Bildschirms „Lesen“. Gelesen wird träge (nur `read/p` und zwei Monatsindizes, nie Artikeltexte),
// geschrieben nur auf eine Handlung hin. Das Holen läuft mit einem AbortController des Bildschirms (Stopp-Knopf, Bildschirmwechsel).

export type LoadState = 'loading' | 'ready' | 'error';
export type Progress = { n: number; total: number; phase: AiPhase | 'idle' };

const HOLDER = `tab-${Math.random().toString(36).slice(2, 10)}`;

async function readDocOrUndefined(path: string): Promise<Record<string, unknown> | undefined> {
  const db = getDb();
  if (!db) throw new Error('no_db');
  const r = await readDoc(db, path);
  return r.status === 'missing' ? undefined : r.doc;
}

export type ReadHome = {
  load: LoadState;
  home: Home | null;
  today: string;
  aiOn: boolean;
  entries: IndexItem[];
  next: IndexItem | null;
  earlier: IndexItem[];
  week: WeekStats;
  perDay: number;
  toFetch: number;
  running: Progress | null;
  outcome: { result: RunResult; failure: RunFailure | null } | null;
  /** Nach `rate_limited`: kein weiterer Start in dieser Ansicht (Plan §3.1). */
  rateLocked: boolean;
  getArticles: (retry?: boolean) => void;
  stop: () => void;
  toggleTopic: (key: string) => void;
  addCustom: (text: string) => 'ok' | 'invalid' | 'full' | 'exists';
  removeCustom: (text: string) => void;
  setPerDay: (n: number) => void;
  suggest: () => void;
  suggestions: { state: 'idle' | 'busy' | 'error'; topics: string[]; key: AiMessageKey | null };
  reload: () => void;
};

export function useReadHome(): ReadHome {
  const scope = useAiScope();
  const aiOn = useAiAvailable();
  const [load, setLoad] = useState<LoadState>('loading');
  const [home, setHome] = useState<Home | null>(null);
  const [today, setToday] = useState(() => dayKey(Date.now()));
  const [running, setRunning] = useState<Progress | null>(null);
  const [outcome, setOutcome] = useState<ReadHome['outcome']>(null);
  const [rateLocked, setRateLocked] = useState(false);
  const [suggestions, setSuggestions] = useState<ReadHome['suggestions']>({ state: 'idle', topics: [], key: null });
  const alive = useRef(true);
  const ctl = useRef<AbortController | null>(null);
  const homeRef = useRef<Home | null>(null);
  useEffect(() => {
    homeRef.current = home;
  }, [home]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(() => {
    const day = dayKey(Date.now());
    loadHome(readDocOrUndefined, day).then(
      (h) => {
        if (!alive.current) return;
        setToday(day);
        setHome(h);
        setLoad('ready');
      },
      (err: unknown) => {
        logError('read:load', err);
        if (alive.current) setLoad((s) => (s === 'ready' ? s : 'error'));
      },
    );
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const entries = useMemo(() => (home ? entriesOfDay(home.items, today) : []), [home, today]);
  const next = useMemo(() => nextToRead(entries), [entries]);
  const earlier = useMemo(() => (home ? earlierEntries(home.items, today) : []), [home, today]);
  const week = useMemo(() => (home ? weekStats(home.items, today) : { articles: 0, minutes: 0 }), [home, today]);
  const perDay = home?.prefs.perDay ?? 3;
  const toFetch = fetchCount(entries.length, perDay, PER_DAY_MAX);

  const stop = useCallback(() => {
    ctl.current?.abort();
  }, []);

  const getArticles = useCallback(
    (retry = false) => {
      const h = homeRef.current;
      const writer = getWriter();
      if (!h || !writer || ctl.current) return;
      const day = dayKey(Date.now());
      const count = fetchCount(entriesOfDay(h.items, day).length, h.prefs.perDay, PER_DAY_MAX);
      const c = scope.controller();
      ctl.current = c;
      setOutcome(null);
      setRunning({ n: 1, total: Math.max(1, count), phase: 'queued' });
      void runFetch({
        writer,
        day,
        prefs: h.prefs,
        items: h.items,
        count,
        signal: c.signal,
        holder: HOLDER,
        refresh: retry,
        onEvent: (e) => {
          if (!alive.current) return;
          if (e.kind === 'start') setRunning({ n: e.n, total: e.total, phase: 'queued' });
          else if (e.kind === 'phase') setRunning((r) => (r ? { ...r, phase: e.phase } : r));
        },
      })
        .then((result) => {
          ctl.current = null;
          if (!alive.current) return;
          setRunning(null);
          if (result.failure?.type === 'rate') setRateLocked(true);
          setOutcome({ result, failure: result.failure });
          // Neu lesen: die gespeicherten Artikel stehen jetzt im Index (auch Teilergebnisse); `reload` setzt auch den Lerntag neu.
          reload();
        })
        .catch((err: unknown) => {
          ctl.current = null;
          logError('read:generate', err);
          if (alive.current) setRunning(null);
        });
    },
    [reload, scope],
  );

  // Einstellungen: erst im Speicher ändern (sofort sichtbar), dann schreiben; bei Fehler zurück auf den alten Stand.
  const patchPrefs = useCallback(
    (patch: Partial<Home['prefs']>) => {
      const h = homeRef.current;
      const writer = getWriter();
      if (!h || !writer) return;
      const before = h;
      setHome({ ...h, prefs: { ...h.prefs, ...patch } });
      savePrefs(writer, patch).catch(() => {
        // savePrefs hat protokolliert; Anzeige zurücknehmen.
        if (alive.current) setHome(before);
      });
    },
    [],
  );

  const toggleTopic = useCallback(
    (key: string) => {
      const h = homeRef.current;
      if (!h) return;
      const on = (h.prefs.topics[key] ?? 0) > 0;
      patchPrefs({ topics: { ...h.prefs.topics, [key]: on ? 0 : 1 } });
    },
    [patchPrefs],
  );

  const addCustom = useCallback(
    (text: string): 'ok' | 'invalid' | 'full' | 'exists' => {
      const h = homeRef.current;
      if (!h) return 'invalid';
      const t = sanitizeCustomTopic(text);
      if (!t) return 'invalid';
      if (h.prefs.custom.some((c) => c.toLowerCase() === t.toLowerCase())) return 'exists';
      if (h.prefs.custom.length >= CUSTOM_TOPICS_MAX) return 'full';
      patchPrefs({ custom: [...h.prefs.custom, t] });
      return 'ok';
    },
    [patchPrefs],
  );

  const removeCustom = useCallback(
    (text: string) => {
      const h = homeRef.current;
      if (!h) return;
      patchPrefs({ custom: h.prefs.custom.filter((c) => c !== text) });
    },
    [patchPrefs],
  );

  const setPerDay = useCallback(
    (n: number) => {
      patchPrefs({ perDay: Math.max(1, Math.min(PER_DAY_MAX, Math.round(n))) });
    },
    [patchPrefs],
  );

  const suggest = useCallback(() => {
    const h = homeRef.current;
    if (!h || suggestions.state === 'busy') return;
    const c = scope.controller();
    setSuggestions({ state: 'busy', topics: [], key: null });
    void suggestTopics(h.prefs.custom, c.signal).then((res) => {
      if (!alive.current) return;
      if (res.ok) setSuggestions({ state: 'idle', topics: res.topics, key: null });
      else setSuggestions({ state: res.cancelled ? 'idle' : 'error', topics: [], key: res.key });
    });
  }, [scope, suggestions.state]);

  return { load, home, today, aiOn, entries, next, earlier, week, perDay, toFetch, running, outcome, rateLocked, getArticles, stop, toggleTopic, addCustom, removeCustom, setPerDay, suggest, suggestions, reload };
}
