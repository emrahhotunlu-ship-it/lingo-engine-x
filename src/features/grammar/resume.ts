import type { Resumable } from '../../app/resume';
import type { RouteOf } from '../../app/router/types';
import { ensureWith } from './resumeKit';
import { grammarSnapshot, restoreGrammar, startGrammar, useGrammarSession, type GrammarSnap } from './session';

// Fortsetzen der Grammatik-Runde (plan.md G3, §4.3 Muss 2): gleiche Aufgabe nach dem Neuladen.

export const grammarResume: Resumable<GrammarSnap> = {
  // Version 2 (Lernplattform 2.0): `intro` ist ein Objekt (Vortest, Karten), dazu Profil, Planversion und Musterstand. Ältere Stände (1) werden nicht mehr gelesen,
  // und eine ältere App-Version liest die neuen nicht (Rückweg).
  id: 'grammarSession',
  version: 2,
  origin: 'learn',
  snapshot: grammarSnapshot,
  subscribe: (cb) => useGrammarSession.subscribe(cb),
  restore: restoreGrammar,
  route: (s) => ({ name: 'grammarSession', mode: s.mode, ...(s.topic ? { topic: s.topic } : {}) }),
  label: (s, t) => t('nbLernenResumeGrammar', { n: Math.min(s.pos + 1, s.tasks.length), total: s.tasks.length }),
};

/** `ensure`: aktiv, sonst hergestellt, sonst eine neue Runde derselben Art. */
export function ensureGrammar(route: RouteOf<'grammarSession'>): boolean {
  return ensureWith(
    grammarResume,
    () => useGrammarSession.getState().active,
    () => {
      startGrammar({ mode: route.mode, topic: route.topic ?? null });
      return useGrammarSession.getState().tasks.length > 0;
    },
  );
}
