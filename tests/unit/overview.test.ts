import { describe, expect, it } from 'vitest';
import { buildOverview, learningDayEnd, mergedVocab } from '../../src/domain/overview';
import { addDays } from '../../src/domain/date';
import { berlin, loadSeed, SEED_ANCHOR, type Doc } from './helpers';

function fromSeed(seed: Record<string, Doc>, nowMs: number, schema: Doc | null = null) {
  const coll = (name: string) =>
    new Map(Object.entries(seed).filter(([p]) => p.startsWith(`${name}/`)).map(([p, d]) => [p.slice(name.length + 1), d]));
  return buildOverview({
    nowMs,
    profile: seed['app/profile'],
    course: seed['app/course'],
    assess: seed['app/assess'],
    schema,
    vocab: coll('vocab'),
    grammar: coll('grammar'),
  });
}

describe('Übersicht „Dein Stand"', () => {
  it('zeigt Serie, Kurs, Wortschatz und Einschätzung aus den Testdaten', () => {
    const ov = fromSeed(loadSeed(), berlin(SEED_ANCHOR, 21));
    expect(ov.streak).toMatchObject({ count: 12, todayDone: true });
    expect(ov.course).toMatchObject({ done: 6, total: 24 });
    expect(ov.course.next?.id).toBe('l07');
    expect(ov.course.units.map((u) => u.done)).toEqual([4, 2, 0, 0, 0, 0]);
    expect(ov.vocab.total).toBe(148 - 2); // 138 Dokumente + 10 Voreinstellungen, 2 ausgeblendet
    expect(ov.vocab.hidden).toBe(2);
    expect(ov.vocab.byStage.reduce((a, b) => a + b, 0)).toBe(ov.vocab.total);
    expect(ov.vocab.byStage.every((n) => n > 0)).toBe(true);
    expect(ov.vocab.due).toBeGreaterThan(0);
    // 16 Themen der alten App + 7 des C1-Werkzeugkastens.
    expect(ov.grammar.topics).toHaveLength(39);
    expect(ov.grammar.weakest).toHaveLength(3);
    expect(ov.assess).toMatchObject({ cefr: 'B2', lang: 'de' });
  });

  it('am nächsten Morgen ist heute noch offen, die Serie bleibt', () => {
    const ov = fromSeed(loadSeed(), berlin(addDays(SEED_ANCHOR, 1), 9));
    expect(ov.streak).toMatchObject({ count: 12, todayDone: false });
  });

  it('nach zwei Tagen Pause ohne Umstellung ist die Serie beendet', () => {
    const ov = fromSeed(loadSeed(), berlin(addDays(SEED_ANCHOR, 2), 9));
    expect(ov.streak.count).toBe(0);
  });

  it('nach der Umstellung ohne Pflicht-Erfassung zählt die alte Regel weiter (kein Abriss)', () => {
    const seed = loadSeed();
    const schema = { version: 1, cutover: SEED_ANCHOR, migratedAt: berlin(SEED_ANCHOR, 21) };
    const profile = seed['app/profile'] as Doc & { days: Record<string, number> };
    const days = { ...profile.days };
    for (let i = 1; i <= 5; i++) days[addDays(SEED_ANCHOR, i)] = 30;
    const withActivity = { ...seed, 'app/profile': { ...profile, days } };
    expect(fromSeed(withActivity, berlin(addDays(SEED_ANCHOR, 5), 21), schema).streak.count).toBe(17);
  });

  it('ab pflichtSince zählt Pflicht, ein Ruhetag der Woche überbrückt genau einen Tag', () => {
    const seed = loadSeed();
    const since = addDays(SEED_ANCHOR, 1); // Montag
    const schema = { version: 1, cutover: SEED_ANCHOR, migratedAt: 0, pflichtSince: since };
    const profile = seed['app/profile'] as Doc;
    const pflicht = { [since]: 1, [addDays(since, 1)]: 1 };
    const s = { ...seed, 'app/profile': { ...profile, pflicht } };
    expect(fromSeed(s, berlin(addDays(since, 1), 21), schema).streak.count).toBe(14);
    expect(fromSeed(s, berlin(addDays(since, 3), 9), schema).streak.count).toBe(14); // Ruhetag
    expect(fromSeed(s, berlin(addDays(since, 4), 9), schema).streak.count).toBe(0);
  });

  it('Voreinstellungen werden von Datenbank-Dokumenten überlagert', () => {
    const merged = mergedVocab(new Map([['reliable', { word: 'reliable', stage: 4 }]]));
    expect(merged.size).toBe(40);
    expect(merged.get('reliable')).toEqual({ word: 'reliable', stage: 4 });
  });

  it('der Lerntag endet um 04:00 Uhr', () => {
    expect(learningDayEnd(berlin(SEED_ANCHOR, 21))).toBe(berlin(addDays(SEED_ANCHOR, 1), 4));
    expect(learningDayEnd(berlin(addDays(SEED_ANCHOR, 1), 2))).toBe(berlin(addDays(SEED_ANCHOR, 1), 4));
  });

  it('liest die flache Einschätzung aus Anhang B genauso', () => {
    const seed = loadSeed();
    const flat = { ...(seed['app/assess'] as { data: Doc }).data };
    const ov = buildOverview({ nowMs: berlin(SEED_ANCHOR, 21), profile: null, course: null, assess: flat, schema: null, vocab: new Map(), grammar: new Map() });
    expect(ov.assess).toMatchObject({ cefr: 'B2', lang: 'de' });
    expect(ov.vocab.total).toBe(40);
    expect(ov.streak.count).toBe(0);
  });
});
