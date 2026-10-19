import { describe, expect, it } from 'vitest';
import { buildLearnerModel, PROOF_MAX, PROOF_MIN, PROOF_STEP, progressProof } from '../../src/domain/tutor/learner';

// Fortschrittsbeleg (Tutor-Engine v3 S2): nur aus Daten, nie erfunden; richtig heißt „sauber ohne Hilfe“. Alle Daten sind erfunden.

const TODAY = '2026-10-19';
const at = (day: string, h = 12): number => new Date(`${day}T${String(h).padStart(2, '0')}:00:00`).getTime();
const row = (day: string, clean: boolean, typed = true, h = 8) => ({ t: at(day, h), day, clean, typed });
const many = (day: string, oks: boolean[]) => oks.map((ok, i) => row(day, ok, true, 8 + i));
const n = (k: number, ok: boolean): boolean[] => Array<boolean>(k).fill(ok);

describe('progressProof', () => {
  it('vor 3 Wochen 4 von 9, jetzt 8 von 9', () => {
    const rows = [...many('2026-09-28', [...n(4, true), ...n(5, false)]), ...many('2026-10-17', [...n(8, true), false])];
    expect(progressProof(rows, TODAY)).toEqual({ thenOk: 4, thenN: 9, nowOk: 8, nowN: 9, weeks: 3, trend: 'up' });
  });

  it('zu wenige Antworten in einem Fenster (unter 6): kein Beleg (nie erfunden)', () => {
    expect(PROOF_MIN).toBe(6);
    expect(progressProof([...many('2026-09-28', [true, ...n(5, false)]), ...many('2026-10-18', n(5, true))], TODAY)).toBeNull();
    expect(progressProof([...many('2026-09-28', [true, ...n(4, false)]), ...many('2026-10-18', n(6, true))], TODAY)).toBeNull();
    expect(progressProof([], TODAY)).toBeNull();
  });

  it('Rauschen ist kein Erfolg: „besser“ braucht mindestens 2 saubere Antworten mehr', () => {
    expect(PROOF_STEP).toBe(2);
    // 1 von 6 → 2 von 6: nur eine mehr (17 Prozentpunkte) → flat.
    expect(progressProof([...many('2026-09-28', [true, ...n(5, false)]), ...many('2026-10-18', [true, true, ...n(4, false)])], TODAY)?.trend).toBe('flat');
    // 2 von 9 → 2 von 6: 11 Prozentpunkte, keine mehr → flat.
    expect(progressProof([...many('2026-09-28', [true, true, ...n(7, false)]), ...many('2026-10-18', [true, true, ...n(4, false)])], TODAY)?.trend).toBe('flat');
    // 1 von 6 → 3 von 6: zwei mehr, 33 Prozentpunkte → up.
    expect(progressProof([...many('2026-09-28', [true, ...n(5, false)]), ...many('2026-10-18', [...n(3, true), ...n(3, false)])], TODAY)?.trend).toBe('up');
  });

  it('nur getippte Antworten zählen', () => {
    const rows = [...many('2026-09-28', n(6, false)), ...many('2026-10-18', n(5, true)), row('2026-10-18', true, false, 20)];
    expect(progressProof(rows, TODAY)).toBeNull();
  });

  it('die Lücke (8–13 Tage zurück) zählt in keinem Fenster', () => {
    const rows = [...many('2026-10-08', n(6, false)), ...many('2026-10-18', n(6, true))];
    expect(progressProof(rows, TODAY)).toBeNull();
  });

  it('je Fenster höchstens die jüngsten 9', () => {
    const rows = [...many('2026-09-20', n(12, false)), ...many('2026-09-30', n(3, true)), ...many('2026-10-19', n(15, true))];
    const p = progressProof(rows, TODAY);
    expect(p?.thenN).toBe(PROOF_MAX);
    expect(p?.thenOk).toBe(3);
    expect(p?.nowN).toBe(PROOF_MAX);
    expect(p?.weeks).toBe(3);
  });

  it('Zeilen nach heute zählen nicht; Wochen mindestens 2', () => {
    const rows = [...many('2026-10-05', n(6, true)), ...many('2026-10-19', n(6, true)), ...many('2026-10-20', n(6, false))];
    expect(progressProof(rows, TODAY)).toEqual({ thenOk: 6, thenN: 6, nowOk: 6, nowN: 6, weeks: 2, trend: 'flat' });
  });

  it('Verschlechterung heißt „down“', () => {
    const rows = [...many('2026-09-28', n(6, true)), ...many('2026-10-17', [true, ...n(5, false)])];
    expect(progressProof(rows, TODAY)?.trend).toBe('down');
  });

  it('Reihenfolge der Eingabe egal', () => {
    const rows = [...many('2026-09-28', [true, false, false, false, true, false]), ...many('2026-10-17', [true, true, true, true, false, true])];
    expect(progressProof([...rows].reverse(), TODAY)).toEqual(progressProof(rows, TODAY));
  });
});

