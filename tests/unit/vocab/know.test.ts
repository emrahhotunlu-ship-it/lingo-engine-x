import { describe, expect, it } from 'vitest';
import { acceptKnow, knowPatch, knowRecent, needsKnow, type KnowCard } from '../../../src/modules/vocab/domain/know';
import { KNOW_EXAMPLE, wordKnow } from '../../../src/modules/vocab/prompts/know';
import { fillKnow, knowOrder } from '../../../src/modules/vocab/ui/know';
import { wordKnowReply } from '../../../src/platform/dev/canned/vocab';
import type { VocabAi } from '../../../src/modules/vocab/aiPort';

// Großpaket W2 „Wörter-Wissen“ (docs/umbau/wissen/plan.md, Emrah 05.11.2026): Prüfung vor dem Speichern, nur ergänzend speichern, Reihenfolge, Lauf.

const T = Date.UTC(2026, 10, 5, 12);
const card = (over: Partial<KnowCard> = {}): KnowCard => ({ id: 'w1', head: 'objection', pv: false, wrong: [], known: [], ...over });
type Doc = Record<string, unknown>;
const GOOD = { en: 'The CFO raised one objection about the hosting costs in our call.', de: 'Der CFO äußerte im Gespräch einen Einwand zu den Hosting-Kosten.', sit: 'client call' };

describe('acceptKnow', () => {
  it('die Beispielantwort im Prompt: Wortpartner bestehen; ihre Sätze gelten als abgeschrieben (Lehrer-Prüfung: nie die Vorlage übernehmen)', () => {
    const raw = (JSON.parse(KNOW_EXAMPLE) as { items: unknown[] }).items[0];
    const a = acceptKnow(raw, card({ de: 'Einwand', pos: 'noun' }), T, 'word-know@1');
    expect(a.col.map((c) => c.p)).toEqual(['raise an objection', 'anticipate an objection', 'overcome an objection']);
    expect(a.sb).toEqual([]);
    expect(a.rejected).toEqual(['copy', 'copy']);
  });

  it('eigene Sätze bestehen: Herkunft ai, Art work, Version, Zeit', () => {
    const a = acceptKnow({ id: 'w1', sents: [GOOD] }, card({ de: 'Einwand', pos: 'noun' }), T, 'word-know@1');
    expect(a.sb).toHaveLength(1);
    expect(a.sb.every((s) => s.src === 'ai' && s.k === 'work' && s.pv === 'word-know@1' && s.t === T)).toBe(true);
  });

  it('Lehrer-Regeln: Bedeutungswechsel (Nomen), Klammer mit Fremdwörtern, Präposition mit Platzhalter einmal erlaubt, Bindestrich', () => {
    const sense = acceptKnow({ id: 'w1', sents: [{ en: 'We need to keep our retention policy simple for small clients.', de: 'Wir müssen unsere Aufbewahrungsrichtlinie möglichst einfach halten.' }] }, card({ head: 'retention', de: 'Kundenbindung', pos: 'noun' }), T, 'pv');
    expect(sense.rejected).toEqual(['sent_sense']);
    const verb = acceptKnow({ id: 'w1', sents: [{ en: 'I assume the IT lead has already tested the new interface.', de: 'Ich gehe davon aus, dass der IT-Leiter die Schnittstelle getestet hat.' }] }, card({ head: 'assume', de: 'annehmen', pos: 'verb' }), T, 'pv');
    expect(verb.sb).toHaveLength(1);
    const col = acceptKnow(
      {
        id: 'w1',
        col: [
          { p: 'require attention', de: 'Aufmerksamkeit erfordern', ex: 'These tickets [require immediate attention] today.' },
          { p: 'complain about sth', de: 'sich über etw. beschweren', ex: 'Several users [complained about the] slow search today.' },
          { p: 'object to sth', de: 'gegen etw. Einwände haben', ex: 'The CFO may [object to] the license costs today.' },
        ],
      },
      card({ head: 'complain' }),
      T,
      'pv',
    );
    expect(col.col.map((c) => c.p)).toEqual(['complain about sth']);
    expect(col.rejected).toEqual(expect.arrayContaining(['col_word']));
    const hy = acceptKnow({ id: 'w1', col: [{ p: 'well deserved', de: 'wohlverdient', ex: 'After the launch, the team took a [well-deserved] break.' }] }, card({ head: 'deserve' }), T, 'pv');
    expect(hy.col).toHaveLength(1);
  });

  it('wirft weg: Präposition am Ende, Falschform einer Falle, fehlendes Wort, ohne Klammer, britisch wird angeglichen', () => {
    const raw = {
      id: 'w1',
      col: [
        { p: 'objection to', de: 'Einwand gegen', ex: 'They had an [objection to] the price.' },
        { p: 'make an objection', de: 'einen Einwand machen', ex: 'The client may [make an objection] in the meeting today.' },
        { p: 'formal objection', de: 'förmlicher Einwand', ex: 'The client filed a formal objection with the vendor.' },
        { p: 'strong objection', de: 'starker Einwand', ex: 'There was a [strong objection] to the new colour scheme today.' },
      ],
      sents: [
        { en: 'This sentence does not contain the word we are looking for at all.', de: 'Dieser Satz enthält das gesuchte Wort überhaupt nicht.' },
        { en: 'Her objection was that the archive would not meet our retention rules.', de: 'Ihr Einwand war, dass das Archiv unsere Aufbewahrungsregeln nicht erfüllt.' },
      ],
    };
    const a = acceptKnow(raw, card({ wrong: ['make an objection'] }), T, 'pv');
    expect(a.col.map((c) => c.p)).toEqual(['strong objection']);
    expect(a.col[0]!.ex).toContain('color');
    expect(a.rejected).toEqual(expect.arrayContaining(['col_prep', 'col_wrong', 'col_ex', 'sent_word']));
    expect(a.sb.map((s) => s.en)).toEqual(['Her objection was that the archive would not meet our retention rules.']);
  });

  it('kein Satz, der schon da ist; falsche Kennung zählt nicht', () => {
    const s = 'Her objection was that the archive would not meet our retention rules.';
    expect(acceptKnow({ id: 'w1', sents: [{ en: s, de: 'Ihr Einwand war, dass das Archiv die Regeln nicht erfüllt.' }] }, card({ known: [s] }), T, 'pv').sb).toEqual([]);
    expect(acceptKnow({ id: 'w9', col: [] }, card(), T, 'pv').rejected).toEqual(['id']);
  });
});

