import { describe, expect, it } from 'vitest';
import { addDays } from '../../src/domain/date';
import { againFromPool } from '../../src/domain/grammar/again';
import { focusDay, focusPick, readFocus, FOCUS_DONE_REST_DAYS } from '../../src/domain/grammar/focus';
import { focusOfDay, SAFE_TOPIC_P } from '../../src/domain/grammar/focusOfDay';
import { selectFocusRound } from '../../src/domain/grammar/focusRound';
import { freezeGrammarDay } from '../../src/domain/grammar/path';
import { patternsOf } from '../../src/domain/grammar/patterns';
import { allSeedTasks } from '../../src/domain/grammar/tasks';
import { grammarWrite } from '../../src/domain/grammar/write';
import type { GrammarAnswer, GrammarTask } from '../../src/domain/learn/types';
import { applyMove, decideMove, factOf, newSession, recordAnswer } from '../../src/domain/tutor/policy';
import { APPEND_MAX, REPEAT_MAX, repeatCap, type FocusRun } from '../../src/features/grammar/session';
import { berlin } from './helpers';

// Politur P3 (Emrah E1 „A“ 13.11.2026): Ablauf eines Fokus-Themas über vier Lerntage, nachgestellt mit den echten reinen Bausteinen
// (Tagesplan einfrieren → Runde wählen → Antworten über den einen Schreibweg buchen). Daten wie Emrahs Stand: conditionals 0,55 und stockend.

type Doc = Record<string, unknown>;
const D1 = '2026-11-13';
const DAY = 86_400_000;
const at = (day: string, h = 10): number => berlin(day, h);

const allPats = (topic: string): Record<string, unknown> =>
  Object.fromEntries((patternsOf(topic)?.patterns ?? []).map((p) => [p.id, { n: 6, c: 3, last: at(D1) - 5 * DAY, h: 0, r: 5, k: 5, dd: [], i: '2026-09-01' }]));
const begun = (topic: string, p: number, extra: Doc = {}): Doc => ({
  p,
  n: 30,
  c: 18,
  last: at(D1) - 2 * DAY,
  due: at(D1) - DAY,
  hist: [{ d: '2026-09-01', p: 0.5 }],
  recent: [1, 1, 1, 1, 1, 1],
  seen: [],
  errors: [],
  pats: allPats(topic),
  ...extra,
});
const emrah = (): Map<string, Doc> =>
  new Map<string, Doc>([
    ['pres-perf-cont', begun('pres-perf-cont', 0.96)],
    ['past-simple-perfect', begun('past-simple-perfect', 0.96)],
    ['conditionals', begun('conditionals', 0.55, { recent: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0] })],
    ['c1-participle', begun('c1-participle', 0.46, { recent: [1, 0, 1, 0, 1, 0] })],
    ['modals-deduction', begun('modals-deduction', 0.55)],
    ['passive', begun('passive', 0.62)],
  ]);

/** Eine Antwort wie aus der Runde: richtig (ohne Hilfe) oder falsch. */
const answer = (task: GrammarTask, day: string, t: number, ok: boolean): GrammarAnswer => ({
  kind: 'g',
  t,
  day,
  lang: 'de',
  ctx: 'duty',
  task,
  given: ok ? task.answer : 'xxx',
  dontKnow: false,
  verdict: ok ? 'correct' : 'wrong',
  grade: ok ? 3 : 1,
  ms: 9000,
  help: { level: 0 },
  judged: 'local',
});

/** Über den einen Schreibweg buchen (wie `writer.transform`: frischer Stand + Patch). */
function book(docs: Map<string, Doc>, a: GrammarAnswer): void {
  const w = grammarWrite(docs.get(a.task.topic), a);
  if (w.kind === 'update') docs.set(a.task.topic, { ...docs.get(a.task.topic), ...w.patch });
  else if (w.kind === 'create') docs.set(a.task.topic, w.doc);
  else throw new Error(`nicht gebucht: ${w.reason}`);
}

