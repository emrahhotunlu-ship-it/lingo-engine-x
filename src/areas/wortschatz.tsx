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
import { installAutoSwitch } from '../features/vocab/autoSwitch';
import { restoreTrainer, roundProgress, startSession, trainerSnapshot, TRAINER_RESUME_ID, useSession, type TrainerSnapshot } from '../features/vocab/session';
import { TrainerScreen } from '../features/vocab/TrainerScreen';
import { ListenLoop } from '../features/vocab/listen/ListenLoop';
import { TeacherFeedbackScreen } from '../features/teacher/TeacherFeedbackScreen';
import type { ScreenProps, SheetProps } from '../app/registry';
import { lazy, Suspense, useEffect } from 'react';
import { loadOverview, loadPlace, loadScreens, loadSwitch, loadWordPage, vocabModuleOn, type RoundReport } from '../modules/vocab/api';
import { useLive } from '../data/live';
import { recordRoundEnd } from '../features/progress/persist';
import { markExhausted } from '../features/today/store';
import { useUnitRun } from '../features/unit/runStore';
import { unitDone } from '../app/unit/done';
import { useNav } from '../app/nav';
import { closeSettings } from '../app/sheets';
import { openCompanion } from '../features/companion/store';
import { Skeleton } from '../ui/Skeleton';
import { ExerciseTop } from '../features/learn/ui';
import { askJson } from '../ai/gate';
import { selectAiAvailable } from '../ai/scope';
import { isAiFailure } from '../ai/types';
import { getDb, useCapabilities } from '../platform/capabilities';
import { loadSnapshot } from '../data/snapshot';
import { exportAll } from '../features/settings/exportData';
import type { VocabAi } from '../modules/vocab/api';
import { useT } from '../i18n';
import { useToday } from '../features/today/state';
import { stepNextLabel } from '../ui/exercise/runCtx';

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
    vlearn: { kind: VlearnKind; path?: string };
    /** Wort-Seite der neuen Wörter-App (Großpaket A S6): Stand, Verlauf, Sätze, Aktionen eines Lexems. */
    vword: { path: string };
    /** Einstufungstest der Wörter-App (Großpaket A S7c): Grenze in der Häufigkeitsliste. */
    vplace: NoParams;
    /** Übersicht der Wörter-App (Großpaket B3): Zahlen je Gruppe, nächste 14 Tage, Behaltensrate. */
    vstats: NoParams;
  }
}

const VLEARN_KINDS = ['pflicht', 'more5', 'new5', 'free', 'free10', 'free20', 'free30', 'evening', 'week', 'word', 'mistakes', 'use'] as const;
type VlearnKind = (typeof VLEARN_KINDS)[number];
const LEX_PATH = z.string().max(160).regex(/^(vocab|chunk)\/[^/]+$/);
const vlearnParams = z.object({ kind: z.enum(VLEARN_KINDS), path: LEX_PATH.optional() });
const vwordParams = z.object({ path: LEX_PATH });

// Lernrunde des Wörter-Moduls: nachgeladen (eigene Teil-Datei), mit eigenem Lade-Skelett.
const LearnScreen = lazy(() => loadScreens().then((m) => ({ default: m.LearnScreen })));
const WordPage = lazy(() => loadWordPage().then((m) => ({ default: m.WordPage })));
const WordSettings = lazy(() => loadOverview().then((m) => ({ default: m.WordSettings })));
const PlaceScreen = lazy(() => loadPlace().then((m) => ({ default: m.PlaceScreen })));
const Overview = lazy(() => loadOverview().then((m) => ({ default: m.Overview })));
const VocabHome = lazy(() => import('../features/vocab/hub/VocabHome').then((m) => ({ default: m.VocabHome })));

/** Reiter Wörter: bei eingeschalteter Wörter-App deren Startseite (Emrah 02.11.2026), sonst der bisherige Reiter (Rückweg). */
function VocabTab() {
  const on = useLive((s) => vocabModuleOn(s.docs['app/profile']));
  if (!on) return <VocabHub />;
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-10 h-64 w-full max-w-[47.5rem]" />}>
      <VocabHome />
    </Suspense>
  );
}

