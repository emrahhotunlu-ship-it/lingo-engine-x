import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { doneLessons } from '../../domain/course/courseDone';
import { pickLesson } from '../../domain/course/next';
import { topicById } from '../../domain/content';
import { EXT_UNIT_FIRST } from '../../domain/course/extension';
import { armShared } from '../../engine/shared';
import { useT } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { Bar } from '../../ui/ProgressRing';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { ScreenHeader } from '../learn/ui';
import { useCompanionSee } from '../companion/seeing';
import { CourseExtendCard } from './CourseExtendCard';
import { useCourseCatalog } from './extendCourse';

// Kurs (Kap. 6.2): 24 Lektionen in 6 Einheiten, weitergeführt mit dem vorhandenen Kursstand.
// Die nächste Lektion ist hervorgehoben; eine abgeschlossene Einheit wird zum Meilenstein
// „Kann jetzt: …" (M17) – ein Zustand, kein Knopf, kein Feuerwerk.

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
};

export function CourseScreen() {
  const { t, lang } = useT();
  const go = useNav((s) => s.go);
  const course = useLive((s) => s.docs['app/course']);
  useCompanionSee({ area: 'course', label: t('csTitle'), phase: 'idle' });
  const assess = useLive((s) => s.docs['app/assess']);
  const done = useMemo(() => doneLessons(course), [course]);
  const units = useCourseCatalog();
  // `units` als Abhängigkeit: erweiterte Lektionen (l25+) kommen nach dem Lesen von `lesson/*` dazu.
  const next = useMemo(() => {
    void units;
    return pickLesson({ course, assess, lang });
  }, [course, assess, lang, units]);
  const total = units.reduce((a, u) => a + u.lessons.length, 0);
  const doneN = units.reduce((a, u) => a + u.lessons.filter((l) => done.has(l.id)).length, 0);

  return (
    <motion.div className="flex flex-col gap-6 py-6 sm:py-10" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.03 } } }} data-testid="course">
      <motion.div variants={item}>
        <ScreenHeader eyebrow={t('lhCourse')} title={t('csTitle')} lead={t('csProgress', { done: doneN, total })} back={() => go({ name: 'learn' })} />
      </motion.div>
      <motion.div variants={item}>
        <Bar value={total ? doneN / total : 0} label={t('csProgress', { done: doneN, total })} />
      </motion.div>
      {units.map((u) => {
        const uDone = u.lessons.filter((l) => done.has(l.id)).length;
        const complete = uDone === u.lessons.length && u.lessons.length > 0;
        return (
          <motion.section key={u.id} variants={item} className="flex flex-col gap-3" data-testid="unit" data-unit={u.id} data-complete={complete || undefined} aria-labelledby={`unit-${u.id}`}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 id={`unit-${u.id}`} className="text-lg font-semibold tracking-tight">
                {t('csUnit', { n: u.n, title: lang === 'de' ? u.de : u.en })}
                {u.n >= EXT_UNIT_FIRST && (
                  <span className="ml-2 inline-flex translate-y-[-1px] items-center gap-1 align-middle text-xs font-medium text-accent-text" data-testid="unit-ext">
                    <Icon name="sparkle" size={14} />
                    {t('ceBadge')}
                  </span>
                )}
              </h2>
              <span className="lx-tnum flex-none whitespace-nowrap text-sm text-muted">{t('csUnitCount', { done: uDone, total: u.lessons.length })}</span>
            </div>
            {complete && (
              <p className="flex items-start gap-2 rounded-xl bg-accent-soft px-4 py-3 text-sm" data-testid="milestone" lang={lang}>
                <Icon name="flag" size={18} className="mt-0.5 flex-none text-accent-text" />
                <span>
                  <span className="font-semibold">{t('csMilestone')}</span> {t('csCanNow', { cando: lang === 'de' ? u.goal_de : u.goal_en })}
                </span>
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {u.lessons.map((l) => {
                const state = done.has(l.id) ? 'done' : next?.lid === l.id ? 'next' : 'open';
                const tp = topicById(l.grammar);
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      className={`lx-glass flex w-full items-center justify-between gap-3 rounded-[var(--radius-card)] px-4 py-3 text-left transition-colors hover:bg-surface-strong ${state === 'next' ? 'ring-1 ring-accent' : ''}`}
                      onClick={(e) => {
                        // Kap. 4.4: Der Titel der Zeile gleitet in den Kopf der Lektion.
                        armShared(`lesson-${l.id}`, e.currentTarget.querySelector('[data-shared-src]'));
                        go({ name: 'lesson', id: l.id });
                      }}
                      data-testid="lesson-row"
                      data-lesson={l.id}
                      data-state={state}
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="max-w-full self-start font-medium" data-shared-src="">
                          {lang === 'de' ? l.de : l.en}
                        </span>
                        <span className="text-xs text-muted">
                          {l.level} · {lang === 'en' ? (tp?.name_en ?? tp?.name) : tp?.name}
                        </span>
                      </span>
                      {state === 'done' ? (
                        <span className="inline-flex items-center gap-1 text-sm text-accent-text">
                          <Icon name="check" size={18} />
                          <span className="sr-only">{t('csDone')}</span>
                        </span>
                      ) : state === 'next' ? (
                        <span className="text-sm font-medium text-accent-text">{t('csNext')}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.section>
        );
      })}
      <motion.div variants={item}>
        <CourseExtendCard />
      </motion.div>
    </motion.div>
  );
}
