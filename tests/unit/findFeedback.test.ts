// Emrahs Rückmeldung 7 (10.10.2026): Ergebnis der Fehler-finden-Aufgabe („Used the new scanner, …“) war unverständlich.
// Regressionstests: (1) die Begründung heißt nur nach richtiger Antwort „Richtig, weil“, (2) kein „Der Fehler:“-Vorspann darunter,
// (3) der Kopf nennt eindeutig Urteil und getipptes Wort, (4) die Korrektur zeigt altes und neues Wort.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { grammarExplanation, stripFindLead } from '../../src/domain/grammar/explain';
import { v2Tasks } from '../../src/domain/grammar/patterns';
import { fromV2 } from '../../src/domain/grammar/tasks';
import type { GrammarTask } from '../../src/domain/learn/types';
import type { ExplainLine, ExplanationModel, ResultVerdict } from '../../src/domain/explain/types';
import { Explanation } from '../../src/ui/exercise/Explanation';
import { FixedSentence } from '../../src/ui/exercise/FixedSentence';
import { findHead } from '../../src/ui/exercise/findHead';
import { lineLabel } from '../../src/ui/exercise/lineLabel';

const SCANNER = 'Used the new scanner, the clerk processed every invoice in minutes.';
const finds = (): GrammarTask[] => v2Tasks().filter((t) => t.type === 'find').map(fromV2).filter((t): t is GrammarTask => !!t);
const scanner = () => finds().find((t) => t.prompt === SCANNER)!;
const whyOf = (m: ExplanationModel): string => (m.lines.find((l): l is Extract<ExplainLine, { k: 'why' }> => l.k === 'why')?.text ?? '');

describe('Erklär-Karte: Abschnittsname folgt dem Urteil', () => {
  it('„Richtig, weil“ nur bei richtiger Antwort, sonst „Warum ist das so?“', () => {
    expect(lineLabel('why', 'ok')).toBe('exLineWhy');
    for (const v of ['near', 'wrong', 'dontKnow'] as ResultVerdict[]) expect(lineLabel('why', v)).toBe('exLineWhyNot');
    expect(lineLabel('pattern', 'wrong')).toBe('exLinePattern');
  });

  it('gerendert: „Weiß ich nicht“ zeigt nie „Richtig, weil“', () => {
    const m = grammarExplanation({ task: scanner(), verdict: 'dontKnow', given: '', lang: 'de', learning: true });
    const html = renderToStaticMarkup(createElement(Explanation, { model: m, depth: 'full', verdict: 'dontKnow' }));
    expect(html).not.toContain('Richtig, weil');
    expect(html).toContain('Warum ist das so?');
    const ok = renderToStaticMarkup(createElement(Explanation, { model: m, depth: 'full', verdict: 'ok' }));
    expect(ok).toContain('Richtig, weil');
  });
});

describe('Begründung ohne „Der Fehler:“-Vorspann', () => {
  it('stripFindLead entfernt die Vorspänne und schreibt groß weiter', () => {
    expect(stripFindLead('Der Fehler: unique beginnt mit /j/.')).toBe('Unique beginnt mit /j/.');
    expect(stripFindLead('The error: a job takes a/an.')).toBe('A job takes a/an.');
    expect(stripFindLead('Kein Fehler: an HR ist richtig.')).toBe('An HR ist richtig.');
    expect(stripFindLead('Nach would fehlt das Verb.')).toBe('Nach would fehlt das Verb.');
    // Gegenlesung: ein zitiertes Bruchstück direkt nach dem Vorspann fällt mit weg, ein Satz, der mit Zitat beginnt, bleibt.
    expect(stripFindLead('Der Fehler: „could you“. Nach whether steht das Subjekt vor dem Verb: you could.')).toBe('Nach whether steht das Subjekt vor dem Verb: you could.');
    expect(stripFindLead('Der Fehler: „In contrary“ gibt es nicht. Richtig: In contrast.')).toBe('„In contrary“ gibt es nicht. Richtig: In contrast.');
  });

  it('keine Fehler-finden-Aufgabe beginnt ihre Begründung mit „Der Fehler:“ / „The error:“', () => {
    const all = finds();
    expect(all.length).toBeGreaterThan(400);
    for (const t of all)
      for (const lang of ['de', 'en'] as const) {
        const why = whyOf(grammarExplanation({ task: t, verdict: 'ok', given: t.answer, lang, learning: false }));
        expect(why, t.prompt).not.toMatch(/^(der fehler|the error|kein fehler|no error)\s*:/i);
      }
  });

  it('Scanner-Satz: Alltagsdeutsch mit -ing gegen -ed, Kontrast im Modell', () => {
    const m = grammarExplanation({ task: scanner(), verdict: 'dontKnow', given: '', lang: 'de', learning: true });
    expect(whyOf(m)).toMatch(/^Der Angestellte benutzt den Scanner selbst/);
    expect(whyOf(m)).toContain('mit dem Angestellten etwas gemacht');
    expect(m.lines.some((l) => l.k === 'contrast')).toBe(true);
  });
});

