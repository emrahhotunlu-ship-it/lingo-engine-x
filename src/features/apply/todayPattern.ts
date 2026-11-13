import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { dayKey } from '../../domain/date';
import { patternById, patternsOf } from '../../domain/grammar/patterns';
import { patsOf, patternState } from '../../domain/metrics/pattern';
import { focusOfDay } from '../../domain/grammar/focusOfDay';
import type { GrammarDay } from '../../domain/plan/types';
import { useBookDuty, type BookDuty } from '../today/bookDuty';
import { useTodayPlan } from '../today/store';

// ADAPTER (Großpaket P „Politur“, P4): „Welches Grammatik-Muster ist HEUTE dran?“ – für Satz 1 der Brücken-Sätze.
//
// Paket P3 (Grammatik: ein Thema über mehrere Tage in Lernstufen) baut dafür parallel eine eigene Funktion. Bis sie da ist, rechnet diese EINE
// Datei mit der heutigen Logik; beim Zusammenführen genügt es, `todayPatternOf` (bzw. `useTodayPattern`) auf die Funktion von P3 umzustellen.
// Nichts anderes in Anwenden kennt Buch-Schritt, `u.gt` oder die Thema-Dokumente (einziger Aufrufer: `modules/apply/ui/bridgeData.ts`).
//
// Reihenfolge (die erste Regel, die ein bekanntes Muster liefert, gilt):
//  1. Das heute in der Grammatikrunde zuletzt geübte Muster der Themen von heute (Buch-Seite bzw. `u.gt`): `pats[muster].last` liegt am heutigen Lerntag.
//     Mit Fokus-Thema (`u.gt.fo === 1`) nur Muster von `u.gt.topics[0]` (Aufwärm-/Partner-Themen nie).
//  2. Buch-Schritt (`useBookDuty`): das Muster des Themas der Seite, an dem gerade gearbeitet wird.
//  3. Eingefrorener Plan `u.gt`: die Muster des Tages (`pats`), sonst Einführungsthema und Rundenthemen.
//  4. Sonst: das schwächste begonnene Thema (kleinstes `p` mit mindestens einer Antwort).
// Nur lesen, rein bis auf den Haken `useTodayPattern`.

type Doc = Readonly<Record<string, unknown>>;

export type TodayPattern = { id: string; topic: string; src: 'done' | 'book' | 'plan' | 'weak' };

/** Das Muster eines Themas, an dem gerade gearbeitet wird: das erste begonnene, noch nicht sichere; sonst das erste neue; sonst das erste der Lernreihenfolge. */
export function patternOfTopic(topic: string, doc: Doc | undefined, today: string): string | null {
  const tp = patternsOf(topic);
  if (!tp) return null;
  const ids = new Set(tp.patterns.map((p) => p.id));
  const order = tp.order.filter((id) => ids.has(id));
  const entries = patsOf(doc);
  const state = (id: string) => patternState(entries[id], today);
  return order.find((id) => state(id) === 'learning') ?? order.find((id) => state(id) === 'new') ?? order[0] ?? null;
}

export function todayPatternOf(i: { book: BookDuty; gt: GrammarDay | null | undefined; grammar: ReadonlyMap<string, Doc> | null | undefined; today: string; nowMs?: number }): TodayPattern | null {
  const docs = i.grammar ?? new Map<string, Doc>();
  const bookTopic = i.book?.kind === 'page' ? i.book.topic : null;
  const planTopics = i.gt ? [...(i.gt.intro ? [i.gt.intro] : []), ...i.gt.topics] : [];
  // Plan mit Fokus-Thema (`gt.fo === 1`): Satz 1 nimmt sicher das Muster des Fokus-Themas (`gt.topics[0]`) – ein heute zuletzt geübtes Muster
  // eines Aufwärm- oder Partner-Themas zählt dann nicht (Prüfbefund learning-scientist 13.11.2026).
  const focusTopic = i.gt?.fo === 1 ? (i.gt.topics[0] ?? null) : null;
  const todayTopics = i.gt?.fo === 1 ? (focusTopic ? [focusTopic] : []) : [...new Set([...(bookTopic ? [bookTopic] : []), ...planTopics])];

  // 1. Heute schon geübt: das zuletzt beantwortete Muster der Themen von heute (mit Fokus-Thema nur dessen Muster).
  let done: { id: string; topic: string; last: number } | null = null;
  for (const topic of todayTopics) {
    for (const [id, e] of Object.entries(patsOf(docs.get(topic)))) {
      const last = e.last ?? 0;
      if (last <= 0 || dayKey(last) !== i.today || patternById(id)?.topic !== topic) continue;
      if (!done || last > done.last) done = { id, topic, last };
    }
  }
  if (done) return { id: done.id, topic: done.topic, src: 'done' };

  // 1b. Großpaket P (Zusammenführung P3/P4): Plan mit Fokus-Thema (`gt.fo`) – das Muster des heutigen Fokus-Schritts (`focusOfDay`).
  if (i.gt?.fo === 1) {
    const fo = focusOfDay({ docs, today: i.today, nowMs: i.nowMs ?? Date.parse(`${i.today}T12:00:00Z`), gt: i.gt });
    if (fo.pattern) return { id: fo.pattern.id, topic: fo.pattern.topic, src: 'plan' };
  }

  // 2. Buch-Schritt: Thema der Seite.
  if (bookTopic) {
    const id = patternOfTopic(bookTopic, docs.get(bookTopic), i.today);
    if (id) return { id, topic: bookTopic, src: 'book' };
  }

  // 3. Eingefrorener Plan: Muster des Tages, sonst die Themen der Runde.
  for (const raw of i.gt?.pats ?? []) {
    const p = patternById(raw);
    if (p) return { id: p.id, topic: p.topic, src: 'plan' };
  }
  for (const topic of planTopics) {
    const id = patternOfTopic(topic, docs.get(topic), i.today);
    if (id) return { id, topic, src: 'plan' };
  }

  // 4. Schwächstes begonnenes Thema.
  const begun = [...docs.entries()]
    .filter(([topic, d]) => typeof d.n === 'number' && d.n > 0 && typeof d.p === 'number' && !!patternsOf(topic))
    .sort((a, b) => (a[1].p as number) - (b[1].p as number) || a[0].localeCompare(b[0]));
  for (const [topic, d] of begun) {
    const id = patternOfTopic(topic, d, i.today);
    if (id) return { id, topic, src: 'weak' };
  }
  return null;
}

/** Muster des heutigen Grammatik-Schritts aus den Live-Daten (Buch-Schritt, eingefrorener Plan, Thema-Dokumente). */
export function useTodayPattern(): TodayPattern | null {
  const today = useClock((s) => s.today);
  const book = useBookDuty((s) => s.step);
  const gt = useTodayPlan((s) => (s.plan && s.plan.d === today ? (s.plan.u?.gt ?? null) : null));
  const grammar = useLive((s) => s.collections.grammar);
  return useMemo(() => todayPatternOf({ book, gt, grammar, today }), [book, gt, grammar, today]);
}
