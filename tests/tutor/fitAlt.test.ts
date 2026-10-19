import { describe, expect, it } from 'vitest';
import { createWriter } from '../../src/data/writer';
import { validateDoc } from '../../src/data/validate';
import { grammarWrite } from '../../src/domain/grammar/write';
import { FITALT_MAX_BYTES, FITALT_PER_TASK, FITALT_PER_TOPIC, fitAltPatch, fitAltRows, fitAltText, isFitAltPatch } from '../../src/domain/tutor/fitAlt';
import { fitAltHash, readFitAlt } from '../../src/domain/tutor/judge';
import type { GrammarAnswer } from '../../src/domain/learn/types';
import { createMemoryDb } from '../../src/platform/dev/memoryDb';
import { answer } from '../unit/learnHelpers';

// `grammar/<topic>.fitAlt` (Tutor-Engine v3 §3.2) nach den Datenregeln der Aktivierung (docs/umbau/aktivierung.md, Regel 9):
// parallele Schreiber behalten beide Einträge, Wiederholung ohne Dubletten, Überlauf 8 je Aufgabe / 60 je Thema, kein Monatswechsel.

const PV = 'grammar-fit@2';
const PATH = 'grammar/used-to';
const T0 = 1_790_000_000_000;
const usedTask = { topic: 'used-to', prompt: 'We ___ (have) a paper archive, but now everything is in the cloud.', answer: 'used to have', pat: 'used-to-past', alt: ['had'] };

const fitAnswer = (t: number, given: string, by: 'ai' | 'me' = 'ai', over: Partial<GrammarAnswer> = {}): GrammarAnswer =>
  answer({ t, given, verdict: 'correct', alt: by === 'ai', fit: { by, pv: PV }, ...over }, usedTask);

const opOf = (cur: Record<string, unknown> | undefined, a: GrammarAnswer) => {
  const w = grammarWrite(cur, a);
  return w.kind === 'skip' ? null : w.kind === 'create' ? { set: w.doc } : { update: w.patch };
};

async function seeded() {
  const h = createMemoryDb();
  const w = createWriter(h.db);
  await w.transform(PATH, (cur) => opOf(cur, answer({ t: T0, given: 'used to have' }, usedTask)));
  return { h, w };
}

