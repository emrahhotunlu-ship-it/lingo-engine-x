import { validateDoc } from '../../data/validate';
import { compactList, monthOf, upsertById } from '../monthDoc';

// „Mein nächster Termin“ (Lernberatung 27.09., V4 / Vorschlag 6) als Monatsdokument
// `meeting/<JJJJ-MM>` (A6.6: wachsende Ströme zusammenfassen; Monat = Lerntag der Eingabe).
// Nur echte, von Emrah eingegebene Termine – nie Beispiele. Ein Eintrag je Termin, idempotent
// über `id`: Vorbereitung, Kennung der Generalprobe und die Nachbesprechungen werden am selben
// Eintrag nachgetragen. Verdichtung bis ≤ 200 KiB beim jeweils ältesten Eintrag: zuerst die Szene
// der Generalprobe (sie liegt ohnehin unter `scene/<id>`), dann die Einwände, dann die ganze
// Vorbereitung. Nachbesprechungen bleiben (ihre Wendungen stehen zusätzlich unter `chunk/*`).

type Doc = Record<string, unknown>;

export const MEETING_DOC_MAX_BYTES = 200 * 1024;
export const MEETING_FIELD_MAX = { who: 120, topic: 300, tricky: 300, notes: 800 } as const;
export const MEETING_WANT_MAX = 600;
/** Höchstens so viele Nachbesprechungs-Einträge je Termin. */
export const MEETING_DEBRIEF_MAX = 24;

export type MeetingInput = { who: string; topic: string; tricky: string; notes: string; when: string };

export type PrepPhrase = { en: string; de: string; def: string; example: string };
export type PrepObjection = { q: string; why: string; answers: string[] };
export type PrepScene = Record<string, unknown>;
export type MeetingPrep = { phrases: PrepPhrase[]; objections: PrepObjection[]; scene: PrepScene | null };

export type DebriefEntry = { t: number; want: string; en: string; phrase: string; de: string; def: string; why: string };

export type MeetingItem = MeetingInput & {
  id: string;
  t: number;
  /** Lerntag der Eingabe (bestimmt den Monat). */
  day: string;
  prep: MeetingPrep | null;
  /** Kennung der Generalprobe-Szene (`scene/<id>`), sobald sie einmal angelegt ist. */
  sceneId: string | null;
  debrief: DebriefEntry[];
  lang: 'de' | 'en';
};

const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

const STEPS: ReadonlyArray<(i: Doc) => Doc | null> = [
  (i) => (obj(i.prep).scene ? { ...i, prep: { ...obj(i.prep), scene: null } } : null),
  (i) => (Array.isArray(obj(i.prep).objections) && (obj(i.prep).objections as unknown[]).length ? { ...i, prep: { ...obj(i.prep), objections: [] } } : null),
  (i) => (i.prep ? { ...i, prep: null } : null),
  // Vor dem Entfernen ganzer Termine: Nachbesprechungen bis auf die jüngste kürzen.
  (i) => (Array.isArray(i.debrief) && i.debrief.length > 1 ? { ...i, debrief: (i.debrief as unknown[]).slice(-1) } : null),
];

export function compactMeetings(items: readonly unknown[], month = '0000-00'): unknown[] {
  return compactList(items, STEPS, MEETING_DOC_MAX_BYTES, (list) => ({ v: 1, month, items: list }));
}

/** Eingaben säubern und kappen (nie leer: `who` und `topic` sind Pflicht). */
export function cleanMeetingInput(i: MeetingInput): MeetingInput | null {
  const cut = (s: string, n: number) => Array.from(s.replace(/\r\n?/g, '\n').trim()).slice(0, n).join('');
  const who = cut(i.who, MEETING_FIELD_MAX.who);
  const topic = cut(i.topic, MEETING_FIELD_MAX.topic);
  if (!who || !topic) return null;
  const when = /^\d{4}-\d{2}-\d{2}$/.test(i.when.trim()) ? i.when.trim() : '';
  return { who, topic, tricky: cut(i.tricky, MEETING_FIELD_MAX.tricky), notes: cut(i.notes, MEETING_FIELD_MAX.notes), when };
}

/** Schreibvorgang: Eintrag anlegen oder ersetzen (writer.transform auf `meeting/<Monat>`). */
export function upsertMeetingItem(cur: Doc | undefined, item: MeetingItem): { set: Doc } | { update: Doc } | null {
  const month = monthOf(item.day);
  if (!cur) return { set: { v: 1, month, items: compactMeetings([item], month) } };
  if (!validateDoc(meetingPath(item.day), cur).ok) return null;
  if (cur.items != null && !Array.isArray(cur.items)) return null;
  const list = Array.isArray(cur.items) ? cur.items : [];
  return { update: { items: compactMeetings(upsertById(list, item), month) } };
}

