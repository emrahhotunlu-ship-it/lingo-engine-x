import { describe, expect, it } from 'vitest';
import { appendCheck, CHECKS_MAX, checkDoneThisWeek, checkPct, checkRecord, compareLast, readChecks, readFeed, toStored, type ResultItem } from '../../src/domain/check/record';
import { checkExercise, selectCheck } from '../../src/domain/check/select';
import { addDays, dayKey, learningDayEnd } from '../../src/domain/date';
import { levelBar, mainConfidence } from '../../src/domain/assessment/levelBar';
import type { AssessDim } from '../../src/domain/assessment/types';
import { computeStreak, weekStrip, type StreakInput } from '../../src/domain/streak';
import { buildOverview } from '../../src/domain/overview';
import { buildTrainCards } from '../../src/domain/srs/cards';
import { deriveToday } from '../../src/domain/plan/buildPlan';
import { profilePatch, roundBonus, type RoundEnd } from '../../src/domain/progress/profilePatch';
import { keepVisibleDelta, keyboardCovers } from '../../src/ui/chat/keyboard';
import { runningTabs, type AiTask } from '../../src/app/shell/aiTasks';
import { normCtx } from '../../src/app/actions';
import { WORK_MAX, workContext } from '../../src/prompts/work';
import { buildEvidence } from '../../src/domain/assessment/evidence';
import { berlin, loadSeed, SEED_ANCHOR, type Doc } from './helpers';

// Lücken aus dem Abgleich (M7, M10, M13, M22, H5): reine Logik mit festen und Seed-Daten.

const seed = loadSeed();
const profile = seed['app/profile'] as Doc;
const collection = (name: string): Map<string, Doc> => {
  const out = new Map<string, Doc>();
  for (const [p, d] of Object.entries(seed)) if (p.startsWith(`${name}/`) && p.split('/').length === 2) out.set(p.slice(name.length + 1), d);
  return out;
};
const nowMs = berlin(SEED_ANCHOR, 21);

describe('Wochen-Check: alte Einträge lesen (profile.checks[])', () => {
  it('liest die Checks der alten App aus dem Seed (älteste zuerst, Paare als [ok, n])', () => {
    const cs = readChecks(profile);
    expect(cs).toHaveLength(2);
    expect(cs[0]).toMatchObject({ d: '2026-09-05', n: 12, ok: 8, vocab: { ok: 4, n: 5 }, colloc: { ok: 1, n: 2 }, gram: { ok: 3, n: 5 }, topics: ['passive', 'reported'] });
    expect(checkPct(cs[1]!)).toBe(75);
  });

  it('überspringt kaputte Einträge, statt zu raten', () => {
    const cs = readChecks({ checks: [null, { t: 1 }, { t: 2, n: 0, ok: 0 }, { t: 3, n: 4, ok: 9 }, { t: 4, n: 4, ok: 2, vocab: 'x' }, 'x'] });
    expect(cs).toHaveLength(1);
    expect(cs[0]).toMatchObject({ t: 4, vocab: { ok: 0, n: 0 }, d: '' });
    expect(readChecks({ checks: 'kaputt' })).toEqual([]);
    expect(readChecks(null)).toEqual([]);
  });

  it('höchstens einmal je Kalenderwoche (Mo–So): Seed-Checks liegen in früheren Wochen', () => {
    const cs = readChecks(profile);
    expect(checkDoneThisWeek(cs, SEED_ANCHOR, dayKey)).toBe(false);
    expect(checkDoneThisWeek(cs, '2026-09-12', dayKey)).toBe(true); // Samstag derselben Woche
    expect(checkDoneThisWeek(cs, '2026-09-13', dayKey)).toBe(true); // Sonntag
    expect(checkDoneThisWeek(cs, '2026-09-14', dayKey)).toBe(false); // Montag: neue Woche
    // Ohne `d` zählt der Lerntag des Zeitstempels (Wechsel um 04:00).
    expect(checkDoneThisWeek([{ ...cs[0]!, d: '', t: berlin('2026-09-21', 2) }], '2026-09-20', dayKey)).toBe(true);
  });
});

