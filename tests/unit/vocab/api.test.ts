import { describe, expect, it } from 'vitest';
import { createWriter } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { addLexeme, findLexeme, lexemeState, reportEvidence, startSession, todayBlock, vocabCfg, vocabModuleOn } from '../../../src/modules/vocab/api';
import { capacity } from '../../../src/modules/vocab/domain/capacity';
import { applyAnswer, emptyLex, introduce } from '../../../src/modules/vocab/domain/planner';
import { DEFAULT_CFG } from '../../../src/modules/vocab/domain/types';
import { vlogDocId } from '../../../src/modules/vocab/domain/vlog';

// Wörter-Modul V1, Tür nach außen (plan.md §2.2) und N8.

const NOW = Date.parse('2026-11-02T18:00:00Z');
const D = 86_400_000;
type Doc = Record<string, unknown>;

function learnedDoc(word: string): Doc {
  const t = NOW - 10 * D;
  let l = introduce(emptyLex('w', 'edge', t), t);
  const c = { cfg: DEFAULT_CFG, path: `vocab/${word}`, planned: true, load: () => 0, siblings: new Set<number>() };
  l = applyAnswer(l, { t: t + 60_000, form: 'gap_hint', outcome: 'ok', hint: 0, ms: 1, fk: 1, sentence: null }, c).lex;
  l = applyAnswer(l, { t: t + 400_000, form: 'gap', outcome: 'ok', hint: 0, ms: 1, fk: 1, sentence: null }, c).lex;
  return { word, ex: `We ${word} it.`, lex: l };
}

