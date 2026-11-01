import { describe, expect, it } from 'vitest';
import { createWriter } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { type UseInput } from '../../../src/modules/vocab/domain/apply';
import { Catalog } from '../../../src/modules/vocab/domain/catalog';
import { type Draft, isDraft } from '../../../src/modules/vocab/domain/flow';
import { applyAnswer, emptyLex, FLAG, introduce, type PlanCtx } from '../../../src/modules/vocab/domain/planner';
import type { Task } from '../../../src/modules/vocab/domain/session';
import { DEFAULT_CFG, type Lex } from '../../../src/modules/vocab/domain/types';
import { OPEN_MAX, openWhys, ownFrame, promptTarget, answerOfUse, modelOfUse, outcomeOfUseLog } from '../../../src/modules/vocab/domain/use';
import { addLater, dropLater, markLife, replayDraft, USE_LATER_DAYS, readUseDoc, writeUse } from '../../../src/modules/vocab/data/store';
import { USE_LATER_MAX, type UseLater } from '../../../src/modules/vocab/data/schemas';

// Großpaket A Schritt 5c-1: Anwenden-Karte (Modell), Buchung einer Verwendung, Entwurf „use“, `vmod/use` (Alltag, später prüfen).

type Doc = Record<string, unknown>;
const T0 = Date.parse('2026-11-02T18:00:00Z'); // Mo 19:00 Berlin
const D = 86_400_000;
const ctx = (): PlanCtx => ({ cfg: DEFAULT_CFG, path: 'vocab/scope', planned: true, load: () => 0, siblings: new Set() });

