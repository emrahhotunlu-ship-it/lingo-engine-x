import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useNav } from '../../app/nav';
import { useT } from '../../i18n';
import { reportStats } from '../../domain/speak/reportStats';
import type { SceneView } from '../../domain/speak/types';
import { EnglishText } from '../../engine/EnglishText';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { Skeleton } from '../../ui/Skeleton';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { useCatLabel } from './AnalysisCard';
import { TakeChunkButton } from './TakeChunkButton';
import { AsPreplyLesson } from '../preply/AsPreplyLesson';
import type { RoleplayApi } from './useRoleplay';

// Abschlussbericht (Plan §5.4): fester Teil sofort und ohne KI (Tatsachen, kein Punktestand),
// dazu der KI-Bericht in Worten. Gespeichert wird beim Anzeigen des festen Teils; der KI-Bericht
// wird nachgetragen. Sprachtreue: ein Bericht in der anderen Sprache wird nicht gemischt gezeigt,
// sondern auf Wunsch neu erstellt.

const GOAL_KEY = { reached: 'repGoalReached', partly: 'repGoalPartly', missed: 'repGoalMissed' } as const;

export function ReportScreen({ scene, rp }: { scene: SceneView; rp: RoleplayApi }) {
  const { t, lang } = useT();
  const go = useNav((s) => s.go);
  const route = useNav((s) => s.route);
  const cat = useCatLabel();
  const c = rp.snap.context;
  const saving = rp.state === 'finishing';
  const stats = useMemo(() => reportStats(c.turns, c.analyses, c.taken, c.startedAt, c.endedAt ?? c.startedAt), [c.turns, c.analyses, c.taken, c.startedAt, c.endedAt]);
  const rep = c.report;
  const foreign = rep.data && rep.data.lang !== lang;
  const aiState = saving ? 'waiting' : foreign ? 'foreign' : rep.state;
  const n = route.name === 'roleplay' ? (route.n ?? 0) : 0;

  return (
    <motion.div
      data-testid="report"
      data-state={saving ? 'saving' : 'saved'}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.slow, ease: EASE_OUT }}
      className="flex flex-col gap-6 py-6"
    >
      <header className="flex flex-col gap-1">
        <p className="lx-eyebrow">{t('repTitle')}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{scene.title}</h1>
      </header>

      <Card channel="speak" data-testid="report-stats">
        <p className="lx-tnum text-base font-medium">{t('repStats', { turns: stats.turns, min: stats.minutes, clean: stats.clean, total: stats.analysed })}</p>
        {stats.topCats.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">{t('repTopCats')}</span>
            {stats.topCats.map((k) => (
              <span key={k} className="rounded-full bg-surface px-2.5 py-1 text-xs">
                {cat(k)} · {stats.errs[k]}
              </span>
            ))}
          </p>
        )}
        {stats.targets.length > 0 && (
          <p className="mt-2 text-sm">
            <span className="text-muted">{t('repTargets')}</span> <span lang="en">{stats.targets.join(', ')}</span>
          </p>
        )}
        {stats.taken.length > 0 && (
          <p className="mt-2 text-sm">
            <span className="text-muted">{t('repTaken')}</span> <span lang="en">{stats.taken.join(' · ')}</span>
          </p>
        )}
        {stats.chipTurns > 0 && <p className="mt-2 text-xs text-muted">{t('repChips', { n: stats.chipTurns })}</p>}
        {c.saveFailed && (
          <p role="alert" className="mt-3 text-sm text-danger-text">
            {t('repNotSaved')}
          </p>
        )}
      </Card>

      <section data-testid="report-ai" data-state={aiState} className="flex flex-col gap-4" aria-busy={aiState === 'thinking' || aiState === 'slow' || aiState === 'waiting'}>
        {(aiState === 'waiting' || aiState === 'idle' || aiState === 'thinking' || aiState === 'slow') && (
          <div role="status" className="flex flex-col gap-2">
            <p className="text-sm text-muted">{aiState === 'slow' ? t('spSlow') : t('spThinking')}</p>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        )}
        {aiState === 'failed' && (
          <div role="alert" className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted">{t(rep.error ?? 'aiFailed')}</p>
            <Button icon="refresh" data-ai="" data-testid="report-retry" onClick={() => void rp.requestReport({ refresh: true })}>
              {t('aiRetry')}
            </Button>
          </div>
        )}
        {aiState === 'foreign' && (
          <div>
            <Button icon="sparkle" data-ai="" data-testid="report-regen" onClick={() => void rp.requestReport()}>
              {t('repRegen', { lang: t('langSelf') })}
            </Button>
          </div>
        )}
        {aiState === 'done' && rep.data && (
          <>
            <Card as="div">
              <p className="flex items-center gap-2 text-base font-semibold" data-testid="report-goal" data-goal={rep.data.goal.state}>
                <Icon name="target" size={18} />
                {t(GOAL_KEY[rep.data.goal.state])}
              </p>
              <p className="mt-1 text-sm text-muted">{rep.data.goal.why}</p>
              <p className="mt-3 text-base leading-relaxed">{rep.data.summary}</p>
            </Card>
            <div className="grid gap-4 md:grid-cols-2">
              <Card as="div">
                <p className="lx-eyebrow">{t('repStrengths')}</p>
                <ul className="mt-2 flex flex-col gap-3">
                  {rep.data.strengths.map((s, k) => (
                    <li key={k} className="text-sm">
                      <EnglishText as="span" text={`“${s.quote}”`} area="speak" source={`scene/${scene.id}`} title={scene.titleEn} className="font-medium" />
                      <span className="block text-muted">{s.why}</span>
                    </li>
                  ))}
                </ul>
              </Card>
              {/* Ein gutes Gespräch darf ohne Fokuspunkt sein (roleplay-report@2). */}
              {rep.data.focus.length > 0 && (
                <Card as="div">
                  <p className="lx-eyebrow">{t('repFocus')}</p>
                  <ul className="mt-2 flex flex-col gap-3">
                    {rep.data.focus.map((f, k) => (
                      <li key={k} className="flex flex-col gap-1 text-sm">
                        <p className="flex flex-wrap items-center gap-2 font-semibold">
                          {f.title}
                          <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-normal text-muted">{cat(f.cat)}</span>
                        </p>
                        <p>
                          <span className="text-muted">{t('repYouSaid')} </span>
                          <span lang="en">„{f.said}“</span>
                        </p>
                        <p className="flex flex-wrap gap-1">
                          <span className="text-muted">{t('repBetter')}</span>
                          <EnglishText as="span" text={f.better} area="speak" source={`scene/${scene.id}`} title={scene.titleEn} className="font-medium" />
                        </p>
                        <p className="text-muted">{f.why}</p>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
            {rep.data.phrases.length > 0 && (
              <Card as="div">
                <p className="lx-eyebrow">{t('repPhrases')}</p>
                <ul className="mt-2 flex flex-col gap-3">
                  {rep.data.phrases.map((p) => (
                    <li key={p.en} className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <EnglishText as="span" text={p.en} area="speak" source={`scene/${scene.id}`} title={scene.titleEn} className="font-medium" />
                        <span className="block text-xs text-muted">{p.de}</span>
                        <EnglishText as="span" text={p.ex} area="speak" source={`scene/${scene.id}`} title={scene.titleEn} className="block text-sm text-muted" />
                      </div>
                      <TakeChunkButton
                        input={{
                          en: p.en,
                          de: p.de,
                          def: p.def,
                          kind: 'phrase',
                          register: 'neutral',
                          why: '',
                          whyLang: rep.data?.lang ?? lang,
                          level: scene.level,
                          src: { kind: 'scene', scene: scene.id, sceneTitle: scene.titleEn, utterance: '', upgraded: p.ex, turn: 0 },
                        }}
                        onTaken={rp.markTaken}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" icon="refresh" disabled={saving} onClick={() => go({ name: 'roleplay', sceneId: scene.id, n: n + 1 })} data-testid="report-again">
          {t('repAgain')}
        </Button>
        <Button icon="chat" disabled={saving} onClick={() => go({ name: 'speak' })} data-testid="report-other">
          {t('repOther')}
        </Button>
        <Button variant="ghost" disabled={saving} onClick={() => go({ name: 'today' })} data-testid="report-home">
          {t('repHome')}
        </Button>
        {/* M18: aus der Szene eine Preply-Stunde machen. */}
        {!saving && <AsPreplyLesson title={scene.title} />}
      </div>
    </motion.div>
  );
}
