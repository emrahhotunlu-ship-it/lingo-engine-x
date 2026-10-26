import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { heldUnitRows, releaseUnitOp, unitHeld } from '../../src/domain/lexicon/unitHeld';
import { phraseShape } from '../../src/domain/lexicon/unitKnown';
import { toTrainCard } from '../../src/domain/srs/cards';
import { buildExercise, shapeScore } from '../../src/domain/srs/exercise';
import { newVocabDoc, saveCardOp } from '../../src/domain/srs/newCard';
import { matchesFilter } from '../../src/domain/srs/vocabList';
import type { TrainCard } from '../../src/domain/srs/types';
import { checkCardUnit, singleWordOf } from '../../src/features/lookup/unitCheck';
import { useCapabilities } from '../../src/platform/capabilities';
import { lexicalUnitCheck } from '../../src/prompts/lexicalUnitCheck';
import { sampleFile } from '../../src/domain/tutor/quality';

// Kartenqualität (26.10.2026, Emrahs Meldung „adaptive attempts“): Sperre beim Speichern, ruhende Lesekarten, Ablenker nach Bauform.

const askJson = vi.hoisted(() => vi.fn());
vi.mock('../../src/ai/gate', () => ({ askJson }));

type Doc = Record<string, unknown>;
const NOW = Date.UTC(2026, 9, 26, 10);
const D = 86_400_000;
const SENTENCE = 'The model was jailbroken across 15 adaptive attempts.';

const card = (word: string, de: string, over: Doc = {}): Doc => ({
  word,
  de,
  ex: `They talked about [${word}] at the meeting today.`,
  state: 'review',
  stage: 3,
  S: 4,
  D: 5,
  due: NOW - D,
  last: NOW - 3 * D,
  reps: 4,
  src: 'lookup',
  ...over,
});

describe('Bauform (phraseShape) und Ablenker', () => {
  it('erkennt die Bauformen aus Emrahs Meldung', () => {
    expect(phraseShape('adaptive attempts')).toEqual({ n: 2, kind: 'adj-noun' });
    expect(phraseShape('adaptive attacks')).toEqual({ n: 2, kind: 'adj-noun' });
    expect(phraseShape('keep up with')).toEqual({ n: 3, kind: 'phrasal' });
    expect(phraseShape('come to terms with').kind).toBe('verb-led');
    expect(phraseShape('digitalization')).toEqual({ n: 1, kind: 'w-noun' });
    expect(phraseShape('to close a deal').kind).toBe('verb-led');
  });

  it('shapeScore: gleiche Bauform vor gleicher Wortzahl, Einzelwort gegen Gruppe abgewertet', () => {
    const adjNoun = phraseShape('adaptive attacks');
    expect(shapeScore(adjNoun, phraseShape('hostile takeover'))).toBeGreaterThan(shapeScore(adjNoun, phraseShape('keep up with')));
    expect(shapeScore(adjNoun, phraseShape('keep up with'))).toBeGreaterThan(shapeScore(adjNoun, phraseShape('digitalization')));
  });

  it('„Welches englische Wort passt?“ zu einer Adjektiv-Nomen-Gruppe zeigt Adjektiv-Nomen-Gruppen als Ablenker', () => {
    const docs: Array<[string, Doc]> = [
      ['adaptive-attacks', card('adaptive attacks', 'adaptive Angriffe')],
      ['keep-up-with', card('keep up with', 'mithalten mit')],
      ['digitalization', card('digitalization', 'Digitalisierung')],
      ['come-to-terms-with', card('come to terms with', 'sich abfinden mit')],
      ['hostile-takeover', card('hostile takeover', 'feindliche Übernahme')],
      ['sudden-outage', card('sudden outage', 'plötzlicher Ausfall')],
      ['steep-decline', card('steep decline', 'starker Rückgang')],
      ['negotiate', card('negotiate', 'verhandeln', { pos: 'verb' })],
    ];
    const pool = docs.map(([id, d]) => toTrainCard(id, d, true, NOW)).filter((c): c is TrainCard => !!c);
    const target = pool.find((c) => c.word === 'adaptive attacks') as TrainCard;
    for (const seed of ['a', 'b', 'c', 'd']) {
      const ex = buildExercise(target, 'mc_de', 'de', pool, seed);
      const wrong = (ex.options ?? []).filter((o) => !o.correct).map((o) => o.label);
      expect(wrong, seed).toHaveLength(3);
      for (const w of wrong) expect(phraseShape(w), `${seed}: ${w}`).toEqual({ n: 2, kind: 'adj-noun' });
    }
  });
});

