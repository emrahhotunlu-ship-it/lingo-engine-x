import { describe, expect, it } from 'vitest';
import { patternFits, patternOf, patternsOf, topicsWithPatterns } from '../../src/domain/grammar/patterns';
import { seedTasks } from '../../src/domain/grammar/tasks';
import { legacyTaskKey } from '../../src/domain/grammar/key';
import { mapEntryOf } from '../../src/domain/grammar/patterns';

// Wächter (Fix Aufgabenbildschirm, 07.10.2026): Das Muster einer Aufgabe muss zu ihrer Konstruktion passen.
// Fall: „______ we hired a second developer earlier, …“ (Had we … statt If we had …) bekam über das Zeitwort „earlier“ das Muster
// „wish + had + Partizip · Bedauern“.
describe('Muster passt zur Aufgabe', () => {
  it('Inversion „Had we …“ bekommt nie das wish-Muster, sondern das Inversions-Muster', () => {
    const t = { topic: 'mixed-cond', prompt: '______ we hired a second developer earlier, the migration would not have taken so long.', answer: 'Had' };
    expect(patternOf(t)?.id).toBe('mc.inversion');
    expect(patternOf({ ...t, pat: 'mc.wish-past' })?.id).toBe('mc.inversion');
  });
  it('wish-Satz behält wish-Muster', () => {
    expect(patternOf({ topic: 'mixed-cond', prompt: 'I wish we ___ legal before signing yesterday.', answer: 'had involved' })?.id).toBe('mc.wish-past');
  });
  it('Alle Aufgaben mit Zuordnung: Muster trägt die Konstruktion des Satzes', () => {
    const bad: string[] = [];
    for (const t of seedTasks()) {
      const tp = patternsOf(t.topic);
      const e = tp && mapEntryOf(t.topic, legacyTaskKey(t.prompt));
      const p = e && tp.patterns.find((q) => q.id === e.pat);
      if (!p) continue;
      const text = /_{3,}/.test(t.prompt) ? `${t.prompt.replace(/_{3,}/, t.answer)} ${t.answer}` : t.prompt;
      if (!patternFits(p, text)) bad.push(`${t.topic}: ${t.prompt} → ${p.id}`);
    }
    expect(bad).toEqual([]);
  });
  it('Themen mit Muster bleiben erreichbar', () => {
    expect(topicsWithPatterns()).toContain('mixed-cond');
  });
});
