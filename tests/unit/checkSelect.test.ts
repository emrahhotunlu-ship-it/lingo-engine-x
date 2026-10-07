import { describe, expect, it } from 'vitest';
import { selectCheck } from '../../src/domain/check/select';
import { TOPICS } from '../../src/domain/content';
import { wholeSentence } from '../../src/domain/grammar/tasks';

// Wochen-Check (Lernplattform 2.0 §10.4 P8 Schritt 6): auch Bedeutungspaar, Fehler finden und Schlüsselwort, je Aufgabe genau ein
// Muster, mit Eingabeprofil `touch` nie ein ganzer Satz.

const NOW = Date.UTC(2026, 9, 7, 10);
const docs = (p: number) => new Map<string, Record<string, unknown>>(TOPICS.map((t) => [t.id, { n: 6, p, last: NOW }]));
const run = (p: number, seed: string, profile?: 'touch' | 'keys') =>
  selectCheck({ cards: [], grammarDocs: docs(p), sources: [], nowMs: NOW, dayEndMs: NOW + 86_400_000, lang: 'de', seed, ...(profile ? { profile } : {}) }).flatMap((i) => (i.kind === 'g' ? [i.task] : []));

describe('Wochen-Check: Grammatik-Aufgaben', () => {
  it('bei mittlerer Beherrschung kommen auch „Fehler finden“ und Schlüsselwort vor', () => {
    const types = new Set<string>();
    for (let k = 0; k < 12; k++) for (const t of run(0.55, `m${k}`)) types.add(t.type);
    expect(types.has('find') || types.has('kwt')).toBe(true);
  });

  it('bei niedriger Beherrschung kommt das Bedeutungspaar vor', () => {
    const types = new Set<string>();
    for (let k = 0; k < 12; k++) for (const t of run(0.2, `l${k}`)) types.add(t.type);
    expect(types.has('meaning')).toBe(true);
  });

  it('Aufgaben der neuen Arten haben genau ein Muster', () => {
    for (let k = 0; k < 12; k++) for (const t of run(0.55, `p${k}`).filter((x) => x.type === 'find' || x.type === 'kwt' || x.type === 'meaning')) expect(typeof t.pat === 'string' && t.pat.length > 0).toBe(true);
  });

  it('Eingabeprofil touch: nie ein ganzer Satz', () => {
    for (let k = 0; k < 12; k++) for (const t of run(0.85, `t${k}`, 'touch')) expect(wholeSentence(t), `${t.type}: ${t.prompt}`).toBe(false);
  });

  it('keine Aufgabe doppelt, höchstens fünf', () => {
    const list = run(0.55, 'd');
    expect(list.length).toBeLessThanOrEqual(5);
    expect(new Set(list.map((t) => `${t.topic}|${t.key}`)).size).toBe(list.length);
  });
});
