import { describe, expect, it } from 'vitest';
import { CLINIC_REPAIR_CAP, MAIL_REPAIR_CAP, errorCount, errorEdits, errorsPer100, keepEdits, keepUsed, locateEdits, normWs, repairsFromEdits, type Edit } from '../../src/domain/tutor/edits';

// keepEdits & Co. (Lernplattform 3.0 P46, KT T-R3/T-R12): nur wörtlich belegte Stellen, Fehler und Verbesserungen getrennt, Fehlersätze mit Deckel.

const TEXT = 'We discussed about the budget yesterday. I will inform you about informations next week.';
const E = (from: string, to: string, extra: Record<string, unknown> = {}) => ({ from, to, kind: 'grammar', sev: 'error', pat: null, why: 'Weil es so ist.', ...extra });

describe('keepEdits', () => {
  it('behält belegte Stellen, verwirft erfundene', () => {
    const out = keepEdits([E('discussed about', 'discussed'), E('this is not in the text', 'x')], TEXT, []);
    expect(out.map((e) => e.from)).toEqual(['discussed about']);
  });

  it('Leerraum und typografische Anführungszeichen werden normalisiert', () => {
    expect(normWs('  a\n\n b ’c’ “d” ')).toBe('a b \'c\' "d"');
    const out = keepEdits([E('discussed   about', 'discussed')], 'We discussed\nabout the plan.', []);
    expect(out).toHaveLength(1);
  });

  it('nur ganze Wörter: „a“ trifft nicht in „budget“, und das Ende eines Wortes zählt nicht', () => {
    expect(keepEdits([E('bud', 'x')], TEXT, [])).toEqual([]);
    expect(keepEdits([E('get', 'x')], TEXT, [])).toEqual([]);
  });

  it('from gleich to, leere Begründung, Nicht-Objekte und zu lange Ausschnitte fallen weg', () => {
    const xs = [E('budget', 'budget'), E('budget', 'plan', { why: '  ' }), 'budget', null, E('x'.repeat(130), 'y')];
    expect(keepEdits(xs, TEXT, [])).toEqual([]);
  });

  it('Überlappungen: die erste Stelle bleibt, die überlappende fällt weg; dieselbe Stelle zweimal im Text wird getrennt belegt', () => {
    const out = keepEdits([E('discussed about the', 'discussed the'), E('about the budget', 'the budget')], TEXT, [], 3);
    expect(out).toHaveLength(1);
    const twice = keepEdits([E('about', 'on'), E('about', 'regarding')], TEXT, [], 3);
    expect(twice.map((e) => e.to)).toEqual(['on', 'regarding']);
  });

  it('Register ist nie ein Fehler; fehlendes sev nimmt den Vorgabewert, Unbekanntes zählt nicht als Fehler', () => {
    const out = keepEdits([E('budget', 'plan', { kind: 'register', sev: 'error' })], TEXT, []);
    expect(out[0]).toMatchObject({ kind: 'register', sev: 'upgrade' });
    const noSev = keepEdits([{ from: 'budget', to: 'plan', kind: 'word', why: 'Weil.' }], TEXT, [], 3, { sevDefault: 'error' });
    expect(noSev[0]?.sev).toBe('error');
    const strange = keepEdits([E('budget', 'plan', { sev: 'meh' })], TEXT, []);
    expect(strange[0]?.sev).toBe('upgrade');
  });

  it('Art tolerant: „preposition“ → grammar, „word choice“ → word', () => {
    const out = keepEdits([E('budget', 'plan', { kind: 'word choice' }), E('yesterday', 'on Monday', { kind: 'preposition' })], TEXT, []);
    expect(out.map((e) => e.kind)).toEqual(['word', 'grammar']);
  });

  it('pat nur aus der erlaubten Liste, sonst null', () => {
    const out = keepEdits([E('budget', 'plan', { pat: 'prp.no-prep' }), E('yesterday', 'then', { pat: 'made.up' })], TEXT, new Set(['prp.no-prep']));
    expect(out.map((e) => e.pat)).toEqual(['prp.no-prep', null]);
  });

  it('Deckel: Fehler vor Verbesserungen, danach in Textreihenfolge', () => {
    const xs = [E('yesterday', 'on Monday', { sev: 'upgrade' }), E('budget', 'plan', { sev: 'upgrade' }), E('discussed about', 'discussed'), E('informations', 'information')];
    const out = keepEdits(xs, TEXT, [], 3);
    expect(out.map((e) => e.from)).toEqual(['discussed about', 'yesterday', 'informations']);
    expect(errorCount(out)).toBe(2);
  });

  it('locateEdits liefert Lagen in Textreihenfolge im normalisierten Text', () => {
    const edits = keepEdits([E('informations', 'information'), E('discussed about', 'discussed')], TEXT, []);
    const spots = locateEdits(TEXT, edits);
    expect(spots.map((s) => normWs(TEXT).slice(s.start, s.end))).toEqual(['discussed about', 'informations']);
  });
});

