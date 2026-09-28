import { useMemo } from 'react';
import { useClock } from '../../../app/clock';
import { prefsOp, type ReviewModePref } from '../../../domain/srs/decks';
import type { FlipDir } from '../../../domain/srs/flip';
import { vocabStatistics } from '../../../domain/srs/retention';
import { useT } from '../../../i18n';
import { Segmented } from '../../../ui/Segmented';
import { toast } from '../../../ui/Toast';
import { useDecks, writeDecks } from '../decksStore';
import { useVocabCards } from './data';
import { decksErrorKey } from './errors';

// Einstellungs-Abschnitt „Wortschatz“ (N30) und Abschnitt „Wortschatz-Statistik“ (N27, Platz `stand`).

export function VocabSettingsSection() {
  const { t } = useT();
  const prefs = useDecks((s) => s.decks.prefs);
  const save = (p: { mode?: ReviewModePref; dir?: FlipDir; grades?: 4 | 2 }) =>
    void writeDecks((cur) => prefsOp(cur, p)).then((r) => {
      if (!r.ok) toast(t(decksErrorKey(r.error)), 'error');
    });
  return (
    <section className="flex flex-col gap-4" data-testid="set-vocab">
      <h3 className="lx-eyebrow">{t('nbWsSetTitle')}</h3>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t('nbWsSetMode')}</p>
        <Segmented<ReviewModePref>
          label={t('nbWsSetMode')}
          value={prefs.mode ?? 'auto'}
          options={[
            { value: 'auto', label: t('nbWsSetModeAuto') },
            { value: 'flip', label: t('nbWsSetModeFlip') },
            { value: 'type', label: t('nbWsSetModeType') },
          ]}
          onChange={(mode) => save({ mode })}
          testId="set-vocab-mode"
        />
        <p className="text-xs text-muted">{t('nbWsSetModeHint')}</p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t('nbWsSetDir')}</p>
        <Segmented<FlipDir>
          label={t('nbWsSetDir')}
          value={prefs.dir ?? 'de-en'}
          options={[
            { value: 'de-en', label: t('nbWsDirDeEn') },
            { value: 'en-de', label: t('nbWsDirEnDe') },
            { value: 'mix', label: t('nbWsDirMix') },
          ]}
          onChange={(dir) => save({ dir })}
          testId="set-vocab-dir"
        />
        <p className="text-xs text-muted">{t('nbWsSetDirHint')}</p>
      </div>
      <div className="flex max-w-xs flex-col gap-2">
        <p className="text-sm font-medium">{t('nbWsSetGrades')}</p>
        <Segmented<'4' | '2'>
          label={t('nbWsSetGrades')}
          value={prefs.grades === 2 ? '2' : '4'}
          options={[
            { value: '4', label: t('nbWsSetGrades4') },
            { value: '2', label: t('nbWsSetGrades2') },
          ]}
          onChange={(g) => save({ grades: g === '2' ? 2 : 4 })}
          testId="set-vocab-grades"
        />
      </div>
    </section>
  );
}

export function VocabStatsSection() {
  const { t, lang } = useT();
  const now = useClock((s) => s.now);
  const cards = useVocabCards();
  const s = useMemo(() => vocabStatistics(cards, now), [cards, now]);
  const pct = s.retention === null ? '–' : `${Math.round(s.retention * 100)} %`;
  const num = (n: number) => n.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US');
  const cell = (label: string, value: string, testId: string, sub?: string) => (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-surface p-3" data-testid={testId}>
      <span className="text-xs text-muted">{label}</span>
      <span className="lx-tnum text-lg font-semibold">{value}</span>
      {sub && <span className="text-xs text-subtle">{sub}</span>}
    </div>
  );
  return (
    <section className="flex flex-col gap-3" data-testid="ws-stats">
      <h2 className="lx-eyebrow">{t('nbWsStatsTitle')}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cell(t('nbWsRetention'), pct, 'ws-stat-retention', t('nbWsAnswers', { n: s.answers }))}
        {cell(t('nbWsMedianS'), s.medianStability === null ? '–' : t('nbWsDaysN', { n: s.medianStability }), 'ws-stat-median')}
        {cell(t('nbWsSure'), num(s.sure), 'ws-stat-sure')}
        {cell(t('nbWsStateMatureL'), num(s.byState.mature), 'ws-stat-mature')}
      </div>
      <dl className="lx-tnum flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted" data-testid="ws-stat-states">
        {(
          [
            ['nbWsStateNewL', s.byState.new],
            ['nbWsStateLearnL', s.byState.learning],
            ['nbWsStateYoungL', s.byState.young],
            ['nbWsStateMatureL', s.byState.mature],
          ] as const
        ).map(([k, n]) => (
          <div key={k} className="flex gap-1">
            <dt>{t(k)}</dt>
            <dd className="font-medium text-fg">{num(n)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
