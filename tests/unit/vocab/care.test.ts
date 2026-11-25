import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createWriter } from '../../../src/data/writer';
import { snapshotFromRecord } from '../../../src/data/snapshot';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { carePatch, SAMPLE_FAM } from '../../../src/platform/dev/careSample';
import { applyCare, openOps } from '../../../src/modules/vocab/data/care';
import { careOpSchema, famListSchema } from '../../../src/modules/vocab/data/schemas';
import { famOf, famStep, fixStep, linkStep, mergeStep, mergedInto, relOf, type FamOp, type FixOp, type LinkOp, type MergeOp } from '../../../src/modules/vocab/domain/care';
import { familyCard } from '../../../src/modules/vocab/domain/card';
import { Catalog } from '../../../src/modules/vocab/domain/catalog';
import { available, FAMILY_EVERY, familySlot, LADDER_B, pickForm } from '../../../src/modules/vocab/domain/forms';
import { cardOf, evaluate, previewOf, answerOf } from '../../../src/modules/vocab/domain/flow';
import { whyOf } from '../../../src/modules/vocab/domain/band';
import { emptyLex } from '../../../src/modules/vocab/domain/planner';
import type { CheckDict } from '../../../src/modules/vocab/domain/check';
import type { Lex } from '../../../src/modules/vocab/domain/types';
import { learningCount, wordsDayCount } from '../../../src/modules/vocab/api';
import { startCare } from '../../../src/modules/vocab/ui/switch';
import { VMOD_CARE_PATH } from '../../../src/modules/vocab/registry';

// Wörter-Pflege und Wortfamilie (Emrah 25.11.2026, docs/umbau/vokabeln/pflege.md). Nur erfundene Daten (Seed und Testfälle).

type Doc = Record<string, unknown>;
const ROOT = join(import.meta.dirname, '../../..');
const NOW = Date.parse('2026-11-25T18:00:00Z');
const seed = JSON.parse(readFileSync(join(ROOT, 'seed/sample-data.json'), 'utf8')) as Record<string, Doc>;
const dict: CheckDict = { isWord: () => false, misspell: new Map(), confusable: new Map(), toUS: (w) => w };

const lexAt = (lv: number, h: Record<string, [number, number]> = {}): Lex => {
  const l = emptyLex('w', 'core', NOW - 30 * 86_400_000);
  const b = { ...l.u, due: NOW, s: 10, st: 2, reps: 5, last: NOW - 86_400_000 };
  return { ...l, lv, intro: '2026-10-01', u: { ...b, s: 20 }, b, fq: { l: 'gap', c: 0, h, nb: 0, ak: null, ew: [] } };
};

const fixOp = (over: Partial<FixOp> = {}): FixOp => ({ k: 'fix', t: 1, st: 'open', p: 'vocab/feasible', set: { de: { from: 'machbar', to: 'machbar, durchführbar' } }, ...over });

