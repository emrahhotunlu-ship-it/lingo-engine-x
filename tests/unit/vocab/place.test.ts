import { describe, expect, it } from 'vitest';
import { createWriter } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { buildPlaceTest, deFits, findWord, isLoan, PLACE_BANDS, placeGoesOn, type PlaceTest, prodRight, type BandAnswers, sameFamily, scorePlace, shortDe, withFirst } from '../../../src/modules/vocab/domain/place';
import type { BandRaw } from '../../../src/modules/vocab/domain/sources';
import { placeDoc, writePlace } from '../../../src/modules/vocab/data/place';
import { readPlace } from '../../../src/modules/vocab/data/refill';
import atlas from '../../../src/content/atlas/atlas.json';

// Großpaket A Schritt 7c (vokabeln/s7-bau.md, Bilder s3-01 bis s3-04): Einstufungstest rein und Speichern nach `vmod/place`.

const ITEMS = (atlas as { items: BandRaw[] }).items;
const T0 = Date.parse('2026-11-02T18:00:00Z');

/** Alle Antworten richtig (oder falsch) für eine Stufe. */
const right = (t: PlaceTest, i: number): BandAnswers => ({ rec: t.bands[i]!.rec.map((r) => r.right), prod: t.bands[i]!.prod.map((p) => p.answer) });
const wrong = (t: PlaceTest, i: number): BandAnswers => ({ rec: t.bands[i]!.rec.map(() => -1), prod: t.bands[i]!.prod.map(() => '') });

