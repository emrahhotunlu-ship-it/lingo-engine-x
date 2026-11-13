import { useEffect, useMemo, useRef, useState } from 'react';
import { emit } from '../../engine/fx';
import { startMoment } from '../../engine/fx/measure';
import { chapterById } from '../../domain/c1/chapters';
import { levelUpFor } from '../../domain/moments/detect';
import { offerLevelUp } from '../../ui/moments/store';
import { useT } from '../../i18n';
import { useLive } from '../../data/live';
import type { TodaySummary } from '../../domain/metrics';
import { comebackGap } from '../../domain/plan/comeback';
import { Icon } from '../../ui/Icon';
import { Odometer } from '../../ui/Odometer';
import { bigGain, patternGains } from './doneCard';
import { useDoneFacts } from './doneFacts';
import { takeDayMoment } from './dayMoment';
import { DayCardFrame, TodayRing } from './DayCard';
import type { TodayView } from './state';
import { readIi } from '../../domain/studytime';
import { studyTimeLine } from '../settings/studyTimeText';

// Abschlusskarte Heute 3.0 (Lernplattform 3.0 P27, Motivation §4.8, §4.10) im Design der Vorschau (D2 V-HEUTE, H1/L1 `done`): voller Ring mit Häkchen,
// „28 Min.“ und dem Zustand („Fertig für heute“) in der Mitte, darunter EINE Bilanz (tatsächlich Gefestigte) als Titel und höchstens drei Zeilen
// in fester Reihenfolge: 1 Wahrheitszeile · 2 Meilenstein ODER nächstes Ziel · 3 „Morgen …“. Der Wochenstreifen mit „Serie 12 · Woche 4 von 6“
// steht darunter (Handy) bzw. rechts (Laptop), wie in der Vorschau.
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

/** Die Aufstiegskarte folgt dem Tagesmoment (der in 1,4 s still steht). */
const LEVEL_AFTER_DAY_MS = 1500;

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

export function DoneCard3({ view, sum, mins, tomorrow, tomorrowTopic = '', today }: { view: TodayView; sum: TodaySummary; mins: readonly number[]; tomorrow: string; tomorrowTopic?: string; today: string }) {
  const { t, tn, lang } = useT();
  const facts = useDoneFacts(view, true);
  const grammar = useLive((s) => s.collections.grammar);
  const profile = useLive((s) => s.docs['app/profile']);
  // Relaunch P6, Auflage 1: Zahlen aus DEMSELBEN `todaySummary` wie Tageskarte und Startbild (nie ein zweiter Zähler).
  const blocks = sum.total;
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
  // Politur P1 (Kap. 2 Nr. 2): In der Mitte stehen die Minuten, die heute wirklich gelernt wurden (gespeichert + noch im Puffer) – dieselbe
  // Quelle wie „Min. diese Woche“ darunter. Vorher stand hier die geplante Zeit („25 Min.“ neben „4 Min. diese Woche“). Mindestens 1.
  const realMin = Math.max(1, Math.round(view.balance.minutes));
  // P60: ein großer Meilenstein (Kapitel, C1, Wort-Marken ab 250) bekommt einmal je Gerät die Aufstiegskarte, nach dem Tagesmoment.
  const msId = ms?.id ?? null;
  const msN = ms?.n;
  useEffect(() => {
    if (!msId || !levelUpFor(msId)) return;
    const id = setTimeout(() => offerLevelUp([msId], msN), play ? LEVEL_AFTER_DAY_MS : 0);
    return () => clearTimeout(id);
  }, [msId, msN, play]);
  const heroText = big ? t(big.kind === 'words' ? 'hxDoneBigWords' : 'hxDoneBigPatterns', { n: big.n }) : tn('nbHeuteDoneSteps', blocks);
  const hero = splitHero(heroText);
  return (
    <DayCardFrame
      className="lx-vh-done"
      data-play={play ? '' : undefined}
      data-testid="today-card"
      data-done="true"
      data-back={back ? 'true' : undefined}
      aria-labelledby="td-done-title"
      ring={
        <span className="lx-vh-done-ring" ref={ringRef}>
          <span className="sr-only" data-testid="today-status" data-status={view.status} data-done={sum.done} data-total={sum.total}>
            {back ? t('moBackTitle') : t('nbHeuteDoneTitle')}
          </span>
          <TodayRing
            fills={Array.from({ length: Math.max(1, blocks) }, () => 1)}
            minutes={mins.length === blocks && blocks > 0 ? mins : Array.from({ length: Math.max(1, blocks) }, () => 1)}
            closed
            play={play}
            draw={play}
            label={t('nbHeuteRingLabel', { done: blocks, total: blocks })}
            testId="today-ring"
          >
            <span className="lx-vh-done-check" aria-hidden="true">
              <Icon name="check" size={24} />
            </span>
            <b className="lx-v-disp lx-v-num lx-vh-done-min" data-testid="today-done-min" data-min={realMin}>
              {t('vhMinDone', { n: realMin })}
            </b>
            <span aria-hidden="true">{back ? t('moBackTitle') : t('nbHeuteDoneTitle')}</span>
          </TodayRing>
        </span>
      }
    >
      <div className="lx-vh-topic">
        <h2 id="td-done-title" className="lx-vh-t lx-v-disp lx-v-num lx-vh-hero" data-play={play ? '' : undefined} data-testid="balance" data-kind={big?.kind ?? 'steps'}>
          {hero ? (
            <>
              <span className="lx-vh-hero-n">
                <Odometer text={hero[0]} id={`day-hero:${today}`} play={play} delay={820} />
              </span>{' '}
              <span className="lx-vh-hero-l">{hero[1]}</span>
            </>
          ) : (
            heroText
          )}
        </h2>
        {truth.length > 0 && (
          <p className="lx-vh-sub lx-v-num" data-testid="today-truth">
            {truth.join(' · ')}
          </p>
        )}
        {msText && (
          <p className="lx-vh-sub lx-vh-sub-strong" data-testid="today-milestone" data-id={ms?.id}>
            {msText}
          </p>
        )}
        {goalText && (
          <p className="lx-vh-sub lx-v-num" data-testid="today-goal" data-id={view.plan?.u?.nx}>
            {goalText}
          </p>
        )}
        {tomorrow && !merged && (
          <p className="lx-vh-sub" data-testid="today-tomorrow">
            {tomorrow}
          </p>
        )}
        {study && (
          <p className="lx-vh-sub lx-v-num" data-testid="today-studytime" data-merged={merged ? '' : undefined}>
            {study}
          </p>
        )}
      </div>
    </DayCardFrame>
  );
}
