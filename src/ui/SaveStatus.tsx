import { Icon } from './Icon';

/**
 * Rückmeldung neben einem „Speichern“-Knopf (UX-Prüfung WL2 S8): steht am Knopf statt als Hinweis über der Seite.
 * Die Zeile ist immer da (Live-Region), leer ohne Rückmeldung.
 */
export function SaveStatus({ status, saved, failed, testId }: { status: 'saved' | 'failed' | null; saved: string; failed: string; testId: string }) {
  return (
    <span role="status" className={`inline-flex items-center gap-1 text-sm ${status === 'failed' ? 'text-danger-text' : 'text-ok-text'}`} data-testid={testId} data-status={status ?? ''}>
      {status && <Icon name={status === 'saved' ? 'check' : 'alert'} size={16} />}
      {status === 'saved' ? saved : status === 'failed' ? failed : ''}
    </span>
  );
}
