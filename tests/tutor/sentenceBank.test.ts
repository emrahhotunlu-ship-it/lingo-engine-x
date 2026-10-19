import { describe, expect, it } from 'vitest';
import {
  acceptBankItem,
  acceptSourceSentences,
  bankKeys,
  GATE_CLOSED,
  gateStartPatch,
  markSbBad,
  needsBank,
  QUARANTINE_DAYS,
  quarantineOver,
  quarantinedSb,
  readGate,
  readSb,
  releaseGate,
  SB_MAX,
  sbPatch,
  sbVisible,
  sentenceCount,
  sentenceTarget,
  teacherSample,
  visibleSb,
  type SbEntry,
  type SbGate,
} from '../../src/domain/tutor/sentenceBank';

// Satzbank SB (wort-lernen-plan.md; Tutor-Engine v3 E6): Annahme der Claude-Sätze, Quarantäne 4 Wochen mit Stichprobe des Englischlehrers,
// Bedarf je Karte, ergänzendes Speichern und Melden.

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 20);
const card = { id: 'v_reliable', en: 'reliable' };
const s = (en: string, k = 'work', de = 'Wir brauchen einen zuverlässigen Lieferanten für die Teile.') => ({ en, de, sit: 'supplier choice', k });
const ai = (en: string, t = T0, extra: Partial<SbEntry> = {}): SbEntry => ({ en, de: 'Ein deutscher Satz zur Übersetzung.', sit: 'x', k: 'work', src: 'ai', t, pv: 'word-bank@1', ...extra });
const read = (en: string, t = T0): SbEntry => ({ en, de: '', sit: 'read', k: 'work', src: 'read', t, pv: 'read:a1' });

describe('acceptBankItem: Claude-Sätze prüfen', () => {
  it('gute Sätze werden angenommen, mit Quelle, Zeit und Vorlage', () => {
    const r = acceptBankItem({ id: 'v_reliable', sents: [s('We need a reliable supplier who can deliver the parts on time.'), s('My old car is still surprisingly reliable after ten long years.', 'life')] }, card, new Set(), T0, 'word-bank@1');
    expect(r.rejected).toEqual([]);
    expect(r.sb).toHaveLength(2);
    expect(r.sb[1]).toMatchObject({ k: 'life', src: 'ai', t: T0, pv: 'word-bank@1' });
  });

  it('verworfen mit Grund: Wort fehlt, doppelt, Länge, Satzzeichen, britisch, Anführungszeichen, Klammern, Deutsch fehlt, Dublette', () => {
    const r = acceptBankItem(
      {
        id: 'v_reliable',
        sents: [
          s('We need a dependable supplier who can deliver the parts on time.'),
          s('A reliable supplier is more reliable than a cheap one in the long run.'),
          s('It is reliable.'),
          s('We need a reliable supplier who can deliver the parts on time'),
          s('The reliable supplier changed the colour of the packaging last month.'),
          s('She called the supplier "reliable" in her report to the board yesterday.'),
        ],
      },
      card,
      new Set(),
      T0,
      'word-bank@1',
    );
    expect(r.rejected).toEqual(['missing_word', 'repeat', 'length', 'punct', 'british', 'quote']);
    expect(r.sb).toEqual([]);
    const more = acceptBankItem(
      { id: 'v_reliable', sents: [s('The reliable supplier [the old one] delivered every order on time.'), s('Our reliable supplier delivered every single order on time this year.', 'work', 'The supplier and the team were on time for all of the orders.'), s('We need a reliable partner for the new project in Berlin.'), s('We need a reliable partner for the new project in Berlin.')] },
      card,
      new Set(),
      T0,
      'word-bank@1',
    );
    expect(more.rejected).toEqual(['bracket', 'de_lang', 'duplicate']);
    expect(more.sb).toHaveLength(1);
  });

  it('falsche Kennung oder kaputte Form → nichts; höchstens 4 Sätze je Karte; bekannte Sätze sind Dubletten', () => {
    expect(acceptBankItem({ id: 'v_other', sents: [] }, card, new Set(), T0, 'p').rejected).toEqual(['id']);
    expect(acceptBankItem('kaputt', card, new Set(), T0, 'p').rejected).toEqual(['shape']);
    const five = ['one', 'two', 'three', 'four', 'five'].map((n) => s(`Our ${n} reliable supplier delivered every order on time this year.`));
    expect(acceptBankItem({ id: 'v_reliable', sents: five }, card, new Set(), T0, 'p').sb).toHaveLength(4);
    const doc = { ex: 'We need a reliable supplier who can deliver the parts on time.' };
    expect(acceptBankItem({ id: 'v_reliable', sents: [s(doc.ex)] }, card, bankKeys(doc, doc.ex), T0, 'p').rejected).toEqual(['duplicate']);
  });

  it('Sätze aus Lesetexten: bis 30 Wörter, ohne Übersetzung, abgeschnittene fallen weg', () => {
    const long = 'After three difficult quarters the board finally decided that only a reliable supplier with a strong local presence could secure the production targets for next year.';
    const r = acceptSourceSentences([{ en: long, ref: 'a1' }, { en: 'Only a reliable supplier can help us …', ref: 'a2' }], card, 'read', new Set(), T0);
    expect(r.sb).toEqual([{ en: long, de: '', sit: 'read', k: 'work', src: 'read', t: T0, pv: 'read:a1' }]);
    expect(r.rejected).toEqual(['punct']);
  });
});

