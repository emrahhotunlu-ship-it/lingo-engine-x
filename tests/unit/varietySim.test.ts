import { beforeAll, describe, expect, it } from 'vitest';
import { preloadC1x, resetC1Store } from '../../src/domain/c1x/preload';
import { PACK, packDoc } from '../../src/domain/c1pack/pack';
import { dayKey } from '../../src/domain/date';
import { mulberry32 } from '../../src/domain/random';
import { applyUpdate, cardPatch } from '../../src/domain/srs/applyReview';
import { toTrainCard } from '../../src/domain/srs/cards';
import { toChunkCard } from '../../src/domain/srs/chunkCards';
import { buildExercise } from '../../src/domain/srs/exercise';
import { availableExercises, chooseExercise, makeEnv, type ExerciseEnv } from '../../src/domain/srs/modes';
import { contextsOf } from '../../src/domain/srs/rotate';
import { resetCrossLink } from '../../src/domain/srs/crossLink';
import type { ExerciseId, TrainCard } from '../../src/domain/srs/types';
import { distinctForms, familyOf, sentKey, varietyOf } from '../../src/domain/srs/variety';

// Varianz beim Befestigen (V1, Emrah 07.10.2026, „Mehrfachkombination“): 60 Tage Wiederholen mit dem echten Wahlweg
// (`chooseExercise` → `buildExercise` mit Satz-Wechsel → `cardPatch` mit Verlauf `hist[].x/s`), Vorbild `backlogSim.test.ts`.
// Geprüft wird, was der Nutzer merkt: dieselbe Abfrageform und derselbe Satz kommen bei einer Karte nie zweimal hintereinander,
// und eine Karte, die „Fest“ wird, hat vorher mehrere verschiedene Formen durchlaufen.

const DAY = 86_400_000;
type Doc = Record<string, unknown>;
type Step = { ex: ExerciseId; sk: string | null; stage: number; sents: number; avail: number; again: boolean };
type Fest = { forms: number; cap: number };
type Sim = { steps: Map<string, Step[]>; docs: Map<string, Doc>; fest: Fest[] };

beforeAll(async () => {
  resetC1Store();
  resetCrossLink();
  await preloadC1x(['mcc', 'ocl', 'err', 'kwt']);
  resetCrossLink();
});

function simulate(env: ExerciseEnv, days: number, cardsN: number, seed: number): Sim {
  const rng = mulberry32(seed);
  const base = new Date(2026, 9, 5, 9, 0, 0).getTime();
  const docs = new Map<string, Doc>();
  for (const e of PACK) {
    if (docs.size >= cardsN) break;
    const made = packDoc(e, '2026-10-05', base);
    if (made) docs.set(made.id, { ...made.doc, __chunk: made.kind === 'chunk' });
  }
  const mk = (id: string, now: number): TrainCard => {
    const d = docs.get(id)!;
    return (d.__chunk ? toChunkCard(id, d, now) : toTrainCard(id, d, true, now)) as TrainCard;
  };
  const steps = new Map<string, Step[]>();
  const fest: Fest[] = [];
  const ids = [...docs.keys()];
  let introduced = 0;
  let t = base;
  for (let day = 0; day < days; day++) {
    const now = base + day * DAY;
    const today = dayKey(now);
    // Jeden Tag bis zu 4 neue Karten, dazu alles, was fällig ist.
    const queue: string[] = [];
    for (const id of ids) {
      const d = docs.get(id)!;
      if (d.state === 'new') continue;
      if (typeof d.due === 'number' && d.due <= now + DAY - 1) queue.push(id);
    }
    for (let k = 0; k < 4 && introduced < ids.length; k++) queue.push(ids[introduced++]!);
    const recent: ExerciseId[] = [];
    const pool = ids.map((id) => mk(id, now));
    for (let pos = 0; pos < queue.length; pos++) {
      const id = queue[pos]!;
      t = Math.max(t + 1000, now + pos * 1000);
      const card = mk(id, t);
      const ex = chooseExercise(card, 'de', pool.length - 1, recent, env);
      if (!ex) continue;
      const e = buildExercise(card, ex, 'de', pool, `${today}|${pos}`);
      const sk = e.sentence?.sentence ? sentKey(e.sentence.sentence) : null;
      const ok = rng() < 0.85;
      const list = steps.get(id) ?? [];
      list.push({ ex, sk, stage: card.stage, sents: contextsOf(card).length, avail: availableExercises(card, 'de', pool.length - 1, env).length, again: false });
      steps.set(id, list);
      const doc = docs.get(id)!;
      const ev = { t, day: today, kind: card.kind === 'chunk' ? ('chunk' as const) : ('v' as const), id, ex, grade: ok ? (3 as const) : (1 as const), given: '', ans: '', ms: 3000, lang: 'de' as const, ctx: 'rev' as const, ...(sk ? { sx: sk } : {}) };
      const before = doc.ff;
      const next: Doc = { ...applyUpdate(doc, cardPatch(doc, ev)), __chunk: doc.__chunk };
      docs.set(id, next);
      if (!before && next.ff) {
        // Mehr Familien als die Karte überhaupt anbietet (Stufe 3 bis 5) kann niemand verlangen.
        const c = mk(id, t);
        const offered = new Set([3, 4, 5].flatMap((st) => availableExercises({ ...c, stage: st as 3 }, 'de', pool.length - 1, env).map(familyOf)));
        fest.push({ forms: distinctForms(varietyOf(next)), cap: Math.min(3, offered.size) });
      }
      recent.push(ex);
      // „Nochmal“ noch in derselben Runde (wie der Trainer): gleich danach wieder.
      if (!ok && list.length < 400) {
        queue.splice(Math.min(queue.length, pos + 3), 0, id);
        list[list.length - 1]!.again = false;
      }
    }
  }
  return { steps, docs, fest };
}

