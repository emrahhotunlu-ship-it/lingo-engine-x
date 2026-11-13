import { describe, expect, it } from 'vitest';
import { createWriter } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { bookBridgeUse, bridgeWordsOf, type BridgeUseInput } from '../../../src/modules/vocab/data/bridge';
import { lexOf } from '../../../src/modules/vocab/data/lex';
import { emptyLex, introduce } from '../../../src/modules/vocab/domain/planner';
import { DEFAULT_CFG, type Lex } from '../../../src/modules/vocab/domain/types';
import { tuple, vlogDocId, type VlogTuple } from '../../../src/modules/vocab/domain/vlog';
import { dayKey } from '../../../src/domain/date';

// Wörter-Modul, Tür für die Brücken-Sätze (Großpaket P, P4): Lexeme für die Zielwahl (nur lesen) und Rückfluss eines beurteilten eigenen Satzes
// (ergänzend, idempotent, Planwirkung nur außerhalb des heutigen Pflichtplans).

const NOW = Date.parse('2026-11-13T18:00:00Z');
const D = 86_400_000;
const TODAY = dayKey(NOW);
type Doc = Record<string, unknown>;

/** Lexem auf Stufe `lv`, eingeführt vor 30 Tagen; `dueIn` = Tage bis zum Termin der Benutzen-Spur. */
function lexAt(lv: number, o: { dueIn?: number; day?: string | null; own?: number; s?: number } = {}): Lex {
  const t0 = NOW - 30 * D;
  const l = introduce(emptyLex('w', 'edge', t0), t0);
  const track = { due: NOW + (o.dueIn ?? 20) * D, s: o.s ?? 40, d: 5, st: 2, reps: 6, lapses: 0, last: NOW - 2 * D, sd: 22, ls: 0 };
  return { ...l, lv, step: null, u: { ...track }, b: { ...track }, day: o.day ?? null, dayU: null, ev: { f: ['2026-10-20', '2026-10-25', '2026-11-01'], o: o.own ?? 0, s: 0 }, sync: NOW - 2 * D };
}
const wordDoc = (word: string, lex: Lex, extra: Doc = {}): Doc => ({ id: word, word, de: `${word} (de)`, ex: `We had to ${word} the meeting until Friday.`, pos: 'verb', lex, ...extra });
const use = (o: Partial<BridgeUseInput> = {}): BridgeUseInput => ({ path: 'vocab/postpone', t: NOW, v: 'ok', err: null, at: 'postponed', evade: false, sentence: 'If we had known, we would have postponed the delivery.', ms: 42_000, ...o });

