import { describe, expect, it } from 'vitest';
import { dayKey } from '../../src/domain/date';
import { toTrainCard } from '../../src/domain/srs/cards';
import { toChunkCard } from '../../src/domain/srs/chunkCards';
import { introducedKindsToday, isLongChunk, longIntroducedToday, LONG_CHUNKS_PER_DAY, mixIntroducedToday, newCards } from '../../src/domain/srs/queue';
import type { TrainCard } from '../../src/domain/srs/types';
import { berlin } from './helpers';

// Neue Karten über 120 Tage mit 40 % Wendungen im Vorrat (WL, 19.10.2026): die Hälfte lang (drei Wörter oder mehr), 10 % ohne Satz, ein Teil aus Körben VOR dem C1-Paket (Mail).
// Geprüft wird die Auswahl neuer Karten wie die Runde sie nimmt (`newCards` mit dem Stand des Tages), nicht die Planung der Wiederholungen (dafür `backlogSim.test.ts`).

type Doc = Record<string, unknown>;
const DAY = 86_400_000;
const START = berlin('2026-10-19', 9);
const PER_DAY = 5;

const WORDS = 150;
const CHUNKS = 100;

function build(): Map<string, Doc> {
  const docs = new Map<string, Doc>();
  for (let i = 0; i < WORDS; i++) docs.set(`vocab/w${i}`, { id: `w${i}`, word: `word${i}`, pos: 'noun', de: `Wort${i}`, def: `meaning ${i}`, ex: `We often discuss the [word${i}] in meetings.`, state: 'new', S: 0, D: 5, last: 0, due: 0, reps: 0, lapses: 0, stage: 0, src: 'ai', added: '2026-09-01', order: 900 });
  for (let i = 0; i < CHUNKS; i++) {
    const long = i % 2 === 0;
    const en = long ? `take the lead on item${i}` : `keep item${i} moving`;
    const withSentence = i % 10 !== 9;
    docs.set(`chunk/c${i}`, {
      id: `c${i}`, en, de: `x${i}`, def: `to do ${i}`, kind: 'phrase', register: 'neutral',
      src: { kind: i % 4 < 2 ? 'mail' : 'pack', ...(withSentence ? { upgraded: `We will ${en} today.` } : {}) },
      state: 'new', S: 0, D: 5, due: 0, last: 0, reps: 0, lapses: 0, stage: 0, created: START - (CHUNKS - i) * DAY,
    });
  }
  return docs;
}

const cardsOf = (docs: Map<string, Doc>, now: number): TrainCard[] =>
  [...docs.entries()].flatMap(([k, d]) => {
    const c = k.startsWith('chunk/') ? toChunkCard(k.slice(6), d, now) : toTrainCard(k.slice(6), d, true, now);
    return c ? [c] : [];
  });

describe('Neue Karten über 120 Tage mit 40 % Wendungen', () => {
  const docs = build();
  const introDay = new Map<string, number>();
  const perDay: { words: number; chunks: number; longs: number; wordsStock: boolean }[] = [];
  for (let day = 0; day < 120; day++) {
    const now = START + day * DAY;
    const today = dayKey(now);
    const row = { words: 0, chunks: 0, longs: 0, wordsStock: false };
    for (let k = 0; k < PER_DAY; k++) {
      const cards = cardsOf(docs, now);
      row.wordsStock ||= cards.some((c) => c.isNew && c.kind === 'vocab');
      const next = newCards(cards, { introduced: mixIntroducedToday(cards, today), longToday: longIntroducedToday(cards, today), ...introducedKindsToday(cards, today) })[0];
      if (!next) break;
      const d = docs.get(next.key) as Doc;
      docs.set(next.key, { ...d, state: 'review', stage: 1, intro: today, last: now, due: now + 3 * DAY, reps: 1, S: 2 });
      introDay.set(next.key, day);
      if (next.kind === 'chunk') row.chunks++;
      else row.words++;
      if (isLongChunk(next)) row.longs++;
    }
    perDay.push(row);
  }

  it('an jedem Tag mindestens ein neues Einzelwort, solange Wörter vorrätig sind', () => {
    for (const [i, r] of perDay.entries()) if (r.wordsStock) expect(r.words, `Tag ${i + 1}`).toBeGreaterThanOrEqual(1);
  });

  it('höchstens zwei lange Wendungen je Tag', () => {
    for (const r of perDay) expect(r.longs).toBeLessThanOrEqual(LONG_CHUNKS_PER_DAY);
  });

  it('alle Wendungen mit Satz sind innerhalb von 120 Tagen eingeführt, keine ohne Satz', () => {
    for (let i = 0; i < CHUNKS; i++) {
      const has = i % 10 !== 9;
      expect(introDay.has(`chunk/c${i}`), `Wendung ${i}`).toBe(has);
    }
  });

  it('zurückgestellte Wendungen ohne Satz zählen nicht als neu im Vorrat der Runde', () => {
    const fresh = newCards(cardsOf(build(), START));
    expect(fresh.some((c) => c.kind === 'chunk' && !c.context)).toBe(false);
  });
});