describe('fitAltPatch (rein)', () => {
  it('neuer Eintrag, dann idempotent; „me“ wertet „ai“ auf, „ai“ überschreibt nie „me“', () => {
    const p = fitAltPatch({}, 'k1', ' Had. ', 'ai', PV, T0);
    expect(isFitAltPatch(p)).toBe(true);
    if (!isFitAltPatch(p)) return;
    const h = fitAltHash('had');
    expect(p.fitAlt.k1?.[h]).toEqual({ a: 'Had.', t: T0, by: 'ai', pv: PV });
    const doc = { fitAlt: p.fitAlt };
    expect(fitAltPatch(doc, 'k1', 'had', 'ai', PV, T0 + 5)).toBe('same');
    const up = fitAltPatch(doc, 'k1', 'had', 'me', PV, T0 + 5);
    expect(isFitAltPatch(up) && up.fitAlt.k1?.[h]?.by).toBe('me');
    const meDoc = { fitAlt: { k1: { [h]: { a: 'had', t: T0, by: 'me', pv: PV } } } };
    expect(fitAltPatch(meDoc, 'k1', 'had', 'ai', PV, T0 + 9)).toBe('same');
    expect(fitAltPatch({}, 'k1', '   ', 'ai', PV, T0)).toBe('empty');
    expect(fitAltPatch({}, '', 'had', 'ai', PV, T0)).toBe('empty');
  });

  it(`Überlauf je Aufgabe: höchstens ${FITALT_PER_TASK}, der älteste fällt heraus (Grabstein null)`, () => {
    let doc: Record<string, unknown> = {};
    for (let i = 0; i < FITALT_PER_TASK + 3; i++) {
      const p = fitAltPatch(doc, 'k1', `answer number ${i}`, 'ai', PV, T0 + i);
      if (!isFitAltPatch(p)) throw new Error(String(p));
      const merged = { ...((doc.fitAlt as Record<string, Record<string, unknown>> | undefined)?.k1 ?? {}), ...p.fitAlt.k1 };
      doc = { fitAlt: { k1: merged } };
    }
    const live = readFitAlt(doc).k1 ?? {};
    expect(Object.keys(live)).toHaveLength(FITALT_PER_TASK);
    const kept = Object.values(live).map((e) => e.a);
    expect(kept).not.toContain('answer number 0');
    expect(kept).not.toContain('answer number 2');
    expect(kept).toContain(`answer number ${FITALT_PER_TASK + 2}`);
    // Grabsteine: `update` entfernt keine Schlüssel, der verdrängte Eintrag steht als null und wird beim Lesen übergangen.
    expect(Object.values((doc.fitAlt as Record<string, Record<string, unknown>>).k1 ?? {}).filter((v) => v === null)).toHaveLength(3);
  });

  it(`Überlauf je Thema: höchstens ${FITALT_PER_TOPIC} lebende Einträge`, () => {
    const fa: Record<string, Record<string, unknown>> = {};
    for (let i = 0; i < FITALT_PER_TOPIC; i++) fa[`k${i}`] = { [fitAltHash(`a${i}`)]: { a: `a${i}`, t: T0 + i, by: 'ai', pv: PV } };
    const p = fitAltPatch({ fitAlt: fa }, 'knew', 'brand new', 'ai', PV, T0 + 1000);
    expect(isFitAltPatch(p)).toBe(true);
    if (!isFitAltPatch(p)) return;
    expect(p.fitAlt.k0?.[fitAltHash('a0')]).toBeNull();
    const merged: Record<string, Record<string, unknown>> = { ...fa };
    for (const [k, m] of Object.entries(p.fitAlt)) merged[k] = { ...(merged[k] ?? {}), ...m };
    const n = Object.values(readFitAlt({ fitAlt: merged })).reduce((s, m) => s + Object.keys(m).length, 0);
    expect(n).toBe(FITALT_PER_TOPIC);
  });

  it(`Größenwächter: über ${FITALT_MAX_BYTES} B wird nichts mehr geschrieben`, () => {
    const fa: Record<string, Record<string, unknown>> = {};
    for (let i = 0; i < 70; i++) fa[`task-key-${i}`] = { [`h${i}`]: { a: 'x'.repeat(80) + i, t: T0 + i, by: 'ai', pv: PV }, [`z${i}`]: null };
    expect(fitAltPatch({ fitAlt: fa }, 'task-key-new', 'one more', 'ai', PV, T0 + 999)).toBe('too_big');
  });

  it('Liste für den Englischlehrer: alle lebenden Einträge, neueste zuerst, als Tab-Text', () => {
    const docs = new Map<string, Record<string, unknown>>([
      ['used-to', { fitAlt: { k1: { a: { a: 'had', t: T0, by: 'ai', pv: PV }, b: null } } }],
      ['present-perfect', { fitAlt: { k2: { c: { a: 'have been working', t: T0 + 10, by: 'me', pv: PV } } } }],
    ]);
    const rows = fitAltRows(docs);
    expect(rows.map((r) => r.a)).toEqual(['have been working', 'had']);
    const text = fitAltText(rows);
    expect(text.split('\n')[0]).toBe('topic\ttask\tanswer\tby\tt\tpv');
    expect(text).toContain('used-to\tk1\thad\tai\t');
  });
});

describe('grammarWrite mit fit (derselbe Schreibweg)', () => {
  it('Claudes Ja: fitAlt im selben Patch, Schema bleibt gültig; „Weiß ich nicht“ und Claude-Aufgaben nie', async () => {
    const { h } = await seeded();
    const cur = h.dump()[PATH];
    const w = grammarWrite(cur, fitAnswer(T0 + 1, 'had'));
    expect(w.kind).toBe('update');
    if (w.kind !== 'update') return;
    const fa = readFitAlt({ fitAlt: w.patch.fitAlt });
    expect(Object.values(fa).flatMap((m) => Object.values(m))).toMatchObject([{ a: 'had', by: 'ai', pv: PV, t: T0 + 1 }]);
    expect(validateDoc(PATH, { ...cur, ...w.patch }).ok).toBe(true);
    const dk = grammarWrite(cur, fitAnswer(T0 + 2, 'had', 'ai', { dontKnow: true }));
    expect(dk.kind === 'update' && 'fitAlt' in dk.patch).toBe(false);
  });

  it('Zielform-Zweitversuch: gemerkt wird die erste Antwort (fit.a), gebucht die Zielform', async () => {
    const { h } = await seeded();
    const w = grammarWrite(h.dump()[PATH], answer({ t: T0 + 1, given: 'used to have', verdict: 'correct', help: { level: 1 }, fit: { by: 'ai', pv: PV, a: 'had' } }, usedTask));
    expect(w.kind).toBe('update');
    if (w.kind !== 'update') return;
    const rows = Object.values(readFitAlt({ fitAlt: w.patch.fitAlt }))[0] ?? {};
    expect(Object.values(rows).map((e) => e.a)).toEqual(['had']);
  });

  it('Fehlersatz trägt die Ursache h (tj.h)', async () => {
    const { h } = await seeded();
    const w = grammarWrite(h.dump()[PATH], answer({ t: T0 + 1, given: 'use to have', verdict: 'wrong', tj: { v: 'w', h: 'form' } }, usedTask));
    expect(w.kind === 'update' && (w.patch.errors as Array<{ h?: string }>).at(-1)?.h).toBe('form');
  });
});

