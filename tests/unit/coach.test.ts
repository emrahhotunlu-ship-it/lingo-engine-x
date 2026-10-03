import { describe, expect, it } from 'vitest';
import { bank, bandOf, lookupWord, wordId } from '../../src/bank/words';
import { gapIn, viewOf, distractors } from '../../src/coach/cardView';
import { buildGrammarCheck, buildVocabTest, cefrFromVocab, scoreGrammar, scoreVocab, type VocabAnswer } from '../../src/coach/placement';
import { applyAnswer, dueIds, formatFor, gradeOf, introducedCard, knownCard, newCandidates, newQuota, nextLevel, Session } from '../../src/coach/session';
import { streakOf, todayPlan } from '../../src/coach/derived';
import { planImport, type LegacyData } from '../../src/coach/legacy';
import { GRAMMAR_TOPICS } from '../../src/coach/grammar';
import type { CardRec, DayRec, Placement } from '../../src/coach/types';

const NOW = Date.parse('2026-10-03T10:00:00+02:00');
const DAY = 86_400_000;
const empty: DayRec = { min: 0, ans: 0, ok: 0, nw: 0 };

describe('Lernstoff-Bank', () => {
  it('hat tausende Wörter mit Bedeutung, eindeutige Kennungen und Kontrollwörter', () => {
    const b = bank();
    expect(b.words.length).toBeGreaterThan(7000);
    expect(b.phrasal.length).toBeGreaterThan(300);
    expect(b.pseudo.length).toBeGreaterThanOrEqual(30);
    const ids = new Set(b.words.map((w) => w.i));
    expect(ids.size).toBe(b.words.length);
    for (const w of b.words) expect(w.de.trim(), w.w).not.toBe('');
    expect(b.words.filter((w) => w.ex?.length).length / b.words.length).toBeGreaterThan(0.7);
  });

  it('kennt keine falschen Freunde als Bedeutung', () => {
    expect(bank().byId.get('actual')?.de).not.toMatch(/aktuell/);
    expect(bank().byId.get('eventually')?.de).not.toMatch(/eventuell/);
    expect(bank().byId.get('become')?.de).not.toMatch(/bekommen/);
  });

  it('findet Wörter in beide Richtungen ohne KI', () => {
    expect(lookupWord('negotiate')[0]?.w).toBe('negotiate');
    expect(lookupWord('verhandeln').map((w) => w.w)).toContain('negotiate');
    expect(wordId('to push back')).toBe('push-back');
    expect(bandOf(2500)).toBe(3);
  });
});

describe('Karten', () => {
  it('Lücke findet auch gebeugte Formen im Beispielsatz', () => {
    const v = viewOf('negotiate')!;
    const g = gapIn(v);
    expect(g).not.toBeNull();
    expect(g!.answer.toLowerCase()).toMatch(/^negotiat/);
    expect(`${g!.before}${g!.answer}${g!.after}`).toBe(v.ex.find(([en]) => en.includes(g!.answer))![0]);
  });

  it('Ablenker sind andere Bedeutungen und je Karte fest', () => {
    const v = viewOf('reliable')!;
    const d = distractors(v);
    expect(d).toHaveLength(3);
    expect(d).not.toContain(v.de.split(', ')[0]);
    expect(distractors(v)).toEqual(d);
  });

  it('alte Karte ohne Bank-Eintrag zeigt Wort, Bedeutung und Ursprungssatz', () => {
    const rec: CardRec = { src: 'legacy', w: 'to touch base', de: 'sich kurz abstimmen', ex: "Let's touch base tomorrow.", f: introducedCard(NOW).f, lv: 0, add: NOW };
    const v = viewOf('touch-base-xyz', rec)!;
    expect(v.word).toBe('to touch base');
    expect(v.ex[0]![0]).toBe("Let's touch base tomorrow.");
  });
});

