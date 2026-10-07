// c1x-Wertung (Lernplattform 3.0 P12, P16, P17): jede Lösungsvariante = Höchstpunktzahl, jede falsche Fassung darunter,
// Teilpunkte, Gründe, Eigenschaftstests über Beispiele, Pilot und LP2-Adapter.
import { describe, expect, it } from 'vitest';
import examples from '../fixtures/c1x/examples.json';
import pilotKwt from '../../src/content/c1x/src/pilot/kwt.json';
import pilotErr from '../../src/content/c1x/src/pilot/err.json';
import { c1Item } from '../../src/domain/c1x/schema';
import { legacyV2Items } from '../../src/domain/c1x/legacyV2';
import { isFull, maxOf, scoreC1 } from '../../src/domain/c1x/score';
import { solutionsOf, wrongsOf } from '../../src/domain/c1x/solutions';
import type { C1Item, Kwt } from '../../src/domain/c1x/types';

const parse = (raw: unknown): C1Item => c1Item.parse(raw);
const fixtures = (examples.items as unknown[]).map(parse);
const pilot = [...pilotKwt.items, ...pilotErr.items].map(parse);
const legacy = legacyV2Items();
const get = (id: string): C1Item => fixtures.find((i) => i.id === id) as C1Item;
const kwt = (id: string): Kwt => get(id) as Kwt;

describe('Eigenschaften über alle Inhalte', () => {
  const all: Array<[string, C1Item]> = [...fixtures, ...pilot, ...legacy].map((i) => [i.id, i]);

  it.each(all)('%s: jede Lösung = Höchstpunktzahl, voll richtig', (_id, item) => {
    const sols = solutionsOf(item);
    expect(sols.length).toBeGreaterThan(0);
    for (const s of sols) {
      const r = scoreC1(item, s);
      expect(r.got, JSON.stringify(s)).toBe(r.max);
      expect(r.verdict, JSON.stringify(s)).toBe('correct');
      expect(isFull(r)).toBe(true);
    }
  });

  it.each(all)('%s: jede falsche Fassung bleibt unter der Höchstpunktzahl', (_id, item) => {
    for (const w of wrongsOf(item)) {
      const r = scoreC1(item, w);
      expect(r.got, JSON.stringify(w)).toBeLessThan(r.max);
      expect(isFull(r)).toBe(false);
    }
  });

  it('der LP2-Adapter wandelt jede heutige kwt- und find-Aufgabe (ohne meaning)', () => {
    expect(legacy.length).toBe(904);
    expect(legacy.filter((i) => i.kind === 'kwt')).toHaveLength(397);
    expect(legacy.filter((i) => i.kind === 'err')).toHaveLength(503);
    expect(new Set(legacy.map((i) => i.id)).size).toBe(legacy.length);
    expect(legacy.filter((i) => i.kind === 'err' && !i.bad)).toHaveLength(124);
  });
});

