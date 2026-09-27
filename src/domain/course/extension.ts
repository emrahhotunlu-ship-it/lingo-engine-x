import type { Unit } from '../content';
import type { LessonMeta } from '../learn/types';
import { asText } from '../text/str';

// Kurs-Erweiterung (Kap. 6.2): Lektionen ab l25, von Claude geplant (course-extend) und dauerhaft
// in `lesson/<lid>` gespeichert. Der Lehrplan (Titel, Can-Do, Situation, Thema, Zielwörter)
// steht im zusätzlichen Feld `plan` desselben Dokuments; den Lektionsinhalt (Dialog, Aufgaben)
// ergänzt später „Lektion vorbereiten“ wie bei l01–l24 in denselben Dokument (nur leere Felder).
// Abschlüsse laufen unverändert über `app/course.done`. Geschrieben wird nur neu angelegt
// (`createIfMissing`), nie über eine bestehende Lektion.

type Doc = Record<string, unknown>;

/** Erste Nummer der erweiterten Lektionen (l01–l24 sind der Lehrplan der alten App). */
export const EXT_FIRST = 25;
/** Erste Nummer der erweiterten Einheiten (u1–u6 sind der Lehrplan). */
export const EXT_UNIT_FIRST = 7;

export type ExtUnit = Unit;
export type ExtLesson = LessonMeta & { n: number };
export type ExtCatalog = { units: ExtUnit[]; lessons: ExtLesson[] };

export const EMPTY_EXT: ExtCatalog = { units: [], lessons: [] };

const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const str = (v: unknown): string => asText(v).trim();

/** Nummer einer Lektions-ID (`l25` → 25), sonst 0. */
export function lessonNo(id: string): number {
  const m = /^l(\d{2,4})$/.exec(id);
  return m ? Number(m[1]) : 0;
}

export const extLessonId = (n: number): string => `l${String(n).padStart(2, '0')}`;
export const isExtLessonId = (id: string): boolean => lessonNo(id) >= EXT_FIRST;

/** Lehrplan-Eintrag aus `lesson/<lid>.plan` lesen; `null` = keine (gültige) erweiterte Lektion. */
export function readExtLesson(id: string, doc: Readonly<Doc> | null | undefined): { lesson: ExtLesson; unit: ExtUnit } | null {
  const n = lessonNo(id);
  if (n < EXT_FIRST || !doc) return null;
  const p = obj(doc.plan);
  const u = obj(p.unit);
  const unitId = str(u.id);
  const unitN = typeof u.n === 'number' && Number.isFinite(u.n) ? u.n : 0;
  const words = (Array.isArray(p.words) ? p.words : [])
    .map((w) => (Array.isArray(w) ? [str(w[0]), str(w[1])] : [str(obj(w).en), str(obj(w).de)]))
    .filter(([en, de]) => !!en && !!de) as Array<[string, string]>;
  const en = str(p.en);
  const grammar = str(p.grammar);
  if (!/^u\d+$/.test(unitId) || unitN < EXT_UNIT_FIRST || !en || !grammar || !words.length) return null;
  const kind = u.kind === 'life' ? 'life' : 'job';
  const unit: ExtUnit = { id: unitId, n: unitN, de: str(u.de) || str(u.en), en: str(u.en) || str(u.de), kind, goal_de: str(u.goal_de) || str(u.goal_en), goal_en: str(u.goal_en) || str(u.goal_de) };
  const lesson: ExtLesson = {
    n,
    id,
    unit: unitId,
    kind,
    grammar,
    level: str(p.level) || 'B2+',
    de: str(p.de) || en,
    en,
    cando_de: str(p.cando_de) || str(p.cando_en),
    cando_en: str(p.cando_en) || str(p.cando_de),
    situation: str(p.situation),
    words,
  };
  return { lesson, unit };
}

/** Alle erweiterten Lektionen aus den gelesenen `lesson/*`, nach Nummer; Einheiten in Reihenfolge. */
export function extCatalogOf(docs: ReadonlyMap<string, Readonly<Doc>>): ExtCatalog {
  const lessons: ExtLesson[] = [];
  const units = new Map<string, ExtUnit>();
  for (const [id, doc] of docs) {
    const r = readExtLesson(id, doc);
    if (!r) continue;
    lessons.push(r.lesson);
    if (!units.has(r.unit.id)) units.set(r.unit.id, r.unit);
  }
  if (!lessons.length) return EMPTY_EXT;
  lessons.sort((a, b) => a.n - b.n);
  return { lessons, units: [...units.values()].sort((a, b) => a.n - b.n) };
}

/** Nächste freie Nummern: nach der höchsten vorhandenen Lektion (auch ungültigen), nie unter l25. */
export function nextExtIds(existingIds: Iterable<string>, count: number): string[] {
  let max = EXT_FIRST - 1;
  for (const id of existingIds) max = Math.max(max, lessonNo(id));
  return Array.from({ length: count }, (_, i) => extLessonId(max + 1 + i));
}

/** Nächste Einheitennummer nach den vorhandenen erweiterten Einheiten. */
export function nextUnitN(ext: ExtCatalog): number {
  return ext.units.reduce((m, u) => Math.max(m, u.n + 1), EXT_UNIT_FIRST);
}

export type ExtPlanInput = {
  unit: { en: string; de: string; goal_en: string; goal_de: string; kind: 'job' | 'life' };
  lessons: ReadonlyArray<{ en: string; de: string; cando_en: string; cando_de: string; situation: string; grammar: string; level: string; words: ReadonlyArray<readonly [string, string]> }>;
};

/** Speicherform je neuer Lektion: `lesson/<lid>` mit `plan` (Lehrplan) und Herkunft, ohne Inhalt. */
export function extLessonDocs(out: ExtPlanInput, i: { ids: readonly string[]; unitN: number; nowMs: number; pv: string; lang: 'de' | 'en' }): Array<{ id: string; doc: Doc }> {
  const unit = { id: `u${i.unitN}`, n: i.unitN, ...out.unit };
  return out.lessons.slice(0, i.ids.length).map((l, k) => ({
    id: i.ids[k] as string,
    doc: {
      v: 1,
      t: i.nowMs,
      plan: { pv: i.pv, unit, en: l.en, de: l.de, cando_en: l.cando_en, cando_de: l.cando_de, situation: l.situation, grammar: l.grammar, level: l.level, words: l.words.map(([en, de]) => [en, de]) },
      lx: { pv: i.pv, lang: i.lang, ext: true },
    },
  }));
}

/**
 * Darf „Kurs erweitern“ angeboten werden? Nur wenn keine erweiterte Lektion offen ist (sonst
 * stapeln sich ungenutzte Einheiten). `allDone` = alle Lektionen erledigt → deutlich anbieten.
 */
export function extensionState(i: { doneIds: ReadonlySet<string>; baseIds: readonly string[]; ext: ExtCatalog }): { allowed: boolean; allDone: boolean } {
  const extOpen = i.ext.lessons.some((l) => !i.doneIds.has(l.id));
  const baseDone = i.baseIds.every((id) => i.doneIds.has(id));
  return { allowed: !extOpen, allDone: baseDone && !extOpen };
}
