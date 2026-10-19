import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { allSeedTasks } from '../../src/domain/grammar/tasks';
import type { GrammarTask } from '../../src/domain/learn/types';
import { LINT_ISSUES, lintTask, type LintIssue } from '../../src/domain/tutor/lintTask';

// `lintTask` über den ganzen Bestand (Tutor-Engine v3 §4.2): bis zum Inhalts-Audit NUR eine Warnliste. Der Test wird nie rot wegen eines
// Befunds; er schreibt die Liste nach `tests/tutor/lint-report.txt` (nicht im Repository) und meldet die Zahl je Befund.

const REPORT = fileURLToPath(new URL('./lint-report.txt', import.meta.url));

const base: GrammarTask = { key: 'k', topic: 'used-to', type: 'gap', prompt: 'We ___ (have) a paper archive.', answer: 'used to have', accepted: [], options: null, hint: null, expl: { de: null, en: null }, src: 'seed', ref: null, errorT: null };

describe('lintTask: einzelne Regeln', () => {
  it('saubere Lücke mit Verb-Hinweis: kein Befund', () => {
    expect(lintTask(base)).toEqual([]);
  });
  it('erkennt jede Befundart', () => {
    expect(lintTask({ ...base, prompt: 'We ___ a ___ archive.' })).toContain('ambiguous');
    expect(lintTask({ ...base, alt: ['used to have'] })).toContain('ambiguous');
    expect(lintTask({ ...base, type: 'correct', prompt: 'We use to have it.', answer: 'We used to have it.' })).toContain('no_goal');
    expect(lintTask({ ...base, prompt: 'We ___ have a paper archive.' })).toContain('gap_whole');
    expect(lintTask({ ...base, prompt: 'We ___ a paper archive.' })).toContain('no_verb');
    expect(lintTask({ ...base, type: 'transform', prompt: 'Rewrite: we ___ a paper archive.' })).toContain('no_source');
    expect(lintTask({ ...base, type: 'correct', prompt: 'We used to have it.', answer: 'We used to have it.', goal: { de: 'x', en: 'x' } })).toContain('no_source');
  });
});

describe('lintTask: ganzer Bestand (nur Warnung)', () => {
  it('schreibt die Warnliste und zählt je Befund', () => {
    const tasks = allSeedTasks();
    const count = Object.fromEntries(LINT_ISSUES.map((i) => [i, 0])) as Record<LintIssue, number>;
    const lines: string[] = [];
    for (const t of tasks) {
      const issues = lintTask(t);
      for (const i of issues) count[i]++;
      if (issues.length) lines.push(`${issues.join(',')}\t${t.topic}\t${t.type}\t${t.prompt.replace(/\s+/g, ' ').slice(0, 140)}\t→ ${t.answer.slice(0, 60)}`);
    }
    const head = [`lintTask-Warnliste (${tasks.length} Aufgaben, ${lines.length} mit Befund)`, ...LINT_ISSUES.map((i) => `${i}: ${count[i]}`), ''];
    writeFileSync(REPORT, [...head, ...lines.sort()].join('\n') + '\n');
    // Nur zur Anzeige im Testlauf; nie rot.
    console.warn(`lintTask: ${LINT_ISSUES.map((i) => `${i}=${count[i]}`).join(' ')} (von ${tasks.length})`);
    expect(tasks.length).toBeGreaterThan(0);
  });
});
