import type { ComponentProps, ReactNode } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { useT } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { useVocabMetrics } from '../progress/WordsSegment';
import { dateLabelOf } from './dateLabel';
import type { DayRow } from './DayCard';
import type { StreakWeek } from './TodayWeek';

// Kern e (Emrah 03.11.2026 „Kern zuerst“, Vorschau 9pdpfT8Es8nrdE3vnVeqqx `Main`/`Monitor-Heute`): Heute als EINE Pflicht-Karte.
// Oben Datum und „Dein Tag“; in der Karte „Pflicht: x von n erledigt · ca. m Min.“, ein Balken je Schritt, der laufende Schritt grün hinterlegt
// mit Fortschritt und dem EINEN Knopf, die anderen Schritte als ruhige Zeilen (erledigt = Häkchen, Zustand statt Knopf; Kap. 2 Nr. 2).
// Darunter (am Monitor rechts) „Dein Stand“ (Serie, Wörter fest, Minuten diese Woche) und „Freiwillig – nur wenn du Zeit hast“.
// Echte Karte, Startbild aus `app/today` und Skelett teilen diesen Aufbau, damit beim Laden nichts springt.

/** Eine Zeile der Pflicht-Karte: `sub` = Unterzeile (Grund/Thema), `progress` = Stand des laufenden Schritts. */
export type KernRow = DayRow & { sub: string | null; progress?: { done: number; total: number } | null };

/** Datum über der Karte (Vorschau `Dienstag, 4. November`). „Dein Tag“ steht seit dem Glas-Aufbau (Emrah 03.11.2026) als Überzeile IN der Karte. */
export function KernHello() {
  const { lang } = useT();
  const today = useClock((s) => s.today);
  return (
    <header className="lx-kh-hello">
      <p className="lx-kh-date">
        <span data-testid="hello-date">{dateLabelOf(today, lang)}</span>
      </p>
    </header>
  );
}

/** Ein Balken je Pflichtschritt (Vorschau: drei Balken, der laufende anteilig gefüllt). Rein schmückend, die Zahl steht daneben. */
function Segs({ fills }: { fills: readonly number[] }) {
  return (
    <div
      className="lx-kh-segs"
      aria-hidden="true"
      data-testid="day-segs"
      data-fills={fills.map((f) => Math.round(Math.max(0, Math.min(1, f)) * 100) / 100).join(',')}
      style={{ gridTemplateColumns: `repeat(${Math.max(1, fills.length)}, minmax(0, 1fr))` }}
    >
      {fills.map((f, i) => (
        <i key={i}>
          <b style={{ width: `${Math.round(Math.max(0, Math.min(1, f)) * 100)}%` }} />
        </i>
      ))}
    </div>
  );
}

/**
 * Die Pflicht-Karte. `go` ist der EINE Knopf (steht im laufenden Schritt; ohne laufenden Schritt unter den Zeilen). `prefix` hält die
 * Test-Kennungen wie bisher (`duties`/`duty`/`reason`; Startbild `start-…`).
 */
