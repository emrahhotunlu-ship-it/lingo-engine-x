import { afterEach, describe, expect, it } from 'vitest';
import { validateDoc } from '../../src/data/validate';
import { LESSONS, TOPICS } from '../../src/domain/content';
import { allLessons, catalog, lessonMeta, lessonOrder, setCourseExtension } from '../../src/domain/course/catalog';
import { extendFacts } from '../../src/domain/course/extendInput';
import { EMPTY_EXT, extCatalogOf, extensionState, extLessonDocs, isExtLessonId, nextExtIds, nextUnitN, readExtLesson } from '../../src/domain/course/extension';
import { lessonWrite, readLesson } from '../../src/domain/course/lessonDoc';
import { pickLesson } from '../../src/domain/course/next';
import { courseExtend, courseExtendExample, topicIdOf, type CourseExtendVars } from '../../src/prompts/courseExtend';
import { courseExtendReply } from '../../src/platform/dev/canned/courseExtend';

// Kap. 6.2: Kurs erweiterbar – Claude plant Lektionen ab l25 (course-extend@1), gespeichert
// additiv in `lesson/<lid>` mit Lehrplan `plan`, Abschluss über `app/course.done`.

type Doc = Record<string, unknown>;

const topics = TOPICS.map((t) => ({ id: t.id, name: t.name_en ?? t.name }));
const vars = (over: Partial<CourseExtendVars> = {}): CourseExtendVars => ({
  ctx: 'Head of Business Development at a DMS/ECM software company',
  unitN: 7,
  level: 'B2+',
  focus: 'Passive in reports',
  blockers: ['Articles before job titles'],
  weakTopics: ['articles', 'passive', 'mixed-cond'],
  radar: ['articles ×6', 'prepositions ×3'],
  topics,
  existing: LESSONS.map((l) => l.en),
  mix: { work: 70, life: 30 },
  ...over,
});

const done = (...ids: string[]) => ({ done: Object.fromEntries(ids.map((id, i) => [id, { d: '2026-09-1' + (i % 10), t: i + 1, n: 10, ok: 8 }])), res: {} });

function extDocs(): Map<string, Doc> {
  const out = courseExtendExample({ unitN: 7, weakTopics: ['articles', 'passive'], topics });
  return new Map(extLessonDocs(out, { ids: ['l25', 'l26', 'l27', 'l28'], unitN: 7, nowMs: 1_790_000_000_000, pv: 'course-extend@1', lang: 'de' }).map((d) => [d.id, d.doc]));
}

afterEach(() => setCourseExtension(EMPTY_EXT));

