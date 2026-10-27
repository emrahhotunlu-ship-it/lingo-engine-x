import { beforeEach, describe, expect, it } from 'vitest';
import type { GrammarTask } from '../../src/domain/learn/types';
import { poolIntake, poolTasks } from '../../src/domain/grammar/pool';
import { dailyOpenTasks } from '../../src/domain/plan/dailyIntake';
import { changedRegions, checkErrorSentence, isSlipRegion, qTokens, whyCut } from '../../src/domain/quality/errorSentence';
import { gateTask, holdBackRepair, holdBackTask, resetGateReports } from '../../src/domain/quality/gate';
import { deEnMismatch, duplicates } from '../../src/domain/quality/match';
import { denglisch, longForms } from '../../src/domain/quality/register';
import { answerWords, checkGap, wordSpan } from '../../src/domain/quality/unambiguous';
import { absoluteClaims, duSieMix } from '../../src/domain/quality/wording';
import { repairsFromEdits, type Edit } from '../../src/domain/tutor/edits';
import { clearLog, getLog } from '../../src/platform/diagnostics';
import { berlin } from './helpers';

// E1a Qualitätstor: reine Prüfungen (src/domain/quality) und die Sperre für erzeugte Aufgaben und Fehlersätze.

describe('Einfehler-Regel (Fehlersätze)', () => {
  it('genau ein Fehler: kein Befund', () => {
    expect(checkErrorSentence({ wrong: 'We discussed about the budget.', right: 'We discussed the budget.', why: 'discuss steht ohne about.' })).toEqual([]);
  });
  it('kein Fehler, zwei Fehler, Tippfehler-Mix, abgeschnittene Begründung', () => {
    expect(checkErrorSentence({ wrong: 'We met  yesterday.', right: 'we met yesterday.' })).toEqual(['no_error']);
    expect(checkErrorSentence({ wrong: 'He go to the office every days.', right: 'He goes to the office every day.' })).toContain('multi_error');
    const mix = checkErrorSentence({ wrong: 'We recieve the files from our partner since two weeks.', right: 'We have received the files from our partner for two weeks.' });
    expect(mix).toContain('multi_error');
    expect(checkErrorSentence({ wrong: 'She recieve the file.', right: 'She receives the file.' })).toEqual([]);
    expect(checkErrorSentence({ wrong: 'a', right: 'b', kinds: ['grammar', 'spelling'] })).toEqual(['multi_error', 'typo_mix']);
    expect(checkErrorSentence({ wrong: 'We discussed about it.', right: 'We discussed it.', why: 'Nach discuss steht kein about, weil man das Ver…' })).toEqual(['why_cut']);
  });
  it('Bausteine: Tokens, Stellen, Tippfehler-Erkennung, abgeschnitten', () => {
    expect(qTokens("It's done, isn't it?")).toEqual(["it's", 'done', ',', "isn't", 'it', '?']);
    expect(changedRegions(['a', 'b', 'c'], ['a', 'x', 'c'])).toEqual([{ del: ['b'], ins: ['x'], gap: 1 }]);
    expect(checkErrorSentence({ wrong: 'Only when the client signs we can start.', right: 'Only when the client signs can we start.' })).toEqual([]);
    expect(checkErrorSentence({ wrong: 'Not only it saves time.', right: 'Not only does it save time.' })).toEqual([]);
    expect(whyCut('Richtig: No sooner had we left than …')).toBe(false);
    expect(isSlipRegion({ del: ['recieve'], ins: ['receive'] })).toBe(true);
    expect(isSlipRegion({ del: ['discuss'], ins: ['discussed'] })).toBe(false);
    expect(isSlipRegion({ del: [','], ins: [] })).toBe(true);
    expect(whyCut('Das ist so.')).toBe(false);
    expect(whyCut('Nach in case steht das Present, und')).toBe(true);
    expect(whyCut('Nach in case steht da...')).toBe(true);
    expect(whyCut(null)).toBe(false);
  });
});