describe('Pflege-Operationen am Kartendokument (rein)', () => {
  it('fix: ändert nur bei passendem alten Wert, alter Wert im Verlauf; schon neu → same; anderer Wert → skip', () => {
    const cur = { word: 'feasible', de: 'machbar', pos: 'adj' };
    const r = fixStep(cur, fixOp(), 'f1', NOW);
    expect(r).toEqual({ kind: 'write', update: { de: 'machbar, durchführbar', care: [{ id: 'f1', t: NOW, k: 'fix', old: { de: 'machbar' } }] } });
    expect(fixStep({ ...cur, de: 'machbar, durchführbar' }, fixOp(), 'f1', NOW)).toEqual({ kind: 'same' });
    expect(fixStep({ ...cur, de: 'durchführbar' }, fixOp(), 'f1', NOW)).toEqual({ kind: 'skip', msg: 'stale:de' });
    expect(fixStep(undefined, fixOp(), 'f1', NOW)).toEqual({ kind: 'skip', msg: 'missing' });
    // Feld fehlt (from: null) → wird ergänzt.
    expect(fixStep({ word: 'x' }, fixOp({ set: { pos: { from: null, to: 'noun' } } }), 'f2', NOW)).toMatchObject({ kind: 'write', update: { pos: 'noun' } });
    // Wendungen: `en` statt `word`.
    expect(fixStep({ en: 'that said' }, fixOp({ p: 'chunk/x', set: { en: { from: 'that said', to: 'That said' } } }), 'f3', NOW)).toMatchObject({ kind: 'write', update: { en: 'That said' } });
    expect(fixStep({ en: 'x' }, fixOp({ p: 'chunk/x', set: { word: { from: 'x', to: 'y' } } }), 'f3', NOW)).toEqual({ kind: 'err', msg: 'field:word' });
    // Alle oder keins: ein veraltetes Feld hält auch die anderen zurück.
    // Ein Feld schon auf dem neuen Wert: nur die übrigen werden geschrieben.
    expect(fixStep(cur, fixOp({ set: { de: { from: 'machbar', to: 'neu' }, pos: { from: 'verb', to: 'adj' } } }), 'f4', NOW)).toMatchObject({ kind: 'write', update: { de: 'neu', care: [{ old: { de: 'machbar' } }] } });
    expect(fixStep(cur, fixOp({ set: { de: { from: 'machbar', to: 'neu' }, pos: { from: 'verb', to: 'noun' } } }), 'f4', NOW)).toEqual({ kind: 'skip', msg: 'stale:pos' });
  });

  it('merge: Verlierer stillgelegt (hidden, merged, lex.of), nichts gelöscht; Gewinner unverändert; idempotent; Kette/falsches Wort → skip', () => {
    const keep = { word: 'to achieve', de: 'erreichen', lex: lexAt(5) };
    const drop = { word: 'achieve', de: 'erreichen', ex: 'We [achieved] it.', reps: 3, lex: lexAt(2) };
    const op: MergeOp = { k: 'merge', t: 1, st: 'open', keep: 'vocab/achieve', drop: 'vocab/achieve-dup', kw: 'to achieve', dw: 'achieve', ok: '2026-11-25' };
    const r = mergeStep(drop, keep, op, 'm1', NOW);
    expect(r.kind).toBe('write');
    const up = (r as { update: Doc }).update;
    expect(up).toMatchObject({ hidden: true, merged: { into: 'vocab/achieve', t: NOW, id: 'm1', h: 0 }, lex: { of: 'vocab/achieve' } });
    expect(Object.keys(up).sort()).toEqual(['care', 'hidden', 'lex', 'merged']);
    const after = { ...drop, ...up, lex: { ...drop.lex, of: 'vocab/achieve' } };
    expect(mergeStep(after, keep, op, 'm1', NOW)).toEqual({ kind: 'same' });
    expect(mergeStep(drop, keep, { ...op, kw: 'to reach' }, 'm1', NOW)).toEqual({ kind: 'skip', msg: 'stale:head' });
    expect(mergeStep(drop, { ...keep, merged: { into: 'vocab/z' } }, op, 'm1', NOW)).toEqual({ kind: 'skip', msg: 'chain' });
    expect(mergeStep(drop, undefined, op, 'm1', NOW)).toEqual({ kind: 'skip', msg: 'missing' });
    // Ohne Lernstand: nur ausblenden und Verweis.
    expect((mergeStep({ word: 'achieve' }, keep, op, 'm1', NOW) as { update: Doc }).update.lex).toBeUndefined();
  });

  it('link: rel um die anderen ergänzt (nie entfernt), Stichwort geprüft, schon verknüpft → same', () => {
    const op: LinkOp = { k: 'link', t: 1, st: 'open', hs: { 'vocab/convince': 'to convince', 'vocab/persuade': 'to persuade' } };
    const r = linkStep({ word: 'to convince', rel: ['vocab/x'] }, 'vocab/convince', op, 'l1', NOW);
    expect(r).toMatchObject({ kind: 'write', update: { rel: ['vocab/x', 'vocab/persuade'] } });
    expect(linkStep({ word: 'to convince', rel: ['vocab/persuade'] }, 'vocab/convince', op, 'l1', NOW)).toEqual({ kind: 'same' });
    expect(linkStep({ word: 'to sell' }, 'vocab/convince', op, 'l1', NOW)).toEqual({ kind: 'skip', msg: 'stale:head' });
  });

  it('fam: famx gesetzt, alter Stand im Verlauf; erwarteter alter Stand passt nicht → skip; schon so → same', () => {
    const fam = famListSchema.parse(SAMPLE_FAM['vocab/achieve']);
    const op: FamOp = { k: 'fam', t: 1, st: 'open', p: 'vocab/achieve', w: 'to achieve', from: null, fam: fam as FamOp['fam'] };
    expect(famStep({ word: 'to achieve' }, op, 'a1', NOW)).toMatchObject({ kind: 'write', update: { famx: fam } });
    expect(famStep({ word: 'to achieve', famx: fam }, op, 'a1', NOW)).toEqual({ kind: 'same' });
    expect(famStep({ word: 'to achieve', famx: [fam[0]] }, op, 'a1', NOW)).toEqual({ kind: 'skip', msg: 'stale:fam' });
    // Altes Format `fam` (C1-Paket) bleibt unberührt.
    const w = famStep({ word: 'to achieve', fam: { noun: 'achievement' } }, op, 'a1', NOW) as { update: Doc };
    expect(w.update.fam).toBeUndefined();
  });

  it('Lesen tolerant: famOf (lange Wortarten, Ungültiges fällt weg), relOf, mergedInto', () => {
    const f = famOf({ famx: [{ form: 'accuracy', pos: 'noun', de: 'Genauigkeit', ex: 'OCR [accuracy] has improved.' }, { form: 'inaccurate', pos: 'adjective', ex: 'It was [inaccurate].' }, { form: 'x', pos: 'noun', ex: 'Too [short] form.' }, { form: 'nobracket', pos: 'noun', ex: 'No bracket at all here.' }, 'junk'] });
    expect(f.map((x) => [x.form, x.pos])).toEqual([
      ['accuracy', 'noun'],
      ['inaccurate', 'adj'],
    ]);
    expect(relOf({ rel: ['vocab/a', 'nope', 'vocab/a', 'chunk/b'] }, 'chunk/b')).toEqual(['vocab/a']);
    expect(mergedInto({ merged: { into: 'vocab/a' } })).toBe('vocab/a');
    expect(mergedInto({ merged: 'x' })).toBeNull();
  });

  it('Schema: alle vier Arten; merge ohne Emrahs OK ungültig', () => {
    const doc = carePatch(NOW)[VMOD_CARE_PATH]!;
    for (const op of Object.values(doc.ops as Doc)) expect(careOpSchema.safeParse(op).success, JSON.stringify(op)).toBe(true);
    const m = { ...((doc.ops as Doc)['merge-achieve'] as Doc) };
    delete m.ok;
    expect(careOpSchema.safeParse(m).success).toBe(false);
    expect(openOps({ v: 1, ops: { 'bad-1': { k: 'fix', st: 'open' }, done: { ...m, st: 'done' } } })).toEqual({ ops: [], bad: ['bad-1'] });
  });
});

