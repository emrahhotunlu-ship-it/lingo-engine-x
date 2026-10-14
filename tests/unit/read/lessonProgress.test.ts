import { describe, expect, it } from 'vitest';
import { createWriter } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { ACTIVE_COURSES } from '../../../src/modules/read/domain/courses';
import type { CourseId } from '../../../src/modules/read/domain/courses';
import { courseProgress, courseRows, entryStatus, finishedToday, firstUnfinished, isComplete, lessonStatePlan, mergeEntry, parseProgress, pickNextLesson } from '../../../src/modules/read/domain/lessonProgress';
import type { LessonEntry } from '../../../src/modules/read/domain/lessonProgress';
import { buildWarmup, keptPhrasesOf, warmupRight } from '../../../src/modules/read/domain/warmup';
import { loadCourseHome, loadLesson, saveLessonProgress } from '../../../src/modules/read/courseStore';
import { acceptLesson } from '../../../src/modules/read/domain/lesson';
import { seedLesson } from './fixtures';

// Kursfortschritt (Paket L8): Zustände, Freischaltung (Lektion n+1 nach n), Zusammenführen auf zwei Geräten, Aufwärmen, Laden und Schreiben.

const NOW = Date.UTC(2026, 9, 14, 10, 0, 0);
const done = (course: CourseId, n: number, extra: Partial<LessonEntry> = {}): LessonEntry => ({ id: `${course}-${String(n).padStart(2, '0')}`, course, n, rd: true, qa: 3, qok: 3, ap: true, done: true, tD: NOW, ...extra });
const entry = (course: CourseId, n: number, extra: Partial<LessonEntry> = {}): LessonEntry => ({ id: `${course}-${String(n).padStart(2, '0')}`, course, n, ...extra });

describe('Lesen lesen: read/cp', () => {
  it('kaputte Einträge werden ausgeblendet, ein Dokument ohne Listenaufbau ist unbrauchbar', () => {
    const r = parseProgress({ v: 1, items: [done('k1', 1), { id: 'k9-01' }, { nope: 1 }, entry('k5', 2, { sec: 5 })] });
    expect(r.ok && r.items.map((i) => i.id)).toEqual(['k1-01', 'k5-02']);
    expect(r.ok && r.hidden).toHaveLength(2);
    expect(parseProgress(undefined)).toEqual({ ok: true, items: [], hidden: [] });
    expect(parseProgress({ v: 1, items: 'x' }).ok).toBe(false);
  });
});

