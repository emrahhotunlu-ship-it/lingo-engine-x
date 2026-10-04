import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Entfernungs-Audit (Umbau „Fokus Wörter und Grammatik“, Gesamtkonzept Kap. 6): Die entfallenen
// Bereiche sind weg und kommen nicht zurück. Daten bleiben (`src/data/**` ist ausgenommen).

const ROOT = join(__dirname, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const FILES = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'tests'))].filter((f) => !f.includes('/src/data/') && !f.endsWith('removalAudit.test.ts') && !f.endsWith('/src/domain/plan/retire.ts'));
const read = (f: string): string => readFileSync(f, 'utf-8');

// Ordner, die es nicht mehr geben darf (features/ und domain/).
const GONE = ['input', 'read', 'listen', 'discover', 'write', 'business', 'pron', 'inbox', 'fluency', 'meeting', 'tones', 'say', 'compare'];

describe('Entfernungs-Audit', () => {
  it('keine Ordner der entfallenen Bereiche', () => {
    const found: string[] = [];
    for (const layer of ['features', 'domain']) for (const g of GONE) if (existsDir(join(ROOT, 'src', layer, g))) found.push(`${layer}/${g}`);
    expect(found).toEqual([]);
  });

  it('keine Importe aus gelöschten Ordnern', () => {
    const re = new RegExp(`from '[^']*/(features|domain)/(${GONE.join('|')})(/[^']*)?'`);
    const hits = FILES.filter((f) => re.test(read(f))).map((f) => f.replace(ROOT, ''));
    expect(hits).toEqual([]);
  });

  it('keine Routen der entfallenen Bildschirme', () => {
    const re = /name: '(library|discover|history|read|listen|write|mail|pitch|say|fluency|tones|meeting|playbook|sptask|inbox|pron|compare|listenDialog|inputUnit|discoverItem)'/;
    const hits = FILES.filter((f) => f.includes('/src/') && re.test(read(f))).map((f) => f.replace(ROOT, ''));
    expect(hits).toEqual([]);
  });
});

function existsDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}
