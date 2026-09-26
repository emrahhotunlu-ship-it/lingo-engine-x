import { useCallback, useEffect, useRef, useState } from 'react';
import { logWarn } from '../platform/diagnostics';
import { useAiScope } from './scope';
import { askStream } from './stream';
import { isAiFailure, type AiMessageKey, type AiPhase, type ChatTemplate, type StreamResult } from './types';

// Eine gestreamte KI-Antwort aus der Oberfläche (Plan §6.1): Text läuft ein, Phase, Fehlertext,
// Stopp. Ein Aufruf je `run()` (nur auf eine Handlung hin), nie automatisch wiederholt.

export type StreamState = {
  phase: AiPhase | 'idle';
  text: string;
  error: AiMessageKey | null;
  /** Teiltext nach einem Fehler (zeigen, nicht weiterverwenden). */
  partial: string;
};

export function useStream<V>(template: ChatTemplate<V>) {
  const scope = useAiScope();
  const [state, setState] = useState<StreamState>({ phase: 'idle', text: '', error: null, partial: '' });
  const ctl = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(
    async (vars: V): Promise<StreamResult | null> => {
      ctl.current?.abort();
      const c = scope.controller();
      ctl.current = c;
      const mine = () => alive.current && ctl.current === c;
      setState({ phase: 'queued', text: '', error: null, partial: '' });
      try {
        const r = await askStream({
          template,
          vars,
          signal: c.signal,
          onPhase: (p) => {
            if (mine()) setState((s) => ({ ...s, phase: p }));
          },
          onText: (text) => {
            if (mine()) setState((s) => ({ ...s, text }));
          },
        });
        if (mine()) setState({ phase: 'done', text: r.text, error: null, partial: '' });
        return r;
      } catch (err) {
        if (!mine()) return null;
        if (isAiFailure(err) && err.kind === 'cancelled') {
          setState({ phase: 'idle', text: '', error: null, partial: '' });
          return null;
        }
        if (!isAiFailure(err)) logWarn('ai:stream', err, template.id);
        setState({ phase: 'error', text: '', error: (isAiFailure(err) ? err.messageKey : null) ?? 'aiFailed', partial: isAiFailure(err) ? (err.partial ?? '') : '' });
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
