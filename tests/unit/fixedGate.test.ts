import { describe, expect, it } from 'vitest';
import { produceCheckV2 } from '../../src/prompts/produceCheckV2';
import { sentenceClinic } from '../../src/prompts/sentenceClinic';
import { addRepairs } from '../../src/domain/repair/repair';
import { correctionRules } from '../../src/prompts/fixedGate';

// Auswertung 15.10.2026, Punkt 1 und 2: Die korrigierte Fassung wird nachgeprüft, britische Formen werden zu US.

const vars = { target: 'jeopardize', meaning: 'gefährden', sentence: 'This may jeopardise the deal and the list are needed.', uiLang: 'de' as const, kind: 'word' as const };
const reply = (o: Record<string, unknown> = {}) => ({
  verdict: 'minor',
  usesTarget: true,
  fixed: 'This may jeopardize the deal.',
  why: 'Das Wort passt, aber der zweite Teil stimmt nicht.',
  better: '',
  whyBetter: '',
  errType: 'other',
  ...o,
});

describe('withFixedGate in produce-check@2', () => {
  const schema = produceCheckV2.schema(vars);
  const lenient = produceCheckV2.lenient?.(vars);

  it('britische Schreibweise in fixed und better wird zu US (jeopardising → jeopardizing)', () => {
    const r = schema.parse(reply({ fixed: 'This may be jeopardising the deal.', better: 'This could jeopardise the deal.', whyBetter: 'Natürlicher im Geschäftsenglisch hier.' }));
    expect(r.fixed).toBe('This may be jeopardizing the deal.');
    expect(r.better).toBe('This could jeopardize the deal.');
  });

  it('eine „richtige“ Fassung mit eindeutigem Fehler besteht nicht (der eine Neuversuch wird ausgelöst)', () => {
    const bad = reply({ fixed: 'The list with the document types are needed by Friday.' });
    const r = schema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('fixed still contains an error');
    expect(schema.safeParse(reply({ fixed: 'I suggest absolving the course.' })).success).toBe(false);
  });

  it('der Neuversuch (lenient) liefert dann eine leere, als unsicher markierte Fassung statt einer falschen', () => {
    const r = lenient?.parse(reply({ fixed: 'The list with the document types are needed by Friday.' }));
    expect(r).toMatchObject({ fixed: '', fixedUnsure: true });
  });

  it('leeres fixed bei einem Fehler: erlaubt, aber unsicher; bei „correct“ unberührt', () => {
    expect(schema.parse(reply({ fixed: '' }))).toMatchObject({ fixed: '', fixedUnsure: true });
    const ok = schema.parse(reply({ verdict: 'correct', fixed: '', errType: null }));
    expect(ok.fixedUnsure).toBeUndefined();
  });

  it('Prompt: Regeln für die Fassung, falsche Freunde und US-Schreibweise stehen drin', () => {
    const p = produceCheckV2.build(vars);
    expect(p).toContain('Fix EVERY error');
    expect(p).toContain('"eventually" is NOT German "eventuell"');
    expect(p).toContain('American spelling');
    expect(p).toContain('set fixed to ""');
    expect(correctionRules().length).toBeGreaterThanOrEqual(5);
  });
});

describe('Satz-Klinik', () => {
  it('Schema nimmt die Prüfung ebenfalls mit', () => {
    expect(typeof sentenceClinic.lenient).toBe('function');
    expect(sentenceClinic.build({ sentence: 'We discussed about it.', purpose: 'mail', uiLang: 'de', ctx: '', pats: '' })).toContain('Fix EVERY error');
  });
});

describe('Reparatur-Liste', () => {
  it('addRepairs bleibt unverändert; die Prüfung sitzt in saveRepairs (siehe repairGate.test.ts)', () => {
    const r = addRepairs([], [{ wrong: 'a b c', right: 'a b d', src: 'say' }], 1_700_000_000_000);
    expect(r).toHaveLength(1);
  });
});
