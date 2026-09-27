import { LESSONS, UNITS, lessonById, type Unit } from '../content';
import type { LessonMeta } from '../learn/types';

// Lehrplan als Katalog (phase2-plan §5.1): 6 Einheiten, 24 Lektionen in fester Reihenfolge.
// Übernommene Daten der alten App (CLAUDE.md A6.11), nicht verändert.

export type CatalogUnit = Unit & { lessons: LessonMeta[] };

export function lessonMeta(id: string): LessonMeta | null {
  const l = lessonById(id);
  if (!l) return null;
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

let cache: CatalogUnit[] | null = null;
export function catalog(): readonly CatalogUnit[] {
  if (cache) return cache;
  cache = UNITS.map((u) => ({ ...u, lessons: LESSONS.filter((l) => l.unit === u.id).map((l) => lessonMeta(l.id) as LessonMeta) }));
  return cache;
}

/** Alle Lektionen in Kursreihenfolge. */
export const lessonOrder = (): readonly string[] => LESSONS.map((l) => l.id);

export const lessonIndex = (id: string): number => LESSONS.findIndex((l) => l.id === id);
