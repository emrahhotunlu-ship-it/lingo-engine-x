import { describe, expect, it } from 'vitest';
import { toTrainCard } from '../../src/domain/srs/cards';
import { findContext, hasGapPlaceholder, senseFits } from '../../src/domain/srs/context';
import { buildExercise, cueMeaning, exTextKey } from '../../src/domain/srs/exercise';
import { gapUsable } from '../../src/domain/srs/gapFit';
import { availableExercises, makeEnv, supports } from '../../src/domain/srs/modes';
import { isFunctionGap } from '../../src/domain/srs/partner';
import { rotatedContext } from '../../src/domain/srs/rotate';
import type { TrainCard } from '../../src/domain/srs/types';
import { berlin } from './helpers';

// Nutzer-Sicht-Audit 12.10.2026: Aufgabe, Lücke, Hinweis und Lösung müssen zusammenpassen. Jede Klasse hat hier eine kleine, erfundene Karte.

const NOW = berlin('2026-10-12', 9);
type Doc = Record<string, unknown>;
const doc = (over: Doc = {}): Doc => ({ id: 'x', word: 'leverage', pos: 'noun', de: 'Hebelwirkung', def: 'the power to influence a result', ex: 'We use [leverage] in every price talk.', col: [], level: 'C1', state: 'review', S: 10, D: 5, last: NOW - 10 * 86_400_000, due: NOW - 1000, reps: 3, lapses: 0, modes: {}, order: 900, src: 'ai', added: '2026-08-01', stage: 4, hist: [], intro: '2026-08-01', ...over });
const card = (over: Doc = {}, stage = 4): TrainCard => ({ ...(toTrainCard(typeof over.id === 'string' ? over.id : 'x', doc(over), true, NOW) as TrainCard), stage: stage as TrainCard['stage'] });
const fill = (n = 6, over: (i: number) => Doc = () => ({})): TrainCard[] =>
  Array.from({ length: n }, (_, i) => card({ id: `p${i}`, word: `padword${i}`, de: `Füllwort ${i}`, def: `filler meaning number ${i}`, ex: `A [padword${i}] is here.`, pos: 'noun', ...over(i) }));
const KEYS = makeEnv(false, false, false);

describe('Lücke verdeckt genau das Wort der Karte (Klasse „beliebiges Objekt“, Rückmeldungen 1 und 2)', () => {
  const put = () => card({ id: 'put', word: 'to put something in writing', pos: 'phrase', de: 'schriftlich festhalten', def: 'to record in a document', ex: 'The manager asked the team to [put] the new timeline [in writing].', xEx: undefined });
  it('Satz mit Objekt mitten in der Wendung: keine getippte Lücke, keine Bausteine, kein Diktat; die Karte bleibt abfragbar', () => {
    const c = put();
    expect(c.context?.gap).toBe('put the new timeline in writing');
    expect(gapUsable(c.context, c.lemma)).toBe(false);
    for (const ex of ['cloze', 'cloze_hint', 'dictation', 'wordfam'] as const) expect(supports(c, ex, 'de', 8, makeEnv(true, true, false))).toBe(false);
    expect(supports(c, 'type', 'de', 8, KEYS)).toBe(true);
    expect(availableExercises({ ...c, stage: 4 }, 'de', 8, KEYS).length).toBeGreaterThan(0);
  });
  it('Zuordnen zeigt dann keinen Satz mit sechs verdeckten Wörtern, sondern die Bedeutung', () => {
    const c = put();
    const e = buildExercise({ ...c, stage: 2 }, 'match', 'de', [c, ...fill()], 's');
    expect(e.sentence).toBeNull();
    expect(e.accepted[0]).toContain('put something in writing');
  });
  it('Objekt am Ende („reassure someone“) bleibt eine gültige Lücke: nur das feste Wort wird verdeckt', () => {
    const c = card({ id: 'ra', word: 'to reassure someone', pos: 'verb', de: 'jemanden beruhigen', ex: 'Anna hopes to [reassure] the customer with a free workshop.' });
    expect(c.context?.gap).toBe('reassure');
    expect(supports(c, 'cloze', 'de', 8, KEYS)).toBe(true);
  });
  it('Wechselsätze mit beliebigem Objekt wechseln nicht mit', () => {
    const c = card({ id: 'ro', word: 'to roll something out', pos: 'phrase', de: 'etwas einführen', ex: 'They plan to [roll] the software [out] after the pilot.', xEx: [{ en: 'We will roll the new tool out in May.', t: 1 }, { en: 'Please roll out the plan.', t: 1 }] }, 4);
    // Ursprungssatz hat ein Objekt (3 Wörter in der Lücke gegen 2 feste), „roll out“ ohne Objekt ist brauchbar
    const ctx = rotatedContext(c, 'cloze');
    expect(ctx === null || gapUsable(ctx, c.lemma) || ctx.sentence === c.context?.sentence).toBe(true);
  });
  it('Das Kartenwort steht noch einmal sichtbar im Satz: keine Lücke', () => {
    const c = card({ id: 'pour', word: 'to pour', pos: 'verb', de: 'gießen', def: 'to make liquid flow', ex: 'Imagine [pouring] water into a bucket. You can pour faster and faster.' });
    expect(c.context?.gap).toBe('pouring');
    expect(gapUsable(c.context, c.lemma)).toBe(false);
    // Seit 25.10.2026 (Emrahs Meldung, `gapSentence.ts`) zeigt die Lücke nur den Satz der Lücke – das zweite „pour“ steht dann nicht mehr da.
    const e = buildExercise(c, 'cloze', 'de', [c, ...fill()], '2026-10-12|0');
    expect(e.sentence?.sentence).toBe('Imagine pouring water into a bucket.');
    expect(gapUsable(e.sentence, c.lemma)).toBe(true);
  });
});

