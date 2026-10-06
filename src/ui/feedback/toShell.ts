import type { ExplainLine, ExplanationModel, ResultVerdict } from '../../domain/explain/types';
import type { ShellFeedback } from '../exercise';
import { topFixes, topUpgrades, type Feedback } from './types';

// Adapter (Lernplattform 2.0 §4.5): bildet die gemeinsame Rückmeldung (`Feedback`) auf das Gerüst ab, ohne eigene
// Karte („keine Karte in der Karte“). Bestehende Bildschirme zeichnen `FeedbackPanel` weiter, bis P5/P6/P8 sie auf
// `ExerciseShell` umstellen; neue Bildschirme geben `feedbackFromFixes(fb)` an `ExerciseShell.feedback`.

const VERDICT: Record<Feedback['verdict'], ResultVerdict> = { ok: 'ok', close: 'near', wrong: 'wrong', unchecked: 'unchecked' };

export function feedbackFromFixes(fb: Feedback, extra: Partial<Pick<ShellFeedback, 'menu' | 'nextIn' | 'auto'>> = {}): ShellFeedback {
  const lines: ExplainLine[] = [];
  if (fb.effect) lines.push({ k: 'why', text: fb.effect });
  for (const f of topFixes(fb.fixes)) lines.push({ k: 'mistake', bad: f.mine, good: f.right, cause: f.why || null });
  for (const u of topUpgrades(fb.upgrades)) lines.push({ k: 'note', text: u.note ? `${u.to} – ${u.note}` : u.to });
  const explanation: ExplanationModel | null = lines.length ? { lines, examples: [], mark: [], ai: false, source: 'fallback' } : null;
  return { verdict: VERDICT[fb.verdict], depth: 'full', explanation, ...extra };
}
