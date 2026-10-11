import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { getWriter } from '../../data';
import { useLive } from '../../data/live';
import { validateDoc } from '../../data/validate';
import { chooseChapter, patchC1, readC1 } from '../../domain/c1/c1doc';
import { chapterNow, chapterPlanInput, type ChapterCursor, type TopicPhase } from '../../domain/c1/cursor';
import { freezeGrammarDay } from '../../domain/grammar/path';
import { focusFor, focusTopicOf } from '../../domain/progress/weekly3';
import { patternsOf } from '../../domain/grammar/patterns';
import { readPlan } from '../../domain/plan/buildPlan';
import { refreezeAllowed, refreezePlan } from '../../domain/plan/refreeze';
import type { StoredPlan } from '../../domain/plan/types';
import { logError, logWarn } from '../../platform/diagnostics';
import { startGrammar, topicTestReady, useGrammarSession } from '../grammar/session';
import type { MessageKey } from '../../i18n';
import { saveLocalPlan, useTodayPlan } from '../today/store';
import { unitNow } from '../unit/run';
import { useUnitRun } from '../unit/runStore';
import { c1Raw, chosenNow, useChapterPick } from './chosen';

// Kapitel-Arbeit (K2/K5, `docs/umbau/kapitel-plan.md`): „Kapitel starten/weiterarbeiten“. Der Klick ist synchron (Tastatur am iPhone):
// Wahl sofort im Speicher (optimistisch), Cursor rechnen, die passende Runde starten (Einführung, Übung oder Themen-Test), dann erst speichern
// (`app/c1.ch`/`chh`). Schlägt das Speichern fehl, wird die Wahl zurückgenommen und protokolliert. Der Grammatikschritt von heute wird höchstens
// EINMAL neu festgelegt, und nur solange er unberührt ist (`domain/plan/refreeze.ts`).

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();
const INTRO_PLAN_OF = (topic: string): string[][] | null => patternsOf(topic)?.introPlan ?? null;

export { chosenNow, useChapterNow, useChapterPick, useChosenChapter } from './chosen';

export type ChapterStart = 'intro' | 'practice' | 'test' | 'prep' | 'none';

/** Knopftext je Phase des Kapitel-Cursors: EINE Quelle für die Weiter-Karte (Lernen), das Kapitelblatt und das Ende des Themen-Tests. */
export const CHAPTER_BTN: Record<TopicPhase, MessageKey> = { intro: 'pxKBtnIntro', practice: 'pxKBtnPractice', test: 'pxKBtnTest', done: 'pxKBtnDone' };

/** Themen-Test in Vorbereitung (zu wenig Testaufgaben, dieselbe Auswahl wie beim Start): der Knopf startet dann eine Übung. */
export const cursorPrep = (c: ChapterCursor | null, docs: ReadonlyMap<string, Record<string, unknown>>): boolean => !!c && c.phase === 'test' && !!c.topic && !topicTestReady(c.topic, docs);

/** Knopftext zum Cursor (mit Vorbereitung: „Weiter üben“). */
export const chapterBtnKey = (c: ChapterCursor, prep: boolean): MessageKey => (prep ? 'pxKBtnPractice' : CHAPTER_BTN[c.phase]);

/**
 * Kapitel `idx` (0-basiert) starten oder weiterarbeiten. Synchron im Klick: Runde bauen und hinnavigieren; Speichern und das einmalige
 * Neufestlegen laufen danach. Rückgabe: was gestartet wurde (`prep` = Themen-Test noch in Vorbereitung, stattdessen Übung).
 */
export function startChapter(idx: number, api: { focusNow: () => void }): ChapterStart {
  const n = idx + 1;
  const live = useLive.getState();
  const { today, now } = useClock.getState();
  const docs = live.collections.grammar ?? EMPTY;
  const before = chosenNow();
  const choseToday = readC1(c1Raw()).chh?.some(([, d]) => d === today) ?? false;
  useChapterPick.setState({ n });
  const { cursor, state } = chapterNow({ docs, today, nowMs: now, chosen: n });
  let target = cursor;
  // Kapitel fertig: weiter im nächsten Kapitel (einmal), sonst nichts zu starten.
  if (target && target.phase === 'done' && idx + 1 < state.chapters.length) {
    const next = chapterNow({ docs, today, nowMs: now, chosen: n + 1 }).cursor;
    if (next && next.phase !== 'done') target = next;
  }
  const result = target ? runCursor(target, api) : 'none';
  const chosenN = target?.n ?? n;
  if (chosenN !== n) useChapterPick.setState({ n: chosenN });
  void persistChoice(chosenN, before, choseToday, today);
  return result;
}

