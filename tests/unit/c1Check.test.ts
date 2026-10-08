import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import roots from '../../scripts/content/roots.json';
import { emptyC1, type C1Check } from '../../src/domain/c1/c1doc';
import { checkDayDuties, checkOffered } from '../../src/domain/c1/check/day';
import { appendCheck, saveCheck } from '../../src/domain/c1/check/save';
import { checkEntry, checkRepairs, CHECK_REPAIRS, checkLine, scoreCheck, weakest, type CheckAnswer } from '../../src/domain/c1/check/score';
import { CHECK_ANCHORS, CHECK_FORMS, CHECK_ITEMS, CHECK_MAX, CHECK_PARTS, checkSet, formFor, isAnchor, nextDeskForm } from '../../src/domain/c1/check/select';
import { c1File } from '../../src/domain/c1x/schema';
import { trainable } from '../../src/domain/c1x/select';
import { solutionsOf, wrongsOf } from '../../src/domain/c1x/solutions';
import type { C1Item } from '../../src/domain/c1x/types';
import { buildUnitStored } from '../../src/domain/unit/plan';

// C1-Check (Lernplattform 3.0 §4.3, P40/P41): Formen, Wertung, Speichern, Check-Tag.

const DIR = join(process.cwd(), 'src/content/c1x/src/check');
const items: C1Item[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => c1File.parse(JSON.parse(readFileSync(join(DIR, f), 'utf8'))).items);
const byId = new Map(items.map((it) => [it.id, it]));
const solved = (set: readonly C1Item[]): CheckAnswer[] => set.map((it) => ({ id: it.id, r: solutionsOf(it)[0] ?? null }));
const entry = (o: Partial<C1Check>): C1Check => ({ d: '2026-10-31', f: 'A', inp: 'desk', p: [8, 8, 8, 12], pts: 36, max: 36, ...o });

describe('Vorrat und Formen', () => {
  it('alle Aufgaben sind Check-Aufgaben, eindeutig, im Bereich 2001–2399 und nie trainierbar', () => {
    expect(items.length).toBe(CHECK_FORMS.length * (CHECK_ITEMS - CHECK_ANCHORS) + CHECK_ANCHORS);
    expect(byId.size).toBe(items.length);
    for (const it of items) {
      expect(it.probe, it.id).toBe(true);
      const n = Number(it.id.split('-')[1]);
      expect(n >= 2001 && n <= 2399, it.id).toBe(true);
      expect(trainable(it), it.id).toBe(false);
    }
  });
  it('nur das Bündel c1x-check enthält den Ordner check/', () => {
    const bundles = roots.bundles as Record<string, { dirs: string[] }>;
    const hits = Object.entries(bundles).filter(([, v]) => v.dirs.some((d) => d.endsWith('/check')));
    expect(hits.map(([k]) => k)).toEqual(['c1x-check']);
    expect(bundles['c1x-check']?.dirs).toEqual(['src/content/c1x/src/check']);
  });
  it.each(CHECK_FORMS)('Form %s: 30 Aufgaben, 8/8/8/6, 36 Punkte, 4 gleiche Anker', (form) => {
    const set = checkSet(items, form);
    expect(set.length).toBe(CHECK_ITEMS);
    expect(CHECK_PARTS.map((k) => set.filter((it) => it.kind === k).length)).toEqual([8, 8, 8, 6]);
    const anchors = set.filter(isAnchor).map((it) => it.id).sort();
    expect(anchors.length).toBe(CHECK_ANCHORS);
    expect(anchors).toEqual(checkSet(items, 'A').filter(isAnchor).map((it) => it.id).sort());
    expect(set.every((it) => isAnchor(it) || it.form === form)).toBe(true);
    expect(checkSet(items, form).map((it) => it.id)).toEqual(set.map((it) => it.id));
    expect(scoreCheck(set, solved(set)).pts).toBe(CHECK_MAX);
  });
  it('Formen teilen außer den Ankern keine Aufgabe; unvollständige Form ergibt []', () => {
    const own = CHECK_FORMS.map((f) => new Set(checkSet(items, f).filter((it) => !isAnchor(it)).map((it) => it.id)));
    for (const a of own) for (const b of own) if (a !== b) expect([...a].some((id) => b.has(id))).toBe(false);
    expect(checkSet(items.filter((it) => it.id !== checkSet(items, 'B').find((x) => !isAnchor(x))?.id), 'B')).toEqual([]);
    expect(checkSet(items, 'Z')).toEqual([]);
  });
  it('jede Lösungsvariante gibt volle Punkte, keine Falle gibt volle Punkte', () => {
    for (const it of items) {
      for (const r of solutionsOf(it)) expect(checkLine(it, r).score.got, `${it.id} ${JSON.stringify(r)}`).toBe(checkLine(it, r).score.max);
      for (const r of wrongsOf(it)) expect(checkLine(it, r).score.verdict, `${it.id} ${JSON.stringify(r)}`).not.toBe('correct');
    }
  });
});