describe('Wochen-Check: Ergebnis im alten Format anhängen', () => {
  const results: ResultItem[] = [
    { kind: 'v', id: 'affect', colloc: false, ok: true },
    { kind: 'v', id: 'achieve', colloc: false, ok: false },
    { kind: 'v', id: 'afford', colloc: true, ok: true },
    { kind: 'g', topic: 'passive', ok: false },
    { kind: 'g', topic: 'passive', ok: false },
    { kind: 'g', topic: 'reported', ok: true },
  ];
  const rec = checkRecord(results, SEED_ANCHOR, nowMs);

  it('zählt je Bereich wie die alte App und nennt Themen und Wörter nur einmal', () => {
    expect(rec).toMatchObject({ d: SEED_ANCHOR, n: 6, ok: 3, vocab: { ok: 1, n: 2 }, colloc: { ok: 1, n: 1 }, gram: { ok: 1, n: 3 }, topics: ['passive'], words: ['achieve'] });
    expect(toStored(rec)).toEqual({ d: SEED_ANCHOR, t: nowMs, n: 6, ok: 3, vocab: [1, 2], colloc: [1, 1], gram: [1, 3], topics: ['passive'], words: ['achieve'] });
  });

  it('hängt an, ohne bestehende Einträge zu verändern (auch unbekannte Felder bleiben)', () => {
    const r = appendCheck(profile, rec, dayKey);
    if (!('patch' in r)) throw new Error('erwartet: patch');
    expect(r.patch.checks).toHaveLength(3);
    expect(r.patch.checks.slice(0, 2)).toEqual(profile.checks);
    expect((r.patch.checks[0] as Doc).lvl).toBe(61);
    expect(r.patch.checks[2]).toEqual(toStored(rec));
  });

  it('legt die Liste an, wenn sie fehlt; ein unerwarteter Aufbau wird nie angefasst', () => {
    const r = appendCheck({}, rec, dayKey);
    expect('patch' in r && r.patch.checks).toEqual([toStored(rec)]);
    expect(appendCheck({ checks: { a: 1 } }, rec, dayKey)).toEqual({ skip: 'invalid' });
  });

  it('kein zweiter Check in derselben Woche (zweiter Tab) und kein doppelter Eintrag', () => {
    const once = appendCheck(profile, rec, dayKey);
    if (!('patch' in once)) throw new Error('erwartet: patch');
    const fresh = { ...profile, checks: once.patch.checks };
    expect(appendCheck(fresh, rec, dayKey)).toEqual({ skip: 'duplicate' });
    expect(appendCheck(fresh, { ...rec, t: rec.t + 1 }, dayKey)).toEqual({ skip: 'week' });
  });

  it('höchstens 20: über der Grenze fällt nur der älteste heraus (Regel der alten App)', () => {
    const old = Array.from({ length: CHECKS_MAX }, (_, i) => ({ d: addDays('2026-01-05', i * 7), t: berlin(addDays('2026-01-05', i * 7), 12), n: 12, ok: i % 12, vocab: [1, 5], colloc: [0, 2], gram: [2, 5], topics: [], words: [] }));
    const r = appendCheck({ checks: old }, rec, dayKey);
    if (!('patch' in r)) throw new Error('erwartet: patch');
    expect(r.patch.checks).toHaveLength(CHECKS_MAX);
    expect(r.patch.checks[0]).toEqual(old[1]);
    expect(r.patch.checks.at(-1)).toEqual(toStored(rec));
  });

  it('Vergleich mit dem letzten Check', () => {
    const cs = readChecks(profile);
    expect(compareLast(cs)).toEqual({ pct: 75, prevPct: 67, prevT: cs[0]!.t, delta: 8 });
    expect(compareLast(cs.slice(0, 1))).toMatchObject({ pct: 67, prevPct: null, delta: null });
    expect(compareLast([])).toBeNull();
  });
});

describe('Letzte Fortschritte der alten App (profile.feed[])', () => {
  it('neueste zuerst, ohne XP und ohne Stufenpunkte', () => {
    const f = readFeed(profile, 40);
    expect(f).toHaveLength(8);
    expect(f[0]!.t).toBeGreaterThan(f[1]!.t);
    for (const e of f) {
      expect(Object.keys(e).sort()).toEqual(['act', 'grammar', 't', 'vocab']);
      expect(['lesson', 'cards', 'gram', 'listen']).toContain(e.act);
    }
    expect(readFeed({ feed: [{ t: 1, act: 'gram', d: { gr: 3.4, vp: 2 } }, { act: 'x' }, null] })).toEqual([{ t: 1, act: 'gram', vocab: 2, grammar: 3 }]);
  });
});

