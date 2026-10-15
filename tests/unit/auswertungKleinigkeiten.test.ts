import { describe, expect, it } from 'vitest';
import { normNewPerDay } from '../../src/domain/progress/settings';
import { lapseLoad, lowerNewPerDay, LAPSE_LOAD_MIN_CARDS, LAPSE_LOAD_MIN_REVIEWS } from '../../src/domain/srs/load';
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
  // Eine Wiederholung ist eine Antwort auf eine Karte, die an einem früheren Tag schon richtig war (Prüfung M4).
  const card = (n: number, miss: boolean, x = 'cloze', extra: Record<string, unknown> = {}): [string, Record<string, unknown>] => [`w${n}`, { hist: [{ t: NOW - 5 * DAY, g: 3, x: 'cloze' }, { t: NOW - 2 * DAY, g: miss ? 1 : 3, x, ...extra }] }];
  const map = (rows: Array<[string, Record<string, unknown>]>) => new Map(rows);
  const many = (n: number, missing: number, x = 'cloze', extra: Record<string, unknown> = {}) => Array.from({ length: n }, (_, i) => card(i, i < missing, x, extra));

  it('ab 25 % Rückfälle unter den Wiederholungen (mit genug Karten und Wiederholungen) → hoch', () => {
    const l = lapseLoad(map(many(16, 4)), NOW);
    expect(l).toMatchObject({ practiced: 16, reviews: 16, lapsed: 4, high: true });
    expect(l.share).toBeCloseTo(0.25);
  });

  it('weniger als 25 % oder zu wenige Karten oder Wiederholungen → kein Hinweis', () => {
    expect(lapseLoad(map(many(16, 3)), NOW).high).toBe(false);
    expect(lapseLoad(map(many(LAPSE_LOAD_MIN_CARDS - 1, LAPSE_LOAD_MIN_CARDS - 1)), NOW).high).toBe(false);
    expect(lapseLoad(map(many(LAPSE_LOAD_MIN_REVIEWS - 1, LAPSE_LOAD_MIN_REVIEWS - 1)), NOW).high).toBe(false);
    expect(lapseLoad(undefined, NOW)).toMatchObject({ practiced: 0, high: false });
  });

  it('Fehler am Einführungstag, bei der ersten Begegnung und am selben Tag wie die erste richtige Antwort sind keine Rückfälle', () => {
    const firstTime = Array.from({ length: 16 }, (_, i): [string, Record<string, unknown>] => [`n${i}`, { hist: [{ t: NOW - 2 * DAY, g: 1, x: 'cloze' }] }]);
    expect(lapseLoad(map(firstTime), NOW)).toMatchObject({ practiced: 16, reviews: 0, lapsed: 0, high: false });
    const sameDay = Array.from({ length: 16 }, (_, i): [string, Record<string, unknown>] => [`s${i}`, { hist: [{ t: NOW - 2 * DAY, g: 3, x: 'cloze' }, { t: NOW - 2 * DAY + 60_000, g: 1, x: 'cloze' }] }]);
    expect(lapseLoad(map(sameDay), NOW)).toMatchObject({ reviews: 0, lapsed: 0, high: false });
  });

  it('Aufdecken „Nochmal“ (flip) ist echtes Vergessen und zählt; Partnerwort-Fehler (colloc mit ci) nicht, die Pack-Lücke ohne ci schon', () => {
    expect(lapseLoad(map(many(16, 16, 'flip')), NOW)).toMatchObject({ lapsed: 16, high: true });
    expect(lapseLoad(map(many(16, 16, 'colloc', { ci: 0 })), NOW)).toMatchObject({ reviews: 0, lapsed: 0, high: false });
    expect(lapseLoad(map(many(16, 16, 'colloc')), NOW)).toMatchObject({ lapsed: 16, high: true });
  });

  it('nur die letzten 7 Tage; ausgeblendete Karten zählen nicht', () => {
    const old: [string, Record<string, unknown>] = ['o', { hist: [{ t: NOW - 20 * DAY, g: 3, x: 'cloze' }, { t: NOW - 9 * DAY, g: 1, x: 'cloze' }] }];
    const hidden: [string, Record<string, unknown>] = ['h', { hidden: true, hist: [{ t: NOW - 5 * DAY, g: 3, x: 'cloze' }, { t: NOW - DAY, g: 1, x: 'cloze' }] }];
    const l = lapseLoad(map([old, hidden, ...many(10, 0)]), NOW);
    expect(l.lapsed).toBe(0);
    expect(l.practiced).toBe(10);
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