describe('Einstufung: Test bauen', () => {
  const test = buildPlaceTest(ITEMS, '2026-11-02');
  it('fünf Stufen aus dem Atlas, je 6 erkennen und 2 bilden', () => {
    expect(test.bands.map((b) => [b.lo, b.hi])).toEqual(PLACE_BANDS.map((b) => [...b]));
    for (const b of test.bands) {
      expect(b.rec).toHaveLength(6);
      expect(b.prod).toHaveLength(2);
    }
  });
  it('jedes Wort steht markiert im Satz; Ablenker derselben Wortart, vier verschiedene Bedeutungen, genau eine richtig', () => {
    const byW = new Map(ITEMS.map((e) => [e.w, e]));
    const words = new Set<string>();
    for (const b of test.bands) {
      for (const r of b.rec) {
        expect(r.x.slice(r.start, r.end).toLowerCase()).toBe(r.w.toLowerCase());
        expect(new Set(r.opts).size).toBe(4);
        expect(r.opts.every((o) => o.length <= 40)).toBe(true);
        expect(r.opts[r.right]).toBe(shortDe(byW.get(r.w)!.d));
        const e = byW.get(r.w)!;
        expect(e.r >= b.lo && e.r < b.hi).toBe(true);
        expect(e.hidden || e.basic || e.exWeak).toBeFalsy();
        words.add(r.w);
      }
      for (const p of b.prod) {
        expect(p.x.slice(p.start, p.end)).toBe(p.answer);
        expect(p.first).toBe(p.answer.charAt(0));
        expect(p.w.length).toBeGreaterThanOrEqual(6);
        words.add(p.w);
      }
    }
    expect(words.size).toBe(40); // kein Wort doppelt
  });
  it('Ablenker: nie die Bedeutung eines Testworts, keiner doppelt im ganzen Test, Form passt zur Wortart (english-teacher S7c)', () => {
    const targets = new Set<string>();
    for (const b of test.bands) {
      for (const r of b.rec) targets.add(r.opts[r.right]!.toLowerCase());
      for (const p of b.prod) targets.add(p.de.toLowerCase());
    }
    const seen = new Set<string>();
    for (const b of test.bands) {
      for (const r of b.rec) {
        expect(deFits(r.pos, r.opts[r.right]!)).toBe(true);
        r.opts.forEach((o, k) => {
          if (k === r.right) return;
          const low = o.toLowerCase();
          expect(targets.has(low), o).toBe(false);
          expect(seen.has(low), o).toBe(false);
          expect(deFits(r.pos, o), `${r.pos}: ${o}`).toBe(true);
          seen.add(low);
        });
      }
    }
  });
  it('keine Lehnwörter, keine Adverbien zum Bilden', () => {
    for (const b of test.bands) {
      for (const r of b.rec) expect(isLoan(r.w, r.opts[r.right]!), r.w).toBe(false);
      for (const p of b.prod) {
        expect(isLoan(p.w, p.de), p.w).toBe(false);
        expect(p.pos).not.toBe('adverb');
      }
    }
  });
  it('isLoan und deFits', () => {
    expect(isLoan('concentration', 'Konzentration')).toBe(true);
    expect(isLoan('acceptable', 'akzeptabel, annehmbar')).toBe(true);
    expect(isLoan('intense', 'intensiv')).toBe(true);
    expect(isLoan('prophet', 'Prophet')).toBe(true);
    expect(isLoan('philosophy', 'Filosofie')).toBe(true);
    expect(isLoan('margin', 'Marge, Gewinnspanne')).toBe(true);
    expect(isLoan('earnings', 'Gewinn, Ertrag')).toBe(false);
    expect(isLoan('refuse', 'sich weigern')).toBe(false);
    expect(deFits('noun', 'Bach, kleiner Fluss')).toBe(true);
    expect(deFits('noun', 'langweilig')).toBe(false);
    expect(deFits('verb', 'sich weigern')).toBe(true);
    expect(deFits('verb', 'schlank, schmal')).toBe(false);
    expect(deFits('adjective', 'ein bezauberndes Kleid')).toBe(false);
    expect(deFits('adjective', 'tief')).toBe(true);
  });
  it('Wiederholung: früher Gekonntes kommt nicht wieder', () => {
    const ok = new Set(test.bands.flatMap((b) => [...b.rec.map((r) => r.w), ...b.prod.map((p) => p.w)]));
    const again = buildPlaceTest(ITEMS, '2026-11-02|1', ok);
    for (const b of again.bands) for (const w of [...b.rec.map((r) => r.w), ...b.prod.map((p) => p.w)]) expect(ok.has(w), w).toBe(false);
    expect(again.bands).toHaveLength(5);
  });
  it('fest aus dem Startwert: gleicher Tag gleiche Wörter, anderer Tag andere', () => {
    expect(buildPlaceTest(ITEMS, '2026-11-02')).toEqual(test);
    const other = buildPlaceTest(ITEMS, '2026-11-03');
    expect(other.bands[0]!.rec.map((r) => r.w)).not.toEqual(test.bands[0]!.rec.map((r) => r.w));
  });
  it('Stufen ohne genug Wörter fallen weg', () => {
    expect(buildPlaceTest(ITEMS.filter((e) => e.r < 4000), 's').bands.map((b) => b.lo)).toEqual([2500]);
    expect(buildPlaceTest([], 's').bands).toEqual([]);
  });
  it('findWord: ganzes Wort, Groß/klein egal', () => {
    expect(findWord('Scope creep is real.', 'scope')).toEqual([0, 5]);
    expect(findWord('The scopes differ.', 'scope')).toBeNull();
    expect(findWord('a well-known fact', 'known')).toBeNull();
  });
  it('shortDe: höchstens zwei Teile, ohne Beispiele, Wortanfänge und jdn./etw.', () => {
    expect(shortDe('jdn. mit etw. überschwemmen, ein Gebiet überschwemmen, fluten')).toBe('ein Gebiet überschwemmen, fluten');
    expect(shortDe('Stier')).toBe('Stier');
    expect(shortDe('Bach, kleiner Fluss, Wasserlauf')).toBe('Bach, kleiner Fluss');
    expect(shortDe('langweilig, Es ist furchtbar langweilig.')).toBe('langweilig');
    expect(shortDe('tief, tief ergriffen sein')).toBe('tief');
    expect(shortDe('Bart, sich einen Bart wachsen lassen')).toBe('Bart');
    expect(shortDe('sich weigern, sich weigern')).toBe('sich weigern');
    expect(shortDe('Wärme…, thermisch')).toBe('thermisch');
    expect(shortDe('Antritts-, Eröffnungs-')).toBe('');
    expect(shortDe('Start- und Landebahn')).toBe('Start- und Landebahn');
  });
});

