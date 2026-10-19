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
      toChunkCard('c-meet-halfway', { id: 'c-meet-halfway', en: 'meet halfway', de: 'jdm. entgegenkommen', def: 'to compromise', kind: 'phrase', register: 'neutral', src: { upgraded: 'We are happy to meet halfway on the timeline.' }, state: 'review', S: 10, D: 5, last: NOW - 10 * 86_400_000, due: NOW - 1000, reps, lapses: 0, stage: 4, hist, xEx: [{ en: 'Both sides had to meet halfway on price.', t: 1 }] }, NOW) as TrainCard;
    const seq = [[], [{ t: 1, m: 'type', g: 3, x: 'cloze', s: sentKey('We are happy to meet halfway on the timeline.') }]].map((hist, reps) => rotatedContext(chunk(reps, hist), 'cloze'));
    expect(seq[0]?.sentence).toBe('We are happy to meet halfway on the timeline.');
    expect(seq[1]?.sentence).toBe('Both sides had to meet halfway on price.');
    expect(seq[1]?.gap).toBe('meet halfway');
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
    // Tag 1 der Anker, danach reihum durch alle drei Sätze (Reihenfolge der neuen Sätze fest, aber nicht „erster zuerst“); nie zweimal derselbe in Folge.
    expect(seq[0]).toBe('We use leverage in every price talk.');
    expect(new Set(seq.slice(0, 3)).size).toBe(3);
    expect(seq.slice(3)).toEqual(seq.slice(0, 3));
  });

  it('gleicher Stand → gleicher Satz (fest, kein Zufall)', () => {
    const c = card({ reps: 4 });
    expect(rotatedContext(c, 'cloze_hint')?.sentence).toBe(rotatedContext(c, 'cloze_hint')?.sentence);
  });

  it('Tag 1 und Übungen ohne Satz: der Ursprungssatz bleibt; ohne weitere Sätze und bei Wendungen ohne Sätze ebenso', () => {
    expect(ROTATE_FROM_STAGE).toBe(1);
    // Tag 1: noch keine Antwort (oder alle von heute) → Anker.
    for (const stage of [1, 2, 3]) expect(rotatedContext(card({ stage, reps: 0, hist: [] }), 'cloze')?.sentence).toBe('We use leverage in every price talk.');
    const today = [{ t: NOW, m: 'recog', g: 3, x: 'mc_en', s: sentKey('We use leverage in every price talk.') }];
    expect(rotatedContext(card({ stage: 1, hist: today }), 'ctx_mc', '2026-10-02')?.sentence).toBe('We use leverage in every price talk.');
    for (const ex of ['spot', 'mc_de', 'type', 'colloc', 'produce'] as ExerciseId[]) expect(rotatedContext(card({ reps: 1, hist: [{ t: 1, m: 'recog', g: 3, x: 'cloze', s: sentKey('We use leverage in every price talk.') }] }), ex)?.sentence, ex).toBe('We use leverage in every price talk.');
    expect(rotatedContext(card({ reps: 1, xEx: undefined, hist: [{ t: 1, m: 'recog', g: 3, x: 'cloze' }] }), 'cloze')?.sentence).toBe('We use leverage in every price talk.');
    const chunk = { ...card({ reps: 1, xEx: undefined }), kind: 'chunk' } as TrainCard;
    expect(rotatedContext(chunk, 'cloze')).toBe(chunk.context);
  });

  it('ab Stufe 1 und ab der ersten Wiederholung an einem anderen Tag wechseln auch Erkennen, Zuordnen, Hören und Aufdecken – nie derselbe Satz wie zuletzt', () => {
    const origin = 'We use leverage in every price talk.';
    for (const stage of [1, 2, 3, 4]) {
      for (const ex of ['mc_en', 'ctx_mc', 'listen_mc', 'match', 'flip', 'cloze_hint', 'cloze'] as ExerciseId[]) {
        const c = card({ stage, hist: [{ t: 1, m: 'recog', g: 3, x: 'mc_en', s: sentKey(origin) }] });
        expect(rotatedContext(c, ex, '2026-10-02')?.sentence, `${ex}@${stage}`).not.toBe(origin);
      }
    }
    const e = buildExercise(card({ stage: 1, hist: [{ t: 1, m: 'recog', g: 3, x: 'mc_en', s: sentKey(origin) }] }), 'mc_en', 'de', [], '2026-10-02|0');
    expect(e.sentence?.sentence).not.toBe(origin);
    expect(e.sentence?.sentence.slice(e.sentence.start, e.sentence.end)).toBe(e.sentence?.gap);
  });

  it('Verlauf ohne `s` aus der Zeit davor gilt als Ursprungssatz: der nächste Satz ist ein anderer', () => {
    const old = Array.from({ length: 5 }, (_, i) => ({ t: i + 1, m: 'recog', g: 3, x: 'match' }));
    expect(rotatedContext(card({ stage: 2, hist: old }), 'match')?.sentence).not.toBe('We use leverage in every price talk.');
  });

  it('der Satz der letzten Antwort kommt nie noch einmal, auch bei 12 Einträgen im Verlauf und mehr Sätzen als Einträgen', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ en: `Number ${i} shows leverage in a different plan.`, t: 1 }));
    const hist: { t: number; m: string; g: number; x: string; s: string }[] = [];
    let last = '';
    for (let i = 0; i < 40; i++) {
      const c = card({ xEx: many, hist: hist.slice(-12), stage: 3 });
      const s = rotatedContext(c, i % 2 ? 'match' : 'cloze')?.sentence ?? '';
      expect(s, `Antwort ${i}`).not.toBe(last);
      hist.push({ t: i + 1, m: 'recog', g: 3, x: 'cloze', s: sentKey(s) });
      last = s;
    }
    expect(new Set(hist.map((h) => h.s)).size).toBeGreaterThan(5);
  });

  it('ein abgeschnittener Ursprungssatz („…“) wechselt mit, sobald es einen anderen Satz gibt', () => {
    const c = card({ ex: 'We use [leverage] in every price talk and then …', hist: [{ t: 1, m: 'recog', g: 3, x: 'mc_en' }] });
    expect(contextsOf(c).map((x) => x.sentence)).not.toContain('We use leverage in every price talk and then …');
    expect([XEX[0]!.en, XEX[1]!.en]).toContain(rotatedContext(c, 'cloze', '2026-10-02')?.sentence);
    expect(rotatedContext(card({ ex: 'We use [leverage] in every price talk and then …', xEx: undefined, hist: [] }), 'mc_en')?.sentence).toBe('We use leverage in every price talk and then …');
  });

  it('die Übungen bauen mit dem gewechselten Satz: Lücke, Lösung und Sprachausgabe passen zusammen', () => {
    const shownOrigin = [{ t: 1, m: 'type', g: 3, x: 'cloze', s: sentKey('We use leverage in every price talk.') }];
    const c = card({ reps: 1, hist: shownOrigin });
    for (const ex of ['cloze', 'cloze_hint', 'tiles', 'speed', 'dictation'] as ExerciseId[]) {
      const e = buildExercise(c, ex, 'de', pool(c), 'seed');
      const want = [XEX[0]!, XEX[1]!].find((x) => x.en === e.sentence?.sentence);
      expect(want, ex).toBeDefined();
      expect(e.accepted[0], ex).toBe(e.sentence?.gap);
      if (ex === 'dictation') expect(e.speak).toBe(want!.en);
      if (ex === 'cloze_hint') expect(e.firstLetter).toBe('l');
    }
    // Der Satz, der zuletzt dran war, kommt nicht noch einmal.
    const first = buildExercise(c, 'cloze', 'de', pool(c), 'seed').sentence!.sentence;
    const past = buildExercise(card({ reps: 2, hist: [...shownOrigin, { t: 2, m: 'type', g: 3, x: 'cloze', s: sentKey(first) }] }), 'cloze', 'de', pool(c), 'seed');
    expect(past.sentence?.sentence).not.toBe(first);
    expect(past.sentence?.sentence).not.toBe('We use leverage in every price talk.');
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
