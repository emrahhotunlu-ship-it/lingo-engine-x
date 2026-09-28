import { motion } from 'framer-motion';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNav } from '../../app/nav';
import { HubSections } from '../../app/shell/Hub';
import { entriesFor, type EntryDef } from '../../app/registry';
import type { Place } from '../../app/shell/tabs';
import { useWeek } from '../../app/useWeek';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT, type MessageKey } from '../../i18n';
import { useAiAvailable } from '../../ai/scope';
import { useCollection } from '../../data/watch';
import { themeScene } from '../../domain/speak/bizScenes';
import { AI_SCENE_HINT_AT } from '../../domain/speak/sceneDoc';
import type { SceneView } from '../../domain/speak/types';
import { nextMeeting } from '../../domain/meeting/next';
import { Button } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/Icon';
import { Row, RowList } from '../../ui/RowList';
import type { Channel } from '../../ui/Card';
import { Segmented } from '../../ui/Segmented';
import { Skeleton } from '../../ui/Skeleton';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { PreplySection } from '../preply/PreplyScreen';
import { TabTitle } from '../system/Chrome';
import { SceneBriefing } from './SceneBriefing';
import { SceneCard } from './SceneCard';
import { SceneCreateSheet } from './SceneCreateSheet';
import { SituationDrill, useSituationPool } from './SituationDrill';
import { useSceneLibrary } from './useSceneLibrary';
import { useSpeakToday } from './useTodayEntries';
import { useCompanionSee } from '../companion/seeing';
import { useClock } from '../../app/clock';

// Reiter „Sprechen“ (Neubau plan.md §1.3, N70): Umschalter Gespräche · Schreiben · Preply.
// - Gespräche: „Diese Woche“ (Szene zum Wochenthema, Termin), Szenen (Business-Bibliothek aus P7a,
//   eigene Szenen, „Neue Szene“, unvollständige zugeklappt), Training (eigene Zeilen + Einstiege
//   anderer Bereiche am Platz `speak`, z. B. Einwand-Training von P7), weitere Gruppen (Aussprache).
// - Schreiben: Sag es, E-Mail verbessern, Drei Tonlagen + Einstiege am Platz `write` (P4, P7).
// - Preply: die Preply-Brücke.
// Optik wie Prototyp v1: Zeilenlisten in einer Karte, Eyebrow-Überschriften. Keine Layout-Animation.

export type SpeakSegNb = 'talk' | 'write' | 'preply';

/** Alte Namen (Deep-Links, Specs) auf die neuen Bereiche abbilden. */
export function normSeg(seg: string | undefined | null): SpeakSegNb | null {
  if (seg === 'talk' || seg === 'scenes') return 'talk';
  if (seg === 'write' || seg === 'business') return 'write';
  if (seg === 'preply') return 'preply';
  return null;
}

/** Zuletzt gewählter Bereich (nur im Speicher): ein Reiterwechsel kehrt dorthin zurück. */
let lastSeg: SpeakSegNb = 'talk';

const PLACE_OF: Record<SpeakSegNb, Place | null> = { talk: 'speak', write: 'write', preply: null };

export function SpeakHub() {
  const { t } = useT();
  const routeSeg = useNav((s) => (s.route.name === 'speak' ? s.route.seg : undefined));
  const go = useNav((s) => s.go);
  const seg: SpeakSegNb = normSeg(routeSeg) ?? lastSeg;
  useEffect(() => {
    lastSeg = seg;
  }, [seg]);
  const place = PLACE_OF[seg];

  return (
    <div data-testid="speak-hub" data-seg={seg} className="flex flex-col gap-5 py-6 sm:py-8">
      <TabTitle title={t('spTitle')} sub={<SpeakStatus />} />
      <div className="max-w-md">
        <Segmented
          label={t('spSegLabel')}
          value={seg}
          testId="speak-seg"
          options={[
            { value: 'talk', label: t('nbSprechenSegTalk'), testId: 'speak-seg-talk' },
            { value: 'write', label: t('nbSprechenSegWrite'), testId: 'speak-seg-write' },
            { value: 'preply', label: t('spSegPreply'), testId: 'speak-seg-preply' },
          ]}
          onChange={(v) => go({ name: 'speak', seg: v })}
        />
      </div>
      <motion.div key={seg} className="flex flex-col gap-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: DURATION.fast, ease: EASE_OUT }}>
        {seg === 'talk' && <TalkSegment />}
        {seg === 'write' && <WriteSegment />}
        {seg === 'preply' && <PreplySection />}
        {place && <HubSections places={[place]} />}
      </motion.div>
    </div>
  );
}

/**
 * Sprech-Status (I15): nur, wenn Block 3 der heutigen Tageseinheit ein Gespräch ist – sonst gäbe
 * es zwei Zähler für dieselbe Pflicht (Kap. 2.2). Zustand, kein Knopf.
 */
