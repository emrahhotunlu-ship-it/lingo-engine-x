import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Neubau (docs/neubau/architektur.md §2.8, R2): Die Texte stehen in Teilen (`src/i18n/parts/*`),
// (fx.*.ts setzt nur die Teile fxo/fxl/fxr zusammen und ist ausgenommen) die `de.ts`/`en.ts` per Spread zusammensetzen. Spreads überschreiben still – deshalb darf kein
// Schlüssel in zwei Teilen stehen. Die Neubau-Teile (`nb*`) tragen nur Schlüssel mit eigenem Präfix.

const DIR = new URL('../../src/i18n/parts/', import.meta.url);

async function parts(lang: 'de' | 'en'): Promise<Array<{ file: string; keys: string[] }>> {
  const files = readdirSync(DIR).filter((f) => f.endsWith(`.${lang}.ts`)).sort();
  const out: Array<{ file: string; keys: string[] }> = [];
  for (const file of files) {
    const mod = (await import(new URL(file, DIR).href)) as Record<string, unknown>;
    const keys = Object.values(mod).flatMap((v) => (v && typeof v === 'object' ? Object.keys(v) : []));
    out.push({ file, keys });
  }
  return out;
}

describe('i18n-Teile', () => {
  for (const lang of ['de', 'en'] as const) {
    it(`kein Schlüssel steht in zwei Teilen (${lang})`, async () => {
      const seen = new Map<string, string>();
      const dupes: string[] = [];
      for (const p of (await parts(lang)).filter((x) => !x.file.startsWith('fx.'))) {
        for (const k of p.keys) {
          const prev = seen.get(k);
          if (prev) dupes.push(`${k}: ${prev} und ${p.file}`);
          else seen.set(k, p.file);
        }
      }
      expect(dupes).toEqual([]);
    });

    it(`Neubau-Teile tragen nur Schlüssel mit eigenem Präfix (${lang})`, async () => {
      const all = await parts(lang);
      const nb = all.filter((p) => p.file.startsWith('nb'));
      expect(nb.map((p) => p.file.split('.')[0]).sort()).toEqual(['nbHeute', 'nbLernen', 'nbProfil', 'nbSh', 'nbSprechen', 'nbTraining', 'nbWs']);
      for (const p of nb) {
        const prefix = p.file.split('.')[0] ?? '';
        for (const k of p.keys) expect(k.startsWith(prefix), `${p.file}: ${k}`).toBe(true);
      }
    });
  }

  // Lernplattform 2.0 (docs/umbau/lernplattform-2.md §10.0/§10.3): fünf Teile je Paket, nur Schlüssel mit eigenem Präfix.
  for (const lang of ['de', 'en'] as const) {
    it(`Teile ex, gx, wx, hx, fx tragen nur Schlüssel mit eigenem Präfix (${lang})`, async () => {
      const all = await parts(lang);
      const lp = all.filter((p) => ['ex', 'gx', 'wx', 'hx', 'fx'].includes(p.file.split('.')[0] ?? ''));
      expect(lp.map((p) => p.file.split('.')[0]).sort()).toEqual(['ex', 'fx', 'gx', 'hx', 'wx']);
      for (const p of lp) {
        const prefix = p.file.split('.')[0] ?? '';
        for (const k of p.keys) expect(k.startsWith(prefix), `${p.file}: ${k}`).toBe(true);
      }
    });
  }

  it('jeder Teil ist in de.ts bzw. en.ts eingebunden', async () => {
    const { de } = await import('../../src/i18n/de');
    const { en } = await import('../../src/i18n/en');
    for (const p of await parts('de')) for (const k of p.keys) expect(de, `${p.file}: ${k}`).toHaveProperty(k);
    for (const p of await parts('en')) for (const k of p.keys) expect(en, `${p.file}: ${k}`).toHaveProperty(k);
  });
});

// Lernplattform 3.0 (docs/umbau/lernplattform-3.md §10.0 Nr. 6): Teile unter `parts/lp3/`, Präfix je Bereich, per Glob eingesammelt.
describe('i18n-Teile Lernplattform 3.0 (parts/lp3)', () => {
  const LP3 = new URL('../../src/i18n/parts/lp3/', import.meta.url);
  const PREFIXES = ['cx', 'px', 'tt', 'mo', 'ee'];

  async function lp3Parts(lang: 'de' | 'en'): Promise<Array<{ file: string; keys: string[] }>> {
    const out: Array<{ file: string; keys: string[] }> = [];
    for (const file of readdirSync(LP3).filter((f) => f.endsWith(`.${lang}.ts`)).sort()) {
      const mod = (await import(new URL(file, LP3).href)) as Record<string, unknown>;
      out.push({ file, keys: Object.values(mod).flatMap((v) => (v && typeof v === 'object' ? Object.keys(v) : [])) });
    }
    return out;
  }

  for (const lang of ['de', 'en'] as const) {
    it(`jede Datei trägt nur Schlüssel mit einem Bereichspräfix, kein Schlüssel doppelt, auch nicht gegen die anderen Teile (${lang})`, async () => {
      const others = new Set((await parts(lang)).flatMap((p) => p.keys));
      const seen = new Map<string, string>();
      const problems: string[] = [];
      for (const p of await lp3Parts(lang)) {
        for (const k of p.keys) {
          if (!PREFIXES.some((x) => k.startsWith(x))) problems.push(`${p.file}: ${k} ohne Präfix`);
          if (others.has(k)) problems.push(`${p.file}: ${k} steht auch in den alten Teilen`);
          const prev = seen.get(k);
          if (prev) problems.push(`${k}: ${prev} und ${p.file}`);
          else seen.set(k, p.file);
        }
      }
      expect(problems).toEqual([]);
    });

    it(`alle Schlüssel sind in de.ts und en.ts eingebunden (${lang})`, async () => {
      const { de } = await import('../../src/i18n/de');
      const { en } = await import('../../src/i18n/en');
      for (const p of await lp3Parts(lang)) for (const k of p.keys) expect(lang === 'de' ? de : en, `${p.file}: ${k}`).toHaveProperty(k);
    });
  }

  it('Deutsch und Englisch haben dieselben Schlüssel je Datei, und jedes verwendete `cx…`-Literal im Code gibt es', async () => {
    const de = new Map((await lp3Parts('de')).map((p) => [p.file.replace('.de.ts', ''), p.keys.sort()]));
    const en = new Map((await lp3Parts('en')).map((p) => [p.file.replace('.en.ts', ''), p.keys.sort()]));
    expect([...de.keys()].sort()).toEqual([...en.keys()].sort());
    for (const [file, keys] of de) expect(en.get(file), file).toEqual(keys);
    const known = new Set([...de.values()].flat());
    const walk = (d: string, out: string[] = []): string[] => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.tsx?$/.test(n) && !p.includes('/i18n/')) out.push(p);
      }
      return out;
    };
    const missing: string[] = [];
    for (const f of walk(join(process.cwd(), 'src'))) {
      for (const m of readFileSync(f, 'utf8').matchAll(/\bt\(\s*'(cx[A-Za-z0-9_]+)'/g)) if (!known.has(m[1] as string)) missing.push(`${f}: ${m[1]}`);
    }
    expect(missing).toEqual([]);
  });
});