describe('progressProof aus dem Protokoll: nur saubere Antworten, „Weiß ich nicht“ im Nenner', () => {
  // gap-Aufgabe des Musters psp.since-for (Thema past-simple-perfect); die Musterkennung steht in der Zeile.
  const entry = (day: string, h: number, x: { ok: boolean; g?: number; override?: boolean; given?: string }) => ({
    t: at(day, h),
    ok: x.ok,
    lang: 'de',
    k: 'g',
    topic: 'past-simple-perfect',
    type: 'gap',
    q: 'I have worked here ___ 2019.',
    given: x.given ?? (x.ok ? 'since' : 'for'),
    ans: 'since',
    pat: 'psp.since-for',
    ...(x.g !== undefined ? { g: x.g } : {}),
    ...(x.override ? { override: true } : {}),
  });
  const logsOf = (rows: Array<ReturnType<typeof entry>>) => {
    const logs = new Map<string, { entries: unknown[] }>();
    for (const r of rows) {
      const d = new Date(r.t);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const doc = logs.get(k) ?? { entries: [] };
      doc.entries.push(r);
      logs.set(k, doc);
    }
    return logs;
  };
  const NOW = at(TODAY, 18);
  const model = (rows: Array<ReturnType<typeof entry>>) =>
    buildLearnerModel({ logs: logsOf(rows), grammarDocs: new Map(), vocab: new Map(), act: new Map(), profile: null, diag: [] }, NOW);

  it('Hilfe (Note 2), „Zählt“ und „Weiß ich nicht“ zählen nicht als richtig; „Weiß ich nicht“ steht im Nenner', () => {
    const then = [0, 1, 2, 3, 4, 5].map((i) => entry('2026-09-28', 8 + i, i < 2 ? { ok: true, g: 3 } : { ok: false, g: 1 }));
    const now = [
      entry('2026-10-18', 8, { ok: true, g: 3 }),
      entry('2026-10-18', 9, { ok: true, g: 4 }),
      entry('2026-10-18', 10, { ok: true, g: 3 }),
      entry('2026-10-18', 11, { ok: true, g: 3 }),
      entry('2026-10-18', 12, { ok: true, g: 2 }), // mit Hilfe: richtig, aber nicht sauber
      entry('2026-10-18', 13, { ok: true, g: 3, override: true }), // „Zählt“
      entry('2026-10-18', 14, { ok: false, g: 1, given: "(don't know)" }), // „Weiß ich nicht“
    ];
    const m = model([...then, ...now]);
    expect(m.proofs?.get('psp.since-for')).toEqual({ thenOk: 2, thenN: 6, nowOk: 4, nowN: 7, weeks: 3, trend: 'up' });
    // Dieselbe Definition für die 28-Tage-Quote („Warum diese Aufgabe?“).
    expect(m.patterns.get('psp.since-for')?.q28).toEqual({ n: 13, ok: 6 });
  });
});