describe('Vorlage course-extend@1', () => {
  it('Kopfzeile, Einschätzung, Radar, erlaubte Themen und vorhandene Titel im Prompt; nie zwischengespeichert', () => {
    const p = courseExtend.build(vars());
    expect(p.split('\n')[0]).toBe('[course-extend@1]');
    expect(p).toContain('Current overall level (AI assessment): B2+');
    expect(p).toContain('Most frequent error categories: articles ×6, prepositions ×3');
    expect(p).toContain('passive: Passive voice');
    expect(p).toContain('Opening and running a meeting');
    expect(courseExtend.cache).toBe(false);
    expect(courseExtend.tier).toBe('default');
  });

  it('Beispielantwort und feste Testantwort bestehen das Schema', () => {
    const v = vars();
    const ex = courseExtend.schema(v).parse(courseExtendExample(v));
    expect(ex.lessons).toHaveLength(4);
    const canned = courseExtend.schema(v).parse(JSON.parse(courseExtendReply(courseExtend.build(v))));
    expect(canned.lessons.map((l) => l.grammar)).toEqual(['articles', 'passive', 'mixed-cond', 'articles']);
    expect(canned.lessons[0]!.words).toHaveLength(6);
  });

  it('tolerant: Themenname statt ID, Wörter als Paare, Stufe B1+/C2, überzählige Wörter, eine kaputte Lektion fällt weg', () => {
    const v = vars();
    const raw = courseExtendExample(v) as unknown as { lessons: Doc[] } & Doc;
    const lessons = raw.lessons.map((l) => ({ ...l }));
    lessons[0]!.grammar = 'Passive voice';
    lessons[1]!.words = [...(lessons[1]!.words as Array<[string, string]>).map(([en, de]) => [en, de]), ['extra phrase', 'Extra']];
    lessons[1]!.level = 'B1+';
    lessons[2]!.level = 'C2';
    lessons[3]!.en = 'Eine deutsche Überschrift für die Lektion hier';
    const out = courseExtend.schema(v).parse({ ...raw, lessons });
    expect(out.lessons).toHaveLength(3);
    expect(out.lessons[0]!.grammar).toBe('passive');
    expect(out.lessons[1]!.words).toHaveLength(6);
    expect(out.lessons[1]!.level).toBe('B2');
    expect(out.lessons[2]!.level).toBe('C1');
    expect(topicIdOf('Relative clauses', topics)).toBe('relative');
    expect(topicIdOf('unknown thing', topics)).toBe('unknown thing');
  });

  it('abgelehnt: unbekanntes Thema überall, doppelter Titel eines vorhandenen Kurses, falsche Sprache der Einheit', () => {
    const v = vars();
    const raw = courseExtendExample(v);
    expect(courseExtend.schema(v).safeParse({ ...raw, lessons: raw.lessons.map((l) => ({ ...l, grammar: 'phonetics' })) }).success).toBe(false);
    expect(courseExtend.schema(v).safeParse({ ...raw, lessons: raw.lessons.map((l, i) => (i === 0 ? { ...l, en: 'Opening and running a meeting' } : l)) }).success).toBe(false);
    expect(courseExtend.schema(v).safeParse({ ...raw, unit: { ...raw.unit, goal_de: raw.unit.goal_en } }).success).toBe(false);
  });
});

describe('Speicherform und Lesen (additiv, nie überschreiben)', () => {
  it('lesson/l25… mit Lehrplan `plan` ist ein gültiges Lektionsdokument ohne Inhalt', () => {
    for (const [id, doc] of extDocs()) {
      expect(validateDoc(`lesson/${id}`, doc).ok).toBe(true);
      expect(doc.words).toBeUndefined();
      expect((doc.lx as Doc).ext).toBe(true);
      const r = readExtLesson(id, doc)!;
      expect(r.unit).toMatchObject({ id: 'u7', n: 7, kind: 'job' });
      expect(r.lesson.words).toHaveLength(6);
    }
  });

  it('nur l25+ mit gültigem Lehrplan zählt; Reihenfolge nach Nummer; Einheiten sortiert', () => {
    const docs = extDocs();
    docs.set('l07', { plan: (docs.get('l25') as Doc).plan });
    docs.set('l29', { plan: { en: 'Broken' } });
    const c = extCatalogOf(new Map([...docs].reverse()));
    expect(c.lessons.map((l) => l.id)).toEqual(['l25', 'l26', 'l27', 'l28']);
    expect(c.units.map((u) => u.id)).toEqual(['u7']);
    expect(nextUnitN(c)).toBe(8);
    expect(nextUnitN(EMPTY_EXT)).toBe(7);
    expect(isExtLessonId('l24')).toBe(false);
    expect(isExtLessonId('l25')).toBe(true);
  });

  it('freie Kennungen nach der höchsten vorhandenen (auch ungültigen) Lektion, nie unter l25', () => {
    expect(nextExtIds(['l01', 'l24'], 4)).toEqual(['l25', 'l26', 'l27', 'l28']);
    expect(nextExtIds(['l25', 'l31', 'x'], 2)).toEqual(['l32', 'l33']);
  });

  it('„Lektion vorbereiten“ ergänzt nur den Inhalt, Lehrplan bleibt, keine Nachbesserungsmarke', () => {
    const cur = extDocs().get('l25')!;
    const content = { v: 1, t: 5, words: [{ en: 'adoption rate', de: 'Nutzungsquote', pos: 'noun', def: 'x', ex: 'x' }], dialogue: { title: 'T', lines: [] }, lx: { pv: 'lesson-content@2', lang: 'de' } };
    const op = lessonWrite(cur, content, 'l25') as { update: Doc };
    expect(op.update.plan).toBeUndefined();
    expect(op.update.words).toEqual(content.words);
    expect(op.update.lx).toEqual({ pv: 'lesson-content@2', lang: 'de' });
    // Mit Inhalt: nie überschrieben.
    expect(lessonWrite({ ...cur, words: content.words }, content, 'l25')).toBeNull();
    setCourseExtension(extCatalogOf(extDocs()));
    expect(readLesson({ ...cur, ...op.update }, 'de', lessonMeta('l25')!)?.words[0]!.en).toBe('adoption rate');
  });
});