describe('Kopf der Rückmeldung bei „Fehler finden“', () => {
  it('Stelle gefunden, dann „Weiß ich nicht“: „Stelle richtig erkannt“ mit dem getippten Wort (nicht „Kein Problem“)', () => {
    expect(findHead({ verdict: 'dontKnow', errWord: 'Used', tapped: 'Used', found: true }, 'de')).toEqual({ title: 'Richtige Stelle gefunden', sub: 'Du hast „Used“ getippt.' });
  });
  it('richtig: „Richtig erkannt“', () => {
    expect(findHead({ verdict: 'ok', errWord: 'Used', tapped: 'Used', found: true }, 'de').title).toBe('Richtig erkannt');
    expect(findHead({ verdict: 'ok', errWord: null, tapped: 'none', found: false }, 'de')).toEqual({ title: 'Richtig erkannt', sub: 'Du hast „Kein Fehler“ gewählt. Der Satz ist fehlerfrei.' });
  });
  it('falsches Wort: „Nicht ganz“, getipptes Wort und echte Fehlerstelle', () => {
    expect(findHead({ verdict: 'wrong', errWord: 'Used', tapped: 'clerk', found: false }, 'de')).toEqual({ title: 'Nicht ganz', sub: 'Du hast „clerk“ getippt. Der Fehler steckt in „Used“.' });
    expect(findHead({ verdict: 'wrong', errWord: null, tapped: 'clerk', found: false }, 'en')).toEqual({ title: 'Not quite', sub: 'You tapped “clerk”. The sentence has no mistake.' });
  });
  it('Stelle richtig, Korrektur falsch oder fast', () => {
    expect(findHead({ verdict: 'wrong', errWord: 'Used', tapped: 'Used', found: true }, 'de').title).toBe('Richtige Stelle, Korrektur falsch');
    expect(findHead({ verdict: 'near', errWord: 'Used', tapped: 'Used', found: true }, 'de').title).toBe('Richtige Stelle, Korrektur fast richtig');
  });
  it('sofort „Weiß ich nicht“: Urteilswort bleibt, Unterzeile nennt die Fehlerstelle', () => {
    expect(findHead({ verdict: 'dontKnow', errWord: 'Used', tapped: null, found: false }, 'de')).toEqual({ title: null, sub: 'Der Fehler steckt in „Used“.' });
  });
});

describe('Korrigierter Satz mit sichtbarer Änderung', () => {
  it('Used → Using: altes Wort durchgestrichen, neues hervorgehoben', () => {
    const html = renderToStaticMarkup(createElement(FixedSentence, { from: SCANNER, to: scanner().x!.kind === 'find' ? (scanner().x as { fixed: string }).fixed : '', testId: 'x' }));
    expect(html).toMatch(/data-testid="fix-old"[^>]*>Used</);
    expect(html).toMatch(/data-testid="fix-new"[^>]*>Using</);
    expect(html).toContain('Using the new scanner, the clerk processed every invoice in minutes.');
  });
});
