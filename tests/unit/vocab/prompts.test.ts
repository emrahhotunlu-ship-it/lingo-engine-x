import { describe, expect, it } from 'vitest';
import { transfer, transferRecheck, TRANSFER_EXAMPLE, TRANSFER_TEXT_MAX, type TransferVars } from '../../../src/modules/vocab/prompts/transfer';
import { ownSentence, ownSentenceRecheck, OWN_SENTENCE_EXAMPLE, type OwnSentenceVars } from '../../../src/modules/vocab/prompts/ownSentence';
import { meaning, MEANING_EXAMPLE, type MeaningVars } from '../../../src/modules/vocab/prompts/meaning';
import { RECHECK_LINE, SPOKEN_RULE, type VocabTarget } from '../../../src/modules/vocab/prompts/common';
import { meaningReply, ownSentenceReply, transferReply } from '../../../src/platform/dev/canned/vocab';
import { PROMPT_MAX_BYTES, promptBytes } from '../../../src/prompts/common';
import { TEMPLATES } from '../../../src/prompts/registry';

// Großpaket A Schritt 5: die drei Claude-Vorlagen des Wörter-Moduls (plan.md §7, synthese.md §2.5). Geprüft wird die lokale Gegenprüfung
// (Claude prüft den Sinn, die App das Vorkommen), die Widerspruchsfreiheit (Kap. 2) und dass ohne Beleg nie eine Strafnote entsteht.

const T: VocabTarget[] = [
  { key: 'w1', word: 'postpone', meaning: 'verschieben', kind: 'w', example: 'We had to postpone the launch by a week.' },
  { key: 'w2', word: 'follow up on', meaning: 'nachhaken bei', kind: 'pv' },
  { key: 'w3', word: 'tight deadline', meaning: 'knappe Frist', kind: 'col' },
];
const TEXT = 'Hi Sarah, we need to postpone the review to Friday. I will follow up on the budget, because the tight deadline worries me.';
const vars = (o: Partial<TransferVars> = {}): TransferVars => ({ frame: 'mail', task: 'Der Kunde will den Termin verschieben.', targets: T, text: TEXT, spoken: false, uiLang: 'de', ...o });
const ok = (key: string, at: string) => ({ key, v: 'ok', err: null, at, why: 'Das Wort steht hier im richtigen Sinn und klingt natürlich.' });
const allOk = () => [ok('w1', 'postpone'), ok('w2', 'follow up on'), ok('w3', 'tight deadline')];
const parse = (o: unknown, v = vars()) => transfer.schema(v).safeParse(o);
const lenient = (o: unknown, v = vars()) => transfer.lenient!(v).safeParse(o);

