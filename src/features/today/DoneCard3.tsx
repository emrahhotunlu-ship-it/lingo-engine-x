import { useEffect, useMemo, useRef, useState } from 'react';
import { emit } from '../../engine/fx';
import { startMoment } from '../../engine/fx/measure';
import { useClock } from '../../app/clock';
import { chapterById } from '../../domain/c1/chapters';
import { levelUpFor } from '../../domain/moments/detect';
import { offerLevelUp } from '../../ui/moments/store';
import { useT } from '../../i18n';
import { useLive } from '../../data/live';
import { streakWeek, weekGoal } from '../../domain/metrics';
import { comebackGap } from '../../domain/plan/comeback';
import type { WeekDay } from '../../domain/streak';
import { logWarn } from '../../platform/diagnostics';
import { Icon } from '../../ui/Icon';
import { DayRing } from '../../ui/DayRing';
import { Odometer } from '../../ui/Odometer';
import { WeekStrip } from '../progress/StandHeader';
import { bigGain, patternGains } from './doneCard';
import { useDoneFacts } from './doneFacts';
import { takeDayMoment } from './dayMoment';
import { footParts, footText } from './goalLine';
import type { TodayView } from './state';
import { readIi } from '../../domain/studytime';
import { studyTimeLine } from '../settings/studyTimeText';

// Abschlusskarte Heute 3.0 (Lernplattform 3.0 P27, Motivation §4.8, §4.10): Ring, EINE große Zahl tatsächlich Gefestigten und höchstens vier Zeilen
// in fester Reihenfolge: 1 Wahrheitszeile · 2 Meilenstein ODER nächstes Ziel · 3 „Morgen …“ · 4 Wochenstreifen mit „Serie 12 · Woche 4 von 6“.
// Am ersten Tag nach einer Pause von mindestens 3 Lerntagen heißt die Überschrift „Erster Tag zurück“. Ein Zustand, kein Knopf, kein Konfetti.
// Jede Zahl kommt aus den Selektoren (`domain/metrics`); die Serienregel selbst bleibt unberührt.

/** Der Satz zu einem Meilenstein (Zeile 2 der Abschlusskarte). */
function milestoneText(ms: { id: string; n?: number }, t: ReturnType<typeof useT>['t'], lang: 'de' | 'en'): string {
  if (ms.id.startsWith('fest')) return t('nbHeuteMsFest', { n: ms.n ?? 0 });
  if (ms.id === 'topic1') return t('nbHeuteMsTopic');
  if (ms.id === 'fix10') return t('nbHeuteMsFix', { n: ms.n ?? 0 });
  if (ms.id === 'place') return t('moMsPlace');
  if (ms.id === 'c1check1') return t('moMsCheck');
  if (ms.id === 'c1ready') return t('moMsC1');
  const ch = /^ch([1-7])$/.exec(ms.id);
  if (ch) return t('moMsChapter', { n: Number(ch[1]), name: chapterById(Number(ch[1]))?.name[lang] ?? '' });
  return t('nbHeuteMsOver');
}

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

/** Die Aufstiegskarte folgt dem Tagesmoment (der in 1,4 s still steht). */
const LEVEL_AFTER_DAY_MS = 1500;

/** Funken des Tagesmoments (EE M7): 12 Richtungen und Verzögerungen, rein dekorativ, nur Stufe `full`. */
const SPARKS: ReadonlyArray<readonly [number, number, number]> = [
  [-70, -72, 0],
  [-30, -96, 30],
  [28, -92, 60],
  [72, -66, 20],
  [96, -14, 90],
  [80, 56, 45],
  [26, 92, 75],
  [-34, 90, 15],
  [-90, 20, 80],
  [-62, 66, 35],
  [104, 30, 55],
  [-104, -30, 65],
];

/**
 * Der Tagesmoment spielt nur beim Übergang „offen → fertig“ in dieser Sitzung und höchstens einmal je Lerntag und Browser (EE M7: „beim späteren
 * Öffnen steht der fertige Ring still“; `dayMoment.ts`).
 */
function usePlayOnce(today: string, ring: React.RefObject<HTMLElement | null>): boolean {
  const [play] = useState(() => takeDayMoment(today));
  useEffect(() => {
    if (!play) return;
    const stop = startMoment('day');
    // Funken und Ton, wenn sich der Ring geschlossen hat (EE M7 ≈ 640 ms); Funken nur Stufe „Voll“ (Dirigent).
    const id = setTimeout(() => emit({ k: 'moment', m: 'day', el: ring.current }), 640);
    return () => {
      clearTimeout(id);
      stop();
    };
  }, [play, ring]);
  return play;
}

/** „+3 Wörter sicher“ → große Zahl und Beschriftung darunter (Vorschau `.hero` + `.t2`). Ohne führende Zahl: null (der Satz bleibt eine Zeile). */
export function splitHero(text: string): [string, string] | null {
  const m = /^(\+?\d[\d.,]*(?:\s(?:von|of)\s\d[\d.,]*)?)\s+(\S.*)$/.exec(text);
  return m && m[1] && m[2] ? [m[1], m[2]] : null;
}

