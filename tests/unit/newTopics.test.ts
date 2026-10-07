import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { programChapters, topicExists } from '../../src/domain/c1/chapters';
import { NEW_TOPICS } from '../../src/domain/c1x/checkContext';
import { c1File } from '../../src/domain/c1x/schema';
import type { C1Item } from '../../src/domain/c1x/types';
import { topicById } from '../../src/domain/content';
import { patternsOf } from '../../src/domain/grammar/patterns';
import { GRAMMAR_PATH } from '../../src/domain/grammar/path';
import { ruleOf } from '../../src/domain/grammar/rules';
import { allSeedTasks, seedTasks, selectRound, selectVortest } from '../../src/domain/grammar/tasks';
import { berlin } from './helpers';

// Neue Themen des C1-Programms (Lernplattform 3.0 P36/P37): Muster, Regelblatt, Aufgaben (c1x und Startbestand), Platz im Pfad.
// Jedes Thema muss in der alten Themenrunde (LP2) einführbar sein (Kurztest, Einführungsblock), nicht nur über c1x.

const ROOT = join(process.cwd(), 'src/content/c1x/src');
const files = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(d, e.name)) : e.name.endsWith('.json') ? [join(d, e.name)] : []));
const all: C1Item[] = files(ROOT).flatMap((p) => c1File.parse(JSON.parse(readFileSync(p, 'utf8'))).items);
const DONE = NEW_TOPICS.filter((t) => topicExists(t));
const now = berlin('2026-10-06', 10);

describe('Neue Themen', () => {
  it('es gibt mindestens die vier Themen von P36; jedes ist im Programm und im Lernpfad', () => {
    expect(DONE.length).toBeGreaterThanOrEqual(4);
    const inProgram = new Set(programChapters().flatMap((c) => c.topics));
    for (const t of DONE) {
      expect(inProgram.has(t), t).toBe(true);
      expect(GRAMMAR_PATH, t).toContain(t);
    }
  });
  it('Alltag und Beruf: je Thema etwa ein Drittel Alltag (30 bis 40 Prozent), in der Einstufung mindestens 20 Prozent', () => {
    for (const topic of DONE) {
      const mine = all.filter((i) => i.topic === topic && !i.pool);
      const life = mine.filter((i) => i.dom === 'life').length / mine.length;
      expect(life, topic).toBeGreaterThanOrEqual(0.3);
      expect(life, topic).toBeLessThanOrEqual(0.42);
    }
    const place = all.filter((i) => i.pool === 'place');
    expect(place.filter((i) => i.dom === 'life').length / place.length).toBeGreaterThanOrEqual(0.2);
  });
  for (const topic of NEW_TOPICS.filter((t) => topicExists(t))) {
    describe(topic, () => {
      const pats = patternsOf(topic);
      it('Thema, Regelblatt und Musterdatei sind da (mindestens 3 Muster, zweisprachig)', () => {
        const t = topicById(topic);
        expect(t?.name && t?.name_en).toBeTruthy();
        expect(t?.level).toBe('C1');
        expect(ruleOf(topic, 'de')).toBeTruthy();
        expect(pats?.patterns.length ?? 0).toBeGreaterThanOrEqual(3);
        for (const p of pats?.patterns ?? []) {
          expect(p.name.de && p.name.en && p.use.de && p.use.en && p.nudge.de && p.nudge.en).toBeTruthy();
          expect(p.ex.length).toBeGreaterThanOrEqual(2);
        }
      });
      it('mindestens 24 c1x-Aufgaben in allen vier Arten (je mindestens 6), jedes Muster mehrfach geübt', () => {
        const mine = all.filter((i) => i.topic === topic && !i.pool);
        expect(mine.length).toBeGreaterThanOrEqual(24);
        for (const k of ['mcc', 'ocl', 'err', 'kwt']) expect(mine.filter((i) => i.kind === k).length, k).toBeGreaterThanOrEqual(6);
        for (const p of pats?.patterns ?? []) expect(mine.filter((i) => i.pat === p.id).length, p.id).toBeGreaterThanOrEqual(3);
      });
      it('Startbestand für die Themenrunde: mindestens 4 Startaufgaben, je Muster Schlüsselwort, Fehler finden und Bedeutung', () => {
        expect(seedTasks().filter((t) => t.topic === topic).length).toBeGreaterThanOrEqual(4);
        const v2 = allSeedTasks().filter((t) => t.topic === topic && t.pat);
        for (const p of pats?.patterns ?? []) {
          for (const ty of ['kwt', 'find', 'meaning']) expect(v2.filter((t) => t.pat === p.id && t.type === ty).length, `${p.id} ${ty}`).toBeGreaterThanOrEqual(ty === 'meaning' ? 1 : 2);
        }
      });
      it('Einführung am ersten Tag: Kurztest (2 Aufgaben) und Einführungsblock mit Aufgaben des Themas', () => {
        const step = pats?.introPlan[0] ?? [];
        const base = { mode: 'duty' as const, grammarDocs: new Map<string, Record<string, unknown>>(), dailyOpen: [], pool: [], nowMs: now, seed: topic, gt: null, profile: 'keys' as const, wordsToday: [] };
        const vt = selectVortest({ ...base, topic, pats: step, introduce: topic });
        expect(vt).toHaveLength(2);
        const round = selectRound({ ...base, size: 6, errorsMax: 0, introBlock: { topic, pats: step }, introduce: topic });
        expect(round.filter((t) => t.topic === topic && t.pat && step.includes(t.pat)).length).toBeGreaterThanOrEqual(4);
        // Kurzweg (P34): vier Kurztest-Aufgaben über alle Muster des Themas.
        const all4 = selectVortest({ ...base, topic, pats: pats?.patterns.map((p) => p.id) ?? [], introduce: topic, n: 4 } as never);
        expect(all4).toHaveLength(4);
        expect(new Set(all4.map((t) => t.pat)).size).toBeGreaterThanOrEqual(Math.min(3, pats?.patterns.length ?? 0));
      });
    });
  }
});
