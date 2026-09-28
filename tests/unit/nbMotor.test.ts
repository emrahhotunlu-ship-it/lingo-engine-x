import { describe, expect, it } from 'vitest';
import { phrasalVerbs, registerLadder, transforms, transitionDrills, wordFormation } from '../../src/content/nb/load';
import { checkMotor, fromPhrasal, fromRegister, fromTransform, fromTransition, fromWordFormation, motorStart } from '../../src/domain/nbdrill/motor';

// Motor-Sätze (Plan N102, N107): alle Inhalte lokal prüfbar, Überleitungen je Lücke.

describe('Motor-Sätze', () => {
  it('jede Musterlösung jeder Art ist lokal richtig', () => {
    const sets = [
      transforms().map(fromTransform),
      wordFormation().map(fromWordFormation),
      registerLadder().map(fromRegister),
      phrasalVerbs().map(fromPhrasal),
      transitionDrills().flatMap(fromTransition),
    ];
    for (const list of sets) {
      expect(list.length).toBeGreaterThan(0);
      for (const m of list) {
        for (const a of m.answers) expect(checkMotor(m, a).verdict, `${m.id}: ${a}`).toBe('ok');
        expect(motorStart(m).length, m.id).toBeGreaterThan(0);
        if (m.gap) expect(m.gap.split('___'), m.id).toHaveLength(2);
      }
    }
  });

  it('Überleitungen: je Lücke eine Aufgabe, die anderen Lücken gefüllt', () => {
    const items = fromTransition({ id: 'd01', theme: 't01', text: '___, a. ___, b.', gaps: [{ answers: ['First'], fn: { de: 'x', en: 'x' } }, { answers: ['Then'], fn: { de: 'y', en: 'y' } }] });
    expect(items.map((i) => i.gap)).toEqual(['___, a. Then, b.', 'First, a. ___, b.']);
    expect(items.map((i) => i.id)).toEqual(['d01-1', 'd01-2']);
  });

  it('Phrasal Verbs: beide Richtungen', () => {
    const p = { id: 'p01', formal: 'postpone', phrasal: 'push back', de: 'verschieben', mail: ['We postpone it.'], call: ['We push it back.'] };
    expect(fromPhrasal(p).answers).toEqual(['We push it back.']);
    expect(fromPhrasal({ ...p, id: 'p02' }).answers).toEqual(['We postpone it.']);
  });

  it('Register: falscher Satz → Hinweis mit Anfang der Lösung', () => {
    const r = registerLadder()[0];
    if (!r) throw new Error('keine Register-Aufgaben');
    const m = fromRegister(r);
    const c = checkMotor(m, 'Something completely different.');
    expect(c.verdict).toBe('wrong');
    expect(c.hint).toBe('start');
  });
});
