import { describe, expect, it } from 'vitest';
import { attemptMs } from '../../src/data/schemas';
import { validateDoc } from '../../src/data/validate';
import { applyUpdate, attemptTiming, cardPatch, cardPatchSchema, chunkPatch, chunkPatchSchema, HIST_MAX, MAX_CARD_BYTES, reviewWrite } from '../../src/domain/srs/applyReview';
import { legacyToFsrs } from '../../src/domain/srs/legacyFsrs';
import type { AnswerEvent } from '../../src/domain/srs/types';

// S1-ZEIT (Relaunch Stufe 1 P4 Nr. 3, §4.2): `hist` bekommt `fk`/`ms`/`in` – gerundet auf 10 ms, gedeckelt bei 600.000 ms.
// Nichts sonst an `histEntry` ändert sich; Altbestand ohne die Felder bleibt lesbar; die Karte bleibt unter MAX_CARD_BYTES.

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
