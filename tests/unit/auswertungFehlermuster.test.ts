import { describe, expect, it } from 'vitest';
import { AUX_PATTERNS } from '../../src/content/auxForm';
import { isKnownAction, AUX_ACTION, allowedActions } from '../../src/domain/assessment/actions';
import { buildAuxDrill, AUX_ROUND } from '../../src/domain/drills/auxform';
import { checkCloze } from '../../src/domain/drills/cloze';
import { allSeedTasks } from '../../src/domain/grammar/tasks';
import { gradeAnswer, INTERRUPT_MS, wasInterrupted } from '../../src/domain/grade';
import { radarTotals, radarView } from '../../src/domain/progress/radar';
import { lastWeekOf, patternsHeldBack, patternsNewSafe, weekFacts } from '../../src/domain/progress/weekly';
import { weekly3 } from '../../src/domain/progress/weekly3';
import { auxFormErrors } from '../../src/domain/text/auxForm';
import { radarOpenTopics, topicOfEvent } from '../../src/domain/radar/open';
import { dueFehlersaetze } from '../../src/domain/repair/fehlersaetze';
import { addRepairs, readRepairs } from '../../src/domain/repair/repair';
import { actionRoute } from '../../src/features/progress/actionRoute';
import { berlin } from './helpers';

// Auswertung 15.10.2026, Punkt 5: Fehlermuster über Themen hinweg.

const NOW = berlin('2026-10-15', 10);
const DAY = 86_400_000;
const ev = (over: Record<string, unknown>) => ({ c: 'tense', s: 'g', t: NOW - DAY, q: 'x', g: '', a: '', ...over });

// Die echten Ereignisse aus Emrahs Radar (ohne Namen), über fünf Themen verteilt.
const REAL = [
  ev({ c: 'tense', g: 'will worked', a: 'will have worked', q: 'By the end of this year, she ___ (work) here for five years.', t: NOW - 20 * DAY }),
  ev({ c: 'cond', g: "wouldn't missed", a: 'would not have missed', q: 'If they had left earlier, they ___ (not/miss) the train.', t: NOW - 9 * DAY }),
  ev({ c: 'cond', g: 'had sign', a: 'If Markus had signed last year, he would have gotten the old price.', t: NOW - 5 * DAY }),
  ev({ c: 'tense', g: 'has been felt', a: 'has been feeling', q: 'He ___ (feel) tired lately.', t: NOW - 4 * DAY }),
  ev({ c: 'tense', g: 'have been worked', a: 'have been working', q: 'We ___ with this supplier since 2017. (work)', t: NOW - 3 * DAY }),
  ev({ c: 'verbform', s: 'w', g: 'Having wrote', a: 'Having written', q: 'Having wrote the report', t: NOW - 2 * DAY }),
  ev({ c: 'cond', g: 'had choosen', a: 'chose', t: NOW - 2 * DAY }),
  ev({ c: 'verbform', s: 'w', g: 'have catched up', a: 'have caught up', t: NOW - 40 * DAY }),
  // keine Verbform nach Hilfsverb
  ev({ c: 'wordchoice', g: 'Have you been progressing in any action items?', a: 'Have you been making progress on any action items?', t: NOW - DAY }),
  ev({ c: 'prep', g: 'look forward for', a: 'look forward to', t: NOW - DAY }),
];

