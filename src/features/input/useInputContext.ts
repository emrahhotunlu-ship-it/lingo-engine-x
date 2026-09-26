import { useClock } from '../../app/clock';
import { useSettings } from '../../app/settings';
import { useLive } from '../../data/live';
import { targetLevel } from '../../domain/input/level';
import { domainTarget } from '../../domain/input/mix';
import type { Cefr, Domain } from '../../domain/input/types';
import contextJson from '../../content/legacy/context.json';

// Gemeinsamer Rahmen der Einheiten: Lerntag, Zielniveau (i+1), Beruf/Alltag, Sprache und der
// allgemeine Berufskontext für die Vorlagen (ohne persönliche Daten; ein eigener Kontext aus
// `app/profile.ctx` hat Vorrang, M22).

export type InputContext = { day: string; target: Cefr; domain: Domain; lang: 'de' | 'en'; context: string };

export function useInputContext(): InputContext {
  const day = useClock((s) => s.today);
  const lang = useSettings((s) => s.lang);
  const assess = useLive((s) => s.docs['app/assess']);
  const profile = useLive((s) => s.docs['app/profile']);
  const ctx = typeof profile?.ctx === 'string' && profile.ctx.trim() ? profile.ctx.trim() : contextJson.defaultCtx;
  return { day, target: targetLevel(assess), domain: domainTarget(profile?.mix), lang, context: ctx };
}
