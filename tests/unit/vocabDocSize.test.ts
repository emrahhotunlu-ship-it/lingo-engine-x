import { describe, expect, it } from 'vitest';
import seed from '../../seed/sample-data.json';
import { validateDoc } from '../../src/data/validate';

// Datenprüfer K7 (Wort-Lernen 2, 21.10.2026): dauerhafter Größentest für `vocab/<id>` mit allen Feldern im ungünstigsten Fall
// (12 Verlaufseinträge mit allen Zusatzfeldern inkl. Tipp `h` und falscher Eingabe `v`, Satzbank, Merkhilfe, Werkstatt-Stand `wk`, Pausenbeleg `lg`,
// Wortpartner `col`, KI-Beispiele, Erklärungen). Grenze laut Vertrag 256 KiB je Dokument; geprüft wird mit Reserve gegen 64 KiB.
// Dazu: falsch typisierte neue Felder (`wk`, `mnemo.own`) machen die Karte nicht ungültig (tolerant gelesen).

type Doc = Record<string, unknown>;
const B = (o: unknown): number => new TextEncoder().encode(JSON.stringify(o)).length;
/** 4 Byte je Zeichen (2 JS-Zeichen). */
const s4 = (n: number): string => '\u{1F600}'.repeat(n);
/** 2–3 Byte je Zeichen. */
const u3 = (n: number): string => 'ü€'.repeat(Math.ceil(n / 2)).slice(0, n);
const base = (): Doc => (seed as Record<string, Doc>)['vocab/encourage']!;

describe('vocab/<id>: Größe im ungünstigsten Fall', () => {
  it('alle Felder voll: gültig und deutlich unter der Dokumentgrenze', () => {
    const t = 1792500000000;
    const hist = Array.from({ length: 12 }, (_, i) => ({ t: t + i, m: 'produce', g: 1, x: 'act_combo', s: u3(40), a: u3(40), u: 1, ci: 1, h: 2, v: s4(20) }));
    const sb = Array.from({ length: 8 }, (_, i) => ({ en: u3(220), de: u3(300), sit: u3(40), k: 'work', src: 'ai', t: t + i, pv: u3(60), bad: 1 }));
    const col = Array.from({ length: 2 }, () => ({ p: u3(60), de: u3(60), gap: u3(30), opts: [u3(30), u3(30), u3(30)], ex: u3(200), ai: 1 }));
    const doc = {
      ...base(),
      intro: '2026-10-01',
      ff: '2026-10-22',
      lg: '2026-11-14',
      hist,
      sb,
      col,
      mnemo: { text: u3(240), lang: 'de', t, own: 1 },
      wk: { n: 99, t, d: '2026-10-21', p: 1 },
      axs: Array.from({ length: 3 }, () => ({ g: u3(300), y: u3(300), w: u3(300), ex: u3(300), sig: u3(100), cf: u3(100), alt: [u3(200), u3(200)], pv: u3(60), t, bad: 1 })),
      aiEx: Array.from({ length: 4 }, () => ({ en: u3(300), de: u3(300), sit: u3(40), t, pv: u3(60) })),
      exDe: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`k${i}`, u3(300)])),
    };
    expect(validateDoc('vocab/encourage', doc).ok).toBe(true);
    expect(B(doc)).toBeLessThan(64 * 1024);
  });

  it('alle Dokumente im Testdatensatz bleiben gültig', () => {
    const bad = Object.entries(seed as Record<string, Doc>)
      .filter(([k, d]) => !validateDoc(k, d).ok)
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });

  it('falsch typisierte neue Felder machen die Karte nicht ungültig', () => {
    expect(validateDoc('vocab/encourage', { ...base(), wk: 'x' }).ok).toBe(true);
    expect(validateDoc('vocab/encourage', { ...base(), mnemo: { text: 'a', lang: 'de', t: 1, own: 'yes' } }).ok).toBe(true);
    expect(validateDoc('vocab/encourage', { ...base(), lg: 42 }).ok).toBe(true);
  });
});
