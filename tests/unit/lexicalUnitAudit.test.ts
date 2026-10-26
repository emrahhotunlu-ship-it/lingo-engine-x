import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lexicalUnitWith, type UnitVerdict } from '../../src/domain/lexicon/unit';
import { unitDeps, type UnitSource } from '../../src/domain/lexicon/unitKnown';
import { CANNED_KEYWORDS } from '../../src/platform/dev/canned/readArticle';
import { goodRaw } from './read/fixtures';

// Audit „Wortgruppen ohne feste Einheit“ (card-quality.md): alle Wortgruppen, aus denen Karten werden können – C1-Paket, Wortpartner-
// Charge, Business-Suite, Startvokabeln, Hör-/Lesetexte und Feed der alten App, Wörterbuch, Seeds der Lese-Routinen, Beispieldaten,
// Test-Antworten. Nur Lesen und Zählen: die Prüffunktion sagt „prüfen“, nichts wird geändert. Jede Quelle belegt sich nicht selbst
// (`exclude`). Mit `AUDIT_OUT=<datei>` schreibt der Lauf den vollständigen Bericht.

const ROOT = join(import.meta.dirname, '../..');
const json = (rel: string): unknown => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));

const READ_SOURCES: ReadonlySet<string> = new Set(['seed/read-routine', 'seed/read-courses', 'seed/sample-data read', 'seed/sample-data vocab', 'dev/canned read', 'tests/read fixtures', 'legacy/feed-seed', 'legacy/passages']);

type Row = { source: string; phrase: string; v: UnitVerdict };

/** Strings unter einem der Schlüssel `keys` (optional nur unterhalb eines Elternschlüssels aus `under`). */
function collect(o: unknown, keys: readonly string[], under?: readonly string[], inside = !under): string[] {
  const out: string[] = [];
  if (Array.isArray(o)) for (const x of o) out.push(...collect(x, keys, under, inside));
  else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      const inHere = inside || (under?.includes(k) ?? false);
      if (inHere && keys.includes(k)) {
        if (typeof v === 'string') out.push(v);
        else if (Array.isArray(v)) out.push(...v.filter((x): x is string => typeof x === 'string'));
      }
      if (v && typeof v === 'object') out.push(...collect(v, keys, under, inHere));
    }
  }
  return out;
}

const isGroup = (s: string): boolean => {
  const t = s.trim();
  const n = t.split(/\s+/).length;
  return n >= 2 && n <= 8 && !/[.?!,;:]$/.test(t) && !/[äöüßÄÖÜ]/.test(t) && /^[A-Za-z]/.test(t);
};

function rows(): Row[] {
  const sources: Array<{ source: string; list: string[]; exclude?: UnitSource; noDict?: boolean }> = [];
  sources.push({ source: 'c1/pack', list: collect(json('src/content/c1/pack.json'), ['en', 'alt']), exclude: 'pack' });
  sources.push({ source: 'col/charge1', list: collect(json('src/content/col/charge1.json'), ['word', 'p']), exclude: 'col' });
  sources.push({ source: 'nb/collocations', list: collect(json('src/content/nb/collocations.json'), ['right']), exclude: 'nb' });
  sources.push({ source: 'nb/extras', list: collect(json('src/content/nb/extras.json'), ['phrasal']) });
  sources.push({ source: 'legacy/vocab', list: collect(json('src/content/legacy/vocab.json'), ['w', 'p']), exclude: 'legacy' });
  sources.push({ source: 'legacy/passages', list: collect(json('src/content/legacy/passages.json'), ['w']) });
  sources.push({ source: 'legacy/feed-seed', list: collect(json('src/content/legacy/feed-seed.json'), ['en'], ['chunks', 'taskChunks']) });
  sources.push({ source: 'legacy/dict', list: Object.keys(json('src/content/legacy/dict.json') as Record<string, unknown>), noDict: true });
  sources.push({ source: 'seed/read-routine', list: collect(json('seed/read-routine.json'), ['w'], ['keyWords']) });
  sources.push({ source: 'seed/read-courses', list: collect(json('seed/read-courses.json'), ['w'], ['phrases', 'keyWords']) });
  const sample = json('seed/sample-data.json') as Record<string, unknown>;
  sources.push({ source: 'seed/sample-data vocab', list: Object.entries(sample).filter(([k]) => k.startsWith('vocab/')).flatMap(([, v]) => collect(v, ['word'])) });
  sources.push({ source: 'seed/sample-data read', list: Object.entries(sample).filter(([k]) => k.startsWith('read/')).flatMap(([, v]) => collect(v, ['w'], ['keyWords', 'phrases'])) });
  sources.push({ source: 'dev/canned read', list: CANNED_KEYWORDS.map((k) => k.w) });
  sources.push({ source: 'tests/read fixtures', list: goodRaw().keyWords.map((k) => k.w) });

  const out: Row[] = [];
  for (const s of sources) {
    const deps = unitDeps(s.exclude);
    const d = s.noDict ? { ...deps, dictPhrase: () => false } : deps;
    for (const phrase of [...new Set(s.list.map((x) => x.trim()))].filter(isGroup)) out.push({ source: s.source, phrase, v: lexicalUnitWith(phrase, d) });
  }
  return out;
}

