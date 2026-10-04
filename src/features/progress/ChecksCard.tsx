import { useMemo, type ReactNode } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { checkDoneThisWeek, checkPct, compareLast, readChecks, type CheckRecord, type Pair } from '../../domain/check/record';
import { dayKey } from '../../domain/date';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { Disclosure } from '../../ui/Disclosure';
import { toast } from '../../ui/Toast';
import { startCheck } from '../check/session';

// Reiter „Verlauf" (Kap. 9/14 „alle bisherigen Daten sichtbar", M10): Wochen-Checks – alte aus
// `profile.checks[]` und neue – mit Einstieg in den Check (Extra, einmal je Kalenderwoche).

const SHOWN = 6;
function useShortDate(): (ms: number) => string {
  const { lang } = useT();
  return useMemo(() => {
    const f = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    return (ms: number) => f.format(ms);
  }, [lang]);
}

/** Tabelle mit den neuesten Zeilen sichtbar, der Rest eingeklappt (nichts geht verloren). */
function SplitTable({ head, rows, more, testId }: { head: ReactNode; rows: ReactNode[]; more: string; testId: string }) {
  const table = (body: ReactNode[]) => (
    <table className="w-full text-left text-xs">
      {head}
      <tbody>{body}</tbody>
    </table>
  );
  return (
    <div className="flex flex-col gap-1" data-testid={testId}>
      {table(rows.slice(0, SHOWN))}
      {rows.length > SHOWN && <Disclosure label={more}>{table(rows.slice(SHOWN))}</Disclosure>}
    </div>
  );
}

const pairText = (p: Pair, num: (n: number) => string): string => (p.n ? `${num(p.ok)}/${num(p.n)}` : '–');

/** Zeile „Wochen-Check" oben im Verlauf; die bisherigen Checks liegen zugeklappt darunter. */
export function ChecksRow() {
  const { t, tn, num } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const today = useClock((s) => s.today);
  const profile = useLive((s) => s.docs['app/profile']);
  const checks = useMemo(() => readChecks(profile), [profile]);
  const cmp = compareLast(checks);
  const last = checks[checks.length - 1];
  const doneWeek = checkDoneThisWeek(checks, today, dayKey);
  const fmt = useShortDate();

  const start = () => {
    const first = startCheck();
    if (first === 'empty') {
      toast(t('ckEmpty'));
      return;
    }
    if (first === 'typed') api.focusNow();
    go({ name: 'check' });
  };

  const rows = [...checks].reverse().map((c: CheckRecord) => (
    <tr key={c.t} className="border-t border-line" data-testid="check-row">
      <th scope="row" className="lx-tnum py-1.5 pr-2 font-normal text-muted">
        {fmt(c.t)}
      </th>
      <td className="lx-tnum py-1.5 pr-2 text-right font-semibold">{num(checkPct(c))} %</td>
      <td className="lx-tnum py-1.5 pr-2 text-right text-muted">{pairText(c.vocab, num)}</td>
      <td className="lx-tnum py-1.5 pr-2 text-right text-muted">{pairText(c.colloc, num)}</td>
      <td className="lx-tnum py-1.5 text-right text-muted">{pairText(c.gram, num)}</td>
    </tr>
  ));

  return (
    <div className="flex flex-col gap-2 py-4" data-testid="checks-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
          <h2 id="checks-title" className="text-base font-medium">
            {t('ckTitle')} <span className="text-sm font-normal text-muted">· {t('trExtraBadge')}</span>
          </h2>
          {cmp && last ? (
            <p className="lx-tnum text-sm text-muted" data-testid="check-last">
              {cmp.prevPct === null ? t('ckLastOnly', { pct: cmp.pct, date: fmt(last.t) }) : t('ckLast', { pct: cmp.pct, date: fmt(last.t), prev: cmp.prevPct })}
            </p>
          ) : (
            <p className="text-sm text-muted">{t('ckOfferSub')}</p>
          )}
          {doneWeek && (
            <p className="text-sm text-muted" data-testid="check-week-done">
              {t('ckWeekDone')}
            </p>
          )}
        </div>
        {!doneWeek && (
          <Button variant="secondary" icon="target" onClick={start} data-testid="check-start">
            {t('ckStart')}
          </Button>
        )}
      </div>
      {rows.length > 0 && (
        <Disclosure label={t('ckTableToggle', { n: rows.length })} testId="checks-toggle">
          <SplitTable
            testId="checks-table"
            more={tn('ckMore', rows.length - SHOWN)}
            rows={rows}
            head={
              <>
                <caption className="sr-only">{t('ckTableCaption')}</caption>
                <thead>
                  <tr className="text-subtle">
                    <th scope="col" className="py-1 pr-2 font-medium">
                      {t('colDate')}
                    </th>
                    <th scope="col" className="py-1 pr-2 text-right font-medium">
                      {t('ckColResult')}
                    </th>
                    <th scope="col" className="py-1 pr-2 text-right font-medium">
                      {t('ckAreaVocab')}
                    </th>
                    <th scope="col" className="py-1 pr-2 text-right font-medium">
                      {t('ckAreaColloc')}
                    </th>
                    <th scope="col" className="py-1 text-right font-medium">
                      {t('ckAreaGram')}
                    </th>
                  </tr>
                </thead>
              </>
            }
          />
        </Disclosure>
      )}
    </div>
  );
}
