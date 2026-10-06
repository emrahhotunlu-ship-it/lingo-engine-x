import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { atlasEntries, bandOf, type AtlasEntry } from '../../src/domain/atlas/atlas';

// Lernplattform 2.0, P3: Atlas bereinigt. Nichts gelöscht, Offensichtliches korrigiert, Zweifelhaftes markiert.

const file = JSON.parse(readFileSync('src/content/atlas/atlas.json', 'utf8')) as { items: AtlasEntry[] };
const base = JSON.parse(readFileSync('tests/fixtures/lp2-p3-base.json', 'utf8')) as { atlas: Record<string, string>; atlasCount: number };
const meta = JSON.parse(readFileSync('src/content/atlas/meta.json', 'utf8')) as { atlas: number; pack: number };
const h = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 12);

const BRIT_SPELL = /\b(colour|honour|favour|behaviour|neighbour|labour|humour|rumour|flavour|(?:(?:organis|realis)(?:e|ed|es|ing|ation)\b|recognis|apologis|emphasis)(?:e|ed|es|ing|ation|ations)\b|centre|theatre|metre|litre|fibre|programmes?\b|cheque|tyre|kerb|grey|aluminium|jewellery|defence|licence|ageing|sceptic\w*|travell\w+|cancelled|labelled|modelling|whilst|amongst|analys(?:e[sd]?|ing)|computerised|demoralising|artefacts?|judgement)\w*/i;
const BRIT_LEX = /\b(telly|lorry|lorries|petrol|dustbin|bonnet|pavement|motorway|nappy|fortnight|bloke|blokes|quid|mum|crisps|rubbish)\b/i;

describe('Atlas', () => {
  it('nichts gelöscht: gleiche Zahl, Stichwort, Definition, Übersetzung und Rang unverändert', () => {
    expect(file.items.length).toBe(base.atlasCount);
    for (const e of file.items) expect(h([e.w, e.g, e.xd, e.r]), e.w).toBe(base.atlas[e.w]);
  });
  it('meta.json = tatsächliche Zahl sichtbarer Einträge und Paketgröße', () => {
    expect(meta.atlas).toBe(atlasEntries().length);
    expect(meta.pack).toBe((JSON.parse(readFileSync('src/content/c1/pack.json', 'utf8')) as { items: unknown[] }).items.length);
  });
  it('keine britischen Schreibweisen in Stichwort oder Beispielsatz sichtbarer Einträge; britische Wörter nur mit exWeak', () => {
    for (const e of atlasEntries()) {
      expect(BRIT_SPELL.test(e.w), e.w).toBe(false);
      expect(BRIT_SPELL.test(e.x), `${e.w}: ${e.x}`).toBe(false);
      if (BRIT_LEX.test(e.x)) expect(e.exWeak, `${e.w}: ${e.x}`).toBe(1);
    }
  });
  it('kein Datenmüll in der deutschen Bedeutung (englische Brocken wie „introduction of the euro“)', () => {
    const euro = atlasEntries().find((e) => e.w === 'euro');
    expect(euro?.d).toBe('Euro');
    for (const e of atlasEntries()) {
      for (const piece of e.d.split(',').slice(1)) {
        const words = piece.trim().split(/\s+/);
        expect(/\b(introduction of|I feel|should be)\b/.test(piece), `${e.w}: ${piece}`).toBe(false);
        expect(words.length > 2 && /^[a-z' ]+$/.test(piece.trim()) && /\b(the|of|for|to|in)\b/.test(piece) && !/\b(der|die|das|den|dem|ein|eine|im|zu|zur|mit|von|sich|auf|aus|bei|nach|vor|um)\b/.test(piece), `${e.w}: ${piece}`).toBe(false);
      }
    }
  });
  it('Wortart passt zur Definition (kein „verb“ mit „a/an/the …“, kein „noun“ mit „to …“)', () => {
    for (const e of atlasEntries()) {
      const g = e.g.replace(/^[( ]+/, '').toLowerCase();
      if (e.p === 'verb') expect(/^(a|an|the) /.test(g), `${e.w}: ${e.g}`).toBe(false);
      if (e.p === 'noun') expect(/^to /.test(g), `${e.w}: ${e.g}`).toBe(false);
    }
  });
  it('jeans, lighter, euro sind Grundwortschatz bzw. in keinem C1-Band', () => {
    for (const w of ['jeans', 'lighter', 'euro']) {
      const e = atlasEntries().find((x) => x.w === w);
      expect(e, w).toBeTruthy();
      expect(bandOf(e as AtlasEntry) !== 'c1', w).toBe(true);
      expect((e as AtlasEntry).basic, w).toBe(1);
    }
  });
  it('Markierungen sind nur 1 und kommen vor', () => {
    let weak = 0;
    let basic = 0;
    for (const e of file.items) {
      for (const k of ['hidden', 'basic', 'exWeak'] as const) expect([undefined, 1]).toContain(e[k]);
      if (e.exWeak) weak++;
      if (e.basic) basic++;
    }
    expect(weak).toBeGreaterThan(100);
    expect(basic).toBeGreaterThan(100);
    expect(file.items.filter((e) => e.hidden).map((e) => e.w)).toContain('travelled');
  });
});
