import { motion } from 'framer-motion';
import { useEffect, useMemo, type ReactNode } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { entriesFor } from '../../app/registry';
import { useLive } from '../../data/live';
import { useAiAvailable } from '../../ai/scope';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT, type MessageKey } from '../../i18n';
import { feasible } from '../../domain/plan/channels';
import { unlockSpeech, useSpeech } from '../../platform/speech';
import { ChannelIcon, type Channel } from '../../ui/Card';
import { Icon, type IconName } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { drillCards, startDrill, type DrillKind } from '../drills/session';
import { loadLearnInputs, useLearnInputs } from '../learn/inputs';
import { TabTitle } from '../system/Chrome';
import { feasibleData } from '../today/store';
import { useComboPairs } from './ComboSentence';
import { useOpenRepairs } from './RepairRound';

// Reiter „Anwenden“ (Emrahs Wunsch 04.10.2026): Wörter und Grammatik zusammen benutzen – Hören und
// Aufschreiben, Sätze bauen, freies Sprechen. Alles hier ist freiwillig und zählt nie zur Pflicht (Kap. 2.6);
// der Fortschritt zeigt weiter nur Wörter und Grammatik. Übungen, die gerade nicht machbar sind, erscheinen
// nicht – kein toter Knopf. Test-IDs `hub-drill-*` bleiben wie im bisherigen Üben-Hub.

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
};

type DrillTile = { kind: DrillKind; icon: IconName; title: MessageKey; sub: MessageKey; channel: Channel };
const LISTEN_WRITE: DrillTile[] = [{ kind: 'dictate', icon: 'headphones', title: 'drDictate', sub: 'lhDictateSub', channel: 'listen' }];
const BUILD: DrillTile[] = [
  { kind: 'cloze', icon: 'link', title: 'drCloze', sub: 'lhClozeSub', channel: 'cards' },
  { kind: 'order', icon: 'grid', title: 'drOrder', sub: 'lhOrderSub', channel: 'grammar' },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <motion.section variants={item} className="flex flex-col gap-3" aria-labelledby={id}>
      <h2 id={id} className="lx-eyebrow">
        {title}
      </h2>
      {children}
    </motion.section>
  );
}

function Tile({ icon, channel, title, sub, onClick, testId }: { icon: IconName; channel: Channel; title: string; sub: string; onClick: () => void; testId: string }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} className="lx-glass flex min-h-28 flex-col items-start gap-2 rounded-[var(--radius-card)] p-4 text-left transition-colors hover:bg-surface-strong">
      <ChannelIcon channel={channel}>
        <Icon name={icon} />
      </ChannelIcon>
      <span className="font-medium">{title}</span>
      <span className="text-xs text-muted">{sub}</span>
    </button>
  );
}

export function ApplyHub() {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const now = useClock((s) => s.now);
  const vocab = useLive((s) => s.collections.vocab);
  const tts = useSpeech((s) => s.status === 'ready');
  const inputs = useLearnInputs((s) => s.status);
  const openRepairs = useOpenRepairs();
  const combo = entriesFor('apply');
  const ai = useAiAvailable();
  const comboPairs = useComboPairs();

  useEffect(() => {
    if (useLearnInputs.getState().status === 'idle') void loadLearnInputs();
  }, []);

  const data = useMemo(() => {
    const cards = drillCards(now);
    return feasibleData(cards, lang, now);
    // `inputs` und `vocab`: neu rechnen, sobald Pool bzw. Karten da sind.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, lang, inputs, vocab]);

  const startDrillRound = (kind: DrillKind) => {
    unlockSpeech();
    const first = startDrill(kind);
    if (first === 'typed') api.focusNow();
    else api.blur();
    go({ name: 'drill', kind, ctx: 'xtra' });
  };
  const tiles = (list: DrillTile[]) =>
    list
      .filter((d) => feasible(d.kind, data, { tts }))
      .map((d) => <Tile key={d.kind} icon={d.icon} channel={d.channel} title={t(d.title)} sub={t(d.sub)} onClick={() => startDrillRound(d.kind)} testId={`hub-drill-${d.kind}`} />);
  const listenWrite = tiles(LISTEN_WRITE);
  const build = tiles(BUILD);

  return (
    <motion.div className="flex flex-col gap-8 py-6 sm:py-10" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }} data-testid="apply-hub">
      <motion.div variants={item}>
        <TabTitle title={t('apTitle')} sub={t('apLead')} />
      </motion.div>

      <Section id="ap-listen" title={t('apListenWrite')}>
        <div className="grid grid-cols-2 gap-3">
          {listenWrite}
          {tts && ai && <Tile icon="headphones" channel="listen" title={t('apListenQ')} sub={t('apListenQSub')} onClick={() => { unlockSpeech(); go({ name: 'listenQ' }); }} testId="hub-listen-q" />}
          {tts && <Tile icon="speaker" channel="listen" title={t('nbWsLoopTitle')} sub={t('nbWsLoopSub')} onClick={() => { unlockSpeech(); go({ name: 'listenLoop' }); }} testId="hub-listen-loop" />}
        </div>
      </Section>

      {build.length > 0 && (
        <Section id="ap-build" title={t('apBuild')}>
          <div className="grid grid-cols-2 gap-3">{build}</div>
        </Section>
      )}

      {(combo.length > 0 || (ai && comboPairs.length > 0)) && (
        <Section id="ap-combo" title={t('apCombo')}>
          <p className="-mt-1 text-sm text-muted">{t('apComboLead')}</p>
          <div className="grid grid-cols-2 gap-3">
            {ai && comboPairs.length > 0 && <Tile icon="sparkle" channel="grammar" title={t('apComboOwn')} sub={t('apComboOwnSub')} onClick={() => go({ name: 'comboSentence' })} testId="hub-combo-own" />}
            {combo.map((e) => (
              <Tile key={e.id} icon={e.icon} channel="grammar" title={t(e.label)} sub={e.sub ? t(e.sub) : ''} onClick={() => (e.start ? e.start(api) : e.route ? go(e.route) : undefined)} testId={e.id} />
            ))}
          </div>
        </Section>
      )}

      {openRepairs.length > 0 && (
        <Section id="ap-repair" title={t('apRepair')}>
          <div className="grid grid-cols-2 gap-3">
            <Tile icon="refresh" channel="grammar" title={t('apRepair')} sub={t('apRepairSub', { n: openRepairs.length })} onClick={() => go({ name: 'repairRound' })} testId="hub-repair-round" />
          </div>
        </Section>
      )}

      <Section id="ap-speak" title={t('apSpeak')}>
        <div className="grid grid-cols-2 gap-3">
          <Tile icon="chat" channel="speak" title={t('apRoleplay')} sub={t('apRoleplaySub')} onClick={() => go({ name: 'speak' })} testId="hub-speak" />
        </div>
      </Section>
    </motion.div>
  );
}