describe('vocab-transfer@1', () => {
  it('Kopfzeile, Stufe, kein Zwischenspeicher; Einspruch = complex ohne Zwischenspeicher, mit Zusatzzeile', () => {
    expect(transfer.build(vars()).split('\n')[0]).toBe('[vocab-transfer@1]');
    expect([transfer.tier, transfer.cache]).toEqual(['default', false]);
    expect([transferRecheck.tier, transferRecheck.cache, transferRecheck.id]).toEqual(['complex', false, 'vocab-transfer']);
    expect(transfer.build(vars())).not.toContain(RECHECK_LINE);
    expect(transfer.build(vars({ recheck: true }))).toContain(RECHECK_LINE);
  });

  it('Prompt: Zielwörter mit Art und Bedeutung, Text als Daten, Sprechen nur bei Diktat, britisch ist richtig', () => {
    const p = transfer.build(vars());
    expect(p).toContain('w2: follow up on (phrasal verb; meaning: nachhaken bei)');
    expect(p).toContain('card example (a sentence too close to it does not count): We had to postpone');
    expect(p).toMatch(/<<<TEXT\nHi Sarah/);
    expect(p).toContain('Explanation language: German');
    expect(p).not.toContain(SPOKEN_RULE);
    expect(transfer.build(vars({ spoken: true }))).toContain(SPOKEN_RULE);
    expect(p).toMatch(/British spelling, British words and other valid alternatives count as correct/);
    expect(p).toMatch(/Never more than two corrections/);
  });

  it('Größe: 5 Zielwörter und längster Text bleiben unter der Grenze', () => {
    const many = [...T, { key: 'w4', word: 'x'.repeat(200), meaning: 'y'.repeat(400), kind: 'ch' as const, example: 'z '.repeat(400) }, { key: 'w5', word: 'a', meaning: 'b', kind: 'w' as const }];
    const p = transfer.build(vars({ targets: many, text: 'ä'.repeat(TRANSFER_TEXT_MAX * 3), task: 'x'.repeat(2000) }));
    expect(promptBytes(p)).toBeLessThan(PROMPT_MAX_BYTES / 4);
  });

  it('alles richtig: drei Urteile, kein Zusatzfehler, keine Korrektur', () => {
    const r = parse({ words: allOk(), extra: null, fixed: '' });
    expect(r.success).toBe(true);
    expect(r.data!.words.map((w) => w.v)).toEqual(['ok', 'ok', 'ok']);
    expect(r.data!.fixed).toBe('');
  });

  it('tolerant: Urteil und Fehlerklasse in Varianten, Zuordnung über das Stichwort, Reihenfolge der Zielwörter', () => {
    const r = parse({
      words: [
        { key: 'tight deadline', v: 'Correct', at: 'tight deadline', why: 'Die Verbindung ist genau richtig.' },
        { key: 'w1', v: 'unnatural', err: 'Preposition', at: 'postpone the review to', why: 'Hier passt „until“ besser als „to“.' },
        { word: 'follow up on', v: 'yes', at: 'follow up on', why: 'Das Phrasal Verb passt genau.' },
      ],
      extra: null,
      fixed: 'Hi Sarah, we need to postpone the review until Friday. I will follow up on the budget, because the tight deadline worries me.',
    });
    expect(r.success).toBe(true);
    expect(r.data!.words.map((w) => [w.key, w.v, w.err])).toEqual([['w1', 'odd', 'prep'], ['w2', 'ok', null], ['w3', 'ok', null]]);
  });

  it('fehlender Eintrag → Neuversuch; im Neuversuch → „nicht benutzt“ (keine Note)', () => {
    const o = { words: allOk().slice(1), extra: null, fixed: '' };
    expect(parse(o).success).toBe(false);
    expect(lenient(o).data!.words[0]).toMatchObject({ key: 'w1', v: 'unused' });
  });

  it('„benutzt“, obwohl das Wort fehlt → Neuversuch; im Neuversuch „nicht benutzt“', () => {
    const text = 'Hi Sarah, I will follow up on the budget, because the tight deadline worries me.';
    const o = { words: [ok('w1', 'postpone'), ok('w2', 'follow up on'), ok('w3', 'tight deadline')], extra: null, fixed: '' };
    expect(parse(o, vars({ text })).success).toBe(false);
    expect(lenient(o, vars({ text })).data!.words[0]).toMatchObject({ v: 'unused', at: '', why: '' });
  });

  it('„falsch“ ohne jede Fundstelle → keine Strafnote („nicht benutzt“)', () => {
    const text = 'Hi Sarah, I will follow up on the budget, because the tight deadline worries me.';
    const r = parse({ words: [{ key: 'w1', v: 'wrong', err: 'word', at: 'delay', why: 'Das ist ein anderes Wort.' }, allOk()[1], allOk()[2]], extra: null, fixed: '' }, vars({ text }));
    expect(r.success).toBe(true);
    expect(r.data!.words[0]).toMatchObject({ v: 'unused', err: null });
  });

  it('„falsch“ mit Fundstelle (Verwechsler im Text) bleibt falsch', () => {
    const text = 'Hi Sarah, we need to delay the review. I will follow up on the budget, because the tight deadline worries me.';
    const r = parse(
      { words: [{ key: 'w1', v: 'wrong', err: 'word', at: 'delay', why: 'Gesucht war „postpone“.' }, allOk()[1], allOk()[2]], extra: null, fixed: 'Hi Sarah, we need to postpone the review. I will follow up on the budget, because the tight deadline worries me.' },
      vars({ text }),
    );
    expect(r.success).toBe(true);
    expect(r.data!.words[0]).toMatchObject({ v: 'wrong', err: 'word', at: 'delay' });
  });

  it('„nicht benutzt“, obwohl das Wort im Text steht → Neuversuch', () => {
    expect(parse({ words: [{ key: 'w1', v: 'unused' }, allOk()[1], allOk()[2]], extra: null, fixed: '' }).success).toBe(false);
  });

  it('Beispielsatz der Karte wörtlich übernommen → „zu dünn“; Fundstelle nicht im Text → leer', () => {
    const text = 'We had to postpone the launch by a week. I will follow up on the budget, because the tight deadline worries me.';
    const r = parse({ words: [ok('w1', 'postpones'), allOk()[1], allOk()[2]], extra: null, fixed: '' }, vars({ text }));
    expect(r.data!.words[0]).toMatchObject({ v: 'thin', at: '' });
  });

  it('Fehlerklasse nur bei ~ und ✕ (fehlt sie dort: other)', () => {
    const r = parse({ words: [{ ...ok('w1', 'postpone'), err: 'form' }, { ...allOk()[1], v: 'odd', err: null }, allOk()[2]], extra: null, fixed: TEXT.replace('follow up on', 'follow up on') });
    expect(r.data!.words.map((w) => w.err)).toEqual([null, 'other', null]);
  });

  it('Begründung fehlt oder in der falschen Sprache → Neuversuch', () => {
    expect(parse({ words: [{ ...ok('w1', 'postpone'), why: '' }, allOk()[1], allOk()[2]], extra: null, fixed: '' }).success).toBe(false);
    expect(parse({ words: [{ ...ok('w1', 'postpone'), why: 'The word is used in the right sense and sounds natural here.' }, allOk()[1], allOk()[2]], extra: null, fixed: '' }).success).toBe(false);
  });

  it('Zusatzfehler: muss im Text stehen, fällt bei zwei Wortfehlern weg (nie mehr als 2 Korrekturen)', () => {
    const extra = { from: 'worries me', to: 'concerns me', why: 'Im Mail-Ton klingt „concerns“ sachlicher.' };
    const one = parse({ words: allOk(), extra, fixed: TEXT.replace('worries me', 'concerns me') });
    expect(one.data!.extra).toEqual(extra);
    expect(parse({ words: allOk(), extra: { ...extra, from: 'not in text' }, fixed: TEXT }).data!.extra).toBeNull();
    const two = parse({
      words: [{ ...allOk()[0], v: 'odd', err: 'prep' }, { ...allOk()[1], v: 'odd', err: 'form' }, allOk()[2]],
      extra,
      fixed: TEXT,
    });
    expect(two.data!.extra).toBeNull();
  });

  it('korrigierte Fassung: leer, wenn nichts falsch ist; muss benutzte Zielwörter behalten; britisch → US', () => {
    expect(parse({ words: allOk(), extra: null, fixed: 'Something else entirely.' }).data!.fixed).toBe('');
    const odd = [{ ...allOk()[0], v: 'odd', err: 'prep' }, allOk()[1], allOk()[2]];
    expect(parse({ words: odd, extra: null, fixed: 'Hi Sarah, we need to move the review. I will check the budget.' }).success).toBe(false);
    const fixed = 'Hi Sarah, we need to postpone the review until Friday. I will follow up on the budget, because the tight deadline worries me and I must prioritise it.';
    expect(parse({ words: odd, extra: null, fixed }).data!.fixed).toContain('prioritize');
  });

  it('Korrektur nötig, aber leer → „noch nicht sicher geprüft“', () => {
    const r = parse({ words: [{ ...allOk()[0], v: 'odd', err: 'prep' }, allOk()[1], allOk()[2]], extra: null, fixed: '' });
    expect(r.data).toMatchObject({ fixed: '', fixedUnsure: true });
  });

  it('Formatbeispiel ist gültiges JSON mit allen Feldern', () => {
    expect(Object.keys(JSON.parse(TRANSFER_EXAMPLE) as object)).toEqual(['words', 'extra', 'fixed']);
  });
});

