import type { Feedback } from '../../ui/feedback/types';
import { fixesOf, type Correction } from './unitResult';

// Einheitliche Rückmeldung (N05/N74) für Sag es, 90/60/45, Tonlagen und Pitch: die vorhandenen
// KI-Ausgaben werden auf `Feedback` abgebildet (keine Vorlage geändert). Rein und getestet.
// Wirkung in einem Satz · ≤ 3 Korrekturen (Falle vor Form) · Verbesserungen · „Nochmal, aber besser“.

export function feedbackOf(o: { effect: string; corrections: readonly Correction[]; upgrades?: ReadonlyArray<{ from?: string; to: string; why?: string }>; again?: () => void }): Feedback {
  const fixes = fixesOf(o.corrections);
  return {
    verdict: fixes.length ? 'close' : 'ok',
    ...(o.effect.trim() ? { effect: o.effect.trim() } : {}),
    fixes,
    ...(o.upgrades?.length ? { upgrades: o.upgrades.map((u) => ({ to: u.to, ...(u.from ? { from: u.from } : {}), ...(u.why ? { note: u.why } : {}) })) } : {}),
    ...(o.again ? { again: o.again } : {}),
  };
}
