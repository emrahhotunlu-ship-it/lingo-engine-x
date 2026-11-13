import { describe, expect, it } from 'vitest';
import { createWriter } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { type CheckDict } from '../../../src/modules/vocab/domain/check';
import { asksMeaning } from '../../../src/modules/vocab/domain/flow';
import { emptyLex } from '../../../src/modules/vocab/domain/planner';
import { addDays, dayKey, dayStartOf } from '../../../src/domain/date';
import type { Lex, Track } from '../../../src/modules/vocab/domain/types';
import { LearnRun, type LearnView } from '../../../src/modules/vocab/ui/learnRun';
import { PROFILE, T0 } from './p2World';

// Politur P2 – Simulation „30 Lerntage, 18 Wörter-Minuten, realistische Zeiten“ (Auftrag der Hauptsitzung 13.11.2026). Die echte Runde
// (LearnRun ohne React, Speicher-Datenbank) läuft an 30 Tagen hintereinander; ein einfacher Lerner antwortet richtig mit der
// Abrufwahrscheinlichkeit der gefragten Spur (FSRS-Formel), in den Lernschritten mit festen Quoten, und braucht realistische Zeiten je Karte.
// Gemessen: Anteil der Wörter-Zeit für Wiederholungen, neue Wörter je Tag, Rückstand am Tagesende. Erfundene Kunstwörter, fester Zufall.

type Doc = Record<string, unknown>;
const D = 86_400_000;
const dict: CheckDict = { isWord: () => false, misspell: new Map(), confusable: new Map(), toUS: (w) => w };
const SCHEMA: Doc = { vocabModule: { v: 1, t: 1, state: 'done' } };
const DAYS = 30;

/** Fester Zufall (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Kunstwörter: eindeutig, mit Satz und deutscher Bedeutung (keine gemeinsamen Bedeutungen, damit die Auswahl immer möglich ist). */
const SYL = ['ka', 'lo', 'mi', 'ru', 'te', 'na', 'vo', 'si', 'pe', 'du', 'ga', 'fi'];
function words(n: number): [string, Doc][] {
  const out: [string, Doc][] = [];
  for (let i = 0; i < n; i++) {
    const w = `${SYL[i % 12]}${SYL[Math.floor(i / 12) % 12]}${SYL[Math.floor(i / 144) % 12]}x`;
    const de = `Wortsinn${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + (Math.floor(i / 26) % 26))}`;
    out.push([`vocab/${w}`, { word: w, de, pos: i % 3 === 0 ? 'verb' : 'noun', ex: `We talked about the ${w} in the meeting.`, order: i, lex: emptyLex('w', 'edge', T0 - 5 * D) }]);
  }
  return out;
}

/**
 * Abrufwahrscheinlichkeit einer Spur nach FSRS (R = (1 + t / (9 S))^−1). Noch nie gebuchte Spur (das Wort kam gestern neu dazu, Schritt B
 * gelang nicht): 0,7 – gesehen und einmal mit Anfangsbuchstaben getippt, aber noch nicht frei.
 */
const recall = (tr: Track | null, now: number): number => {
  if (!tr || tr.last === null || tr.s <= 0) return 0.7;
  return 1 / (1 + (now - tr.last) / D / (9 * tr.s));
};

/** Realistische Zeiten je Karte (ms): Lesen, Tippen, Rückmeldung lesen; ein Fehler kostet Nachtippen und Lesen. */
const MS = { know: 3_000, intro: 22_000, pick: 8_000, again: 6_000, probe: 9_000, gapStep: 15_000, gap: 15_000, nosent: 14_000, meaning: 10_000, wrongExtra: 15_000 };

type DayOut = { day: number; minutes: number; reviewShare: number; fresh: number; reviews: number; overdue: number; capped: number };

