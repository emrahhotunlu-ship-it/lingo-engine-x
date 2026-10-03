import { useMemo, useState } from 'react';
import { useNav } from '../../app/nav';
import { THEMES, themeById } from '../../content/nb/themes';
import { trapById } from '../../content/nb/traps';
import { addDays, isoWeek } from '../../domain/date';
import { dowOf, suggestTheme, unitPlanFor } from '../../domain/week';
import { useLive } from '../../data/live';
import { normGoalMin } from '../../domain/progress/settings';
import { useT, type MessageKey, type PluralBase } from '../../i18n';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { ScreenHeader } from '../learn/ui';
import { topicName } from '../grammar/GrammarScreen';
import { blockWhy } from '../unit/labels';
import { chooseTheme } from './store';
import { useWeekState } from './useWeekState';

// Seite „Deine Woche“ (plan.md §1.5, N11/N13; Einstieg auf Üben › Dein Weg): Thema, Kernaufgabe,
// Wendungen, Ziele (≤ 4: Fallen, Werkzeug), Wochenplan Mo–So und „Thema ändern“.

export function WeekPage() {
  const { t, tn, lang } = useT();
  const back = useNav((s) => s.back);
  const { day, week, pick, targets, ok, failed } = useWeekState();
  const goalMin = normGoalMin(useLive((s) => s.docs['app/profile']?.goalMin));
  const [change, setChange] = useState(false);
  const th = pick.theme;
  const monday = addDays(day, 1 - dowOf(day));
  const plan = useMemo(
    () =>
      Array.from({ length: 7 }, (_, k) => {
        const d = addDays(monday, k);
        const p = unitPlanFor(d, week, { goalMin });
        const task = p.blocks.find((b) => b.block === 3);
        return { d, dow: k + 1, why: task ? blockWhy(task, t) : '', min: p.minutes };
      }),
    [monday, week, goalMin, t],
  );
  const next = themeById(suggestTheme({ ...week, cur: { wk: pick.wk, theme: pick.id, by: pick.by } }, isoWeek(addDays(monday, 7))));
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-4 sm:py-8" data-testid="week-page" data-theme-id={pick.id}>
      <ScreenHeader back={back} eyebrow={t('nbHeuteWeekLabel', { wk: pick.wk.slice(-3) })} title={th.title[lang]} lead={th.task[lang]} />
      {!pick.stored && <p className="text-xs text-subtle" data-testid="week-auto">{t('nbHeuteWeekAuto')}</p>}
      {failed && (
        <p className="text-sm text-danger-text" role="alert">
          {t('nbHeuteWeekSaveFailed')}
        </p>
      )}
      <section className="flex flex-col gap-2">
        <p className="lx-eyebrow">{t('nbHeuteWeekPhrases')}</p>
        <ul className="lx-glass flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)]">
          {th.phrases.map((p) => (
            <li key={p.en} className="flex flex-col px-4 py-2.5">
              <span className="text-sm font-medium" lang="en">
                {p.en}
              </span>
              <span className="text-xs text-muted">{lang === 'de' ? p.de : p.def}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-2" data-testid="week-goals">
        <p className="lx-eyebrow">{t('nbHeuteWeekGoals')}</p>
        <ul className="lx-glass flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)] text-sm">
          <li className="px-4 py-2.5">
            <span className="text-muted">{t('nbHeuteWeekFocus')}: </span>
            {th.focus[lang]}
          </li>
          {targets.tool && (
            <li className="px-4 py-2.5">
              <span className="text-muted">{t('nbHeuteWeekTool')}: </span>
              {topicName(targets.tool, lang)}
            </li>
          )}
          {targets.traps.map((id) => {
            const tr = trapById(id);
            return tr ? (
              <li key={id} className="px-4 py-2.5" data-testid="week-trap">
                <span className="text-muted">{t('nbHeuteWeekTrap')}: </span>
                {tr.title[lang]}
              </li>
            ) : null;
          })}
          {targets.goals.length > 0 && (
            <li className="px-4 py-2.5">{targets.goals.map((g) => tn(`nbHeuteGoal_${g.kind}` as PluralBase, g.need)).join(' · ')}</li>
          )}
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <p className="lx-eyebrow">{t('nbHeuteWeekPlan')}</p>
        <ol className="lx-glass flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)]">
          {plan.map((p) => (
            <li key={p.d} data-today={p.d === day ? 'true' : undefined} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${p.d === day ? 'bg-surface-strong' : ''}`}>
              <span className="w-10 flex-none font-medium">{t(`nbHeuteDay${p.dow}` as MessageKey)}</span>
              <span className="min-w-0 flex-1 text-muted">{p.why}</span>
              <span className="lx-tnum flex-none text-xs text-muted">{t('nbHeuteMin', { min: p.min })}</span>
            </li>
          ))}
        </ol>
      </section>
      {next && <p className="text-sm text-muted">{t('nbHeuteWeekNext', { theme: next.title[lang] })}</p>}
      {ok && (
        <section className="flex flex-col gap-2">
          {!change ? (
            <div>
              <Button variant="ghost" onClick={() => setChange(true)} data-testid="week-change">
                {t('nbHeuteWeekChange')}
              </Button>
            </div>
          ) : (
            <ul className="lx-glass flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)]">
              {THEMES.map((x) => (
                <li key={x.id}>
                  <button
                    type="button"
                    data-testid="week-theme"
                    data-theme-id={x.id}
                    onClick={() => {
                      void chooseTheme(x.id, 'user', day);
                      setChange(false);
                    }}
                    className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-strong"
                  >
                    <span className="flex-1">{x.title[lang]}</span>
                    {x.id === pick.id && <Icon name="check" size={16} className="text-accent-text" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
