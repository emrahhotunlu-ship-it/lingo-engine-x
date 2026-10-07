// c1x-Schema (Lernplattform 3.0 P12): die 27 Beispiele sind gültig, jede Mutation ist ungültig, die Inhaltsprüfung greift.
import { describe, expect, it } from 'vitest';
import examples from '../fixtures/c1x/examples.json';
import { c1Item, c1File } from '../../src/domain/c1x/schema';
import { checkC1Content } from '../../src/domain/c1x/checkContent';
import { defaultCheckCtx } from '../../src/domain/c1x/checkContext';
import { C1_KINDS, type C1Item } from '../../src/domain/c1x/types';

const items = examples.items as unknown as Record<string, unknown>[];
const ctx = defaultCheckCtx();

describe('Beispiele', () => {
  it('es gibt 27 Beispiele, drei je Art', () => {
    expect(items).toHaveLength(27);
    for (const k of C1_KINDS) expect(items.filter((i) => i.kind === k)).toHaveLength(3);
    expect(c1File.safeParse(examples).success).toBe(true);
  });

  it.each(items.map((i) => [String(i.id), i] as const))('%s ist schemagültig und besteht die Inhaltsprüfung', (_id, raw) => {
    const r = c1Item.safeParse(raw);
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    expect(checkC1Content(r.data as C1Item, ctx)).toEqual([]);
  });
});

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('Mutationen sind ungültig', () => {
  const mutate: Array<[string, (o: Record<string, unknown>) => void]> = [
    ['id ohne Art-Präfix', (o) => (o.id = 'x-0001')],
    ['unbekannte Art', (o) => (o.kind = 'zzz')],
    ['pat ohne Punkt', (o) => (o.pat = 'nopoint')],
    ['level unbekannt', (o) => (o.level = 'A1')],
    ['dom unbekannt', (o) => (o.dom = 'both')],
    ['why ohne ok', (o) => delete (o.why as Record<string, unknown>).ok],
    ['trap-Format', (o) => (o.trap = 'x1')],
    ['probe false', (o) => (o.probe = false)],
  ];
  for (const k of C1_KINDS) {
    const base = items.find((i) => i.kind === k) as Record<string, unknown>;
    it.each(mutate)(`${k}: %s`, (_n, fn) => {
      const o = clone(base);
      fn(o);
      expect(c1Item.safeParse(o).success).toBe(false);
    });
  }

  it('artspezifische Mutationen', () => {
    const get = (id: string) => clone(items.find((i) => i.id === id) as Record<string, unknown>);
    const bad = (o: unknown) => expect(c1Item.safeParse(o).success).toBe(false);
    const mcc = get('mcc-0001');
    bad({ ...mcc, options: (mcc.options as string[]).slice(0, 3) });
    bad({ ...mcc, answer: 4 });
    bad({ ...mcc, text: 'No gap here at all in this sentence.' });
    bad({ ...mcc, text: 'Two ___ gaps ___ here.' });
    const ocl = get('ocl-0001');
    bad({ ...ocl, accept: ['has a'] });
    bad({ ...ocl, chips: ['did', 'have'] });
    const kwt = get('kwt-0001');
    bad({ ...kwt, key: 'said' });
    bad({ ...kwt, keys: [] });
    const err = get('err-0001');
    bad({ ...err, bad: { span: 'hear', fix: [] } });
    const wf = get('wf-0001');
    bad({ ...wf, stem: 'overwhelm' });
    const cnet = get('cnet-0001');
    bad({ ...cnet, right: (cnet.right as unknown[]).slice(0, 2) });
  });
});