describe('Quarantäne: 4 Wochen sammeln, Stichprobe, Freigabe', () => {
  const started: SbGate = { start: T0, on: false };

  it('Gate tolerant lesen (auch der Befund); Start nur einmal setzen', () => {
    expect(readGate(undefined)).toEqual(GATE_CLOSED);
    expect(readGate({ on: true })).toMatchObject({ on: false, start: null });
    expect(readGate({ start: T0, on: true, review: { hard: 1, unclear: 2 } })).toMatchObject({ on: true, review: { hard: 1, unclear: 2 } });
    expect(readGate({ start: T0, on: true, review: { hard: -1, unclear: 'x' } }).review).toBeNull();
    expect(gateStartPatch(GATE_CLOSED, T0)).toEqual(started);
    expect(gateStartPatch(started, T0 + DAY)).toBeNull();
  });

  it('jeder Claude-Satz 4 Wochen ab Erzeugung unsichtbar (auch nach der Freigabe), Lesetext-Sätze sofort; gemeldete nie', () => {
    const late = T0 + 10 * DAY;
    const doc = { sb: [ai('We need a reliable supplier who can deliver the parts on time.'), read('Only a reliable supplier could secure the production targets for next year.'), ai('A reliable partner keeps every promise made in the contract.', T0, { bad: 1 }), ai('Our reliable supplier delivered every single order on time this year.', late)] };
    expect(visibleSb(doc, started, T0 + DAY).map((e) => e.src)).toEqual(['read']);
    expect(quarantinedSb(doc, started, T0 + DAY)).toHaveLength(2);
    const open = { ...started, on: true };
    // Freigegeben, aber der zweite Satz ist erst 18 Tage alt.
    const day28 = T0 + QUARANTINE_DAYS * DAY;
    expect(visibleSb(doc, open, day28).map((e) => e.t)).toEqual([T0, T0]);
    expect(quarantinedSb(doc, open, day28).map((e) => e.t)).toEqual([late]);
    expect(visibleSb(doc, open, late + QUARANTINE_DAYS * DAY).filter((e) => e.src === 'ai')).toHaveLength(2);
    // Ohne Freigabe bleibt auch ein alter Satz verborgen; ohne Zeitstempel nie sichtbar.
    expect(visibleSb(doc, started, day28).map((e) => e.src)).toEqual(['read']);
    expect(sbVisible(ai('x', 0), open, day28)).toBe(false);
    expect(sbVisible({ ...ai('x'), bad: 1 }, open, day28)).toBe(false);
    expect(readSb(doc, true)).toHaveLength(4);
  });

  it('Freigabe nur nach 28 Tagen, mit höchstens 1 hartem Fehler und höchstens 2 nicht eindeutigen Lücken', () => {
    const before = T0 + (QUARANTINE_DAYS - 1) * DAY;
    const after = T0 + QUARANTINE_DAYS * DAY;
    expect(quarantineOver(started, before)).toBe(false);
    expect(releaseGate(started, before, { hard: 0, unclear: 0 }).on).toBe(false);
    expect(releaseGate(started, after, { hard: 1, unclear: 2 })).toEqual({ start: T0, on: true, checkedAt: after, review: { hard: 1, unclear: 2 } });
    expect(releaseGate(started, after, { hard: 2, unclear: 0 }).on).toBe(false);
    expect(releaseGate(started, after, { hard: 0, unclear: 3 }).on).toBe(false);
    expect(releaseGate(GATE_CLOSED, after, { hard: 0, unclear: 0 }).on).toBe(false);
    expect(releaseGate(started, after, { hard: Number.NaN, unclear: 0 }).on).toBe(false);
  });

  it('Stichprobe: deterministisch, höchstens 30, höchstens 2 je Karte, nur ungemeldete Claude-Sätze, optional ab Datum', () => {
    const cards = Array.from({ length: 20 }, (_, i) => ({
      id: `v${i}`,
      word: `w${i}`,
      doc: { sb: [ai(`Sentence one for card ${i} in the meeting.`, T0), ai(`Sentence two for card ${i} in the meeting.`, T0 + DAY), ai(`Sentence three for card ${i} in the meeting.`, T0 + 2 * DAY), read(`Read sentence for card ${i}.`), ai(`Bad sentence for card ${i}.`, T0, { bad: 1 })] },
    }));
    const a = teacherSample(cards);
    expect(a).toHaveLength(30);
    expect(teacherSample(cards)).toEqual(a);
    const per = new Map<string, number>();
    for (const r of a) per.set(r.id, (per.get(r.id) ?? 0) + 1);
    expect(Math.max(...per.values())).toBeLessThanOrEqual(2);
    expect(a.every((r) => !r.en.startsWith('Read') && !r.en.startsWith('Bad'))).toBe(true);
    expect(teacherSample(cards, 100, T0 + 2 * DAY).every((r) => r.t >= T0 + 2 * DAY)).toBe(true);
  });
});