describe('Radar: Verbform nach Hilfsverb als EIN Übungsziel', () => {
  it('die Regel steht als eigene Zeile oben, mit allen Ereignissen der letzten 30 Tage quer über die Themen', () => {
    const rows = radarView(REAL, NOW);
    const aux = rows[0]!;
    expect(aux.c).toBe('auxform');
    expect(aux.kind).toBe('rule');
    expect(aux.action).toBe('auxform');
    expect(aux.n30).toBe(7); // will worked, wouldn't missed, had sign, has been felt, have been worked, Having wrote, had choosen
    expect(aux.examples.length).toBe(2);
    expect(aux.nPrev30).toBe(1); // have catched up (40 Tage)
  });

  it('die Ereignisse zählen weiter unter ihrem Thema; die Summe zählt sie nicht doppelt', () => {
    const rows = radarView(REAL, NOW);
    expect(rows.filter((r) => r.kind !== 'rule').reduce((n, r) => n + r.n30, 0)).toBe(radarTotals(REAL, NOW).n30);
    expect(rows.find((r) => r.c === 'cond')?.n30).toBeGreaterThanOrEqual(3);
  });

  it('ohne solche Fehler keine Zeile', () => {
    expect(radarView([ev({ g: 'look forward for', a: 'look forward to', c: 'prep' })], NOW).some((r) => r.kind === 'rule')).toBe(false);
    expect(radarView([], NOW)).toEqual([]);
  });

  it('die Aktion führt zur Lückenjagd-Route und steht nicht in der Liste für die KI-Einschätzung', () => {
    expect(isKnownAction(AUX_ACTION)).toBe(true);
    expect(actionRoute(AUX_ACTION)).toMatchObject({ name: 'drill', kind: 'cloze' });
    expect(allowedActions({ errorTopics: [], nextLesson: null })).not.toContain(AUX_ACTION);
  });

  it('auxFormErrors erkennt in den echten Fällen die Regel', () => {
    for (const e of REAL.slice(0, 8)) expect(auxFormErrors(String(e.g), { right: String(e.a) }), String(e.g)).not.toHaveLength(0);
    expect(auxFormErrors('look forward for', { right: 'look forward to' })).toHaveLength(0);
  });
});

describe('Übung „Verbform nach Hilfsverb“: 5 Muster', () => {
  it('fünf Muster, je eine Lücke, jede Lücke genau das Wort im Satz', () => {
    expect(AUX_PATTERNS).toHaveLength(5);
    const items = buildAuxDrill('2026-10-15|auxform|1');
    expect(items).toHaveLength(AUX_ROUND);
    expect(new Set(items.map((i) => i.phrase)).size).toBe(5);
    for (const it of items) {
      expect(it.sentence.sentence.slice(it.sentence.start, it.sentence.end)).toBe(it.gap);
      expect(it.strict).toBe(true);
      expect(it.cue?.de).toContain('Verb:');
      expect(it.note?.de.length).toBeGreaterThan(20);
    }
    for (const p of AUX_PATTERNS) for (const it of p.items) expect(it.sentence).toContain(it.gap);
  });

  it('eine andere Form desselben Verbs ist falsch, nicht „fast richtig“; die richtige Form (auch US/GB, Groß/Klein) ist richtig', () => {
    const item = buildAuxDrill('x').find((i) => i.phrase === 'perfect')!;
    expect(checkCloze(item, item.gap).verdict).toBe('correct');
    expect(checkCloze(item, item.gap.toUpperCase()).verdict).toBe('correct');
    expect(checkCloze(item, item.sentence.gap === 'signed' ? 'sign' : 'write').verdict).toBe('wrong');
    expect(checkCloze(item, item.sentence.gap === 'signed' ? 'sign' : 'wrote').verdict).toBe('wrong');
  });

  it('Lösungen der Übung enthalten keinen Fehler der Verbform-Regel', () => {
    for (const p of AUX_PATTERNS) for (const it of p.items) expect(auxFormErrors(it.sentence, { strict: true }), it.sentence).toEqual([]);
  });
});