const OWN: OwnSentenceVars = { target: { key: 'x', word: 'leverage', meaning: 'nutzen, einsetzen', kind: 'w', example: 'We can leverage our network.' }, sentence: 'We should leverage the new data to win the client.', task: null, spoken: false, uiLang: 'de' };
const ownParse = (o: unknown, v = OWN) => ownSentence.schema(v).safeParse(o);

describe('vocab-own-sentence@1', () => {
  it('Kopfzeile, Stufe, Lage nur bei gelenktem Satz, Einspruch', () => {
    const p = ownSentence.build(OWN);
    expect(p.split('\n')[0]).toBe('[vocab-own-sentence@1]');
    expect(p).toContain('Target: w1: leverage (word; meaning: nutzen, einsetzen)');
    expect(p).toContain('The learner chose the situation freely.');
    const g = ownSentence.build({ ...OWN, task: 'Sag dem Kunden, dass ihr die Daten nutzt.' });
    expect(g).toMatch(/Situation \(shown to the learner in German; the sentence should fit it\): Sag dem Kunden/);
    expect([ownSentence.tier, ownSentence.cache, ownSentenceRecheck.tier, ownSentenceRecheck.cache]).toEqual(['default', false, 'complex', false]);
  });

  it('richtig: Vergleichsfassung mit dem Wort bleibt; ohne das Wort, zu lang oder gleich dem Beispiel → leer', () => {
    const base = { v: 'ok', err: null, at: 'leverage', why: 'Hier passt „leverage“ im Sinn von „gezielt nutzen“.', extra: null, fixed: '' };
    expect(ownParse({ ...base, better: 'Small teams can leverage automation to save time.' }).data!.better).toBe('Small teams can leverage automation to save time.');
    expect(ownParse({ ...base, better: 'Small teams can use automation to save time.' }).data!.better).toBe('');
    expect(ownParse({ ...base, better: 'We can leverage our network.' }).data!.better).toBe('');
    expect(ownParse({ ...base, better: `We leverage ${'very '.repeat(30)}much.` }).data!.better).toBe('');
  });

  it('Widersprüche wie im Transfer: benutzt ohne Wort → Neuversuch, im Neuversuch keine Note', () => {
    const o = { v: 'ok', err: null, at: 'use', why: 'Gut benutzt.', extra: null, fixed: '', better: '' };
    const v = { ...OWN, sentence: 'We should use the new data to win the client.' };
    expect(ownParse(o, v).success).toBe(false);
    expect(ownSentence.lenient!(v).safeParse(o).data).toMatchObject({ v: 'unused', why: '' });
  });

  it('~ mit Korrektur: Fehlerklasse, Fassung behält das Wort', () => {
    const r = ownParse({ v: 'odd', err: 'colloc', at: 'leverage', why: 'Man sagt eher „leverage data“ ohne „the new“.', extra: null, fixed: 'We should leverage new data to win the client.', better: '' });
    expect(r.data).toMatchObject({ v: 'odd', err: 'colloc', fixed: 'We should leverage new data to win the client.' });
  });

  it('Formatbeispiel ist gültiges JSON', () => {
    expect(Object.keys(JSON.parse(OWN_SENTENCE_EXAMPLE) as object)).toEqual(['v', 'err', 'at', 'why', 'extra', 'fixed', 'better']);
  });
});

