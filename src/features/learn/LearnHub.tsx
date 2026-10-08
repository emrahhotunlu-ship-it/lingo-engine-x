import { motion } from 'framer-motion';
import { useMemo, useState, type ReactNode } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { openSheet } from '../../app/sheets';
import { entriesFor } from '../../app/registry';
import { useLive } from '../../data/live';
import { fehlersaetzeDue, fixAll, fixToday, grammarErrorsDue } from '../../domain/metrics';
import { canIntroduce, INTRO_BLOCK_ERRORS, introTopic, isNewTopic, pathTopics, TOPIC_ROUND_MIN } from '../../domain/grammar/path';
import { startUnitDuty } from '../unit/run';
import { rankTopics } from '../../domain/grammar/tasks';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { ChannelIcon } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { useCompanionSee } from '../companion/seeing';
import { useToday } from '../today/state';
import { TabTitle } from '../system/Chrome';
import { TopicSheet } from '../grammar/GrammarScreen';
import { PathList } from '../grammar/PathList';
import { startGrammar } from '../grammar/session';
import { topicName } from '../grammar/topicUi';
import { Slot } from '../../app/slots';
import { flags } from '../../app/flags';
import { Disclosure } from '../../ui/Disclosure';

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
  const { t, lang } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const docs = useLive((s) => s.collections.grammar) ?? EMPTY;
  const repairDoc = useLive((s) => s.docs['app/repair']);
  const [open, setOpen] = useState<string | null>(null);
  const program = flags.program;
  useCompanionSee({ area: 'grammar', label: t('grTitle'), phase: 'idle' });

  // „Als Nächstes“: das eine neue Thema des Tages (Pfadreihenfolge, wenn die Bremse es erlaubt), sonst das schwächste begonnene Thema.
  const planGt = useToday((s) => s.plan?.u?.gt);
  const next = useMemo(() => {
    // Gibt es einen Plan von heute mit eingefrorenem Grammatikthema (`u.gt`), gilt nur dieser Wert, nie eine Neuberechnung (Lernplattform 2.0 §2.3).
    const intro = planGt ? planGt.intro : introTopic(docs, today, now);
    if (intro) return { id: intro, fresh: true };
    const ranked = rankTopics({ grammarDocs: docs, nowMs: now, seed: today, introduce: null });
    const id = ranked[0]?.topic ?? pathTopics()[0];
    return id ? { id, fresh: isNewTopic(docs.get(id)) } : null;
  }, [docs, now, today, planGt]);
  // Eine Quelle je Zahl (`domain/metrics/today`): alle fälligen Fehlersätze, die Zahl auf dem Knopf (heute) und die Grammatikfehler der Bremse.
  const plan = useToday((s) => s.plan);
  const fixOpen = useToday((s) => s.duties.items.some((d) => d.id === 'ch:u-again' && d.state === 'open'));
  const nDue = useMemo(() => fixAll(fehlersaetzeDue({ grammarDocs: docs, repairDoc, nowMs: now, today })), [docs, repairDoc, now, today]);
  // Genau die Zahl der Sätze, die der Knopf „Fehlersätze korrigieren“ startet (Schritt 4 von heute oder die freiwillige Runde).
  const nToday = fixToday({ plan, fixDue: nDue });

  // Bremse wegen vieler fälliger Fehlersätze: ruhiger Hinweis mit Grund (kein Vorwurf).
  const braked = useMemo(() => canIntroduce(docs, today, now), [docs, today, now]);
  const nBrake = braked.ok ? 0 : braked.reason === 'errors' ? grammarErrorsDue({ grammarDocs: docs, nowMs: now, today }) : 0;
  const brakeActive = !braked.ok && braked.reason === 'errors' && nDue > 0;

  const startNext = () => {
    if (!next) return;
    const first = startGrammar({ mode: 'topic', topic: next.id });
    // Ein neues Thema beginnt mit der Mini-Lektion, dort gibt es noch keine Tastatur.
    if (first === 'typed' && !next.fresh) api.focusNow();
    go({ name: 'grammarSession', mode: 'topic', topic: next.id });
  };

  const startErrors = () => {
    // Schritt 4 von heute noch offen: Pflicht starten; sonst die freiwillige Runde mit derselben Grenze.
    if (fixOpen && startUnitDuty('ch:u-again', api)) return;
    go({ name: 'repairRound' });
  };

  const nextCard = next ? (
    <motion.section variants={item} className={program ? 'flex flex-col gap-3 rounded-[0.875rem] border border-line bg-surface-solid p-3.5' : 'lx-glass flex flex-col gap-3 rounded-[var(--radius-card)] p-5'} aria-labelledby="lh-next" data-testid="hub-next-topic" data-topic={next.id}>
        <p id="lh-next" className="lx-eyebrow">
          {t('nbLernenNextEyebrow')}
        </p>
        <p className="text-lg font-semibold tracking-tight">{topicName(next.id, lang)}</p>
        <p className="text-sm text-muted">{next.fresh ? t('nbLernenNextNew', { n: TOPIC_ROUND_MIN + 1 }) : t('nbLernenNextMin', { n: TOPIC_ROUND_MIN })}</p>
        {brakeActive ? (
          <>
            <div>
              <Button variant="primary" iconAfter="arrowRight" onClick={startErrors} data-testid="hub-next-start" data-action="fix" data-n={nToday}>
                {t('hxLearnFixBtn', { n: nToday })}
              </Button>
            </div>
            <p className="text-sm text-muted" data-testid="hub-intro-brake">
              {t('hxLearnBrake', { limit: INTRO_BLOCK_ERRORS, n: nBrake })}
            </p>
            <div>
              <button type="button" onClick={startNext} className="inline-flex min-h-11 items-center text-sm font-medium text-accent-text hover:underline" data-testid="hub-next-anyway">
                {t('hxLearnAnyway', { topic: topicName(next.id, lang) })}
              </button>
            </div>
          </>
        ) : (
          <div>
            <Button variant="primary" iconAfter="arrowRight" onClick={startNext} data-testid="hub-next-start" data-action="topic">
              {next.fresh ? t('hxLearnStartNew') : t('nbLernenNextStart')}
            </Button>
          </div>
        )}
      </motion.section>
  ) : null;

  return (
    <motion.div className="mx-auto flex w-full max-w-[47.5rem] flex-col gap-6 py-6 sm:py-10" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }} data-testid="learn-hub">
      <motion.div variants={item}>
        <TabTitle title={t('lhTitle')} />
      </motion.div>

      {/* Mit Programm steht die Weiter-Karte in der C1-Reise unter „Du bist hier“ (UX-Prüfung B2: eine rote Linie, ein Hauptknopf). */}
      <Slot name="grammar.head" props={{ next: nextCard }} />

      {!program && nextCard}

      <motion.div variants={item}>
        {nDue > 0 ? (
          <button type="button" onClick={startErrors} className="lx-glass flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-card)] px-4 py-3 text-left transition-colors hover:bg-surface-strong" data-testid="hub-errors" data-due={nDue} data-today={nToday}>
            <ChannelIcon channel="grammar"><Icon name="refresh" /></ChannelIcon>
            <span className="lx-tnum min-w-0 flex-1 font-medium">{t('hxLearnFixLine', { n: nDue, today: nToday })}</span>
            <Icon name="arrowRight" size={18} className="flex-none text-subtle" />
          </button>
        ) : (
          <p className="lx-glass flex min-h-14 items-center gap-3 rounded-[var(--radius-card)] px-4 py-3" data-testid="hub-errors-none">
            <ChannelIcon channel="grammar"><Icon name="check" /></ChannelIcon>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{t('nbLernenFixNone')}</span>
              <span className="text-sm text-muted">{t('nbLernenFixNoneSub')}</span>
            </span>
          </p>
        )}
      </motion.div>

      <Slot name="grammar.foot" />

      {program ? (
        // Mit Programm zeigt die Reise die Kapitel; die vollständige Themenliste steht eingeklappt (keine doppelten Kapitelköpfe, UX-Prüfung B2).
        <motion.section variants={item} className="flex flex-col gap-3" aria-label={t('nbLernenPathAll', { n: pathTopics().length })}>
          <Disclosure label={t('nbLernenPathAll', { n: pathTopics().length })} testId="hub-all-topics">
            <div className="pt-3">
              <PathList onOpen={setOpen} highlight={next?.id ?? null} program />
            </div>
          </Disclosure>
        </motion.section>
      ) : (
        <motion.section variants={item} className="flex flex-col gap-3" aria-labelledby="lh-path">
          <h2 id="lh-path" className="lx-eyebrow">
            {t('nbLernenPathTitle', { n: pathTopics().length })}
          </h2>
          <PathList onOpen={setOpen} highlight={next?.id ?? null} />
        </motion.section>
      )}

      <motion.div variants={item} className="flex flex-col gap-3">
        <div className="lx-glass flex min-h-14 flex-wrap items-center gap-x-1 gap-y-0 rounded-[var(--radius-card)] px-4 py-1" role="group" aria-label={t('hxLearnLookup')} data-testid="hub-lookup-row">
          <span className="flex-none font-medium">{t('hxLearnLookup')}</span>
          <span className="flex flex-wrap items-center">
            <button type="button" onClick={() => go({ name: 'wissen' })} className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-accent-text hover:underline" data-testid="hub-wissen">
              {t('hxLearnRules')}
            </button>
            <button type="button" onClick={() => go({ name: 'patterns' })} className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-accent-text hover:underline" data-testid="hub-traps">
              {t('hxLearnTraps')}
            </button>
            <button type="button" onClick={() => go({ name: 'grammar' })} className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-accent-text hover:underline" data-testid="hub-lookup">
              {t('hxLearnSearch')}
            </button>
          </span>
        </div>
        <ul className="lx-glass flex flex-col overflow-hidden rounded-[var(--radius-card)]" aria-label={t('nbLernenHubErrors')} data-testid="hub-errors-list">
          <Row icon={<ChannelIcon channel="grammar"><Icon name="layers" /></ChannelIcon>} title={t('nbLernenExtra')} sub={t('nbLernenExtraSub')} onClick={() => openSheet('x:extra', { scope: 'grammar' })} testId="hub-extra" />
        </ul>
      </motion.div>

      <ForeignRows />

      <TopicSheet topic={open} onClose={() => setOpen(null)} />
    </motion.div>
  );
}
