import { describe, expect, it } from 'vitest';
import { addDays, dayKey } from '../../src/domain/date';
import { similarMeaning, pickDissimilar } from '../../src/domain/srs/similar';
import {
  CAP_STEPS,
  DAY0_HOLD_MS,
  KERN_FROM,
  capDaysOf,
  capDue,
  day0Grade,
  dayStartOf,
  evidenceDays,
  freeLaterDays,
  freshFreeGood,
  holdOnDay0,
  introDayOf,
  introWasYesterday,
  knownConfirmed,
  longGapProven,
  recallStep,
} from '../../src/domain/srs/spacing';
import { readFsrs, reviewFsrs } from '../../src/domain/srs/scheduler';
import { wordKernLine, wordKernStats } from '../../src/domain/metrics/wordKern';
import { buildQueue } from '../../src/domain/srs/queue';
import { toTrainCard } from '../../src/domain/srs/cards';
import type { TrainCard } from '../../src/domain/srs/types';
import type { FsrsStored } from '../../src/data/schemas';
import { berlin } from './helpers';

// Wort-Lernen 2, Paket „Kern“ (docs/umbau/wort-fest-plan.md, 21.10.2026): reine Funktionen für Tag 0, Gestern-Check, Abstands-Deckel, Fest nach langer
// Pause, „Kenne ich“ am nächsten Tag, Ähnlichkeits-Sperre und Kennzahlen.

type Doc = Record<string, unknown>;
const D = 86_400_000;
const DAY = '2026-10-22';
const NOW = berlin(DAY, 10);
const at = (day: string, hour = 10) => berlin(day, hour);
const row = (day: string, x: string, g = 3, extra: Doc = {}) => ({ t: at(day), g, x, ...extra });
const review = (stability: number, due: number): FsrsStored => ({ v: 1, due, stability, difficulty: 5, state: 2, reps: 3, lapses: 0, last: NOW - D, scheduledDays: 10, learningSteps: 0, src: 'lx' });

describe('Tag 0: nur ein freier Abruf beendet die Lernphase, „Leicht“ zählt als „Gut“', () => {
  it('day0Grade: am Einführungstag wird 4 zu 3, sonst bleibt die Note', () => {
    expect(day0Grade(4, true)).toBe(3);
    expect(day0Grade(3, true)).toBe(3);
    expect(day0Grade(4, false)).toBe(4);
  });
  it('holdOnDay0: Review ohne freien Abruf → letzter Lernschritt (10 Min.); mit freiem Abruf oder schon in der Lernphase unverändert', () => {
    const f = review(3, NOW + 3 * D);
    const held = holdOnDay0(f, NOW, false);
    expect(held.state).toBe(1);
    expect(held.due).toBe(NOW + DAY0_HOLD_MS);
    expect(held.stability).toBe(f.stability);
    expect(holdOnDay0(f, NOW, true)).toBe(f);
    const learning = { ...f, state: 1 };
    expect(holdOnDay0(learning, NOW, false)).toBe(learning);
  });
  it('freshFreeGood: getippt/frei ab Note 3, ohne Tipp, geprüft; Auswahl, Stütze, Aufdecken und Partnerwort zählen nicht', () => {
    expect(freshFreeGood({ t: NOW, ex: 'cloze', grade: 3 })).toBe(true);
    expect(freshFreeGood({ t: NOW, ex: 'type', grade: 4 })).toBe(true);
    expect(freshFreeGood({ t: NOW, ex: 'cloze', grade: 2 })).toBe(false);
    expect(freshFreeGood({ t: NOW, ex: 'cloze', grade: 3, hint: 1 })).toBe(false);
    expect(freshFreeGood({ t: NOW, ex: 'cloze', grade: 3, unverified: true })).toBe(false);
    expect(freshFreeGood({ t: NOW, ex: 'cloze_hint', grade: 3 })).toBe(false);
    expect(freshFreeGood({ t: NOW, ex: 'mc_en', grade: 3 })).toBe(false);
    expect(freshFreeGood({ t: NOW, ex: 'flip', grade: 4 })).toBe(false);
    expect(freshFreeGood({ t: NOW, ex: 'colloc', grade: 3, colIndex: 0 })).toBe(false);
  });
  it('Dämpfung auch beim Übergang aus der Lernphase: Auswahl-Erfolg (Gewicht < 1) setzt eine kleinere Start-Stabilität als ein freier Abruf', () => {
    const learning: FsrsStored = { v: 1, due: NOW, stability: 2, difficulty: 5, state: 1, reps: 1, lapses: 0, last: NOW - 600_000, scheduledDays: 0, learningSteps: 1, src: 'lx' };
    const full = reviewFsrs(learning, 3, NOW, 1);
    const damped = reviewFsrs(learning, 3, NOW, 0.55);
    expect(full.state).toBe(2);
    expect(damped.state).toBe(2);
    expect(damped.stability).toBeCloseTo(0.55 * full.stability, 3);
    expect(damped.due).toBeLessThanOrEqual(full.due);
  });
});

