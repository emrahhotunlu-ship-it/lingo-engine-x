import { useT } from '../i18n';
import { Button } from '../ui/Button';
import { go } from '../app/route';
import { useCoach } from '../coach/store';
import { levelHistory, writingEntries } from '../coach/writing';

// Fahrplan-Baustein zur Säule Ausdruck (docs/neustart.md §7): schlichte Anzeige, wie viele Texte
// Emrah geschrieben hat und wie Claude das Niveau der letzten fünf geschätzt hat.

export function PlanWriting() {
  const { t, tn } = useT();
  const writing = useCoach((s) => s.writing);
  const count = writingEntries(writing).length;
  const levels = levelHistory(writing, 5);
  return (
    <section className="mt-5 rounded-[var(--radius-card)] border border-line/70 p-5" data-testid="plan-writing">
      <h2 className="text-sm font-semibold">{t('schWriteCardTitle')}</h2>
      <p className="mt-1.5 text-sm text-muted" data-testid="plan-writing-count">
        {count === 0 ? t('schWriteNone') : tn('schWriteCount', count)}
      </p>
      {levels.length > 0 && (
        <p className="mt-1 text-sm" data-testid="plan-writing-levels">
          {t('schWriteLevels', { list: levels.join(' → ') })}
        </p>
      )}
      <div className="mt-3">
        <Button variant="secondary" icon="edit" onClick={() => go({ name: 'write' })} data-testid="plan-write-start">
          {t('schWriteStart')}
        </Button>
      </div>
    </section>
  );
}
