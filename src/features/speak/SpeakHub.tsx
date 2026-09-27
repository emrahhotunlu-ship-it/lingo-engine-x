import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNav, type SpeakSeg } from '../../app/nav';
import { useT } from '../../i18n';
import { useAiAvailable } from '../../ai/scope';
import { AI_SCENE_HINT_AT } from '../../domain/speak/sceneDoc';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Segmented } from '../../ui/Segmented';
import { Skeleton } from '../../ui/Skeleton';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { BusinessSection } from '../business/BusinessHub';
import { PreplySection } from '../preply/PreplyScreen';
import { TabTitle } from '../system/Chrome';
import { SceneBriefing } from './SceneBriefing';
import { SceneCard } from './SceneCard';
import { SceneCreateSheet } from './SceneCreateSheet';
import { SituationDrill, useSituationPool } from './SituationDrill';
import { useSceneLibrary } from './useSceneLibrary';
import { useSpeakToday } from './useTodayEntries';
import { ChannelIcon } from '../../ui/Card';
import type { IconName } from '../../ui/Icon';
import type { MessageKey } from '../../i18n';
import { useCompanionSee } from '../companion/seeing';

// Reiter „Sprechen" (UX-Beratung Nr. 7): ein Ort für alle Gespräche mit dem Umschalter
// Szenen · Business · Preply – keine Übersicht in einer Übersicht. Szenen: Statuszeile (Zustand,
// kein Knopf), Szenenliste, „Neue Szene" (nur mit KI), Wendungen aus Szenen. Unvollständige
// Szenen stehen nicht in der Liste, sondern zugeklappt darunter (visuelle Regel 10).

const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } } };

/** Zuletzt gewählter Bereich (nur im Speicher): ein Reiterwechsel kehrt dorthin zurück. */
let lastSeg: SpeakSeg = 'scenes';

export function SpeakHub() {
  const { t } = useT();
  const route = useNav((s) => s.route);
  const go = useNav((s) => s.go);
  const seg: SpeakSeg = route.name === 'speak' && route.seg ? route.seg : lastSeg;
  useEffect(() => {
    lastSeg = seg;
  }, [seg]);
  const today = useSpeakToday();

  return (
    <motion.div data-testid="speak-hub" data-seg={seg} className="flex flex-col gap-5 py-6 sm:py-8" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
      <motion.div variants={item}>
        <TabTitle
          title={t('spTitle')}
          sub={
            today.loaded && (
              <p data-testid="speak-status" data-done={today.done} className={`flex items-center gap-2 text-sm ${today.done ? 'text-accent-text' : 'text-muted'}`}>
                {today.done && <Icon name="check" size={16} />}
                {today.done ? t('spStatusDone') : t('spStatusOpen')}
              </p>
            )
          }
        />
      </motion.div>
      <motion.div variants={item} className="max-w-md">
        <Segmented
          label={t('spSegLabel')}
          value={seg}
          testId="speak-seg"
          options={[
            { value: 'scenes', label: t('spSegScenes'), testId: 'speak-seg-scenes' },
            { value: 'business', label: t('spSegBusiness'), testId: 'speak-seg-business' },
            { value: 'preply', label: t('spSegPreply'), testId: 'speak-seg-preply' },
          ]}
          onChange={(v) => go({ name: 'speak', seg: v })}
        />
      </motion.div>
      <motion.div key={seg} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: DURATION.base, ease: EASE_OUT }}>
        {seg === 'scenes' && (
          <div className="flex flex-col gap-6">
            <ScenesSection />
            <TrainingSection />
          </div>
        )}
        {seg === 'business' && <BusinessSection />}
        {seg === 'preply' && <PreplySection />}
      </motion.div>
    </motion.div>
  );
}

function ScenesSection() {
  const { t, tn, lang } = useT();
  const ai = useAiAvailable();
  const { scenes } = useSceneLibrary();
  useCompanionSee({ area: 'speak', label: t('spTitle'), phase: 'idle' });
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [drill, setDrill] = useState(false);
  const situations = useSituationPool(scenes, lang, 0);
  const open = scenes?.find((s) => s.id === openId) ?? null;
  const aiCount = scenes?.filter((s) => s.src === 'ai').length ?? 0;
  const ready = scenes?.filter((s) => s.valid) ?? [];
  const broken = scenes?.filter((s) => !s.valid) ?? [];

  return (
    <div className="flex flex-col gap-6">
      {!ai && (
        <p data-testid="speak-noai" className="rounded-2xl bg-surface px-4 py-3 text-sm text-muted">
          {t('spNoAi')}
        </p>
      )}

      {drill && scenes ? (
        <SituationDrill scenes={scenes} onClose={() => setDrill(false)} />
      ) : (
        <>
          <section aria-labelledby="sp-scenes" className="flex flex-col gap-3">
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
                {ready.map((s) => (
                  <SceneCard key={s.id} scene={s} onOpen={() => setOpenId(s.id)} />
                ))}
              </div>
            )}
            {broken.length > 0 && (
              <details className="group text-sm text-muted" data-testid="scenes-incomplete">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 hover:text-fg">
                  <Icon name="chevronDown" size={16} className="transition-transform group-open:rotate-180" />
                  {tn('spIncomplete', broken.length)}
                </summary>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  {broken.map((s) => (
                    <SceneCard key={s.id} scene={s} onOpen={() => setOpenId(s.id)} />
                  ))}
                </div>
              </details>
            )}
          </section>

          {situations && situations.length > 0 && (
            <section className="flex flex-col gap-2 border-t border-line pt-5" aria-labelledby="sp-sit">
              <h2 id="sp-sit" className="lx-eyebrow">
                {t('sitTitle')}
              </h2>
              <p className="text-sm text-muted">{t('sitLead', { n: situations.length })}</p>
              <div>
                <Button icon="cards" onClick={() => setDrill(true)} data-testid="situation-start">
                  {t('sitStart')}
                </Button>
              </div>
            </section>
          )}
        </>
      )}

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
    </div>
  );
}

// Lernberatung 27.09.: freiwillige Sprech- und Formulierübungen an einem Ort (kein Zwischen-Hub).
const TRAINING: ReadonlyArray<{ id: 'fluency' | 'meeting' | 'tones'; title: MessageKey; lead: MessageKey; icon: IconName }> = [
  { id: 'meeting', title: 'mtTitle', lead: 'spTrMeetingLead', icon: 'briefcase' },
  { id: 'fluency', title: 'fluTitle', lead: 'spTrFluencyLead', icon: 'bolt' },
  { id: 'tones', title: 'tnTitle', lead: 'spTrTonesLead', icon: 'chat' },
];

function TrainingSection() {
  const { t } = useT();
  const go = useNav((s) => s.go);
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-5" aria-labelledby="sp-training">
      <h2 id="sp-training" className="lx-eyebrow">
        {t('spTraining')}
      </h2>
      <ul className="flex flex-col divide-y divide-line" data-testid="speak-training">
        {TRAINING.map((e) => (
          <li key={e.id}>
            <button type="button" data-testid={`training-${e.id}`} onClick={() => go({ name: e.id })} className="flex min-h-16 w-full items-center gap-3 py-3 text-left transition-colors hover:text-fg">
              <ChannelIcon channel="speak">
                <Icon name={e.icon} />
              </ChannelIcon>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-base font-semibold">{t(e.title)}</span>
                <span className="text-sm text-muted">{t(e.lead)}</span>
              </span>
              <Icon name="arrowRight" size={18} className="flex-none text-subtle" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
