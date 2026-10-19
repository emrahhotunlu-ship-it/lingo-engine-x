import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWriter, type Writer } from '../../src/data/writer';
import { validateDoc } from '../../src/data/validate';
import { toTrainCard } from '../../src/domain/srs/cards';
import type { TrainCard } from '../../src/domain/srs/types';
import { sampleFile } from '../../src/domain/tutor/quality';
import {
  acceptBankItem,
  bankSample,
  effectiveGate,
  QUARANTINE_DAYS,
  readGate,
  readSb,
  SB_MAX,
  TEACHER_SAMPLE,
  visibleSb,
  type SbEntry,
  type SbGate,
} from '../../src/domain/tutor/sentenceBank';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';
import { wordBankReply } from '../../src/platform/dev/canned/s4';
import { wordBank } from '../../src/prompts/wordBank';

// Engine-Verdrahtung 19.10.2026, Satzbank: Schreibweg (`writer.transform` je Karte, nur ergänzend, ≤ 8 Sätze, nie ein neues Dokument), Freigabe-Schalter
// mit Befund `{hard, unclear}` in `app/profile.sbGate`, Quarantäne je Satz 4 Wochen, Lehrer-Stichprobe von 30 Sätzen in der KI-Stichprobe.

type Doc = Record<string, unknown>;
const holder = vi.hoisted(() => ({ writer: null as Writer | null }));
vi.mock('../../src/data', () => ({ getWriter: () => holder.writer }));

const store = await import('../../src/features/vocab/sentenceBank');

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-19T10:00:00+02:00');
const T0 = NOW - 40 * DAY;
const sent = (en: string, t: number, over: Partial<SbEntry> = {}): SbEntry => ({ en, de: 'Ein deutscher Satz zum Test.', sit: 'meeting', k: 'work', src: 'ai', t, pv: 'word-bank@1', ...over });
const card = (id: string, over: Doc = {}): Doc => ({ word: id, de: 'x', ex: `We talked about ${id} in the weekly meeting with the team.`, stage: 2, S: 3, D: 5, due: NOW - DAY, ...over });

describe('Freigabe-Schalter (effectiveGate)', () => {
  const release: SbGate = { start: T0, on: true, checkedAt: T0 + QUARANTINE_DAYS * DAY, review: { hard: 1, unclear: 2 } };
  it('an nur mit Befund innerhalb der Schwelle und Prüfung frühestens 4 Wochen nach dem ersten Satz', () => {
    expect(effectiveGate(release).on).toBe(true);
    expect(effectiveGate({ ...release, review: { hard: 2, unclear: 0 } }).on).toBe(false);
    expect(effectiveGate({ ...release, review: { hard: 0, unclear: 3 } }).on).toBe(false);
    expect(effectiveGate({ ...release, review: null }).on).toBe(false);
    expect(effectiveGate({ ...release, checkedAt: T0 + 27 * DAY }).on).toBe(false);
    expect(effectiveGate({ ...release, checkedAt: null }).on).toBe(false);
    // Von Hand gesetztes `on: true` ohne Befund: bleibt zu.
    expect(effectiveGate(readGate({ start: T0, on: true })).on).toBe(false);
  });
  it('Quarantäne je Satz: auch bei offener Bank erst 4 Wochen nach der Erzeugung sichtbar; Lesetext-Sätze sofort; gemeldete nie', () => {
    const doc = { sb: [sent('Fresh sentence from Claude about the quarterly budget plan.', NOW - 3 * DAY), sent('Old sentence from Claude about the quarterly budget plan.', NOW - 29 * DAY), sent('Reported sentence from Claude about the quarterly budget plan.', NOW - 40 * DAY, { bad: 1 }), sent('A sentence from a reading text about the quarterly budget.', NOW, { src: 'read', pv: 'read:a1' })] };
    const open = visibleSb(doc, effectiveGate(release), NOW).map((x) => x.en.split(' ')[0]);
    expect(open).toEqual(['Old', 'A']);
    expect(visibleSb(doc, effectiveGate({ ...release, review: { hard: 3, unclear: 0 } }), NOW).map((x) => x.src)).toEqual(['read']);
  });
});

