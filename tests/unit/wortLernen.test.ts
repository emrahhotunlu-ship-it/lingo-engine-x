import { describe, expect, it, vi } from 'vitest';
import { maskOf } from '../../src/domain/answer/mask';
import { toTrainCard } from '../../src/domain/srs/cards';
import { chunkGapWords, chunkParts, locateChunkWords, toChunkCard } from '../../src/domain/srs/chunkCards';
import { buildExercise, chunkWordGap } from '../../src/domain/srs/exercise';
import { explainWord } from '../../src/domain/srs/explainWord';
import { checkExercise } from '../../src/domain/srs/guard';
import { availableExercises, chooseExercise, makeEnv, supports } from '../../src/domain/srs/modes';
import { isLongChunk, LONG_CHUNKS_PER_DAY, MIX_PHRASES, newCards } from '../../src/domain/srs/queue';
import type { ExerciseId, Stage, TrainCard } from '../../src/domain/srs/types';
import { familyOf, freeCorrectDays } from '../../src/domain/srs/variety';
import { packExtraOf } from '../../src/domain/c1pack/packFields';
import { gateJam, sentenceChangeShare } from '../../src/domain/srs/wlDiagnose';
import { berlin } from './helpers';

vi.mock('../../src/domain/srs/crossLink', () => ({ crossSentences: () => [] }));

// Paket WL (19.10.2026): Wendungen zerlegt, Menge, Satzrotation (rotate.test.ts), Tor ohne „Schwer“ und je Stufe zwei echte Abfrage-Familien.

const NOW = berlin('2026-10-19', 9);
type Doc = Record<string, unknown>;

const WORDS: [string, string, string, string, string][] = [
  ['leverage', 'noun', 'Hebelwirkung', 'the power to influence a result', 'We use [leverage] in every price talk.'],
  ['achieve', 'verb', 'erreichen', 'to succeed in doing something', 'She [achieved] her goal of running a marathon.'],
  ['deadline', 'noun', 'Frist', 'the time by which something must be done', 'The [deadline] for the report is Friday.'],
  ['postpone', 'verb', 'verschieben', 'to move to a later time', 'They [postponed] the meeting until next week.'],
  ['reliable', 'adj', 'zuverlässig', 'can be trusted', 'Our supplier is very [reliable].'],
  ['submit', 'verb', 'einreichen', 'to hand in', 'Please [submit] the form by noon.'],
  ['budget', 'noun', 'Etat', 'money plan', 'The [budget] was cut again.'],
];
const doc = (w: (typeof WORDS)[number], over: Doc = {}): Doc => ({ id: w[0], word: w[0], pos: w[1], de: w[2], def: w[3], ex: w[4], col: [], level: 'C1', state: 'review', S: 10, D: 5, last: NOW - 10 * 86_400_000, due: NOW - 1000, reps: 3, lapses: 0, modes: {}, order: 900, src: 'ai', added: '2026-08-01', stage: 2, hist: [], intro: '2026-08-01', ...over });
const cards = (over: Doc = {}): TrainCard[] => WORDS.map((w) => toTrainCard(w[0], doc(w, over), true, NOW) as TrainCard);
const chunk = (en: string, ex: string, over: Doc = {}): TrainCard =>
  toChunkCard(`c-${en.replace(/\W+/g, '-')}`, { id: `c-${en}`, en, de: 'x', def: 'to x', kind: 'phrase', register: 'neutral', src: { upgraded: ex }, state: 'review', S: 6, D: 5, due: NOW - 1000, last: NOW - 9 * 86_400_000, reps: 3, lapses: 0, stage: 2, hist: [], ...over }, NOW) as TrainCard;

