import { describe, expect, it } from 'vitest';
import { normNewPerDay } from '../../src/domain/progress/settings';
import { lapseLoad, lowerNewPerDay, LAPSE_LOAD_MIN_CARDS } from '../../src/domain/srs/load';
import { normalizeNewPerDay } from '../../src/domain/srs/queue';
import { toTrainCard } from '../../src/domain/srs/cards';
import { isReadOffTopic } from '../../src/domain/srs/vocabList';
import type { TrainCard } from '../../src/domain/srs/types';
import { berlin } from './helpers';

// Auswertung 15.10.2026, Punkt 6: Kleinigkeiten.

const NOW = berlin('2026-10-15', 10);
const DAY = 86_400_000;

describe('neue Wörter pro Tag: Standard 5, nie Emrahs Einstellung überschreiben', () => {
  it('ohne gespeicherten Wert gilt 5 (für neue Nutzer und nach dem Zurücksetzen); gespeicherte Werte bleiben', () => {
    expect(normalizeNewPerDay(undefined)).toBe(5);
    expect(normalizeNewPerDay(null)).toBe(5);
    expect(normNewPerDay(undefined)).toBe(5);
    expect(normalizeNewPerDay(10)).toBe(10);
    expect(normNewPerDay(10)).toBe(10);
    expect(normalizeNewPerDay(2)).toBe(2);
  });
});

describe('Lapse-Quote: Vorschlag, kein stilles Überschreiben', () => {
  const card = (n: number, miss: boolean, x = 'cloze'): [string, Record<string, unknown>] => [`w${n}`, { hist: [{ t: NOW - 2 * DAY, g: miss ? 1 : 3, x }] }];
  const map = (rows: Array<[string, Record<string, unknown>]>) => new Map(rows);

  it('mindestens die Hälfte der geübten Karten mit Fehler und genug Karten → hoch', () => {
    const rows = Array.from({ length: 10 }, (_, i) => card(i, i < 5));
    const l = lapseLoad(map(rows), NOW);
    expect(l).toMatchObject({ practiced: 10, lapsed: 5, high: true });
    expect(l.share).toBeCloseTo(0.5);
  });

  it('weniger als die Hälfte oder zu wenige Karten → kein Hinweis', () => {
    expect(lapseLoad(map(Array.from({ length: 10 }, (_, i) => card(i, i < 4))), NOW).high).toBe(false);
    expect(lapseLoad(map(Array.from({ length: LAPSE_LOAD_MIN_CARDS - 1 }, (_, i) => card(i, true))), NOW).high).toBe(false);
    expect(lapseLoad(undefined, NOW)).toMatchObject({ practiced: 0, high: false });
  });

  it('nur die letzten 7 Tage; Partnerwort-Fehler, Aufdecken und ausgeblendete Karten zählen nicht', () => {
    const old: [string, Record<string, unknown>] = ['o', { hist: [{ t: NOW - 9 * DAY, g: 1, x: 'cloze' }] }];
    const hidden: [string, Record<string, unknown>] = ['h', { hidden: true, hist: [{ t: NOW - DAY, g: 1, x: 'cloze' }] }];
    const rows = [...Array.from({ length: 10 }, (_, i) => card(i, true, i % 2 ? 'colloc' : 'flip')), old, hidden];
    const l = lapseLoad(map(rows), NOW);
    expect(l.lapsed).toBe(0);
    expect(l.high).toBe(false);
  });

  it('der Vorschlag ist der nächstkleinere erlaubte Wert, nie 0', () => {
    expect(lowerNewPerDay(10)).toBe(5);
    expect(lowerNewPerDay(5)).toBe(2);
    expect(lowerNewPerDay(2)).toBeNull();
  });
});

describe('Wörter aus Lesetexten ohne Berufsbezug: nur ein Hinweis', () => {
  const c = (over: Record<string, unknown>): TrainCard =>
    toTrainCard('w', { word: 'strait', de: 'Meerenge', ex: 'The ship crossed the [strait] at night.', pos: 'noun', state: 'review', stage: 2, S: 3, D: 5, due: NOW, last: NOW - DAY, reps: 3, lapses: 0, ...over }, true, NOW) as TrainCard;

  it('src read ohne core wird markiert, mit core nicht; andere Quellen nie', () => {
    expect(isReadOffTopic(c({ src: 'read' }))).toBe(true);
    expect(isReadOffTopic(c({ src: 'read', core: true }))).toBe(false);
    expect(isReadOffTopic(c({ src: 'job' }))).toBe(false);
    expect(isReadOffTopic(c({ src: 'lookup' }))).toBe(false);
  });
  it('die Karte selbst bleibt unverändert (kein Ausblenden, keine andere Planung)', () => {
    const card = c({ src: 'read' });
    expect(card.hidden).toBe(false);
    expect(card.stage).toBe(2);
  });
});
