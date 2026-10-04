import { describe, expect, it } from 'vitest';
import { isRetiredDuty, retireDuties } from '../../src/domain/plan/retire';
import type { DutyId } from '../../src/domain/plan/types';

describe('retireDuties', () => {
  it('trennt entfallene Pflichtpunkte von den weiter geltenden', () => {
    const duty: DutyId[] = ['review', 'lesson', 'ch:u-in', 'ch:u-task', 'ch:u-focus', 'ch:u-again', 'ch:say'];
    expect(retireDuties(duty)).toEqual({ kept: ['review', 'ch:u-task', 'ch:u-focus', 'ch:u-again'], retired: ['lesson', 'ch:u-in', 'ch:say'] });
  });

  it('lässt einen Plan ohne entfallene Punkte unverändert', () => {
    const duty: DutyId[] = ['review', 'ch:u-focus', 'ch:u-task'];
    expect(retireDuties(duty)).toEqual({ kept: duty, retired: [] });
  });

  it('kennt Wiederholen, Grammatik, Satzbau und Fehler korrigieren als weiter geltend', () => {
    for (const d of ['review', 'ch:u-focus', 'ch:u-task', 'ch:u-again', 'ch:u-check', 'ch:gram', 'ch:cloze', 'ch:order'] as DutyId[]) expect(isRetiredDuty(d)).toBe(false);
  });

  it('ändert die Eingabe nicht', () => {
    const duty: DutyId[] = ['lesson', 'review'];
    retireDuties(duty);
    expect(duty).toEqual(['lesson', 'review']);
  });
});