describe('Automatische Bewertung (keine Selbsteinschätzung)', () => {
  it('Note aus Richtigkeit, Hilfe und Zeit', () => {
    expect(gradeOf('recall', { correct: false, ms: 3000 }, 2)).toBe(1);
    expect(gradeOf('recall', { correct: false, near: true, ms: 3000 }, 2)).toBe(2);
    expect(gradeOf('recall', { correct: true, help: true, ms: 3000 }, 2)).toBe(2);
    expect(gradeOf('recall', { correct: true, ms: 8000 }, 2)).toBe(3);
    expect(gradeOf('recall', { correct: true, ms: 4000 }, 3)).toBe(4);
    expect(gradeOf('choose', { correct: true, ms: 4000 }, 0)).toBe(3);
    expect(gradeOf('choose', { correct: true, ms: 12000 }, 0)).toBe(2);
  });

  it('Stufe steigt bei Erfolg, fällt bei Fehler, Abfrageart folgt der Stufe', () => {
    expect(nextLevel(1, 3)).toBe(2);
    expect(nextLevel(1, 1)).toBe(0);
    expect(nextLevel(4, 4)).toBe(4);
    const rec = (lv: number): CardRec => ({ ...introducedCard(NOW), lv });
    expect(formatFor('negotiate', rec(0))).toBe('choose');
    expect(formatFor('negotiate', rec(1))).toBe('gap');
    expect(formatFor('negotiate', rec(2))).toBe('recall');
    expect(['recall', 'gap', 'listen']).toContain(formatFor('negotiate', rec(3)));
  });

  it('Antwort verbucht FSRS, Stufe und Bilanz', () => {
    const r = introducedCard(NOW);
    const { rec, grade } = applyAnswer(r, 'choose', { correct: true, ms: 3000 }, NOW);
    expect(grade).toBe(3);
    expect(rec.lv).toBe(1);
    expect(rec.ok).toBe(1);
    expect(rec.f.reps).toBe(1);
    expect(rec.f.due).toBeGreaterThan(NOW);
  });

  it('bekannt einsortiert = gefestigt, erst in Wochen wieder dran', () => {
    const k = knownCard(NOW);
    expect(k.known).toBe(1);
    expect(k.f.state).toBe(2);
    expect(k.f.due - NOW).toBeGreaterThan(5 * DAY);
  });
});

describe('Tageseinheit', () => {
  const placement: Placement = { at: NOW, size: 4000, bands: [1, 1, 0.9, 0.7, 0.5, 0.3, 0.2, 0.1, 0.05], falseAlarm: 0, grammar: {}, level: 'B2' };

  it('neue Wörter werden gedrosselt, wenn sich Wiederholungen stauen', () => {
    expect(newQuota(10, 10, 0)).toBe(10);
    expect(newQuota(10, 10, 4)).toBe(6);
    expect(newQuota(70, 10, 0)).toBe(5);
    expect(newQuota(150, 10, 0)).toBe(3);
  });

  it('eigene, nie geübte Wörter kommen zuerst, dann die Bank ab dem lückenhaften Band, jedes dritte aus dem Beruf', () => {
    const own: CardRec = { src: 'legacy', w: 'to touch base', de: 'abstimmen', f: introducedCard(NOW).f, lv: 0, add: NOW };
    const gen = newCandidates(new Map([['touch-base', own]]), placement);
    const first = gen.next().value!;
    expect(first.id).toBe('touch-base');
    const next = Array.from({ length: 9 }, () => gen.next().value!);
    // Band 1–2 sind laut Einstufung sicher: keine Grundwörter wie "time".
    expect(next.map((c) => c.id)).not.toContain('time');
    const work = next.filter((c) => c.word && (c.word.l.includes('business') || c.word.l.includes('toeic')));
    expect(work.length).toBeGreaterThanOrEqual(3);
    // In gut bekannten Bändern wird erst sortiert („Kennst du das?").
    expect(next.some((c) => c.sort)).toBe(true);
  });

  it('Einheit: Wiederholungen und neue Wörter gemischt, Ende wenn alles erledigt', () => {
    const cards = new Map<string, CardRec>();
    const old = (): CardRec => ({ ...knownCard(NOW - 40 * DAY), lv: 2 });
    for (const id of ['reliable', 'deadline', 'invoice', 'revenue']) cards.set(id, old());
    expect(dueIds(cards, NOW).length).toBe(4);
    const s = new Session({ cards, nowMs: NOW, newPerDay: 2, today: empty, placement });
    const kinds: string[] = [];
    for (let i = 0; i < 40; i++) {
      const step = s.next(cards);
      if (!step) break;
      kinds.push(step.kind);
      if (step.kind === 'sort' || step.kind === 'meet') {
        cards.set(step.id, introducedCard(NOW));
        s.met(step.id);
      } else {
        const { rec } = applyAnswer(cards.get(step.id)!, step.format, { correct: true, ms: 3000 }, NOW + 100 * DAY);
        cards.set(step.id, rec);
        s.answered(step.id, rec, NOW + 100 * DAY);
      }
    }
    expect(kinds.filter((k) => k === 'review').length).toBeGreaterThanOrEqual(6);
    expect(kinds.filter((k) => k !== 'review').length).toBe(2);
    expect(s.next(cards)).toBeNull();
  });

  it('Tagesplan schätzt Minuten', () => {
    const p = todayPlan(new Map(), null, empty, NOW);
    expect(p).toEqual({ due: 0, fresh: 10, minutes: 8 });
  });
});