describe('kwt (Teil 4)', () => {
  it('Teilpunkte: nur Teil A 1/2, nur Teil B 1/2, beides 2/2', () => {
    const k = kwt('kwt-0001');
    expect(scoreC1(k, { kind: 'kwt', text: 'is said to be' }).got).toBe(2);
    const a = scoreC1(k, { kind: 'kwt', text: 'is said that it is' });
    expect(a.got).toBe(1);
    expect(a.parts).toEqual([{ id: 'a', ok: true }, { id: 'b', ok: false }]);
    expect(a.verdict).toBe('near');
    const b = scoreC1(k, { kind: 'kwt', text: 'was said to be' });
    expect(b.got).toBe(1);
    expect(b.parts).toEqual([{ id: 'a', ok: false }, { id: 'b', ok: true }]);
  });

  it('7 Wörter = 0 mit length; Schlüsselwort verändert (SAYS statt SAID) = 0 mit key', () => {
    const k = kwt('kwt-0001');
    const seven = scoreC1(k, { kind: 'kwt', text: 'is said to be going to be' });
    expect(seven).toMatchObject({ got: 0, reason: 'length' });
    expect(scoreC1(k, { kind: 'kwt', text: 'is says to be' })).toMatchObject({ got: 0, reason: 'key' });
    expect(scoreC1(k, { kind: 'kwt', text: 'is to be' })).toMatchObject({ got: 0, reason: 'key' });
    expect(scoreC1(k, { kind: 'kwt', text: 'is said' })).toMatchObject({ got: 0, reason: 'length' });
  });

  it("wish I'd checked = 2/2, wish I would have checked = Falle", () => {
    const k = kwt('kwt-0002');
    expect(scoreC1(k, { kind: 'kwt', text: "wish I'd checked" })).toMatchObject({ got: 2, verdict: 'correct' });
    expect(scoreC1(k, { kind: 'kwt', text: 'WISH I had checked.' }).got).toBe(2);
    const trap = scoreC1(k, { kind: 'kwt', text: 'wish I would have checked' });
    expect(trap.got).toBeLessThan(2);
    expect(trap).toMatchObject({ trap: 0, reason: 'trap' });
  });

  it('beste ganze Variante: Teile verschiedener Varianten werden nie gemischt', () => {
    const k: Kwt = { ...kwt('kwt-0003'), keys: [{ a: ['due to'], b: ['the supplier’s failure'] }, { a: ['owing to'], b: ['a supplier failure'] }] };
    expect(scoreC1(k, { kind: 'kwt', text: 'owing to a supplier failure' }).got).toBe(2);
    expect(scoreC1(k, { kind: 'kwt', text: 'due to the supplier’s failure' }).got).toBe(2);
    // Teil A der einen Variante, Teil B der anderen: nur ein Teil zählt.
    expect(scoreC1(k, { kind: 'kwt', text: 'due to a supplier failure' }).got).toBe(1);
    expect(scoreC1(k, { kind: 'kwt', text: 'owing to the supplier’s failure' }).got).toBe(1);
  });

  it('die Falle mit 7 Wörtern bleibt 0 mit length, zeigt aber ihren Index', () => {
    const r = scoreC1(kwt('kwt-0003'), { kind: 'kwt', text: 'due to the failure of the supplier' });
    expect(r).toMatchObject({ got: 0, reason: 'length', trap: 0 });
  });

  it('frei nur bei getipptem Anteil', () => {
    const k = kwt('kwt-0001');
    expect(scoreC1(k, { kind: 'kwt', text: 'is said to be' }).free).toBe(false);
    expect(scoreC1(k, { kind: 'kwt', text: 'is said to be', typed: true }).free).toBe(true);
  });

  it('LP2-Adapter: erlaubte Wortzahl aus der Aufgabe, Schlüsselwort Pflicht', () => {
    const k = legacy.find((i) => i.id === 'kwt-v2-1') as Kwt;
    expect(k.words).toBeDefined();
    expect(scoreC1(k, { kind: 'kwt', text: 'as a' }).got).toBe(2);
    expect(scoreC1(k, { kind: 'kwt', text: 'a' })).toMatchObject({ got: 0, reason: 'key' });
  });
});

