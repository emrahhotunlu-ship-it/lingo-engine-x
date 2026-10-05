import { motion } from 'framer-motion';
import { useMemo, useState, type ReactNode } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { openSheet } from '../../app/sheets';
import { entriesFor } from '../../app/registry';
import { useLive } from '../../data/live';
import { dueErrors } from '../../domain/grammar/errors';
import { introTopic, isNewTopic, pathTopics, TOPIC_ROUND_MIN } from '../../domain/grammar/path';
import { rankTopics } from '../../domain/grammar/tasks';
import { dueRepairs, readRepairs } from '../../domain/repair/repair';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { ChannelIcon } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { useCompanionSee } from '../companion/seeing';
import { TabTitle } from '../system/Chrome';
import { TopicSheet } from '../grammar/GrammarScreen';
import { PathList } from '../grammar/PathList';
import { startGrammar } from '../grammar/session';
import { topicName } from '../grammar/topicUi';

// Reiter „Grammatik“ (Gesamtkonzept 3.4, UX-Ziel Kap. 3.3): Weiter-Karte („Als Nächstes: Thema · n Min.“, ein Knopf),
// der Pfad aller Themen in Lehrreihenfolge B2 → C1 mit Zustand je Thema, die Zeile „Fehler korrigieren · n fällig“
// und die Zeile „Extra“. Nichts ist gesperrt. Pflicht steht auf „Heute“ (Kap. 2.6).

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
};

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();

/** Eine Zeilenform für „öffnen“ (visuelle Regel 6): Symbol links, Titel + Nebenzeile, Pfeil rechts. */
function Row({ icon, title, sub, onClick, testId, badge }: { icon: ReactNode; title: string; sub?: string; onClick: () => void; testId: string; badge?: string | null }) {
  return (
    <li>
      <button type="button" onClick={onClick} data-testid={testId} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-strong">
        {icon}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{title}</span>
          {sub && <span className="text-sm text-muted">{sub}</span>}
        </span>
        {badge && <span className="flex-none rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-medium text-gold-text">{badge}</span>}
        <Icon name="arrowRight" size={18} className="flex-none text-subtle" />
      </button>
    </li>
  );
}

/** Einstiege anderer Bereiche auf dem Platz `learn` ohne eigene Gruppe (z. B. „Lehrer-Feedback einfügen“): nichts geht verloren. */
function ForeignRows() {
  const { t } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const list = entriesFor('learn');
  if (!list.length) return null;
  return (
    <motion.section variants={item} className="flex flex-col gap-3" aria-label={t('nbLernenHubTraining')}>
      <ul className="lx-glass flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)]">
        {list.map((e) => (
          <Row
            key={e.id}
            icon={<ChannelIcon channel="grammar"><Icon name={e.icon} /></ChannelIcon>}
            title={t(e.label)}
            sub={e.sub ? t(e.sub) : ''}
            onClick={() => (e.start ? e.start(api) : e.route ? go(e.route) : undefined)}
            testId={e.id}
          />
        ))}
      </ul>
    </motion.section>
  );
}

export function LearnHub() {
  const { t, tn, lang } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const docs = useLive((s) => s.collections.grammar) ?? EMPTY;
  const repairDoc = useLive((s) => s.docs['app/repair']);
  const [open, setOpen] = useState<string | null>(null);
  useCompanionSee({ area: 'grammar', label: t('grTitle'), phase: 'idle' });

  // „Als Nächstes“: das eine neue Thema des Tages (Pfadreihenfolge, wenn die Bremse es erlaubt), sonst das schwächste begonnene Thema.
  const next = useMemo(() => {
    const intro = introTopic(docs, today);
    if (intro) return { id: intro, fresh: true };
    const ranked = rankTopics({ grammarDocs: docs, nowMs: now, seed: today, introduce: null });
    const id = ranked[0]?.topic ?? pathTopics()[0];
    return id ? { id, fresh: isNewTopic(docs.get(id)) } : null;
  }, [docs, now, today]);
  const nGrammar = useMemo(() => dueErrors(docs, now).length, [docs, now]);
  const nRepair = useMemo(() => dueRepairs(readRepairs(repairDoc ?? undefined), now).length, [repairDoc, now]);
  const nDue = nGrammar + nRepair;

  const startNext = () => {
    if (!next) return;
    const first = startGrammar({ mode: 'topic', topic: next.id });
    // Ein neues Thema beginnt mit der Mini-Lektion, dort gibt es noch keine Tastatur.
    if (first === 'typed' && !next.fresh) api.focusNow();
    go({ name: 'grammarSession', mode: 'topic', topic: next.id });
  };

  const startErrors = () => {
    if (nGrammar > 0) {
      const first = startGrammar({ mode: 'errors' });
      if (first === 'typed') api.focusNow();
      go({ name: 'grammarSession', mode: 'errors' });
    } else go({ name: 'repairRound' });
  };

  return (
    <motion.div className="flex flex-col gap-6 py-6 sm:py-10" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }} data-testid="learn-hub">
      <motion.div variants={item}>
        <TabTitle title={t('lhTitle')} />
      </motion.div>

      {next && (
        <motion.section variants={item} className="lx-glass flex flex-col gap-3 rounded-[var(--radius-card)] p-5" aria-labelledby="lh-next" data-testid="hub-next-topic" data-topic={next.id}>
          <p id="lh-next" className="lx-eyebrow">
            {t('nbLernenNextEyebrow')}
          </p>
          <p className="text-lg font-semibold tracking-tight">{topicName(next.id, lang)}</p>
          <p className="text-sm text-muted">{next.fresh ? t('nbLernenNextNew', { n: TOPIC_ROUND_MIN + 1 }) : t('nbLernenNextMin', { n: TOPIC_ROUND_MIN })}</p>
          <div>
            <Button variant="primary" iconAfter="arrowRight" onClick={startNext} data-testid="hub-next-start">
              {next.fresh ? t('nbLernenNextStartNew') : t('nbLernenNextStart')}
            </Button>
          </div>
        </motion.section>
      )}

      <motion.section variants={item} className="flex flex-col gap-3" aria-labelledby="lh-path">
        <h2 id="lh-path" className="lx-eyebrow">
          {t('nbLernenPathTitle', { n: pathTopics().length })}
        </h2>
        <PathList onOpen={setOpen} highlight={next?.id ?? null} />
      </motion.section>

      <motion.div variants={item}>
        <ul className="lx-glass flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)]" aria-label={t('nbLernenHubErrors')} data-testid="hub-errors-list">
          {nDue > 0 ? (
            <Row
              icon={<ChannelIcon channel="grammar"><Icon name="refresh" /></ChannelIcon>}
              title={t('nbLernenFixRow', { n: nDue })}
              sub={t('nbLernenFixSub')}
              onClick={startErrors}
              testId="hub-errors"
              badge={tn('grDueBadge', nDue)}
            />
          ) : (
            <li className="flex min-h-14 items-center gap-3 px-4 py-3" data-testid="hub-errors-none">
              <ChannelIcon channel="grammar"><Icon name="check" /></ChannelIcon>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{t('nbLernenFixNone')}</span>
                <span className="text-sm text-muted">{t('nbLernenFixNoneSub')}</span>
              </span>
            </li>
          )}
          <Row icon={<ChannelIcon channel="grammar"><Icon name="layers" /></ChannelIcon>} title={t('nbLernenExtra')} sub={t('nbLernenExtraSub')} onClick={() => openSheet('x:extra')} testId="hub-extra" />
        </ul>
      </motion.div>

      <ForeignRows />

      <TopicSheet topic={open} onClose={() => setOpen(null)} />
    </motion.div>
  );
}
