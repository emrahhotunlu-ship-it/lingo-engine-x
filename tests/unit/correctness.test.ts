import { describe, expect, it } from 'vitest';
import { FALSE_FRIENDS, falseFriendLines } from '../../src/content/falseFriends';
import { britishSpelling, toUSText } from '../../src/domain/text/british';
import { auxFormErrors, auxFormEvent } from '../../src/domain/text/auxForm';
import { agreementProblem, articleProblem, fixedPasses, fixedProblem, fixedProblems, usOutput } from '../../src/domain/text/correctness';

// Auswertung 15.10.2026, Punkt 1: Selbstprüfung der korrigierten Fassung. Beispiele aus Emrahs echten Korrekturen (ohne Namen).

describe('fixedProblems – bekannte Fehler in der „richtigen“ Fassung', () => {
  it('Subjekt-Verb: „the list … are needed“ besteht nicht, „is needed“ besteht', () => {
    expect(fixedPasses('Hi John, the list with the document types are needed by Friday.')).toBe(false);
    expect(fixedProblems('The list of open tasks are needed by Friday.')[0]?.id).toBe('agreement');
    expect(fixedPasses('Hi John, the list with the document types is needed by Friday.')).toBe(true);
    expect(fixedPasses('The list of items that are needed is attached.')).toBe(true);
    expect(fixedPasses('A number of customers are waiting.')).toBe(true);
    expect(agreementProblem('The number of customers are growing.')).toContain('singular');
    expect(agreementProblem('These issues is critical.')).toContain('plural');
    expect(agreementProblem('One of the customers are unhappy.')).toContain('singular');
  });

  it('falsche Freunde: „I suggest absolving“, „eventually“ im Sinn von eventuell', () => {
    expect(fixedProblems('I suggest absolving the training in March.')[0]?.id).toBe('false_friend');
    expect(fixedPasses('We can eventually offer a discount.')).toBe(false);
    expect(fixedPasses('Eventually, we could move the deadline.')).toBe(false);
    expect(fixedPasses('Eventually, the product stability is good.')).toBe(true);
    expect(fixedPasses('After the last bug fixes, we eventually shipped the release.')).toBe(true);
    expect(fixedPasses('We should act consistently and follow up.')).toBe(true);
    expect(fixedPasses('We act consequently.')).toBe(false);
    expect(fixedPasses('You have the possibility to cancel.')).toBe(false);
    expect(fixedPasses('You have the option to cancel.')).toBe(true);
    expect(fixedPasses('This is sensitive data.')).toBe(true);
    expect(fixedPasses('This is sensible data.')).toBe(false);
    expect(fixedPasses('At first, we need to clarify the scope.')).toBe(false);
    expect(fixedPasses('At first I was skeptical, but then it worked.')).toBe(true);
    expect(fixedPasses('I will see you bald.')).toBe(false);
    expect(fixedPasses('I called my chef yesterday.')).toBe(false);
    expect(fixedPasses('We need a handy tool for this.')).toBe(true);
    expect(fixedPasses('I forgot my handy at home.')).toBe(false);
  });

  it('fehlender Artikel: „you have gut feeling“', () => {
    expect(fixedPasses('With such a system you have gut feeling because your documents are stored securely.')).toBe(false);
    expect(fixedPasses('With such a system you have a gut feeling that your documents are stored securely.')).toBe(true);
  });

  it('Deutsch-Fehler aus produce.ts', () => {
    expect(fixedPasses('We discussed about the offer.')).toBe(false);
    expect(fixedPasses('Please send me the informations.')).toBe(false);
    expect(fixedPasses('It depends on the budget.')).toBe(true);
    expect(fixedPasses('It depends of the budget.')).toBe(false);
    expect(fixedPasses('I am looking forward for your reply.')).toBe(false);
    expect(fixedPasses('I look forward to seeing you.')).toBe(true);
    expect(fixedPasses('I look forward to meet you.')).toBe(false);
    expect(fixedPasses('In the end of the day it is a cost question.')).toBe(false);
    // Unsichere Muster (if_will, want_that, since_duration) sperren nicht
    expect(fixedPasses('I am not sure if he will come.')).toBe(true);
    expect(fixedPasses('Is there anything else you want that we haven’t covered?')).toBe(true);
  });

  it('a/an', () => {
    expect(articleProblem('We need an new contract.')).toContain('use "a new"');
    expect(articleProblem('She is a engineer.')).toContain('an engineer');
    expect(articleProblem('It is a university project, an hour long, an HR topic, a URL, an SLA.')).toBeNull();
    expect(articleProblem('He is an honest manager and a user of the tool.')).toBeNull();
    expect(articleProblem('Send it to a SLA owner.')).toContain('an SLA');
  });

  it('Verbform nach Hilfsverb in der korrigierten Fassung', () => {
    expect(fixedPasses('We will worked on it tomorrow.')).toBe(false);
    expect(fixedPasses('By Friday we will have worked on it.')).toBe(true);
    expect(fixedPasses('If they had left earlier, they would not missed the train.')).toBe(false);
    expect(fixedPasses('Having wrote the report, he left.')).toBe(false);
    expect(fixedPasses('Having written the report, he left.')).toBe(true);
    expect(fixedPasses('I have catched the error.')).toBe(false);
    expect(fixedPasses('They have write access to the folder.')).toBe(true);
  });

  it('fixedProblem liefert eine Fehlerbeschreibung für den einen Neuversuch, sonst null', () => {
    expect(fixedProblem('The report is ready.')).toBeNull();
    expect(fixedProblem('We discussed about it.')).toContain('fixed still contains an error');
  });
});

