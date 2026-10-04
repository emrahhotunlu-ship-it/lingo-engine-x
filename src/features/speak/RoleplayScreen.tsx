import { AnimatePresence, motion } from 'framer-motion';
import { StepBoundary } from '../../app/shell/Boundary';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useT } from '../../i18n';
import { useAiStatus } from '../../ai/status';
import type { ChunkSuggestion, SceneView } from '../../domain/speak/types';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { Skeleton } from '../../ui/Skeleton';
import { DURATION } from '../../ui/motion';
import { AnalysisCard } from './AnalysisCard';
import { setCallMode, useCallMode } from '../../app/voice/autoplay';
import { GoalChecklist } from './GoalChecklist';
import { roleplayResume } from './resumable';
import { TurnTimer } from './TurnAids';
import { unitBlockOf } from './unit';
import { sceneGoals } from '../../domain/speak/bizScenes';
import { ChatLog } from './ChatLog';
import { Composer } from './Composer';
import { ReportScreen } from './ReportScreen';
import { readResume, type ResumeCopy } from './resume';
import { useRoleplay } from './useRoleplay';
import type { TakeInput } from './TakeChunkButton';
import { useSceneLibrary } from './useSceneLibrary';
import { useCompanionSee } from '../companion/seeing';
import { ExerciseTop } from '../learn/ui';

// Rollenspiel (Plan §5.2): Chat mit Streaming und Stopp, Analysepanel (Desktop rechts, Handy
// inline unter dem Satz), Beenden → Bericht. Kopf: Status statt Text (Szene · Zug n · Ziel-Chip).

