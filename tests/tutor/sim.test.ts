import { describe, expect, it } from 'vitest';
import { actId } from '../../src/domain/activation/actDoc';
import { dayKey } from '../../src/domain/date';
import { allSeedTasks } from '../../src/domain/grammar/tasks';
import type { GrammarTask } from '../../src/domain/learn/types';
import { hypothesesOf, type Evidence } from '../../src/domain/tutor/hypotheses';
import { judge } from '../../src/domain/tutor/judge';
import { buildLearnerModel, toUseId, type LearnerModel, type LearnerSources } from '../../src/domain/tutor/learner';

// Schülerprofile P1–P4 (Tutor-Engine v3 §7, Scheibe S1b): nur Urteil und Annahmen, noch keine Zugwahl (decideMove/nextTasks folgen mit S2).
// Alle Daten sind erfunden. Uhrzeit fest (Mittag, Europe/Berlin über `npm test`), damit die Lerntage eindeutig sind.

type Doc = Record<string, unknown>;
const DAY = 86_400_000;
const NOW = new Date(2026, 9, 19, 12).getTime();
const at = (daysAgo: number, minute = 0): number => NOW - daysAgo * DAY + minute * 60_000;

const tasks = allSeedTasks();
const SINCE = tasks.find((t) => t.topic === 'past-simple-perfect' && t.prompt === 'We ___ the new tool since January.') as GrammarTask;
const MC = tasks.find((t) => t.type === 'mc' && t.topic === 'past-simple-perfect') as GrammarTask;

const empty = (): LearnerSources => ({ grammarDocs: new Map(), logs: new Map(), vocab: new Map(), act: new Map(), profile: null, diag: [] });

/** Grammatik-Protokolleintrag in der Form von `grammarLogEntry`. */
const gEntry = (task: GrammarTask, given: string, ok: boolean, t: number, extra: Doc = {}): Doc => ({
  t,
  ok,
  lang: 'de',
  k: 'g',
  topic: task.topic,
  type: task.type,
  q: task.prompt,
  given,
  ans: task.answer,
  src: task.src,
  m: `gr-${task.type}`,
  g: ok ? 3 : 1,
  ms: 9000,
  ctx: 'duty',
  ...extra,
});

/** Protokolle nach Lerntag (`log/<tag>.entries`). */
function logsOf(entries: readonly Doc[]): Map<string, Doc> {
  const out = new Map<string, Doc>();
  for (const e of [...entries].sort((a, b) => (a.t as number) - (b.t as number))) {
    const d = dayKey(e.t as number);
    const doc = out.get(d) ?? { date: d, entries: [] };
    (doc.entries as Doc[]).push(e);
    out.set(d, doc);
  }
  return out;
}

const withLogs = (entries: readonly Doc[]): LearnerSources => ({ ...empty(), logs: logsOf(entries) });
const sinceHyp = (m: LearnerModel) => m.hyps.find((h) => h.from === 'psp.since-for' && h.to === 'psc.habit');
const plain = (m: LearnerModel) => ({ ...m, patterns: [...m.patterns], uses: [...m.uses], words: [...m.words] });

describe('Profile: Voraussetzungen', () => {
  it('die Aufgaben der Profile stehen im Bestand', () => {
    expect(SINCE).toBeDefined();
    expect(MC).toBeDefined();
  });
});

describe('P1 Neu: ohne Daten', () => {
  it('kein Kapitel, keine Annahmen, alle Muster neu', () => {
    const m = buildLearnerModel(empty(), NOW);
    expect(m.day).toBe('2026-10-19');
    expect(m.hyps).toEqual([]);
    expect(m.goals.chapter).toBeNull();
    expect(m.words.size).toBe(0);
    expect(m.pace).toEqual({});
    expect(m.patterns.size).toBeGreaterThan(50);
    expect([...m.patterns.values()].every((p) => p.state === 'new' && p.q28.n === 0 && p.lastWrong === null)).toBe(true);
  });
});

