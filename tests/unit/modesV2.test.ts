import { describe, expect, it } from 'vitest';
import { packDoc, packEntry } from '../../src/domain/c1pack/pack';
import { buildExercise } from '../../src/domain/srs/exercise';
import { toTrainCard } from '../../src/domain/srs/cards';
import { toChunkCard } from '../../src/domain/srs/chunkCards';
import { availableExercises, canListen, CATALOG, makeEnv, supports } from '../../src/domain/srs/modes';
import { familyFrom, partnerOf, trapTask } from '../../src/domain/srs/partner';
import type { ExerciseId, Stage, TrainCard } from '../../src/domain/srs/types';
import { berlin } from './helpers';

// Lernplattform 2.0 §4.8: neue Abfragearten und die Umgebung (Eingabeprofil × Sprachausgabe × KI).

const NOW = berlin('2026-10-05', 9);
const DAY = '2026-10-05';

function packCard(id: string, stage: Stage = 3): TrainCard {
  const e = packEntry(id);
  if (!e) throw new Error(id);
  const made = packDoc(e, DAY, NOW);
  if (!made) throw new Error(`packDoc ${id}`);
  const c = made.kind === 'chunk' ? toChunkCard(made.id, { ...made.doc, state: 'review', S: 5, D: 5, reps: 3, last: NOW - 1000, due: NOW }, NOW) : toTrainCard(made.id, { ...made.doc, state: 'review', S: 5, D: 5, reps: 3, last: NOW - 1000, due: NOW }, true, NOW);
  if (!c) throw new Error(`Karte ${id}`);
  return { ...c, stage };
}
const plain = (over: Record<string, unknown> = {}, stage: Stage = 3, id = 'reliable'): TrainCard => {
  const c = toTrainCard(id, { word: 'reliable', de: 'zuverlässig', def: 'can be trusted', pos: 'adj', state: 'review', S: 5, D: 5, reps: 3, last: 1, due: 2, ex: 'Our supplier is very [reliable].', ...over }, true, NOW);
  if (!c) throw new Error('Karte');
  return { ...c, stage };
};

const ENVS = [false, true].flatMap((touch) => [false, true].flatMap((tts) => [false, true].map((ai) => ({ touch, tts, ai, env: makeEnv(tts, ai, touch) }))));

describe('Stufenregel: jede Stufe hat für jedes Profil mindestens zwei Arten (Kap. 15)', () => {
  const cards: Array<[string, (s: Stage) => TrainCard]> = [
    ['Wort mit Paketdaten', (s) => packCard('family-01', s)],
    ['Wendung mit Paketdaten', (s) => packCard('colloc-01', s)],
    ['schlichte Karte', (s) => plain({}, s)],
  ];
  for (const [name, make] of cards) {
    it(name, () => {
      for (const stage of [1, 2, 3, 4, 5] as Stage[]) {
        for (const lang of ['de', 'en'] as const) {
          for (const e of ENVS) {
            const n = availableExercises(make(stage), lang, 100, e.env).length;
            expect(n, `${name} Stufe ${stage} ${lang} touch=${e.touch} tts=${e.tts} ai=${e.ai}`).toBeGreaterThanOrEqual(2);
          }
        }
      }
    });
  }
});

describe('Eingabeprofil touch: nie eigener Satz, nie Hören', () => {
  it('produce, listen_mc und dictation fehlen am Handy in jeder Stufe', () => {
    for (const stage of [1, 2, 3, 4, 5] as Stage[]) {
      for (const c of [packCard('family-01', stage), packCard('colloc-01', stage), plain({}, stage)]) {
        const got = availableExercises(c, 'de', 100, makeEnv(true, true, true));
        for (const x of ['produce', 'listen_mc', 'dictation'] as ExerciseId[]) expect(got, `${c.word} ${stage}`).not.toContain(x);
      }
    }
  });
  it('mit Tastatur, Sprachausgabe und KI sind sie wieder da', () => {
    const env = makeEnv(true, true, false);
    expect(canListen(env)).toBe(true);
    expect(supports(plain({}, 5), 'dictation', 'de', 100, env)).toBe(true);
    expect(supports(plain({}, 5), 'produce', 'de', 100, env)).toBe(true);
    expect(supports(plain({}, 1), 'listen_mc', 'de', 100, env)).toBe(true);
  });
  it('Katalog: jede Stufe hat mindestens zwei eigene Arten, alle neuen Arten stehen darin', () => {
    for (const s of [1, 2, 3, 4, 5]) expect(CATALOG.filter((d) => d.stage === s).length).toBeGreaterThanOrEqual(2);
    for (const x of ['ctx_mc', 'colloc_gap', 'complete', 'wordfam', 'find_trap'] as ExerciseId[]) expect(CATALOG.some((d) => d.ex === x), x).toBe(true);
  });
});

