import { getSample } from '../platform/capabilities';
import { logError, logWarn } from '../platform/diagnostics';
import type { Turn, TurnInput } from '../prompts/types';
import { linkAbort } from './abort';
import { cancelledFailure, failure, failureFromSample } from './errors';
import { PROMPT_BUDGET_BYTES, SLOW_AFTER_MS } from './gate';
import { aiQueue } from './queue';
import { recordCall, throttleReason } from './status';
import { AiFailure, type AiPhase, type AiPriority, type CacheOpt, type ModelTier } from './types';

// Text- und Streaming-Weg des KI-Tors (Phase 5 §4, auch für Phase 3 gedacht).
//
// EIGENSTÄNDIGES MODUL – Hinweis für den Integrator: Phase 3 (Rollenspiel) und Phase 5
// (Begleiter) brauchen beide einen Weg `sample(input, {onText})` mit Freitext statt JSON.
// Er liegt bewusst NICHT in gate.ts, damit parallele Arbeitsstände nicht kollidieren.
// Er nutzt dieselben Stationen wie `askJson`:
//   Verfügbarkeit → Drosselung (status.ts) → Warteschlange (queue.ts, ≤ 2) →
//   genau EIN Aufruf `sample(input, {modelTier, cache, signal, onText})` mit eigenem Controller.
// Unterschiede zu `askJson`:
//   - Eingabe ist ein Prompt ODER eine Liste von Gesprächsschritten (`TurnInput`),
//   - kein Schema, deshalb **nie ein Neuversuch** (A6.3 gilt nur für JSON; sample.d.ts
//     „NEVER retry from a loop"),
//   - `onText` reicht den ganzen bisherigen Text weiter; `partial` im Fehler bleibt erhalten
//     (außer bei `refused` und `cancelled`, siehe errors.ts),
//   - `tierApplied` kommt aus `result.modelTierApplied` (nur `sample()` liefert ihn).
// Kein Timer-Abbruch (A6.2): Nach SLOW_AFTER_MS[tier] ohne ersten Text kommt nur die Phase `slow`.

export type { Turn, TurnInput };

export type TextUpdate = { text: string; delta: string };

export type TextRequest = {
  /** Kennung und Version der Vorlage – für Protokoll, Diagnose und die Kopfzeile im Adapter. */
  id: string;
  version: number;
  tier: ModelTier;
  input: string | TurnInput;
  /** Gespräche immer `false` (sample.d.ts: „every turn of a chat"). */
  cache: CacheOpt;
  signal: AbortSignal;
  priority?: AiPriority;
  onPhase?: (p: AiPhase) => void;
  onText?: (u: TextUpdate) => void;
};

export type TextResult = { text: string; truncated: boolean; tierApplied: ModelTier };

const encoder = new TextEncoder();

/** UTF-8-Bytes der Eingabe (Prompt oder Summe aller Schritte), wie sample.d.ts sie zählt. */
export function inputBytes(input: string | TurnInput): number {
  if (typeof input === 'string') return encoder.encode(input).length;
  let n = 0;
  for (const t of input) n += encoder.encode(t.content).length;
  return n;
}

/**
 * Formfehler einer Eingabe oder `null`. Eine Schrittliste beginnt und endet mit `user`, jede
 * Rolle ist `user`/`assistant`, kein Inhalt ist leer (sample.d.ts, `SampleInput`).
 */
export function inputProblem(input: string | TurnInput): string | null {
  if (typeof input === 'string') return input.trim() ? null : 'empty prompt';
  if (input.length === 0) return 'empty turn list';
  if (input[0]?.role !== 'user' || input[input.length - 1]?.role !== 'user') return 'turns must start and end with user';
  for (const t of input) {
    if (t.role !== 'user' && t.role !== 'assistant') return 'unknown role';
    if (typeof t.content !== 'string' || !t.content.trim()) return 'empty turn';
  }
  return null;
}

/**
 * Fragt Claude nach Freitext, auf Wunsch gestreamt. Löst mit dem ganzen Text auf oder lehnt
 * mit genau einem `AiFailure` ab (Teiltext in `partial`). Nur auf eine ausdrückliche Handlung
 * hin aufrufen; nie aus Schleifen oder Timern, nie automatisch wiederholen.
 */
export async function askText(req: TextRequest): Promise<TextResult> {
  const scope = `ai:${req.id}@${req.version}`;
  const phase = (p: AiPhase) => {
    try {
      req.onPhase?.(p);
    } catch (err) {
      logError('ai:onPhase', err, scope);
    }
  };
  try {
    const result = await runText(req, scope, phase);
    phase('done');
    return result;
  } catch (err) {
    const f = err instanceof AiFailure ? err : failureFromSample(err, scope);
    if (f.kind !== 'cancelled') phase('error');
    throw f;
  }
}

async function runText(req: TextRequest, scope: string, phase: (p: AiPhase) => void): Promise<TextResult> {
  const { signal } = req;
  if (signal.aborted) throw cancelledFailure();
  if (!getSample()) throw failure('unavailable', 'absent');

  const problem = inputProblem(req.input);
  if (problem) {
    // Programmfehler: Die Aufrufer bauen die Schritte selbst (domain/companion/turns.ts).
    logError(scope, { code: 'invalid_input', message: problem });
    throw failure('bug', 'invalid_input');
  }
  const bytes = inputBytes(req.input);
  if (bytes > PROMPT_BUDGET_BYTES) {
    logError(scope, { code: 'prompt_too_large', message: `${bytes} bytes > ${PROMPT_BUDGET_BYTES}` });
    throw failure('too_large', 'prompt_too_large');
  }
  guard(scope);

  const release = await aiQueue.acquire(signal, req.priority ?? 'user', () => phase('queued'));
  try {
    if (signal.aborted) throw cancelledFailure();
    const sample = getSample();
    if (!sample) throw failure('unavailable', 'absent');
    guard(scope);

    // Je Aufruf ein eigener Controller (sample.d.ts: „a NEW controller per call").
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
    }, SLOW_AFTER_MS[req.tier]);
    recordCall();
    // Die Schrittliste wird kopiert (sample liest die Argumente ohnehin nur einmal).
    const input: Claude.sample.SampleInput = typeof req.input === 'string' ? req.input : req.input.map((t) => ({ role: t.role, content: t.content }));
    try {
      const res = await sample(input, {
        modelTier: req.tier,
        cache: req.cache,
        signal: ctl.signal,
        onText: (u) => {
          if (!streaming) {
            streaming = true;
            stopSlow();
            phase('streaming');
          }
          try {
            req.onText?.({ text: u.text, delta: u.delta });
          } catch (err) {
            logError('ai:onText', err, scope);
          }
        },
      });
      if (res.truncated) logWarn(scope, { code: 'truncated', message: 'answer hit the length limit' });
      return { text: res.text, truncated: res.truncated, tierApplied: res.modelTierApplied };
    } catch (err) {
      throw failureFromSample(err, scope);
    } finally {
      stopSlow();
      unlink();
    }
  } finally {
    release();
  }
}

function guard(scope: string): void {
  const reason = throttleReason();
  if (reason === null) return;
  if (reason === 'local_limit') logWarn(scope, { code: 'local_limit', message: 'more than 20 AI calls within 60 s' });
  throw failure('busy', reason);
}
