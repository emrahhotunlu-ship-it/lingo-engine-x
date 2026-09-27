// Business-Suite (Phase 3, Plan §3.5, §5.5): gemeinsame Typen, ohne zod und ohne Oberfläche.

export type Bi = { de: string; en: string };

export type PlaybookPhrase = {
  en: string;
  de: string;
  register: 'formal' | 'neutral' | 'informal';
  note: Bi;
  /** Beispielsatz, enthält `en` wörtlich. */
  ex: string;
};

export type PlaybookNode =
  | { id: string; kind: 'question'; q: Bi; options: Array<{ label: Bi; next: string }> }
  | { id: string; kind: 'leaf'; title: Bi; phrases: PlaybookPhrase[] };

export type DrillItem = {
  situation: Bi;
  /** Drei englische Antworten; `answer` = Index der passenden. */
  options: [string, string, string];
  answer: number;
  note: Bi;
  ex: string;
};

export type Playbook = {
  id: string;
  title: Bi;
  purpose: Bi;
  root: string;
  nodes: Record<string, PlaybookNode>;
  drill: DrillItem[];
};

export type MailItem = {
  id: string;
  t: number;
  day: string;
  kind: 'mail';
  recipient: string;
  intent: string;
  orig: string;
  final: string;
  picks: Array<[seg: number, opt: number]>;
  changes: number;
  taken: string[];
  lang: 'de' | 'en';
};

export type PitchItem = {
  id: string;
  t: number;
  day: string;
  kind: 'pitch';
  points: string[];
  attempt: string;
  verdict: string;
  covered: number;
  total: number;
  lang: 'de' | 'en';
  summary: string;
};

export type PlayItem = { id: string; t: number; day: string; kind: 'play'; playbook: string; drill: { n: number; right: number } };

export type BizItem = MailItem | PitchItem | PlayItem;

export type Recipient = 'client' | 'boss' | 'partner' | 'team';
export type Intent = 'inform' | 'request' | 'decline' | 'followup' | 'escalate';
export type Audience = 'executives' | 'clients' | 'team' | 'partners';
