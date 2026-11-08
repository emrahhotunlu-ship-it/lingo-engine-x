import { describe, expect, it } from 'vitest';
import { mistakeSpot, sameGapAnswer } from '../../src/domain/grammar/mistakeSpot';
import { mistakeWhy, mistakeWhySchema, type MistakeWhyVars } from '../../src/prompts/mistakeWhy';
import { mistakeWhyReply } from '../../src/platform/dev/canned/mistakeWhy';

// Neustart E1 (Emrah 08.11.2026): „Du → richtig“, EIN Satz warum, „Gleich nochmal“.

const vars: MistakeWhyVars = {
  task: 'If the client ___ (sign) today, we will start on Monday.',
  given: 'will sign',
  answer: 'signs',
  accepted: ['signs'],
  du: 'will sign',
  richtig: 'signs',
  known: null,
  pattern: { name: 'First conditional', form: 'if + present, will + base verb' },
  clues: ['if', 'unless'],
  uiLang: 'de',
};

describe('mistakeSpot', () => {
  it('Lücke: die ganze eigene Form gegen die Lösung', () => {
    expect(mistakeSpot('will sign', 'signs')).toEqual({ du: 'will sign', richtig: 'signs' });
  });
  it('Satz: nur die abweichende Stelle', () => {
    expect(mistakeSpot('She has gone to Paris last year.', 'She went to Paris last year.')).toEqual({ du: 'has gone', richtig: 'went' });
  });
  it('fehlendes Wort: du ist leer, richtig nennt das Wort', () => {
    expect(mistakeSpot('I look forward hearing from you', 'I look forward to hearing from you')).toEqual({ du: '', richtig: 'to' });
  });
  it('gleich (Groß/klein, Satzzeichen) → kein Fehler', () => {
    expect(mistakeSpot('Signs.', 'signs')).toBeNull();
  });
  it('sehr verschieden → ganze Antwort', () => {
    const r = mistakeSpot('a b c d e f g h', 'one two three four five six seven eight');
    expect(r).toEqual({ du: 'a b c d e f g h', richtig: 'one two three four five six seven eight' });
  });
  it('Gleich nochmal: gleiche Antwort trotz Groß/klein und Apostroph', () => {
    expect(sameGapAnswer("Hasn’t", "hasn't")).toBe(true);
    expect(sameGapAnswer('has', "hasn't")).toBe(false);
    expect(sameGapAnswer('  ', '')).toBe(false);
    expect(sameGapAnswer('will not', "won't")).toBe(true);
    expect(sameGapAnswer("haven't heard", 'have not heard')).toBe(true);
    expect(sameGapAnswer('was', 'were', ['was'])).toBe(true);
  });
});

