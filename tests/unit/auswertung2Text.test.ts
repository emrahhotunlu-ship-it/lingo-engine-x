import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { FALSE_FRIENDS, falseFriendLines, FALSE_FRIEND_NOTE, PROMPT_FRIENDS } from '../../src/content/falseFriends';
import { COLLOC_GROUPS, VERB_FORMS } from '../../src/content/collocEquiv';
import { collocAlternatives } from '../../src/domain/srs/collocEquiv';
import { toUSText } from '../../src/domain/text/british';
import { agreementProblem, articleProblem, fixedPasses, fixedProblems } from '../../src/domain/text/correctness';
import { auxFormErrors, OVERREGULARIZED } from '../../src/domain/text/auxForm';
import { usSpelling } from '../../src/domain/text/lemma';
import { correctionRules, withFixedGate } from '../../src/prompts/fixedGate';
import { AUX_PATTERNS } from '../../src/content/auxForm';

// Auswertung 15.10.2026, zweite Runde: Fehlalarme der Prüfung korrigierter Fassungen (Prüfung Lernwissenschaft H3, Englischlehrer A1–A6, B1–B6, C1–C3).
// Jeder gemeldete Fehlalarm hat einen Test mit dem KORREKTEN Satz.

/** Richtige Geschäftssätze (Dokumentenmanagement, Vertrieb): keiner darf blockieren. */
const CORRECT_BUSINESS: readonly string[] = [
  // Fragen mit vorangestelltem Hilfsverb und -ing/-ed-Nomen
  'Can scanned invoices be archived automatically?',
  'Will signed contracts be stored in the DMS?',
  'Can deleted documents be restored from the recycle bin?',
  'Will pricing change next quarter?',
  'Should training be included in the offer?',
  'Will anything change for existing customers?',
  'Can archiving be automated?',
  'Will onboarding take long?',
  'Could anything change before the go-live?',
  'What will onboarding cost?',
  // have + Zusammensetzung / Nomen
  'The user has write access to the folder.',
  'She had write permissions on the archive.',
  'We will have pricing ready by Friday.',
  'We should have nothing to worry about.',
  'It would have nothing to do with the contract.',
  // Name „Will“
  'Yesterday Will was in the call with the customer.',
  // Subjekt und Verb
  'The majority of our customers are mid-sized companies.',
  'The rest of the documents are already in the archive.',
  'The list of tasks we have to do is long.',
  'The quality of the files you have is mixed.',
  'A number of issues are still open.',
  'One of the issues is the missing metadata.',
  // a / an
  'A one-off setup fee applies.',
  'We offer a one-year contract with a 30-day notice period.',
  'Option A is cheaper than Option B.',
  'Plan A and Plan B are both available.',
  'Our Series A investment closed in March.',
  'We use a SWOT analysis for every account plan.',
  'Run a SQL query against the archive.',
  'We migrated an R&D project to the new platform.',
  'Please review the summary of an M&A deal.',
  'We store the backups in an S3 bucket.',
  'You need an M365 license for this feature.',
  'We sent an hour-long demo to the customer.',
  'An unintended side effect is possible.',
  'It is a usable solution for a unanimous decision.',
  'This is an HR topic for an SLA owner.',
  // bekannte Fehler / falsche Freunde, die richtig gebraucht werden
  'We look forward to go-live next week.',
  'Phase I is complete.',
  'We could eventually expand into the US.',
  'At first I could only read it, now I can edit it.',
  'Our chef recommends the salmon at the customer dinner.',
  'That is a handy overview for the sales team.',
  'Sensible customers compare offers.',
  'We realize savings of 20 percent with the new archive.',
  'The actual situation is worse than reported.',
  'An open dialogue with the customer helps.',
  'The account manager closes the deal after the demo.',
  'She has been asking for a discount since March.',
  'The contract has been signed by both sides.',
];

describe('H3: mindestens 30 richtige Geschäftssätze blockieren nie', () => {
  it('Anzahl und jeder Satz besteht die Selbstprüfung', () => {
    expect(CORRECT_BUSINESS.length).toBeGreaterThanOrEqual(30);
    for (const s of CORRECT_BUSINESS) expect(fixedProblems(s), s).toEqual([]);
  });
  it('die echten Fehler daneben werden weiter gefunden', () => {
    for (const s of [
      'We will worked on the proposal tomorrow.',
      'We had send the contract last week.',
      'The number of customers are growing.',
      'We need a API for this.',
      'We need an university license.',
      'I am here since 3 years.',
      'Could you eventually send me the file tomorrow?',
      'The customer has been payed already.',
    ]) expect(fixedPasses(s), s).toBe(false);
  });
});

