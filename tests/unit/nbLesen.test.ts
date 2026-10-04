import { describe, expect, it } from 'vitest';
import { themeTexts } from '../../src/content/nb/load';
import { themeById } from '../../src/content/nb/themes';
import { isDictWord } from '../../src/domain/lexicon/dict';
import { ladderFor, ladderRate, LADDER_BASE, LADDER_FAST, LADDER_SLOW } from '../../src/domain/input/ladder';
import { newShare, textForms } from '../../src/domain/input/newShare';
import { inputBlockPlan, isThemeTextId, noticeRows, phraseSentence, quoteSentence, shadowSentences, summaryReady, themeArticle, themeQuestions } from '../../src/domain/input/unitInput';
import { statusCss, statusIndex, textCardKeys, textStatus } from '../../src/domain/input/wordStatus';
import { EMPTY_TARGETS, themeRef } from '../../src/domain/week';
import type { UnitCtx } from '../../src/app/unit/types';
import { INPUT_BLOCKS } from '../../src/features/input/block/run';
import { catOf, categoryCounts, writingFeedback } from '../../src/domain/input/writeFeedback';

// Neubau P4 (plan.md §4.5): „x % neu“ (N50), Wortstatus (N51), Block 2 (N53, M7, M9, S1), Tempo-Leiter (N54).

const none = () => false;

describe('N50: x % neu', () => {
  it('zählt Inhaltswörter ohne Funktionswörter, Namen und Zahlen', () => {
    const forms = textForms('The CFO met Anna in Berlin. She signed 3 contracts in 2026.');
    expect(forms).toContain('the');
    expect(forms).not.toContain('anna');
    expect(forms).not.toContain('berlin');
    expect(forms).not.toContain('cfo');
    const s = newShare('The CFO met Anna in Berlin. She signed 3 contracts in 2026.', { vocab: none, dict: none });
    // met, signed, contracts
    expect(s.total).toBe(3);
    expect(s.fresh).toBe(3);
    expect(s.pct).toBe(100);
  });

  it('Wörterbuch und Wortschatz (auch Grundformen) machen Wörter bekannt', () => {
    const dict = (w: string) => ['meet', 'sign'].includes(w);
    const vocab = (w: string) => w === 'contract';
    const s = newShare('We met them and signed the contracts yesterday.', { vocab, dict });
    expect(s.words).toEqual(['yesterday']);
    expect(s.fresh).toBe(1);
    expect(s.pct).toBe(25);
  });

  it('Themen-Texte liegen mit dem echten Wörterbuch im i+1-Bereich (≤ 15 % neu)', () => {
    for (const tt of themeTexts()) {
      const s = newShare(tt.text, { vocab: none, dict: isDictWord });
      expect(s.total, tt.id).toBeGreaterThan(40);
      expect(s.pct, `${tt.id}: ${s.words.join(', ')}`).toBeLessThanOrEqual(15);
    }
  });

  it('leerer Text ergibt 0 %', () => {
    expect(newShare('', { vocab: none, dict: none })).toEqual({ total: 0, fresh: 0, pct: 0, words: [] });
  });
});