describe('Inhaltsprüfung (checkC1Content) findet, was zod nicht ausdrückt', () => {
  const get = (id: string): C1Item => clone(items.find((i) => i.id === id) as unknown as C1Item);

  it('Muster und Thema müssen existieren und zusammenpassen', () => {
    const a = get('mcc-0001');
    expect(checkC1Content({ ...a, pat: 'prp.gibts-nicht' }, ctx).join()).toContain('gibt es im Thema');
    expect(checkC1Content({ ...a, topic: 'nonsense' }, ctx).join()).toContain('47 Themen');
    expect(checkC1Content({ ...a, topic: undefined }, ctx).join()).toContain('ohne topic');
    expect(checkC1Content({ ...a, area: 'lex' }, ctx).join()).toContain('lx.');
  });

  it('mcc: jede falsche Option braucht eine Begründung, Optionen verschieden, Lösung nicht im Satz', () => {
    const a = get('mcc-0001');
    if (a.kind !== 'mcc') throw new Error();
    a.why.wrong = a.why.wrong.slice(1);
    expect(checkC1Content(a, ctx).join()).toContain('ohne Begründung');
    const b = get('mcc-0001');
    if (b.kind !== 'mcc') throw new Error();
    b.options = [b.options[0], b.options[0], b.options[2], b.options[3]];
    expect(checkC1Content(b, ctx).join()).toContain('nicht alle verschieden');
    const c = get('mcc-0001');
    if (c.kind !== 'mcc') throw new Error();
    c.text = 'The delay was largely attributed to a shortage of qualified staff ___ today.';
    expect(checkC1Content(c, ctx).join()).toContain('schon im Satz');
  });

  it('kwt: Schlüsselwort, Wortzahl, Bausteine, Ablenker, Fallen, Teil A', () => {
    const k = get('kwt-0001');
    if (k.kind !== 'kwt') throw new Error();
    expect(checkC1Content({ ...k, tiles: ['is', 'to'] }, ctx).join()).toContain('tiles');
    expect(checkC1Content({ ...k, extra: ['was', 'to'] }, ctx).join()).toContain('extra');
    expect(checkC1Content({ ...k, keys: [{ a: ['is'], b: ['to be'] }] }, ctx).join()).toContain('Schlüsselwort');
    expect(checkC1Content({ ...k, keys: [{ a: ['is said'], b: ['to be seen as to be'] }] }, ctx).join()).toContain('Wörter (3–6)');
    expect(checkC1Content({ ...k, lead: 'The company is said to be planning to move its headquarters now.' }, ctx).join()).toContain('Schlüsselwort');
    expect(checkC1Content({ ...k, traps: ['is said to be'] }, ctx).join()).toContain('volle Punkte');
    expect(checkC1Content({ ...k, traps: ['is said what'] }, ctx).join()).toContain('ohne Begründung');
    expect(checkC1Content({ ...k, keys: [{ a: ['it is probably said'], b: ['to be'] }] }, ctx).join()).toContain('Teil A');
    expect(checkC1Content({ ...k, words: [1, 6] }, ctx).join()).toContain('words nur');
  });

  it('err: Spanne im Satz, genau eine gültige Wahl, fehlerfreie Sätze brauchen kein bad', () => {
    const e = get('err-0001');
    if (e.kind !== 'err' || !e.bad) throw new Error();
    expect(checkC1Content({ ...e, bad: { ...e.bad, span: 'listen' } }, ctx).join()).toContain('kommt');
    expect(checkC1Content({ ...e, bad: { ...e.bad, choices: ['hearing', 'hearing ', 'heard'] } }, ctx).join()).toBeTruthy();
    expect(checkC1Content({ ...e, bad: { ...e.bad, choices: ['heard', 'have heard', 'hears'] } }, ctx).join()).toContain('fix[0]');
    expect(checkC1Content(get('err-0003'), ctx)).toEqual([]);
  });

  it('cnet/para/reg: Begründung je falscher Wahl, Listen ohne Überschneidung, Anfang der Antworten', () => {
    const c = get('cnet-0001');
    if (c.kind !== 'cnet') throw new Error();
    c.why.wrong = c.why.wrong.slice(1);
    expect(checkC1Content(c, ctx).join()).toContain('ohne Begründung');
    const c2 = get('cnet-0001');
    if (c2.kind !== 'cnet') throw new Error();
    c2.also = [{ w: 'meet', note: { de: 'x', en: 'y' } }];
    expect(checkC1Content(c2, ctx).join()).toContain('right/also');
    const p = get('para-0001');
    if (p.kind !== 'para') throw new Error();
    expect(checkC1Content({ ...p, start: 'Because of' }, ctx).join()).toContain('beginnt nicht');
    const r = get('reg-0001');
    if (r.kind !== 'reg') throw new Error();
    expect(checkC1Content({ ...r, answers: ['We got your email and we will get back to you soon.'] }, ctx).join()).toContain('erfüllt Abschnitt');
  });

  it('britische Schreibweise wird abgelehnt', () => {
    const a = get('ocl-0001');
    if (a.kind !== 'ocl') throw new Error();
    expect(checkC1Content({ ...a, text: 'Hardly ___ we organised the contract when the client asked for changes.' }, ctx).join()).toContain('britische');
  });
});
