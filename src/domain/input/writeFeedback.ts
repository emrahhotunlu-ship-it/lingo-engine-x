import { matchTrap } from '../week/traps';
import type { Feedback, Fix } from '../../ui/feedback/types';
import type { WritingErrorView, WritingResView } from './writingRecord';

// Schreibwerkstatt im Einheitsstil (Neubau N55): die vorhandene KI-Rückmeldung (`writing-review`)
// wird auf das gemeinsame `Feedback` abgebildet – ohne neue Vorlage. Kategorien wie DeepL Write /
// Grammarly: Fehler · Natürlicher · Ton. Deutsch-Fallen stehen vorn (Abgleich mit dem
// Fallen-Startsatz, `matchTrap`), das Niveau erscheint nur als Satz.

export type WriteCat = 'error' | 'natural' | 'tone';

const NATURAL = new Set(['collocation', 'word-order', 'coherence']);

export function catOf(cat: string): WriteCat {
  if (cat === 'register') return 'tone';
  return NATURAL.has(cat) ? 'natural' : 'error';
}

/** Anzahl je Kategorie; Aufwertungen zählen als „Natürlicher“. */
export function categoryCounts(errors: readonly Pick<WritingErrorView, 'cat'>[], upgrades: readonly string[] = []): Record<WriteCat, number> {
  const out: Record<WriteCat, number> = { error: 0, natural: upgrades.length, tone: 0 };
  for (const e of errors) out[catOf(e.cat)]++;
  return out;
}

/** Eine Fehlerstelle als Korrektur: Falle vor Bedeutung vor Form (FeedbackPanel sortiert und kappt). */
export function fixOf(e: WritingErrorView): Fix {
  const trap = matchTrap(e.orig);
  if (trap) return { kind: 'trap', mine: e.orig, right: e.fix, why: e.why, trapId: trap.id };
  const meaning = e.sev === 'major' && (e.cat === 'vocabulary' || e.cat === 'coherence' || e.cat === 'grammar');
  return { kind: meaning ? 'meaning' : 'form', mine: e.orig, right: e.fix, why: e.why };
}

export function writingFeedback(res: Pick<WritingResView, 'errors' | 'upgrades' | 'summary'>, effect?: string): Feedback {
  const fixes = res.errors.map(fixOf);
  const verdict: Feedback['verdict'] = !fixes.length ? 'ok' : res.errors.some((e) => e.sev === 'major') ? 'wrong' : 'close';
  const fb: Feedback = { verdict, fixes, upgrades: res.upgrades.map((to) => ({ to })) };
  const eff = effect ?? res.summary;
  if (eff) fb.effect = eff;
  return fb;
}
