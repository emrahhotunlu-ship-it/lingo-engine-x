import { useEffect, useRef } from 'react';
import type { ResultVerdict } from '../../domain/explain/types';
import { useT, type MessageKey } from '../../i18n';
import { verdictHaptic } from '../../platform/haptics';
import { playCue } from '../../platform/sound';
import { Icon, type IconName } from '../Icon';

// Urteilszeile (§4.3). Der EINE Ort für Haptik, Ton und `role="status"`: genau einmal je Mount (das Gerüst
// hängt das Urteil je Prüfen neu ein). Farbe nie allein: Zeichen (✓ ≈ ✕) und Wort stehen immer dabei.

const WORD: Record<ResultVerdict, MessageKey> = {
  ok: 'exVerdictOk',
  near: 'exVerdictNear',
  wrong: 'exVerdictWrong',
  dontKnow: 'exVerdictDontKnow',
  unchecked: 'exVerdictUnchecked',
};
const TONE: Record<ResultVerdict, string> = { ok: 'text-ok-text', near: 'text-near-text', wrong: 'text-wrong-text', dontKnow: 'text-fg', unchecked: 'text-muted' };
const MARK: Record<ResultVerdict, string> = { ok: '✓', near: '≈', wrong: '✕', dontKnow: '', unchecked: '' };
const ICON: Partial<Record<ResultVerdict, IconName>> = { dontKnow: 'lightbulb' };

export function Verdict({ verdict, sub = null }: { verdict: ResultVerdict; sub?: string | null }) {
  const { t } = useT();
  const first = useRef(verdict);
  useEffect(() => {
    const v = first.current;
    if (v === 'ok') {
      verdictHaptic('correct');
      playCue('correct');
    } else if (v === 'near') {
      verdictHaptic('near');
      playCue('near');
    } else if (v === 'wrong') {
      verdictHaptic('wrong');
      playCue('wrong');
    }
  }, []);
  const icon = ICON[verdict];
  return (
    <div className="flex flex-col gap-0.5" data-testid="verdict-block">
      <p className={`lx-t-answer flex items-center gap-2 ${TONE[verdict]}`} data-testid="verdict" data-verdict={verdict} role="status">
        {MARK[verdict] && <span aria-hidden="true">{MARK[verdict]}</span>}
        {icon && <Icon name={icon} size={18} />}
        <span>{t(WORD[verdict])}</span>
      </p>
      {sub && (
        <p className="lx-t-meta text-muted" data-testid="verdict-sub">
          {sub}
        </p>
      )}
    </div>
  );
}