describe('ruhende Lesekarten (unitHeld)', () => {
  it('ruht nur eine Lesekarte mit freier Gruppe ohne Freigabe', () => {
    expect(unitHeld(card('adaptive attempts', 'adaptive Versuche', { src: 'read' }))?.verdict).toBe('check');
    expect(unitHeld(card('adaptive attacks', 'adaptive Angriffe', { src: 'read' }))).toBeNull();
    expect(unitHeld(card('come to terms with', 'sich abfinden mit', { src: 'read' }))).toBeNull();
    expect(unitHeld(card('adaptive attempts', 'adaptive Versuche', { src: 'lookup' }))).toBeNull();
    expect(unitHeld(card('adaptive attempts', 'adaptive Versuche', { src: 'read', lu: { ok: true, by: 'user', t: NOW } }))).toBeNull();
  });

  it('toTrainCard: ruhend = verborgen und `held`, die Karte bleibt unverändert; Filter „Ausgeblendet“ zeigt sie nicht', () => {
    const d = card('adaptive attempts', 'adaptive Versuche', { src: 'read' });
    const before = JSON.stringify(d);
    const c = toTrainCard('adaptive-attempts', d, true, NOW) as TrainCard;
    expect(c.hidden).toBe(true);
    expect(c.held).toBe(true);
    expect(JSON.stringify(d)).toBe(before);
    expect(matchesFilter(c, 'hidden', NOW)).toBe(false);
    const free = toTrainCard('adaptive-attacks', card('adaptive attacks', 'adaptive Angriffe', { src: 'read' }), true, NOW) as TrainCard;
    expect(free.hidden).toBe(false);
    expect(free.held).toBeUndefined();
  });

  it('heldUnitRows listet ruhende Karten mit üblicher Fassung, sampleFile trägt sie mit', () => {
    const rows = heldUnitRows([
      { path: 'vocab/adaptive-attempts', doc: card('adaptive attempts', 'adaptive Versuche', { src: 'read' }) },
      { path: 'vocab/adaptive-attacks', doc: card('adaptive attacks', 'adaptive Angriffe', { src: 'read' }) },
    ]);
    expect(rows.map((r) => r.word)).toEqual(['adaptive attempts']);
    expect(rows[0]?.better).toBe('adaptive attacks');
    const body = JSON.parse(sampleFile(NOW, [], [], null, rows).data) as { heldUnits?: unknown[] };
    expect(body.heldUnits).toHaveLength(1);
  });

  it('„Doch lernen“ ergänzt nur `lu`, einmal; ungültige Karten bleiben unberührt', () => {
    const d = card('adaptive attempts', 'adaptive Versuche', { src: 'read' });
    expect(releaseUnitOp('vocab/adaptive-attempts', d, NOW)).toEqual({ update: { lu: { ok: true, by: 'user', t: NOW } } });
    expect(releaseUnitOp('vocab/adaptive-attempts', { ...d, lu: { ok: true, by: 'user', t: NOW } }, NOW)).toBeNull();
    expect(releaseUnitOp('vocab/adaptive-attempts', undefined, NOW)).toBeNull();
    expect(releaseUnitOp('vocab/x', { word: 42 }, NOW)).toBeNull();
  });
});

describe('Speichern mit Vermerk (newVocabDoc/saveCardOp)', () => {
  const input = {
    word: 'plausible trajectory',
    de: 'plausibler Verlauf',
    ex: 'Analysts see a plausible trajectory for prices.',
    surface: 'plausible trajectory',
    src: 'read' as const,
    origin: { v: 1 as const, kind: 'read' as const, t: NOW },
    today: '2026-10-26',
  };

  it('neue Karte trägt `lu`', () => {
    const made = newVocabDoc({ ...input, lu: { ok: true, by: 'claude', t: NOW } });
    expect(made?.doc.lu).toEqual({ ok: true, by: 'claude', t: NOW });
  });

  it('bestehende Karte ohne Vermerk bekommt ihn ergänzt, sonst nichts überschrieben', () => {
    const made = newVocabDoc({ ...input, lu: { ok: true, by: 'claude', t: NOW } });
    if (!made) throw new Error('keine Karte');
    const cur = { ...made.doc };
    delete cur.lu;
    const op = saveCardOp(cur, made);
    expect(op && 'update' in op ? op.update.lu : null).toEqual({ ok: true, by: 'claude', t: NOW });
    expect(saveCardOp({ ...cur, lu: { ok: true, by: 'user', t: 1 } }, made)).toBeNull();
  });
});

describe('lexical-unit-check@1 (Schema)', () => {
  const schema = lexicalUnitCheck.schema({ phrase: 'adaptive attempts', sentence: SENTENCE, uiLang: 'de' });
  it('liest die Beispielantwort und räumt `better` auf', () => {
    expect(schema.parse({ isUnit: false, better: 'adaptive attacks', why: 'Das ist eine freie Verbindung, üblich ist eine andere Wendung.' })).toEqual({
      isUnit: false,
      better: 'adaptive attacks',
      why: 'Das ist eine freie Verbindung, üblich ist eine andere Wendung.',
    });
    expect(schema.parse({ isUnit: 'false', better: 'none', why: 'Das ist eine freie Verbindung ohne feste Bedeutung.' }).better).toBeNull();
    expect(schema.parse({ isUnit: true, better: 'adaptive attacks', why: 'Das ist eine feste Verbindung im Fachgebiet.' }).better).toBeNull();
    expect(schema.parse({ isUnit: false, better: 'Adaptive Attempts', why: 'Das ist eine freie Verbindung ohne feste Bedeutung.' }).better).toBeNull();
  });
  it('fordert eine Begründung', () => {
    expect(schema.safeParse({ isUnit: false, better: null, why: '' }).success).toBe(false);
  });
  it('Prompt nennt Gruppe und Satz, verrät keine Lösung einer Übung', () => {
    const p = lexicalUnitCheck.build({ phrase: 'adaptive attempts', sentence: SENTENCE, uiLang: 'en' });
    expect(p).toContain('Word group: adaptive attempts');
    expect(p).toContain(SENTENCE);
  });
});

