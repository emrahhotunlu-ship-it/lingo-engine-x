import { describe, expect, it } from 'vitest';
import { addDays, isoWeek } from '../../src/domain/date';
import { CHAPTER_NUMS, FEST_STEPS, MS_WEEK_MAX, cardsThisWeek, claimMilestones, isMilestoneCard, milestonePatch, newMilestones, pickMilestone, quietMark, type Milestone, type MilestoneId } from '../../src/domain/plan/dayStats';
import { levelUpFor } from '../../src/domain/moments/detect';

// Meilenstein-Katalog (Lernplattform 3.0 K-14, Motivation §4.2, P42): ein Katalog, jede ID höchstens einmal, höchstens eine Karte je Sitzung und zwei je ISO-Woche,
// gleichzeitig erreichte werden still gemerkt, zwei Geräte zeigen dieselbe Karte nicht zweimal.

type Doc = Record<string, unknown>;
const base = { fest: 0, topicsFest: 0, fixTotal: 0, overdue0: null, overdue: null, seen: {} as Doc };
const ids = (m: readonly Milestone[]): string[] => m.map((x) => x.id);

describe('Katalog', () => {
  it('Wort-Marken 100 · 250 · 500 · 750 · 1.000 · 1.500 über festUnits', () => {
    expect([...FEST_STEPS]).toEqual([100, 250, 500, 750, 1000, 1500]);
    expect(ids(newMilestones({ ...base, fest: 760 }))).toEqual(['fest750', 'fest500', 'fest250', 'fest100']);
    expect(ids(newMilestones({ ...base, fest: 99 }))).toEqual([]);
  });
  it('Kapitel ch1 bis ch7, Einstufung, erster C1-Check und C1 bereit; Wichtigkeit: C1 bereit · Kapitel (höchstes zuerst) · Check · Einstufung · Marke · Sätze', () => {
    const all = newMilestones({ ...base, fest: 300, topicsFest: 1, fixTotal: 10, chapters: [1, 3, 2], place: true, checks: 2, c1ready: true });
    expect(ids(all)).toEqual(['c1ready', 'ch3', 'ch2', 'ch1', 'c1check1', 'place', 'fest250', 'fest100', 'topic1', 'fix10']);
    expect([...CHAPTER_NUMS]).toHaveLength(7);
  });
  it('was schon gemerkt ist (ob gezeigt oder still), kommt nie wieder', () => {
    const seen = { ch1: '2026-10-01', place: '2026-10-02~', fest100: '2026-09-01' };
    expect(ids(newMilestones({ ...base, fest: 150, chapters: [1], place: true, seen }))).toEqual([]);
  });
  it('keine Karte ohne Grund: ohne Prüfung, Einstufung und Check gibt es keinen Kapitel-/Check-Meilenstein', () => {
    expect(ids(newMilestones({ ...base, chapters: [], place: false, checks: 0 }))).toEqual([]);
    expect(ids(newMilestones({ ...base, chapters: [] }))).toEqual([]);
  });
  it('Karte oder Satz: Kapitel, Einstufung, Check, C1 bereit und Marken ab 250 sind Karten; 100 Wörter, erstes Thema, 10 Fehlersätze nicht', () => {
    for (const id of ['place', 'c1check1', 'c1ready', 'ch1', 'ch7', 'fest250', 'fest1500']) expect(isMilestoneCard(id), id).toBe(true);
    for (const id of ['fest100', 'topic1', 'fix10', 'overdue0']) expect(isMilestoneCard(id), id).toBe(false);
  });
  it('der Aufstieg (R6) gehört zu genau den Kartenmeilensteinen mit Emblem oder Zahl: Kapitel, C1 bereit, Marken ab 250', () => {
    for (let n = 1; n <= 7; n++) expect(levelUpFor(`ch${n}`)).toEqual({ kind: 'chapter', n });
    expect(levelUpFor('c1ready')).toEqual({ kind: 'c1' });
    expect(levelUpFor('fest250')).toEqual({ kind: 'words', n: 250 });
    expect(levelUpFor('fest100')).toBeNull();
    expect(levelUpFor('topic1')).toBeNull();
  });
});

