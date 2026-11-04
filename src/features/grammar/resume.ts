import type { Resumable } from '../../app/resume';
import type { RouteOf } from '../../app/router/types';
import { useClock } from '../../app/clock';
import { ensureWith, freshSnapshot } from './resumeKit';
import { grammarSnapshot, restoreGrammar, startGrammar, useGrammarSession, type GrammarSnap, type StartOpts } from './session';

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

/**
 * Wiedereinstieg statt Neustart (Emrah 04.11.2026: „rausgehen, wieder rein – muss von vorne anfangen“). Läuft schon eine Runde derselben
 * Art (Pflicht: jede Runde des Pflichtschritts, auch eine im Reiter begonnene; Thema: dasselbe Thema) vom selben Lerntag, geht es dort weiter;
 * sonst aus der heutigen Momentaufnahme; erst sonst eine neue Runde. Themen-Test, c1x-Runden und fertig gebaute Aufgaben starten immer neu.
 */
export function resumeOrStartGrammar(o: StartOpts): { first: 'typed' | 'choice' | null | 'resumed'; route: RouteOf<'grammarSession'> } {
  const day = o.day ?? useClock.getState().today;
  const fresh = !!o.test || !!o.kind || !!o.tasks?.length;
  const fits = (x: Pick<GrammarSnap, 'status' | 'day' | 'mode' | 'topic' | 'ctx'>): boolean =>
    !fresh && x.status === 'running' && x.day === day && (o.mode === 'duty' ? x.ctx === 'duty' : x.mode === o.mode && (x.topic ?? null) === (o.topic ?? null));
  const routeOf = (x: Pick<GrammarSnap, 'mode' | 'topic'>): RouteOf<'grammarSession'> => ({ name: 'grammarSession', mode: x.mode, ...(x.topic ? { topic: x.topic } : {}) });
  const s = useGrammarSession.getState();
  if (s.active && s.tasks.length && s.pos < s.tasks.length && fits(s)) return { first: 'resumed', route: routeOf(s) };
  const snap = freshSnapshot<GrammarSnap>(grammarResume);
  if (snap && fits(snap) && restoreGrammar(snap)) return { first: 'resumed', route: routeOf(snap) };
  const first = startGrammar(o);
  return { first, route: { name: 'grammarSession', mode: o.mode, ...(o.topic ? { topic: o.topic } : {}) } };
}
