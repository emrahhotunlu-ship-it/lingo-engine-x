import { estimate, information, type PlaceItem } from './model';

// Einstufung, Auswahl der nächsten Aufgabe (P33): die Aufgabe mit der größten Information bei θ, mit Inhaltsausgleich:
// höchstens 1 Aufgabe je Thema, Kapitel reihum (zuerst die Kapitel mit den wenigsten gestellten Aufgaben). Die ersten Aufgaben sind Auswahlaufgaben
// (schnelle Annäherung), danach gap, kwt und find. Rein und ohne Zufall: gleiche Eingabe, gleiche Aufgabe (Ties nach Kennung).

/** Die ersten so vielen Aufgaben sind Auswahl, wenn der Vorrat genug davon hat. */
export const FIRST_MC = 4;

export type AskedItem = { id: string; ok: 0 | 1 };

/** Nur Aufgaben des Einstufungsvorrats (`pool` fehlt oder ist `place`). */
export const placePool = (items: readonly PlaceItem[]): PlaceItem[] => items.filter((i) => i.pool === undefined || i.pool === 'place');

export function pickNext(post: readonly number[], pool: readonly PlaceItem[], asked: readonly AskedItem[]): PlaceItem | null {
  const done = new Set(asked.map((a) => a.id));
  const byId = new Map(pool.map((i) => [i.id, i]));
  const usedTopics = new Set(asked.map((a) => byId.get(a.id)?.topic).filter((x): x is string => !!x));
  let open = pool.filter((i) => !done.has(i.id) && !usedTopics.has(i.topic));
  if (!open.length) return null;

  // Anfang: Auswahlaufgaben, solange es welche gibt.
  if (asked.length < FIRST_MC) {
    const mc = open.filter((i) => i.fmt === 'mc');
    if (mc.length) open = mc;
  }

  // Kapitel reihum: nur Kapitel mit den wenigsten bisher gestellten Aufgaben (unter denen, die noch etwas anbieten).
  const perChapter = new Map<number, number>();
  for (const a of asked) {
    const ch = byId.get(a.id)?.chapter;
    if (ch !== undefined) perChapter.set(ch, (perChapter.get(ch) ?? 0) + 1);
  }
  const least = Math.min(...open.map((i) => perChapter.get(i.chapter) ?? 0));
  open = open.filter((i) => (perChapter.get(i.chapter) ?? 0) === least);

  const { theta } = estimate(post);
  let best: PlaceItem | null = null;
  let bestInfo = -1;
  for (const i of open) {
    const info = information(theta, i);
    if (info > bestInfo + 1e-12 || (Math.abs(info - bestInfo) <= 1e-12 && best && i.id < best.id)) {
      best = i;
      bestInfo = info;
    }
  }
  return best;
}
