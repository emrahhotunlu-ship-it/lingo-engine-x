// Gemeinsame Typen für Lesen, Hören, Schreiben und Entdecken (Phase 4, Plan §2.5).
// Reine Typen, keine Laufzeit-Abhängigkeiten.

export type Cefr = 'B1' | 'B1+' | 'B2' | 'B2+' | 'C1' | 'C1+';
export type Domain = 'work' | 'life';
export type InputKind = 'read' | 'listen' | 'write' | 'discover';
export type UnitCtx = 'duty' | 'extra';

export type QuestionType = 'gist' | 'detail' | 'inference' | 'keypoint' | 'vocab';

export type Question = {
  /** Stabile Kennung innerhalb der Einheit (für Log und React-Schlüssel). */
  key: string;
  q: string;
  qLang: 'en' | 'de';
  options: string[];
  /** Index der richtigen Option in `options`. */
  answer: number;
  type: QuestionType;
  explain: { de?: string; en?: string };
};

export type ChoiceResult = { key: string; chosen: number; correct: boolean; ms: number };

export type GlossEntry = { w: string; de?: string; def?: string };

export type ArticleItem = {
  /** Quelle: `articles/<id>` bzw. `legacy:<id>`. */
  ref: string;
  id: string;
  level: Cefr;
  domain: Domain;
  title: string;
  topic: { de?: string; en?: string };
  teaser?: string;
  text: string;
  keypoints: string[];
  glossary: GlossEntry[];
  questions: Question[];
  origin: 'db' | 'legacy';
};

export type ListeningItem = {
  /** Quelle: `lpool/<id>` bzw. `legacy:<id>`. */
  ref: string;
  id: string;
  level: Cefr;
  domain: Domain;
  title: string;
  genre: string;
  text: string;
  topic: { de?: string; en?: string };
  questions: Question[];
  vocab: GlossEntry[];
  origin: 'db' | 'legacy';
};

export type WritingPrompt = {
  id: string;
  genre: string;
  level: Cefr;
  domain: Domain;
  title: { de: string; en: string };
  task: { de: string; en: string };
  words: [number, number];
  focus: { de?: string; en?: string };
  useful: string[];
  src: 'seed' | 'ai';
};

export type FeedChunk = { en: string; de?: string; note_de?: string; note_en?: string };

export type FeedItem = {
  feedId: string;
  itemId: string;
  own: boolean;
  d: string;
  kind: 'article' | 'listen' | 'watch';
  title: string;
  source?: string;
  url: string | null;
  level?: string;
  mins?: number;
  domain: Domain;
  gist: string;
  excerpt: string | null;
  excerptBy: string | null;
  topic: { de?: string; en?: string };
  why: { de?: string; en?: string };
  task: { de?: string; en?: string };
  taskChunks: string[];
  chunks: FeedChunk[];
  questions: Question[];
  guide: { de?: string[]; en?: string[] };
};

export type ErrorCat = 'grammar' | 'vocabulary' | 'collocation' | 'spelling' | 'punctuation' | 'register' | 'coherence' | 'word-order' | 'other';

export const ERROR_CATS: readonly ErrorCat[] = ['grammar', 'vocabulary', 'collocation', 'spelling', 'punctuation', 'register', 'coherence', 'word-order', 'other'];

export type TextError = {
  orig: string;
  fix: string;
  cat: ErrorCat;
  topic: string | null;
  sev: 'minor' | 'major';
  why: string;
  span: [number, number] | null;
};

export type UsHint = { orig: string; us: string };
