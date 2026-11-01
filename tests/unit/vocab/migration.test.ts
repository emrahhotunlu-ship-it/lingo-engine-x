import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createWriter } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { cardPatchSchema, chunkPatchSchema } from '../../../src/domain/srs/applyReview';
import { dayKey } from '../../../src/domain/date';
import { dryRun, runMigration, type MigrationInput } from '../../../src/modules/vocab/data/migrate';
import { lexWriteSchema } from '../../../src/modules/vocab/data/schemas';
import { writeAnswer, writeVlog } from '../../../src/modules/vocab/data/store';
import { Catalog } from '../../../src/modules/vocab/domain/catalog';
import { findDupes } from '../../../src/modules/vocab/domain/dupes';
import { mirrorLegacy } from '../../../src/modules/vocab/domain/mirror';
import { convertDoc, type LogEntry } from '../../../src/modules/vocab/domain/migrate';
import { applyAnswer, emptyLex, introduce } from '../../../src/modules/vocab/domain/planner';
import { DEFAULT_CFG, type Lex } from '../../../src/modules/vocab/domain/types';
import { tuple, vlogDocId } from '../../../src/modules/vocab/domain/vlog';

// Wörter-Modul V1, Umrechnung (plan.md §9; Kap. 9; data-guard). Nur erfundene Daten (seed/sample-data.json und Testfälle hier).

type Doc = Record<string, unknown>;
const ROOT = join(import.meta.dirname, '../../..');
const NOW = Date.parse('2026-11-02T18:00:00Z');
const seed = JSON.parse(readFileSync(join(ROOT, 'seed/sample-data.json'), 'utf8')) as Record<string, Doc>;
const LEGACY = ['fsrs', 'S', 'D', 'due', 'stage', 'lm', 'hist', 'modes', 'xs', 'pa', 'ac', 'co', 'state', 'reps', 'lapses', 'last', 'intro'];