describe('Serie', () => {
  const day = (core: 0 | 1): DayRec => ({ ...empty, ans: 5, core });
  it('zählt Tage mit Kern-Training und alte aktive Tage; ein Ruhetag je Woche', () => {
    // Fr 2026-10-02 erledigt, Do 01 Ruhetag, Mi 30.09 + Di 29.09 alte App.
    const days = { '2026-10-02': day(1) };
    expect(streakOf(days, ['2026-09-29', '2026-09-30'], '2026-10-03')).toEqual({ count: 3, todayDone: false });
    // Zwei Lücken in derselben Woche brechen die Serie.
    expect(streakOf({ '2026-10-02': day(1) }, ['2026-09-29'], '2026-10-03').count).toBe(1);
  });
});

describe('Einstufung', () => {
  it('Test: neun Bänder, Kontrollwörter verteilt, fest je Tag', () => {
    const items = buildVocabTest(42);
    expect(items.filter((i) => i.kind === 'real')).toHaveLength(72);
    expect(items.filter((i) => i.kind === 'pseudo')).toHaveLength(18);
    expect(buildVocabTest(42)).toEqual(items);
    for (const i of items) if (i.kind === 'real') expect(i.options).toContain(i.de);
  });

  it('Raten wird herausgerechnet', () => {
    const items = buildVocabTest(1);
    const honest: VocabAnswer[] = items.map((item) => ({ item, yes: item.kind === 'real' && item.band <= 4 }));
    const guesser: VocabAnswer[] = items.map((item) => ({ item, yes: item.kind === 'pseudo' || (item.kind === 'real' && item.band <= 4) }));
    const a = scoreVocab(honest);
    const b = scoreVocab(guesser);
    expect(a.size).toBe(4000);
    expect(b.falseAlarm).toBe(1);
    expect(b.size).toBe(0);
    expect(cefrFromVocab(a.xlex)).toBe('B2+');
  });

  it('Grammatik: eine Aufgabe je Thema; alter Wert fließt ein', () => {
    const check = buildGrammarCheck(7);
    expect(check).toHaveLength(GRAMMAR_TOPICS.length);
    const s = scoreGrammar({ passive: true, articles: false }, { passive: 0.45 });
    expect(s.passive).toBe(0.65);
    expect(s.articles).toBe(0.35);
  });
});

describe('Übernahme der alten Daten', () => {
  const legacy: LegacyData = {
    vocab: new Map([
      ['negotiate', { word: 'negotiate', de: 'verhandeln', S: 12, D: 4, due: NOW + 3 * DAY, last: NOW - 9 * DAY, state: 'review', stage: 3, reps: 5, lapses: 1 }],
      ['touch-base', { word: 'to touch base', de: 'sich abstimmen', ex: "Let's touch base.", state: 'new', stage: 0 }],
      ['gone', { word: 'gone', de: 'weg', hidden: true }],
    ]),
    chunks: new Map([['c1', { en: 'to be on the same page', de: 'sich einig sein' }]]),
    grammar: new Map([['passive', { p: 0.62 }]]),
    profile: { days: { '2026-10-01': 20 }, xpDays: { '2026-09-30': 5 } },
    assess: { data: { cefr: 'B2' } },
    truncated: [],
  };

  it('übernimmt Karten mit Lernstand, Serie, Grammatik und Niveau', () => {
    const plan = planImport(legacy, new Map(), NOW);
    const ids = plan.cards.map(([id]) => id).sort();
    expect(ids).toEqual(['ch-c1', 'negotiate', 'touch-base']);
    const neg = plan.cards.find(([id]) => id === 'negotiate')![1];
    expect(neg.src).toBe('bank');
    expect(neg.lv).toBe(3);
    expect(neg.f.state).toBe(2);
    const own = plan.cards.find(([id]) => id === 'touch-base')![1];
    expect(own.src).toBe('legacy');
    expect(own.ex).toBe("Let's touch base.");
    expect(plan.imported.days).toEqual(['2026-09-30', '2026-10-01']);
    expect(plan.imported.grammar).toEqual({ passive: 0.62 });
    expect(plan.imported.level).toBe('B2');
  });

  it('überschreibt nie eine Karte, die es im Trainer schon gibt', () => {
    const existing = new Map<string, CardRec>([['negotiate', knownCard(NOW)]]);
    const plan = planImport(legacy, existing, NOW);
    expect(plan.cards.map(([id]) => id)).not.toContain('negotiate');
  });
});
