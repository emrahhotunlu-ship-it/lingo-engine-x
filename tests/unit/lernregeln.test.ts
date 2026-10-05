import { describe, expect, it } from 'vitest';
import { plannedCardSec } from '../../src/domain/srs/cost';
import { againPos, PASSED_AGAIN_GAP, pickMode } from '../../src/domain/srs/flip';
import { readFsrs, reviewFsrs } from '../../src/domain/srs/scheduler';
import { NOTE_WEIGHT, noteWeight } from '../../src/domain/srs/weight';
import { LEECH_AT, LEECH_MAX, capLeeches } from '../../src/domain/srs/queue';
import type { TrainCard } from '../../src/domain/srs/types';
import { CATCHUP_AT, catchUpOn } from '../../src/domain/unit/backlog';
import { THEME_CAP_FROM, themeFirst } from '../../src/domain/unit/block1';
import { berlin } from './helpers';

// Lernregeln aus dem Methodenplan der Lernwissenschaft (02.10.2026): Gewichtung der Note, Aufholmodus, billigere Wartung,
// Dauerfehler-Deckel, Wochenthema bei Rückstand, Abstand der Wiedervorlage.

const NOW = berlin('2026-10-05', 9);
const DAY_MS = 86_400_000;
const DAY = '2026-10-05';

describe('Gewichtung der Note', () => {
  it('Gewichte je Übungsart: Auswahl 0,55 · Stütze 0,8 · frei 1 · eigener Satz 1,1; Tipp macht freies Tippen zur Stütze', () => {
    expect(noteWeight('mc_en')).toBe(NOTE_WEIGHT.choice);
    expect(noteWeight('colloc')).toBe(NOTE_WEIGHT.choice);
    expect(noteWeight('spot')).toBe(NOTE_WEIGHT.choice);
    expect(noteWeight('tiles')).toBe(NOTE_WEIGHT.help);
    expect(noteWeight('cloze_hint')).toBe(NOTE_WEIGHT.help);
    expect(noteWeight('cloze')).toBe(NOTE_WEIGHT.free);
    expect(noteWeight('cloze', 1)).toBe(NOTE_WEIGHT.help);
    expect(noteWeight('produce')).toBe(NOTE_WEIGHT.produce);
    expect(noteWeight('flip')).toBe(1);
    expect(noteWeight('flip', 0, true)).toBe(NOTE_WEIGHT.catchUp);
  });

  const review = readFsrs({ state: 'review', S: 20, D: 5, due: NOW, last: NOW - 20 * DAY_MS, reps: 6, lapses: 0 }, NOW);

  it('gelungene Wiederholung: Stabilität wächst bei Auswahl weniger als bei freiem Tippen, bei eigenem Satz etwas mehr', () => {
    const full = reviewFsrs(review, 3, NOW, 1);
    const choice = reviewFsrs(review, 3, NOW, NOTE_WEIGHT.choice);
    const produce = reviewFsrs(review, 3, NOW, NOTE_WEIGHT.produce);
    expect(choice.stability).toBeGreaterThan(review.stability);
    expect(choice.stability).toBeLessThan(full.stability);
    expect(produce.stability).toBeGreaterThan(full.stability);
    expect(choice.due).toBeLessThan(full.due);
    expect(choice.due).toBeGreaterThan(NOW);
    // Zuwachs genau anteilig
    expect(choice.stability - review.stability).toBeCloseTo(NOTE_WEIGHT.choice * (full.stability - review.stability), 2);
  });

  it('Nochmal, Lernschritte und neue Karten bleiben unberührt', () => {
    expect(reviewFsrs(review, 1, NOW, 0.55)).toEqual(reviewFsrs(review, 1, NOW, 1));
    const fresh = readFsrs({ state: 'new', S: 0, D: 5, due: 0, last: 0, reps: 0, lapses: 0 }, NOW);
    expect(reviewFsrs(fresh, 3, NOW, 0.55)).toEqual(reviewFsrs(fresh, 3, NOW, 1));
  });

  it('Gewicht 1 liefert dasselbe wie vorher; Obergrenze 365 Tage bleibt', () => {
    const big = readFsrs({ state: 'review', S: 300, D: 3, due: NOW, last: NOW - 300 * DAY_MS, reps: 9, lapses: 0 }, NOW);
    expect(reviewFsrs(big, 4, NOW, 1)).toEqual(reviewFsrs(big, 4, NOW));
    expect((reviewFsrs(big, 4, NOW, 1.1).due - NOW) / DAY_MS).toBeLessThanOrEqual(365);
  });
});

