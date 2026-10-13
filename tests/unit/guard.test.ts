import { beforeEach, describe, expect, it } from 'vitest';
import { toTrainCard } from '../../src/domain/srs/cards';
import { buildExercise } from '../../src/domain/srs/exercise';
import { checkExercise, fallbackChain, guardedExercise, guardStats, reportViolations, resetGuardLog, MAX_TRIES } from '../../src/domain/srs/guard';
import type { GuardRule } from '../../src/domain/srs/guard';
import { CATALOG, makeEnv, supports } from '../../src/domain/srs/modes';
import type { Colloc, Exercise, ExerciseId, Lang, Option, TrainCard } from '../../src/domain/srs/types';
import { getLog } from '../../src/platform/diagnostics';
import { berlin, loadSeed } from './helpers';

// Wächter (Q1/Q5, 12.10.2026): je Regel R1–R12 eine fehlerhafte und eine gute Aufgabe mit kleinen, erfundenen Karten; dazu der Rückfall
// und eine Eigenschaftsprüfung über die erfundenen Karten der Testdaten.

const NOW = berlin('2026-10-12', 9);
type Doc = Record<string, unknown>;
const doc = (over: Doc = {}): Doc => ({ id: 'x', word: 'leverage', pos: 'noun', de: 'Hebelwirkung', def: 'the power to influence a result', ex: 'We use [leverage] in every price talk.', col: [], level: 'C1', state: 'review', S: 10, D: 5, last: NOW - 10 * 86_400_000, due: NOW - 1000, reps: 3, lapses: 0, modes: {}, order: 900, src: 'ai', added: '2026-08-01', stage: 4, hist: [], intro: '2026-08-01', ...over });
const card = (over: Doc = {}, stage = 4): TrainCard => ({ ...(toTrainCard(typeof over.id === 'string' ? over.id : 'x', doc(over), true, NOW) as TrainCard), stage: stage as TrainCard['stage'] });
const fill = (n = 8): TrainCard[] =>
  Array.from({ length: n }, (_, i) => card({ id: `p${i}`, word: `padword${i}`, de: `Füllwort ${i}`, def: `filler meaning number ${i}`, ex: `A [padword${i}] is here.`, pos: 'noun' }));
const build = (c: TrainCard, ex: ExerciseId, lang: Lang = 'de', stage?: number): Exercise => buildExercise(stage ? { ...c, stage: stage as TrainCard['stage'] } : c, ex, lang, [c, ...fill()], 'seed');
const rules = (e: Exercise, c: TrainCard, lang: Lang = 'de'): GuardRule[] => [...new Set(checkExercise(e, c, lang).map((v) => v.rule))];
const opt = (label: string, correct = false, lang: Lang = 'en', fromMeaning?: string): Option => ({ id: correct ? 'ok' : label, label, lang, correct, ...(fromMeaning ? { fromMeaning } : {}) });
const col = (over: Partial<Colloc> = {}): Colloc => ({ index: 0, p: 'tackle a problem', de: 'ein Problem angehen', gap: 'problem', opts: ['problem', 'mood', 'weather'], ctx: null, ...over });
const span = (sentence: string, gap: string) => ({ sentence, start: sentence.indexOf(gap), end: sentence.indexOf(gap) + gap.length, gap });

beforeEach(() => resetGuardLog());

describe('Gute Aufgaben bestehen den Wächter', () => {
  it('Lücke, Auswahl und Bedeutung einer sauberen Karte: keine Verstöße', () => {
    const c = card();
    for (const ex of ['cloze', 'cloze_hint', 'tiles', 'match', 'mc_de', 'mc_en', 'ctx_mc', 'type'] as const) {
      for (const lang of ['de', 'en'] as const) expect(checkExercise(build(c, ex, lang), c, lang), `${ex}/${lang}`).toEqual([]);
    }
  });
});

describe('R1 – Lücke passt zu den festen Wörtern der Karte', () => {
  const c = card({ id: 'put', word: 'to put something in writing', pos: 'phrase', de: 'schriftlich festhalten', def: 'to record in a document', ex: 'The manager asked the team to [put] the new timeline [in writing].' });
  it('Lücke verdeckt ein beliebiges Objekt: Verstoß', () => {
    const e: Exercise = { ...build(c, 'cloze'), sentence: c.context, accepted: [c.context!.gap] };
    expect(rules(e, c)).toContain('R1');
  });
  it('Lücke nur am festen Wort: kein Verstoß', () => {
    const ok = card({ id: 'ra', word: 'to reassure someone', pos: 'verb', de: 'jemanden beruhigen', ex: 'Anna hopes to [reassure] the customer.' });
    expect(rules(build(ok, 'cloze'), ok)).toEqual([]);
  });
});

