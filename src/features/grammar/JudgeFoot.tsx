import { useEffect, useRef, useState } from 'react';
import type { FeedbackAction } from '../../domain/tutor/feedback';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import type { FitErr } from './fit';
import { FitSlow } from './FitSlow';

// Handlung der Rückmeldung der Tutor-Engine (v3 §2.1, §4.1, §6.4): genau eine Handlung aus `composeFeedback` – „Claude fragen“, „Als richtig
// werten“ oder „Schreib die Lücke (den Satz) einmal mit dem geübten Muster“ (Zielform) – und darüber die ruhige Zeile zum Urteil von Claude bzw. zu seinem
// Fehler. Dazu „Sicher?“ vor einem Einspruch bei eindeutigem Formfehler. Steht über „Mehr“ (Platz `act`). Keine Texte im Code.

/** Meldung zum Claude-Urteil: Nein, unsicher, Emrahs Einspruch gemerkt oder eine Fehlerart des KI-Tors. */
export type AiMsg = 'no' | 'unsure' | 'byMe' | FitErr;

/** Ergebnis des Zielform-Zweitversuchs (`null` = noch nicht versucht). */
export type TargetState = { given: string; ok: boolean } | null;

const MSG: Record<Exclude<AiMsg, 'off'>, MessageKey> = {
  no: 'ttJgAiNo',
  unsure: 'ttJgAiUnsure',
  byMe: 'ttJgByMe',
  busy: 'ttJgBusy',
  signin: 'ttJgSignin',
  final: 'ttJgFinal',
  retry: 'ttJgRetryText',
  limit: 'ttJgLimit',
  bug: 'ttJgBug',
};

type Props = {
  action: FeedbackAction;
  aiMsg: AiMsg | null;
  /** Begründung von Claude zu einem Nein (Sprache schon gewählt); erscheint gekennzeichnet. */
  aiNoWhy?: string | null;
  busy: boolean;
  phase: string;
  onAsk: () => void;
  onSkip: () => void;
  onCounts: () => void;
  /** Zielform: ohne Muster die Lösung (`want`), mit Muster `null` (die Formel steht schon an der Muster-Zeile); `form`: konkrete richtige Form. */
  want: string | null;
  /** Lückenaufgabe: „Schreib die Lücke …“, sonst „Schreib den Satz …“. */
  gap?: boolean;
  form: string;
  target: TargetState;
  onTarget: (given: string) => void;
  /** „Sicher?“ vor dem Speichern eines Einspruchs; `onAsk`: Claude prüfen lassen (nur wenn Claude nutzbar und noch nicht gefragt). */
  sure?: { onYes: () => void; onNo: () => void; onAsk: (() => void) | null } | null;
};

export function JudgeFoot({ action, aiMsg, aiNoWhy = null, busy, phase, onAsk, onSkip, onCounts, want, gap = false, form, target, onTarget, sure = null }: Props) {
  const { t } = useT();
  const msg = aiMsg && aiMsg !== 'off' ? t(MSG[aiMsg]) : null;
  const showTarget = action === 'targetForm' || target !== null;
  if (!msg && action === 'next' && !showTarget && !sure) return null;
  return (
    <div className="flex flex-col items-start gap-2" data-testid="judge-foot" data-action={action}>
      {sure && <Sure sure={sure} busy={busy} phase={phase} onSkip={onSkip} />}
      {msg && (
        <p className="lx-t-support text-muted" role="status" data-testid="ai-msg" data-msg={aiMsg}>
          {msg}
          {aiMsg === 'no' && aiNoWhy ? ` ${aiNoWhy}` : ''}
        </p>
      )}
      {action === 'askAi' && !sure && (
        <>
          <Button variant="secondary" onClick={onAsk} busy={busy} busyLabel={t('ttJgAsking')} disabled={busy} aria-label={t('ttJgAskAria')} data-testid="ask-claude">
            {aiMsg === 'retry' ? t('ttJgRetry') : t('ttJgAsk')}
          </Button>
          <FitSlow phase={phase} onSkip={onSkip} />
        </>
      )}
      {action === 'counts' && (
        <Button variant="secondary" onClick={onCounts} aria-label={t('ttJgCountsAria')} data-testid="counts">
          {t('ttJgCounts')}
        </Button>
      )}
      {showTarget && <TargetForm want={want} gap={gap} form={form} target={target} onTarget={onTarget} />}
    </div>
  );
}

