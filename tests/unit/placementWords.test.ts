import { describe, expect, it } from 'vitest';
import { PER_BAND, PSEUDO_SHOWN, WORD_BANDS, WORD_SCOPE, buildWordProbe, wordSpan } from '../../src/domain/c1/placement/words';
import { placeEntry, placementResult, startRun } from '../../src/domain/c1/placement/run';
import { placementRight } from '../../src/features/c1/PlacementItem';
import { solutionsOf, wrongsOf } from '../../src/domain/c1x/solutions';
import { c1File } from '../../src/domain/c1x/schema';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Einstufung, Teil 1 „Wörter“ (P34): Aufbau, Spanne, Eigenschaften. Dazu: die Wertung der Oberfläche ist `scoreC1` (volle Punktzahl = richtig).

describe('Teil 1 Wörter', () => {
  it('30 echte Wörter (Bänder 2 bis 6, je 6) und 8 Pseudowörter, gemischt, wiederholbar je Tag', () => {
    const a = buildWordProbe('2026-10-07');
    expect(a).toHaveLength(WORD_BANDS.length * PER_BAND + PSEUDO_SHOWN);
    expect(a.filter((p) => p.pseudo)).toHaveLength(PSEUDO_SHOWN);
    for (const b of WORD_BANDS) expect(a.filter((p) => p.band === b)).toHaveLength(PER_BAND);
    expect(new Set(a.map((p) => p.w)).size).toBe(a.length);
    expect(buildWordProbe('2026-10-07')).toEqual(a);
    expect(buildWordProbe('2026-10-08').map((p) => p.w)).not.toEqual(a.map((p) => p.w));
  });
  it('Spanne: alles bekannt ist hoch, nichts bekannt ist niedrig, Pseudowörter werden abgezogen', () => {
    const probe = buildWordProbe('x');
    const real = probe.filter((p) => !p.pseudo).map((p) => p.w);
    const pseudo = probe.filter((p) => p.pseudo).map((p) => p.w);
    const all = wordSpan(probe, new Set(real));
    const none = wordSpan(probe, new Set());
    expect(all[1]).toBe(WORD_SCOPE);
    expect(all[0]).toBeGreaterThan(5000);
    expect(none[1]).toBeLessThanOrEqual(1500);
    const half = wordSpan(probe, new Set(real.slice(0, 15)));
    expect(half[0]).toBeLessThan(half[1]);
    expect(half[0]).toBeGreaterThan(none[0]);
    // Wer alles „kenne ich“ sagt, auch bei den erfundenen Wörtern, bekommt keine hohe Spanne.
    const yesAll = wordSpan(probe, new Set([...real, ...pseudo]));
    expect(yesAll[1]).toBeLessThanOrEqual(1500);
    for (const x of [all, none, half, yesAll]) {
      expect(x[0] % 100).toBe(0);
      expect(x[1] % 100).toBe(0);
    }
  });
  it('die Spanne kommt als Zusatzfeld `vw` in den Eintrag app/c1.place (nur ergänzend, unter 2 KB)', () => {
    const r = placementResult(startRun([{ id: 'a', topic: 't', chapter: 1, level: 'B2', fmt: 'mc' }], 1));
    const e = placeEntry(r, '2026-10-07', [3400, 3900]);
    expect(e.vw).toEqual([3400, 3900]);
    expect(placeEntry(r, '2026-10-07').vw).toBeUndefined();
    expect(JSON.stringify(e).length).toBeLessThan(2048);
  });
});

describe('Wertung in der Einstufung', () => {
  const ROOT = join(process.cwd(), 'src/content/c1x/src');
  const files = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(d, e.name)) : e.name.endsWith('.json') ? [join(d, e.name)] : []));
  const place = files(ROOT).flatMap((p) => c1File.parse(JSON.parse(readFileSync(p, 'utf8'))).items).filter((i) => i.pool === 'place');
  it('jede Lösung zählt richtig, jede falsche Fassung falsch (alle Aufgaben des Vorrats)', () => {
    expect(place.length).toBeGreaterThan(0);
    for (const it of place) {
      for (const s of solutionsOf(it)) expect(placementRight(it, s), `${it.id} Lösung`).toBe(true);
      for (const w of wrongsOf(it)) expect(placementRight(it, w), `${it.id} falsch`).toBe(false);
    }
  });
});
