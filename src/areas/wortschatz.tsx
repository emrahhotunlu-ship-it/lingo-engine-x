import { z } from 'zod';
import { defineArea } from '../app/registry';
import { restoreFor } from '../app/resume';
import type { Resumable } from '../app/resume';
import type { UnitBlockProvider } from '../app/unit/types';
import { installDecksWatch } from '../features/vocab/decksStore';
import { DeckScreen } from '../features/vocab/hub/DeckScreen';
import { VocabStatsSection, VocabSettingsSection } from '../features/vocab/hub/Sections';
import { AddSheetHost, ExtraSheet, NewDeckSheet, WordSheetHost } from '../features/vocab/hub/Sheets';
import { VocabHub } from '../features/vocab/hub/VocabHub';
import { VocabScreen } from '../features/vocab/list/VocabScreen';
import { installFlushOnHide } from '../features/vocab/persist';
import { restoreTrainer, roundProgress, startSession, trainerSnapshot, TRAINER_RESUME_ID, useSession, type TrainerSnapshot } from '../features/vocab/session';
import { TrainerScreen } from '../features/vocab/TrainerScreen';
import type { ScreenProps } from '../app/registry';

// Bereich „Wortschatz & Anki“ – Besitz: Paket P3 (plan.md §4.4, anki-regeln.md).
// Reiter-Wurzel `vocab` (Suche, „Alle fälligen“, Prognose, Stapel, Eingangskorb, Zuletzt), Seiten
// `deck` und `vocabList`, Übung `trainer` (Tippen und Aufdecken), Blätter `word`, `add`, `x:extra`,
// `x:deck-new`, Einstellungs-Abschnitt „Wortschatz“, Statistik auf Platz `stand`, Block 1 `review`.

declare module '../app/router/types' {
  interface RouteParams {
    vocab: NoParams;
    vocabList: { filter?: string; q?: string };
    deck: { id: string };
    trainer: { round: 'pflicht' | 'extra'; mode?: 'auto' | 'type' | 'flip'; deck?: string };
  }
}

const trainerParams = z.object({ round: z.enum(['pflicht', 'extra']), mode: z.enum(['auto', 'type', 'flip']).optional(), deck: z.string().max(64).optional() });

/**
 * Übung ohne Sitzung (Deep-Link, Neuladen): aktive Sitzung → weiter; sonst Momentaufnahme
 * herstellen; sonst neu starten. `false` → ruhiger Hinweis und zurück zur Herkunft (§2.3).
 */
function ensureTrainer(route: { round: 'pflicht' | 'extra'; mode?: 'auto' | 'type' | 'flip'; deck?: string }): boolean {
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
    const p = roundProgress({ status: 'running', round: s.round, queue: s.queue, pos: s.pos, target: s.target, doneBefore: s.doneBefore, answered: s.answered, repairs: [], repairPos: 0 });
    return t('nbWsResume', { deck: s.label ?? t(s.round === 'pflicht' ? 'nbWsReview' : 'nbWsDeckAll'), n: p?.n ?? s.pos + 1, total: p?.total ?? s.queue.length });
  },
};

/** Block 1 der Tageseinheit (plan.md §1.5): Reparatur-Sätze, dann Wochenthema, dann Fällige; `auto`, DE→EN. */
const reviewBlock: UnitBlockProvider = {
  kind: 'review',
  feasible: () => true,
  start: (ctx) => {
    startSession('pflicht', { mode: 'auto', unit: true, theme: ctx.theme });
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
    deck: { kind: 'page', component: DeckScreen, title: 'nbWsDecks', params: z.object({ id: z.string().min(1).max(64) }) },
    trainer: { kind: 'exercise', component: TrainerScreen, params: trainerParams, ensure: ensureTrainer },
  },
  sections: [{ id: 'ws-stats', place: 'stand', order: 50, component: VocabStatsSection }],
  sheets: [
    { id: 'word', component: WordSheetHost },
    { id: 'add', component: AddSheetHost },
    { id: 'x:extra', component: ExtraSheet },
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
