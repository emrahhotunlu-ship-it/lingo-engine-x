import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOC_BLOCK_TOTAL, DOC_WARN_TOTAL, docGate, docGateOf, mayCreateDoc, onDocBlocked, setDocTotal } from '../../src/domain/capacity/docGuard';
import { newVocabDoc, saveCardOp } from '../../src/domain/srs/newCard';

// Prüfbefund S8: Wächter auf die GESAMT-Dokumentenzahl (Warnung 3.500, Sperre 4.300), nie still.

afterEach(() => {
  setDocTotal(0);
  onDocBlocked(null);
});

describe('Dokumenten-Wächter', () => {
  it('Schwellen', () => {
    expect(docGateOf(DOC_WARN_TOTAL - 1)).toBe('ok');
    expect(docGateOf(DOC_WARN_TOTAL)).toBe('warn');
    expect(docGateOf(DOC_BLOCK_TOTAL - 1)).toBe('warn');
    expect(docGateOf(DOC_BLOCK_TOTAL)).toBe('full');
    expect(docGate()).toBe('ok');
  });

  it('ab der Sperre wird keine neue Karte angelegt, aber gemeldet; Ergänzen bleibt möglich', () => {
    const made = newVocabDoc({ word: 'leverage', de: 'Hebelwirkung', ex: 'We can [leverage] this.', src: 'user', origin: { v: 1, kind: 'user', t: 1 }, today: '2026-10-05' });
    expect(made).not.toBeNull();
    const seen = vi.fn();
    onDocBlocked(seen);
    setDocTotal(4000);
    expect(saveCardOp(undefined, made!)).toEqual({ set: made!.doc });
    expect(seen).not.toHaveBeenCalled();
    setDocTotal(DOC_BLOCK_TOTAL);
    expect(saveCardOp(undefined, made!)).toBeNull();
    expect(seen).toHaveBeenCalledWith(DOC_BLOCK_TOTAL);
    expect(mayCreateDoc('vocab/x')).toBe(false);
    // Bestehende Karte ohne Beispielsatz darf weiter ergänzt werden.
    expect(saveCardOp({ word: 'leverage', de: 'x', ex: '', origin: { v: 1 } }, made!)).toEqual({ update: { ex: made!.doc.ex } });
  });

  it('unbekannter Stand (0) sperrt nie', () => {
    setDocTotal(0);
    expect(mayCreateDoc('vocab/x')).toBe(true);
  });
});