function learned(lv: number): Lex {
  const t = T0 - 30 * D;
  let l = introduce(emptyLex('w', 'core', t), t);
  l = applyAnswer(l, { t: t + 60_000, form: 'gap_hint', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx()).lex;
  l = applyAnswer(l, { t: t + 300_000, form: 'gap', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx()).lex;
  return { ...l, lv, step: null, b: { ...l.b!, due: T0 + 2 * D } };
}

const scope: Doc = { word: 'scope', de: 'Umfang, Rahmen', pos: 'noun', ex: 'We need to define the scope of the project.', wx: [{ en: 'The scope is too wide.', de: 'Der Umfang ist zu groß.' }], col: ['define the scope', { p: 'narrow the scope' }] };
const rely: Doc = { word: 'to rely on sth', de: 'sich auf etw. verlassen', ex: 'We rely on our suppliers.' };
const task = (over: Partial<Task> = {}): Task => ({ path: 'vocab/scope', form: 'transfer', step: 0, intro: false, planned: true, why: 'transfer', group: ['vocab/scope', 'vocab/rely', 'vocab/gone'], sent: '-', cue: false, ...over });
const docs: Record<string, Doc> = { 'vocab/scope': scope, 'vocab/rely': rely };
const lookup = (p: string) => (docs[p] ? { doc: docs[p], lex: learned(5), teach: { colloc: ['scope of work'] } } : null);
const use = (over: Partial<UseInput> = {}): UseInput => ({ t: T0, form: 'own', v: 'ok', err: null, at: '', evade: false, spoken: false, lvAt: 5, evidenceOnly: false, ...over });

describe('modelOfUse', () => {
  it('Anwenden: Gruppe ohne fehlende Wörter, Kennungen w1…, Grundform, Partner aus Dokument und Lehrer', () => {
    const m = modelOfUse({ task: task(), lookup, nowMs: T0, sbGate: null, lastLife: null })!;
    expect(m.form).toBe('transfer');
    expect(m.targets.map((t) => [t.key, t.path, t.word])).toEqual([
      ['w1', 'vocab/scope', 'scope'],
      ['w2', 'vocab/rely', 'rely on'],
    ]);
    expect(m.targets[0]!.partners).toEqual(['define the scope', 'narrow the scope', 'scope of work']);
    expect(m.targets[0]!.example).toBeTruthy();
    const sh = m.targets[0]!.shows[0]!;
    expect(sh.text.slice(sh.start, sh.end).toLowerCase()).toContain('scope');
    expect(m.evidence).toBe(false);
    expect(m.sit).toBeGreaterThanOrEqual(0);
    expect(promptTarget(m.targets[1]!)).toEqual({ key: 'w2', word: 'rely on', meaning: 'sich auf etw. verlassen', kind: 'w', example: m.targets[1]!.example });
  });

  it('eigener Satz: ein Wort, Arbeits-Lage je Wort und Tag; nur Beleg bei why=evidence; andere Formen → null', () => {
    const m = modelOfUse({ task: task({ form: 'own', why: 'evidence', group: undefined }), lookup, nowMs: T0, sbGate: null, lastLife: null })!;
    expect(m.targets).toHaveLength(1);
    expect(m.frame).toBe(ownFrame('vocab/scope', '2026-11-02'));
    expect(m.frame).not.toBe('life');
    expect(m.evidence).toBe(true);
    expect(modelOfUse({ task: task({ form: 'gap' }), lookup, nowMs: T0, sbGate: null, lastLife: null })).toBeNull();
    expect(modelOfUse({ task: task({ group: ['vocab/gone'] }), lookup, nowMs: T0, sbGate: null, lastLife: null })).toBeNull();
  });
});

describe('openWhys / outcomeOfUseLog / answerOfUse', () => {
  it('falsch vor fast richtig, höchstens zwei offen', () => {
    const open = openWhys([
      { key: 'w1', v: 'odd' },
      { key: 'w2', v: 'ok' },
      { key: 'w3', v: 'wrong' },
      { key: 'w4', v: 'odd' },
    ]);
    expect(open.size).toBe(OPEN_MAX);
    expect([...open]).toEqual(['w3', 'w1']);
  });

  it('Verlaufs-Ausgang ohne Note: dünn → odd, nicht benutzt → dunno; Fundstelle nur bei Verwechslung/Ausweichen; Kennzeichen später', () => {
    expect(outcomeOfUseLog(use({ v: 'thin' }), 'w')).toBe('odd');
    expect(outcomeOfUseLog(use({ v: 'unused' }), 'w')).toBe('dunno');
    expect(outcomeOfUseLog(use({ v: 'unused', evade: true }), 'w')).toBe('evade');
    expect(answerOfUse(use({ v: 'wrong', err: 'word', at: 'range' }), 'w', 12_345.6, false)).toMatchObject({ outcome: 'other', hit: 'range', ms: 12_346 });
    expect(answerOfUse(use({ v: 'wrong', err: 'sense', at: 'x' }), 'w', 1, false).hit).toBeNull();
    expect(answerOfUse(use(), 'w', -5, true)).toMatchObject({ ms: 0, flags: FLAG.later });
    expect(answerOfUse(use(), 'w', 1, false).flags).toBeUndefined();
  });
});

function setup(lex: Lex) {
  const h = createMemoryDb({ seed: { 'vocab/scope': { ...scope, lex } } });
  const deps = { writer: createWriter(h.db), device: 'phone' };
  const cat = new Catalog([{ path: 'vocab/scope', lex, order: 0, trap: null }]);
  const opts = { cfg: DEFAULT_CFG, cat, med: {}, planned: true };
  const lexIn = () => (h.dump()['vocab/scope'] as Doc).lex as Lex;
  const vlog = () => Object.entries(h.dump()).filter(([p]) => /^vlog\/\d/.test(p)).flatMap(([, d]) => Object.values(d.e as Doc).filter(Boolean));
  return { h, deps, opts, lexIn, vlog };
}

describe('writeUse', () => {
  it('bucht Note und Beleg genau einmal, Verlaufseintrag mit Ausgang', async () => {
    const s = setup(learned(5));
    const u = use();
    const r = await writeUse(s.deps, 'vocab/scope', answerOfUse(u, 'w', 30_000, false), u, s.opts);
    expect(r?.ev).toBe('o');
    expect(r?.grade).not.toBeNull();
    expect(s.lexIn().ev.o).toBe(1);
    expect(s.lexIn().sync).toBe(T0);
    expect(s.vlog()).toHaveLength(1);
    expect(await writeUse(s.deps, 'vocab/scope', answerOfUse(u, 'w', 30_000, false), u, s.opts)).toBeNull();
    expect(s.lexIn().ev.o).toBe(1);
    expect(s.vlog()).toHaveLength(1);
  });

  it('ohne Note und Beleg (nicht benutzt) trotzdem als gebucht markiert', async () => {
    const s = setup(learned(5));
    const u = use({ v: 'unused' });
    const r = await writeUse(s.deps, 'vocab/scope', answerOfUse(u, 'w', 1000, false), u, s.opts);
    expect(r?.grade).toBeNull();
    expect(s.lexIn().sync).toBe(T0);
    const d: Draft = { v: 1, kind: 'use', path: 'vocab/scope', planned: true, a: answerOfUse(u, 'w', 1000, false), u };
    expect(await replayDraft(s.deps, d, { cfg: DEFAULT_CFG, cat: s.opts.cat, med: {} })).toBeNull();
  });

  it('Entwurf „use“: gültig nur mit Verwendung; Nachbuchen bucht', async () => {
    const u = use({ t: T0 + 5000 });
    const d: Draft = { v: 1, kind: 'use', path: 'vocab/scope', planned: true, a: answerOfUse(u, 'w', 1000, false), u };
    expect(isDraft(d)).toBe(true);
    expect(isDraft({ ...d, u: undefined })).toBe(false);
    expect(isDraft({ ...d, u: { ...u, form: 'gap' } })).toBe(false);
    const s = setup(learned(5));
    const r = await replayDraft(s.deps, JSON.parse(JSON.stringify(d)) as Draft, { cfg: DEFAULT_CFG, cat: s.opts.cat, med: {} });
    expect(r).not.toBeNull();
    expect(s.lexIn().sync).toBe(T0 + 5000);
  });
});

const later = (t: number, over: Partial<UseLater> = {}): UseLater => ({ t, form: 'transfer', frame: 'mail', sit: 1, text: 'We need to define the scope.', spoken: false, w: [['vocab/scope', 5]], ...over });

describe('vmod/use', () => {
  it('Alltag merken nur vorwärts; später-Liste ohne Doppel, alte und überzählige fallen weg; Entfernen', async () => {
    const h = createMemoryDb({ seed: {} });
    const deps = { writer: createWriter(h.db), device: 'phone' };
    expect((await markLife(deps, '2026-11-06'))?.life).toBe('2026-11-06');
    expect(await markLife(deps, '2026-11-05')).toBeNull();
    await addLater(deps, later(T0 - (USE_LATER_DAYS + 1) * D), T0);
    for (let i = 0; i < USE_LATER_MAX + 1; i++) await addLater(deps, later(T0 + i), T0 + i);
    expect(await addLater(deps, later(T0 + 1), T0 + 50)).toBeNull();
    let doc = readUseDoc(h.dump()['vmod/use']);
    expect(doc.later.map((x) => x.t)).toEqual(Array.from({ length: USE_LATER_MAX }, (_, i) => T0 + 1 + i));
    expect(doc.life).toBe('2026-11-06');
    await dropLater(deps, T0 + 1);
    expect(await dropLater(deps, T0 + 1)).toBeNull();
    doc = readUseDoc(h.dump()['vmod/use']);
    expect(doc.later).toHaveLength(USE_LATER_MAX - 1);
  });

  it('unerwarteter Aufbau wird nie angefasst: neuere Fassung, fremdes Feld in einem Eintrag, falsche Form', async () => {
    for (const bad of [{ v: 2, life: null, later: [] }, { v: 1, life: null, later: [{ ...later(T0), extra: 1 }] }, { v: 1, life: { x: 1 }, later: [] }, { v: 1, life: null, later: {} }]) {
      const h = createMemoryDb({ seed: { 'vmod/use': bad } });
      const deps = { writer: createWriter(h.db), device: 'phone' };
      expect(await markLife(deps, '2026-11-06')).toBeNull();
      expect(await addLater(deps, later(T0 + 9), T0 + 9)).toBeNull();
      expect(h.dump()['vmod/use']).toEqual(bad);
    }
  });

  it('tolerant lesen: kaputte Einträge fallen weg, fremder Aufbau zählt als leer', () => {
    expect(readUseDoc(null)).toEqual({ life: null, later: [] });
    expect(readUseDoc({ life: 'x', later: [later(T0), { t: 'bad' }] })).toEqual({ life: null, later: [later(T0)] });
  });
});
