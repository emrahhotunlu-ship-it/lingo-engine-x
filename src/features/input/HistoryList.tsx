import { useState, type ReactNode } from 'react';
import { useT } from '../../i18n';
import { Icon } from '../../ui/Icon';

// Verlauf (Plan §4.3 Nr. 7, Kap. 14 „alle bisherigen Daten sichtbar"): frühere Ergebnisse nur
// lesbar, neueste zuerst. Ein Eintrag klappt auf; Erledigtes ist Zustand, kein Knopf zum Wiederholen.

export type HistoryEntry = { id: string; title: string; meta: string; badge?: string | null; body: () => ReactNode };

export function HistoryList({ entries, label }: { entries: readonly HistoryEntry[]; label: string }) {
  const { t } = useT();
  const [open, setOpen] = useState<string | null>(null);
  if (!entries.length) {
    return (
      <p className="text-sm text-muted" data-testid="history-empty">
        {t('inHistoryEmpty')}
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-2" aria-label={label} data-testid="history">
      {entries.map((e) => {
        const isOpen = open === e.id;
        return (
          <li key={e.id} className="lx-glass rounded-[var(--radius-card)]" data-testid="history-item" data-id={e.id}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : e.id)}
              className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{e.title}</span>
                <span className="lx-tnum text-xs text-muted">
                  {e.meta}
                  {e.badge ? ` · ${e.badge}` : ''}
                </span>
              </span>
              <Icon name="chevronDown" size={18} className={`flex-none text-subtle transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <div className="flex flex-col gap-3 border-t border-line px-4 py-4">{e.body()}</div>}
          </li>
        );
      })}
    </ol>
  );
}