describe('Wochenbericht: kein „sicher“ bei offenen Radar-Fehlern', () => {
  const task = allSeedTasks().find((t) => t.topic === 'articles')!;
  const grammar = new Map<string, Record<string, unknown>>([['articles', { pats: { 'art.definite': { n: 10, c: 9, last: berlin('2026-10-21', 10), i: '2026-10-01', s: '2026-10-21', r: 31, k: 5, dd: ['2026-10-20', '2026-10-21'] } } }]]);
  const today = '2026-10-26';
  const days = lastWeekOf(today).days;
  const radarNow = berlin('2026-10-26', 10);

  it('radarOpenTopics: Thema über die Kennung oder über die Aufgabe, nur letzte 7 Tage', () => {
    const events = [ev({ c: 'articles', t: radarNow - 2 * DAY }), ev({ c: 'tense', q: task.prompt, t: radarNow - DAY }), ev({ c: 'passive', t: radarNow - 9 * DAY })];
    const open = radarOpenTopics(events, radarNow);
    expect(open.has('articles')).toBe(true);
    expect(open.has('passive')).toBe(false);
    expect(topicOfEvent({ c: 'tense', q: task.prompt })).toBe('articles');
    expect(topicOfEvent({ c: 'tense', q: 'unbekannt' })).toBeNull();
  });

  it('das Muster ist in der Woche sicher, wird aber nicht so genannt, solange das Radar Fehler zeigt', () => {
    expect(patternsNewSafe(grammar, days)).toEqual(['art.definite']);
    const open = new Set(['articles']);
    expect(patternsNewSafe(grammar, days, open)).toEqual([]);
    expect(patternsHeldBack(grammar, days, open)).toEqual(['articles']);
    const facts = weekFacts({ days, vocab: new Map(), grammar, writing: new Map(), talk: new Map(), profile: {}, radarOpen: open });
    expect(facts.some((f) => f.kind === 'pattern')).toBe(false);
    expect(weekFacts({ days, vocab: new Map(), grammar, writing: new Map(), talk: new Map(), profile: {} }).some((f) => f.kind === 'pattern')).toBe(true);
  });

  it('weekly3 meldet das offene Thema, ohne Radar bleibt alles wie bisher', () => {
    const base = { today, nowMs: radarNow, vocab: new Map(), chunk: new Map(), grammar, profile: {}, confusion: null, fixed: 0 };
    const held = weekly3({ ...base, radarOpen: new Set(['articles']) });
    expect(held.patternsSafe).toEqual([]);
    expect(held.radarOpen).toEqual(['articles']);
    const free = weekly3(base);
    expect(free.patternsSafe).toEqual(['art.definite']);
    expect(free.radarOpen).toEqual([]);
  });
});

describe('Antwortzeiten über 60 Sekunden sind Unterbrechungen', () => {
  it('eine richtige Antwort nach 146 s gilt nicht als langsam (Gut statt Schwer); die Hilfe deckelt weiter', () => {
    expect(INTERRUPT_MS).toBe(60_000);
    expect(gradeAnswer({ key: 'mc_en', verdict: 'correct', timeMs: 146_000 })).toBe(3);
    expect(gradeAnswer({ key: 'mc_en', verdict: 'correct', timeMs: 20_000 })).toBe(2);
    expect(gradeAnswer({ key: 'cloze', verdict: 'correct', timeMs: 400_000, firstKeyMs: 347_000 })).toBe(3);
    expect(gradeAnswer({ key: 'cloze', verdict: 'correct', timeMs: 400_000, firstKeyMs: 347_000, help: 2 })).toBe(2);
    expect(gradeAnswer({ key: 'cloze', verdict: 'wrong', timeMs: 400_000 })).toBe(1);
    expect(wasInterrupted({ key: 'mc_en', timeMs: 61_000 })).toBe(true);
    expect(wasInterrupted({ key: 'mc_en', timeMs: 59_000 })).toBe(false);
    expect(wasInterrupted({ key: 'speed', timeMs: 900_000 })).toBe(false);
  });
});

describe('Eigene Sätze im Fehlersatz-Schritt werden nicht ausgehungert', () => {
  it('mit Grenze wechseln sich Reparatur-Sätze und Grammatik-Fehlersätze ab; ohne Grenze bleibt „älteste zuerst“', () => {
    const old = NOW - 10 * DAY;
    let list = readRepairs(undefined);
    list = addRepairs(list, [{ wrong: 'Alpha one is wrong.', right: 'Alpha one is right.', src: 'write' }, { wrong: 'Beta two is wrong.', right: 'Beta two is right.', src: 'write' }, { wrong: 'Gamma three is wrong.', right: 'Gamma three is right.', src: 'talk' }], old)!;
    const repairDoc = { items: list };
    const grammarDocs = new Map<string, Record<string, unknown>>();
    for (let k = 0; k < 6; k++) {
      grammarDocs.set(`t${k}`, { errors: [] });
    }
    const all = dueFehlersaetze({ grammarDocs, repairDoc, nowMs: NOW, today: '2026-10-15' });
    expect(all.filter((f) => f.store === 'repair')).toHaveLength(3);
    const limited = dueFehlersaetze({ grammarDocs, repairDoc, nowMs: NOW, today: '2026-10-15', limit: 2 });
    expect(limited).toHaveLength(2);
    expect(limited.every((f) => f.store === 'repair')).toBe(true);
  });
});
