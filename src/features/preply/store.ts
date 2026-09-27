import { create } from 'zustand';
import { useNav } from '../../app/nav';

// Zustand des Preply-Bildschirms (Phase 5 §3.3). Die Sammlung `preply` wird nur abonniert,
// solange der Bildschirm offen ist (E5-19, PreplyScreen). Von überall kann eine Stunde zu einem
// Thema vorbereitet werden (Funktionsabgleich M18): `openPreplyPrep({title})`.

export type PreplyTab = 'prep' | 'import' | 'history';
type Doc = Record<string, unknown>;

type State = {
  tab: PreplyTab | null;
  docs: ReadonlyMap<string, Doc>;
  loaded: boolean;
  failed: boolean;
  /** Geöffneter Eintrag im Verlauf (nur lesen). */
  openId: string | null;
  /** Anlass „Zu: {Titel}" (M18), vorgewählt beim Vorbereiten. */
  pendingTopic: { title: string; seq: number } | null;
};

export const usePreply = create<State>(() => ({ tab: null, docs: new Map(), loaded: false, failed: false, openId: null, pendingTopic: null }));

let seq = 0;

export function setPreplyTab(tab: PreplyTab): void {
  usePreply.setState({ tab, openId: null });
}

export function openPreplyEntry(id: string | null): void {
  usePreply.setState({ openId: id, ...(id ? { tab: 'history' as const } : {}) });
}

/** „Als Preply-Stunde" (M18): öffnet Vorbereiten, optional mit Anlass-Chip „Zu: {Titel}". */
export function openPreplyPrep(topic: { title: string } | null): void {
  usePreply.setState({ tab: 'prep', openId: null, pendingTopic: topic?.title.trim() ? { title: topic.title.trim().slice(0, 120), seq: ++seq } : null });
  useNav.getState().go({ name: 'speak', seg: 'preply' });
}

export function receivePreply(docs: ReadonlyMap<string, Doc>): void {
  usePreply.setState({ docs, loaded: true, failed: false });
}