describe('R2 – Lösung aus dem Sichtbaren ableitbar', () => {
  it('Zahl oder Name in der Lücke, Lücke ohne Hinweis, fehlende Lösung: Verstoß', () => {
    const c = card({ id: 'fy', word: 'fiscal year', pos: 'noun', ex: 'The [fiscal year] ends in March.' });
    expect(rules({ ...build(c, 'cloze'), sentence: span('We met in 2024 again.', '2024'), accepted: ['2024'] }, c)).toContain('R2');
    expect(rules({ ...build(card(), 'cloze'), meaning: null }, card())).toContain('R2');
    expect(rules({ ...build(card(), 'cloze'), accepted: [''] }, card())).toContain('R2');
  });
  it('Wortpartner-Lücke ohne Bedeutung der Wendung (englische Oberfläche): Verstoß; mit Hinweis nicht', () => {
    const c = card({ id: 'tk', word: 'tackle', pos: 'verb', de: 'angehen', ex: 'Let us [tackle] this issue today.' });
    const e: Exercise = { ...build(c, 'cloze'), ex: 'colloc_gap', input: 'choice', colloc: col(), sentence: span('Let us tackle this ___ today.'.replace('___', 'issue'), 'issue'), accepted: ['issue'], options: [opt('issue', true), opt('mood'), opt('weather')] };
    expect(rules(e, c, 'en')).toContain('R2');
    expect(rules(e, c, 'de')).not.toContain('R2');
  });
});

describe('R3 – Lösung gehört zur Karte und zur Lücke', () => {
  it('Lösung ohne Form des Kartenworts: Verstoß; britische Form und unregelmäßige Form nicht', () => {
    const c = card();
    expect(rules({ ...build(c, 'cloze'), sentence: span('We bought a car.', 'bought'), accepted: ['bought'] }, c)).toContain('R3');
    const dig = card({ id: 'dg', word: 'digitalization', ex: 'Full [digitalisation] is hard.' });
    expect(rules(build(dig, 'cloze'), dig)).toEqual([]);
    const oc = card({ id: 'oc', word: 'to overcome', pos: 'verb', de: 'überwinden', ex: 'She [overcame] her fear.' });
    expect(rules(build(oc, 'cloze'), oc)).toEqual([]);
  });
  it('Partner-Lösung weicht von der Lücke im Satz ab: Verstoß', () => {
    const c = card({ id: 'tk', word: 'tackle', pos: 'verb', de: 'angehen', ex: 'Let us [tackle] this issue today.' });
    const e: Exercise = { ...build(c, 'cloze'), ex: 'colloc_gap', input: 'choice', colloc: col(), sentence: span('Let us tackle this issue today.', 'issue'), accepted: ['problem'], options: [opt('problem', true), opt('mood'), opt('weather')] };
    expect(rules(e, c)).toContain('R3');
  });
});

describe('R4 – nichts verraten', () => {
  it('Kartenwort steht außerhalb der Lücke noch einmal im Satz: Verstoß', () => {
    const c = card({ id: 'pour', word: 'to pour', pos: 'verb', de: 'gießen', ex: 'Imagine [pouring] water. You can pour faster.' });
    const e = { ...build(c, 'cloze'), sentence: c.context, accepted: [c.context!.gap] };
    expect(rules(e, c)).toContain('R4');
  });
  it('Hinweis enthält das gesuchte Wort: Verstoß', () => {
    const c = card({ id: 'ln', word: 'to leverage', pos: 'verb', de: 'leverage nutzen', ex: 'We [leverage] our brand.' });
    expect(rules({ ...build(c, 'cloze'), meaning: 'leverage nutzen' }, c)).toContain('R4');
  });
  it('Partner-Lösung steht im Hinweis oder im Satz; richtige Option doppelt: Verstoß', () => {
    const c = card({ id: 'tk', word: 'tackle', pos: 'verb', de: 'angehen', ex: 'Let us [tackle] this problem today.' });
    const base: Exercise = { ...build(c, 'cloze'), ex: 'colloc_gap', input: 'choice', colloc: col({ de: 'ein Problem angehen' }), sentence: span('Let us tackle this problem today.', 'problem'), accepted: ['problem'], options: [opt('problem', true), opt('mood'), opt('weather')] };
    expect(rules(base, c)).toContain('R4');
    const rest: Exercise = { ...base, colloc: col({ de: 'angehen' }), sentence: span('A problem: let us tackle this problem today.', 'problem') };
    expect(rules({ ...rest, sentence: { ...rest.sentence!, start: 'A problem: let us tackle this '.length, end: 'A problem: let us tackle this problem'.length } }, c)).toContain('R4');
    const dup: Exercise = { ...build(card(), 'mc_en'), options: [opt('Hebelwirkung', true, 'de'), opt('Hebelwirkung', false, 'de'), opt('Tisch', false, 'de')] };
    expect(rules(dup, card())).toContain('R4');
  });
});