const MV: MeaningVars = { mode: 'meaning', word: 'postpone', meaning: 'verschieben', sentence: 'We had to postpone the launch.', given: 'auf später legen', uiLang: 'de' };

describe('vocab-meaning@1', () => {
  it('Kopfzeile, quick, 24 h Zwischenspeicher; zwei Fälle mit eigener Anweisung', () => {
    const p = meaning.build(MV);
    expect(p.split('\n')[0]).toBe('[vocab-meaning@1]');
    expect([meaning.tier, meaning.cache]).toEqual(['quick', { gcTime: 86_400_000 }]);
    expect(p).toMatch(/what the English word means in this sentence/);
    expect(meaning.build({ ...MV, mode: 'gap' })).toMatch(/typed a word in the gap/);
    expect(JSON.parse(MEANING_EXAMPLE)).toEqual({ ok: true, why: '…' });
  });

  it('tolerant gelesen, Sprachtreue geprüft', () => {
    expect(meaning.schema(MV).safeParse({ ok: 'yes', why: 'Das trifft den Sinn in diesem Satz.' }).data).toEqual({ ok: true, why: 'Das trifft den Sinn in diesem Satz.' });
    expect(meaning.schema(MV).safeParse({ ok: true, why: 'That captures the meaning in this sentence.' }).success).toBe(false);
  });
});

describe('Registrierung und Entwicklungs-Adapter', () => {
  it('alle drei Vorlagen stehen in der Vorlagen-Liste', () => {
    const ids = TEMPLATES.map((t) => t.id);
    for (const id of ['vocab-transfer', 'vocab-own-sentence', 'vocab-meaning']) expect(ids.filter((x) => x === id)).toHaveLength(1);
  });

  it('Testantworten bestehen das Schema (DE und EN); #odd liefert ~ mit Korrektur; zzqx verletzt das Schema genau einmal', () => {
    for (const uiLang of ['de', 'en'] as const) {
      const v = vars({ uiLang });
      expect(transfer.schema(v).safeParse(JSON.parse(transferReply(transfer.build(v)))).success).toBe(true);
      const o = { ...OWN, uiLang };
      expect(ownSentence.schema(o).safeParse(JSON.parse(ownSentenceReply(ownSentence.build(o)))).data?.better).toMatch(/leverage/);
      const m = { ...MV, uiLang, given: 'verschieben' };
      expect(meaning.schema(m).safeParse(JSON.parse(meaningReply(meaning.build(m)))).data?.ok).toBe(true);
    }
    const odd = vars({ text: `${TEXT} #odd` });
    const r = transfer.schema(odd).safeParse(JSON.parse(transferReply(transfer.build(odd))));
    expect(r.data!.words[0]).toMatchObject({ v: 'odd', err: 'prep' });
    expect(r.data!.fixed).toBe(TEXT);
    const q = vars({ text: `${TEXT} zzqx` });
    expect(transfer.schema(q).safeParse(JSON.parse(transferReply(transfer.build(q)))).success).toBe(false);
    expect(transfer.schema(q).safeParse(JSON.parse(transferReply(`${transfer.build(q)}\n\nYour previous reply did not match the required format:\n…`))).success).toBe(true);
  });
});