/** Einen Lerntag spielen: Plan einfrieren, Runde wählen (Handy, 5 Min. = 4 Plätze), Antworten nach `oks` buchen. */
function playDay(docs: Map<string, Doc>, day: string, oks: (t: GrammarTask, k: number) => boolean) {
  const nowMs = at(day);
  const { gt } = freezeGrammarDay({ docs, today: day, nowMs, introPlanOf: (t) => patternsOf(t)?.introPlan ?? null, seed: day });
  const topic = gt.topics[0] as string;
  const fday = focusDay(topic, docs.get(topic), day);
  const st = readFocus(docs.get(topic));
  const round = selectFocusRound({
    grammarDocs: docs,
    dailyOpen: [],
    pool: [],
    seed: day,
    nowMs,
    size: 4,
    topic,
    stage: st && !st.ok ? st.s : 1,
    pats: fday.pats,
    rule: fday.rule,
    profile: 'touch',
  });
  const stageBefore = st && !st.ok ? st.s : 1;
  round.tasks.forEach((t, k) => book(docs, answer(t, day, nowMs + (k + 1) * 60_000, oks(t, k))));
  return { gt, topic, rule: fday.rule, round, stageBefore, after: readFocus(docs.get(topic)) };
}

describe('conditionals über vier Lerntage (Emrah E1 „A“)', () => {
  it('Tag 1 Regel + Verstehen → Tag 2 Bilden mit Aufwärmen, 2 Fehler am selben Muster → Mini-Lektion und eine Stufe leichter → Tag 3 wieder hoch → Tag 4 bleibt das Thema', () => {
    const docs = emrah();

    // Tag 1: Plan friert conditionals als Fokus-Thema ein; vorn die kurze Regel (kostet einen Platz, kein Aufwärmen), 3 leichte Aufgaben.
    const d1 = playDay(docs, D1, () => true);
    expect(d1.gt).toMatchObject({ fo: 1 });
    expect(d1.topic).toBe('conditionals');
    expect(d1.rule).toBe(true);
    expect(d1.round.warm).toBe(0);
    expect(d1.round.tasks).toHaveLength(3);
    for (const t of d1.round.tasks) {
      expect(t).toMatchObject({ topic: 'conditionals', fo: 1 });
      expect(['mc', 'meaning', 'gap']).toContain(t.type);
    }
    // 3 saubere Antworten → Stufe 2 „Bilden“ (höchstens ein Aufstieg je Lerntag).
    expect(d1.after).toMatchObject({ s: 2, k: 0, d0: D1, u: D1, n: 1 });

    // Tag 2: dasselbe Thema (laufender Lauf), keine Regel, vorn 1 Aufwärm-Aufgabe aus einem früheren Thema, dann Lücken/Fehler finden zu den
    // zwei schwächsten Mustern im Wechsel. Zwei Fehler am selben Muster → Mini-Lektion (Tutor-Engine) und eine Stufe leichter.
    const D2 = addDays(D1, 1);
    expect(focusPick({ docs, today: D2, nowMs: at(D2) })).toMatchObject({ topic: 'conditionals', reason: 'run', stage: 2 });
    let wrongPat: string | null = null;
    const d2 = playDay(docs, D2, (t) => {
      if (!t.fo) return true;
      wrongPat ??= t.pat ?? null;
      return t.pat !== wrongPat;
    });
    expect(d2.topic).toBe('conditionals');
    expect(d2.rule).toBe(false);
    expect(d2.stageBefore).toBe(2);
    expect(d2.round.warm).toBe(1);
    expect(d2.round.tasks[0]).toMatchObject({ warm: true });
    expect(d2.round.tasks[0]!.topic).not.toBe('conditionals');
    const focus2 = d2.round.tasks.slice(1);
    for (const t of focus2) {
      expect(t).toMatchObject({ topic: 'conditionals', fo: 2 });
      expect(['gap', 'find']).toContain(t.type);
    }
    const wrong2 = focus2.filter((t) => t.pat === wrongPat);
    expect(wrong2).toHaveLength(2);
    expect(d2.after).toMatchObject({ s: 1, n: 2 });
    let s = newSession(true);
    const fact = (t: GrammarTask) => factOf({ task: t, verdict: 'wrong', dontKnow: false, help: { level: 0 }, tj: { h: 'tense' } } as unknown as GrammarAnswer, true);
    s = recordAnswer(s, fact(wrong2[0]!));
    expect(decideMove(s, null, false).move).toBe('ask');
    s = applyMove(s, decideMove(s, null, false));
    s = recordAnswer(s, fact(wrong2[1]!));
    const move = decideMove(s, null, false);
    expect(move.move).toBe('explain');
    expect(applyMove(s, move).lessonPat).toBe(wrongPat);

    // Tag 3: wieder „Verstehen“ (leichter), ohne neue Regel, vorn Aufwärmen; 3 saubere Antworten → wieder „Bilden“.
    const D3 = addDays(D1, 2);
    const d3 = playDay(docs, D3, () => true);
    expect(d3.topic).toBe('conditionals');
    expect(d3.rule).toBe(false);
    expect(d3.stageBefore).toBe(1);
    expect(d3.round.warm).toBe(1);
    for (const t of d3.round.tasks.slice(1)) expect(['mc', 'meaning', 'gap']).toContain(t.type);
    expect(d3.after).toMatchObject({ s: 2, u: D3, n: 3 });

    // Tag 4: das Thema bleibt (es sitzt noch nicht) – obwohl c1-participle schwächer ist; „Bilden“ → nach 3 sauberen „Umformen“.
    const D4 = addDays(D1, 3);
    const d4 = playDay(docs, D4, () => true);
    expect(d4.topic).toBe('conditionals');
    expect(d4.rule).toBe(false);
    expect(d4.stageBefore).toBe(2);
    expect(d4.round.tasks.slice(d4.round.warm).every((t) => t.fo === 2)).toBe(true);
    expect(d4.after).toMatchObject({ s: 3, n: 4, d0: D1 });
    // Tag 5 übt „Umformen“: Fehler finden und die erste Umformung mit Bausteinen.
    const D5 = addDays(D1, 4);
    const d5 = playDay(docs, D5, () => true);
    const focus5 = d5.round.tasks.filter((t) => t.fo);
    expect(focus5.every((t) => t.fo === 3)).toBe(true);
    expect(focus5.find((t) => t.type === 'kwt')).toMatchObject({ ease: 'tiles' });
    // Nichts Altes geht verloren: Zähler wachsen, Verlauf und Musterstände bleiben.
    const cn = docs.get('conditionals')!;
    expect(cn.n as number).toBeGreaterThan(30);
    expect(Object.keys(cn.pats as Doc).length).toBe(patternsOf('conditionals')!.patterns.length);
    expect((cn.hist as unknown[]).length).toBeGreaterThan(1);
  });

  it('Wechsel erst, wenn das Thema sitzt: Mischen bestanden und Beherrschung ≥ 0,8 → am nächsten Tag ein anderes Thema, conditionals ruht als Fokus', () => {
    const docs = emrah();
    const D = addDays(D1, 9);
    docs.set('conditionals', { ...docs.get('conditionals')!, p: 0.86, recent: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], fo: { v: 1, s: 4, k: 2, d0: D1, d: addDays(D, -1), n: 7, u: addDays(D, -2), m: 0 } });
    // Noch nicht „sitzt“: der Lauf bleibt das Fokus-Thema.
    expect(focusPick({ docs, today: D, nowMs: at(D) })).toMatchObject({ topic: 'conditionals', reason: 'run', stage: 4 });
    const d = playDay(docs, D, () => true);
    expect(d.after).toMatchObject({ s: 4, m: 1, ok: D });
    const next = addDays(D, 1);
    const pick = focusPick({ docs, today: next, nowMs: at(next) });
    expect(pick?.topic).not.toBe('conditionals');
    expect(pick?.reason).toBe('weak');
    expect(focusPick({ docs, today: addDays(D, FOCUS_DONE_REST_DAYS - 1), nowMs: at(addDays(D, FOCUS_DONE_REST_DAYS - 1)) })?.topic).not.toBe('conditionals');
  });
});