function SpeakStatus() {
  const { t } = useT();
  const { plan } = useWeek();
  const today = useSpeakToday();
  const talkToday = !!plan?.blocks.some((b) => b.block === 3 && (b.kind === 'task.roleplay' || b.kind === 'task.meeting'));
  if (!talkToday || !today.loaded) return null;
  return (
    <p data-testid="speak-status" data-done={today.done} className={`flex items-center gap-2 text-sm ${today.done ? 'text-accent-text' : 'text-muted'}`}>
      {today.done && <Icon name="check" size={16} />}
      {today.done ? t('spStatusDone') : t('nbSprechenStatusOpen')}
    </p>
  );
}

// ---------------------------------------------------------------- Zeilen

export type RowItem = {
  id: string;
  icon: IconName;
  title: string;
  sub?: string;
  disabled?: boolean;
  run: () => void;
  /** Kanalfarbe des Symbols (Token). */
  tone?: 'speak' | 'write' | 'gold' | 'cyan';
};

const CHANNEL: Record<NonNullable<RowItem['tone']>, Channel> = { speak: 'speak', write: 'write', gold: 'business', cyan: 'listen' };

/** Zeilenliste in einer Karte (WP0b-Bausteine `RowList`/`Row`, Optik wie v1). */
export function RowCard({ rows, label, testId }: { rows: readonly RowItem[]; label?: string; testId?: string }) {
  if (!rows.length) return null;
  return (
    <RowList {...(label ? { title: label } : {})} {...(testId ? { testId } : {})}>
      {rows.map((r) => (
        <Row key={r.id} testId={r.id} icon={r.icon} {...(r.tone ? { channel: CHANNEL[r.tone] } : {})} title={r.title} sub={r.sub} disabled={r.disabled} onClick={r.run} />
      ))}
    </RowList>
  );
}

/** Einstiege anderer Bereiche als Zeilen (synchroner Start im Klick, iPhone-Tastatur). */
function useEntryRows(entries: readonly EntryDef[]): RowItem[] {
  const { t } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  return entries.map((e) => ({
    id: e.id,
    icon: e.icon,
    title: t(e.label),
    ...(e.sub ? { sub: t(e.sub) } : {}),
    run: () => {
      if (e.start) e.start(api);
      else if (e.route) go(e.route);
    },
  }));
}

const GROUP_TITLE: Record<string, MessageKey> = { pron: 'nbSprechenPron', aussprache: 'nbSprechenPron', pronunciation: 'nbSprechenPron' };

/** Weitere Gruppen eines Platzes (z. B. „Aussprache“ von P7) – je Gruppe eine Liste. */
function OtherGroups({ place, skip }: { place: Place; skip: readonly (string | undefined)[] }) {
  const { t } = useT();
  const all = entriesFor(place).filter((e) => !skip.includes(e.group));
  const groups = [...new Set(all.map((e) => e.group ?? ''))];
  return (
    <>
      {groups.map((g) => (
        <GroupRows key={g || '_'} title={GROUP_TITLE[g] ? t(GROUP_TITLE[g]) : undefined} entries={all.filter((e) => (e.group ?? '') === g)} testId={`speak-group-${g || 'other'}`} />
      ))}
    </>
  );
}

function GroupRows({ title, entries, testId }: { title?: string; entries: readonly EntryDef[]; testId: string }) {
  const rows = useEntryRows(entries);
  return <RowCard rows={rows} {...(title ? { label: title } : {})} testId={testId} />;
}

// ---------------------------------------------------------------- Gespräche

