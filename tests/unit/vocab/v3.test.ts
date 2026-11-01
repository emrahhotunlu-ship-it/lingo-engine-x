import { describe, expect, it } from 'vitest';
import { addDays, dayKey, dayStartOf } from '../../../src/domain/date';
import { exDeKey as appExDeKey } from '../../../src/domain/srs/exDeKey';
import { bandOf, nextOf, stepMode, verdictOf, whyOf } from '../../../src/modules/vocab/domain/band';
import { chooseSentence, exDeKey, headWords, locateGap, posOf, sbGateOn, sentencesOf, targetOf, tipOf, usableSentences } from '../../../src/modules/vocab/domain/card';
import { type CheckDict, checkAnswer } from '../../../src/modules/vocab/domain/check';
import { letterDiff } from '../../../src/modules/vocab/domain/diff';
import { type Answer, applyAnswer, emptyLex, FLAG, introduce, mayVoid, type PlanCtx, PROBE_CHECK_DAYS, probeKnown, STEP_LATER, STEP_OVERRIDE } from '../../../src/modules/vocab/domain/planner';
import { DEFAULT_CFG, type Lex } from '../../../src/modules/vocab/domain/types';

// V3 Schritt 2a: Lernkarte und Band rein gerechnet, Einspruch-Wege im Planer (v3-bau.md §1–3, §6).

