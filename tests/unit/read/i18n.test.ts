import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rdDe } from '../../../src/modules/read/i18n/rd.de';
import { rdEn } from '../../../src/modules/read/i18n/rd.en';
import { readMessages } from '../../../src/modules/read/registry';
import { de } from '../../../src/i18n/de';
import { en } from '../../../src/i18n/en';

// Texte des Lesen-Moduls (Plan §7): beide Sprachen gleich vollständig, Präfix `rd`, Platzhalter gleich, US-Englisch, jeder benutzte Schlüssel vorhanden.

const ROOT = join(import.meta.dirname, '../../..');
const keys = (o: object): string[] => Object.keys(o).sort();
const placeholders = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort();

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe('i18n des Lesen-Moduls', () => {
  it('beide Sprachen haben genau dieselben Schlüssel, alle mit Präfix rd, keiner leer', () => {
    expect(keys(rdEn)).toEqual(keys(rdDe));
    for (const k of keys(rdDe)) {
      expect(k.startsWith('rd'), k).toBe(true);
      expect((rdDe as Record<string, string>)[k]?.trim(), k).toBeTruthy();
      expect((rdEn as Record<string, string>)[k]?.trim(), k).toBeTruthy();
    }
  });

  it('Platzhalter stimmen in beiden Sprachen überein', () => {
    for (const k of keys(rdDe)) expect(placeholders((rdEn as Record<string, string>)[k] ?? ''), k).toEqual(placeholders((rdDe as Record<string, string>)[k] ?? ''));
    // Mehrzahl-Schlüssel kommen paarweise (_one/_other), sonst zeigt translatePlural den rohen Schlüssel.
    for (const k of keys(rdDe).filter((x) => x.endsWith('_one'))) expect(keys(rdDe), k).toContain(k.replace(/_one$/, '_other'));
  });

  it('Englisch ist amerikanisch und ohne deutsche Wörter; Deutsch ohne Fachwörter', () => {
    for (const [k, v] of Object.entries(rdEn)) {
      expect(v, k).not.toMatch(/[äöüß]/i);
      expect(v, k).not.toMatch(/\b(und|nicht|der|die|das|für|Artikel)\b/);
      expect(v, k).not.toMatch(/\b(colour|favourite|organise|centre|licence|cancelled)\b/i);
    }
    for (const [k, v] of Object.entries(rdDe)) expect(v, k).not.toMatch(/\b(Commit|Branch|Build|Lint|Seed|Token|Prompt|Cache|Schema)\b/);
  });

  it('die Texte sind im Rahmen angemeldet (Registry, de.ts, en.ts)', () => {
    expect(readMessages.de).toBe(rdDe);
    expect(readMessages.en).toBe(rdEn);
    for (const k of keys(rdDe)) {
      expect(de, k).toHaveProperty(k);
      expect(en, k).toHaveProperty(k);
    }
  });

  it('jeder in der Oberfläche benutzte rd-Schlüssel existiert (kein Text steht im Code)', () => {
    const used = new Set<string>();
    for (const f of [...files(join(ROOT, 'src/modules/read/ui')), join(ROOT, 'src/modules/read/index.ts'), join(ROOT, 'src/app/shell/tabs.ts')]) {
      for (const m of readFileSync(f, 'utf8').matchAll(/'(rd[A-Z][A-Za-z]*)'/g)) used.add(m[1] ?? '');
    }
    expect(used.size).toBeGreaterThan(30);
    for (const k of used) expect(keys(rdDe).includes(k) || keys(rdDe).includes(`${k}_one`), k).toBe(true);
  });

  it('kein freier deutscher oder englischer Satz in den Oberflächen-Dateien (Texte nur über t())', () => {
    for (const f of files(join(ROOT, 'src/modules/read/ui'))) {
      const text = readFileSync(f, 'utf8').split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
      // JSX-Text zwischen Tags, der Buchstaben enthält (ohne {…}-Ausdrücke)
      const bare = [...text.matchAll(/>\s*([A-Za-zÄÖÜäöüß][^<>{}\n]{3,})\s*</g)].map((m) => m[1] ?? '');
      expect(bare, f).toEqual([]);
    }
  });
});
