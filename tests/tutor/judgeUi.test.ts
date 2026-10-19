import { describe, expect, it } from 'vitest';
import { checkFind } from '../../src/domain/grammar/check';
import type { ExplanationModel } from '../../src/domain/explain/types';
import type { GrammarTask } from '../../src/domain/learn/types';
import { grammarLogEntry } from '../../src/domain/progress/logPatch';
import type { Diagnosis } from '../../src/domain/tutor/diagnose';
import { FEEDBACK_MAX_LINES, composeFeedback, contrastProof, type FeedbackIn } from '../../src/domain/tutor/feedback';
import { fitAltHash, judge, type JudgeCtx } from '../../src/domain/tutor/judge';
import { answer, task } from '../unit/learnHelpers';

// Tutor-Engine v3 in der Übung: Urteil mit gemerkten Antworten und `errAlt`, Rückmeldung (§2.1), Protokollfelder (§3.2).

const NO_AI: JudgeCtx['aiState'] = { available: false, confirmed: false, budgetLeft: 0 };
const AI_OK: JudgeCtx['aiState'] = { available: true, confirmed: true, budgetLeft: 5 };
const AI_NO_CONSENT: JudgeCtx['aiState'] = { available: true, confirmed: false, budgetLeft: 5 };

const used = (): GrammarTask => task({ topic: 'used-to', prompt: 'We ___ (have) a paper archive, but now everything is in the cloud.', answer: 'used to have', pat: 'used-to-past', alt: ['had'] });
const walking = (): GrammarTask =>
  task({
    topic: 'clauses-participle',
    type: 'find',
    prompt: 'Walking to work, my phone rang twice.',
    answer: 'While I was walking to work,',
    accepted: ['As I walked to work,', 'When I was walking to work,'],
    pat: 'cp.subject',
    x: {
      kind: 'find',
      err: [0, 2],
      fixed: 'While I was walking to work, my phone rang twice.',
      errAlt: [{ err: [3, 6], answer: 'I heard my phone ring twice.', accepted: ['I heard my phone ringing twice.'], why: { de: 'Auch richtig: …', en: 'Also right: …' } }],
    },
  });

describe('judge in der Übung', () => {
  it('„had“ bei used to: Auch richtig (Art other), Ziel nicht getroffen, keine Buchung', () => {
    const j = judge(used(), 'had', { fitAlt: {}, aiState: AI_OK });
    expect(j).toMatchObject({ v: 'alt_ok', kind: 'other', fitsGoal: false, book: 'none', askAi: 'no' });
  });

  it('gemerkte Antworten: Einspruch (me) → richtig, Claudes Ja (ai) → Auch richtig ohne neue Anfrage', () => {
    const t = task({ topic: 'used-to', prompt: 'We ___ (have) a paper archive.', answer: 'used to have', pat: 'used-to-past' });
    const h = fitAltHash('kept');
    const me = judge(t, 'kept', { fitAlt: { [t.key]: { [h]: { a: 'kept', t: 1, by: 'me', pv: 'x' } } }, aiState: AI_OK });
    expect(me).toMatchObject({ v: 'correct', by: 'me', book: 'full', askAi: 'no' });
    const ai = judge(t, ' Kept. ', { fitAlt: { [t.key]: { [h]: { a: 'kept', t: 1, by: 'ai', pv: 'x' } } }, aiState: AI_OK });
    expect(ai).toMatchObject({ v: 'alt_ok', by: 'ai', book: 'none', askAi: 'no' });
  });

  it('„Walking“: Korrektur im Hauptsatz (errAlt) ist gefunden und richtig, mit eigener Begründung', () => {
    const t = walking();
    const loc = checkFind(t, { tapped: [4, 4] });
    expect(loc).toMatchObject({ verdict: 'correct', found: true, altErr: [3, 6] });
    const j = judge(t, 'I heard my phone ring twice.', { fitAlt: {}, aiState: NO_AI, tapped: [3, 6] });
    expect(j.v).toBe('correct');
    expect(j.altWhy?.de).toContain('Auch richtig');
    // Die Hauptstelle bleibt die Hauptstelle; dort gilt weiter die Hauptlösung.
    expect(judge(t, 'While I was walking to work,', { fitAlt: {}, aiState: NO_AI, tapped: [0, 2] }).v).toBe('correct');
  });

  it('unsicher: automatisch nur mit Zustimmung und Budget, sonst Knopf; ohne Claude kein Knopf', () => {
    const t = task({ topic: 'used-to', prompt: 'We ___ (have) a paper archive.', answer: 'used to have', pat: 'used-to-past' });
    const g = 'used to keep';
    const auto = judge(t, g, { fitAlt: {}, aiState: AI_OK });
    const btn = judge(t, g, { fitAlt: {}, aiState: AI_NO_CONSENT });
    const none = judge(t, g, { fitAlt: {}, aiState: NO_AI });
    const dry = judge(t, g, { fitAlt: {}, aiState: { ...AI_OK, budgetLeft: 0 } });
    expect(auto).toMatchObject({ v: 'unsure', askAi: 'auto', book: 'full' });
    expect(btn.askAi).toBe('button');
    expect(dry.askAi).toBe('button');
    expect(none).toMatchObject({ v: 'unsure', askAi: 'no' });
  });

  it('Zielform-Zweitversuch zählt höchstens halb', () => {
    expect(judge(used(), 'used to have', { fitAlt: {}, aiState: NO_AI, targetRetry: true }).book).toBe('half');
  });
});

