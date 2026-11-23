import { logWarn } from './diagnostics';

// Safari-Lücken, die Bibliotheken voraussetzen (Safari am Mac 23.11.2026: „undefined is not a function (near '...e of t...')“).
// Die Lautschrift der neuen Stimme (Paket `phonemizer`, über kokoro-js) entpackt ihr Wörterbuch beim Laden mit
// `for await (const x of blob.stream().pipeThrough(new DecompressionStream('gzip')))`. Safari kann über einen ReadableStream
// nicht mit `for await` laufen: der Fehler fällt unbehandelt heraus, das Wörterbuch kommt nie an, und jedes `generate`
// wartet danach ewig (im Protokoll als „voice:hang“). Hier wird die fehlende Standard-Funktion nachgerüstet.

type StreamProto = Record<PropertyKey, unknown> & { getReader(): ReadableStreamDefaultReader<unknown> };

/**
 * Rüstet `ReadableStream.prototype[Symbol.asyncIterator]` (und `values`) nach, wenn der Browser es nicht hat.
 * Muss laufen, BEVOR das Stimmen-Stück geladen wird. Liefert `true`, wenn nachgerüstet wurde.
 */
export function ensureStreamAsyncIterator(): boolean {
  const RS = (globalThis as { ReadableStream?: { prototype: unknown } }).ReadableStream;
  if (typeof RS !== 'function') return false;
  const proto = RS.prototype as StreamProto;
  if (typeof proto[Symbol.asyncIterator] === 'function') return false;
  async function* values(this: StreamProto, opts?: { preventCancel?: boolean }): AsyncGenerator<unknown, void, undefined> {
    const reader = this.getReader();
    let finished = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          finished = true;
          return;
        }
        yield value;
      }
    } finally {
      // Vorzeitig verlassen (break/Fehler): den Strom abbrechen wie im Standard, außer `preventCancel`.
      if (!finished && !opts?.preventCancel) await reader.cancel().catch((err: unknown) => logWarn('compat:stream-cancel', err));
      reader.releaseLock();
    }
  }
  Object.defineProperty(proto, Symbol.asyncIterator, { value: values, writable: true, configurable: true });
  if (typeof proto.values !== 'function') Object.defineProperty(proto, 'values', { value: values, writable: true, configurable: true });
  return true;
}
