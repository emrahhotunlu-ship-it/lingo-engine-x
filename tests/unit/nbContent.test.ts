import { describe, expect, it } from 'vitest';
import grammarJson from '../../src/content/legacy/grammar.json';
import c1Json from '../../src/content/c1/toolkit.json';
import { FLUENCY_QUESTIONS } from '../../src/content/fluency/questions';
import { THEMES, THEME_ORDER } from '../../src/content/nb/themes';
import { TRAPS } from '../../src/content/nb/traps';
import { themeSchema, trapSchema } from '../../src/content/nb/schemas';
import { bizScenes, collocations, inboxFor, inboxMails, objections, objectionsFor, sceneById, themeTextFor, themeTexts, transforms } from '../../src/content/nb/load';
import { normText, phraseCore } from '../../src/domain/week';

// Inhalte von `content/nb` gegen ihre Schemas (Plan §4.8): Anzahl, keine leeren Felder, IDs eindeutig,
// US-Schreibweise (Stichproben), Verweise gültig.

/** Britische Schreibweisen, die in US-Texten nicht vorkommen dürfen (Stichprobe). */
const UK_RE =
  /\b(?:colour|favour|behaviour|honour|labour|neighbour|centre|metre|theatre|licence|defence|offence|programme|catalogue|analyse|analysed|analysing|(?:organ|real|priorit|optim|recogn|minim|maxim|summar|standard|digital|digit|apolog|emphas|critic|special|util|author|custom|visual|final|capital|central|categor|memor|mobil|modern|normal)is(?:e|ed|es|ing|ation|ations)|travelled|travelling|cancelled|cancelling|modelling|labelled|enrol|fulfil|judgement|cheque|tyre|grey|whilst|amongst|learnt|spelt|practise[ds]?|towards|afterwards|kerb|aluminium|mum|lorry)\b/i;

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

// ------------------------------------------------------------------ JSON-Inhalte (lazy geladen)

const has = (text: string, part: string): boolean => ` ${normText(text)} `.includes(` ${normText(part)} `);
const words = (s: string): number => s.split(/\s+/).filter(Boolean).length;
const uniq = (ids: readonly string[]): boolean => new Set(ids).size === ids.length;
const THEME_IDS = THEMES.map((t) => t.id);

describe('content/nb: Themen-Texte (Block 2, Prüfung S3)', () => {
  const list = themeTexts();
  it('16 Texte, je Thema einer, 150–250 Wörter', () => {
    expect(list).toHaveLength(16);
    expect(uniq(list.map((t) => t.id))).toBe(true);
    expect(list.map((t) => t.theme).sort()).toEqual([...THEME_IDS].sort());
    for (const t of list) {
      const n = words(t.text);
      expect(n, `${t.id}: ${n} Wörter`).toBeGreaterThanOrEqual(150);
      expect(n, `${t.id}: ${n} Wörter`).toBeLessThanOrEqual(250);
    }
  });
  it('mindestens 3 der 5 Wochenwendungen und das Werkzeug stehen im Text', () => {
    for (const t of list) {
      const theme = THEMES.find((x) => x.id === t.theme);
      const hits = (theme?.phrases ?? []).filter((p) => has(t.text, phraseCore(p.en)));
      expect(hits.length, `${t.id}: ${hits.map((h) => h.en).join(' | ')}`).toBeGreaterThanOrEqual(3);
      expect(has(t.text, t.toolIn), `${t.id} toolIn`).toBe(true);
    }
  });
  it('Merken, Nachsprechen und Belegstellen wörtlich im Text; Fragen mit Grund DE/EN', () => {
    for (const t of list) {
      for (const n of t.notice) expect(has(t.text, n), `${t.id} notice: ${n}`).toBe(true);
      for (const s of t.shadow) {
        expect(has(t.text, s), `${t.id} shadow: ${s}`).toBe(true);
        expect(s.length, `${t.id} Nachsprech-Satz zu lang für ein Sprachstück`).toBeLessThanOrEqual(150);
      }
      for (const q of [t.core, t.between]) {
        expect(has(t.text, q.quote), `${t.id} quote: ${q.quote}`).toBe(true);
        expect(q.answer).toBeLessThan(q.options.length);
        expect(uniq(q.options)).toBe(true);
      }
    }
  });
  it('themeTextFor findet den Text der Woche', () => {
    expect(themeTextFor('t03')?.id).toBe('x-t03');
    expect(themeTextFor('t99')).toBeNull();
  });
});

