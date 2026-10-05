import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/domain/content';
import { addLocalDays, learningDayEnd } from '../../src/domain/date';
import { addError, capErrors, dueErrors, errorDue, reviewError, type ErrorEntry } from '../../src/domain/grammar/errors';
import { canIntroduce, GRAMMAR_PATH, introTopic, lernweg, nextNewTopic, pathTopics, stepDownTasks, topicState } from '../../src/domain/grammar/path';
import { seedTasks } from '../../src/domain/grammar/tasks';
import type { GrammarTask } from '../../src/domain/learn/types';
import { addRepairs, dueRepairs, reviewRepair, readRepairs } from '../../src/domain/repair/repair';
import { berlin } from './helpers';

// Grammatik-Pfad (Umbau W5, Gesamtkonzept 3.4): Reihenfolge, Zustände, Einführungsbremse, Lernweg,
// Rückstufung in der Runde und die Fehlerschleife (Fälligkeit zum Tagesende 04:00, Zeitumstellung).

const now = berlin('2026-09-27', 10);

describe('Pfad', () => {
  it('jedes Thema der App steht genau einmal im Pfad; alle Pfad-Einträge gibt es', () => {
    const ids = TOPICS.map((t) => t.id);
    const path = pathTopics();
    expect(path).toHaveLength(ids.length);
    expect(new Set(path).size).toBe(path.length);
    expect([...path].sort()).toEqual([...ids].sort());
    for (const id of GRAMMAR_PATH) expect(ids, id).toContain(id);
  });

  it('Lehrreihenfolge: B2-Kern vor den C1-Themen (Stichproben aus dem Lehrplan)', () => {
    const at = (id: string) => pathTopics().indexOf(id);
    expect(at('past-simple-perfect')).toBeLessThan(at('time-clauses'));
    expect(at('time-clauses')).toBeLessThan(at('c1-hedging'));
    expect(at('conditionals')).toBeLessThan(at('mixed-cond'));
    expect(at('comparison')).toBe(pathTopics().length - 1);
  });
});

describe('Zustand je Thema', () => {
  it('ohne Dokument oder ohne Antwort: Neu', () => {
    expect(topicState('passive', undefined, now)).toBe('new');
    expect(topicState('passive', { n: 0, p: 0.45 }, now)).toBe('new');
  });
  it('mit Antworten: Lernt → Sicher → Fest nach p', () => {
    const doc = (p: number) => ({ n: 12, p, last: now, recent: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] });
    expect(topicState('passive', { n: 2, p: 0.4, last: now }, now)).toBe('learning');
    expect(topicState('passive', doc(0.75), now)).toBe('safe');
    expect(topicState('passive', doc(0.95), now)).toBe('firm');
  });
  it('Verfall: ohne Übung sinkt ein sicheres Thema wieder', () => {
    const old = { n: 12, p: 0.95, last: now - 400 * 86_400_000, recent: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] };
    expect(topicState('passive', old, now)).not.toBe('firm');
  });
});

