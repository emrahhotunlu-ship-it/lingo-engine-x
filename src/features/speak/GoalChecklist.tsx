import { useT } from '../../i18n';
import type { Bi } from '../../domain/speak/bizScenes';
import { pickLang } from '../../domain/speak/bizScenes';
import type { GoalMark, GoalState } from '../../domain/speak/goals';
import type { CriterionMark } from '../../prompts/nb/p5/goalCheck';
import { Icon } from '../../ui/Icon';

// Ziel-Checkliste und Kriterien-Raster (N72, Speak/Yoodli). Farbe nie allein: jedes Ziel trägt
// Symbol + Wort (✓ erreicht · ◐ teilweise · ○ offen). Ohne KI steht die Liste ohne Haken da.

const MARK: Record<GoalState, { icon: 'check' | 'target' | 'close'; cls: string; key: 'nbSprechenGoalMet' | 'nbSprechenGoalPartly' | 'nbSprechenGoalOpen' }> = {
  met: { icon: 'check', cls: 'text-accent-text', key: 'nbSprechenGoalMet' },
  partly: { icon: 'target', cls: 'text-gold-text', key: 'nbSprechenGoalPartly' },
  open: { icon: 'target', cls: 'text-subtle', key: 'nbSprechenGoalOpen' },
};

/**
 * Kompakte Liste der Ziele (Einweisung, Rollenspiel oben). `marks = null`: ohne Haken (ohne KI,
 * oder vor dem ersten Zug). Mit `quotes` stehen die Belege unter dem Ziel (Bericht).
 */
export function GoalChecklist({ goals, marks, quotes = false, testId = 'goal-list', missedAsX = false }: { goals: readonly Bi[]; marks: readonly GoalMark[] | null; quotes?: boolean; testId?: string; missedAsX?: boolean }) {
  const { t, lang } = useT();
  if (!goals.length) return null;
  const done = marks ? marks.filter((m) => m.state === 'met').length : 0;
  return (
    <ul className="flex flex-col gap-1.5" data-testid={testId} data-met={done} data-total={goals.length} aria-label={t('nbSprechenGoals')}>
      {goals.map((g, i) => {
        const m = marks?.find((x) => x.i === i) ?? null;
        const st: GoalState | null = marks ? (m?.state ?? 'open') : null;
        const look = st ? MARK[st] : null;
        const icon = st === 'open' && missedAsX ? 'close' : (look?.icon ?? 'target');
        return (
          <li key={i} className="flex items-start gap-2 text-sm" data-testid="goal-item" data-state={st ?? 'none'}>
            <Icon name={icon} size={16} className={`mt-0.5 flex-none ${look?.cls ?? 'text-subtle'}`} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className={st === 'met' ? 'font-medium' : ''}>{pickLang(g, lang)}</span>
              {st && <span className="sr-only"> – {t(look?.key ?? 'nbSprechenGoalOpen')}</span>}
              {quotes && m && m.quote && (
                <span className="block text-xs text-muted" lang="en">
                  „{m.quote}“
                </span>
              )}
            </span>
            {quotes && st && <span className={`flex-none text-xs ${look?.cls ?? ''}`}>{t(look?.key ?? 'nbSprechenGoalOpen')}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** Kriterien-Raster im Bericht: ✓ / teilweise / ✗ mit Zitat und einem Satz Begründung. */
export function CriteriaGrid({ criteria, marks }: { criteria: readonly Bi[]; marks: readonly CriterionMark[] }) {
  const { t, lang } = useT();
  if (!criteria.length) return null;
  return (
    <ul className="flex flex-col gap-3" data-testid="criteria-grid">
      {criteria.map((c, i) => {
        const m = marks.find((x) => x.i === i);
        const st: GoalState = m?.state ?? 'open';
        const look = MARK[st];
        return (
          <li key={i} className="flex items-start gap-2 text-sm" data-testid="criterion" data-state={st}>
            <Icon name={st === 'open' ? 'close' : look.icon} size={16} className={`mt-0.5 flex-none ${look.cls}`} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="font-medium">{pickLang(c, lang)}</span>
              {m?.quote && (
                <span className="block text-xs text-muted" lang="en">
                  „{m.quote}“
                </span>
              )}
              {m?.note && <span className="block text-muted">{m.note}</span>}
            </span>
            <span className={`flex-none text-xs ${look.cls}`}>{st === 'open' ? t('nbSprechenCritMissed') : t(look.key)}</span>
          </li>
        );
      })}
    </ul>
  );
}
