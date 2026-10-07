import { getWriter } from '../../data';
import { validateDoc } from '../../data/validate';
import { errorsOf } from '../../domain/grammar/errors';
import { fitAx, withAx, withAxs, withoutAx, type Ax } from '../../domain/tutor/explainOps';
import { logError, logWarn } from '../../platform/diagnostics';

// Speichert die Erklärung von Claude dort, wo die falsche Antwort schon liegt (Lernplattform 3.0 P26, KT §7): `grammar/<topic>.errors[i].ax`
// bzw. `vocab/<id>.axs[]`. Nur ergänzend, nur über `writer.transform` und nur bei Änderung; nie in ein ungültiges Dokument, nie ein neues Dokument.
// Gibt es den Eintrag noch nicht (die Antwort ist noch nicht geschrieben), bleibt die Erklärung nur im Speicher: kein Fehler, kein zweiter Aufruf.

export type ExplainStore = { kind: 'grammar'; topic: string; q: string } | { kind: 'vocab'; path: string };

const pathOf = (s: ExplainStore): string => (s.kind === 'grammar' ? `grammar/${s.topic}` : s.path);

/** Erklärung speichern. `true`, wenn sie geschrieben wurde. */
export async function saveAx(store: ExplainStore, ax: Ax): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  const path = pathOf(store);
  const fitted = fitAx(ax);
  let wrote = false;
  try {
    await writer.transform(path, (cur) => {
      if (!cur) return null;
      if (!validateDoc(path, cur).ok) {
        logWarn('tutor:ax', { code: 'invalid_document', message: 'Dokument ungültig – Erklärung nicht gespeichert' }, path);
        return null;
      }
      if (store.kind === 'grammar') {
        const next = withAx(errorsOf(cur), store.q, fitted);
        if (!next) return null;
        wrote = true;
        return { update: { errors: next } };
      }
      wrote = true;
      return { update: { axs: withAxs(cur.axs, fitted) } };
    });
  } catch (err) {
    logError('tutor:ax', err, path);
    return false;
  }
  return wrote;
}

/** „Melden“ nimmt die Erklärung wieder von der Aufgabe (nur Grammatik; bei Wörtern markiert `bad`). */
export async function dropAx(store: ExplainStore, ax: Ax): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  const path = pathOf(store);
  let wrote = false;
  try {
    await writer.transform(path, (cur) => {
      if (!cur || !validateDoc(path, cur).ok) return null;
      if (store.kind === 'grammar') {
        const next = withoutAx(errorsOf(cur), store.q);
        if (!next) return null;
        wrote = true;
        return { update: { errors: next } };
      }
      wrote = true;
      return { update: { axs: withAxs(cur.axs, { ...ax, bad: 1 as const }) } };
    });
  } catch (err) {
    logError('tutor:ax-drop', err, path);
    return false;
  }
  return wrote;
}
