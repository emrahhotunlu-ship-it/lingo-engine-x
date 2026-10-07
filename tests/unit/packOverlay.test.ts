import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWriter, type Writer } from '../../src/data/writer';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';
import type { Db } from '../../src/platform/types';
import { useLive } from '../../src/data/live';
import { dayKey } from '../../src/domain/date';
import { packDoc, packEntry } from '../../src/domain/c1pack/pack';
import { packExtraOf } from '../../src/domain/c1pack/packFields';
import { readDecks } from '../../src/domain/srs/decks';
import { toChunkCard } from '../../src/domain/srs/chunkCards';
import { toTrainCard } from '../../src/domain/srs/cards';
import type { StoredPlan } from '../../src/domain/plan/types';

// Lernplattform 2.0 §4.8: Paket-Felder liegen nur beim Lesen über bestehenden Karten (`packExtraOf`); das Öffnen einer Runde schreibt
// nichts außer den regulären Review-Einträgen. Neue Paket-Karten behalten Register, Begründung und Varianten.

type Doc = Record<string, unknown>;
const holder = vi.hoisted(() => ({ writer: null as Writer | null, db: null as Db | null }));
vi.mock('../../src/data', () => ({ getWriter: () => holder.writer }));
vi.mock('../../src/platform/capabilities', async (orig) => ({ ...(await orig<Record<string, unknown>>()), getDb: () => holder.db }));
vi.mock('../../src/app/unit/done', () => ({ unitDone: () => undefined, setUnitDoneHandler: () => undefined }));

const persist = await import('../../src/features/progress/persist');
const store = await import('../../src/features/today/store');
const S = await import('../../src/features/vocab/session');
const { useDecks } = await import('../../src/features/vocab/decksStore');

const NOW = Date.now();
const DAY = dayKey(NOW);
const settle = () => new Promise((r) => setTimeout(r, 30));

/** Eine ältere Paket-Karte ohne die neuen Felder (so liegen die 443 Einträge heute in der Datenbank). */
function oldPackCard(id: string): { path: string; doc: Doc } {
  const e = packEntry(id);
  if (!e) throw new Error(id);
  const made = packDoc(e, DAY, NOW);
  if (!made) throw new Error(id);
  const { alt: _a, fam: _f, ...rest } = made.doc;
  void _a;
  void _f;
  return { path: made.path, doc: { ...rest, state: 'review', stage: 3, S: 4, D: 5, reps: 3, last: NOW - 5 * 86_400_000, due: NOW - 1000, lapses: 0 } };
}

describe('Neue Paket-Karten behalten Register, Begründung und Varianten', () => {
  it('Wendung (colloc-01) und Wort (family-01)', () => {
    const c = packDoc(packEntry('colloc-01')!, DAY, NOW)!;
    expect(c.doc.register).toBe('neutral');
    expect(typeof c.doc.why).toBe('string');
    expect(c.doc.alt).toEqual(['tackle concerns', 'deal with concerns']);
    const w = packDoc(packEntry('family-01')!, DAY, NOW)!;
    expect(w.doc.register).toBe('formal');
    expect(w.doc.fam).toEqual({ noun: 'compliance', verb: 'comply', adj: 'compliant' });
  });
  it('bestehende Karte: die Felder kommen beim Lesen darüber, die Karte selbst bleibt unverändert', () => {
    const { doc } = oldPackCard('colloc-01');
    const before = JSON.stringify(doc);
    const card = toChunkCard('c-address-concerns', doc, NOW)!;
    const x = packExtraOf(card);
    expect(x?.gap?.at).toBe('address');
    expect(x?.alt).toContain('tackle concerns');
    expect(JSON.stringify(doc)).toBe(before);
    expect(JSON.stringify(card.doc)).toBe(before);
  });
  it('was die Karte selbst trägt (register/why), gewinnt über das Paket', () => {
    const { doc } = oldPackCard('family-01');
    const card = toTrainCard('compliance', { ...doc, register: 'informal', why: 'eigener Text' }, true, NOW)!;
    const x = packExtraOf(card);
    expect(x?.register).toBe('informal');
    expect(x?.why).toBe('eigener Text');
  });
});

describe('Das Öffnen einer Runde schreibt nur reguläre Review-Einträge', () => {
  let h: MemoryDbHandle;
  const plan: StoredPlan = { d: DAY, ids: [], why: [], v: 1, duty: ['review'], goal: { review: 2, due: 2, new: 0, ahead: 0 }, lesson: null, at: 0 };
  beforeEach(() => {
    persist.resetPersistForTests();
    store.resetTodayForTests();
    const a = oldPackCard('colloc-01');
    const b = oldPackCard('word-01');
    const seed = Object.fromEntries([[a.path, a.doc], [b.path, b.doc]]);
    h = createMemoryDb({ seed });
    holder.db = h.db;
    holder.writer = createWriter(h.db);
    useDecks.setState({ decks: readDecks({ v: 1, prefs: { mode: 'auto' } }) });
    const vocab = new Map<string, Doc>([[b.path.slice(6), b.doc]]);
    const chunk = new Map<string, Doc>([[a.path.slice(6), a.doc]]);
    useLive.setState({ day: null, docs: { 'app/profile': { newPerDay: 0 } }, collections: { vocab, chunk } });
    store.useTodayPlan.setState({ day: DAY, plan, status: 'ready', exhausted: null });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(async () => {
    S.commitHeld();
    await persist.flush();
    await settle();
    vi.restoreAllMocks();
    S.useSession.setState({ active: false });
  });

  it('Runde starten und Übungen bauen: kein Schreibvorgang; eine Antwort: nur Karte, Protokoll, Profil', async () => {
    S.startSession('pflicht');
    await settle();
    expect(h.writes()).toHaveLength(0);
    const e = S.useSession.getState().exercise!;
    const before = JSON.stringify((h.dump() as Record<string, Doc>)[e.card.path]);
    S.commitAnswer({ grade: 3, given: e.accepted[0] ?? '', ms: 2000, ok: true });
    await persist.flush();
    await settle();
    const paths = new Set(h.writes().map((w) => w.path));
    for (const p of paths) expect(p === e.card.path || p.startsWith('log/') || p === 'app/profile', p).toBe(true);
    const after = (h.dump() as Record<string, Doc>)[e.card.path]!;
    // Nur Planungsfelder kamen dazu; die Paket-Felder wurden nicht in die Karte geschrieben.
    expect(after.alt).toBeUndefined();
    expect(after.fam).toBeUndefined();
    expect(JSON.stringify(after)).not.toBe(before);
  });
});
