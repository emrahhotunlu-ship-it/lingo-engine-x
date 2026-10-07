// err (Fehler finden), P17: Wertung als Eigenschaft über alle err-Aufgaben, Eingabeform, Messwerte.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { c1File } from '../../src/domain/c1x/schema';
import { errRange } from '../../src/domain/c1x/kinds/err';
import { errRates } from '../../src/domain/c1x/errRates';
import { scoreC1 } from '../../src/domain/c1x/score';
import type { C1Item, Err } from '../../src/domain/c1x/types';
import { errMode, FIX_MAX_WORDS } from '../../src/features/c1x/kinds/Err';

const ROOT = join(process.cwd(), 'src/content/c1x/src');
const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.json') ? [join(d, e.name)] : []));
const items: Err[] = [];
for (const p of walk(ROOT)) {
  const r = c1File.safeParse(JSON.parse(readFileSync(p, 'utf8')));
  if (r.success) for (const it of r.data.items as C1Item[]) if (it.kind === 'err') items.push(it);
}
const withErr = items.filter((i) => i.bad);
const clean = items.filter((i) => !i.bad);

describe('err: Wertung über alle Aufgaben', () => {
  it('Bestand: 25–35 % fehlerfreie Sätze (ab 20 Aufgaben)', () => {
    expect(items.length).toBeGreaterThanOrEqual(20);
    const share = clean.length / items.length;
    expect(share).toBeGreaterThanOrEqual(0.25);
    expect(share).toBeLessThanOrEqual(0.35);
  });

  it('Fundort + Korrektur = 2 von 2, nur Fundort = 1 von 2', () => {
    for (const it of withErr) {
      const r = errRange(it);
      expect(r, it.id).not.toBeNull();
      const at = (r as [number, number])[0];
      const full = scoreC1(it, { kind: 'err', tap: at, fix: it.bad?.fix[0] ?? '', typed: true });
      expect(full.got, it.id).toBe(2);
      const loc = scoreC1(it, { kind: 'err', tap: at });
      expect(loc.got, it.id).toBe(1);
    }
  });

  it('falsches Wort = 0, „Kein Fehler“ bei einem Fehler = 0 mit `missed`', () => {
    for (const it of withErr.slice(0, 60)) {
      const r = errRange(it) as [number, number];
      const words = it.text.split(/\s+/).length;
      const other = r[0] > 0 ? 0 : Math.min(words - 1, r[1] + 1);
      if (other >= r[0] && other <= r[1]) continue;
      expect(scoreC1(it, { kind: 'err', tap: other, fix: it.bad?.fix[0] ?? '', typed: true }).got, it.id).toBe(0);
      const s = scoreC1(it, { kind: 'err', tap: 'none' });
      expect(s.got).toBe(0);
      expect(s.reason).toBe('missed');
    }
  });

  it('fehlerfreier Satz: „Kein Fehler“ = 2 von 2, jedes angetippte Wort = 0 mit `falseAlarm`', () => {
    for (const it of clean) {
      expect(scoreC1(it, { kind: 'err', tap: 'none' }).got, it.id).toBe(2);
      const s = scoreC1(it, { kind: 'err', tap: 1 });
      expect(s.got, it.id).toBe(0);
      expect(s.reason).toBe('falseAlarm');
    }
  });

  it('jeder Chip-Satz hat genau eine richtige Korrektur unter den drei Chips', () => {
    for (const it of withErr) {
      const c = it.bad?.choices;
      if (!c) continue;
      const ok = c.filter((x) => it.bad?.fix.some((f) => f.trim().toLowerCase() === x.trim().toLowerCase()));
      expect(ok, it.id).toHaveLength(1);
    }
  });
});

describe('err: Eingabeform', () => {
  it('Laptop tippt; Handy bis p 0,7 Chips, darüber Korrektur ≤ 3 Wörter getippt; ohne Chips immer getippt', () => {
    expect(errMode('desk', 0.2, true)).toBe('desk');
    expect(errMode('touch', 0.5, true)).toBe('tap');
    expect(errMode('touch', 0.7, true)).toBe('tap');
    expect(errMode('touch', 0.71, true)).toBe('tapfix');
    expect(errMode('touch', 0.3, false)).toBe('tapfix');
    expect(FIX_MAX_WORDS).toBe(3);
  });
});

describe('err: Messwerte je Muster', () => {
  it('Trefferquote und Fehlalarmquote', () => {
    const e = withErr[0] as Err;
    const c = clean[0] as Err;
    const byId = new Map<string, C1Item>([[e.id, e], [c.id, c]]);
    const rows = errRates(
      [
        { c1k: 'err', cid: e.id, pat: 'x.p', pts: [2, 2] },
        { c1k: 'err', cid: e.id, pat: 'x.p', pts: [0, 2] },
        { c1k: 'err', cid: c.id, pat: 'x.p', pts: [2, 2] },
        { c1k: 'err', cid: c.id, pat: 'x.p', pts: [0, 2] },
        { c1k: 'kwt', cid: 'kwt-1', pat: 'x.p', pts: [2, 2] },
      ],
      (id) => byId.get(id) ?? null,
    );
    expect(rows).toEqual([{ pat: 'x.p', found: 1, withError: 2, hit: 0.5, falseAlarms: 1, clean: 2, falseAlarm: 0.5 }]);
  });
});