describe('Schemas: neue Felder, tolerant', () => {
  it('vocab/<id>.sb und app/profile.sbGate in jeder Form gültig (das Profil scheitert nie am Schalter)', () => {
    expect(validateDoc('vocab/x', card('x', { sb: [sent('Some sentence with x inside for the team.', NOW), 'kaputt', null] })).ok).toBe(true);
    expect(validateDoc('app/profile', { sbGate: { start: T0, on: 'ja', review: 7 } }).ok).toBe(true);
    expect(validateDoc('app/profile', { sbGate: 'kaputt' }).ok).toBe(true);
    expect(readGate('kaputt')).toMatchObject({ on: false, start: null });
  });
});

describe('Kandidaten der Anfrage', () => {
  const cards = new Map<string, TrainCard>();
  const mk = (id: string, over: Doc = {}): TrainCard => {
    const c = toTrainCard(id, card(id, over), true, NOW);
    if (!c) throw new Error(id);
    cards.set(c.key, c);
    return c;
  };
  const a = mk('approve');
  const full = mk('budget', { sb: Array.from({ length: SB_MAX }, (_, k) => sent(`Sentence number ${k} about the budget for the next quarter.`, NOW)) });
  const hidden = mk('hidden', { hidden: true });
  const pool = Array.from({ length: 10 }, (_, k) => mk(`word${k}`));

  it('zuerst die Karten der Runde, dann der Vorrat; höchstens 8; volle Bank und ausgeblendete Karten nie', () => {
    const r = store.bankCandidates([a.key, full.key, hidden.key], cards, [full, ...pool], { start: null, on: false }, NOW);
    expect(r).toHaveLength(8);
    expect(r[0]?.req).toMatchObject({ id: 'approve', en: 'approve', kind: 'word' });
    expect(r.map((x) => x.card.id)).not.toContain('budget');
    expect(r.map((x) => x.card.id)).not.toContain('hidden');
  });
  it('ohne Bedarf in der Runde keine Anfrage (der Vorrat allein löst nie aus)', () => {
    expect(store.bankCandidates([full.key], cards, pool, { start: null, on: false }, NOW)).toEqual([]);
  });
  it('gesammelte Claude-Sätze in Quarantäne zählen mit: keine erneute Anfrage während der Sammelzeit', () => {
    const waiting = mk('waiting', { sb: Array.from({ length: 4 }, (_, k) => sent(`Waiting sentence ${k} about the plan for our client.`, NOW - DAY)) });
    expect(store.bankCandidates([waiting.key], cards, [], { start: null, on: false }, NOW)).toEqual([]);
  });
});

describe('Schreibweg', () => {
  let h: MemoryDbHandle;
  beforeEach(() => {
    h = createMemoryDb({ seed: { 'vocab/approve': card('approve'), 'app/profile': { name: 'Test', days: {} } } });
    holder.writer = createWriter(h.db);
  });

  it('ergänzt die Bank der Karte (nur bei Änderung), Dubletten fallen auf dem frischen Stand weg, nie ein neues Dokument', async () => {
    const add = [sent('Our manager will approve the new budget before the end of the month.', NOW)];
    expect(await store.saveBank('vocab/approve', add)).toBe('saved');
    expect(await store.saveBank('vocab/approve', add)).toBe('unchanged');
    expect(readSb(h.dump()['vocab/approve'] as Doc)).toHaveLength(1);
    expect(await store.saveBank('vocab/missing', add)).toBe('blocked');
    expect(h.dump()['vocab/missing']).toBeUndefined();
    // Nur `update` auf die Karte, nie `set`.
    expect(h.writes().filter((w) => w.path === 'vocab/approve').map((w) => w.op)).toEqual(['update']);
  });

  it('volle Bank: höchstens 8 Sätze, die ältesten Claude-Sätze weichen, Lesetext und gemeldete bleiben; Karte weit unter 256 KiB', async () => {
    const old = Array.from({ length: SB_MAX }, (_, k) => sent(`Old sentence ${k} where we approve the plan for the client.`, NOW - (20 - k) * DAY, k === 0 ? { src: 'read', pv: 'read:x' } : k === 1 ? { bad: 1 } : {}));
    h.load({ ...h.dump(), 'vocab/approve': card('approve', { sb: old }) });
    await store.saveBank('vocab/approve', [sent('They will approve the contract after the legal review next week.', NOW)]);
    const sb = readSb(h.dump()['vocab/approve'] as Doc, true);
    expect(sb).toHaveLength(SB_MAX);
    expect(sb.some((x) => x.src === 'read')).toBe(true);
    expect(sb.some((x) => x.bad === 1)).toBe(true);
    expect(sb.at(-1)?.en).toMatch(/^They will approve/);
    expect(new TextEncoder().encode(JSON.stringify(h.dump()['vocab/approve'])).length).toBeLessThan(8 * 1024);
  });

  it('erster gesammelter Satz setzt sbGate.start genau einmal; übrige Felder bleiben', async () => {
    expect(await store.noteGateStart(NOW)).toBe(true);
    expect(await store.noteGateStart(NOW + DAY)).toBe(false);
    expect((h.dump()['app/profile'] as Doc).sbGate).toEqual({ start: NOW });
    expect((h.dump()['app/profile'] as Doc).name).toBe('Test');
  });

  it('Melden markiert den Satz (bad: 1), nichts gelöscht', async () => {
    await store.saveBank('vocab/approve', [sent('Our manager will approve the new budget before the end of the month.', NOW)]);
    expect(await store.reportSb('vocab/approve', 'Our manager will approve the new budget before the end of the month.')).toBe(true);
    const sb = readSb(h.dump()['vocab/approve'] as Doc, true);
    expect(sb).toHaveLength(1);
    expect(sb[0]?.bad).toBe(1);
  });
});