describe('Bedarf und Speichern', () => {
  it('Ziel 4 vor Stufe 4, 6 danach; gezählt werden Ursprung, xEx, sichtbare und wartende Sätze', () => {
    expect(sentenceTarget(2)).toBe(4);
    expect(sentenceTarget(4)).toBe(6);
    const doc = { stage: 2, ex: 'Our supplier is very reliable.', xEx: [{ en: 'A reliable partner matters.', t: 1 }], sb: [ai('We need a reliable supplier who can deliver the parts on time.')] };
    const gate: SbGate = { start: T0, on: false };
    expect(sentenceCount(doc, gate, T0)).toBe(2);
    expect(needsBank(doc, gate, T0)).toBe(true);
    const enough = { ...doc, sb: [...doc.sb, ai('Second reliable sentence for the weekly sales meeting.')] };
    expect(needsBank(enough, gate, T0)).toBe(false);
    // Nach Freigabe und 4 Wochen zählen dieselben Sätze als sichtbar statt wartend: gleicher Bedarf.
    expect(needsBank(enough, { ...gate, on: true }, T0 + QUARANTINE_DAYS * DAY)).toBe(false);
    expect(needsBank({ ...enough, stage: 4 }, gate, T0)).toBe(true);
    expect(needsBank({ stage: 5, sb: Array.from({ length: SB_MAX }, (_, i) => ai(`Reliable sentence number ${i} for the team.`)) }, gate, T0)).toBe(false);
  });

  it('sbPatch hängt an; volle Bank: älteste ungemeldete Claude-Sätze weichen, anderes nie', () => {
    expect(sbPatch(undefined, [ai('a')])).toEqual([ai('a')]);
    expect(sbPatch([ai('a')], [])).toBeNull();
    const full: unknown[] = [read('r1', 1), { ...ai('bad', 0), bad: 1 }, { fremd: true }, ...Array.from({ length: SB_MAX - 3 }, (_, i) => ai(`a${i}`, 10 + i))];
    const next = sbPatch(full, [ai('neu', 99), ai('neu2', 100)]) as SbEntry[];
    expect(next).toHaveLength(SB_MAX);
    expect(next.slice(0, 3)).toEqual(full.slice(0, 3));
    expect(next.map((e) => e.en)).not.toContain('a0');
    expect(next.map((e) => e.en)).not.toContain('a1');
    expect(next.slice(-2).map((e) => e.en)).toEqual(['neu', 'neu2']);
    const locked: unknown[] = Array.from({ length: SB_MAX }, (_, i) => read(`r${i}`));
    expect(sbPatch(locked, [ai('neu')])).toBeNull();
  });

  it('markSbBad markiert einmal, löscht nie', () => {
    const cur = [ai('We need a reliable supplier.'), ai('Other sentence.')];
    const next = markSbBad(cur, 'we need a reliable supplier') as SbEntry[];
    expect(next).toHaveLength(2);
    expect(next[0]?.bad).toBe(1);
    expect(markSbBad(next, 'We need a reliable supplier.')).toBeNull();
    expect(markSbBad(cur, 'nicht da')).toBeNull();
  });
});
