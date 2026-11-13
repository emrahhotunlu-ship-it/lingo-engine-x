import { topicById } from '../content';
import { patsOf, patternState } from '../metrics/pattern';
import type { GrammarDay } from '../plan/types';
import { hash32 } from '../random';
import { topicP } from './bkt';
import { focusDay, focusOpen, focusPick, readFocus, stageOf, type FocusStage } from './focus';
import { patternById, patternsOf } from './patterns';

// Brücke Grammatik → Anwenden (Politur P3 für P4): Welches Grammatik-Thema und -Muster übt der heutige Grammatik-Schritt, und welches frühere
// Muster sitzt schon sicher? Rein und deterministisch je Lerntag; gelesen wird nur (`grammar/*`, eingefrorenes `u.gt`), geschrieben nichts.

type Doc = Readonly<Record<string, unknown>>;
type Bi = { de: string; en: string };

/**
 * Ein Muster zum Anzeigen: Kennung (`cn.second`), Thema, Name, Formel (`if + past, would + Grundform`), Kurzregel (wofür man es benutzt, ein bis
 * zwei Sätze) und ein geprüftes Beispiel aus der Musterdatei – alles zweisprachig, wie es in der Regel-Karte der Grammatik steht.
 */
export type PatternRef = { id: string; topic: string; name: Bi; form: Bi; rule: Bi; ex: { en: string; de: string | null } | null };

export type FocusOfDay = {
  /** Fokus-Thema des heutigen Grammatik-Schritts; `null`, wenn es keins gibt (nichts begonnen, alles sitzt und kein Plan). */
  topic: string | null;
  /** Name des Fokus-Themas (`de` = Name der Inhalte, `en` = englischer Name, sonst derselbe). */
  topicName: Bi | null;
  /** Stufe des Fokus-Themas: 1 Verstehen · 2 Bilden · 3 Umformen · 4 Mischen. */
  stage: FocusStage;
  /** Muster des heutigen Schritts (Brücken-Satz 1); `null` ohne Musterdatei. */
  pattern: PatternRef | null;
  /** Ein sicheres früheres Muster aus einem ANDEREN Thema, dessen Beherrschung ≥ 0,8 ist (Brücken-Satz 2); `null`, solange noch keins sicher ist. */
  safe: PatternRef | null;
};

export type FocusOfDayIn = {
  docs: ReadonlyMap<string, Doc>;
  today: string;
  nowMs: number;
  /** Eingefrorenes Grammatikthema des heutigen Plans (`app/profile.plan.u.gt`); trägt es die Marke `fo`, gilt sein erstes Thema. */
  gt?: GrammarDay | null;
  /** Thema des Kapitel-Cursors, nur für die Wahl ohne Plan. */
  chapterTopic?: string | null;
};

/** Ab dieser Beherrschung des Themas gilt ein früheres Muster als sicher (Brücken-Satz 2). */
export const SAFE_TOPIC_P = 0.8;

const ref = (id: string): PatternRef | null => {
  const p = patternById(id);
  if (!p) return null;
  const ex = p.ex[0];
  return {
    id: p.id,
    topic: p.topic,
    name: { de: p.name.de, en: p.name.en },
    form: { de: p.form.de, en: p.form.en },
    rule: { de: p.use.de, en: p.use.en },
    ex: ex ? { en: ex.en, de: ex.de ?? null } : null,
  };
};

const nameOf = (topic: string): Bi | null => {
  const t = topicById(topic);
  return t ? { de: t.name, en: t.name_en ?? t.name } : null;
};

/**
 * Thema, Stufe und Muster des heutigen Grammatik-Schritts und ein sicheres früheres Muster.
 * - Thema: aus dem eingefrorenen Plan (`gt.fo`), sonst die Wahl von `focusPick`, sonst das Thema des Plans.
 * - Muster: das erste Muster des Tages (`focusDay`); in „Umformen“/„Mischen“ (alle Muster) das schwächste eingeführte.
 * - Sicheres Muster: nur aus einem anderen Thema mit Beherrschung ≥ 0,8 (`SAFE_TOPIC_P`); dort Zustand „Sicher“ oder „Fest“, die zuletzt
 *   geübten zuerst, unter den ersten fünf wechselt es je Lerntag. Ohne solches Muster das am häufigsten richtig beantwortete Muster eines
 *   solchen Themas.
 */
export function focusOfDay(i: FocusOfDayIn): FocusOfDay {
  const planned = i.gt?.fo === 1 ? (i.gt.topics[0] ?? null) : null;
  const topic =
    (planned && topicById(planned) ? planned : null) ??
    focusPick({ docs: i.docs, today: i.today, nowMs: i.nowMs, chapterTopic: i.chapterTopic ?? null })?.topic ??
    i.gt?.intro ??
    i.gt?.topics[0] ??
    null;
  const doc = topic ? i.docs.get(topic) : undefined;
  const st = readFocus(doc);
  const stage = stageOf(focusOpen(st) ? st : null);
  let pattern: PatternRef | null = null;
  if (topic) {
    const day = focusDay(topic, doc, i.today);
    const entries = patsOf(doc);
    const weakest = Object.entries(entries)
      .filter(([, e]) => (e.n ?? 0) > 0)
      .sort((a, b) => ((b[1].n ?? 0) - (b[1].c ?? 0)) / (b[1].n ?? 1) - ((a[1].n ?? 0) - (a[1].c ?? 0)) / (a[1].n ?? 1) || a[0].localeCompare(b[0]))[0]?.[0];
    const id = day.pats[0] ?? weakest ?? patternsOf(topic)?.order[0] ?? null;
    pattern = id ? ref(id) : null;
  }
  const safeList: Array<{ id: string; last: number }> = [];
  const sure = (tp: string, d: Doc): boolean => tp !== topic && !!topicById(tp) && topicP(tp, d, i.nowMs) >= SAFE_TOPIC_P;
  for (const [tp, d] of i.docs) {
    if (!sure(tp, d)) continue;
    for (const [id, e] of Object.entries(patsOf(d))) {
      const state = patternState(e, i.today);
      if ((state === 'safe' || state === 'firm') && patternById(id)?.topic === tp) safeList.push({ id, last: e.last ?? 0 });
    }
  }
  safeList.sort((a, b) => b.last - a.last || a.id.localeCompare(b.id));
  let safe: PatternRef | null;
  const top = safeList.slice(0, 5);
  if (top.length) safe = ref((top[hash32(`fod|${i.today}`) % top.length] as { id: string }).id);
  else {
    // Noch kein Muster „Sicher“: das am häufigsten richtig beantwortete Muster eines Themas, das sitzt (Beherrschung ≥ 0,8).
    let best: { id: string; c: number } | null = null;
    for (const [tp, d] of i.docs) {
      if (!sure(tp, d)) continue;
      for (const [id, e] of Object.entries(patsOf(d))) if ((e.c ?? 0) > (best?.c ?? 0) && patternById(id)?.topic === tp) best = { id, c: e.c ?? 0 };
    }
    safe = best ? ref(best.id) : null;
  }
  return { topic, topicName: topic ? nameOf(topic) : null, stage, pattern, safe };
}