describe('Testantwort und Prüfung', () => {
  it('die feste Antwort von word-bank@1 besteht acceptBankItem auch für Verben mit „to“', () => {
    const vars = { cards: [{ id: 'convince', en: 'to convince', pos: 'verb', de: 'überzeugen', ex: 'He convinced me that the plan would work.', kind: 'word' as const, have: [] }], ctx: '' };
    const r = JSON.parse(wordBankReply(wordBank.build(vars))) as { items: unknown[] };
    const ok = acceptBankItem(r.items[0], { id: 'convince', en: 'to convince' }, new Set(), NOW, 'word-bank@1');
    expect(ok.rejected).toEqual([]);
    expect(ok.sb).toHaveLength(4);
  });
});

describe('Lehrer-Stichprobe', () => {
  const vocab = new Map<string, Doc>(
    Array.from({ length: 25 }, (_, i) => [`w${i}`, card(`w${i}`, { sb: Array.from({ length: 3 }, (_, k) => sent(`Sentence ${k} for card ${i} about the client project.`, NOW - (k + 1) * DAY)) })]),
  );
  it('30 Sätze, höchstens 2 je Karte, Zähler und Schalter; in der Datei als sentenceBank', () => {
    const b = bankSample(vocab, { start: null, on: false }, NOW);
    expect(b.n).toBe(75);
    expect(b.quarantined).toBe(75);
    expect(b.sample).toHaveLength(TEACHER_SAMPLE);
    const per = new Map<string, number>();
    for (const r of b.sample) per.set(r.id, (per.get(r.id) ?? 0) + 1);
    expect(Math.max(...per.values())).toBeLessThanOrEqual(2);
    const file = JSON.parse(sampleFile(NOW, [], [], b).data) as { sentenceBank: { sample: unknown[]; gate: SbGate; n: number } };
    expect(file.sentenceBank.sample).toHaveLength(30);
    expect(file.sentenceBank.n).toBe(75);
  });
  it('nach der Freigabe nur Sätze seit der letzten Prüfung (monatliche Stichprobe); ohne Claude-Sätze kein Eintrag in der Datei', () => {
    const gate: SbGate = { start: T0, on: true, checkedAt: NOW - 2 * DAY + 1, review: { hard: 0, unclear: 0 } };
    expect(bankSample(vocab, gate, NOW).sample.every((r) => r.t >= NOW - 2 * DAY)).toBe(true);
    const empty = bankSample(new Map(), { start: null, on: false }, NOW);
    expect(JSON.parse(sampleFile(NOW, [], [], empty).data)).not.toHaveProperty('sentenceBank');
  });
});
