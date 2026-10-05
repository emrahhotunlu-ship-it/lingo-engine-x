import { describe, expect, it } from 'vitest';
import { checkTyped } from '../../src/domain/answer/check';
import { toUS } from '../../src/domain/answer/spelling';
import { dayKey } from '../../src/domain/date';
import { buildPlan, deriveToday, readPlan } from '../../src/domain/plan/buildPlan';
import { logEntry, mergeLogEntries } from '../../src/domain/progress/logPatch';
import { profilePatch } from '../../src/domain/progress/profilePatch';
import { applyUpdate } from '../../src/domain/srs/applyReview';
import { buildTrainCards, toTrainCard } from '../../src/domain/srs/cards';
import { findContext, parseCollocs } from '../../src/domain/srs/context';
import { buildExercise } from '../../src/domain/srs/exercise';
import { autoGrade, suggestGrade } from '../../src/domain/srs/grade';
import { availableExercises, chooseExercise } from '../../src/domain/srs/modes';
import { buildQueue, dueCards, normalizeNewPerDay, planRound } from '../../src/domain/srs/queue';
import type { AnswerEvent, TrainCard } from '../../src/domain/srs/types';
import { berlin, loadSeed } from './helpers';

type Doc = Record<string, unknown>;
const seed = loadSeed();
const vocab = new Map(Object.entries(seed).filter(([k]) => k.startsWith('vocab/')).map(([k, v]) => [k.slice(6), v]));
const DAY = 86_400_000;

// Zeitpunkte relativ zum Seed-Stichtag (20.09.2026) – nicht nur „heute" (Kap. 15).
const MOMENTS = [berlin('2026-09-20', 21), berlin('2026-09-21', 8), berlin('2026-09-27', 12), berlin('2026-10-20', 12)];

describe('Runde: Kontingent, neue Karten auch bei vielen Fälligen, ausgeblendete nie', () => {
  for (const now of MOMENTS) {
    const cards = buildTrainCards(vocab, now);
    for (const newPerDay of [0, 2, 5, 10]) {
      it(`${dayKey(now)} · ${newPerDay} neue pro Tag`, () => {
        const plan = planRound({ cards, nowMs: now, newPerDay, introducedToday: 0, lang: 'de' });
        const available = cards.filter((c) => c.isNew && !c.hidden).length;
        const due = dueCards(cards.filter((c) => !c.hidden), now).length;
        if (due === 0) expect(plan.new).toBe(Math.min(newPerDay, available));
        else {
          // W2: Wiederholungen haben Vorrang – neue höchstens ~40 % des Budgets, Untergrenze min(2, Kontingent).
          expect(plan.new).toBeLessThanOrEqual(Math.min(newPerDay, available, 5));
          expect(plan.new).toBeGreaterThanOrEqual(Math.min(2, newPerDay, available));
          if (due >= 10) expect(plan.due).toBeGreaterThanOrEqual(10);
        }
        expect(plan.target).toBeGreaterThanOrEqual(10);
        expect(plan.target).toBeLessThanOrEqual(60);
        const q = buildQueue({ cards, nowMs: now, target: plan.target, newQuotaLeft: plan.new, exclude: new Set(), lang: 'de' });
        expect(q).toHaveLength(plan.target);
        expect(new Set(q.map((i) => i.key)).size).toBe(q.length);
        const hidden = new Set(cards.filter((c) => c.hidden).map((c) => c.key));
        expect(q.some((i) => hidden.has(i.key))).toBe(false);
        const newPos = q.map((i, k) => (i.reason === 'new' ? k : -1)).filter((k) => k >= 0);
        expect(newPos).toHaveLength(plan.new);
        // früh eingemischt: an den Stellen 2, 5, 8, …
        newPos.forEach((p, k) => expect(p).toBeLessThanOrEqual(2 + 3 * k));
      });
    }
  }

  it('neue Wörter kommen auch an Tagen mit sehr vielen Fälligen', () => {
    const now = berlin('2026-12-01', 12);
    const cards = buildTrainCards(vocab, now);
    const plan = planRound({ cards, nowMs: now, newPerDay: 5, introducedToday: 0, lang: 'de' });
    expect(cards.filter((c) => !c.isNew && c.fsrs.due < now).length).toBeGreaterThan(40);
    expect(plan.new).toBe(5);
  });

  it('bereits heute eingeführte neue Karten verbrauchen das Kontingent; neuPerDay wird auf erlaubte Werte gesetzt', () => {
    const now = MOMENTS[0] ?? 0;
    const cards = buildTrainCards(vocab, now);
    expect(planRound({ cards, nowMs: now, newPerDay: 5, introducedToday: 5, lang: 'de' }).new).toBe(0);
    expect([normalizeNewPerDay(7), normalizeNewPerDay(undefined), normalizeNewPerDay(1), normalizeNewPerDay(99)]).toEqual([5, 5, 0, 10]);
  });
});