describe('R5 – Ablenker eindeutig falsch', () => {
  const c = card({ id: 'wd', word: 'widely', pos: 'adv', de: 'weithin', ex: 'It is [widely] known that this works.' });
  const sent = span('It is widely known that this works.', 'widely');
  const e = (opts: Option[], over: Partial<Exercise> = {}): Exercise => ({ ...build(c, 'cloze'), ex: 'match', input: 'choice', sentence: sent, accepted: ['widely'], options: opts, ...over });
  it('Ablenker = Lösung, Form der Lösung, steht im Satz, im Nachbarwort belegt, Synonym: Verstoß', () => {
    expect(rules(e([opt('widely', true), opt('Widely'), opt('far'), opt('vastly')]), c)).toContain('R5');
    expect(rules(e([opt('widely', true), opt('known'), opt('far'), opt('vastly')]), c)).toContain('R5');
    const c2 = { ...c, doc: { ...c.doc, ex: 'It is wide known. We did.' } };
    expect(rules(e([opt('widely', true), opt('wide'), opt('far'), opt('vastly')]), c2)).toContain('R5');
    const syn = e([opt('widely', true), opt('far', false, 'en', 'weithin'), opt('vastly'), opt('narrowly')]);
    expect(rules(syn, c)).toContain('R5');
    const m = { ...build(card(), 'mc_en'), options: [opt('Hebelwirkung', true, 'de'), opt('Hebelwirkung, Einfluss', false, 'de'), opt('Tisch', false, 'de')] };
    expect(rules(m, card())).toContain('R5');
  });
  it('saubere Ablenker: kein Verstoß', () => {
    expect(rules(e([opt('widely', true), opt('far'), opt('vastly'), opt('narrowly')]), c)).toEqual([]);
  });
});

describe('R6 – Wortart des Satzes passt zur Karte', () => {
  it('Nomen-Karte im Satz als Verb: Verstoß; Wortfamilie mit gleicher Wortart: Verstoß', () => {
    const c = card({ id: 'dc', word: 'decline', pos: 'noun', de: 'Rückgang', ex: 'We noticed a sharp [decline] in sales.' });
    const bad = { ...build(c, 'cloze'), sentence: span('The housing market has started to decline after years.', 'decline'), accepted: ['decline'] };
    expect(rules(bad, c)).toContain('R6');
    expect(rules(build(c, 'cloze'), c)).toEqual([]);
    expect(rules({ ...build(c, 'cloze'), ex: 'wordfam', famFrom: { pos: 'noun', word: 'decay' } }, c)).toContain('R6');
  });
});

describe('R7 – Satz sauber', () => {
  it('Deutsch, Bedienzeichen, verklebt, Platzhalter, zu lang: Verstoß; Namen mit Umlaut nicht', () => {
    const c = card();
    for (const s of ['We use leverage und das ist nicht gut.', 'We use leverage ✓ today in sales.', 'We use leverage.Next sentence follows.', 'We use leverage __ here.', `We use leverage ${'and more '.repeat(35)}today.`]) {
      expect(rules({ ...build(c, 'cloze'), sentence: span(s, 'leverage'), accepted: ['leverage'] }, c), s).toContain('R7');
    }
    expect(rules({ ...build(c, 'cloze'), sentence: span('Mr. Müller said we use leverage in talks.', 'leverage'), accepted: ['leverage'] }, c)).toEqual([]);
  });
});

describe('R8 – keine Funktionswort-Lücke', () => {
  it('Lücke auf einem Funktionswort: Verstoß', () => {
    const c = card();
    expect(rules({ ...build(c, 'cloze'), sentence: span('We use leverage and tools.', 'and'), accepted: ['and'] }, c)).toContain('R8');
    const tk = card({ id: 'tk', word: 'tackle', pos: 'verb', de: 'angehen', ex: 'Let us [tackle] this issue.' });
    const e: Exercise = { ...build(tk, 'cloze'), ex: 'colloc_gap', input: 'choice', colloc: col(), sentence: span('Let us tackle this issue if possible.', 'if'), accepted: ['if'], options: [opt('if', true), opt('mood'), opt('weather')] };
    expect(rules(e, tk)).toContain('R8');
  });
});

