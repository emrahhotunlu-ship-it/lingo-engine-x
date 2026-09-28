import { useEffect, useState } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useWeekDoc, watchWeek } from '../../app/useWeek';
import { getWriter } from '../../data';
import { validateDoc } from '../../data/validate';
import { addDays } from '../../domain/date';
import { preplyNextOp, readPreplyNext, validNext } from '../../domain/preply/next';
import { useT } from '../../i18n';
import { useCapabilities } from '../../platform/capabilities';
import { logError } from '../../platform/diagnostics';
import { Icon } from '../../ui/Icon';

// „Nächste Stunde am …“ (Neubau N80/N16): Emrah trägt den Termin der nächsten Preply-Stunde ein;
// die Tageseinheit verschiebt damit Block 2/3 (Tag davor · Tag der Stunde · Tag danach, P1).
// Geschrieben wird nur `app/week.preplyNext` – feldweise per `writer.transform`.

export async function savePreplyNext(next: string): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  try {
    await writer.transform('app/week', (cur) => preplyNextOp(cur, cur ? validateDoc('app/week', cur).ok : true, next));
    return true;
  } catch (err) {
    logError('preply:next', err, next);
    return false;
  }
}

/** `app/week` über das EINE referenzgezählte Abo (app/useWeek.ts), nie ein zweites onSnapshot (Kap. 3.4). */
function useWeekRaw(): { status: 'loading' | 'ready' | 'error'; data: Record<string, unknown> | null } {
  const dbReady = useCapabilities((s) => s.db === 'ready');
  useEffect(() => (dbReady ? watchWeek() : undefined), [dbReady]);
  const status = useWeekDoc((s) => s.status);
  const data = useWeekDoc((s) => s.data);
  return { status, data };
}

const fieldClass = 'lx-glass rounded-[var(--radius-control)] px-3 py-2 text-base text-fg lx-tnum';

/** Zeile in der Preply-Brücke: Datum der nächsten Stunde setzen oder löschen. */
export function NextLessonRow() {
  const { t } = useT();
  const today = useClock((s) => s.today);
  const w = useWeekRaw();
  const stored = readPreplyNext(w.data, today);
  const [state, setState] = useState<'idle' | 'saving' | 'failed'>('idle');
  const set = (v: string) => {
    if (v && !validNext(v, today)) return;
    setState('saving');
    void savePreplyNext(v).then((ok) => setState(ok ? 'idle' : 'failed'));
  };
  return (
    <div className="lx-glass flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] px-4 py-3" data-testid="preply-next" data-next={stored ?? ''}>
      <Icon name="history" size={18} className="text-gold-text" aria-hidden="true" />
      <label className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{t('nbSprechenPreplyNext')}</span>
        <input type="date" min={today} value={stored ?? ''} onChange={(e) => set(e.target.value)} disabled={w.status !== 'ready' || state === 'saving'} className={fieldClass} data-testid="preply-next-date" />
      </label>
      {stored && (
        <button type="button" className="min-h-9 text-sm text-muted hover:text-fg" onClick={() => set('')} data-testid="preply-next-clear">
          {t('nbSprechenPreplyNextClear')}
        </button>
      )}
      {state === 'failed' && (
        <p className="w-full text-sm text-danger-text" role="alert">
          {t('nbSprechenPreplyNextFailed')}
        </p>
      )}
    </div>
  );
}

/** Ruhige Zeile auf Heute (L9): „Preply-Stunde heute/morgen · Vorbereiten ›“ – nur dann. */
export function PreplyNextTodayLine() {
  const { t } = useT();
  const today = useClock((s) => s.today);
  const go = useNav((s) => s.go);
  const w = useWeekRaw();
  const next = readPreplyNext(w.data, today);
  if (!next || (next !== today && next !== addDays(today, 1))) return null;
  return (
    <button type="button" onClick={() => go({ name: 'speak', seg: 'preply' })} className="flex min-h-11 items-center gap-2 text-sm text-muted hover:text-fg" data-testid="sp-preply-next" data-when={next === today ? 'today' : 'tomorrow'}>
      <Icon name="history" size={16} className="text-gold-text" aria-hidden="true" />
      {next === today ? t('nbSprechenPreplyToday') : t('nbSprechenPreplyTomorrow')}
      <Icon name="arrowRight" size={16} aria-hidden="true" />
    </button>
  );
}
