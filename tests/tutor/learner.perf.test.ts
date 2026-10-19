import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { actId } from '../../src/domain/activation/actDoc';
import { addDays, dayKey } from '../../src/domain/date';
import { topicsWithPatterns, patternsOf } from '../../src/domain/grammar/patterns';
import { allSeedTasks } from '../../src/domain/grammar/tasks';
import { buildLearnerModel, type LearnerSources } from '../../src/domain/tutor/learner';

// Leistung von `buildLearnerModel` (Tutor-Engine v3 §6.2): 5.000 erfundene Dokumente (die Obergrenze je Artefakt). Gemessen wird in Node;
// der Test meldet nur die Messwerte (Ziel < 100 ms warm) und wird wegen der Zeit nie rot – die Maschine der Testumgebung schwankt.

type Doc = Record<string, unknown>;
const DAY = 86_400_000;
const NOW = new Date(2026, 9, 19, 12).getTime();

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sources(): { src: LearnerSources; docs: number } {
  const r = rng(42);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;
  const tasks = allSeedTasks().filter((t) => t.type !== 'find');
  const today = dayKey(NOW);

  const grammarDocs = new Map<string, Doc>();
  for (const topic of topicsWithPatterns()) {
    const pats: Doc = {};
    for (const p of patternsOf(topic)?.patterns ?? []) pats[p.id] = { n: 6, c: 4, last: NOW - 3 * DAY, h: 1, r: 13, k: 5, dd: [addDays(today, -9), addDays(today, -3)], i: addDays(today, -30) };
    const own = tasks.filter((t) => t.topic === topic);
    const errors = Array.from({ length: own.length ? 20 : 0 }, (_, i) => {
      const t = pick(own);
      return { t: NOW - (i + 1) * 2 * DAY, q: t.prompt, given: t.answer.split(' ').slice(1).join(' ') || 'x', ans: t.answer, type: t.type };
    });
    grammarDocs.set(topic, { p: 0.6, last: NOW - 3 * DAY, pats, errors });
  }

  const logs = new Map<string, Doc>();
  for (let d = 0; d < 56; d++) {
    const day = addDays(today, -d);
    const entries: Doc[] = [];
    for (let i = 0; i < 60; i++) {
      const t = NOW - d * DAY - (60 - i) * 60_000;
      if (i % 2) {
        entries.push({ t, ok: r() > 0.3, lang: 'de', k: 'v', id: `w${Math.floor(r() * 4000)}`, m: pick(['type', 'cloze', 'recog']), ms: Math.floor(r() * 20000) });
        continue;
      }
      const task = pick(tasks);
      const ok = r() > 0.3;
      const given = ok ? task.answer : (task.options?.find((o) => o !== task.answer) ?? (task.answer.split(' ').slice(1).join(' ') || 'x'));
      entries.push({ t, ok, lang: 'de', k: 'g', topic: task.topic, type: task.type, q: task.prompt, given, ans: task.answer, src: task.src, m: `gr-${task.type}`, g: ok ? 3 : 1, ms: Math.floor(r() * 30000), ctx: 'duty' });
    }
    logs.set(day, { date: day, entries });
  }

  const vocab = new Map<string, Doc>();
  const act = new Map<string, Doc>();
  const actDocs = 12;
  const nVocab = 5000 - grammarDocs.size - logs.size - actDocs;
  for (let i = 0; i < nVocab; i++) {
    const hist = Array.from({ length: 1 + Math.floor(r() * 11) }, (_, k) => ({ t: NOW - (40 - k * 3) * DAY, x: pick(['type', 'mc_en', 'cloze_hint', 'produce']), g: pick([1, 2, 3, 3, 4]), s: `Sentence ${k % 3} for word ${i}.` }));
    vocab.set(`w${i}`, {
      id: `w${i}`,
      word: `word${i}`,
      de: `Wort${i}`,
      stage: Math.floor(r() * 6),
      S: 1 + r() * 30,
      D: 1 + r() * 9,
      due: NOW + (r() - 0.5) * 20 * DAY,
      last: NOW - Math.floor(r() * 20) * DAY,
      col: i % 5 === 0 ? [{ p: `rely${i % 40} on`, de: 'x', gap: 'on', opts: ['on', 'at'], ex: `We [rely${i % 40} on] it.` }] : [],
      hist,
    });
  }
  for (let m = 0; m < actDocs; m++) {
    const e: Doc = {};
    for (let i = 0; i < 40; i++) {
      const t = NOW - (m * 40 + i) * 3_600_000;
      const c = `vocab/w${(m * 40 + i) * 5}`;
      const id = actId(t, c);
      e[id] = { id, t, d: dayKey(t), c, st: 2, f: 'pr', a: 'x', s: `We rely${((m * 40 + i) * 5) % 40} on the team.`, g: 3, v: pick(['c', 'm', 'w']), k: 1 };
    }
    act.set(`act/2026-${String(m + 1).padStart(2, '0')}`, { v: 1, month: `2026-${String(m + 1).padStart(2, '0')}`, e });
  }
  return { src: { grammarDocs, logs, vocab, act, profile: null, diag: [] }, docs: grammarDocs.size + logs.size + vocab.size + act.size };
}

describe('buildLearnerModel: Leistung mit 5.000 Dokumenten', () => {
  it('misst kalt und warm (nur Meldung)', () => {
    const { src, docs } = sources();
    expect(docs).toBe(5000);
    let t0 = performance.now();
    const m = buildLearnerModel(src, NOW);
    const cold = performance.now() - t0;
    // Warm: neue Objekte mit gleichem Inhalt (wie nach jeder Lieferung von live.ts), Zwischenspeicher greift.
    const runs: number[] = [];
    for (let i = 0; i < 3; i++) {
      const copy = structuredClone(src);
      t0 = performance.now();
      buildLearnerModel(copy, NOW + i);
      runs.push(performance.now() - t0);
    }
    const warm = Math.min(...runs);
    const line = `buildLearnerModel 5000 Dokumente: kalt ${cold.toFixed(0)} ms, warm ${warm.toFixed(0)} ms (Ziel < 100 ms)`;
    console.warn(line);
    // Optional in eine Datei (die Testausgabe zeigt console nicht immer): LX_PERF_OUT=/pfad npm test -- learner.perf
    if (process.env.LX_PERF_OUT) writeFileSync(process.env.LX_PERF_OUT, `${line}\n`);
    expect(m.words.size).toBeGreaterThan(4000);
    expect(m.patterns.size).toBeGreaterThan(50);
  });
});