/** Die Runde zum Cursor starten und hinnavigieren. */
export function runCursor(c: ChapterCursor, api: { focusNow: () => void }): ChapterStart {
  const topic = c.topic;
  if (!topic) return 'none';
  const go = useNav.getState().go;
  let kind: 'typed' | 'choice' | null;
  let res: ChapterStart = c.phase === 'done' ? 'none' : c.phase;
  if (c.phase === 'intro') {
    // Einführung: zuerst Karten (beim neuen Thema der Vortest), deshalb noch keine Tastatur.
    startGrammar({ mode: 'topic', topic, intro: { topic, pats: c.pats } });
    go({ name: 'grammarSession', mode: 'topic', topic });
    return res;
  }
  if (c.phase === 'test') {
    const step0 = useGrammarSession.getState().step;
    kind = startGrammar({ mode: 'topic', topic, test: true });
    if (useGrammarSession.getState().step === step0) {
      // Weniger als 4 passende Aufgaben: Test in Vorbereitung, stattdessen eine Übungsrunde zum Thema.
      res = 'prep';
      kind = startGrammar({ mode: 'topic', topic, prep: true });
    }
  } else kind = startGrammar({ mode: 'topic', topic, pats: c.pats });
  if (kind === 'typed') api.focusNow();
  go({ name: 'grammarSession', mode: 'topic', topic });
  return res;
}

/** Wahl speichern; bei Fehler zurücknehmen. Danach höchstens einmal den Grammatikschritt von heute neu festlegen. */
async function persistChoice(n: number, before: number | null, choseToday: boolean, today: string): Promise<void> {
  // „Unverändert“ zählt nur, wenn der frisch gelesene Stand dieses Kapitel schon trägt; sonst war `app/c1` unlesbar oder zu groß und die Wahl ist
  // NICHT gespeichert (data-guard).
  let already = false;
  const r = await patchC1((doc) => {
    const next = chooseChapter(doc, n, today);
    already = !next && doc.ch?.n === n;
    return next;
  });
  const saved = r === 'created' || r === 'updated' || (r === 'unchanged' && already);
  if (!saved) {
    useChapterPick.setState({ n: before });
    logWarn('chapter:choose', { code: r, message: `Kapitelwahl ${n} nicht gespeichert` }, 'app/c1');
    return;
  }
  try {
    await refreezeToday(n, choseToday, today);
  } catch (err) {
    logError('chapter:refreeze', err, 'app/profile');
  }
}

/** Der Grammatikschritt von heute folgt dem neuen Kapitel, wenn er noch unberührt ist (einmal je Tag). */
async function refreezeToday(n: number, choseToday: boolean, today: string): Promise<void> {
  const tp = useTodayPlan.getState();
  const plan = tp.day === today ? tp.plan : null;
  const u = unitNow();
  const row = u?.rows.find((x) => x.block === 2) ?? null;
  // Ohne Zeile für Schritt 2 lässt sich nicht prüfen, ob er unberührt ist: dann nichts neu festlegen.
  if (!row) return;
  const run = useUnitRun.getState();
  const gs = useGrammarSession.getState();
  const ok = refreezeAllowed({
    n,
    gt: plan?.u?.gt ?? null,
    step2: { done: row.state === 'done', progress: row.progress?.done ?? 0 },
    running: (run.day === today && run.block === 2) || (gs.active && gs.ctx === 'duty' && gs.day === today),
    choseToday,
  });
  if (!ok || !plan) return;
  const live = useLive.getState();
  const nowMs = useClock.getState().now;
  const docs = live.collections.grammar ?? EMPTY;
  const chapter = chapterPlanInput({ docs, today, nowMs, chosen: n });
  if (!chapter) return;
  // Wochenfokus wie beim Anlegen des Plans: nur, wenn er vor diesem Plan gewählt wurde.
  const focus = focusTopicOf(focusFor(live.docs['app/profile']?.wf, { planAt: plan.at, day: today }));
  const { gt, ps } = freezeGrammarDay({ docs, today, nowMs, introPlanOf: INTRO_PLAN_OF, seed: today, chapter, focus });
  let next: StoredPlan | null = null;
  const writer = getWriter();
  if (writer && tp.status === 'ready') {
    await writer.transform('app/profile', (doc) => {
      if (!doc || !validateDoc('app/profile', doc).ok) return null;
      const raw = doc.plan;
      const cur = readPlan(raw, today);
      // Nur der Plan, den dieses Gerät kennt (gleicher Zeitpunkt), und nur, wenn er noch nicht diesem Kapitel folgt.
      if (!cur || cur.at !== plan.at || !raw || typeof raw !== 'object' || cur.u?.gt?.ch === n) return null;
      const upd = refreezePlan(raw as Record<string, unknown>, gt, ps);
      if (!upd) return null;
      next = readPlan(upd, today);
      return next ? { update: { plan: upd } } : null;
    });
  } else {
    // Plan nur lokal (z. B. Profil nicht schreibbar): die lokale Kopie folgt.
    const upd = refreezePlan(plan as unknown as Record<string, unknown>, gt, ps);
    next = upd ? readPlan(upd, today) : null;
  }
  const done: StoredPlan | null = next;
  if (!done || useTodayPlan.getState().day !== today) return;
  useTodayPlan.setState({ plan: done });
  saveLocalPlan(done);
}

export { skipTopicTest } from './skipTest';