describe('Beispielsätze sind sauber (Klasse „Bildschirmtext mit Deutsch“, Rückmeldung 5)', () => {
  it('Sprechername und Übersetzung ohne Leerzeichen angeklebt', () => {
    expect(hasGapPlaceholder('TomI used the October export. I think I was mistaken about the cutoff date.Ich habe den Oktober-Export benutzt.')).toBe(true);
    expect(hasGapPlaceholder('AnnaI hope to reassure you with a workshop next week.Ich hoffe, Sie mit einem Workshop nächste Woche zu beruhigen.')).toBe(true);
    expect(findContext('AnnaI hope to [reassure] you with a workshop next week.Ich hoffe, Sie zu beruhigen.', 'to reassure')).toBeNull();
  });
  it('normale Sätze bleiben: Abkürzungen, Einheiten, Markennamen, Namen mit Umlaut', () => {
    for (const s of ['She earned a PhD in the U.S. last year.', 'The iPhone needs 5 kW of power? No, it does not.', 'Mr. Müller said that the offer is fair.', 'We use LinkedIn and eBay every day.']) expect(hasGapPlaceholder(s)).toBe(false);
  });
});

describe('Satz passt zur Wortart der Karte (Klasse „Wortart“, Rückmeldung 6)', () => {
  const at = (s: string, w: string) => {
    const i = s.indexOf(w);
    return { sentence: s, start: i, end: i + w.length };
  };
  it('Nomen-Karte: kein Verb-Gebrauch, kein Partizip nach „was“', () => {
    expect(senseFits(at('The housing market has started to decline after years.', 'decline'), 'noun')).toBe(false);
    expect(senseFits(at('I think I was mistaken about the date.', 'mistaken'), 'noun')).toBe(false);
    expect(senseFits(at('We noticed a sharp decline in complaints.', 'decline'), 'noun')).toBe(true);
  });
  it('„to“ als Präposition vor einem Nomen ist in Ordnung', () => {
    expect(senseFits(at('Adaptation is the key to survival.', 'survival'), 'noun')).toBe(true);
    expect(senseFits(at('This leads to misery.', 'misery'), 'noun')).toBe(true);
  });
  it('Verb-Karte: kein Nomen-Gebrauch nach Artikel', () => {
    expect(senseFits(at('He was killed by a blunt weapon.', 'blunt'), 'verb')).toBe(false);
    expect(senseFits(at('Please blunt the edge first.', 'blunt'), 'verb')).toBe(true);
  });
  it('Verb-Karte: kein Partizip als Eigenschaftswort vor einem Nomen („Adjusted earnings“, Emrahs Meldung 25.10.2026)', () => {
    expect(senseFits(at('Adjusted earnings came to $1.08 per share.', 'Adjusted'), 'verb')).toBe(false);
    expect(senseFits(at('We did it with limited resources.', 'limited'), 'verb')).toBe(false);
    expect(senseFits(at('We adjusted the budget twice.', 'adjusted'), 'verb')).toBe(true);
    expect(senseFits(at('Checked the doors twice, she left.', 'Checked'), 'verb')).toBe(true);
    expect(senseFits(at('Signed by both parties, the contract is valid.', 'Signed'), 'verb')).toBe(true);
    expect(senseFits(at('Adjusted carefully, the chair fits.', 'Adjusted'), 'verb')).toBe(true);
  });
  it('Karte „mistake“ mit dem Satz „I was mistaken …“ bekommt diesen Satz nicht als Ursprungssatz, sondern einen passenden', () => {
    const c = card({ id: 'mistake', word: 'mistake', pos: 'noun', de: 'Fehler', ex: 'I think I was [mistaken] about the cutoff date.', xEx: [{ en: 'She admitted her mistake during the meeting.', t: 1 }] });
    expect(c.context?.sentence).toBe('She admitted her mistake during the meeting.');
  });
});

