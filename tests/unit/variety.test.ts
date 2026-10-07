import { beforeAll, describe, expect, it } from 'vitest';
import { preloadC1x, resetC1Store } from '../../src/domain/c1x/preload';
import { kindsFor, varyKinds } from '../../src/domain/c1x/select';
import { formsOfPat, patPush, readPatEntry } from '../../src/domain/metrics/pattern';
import { applyUpdate, cardPatch, HIST_MAX } from '../../src/domain/srs/applyReview';
import { toTrainCard } from '../../src/domain/srs/cards';
import { toChunkCard } from '../../src/domain/srs/chunkCards';
import { crossSentences, resetCrossLink } from '../../src/domain/srs/crossLink';
import { chooseExercise, makeEnv } from '../../src/domain/srs/modes';
import { contextsOf, rotatedContext } from '../../src/domain/srs/rotate';
import type { AnswerEvent, TrainCard } from '../../src/domain/srs/types';
import { distinctForms, familyOf, leastRecent, sentKey, varietyBias, varietyOf } from '../../src/domain/srs/variety';
import { berlin } from './helpers';

const NOW = berlin('2026-10-07', 9);
type Doc = Record<string, unknown>;
const doc = (over: Doc = {}): Doc => ({ id: 'leverage', word: 'leverage', pos: 'noun', de: 'Hebelwirkung', def: 'the power to influence a result', ex: 'We use [leverage] in every price talk.', col: [], level: 'C1', state: 'review', S: 10, D: 5, last: NOW - 10 * 86_400_000, due: NOW - 1000, reps: 4, lapses: 0, modes: {}, order: 900, src: 'ai', added: '2026-08-01', stage: 4, hist: [], intro: '2026-08-01', ...over });
const card = (over: Doc = {}): TrainCard => toTrainCard('leverage', doc(over), true, NOW) as TrainCard;
const h = (...xs: [string, string?][]): Doc[] => xs.map(([x, s], i) => ({ t: NOW - (xs.length - i) * 1000, m: 'type', g: 3, x, ...(s ? { s } : {}) }));
const touch = makeEnv(true, true, true);

beforeAll(async () => {
  resetC1Store();
  resetCrossLink();
  await preloadC1x(['mcc', 'ocl', 'err', 'kwt']);
  resetCrossLink();
});

describe('Verlauf je Karte (hist x/s)', () => {
  it('sentKey ist stabil, kurz und ignoriert Schreibweise und Satzzeichen', () => {
    expect(sentKey('We use leverage in every price talk.')).toBe(sentKey('we use LEVERAGE in every price talk'));
    expect(sentKey('A.')).not.toBe(sentKey('B.'));
    expect(sentKey('We use leverage.').length).toBeLessThanOrEqual(8);
  });

  it('varietyOf liest Formen und Sätze der Reihe nach, Aufdecken und „Kenne ich“ zählen nicht als Form', () => {
    const v = varietyOf(doc({ hist: [...h(['mc_en', 's1'], ['flip'], ['cloze', 's2']), { t: NOW, m: 'known', g: 3 }] }));
    expect(v.forms).toEqual(['mc_en', 'cloze']);
    expect(v.sents).toEqual(['s1', 's2']);
    expect(varietyOf(doc({ hist: 'kaputt' })).forms).toEqual([]);
  });

  it('cardPatch schreibt die Form und den Satz, höchstens 12 Einträge, nichts wird gelöscht', () => {
    const ev: AnswerEvent = { t: NOW, day: '2026-10-07', kind: 'v', id: 'leverage', ex: 'cloze', grade: 3, given: '', ans: '', ms: 1000, lang: 'de', ctx: 'rev', sx: 's9' };
    const full = doc({ hist: h(...Array.from({ length: HIST_MAX }, () => ['cloze_hint', 's1'] as [string, string])) });
    const next = applyUpdate(full, cardPatch(full, ev));
    const hist = next.hist as Record<string, unknown>[];
    expect(hist).toHaveLength(HIST_MAX);
    expect(hist.at(-1)).toMatchObject({ x: 'cloze', s: 's9' });
    // Ohne Satz bleibt `s` weg (alte Aufrufer).
    const { sx: _sx, ...noSent } = ev;
    void _sx;
    const next2 = applyUpdate(full, cardPatch(full, noSent));
    expect((next2.hist as Record<string, unknown>[]).at(-1)).not.toHaveProperty('s');
  });

  it('die Formenfamilien: Stütze und freie Lücke zählen als verschiedene Formen, Auswahlarten je Richtung', () => {
    expect(familyOf('cloze')).not.toBe(familyOf('cloze_hint'));
    expect(familyOf('mc_en')).toBe(familyOf('ctx_mc'));
    expect(familyOf('mc_de')).not.toBe(familyOf('mc_en'));
    expect(distinctForms(varietyOf(doc({ hist: h(['mc_en'], ['ctx_mc'], ['cloze']) })))).toBe(2);
  });

  it('leastRecent: nie benutzt zuerst, der zuletzt benutzte nie, Gleichstand reihum', () => {
    const items = ['a', 'b', 'c'];
    expect(leastRecent(items, (x) => x, ['a', 'b'])).toBe('c');
    expect(leastRecent(items, (x) => x, ['c', 'a', 'b'])).toBe('c');
    expect(leastRecent(items, (x) => x, [], 4)).toBe('b');
    expect(leastRecent([], (x) => x, [])).toBeUndefined();
  });
});

