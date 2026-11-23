import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureStreamAsyncIterator } from '../../src/platform/compat';

// Safari am Mac (23.11.2026): „undefined is not a function (near '...e of t...')“ – die Lautschrift der neuen Stimme läuft mit
// `for await` über einen ReadableStream, das kann Safari nicht. Die Nachrüstung muss genau das wie im Standard können.

const proto = ReadableStream.prototype as unknown as Record<PropertyKey, unknown>;
const nativeIter = proto[Symbol.asyncIterator];
const nativeValues = proto.values;

const streamOf = (parts: string[]) =>
  new ReadableStream<string>({
    start(c) {
      for (const p of parts) c.enqueue(p);
      c.close();
    },
  });

describe('ReadableStream mit for await (Safari)', () => {
  beforeEach(() => {
    delete proto[Symbol.asyncIterator];
    delete proto.values;
  });
  afterEach(() => {
    Object.defineProperty(proto, Symbol.asyncIterator, { value: nativeIter, writable: true, configurable: true });
    Object.defineProperty(proto, 'values', { value: nativeValues, writable: true, configurable: true });
  });

  it('rüstet nach, liest alle Teile und gibt den Strom wieder frei', async () => {
    expect(ensureStreamAsyncIterator()).toBe(true);
    const s = streamOf(['a', 'b', 'c']);
    const out: string[] = [];
    for await (const x of s as unknown as AsyncIterable<string>) out.push(x);
    expect(out).toEqual(['a', 'b', 'c']);
    expect(s.locked).toBe(false);
  });

  it('vorzeitiges Verlassen bricht den Strom ab', async () => {
    ensureStreamAsyncIterator();
    let cancelled = false;
    const s = new ReadableStream<number>({
      pull(c) {
        c.enqueue(1);
      },
      cancel() {
        cancelled = true;
      },
    });
    for await (const x of s as unknown as AsyncIterable<number>) {
      expect(x).toBe(1);
      break;
    }
    expect(cancelled).toBe(true);
    expect(s.locked).toBe(false);
  });

  it('wie in der Lautschrift: Blob → gzip entpacken → for await', async () => {
    ensureStreamAsyncIterator();
    const packed = await new Response(new Blob(['hello voice']).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
    const t = new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'));
    const n: Uint8Array[] = [];
    for await (const e of t as unknown as AsyncIterable<Uint8Array>) n.push(e);
    expect(await new Blob(n as BlobPart[]).text()).toBe('hello voice');
  });

  it('lässt eine vorhandene Fassung des Browsers stehen', () => {
    Object.defineProperty(proto, Symbol.asyncIterator, { value: nativeIter, writable: true, configurable: true });
    expect(ensureStreamAsyncIterator()).toBe(false);
    expect(proto[Symbol.asyncIterator]).toBe(nativeIter);
  });
});
