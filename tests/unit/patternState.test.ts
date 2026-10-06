import { describe, expect, it } from 'vitest';
import { patPush, patsOf, patternState, readPatEntry, topicStateFromPatterns, type PatEntry } from '../../src/domain/metrics/pattern';
import { addDays } from '../../src/domain/date';

// Zustand eines Grammatik-Musters (Lernplattform 2.0 §4.9): Neu → Lernt → Sicher → Fest, Rückfall nach zwei Fehlern, „Sicher“ erst an 2 Tagen.

const D0 = '2026-09-01';
const t = (day: string): number => Date.parse(`${day}T10:00:00+02:00`);

/** Eine Antwortfolge nacheinander buchen: [Tag-Versatz, richtig, Hilfe]. */
function run(steps: Array<[number, boolean, boolean?]>, from?: PatEntry): PatEntry {
  let e = from;
  for (const [off, ok, help] of steps) {
    const day = addDays(D0, off);
    e = patPush(e, { ok, help: !!help, day, t: t(day) });
  }
  return e!;
}

describe('patternState', () => {
  it('Neu: kein Eintrag, keine Antwort', () => {
    expect(patternState(undefined, D0)).toBe('new');
    expect(patternState({ n: 0 }, D0)).toBe('new');
    expect(patternState(readPatEntry({}), D0)).toBe('new');
  });

  it('Lernt: erste Antworten, auch richtige', () => {
    expect(patternState(run([[0, true]]), D0)).toBe('learning');
    expect(patternState(run([[0, true], [0, true], [0, true]]), D0)).toBe('learning'); // alles an einem Tag
    expect(patternState(run([[0, false]]), D0)).toBe('learning');
  });

  it('Sicher erst an mindestens 2 Tagen und mit 2 von den letzten 3 richtig ohne Hilfe', () => {
    const oneDay = run([[0, true], [0, true], [0, true]]);
    expect(patternState(oneDay, addDays(D0, 5))).toBe('learning');
    const twoDays = run([[0, true], [1, true]]);
    expect(patternState(twoDays, addDays(D0, 1))).toBe('safe');
    expect(twoDays.s).toBe(addDays(D0, 1));
    // 2 von 3, aber an einem Tag
    expect(patternState(run([[0, true], [0, false], [0, true]]), D0)).toBe('learning');
    // mit Hilfe zählt nicht als richtig
    expect(patternState(run([[0, true, true], [1, true, true], [2, true, true]]), D0)).toBe('learning');
  });

  it('Fest: Sicher, mindestens 21 Tage seit dem ersten Sicher und das letzte Ergebnis richtig', () => {
    const safe = run([[0, true], [1, true]]);
    expect(patternState(safe, addDays(D0, 21))).toBe('safe'); // erster Sicher-Tag ist Tag 1 → erst ab Tag 22
    expect(patternState(safe, addDays(D0, 22))).toBe('firm');
    expect(patternState(safe, addDays(D0, 60))).toBe('firm');
    // ein Fehler allein: die letzten 3 sind falsch, richtig, richtig (noch Sicher), aber das letzte Ergebnis ist falsch → kein Fest
    const oneMiss = run([[30, false]], safe);
    expect(patternState(oneMiss, addDays(D0, 30))).toBe('safe');
  });

  it('zwei falsche in Folge setzen Sicher und Fest auf Lernt zurück; s bleibt stehen', () => {
    const firm = run([[0, true], [1, true]]);
    expect(patternState(firm, addDays(D0, 30))).toBe('firm');
    const back = run([[30, false], [30, false]], firm);
    expect(patternState(back, addDays(D0, 30))).toBe('learning');
    expect(back.s).toBe(addDays(D0, 1));
    // danach wieder richtig an zwei Tagen: Sicher, und weil s alt ist, bald wieder Fest
    const again = run([[31, true], [32, true], [33, true]], back);
    expect(patternState(again, addDays(D0, 33))).toBe('firm');
  });

  it('Übergangskette Neu → Lernt → Sicher → Fest in einem Lauf', () => {
    const states: string[] = [patternState(undefined, D0)];
    let e: PatEntry | undefined;
    for (const [off, ok] of [[0, true], [1, true], [2, true]] as const) {
      const day = addDays(D0, off);
      e = patPush(e, { ok, help: false, day, t: t(day) });
      states.push(patternState(e, day));
    }
    states.push(patternState(e, addDays(D0, 40)));
    expect(states).toEqual(['new', 'learning', 'safe', 'safe', 'firm']);
  });
});

describe('patPush und readPatEntry', () => {
  it('zählt n, c, h, schiebt die letzten 5 Bits und führt höchstens 2 Tage in dd', () => {
    const e = run([[0, true], [1, true], [2, false], [3, true, true], [4, true], [5, true]]);
    expect(e.n).toBe(6);
    expect(e.c).toBe(5);
    expect(e.h).toBe(1);
    expect(e.k).toBe(5);
    expect(e.r).toBe(0b10011); // neu → alt: richtig, richtig, mit Hilfe (0), falsch (0), richtig
    expect(e.dd).toEqual([addDays(D0, 4), addDays(D0, 5)]);
    expect(e.last).toBe(t(addDays(D0, 5)));
  });

  it('liest tolerant: Unbekanntes und Ungültiges fällt weg', () => {
    const e = readPatEntry({ n: 3, c: 'x', r: 999, k: 77, dd: ['2026-09-01', 'kaputt', '2026-09-02', '2026-09-03'], s: 'nope', i: '2026-09-01' })!;
    expect(e.c).toBe(0);
    expect(e.k).toBe(5);
    expect(e.r).toBeLessThan(32);
    expect(e.dd).toEqual(['2026-09-01', '2026-09-02']);
    expect(e.s).toBeUndefined();
    expect(e.i).toBe('2026-09-01');
    expect(readPatEntry(null)).toBeUndefined();
    expect(patsOf({ pats: [1] })).toEqual({});
  });
});

describe('topicStateFromPatterns', () => {
  const safe = run([[0, true], [1, true]]);
  const learning = run([[0, true]]);
  it('ohne pats: null (dann gilt allein die p-Regel)', () => {
    expect(topicStateFromPatterns('x', {}, D0)).toBeNull();
    expect(topicStateFromPatterns('x', undefined, D0)).toBeNull();
  });
  it('höchstens so weit wie das schwächste Muster; ein nie geübtes Muster hält das Thema bei Lernt', () => {
    expect(topicStateFromPatterns('x', { pats: { a: safe, b: safe } }, addDays(D0, 1))).toBe('safe');
    expect(topicStateFromPatterns('x', { pats: { a: safe, b: learning } }, addDays(D0, 1))).toBe('learning');
    expect(topicStateFromPatterns('x', { pats: { a: safe } }, addDays(D0, 1), ['a', 'b'])).toBe('learning');
    expect(topicStateFromPatterns('x', { pats: { a: safe, b: safe } }, addDays(D0, 40))).toBe('firm');
    expect(topicStateFromPatterns('x', { pats: { a: { n: 0 } } }, D0, ['a'])).toBe('new');
  });
});
