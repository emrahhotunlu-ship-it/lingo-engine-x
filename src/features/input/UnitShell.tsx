import { motion } from 'framer-motion';
import { useId, useState, type ReactNode } from 'react';
import { useNav } from '../../app/nav';
import { StepBoundary } from '../../app/shell/Boundary';
import { useHotkeys } from '../../engine/useHotkeys';
import { useT } from '../../i18n';
import { IconButton } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { useCompanionSee } from '../companion/seeing';
import { ExerciseTop } from '../learn/ui';

// Rahmen einer Einheit (Plan §6.1): die gemeinsame Übungsleiste (✕ · Balken · Claude), Titel mit
// Verlauf-Symbol und Schritt bzw. Frage,
// darunter die Statuszeile. Aufgabe in einer Zeile, „Wozu?" nur hinter dem Info-Symbol (A7).

type Props = {
  kind: 'read' | 'listen' | 'write' | 'discover';
  ctx: 'duty' | 'extra';
  state: string;
  title: string;
  onClose: () => void;
  /** Stepper oder „Frage i von n" rechts bzw. unter dem Titel. */
  progress?: ReactNode;
  status?: ReactNode;
  task?: ReactNode;
  purpose?: ReactNode;
  children: ReactNode;
  /** Ab `lg` zweispaltig: links der Text, rechts Fragen/Rückmeldung (sticky). */
  aside?: ReactNode;
  /** Für den Begleiter (Phase 5 D4): Titel des Texts bzw. der Aufgabe, nie Lösungen. */
  seeDetail?: string;
};

export function UnitShell({ kind, ctx, state, title, onClose, progress, status, task, purpose, children, aside, seeDetail }: Props) {
  const { t } = useT();
  const taskText = typeof task === 'string' ? task : '';
  useCompanionSee({ area: kind, label: title, phase: 'idle', ...(seeDetail || taskText ? { detail: [seeDetail, taskText].filter(Boolean).join('\n') } : {}) });
  const [info, setInfo] = useState(false);
  const infoId = useId();
  const go = useNav((s) => s.go);
  // Esc verlässt die Einheit (Entwürfe bleiben lokal gesichert); bei offenem Nachschlagen
  // schließt Esc zuerst das Fenster (useHotkeys lässt Dialoge in Ruhe).
  useHotkeys({ escape: onClose }, () => false);
  return (
    <motion.section
      className="flex flex-col gap-5 py-4 sm:py-8"
      data-testid="unit"
      data-kind={kind}
      data-ctx={ctx}
      data-state={state}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
      aria-labelledby={`${infoId}-title`}
    >
      <header className="flex flex-col gap-3">
        <ExerciseTop onClose={onClose} closeLabel={t('inLeave')} closeTestId="unit-close" ctx={ctx} />
        <div className="flex items-center gap-2">
          <h1 id={`${infoId}-title`} className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
            {title}
          </h1>
          {/* Verlauf im Bildschirm selbst (UX-Beratung Nr. 8), nicht mehr als zweiter Knopf in „Üben". */}
          <IconButton icon="history" label={t('inHistoryOf', { channel: t(`ch_${kind}`) })} onClick={() => go({ name: 'history', kind })} data-testid="open-history" className="-mr-2 flex-none" />
        </div>
        {progress}
        {status}
        {task && (
          <div className="flex items-start justify-between gap-3">
            <p className="text-base font-medium" data-testid="task">
              {task}
            </p>
            {purpose && (
              <button
                type="button"
                className="-m-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-subtle transition-colors hover:text-fg"
                aria-label={t('inInfo')}
                aria-expanded={info}
                aria-controls={`${infoId}-purpose`}
                onClick={() => setInfo((v) => !v)}
                data-testid="purpose-info"
              >
                <Icon name="info" size={18} />
              </button>
            )}
          </div>
        )}
        {info && purpose && (
          <p id={`${infoId}-purpose`} className="text-sm text-muted" data-testid="purpose">
            {purpose}
          </p>
        )}
      </header>
      {/* Fehlergrenze je Schritt (G4): eine kaputte Aufgabe kostet nur diesen Schritt. */}
      <StepBoundary resetKey={state} scope={kind} detail={state}>
        {aside ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,68ch)_minmax(0,1fr)] lg:items-start">
            <div className="min-w-0">{children}</div>
            <div className="min-w-0 lg:sticky lg:top-4">{aside}</div>
          </div>
        ) : (
          children
        )}
      </StepBoundary>
    </motion.section>
  );
}
