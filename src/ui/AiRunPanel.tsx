import type { AiMessageKey, AiPhase } from '../ai/types';
import { useT } from '../i18n';
import { Button } from './Button';
import { Skeleton } from './Skeleton';

// Anzeige einer laufenden KI-Anfrage (A6.2/A6.3, Plan §5): „Denkt nach …" bis zum ersten Text,
// nach der Wartezeit je Stufe ein ruhiger Hinweis mit Stopp-Knopf – kein Timer-Abbruch.
// Fehler: klarer Text und „Erneut versuchen" (genau ein Aufruf je Klick, nie automatisch).

type Props = {
  phase: AiPhase | 'idle';
  error: AiMessageKey | null;
  onStop?: (() => void) | undefined;
  onRetry?: (() => void) | undefined;
  /** Zusatzzeile, z. B. „Du kannst weiterlernen …" (M14). */
  note?: string | undefined;
  /** Skelett der erwarteten Rückmeldung zeigen. */
  skeleton?: boolean;
};

export const isBusy = (phase: AiPhase | 'idle'): boolean => phase === 'queued' || phase === 'thinking' || phase === 'streaming' || phase === 'slow';

export function AiRunPanel({ phase, error, onStop, onRetry, note, skeleton = true }: Props) {
  const { t } = useT();
  if (isBusy(phase)) {
    return (
      <div className="flex flex-col gap-3" data-testid="ai-phase" data-ai-phase={phase} role="status">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <span>{phase === 'slow' ? t('aiSlow') : phase === 'queued' ? t('aiQueued') : t('aiThinking')}</span>
          {onStop && (
            <Button variant="ghost" onClick={onStop} data-testid="ai-stop">
              {t('aiStop')}
            </Button>
          )}
        </div>
        {note && <p className="text-xs text-subtle">{note}</p>}
        {skeleton && (
          <div className="flex flex-col gap-2" aria-hidden="true">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-wrap items-center gap-3" role="alert" data-testid="ai-error">
        <p className="text-sm text-danger-text">{t(error)}</p>
        {onRetry && error !== 'aiUnavailable' && (
          <Button onClick={onRetry} icon="refresh" data-testid="ai-retry" data-ai="">
            {t('aiRetry')}
          </Button>
        )}
      </div>
    );
  }
  return null;
}
