import { describe, expect, it } from 'vitest';
import { leaveAction } from '../../src/ui/exercise/leaveBook';

// Nachtrag LS3 (Nachprüfung P3): wie eine Übung mit Ergebnis beim Verlassen bucht – Trainer (hält) und eigener Schreibweg (Wort-Check).

const base = { result: true, done: false, busy: false, own: false } as const;

describe('leaveAction', () => {
  it('ohne Ergebnis, nach „Weiter“ oder während Claude prüft: nichts', () => {
    for (const cause of ['hidden', 'pagehide', 'go'] as const) {
      expect(leaveAction(cause, { ...base, result: false })).toBe('none');
      expect(leaveAction(cause, { ...base, done: 'go' })).toBe('none');
      expect(leaveAction(cause, { ...base, busy: true })).toBe('none');
      expect(leaveAction(cause, { ...base, own: true, busy: true })).toBe('none');
    }
  });

  it('Trainer: verborgen und pagehide speichern und halten, Gehen rechnet weiter; nach dem Halten nur noch weitergehen', () => {
    expect(leaveAction('hidden', base)).toBe('stay');
    expect(leaveAction('pagehide', base)).toBe('stay');
    expect(leaveAction('go', base)).toBe('go');
    expect(leaveAction('hidden', { ...base, done: 'stay' })).toBe('none');
    expect(leaveAction('pagehide', { ...base, done: 'stay' })).toBe('none');
    expect(leaveAction('go', { ...base, done: 'stay' })).toBe('release');
  });

  it('Wort-Check (eigener Schreibweg `onCommit`): ✕/Aushängen und pagehide buchen über diesen Weg, verborgen nichts', () => {
    const own = { ...base, own: true };
    expect(leaveAction('go', own)).toBe('go');
    expect(leaveAction('pagehide', own)).toBe('go');
    expect(leaveAction('hidden', own)).toBe('none');
  });
});
