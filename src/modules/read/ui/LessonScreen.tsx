import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dayKey, logError, logWarn } from '../shared';
import { Button, Skeleton, getWriter, useNav, useT } from '../sharedUi';
import type { ScreenProps } from '../sharedUi';
import { loadLesson, saveLessonProgress } from '../courseStore';
import { courseDef, lessonKey, lessonPlan, parseLessonKey } from '../domain/courses';
import type { Lesson } from '../domain/lesson';
import { entryStatus, firstUnfinished, mergeEntry, parseProgress } from '../domain/lessonProgress';
import type { LessonEntry } from '../domain/lessonProgress';
import { parsePrefs } from '../domain/docs';
import { READ_PREFS_PATH, READ_PROGRESS_PATH } from '../domain/paths';
import { buildModel, pickKeyWords } from '../domain/readerModel';
import { formatAsOf } from '../domain/readerText';
import { buildWarmup, keptPhrasesOf } from '../domain/warmup';
import type { ArticleItem, ReadState, ReadView } from '../schemas';
import { ApplyCard, GoalCard, StepsCard, TipCard, WarmupCard, useFieldFocusFlag } from './LessonParts';
import { KeyWordsCard } from './reader/KeyWordsCard';
import { ReaderView } from './reader/ReaderView';
import type { LessonSlots } from './reader/ReaderView';
import { saveView } from './reader/persist';
import { readDocOrUndefined } from './useReadHome';

// Eine Kurslektion (Paket L8, docs/umbau/lesen-kurse.md §2): derselbe Leser wie bei den Artikeln (Satzpaare, Ansichten, Wort antippen,
// Prüffragen mit Begründung), dazu Ziel, Aufwärmen, Sprachtipp, Anwenden und Wendungen zum Mitnehmen. „Fertig“ ist ein Zustand:
// Text gelesen + drei Fragen beantwortet + Anwenden abgeschickt (domain/lessonProgress.ts). Geschrieben wird nur auf Handlung (Antwort,
// Abschicken, Verlassen) und nur `read/cp`.

type Loaded = {
  lesson: Lesson;
  entries: LessonEntry[];
  entry: LessonEntry | null;
  view: ReadView;
  autoSpeak: boolean;
};
type Phase = { key: string } & ({ status: 'loading' } | { status: 'notfound' } | { status: 'locked' } | { status: 'pending'; hidden: boolean } | { status: 'failed' } | ({ status: 'ready' } & Loaded));