describe('Wahl der Abfrageart', () => {
  it('dieselbe Art wie zuletzt kommt nie wieder, auch wenn sie die schwächste ist', () => {
    // `cloze` ist klar die schwächste Art (viele Fehler), war aber gerade dran.
    const c = card({ xs: { cloze: { c: 0, w: 9 }, complete: { c: 9, w: 0 } }, hist: h(['cloze']) });
    expect(c.lastEx).toBe('cloze');
    for (const stage of [4, 5]) expect(chooseExercise({ ...c, stage: stage as 4 }, 'de', 9, [], touch)).not.toBe('cloze');
  });

  it('gibt es nur eine Art, bleibt sie (kein Verbot ohne Alternative)', () => {
    const c = card({ hist: h(['mc_en']) });
    const only = { ...c, context: null, de: null, def: null } as TrainCard;
    expect(chooseExercise(only, 'de', 9, [], touch)).toBeNull();
  });

  it('der Aufschlag bevorzugt lange nicht gesehene Arten und, vor „Fest“, neue Formenfamilien', () => {
    const v = varietyOf(doc({ hist: h(['cloze'], ['cloze'], ['complete']) }));
    expect(varietyBias('cloze', v, 4)).toBeGreaterThan(varietyBias('wordfam', v, 4));
    // Ab Stufe 4 mit nur zwei Familien: eine neue Familie bekommt einen Vorsprung, ab drei Familien nicht mehr.
    const two = varietyOf(doc({ hist: h(['cloze'], ['complete']) }));
    const three = varietyOf(doc({ hist: h(['cloze'], ['complete'], ['wordfam']) }));
    expect(varietyBias('colloc', two, 4)).toBeLessThan(0);
    expect(varietyBias('colloc', three, 4)).toBeGreaterThanOrEqual(0);
    expect(varietyBias('colloc', two, 2)).toBeGreaterThanOrEqual(0);
  });
});

