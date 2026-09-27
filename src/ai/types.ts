import type { AiMessageKey } from '../i18n/parts/ai.de';
import type { CacheOpt, ChatTemplate, ModelTier, PromptTemplate } from '../prompts/types';

// Typen des KI-Tors (Kap. 10, Architektur-Entwurf §3.1).

export type { CacheOpt, ModelTier, PromptTemplate, AiMessageKey };

/**
 * Anzeige-Phasen einer Anfrage:
 * - `queued`: wartet auf einen freien Platz (höchstens 2 gleichzeitig),
 * - `thinking`: Aufruf läuft, noch kein Text („Denkt nach …", auch während des Zustimmungsdialogs),
 * - `streaming`: erster Text ist da,
 * - `slow`: dauert länger als üblich – nur ein Hinweis mit Stopp-Knopf, kein Abbruch (A6.2),
 * - `done` / `error`: fertig. Bei `cancelled` wird keine Phase mehr gemeldet.
 */
export type AiPhase = 'queued' | 'thinking' | 'streaming' | 'slow' | 'done' | 'error';

export type AiErrorKind =
  | 'cancelled'
  | 'unavailable'
  | 'busy'
  | 'signin'
  | 'refused'
  | 'empty'
  | 'invalid'
  | 'too_large'
  | 'bug'
  | 'failed';

export type AiPriority = 'user' | 'background';

export type AiRequest<V, O> = {
  template: PromptTemplate<V, O>;
  vars: V;
  /** Aus `useAiScope()` (Bildschirm) bzw. `scope.controller()` (Stopp-Knopf) oder XState `fromPromise`. */
  signal: AbortSignal;
  /** Phase 1: immer 'user'. */
  priority?: AiPriority;
  onPhase?: (phase: AiPhase) => void;
  /**
   * Nur beim Knopf „Erneut versuchen" nach einer ungültigen Antwort (Phase 5, E5-21): Der
   * Zwischenspeicher von `sample` wird einmal übergangen (`cache: {gcTime, refresh: true}`),
   * sonst käme dieselbe schemawidrige Antwort bis zu 24 h zurück.
   */
  refresh?: boolean;
  /** Bisheriger Antworttext beim Streamen (z. B. Teilübersetzung anzeigen); nur Anzeige, nie geprüft. */
  onPartial?: (text: string) => void;
};

export type AiResult<O> = {
  data: O;
  /**
   * Die antwortende Stufe: bei `verb: 'text-json'` die von `sample()` gemeldete
   * (`modelTierApplied`), sonst die angefragte – `sample.json` meldet sie nicht (contract/sample.d.ts).
   */
  tierApplied: ModelTier;
  /** true, wenn erst der eine erlaubte Neuversuch nach einem Schemafehler gültig war (A6.3). */
  retried: boolean;
};

/**
 * Der eine Fehlertyp des KI-Tors. `code` ist der Code der Laufzeit (`rate_limited` …) oder ein
 * eigener (`absent`, `paused`, `local_limit`, `schema`, `build`). `messageKey` ist der Text für
 * die Oberfläche (`null` bei `cancelled`). `partial` ist Teiltext, den die Oberfläche zeigen darf.
 */
export class AiFailure extends Error {
  constructor(
    readonly kind: AiErrorKind,
    readonly code: string,
    readonly messageKey: AiMessageKey | null,
    readonly partial?: string,
  ) {
    super(`${kind}: ${code}`);
    this.name = 'AiFailure';
  }
}

export const isAiFailure = (err: unknown): err is AiFailure => err instanceof AiFailure;

// ---------------------------------------------------------------- Streaming (Phase 3, Plan §6.1)

export type { ChatTemplate };

export type StreamRequest<V> = {
  template: ChatTemplate<V>;
  vars: V;
  signal: AbortSignal;
  priority?: AiPriority;
  onPhase?: (phase: AiPhase) => void;
  /** Bereinigter Text bis hierher (der ganze Text, nicht nur der Zuwachs). */
  onText?: (cleaned: string) => void;
};

export type StreamResult = { text: string; truncated: boolean; tierApplied: ModelTier };
