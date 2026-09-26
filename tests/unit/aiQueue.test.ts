import { describe, expect, it } from 'vitest';
import { linkAbort } from '../../src/ai/abort';
import { aiMessageKey, kindOf } from '../../src/ai/errors';
import { AiQueue } from '../../src/ai/queue';
import { createAiScope, selectAiAvailable } from '../../src/ai/scope';
import { AiFailure, type AiErrorKind } from '../../src/ai/types';
import { aiDe } from '../../src/i18n/parts/ai.de';

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('AiQueue', () => {
  it('lässt höchstens max gleichzeitig laufen und gibt Plätze in Reihenfolge frei', async () => {
    const q = new AiQueue(2);
    const s = new AbortController().signal;
    const order: string[] = [];
    const r1 = await q.acquire(s);
    const r2 = await q.acquire(s);
    const p3 = q.acquire(s).then((r) => (order.push('c'), r));
    const p4 = q.acquire(s).then((r) => (order.push('d'), r));
    await flush();
    expect(q.running).toBe(2);
    expect(q.queued).toBe(2);
    r1();
    r1(); // doppelte Freigabe schadet nicht
    await flush();
    expect(order).toEqual(['c']);
    expect(q.running).toBe(2);
    r2();
    await flush();
    expect(order).toEqual(['c', 'd']);
    (await p3)();
    (await p4)();
    expect(q.running).toBe(0);
  });

  it("'user' kommt vor 'background'", async () => {
    const q = new AiQueue(1);
    const s = new AbortController().signal;
    const order: string[] = [];
    const r = await q.acquire(s);
    const bg = q.acquire(s, 'background').then((rel) => (order.push('bg'), rel));
    const user = q.acquire(s, 'user').then((rel) => (order.push('user'), rel));
    r();
    (await user)();
    (await bg)();
    expect(order).toEqual(['user', 'bg']);
  });

  it('meldet `queued` nur, wenn gewartet werden muss; Abbruch beim Warten → cancelled', async () => {
    const q = new AiQueue(1);
    const s = new AbortController().signal;
    let queued = 0;
    const r = await q.acquire(s, 'user', () => queued++);
    expect(queued).toBe(0);
    const ctl = new AbortController();
    const waiting = q.acquire(ctl.signal, 'user', () => queued++);
    expect(queued).toBe(1);
    ctl.abort();
    const err = (await waiting.catch((e: unknown) => e)) as AiFailure;
    expect(err).toBeInstanceOf(AiFailure);
    expect(err.kind).toBe('cancelled');
    expect(q.queued).toBe(0);
    r();
    expect(q.running).toBe(0);
  });

  it('bereits abgebrochenes Signal: sofort cancelled, kein Platz belegt', async () => {
    const q = new AiQueue(2);
    const ctl = new AbortController();
    ctl.abort();
    await expect(q.acquire(ctl.signal)).rejects.toBeInstanceOf(AiFailure);
    expect(q.running).toBe(0);
  });
});

describe('Abbruch-Kopplung und Bildschirm-Bereich', () => {
  it('linkAbort gibt den Abbruch weiter und lässt sich lösen', () => {
    const parent = new AbortController();
    const a = new AbortController();
    const b = new AbortController();
    linkAbort(parent.signal, a);
    const unlink = linkAbort(parent.signal, b);
    unlink();
    parent.abort('screen');
    expect(a.signal.aborted).toBe(true);
    expect(a.signal.reason).toBe('screen');
    expect(b.signal.aborted).toBe(false);
  });

  it('createAiScope: Schließen bricht Bildschirm und Einzelanfragen ab, Öffnen beginnt neu (StrictMode)', () => {
    const scope = createAiScope();
    const first = scope.signal;
    const stop = scope.controller();
    const other = scope.controller();
    stop.abort();
    expect(other.signal.aborted).toBe(false);
    expect(first.aborted).toBe(false);
    scope.close();
    expect(first.aborted).toBe(true);
    expect(other.signal.aborted).toBe(true);
    scope.open();
    expect(scope.signal).not.toBe(first);
    expect(scope.signal.aborted).toBe(false);
    scope.open();
    expect(scope.signal.aborted).toBe(false);
  });

  it('selectAiAvailable: nur bereit und nicht abgelehnt', () => {
    expect(selectAiAvailable({ sample: 'ready', sampleRevoked: false })).toBe(true);
    expect(selectAiAvailable({ sample: 'ready', sampleRevoked: true })).toBe(false);
    expect(selectAiAvailable({ sample: 'pending', sampleRevoked: false })).toBe(false);
    expect(selectAiAvailable({ sample: 'absent', sampleRevoked: false })).toBe(false);
  });
});

describe('Fehlerklassen', () => {
  it('jeder Vertragscode hat eine Art; unbekannte gelten als failed', () => {
    const table: Record<Claude.sample.SampleErrorCode, AiErrorKind> = {
      invalid_request: 'bug',
      prompt_too_large: 'too_large',
      images_unavailable: 'bug',
      tools_unavailable: 'bug',
      image_rejected: 'bug',
      cancelled: 'cancelled',
      not_granted: 'unavailable',
      session_expired: 'signin',
      sampling_disabled: 'unavailable',
      not_declared: 'unavailable',
      rate_limited: 'busy',
      refused: 'refused',
      empty_completion: 'empty',
      invalid_json: 'invalid',
      upstream_error: 'failed',
      capability_disabled: 'unavailable',
      capability_removed: 'unavailable',
      transform_error: 'bug',
      queue_overflow: 'bug',
    };
    for (const [code, kind] of Object.entries(table)) expect(kindOf(code), code).toBe(kind);
    expect(kindOf('brand_new_code')).toBe('failed');
  });

  it('jede Art außer cancelled hat einen vorhandenen Text', () => {
    const kinds: AiErrorKind[] = ['cancelled', 'unavailable', 'busy', 'signin', 'refused', 'empty', 'invalid', 'too_large', 'bug', 'failed'];
    for (const k of kinds) {
      const key = aiMessageKey(k);
      if (k === 'cancelled') expect(key).toBeNull();
      else expect(key && aiDe[key], k).toBeTruthy();
    }
  });
});
