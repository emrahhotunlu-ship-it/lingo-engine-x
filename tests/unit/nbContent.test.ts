import { describe, expect, it } from 'vitest';
import grammarJson from '../../src/content/legacy/grammar.json';
import c1Json from '../../src/content/c1/toolkit.json';
import { FLUENCY_QUESTIONS } from '../../src/content/fluency/questions';
import { THEMES, THEME_ORDER } from '../../src/content/nb/themes';
import { TRAPS } from '../../src/content/nb/traps';
import { themeSchema, trapSchema } from '../../src/content/nb/schemas';

// Inhalte von `content/nb` gegen ihre Schemas (Plan §4.8): Anzahl, keine leeren Felder, IDs eindeutig,
// US-Schreibweise (Stichproben), Verweise gültig.

/** Britische Schreibweisen, die in US-Texten nicht vorkommen dürfen (Stichprobe). */
const UK_RE =
  /\b(?:colour|favour|behaviour|honour|labour|neighbour|centre|metre|theatre|licence|defence|offence|programme|catalogue|analyse|analysed|analysing|organis\w*|realis\w*|prioritis\w*|optimis\w*|recognis\w*|minimis\w*|maximis\w*|summaris\w*|standardis\w*|digitalis\w*|digitis\w*|apologis\w*|emphasis(?:e|ed|es|ing)|travelled|travelling|cancelled|cancelling|modelling|labelled|enrol|fulfil|judgement|cheque|tyre|grey|whilst|amongst|learnt|spelt|practise[ds]?|towards|afterwards|kerb|aluminium|mum|lorry)\b/i;

/** Alle englischen Texte eines Inhalts (Schlüssel en, def, wrong, right, …) einsammeln. */
function englishStrings(v: unknown, key = ''): string[] {
  if (typeof v === 'string') return ['de', 'title_de', 'hidden_de'].includes(key) ? [] : [v];
  if (Array.isArray(v)) return v.flatMap((x) => englishStrings(x, key));
  if (v && typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) => (k === 'de' ? [] : englishStrings(x, k)));
  }
  return [];
}

const GRAMMAR_IDS = new Set<string>([
  ...(grammarJson as { topics: { id: string }[] }).topics.map((t) => t.id),
  ...(c1Json as { topics: { id: string }[] }).topics.map((t) => t.id),
]);

describe('content/nb: Themen', () => {
  it('16 Themen, Schema, IDs t01…t16 eindeutig, Reihenfolge laut lehrer.md', () => {
    expect(THEMES).toHaveLength(16);
    for (const t of THEMES) expect(themeSchema.safeParse(t).success, t.id).toBe(true);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(16);
    expect(THEMES.map((t) => t.n)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(THEME_ORDER.map((id) => THEMES.find((t) => t.id === id)?.n)).toEqual([1, 2, 13, 3, 4, 14, 5, 6, 12, 7, 8, 15, 9, 10, 16, 11]);
    expect(new Set(THEME_ORDER).size).toBe(16);
  });
  it('Verweise: Werkzeug = vorhandene Grammatik-ID, Falle = Startsatz-ID, Frage A vorhanden, Szene b01…b16', () => {
    const traps = new Set(TRAPS.map((t) => t.id));
    const questions = new Set(FLUENCY_QUESTIONS.map((q) => q.id));
    for (const t of THEMES) {
      expect(GRAMMAR_IDS.has(t.tool), `${t.id} tool ${t.tool}`).toBe(true);
      expect(traps.has(t.trap), `${t.id} trap ${t.trap}`).toBe(true);
      expect(questions.has(t.fluencyQ), `${t.id} fluencyQ ${t.fluencyQ}`).toBe(true);
      expect(t.scene).toBe(`b${t.id.slice(1)}`);
    }
    expect(THEMES.filter((t) => t.kind === 'job')).toHaveLength(11);
    expect(THEMES.filter((t) => t.kind === 'bridge')).toHaveLength(1);
    expect(THEMES.filter((t) => t.kind === 'life')).toHaveLength(4);
  });
  it('US-Schreibweise in allen englischen Texten', () => {
    for (const s of englishStrings(THEMES)) expect(UK_RE.test(s), s).toBe(false);
  });
});

describe('content/nb: Fallen-Startsatz', () => {
  it('25 Fallen, Schema, IDs f01…f25, 3 Übungssätze', () => {
    expect(TRAPS).toHaveLength(25);
    expect(TRAPS.map((t) => t.id)).toEqual(Array.from({ length: 25 }, (_, i) => `f${String(i + 1).padStart(2, '0')}`));
    for (const t of TRAPS) expect(trapSchema.safeParse(t).success, t.id).toBe(true);
  });
  it('Erkennung kompiliert, mindestens 23 von 25 Fallen sind im Text erkennbar', () => {
    for (const t of TRAPS) for (const d of t.detect) expect(() => new RegExp(d, 'giu')).not.toThrow();
    expect(TRAPS.filter((t) => t.detect.length > 0).length).toBeGreaterThanOrEqual(23);
  });
  it('Lösungen in US-Schreibweise, falsche und richtige Fassung unterscheiden sich', () => {
    for (const t of TRAPS) {
      expect(t.wrong).not.toBe(t.right);
      for (const s of [t.right, ...t.drills.flatMap((d) => d.right), t.why.en, t.hint.en]) expect(UK_RE.test(s), s).toBe(false);
      for (const d of t.drills) expect(d.right).not.toContain(d.wrong);
    }
  });
});
