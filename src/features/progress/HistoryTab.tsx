import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAiAvailable, useAiScope } from '../../ai/scope';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { useDocWatch } from '../../data/watch';
import { readAssess } from '../../domain/assessment/envelope';
import { lastVtest } from '../../domain/assessment/sources';
import { LESSONS, UNITS } from '../../domain/content';
import { addDays, daysBetween } from '../../domain/date';
import { heatmap, historySeries, type SeriesKey } from '../../domain/progress/history';
import { bktMeasures, fsrsMeasures } from '../../domain/progress/measures';
import { citableFacts, lastWeekOf, topicName, weekFacts, type WeekFact } from '../../domain/progress/weekly';
import { detectLang } from '../../domain/lang/detect';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Disclosure } from '../../ui/Disclosure';
import { Heatmap } from '../../ui/charts/Heatmap';
import { LineChart } from '../../ui/charts/LineChart';
import { Skeleton } from '../../ui/Skeleton';
import { aiUsable } from './assessRun';
import { useCollectionsOnce, useDocsOnce } from './useOnce';
import { ensureWeeklyText, storedWeekly, WEEKLY_MIN_FACTS } from './weeklyRun';

// Reiter „Verlauf" (Plan §7.3–7.5): Wortschatztest, Wochenbericht, Verlauf der letzten 120 Tage,
// Aktivität, bisherige Einschätzungen, Meilensteine je Einheit und die eingeklappten Messwerte.

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const SERIES: ReadonlyArray<{ key: SeriesKey; label: MessageKey; color: string }> = [
  { key: 'gr', label: 'hs_gr', color: 'var(--lx-ch-grammar)' },
  { key: 'vo', label: 'hs_vo', color: 'var(--lx-ch-cards)' },
  { key: 'li', label: 'hs_li', color: 'var(--lx-ch-listen)' },
  { key: 'wr', label: 'hs_wr', color: 'var(--lx-ch-write)' },
];
const VTEST_DUE_DAYS = 56;
const dayMs = (d: string) => Date.parse(`${d}T12:00:00`);

function factText(f: WeekFact, t: (k: MessageKey, v?: Record<string, string | number>) => string, tn: (b: 'wf_fixed', n: number, v?: Record<string, string | number>) => string, lang: 'de' | 'en'): string {
  switch (f.kind) {
    case 'word':
      return t('wf_word', { word: f.word });
    case 'topic':
      return t('wf_topic', { topic: topicName(f.topic, lang), from: Math.round(f.from * 100), to: Math.round(f.to * 100) });
    case 'fixed':
      return tn('wf_fixed', f.n, { topic: topicName(f.topic, lang) });
    case 'text': {
      // Titel nur in der Oberflächensprache (Sprachtreue, Befund H2): beide Titel der Aufgabe,
      // sonst der gespeicherte Titel, wenn er erkennbar in dieser Sprache steht, sonst neutral.
      const l = f.lesson ? LESSONS.find((x) => x.id === f.lesson) : undefined;
      // Fehlt der Titel einer Sprache, trägt die Aufgabe oft den der anderen – daher auch hier prüfen.
      const other = lang === 'de' ? 'en' : 'de';
      const pick = f.titles?.[lang] || '';
      const own = (pick && detectLang(pick) !== other ? pick : '') || (f.title && detectLang(f.title) === lang ? f.title : '');
      return t('wf_text', { title: own || (l ? (lang === 'en' ? l.en : l.de) : t('wf_textOwn')) });
    }
    case 'talk':
      return t('wf_talk', { title: f.title || '–' });
    case 'time':
      // Vor `pflichtSince` (bzw. ohne erledigte Pflicht) nur Minuten und Lerntage, nie „Pflicht an 0 Tagen" (Befund W4).
      return f.pflichtDays ? t('wf_time', { min: f.minutes, days: f.activeDays, pflicht: f.pflichtDays }) : t('wf_timePlain', { min: f.minutes, days: f.activeDays });
  }
}

