import { motion } from 'framer-motion';
import { useState } from 'react';
import { useNav } from '../../app/nav';
import { useT } from '../../i18n';
import { useAiAvailable } from '../../ai/scope';
import { AI_SCENE_HINT_AT } from '../../domain/speak/sceneDoc';
import { Button, IconButton } from '../../ui/Button';
import { ChannelIcon } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { Skeleton } from '../../ui/Skeleton';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { SceneBriefing } from './SceneBriefing';
import { SceneCard } from './SceneCard';
import { SceneCreateSheet } from './SceneCreateSheet';
import { SituationDrill, useSituationPool } from './SituationDrill';
import { useSceneLibrary } from './useSceneLibrary';
import { useSpeakToday } from './useTodayEntries';
import { useCompanionSee } from '../companion/seeing';

// Sprechen-Übersicht (Plan §5.1): Statuszeile (Zustand, kein Knopf), Szenenkarten, „Neue Szene“
// (nur mit KI). Ohne KI bleiben die Szenen lesbar, gestartet werden kann nicht.

const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } } };

export function SpeakHub() {
  const { t, lang } = useT();
  const go = useNav((s) => s.go);
  const ai = useAiAvailable();
  const { scenes } = useSceneLibrary();
  useCompanionSee({ area: 'speak', label: t('spTitle'), phase: 'idle' });
  const today = useSpeakToday();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [drill, setDrill] = useState(false);
  const situations = useSituationPool(scenes, lang, 0);
  const open = scenes?.find((s) => s.id === openId) ?? null;
  const aiCount = scenes?.filter((s) => s.src === 'ai').length ?? 0;

  return (
    <motion.div data-testid="speak-hub" className="flex flex-col gap-6 py-6 sm:py-8" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
      <motion.header variants={item} className="flex items-start gap-2">
        <IconButton icon="arrowLeft" label={t('spBack')} onClick={() => go({ name: 'today' })} />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('spTitle')}</h1>
          {today.loaded && (
            <p data-testid="speak-status" data-done={today.done} className={`flex items-center gap-2 text-sm ${today.done ? 'text-accent-text' : 'text-muted'}`}>
              {today.done && <Icon name="check" size={16} />}
              {today.done ? t('spStatusDone') : t('spStatusOpen')}
            </p>
          )}
        </div>
      </motion.header>

      {!ai && (
        <motion.p variants={item} data-testid="speak-noai" className="rounded-2xl bg-surface px-4 py-3 text-sm text-muted">
          {t('spNoAi')}
        </motion.p>
      )}

      {drill && scenes ? (
        <motion.div variants={item}>
          <SituationDrill scenes={scenes} onClose={() => setDrill(false)} />
        </motion.div>
      ) : (
        <>
          <motion.section variants={item} aria-labelledby="sp-scenes" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="sp-scenes" className="lx-eyebrow">
                {t('spScenes')}
              </h2>
              {ai && (
                <Button icon="sparkle" onClick={() => setCreating(true)} data-testid="scene-create" data-ai="">
                  {t('spCreate')}
                </Button>
              )}
            </div>
            {aiCount >= AI_SCENE_HINT_AT && <p className="text-xs text-subtle">{t('spManyScenes')}</p>}
            {!scenes ? (
              <div className="grid gap-3 md:grid-cols-2" role="status" aria-label={t('loadingData')}>
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {scenes.map((s) => (
                  <SceneCard key={s.id} scene={s} onOpen={() => setOpenId(s.id)} />
                ))}
              </div>
            )}
          </motion.section>

          {situations && situations.length > 0 && (
            <motion.section variants={item} className="flex flex-col gap-2 border-t border-line pt-5" aria-labelledby="sp-sit">
              <h2 id="sp-sit" className="lx-eyebrow">
                {t('sitTitle')}
              </h2>
              <p className="text-sm text-muted">{t('sitLead', { n: situations.length })}</p>
              <div>
                <Button icon="cards" onClick={() => setDrill(true)} data-testid="situation-start">
                  {t('sitStart')}
                </Button>
              </div>
            </motion.section>
          )}
        </>
      )}

      {/* Reiter „Sprechen“: auch die Business-Suite ist hier jederzeit erreichbar (auf „Heute“ erst nach der Pflicht). */}
      <motion.section variants={item} aria-labelledby="sp-biz" className="flex flex-col gap-2 border-t border-line pt-5">
        <h2 id="sp-biz" className="lx-eyebrow">
          {t('bizTitle')}
        </h2>
        <button type="button" onClick={() => go({ name: 'business' })} data-testid="speak-business" className="lx-glass flex min-h-16 w-full items-center gap-3 rounded-[var(--radius-card)] px-4 py-3 text-left hover:bg-surface-strong md:max-w-md">
          <ChannelIcon channel="business">
            <Icon name="briefcase" />
          </ChannelIcon>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold">{t('bizTitle')}</span>
            <span className="text-xs text-muted">{t('tdBizHint')}</span>
          </span>
          <Icon name="arrowRight" size={18} />
        </button>
      </motion.section>

      <SceneBriefing scene={open} onClose={() => setOpenId(null)} />
      {scenes && (
        <SceneCreateSheet
          open={creating}
          onClose={() => setCreating(false)}
          scenes={scenes}
          onCreated={(id) => {
            setCreating(false);
            setOpenId(id);
          }}
        />
      )}
    </motion.div>
  );
}