describe('Pflege beim Start: über den einen Schreibpfad', () => {
  const schemaDone = { version: 1, cutover: '2026-09-26', migratedAt: 1, vocabModule: { v: 1, t: NOW - 86_400_000, state: 'done' } };
  const world = (extra: Record<string, Doc> = {}) => {
    const base: Record<string, Doc> = { ...seed, ...carePatch(NOW - 1000), 'app/schema': schemaDone, ...extra };
    base['app/profile'] = { ...(seed['app/profile'] ?? {}), vcfg: { min: 15, ret: 0.9, mod: 1 } };
    base['vocab/achieve'] = { ...base['vocab/achieve'], lex: lexAt(5) };
    base['vocab/achieve-dup'] = { ...base['vocab/achieve-dup'], lex: lexAt(2) };
    return createMemoryDb({ seed: base });
  };
  const raw = (h: ReturnType<typeof createMemoryDb>) => snapshotFromRecord(h.dump()).raw;

  it('wendet jede Art an, Status mit Zeit und Grund; veralteter Auftrag übersprungen; zweiter Lauf ändert nichts', async () => {
    const h = world();
    const w = createWriter(h.db);
    const r = await applyCare(w, raw(h), NOW);
    expect(r).toEqual({ done: 4, skip: 1, err: 0 });
    const d = h.dump() as Record<string, Doc>;
    expect(d['vocab/feasible']!.de).toBe('machbar, durchführbar');
    expect(d['vocab/feasible']!.care).toEqual([{ id: 'fix-feasible-de', t: NOW, k: 'fix', old: { de: 'machbar' } }]);
    expect(d['vocab/postpone']!.de).toBe(seed['vocab/postpone']!.de);
    expect(d['vocab/achieve']!.famx).toEqual(SAMPLE_FAM['vocab/achieve']);
    expect(d['vocab/convince']!.rel).toEqual(['vocab/persuade']);
    expect(d['vocab/persuade']!.rel).toEqual(['vocab/convince']);
    // Zusammenführen: Verlierer bleibt mit allen Feldern in der Datenbank, stillgelegt; Gewinner-Lernstand unverändert.
    const dup = d['vocab/achieve-dup']!;
    expect(dup).toMatchObject({ hidden: true, merged: { into: 'vocab/achieve', id: 'merge-achieve' }, word: 'achieve', ex: 'We [achieved] all targets this quarter.' });
    expect((dup.lex as Lex).of).toBe('vocab/achieve');
    expect((dup.lex as Lex).lv).toBe(2);
    expect(d['vocab/achieve']!.lex).toEqual(lexAt(5));
    const ops = (d[VMOD_CARE_PATH]!.ops ?? {}) as Record<string, Doc>;
    expect(ops['fix-feasible-de']).toMatchObject({ st: 'done', at: NOW, msg: null, k: 'fix', why: 'Bedeutung ergänzt.' });
    expect(ops['fix-stale']).toMatchObject({ st: 'skip', msg: 'stale:de' });
    // Zweiter Lauf: nichts mehr offen, keine Schreibvorgänge an Karten.
    const before = JSON.stringify(h.dump());
    expect(await applyCare(w, raw(h), NOW + 5000)).toEqual({ done: 0, skip: 0, err: 0 });
    expect(JSON.stringify(h.dump())).toBe(before);
  });

  it('wieder geöffneter Auftrag (Routine setzt open) ist idempotent: same → done, keine zweite Verlaufszeile', async () => {
    const h = world();
    const w = createWriter(h.db);
    await applyCare(w, raw(h), NOW);
    await w.transform(VMOD_CARE_PATH, () => ({ update: { ops: { 'fix-feasible-de': { st: 'open' } } } }));
    expect(await applyCare(w, raw(h), NOW + 1)).toEqual({ done: 1, skip: 0, err: 0 });
    const d = h.dump() as Record<string, Doc>;
    expect((d['vocab/feasible']!.care as unknown[]).length).toBe(1);
    expect(((d[VMOD_CARE_PATH]!.ops as Record<string, Doc>)['fix-feasible-de'] as Doc).msg).toBe('same');
  });

  it('stillgelegtes Doppel: nie im Bestand der Runde, nicht in „Wörter im Lernen“, nicht im Tageszähler', async () => {
    const h = world();
    await applyCare(createWriter(h.db), raw(h), NOW);
    const d = h.dump() as Record<string, Doc>;
    const dup = d['vocab/achieve-dup']!;
    const cat = new Catalog([
      { path: 'vocab/achieve', lex: d['vocab/achieve']!.lex as Lex, order: 0 },
      { path: 'vocab/achieve-dup', lex: dup.lex as Lex, order: 1, hidden: dup.hidden === true },
    ]);
    expect(cat.get('vocab/achieve-dup')).toBeUndefined();
    expect(cat.get('vocab/achieve')).toBeDefined();
    expect(learningCount([['vocab', [['achieve-dup', dup]]]])).toBe(0);
    expect(wordsDayCount([['vocab/achieve-dup', 'b', 'gap']], '2026-11-25', () => dup)).toEqual({ done: 0, total: 0 });
  });

  it('Wächter: nur mit eingeschalteter Wörter-App und fertiger Umrechnung', async () => {
    const off = world({ 'app/schema': { version: 1, cutover: '2026-09-26', migratedAt: 1 } });
    expect(await startCare(createWriter(off.db), snapshotFromRecord(off.dump()), NOW)).toBeNull();
    expect((off.dump()['vocab/feasible'] as Doc).de).toBe('machbar');
    const on = world();
    expect(await startCare(createWriter(on.db), snapshotFromRecord(on.dump()), NOW)).toEqual({ done: 4, skip: 1, err: 0 });
  });

  it('Teil-Dokumente: Aufträge in einem weiteren Teil (`parts`) werden auch angewendet', async () => {
    const h = world({
      [VMOD_CARE_PATH]: { v: 1, parts: ['care-2'], ops: {} },
      'vmod/care-2': { v: 1, ops: { x1: { k: 'fix', t: 1, st: 'open', p: 'vocab/feasible', set: { de: { from: 'machbar', to: 'durchführbar' } } } } },
    });
    expect(await applyCare(createWriter(h.db), raw(h), NOW)).toEqual({ done: 1, skip: 0, err: 0 });
    expect((h.dump()['vocab/feasible'] as Doc).de).toBe('durchführbar');
  });
});

