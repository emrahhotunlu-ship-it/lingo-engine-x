import { describe, expect, it } from 'vitest';
import { chapterById, chapterIndexOf, liveTopics, programChapters, programTopics, topicExists } from '../../src/domain/c1/chapters';
import { ProgramFileSchema } from '../../src/domain/c1/programTypes';
import { chapterState } from '../../src/domain/c1/state';
import { chapters, patternsOf } from '../../src/domain/grammar/patterns';
import { GRAMMAR_PATH } from '../../src/domain/grammar/path';
import { NEW_TOPICS } from '../../src/domain/c1x/checkContext';
import { chapterNodes } from '../../src/features/grammar/chapters';
import { readFileSync } from 'node:fs';

// Programm-Daten und Kapitelstand (P31): 7 Kapitel, 47 Themen, Reihenfolge = Lernpfad, Kapitelstand nur abgeleitet.

const TODAY = '2026-10-07';
const NOW = Date.parse('2026-10-07T09:00:00+02:00');
const DAY = 86_400_000;

/** Ein Thema mit allen Mustern als „Sicher“ (zwei richtige ohne Hilfe an zwei Tagen) oder nur eingeführt. */
function docFor(topic: string, how: 'safe' | 'intro'): Record<string, unknown> {
  const pats: Record<string, unknown> = {};
  for (const p of patternsOf(topic)?.patterns ?? []) {
    pats[p.id] = how === 'safe' ? { n: 3, c: 3, last: NOW - DAY, h: 0, r: 3, k: 2, dd: ['2026-10-05', '2026-10-06'], i: '2026-09-01', s: '2026-10-06' } : { n: 1, c: 0, last: NOW - DAY, h: 0, r: 0, k: 1, dd: [], i: '2026-10-06' };
  }
  return { n: 5, c: 4, S: 4, D: 5, last: NOW - DAY, pats };
}

describe('program.json', () => {
  const file = ProgramFileSchema.parse(JSON.parse(readFileSync('src/content/c1/program.json', 'utf8')));
  it('hat 7 Kapitel mit 47 Themen aus dem Konzept, jedes Thema genau einmal', () => {
    expect(file.chapters.map((c) => c.topics.length)).toEqual([7, 5, 4, 7, 4, 10, 10]);
    const all = file.chapters.flatMap((c) => c.topics);
    expect(all).toHaveLength(47);
    expect(new Set(all).size).toBe(47);
    expect(file.chapters.map((c) => c.pack.ch)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it('die acht neuen Themen (P36 und P37) und alle anderen gibt es, keine Platzhalter mehr', () => {
    const missing = programTopics().filter((t) => !topicExists(t));
    expect(missing).toEqual([]);
    expect(NEW_TOPICS.filter((t) => topicExists(t)).sort()).toEqual(['ellipsis', 'emph-plus', 'future-past', 'inversion', 'modals-prob', 'noun-phrase', 'quant-neg', 'stative-adv']);
    expect(programTopics().filter(topicExists)).toHaveLength(47);
  });
  it('Texte: „Abgeschlossen heißt“ DE und EN, Lehrer-Notiz englisch ohne Umlaute', () => {
    for (const c of file.chapters) {
      expect(c.done.de.length).toBeGreaterThan(80);
      expect(c.done.en.length).toBeGreaterThan(80);
      expect(c.note).toMatch(/^This month I'm working on /);
      expect(c.note).not.toMatch(/[äöüß]/);
    }
  });
  it('Lernpfad-Test: Kapitel von path.json = Kapitel des Programms (ohne Platzhalter) = GRAMMAR_PATH in derselben Reihenfolge', () => {
    const live = programChapters().map((c) => liveTopics(c));
    expect(chapters().map((c) => c.topics)).toEqual(live);
    expect(chapters().map((c) => c.id)).toEqual(programChapters().map((c) => c.id));
    expect(live.flat()).toEqual([...GRAMMAR_PATH]);
  });
  it('Zugriffe', () => {
    expect(chapterById('k5')?.n).toBe(5);
    expect(chapterById(3)?.id).toBe('k3');
    expect(chapterIndexOf('inversion')).toBe(6);
    expect(chapterIndexOf('gibt-es-nicht')).toBe(-1);
  });
});

describe('chapterState', () => {
  it('ohne Daten: Kapitel 1 aktuell, alle anderen offen, nichts geschafft, Zahlen 0 von m', () => {
    const r = chapterState({ docs: new Map(), today: TODAY });
    expect(r.chapters).toHaveLength(7);
    expect(r.current).toBe(0);
    expect(r.chapters.map((c) => c.status)).toEqual(['current', 'open', 'open', 'open', 'open', 'open', 'open']);
    expect(r.chapters.every((c) => c.patSafe === 0 && c.patTotal > 0 && c.ready)).toBe(true);
    expect(r.chapters[6]?.topics.filter((t) => !t.exists).map((t) => t.id)).toEqual([]);
    expect(r.chapters[4]?.topics.filter((t) => !t.exists).map((t) => t.id)).toEqual([]);
  });
  it('Kapitel mit lauter sicheren Mustern ist geschafft; das nächste mit eingeführten Themen ist aktuell', () => {
    const docs = new Map<string, Record<string, unknown>>();
    for (const t of liveTopics(programChapters()[0]!)) docs.set(t, docFor(t, 'safe'));
    docs.set('future-forms', docFor('future-forms', 'intro'));
    const r = chapterState({ docs, today: TODAY });
    expect(r.chapters[0]?.status).toBe('done');
    expect(r.chapters[0]?.allSafe).toBe(true);
    expect(r.chapters[0]?.allIntroduced).toBe(true);
    expect(r.current).toBe(1);
    expect(r.chapters[1]?.status).toBe('current');
    expect(r.chapters[1]?.introduced).toBe(1);
    expect(r.chapters[1]?.allIntroduced).toBe(false);
    expect(r.chapters[2]?.status).toBe('open');
  });
  it('Zahlen gleich dem Lernpfad (Invariante): Muster sicher je Kapitel', () => {
    const docs = new Map<string, Record<string, unknown>>();
    for (const t of liveTopics(programChapters()[1]!).slice(0, 2)) docs.set(t, docFor(t, 'safe'));
    docs.set('conditionals', docFor('conditionals', 'intro'));
    const prog = chapterState({ docs, today: TODAY });
    const path = chapterNodes({ docs, nowMs: NOW, today: TODAY, dueByTopic: new Map() });
    for (const [i, c] of prog.chapters.entries()) {
      for (const [k, t] of c.topics.filter((x) => x.exists).entries()) {
        const n = path.chapters[i]?.topics[k];
        expect(t.id).toBe(n?.id);
        expect(t.patSafe, t.id).toBe(n?.patSafe);
        expect(t.patTotal, t.id).toBe(n?.patTotal);
      }
    }
  });
  it('wird nie gespeichert: reine Funktion, zweimal gleiches Ergebnis, Eingabe unverändert', () => {
    const docs = new Map([['passive', docFor('passive', 'intro')]]);
    const before = JSON.stringify([...docs]);
    const a = chapterState({ docs, today: TODAY });
    const b = chapterState({ docs, today: TODAY });
    expect(a).toEqual(b);
    expect(JSON.stringify([...docs])).toBe(before);
  });
});
