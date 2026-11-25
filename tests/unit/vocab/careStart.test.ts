import { describe, expect, it, vi } from 'vitest';
import { catchUpWork } from '../../../src/features/vocab/autoSwitch';

// Test-Link v113 (25.11.2026): Die Wörter-Runde wartet auf `catchUpDone`. Lief die Pflege (236 Aufträge, jeder mit Datenbank-Aufrufen)
// innerhalb dieses Wartens, blieb die Übungsseite weiß. Die Pflege darf das Nachholen nie aufhalten und Fehler nie nach außen geben.

type W = Parameters<typeof catchUpWork>[1];
const writer = {} as W;
const snap = { raw: new Map(), valid: new Map(), invalid: [], counts: {}, possiblyTruncated: [] };

describe('catchUpWork', () => {
  it('liefert das Nachholen, ohne auf die Pflege zu warten', async () => {
    const startCare = vi.fn(() => new Promise<null>(() => undefined));
    const out = await catchUpWork({ startCatchUp: () => Promise.resolve({ n: 3 }), startCare } as never, writer, () => Promise.resolve(snap), 1);
    expect(out).toEqual({ n: 3 });
    await Promise.resolve();
    expect(startCare).toHaveBeenCalledTimes(1);
  });

  it('ein Fehler der Pflege bricht weder Nachholen noch Runde ab', async () => {
    const startCare = vi.fn(() => Promise.reject(new Error('boom')));
    const out = await catchUpWork({ startCatchUp: () => Promise.resolve('ok'), startCare } as never, writer, () => Promise.resolve(snap), 1);
    expect(out).toBe('ok');
    await new Promise((r) => setTimeout(r, 5));
    expect(startCare).toHaveBeenCalled();
  });
});