describe('api.ts', () => {
  it('Schalter: Standard aus; ungültige Einstellungen fallen auf den Standard (50 Wörter, Zeit-Notbremse aus dem Tagesziel, 90 %)', () => {
    expect(vocabModuleOn(null)).toBe(false);
    expect(vocabModuleOn({ vcfg: { min: 15, ret: 0.9, mod: 1 } })).toBe(true);
    expect(vocabCfg({ vcfg: { min: 17, ret: 0.9, mod: 1 } })).toMatchObject({ min: 30, cnt: 50, ret: 0.9, mod: 0 });
    expect(vocabCfg({ newPerDay: 10 }).newPerDay).toBe(10);
  });
  it('todayBlock liest nur das eingefrorene vmod/day (anderer Tag → null)', () => {
    const day = { d: '2026-11-02', plan: [['vocab/a', 'b', 'gap'], ['vocab/b', 'u', 'meaning'], ['vocab/c', 'n', 'intro']], min: 12, why: 'x' };
    expect(todayBlock(day, NOW, () => false)).toEqual({ min: 12, due: 2, fresh: 1, why: 'x', done: false });
    expect(todayBlock(day, NOW, () => true)?.done).toBe(true);
    expect(todayBlock(day, NOW + D, () => false)).toBeNull();
  });
  it('findLexeme: Stichwort, Doppel führen zum führenden Lexem', () => {
    const docs: [string, Doc][] = [
      ['vocab/x', { word: 'Leverage', lex: { ...emptyLex('w', 'edge', NOW), of: 'vocab/y' } }],
      ['chunk/c1', { en: 'push back the go-live' }],
    ];
    expect(findLexeme('to leverage', docs)?.path).toBe('vocab/y');
    expect(findLexeme('Push back the go-live', docs)?.path).toBe('chunk/c1');
    expect(findLexeme('nothing', docs)).toBeNull();
  });
  it('addLexeme: Ursprungssatz Pflicht, legt nur an, überschreibt nie', async () => {
    const h = createMemoryDb({ seed: { 'vocab/audit-trail': { word: 'audit trail', ex: 'old', reps: 3 } } });
    const w = createWriter(h.db);
    expect(await addLexeme(w, { word: 'audit trail', de: 'Prüfpfad', ex: '', src: 'lookup', nowMs: NOW })).toBeNull();
    expect(await addLexeme(w, { word: 'audit trail', de: 'Prüfpfad', ex: 'Keep an audit trail.', src: 'lookup', nowMs: NOW })).toBe('vocab/audit-trail');
    expect(h.dump()['vocab/audit-trail']).toEqual({ word: 'audit trail', ex: 'old', reps: 3 });
    expect(await addLexeme(w, { word: 'retention policy', de: 'Aufbewahrungsrichtlinie', ex: 'Our retention policy is strict.', src: 'teacher', core: true, nowMs: NOW })).toBe('vocab/retention-policy');
    const d = h.dump()['vocab/retention-policy'] as Doc;
    expect(lexemeState(d)).toMatchObject({ lv: 1, isNew: true, u: null, b: null });
    expect((d.lex as Doc).pri).toBe('core');
  });
  it('reportEvidence: vorgegebenes Wort nur Beleg (Note 0), freier getippter Abruf bucht einmal', async () => {
    const h = createMemoryDb({ seed: { 'vocab/streamline': learnedDoc('streamline') } });
    const w = createWriter(h.db);
    const docs = () => Object.entries(h.dump()) as [string, Doc][];
    const cued = await reportEvidence({ lexeme: 'vocab/streamline', kind: 'used', src: 'c1x', ok: true, typed: true, cued: true, t: NOW }, { writer: w, device: 'phone', docs: docs(), profile: null });
    expect(cued).toBe(false);
    const free = await reportEvidence({ lexeme: 'vocab/streamline', kind: 'recalled', src: 'c1x', ok: true, typed: true, cued: false, t: NOW + 1000 }, { writer: w, device: 'phone', docs: docs(), profile: null });
    expect(free).toBe(true);
    const again = await reportEvidence({ lexeme: 'vocab/streamline', kind: 'recalled', src: 'c1x', ok: false, typed: true, cued: false, t: NOW + 2000 }, { writer: w, device: 'phone', docs: docs(), profile: null });
    expect(again).toBe(false);
    const e = (h.dump()[vlogDocId(NOW)] as { e: Record<string, unknown[]> }).e;
    expect(Object.values(e).map((x) => x[4])).toEqual([0, 3, 0]);
    // Später: falsch, frei getippt, nicht vorgegeben → Again mit Planwirkung, Stabilität sinkt, Termin kurz.
    const before = (h.dump()['vocab/streamline'] as { lex: { b: { s: number } } }).lex.b.s;
    const t2 = NOW + 40 * D; // lange überfällig: Abrufwahrscheinlichkeit sicher < 0,95
    const wrong = await reportEvidence({ lexeme: 'vocab/streamline', kind: 'recalled', src: 'c1x', ok: false, typed: true, cued: false, t: t2 }, { writer: w, device: 'phone', docs: docs(), profile: null });
    expect(wrong).toBe(true);
    const e2 = (h.dump()[vlogDocId(t2)] as { e: Record<string, unknown[]> }).e;
    expect(Object.values(e2).at(-1)![4]).toBe(1);
    const lex = (h.dump()['vocab/streamline'] as { lex: { b: { due: number; s: number } } }).lex;
    expect(lex.b.s).toBeLessThan(before);
    expect(lex.b.due).toBeLessThanOrEqual(t2 + 3 * D);
  });
  it('startSession lädt Planer und Runde nach und baut die Runde nur im Modul', async () => {
    const docs: [string, Doc][] = [['vocab/streamline', learnedDoc('streamline')]];
    const { run } = await startSession('word', { docs, dayDoc: null, profile: null, nowMs: NOW, paths: ['vocab/streamline'] });
    expect(run.next(NOW)?.path).toBe('vocab/streamline');
  });
});

describe('Kapazität (N8)', () => {
  it('Warnschwellen 4.000 / 4.500, Jahre bis zur Grenze', () => {
    expect(capacity(1000, [75_000, 120_000], 5)).toMatchObject({ level: 'ok', vlogBytes: 195_000, vlogDocs: 2, perYear: 2214, yearsLeft: 1.8 });
    expect(capacity(4100, [], 5).level).toBe('warn');
    expect(capacity(4600, [], 5).level).toBe('high');
  });
});
