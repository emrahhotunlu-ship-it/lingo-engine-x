import { TOPICS } from '../content';
import { legacyTaskKey } from '../grammar/key';
import { allSeedTasks } from '../grammar/tasks';
import { auxFormEvent } from '../text/auxForm';

// Fehler-Radar quer gelesen (Auswertung 15.10.2026, Punkt 5). Rein, nur lesend.
//  - `radarOpenTopics`: Themen mit Radar-Fehlern in den letzten Tagen. Der Wochenbericht nennt ein Muster dieses Themas nicht „sicher“, solange
//    das Radar noch Fehler dazu zeigt (Woche 41: „Futur II sicher“, obwohl die Fehler bis zum 11.10. weiterliefen).
//  - `auxFormRow`: der Fehlertyp „Verbform nach Hilfsverb“ (will worked, wouldn't missed, had sign, has been felt, Having wrote, catched) über alle Themen
//    hinweg als EIN Übungsziel. Er steht im Radar unter fünf Themen, ist aber eine einzige Regel.

const DAY = 86_400_000;
const TOPIC_IDS: ReadonlySet<string> = new Set(TOPICS.map((t) => t.id));

type Ev = { c: string; s: string; t: number; g: string; a: string; q: string };
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function radarEventsOf(events: unknown): Ev[] {
  return (Array.isArray(events) ? events : [])
    .map((e) => (e && typeof e === 'object' ? (e as Record<string, unknown>) : {}))
    .map((e) => ({ c: str(e.c), s: str(e.s), t: num(e.t), g: str(e.g), a: str(e.a), q: str(e.q) }))
    .filter((e) => e.c && e.t > 0);
}

let keyTopic: Map<string, string> | null = null;
/** Thema einer Aufgabe über den Aufgaben-Schlüssel (Prompt-Text), wie ihn das Radar im Feld `q` trägt. */
function topicByTask(q: string): string | null {
  if (!q.trim()) return null;
  keyTopic ??= new Map(allSeedTasks().map((t) => [t.key, t.topic] as const));
  return keyTopic.get(legacyTaskKey(q)) ?? null;
}

/** Thema eines Radar-Ereignisses: die Kennung selbst (ältere Einträge), sonst über die Aufgabe; sonst `null` (Kategorien wie „tense“ sind zu grob). */
export function topicOfEvent(e: Pick<Ev, 'c' | 'q'>): string | null {
  if (TOPIC_IDS.has(e.c)) return e.c;
  return topicByTask(e.q);
}

/** Themen mit mindestens einem Radar-Fehler in den letzten `days` Tagen. */
export function radarOpenTopics(events: unknown, nowMs: number, days = 7): Set<string> {
  const out = new Set<string>();
  for (const e of radarEventsOf(events)) {
    const age = nowMs - e.t;
    if (age < 0 || age >= days * DAY) continue;
    const topic = topicOfEvent(e);
    if (topic) out.add(topic);
  }
  return out;
}

/** Erkennungs-Kategorie der virtuellen Zeile (kein Eintrag in `CAT_IDS`, nur im Radar-Reiter und im Wochenbericht). */
export const AUX_ROW = 'auxform';

/** Die Radar-Ereignisse, die zu „Verbform nach Hilfsverb“ gehören (falsch gegebene Antwort `g` mit der richtigen Lösung `a` als Gegenprobe). */
export function auxFormEvents(events: unknown): Ev[] {
  return radarEventsOf(events).filter((e) => !!auxFormEvent(e.g, e.a));
}
