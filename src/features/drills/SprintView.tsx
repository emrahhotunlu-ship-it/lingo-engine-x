import { useMachine } from '@xstate/react';
import { useEffect, useRef, useState } from 'react';
import { setup } from 'xstate';
import { useLive } from '../../data/live';
import { useClock } from '../../app/clock';
import { SPRINT_MS, sprintAnswer, sprintEntry, sprintRadar, sprintStart, tempoPerMin, weekTempo, type SprintItem, type SprintState } from '../../domain/drills/sprint';
import type { RadarEvent } from '../../domain/learn/types';
import { Choices } from '../../engine/Choices';
import { useHiddenInput } from '../../engine/HiddenInput';
import { KineticGap } from '../../engine/KineticGap';
import { useHotkeys } from '../../engine/useHotkeys';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { nextT } from '../progress/persist';
import { LearnStatus, SummaryActions, TaskLine } from '../learn/ui';
import { finishSprint, leaveDrill, startDrill, useDrill } from './session';

// Sprint (phase2-plan §5.7): 90 s nur mit Bekanntem, verschachtelt. Fehler beenden die Runde
// nicht, nur ein kurzer Farbimpuls. Am Ende alle Aufgaben, Fehler aufgeklappt mit Lösung, und
// eine ruhige Tempozahl. Geschrieben werden nur `sprints`, `act.sprint` und Radar (kein Log).
// Ablauf als XState-Maschine: bereit → läuft → fertig.

const sprintMachine = setup({
  types: { events: {} as { type: 'START' } | { type: 'TIME_UP' } | { type: 'AGAIN' } },
}).createMachine({
  id: 'sprint',
  initial: 'ready',
  states: {
    ready: { on: { START: 'running' } },
    running: { on: { TIME_UP: 'finished' } },
    finished: { on: { AGAIN: 'ready' } },
  },
});