describe('Eindeutigkeit', () => {
  it('mehrteilige Lücke ohne Hinweis, zwei richtige Optionen, Lücken- und Wortzahl', () => {
    expect(checkGap({ prompt: 'We ___ the report yesterday.', answer: 'had sent' })).toEqual(['gap_no_hint']);
    expect(checkGap({ prompt: 'She works ___ a lawyer.', answer: 'as' })).toEqual([]);
    expect(checkGap({ prompt: 'We ___ (send) the report.', answer: 'had sent' })).toEqual([]);
    expect(checkGap({ prompt: 'We ___ the report.', answer: 'had sent', options: ['had sent', 'sent', 'have sent'], accepted: ['sent'] })).toEqual(['several_correct']);
    expect(checkGap({ prompt: 'x ___ y', answer: 'a', options: ['a', 'A', 'b'] })).toEqual(['several_correct']);
    expect(checkGap({ prompt: 'If I ___ known, I ___ come.', answer: 'had' })).toEqual(['slot_count']);
    expect(checkGap({ prompt: 'If I ___ known, I ___ come.', answer: 'had / would have', hint: 'third conditional' })).toEqual([]);
    expect(checkGap({ prompt: 'We ___ meet on Fridays. (3 words)', answer: 'used to meet', accepted: ['had'] })).toEqual(['slot_count']);
    expect(checkGap({ prompt: 'Rewrite ___ .', answer: 'had been sent', hasSource: true })).toEqual([]);
  });
  it('Wortzahl lesen', () => {
    expect(wordSpan('(3 words)')).toEqual([3, 3]);
    expect(wordSpan('2–4 Wörter')).toEqual([2, 4]);
    expect(wordSpan('three words')).toEqual([3, 3]);
    expect(wordSpan('send')).toBeNull();
    expect(answerWords("don't have to")).toBe(3);
  });
});

describe('Register, Denglisch, absolute Regeln, du/Sie, Dubletten, DE/EN', () => {
  it('Langformen in Sprechformeln', () => {
    expect(longForms('Let us start with the numbers.')).toEqual(["let's"]);
    expect(longForms('Please let us know by Friday.')).toEqual([]);
    expect(longForms('I am not sure we will make it.')).toEqual(["I'm", "we'll/you'll/they'll"]);
    expect(longForms("Let's go, I'm in.")).toEqual([]);
    expect(longForms('It is what it is.')).toEqual(["it's/that's/there's"]);
  });
  it('Denglisch', () => {
    expect(denglisch('We offer an audit-proof archive.')).toEqual(['tamper-proof / legally compliant']);
    expect(denglisch('Please switch on the beamer.')).toEqual(['projector']);
    expect(denglisch('That is a handy tool.')).toEqual([]);
    expect(denglisch('What is your handy number?')).toEqual(['cell phone']);
    expect(denglisch('I work here since 3 years.')).toEqual(['for … years']);
    expect(denglisch('A tamper-proof archive.')).toEqual([]);
  });
  it('absolute Regeln', () => {
    expect(absoluteClaims('Nach since steht immer das Present Perfect.')).toEqual(['immer']);
    expect(absoluteClaims('Das gilt nicht nur hier.')).toEqual([]);
    expect(absoluteClaims('Use never with a positive verb; only then.')).toEqual(['never', 'only']);
    expect(absoluteClaims('Das ist meist so.')).toEqual([]);
  });
  it('du/Sie gemischt', () => {
    expect(duSieMix('Du bittest um einen Rabatt. Können Sie mir helfen?')).toBe(true);
    expect(duSieMix('Du bittest um einen Rabatt. Sie sagt nein.')).toBe(false);
    expect(duSieMix('Bitte prüfen Sie den Vertrag und melden Sie sich.')).toBe(false);
    expect(duSieMix('Du sagst: „Könnten Sie mir helfen?“')).toBe(false);
  });
  it('Dubletten und DE/EN-Abgleich', () => {
    expect(duplicates([{ id: 'a', text: 'Hello, world!' }, { id: 'b', text: 'hello world' }, { id: 'c', text: 'x' }])).toEqual([['a', 'b']]);
    expect(deEnMismatch('Bedenken ausräumen', 'to address concerns')).toEqual([]);
    expect(deEnMismatch('der Vorschlag', 'to propose')).toEqual(['pos']);
    expect(deEnMismatch('die Rechnungen', 'an invoice')).toEqual(['number']);
    expect(deEnMismatch('eine Rechnung', 'invoices')).toEqual(['number']);
    expect(deEnMismatch('eine Rechnung', 'an invoice')).toEqual([]);
  });
});

