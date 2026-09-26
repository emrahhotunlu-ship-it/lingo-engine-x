import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import vocabJson from '../../src/content/legacy/vocab.json';
import { hasIpa, ipaOf } from '../../src/domain/lexicon/pron';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DICT_KEYS = Object.keys(JSON.parse(readFileSync(join(ROOT, 'src/content/legacy/dict.json'), 'utf8')) as object);

describe('ipaOf: amerikanische Lautschrift', () => {
  it('deckt mindestens 98 % der Einzelwörter aus dict.json ab', () => {
    const single = DICT_KEYS.filter((k) => !k.includes(' '));
    const missing = single.filter((k) => ipaOf(k) === null);
    expect(single.length).toBeGreaterThan(4000);
    expect(1 - missing.length / single.length).toBeGreaterThanOrEqual(0.98);
  });

  it('kennt alle Wörter der Startvokabeln', () => {
    const words = vocabJson.seedVocab.flatMap((s) => s.w.replace(/^to\s+/, '').split(/\s+/));
    expect(words.filter((w) => ipaOf(w) === null)).toEqual([]);
  });

  it('setzt die Betonung vor den Silbenanfang (Soll-Werte aus dem Entwurf)', () => {
    expect(ipaOf('reliable')).toBe('rɪˈlaɪəbəl');
    expect(ipaOf('procurement')).toBe('proʊˈkjʊrmənt');
    expect(ipaOf('compliance')).toBe('kəmˈplaɪəns');
    expect(ipaOf('tomato')).toBe('təˈmeɪtoʊ');
    expect(ipaOf('stakeholder')).toBe('ˈsteɪkˌhoʊldɚ');
    expect(ipaOf('negotiate')).toBe('nəˈɡoʊʃieɪt');
    expect(ipaOf('interrupt')).toBe('ˌɪntəˈrʌpt');
    expect(ipaOf('expect')).toBe('ɪkˈspɛkt');
  });

  it('spricht amerikanisch aus', () => {
    expect(ipaOf('schedule')).toBe('ˈskɛdʒʊl'); // nicht britisch ˈʃɛdjuːl
    expect(ipaOf('data')).toBe('ˈdeɪtə');
    expect(ipaOf('route')).toBe('rut');
    expect(ipaOf('either')).toBe('ˈiðɚ');
    expect(ipaOf('better')).toBe('ˈbɛtɚ'); // r-Färbung
    expect(ipaOf('the')).toBe('ðə');
    expect(ipaOf('negotiate')).toContain('ɡ'); // IPA-ɡ, nicht g
    expect(ipaOf('negotiate')).not.toContain('g');
  });

  it('kennt britische und amerikanische Schreibweise', () => {
    expect(ipaOf('analyse')).toBe(ipaOf('analyze'));
    expect(ipaOf('colour')).toBe(ipaOf('color'));
    expect(ipaOf('organised')).toBe(ipaOf('organized'));
    expect(ipaOf('centre')).toBe('ˈsɛntɚ');
  });

  it('setzt Wendungen und Bindestrich-Wörter aus Teilen zusammen', () => {
    expect(ipaOf('carry out')).toBe('ˈkæri aʊt');
    expect(ipaOf('to rely on')).toBe(`${ipaOf('rely')} ${ipaOf('on')}`);
    expect(ipaOf('self-employed')).toBe(`${ipaOf('self')} ${ipaOf('employed')}`);
    expect(ipaOf('Don’t')).toBe('doʊnt');
    expect(ipaOf('xyzzy')).toBeNull();
    expect(ipaOf('carry xyzzy')).toBeNull();
    expect(ipaOf('')).toBeNull();
    expect(ipaOf('__proto__')).toBeNull();
    expect(ipaOf('hasOwnProperty')).toBeNull();
  });

  it('hasIpa kennt nur belegte Wörter', () => {
    expect(hasIpa('on')).toBe(true);
    expect(hasIpa('colours')).toBe(true);
    expect(hasIpa('occured')).toBe(false);
  });
});

describe('scripts/build-pron.mjs', () => {
  it('erzeugt zweimal dieselbe Datei, identisch mit der eingecheckten', { timeout: 60_000 }, () => {
    const dir = mkdtempSync(join(tmpdir(), 'lx-pron-'));
    try {
      const run = (name: string) => {
        const out = join(dir, name);
        execFileSync(process.execPath, ['scripts/build-pron.mjs', '--out', out, '--quiet'], { cwd: ROOT, stdio: 'pipe' });
        return readFileSync(out, 'utf8');
      };
      const a = run('a.json');
      const b = run('b.json');
      expect(a).toBe(b);
      expect(a).toBe(readFileSync(join(ROOT, 'src/content/pron/us-ipa.json'), 'utf8'));
      const parsed = JSON.parse(a) as Record<string, string>;
      const keys = Object.keys(parsed);
      expect(keys).toEqual([...keys].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