describe('P2 Systematischer Fehler: „seit“ + Präsens', () => {
  it('Urteil: „use“ ist falsch, aus der Übertragungstabelle', () => {
    const j = judge(SINCE, 'use', { fitAlt: {}, aiState: { confirmed: false, available: false, budgetLeft: 0 } });
    expect(j.v).toBe('wrong');
    expect(j.dx?.l1).toBe('l1:seit-praesens');
    expect(j.dx?.vs).toBe('psc.habit');
  });

  it('zwei Belege: noch keine Annahme', () => {
    const m = buildLearnerModel(withLogs([gEntry(SINCE, 'use', false, at(3)), gEntry(SINCE, 'use', false, at(3, 5))]), NOW);
    expect(sinceHyp(m)).toBeUndefined();
  });

  it('drei Belege an EINEM Tag: noch keine Annahme', () => {
    const m = buildLearnerModel(withLogs([0, 5, 10].map((min) => gEntry(SINCE, 'use', false, at(3, min)))), NOW);
    expect(sinceHyp(m)).toBeUndefined();
  });

  it('drei Belege an zwei Tagen: offene Annahme mit Belegkennungen und Herkunft', () => {
    const m = buildLearnerModel(withLogs([gEntry(SINCE, 'use', false, at(3)), gEntry(SINCE, 'use', false, at(3, 5)), gEntry(SINCE, 'work', false, at(1))]), NOW);
    const h = sinceHyp(m);
    expect(h?.state).toBe('open');
    expect([h?.n, h?.days, h?.l1]).toEqual([3, 2, 'l1:seit-praesens']);
    expect(h?.ev).toHaveLength(3);
    const p = m.patterns.get('psp.since-for');
    expect(p?.q28).toEqual({ n: 3, ok: 0 });
    expect(p?.lastWrong).toBe(at(1));
  });

  it('Fehlersätze ohne Protokoll zählen mit, doppelte Zeitpunkte nicht', () => {
    const errs = [at(5), at(4)].map((t) => ({ t, q: SINCE.prompt, given: 'use', ans: SINCE.answer, type: 'kwt' }));
    const src = { ...withLogs([gEntry(SINCE, 'use', false, at(4)), gEntry(SINCE, 'use', false, at(2))]), grammarDocs: new Map([['past-simple-perfect', { p: 0.5, errors: errs }]]) };
    const h = sinceHyp(buildLearnerModel(src, NOW));
    // at(4) steht in Protokoll und Fehlersätzen: einmal gezählt → 3 Belege (at 5, 4, 2) an 3 Tagen.
    expect([h?.n, h?.days]).toEqual([3, 3]);
  });
});

describe('P3 Rater: nur Auswahlaufgaben', () => {
  it('falsche Auswahlantworten erzeugen nie eine Annahme', () => {
    const wrongOpt = (MC.options ?? []).find((o) => o !== MC.answer) ?? 'x';
    const entries = [1, 2, 3, 4, 5, 6].flatMap((d) => [0, 3].map((min) => gEntry(MC, wrongOpt, false, at(d, min))));
    const m = buildLearnerModel(withLogs(entries), NOW);
    expect(m.hyps).toEqual([]);
    // Die 28-Tage-Quote zählt nur getippte feste Aufgaben.
    for (const p of m.patterns.values()) expect(p.q28.n).toBe(0);
  });
  it('eine einzelne getippte Fehlantwort erzeugt keine Annahme', () => {
    expect(buildLearnerModel(withLogs([gEntry(SINCE, 'use', false, at(1))]), NOW).hyps).toEqual([]);
  });
  it('„weiß nicht“ ist kein Beleg', () => {
    const m = buildLearnerModel(withLogs([3, 2, 1].map((d) => gEntry(SINCE, "(don't know)", false, at(d)))), NOW);
    expect(m.hyps).toEqual([]);
  });
});

describe('P4 Erholt: Annahmen werden still oder erledigt', () => {
  const wrong = (d: number) => [gEntry(SINCE, 'use', false, at(d)), gEntry(SINCE, 'use', false, at(d, 5)), gEntry(SINCE, 'use', false, at(d - 1))];
  const right = (d: number) => gEntry(SINCE, SINCE.answer, true, at(d), { pat: 'psp.since-for' });

  it('20 Tage ohne Beleg: still, auch mit freiem richtigem Gebrauch (nie „erledigt“ vor 28 Tagen)', () => {
    const h = sinceHyp(buildLearnerModel(withLogs([...wrong(21), right(10), right(5)]), NOW));
    expect(h?.state).toBe('quiet');
  });
  it('40 Tage ohne Beleg, aber kein freier Gebrauch: bleibt still', () => {
    const h = sinceHyp(buildLearnerModel(withLogs(wrong(41)), NOW));
    expect(h?.state).toBe('quiet');
  });
  it('40 Tage ohne Beleg und an 2 Tagen frei richtig: erledigt', () => {
    const h = sinceHyp(buildLearnerModel(withLogs([...wrong(41), right(20), right(8)]), NOW));
    expect(h?.state).toBe('resolved');
    const p = buildLearnerModel(withLogs([...wrong(41), right(20), right(8)]), NOW).patterns.get('psp.since-for');
    expect(p?.freeDays).toBe(2);
  });
  it('nie bestätigt oder widerlegt (erst mit S5)', () => {
    const ev: Evidence[] = [0, 1, 2, 3].map((d) => ({ id: `x:${d}`, from: 'a.x', to: 'b.y', t: at(d), day: dayKey(at(d)), w: 1, l1: null }));
    for (const free of [0, 5]) for (const h of hypothesesOf(ev, NOW + free * 30 * DAY, () => free)) expect(['open', 'quiet', 'resolved']).toContain(h.state);
  });
});