const task = (over: Partial<GrammarTask> = {}): GrammarTask => ({
  key: 'k',
  topic: 'passive',
  type: 'gap',
  prompt: 'The report ___ (send) yesterday.',
  answer: 'was sent',
  accepted: [],
  options: null,
  hint: null,
  expl: { de: 'x', en: 'y' },
  src: 'daily',
  ref: null,
  errorT: null,
  ...over,
});

describe('Qualitätstor: Sperre statt Warnung', () => {
  beforeEach(() => {
    resetGateReports();
    clearLog();
  });

  it('gateTask bündelt lintTask und die neuen Prüfungen', () => {
    expect(gateTask(task())).toEqual([]);
    expect(gateTask(task({ prompt: 'The report ___ yesterday.' }))).toEqual(expect.arrayContaining(['lint:no_verb', 'gap:gap_no_hint']));
    expect(gateTask(task({ prompt: 'We switched on the beamer and ___ (start).', answer: 'started' }))).toContain('denglisch');
    expect(gateTask(task({ type: 'correct', prompt: 'He go to work every days.', answer: 'He goes to work every day.', goal: { de: 'x', en: 'y' } }))).toContain('err:multi_error');
  });

  it('holdBackTask meldet je Aufgabe einmal (logWarn), nie still', () => {
    const bad = task({ prompt: 'The report ___ yesterday.' });
    expect(holdBackTask(bad, 'daily/2026-09-27')).toBe(true);
    expect(holdBackTask(bad, 'daily/2026-09-27')).toBe(true);
    const warns = getLog().filter((e) => e.scope === 'quality:gate');
    expect(warns).toHaveLength(1);
    expect(warns[0]?.level).toBe('warn');
    expect(holdBackTask(task(), 'daily/2026-09-27')).toBe(false);
  });

  it('Tagesauftrag: gesperrte Aufgabe kommt weder in den Pool noch in die Runde, zählt als bad', () => {
    const now = berlin('2026-09-28', 10);
    const ok = { topic: 'passive', type: 'gap', prompt: 'The report ___ (send) yesterday.', answer: 'was sent', explanation_de: 'x', explanation_en: 'y' };
    const bad = { topic: 'passive', type: 'gap', prompt: 'The files ___ yesterday.', answer: 'were sent', explanation_de: 'x', explanation_en: 'y' };
    const r = poolIntake(undefined, [{ day: '2026-09-27', src: 'daily', items: [ok, bad] }], new Map(), now);
    expect(r.added).toBe(1);
    expect(r.bad).toBe(1);
    const open = dailyOpenTasks(new Map([['2026-09-27', { grammarItems: [ok, bad] }]]), new Map(), now);
    expect(open.map((t) => t.answer)).toEqual(['was sent']);
    expect(poolTasks({ items: [ok, bad] }).map((t) => t.answer)).toEqual(['was sent']);
    expect(getLog().some((e) => e.scope === 'quality:gate')).toBe(true);
  });

  it('Fehlersätze aus eigenen Texten: mehrere Fehler oder Tippfehler-Mix werden zurückgehalten', () => {
    const E = (from: string, to: string, kind: Edit['kind'] = 'grammar'): Edit => ({ from, to, kind, sev: 'error', pat: null, why: 'Weil es so ist.' });
    const text = 'We discussed about the budget. He go to work every days.';
    const made = repairsFromEdits(text, [E('discussed about', 'discussed'), E('go', 'goes'), E('every days', 'every day')], 'clinic', 2);
    expect(made.map((m) => m.wrong)).toEqual(['We discussed about the budget.']);
    expect(holdBackRepair({ wrong: 'I recieve the file.', right: 'I receive the files.', kinds: ['spelling', 'grammar'] }, 'clinic')).toBe(true);
    expect(getLog().filter((e) => e.scope === 'quality:gate').length).toBeGreaterThanOrEqual(2);
  });
});