async function simulate(seed: number): Promise<DayOut[]> {
  const rand = rng(seed);
  const h = createMemoryDb({ seed: Object.fromEntries(words(300)) });
  const read = (path: string): Promise<Doc | null> => Promise.resolve(h.dump()[path] ?? null);
  const out: DayOut[] = [];
  let value: string | null = null;
  const drafts = { get: () => value, set: (v: string) => void (value = v), remove: () => void (value = null) };
  for (let d = 0; d < DAYS; d++) {
    let now = T0 + d * D;
    const dayStart = now;
    const run = new LearnRun({ deps: { writer: createWriter(h.db), device: 'phone' }, dict, lang: () => 'de', drafts, readDay: () => read('vmod/day'), read, now: () => now, audio: () => true });
    const docs = Object.entries(h.dump()).filter(([p]) => p.startsWith('vocab/'));
    const lexOf = new Map(docs.map(([p, x]) => [p, x.lex as Lex]));
    await run.start({ kind: 'pflicht', docs, profile: PROFILE, schema: SCHEMA });
    let reviewMs = 0;
    let freshMs = 0;
    const fresh = new Set<string>();
    const reviews = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const v: LearnView = run.get();
      if (v.k === 'start') {
        run.begin();
        continue;
      }
      if (v.k === 'pick') {
        now += MS.pick;
        freshMs += MS.pick;
        run.pickChoose(rand() < 0.85 ? v.right : (v.right + 1) % v.options.length);
        run.pickNext();
        continue;
      }
      if (v.k === 'done') break;
      if (v.k !== 'card' && v.k !== 'band') {
        await run.settled();
        if (run.get().k === v.k) break;
        continue;
      }
      if (v.k === 'band') {
        run.next();
        continue;
      }
      const path = v.task.path;
      // Neu = Einführung samt Vorkarte, Auswahl und Lernschritten eines heute eingeführten Worts; alles andere ist Wiederholung.
      const isNew = v.kind !== 'answer' || fresh.has(path);
      const spend = (ms: number) => {
        now += ms;
        if (isNew) freshMs += ms;
        else reviewMs += ms;
      };
      if (v.ask) {
        spend(MS.know);
        run.knowNo();
        continue;
      }
      if (v.again) {
        spend(MS.again);
        run.againSeen();
        continue;
      }
      if (v.kind === 'intro') {
        fresh.add(path);
        spend(MS.intro);
        run.introSeen({ ms: MS.intro, fk: 0 });
        continue;
      }
      const lex = lexOf.get(path);
      const meaning = asksMeaning(v.card.mode);
      const p = v.task.step === 1 ? 0.9 : v.task.step === 2 ? 0.8 : v.task.step === 3 ? 0.85 : meaning ? Math.min(0.98, recall(lex?.u ?? null, now) + 0.05) : recall(lex?.b ?? lex?.u ?? null, now);
      const ok = rand() < p;
      const base = v.task.step === 1 ? MS.gapStep : meaning ? MS.meaning : v.card.mode === 'nosent' ? MS.nosent : MS.gap;
      spend(base + (ok ? 0 : MS.wrongExtra));
      if (!isNew) reviews.add(path);
      run.check(ok ? (meaning ? v.card.de.split(',')[0]! : v.card.answer) : 'qqqq', { ms: base, fk: Math.round(base / 3) });
      if (run.get().k === 'band') run.next();
    }
    for (let i = 0; i < 50 && run.get().k !== 'done'; i++) await new Promise((r) => setTimeout(r, 1));
    await run.settled();
    const end = run.get();
    const capped = end.k === 'done' ? (end.capped ?? 0) : 0;
    const endOfDay = dayStartOf(addDays(dayKey(dayStart), 1));
    let overdue = 0;
    for (const [p, x] of Object.entries(h.dump())) {
      if (!p.startsWith('vocab/')) continue;
      const l = x.lex as Lex;
      if (l.intro === null) continue;
      if ((l.b && l.b.due < endOfDay) || l.u.due < endOfDay) overdue++;
    }
    const total = reviewMs + freshMs;
    out.push({ day: d + 1, minutes: Math.round(total / 6000) / 10, reviewShare: total ? Math.round((reviewMs / total) * 100) : 0, fresh: fresh.size, reviews: reviews.size, overdue, capped });
  }
  return out;
}

describe('Simulation 30 Lerntage (Politur P2)', () => {
  it('18 Wörter-Minuten: Wiederholungen tragen die Zeit, neue Wörter 2–10 am Tag, Rückstand bleibt klein', async () => {
    const days = await simulate(20261113);
    const late = days.slice(7);
    const avg = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)) * 10) / 10;
    const summary = {
      minutenMittel: avg(days.map((x) => x.minutes)),
      anteilWiederholungAbTag8: avg(late.map((x) => x.reviewShare)),
      neueJeTag: days.map((x) => x.fresh),
      neueMittel: avg(days.map((x) => x.fresh)),
      wiederholungenMittelAbTag8: avg(late.map((x) => x.reviews)),
      rueckstandAmTagesende: days.map((x) => x.overdue),
      rueckstandMax: Math.max(...days.map((x) => x.overdue)),
      gekapptJeTag: days.map((x) => x.capped),
      anteilJeTag: days.map((x) => x.reviewShare),
      minutenJeTag: days.map((x) => x.minutes),
    };
    // Ergebnis für den Bericht (vitest --silent=false): eine Zeile.
    console.warn(`P2-SIM ${JSON.stringify(summary)}`);
    // Zeit: die Runde hält die Wörter-Zeit (Zeitdeckel), nie deutlich darüber.
    for (const x of days) expect(x.minutes, `Tag ${x.day}`).toBeLessThanOrEqual(18 + 2);
    // Wiederholungen zuerst (≥ 60 % der Wörter-Zeit, sobald es Wiederholungen gibt).
    expect(summary.anteilWiederholungAbTag8).toBeGreaterThanOrEqual(60);
    // Neue Wörter je Tag zwischen 2 und 10 (Tempo nach Behalten), an jedem Tag.
    for (const x of days) {
      expect(x.fresh, `Tag ${x.day}`).toBeGreaterThanOrEqual(2);
      expect(x.fresh, `Tag ${x.day}`).toBeLessThanOrEqual(10);
    }
    // Rückstand am Tagesende bleibt begrenzt (kein Anwachsen ohne Ende).
    expect(days.at(-1)!.overdue).toBeLessThanOrEqual(15);
  }, 120_000);
});