describe('Katalog, nächste Lektion, Angebot', () => {
  it('Katalog kennt l25–l28 als Einheit 7 hinter dem Lehrplan', () => {
    expect(catalog()).toHaveLength(6);
    setCourseExtension(extCatalogOf(extDocs()));
    expect(catalog()).toHaveLength(7);
    expect(catalog()[6]).toMatchObject({ id: 'u7', n: 7 });
    expect(lessonOrder().slice(-5)).toEqual(['l24', 'l25', 'l26', 'l27', 'l28']);
    expect(allLessons()).toHaveLength(28);
    expect(lessonMeta('l26')).toMatchObject({ unit: 'u7', level: 'B2+' });
  });

  it('nach allen 24 Lektionen kommt l25; ohne Erweiterung keine', () => {
    const all = done(...LESSONS.map((l) => l.id));
    expect(pickLesson({ course: all, lang: 'de' })).toBeNull();
    setCourseExtension(extCatalogOf(extDocs()));
    expect(pickLesson({ course: all, lang: 'de' })).toEqual({ lid: 'l25', why: null });
    expect(pickLesson({ course: done(...LESSONS.map((l) => l.id), 'l25'), lang: 'de' })!.lid).toBe('l26');
  });

  it('Angebot nur ohne offene erweiterte Lektion; deutlich, wenn alles erledigt ist', () => {
    const base = LESSONS.map((l) => l.id);
    expect(extensionState({ doneIds: new Set(['l01']), baseIds: base, ext: EMPTY_EXT })).toEqual({ allowed: true, allDone: false });
    expect(extensionState({ doneIds: new Set(base), baseIds: base, ext: EMPTY_EXT })).toEqual({ allowed: true, allDone: true });
    const ext = extCatalogOf(extDocs());
    expect(extensionState({ doneIds: new Set(base), baseIds: base, ext })).toEqual({ allowed: false, allDone: false });
    expect(extensionState({ doneIds: new Set([...base, 'l25', 'l26', 'l27', 'l28']), baseIds: base, ext })).toEqual({ allowed: true, allDone: true });
  });

  it('Eingaben: Stufe, Fokus-Thema zuerst, schwächste Themen, häufigste Radar-Kategorien', () => {
    const f = extendFacts({
      assess: { lang: 'de', d: '2026-09-20', data: { cefr: 'B2', level: 'B2', focus: { title: 'Relativsätze', action: 'grammar:relative', days: 3 }, blockers: [{ title: 'Artikel', why: 'x', fix: 'y' }], dims: [] } },
      grammar: new Map([['articles', { p: 0.2 }], ['passive', { p: 0.9 }]]),
      radar: { events: [...Array.from({ length: 4 }, (_, i) => ({ c: 'prepositions', t: i, q: 'q' })), { c: 'articles', t: 9, q: 'q' }] },
      ext: EMPTY_EXT,
      lessons: allLessons(),
    });
    expect(f).toMatchObject({ unitN: 7, level: 'B2', focus: 'Relativsätze', blockers: ['Artikel'] });
    expect(f.weakTopics[0]).toBe('relative');
    expect(f.weakTopics).toContain('articles');
    expect(f.weakTopics).not.toContain('passive');
    expect(f.radar).toEqual(['prepositions ×4', 'articles ×1']);
    expect(f.existing).toHaveLength(24);
  });
});