describe('Liste der falschen Freunde (Daten)', () => {
  it('jeder Eintrag ist vollständig, die Muster treffen ihre Beispiele', () => {
    expect(FALSE_FRIENDS.length).toBeGreaterThanOrEqual(15);
    for (const f of FALSE_FRIENDS) {
      expect(f.word).toBeTruthy();
      expect(f.de).toBeTruthy();
      expect(f.en).toBeTruthy();
    }
    const words = FALSE_FRIENDS.map((f) => f.word);
    for (const w of ['eventually', 'actual', 'absolve', 'at first', 'become', 'chef', 'control', 'consequent', 'possibility', 'sensible', 'handy', 'gift', 'bald']) expect(words).toContain(w);
    expect(falseFriendLines().some((l) => l.includes('"eventually" is NOT German "eventuell"'))).toBe(true);
  });
});

describe('Britisch → US (gemeinsame Funktion)', () => {
  it('erkennt und wandelt', () => {
    expect(britishSpelling('this may be jeopardising the deal')).toBe('jeopardising');
    expect(toUSText('This may be jeopardising the colour and the organisation.')).toBe('This may be jeopardizing the color and the organization.');
    expect(toUSText('Analyses of the data were clear. Realise it.')).toBe('Analyses of the data were clear. Realize it.');
    expect(usOutput('We are jeopardising it.')).toBe('We are jeopardizing it.');
    expect(usOutput('We are jeopardizing it.')).toBe('We are jeopardizing it.');
  });
});

describe('Verbform nach Hilfsverb (Radar-Muster)', () => {
  const cases: Array<[string, string]> = [
    ['will worked', 'will have worked'],
    ["wouldn't missed ", 'would not have missed'],
    ['had sign', 'If Markus had signed last year, he would have gotten the old price.'],
    ['has been felt', 'has been feeling'],
    ['have been worked', 'have been working'],
    ['Having wrote', 'Having written'],
    ['had choosen', 'chose'],
    ['have catched up', 'have caught up'],
    ["wouldn't taking on", "hadn't taken on"],
    ['will have living', 'will have been living'],
  ];
  for (const [g, a] of cases) {
    it(`erkennt „${g.trim()}“`, () => expect(auxFormEvent(g, a)).not.toBeNull());
  }
  it('erkennt Richtiges und fremde Fehler nicht', () => {
    expect(auxFormEvent("wouldn't solve your memory issue", "you wouldn't solve your memory problems")).toBeNull();
    expect(auxFormEvent('don’t', "wouldn't")).toBeNull();
    expect(auxFormEvent('used to work', 'used to work')).toBeNull();
    expect(auxFormEvent('will be worked', 'will be worked')).toBeNull();
    expect(auxFormErrors('In May working hours change. We can use it.')).toEqual([]);
  });
});
