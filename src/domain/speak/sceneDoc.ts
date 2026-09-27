// Szenen-Dokumente (Plan §3.2): Lauf-Vermerk am Gesprächsende und neue KI-Szenen.
// Alte Felder bleiben unverändert; `done` wird nur gesetzt, wenn es fehlt oder `false` ist
// (ein vorhandener Wert anderen Typs bleibt stehen – die alte App liest ihn weiter).

type Doc = Record<string, unknown>;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * `cur` = frischer Stand von `scene/<id>` (`undefined` = fehlt), `legacy` = Szene aus dem Inhalt.
 * Fehlt das Dokument und gibt es keinen Inhalt, wird nichts geschrieben.
 */
export function sceneRunOp(cur: Doc | undefined, legacy: Doc | null, nowMs: number): { set: Doc } | { update: Doc } | null {
  if (!cur) {
    if (!legacy) return null;
    return { set: { ...legacy, ts: nowMs, done: true, runs: 1, lastRun: nowMs } };
  }
  const update: Doc = { runs: num(cur.runs) + 1, lastRun: nowMs };
  if (cur.done === undefined || cur.done === null || cur.done === false) update.done = true;
  return { update };
}

/** Kennung einer neuen KI-Szene: `sc-ai` + Zeit (Basis 36) – gültig nach der Pfadgrammatik. */
export const aiSceneId = (nowMs: number): string => `sc-ai${Math.max(0, Math.floor(nowMs)).toString(36)}`;

/** Mindestens so viele KI-Szenen, dann erscheint ein Hinweis (Erstellen bleibt möglich). */
export const AI_SCENE_HINT_AT = 150;
