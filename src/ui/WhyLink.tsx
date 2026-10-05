import { useAiAvailable } from '../ai/scope';
import { openCompanion } from '../features/companion/store';
import { useT } from '../i18n';
import { Icon } from './Icon';

// „Warum?“ aus jeder Rückmeldung (N07): ein Tipp öffnet das Claude-Blatt auf „Fragen“ mit der
// fertigen Frage (Aufgabe, Antwort, Lösung). Ohne KI unsichtbar. Das Claude-Blatt selbst (Chips
// „Noch ein Beispiel · …“) gehört P6; hier nur der Link.

export function WhyLink({ question, testId = 'feedback-why' }: { question: string; testId?: string }) {
  const { t } = useT();
  const ai = useAiAvailable();
  if (!ai || !question.trim()) return null;
  return (
    <button
      type="button"
      onClick={() => openCompanion({ tab: 'chat', text: question })}
      className="lx-hit inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-2 text-sm font-semibold text-accent-text hover:bg-surface"
      data-testid={testId}
      data-ai=""
    >
      <Icon name="sparkle" size={16} />
      {t('nbShFbWhy')}
    </button>
  );
}

/** Die Frage für „Warum?“ aus Aufgabe, Antwort und Lösung (in der Oberflächensprache). */
export function whyQuestion(t: (k: 'nbShWhyQ', v: Record<string, string>) => string, parts: { task?: string; mine?: string; solution?: string }): string {
  return t('nbShWhyQ', { task: parts.task ?? '–', mine: parts.mine ?? '–', solution: parts.solution ?? '–' });
}
