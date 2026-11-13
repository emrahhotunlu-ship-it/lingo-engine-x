import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { chapterRunOn, flags } from '../../app/flags';
import { useLive } from '../../data/live';
import { focusView, type FocusStage, type FocusView } from '../../domain/grammar/focus';
import type { MessageKey } from '../../i18n';
import { useChapterNow } from '../c1/chapterRun';
import { useTodayPlan } from '../today/store';
import { topicName } from './topicUi';

// Fokus-Thema für die Anzeige (Politur P3): EINE Quelle für den Grammatik-Reiter („Du bist hier“), das Rundenende und die Heute-Zeile.
// Nur gelesen: `grammar/*`, der eingefrorene Plan von heute (`u.gt`) und der Kapitel-Cursor.

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();
type T = (k: MessageKey, v?: Record<string, string | number>) => string;

const STAGE_KEY: Record<FocusStage, MessageKey> = { 1: 'gfStage1', 2: 'gfStage2', 3: 'gfStage3', 4: 'gfStage4' };

/** Name der Stufe: Verstehen · Bilden · Umformen · Mischen. */
export const stageName = (stage: FocusStage, t: T): string => t(STAGE_KEY[stage]);

/** „Stufe 2 von 4 · Bilden“. */
export const stageLine = (stage: FocusStage, t: T): string => t('gfStageOf', { n: stage, name: stageName(stage, t) });

/**
 * Heute-Zeile des Grammatik-Schritts: „Conditionals · Stufe 2 von 4 (Bilden)“. Für `src/features/today` (P1 besitzt Heute): statt des bloßen
 * Themennamens einsetzbar, wenn der Plan ein Fokus-Thema trägt (`view.frozen`).
 */
export const focusTodayLine = (view: FocusView, t: T, lang: 'de' | 'en'): string => t('gfTodayLine', { topic: topicName(view.topic, lang), n: view.stage, name: stageName(view.stage, t) });

/** Das Fokus-Thema von heute aus den Live-Daten; `null`, wenn es keins gibt. */
export function useFocusView(): FocusView | null {
  const docs = useLive((s) => s.collections.grammar) ?? EMPTY;
  const today = useClock((s) => s.today);
  const now = useClock((s) => s.now);
  const gt = useTodayPlan((s) => (s.plan && s.plan.d === today ? (s.plan.u?.gt ?? null) : null));
  const chapter = useChapterNow();
  const chapterTopic = chapterRunOn() && flags.program ? (chapter.cursor?.topic ?? null) : null;
  return useMemo(() => focusView({ docs, today, nowMs: now, gt, chapterTopic }), [docs, today, now, gt, chapterTopic]);
}