describe('Einstufung: auswerten', () => {
  const test = buildPlaceTest(ITEMS, '2026-11-02');
  it('prodRight: Groß/klein egal, ab 6 Buchstaben ein Tippfehler', () => {
    const p = { kind: 'prod' as const, w: 'contribute', pos: 'verb', de: 'beitragen', x: 'x', start: 0, end: 1, answer: 'contribute', first: 'c' };
    expect(prodRight(p, 'Contribute')).toBe(true);
    expect(prodRight(p, 'contirbute')).toBe(true);
    expect(prodRight(p, 'contrbte')).toBe(false);
    expect(prodRight(p, '')).toBe(false);
    expect(prodRight({ ...p, answer: 'fame' }, 'fane')).toBe(false);
  });
  it('Anfangsbuchstabe steht da: wer ihn nicht mittippt, meint ihn mit (ux-reviewer S7c)', () => {
    const p = { kind: 'prod' as const, w: 'clock', pos: 'noun', de: 'Uhr', x: 'x', start: 0, end: 1, answer: 'clock', first: 'c' };
    expect(withFirst(p, 'lock')).toBe('clock');
    expect(withFirst(p, 'clock')).toBe('clock');
    expect(withFirst(p, '')).toBe('');
    expect(prodRight(p, 'lock')).toBe(true);
    expect(prodRight(p, 'Clock')).toBe(true);
  });
  it('Stopp erst nach zwei nicht sicheren Stufen in Folge', () => {
    expect(placeGoesOn([])).toBe(true);
    expect(placeGoesOn([false])).toBe(true);
    expect(placeGoesOn([true, false])).toBe(true);
    expect(placeGoesOn([false, true, false])).toBe(true);
    expect(placeGoesOn([true, false, false])).toBe(false);
    // schwer, sicher, schwer, schwer: Grenze = Obergrenze der letzten sicheren Stufe (4.000–6.000), Rest nicht getestet
    const r = scorePlace(test, [wrong(test, 0), right(test, 1), wrong(test, 2), wrong(test, 3), right(test, 4)]);
    expect(r.bands.map((b) => b.s)).toEqual(['bad', 'ok', 'bad', 'bad', 'skip']);
    expect(r.edge).toBe(6000);
    expect(r.ok).toHaveLength(8);
  });
  it('sicher bei ≥ 5/6 und ≥ 1/2; nach einer schweren Stufe geht es weiter; Grenze = Obergrenze der letzten sicheren', () => {
    const b2 = right(test, 2);
    b2.rec[0] = -1;
    b2.rec[1] = -1; // 4/6
    const r = scorePlace(test, [right(test, 0), right(test, 1), b2]);
    expect(r.bands.map((b) => [b.lo, b.s, b.r, b.p])).toEqual([
      [2500, 'ok', 6, 2],
      [4000, 'ok', 6, 2],
      [6000, 'bad', 4, 2],
      [8000, 'skip', 0, 0],
      [10000, 'skip', 0, 0],
    ]);
    expect(r.edge).toBe(6000);
    expect(r.ok).toHaveLength(16 + 6);
  });
  it('5/6 und 1/2 reicht genau', () => {
    const a = right(test, 0);
    a.rec[0] = (a.rec[0]! + 1) % 4;
    a.prod[1] = 'xyz';
    const r = scorePlace(test, [a, wrong(test, 1)]);
    expect(r.bands[0]).toMatchObject({ s: 'ok', r: 5, p: 1 });
    expect(r.edge).toBe(4000);
  });
  it('schon die erste Stufe schwer: Grenze 2.500; alles sicher: 12.000', () => {
    expect(scorePlace(test, [wrong(test, 0), wrong(test, 1)]).edge).toBe(2500);
    expect(scorePlace(test, [wrong(test, 0), wrong(test, 1)]).bands.map((b) => b.s)).toEqual(['bad', 'bad', 'skip', 'skip', 'skip']);
    expect(scorePlace(test, [0, 1, 2, 3, 4].map((i) => right(test, i))).edge).toBe(12000);
  });
});