describe('„Gleich nochmal“ aus dem Vorrat (againFromPool)', () => {
  const cn = allSeedTasks().filter((t) => t.topic === 'conditionals' && t.pat);

  it('derselbe Punkt in einem neuen Lückensatz: gleiches Thema und Muster, genau eine Lücke, nie die Aufgabe selbst; stabil', () => {
    for (const t of cn) {
      const a = againFromPool(t);
      if (!a) continue;
      const src = allSeedTasks().find((x) => x.prompt === a.en)!;
      expect(src.topic).toBe('conditionals');
      expect(src.pat).toBe(t.pat);
      expect(src.type).toBe('gap');
      expect(src.key).not.toBe(t.key);
      expect(a.en.match(/_{3,}/g)).toHaveLength(1);
      expect(a.answer).toBe(src.answer);
      expect(againFromPool(t)).toEqual(a);
    }
    // Fast jede Aufgabe der Fokus-Themen hat einen neuen Satz im Vorrat.
    expect(cn.filter((t) => againFromPool(t)).length / cn.length).toBeGreaterThan(0.9);
  });

  it('ungesehene zuerst, Aufgaben der laufenden Runde nie; ohne Muster nichts', () => {
    const t = cn.find((x) => x.pat === 'cn.second')!;
    const first = againFromPool(t)!;
    const firstKey = allSeedTasks().find((x) => x.prompt === first.en)!.key;
    const other = againFromPool(t, { seen: new Set([firstKey]) })!;
    expect(other.en).not.toBe(first.en);
    expect(againFromPool(t, { avoid: new Set([firstKey]) })!.en).not.toBe(first.en);
    expect(againFromPool({ ...t, pat: undefined })).toBeNull();
  });
});

