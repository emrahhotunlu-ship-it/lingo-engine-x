import { useHiddenInput } from '../../../engine/HiddenInput';
import { useT } from '../../../i18n';
import { Button } from '../../../ui/Button';
import { undoLast, useUndo } from '../session';

// B4 (markt AN2, Anki „Rückgängig“): nach einer Aufdeck-Bewertung 5 s lang in der Übungsleiste.
// Bis dahin ist nichts gespeichert (session.ts `commitHeld`); der Knopf zeigt dieselbe Karte wieder.
//
// Befund 28.09. (Emrahs Kommentar „Anzeigefehler“): als eigenständige, absolut positionierte Leiste
// deckte der Streifen ✕, Übersetzer, Claude und Einstellungen zu – genau die Symbole, die überall
// erreichbar sein sollen. Jetzt ersetzt er nur den Fortschrittsbalken (`ExerciseTop.middleOverlay`,
// dieselbe Stelle, dieselbe Höhe), ✕ und die Symbole rechts bleiben immer sichtbar und anklickbar.
//
// Befund 29.09. (Emrahs Kommentar „blockiert den Counter“): auch die Zahl „n / total“ ist dabei
// verschwunden. Der Streifen zeigt sie jetzt selbst weiter an derselben Stelle (`trainer-progress`).

/** `null`, solange nichts vorgemerkt ist – dann zeigt `ExerciseTop` den normalen Fortschrittsbalken. */
export function useUndoBar(): { t: number | null; word: string } {
  return useUndo((s) => s);
}

export function UndoBar({ progress, progressTestId = 'round-progress' }: { progress?: { n: number; total: number; extra?: number } | null; progressTestId?: string }) {
  const { t } = useT();
  const api = useHiddenInput();
  const word = useUndo((s) => s.word);
  const undo = () => {
    const kind = undoLast();
    // Tastatur am iPhone: im selben Handler öffnen bzw. schließen.
    if (kind === 'typed') api.focusNow();
    else api.blur();
  };
  return (
    <div className="flex min-w-0 items-center gap-2" role="status" data-testid="undo-bar">
      {progress && progress.total > 0 && (
        <span className="lx-tnum flex-none text-xs text-muted" data-testid={progressTestId}>
          {t('nvProgress', { n: Math.max(1, Math.min(progress.total, progress.n)), total: progress.total })}
        </span>
      )}
      {!!progress?.extra && (
        <span className="lx-tnum -ml-1 flex-none text-xs text-subtle" data-testid="round-extra">
          +{progress.extra}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-xs text-muted">
        <span className="sr-only">{t('nbWsUndoRated')} </span>
        <span lang="en" className="font-medium text-fg">
          {word}
        </span>
      </span>
      <Button variant="secondary" icon="undo" className="flex-none" onClick={undo} data-testid="undo">
        {t('nbWsUndo')}
      </Button>
    </div>
  );
}
