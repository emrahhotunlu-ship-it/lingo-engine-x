import { describe, expect, it } from 'vitest';
import { toTrainCard } from '../../src/domain/srs/cards';
import { buildExercise } from '../../src/domain/srs/exercise';
import { acceptPack, lastWasWrong, packWorthIt, packPatch, packUsedUp, packVerdict, pickSentence, readPack, repsOf, type Pack } from '../../src/domain/srs/pack';
import type { TrainCard } from '../../src/domain/srs/types';
import { wordJudge } from '../../src/prompts/wordJudge';
import { wordPrep } from '../../src/prompts/wordPrep';
import { wordJudgeReply, wordPrepReply } from '../../src/platform/dev/canned/wordPack';
import { TEMPLATES } from '../../src/prompts/registry';

// KI-Paket (docs/ki-paket-plan.md): Kartenpaket, Satzwechsel, Paket-Prüfung, KI-Urteil.

type Doc = Record<string, unknown>;
const card = (over: Doc = {}): TrainCard => {
  const c = toTrainCard('x', { word: 'reliable', de: 'zuverlässig', def: 'can be trusted', pos: 'adj', ex: 'Our supplier is [reliable].', state: 'review', S: 5, D: 5, reps: 6, last: 1, due: 2, stage: 4, ...over }, true, 1_790_000_000_000);
  if (!c) throw new Error('Karte');
  return c;
};

const RAW = {
  items: [
    { en: 'We need reliable figures before we commit to the rollout plan.', gap: 'reliable', ok: [], syn: [{ w: 'dependable', why: 'Passt auch, klingt aber etwas persönlicher.' }], why: 'reliable figures ist eine feste Verbindung im Geschäftsenglisch.' },
    { en: 'Our new partner has been very reliable during the migration project.', gap: 'reliable', ok: [], syn: [], why: 'Bei Partnern sagt man reliable für verlässlich.' },
    { en: 'My old car is not reliable anymore, so I take the train.', gap: 'reliable', ok: [], syn: [], why: '' },
    { en: 'This sentence does not contain the target at all, sadly.', gap: 'reliable', ok: [], syn: [], why: '' },
    { en: 'Our supplier is reliable.', gap: 'reliable', ok: [], syn: [], why: '' },
  ],
  dis: [{ w: 'reasonable', why: 'Bedeutet vernünftig, nicht zuverlässig.' }, { w: 'reliable', why: 'x' }, { w: 'relevant', why: 'Bedeutet wichtig für etwas.' }, { w: 'dependable', why: 'x' }],
};

describe('Kartenpaket: Annahme', () => {
  it('lässt nur Sätze mit dem Zielwort zu, nie den Ursprungssatz, keine Ablenker gleich Lösung oder Synonym', () => {
    const c = card();
    const p = acceptPack(RAW, c, 'de', { t: 5, r0: repsOf(c), prev: [] });
    expect(p).not.toBeNull();
    expect(p!.items.map((i) => i.en)).toHaveLength(3);
    expect(p!.items.every((i) => i.en.slice(i.at, i.at + i.gap.length) === i.gap)).toBe(true);
    expect(p!.dis.map((d) => d.w)).toEqual(['reasonable', 'relevant']);
    expect(p!.r0).toBe(6);
    expect(p!.prev).toHaveLength(3);
  });

  it('verwirft Erklärungen in der falschen Sprache (Sprachtreue)', () => {
    const c = card();
    const raw = { items: [{ ...RAW.items[0], why: 'This is a fixed combination in business English, very common.' }], dis: [] };
    const p = acceptPack(raw, c, 'de', { t: 1, r0: 0, prev: [] });
    expect(p!.items[0]!.why).toBe('');
  });

  it('liest gespeicherte Pakete tolerant; Unerwartetes ergibt null', () => {
    const c = card();
    const p = acceptPack(RAW, c, 'de', { t: 5, r0: 6, prev: [] })!;
    expect(readPack({ xPack: JSON.parse(JSON.stringify(p)) as unknown }, c)?.items).toHaveLength(3);
    expect(readPack({ xPack: 'kaputt' }, c)).toBeNull();
    expect(readPack({ xPack: { v: 2, items: [] } }, c)).toBeNull();
  });
});

