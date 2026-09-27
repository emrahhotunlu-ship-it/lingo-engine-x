import { describe, expect, it } from 'vitest';
import { mailRefineReply, phraseAdaptReply, pitchFeedbackReply, pitchScriptReply } from '../../src/platform/dev/cannedBiz';
import { PROMPT_MAX_BYTES, promptBytes } from '../../src/prompts/common';
import { mailRefine, mailRefineExample, mailRefineSchema, type MailRefineVars } from '../../src/prompts/mailRefine';
import { phraseAdapt, phraseAdaptExample, phraseAdaptSchema } from '../../src/prompts/phraseAdapt';
import { pitchFeedback, pitchFeedbackExample, pitchFeedbackSchema, type PitchFeedbackVars } from '../../src/prompts/pitchFeedback';
import { pitchScript, PITCH_SCRIPT_EXAMPLE, pitchScriptSchema } from '../../src/prompts/pitchScript';
import { segmentMail } from '../../src/domain/business/mailCompose';

// Business-Vorlagen (Plan §6.2, §9.1): Kopfzeile, Beispiel besteht das Schema, Satzabdeckung im
// Refiner, `phrase` ⊂ `text`, Sprachtreue, Größe.

const MAIL = 'Dear Mr Walker,\n\nThe scanners come two weeks later because our supplier has problems. We must delay the training too.\n\nBest regards\nEmrah';

describe('mail-refine@1', () => {
  const vars = (uiLang: 'de' | 'en'): MailRefineVars => ({ segments: segmentMail(MAIL).map((s) => ({ i: s.i, text: s.text })), recipient: 'client', intent: 'inform', uiLang });

  it('Kopfzeile, nummerierte Bausteine, default, zwischengespeichert', () => {
    const p = mailRefine.build(vars('de'));
    expect(p.split('\n')[0]).toBe('[mail-refine@2]');
    expect(p).toContain('[0] Dear Mr Walker,');
    expect(mailRefine.tier).toBe('default');
    const big = mailRefine.build({ ...vars('de'), segments: Array.from({ length: 25 }, (_, i) => ({ i, text: 'word '.repeat(200) })) });
    expect(promptBytes(big)).toBeLessThan(PROMPT_MAX_BYTES);
  });

  it('Beispiel (für zwei Bausteine) und feste Antwort bestehen das Schema (DE und EN)', () => {
    for (const uiLang of ['de', 'en'] as const) {
      const two = { ...vars(uiLang), segments: [{ i: 0, text: 'Dear Mr Walker,' }, { i: 1, text: 'The scanners come later.' }] };
      expect(mailRefineSchema(two).safeParse(JSON.parse(mailRefineExample(uiLang))).success).toBe(true);
      const r = mailRefineSchema(vars(uiLang)).safeParse(JSON.parse(mailRefineReply(mailRefine.build(vars(uiLang)))));
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    }
  });

  it('Satzabdeckung: jeder Baustein genau einmal', () => {
    const v = vars('de');
    const ok = JSON.parse(mailRefineReply(mailRefine.build(v))) as { segments: Array<{ i: number }>; tone: string };
    expect(mailRefineSchema(v).safeParse({ ...ok, segments: ok.segments.slice(1) }).success).toBe(false);
    expect(mailRefineSchema(v).safeParse({ ...ok, segments: [...ok.segments, ok.segments[0]] }).success).toBe(false);
  });

  it('phrase ⊂ text, 2–3 Optionen außer bei ok, Erklärung in der Oberflächensprache', () => {
    const v = { ...vars('de'), segments: [{ i: 0, text: 'The scanners come later.' }] };
    const opt = (text: string, phrase: string) => ({ text, register: 'formal', why: 'Höflicher Einstieg in die Nachricht.', phrase, de: phrase ? 'leider' : '', def: phrase ? 'a polite softener' : '' });
    const good = { segments: [{ i: 0, status: 'stiff', options: [opt("I'm afraid the scanners will arrive later.", "I'm afraid"), opt('The scanners are delayed.', '')] }], tone: 'Freundlich, aber zu direkt für einen Kunden.' };
    expect(mailRefineSchema(v).safeParse(good).success).toBe(true);
    expect(mailRefineSchema(v).safeParse({ ...good, segments: [{ i: 0, status: 'stiff', options: [opt('The scanners are delayed.', 'behind schedule'), opt('Later.', '')] }] }).success).toBe(false);
    expect(mailRefineSchema(v).safeParse({ ...good, segments: [{ i: 0, status: 'stiff', options: [opt('The scanners are delayed.', '')] }] }).success).toBe(false);
    expect(mailRefineSchema(v).safeParse({ ...good, tone: 'Friendly, but too direct for a client in two places.' }).success).toBe(false);
  });
});

