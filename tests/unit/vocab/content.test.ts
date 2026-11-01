import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { britishSpelling } from '../../../src/domain/text/british';
import { CHARGE1, CHARGE2, CHARGE3, CONFUSABLE, GR_FORMS_ON, LEX_INFO, MISSPELL, reviewCovers, TRAP_KIND } from '../../../src/modules/vocab/content';
import { checkAnswer } from '../../../src/modules/vocab/domain/check';
import { toUSText } from '../../../src/domain/text/british';

// Inhalts-Prüfer G0 für die Lehrer-Chargen 1–3 (arbeitsweise.md §4 Nr. 1): Schema, Pflichtfelder, Schlüssel, US-Schreibweise, Doppel,
// Prüfdurchgänge ≤ 40 und vollständig vom english-teacher abgedeckt.

const raw = (f: string) => JSON.parse(readFileSync(join(import.meta.dirname, '../../../src/modules/vocab/content', f), 'utf8')) as { review: { passes: { items: string }[] }; items: Record<string, unknown>[] };
const FILES = ['charge1-traps.json', 'charge2-business.json', 'charge3-gr.json'];
const target = (ex: string) => ex.match(/\[([^\]]+)\]/)?.[1] ?? '';

describe('Lehrer-Chargen: Schema und Prüfung', () => {
  it('alle drei Dateien bestehen das Schema', () => {
    expect(CHARGE1.errors).toEqual([]);
    expect(CHARGE2.errors).toEqual([]);
    expect(CHARGE3.errors).toEqual([]);
  });
  it.each(FILES)('%s: 100 % vom english-teacher geprüft, je Durchgang ≤ 40 Einträge', (f) => {
    const d = raw(f);
    expect(reviewCovers(d.review, d.items.length)).toBe(true);
    for (const p of d.review.passes) {
      const [a, b] = p.items.split('-').map(Number) as [number, number];
      expect(b - a + 1, p.items).toBeLessThanOrEqual(40);
    }
  });
  it('M78–M81 sind frei, weil Charge 3 vollständig geprüft ist', () => {
    expect(GR_FORMS_ON).toBe(true);
  });
  it('reviewCovers erkennt Lücken', () => {
    expect(reviewCovers({ passes: [{ items: '1-40' }, { items: '42-80' }] }, 80)).toBe(false);
    expect(reviewCovers({ passes: [{ items: '1-40' }] }, 80)).toBe(false);
  });
});

describe('Lehrer-Chargen: Inhalt', () => {
  const all = [...CHARGE1.items, ...CHARGE2.items];
  it('eindeutige ids; keine Doppel zwischen den Chargen und zu src/content/c1/pack.json', () => {
    const ids = all.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    const pack = JSON.parse(readFileSync(join(import.meta.dirname, '../../../src/content/c1/pack.json'), 'utf8')) as { items: { en: string }[] };
    const n = (s: string) => s.toLowerCase().replace(/[-\s]+/g, ' ').trim();
    const packEn = new Set(pack.items.map((x) => n(x.en)));
    for (const b of CHARGE2.items) expect(packEn.has(n(b.en)), b.id).toBe(false);
    const c3 = CHARGE3.items.map((x) => x.src);
    expect(new Set(c3).size).toBe(c3.length);
  });
  it('US-Schreibweise in en, ex, syn, evade, gr (britisch nur in uk)', () => {
    for (const x of all) {
      for (const s of [x.en, x.ex, ...(x.syn ?? []), ...(x.evade ?? []), ...(x.gr?.var ?? []), x.gr?.pat ?? '']) expect(britishSpelling(s), `${x.id}: ${s}`).toBeNull();
    }
    for (const e of CHARGE3.items) for (const s of [e.head, ...(e.gr?.var ?? []), e.gr?.pat ?? '']) expect(britishSpelling(s), `${e.src}: ${s}`).toBeNull();
  });
  it('Lösung im Satz ist nicht zugleich Synonym, Ausweichwort oder Fehlform (der Schlüssel widerspricht sich nicht)', () => {
    for (const x of all) {
      const t = target(x.ex).toLowerCase();
      for (const l of [x.syn, x.evade, 'wrong' in x ? (x.wrong) : undefined]) expect((l ?? []).map((s) => s.toLowerCase()), x.id).not.toContain(t);
    }
  });
  it('Paare nennen sich gegenseitig; falsche Freunde haben Falle und gemeinte Bedeutung', () => {
    const byEn = new Map(CHARGE1.items.map((t) => [t.en.toLowerCase(), t]));
    for (const t of CHARGE1.items.filter((x) => x.type === 'pair')) {
      const p = byEn.get(t.pair!.toLowerCase());
      expect(p, t.id).toBeDefined();
      expect(p!.pair!.toLowerCase(), t.id).toBe(t.en.toLowerCase());
    }
    expect(TRAP_KIND.get('eventually')).toBe('ff');
    expect(CONFUSABLE.get('affect')).toContain('effect');
  });
  it('die Auswertung erkennt die Fehlformen der Charge 1 (Schlüssel existiert)', () => {
    const dict = { isWord: () => false, misspell: MISSPELL, confusable: CONFUSABLE, toUS: toUSText };
    for (const t of CHARGE1.items.filter((x) => x.type === 'spell')) {
      const ans = target(t.ex);
      for (const w of t.wrong ?? []) if (!w.includes(' ') && !ans.includes(' ')) expect(checkAnswer(w, { answer: ans, k: t.k }, dict).outcome, `${t.id}: ${w}`).not.toBe('ok');
    }
    for (const t of CHARGE1.items.filter((x) => x.type === 'uncount')) {
      const ans = target(t.ex);
      expect(checkAnswer(`${ans}s`, { answer: ans, k: t.k, uncount: true }, dict).outcome, t.id).toBe('plural');
    }
    // Kurzform und Langform gelten gleich (`I'd argue` = `I would argue`): dann ist das Synonym schon die Lösung selbst.
    for (const t of all) for (const s of t.syn ?? []) expect(['syn', 'ok'], `${t.id}: ${s}`).toContain(checkAnswer(s, { answer: target(t.ex), k: t.k, syn: t.syn }, dict).outcome);
  });
  it('Charge 3 deckt jedes Bestands-Lexem ab (40 Startwörter + 443 Paket-Einträge)', () => {
    expect(CHARGE3.items.length).toBe(483);
    expect(LEX_INFO.get('rely on')?.k).toBe('pv');
    expect(LEX_INFO.get('rely on')?.gr?.sep).toBe(0);
  });
});