describe('keepUsed', () => {
  it('nur mit Zitat, das wörtlich im Text steht, und bekannter Kennung', () => {
    const xs = [
      { pat: 'prp.no-prep', ok: false, quote: 'discussed about the budget' },
      { pat: 'prp.no-prep', ok: true, quote: 'doppelt' },
      { pat: 'xx.unknown', ok: true, quote: 'budget' },
      { pat: 'cnt.uncount', ok: true, quote: 'not in the text' },
    ];
    expect(keepUsed(xs, TEXT, ['prp.no-prep', 'cnt.uncount'])).toEqual([{ pat: 'prp.no-prep', ok: false, quote: 'discussed about the budget' }]);
  });
});

describe('Fehlersätze aus Fehlern', () => {
  const edits = (xs: unknown[]): Edit[] => keepEdits(xs, TEXT, ['prp.no-prep'], 12);

  it('ein Satz mit allen Korrekturen darin; Verbesserungen und Ton werden nie Fehlersätze', () => {
    const made = repairsFromEdits(TEXT, edits([E('discussed about', 'discussed', { pat: 'prp.no-prep' }), E('yesterday', 'on Monday', { sev: 'upgrade' }), E('informations', 'information')]), 'write', MAIL_REPAIR_CAP, 'status update');
    expect(made.map((m) => m.wrong)).toEqual(['We discussed about the budget yesterday.', 'I will inform you about informations next week.']);
    expect(made[0]?.right).toBe('We discussed the budget yesterday.');
    expect(made[0]).toMatchObject({ src: 'write', pat: 'prp.no-prep', ctx: 'status update' });
    expect(made[1]?.pat).toBeUndefined();
  });

  it('Deckel und Reihenfolge nach Art (grammar vor spelling)', () => {
    const e = edits([E('informations', 'information', { kind: 'spelling' }), E('discussed about', 'discussed', { kind: 'grammar' })]);
    const one = repairsFromEdits(TEXT, e, 'clinic', 1);
    expect(one).toHaveLength(1);
    expect(one[0]?.wrong).toContain('discussed about');
    expect(CLINIC_REPAIR_CAP).toBe(2);
    expect(MAIL_REPAIR_CAP).toBe(5);
  });

  it('Löschungen (to leer) zählen als Fehler, ergeben aber keinen Satz', () => {
    const e = edits([E('about', '')]);
    expect(errorCount(e)).toBe(1);
    expect(repairsFromEdits(TEXT, e, 'clinic', 2)).toEqual([]);
  });

  it('nur Fehler zählen', () => {
    const e = edits([E('budget', 'plan', { sev: 'upgrade' }), E('yesterday', 'then', { kind: 'register' })]);
    expect(errorEdits(e)).toEqual([]);
    expect(repairsFromEdits(TEXT, e, 'clinic', 2)).toEqual([]);
  });

  it('Fehler je 100 Wörter', () => {
    expect(errorsPer100(3, 120)).toBe(2.5);
    expect(errorsPer100(0, 0)).toBeNull();
  });
});