function setup(seed: Record<string, Doc>) {
  const h = createMemoryDb({ seed });
  const writer = createWriter(h.db);
  const docs = (): [string, Doc][] => Object.entries(h.dump()).filter(([p]) => /^(vocab|chunk)\//.test(p));
  const book = (i: BridgeUseInput, dayDoc: Doc | null = null) => bookBridgeUse({ writer, device: 'phone1' }, i, { docs: docs(), cfg: { ...DEFAULT_CFG, mod: 1 }, dayDoc });
  const lex = (path: string): Lex => lexOf(h.dump()[path])!;
  const vlog = (t: number): unknown[][] => Object.values(((h.dump()[vlogDocId(t)] as { e?: Record<string, unknown[]> } | undefined)?.e ?? {}));
  return { h, book, lex, vlog };
}

describe('bridgeWordsOf: Lexeme für die Zielwahl', () => {
  it('eingeführte, nicht pausierte Lexeme mit Stufe, Bedeutung, Kartensatz, eigenen Sätzen und letztem Übungstag (Verlauf vor Tagesmarke)', () => {
    const vt = (path: string, t: number, form: VlogTuple[3] = 'gap'): VlogTuple => tuple({ t, path, track: 1, form, note: 3, outcome: 'ok', ms: 1000, fk: 500, hint: 0, sentence: null, lv: 3, flags: 0 });
    const docs: [string, Doc][] = [
      ['vocab/postpone', wordDoc('postpone', lexAt(3, { day: '2026-11-10' }))],
      ['vocab/leverage', wordDoc('leverage', lexAt(6, { own: 1 }))],
      ['vocab/fresh', wordDoc('fresh', { ...emptyLex('w', 'edge', NOW) })],
      ['vocab/hidden', wordDoc('hidden', lexAt(4), { hidden: true })],
      ['vocab/double', wordDoc('double', { ...lexAt(4), of: 'vocab/postpone' })],
      ['chunk/c1', { id: 'c1', en: 'to rely on sth', de: 'sich verlassen auf', ex: 'We rely on our suppliers.', lex: { ...lexAt(5), k: 'pv' } }],
      ['grammar/x', { p: 1 }],
      ['vocab/nolex', { word: 'nolex', de: 'x' }],
    ];
    const vlog = [vt('vocab/postpone', NOW - 1000), vt('vocab/leverage', NOW - D), vt('chunk/c1', NOW - 1000, 'intro')];
    const out = bridgeWordsOf(docs, vlog, NOW);
    expect(out.map((w) => w.path)).toEqual(['vocab/postpone', 'vocab/leverage', 'chunk/c1']);
    expect(out[0]).toMatchObject({ head: 'postpone', word: 'postpone', de: 'postpone (de)', kind: 'w', lv: 3, own: 0, practiced: TODAY, example: 'We had to postpone the meeting until Friday.' });
    expect(out[1]).toMatchObject({ lv: 6, own: 1, practiced: dayKey(NOW - D) });
    // Grundform zum Benutzen; die Einführung allein zählt nicht als Üben.
    expect(out[2]).toMatchObject({ head: 'to rely on sth', word: 'rely on', kind: 'pv', practiced: null });
    // Ohne lesbaren Verlauf gilt die Tagesmarke des Lexems.
    expect(bridgeWordsOf(docs, [], NOW)[0]!.practiced).toBe('2026-11-10');
  });
});

describe('bookBridgeUse: Rückfluss eines beurteilten eigenen Satzes', () => {
  it('„richtig“ ab Stufe 5 zählt EINMAL je Lerntag als eigener Satz (Stufe 7) und steht in „Deine Sätze“; dieselbe Prüfung bucht nie doppelt', async () => {
    const s = setup({ 'vocab/postpone': wordDoc('postpone', lexAt(6, { dueIn: 20 })) });
    const first = await s.book(use());
    expect(first).toMatchObject({ ev: true, own: 1, lv: 6 });
    expect(s.lex('vocab/postpone').ev.o).toBe(1);
    expect(s.lex('vocab/postpone').os?.[0]?.[1]).toBe('If we had known, we would have postponed the delivery.');
    // Idempotent: dieselbe Prüfung (gleiche Zeit) noch einmal → nichts.
    expect(await s.book(use())).toBeNull();
    // Zweiter richtiger Satz am selben Lerntag: Verlaufseintrag ja, weiterer Beleg nein.
    const second = await s.book(use({ t: NOW + 60_000, sentence: 'Had we known, we would have postponed the installation.' }));
    expect(second).toMatchObject({ ev: false, own: 1 });
    expect(s.lex('vocab/postpone').ev.o).toBe(1);
    // Am nächsten Lerntag zählt der zweite Beleg; danach steht der Zähler bei 2.
    const next = await s.book(use({ t: NOW + D, sentence: 'If they had asked, we would have postponed the delivery again.' }));
    expect(next).toMatchObject({ ev: true, own: 2 });
    const rows = [...s.vlog(NOW), ...(vlogDocId(NOW + D) === vlogDocId(NOW) ? [] : s.vlog(NOW + D))];
    expect(rows).toHaveLength(3);
    // Verlaufsform `own`, Kennzeichen „von außen“ (16).
    expect(rows.every((r) => r[3] === 'own' && ((r[11] as number) & 16) === 16)).toBe(true);
  });

  it('unter Stufe 5 kein Beleg für Stufe 7; „falsch“ wird im Verlauf gemeldet', async () => {
    const s = setup({ 'vocab/postpone': wordDoc('postpone', lexAt(4, { dueIn: 20, day: TODAY })) });
    expect(await s.book(use())).toMatchObject({ ev: false, own: 0, planned: false });
    const wrong = await s.book(use({ t: NOW + 1000, v: 'wrong', err: 'sense' }));
    expect(wrong).toMatchObject({ ev: false, planned: false });
    expect(s.vlog(NOW).map((r) => [r[3], r[4], r[5]])).toEqual([['own', 0, 'ok'], ['own', 0, 'other']]);
    // Heute schon in der Runde gebucht: keine Planwirkung, der Termin bleibt.
    expect(s.lex('vocab/postpone').b?.due).toBe(NOW + 20 * D);
  });

  it('Planwirkung nur außerhalb des heutigen Pflichtplans und nur, wenn fällig oder unsicher (`mayPlan`); nie am selben Tag doppelt', async () => {
    const seed = { 'vocab/postpone': wordDoc('postpone', lexAt(5, { dueIn: -1, s: 10 })) };
    // Im heute eingefrorenen Pflichtplan: nur Beleg, keine Note, Termin und Tagesmarke bleiben (die Pflicht zählt es nicht als erledigt).
    const inPlan = setup(seed);
    const r1 = await inPlan.book(use(), { d: TODAY, plan: [['vocab/postpone', 'b', 'gap']] });
    expect(r1).toMatchObject({ planned: false, ev: true, own: 1 });
    expect(inPlan.lex('vocab/postpone').day).toBeNull();
    expect(inPlan.lex('vocab/postpone').b?.due).toBe(NOW - D);
    expect(inPlan.vlog(NOW)[0]?.[4]).toBe(0);
    // Nicht im Plan und fällig: richtige Verwendung bucht mit Note, der Termin rückt weiter.
    const free = setup(seed);
    const r2 = await free.book(use(), { d: TODAY, plan: [['vocab/other', 'b', 'gap']] });
    expect(r2).toMatchObject({ planned: true, ev: true });
    expect(free.lex('vocab/postpone').day).toBe(TODAY);
    expect(free.lex('vocab/postpone').b!.due).toBeGreaterThan(NOW);
    expect(free.vlog(NOW)[0]?.[4]).toBeGreaterThanOrEqual(3);
    // Nicht fällig und sicher (Abrufwahrscheinlichkeit ≥ 0,95): keine Planwirkung.
    const sure = setup({ 'vocab/postpone': wordDoc('postpone', { ...lexAt(5, { dueIn: 60, s: 400 }), u: { ...lexAt(5).u, due: NOW + 60 * D, s: 400, last: NOW - D }, b: { ...lexAt(5).b!, due: NOW + 60 * D, s: 400, last: NOW - D } }) });
    expect(await sure.book(use())).toMatchObject({ planned: false, ev: true });
  });

  it('unbekanntes oder nicht eingeführtes Lexem: nichts; ein Dokument ohne gültigen Lernstand wird nie angefasst', async () => {
    const broken = { id: 'x', word: 'broken', lex: { v: 1, lv: 'kaputt' } };
    const s = setup({ 'vocab/new': wordDoc('new', emptyLex('w', 'edge', NOW)), 'vocab/broken': broken });
    expect(await s.book(use({ path: 'vocab/missing' }))).toBeNull();
    expect(await s.book(use({ path: 'vocab/new' }))).toBeNull();
    expect(await s.book(use({ path: 'vocab/broken' }))).toBeNull();
    expect(s.h.dump()['vocab/broken']).toEqual(broken);
    expect(s.vlog(NOW)).toEqual([]);
  });
});