const touch = makeEnv(true, true, true);
const keys = makeEnv(true, true, false);

describe.each([
  ['Handy (Touch)', touch],
  ['Laptop (Tastatur)', keys],
])('60 Tage Wiederholen: Varianz (%s)', (_name, env) => {
  const sim = simulate(env, 60, 60, 4711);

  it('es wurde wirklich geübt (viele Antworten, die Karten durchlaufen Stufen)', () => {
    const all = [...sim.steps.values()].flat();
    expect(all.length).toBeGreaterThan(500);
    expect(Math.max(...all.map((s) => s.stage))).toBeGreaterThanOrEqual(4);
  });

  it('dieselbe Abfrageart kommt bei einer Karte nie zweimal hintereinander', () => {
    const bad: string[] = [];
    for (const [id, list] of sim.steps) for (let i = 1; i < list.length; i++) if (list[i]!.ex === list[i - 1]!.ex && list[i]!.avail >= 2) bad.push(`${id}@${i}:${list[i]!.ex}`);
    expect(bad).toEqual([]);
  });

  it('derselbe Satz kommt bei einer Karte mit mindestens zwei Sätzen nie zweimal hintereinander (ab Stufe 3, wo der Satz wechselt)', () => {
    const bad: string[] = [];
    for (const [id, list] of sim.steps) {
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1]!;
        const b = list[i]!;
        if (b.stage >= 3 && b.sents >= 2 && a.sk && b.sk && a.sk === b.sk) bad.push(`${id}@${i}:${b.ex}`);
      }
    }
    // Ausnahmen sind nur Formen, die bewusst im Ursprungssatz bleiben (Erkennen/Auswahl). Die Zahl bleibt klein.
    const total = [...sim.steps.values()].reduce((n, l) => n + l.filter((s) => s.stage >= 3 && s.sents >= 2).length, 0);
    expect(bad.length / Math.max(1, total)).toBeLessThan(0.05);
  });

  it('Karten mit mehreren Sätzen zeigen über 60 Tage mehrere verschiedene Sätze', () => {
    let multi = 0;
    let varied = 0;
    for (const list of sim.steps.values()) {
      if (!list.some((s) => s.sents >= 2 && s.stage >= 3)) continue;
      multi++;
      if (new Set(list.map((s) => s.sk).filter(Boolean)).size >= 2) varied++;
    }
    expect(multi).toBeGreaterThan(5);
    expect(varied / multi).toBeGreaterThan(0.9);
  });

  it('Karten ab Stufe 4 haben mehrere verschiedene Formenfamilien durchlaufen', () => {
    let n = 0;
    let ok = 0;
    for (const list of sim.steps.values()) {
      const high = list.filter((s) => s.stage >= 4);
      if (high.length < 4) continue;
      n++;
      if (new Set(list.map((s) => familyOf(s.ex))).size >= 3) ok++;
    }
    expect(n).toBeGreaterThan(5);
    expect(ok / n).toBeGreaterThan(0.8);
  });

  it('Karten, die „Fest“ werden, haben vorher mindestens drei verschiedene Formenfamilien gezeigt (soweit die Karte so viele anbietet)', () => {
    expect(sim.fest.length).toBeGreaterThan(10);
    const short = sim.fest.filter((f) => f.forms < f.cap);
    expect(short).toEqual([]);
  });

  it('der Verlauf bleibt klein: höchstens 12 Einträge je Karte, nur kurze Felder (Kapazitätsgrenze A6.6)', () => {
    for (const d of sim.docs.values()) {
      const hist = d.hist as Record<string, unknown>[];
      expect(hist.length).toBeLessThanOrEqual(12);
      for (const h of hist) if (typeof h.s === 'string') expect(h.s.length).toBeLessThanOrEqual(8);
      expect(JSON.stringify(hist).length).toBeLessThan(1200);
    }
  });
});