describe('content/nb: Kollokationen (W3)', () => {
  const list = collocations();
  it('40 Nomen, je 2–4 Verben mit Beispiel, typische Lehnübersetzung', () => {
    expect(list).toHaveLength(40);
    expect(uniq(list.map((c) => c.id))).toBe(true);
    expect(uniq(list.map((c) => c.noun))).toBe(true);
    for (const c of list) {
      const stem = normText(c.noun).slice(0, 5);
      for (const v of c.verbs) expect(normText(v.ex), `${c.id} ${v.v}`).toContain(stem);
      expect(c.wrong.phrase).not.toBe(c.wrong.right);
      expect(normText(c.wrong.phrase)).not.toBe(normText(c.wrong.right));
    }
  });
});

describe('content/nb: Umformungen (G3)', () => {
  const list = transforms();
  it('30 Aufgaben, eine Lücke, jede Lösung enthält das Schlüsselwort (2–6 Wörter)', () => {
    expect(list).toHaveLength(30);
    expect(uniq(list.map((u) => u.id))).toBe(true);
    for (const u of list) {
      expect(u.gap.split('___').length, u.id).toBe(2);
      for (const a of u.answers) {
        expect(has(a, u.key), `${u.id}: ${a}`).toBe(true);
        expect(words(a), `${u.id}: ${a}`).toBeGreaterThanOrEqual(2);
        expect(words(a), `${u.id}: ${a}`).toBeLessThanOrEqual(6);
      }
    }
  });
});

describe('content/nb: Einwände (I3)', () => {
  const list = objections();
  it('25 Einwände mit Musterantwort in 4 Schritten, die 5 Kernarten sind dabei', () => {
    expect(list).toHaveLength(25);
    expect(uniq(list.map((o) => o.id))).toBe(true);
    for (const kind of ['price', 'send-info', 'competitor', 'timing', 'security']) expect(list.some((o) => o.kind === kind), kind).toBe(true);
    for (const o of list) expect(THEME_IDS).toContain(o.theme);
    expect(objectionsFor('t03')).toHaveLength(5);
    expect(objectionsFor('t03')[0]?.theme).toBe('t03');
  });
});

describe('content/nb: Posteingang (L2)', () => {
  const list = inboxMails();
  it('16 Mails, je Thema eine, mit verstecktem Anliegen und Musterantwort', () => {
    expect(list).toHaveLength(16);
    expect(uniq(list.map((m) => m.id))).toBe(true);
    expect(list.map((m) => m.theme).sort()).toEqual([...THEME_IDS].sort());
    for (const m of list) {
      expect(words(m.body), m.id).toBeGreaterThanOrEqual(30);
      expect(words(m.reply), m.id).toBeGreaterThanOrEqual(60);
      expect(words(m.reply), m.id).toBeLessThanOrEqual(160);
    }
    expect(inboxFor('t07')?.id).toBe('m07');
  });
});

describe('content/nb: Business-Szenen (N70)', () => {
  const list = bizScenes();
  it('16 Szenen mit 3 Zielen und 3–5 Kriterien; Small Talk, Telefonat, Meeting leiten dabei', () => {
    expect(list.length).toBeGreaterThanOrEqual(12);
    expect(list.length).toBeLessThanOrEqual(16);
    expect(uniq(list.map((s) => s.id))).toBe(true);
    for (const kind of ['smalltalk', 'phone', 'meeting']) expect(list.some((s) => s.kind === kind), kind).toBe(true);
    for (const t of THEMES) expect(sceneById(t.scene)?.theme, t.id).toBe(t.id);
  });
});

describe('content/nb: US-Schreibweise in allen JSON-Inhalten', () => {
  it('keine britischen Schreibweisen in englischen Texten', () => {
    const all = [themeTexts(), collocations(), transforms(), objections(), inboxMails(), bizScenes()];
    for (const s of all.flatMap((x) => englishStrings(x))) expect(UK_RE.test(s), s).toBe(false);
  });
});
