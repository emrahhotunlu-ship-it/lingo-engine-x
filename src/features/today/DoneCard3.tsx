import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useT } from '../../i18n';
import { useLive } from '../../data/live';
import { streakWeek, weekGoal } from '../../domain/metrics';
import { comebackGap } from '../../domain/plan/comeback';
import type { WeekDay } from '../../domain/streak';
import { logWarn } from '../../platform/diagnostics';
import { Icon } from '../../ui/Icon';
import { SegmentRing } from '../../ui/ProgressRing';
import { WeekStrip } from '../progress/StandHeader';
import { bigGain, patternGains } from './doneCard';
import { useDoneFacts } from './doneFacts';
import { footParts, footText } from './goalLine';
import type { TodayView } from './state';

// Abschlusskarte Heute 3.0 (Lernplattform 3.0 P27, Motivation §4.8, §4.10): Ring, EINE große Zahl tatsächlich Gefestigten und höchstens vier Zeilen
// in fester Reihenfolge: 1 Wahrheitszeile · 2 Meilenstein ODER nächstes Ziel · 3 „Morgen …“ · 4 Wochenstreifen mit „Serie 12 · Woche 4 von 6“.
// Am ersten Tag nach einer Pause von mindestens 3 Lerntagen heißt die Überschrift „Erster Tag zurück“. Ein Zustand, kein Knopf, kein Konfetti.
// Jede Zahl kommt aus den Selektoren (`domain/metrics`); die Serienregel selbst bleibt unberührt.

/** Pause in Lerntagen, ab der der erste Tag danach „Erster Tag zurück“ heißt. */
export const BACK_GAP = 3;

const EMPTY = new Map<string, Record<string, unknown>>();

/** Serie, Wochenstreifen und Fußzeile aus denselben Dokumenten wie überall (`streakWeek`, `weekGoal`). */
export function useStreakWeek(): { week: WeekDay[]; foot: string | null } {
  const { t } = useT();
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const profile = useLive((s) => s.docs['app/profile']);
  const schema = useLive((s) => s.docs['app/schema']);
  const archive = useLive((s) => s.collections.archive) ?? EMPTY;
  return useMemo(() => {
    if (!profile) return { week: [], foot: null };
    try {
      const r = streakWeek({ nowMs: now, profile, schema, archives: archive.values(), today });
      const parts = footParts({ streak: r.streak.count, goal: weekGoal(r.week) });
      return { week: r.week, foot: parts ? footText(parts, t) : null };
    } catch (err) {
      logWarn('today:week', err);
      return { week: [], foot: null };
    }
  }, [profile, schema, archive, today, now, t]);
}

/** Fuß der Tageskarte: „Serie 12 · Woche 4 von 6“, die einzige Stelle dieser Art auf Heute (nie „Serie 0“). */
export function StreakFoot() {
  const { foot } = useStreakWeek();
  if (!foot) return null;
  return (
    <p className="lx-tnum text-xs text-muted" data-testid="today-streak">
      {foot}
    </p>
  );
}

export function DoneCard3({ view, tomorrow, today }: { view: TodayView; tomorrow: string; today: string }) {
  const { t, lang } = useT();
  const facts = useDoneFacts(view, true);
  const grammar = useLive((s) => s.collections.grammar);
  const profile = useLive((s) => s.docs['app/profile']);
  const { week, foot } = useStreakWeek();
  const blocks = view.duties.total;
  const gains = useMemo(() => patternGains({ ps: view.plan?.u?.ps, grammarDocs: grammar ?? new Map(), today, lang }), [view.plan, grammar, today, lang]);
  const big = bigGain({ wordsSure: facts.sure, patterns: gains.count });
  const gap = useMemo(() => comebackGap(profile ?? null, today), [profile, today]);
  const back = gap !== null && gap >= BACK_GAP;
  // Zeile 1: Wahrheitszeile, nur echte Zustandswechsel.
  const truth = [
    gains.names.length > 0 ? t('hxDoneNewSafe', { names: gains.names.join(' + ') }) : null,
    facts.fixed !== null && facts.fixed > 0 ? t('hxDoneFixed', { n: facts.fixed }) : null,
    facts.over !== null ? t('nbHeuteTruthOver', { n: facts.over }) : null,
  ].filter((x): x is string => x !== null);
  // Zeile 2: entweder der Meilenstein-Satz oder das nächste Ziel, nie beides.
  const ms = facts.milestone;
  const msText = ms ? (ms.id.startsWith('fest') ? t('nbHeuteMsFest', { n: ms.n ?? 0 }) : ms.id === 'topic1' ? t('nbHeuteMsTopic') : ms.id === 'fix10' ? t('nbHeuteMsFix', { n: ms.n ?? 0 }) : t('nbHeuteMsOver')) : null;
  const goalText = !msText && facts.goal ? t(facts.goal.key, facts.goal.params) : null;
  return (
    <section className="lx-card flex flex-col gap-3.5 p-[1.125rem]" data-testid="today-card" data-done="true" data-back={back ? 'true' : undefined} aria-labelledby="td-done-title">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="lx-eyebrow text-ok-text">
          <span aria-hidden="true">✓ </span>
          <span data-testid="today-status" data-status={view.status} data-done={view.duties.done} data-total={view.duties.total}>
            {back ? t('moBackTitle') : t('nbHeuteDoneTitle')}
          </span>
        </p>
        <span className="relative inline-flex" style={{ filter: 'drop-shadow(0 0 28px var(--lx-ok-soft))' }}>
          <SegmentRing segments={Math.max(1, blocks)} done={blocks} size={168} stroke={12} label={t('nbHeuteRingLabel', { done: blocks, total: blocks })}>
            <Icon name="check" size={72} />
          </SegmentRing>
        </span>
        <h2 id="td-done-title" className="lx-tnum text-4xl leading-none font-semibold tracking-tight text-balance" data-testid="balance" data-kind={big?.kind ?? 'steps'}>
          {big ? t(big.kind === 'words' ? 'hxDoneBigWords' : 'hxDoneBigPatterns', { n: big.n }) : t('nbHeuteDoneSteps', { blocks })}
        </h2>
      </div>
      {truth.length > 0 && (
        <p className="lx-tnum text-sm text-muted" data-testid="today-truth">
          {truth.join(' · ')}
        </p>
      )}
      {msText && (
        <p className="text-sm font-medium" data-testid="today-milestone" data-id={ms?.id}>
          {msText}
        </p>
      )}
      {goalText && (
        <p className="lx-tnum text-sm text-muted" data-testid="today-goal" data-id={view.plan?.u?.nx}>
          {goalText}
        </p>
      )}
      {tomorrow && (
        <p className="text-sm text-muted" data-testid="today-tomorrow">
          {tomorrow}
        </p>
      )}
      {week.length > 0 ? <WeekStrip week={week} {...(foot ? { summary: { text: foot, testId: 'today-streak' } } : { summary: { text: '' } })} /> : foot && (
        <p className="lx-tnum text-xs text-muted" data-testid="today-streak">
          {foot}
        </p>
      )}
    </section>
  );
}