describe('R9 – Hinweis meint das Wort in der Lücke', () => {
  const tk = card({ id: 'gu', word: 'give up', pos: 'phrasal verb', de: 'aufgeben', ex: 'They [give up] too early.' });
  const e = (c: Colloc, sentence: string, gap: string): Exercise => ({ ...build(tk, 'cloze'), ex: 'colloc_gap', input: 'choice', colloc: c, sentence: span(sentence, gap), accepted: [gap], options: [opt(gap, true), opt('in'), opt('for'), opt('at')] });
  it('Hinweis = Bedeutung des Kartenworts statt der Wendung: Verstoß', () => {
    expect(rules(e(col({ p: 'give up on', de: 'aufgeben', gap: 'on' }), 'She refused to give up on the account.', 'on'), tk)).toContain('R9');
    expect(rules(e(col({ p: 'give up on', de: 'jemanden aufgeben, Hoffnung verlieren', gap: 'on' }), 'She refused to give up on the account.', 'on'), tk)).not.toContain('R9');
  });
  it('Satz zeigt eine andere Wendung als die geübte: Verstoß', () => {
    expect(rules(e(col({ p: 'surrender completely', de: 'sich völlig ergeben', gap: 'on' }), 'She refused to give up on the account.', 'on'), tk)).toContain('R9');
  });
});

describe('R10 – Aufdeck-Karte: Vorder- und Rückseite passen zusammen', () => {
  it('ohne Bedeutung vorn oder ohne Wort hinten: Verstoß; sonst nicht', () => {
    const c = card();
    const flip = build(c, 'flip');
    expect(rules(flip, c)).toEqual([]);
    expect(rules({ ...flip, meaning: null }, c)).toContain('R10');
    expect(rules({ ...flip, accepted: [''] }, c)).toContain('R10');
  });
  it('englische Vorderseite verrät das Wort: Verstoß', () => {
    const c = card({ id: 'gr', word: 'grounded', pos: 'adj', def: 'grounded means being firmly rooted', de: 'bodenständig', ex: 'She is [grounded].' });
    expect(rules({ ...build(c, 'flip', 'en'), meaning: 'grounded means being firmly rooted' }, c, 'en')).toContain('R10');
  });
});

describe('R11 – Sprachtreue', () => {
  it('Optionen in gemischten Sprachen: Verstoß; Rückfall komplett in einer Sprache nicht', () => {
    const c = card();
    const mixed = { ...build(c, 'mc_en'), options: [opt('Hebelwirkung', true, 'de'), opt('the power to push', false, 'en'), opt('Tisch', false, 'de')] };
    expect(rules(mixed, c)).toContain('R11');
    const noDef = card({ id: 'nd', def: null });
    const e = build(noDef, 'mc_en', 'en');
    expect(checkExercise(e, noDef, 'en').filter((v) => v.rule === 'R11')).toEqual([]);
  });
  it('englische Oberfläche mit deutscher Bedeutung, obwohl eine englische Definition da ist: Verstoß', () => {
    const c = card();
    expect(rules({ ...build(c, 'cloze', 'en'), meaning: 'Hebelwirkung für Müller' }, c, 'en')).toContain('R11');
  });
});

describe('R12 – Optionen', () => {
  it('weniger als 3 Optionen, keine oder zwei richtige, doppelte Optionen: Verstoß', () => {
    const c = card();
    const mc = build(c, 'mc_en');
    expect(rules({ ...mc, options: mc.options.slice(0, 2) }, c)).toContain('R12');
    expect(rules({ ...mc, options: mc.options.map((o) => ({ ...o, correct: false })) }, c)).toContain('R12');
    expect(rules({ ...mc, options: mc.options.map((o) => ({ ...o, correct: true })) }, c)).toContain('R12');
    const w = build(c, 'mc_de');
    const o2 = w.options.filter((o) => !o.correct);
    expect(rules({ ...w, options: [...w.options, { ...(o2[0] as Option), id: 'dd' }] }, c)).toContain('R12');
  });
  it('Kontrast mit zwei Optionen ist in Ordnung', () => {
    const c = card({ id: 'ct', word: 'affect', pos: 'verb', de: 'beeinflussen', ex: 'Bad weather [affects] my mood.' });
    const e: Exercise = { ...build(c, 'cloze'), ex: 'contrast', input: 'choice', meaning: null, sentence: span('The new rule will effect change.', 'effect'), options: [opt('effect', true), opt('affect')], accepted: ['effect'] };
    expect(checkExercise(e, c, 'de').filter((v) => v.rule === 'R12')).toEqual([]);
  });
});