describe('Form „Wortfamilie“ in der Wiederholung', () => {
  const doc: Doc = { word: 'to achieve', de: 'erreichen', pos: 'verb', ex: 'She [achieved] her goal.', famx: SAMPLE_FAM['vocab/achieve'] };
  const av = { de: true, family: true };

  it('nur ab Stufe 3, nur mit geprüfter Familie, höchstens jede 3. Benutzen-Abfrage, nie zweimal in Folge', () => {
    for (const lv of [1, 2]) expect(LADDER_B[lv]).not.toContain('family');
    for (const lv of [3, 4, 5, 6, 7]) expect(LADDER_B[lv]).toContain('family');
    const slot = lexAt(3, { gap: [FAMILY_EVERY - 1, FAMILY_EVERY - 1] });
    expect(familySlot(slot)).toBe(true);
    expect(available('family', slot, av)).toBe(true);
    expect(available('family', slot, { de: true })).toBe(false);
    expect(available('family', lexAt(3, { gap: [FAMILY_EVERY, FAMILY_EVERY] }), av)).toBe(false);
    expect(available('family', { ...slot, fq: { ...slot.fq!, l: 'family' } }, av)).toBe(false);
    expect(pickForm(slot, 'b', av).form).toBe('family');
    expect(pickForm(slot, 'b', { de: true }).form).not.toBe('family');
    expect(pickForm({ ...slot, lv: 2 }, 'b', av).form).not.toBe('family');
    // In 12 Benutzen-Abfragen höchstens 4 Wortfamilien.
    let n = 0;
    for (let i = 0; i < 12; i++) if (familySlot(lexAt(5, { gap: [i, i] }))) n++;
    expect(n).toBe(4);
  });

  it('Karte: Lücke im Satz der Form, Stammwort in Klammern, Ziel = Form; benotet nach FORM_SPEC; Warum nennt Form, Wortart, Bedeutung', () => {
    const lex = lexAt(5, { gap: [2, 2] });
    const task = { path: 'vocab/achieve', form: 'family' as const, step: 0 as const, intro: false, planned: true, why: 'due', sent: 's' as const, cue: false };
    const card = cardOf({ task, doc, lex, teach: { syn: ['reach'] }, nowMs: NOW, sbGate: null })!;
    expect(card.form).toBe('family');
    expect(card.fam).toEqual({ stem: 'achieve', form: 'achievement', pos: 'noun', de: 'Leistung, Erfolg' });
    expect(card.answer).toBe('achievement');
    expect(card.sentence!.gap.segs.filter((s) => s.t === 'text').map((s) => s.s)).toEqual(['The new billing system was a real ', ' for the team.']);
    expect(card.target.syn).toBeUndefined();
    expect(evaluate(card, 'achievement', dict).outcome).toBe('ok');
    expect(evaluate(card, 'achieve', dict).outcome).toBe('pos');
    // Reihum: die nächste Abfrage nimmt die zweite Form.
    expect(familyCard(doc, 'to achieve', lexAt(5, { family: [1, 1] }))!.fam.form).toBe('achievable');
    const a = answerOf(card, { outcome: 'ok' }, { t: NOW, ms: 4000, fk: 900, hint: 0 });
    expect(a).toMatchObject({ form: 'family', sentence: null, anchor: null });
    const why = whyOf({ check: { outcome: 'ok' }, given: 'achievement', answer: 'achievement', de: 'Leistung, Erfolg', pos: 'noun', teach: {}, lang: 'de', family: { stem: 'achieve', form: 'achievement' } });
    expect(why).toEqual({ kind: 'rule', key: 'vmWhyFamOk', vars: { answer: 'achievement', given: 'achievement', pos: 'noun', ps: 'noun', dm: ' – Leistung, Erfolg', stem: 'achieve' } });
    expect(whyOf({ check: { outcome: 'pos' }, given: 'achieve', answer: 'achievement', de: 'x', pos: 'noun', teach: {}, lang: 'de', family: { stem: 'achieve', form: 'achievement' } }).kind === 'rule' && (whyOf({ check: { outcome: 'pos' }, given: 'achieve', answer: 'achievement', de: 'x', pos: 'noun', teach: {}, lang: 'de', family: { stem: 'achieve', form: 'achievement' } }) as { key: string }).key).toBe('vmWhyFamPos');
    expect(typeof previewOf).toBe('function');
  });

  it('ohne nutzbare Form: normale Lücke, gebucht als gap', () => {
    const lex = lexAt(5, { gap: [2, 2] });
    const task = { path: 'vocab/achieve', form: 'family' as const, step: 0 as const, intro: false, planned: true, why: 'due', sent: 's' as const, cue: false };
    const card = cardOf({ task, doc: { ...doc, famx: [] }, lex, teach: {}, nowMs: NOW, sbGate: null })!;
    expect(card.form).toBe('gap');
    expect(card.fam).toBeUndefined();
  });
});
