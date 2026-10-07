import { markSampleRevoked, pauseBackground } from '../platform/capabilities';
import { logError, logWarn } from '../platform/diagnostics';
import { AiFailure, type AiErrorKind, type AiMessageKey } from './types';
import { pauseAi } from './status';

// Fehlercode der Laufzeit → Art → Text → Folge (Architektur-Entwurf §3.2, Schritt 8).
// Nie ein automatischer Neuversuch; einzige Ausnahme ist der Schemafehler in gate.ts (A6.3).

const KIND_BY_CODE: Readonly<Record<string, AiErrorKind>> = {
  cancelled: 'cancelled',
  not_granted: 'unavailable',
  sampling_disabled: 'unavailable',
  not_declared: 'unavailable',
  capability_disabled: 'unavailable',
  capability_removed: 'unavailable',
  rate_limited: 'busy',
  session_expired: 'signin',
  refused: 'refused',
  empty_completion: 'empty',
  invalid_json: 'invalid',
  prompt_too_large: 'too_large',
  invalid_request: 'bug',
  transform_error: 'bug',
  queue_overflow: 'bug',
  image_rejected: 'bug',
  images_unavailable: 'bug',
  tools_unavailable: 'bug',
  upstream_error: 'failed',
};

const KEY_BY_KIND: Readonly<Record<AiErrorKind, AiMessageKey | null>> = {
  cancelled: null,
  unavailable: 'aiUnavailable',
  busy: 'aiBusy',
  signin: 'aiSignin',
  refused: 'aiRefused',
  empty: 'aiEmpty',
  invalid: 'aiInvalid',
  too_large: 'aiTooLarge',
  bug: 'aiFailed',
  failed: 'aiFailed',
};

/** Unbekannte Codes gelten laut Vertrag als `upstream_error`. */
export function kindOf(code: string): AiErrorKind {
  return KIND_BY_CODE[code] ?? 'failed';
}

export function aiMessageKey(kind: AiErrorKind): AiMessageKey | null {
  return KEY_BY_KIND[kind];
}

export function failure(kind: AiErrorKind, code: string, partial?: string): AiFailure {
  return new AiFailure(kind, code, aiMessageKey(kind), partial);
}

export const cancelledFailure = (): AiFailure => failure('cancelled', 'cancelled');

type SampleErrorLike = { code: string; message?: unknown; text?: unknown };

const isSampleError = (err: unknown): err is SampleErrorLike =>
  typeof err === 'object' && err !== null && typeof (err as { code?: unknown }).code === 'string';

/**
 * Wandelt eine Ablehnung von `sample`/`sample.json` in einen `AiFailure` und löst die Folgen aus:
 * Ausblenden (`markSampleRevoked`), Pause nach `rate_limited`, Protokoll.
 */
export function failureFromSample(err: unknown, scope: string): AiFailure {
  if (err instanceof AiFailure) return err;
  if (!isSampleError(err)) {
    // Kein Fehler der Laufzeit, sondern ein Programmfehler im eigenen Code.
    logError(scope, err, 'unexpected');
    return failure('failed', 'unknown');
  }
  const kind = kindOf(err.code);
  // `refused`: Teiltext ist zurückgezogen; `cancelled`: Teiltext wird verworfen.
  const partial = kind !== 'cancelled' && kind !== 'refused' && typeof err.text === 'string' && err.text ? err.text : undefined;
  switch (kind) {
    case 'cancelled':
      break;
    case 'unavailable':
      markSampleRevoked();
      logWarn(scope, err);
      break;
    case 'busy':
      pauseAi();
      if (err.code === 'rate_limited') pauseBackground();
      logWarn(scope, err);
      break;
    case 'too_large':
    case 'bug':
      logError(scope, err);
      break;
    default:
      logWarn(scope, err, err.code === 'invalid_json' && partial ? partial.slice(0, 300) : undefined);
  }
  return failure(kind, err.code, partial);
}