describe('Zustände', () => {
  it('entryStatus: offen, angefangen, fertig', () => {
    expect(entryStatus(null)).toBe('open');
    expect(entryStatus(entry('k1', 1))).toBe('open');
    expect(entryStatus(entry('k1', 1, { sec: 20 }))).toBe('started');
    expect(entryStatus(entry('k1', 1, { qa: 1 }))).toBe('started');
    expect(entryStatus(done('k1', 1))).toBe('done');
  });

  it('fertig = Text gelesen + drei Fragen + Anwenden abgeschickt', () => {
    expect(isComplete({ rd: true, qa: 3, ap: true })).toBe(true);
    expect(isComplete({ rd: false, qa: 3, ap: true })).toBe(false);
    expect(isComplete({ rd: true, qa: 2, ap: true })).toBe(false);
    expect(isComplete({ rd: true, qa: 3, ap: false })).toBe(false);
  });

  it('Lektion n+1 kommt erst nach n: courseRows', () => {
    const rows = courseRows('k1', [done('k1', 1), done('k1', 2), entry('k1', 3, { sec: 30 })], true);
    expect(rows.map((r) => r.state)).toEqual(['done', 'done', 'started', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked']);
    expect(courseRows('k1', [], true)[0]?.state).toBe('open');
    // Dokument der aktuellen Lektion fehlt: „wird vorbereitet“, alle danach gesperrt.
    expect(courseRows('k1', [done('k1', 1)], false).slice(0, 3).map((r) => r.state)).toEqual(['done', 'pending', 'locked']);
    expect(courseRows('k1', [], true)).toHaveLength(10);
    expect(courseRows('k5', [], false)).toHaveLength(10);
    expect(courseRows('k9' as CourseId, [], true)).toEqual([]);
  });

  it('firstUnfinished und Fortschritt; ein fertiger Kurs hat keine aktuelle Lektion', () => {
    const all = Array.from({ length: 10 }, (_, i) => done('k1', i + 1));
    expect(firstUnfinished({ lessons: 10 }, all, 'k1')).toBeNull();
    expect(firstUnfinished({ lessons: 10 }, [done('k1', 1), done('k1', 3)], 'k1')).toBe(2);
    expect(courseProgress('k1', [done('k1', 1), done('k1', 2), done('k5', 1)])).toEqual({ done: 2, total: 10 });
    expect(courseRows('k1', all, true).every((r) => r.state === 'done')).toBe(true);
  });
});

describe('Hauptknopf: welche Lektion?', () => {
  const ready = (...c: CourseId[]) => new Set<CourseId>(c);
  it('zuerst eine angefangene, sonst der Kurs, den Emrah am längsten nicht hatte (zwei Kurse wechseln sich ab)', () => {
    expect(pickNextLesson(ACTIVE_COURSES, [], ready('k1', 'k5'))).toMatchObject({ course: 'k1', n: 1, key: 'k1-01', state: 'open' });
    expect(pickNextLesson(ACTIVE_COURSES, [done('k1', 1, { tD: NOW })], ready('k1', 'k5'))).toMatchObject({ course: 'k5', n: 1, state: 'open' });
    expect(pickNextLesson(ACTIVE_COURSES, [done('k1', 1, { tD: NOW }), done('k5', 1, { tD: NOW + 1000 })], ready('k1', 'k5'))).toMatchObject({ course: 'k1', n: 2 });
    expect(pickNextLesson(ACTIVE_COURSES, [done('k1', 1), entry('k5', 1, { sec: 40 })], ready('k1', 'k5'))).toMatchObject({ course: 'k5', n: 1, state: 'started' });
  });

  it('nichts bereit → null; nur bereite Kurse zählen', () => {
    expect(pickNextLesson(ACTIVE_COURSES, [], ready())).toBeNull();
    expect(pickNextLesson(ACTIVE_COURSES, [], ready('k5'))).toMatchObject({ course: 'k5' });
  });

  it('finishedToday: nach einer fertigen Lektion bietet der Hauptknopf nicht gleich die nächste an', () => {
    const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    expect(finishedToday([done('k1', 1, { tD: NOW })], dayOf, '2026-10-14')).toBe(true);
    expect(finishedToday([done('k1', 1, { tD: NOW })], dayOf, '2026-10-15')).toBe(false);
    expect(finishedToday([entry('k1', 1, { sec: 9 })], dayOf, '2026-10-14')).toBe(false);
  });
});

describe('mergeEntry: zwei Geräte', () => {
  it('Zeit und Fragen nur nach oben, gelesen/abgeschickt nur von falsch auf wahr, t0 der erste Beginn', () => {
    const a = mergeEntry(entry('k1', 1, { sec: 100, qa: 2, qok: 1, rd: true, t0: 500 }), { sec: 40, qa: 1, qok: 1, rd: false, t0: 900 }, NOW);
    expect(a).toMatchObject({ sec: 100, qa: 2, qok: 1, rd: true, t0: 500, done: false });
    const b = mergeEntry(entry('k1', 1, { qa: 1, qok: 0 }), { qa: 3, qok: 2 }, NOW);
    expect(b).toMatchObject({ qa: 3, qok: 2 });
  });

  it('fertig wird einmal gesetzt (mit Zeitpunkt) und nie zurückgenommen', () => {
    const e = mergeEntry(entry('k1', 1, { rd: true, qa: 3, qok: 3 }), { ap: true, mine: 'I stay in control. We run the tests.' }, NOW);
    expect(e).toMatchObject({ done: true, tD: NOW, ap: true });
    const again = mergeEntry(e, { rd: false, qa: 0, ap: false }, NOW + 5000);
    expect(again).toMatchObject({ done: true, tD: NOW, rd: true, ap: true, qa: 3 });
  });

  it('eigener Text wird gekürzt, Wendungen werden einmal behalten', () => {
    const e = mergeEntry(null, { id: 'k1-01', mine: 'x'.repeat(2000), ph: [{ w: 'a b', e: 'a b c' }] }, NOW);
    expect(e.mine).toHaveLength(700);
    const e2 = mergeEntry(e, { ph: [{ w: 'zzz', e: 'zzz' }] }, NOW);
    expect(e2.ph?.[0]?.w).toBe('a b');
  });
});

describe('lessonStatePlan', () => {
  it('legt das Dokument an (set), ergänzt Einträge (update) und schreibt nichts bei Unverändertem', () => {
    const first = lessonStatePlan(undefined, 'k1-01', { sec: 12, pos: 3 }, NOW);
    expect(first.outcome).toBe('created');
    expect(first.op && 'set' in first.op).toBe(true);
    const cur = { v: 1, items: [entry('k1', 1, { sec: 12, pos: 3 })] };
    expect(lessonStatePlan(cur, 'k1-01', { sec: 5 }, NOW)).toEqual({ op: null, outcome: 'unchanged' });
    const upd = lessonStatePlan(cur, 'k1-01', { sec: 50 }, NOW);
    expect(upd.outcome).toBe('updated');
    const add = lessonStatePlan(cur, 'k5-01', { sec: 1 }, NOW);
    expect(add.outcome).toBe('created');
    expect(add.op && 'update' in add.op && (add.op.update.items as unknown[]).length).toBe(2);
  });

  it('ein Dokument mit unerwartetem Aufbau wird nie angefasst; ungültiger Schlüssel; Obergrenze', () => {
    expect(lessonStatePlan({ v: 1, items: 'x' }, 'k1-01', { sec: 1 }, NOW)).toEqual({ op: null, outcome: 'invalid_doc' });
    expect(lessonStatePlan(undefined, 'k1-99', { sec: 1 }, NOW)).toEqual({ op: null, outcome: 'invalid_key' });
    const many = { v: 1, items: Array.from({ length: 200 }, (_, i) => ({ id: `x${i}` })) };
    expect(lessonStatePlan(many, 'k1-01', { sec: 1 }, NOW)).toEqual({ op: null, outcome: 'too_big' });
  });
});

describe('Aufwärmen: lokal gebaut aus früheren Lektionen', () => {
  const lesson = acceptLesson(seedLesson(1), { course: 'k1', n: 1 });
  const ph = lesson.ok ? keptPhrasesOf(lesson.lesson) : [];

  it('behält höchstens fünf Wendungen mit ihrem Satz', () => {
    expect(ph.length).toBeGreaterThanOrEqual(4);
    expect(ph.length).toBeLessThanOrEqual(5);
    for (const p of ph) expect(p.e.toLowerCase()).toContain(p.w.split(' ')[0]?.toLowerCase() ?? '?');
  });

  it('zwei Lücken aus der letzten fertigen Lektion; stabil bei jedem Aufruf; ohne frühere Lektion leer', () => {
    expect(buildWarmup([], 'k1', 2)).toEqual([]);
    const items = buildWarmup([done('k1', 1, { ph })], 'k1', 2);
    expect(items).toHaveLength(2);
    expect(items[0]?.gap).toContain('_____');
    expect(items[0]?.gap).not.toContain(items[0]?.answer ?? '?');
    expect(items[0]?.w).not.toBe(items[1]?.w);
    expect(buildWarmup([done('k1', 1, { ph })], 'k1', 2)).toEqual(items);
    // Fremder Kurs und spätere Lektionen zählen nicht.
    expect(buildWarmup([done('k5', 1, { ph })], 'k1', 2)).toEqual([]);
    expect(buildWarmup([done('k1', 3, { ph })], 'k1', 2)).toEqual([]);
  });

  it('nimmt aus zwei Lektionen je eine Wendung, wenn es zwei gibt', () => {
    const ph2 = [{ w: 'state the goal', de: 'das Ziel nennen', e: 'First, state the goal before you ask for anything.' }, { w: 'stay untouched', de: 'unangetastet bleiben', e: 'These files must stay untouched during the change.' }];
    const items = buildWarmup([done('k1', 1, { ph }), done('k1', 2, { ph: ph2 })], 'k1', 3);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.fromN).sort()).toEqual([1, 2]);
  });

  it('warmupRight: die Form aus dem Satz oder die Wendung (auch gebeugt) gilt', () => {
    const it0 = { w: 'run the tests', answer: 'run the tests' };
    expect(warmupRight(it0, 'Run the tests')).toBe(true);
    expect(warmupRight(it0, 'running the tests')).toBe(true);
    expect(warmupRight(it0, 'check the tests')).toBe(false);
    expect(warmupRight(it0, '  ')).toBe(false);
  });
});

