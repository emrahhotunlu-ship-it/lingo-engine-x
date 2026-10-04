import type { MessageKey } from '../i18n';

// Bezeichnungen der Fehlerarten (Korrektur und Stolpersteine).

const CAT_KEY: Readonly<Record<string, MessageKey>> = {
  articles: 'schCatArticles',
  prepositions: 'schCatPrepositions',
  tenses: 'schCatTenses',
  'word-order': 'schCatWordOrder',
  collocation: 'schCatCollocation',
  'false-friend': 'schCatFalseFriend',
  spelling: 'schCatSpelling',
  register: 'schCatRegister',
  vocabulary: 'schCatVocabulary',
  other: 'schCatOther',
};

export const catKey = (cat: string): MessageKey => CAT_KEY[cat] ?? 'schCatOther';
