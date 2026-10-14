import { z } from 'zod';

// Datenmodell des Lesen-Moduls (docs/umbau/lesen-plan.md §4), nur zod.
//
// Sammlung `read` mit drei Dokumentarten (Pfad = `read/<Kennung>`):
//   d-<JJJJ-MM-TT>  Tagesdokument  {v, day, items:[Artikel]}      (Texte, ≈ 10 KB je Artikel)
//   m-<JJJJ-MM>     Monatsindex    {v, items:[Index + Lesezustand]} (≈ 350 B je Artikel)
//   p               Einstellungen  {v, topics, custom, perDay, view, autoSpeak, gen, lastTopics}
//
// `schemaForPath` kennt je Sammlung genau ein Schema und sieht nur Pfad und Inhalt der Sammlung, nicht die Kennung
// als Art. Deshalb ist `readSchema` (registriert in COLLECTIONS) ein toleranter Gesamtaufbau; die Prüfung je Art
// und je Artikel machen `parseDayDoc`/`parseMonthDoc`/`parsePrefs` in domain/docs.ts. Ein einzelner kaputter
// Artikel macht nie das ganze Tagesdokument ungültig und wird nie gelöscht (nur ausgeblendet).
// Regeln wie src/data/schemas.ts (A6 Nr. 16): looseObject, Felder optional/nullish, `loose` für nicht belegte Typen.

const str = z.string().nullish();
const num = z.number().nullish();
const bool = z.boolean().nullish();
const strArr = z.array(z.string()).nullish();
/** Beliebiger Wert oder fehlend. Achtung zod 4: `z.unknown()` allein macht das Feld zur Pflicht. */
const loose = z.unknown().optional();
/** Liste von Objekten; die Feinprüfung je Eintrag (Kennung, Aufbau) macht domain/docs.ts, damit ein kaputter Eintrag nie das ganze Dokument ungültig macht. */
const looseArr = z.array(z.looseObject({})).nullish();

// ---------------------------------------------------------------- Bausteine eines Artikels

export const TOPIC_KEYS = ['bizdev', 'saas', 'ai', 'economy', 'architecture', 'management', 'claudecode', 'custom'] as const;
export type TopicKey = (typeof TOPIC_KEYS)[number];
export const ARTICLE_KINDS = ['explainer', 'case', 'howto', 'trend', 'opinion'] as const;
export type ArticleKind = (typeof ARTICLE_KINDS)[number];

export const sentenceSchema = z.looseObject({ e: z.string().min(1), d: z.string().min(1) });
export type Sentence = { e: string; d: string };

export const keyWordSchema = z.looseObject({
  w: z.string().min(1),
  de: z.string().min(1),
  /** `[Absatz, Satz]`: der Satz, in dem das Wort steht (= Ursprungssatz der Karte). */
  i: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
});
export type KeyWord = { w: string; de: string; i: [number, number] };

export const checkSchema = z.looseObject({
  q: z.string().min(1),
  o: z.array(z.string().min(1)).length(3),
  a: z.number().int().min(0).max(2),
  why: z.string().min(1),
  /** Englische Begründung (nur Kurslektionen, optional): wird bei englischer Oberfläche gezeigt, sonst Rückfall auf `why`. */
  why_en: z.string().min(1).optional(),
});
export type Check = { q: string; o: [string, string, string]; a: number; why: string; why_en?: string };

/** Ein gespeicherter Artikel im Tagesdokument. Pflicht ist nur, was ihn lesbar macht. */
export const articleItemSchema = z.looseObject({
  id: z.string().min(1),
  t: num,
  topic: str,
  /** Text des eigenen Themas (nur bei `topic: 'custom'`). */
  custom: str,
  kind: str,
  level: str,
  title: z.string().min(1),
  summary: str,
  asOf: str,
  /** Leer = Text wurde mit Zustimmung aufgeräumt (domain/retention.ts); Titel und Schlüsselwörter bleiben. */
  paras: z.array(z.array(sentenceSchema)),
  keyWords: z.array(keyWordSchema).nullish(),
  check: z.array(checkSchema).nullish(),
  model: str,
  pv: num,
  /** `'routine'`: Artikel der geplanten Claude-Routine (docs/umbau/lesen-routine.md). Fehlt bei selbst geholten Artikeln. */
  by: str,
  /** Nur Routine: Name der Quelle (z. B. „InfoQ“) und Link zur Originalmeldung (https). */
  source: str,
  url: str,
  /** Nur Routine: Veröffentlichungstag der Meldung `JJJJ-MM-TT` (Anzeige, optional). */
  pub: str,
});
export type ArticleItem = {
  id: string;
  t?: number | null;
  topic?: string | null;
  custom?: string | null;
  kind?: string | null;
  level?: string | null;
  title: string;
  summary?: string | null;
  asOf?: string | null;
  paras: Sentence[][];
  keyWords?: KeyWord[] | null;
  check?: Check[] | null;
  model?: string | null;
  pv?: number | null;
  by?: string | null;
  source?: string | null;
  url?: string | null;
  pub?: string | null;
};