describe('checkCardUnit (Sperre vor dem Speichern)', () => {
  beforeEach(() => askJson.mockReset());
  afterEach(() => useCapabilities.setState({ sample: 'absent', sampleRevoked: false }));

  it('feste Einheit und Einzelwort: kein Aufruf, speichern', async () => {
    useCapabilities.setState({ sample: 'ready', sampleRevoked: false });
    expect(await checkCardUnit({ word: 'come to terms with', sentence: SENTENCE, uiLang: 'de', src: 'read' })).toEqual({ kind: 'ok' });
    expect(await checkCardUnit({ word: 'adaptive attacks', sentence: SENTENCE, uiLang: 'de', src: 'read' })).toEqual({ kind: 'ok' });
    expect(await checkCardUnit({ word: 'jailbroken', sentence: SENTENCE, uiLang: 'de', src: 'read' })).toEqual({ kind: 'ok' });
    expect(await checkCardUnit({ word: 'adaptive attempts', sentence: SENTENCE, uiLang: 'de', src: 'lookup' })).toEqual({ kind: 'ok' });
    expect(askJson).not.toHaveBeenCalled();
  });

  it('ohne Claude entscheidet die Regel: freie Gruppe wird nicht gespeichert, übliche Fassung und Einzelwort als Ausweg', async () => {
    useCapabilities.setState({ sample: 'absent', sampleRevoked: false });
    const d = await checkCardUnit({ word: 'adaptive attempts', sentence: SENTENCE, uiLang: 'de', src: 'read' });
    expect(d.kind).toBe('not_unit');
    if (d.kind !== 'not_unit') return;
    expect(d.by).toBe('rule');
    expect(d.better).toBe('adaptive attacks');
    // „adaptive“ steht weder im Wörterbuch noch im Atlas: ohne gesicherte Bedeutung kein Einzelwort-Ausweg (lieber gar keine Karte).
    expect(d.single).toBeNull();
    expect(askJson).not.toHaveBeenCalled();
  });

  it('mit Claude: „keine Einheit“ → nicht speichern; „Einheit“ → speichern mit Vermerk', async () => {
    useCapabilities.setState({ sample: 'ready', sampleRevoked: false });
    askJson.mockResolvedValueOnce({ data: { isUnit: false, better: 'adaptive attacks', why: 'Freie Verbindung.' } });
    const no = await checkCardUnit({ word: 'adaptive attempts', sentence: SENTENCE, uiLang: 'de', src: 'read' });
    expect(no).toMatchObject({ kind: 'not_unit', by: 'claude', better: 'adaptive attacks', why: 'Freie Verbindung.' });
    askJson.mockResolvedValueOnce({ data: { isUnit: true, better: null, why: 'Feste Verbindung.' } });
    const yes = await checkCardUnit({ word: 'plausible trajectory', sentence: 'Analysts see a plausible trajectory for prices.', uiLang: 'de', src: 'read' });
    expect(yes).toMatchObject({ kind: 'ok', lu: { ok: true, by: 'claude' } });
    expect(askJson).toHaveBeenCalledTimes(2);
  });

  it('Fehler von Claude: Regel entscheidet, kein zweiter Versuch', async () => {
    useCapabilities.setState({ sample: 'ready', sampleRevoked: false });
    askJson.mockRejectedValueOnce(new Error('boom'));
    const d = await checkCardUnit({ word: 'adaptive attempts', sentence: SENTENCE, uiLang: 'de', src: 'read' });
    expect(d).toMatchObject({ kind: 'not_unit', by: 'rule' });
    expect(askJson).toHaveBeenCalledTimes(1);
  });

  it('singleWordOf nimmt nur Wörter, die im Satz stehen und Gewicht haben', () => {
    expect(singleWordOf('robust safeguards', 'The lab added robust safeguards.')).toMatchObject({ word: 'safeguard', surface: 'safeguards' });
    expect(singleWordOf('adapt to unfamiliar hardware', 'Engineers had to adapt to unfamiliar hardware.')?.word).toBe('adapt');
    expect(singleWordOf('robust safeguards', 'Nothing here.')).toBeNull();
    expect(singleWordOf('adaptive attempts', SENTENCE)).toBeNull();
  });
});