describe('Einstufung: speichern (vmod/place)', () => {
  const test = buildPlaceTest(ITEMS, '2026-11-02');
  const res = scorePlace(test, [right(test, 0), wrong(test, 1)]);
  it('legt an, ersetzt beim Wiederholen, refill liest Grenze und gekonnte Wörter', async () => {
    const h = createMemoryDb({ seed: {} });
    const w = createWriter(h.db);
    expect(await writePlace(w, res, T0)).toBe(true);
    const doc = h.dump()['vmod/place'] as Record<string, unknown>;
    expect(doc).toMatchObject({ v: 1, t: T0, edge: 4000, bands: [[2500, 'ok', 6, 2], [4000, 'bad', 0, 0], [6000, 'skip', 0, 0], [8000, 'skip', 0, 0], [10000, 'skip', 0, 0]] });
    expect(readPlace(doc)).toEqual({ edge: 4000, ok: res.ok });
    const res2 = scorePlace(test, [right(test, 0), right(test, 1), wrong(test, 2)]);
    expect(await writePlace(w, res2, T0 + 1000)).toBe(true);
    expect(readPlace(h.dump()['vmod/place'] as Record<string, unknown>)).toEqual({ edge: 6000, ok: res2.ok });
  });
  it('fremder Aufbau wird nie angefasst', async () => {
    const alien = { v: 2, edge: 9000, x: 1 };
    const h = createMemoryDb({ seed: { 'vmod/place': alien } });
    expect(await writePlace(createWriter(h.db), res, T0)).toBe(false);
    expect(h.dump()['vmod/place']).toEqual(alien);
  });
  it('ungültiges Ergebnis wird nicht geschrieben', () => {
    expect(placeDoc({ edge: -1, bands: [], ok: [] }, T0)).toBeNull();
  });
});

describe('Einstufung: Nachprüfung english-teacher S7c', () => {
  it('Wortfamilie: finite/infinite, unable/able nicht zusammen; kurze Stichwörter nie', () => {
    expect(sameFamily('finite', 'infinite')).toBe(true);
    expect(sameFamily('regular', 'irregular')).toBe(true);
    expect(sameFamily('channel', 'channels')).toBe(true);
    expect(sameFamily('able', 'unable')).toBe(false);
    expect(sameFamily('stone', 'tone')).toBe(false);
  });
  it('Lehnwort erkennt dsch/sch: jungle ~ Dschungel, shampoo ~ Schampon', () => {
    expect(isLoan('jungle', 'Dschungel')).toBe(true);
    expect(isLoan('shock', 'Schock')).toBe(true);
  });
  it('kurze Bedeutung ohne Artikel am Anfang', () => {
    expect(shortDe('das Jagen, Jagdausübung')).toBe('Jagen, Jagdausübung');
    expect(shortDe('der Skisport')).toBe('Skisport');
  });
  it('im echten Atlas: kein Ablenker ist ein Lehnwort, keine zwei Testwörter aus einer Familie', () => {
    const loans = new Map(ITEMS.filter((e) => e.d).map((e) => [shortDe(e.d), e.w] as const));
    for (const seed of ['2026-11-01|0', '2026-11-02|0', '2026-11-03|5']) {
      const t = buildPlaceTest(ITEMS, seed);
      const all = t.bands.flatMap((b) => [...b.rec.map((r) => r.w), ...b.prod.map((p) => p.w)]);
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(sameFamily(all[i]!, all[j]!), `${all[i]} ~ ${all[j]}`).toBe(false);
      for (const b of t.bands)
        for (const r of b.rec)
          r.opts.forEach((o, i) => {
            if (i === r.right) return;
            const w = loans.get(o);
            if (w) expect(isLoan(w, o), `${o} (${w})`).toBe(false);
          });
    }
  });
});