describe('Einführungsbremse', () => {
  const started = (day: string): Record<string, unknown> => ({ n: 3, p: 0.5, hist: [{ d: day, p: 0.5 }] });
  const docs = (day: string, errors = 0) => {
    const m = new Map<string, Record<string, unknown>>(pathTopics().map((id) => [id, started('2026-08-01')]));
    // Zwei Themen im Pfad bleiben neu; das letzte begonnene Thema hat den Starttag `day`.
    m.delete('compound-mod');
    m.delete('linkers');
    m.set('word-order', started(day));
    if (errors) m.set('articles', { ...started('2026-08-01'), errors: Array.from({ length: errors }, (_, i) => ({ q: `q${i}`, given: 'x', ans: 'y', t: now - 3 * 86_400_000 + i, due: now - 1000 })) });
    return m;
  };

  it('höchstens ein neues Thema je 3 Lerntage', () => {
    expect(canIntroduce(docs('2026-09-27'), '2026-09-27', now)).toEqual({ ok: false, reason: 'recent' });
    expect(canIntroduce(docs('2026-09-26'), '2026-09-27', now)).toEqual({ ok: false, reason: 'recent' });
    expect(canIntroduce(docs('2026-09-25'), '2026-09-27', now)).toEqual({ ok: false, reason: 'recent' });
    expect(canIntroduce(docs('2026-09-24'), '2026-09-27', now)).toEqual({ ok: true });
  });

  it('nie bei 10 oder mehr FÄLLIGEN Fehlersätzen; noch nicht fällige zählen nicht', () => {
    expect(canIntroduce(docs('2026-09-01', 9), '2026-09-27', now)).toEqual({ ok: true });
    expect(canIntroduce(docs('2026-09-01', 10), '2026-09-27', now)).toEqual({ ok: false, reason: 'errors' });
    expect(introTopic(docs('2026-09-01', 10), '2026-09-27', now)).toBeNull();
    // 13 offene, aber erst morgen fällig: keine Bremse.
    const later = docs('2026-09-01', 13);
    const arts = later.get('articles') as { errors: Array<Record<string, unknown>> };
    later.set('articles', { ...arts, errors: arts.errors.map((e) => ({ ...e, due: now + 86_400_000 })) });
    expect(canIntroduce(later, '2026-09-27', now)).toEqual({ ok: true });
  });

  it('60 Tage mit 1–2 neuen Fehlern am Tag: neue Themen werden weiter freigegeben', () => {
    const topics = pathTopics();
    const docsSim = new Map<string, Record<string, unknown>>();
    let introduced = 0;
    let lastFree = '';
    for (let d = 0; d < 60; d++) {
      const day = addLocalDays(berlin('2026-08-01', 10), d);
      const key = new Date(day).toISOString().slice(0, 10);
      // Einführung, wenn die Bremse es erlaubt.
      const next = introTopic(docsSim, key, day);
      if (next) {
        docsSim.set(next, { n: 3, p: 0.5, hist: [{ d: key, p: 0.5 }], errors: [] });
        introduced++;
        lastFree = key;
      }
      if (!docsSim.size) docsSim.set(topics[0]!, { n: 3, p: 0.5, hist: [{ d: key, p: 0.5 }], errors: [] });
      // Fällige Fehlersätze werden korrigiert (höchstens 5 je Tag, wie eine Fehlersatz-Runde), dann entstehen 1–2 neue.
      let budget = 5;
      for (const [id, doc] of docsSim) {
        let errs = (doc.errors as ErrorEntry[]) ?? [];
        for (const e of errs.filter((x) => x.done !== true && errorDue(x) < day + 3_600_000 * 8)) {
          if (budget-- <= 0) break;
          errs = reviewError(errs, e.t as number, { ok: true, given: '', grade: 3, t: day + budget }) ?? errs;
        }
        docsSim.set(id, { ...doc, errors: errs });
      }
      const ids = [...docsSim.keys()];
      for (let k = 0; k < 1 + (d % 2); k++) {
        const id = ids[(d + k) % ids.length]!;
        const doc = docsSim.get(id)!;
        const errs = addError((doc.errors as ErrorEntry[]) ?? [], { q: `Satz ${d}-${k} ___`, given: 'x', ans: 'y', t: day + 1000 * (k + 1), src: 'seed' });
        docsSim.set(id, { ...doc, errors: [...errs] });
      }
    }
    expect(introduced).toBeGreaterThanOrEqual(12);
    expect(lastFree >= '2026-09-15').toBe(true);
  });

  it('die Pfadreihenfolge bestimmt das nächste neue Thema', () => {
    expect(nextNewTopic(docs('2026-09-01'))).toBe('compound-mod');
    expect(introTopic(docs('2026-09-01'), '2026-09-27', now)).toBe('compound-mod');
    const all = new Map<string, Record<string, unknown>>();
    expect(nextNewTopic(all)).toBe(pathTopics()[0]);
  });

  it('der Marker kommt aus `hist` – kein neues Feld nötig', () => {
    const m = docs('2026-09-01');
    expect(Object.keys(m.get('word-order')!)).toEqual(['n', 'p', 'hist']);
  });
});

describe('Lernweg ①–⑤', () => {
  it('wird aus n, p und offenen Fehlersätzen abgeleitet', () => {
    expect(lernweg('passive', undefined, now).done).toEqual([false, false, false, false, false]);
    expect(lernweg('passive', undefined, now).current).toBe(0);
    expect(lernweg('passive', { n: 1, p: 0.3, last: now }, now).done).toEqual([true, false, false, false, false]);
    const full = lernweg('passive', { n: 10, p: 0.9, last: now, errors: [{ q: 'q', t: 1, done: true }] }, now);
    expect(full.done).toEqual([true, true, true, true, true]);
    const open = lernweg('passive', { n: 10, p: 0.9, last: now, errors: [{ q: 'q', t: 1 }] }, now);
    expect(open.done[4]).toBe(false);
    expect(open.current).toBe(4);
  });
});

