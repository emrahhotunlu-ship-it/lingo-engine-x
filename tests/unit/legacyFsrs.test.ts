import { describe, expect, it } from 'vitest';
import { fsrs, Rating, State } from 'ts-fsrs';
import { legacyToFsrs, toTsFsrsCard } from '../../src/domain/srs/legacyFsrs';
import { fsrsSchema } from '../../src/data/schemas';
import { berlin, loadSeed } from './helpers';

const DAY = 86_400_000;
const now = berlin('2026-09-20', 20);

describe('Umrechnung alter Lernstände in FSRS-Startwerte', () => {
  it('neue Karten bleiben neu', () => {
    const f = legacyToFsrs({ state: 'new', S: 0, D: 5, due: 0, last: 0, reps: 0, lapses: 0 }, now);
    expect(f.state).toBe(State.New);
    expect(f.stability).toBe(0);
    expect(f.due).toBe(now);
    expect(f.last).toBeNull();
  });

  it('übernimmt Stabilität in Tagen und Schwierigkeit 1–10 unverändert', () => {
    const last = now - 3 * DAY;
    const f = legacyToFsrs({ state: 'review', S: 12.5, D: 6.2, due: last + 12 * DAY, last, reps: 7, lapses: 1 }, now);
    expect(f).toMatchObject({ state: State.Review, stability: 12.5, difficulty: 6.2, reps: 7, lapses: 1, last, due: last + 12 * DAY, scheduledDays: 12 });
  });

  it('Lernkarte mit Fehlern wird zu Relearning, ohne Fehler zu Learning', () => {
    expect(legacyToFsrs({ state: 'learning', S: 0.8, D: 5, due: now, last: now - DAY, reps: 2, lapses: 1 }, now).state).toBe(State.Relearning);
    expect(legacyToFsrs({ state: 'learning', S: 0.8, D: 5, due: now, last: now - DAY, reps: 2, lapses: 0 }, now).state).toBe(State.Learning);
  });

  it('begrenzt unplausible Werte statt sie zu übernehmen', () => {
    const f = legacyToFsrs({ state: 'review', S: 0.01, D: 14, due: null, last: now - DAY, reps: 3, lapses: 0 }, now);
    expect(f.stability).toBe(0.1);
    expect(f.difficulty).toBe(10);
    expect(f.due).toBeGreaterThan(now - DAY);
  });

  it('jede Karte der Testdaten ergibt gültige Werte, mit denen ts-fsrs planen kann', () => {
    const seed = loadSeed();
    const scheduler = fsrs();
    const cards = Object.entries(seed).filter(([p]) => p.startsWith('vocab/') || p.startsWith('chunk/'));
    expect(cards.length).toBeGreaterThan(100);
    for (const [path, doc] of cards) {
      const f = legacyToFsrs(doc, now);
      expect(fsrsSchema.safeParse(f).success, path).toBe(true);
      const next = scheduler.next(toTsFsrsCard(f, now), new Date(now), Rating.Good);
      expect(next.card.due.getTime(), path).toBeGreaterThan(now);
      expect(Number.isFinite(next.card.stability), path).toBe(true);
    }
  });
});