describe('Wochen-Check: Aufgaben aus vorhandenen Bausteinen', () => {
  const cards = buildTrainCards(collection('vocab'), nowMs);
  const grammarDocs = collection('grammar');
  const items = selectCheck({ cards, grammarDocs, sources: [], nowMs, dayEndMs: learningDayEnd(nowMs), lang: 'de', seed: 'test' });

  it('12 gemischte Aufgaben: 5 Wörter, 2 Wendungen, 5 Grammatik, verschachtelt', () => {
    expect(items).toHaveLength(12);
    expect(items.filter((i) => i.kind === 'v' && i.ex !== 'colloc')).toHaveLength(5);
    expect(items.filter((i) => i.kind === 'v' && i.ex === 'colloc')).toHaveLength(2);
    expect(items.filter((i) => i.kind === 'g')).toHaveLength(5);
    expect(items.map((i) => i.kind).join('')).toBe('vvggvvggvvgv');
  });

  it('ohne eingebaute Hilfe, jede Karte und jede Aufgabe nur einmal, nur geübte Karten', () => {
    const words = items.filter((i): i is Extract<typeof i, { kind: 'v' }> => i.kind === 'v');
    expect(words.some((w) => w.ex === 'cloze_hint')).toBe(false);
    expect(new Set(words.map((w) => w.key)).size).toBe(words.length);
    for (const w of words) expect(cards.find((c) => c.key === w.key)?.isNew).toBe(false);
    const tasks = items.filter((i): i is Extract<typeof i, { kind: 'g' }> => i.kind === 'g');
    expect(new Set(tasks.map((g) => g.task.topic)).size).toBe(5);
    expect(tasks.every((g) => g.task.errorT === null)).toBe(true);
  });

  it('nie heute fällige Karten (Pflicht „Wiederholen" bleibt unberührt)', () => {
    const end = learningDayEnd(nowMs);
    const words = items.filter((i) => i.kind === 'v');
    const picked = words.map((w) => cards.find((c) => c.key === (w as { key: string }).key)!);
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.every((c) => c.fsrs.due >= end)).toBe(true);
  });

  it('gleicher Startwert = gleiche Auswahl; ohne Karten und Themen bleibt die Runde klein', () => {
    const again = selectCheck({ cards, grammarDocs, sources: [], nowMs, dayEndMs: learningDayEnd(nowMs), lang: 'de', seed: 'test' });
    expect(again).toEqual(items);
    const none = selectCheck({ cards: [], grammarDocs: new Map(), sources: [], nowMs, dayEndMs: learningDayEnd(nowMs), lang: 'de', seed: 'x' });
    expect(none.every((i) => i.kind === 'g')).toBe(true);
  });

  it('Übungsart: ab Stufe 3 aktiv (Lücke bzw. getippt), sonst Bedeutung wählen', () => {
    const high = cards.find((c) => c.stage >= 3 && c.context);
    const low = cards.find((c) => c.stage > 0 && c.stage < 3);
    if (high) expect(checkExercise(high, 'de', cards.length)).toBe('cloze');
    if (low) expect(['mc_de', 'mc_en', 'type']).toContain(checkExercise(low, 'de', cards.length));
  });
});

describe('Wochen-Check zählt nie als Pflicht', () => {
  it('Rundenende `check` erfüllt keinen Pflichtkanal und keine Wiederholung', () => {
    const plan = { d: SEED_ANCHOR, ids: ['gram'], why: [], v: 1 as const, duty: ['review' as const, 'ch:gram' as const], goal: { review: 2 }, lesson: null, at: 1 };
    const entries = [
      { t: 1, id: 'affect', k: 'v', ok: true, ctx: 'xtra' },
      { t: 2, id: 'achieve', k: 'v', ok: true, ctx: 'xtra' },
    ];
    const st = deriveToday({ day: SEED_ANCHOR, plan, entries, minutes: 5, act: { [SEED_ANCHOR]: { check: 1 } }, pending: { lessonDays: [], rounds: [{ day: SEED_ANCHOR, act: 'check', partial: false }] } });
    expect(st.status).toBe('open');
    expect(st.duties.done).toBe(0);
    expect(st.extra).toBe(2);
  });

  it('schreibt act.check (nie act.gram) und Minuten wie jede Übung', () => {
    const r: RoundEnd = { day: SEED_ANCHOR, act: 'check', partial: false, n: 12, right: 9, activeMs: 6 * 60_000 };
    expect(roundBonus(r)).toBe(20);
    const p = profilePatch(profile, [], [r], { deviceId: 'tab', seq: nowMs }) as Doc & { act: Record<string, Doc> };
    expect(p.act[SEED_ANCHOR]?.check).toBe(1);
    expect(p.act[SEED_ANCHOR]?.gram).toBeUndefined();
  });
});