describe('Kartenpaket: Satzwechsel', () => {
  const c = card();
  const pack = acceptPack(RAW, c, 'de', { t: 5, r0: 6, prev: [] }) as Pack;

  it('Ursprungssatz als Anker: neue Karte, Stufe ≤ 2, nach einem Fehler, Wiederholung in der Runde', () => {
    expect(pickSentence(card({ stage: 2 }), pack, 0, false).item).toBeNull();
    expect(pickSentence(c, pack, 0, true).item).toBeNull();
    const wrong = card({ hist: [{ t: 1, m: 'cloze', g: 1, x: 'cloze' }] });
    expect(lastWasWrong(wrong)).toBe(true);
    expect(pickSentence(wrong, pack, 0, false).item).toBeNull();
  });

  it('sonst jedes Mal ein anderer Paket-Satz, nie zweimal derselbe hintereinander', () => {
    const seen = [0, 1, 2].map((reps) => pickSentence(card({ reps: 6 + reps }), pack, 0, false).item?.en);
    expect(new Set(seen).size).toBe(3);
    expect(pickSentence(c, pack, 1, false).item?.en).not.toBe(pickSentence(c, pack, 0, false).item?.en);
  });

  it('neues Paket, sobald alle Sätze gelaufen sind', () => {
    expect(packUsedUp(pack, 10)).toBe(false);
    expect(packUsedUp(pack, 11)).toBe(true);
    expect(packUsedUp(null, 0)).toBe(true);
  });

  it('neue Karten und Stufe 1 bekommen noch kein Paket (Anker im Ursprungssatz)', () => {
    expect(packWorthIt(card({ stage: 1 }))).toBe(false);
    expect(packWorthIt(card({ state: 'new', stage: 0 }))).toBe(false);
    expect(packWorthIt(card({ stage: 2 }))).toBe(true);
    expect(packWorthIt(card({ hidden: true }))).toBe(false);
  });

  it('ohne Paket bleibt alles wie bisher', () => {
    expect(pickSentence(c, null, 0, false)).toEqual({ span: c.context, item: null });
  });
});

describe('Kartenpaket: Prüfung und Übung', () => {
  const c = card();
  const pack = acceptPack(RAW, c, 'de', { t: 5, r0: 6, prev: [] }) as Pack;
  const item = pack.items[0]!;

  it('passendes Synonym aus dem Paket → fast richtig mit Unterschied', () => {
    expect(packVerdict('dependable', item)).toEqual({ kind: 'syn', alt: item.syn[0] });
    expect(packVerdict('Dependable ', item)?.kind).toBe('syn');
    expect(packVerdict('reasonable', item)).toBeNull();
  });

  it('Lücke mit Paket-Satz: Satz und Lösung aus dem Paket, Ursprungssatz bleibt an der Karte', () => {
    const pick = pickSentence(card({ reps: 6 }), pack, 0, false);
    const e = buildExercise(c, 'cloze', 'de', [c], 'd|0', { context: pick.span, pack: { item: pick.item, dis: pack.dis, lang: 'de' } });
    expect(e.sentence?.sentence).toBe(pick.item?.en);
    expect(e.sentence && e.sentence.sentence.slice(e.sentence.start, e.sentence.end)).toBe('reliable');
    expect(e.card.context?.sentence).toBe('Our supplier is reliable.');
    expect(e.pack?.item?.en).toBe(pick.item?.en);
  });

  it('Zuordnen mit Paket-Satz nimmt die Ablenker des Pakets samt „warum nicht"', () => {
    const pick = pickSentence(card({ reps: 6 }), pack, 0, false);
    const e = buildExercise(c, 'match', 'de', [c], 'd|0', { context: pick.span, pack: { item: pick.item, dis: pack.dis, lang: 'de' } });
    const wrong = e.options.filter((o) => !o.correct);
    expect(wrong.map((o) => o.label).sort()).toEqual(['reasonable', 'relevant']);
    expect(wrong.every((o) => !!o.why)).toBe(true);
  });

  it('Patch: legt an, ersetzt nur das erwartete Paket, nie Unerwartetes', () => {
    expect(packPatch({ word: 'x' }, pack, null)).toEqual({ xPack: pack });
    expect(packPatch({ xPack: { t: 5 } }, pack, 5)).toEqual({ xPack: pack });
    expect(packPatch({ xPack: { t: 7 } }, pack, 5)).toBeNull();
    expect(packPatch({ xPack: 'kaputt' }, pack, 5)).toBeNull();
    expect(packPatch(undefined, pack, null)).toBeNull();
  });
});

