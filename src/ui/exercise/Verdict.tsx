import { useEffect, useRef } from 'react';
import type { ResultVerdict } from '../../domain/explain/types';
import { useT, type MessageKey } from '../../i18n';
import { emit } from '../../engine/fx';
import { Icon, type IconName } from '../Icon';

// Urteilszeile (§4.3). Der EINE Ort für das Urteil und `role="status"`: genau einmal je Mount (das Gerüst hängt das Urteil je Prüfen neu ein).
// Ton und Vibration laufen als Lernereignis über den Dirigenten (`engine/fx`, P30), nicht mehr hier. Farbe nie allein: Zeichen (✓ ≈ ✕) und Wort stehen immer dabei.
// Stufe 1 (P30, Erlebnis-Engine §4 M1–M3, Lernplattform 3.0 §6.1): Das Zeichen wird in 180 ms von links nach rechts aufgezogen (`ee.css`, `clip-path`); bei Stufe `off` steht es sofort da.

const WORD: Record<ResultVerdict, MessageKey> = {
  ok: 'exVerdictOk',
  near: 'exVerdictNear',
  wrong: 'exVerdictWrong',
  dontKnow: 'exVerdictDontKnow',
  unchecked: 'exVerdictUnchecked',
};
const TONE: Record<ResultVerdict, string> = { ok: 'text-ok-text', near: 'text-near-text', wrong: 'text-wrong-text', dontKnow: 'text-fg', unchecked: 'text-muted' };
const BADGE: Record<ResultVerdict, string> = { ok: 'bg-ok', near: 'bg-near', wrong: 'bg-wrong', dontKnow: '', unchecked: '' };
const MARK: Record<ResultVerdict, string> = { ok: '✓', near: '≈', wrong: '✕', dontKnow: '', unchecked: '' };
const ICON: Partial<Record<ResultVerdict, IconName>> = { dontKnow: 'lightbulb' };

export function Verdict({ verdict, sub = null }: { verdict: ResultVerdict; sub?: string | null }) {
  const { t } = useT();
  const first = useRef(verdict);
  useEffect(() => {
    const v = first.current;
    if (v === 'ok' || v === 'near' || v === 'wrong') emit({ k: 'verdict', v });
  }, []);
  const icon = ICON[verdict];
  const mark = MARK[verdict];
  return (
    <div className="flex flex-col gap-0.5" data-testid="verdict-block">
      <p className={`flex items-center gap-3 text-xl leading-7 font-semibold tracking-tight ${TONE[verdict]}`} data-testid="verdict" data-verdict={verdict} role="status">
        {mark && (
          <span aria-hidden="true" className={`dz-badge inline-flex size-8 flex-none items-center justify-center rounded-full text-base font-bold ${BADGE[verdict]}`} style={{ color: 'var(--lx-accent-fg)' }} data-mark={verdict}>
            <span className="ee-mark">{mark}</span>
          </span>
        )}
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