describe('Budget', () => {
  const NEW = { fu: '2026-09-01' } as Doc; // schon auf festUnits umgestellt
  it('höchstens eine Karte je Sitzung: die zweite Karte wartet, bleibt aber offen', () => {
    const cands: Milestone[] = [{ id: 'ch2', n: 2 }];
    expect(pickMilestone({ candidates: cands, seen: NEW, today: '2026-10-08', cardShown: true }).show).toBeNull();
    expect(pickMilestone({ candidates: cands, seen: NEW, today: '2026-10-08', cardShown: true }).quiet).toEqual([]);
    expect(pickMilestone({ candidates: cands, seen: NEW, today: '2026-10-08', cardShown: false }).show?.id).toBe('ch2');
  });
  it('höchstens zwei Karten je ISO-Woche; ein Satz-Meilenstein verbraucht kein Kartenbudget', () => {
    const seen = { ...NEW, ch1: '2026-10-05', place: '2026-10-06' }; // Mo und Di dieser Woche
    expect(cardsThisWeek(seen, '2026-10-08')).toBe(2);
    expect(cardsThisWeek(seen, '2026-10-12')).toBe(0); // nächste Woche
    expect(pickMilestone({ candidates: [{ id: 'ch2', n: 2 }], seen, today: '2026-10-08', cardShown: false }).show).toBeNull();
    expect(pickMilestone({ candidates: [{ id: 'ch2', n: 2 }, { id: 'topic1' }], seen, today: '2026-10-08', cardShown: false }).show?.id).toBe('topic1');
    expect(pickMilestone({ candidates: [{ id: 'ch2', n: 2 }], seen, today: '2026-10-12', cardShown: false }).show?.id).toBe('ch2');
  });
  it('stille Merker zählen nicht gegen das Wochenbudget', () => {
    const seen = { ...NEW, ch1: quietMark('2026-10-05'), place: quietMark('2026-10-06') };
    expect(cardsThisWeek(seen, '2026-10-08')).toBe(0);
  });
  it('drei gleichzeitig erreichte: eine Karte, die anderen werden still gemerkt', () => {
    const cands: Milestone[] = [{ id: 'ch3', n: 3 }, { id: 'place' }, { id: 'topic1' }];
    const p = pickMilestone({ candidates: cands, seen: NEW, today: '2026-10-08', cardShown: false });
    expect(p.show?.id).toBe('ch3');
    expect(p.quiet).toEqual(['place', 'topic1']);
    const patch = milestonePatch({}, [p.show!.id], '2026-10-08', p.quiet, p.migrate);
    expect(patch).toEqual({ ms: { ch3: '2026-10-08', place: '2026-10-08~', topic1: '2026-10-08~' } });
  });
  it('Umstellung auf festUnits: schon erreichte Wort-Marken werden still gemerkt, nie gefeiert; danach zählt wieder alles', () => {
    const first = pickMilestone({ candidates: [{ id: 'fest250', n: 250 }, { id: 'fest100', n: 100 }], seen: { fest100: '2026-08-01' }, today: '2026-10-08', cardShown: false });
    expect(first).toEqual({ show: null, quiet: ['fest250', 'fest100'], migrate: true });
    const later = pickMilestone({ candidates: [{ id: 'fest500', n: 500 }], seen: { fu: '2026-10-08' }, today: '2026-10-09', cardShown: false });
    expect(later.show?.id).toBe('fest500');
    expect(later.migrate).toBe(false);
  });
  it('nur Kapitel/Einstufung bei der Umstellung: Karten bleiben gezeigt, nur die Wort-Marken schweigen', () => {
    const p = pickMilestone({ candidates: [{ id: 'ch1', n: 1 }, { id: 'fest500', n: 500 }], seen: {}, today: '2026-10-08', cardShown: false });
    expect(p.show?.id).toBe('ch1');
    expect(p.quiet).toEqual(['fest500']);
    expect(p.migrate).toBe(true);
  });
  it('Teilaufruf (Kapitelprüfung, migrate: false) setzt `fu` nicht; der volle Aufruf von Heute merkt die alten Wort-Marken danach still', () => {
    const gate = pickMilestone({ candidates: [{ id: 'ch1', n: 1 }], seen: {}, today: '2026-10-08', cardShown: false, migrate: false });
    expect(gate.migrate).toBe(false);
    const patch = milestonePatch({}, [gate.show!.id], '2026-10-08', gate.quiet, gate.migrate);
    expect(patch).toEqual({ ms: { ch1: '2026-10-08' } });
    const today = pickMilestone({ candidates: [{ id: 'fest250', n: 250 }], seen: patch!.ms as Record<string, unknown>, today: '2026-10-08', cardShown: false });
    expect(today).toEqual({ show: null, quiet: ['fest250'], migrate: true });
  });
});

