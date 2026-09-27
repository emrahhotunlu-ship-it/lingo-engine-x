import { describe, expect, it } from 'vitest';
import { allCollocations, buildCloze, checkCloze, clozeCandidates, clozeFeasible } from '../../src/domain/drills/cloze';
import { missedWords, scoreDictation } from '../../src/domain/drills/dictation';
import { buildOrder, checkOrder } from '../../src/domain/drills/order';
import { dictationSentences, orderSentences } from '../../src/domain/drills/sources';
import { appendSprint, buildSprintDeck, sprintAnswer, sprintEntry, sprintRadar, sprintStart, SPRINTS_MAX } from '../../src/domain/drills/sprint';
import { learnGrade } from '../../src/domain/learn/grade';
import { toTrainCard } from '../../src/domain/srs/cards';
import type { TrainCard } from '../../src/domain/srs/types';
import { berlin } from './helpers';

const now = berlin('2026-09-27', 10);
const DAY = 86_400_000;

function card(id: string, over: Record<string, unknown> = {}): TrainCard {
  const doc = {
    word: id,
    de: `Bedeutung ${id}`,
    ex: `We talked about the [${id}] in the long weekly meeting today.`,
    state: 'review',
    S: 30,
    D: 5,
    last: now - 5 * DAY,
    due: now + 20 * DAY,
    reps: 6,
    stage: 4,
    ...over,
  };
  return toTrainCard(id, doc, true, now) as TrainCard;
}

describe('Diktat', () => {
  it('D-01: fehlende Wörter, score .78, falsch', () => {
    const r = scoreDictation('we been working on migration since march', 'We have been working on the migration since March.');
    expect(r.missing).toBe(2);
    expect(missedWords(r.ops)).toEqual(['have', 'the']);
    expect(r.score).toBe(0.78);
    expect(r.verdict).toBe('wrong');
  });

  it('D-02: Tippfehler zählt halb', () => {
    const r = scoreDictation('We have been working on the migraton since March', 'We have been working on the migration since March.');
    expect(r.typo).toBe(1);
    // 1 − 0,5/9 = .94: knapp unter .95 → fast richtig (Formel aus dem Plan).
    expect(r.score).toBe(0.94);
    expect(r.verdict).toBe('near');
    const two = scoreDictation('We have been workin on the migraton since March', 'We have been working on the migration since March.');
    expect(two.score).toBe(0.89);
    expect(two.verdict).toBe('near');
  });

  it("D-03: We've = We have", () => {
    expect(scoreDictation("We've finished the report.", 'We have finished the report.').verdict).toBe('correct');
  });

  it('D-04: travelled ↔ traveled in beide Richtungen', () => {
    expect(scoreDictation('She travelled to Boston last week.', 'She traveled to Boston last week.').verdict).toBe('correct');
    expect(scoreDictation('She traveled to Boston last week.', 'She travelled to Boston last week.').verdict).toBe('correct');
  });

  it('D-05: 20 = twenty', () => {
    expect(scoreDictation('We waited for 20 minutes.', 'We waited for twenty minutes.').verdict).toBe('correct');
    expect(scoreDictation('We waited for twenty minutes.', 'We waited for 20 minutes.').verdict).toBe('correct');
  });

  it('mit Hilfe: wortgenau richtig bleibt richtig (Note senkt die Hilfe), knapp daneben nur fast richtig', () => {
    expect(scoreDictation('We have finished the report.', 'We have finished the report.', { helpLevel: 1 }).verdict).toBe('correct');
    const target = 'We have finished the report and sent it to the whole team.';
    const typo = 'We have finsihed the report and sent it to the whole team.';
    expect(scoreDictation(typo, target).verdict).toBe('correct');
    expect(scoreDictation(typo, target, { helpLevel: 1 }).verdict).toBe('near');
  });
});

