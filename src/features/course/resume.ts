import type { Resumable } from '../../app/resume';
import type { RouteOf } from '../../app/router/types';
import { freshSnapshot } from '../grammar/resumeKit';
import { lessonSnapshot, restoreLesson, STEPS, useLessonRun, type LessonSnap } from './lessonRun';

// Fortsetzen einer Lektion (plan.md §4.3 Muss 2, F8): Schritt UND Stand im Schritt.

export const lessonResume: Resumable<LessonSnap> = {
  id: 'lesson',
  version: 1,
  origin: 'learn',
  snapshot: lessonSnapshot,
  subscribe: (cb) => useLessonRun.subscribe(cb),
  restore: restoreLesson,
  route: (s) => ({ name: 'lesson', id: s.lid }),
  label: (s, t) => t('nbLernenResumeLesson', { n: Math.max(1, STEPS.indexOf(s.step)) }),
};

/** `ensure`: Die Lektion lädt sich selbst; eine frische Momentaufnahme derselben Lektion wird vorher vorgemerkt. */
export function ensureLesson(route: RouteOf<'lesson'>): boolean {
  if (useLessonRun.getState().lid === route.id) return true;
  const snap = freshSnapshot<LessonSnap>(lessonResume);
  if (snap && snap.lid === route.id) restoreLesson(snap);
  return true;
}