export function DoneCard3({ view, tomorrow, tomorrowTopic = '', today }: { view: TodayView; tomorrow: string; tomorrowTopic?: string; today: string }) {
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
  // P53: die Lernzeit als Vorschlag für morgen (nur hier, nie während der Pflicht); ohne Lernzeit keine Zeile.
  // R5 (S7): Mit Lernzeit EINE Zeile „Morgen um 7:30 Uhr nach dem ersten Kaffee: {Thema}“ statt zwei „Morgen“-Zeilen; ohne Lernzeit bleibt „Morgen: …“.
  const study = studyTimeLine(readIi(profile), lang, t, tomorrow ? tomorrowTopic : null);
  const merged = !!study && !!tomorrow && !!tomorrowTopic.trim();
  // Zeile 1: Wahrheitszeile, nur echte Zustandswechsel.
  const truth = [
    gains.names.length > 0 ? t('hxDoneNewSafe', { names: gains.names.join(' + ') }) : null,
    facts.fixed !== null && facts.fixed > 0 ? t('hxDoneFixed', { n: facts.fixed }) : null,
    facts.over !== null ? t('nbHeuteTruthOver', { n: facts.over }) : null,
  ].filter((x): x is string => x !== null);
  // Zeile 2: entweder der Meilenstein-Satz oder das nächste Ziel, nie beides.
  const ms = facts.milestone;
  const msText = ms ? milestoneText(ms, t, lang) : null;
  const goalText = !msText && facts.goal ? t(facts.goal.key, facts.goal.params) : null;
  const ringRef = useRef<HTMLSpanElement>(null);
  const play = usePlayOnce(today, ringRef);
  // P60: ein großer Meilenstein (Kapitel, C1, Wort-Marken ab 250) bekommt einmal je Gerät die Aufstiegskarte, nach dem Tagesmoment.
  const msId = ms?.id ?? null;
  const msN = ms?.n;
  useEffect(() => {
    if (!msId || !levelUpFor(msId)) return;
    const id = setTimeout(() => offerLevelUp([msId], msN), play ? LEVEL_AFTER_DAY_MS : 0);
    return () => clearTimeout(id);
  }, [msId, msN, play]);
  const heroText = big ? t(big.kind === 'words' ? 'hxDoneBigWords' : 'hxDoneBigPatterns', { n: big.n }) : t('nbHeuteDoneSteps', { blocks });
  const hero = splitHero(heroText);
  return (
    <section className="dz-done-card lx-card flex flex-col gap-3.5 p-[1.125rem] sm:p-6" data-play={play ? '' : undefined} data-testid="today-card" data-done="true" data-back={back ? 'true' : undefined} aria-labelledby="td-done-title">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="lx-eyebrow text-ok-text">
          <span aria-hidden="true">✓ </span>
          <span data-testid="today-status" data-status={view.status} data-done={view.duties.done} data-total={view.duties.total}>
            {back ? t('moBackTitle') : t('nbHeuteDoneTitle')}
          </span>
        </p>
        <span className="dz-done-ring" data-play={play ? '' : undefined} ref={ringRef}>
          <DayRing fills={Array.from({ length: Math.max(1, blocks) }, () => 1)} closed play={play} size={168} stroke={14} label={t('nbHeuteRingLabel', { done: blocks, total: blocks })}>
            <span className="dz-done-check inline-flex text-ok-text">
              <Icon name="check" size={72} strokeWidth={2.4} />
            </span>
          </DayRing>
          <span className="dz-sparks" aria-hidden="true">
            {SPARKS.map(([dx, dy, d]) => (
              <i key={`${dx}:${dy}`} style={{ ['--dx' as string]: `${dx}px`, ['--dy' as string]: `${dy}px`, ['--d' as string]: `${d}ms` }} />
            ))}
          </span>
        </span>
        <h2
          id="td-done-title"
          className={`lx-tnum dz-hero ${hero ? '' : 'text-3xl leading-tight font-semibold tracking-tight text-balance'}`}
          data-play={play ? '' : undefined}
          data-testid="balance"
          data-kind={big?.kind ?? 'steps'}
        >
          {hero ? (
            <>
              <span className="dz-hero-n">
                <Odometer text={hero[0]} id={`day-hero:${today}`} play={play} delay={820} />
              </span> <span className="dz-hero-l">{hero[1]}</span>
            </>
          ) : (
            heroText
          )}
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
      {tomorrow && !merged && (
        <p className="text-sm text-muted" data-testid="today-tomorrow">
          {tomorrow}
        </p>
      )}
      {study && (
        <p className="lx-tnum text-sm text-muted" data-testid="today-studytime" data-merged={merged ? '' : undefined}>
          {study}
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
