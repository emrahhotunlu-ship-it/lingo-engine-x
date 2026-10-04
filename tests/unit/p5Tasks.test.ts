import { beforeAll, describe, expect, it } from 'vitest';
import { registerCannedReplies } from '../../src/platform/dev/cannedReplies';
import { createFakeSample } from '../../src/platform/dev/fakeSample';
import { speakTaskCheck, type SpeakTaskCheckVars, type SpeakTaskKind } from '../../src/prompts/nb/p5/speakTaskCheck';
import { chartGeometry, keyWord, niceMax, usesTarget, wordDiff, wordsPerMinute } from '../../src/features/speak/tasks/logic';
import { CHARTS, CIRCUMS, PITCHES } from '../../src/features/speak/tasks/content';
import { chartRef, feedbackOf, stepsFor } from '../../src/features/speak/tasks/SpeakTaskScreen';
import { hintFor, hintOf, readHint, themeFromText, weekHintOp } from '../../src/domain/week/hint';
import { readWeekDoc, suggestTheme, themeFor } from '../../src/domain/week';
import { newVocabDoc } from '../../src/domain/srs/newCard';

// Neubau N79 + B9 (Pitch 30/60/120, Diagramm, Umschreiben, Rückübersetzung) und N17 (Terminthema
// hat Vorrang beim Wochenthema-Vorschlag).

const sample = createFakeSample(() => 'ok', () => ({}), 0);

beforeAll(() => registerCannedReplies());

const vars = (kind: SpeakTaskKind, answer: string, uiLang: 'de' | 'en' = 'de'): SpeakTaskCheckVars => {
  const s = stepsFor(kind, 0)[0];
  if (!s) throw new Error('keine Schritte');
  return { kind, task: s.task, ref: s.ref, model: s.model, answer, seconds: s.sec, uiLang };
};

describe('speak-task-check@1: feste Antworten erfüllen das Schema', () => {
  for (const kind of ['pitch', 'chart', 'circum', 'back'] as const) {
    for (const lang of ['de', 'en'] as const) {
      it(`${kind} (${lang})`, async () => {
        const v = vars(kind, 'We have been working with them since three years and we can discuss about the price.', lang);
        const raw = await sample.json<unknown>(speakTaskCheck.build(v));
        const res = speakTaskCheck.schema(v).safeParse(raw);
        expect(res.success).toBe(true);
        if (!res.success) return;
        expect(res.data.fixes.length).toBeGreaterThan(0);
        expect(res.data.better.length).toBeGreaterThan(10);
        expect(['ok', 'close', 'wrong']).toContain(res.data.verdict);
      });
    }
  }

  it('Prompt enthält Aufgabenart, Bezug, Sprechzeit und Erklärsprache', () => {
    const p = speakTaskCheck.build(vars('chart', 'Sales went up.', 'en'));
    expect(p).toMatch(/^\[speak-task-check@1\]/);
    expect(p).toContain('Task type: describe a chart');
    expect(p).toContain('Speaking time: 60 seconds');
    expect(p).toContain('Explanation language: English');
    expect(speakTaskCheck.build(vars('back', 'x'))).not.toContain('Speaking time');
  });

  it('Schema liest tolerant (good → ok) und prüft die Sprache', () => {
    const v = vars('circum', 'x', 'de');
    const ok = speakTaskCheck.schema(v).safeParse({ verdict: 'good', core: 'Ein Kunde würde es verstehen.', effect: 'Klar und freundlich.', fixes: 'none', better: 'It is the time you must keep documents.' });
    expect(ok.success && ok.data.verdict).toBe('ok');
    expect(ok.success && ok.data.fixes).toEqual([]);
  });
});

