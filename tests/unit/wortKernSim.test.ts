import { describe, expect, it } from 'vitest';
import { addDays, dayKey, daysBetween, learningDayEnd } from '../../src/domain/date';
import { applyUpdate, reviewWrite } from '../../src/domain/srs/applyReview';
import { readFsrs } from '../../src/domain/srs/scheduler';
import { toTrainCard } from '../../src/domain/srs/cards';
import { CAP_STEPS, recallStep, wantsFreeRecall } from '../../src/domain/srs/spacing';
import { isFest, unitState } from '../../src/domain/metrics/definitions';
import type { AnswerEvent, ExerciseId } from '../../src/domain/srs/types';
import { berlin } from './helpers';

// Wort-Lernen 2, Paket „Kern“ (21.10.2026): Simulation einer Karte über den echten Schreibweg (reviewWrite → applyUpdate), Tag für Tag um 09:00.
// Fällig ist eine Karte wie in der App, wenn `due` vor dem Ende des Lerntags (04:00 des Folgetags) liegt.
// Geprüft wird: Tag 0 (Abruf 1 mit Anfangsbuchstabe, Abruf 2 frei) → Tag 1 (Gestern-Check) → Deckel 1/3/7/21 Tage → freier Abruf nach ≥ 21 Tagen
// Pause → „Fest“. Und: Erkennen/Aufdecken hebt den Abstand nie über den Deckel.

type Doc = Record<string, unknown>;
const START = '2026-10-22';
const MIN = 60_000;

const fresh = (): Doc => ({ word: 'leverage', de: 'nutzen', def: 'to use something to get an advantage', ex: 'We can [leverage] our network.', pos: 'verb', state: 'new', S: 0, D: 5, last: 0, due: 0, reps: 0, lapses: 0, stage: 0, src: 'lookup', added: START });

let sxN = 0;
function answer(cur: Doc, t: number, day: string, ex: ExerciseId, grade: 1 | 2 | 3 | 4): Doc {
  const a: AnswerEvent = { t, day, kind: 'v', id: 'leverage', ex, grade, given: grade >= 3 ? 'leverage' : 'levrage', ans: 'leverage', ms: 4000, lang: 'de', ctx: 'rev', sx: `s${sxN++ % 5}` };
  const w = reviewWrite('vocab/leverage', cur, a, null);
  if (w.kind !== 'update') throw new Error(`kein Update: ${JSON.stringify(w)}`);
  return applyUpdate(cur, w.patch);
}

/** Abstand in Lerntagen zwischen heute und der Fälligkeit. */
const gapDays = (doc: Doc, day: string, t: number): number => daysBetween(day, dayKey(readFsrs(doc, t).due));

type Step = { day: string; n: number; ex: ExerciseId; gap: number; stage: number; state: string };

function run(exFor: (n: number, dayN: number, doc: Doc) => ExerciseId, days: number) {
  sxN = 0;
  let doc = fresh();
  const path: Step[] = [];
  // Tag 0: Abruf 1 (Anfangsbuchstabe) nach den ersten Karten, Abruf 2 (frei) nach weiteren Karten.
  let t = berlin(START, 9);
  doc = answer(doc, t, START, 'cloze_hint', 3);
  const afterHint = readFsrs(doc, t);
  t += 15 * MIN;
  doc = answer(doc, t, START, 'cloze', 3);
  path.push({ day: START, n: 0, ex: 'cloze', gap: gapDays(doc, START, t), stage: Number(doc.stage), state: String(readFsrs(doc, t).state) });
  let fest: string | null = null;
  let n = 0;
  for (let i = 1; i <= days; i++) {
    const day = addDays(START, i);
    t = berlin(day, 9);
    const f = readFsrs(doc, t);
    if (!(f.due < learningDayEnd(t))) continue;
    n++;
    if (n === 1) expect(recallStep({ isNew: false, doc }, day), 'Tag 1 ist der Gestern-Check').toBe('check');
    const ex = exFor(n, i, doc);
    doc = answer(doc, t, day, ex, 3);
    path.push({ day, n, ex, gap: gapDays(doc, day, t), stage: Number(doc.stage), state: String(readFsrs(doc, t).state) });
    const card = toTrainCard('leverage', doc, true, t);
    if (!fest && card && isFest(card, t)) fest = day;
  }
  return { doc, path, fest, afterHint };
}