function Weekly() {
  const { t, tn, lang, date } = useT();
  const today = useClock((s) => s.today);
  const profile = useLive((s) => s.docs['app/profile']);
  const vocab = useLive((s) => s.collections.vocab) ?? EMPTY;
  const grammar = useLive((s) => s.collections.grammar) ?? EMPTY;
  const schema = useLive((s) => s.docs['app/schema']);
  const once = useCollectionsOnce(['writing', 'talk', 'wprompt']);
  const weekly = useDocWatch('app/weekly');
  const ai = useAiAvailable();
  const scope = useAiScope();
  const week = useMemo(() => lastWeekOf(today), [today]);
  const facts = useMemo(
    () => (once.status === 'ready' ? weekFacts({ days: week.days, vocab, grammar, writing: once.value.writing ?? EMPTY, talk: once.value.talk ?? EMPTY, prompts: once.value.wprompt ?? EMPTY, profile: obj(profile), pflichtSince: typeof obj(schema).pflichtSince === 'string' ? (obj(schema).pflichtSince as string) : null }) : []),
    [once.status, once.value, week, vocab, grammar, profile, schema],
  );
  const stored = weekly.status === 'ready' ? storedWeekly(weekly.data, week.w, lang) : null;
  const wants = ai && weekly.status === 'ready' && once.status === 'ready' && !stored && citableFacts(facts).length >= WEEKLY_MIN_FACTS;

  // Einmal je Woche und Sprache beim Öffnen des Reiters (Plan E15); nie automatisch wiederholt.
  // Ändern sich die Fakten (Live-Daten), startet KEIN neuer Aufruf: `tried` merkt sich Woche und
  // Sprache. Nach einem Fehler gibt es „Erneut versuchen" (Prüfbefund W8), der mit `refresh` fragt.
  const [run, setRun] = useState<{ key: string; state: 'running' | 'error' } | null>(null);
  const tried = useRef<string | null>(null);
  const factsRef = useRef(facts);
  useEffect(() => {
    factsRef.current = facts;
  }, [facts]);
  const runKey = `${week.w}|${lang}`;
  const start = useCallback(
    (refresh: boolean) => {
      const key = runKey;
      tried.current = key;
      setRun({ key, state: 'running' });
      void ensureWeeklyText({ w: week.w, lang, facts: factsRef.current, stored: null, signal: scope.signal, refresh }).then((r) => {
        setRun((cur) => (cur?.key !== key ? cur : r === 'error' ? { key, state: 'error' } : null));
      });
    },
    [runKey, week.w, lang, scope],
  );
  useEffect(() => {
    if (!wants || !aiUsable() || tried.current === runKey) return;
    start(false);
  }, [wants, runKey, start]);
  const failed = !stored && run?.key === runKey && run.state === 'error';

  const first = week.days[0] ?? today;
  const last = week.days[6] ?? today;
  return (
    <Card aria-labelledby="weekly-title" data-testid="weekly" data-week={week.w}>
      <h2 id="weekly-title" className="text-lg font-semibold">
        {t('weeklyTitle')}
      </h2>
      <p className="text-xs text-subtle">{t('weeklyRange', { from: date(dayMs(first)), to: date(dayMs(last)) })}</p>
      {once.status === 'loading' ? (
        <Skeleton className="mt-3 h-16 w-full" />
      ) : (
        <>
          {stored && (
            <div className="mt-3 flex flex-col gap-2" data-testid="weekly-text">
              <p className="text-base font-medium">{stored.text.headline}</p>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
                {stored.text.learned.map((l, i) => (
                  <li key={i}>{l.text}</li>
                ))}
              </ul>
              <p className="text-sm">
                <span className="text-subtle">{t('weeklyNext')}: </span>
                {stored.text.next}
              </p>
            </div>
          )}
          {!stored && wants && !failed && <p className="mt-3 text-sm text-muted" role="status">{t('weeklyWriting')}</p>}
          {failed && (
            <div role="alert" className="mt-3 flex flex-wrap items-center gap-3" data-testid="weekly-error">
              <p className="text-sm text-muted">{t('weeklyFailed')}</p>
              <Button variant="secondary" icon="refresh" data-ai="" data-testid="weekly-retry" onClick={() => start(true)}>
                {t('aiRetry')}
              </Button>
            </div>
          )}
          {facts.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{t('weeklyEmpty')}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {/* Wörter in einer Zeile (nichts wiederholt sich zwölfmal, Kap. 15). */}
              {facts.some((f) => f.kind === 'word') && (
                <li data-testid="weekly-fact" data-kind="word">
                  {t('wf_words', {
                    words: facts
                      .filter((f): f is Extract<WeekFact, { kind: 'word' }> => f.kind === 'word')
                      .map((f) => f.word)
                      .join(', '),
                  })}
                </li>
              )}
              {facts
                .filter((f) => f.kind !== 'word')
                .map((f) => (
                  <li key={f.id} data-testid="weekly-fact" data-kind={f.kind} className="lx-tnum">
                    {factText(f, t, tn, lang)}
                  </li>
                ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

function MeasuresBody() {
  const { t, num } = useT();
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const vocab = useLive((s) => s.collections.vocab) ?? EMPTY;
  const grammar = useLive((s) => s.collections.grammar) ?? EMPTY;
  const paths = useMemo(() => Array.from({ length: 30 }, (_, k) => `log/${addDays(today, -k)}`), [today]);
  const logs = useDocsOnce(paths);
  const f = useMemo(() => fsrsMeasures(vocab, now, logs.status === 'ready' ? logs.value : undefined), [vocab, now, logs]);
  const b = useMemo(() => bktMeasures(grammar, now), [grammar, now]);
  const { lang } = useT();
  const pct = (x: number | null) => (x === null ? t('msNoData') : `${num(Math.round(x * 100))} %`);
  const rows: Array<[string, string]> = [
    [t('msState_new'), num(f.byState.new)],
    [t('msState_learning'), num(f.byState.learning)],
    [t('msState_review'), num(f.byState.review)],
    [t('msState_relearning'), num(f.byState.relearning)],
    [t('msRecall'), pct(f.meanR)],
    [t('msStability'), f.meanStability === null ? t('msNoData') : t('msStabilityDays', { n: Math.round(f.meanStability) })],
    [t('msLeeches'), num(f.leeches)],
    [t('msAccuracy'), logs.status === 'loading' ? '…' : f.accuracy30 ? `${pct(f.accuracy30.ok / f.accuracy30.n)} · ${num(f.accuracy30.n)}` : t('msNoData')],
  ];
  return (
    <div className="flex flex-col gap-4">
      <table className="w-full text-left text-xs">
        <caption className="pb-1 text-left text-sm font-semibold">{t('msFsrs')}</caption>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-t border-line">
              <th scope="row" className="py-1.5 pr-3 font-normal text-muted">
                {k}
              </th>
              <td className="lx-tnum py-1.5 text-right text-muted">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="w-full text-left text-xs">
        <caption className="pb-1 text-left text-sm font-semibold">{t('msBkt')}</caption>
        <thead>
          <tr className="text-subtle">
            <th scope="col" className="py-1 font-medium">
              {t('grammarLabel')}
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              {t('measuresMastery')}
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              {t('msLast10')}
            </th>
            <th scope="col" className="hidden py-1 text-right font-medium sm:table-cell">
              {t('msDue')}
            </th>
          </tr>
        </thead>
        <tbody>
          {b.map((r) => (
            <tr key={r.id} className="border-t border-line">
              <td className="py-1.5 pr-2 text-muted">
                {lang === 'en' ? r.nameEn : r.name} <span className="text-subtle">· {num(r.n)}</span>
              </td>
              <td className="lx-tnum py-1.5 text-right text-muted">{num(Math.round(r.p * 100))} %</td>
              <td className="lx-tnum py-1.5 text-right text-muted">{r.last10.n ? `${num(r.last10.ok)}/${num(r.last10.n)}` : '–'}</td>
              <td className="lx-tnum hidden py-1.5 text-right text-muted sm:table-cell">{r.due ? new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'short' }).format(r.due) : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HistoryTab() {
  const { t, date, lang } = useT();
  const go = useNav((s) => s.go);
  const today = useClock((s) => s.today);
  const profile = useLive((s) => s.docs['app/profile']);
  const course = useLive((s) => s.docs['app/course']);
  const assessDoc = useLive((s) => s.docs['app/assess']);
  const vt = lastVtest(obj(profile));
  const vtestDue = !vt || !vt.d || daysBetween(vt.d, today) > VTEST_DUE_DAYS;
  const { series, seam } = useMemo(() => historySeries(profile, today), [profile, today]);
  const cells = useMemo(() => heatmap(profile, today), [profile, today]);
  const hist = useMemo(() => readAssess(assessDoc)?.hist ?? [], [assessDoc]);
  const from = addDays(today, -119);
  const fmt = (d: string) => new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'short' }).format(dayMs(d));
  const hasLines = SERIES.some((s) => series[s.key].length > 1);

  const milestones = useMemo(() => {
    const done = obj(obj(course).done);
    return UNITS.map((u) => {
      const ls = LESSONS.filter((l) => l.unit === u.id);
      const ds = ls.map((l) => obj(done[l.id]).d).filter((d): d is string => typeof d === 'string');
      return ds.length === ls.length && ls.length ? { id: u.id, de: u.de, en: u.en, d: ds.sort().at(-1) ?? '' } : null;
    }).filter((x): x is { id: string; de: string; en: string; d: string } => !!x);
  }, [course]);

  return (
    <div className="flex flex-col gap-4" data-testid="history">
      <Card channel="cards" className="flex flex-col gap-3">
        {vt && <p className="lx-tnum text-sm text-muted">{t('vtestLast', { date: date(vt.t || dayMs(vt.d)), p: vt.passive })}</p>}
        {vtestDue && <p className="text-sm">{t('vtestDue')}</p>}
        <div>
          <Button variant={vtestDue ? 'primary' : 'secondary'} icon="target" onClick={() => go({ name: 'vtest' })} data-testid="vtest-start">
            {t('vtestStart')}
          </Button>
        </div>
      </Card>

      <Weekly />

      <Card aria-labelledby="hist-title">
        <h2 id="hist-title" className="text-lg font-semibold">
          {t('historyTitle')}
        </h2>
        <div className="mt-3">
          {hasLines ? (
            <LineChart
              series={SERIES.map((s) => ({ key: s.key, label: t(s.label), color: s.color, points: series[s.key] }))}
              from={from}
              to={today}
              label={t('historyChartLabel')}
              seam={seam ? { d: seam, label: t('historySeam') } : null}
              tableLabel={t('tableShow')}
              dateLabel={t('colDate')}
              formatDate={fmt}
              testId="history-chart"
            />
          ) : (
            <p className="text-sm text-muted" data-testid="history-chart">
              {t('historyEmpty')}
            </p>
          )}
        </div>
      </Card>

      <Card aria-labelledby="heat-title">
        <h2 id="heat-title" className="lx-eyebrow">
          {t('heatTitle')}
        </h2>
        <div className="mt-3">
          <Heatmap weeks={cells} label={t('heatLabel')} cellLabel={(c) => t('heatCell', { date: fmt(c.d), min: c.minutes })} less={t('heatLess')} more={t('heatMore')} testId="heatmap" />
        </div>
      </Card>

      {(hist.length > 0 || milestones.length > 0) && (
        <Card className="grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="lx-eyebrow">{t('assessTrace')}</h2>
            <ol className="mt-2 flex flex-wrap gap-2" data-testid="assess-trace">
              {hist.slice(-12).map((h) => (
                <li key={h.d} className="lx-tnum rounded-full border border-line px-3 py-1 text-xs">
                  <span className="text-subtle">{fmt(h.d)}</span> <span className="font-semibold">{h.cefr ?? '–'}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h2 className="lx-eyebrow">{t('milestones')}</h2>
            {milestones.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{t('milestonesNone')}</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
                {milestones.map((m) => (
                  <li key={m.id}>{t('milestoneUnit', { unit: lang === 'en' ? m.en : m.de, date: date(dayMs(m.d)) })}</li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}

      <Card data-testid="measures">
        <Disclosure label={t('measuresToggle')}>
          <MeasuresBody />
        </Disclosure>
      </Card>
    </div>
  );
}
