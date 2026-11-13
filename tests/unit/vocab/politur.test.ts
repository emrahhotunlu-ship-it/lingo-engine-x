import { describe, expect, it } from 'vitest';
import { createWriter } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { type CheckDict } from '../../../src/modules/vocab/domain/check';
import { Catalog } from '../../../src/modules/vocab/domain/catalog';
import { buildDayPlan } from '../../../src/modules/vocab/domain/day';
import { applyAnswer, emptyLex, introduce, type PlanCtx } from '../../../src/modules/vocab/domain/planner';
import { SessionRun } from '../../../src/modules/vocab/domain/session';
import { DEFAULT_CFG, type Lex } from '../../../src/modules/vocab/domain/types';
import { readPace } from '../../../src/modules/vocab/data/shrink';
import { HOLD_SLACK_MS, LearnRun, type LearnEnv, type LearnStart, type LearnView } from '../../../src/modules/vocab/ui/learnRun';

// Großpaket P „Politur“, Paket P2 „Wörter lernen“ (docs/umbau/politur/plan.md §P2, Emrahs Entscheidung E3 vom 13.11.2026):
// Wiederholungen zuerst, Tempo nach Behalten, Hören, „Kennst du es schon?“, schärfere Auswahl, Problemwörter. Hier die Abläufe der Runde
// (LearnRun, ohne React) mit mehreren Wörtern; die reinen Regeln stehen in planner.test.ts, tempo.test.ts und den Tests der einzelnen Dateien.

type Doc = Record<string, unknown>;
export const T0 = Date.parse('2026-11-12T18:00:00Z'); // Do 19:00 Berlin
export const D = 86_400_000;
const dict: CheckDict = { isWord: () => false, misspell: new Map(), confusable: new Map(), toUS: (w) => w };
const ctx = (path: string): PlanCtx => ({ cfg: DEFAULT_CFG, path, planned: true, load: () => 0, siblings: new Set() });
/** Tagesziel 25 Minuten → 18 Wörter-Minuten (Emrahs echte Einstellung). */
export const PROFILE: Doc = { vcfg: { min: 15, ret: 0.9, mod: 1 }, goalMin: 25, newPerDay: 10 };
const SCHEMA: Doc = { vocabModule: { v: 1, t: 1, state: 'done' } };

