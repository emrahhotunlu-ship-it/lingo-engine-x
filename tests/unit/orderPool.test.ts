import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { orderPool, orderPoolSize, poolNorm, segment } from '../../src/domain/drills/orderPool';

// Fester Satzbau-Pool (Emrah 02.10.2026): jeder Eintrag muss den Lader überleben, seine Bausteine müssen genau zum
// Satz und zu jeder zweiten gültigen Reihenfolge passen, und die Inhalte müssen den Beratungs-Vorgaben entsprechen
// (deutsche Bedeutung, Warum-Zeile, Tonlage-Klammer bei Abschwächung/Höflichkeit, kein gerades Anführungszeichen).

type Raw = { topic: string; en: string; de: string; chunks: string[]; alt?: string[]; single?: string; why: [string, string]; bad?: string };
const raw = (JSON.parse(readFileSync('src/content/c1/order.json', 'utf8')) as { items: Raw[] }).items;
const words = (s: string) => s.split(/\s+/).filter(Boolean);
/** Deutsche Zitate in „…“ / “…” aus einem englischen Text nehmen, bevor die Sprache geprüft wird. */
const withoutQuotes = (s: string) => s.replace(/[“„][^”“]*[”“]/g, ' ');

describe('Satzbau-Pool', () => {
  it('genug Sätze, und keiner fällt beim Laden weg', () => {
    expect(raw.length).toBeGreaterThanOrEqual(48);
    expect(orderPoolSize()).toBe(raw.length);
    expect(orderPool().map((e) => e.en)).toEqual(raw.map((e) => e.en.trim()));
  });

  it('mindestens fünf Themen mit je mindestens vier Sätzen', () => {
    const per = new Map<string, number>();
    for (const e of raw) per.set(e.topic, (per.get(e.topic) ?? 0) + 1);
    expect([...per.values()].filter((n) => n >= 4).length).toBeGreaterThanOrEqual(5);
    // c1-Themen und die Grammatikthemen mit Muster (Lernplattform 2.0 §3.6).
    for (const topic of per.keys()) expect(topic).toMatch(/^(c1-[a-z]+|past-simple-perfect|mixed-cond|time-clauses|cond-alt)$/);
  });

  it('keine Dubletten', () => {
    expect(new Set(raw.map((e) => poolNorm(e.en))).size).toBe(raw.length);
    expect(new Set(raw.map((e) => poolNorm(e.de))).size).toBe(raw.length);
  });

  it('Bausteine: 5 bis 9, höchstens 5 Wörter, keine Satzzeichen, jeder Satz geht genau darin auf', () => {
    for (const e of raw) {
      expect(e.chunks.length, e.en).toBeGreaterThanOrEqual(5);
      expect(e.chunks.length, e.en).toBeLessThanOrEqual(9);
      for (const c of e.chunks) {
        expect(words(c).length, `${e.en} → ${c}`).toBeLessThanOrEqual(5);
        expect(c, `${e.en} → ${c}`).not.toMatch(/[.,;:!?"]/);
      }
      expect(segment(e.en, e.chunks), e.en).not.toBeNull();
    }
  });

  it('genau eines von alt/single; jede zweite Reihenfolge geht mit denselben Bausteinen auf und ist wirklich anders', () => {
    for (const e of raw) {
      const alt = e.alt ?? [];
      const single = (e.single ?? '').trim();
      expect(alt.length > 0 !== single.length > 0, e.en).toBe(true);
      if (single) expect(single.length, e.en).toBeGreaterThanOrEqual(15);
      for (const a of alt) {
        expect(segment(a, e.chunks), `${e.en} → ${a}`).not.toBeNull();
        expect(poolNorm(a), `${e.en} → ${a}`).not.toBe(poolNorm(e.en));
      }
      expect(new Set(alt.map(poolNorm)).size, e.en).toBe(alt.length);
    }
  });

  it('deutsche Bedeutung: 4–18 Wörter, mit Satzzeichen am Ende, Tonlage in Klammern bei Abschwächung und Höflichkeit', () => {
    for (const e of raw) {
      expect(words(e.de).length, e.de).toBeGreaterThanOrEqual(4);
      expect(words(e.de).length, e.de).toBeLessThanOrEqual(18);
      expect(e.de, e.de).toMatch(/[.?!)]$/);
      if (e.topic === 'c1-hedging' || e.topic === 'c1-diplomacy') expect(e.de, e.de).toMatch(/\([^)]+\)/);
    }
  });

  it('Warum-Zeile: Deutsch und Englisch vorhanden, in der richtigen Sprache, gerade Anführungszeichen nirgends', () => {
    for (const e of raw) {
      const [de, en] = e.why;
      expect(de.trim().length, e.en).toBeGreaterThan(20);
      expect(en.trim().length, e.en).toBeGreaterThan(20);
      expect(de, e.en).toMatch(/\b(der|die|das|und|ist|wird|im|ein|eine|nicht|wie|mit|zu|den|dem|steht|stehen)\b/);
      expect(withoutQuotes(en), e.en).not.toMatch(/\b(und|der|die|das|ist|nicht|steht|wird)\b/);
      for (const s of [e.de, de, en, e.bad ?? '']) expect(s, e.en).not.toContain('"');
    }
  });

  it('typische Fehlfassung (bad) ist weder die Lösung noch eine gültige Umstellung', () => {
    for (const e of raw) {
      if (!e.bad) continue;
      expect(poolNorm(e.bad), e.en).not.toBe(poolNorm(e.en));
      for (const a of e.alt ?? []) expect(poolNorm(e.bad), e.en).not.toBe(poolNorm(a));
    }
  });

  it('US-Schreibweise: keine britischen Formen und kein „offer“ für ein Preisangebot', () => {
    const all = raw.flatMap((e) => [e.en, ...(e.alt ?? [])]).join(' ');
    expect(all).not.toMatch(/\b(colour|organis|realis|programme|centre|licence|cheque|whilst|learnt)\w*/i);
    expect(all).not.toMatch(/\b(the|your|our|signed) offer\b/i);
  });
});
