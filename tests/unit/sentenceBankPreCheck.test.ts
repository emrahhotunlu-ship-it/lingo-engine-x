import { describe, expect, it } from 'vitest';
import { acceptBankItem, preCheck } from '../../src/domain/tutor/sentenceBank';
import { tutorCtx } from '../../src/domain/tutor/ctx';

// Wort-Lernen 2, Teil 2: Vorprüfungen der Satzbank vor der Quarantäne (Wort im richtigen Sinn, Lücke eindeutig) und das Berufsprofil mit 5 Situationen.

const NOW = 1_700_000_000_000;
const run = (card: { id: string; en: string; pos?: string; lemma?: string }, en: string) =>
  acceptBankItem({ id: card.id, sents: [{ en, de: 'Ein deutscher Satz für die Prüfung hier.', sit: 'work', k: 'work' }] }, card, new Set(), NOW, 'word-bank@1');

describe('Satzbank: Vorprüfung', () => {
  it('Hauptwort nach „to“ (Infinitiv) = falscher Sinn', () => {
    expect(preCheck('We need to record every call with the client.', { id: 'record', en: 'record', pos: 'noun' })).toBe('sense');
    expect(run({ id: 'record', en: 'record', pos: 'noun' }, 'We need to record every call with the client.').rejected).toEqual(['sense']);
  });
  it('Hauptwort im richtigen Sinn bleibt', () => {
    expect(preCheck('The record of the meeting is in the shared folder.', { id: 'record', en: 'record', pos: 'noun' })).toBeNull();
  });
  it('Verb nach Artikel = falscher Sinn', () => {
    expect(preCheck('The schedule for next week is ready now.', { id: 'schedule', en: 'to schedule', pos: 'verb' })).toBe('sense');
  });
  it('Lücke nicht eindeutig: die Wendung steht ein zweites Mal im Satz', () => {
    expect(preCheck('Please follow up today, and follow up again on Friday.', { id: 'fu', en: 'follow up', lemma: 'follow up' })).toBe('gap');
  });
  it('ohne Wortart prüft sie nur die Lücke; normaler Satz bleibt angenommen', () => {
    expect(run({ id: 'convince', en: 'to convince' }, 'She wanted to convince the whole board of the new budget plan.').rejected).toEqual([]);
  });
});

describe('Berufsprofil: bis zu 5 Situationen in jeder Satzanfrage', () => {
  it('nennt 5 Situationen, nicht mehr', () => {
    const line = tutorCtx({ ctx2: { v: 1, role: 'Sales manager', field: 'logistics', who: [], sit: ['a1', 'b2', 'c3', 'd4', 'e5', 'f6'], terms: [], t: 1 } });
    expect(line).toContain('typical situations: a1; b2; c3; d4; e5');
    expect(line).not.toContain('f6');
  });
});
