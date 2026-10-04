import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import { Button } from '../ui/Button';
import { ExerciseBar } from '../ui/ExerciseBar';
import { Icon } from '../ui/Icon';
import { useClock } from '../app/clock';
import { go, setAskContext } from '../app/route';
import { emptyDay, saveCards, saveDay, saveGrammar, saveSeen, useCoach } from '../coach/store';
import { applyAnswer, daysUntil, introducedCard, knownCard, Session, type AnswerFacts, type Format, type Step } from '../coach/session';
import { distractors, viewOf, type CardView } from '../coach/cardView';
import type { DayRec } from '../coach/types';
import { inputOf, isCore, pct, stageOf } from '../coach/derived';
import { grammarBlock, taskKey, topicState, updateTopic } from '../coach/grammarModel';
import { mixForDay, type MixItem } from '../coach/mix';
import { topicById, type GrammarTask } from '../coach/grammar';
import { hash32, mulberry32, shuffle } from '../domain/random';
import { Exercise, StepHead } from './Exercise';
import { GrammarItem, MixTask, RuleCard } from './GrammarTask';
import { Speak, WordDetails } from './parts';

// Trainingseinheit (docs/neustart.md §4–§6): der Trainer stellt sie selbst zusammen.
// 1. Wörter (Wiederholungen und neue Wörter), 2. Mix (feste Verbindung, falscher Freund),
// 3. Grammatik (Regel des Fokus-Themas, vier Aufgaben dazu, zwei aus anderen Themen).
// Jede Antwort wird sofort gespeichert, Abbrechen verliert nichts.

type Totals = { ans: number; ok: number; nw: number; kn: number; ms: number };
type Post = { kind: 'mix'; item: MixItem } | { kind: 'rule'; topic: string } | { kind: 'grammar'; task: GrammarTask };
type Current = { kind: 'word'; step: Step } | Post;
type GrammarScore = { topic: string; ok: number; n: number };

/** Nächster Schritt mit anzeigbarer Karte (eine Karte ohne Inhalt wird übersprungen). */
function nextShowable(session: Session): Step | null {
  for (;;) {
    const cards = useCoach.getState().cards;
    const step = session.next(cards);
    if (!step || viewOf(step.id, cards.get(step.id))) return step;
  }
}

/** Mix und Grammatik des Tages (nur in der Kern-Einheit und nur, solange die Grammatik offen ist). */
function postSteps(today: string): Post[] {
  const st = useCoach.getState();
  const stage = stageOf(st.profile?.planStart, today);
  const block = grammarBlock(st.grammar, st.profile?.placement, stage, Date.now(), today);
  const mix = mixForDay(today, st.grammar?.seen ?? {});
  return [...mix.map((item): Post => ({ kind: 'mix', item })), { kind: 'rule', topic: block.focus }, ...block.tasks.map((task): Post => ({ kind: 'grammar', task }))];
}

function startSession(today: string, extra: boolean) {
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
  const withPost = !extra && base.g !== 1;
  const post = withPost ? postSteps(today) : [];
  const firstWord = nextShowable(session);
  const first: Current | null = firstWord ? { kind: 'word', step: firstWord } : (post[0] ?? null);
  return { session, base, post, first, wordsDone: !firstWord };
}