describe('Wochenstreifen (M7): dieselbe Regel wie die Serie', () => {
  const since = '2026-09-14';
  const base: StreakInput = { days: {}, xpDays: {}, pflichtSince: since, pflichtDone: new Set(['2026-09-14', '2026-09-15', '2026-09-17']), today: '2026-09-19' };

  it('Mo–So mit erledigt, Ruhetag, offen und Zukunft', () => {
    const w = weekStrip(base);
    expect(w.map((d) => d.day)).toEqual(['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20']);
    expect(w.map((d) => d.state)).toEqual(['done', 'done', 'open', 'done', 'rest', 'open', 'future']);
    expect(w.filter((d) => d.today).map((d) => d.day)).toEqual(['2026-09-19']);
  });

  it('der Ruhetag ist genau der, den die Serie überbrückt', () => {
    const w = weekStrip(base);
    const s = computeStreak(base);
    expect(w.filter((d) => d.state === 'rest').map((d) => d.day)).toEqual(s.restDays.filter((d) => d >= since));
  });

  it('vor pflichtSince gilt die alte Regel (Antworten oder XP), ohne Ruhetag', () => {
    const w = weekStrip({ days: { '2026-09-14': 5, '2026-09-16': 3 }, xpDays: { '2026-09-15': 40 }, today: '2026-09-17' });
    expect(w.map((d) => d.state)).toEqual(['done', 'done', 'done', 'open', 'future', 'future', 'future']);
  });

  it('Seed: Wochenstreifen in der Übersicht, Sonntag heute', () => {
    const ov = buildOverview({ nowMs, profile, course: seed['app/course'], assess: seed['app/assess'], schema: null, vocab: collection('vocab'), grammar: collection('grammar') });
    expect(ov.week).toHaveLength(7);
    expect(ov.week[6]).toMatchObject({ day: SEED_ANCHOR, today: true });
    expect(ov.week.every((d) => d.state !== 'future')).toBe(true);
  });
});

describe('Niveau-Leiste (M7)', () => {
  const dims = (c: AssessDim['confidence'][]): AssessDim[] => c.map((confidence, i) => ({ id: (['grammar', 'vocabulary', 'reading', 'listening', 'writing', 'speaking'] as const)[i]!, level: 'B2', confidence, why: null }));

  it('Punkt auf der Stufe, Band nach Belastbarkeit', () => {
    expect(levelBar({ cefr: 'B2', dims: dims(['good', 'good', 'fair']) })).toEqual({ pos: 2, lo: 2, hi: 2, confidence: 'good', below: false });
    expect(levelBar({ cefr: 'B2', dims: dims(['fair', 'fair', 'thin']) })).toMatchObject({ lo: 1.5, hi: 2.5 });
    expect(levelBar({ cefr: 'B2+', dims: dims(['thin', 'thin']) })).toMatchObject({ pos: 3, lo: 2, hi: 4 });
  });

  it('Ränder, A2 unterhalb der Skala, ohne Stufe keine Leiste', () => {
    expect(levelBar({ cefr: 'C1+', dims: [] })).toMatchObject({ pos: 5, lo: 4, hi: 5, confidence: 'thin' });
    expect(levelBar({ cefr: 'A2', dims: [] })).toMatchObject({ pos: 0, below: true });
    expect(levelBar({ cefr: null, dims: [] })).toBeNull();
  });

  it('Gleichstand: die vorsichtigere Belastbarkeit', () => {
    expect(mainConfidence({ dims: dims(['good', 'thin']) })).toBe('thin');
    expect(mainConfidence({ dims: dims(['good', 'fair', 'good']) })).toBe('good');
  });
});