describe('N51: Wortstatus', () => {
  const idx = statusIndex([
    { word: 'negotiate', stage: 2 },
    { word: 'budget', stage: 5 },
    { word: 'to leverage', stage: 1 },
    { word: 'walk through', stage: 1 },
    { word: 'hidden', stage: 1, hidden: true },
  ]);

  it('am Lernen / sicher, Grundformen, Wendungen zählen nicht', () => {
    expect(idx.get('negotiate')).toBe('learning');
    expect(idx.get('budget')).toBe('known');
    expect(idx.get('leverage')).toBe('learning');
    expect(idx.has('walk through')).toBe(false);
    expect(idx.has('hidden')).toBe(false);
    const st = textStatus('We negotiated the Budget and leveraged it. Hidden costs stayed.', idx);
    expect(st.learning).toEqual(['negotiated', 'leveraged']);
    expect(st.known).toEqual(['budget']);
  });

  it('CSS nur mit Farb-Tokens, auf den Container begrenzt', () => {
    const css = statusCss('r1', { learning: ['don"t'], known: ['budget'] });
    expect(css).toContain('[data-reader="r1"] .lx-word[data-lookup="don\\"t"]');
    expect(css).toContain('var(--lx-gold-text)');
    expect(css).toContain('var(--lx-accent-text)');
    expect(css).not.toMatch(/#[0-9a-f]{3,6}/i);
    expect(statusCss('r1', { learning: [], known: [] })).toBe('');
  });
});

describe('N53/M7: Quelle von Block 2 je Wochentag', () => {
  // Seit 04.10.2026 (Fokus Vokabeln und Grammatik) plant `unitPlanFor` an keinem Tag mehr Lese-/Hör-Input:
  // Block 2 ist der Grammatik-Block. `inputBlockPlan` liefert deshalb immer `null`; ältere gespeicherte
  // Pläne mit Input-Block startet der Anbieter weiter (Themen-Text als Rückfall, siehe „Block-Anbieter“ unten).
  it('kein Tag hat einen Input-Block – bei KI und Sprachausgabe an oder aus', () => {
    // KW 39 (ungerade) und KW 40 (gerade): Mo 21.09. … So 04.10.
    for (let d = 21; d <= 34; d++) {
      const day = d <= 30 ? `2026-09-${d}` : `2026-10-0${d - 30}`;
      for (const ai of [true, false])
        for (const tts of [true, false])
          for (const theme of ['t01', 't14'] as const) expect(inputBlockPlan(day, theme, { ai, tts }), `${day} ai=${ai} tts=${tts} ${theme}`).toBeNull();
    }
  });
});

describe('M9: Fragen mit Belegstelle und Grund', () => {
  const tt = themeTexts().find((x) => x.id === 'x-t01');
  const theme = themeById('t01');
  it('Kernfrage und „zwischen den Zeilen“ tragen Zitat und Grund in beiden Sprachen', () => {
    expect(tt).toBeTruthy();
    if (!tt) return;
    const qs = themeQuestions(tt, 'de');
    expect(qs.map((q) => q.type)).toEqual(['gist', 'inference']);
    for (const q of qs) {
      expect(q.quote).toBeTruthy();
      expect(q.explain.de).toBeTruthy();
      expect(q.explain.en).toBeTruthy();
      expect(quoteSentence(tt.text, q.quote ?? '')).toContain(q.quote ?? '');
    }
    expect(qs[0]?.q).toBe(tt.core.q.de);
  });

  it('Themen-Text als Lese-Einheit trägt das Wochenthema als Herkunft', () => {
    if (!tt || !theme) return;
    const a = themeArticle(tt, theme, 'en');
    expect(a.ref).toBe(themeRef('t01'));
    expect(isThemeTextId(a.id)).toBe(true);
    expect(a.glossary.length).toBeGreaterThan(0);
    for (const g of a.glossary) expect(theme.phrases.map((p) => p.en)).toContain(g.w);
  });

  it('Wendungen zum Merken bekommen die Bedeutung der Wochen-Wendung und einen Ursprungssatz', () => {
    if (!tt || !theme) return;
    const rows = noticeRows(tt.notice, theme.phrases, 'de');
    expect(rows.filter((r) => r.de).length).toBeGreaterThanOrEqual(2);
    for (const n of tt.notice) expect(phraseSentence(tt.text, n)).toBeTruthy();
  });

  it('Nachsprech-Sätze: vorgegeben, sonst sprechbare Sätze; Zusammenfassung ab 2 Sätzen', () => {
    expect(shadowSentences('x', ['A.', 'B.', 'C.', 'D.'])).toEqual(['A.', 'B.', 'C.']);
    expect(shadowSentences('Short. This sentence has exactly seven words here. Another fine sentence with enough words in it.')).toHaveLength(2);
    expect(summaryReady('The memo says customers should talk most. Ask open questions and find the decision maker.')).toBe(true);
    expect(summaryReady('Too short.')).toBe(false);
  });
});

describe('N52: Wörter aus diesem Text', () => {
  it('Herkunft oder Vorkommen im Text (auch gebeugt und als Wendung), ohne ausgeblendete', () => {
    const cards = [
      { key: 'vocab/negotiate', word: 'negotiate' },
      { key: 'vocab/walk-through', word: 'walk me through' },
      { key: 'vocab/other', word: 'giraffe', originRef: 'theme:t01' },
      { key: 'vocab/none', word: 'banana' },
      { key: 'vocab/hidden', word: 'price', hidden: true },
    ];
    const keys = textCardKeys('We negotiated the price. Walk me through your process.', 'theme:t01', cards);
    expect(keys).toEqual(['vocab/negotiate', 'vocab/walk-through', 'vocab/other']);
    expect(textCardKeys('Nothing here.', null, cards)).toEqual([]);
  });
});

describe('N53: Anbieter input.read / input.listen', () => {
  it('start(ctx) liefert synchron die Route und füllt Nachsprech-Sätze und Wendungen (ohne KI: Themen-Text)', () => {
    const read = INPUT_BLOCKS.find((b) => b.kind === 'input.read');
    const listen = INPUT_BLOCKS.find((b) => b.kind === 'input.listen');
    expect(read?.feasible({ ai: false, tts: false })).toBe(true);
    expect(listen?.feasible({ ai: true, tts: false })).toBe(false);
    const theme = themeById('t01');
    const ctx: UnitCtx = { day: '2026-09-28', block: 2, theme, targets: EMPTY_TARGETS, minutes: 5 };
    const r = read?.start(ctx);
    expect(r).toEqual({ name: 'inputUnit', day: '2026-09-28', kind: 'read', ref: 'theme:x-t01' });
    expect(ctx.sentences).toHaveLength(3);
    expect(ctx.phrases?.length).toBeGreaterThanOrEqual(2);
    expect(read?.start({ ...ctx, theme: null })).toBe(false);
  });
});

describe('N55: Schreibwerkstatt im Einheitsstil', () => {
  const err = (orig: string, fix: string, cat: string, sev: 'minor' | 'major' = 'minor') => ({ orig, fix, cat, sev, why: 'Grund.', topic: null });
  it('Kategorien Fehler · Natürlicher · Ton; Aufwertungen zählen als natürlicher', () => {
    expect(catOf('register')).toBe('tone');
    expect(catOf('collocation')).toBe('natural');
    expect(catOf('grammar')).toBe('error');
    expect(categoryCounts([err('a', 'b', 'grammar'), err('c', 'd', 'register')], ['x'])).toEqual({ error: 1, natural: 1, tone: 1 });
  });
  it('Verdikt, Wirkung und Korrekturen mit Grund', () => {
    const fb = writingFeedback({ errors: [err('He go', 'He goes', 'grammar', 'major')], upgrades: ['u1', 'u2', 'u3'], summary: 'Klar.' });
    expect(fb.verdict).toBe('wrong');
    expect(fb.effect).toBe('Klar.');
    expect(fb.fixes[0]).toMatchObject({ kind: 'meaning', mine: 'He go', right: 'He goes', why: 'Grund.' });
    expect(writingFeedback({ errors: [], upgrades: [], summary: '' }).verdict).toBe('ok');
  });
});

describe('N54: Tempo-Leiter', () => {
  it('startet langsam, steigt nach fehlerfreiem Hören, zweiter Durchgang schneller', () => {
    expect(ladderFor([])).toEqual({ first: LADDER_SLOW, second: LADDER_FAST });
    const ok = { n: 2, ok: 2, rate: 0.9, t: 2 };
    const bad = { n: 2, ok: 1, rate: 1, t: 1 };
    expect(ladderFor([bad, ok]).first).toBe(LADDER_BASE);
    expect(ladderFor([{ ...bad, t: 3 }, ok]).first).toBe(LADDER_SLOW);
    const l = ladderFor([ok]);
    expect(ladderRate(l, 1)).toBe(LADDER_BASE);
    expect(ladderRate(l, 2)).toBe(LADDER_FAST);
  });
});
