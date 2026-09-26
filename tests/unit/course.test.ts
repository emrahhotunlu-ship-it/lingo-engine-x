import { describe, expect, it } from 'vitest';
import { LESSONS } from '../../src/domain/content';
import { baseLesson } from '../../src/domain/course/baseLesson';
import { catalog, lessonMeta } from '../../src/domain/course/catalog';
import { courseDone, isLessonDone, lessonDoneOn } from '../../src/domain/course/courseDone';
import { lessonWrite, readLesson } from '../../src/domain/course/lessonDoc';
import { assessFocusTopic, pickLesson } from '../../src/domain/course/next';
import { localProductionCheck } from '../../src/domain/course/production';
import { applyUpdate } from '../../src/domain/srs/applyReview';
import { loadSeed } from './helpers';

const done = (...ids: string[]) => ({ done: Object.fromEntries(ids.map((id, i) => [id, { d: '2026-09-1' + i, t: i + 1, n: 10, ok: 8 }])), res: {} });

describe('Katalog', () => {
  it('6 Einheiten, 24 Lektionen, je 6 Zielwörter', () => {
    const c = catalog();
    expect(c).toHaveLength(6);
    expect(c.flatMap((u) => u.lessons)).toHaveLength(24);
    for (const l of c.flatMap((u) => u.lessons)) expect(l.words).toHaveLength(6);
    expect(lessonMeta('l07')).toMatchObject({ grammar: 'passive', kind: 'job' });
    expect(lessonMeta('l99')).toBeNull();
  });
});

describe('nächste Lektion (D18)', () => {
  it('nächste offene in Kursreihenfolge', () => {
    expect(pickLesson({ course: done('l01', 'l02', 'l03', 'l04', 'l05', 'l06'), lang: 'de' })).toEqual({ lid: 'l07', why: null });
    expect(pickLesson({ course: undefined, lang: 'de' })).toEqual({ lid: 'l01', why: null });
    expect(pickLesson({ course: done(...LESSONS.map((l) => l.id)), lang: 'de' })).toBeNull();
  });

  it('Fokus der Einschätzung zieht eine Lektion mit dem Thema vor (nur bei passender Sprache, höchstens nächste Einheit)', () => {
    const course = done('l01', 'l02', 'l03', 'l04', 'l05', 'l06');
    const assess = { lang: 'de', data: { focus: { action: 'grammar:relative' } } };
    // l07 (u2) ist offen; relative ist l11 (u3) → nächste Einheit, also vorgezogen.
    expect(pickLesson({ course, assess, lang: 'de' })).toEqual({ lid: 'l11', why: 'whyFocus' });
    expect(pickLesson({ course, assess, lang: 'en' })).toEqual({ lid: 'l07', why: null });
    // prepositions ist l15 (u4) → zu weit weg.
    expect(pickLesson({ course, assess: { lang: 'de', data: { focus: { action: 'grammar:prepositions' } } }, lang: 'de' })!.lid).toBe('l07');
    expect(assessFocusTopic({ focus: { action: 'grammar:passive' } }, 'de')).toBe('passive');
  });
});

describe('Grundfassung ohne KI (D11)', () => {
  it('alle 24 Lektionen vollständig, je ≥ 4 Aufgaben, höchstens 1 mc wo möglich', () => {
    for (const l of LESSONS) {
      const meta = lessonMeta(l.id)!;
      const c = baseLesson(meta);
      expect(c.source).toBe('base');
      expect(c.words).toHaveLength(6);
      expect(c.dialogue.lines.length, l.id).toBeGreaterThanOrEqual(4);
      expect(c.tasks.length, l.id).toBeGreaterThanOrEqual(4);
      expect(c.tasks.every((t) => t.topic === meta.grammar)).toBe(true);
      expect(c.output!.mustUse).toHaveLength(3);
      if (l.grammar !== 'articles') expect(c.tasks.filter((t) => t.type === 'mc').length, l.id).toBeLessThanOrEqual(1);
    }
  });

  it('Kartensatz nur, wenn das Wort darin vorkommt (Kap. 15)', () => {
    const meta = lessonMeta('l01')!;
    const vocab = new Map([
      ['agenda', { word: 'agenda', ex: "Let's go through the [agenda] first." }],
      ['attendee', { word: 'attendee', ex: 'Nothing to see here.' }],
    ]);
    const c = baseLesson(meta, { vocab });
    expect(c.words[0]!.ex).toBe("Let's go through the [agenda] first.");
    expect(c.words.find((w) => w.en === 'attendee')!.ex).toBe('');
  });
});