describe('Abstands-Deckel', () => {
  it('capDaysOf: 0 → 1, 1 → 3, 2 → 7, ab 3 → 21', () => {
    expect([0, 1, 2, 3, 4, 9].map(capDaysOf)).toEqual([1, 3, 7, 21, 21, 21]);
    expect(CAP_STEPS).toEqual([1, 3, 7, 21]);
  });
  it('capDue kürzt nur, nie länger, und nur im Review-Zustand; Grenze ist 04:00 des Lerntags', () => {
    const long = review(30, NOW + 30 * D);
    const c = capDue(long, NOW, 3);
    expect(c.due).toBe(dayStartOf(addDays(DAY, 3)));
    expect(new Date(c.due).getHours()).toBe(4);
    expect(c.scheduledDays).toBe(3);
    expect(c.stability).toBe(30);
    const short = review(1, NOW + 0.5 * D);
    expect(capDue(short, NOW, 3)).toBe(short);
    const learning = { ...long, state: 1 };
    expect(capDue(learning, NOW, 1)).toBe(learning);
  });
  it('capDue über die Zeitumstellung (25.10.2026): fällig um 04:00 Ortszeit', () => {
    const t = at('2026-10-24');
    const c = capDue(review(30, t + 30 * D), t, 1);
    expect(dayKey(c.due)).toBe('2026-10-25');
    expect(new Date(c.due).getHours()).toBe(4);
  });
  it('freeLaterDays: nur Tage NACH dem Einführungstag, nur gute freie Abrufe, je Tag einmal; ein Wendungsteil höchstens einen Tag', () => {
    const doc = {
      intro: '2026-10-01',
      hist: [row('2026-10-01', 'cloze'), row('2026-10-02', 'cloze'), row('2026-10-02', 'type'), row('2026-10-05', 'mc_en'), row('2026-10-06', 'cloze', 2), row('2026-10-08', 'cloze_part'), row('2026-10-09', 'cloze_part'), row('2026-10-10', 'flip', 4)],
    };
    expect(introDayOf(doc)).toBe('2026-10-01');
    // 02.10. (frei) + ein Wendungsteil-Tag = 2
    expect(freeLaterDays(doc)).toBe(2);
    expect(freeLaterDays(doc, { t: at('2026-10-12'), ex: 'cloze', grade: 3 })).toBe(3);
    expect(freeLaterDays(doc, { t: at('2026-10-12'), ex: 'mc_en', grade: 3 })).toBe(2);
  });
  it('introDayOf ohne `intro`: Tag der ersten Antwort (ohne „Kenne ich“, beide Formen der Markierung)', () => {
    expect(introDayOf({ hist: [row('2026-10-03', 'known'), row('2026-10-04', 'cloze')] })).toBe('2026-10-04');
    expect(introDayOf({ hist: [{ t: at('2026-10-03'), m: 'known', g: 3 }, row('2026-10-04', 'cloze')] })).toBe('2026-10-04');
    expect(introDayOf({})).toBeNull();
  });
  it('evidenceDays: die Stufe zählt als Mindest-Beleg (Tor: Stufe 4 = 2, Stufe 5 = 3 freie Tage), auch wenn der Verlauf alte Belege verloren hat', () => {
    expect(evidenceDays({ state: 'review', stage: 3, hist: [] })).toBe(0);
    expect(evidenceDays({ state: 'review', stage: 4, hist: [] })).toBe(2);
    expect(evidenceDays({ state: 'review', stage: 5, hist: [] })).toBe(3);
    expect(evidenceDays({ state: 'new', stage: 5, hist: [] })).toBe(0);
  });
  it('longGapProven: freier guter Abruf ≥ 21 Lerntage nach der Antwort davor – oder erster Fest-Tag `ff` ab Stichtag', () => {
    expect(longGapProven({ hist: [row('2026-09-01', 'mc_en'), row('2026-09-22', 'cloze')] })).toBe(true);
    expect(longGapProven({ hist: [row('2026-09-01', 'mc_en'), row('2026-09-21', 'cloze')] })).toBe(false);
    expect(longGapProven({ hist: [row('2026-09-01', 'mc_en'), row('2026-09-22', 'mc_de')] })).toBe(false);
    expect(longGapProven({ hist: [row('2026-09-01', 'mc_en'), row('2026-09-22', 'cloze', 2)] })).toBe(false);
    expect(longGapProven({ hist: [row('2026-09-01', 'mc_en'), row('2026-09-22', 'cloze_part')] })).toBe(false);
    expect(longGapProven({ ff: KERN_FROM, hist: [] })).toBe(true);
    expect(longGapProven({ ff: '2026-10-19', hist: [] })).toBe(false);
  });
});