describe('A2: Verbform nach Hilfsverb (streng)', () => {
  it('has/had + write access ist eine Zusammensetzung; Modalverb am Satzanfang oder nach Fragewort ist eine Frage', () => {
    expect(auxFormErrors('The admin has write access.', { strict: true })).toEqual([]);
    expect(auxFormErrors('They had write permissions.', { strict: true })).toEqual([]);
    expect(auxFormErrors('Can scanned invoices be archived?', { strict: true })).toEqual([]);
    expect(auxFormErrors('How will pricing change?', { strict: true })).toEqual([]);
    expect(auxFormErrors('Yesterday Will was in the call.', { strict: true })).toEqual([]);
    expect(auxFormErrors('We will have pricing ready.', { strict: true })).toEqual([]);
  });
  it('echte Fehler bleiben', () => {
    expect(auxFormErrors('We will worked on it.', { strict: true })).toHaveLength(1);
    expect(auxFormErrors('They had send it.', { strict: true })).toHaveLength(1);
    expect(auxFormErrors('We had wrote the report.', { strict: true })).toHaveLength(1);
    expect(auxFormErrors('Having wrote the report, he left.', { strict: true })).toHaveLength(1);
  });
  it('singed/ringed sind echte Wörter; payed, splitted, cutted, setted, spended, choosed, lended sind Fehler', () => {
    expect(OVERREGULARIZED.has('singed')).toBe(false);
    expect(OVERREGULARIZED.has('ringed')).toBe(false);
    expect(auxFormErrors('The area was ringed by trees.', { strict: true })).toEqual([]);
    for (const w of ['payed', 'splitted', 'cutted', 'setted', 'spended', 'choosed', 'lended']) {
      expect(OVERREGULARIZED.has(w), w).toBe(true);
      expect(auxFormErrors(`We ${w} it.`, { strict: true }), w).toHaveLength(1);
    }
  });
  it('Radar-Betrieb (ohne strict): Satzteile wie „will worked“ werden weiter erkannt', () => {
    expect(auxFormErrors('will worked', { right: 'will have worked' })).toHaveLength(1);
    expect(auxFormErrors('wouldn’t missed', { right: 'would not have missed' })).toHaveLength(1);
  });
});

describe('A3: Subjekt und Verb', () => {
  it('majority/rest sind keine Singular-Köpfe; Relativsatz ohne „that“ auch nicht', () => {
    expect(agreementProblem('The majority of customers are happy.')).toBeNull();
    expect(agreementProblem('The rest of the documents are in the archive.')).toBeNull();
    expect(agreementProblem('The list of tasks we have is long.')).toBeNull();
    expect(agreementProblem('The quality of the files you have is mixed.')).toBeNull();
    expect(agreementProblem('The list of tasks to do are long.')).toContain('singular');
    expect(agreementProblem('The number of customers are growing.')).toContain('singular');
    expect(agreementProblem('One of the issues are open.')).toContain('singular');
  });
});

describe('A4: a / an', () => {
  it('richtige Fälle', () => {
    for (const s of [
      'It is a one-off fee.',
      'A one-time setup fee applies.',
      'A once-in-a-lifetime deal.',
      'Option A is cheaper.',
      'Plan A and Plan B.',
      'Series A investment.',
      'a SWOT analysis',
      'a SIM card',
      'a SQL query',
      'a SKU list',
      'a SEPA transfer',
      'an R&D project',
      'an M&A deal',
      'an S3 bucket',
      'an M365 license',
      'a usable tool',
      'a unanimous vote',
      'an unintended effect',
      'an uninterrupted service',
      'a B2B customer',
      'a EULA',
    ]) expect(articleProblem(s), s).toBeNull();
  });
  it('echte Fehler: a API, a ERP, a IT department, an university, an unique, an European, an used', () => {
    expect(articleProblem('We need a API.')).toContain('an API');
    expect(articleProblem('We run a ERP system.')).toContain('an ERP');
    expect(articleProblem('She joined a IT department.')).toContain('an IT');
    expect(articleProblem('He studied at an university.')).toContain('a university');
    expect(articleProblem('It is an unique feature.')).toContain('a unique');
    expect(articleProblem('It is an European standard.')).toContain('a European');
    expect(articleProblem('It is an used car.')).toContain('a used');
    expect(articleProblem('She works for an UX team.')).toContain('a UX');
  });
});

describe('C1: bekannte Fehler', () => {
  it('neue Muster', () => {
    expect(fixedPasses('We are customers since 3 years.')).toBe(false);
    expect(fixedPasses('We have been customers for 3 years.')).toBe(true);
    expect(fixedPasses('I know how it looks like.')).toBe(false);
    expect(fixedPasses('I know how it looks.')).toBe(true);
    expect(fixedPasses('According to me, the offer is fine.')).toBe(false);
    expect(fixedPasses('In my opinion, the offer is fine.')).toBe(true);
    expect(fixedPasses('Please make a photo of the contract.')).toBe(false);
    expect(fixedPasses('Please take a photo of the contract.')).toBe(true);
    expect(fixedPasses('We want to make a photo book for the team.')).toBe(true);
    expect(fixedPasses('I has the file.')).toBe(false);
    expect(fixedPasses('Phase I is complete.')).toBe(true);
  });
});

