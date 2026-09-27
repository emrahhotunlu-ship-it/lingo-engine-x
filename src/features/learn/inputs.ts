import { create } from 'zustand';
import { getDb } from '../../platform/capabilities';
import { logWarn } from '../../platform/diagnostics';
import { readCollection, readDoc } from '../../data/reads';
import { useLive } from '../../data/live';
import { doneLessons } from '../../domain/course/courseDone';
import { lessonMeta, setCourseExtension } from '../../domain/course/catalog';
import { extCatalogOf } from '../../domain/course/extension';
import { readLesson } from '../../domain/course/lessonDoc';
import { poolTasks } from '../../domain/grammar/pool';
import type { GrammarTask } from '../../domain/learn/types';
import type { Lang } from '../../domain/srs/types';

// Eingaben der Lern-Runden, die nicht live abonniert sind (phase2-plan D16): `app/pool` und
// `lesson/*` per `get()`, dazu die offenen Aufgaben des Tagesauftrags aus `ensureDay`
// (`useDayInputs`, §4.10). Alles nur im Speicher. Die Runden werden synchron im Klick gebaut
// (Tastatur am iPhone), darum liegen die Daten vorher bereit; fehlen sie noch, läuft die Runde
// mit Startaufgaben und Seed – nie ohne Inhalt.

type Doc = Record<string, unknown>;

type InputsState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** Aufgaben aus `app/pool`. */
  pool: GrammarTask[];
  /** Lektionsinhalte `lesson/<id>` (roh, geprüft). */
  lessons: Map<string, Doc>;
  /** Offene Aufgaben des Tagesauftrags (neueste Tage zuerst), aus `ensureDay`. */
  dailyOpen: GrammarTask[];
  dailyDay: string | null;
};

export const useLearnInputs = create<InputsState>(() => ({ status: 'idle', pool: [], lessons: new Map(), dailyOpen: [], dailyDay: null }));

// Kurs-Erweiterung (Kap. 6.2): Der Katalog kennt die Lektionen ab l25, sobald `lesson/*` gelesen
// oder lokal ergänzt ist (vor dem Neuzeichnen der Oberfläche, die dieselbe Liste abonniert).
useLearnInputs.subscribe((s, prev) => {
  if (s.lessons !== prev.lessons) setCourseExtension(extCatalogOf(s.lessons));
});

let running: Promise<void> | null = null;

/** Pool und Lektionsinhalte (neu) lesen. Nie in einer Schleife; ausgelöst durch Start, Tageswechsel oder eigenes Schreiben. */
export function loadLearnInputs(): Promise<void> {
  if (running) return running;
  const db = getDb();
  if (!db) return Promise.resolve();
  if (useLearnInputs.getState().status === 'idle') useLearnInputs.setState({ status: 'loading' });
  running = (async () => {
    try {
      const [pool, lessons] = await Promise.all([readDoc(db, 'app/pool'), readCollection(db, 'lesson')]);
      useLearnInputs.setState({
        status: 'ready',
        pool: pool.status === 'valid' ? poolTasks(pool.doc) : [],
        lessons: lessons.valid,
      });
    } catch (err) {
      logWarn('learn:inputs', err, 'app/pool, lesson');
      useLearnInputs.setState((s) => ({ status: s.status === 'ready' ? 'ready' : 'error' }));
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Offene Aufgaben des Tagesauftrags übernehmen (aus `ensureDay`, Schritt 1). */
export function setDailyOpen(day: string, tasks: readonly GrammarTask[]): void {
  useLearnInputs.setState({ dailyOpen: [...tasks], dailyDay: day });
}

/** Eine Lektion lokal ergänzen, nachdem sie gespeichert wurde (kein erneutes Lesen nötig). */
export function rememberLesson(lid: string, doc: Doc): void {
  const lessons = new Map(useLearnInputs.getState().lessons);
  lessons.set(lid, doc);
  useLearnInputs.setState({ lessons });
}

/** Aufgaben erledigter Lektionen (Quelle 4 der Grammatikrunde, §5.2). */
export function doneLessonTasks(lang: Lang): GrammarTask[] {
  const course = useLive.getState().docs['app/course'];
  const done = doneLessons(course);
  const out: GrammarTask[] = [];
  for (const [lid, doc] of useLearnInputs.getState().lessons) {
    if (!done.has(lid)) continue;
    const meta = lessonMeta(lid);
    if (!meta) continue;
    out.push(...(readLesson(doc, lang, meta)?.tasks ?? []));
  }
  return out;
}

/** Dialogzeilen der letzten drei erledigten Lektionen (Diktat, Satzbau), neueste zuerst. */
export function recentLessonLines(lang: Lang): Array<{ en: string; ref: string }> {
  const course = useLive.getState().docs['app/course'];
  const doneObj = (course?.done && typeof course.done === 'object' ? course.done : {}) as Record<string, unknown>;
  const order = Object.entries(doneObj)
    .map(([lid, v]) => ({ lid, t: v && typeof v === 'object' && typeof (v as Doc).t === 'number' ? ((v as Doc).t as number) : 0 }))
    .sort((a, b) => b.t - a.t)
    .slice(0, 3);
  const out: Array<{ en: string; ref: string }> = [];
  for (const { lid } of order) {
    const doc = useLearnInputs.getState().lessons.get(lid);
    const meta = lessonMeta(lid);
    if (!doc || !meta) continue;
    for (const l of readLesson(doc, lang, meta)?.dialogue.lines ?? []) out.push({ en: l.en, ref: `lesson/${lid}` });
  }
  return out;
}
