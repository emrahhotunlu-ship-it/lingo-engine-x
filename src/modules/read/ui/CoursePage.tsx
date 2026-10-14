import type { ReactNode } from 'react';
import { Button, Eyebrow, HeroCard, Icon, Row, RowList, Skeleton, useNav, useT } from '../sharedUi';
import type { ScreenProps } from '../sharedUi';
import { COURSES, LESSON_MINUTES, courseDef, lessonPlan } from '../domain/courses';
import type { CourseDef, CourseId } from '../domain/courses';
import { courseProgress, courseRows } from '../domain/lessonProgress';
import type { LessonRowState, NextLesson } from '../domain/lessonProgress';
import { useCourseHome } from './useCourseHome';
import type { UseCourseHome } from './useCourseHome';

// Kurse im Reiter „Lesen“ (Paket L8): die Kursübersicht (Karte auf dem Bildschirm „Lesen“), die Lektionsliste je Kurs (Seite `readCourse`)
// und der Text des Hauptknopfs. Zustände: gesperrt · wird vorbereitet · offen · angefangen · fertig (Zustand, kein Knopf).

/** Text des Hauptknopfs für eine Lektion: „Heute: K1 · Lektion 3 · ca. 10 Min“ bzw. „Weiter: K1 · Lektion 3“. */
export function useLessonButtonText(): (n: NextLesson) => string {
  const { t } = useT();
  return (n) => t(n.state === 'started' ? 'rdcContinue' : 'rdcToday', { code: n.course.toUpperCase(), n: n.n, min: LESSON_MINUTES });
}

const titleOf = (def: CourseDef, lang: 'de' | 'en'): string => (lang === 'de' ? def.titleDe : def.titleEn);

// ---------------------------------------------------------------- Karte auf dem Bildschirm „Lesen“

export function CoursesCard({ c }: { c: UseCourseHome }) {
  const { t, lang } = useT();
  const go = useNav((s) => s.go);
  if (c.load === 'loading') return <Skeleton className="h-40 w-full rounded-2xl" />;
  const entries = c.home?.entries ?? [];
  return (
    <section className="flex flex-col gap-2.5" aria-label={t('rdcTitle')} data-testid="read-courses" data-load={c.load}>
      <RowList title={t('rdcTitle')} testId="read-courses-list">
        {COURSES.map((def) => {
          const title = titleOf(def, lang);
          const goal = lang === 'de' ? def.goalDe : def.goalEn;
          const sub = `${goal} · ${t('rdcLessonsCount', { n: def.lessons })}`;
          if (!def.active) return <Row key={def.id} title={title} sub={sub} value={t('rdcLater')} testId="read-course" data={{ 'data-course': def.id, 'data-active': 'false' }} />;
          const p = courseProgress(def.id, entries);
          return <Row key={def.id} title={title} sub={sub} value={t('rdcProgressShort', { done: p.done, total: p.total })} chevron onClick={() => go({ name: 'readCourse', id: def.id })} testId="read-course" data={{ 'data-course': def.id, 'data-active': 'true' }} />;
        })}
      </RowList>
      <p className="m-0 text-xs text-muted">{c.load === 'error' ? t('rdcLoadFailed') : t('rdcHint')}</p>
    </section>
  );
}

// ---------------------------------------------------------------- Seite: Lektionsliste eines Kurses

const STATE_KEY: Record<LessonRowState, 'rdcStateLocked' | 'rdcStatePending' | 'rdcStateOpen' | 'rdcStateStarted' | 'rdcStateDone'> = {
  locked: 'rdcStateLocked',
  pending: 'rdcStatePending',
  open: 'rdcStateOpen',
  started: 'rdcStateStarted',
  done: 'rdcStateDone',
};

