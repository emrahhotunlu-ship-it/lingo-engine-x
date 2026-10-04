import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bank } from '../../src/bank/words';
import { cefrFromGrammar, cefrFromVocab, overallCefr } from '../../src/coach/placement';
import { forecastDays, grammarSolid, isCore, pct, stubborn, streakOf } from '../../src/coach/derived';
import { dueIds, isSolid } from '../../src/coach/session';
import { checkDue, curvePoints } from '../../src/coach/curve';
import { clearInLogDay, resetCoach, saveDay, saveInLog, startCoach, startInput, useCoach } from '../../src/coach/store';
import { applySampleInput, applySampleProgress, applyTestProfile, makeDueNow, resetToday } from '../../src/coach/testActions';
import {
  INPUT_OFFSETS,
  SAMPLE_CARDS,
  SAMPLE_DAYS,
  SAMPLE_DUE,
  TEST_BANDS,
  TEST_GRAMMAR,
  TEST_INPUT_PREFIX,
  dueUp,
  inLogByMonth,
  inLogKey,
  mergeSampleInput,
  resetDayRec,
  sampleBriefs,
  sampleCards,
  sampleChecks,
  sampleDays,
  sampleGrammar,
  sampleInLog,
  sampleInput,
  testPlacement,
  testProfilePatch,
} from '../../src/coach/testData';
import { GRAMMAR_TOPICS } from '../../src/coach/grammar';
import { addDays, dayKeyNoon, isoWeek } from '../../src/domain/date';
import { testToolsDe } from '../../src/i18n/parts/testtools.de';
import { testToolsEn } from '../../src/i18n/parts/testtools.en';
import { createMemoryDb } from '../../src/platform/dev/memoryDb';
import type { CardRec, InputItem } from '../../src/coach/types';
import { isTestBuild } from '../../src/app/testBuild';

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-05T10:00:00+02:00');
const TODAY = '2026-10-05';

describe('Testwerkzeuge: Schalter', () => {
  it('ohne Build-Schalter gilt die Fassung als normaler Build', () => {
    expect(typeof __LX_TEST__).toBe('undefined');
    expect(isTestBuild()).toBe(false);
  });
});

describe('Testwerkzeuge: Test-Profil', () => {
  it('Wortschatz, Niveau und schwache Themen passen zusammen (B2)', () => {
    const p = testPlacement(TODAY);
    expect(p.size).toBe(4200);
    expect(Math.round(TEST_BANDS.reduce((s, h) => s + h * 1000, 0))).toBe(4200);
    const xlex = Math.round((TEST_BANDS.slice(0, 5).reduce((s, h) => s + h * 1000, 0) / 50)) * 50;
    expect(cefrFromVocab(xlex)).toBe('B2');
    expect(cefrFromGrammar(p.grammar)).toBe('B2');
    expect(overallCefr(cefrFromVocab(xlex), cefrFromGrammar(p.grammar))).toBe(p.level);
    expect(p.level).toBe('B2');
    // Jedes Grammatikthema hat einen Wert, mehrere sind schwach.
    for (const t of GRAMMAR_TOPICS) expect(p.grammar[t.id], t.id).toBeTypeOf('number');
    expect(Object.keys(p.grammar).length).toBe(GRAMMAR_TOPICS.length);
    expect(Object.values(TEST_GRAMMAR).filter((v) => v < 0.6).length).toBeGreaterThanOrEqual(5);
    expect(grammarSolid({ v: 1, created: 0, newPerDay: 10, placement: p }).weakest.length).toBe(4);
  });

  it('Fahrplan beginnt vor 25 Tagen; „imported" nur, wenn es fehlt', () => {
    const fresh = testProfilePatch(TODAY, NOW, false);
    expect(fresh.planStart).toBe(addDays(TODAY, -25));
    expect(fresh.imported).toMatchObject({ cards: 0, days: [] });
    expect(fresh.placement?.at).toBe(dayKeyNoon(addDays(TODAY, -25)));
    expect(testProfilePatch(TODAY, NOW, true).imported).toBeUndefined();
  });
});

