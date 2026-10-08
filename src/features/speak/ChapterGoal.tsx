import { useState } from 'react';
import { useT } from '../../i18n';
import type { ChapterTalk } from '../../domain/speak/chapterTalk';
import { Icon } from '../../ui/Icon';

// Kapitelziel im Rollenspiel (Lernplattform 3.0 P51): „In diesem Gespräch: 2 × A, 1 × B“ im Szenenstart und, mit Stand aus den Treffern der Analyse
// (`used` von turn-analysis@3), im Zielkasten des Gesprächs. Freiwillig: es zählt nicht zum Tagesziel und ist nie ein Vorwurf.

type Props = {
  talk: ChapterTalk;
  /** Stand je Zielmuster (im Gespräch); ohne ihn nur die Zeile (Szenenstart). */
  progress?: ReadonlyArray<{ id: string; need: number; have: number }>;
  /** Handy nach dem ersten Zug (R5): nur eine aufklappbare Zeile „Kapitelziel 0/3 ›“. */
  compact?: boolean;
  testId?: string;
};

export function ChapterGoal({ talk, progress, compact = false, testId = 'rp-chapter-goal' }: Props) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const nameOf = (id: string): string => {
    const p = talk.pats.find((x) => x.id === id);
    return p ? (lang === 'en' ? p.en : p.de) : id;
  };
  const reached = !!progress && progress.length > 0 && progress.every((p) => p.have >= p.need);
  const state = reached ? 'reached' : progress ? 'open' : 'brief';

  // Szenenstart: Satz „In diesem Gespräch: …“ mit Grund.
  if (!progress) {
    const line = talk.goal.map((g) => t('ttTkGoalItem', { n: g.need, name: nameOf(g.id) })).join(', ');
    return (
      <div data-testid={testId} data-state={state} className="flex flex-col gap-1 text-sm">
        <p className="lx-eyebrow">{t('ttTkGoalLabel')}</p>
        <p>{t('ttTkGoalLine', { list: line })}</p>
        <p className="text-muted">{t('ttTkGoalWhy', { n: talk.ch, chapter: lang === 'en' ? talk.name.en : talk.name.de })}</p>
      </div>
    );
  }

  // Im Gespräch: nur die Liste mit Stand (R5: der Satz stünde doppelt). Am Handy nach dem ersten Zug eingeklappt.
  const have = progress.reduce((n, p) => n + Math.min(p.have, p.need), 0);
  const need = progress.reduce((n, p) => n + p.need, 0);
  const showList = !compact || open;
  return (
    <div data-testid={testId} data-state={state} data-compact={compact ? '' : undefined} className="flex flex-col gap-1 text-sm">
      {compact ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="lx-hit -mx-1 inline-flex items-center gap-1.5 self-start rounded-full px-1 text-xs font-medium text-muted hover:text-fg"
          data-testid="rp-chapter-goal-toggle"
        >
          <Icon name={reached ? 'check' : 'target'} size={14} />
          <span className="lx-tnum">{t('ttTkGoalShort', { have, need })}</span>
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} />
        </button>
      ) : (
        <p className="lx-eyebrow">{t('ttTkGoalLabel')}</p>
      )}
      {showList && (
        <ul className="flex flex-col gap-0.5">
          {progress.map((p) => (
            <li key={p.id} data-testid="rp-chapter-goal-item" data-have={p.have} data-need={p.need} className="flex items-center gap-1.5 text-muted">
              <Icon name={p.have >= p.need ? 'check' : 'target'} size={14} />
              {t('ttTkGoalHave', { name: nameOf(p.id), have: p.have, need: p.need })}
            </li>
          ))}
        </ul>
      )}
      {reached && showList && <p className="font-semibold text-accent-text">{t('ttTkGoalReached')}</p>}
    </div>
  );
}