describe('Satzwechsel mit Verlauf', () => {
  const XEX = [
    { en: 'Good leverage helps in every negotiation.', t: 1 },
    { en: 'They leveraged their position to win the deal.', t: 1 },
  ];
  const origin = 'We use leverage in every price talk.';

  it('der zuletzt gezeigte Satz kommt nicht noch einmal, solange es einen anderen gibt', () => {
    for (const last of [origin, XEX[0]!.en, XEX[1]!.en]) {
      const c = card({ xEx: XEX, hist: h(['cloze', sentKey(last)]) });
      expect(rotatedContext(c, 'cloze')?.sentence).not.toBe(last);
    }
  });

  it('der am längsten nicht gezeigte Satz kommt zuerst', () => {
    const c = card({ xEx: XEX, hist: h(['cloze', sentKey(XEX[0]!.en)], ['cloze', sentKey(origin)]) });
    expect(rotatedContext(c, 'cloze')?.sentence).toBe(XEX[1]!.en);
  });

  it('zusätzliche Quellen: Sätze der Wortpartner (col[].ex) kommen dazu', () => {
    const c = card({ col: [{ p: 'gain leverage', de: 'x', gap: 'gain', opts: ['win', 'get'], ex: 'Smaller firms rarely gain leverage over large buyers.' }] });
    expect(contextsOf(c).map((x) => x.sentence)).toContain('Smaller firms rarely gain leverage over large buyers.');
  });

  it('Sätze der Wortpartner mit Klammern um die Wendung: die Lücke steht am Wort, nicht an der Wendung', () => {
    const c = card({ col: [{ p: 'gain leverage', de: 'x', gap: 'gain', opts: ['win', 'get'], ex: 'Smaller firms [gain leverage] over large buyers.' }] });
    const hit = contextsOf(c).find((x) => x.sentence.startsWith('Smaller firms'));
    expect(hit?.sentence).toBe('Smaller firms gain leverage over large buyers.');
    expect(hit?.gap).toBe('leverage');
  });

  it('feste c1x-Sätze mit derselben Lexik (lex) werden für die Wendung genutzt, mit sauberer Stelle im Satz', () => {
    const chunk = toChunkCard('c-rule-out', { id: 'c-rule-out', en: 'rule out', de: 'ausschließen', def: 'to exclude', kind: 'phrase', register: 'neutral', src: { upgraded: 'We cannot rule out a delay.' }, state: 'review', S: 10, D: 5, last: NOW - 86_400_000, due: NOW, reps: 2, lapses: 0, stage: 4, hist: [] }, NOW) as TrainCard;
    const cross = crossSentences(chunk);
    expect(cross.some((s) => s.includes('rule out the possibility of heavy rain'))).toBe(true);
    const all = contextsOf(chunk);
    expect(all.length).toBeGreaterThanOrEqual(2);
    for (const x of all) expect(x.sentence.slice(x.start, x.end)).toBe(x.gap);
  });

  it('kurze Wörter bekommen keine losen Treffer (nur genaue lex-Treffer oder ab 5 Buchstaben)', () => {
    expect(crossSentences({ word: 'set', kind: 'vocab' })).toEqual([]);
  });
});

describe('Muster: Verlauf der Formen', () => {
  it('patPush merkt die letzten vier Formen, ungültige Namen werden ignoriert, readPatEntry behält sie', () => {
    let e = patPush(undefined, { ok: true, help: false, day: '2026-10-07', t: 1, form: 'ocl' });
    for (const [i, f] of ['kwt', 'err', 'mcc', 'wf'].entries()) e = patPush(e, { ok: true, help: false, day: '2026-10-07', t: 2 + i, form: f });
    expect(formsOfPat(e)).toEqual(['kwt', 'err', 'mcc', 'wf']);
    expect(formsOfPat(readPatEntry(e))).toEqual(['kwt', 'err', 'mcc', 'wf']);
    expect(formsOfPat(patPush(e, { ok: true, help: false, day: '2026-10-07', t: 9, form: 'böse,form' }))).toEqual(['kwt', 'err', 'mcc', 'wf']);
    expect(formsOfPat(readPatEntry({ n: 1, f: 'a;b' }))).toEqual([]);
  });

  it('varyKinds: die zuletzt benutzte Art rückt ans Ende, ohne Verlauf bleibt die Reihenfolge, eine einzelne Art bleibt', () => {
    expect(varyKinds(['ocl', 'wf', 'kwt', 'reg'], [])).toEqual(['ocl', 'wf', 'kwt', 'reg']);
    expect(varyKinds(['ocl', 'wf', 'kwt', 'reg'], ['ocl'])).toEqual(['wf', 'kwt', 'reg', 'ocl']);
    expect(varyKinds(['ocl', 'wf', 'kwt', 'reg'], ['kwt', 'ocl'])).toEqual(['wf', 'reg', 'kwt', 'ocl']);
    expect(varyKinds(['mcc'], ['mcc'])).toEqual(['mcc']);
  });

  it('kindsFor wählt mit Verlauf nicht dieselbe Art zuerst, bleibt aber in der Stufe', () => {
    const a = kindsFor(0.5, 'desk', null, new Set(['ocl', 'wf', 'kwt', 'reg']));
    const b = kindsFor(0.5, 'desk', null, new Set(['ocl', 'wf', 'kwt', 'reg']), [a[0]!]);
    expect(b[0]).not.toBe(a[0]);
    expect([...b].sort()).toEqual([...a].sort());
  });
});
