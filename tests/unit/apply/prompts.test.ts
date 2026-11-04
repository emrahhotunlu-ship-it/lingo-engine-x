import { describe, expect, it } from 'vitest';
import { coveredOf, keepGood, keepPoints } from '../../../src/prompts/applyCommon';
import { applyKeypoints } from '../../../src/prompts/applyKeypoints';
import { applyReply, type ReplyVars } from '../../../src/prompts/applyReply';
import { applySummary, faithfulOf, type SummaryVars } from '../../../src/prompts/applySummary';
import { promptBytes, PROMPT_MAX_BYTES } from '../../../src/prompts/common';
import { TEMPLATES } from '../../../src/prompts/registry';
import { applyKeypointsReply, applyReplyReply, applySummaryReply } from '../../../src/platform/dev/canned/apply';
import { patListText } from '../../../src/domain/tutor/patList';

const TEXT = 'Hi Laura, I fully understand that your team is busy with the year-end closing. The setup takes about two hours for your team. We discussed about a short summary for your managing director.';

const replyVars = (over: Partial<ReplyVars> = {}): ReplyVars => ({
  incoming: 'From: Laura Fischer (Head of Accounting)\nSubject: Your call yesterday\n\nCould you just send me a price list?',
  must: ['Show understanding for the busy period', 'Show how little effort it means for her team', 'Offer a short summary for the managing director'],
  words: ['setup', 'closing'],
  rule: 'Present Simple vs. Continuous: habits vs. now',
  text: TEXT,
  uiLang: 'de',
  ctx: '',
  pats: patListText(),
  ...over,
});

const ARTICLE = 'The city council approved a new budget for public transport on Monday. The plan adds forty electric buses and extends night service on six lines.';
const sumVars = (over: Partial<SummaryVars> = {}): SummaryVars => ({
  title: 'More buses for the city',
  article: ARTICLE,
  keyPoints: ['The council approved a new transport budget.', 'Forty electric buses are added.', 'Night service is extended on six lines.'],
  words: ['council'],
  rule: '',
  text: 'The council approved more money for buses. I think this is a great idea. Night buses will run on more lines.',
  uiLang: 'en',
  ctx: '',
  pats: patListText(),
  ...over,
});

describe('Pflicht- und Kernpunkte einzeln (Nachtrag learning-scientist Muss 1/2)', () => {
  it('ein Zitat, das nicht wörtlich im Text steht, macht den Punkt zu „no“; fehlende Punkte gelten als „no“', () => {
    const pts = keepPoints(
      [
        { i: 1, covered: 'yes', quote: 'your team is busy' },
        { i: 2, covered: 'partly', quote: 'it is very quick' },
        { i: 2, covered: 'yes', quote: 'two hours' },
        { i: 9, covered: 'yes', quote: 'Hi' },
      ],
      TEXT,
      3,
    );
    expect(pts).toEqual([
      { i: 1, covered: 'yes', quote: 'your team is busy' },
      { i: 2, covered: 'no', quote: '' },
      { i: 3, covered: 'no', quote: '' },
    ]);
    expect(['Yes', 'partial', 'missing', true, 7].map(coveredOf)).toEqual(['yes', 'partly', 'no', 'yes', 'no']);
  });

  it('„Das sitzt“ nur mit wörtlichem Zitat und Grund; `faithful` tolerant, Zitat nur wörtlich', () => {
    expect(keepGood({ quote: 'two hours', why: 'Konkret.' }, TEXT)).toEqual({ quote: 'two hours', why: 'Konkret.' });
    expect(keepGood({ quote: 'three hours', why: 'Konkret.' }, TEXT)).toBeNull();
    expect(faithfulOf(undefined, TEXT)).toEqual({ ok: true, quote: '', why: '' });
    expect(faithfulOf({ ok: false, quote: 'two hours', why: 'x' }, TEXT)).toEqual({ ok: false, quote: 'two hours', why: 'x' });
    expect(faithfulOf({ ok: false, quote: 'made up', why: 'x' }, TEXT).quote).toBe('');
  });
});

describe('Vorlagen', () => {
  it('sind registriert, mit Kopfzeile, Stufe und Zwischenspeicher', () => {
    for (const tpl of [applyReply, applySummary, applyKeypoints]) expect(TEMPLATES).toContain(tpl);
    expect(applyReply.build(replyVars()).split('\n')[0]).toBe('[apply-reply@1]');
    expect(applySummary.build(sumVars()).split('\n')[0]).toBe('[apply-summary@1]');
    expect(applyKeypoints.build({ title: 'x', article: ARTICLE }).split('\n')[0]).toBe('[apply-keypoints@1]');
    expect([applyReply.tier, applySummary.tier, applyKeypoints.tier]).toEqual(['default', 'default', 'quick']);
  });

  it('die eingegangene Mail steht als eigenes Feld (bis 1.600 Zeichen), der Artikel bis 6.000 Zeichen; Prompts bleiben unter dem Deckel', () => {
    const long = 'x'.repeat(5_000);
    const p = applyReply.build(replyVars({ incoming: `${'a '.repeat(900)}END-OF-MAIL ${long}` }));
    expect(p).toContain('<<<MAIL');
    expect(p).not.toContain('END-OF-MAIL');
    const s = applySummary.build(sumVars({ article: `${ARTICLE} ${'word '.repeat(2_000)}` }));
    expect(promptBytes(s)).toBeLessThan(PROMPT_MAX_BYTES);
    expect(s).toContain('Key points of the article');
  });

  it('Testantworten bestehen das Schema (Antwort, Zusammenfassung, Kernpunkte)', () => {
    const r = applyReply.schema(replyVars()).parse(JSON.parse(applyReplyReply(applyReply.build(replyVars()))));
    expect(r.points.map((p) => p.covered)).toEqual(['yes', 'yes', 'yes']);
    expect(r.edits.map((e) => e.from)).toEqual(['discussed about']);
    expect(r.used.map((u) => u.pat).sort()).toEqual(['closing', 'rule', 'setup']);
    const sv = sumVars();
    const s = applySummary.schema(sv).parse(JSON.parse(applySummaryReply(applySummary.build(sv))));
    expect(s.faithful.ok).toBe(false);
    expect(s.faithful.quote).toBe('I think this is a great idea');
    expect(s.points).toHaveLength(3);
    const k = applyKeypoints.schema({ title: 'x', article: ARTICLE }).parse(JSON.parse(applyKeypointsReply(applyKeypoints.build({ title: 'More buses', article: ARTICLE }))));
    expect(k.points).toHaveLength(3);
  });

  it('Sprachtreue: Erklärung in der Oberflächensprache, bessere Fassung auf Englisch, nie gleich dem eigenen Text', () => {
    const v = replyVars({ uiLang: 'en' });
    const base = JSON.parse(applyReplyReply(applyReply.build(v))) as Record<string, unknown>;
    expect(applyReply.schema(v).safeParse({ ...base, upgraded: TEXT }).success).toBe(false);
    expect(applyReply.schema(v).safeParse({ ...base, summary: 'Das ist eine deutsche Zusammenfassung mit vielen Wörtern und nicht englisch.' }).success).toBe(false);
    expect(applyReply.schema(v).safeParse({ ...base, points: [] }).success).toBe(false);
    expect(applyKeypoints.schema({ title: 'x', article: '' }).safeParse({ points: ['Der Rat hat ein neues Budget für den Verkehr beschlossen.', 'Forty electric buses are added.', 'Night service grows on six lines.'] }).success).toBe(false);
  });
});
