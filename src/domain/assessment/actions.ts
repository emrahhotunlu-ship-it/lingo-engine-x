import { TOPICS } from '../content';

// Erlaubte „Üben"-Aktionen der Einschätzung (Plan §4.6) und ihre Kanäle im Tagesplan.
// Nur Aktionen mit einem Ziel in der App stehen in der Liste (features/progress/actionRoute.ts);
// die KI darf nur daraus wählen (zod), sonst gäbe es einen Knopf ins Leere.

export const FIXED_ACTIONS = ['vocab:review', 'vocab:leech', 'chunks', 'cloze', 'order'] as const;

const TOPIC_IDS: ReadonlySet<string> = new Set(TOPICS.map((t) => t.id));

/** Gehört die Aktion zum festen Katalog (ohne Blick auf die Daten)? */
export function isKnownAction(a: string): boolean {
  if ((FIXED_ACTIONS as readonly string[]).includes(a)) return true;
  const m = /^(grammar|errors|lesson):(.+)$/.exec(a);
  if (!m) return false;
  if (m[1] === 'lesson') return /^l\d{2}$/.test(m[2] ?? '');
  return TOPIC_IDS.has(m[2] ?? '');
}

/**
 * Aktionen für die Vorlage: alle Grammatikthemen, Fehlerwiederholung nur für Themen mit offenen
 * Fehlersätzen, die nächste Lektion (falls vorhanden) und der feste Katalog.
 */
export function allowedActions(i: { errorTopics: readonly string[]; nextLesson: string | null }): string[] {
  const out = TOPICS.map((t) => `grammar:${t.id}`);
  for (const t of i.errorTopics) if (TOPIC_IDS.has(t)) out.push(`errors:${t}`);
  if (i.nextLesson) out.push(`lesson:${i.nextLesson}`);
  out.push(...FIXED_ACTIONS);
  return [...new Set(out)];
}

/** Kanäle des Tagesplans, auf die ein Fokus wirkt (Plan §4.6, `focusChannels`). */
export function focusChannels(action: string | null): string[] {
  if (!action) return [];
  if (action.startsWith('grammar:') || action.startsWith('errors:')) return ['gram', 'order'];
  if (action.startsWith('vocab:') || action === 'chunks') return ['vocab', 'cloze'];
  if (action.startsWith('speak')) return ['speak'];
  if (action === 'write') return ['write'];
  if (action === 'listen' || action === 'dictate') return ['listen', 'dictate'];
  if (action === 'read' || action === 'discover') return ['read', 'discover'];
  if (action.startsWith('business:')) return ['speak', 'write'];
  if (action === 'cloze') return ['cloze'];
  if (action === 'order') return ['order'];
  if (action === 'sprint') return ['sprint'];
  return [];
}

/** Grammatikthema einer Aktion (`grammar:x`/`errors:x`) oder `null`. */
export function actionTopic(action: string | null): string | null {
  const m = action ? /^(?:grammar|errors):(.+)$/.exec(action) : null;
  return m?.[1] && TOPIC_IDS.has(m[1]) ? m[1] : null;
}