/** Ein gelerntes Wort (Einführung, Schritt A und B am Tag `t`), Benutzen- und Verstehen-Termin gestern → heute fällig. */
export function learned(path: string, t: number, dueAt = T0 - D): Lex {
  let l = introduce(emptyLex('w', 'edge', t), t);
  l = applyAnswer(l, { t: t + 60_000, form: 'gap_hint', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx(path)).lex;
  l = applyAnswer(l, { t: t + 300_000, form: 'gap', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx(path)).lex;
  return { ...l, u: { ...l.u, due: dueAt }, b: { ...l.b!, due: dueAt } };
}

const WORDS: [string, string, string, string][] = [
  ['scope', 'Umfang, Rahmen', 'noun', 'We need to define the scope of the project.'],
  ['invoice', 'Rechnung', 'noun', 'Please send the invoice by Friday.'],
  ['deadline', 'Frist, Termin', 'noun', 'We cannot move the deadline again.'],
  ['budget', 'Budget, Etat', 'noun', 'The budget for this quarter is tight.'],
  ['supplier', 'Lieferant', 'noun', 'Our supplier raised the prices in May.'],
  ['approval', 'Genehmigung, Zustimmung', 'noun', 'We still need approval from the board.'],
  ['revenue', 'Umsatz, Erlös', 'noun', 'Our revenue grew by ten percent.'],
  ['contract', 'Vertrag', 'noun', 'The contract ends in December.'],
  ['shipment', 'Lieferung, Sendung', 'noun', 'The shipment arrived two days late.'],
  ['warranty', 'Garantie, Gewährleistung', 'noun', 'The warranty covers all repairs.'],
  ['meeting', 'Besprechung', 'noun', 'The meeting starts at nine.'],
  ['customer', 'Kunde', 'noun', 'The customer asked for a discount.'],
  ['postpone', 'verschieben, aufschieben', 'verb', 'We had to postpone the launch.'],
  ['negotiate', 'verhandeln', 'verb', 'They want to negotiate the price.'],
  ['reliable', 'zuverlässig', 'adj', 'She is a reliable partner.'],
  ['thorough', 'gründlich, sorgfältig', 'adj', 'He did a thorough review.'],
];

export function wordDoc(i: number, lex: Lex, over: Doc = {}): [string, Doc] {
  const [word, de, pos, ex] = WORDS[i]!;
  return [`vocab/${word}`, { word, de, pos, ex, order: i, lex, ...over }];
}

/** Welt mit mehreren Wörtern: `due` gelernte, heute fällige und `fresh` neue (in der Reihenfolge von WORDS). */
export function world(o: { due?: number; fresh?: number; docs?: [string, Doc][]; profile?: Doc; tick?: () => number; seed?: Record<string, Doc>; env?: Partial<LearnEnv> } = {}) {
  const docs: [string, Doc][] = o.docs ?? [
    ...Array.from({ length: o.due ?? 0 }, (_, i) => wordDoc(i, learned(`vocab/${WORDS[i]![0]}`, T0 - 10 * D))),
    ...Array.from({ length: o.fresh ?? 0 }, (_, i) => wordDoc((o.due ?? 0) + i, emptyLex('w', 'edge', T0 - 5 * D))),
  ];
  const h = createMemoryDb({ seed: { ...Object.fromEntries(docs), ...(o.seed ?? {}) } });
  let now = T0;
  const tick = o.tick ?? (() => 1000);
  let value: string | null = null;
  const drafts = { get: () => value, set: (v: string) => void (value = v), remove: () => void (value = null) };
  const read = (path: string): Promise<Doc | null> => Promise.resolve(h.dump()[path] ?? null);
  const run = new LearnRun({ deps: { writer: createWriter(h.db), device: 'phone' }, dict, lang: () => 'de', drafts, readDay: () => read('vmod/day'), read, now: () => (now += tick()), ...(o.env ?? {}) });
  const profile = o.profile ?? PROFILE;
  const start = (kind: LearnStart['kind'] = 'pflicht') => run.start({ kind, docs, profile, schema: SCHEMA });
  const lexIn = (path: string) => (h.dump()[path] as Doc).lex as Lex;
  const tuples = () =>
    Object.entries(h.dump())
      .filter(([p]) => /^vlog\/\d/.test(p))
      .flatMap(([, d]) => Object.values(d.e as Doc).filter(Boolean) as unknown[][])
      .sort((a, b) => (a[0] as number) - (b[0] as number));
  return { h, run, start, lexIn, tuples, docs, read, setNow: (t: number) => void (now = t) };
}

/**
 * Spielt die Runde bis zum Ende: Einführungen bestätigen, Vorkarten mit „Nein, neu“, Auswahl richtig, Abfragen richtig – außer `wrong`
 * enthält den Pfad (dann beim ersten Mal falsch). Liefert die Folge der gezeigten Karten als kurze Kennungen.
 */
export function play(w: ReturnType<typeof world>, o: { wrong?: ReadonlySet<string>; max?: number; onView?: (v: LearnView) => void } = {}): string[] {
  const seen: string[] = [];
  const failed = new Set<string>();
  for (let i = 0; i < (o.max ?? 300); i++) {
    const v = w.run.get();
    o.onView?.(v);
    if (v.k === 'start') {
      w.run.begin();
      continue;
    }
    if (v.k === 'pick') {
      seen.push(`pick:${v.path}`);
      w.run.pickChoose(v.right);
      w.run.pickNext();
      continue;
    }
    if (v.k !== 'card') break;
    if (v.kind === 'intro') {
      seen.push(`intro:${v.task.path}`);
      w.run.introSeen({ ms: 4000, fk: 0 });
      continue;
    }
    seen.push(`${v.card.form}:${v.task.path}`);
    const bad = !!o.wrong?.has(v.task.path) && !failed.has(v.task.path);
    if (bad) failed.add(v.task.path);
    const right = v.card.mode === 'meaning' ? v.card.de.split(',')[0]! : v.card.answer;
    w.run.check(bad ? 'zzzz' : right, { ms: 5000, fk: 1500 });
    w.run.next();
  }
  return seen;
}

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

  it('Runde im Plan: neue Wörter bleiben eingestreut; Runde deutlich langsamer als geplant: erst alle Wiederholungen, der Zeitdeckel nimmt die neuen', async () => {
    // Im Plan (1 s je Karte): das erste neue Wort kommt nach 4 Wiederholungen.
    const quick = world({ due: 12, fresh: 2 });
    await quick.start();
    const q = play(quick);
    const firstIntro = q.findIndex((x) => x.startsWith('intro:'));
    expect(firstIntro).toBe(4);
    expect(q.slice(firstIntro).some((x) => x.startsWith('nosent:'))).toBe(true);
    // Langsam (90 s je Karte statt der geplanten 42 s, 18 Wörter-Minuten): die Zeit reicht nur für die 12 Wiederholungen → sie kommen alle,
    // keine Einführung davor; der Zeitdeckel nimmt am Ende die zwei neuen Wörter weg.
    const slow = world({ due: 12, fresh: 2, tick: () => 30_000 });
    await slow.start();
    const s = play(slow);
    expect(s.some((x) => x.startsWith('intro:'))).toBe(false);
    expect(s.filter((x) => x.startsWith('nosent:'))).toHaveLength(12);
    // Der Zeitdeckel kürzt den Plan in der Datenbank, dann erst steht der Abschluss.
    for (let i = 0; i < 50 && slow.run.get().k !== 'done'; i++) await new Promise((r) => setTimeout(r, 2));
    const done = slow.run.get();
    expect(done.k).toBe('done');
    if (done.k === 'done') expect(done.capped).toBe(2);
    // Die neuen Wörter sind unberührt (bleiben neu, kommen morgen).
    await slow.run.settled();
    expect(slow.lexIn('vocab/postpone').intro).toBeNull();
    expect(HOLD_SLACK_MS).toBe(60_000);
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