describe('Sprechaufgaben: Schritte und Rückmeldung', () => {
  it('Pitch: drei Runden 30/60/120 s mit derselben Kernbotschaft', () => {
    const s = stepsFor('pitch', 1);
    expect(s.map((x) => x.sec)).toEqual([30, 60, 120]);
    expect(new Set(s.map((x) => x.ref)).size).toBe(1);
    expect(s[0]?.ref).toBe(PITCHES[1]?.core.en);
  });

  it('Diagramm: 60 s, Daten als Bezug; Umschreiben und Rückübersetzung: drei verschiedene Aufgaben', () => {
    const c = stepsFor('chart', 0);
    expect(c).toHaveLength(1);
    expect(c[0]?.sec).toBe(60);
    expect(chartRef(CHARTS[0] as (typeof CHARTS)[number])).toContain('Jan 12');
    const w = stepsFor('circum', 2);
    expect(new Set(w.map((x) => x.id)).size).toBe(3);
    const b = stepsFor('back', 0);
    expect(b.every((x) => x.sec === 0)).toBe(true);
    // reihum: die nächste Runde beginnt mit anderen Aufgaben
    expect(stepsFor('back', 1)[0]?.id).not.toBe(b[0]?.id);
  });

  it('Rückmeldung: mit Claude Urteil + bessere Fassung; Zielwort benutzt → falsch; ohne KI → Muster', () => {
    const data = { verdict: 'ok' as const, core: 'Verständlich.', effect: 'Klar.', fixes: [{ mine: 'a', right: 'b', why: 'c' }], better: 'Better text.' };
    const withAi = feedbackOf({ kind: 'pitch', text: 'My pitch', step: { model: 'Model text.' }, data, used: false, usedWhy: 'x', noAnswer: '-' });
    expect(withAi).toMatchObject({ verdict: 'ok', mine: 'My pitch', solution: 'Better text.', upgrades: [{ to: 'Model text.' }] });
    expect(withAi.fixes).toHaveLength(1);
    const used = feedbackOf({ kind: 'circum', text: 'retention period', step: { model: 'M' }, data, used: true, usedWhy: 'benutzt', noAnswer: '-' });
    expect(used.verdict).toBe('wrong');
    expect(used.fixes[0]).toMatchObject({ kind: 'goal', why: 'benutzt' });
    const self = feedbackOf({ kind: 'back', text: '', step: { model: 'Original.' }, data: null, used: false, usedWhy: 'x', noAnswer: '(keine Antwort)' });
    expect(self).toMatchObject({ verdict: 'unchecked', mine: '(keine Antwort)', solution: 'Original.' });
  });
});

describe('Sprechaufgaben: reine Logik', () => {
  it('niceMax und Diagramm-Geometrie', () => {
    expect(niceMax(38)).toBe(50);
    expect(niceMax(120)).toBe(200);
    expect(niceMax(4.2)).toBe(5);
    expect(niceMax(0)).toBe(1);
    const bar = chartGeometry(CHARTS[0] as (typeof CHARTS)[number]);
    expect(bar.bars).toHaveLength(6);
    // steigende Werte → höhere Balken
    expect(bar.bars[5]?.h ?? 0).toBeGreaterThan(bar.bars[0]?.h ?? 0);
    expect(bar.bars.every((b) => b.y >= bar.top && b.y + b.h <= bar.base + 0.001)).toBe(true);
    const line = chartGeometry(CHARTS[1] as (typeof CHARTS)[number]);
    expect(line.bars).toHaveLength(0);
    expect(line.points).toHaveLength(8);
  });

  it('Wortvergleich markiert Abweichungen (Satzzeichen und Groß-/Kleinschreibung zählen nicht)', () => {
    const d = wordDiff("We'd like to get a better sense of how your team handles invoices today.", "We'd like to understand better how your team handles invoices today");
    expect(d.same).toBe(10);
    expect(d.orig.filter((w) => !w.same).map((w) => w.w)).toEqual(['get', 'a', 'sense', 'of']);
    expect(d.mine.filter((w) => !w.same).map((w) => w.w)).toEqual(['understand']);
    expect(wordDiff('Same text.', 'same text').same).toBe(2);
  });

  it('Zielwort beim Umschreiben erkennen (Begriff oder Wortstamm des markantesten Worts)', () => {
    expect(keyWord('retention period')).toBe('retention');
    expect(usesTarget('It is the retention period for invoices.', 'retention period')).toBe(true);
    expect(usesTarget('How long you must retain documents.', 'retention period')).toBe(false);
    expect(usesTarget('You pay it in installments.', 'installment')).toBe(true);
    expect(usesTarget('The time you must keep documents before you delete them.', 'retention period')).toBe(false);
    expect(CIRCUMS.every((c) => !usesTarget(c.model, c.en))).toBe(true);
  });

  it('Umschreiben: das Zielwort wird eine gültige Karte mit Ursprungssatz (Kap. 15)', () => {
    for (const c of CIRCUMS) {
      expect(usesTarget(c.ex, c.en)).toBe(true);
      const made = newVocabDoc({ word: c.en, de: c.de, pos: 'noun', ex: c.ex, surface: c.en, src: 'coach', origin: { v: 1, kind: 'business', ref: `circum/${c.id}`, title: c.de, t: 1 }, today: '2026-09-28' });
      expect(made, c.id).not.toBeNull();
    }
  });

  it('Wörter pro Minute', () => {
    expect(wordsPerMinute('one two three four five six', 3000)).toBe(120);
    expect(wordsPerMinute('', 3000)).toBe(0);
    expect(wordsPerMinute('a b', 0)).toBe(0);
  });
});