// „Neue Wörter-App einschalten“ (plan.md §9.3/9.4): Probelauf, Sicherung, Übernehmen, Rückweg. Eigene Teil-Datei, erst hier geladen.
const SwitchPanel = lazy(() => loadSwitch().then((m) => ({ default: m.SwitchPanel })));
// Volles Lesen und Sicherung für das Einschalten: dieselben Wege wie Einstellungen › Daten (Export), das Modul kennt sie nicht.
const switchRead = async () => {
  const db = getDb();
  if (!db) throw new Error('db unavailable');
  return loadSnapshot(db);
};
const switchBackup = () => exportAll();

/**
 * Einstellungen › Wortschatz (Großpaket A S6, Bild s2-13): Zielzeit, neue Wörter, Sicherheit bei eingeschalteter Wörter-App, darunter der Rückweg.
 * Ausgeschaltet: der ruhige Abschnitt „Neue Wörter-App“ (einschalten bzw. wieder einschalten).
 */
function WordSettingsHost() {
  const on = useLive((s) => vocabModuleOn(s.docs['app/profile']));
  const dbReady = useCapabilities((s) => s.db === 'ready');
  const go = useNav((s) => s.go);
  // Die Einstellungen der Wörter-App stehen IN der Karte „Neue Wörter-App“ (unter der Zustandszeile); eigene Ladegrenze, damit die Karte
  // beim Nachladen stehen bleibt (Sprungziel nach dem Einschalten).
  const ws = on && (
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      <WordSettings
        onPlace={() => {
          // Einstellungen zu, sonst liegt das Blatt über dem Test (E2E vplace).
          closeSettings();
          go({ name: 'vplace' });
        }}
      />
    </Suspense>
  );
  return (
    <Suspense fallback={on ? <Skeleton className="h-48 w-full" /> : null}>
      {dbReady ? (
        <SwitchPanel on={on} read={switchRead} backup={switchBackup}>
          {ws}
        </SwitchPanel>
      ) : (
        ws
      )}
    </Suspense>
  );
}

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

/**
 * Claude für Anwenden und eigenen Satz (Großpaket A S5c): das Wörter-Modul kennt das KI-Tor nicht (Isolation), es bekommt Fragen, Bereitschaft
 * und die Einordnung der Fehler von hier. Claude fehlt, keine Anmeldung oder Ablehnung → Muster und Selbstvergleich; sonst „Erneut versuchen“.
 */
const vocabAi: VocabAi = {
  ready: () => selectAiAvailable(useCapabilities.getState()),
  ask: async (template, vars, signal) => (await askJson({ template, vars, signal, priority: 'user' })).data,
  // Großpaket W2: Wortpartner und Sätze im Hintergrund (Tagesdeckel der Vorlage, still).
  bg: async (template, vars, signal) => (await askJson({ template, vars, signal, priority: 'background' })).data,
  fail: (err) => {
    if (!isAiFailure(err)) return { kind: 'retry', key: null };
    if (err.kind === 'cancelled') return { kind: 'cancelled', key: null };
    if (err.kind === 'unavailable' || err.kind === 'signin' || err.kind === 'refused') return { kind: 'noai', key: null };
    return { kind: 'retry', key: err.messageKey };
  },
};

function VlearnPage({ route }: ScreenProps<'vlearn'>) {
  const { t } = useT();
  // Politur P1: Ist die Runde Schritt 1 der Tageseinheit (dieselbe Bedingung wie `onVlearnFinish`), nennt der Hauptknopf des Abschlusses
  // das Ziel („Weiter: Grammatik“ / „Fertig für heute“) und führt direkt dorthin – die Zwischenkarte entfällt.
  const inUnit = useUnitRun((s) => s.block === 1 && s.duty === 'review');
  useToday((s) => s.duties.done);
  const finishLabel = route.kind === 'pflicht' && inUnit ? stepNextLabel(t) : null;
  return (
    <Suspense fallback={<Skeleton className="m-4 h-40" />}>
      <LearnScreen
        kind={route.kind}
        {...(route.kind === 'word' && route.path ? { paths: [route.path] } : {})}
        ai={vocabAi}
        onRoundEnd={onVlearnEnd}
        onFinish={route.kind === 'pflicht' ? onVlearnFinish : undefined}
        finishLabel={finishLabel}
        renderTop={({ onClose, progress, ctx }) => <ExerciseTop onClose={onClose} closeTestId="vm-close" progress={progress} progressTestId="vm-progress" ctx={ctx} duty={ctx === 'duty' ? 'review' : null} area="words" />}
      />
    </Suspense>
  );
}

