import { describe, expect, it } from 'vitest';
import { bizScenes } from '../../src/content/nb/load';
import { THEMES } from '../../src/content/nb/themes';
import { bizRunMarker, bizSceneDoc, isBizId, sceneCriteria, sceneGoals, themeScene } from '../../src/domain/speak/bizScenes';
import { mergeGoalMarks, metCount, readGoalMarks } from '../../src/domain/speak/goals';
import { mergeScenes } from '../../src/domain/speak/library';
import { fixesOf, unitResult } from '../../src/domain/speak/unitResult';
import { goalCheck, stateOf, transcript } from '../../src/prompts/nb/p5/goalCheck';
import { roleplayResume } from '../../src/features/speak/resumable';

// Paket P5 (Neubau): reine Logik von Sprechen, Business & Preply.

type Doc = Record<string, unknown>;

describe('Business-Szenen (N70)', () => {
  const docs = bizScenes().map(bizSceneDoc);

  it('alle Szenen aus P7a werden startbare Bibliotheks-Szenen mit 3 Zielen', () => {
    expect(docs.length).toBeGreaterThanOrEqual(12);
    const lib = mergeScenes(docs, new Map(), new Set(), 'de');
    expect(lib.every((s) => s.valid && s.persona && s.opening)).toBe(true);
    for (const s of lib) {
      expect(sceneGoals(s)).toHaveLength(3);
      expect(sceneCriteria(s).length).toBeGreaterThanOrEqual(3);
      expect(isBizId(s.id)).toBe(true);
    }
  });

  it('jedes Wochenthema findet seine Szene', () => {
    const lib = mergeScenes(docs, new Map(), new Set(), 'en');
    for (const t of THEMES) expect(themeScene(lib, t.scene, t.id)?.id, t.id).toBe(t.scene);
  });

  it('Lauf-Vermerk speichert nur die Kennung, der Inhalt bleibt Quelle (Datenbank überlagert)', () => {
    const first = docs[0] as Doc;
    const id = String(first.id);
    const marker = { ...bizRunMarker(id), runs: 2, lastRun: 5 };
    expect(Object.keys(bizRunMarker(id)).sort()).toEqual(['id', 'src']);
    const [s] = mergeScenes([first], new Map([[id, marker]]), new Set(), 'de');
    expect(s?.runs).toBe(2);
    expect(s?.opening).toBe(first.opening);
    expect(sceneGoals(s!)).toHaveLength(3);
  });

  it('ältere Szenen haben genau ein Ziel aus goal/goal_de', () => {
    const [s] = mergeScenes([{ id: 'x', title: 'T', goal: 'Close the deal', goal_de: 'Abschluss holen', persona: { name: 'A' }, opening: 'Hi' }], new Map(), new Set(), 'de');
    expect(sceneGoals(s!)).toEqual([{ de: 'Abschluss holen', en: 'Close the deal' }]);
    expect(sceneCriteria(s!)).toEqual([]);
  });
});

describe('Ziel-Checkliste (N72)', () => {
  it('ein erreichtes Ziel bleibt erreicht, Zitat vom besten Zustand', () => {
    const a = mergeGoalMarks([], [{ i: 0, state: 'met', quote: 'five questions' }, { i: 1, state: 'partly', quote: 'so' }], 3);
    const b = mergeGoalMarks(a, [{ i: 0, state: 'open', quote: '' }, { i: 1, state: 'met', quote: 'if I hear you' }], 3);
    expect(b).toEqual([
      { i: 0, state: 'met', quote: 'five questions' },
      { i: 1, state: 'met', quote: 'if I hear you' },
      { i: 2, state: 'open', quote: '' },
    ]);
    expect(metCount(b)).toBe(2);
  });

  it('gespeicherte Markierungen werden tolerant gelesen', () => {
    expect(readGoalMarks([{ i: 0, state: 'met', quote: 'x' }, { i: 9, state: 'met' }, { i: 1, state: 'bad' }, 'x'])).toEqual([{ i: 0, state: 'met', quote: 'x' }]);
    expect(readGoalMarks(undefined)).toEqual([]);
  });

  it('goal-check@1: Kopfzeile, tolerante Zustände, Kriterien nur am Ende', () => {
    const vars = { goals: ['Ask 5 open questions', 'Sum up'], criteria: ['Short turns', 'Next step', 'Summary'], turns: [{ role: 'persona' as const, text: 'Hi' }, { role: 'me' as const, text: 'What is prompting you to look at this now?' }], final: false, uiLang: 'de' as const };
    const prompt = goalCheck.build(vars);
    expect(prompt.startsWith('[goal-check@1]')).toBe(true);
    expect(prompt).not.toContain('Criteria:');
    const out = goalCheck.schema(vars).parse({ goals: [{ i: '0', state: 'done', quote: 'What is prompting you' }, { i: 1, state: false }], criteria: [{ i: 0, state: 'met', quote: '', note: 'x' }] });
    expect(out.goals.map((g) => g.state)).toEqual(['met', 'open']);
    expect(out.criteria).toEqual([]);
    const fin = { ...vars, final: true };
    expect(goalCheck.build(fin)).toContain('Criteria:');
    const out2 = goalCheck.schema(fin).parse({ goals: [], criteria: [{ i: 2, state: 'partial', quote: 'so', note: 'Die Zusammenfassung fehlte am Ende.' }] });
    expect(out2.criteria[0]?.state).toBe('partly');
    expect(stateOf('reached')).toBe('met');
  });

  it('Verlauf wird gekürzt, das Ende bleibt', () => {
    const turns: Array<{ role: 'me' | 'persona'; text: string }> = Array.from({ length: 60 }, (_, i) => ({ role: i % 2 ? 'me' : 'persona', text: `line ${i} `.repeat(30) }));
    const t = transcript(turns);
    expect(t.length).toBeLessThanOrEqual(6000);
    expect(t).toContain('line 59');
  });
});

describe('Block 3 → Fokus/Nochmal (N75)', () => {
  it('Korrekturen werden Fixes, Deutsch-Fallen mit trapId', () => {
    const fixes = fixesOf([
      { wrong: 'Please send me the actual version of the contract.', right: 'Please send me the current version of the contract.', why: 'actual = tatsächlich' },
      { wrong: 'He go', right: 'He goes', why: '3rd person' },
      { wrong: 'He go', right: 'He goes', why: 'doppelt' },
      { wrong: 'x', right: '  ', why: 'leer' },
    ]);
    expect(fixes).toHaveLength(2);
    expect(fixes[0]).toMatchObject({ kind: 'trap' });
    expect(typeof fixes[0]?.trapId).toBe('string');
    expect(fixes[1]).toEqual({ kind: 'form', mine: 'He go', right: 'He goes', why: '3rd person' });
  });

  it('UnitTaskResult trägt Art, Verweis, Text und bessere Fassung', () => {
    const r = unitResult('task.say', 'say/2026-09#k1', '  My text  ', [], 'Better');
    expect(r).toEqual({ kind: 'task.say', ref: 'say/2026-09#k1', text: 'My text', better: 'Better', fixes: [] });
    expect('better' in unitResult('task.fluency', 'f', 't', [], '')).toBe(false);
  });
});

describe('Rollenspiel: Fortsetzen', () => {
  it('Momentaufnahme → herstellen → gleiche Position (G3)', () => {
    expect(roleplayResume.route({ sceneId: 'b03', unit: 3 })).toEqual({ name: 'roleplay', sceneId: 'b03', resume: true, unit: 3 });
    expect(roleplayResume.restore({ sceneId: '' })).toBe(false);
  });
});
