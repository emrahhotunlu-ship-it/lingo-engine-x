import { AnimatePresence, motion } from 'framer-motion';
import { useHiddenInput } from '../../../engine/HiddenInput';
import { useT } from '../../../i18n';
import { Button } from '../../../ui/Button';
import { DURATION, EASE_OUT } from '../../../ui/motion';
import { undoLast, useUndo } from '../session';

// B4 (markt AN2, Anki „Rückgängig“): nach einer Aufdeck-Bewertung 5 s lang oben in der Übungsleiste.
// Bis dahin ist nichts gespeichert (session.ts `commitHeld`); der Knopf zeigt dieselbe Karte wieder.

export function UndoBar() {
  const { t } = useT();
  const api = useHiddenInput();
  const at = useUndo((s) => s.t);
  const word = useUndo((s) => s.word);
  const undo = () => {
    const kind = undoLast();
    // Tastatur am iPhone: im selben Handler öffnen bzw. schließen.
    if (kind === 'typed') api.focusNow();
    else api.blur();
  };
  return (
    // Über dem Fortschrittsbalken der Übungsleiste (zwischen ✕ und Claude-Symbol), nie über den
    // Knöpfen der Karte: ein Tipp auf „Antwort zeigen“ unten darf nie „Rückgängig“ treffen.
    <div className="pointer-events-none absolute inset-y-0 right-10 left-10 z-20 flex items-center justify-center">
      <AnimatePresence>
        {at !== null && (
          <motion.div
            key={at}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            role="status"
            className="pointer-events-auto flex max-w-full min-w-0 items-center gap-2 rounded-full border border-line bg-surface-solid py-0.5 pr-0.5 pl-3 text-sm shadow-lg"
            data-testid="undo-bar"
          >
            <span className="min-w-0 truncate text-muted">
              {t('nbWsUndoRated')}{' '}
              <span lang="en" className="font-medium text-fg">
                {word}
              </span>
            </span>
            <Button variant="secondary" icon="undo" onClick={undo} data-testid="undo">
              {t('nbWsUndo')}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