// ---------------------------------------------------------------- Lesezustand im Monatsindex

export const stateSchema = z.looseObject({
  t0: num,
  /** Gelesene Sekunden (nur Maximum, wächst). */
  sec: num,
  /** Zuletzt gelesener Satz (laufende Nummer im Artikel). */
  pos: num,
  done: bool,
  /** Aufgedeckte Sätze. */
  open: num,
  /** Gespeicherte Karten. */
  saved: num,
  q: z.looseObject({ n: num, ok: num }).nullish(),
  /** Gemeldete Sätze („Übersetzung falsch“). */
  rep: z.array(z.union([z.string(), z.number()])).nullish(),
});
export type ReadState = {
  t0?: number | null;
  sec?: number | null;
  pos?: number | null;
  done?: boolean | null;
  open?: number | null;
  saved?: number | null;
  q?: { n?: number | null; ok?: number | null } | null;
  rep?: Array<string | number> | null;
};

export const indexItemSchema = z.looseObject({
  id: z.string().min(1),
  day: str,
  title: str,
  topic: str,
  mins: num,
  words: num,
  st: stateSchema.nullish(),
  /** `'routine'`: Eintrag eines Routine-Artikels (Text liegt in `read/r-<Tag>`, nicht in `read/d-<Tag>`). */
  src: str,
  /** Nur Routine: Name der Quelle für die Liste. */
  source: str,
});
export type IndexItem = {
  id: string;
  day?: string | null;
  title?: string | null;
  topic?: string | null;
  mins?: number | null;
  words?: number | null;
  st?: ReadState | null;
  src?: string | null;
  source?: string | null;
};

// ---------------------------------------------------------------- Dokumente je Art (streng genug für das Modul)

export const dayDocSchema = z.looseObject({ v: num, day: str, items: looseArr });
export const monthDocSchema = z.looseObject({ v: num, items: looseArr });

export const VIEWS = ['a', 'b', 'c'] as const;
export type ReadView = (typeof VIEWS)[number];

export const prefsSchema = z.looseObject({
  v: num,
  /** Gewicht je Thema-Chip, 0 (aus) bis 3. */
  topics: z.record(z.string(), z.number().nullish()).nullish(),
  /** Eigene Themen (höchstens 5, je höchstens 60 Zeichen). */
  custom: strArr,
  perDay: num,
  view: str,
  autoSpeak: bool,
  /** Heute erzeugte Artikel: `{d: Lerntag, n: Anzahl}`. */
  gen: z.looseObject({ d: str, n: num }).nullish(),
  /** Letzte Themen, neueste zuerst (Auswahl-Abwertung). Typ nicht belegt – tolerant. */
  lastTopics: loose,
  /**
   * Lerntage, für die ein Tagesdokument `read/d-<Tag>` existiert (aufsteigend, eindeutig). Damit zählen Wächter und Diagnose die
   * Dokumente der Sammlung, ohne die Artikeltexte zu laden (Plan §11 Nachtrag L3). Wird neu berechnet, nie hochgezählt.
   */
  days: strArr,
});
export type ReadPrefs = {
  v?: number | null;
  topics?: Record<string, number | null | undefined> | null;
  custom?: string[] | null;
  perDay?: number | null;
  view?: string | null;
  autoSpeak?: boolean | null;
  gen?: { d?: string | null; n?: number | null } | null;
  lastTopics?: unknown;
  days?: string[] | null;
};

/**
 * Das eine Schema der Sammlung `read` (COLLECTIONS): toleranter Gesamtaufbau aller drei Dokumentarten.
 * Felder, die in mehreren Arten vorkommen (`items`), prüft es nur auf das Nötigste (Liste von Objekten);
 * die Feinprüfung steht in domain/docs.ts.
 */
export const readSchema = z.looseObject({
  v: num,
  day: str,
  items: looseArr,
  topics: z.record(z.string(), z.number().nullish()).nullish(),
  custom: strArr,
  perDay: num,
  view: str,
  autoSpeak: bool,
  gen: z.looseObject({ d: str, n: num }).nullish(),
  lastTopics: loose,
  days: strArr,
});