export function useIsDesktop(): boolean {
  const q = '(min-width: 1024px)';
  const [on, setOn] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(q);
    if (!mq) return;
    const f = () => setOn(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return on;
}

export function RoleplayScreen() {
  const { t } = useT();
  const route = useNav((s) => s.route);
  const back = useNav((s) => s.back);
  const sceneId = route.name === 'roleplay' ? route.sceneId : '';
  const wantResume = route.name === 'roleplay' && !!route.resume;
  const { scenes } = useSceneLibrary();
  const [resume] = useState<ResumeCopy | null>(() => (wantResume ? readResume(sceneId, useClock.getState().today) : null));
  const scene = scenes?.find((s) => s.id === sceneId) ?? null;

  if (!scenes) {
    return (
      <div className="flex flex-col gap-4 py-6" data-testid="roleplay" data-state="loading" role="status" aria-label={t('loadingData')}>
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (!scene || !scene.valid || !scene.persona) {
    return (
      <div className="flex flex-col items-start gap-4 py-6" data-testid="roleplay" data-state="missing">
        <p className="text-base text-muted">{t('spSceneMissing')}</p>
        <Button icon="arrowLeft" onClick={back}>
          {t('spBack')}
        </Button>
      </div>
    );
  }
  const n = route.name === 'roleplay' ? (route.n ?? 0) : 0;
  return <Roleplay key={`${scene.id}-${n}`} scene={scene} resume={n === 0 ? resume : null} />;
}

function Roleplay({ scene, resume }: { scene: SceneView; resume: ResumeCopy | null }) {
  const { t, tn, lang } = useT();
  const back = useNav((s) => s.back);
  const rp = useRoleplay(scene, resume);
  const { snap, state } = rp;
  const c = snap.context;
  const persona = scene.persona as NonNullable<SceneView['persona']>;
  useCompanionSee({ area: 'speak', label: `${t('spTitle')} · ${lang === 'en' ? scene.titleEn : scene.title}`, phase: 'idle', detail: `Role play: ${scene.titleEn}\nSituation: ${scene.situationEn}\nGoal: ${scene.goalEn}` });
  const desktop = useIsDesktop();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const call = useCallMode((s) => s.on);
  const pausedUntil = useAiStatus((s) => s.pausedUntil);
  const now = useClock((s) => s.now);
  const myTurns = useMemo(() => c.turns.filter((x) => x.role === 'me').length, [c.turns]);
  const pending = Object.values(c.analyses).filter((a) => a.state === 'pending').length;
  const restore = useMemo(() => ({ text: c.draft, chip: c.draftChip, n: c.restoreN }), [c.draft, c.draftChip, c.restoreN]);
  const goalList = useMemo(() => sceneGoals(scene), [scene]);
  const unit = useNav((s) => (s.route.name === 'roleplay' ? unitBlockOf(s.route.unit) : null));
  const myText = useMemo(() => c.turns.filter((x) => x.role === 'me').map((x) => x.text).join('\n'), [c.turns]);
  // Fortsetzen (G3): Hülle um die vorhandene Kopie `lx:roleplay:<szene>`; der Bericht beendet es.
  const hasMine = myText.length > 0;
  const reported = state === 'report';
  useEffect(() => {
    if (reported) roleplayResume.clear();
    else if (hasMine) roleplayResume.set({ sceneId: scene.id, ...(unit ? { unit } : {}) });
  }, [hasMine, reported, scene.id, unit]);

  const takeInput = useCallback(
    (idx: number) =>
      (ch: ChunkSuggestion, upgraded: string): TakeInput => ({
        en: ch.en,
        de: ch.de,
        def: ch.def,
        kind: ch.kind,
        register: ch.register,
        why: ch.why,
        whyLang: c.analyses[idx]?.lang ?? lang,
        level: scene.level,
        src: { kind: 'scene', scene: scene.id, sceneTitle: scene.titleEn, utterance: c.turns[idx]?.text ?? '', upgraded, turn: c.turns.slice(0, idx + 1).filter((x) => x.role === 'me').length },
      }),
    [c.analyses, c.turns, lang, scene],
  );

  const card = (idx: number, testId?: string) => (
    <AnalysisCard
      idx={idx}
      slot={c.analyses[idx]}
      sentence={c.turns[idx]?.text ?? ''}
      area="speak"
      source={`scene/${scene.id}`}
      title={scene.titleEn}
      onRetry={() => rp.retryAnalysis(idx)}
      takeInput={takeInput(idx)}
      onTaken={rp.markTaken}
      {...(testId ? { testId } : {})}
    />
  );

  if (state === 'report' || state === 'finishing') {
    return <ReportScreen scene={scene} rp={rp} unit={unit} />;
  }

  const mine = c.turns.map((x, i) => (x.role === 'me' ? i : -1)).filter((i) => i >= 0);
  const phase = state === 'thinking' || state === 'streaming' || state === 'slow' ? state : state === 'composing' ? 'composing' : 'other';
  const busy = state !== 'composing';
  const pausedText = c.error === 'aiBusy' && pausedUntil > now ? t('spPaused', { time: new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { timeStyle: 'short' }).format(pausedUntil) }) : null;

  return (
    <div data-testid="roleplay" data-state={state} className="flex flex-col gap-4 py-4 sm:py-6">
      <ExerciseTop onClose={back} closeLabel={t('spBack')} closeTestId="rp-close" ctx="extra" />
      <header className="flex items-center gap-x-2 sm:gap-x-3">
        <div className="min-w-0 flex-1">
          <h1 className="line-clamp-2 text-base font-semibold tracking-tight sm:text-lg">{scene.title}</h1>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span data-testid="rp-turn-count">{t('spTurn', { n: myTurns + 1 })}</span>
            <span aria-hidden="true">·</span>
            <button type="button" className="inline-flex min-h-8 items-center gap-1 rounded-full px-1 text-xs text-muted hover:text-fg" aria-expanded={goalOpen} onClick={() => setGoalOpen((v) => !v)} data-testid="rp-goal">
              <Icon name="target" size={14} />
              {t('spGoalChip')}
              <Icon name="info" size={14} />
            </button>
          </p>
        </div>
        <Button icon="check" onClick={rp.end} disabled={busy && state !== 'blocked'} data-testid="rp-end">
          {t('spEnd')}
        </Button>
      </header>
      {/* N72: die Ziele stehen oben; Haken kommen nach jeder Antwort der Figur (goal-check@1). */}
      <div className="lx-glass rounded-2xl px-4 py-3" data-testid="rp-goals-box">
        <GoalChecklist goals={goalList} marks={rp.goals} testId="rp-goals" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <button
            type="button"
            className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-full px-1 text-xs text-muted hover:text-fg"
            aria-pressed={call}
            onClick={() => setCallMode(!call)}
            data-testid="rp-call-toggle"
          >
            <Icon name="speaker" size={14} />
            {t('nbSprechenCallMode')}
          </button>
        </div>
        {call && (
          <p className="mt-1 text-xs text-muted" data-testid="rp-call-note">
            {t('nbSprechenCallOn')}
          </p>
        )}
      </div>
      <AnimatePresence initial={false}>
        {goalOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: DURATION.base }} className="overflow-hidden">
            <Card channel="speak" as="div" className="!p-4 text-sm">
              <p>
                <span className="font-semibold">{t('spTaskLabel')}</span> {t('spTask', { name: persona.name, goal: scene.goal })}
              </p>
              <p className="mt-1 text-muted">{t('spPurpose')}</p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,44rem)_minmax(0,1fr)]">
        <StepBoundary resetKey={c.turns.length} scope="roleplay">
        <div className="flex min-w-0 flex-col gap-4 pb-44 lg:pb-0">
          <ChatLog
            turns={c.turns}
            analyses={c.analyses}
            persona={persona}
            sceneId={scene.id}
            sceneTitle={scene.titleEn}
            partial={c.partial}
            phase={phase}
            onStop={rp.stop}
            openIdx={desktop ? null : openIdx}
            onChip={(i) => {
              if (desktop) document.getElementById(`an-card-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              else setOpenIdx((cur) => (cur === i ? null : i));
            }}
            renderInline={(i) => card(i)}
            call={call}
          />

          {(c.error || c.interrupted) && state === 'composing' && (
            <div role="alert" className="flex flex-col gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-sm" data-testid="rp-error">
              {c.interrupted && (
                <p className="text-muted">
                  <span className="font-semibold">{t('spInterrupted')}:</span> <span lang="en">{c.interrupted}</span>
                </p>
              )}
              {c.error && <p>{pausedText ?? t(c.error)}</p>}
              <div>
                <Button icon="refresh" data-ai="" data-testid="rp-retry" onClick={() => void rp.sendTurn(c.draft, c.draftChip)}
                  disabled={!c.draft.trim()}
                >
                  {t('spRetry')}
                </Button>
              </div>
            </div>
          )}

          {state === 'blocked' && (
            <div role="alert" className="rounded-2xl bg-surface px-4 py-3 text-sm text-muted" data-testid="rp-blocked">
              {t('spNoAi')}
            </div>
          )}

          {state === 'ending' && (
            <Card channel="speak" as="div" data-testid="rp-waiting">
              <p className="text-sm">{tn('repWaiting', pending)}</p>
              <div className="mt-3">
                <Button variant="primary" onClick={rp.reportNow} data-testid="rp-report-now">
                  {t('repNow')}
                </Button>
              </div>
            </Card>
          )}

          {(state === 'composing' || phase !== 'other') && <TurnTimer key={c.turns.length} active={state === 'composing'} />}
          {call && state === 'composing' && (
            <p className="text-xs text-muted" data-testid="rp-call-hint">
              {t('nbSprechenCallHint')}
            </p>
          )}
          {(state === 'composing' || phase !== 'other') && (
            <Composer sceneId={scene.id} useful={scene.useful} busy={busy} restore={restore} onSend={(text, chip) => void rp.sendTurn(text, chip)} />
          )}

          {!desktop && mine.length > 0 && (
            <div>
              <Button variant="ghost" icon="sparkle" onClick={() => setAllOpen(true)} data-testid="rp-all-analyses">
                {t('spAllAnalyses')}
              </Button>
            </div>
          )}
        </div>

        </StepBoundary>

        {desktop && (
          <aside aria-label={t('spAnalysisPanel')} className="sticky top-4 hidden max-h-[calc(100dvh-2rem)] self-start overflow-y-auto lg:block" data-testid="analysis-panel">
            <div className="flex flex-col gap-3">
              <p className="lx-eyebrow">{t('spAnalysisPanel')}</p>
              {mine.length === 0 && <p className="text-sm text-muted">{t('spPanelEmpty')}</p>}
              {mine.map((i) => (
                <div key={i} id={`an-card-${i}`} className="lx-glass flex flex-col gap-2 rounded-2xl p-4">
                  <p lang="en" className="line-clamp-2 text-sm text-muted">
                    {c.turns[i]?.text}
                  </p>
                  {card(i)}
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {!desktop && (
        <Sheet open={allOpen} onClose={() => setAllOpen(false)} title={t('spAnalysisPanel')} closeLabel={t('close')}>
          <div className="flex flex-col gap-4 pt-2">
            {mine.map((i) => (
              <div key={i} className="flex flex-col gap-2 border-b border-line pb-4">
                <p lang="en" className="text-sm text-muted">
                  {c.turns[i]?.text}
                </p>
                {card(i, 'analysis-sheet')}
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