function inputFrom(all: Record<string, Doc>): MigrationInput {
  const docs = new Map(Object.entries(all).filter(([p]) => /^(vocab|chunk)\//.test(p)));
  const logs = new Map<string, LogEntry[]>();
  for (const [p, d] of Object.entries(all)) if (p.startsWith('log/') && Array.isArray(d.entries)) logs.set(p.slice(4), d.entries as LogEntry[]);
  return { docs, logs, nowMs: NOW };
}
const guards = { confirmed: true, backupWritten: true, profileValid: true, possiblyTruncated: false, holder: 'tab-1' };

/** Erfundene Sonderfälle: Doppel, Sinn-Zwillinge, leerer Verlauf, ausgeblendet, ungültig, künftige Versionen. */
const SPECIAL: Record<string, Doc> = {
  'vocab/address-talk': { id: 'address-talk', word: 'address', de: 'Rede', pos: 'noun', ex: 'Her address was short.', reps: 3, last: NOW - 86_400_000, state: 'review', S: 4, D: 5, due: NOW, stage: 3, hist: [] },
  'vocab/address-issue': { id: 'address-issue', word: 'address', de: 'angehen', pos: 'verb', ex: 'We must address the issue.', reps: 2, last: NOW - 2 * 86_400_000, state: 'review', S: 3, D: 5, due: NOW, stage: 2, hist: [] },
  'vocab/follow-up': { id: 'follow-up', word: 'follow-up', de: 'Nachfassen', pos: 'noun', ex: 'Send a follow-up.', reps: 1, last: NOW - 86_400_000, state: 'review', S: 2, D: 5, due: NOW, stage: 2 },
  'vocab/follow-up-2': { id: 'follow-up-2', word: 'follow up', de: 'nachfassen', pos: 'verb', ex: 'Please follow up.', reps: 1, last: NOW - 86_400_000, state: 'review', S: 2, D: 5, due: NOW, stage: 2 },
  'vocab/deadline': { id: 'deadline', word: 'deadline', de: 'Frist', pos: 'noun', ex: 'The deadline is Friday.', reps: 4, last: NOW - 86_400_000, state: 'review', S: 5, D: 5, due: NOW, stage: 3 },
  'vocab/deadline-2': { id: 'deadline-2', word: 'Deadline', de: 'Frist', pos: 'noun', ex: 'We met the deadline.', reps: 2, last: NOW - 3 * 86_400_000, state: 'review', S: 2, D: 5, due: NOW, stage: 2 },
  'vocab/hidden-one': { id: 'hidden-one', word: 'obsolete', de: 'veraltet', ex: 'This is obsolete.', reps: 2, last: NOW - 86_400_000, state: 'review', S: 2, D: 5, due: NOW, stage: 2, hidden: true },
  'vocab/broken': { id: 'broken', de: 'kaputt' },
  'vocab/future-fsrs': { id: 'future-fsrs', word: 'future', de: 'Zukunft', ex: 'The future is now.', reps: 2, last: NOW, state: 'review', fsrs: { v: 9 } },
  'vocab/future-lex': { id: 'future-lex', word: 'later', de: 'später', ex: 'See you later.', reps: 2, last: NOW, state: 'review', lex: { v: 7 } },
  'vocab/brand-new': { id: 'brand-new', word: 'novel', de: 'neuartig', ex: 'A novel idea.', state: 'new' },
};

describe('Umrechnung: Trockenlauf und Schreiben (Kap. 9 Regel 7, plan.md §9.3)', () => {
  it('Seed durchspielen: gleiche Anzahl je Sammlung, nichts gelöscht, alte Felder bytegleich, kein Schreiben nach daily/feed', async () => {
    const all = { ...seed, ...SPECIAL, 'app/schema': { version: 1, cutover: '2026-09-26', migratedAt: 1 } };
    const h = createMemoryDb({ seed: all });
    const w = createWriter(h.db);
    const before = h.dump() as Record<string, Doc>;
    const out = await runMigration(w, inputFrom(before), guards);
    expect(out.state).toBe('done');
    const after = h.dump() as Record<string, Doc>;
    const count = (d: Record<string, unknown>) => {
      const m: Record<string, number> = {};
      for (const p of Object.keys(d)) m[p.split('/')[0]!] = (m[p.split('/')[0]!] ?? 0) + 1;
      return m;
    };
    const cb = count(before);
    const ca = count(after);
    for (const [c, n] of Object.entries(cb)) expect(ca[c], c).toBe(n);
    expect(Object.keys(ca).filter((c) => !(c in cb)).sort()).toEqual(['vlog', 'vmod'].filter((c) => c in ca).sort());
    for (const p of Object.keys(before)) expect(after[p], p).toBeDefined();
    for (const [p, d] of Object.entries(before)) {
      if (!/^(vocab|chunk)\//.test(p)) {
        if (p !== 'app/schema') expect(after[p], p).toEqual(d);
        continue;
      }
      for (const k of LEGACY) expect(JSON.stringify(after[p]![k]), `${p}.${k}`).toBe(JSON.stringify(d[k]));
    }
    expect(h.writes().filter((x) => x.op === 'delete')).toEqual([]);
    expect(h.writes().filter((x) => /^(daily|feed)\//.test(x.path))).toEqual([]);
    // Jedes umgerechnete Lexem ist gültig und hat einen Ursprungssatz (Kap. 15, M58).
    const lexes = Object.entries(after).filter(([, d]) => d.lex && typeof d.lex === 'object' && (d.lex as Doc).v === 1);
    expect(lexes.length).toBeGreaterThan(140);
    for (const [p, d] of lexes) {
      expect(lexWriteSchema.safeParse(d.lex).success, p).toBe(true);
      const ex = p.startsWith('chunk/') ? (d.ex ?? d.en) : d.ex;
      expect(typeof ex === 'string' && ex.length > 0, p).toBe(true);
    }
    expect(lexes.length).toBeLessThanOrEqual(Object.keys(before).filter((p) => /^(vocab|chunk)\//.test(p)).length);
    expect((after['app/schema']!.vocabModule as Doc).state).toBe('done');
    expect(after['vocab/hidden-one']!.lex).toBeUndefined();
    expect(after['vocab/broken']!.lex).toBeUndefined();
    expect(after['vocab/future-fsrs']!.lex).toBeUndefined();
    expect(after['vocab/future-lex']!.lex).toEqual({ v: 7 });
  });

  it('idempotent: zweiter Lauf (auch zweiter Tab mit eigener Sperre) ändert nichts', async () => {
    const all = { ...seed, ...SPECIAL, 'app/schema': { version: 1, cutover: '2026-09-26', migratedAt: 1 } };
    const h = createMemoryDb({ seed: all });
    await runMigration(createWriter(h.db), inputFrom(h.dump()), guards);
    const once = JSON.stringify(h.dump());
    const second = await runMigration(createWriter(h.db), inputFrom(h.dump()), { ...guards, holder: 'tab-2' });
    expect(['already', 'busy']).toContain(second.state);
    expect(JSON.stringify(h.dump())).toBe(once);
    // Auch ein Lauf, der die Marke nicht sieht (z. B. Abbruch vor „done“), überspringt jedes Dokument mit `lex`.
    const h2 = createMemoryDb({ seed: JSON.parse(once) as never });
    const s2 = h2.dump() as Record<string, Doc>;
    (s2['app/schema'] as Doc).vocabModule = { v: 1, t: NOW, state: 'running' };
    h2.load(s2);
    const r = await runMigration(createWriter(h2.db), inputFrom(s2), { ...guards, holder: 'tab-3' });
    expect(r.written).toBe(0);
    const d2 = h2.dump() as Record<string, Doc>;
    for (const p of Object.keys(s2)) if (/^(vocab|chunk|vlog)\//.test(p)) expect(JSON.stringify(d2[p])).toBe(JSON.stringify(s2[p]));
  });

  it('gesperrt statt raten: ohne Bestätigung, ohne Sicherung, Profil ungültig, Abfrage gekappt → nichts geschrieben', async () => {
    for (const g of [{ confirmed: false }, { backupWritten: false }, { profileValid: false }, { possiblyTruncated: true }]) {
      const h = createMemoryDb({ seed: { ...SPECIAL } });
      const r = await runMigration(createWriter(h.db), inputFrom(h.dump()), { ...guards, ...g });
      expect(r.state).toBe('blocked');
      expect(h.writes()).toEqual([]);
    }
  });

  it('Trockenlauf: Bericht mit Stufe, Terminen, Übersprungenem, Doppeln; schreibt nichts', () => {
    const rep = dryRun(inputFrom({ ...seed, ...SPECIAL }));
    expect(rep.rows.length).toBeGreaterThan(140);
    expect(rep.skipped.map((s) => s.why).sort()).toEqual(expect.arrayContaining(['hidden', 'invalid', 'future_fsrs', 'future_lex']));
    expect(rep.dupes.some((d) => d.kind === 'propose' && [d.lead, d.other].sort().join() === ['vocab/deadline', 'vocab/deadline-2'].join())).toBe(true);
    expect(rep.lexemes).toBeLessThanOrEqual(rep.cards);
  });

  it('Rückstand (F4): Überfälliges über 7 Lerntage verteilt, nichts mehr vor heute fällig', () => {
    const rep = dryRun(inputFrom({ ...seed, ...SPECIAL }));
    const start = Date.parse('2026-11-02T03:00:00Z');
    const days = new Set(rep.rows.flatMap((r) => [r.uDue, r.bDue]).filter((x): x is number => x !== null && x < start + 7 * 86_400_000).map((x) => dayKey(x)));
    for (const r of rep.rows) if (r.uDue !== null) expect(r.uDue).toBeGreaterThanOrEqual(start);
    expect(days.size).toBeLessThanOrEqual(7);
  });
});

describe('Doppel (N3): nur vorschlagen, nie automatisch', () => {
  it('address (Rede) ≠ address (Problem); follow-up ≠ follow up', () => {
    const d = findDupes([
      { path: 'vocab/a1', head: 'address', k: 'w', de: 'Rede', pos: 'noun', reps: 1, last: 1 },
      { path: 'vocab/a2', head: 'address', k: 'w', de: 'angehen', pos: 'verb', reps: 1, last: 2 },
      { path: 'vocab/f1', head: 'follow-up', k: 'w', de: 'Nachfassen', pos: 'noun', reps: 1, last: 1 },
      { path: 'vocab/f2', head: 'follow up', k: 'pv', de: 'nachfassen', pos: 'verb', reps: 1, last: 1 },
      { path: 'vocab/p1', head: 'prioritise', k: 'w', de: null, pos: null, reps: 1, last: 1 },
      { path: 'vocab/p2', head: 'prioritize', k: 'w', de: null, pos: null, reps: 5, last: 1 },
    ]);
    expect(d.filter((x) => x.kind === 'propose')).toEqual([]);
    expect(d).toContainEqual({ lead: 'vocab/p2', other: 'vocab/p1', kind: 'report', why: 'british' });
  });
  it('bestätigtes Paar: `of` zeigt auf das führende Lexem, keine Kette', () => {
    const inp = inputFrom({ ...SPECIAL });
    const rep = dryRun({ ...inp, confirmedPairs: [['vocab/deadline', 'vocab/deadline-2']] });
    expect(rep.lexemes).toBe(rep.rows.length - 1);
  });
});

describe('Nachspielen nach neuen Regeln (plan.md §9.2 Schritt 4)', () => {
  const day = 86_400_000;
  const base = { word: 'leverage', de: 'nutzen', ex: 'We leverage data.', state: 'review', S: 3, D: 5, last: NOW - 2 * day, due: NOW, stage: 3, intro: '2026-10-20' };
  it('Auswahl verändert keine Spur; je Tag und Spur nur die erste Antwort', () => {
    const t0 = Date.parse('2026-10-20T17:00:00Z');
    const hist = [
      { t: t0, g: 3, x: 'cloze' },
      { t: t0 + 60_000, g: 1, x: 'cloze' },
      { t: t0 + 2 * day, g: 3, x: 'mc_de' },
      { t: t0 + 3 * day, g: 3, x: 'type' },
    ];
    const c = convertDoc('vocab/leverage', { ...base, reps: 4, hist }, NOW);
    expect(c.report.full).toBe(1);
    expect(c.lex!.b!.reps).toBe(2); // zwei Tage mit freiem Abruf, der Fehler am selben Tag bucht nicht
    expect(c.log.filter((x) => x[3] === 'choice').every((x) => x[4] === 0)).toBe(true);
  });
  it('ohne Verlauf: Verstehen aus dem gespeicherten Stand, Benutzen leer, Stufe 3; alte Stufe 4–5 → Stufe 4 mit Benutzen', () => {
    const a = convertDoc('vocab/a', { ...base, reps: 5, hist: [] }, NOW);
    expect(a.lex!.b).toBeNull();
    expect(a.lex!.lv).toBe(3);
    expect(a.lex!.u.s).toBe(3);
    const b = convertDoc('vocab/b', { ...base, reps: 9, S: 30, stage: 5, hist: [] }, NOW);
    expect(b.lex!.lv).toBe(4);
    expect(b.lex!.b!.s).toBe(7);
  });
  it('Override aus dem Log hat keine Wirkung; Treffer ohne Log an einem Tag mit Log zählt höchstens Hard', () => {
    const t0 = Date.parse('2026-10-21T17:00:00Z');
    const logs = new Map<string, LogEntry[]>([['2026-10-21', [{ t: t0, k: 'v', id: 'leverage', g: 3, override: true }]]]);
    const c = convertDoc('vocab/leverage', { ...base, reps: 2, hist: [{ t: t0, g: 3, x: 'cloze' }, { t: t0 + 3_600_000, g: 3, x: 'cloze' }] }, NOW, logs);
    expect(c.log.find((x) => x[0] === t0)![4]).toBe(0);
    expect(c.log.find((x) => x[0] === t0 + 3_600_000)![4]).toBe(2);
  });
});

describe('Spiegelung in die alten Felder (plan.md §3.1)', () => {
  it('alle Stufen 1–7 × beide Spuren bestehen cardPatchSchema bzw. chunkPatchSchema', () => {
    for (const lv of [1, 2, 3, 4, 5, 6, 7])
      for (const withB of [false, true])
        for (const chunk of [false, true]) {
          let l: Lex = introduce(emptyLex(chunk ? 'ch' : 'w', 'edge', NOW - 10 * 86_400_000), NOW - 10 * 86_400_000);
          const r = applyAnswer({ ...l, step: null }, { t: NOW, form: withB ? 'gap' : 'meaning', outcome: 'ok', hint: 0, ms: 9000, fk: 1000, sentence: null }, { cfg: DEFAULT_CFG, path: 'vocab/x', planned: true, load: () => 0, siblings: new Set() });
          l = { ...r.lex, lv };
          const doc = { word: 'x', hist: [{ t: 1, g: 3, m: 'cloze' }], modes: { cloze: { c: 1, w: 0 }, bogus: { c: 1, w: 1 } }, xs: { cloze: { c: 1, w: 0 } } };
          const m = mirrorLegacy(l, doc, { t: NOW, grade: r.grade!, form: withB ? 'gap' : 'meaning', ms: 9000, fk: 1000 }, chunk);
          const res = (chunk ? chunkPatchSchema : cardPatchSchema).safeParse(m);
          expect(res.success, `lv ${lv} b ${withB} chunk ${chunk}: ${JSON.stringify(res.error?.issues)}`).toBe(true);
        }
  });
  it('Patch mit `lex` besteht das Modul-Schema, ein fremdes Feld in `lex` scheitert', () => {
    const l = emptyLex('w', 'edge', NOW);
    expect(lexWriteSchema.safeParse(l).success).toBe(true);
    expect(lexWriteSchema.safeParse({ ...l, foo: 1 }).success).toBe(false);
    expect(lexWriteSchema.safeParse({ ...l, v: 2 }).success).toBe(false);
  });
  it('`sn` bleibt nach 20 Antworten ≤ 12', () => {
    let l: Lex = { ...emptyLex('w', 'edge', NOW - 30 * 86_400_000), intro: '2026-10-01' };
    for (let k = 0; k < 20; k++) l = applyAnswer(l, { t: NOW + k * 86_400_000, form: 'gap', outcome: 'ok', hint: 0, ms: 1, fk: 1, sentence: `x#${k}` }, { cfg: DEFAULT_CFG, path: 'vocab/x', planned: true, load: () => 0, siblings: new Set() }).lex;
    expect(l.sn.length).toBe(12);
  });
});

describe('Verlauf `vlog` (plan.md §3.4, M19)', () => {
  it('zwei Geräte gleichzeitig: kein Verlust; gleicher Eintrag zweimal: idempotent', async () => {
    const h = createMemoryDb({});
    const t = Date.parse('2026-11-10T10:00:00Z');
    const tp = (k: number) => tuple({ t: t + k, path: 'vocab/x', track: 1, form: 'gap', note: 3, outcome: 'ok', ms: 9000, fk: 1000, hint: 0, sentence: 'x#0', lv: 3, flags: 0 });
    await Promise.all([writeVlog({ writer: createWriter(h.db), device: 'phone' }, [tp(0), tp(1)], 'phone'), writeVlog({ writer: createWriter(h.db), device: 'lapt' }, [tp(0), tp(2)], 'lapt')]);
    await writeVlog({ writer: createWriter(h.db), device: 'phone' }, [tp(0)], 'phone');
    const doc = h.dump()[vlogDocId(t)] as { e: Record<string, unknown> };
    expect(Object.keys(doc.e).sort()).toHaveLength(4);
  });
  it('jedes Tupel hat Zeit, Form, Spur, Ergebnis, Dauer, Hinweis und Note (Emrah §7)', () => {
    const x = tuple({ t: 1, path: 'vocab/x', track: 2, form: 'nosent', note: 3, outcome: 'typo', ms: 12_345, fk: 2_001, hint: 1, sentence: null, lv: 4, flags: 1 });
    expect(x).toEqual([1, 'vocab/x', 2, 'nosent', 3, 'typo', 12_350, 2_000, 1, '', 4, 1]);
  });
  it('Halbmonat nach dem Lerntag (04:00 Berlin), Monats- und Halbmonatsgrenze', () => {
    expect(vlogDocId(Date.parse('2026-11-16T02:59:00Z'))).toBe('vlog/2026-11-a'); // 03:59 am 16. → Lerntag 15.
    expect(vlogDocId(Date.parse('2026-11-16T03:00:00Z'))).toBe('vlog/2026-11-b');
    expect(vlogDocId(Date.parse('2026-12-01T02:00:00Z'))).toBe('vlog/2026-11-b');
    expect(vlogDocId(Date.parse('2026-07-16T02:00:00Z'))).toBe('vlog/2026-07-b'); // Sommerzeit: 04:00
  });
  it('writeAnswer: Spiegelung und Verlauf in einem Ablauf, künftige `lex`-Version wird nie angefasst', async () => {
    const l = { ...introduce(emptyLex('w', 'edge', NOW - 5 * 86_400_000), NOW - 5 * 86_400_000), step: null, lv: 3 };
    const h = createMemoryDb({ seed: { 'vocab/x': { word: 'x', ex: 'x is here.', lex: l }, 'vocab/y': { word: 'y', lex: { v: 3 } } } });
    const w = createWriter(h.db);
    const cat = new Catalog([{ path: 'vocab/x', lex: l, order: 1 }]);
    const r = await writeAnswer({ writer: w, device: 'phone' }, 'vocab/x', { t: NOW, form: 'gap', outcome: 'ok', hint: 0, ms: 9000, fk: 1000, sentence: 'x#0' }, { cfg: DEFAULT_CFG, cat, med: {}, planned: true });
    expect(r?.booked).toEqual(['b', 'u']);
    const x = h.dump()['vocab/x'] as Doc;
    expect(cardPatchSchema.safeParse(Object.fromEntries(Object.entries(x).filter(([k]) => !['word', 'ex', 'lex'].includes(k)))).success).toBe(true);
    expect(Object.keys((h.dump()[vlogDocId(NOW)] as { e: Doc }).e)).toHaveLength(1);
    const y = await writeAnswer({ writer: w, device: 'phone' }, 'vocab/y', { t: NOW, form: 'gap', outcome: 'ok', hint: 0, ms: 1, fk: 1, sentence: null }, { cfg: DEFAULT_CFG, cat, med: {}, planned: true });
    expect(y).toBeNull();
    expect(h.dump()['vocab/y']).toEqual({ word: 'y', lex: { v: 3 } });
  });
});

describe('Suchtests (plan.md §9.3)', () => {
  const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]));
  const mod = files(join(ROOT, 'src/modules/vocab')).map((f) => readFileSync(f, 'utf8'));
  it('kein delete-Aufruf und kein Pfad nach daily/ oder feed/ im Modul', () => {
    expect(mod.some((t) => /\b(writer|db|w)\.delete\(/.test(t))).toBe(false);
    expect(mod.some((t) => /['"`](daily|feed)\//.test(t))).toBe(false);
  });
});

describe('Rückweg über lex.sync (plan.md §9.4)', () => {
  it('aus → alter Bereich antwortet → an: genau eine Buchung je neuem Lerntag, zweiter Abgleich ändert nichts', async () => {
    const { catchUp } = await import('../../../src/modules/vocab/domain/migrate');
    const t0 = Date.parse('2026-10-20T17:00:00Z');
    const day = 86_400_000;
    const conv = convertDoc('vocab/lev', { word: 'leverage', ex: 'We leverage data.', state: 'review', S: 3, D: 5, reps: 1, last: t0, due: t0 + 3 * day, stage: 3, intro: '2026-10-20', hist: [{ t: t0, g: 3, x: 'cloze' }] }, t0 + 1000);
    const lex = conv.lex!;
    const bReps = lex.b!.reps;
    // Alter Bereich antwortet an zwei Tagen, am zweiten zweimal.
    const doc = { word: 'leverage', last: t0 + 5 * day + 60_000, hist: [{ t: t0, g: 3, x: 'cloze' }, { t: t0 + 4 * day, g: 3, x: 'cloze' }, { t: t0 + 5 * day, g: 1, x: 'type' }, { t: t0 + 5 * day + 60_000, g: 3, x: 'type' }] };
    const a = catchUp(lex, doc, 'vocab/lev');
    expect(a.applied).toBe(2);
    expect(a.lex.b!.reps).toBe(bReps + 2);
    expect(a.incomplete).toBe(false);
    const b = catchUp(a.lex, doc, 'vocab/lev');
    expect(b.applied).toBe(0);
    expect(b.lex).toEqual(a.lex);
  });
  it('Lücke unvollständig (hist voll, ältester Eintrag nach sync) → gemeldet, nicht geraten', async () => {
    const { catchUp } = await import('../../../src/modules/vocab/domain/migrate');
    const lex = { ...emptyLex('w', 'edge', 1), intro: '2026-10-01', sync: 1000 };
    const hist = Array.from({ length: 12 }, (_, k) => ({ t: 5000 + k * 86_400_000, g: 3, x: 'cloze' }));
    expect(catchUp(lex, { last: hist[11]!.t, hist }, 'vocab/x').incomplete).toBe(true);
  });
});