describe('Wertung', () => {
  const set = checkSet(items, 'A');
  it('kwt: eine richtige Hälfte gibt 1 von 2 Punkten', () => {
    const kwt = byId.get('kwt-2004');
    expect(kwt?.kind).toBe('kwt');
    if (!kwt) return;
    const l = checkLine(kwt, { kind: 'kwt', text: 'is said to plan', typed: true });
    expect(l.score.max).toBe(2);
    expect(l.score.got).toBe(1);
  });
  it('„Weiß ich nicht“ gibt 0 und keinen Fehlersatz; Spanne ±3 innerhalb 0–36', () => {
    const t = scoreCheck(set, set.map((it) => ({ id: it.id, r: null })));
    expect(t.pts).toBe(0);
    expect(t.range).toEqual([0, 3]);
    expect(checkRepairs(t.lines, 'de')).toEqual([]);
    expect(scoreCheck(set, solved(set)).range).toEqual([33, 36]);
    expect(scoreCheck(set, solved(set)).weak).toEqual([]);
  });
  it('Teile, schwächste Muster und Eintrag', () => {
    const answers = solved(set).map((a) => {
      const it = byId.get(a.id);
      return it && it.kind === 'wf' ? { id: a.id, r: { kind: 'wf' as const, text: 'zzz' } } : a;
    });
    const t = scoreCheck(set, answers);
    expect(t.p).toEqual([8, 8, 0, 12]);
    expect(t.pts).toBe(28);
    expect(t.weak.length).toBeGreaterThan(0);
    expect(t.weak.length).toBeLessThanOrEqual(2);
    expect(t.weak.every(([g]) => g.startsWith('lx.wf'))).toBe(true);
    expect(t.weak).toEqual(weakest(t.lines));
    const e = checkEntry(t, { day: '2026-10-31', form: 'A', inp: 'desk' });
    expect(e).toMatchObject({ d: '2026-10-31', f: 'A', inp: 'desk', p: [8, 8, 0, 12], pts: 28, max: 36 });
    expect(e.m).toEqual(t.weak);
    expect('m' in checkEntry(scoreCheck(set, solved(set)), { day: '2026-10-31', form: 'A', inp: 'desk' })).toBe(false);
  });
  it('Fehlersätze: höchstens 8, nach Muster geordnet, Quelle check, zweisprachige Begründung', () => {
    const wrong = set.map((it) => ({ id: it.id, r: wrongsOf(it)[0] ?? null }));
    const t = scoreCheck(set, wrong);
    const de = checkRepairs(t.lines, 'de');
    expect(de.length).toBeGreaterThan(0);
    expect(de.length).toBeLessThanOrEqual(CHECK_REPAIRS);
    for (const r of de) {
      expect(r.src).toBe('check');
      expect(r.wrong).not.toBe(r.right);
      expect(r.why?.length ?? 0).toBeGreaterThan(0);
    }
    const en = checkRepairs(t.lines, 'en');
    expect(en.map((r) => r.right)).toEqual(de.map((r) => r.right));
    expect(en[0]?.why).not.toBe(de[0]?.why);
  });
});