describe('Testwerkzeuge: Beispiel-Fortschritt', () => {
  const days = sampleDays(TODAY);

  it('Tageswerte der letzten 28 Tage mit vier Ruhetagen, nie heute', () => {
    expect(Object.keys(days).length).toBe(SAMPLE_DAYS - 4);
    expect(days[TODAY]).toBeUndefined();
    expect(days[addDays(TODAY, -1)]).toBeDefined();
    for (const [d, r] of Object.entries(days)) {
      expect(d < TODAY && d >= addDays(TODAY, -SAMPLE_DAYS), d).toBe(true);
      expect(r.ok, d).toBeLessThanOrEqual(r.ans);
      expect(r.core, d).toBe(1);
      expect([r.w, r.g]).toEqual([1, 1]);
    }
    expect(sampleDays(TODAY)).toEqual(days);
  });

  it('Input-Tage stimmen mit dem Protokoll überein', () => {
    const withInput = Object.entries(days).filter(([, r]) => r.i === 1).map(([d]) => d);
    expect(withInput.sort()).toEqual(INPUT_OFFSETS.map((o) => addDays(TODAY, -o)).sort());
  });

  it('Serie läuft über die Ruhetage, die Trefferquote steigt, die Prognose steht', () => {
    expect(streakOf(days, [], TODAY).count).toBeGreaterThanOrEqual(24);
    const keys = Object.keys(days).sort();
    const avg = (ks: string[]) => pct(ks.reduce((s, k) => s + days[k]!.ok, 0), ks.reduce((s, k) => s + days[k]!.ans, 0));
    expect(avg(keys.slice(-7))).toBeGreaterThan(avg(keys.slice(0, 7)));
    const cards = new Map(sampleCards(NOW));
    const profile = { v: 1 as const, created: 0, newPerDay: 10, planStart: addDays(TODAY, -25), placement: testPlacement(TODAY) };
    const fc = forecastDays(profile, cards, days, TODAY);
    expect(fc).not.toBeNull();
    expect(fc!).toBeGreaterThan(60);
    expect(fc!).toBeLessThan(500);
  });

  describe('Karten', () => {
    const entries = sampleCards(NOW);
    const cards = new Map(entries);

    it('150 verschiedene Bankkarten in allen fünf Stufen, 30 jetzt fällig', () => {
      expect(entries.length).toBe(SAMPLE_CARDS);
      expect(cards.size).toBe(SAMPLE_CARDS);
      for (const [id] of entries) expect(bank().byId.has(id), id).toBe(true);
      const byLv = [0, 1, 2, 3, 4].map((lv) => entries.filter(([, c]) => c.lv === lv).length);
      expect(byLv).toEqual([30, 35, 35, 30, 20]);
      expect(dueIds(cards, NOW).length).toBe(SAMPLE_DUE);
      expect([...cards.values()].every((c) => c.f.state !== 0 && c.f.stability > 0 && c.f.due !== c.f.last)).toBe(true);
    });

    it('Termine sind über die nächsten Wochen verteilt, es gibt gefestigte und hartnäckige Wörter', () => {
      const ahead = [...cards.values()].filter((c) => c.f.due > NOW).map((c) => (c.f.due - NOW) / DAY);
      expect(Math.max(...ahead)).toBeGreaterThan(30);
      expect(new Set(ahead.map((d) => Math.floor(d / 5))).size).toBeGreaterThan(5);
      expect([...cards.values()].filter(isSolid).length).toBeGreaterThan(30);
      expect(stubborn(cards, 10).length).toBe(6);
    });

    it('deterministisch; zweimal Drücken ergibt dieselben Karten', () => {
      expect(sampleCards(NOW)).toEqual(entries);
      const again = sampleCards(NOW, cards);
      expect(again.map(([id]) => id)).toEqual(entries.map(([id]) => id));
    });

    it('ältere echte Karten werden nie überschrieben', () => {
      const [firstId] = entries[0]!;
      const real: CardRec = { ...entries[0]![1], add: NOW - 60 * DAY };
      const next = sampleCards(NOW, new Map([[firstId, real]]));
      expect(next.length).toBe(SAMPLE_CARDS);
      expect(next.map(([id]) => id)).not.toContain(firstId);
    });
  });

  it('Grammatik: Werte der Einstufung, teils fällig', () => {
    const g = sampleGrammar(NOW);
    expect(Object.keys(g).length).toBeGreaterThanOrEqual(10);
    for (const [id, st] of Object.entries(g)) {
      expect(st.p, id).toBe(TEST_GRAMMAR[id]);
      expect(st.c).toBeLessThanOrEqual(st.n);
      expect(st.last).toBeLessThan(NOW);
    }
    const due = Object.values(g).filter((s) => s.due <= NOW).length;
    expect(due).toBeGreaterThan(0);
    expect(due).toBeLessThan(Object.keys(g).length);
  });

  it('Input-Protokoll: 14 Tage, eigene Zeit, Schlüssel wie im Input-Reiter, nach Monaten getrennt', () => {
    const log = sampleInLog(TODAY);
    expect(Object.keys(log.it).length).toBe(INPUT_OFFSETS.length);
    expect(Object.keys(log.own).length).toBe(3);
    for (const [k, e] of Object.entries(log.it)) {
      expect(k).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(k.startsWith(e.d)).toBe(true);
      expect(e.t.startsWith('Beispiel:')).toBe(true);
      expect(e.m).toBeGreaterThan(0);
    }
    expect(inLogKey('2026-10-04', 'test-1')).toBe('2026-10-04-test-1');
    const months = inLogByMonth(log);
    expect(Object.keys(months).sort()).toEqual(['2026-09', '2026-10']);
    expect(Object.keys(months['2026-09']!.it).length + Object.keys(months['2026-10']!.it).length).toBe(INPUT_OFFSETS.length);
    for (const [m, part] of Object.entries(months)) for (const e of Object.values(part.it)) expect(e.d.slice(0, 7)).toBe(m);
  });

  it('ein Monats-Check und ein Brief der Vorwoche', () => {
    const checks = sampleChecks(TODAY);
    expect(Object.keys(checks)).toEqual(['2026-09']);
    expect(checks['2026-09']!.size).toBeGreaterThan(4200);
    const pts = curvePoints(testPlacement(TODAY), checks);
    expect(pts.map((p) => p.label)).toEqual(['start', '2026-09']);
    // Nicht fällig (erst 12 Tage her), damit der Fahrplan beides zeigen kann.
    expect(checkDue(testPlacement(TODAY), checks, NOW, '2026-10')).toBe(false);
    const briefs = sampleBriefs(TODAY);
    expect(Object.keys(briefs)).toEqual([isoWeek(addDays(TODAY, -7))]);
    expect(Object.keys(briefs)).not.toContain(isoWeek(TODAY));
    expect(Object.values(briefs)[0]!.text.length).toBeGreaterThan(50);
  });
});

