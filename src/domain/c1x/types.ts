// Vertrag Lernplattform 3.0 (docs/umbau/lernplattform-3.md §3.2, §2.2). Das Aufgabensystem c1x: ein Schema für neun Arten.
// Nur additiv ändern. Die zod-Schemas stehen in `schema.ts` und werden gegen diese Typen geprüft.
import type { Bi, TaskWhy } from '../explain/types';
import type { Verdict } from '../grade';

export type C1Kind = 'mcc' | 'ocl' | 'wf' | 'kwt' | 'err' | 'pair' | 'cnet' | 'reg' | 'para';
export const C1_KINDS: readonly C1Kind[] = ['mcc', 'ocl', 'wf', 'kwt', 'err', 'pair', 'cnet', 'reg', 'para'];

/** Muster-Kennung im LP2-Format (`mc.wish-past`); bei `area: 'lex'` `lx.<slug>`. */
export type C1Pattern = string;

export type C1Base = {
  /** Seed: `kwt-0042`; LP2-Adapter: `kwt-v2-<n>`, `err-v2-<n>`; Claude-Aufgaben (`src: 'ai'`): `<art>-ai-<Inhalts-Hash>`. Dauerhaft (Grundlage von seen, Fehlersatz, Melden). */
  id: string;
  kind: C1Kind;
  area: 'gram' | 'lex';
  pat: C1Pattern;
  /** Pflicht bei `area: 'gram'`: eines der 47 Themen. */
  topic?: string;
  /** Höchstens 3 betroffene Wörter/Wendungen (Brücke zu Karten). */
  lex?: string[];
  /** Deutsch-Falle `f01`–`f28`. */
  trap?: string;
  level: 'B2' | 'B2+' | 'C1';
  /** Ziel ⅔ Beruf, ⅓ Alltag. */
  dom: 'biz' | 'life';
  why: TaskWhy;
  src: 'seed' | 'ai';
  /** Textmodus (Aufgaben eines Absatzes). */
  set?: string;
  seq?: number;
  /** Nur C1-Check; nie im Training. */
  probe?: true;
  form?: string;
  /** Kapitelprüfung (`gate`) bzw. Einstufung (`place`); nie im Training. */
  pool?: 'gate' | 'place';
  /** Nur Einstufungsvorrat. */
  b?: number;
};

export type Mcc = C1Base & { kind: 'mcc'; text: string; options: [string, string, string, string]; answer: 0 | 1 | 2 | 3 };

export type FnClass = 'art' | 'aux' | 'prep' | 'pron' | 'rel' | 'conj' | 'det' | 'adv' | 'part';
export type Ocl = C1Base & { kind: 'ocl'; text: string; accept: string[]; cls: FnClass; chips: [string, string, string] };

export type Wf = C1Base & {
  kind: 'wf';
  text: string;
  stem: string;
  accept: string[];
  pos: 'noun' | 'verb' | 'adj' | 'adv';
  parts: { pre?: string; base: string; suf?: string[]; change?: string };
  family: string[];
};

/** Eine ganze Lösungsvariante: Teil A und Teil B (je 1 Punkt), Wörter jeweils als Alternativen. */
export type KwtKey = { a: string[]; b: string[] };
export type Kwt = C1Base & {
  kind: 'kwt';
  lead: string;
  /** Schlüsselwort, Großbuchstaben. */
  key: string;
  before: string;
  after: string;
  keys: KwtKey[];
  tiles: string[];
  /** 2–4 Ablenker-Bausteine (bei Aufgaben aus dem LP2-Adapter `kwt-v2-<n>` leer). */
  extra: string[];
  /** Typische falsche Antworten; jede braucht eine `WhyRule` in `why.wrong`, die sie trifft. */
  traps?: string[];
  /** Erlaubte Wortzahl der Lösung (nur LP2-Adapter; sonst gilt 3–6 nach Cambridge). */
  words?: [number, number];
};

/** `fix` = gültige Ersatztexte der Fehlerstelle (`''` = streichen, nur LP2-Adapter); `choices` = drei Korrektur-Chips (bei LP2-Adapter-Aufgaben `err-v2-<n>` nicht vorhanden). */
export type ErrBad = { span: string; nth?: number; fix: string[]; choices?: [string, string, string] };
export type Err = C1Base & { kind: 'err'; text: string; bad: ErrBad | null };