describe('Formwahl und Speichern', () => {
  it('Laptop: erste freie Form; Handy verbraucht keine Form', () => {
    expect(nextDeskForm([])).toBe('A');
    expect(formFor('desk', [])).toBe('A');
    expect(formFor('touch', [])).toBe('A');
    const one = [entry({ f: 'A' })];
    expect(formFor('desk', one)).toBe('B');
    expect(formFor('touch', one)).toBe('A');
    expect(formFor('desk', [entry({ f: 'A', inp: 'touch' })])).toBe('A');
    const all = CHECK_FORMS.map((f) => entry({ f }));
    expect(nextDeskForm(all)).toBeNull();
    expect(formFor('touch', all)).toBe('C');
  });
  it('genau ein Eintrag: zweiter Tab, doppelte Laptop-Form, Handy am selben Tag ergeben null', () => {
    const e = entry({});
    const once = appendCheck(emptyC1(), e);
    expect(once?.checks).toEqual([e]);
    if (!once) return;
    expect(appendCheck(once, e)).toBeNull();
    expect(appendCheck(once, entry({ d: '2026-11-28' }))).toBeNull();
    const t = entry({ inp: 'touch', d: '2026-11-28' });
    const two = appendCheck(once, t);
    expect(two?.checks.length).toBe(2);
    if (!two) return;
    expect(appendCheck(two, { ...t, pts: 20 })).toBeNull();
  });
  it('ohne Datenbank: unavailable, nichts geworfen', async () => {
    expect(await saveCheck(entry({}))).toBe('unavailable');
  });
});

describe('Check-Tag im Tagesablauf', () => {
  const rows = [
    { id: 'ch:u-rev', block: 1, state: 'done' },
    { id: 'ch:u-focus', block: 2, state: 'open' },
    { id: 'ch:u-task', block: 3, state: 'open' },
  ];
  it('ersetzt die offenen Punkte von Schritt 2 und 3 nur am Check-Tag', () => {
    expect(checkDayDuties({ c1: 'check', rows, skipped: false, on: true })).toEqual(['ch:u-focus', 'ch:u-task']);
    expect(checkDayDuties({ c1: undefined, rows, skipped: false, on: true })).toBeNull();
    expect(checkDayDuties({ c1: 'check', rows, skipped: true, on: true })).toBeNull();
    expect(checkDayDuties({ c1: 'check', rows, skipped: false, on: false })).toBeNull();
    expect(checkDayDuties({ c1: 'check', rows: rows.map((r) => ({ ...r, state: 'done' })), skipped: false, on: true })).toBeNull();
  });
  it('der Check-Tag ändert Pflicht, Blöcke und Minuten nicht', () => {
    const review = { goal: 30, due: 25, fresh: 3, repairs: 0, sec: 470, overdue: 4 };
    const base = { nowMs: Date.parse('2026-10-05T10:00:00+02:00'), week: null, goalMin: 25, review, fixDue: 8, rv: 2 as const };
    const plain = buildUnitStored({ ...base, day: '2026-10-31' });
    const chk = buildUnitStored({ ...base, day: '2026-10-31', c1: 'check' });
    expect(chk.duty).toEqual(plain.duty);
    expect(chk.u?.b).toEqual(plain.u?.b);
    expect(chk.u?.min).toBe(plain.u?.min);
  });
  it('Angebot: nur im Fenster, mit Programm, freier Form und 21 Tagen Abstand', () => {
    const o = { day: '2026-10-28', programStarted: true, checks: [], formAvailable: true };
    expect(checkOffered(o)).toBe(true);
    expect(checkOffered({ ...o, day: '2026-10-20' })).toBe(false);
    expect(checkOffered({ ...o, programStarted: false })).toBe(false);
    expect(checkOffered({ ...o, formAvailable: false })).toBe(false);
    expect(checkOffered({ ...o, checks: [{ d: '2026-10-10' }] })).toBe(false);
    expect(checkOffered({ ...o, checks: [{ d: '2026-10-07' }] })).toBe(true);
  });
});
