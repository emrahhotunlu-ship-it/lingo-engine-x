import { useState } from 'react';
import { patternById } from '../../domain/grammar/patterns';
import { focusWeekOf, readWf, wfOp, type FocusOption } from '../../domain/progress/weekly3';
import { useT } from '../../i18n';
import { logWarn } from '../../platform/diagnostics';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { recordProfileFields } from './persist';

// Fokus für diese Woche (Lernplattform 3.0 P50, Motivation §4.9 Nr. 8): zwei Vorschläge und „Die App entscheidet“ (Standard). Die Wahl wird in
// `app/profile.wf` gespeichert und wirkt erst ab dem nächsten Plan (`domain/progress/weekly3.ts` `focusFor`): der Plan von heute bleibt, wie er ist.

type Props = { options: readonly FocusOption[]; today: string; profileWf: unknown };

export function FocusPick({ options, today, profileWf }: Props) {
  const { t, lang } = useT();
  const week = focusWeekOf(today);
  // Sonntags gilt die Wahl für die kommende Woche: der Titel sagt es.
  const next = new Date(`${today}T12:00:00Z`).getUTCDay() === 0;
  const chosen = readWf(profileWf).find((e) => e.w === week)?.a ?? '';
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const nameOf = (id: string): string => patternById(id)?.name[lang] ?? id;
  // Eine frühere Wahl, die nicht mehr unter den Vorschlägen steht, bleibt sichtbar und abwählbar.
  const extra = chosen && !options.some((o) => o.pat === chosen) && patternById(chosen) ? chosen : null;
  const pick = async (a: string): Promise<void> => {
    if (a === chosen || state === 'saving') return;
    setState('saving');
    try {
      const ok = await recordProfileFields('weekly:focus', (cur) => wfOp(cur, { w: week, a, t: Date.now() }));
      setState(ok ? 'saved' : 'failed');
    } catch (err) {
      logWarn('weekly:focus', err);
      setState('failed');
    }
  };
  const rows: Array<{ key: string; value: string; title: string; sub: string }> = [
    ...(extra ? [{ key: `x-${extra}`, value: extra, title: nameOf(extra), sub: '' }] : []),
    ...options.map((o) => ({
      key: `${o.id}-${o.pat}`,
      value: o.pat,
      title: nameOf(o.pat),
      sub: o.id === 'confusion' && o.other ? t(o.confirmed ? 'moWkFocusConf' : 'moWkFocusConfUn', { other: nameOf(o.other) }) : t('moWkFocusWeak', { n: o.chapter ?? 1 }),
    })),
    { key: 'auto', value: '', title: t('moWkFocusAuto'), sub: t('moWkFocusAutoSub') },
  ];
  return (
    <Card channel="grammar" className="flex flex-col gap-3" aria-labelledby="wk-focus-title" data-testid="wk-focus">
      <div className="flex flex-col gap-1">
        <h2 id="wk-focus-title" className="m-0 text-lg font-semibold">
          {t(next ? 'moWkFocusTitleNext' : 'moWkFocusTitle')}
        </h2>
        <p className="m-0 text-sm text-muted">{t('moWkFocusLead')}</p>
      </div>
      {options.length === 0 && !extra && (
        <p className="m-0 text-sm text-muted" data-testid="wk-focus-none">
          {t('moWkFocusNone')}
        </p>
      )}
      <div role="radiogroup" aria-label={t('moWkFocusTitle')} className="flex flex-col gap-2">
        {rows.map((r) => {
          const on = r.value === chosen;
          return (
            <button
              key={r.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => void pick(r.value)}
              className={`flex min-h-12 items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-left transition-colors ${on ? 'bg-accent-soft' : 'bg-surface hover:bg-surface-strong'}`}
              data-testid="wk-focus-opt"
              data-value={r.value}
              data-on={on ? '1' : '0'}
            >
              <span className={`inline-flex size-6 flex-none items-center justify-center rounded-full border ${on ? 'border-transparent bg-accent text-accent-fg' : 'border-line'}`} aria-hidden="true">
                {on && <Icon name="check" size={16} />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={`font-semibold ${on ? 'text-accent-text' : ''}`}>{r.title}</span>
                {r.sub && <span className="text-xs leading-snug text-muted">{r.sub}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="m-0 min-h-5 text-xs text-muted" role="status" data-testid="wk-focus-status" data-state={state}>
        {state === 'saved' ? t('moWkFocusSaved') : state === 'failed' ? t('moWkFocusFail') : ''}
      </p>
    </Card>
  );
}
