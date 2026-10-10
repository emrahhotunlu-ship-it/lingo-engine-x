import type { ExplainLine, ResultVerdict } from '../../domain/explain/types';
import type { MessageKey } from '../../i18n';

// Namen der Zeilen der Erklär-Karte (§4.3). Rein, ohne React.

const LABEL: Record<ExplainLine['k'], MessageKey> = {
  pattern: 'exLinePattern',
  yours: 'exLineYours',
  why: 'exLineWhy',
  mistake: 'exLineMistake',
  contrast: 'exLineContrast',
  note: 'exLineNote',
};

/** Name der Zeile je Urteil: Die Begründung heißt nur nach einer richtigen Antwort „Richtig, weil“; nach „Fast“, „Noch nicht“ und
 *  „Weiß ich nicht“ heißt sie „Warum ist das so?“ (Emrahs Rückmeldung 7, Kap. 2 Nr. 2 und 4: Überschrift und Abschnitt widersprechen sich nie). */
export function lineLabel(k: ExplainLine['k'], verdict: ResultVerdict | undefined): MessageKey {
  if (k === 'why' && verdict !== undefined && verdict !== 'ok') return 'exLineWhyNot';
  return LABEL[k];
}
