import { isDayKey, legacyDayKey } from '../date';
import type { IntakeBatch } from '../grammar/pool';
import { normalizeTask } from '../grammar/tasks';
import type { GrammarTask } from '../learn/types';
import { hash32 } from '../random';
import { newVocabDoc } from '../srs/newCard';
import { asText } from '../text/str';

// Tagesaufträge `daily/*` (phase2-plan §4.10, W8): ALLE liegengebliebenen Tage werden
// verarbeitet, vom ältesten an – nicht nur heute. Rein: liefert, welche Tage offen sind,
// welche Karten anzulegen sind und was in den Pool soll. `daily/*` wird nie geschrieben.
//
// Offen ist ein Tag, der in `app/pool.lxDaily` fehlt, dessen Inhalt sich geändert hat
// (anderer Fingerabdruck) oder bei dem Aufgaben keinen Platz im Pool fanden (`open > 0`).

type Doc = Record<string, unknown>;

const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** JSON mit sortierten Schlüsseln (Reihenfolge der Datenbank egal). */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Doc;
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

/** Fingerabdruck eines Tagesauftrags (FNV-1a über den Inhalt). */
export const dailyHash = (doc: unknown): number => hash32(canonical(doc));

export type DailyDay = { day: string; ref: string; hash: number; items: unknown[]; words: Doc[] };

/** Offene Tage, ältester zuerst; nur echte Datumsschlüssel bis heute (Kalendertag der alten App). */
export function openDailyDays(i: { daily: ReadonlyMap<string, Readonly<Doc>>; lxDaily: unknown; nowMs: number }): DailyDay[] {
  const limit = legacyDayKey(i.nowMs);
  const marks = obj(i.lxDaily);
  const out: DailyDay[] = [];
  for (const [k, doc] of i.daily) {
    if (!isDayKey(k) || k > limit) continue;
    const hash = dailyHash(doc);
    const m = obj(marks[k]);
    const done = typeof m.h === 'number' && m.h === hash && !(typeof m.open === 'number' && m.open > 0);
    if (done) continue;
    out.push({ day: k, ref: `daily/${k}`, hash, items: arr(doc.grammarItems), words: arr(doc.newWords).map(obj) });
  }
  return out.sort((a, b) => (a.day < b.day ? -1 : 1));
}

/** Neue Karten aus `newWords` offener Tage; jede schon bekannte Kennung wird ausgelassen. */
export function dailyWordCards(days: readonly DailyDay[], known: ReadonlySet<string>, today: string, nowMs: number): Array<{ id: string; doc: Doc; ref: string }> {
  const out: Array<{ id: string; doc: Doc; ref: string }> = [];
  const ids = new Set(known);
  for (const d of days) {
    for (const w of d.words) {
      const made = newVocabDoc({
        word: asText(w.word),
        de: asText(w.de),
        pos: asText(w.pos) || null,
        def: asText(w.def) || null,
        level: asText(w.level) || null,
        ex: asText(w.ex) || null,
        src: 'coach',
        origin: { v: 1, kind: 'daily', ref: d.ref, t: nowMs },
        today,
      });
      if (!made || ids.has(made.id)) continue;
      ids.add(made.id);
      out.push({ ...made, ref: d.ref });
    }
  }
  return out;
}

/** Pool-Eingaben je offenem Tag. */
export function intakeBatches(days: readonly DailyDay[]): IntakeBatch[] {
  return days.map((d) => ({ day: d.day, src: 'daily', items: d.items, hash: d.hash, words: d.words.length }));
}

/**
 * Offene Aufgaben aller Tagesaufträge für die Runde, neueste Tage zuerst: gültig und im `seen`
 * ihres Themas noch nicht vorhanden. So kommt auch bei vollem Pool die Aufgabe des Tagesauftrags
 * dran – ohne etwas zu schreiben.
 */
export function dailyOpenTasks(daily: ReadonlyMap<string, Readonly<Doc>>, seen: ReadonlyMap<string, ReadonlySet<string>>, nowMs: number): GrammarTask[] {
  const limit = legacyDayKey(nowMs);
  const keys = [...daily.keys()].filter((k) => isDayKey(k) && k <= limit).sort().reverse();
  const out: GrammarTask[] = [];
  const have = new Set<string>();
  for (const k of keys) {
    for (const raw of arr(daily.get(k)?.grammarItems)) {
      const t = normalizeTask(raw, 'daily', `daily/${k}`);
      if (!t || have.has(t.key) || seen.get(t.topic)?.has(t.key)) continue;
      have.add(t.key);
      out.push(t);
    }
  }
  return out;
}

/** `seen` je Thema aus den `grammar/*`-Dokumenten. */
export function seenByTopic(grammarDocs: ReadonlyMap<string, Readonly<Doc>>): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [topic, doc] of grammarDocs) out.set(topic, new Set(arr(doc.seen).map(asText)));
  return out;
}

export type DailyIntake = { days: DailyDay[]; words: Array<{ id: string; doc: Doc; ref: string }>; batches: IntakeBatch[]; openTasks: GrammarTask[] };

export function dailyIntake(i: {
  daily: ReadonlyMap<string, Readonly<Doc>>;
  lxDaily: unknown;
  knownVocab: ReadonlySet<string>;
  grammarDocs: ReadonlyMap<string, Readonly<Doc>>;
  today: string;
  nowMs: number;
}): DailyIntake {
  const days = openDailyDays(i);
  return {
    days,
    words: dailyWordCards(days, i.knownVocab, i.today, i.nowMs),
    batches: intakeBatches(days),
    openTasks: dailyOpenTasks(i.daily, seenByTopic(i.grammarDocs), i.nowMs),
  };
}
