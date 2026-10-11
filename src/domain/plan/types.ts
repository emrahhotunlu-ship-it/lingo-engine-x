// Tagesplan (Daten-Entwurf §3.4, phase2-plan §6.1): Format der alten App `{d, ids, why}` plus neue Felder.

/** Begründungs-Schlüssel: `[key]`, `[key, n]` oder – additiv ab Phase 6 (Plan E10) – `[key, n, ref]`, z. B. `['whyFocus', 0, 'grammar:mixed-cond']`. `ref` ist eine Kennung, kein Satz. */
export type WhyKey = [key: string] | [key: string, n: number] | [key: string, n: number, ref: string];
export type DutyId = 'review' | 'lesson' | `ch:${string}`;

export type StoredPlan = {
  /** Lerntag (dayKey, Wechsel um 04:00). */
  d: string;
  /** Kanäle der alten App; ids[0] = Pflichtkanal (ab Phase 2), ids[1..2] = Angebote. */
  ids: string[];
  why: WhyKey[][];
  v: 1;
  /** Eingefrorene Pflichtschritte des Tages (Phase 1: höchstens „Wiederholen"; Phase 2: review, lesson, ch:<id>). */
  duty: DutyId[];
  /** Eingefrorene Mengen: „Wiederholen" (Anzeige „x von N"), Aufteilung und Rundengröße im Pflichtkanal. */
  goal: { review: number; due?: number; new?: number; ahead?: number; ch?: number };
  lesson: string | null;
  /** ms der Festlegung. */
  at: number;
  /**
   * Neubau (plan.md §1.5, P1, additiv): eingefrorene Eckdaten der Tageseinheit. Fehlt bei Plänen
   * von Phase 1/2; dann gilt der Plan wie bisher. Rückweg-sicher (die alte App liest nur `d/ids/why`).
   */
  u?: UnitMeta;
};

/**
 * Schritt-Argumente der Regelversion 2 (Lernplattform 2.0 §2.3): `errs` = Fehlersätze in der Grammatikrunde, `repairs` = Reparatur-Sätze in
 * Schritt 1, `limit` = Sätze in Schritt 4. Ältere Leser lesen nur die ersten drei Tupel-Elemente.
 */
export type StepArgs = { errs?: number; repairs?: number; limit?: number; mode?: Step3Mode; fmt?: Step3Fmt };

/** Schritt 3 an Format-Tagen (Lernplattform 3.0 §2.1, P23): `format` = eine Art des Tages, `tempo` = Tempo-Runde (Samstag). Fehlt `mode`, ist es Satzbau. */
export type Step3Mode = 'tempo' | 'format';
/** Die Aufgabenart des Format-Tags (`ocl` Kleines Wort · `wf` Wort umbauen · `kwt` Umformen · `mcc` Passendes Wort). */
export type Step3Fmt = 'ocl' | 'wf' | 'kwt' | 'mcc';

/** Block der Tageseinheit im gespeicherten Plan: [Block-Nr., Art, Minuten, Schritt-Argumente (nur ab Regelversion 2)]. */
export type UnitMetaBlock = [block: 1 | 2 | 3 | 4 | 5, kind: string, min: number, args?: StepArgs];

/** Zustand eines Musters am Morgen: 0 Neu · 1 Lernt · 2 Sicher · 3 Fest (`metrics/pattern`). */
export type PatState = 0 | 1 | 2 | 3;

/** Das Grammatikthema des Tages, beim Anlegen des Plans eingefroren (Lernplattform 2.0 §2.3). */
export type GrammarDay = {
  intro: string | null;
  pats: string[];
  topics: string[];
  /** Kapitel-Arbeit (K3), additiv: Der Grammatikschritt folgt diesem Kapitel (1 bis 7). Ältere Versionen lesen ihn nicht und rechnen wie bisher. */
  ch?: number;
};

/** Eingefrorene Eckdaten der Tageseinheit (ohne `env`, Prüfbefund M5). */
export type UnitMeta = {
  v: 1;
  shape: string;
  goalMin: number;
  /** Rest des früheren Wochenthemas: wird nicht mehr belegt (neue Pläne schreiben ''; ältere Pläne behalten ihr Thema, gelesen wird tolerant). Das Feld bleibt für das Rückwärtslesen älterer App-Versionen. */
  theme: string;
  min: number;
  b: UnitMetaBlock[];
  /** Preply-Termine älterer Pläne (bis 28.09.2026); nur noch gelesen, nie ausgewertet. */
  pp?: string[];
  /** Wiedereinstieg, additiv (Gesamtkonzept 3.2): Form des Plans nach einer Pause. */
  cb?: 'reduced' | 'restart';
  /** Überfällige Karten beim Planen (Morgenwert für „überfällig −n“ am Abschluss), additiv. */
  ov?: number;
  /** Sichere Karten beim Planen (Morgenwert für „Heute neu sicher: n“), additiv. */
  sure?: number;
  /** Regelversion (Lernplattform 2.0 §2.3), additiv: `2` = Plan v2; fehlt = alte Regel. Die Planversion `v` bleibt 1. */
  rv?: 2;
  /** Eingefroren (Lernplattform 2.0 §2.3): Einführungsthema, Muster des Tages und Rundenthemen. */
  gt?: GrammarDay;
  /** Eingefroren: Musterzustände vom Morgen für die Muster der `gt`-Themen (≤ 24). */
  ps?: Record<string, PatState>;
  /** Plan 3.0 (Lernplattform 3.0 §2.4, P23), additiv: `'check'` = heute ersetzt der C1-Check Schritt 2 und 3; die normalen Schritte stehen im selben Plan als Alternative. */
  c1?: 'check';
  /** Plan 3.0, additiv: Kennung des nächsten Ziels (`nextGoal`), beim Anlegen eingefroren (höchstens 24 Zeichen). */
  nx?: string;
};

export type DutyState = { id: DutyId; state: 'done' | 'open'; progress: { done: number; total: number } | null };

export type TodayState = {
  day: string;
  status: 'noPlan' | 'nothing' | 'open' | 'allDone';
  /** Die Pflichtpunkte des Tages (Phase 2). Erledigtes ist Zustand, kein Knopf (Kap. 2.2). */
  duties: { done: number; total: number; missing: DutyId[]; items: DutyState[] };
  review: { done: number; total: number };
  extra: number;
  /** `talks`/`biz`: Gespräche und Business-Einheiten (Phase 3), nicht in `answers` enthalten. */
  balance: { answers: number; correct: number; minutes: number; talks: number; biz: number; repaired: number };
};
