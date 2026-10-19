import { describe, expect, it } from 'vitest';
import { allSeedTasks } from '../../src/domain/grammar/tasks';
import { droppedFehlersaetze, dueFehlersaetze } from '../../src/domain/repair/fehlersaetze';
import { fehlersatzProblem, gapHintOf } from '../../src/domain/repair/quality';
import { repairCards } from '../../src/domain/repair/variant';
import { berlin } from './helpers';

// Paket FK: Ausschlussregeln beim LESEN der Fehlersätze (nie löschen). Beispiele stammen aus Emrahs echtem Export (15.10.2026).

describe('Ausschlussregeln (fehlersatzProblem)', () => {
  it('Dopplung des Satzteils („If we If we has chosen …“) wird ausgeblendet', () => {
    expect(
      fehlersatzProblem({ wrong: 'If we If we has chosen the smaller package, the upfront cost would be lower. the smaller package, the upfront cost would be lower.', right: 'If we chose the smaller package, the upfront cost would be lower.' }),
    ).toBe('doubled');
    expect(fehlersatzProblem({ wrong: 'I I read this book for three weeks, but I still haven\'t finishing it.', right: 'I have been reading this book for three weeks, but I still haven\'t finished it.' })).toBe('doubled');
  });
  it('Einzelwort oder Wendung („to overcome“) ist kein Satz', () => {
    expect(fehlersatzProblem({ wrong: 'to overcome', right: 'I need to overcome my fear of public speaking.', src: 'write' })).toBe('short');
    expect(fehlersatzProblem({ wrong: 'otherwhise', right: 'otherwise', src: 'tone' })).toBe('short');
  });
  it('abgeschnittener Satz („Let us test the key assu“) wird ausgeblendet', () => {
    expect(fehlersatzProblem({ wrong: 'Let us test the key assu', right: 'Let us test the key assumption.', src: 'write' })).toBe('fragment');
  });
  it('Anweisung als Satz und Umformung ohne Ausgangsmaterial werden ausgeblendet', () => {
    expect(fehlersatzProblem({ wrong: 'Rewrite using a modal of deduction: I\'m 100% sure Sven didn\'t cause this error.', right: 'Sven can\'t have caused this error.' })).toBe('instruction');
    expect(fehlersatzProblem({ wrong: 'We will support your team. (Use \'promise\')', right: 'We promise to support your team.' })).toBe('instruction');
    expect(fehlersatzProblem({ wrong: '\'I will call you tomorrow,\' she said. → She said she called me the next day.', right: '\'I will call you tomorrow,\' she said. → She said she would call me the next day.', q: '\'I will call you tomorrow,\' she said. → She said ___ the next day.' })).toBe('instruction');
  });
  it('„weiß ich nicht“ (…), Mitschrift vom Sprechen und reine Schreibweise werden ausgeblendet', () => {
    expect(fehlersatzProblem({ wrong: 'If they had left earlier, they … the train.', right: 'If they had left earlier, they would not have missed the train.' })).toBe('empty');
    expect(fehlersatzProblem({ wrong: 'the problem was that the test files from your team was the same in the size as a productive File.', right: 'the problem was that the test files from your team were the same size as the production files.', src: 'talk' })).toBe('transcript');
    expect(fehlersatzProblem({ wrong: 'We signed the colour sheet yesterday afternoon.', right: 'We signed the color sheet yesterday afternoon.' })).toBe('stylistic');
    expect(fehlersatzProblem({ wrong: 'I assume that our new product will be succesfull', right: 'I assume that our new product will be successful.', src: 'write' })).toBe('typo');
  });
  it('der gezeigte Satz war nach der Aufgabe selbst richtig (erlaubte Alternative)', () => {
    const t = allSeedTasks().find((x) => x.type === 'gap' && x.prompt.includes('___') && x.accepted.length > 0);
    expect(t).toBeTruthy();
    const given = t!.accepted[0]!;
    const filled = (a: string): string => t!.prompt.replace(/_{3,}(\s*\([^()]*\))?/, a);
    expect(fehlersatzProblem({ wrong: filled(given), right: filled(t!.answer), src: 'lesson', q: t!.prompt, given })).toBe('correct');
  });
  it('brauchbare Sätze bleiben: echte Grammatikfehler mit 1–2 Abweichungen', () => {
    for (const [wrong, right] of [
      ['He suggested to meet at the office instead of the café.', 'He suggested meeting at the office instead of the café.'],
      ['It took me weeks to be used to the new expense system.', 'It took me weeks to get used to the new expense system.'],
      ['Could you give me an advice on how to handle this client?', 'Could you give me some advice on how to handle this client?'],
      ['If I would have more money, I would buy a new car.', 'If I had more money, I would buy a new car.'],
      ['The agenda will sent to all participants tomorrow morning.', 'The agenda will be sent to all participants tomorrow morning.'],
      ['Over 200 customers are affected by the data breach last month.', 'Over 200 customers were affected by the data breach last month.'],
    ] as const)
      expect(fehlersatzProblem({ wrong, right, src: 'lesson' }), wrong).toBeNull();
  });
  it('Lückenhinweis der damaligen Aufgabe', () => {
    expect(gapHintOf('Our results ___ (already / send) to the board.')).toBe('already / send');
    expect(gapHintOf('No gap here.')).toBeNull();
  });
});

const TODAY = '2026-10-19';
const NOW = berlin(TODAY, 18);
const DAY = 86_400_000;
type Doc = Record<string, unknown>;
const err = (q: string, ans: string, given: string, t: number, extra: Doc = {}): Doc => ({ q, given, ans, t, src: 'test', box: 0, due: t + DAY, ...extra });
const grammar = (topic: string, ...errors: Doc[]): ReadonlyMap<string, Doc> => new Map([[topic, { errors }]]);