describe('err (Fehler finden)', () => {
  it('Fundort + Korrektur 2/2, nur Fundort 1/2, falsches Wort 0', () => {
    const e = get('err-0001');
    // „I'm really looking forward to hear from you.“ → hear = Wort 5 (0-basiert)
    expect(scoreC1(e, { kind: 'err', tap: 5, fix: 'hearing', typed: true })).toMatchObject({ got: 2, free: true });
    expect(scoreC1(e, { kind: 'err', tap: 5, fix: 'heard' })).toMatchObject({ got: 1, verdict: 'near', free: false });
    expect(scoreC1(e, { kind: 'err', tap: 5 }).got).toBe(1);
    expect(scoreC1(e, { kind: 'err', tap: 2, fix: 'hearing' }).got).toBe(0);
  });

  it('mehrwortige Fehlerstelle: jedes Wort der Spanne ist ein Treffer', () => {
    const e = get('err-0002'); // „…me where do we store the backups.“, Spanne „do we store“
    for (const tap of [5, 6, 7]) expect(scoreC1(e, { kind: 'err', tap, fix: 'we store' }).got, `tap ${tap}`).toBe(2);
    expect(scoreC1(e, { kind: 'err', tap: 4, fix: 'we store' }).got).toBe(0);
  });

  it('fehlerfreier Satz: „Kein Fehler“ = 2/2, jedes Wort = 0 mit falseAlarm', () => {
    const e = get('err-0003');
    expect(scoreC1(e, { kind: 'err', tap: 'none' })).toMatchObject({ got: 2, verdict: 'correct' });
    expect(scoreC1(e, { kind: 'err', tap: 1 })).toMatchObject({ got: 0, reason: 'falseAlarm' });
  });

  it('Fehler übersehen = 0 mit missed', () => {
    expect(scoreC1(get('err-0001'), { kind: 'err', tap: 'none' })).toMatchObject({ got: 0, reason: 'missed' });
  });

  it('britische Korrektur gilt, US-Hinweis kommt mit', () => {
    const e: C1Item = { ...(get('err-0001')), bad: { span: 'hear', fix: ['organize'], choices: ['organize', 'organized', 'organizing'] } } as C1Item;
    const r = scoreC1(e, { kind: 'err', tap: 5, fix: 'organise', typed: true });
    expect(r).toMatchObject({ got: 2, us: 'organize' });
  });

  it('LP2-Adapter: Streichen (`fix: ""`) nur bei ausdrücklich leerer Korrektur', () => {
    const del = legacy.find((i) => i.kind === 'err' && i.bad && i.bad.fix[0] === '');
    expect(del).toBeDefined();
    if (del?.kind !== 'err' || !del.bad) return;
    const tap = del.text.split(/\s+/).findIndex((w) => w.replace(/[^\w']/g, '').toLowerCase() === del.bad?.span.split(' ')[0]?.replace(/[^\w']/g, '').toLowerCase());
    expect(scoreC1(del, { kind: 'err', tap, fix: '' }).got).toBe(2);
    expect(scoreC1(del, { kind: 'err', tap }).got).toBe(1);
  });
});

describe('ocl, wf, mcc', () => {
  it('ocl: Lösung 1/1, Chip 0, Tippfehler bei kurzen Wörtern falsch, bei längeren „Fast“', () => {
    const o = get('ocl-0003'); // whose
    expect(scoreC1(o, { kind: 'ocl', text: 'Whose' })).toMatchObject({ got: 1, free: true });
    expect(scoreC1(o, { kind: 'ocl', text: 'which' })).toMatchObject({ got: 0, verdict: 'wrong' });
    expect(scoreC1(o, { kind: 'ocl', text: 'wose' })).toMatchObject({ got: 0, verdict: 'near', reason: 'typo' });
    const had = get('ocl-0001'); // had (3 Buchstaben: kein Tippfehler-Budget)
    expect(scoreC1(had, { kind: 'ocl', text: 'hed' }).verdict).toBe('wrong');
    expect(scoreC1(had, { kind: 'ocl', text: '' }).verdict).toBe('wrong');
  });

  it('wf: Familienmitglied = 0 mit family, falsches Affix = falsch, Tippfehler = Fast', () => {
    const w = get('wf-0002'); // unprecedented
    expect(scoreC1(w, { kind: 'wf', text: 'unprecedented' }).got).toBe(1);
    expect(scoreC1(w, { kind: 'wf', text: 'precedent' })).toMatchObject({ got: 0, reason: 'family', verdict: 'wrong' });
    expect(scoreC1(w, { kind: 'wf', text: 'inprecedented' }).verdict).toBe('wrong');
    expect(scoreC1(w, { kind: 'wf', text: 'unprecedeted' })).toMatchObject({ verdict: 'near', reason: 'typo' });
  });

  it('wf: britische Schreibweise gilt, US-Form als Hinweis', () => {
    const w = parse({ ...(get('wf-0001') as object), accept: ['organization'], family: ['organize', 'organization'], stem: 'ORGANIZE', text: 'The ___ was founded in 1990.', pos: 'noun' });
    expect(scoreC1(w, { kind: 'wf', text: 'organisation' })).toMatchObject({ got: 1, us: 'organization' });
  });

  it('mcc: nur die richtige Wahl, nie frei', () => {
    const m = get('mcc-0001');
    expect(scoreC1(m, { kind: 'mcc', pick: 2 })).toMatchObject({ got: 1, max: 1, free: false });
    expect(scoreC1(m, { kind: 'mcc', pick: 0 })).toMatchObject({ got: 0, verdict: 'wrong' });
  });
});