export function LessonScreen({ route }: ScreenProps<'readLesson'>) {
  const { t } = useT();
  const go = useNav((s) => s.go);
  const key = route.id;
  const parsed = parseLessonKey(key);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase | null>(null);

  useEffect(() => {
    let alive = true;
    const pk = `${key}#${attempt}`;
    void (async () => {
      if (!parsed) {
        if (alive) setPhase({ key: pk, status: 'notfound' });
        return;
      }
      try {
        const [cp, res, prefs] = await Promise.all([readDocOrUndefined(READ_PROGRESS_PATH), loadLesson(readDocOrUndefined, parsed.course, parsed.n), readDocOrUndefined(READ_PREFS_PATH)]);
        if (!alive) return;
        const doc = parseProgress(cp);
        const entries = doc.ok ? doc.items : [];
        const def = courseDef(parsed.course);
        const cur = def ? firstUnfinished(def, entries, parsed.course) : null;
        if (cur !== null && parsed.n > cur) {
          setPhase({ key: pk, status: 'locked' });
          return;
        }
        if (res.status === 'failed') {
          setPhase({ key: pk, status: 'failed' });
          return;
        }
        if (res.status !== 'ready') {
          setPhase({ key: pk, status: 'pending', hidden: res.status === 'hidden' });
          return;
        }
        const p = parsePrefs(prefs);
        setPhase({ key: pk, status: 'ready', lesson: res.lesson, entries, entry: entries.find((e) => e.id === key) ?? null, view: p.view, autoSpeak: p.autoSpeak });
      } catch (err) {
        logError('read:lesson', err, key);
        if (alive) setPhase({ key: pk, status: 'failed' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [key, attempt]); // eslint-disable-line react-hooks/exhaustive-deps -- `parsed` ist eine reine Funktion von `key`

  const cur = phase && phase.key === `${key}#${attempt}` ? phase : null;
  const toCourse = () => go({ name: 'readCourse', id: parsed?.course ?? 'k1' });

  if (!cur || cur.status === 'loading')
    return (
      <div className="mx-auto flex w-full max-w-[66ch] flex-col gap-3" role="status" aria-label={t('rdcLoading')} data-testid="lsn-loading">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  if (cur.status === 'notfound' || cur.status === 'locked' || cur.status === 'pending' || cur.status === 'failed') {
    const plan = parsed ? lessonPlan(parsed.course, parsed.n) : null;
    const body = cur.status === 'locked' ? t('rdcLockedBody') : cur.status === 'failed' ? t('rdcLoadFailed') : cur.status === 'notfound' ? t('rdcNotFound') : t('rdcPendingBody');
    return (
      <div className="mx-auto flex w-full max-w-[66ch] flex-col gap-4 py-4" data-testid="lsn-unavailable" data-status={cur.status}>
        {parsed ? <p className="m-0 text-2xs font-semibold uppercase tracking-wide text-accent-text">{t('rdcKicker', { code: parsed.course.toUpperCase(), n: parsed.n, total: courseDef(parsed.course)?.lessons ?? 0 })}</p> : null}
        {plan ? <LessonTitle plan={plan} /> : null}
        <p className="m-0 text-sm text-muted" role="status">
          {body}
        </p>
        <div className="flex flex-wrap gap-2">
          {cur.status === 'failed' ? (
            <Button variant="secondary" icon="refresh" onClick={() => setAttempt((n) => n + 1)}>
              {t('rdErrRetry')}
            </Button>
          ) : null}
          {parsed ? (
            <Button variant="secondary" onClick={toCourse} data-testid="lsn-to-course">
              {t('rdcToCourse')}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }
  return <LessonView key={cur.lesson.id} data={cur} />;
}

function LessonTitle({ plan }: { plan: { titleEn: string; titleDe: string } }) {
  const { lang } = useT();
  return <h1 className="m-0 text-xl font-semibold tracking-tight text-fg">{lang === 'de' ? plan.titleDe : plan.titleEn}</h1>;
}

const KEPT_ERRORS = 'read:lesson-progress';

function LessonView({ data }: { data: Loaded }) {
  const { t, lang } = useT();
  const go = useNav((s) => s.go);
  const { lesson } = data;
  useFieldFocusFlag();
  const def = courseDef(lesson.course);
  const key = lessonKey(lesson.course, lesson.n);
  const flushRef = useRef<(() => void) | null>(null);
  const registerFlush = useCallback((fn: (() => void) | null) => {
    flushRef.current = fn;
  }, []);
  const [entry, setEntry] = useState<LessonEntry>(() => data.entry ?? { id: key, course: lesson.course, n: lesson.n });
  // Der Stand beim Öffnen für den Leser (Zeit, Satz, gelesen). Später ändert der Leser seinen Stand selbst.
  const startState = useMemo<ReadState | null>(
    () => (data.entry ? { t0: data.entry.t0 ?? null, sec: data.entry.sec ?? 0, pos: data.entry.pos ?? 0, done: data.entry.rd === true, q: { n: data.entry.qa ?? 0, ok: data.entry.qok ?? 0 } } : null),
    [data.entry],
  );

  const save = useCallback(
    (patch: Partial<LessonEntry>) => {
      setEntry((prev) => mergeEntry(prev, { id: key, course: lesson.course, n: lesson.n, ...patch }, Date.now()));
      const writer = getWriter();
      if (!writer) {
        logWarn(KEPT_ERRORS, { code: 'no_writer', message: 'kein Schreibzugriff' }, key);
        return;
      }
      saveLessonProgress(writer, key, patch).catch((err: unknown) => logWarn(KEPT_ERRORS, err, key));
    },
    [key, lesson.course, lesson.n],
  );

  const onProgress = useCallback(
    (p: ReadState) => {
      const patch: Partial<LessonEntry> = {};
      if (typeof p.sec === 'number') patch.sec = p.sec;
      if (typeof p.pos === 'number') patch.pos = p.pos;
      if (typeof p.t0 === 'number') patch.t0 = p.t0;
      if (p.done === true) patch.rd = true;
      if (p.q) {
        patch.qa = p.q.n ?? 0;
        patch.qok = p.q.ok ?? 0;
      }
      save(patch);
    },
    [save],
  );

  const onAnswers = useCallback(
    (a: Record<number, number>) => {
      const n = Object.keys(a).length;
      const ok = lesson.check.reduce((acc, q, i) => acc + (a[i] === q.a ? 1 : 0), 0);
      save({ qa: n, qok: ok });
    },
    [lesson.check, save],
  );

  const onSubmit = useCallback(
    (text: string) => {
      flushRef.current?.();
      save({ ap: true, mine: text, ph: keptPhrasesOf(lesson) });
    },
    [lesson, save],
  );

  // „Text gelesen“ braucht Ende gesehen UND genug Zeit. Fehlt nur noch die Zeit, schreibt der Leser den Stand nachträglich: ein paar einzelne,
  // begrenzte Anläufe (kein Dauer-Takt), danach beim Verlassen.
  const [retry, setRetry] = useState(0);
  const waitingRead = entry.ap === true && (entry.qa ?? 0) >= 3 && entry.rd !== true;
  useEffect(() => {
    if (!waitingRead || retry >= 6) return;
    const id = window.setTimeout(() => {
      flushRef.current?.();
      setRetry((n) => n + 1);
    }, 10_000);
    return () => window.clearTimeout(id);
  }, [waitingRead, retry]);

  const article: ArticleItem = useMemo(
    () => ({ id: lesson.id, topic: def?.topic ?? 'custom', kind: 'howto', level: 'c1', title: lesson.title, summary: lesson.goal, asOf: lesson.asOf, paras: lesson.paras, keyWords: lesson.phrases, check: lesson.check, pv: 1 }),
    [lesson, def?.topic],
  );
  const warmup = useMemo(() => buildWarmup(data.entries, lesson.course, lesson.n), [data.entries, lesson.course, lesson.n]);
  const picks = useMemo(() => pickKeyWords(buildModel({ paras: lesson.paras }), lesson.phrases), [lesson.paras, lesson.phrases]);
  const total = def?.lessons ?? lesson.n;
  const nextKey = lesson.n < total ? lessonKey(lesson.course, lesson.n + 1) : null;
  const done = entry.done === true;
  // Wurde die Lektion heute fertig, gibt es keine Aufforderung zur nächsten (Tempo, Kap. 7): „Fertig für heute“, die nächste nur leise (Lernwissenschaft N3).
  const [today] = useState(() => dayKey(Date.now()));
  const restToday = done && typeof entry.tD === 'number' && entry.tD > 0 && dayKey(entry.tD) === today;
  const toCourse = useCallback(() => go({ name: 'readCourse', id: lesson.course }), [go, lesson.course]);
  const asOf = formatAsOf(lang, lesson.asOf);

  const slots: LessonSlots = {
    kicker: t('rdcKicker', { code: lesson.course.toUpperCase(), n: lesson.n, total }),
    byline: asOf ? t('rdcByline', { asOf }) : t('rdcBylineNoDate'),
    registerFlush,
    onAnswers,
    top: (
      <>
        <GoalCard lesson={lesson} />
        <WarmupCard items={warmup} />
      </>
    ),
    afterText: <TipCard lesson={lesson} />,
    afterCheck: (
      <>
        <ApplyCard lesson={lesson} submitted={entry.ap === true ? (entry.mine ?? '') : null} onSubmit={onSubmit} />
        <KeyWordsCard picks={picks} article={{ id: lesson.id, title: lesson.title, level: 'c1' }} lang={lang} onSaved={() => undefined} core />
        {lesson.sources.length > 0 ? (
          <section className="lx-card flex flex-col gap-2 p-4" aria-labelledby="lsn-src-h" data-testid="lsn-sources">
            <h2 id="lsn-src-h" className="m-0 text-base font-semibold text-fg">
              {t('rdcSources')}
            </h2>
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {lesson.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-medium text-accent-text underline" data-testid="lsn-source-link">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <StepsCard steps={{ read: entry.rd === true, questions: entry.qa ?? 0, applied: entry.ap === true, done }} onToCourse={toCourse} onNext={done && nextKey ? () => go({ name: 'readLesson', id: nextKey }) : null} restToday={restToday} onHome={() => go({ name: 'read' })} nextN={nextKey ? lesson.n + 1 : null} />
      </>
    ),
  };

  return (
    <div data-testid="lsn" data-lesson={key} data-status={done ? 'done' : entryStatus(entry)}>
      <ReaderView
        key={lesson.id}
        article={article}
        state={startState}
        view={data.view}
        autoSpeak={data.autoSpeak}
        onViewChange={(v) => {
          const w = getWriter();
          if (w) void saveView(w, v);
        }}
        onProgress={onProgress}
        lesson={slots}
      />
    </div>
  );
}