describe('Lücke über der iPhone-Tastatur (Kap. 4.1, H5)', () => {
  const view = { top: 0, height: 400 };
  it('passt alles, wird nicht gerollt', () => {
    expect(keepVisibleDelta([{ top: 100, bottom: 140 }, { top: 200, bottom: 244 }], view)).toBe(0);
  });
  it('Prüfen-Knopf unter der Tastatur: so weit rollen, dass er sichtbar ist', () => {
    expect(keepVisibleDelta([{ top: 300, bottom: 340 }, { top: 420, bottom: 464 }], view)).toBe(464 - 388);
  });
  it('Lücke oberhalb des sichtbaren Bereichs: zurückrollen', () => {
    expect(keepVisibleDelta([{ top: -50, bottom: -10 }], { top: 0, height: 400 })).toBe(-62);
  });
  it('passt nicht beides hinein, bleibt die Lücke oben sichtbar', () => {
    expect(keepVisibleDelta([{ top: 100, bottom: 140 }, { top: 700, bottom: 744 }], view)).toBe(88);
  });
  it('sichtbarer Bereich mit Versatz (Safari rollt den Ausschnitt)', () => {
    expect(keepVisibleDelta([{ top: 500, bottom: 540 }], { top: 200, height: 300 })).toBe(540 - 488);
  });
  it('Tastatur gilt erst ab 80 px verdeckter Höhe als offen', () => {
    expect(keyboardCovers(844, 800)).toBe(false);
    expect(keyboardCovers(844, 500)).toBe(true);
  });
});

describe('Ladepunkt am Reiter (M13)', () => {
  const task = (over: Partial<AiTask>): AiTask => ({ key: 'k', kind: 'write', route: { name: 'write', ctx: 'extra' }, phase: 'thinking', status: 'running', error: null, seen: false, startedAt: 1, ...over });
  it('nur laufende Korrekturen, am passenden Reiter', () => {
    expect([...runningTabs({})]).toEqual([]);
    // Seit 04.10.2026 gibt es keinen Reiter „Lesen“ mehr: freiwillige Einheiten zeigen keinen Ladepunkt am Reiter.
    expect([...runningTabs({ a: task({}) })]).toEqual([]);
    expect([...runningTabs({ a: task({ route: { name: 'write', ctx: 'duty' } }) })]).toEqual(['today']);
    expect([...runningTabs({ a: task({ kind: 'discover', route: { name: 'discoverItem', feedId: 'f', itemId: 'i', ctx: 'extra' } }) })]).toEqual([]);
    // Pflicht und Extra gemischt: nur „Heute“.
    expect([...runningTabs({ a: task({}), b: task({ key: 'b', route: { name: 'write', ctx: 'duty' } }) })]).toEqual(['today']);
    expect([...runningTabs({ a: task({ status: 'done' }), b: task({ key: 'b', status: 'error' }) })]).toEqual([]);
  });
});

describe('Beruflicher Kontext (M22)', () => {
  it('Leerraum zusammengefasst, höchstens 400 Zeichen; work.ts liest ihn', () => {
    expect(normCtx('  Projektleiter\n  Cloud   ')).toBe('Projektleiter Cloud');
    expect(normCtx('x'.repeat(500))).toHaveLength(WORK_MAX);
    expect(workContext(normCtx(' Einkauf  bei einem Autozulieferer '))).toBe('Einkauf bei einem Autozulieferer');
    expect(workContext('')).not.toBe('');
  });
});

describe('Wochen-Check als Beleg der Einschätzung (M10)', () => {
  it('die letzten Checks stehen im Belegpaket', () => {
    const empty = new Map<string, Doc>();
    const pack = buildEvidence({ nowMs, today: SEED_ANCHOR, profile, grammar: empty, radar: null, writing: empty, vocab: empty, logs: empty, reading: empty, talk: empty, preply: empty, prev: null });
    const line = pack.sections.flatMap((s) => s.lines).find((l) => l.id === 'v:check');
    expect(line?.text).toContain('2026-09-12 9/12');
    expect(pack.ids).toContain('v:check');
  });
});
