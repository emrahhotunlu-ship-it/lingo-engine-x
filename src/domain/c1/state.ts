import { patternsOf } from '../grammar/patterns';
import { currentChapter, type PatInfo } from '../grammar/slotPlan';
import { patternState, patternStateNo, patsOf, type PatEntry } from '../metrics/pattern';
import { programChapters, topicExists } from './chapters';

// Kapitelstand des C1-Programms (Lernplattform 3.0 §4.1/P31). REIN ABGELEITET aus `grammar/<thema>.pats`: gespeichert wird er nie
// (Datenregeln: eine Quelle je Zahl). „Muster sicher n/m“ rechnet dieselbe Zustandsfunktion wie der Lernpfad (`features/grammar/chapters.ts`),
// deshalb zeigen Programmkarte und Lernpfad dieselben Zahlen.

type Doc = Readonly<Record<string, unknown>>;

export type ChapterStatus = 'open' | 'current' | 'done';

export type TopicProgress = {
  id: string;
  /** Gibt es das Thema schon (Inhalte)? Neue Themen sind bis P36/P37 Platzhalter. */
  exists: boolean;
  patSafe: number;
  patTotal: number;
  /** Mindestens ein Muster ist eingeführt oder geübt. */
  introduced: boolean;
};

export type ChapterProgress = {
  id: string;
  n: number;
  status: ChapterStatus;
  /** Es gibt schon Muster. `false` = „in Vorbereitung“. */
  ready: boolean;
  topics: TopicProgress[];
  /** Muster mit Zustand Sicher oder Fest / alle Muster der vorhandenen Themen. */
  patSafe: number;
  patTotal: number;
  /** Eingeführte / vorhandene Themen. */
  introduced: number;
  liveTopics: number;
  /** Alle vorhandenen Themen sind eingeführt (dann darf das nächste Kapitel beginnen). */
  allIntroduced: boolean;
  /** Jedes Muster ist Sicher oder Fest. */
  allSafe: boolean;
};

export type ChapterStateResult = {
  chapters: ChapterProgress[];
  /** Index (0-basiert) des aktuellen Kapitels, `-1` ohne Programm. */
  current: number;
};

const isIntroduced = (e: PatEntry | undefined): boolean => !!e && (e.i !== undefined || (e.n ?? 0) > 0);

/** Kapitelstand aus den Grammatik-Dokumenten (`grammar/<thema>`, nach Thema). Rein, ohne Uhr: `today` kommt vom Aufrufer. */
export function chapterState(i: { docs: ReadonlyMap<string, Doc>; today: string }): ChapterStateResult {
  const program = programChapters();
  const infos: PatInfo[] = [];
  const chapters = program.map((ch, idx): ChapterProgress => {
    const topics = ch.topics.map((id): TopicProgress => {
      const exists = topicExists(id);
      const ids = exists ? (patternsOf(id)?.patterns.map((p) => p.id) ?? []) : [];
      const entries = patsOf(i.docs.get(id));
      for (const p of ids) infos.push({ id: p, chapter: idx, entry: entries[p] });
      const patSafe = ids.filter((p) => patternStateNo(patternState(entries[p], i.today)) >= 2).length;
      const introducedPats = ids.some((p) => isIntroduced(entries[p]));
      const n = i.docs.get(id)?.n;
      return { id, exists, patSafe, patTotal: ids.length, introduced: introducedPats || (ids.length === 0 && typeof n === 'number' && n > 0) };
    });
    const live = topics.filter((t) => t.exists);
    const patSafe = live.reduce((s, t) => s + t.patSafe, 0);
    const patTotal = live.reduce((s, t) => s + t.patTotal, 0);
    const introduced = live.filter((t) => t.introduced).length;
    return {
      id: ch.id,
      n: ch.n,
      status: 'open',
      ready: patTotal > 0,
      topics,
      patSafe,
      patTotal,
      introduced,
      liveTopics: live.length,
      allIntroduced: live.length > 0 && introduced === live.length,
      allSafe: patTotal > 0 && patSafe === patTotal,
    };
  });
  if (!chapters.length) return { chapters, current: -1 };
  const current = Math.min(chapters.length - 1, Math.max(0, currentChapter(infos, i.today)));
  for (const [idx, c] of chapters.entries()) c.status = c.allSafe ? 'done' : idx === current ? 'current' : 'open';
  return { chapters, current };
}
