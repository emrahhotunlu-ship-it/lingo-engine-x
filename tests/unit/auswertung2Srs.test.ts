import { describe, expect, it } from 'vitest';
import { dayKey } from '../../src/domain/date';
import { applyUpdate, cardPatch, stageStep } from '../../src/domain/srs/applyReview';
import { toTrainCard } from '../../src/domain/srs/cards';
import { chooseExercise, productionWeak } from '../../src/domain/srs/modes';
import { FREE_ANSWER, freeCorrectDays, freeDaysNeeded } from '../../src/domain/srs/variety';
import type { AnswerEvent, ExerciseId, TrainCard } from '../../src/domain/srs/types';
import { radarView } from '../../src/domain/progress/radar';
import { radarOpenTopics, weekEndMs } from '../../src/domain/radar/open';
import { dueFehlersaetze } from '../../src/domain/repair/fehlersaetze';
import { addRepairs, readRepairs } from '../../src/domain/repair/repair';
import { berlin } from './helpers';

// Auswertung 15.10.2026, zweite Runde (Prüfung Lernwissenschaft H1, M1–M3, M5, M6, N1, N4, N6).

type Doc = Record<string, unknown>;
const NOW = berlin('2026-10-15', 10);
const D = 86_400_000;
const ENV = { tts: false, ai: false, touch: false, listen: false };
const COL = [{ p: 'reassure customers', de: 'Kunden beruhigen', gap: 'customers', opts: ['clients', 'friends', 'owners'], ex: 'We [reassure customers] every time.' }];
const doc = (over: Doc = {}): Doc => ({
  word: 'reassure',
  de: 'beruhigen',
  def: 'to make someone feel less worried',
  ex: 'We [reassure] the customer every time.',
  pos: 'verb',
  state: 'review',
  stage: 3,
  S: 4,
  D: 5,
  due: NOW - D,
  last: NOW - 3 * D,
  reps: 6,
  lapses: 0,
  hist: [],
  modes: {},
  src: 'lookup',
  added: '2026-08-01',
  ...over,
});
const answer = (ex: ExerciseId, grade: 1 | 2 | 3 | 4, over: Partial<AnswerEvent> = {}): AnswerEvent => ({ t: NOW, day: dayKey(NOW), kind: 'v', id: 'reassure', ex, grade, given: 'x', ans: 'y', ms: 3000, lang: 'de', ctx: 'rev', ...over });
const hist = (...e: Array<[number, string, number]>): Doc[] => e.map(([ago, x, g]) => ({ t: NOW - ago * D, m: 'type', g, x }));