const base = (lines: ExplanationModel['lines']): ExplanationModel => ({ lines, examples: [], mark: [], ai: false, source: 'pattern' });
const FULL = base([
  { k: 'pattern', name: 'used to', formula: 'used to + Grundform' },
  { k: 'yours', given: 'use to have', text: 'Nach „used“ fehlt das d.' },
  { k: 'why', text: 'Gewohnheit in der Vergangenheit.' },
  { k: 'mistake', bad: 'use to', good: 'used to', cause: 'Form' },
  { k: 'contrast', a: 'used to', b: 'be used to', diff: 'Gewohnheit gegen gewöhnt sein' },
  { k: 'note', text: 'US-Form' },
]);
const dx = (cause: Diagnosis['cause']): Diagnosis => ({ cause, vs: null, l1: null, span: null, ops: [], conf: 'sure', known: true });
const inp = (over: Partial<FeedbackIn> = {}): FeedbackIn => ({
  base: FULL,
  v: 'wrong',
  by: 'local',
  fitsGoal: null,
  dontKnow: false,
  override: false,
  dx: null,
  pat: 'used-to-past',
  hyps: [],
  aiWhy: null,
  altWhy: null,
  askAi: 'no',
  targetTried: false,
  texts: { altNoCount: 'Zählt nicht für das geübte Muster.' },
  ...over,
});

describe('composeFeedback', () => {
  it('Reihenfolge Ziel → deine Form → Grund → ein Zusatz; höchstens drei Erklärzeilen ohne Ziel', () => {
    const out = composeFeedback(inp());
    expect(out.model.lines.map((l) => l.k)).toEqual(['pattern', 'yours', 'why', 'mistake']);
    expect(out.lines).toBeLessThanOrEqual(FEEDBACK_MAX_LINES);
  });

  it('Kontrast nur mit Beleg: Verwechslung in der Antwort oder offene Annahme', () => {
    expect(contrastProof(null, 'used-to-past', [])).toBeNull();
    expect(composeFeedback(inp()).extra).toBe('mistake');
    expect(composeFeedback(inp({ dx: dx('confuse') })).extra).toBe('contrast');
    expect(composeFeedback(inp({ hyps: [{ from: 'used-to-past', to: 'be-used-to', state: 'open' }] })).extra).toBe('contrast');
    expect(composeFeedback(inp({ hyps: [{ from: 'used-to-past', to: 'be-used-to', state: 'silent' }] })).extra).toBe('mistake');
  });

  it('Auch richtig mit anderem Muster: Hinweis „zählt nicht“, Zielform-Angebot, einmal', () => {
    const out = composeFeedback(inp({ v: 'alt_ok', fitsGoal: false }));
    expect(out.action).toBe('targetForm');
    expect(out.extra).toBe('note');
    expect(out.model.lines.some((l) => l.k === 'yours')).toBe(false);
    expect(composeFeedback(inp({ v: 'alt_ok', fitsGoal: false, targetTried: true })).action).toBe('next');
  });

  it('Claudes Ja mit getroffenem Ziel: Knopf „Zählt“; falsch/unsicher mit Knopf: „Claude fragen“; sonst Weiter', () => {
    expect(composeFeedback(inp({ v: 'alt_ok', by: 'ai', fitsGoal: true, aiWhy: 'Passt.' })).action).toBe('counts');
    expect(composeFeedback(inp({ v: 'alt_ok', by: 'ai', fitsGoal: true, aiWhy: 'Passt.' })).model.ai).toBe(true);
    expect(composeFeedback(inp({ v: 'unsure', askAi: 'button' })).action).toBe('askAi');
    expect(composeFeedback(inp({ v: 'unsure', askAi: 'button', dontKnow: true })).action).toBe('next');
    expect(composeFeedback(inp({ v: 'wrong', askAi: 'button', override: true })).action).toBe('next');
    expect(composeFeedback(inp({ v: 'correct' })).action).toBe('next');
  });
});

describe('Protokoll: v/h/vs (≤ 60 B)', () => {
  it('Urteil, Ursache und Gegenmuster landen gekürzt im Log-Eintrag; ohne tj nichts', () => {
    const e = grammarLogEntry(answer({ t: 5, verdict: 'wrong', given: 'use to have', tj: { v: 'w', h: 'form-and-more-text', vs: 'x'.repeat(80) } }));
    expect(e.v).toBe('w');
    expect(e.h).toBe('form-and-mor');
    expect(e.vs).toHaveLength(40);
    expect(new TextEncoder().encode(JSON.stringify({ v: e.v, h: e.h, vs: e.vs })).length).toBeLessThanOrEqual(80);
    const plain = grammarLogEntry(answer({ t: 6 }));
    expect('v' in plain || 'h' in plain || 'vs' in plain).toBe(false);
  });
  it('Hilfestufe `hl` nur, wenn Hilfe genutzt wurde (N2, ergänzendes Feld)', () => {
    expect(grammarLogEntry(answer({ t: 7, help: { level: 2 } })).hl).toBe(2);
    expect('hl' in grammarLogEntry(answer({ t: 8, help: { level: 0 } }))).toBe(false);
  });
});
