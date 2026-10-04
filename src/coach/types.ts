import type { FsrsStored } from '../data/schemas';

// Datenmodell des neuen Trainers (docs/neustart.md, Anhang). Alles liegt in der Sammlung `coach`,
// wenige, zusammengefasste Dokumente (db.d.ts: höchstens 5.000 Dokumente, 256 KiB je Dokument):
//   coach/profile        Einstellungen, Einstufung, übernommene Altdaten
//   coach/cards-0 … -7   Karten, nach Kennung verteilt ({c: {kennung: CardRec}})
//   coach/days-JJJJ      Tageswerte ({d: {JJJJ-MM-TT: DayRec}})
// Die Dokumente der alten App werden nur gelesen, nie geändert.

export const CARD_SHARDS = 8;

export type CardSource = 'bank' | 'legacy' | 'user';

export type CardRec = {
  src: CardSource;
  /** Nur für Karten ohne Bank-Eintrag: Wort, Bedeutung, Ursprungssatz. */
  w?: string;
  de?: string;
  ex?: string;
  /** Planung (FSRS). */
  f: FsrsStored;
  /** Übungsstufe 0–4: bestimmt die Abfrageart (erkennen → Lücke mit Hilfe → frei → hören). */
  lv: number;
  /** Angelegt (ms). */
  add: number;
  /** 1 = beim Sortieren als bekannt bestätigt (keine Einführung nötig). */
  known?: 0 | 1;
  /** Richtig / falsch insgesamt. */
  ok?: number;
  bad?: number;
};

export type DayRec = {
  /** Aktive Lernminuten. */
  min: number;
  /** Antworten / davon richtig. */
  ans: number;
  ok: number;
  /** Neu eingeführte Wörter. */
  nw: number;
  /** Als bekannt einsortierte Wörter. */
  kn?: number;
  /** 1 = Kern-Training erledigt (zählt für die Serie). */
  core?: 0 | 1;
  /** KI-Anfragen an diesem Tag (Anzeige in den Einstellungen). */
  ai?: number;
  /** Teile des Tages erledigt: Wörter, Grammatik, Input. */
  w?: 0 | 1;
  g?: 0 | 1;
  i?: 0 | 1;
  /** Bestes Ergebnis der Blitzrunde. */
  bz?: number;
};

export type Placement = {
  at: number;
  /** Geschätzte Wortschatzgröße (Wortfamilien bis Rang 9.000). */
  size: number;
  /** Geschätzter Anteil bekannter Wörter je Band 1–9 (0–1, bereinigt). */
  bands: number[];
  /** Anteil „Ja" bei Kontrollwörtern (Raten). */
  falseAlarm: number;
  /** Grammatik je Thema: 0–1. */
  grammar: Record<string, number>;
  /** Gesamturteil, z. B. "B2". */
  level: string;
};

export type LegacyImport = {
  at: number;
  cards: number;
  /** Aktive Tage der alten App (für die Serie), höchstens 120. */
  days: string[];
  /** Alte Grammatikwerte je Thema (p 0–1). */
  grammar: Record<string, number>;
  /** Alte Einschätzung, z. B. "B2". */
  level?: string;
};

export type ProfileDoc = {
  v: 1;
  created: number;
  newPerDay: number;
  /** Beginn des Fahrplans (Lerntag der ersten Einstufung). */
  planStart?: string;
  placement?: Placement;
  imported?: LegacyImport;
  ui?: { lang?: 'de' | 'en'; theme?: 'dark' | 'light' | 'auto' };
  /** Themen und Formate für den Input des Tages (Emrahs Antworten vom 03.10.2026 als Start). */
  interests?: string[];
  formats?: string[];
};

/** Monats-Check (coach/checks, ein Eintrag je Monat JJJJ-MM): gleicher Aufbau wie die Einstufung. */
export type CheckRec = {
  at: number;
  size: number;
  level: string;
  /** Grammatik: richtig / Aufgaben. */
  gOk: number;
  gN: number;
};

/** Trainer-Brief einer Woche (coach/briefs, Schlüssel JJJJ-Www): genau eine KI-Anfrage je Woche. */
export type BriefRec = { at: number; lang: 'de' | 'en'; text: string };

export const INTERESTS = ['economy', 'tech', 'business', 'sport', 'science'] as const;
export const FORMATS = ['video', 'article'] as const;

/** Ein Input-Beitrag, geschrieben vom Tagesauftrag nach input/<JJJJ-MM-TT>. */
export type InputItem = {
  id: string;
  kind: 'article' | 'video';
  title: string;
  source: string;
  url: string;
  mins: number;
  level?: string;
  topic?: string;
  why_de?: string;
  why_en?: string;
  tip_de?: string;
  tip_en?: string;
  words?: Array<{ en: string; de: string }>;
};

/** Gelesen/gesehen und bewertet (coach/inlog-JJJJ-MM). */
export type InLogEntry = {
  d: string;
  /** Interesse: spannend, okay, langweilig. */
  r?: 'great' | 'ok' | 'boring';
  /** Schwierigkeit: zu leicht, passend, zu schwer. */
  l?: 'easy' | 'right' | 'hard';
  m: number;
  t: string;
  s?: string;
  k?: string;
  topic?: string;
};
export type InLog = { it: Record<string, InLogEntry>; own: Record<string, number> };

export const DEFAULT_NEW_PER_DAY = 10;
