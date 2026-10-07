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
import { fehlersaetzeDue, fixToday } from '../../domain/metrics';
import { useInputProfile } from '../../platform/input';
import { Disclosure } from '../../ui/Disclosure';
import { useToday } from '../today/state';
import { Slot } from '../../app/slots';

// Reiter „Anwenden“ (Emrahs Wunsch 04.10.2026): Wörter und Grammatik zusammen benutzen – Hören und
// Aufschreiben, Sätze bauen, freies Sprechen. Alles hier ist freiwillig und zählt nie zur Pflicht (Kap. 2.6);
// der Fortschritt zeigt weiter nur Wörter und Grammatik. Übungen, die gerade nicht machbar sind, erscheinen
// nicht – kein toter Knopf. Test-IDs `hub-drill-*` bleiben wie im bisherigen Üben-Hub.

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
};

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

type TileData = { id: string; icon: IconName; channel: Channel; title: string; sub: string; meta: string; run: () => void };

function Tile({ icon, channel, title, sub, meta, onClick, testId, featured }: { icon: IconName; channel: Channel; title: string; sub: string; meta: string; onClick: () => void; testId: string; featured?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      data-featured={featured ? 'true' : undefined}
      className="lx-glass flex h-full min-h-36 w-full flex-col items-start gap-1.5 rounded-[var(--radius-card)] p-4 text-left transition-colors hover:bg-surface-strong"
    >
      <ChannelIcon channel={channel}>
        <Icon name={icon} />
      </ChannelIcon>
      <span className="font-medium">{title}</span>
      <span className="text-xs text-muted">{sub}</span>
      <span className="lx-tnum mt-auto flex items-center gap-1 text-xs font-medium text-subtle" data-testid="tile-meta" data-meta={meta}>
        {meta.split(' · ').map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden="true">·</span>}
            <span>{part}</span>
          </span>
        ))}
      </span>
    </button>
  );
}

const GRID = 'grid auto-rows-fr grid-cols-2 gap-3 lg:grid-cols-3';