describe('H1: kein Stau auf Stufe 3 – immer eine freie Art zur Wahl', () => {
  const picks: string[] = [];
  const run = (start: Doc, days: number): Doc => {
    let d = start;
    picks.length = 0;
    for (let k = 0; k < days; k++) {
      const t = NOW + (k + 1) * D; // ein Lerntag nach dem anderen, je eine Antwort
      const c = toTrainCard('reassure', d, true, t) as TrainCard;
      const ex = chooseExercise(c, 'de', 12, [], ENV);
      expect(ex).not.toBeNull();
      picks.push(`${ex}`);
      const a = answer(ex as ExerciseId, 3, { t, day: dayKey(t), ...(ex === 'colloc' || ex === 'colloc_gap' ? { colIndex: 0 } : {}) });
      d = applyUpdate(d, cardPatch(d, a));
    }
    return d;
  };

  it('Karte mit Partner und Satz auf Stufe 3 steckt nicht fest: die freie Art kommt, und nach zwei freien Lerntagen steht sie auf Stufe 4', () => {
    const start = doc({ stage: 3, col: COL, hist: hist([8, 'cloze_hint', 3], [6, 'colloc_gap', 3], [4, 'cloze_hint', 3]), modes: { cloze: { c: 6, w: 0 }, colloc: { c: 4, w: 0 } }, xs: { cloze_hint: { c: 6, w: 0 }, colloc_gap: { c: 4, w: 0 } } });
    // Die Regel „dieselbe Art nie zweimal in Folge“ (V1) bleibt: die eine zählende freie Art (cloze) kommt an jedem zweiten Lerntag, Treffer am Partnerwort (colloc) zählen nicht (M3).
    // Tag 1 frei, Tag 2 Stütze/Partner, Tag 3 frei: Stufe 4 am dritten Lerntag, nicht nie.
    const after = run(start, 3);
    expect(after.stage, picks.join(',')).toBe(4);
    expect(picks.filter((e) => e === 'cloze').length).toBeGreaterThanOrEqual(2);
    expect(freeCorrectDays(after)).toBeGreaterThanOrEqual(2);
  });

  it('auch ohne Partner (nur Satz) und mit nur Stütz-Arten im Verlauf', () => {
    const start = doc({ stage: 3, hist: hist([8, 'cloze_hint', 3], [6, 'cloze_hint', 3]), xs: { cloze_hint: { c: 9, w: 0 } } });
    expect(run(start, 3).stage, picks.join(',')).toBe(4);
  });

  it('ohne brauchbaren Satz (nur Bedeutung) kommt die freie Abfrage „type“ und die Karte steigt', () => {
    const start = doc({ stage: 3, ex: undefined, hist: hist([8, 'mc_de', 3], [6, 'match', 3]), xs: { mc_de: { c: 9, w: 0 }, match: { c: 9, w: 0 } } });
    const after = run(start, 4);
    expect(picks.some((e) => FREE_ANSWER.has(e)), picks.join(',')).toBe(true);
    expect(after.stage, picks.join(',')).toBe(4);
  });

  it('productionWeak zählt die freien Arten (xs), nicht die alten Modi: Stütz-Treffer ersetzen keine freie Antwort', () => {
    const base = { modes: { recog: { c: 20, w: 0 }, cloze: { c: 10, w: 0 }, colloc: { c: 10, w: 0 } } };
    // Nur Stütze und Auswahl geübt (cloze_hint, colloc_gap): alte Modi sehen nach „Produktion“ aus, aber es gab keine freie Antwort.
    const supportOnly = toTrainCard('reassure', doc({ ...base, xs: { cloze_hint: { c: 10, w: 0 }, colloc_gap: { c: 10, w: 0 } } }), true, NOW) as TrainCard;
    expect(productionWeak(supportOnly)).toBe(true);
    const freeOk = toTrainCard('reassure', doc({ ...base, xs: { cloze: { c: 9, w: 1 }, type: { c: 9, w: 1 } } }), true, NOW) as TrainCard;
    expect(productionWeak(freeOk)).toBe(false);
    // Karten ohne xs (nur alte Zähler) fallen auf die alten Modi zurück.
    const legacy = toTrainCard('reassure', doc({ modes: { recog: { c: 8, w: 2 }, type: { c: 8, w: 2 } } }), true, NOW) as TrainCard;
    expect(productionWeak(legacy)).toBe(false);
  });

  it('solange freie Tage fehlen, steht mindestens eine freie Art zur Wahl (Stufe 3 und 4); ist das Tor offen, nicht mehr nötig', () => {
    const c3 = toTrainCard('reassure', doc({ stage: 3, col: COL, xs: { cloze_hint: { c: 9, w: 0 }, colloc_gap: { c: 9, w: 0 } } }), true, NOW) as TrainCard;
    const picks = new Set<ExerciseId | null>();
    for (let i = 0; i < 4; i++) picks.add(chooseExercise({ ...c3, lastEx: i % 2 ? 'cloze' : 'colloc' }, 'de', 12, [], ENV));
    expect([...picks].some((e) => e && FREE_ANSWER.has(e))).toBe(true);
  });
});

describe('M1: Erklärung zum ausbleibenden Aufstieg', () => {
  it('stageStep nennt, wie viele freie Tage noch fehlen', () => {
    expect(stageStep(doc({ stage: 3 }), answer('cloze', 3))).toEqual({ stage: 3, missing: 1 });
    expect(stageStep(doc({ stage: 3, hist: hist([4, 'type', 3]) }), answer('cloze', 3))).toEqual({ stage: 4, missing: 0 });
    expect(stageStep(doc({ stage: 3 }), answer('cloze_hint', 3))).toEqual({ stage: 3, missing: 2 });
  });
  it('kein Hinweis, wenn die Stufe aus anderem Grund bleibt (Tagesbremse) oder ohnehin nicht steigt', () => {
    expect(stageStep(doc({ stage: 3, last: NOW - 1000 }), answer('cloze', 3)).missing).toBe(0);
    expect(stageStep(doc({ stage: 3 }), answer('cloze', 1)).missing).toBe(0);
  });
});

