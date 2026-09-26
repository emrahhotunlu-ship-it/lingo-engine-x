import { useCallback, useEffect, useRef, useState } from 'react';
import { logWarn } from '../platform/diagnostics';
import { useAiScope } from './scope';
import { askText, type TextRequest } from './stream';
import { isAiFailure, type AiMessageKey, type AiPhase } from './types';

// Eine gestreamte Freitext-Anfrage aus der Oberfläche (Phase 5 §4): Text so weit geschrieben,
// Phase, Fehlertext, Stopp. Ein Aufruf je `run()` (nur auf eine Handlung hin), nie automatisch
// wiederholt. Der Begleiter nutzt den Hook nicht (sein Aufruf lebt im Store und überdauert
// das Schließen, E5-06); gedacht für Einmal-Texte späterer Phasen.

export type AskTextState = {
  phase: AiPhase | 'idle';
  text: string;
  truncated: boolean;
  error: AiMessageKey | null;
};

type Base = Omit<TextRequest, 'input' | 'signal' | 'onPhase' | 'onText'>;

export function useAskText(base: Base) {
  const scope = useAiScope();
  const [state, setState] = useState<AskTextState>({ phase: 'idle', text: '', truncated: false, error: null });
  const ctl = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const baseRef = useRef(base);
  useEffect(() => {
    baseRef.current = base;
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(
    async (input: TextRequest['input']): Promise<string | null> => {
      ctl.current?.abort();
      const c = scope.controller();
      ctl.current = c;
      const mine = () => alive.current && ctl.current === c;
      setState({ phase: 'queued', text: '', truncated: false, error: null });
      try {
        const r = await askText({
          ...baseRef.current,
          input,
          signal: c.signal,
          onPhase: (p) => {
            if (mine()) setState((s) => ({ ...s, phase: p }));
          },
          onText: ({ text }) => {
            if (mine()) setState((s) => ({ ...s, text }));
          },
        });
        if (mine()) setState({ phase: 'done', text: r.text, truncated: r.truncated, error: null });
        return r.text;
      } catch (err) {
        if (!mine()) return null;
        if (isAiFailure(err) && err.kind === 'cancelled') {
          setState((s) => ({ ...s, phase: 'idle' }));
          return null;
        }
        if (!isAiFailure(err)) logWarn('ai:askText', err, baseRef.current.id);
        const key = isAiFailure(err) ? (err.messageKey ?? 'aiFailed') : 'aiFailed';
        const partial = isAiFailure(err) ? (err.partial ?? '') : '';
        setState({ phase: 'error', text: partial, truncated: false, error: key });
        return null;
      }
    },
    [scope],
  );

  const stop = useCallback(() => ctl.current?.abort(), []);
  return { ...state, run, stop };
}