describe('Rückstufung in der Runde', () => {
  const mk = (key: string, type: GrammarTask['type'], topic = 'passive'): GrammarTask => ({ key, topic, type, prompt: `p ${key}`, answer: 'a', accepted: [], options: type === 'mc' ? ['a', 'b'] : null, hint: null, expl: { de: null, en: null }, src: 'seed', ref: null, errorT: null });
  const cands = seedTasks();

  it('zwei Fehlschläge in Folge → die nächste Aufgabe des Themas ist eine Form leichter', () => {
    const tasks = [mk('x1', 'correct'), mk('x2', 'correct'), mk('x3', 'correct')];
    const out = stepDownTasks(tasks, 2, [{ topic: 'passive', ok: false }, { topic: 'passive', ok: false }], cands, new Set());
    expect(out[2]!.type).toBe('transform');
    expect(out[2]!.topic).toBe('passive');
    expect(out.slice(0, 2)).toEqual(tasks.slice(0, 2));
  });

  it('ein Fehlschlag oder ein Treffer dazwischen: keine Rückstufung', () => {
    const tasks = [mk('x1', 'correct'), mk('x2', 'correct'), mk('x3', 'correct')];
    expect(stepDownTasks(tasks, 2, [{ topic: 'passive', ok: false }], cands, new Set())).toEqual(tasks);
    expect(stepDownTasks(tasks, 2, [{ topic: 'passive', ok: false }, { topic: 'passive', ok: true }], cands, new Set())).toEqual(tasks);
  });

  it('Auswahl-Aufgaben und eigene Fehlersätze bleiben, wie sie sind', () => {
    const fails = [{ topic: 'passive', ok: false }, { topic: 'passive', ok: false }];
    expect(stepDownTasks([mk('x1', 'mc')], 0, fails, cands, new Set())[0]!.type).toBe('mc');
    const own = { ...mk('x2', 'correct'), errorT: 5 };
    expect(stepDownTasks([own], 0, fails, cands, new Set())[0]).toBe(own);
  });

  it('gesehene Aufgaben kommen nicht zurück; gibt es keine leichtere, bleibt alles', () => {
    const all = new Set(cands.map((c) => c.key));
    const tasks = [mk('x1', 'correct')];
    expect(stepDownTasks(tasks, 0, [{ topic: 'passive', ok: false }, { topic: 'passive', ok: false }], cands, all)).toEqual(tasks);
  });
});