export function SprintView() {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const deck = useDrill((s) => s.sprint);
  const step = useDrill((s) => s.step);
  const sprints = useLive((s) => s.docs['app/profile']?.sprints);
  const nowMs = useClock((s) => s.now);
  const [snap, send] = useMachine(sprintMachine);
  const [st, setSt] = useState<SprintState>(sprintStart);
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(SPRINT_MS);
  const [flash, setFlash] = useState<'ok' | 'wrong' | null>(null);
  const [itemKey, setItemKey] = useState(0);
  const startAt = useRef(0);
  const shownAt = useRef(0);
  const typed = useRef('');
  const stRef = useRef(st);
  useEffect(() => {
    stRef.current = st;
  });

  const running = snap.matches('running');
  const finished = snap.matches('finished');
  const item: SprintItem | undefined = deck[idx % Math.max(1, deck.length)];

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const tick = () => {
      const rest = Math.max(0, SPRINT_MS - (performance.now() - startAt.current));
      setLeft(rest);
      if (rest <= 0) {
        const s = stRef.current;
        const radar = s.answers.filter((a) => !a.ok).map((a, i) => sprintRadar(a.item, a.given, Date.now() + i)).filter((e): e is RadarEvent => !!e);
        finishSprint(
          sprintEntry(s, nextT()),
          s.answers.map((a) => ({ label: a.item.prompt, ok: a.ok, verdict: a.ok ? 'correct' : 'wrong' })),
          radar,
        );
        api.blur();
        send({ type: 'TIME_UP' });
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, send, api]);

  const begin = () => {
    startAt.current = performance.now();
    shownAt.current = performance.now();
    setSt(sprintStart());
    setIdx(0);
    setLeft(SPRINT_MS);
    send({ type: 'START' });
    if (deck[0] && !deck[0].opts) api.focusNow();
  };

  const answer = (given: string) => {
    if (!running || !item) return;
    const ms = Math.round(performance.now() - shownAt.current);
    const next = sprintAnswer(st, item, given, ms);
    const ok = next.ok > st.ok;
    setSt(next);
    setFlash(ok ? 'ok' : 'wrong');
    window.setTimeout(() => setFlash(null), 220);
    const nextItem = deck[(idx + 1) % Math.max(1, deck.length)];
    setIdx((i) => i + 1);
    setItemKey((k) => k + 1);
    typed.current = '';
    shownAt.current = performance.now();
    if (nextItem && !nextItem.opts) api.focusNow();
    else api.blur();
  };

  useHotkeys(
    {
      enter: () => {
        if (!running) return;
        if (item && !item.opts) answer(typed.current);
      },
      digit: (n) => {
        if (!running || !item?.opts) return;
        const o = item.opts[n - 1];
        if (o) answer(o);
      },
    },
    api.isInput,
  );

  const again = () => {
    const first = startDrill('sprint');
    send({ type: 'AGAIN' });
    if (first === 'typed') api.blur();
  };

  if (!deck.length)
    return (
      <article className="lx-glass lx-exercise flex flex-col gap-4" data-testid="drill-empty">
        <p className="text-base text-muted">{t('drSprintEmpty')}</p>
        <SummaryActions onBack={leaveDrill} backTo={{ name: 'apply' }} backLabel={t('lrBackToApply')} />
      </article>
    );

  if (finished) {
    const week = weekTempo(sprints, nowMs);
    const tempo = tempoPerMin(st.ok);
    const wrong = st.answers.filter((a) => !a.ok);
    return (
      <article className="lx-glass lx-exercise flex flex-col gap-5" data-testid="sprint-summary">
        <h2 className="text-xl font-semibold tracking-tight">{t('drSprintDone')}</h2>
        <p className="lx-tnum text-base text-muted" data-testid="sprint-tempo">
          {week === null ? t('drTempoFirst', { n: tempo }) : t('drTempo', { n: tempo, avg: week })}
        </p>
        {wrong.length > 0 && (
          <section className="flex flex-col gap-2" data-testid="sprint-errors">
            <h3 className="lx-eyebrow">{t('drSprintAgain')}</h3>
            <ul className="flex flex-col gap-2">
              {wrong.map((a, i) => (
                <li key={`${a.item.id}-${i}`} className="flex flex-col text-sm">
                  <span lang={a.item.k === 'card-type' ? lang : 'en'}>{a.item.prompt}</span>
                  <span>
                    <span className="lx-diff-off">{a.given || '–'}</span>
                    <span className="text-muted"> → </span>
                    <span className="font-semibold">{a.item.answer}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <ul className="flex flex-wrap gap-2" data-testid="sprint-list">
          {st.answers.map((a, i) => (
            <li key={`${a.item.id}-${i}`} className={`rounded-full border border-line px-3 py-1 text-sm ${a.ok ? '' : 'text-danger-text'}`}>
              {a.item.k === 'card-type' ? a.item.answer : a.item.prompt}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" icon="refresh" onClick={again} data-testid="sprint-again">
            {t('drSprintOnce')}
          </Button>
        </div>
        <SummaryActions onBack={leaveDrill} backTo={{ name: 'apply' }} backLabel={t('lrBackToApply')} />
      </article>
    );
  }

  return (
    <article className={`lx-glass lx-exercise flex flex-col gap-5 ${flash === 'ok' ? 'lx-flash-ok' : flash === 'wrong' ? 'lx-flash-wrong' : ''}`} data-testid="drill-item" data-kind="sprint" key={`sprint-${step}`}>
      <header className="flex flex-col gap-2">
        <LearnStatus p={null} kind={t('drSprint')} kindId="sprint" />
        <TaskLine task={t('drTaskSprint')} purpose={t('purposeSprint')} />
      </header>
      <div className="lx-timer" role="progressbar" aria-valuemin={0} aria-valuemax={SPRINT_MS} aria-valuenow={Math.round(left)} aria-label={t('drTimeLeft', { s: Math.ceil(left / 1000) })} data-testid="sprint-timer" data-left-ms={Math.round(left)}>
        <span style={{ transform: `scaleX(${left / SPRINT_MS})` }} />
      </div>
      {!running ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-base text-muted">{t('drSprintIntro')}</p>
          <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={begin} data-testid="sprint-start">
            {t('drSprintGo')}
          </Button>
        </div>
      ) : (
        item && (
          <div key={itemKey} className="flex flex-col gap-4" data-testid="sprint-item" data-k={item.k}>
            <p className="text-xl font-semibold tracking-tight" lang={item.k === 'card-type' ? lang : 'en'} data-testid="sprint-prompt">
              {item.prompt}
            </p>
            {item.opts ? (
              <Choices items={item.opts.map((o, i) => ({ id: String(i), label: o, lang: item.k === 'card-mc' ? lang : 'en', correct: false }))} chosen={null} onChoose={(id) => answer(item.opts?.[Number(id)] ?? '')} label={t('trChoicesLabel')} />
            ) : (
              <p className="lx-sentence" lang="en">
                <KineticGap label={t('drSprintType')} maxLength={40} state="input" onChange={(v) => (typed.current = v)} onEnter={() => answer(typed.current)} />
              </p>
            )}
          </div>
        )
      )}
    </article>
  );
}
