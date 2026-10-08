import { useT } from '../../i18n';
import type { ChapterTalk } from '../../domain/speak/chapterTalk';
import { Icon } from '../../ui/Icon';

// Kapitelziel im Rollenspiel (Lernplattform 3.0 P51): „In diesem Gespräch: 2 × A, 1 × B“ im Szenenstart und, mit Stand aus den Treffern der Analyse
// (`used` von turn-analysis@3), im Zielkasten des Gesprächs. Freiwillig: es zählt nicht zum Tagesziel und ist nie ein Vorwurf.

type Props = {
  talk: ChapterTalk;
  /** Stand je Zielmuster (im Gespräch); ohne ihn nur die Zeile (Szenenstart). */
  progress?: ReadonlyArray<{ id: string; need: number; have: number }>;
  testId?: string;
};

export function ChapterGoal({ talk, progress, testId = 'rp-chapter-goal' }: Props) {
  const { t, lang } = useT();
  const nameOf = (id: string): string => {
    const p = talk.pats.find((x) => x.id === id);
    return p ? (lang === 'en' ? p.en : p.de) : id;
  };
  const line = talk.goal.map((g) => t('ttTkGoalItem', { n: g.need, name: nameOf(g.id) })).join(', ');
  const reached = !!progress && progress.length > 0 && progress.every((p) => p.have >= p.need);
  return (
    <div data-testid={testId} data-state={reached ? 'reached' : progress ? 'open' : 'brief'} className="flex flex-col gap-1 text-sm">
      <p className="lx-eyebrow">{t('ttTkGoalLabel')}</p>
      <p>{t('ttTkGoalLine', { list: line })}</p>
      {!progress && <p className="text-muted">{t('ttTkGoalWhy', { n: talk.ch, chapter: lang === 'en' ? talk.name.en : talk.name.de })}</p>}
      {progress && (
        <ul className="flex flex-col gap-0.5">
          {progress.map((p) => (
            <li key={p.id} data-testid="rp-chapter-goal-item" data-have={p.have} data-need={p.need} className="flex items-center gap-1.5 text-muted">
              <Icon name={p.have >= p.need ? 'check' : 'target'} size={14} />
              {t('ttTkGoalHave', { name: nameOf(p.id), have: p.have, need: p.need })}
            </li>
          ))}
        </ul>
      )}
      {reached && <p className="font-semibold text-accent-text">{t('ttTkGoalReached')}</p>}
    </div>
  );
}
