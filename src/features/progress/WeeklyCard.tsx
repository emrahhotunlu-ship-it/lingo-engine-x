import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAiAvailable, useAiScope } from '../../ai/scope';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { useDocWatch } from '../../data/watch';
import { LESSONS } from '../../domain/content';
import { citableFacts, lastWeekOf, topicName, weekFacts, type WeekFact } from '../../domain/progress/weekly';
import { detectLang } from '../../domain/lang/detect';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Skeleton } from '../../ui/Skeleton';
import { aiUsable } from './assessRun';
import { ensureWeeklyText, storedWeekly, WEEKLY_MIN_FACTS } from './weeklyRun';

// Wochenbericht (Plan §7.3, O13): eigene Seite `weekly`, erreichbar über das Profil-Blatt und
// montags über eine ruhige Zeile auf Heute (plan.md §1.2/§1.3). Inhalt unverändert aus dem
// bisherigen Reiter „Verlauf“: belegte Fakten der letzten Woche (Wörter, Grammatik; Fokus-Umbau: keine
// Minuten als Leistung) und Claudes Text (einmal je Woche und Sprache). Die Fallen-Wochenzeile steht im Verlauf (O19).

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
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


export function WeeklyCard() {
  const { t, tn, lang, date } = useT();
  const today = useClock((s) => s.today);
  const profile = useLive((s) => s.docs['app/profile']);
  const vocab = useLive((s) => s.collections.vocab) ?? EMPTY;
  const grammar = useLive((s) => s.collections.grammar) ?? EMPTY;
  const schema = useLive((s) => s.docs['app/schema']);
  const weekly = useDocWatch('app/weekly');
  const ai = useAiAvailable();
  const scope = useAiScope();
  const week = useMemo(() => lastWeekOf(today), [today]);
  const facts = useMemo(
    () => weekFacts({ days: week.days, vocab, grammar, writing: EMPTY, talk: EMPTY, profile: obj(profile), pflichtSince: typeof obj(schema).pflichtSince === 'string' ? (obj(schema).pflichtSince as string) : null }).filter((f) => f.kind !== 'time'),
    [week, vocab, grammar, profile, schema],
  );
  const stored = weekly.status === 'ready' ? storedWeekly(weekly.data, week.w, lang) : null;
  const wants = ai && weekly.status === 'ready' && !stored && citableFacts(facts).length >= WEEKLY_MIN_FACTS;

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
      {weekly.status === 'loading' ? (
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

