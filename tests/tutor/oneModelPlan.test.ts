import { describe, expect, it } from 'vitest';
import { addDays } from '../../src/domain/date';
import { patternsOf, topicsWithPatterns } from '../../src/domain/grammar/patterns';
import { patInfos } from '../../src/domain/grammar/slotInput';
import { currentChapter } from '../../src/domain/grammar/slotPlan';
import { patPush, patternState, type PatEntry } from '../../src/domain/metrics/pattern';
import { buildLearnerModel } from '../../src/domain/tutor/learner';

// Ein Lernermodell (Tutor-Engine v3 S2 a): Tagesplan (`slotPlan` über `patInfos`), Status und „Fehler korrigieren“ lesen dieselbe Wahrheit.
// Für jedes Muster gilt: Zustand im Modell = Zustand, nach dem der Tagesplan seine Plätze wählt; das aktuelle Kapitel ist dasselbe. Daten erfunden.

type Doc = Record<string, unknown>;
const TODAY = '2026-10-19';
const NOW = new Date(2026, 9, 19, 12).getTime();

function grammarDocs(): Map<string, Doc> {
  const docs = new Map<string, Doc>();
  topicsWithPatterns()
    .slice(0, 6)
    .forEach((topic, ti) => {
      const pats: Record<string, PatEntry> = {};
      (patternsOf(topic)?.patterns ?? []).forEach((p, pi) => {
        const n = (ti + pi) % 6;
        if (n === 0) return;
        let e: PatEntry | undefined;
        for (let k = 0; k < n * 2; k++) {
          const day = addDays(TODAY, -(40 - k * 3 - pi));
          e = patPush(e, { ok: (k + ti) % 3 !== 0 || n > 3, help: k % 5 === 4, day, t: NOW - (40 - k * 3 - pi) * 86_400_000 });
        }
        if (e) pats[p.id] = e;
      });
      docs.set(topic, { topic, p0: 0.4, pats });
    });
  return docs;
}

describe('ein Modell für Tagesplan, Status und Fehler', () => {
  const docs = grammarDocs();
  const m = buildLearnerModel({ grammarDocs: docs, logs: new Map(), vocab: new Map(), act: new Map(), profile: null, diag: [] }, NOW);
  const infos = patInfos(docs);

  it('Muster-Zustand im Modell = Zustand für den Tagesplan', () => {
    expect(infos.length).toBeGreaterThan(5);
    const states = new Set<string>();
    for (const p of infos) {
      const k = m.patterns.get(p.id);
      expect(k, p.id).toBeTruthy();
      expect(k?.state, p.id).toBe(patternState(p.entry, TODAY));
      states.add(k?.state ?? '');
    }
    // Die Probe deckt mehr als einen Zustand ab.
    expect(states.size).toBeGreaterThan(1);
  });

  it('aktuelles Kapitel im Modell = Kapitel des Tagesplans', () => {
    expect(m.goals.chapter).toBe(currentChapter(infos, TODAY));
  });
});