describe('lesson/<lid> lesen und schreiben', () => {
  const seed = loadSeed();
  it('Seed l01–l08 lesbar; Fragen ohne lang gelten als de, q_alt für en', () => {
    for (const id of ['l01', 'l02', 'l03', 'l04', 'l05', 'l06', 'l07', 'l08']) {
      const doc = seed[`lesson/${id}`];
      if (!doc) continue;
      expect(readLesson(doc, 'de', lessonMeta(id)!), id).not.toBeNull();
    }
    const doc = {
      words: [{ en: 'agenda', de: 'Tagesordnung' }],
      questions: [{ q: 'Was ist das Ziel?', options: ['A', 'B'], answer: 'A', q_alt: 'What is the goal?', options_alt: ['a', 'b'], answer_alt: 'a' }],
      output: null,
    };
    const de = readLesson(doc, 'de', lessonMeta('l01')!)!;
    expect(de.questions[0]).toEqual({ q: 'Was ist das Ziel?', options: ['A', 'B'], answer: 'A' });
    const en = readLesson(doc, 'en', lessonMeta('l01')!)!;
    expect(en.questions[0]).toEqual({ q: 'What is the goal?', options: ['a', 'b'], answer: 'a' });
    expect(en.output).toBeNull();
    expect(readLesson({ words: [] }, 'de', lessonMeta('l01')!)).toBeNull();
  });

  it('Schreiben nach §4.8', () => {
    const out = { v: 1, words: [{ en: 'agenda' }], dialogue: { title: 'x', lines: [] }, lx: { pv: 'lesson-content@1', lang: 'de' } };
    expect(lessonWrite(undefined, out, 'l09')).toEqual({ set: out });
    expect(lessonWrite({ words: [{ en: 'x' }] }, out, 'l07')).toBeNull();
    const partial = lessonWrite({ words: [], dialogue: { title: 'alt', lines: [] }, custom: 1 }, out, 'l09');
    expect(partial).toEqual({ update: { v: 1, words: [{ en: 'agenda' }], lx: { pv: 'lesson-content@1', lang: 'de', regen: true } } });
    expect(lessonWrite({ words: 'kaputt' }, out, 'l09')).toBeNull();
  });
});

describe('app/course.done (§4.7)', () => {
  const e = { lid: 'l07', day: '2026-09-27', t: 100, n: 12, ok: 10 };
  it('K-02: erster Abschluss einmal, eine Wiederholung schreibt nur last', () => {
    expect(courseDone(undefined, e)).toEqual({ set: { done: { l07: { d: '2026-09-27', t: 100, n: 12, ok: 10 } }, res: {} } });
    const cur = { done: { l01: { d: 'x', t: 1 } }, res: { l01: { keep: true } } };
    const op = courseDone(cur, e) as { update: Record<string, unknown> };
    const after = applyUpdate(cur, op.update);
    expect(courseDone(after, e)).toBeNull();
    const again = courseDone(after, { ...e, day: '2026-09-30', t: 200 }) as { update: Record<string, unknown> };
    expect(again).toEqual({ update: { done: { l07: { last: { d: '2026-09-30', t: 200, n: 12, ok: 10 } } } } });
    const after2 = applyUpdate(after, again.update);
    expect((after2.done as Record<string, Record<string, unknown>>).l07!.d).toBe('2026-09-27');
    expect(after2.res).toEqual({ l01: { keep: true } });
    expect(courseDone(after2, { ...e, t: 150 })).toBeNull();
    expect(courseDone({ done: 'kaputt' }, e)).toBeNull();
  });

  it('D10: Lektion heute erledigt (erstmals oder als Wiederholung)', () => {
    expect(lessonDoneOn({ done: { l01: { d: '2026-09-27' } } }, '2026-09-27')).toBe(true);
    expect(lessonDoneOn({ done: { l01: { d: '2026-09-20', last: { d: '2026-09-27' } } } }, '2026-09-27')).toBe(true);
    expect(lessonDoneOn({ done: { l01: { d: '2026-09-20' } } }, '2026-09-27')).toBe(false);
    expect(isLessonDone({ done: { l01: { d: 'x' } } }, 'l01')).toBe(true);
  });
});

describe('lokale Prüfung der Produktion', () => {
  it('≥ 2 Pflichtwörter in beliebiger Form, ≥ 12 Wörter, nicht der Mustertext', () => {
    const must = ['agenda', 'to chair a meeting', 'to recap'];
    const text = 'Yesterday I chaired the meeting and we went through the agenda. At the end I recapped all action items.';
    expect(localProductionCheck(text, must)).toMatchObject({ ok: true, used: ['agenda', 'to chair a meeting', 'to recap'] });
    expect(localProductionCheck('The agenda is short.', must)).toMatchObject({ ok: false, tooShort: true });
    expect(localProductionCheck(text, must, text).tooSimilar).toBe(true);
  });
});