describe('Abrufe: Tag 0, Gestern-Check, „Kenne ich“ am nächsten Tag', () => {
  it('recallStep: neu → hint; am Einführungstag nach einem richtigen Abruf → free; erster Tag danach → check; danach null', () => {
    expect(recallStep({ isNew: true, doc: {} }, DAY)).toBe('hint');
    expect(recallStep({ isNew: false, doc: { intro: DAY, hist: [row(DAY, 'cloze_hint', 1)] } }, DAY)).toBe('hint');
    expect(recallStep({ isNew: false, doc: { intro: DAY, hist: [row(DAY, 'cloze_hint', 3)] } }, DAY)).toBe('free');
    const day0 = { intro: DAY, hist: [row(DAY, 'cloze_hint', 3), row(DAY, 'cloze', 3)] };
    expect(recallStep({ isNew: false, doc: day0 }, addDays(DAY, 1))).toBe('check');
    // Auch nach Tagen Pause ist der erste Abruf nach dem Einführungstag der „Check“ (Beschriftung dann „Erster Abruf seit dem Lernen“).
    expect(recallStep({ isNew: false, doc: day0 }, addDays(DAY, 4))).toBe('check');
    expect(introWasYesterday(day0, addDays(DAY, 1))).toBe(true);
    expect(introWasYesterday(day0, addDays(DAY, 4))).toBe(false);
    const after = { ...day0, hist: [...day0.hist, row(addDays(DAY, 1), 'cloze', 3)] };
    expect(recallStep({ isNew: false, doc: after }, addDays(DAY, 3))).toBeNull();
    // „Kenne ich“ am Einführungstag: der nächste Tag ist der Check.
    expect(recallStep({ isNew: false, doc: { intro: DAY, hist: [{ t: at(DAY), m: 'known', g: 3 }] } }, addDays(DAY, 1))).toBe('check');
  });
  it('knownConfirmed: nur an einem späteren Lerntag und nur mit gutem freiem Abruf', () => {
    const doc = { hist: [{ t: at(DAY), m: 'known', g: 3 }] };
    expect(knownConfirmed(doc, { t: at(addDays(DAY, 1)), ex: 'cloze', grade: 3 })).toBe(true);
    expect(knownConfirmed(doc, { t: at(DAY, 11), ex: 'cloze', grade: 3 })).toBe(false);
    expect(knownConfirmed(doc, { t: at(addDays(DAY, 1)), ex: 'mc_en', grade: 3 })).toBe(false);
    expect(knownConfirmed(doc, { t: at(addDays(DAY, 1)), ex: 'cloze', grade: 1 })).toBe(false);
    expect(knownConfirmed({ hist: [row(DAY, 'cloze')] }, { t: at(addDays(DAY, 1)), ex: 'cloze', grade: 3 })).toBe(false);
  });
});