export function ApplyHub() {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const vocab = useLive((s) => s.collections.vocab);
  const grammar = useLive((s) => s.collections.grammar);
  const repairDoc = useLive((s) => s.docs['app/repair']);
  const plan = useToday((s) => s.plan);
  const fixOpen = useToday((s) => s.duties.items.some((d) => d.id === 'ch:u-again' && d.state === 'open'));
  const tts = useSpeech((s) => s.status === 'ready');
  const inputs = useLearnInputs((s) => s.status);
  const profile = useInputProfile();
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

  // „Weitere Fehlersätze“: nur, was nach Schritt 4 von heute noch fällig ist (§2.6), nie dieselben Sätze zweimal anbieten.
  const moreFix = useMemo(() => {
    const due = fehlersaetzeDue({ grammarDocs: grammar ?? new Map(), repairDoc, nowMs: now, today });
    return fixOpen ? Math.max(0, due - fixToday({ plan, fixDue: due })) : due;
  }, [grammar, repairDoc, now, today, plan, fixOpen]);

  const startDrillRound = (kind: DrillKind) => {
    unlockSpeech();
    const first = startDrill(kind);
    if (first === 'typed') api.focusNow();
    else api.blur();
    go({ name: 'drill', kind, ctx: 'xtra' });
  };
  const entry = (id: string): TileData | null => {
    const e = combo.find((x) => x.id === id);
    if (!e) return null;
    return { id, icon: e.icon, channel: 'grammar', title: t(e.label), sub: e.sub ? t(e.sub) : '', meta: '', run: () => (e.start ? e.start(api) : e.route ? go(e.route) : undefined) };
  };
  const touch = t('hxApplyTouch');
  const phones = t('hxApplyPhones');
  const laptop = t('hxApplyLaptop');
  const drill = (kind: DrillKind, icon: IconName, title: MessageKey, sub: MessageKey, channel: Channel, meta: string): TileData | null =>
    feasible(kind, data, { tts }) ? { id: `hub-drill-${kind}`, icon, channel, title: t(title), sub: t(sub), meta, run: () => startDrillRound(kind) } : null;
  const withMeta = (e: TileData | null, meta: string, title?: string): TileData | null => (e ? { ...e, meta, ...(title ? { title } : {}) } : null);
  const own: TileData | null = ai && comboPairs.length > 0 ? { id: 'hub-combo-own', icon: 'sparkle', channel: 'grammar', title: t('apComboOwn'), sub: t('apComboOwnSub'), meta: laptop, run: () => go({ name: 'comboSentence' }) } : null;
  const listenQ: TileData | null = tts && ai ? { id: 'hub-listen-q', icon: 'headphones', channel: 'listen', title: t('apListenQ'), sub: t('apListenQSub'), meta: phones, run: () => { unlockSpeech(); go({ name: 'listenQ' }); } } : null;
  const loop: TileData | null = tts ? { id: 'hub-listen-loop', icon: 'speaker', channel: 'listen', title: t('nbWsLoopTitle'), sub: t('nbWsLoopSub'), meta: phones, run: () => { unlockSpeech(); go({ name: 'listenLoop' }); } } : null;
  const dictate = drill('dictate', 'headphones', 'drDictate', 'lhDictateSub', 'listen', laptop);
  const order = drill('order', 'grid', 'drOrder', 'lhOrderSub', 'grammar', touch);
  const cloze = drill('cloze', 'link', 'drCloze', 'lhClozeSub', 'cards', touch);
  const wordPartner = withMeta(entry('training-colloc'), touch, t('hxApplyWordPartner'));
  const ruleTiles = [withMeta(entry('training-wordform'), touch), withMeta(entry('training-register'), touch), withMeta(entry('training-phrasal'), touch), withMeta(entry('training-transition'), touch)];
  const transform = withMeta(entry('training-transform'), laptop);
  const speak: TileData = { id: 'hub-speak', icon: 'chat', channel: 'speak', title: t('apRoleplay'), sub: t('apRoleplaySub'), meta: profile === 'touch' ? t('hxApplySpeakPhone') : laptop, run: () => go({ name: 'speak' }) };
  const repair: TileData | null = moreFix > 0 ? { id: 'hub-repair-round', icon: 'refresh', channel: 'grammar', title: t('hxApplyMoreFix', { n: moreFix }), sub: t('apRepairSub', { n: moreFix }), meta: touch, run: () => go({ name: 'repairRound' }) } : null;

  const list = (xs: Array<TileData | null>): TileData[] => xs.filter((x): x is TileData => x !== null);
  const render = (xs: TileData[], featured?: string) => xs.map((x) => <Tile key={x.id} icon={x.icon} channel={x.channel} title={x.title} sub={x.sub} meta={x.meta} onClick={x.run} testId={x.id} featured={x.id === featured} />);

  // Reihenfolge nach Gerät (§2.6): Handy zuerst kurze Textübungen, Kopfhörer-Übungen danach, Laptop-Übungen eingeklappt; Laptop: Hören und Schreiben oben.
  const phoneFirst = list([repair, wordPartner, order, ...ruleTiles]);
  const featured = phoneFirst[0];
  const phoneRest = phoneFirst.slice(1);
  const listenTiles = list([listenQ, loop]);
  const laptopTiles = list([dictate, own, transform, speak]);
  const more = list([cloze]);

  return (
    <motion.div className="mx-auto flex w-full max-w-[70rem] flex-col gap-8 py-6 sm:py-10" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }} data-testid="apply-hub" data-profile={profile}>
      <motion.div variants={item}>
        <TabTitle title={t('apTitle')} sub={t('apLead')} />
      </motion.div>

      {profile === 'touch' ? (
        <>
          {featured && (
            <Section id="ap-now" title={t('hxApplyNow')}>
              <div className={GRID}>{render([featured], featured.id)}</div>
            </Section>
          )}
          {phoneRest.length > 0 && (
            <Section id="ap-build" title={t('apBuild')}>
              <div className={GRID}>{render(phoneRest)}</div>
            </Section>
          )}
          {listenTiles.length > 0 && (
            <Section id="ap-listen" title={t('hxApplyHeadphones')}>
              <div className={GRID}>{render(listenTiles)}</div>
            </Section>
          )}
          <motion.div variants={item}>
            <Disclosure label={t('hxApplyLaptopFold', { n: laptopTiles.length })} testId="apply-laptop-fold">
              <div className={GRID}>{render(laptopTiles)}</div>
            </Disclosure>
          </motion.div>
        </>
      ) : (
        <>
          <Section id="ap-listen" title={t('apListenWrite')}>
            <div className={GRID}>{render(list([dictate, listenQ, loop, own]))}</div>
          </Section>
          <Section id="ap-build" title={t('apBuild')}>
            <div className={GRID}>{render(list([repair, wordPartner, order, ...ruleTiles, transform]))}</div>
          </Section>
          <Section id="ap-speak" title={t('apSpeak')}>
            <div className={GRID}>{render([speak])}</div>
          </Section>
        </>
      )}

      <Slot name="apply.tiles" />

      {more.length > 0 && (
        <motion.div variants={item}>
          <Disclosure label={t('hxApplyMore')} testId="apply-more">
            <div className={GRID}>{render(more)}</div>
          </Disclosure>
        </motion.div>
      )}
    </motion.div>
  );
}