describe('needsKnow / knowPatch / knowRecent', () => {
  it('Bedarf ohne Wortpartner oder mit weniger als 3 Sätzen; ausgeblendete nie', () => {
    expect(needsKnow({ word: 'x', ex: 'A.' })).toBe(true);
    expect(needsKnow({ word: 'x', ex: 'A.', col: [{ p: 'a x' }], sb: [{ en: 'B.' }, { en: 'C.' }] })).toBe(false);
    expect(needsKnow({ word: 'x', hidden: true })).toBe(false);
  });

  it('Wortpartner nur in ein leeres col, Sätze hinten an (≤ 8), nie doppelt, Marke kn', () => {
    const raw = { ...((JSON.parse(KNOW_EXAMPLE) as { items: Doc[] }).items[0]!), sents: [GOOD, { en: 'Our partner had a strong objection to the new commission rules.', de: 'Unser Partner hatte einen starken Einwand gegen die neuen Provisionsregeln.' }] };
    const a = acceptKnow(raw, card(), T, 'pv');
    const full = knowPatch({ word: 'objection', col: [{ p: 'old one' }], sb: [{ en: 'X.' }] }, a, T, 'pv')!;
    expect(full.col).toBeUndefined();
    expect((full.sb as unknown[]).length).toBe(3);
    expect(full.kn).toEqual({ t: T, pv: 'pv' });
    const empty = knowPatch({ word: 'objection', col: [] }, a, T, 'pv')!;
    expect((empty.col as unknown[]).length).toBe(3);
    const eight = Array.from({ length: 8 }, (_, i) => ({ en: `S ${i}.` }));
    expect(knowPatch({ word: 'objection', sb: eight }, a, T, 'pv')!.sb).toBeUndefined();
    expect(knowRecent({ kn: { t: T - 3 * 86_400_000 } }, T)).toBe(true);
    expect(knowRecent({ kn: { t: T - 20 * 86_400_000 } }, T)).toBe(false);
  });
});

describe('Reihenfolge und Lauf', () => {
  const docs = new Map<string, Doc>([
    ['vocab/a', { word: 'alpha', ex: 'Alpha is here.', order: 3, lex: { intro: '2026-10-01' } }],
    ['vocab/b', { word: 'beta', ex: 'Beta is here.', order: 2 }],
    ['vocab/c', { word: 'gamma', ex: 'Gamma.', order: 1 }],
    ['vocab/d', { word: 'delta', ex: 'Delta.', col: [{ p: 'big delta' }], sb: [{ en: '1.' }, { en: '2.' }] }],
    ['chunk/e', { en: 'epsilon' }],
  ]);

  it('Plan zuerst, dann neue nach order, dann der Rest (Wendungen zuletzt, W4); ohne Bedarf nicht', () => {
    expect(knowOrder(docs, ['vocab/a'], T)).toEqual(['vocab/a', 'vocab/c', 'vocab/b', 'chunk/e']);
  });

  it('fillKnow: fragt im Hintergrund, speichert nur Geprüftes, Marke auch ohne Ergebnis; ohne bg nichts', async () => {
    const writes: Array<[string, Doc]> = [];
    const store = new Map(docs);
    const writer = {
      transform: async (path: string, fn: (cur: Doc | undefined) => { update: Doc } | null) => {
        const r = fn(store.get(path));
        if (r) {
          store.set(path, { ...store.get(path), ...r.update });
          writes.push([path, r.update]);
        }
        return null;
      },
    };
    const prompts: string[] = [];
    const ai: VocabAi = {
      ready: () => true,
      ask: () => Promise.reject(new Error('nein')),
      bg: async (tpl, vars) => {
        const p = (tpl as typeof wordKnow).build(vars as never);
        prompts.push(p);
        return JSON.parse(wordKnowReply(p)) as never;
      },
      fail: () => ({ kind: 'retry', key: null }),
    };
    const n = await fillKnow({ ai, writer: writer as never, docs, planPaths: [], ctx: 'DMS', nowMs: T, calls: 1 });
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain('word=gamma');
    expect(n).toBe(4);
    expect(writes.map(([p]) => p).sort()).toEqual(['chunk/e', 'vocab/a', 'vocab/b', 'vocab/c']);
    // Wendung: nur Sätze, nie Wortpartner.
    expect(writes.find(([p]) => p === 'chunk/e')![1].col).toBeUndefined();
    expect(writes.every(([, u]) => (u.kn as Doc).pv === 'word-know@1')).toBe(true);
    expect(await fillKnow({ ai: { ...ai, bg: undefined }, writer: writer as never, docs, planPaths: [], ctx: '', nowMs: T })).toBe(0);
  });
});
