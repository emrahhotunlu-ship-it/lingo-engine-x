import { describe, expect, it } from 'vitest';
import { errorTask, dueErrors } from '../../src/domain/grammar/errors';
import { whyOfError } from '../../src/domain/grammar/errorWhy';
import { seedExplOf } from '../../src/domain/grammar/seedExpl';
import { seedTasks } from '../../src/domain/grammar/tasks';
import { berlin } from './helpers';

// Erklärung bei der Fehlerwiederholung (Lernplattform 2.0 §4.7): `errorTask` übernimmt sie aus dem Eintrag, sonst aus der
// Zuordnung bzw. der Startaufgabe mit gleichem Schlüssel (bisher immer leer).

const t0 = berlin('2026-10-06', 10);

describe('errorTask: Erklärung', () => {
  it('aus der Startaufgabe mit gleichem Schlüssel (kein leeres Warum mehr)', () => {
    const t = seedTasks().find((x) => x.topic === 'past-simple-perfect' && x.type === 'gap')!;
    const task = errorTask(t.topic, { q: t.prompt, given: 'x', ans: t.answer, t: t0 })!;
    expect(task.expl.de ?? task.expl.en).toBeTruthy();
  });

  it('der Eintrag selbst gewinnt vor Zuordnung und Startaufgabe', () => {
    const t = seedTasks().find((x) => x.topic === 'past-simple-perfect' && x.type === 'gap')!;
    const task = errorTask(t.topic, { q: t.prompt, given: 'x', ans: t.answer, t: t0, expl: { de: 'Eigene Erklärung.', en: 'Own.' } })!;
    expect(task.expl).toEqual({ de: 'Eigene Erklärung.', en: 'Own.' });
  });

  it('unbekannter Satz: leer wie bisher; die Eigenschaft bleibt beschreibbar und kopierbar', () => {
    const task = errorTask('past-simple-perfect', { q: 'Nothing known ___ here.', given: 'x', ans: 'ok', t: t0 })!;
    expect(task.expl).toEqual({ de: null, en: null });
    const copy = JSON.parse(JSON.stringify(task)) as typeof task;
    expect(copy.expl).toEqual({ de: null, en: null });
    task.expl = { de: 'x', en: null };
    expect(task.expl.de).toBe('x');
  });

  it('dueErrors liefert die Erklärung mit (Fehlerwiederholung in Runden)', () => {
    const t = seedTasks().find((x) => x.topic === 'mixed-cond' && x.type === 'gap')!;
    const doc = { errors: [{ q: t.prompt, given: 'x', ans: t.answer, t: t0 - 3 * 86_400_000, src: 'duty' }] };
    const [d] = dueErrors(new Map([['mixed-cond', doc]]), t0);
    expect(d!.task.expl.de ?? d!.task.expl.en).toBeTruthy();
  });
});

describe('seedExplOf entspricht den Erklärungen von seedTasks (kein Auseinanderlaufen)', () => {
  it('für jede Startaufgabe', () => {
    for (const t of seedTasks()) {
      const got = seedExplOf(t.key);
      if (t.expl.de || t.expl.en) expect(got, t.prompt).toEqual(t.expl);
      else expect(got, t.prompt).toBeNull();
    }
  });
});

describe('whyOfError über das Muster', () => {
  it('Pilotsatz: aufgabengenaue Begründung; unbekannter Satz mit Muster-Kennung: Verwendung des Musters', () => {
    const t = seedTasks().find((x) => x.topic === 'mixed-cond' && x.type === 'gap')!;
    expect(whyOfError('mixed-cond', { q: t.prompt }, 'de').length).toBeGreaterThan(10);
    const viaPat = whyOfError('mixed-cond', { q: 'Brand new ___ sentence.', pat: 'mc.wish-past' }, 'en');
    expect(viaPat).toMatch(/\w/);
    expect(viaPat).not.toBe(whyOfError('mixed-cond', { q: 'Brand new ___ sentence.' }, 'en'));
  });
});
