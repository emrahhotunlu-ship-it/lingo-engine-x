import { describe, expect, it } from 'vitest';
import { validateDoc } from '../../src/data/validate';
import {
  addRun,
  COMPARE_MAX,
  COMPARE_TEXT_MAX,
  compareOffer,
  compareWritable,
  inLastWeek,
  measure,
  readCompare,
  withVerdict,
  type CompareRun,
} from '../../src/domain/compare/compare';
import { compare } from '../../src/prompts/compare';

// Backlog B1: monatliche Vergleichsaufgabe – Einplanung in der letzten Monatswoche, Vergleichsfassung
// von vor etwa 4 Wochen, lokale Messwerte, Grenzen des Dokuments `app/compare`, Vorlage compare@1.

const side = (text: string, sec?: number) => ({ text, m: measure(text, [], sec), ...(sec !== undefined ? { sec } : {}) });
const run = (day: string, task = 'ct1'): CompareRun => ({ month: day.slice(0, 7), day, t: Date.parse(`${day}T12:00:00Z`), task, speak: side('I work on a project.', 45), write: side('Dear Anna, the delivery is late.') });

describe('Einplanung (compareOffer)', () => {
  it('letzte Monatswoche: die letzten 7 Tage des Monats, auch im Februar und Dezember', () => {
    expect(inLastWeek('2026-09-23')).toBe(false);
    expect(inLastWeek('2026-09-24')).toBe(true);
    expect(inLastWeek('2026-09-30')).toBe(true);
    expect(inLastWeek('2027-02-21')).toBe(false);
    expect(inLastWeek('2027-02-22')).toBe(true);
    expect(inLastWeek('2026-12-25')).toBe(true);
    expect(inLastWeek('2026-10-01')).toBe(false);
  });

  it('ohne früheren Lauf: fällig in der letzten Woche, Ausgangsfassung mit der ersten Aufgabe', () => {
    expect(compareOffer('2026-09-20', [])).toMatchObject({ due: false, base: null, task: 'ct1' });
    expect(compareOffer('2026-09-26', [])).toMatchObject({ due: true, base: null, task: 'ct1' });
  });

  it('Vergleichsfassung: jüngster früherer Lauf mit ≥ 21 Tagen Abstand, seine Aufgabe kommt wieder; im selben Monat erledigt → nicht fällig', () => {
    const runs = [run('2026-07-28', 'ct2'), run('2026-08-27', 'ct2')];
    const o = compareOffer('2026-09-26', runs);
    expect(o.due).toBe(true);
    expect(o.base?.month).toBe('2026-08');
    expect(o.task).toBe('ct2');
    const done = compareOffer('2026-09-29', [...runs, run('2026-09-26', 'ct2')]);
    expect(done.due).toBe(false);
    expect(done.done?.day).toBe('2026-09-26');
    // Ein Lauf vom 31.08. ist am 01.10. zu nah; dann gilt der davor.
    const near = compareOffer('2026-09-24', [run('2026-08-01'), run('2026-09-05')].filter((r) => r.month < '2026-09'));
    expect(near.base?.day).toBe('2026-08-01');
  });
});

describe('Messwerte (measure)', () => {
  it('Wörter pro Minute über den 45-s-Durchgang, Fallen je 100 Wörter, frei benutzte eigene Wendungen', () => {
    const text = 'I would like to push back the deadline. We make a meeting tomorrow and I explain the problem since two weeks.';
    const m = measure(text, ['push back the deadline', 'touch base', 'deadline'], 30);
    expect(m.words).toBe(21);
    expect(m.wpm).toBe(42);
    expect(m.phrases).toEqual(['push back the deadline']);
    expect(m.traps).toBeGreaterThanOrEqual(1);
    expect(m.per100).toBe(Math.round((m.traps / m.words) * 1000) / 10);
    // Länger als 45 s zählt nur 45 s; ohne Sekunden kein wpm (Schreiben).
    expect(measure('one two three', [], 90).wpm).toBe(4);
    expect(measure('one two three', []).wpm).toBeUndefined();
  });
});

