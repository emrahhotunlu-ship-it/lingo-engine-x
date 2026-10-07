import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRITISH, partTopics, patternFiles, validateTopic } from '../../scripts/grammar/validate.mjs';
import { allSeedTasks } from '../../scripts/grammar/lib.mjs';
import { legacyTaskKey } from '../../src/domain/grammar/key';
import { GRAMMAR_PATH } from '../../src/domain/grammar/path';
import { PathFileSchema, PatternMapSchema, RetiredFileSchema, V2FileSchema } from '../../src/domain/grammar/patternTypes';
import { seedTasks } from '../../src/domain/grammar/tasks';

// Grammatik-Inhalte der Pilotthemen (Lernplattform 2.0 P2 Stufe 1): Schema, Kreuzbezüge, Mengen, Sofort-Korrekturen §3.9.

const read = (f: string): unknown => JSON.parse(readFileSync(f, 'utf8'));
const PILOT = ['past-simple-perfect', 'mixed-cond', 'time-clauses', 'cond-alt'];
type Raw = Record<string, unknown> & { topic: string; prompt: string; type: string; answer: string; hint?: string };

describe('Pilotthemen: Muster, Zuordnung, neue Aufgaben, Satzbau (scripts/grammar/validate.mjs)', () => {
  it('jedes Thema mit Teilen hat eine Musterdatei und umgekehrt; die vier Pilotthemen sind dabei', () => {
    expect([...partTopics()].sort()).toEqual([...patternFiles()].sort());
    for (const t of PILOT) expect(partTopics()).toContain(t);
  });
  for (const topic of partTopics()) {
    it(`${topic}: keine Befunde`, () => {
      expect(validateTopic(topic)).toEqual([]);
    });
  }
});

describe('Fertige Dateien', () => {
  const map = PatternMapSchema.parse(read('src/content/grammar/pattern-map.json'));
  const v2 = V2FileSchema.parse(read('src/content/grammar/tasks-v2.json')).tasks;

  it('Zuordnung der Pilotaufgaben ist vollständig (100 %), jede Kennung findet ihre Aufgabe', () => {
    const seeds = seedTasks().filter((t) => PILOT.includes(t.topic));
    expect(seeds.length).toBeGreaterThan(60);
    for (const t of seeds) expect(map[`${t.topic}|${t.key}`], t.prompt).toBeTruthy();
    const keys = new Set(seedTasks().map((t) => `${t.topic}|${t.key}`));
    for (const k of Object.keys(map)) expect(keys.has(k), k).toBe(true);
    for (const e of Object.values(map)) if (e.dup) expect(Object.keys(map)).toContain(e.dup);
  });

  it('Aufgabenschlüssel sind je Thema über Startaufgaben, Fallen und tasks-v2 eindeutig', () => {
    const seen = new Map<string, string>();
    for (const t of seedTasks()) seen.set(`${t.topic}|${t.key}`, 'seed');
    for (const t of v2) {
      const front = t.type === 'kwt' ? t.frame : t.type === 'find' ? t.prompt : t.a;
      const k = `${t.topic}|${legacyTaskKey(front)}`;
      expect(seen.has(k), `${t.id}: ${front}`).toBe(false);
      seen.set(k, t.id);
    }
    expect(new Set(v2.map((t) => t.id)).size).toBe(v2.length);
  });

  it('Pfad: 7 Kapitel = GRAMMAR_PATH in derselben Reihenfolge; Familien nennen bekannte Themen', () => {
    const p = PathFileSchema.parse(read('src/content/grammar/path.json'));
    expect(p.chapters.flatMap((c) => c.topics)).toEqual([...GRAMMAR_PATH]);
    for (const f of p.families) for (const t of f) expect(GRAMMAR_PATH).toContain(t);
    for (const t of ['past-simple-perfect', 'pres-perf-cont', 'past-perfect', 'conditionals', 'cond-alt', 'mixed-cond']) expect(p.families.flat()).toContain(t);
  });

  it('neue Inhalte zusammen höchstens 2,7 MB (Stufe 2, inhalte-pruefung.md §7: 2,5 MB, mit den acht neuen Themen von P36/P37 auf 2,7 MB angehoben)', () => {
    const files = [
      ...readdirSync('src/content/grammar/patterns').map((f) => join('src/content/grammar/patterns', f)),
      ...['pattern-map', 'tasks-v2', 'path', 'retired'].map((f) => `src/content/grammar/${f}.json`),
    ];
    const total = files.reduce((n, f) => n + statSync(f).size, 0);
    expect(total).toBeLessThan(2765 * 1024);
  });

  it('Satzbau: je Pilotthema mindestens 6 Sätze mit Muster, davon mindestens einer mit trap', () => {
    const items = (read('src/content/c1/order.json') as { items: Array<{ topic: string; pat?: string; trap?: unknown }> }).items;
    for (const topic of PILOT) {
      const mine = items.filter((i) => i.topic === topic && i.pat);
      expect(mine.length, topic).toBeGreaterThanOrEqual(6);
      expect(mine.some((i) => i.trap), topic).toBe(true);
    }
  });
});