describe('Laden und Schreiben über den echten Schreibpfad', () => {
  const reader = (docs: Record<string, Record<string, unknown>>) => {
    const asked: string[] = [];
    return {
      asked,
      read: (path: string) => {
        asked.push(path);
        return Promise.resolve(docs[path]);
      },
    };
  };

  it('loadCourseHome liest read/cp und je aktivem Kurs genau die aktuelle Lektion, nie mehr', async () => {
    const r = reader({ 'read/c-k1-02': seedLesson(2), 'read/cp': { v: 1, items: [done('k1', 1)] } });
    const h = await loadCourseHome(r.read);
    expect(r.asked.sort()).toEqual(['read/c-k1-02', 'read/c-k5-01', 'read/cp']);
    expect([...h.ready]).toEqual(['k1']);
    expect(h.next).toMatchObject({ course: 'k1', n: 2 });
    expect(h.progressInvalid).toBe(false);
  });

  it('fehlende, kaputte und nicht passende Lektionen sind „nicht bereit“ (ausgeblendet, nie gelöscht)', async () => {
    const broken = { ...seedLesson(1), phrases: [] };
    const wrongPlace = seedLesson(2); // liegt unter dem Namen von Lektion 1
    const h = await loadCourseHome(reader({ 'read/c-k1-01': broken, 'read/c-k5-01': wrongPlace }).read);
    expect(h.ready.size).toBe(0);
    expect(h.next).toBeNull();
    expect((await loadLesson(reader({}).read, 'k1', 1)).status).toBe('missing');
    expect((await loadLesson(reader({ 'read/c-k1-01': broken }).read, 'k1', 1)).status).toBe('hidden');
    const failing = await loadLesson(() => Promise.reject(new Error('offline')), 'k1', 1);
    expect(failing.status).toBe('failed');
  });

  it('ein Lesefehler bei read/cp bricht das Laden ab (nie raten); ein unbrauchbares cp wird gemeldet und nicht beschrieben', async () => {
    await expect(
      loadCourseHome(() => Promise.reject(new Error('offline'))),
    ).rejects.toThrow('offline');
    const h = await loadCourseHome(reader({ 'read/cp': { v: 1, items: 'x' } }).read);
    expect(h.progressInvalid).toBe(true);
    const mem = createMemoryDb({ seed: { 'read/cp': { v: 1, items: 'x' } } });
    expect(await saveLessonProgress(createWriter(mem.db), 'k1-01', { sec: 5 })).toBe('blocked');
    expect(mem.dump()['read/cp']).toEqual({ v: 1, items: 'x' });
  });

  it('saveLessonProgress: legt an, schreibt fort, merkt die fertige Lektion und schreibt Unverändertes nicht noch einmal', async () => {
    const mem = createMemoryDb({ seed: {} });
    const w = createWriter(mem.db);
    expect(await saveLessonProgress(w, 'k1-01', { sec: 30, pos: 4, t0: 100 }, NOW)).toBe('saved');
    expect(await saveLessonProgress(w, 'k1-01', { rd: true }, NOW)).toBe('saved');
    expect(await saveLessonProgress(w, 'k1-01', { qa: 3, qok: 2 }, NOW)).toBe('saved');
    expect(await saveLessonProgress(w, 'k1-01', { ap: true, mine: 'I stay in control. We run the tests.' }, NOW)).toBe('saved');
    expect(await saveLessonProgress(w, 'k1-01', { sec: 10 }, NOW)).toBe('unchanged');
    const cp = mem.dump()['read/cp'] as { items: LessonEntry[] };
    expect(cp.items).toHaveLength(1);
    expect(cp.items[0]).toMatchObject({ id: 'k1-01', course: 'k1', n: 1, sec: 30, rd: true, qa: 3, ap: true, done: true, tD: NOW });
    expect(mem.writes().every((x) => x.path === 'read/cp')).toBe(true);
    expect(mem.writes().some((x) => x.op === 'delete')).toBe(false);
  });
});
