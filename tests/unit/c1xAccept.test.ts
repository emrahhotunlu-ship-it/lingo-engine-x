// Annahmeprüfung für Claude-Aufgaben (Lernplattform 3.0 K-8, P12): eine Funktion für c1-gen und „Neue Aufgaben“.
import { describe, expect, it } from 'vitest';
import examples from '../fixtures/c1x/examples.json';
import { acceptC1, c1Hash, itemKey } from '../../src/domain/c1x/accept';
import { defaultCheckCtx } from '../../src/domain/c1x/checkContext';

const raw = (id: string): Record<string, unknown> => {
  const it = JSON.parse(JSON.stringify((examples.items as Array<Record<string, unknown>>).find((i) => i.id === id))) as Record<string, unknown>;
  delete it.id;
  return it;
};
const ctx = defaultCheckCtx();

describe('acceptC1', () => {
  it('nimmt eine gültige Aufgabe an, vergibt id aus dem Inhalt, setzt src ai', () => {
    const r = acceptC1(raw('mcc-0001'), ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.item.src).toBe('ai');
    expect(r.item.id).toMatch(/^mcc-ai-[0-9a-f]{8}$/);
    const again = acceptC1(raw('mcc-0001'), ctx);
    expect(again.ok && again.item.id).toBe(r.item.id); // geräteübergreifend gleich
    const other = acceptC1({ ...raw('mcc-0001'), text: 'The delay was largely ___ to a shortage of qualified people.' }, ctx);
    expect(other.ok && other.item.id).not.toBe(r.item.id);
  });

  it('weist Arten ohne formal prüfbare Regel ab', () => {
    for (const id of ['pair-0001', 'cnet-0001', 'reg-0001', 'para-0001']) expect(acceptC1(raw(id), ctx)).toEqual({ ok: false, reason: 'kind_not_allowed' });
  });

  it('weist Check-, Prüfungs- und Einstufungs-Kennzeichen ab', () => {
    for (const f of [{ probe: true }, { pool: 'gate' }, { form: 'A' }, { b: 3 }, { set: 'x' }]) {
      const r = acceptC1({ ...raw('ocl-0001'), ...f }, ctx);
      expect(r.ok).toBe(false);
    }
  });

  it('weist Schemaverstöße, Inhaltsfehler, Dubletten, falsche Sprache und britische Schreibweise ab', () => {
    expect(acceptC1(null).ok).toBe(false);
    expect(acceptC1({ ...raw('ocl-0001'), accept: [] }, ctx)).toMatchObject({ ok: false });
    expect(acceptC1({ ...raw('ocl-0001'), pat: 'em.gibts-nicht' }, ctx)).toMatchObject({ ok: false, reason: expect.stringContaining('content:') as string });
    const first = acceptC1(raw('ocl-0001'), ctx);
    if (!first.ok) throw new Error('erste Aufgabe sollte gültig sein');
    expect(acceptC1(raw('ocl-0001'), { ...ctx, known: new Set([itemKey(first.item)]) })).toEqual({ ok: false, reason: 'duplicate' });
    const bad = raw('ocl-0001');
    (bad.why as { ok: { de: string } }).ok.de = 'This explanation is written completely in English and has far too many English words in it.';
    expect(acceptC1(bad, ctx)).toMatchObject({ ok: false, reason: expect.stringContaining('nicht deutsch') as string });
    expect(acceptC1({ ...raw('ocl-0001'), text: 'Hardly ___ we organised the contract when the client asked for changes.' }, ctx).ok).toBe(false);
  });

  it('mcc: alle vier Optionen müssen im Wörterbuch stehen, wenn eines mitgegeben wird', () => {
    expect(acceptC1(raw('mcc-0001'), { ...ctx, knownWord: () => false })).toEqual({ ok: false, reason: 'unknown_word' });
    expect(acceptC1(raw('mcc-0001'), { ...ctx, knownWord: () => true }).ok).toBe(true);
  });

  it('der Hash ist stabil und reihenfolge-unabhängig', () => {
    const a = { x: 1, y: [1, 2], z: { b: 1, a: 2 } };
    const b = { z: { a: 2, b: 1 }, y: [1, 2], x: 1 };
    expect(c1Hash(a)).toBe(c1Hash(b));
    expect(c1Hash({ ...a, id: 'egal' })).toBe(c1Hash(a));
    expect(c1Hash(a)).toMatch(/^[0-9a-f]{8}$/);
  });
});
