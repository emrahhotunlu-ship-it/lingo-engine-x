import { useEffect, useRef } from 'react';
import type { ResultVerdict } from '../../domain/explain/types';
import { useT, type MessageKey } from '../../i18n';
import { emit } from '../../engine/fx';

// Urteilszeile (§4.3). Der EINE Ort für das Urteil und `role="status"`: genau einmal je Mount (das Gerüst hängt das Urteil je Prüfen neu ein).
// Ton und Vibration laufen als Lernereignis über den Dirigenten (`engine/fx`, P30), nicht mehr hier. Farbe nie allein: Zeichen (✓ ≈ ✕) und Wort stehen immer dabei.
// Relaunch Stufe 1 P3 (Band, Nora 2): das Zeichen steht in einem weichen Kreis (Zustandsfarbe 20 %, Zeichen in der Zustandsfarbe, `band.css`),
// „Weiß ich nicht“ als neutraler Ring mit dem Wort „Lösung gezeigt“ – kein Rot, keine Wertung.
// Stufe 1 (P30, Erlebnis-Engine §4 M1–M3, Lernplattform 3.0 §6.1): Das Zeichen wird in 180 ms von links nach rechts aufgezogen (`ee.css`, `clip-path`); bei Stufe `off` steht es sofort da.

const WORD: Record<ResultVerdict, MessageKey> = {
  ok: 'exVerdictOk',
  near: 'exVerdictNear',
  wrong: 'exVerdictWrong',
  dontKnow: 'bandVerdictShown',
  unchecked: 'exVerdictUnchecked',
};
const TONE: Record<ResultVerdict, string> = { ok: 'text-ok-text', near: 'text-near-text', wrong: 'text-wrong-text', dontKnow: 'text-fg', unchecked: 'text-muted' };
const MARK: Record<ResultVerdict, string> = { ok: '✓', near: '≈', wrong: '✕', dontKnow: '○', unchecked: '' };

export function Verdict({ verdict, sub = null, title = null }: { verdict: ResultVerdict; sub?: string | null; title?: string | null }) {
  const { t } = useT();
  const first = useRef(verdict);
  useEffect(() => {
    const v = first.current;
    if (v === 'ok' || v === 'near' || v === 'wrong') emit({ k: 'verdict', v });
  }, []);
  const mark = MARK[verdict];
  return (
    <div className="flex flex-col gap-0.5" data-testid="verdict-block">
      <p className={`flex items-center gap-3 text-xl leading-7 font-semibold tracking-tight ${TONE[verdict]}`} data-testid="verdict" data-verdict={verdict} role="status">
        {mark && (
          <span aria-hidden="true" className="dz-badge lx-vi inline-flex size-7 flex-none items-center justify-center rounded-full text-sm font-bold" data-mark={verdict}>
            <span className="ee-mark">{verdict === 'dontKnow' ? '' : mark}</span>
          </span>
        )}
        <span>{title ?? t(WORD[verdict])}</span>
      </p>
      {sub && (
        <p className="lx-t-meta text-muted" data-testid="verdict-sub">
          {sub}
        </p>
      )}
    </div>
  );
}
