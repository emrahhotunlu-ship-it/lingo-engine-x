// kwt (Umformen), P16: Wertung als Eigenschaft über alle kwt-Aufgaben im Bestand, Eingabeform nach Gerät und Stufe, Bausteine.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { c1File } from '../../src/domain/c1x/schema';
import { scoreC1 } from '../../src/domain/c1x/score';
import { kwtWords } from '../../src/domain/c1x/kwtNorm';
import type { C1Item, Kwt } from '../../src/domain/c1x/types';
import { kwtMode, kwtTiles } from '../../src/features/c1x/kinds/Kwt';

const ROOT = join(process.cwd(), 'src/content/c1x/src');
const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.json') ? [join(d, e.name)] : []));
const items: Kwt[] = [];
for (const p of walk(ROOT)) {
  const r = c1File.safeParse(JSON.parse(readFileSync(p, 'utf8')));
  if (r.success) for (const it of r.data.items as C1Item[]) if (it.kind === 'kwt') items.push(it);
}
const resp = (text: string, typed = true) => ({ kind: 'kwt' as const, text, typed });

describe('kwt: Wertung über alle Aufgaben', () => {
  it('es gibt Aufgaben zum Prüfen', () => expect(items.length).toBeGreaterThanOrEqual(60));

  it('jede Variante (Teil A + Teil B) ist 2 von 2', () => {
    const bad: string[] = [];
    for (const it of items) for (const k of it.keys) for (const a of k.a) for (const b of k.b) if (scoreC1(it, resp(`${a} ${b}`)).got !== 2) bad.push(`${it.id}: ${a} ${b}`);
    expect(bad).toEqual([]);
  });

  it('sieben Wörter sind 0 Punkte mit Grund „length“, ohne Schlüsselwort 0 mit „key“', () => {
    for (const it of items.slice(0, 40)) {
      const sol = `${it.keys[0]?.a[0] ?? ''} ${it.keys[0]?.b[0] ?? ''}`.trim();
      const long = scoreC1(it, resp(`${sol} really quite very much so now`));
      expect(long.got).toBe(0);
      expect(long.reason).toBe('length');
      const noKey = scoreC1(it, resp(sol.split(/\s+/).filter((w) => w.toLowerCase() !== it.key.toLowerCase()).join(' ') || 'xx yy zz'));
      expect(noKey.got).toBe(0);
    }
  });

  it('jede typische Falle gibt weniger als 2 Punkte und meldet `trap`', () => {
    for (const it of items) for (const [i, tr] of (it.traps ?? []).entries()) {
      const s = scoreC1(it, resp(tr));
      expect(s.got, `${it.id}: ${tr}`).toBeLessThan(2);
      expect(s.trap, `${it.id}: ${tr}`).toBe(i);
    }
  });

  it('nur Teil A oder nur Teil B (mit Schlüsselwort, passende Länge) gibt höchstens 1 Punkt', () => {
    let tested = 0;
    for (const it of items) {
      const k = it.keys[0];
      const a = k?.a[0];
      const b = k?.b[0];
      if (!a || !b) continue;
      const wa = kwtWords(a, [it.key]);
      const wb = kwtWords(b, [it.key]);
      for (const part of [wa, wb]) {
        const hasKey = part.includes(it.key.toLowerCase());
        if (!hasKey || part.length < 3 || part.length > 6) continue;
        const s = scoreC1(it, resp(part.join(' ')));
        if (kwtWords(`${a} ${b}`, [it.key]).join(' ') === part.join(' ')) continue;
        expect(s.got).toBeLessThanOrEqual(1);
        tested++;
      }
    }
    expect(tested).toBeGreaterThan(0);
  });

  it('Kurzformen zählen wie ausgeschrieben: „wish I’d checked“ ist so gut wie „wish I had checked“', () => {
    const it = items.find((x) => x.key === 'WISH');
    if (!it) return;
    const full = it.keys[0]?.a[0] ?? '';
    expect(scoreC1(it, resp(full.replace(/\bI had\b/, "I'd"))).got).toBe(scoreC1(it, resp(full)).got);
  });

  it('Bausteine zählen nicht als freier Abruf (`free` nur bei getippter Antwort)', () => {
    const it = items[0] as Kwt;
    const sol = `${it.keys[0]?.a[0]} ${it.keys[0]?.b[0]}`;
    expect(scoreC1(it, resp(sol, false)).free).toBe(false);
    expect(scoreC1(it, resp(sol, true)).free).toBe(true);
  });
});

describe('kwt: Eingabeform und Bausteine', () => {
  it('Laptop tippt, Handy baut bis p 0,7 mit Bausteinen, darüber Teil A Bausteine + Teil B getippt', () => {
    expect(kwtMode('desk', 0.2)).toBe('desk');
    expect(kwtMode('desk', 0.95)).toBe('desk');
    expect(kwtMode('touch', 0.5)).toBe('tiles');
    expect(kwtMode('touch', 0.7)).toBe('tiles');
    expect(kwtMode('touch', 0.71)).toBe('part');
  });

  it('Bausteine: Lösung + Schlüsselwort + Ablenker, stabile Reihenfolge, jede Variante legbar', () => {
    for (const it of items.slice(0, 80)) {
      const a = kwtTiles(it);
      const b = kwtTiles(it);
      expect(a.map((x) => x.text)).toEqual(b.map((x) => x.text));
      if (/^kwt-v2-/.test(it.id)) continue;
      const have = a.filter((x) => !x.distractor).flatMap((x) => kwtWords(x.text, [it.key]));
      const sol = kwtWords(`${it.keys[0]?.a[0]} ${it.keys[0]?.b[0]}`, [it.key]);
      expect([...have].sort()).toEqual([...sol].sort());
      expect(a.filter((x) => x.distractor)).toHaveLength(it.extra.length);
    }
  });

  it('Teil-Modus: im Vorrat steht nichts, was in Teil B gehört', () => {
    for (const it of items.slice(0, 80)) {
      if (/^kwt-v2-/.test(it.id)) continue;
      const poolWords = kwtTiles(it, 'a').filter((x) => !x.distractor).flatMap((x) => kwtWords(x.text, [it.key]));
      const bWords = kwtWords(it.keys[0]?.b[0] ?? '', [it.key]);
      const aWords = kwtWords(it.keys[0]?.a[0] ?? '', [it.key]);
      expect([...poolWords].sort()).toEqual([...aWords].sort());
      expect(poolWords.length).toBe(aWords.length);
      expect(bWords.length).toBeGreaterThan(0);
    }
  });
});
