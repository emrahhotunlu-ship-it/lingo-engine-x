import { describe, expect, it } from 'vitest';
import { attemptMs } from '../../src/data/schemas';
import { validateDoc } from '../../src/data/validate';
import { applyUpdate, attemptTiming, cardPatch, cardPatchSchema, chunkPatch, chunkPatchSchema, HIST_MAX, histNewEntrySchema, MAX_CARD_BYTES, reviewWrite } from '../../src/domain/srs/applyReview';
import { legacyToFsrs } from '../../src/domain/srs/legacyFsrs';
import type { AnswerEvent } from '../../src/domain/srs/types';

// S1-ZEIT (Relaunch Stufe 1 P4 Nr. 3, §4.2): `hist` bekommt `fk`/`ms`/`in` – gerundet auf 10 ms, gedeckelt bei 600.000 ms – und
// (Nacharbeit) `mx`/`pl`/`n`/`bg`/`st`; `ms` ist dort die Zeit beim Senden (`sm`, ohne Wartezeit auf Claude). Die übrigen Felder von
// `histEntry` bleiben; Altbestand (auch mit fremden Werten) bleibt lesbar und bewertbar; die Karte bleibt unter MAX_CARD_BYTES.

type Doc = Record<string, unknown>;
const NOW = Date.UTC(2026, 9, 14, 10, 0, 0);
const DAY = 86_400_000;
const base: Doc = {
  word: 'eventually',
  pos: 'adverb',
  de: 'schließlich',
  def: 'in the end',
  ex: 'We will [eventually] ship it.',
  state: 'review',
  S: 10,
  D: 5,
  last: NOW - 3 * DAY,
  due: NOW - 1000,
  reps: 4,
  lapses: 0,
  modes: {},
  stage: 4,
  hist: [],
  intro: '2026-08-01',
  order: 900,
  added: '2026-08-01',
  src: 'ai',
};
const card = (over: Doc = {}): Doc => {
  const d = { ...base, ...over };
  return { ...d, fsrs: legacyToFsrs(d, NOW) };
};
const ans = (over: Partial<AnswerEvent> = {}): AnswerEvent => ({ t: NOW, day: '2026-10-14', kind: 'v', id: 'eventually', ex: 'cloze', grade: 3, given: 'eventually', ans: 'eventually', ms: 5234, lang: 'de', ctx: 'rev', ...over });
const lastHist = (p: Doc): Doc => (p.hist as Doc[])[(p.hist as Doc[]).length - 1] as Doc;

describe('histEntry: fk/ms/in', () => {
  it('hängt fk, ms und in gerundet an; die übrigen Felder bleiben wie bisher', () => {
    const p = cardPatch(card(), ans({ fk: 1843.6, in: 't' }));
    expect(lastHist(p)).toEqual({ t: NOW, m: 'type', g: 3, x: 'cloze', fk: 1840, ms: 5230, in: 't' });
    expect(cardPatchSchema.safeParse(p).success).toBe(true);
  });

  it('ohne Messwerte genau der alte Eintrag (ms 0 heißt „nicht gemessen“)', () => {
    expect(lastHist(cardPatch(card(), ans({ ms: 0 })))).toEqual({ t: NOW, m: 'type', g: 3, x: 'cloze' });
    // Ungültiges bleibt weg statt die Karte zu blockieren.
    const e = lastHist(cardPatch(card(), ans({ fk: Number.NaN, ms: Number.POSITIVE_INFINITY, in: 'x' as unknown as 't' })));
    expect(e).toEqual({ t: NOW, m: 'type', g: 3, x: 'cloze' });
  });

  it('Deckel bei 600.000 ms, nie negativ', () => {
    expect(attemptMs(9_999_999)).toBe(600_000);
    expect(attemptMs(-5)).toBe(0);
    expect(attemptMs(4)).toBe(0);
    expect(attemptMs(5)).toBe(10);
    expect(attemptTiming({ ms: 2_000_000, fk: 700_000, in: 'd' })).toEqual({ fk: 600_000, ms: 600_000, in: 'd' });
    expect(attemptTiming({ ms: 1200, fk: 0, in: 'c' })).toEqual({ fk: 0, ms: 1200, in: 'c' });
  });

  it('das strenge Patch-Schema lehnt ungültige Zeitwerte ab', () => {
    const p = cardPatch(card(), ans({ fk: 1000, in: 'd' }));
    const bad = { ...p, hist: [...(p.hist as Doc[]).slice(0, -1), { ...lastHist(p), fk: -10 }] };
    expect(cardPatchSchema.safeParse(bad).success).toBe(false);
    const bad2 = { ...p, hist: [...(p.hist as Doc[]).slice(0, -1), { ...lastHist(p), in: 'typed' }] };
    expect(cardPatchSchema.safeParse(bad2).success).toBe(false);
  });

  it('Wendungen bekommen dieselben Felder', () => {
    const chunk: Doc = { phrase: 'take into account', de: 'berücksichtigen', ex: 'Please [take it into account].', state: 'review', S: 4, D: 5, last: NOW - 2 * DAY, due: NOW - 1000, reps: 2, lapses: 0, stage: 2, hist: [] };
    const a = ans({ kind: 'chunk', id: 'take-into-account', ex: 'cloze', q: 'take into account', given: 'take it into account', ans: 'take it into account', fk: 2210, in: 'd' });
    const p = chunkPatch({ ...chunk, fsrs: legacyToFsrs(chunk, NOW) }, a);
    expect(lastHist(p)).toMatchObject({ fk: 2210, ms: 5230, in: 'd' });
    expect(chunkPatchSchema.safeParse(p).success).toBe(true);
  });
});