describe('Sofort-Korrekturen (§3.9)', () => {
  const retired = RetiredFileSchema.parse(read('src/content/grammar/retired.json')).retired;

  it('die wish-Falle ist keine Aufgabe mehr, sondern stillgelegt; „behaviour“ ist weg', () => {
    const wish = "I wish you didn't interrupt me all the time.";
    expect(seedTasks().some((t) => t.prompt === wish)).toBe(false);
    expect(retired.map((r) => r.key)).toContain(`mixed-cond|${legacyTaskKey(wish)}`);
    expect(readFileSync('src/content/legacy/rules.json', 'utf8')).not.toMatch(/behaviour/);
  });

  it('jede stillgelegte Aufgabe ist wirklich keine Startaufgabe mehr', () => {
    const keys = new Set(seedTasks().map((t) => `${t.topic}|${t.key}`));
    for (const r of retired) expect(keys.has(r.key), r.key).toBe(false);
  });

  it('Stützen verraten die Wahl nicht (modals-*, c1-hedging): kein Modalverb in der Stütze', () => {
    const MODAL = /\b(must|can't|cannot|might|may|could|should|ought|would)\b/i;
    for (const t of allSeedTasks() as Raw[]) {
      if (!/^modals-|^c1-hedging$/.test(t.topic)) continue;
      const hint = String(t.hint ?? (t as { hint_de?: string }).hint_de ?? '');
      if (hint) expect(MODAL.test(hint), `${t.topic}: ${t.prompt} → ${hint}`).toBe(false);
    }
  });

  it('Stützen mit Auswahlliste (relative, prepositions) nennen mindestens drei Möglichkeiten', () => {
    for (const t of allSeedTasks() as Raw[]) {
      if (t.topic !== 'relative' && t.topic !== 'prepositions') continue;
      const hint = String(t.hint ?? (t as { hint_de?: string }).hint_de ?? '');
      const parts = hint.replace(/[()]/g, '').split('/').map((x) => x.trim()).filter(Boolean);
      if (parts.length > 1) expect(parts.length, `${t.prompt} → ${hint}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('time-clauses: Gegenmuster tc.noun-clause; cond-alt: otherwise ist kein if-Ersatz, Should you / in case / Were we to kommen vor', () => {
    expect(JSON.stringify(read('src/content/grammar/patterns/time-clauses.json'))).toContain('tc.noun-clause');
    const ca = JSON.stringify(read('src/content/grammar/patterns/cond-alt.json'));
    for (const w of ['Should you', 'in case', 'Were we to']) expect(ca, w).toContain(w);
    const core = (read('src/content/c1/toolkit.json') as { rules: Record<string, { core: [string, string] }> }).rules['cond-alt']!.core[0];
    expect(core).toMatch(/ersetzt kein if/);
  });

  it('geänderte Regelblätter enthalten keine britischen Schreibweisen', () => {
    const rules = (read('src/content/legacy/rules.json') as { rules: Record<string, unknown> }).rules;
    const tk = (read('src/content/c1/toolkit.json') as { rules: Record<string, unknown> }).rules;
    for (const [id, r] of Object.entries({ ...tk, ...rules })) expect(BRITISH.test(JSON.stringify(r)), id).toBe(false);
  });
});