describe('phrase-adapt@1', () => {
  it('Kopfzeile, quick, nie zwischengespeichert; Beispiel und feste Antwort bestehen das Schema', () => {
    const p = phraseAdapt.build({ question: 'Saying no', phrases: ['what we can do instead is'], situation: 'A client wants a free extra module.', uiLang: 'de' });
    expect(p.split('\n')[0]).toBe('[phrase-adapt@1]');
    expect(phraseAdapt.tier).toBe('quick');
    expect(phraseAdapt.cache).toBe(false);
    for (const uiLang of ['de', 'en'] as const) {
      expect(phraseAdaptSchema(uiLang).safeParse(JSON.parse(phraseAdaptExample(uiLang))).success).toBe(true);
      const pl = phraseAdapt.build({ question: 'Saying no', phrases: ['what we can do instead is'], situation: 'A client wants a free extra module.', uiLang });
      expect(phraseAdaptSchema(uiLang).safeParse(JSON.parse(phraseAdaptReply(pl))).success).toBe(true);
    }
  });

  it('ex muss en enthalten', () => {
    const bad = JSON.parse(phraseAdaptExample('de')) as { phrases: Array<Record<string, string>> };
    bad.phrases[0]!.ex = 'Something completely different.';
    expect(phraseAdaptSchema('de').safeParse(bad).success).toBe(false);
  });
});

describe('pitch-script@2 und pitch-feedback@2', () => {
  it('Skript: Kopfzeile, Beispiel und feste Antwort bestehen das Schema, keyPhrases.ex ⊃ en', () => {
    const p = pitchScript.build({ slide: 'Cloud archive for small businesses. Setup in one day.', audience: 'clients', minutes: 2, uiLang: 'de' });
    expect(p.split('\n')[0]).toBe('[pitch-script@2]');
    expect(pitchScriptSchema.safeParse(JSON.parse(PITCH_SCRIPT_EXAMPLE)).success).toBe(true);
    expect(pitchScriptSchema.safeParse(JSON.parse(pitchScriptReply(p))).success).toBe(true);
    const bad = JSON.parse(PITCH_SCRIPT_EXAMPLE) as { keyPhrases: Array<Record<string, string>> };
    bad.keyPhrases[0]!.ex = 'Nothing here.';
    expect(pitchScriptSchema.safeParse(bad).success).toBe(false);
  });

  const fbVars = (uiLang: 'de' | 'en', attempt = 'Our archive is in one day installed and small businesses start quickly.'): PitchFeedbackVars => ({
    points: ['Cloud archive for small businesses', 'Setup in one day', 'GDPR-compliant retention'],
    model: 'Let me start with the problem.',
    attempt,
    uiLang,
  });

  it('Rückmeldung: Beispiel und feste Antwort bestehen das Schema (DE und EN), Punkte aus der Liste', () => {
    for (const uiLang of ['de', 'en'] as const) {
      const ex = pitchFeedbackSchema(fbVars(uiLang)).safeParse(JSON.parse(pitchFeedbackExample(uiLang)));
      expect(ex.success, JSON.stringify(ex.error?.issues)).toBe(true);
      const r = pitchFeedbackSchema(fbVars(uiLang, 'We must explain the setup in one day for small businesses.')).safeParse(
        JSON.parse(pitchFeedbackReply(pitchFeedback.build(fbVars(uiLang, 'We must explain the setup in one day for small businesses.')))),
      );
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    }
    const bad = JSON.parse(pitchFeedbackExample('de')) as { coverage: Array<Record<string, unknown>> };
    bad.coverage[0]!.point = 'A point that was never on the slide';
    expect(pitchFeedbackSchema(fbVars('de')).safeParse(bad).success).toBe(false);
  });
});