describe('mistake-why@1', () => {
  it('Kopfzeile und Stellen im Prompt', () => {
    const p = mistakeWhy.build(vars);
    expect(p.startsWith('[mistake-why@1]')).toBe(true);
    expect(p).toContain('Wrong part (learner): will sign');
    expect(p).toContain('Correct part: signs');
    expect(p).not.toContain('Known explanation');
  });
  it('hinterlegte Erklärung wird mitgegeben', () => {
    expect(mistakeWhy.build({ ...vars, known: 'Im if-Teil steht kein will.' })).toContain('Im if-Teil steht kein will.');
  });
  const ok = {
    warum: { de: '„will sign“ nennt die Zukunft, aber nach „if“ steht im Bedingungsteil die einfache Form „signs“.', en: '“will sign” marks the future, but after “if” the condition takes the simple form “signs”.' },
    alsoOk: false,
    nochmal: { en: 'If the demo ___ (go) well, they will ask for a quote.', answer: 'goes', accepted: [] },
  };
  it('gültige Antwort', () => {
    const r = mistakeWhySchema(vars).safeParse(ok);
    expect(r.success).toBe(true);
    expect(r.success && r.data.nochmal).toEqual(ok.nochmal);
  });
  it('Zirkelschluss ohne Hinweis aus dem Satz → Schemafehler', () => {
    const r = mistakeWhySchema(vars).safeParse({ ...ok, warum: { de: '„will sign“ passt nicht, richtig ist „signs“.', en: '“will sign” is wrong, “signs” is right.' } });
    expect(r.success).toBe(false);
  });
  it('kurze eigene Form muss genannt sein (nur die Lösung reicht nicht)', () => {
    const r = mistakeWhySchema(vars).safeParse({ ...ok, warum: { de: 'Nach „if“ steht für heute die einfache Form „signs“.', en: 'After “if” today takes the simple form “signs”.' } });
    expect(r.success).toBe(false);
  });
  it('ohne Signalwort im Satz keine Hinweis-Pflicht (h in hour)', () => {
    const v2 = { ...vars, task: 'We waited for ___ hour.', given: 'a', answer: 'an', du: 'a', richtig: 'an', clues: ['an'] };
    const r = mistakeWhySchema({ ...v2, clues: [] }).safeParse({ ...ok, warum: { de: '„a“ passt nicht: das h in hour wird nicht gesprochen, also an.', en: '“a” does not fit: the h in hour is silent, so an.' } });
    expect(r.success).toBe(true);
  });
  it('Abkürzung „z. B.“ zählt nicht als zweiter Satz', () => {
    const r = mistakeWhySchema(vars).safeParse({ ...ok, warum: { ...ok.warum, de: '„will sign“ passt nach „if“ nicht, dort steht z. B. „signs“ für heute.' } });
    expect(r.success).toBe(true);
  });
  it('auch richtig: kein erfundener Grund nötig, kein Gleich nochmal', () => {
    const r = mistakeWhySchema(vars).safeParse({ warum: { de: '„will sign“ ist hier auch möglich.', en: '“will sign” is also possible here.' }, alsoOk: true, nochmal: ok.nochmal });
    expect(r.success).toBe(true);
    expect(r.success && r.data.alsoOk).toBe(true);
    expect(r.success && r.data.nochmal).toBeNull();
  });
  it('allgemeine Regel ohne eigene Form → Schemafehler (genau ein Neuversuch)', () => {
    const r = mistakeWhySchema(vars).safeParse({ ...ok, warum: { de: 'Im Bedingungssatz steht das Präsens.', en: 'The if-clause takes the present.' } });
    expect(r.success).toBe(false);
  });
  it('zwei Sätze → Schemafehler', () => {
    const r = mistakeWhySchema(vars).safeParse({ ...ok, warum: { ...ok.warum, de: 'Hier passt „signs“. Denn nach if steht kein will.' } });
    expect(r.success).toBe(false);
  });
  it('falsche Sprache → Schemafehler', () => {
    const r = mistakeWhySchema(vars).safeParse({ ...ok, warum: { de: ok.warum.en, en: ok.warum.en } });
    expect(r.success).toBe(false);
  });
  it('unbrauchbares „Gleich nochmal“ fällt still weg', () => {
    for (const bad of [null, { en: 'No gap in this sentence at all here.', answer: 'x' }, { en: vars.task, answer: 'signs' }, { en: 'If ___ (go) ___ well, fine.', answer: 'goes' }]) {
      const r = mistakeWhySchema(vars).safeParse({ ...ok, nochmal: bad });
      expect(r.success && r.data.nochmal).toBeNull();
    }
  });
  it('Umformung: Ausgangssatz → Rahmen darf länger sein', () => {
    const en = 'People believe the merger will save money. → The merger ___ save money. (BELIEVED)';
    const r = mistakeWhySchema(vars).safeParse({ ...ok, nochmal: { en, answer: 'is believed to', accepted: [] } });
    expect(r.success && r.data.nochmal?.en).toBe(en);
  });
  it('Testantwort der Entwicklungsumgebung besteht das Schema', () => {
    const r = mistakeWhySchema(vars).safeParse(JSON.parse(mistakeWhyReply(mistakeWhy.build(vars))));
    expect(r.success).toBe(true);
  });
});