describe('Simulation: eine Karte vom Tag 0 bis „Fest“ (Wort-Lernen 2)', () => {
  it('nur getippte Abrufe: Tag 0 → Tag 1 → 3 → 7 → 21 Tage, dann Fest nach dem freien Abruf nach ≥ 21 Tagen Pause', () => {
    const { path, fest, afterHint, doc } = run(() => 'cloze', 120);
    // Abruf 1 mit Anfangsbuchstabe beendet die Lernphase nicht: in 10 Minuten wieder dran.
    expect(afterHint.state).toBe(1);
    // Tag 0 nach Abruf 2: Wiederholung am nächsten Lerntag (Deckel 1 Tag).
    expect(path[0]!.gap).toBe(1);
    // Die Abstände wachsen Stufe für Stufe und bleiben unter den Deckeln, bis der lange Abstand belegt ist.
    const gaps = path.map((p) => p.gap);
    const firstLong = gaps.findIndex((g) => g >= 21);
    expect(firstLong).toBeGreaterThan(0);
    gaps.slice(0, firstLong).forEach((g, i) => expect(g, `Schritt ${i}: ${JSON.stringify(path[i])}`).toBeLessThanOrEqual(CAP_STEPS[Math.min(i, CAP_STEPS.length - 1)]!));
    expect(gaps.slice(0, 4)).toEqual([1, 3, 7, 21]);
    // Fest erst nach einem freien Abruf nach ≥ 21 Tagen Pause, nicht vorher.
    expect(fest).not.toBeNull();
    const festIdx = path.findIndex((p) => p.day === fest);
    const prev = path[festIdx - 1]!;
    expect(daysBetween(prev.day, fest!)).toBeGreaterThanOrEqual(21);
    expect(daysBetween(START, fest!)).toBeLessThanOrEqual(45);
    expect(doc.ff).toBe(fest);
    // Ergebnis (deterministisch): Tag 0 → Tag 1 (+3) → Tag 4 (+7) → Tag 11 (+21) → Tag 32 Fest, danach lange Pause nach FSRS.
    expect(path.map((p) => daysBetween(START, p.day))).toEqual([0, 1, 4, 11, 32]);
    expect(fest).toBe('2026-11-23');
  });

  it('nur Erkennen/Aufdecken nach Tag 0: Abstand bleibt beim Deckel von 1 Tag, nie Fest', () => {
    for (const ex of ['flip', 'mc_en'] as const) {
      const { path, fest } = run(() => ex, 40);
      for (const p of path.slice(1)) expect(p.gap, `${ex} ${JSON.stringify(p)}`).toBeLessThanOrEqual(1);
      expect(fest).toBeNull();
    }
  });

  it('gemischt: Erkennen zwischen freien Abrufen hebt nie über den Deckel der freien Belege', () => {
    // Jeder zweite Abruf ist Auswahl. Freie Belege an späteren Tagen bestimmen den Deckel.
    const { path } = run((n) => (n % 2 === 0 ? 'mc_en' : 'cloze'), 120);
    let freeDays = 0;
    for (const p of path.slice(1)) {
      if (p.gap >= 21 && freeDays >= 3) break;
      if (p.ex === 'cloze') freeDays++;
      expect(p.gap, JSON.stringify(p)).toBeLessThanOrEqual(CAP_STEPS[Math.min(freeDays, CAP_STEPS.length - 1)]!);
    }
  });

  it('Status unterwegs: nicht „Fest“ vor dem langen Abruf, auch wenn Stufe 5 erreicht ist', () => {
    const { path, fest } = run(() => 'cloze', 120);
    const stage5 = path.find((p) => p.stage >= 5);
    if (stage5 && fest) expect(stage5.day <= fest).toBe(true);
    let doc = fresh();
    sxN = 0;
    doc = answer(doc, berlin(START, 9), START, 'cloze_hint', 3);
    doc = answer(doc, berlin(START, 9) + 15 * MIN, START, 'cloze', 3);
    const card = toTrainCard('leverage', doc, true, berlin(START, 10))!;
    expect(unitState(card, berlin(START, 10))).not.toBe('firm');
  });

  it('Leiter mit Stütze (realistischer, S3): nach dem Gestern-Check frei, solange 1–2 freie Tage und kein Fehler zuletzt; sonst Stütze bzw. Auswahl', () => {
    // So wählt die Runde (`session.ts` → `lighterExercise`): frei bei `wantsFreeRecall`, sonst die Leiter der Stufe (Stufe ≤ 2 Auswahl, Stufe 3 Stütze, ab 4 frei).
    const ladder = (n: number, _i: number, doc: Doc): ExerciseId => {
      if (n === 1 || wantsFreeRecall(doc)) return 'cloze';
      const st = Number(doc.stage);
      return st <= 2 ? 'mc_en' : st === 3 ? 'cloze_hint' : 'cloze';
    };
    const { path, fest } = run(ladder, 120);
    // Nach dem Gestern-Check ist jeder Termin bis zum Deckel 21 frei: keine Stütze, keine Auswahl.
    const until21 = path.slice(1, path.findIndex((p) => p.gap >= 21) + 1);
    expect(until21.length).toBeGreaterThan(0);
    for (const p of until21) expect(p.ex, JSON.stringify(p)).toBe('cloze');
    expect(path.map((p) => daysBetween(START, p.day))).toEqual([0, 1, 4, 11, 32]);
    expect(fest).toBe('2026-11-23');
  });
  it('Leiter mit Stütze und einem Fehler: nach dem Fehler Stütze/Auswahl, danach wieder frei; Fest später, aber erreicht', () => {
    let wrongDone = false;
    const ladder = (n: number, _i: number, doc: Doc): ExerciseId => {
      if (n === 3 && !wrongDone) return 'mc_en';
      if (wantsFreeRecall(doc)) return 'cloze';
      const st = Number(doc.stage);
      return st <= 2 ? 'mc_en' : st === 3 ? 'cloze_hint' : 'cloze';
    };
    sxN = 0;
    let doc = fresh();
    let t = berlin(START, 9);
    doc = answer(doc, t, START, 'cloze_hint', 3);
    doc = answer(doc, t + 15 * MIN, START, 'cloze', 3);
    const seen: { day: string; ex: ExerciseId; g: number }[] = [];
    let fest: string | null = null;
    let n = 0;
    for (let i = 1; i <= 160; i++) {
      const day = addDays(START, i);
      t = berlin(day, 9);
      if (!(readFsrs(doc, t).due < learningDayEnd(t))) continue;
      n++;
      const ex = n === 1 ? 'cloze' : ladder(n, i, doc);
      const g = n === 3 ? 1 : 3;
      if (n === 3) wrongDone = true;
      doc = answer(doc, t, day, n === 3 ? 'cloze' : ex, g);
      seen.push({ day, ex: n === 3 ? 'cloze' : ex, g });
      const card = toTrainCard('leverage', doc, true, t);
      if (!fest && card && isFest(card, t)) fest = day;
    }
    // Direkt nach dem Fehler: keine freie Abfrage (Stütze oder Auswahl).
    expect(['mc_en', 'cloze_hint']).toContain(seen[3]!.ex);
    expect(seen.slice(4).some((s) => s.ex === 'cloze')).toBe(true);
    expect(fest).not.toBeNull();
  });
});