describe('Aufholmodus', () => {
  const doc = (S: number, stage = 4) => ({ id: 'w1', state: 'review', stage, S, D: 5, reps: 5, hist: [{ t: NOW - 9 * DAY_MS, g: 3, x: 'cloze' }] });
  const base = { day: DAY, lang: 'de' as const, due: true, requested: 'auto' as const };
  it('ab 40 überfälligen Karten', () => {
    expect(catchUpOn(CATCHUP_AT - 1)).toBe(false);
    expect(catchUpOn(CATCHUP_AT)).toBe(true);
  });
  it('reife fällige Karten werden aufgedeckt, jede vierte bleibt getippt; ohne Aufholmodus immer getippt', () => {
    let flips = 0;
    let types = 0;
    for (let i = 0; i < 80; i++) {
      const m = pickMode({ ...base, card: { doc: doc(12), de: 'x', def: 'y' }, key: `vocab/w${i}`, catchUp: true });
      if (m === 'flip') flips++;
      else if (m === 'type') types++;
    }
    expect(flips + types).toBe(80);
    expect(types).toBeGreaterThan(10);
    expect(types).toBeLessThan(35);
    expect(pickMode({ ...base, card: { doc: doc(12), de: 'x', def: 'y' }, key: 'vocab/w1' })).toBe('type');
  });
  it('junge Karten (S < 7) und nicht fällige bleiben beim Tippen', () => {
    for (let i = 0; i < 20; i++) {
      expect(pickMode({ ...base, card: { doc: doc(3), de: 'x', def: 'y' }, key: `vocab/w${i}`, catchUp: true })).toBe('type');
      expect(pickMode({ ...base, due: false, card: { doc: doc(12), de: 'x', def: 'y' }, key: `vocab/w${i}`, catchUp: true })).toBe('type');
    }
  });
});

describe('billigere Wartung und Plan-Kosten', () => {
  const fsrs = (stability: number) => ({ stability }) as TrainCard['fsrs'];
  it('reife Stufe-5-Karte kostet weniger als eine junge; Aufholmodus noch weniger', () => {
    const young = plannedCardSec({ stage: 5, fsrs: fsrs(10) }, false);
    const mature = plannedCardSec({ stage: 5, fsrs: fsrs(40) }, false);
    const catchUp = plannedCardSec({ stage: 4, fsrs: fsrs(40) }, true);
    expect(mature).toBeLessThan(young);
    expect(catchUp).toBeLessThan(mature);
    expect(plannedCardSec({ stage: 2, fsrs: fsrs(40) }, true)).toBe(plannedCardSec({ stage: 2, fsrs: fsrs(40) }, false));
  });
});

describe('Dauerfehler, Wochenthema, Wiedervorlage', () => {
  it('höchstens drei Dauerfehler-Karten je Runde, Reihenfolge der übrigen bleibt', () => {
    const cards = Array.from({ length: 10 }, (_, i) => ({ key: `k${i}`, fsrs: { lapses: i % 2 === 0 ? LEECH_AT + 1 : 0 } }) as unknown as TrainCard);
    const out = capLeeches(cards);
    expect(out.filter((c) => c.fsrs.lapses >= LEECH_AT)).toHaveLength(LEECH_MAX);
    expect(out.map((c) => c.key)).toEqual(['k0', 'k1', 'k2', 'k3', 'k4', 'k5', 'k7', 'k9']);
  });

  it('Wochenthema zuerst; bei Rückstand höchstens ein Drittel der Plätze', () => {
    const mk = (n: number, theme: boolean) => Array.from({ length: n }, (_, i) => ({ id: `${theme ? 't' : 'o'}${i}`, theme }));
    const few = [...mk(5, false), ...mk(3, true)];
    expect(themeFirst(few, 6).slice(0, 3).every((c) => c.theme)).toBe(true);
    const many = [...mk(THEME_CAP_FROM, false), ...mk(10, true)];
    const out = themeFirst(many, 12);
    const firstSlots = out.slice(0, 12);
    expect(firstSlots.filter((c) => c.theme).length).toBeLessThanOrEqual(4);
    expect(out).toHaveLength(many.length);
  });

  it('Wiedervorlage nach „Gut“ im Lernschritt erst nach mindestens 8 Karten, nach „Nochmal“ wie bisher', () => {
    expect(againPos(0, 30, false, true)).toBe(PASSED_AGAIN_GAP);
    expect(againPos(0, 30, false, false)).toBe(4);
    expect(againPos(0, 30, true, false)).toBe(6);
    expect(againPos(0, 5, false, true)).toBe(5);
  });
});