describe('„type“ nur ohne Satz', () => {
  it('mit Ursprungssatz übt die Lücke, ohne Satz das Schreiben', () => {
    expect(supports(plain({}, 4), 'type', 'de', 100)).toBe(false);
    const noCtx = plain({ ex: 'No match here.' }, 4);
    expect(noCtx.context).toBeNull();
    expect(supports(noCtx, 'type', 'de', 100)).toBe(true);
  });
});

describe('Partnerwort-Lücke: nur am Partnerwort', () => {
  it('Wendung aus dem Paket: die Lücke steht am Partnerwort, die falsche Wahl aus dem Paket ist eine Option', () => {
    const c = packCard('colloc-01', 3);
    const p = partnerOf(c);
    expect(p?.gap).toBe('address');
    expect(p?.ctx?.sentence.slice(p.ctx.start, p.ctx.end)).toBe('address');
    expect(p?.opts).toEqual(['solve', 'fix']);
    const e = buildExercise(c, 'colloc_gap', 'de', [c], 's');
    expect(e.input).toBe('choice');
    expect(e.accepted).toEqual(['address']);
    expect(e.options.map((o) => o.label).sort()).toEqual(['address', 'fix', 'solve']);
    expect(e.sentence?.gap).toBe('address');
    const typed = buildExercise(c, 'colloc', 'de', [c], 's');
    expect(typed.input).toBe('typed');
    expect(typed.accepted).toEqual(['address']);
  });
  it('eine Karte ohne Partnerdaten hat keine Wortpartner-Übung', () => {
    const c = plain({}, 3);
    expect(supports(c, 'colloc_gap', 'de', 100)).toBe(false);
    expect(supports(c, 'colloc', 'de', 100)).toBe(false);
  });
});

describe('„Satz vervollständigen“, Wortfamilie, Falle finden', () => {
  it('complete: mit Satzanfang aus dem Paket schon früh; ohne erst auf Stufe 5', () => {
    const c = packCard('word-01', 3);
    expect(supports(c, 'complete', 'de', 100)).toBe(true);
    const e = buildExercise(c, 'complete', 'de', [c], 's');
    expect(e.input).toBe('sentence');
    expect(e.start && ['Every pricing decision involves a difficult', 'Faster delivery at lower cost always forces a'].includes(e.start)).toBe(true);
    expect(supports(plain({}, 3), 'complete', 'de', 100)).toBe(false);
    expect(supports(plain({}, 5), 'complete', 'de', 100)).toBe(true);
  });
  it('wordfam: das Familienmitglied steht im Chip, das Kartenwort ist die Lösung', () => {
    const c = packCard('family-01', 4);
    expect(familyFrom(c)).toEqual({ pos: 'adj', word: 'compliant' });
    const e = buildExercise(c, 'wordfam', 'de', [c], 's');
    expect(e.famFrom?.word).toBe('compliant');
    expect(e.accepted[0]?.toLowerCase()).toBe('compliance');
  });
  it('find_trap: der Übungssatz der Falle, die falsche Stelle ist das Kartenwort', () => {
    const c = plain({ word: 'actual', de: 'tatsächlich', def: 'real', pos: 'adj', ex: 'The [actual] figures are lower.' }, 4);
    const t = trapTask(c);
    expect(t?.id).toBe('f01');
    const e = buildExercise(c, 'find_trap', 'de', [c], 's');
    expect(e.input).toBe('spot');
    expect(e.sentence?.sentence.slice(e.sentence.start, e.sentence.end)).toBe('actual');
    expect(supports(plain({}, 4), 'find_trap', 'de', 100)).toBe(false);
  });
  it('ctx_mc: drei Optionen, Satz nötig', () => {
    const c = plain({}, 1);
    const others: Array<[string, string, string]> = [['invoice', 'Rechnung', 'a bill for goods'], ['delivery', 'Lieferung', 'bringing goods somewhere'], ['contract', 'Vertrag', 'a written agreement'], ['budget', 'Haushaltsplan', 'a plan of money']];
    const pool = [c, ...others.map(([w, de, def]) => plain({ word: w, de, def, pos: 'adj', ex: `We need the [${w}] today.` }, 1, w))];
    const e = buildExercise(c, 'ctx_mc', 'de', pool, 's');
    expect(e.options).toHaveLength(3);
    expect(e.options.filter((o) => o.correct)).toHaveLength(1);
    expect(supports(plain({ ex: 'No match here.' }, 1), 'ctx_mc', 'de', 100)).toBe(false);
  });
});
