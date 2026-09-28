import { useMemo } from 'react';
import { useSettings } from '../../app/settings';
import legacyScenes from '../../content/legacy/scenes.json';
import fixedScenes from '../../content/speak/scenes.json';
import contextJson from '../../content/legacy/context.json';
import { useLive } from '../../data/live';
import { useCollection, useWatched } from '../../data/watch';
import { bizScenes } from '../../content/nb/load';
import { TOPICS } from '../../domain/content';
import { bizRunMarker, bizSceneDoc, isBizId } from '../../domain/speak/bizScenes';
import { mergeScenes } from '../../domain/speak/library';
import type { SceneView } from '../../domain/speak/types';

// Szenen-Bibliothek der Oberfläche (Plan §2.1): Inhalt ⊕ `scene/*` (Datenbank gewinnt). Das Abo
// auf `scene` besteht nur, solange ein Sprechen-Bildschirm eingehängt ist.

type Doc = Record<string, unknown>;

// Feste Szenen = die vier der alten App plus „Preisverhandlung“ und „Partner-Pitch“ (Kap. 6.5,
// `content/speak/scenes.json`). Beide sind Inhalt (Quelle `legacy`) und werden von `scene/<id>`
// überlagert; ein Lauf legt `scene/<id>` wie bei den alten Szenen erst beim Speichern an.
export const LEGACY_SCENES = [...(legacyScenes as unknown as Doc[]), ...(fixedScenes as unknown as Doc[])];
const EMPTY = new Set<string>();

// Neubau (N70): die 16 Business-Szenen aus P7a kommen dazu – erst beim ersten Gebrauch geparst
// (`content/nb/load.ts`, Anhang A 5c), danach im Speicher.
let contentCache: Doc[] | null = null;
export function contentScenes(): Doc[] {
  return (contentCache ??= [...LEGACY_SCENES, ...bizScenes().map(bizSceneDoc)]);
}

export function useSceneLibrary(): { scenes: SceneView[] | null } {
  const lang = useSettings((s) => s.lang);
  const db = useCollection('scene');
  const invalid = useWatched((s) => s.invalid.scene) ?? EMPTY;
  const scenes = useMemo(() => (db ? mergeScenes(contentScenes(), db, invalid, lang) : null), [db, invalid, lang]);
  return { scenes };
}

export function legacySceneDoc(id: string): Doc | null {
  return contentScenes().find((s) => s.id === id) ?? null;
}

/** Inhalt für den Lauf-Vermerk `scene/<id>`: Business-Szenen nur als Kennung (Inhalt bleibt Quelle). */
export function runMarkerFor(id: string): Doc | null {
  return isBizId(id) ? bizRunMarker(id) : legacySceneDoc(id);
}

/** Berufskontext für die Vorlagen (`app/profile.ctx`, sonst der der alten App). */
export function workContext(): string {
  const p = useLive.getState().docs['app/profile'];
  const ctx = typeof p?.ctx === 'string' ? p.ctx.trim() : '';
  return ctx || (contextJson as { defaultCtx: string }).defaultCtx;
}

/** Schwächstes Grammatikthema (nach `p`, sonst Voreinstellung p0) – für kombinierte Aufgaben. */
export function weakestTopic(lang: 'de' | 'en'): { id: string; title: string; titleEn: string } | null {
  const grammar = useLive.getState().collections.grammar ?? new Map<string, Doc>();
  let best: { t: (typeof TOPICS)[number]; p: number } | null = null;
  for (const t of TOPICS) {
    const d = grammar.get(t.id);
    const p = typeof d?.p === 'number' ? d.p : t.p0;
    if (!best || p < best.p) best = { t, p };
  }
  if (!best) return null;
  const titleEn = best.t.name_en ?? best.t.name;
  return { id: best.t.id, title: lang === 'de' ? best.t.name : titleEn, titleEn };
}

/** Bis zu 8 fällige Wörter (älteste Fälligkeit zuerst). */
export function dueWords(nowMs: number, max = 8): string[] {
  const vocab = useLive.getState().collections.vocab ?? new Map<string, Doc>();
  return [...vocab.values()]
    .filter((d) => d.hidden !== true && typeof d.word === 'string' && typeof d.due === 'number' && d.due > 0 && d.due <= nowMs)
    .sort((a, b) => (a.due as number) - (b.due as number))
    .slice(0, max)
    .map((d) => String(d.word).replace(/^to\s+/, ''));
}