describe('A1: gleichwertige Wortpartner nur in der Form der Lücke', () => {
  const at = (sentence: string, gap: string) => ({ sentence, start: sentence.indexOf(gap) });
  it('„hit“ als Grundform nach to: nur Grundformen, nie met/made/beaten', () => {
    const alts = collocAlternatives('hit a deadline', 'hit', at('We need to hit the deadline.', 'hit'));
    expect(alts).toEqual(expect.arrayContaining(['meet', 'make', 'beat']));
    expect(alts).not.toEqual(expect.arrayContaining(['met']));
    expect(alts).not.toContain('made');
    expect(alts).not.toContain('beaten');
  });
  it('nach have: Partizip', () => {
    const alts = collocAlternatives('hit a deadline', 'hit', at('We have hit the deadline.', 'hit'));
    expect(alts).toEqual(expect.arrayContaining(['met', 'made', 'beaten']));
    expect(alts).not.toContain('meet');
  });
  it('ohne Wort davor: Wendung in Grundform → Grundform; sonst nur gleiche Form an allen Stellen', () => {
    expect(collocAlternatives('hit a deadline', 'hit')).toEqual(expect.arrayContaining(['meet', 'make', 'beat']));
    expect(collocAlternatives('meet a deadline', 'met')).toEqual(expect.arrayContaining(['hit', 'made']));
    expect(collocAlternatives('meet a deadline', 'met')).not.toContain('beat');
    expect(collocAlternatives('run a meeting', 'run', at('Who will run the meeting?', 'run')).sort()).toEqual(['chair', 'lead']);
    expect(collocAlternatives('run a meeting', 'run', at('Who will run the meeting?', 'run'))).not.toContain('held');
    expect(collocAlternatives('run a meeting', 'run', at('Who will run the meeting?', 'run'))).not.toContain('had');
  });
  it('Vergangenheit nach Subjekt: „We hit the deadline“ → met, made, beat', () => {
    const alts = collocAlternatives('hit a deadline', 'hit', { sentence: 'Last week we hit the deadline.', start: 'Last week we '.length });
    // Das Wort davor („we“) sagt nichts: die Wendung steht in der Grundform, also gilt die Grundform.
    expect(alts).toEqual(expect.arrayContaining(['meet', 'make', 'beat']));
  });
});

describe('A6/B6: Gruppen der Wortpartner', () => {
  it('meeting in drei Gruppen: ansetzen, stattfinden lassen, leiten', () => {
    expect(collocAlternatives('schedule a meeting', 'schedule')).not.toContain('chair');
    expect(collocAlternatives('schedule a meeting', 'schedule')).not.toContain('hold');
    expect(collocAlternatives('hold a meeting', 'hold')).toEqual(['have']);
    expect(collocAlternatives('chair a meeting', 'chair').sort()).toEqual(['lead', 'run']);
  });
  it('quota: meet, hit, make, reach – aber nicht achieve; target/goal behalten achieve', () => {
    expect(collocAlternatives('make quota', 'make').sort()).toEqual(['hit', 'meet', 'reach']);
    expect(collocAlternatives('meet a quota', 'meet')).not.toContain('achieve');
    expect(collocAlternatives('meet a target', 'meet')).toContain('achieve');
  });
  it('set an appointment, deal, objection, agreement, costs, order', () => {
    expect(collocAlternatives('make an appointment', 'make')).toContain('set');
    expect(collocAlternatives('close a deal', 'close').sort()).toEqual(['clinch', 'land', 'seal', 'win']);
    expect(collocAlternatives('handle an objection', 'handle').sort()).toEqual(['address', 'overcome']);
    expect(collocAlternatives('reach an agreement', 'reach')).toEqual(['strike']);
    expect(collocAlternatives('cut costs', 'cut').sort()).toEqual(['lower', 'reduce']);
    expect(collocAlternatives('place an order', 'place')).toEqual(['make']);
  });
  it('„hold a presentation“ und „make a meeting“ bleiben falsch', () => {
    expect(collocAlternatives('give a presentation', 'give')).not.toContain('hold');
    expect(collocAlternatives('hold a meeting', 'hold')).not.toContain('make');
  });
  it('Daten sind vollständig', () => {
    for (const g of COLLOC_GROUPS) for (const v of g.verbs) expect(VERB_FORMS[v], v).toBeDefined();
    expect(VERB_FORMS.set).toBeDefined();
    expect(VERB_FORMS.lead).toBeDefined();
  });
});

