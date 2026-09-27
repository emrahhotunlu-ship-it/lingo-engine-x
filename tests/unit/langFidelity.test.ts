import { describe, expect, it } from 'vitest';
import rulesJson from '../../src/content/legacy/rules.json';
import cefrJson from '../../src/content/legacy/cefr.json';
import { localizePattern, PATTERN_TERMS, ruleOf } from '../../src/domain/grammar/rules';
import { TOPICS } from '../../src/domain/content';
import { diagText } from '../../src/features/settings/diagText';
import { translate, type MessageKey } from '../../src/i18n';

// Sprachtreue in der englischen Oberfläche (Kap. 10, Prüfbericht): keine deutschen Fachwörter in
// den Formmustern, US-Schreibweise in den Kann-Beschreibungen, Diagnose-Texte übersetzt.

const en = (k: MessageKey, v?: Record<string, string>) => translate('en', k, v);
const de = (k: MessageKey, v?: Record<string, string>) => translate('de', k, v);

describe('Formmuster der Regelblätter', () => {
  it('EN: kein deutsches Fachwort mehr, DE unverändert; Inhalte bleiben stehen', () => {
    for (const tp of TOPICS) {
      for (const f of ruleOf(tp.id, 'en')?.forms ?? []) {
        const shown = localizePattern(f.pattern, (id) => en(`grTerm_${id}` as MessageKey));
        for (const [word] of PATTERN_TERMS) expect(shown, `${tp.id}: ${f.pattern}`).not.toContain(word);
        expect(localizePattern(f.pattern, (id) => de(`grTerm_${id}` as MessageKey))).toBe(f.pattern);
      }
    }
    expect(localizePattern('have/has + 3. Form', (id) => en(`grTerm_${id}` as MessageKey))).toBe('have/has + past participle');
    expect(localizePattern('will + Grundform', (id) => en(`grTerm_${id}` as MessageKey))).toBe('will + base form');
    expect(JSON.stringify(rulesJson)).toContain('3. Form');
  });
});

describe('Kann-Beschreibungen (cefr.json) in US-Schreibweise', () => {
  it('kein „Practise"/„recognise"', () => {
    const text = JSON.stringify(cefrJson);
    expect(text).not.toMatch(/Practise|recognise/);
  });
});

describe('Diagnose-Protokoll', () => {
  it('eigene Meldungen übersetzt, fremde unverändert', () => {
    expect(diagText('Pool ungültig – nicht überschrieben', en)).toBe('Pool invalid – not overwritten');
    expect(diagText('3 Kopien aus diesem Browser ergänzt', en)).toBe('3 copies added from this browser');
    expect(diagText('Datenversion 1', en)).toBe('Data version 1');
    expect(diagText('Datenversion 1', de)).toBe('Datenversion 1');
    expect(diagText('quota exceeded', en)).toBe('quota exceeded');
  });
});