export type Pair = C1Base & {
  kind: 'pair';
  /** Satz a und Satz b (nicht `a`/`b`: `C1Base.b` ist der Einstufungs-Rang). */
  sa: string;
  sb: string;
  /** 0 = a, 1 = b, 2 = Ablenker. */
  means: [Bi, Bi, Bi];
  transfer?: { text: string; cue: string; accept: string[] };
};

export type Cnet = C1Base & {
  kind: 'cnet';
  hub: string;
  slot: 'V+N' | 'Adj+N' | 'N+prep' | 'Adv+Adj';
  right: Array<{ w: string; de: string; ex: string }>;
  /** Falsche Partner; jeder braucht eine `WhyRule` mit `opt` in `why.wrong`. */
  wrong: Array<{ w: string; calque?: boolean }>;
  also?: Array<{ w: string; note: Bi }>;
};

export type RegSeg = { span: string; accept: string[]; choices: [string, string, string]; why: Bi };
export type Reg = C1Base & {
  kind: 'reg';
  ctx: Bi;
  from: 'casual' | 'neutral' | 'direct';
  to: 'neutral' | 'formal' | 'diplomatic';
  text: string;
  segs: RegSeg[];
  answers: string[];
};

export type Para = C1Base & {
  kind: 'para';
  focus: 'nominal' | 'passive' | 'cleft' | 'inversion' | 'participle' | 'verb-pattern' | 'reported';
  a: string;
  start: string;
  answers: string[];
  /** Falsche Optionen brauchen je eine `WhyRule` mit `opt`. */
  options: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
};

export type C1Item = Mcc | Ocl | Wf | Kwt | Err | Pair | Cnet | Reg | Para;
export type C1ItemOf<K extends C1Kind> = Extract<C1Item, { kind: K }>;

// ------------------------------------------------------------------ Antwort und Wertung

/** Eingabeprofil des Geräts (`touch` = Handy, `desk` = Laptop). */
export type C1Input = 'touch' | 'desk';

/**
 * Antwort je Art. `typed` sagt, ob der Teil, der das Urteil trägt, **getippt** wurde (Handy p > 0,7: Teil B bzw. Korrektur; Laptop: alles);
 * Auswahl und Bausteine allein sind nie freier Abruf (§3.4).
 */
export type C1Response =
  | { kind: 'mcc'; pick: number }
  | { kind: 'ocl'; text: string }
  | { kind: 'wf'; text: string }
  | { kind: 'kwt'; text: string; typed?: boolean }
  /** `tap`: Index des angetippten Worts (0-basiert in den Leerzeichen-Wörtern des Satzes) oder `'none'` („Kein Fehler“); `fix`: gewählte oder getippte Korrektur. */
  | { kind: 'err'; tap: number | 'none'; fix?: string; typed?: boolean }
  /** `links[0]`: Bedeutung (0–2) zu Satz a, `links[1]` zu Satz b; `null` = nicht verbunden. */
  | { kind: 'pair'; links: [number | null, number | null]; transfer?: string }
  | { kind: 'cnet'; picks: string[] }
  /** Handy: je Abschnitt ein gewählter Chip; Laptop: der umgeschriebene Satz. */
  | { kind: 'reg'; picks?: string[]; text?: string }
  /** Handy: gewählte Option; Laptop: der geschriebene Satz (mit dem festen Anfang). */
  | { kind: 'para'; pick?: number; text?: string };

export type PartId = 'a' | 'b' | 'loc' | 'fix' | 'meaning' | 'form' | 'transfer' | `seg${number}` | `link${number}`;
export type PartResult = { id: PartId; ok: boolean };
export type C1Reason = 'key' | 'length' | 'trap' | 'family' | 'falseAlarm' | 'missed' | 'typo' | 'unsure';
export type C1Score = {
  got: number;
  max: number;
  parts: PartResult[];
  verdict: Verdict;
  /** Zählt das Ergebnis als freier Abruf (getippter Anteil)? Auswahl und Bausteine nie. */
  free: boolean;
  reason?: C1Reason;
  /** Index der getroffenen Falle (`kwt.traps`). */
  trap?: number;
  /** US-Form als Hinweis, wenn britisch geantwortet wurde (A7.3). */
  us?: string;
};