describe('M2: Stufe 5 ist strenger als Stufe 4', () => {
  it('Stufe 4 braucht zwei, Stufe 5 drei freie Tage', () => {
    expect(freeDaysNeeded(4)).toBe(2);
    expect(freeDaysNeeded(5)).toBe(3);
    expect(cardPatch(doc({ stage: 4, hist: hist([7, 'type', 3], [6, 'cloze', 3]) }), answer('produce', 3)).stage).toBe(5);
    expect(cardPatch(doc({ stage: 4, hist: hist([6, 'cloze', 3]) }), answer('produce', 3)).stage).toBe(4);
  });
});

describe('M3: Treffer am Partnerwort ist kein freier Beleg für das Hauptwort', () => {
  it('colloc mit Partner-Index zählt nicht, colloc ohne (Pack-Lücke) schon', () => {
    const h = [{ t: NOW - 3 * D, m: 'colloc', g: 3, x: 'colloc', ci: 0 }, { t: NOW - 2 * D, m: 'colloc', g: 3, x: 'colloc' }];
    expect(freeCorrectDays({ hist: h })).toBe(1);
    expect(freeCorrectDays({ hist: h }, { t: NOW, ex: 'colloc', grade: 3, ci: 1 })).toBe(1);
    expect(freeCorrectDays({ hist: h }, { t: NOW, ex: 'cloze', grade: 3 })).toBe(2);
  });
  it('die Antwort schreibt ci in den Verlauf', () => {
    const p = cardPatch(doc({ stage: 4, col: COL }), answer('colloc', 3, { colIndex: 0 })) as unknown as { hist: Array<Record<string, unknown>> };
    expect(p.hist.at(-1)).toMatchObject({ x: 'colloc', ci: 0 });
    const q = cardPatch(doc({ stage: 4 }), answer('cloze', 3)) as unknown as { hist: Array<Record<string, unknown>> };
    expect(q.hist.at(-1)).not.toHaveProperty('ci');
  });
});

describe('N1: unterbrochene richtige Antwort', () => {
  it('Note bleibt, aber die Stufe steigt nicht', () => {
    const h = hist([6, 'type', 3], [5, 'cloze', 3]);
    expect(cardPatch(doc({ stage: 3, hist: h }), answer('cloze', 3)).stage).toBe(4);
    expect(cardPatch(doc({ stage: 3, hist: h }), answer('cloze', 3, { interrupted: true })).stage).toBe(3);
    expect(cardPatch(doc({ stage: 2 }), answer('cloze_hint', 3, { interrupted: true })).stage).toBe(2);
  });
  it('ein Fehler senkt weiterhin', () => {
    expect(cardPatch(doc({ stage: 4 }), answer('cloze', 1)).stage).toBe(3);
  });
});

describe('N6: ungeprüfter eigener Satz zählt nicht als freier Tag', () => {
  it('unverified schreibt u: 1 in den Verlauf; freeCorrectDays überspringt den Eintrag', () => {
    const p = cardPatch(doc({ stage: 4 }), answer('complete', 2, { unverified: true })) as unknown as { hist: Array<Record<string, unknown>> };
    expect(p.hist.at(-1)).toMatchObject({ x: 'complete', u: 1 });
    expect(freeCorrectDays({ hist: p.hist })).toBe(0);
    const ok = cardPatch(doc({ stage: 4 }), answer('complete', 3)) as unknown as { hist: Array<Record<string, unknown>> };
    expect(ok.hist.at(-1)).not.toHaveProperty('u');
    expect(freeCorrectDays({ hist: ok.hist })).toBe(1);
  });
});

