import { AtlasScreen } from '../features/vocab/atlas/AtlasScreen';
import { z } from 'zod';
import { defineArea } from '../app/registry';
import { restoreFor } from '../app/resume';
import type { Resumable } from '../app/resume';
import type { UnitBlockProvider } from '../app/unit/types';
import { installDecksWatch } from '../features/vocab/decksStore';
import { DeckScreen } from '../features/vocab/hub/DeckScreen';
import { VocabStatsSection, VocabSettingsSection } from '../features/vocab/hub/Sections';
import { AddSheetHost, AllDecksSheet, ExtraSheet, NewDeckSheet, WordSheetHost } from '../features/vocab/hub/Sheets';
import { SayOwnSheet } from '../features/vocab/hub/SayOwnSheet';
import { VocabHub } from '../features/vocab/hub/VocabHub';
import { VocabScreen } from '../features/vocab/list/VocabScreen';
import { installFlushOnHide } from '../features/vocab/persist';
import { restoreTrainer, roundProgress, startSession, trainerSnapshot, TRAINER_RESUME_ID, useSession, type TrainerSnapshot } from '../features/vocab/session';
import { TrainerScreen } from '../features/vocab/TrainerScreen';
import { ListenLoop } from '../features/vocab/listen/ListenLoop';
import { TeacherFeedbackScreen } from '../features/teacher/TeacherFeedbackScreen';
import type { ScreenProps } from '../app/registry';
import { lazy, Suspense } from 'react';
import { loadScreens, vocabModuleOn, type RoundReport } from '../modules/vocab/api';
import { useLive } from '../data/live';
import { recordRoundEnd } from '../features/progress/persist';
import { markExhausted } from '../features/today/store';
import { useUnitRun } from '../features/unit/runStore';
import { unitDone } from '../app/unit/done';
import { useNav } from '../app/nav';
import { Skeleton } from '../ui/Skeleton';
import { ExerciseTop } from '../features/learn/ui';

// Bereich „Wortschatz & Anki“ – Besitz: Paket P3 (plan.md §4.4, anki-regeln.md).
// Reiter-Wurzel `vocab` (Suche, „Alle fälligen“, Prognose, Stapel, Eingangskorb, Zuletzt), Seiten
// `deck` und `vocabList`, Übung `trainer` (Tippen und Aufdecken), Blätter `word`, `add`, `x:extra`,
// `x:deck-new`, Hörschleife `listenLoop` (N35), Einstellungs-Abschnitt „Wortschatz“, Statistik auf Platz `stand`, Block 1 `review`.

declare module '../app/router/types' {
  interface RouteParams {
    vocab: NoParams;
    vocabList: { filter?: string; q?: string };
    atlas: NoParams;
    deck: { id: string };
    trainer: { round: 'pflicht' | 'extra'; mode?: 'auto' | 'type' | 'flip' | 'listen'; deck?: string };
    listenLoop: NoParams;
    /** Lehrer-Feedback einfügen (28.09.2026, ersetzt die Preply-Brücke). */
    teacherFeedback: NoParams;
    /** Neue Wörter-App (V3): Lernrunde, nur bei `vcfg.mod = 1` (sonst ruhiger Hinweis im Bildschirm). */
    vlearn: { kind: VlearnKind };
  }
}

const VLEARN_KINDS = ['pflicht', 'more5', 'free', 'evening', 'week', 'word', 'mistakes'] as const;
type VlearnKind = (typeof VLEARN_KINDS)[number];
const vlearnParams = z.object({ kind: z.enum(VLEARN_KINDS) });

// Lernrunde des Wörter-Moduls: nachgeladen (eigene Teil-Datei), mit eigenem Lade-Skelett.
const LearnScreen = lazy(() => loadScreens().then((m) => ({ default: m.LearnScreen })));

/**
 * Rundenende der neuen Wörter-Runde (V3 Schritt 4b): Pflicht zählt als `act.review` (Heute „Wörter erledigt“, Serie), Extra als `cards`;
 * Minuten, XP und Antworten über die eine Sammel-Warteschlange. Pflicht ohne Inhalt (nichts fällig, nichts neu): für heute ausgeschöpft.
 */
function onVlearnEnd(r: RoundReport): void {
  const duty = r.kind === 'pflicht';
  if (r.n < 1) {
    if (duty && !r.partial) markExhausted(r.day);
    return;
  }
  void recordRoundEnd({ day: r.day, act: duty ? 'review' : 'cards', partial: r.partial, n: r.n, right: r.right, activeMs: r.activeMs, countAs: r.n });
}

/** „Fertig“: in der Tageseinheit weiter zur Zwischenkarte (Block 1 erledigt), sonst nach Heute. */
function onVlearnFinish(): void {
  const run = useUnitRun.getState();
  if (run.block === 1 && run.duty === 'review') unitDone(1);
  else useNav.getState().switchTab('today');
}

function VlearnPage({ route }: ScreenProps<'vlearn'>) {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-40" />}>
      <LearnScreen
        kind={route.kind}
        onRoundEnd={onVlearnEnd}
        onFinish={route.kind === 'pflicht' ? onVlearnFinish : undefined}
        renderTop={({ onClose, progress, ctx }) => <ExerciseTop onClose={onClose} closeTestId="vm-close" progress={progress} progressTestId="vm-progress" ctx={ctx} duty={ctx === 'duty' ? 'review' : null} />}
      />
    </Suspense>
  );
}