describe('N17: Terminthema hat Vorrang beim Wochenthema-Vorschlag', () => {
  it('Thema aus freiem Text (Schlüsselwörter der 16 Themen)', () => {
    expect(themeFromText('CFO wants to see the ROI and a business case')).toBe('t03');
    expect(themeFromText('Demo for the board meeting, slides ready')).toBe('t06');
    expect(themeFromText('Kaffee trinken')).toBeNull();
  });

  it('Hinweis gilt nur in der Kalenderwoche des Termins; gespeichertes Thema gewinnt', () => {
    const hint = hintFor('meeting', 'Renewal and upsell with an existing customer', '2026-10-07');
    expect(hint).toEqual({ wk: '2026-W41', theme: 't11', src: 'meeting' });
    const week = readWeekDoc({ v: 1, cur: { wk: '2026-W40', theme: 't01', by: 'auto' }, hint });
    expect(week.hint).toEqual(hint);
    // Woche des Termins: der Termin hat Vorrang vor der Reihenfolge
    expect(themeFor('2026-10-05', week).id).toBe('t11');
    // andere Woche: normale Reihenfolge
    expect(themeFor('2026-10-12', week).id).toBe(suggestTheme(week, '2026-W42'));
    // bestätigte Woche: die Wahl gilt
    expect(themeFor('2026-09-28', week).id).toBe('t01');
    expect(hintOf(week, '2026-W41')).toEqual({ meeting: 't11' });
    expect(hintOf(week, '2026-W42')).toBeUndefined();
  });

  it('ein früherer Preply-Hinweis im Dokument (bis 28.09.2026) wird nicht mehr ausgewertet', () => {
    // readHint verwirft `src: 'preply'`; ein solcher Hinweis zählt beim Wochenthema nicht mehr.
    expect(readHint({ wk: '2026-W41', theme: 't07', src: 'preply' })).toBeUndefined();
  });

  it('Schreibweg: feldweise, nie bei ungültigem Dokument, nichts bei gleichem Hinweis', () => {
    const h = { wk: '2026-W41', theme: 't03' as const, src: 'meeting' as const };
    expect(weekHintOp(undefined, true, h)).toEqual({ set: { v: 1, hint: h } });
    expect(weekHintOp({ v: 1, preplyNext: '2026-10-06' }, false, h)).toBeNull();
    expect(weekHintOp({ v: 1, hint: h }, true, h)).toBeNull();
    expect(weekHintOp({ preplyNext: '2026-10-06' }, true, h)).toEqual({ update: { hint: h, v: 1 } });
    expect(weekHintOp({ v: 1 }, true, null)).toBeNull();
    expect(readHint({ wk: 'x', theme: 't03' })).toBeUndefined();
    expect(readHint({ wk: '2026-W41', theme: 't99' })).toBeUndefined();
  });
});