const vocabDoc = (word: string, de: string, over: Doc = {}): Doc => ({ word, de, def: `meaning of ${word}`, ex: `We [${word}] it.`, pos: 'verb', state: 'new', S: 0, D: 5, due: 0, last: 0, reps: 0, lapses: 0, stage: 0, src: 'lookup', added: '2026-10-01', ...over });
const card = (word: string, de: string, over: Doc = {}): TrainCard => toTrainCard(word.replace(/\s+/g, '_'), vocabDoc(word, de, over), true, NOW)!;

describe('Ähnliche Bedeutung am selben Einführungstag', () => {
  it('erkennt gemeinsame Inhaltswörter (EN, DE) und Varianten; Füllwörter und dasselbe Wort zählen nicht', () => {
    expect(similarMeaning(card('raise concerns', 'Bedenken äußern'), card('address concerns', 'Bedenken ausräumen'))).toBe(true);
    expect(similarMeaning(card('tackle', 'etwas angehen'), card('address', 'angehen, ansprechen'))).toBe(true);
    expect(similarMeaning(card('mitigate', 'mindern', { alt: ['alleviate'] }), card('alleviate', 'lindern'))).toBe(true);
    expect(similarMeaning(card('take over', 'übernehmen'), card('take part', 'teilnehmen'))).toBe(false);
    expect(similarMeaning(card('leverage', 'nutzen'), card('postpone', 'verschieben'))).toBe(false);
    expect(similarMeaning(card('leverage', 'nutzen'), card('leverage', 'nutzen'))).toBe(false);
  });
  it('pickDissimilar: ähnliche Karten werden zurückgestellt, die Zahl neuer Karten sinkt nie (Untergrenze bleibt)', () => {
    const a = card('raise concerns', 'Bedenken äußern');
    const b = card('address concerns', 'Bedenken ausräumen');
    const c = card('postpone', 'verschieben');
    expect(pickDissimilar([a, b, c], 2, []).map((x) => x.word)).toEqual(['raise concerns', 'postpone']);
    // Heute schon eingeführt: „address concerns“ → „raise concerns“ wird zurückgestellt.
    expect(pickDissimilar([a, c], 1, [b]).map((x) => x.word)).toEqual(['postpone']);
    // Reicht der Vorrat nicht, wird aufgefüllt.
    expect(pickDissimilar([a, b], 2, []).map((x) => x.word)).toEqual(['raise concerns', 'address concerns']);
    // `accept` (dasselbe Wort nur einmal) zählt nur angenommene Karten.
    expect(pickDissimilar([a, b, c], 2, [], (x) => x !== c).map((x) => x.word)).toEqual(['raise concerns', 'address concerns']);
    expect(pickDissimilar([a, b], 0, [])).toEqual([]);
  });
  it('buildQueue: zwei ähnliche neue Wörter nicht am selben Tag, solange andere da sind', () => {
    const cards = [card('raise concerns', 'Bedenken äußern', { order: 1 }), card('address concerns', 'Bedenken ausräumen', { order: 2 }), card('postpone', 'verschieben', { order: 3 }), card('leverage', 'nutzen', { order: 4 })];
    const q = buildQueue({ cards, nowMs: NOW, target: 10, newQuotaLeft: 2, exclude: new Set(), lang: 'de' });
    const words = q.filter((x) => x.reason === 'new').map((x) => cards.find((c) => c.key === x.key)?.word);
    expect(words).toHaveLength(2);
    expect(words.includes('raise concerns') && words.includes('address concerns')).toBe(false);
  });
});