describe('dueFehlersaetze mit Ausschlussregeln', () => {
  it('ein unbrauchbarer Grammatik-Fehler mit bekanntem Thema kommt als B1 wieder (hidden), zählt mit und bleibt gespeichert', () => {
    const e = err('If we ___ (choose) the smaller package, the upfront cost would be lower.', 'chose', 'If we If we has chosen the smaller package, the upfront cost would be lower.', NOW - 3 * DAY, { pat: 'cn.second' });
    const g = grammar('conditionals', e);
    const list = dueFehlersaetze({ grammarDocs: g, repairDoc: null, nowMs: NOW, today: TODAY });
    expect(list).toHaveLength(1);
    expect(list[0]?.hidden).toBe('doubled');
    const [card] = repairCards({ items: list, grammarDocs: g });
    expect(card?.kind).toBe('b1');
    expect(card?.fk1?.topic).toBe('conditionals');
    expect(card).toMatchObject({ store: 'grammar', topic: 'conditionals', errorT: NOW - 3 * DAY });
    // nichts gelöscht
    expect((g.get('conditionals')!.errors as Doc[]).length).toBe(1);
  });
  it('ein unbrauchbarer eigener Satz ohne Muster fällt als Aufgabe heraus (nur Zähler), der Eintrag bleibt', () => {
    const repairDoc = { items: [{ id: 'r1', wrong: 'to overcome', right: 'I need to overcome my fear of public speaking.', src: 'write', t: NOW - 4 * DAY, box: 0, due: NOW - DAY }] };
    expect(dueFehlersaetze({ grammarDocs: new Map(), repairDoc, nowMs: NOW, today: TODAY })).toEqual([]);
    expect(droppedFehlersaetze({ grammarDocs: new Map(), repairDoc, nowMs: NOW, today: TODAY })).toEqual([{ id: 'r1', reason: 'short' }]);
    expect(repairDoc.items).toHaveLength(1);
  });
  it('„Kann ich nicht nachvollziehen“ (unclear) nimmt Satz in beiden Speichern dauerhaft heraus', () => {
    const t = NOW - 3 * DAY;
    const g = grammar('passive', err('The roads ___ every year.', 'are checked', 'are repaired', t, { unclear: NOW - DAY }), err('Over 200 customers are affected by the data breach last month.', 'Over 200 customers were affected by the data breach last month.', '', NOW - 2 * DAY));
    const repairDoc = { items: [{ id: 'r1', wrong: 'My manager negotiate with your manager over a discount.', right: 'My manager negotiates with your manager over a discount.', src: 'write', t: NOW - 4 * DAY, box: 0, due: NOW - DAY, unclear: NOW - 3600_000 }] };
    const list = dueFehlersaetze({ grammarDocs: g, repairDoc, nowMs: NOW, today: TODAY });
    expect(list.map((x) => x.store)).toEqual(['grammar']);
    expect(list[0]?.wrong).toContain('Over 200 customers');
  });
  it('Kontext: Herkunft des Satzes, damalige Aufgabe mit Lücke, Lückenhinweis, Zahl der Vorkommen', () => {
    const g = grammar('passive', err('The agenda ___ (send) to all participants tomorrow morning.', 'will be sent', 'will sent', NOW - 3 * DAY, { more: [{ q: 'x', given: 'y', ans: 'z', t: 1 }] }));
    const repairDoc = { items: [{ id: 'r2', wrong: 'My manager negotiate with your manager over a discount.', right: 'My manager negotiates with your manager over a discount.', src: 'write', ctx: 'Mail an einen Kunden', t: NOW - 4 * DAY, box: 0, due: NOW - DAY }] };
    const list = dueFehlersaetze({ grammarDocs: g, repairDoc, nowMs: NOW, today: TODAY });
    const gram = list.find((x) => x.store === 'grammar')!;
    expect(gram).toMatchObject({ gapHint: 'send', n: 2, ctx: 'The agenda ___ to all participants tomorrow morning.' });
    expect(list.find((x) => x.store === 'repair')?.ctx).toBe('Mail an einen Kunden');
  });
});

describe('Auswahl der Aufgabenform', () => {
  const t = NOW - 6 * DAY;
  const clean = (box: number, rh = 0): Map<string, Doc> => new Map([['used-to', { errors: [err('My grandmother ___ (be) very strict when I was young.', 'used to be', 'was used to being', t, { pat: 'ut.used-to', box, rh: Array.from({ length: rh }, () => [t, 0, 0]) })] }]]);
  const kind = (g: ReadonlyMap<string, Doc>, forms = true): string | undefined => repairCards({ items: dueFehlersaetze({ grammarDocs: g, repairDoc: null, nowMs: NOW, today: TODAY }), grammarDocs: g, forms })[0]?.kind;
  it('Box 0 mit sauberem Satz: Korrektur des Originals (B3 mit Etikett)', () => {
    expect(kind(clean(0))).toBe('fix');
  });
  it('ab Box 1 wechseln sich „Sag es richtig“ und „Welche Fassung“ ab', () => {
    const kinds = new Set([kind(clean(1, 0)), kind(clean(1, 1))]);
    expect(kinds).toEqual(new Set(['b1', 'b2']));
  });
  it('ohne neue Formen bleibt die alte Variante der Rückfall', () => {
    expect(kind(clean(1), false)).toBe('variant');
  });
});
