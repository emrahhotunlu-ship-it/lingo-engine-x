import { describe, expect, it } from 'vitest';
import { oneSentence, sentenceSpans, sentencesOf, tidySentence, usableSentences, type Sent } from '../../../src/modules/vocab/domain/card';
import { cardOf } from '../../../src/modules/vocab/domain/flow';
import { applyAnswer, emptyLex, introduce, type PlanCtx } from '../../../src/modules/vocab/domain/planner';
import type { Task } from '../../../src/modules/vocab/domain/session';
import { DEFAULT_CFG, type Lex } from '../../../src/modules/vocab/domain/types';

// Live-Kommentar 23.11.2026 (Wörter-Wiederholung `vocab/strip`): „Schlechte Aufgabe wieder viel Text für ein Wort“. Die Lücke zeigte den
// Lese-Ausschnitt aus `ex`, obwohl `xEx` drei kurze geprüfte Sätze hat. Jetzt: nur der eine Satz der Fundstelle, und kurze ganze Sätze zuerst.

const T0 = Date.parse('2026-11-23T12:00:00Z');
const D = 86_400_000;
const ctx = (over: Partial<PlanCtx> = {}): PlanCtx => ({ cfg: DEFAULT_CFG, path: 'vocab/strip', planned: true, load: () => 0, siblings: new Set(), ...over });
function learned(t: number): Lex {
  let l = introduce(emptyLex('w', 'core', t), t);
  l = applyAnswer(l, { t: t + 60_000, form: 'gap_hint', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx()).lex;
  l = applyAnswer(l, { t: t + 300_000, form: 'gap', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx()).lex;
  return { ...l, sn: [['a', '2026-11-10']] };
}

const EXCERPT =
  '…real production file turned out to be ten times larger, which is why the metadata [stripping] went undetected. We take full responsibility for that, and in a second window we…';
const XEX = [
  'Before we share the report with the client, we should strip all hidden metadata from the files.',
  'The new tool strips personal data from every upload automatically.',
  'Please strip the formatting before you paste the text into the template.',
];
const doc = { word: 'to strip', de: 'entfernen', pos: 'verb', ex: EXCERPT, xEx: XEX.map((en) => ({ en, t: T0 - 30 * D })) };

describe('Lücke: immer ein kurzer ganzer Satz, nie ein Lese-Ausschnitt', () => {
  it('der strip-Fall: Ausschnitt in ex + kurze xEx-Sätze → nur xEx-Sätze', () => {
    const { ok } = usableSentences(sentencesOf(doc, T0, null), 'to strip', false);
    expect(ok.map((x) => x.sent.en)).toEqual(XEX);
    expect(ok.every((x) => !x.sent.en.includes('…'))).toBe(true);
  });

  it('Karte (gap, gap_hint, listen, meaning, flip, Einführung) zeigt nie den Ausschnitt', () => {
    const lex = learned(T0 - 20 * D);
    const base: Task = { path: 'vocab/strip', form: 'gap', step: 0, intro: false, planned: true, why: 'due', sent: 's', cue: false };
    for (const t of [base, { ...base, form: 'gap_hint' }, { ...base, form: 'listen' }, { ...base, form: 'meaning' }, { ...base, form: 'flip' }, { ...base, intro: true }] as Task[]) {
      const m = cardOf({ task: t, doc, lex, teach: {}, nowMs: T0, sbGate: null });
      if (!m?.sentence) continue;
      expect(XEX).toContain(m.sentence.sent.en);
    }
    const gap = cardOf({ task: base, doc, lex, teach: {}, nowMs: T0, sbGate: null })!;
    expect(gap.mode).toBe('gap');
    expect(XEX).toContain(gap.sentence!.sent.en);
    expect(gap.sentence!.sent.en.split(/\s+/).length).toBeLessThanOrEqual(22);
  });

  it('Wechsel je Lerntag bleibt deterministisch', () => {
    const lex = learned(T0 - 20 * D);
    const task: Task = { path: 'vocab/strip', form: 'gap', step: 0, intro: false, planned: true, why: 'due', sent: 's', cue: false };
    const a = cardOf({ task, doc, lex, teach: {}, nowMs: T0, sbGate: null })!.sentence!.sent.key;
    const b = cardOf({ task, doc, lex, teach: {}, nowMs: T0 + 60_000, sbGate: null })!.sentence!.sent.key;
    expect(a).toBe(b);
  });

  it('ohne andere Sätze: nur der gekürzte Einzelsatz mit der Fundstelle (nie der ganze Ausschnitt)', () => {
    const { ok } = usableSentences(sentencesOf({ ...doc, xEx: [] }, T0, null), 'to strip', false);
    expect(ok).toHaveLength(1);
    expect(ok[0]!.sent.key).toBe('a');
    expect(ok[0]!.sent.en).toBe('…real production file turned out to be ten times larger, which is why the metadata stripping went undetected.');
    expect(ok[0]!.gap.answer).toBe('stripping');
    expect(ok[0]!.sent.de).toBeNull();
  });

  it('oneSentence ohne Markierung nimmt den Satz mit dem Stichwort; Lage der Markierung stimmt nach dem Kürzen', () => {
    const s: Sent = { key: 'h1', en: 'Sales were flat. The board will grant the budget. Nobody objected.', de: 'x', src: 'wx' };
    expect(oneSentence(s, 'grant', false).en).toBe('The board will grant the budget.');
    const [m] = sentencesOf({ ex: 'Sales were flat. The board will [grant] the budget.' }, T0, null);
    const one = oneSentence(m!, 'grant', false);
    expect(one.en.slice(one.mark![0], one.mark![1])).toBe('grant');
  });

  it('Satzgrenzen: keine Schnitte nach Abkürzungen, Initialen oder „…“', () => {
    const cut = (t: string) => sentenceSpans(t).map(([a, b]) => t.slice(a, b));
    expect(cut('Mr. Smith met Dr. Jones at noon. They agreed.')).toEqual(['Mr. Smith met Dr. Jones at noon.', 'They agreed.']);
    expect(cut('Use a tool, e.g. The Stripper, for this. J. Smith did.')).toEqual(['Use a tool, e.g. The Stripper, for this.', 'J. Smith did.']);
    expect(cut('We waited… Then it worked!')).toEqual(['We waited… Then it worked!']);
    expect(cut('“Really?” She laughed.')).toEqual(['“Really?”', 'She laughed.']);
  });

  it('tidySentence erkennt Fragmente: klein begonnen, ohne Satzende', () => {
    expect(tidySentence('which is why the metadata stripping went undetected.')).toBe(false);
    expect(tidySentence('The metadata stripping went undetected')).toBe(false);
    expect(tidySentence('“We strip the data first,” she said.')).toBe(true);
  });
});
