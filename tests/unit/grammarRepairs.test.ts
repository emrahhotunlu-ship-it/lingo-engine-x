import { describe, expect, it } from 'vitest';
import { selectRound } from '../../src/domain/grammar/tasks';
import type { Fehlersatz } from '../../src/domain/repair/fehlersaetze';
import { grammarModuleOn } from '../../src/modules/grammar/api';
import { checkGap, REPAIR_TOPIC, repairTasks } from '../../src/modules/grammar/domain/repairTasks';
import { berlin } from './helpers';

// Großpaket G4: eigene Fehlersätze aus `app/repair` im Grammatik-Schritt (Entscheidung 2: bis zu 3 vorn, Runde wird nicht länger).

const DAY = 86_400_000;
const t0 = berlin('2026-09-20', 10);

const rep = (id: string, extra: Partial<Fehlersatz> = {}): Fehlersatz => ({
  id,
  wrong: `She have ${id} the report.`,
  right: `She has ${id} the report.`,
  due: t0,
  store: 'repair',
  src: 'talk',
  ...extra,
});

describe('repairTasks (G4)', () => {
  it('macht aus sichtbaren app/repair-Sätzen Korrektur-Aufgaben mit rep-Kennung', () => {
    const out = repairTasks([
      rep('a', { why: 'he/she/it → has' }),
      rep('b', { hidden: 'empty' }),
      rep('c', { store: 'grammar' }),
      rep('d', { wrong: '  ' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      key: 'rep:a',
      rep: 'a',
      type: 'correct',
      topic: REPAIR_TOPIC,
      prompt: 'She have a the report.',
      answer: 'She has a the report.',
      accepted: [],
      errorT: t0,
      ref: 'app/repair',
      expl: { de: 'he/she/it → has', en: 'he/she/it → has' },
    });
  });

  it('unbekanntes Muster: Platzhalter-Thema, kein Muster', () => {
    const [t] = repairTasks([rep('x', { pat: 'gibt-es-nicht' })]);
    expect(t!.topic).toBe(REPAIR_TOPIC);
    expect(t!.pat).toBeNull();
  });
});

describe('selectRound mit eigenen Fehlersätzen (G4)', () => {
  const gErr = (q: string, k: number) => ({ q, given: 'x', ans: `ans${k}`, t: t0 + k, box: 0, due: t0 + DAY });
  const docs = new Map([
    ['past-simple-perfect', { p: 0.5, n: 5, errors: [gErr('I ___ (see) her yesterday.', 1), gErr('We ___ (meet) last week.', 2), gErr('They ___ (go) home early.', 3)] }],
  ]);
  const base = { grammarDocs: docs, dailyOpen: [], pool: [], nowMs: t0 + 2 * DAY, seed: 'x' } as const;

  it('Fehlersätze-Modus: eigener Satz zuerst, im Wechsel mit Grammatik-Fehlern', () => {
    const repairs = repairTasks([rep('a'), rep('b')]);
    const round = selectRound({ ...base, mode: 'errors', size: 8, repairs });
    expect(round.map((t) => t.rep ?? 'g')).toEqual(['a', 'g', 'b', 'g', 'g']);
    expect(new Set(round.map((t) => t.key)).size).toBe(round.length);
  });

  it('Pflicht: höchstens 3 Fehlersätze vorn, Runde bleibt gleich lang', () => {
    const repairs = repairTasks([rep('a'), rep('b'), rep('c'), rep('d')]);
    const without = selectRound({ ...base, mode: 'duty', size: 6 });
    const withRep = selectRound({ ...base, mode: 'duty', size: 6, repairs });
    expect(withRep).toHaveLength(without.length);
    const front = withRep.slice(0, 3);
    expect(front.map((t) => t.rep ?? 'g')).toEqual(['a', 'g', 'b']);
    expect(withRep.slice(3).some((t) => t.errorT !== null && t.errorT !== undefined)).toBe(false);
  });

  it('ohne eigene Sätze ändert sich nichts', () => {
    const a = selectRound({ ...base, mode: 'duty', size: 6 });
    const b = selectRound({ ...base, mode: 'duty', size: 6, repairs: [] });
    expect(b.map((t) => t.key)).toEqual(a.map((t) => t.key));
  });
});

describe('grammarModuleOn (Schalter gcfg.mod)', () => {
  it('fehlt oder ungültig → an; nur mod 0 schaltet aus', () => {
    expect(grammarModuleOn(null)).toBe(true);
    expect(grammarModuleOn({})).toBe(true);
    expect(grammarModuleOn({ gcfg: { mod: 1 } })).toBe(true);
    expect(grammarModuleOn({ gcfg: { mod: 7 } })).toBe(true);
    expect(grammarModuleOn({ gcfg: { mod: 0 } })).toBe(false);
  });
});

describe('Fehlersätze aus dem Einstufungstest (Emrahs Stift-Meldungen 09./10.11.2026)', () => {
  const check = (id: string, wrong: string, right: string, fix: string[], ctx: string): Fehlersatz => ({ id, wrong, right, fix, ctx, due: t0, store: 'repair', src: 'check' });

  it('kommen als eindeutige Lücke statt als mehrdeutiges „Fehler finden“', () => {
    const [ship, only, key] = repairTasks([
      check('s', 'If the shipment arrive damaged, please send us photos.', 'Should the shipment arrive damaged, please send us photos.', ['Should'], 'ca.inversion'),
      check('o', 'Only after the system had crashed twice time we realize how outdated our backups were.', 'Only after the system had crashed twice did we realize how outdated our backups were.', ['did'], 'inv.only'),
      check('k', 'I clearly remember to give the spare key to our neighbor.', 'I clearly remember giving the spare key to our neighbor.', ['giving'], 'gi.meaning'),
    ]);
    expect(ship).toMatchObject({ key: 'rep:s', rep: 's', type: 'gap', prompt: '___ the shipment arrive damaged, please send us photos.', answer: 'Should' });
    expect(only).toMatchObject({ type: 'gap', prompt: 'Only after the system had crashed twice ___ we realize how outdated our backups were.', answer: 'did' });
    expect(key).toMatchObject({ type: 'gap', prompt: 'I clearly remember ___ the spare key to our neighbor.', answer: 'giving' });
  });

  it('Wortschatz (lx.*) kommt nicht in die Grammatik', () => {
    const out = repairTasks([check('c', 'we want to make a short survey', 'we want to conduct a short survey', ['conduct'], 'lx.conduct-survey'), rep('p', { pat: 'lx.colloc' })]);
    expect(out).toEqual([]);
  });

  it('Korrektur nicht genau einmal im Satz: bleibt Korrektur-Aufgabe', () => {
    expect(checkGap({ right: 'a cat and a dog', fix: ['a'] })).toBeNull();
    expect(checkGap({ right: 'No change here.', fix: ['did'] })).toBeNull();
    expect(checkGap({ right: 'No sooner had we launched the update than …', fix: ['sooner had we launched'] })).toEqual({ prompt: 'No ___ the update than …', answer: 'sooner had we launched', accepted: [] });
    const out = repairTasks([check('x', 'a cat and dog', 'a cat and a dog', ['a'], 'art.indefinite')]);
    expect(out[0]).toMatchObject({ type: 'correct', prompt: 'a cat and dog', answer: 'a cat and a dog' });
  });
});