/** Einstufung: ✕ und „Später“ zurück zur Herkunft, „Fertig“ ebenso (Übersicht oder Einstellungen). */
function VplacePage() {
  const back = useNav((s) => s.back);
  return (
    <Suspense fallback={<Skeleton className="m-4 h-40" />}>
      <PlaceScreen onClose={back} onDone={back} renderTop={({ onClose, progress }) => <ExerciseTop onClose={onClose} closeTestId="vp-close" progress={progress} progressTestId="vp-progress" ctx={null} />} />
    </Suspense>
  );
}

/** Wort-Seite: „Dieses Wort üben“ startet eine Runde nur mit diesem Lexem, „Claude fragen“ öffnet den Begleiter mit der Frage. */
/** Übersicht Wörter (Großpaket B3): eigene Seite statt unter dem Reiter; „Alle Wörter“ führt zurück zur Liste im Reiter. */
function VstatsPage() {
  const go = useNav((s) => s.go);
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-6 h-64 w-full max-w-xl" />}>
      <div className="mx-auto w-full max-w-xl px-4 pt-2 sm:px-0">
        <Overview onOpenList={() => go({ name: 'vocab' })} onPlace={() => go({ name: 'vplace' })} />
      </div>
    </Suspense>
  );
}

function VwordPage({ route }: ScreenProps<'vword'>) {
  const go = useNav((s) => s.go);
  return (
    <Suspense fallback={<Skeleton className="m-4 h-40" />}>
      <WordPage path={route.path} onPractice={(path) => go({ name: 'vlearn', kind: 'word', path })} onAsk={(text) => openCompanion({ tab: 'chat', text })} ai={vocabAi} />
    </Suspense>
  );
}

/** Wortblatt: bei eingeschaltetem Wörter-Modul führt es zur neuen Wort-Seite, sonst das alte Blatt (Rückweg bis V5). */
function WordSheetSwitch(props: SheetProps) {
  const on = useLive((s) => vocabModuleOn(s.docs['app/profile']));
  const p = props.params;
  const key = p && typeof p === 'object' && typeof (p as { key?: unknown }).key === 'string' ? (p as { key: string }).key : null;
  const target = on && key && LEX_PATH.safeParse(key).success ? key : null;
  const { onClose } = props;
  useEffect(() => {
    if (!target) return;
    onClose();
    useNav.getState().go({ name: 'vword', path: target });
  }, [target, onClose]);
  return target ? null : <WordSheetHost {...props} />;
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
    vocab: { kind: 'tab', component: VocabTab, title: 'nbWsTitle', keepScroll: true },
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
    vword: { kind: 'page', chrome: 'shell', component: VwordPage, title: 'vmWpTitle', params: vwordParams },
    vplace: { kind: 'exercise', component: VplacePage, title: 'vmPlTitle' },
    vstats: { kind: 'page', chrome: 'shell', component: VstatsPage, title: 'vmWhStats' },
  },
  entries: [
    // Zeile unter Üben (place 'learn'): Lehrer-Feedback einfügen.
    { id: 'entry-teacher-feedback', place: 'learn', group: 'nb-learn', order: 56, label: 'tfEntryLabel', sub: 'tfEntrySub', icon: 'chat', route: { name: 'teacherFeedback' } },
  ],
  sections: [{ id: 'ws-stats', place: 'stand', order: 50, component: VocabStatsSection }],
  sheets: [
    { id: 'word', component: WordSheetSwitch },
    { id: 'add', component: AddSheetHost },
    { id: 'x:extra', component: ExtraSheet },
    { id: 'x:say-own', component: SayOwnSheet },
    { id: 'x:decks', component: AllDecksSheet },
    { id: 'x:deck-new', component: NewDeckSheet },
  ],
  settings: [
    { id: 'ws-vmod', group: 'vocab', order: 0, component: WordSettingsHost },
    { id: 'ws-vocab', group: 'vocab', order: 10, component: VocabSettingsSection },
  ],
  resumables: [trainerResume],
  unitBlocks: [reviewBlock],
  boot: () => {
    installFlushOnHide();
    installDecksWatch();
    installAutoSwitch();
  },
});