describe('Datenregel 9: Schreibweg über writer.transform', () => {
  it('zwei parallele Schreiber (zwei Geräte) mit verschiedenen Antworten: beide Einträge bleiben', async () => {
    const { h, w } = await seeded();
    const w2 = createWriter(h.db);
    await Promise.all([w.transform(PATH, (cur) => opOf(cur, fitAnswer(T0 + 10, 'had'))), w2.transform(PATH, (cur) => opOf(cur, fitAnswer(T0 + 11, 'used to own', 'me')))]);
    const fa = readFitAlt(h.dump()[PATH]);
    const all = Object.values(fa).flatMap((m) => Object.values(m).map((e) => e.a));
    expect(all.sort()).toEqual(['had', 'used to own']);
  });

  it('der ältere Schreiber kommt zu spät (stale): die Antwort bleibt draußen, der gelernte Eintrag nicht', async () => {
    const { h, w } = await seeded();
    // „Auch richtig“ (alt) bucht kein BKT und setzt `last` nicht; das Einspruch-Urteil (me) schon.
    await w.transform(PATH, (cur) => opOf(cur, fitAnswer(T0 + 20, 'used to own', 'me')));
    const r = await w.transform(PATH, (cur) => opOf(cur, fitAnswer(T0 + 15, 'had')));
    expect(r).toBe('updated');
    const doc = h.dump()[PATH] as Record<string, unknown>;
    expect(doc.last).toBe(T0 + 20);
    expect(Object.values(readFitAlt(doc)).flatMap((m) => Object.values(m).map((e) => e.a)).sort()).toEqual(['had', 'used to own']);
    expect(validateDoc(PATH, doc).ok).toBe(true);
  });

  it('Wiederholung derselben Antwort (auch gleichzeitig): genau ein Eintrag', async () => {
    const { h, w } = await seeded();
    const w2 = createWriter(h.db);
    await Promise.all([w.transform(PATH, (cur) => opOf(cur, fitAnswer(T0 + 30, 'had'))), w2.transform(PATH, (cur) => opOf(cur, fitAnswer(T0 + 30, 'Had.')))]);
    await w.transform(PATH, (cur) => opOf(cur, fitAnswer(T0 + 31, 'had')));
    const fa = readFitAlt(h.dump()[PATH]);
    expect(Object.values(fa).reduce((s, m) => s + Object.keys(m).length, 0)).toBe(1);
  });

  it('Überlauf über den Schreibweg: 8 je Aufgabe, ältester raus', async () => {
    const { h, w } = await seeded();
    for (let i = 0; i < FITALT_PER_TASK + 2; i++) await w.transform(PATH, (cur) => opOf(cur, fitAnswer(T0 + 100 + i, `we had option ${i}`)));
    const fa = readFitAlt(h.dump()[PATH]);
    const live = Object.values(fa).flatMap((m) => Object.values(m).map((e) => e.a));
    expect(live).toHaveLength(FITALT_PER_TASK);
    expect(live).not.toContain('we had option 0');
    expect(live).not.toContain('we had option 1');
  });

  it('Monatswechsel greift nicht: Einträge aus Oktober und November liegen im selben Themen-Dokument', async () => {
    const { h, w } = await seeded();
    const oct = Date.parse('2026-11-01T03:59:00+01:00');
    const nov = Date.parse('2026-11-01T04:00:00+01:00');
    await w.transform(PATH, (cur) => opOf(cur, fitAnswer(oct, 'had', 'ai', { day: '2026-10-31' })));
    await w.transform(PATH, (cur) => opOf(cur, fitAnswer(nov, 'used to own', 'me', { day: '2026-11-01' })));
    const docs = h.dump();
    expect(Object.keys(docs).filter((p) => p.startsWith('grammar/'))).toEqual([PATH]);
    expect(Object.values(readFitAlt(docs[PATH])).flatMap((m) => Object.values(m).map((e) => e.a)).sort()).toEqual(['had', 'used to own']);
  });
});
