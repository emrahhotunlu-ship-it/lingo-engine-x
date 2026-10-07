// Feste Mischung der Auswahlarten (mcc-Optionen, err-Chips): Im Inhalt steht die Lösung in einem festen Kreis (mcc 0,1,2,3,2,0,3,1 …, err 0,1,2 …).
// Angezeigt wird gemischt mit Startwert Aufgaben-ID + Lerntag: gleichmäßig verteilt, stabil je Tag, Buchung nach Inhalt statt Position.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { givenOf } from '../../src/domain/c1x/book';
import { mccMuted } from '../../src/domain/c1x/kinds/mcc';
import { errChipOrder, mccOrder, mixOrder, shownOptions } from '../../src/domain/c1x/mix';
import { c1File } from '../../src/domain/c1x/schema';
import { scoreC1 } from '../../src/domain/c1x/score';
import type { C1Item, Err, Mcc } from '../../src/domain/c1x/types';

function load<K extends C1Item['kind']>(dir: string, kind: K): Extract<C1Item, { kind: K }>[] {
  const root = join(process.cwd(), 'src/content/c1x/src', dir);
  const out: Extract<C1Item, { kind: K }>[] = [];
  for (const f of readdirSync(root).filter((n) => n.endsWith('.json'))) {
    const r = c1File.safeParse(JSON.parse(readFileSync(join(root, f), 'utf8')));
    if (r.success) for (const it of r.data.items as C1Item[]) if (it.kind === kind) out.push(it as Extract<C1Item, { kind: K }>);
  }
  return out;
}

const mcc: Mcc[] = load('mcc', 'mcc');
const err: Err[] = load('err', 'err').filter((i) => i.bad?.choices);
const DAYS = ['2026-10-07', '2026-10-08', '2026-10-09', '2026-11-20'];
const low = (s: string): string => s.trim().toLowerCase();
const rightChip = (it: Err): string => it.bad?.choices?.find((c) => it.bad?.fix.some((f) => low(f) === low(c))) ?? '';

describe('mixOrder', () => {
  it('ist eine Permutation und bei gleichem Startwert gleich', () => {
    for (let k = 0; k < 200; k++) {
      const o = mixOrder(4, `x-${k}`);
      expect([...o].sort()).toEqual([0, 1, 2, 3]);
      expect(mixOrder(4, `x-${k}`)).toEqual(o);
    }
  });

  it('verteilt über viele IDs gleichmäßig (je Platz 25 % ± 3)', () => {
    const n = 4000;
    const hits = [0, 0, 0, 0];
    for (let k = 0; k < n; k++) {
      const o = mixOrder(4, `mcc-mix|mcc-${k}|2026-10-07`);
      hits[o.indexOf(0)] = (hits[o.indexOf(0)] ?? 0) + 1;
    }
    for (const h of hits) expect(Math.abs(h / n - 0.25)).toBeLessThan(0.03);
  });
});

describe('mcc: Anzeige gemischt', () => {
  it('der Bestand hat den festen Kreis (Anlass); die angezeigte Lösungsposition folgt ihm nicht mehr', () => {
    expect(mcc.length).toBeGreaterThanOrEqual(100);
    const raw = mcc.map((i) => i.answer).join('');
    expect(raw).toMatch(/(01232031)+/);
    for (const day of DAYS) {
      const shown = mcc.map((i) => mccOrder(i, day).indexOf(i.answer));
      for (let p = 0; p < 4; p++) {
        const share = shown.filter((x) => x === p).length / shown.length;
        expect(share, `${day}/Platz ${p}`).toBeGreaterThan(0.15);
        expect(share, `${day}/Platz ${p}`).toBeLessThan(0.35);
      }
      // Kein fester Kreis mehr: die angezeigte Position stimmt nicht durchgehend mit der im Inhalt überein.
      expect(shown.filter((x, k) => x === mcc[k]?.answer).length / shown.length).toBeLessThan(0.4);
    }
  });

  it('stabil je Tag (Neu-Zeichnen würfelt nicht), am nächsten Tag für die meisten Aufgaben anders', () => {
    let same = 0;
    for (const it of mcc) {
      expect(mccOrder(it, DAYS[0] ?? '')).toEqual(mccOrder(it, DAYS[0] ?? ''));
      if (mccOrder(it, DAYS[0] ?? '').join() === mccOrder(it, DAYS[1] ?? '').join()) same++;
    }
    expect(same / mcc.length).toBeLessThan(0.2);
  });

  it('Buchung nach Inhalt: Wahl an angezeigter Position i meldet order[i]; richtig genau bei der Lösung', () => {
    for (const day of DAYS)
      for (const it of mcc) {
        const order = mccOrder(it, day);
        const shown = shownOptions(it, day) ?? [];
        for (let i = 0; i < 4; i++) {
          const r = { kind: 'mcc' as const, pick: order[i] ?? -1 };
          expect(givenOf(it, r)).toBe(shown[i]);
          expect(scoreC1(it, r).verdict === 'correct', `${it.id}/${day}/${i}`).toBe(shown[i] === it.options[it.answer]);
        }
      }
  });

  it('Hinweis 2 graut angezeigt nie die Lösung und nie die gewählte Option aus', () => {
    for (const it of mcc) {
      const order = mccOrder(it, DAYS[0] ?? '');
      for (let chosen = 0; chosen < 4; chosen++) {
        const muted = order.indexOf(mccMuted(it, order[chosen] ?? null));
        expect(muted).toBeGreaterThanOrEqual(0);
        expect(muted).not.toBe(order.indexOf(it.answer));
        if (order[chosen] !== it.answer) expect(muted).not.toBe(chosen);
      }
    }
  });
});

describe('err: Korrektur-Chips gemischt', () => {
  it('der Bestand hat den festen Kreis 0,1,2 (Anlass); angezeigt je Platz 20–47 %', () => {
    expect(err.length).toBeGreaterThanOrEqual(60);
    for (const day of DAYS) {
      const pos = err.map((i) => (shownOptions(i, day) ?? []).indexOf(rightChip(i)));
      expect(pos.every((p) => p >= 0)).toBe(true);
      for (let p = 0; p < 3; p++) {
        const share = pos.filter((x) => x === p).length / pos.length;
        expect(share, `${day}/Platz ${p}`).toBeGreaterThan(0.2);
        expect(share, `${day}/Platz ${p}`).toBeLessThan(0.47);
      }
    }
  });

  it('stabil je Tag; der gemeldete Chip-Text wird nach Inhalt gewertet', () => {
    for (const it of err) {
      expect(errChipOrder(it, DAYS[0] ?? '')).toEqual(errChipOrder(it, DAYS[0] ?? ''));
      const shown = shownOptions(it, DAYS[0] ?? '') ?? [];
      expect([...shown].sort()).toEqual([...(it.bad?.choices ?? [])].sort());
    }
  });
});
