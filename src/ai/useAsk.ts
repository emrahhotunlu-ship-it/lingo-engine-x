import { useCallback, useEffect, useRef, useState } from 'react';
import { askJson } from './gate';
import { useAiScope } from './scope';
import { isAiFailure, type AiMessageKey, type AiPhase, type PromptTemplate } from './types';
import { logWarn } from '../platform/diagnostics';

// Eine KI-Anfrage aus der Oberfläche: Phase, Ergebnis, Fehlertext, Stopp.
// Ein Aufruf je `run()` (nur auf eine Handlung hin), nie automatisch wiederholt.

export type AskState<O> = { phase: AiPhase | 'idle'; data: O | null; error: AiMessageKey | null };

export function useAsk<V, O>(template: PromptTemplate<V, O>) {
  const scope = useAiScope();
  const [state, setState] = useState<AskState<O>>({ phase: 'idle', data: null, error: null });
  const ctl = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(
    async (vars: V, opts: { refresh?: boolean } = {}): Promise<O | null> => {
      ctl.current?.abort();
      const c = scope.controller();
      ctl.current = c;
      setState({ phase: 'queued', data: null, error: null });
      try {
        const r = await askJson({
          template,
          vars,
          signal: c.signal,
          refresh: opts.refresh === true,
          onPhase: (p) => {
            if (alive.current && ctl.current === c) setState((s) => ({ ...s, phase: p }));
          },
        });
        if (alive.current && ctl.current === c) setState({ phase: 'done', data: r.data, error: null });
        return r.data;
      } catch (err) {
        if (!alive.current || ctl.current !== c) return null;
        if (isAiFailure(err) && err.kind === 'cancelled') {
          setState({ phase: 'idle', data: null, error: null });
          return null;
        }
        const key = isAiFailure(err) ? err.messageKey : 'aiFailed';
        if (!isAiFailure(err)) logWarn('ai:ask', err, template.id);
        setState({ phase: 'error', data: null, error: key ?? 'aiFailed' });
        return null;
      }
    },
    [scope, template],
  );

  const stop = useCallback(() => {
    ctl.current?.abort();
  }, []);

  return { ...state, run, stop };
}