function TalkSegment() {
  const { t, tn, lang } = useT();
  const ai = useAiAvailable();
  const go = useNav((s) => s.go);
  const { scenes } = useSceneLibrary();
  const { theme } = useWeek();
  useCompanionSee({ area: 'speak', label: t('spTitle'), phase: 'idle' });
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [drill, setDrill] = useState(false);
  const [allBiz, setAllBiz] = useState(false);
  const situations = useSituationPool(scenes, lang, 0);
  const open = scenes?.find((s) => s.id === openId) ?? null;
  const week = useMemo(() => (scenes ? themeScene(scenes, theme?.scene, theme?.id) : null), [scenes, theme]);
  const meetings = useCollection('meeting');
  const today = useClock((s) => s.today);
  const next = useMemo(() => nextMeeting(meetings, today), [meetings, today]);

  const weekRows: RowItem[] = [];
  if (week) {
    weekRows.push({
      id: 'speak-theme-scene',
      icon: 'mic',
      tone: 'speak',
      title: t('nbSprechenWeekScene', { title: week.title }),
      sub: t('nbSprechenWeekSceneSub', { name: week.persona?.name ?? '' }),
      run: () => setOpenId(week.id),
    });
  }
  weekRows.push({
    id: 'training-meeting',
    icon: 'briefcase',
    tone: 'gold',
    title: next ? t('nbSprechenNextMeeting', { who: next.who }) : t('mtTitle'),
    sub: next ? [next.when, next.topic].filter(Boolean).join(' · ') : t('nbSprechenMeetingSub'),
    // Die Seite „Mein nächster Termin“ zeigt die Liste mit dem Termin oben (Vorbereitung, Generalprobe).
    run: () => go({ name: 'meeting' }),
  });

  const ready = scenes?.filter((s) => s.valid && s.id !== week?.id) ?? [];
  const biz = ready.filter((s) => s.raw.src === 'biz');
  const own = ready.filter((s) => s.raw.src !== 'biz');
  const broken = scenes?.filter((s) => !s.valid) ?? [];
  const aiCount = scenes?.filter((s) => s.src === 'ai').length ?? 0;
  const bizShown = allBiz ? biz : biz.slice(0, 4);

  const trainingRows: RowItem[] = [
    { id: 'training-fluency', icon: 'bolt', tone: 'cyan', title: t('fluTitle'), sub: t('nbSprechenFluencySub'), run: () => go({ name: 'fluency' }) },
    { id: 'biz-pitch', icon: 'chat', tone: 'speak', title: t('bizPitch'), sub: ai ? t('bizPitchLead') : t('bizNoAi'), disabled: !ai, run: () => go({ name: 'pitch' }) },
    { id: 'biz-playbook', icon: 'cards', tone: 'speak', title: t('nbSprechenPlaybook'), sub: t('bizPlayLead'), run: () => go({ name: 'playbook' }) },
  ];
  if (situations && situations.length > 0) {
    trainingRows.push({ id: 'situation-start', icon: 'layers', tone: 'speak', title: t('nbSprechenSceneChunks'), sub: t('sitLead', { n: situations.length }), run: () => setDrill(true) });
  }
  const foreignTraining = useEntryRows(entriesFor('speak', 'training'));

  if (drill && scenes) return <SituationDrill scenes={scenes} onClose={() => setDrill(false)} />;

  return (
    <>
      {!ai && (
        <p data-testid="speak-noai" className="rounded-2xl bg-surface px-4 py-3 text-sm text-muted">
          {t('spNoAi')}
        </p>
      )}
      <RowCard rows={weekRows} label={t('nbSprechenThisWeek')} testId="speak-week" />

      <section aria-labelledby="sp-scenes" className="flex flex-col gap-3" data-testid="speak-scenes">
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
          <>
            {biz.length > 0 && (
              <SceneGroup label={t('nbSprechenBizScenes')} testId="scenes-biz" scenes={bizShown} onOpen={setOpenId}>
                {biz.length > bizShown.length && (
                  <Button variant="ghost" icon="chevronDown" onClick={() => setAllBiz(true)} data-testid="scenes-biz-more">
                    {t('nbSprechenAllScenes', { n: biz.length })}
                  </Button>
                )}
              </SceneGroup>
            )}
            {own.length > 0 && <SceneGroup label={t('nbSprechenOwnScenes')} testId="scenes-own" scenes={own} onOpen={setOpenId} />}
          </>
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

      <RowCard rows={[...trainingRows, ...foreignTraining]} label={t('spTraining')} testId="speak-training" />
      <OtherGroups place="speak" skip={['training']} />

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
    </>
  );
}

function SceneGroup({ label, testId, scenes, onOpen, children }: { label: string; testId: string; scenes: readonly SceneView[]; onOpen: (id: string) => void; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      <p className="text-sm font-medium text-muted">{label}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {scenes.map((s) => (
          <SceneCard key={s.id} scene={s} onOpen={() => onOpen(s.id)} />
        ))}
      </div>
      {children && <div>{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Schreiben

function WriteSegment() {
  const { t } = useT();
  const ai = useAiAvailable();
  const go = useNav((s) => s.go);
  useCompanionSee({ area: 'write', label: t('nbSprechenSegWrite'), phase: 'idle' });
  const own: RowItem[] = [
    { id: 'write-say', icon: 'mic', tone: 'write', title: t('sayTitle'), sub: t('nbSprechenSaySub'), run: () => go({ name: 'say' }) },
    { id: 'biz-mail', icon: 'copy', tone: 'write', title: t('nbSprechenMail'), sub: ai ? t('bizMailLead') : t('bizNoAi'), disabled: !ai, run: () => go({ name: 'mail' }) },
    { id: 'training-tones', icon: 'chat', tone: 'write', title: t('tnTitle'), sub: t('spTrTonesLead'), run: () => go({ name: 'tones' }) },
  ];
  const foreign = useEntryRows(entriesFor('write').filter((e) => !e.group || e.group === 'write'));
  return (
    <>
      <RowCard rows={[...own, ...foreign]} label={t('nbSprechenWriteTasks')} testId="speak-write" />
      <OtherGroups place="write" skip={[undefined, 'write']} />
    </>
  );
}
