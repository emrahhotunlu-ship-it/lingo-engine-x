import { describe, expect, it } from 'vitest';
import { toTrainCard } from '../../src/domain/srs/cards';
import { buildExercise } from '../../src/domain/srs/exercise';
import { contextsOf, rotatedContext, ROTATE_FROM_STAGE } from '../../src/domain/srs/rotate';
import type { ExerciseId, TrainCard } from '../../src/domain/srs/types';
import { berlin } from './helpers';

// Kontext-Wechsel (Emrah 02.10.2026): ab Stufe 3 wechseln sich Ursprungssatz und gespeicherte Claude-Sätze (xEx) bei den
// Satzübungen ab, fest je Wiederholung (reps % n). Aufdecken/Erkennen, Prüfabfrage und Kontrolle bleiben beim Ursprungssatz.

const NOW = berlin('2026-10-02', 9);
type Doc = Record<string, unknown>;
const XEX = [
  { en: 'Good leverage helps in every negotiation.', t: 1 },
  { en: 'They leveraged their position to win the deal.', t: 1 },
  { en: 'This sentence has nothing to do with it.', t: 1 },
];
const doc = (over: Doc = {}): Doc => ({ id: 'leverage', word: 'leverage', pos: 'noun', de: 'Hebelwirkung', def: 'the power to influence a result', ex: 'We use [leverage] in every price talk.', col: [], level: 'C1', state: 'review', S: 10, D: 5, last: NOW - 10 * 86_400_000, due: NOW - 1000, reps: 0, lapses: 0, modes: {}, order: 900, src: 'ai', added: '2026-08-01', stage: 4, hist: [], intro: '2026-08-01', xEx: XEX, ...over });
const card = (over: Doc = {}): TrainCard => toTrainCard('leverage', doc(over), true, NOW) as TrainCard;
const pool = (c: TrainCard): TrainCard[] => [c, ...['a', 'b', 'c', 'd'].map((id) => toTrainCard(id, { ...doc(), id, word: `word${id}`, de: `Wort ${id}`, def: `meaning ${id}`, ex: `A [word${id}] matters.`, xEx: undefined }, true, NOW) as TrainCard)];

describe('Kontext-Wechsel', () => {
  it('Sätze: Ursprungssatz zuerst, danach nur gespeicherte Sätze, in denen das Wort (auch gebeugt) steht', () => {
    const c = card();
    const all = contextsOf(c);
    expect(all.map((x) => x.sentence)).toEqual(['We use leverage in every price talk.', XEX[0]!.en, XEX[1]!.en]);
    for (const x of all) expect(x.sentence.slice(x.start, x.end)).toBe(x.gap);
    expect(all[2]!.gap).toBe('leveraged');
  });

  it('ab Stufe 3 wechselt der Satz mit jeder Wiederholung reihum: reps 0, 1, 2, 3 …', () => {
    const seq = [0, 1, 2, 3, 4, 5].map((reps) => rotatedContext(card({ reps }), 'cloze')?.sentence);
    expect(seq).toEqual(['We use leverage in every price talk.', XEX[0]!.en, XEX[1]!.en, 'We use leverage in every price talk.', XEX[0]!.en, XEX[1]!.en]);
  });

  it('gleicher Stand → gleicher Satz (fest, kein Zufall)', () => {
    const c = card({ reps: 4 });
    expect(rotatedContext(c, 'cloze_hint')?.sentence).toBe(rotatedContext(c, 'cloze_hint')?.sentence);
  });

  it('unter Stufe 3, bei Erkennen/Zuordnen, ohne gespeicherte Sätze und bei Wendungen bleibt der Ursprungssatz', () => {
    expect(ROTATE_FROM_STAGE).toBe(3);
    for (const stage of [1, 2]) expect(rotatedContext(card({ stage, reps: 1 }), 'cloze')?.sentence).toBe('We use leverage in every price talk.');
    for (const ex of ['mc_en', 'spot', 'match', 'mc_de', 'type', 'colloc', 'produce', 'listen_mc', 'flip'] as ExerciseId[]) expect(rotatedContext(card({ reps: 1 }), ex)?.sentence, ex).toBe('We use leverage in every price talk.');
    expect(rotatedContext(card({ reps: 1, xEx: undefined }), 'cloze')?.sentence).toBe('We use leverage in every price talk.');
    const chunk = { ...card({ reps: 1 }), kind: 'chunk' } as TrainCard;
    expect(rotatedContext(chunk, 'cloze')).toBe(chunk.context);
  });

  it('die Übungen bauen mit dem gewechselten Satz: Lücke, Lösung und Sprachausgabe passen zusammen', () => {
    const c = card({ reps: 1 });
    for (const ex of ['cloze', 'cloze_hint', 'tiles', 'speed', 'dictation'] as ExerciseId[]) {
      const e = buildExercise(c, ex, 'de', pool(c), 'seed');
      expect(e.sentence?.sentence, ex).toBe(XEX[0]!.en);
      expect(e.accepted[0], ex).toBe('leverage');
      if (ex === 'dictation') expect(e.speak).toBe(XEX[0]!.en);
      if (ex === 'cloze_hint') expect(e.firstLetter).toBe('l');
    }
    const past = buildExercise(card({ reps: 2 }), 'cloze', 'de', pool(c), 'seed');
    expect(past.sentence?.sentence).toBe(XEX[1]!.en);
    expect(past.accepted).toEqual(['leveraged']);
  });

  it('Prüfabfrage und Kontrolle (origin) bleiben im Ursprungssatz', () => {
    const c = card({ reps: 1 });
    const e = buildExercise(c, 'cloze', 'de', pool(c), 'seed', { origin: true });
    expect(e.sentence?.sentence).toBe('We use leverage in every price talk.');
    expect(e.accepted).toEqual(['leverage']);
  });

  it('die Karte selbst bleibt unverändert (Schlüssel, Ursprungssatz)', () => {
    const c = card({ reps: 1 });
    const e = buildExercise(c, 'cloze', 'de', pool(c), 'seed');
    expect(e.card).toBe(c);
    expect(c.context?.sentence).toBe('We use leverage in every price talk.');
  });
});