const T0 = Date.parse('2026-11-02T18:00:00Z'); // Mo 19:00 Berlin
const D = 86_400_000;
const ctx = (over: Partial<PlanCtx> = {}): PlanCtx => ({ cfg: DEFAULT_CFG, path: 'vocab/x', planned: true, load: () => 0, siblings: new Set(), ...over });
const ans = (t: number, over: Partial<Answer> = {}): Answer => ({ t, form: 'gap', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a', ...over });

/** Eingeführt vor 10 Tagen, erste Buchung damals, heute in beiden Spuren fällig. */
function dueToday(): Lex {
  const t = T0 - 10 * D;
  let l = introduce(emptyLex('w', 'edge', t), t);
  l = applyAnswer(l, ans(t + 60_000, { form: 'gap_hint' }), ctx()).lex;
  l = applyAnswer(l, ans(t + 300_000), ctx()).lex;
  l.b!.due = T0 - D;
  l.u.due = T0 - D;
  l.lv = 3;
  return l;
}

describe('Satzschlüssel', () => {
  it('exDeKey ist identisch mit dem der App (gespeicherte Übersetzungen bleiben auffindbar)', () => {
    for (const s of ['We brought the deadline forward.', 'It’s a “quote”, not an offer!', '  Lead times   vary. ']) expect(exDeKey(s)).toBe(appExDeKey(s));
  });
});

describe('Sätze je Lexem', () => {
  const doc = {
    ex: 'We brought the deadline forward.',
    exDe: { [exDeKey('We brought the deadline forward.')]: 'Wir haben die Frist vorverlegt.' },
    wx: [
      { en: 'Can we bring the call forward?', de: 'Können wir den Anruf vorziehen?' },
      { en: 'Bad one bring forward.', bad: 1 },
      { en: 'We brought the deadline forward.' },
    ],
    sb: [
      { en: 'They brought the launch forward by a week.', src: 'read', t: T0 - D },
      { en: 'Let us bring it forward.', src: 'ai', t: T0 - 40 * D },
      { en: 'AI fresh: bring forward the meeting.', src: 'ai', t: T0 - 2 * D },
    ],
  };
  const gate = { on: true, start: T0 - 60 * D, checkedAt: T0 - 20 * D, review: { hard: 0, unclear: 1 } };

  it('Reihenfolge Anker → wx → sb, doppelte und schlechte raus, Übersetzung aus exDe', () => {
    const s = sentencesOf(doc, T0, null);
    expect(s.map((x) => x.src)).toEqual(['ex', 'wx', 'sb']);
    expect(s[0]).toMatchObject({ key: 'a', de: 'Wir haben die Frist vorverlegt.' });
    expect(s[1]!.key).toMatch(/^h[0-9a-z]{1,7}$/);
  });
  it('Claude-Sätze der Satzbank nur bei wirksamer Freigabe und nach 4 Wochen', () => {
    const s = sentencesOf(doc, T0, gate);
    expect(s.map((x) => x.en)).toContain('Let us bring it forward.');
    expect(s.map((x) => x.en)).not.toContain('AI fresh: bring forward the meeting.');
  });
  it('Freigabe: Befund zu schlecht oder zu früh geprüft = zu', () => {
    expect(sbGateOn(gate)).toBe(true);
    expect(sbGateOn({ ...gate, review: { hard: 2, unclear: 0 } })).toBe(false);
    expect(sbGateOn({ ...gate, checkedAt: gate.start + 10 * D })).toBe(false);
    expect(sbGateOn(null)).toBe(false);
  });
});

describe('Lücke', () => {
  it('Stichwort ohne to und Platzhalter', () => {
    expect(headWords('to bring sth forward')).toEqual(['bring', 'forward']);
  });
  it('gebeugt und unregelmäßig: so, wie es im Satz steht', () => {
    expect(locateGap('We postponed the meeting.', 'postpone')?.answer).toBe('postponed');
    expect(locateGap('Lead times vary a lot.', 'lead time')?.answer).toBe('Lead times');
    expect(locateGap('She brought it up in the meeting.', 'bring up', { pv: false })).toBeNull();
  });
  it('getrenntes Phrasal Verb: zwei Lücken, Objekt bleibt (≤ 2 Wörter dazwischen)', () => {
    const g = locateGap('We brought the deadline forward.', 'bring forward', { pv: true })!;
    expect(g.split).toBe(true);
    expect(g.answer).toBe('brought forward');
    expect(g.segs).toEqual([
      { t: 'text', s: 'We ' },
      { t: 'gap', s: 'brought' },
      { t: 'text', s: ' the deadline ' },
      { t: 'gap', s: 'forward' },
      { t: 'text', s: '.' },
    ]);
    expect(locateGap('We brought the big new deadline forward.', 'bring forward', { pv: true })).toBeNull();
  });
  it('Nachbarwörter für „mitgetippt ist kein Fehler“', () => {
    const g = locateGap('You are responsible for the budget.', 'responsible')!;
    expect(g.before).toBe('are');
    expect(g.after).toBe('for');
  });
  it('kein Satz ohne Lücke, kein Satz mit Leck', () => {
    const sents = sentencesOf({ ex: 'The budget is tight.', wx: [{ en: 'We need a budget for the budgeting.' }, { en: 'A new budget was approved.' }] }, T0, null);
    const u = usableSentences(sents, 'budget', false);
    expect(u.ok.map((x) => x.sent.en)).toEqual(['The budget is tight.', 'A new budget was approved.']);
    expect(usableSentences(sents, 'leverage', false).skipped).toHaveLength(3);
  });
  it('Anker bei Einführung/Schritt A, Wiederkehr nie im selben Satz', () => {
    const sents = sentencesOf({ ex: 'The budget is tight.', wx: [{ en: 'A new budget was approved.' }] }, T0, null);
    const u = usableSentences(sents, 'budget', false).ok;
    const l = introduce(emptyLex('w', 'edge', T0), T0);
    expect(chooseSentence(l, u, dayKey(T0), { anchorOnly: true })?.sent.key).toBe('a');
    expect(chooseSentence(l, u, dayKey(T0), { avoid: 'a' })?.sent.key).not.toBe('a');
    expect(chooseSentence(l, [], dayKey(T0))).toBeNull();
  });
});

describe('Ziel, Stützen', () => {
  it('Wortart frei geschrieben', () => {
    expect([posOf('noun'), posOf('Nomen'), posOf('v.'), posOf('adjective'), posOf('adv'), posOf('')]).toEqual(['noun', 'noun', 'verb', 'adj', 'adv', null]);
  });
  it('Target: Varianten, Lehrer-Listen, Nachbarwörter, nicht zählbar', () => {
    const l = { ...emptyLex('w', 'edge', T0), gr: { cnt: 'u' as const, var: ['feed-back'] } };
    const t = targetOf(l, 'feedback', 'noun', { syn: ['input'], evade: ['info'], ff: 'Feedback' }, { segs: [], answer: 'feedback', before: 'some', split: false });
    expect(t).toMatchObject({ answer: 'feedback', syn: ['feed-back', 'input'], evade: ['info'], uncount: true, before: 'some', ff: true, pos: 'noun' });
  });
  it('Tipp: Anfang je Teil und Wortzahl', () => {
    expect(tipOf('brought forward')).toEqual({ first: 'b… f…', words: 2 });
  });
});

describe('Buchstaben-Vergleich', () => {
  it('fehlt / zu viel', () => {
    expect(letterDiff('recieve', 'receive')).toEqual([
      { k: 'eq', s: 'rec' },
      { k: 'del', s: 'i' },
      { k: 'eq', s: 'e' },
      { k: 'ins', s: 'i' },
      { k: 'eq', s: 've' },
    ]);
    expect(letterDiff('Adress', 'address')).toEqual([
      { k: 'eq', s: 'ad' },
      { k: 'ins', s: 'd' },
      { k: 'eq', s: 'ress' },
    ]);
    expect(letterDiff('x'.repeat(90), 'y')).toBeNull();
  });
});

describe('Auswertung: neue Hinweise', () => {
  const dict: CheckDict = { isWord: (w) => ['sensitive', 'sensible', 'an', 'a'].includes(w), misspell: new Map(), confusable: new Map([['sensible', ['sensitive']], ['sensitive', ['sensible']]]), toUS: (s) => s };
  it('a ↔ an ist kein Tippfehler-Text, sondern Laut-Regel', () => {
    expect(checkAnswer('a hour', { answer: 'an hour', k: 'col' }, dict)).toMatchObject({ outcome: 'typo', note: 'an' });
  });
  it('Verwechslung nennt das getippte Wort', () => {
    expect(checkAnswer('sensitive', { answer: 'sensible', k: 'w', ff: true }, dict)).toMatchObject({ outcome: 'other', note: 'ff', hit: 'sensitive' });
  });
});

describe('Band', () => {
  it('Urteile (learning-scientist + english-teacher)', () => {
    expect(verdictOf('spell', undefined, 2)).toBe('spell');
    expect(verdictOf('infl', 'grammar', 2)).toBe('infl');
    expect(verdictOf('infl', 'article', 2)).toBe('almost');
    expect(verdictOf('prep', undefined, 1)).toBe('notYet');
    expect(verdictOf('prep', undefined, 2)).toBe('almost');
    expect(verdictOf('unfair', undefined, null)).toBeNull();
  });
  it('Warum: richtig mit Lehrer-Zeile nur auf Deutsch, sonst Bedeutung', () => {
    const base = { check: { outcome: 'ok' as const }, given: 'eventually', answer: 'eventually', de: 'schließlich', pos: 'adv' as const, teach: { why: 'Adverb: schließlich.' } };
    expect(whyOf({ ...base, lang: 'de' })).toEqual({ kind: 'teach', text: 'Adverb: schließlich.' });
    expect(whyOf({ ...base, lang: 'en' })).toMatchObject({ kind: 'rule', key: 'vmWhyMeaning', vars: { pos: 'adv' } });
  });
  it('Warum: anderes Wort zeigt, was das getippte Wort heißt (Kap. 5 Nr. 11)', () => {
    const w = whyOf({ check: { outcome: 'other' }, given: 'offer', answer: 'quote', de: 'Angebot (Preis)', pos: 'noun', teach: {}, lang: 'de', meaningOf: (x) => (x === 'offer' ? 'Angebot (allgemein)' : null) });
    expect(w).toEqual({ kind: 'rule', key: 'vmWhyOtherMeans', vars: { answer: 'quote', de: 'Angebot (Preis)', given: 'offer', pos: 'noun', gde: 'Angebot (allgemein)' } });
  });
  it('Kommt wieder: angezeigter Tag = dayKey des GESPEICHERTEN Termins', () => {
    const before = dueToday();
    const r = applyAnswer(before, ans(T0), ctx());
    expect(r.booked).toContain('b');
    const n = nextOf(r, true, T0, true);
    expect(n).toEqual({ kind: 'date', day: dayKey(r.lex.b!.due), extra: 'newSent' });
  });
  it('Kommt wieder nach Fehler: gleich noch einmal, Termin morgen', () => {
    const r = applyAnswer(dueToday(), ans(T0, { outcome: 'wrong' }), ctx());
    const n = nextOf(r, true, T0, true);
    expect(n.kind).toBe('step');
    expect(n).toMatchObject({ mode: 'sentence', thenTomorrow: dayKey(r.lex.b!.due) === addDays(dayKey(T0), 1) });
  });
  it('Lernschritt-Art wie die Runde', () => {
    expect([stepMode(1, true), stepMode(2, true), stepMode(10, true), stepMode(11, true), stepMode(STEP_OVERRIDE, true), stepMode(2, false)]).toEqual(['same', 'sentence', 'nosent', 'sentence', 'sentence', 'same']);
  });
  it('Knöpfe: „Das wusste ich eigentlich“ nur bei Noch nicht mit Planwirkung', () => {
    const before = dueToday();
    const r = applyAnswer(before, ans(T0, { outcome: 'wrong' }), ctx());
    const b = bandOf({ check: { outcome: 'wrong' }, given: 'xyz', answer: 'edge', de: 'Vorteil', pos: 'noun', teach: {}, lang: 'de', before, result: r, planned: true, t: T0, moreSentences: true, col: [{ p: 'competitive edge', de: 'Wettbewerbsvorteil' }, { p: 'x' }, { p: 'y' }] })!;
    expect(b).toMatchObject({ verdict: 'notYet', tone: 'no', knewIt: true, alsoRight: true });
    expect(b.line).toEqual({ kind: 'swap', given: 'xyz', answer: 'edge' });
    expect(b.partners).toEqual([{ p: 'competitive edge', de: 'Wettbewerbsvorteil' }, { p: 'x', de: '' }]);
    const ok = bandOf({ check: { outcome: 'ok' }, given: 'edge', answer: 'edge', de: 'Vorteil', pos: null, teach: {}, lang: 'de', before, result: applyAnswer(before, ans(T0), ctx()), planned: true, t: T0, moreSentences: false })!;
    expect(ok).toMatchObject({ verdict: 'ok', knewIt: false, alsoRight: false, line: { kind: 'ok', given: 'edge' } });
  });
});

describe('Planer: Einspruch und Probe (learning-scientist V3)', () => {
  it('„Das wusste ich eigentlich“: keine Note, Wiederkehr n=20 nach 4 Karten', () => {
    const before = dueToday();
    expect(mayVoid(before, T0)).toBe(true);
    const r = applyAnswer(before, ans(T0, { outcome: 'wrong', flags: FLAG.override }), ctx());
    expect(r).toMatchObject({ grade: null, booked: [] });
    expect(r.lex.step).toEqual({ n: STEP_OVERRIDE, at: T0, gap: 4 });
    expect(r.lex.lv).toBe(before.lv);
    expect(r.lex.b!.due).toBe(before.b!.due);
    expect(r.lex.day).toBe(before.day);
    expect(mayVoid(r.lex, T0 + 1000)).toBe(false); // höchstens einmal je Tag
  });
  it('Wiederkehr richtig: höchstens Hard, kein Beleg-Tag, kein Aufstieg', () => {
    const v = applyAnswer(dueToday(), ans(T0, { outcome: 'wrong', flags: FLAG.override }), ctx()).lex;
    const r = applyAnswer(v, ans(T0 + 5 * 60_000, { sentence: 'h1' }), ctx());
    expect(r.grade).toBe(2);
    expect(r.booked).toContain('b');
    expect(r.lex.ev.f).not.toContain(dayKey(T0));
    expect(r.lex.lv).toBe(3);
    expect(r.lex.step).toBeNull();
  });
  it('Wiederkehr falsch: normaler Fehlerweg (Stufe runter, Wiederkehr)', () => {
    const v = applyAnswer(dueToday(), ans(T0, { outcome: 'wrong', flags: FLAG.override }), ctx()).lex;
    const r = applyAnswer(v, ans(T0 + 5 * 60_000, { outcome: 'wrong', sentence: 'h1' }), ctx());
    expect(r.grade).toBe(1);
    expect(r.lex.lv).toBe(2);
    expect(r.lex.step?.n).toBe(11);
  });
  it('„Später prüfen lassen“: keine Note, Meldung, Wiederkehr n=21', () => {
    const r = applyAnswer(dueToday(), ans(T0, { outcome: 'other', flags: FLAG.later }), ctx());
    expect(r).toMatchObject({ grade: null, booked: [], events: ['unfair'] });
    expect(r.lex.step?.n).toBe(STEP_LATER);
  });
  it('Einspruch nicht im Lernschritt (Einführungstag)', () => {
    const l = introduce(emptyLex('w', 'edge', T0), T0);
    expect(mayVoid(l, T0 + 60_000)).toBe(false);
  });
  it('„Kenne ich schon“ bestanden: Gut, Benutzen fest in 7 Tagen, Stufe 3, kein Beleg', () => {
    const r = probeKnown(emptyLex('w', 'edge', T0), T0, ctx());
    expect(r.grade).toBe(3);
    expect(r.lex.b!.due).toBe(dayStartOf(addDays(dayKey(T0), PROBE_CHECK_DAYS)));
    expect(r.lex.lv).toBe(3);
    expect(r.lex.ev.f).toEqual([]);
    expect(r.lex.intro).toBe(dayKey(T0));
    expect(r.lex.step).toBeNull();
    expect(probeKnown(r.lex, T0 + D, ctx()).booked).toEqual([]); // nur einmal
  });
});
