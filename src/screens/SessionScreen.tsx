import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import { Button } from '../ui/Button';
import { ExerciseBar } from '../ui/ExerciseBar';
import { Icon } from '../ui/Icon';
import { useClock } from '../app/clock';
import { go, setAskContext } from '../app/route';
import { emptyDay, saveCards, saveDay, useCoach } from '../coach/store';
import { applyAnswer, daysUntil, introducedCard, knownCard, Session, type AnswerFacts, type Format, type Step } from '../coach/session';
import { distractors, viewOf, type CardView } from '../coach/cardView';
import type { DayRec } from '../coach/types';
import { pct } from '../coach/derived';
import { hash32, mulberry32, shuffle } from '../domain/random';
import { Exercise, StepHead } from './Exercise';
import { Speak, WordDetails } from './parts';

// Trainingseinheit (docs/neustart.md §4): der Trainer stellt sie selbst zusammen. Jede Antwort
// wird sofort gespeichert (Karte und Tageswerte), Abbrechen verliert nichts.

type Totals = { ans: number; ok: number; nw: number; kn: number; ms: number };

/** Einheit aus dem aktuellen Stand anlegen (einmal je Bildschirm). */
/** Nächster Schritt mit anzeigbarer Karte (eine Karte ohne Inhalt wird übersprungen). */
function nextShowable(session: Session): Step | null {
  for (;;) {
    const cards = useCoach.getState().cards;
    const step = session.next(cards);
    if (!step || viewOf(step.id, cards.get(step.id))) return step;
  }
}

function startSession(today: string, extra: boolean): { session: Session; base: DayRec; first: Step | null } {
  const st = useCoach.getState();
  const base = st.days[today] ?? emptyDay();
  const session = new Session({
    cards: st.cards,
    nowMs: Date.now(),
    newPerDay: st.profile?.newPerDay ?? 10,
    today: base,
    placement: st.profile?.placement,
    ...(extra ? { extraNew: 5 } : {}),
  });
  return { session, base, first: nextShowable(session) };
}

export function SessionScreen({ extra }: { extra: boolean }) {
  const { t } = useT();
  const today = useClock((s) => s.today);
  const cards = useCoach((s) => s.cards);
  const [{ session, base, first }] = useState(() => startSession(today, extra));
  const [step, setStep] = useState<Step | null>(first);
  const [totals, setTotals] = useState<Totals>({ ans: 0, ok: 0, nw: 0, kn: 0, ms: 0 });
  const [doneCount, setDoneCount] = useState(0);
  const [stepNo, setStepNo] = useState(0);
  const totalRef = useRef(totals);

  const writeDay = useCallback(
    (tot: Totals, core: boolean) => {
      const b = base;
      const cur = useCoach.getState().days[today];
      const rec: DayRec = {
        min: b.min + Math.round(tot.ms / 60_000),
        ans: b.ans + tot.ans,
        ok: b.ok + tot.ok,
        nw: b.nw + tot.nw,
        kn: (b.kn ?? 0) + tot.kn,
        core: core || cur?.core === 1 ? 1 : 0,
      };
      if (rec.ai === undefined && cur?.ai !== undefined) rec.ai = cur.ai;
      void saveDay(today, rec);
    },
    [today, base],
  );

  const advance = useCallback(() => {
    const next = nextShowable(session);
    setStep(next);
    setStepNo((n) => n + 1);
    if (!next) writeDay(totalRef.current, !extra);
  }, [extra, writeDay, session]);

  // Nichts zu tun: Die Einheit ist sofort erledigt (Kern-Training zählt).
  useEffect(() => {
    if (first === null) writeDay(totalRef.current, !extra);
  }, [first, writeDay, extra]);

  const bump = (d: Partial<Totals>) => {
    const tot = totalRef.current;
    const n = { ans: tot.ans + (d.ans ?? 0), ok: tot.ok + (d.ok ?? 0), nw: tot.nw + (d.nw ?? 0), kn: tot.kn + (d.kn ?? 0), ms: tot.ms + (d.ms ?? 0) };
    totalRef.current = n;
    setTotals(n);
    writeDay(n, false);
  };

  const onAnswer = (id: string, format: Format, facts: AnswerFacts): string => {
    const rec = useCoach.getState().cards.get(id);
    if (!rec) return '';
    const now = Date.now();
    const { rec: next, grade } = applyAnswer(rec, format, facts, now);
    void saveCards([[id, next]]);
    session.answered(id, next, now);
    bump({ ans: 1, ok: grade > 1 ? 1 : 0, ms: Math.min(facts.ms, 60_000) });
    setDoneCount((n) => n + 1);
    const days = daysUntil(next, now);
    return days === 0 ? t('cWhenToday') : days === 1 ? t('cWhenTomorrow') : t('cWhenDays', { n: days });
  };

  const total = doneCount + session.remaining;

  if (step === null) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-6" data-testid="session-done">
        <div className="lx-glass rounded-[var(--radius-card)] p-6 text-center">
          <Icon name="check" size={32} className="mx-auto text-accent-text" />
          <h1 className="mt-3 text-xl font-semibold">{totals.ans ? t('cSessDoneTitle') : t('cNothingDue')}</h1>
          {totals.ans > 0 && <p className="mt-2 text-sm text-muted">{t('cSessDoneText', { ans: totals.ans, pct: pct(totals.ok, totals.ans), nw: totals.nw })}</p>}
          {!extra && <p className="mt-1 text-sm text-muted">{t('cSessDoneCore')}</p>}
          <div className="mt-6">
            <Button variant="primary" onClick={() => go({ name: 'home' })} data-testid="to-home">
              {t('cToHome')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const rec = cards.get(step.id);
  const view = viewOf(step.id, rec);
  if (!view) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-3" data-testid="session">
      <ExerciseBar
        onClose={() => go({ name: 'home' })}
        closeLabel={t('cSessQuit')}
        closeTestId="session-quit"
        progress={{ n: doneCount + 1, total: Math.max(total, doneCount + 1) }}
        progressLabel={t('cSessProgress', { n: session.remaining })}
      />
      <div className="lx-glass mt-3 rounded-[var(--radius-card)] p-5 sm:p-7">
        {step.kind === 'review' && rec && (
          <Exercise
            key={`${step.id}-${stepNo}`}
            view={view}
            format={step.format}
            lv={rec.lv}
            reps={rec.f.reps}
            onAnswer={(facts) => onAnswer(step.id, step.format, facts)}
            onNext={advance}
          />
        )}
        {step.kind === 'meet' && (
          <Meet
            key={step.id}
            view={view}
            onDone={() => {
              const now = Date.now();
              const existing = useCoach.getState().cards.get(step.id);
              if (!existing) void saveCards([[step.id, introducedCard(now)]]);
              session.met(step.id);
              bump({ nw: 1 });
              advance();
            }}
          />
        )}
        {step.kind === 'sort' && (
          <Sort
            key={step.id}
            view={view}
            onKnown={() => {
              void saveCards([[step.id, knownCard(Date.now())]]);
              session.sortedKnown();
              bump({ kn: 1, ans: 1, ok: 1 });
              advance();
            }}
            onNew={() => setStep({ kind: 'meet', id: step.id })}
          />
        )}
      </div>
    </div>
  );
}

