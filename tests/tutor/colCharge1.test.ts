import { describe, expect, it } from 'vitest';
import charge from '../../src/content/col/charge1.json';
import { colChargeFor, COL_CHARGE_WORDS } from '../../src/content/col';
import { BRITISH } from '../../src/domain/c1x/kinds/common';
import { isWrongLang } from '../../src/domain/lang/detect';
import { acceptCollocations, colChargeOp } from '../../src/domain/srs/collocs';

// Wortpartner-Charge `col` (S4, wort-lernen-plan.md): jede Wendung besteht dieselbe strenge Prüfung wie Claudes Wortpartner,
// ist zweisprachig, US-Englisch, und die Ablenker sind nie ein gleichwertiger Partner (kein falsches Falsch).

type Col = { p: string; de: string; en: string; gap: string; opts: string[]; ex: string };
type Item = { word: string; pos: string; col: Col[] };
const items = (charge as { items: Item[] }).items;

describe('Wortpartner-Charge 1', () => {
  it('Umfang: mindestens 90 Wörter, jedes nur einmal', () => {
    expect(items.length).toBeGreaterThanOrEqual(90);
    const keys = items.map((i) => i.word.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
    expect(COL_CHARGE_WORDS.length).toBe(items.length);
  });

  it('jede Wendung besteht acceptCollocations vollständig', () => {
    const bad: string[] = [];
    for (const it of items) {
      const ok = acceptCollocations(it.word, it.col, 2);
      if (ok.length !== it.col.length) bad.push(`${it.word}: ${it.col.map((c) => c.p).filter((p) => !ok.some((o) => o.p === p)).join(', ')}`);
      // Alle drei Ablenker überstehen die Prüfung (keiner ist gleichwertig oder steht schon in der Wendung).
      for (const c of it.col) {
        const kept = ok.find((o) => o.p === c.p);
        if (kept && kept.opts.length !== c.opts.length) bad.push(`${it.word}: opts ${c.opts.filter((o) => !kept.opts.includes(o)).join(', ')}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('zweisprachig und US-Englisch', () => {
    const bad: string[] = [];
    for (const it of items)
      for (const c of it.col) {
        if (isWrongLang(c.de, 'de', 3)) bad.push(`${it.word}: de`);
        if (c.en.length < 3 || isWrongLang(c.en, 'en', 3)) bad.push(`${it.word}: en`);
        for (const t of [c.p, c.en, c.ex, ...c.opts]) if (BRITISH.test(t)) bad.push(`${it.word}: britisch „${t}“`);
      }
    expect(bad).toEqual([]);
  });

  it('Loader und Schreibvorgang: nur ergänzend, ohne Marke ai', () => {
    const first = items[0];
    expect(first).toBeDefined();
    if (!first) return;
    const raw = colChargeFor(`to ${first.word.toUpperCase()}`) ?? colChargeFor(first.word);
    expect(raw?.length).toBe(first.col.length);
    expect(raw?.[0]).not.toHaveProperty('en');
    const op = colChargeOp({ en: first.word }, first.word, raw);
    expect(op?.update.col).toHaveLength(first.col.length);
    expect(op?.update.col[0]).not.toHaveProperty('ai');
    expect(colChargeOp({ en: first.word, col: [{ p: 'x' }] }, first.word, raw)).toBeNull();
    expect(colChargeOp({ en: first.word, hidden: true }, first.word, raw)).toBeNull();
    expect(colChargeFor('no such word here')).toBeNull();
  });
});
