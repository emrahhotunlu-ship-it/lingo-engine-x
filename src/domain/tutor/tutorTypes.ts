// Gemeinsame Typen der Tutor-Engine (docs/umbau/tutor-engine-v3.md §6.2). Eigene Datei, damit `judge`, `diagnose`, `hypotheses` und `learner`
// sich gegenseitig nur über Typen kennen (keine Kreis-Importe). Rein.

/** Muster-Kennung der Grammatik (`cp.subject`, `ut.used-to`). */
export type PatternId = string;
/** Gebrauchsmuster `use:<lemma>+<partner>` (`use:depend+on`, `use:avoid+ing`). */
export type UseId = `use:${string}`;
/** Muster ODER Gebrauchsmuster (Konzept: `PatternId | UseId`). Da `PatternId` ein `string` ist, schluckt er `UseId`; deshalb ein eigener Name. */
export type RefId = PatternId;

/** Urteil der Tutor-Engine. Nicht zu verwechseln mit dem engeren `Verdict` der Prüfung (`domain/learn/types.ts`: correct | near | wrong). */
export type Verdict = 'correct' | 'alt_ok' | 'near' | 'wrong' | 'unsure';

/** Ursache einer abweichenden Antwort. `register` ist keine Ursache, sondern eine Aufwertung (`edits.ts`, `sev:'upgrade'`). */
export type Cause = 'form' | 'auxform' | 'order' | 'span' | 'typo' | 'confuse' | 'prep' | 'colloc' | 'lexis' | 'unknown';

/** Ursachen, die allein ein „falsch“ tragen (Regel 4.1 b). */
export const WRONG_CAUSES: ReadonlySet<Cause> = new Set<Cause>(['form', 'auxform', 'order', 'span']);

/** Zustand einer Fehlerannahme. `confirmed`/`refuted` gibt es erst ab Scheibe S5 (Prüfaufgaben); bis dahin entstehen sie nie. */
export type HypState = 'open' | 'quiet' | 'resolved' | 'confirmed' | 'refuted';

export const isUseId = (s: string): s is UseId => /^use:[a-z][a-z-]*\+[a-z][a-z-]*$/.test(s);
export const isPatternId = (s: string): boolean => /^[a-z0-9]{2,6}\.[a-z0-9-]{2,32}$/.test(s);