/** „Sicher?“: die App sieht einen Formfehler. Ja speichert den Einspruch, Abbrechen lässt alles, wie es war; Claude kann vorher prüfen. */
function Sure({ sure, busy, phase, onSkip }: { sure: NonNullable<Props['sure']>; busy: boolean; phase: string; onSkip: () => void }) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  // Am Handy kommt die Frage nach dem Schließen des Menüs ins Bild (sie steht in der Karte, nicht im Blatt) – vollständig über dem festen
  // Weiter-Balken (`scroll-margin-bottom`), und der Fokus steht auf „Ja“ (Nachprüfung N1: sonst verwirft ein Tipp auf „Weiter“ den Einspruch unbemerkt).
  // Erst im nächsten Bild: das Menü gibt beim Schließen den Fokus an seinen Knopf zurück.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.querySelector<HTMLButtonElement>('[data-testid="override-sure-yes"]')?.focus({ preventScroll: true });
      el.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      ref={ref}
      className="flex w-full flex-col gap-2 rounded-[var(--radius-control)] bg-near-soft p-3"
      style={{ scrollMarginBottom: 'calc(var(--lx-bar-h) + env(safe-area-inset-bottom) + 1rem)', scrollMarginTop: '1rem' }}
      data-testid="override-sure"
    >
      <p className="lx-t-support m-0 text-fg" role="status">
        {t('ttJgSure')}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={sure.onYes} disabled={busy} data-testid="override-sure-yes">
          {t('ttJgSureYes')}
        </Button>
        {sure.onAsk && (
          <Button variant="secondary" onClick={sure.onAsk} busy={busy} busyLabel={t('ttJgAsking')} disabled={busy} data-testid="override-sure-ask">
            {t('ttJgSureAsk')}
          </Button>
        )}
        <Button variant="ghost" onClick={sure.onNo} data-testid="override-sure-no">
          {t('ttJgSureNo')}
        </Button>
      </div>
      <FitSlow phase={phase} onSkip={onSkip} />
    </div>
  );
}

/**
 * „Schreib es einmal mit …“: ein Feld, ein Knopf; die App bewertet selbst, ein Versuch. Das Feld erscheint erst auf Wunsch (UX-Audit U1:
 * Zusatz-Eingabe nur bei Bedarf) – vorher steht nur ein ruhiger Knopf „Mit dem geübten Muster üben“.
 */
function TargetForm({ want, gap, form, target, onTarget }: { want: string | null; gap: boolean; form: string; target: TargetState; onTarget: (given: string) => void }) {
  const { t } = useT();
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const done = target !== null;
  if (!open && !done)
    return (
      <div className="flex w-full flex-col gap-2" data-testid="target-form" data-open="0">
        <div>
          <Button variant="secondary" onClick={() => setOpen(true)} data-testid="target-open">
            {t('ttJgTargetOpen')}
          </Button>
        </div>
      </div>
    );
  const go = (): void => {
    if (!done && value.trim()) onTarget(value);
  };
  return (
    <div className="flex w-full flex-col gap-2" data-testid="target-form" data-open="1">
      <label className="flex flex-col gap-1">
        <span className="lx-t-support text-muted">{want ? t('ttJgTargetLabel', { want }) : t(gap ? 'ttJgTargetLabelPat' : 'ttJgTargetLabelPatSentence')}</span>
        <input
          className="lx-field"
          autoFocus={!done}
          lang="en"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={done ? target.given : value}
          readOnly={done}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              go();
            }
          }}
          data-testid="target-input"
          data-state={done ? (target.ok ? 'correct' : 'wrong') : undefined}
        />
      </label>
      {done ? (
        <p className={`lx-t-support ${target.ok ? 'text-ok-text' : 'text-muted'}`} role="status" data-testid="target-result" data-ok={target.ok ? '1' : '0'}>
          {target.ok ? t('ttJgTargetOk') : t('ttJgTargetWrong', { form })}
        </p>
      ) : (
        <div>
          <Button variant="secondary" onClick={go} disabled={!value.trim()} data-testid="target-check">
            {t('ttJgTargetCheck')}
          </Button>
        </div>
      )}
    </div>
  );
}