describe('Lückenjagd', () => {
  const decision = card('decision', {
    col: [
      { p: 'make a decision', de: 'eine Entscheidung treffen', gap: 'make', opts: ['do', 'take', 'have'], ex: 'We need to [make a decision] by Friday.' },
      { p: 'reach a decision', de: 'zu einer Entscheidung kommen', gap: 'reach', opts: ['arrive', 'get'], ex: 'The board could not [reach a decision] yesterday.' },
    ],
  });
  const task = card('task', { col: [{ p: 'do a task', de: 'eine Aufgabe erledigen', gap: 'do', opts: ['make'], ex: 'Can you [do this task] for me?' }] });
  const favor = card('favor', { col: [{ p: 'do a favor', de: 'einen Gefallen tun', gap: 'do', opts: ['make'], ex: 'Could you [do me a favor]?' }] });
  const item = clozeCandidates([decision])[0]!;

  it('C-01: do statt make → Verwechslung mit Hinweis, wozu do gehört', () => {
    const r = checkCloze(item, 'do', { allCols: allCollocations([decision, task, favor]) });
    expect(r).toMatchObject({ verdict: 'wrong', kind: 'confusable' });
    expect(r.belongsTo).toEqual(['do a task', 'do a favor']);
  });

  it('C-02: made → fast richtig (andere Form)', () => {
    expect(checkCloze(item, 'made')).toMatchObject({ verdict: 'near', kind: 'form' });
    expect(checkCloze(item, 'make').verdict).toBe('correct');
    const reach = clozeCandidates([decision])[1]!;
    expect(checkCloze(reach, 'raech')).toMatchObject({ verdict: 'near', kind: 'typo' });
  });

  it('C-03: nach Tipp Note ≤ 3, nach zweitem Tipp ≤ 2', () => {
    expect(learnGrade('cloze', 'correct', { submitMs: 2000, firstKeyMs: 1000 }, { level: 1 })).toBeLessThanOrEqual(3);
    expect(learnGrade('cloze', 'correct', { submitMs: 2000, firstKeyMs: 1000 }, { level: 2 })).toBeLessThanOrEqual(2);
  });

  it('Runde: machbar ab 8, deterministisch, je Karte eine Lücke solange möglich', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      card(`w${i}`, { col: [{ p: `make plan ${i}`, de: 'x', gap: 'make', opts: ['do'], ex: `We [make plan ${i}] every week.` }] }),
    );
    expect(clozeFeasible(many.slice(0, 7))).toBe(false);
    expect(clozeFeasible(many)).toBe(true);
    const a = buildCloze({ cards: many, seed: 's' });
    expect(a).toHaveLength(8);
    expect(buildCloze({ cards: many, seed: 's' }).map((x) => x.key)).toEqual(a.map((x) => x.key));
    expect(new Set(a.map((x) => x.cardId)).size).toBe(8);
  });
});

describe('Satzbau', () => {
  it('nie zwei Sätze in einer Aufgabe', () => {
    expect(buildOrder('We met the client. Then we signed the new contract today.', { seed: 'a' })).toBeNull();
    expect(buildOrder('Is it ready? We need the final numbers by Friday.', { seed: 'a' })).toBeNull();
    expect(buildOrder('We met the new client yesterday at the office.', { seed: 'a' })).not.toBeNull();
  });

  it('S-01: zwei gültige Reihenfolgen', () => {
    const it0 = buildOrder('I met the new client yesterday at the office.', { seed: 'a', accepted: ['Yesterday I met the new client at the office.'] })!;
    const ids = (texts: string[]) => texts.map((t) => it0.tiles.find((x) => x.text.toLowerCase() === t.toLowerCase() && !x.distractor)!.id);
    expect(checkOrder(it0, ids(it0.solution)).verdict).toBe('correct');
    expect(checkOrder(it0, ids(it0.accepted[0]!)).verdict).toBe('correct');
  });

  it('S-02: 1.000 Mischungen nie gleich der Lösung', () => {
    const s = 'We have been working on the new release since March.';
    for (let i = 0; i < 1000; i++) {
      const it0 = buildOrder(s, { seed: `seed-${i}` })!;
      const real = it0.tiles.filter((t) => !t.distractor).map((t) => t.text.toLowerCase());
      expect(real.join(' ')).not.toBe(it0.solution.map((t) => t.toLowerCase()).join(' '));
      expect(it0.tiles.length).toBeGreaterThanOrEqual(7);
      expect(it0.tiles.length).toBeLessThanOrEqual(14);
    }
  });

  it('S-03: Ablenker benutzt → falsch; S-04: ein versetzter Baustein → fast richtig', () => {
    const it0 = buildOrder('She asked me where the meeting room was.', { seed: 'b' })!;
    const idOf = (t: string) => it0.tiles.find((x) => x.text === t && !x.distractor)!.id;
    const sol = it0.solution.map(idOf);
    const dis = it0.tiles.find((t) => t.distractor)!.id;
    expect(checkOrder(it0, [...sol.slice(0, -1), dis]).verdict).toBe('wrong');
    expect(checkOrder(it0, [...sol.slice(0, -1), sol[sol.length - 1]!, dis])).toMatchObject({ verdict: 'wrong', usedDistractor: true });
    const moved = [sol[1]!, sol[0]!, ...sol.slice(2)];
    expect(checkOrder(it0, moved).verdict).toBe('near');
    const two = [sol[1]!, sol[0]!, sol[3]!, sol[2]!, ...sol.slice(4)];
    expect(checkOrder(it0, two).verdict).toBe('wrong');
  });

  it('feste Wendungen bleiben ein Baustein; Material aus dem Regelwerk', () => {
    const it0 = buildOrder('I will call you as soon as I arrive at the airport.', { seed: 'c' })!;
    expect(it0.solution).toContain('as soon as');
    expect(orderSentences({}).length).toBeGreaterThanOrEqual(30);
  });
});

