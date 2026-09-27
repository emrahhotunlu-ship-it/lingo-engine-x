import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Neubau (docs/neubau/architektur.md §2.8, R2): Die Texte stehen in Teilen (`src/i18n/parts/*`),
// die `de.ts`/`en.ts` per Spread zusammensetzen. Spreads überschreiben still – deshalb darf kein
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
      for (const p of await parts(lang)) {
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
      expect(nb.map((p) => p.file.split('.')[0]).sort()).toEqual(['nbHeute', 'nbLernen', 'nbLesen', 'nbProfil', 'nbSh', 'nbSprechen', 'nbTraining', 'nbWs']);
      for (const p of nb) {
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