describe('Zeit ehrlich (repeatCap)', () => {
  const focus = (size: number): FocusRun => ({ topic: 'conditionals', stage0: 1, stage: 1, st: null, pats: [], introduced: [], warm: 0, size, moved: 'none' });

  it('Fokus-Runde: höchstens 2 angehängte Aufgaben und nur, solange die geplante Zeit (Plätze ÷ 0,8 je Minute) reicht', () => {
    expect(APPEND_MAX).toBe(2);
    expect(repeatCap({ focus: focus(4), activeMs: 0 })).toBe(2);
    // 4 Plätze = 5 Minuten geplant; nach 3:40 bleibt Zeit für genau eine.
    expect(repeatCap({ focus: focus(4), activeMs: 220_000 })).toBe(1);
    expect(repeatCap({ focus: focus(4), activeMs: 260_000 })).toBe(0);
    expect(repeatCap({ focus: focus(4), activeMs: 400_000 })).toBe(0);
  });

  it('außerhalb der Fokus-Runde bleibt es bei der bisherigen Grenze', () => {
    expect(repeatCap({ focus: null, activeMs: 0 })).toBe(REPEAT_MAX);
  });
});

describe('focusOfDay (für Anwenden, P4)', () => {
  it('liefert Thema, Name, Stufe, Muster mit Formel, Kurzregel und Beispiel; das sichere Muster kommt nur aus einem Thema mit Beherrschung ≥ 0,8', () => {
    const docs = emrah();
    const { gt } = freezeGrammarDay({ docs, today: D1, nowMs: at(D1), introPlanOf: () => null, seed: D1 });
    const f = focusOfDay({ docs, today: D1, nowMs: at(D1), gt });
    expect(f.topic).toBe('conditionals');
    expect(f.topicName?.de).toBeTruthy();
    expect(f.pattern?.topic).toBe('conditionals');
    expect(f.pattern?.form.en).toBeTruthy();
    expect(f.pattern?.rule.de).toBeTruthy();
    expect(f.pattern?.ex?.en).toBeTruthy();
    // Kein Muster „Sicher“: Rückfall auf das meistrichtige Muster eines sitzenden Themas (0,96), nie eines schwachen.
    expect(f.safe).not.toBeNull();
    expect(['pres-perf-cont', 'past-simple-perfect']).toContain(f.safe!.topic);
    // Ein Muster im Zustand „Sicher“ in einem schwachen Thema (passive 0,62) gilt nicht als sicher.
    const sure = { n: 9, c: 9, last: at(D1) - 3 * DAY, h: 0, r: 31, k: 5, dd: [addDays(D1, -9), addDays(D1, -3)], s: addDays(D1, -9), i: '2026-09-01' };
    const pv = patternsOf('passive')!.patterns[0]!.id;
    const weak = new Map(docs);
    weak.set('passive', { ...docs.get('passive')!, pats: { ...allPats('passive'), [pv]: sure } });
    weak.set('pres-perf-cont', { ...docs.get('pres-perf-cont')!, p: SAFE_TOPIC_P - 0.2 });
    weak.set('past-simple-perfect', { ...docs.get('past-simple-perfect')!, p: SAFE_TOPIC_P - 0.2 });
    expect(focusOfDay({ docs: weak, today: D1, nowMs: at(D1), gt }).safe).toBeNull();
  });
});
