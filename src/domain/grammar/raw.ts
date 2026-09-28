import rulesRaw from '../../content/legacy/rules.json?raw';
import grammarRaw from '../../content/legacy/grammar.json?raw';
import toolkitRaw from '../../content/c1/toolkit.json?raw';
import { logError } from '../../platform/diagnostics';

// Inhalte der Grammatik als Text eingebettet und erst beim ersten Gebrauch geparst (leistung.md
// §4 Nr. 5, Plan Anhang A 5c): Regelwerk (`rules.json`), Startaufgaben der alten App
// (`grammar.json#seedGrammar`) und C1-Werkzeugkasten (`toolkit.json#rules/tasks`). Der Start
// wertet so keine großen Objektliterale mehr aus. Die Themenlisten liest `domain/content.ts`
// weiter direkt (klein, sofort gebraucht).

type Doc = Record<string, unknown>;

function parse(raw: string, name: string): Doc {
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {};
  } catch (err) {
    logError('grammar:content', err, name);
    return {};
  }
}

let rules: Doc | null = null;
let grammar: Doc | null = null;
let toolkit: Doc | null = null;

/** `content/legacy/rules.json` (Regelwerk der alten App + „Auch richtig“-Familien). */
export function rulesJson(): Doc {
  rules ??= parse(rulesRaw, 'rules.json');
  return rules;
}

/** `content/legacy/grammar.json` (Startaufgaben `seedGrammar`). */
export function grammarJson(): Doc {
  grammar ??= parse(grammarRaw, 'grammar.json');
  return grammar;
}

/** `content/c1/toolkit.json` (Regelblätter und Aufgaben des C1-Werkzeugkastens). */
export function toolkitJson(): Doc {
  toolkit ??= parse(toolkitRaw, 'toolkit.json');
  return toolkit;
}

/** Nur für Tests: wurde schon etwas geparst? */
export function parsedYet(): { rules: boolean; grammar: boolean; toolkit: boolean } {
  return { rules: rules !== null, grammar: grammar !== null, toolkit: toolkit !== null };
}

export const asRecord = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
export const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