describe('Rückfall: eine durchgefallene Aufgabe wird nie gezeigt', () => {
  const bad = () => card({ id: 'put', word: 'to put something in writing', pos: 'phrase', de: 'schriftlich festhalten', def: 'to record in a document', ex: 'The manager asked the team to [put] the new timeline [in writing].' });
  it('Warteschlange wählt eine andere Art, die den Wächter besteht, und protokolliert einmal je Karte × Art × Regel', () => {
    const c = card({ id: 'ln', word: 'to leverage', pos: 'verb', de: 'leverage nutzen', def: 'to use something to the greatest effect', ex: 'We [leverage] our brand.' }, 4);
    const pool = [c, ...fill()];
    const env = makeEnv(false, false, false);
    const e = guardedExercise(c, 'mc_de', 'de', pool, 's', {}, env);
    expect(checkExercise(e, c, 'de')).toEqual([]);
    expect(guardStats().blocked).toBeGreaterThan(0);
    expect(e.ex).not.toBe('mc_de');
    const before = getLog().filter((l) => l.scope === 'guard').length;
    guardedExercise(c, 'mc_de', 'de', pool, 's', {}, env);
    expect(getLog().filter((l) => l.scope === 'guard').length).toBe(before);
    expect(getLog().filter((l) => l.scope === 'guard').every((l) => (l.detail ?? '').startsWith('card=') && !(l.detail ?? '').includes('We '))).toBe(true);
  });
  it('gleiche Eingabe, gleiches Ergebnis; höchstens MAX_TRIES Versuche; am Ende `type`', () => {
    const c = card({ id: 'ln', word: 'to leverage', pos: 'verb', de: 'leverage nutzen', ex: 'We [leverage] our brand.' });
    const pool = [c, ...fill()];
    const a = guardedExercise(c, 'cloze', 'de', pool, 's');
    const b = guardedExercise(c, 'cloze', 'de', pool, 's');
    expect(b).toEqual(a);
    expect(a.ex).not.toBe('cloze');
    expect(a.ex === 'type' || checkExercise(a, c, 'de').length === 0).toBe(true);
    expect(MAX_TRIES).toBeLessThanOrEqual(6);
    expect(fallbackChain(c, 'cloze', 'de', pool.length - 1, makeEnv(true, true, false))).not.toContain('type');
  });
  it('Karte, deren Satz als Lücke nicht taugt, bekommt nie eine verletzende Lücke', () => {
    const c = bad();
    for (const ex of ['cloze', 'cloze_hint', 'match', 'dictation', 'tiles'] as const) {
      const e = guardedExercise(c, ex, 'de', [c, ...fill()], 's', {}, makeEnv(true, true, false));
      expect(reportViolations(e, c, 'de'), ex).toEqual([]);
    }
  });
});

describe('Eigenschaft über die erfundenen Testkarten: was den Wächter besteht, hat keinen Verstoß', () => {
  it('alle Stufen, Touch/Tastatur, DE/EN, drei Startwerte', () => {
    const seed = loadSeed();
    const cards = Object.entries(seed)
      .filter(([p]) => p.startsWith('vocab/'))
      .map(([p, d]) => toTrainCard(p.slice(6), d, true, NOW))
      .filter((c): c is TrainCard => c !== null);
    expect(cards.length).toBeGreaterThan(100);
    let shown = 0;
    let swapped = 0;
    for (const card0 of cards.filter((_, i) => i % 2 === 0)) {
      for (const touch of [false, true]) {
        const env = makeEnv(true, true, touch);
        for (const lang of ['de', 'en'] as const) {
          for (const stage of [1, 2, 3, 4, 5] as const) {
            const c = { ...card0, stage };
            for (const d of CATALOG) {
              if (!supports(c, d.ex, lang, cards.length - 1, env)) continue;
              const e = guardedExercise(c, d.ex, lang, cards, 'prop|1', {}, env);
              shown++;
              if (e.ex !== d.ex) swapped++;
              if (e.ex !== 'type') expect(checkExercise(e, c, lang), `${c.id} ${d.ex}->${e.ex} ${lang}`).toEqual([]);
            }
          }
        }
      }
    }
    expect(shown).toBeGreaterThan(1000);
    expect(swapped).toBeLessThan(shown);
  }, 120_000);
});