describe('Fehlerschleife: genau einer, Deckel, Fälligkeit zum Tagesende', () => {
  const e = (i: number, done = false): ErrorEntry => ({ q: `Frage ${i}`, given: 'x', ans: 'y', t: now + i, ...(done ? { done: true } : {}) });

  it('derselbe Fehler wird nur einmal angelegt (auch mit anderem Leerraum und Großschreibung)', () => {
    const one = addError([], { q: 'I ___ (see) her.', given: '', ans: 'saw', t: now, src: 'seed' });
    expect(addError(one, { q: 'I  ___ (SEE) her.', given: 'seen', ans: 'saw', t: now + 5, src: 'seed' })).toBe(one);
    // War der erste schon erledigt, ist der Fehler wieder aufgetreten: ein neuer Eintrag.
    const done: ErrorEntry[] = [{ ...one[0]!, done: true }];
    expect(addError(done, { q: 'I ___ (see) her.', given: 'seen', ans: 'saw', t: now + 5, src: 'seed' })).toHaveLength(2);
  });

  it('Deckel 10: verdrängt nur Erledigte; sind alle offen, wird nichts Neues angelegt', () => {
    const open = Array.from({ length: 10 }, (_, i) => e(i));
    const out = addError(open, { q: 'Neu', given: 'x', ans: 'y', t: now + 99, src: 'seed' });
    expect(out).toBe(open);
    expect(out.map((x) => x.q)).toEqual(open.map((x) => x.q));
    const withDone = [e(0, true), ...Array.from({ length: 9 }, (_, i) => e(i + 1))];
    const next = addError(withDone, { q: 'Neu', given: 'x', ans: 'y', t: now + 99, src: 'seed' });
    expect(next).toHaveLength(10);
    expect(next.some((x) => x.q === 'Frage 0')).toBe(false);
    expect(next.at(-1)!.q).toBe('Neu');
    expect(capErrors(Array.from({ length: 12 }, (_, i) => e(i)))).toHaveLength(12);
  });

  it('fällig heißt: vor 04:00 Uhr des nächsten Lerntags – nicht auf die Millisekunde', () => {
    const t = berlin('2026-09-20', 15);
    const list: ErrorEntry[] = [{ q: 'I ___ (see) her yesterday.', given: 'seen', ans: 'saw', t, due: berlin('2026-09-21', 15) }];
    const docs = new Map([['past-simple-perfect', { errors: list }]]);
    // Am Anlegetag (auch kurz vor 04:00 des Folgetags, der noch zum Lerntag gehört) nicht fällig.
    expect(dueErrors(docs, berlin('2026-09-20', 16))).toHaveLength(0);
    expect(dueErrors(docs, berlin('2026-09-21', 3, 59))).toHaveLength(0);
    // Am nächsten Lerntag fällig, schon am Morgen – nicht erst ab 15 Uhr.
    expect(dueErrors(docs, berlin('2026-09-21', 4, 1))).toHaveLength(1);
    expect(dueErrors(docs, berlin('2026-09-21', 8))).toHaveLength(1);
  });

  it('Zeitumstellung 25.10.2026 (Tag mit 25 Stunden): nie am Anlegetag fällig, am Folgetag fällig', () => {
    // Lerntag 24.10.: 04:00 (Sommerzeit) bis 25.10. 04:00 (Winterzeit) = 25 Stunden.
    const created = Date.parse('2026-10-24T04:30:00+02:00');
    const end = learningDayEnd(created);
    expect(end).toBe(Date.parse('2026-10-25T04:00:00+01:00'));
    // „+ 24 Stunden“ läge bei 03:30 Winterzeit und damit noch am Anlegetag; als Kalendertag liegt es bei 04:30.
    expect(created + 86_400_000).toBeLessThan(end);
    expect(addLocalDays(created, 1)).toBe(Date.parse('2026-10-25T04:30:00+01:00'));
    const out = addError([], { q: 'I ___ (see) her yesterday.', given: 'seen', ans: 'saw', t: created, src: 'seed' });
    const docs = new Map([['past-simple-perfect', { errors: out }]]);
    expect(dueErrors(docs, created + 60_000)).toHaveLength(0);
    expect(dueErrors(docs, Date.parse('2026-10-25T03:50:00+01:00'))).toHaveLength(0);
    expect(dueErrors(docs, Date.parse('2026-10-25T04:10:00+01:00'))).toHaveLength(1);
    // Die Wiederholung (Box 1: drei Kalendertage) bleibt auf derselben Uhrzeit.
    const t2 = Date.parse('2026-10-25T09:00:00+01:00');
    const rev = reviewError(out, created, { ok: true, given: 'saw', grade: 3, t: t2 })!;
    expect(rev[0]!.due).toBe(Date.parse('2026-10-28T09:00:00+01:00'));
  });

  it('Reparatur-Sätze (app/repair): gleiche Regel, auch über die Zeitumstellung', () => {
    const created = Date.parse('2026-10-24T04:30:00+02:00');
    const list = addRepairs([], [{ wrong: 'I have seen him yesterday.', right: 'I saw him yesterday.', src: 'say' }], created)!;
    expect(dueRepairs(list, created + 60_000)).toHaveLength(0);
    expect(dueRepairs(list, Date.parse('2026-10-25T03:50:00+01:00'))).toHaveLength(0);
    expect(dueRepairs(list, Date.parse('2026-10-25T04:10:00+01:00'))).toHaveLength(1);
    // Morgens am Folgetag schon fällig, nicht erst zur Uhrzeit des Anlegens.
    const l2 = addRepairs([], [{ wrong: 'He go home.', right: 'He goes home.', src: 'say' }], berlin('2026-09-20', 15))!;
    expect(dueRepairs(l2, berlin('2026-09-21', 8))).toHaveLength(1);
    expect(dueRepairs(l2, berlin('2026-09-20', 23))).toHaveLength(0);
    const r = reviewRepair(l2, l2[0]!.id, true, berlin('2026-09-21', 8))!;
    expect(readRepairs({ items: r })[0]!.due).toBe(berlin('2026-09-24', 8));
  });
});