describe('pair, cnet, reg, para', () => {
  it('pair: je Verbindung 1 Punkt, am Laptop mit Transfer 3', () => {
    const p = get('pair-0001');
    expect(scoreC1(p, { kind: 'pair', links: [0, 1] })).toMatchObject({ got: 2, max: 2, free: false });
    expect(scoreC1(p, { kind: 'pair', links: [0, 2] })).toMatchObject({ got: 1, verdict: 'near' });
    expect(scoreC1(p, { kind: 'pair', links: [0, 1], transfer: 'sending' })).toMatchObject({ got: 3, max: 3 });
    expect(scoreC1(p, { kind: 'pair', links: [0, 1], transfer: 'to send' })).toMatchObject({ got: 2, max: 3 });
    expect(scoreC1(p, { kind: 'pair', links: [null, null] }).got).toBe(0);
  });

  it('cnet: max(0, h − f), höchstens R; Hälfte = near', () => {
    const c = get('cnet-0001'); // right: meet miss extend set; wrong: hold keep fulfill; also make
    const R = ['meet', 'miss', 'extend', 'set'];
    expect(scoreC1(c, { kind: 'cnet', picks: R })).toMatchObject({ got: 4, max: 4, verdict: 'correct' });
    expect(scoreC1(c, { kind: 'cnet', picks: [...R, 'hold'] })).toMatchObject({ got: 3, verdict: 'near' });
    expect(scoreC1(c, { kind: 'cnet', picks: ['meet', 'miss'] })).toMatchObject({ got: 2, verdict: 'near' });
    expect(scoreC1(c, { kind: 'cnet', picks: ['meet'] })).toMatchObject({ got: 1, verdict: 'wrong' });
    expect(scoreC1(c, { kind: 'cnet', picks: ['hold', 'keep'] })).toMatchObject({ got: 0, verdict: 'wrong' });
    expect(scoreC1(c, { kind: 'cnet', picks: [...R, 'make'] }).verdict).toBe('correct');
  });

  it('reg: Chips je Abschnitt; Laptop: Satz aus answers = voll, nur Abschnitte erfüllt = unsure', () => {
    const r = get('reg-0003');
    expect(scoreC1(r, { kind: 'reg', picks: ['discuss', 'the issues regarding'] })).toMatchObject({ got: 2, max: 2, free: false });
    expect(scoreC1(r, { kind: 'reg', picks: ['discuss', 'the troubles with'] }).got).toBe(1);
    expect(scoreC1(r, { kind: 'reg', text: 'We need to discuss the issues with the rollout.' })).toMatchObject({ got: 2, free: true, verdict: 'correct' });
    const partial = scoreC1(r, { kind: 'reg', text: 'We have to discuss the issues with the rollout today.' });
    expect(partial).toMatchObject({ got: 2, verdict: 'near', reason: 'unsure' });
    expect(scoreC1(r, { kind: 'reg', text: 'We need to talk about the problems with the rollout.' }).got).toBe(0);
  });

  it('para: Auswahl 1 Punkt; Laptop 2 Punkte, ähnlicher Satz = nicht sicher prüfbar', () => {
    const p = get('para-0002');
    expect(scoreC1(p, { kind: 'para', pick: 3 })).toMatchObject({ got: 1, max: 1 });
    expect(scoreC1(p, { kind: 'para', text: 'Only after the audit did we notice the gap.' })).toMatchObject({ got: 2, max: 2, free: true });
    expect(scoreC1(p, { kind: 'para', text: 'Only after the audit did we notice a gap.' })).toMatchObject({ got: 0, verdict: 'near', reason: 'unsure' });
    expect(scoreC1(p, { kind: 'para', text: 'Only the audit noticed the gap afterwards.' }).verdict).toBe('wrong');
  });
});

describe('Verteiler', () => {
  it('eine Antwort der falschen Art zählt als nicht gegeben', () => {
    const r = scoreC1(get('mcc-0001'), { kind: 'ocl', text: 'x' });
    expect(r).toMatchObject({ got: 0, verdict: 'wrong' });
  });
  it('maxOf nennt die übliche Höchstpunktzahl', () => {
    expect(maxOf(get('kwt-0001'))).toBe(2);
    expect(maxOf(get('mcc-0001'))).toBe(1);
    expect(maxOf(get('cnet-0001'))).toBe(4);
    expect(maxOf(get('reg-0003'))).toBe(2);
  });
});