describe('Altbestand und Kappung', () => {
  it('ältere Einträge ohne Felder bleiben unverändert, slice(-12) behält die neuesten', () => {
    const old = Array.from({ length: HIST_MAX }, (_, i) => ({ t: NOW - (HIST_MAX - i) * DAY, m: 'cloze', g: 3 }));
    const p = cardPatch(card({ hist: old }), ans({ fk: 900, in: 't' }));
    const hist = p.hist as Doc[];
    expect(hist).toHaveLength(HIST_MAX);
    expect(hist.slice(0, -1)).toEqual(old.slice(1));
    expect(hist[HIST_MAX - 1]).toMatchObject({ t: NOW, fk: 900, ms: 5230, in: 't' });
  });

  it('das Lese-Schema liest gemischte Verläufe (mit und ohne Zeitfelder)', () => {
    const doc = card({ hist: [{ t: 1, m: 'cloze', g: 3 }, { t: 2, m: 'type', g: 4, x: 'type', fk: 1840, ms: 5230, in: 't' }] });
    expect(validateDoc('vocab/eventually', doc).ok).toBe(true);
  });

  it('volle Karte: 12 Einträge mit allen Feldern bleiben weit unter MAX_CARD_BYTES', () => {
    const full = Array.from({ length: HIST_MAX }, (_, i) => ({ t: NOW - (HIST_MAX - i) * DAY, m: 'type', g: 3, x: 'type', s: 'abcd1234', fk: 600_000, ms: 600_000, in: 'd' }));
    const cur = card({ hist: full });
    const w = reviewWrite('vocab/eventually', cur, ans({ t: NOW + 1, fk: 600_000, ms: 600_000, in: 'd' }), null);
    expect(w.kind).toBe('update');
    const merged = applyUpdate(cur, w.kind === 'update' ? w.patch : {});
    const bytes = new TextEncoder().encode(JSON.stringify(merged)).length;
    expect(bytes).toBeLessThan(MAX_CARD_BYTES);
    // Zuwachs je Eintrag (schlimmster Fall: sechsstellige Werte): unter 40 Byte, also unter 480 Byte je Karte.
    const one = (merged.hist as Doc[])[HIST_MAX - 1] as Doc;
    const extra = new TextEncoder().encode(JSON.stringify(one)).length - new TextEncoder().encode(JSON.stringify({ ...one, fk: undefined, ms: undefined, in: undefined })).length;
    expect(extra).toBeLessThan(40);
  });
});

