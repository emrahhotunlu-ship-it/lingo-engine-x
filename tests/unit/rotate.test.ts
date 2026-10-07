import { describe, expect, it, vi } from 'vitest';
import { toTrainCard } from '../../src/domain/srs/cards';
import { toChunkCard } from '../../src/domain/srs/chunkCards';
import { buildExercise } from '../../src/domain/srs/exercise';
import { contextsOf, rotatedContext, ROTATE_FROM_STAGE } from '../../src/domain/srs/rotate';
import type { ExerciseId, TrainCard } from '../../src/domain/srs/types';
import { sentKey } from '../../src/domain/srs/variety';
import { berlin } from './helpers';

// Diese Tests prüfen den Satzwechsel mit den Sätzen der Karte selbst; die festen Zusatz-Sätze (V1, crossLink) prüfen variety.test und varietySim.test.
vi.mock('../../src/domain/srs/crossLink', () => ({ crossSentences: () => [] }));

// Kontext-Wechsel (Emrah 02.10.2026): ab Stufe 3 wechseln sich Ursprungssatz und gespeicherte Claude-Sätze (xEx) bei den
// Satzübungen ab, seit V1 nach Verlauf (`hist[].s`: der am längsten nicht gezeigte Satz, der letzte nie, ohne Verlauf der Ursprungssatz). Aufdecken/Erkennen, Prüfabfrage und Kontrolle bleiben beim Ursprungssatz.

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

describe('Kontext-Wechsel bei Wendungen (Lernplattform 2.0 §4.8)', () => {
  it('ab Stufe 3 wechselt auch die Wendung den Satz: die Stelle der Wendung im gespeicherten Satz über locateChunk', () => {
    const chunk = (reps: number, hist: unknown[] = []): TrainCard =>
      toChunkCard('c-meet-halfway', { id: 'c-meet-halfway', en: 'meet sb halfway', de: 'jdm. entgegenkommen', def: 'to compromise', kind: 'phrase', register: 'neutral', src: { upgraded: 'We are happy to meet you halfway on the timeline.' }, state: 'review', S: 10, D: 5, last: NOW - 10 * 86_400_000, due: NOW - 1000, reps, lapses: 0, stage: 4, hist, xEx: [{ en: 'Both sides had to meet each other halfway on price.', t: 1 }] }, NOW) as TrainCard;
    const seq = [[], [{ t: 1, m: 'type', g: 3, x: 'cloze', s: sentKey('We are happy to meet you halfway on the timeline.') }]].map((hist, reps) => rotatedContext(chunk(reps, hist), 'cloze'));
    expect(seq[0]?.sentence).toBe('We are happy to meet you halfway on the timeline.');
    expect(seq[1]?.sentence).toBe('Both sides had to meet each other halfway on price.');
    expect(seq[1]?.gap).toBe('meet each other halfway');
  });
});

describe('Kontext-Wechsel', () => {
  it('Sätze: Ursprungssatz zuerst, danach nur gespeicherte Sätze, in denen das Wort (auch gebeugt) steht', () => {
    const c = card();
    const all = contextsOf(c);
    expect(all.map((x) => x.sentence)).toEqual(['We use leverage in every price talk.', XEX[0]!.en, XEX[1]!.en]);
    for (const x of all) expect(x.sentence.slice(x.start, x.end)).toBe(x.gap);
    expect(all[2]!.gap).toBe('leveraged');
  });

  it('ab Stufe 3 wechselt der Satz mit jeder Antwort reihum: Ursprungssatz, dann die gespeicherten, der letzte nie', () => {
    const hist: unknown[] = [];
    const seq: (string | undefined)[] = [];
    for (let i = 0; i < 6; i++) {
      const s = rotatedContext(card({ reps: i, hist: [...hist] }), 'cloze')?.sentence;
      seq.push(s);
      hist.push({ t: i + 1, m: 'type', g: 3, x: 'cloze', s: sentKey(s ?? '') });
    }
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
    // Wendungen wechseln den Satz ab Stufe 3 wie Vokabeln (Lernplattform 2.0 §4.8); ohne gespeicherte Sätze bleibt der Ursprungssatz.
    const chunk = { ...card({ reps: 1, xEx: undefined }), kind: 'chunk' } as TrainCard;
    expect(rotatedContext(chunk, 'cloze')).toBe(chunk.context);
  });

  it('die Übungen bauen mit dem gewechselten Satz: Lücke, Lösung und Sprachausgabe passen zusammen', () => {
    const shownOrigin = [{ t: 1, m: 'type', g: 3, x: 'cloze', s: sentKey('We use leverage in every price talk.') }];
    const c = card({ reps: 1, hist: shownOrigin });
    for (const ex of ['cloze', 'cloze_hint', 'tiles', 'speed', 'dictation'] as ExerciseId[]) {
      const e = buildExercise(c, ex, 'de', pool(c), 'seed');
      expect(e.sentence?.sentence, ex).toBe(XEX[0]!.en);
      expect(e.accepted[0], ex).toBe('leverage');
      if (ex === 'dictation') expect(e.speak).toBe(XEX[0]!.en);
      if (ex === 'cloze_hint') expect(e.firstLetter).toBe('l');
    }
    const past = buildExercise(card({ reps: 2, hist: [...shownOrigin, { t: 2, m: 'type', g: 3, x: 'cloze', s: sentKey(XEX[0]!.en) }] }), 'cloze', 'de', pool(c), 'seed');
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
