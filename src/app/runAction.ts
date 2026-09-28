import { translate } from '../i18n';
import { describeError, logContext, logError } from '../platform/diagnostics';
import { toast } from '../ui/Toast';
import { useSettings } from './settings';

// Gemeinsamer Rahmen für jede asynchrone Aktion aus einem Klick (N03, leistung.md §6): Prüfen,
// Weiter, KI … Fehlergrenzen fangen nur Fehler beim Zeichnen; `runAction` fängt den Rest, schreibt
// ihn sofort ins Diagnose-Protokoll (mit Route und Position) und zeigt einen ruhigen Hinweis statt
// still zu scheitern. Der Rückgabewert ist das Ergebnis oder `undefined` bei einem Fehler.
//
//   onClick={() => void runAction('trainer:check', () => check(answer))}

export type RunActionOptions = {
  /** Eigener Hinweistext (sonst „Das hat nicht geklappt …“); `false` = kein Hinweis. */
  toast?: string | false;
  /** Fehlerbehandlung der Aufrufer (z. B. Rückrollen), läuft nach dem Protokoll. */
  onError?: (err: unknown) => void;
};

/** Codes, die kein Fehler der App sind (Nutzer hat abgebrochen). */
const QUIET = new Set(['aborted', 'AbortError']);

export async function runAction<T>(name: string, fn: () => T | Promise<T>, opts: RunActionOptions = {}): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    const { code } = describeError(err);
    const name2 = err instanceof Error ? err.name : undefined;
    if ((code && QUIET.has(code)) || (name2 && QUIET.has(name2))) return undefined;
    logError(`action:${name}`, err, logContext());
    opts.onError?.(err);
    if (opts.toast !== false) toast(opts.toast ?? translate(useSettings.getState().lang, 'nbShActionFailed'), 'error');
    return undefined;
  }
}
