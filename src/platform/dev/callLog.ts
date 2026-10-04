import type { SampleFn, SampleOptions, SampleResult } from '../types';
import { registerCannedReply } from './fakeSample';

// Feste Antworten des Entwicklungs-Adapters für die Vorlagen des Trainers (src/prompts/coach.ts).
export function registerCannedReplies(): void {
  registerCannedReply('coach-translate', 'We need to negotiate a better price.');
  registerCannedReply('coach-brief', 'Diese Woche lief stabil: 5 Tage trainiert, 82 % richtig. Bremsen tun dich die Artikel. Fokus nächste Woche: Artikel und Present Perfect.');
  registerCannedReply('coach-ask', '"Negotiate" heißt verhandeln. Beispiel: We negotiated a two-year contract.');
}

// ---------------------------------------------------------------- Aufrufprotokoll

export type SampleCall = {
  id: string | null;
  tier: Claude.sample.ModelTier;
  input: string;
  /** Phase 5: `cache`-Option des Aufrufs und Anzahl der Schritte (1 = Prompt). */
  cache?: Claude.sample.SampleOptions['cache'];
  turns?: number;
  /** Rolle des ersten und letzten Schritts (nur bei Schrittlisten). */
  roles?: string[];
};

/** Kennung der Vorlage aus der Kopfzeile `[id@version]`. */
export function templateIdOf(input: Claude.sample.SampleInput): string | null {
  const text = typeof input === 'string' ? input : (input[0]?.content ?? '');
  return /^\[([a-z0-9-]+)@\d+\]/.exec(text)?.[1] ?? null;
}

/**
 * Hülle um das nachgebildete `sample`: protokolliert jeden Aufruf (`control.sampleCalls`) und
 * verzögert ihn auf Wunsch (`sampleDelayMs`, z. B. für den Langsam-Hinweis im E2E-Test).
 */
export function withCallLog(inner: SampleFn, calls: SampleCall[], delayMs: number | (() => number) = 0, failOnce: Record<string, Claude.sample.SampleErrorCode> = {}): SampleFn {
  const delayOf = () => (typeof delayMs === 'function' ? delayMs() : delayMs);
  const wait = (signal: AbortSignal | undefined): Promise<void> =>
    delayOf() <= 0
      ? Promise.resolve()
      : new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
          }, delayOf());
          const onAbort = () => {
            clearTimeout(timer);
            reject({ code: 'cancelled', message: 'aborted while delayed' });
          };
          signal?.addEventListener('abort', onAbort, { once: true });
        });
  const log = (input: Claude.sample.SampleInput, options?: SampleOptions) => {
    const text = typeof input === 'string' ? input : input.map((t) => t.content).join('\n\n');
    calls.push({
      id: templateIdOf(input),
      tier: options?.modelTier ?? 'default',
      input: text,
      cache: options?.cache,
      turns: typeof input === 'string' ? 1 : input.length,
      roles: typeof input === 'string' ? [] : input.map((t) => t.role),
    });
  };
  /** Einmaliger Fehler je Vorlage (Phase 5: Fehlerpfade im E2E-Test). */
  const failed = (input: Claude.sample.SampleInput, signal: AbortSignal | undefined): Promise<never> | null => {
    const id = templateIdOf(input);
    const code = id ? failOnce[id] : undefined;
    if (!id || !code) return null;
    delete failOnce[id];
    return wait(signal).then(() => Promise.reject({ code, message: `simulated ${code}`, ...(code === 'upstream_error' ? { text: 'Kurzer Anfang der Antwort' } : {}) }));
  };
  const sample = ((input: Claude.sample.SampleInput, options?: SampleOptions): Promise<SampleResult> => {
    log(input, options);
    return failed(input, options?.signal) ?? wait(options?.signal).then(() => inner(input, options));
  }) as SampleFn;
  const json = <T,>(input: Claude.sample.SampleInput, options?: SampleOptions): Promise<T> => {
    log(input, options);
    return failed(input, options?.signal) ?? wait(options?.signal).then(() => inner.json<T>(input, options));
  };
  return Object.freeze(Object.assign(sample, { json, limits: () => inner.limits() }));
}