export function SessionScreen({ extra }: { extra: boolean }) {
  const { t, lang } = useT();
  const today = useClock((s) => s.today);
  const cards = useCoach((s) => s.cards);
  const [init] = useState(() => startSession(today, extra));
  const { session, base, post } = init;
  const [cur, setCur] = useState<Current | null>(init.first);
  const [totals, setTotals] = useState<Totals>({ ans: 0, ok: 0, nw: 0, kn: 0, ms: 0 });
  const [doneCount, setDoneCount] = useState(0);
  const [stepNo, setStepNo] = useState(0);
  const [score, setScore] = useState<GrammarScore | null>(null);
  const totalRef = useRef(totals);
  const flags = useRef<{ w: boolean; g: boolean }>({ w: false, g: false });
  const startPost = init.first && init.first.kind !== 'word' ? 1 : 0;
  const postIdx = useRef(startPost);
  // Spiegel für die Anzeige (Refs dürfen beim Zeichnen nicht gelesen werden).
  const [pos, setPos] = useState({ wordsDone: init.wordsDone, post: startPost });

  const writeDay = useCallback(
    (tot: Totals) => {
      const st = useCoach.getState();
      const cur = st.days[today];
      const rec: DayRec = {
        ...(cur ?? {}),
        min: base.min + Math.round(tot.ms / 60_000),
        ans: base.ans + tot.ans,
        ok: base.ok + tot.ok,
        nw: base.nw + tot.nw,
        kn: (base.kn ?? 0) + tot.kn,
      };
      if (flags.current.w || cur?.w === 1) rec.w = 1;
      if (flags.current.g || cur?.g === 1) rec.g = 1;
      if (isCore(rec, inputOf(st.input, today).length > 0)) rec.core = 1;
      void saveDay(today, rec);
    },
    [today, base],
  );

  const finish = useCallback(() => {
    setCur(null);
    writeDay(totalRef.current);
  }, [writeDay]);

  const advance = useCallback(() => {
    setStepNo((n) => n + 1);
    if (!flags.current.w) {
      const next = nextShowable(session);
      if (next) return setCur({ kind: 'word', step: next });
      flags.current.w = !extra;
      if (extra) return finish();
    }
    const p = post[postIdx.current++];
    setPos({ wordsDone: true, post: postIdx.current });
    if (p) return setCur(p);
    flags.current.g = post.length > 0;
    finish();
  }, [session, post, extra, finish]);

  // Erster Schritt ist schon Mix/Grammatik oder gar nichts zu tun: Wörter sind erledigt.
  useEffect(() => {
    if (!init.wordsDone || extra) return;
    flags.current.w = true;
    if (!init.first) {
      flags.current.g = post.length > 0;
      writeDay(totalRef.current);
    }
  }, [init, extra, post, writeDay]);

  const bump = (d: Partial<Totals>) => {
    const tot = totalRef.current;
    const n = { ans: tot.ans + (d.ans ?? 0), ok: tot.ok + (d.ok ?? 0), nw: tot.nw + (d.nw ?? 0), kn: tot.kn + (d.kn ?? 0), ms: tot.ms + (d.ms ?? 0) };
    totalRef.current = n;
    setTotals(n);
    writeDay(n);
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

  const onGrammar = (task: GrammarTask, ok: boolean, ms: number) => {
    const st = useCoach.getState();
    const now = Date.now();
    const state = updateTopic(topicState(st.grammar, task.topic, st.profile?.placement), ok, now);
    void saveGrammar(task.topic, state, taskKey(task), now);
    bump({ ans: 1, ok: ok ? 1 : 0, ms: Math.min(ms, 90_000) });
    setDoneCount((n) => n + 1);
    const focus = post.find((p) => p.kind === 'rule');
    if (focus?.kind === 'rule' && focus.topic === task.topic) setScore((s) => ({ topic: task.topic, ok: (s?.ok ?? 0) + (ok ? 1 : 0), n: (s?.n ?? 0) + 1 }));
    advance();
  };

  const onMix = (item: MixItem, ok: boolean, ms: number) => {
    void saveSeen(item.key, Date.now());
    bump({ ans: 1, ok: ok ? 1 : 0, ms: Math.min(ms, 60_000) });
    setDoneCount((n) => n + 1);
    advance();
  };

  const stepStart = useRef(0);
  useEffect(() => {
    stepStart.current = performance.now();
  }, [stepNo]);
  const elapsed = () => performance.now() - stepStart.current;

  const remaining = (pos.wordsDone ? 0 : session.remaining) + Math.max(0, post.length - pos.post);
  const total = doneCount + remaining;

  if (cur === null) {
    const tp = score ? topicById(score.topic) : undefined;
    return (
      <div className="mx-auto max-w-2xl px-4 pt-6" data-testid="session-done">
        <div className="lx-glass rounded-[var(--radius-card)] p-6 text-center">
          <Icon name="check" size={32} className="mx-auto text-accent-text" />
          <h1 className="mt-3 text-xl font-semibold">{totals.ans ? t('cSessDoneTitle') : t('cNothingDue')}</h1>
          {totals.ans > 0 && <p className="mt-2 text-sm text-muted">{t('cSessDoneText', { ans: totals.ans, pct: pct(totals.ok, totals.ans), nw: totals.nw })}</p>}
          {score && tp && <p className="mt-1 text-sm text-muted">{t('cSessDoneGrammar', { topic: lang === 'de' ? tp.name : tp.name_en, ok: score.ok, n: score.n })}</p>}
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

  const word = cur.kind === 'word' ? cur.step : null;
  const rec = word ? cards.get(word.id) : undefined;
  const view = word ? viewOf(word.id, rec) : null;
  if (word && !view) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-3" data-testid="session">
      <ExerciseBar
        onClose={() => go({ name: 'home' })}
        closeLabel={t('cSessQuit')}
        closeTestId="session-quit"
        progress={{ n: doneCount + 1, total: Math.max(total, doneCount + 1) }}
        progressLabel={t('cSessProgress', { n: remaining })}
      />
      <div className="lx-glass mt-3 rounded-[var(--radius-card)] p-5 sm:p-7">
        {word?.kind === 'review' && rec && view && (
          <Exercise
            key={`${word.id}-${stepNo}`}
            view={view}
            format={word.format}
            lv={rec.lv}
            reps={rec.f.reps}
            onAnswer={(facts) => onAnswer(word.id, word.format, facts)}
            onNext={advance}
          />
        )}
        {word?.kind === 'meet' && view && (
          <Meet
            key={word.id}
            view={view}
            onDone={() => {
              const now = Date.now();
              const existing = useCoach.getState().cards.get(word.id);
              if (!existing) void saveCards([[word.id, introducedCard(now)]]);
              session.met(word.id);
              bump({ nw: 1 });
              advance();
            }}
          />
        )}
        {word?.kind === 'sort' && view && (
          <Sort
            key={word.id}
            view={view}
            onKnown={() => {
              void saveCards([[word.id, knownCard(Date.now())]]);
              session.sortedKnown();
              bump({ kn: 1, ans: 1, ok: 1 });
              advance();
            }}
            onNew={() => setCur({ kind: 'word', step: { kind: 'meet', id: word.id } })}
          />
        )}
        {cur.kind === 'mix' && <MixTask key={`m-${stepNo}`} item={cur.item} onDone={(ok) => onMix(cur.item, ok, elapsed())} />}
        {cur.kind === 'rule' && (
          <RuleCard key={`r-${stepNo}`} topic={cur.topic} sure={topicState(useCoach.getState().grammar, cur.topic, useCoach.getState().profile?.placement).p} onGo={advance} />
        )}
        {cur.kind === 'grammar' && <GrammarItem key={`g-${stepNo}`} task={cur.task} bare onDone={(ok) => onGrammar(cur.task, ok, elapsed())} />}
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