export function KernDayCard({
  rows,
  fills,
  done,
  total,
  rest,
  go,
  prefix,
  titleId,
  extra,
  ...attrs
}: {
  rows: readonly KernRow[];
  fills: readonly number[];
  done: number;
  total: number;
  rest: number;
  go: ReactNode;
  prefix: 'today' | 'start';
  titleId: string;
  extra?: ReactNode;
} & Omit<ComponentProps<'section'>, 'children'>) {
  const { t } = useT();
  const real = prefix === 'today';
  const hasNow = rows.some((r) => r.state === 'now');
  return (
    <section className="lx-kh-card" aria-labelledby={titleId} {...attrs}>
      <div className="lx-kh-head">
        <div className="lx-kh-ti">
          <h2 className="lx-kh-eye">{t('vhDayCard')}</h2>
          <h3 id={titleId} className="lx-kh-count lx-v-num" data-testid={real ? 'today-title' : 'start-next'}>
            {t('kernDuty', { n: done, total })}
          </h3>
        </div>
        {rest > 0 && <span className="lx-kh-min lx-v-num">{t('kernAbout', { min: rest })}</span>}
      </div>
      <Segs fills={fills} />
      <ol className="lx-kh-steps" aria-label={t('vRingBlocks')} data-testid={real ? 'duties' : 'start-duties'}>
        {rows.map((r, i) => {
          const now = r.state === 'now';
          const pct = r.progress && r.progress.total > 0 ? Math.min(100, Math.round((r.progress.done / r.progress.total) * 100)) : null;
          return (
            <li
              key={r.id}
              className="lx-kh-st"
              data-st={r.state}
              data-testid={real ? 'duty' : 'start-duty'}
              data-duty={r.id}
              data-state={r.state === 'done' ? 'done' : 'open'}
              data-now={now ? 'true' : undefined}
              data-min={r.min}
              aria-current={now ? 'step' : undefined}
            >
              <div className="lx-kh-st-row">
                <span className="lx-kh-dot lx-v-num" aria-hidden="true">
                  {r.state === 'done' ? <Icon name="check" size={18} /> : i + 1}
                </span>
                <div className="lx-kh-st-b">
                  <h4 className="lx-kh-st-n" data-testid={now ? (real ? 'today-topic' : 'start-title') : undefined}>
                    {r.name}
                    <span className="sr-only">
                      {' · '}
                      {t(r.state === 'done' ? 'vStepDone' : now ? 'vStepRun' : 'vStepOpen')}
                    </span>
                  </h4>
                  {r.state === 'done' ? (
                    <p className="lx-kh-st-s">{t('vhStepDone')}</p>
                  ) : r.sub ? (
                    <p className="lx-kh-st-s lx-v-num">
                      <span data-testid={real ? 'reason' : undefined} data-why={r.whyKey}>
                        {now || !r.min ? r.sub : t('kernStepSub', { why: r.sub, min: r.min })}
                      </span>
                    </p>
                  ) : !now && r.min ? (
                    <p className="lx-kh-st-s lx-v-num">{t('kernAbout', { min: r.min })}</p>
                  ) : null}
                  {/* Ehrlicher Zähler (ux-reviewer 03.11.): vor der ersten Karte steht der Stand („0 von 46 erledigt“) unter dem Grund; danach ist er die Unterzeile. */}
                  {now && r.progress && r.progress.done === 0 && r.progress.total > 0 && (
                    <p className="lx-kh-st-s lx-v-num" data-testid={real ? 'today-step-count' : 'start-step-count'}>
                      {t('tdProgressLabel', { done: 0, total: r.progress.total })}
                    </p>
                  )}
                  {now && pct !== null && (
                    <div className="lx-kh-bar" aria-hidden="true">
                      <i style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              </div>
              {now && <div className="lx-kh-go">{go}</div>}
            </li>
          );
        })}
      </ol>
      {!hasNow && <div className="lx-kh-go">{go}</div>}
      {extra}
    </section>
  );
}

const EMPTY_OBJ: Record<string, unknown> = {};
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : EMPTY_OBJ);

/**
 * „Dein Stand“ (Vorschau): Serie, Wörter fest, Minuten dieser Woche. Handy: eine ruhige Zeile mit drei Zahlen; Monitor (`list`): Karte mit
 * drei Zeilen rechts. Zahlen aus denselben Quellen wie überall (`useStreakWeek`, `useVocabMetrics`, `app/profile.minutes` der Wochentage).
 */
/** `foot`: Serien-Fußzeile für Vorleseprogramme hier zeigen (nach der Pflicht trägt sie der Wochenstreifen bzw. die Wochenliste). */
export function KernStand({ sw, variant, foot: withFoot = true }: { sw: StreakWeek; variant: 'row' | 'list'; foot?: boolean }) {
  const { t, tn, num } = useT();
  const { fest, onWay } = useVocabMetrics();
  // Keine nackte Null (UX-Audit U1): solange noch kein Wort fest ist, steht die Zahl der Wörter im Lernen da.
  const words = fest === 0 && onWay > 0 ? { n: onWay, label: t('kernOnWay') } : { n: fest, label: t('kernFest') };
  const profile = useLive((s) => s.docs['app/profile']);
  const minutes = obj(obj(profile).minutes);
  const week = Math.round(sw.week.reduce((a, d) => a + Math.max(0, Number(minutes[d.day] ?? 0) || 0), 0));
  const streak = sw.streak ?? 0;
  // Fußzeile der Serie für Screenreader und Tests (`today-streak`, früher bei der Woche): steht genau einmal, hier bei „Dein Fortschritt“.
  const foot =
    withFoot && sw.foot ? (
      <span className="sr-only" data-testid="today-streak">
        {sw.foot}
      </span>
    ) : null;
  if (variant === 'list') {
    return (
      <section className="lx-kh-stand" data-variant="list" aria-labelledby="kh-stand" data-testid="today-stand">
        {foot}
        <h2 id="kh-stand" className="lx-kh-lbl">
          {t('gmStandHead')}
        </h2>
        <p className="lx-kh-stand-row">
          <span>{t('kernStreak')}</span>
          <b className="lx-v-num" data-testid="stand-streak" data-n={streak}>
            {tn('kernDays', streak, { n: num(streak) })}
          </b>
        </p>
        <p className="lx-kh-stand-row">
          <span>{words.label}</span>
          <b className="lx-v-num" data-testid="today-stand-words" data-fest={fest}>
            {num(words.n)}
          </b>
        </p>
        <p className="lx-kh-stand-row">
          <span>{t('kernWeekMin')}</span>
          <b className="lx-v-num" data-testid="stand-week" data-min={week}>
            {t('kernMin', { n: num(week) })}
          </b>
        </p>
      </section>
    );
  }
  return (
    <section className="lx-kh-stand" data-variant="row" aria-label={t('gmStandHead')} data-testid="today-stand">
      {foot}
      <p>
        <b className="lx-v-num" data-testid="stand-streak" data-n={streak}>
          {num(streak)}
        </b>
        <span>{tn('kernStreakSm', streak)}</span>
      </p>
      <p>
        <b className="lx-v-num" data-testid="today-stand-words" data-fest={fest}>
          {num(words.n)}
        </b>
        <span>{words.label}</span>
      </p>
      <p>
        <b className="lx-v-num" data-testid="stand-week" data-min={week}>
          {num(week)}
        </b>
        <span>{t('kernWeekMinSm')}</span>
      </p>
    </section>
  );
}
