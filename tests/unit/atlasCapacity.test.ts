import { describe, expect, it } from 'vitest';
import { atlasGate, CARD_CAP, CARD_WARN } from '../../src/domain/atlas/capacity';
import { toTrainCard } from '../../src/domain/srs/cards';
import type { TrainCard } from '../../src/domain/srs/types';
import { berlin } from './helpers';

// Kapazitätswächter für „Als Karte“ im Atlas: Sperre ab 4.500 Karten, je Tag höchstens `capacityNew` Atlas-Karten.

const NOW = berlin('2026-10-05', 9);
const TODAY = '2026-10-05';
const mk = (id: string, added: string, atlas: boolean, inDb = true): TrainCard =>
  toTrainCard(id, { word: id, de: 'x', ex: `The [${id}] matters.`, state: 'new', src: 'pack', added, order: 900, ...(atlas ? { origin: { v: 1, kind: 'pack', ref: `atlas/${id}`, title: 'Atlas', t: NOW } } : {}) }, inDb, NOW) as TrainCard;

describe('atlasGate', () => {
  it('Grenzen: Warnung ab 3.500, Sperre ab 4.500', () => {
    expect(CARD_WARN).toBe(3500);
    expect(CARD_CAP).toBe(4500);
  });
  it('wenige Karten: erlaubt', () => {
    const cards = Array.from({ length: 50 }, (_, i) => mk(`w${i}`, '2026-09-01', false));
    expect(atlasGate({ cards, today: TODAY, nowMs: NOW })).toMatchObject({ state: 'ok', total: 50, addedToday: 0 });
  });
  it('ab 4.500 Karten gesperrt', () => {
    const cards = Array.from({ length: CARD_CAP }, (_, i) => mk(`w${i}`, '2026-09-01', false));
    expect(atlasGate({ cards, today: TODAY, nowMs: NOW }).state).toBe('full');
    expect(atlasGate({ cards: cards.slice(1), today: TODAY, nowMs: NOW }).state).toBe('ok');
  });
  it('Startvokabeln ohne Dokument zählen nicht mit', () => {
    const cards = Array.from({ length: CARD_CAP }, (_, i) => mk(`w${i}`, '2026-09-01', false, false));
    expect(atlasGate({ cards, today: TODAY, nowMs: NOW }).state).toBe('ok');
  });
  it('je Tag nur so viele Atlas-Karten, wie die Kapazitätsregel zulässt (2 bis 5), dann „heute genug“', () => {
    const base = Array.from({ length: 30 }, (_, i) => mk(`w${i}`, '2026-09-01', false));
    const g0 = atlasGate({ cards: base, today: TODAY, nowMs: NOW });
    expect(g0.limit).toBeGreaterThanOrEqual(2);
    expect(g0.limit).toBeLessThanOrEqual(5);
    const today = Array.from({ length: g0.limit }, (_, i) => mk(`a${i}`, TODAY, true));
    const g1 = atlasGate({ cards: [...base, ...today], today: TODAY, nowMs: NOW });
    expect(g1.state).toBe('enough');
    expect(g1.addedToday).toBe(g0.limit);
    // Gestern angelegte Atlas-Karten zählen heute nicht.
    const yesterday = Array.from({ length: g0.limit }, (_, i) => mk(`y${i}`, '2026-10-04', true));
    expect(atlasGate({ cards: [...base, ...yesterday], today: TODAY, nowMs: NOW }).state).toBe('ok');
  });
});