describe('Nacharbeit: weitere Messwerte', () => {
  it('mx, pl, n, bg, st landen im neuen Eintrag; ms ist die Zeit beim Senden (sm)', () => {
    const p = cardPatch(card(), ans({ ms: 9876, sm: 4321, fk: 1203, in: 'd', mx: 1, pl: 58, n: 2, bg: 1, st: 4 }));
    expect(lastHist(p)).toEqual({ t: NOW, m: 'type', g: 3, x: 'cloze', fk: 1200, ms: 4320, in: 'd', mx: 1, pl: 58, n: 2, bg: 1, st: 4 });
    expect(cardPatchSchema.safeParse(p).success).toBe(true);
    // Ohne sm bleibt ms die Antwortzeit.
    expect(lastHist(cardPatch(card(), ans({ ms: 9876 })))).toMatchObject({ ms: 9880 });
  });

  it('Ungültiges bleibt weg; pl gedeckelt bei 9.999', () => {
    expect(attemptTiming({ ms: 100, pl: 12_345.6, st: 7, mx: 2 as unknown as 1, n: 3 as unknown as 2, bg: 0 as unknown as 1 })).toEqual({ ms: 100, pl: 9_999 });
    expect(attemptTiming({ ms: 100, pl: -1, st: 2.5 })).toEqual({ ms: 100 });
  });

  it('streng geprüft wird nur der NEUE Eintrag', () => {
    const p = cardPatch(card(), ans({ fk: 1000, in: 't', st: 4 }));
    const swap = (over: Doc) => ({ ...p, hist: [...(p.hist as Doc[]).slice(0, -1), { ...lastHist(p), ...over }] });
    expect(cardPatchSchema.safeParse(swap({ mx: 2 })).success).toBe(false);
    expect(cardPatchSchema.safeParse(swap({ st: 6 })).success).toBe(false);
    expect(cardPatchSchema.safeParse(swap({ pl: 10_000 })).success).toBe(false);
    expect(histNewEntrySchema.safeParse({ t: 1, ms: 12.5 }).success).toBe(false);
  });

  it('eine Karte mit einem alten Eintrag ms: 12.5, in: "x" bleibt bewertbar', () => {
    const cur = card({ hist: [{ t: NOW - DAY, m: 'type', g: 3, ms: 12.5, in: 'x', fk: -3 }] });
    expect(validateDoc('vocab/eventually', cur).ok).toBe(true);
    const p = cardPatch(cur, ans({ fk: 800, in: 't', st: 4 }));
    expect(cardPatchSchema.safeParse(p).success).toBe(true);
    expect((p.hist as Doc[])[0]).toEqual({ t: NOW - DAY, m: 'type', g: 3, ms: 12.5, in: 'x', fk: -3 });
    const w = reviewWrite('vocab/eventually', cur, ans({ t: NOW + 1, fk: 800, in: 't', st: 4 }), null);
    expect(w.kind).toBe('update');
  });

  it('das Lese-Schema liest alle neuen Felder', () => {
    const doc = card({ hist: [{ t: 1, m: 'cloze', g: 3 }, { t: 2, m: 'type', g: 4, x: 'type', fk: 1840, ms: 5230, in: 't', mx: 1, pl: 40, n: 2, bg: 1, st: 3 }] });
    expect(validateDoc('vocab/eventually', doc).ok).toBe(true);
  });

  it('schlimmster Fall: 12 Einträge mit allen Feldern, Zuwachs unter 80 Byte je Eintrag, Karte weit unter MAX_CARD_BYTES', () => {
    const worst = { fk: 600_000, in: 'd' as const, mx: 1 as const, pl: 9_999, n: 2 as const, bg: 1 as const, st: 5 };
    const full = Array.from({ length: HIST_MAX }, (_, i) => ({ t: NOW - (HIST_MAX - i) * DAY, m: 'type', g: 3, x: 'type', s: 'abcd1234', ms: 600_000, ...worst }));
    const cur = card({ hist: full });
    const w = reviewWrite('vocab/eventually', cur, ans({ t: NOW + 1, ms: 600_000, sm: 600_000, ...worst }), null);
    expect(w.kind).toBe('update');
    const merged = applyUpdate(cur, w.kind === 'update' ? w.patch : {});
    const bytes = new TextEncoder().encode(JSON.stringify(merged)).length;
    expect(bytes).toBeLessThan(MAX_CARD_BYTES);
    const one = (merged.hist as Doc[])[HIST_MAX - 1] as Doc;
    expect(one).toMatchObject({ ...worst, ms: 600_000 });
    const strip = { ...one, fk: undefined, ms: undefined, in: undefined, mx: undefined, pl: undefined, n: undefined, bg: undefined, st: undefined };
    const extra = new TextEncoder().encode(JSON.stringify(one)).length - new TextEncoder().encode(JSON.stringify(strip)).length;
    expect(extra).toBeLessThan(80);
    expect(extra * HIST_MAX).toBeLessThan(1_000);
  });
});
