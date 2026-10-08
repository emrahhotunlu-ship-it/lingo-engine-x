import { useCallback, useEffect, useRef, useState } from 'react';
import { useAiAvailable, useAiScope } from '../../ai/scope';
import { useDocWatch } from '../../data/watch';
import { citableFacts, type WeekFact } from '../../domain/progress/weekly';
import { useT } from '../../i18n';
import { aiUsable } from './assessRun';
import { ensureWeeklyText, storedWeekly, WEEKLY_MIN_FACTS, type WeeklyItem } from './weeklyRun';

// Claudes Wochentext für den Wochenrückblick 3.0 (P50): dieselbe Regel wie in `WeeklyCard` (einmal je Woche und Sprache beim Öffnen, nie automatisch
// wiederholt, nach einem Fehler „Erneut versuchen“ mit `refresh`), nur als Hook, damit der neue Rückblick den Text in seine Karten einbauen kann.

export type WeeklyText = {
  status: 'loading' | 'ready' | 'error';
  stored: WeeklyItem | null;
  /** Die KI ist nutzbar und es gibt genug Fakten (Zeile „schreibt …“ während des Laufs). */
  wants: boolean;
  running: boolean;
  failed: boolean;
  /** Es gibt überhaupt eine Chance auf einen Text (KI da, genug Fakten) oder schon einen gespeicherten. */
  retry: () => void;
};

export function useWeeklyText(week: string, facts: readonly WeekFact[]): WeeklyText {
  const { lang } = useT();
  const ai = useAiAvailable();
  const scope = useAiScope();
  const weekly = useDocWatch('app/weekly');
  const stored = weekly.status === 'ready' ? storedWeekly(weekly.data, week, lang) : null;
  const wants = ai && weekly.status === 'ready' && !stored && citableFacts(facts).length >= WEEKLY_MIN_FACTS;
  const [run, setRun] = useState<{ key: string; state: 'running' | 'error' } | null>(null);
  const tried = useRef<string | null>(null);
  const factsRef = useRef(facts);
  useEffect(() => {
    factsRef.current = facts;
  }, [facts]);
  const runKey = `${week}|${lang}`;
  const start = useCallback(
    (refresh: boolean) => {
      const key = runKey;
      tried.current = key;
      setRun({ key, state: 'running' });
      void ensureWeeklyText({ w: week, lang, facts: factsRef.current, stored: null, signal: scope.signal, refresh }).then((r) => {
        setRun((cur) => (cur?.key !== key ? cur : r === 'error' ? { key, state: 'error' } : null));
      });
    },
    [runKey, week, lang, scope],
  );
  useEffect(() => {
    if (!wants || !aiUsable() || tried.current === runKey) return;
    start(false);
  }, [wants, runKey, start]);
  const retry = useCallback(() => start(true), [start]);
  return {
    status: weekly.status,
    stored,
    wants,
    running: !stored && run?.key === runKey && run.state === 'running',
    failed: !stored && run?.key === runKey && run.state === 'error',
    retry,
  };
}