const card = (over: Doc): TrainCard => {
  const c = toTrainCard(typeof over.id === 'string' ? over.id : 'x', { word: 'reliable', de: 'zuverlässig', def: 'can be trusted', pos: 'adj', state: 'review', S: 5, D: 5, reps: 3, last: 1, due: 2, ...over }, true, MOMENTS[0] ?? 0);
  if (!c) throw new Error('Karte');
  return c;
};

describe('Abfrageart: je Stufe mindestens zwei, schwächste zuerst, Rückfall ohne Satz', () => {
  it('mindestens zwei Arten je Stufe, mit und ohne Satz und Kollokation', () => {
    for (const stage of [0, 1, 2, 3, 4, 5]) {
      for (const ex of ['Our car is [reliable].', '']) {
        for (const col of [[{ p: 'highly reliable', de: 'äußerst', gap: 'highly', opts: ['strongly', 'deeply'], ex: 'It is [highly reliable].' }], []]) {
          const c = card({ stage, ex, col });
          expect(availableExercises(c, 'de', 100).length, `${stage} ${ex} ${col.length}`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('ohne brauchbaren Satz keine Lückenübung; die schwächste Art gewinnt; keine direkte Wiederholung bei Gleichstand', () => {
    const noCtx = card({ stage: 3, ex: 'No match here.' });
    expect(availableExercises(noCtx, 'de', 100)).not.toContain('cloze_hint');
    const weak = card({ stage: 4, ex: 'It is [reliable].', xs: { cloze: { c: 0, w: 5 } } });
    expect(chooseExercise(weak, 'de', 100)).toBe('cloze');
    // Gleichstand: nicht dieselbe Art wie zuletzt (`hist[].x`, neu) …
    const tie = card({ stage: 3, ex: 'It is [reliable].', hist: [{ t: 1, m: 'cloze', x: 'cloze_hint', g: 3 }] });
    expect(chooseExercise(tie, 'de', 100)).toBe('type');
    // … bzw. bei Einträgen der alten App (nur `m`) nicht derselbe Modus.
    const tieOld = card({ stage: 5, ex: 'It is [reliable].', hist: [{ t: 1, m: 'listen', g: 3 }] });
    expect(chooseExercise(tieOld, 'de', 100, [], { tts: true, ai: false })).toBe('type');
    expect(chooseExercise(card({ stage: 3, ex: 'It is [reliable].' }), 'de', 100)).toBe('cloze_hint');
  });

  it('englische Oberfläche: Bedeutungen aus `def`, nie Deutsch', () => {
    const cards = buildTrainCards(vocab, MOMENTS[0] ?? 0).filter((c) => !c.hidden);
    const c = cards.find((x) => x.id === 'reliable');
    if (!c) throw new Error('reliable');
    const e = buildExercise({ ...c, stage: 1 }, 'mc_en', 'en', cards, 'x');
    expect(e.options).toHaveLength(4);
    for (const o of e.options) expect(/[äöüß]/.test(o.label)).toBe(false);
    expect(e.options.filter((o) => o.correct)).toHaveLength(1);
    expect(buildExercise({ ...c, stage: 1 }, 'mc_en', 'en', cards, 'x').options.map((o) => o.label)).toEqual(e.options.map((o) => o.label));
  });

  it('Lücke im Ursprungssatz: Klammern, gebeugte Form, Kollokation innerhalb der Klammer', () => {
    expect(findContext('She [achieved] her goal.', 'to achieve')).toMatchObject({ sentence: 'She achieved her goal.', gap: 'achieved', start: 4 });
    expect(findContext('He relied on her.', 'to rely on')).toMatchObject({ gap: 'relied on' });
    expect(findContext('Nothing to see.', 'reliable')).toBeNull();
    const [c] = parseCollocs([{ p: 'highly reliable', de: 'x', gap: 'highly', opts: ['a', 'b', 'c'], ex: 'It has proven [highly reliable].' }]);
    expect(c?.ctx).toMatchObject({ sentence: 'It has proven highly reliable.', gap: 'highly', start: 14 });
  });
});

describe('Antwortprüfung', () => {
  const deps = { lemma: 'organize', knownWords: new Set(['effect', 'affect']) };
  it('richtig, britisch (mit US-Hinweis), Tippfehler, andere Form, Verwechslung, falsch', () => {
    expect(checkTyped(' Organize. ', ['organize'], deps)).toEqual({ verdict: 'correct' });
    expect(checkTyped('organise', ['organize'], deps)).toMatchObject({ verdict: 'correct', variant: 'uk', us: 'organize' });
    expect(checkTyped('colour', ['color'], { lemma: 'color' })).toMatchObject({ verdict: 'correct', variant: 'uk', us: 'color' });
    expect(checkTyped('flat', ['apartment'], { lemma: 'apartment' })).toMatchObject({ verdict: 'correct', variant: 'uk' });
    expect(checkTyped('reliabel', ['reliable'], { lemma: 'reliable' })).toMatchObject({ verdict: 'near', kind: 'typo' });
    expect(checkTyped('achieve', ['achieved'], { lemma: 'achieve' })).toMatchObject({ verdict: 'near', kind: 'form' });
    expect(checkTyped('affect', ['effect'], { lemma: 'effect', knownWords: deps.knownWords })).toMatchObject({ verdict: 'wrong', kind: 'confusable' });
    expect(checkTyped('maintain', ['to maintain'], { lemma: 'maintain' })).toEqual({ verdict: 'correct' });
    expect(checkTyped('bus', ['but'], { lemma: 'but' }).verdict).toBe('wrong');
    expect(checkTyped('', ['x'], { lemma: 'x' }).verdict).toBe('wrong');
    expect(toUS('travelled')).toBe('traveled');
    expect(toUS('advise')).toBe('advise');
  });
});

describe('Notenberechnung aus der Zeit', () => {
  it('Auswahl nie „Leicht", Tippen nach Zeit, fast richtig „Schwer", falsch „Nochmal"', () => {
    expect(suggestGrade('mc_en', 'correct', { submitMs: 3000 })).toBe(3);
    expect(suggestGrade('mc_en', 'correct', { submitMs: 9000 })).toBe(2);
    expect(suggestGrade('mc_en', 'correct', { submitMs: 100 })).toBe(3);
    expect(suggestGrade('type', 'correct', { submitMs: 2500, firstKeyMs: 1000, chars: 8 })).toBe(4);
    expect(suggestGrade('type', 'correct', { submitMs: 7000, firstKeyMs: 5000, chars: 8 })).toBe(3);
    expect(suggestGrade('type', 'correct', { submitMs: 30_000, firstKeyMs: 9000, chars: 8 })).toBe(2);
    expect(suggestGrade('type', 'correct', { submitMs: 2500, firstKeyMs: 1000, chars: 8, deletions: 3 })).toBe(3);
    expect(suggestGrade('cloze', 'near', { submitMs: 1000 })).toBe(2);
    expect(suggestGrade('cloze', 'wrong', { submitMs: 1000 })).toBe(1);
    expect(autoGrade('cloze', { verdict: 'wrong' }, { submitMs: 1000 })).toBe(1);
    expect(autoGrade('cloze', { verdict: 'near' }, { submitMs: 1000 })).toBe(2);
  });
});

describe('Tagesplan: einmal je Lerntag, nie neu gewürfelt, neuer Plan um 04:00', () => {
  const round = { target: 22, due: 17, new: 5, ahead: 0 };
  it('stabil über den Tag, neuer Plan ab 04:00', () => {
    const t1 = berlin('2026-09-21', 8);
    const first = buildPlan({ today: dayKey(t1), existing: null, round, nowMs: t1 });
    expect(first.changed).toBe(true);
    expect(first.plan).toMatchObject({ d: '2026-09-21', v: 1, ids: [], why: [], duty: ['review'], goal: { review: 22 }, lesson: null });
    const later = berlin('2026-09-22', 3, 59);
    expect(dayKey(later)).toBe('2026-09-21');
    const again = buildPlan({ today: dayKey(later), existing: first.plan, round: { ...round, target: 40 }, nowMs: later });
    expect(again).toEqual({ plan: first.plan, changed: false });
    const next = berlin('2026-09-22', 4);
    const fresh = buildPlan({ today: dayKey(next), existing: first.plan, round, nowMs: next });
    expect(fresh.changed).toBe(true);
    expect(fresh.plan.d).toBe('2026-09-22');
  });

  it('Plan der alten App von heute mit nicht ausführbaren Kanälen wird vollständig ersetzt; readPlan liest nur v1 von heute', () => {
    const old = { d: '2026-09-20', ids: ['gram', 'listen'], why: [[['whyWeakest']]] };
    const p = buildPlan({ today: '2026-09-20', existing: old, round, nowMs: 1 });
    expect(p.plan.ids).toEqual([]);
    expect(readPlan(old, '2026-09-20')).toBeNull();
    expect(readPlan(p.plan, '2026-09-21')).toBeNull();
    expect(buildPlan({ today: '2026-09-20', existing: { d: '2026-09-20', ids: [], why: [] }, round: { ...round, target: 0 }, nowMs: 1 }).plan.duty).toEqual([]);
  });

  it('Statuszeile, Zähler und Häkchen aus derselben Ableitung; Extra zählt nie zur Pflicht', () => {
    const plan = buildPlan({ today: '2026-09-20', existing: null, round: { ...round, target: 2 }, nowMs: 1 }).plan;
    const e = (id: string, ctx: string) => ({ t: id.length, id, k: 'v', ok: true, ctx });
    expect(deriveToday({ day: '2026-09-20', plan, entries: [], minutes: 0 }).status).toBe('open');
    const partial = deriveToday({ day: '2026-09-20', plan, entries: [e('a', 'rev'), e('a', 'rev'), e('b', 'xtra'), e('c', 'xtra')], minutes: 3 });
    expect(partial).toMatchObject({ status: 'open', review: { done: 1, total: 2 }, extra: 2 });
    expect(deriveToday({ day: '2026-09-20', plan, entries: [e('a', 'rev'), e('bb', 'rev'), e('ccc', 'rev')], minutes: 3 })).toMatchObject({ status: 'allDone', review: { done: 2, total: 2 } });
  });
});

describe('Zähler und Tagesprotokoll', () => {
  const a = (t: number, grade: 1 | 3, day = '2026-09-20'): AnswerEvent => ({ t, day, kind: 'v', id: `w${t}`, ex: 'type', grade, given: 'x', ans: 'y', ms: 2000, lang: 'de', ctx: 'rev' });
  const profile = seed['app/profile'] ?? {};

  it('Zähler: absolute Werte aus frischem Stand, derselbe Sammel-Schreibvorgang wirkt nur einmal', () => {
    const answers = [a(1, 3), a(2, 1), a(3, 3)];
    const rounds = [{ day: '2026-09-20', act: 'review' as const, partial: false, n: 3, right: 2, activeMs: 150_000 }];
    const patch = profilePatch(profile, answers, rounds, { deviceId: 'dev1', seq: 100 });
    expect(patch).toMatchObject({ days: { '2026-09-20': 65 }, answers: Number(profile.answers) + 3, vAnswers: Number(profile.vAnswers) + 3, act: { '2026-09-20': { review: 2 } }, minutes: { '2026-09-20': 18 }, lxSeq: { dev1: 100 } });
    const after = applyUpdate(profile, patch ?? {});
    expect(profilePatch(after, answers, rounds, { deviceId: 'dev1', seq: 100 })).toBeNull();
    const partial = profilePatch(profile, [a(4, 3)], [{ ...rounds[0]!, partial: true, n: 1 }], { deviceId: 'dev1', seq: 101 });
    expect(partial).toMatchObject({ act: { '2026-09-20': { 'review~': 1 } }, minutes: { '2026-09-20': 18 } });
    expect(profilePatch({ ...profile, rate: 'schnell' }, answers, rounds, { deviceId: 'dev1', seq: 102 })).toBeNull();
  });

  it('Runde über 04:00 hinaus bleibt auf dem Lerntag ihres Beginns', () => {
    const patch = profilePatch(profile, [a(5, 3, '2026-09-20')], [], { deviceId: null, seq: 1 });
    expect(Object.keys(patch?.days ?? {})).toEqual(['2026-09-20']);
  });

  it('Protokoll: Format der alten App, ohne Doppelte, höchstens 300, neueste bleiben', () => {
    const e = logEntry(a(7, 3));
    expect(e).toEqual({ t: 7, ok: true, lang: 'de', k: 'v', id: 'w7', m: 'tr-type', given: 'x', ans: 'y', g: 3, ms: 2000, ctx: 'rev' });
    const old = Array.from({ length: 299 }, (_, i) => ({ t: i, ok: true, k: 'v', id: `o${i}` }));
    const merged = mergeLogEntries(old, [e, e, logEntry(a(400, 1))]);
    expect(merged).toHaveLength(300);
    expect(merged.at(-1)).toMatchObject({ t: 400 });
    expect((merged[0] as { t: number }).t).toBe(1);
  });

  it('Zeitpunkte über die Zeitumstellung: Lerntag wechselt um 04:00 Ortszeit', () => {
    expect(dayKey(Date.parse('2026-10-25T02:30:00+01:00'))).toBe('2026-10-24');
    expect(dayKey(Date.parse('2026-10-25T04:00:00+01:00'))).toBe('2026-10-25');
    expect(dayKey(berlin('2026-09-21', 3, 59) + DAY * 0)).toBe('2026-09-20');
  });
});