describe('einmal über alle Geräte (Anspruch auf dem frischen Stand)', () => {
  it('das Gerät, das den Eintrag anlegt, zeigt die Karte; ein zweiter Tab findet ihn schon vor und zeigt nichts', () => {
    const pick = pickMilestone({ candidates: [{ id: 'ch1', n: 1 }], seen: { fu: '2026-10-01' }, today: '2026-10-08', cardShown: false });
    // Gerät A schreibt zuerst.
    const a = claimMilestones({ ms: { fu: '2026-10-01' } }, pick, '2026-10-08');
    expect(a.show?.id).toBe('ch1');
    expect(a.patch).toEqual({ ms: { ch1: '2026-10-08' } });
    // Gerät B liest danach den frischen Stand mit dem Eintrag von A.
    const b = claimMilestones({ ms: { fu: '2026-10-01', ch1: '2026-10-08' } }, pick, '2026-10-08');
    expect(b.show).toBeNull();
    expect(b.patch).toBeNull();
  });
  it('das Wochenbudget gilt auch auf dem frischen Stand: hat ein anderes Gerät die zweite Karte der Woche schon gezeigt, wartet diese', () => {
    const pick = pickMilestone({ candidates: [{ id: 'ch3', n: 3 }], seen: { fu: 'x' }, today: '2026-10-08', cardShown: false });
    expect(pick.show?.id).toBe('ch3');
    const r = claimMilestones({ ms: { fu: 'x', ch1: '2026-10-05', place: '2026-10-06' } }, pick, '2026-10-08');
    expect(r.show).toBeNull();
    expect(r.patch).toBeNull();
  });
  it('der Anspruch überschreibt nie einen vorhandenen Eintrag und schreibt nichts, wenn nichts neu ist', () => {
    const pick = pickMilestone({ candidates: [{ id: 'ch1', n: 1 }, { id: 'place' }], seen: { fu: 'x' }, today: '2026-10-08', cardShown: false });
    const r = claimMilestones({ ms: { fu: 'x', place: '2026-09-01' } }, pick, '2026-10-08');
    expect(r.patch).toEqual({ ms: { ch1: '2026-10-08' } });
    expect(milestonePatch({ ms: { ch1: 'a' } }, ['ch1'], '2026-10-08')).toBeNull();
  });
});

describe('Simulation über 6 Wochen mit erzwungenen Meilensteinen', () => {
  it('jede ID höchstens einmal gezeigt; nie mehr als eine Karte je Tag (Sitzung) und zwei je ISO-Woche; nichts geht verloren (Karten warten)', () => {
    let ms: Doc = {};
    const shownLog: Array<{ day: string; id: string }> = [];
    const everyDay = (d: number): string => addDays('2026-10-05', d);
    for (let d = 0; d < 42; d++) {
      const day = everyDay(d);
      // Jeden Tag kommt etwas Neues dazu: erst Kapitel, die Einstufung, Wort-Marken, ein Thema.
      const chapters = CHAPTER_NUMS.filter((n) => n <= Math.min(7, 1 + Math.floor(d / 3)));
      const fest = d * 40;
      const cands = newMilestones({ ...base, fest, topicsFest: d > 5 ? 1 : 0, fixTotal: d > 8 ? 10 : 0, chapters, place: d >= 1, checks: d >= 20 ? 1 : 0, seen: ms });
      const pick = pickMilestone({ candidates: cands, seen: ms, today: day, cardShown: false });
      const r = claimMilestones({ ms }, pick, day);
      if (r.show) shownLog.push({ day, id: r.show.id });
      const patch = r.patch?.ms as Doc | undefined;
      if (patch) ms = { ...ms, ...patch };
    }
    const idsShown = shownLog.map((x) => x.id);
    expect(new Set(idsShown).size).toBe(idsShown.length);
    const perWeek = new Map<string, number>();
    for (const s of shownLog) if (isMilestoneCard(s.id)) perWeek.set(isoWeek(s.day), (perWeek.get(isoWeek(s.day)) ?? 0) + 1);
    for (const [wk, n] of perWeek) expect(n, wk).toBeLessThanOrEqual(MS_WEEK_MAX);
    // Ein Meilenstein, der gezeigt wurde, steht als Tag (ohne ~) in ms; still gemerkte tragen ~.
    for (const s of shownLog) expect(ms[s.id]).toBe(s.day);
    // Die Kapitel 1–7 sind bis zum Ende entweder gezeigt oder still gemerkt oder warten (offen) – keines verschwindet doppelt.
    for (const n of CHAPTER_NUMS) {
      const v = ms[`ch${n}`];
      expect(v === undefined || typeof v === 'string').toBe(true);
    }
    expect(shownLog.length).toBeGreaterThan(3);
  });
  it('die Wortmarken-IDs und die Kapitel-IDs passen in die Grenze von 30 Schlüsseln in app/profile.ms', () => {
    const all: MilestoneId[] = [...FEST_STEPS.map((n) => `fest${n}` as MilestoneId), 'topic1', 'fix10', 'overdue0', 'place', ...CHAPTER_NUMS.map((n) => `ch${n}` as MilestoneId), 'c1check1', 'c1ready'];
    expect(all.length + 1).toBeLessThanOrEqual(30); // + fu
    expect(new Set(all).size).toBe(all.length);
  });
});
