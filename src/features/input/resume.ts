import { create } from 'zustand';
import type { Resumable } from '../../app/resume';
import type { Route } from '../../app/router/types';
import { useBlockRun, type BlockRun } from './block/run';

// Fortsetzen nach Neuladen (Neubau G3, N04; architektur.md §3.2) für Lesen, Hören, Schreiben,
// Entdecken und Block 2 der Tageseinheit. Die Bildschirme melden ihre Position hier (reiner
// Speicher-Zustand); der Rahmen (WP0b) sichert sie lokal und stellt sie SYNCHRON her. Antworten und
// Entwürfe liegen wie bisher in der db bzw. in `lx:draft:*` – `restore` schreibt nie in die db.

export type InputPosId = 'read' | 'listen' | 'write' | 'discover';

export type InputPos = {
  route: Route;
  title: string;
  /** Schritt der Einheit (`reading`, `questions`, `prep` …). */
  step?: string;
  /** Absatz im Leser bzw. Satz beim Hören. */
  para?: number;
  /** Wörter im Entwurf (Schreiben). */
  words?: number;
};

type PosState = {
  pos: Partial<Record<InputPosId, InputPos | null>>;
  /** Nach dem Herstellen: Stelle, zu der die Einheit beim ersten Zeichnen springt. */
  pending: Partial<Record<InputPosId, InputPos>>;
};

export const useInputPos = create<PosState>(() => ({ pos: {}, pending: {} }));

const same = (a: InputPos | null | undefined, b: InputPos | null): boolean => JSON.stringify(a ?? null) === JSON.stringify(b);

/** Position melden (`null` = regulär beendet, Momentaufnahme verwerfen). */
export function reportPos(id: InputPosId, p: InputPos | null): void {
  if (same(useInputPos.getState().pos[id], p)) return;
  useInputPos.setState((s) => ({ pos: { ...s.pos, [id]: p } }));
}

/** Einmal abholen: die hergestellte Stelle (danach leer). */
export function takePending(id: InputPosId): InputPos | null {
  const p = useInputPos.getState().pending[id] ?? null;
  if (p) useInputPos.setState((s) => ({ pending: { ...s.pending, [id]: undefined } }));
  return p;
}

const LABEL: Record<InputPosId, 'nbLesenResumeRead' | 'nbLesenResumeListen' | 'nbLesenResumeWrite' | 'nbLesenResumeDiscover'> = {
  read: 'nbLesenResumeRead',
  listen: 'nbLesenResumeListen',
  write: 'nbLesenResumeWrite',
  discover: 'nbLesenResumeDiscover',
};

function unitResumable(id: InputPosId): Resumable<InputPos> {
  return {
    id,
    version: 1,
    origin: id === 'write' ? 'write' : 'read',
    snapshot: () => useInputPos.getState().pos[id] ?? null,
    subscribe: (cb) => useInputPos.subscribe(cb),
    restore: (s) => {
      if (!s || typeof s !== 'object' || !s.route || typeof s.route.name !== 'string') return false;
      useInputPos.setState((st) => ({ pos: { ...st.pos, [id]: s }, pending: { ...st.pending, [id]: s } }));
      return true;
    },
    route: (s) => s.route,
    label: (s, t) => t(LABEL[id], id === 'write' ? { n: s.words ?? 0 } : { title: s.title }),
  };
}

type BlockSnap = { route: Route; run: BlockRun };

/** Block 2 der Tageseinheit: Schritt, Frage, Antworten, Durchgänge, Position. */
export const blockResumable: Resumable<BlockSnap> = {
  id: 'inputUnit',
  version: 1,
  origin: 'today',
  snapshot: () => {
    const run = useBlockRun.getState().run;
    if (!run || run.step === 'done') return null;
    const route = blockRoutes.get(run.key);
    return route ? { route, run } : null;
  },
  subscribe: (cb) => useBlockRun.subscribe(cb),
  restore: (s) => {
    if (!s?.run || typeof s.run.key !== 'string' || s.route?.name !== 'inputUnit') return false;
    blockRoutes.set(s.run.key, s.route);
    useBlockRun.setState({ run: s.run });
    return true;
  },
  route: (s) => s.route,
  label: (s, t) => t('nbLesenResumeBlock', { title: s.run.title }),
};

/** Route je Lauf (Art, Zusammenfassung) – der Bildschirm trägt sie beim Öffnen ein. */
export const blockRoutes = new Map<string, Route>();

export const INPUT_RESUMABLES = [unitResumable('read'), unitResumable('listen'), unitResumable('write'), unitResumable('discover'), blockResumable] as const;