describe('Gestern-Check am Anfang der Pflichtrunde', () => {
  it('buildQueue: die Karte von gestern steht vor den übrigen fälligen Karten', () => {
    const yesterday = addDays(DAY, -1);
    const old = (i: number) => card(`older${i}`, `Wort ${i}`, { state: 'review', stage: 3, S: 5, reps: 4, last: NOW - 9 * D, due: NOW - 4 * D, intro: '2026-09-01', hist: [row('2026-09-01', 'cloze'), row('2026-10-13', 'cloze')] });
    const fresh = card('negotiate', 'verhandeln', { state: 'review', stage: 1, S: 1, reps: 2, last: at(yesterday), due: dayStartOf(DAY), intro: yesterday, hist: [row(yesterday, 'cloze_hint'), row(yesterday, 'cloze')] });
    const cards = [old(1), old(2), old(3), fresh];
    const q = buildQueue({ cards, nowMs: NOW, target: 4, newQuotaLeft: 0, exclude: new Set(), lang: 'de' });
    expect(q[0]?.key).toBe(fresh.key);
    expect(recallStep(fresh, DAY)).toBe('check');
    // Alte Karte mit Einführungstag, aber leerem Verlauf: kein Gestern-Check (nichts belegt), gewöhnliche Leiter.
    expect(recallStep({ isNew: false, doc: { intro: '2026-09-01', hist: [] } }, DAY)).toBeNull();
  });
});

describe('Kennzahlen (Diagnose und „Messwerte dahinter“)', () => {
  const today = '2026-12-01';
  const mk = (kind: 'v' | 'chunk', doc: Doc, isNew = false) => ({ doc, kind: kind === 'chunk' ? ('chunk' as const) : ('vocab' as const), isNew, hidden: false }) as unknown as Pick<TrainCard, 'doc' | 'kind' | 'isNew' | 'hidden'>;
  it('zählt Folgetag, erste freie Antwort bei Wendungen, Abruf nach langer Pause, Median bis „Sicher“, Problemwörter und frei : Erkennen', () => {
    const cards = [
      // Folgetag frei richtig; Sicher nach 1 Tag
      mk('v', { intro: '2026-11-20', hist: [row('2026-11-20', 'cloze_hint'), row('2026-11-20', 'cloze'), row('2026-11-21', 'cloze'), row('2026-11-24', 'mc_en')] }),
      // Folgetag frei falsch; 2 Rückfälle (Problemwort)
      mk('v', { intro: '2026-11-20', lapses: 2, hist: [row('2026-11-20', 'cloze'), row('2026-11-21', 'cloze', 1), row('2026-11-22', 'type')] }),
      // Wendung: erste freie Antwort falsch, dann Abruf nach 25 Tagen Pause richtig
      mk('chunk', { intro: '2026-11-04', hist: [row('2026-11-04', 'tiles'), row('2026-11-04', 'cloze_part', 1), row('2026-11-29', 'cloze')] }),
      mk('v', { state: 'new' }, true),
    ];
    const s = wordKernStats(cards, today);
    // Folgetag: a richtig, b falsch, c (erste Antwort nach dem Einführungstag ist der richtige Abruf nach 25 Tagen) richtig.
    expect(s.nextDay).toEqual({ n: 3, ok: 2, share: 2 / 3 });
    expect(s.chunkFirst).toEqual({ n: 1, ok: 0, share: 0 });
    expect(s.longGap).toEqual({ n: 1, ok: 1, share: 1 });
    expect(s.medianSafe.n).toBe(2);
    expect(s.problem).toEqual({ n: 1, of: 3, share: 1 / 3 });
    expect(s.ratio.recog).toBe(1);
    expect(s.ratio.free).toBeGreaterThanOrEqual(6);
    const line = wordKernLine(s);
    expect(line).toContain('Folgetag frei: 67 % von 3');
    expect(line).toContain('Ziel ≥ 70 %');
    expect(line).not.toMatch(/leverage|negotiate/);
  });
  it('ohne Daten: keine Quoten (null), keine Division durch 0', () => {
    const s = wordKernStats([], today);
    expect(s.nextDay.share).toBeNull();
    expect(s.medianSafe.days).toBeNull();
    expect(s.problem.share).toBeNull();
    expect(s.ratio.value).toBeNull();
    expect(wordKernLine(s)).toContain('keine Messwerte');
  });
});

describe('readFsrs bleibt unverändert lesbar (Felder der alten App)', () => {
  it('S, D, due, stage werden nicht umgeschrieben', () => {
    const doc = { state: 'review', S: 12, D: 4, due: NOW + 5 * D, last: NOW - 7 * D, reps: 4, lapses: 0, stage: 3 };
    const f = readFsrs(doc, NOW);
    expect(f.stability).toBe(12);
    expect(doc.S).toBe(12);
  });
});