const trainerParams = z.object({ round: z.enum(['pflicht', 'extra']), mode: z.enum(['auto', 'type', 'flip', 'listen']).optional(), deck: z.string().max(64).optional() });

/**
 * Übung ohne Sitzung (Deep-Link, Neuladen): aktive Sitzung → weiter; sonst Momentaufnahme
 * herstellen; sonst neu starten. `false` → ruhiger Hinweis und zurück zur Herkunft (§2.3).
 */
function ensureTrainer(route: { round: 'pflicht' | 'extra'; mode?: 'auto' | 'type' | 'flip' | 'listen'; deck?: string }): boolean {
  if (useSession.getState().active) return true;
  if (restoreFor('trainer')) return true;
  startSession(route.round, { ...(route.deck ? { deck: route.deck } : {}), ...(route.mode ? { mode: route.mode } : {}) });
  const s = useSession.getState();
  return s.active && (s.status === 'running' || s.queue.length > 0);
}

const trainerResume: Resumable<TrainerSnapshot> = {
  id: TRAINER_RESUME_ID,
  version: 1,
  origin: 'vocab',
  snapshot: trainerSnapshot,
  subscribe: (cb) => useSession.subscribe(cb),
  restore: restoreTrainer,
  route: (s) => ({ name: 'trainer', round: s.round, ...(s.deck !== 'all' ? { deck: s.deck } : {}) }),
  label: (s, t) => {
    const p = roundProgress({ status: 'running', round: s.round, queue: s.queue, pos: s.pos, target: s.target, doneBefore: s.doneBefore, answered: s.answered });
    return t('nbWsResume', { deck: s.label ?? t(s.round === 'pflicht' ? 'nbWsReview' : 'nbWsDeckAll'), n: p?.n ?? s.pos + 1, total: p?.total ?? s.queue.length });
  },
};

/** Block 1 der Tageseinheit (plan.md §1.5): Reparatur-Sätze, dann Fällige; `auto`, DE→EN. */
const reviewBlock: UnitBlockProvider = {
  kind: 'review',
  feasible: () => true,
  start: () => {
    // Neues Wörter-Modul eingeschaltet: Block 1 ist die Pflicht-Runde des Moduls (Start-Bild, Abschluss, „Fertig“ → Zwischenkarte).
    if (vocabModuleOn(useLive.getState().docs['app/profile'])) return { name: 'vlearn', kind: 'pflicht' };
    startSession('pflicht', { mode: 'auto', unit: true });
    const s = useSession.getState();
    return s.active ? { name: 'trainer', round: 'pflicht' } : false;
  },
};

function VocabListPage({ route }: ScreenProps<'vocabList'>) {
  return <VocabScreen filter={route.filter} q={route.q} />;
}

export const wortschatz = defineArea({
  id: 'wortschatz',
  screens: {
    vocab: { kind: 'tab', component: VocabHub, title: 'nbWsTitle', keepScroll: true },
    vocabList: { kind: 'page', component: VocabListPage, title: 'nbWsListTitle', keepScroll: true, params: z.object({ filter: z.string().max(24).optional(), q: z.string().max(80).optional() }) },
    atlas: { kind: 'page', component: AtlasScreen, title: 'atTitle', keepScroll: true },
    deck: { kind: 'page', component: DeckScreen, title: 'nbWsDecks', params: z.object({ id: z.string().min(1).max(64) }) },
    trainer: { kind: 'exercise', component: TrainerScreen, params: trainerParams, ensure: ensureTrainer },
    // N35 Hörschleife (Extra-Runde): schreibt nichts, zählt nicht als Wiederholung.
    listenLoop: { kind: 'exercise', component: ListenLoop, title: 'nbWsLoopTitle' },
    // Lehrer-Feedback einfügen (28.09.2026, ersetzt die Preply-Brücke).
    teacherFeedback: { kind: 'page', component: TeacherFeedbackScreen, title: 'tfTitle' },
    // Neue Wörter-App (Großpaket A, V3): Lernrunde des Moduls; Einstieg von Heute kommt mit Schritt 4.
    vlearn: { kind: 'exercise', component: VlearnPage, title: 'vmScreenTitle', params: vlearnParams },
  },
  entries: [
    // Zeile unter Üben (place 'learn'): Lehrer-Feedback einfügen.
    { id: 'entry-teacher-feedback', place: 'learn', group: 'nb-learn', order: 56, label: 'tfEntryLabel', sub: 'tfEntrySub', icon: 'chat', route: { name: 'teacherFeedback' } },
  ],
  sections: [{ id: 'ws-stats', place: 'stand', order: 50, component: VocabStatsSection }],
  sheets: [
    { id: 'word', component: WordSheetHost },
    { id: 'add', component: AddSheetHost },
    { id: 'x:extra', component: ExtraSheet },
    { id: 'x:say-own', component: SayOwnSheet },
    { id: 'x:decks', component: AllDecksSheet },
    { id: 'x:deck-new', component: NewDeckSheet },
  ],
  settings: [{ id: 'ws-vocab', group: 'vocab', order: 10, component: VocabSettingsSection }],
  resumables: [trainerResume],
  unitBlocks: [reviewBlock],
  boot: () => {
    installFlushOnHide();
    installDecksWatch();
  },
});