describe('Tor: „Schwer“ ist kein freier Beleg', () => {
  it('nur Gut und Leicht an verschiedenen Tagen zählen, Schwer und Nochmal nie', () => {
    const h = (t: number, g: number) => ({ t, m: 'type', g, x: 'cloze' });
    expect(freeCorrectDays({ hist: [h(NOW, 2), h(NOW - 2 * 86_400_000, 2)] })).toBe(0);
    expect(freeCorrectDays({ hist: [h(NOW, 3), h(NOW - 2 * 86_400_000, 4)] })).toBe(2);
    expect(freeCorrectDays({ hist: [h(NOW - 2 * 86_400_000, 3)] }, { t: NOW, ex: 'cloze', grade: 2 })).toBe(1);
    expect(freeCorrectDays({ hist: [h(NOW - 2 * 86_400_000, 3)] }, { t: NOW, ex: 'cloze', grade: 3 })).toBe(2);
  });
});

describe('Tor bei Wendungen: cloze_part (ein Wort) untergräbt das Tor nicht', () => {
  const D = 86_400_000;
  const h = (t: number, x: string, g = 3) => ({ t, m: 'type', g, x });
  it('zählt nur für den Aufstieg auf Stufe 4 und dort für höchstens einen Tag, nie für Stufe 5', () => {
    const two = { hist: [h(NOW - 4 * D, 'cloze_part'), h(NOW - 2 * D, 'cloze_part')] };
    expect(freeCorrectDays(two, undefined, 4)).toBe(1);
    expect(freeCorrectDays(two, undefined, 5)).toBe(0);
    expect(freeCorrectDays(two)).toBe(0);
    expect(freeCorrectDays({ hist: [...two.hist, h(NOW - D, 'cloze')] }, undefined, 4)).toBe(2);
    expect(freeCorrectDays({ hist: [h(NOW - 2 * D, 'cloze_part')] }, { t: NOW, ex: 'cloze_part', grade: 3 }, 4)).toBe(1);
    expect(freeCorrectDays({ hist: [h(NOW - 2 * D, 'cloze_part', 2)] }, undefined, 4)).toBe(0);
  });

  const ch = (hist: unknown[], xs: Doc) => chunk('weigh up the options', 'We should weigh up the options before Friday.', { stage: 3, hist, xs });
  const env = makeEnv(true, true, true);
  const strong = (...ids: string[]) => Object.fromEntries(ids.map((i) => [i, { c: 6, w: 0 }]));
  const weak = (id: string) => ({ [id]: { c: 0, w: 6 } });
  it('Stufe 3 mit offenem Tor: erst das freie Einzelwort, die ganze freie Lücke erst nach einem cloze_part-Tag', () => {
    const before = ch([], { ...strong('cloze_hint', 'tiles', 'complete', 'colloc_gap'), ...weak('cloze_part') });
    expect(chooseExercise(before, 'de', 6, [], env)).toBe('cloze_part');
    const noWhole = ch([], { ...strong('cloze_part', 'cloze_hint', 'tiles', 'complete', 'colloc_gap'), ...weak('cloze') });
    expect(availableExercises(noWhole, 'de', 6, env)).not.toContain('cloze');
    expect(chooseExercise(noWhole, 'de', 6, [], env)).not.toBe('cloze');
    const after = ch([h(NOW - 3 * D, 'cloze_part')], { ...strong('cloze_hint', 'tiles', 'complete', 'colloc_gap', 'cloze_part'), ...weak('cloze') });
    expect(chooseExercise(after, 'de', 6, [], env)).toBe('cloze');
  });
});

