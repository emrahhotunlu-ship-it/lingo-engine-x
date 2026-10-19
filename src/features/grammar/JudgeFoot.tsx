import { useState } from 'react';
import type { FeedbackAction } from '../../domain/tutor/feedback';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import type { FitErr } from './fit';
import { FitSlow } from './FitSlow';

// Fuß der Rückmeldung der Tutor-Engine (v3 §2.1, §4.1, §6.4): genau eine Handlung aus `composeFeedback` – „Claude fragen“, „Zählt“ oder
// „Schreib es einmal mit …“ (Zielform) – und darüber die ruhige Zeile zum Urteil von Claude bzw. zu seinem Fehler. Keine Texte im Code.

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
  /** Zielform: was geübt wird (Muster oder Lösung) und die Prüfung des Zweitversuchs. */
  want: string;
  target: TargetState;
  onTarget: (given: string) => void;
};

export function JudgeFoot({ action, aiMsg, aiNoWhy = null, busy, phase, onAsk, onSkip, onCounts, want, target, onTarget }: Props) {
  const { t } = useT();
  const msg = aiMsg && aiMsg !== 'off' ? t(MSG[aiMsg]) : null;
  const showTarget = action === 'targetForm' || target !== null;
  if (!msg && action === 'next' && !showTarget) return null;
  return (
    <div className="flex flex-col items-start gap-2" data-testid="judge-foot" data-action={action}>
      {msg && (
        <p className="lx-t-support text-muted" role="status" data-testid="ai-msg" data-msg={aiMsg}>
          {msg}
          {aiMsg === 'no' && aiNoWhy ? ` ${aiNoWhy}` : ''}
        </p>
      )}
      {action === 'askAi' && (
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
      {showTarget && <TargetForm want={want} target={target} onTarget={onTarget} />}
    </div>
  );
}

/** „Schreib es einmal mit …“: ein Feld, ein Knopf; die App bewertet selbst, ein Versuch. */
function TargetForm({ want, target, onTarget }: { want: string; target: TargetState; onTarget: (given: string) => void }) {
  const { t } = useT();
  const [value, setValue] = useState('');
  const done = target !== null;
  const go = (): void => {
    if (!done && value.trim()) onTarget(value);
  };
  return (
    <div className="flex w-full flex-col gap-2" data-testid="target-form">
      <label className="flex flex-col gap-1">
        <span className="lx-t-support text-muted">{t('ttJgTargetLabel', { want })}</span>
        <input
          className="lx-field"
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
          {target.ok ? t('ttJgTargetOk') : t('ttJgTargetWrong', { want })}
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
