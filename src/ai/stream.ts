import { getSample, markSampleConfirmed } from '../platform/capabilities';
import { logError, logWarn } from '../platform/diagnostics';
import type { Turn, TurnInput } from '../prompts/types';
import { linkAbort } from './abort';
import { cancelledFailure, failure, failureFromSample } from './errors';
import { PROMPT_BUDGET_BYTES, SLOW_AFTER_MS } from './gate';
import { aiQueue } from './queue';
import { recordCall, throttleReason } from './status';
import { AiFailure, type AiPhase, type AiPriority, type CacheOpt, type ModelTier, type StreamRequest, type StreamResult } from './types';

// Die EINE Text- und Streaming-Schicht des KI-Tors (Phase 3 Rollenspiel, Phase 5 Begleiter).
// Dieselben Stationen wie `askJson`:
//   Verfügbarkeit → Budget → Drosselung (status.ts) → Warteschlange (queue.ts) →
//   genau EIN Aufruf `sample(input, {modelTier, cache, signal, onText})` mit eigenem Controller.
// Regeln (contract/sample.d.ts, CLAUDE.md A6.2/A6.3):
//   - `onText` reicht den GANZEN bisherigen Text weiter (plus `delta`),
//   - je Aufruf ein neuer AbortController, verknüpft mit dem Signal des Aufrufers,
//   - kein Timer-Abbruch: nach SLOW_AFTER_MS[tier] ohne ersten Text nur die Phase `slow`,
//   - kein Schema, deshalb **nie ein Neuversuch** (A6.3 gilt nur für JSON; „NEVER retry from a loop"),
//   - Fehler als genau ein `AiFailure` (rate_limited → busy, not_granted → gesperrt, errors.ts);
//     Teiltext bleibt in `partial` (außer bei `refused` und `cancelled`).
// `askText` ist der Kern (Prompt oder Schrittliste). `askStream` legt eine Gesprächsvorlage
// darüber: Schritte bauen, Teil- und Endtext bereinigen, leere Antwort als Fehler.

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

/** UTF-8-Bytes einer Schrittliste. */
export const turnsBytes = (turns: TurnInput): number => inputBytes(turns);

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

function phaseFn(scope: string, onPhase: ((p: AiPhase) => void) | undefined): (p: AiPhase) => void {
  return (p) => {
    try {
      onPhase?.(p);
    } catch (err) {
      logError('ai:onPhase', err, scope);
    }
  };
}

/**
 * Fragt Claude nach Freitext, auf Wunsch gestreamt. Löst mit dem ganzen Text auf oder lehnt
 * mit genau einem `AiFailure` ab (Teiltext in `partial`). Nur auf eine ausdrückliche Handlung
 * hin aufrufen; nie aus Schleifen oder Timern, nie automatisch wiederholen.
 */
export async function askText(req: TextRequest): Promise<TextResult> {
  const scope = `ai:${req.id}@${req.version}`;
  const phase = phaseFn(scope, req.onPhase);
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
    // Programmfehler: Die Aufrufer bauen die Schritte selbst (Vorlagen in src/prompts).
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
      const tierApplied = res.modelTierApplied ?? req.tier;
      if (tierApplied !== req.tier) logWarn(scope, { code: 'tier_substituted', message: `${req.tier} → ${tierApplied}` });
      if (res.truncated) logWarn(scope, { code: 'truncated', message: 'answer hit the length limit' });
      // Ein Nutzer-Aufruf wurde beantwortet: Hintergrundaufrufe sind erlaubt (P25, `sampleConfirmed`).
      if ((req.priority ?? 'user') === 'user') markSampleConfirmed();
      return { text: res.text, truncated: res.truncated === true, tierApplied };
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

/**
 * Gespräch über eine Vorlage (Rollenspiel): Schritte bauen, über `askText` streamen, Teil- und
 * Endtext mit `template.clean` bereinigen. `onText` bekommt den bereinigten ganzen Text; eine
 * leere Antwort ist ein Fehler (`empty`). Teiltext im Fehler wird ebenfalls bereinigt.
 */
export async function askStream<V>(req: StreamRequest<V>): Promise<StreamResult> {
  const { template } = req;
  const scope = `ai:${template.id}@${template.version}`;
  const phase = phaseFn(scope, req.onPhase);
  const clean = (text: string): string => {
    if (!template.clean) return text.trim();
    try {
      return template.clean(text);
    } catch (err) {
      logError(scope, err, 'clean');
      return text.trim();
    }
  };
  try {
    if (req.signal.aborted) throw cancelledFailure();
    if (!getSample()) throw failure('unavailable', 'absent');
    let turns: TurnInput;
    try {
      turns = template.buildTurns(req.vars);
    } catch (err) {
      logError(scope, err, 'build');
      throw failure('bug', 'build');
    }
    let res: TextResult;
    try {
      res = await askText({
        id: template.id,
        version: template.version,
        tier: template.tier,
        input: turns,
        cache: false,
        signal: req.signal,
        ...(req.priority ? { priority: req.priority } : {}),
        // „Fertig" erst nach der Prüfung auf eine leere Antwort (unten).
        onPhase: (p) => {
          if (p !== 'done' && p !== 'error') phase(p);
        },
        onText: ({ text }) => {
          const c = clean(text);
          if (!c) return;
          try {
            req.onText?.(c);
          } catch (err) {
            logError('ai:onText', err, scope);
          }
        },
      });
    } catch (err) {
      if (!(err instanceof AiFailure) || !err.partial) throw err;
      const partial = clean(err.partial);
      throw partial === err.partial ? err : new AiFailure(err.kind, err.code, err.messageKey, partial || undefined);
    }
    const text = clean(res.text);
    if (!text) throw failure('empty', 'empty_completion');
    phase('done');
    return { text, truncated: res.truncated, tierApplied: res.tierApplied };
  } catch (err) {
    const f = err instanceof AiFailure ? err : failureFromSample(err, scope);
    if (f.kind !== 'cancelled') phase('error');
    throw f;
  }
}