function Meet({ view, onDone }: { view: CardView; onDone: () => void }) {
  const { t } = useT();
  useEffect(() => setAskContext(`${view.word} (${view.de})`), [view]);
  return (
    <div data-testid="meet">
      <StepHead kind="meet" lv={0} />
      <WordDetails view={view} />
      <div className="mt-6">
        <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={onDone} data-testid="meet-done">
          {t('cMeetGot')}
        </Button>
      </div>
    </div>
  );
}

function Sort({ view, onKnown, onNew }: { view: CardView; onKnown: () => void; onNew: () => void }) {
  const { t } = useT();
  const [verify, setVerify] = useState(false);
  const [wrong, setWrong] = useState(false);
  const main = view.de.split(', ')[0] ?? view.de;
  const options = useMemo(() => shuffle([main, ...distractors(view)], mulberry32(hash32(`${view.id}-sort`))), [view, main]);
  useEffect(() => setAskContext(`${view.word}`), [view]);
  return (
    <div data-testid="sort">
      <StepHead kind="sort" lv={null} />
      <div className="flex items-center gap-2">
        <p className="text-3xl font-semibold tracking-tight" lang="en" data-testid="sort-word">
          {view.word}
        </p>
        <Speak text={view.word} />
      </div>
      {!verify ? (
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" onClick={onNew} data-testid="sort-new">
            {t('cSortNew')}
          </Button>
          <Button variant="primary" size="lg" onClick={() => setVerify(true)} data-testid="sort-know">
            {t('cSortKnow')}
          </Button>
        </div>
      ) : (
        <div className="mt-5">
          <p className="text-sm text-muted">{t('cSortVerify')}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="sort-options">
            {options.map((o) => (
              <Button
                key={o}
                variant="secondary"
                disabled={wrong}
                className={`justify-start text-left ${wrong && o === main ? 'ring-2 ring-accent' : ''}`}
                onClick={() => {
                  if (o === main) onKnown();
                  else setWrong(true);
                }}
              >
                {o}
              </Button>
            ))}
          </div>
          {wrong && (
            <div className="mt-4">
              <Button variant="primary" iconAfter="arrowRight" onClick={onNew} data-testid="sort-learn">
                {t('cNext')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
