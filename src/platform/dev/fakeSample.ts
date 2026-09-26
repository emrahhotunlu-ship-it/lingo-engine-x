import type { SampleErrorCode, SampleFn, SampleOptions, SampleResult } from '../types';

// Entwicklungs-Adapter für `sample`: feste, realistische Antworten je Prompt-Vorlage.
// Vorlagen melden ihre Beispielantwort mit registerCannedReply an (erkannt an der
// Kopfzeile `[vorlage@version]`, mit der jede Prompt-Vorlage beginnt).

type Reply = string | ((input: string) => string);
const replies = new Map<string, Reply>();

export function registerCannedReply(templateId: string, reply: Reply): void {
  replies.set(templateId, reply);
}

export type FakeSampleMode = 'ok' | 'not_granted' | 'rate_limited' | 'upstream_error';

type Fail = { code: SampleErrorCode; message: string; text?: string };

const fail = (code: SampleErrorCode, message: string, text?: string): Fail =>
  text === undefined ? { code, message } : { code, message, text };

function flatten(input: unknown): string {
  if (typeof input === 'string') {
    if (!input.trim()) throw fail('invalid_request', 'input is empty');
    return input;
  }
  if (Array.isArray(input)) {
    if (input.length === 0) throw fail('invalid_request', 'turn list is empty');
    const turns = input as Array<{ role?: unknown; content?: unknown }>;
    if (turns[0]?.role !== 'user' || turns[turns.length - 1]?.role !== 'user') {
      throw fail('invalid_request', 'turns must start and end with a user turn');
    }
    for (const t of turns) {
      if ((t.role !== 'user' && t.role !== 'assistant') || typeof t.content !== 'string' || !t.content) {
        throw fail('invalid_request', 'each turn needs role user|assistant and non-empty content');
      }
    }
    return turns.map((t) => String(t.content)).join('\n\n');
  }
  throw fail('invalid_request', 'input must be a string or a list of turns');
}

function answerFor(text: string): string {
  const m = /^\[([a-z0-9-]+)@\d+\]/m.exec(text);
  const reply = m?.[1] ? replies.get(m[1]) : undefined;
  if (reply !== undefined) return typeof reply === 'function' ? reply(text) : reply;
  return 'Feste Beispielantwort des Entwicklungs-Adapters.';
}

/** Fehler je Vorlage (Plan §9.5): `{[vorlagenId]: code}` – z. B. Analyse fällt aus, Gespräch läuft weiter. */
export type SampleFailMap = Readonly<Record<string, SampleErrorCode>>;

const templateOf = (text: string): string | null => /^\[([a-z0-9-]+)@\d+\]/m.exec(text)?.[1] ?? null;

export function createFakeSample(getMode: () => FakeSampleMode, getFail: () => SampleFailMap = () => ({})): SampleFn {
  const run = (input: unknown, options: SampleOptions | undefined): Promise<SampleResult> =>
    new Promise<SampleResult>((resolve, reject) => {
      let text: string;
      try {
        if (options !== undefined && (typeof options !== 'object' || options === null || Array.isArray(options))) {
          throw fail('invalid_request', 'options must be a plain object');
        }
        if (options?.signal !== undefined && !(options.signal instanceof AbortSignal)) {
          throw fail('invalid_request', 'signal must be an AbortSignal (pass ctl.signal)');
        }
        if (options?.tools && options.cache !== undefined && options.cache !== false) {
          throw fail('invalid_request', 'cache cannot be combined with tools');
        }
        text = flatten(input);
      } catch (err) {
        queueMicrotask(() => reject(err));
        return;
      }
      const signal = options?.signal;
      if (signal?.aborted) {
        queueMicrotask(() => reject(fail('cancelled', 'signal already aborted')));
        return;
      }
      const failCode = (() => {
        const id = templateOf(text);
        return id ? getFail()[id] : undefined;
      })();
      if (failCode) {
        setTimeout(() => reject(fail(failCode, `simulated ${failCode}`)), 20);
        return;
      }
      const mode = getMode();
      if (mode !== 'ok') {
        setTimeout(() => reject(fail(mode, `simulated ${mode}`)), 20);
        return;
      }
      const answer = answerFor(text);
      const parts = answer.match(/[\s\S]{1,40}/g) ?? [answer];
      let sent = '';
      let i = 0;
      const onAbort = () => reject(fail('cancelled', 'aborted', sent || undefined));
      signal?.addEventListener('abort', onAbort, { once: true });
      const tick = () => {
        if (signal?.aborted) return;
        const delta = parts[i++] ?? '';
        sent += delta;
        options?.onText?.({ text: sent, delta });
        if (i < parts.length) setTimeout(tick, 15);
        else {
          signal?.removeEventListener('abort', onAbort);
          resolve({ text: sent, truncated: false, modelTierApplied: options?.modelTier ?? 'default' });
        }
      };
      setTimeout(tick, 30);
    });

  const sample = ((input: Claude.sample.SampleInput, options?: SampleOptions) => run(input, options)) as SampleFn;
  const json = async <T,>(input: Claude.sample.SampleInput, options?: SampleOptions): Promise<T> => {
    const res = await run(input, options);
    try {
      return JSON.parse(res.text) as T;
    } catch {
      throw fail('invalid_json', 'reply is not JSON', res.text);
    }
  };
  const limits = (): Promise<Claude.sample.SampleLimits> => Promise.resolve({ maxPromptBytes: 65536 });
  return Object.freeze(Object.assign(sample, { json, limits }));
}