describe('Audit Wortgruppen ohne feste Einheit', () => {
  const all = rows();
  const flagged = all.filter((r) => r.v.verdict === 'check');

  it('findet die gemeldete Art (freie Gruppe aus einem Artikel) und lässt belegte Einheiten in Ruhe', () => {
    expect(all.length).toBeGreaterThan(800);
    expect(flagged.length).toBeGreaterThan(0);
    // Die Prüfung soll klar die Ausnahme sein, nicht die Regel (hohe Trefferquote vor Vollständigkeit).
    expect(flagged.length / all.length).toBeLessThan(0.15);
    // Kurs-Seed (Beispiel der Kurs-Routine, unverändert): Gruppen der Lehrer-Sperrliste werden gemeldet.
    expect(flagged.some((r) => r.source === 'seed/read-courses' && r.phrase === 'handle routine chores')).toBe(true);
    expect(all.find((r) => r.phrase === 'weak link')?.v.verdict).toBe('ok');
  });

  it('Gegenlesung 26.10.2026: die vier freien Artikel-Gruppen gelten nach dem Streichen aus units.json als „prüfen“', () => {
    const d = unitDeps();
    for (const p of ['plausible trajectory', 'adapt to unfamiliar hardware', 'hesitate to share', 'addresses the tension']) expect(lexicalUnitWith(p, d).verdict, p).toBe('check');
    // gestrichene Einträge belegen nichts mehr
    for (const p of ['spread on their own', 'hard to shut down', 'false sense of progress', 'company-wide rollout', 'different approach']) expect(lexicalUnitWith(p, d).verdict, p).toBe('check');
  });

  it('Lese-Routine-Seed und Test-Antwort der Lese-KI: jede mehrteilige Schlüsselwendung ist eine feste Einheit', () => {
    const bad = all.filter((r) => (r.source === 'seed/read-routine' || r.source === 'dev/canned read') && r.v.verdict === 'check');
    expect(bad.map((r) => r.phrase)).toEqual([]);
  });

  it('schreibt auf Wunsch den Bericht (AUDIT_OUT)', () => {
    const file = process.env.AUDIT_OUT;
    if (!file) return;
    const bySource = new Map<string, { n: number; check: number }>();
    for (const r of all) {
      const s = bySource.get(r.source) ?? { n: 0, check: 0 };
      s.n += 1;
      if (r.v.verdict === 'check') s.check += 1;
      bySource.set(r.source, s);
    }
    const lines = [
      `Wortgruppen geprüft: ${all.length}, davon „prüfen“: ${flagged.length}`,
      ...[...bySource].map(([k, s]) => `${k}: ${s.check} von ${s.n}`),
      '',
      ...flagged.map((r) => `${r.source} | ${r.phrase} | ${r.v.reason}${r.v.detail ? ` (${r.v.detail})` : ''}${r.v.better ? ` → ${r.v.better}` : ''}`),
      '',
      'Nur nach Regel ok, in keiner Quelle belegt (Artikel- und Kurs-Wendungen, zur Gegenlesung):',
      ...all.filter((r) => READ_SOURCES.has(r.source) && r.v.verdict === 'ok' && r.v.reason !== 'known' && r.v.reason !== 'single').map((r) => `${r.source} | ${r.phrase} | ${r.v.reason}`),
    ];
    writeFileSync(file, `${lines.join('\n')}\n`);
  });
});