describe('Wörter und Gebrauchsmuster', () => {
  const vocab = new Map<string, Doc>([
    [
      'depend',
      {
        id: 'depend',
        word: 'depend',
        de: 'abhängen',
        stage: 3,
        S: 6,
        D: 5,
        due: at(-2),
        last: at(4),
        col: [{ p: 'depend on sth', de: 'von etwas abhängen', gap: 'on', opts: ['on', 'of', 'from'], ex: 'It [depends on] the budget.' }],
        hist: [
          { t: at(9), x: 'type', g: 3, s: 'It depends on the budget.' },
          { t: at(4), x: 'type', g: 3, s: 'Everything depends on the client.' },
        ],
      },
    ],
  ]);
  const c = 'vocab/depend';
  const act = new Map<string, Doc>([
    [
      'act/2026-10',
      {
        v: 1,
        month: '2026-10',
        e: {
          [actId(at(3), c)]: { id: actId(at(3), c), t: at(3), d: dayKey(at(3)), c, st: 2, f: 'pr', a: 'x', s: 'Our launch date depends on the legal review.', g: 3, v: 'c', k: 1 },
          [actId(at(2), c)]: { id: actId(at(2), c), t: at(2), d: dayKey(at(2)), c, st: 2, f: 'pr', a: 'x', s: 'It depends from the weather.', g: 1, v: 'w', k: 1 },
        },
      },
    ],
  ]);

  it('Gebrauchsmuster-Kennung aus einer Wendung', () => {
    expect(toUseId('depend on sth')).toBe('use:depend+on');
    expect(toUseId('to make a decision')).toBe('use:make+decision');
    expect(toUseId('the')).toBeNull();
  });

  it('Wortstatus über cardStatus, Wendung über eigene Sätze', () => {
    const m = buildLearnerModel({ ...empty(), vocab, act }, NOW);
    const w = m.words.get('depend');
    expect(w?.status).toBe('newSentence');
    expect([w?.freeDays, w?.sentences, w?.stage]).toEqual([2, 2, 3]);
    const u = m.uses.get('use:depend+on');
    expect(u).toEqual({ id: 'use:depend+on', seen: 1, freeOk: 1, lastWrong: null, cards: ['depend'] });
  });
});

describe('Modell: deterministisch und frisch', () => {
  const entries = [gEntry(SINCE, 'use', false, at(3)), gEntry(SINCE, 'use', false, at(3, 5)), gEntry(SINCE, 'work', false, at(1)), gEntry(MC, MC.answer, true, at(1, 2))];

  it('gleiche Quellen in anderer Reihenfolge ergeben dasselbe Modell', () => {
    const a = withLogs(entries);
    const b = { ...a, logs: new Map([...a.logs].reverse()) };
    expect(plain(buildLearnerModel(a, NOW))).toEqual(plain(buildLearnerModel(b, NOW)));
    // Neue Objekte mit gleichem Inhalt (wie nach jeder Lieferung von live.ts): gleiches Ergebnis.
    expect(plain(buildLearnerModel(structuredClone(a), NOW))).toEqual(plain(buildLearnerModel(a, NOW)));
  });

  it('ein neuer Protokolleintrag wird trotz Zwischenspeicher gesehen', () => {
    const before = buildLearnerModel(withLogs(entries.slice(0, 2)), NOW);
    expect(sinceHyp(before)).toBeUndefined();
    const after = buildLearnerModel(withLogs(entries), NOW);
    expect(sinceHyp(after)?.state).toBe('open');
  });

  it('ein nachträglich geänderter Eintrag (gleicher Zeitpunkt, jetzt richtig) wird trotz Zwischenspeicher gesehen', () => {
    const a = withLogs(entries);
    expect(sinceHyp(buildLearnerModel(a, NOW))?.state).toBe('open');
    const b = withLogs([...entries.slice(0, 2), { ...(entries[2] as Doc), ok: true, override: true }, ...entries.slice(3)]);
    expect(sinceHyp(buildLearnerModel(b, NOW))).toBeUndefined();
  });

  it('Tempo: Median je Aufgabenart, ohne 0 und ohne Ausreißer über 60 s', () => {
    const e = [9000, 11000, 0, 120000].map((ms, i) => gEntry(SINCE, SINCE.answer, true, at(1, i), { ms }));
    expect(buildLearnerModel(withLogs(e), NOW).pace).toEqual({ 'g:kwt': 10000 });
  });

  it('Protokolle außerhalb von 56 Tagen zählen nicht', () => {
    const m = buildLearnerModel(withLogs([gEntry(SINCE, 'use', false, at(70)), gEntry(SINCE, 'use', false, at(70, 4)), gEntry(SINCE, 'use', false, at(69))]), NOW);
    expect(m.hyps).toEqual([]);
  });
});