describe('Jede Stufe am Handy mindestens zwei echte Abfrage-Familien', () => {
  const envs = [makeEnv(true, true, true), makeEnv(false, false, true), makeEnv(true, false, true)];
  const families = (list: ExerciseId[]): number => new Set(list.map(familyOf)).size;

  it('Wörter mit Satz: keine Stufe 1–5 hat nur eine Familie', () => {
    for (const env of envs)
      for (const stage of [1, 2, 3, 4, 5] as Stage[])
        for (const c of cards({ stage })) {
          const list = availableExercises(c, 'de', 6, env);
          expect(families(list), `${c.id}@${stage} ${list.join(',')}`).toBeGreaterThanOrEqual(2);
        }
  });

  it('Wörter ohne Satz und Wendungen mit Satz ebenso', () => {
    for (const env of envs)
      for (const stage of [1, 2, 3, 4, 5] as Stage[]) {
        const bare = cards({ stage, ex: undefined });
        for (const c of bare) expect(families(availableExercises(c, 'de', 6, env)), `${c.id}@${stage} ohne Satz`).toBeGreaterThanOrEqual(2);
        const ch = chunk('meet a deadline', 'We always meet a deadline for the client.', { stage });
        expect(families(availableExercises(ch, 'de', 6, env)), `Wendung@${stage}`).toBeGreaterThanOrEqual(2);
      }
  });

  it('Stufe 1 bietet zwei Familien (Bedeutung wählen, Wort wählen), Stufe 2 den Wortanfang; „Passt das Wort?“ (fits) wird nie angeboten', () => {
    const env = makeEnv(true, true, true);
    const s1 = availableExercises(cards({ stage: 1 })[0]!, 'de', 6, env);
    expect(s1).toEqual(expect.arrayContaining(['mc_en', 'mc_de']));
    expect(availableExercises(cards({ stage: 2 })[0]!, 'de', 6, env)).toContain('cloze_hint');
    for (const stage of [0, 1, 2, 3, 4, 5] as Stage[]) for (const c of cards({ stage })) expect(availableExercises(c, 'de', 6, env), `${c.id}@${stage}`).not.toContain('fits');
    expect(supports(cards({ stage: 1 })[0]!, 'fits', 'de', 6)).toBe(false);
  });
});

describe('„Passt das Wort in diesen Satz?“ (fits)', () => {
  const pool = cards({ stage: 1 });
  it('zwei Optionen, genau eine richtig, Begründung nennt das Wort; der Wächter lässt die Aufgabe zu', () => {
    let yes = 0;
    let no = 0;
    for (const c of pool)
      for (let i = 0; i < 12; i++) {
        const e = buildExercise(c, 'fits', 'de', pool, `2026-10-19|${i}`);
        expect(e.options).toHaveLength(2);
        expect(e.options.filter((o) => o.correct)).toHaveLength(1);
        expect(e.sentence).not.toBeNull();
        expect(e.sentence!.sentence.slice(e.sentence!.start, e.sentence!.end)).toBe(e.sentence!.gap);
        expect(checkExercise(e, c, 'de'), `${c.id} ${e.sentence!.sentence}`).toEqual([]);
        if (e.fits?.truth) {
          yes++;
          expect(e.options.find((o) => o.correct)!.id).toBe('yes');
          expect(e.sentence!.sentence).toBe(c.context!.sentence);
        } else {
          no++;
          expect(e.options.find((o) => o.correct)!.id).toBe('no');
          expect(e.fits?.foil?.word).toBeTruthy();
          expect(e.sentence!.sentence).not.toBe(c.context!.sentence);
          // Das Kartenwort steht in der Form des fremden Satzes (gleiche Wortart, Beugung passt).
          expect(e.sentence!.gap.toLowerCase().startsWith(c.lemma.toLowerCase().slice(0, 4))).toBe(true);
        }
      }
    expect(yes).toBeGreaterThan(0);
    expect(no).toBeGreaterThan(0);
  });

  it('die Begründung steht bei richtiger und falscher Antwort, in beiden Sprachen', () => {
    const c = pool[0]!;
    const truth = { truth: true, foil: null };
    const foil = { truth: false, foil: { word: 'achieve', meaning: 'erreichen' } };
    const base = { card: c, ex: 'fits' as const, given: 'no', check: { verdict: 'wrong' as const }, picked: { label: 'no' } };
    for (const lang of ['de', 'en'] as const) {
      const wrongTruth = explainWord({ ...base, verdict: 'wrong', lang, fits: truth });
      expect(wrongTruth.lines.find((l) => l.k === 'yours')).toBeDefined();
      const okFoil = explainWord({ ...base, verdict: 'ok', check: { verdict: 'correct' }, lang, fits: foil });
      const why = okFoil.lines.find((l) => l.k === 'why');
      expect(why && 'text' in why ? why.text : '').toContain('achieve');
      expect(okFoil.lines.find((l) => l.k === 'yours')).toBeUndefined();
    }
  });

});

