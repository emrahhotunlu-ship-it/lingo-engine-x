import { useMemo } from 'react';
import { getWriter } from '../../data';
import { useLive } from '../../data/live';
import { readCollection, readDoc } from '../../data/reads';
import { allLessons, baseLessonIds, catalog, courseExtension } from '../../domain/course/catalog';
import { doneLessons } from '../../domain/course/courseDone';
import { extendFacts } from '../../domain/course/extendInput';
import { extCatalogOf, extensionState, extLessonDocs, nextExtIds, nextUnitN } from '../../domain/course/extension';
import { getDb } from '../../platform/capabilities';
import { logError, logWarn } from '../../platform/diagnostics';
import { CE_LESSONS, courseExtend, type CourseExtendOut, type CourseExtendVars } from '../../prompts/courseExtend';
import { workContext } from '../../prompts/work';
import { loadLearnInputs, rememberLesson, useLearnInputs } from '../learn/inputs';

// Kurs erweitern (Kap. 6.2): Eingaben für course-extend sammeln und das Ergebnis als neue
// Lektionen `lesson/l25…` speichern – nur anlegen (`createIfMissing`), nie überschreiben.

type Doc = Record<string, unknown>;

/** Katalog inkl. Erweiterung; zeichnet neu, sobald `lesson/*` gelesen oder ergänzt wurde. */
export function useCourseCatalog() {
  const lessons = useLearnInputs((s) => s.lessons);
  // Die Erweiterung setzt features/learn/inputs.ts beim Lesen von `lesson/*`; hier nur neu berechnen.
  return useMemo(() => {
    void lessons;
    return catalog();
  }, [lessons]);
}

/** Zustand des Angebots „Kurs erweitern“. */
export function useExtensionState(): { allowed: boolean; allDone: boolean } {
  const course = useLive((s) => s.docs['app/course']);
  const units = useCourseCatalog();
  return useMemo(() => {
    void units;
    return extensionState({ doneIds: doneLessons(course), baseIds: baseLessonIds(), ext: courseExtension() });
  }, [course, units]);
}

/** Eingaben der Vorlage (liest `app/radar` einmal frisch; fehlt es, ohne Radar). */
export async function extendVars(): Promise<CourseExtendVars> {
  // Vorhandene Lektionen (Titel, Einheiten) müssen geladen sein, sonst doppeln sich Titel.
  try {
    await loadLearnInputs();
  } catch (err) {
    logWarn('course:extend', err, 'lesson');
  }
  const live = useLive.getState();
  const db = getDb();
  let radar: Doc | null = null;
  if (db) {
    try {
      const r = await readDoc(db, 'app/radar');
      radar = r.status === 'valid' ? r.doc : null;
    } catch (err) {
      logWarn('course:extend', err, 'app/radar');
    }
  }
  const profile = live.docs['app/profile'];
  const mixRaw = profile?.mix && typeof profile.mix === 'object' ? (profile.mix as Doc) : null;
  const mix = mixRaw && typeof mixRaw.work === 'number' && typeof mixRaw.life === 'number' ? { work: mixRaw.work, life: mixRaw.life } : null;
  const facts = extendFacts({ assess: live.docs['app/assess'], grammar: live.collections.grammar ?? new Map(), radar, ext: courseExtension(), lessons: allLessons() });
  return { ...facts, ctx: workContext(profile?.ctx), mix };
}

/**
 * Ergebnis speichern: freie Kennungen nach einem frischen Lesen aller `lesson/*` (auch
 * ungültiger), dann je Lektion `createIfMissing`. Liefert die angelegten Kennungen (leer = nichts).
 */
export async function saveExtension(out: CourseExtendOut, vars: Pick<CourseExtendVars, 'unitN'>, lang: 'de' | 'en'): Promise<string[]> {
  const db = getDb();
  const writer = getWriter();
  if (!db || !writer) return [];
  let existing: string[];
  let unitN = vars.unitN;
  try {
    const all = await readCollection(db, 'lesson');
    existing = [...all.valid.keys(), ...all.invalid];
    // Einheitennummer aus dem frischen Lesen, nicht aus dem Katalog im Speicher (zwei Tabs,
    // noch nicht geladene Lektionen): nie zwei Einheiten mit derselben Nummer.
    unitN = Math.max(unitN, nextUnitN(extCatalogOf(all.valid)));
  } catch (err) {
    logError('course:extend', err, 'lesson');
    return [];
  }
  const ids = nextExtIds(existing, Math.min(CE_LESSONS, out.lessons.length));
  const docs = extLessonDocs(out, { ids, unitN, nowMs: Date.now(), pv: `${courseExtend.id}@${courseExtend.version}`, lang });
  const created: string[] = [];
  for (const { id, doc } of docs) {
    try {
      const r = await writer.createIfMissing(`lesson/${id}`, doc);
      if (r === 'created') {
        created.push(id);
        rememberLesson(id, doc);
      } else logWarn('course:extend', { code: 'exists', message: `lesson/${id} existiert schon – nicht überschrieben` }, `lesson/${id}`);
    } catch (err) {
      logError('course:extend', err, `lesson/${id}`);
    }
  }
  return created;
}