describe('Vorlagen word-prep@1 und word-judge@1', () => {
  it('sind registriert, Kopfzeile stimmt, feste Antworten bestehen das Schema', () => {
    expect(TEMPLATES.some((t) => t.id === 'word-prep')).toBe(true);
    expect(TEMPLATES.some((t) => t.id === 'word-judge')).toBe(true);
    const prepVars = { cards: [{ word: 'reliable', pos: 'adj', meaning: 'zuverlässig', sentence: 'Our supplier is reliable.', collocs: [], avoid: [], kind: 'word' as const }], uiLang: 'de' as const };
    const prompt = wordPrep.build(prepVars);
    expect(prompt.startsWith('[word-prep@1]')).toBe(true);
    const out = wordPrep.schema(prepVars).parse(JSON.parse(wordPrepReply(prompt)));
    const p = acceptPack(out.cards[0], card(), 'de', { t: 1, r0: 0, prev: [] });
    expect(p?.items.length).toBe(4);

    const jv = { target: 'current', pos: 'adj', meaning: 'aktuell', sentence: 'Our ___ contract runs until June.', expected: 'current', given: 'actual', task: 'gap' as const, uiLang: 'de' as const };
    const jp = wordJudge.build(jv);
    expect(jp.startsWith('[word-judge@1]')).toBe(true);
    const j = wordJudge.schema(jv).parse(JSON.parse(wordJudgeReply(jp)));
    expect(j).toMatchObject({ verdict: 'wrong', trap: true });
    expect(j.why).toMatch(/falscher Freund/);
  });

  it('word-judge liest Urteile tolerant und lehnt die falsche Erklärungssprache ab', () => {
    const jv = { target: 'persuade', pos: 'verb', meaning: 'überzeugen', sentence: 'We ___ the client.', expected: 'persuaded', given: 'convinced', task: 'gap' as const, uiLang: 'de' as const };
    const s = wordJudge.schema(jv);
    expect(s.parse({ verdict: 'Also possible', why: 'Passt auch, beschreibt aber eher eine Meinung.', example: null, trap: 'false' })).toMatchObject({ verdict: 'synonym', example: '', trap: false });
    expect(s.safeParse({ verdict: 'wrong', why: 'This word does not fit here because it means something else entirely.', example: '', trap: false }).success).toBe(false);
  });

  it('word-prep: einzelne kaputte Karten fallen weg, die Hülle bleibt gültig', () => {
    const v = { cards: [], uiLang: 'de' as const };
    const out = wordPrep.schema(v).parse({ cards: [{ i: '0', items: [] }, { nope: true }] });
    expect(out.cards).toEqual([{ i: 0, items: [], dis: [], cwhy: undefined }]);
    expect(wordPrep.schema(v).safeParse({ cards: [] }).success).toBe(false);
  });
});
