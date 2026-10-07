import { addDays, daysBetween } from '../../date';
import { C1_LIMITS, patchC1, type C1Doc, type C1Place, type PatchResult } from '../c1doc';
import { bandOf, difficulty, estimate, prior, reliabilityOf, update, type PlaceBand, type PlaceItem, type Reliability } from './model';
import { pickNext, type AskedItem } from './select';

// Einstufung, Ablauf (Lernplattform 3.0 §4.2, P33): Teil 2 „Grammatik adaptiv“ als reine Zustandsmaschine. Keine Uhr (die Zeit kommt als Parameter),
// kein Zufall, keine Datenbank: Abbrechen bedeutet, den Zustand wegzuwerfen, dann ist nichts geschrieben. Geschrieben wird erst am Ende mit
// `savePlacement`, und nur das Dokument `app/c1` (Feld `place`), nie `grammar/<id>`. Ausgabe: der Kurzweg (Themen, die du wahrscheinlich schon kannst)
// und `{θ, se, n}`. Die Einstufung zeigt kein Niveau als Urteil; θ und se stehen nur unter „Messwerte dahinter“.

export const LIMITS = {
  /** Frühestens so viele Aufgaben, bevor der Standardfehler das Ende bestimmen darf. */
  minN: 14,
  /** Standardfehler, ab dem die Einstufung belastbar genug ist. */
  seStop: 0.4,
  /** Höchstens so viele Aufgaben. */
  maxN: 22,
  /** Höchstens so lange (ms). */
  maxMs: 8 * 60_000,
} as const;

/**
 * Kurzweg: nur bei genug Antworten und brauchbarem Standardfehler; ein Thema zählt als bekannt, wenn θ − se mindestens `margin` über seiner Schwierigkeit
 * liegt. Der Kurzweg kürzt nur den Einstieg ins Thema (ein Kurztest statt der Einführung), er überspringt nichts: die Grenze darf deshalb knapp liegen.
 */
export const SKIP = { minN: 10, maxSe: 0.6, margin: 0.1 } as const;

/** Neu einstufen frühestens nach so vielen Tagen (3 Monate). */
export const RETAKE_DAYS = 91;

export type RunState = {
  readonly pool: readonly PlaceItem[];
  readonly post: readonly number[];
  readonly asked: readonly AskedItem[];
  /** Beginn (ms). */
  readonly startedAt: number;
};

export type EndReason = 'enough' | 'max' | 'time' | 'empty';

export function startRun(pool: readonly PlaceItem[], startedAt: number): RunState {
  return { pool, post: prior(), asked: [], startedAt };
}

/** Ist die Einstufung zu Ende (und warum)? `null`, wenn weitere Aufgaben kommen. */
export function endReason(s: RunState, nowMs: number): EndReason | null {
  const n = s.asked.length;
  if (n >= LIMITS.maxN) return 'max';
  if (nowMs - s.startedAt >= LIMITS.maxMs) return 'time';
  if (n >= LIMITS.minN && estimate(s.post).se <= LIMITS.seStop) return 'enough';
  if (!pickNext(s.post, s.pool, s.asked)) return 'empty';
  return null;
}

/** Nächste Aufgabe, oder `null` am Ende. */
export function nextItem(s: RunState, nowMs: number): PlaceItem | null {
  return endReason(s, nowMs) ? null : pickNext(s.post, s.pool, s.asked);
}

/** Antwort verbuchen. Eine unbekannte oder schon beantwortete Aufgabe ändert nichts (keine doppelte Wertung). */
export function answerItem(s: RunState, id: string, ok: boolean): RunState {
  const it = s.pool.find((i) => i.id === id);
  if (!it || s.asked.some((a) => a.id === id)) return s;
  return { ...s, post: update(s.post, it, ok), asked: [...s.asked, { id, ok: ok ? 1 : 0 }] };
}

/** Mittlere Schwierigkeit eines Themas im Vorrat. */
export function topicDifficulty(pool: readonly PlaceItem[], topic: string): number {
  const bs = pool.filter((i) => i.topic === topic).map(difficulty);
  return bs.length ? bs.reduce((s, b) => s + b, 0) / bs.length : Number.POSITIVE_INFINITY;
}

export type PlaceResult = {
  theta: number;
  se: number;
  n: number;
  band: PlaceBand;
  reliability: Reliability;
  /** Themen mit Kurzweg (beim ersten Besuch genügt ein Kurztest). */
  skip: string[];
  /** Beantwortete Aufgaben (Kennung, richtig). */
  it: Array<[string, 0 | 1]>;
};

/** Ergebnis aus dem aktuellen Stand. */
export function placementResult(s: RunState): PlaceResult {
  const { theta, se } = estimate(s.post);
  const n = s.asked.length;
  const wrong = new Set(s.asked.filter((a) => a.ok === 0).map((a) => s.pool.find((i) => i.id === a.id)?.topic));
  const topics = [...new Set(s.pool.map((i) => i.topic))];
  const skip =
    n >= SKIP.minN && se <= SKIP.maxSe
      ? topics.filter((t) => !wrong.has(t) && theta - se >= topicDifficulty(s.pool, t) + SKIP.margin).sort()
      : [];
  return { theta, se, n, band: bandOf(theta), reliability: reliabilityOf(se), skip, it: s.asked.map((a): [string, 0 | 1] => [a.id, a.ok]) };
}

/** Darf neu eingestuft werden? Frühestens nach 3 Monaten; ohne frühere Einstufung immer. */
export const canRetake = (place: Pick<C1Place, 'd'> | undefined | null, today: string): boolean => !place || daysBetween(place.d, today) >= RETAKE_DAYS;

/** Der Eintrag für `app/c1.place` (≤ 2 KB; die Aufgabenliste wird auf den Höchstwert gekappt). */
export function placeEntry(r: PlaceResult, today: string): C1Place {
  const round2 = (x: number): number => Math.round(x * 100) / 100;
  return { d: today, se: round2(r.se), n: r.n, th: round2(r.theta), skip: [...r.skip], it: r.it.slice(0, C1_LIMITS.placeIt) };
}

/** Reine Änderung am Dokument: setzt `place` (das neue Ergebnis ersetzt das alte; alles andere bleibt unberührt). */
export function withPlacement(doc: C1Doc, entry: C1Place): C1Doc {
  return { ...doc, place: entry };
}

/** Ergebnis speichern (Lesen, Rechnen, Schreiben in einem Schritt). Wird nur am Ende aufgerufen; Abbrechen ruft es nie auf. */
export function savePlacement(r: PlaceResult, today: string): Promise<PatchResult> {
  return patchC1((doc) => withPlacement(doc, placeEntry(r, today)));
}

/** Frühester Tag für eine neue Einstufung (zur Anzeige „ab 14. Januar“). */
export const retakeFrom = (place: Pick<C1Place, 'd'>): string => addDays(place.d, RETAKE_DAYS);
