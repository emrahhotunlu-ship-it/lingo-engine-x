import legacyGrammar from '../content/legacy/grammar.json';
import c1Toolkit from '../content/c1/toolkit.json';
import grammarExtra from '../content/grammar-extra.json';

// Grammatik-Themen und Aufgaben, die schon in der App liegen (16 Themen der alten App, 7 Themen des
// C1-Werkzeugkastens). Die Kennungen bleiben unverändert: Sie stehen in den alten Daten.

export type GrammarTopic = { id: string; level: string; group: string; name: string; name_en: string; rule: string; rule_en: string };
export type GrammarTask = {
  topic: string;
  type: 'mc' | 'gap' | 'transform' | 'correct';
  prompt: string;
  answer: string;
  accepted?: string[];
  options?: string[];
  hint?: string;
  expl: string;
  expl_en: string;
};

type TopicJson = { id: string; level: string; group: string; name: string; name_en: string; rule: string; rule_en: string };

export const GRAMMAR_TOPICS: readonly GrammarTopic[] = [...(legacyGrammar.topics as TopicJson[]), ...(c1Toolkit.topics as TopicJson[])].map((t) => ({
  id: t.id,
  level: t.level,
  group: t.group,
  name: t.name,
  name_en: t.name_en,
  rule: t.rule,
  rule_en: t.rule_en,
}));

export const GRAMMAR_TASKS: readonly GrammarTask[] = [
  ...(legacyGrammar.seedGrammar as GrammarTask[]),
  ...(c1Toolkit.tasks as GrammarTask[]),
  ...(grammarExtra.tasks as GrammarTask[]),
];

export const topicById = (id: string): GrammarTopic | undefined => GRAMMAR_TOPICS.find((t) => t.id === id);

export const TYPE_INSTR = {
  de: legacyGrammar.typeInstr as Record<GrammarTask['type'], string>,
  en: legacyGrammar.typeInstrEn as Record<GrammarTask['type'], string>,
};
