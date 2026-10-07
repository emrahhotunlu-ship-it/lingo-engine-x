import { patternById, patternsOf, topicsWithPatterns } from '../grammar/patterns';
import { chapters } from '../grammar/patterns';
import type { CheckCtx } from './kinds/common';

// Prüfkontext mit den echten Mustern der App (importiert die LP2-Musterdateien; die reine Prüfung selbst bleibt in `checkContent.ts`).

/** Die 47 Themen: die 39 Themen des Grammatik-Pfads plus die acht neuen (K-24). Solange die neuen Themen noch keine Musterdatei haben, erlaubt die Prüfung sie trotzdem. */
export const NEW_TOPICS = ['inversion', 'emph-plus', 'ellipsis', 'modals-prob', 'stative-adv', 'future-past', 'noun-phrase', 'quant-neg'] as const;

export function defaultCheckCtx(): CheckCtx {
  const known = new Set<string>([...chapters().flatMap((c) => c.topics), ...topicsWithPatterns(), ...NEW_TOPICS]);
  return {
    topicKnown: (t) => known.has(t),
    patternTopic: (pat, topic) => {
      // Thema ohne Musterdatei (z. B. eines der acht neuen vor P36/P37): nicht prüfbar.
      if (!topic || !patternsOf(topic)) return undefined;
      const p = patternById(`${topic}:${pat}`);
      return p ? p.topic : null;
    },
  };
}