describe('Wendungen zerlegt', () => {
  const ex = 'We always meet a deadline for the client.';
  it('Kern, Rahmen und Platzhalter', () => {
    expect(chunkParts('meet sb halfway').map((p) => `${p.text}:${p.kind}`)).toEqual(['meet:core', 'sb:slot', 'halfway:core']);
    expect(chunkParts('in return for').map((p) => `${p.text}:${p.kind}`)).toEqual(['in:frame', 'return:core', 'for:frame']);
    expect(chunkParts('push back the go-live').map((p) => p.kind)).toEqual(['core', 'frame', 'frame', 'core']);
  });

  it('feste Wörter im Satz mit Stelle; Lückenwörter: Kern zuerst, nie Artikel oder Platzhalter', () => {
    const hit = locateChunkWords('We are happy to meet you halfway on the timeline.', 'meet sb halfway')!;
    expect(hit.words.map((w) => w.w)).toEqual(['meet', 'halfway']);
    expect(chunkGapWords(ex, 'meet a deadline').map((w) => w.w)).toEqual(['meet', 'deadline']);
    expect(chunkGapWords('They pushed back the go-live.', 'push back the go-live').map((w) => w.w)).toEqual(['pushed', 'go-live', 'back']);
  });

  const ex2 = 'We should weigh up the options before Friday.';
  it('keine Überspringerei mehr: Stufe 1 und 2 sind echte Stufen; Stütze auf Stufe 2 hat nur ein Wort als Lücke, `cloze_part` ein freies Einzelwort', () => {
    expect(chunk('weigh up the options', ex2, { stage: 1 }).stage).toBe(1);
    const hint = buildExercise(chunk('weigh up the options', ex2, { stage: 2 }), 'cloze_hint', 'de', [], 'x|0');
    expect(hint.sentence?.gap.split(' ')).toHaveLength(1);
    expect(hint.accepted).toEqual([hint.sentence?.gap]);
    const part = buildExercise(chunk('weigh up the options', ex2, { stage: 3 }), 'cloze_part', 'de', [], 'x|0');
    expect(part.ex).toBe('cloze_part');
    expect(part.sentence?.gap.split(' ')).toHaveLength(1);
    // `cloze` ist immer die ganze Wendung.
    const whole = buildExercise(chunk('weigh up the options', ex2, { stage: 3 }), 'cloze', 'de', [], 'x|0');
    expect(whole.sentence?.gap).toBe('weigh up the options');
  });

  it('das Paket steuert die erste Lücke: gap.at, phrasal (abhängige Präposition), frame (nicht zerlegt)', () => {
    expect(chunkGapWords(ex, 'meet a deadline', { at: 'deadline' })[0]?.w).toBe('deadline');
    expect(chunkGapWords('We will push back on that plan.', 'push back on', { cat: 'phrasal' })[0]?.w).toBe('on');
    expect(chunkGapWords('We will look into it today.', 'look into', { cat: 'phrasal' })[0]?.w).toBe('into');
    expect(chunkParts('push back on', { cat: 'phrasal' }).map((p) => `${p.text}:${p.kind}`)).toEqual(['push:core', 'back:core', 'on:frame']);
    expect(chunkParts('I see where you are coming from', { cat: 'frame' }).every((p) => p.kind === 'fixed')).toBe(true);
    expect(chunkGapWords('I see where you are coming from.', 'I see where you are coming from', { cat: 'frame', at: 'coming' })[0]?.w).toBe('coming');
    expect(chunkGapWords('We are fine for the time being.', 'for the time being', { cat: 'frame', at: 'for' })[0]?.w).toBe('for');
  });

  it('das Lückenwort wechselt weiter, auch wenn `hist` bei 12 Einträgen gedeckelt ist (Zähler: reps)', () => {
    const hist = Array.from({ length: 12 }, (_, i) => ({ t: i + 1, m: 'cloze', g: 3 }));
    const seen = new Set<string>();
    for (let reps = 12; reps < 18; reps++) {
      const base = chunk('weigh up the options', ex2, { stage: 2, reps, hist });
      seen.add(chunkWordGap(base, base.context!)!.gap);
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it('ein bekanntes Wort der Wendung wird nicht als Erstes abgefragt', () => {
    const base = chunk('weigh up the options', ex2, { stage: 2, reps: 0 });
    expect(chunkWordGap(base, base.context!)!.gap).toBe('weigh');
    expect(chunkWordGap(base, base.context!, new Set(['weigh']))!.gap).toBe('options');
  });

  it('Stufe 3: ganze Wendung mit Anfangsbuchstaben je Wort; frei (cloze) ganz erst ab Stufe 4', () => {
    const hint3 = buildExercise(chunk('meet a deadline', ex, { stage: 3 }), 'cloze_hint', 'de', [], 'x|0');
    expect(hint3.sentence?.gap).toBe('meet a deadline');
    const m = maskOf(hint3.accepted[0]!, { firstLetter: true, perWord: true });
    expect(m.filter((c) => c.kind === 'slot' && c.hint).map((c) => (c.kind === 'slot' ? c.hint : ''))).toEqual(['m', 'a', 'd']);
    expect(maskOf('meet a deadline', { firstLetter: true }).filter((c) => c.kind === 'slot' && c.hint)).toHaveLength(1);
    const free4 = buildExercise(chunk('meet a deadline', ex, { stage: 4 }), 'cloze', 'de', [], 'x|0');
    expect(free4.sentence?.gap).toBe('meet a deadline');
    // Bausteine für Wendungen wieder da.
    const c2 = chunk('meet a deadline', ex, { stage: 2 });
    expect(supports(c2, 'tiles', 'de', 6)).toBe(true);
    expect(availableExercises(c2, 'de', 6, makeEnv(true, true, true))).toContain('tiles');
    const tiles = buildExercise(c2, 'tiles', 'de', [], 'x|0');
    expect(tiles.accepted[0]).toBe(tiles.sentence?.gap);
  });

  it('die Aufgaben bestehen den Wächter', () => {
    for (const stage of [1, 2, 3, 4] as Stage[])
      for (const exId of ['cloze_hint', 'cloze', 'tiles', 'mc_en', 'ctx_mc'] as ExerciseId[]) {
        const c = chunk('meet a deadline', ex, { stage });
        if (!supports(c, exId, 'de', 6)) continue;
        const e = buildExercise(c, exId, 'de', cards(), 'x|0');
        expect(checkExercise(e, c, 'de'), `${exId}@${stage}`).toEqual([]);
      }
  });
});

describe('Menge: Mix 1:1, höchstens zwei lange Wendungen, bekanntes Kernwort zuerst, ohne Satz zurückgestellt', () => {
  const mk = (id: string, kind: 'vocab' | 'chunk', over: Doc = {}): TrainCard => {
    const c = toTrainCard(id, { word: id, de: 'x', ex: `The [${id.split(' ').at(-1)}] matters.`, state: 'new', src: 'pack', added: '2026-09-01', order: 900, ...over }, true, NOW) as TrainCard;
    return kind === 'chunk' ? { ...c, kind: 'chunk' } : c;
  };

  it('Mix 1:1', () => {
    expect(MIX_PHRASES).toBe(1);
    const list = [mk('w1', 'vocab'), mk('w2', 'vocab'), mk('a b', 'chunk'), mk('c d', 'chunk'), mk('e f', 'chunk')];
    expect(newCards(list).map((c) => c.kind)).toEqual(['chunk', 'vocab', 'chunk', 'vocab', 'chunk']);
  });

  it('höchstens zwei Wendungen mit drei oder mehr Wörtern je Tag, die heute schon eingeführten zählen mit', () => {
    const longs = ['one two three', 'four five six', 'seven eight nine', 'ten eleven twelve'].map((w) => mk(w, 'chunk'));
    expect(isLongChunk(longs[0]!)).toBe(true);
    expect(isLongChunk(mk('meet sb', 'chunk'))).toBe(false);
    const short = mk('short one', 'chunk');
    const out = newCards([...longs, short]);
    expect(out.filter(isLongChunk)).toHaveLength(LONG_CHUNKS_PER_DAY);
    expect(out).toContain(short);
    expect(newCards([...longs, short], { longToday: 1 }).filter(isLongChunk)).toHaveLength(1);
    expect(newCards([...longs], { longToday: 2 })).toHaveLength(0);
  });

  it('Wendungen mit bekanntem Kernwort kommen vor ganz neuen', () => {
    const known = toTrainCard('deadline', { word: 'deadline', de: 'Frist', ex: 'The [deadline] is near.', state: 'review', stage: 3, reps: 4, S: 9, D: 5, due: NOW + 1, last: NOW - 1, src: 'ai' }, true, NOW) as TrainCard;
    const unknown = mk('alpha beta', 'chunk', { added: '2026-09-01' });
    const withKnown = mk('meet deadline', 'chunk', { added: '2026-09-02' });
    const out = newCards([known, unknown, withKnown]).map((c) => c.word);
    expect(out.indexOf('meet deadline')).toBeLessThan(out.indexOf('alpha beta'));
  });

  it('neue Wendungen ohne Satz werden zurückgestellt (Kap. 15)', () => {
    const noSentence = { ...mk('no sentence', 'chunk'), context: null } as TrainCard;
    expect(newCards([noSentence, mk('with sentence', 'chunk')]).map((c) => c.word)).toEqual(['with sentence']);
  });
});

describe('Diagnosewerte und Paket-Kategorie', () => {
  it('Tor-Stau: Stufe 3, mindestens 4 freie Versuche, kein einziger Gut', () => {
    const tries = (g: number, n: number) => Array.from({ length: n }, (_, i) => ({ t: NOW - (n - i) * 86_400_000, m: 'type', g, x: 'cloze' }));
    const jam = { stage: 3 as Stage, hidden: false, doc: { hist: tries(2, 4) } };
    const ok = { stage: 3 as Stage, hidden: false, doc: { hist: [...tries(2, 4), { t: NOW, m: 'type', g: 3, x: 'cloze' }] } };
    const few = { stage: 3 as Stage, hidden: false, doc: { hist: tries(2, 3) } };
    expect(gateJam([jam, ok, few, { ...jam, stage: 4 }])).toBe(1);
  });

  it('Satzwechsel ab Tag 2: Anteil der Wiederholungen mit anderem Satz als zuletzt', () => {
    const D = 86_400_000;
    const doc = { hist: [{ t: NOW - 3 * D, s: 'a' }, { t: NOW - 2 * D, s: 'b' }, { t: NOW - D, s: 'b' }, { t: NOW, s: 'c' }] };
    const r = sentenceChangeShare([{ doc }]);
    expect(r.n).toBe(3);
    expect(r.share).toBeCloseTo(2 / 3);
    expect(sentenceChangeShare([{ doc: { hist: [] } }]).share).toBeNull();
  });

  it('Paketeintrag liefert die Kategorie', () => {
    expect(packExtraOf('push back on')?.cat).toBe('phrasal');
    expect(packExtraOf('push back on')?.gap?.at).toBe('on');
  });
});