describe('M5: Reparatur-Durchgang mischt eigene Sätze und Grammatik, ohne Grenze', () => {
  const err = (q: string, ans: string, t: number): Doc => ({ q, given: 'are repaired', ans, t, src: 'test' });
  it('mix: true ohne limit wechselt ab (eigener Satz, Grammatik, …); ohne mix bleibt „älteste zuerst“, auch wenn die Grammatik-Fehler älter sind', () => {
    const grammarDocs = new Map<string, Doc>([['passive', { errors: [err('A report ___ daily.', 'is checked', NOW - 9 * D), err('The roads ___ every year.', 'are checked', NOW - 8 * D), err('The files ___ monthly.', 'are archived', NOW - 7 * D)] }]]);
    const own = addRepairs(readRepairs(undefined), [{ wrong: 'Alpha one is wrong.', right: 'Alpha one is right.', src: 'write' }, { wrong: 'Beta two is wrong.', right: 'Beta two is right.', src: 'write' }], NOW - 5 * D)!;
    // Eigene Sätze jünger (später fällig) als die Grammatik-Fehler: „älteste zuerst“ stellt sie ganz nach hinten.
    const repairDoc = { items: own.map((r) => ({ ...r, due: NOW - 2 * D })) };
    const plain = dueFehlersaetze({ grammarDocs, repairDoc, nowMs: NOW, today: '2026-10-15' });
    expect(plain.map((f) => f.store)).toEqual(['grammar', 'grammar', 'grammar', 'repair', 'repair']);
    const mixed = dueFehlersaetze({ grammarDocs, repairDoc, nowMs: NOW, today: '2026-10-15', mix: true });
    expect(mixed.map((f) => f.store)).toEqual(['repair', 'grammar', 'repair', 'grammar', 'grammar']);
    expect(mixed.slice(0, 5).map((f) => f.id).sort()).toEqual(plain.map((f) => f.id).sort());
    // Erledigte Sätze entfernen und dann 5 nehmen: die eigenen Sätze sind dabei.
    expect(mixed.slice(0, 4).filter((f) => f.store === 'repair')).toHaveLength(2);
  });
  it('limit ohne mix bleibt gemischt (bestehendes Verhalten), mix: false schaltet es ab', () => {
    const grammarDocs = new Map<string, Doc>([['passive', { errors: [err('A report ___ daily.', 'is checked', NOW - 9 * D)] }]]);
    const own = addRepairs(readRepairs(undefined), [{ wrong: 'Alpha one is wrong.', right: 'Alpha one is right.', src: 'write' }], NOW - 5 * D)!;
    const repairDoc = { items: own.map((r) => ({ ...r, due: NOW - D })) };
    expect(dueFehlersaetze({ grammarDocs, repairDoc, nowMs: NOW, today: '2026-10-15', limit: 2 }).map((f) => f.store)).toEqual(['repair', 'grammar']);
    expect(dueFehlersaetze({ grammarDocs, repairDoc, nowMs: NOW, today: '2026-10-15', limit: 2, mix: false }).map((f) => f.store)).toEqual(['grammar', 'repair']);
  });
});

describe('M6: Radar-Zeile „Verbform nach Hilfsverb“ steht nach ihrer Häufigkeit, nicht immer oben', () => {
  const ev = (over: Record<string, unknown>) => ({ c: 'tense', s: 'g', t: NOW - D, q: 'x', g: '', a: '', ...over });
  it('ein einziger Treffer steht hinter häufigeren Zeilen', () => {
    const events = [
      ...Array.from({ length: 4 }, (_, i) => ev({ c: 'prep', g: `look for ${i}`, a: 'look at', t: NOW - (i + 1) * D })),
      ev({ c: 'tense', g: 'will worked', a: 'will have worked' }),
    ];
    const rows = radarView(events, NOW);
    expect(rows[0]?.c).toBe('prep');
    expect(rows.findIndex((r) => r.c === 'auxform')).toBeGreaterThan(0);
  });
  it('bei Gleichstand und mehr Treffern steht sie vorn', () => {
    const events = [ev({ c: 'tense', g: 'will worked', a: 'will have worked' }), ev({ c: 'tense', g: 'had sign', a: 'had signed', t: NOW - 2 * D }), ev({ c: 'prep', g: 'x', a: 'y' })];
    expect(radarView(events, NOW)[0]?.c).toBe('auxform');
  });
});

describe('N4: Wochenbericht rechnet das Radar ab Berichtsende', () => {
  it('Ereignisse nach dem Ende der Woche und Ereignisse davor außerhalb von 7 Tagen zählen nicht', () => {
    const end = weekEndMs('2026-10-11');
    expect(dayKey(end - 1)).toBe('2026-10-11');
    expect(dayKey(end + 1)).toBe('2026-10-12');
    const events = [
      { c: 'articles', s: 'g', t: end - 2 * D, q: '', g: 'a', a: 'b' },
      { c: 'passive', s: 'g', t: end + 2 * D, q: '', g: 'a', a: 'b' },
      { c: 'tense', s: 'g', t: end - 9 * D, q: '', g: 'a', a: 'b' },
    ];
    const open = radarOpenTopics(events, end);
    expect(open.has('articles')).toBe(true);
    expect(open.has('passive')).toBe(false);
  });
});
