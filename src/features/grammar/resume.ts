import type { Resumable } from '../../app/resume';
import type { RouteOf } from '../../app/router/types';
import { ensureWith } from './resumeKit';
import { grammarSnapshot, restoreGrammar, startGrammar, useGrammarSession, type GrammarSnap } from './session';

// Fortsetzen der Grammatik-Runde (plan.md G3, §4.3 Muss 2): gleiche Aufgabe nach dem Neuladen.

export const grammarResume: Resumable<GrammarSnap> = {
  id: 'grammarSession',
  version: 1,
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