/**
 * Schreibvorgang: am vorhandenen Eintrag `id` etwas nachtragen (aus dem frischen Stand).
 * Fehlt der Eintrag oder hat das Dokument einen unerwarteten Aufbau, wird nichts geschrieben.
 */
export function patchMeetingItem(cur: Doc | undefined, id: string, patch: (item: Doc) => Doc | null): { update: Doc } | null {
  if (!cur || !Array.isArray(cur.items)) return null;
  if (!validateDoc(`meeting/${typeof cur.month === 'string' ? cur.month : '0000-00'}`, cur).ok) return null;
  const list = cur.items as unknown[];
  const at = list.findIndex((x) => obj(x).id === id);
  if (at < 0) return null;
  const next = patch({ ...obj(list[at]) });
  if (!next) return null;
  const month = typeof cur.month === 'string' ? cur.month : '0000-00';
  return { update: { items: compactMeetings(list.map((x, k) => (k === at ? next : x)), month) } };
}

/** Nachbesprechung anhängen (älteste fallen über die Obergrenze weg). */
export function withDebrief(item: Doc, entries: readonly DebriefEntry[]): Doc | null {
  if (!entries.length) return null;
  const prev = Array.isArray(item.debrief) ? (item.debrief as unknown[]) : [];
  return { ...item, debrief: [...prev, ...entries].slice(-MEETING_DEBRIEF_MAX) };
}

/** Kennung eines Termins (Beginn, Basis 36). */
export const meetingId = (t: number): string => `mt-${Math.max(0, Math.floor(t)).toString(36)}`;

/** Pfad des Monatsdokuments. */
export const meetingPath = (day: string): string => `meeting/${monthOf(day)}`;

/** Alle Termine aus den Monatsdokumenten, neueste zuerst (tolerant gelesen). */
export function listMeetings(docs: ReadonlyMap<string, Doc> | undefined): Array<Doc & { id: string; t: number; day: string }> {
  const out: Array<Doc & { id: string; t: number; day: string }> = [];
  for (const d of docs?.values() ?? []) {
    if (!Array.isArray(d.items)) continue;
    for (const x of d.items as unknown[]) {
      const i = obj(x);
      if (typeof i.id !== 'string' || typeof i.day !== 'string') continue;
      out.push({ ...i, id: i.id, day: i.day, t: typeof i.t === 'number' ? i.t : 0 });
    }
  }
  return out.sort((a, b) => b.t - a.t);
}

const s = (v: unknown): string => (typeof v === 'string' ? v : '');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Eintrag tolerant als Termin lesen (fehlende Felder leer); ohne `id`/`day`/`who`/`topic` → null. */
export function readMeeting(raw: unknown): MeetingItem | null {
  const d = obj(raw);
  const id = s(d.id);
  const day = s(d.day);
  if (!id || !day || !s(d.who) || !s(d.topic)) return null;
  const p = d.prep ? obj(d.prep) : null;
  const prep: MeetingPrep | null = p
    ? {
        phrases: arr(p.phrases)
          .map(obj)
          .map((x) => ({ en: s(x.en), de: s(x.de), def: s(x.def), example: s(x.example) }))
          .filter((x) => x.en && x.example),
        objections: arr(p.objections)
          .map(obj)
          .map((x) => ({ q: s(x.q), why: s(x.why), answers: arr(x.answers).map(s).filter(Boolean) }))
          .filter((x) => x.q),
        scene: p.scene && typeof p.scene === 'object' ? obj(p.scene) : null,
      }
    : null;
  const debrief: DebriefEntry[] = arr(d.debrief)
    .map(obj)
    .map((x) => ({ t: typeof x.t === 'number' ? x.t : 0, want: s(x.want), en: s(x.en), phrase: s(x.phrase), de: s(x.de), def: s(x.def), why: s(x.why) }))
    .filter((x) => x.en);
  return {
    id,
    day,
    t: typeof d.t === 'number' ? d.t : 0,
    who: s(d.who),
    topic: s(d.topic),
    tricky: s(d.tricky),
    notes: s(d.notes),
    when: s(d.when),
    prep,
    sceneId: s(d.sceneId) || null,
    debrief,
    lang: d.lang === 'en' ? 'en' : 'de',
  };
}