describe('Hinweis verrät die Lösung nicht (Klasse „Lehnwort“)', () => {
  it('deutsche Bedeutung: der Teil mit dem englischen Wort entfällt, solange ein anderer bleibt', () => {
    expect(cueMeaning({ lemma: 'nuance', word: 'nuance', def: 'a small difference' }, 'feiner Unterschied, Nuance')).toBe('feiner Unterschied');
    expect(cueMeaning({ lemma: 'pier', word: 'pier', def: null }, 'Anleger, Pier')).toBe('Anleger');
    expect(cueMeaning({ lemma: 'arrest', word: 'arrest', def: null }, 'Festnahme; Arrest')).toBe('Festnahme');
  });
  it('nur das Lehnwort: unverändert (nie ein leerer Hinweis)', () => {
    expect(cueMeaning({ lemma: 'dollar', word: 'dollar', def: null }, 'Dollar')).toBe('Dollar');
  });
  it('englische Definition mit dem Wort darin: das Wort wird zu „…“', () => {
    const def = 'turn a device on or off with a switch';
    expect(cueMeaning({ lemma: 'switch', word: 'to switch', def }, def)).toBe('turn a device on or off with a …');
  });
  it('die Übungen zeigen den bereinigten Hinweis; die richtige Option bleibt vollständig', () => {
    const c = card({ id: 'nuance', word: 'nuance', pos: 'noun', de: 'feiner Unterschied, Nuance', def: 'a small difference', ex: 'He noticed the [nuance] at once.' });
    const pool = [c, ...fill()];
    expect(buildExercise(c, 'cloze_hint', 'de', pool, 's').meaning).toBe('feiner Unterschied');
    expect(buildExercise(c, 'mc_en', 'de', pool, 's').options.find((o) => o.correct)?.label).toBe('feiner Unterschied');
  });
});

describe('Ablenker (Klassen „Sprache“ und „im Satz“)', () => {
  it('Englische Oberfläche: keine deutschen Bedeutungen als Optionen, wenn andere Karten eine englische haben', () => {
    const c = card({ id: 'e', word: 'bottleneck', de: 'Engpass', def: 'a point where flow is slowed', ex: 'This is a [bottleneck] for us.' });
    const noDef = fill(4, () => ({ def: '' }));
    const withDef = fill(5).map((p, i) => ({ ...p, id: `w${i}`, key: `vocab/w${i}`, lemma: `wd${i}`, word: `wd${i}` }));
    const e = buildExercise(c, 'mc_en', 'en', [c, ...noDef, ...withDef], 's');
    for (const o of e.options) expect(/[äöüß]|Füllwort/.test(o.label)).toBe(false);
    expect(e.options.every((o) => o.lang === 'en')).toBe(true);
  });
  it('Fehlt der Karte selbst die englische Bedeutung: alle Optionen deutsch (gleiche Sprache)', () => {
    const c = card({ id: 'e2', word: 'bottleneck', de: 'Engpass', def: '', ex: 'This is a [bottleneck] for us.' });
    const e = buildExercise(c, 'mc_en', 'en', [c, ...fill(6)], 's');
    expect(e.options.every((o) => o.lang === 'de')).toBe(true);
    expect(e.options.some((o) => /^[a-z ]+ number \d$/.test(o.label))).toBe(false);
  });
  it('Zuordnen im Satz: kein Ablenker, dessen Wort schon im Satz steht', () => {
    const c = card({ id: 'dec', word: 'decline', pos: 'noun', de: 'Rückgang', def: 'a fall in number', ex: 'We noticed a sharp [decline] in customer complaints.' }, 2);
    const inSentence = card({ id: 'cmp', word: 'complaint', pos: 'noun', de: 'Beschwerde', def: 'a statement of unhappiness', ex: 'A [complaint] arrived.' });
    const pool = [c, inSentence, ...fill(6)];
    for (let s = 0; s < 12; s++) {
      const e = buildExercise(c, 'match', 'de', pool, `s${s}`);
      expect(e.options.map((o) => o.label)).not.toContain('complaint');
    }
  });
});

describe('Aufgabentext passt zum Bildschirm (Klasse „Aufgabe nennt eine Lücke, die es nicht gibt“)', () => {
  it('Zuordnen ohne Satz heißt wie „Wort wählen“, mit Satz bleibt es „in die Lücke legen“', () => {
    expect(exTextKey({ ex: 'match', sentence: null })).toBe('mc_de');
    expect(exTextKey({ ex: 'match', sentence: { sentence: 'A b c.', start: 0, end: 1, gap: 'A' } })).toBe('match');
    expect(exTextKey({ ex: 'match' })).toBe('match');
  });
});

describe('Partner-Lücke (Klassen „Funktionswort“ und „ohne Hinweis“)', () => {
  it('Fragewörter sind keine Wortschatz-Lücke („figure out ___ to export“ ← how)', () => {
    for (const g of ['how', 'what', 'why', 'where', 'who', 'which', 'there']) expect(isFunctionGap(g)).toBe(true);
    expect(isFunctionGap('receipt')).toBe(false);
    expect(isFunctionGap('on')).toBe(false);
  });
});
