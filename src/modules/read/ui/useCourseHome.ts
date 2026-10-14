import { useCallback, useEffect, useRef, useState } from 'react';
import { dayKey, logError } from '../shared';
import { loadCourseHome } from '../courseStore';
import type { CourseHome } from '../courseStore';
import { finishedToday } from '../domain/lessonProgress';
import { onReadStateSaved } from '../store';
import { readDocOrUndefined } from './useReadHome';

// Zustand der Kurse für den Bildschirm „Lesen“ und die Kursseite: `read/cp` und die aktuelle Lektion der aktiven Kurse, träge gelesen.
// Neu gelesen wird nur nach einer Handlung (die Lektion hat Fortschritt geschrieben), nie in einer Schleife.

export type CourseLoad = 'loading' | 'ready' | 'error';
export type UseCourseHome = {
  load: CourseLoad;
  home: CourseHome | null;
  /** Heute wurde schon eine Lektion fertig: der Hauptknopf bietet dann nicht gleich die nächste an. */
  doneToday: boolean;
  reload: () => void;
};

export function useCourseHome(): UseCourseHome {
  const [load, setLoad] = useState<CourseLoad>('loading');
  const [home, setHome] = useState<CourseHome | null>(null);
  const [today, setToday] = useState(() => dayKey(Date.now()));
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(() => {
    loadCourseHome(readDocOrUndefined).then(
      (h) => {
        if (!alive.current) return;
        setToday(dayKey(Date.now()));
        setHome(h);
        setLoad('ready');
      },
      (err: unknown) => {
        logError('read:courses', err);
        if (alive.current) setLoad((s) => (s === 'ready' ? s : 'error'));
      },
    );
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);
  useEffect(() => onReadStateSaved(reload), [reload]);

  const doneToday = home ? finishedToday(home.entries, (ms) => dayKey(ms), today) : false;
  return { load, home, doneToday, reload };
}