describe('Sprint', () => {
  const cards = [
    ...Array.from({ length: 8 }, (_, i) => card(`known${i}`, { stage: 4, col: [{ p: `take part ${i}`, de: 'x', gap: 'take', opts: ['make', 'do'], ex: `We [take part ${i}] often.` }] })),
    card('fresh', { state: 'new', S: 0, reps: 0, last: 0, stage: 0 }),
    card('low', { stage: 2 }),
  ];
  const docs = new Map([
    ['passive', { p: 0.8, n: 10, last: now }],
    ['articles', { p: 0.3, n: 10, last: now }],
  ]);

  it('R-04: nur Karten ab Stufe 3 und Themen mit p ≥ .5; verschachtelt', () => {
    const deck = buildSprintDeck({ cards, grammarDocs: docs, lang: 'de', nowMs: now, seed: 's' });
    expect(deck.some((d) => d.cardId === 'fresh' || d.cardId === 'low')).toBe(false);
    expect(deck.some((d) => d.topic === 'articles')).toBe(false);
    expect(deck.some((d) => d.topic === 'passive')).toBe(true);
    const fam = (k: string) => (k.startsWith('card') ? 'card' : k.startsWith('gram') ? 'gram' : 'colloc');
    let sameRun = 0;
    for (let i = 1; i < deck.length; i++) if (fam(deck[i]!.k) === fam(deck[i - 1]!.k)) sameRun++;
    // Nur am Ende, wenn eine Art übrig bleibt, dürfen gleiche aufeinander folgen.
    expect(sameRun).toBeLessThan(deck.length / 2);
    expect(fam(deck[1]!.k)).not.toBe(fam(deck[0]!.k));
  });

  it('R-02: 10 Fehler beenden die Runde nicht; Punkte wie die alte App', () => {
    const deck = buildSprintDeck({ cards, grammarDocs: docs, lang: 'de', nowMs: now, seed: 's' });
    let s = sprintStart();
    for (let i = 0; i < 10; i++) s = sprintAnswer(s, deck[i]!, '###', 1000);
    expect(s.n).toBe(10);
    expect(s.score).toBe(0);
    const mc = deck.find((d) => d.opts)!;
    s = sprintAnswer(s, mc, mc.answer, 800);
    s = sprintAnswer(s, mc, mc.answer, 1200);
    expect(s.score).toBe(10 + 12);
    expect(sprintEntry(s, 5)).toEqual({ t: 5, score: 22, ok: 2, n: 12, avgMs: 1000, combo: 2 });
    expect(sprintRadar(deck.find((d) => d.k === 'colloc')!, 'do', 1)).toMatchObject({ c: 'wordchoice', s: 's' });
  });

  it('R-03: sprints höchstens 60', () => {
    let list: unknown[] = Array.from({ length: 60 }, (_, i) => ({ t: i, score: 1 }));
    list = appendSprint(list, { t: 100, score: 5, ok: 1, n: 1, avgMs: 1, combo: 1 });
    expect(list).toHaveLength(SPRINTS_MAX);
    expect((list.at(-1) as { t: number }).t).toBe(100);
  });

  it('R-01: der Sprint ändert keine Karte und kein Thema (reine Funktionen, Eingaben unverändert)', () => {
    const snapshot = JSON.stringify([cards.map((c) => c.doc), [...docs]]);
    const deck = buildSprintDeck({ cards, grammarDocs: docs, lang: 'de', nowMs: now, seed: 'r' });
    let s = sprintStart();
    for (const d of deck.slice(0, 20)) s = sprintAnswer(s, d, d.answer, 900);
    expect(JSON.stringify([cards.map((c) => c.doc), [...docs]])).toBe(snapshot);
  });
});

describe('Quellen', () => {
  it('Diktatsätze 8–16 Wörter, gelernte Karten zuerst', () => {
    const c = [card('alpha', { state: 'new', S: 0, reps: 0, last: 0, stage: 0 }), card('beta')];
    const s = dictationSentences({ cards: c, lessonLines: [{ en: 'Short line.', ref: 'lesson/l07' }] });
    expect(s[0]!.ref).toBe('vocab/beta');
    expect(s.every((x) => x.words >= 8 && x.words <= 16)).toBe(true);
    expect(s.some((x) => x.s.includes('['))).toBe(false);
  });
});
