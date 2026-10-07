import { describe, expect, it } from 'vitest';
import { allSeedTasks } from '../../src/domain/grammar/tasks';
import { reviewError } from '../../src/domain/grammar/errors';
import { dueFehlersaetze } from '../../src/domain/repair/fehlersaetze';
import { repairCards, variantFor } from '../../src/domain/repair/variant';
import { berlin } from './helpers';

// Schritt 4, Varianten (Lernplattform 2.0 §5.7, P8): Box 0 zeigt den neuesten falschen Satz, ab Box 1 mit Muster eine ungesehene
// find-/gap-Aufgabe desselben Musters; gebucht wird am Originaleintrag. Reparatur-Sätze ohne Muster zeigen den eigenen Satz.

const TODAY = '2026-10-05';
const NOW = berlin(TODAY, 18);
const DAY = 86_400_000;
type Doc = Record<string, unknown>;
const TOPIC = 'mixed-cond';
const PAT = 'mc.past-cond';
const Q = 'If I would have known, I would have called you.';
const FIXED = 'If I had known, I would have called you.';
const entry = (extra: Doc = {}): Doc => ({ q: Q, given: Q, ans: FIXED, t: NOW - 5 * DAY, src: 'test', pat: PAT, box: 1, due: NOW - DAY, ...extra });
const docs = (e: Doc, extra: Doc = {}): ReadonlyMap<string, Doc> => new Map([[TOPIC, { errors: [e], ...extra }]]);
const cardsOf = (g: ReadonlyMap<string, Doc>, repairDoc: Doc | null = null) => repairCards({ items: dueFehlersaetze({ grammarDocs: g, repairDoc, nowMs: NOW, today: TODAY }), grammarDocs: g, repairDoc });

describe('Varianten der Fehlerschlange', () => {
  it('Box 0: der falsche Satz selbst – der neueste aus `more`, sonst `q`', () => {
    const more = [{ q: 'If we would have asked, we would have known.', given: 'If we would have asked, we would have known.', ans: 'If we had asked, we would have known.', t: NOW - 2 * DAY }];
    const [withMore] = cardsOf(docs(entry({ box: 0, more })));
    expect(withMore?.variant).toBeNull();
    expect(withMore?.wrong).toBe('If we would have asked, we would have known.');
    expect(withMore?.right).toBe('If we had asked, we would have known.');
    const [plain] = cardsOf(docs(entry({ box: 0 })));
    expect(plain?.wrong).toBe(Q);
  });

  it('ab Box 1 mit Muster: ungesehene find-/gap-Aufgabe desselben Musters, nie der Originalsatz', () => {
    const [c] = cardsOf(docs(entry()));
    expect(c?.variant).not.toBeNull();
    const v = c!.variant!;
    expect(v.topic).toBe(TOPIC);
    expect(v.pat).toBe(PAT);
    expect(['find', 'gap']).toContain(v.type);
    expect(v.prompt).not.toBe(Q);
    // Gebucht wird am Original.
    expect(c).toMatchObject({ id: expect.stringContaining('g:mixed-cond:') as string, store: 'grammar', topic: TOPIC, errorT: NOW - 5 * DAY, box: 1 });
  });

  it('gesehene Aufgaben (`seen`) kommen nicht wieder; ist alles gesehen, bleibt der Originalsatz', () => {
    const same = allSeedTasks().filter((t) => t.topic === TOPIC && t.pat === PAT && (t.type === 'find' || t.type === 'gap'));
    expect(same.length).toBeGreaterThan(1);
    const keepOne = same[0]!;
    const seenAllButOne = same.slice(1).map((t) => t.key);
    const [one] = cardsOf(docs(entry(), { seen: seenAllButOne }));
    expect(one?.variant?.key).toBe(keepOne.key);
    const [none] = cardsOf(docs(entry(), { seen: same.map((t) => t.key) }));
    expect(none?.variant).toBeNull();
    expect(none?.wrong).toBe(Q);
  });

  it('nur eingeführte Muster: ein Thema mit `pats` ohne dieses Muster liefert keine Variante', () => {
    const [c] = cardsOf(docs(entry(), { pats: { 'mc.other': { n: 3, i: '2026-10-01' } } }));
    expect(c?.variant).toBeNull();
    const [ok] = cardsOf(docs(entry(), { pats: { [PAT]: { n: 2 } } }));
    expect(ok?.variant).not.toBeNull();
  });

  it('Reparatur-Sätze ohne Muster zeigen immer den eigenen Satz', () => {
    const rep = { items: [{ id: 'r1', wrong: 'I am agree with you.', right: 'I agree with you.', src: 'say', t: NOW - 4 * DAY, box: 2, due: NOW - DAY }] };
    const [c] = cardsOf(new Map(), rep);
    expect(c).toMatchObject({ store: 'repair', variant: null, wrong: 'I am agree with you.', box: 2, pat: null });
  });

  it('die Variante hängt am Eintrag und an der Wiederholung (nicht zufällig je Aufruf)', () => {
    const a = variantFor({ topic: TOPIC, pat: PAT, q: Q, doc: { errors: [] }, seed: 'x|0|1' });
    const b = variantFor({ topic: TOPIC, pat: PAT, q: Q, doc: { errors: [] }, seed: 'x|0|1' });
    expect(a?.key).toBe(b?.key);
  });

  it('richtig am Original: die Box des Eintrags steigt (Buchung wie `reviewError`)', () => {
    const e = entry() as Parameters<typeof reviewError>[0][number];
    const after = reviewError([e], NOW - 5 * DAY, { ok: true, given: '', grade: 3, t: NOW });
    expect(after?.[0]?.box).toBe(2);
    const wrong = reviewError([e], NOW - 5 * DAY, { ok: false, given: 'x', grade: 1, t: NOW });
    expect(wrong?.[0]?.box).toBe(0);
  });
});