describe('Testwerkzeuge: Beispiel-Input', () => {
  it('ein Video und ein Artikel, je fünf Schlüsselwörter, nur stabile Adressen, klar als Beispiel', () => {
    const items = sampleInput();
    expect(items.map((i) => i.kind).sort()).toEqual(['article', 'video']);
    for (const it of items) {
      expect(it.id.startsWith(TEST_INPUT_PREFIX)).toBe(true);
      expect(it.title.startsWith('Beispiel:')).toBe(true);
      expect(it.words).toHaveLength(5);
      expect(it.tip_de && it.tip_en && it.why_de && it.why_en).toBeTruthy();
      expect(['https://www.bbc.com/news/technology', 'https://www.youtube.com/@TED']).toContain(it.url);
    }
  });

  it('eigene Beiträge bleiben, Beispiele werden ersetzt statt verdoppelt', () => {
    const own: InputItem = { id: 'real-1', kind: 'article', title: 'Echt', source: 'x', url: 'https://example.org/', mins: 5 };
    const once = mergeSampleInput([own]);
    expect(once.map((i) => i.id)).toEqual(['real-1', 'test-video', 'test-article']);
    expect(mergeSampleInput(once)).toEqual(once);
  });
});

describe('Testwerkzeuge: Zurücksetzen und fällig machen', () => {
  it('Tagesteile, Kern und Zähler auf null, Blitzrunde und KI-Zählung bleiben', () => {
    const r = resetDayRec({ min: 20, ans: 30, ok: 25, nw: 10, kn: 2, core: 1, w: 1, g: 1, i: 1, ai: 3, bz: 7 });
    expect(r).toEqual({ min: 0, ans: 0, ok: 0, nw: 0, kn: 0, core: 0, w: 0, g: 0, i: 0, ai: 3, bz: 7 });
    expect(isCore(r, true)).toBe(false);
    expect(isCore(r, false)).toBe(false);
    expect(resetDayRec(undefined)).toMatchObject({ core: 0, w: 0, g: 0, i: 0, ans: 0 });
  });

  it('macht die nächsten Karten fällig, neue Karten bleiben unberührt', () => {
    const cards = new Map(sampleCards(NOW));
    const before = dueIds(cards, NOW).length;
    const up = dueUp(cards, NOW, 25);
    expect(up.length).toBe(25);
    const merged = new Map([...cards, ...up]);
    expect(dueIds(merged, NOW).length).toBe(before + 25);
    const fresh: CardRec = { ...[...cards.values()][0]!, f: { ...[...cards.values()][0]!.f, state: 0, due: NOW + DAY } };
    expect(dueUp(new Map([['x', fresh]]), NOW, 25)).toEqual([]);
    expect(dueUp(new Map(), NOW, 25)).toEqual([]);
  });
});

