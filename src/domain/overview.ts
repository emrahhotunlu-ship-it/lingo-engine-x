import { LESSONS, SEED_VOCAB, TOPICS, UNITS, seedCard, type Lesson } from './content';
import { dayKey, learningDayEnd } from './date';
import { isDue } from './metrics/definitions';
import { streakWeek } from './metrics/streak';
import { isNewState, readFsrs } from './srs/scheduler';
import type { Streak } from './streak';
import type { WeekDay } from './streak';

// „Dein Stand": reine Berechnung aus den gelesenen Dokumenten (keine Seiteneffekte).

type Doc = Record<string, unknown>;

/** `name` deutsch, `nameEn` englisch – angezeigt wird je nach Oberflächensprache. */
export type TopicState = { id: string; name: string; nameEn: string; p: number; n: number };

export type Overview = {
  today: string;
  streak: Streak;
  /** Wochenstreifen Mo–So (M7), dieselbe Regel wie die Serie. */
  week: WeekDay[];
  course: { done: number; total: number; next: Lesson | null; units: Array<{ id: string; de: string; en: string; done: number; total: number }> };
  /** `total` = aktive Karten; `hidden` = ausgeblendete (in der alten App „gelöscht", aber erhalten). */
  vocab: { total: number; hidden: number; byStage: [number, number, number, number, number, number]; due: number };
  grammar: { topics: TopicState[]; weakest: TopicState[] };
  /** `lang` = Sprache, in der die Texte gespeichert sind (fehlt = Deutsch, wie in der alten App). */
  assess: { level: string; cefr: string; why: string; lang: 'de' | 'en' } | null;
  schema: { version: number; migratedAt: number } | null;
};

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const obj = (v: unknown): Doc => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Doc) : {});

export { learningDayEnd };

/** Alle Vokabelkarten: Voreinstellungen, überlagert von den Dokumenten der Datenbank. */
export function mergedVocab(dbVocab: ReadonlyMap<string, Doc>, invalidIds?: ReadonlySet<string>): Map<string, Doc> {
  const out = new Map<string, Doc>();
  SEED_VOCAB.forEach((s, i) => {
    const c = seedCard(s, i);
    // Ein vorhandenes, aber ungültiges Dokument verdeckt die Voreinstellung (Regel 6): nie als neue Karte zeigen.
    if (invalidIds?.has(c.id)) return;
    out.set(c.id, c);
  });
  for (const [id, d] of dbVocab) out.set(id, d);
  return out;
}

export function buildOverview(input: {
  nowMs: number;
  profile: Doc | null | undefined;
  course: Doc | null | undefined;
  assess: Doc | null | undefined;
  schema: Doc | null | undefined;
  vocab: ReadonlyMap<string, Doc>;
  grammar: ReadonlyMap<string, Doc>;
  /** Phase 7 (Plan §12.3): ausgelagerte Profiljahre; Serie liest Profil und Archiv zusammen. */
  archives?: Iterable<Doc>;
}): Overview {
  const today = dayKey(input.nowMs);
  const schemaDoc = input.schema ? obj(input.schema) : null;
  // Serie und Wochenstreifen: eine Rechnung (`domain/metrics/streak`), dieselbe wie Heute und Profil-Knopf.
  const { streak, week } = streakWeek({ nowMs: input.nowMs, profile: input.profile, schema: input.schema, archives: input.archives, today });

  const doneMap = obj(obj(input.course).done);
  const doneIds = new Set(LESSONS.filter((l) => l.id in doneMap).map((l) => l.id));
  const next = LESSONS.find((l) => !doneIds.has(l.id)) ?? null;
  const units = UNITS.map((u) => {
    const ls = LESSONS.filter((l) => l.unit === u.id);
    return { id: u.id, de: u.de, en: u.en, done: ls.filter((l) => doneIds.has(l.id)).length, total: ls.length };
  });

  const byStage: Overview['vocab']['byStage'] = [0, 0, 0, 0, 0, 0];
  let total = 0;
  let hidden = 0;
  let due = 0;
  for (const card of mergedVocab(input.vocab).values()) {
    if (card.hidden === true) {
      hidden++;
      continue;
    }
    total++;
    const stage = Math.min(5, Math.max(0, Math.round(num(card.stage))));
    byStage[stage as 0 | 1 | 2 | 3 | 4 | 5]++;
    const fsrs = readFsrs(card, input.nowMs);
    if (isDue({ hidden: false, isNew: isNewState(fsrs), fsrs }, input.nowMs)) due++;
  }

  const topics = TOPICS.map((t) => {
    const d = input.grammar.get(t.id);
    return { id: t.id, name: t.name, nameEn: t.name_en ?? t.name, p: Math.min(1, Math.max(0, num(d?.p, t.p0))), n: num(d?.n) };
  });
  const weakest = [...topics].sort((a, b) => a.p - b.p || b.n - a.n).slice(0, 3);

  let assess: Overview['assess'] = null;
  if (input.assess) {
    const a = obj(input.assess);
    const data = a.data && typeof a.data === 'object' ? obj(a.data) : a;
    const level = str(data.level);
    const cefr = str(data.cefr);
    if (level || cefr) assess = { level, cefr, why: str(data.levelWhy), lang: str(a.lang) === 'en' ? 'en' : 'de' };
  }

  const schema = schemaDoc ? { version: num(schemaDoc.version), migratedAt: num(schemaDoc.migratedAt) } : null;

  return {
    today,
    streak,
    week,
    course: { done: doneIds.size, total: LESSONS.length, next, units },
    vocab: { total, hidden, byStage, due },
    grammar: { topics, weakest },
    assess,
    schema,
  };
}
