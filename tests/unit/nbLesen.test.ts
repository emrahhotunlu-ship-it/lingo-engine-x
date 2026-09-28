import { describe, expect, it } from 'vitest';
import { themeTexts } from '../../src/content/nb/load';
import { themeById } from '../../src/content/nb/themes';
import { isDictWord } from '../../src/domain/lexicon/dict';
import { ladderFor, ladderRate, LADDER_BASE, LADDER_FAST, LADDER_SLOW } from '../../src/domain/input/ladder';
import { newShare, textForms } from '../../src/domain/input/newShare';
import { inputBlockPlan, isThemeTextId, noticeRows, phraseSentence, quoteSentence, shadowSentences, summaryReady, themeArticle, themeQuestions } from '../../src/domain/input/unitInput';
import { statusCss, statusIndex, textStatus } from '../../src/domain/input/wordStatus';
import { themeRef } from '../../src/domain/week';

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
  const on = { ai: true, tts: true };
  // KW 40/2026: Mo 28.09. … So 04.10. (gerade Kalenderwoche)
  it('Mo Themen-Text, Di Hörtext zum Thema, Do Dialog, Fr Alltag in Berufswochen', () => {
    expect(inputBlockPlan('2026-09-28', 't01', on)).toEqual({ kind: 'read', src: 'theme-text', summary: false, ladder: false });
    expect(inputBlockPlan('2026-09-29', 't01', on)).toEqual({ kind: 'listen', src: 'theme-listen', summary: false, ladder: true });
    expect(inputBlockPlan('2026-10-01', 't01', on)).toMatchObject({ kind: 'listen', src: 'dialog' });
    expect(inputBlockPlan('2026-10-02', 't01', on)).toMatchObject({ kind: 'read', src: 'feed-life' });
    expect(inputBlockPlan('2026-10-02', 't14', on)).toMatchObject({ kind: 'read', src: 'feed' });
    expect(inputBlockPlan('2026-10-03', 't01', on)).toBeNull();
    expect(inputBlockPlan('2026-10-04', 't01', on)).toBeNull();
  });

  it('ohne KI: Di Themen-Text vorgelesen + Zusammenfassung, Do Feed; ohne Sprachausgabe Lesen', () => {
    expect(inputBlockPlan('2026-09-29', 't01', { ai: false, tts: true })).toEqual({ kind: 'listen', src: 'theme-text', summary: true, ladder: true });
    expect(inputBlockPlan('2026-10-01', 't01', { ai: false, tts: true })).toMatchObject({ kind: 'listen', src: 'feed' });
    expect(inputBlockPlan('2026-09-29', 't01', { ai: false, tts: false })).toMatchObject({ kind: 'read', src: 'theme-text', summary: true });
  });

  it('Mittwoch in ungeraden Wochen ist der Posteingang (kein Lese-Block)', () => {
    expect(inputBlockPlan('2026-09-23', 't01', on)).toBeNull();
    expect(inputBlockPlan('2026-09-30', 't01', on)).toMatchObject({ kind: 'read', src: 'feed' });
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
