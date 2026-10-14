import { describe, expect, it } from 'vitest';
import { checkApply, phraseUsed, stem, tokens } from '../../../src/modules/read/domain/apply';
import { ACTIVE_COURSES, COURSES, COURSE_IDS, TOTAL_LESSONS, courseDef, lessonKey, lessonPlan, parseLessonKey } from '../../../src/modules/read/domain/courses';
import { isLessonDocId, lessonDocId, parseLessonDocId, readDocKind, readLessonPath, READ_PROGRESS_PATH } from '../../../src/modules/read/domain/paths';

// Kurskatalog und lokale Prüfung des Schritts „Selbst anwenden“ (Paket L8).

describe('Kurskatalog', () => {
  it('8 Kurse mit zusammen 78 Lektionen; nur K1 und K5 sind aktiv (Entscheidung 14.10.2026)', () => {
    expect(COURSES).toHaveLength(8);
    expect(COURSES.map((c) => c.id)).toEqual([...COURSE_IDS]);
    expect(TOTAL_LESSONS).toBe(78);
    expect(COURSES.map((c) => c.lessons)).toEqual([10, 8, 10, 10, 10, 10, 12, 8]);
    expect(ACTIVE_COURSES.map((c) => c.id)).toEqual(['k1', 'k5']);
  });

  it('aktive Kurse haben einen vollständigen Plan (Titel EN/DE, Inhalt); jeder Kurs hat Titel und Ziel in beiden Sprachen', () => {
    for (const c of COURSES) {
      expect(c.titleEn.length, c.id).toBeGreaterThan(5);
      expect(c.titleDe.length, c.id).toBeGreaterThan(5);
      expect(c.goalEn.length, c.id).toBeGreaterThan(20);
      expect(c.goalDe.length, c.id).toBeGreaterThan(20);
    }
    for (const c of ACTIVE_COURSES) {
      expect(c.plan, c.id).toHaveLength(c.lessons);
      c.plan.forEach((p, i) => {
        expect(p.n).toBe(i + 1);
        expect(p.titleEn.length).toBeGreaterThan(3);
        expect(p.titleDe.length).toBeGreaterThan(3);
        expect(p.focus.length, `${c.id}-${p.n}`).toBeGreaterThan(40);
      });
    }
    for (const c of COURSES.filter((x) => !x.active)) expect(c.plan, c.id).toEqual([]);
  });

  it('Claude-Code-Kurse verlangen die offizielle Dokumentation; K5 nennt für EU AI Act eine Recherche', () => {
    expect(courseDef('k1')?.officialDocs).toBe(true);
    expect(courseDef('k2')?.officialDocs).toBe(true);
    expect(courseDef('k5')?.officialDocs).toBe(false);
    expect(lessonPlan('k5', 4)?.focus).toMatch(/Recherche/);
  });

  it('Schlüssel und Pfade: k1-03 ↔ c-k1-03 ↔ read/c-k1-03', () => {
    expect(lessonKey('k1', 3)).toBe('k1-03');
    expect(parseLessonKey('k1-03')).toEqual({ course: 'k1', n: 3 });
    expect(parseLessonKey('k1-11')).toBeNull();
    expect(parseLessonKey('k9-01')).toBeNull();
    expect(parseLessonKey('k1-00')).toBeNull();
    expect(lessonDocId('k1', 3)).toBe('c-k1-03');
    expect(readLessonPath('k5', 10)).toBe('read/c-k5-10');
    expect(isLessonDocId('c-k1-03')).toBe(true);
    expect(isLessonDocId('c-k1-3')).toBe(false);
    expect(parseLessonDocId('c-k5-10')).toEqual({ course: 'k5', n: 10 });
    expect(readDocKind('read/c-k1-03')).toBe('lesson');
    expect(readDocKind(READ_PROGRESS_PATH)).toBe('progress');
    expect(readDocKind('read/c-x')).toBe('unknown');
  });
});

describe('phraseUsed: Wendungen auch gebeugt', () => {
  it('Beugung, Zeitform, Pronomen, Einschub', () => {
    expect(phraseUsed('We stayed in control during the pilot.', 'stay in control')).toBe(true);
    expect(phraseUsed('She runs the tests every night.', 'run the tests')).toBe(true);
    expect(phraseUsed('They ran the tests again.', 'run the tests')).toBe(true);
    expect(phraseUsed('The models began to spread on their own.', 'spread on their own')).toBe(true);
    expect(phraseUsed('The virus can spread on its own.', 'spread on their own')).toBe(true);
    expect(phraseUsed('Please shut it down tonight.', 'shut down')).toBe(true);
    expect(phraseUsed('He widened the scope step by step.', 'widen the scope')).toBe(true);
    expect(phraseUsed('We avoid the risky shortcuts.', 'avoid risky shortcuts')).toBe(true);
  });

  it('falsche oder fehlende Wendungen zählen nicht', () => {
    expect(phraseUsed('We keep the tests green.', 'run the tests')).toBe(false);
    expect(phraseUsed('In control we stay.', 'stay in control')).toBe(false);
    expect(phraseUsed('We are in control.', 'stay in control')).toBe(false);
    expect(phraseUsed('', 'run the tests')).toBe(false);
    expect(phraseUsed('Run.', '')).toBe(false);
  });

  it('Hilfsfunktionen', () => {
    expect(tokens("It’s the team’s plan.")).toEqual(['its', 'the', 'teams', 'plan']);
    expect(stem('running')).toBe(stem('runs'));
    expect(stem('widened')).toBe(stem('widen'));
    expect(stem('went')).toBe('go');
  });
});

describe('checkApply: nur eine Hürde für Mühe und Sprache', () => {
  const targets = ['stay in control', 'run the tests'];
  it('leer, zu kurz, zu lang, nicht englisch', () => {
    expect(checkApply('', targets)).toMatchObject({ ok: false, problem: 'empty' });
    expect(checkApply('I stay in control.', targets)).toMatchObject({ ok: false, problem: 'tooShort' });
    expect(checkApply('x '.repeat(400), targets)).toMatchObject({ ok: false, problem: 'tooLong' });
    expect(checkApply('Ich behalte die Kontrolle bei dem Projekt. Die Tests laufen jede Nacht automatisch durch.', targets)).toMatchObject({ ok: false, problem: 'notEnglish' });
  });

  it('gut: zwei Sätze, beide Wendungen erkannt; fehlende blockieren nicht, werden aber benannt', () => {
    const good = checkApply('I stay in control of the project. The assistant can run the tests after each change.', targets);
    expect(good).toMatchObject({ ok: true, problem: null, sentences: 2 });
    expect(good.hits).toEqual([true, true]);
    const partial = checkApply('The assistant works inside my project folder. Every change is shown to me first.', targets);
    expect(partial.ok).toBe(true);
    expect(partial.hits).toEqual([false, false]);
  });
});