describe('B1/B2/A5/C2: falsche Freunde', () => {
  const passes = (s: string) => FALSE_FRIENDS.every((f) => !f.bad?.test(s));
  it('richtig gebrauchte englische Wörter werden nicht gesperrt', () => {
    for (const s of [
      'We could eventually expand into the US.',
      'The actual situation is worse than reported.',
      'At first I could only read it, now it works.',
      'At first we will focus on DACH, later on the US.',
      'Sensible customers compare offers.',
      'A handy app for the field team.',
      'The handy thing is the search.',
      'Our chef recommends the salmon.',
      'A gift for the food bank.',
    ]) expect(passes(s), s).toBe(true);
  });
  it('eindeutige Fehler werden gesperrt', () => {
    for (const s of [
      'Could you eventually send me the file tomorrow?',
      'The actual version of the contract is attached.',
      'At first, we need to clarify the scope.',
      'This is sensible data.',
      'I forgot my handy at home, call me on my handy.',
      'I spoke to my chef.',
      'We earn a provision for each contract.',
      'He works in the software branch.',
    ]) expect(passes(s), s).toBe(false);
  });
  it('Prompt-Zeilen: nach Berufsrelevanz, ohne absolute Verbote, mit Hinweis auf englischen Gebrauch', () => {
    const lines = falseFriendLines();
    expect(lines).toHaveLength(PROMPT_FRIENDS);
    expect(lines[0]).toContain('eventuell');
    expect(lines.some((l) => l.startsWith('Provision = commission'))).toBe(true);
    expect(lines.some((l) => l.includes('realisieren') && l.includes('realize savings'))).toBe(true);
    expect(lines.some((l) => l.includes('NOT'))).toBe(false);
    expect(FALSE_FRIEND_NOTE).toContain('English');
    // „realize“ und „sensible“ stehen mit im Prompt (Hinweiseinträge), „gift“ (kein Berufsbezug) nicht.
    expect(lines.join(' ')).toContain('realize');
    expect(lines.join(' ')).not.toContain('(not gift)');
    const rules = correctionRules().join('\n');
    expect(rules).toContain('Only if no fully correct version is possible');
    expect(rules).not.toContain('If you are not sure');
  });
  it('Berufs-falsche-Freunde sind erfasst', () => {
    const words = FALSE_FRIENDS.map((f) => f.word);
    for (const w of ['provision', 'branch', 'billion', 'concern', 'serious', 'meanwhile', 'also', 'concept', 'self-conscious']) expect(words, w).toContain(w);
  });
});

describe('B3: US-Umwandlung', () => {
  it('„dialogue“ bleibt, Namen auf -ise bleiben, echte britische Formen werden gewandelt', () => {
    expect(toUSText('an open dialogue with the customer')).toBe('an open dialogue with the customer');
    expect(toUSText('Denise and Elise organised the meeting')).toBe('Denise and Elise organized the meeting');
    expect(toUSText('the catalogue and the colour')).toBe('the catalog and the color');
    // Als Schlüssel zum Vergleichen bleibt dialogue = dialog.
    expect(usSpelling('dialogue')).toBe('dialog');
  });
});

describe('B4/M8: die C1-Aufwertung (better) wird geprüft', () => {
  const schema = withFixedGate(z.object({ fixed: z.string(), better: z.string().optional(), fixedUnsure: z.boolean().optional() }), { needs: () => true, lenient: true });
  it('durchgefallenes better wird geleert, ohne dass fixed betroffen ist und ohne Neuversuch', () => {
    const out = schema.parse({ fixed: 'We will work on it.', better: 'We will worked on it tomorrow.' });
    expect(out.better).toBe('');
    expect(out.fixed).toBe('We will work on it.');
    expect(out.fixedUnsure).toBeUndefined();
  });
  it('ein richtiges better bleibt', () => {
    const out = schema.parse({ fixed: 'We will work on it.', better: 'We will pick this up tomorrow.' });
    expect(out.better).toBe('We will pick this up tomorrow.');
  });
  it('ohne lenient löst nur fixed den einen Neuversuch aus, better nie', () => {
    const strict = withFixedGate(z.object({ fixed: z.string(), better: z.string().optional() }), { needs: () => true });
    expect(strict.safeParse({ fixed: 'We will work on it.', better: 'They had sign it.' }).success).toBe(true);
    expect(strict.safeParse({ fixed: 'We will worked on it.', better: 'ok' }).success).toBe(false);
  });
});

describe('B5: die Sätze der Übung „Verbform nach Hilfsverb“ bestehen die Selbstprüfung (sie werden als Vorbild im Fehlersatz gespeichert)', () => {
  it('jede Lösung ist ein richtiger Satz', () => {
    for (const p of AUX_PATTERNS) for (const it of p.items) expect(fixedProblems(it.sentence), it.sentence).toEqual([]);
  });
});
