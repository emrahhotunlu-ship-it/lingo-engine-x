import { describe, expect, it } from 'vitest';
import { Catalog } from '../../../src/modules/vocab/domain/catalog';
import { buildDayPlan } from '../../../src/modules/vocab/domain/day';
import { emptyLex } from '../../../src/modules/vocab/domain/planner';
import { SessionRun } from '../../../src/modules/vocab/domain/session';
import { DEFAULT_CFG } from '../../../src/modules/vocab/domain/types';
import { readPace } from '../../../src/modules/vocab/data/shrink';
import { HOLD_SLACK_MS } from '../../../src/modules/vocab/ui/learnRun';
import { D, learned, play, T0, world } from './p2World';

// Großpaket P „Politur“, Paket P2 „Wörter lernen“ (docs/umbau/politur/plan.md §P2, Emrahs Entscheidung E3 vom 13.11.2026):
// Wiederholungen zuerst, Tempo nach Behalten, Hören, „Kennst du es schon?“, schärfere Auswahl, Problemwörter. Hier die Abläufe der Runde
// (LearnRun, ohne React) mit mehreren Wörtern; die reinen Regeln stehen in planner.test.ts, tempo.test.ts und den Tests der einzelnen Dateien.

describe('Wiederholungen zuerst in der Runde (E3)', () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ path: `vocab/r${i}`, lex: learned(`vocab/r${i}`, T0 - 10 * D), order: i }));
  const fresh = (n: number) => Array.from({ length: n }, (_, i) => ({ path: `vocab/n${i}`, lex: emptyLex('w', 'edge', T0), order: 100 + i }));

  it('holdFresh: neue Wörter rücken hinter die Wiederholungen, Reihenfolge untereinander bleibt; danach ändert sich nichts mehr', () => {
    const cat = new Catalog([...mk(12), ...fresh(3)]);
    const { plan } = buildDayPlan(cat, T0, { ...DEFAULT_CFG, min: 21, newPerDay: 3 }, {});
    const run = new SessionRun('pflicht', cat, plan, T0, { cfg: DEFAULT_CFG });
    const before = run.ahead();
    expect(before.filter((s) => s.intro)).toHaveLength(3);
    // Eingestreut: das erste neue Wort steht vor der letzten Wiederholung.
    expect(before.findIndex((s) => s.intro)).toBeLessThan(before.length - 3);
    expect(run.holdFresh()).toBe(true);
    const after = run.ahead();
    expect(after.slice(-3).every((s) => s.intro)).toBe(true);
    expect(after.slice(0, -3).some((s) => s.intro)).toBe(false);
    expect(after.filter((s) => s.intro).map((s) => s.path)).toEqual(before.filter((s) => s.intro).map((s) => s.path));
    expect(after.filter((s) => !s.intro).map((s) => s.path)).toEqual(before.filter((s) => !s.intro).map((s) => s.path));
    expect(run.holdFresh()).toBe(false);
  });

  it('holdFresh(keep): die ersten `keep` neuen Wörter bleiben eingestreut, nur der Rest rückt nach hinten (Prüfbefund BLOCKER)', () => {
    const cat = new Catalog([...mk(12), ...fresh(4)]);
    const { plan } = buildDayPlan(cat, T0, { ...DEFAULT_CFG, min: 25, newPerDay: 4 }, {});
    const run = new SessionRun('pflicht', cat, plan, T0, { cfg: DEFAULT_CFG });
    const before = run.ahead();
    const freshBefore = before.filter((s) => s.intro).map((s) => s.path);
    expect(freshBefore.length).toBeGreaterThanOrEqual(3);
    expect(run.holdFresh(2)).toBe(true);
    const after = run.ahead();
    // Die ersten zwei neuen Wörter stehen an derselben Stelle wie vorher.
    for (const p of freshBefore.slice(0, 2)) expect(after.findIndex((s) => s.path === p && s.intro)).toBe(before.findIndex((s) => s.path === p && s.intro));
    // Der Rest steht hinter der letzten Wiederholung.
    const lastReview = after.reduce((at, s, i) => (s.intro ? at : i), -1);
    for (const p of freshBefore.slice(2)) expect(after.findIndex((s) => s.path === p && s.intro)).toBeGreaterThan(lastReview);
    expect(run.holdFresh(2)).toBe(false);
  });

  it('Runde im Plan: neue Wörter bleiben eingestreut; Runde deutlich langsamer als geplant: erst alle Wiederholungen, der Zeitdeckel nimmt die neuen', async () => {
    // Im Plan (1 s je Karte): das erste neue Wort kommt nach 4 Wiederholungen.
    const quick = world({ due: 12, fresh: 2 });
    await quick.start();
    const q = play(quick);
    // Politur P2 Nr. 6: vor der Einführung eines neuen Einzelworts steht die Vorkarte „Kennst du es schon?“ (hier „Nein, neu“).
    const firstIntro = q.findIndex((x) => x.startsWith('know:'));
    expect(firstIntro).toBe(4);
    expect(q[firstIntro + 1]).toMatch(/^intro:/);
    expect(q.slice(firstIntro).some((x) => x.startsWith('nosent:'))).toBe(true);
    // Langsam (90 s je Karte statt der geplanten 42 s, 18 Wörter-Minuten): die Zeit reicht nicht für alles. Die Untergrenze von zwei neuen
    // Wörtern je Lerntag bleibt aber eingestreut (Prüfbefund BLOCKER 13.11.2026) – der Zeitdeckel nimmt am Ende Wiederholungen weg (sie
    // bleiben fällig und kommen morgen zuerst), nie die Mindestzahl neuer Wörter.
    const slow = world({ due: 12, fresh: 2, tick: () => 30_000 });
    await slow.start();
    const s = play(slow);
    expect(s.filter((x) => x.startsWith('intro:'))).toHaveLength(2);
    // Der Zeitdeckel kürzt den Plan in der Datenbank, dann erst steht der Abschluss.
    for (let i = 0; i < 50 && slow.run.get().k !== 'done'; i++) await new Promise((r) => setTimeout(r, 2));
    const done = slow.run.get();
    expect(done.k).toBe('done');
    await slow.run.settled();
    expect(slow.lexIn('vocab/postpone').intro).not.toBeNull();
    expect(slow.lexIn('vocab/negotiate').intro).not.toBeNull();
    expect(HOLD_SLACK_MS).toBe(60_000);
  });

  it('Doppelt so langsamer Lerner mit vier neuen Wörtern im Plan: weiter mindestens zwei neue am Tag (Prüfbefund BLOCKER)', async () => {
    // Geplant ~42 s je Karte; der Lerner braucht doppelt so lange. Die Wörter-Zeit reicht nicht für alles → Wiederholungen zuerst, aber die
    // Untergrenze MIN_NEW = 2 bleibt eingestreut.
    const slow = world({ due: 12, fresh: 4, tick: () => 28_000 });
    await slow.start();
    const s = play(slow);
    expect(s.filter((x) => x.startsWith('intro:')).length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < 50 && slow.run.get().k !== 'done'; i++) await new Promise((r) => setTimeout(r, 2));
    expect(slow.run.get().k).toBe('done');
  });

  it('Messung neuer Wörter: Einführung (samt Auswahl) und Schritt A gehen als `intro` und `gap_hint` nach vmod/pace', async () => {
    const w = world({ due: 10, fresh: 2, tick: () => 4000 });
    await w.start();
    const seen = play(w);
    expect(seen.filter((x) => x.startsWith('intro:'))).toHaveLength(2);
    expect(seen.filter((x) => x.startsWith('gap_hint:'))).toHaveLength(2);
    await w.run.settled();
    await new Promise((r) => setTimeout(r, 0));
    const pace = readPace(w.h.dump()['vmod/pace']);
    expect(pace?.nosent).toBeGreaterThan(0);
    // Vorher blieben beide ungemessen (der Plan rechnete neue Wörter immer mit dem Startwert).
    expect(pace?.intro).toBeGreaterThanOrEqual(5000);
    expect(pace?.gap_hint).toBeGreaterThanOrEqual(5000);
  });
});