export function CoursePage({ route }: ScreenProps<'readCourse'>) {
  const { t, lang } = useT();
  const go = useNav((s) => s.go);
  const c = useCourseHome();
  const buttonText = useLessonButtonText();
  const def = courseDef(route.id);
  if (!def) {
    return (
      <p className="m-0 text-sm text-muted" role="status" data-testid="course-notfound">
        {t('rdcNotFound')}
      </p>
    );
  }
  const id: CourseId = def.id;
  const entries = c.home?.entries ?? [];
  const ready = c.home?.ready.has(id) ?? false;
  const rows = courseRows(id, entries, ready);
  const p = courseProgress(id, entries);
  const current = rows.find((r) => r.state === 'open' || r.state === 'started' || r.state === 'pending');
  const finished = p.done >= p.total && p.total > 0;
  const title = titleOf(def, lang);
  const goal = lang === 'de' ? def.goalDe : def.goalEn;
  const openLesson = (key: string) => go({ name: 'readLesson', id: key });

  let action: ReactNode = null;
  if (current && (current.state === 'open' || current.state === 'started')) {
    const next: NextLesson = { course: id, n: current.n, key: current.key, state: current.state };
    action = (
      <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => openLesson(current.key)} data-testid="course-primary" data-kind="lesson">
        {buttonText(next)}
      </Button>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[47.5rem] flex-col gap-6 py-6 sm:py-10" data-testid="course" data-course={id} data-load={c.load}>
      <header className="flex flex-col gap-1">
        <Eyebrow>{t('rdcCourseEyebrow')}</Eyebrow>
        <h1 className="m-0 text-2xl leading-tight font-bold tracking-[-0.02em] sm:text-3xl" data-testid="course-title">
          {title}
        </h1>
        <p className="m-0 text-sm text-muted">{goal}</p>
      </header>
      {c.load === 'loading' ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : c.load === 'error' ? (
        <div className="lx-card flex flex-col gap-3 p-4" role="alert" data-testid="course-load-error">
          <p className="m-0 text-sm text-danger-text">{t('rdcLoadFailed')}</p>
          <div>
            <Button icon="refresh" onClick={c.reload}>
              {t('rdErrRetry')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <HeroCard
            testId="course-hero"
            tone={finished ? 'done' : 'default'}
            eyebrow={finished ? t('rdcCourseDone') : t('rdcNextUp')}
            meta={t('rdcProgress', { done: p.done, total: p.total })}
            title={finished ? t('rdcCourseDoneBody') : current ? `${t('rdcLessonN', { n: current.n })}: ${lessonTitle(id, current.n, lang)}` : undefined}
            action={action}
          >
            {current?.state === 'pending' ? (
              <p className="m-0 text-sm text-muted" role="status" data-testid="course-pending">
                {t('rdcPendingBody')}
              </p>
            ) : null}
          </HeroCard>
          <RowList title={t('rdcLessons')} testId="course-lessons">
            {rows.map((r) => {
              const clickable = r.state === 'done' || r.state === 'open' || r.state === 'started';
              return (
                <Row
                  key={r.key}
                  title={lessonTitle(id, r.n, lang) ? `${t('rdcLessonN', { n: r.n })} · ${lessonTitle(id, r.n, lang)}` : t('rdcLessonN', { n: r.n })}
                  sub={r.state === 'locked' ? t('rdcLockedShort') : r.state === 'pending' ? t('rdcPendingShort') : undefined}
                  value={r.state === 'done' ? <Icon name="check" size={16} /> : t(STATE_KEY[r.state])}
                  chevron={clickable}
                  {...(clickable ? { onClick: () => openLesson(r.key) } : {})}
                  testId="course-lesson"
                  data={{ 'data-lesson': r.key, 'data-state': r.state }}
                />
              );
            })}
          </RowList>
        </>
      )}
    </div>
  );
}

/** Titel einer Lektion aus dem Katalog (in der Sprache der Oberfläche); fehlt der Plan, steht nur die Nummer. */
function lessonTitle(course: CourseId, n: number, lang: 'de' | 'en'): string {
  const plan = lessonPlan(course, n);
  return plan ? (lang === 'de' ? plan.titleDe : plan.titleEn) : '';
}