describe('Testwerkzeuge: Texte', () => {
  it('beide Sprachen haben dieselben Schlüssel und Platzhalter, nichts ist leer', () => {
    expect(Object.keys(testToolsEn).sort()).toEqual(Object.keys(testToolsDe).sort());
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of Object.keys(testToolsDe) as Array<keyof typeof testToolsDe>) {
      expect(testToolsDe[k].trim(), k).not.toBe('');
      expect(testToolsEn[k].trim(), k).not.toBe('');
      expect(ph(testToolsEn[k]), k).toEqual(ph(testToolsDe[k]));
    }
  });
});

// Ganzer Weg über Schreibpfad und Lesen: Was die Werkzeuge schreiben, muss der Trainer wieder lesen können.
describe('Testwerkzeuge: Schreiben in die Datenbank und Wiederlesen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    resetCoach();
  });

  async function boot() {
    const h = createMemoryDb();
    resetCoach();
    const stopCoach = startCoach(h.db);
    const stopInput = startInput(h.db, addDays(TODAY, -6));
    await vi.waitFor(() => expect(useCoach.getState().status).toBe('ready'));
    return { h, stop: () => (stopCoach(), stopInput()) };
  }

  it('Test-Profil auf leerer Datenbank: Profil mit Einstufung und Übernahme-Vermerk', async () => {
    const { h, stop } = await boot();
    await applyTestProfile();
    const doc = h.dump()['coach/profile'] as Record<string, unknown>;
    expect(doc).toMatchObject({ v: 1, planStart: '2026-09-10', placement: { level: 'B2', size: 4200 }, imported: { cards: 0 } });
    await vi.waitFor(() => expect(useCoach.getState().profile?.placement?.level).toBe('B2'));
    // Zweites Mal: keine Änderung, nichts Neues geschrieben.
    const writes = h.writes().length;
    await applyTestProfile();
    expect(h.writes().length).toBe(writes);
    stop();
  });

  it('Beispiel-Fortschritt wird vollständig und gültig gelesen', async () => {
    const { h, stop } = await boot();
    const r = await applySampleProgress();
    expect(r).toEqual({ cards: SAMPLE_CARDS, days: SAMPLE_DAYS - 4 });
    await vi.waitFor(() => expect(useCoach.getState().cards.size).toBe(SAMPLE_CARDS));
    const s = useCoach.getState();
    expect(s.invalid).toEqual([]);
    expect(s.profile?.placement?.level).toBe('B2');
    expect(Object.keys(s.days).length).toBe(SAMPLE_DAYS - 4);
    expect(Object.keys(s.grammar?.t ?? {}).length).toBe(12);
    expect(Object.keys(s.inlog.it).length).toBe(INPUT_OFFSETS.length);
    expect(Object.keys(s.inlog.own).length).toBe(3);
    expect(Object.keys(s.checks)).toEqual(['2026-09']);
    expect(Object.keys(s.briefs)).toEqual([isoWeek(addDays(TODAY, -7))]);
    expect(dueIds(s.cards, NOW).length).toBe(SAMPLE_DUE);
    // Jedes Dokument bleibt weit unter 256 KiB, und es sind wenige.
    const dump = h.dump();
    for (const [p, d] of Object.entries(dump)) expect(JSON.stringify(d).length, p).toBeLessThan(256 * 1024);
    expect(Object.keys(dump).length).toBeLessThan(60);
    // Zweimal Drücken: dieselben Karten, nichts Doppeltes.
    await applySampleProgress();
    await vi.waitFor(() => expect(useCoach.getState().cards.size).toBe(SAMPLE_CARDS));
    stop();
  });

  it('Beispiel-Input steht in input/<heute> und wird beim zweiten Mal nicht verdoppelt', async () => {
    const { h, stop } = await boot();
    await applySampleInput();
    await applySampleInput();
    const doc = h.dump()[`input/${TODAY}`] as { d: string; items: Array<{ id: string }> };
    expect(doc.d).toBe(TODAY);
    expect(doc.items.map((i) => i.id)).toEqual(['test-video', 'test-article']);
    await vi.waitFor(() => expect(useCoach.getState().input[0]?.items.length).toBe(2));
    stop();
  });

  it('Heute zurücksetzen: Teile und Zähler null, bewerteter Input zurückgenommen, KI-Zählung bleibt', async () => {
    const { h, stop } = await boot();
    await saveDay(TODAY, { min: 20, ans: 30, ok: 25, nw: 10, kn: 2, core: 1, w: 1, g: 1, i: 1, ai: 2, bz: 5 });
    await saveInLog(TODAY, { it: { [`${TODAY}-x`]: { d: TODAY, m: 9, t: 'Eins', r: 'ok', l: 'right' }, '2026-10-04-y': { d: '2026-10-04', m: 7, t: 'Gestern' } }, own: { [TODAY]: 20 } });
    await vi.waitFor(() => expect(Object.keys(useCoach.getState().inlog.it).length).toBe(2));
    await resetToday();
    await vi.waitFor(() => expect(useCoach.getState().days[TODAY]?.core).toBe(0));
    const s = useCoach.getState();
    expect(s.days[TODAY]).toMatchObject({ min: 0, ans: 0, ok: 0, nw: 0, core: 0, w: 0, g: 0, i: 0, ai: 2, bz: 5 });
    expect(Object.keys(s.inlog.it)).toEqual(['2026-10-04-y']);
    expect(s.inlog.own[TODAY]).toBeUndefined();
    expect(isCore(s.days[TODAY]!, false)).toBe(false);
    // Gelöscht wird nie: Die Einträge stehen als null in der Datenbank.
    const doc = h.dump()['coach/inlog-2026-10'] as { it: Record<string, unknown> };
    expect(doc.it[`${TODAY}-x`]).toBeNull();
    // Nichts zu tun: kein weiterer Schreibvorgang.
    const writes = h.writes().length;
    await clearInLogDay(TODAY);
    expect(h.writes().length).toBe(writes);
    stop();
  });

  it('25 Karten fällig machen: ohne Karten null, mit Karten 25 mehr', async () => {
    const { stop } = await boot();
    expect(await makeDueNow(25)).toBe(0);
    await applySampleProgress();
    await vi.waitFor(() => expect(useCoach.getState().cards.size).toBe(SAMPLE_CARDS));
    expect(await makeDueNow(25)).toBe(25);
    await vi.waitFor(() => expect(dueIds(useCoach.getState().cards, NOW).length).toBe(SAMPLE_DUE + 25));
    stop();
  });
});
