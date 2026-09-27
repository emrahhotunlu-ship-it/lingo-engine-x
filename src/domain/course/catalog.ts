import { LESSONS, UNITS, lessonById, type Unit } from '../content';
import type { LessonMeta } from '../learn/types';
import { EMPTY_EXT, type ExtCatalog } from './extension';

// Lehrplan als Katalog (phase2-plan §5.1): 6 Einheiten, 24 Lektionen in fester Reihenfolge.
// Übernommene Daten der alten App (CLAUDE.md A6.11), nicht verändert. Dahinter folgen die von
// Claude erweiterten Lektionen ab l25 (Kap. 6.2, `extension.ts`), sobald `lesson/*` gelesen ist
// (`setCourseExtension`, aufgerufen aus features/learn/inputs.ts).

export type CatalogUnit = Unit & { lessons: LessonMeta[] };

let ext: ExtCatalog = EMPTY_EXT;
let extVersion = 0;
let cache: { v: number; units: CatalogUnit[] } | null = null;

/** Erweiterte Lektionen übernehmen (nur bei echter Änderung; zählt die Version hoch). */
export function setCourseExtension(next: ExtCatalog): void {
  const same = next.lessons.length === ext.lessons.length && next.lessons.every((l, i) => JSON.stringify(l) === JSON.stringify(ext.lessons[i])) && JSON.stringify(next.units) === JSON.stringify(ext.units);
  if (same) return;
  ext = next;
  extVersion++;
}

export const courseExtension = (): ExtCatalog => ext;
/** Version der Erweiterung (für Memo-Abhängigkeiten in der Oberfläche). */
export const courseExtensionVersion = (): number => extVersion;

export function lessonMeta(id: string): LessonMeta | null {
  const l = lessonById(id);
  if (!l) {
    const e = ext.lessons.find((x) => x.id === id);
    if (!e) return null;
    return { id: e.id, unit: e.unit, kind: e.kind, grammar: e.grammar, level: e.level, de: e.de, en: e.en, cando_de: e.cando_de, cando_en: e.cando_en, situation: e.situation, words: e.words.map(([en, de]) => [en, de] as [string, string]) };
  }
  const unit = UNITS.find((u) => u.id === l.unit);
  return {
    id: l.id,
    unit: l.unit,
    kind: unit?.kind ?? 'job',
    grammar: l.grammar,
    level: l.level,
    de: l.de,
    en: l.en,
    cando_de: l.cando_de,
    cando_en: l.cando_en,
    situation: l.situation,
    words: l.words.map(([en, de]) => [en, de] as [string, string]),
  };
}

export function catalog(): readonly CatalogUnit[] {
  if (cache && cache.v === extVersion) return cache.units;
  const base = UNITS.map((u) => ({ ...u, lessons: LESSONS.filter((l) => l.unit === u.id).map((l) => lessonMeta(l.id) as LessonMeta) }));
  const extra = ext.units.map((u) => ({ ...u, lessons: ext.lessons.filter((l) => l.unit === u.id).map((l) => lessonMeta(l.id) as LessonMeta) })).filter((u) => u.lessons.length > 0);
  cache = { v: extVersion, units: [...base, ...extra] };
  return cache.units;
}

/** Lektionen des Lehrplans der alten App (l01–l24). */
export const baseLessonIds = (): readonly string[] => LESSONS.map((l) => l.id);

/** Alle Lektionen in Kursreihenfolge (Lehrplan, dann Erweiterung). */
export const lessonOrder = (): readonly string[] => [...LESSONS.map((l) => l.id), ...ext.lessons.map((l) => l.id)];

export const lessonIndex = (id: string): number => lessonOrder().indexOf(id);

/** Alle Lektionen als Lehrplan-Einträge in Kursreihenfolge. */
export const allLessons = (): LessonMeta[] => catalog().flatMap((u) => u.lessons);