describe('app/compare (Grenzen, tolerant lesen)', () => {
  it('derselbe Monat wird ersetzt, höchstens 12 Läufe, Texte gekürzt', () => {
    let runs: CompareRun[] = [];
    for (let i = 0; i < 15; i++) runs = addRun(runs, run(`20${26 + Math.floor((i + 8) / 12)}-${String(((i + 8) % 12) + 1).padStart(2, '0')}-27`));
    expect(runs).toHaveLength(COMPARE_MAX);
    const long = addRun(runs, { ...run('2027-12-27'), write: side('x '.repeat(2_000)) });
    expect(long.at(-1)?.write.text.length).toBeLessThanOrEqual(COMPARE_TEXT_MAX);
    const again = addRun(long, run('2027-12-28'));
    expect(again.filter((r) => r.month === '2027-12')).toHaveLength(1);
    const doc = { v: 1, items: again };
    expect(new TextEncoder().encode(JSON.stringify(doc)).length).toBeLessThan(120 * 1024);
    expect(validateDoc('app/compare', doc).ok).toBe(true);
  });

  it('Urteil anhängen (gekürzt); unerwarteter Aufbau wird nie überschrieben', () => {
    const runs = [run('2026-08-27')];
    const v = withVerdict(runs, '2026-08', { summary: 'Gut.', better: ['a', 'b', 'c', 'd'], next: 'n', level: 'B2', lang: 'de', pv: 'compare@1' });
    expect(v?.[0]?.verdict?.better).toHaveLength(3);
    expect(withVerdict(runs, '2026-01', { summary: 's', better: [], next: '', level: '', lang: 'de', pv: '' })).toBeNull();
    expect(readCompare({ items: [...runs, { month: 'kaputt' }] })).toHaveLength(1);
    expect(compareWritable({ items: [...runs, { month: 'kaputt' }] })).toBe(false);
    expect(compareWritable({ items: 'x' })).toBe(false);
    expect(compareWritable(null)).toBe(true);
  });
});

describe('Vorlage compare@1', () => {
  const vars = {
    uiLang: 'de' as const,
    speakTask: 'Talk about a project.',
    writeTask: 'Write an email.',
    before: { speak: 'I work on project.', write: 'Dear Anna', speakM: measure('I work on project.', [], 45), writeM: measure('Dear Anna', []), month: '2026-08' },
    now: { speak: 'I am working on a project.', write: 'Dear Anna, thanks', speakM: measure('I am working on a project.', [], 45), writeM: measure('Dear Anna, thanks', []), month: '2026-09' },
  };

  it('Kopfzeile, beide Fassungen mit Messwerten, Sprache der Antwort', () => {
    const p = compare.build(vars);
    expect(p.split('\n')[0]).toBe('[compare@1]');
    expect(p).toContain('BEFORE (2026-08):');
    expect(p).toContain('NOW (2026-09):');
    expect(p).toContain('words/min');
    expect(p).toContain('Write all fields in German');
  });

  it('Schema: höchstens 3 Fortschritte (gekürzt), Sprachtreue', () => {
    const s = compare.schema(vars);
    const ok = s.safeParse({
      summary: 'Du sprichst jetzt flüssiger und deine Mail ist klarer aufgebaut als im August.',
      better: ['eins', 'zwei', 'drei', 'vier'],
      next: 'Verbinde deine Gedanken mit Überleitungen.',
      level: 'Beide Fassungen liegen bei B2.',
    });
    expect(ok.success).toBe(true);
    expect(ok.success && ok.data.better).toHaveLength(3);
    const wrong = s.safeParse({ summary: 'You speak much more fluently now and your email is clearer than before.', better: [], next: 'Use more linking words when you speak.', level: 'Both versions are B2.' });
    expect(wrong.success).toBe(false);
  });
});
