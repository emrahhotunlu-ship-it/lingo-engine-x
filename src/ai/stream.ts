import { getSample } from '../platform/capabilities';
import { logError, logWarn } from '../platform/diagnostics';
import { linkAbort } from './abort';
import { cancelledFailure, failure, failureFromSample } from './errors';
import { PROMPT_BUDGET_BYTES, SLOW_AFTER_MS } from './gate';
import { aiQueue } from './queue';
import { recordCall, throttleReason } from './status';
import { AiFailure, type AiPhase, type StreamRequest, type StreamResult } from './types';

// Streaming-Weg des KI-Tors für Gespräche (Plan §6.1): dieselbe Kette wie askJson –
// Verfügbarkeit → Budget → Drosselung → Warteschlange → `sample(turns, {onText})` mit eigenem
// AbortController. KEIN Neuversuch, kein Timer-Abbruch (A6.2), nur der Hinweis `slow`.
// Fehler: Teiltext (`e.text`, bereinigt) steht in `AiFailure.partial` – die Oberfläche darf ihn
// zeigen, übernimmt ihn aber nicht in den Verlauf für den nächsten Aufruf.

const encoder = new TextEncoder();

export function turnsBytes(turns: readonly Claude.sample.SampleMessage[]): number {
  return turns.reduce((n, t) => n + encoder.encode(t.content).length, 0);
}

function validTurns(turns: readonly Claude.sample.SampleMessage[]): boolean {
  return (
    turns.length > 0 &&
    turns[0]?.role === 'user' &&
    turns[turns.length - 1]?.role === 'user' &&
    turns.every((t) => (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string' && t.content.trim() !== '')
  );
}

export async function askStream<V>(req: StreamRequest<V>): Promise<StreamResult> {
  const { template, vars, signal } = req;
  const scope = `ai:${template.id}@${template.version}`;
  const phase = (p: AiPhase) => {
    try {
      req.onPhase?.(p);
    } catch (err) {
      logError('ai:onPhase', err, scope);
    }
  };
  const clean = (text: string): string => {
    try {
      return template.clean(text);
    } catch (err) {
      logError(scope, err, 'clean');
      return text.trim();
    }
  };
  try {
    if (signal.aborted) throw cancelledFailure();
    if (!getSample()) throw failure('unavailable', 'absent');
    let turns: Claude.sample.SampleMessage[];
    try {
      turns = template.build(vars);
    } catch (err) {
      logError(scope, err, 'build');
      throw failure('bug', 'build');
    }
    if (!validTurns(turns)) {
      logError(scope, { code: 'invalid_turns', message: 'turns must start and end with a user turn' });
      throw failure('bug', 'invalid_turns');
    }
    const bytes = turnsBytes(turns);
    if (bytes > PROMPT_BUDGET_BYTES) {
      logError(scope, { code: 'prompt_too_large', message: `${bytes} bytes > ${PROMPT_BUDGET_BYTES}` });
      throw failure('too_large', 'prompt_too_large');
    }
    const reason = throttleReason();
    if (reason) throw failure('busy', reason);

    const release = await aiQueue.acquire(signal, req.priority ?? 'user', () => phase('queued'));
    try {
      if (signal.aborted) throw cancelledFailure();
      const sample = getSample();
      if (!sample) throw failure('unavailable', 'absent');
      const again = throttleReason();
      if (again) throw failure('busy', again);
      const ctl = new AbortController();
      const unlink = linkAbort(signal, ctl);
      let slowTimer: ReturnType<typeof setTimeout> | null = null;
      const stopSlow = () => {
        if (slowTimer !== null) clearTimeout(slowTimer);
        slowTimer = null;
      };
      let streaming = false;
      phase('thinking');
      slowTimer = setTimeout(() => {
        slowTimer = null;
        phase('slow');
      }, SLOW_AFTER_MS[template.tier]);
      recordCall();
      try {
        const res = await sample(turns, {
          modelTier: template.tier,
          cache: false,
          signal: ctl.signal,
          onText: ({ text }) => {
            if (!streaming) {
              streaming = true;
              stopSlow();
              phase('streaming');
            }
            const c = clean(text);
            if (c) {
              try {
                req.onText?.(c);
              } catch (err) {
                logError('ai:onText', err, scope);
              }
            }
          },
        });
        const text = clean(res.text);
        if (!text) throw failure('empty', 'empty_completion');
        if (res.modelTierApplied && res.modelTierApplied !== template.tier) {
          logWarn(scope, { code: 'tier_substituted', message: `${template.tier} → ${res.modelTierApplied}` });
        }
        if (res.truncated) logWarn(scope, { code: 'truncated', message: 'reply cut short' });
        phase('done');
        return { text, truncated: res.truncated === true, tierApplied: res.modelTierApplied ?? template.tier };
      } catch (err) {
        if (err instanceof AiFailure) throw err;
        const f = failureFromSample(err, scope);
        const partial = f.partial ? clean(f.partial) : '';
        throw partial === (f.partial ?? '') ? f : new AiFailure(f.kind, f.code, f.messageKey, partial || undefined);
      } finally {
        stopSlow();
        unlink();
      }
    } finally {
      release();
    }
  } catch (err) {
    const f = err instanceof AiFailure ? err : failureFromSample(err, scope);
    if (f.kind !== 'cancelled') phase('error');
    throw f;
  }
}
