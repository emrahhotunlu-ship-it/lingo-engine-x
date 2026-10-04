import { motion } from 'framer-motion';
import { useEffect, useMemo, type ReactNode } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { lessonMeta, lessonOrder } from '../../domain/course/catalog';
import { doneLessons } from '../../domain/course/courseDone';
import { pickLesson } from '../../domain/course/next';
import { dueErrors } from '../../domain/grammar/errors';
import { repairStats } from '../../domain/repair/daily';
import { entriesFor } from '../../app/registry';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT, type MessageKey } from '../../i18n';
import { useSpeech, unlockSpeech } from '../../platform/speech';
import { Button } from '../../ui/Button';
import { ChannelIcon, type Channel } from '../../ui/Card';
import { Icon, type IconName } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { startDrill, drillCards, type DrillKind } from '../drills/session';
import { feasible } from '../../domain/plan/channels';
import { feasibleData } from '../today/store';
import { loadLearnInputs, useLearnInputs } from './inputs';
import { TabTitle } from '../system/Chrome';
import { startGrammar } from '../grammar/session';

// Reiter „Üben" (UX-Beratung Nr. 8, bisher „Lernen"): gegliedert nach Kurs, Wortschatz und
// Grammatik, Kurzübungen, Lesen/Hören/Schreiben (mit „Sag es") und Entdecken. Nichts hier ist
// Pflicht – die Pflicht steht auf „Heute" (Kap. 2.6). Keine Einleitung, keine Karte in Karte:
// Listen liegen in einer Fläche mit Trennlinien. Ein Hauptknopf (nächste Lektion).
// Übungen, die gerade nicht machbar sind, erscheinen nicht – kein toter Knopf.

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
};

const DRILLS: Array<{ kind: DrillKind; icon: IconName; title: MessageKey; sub: MessageKey; channel: Channel }> = [
  { kind: 'cloze', icon: 'link', title: 'drCloze', sub: 'lhClozeSub', channel: 'cards' },
  { kind: 'order', icon: 'grid', title: 'drOrder', sub: 'lhOrderSub', channel: 'grammar' },
  { kind: 'dictate', icon: 'headphones', title: 'drDictate', sub: 'lhDictateSub', channel: 'listen' },
  { kind: 'sprint', icon: 'bolt', title: 'drSprint', sub: 'lhSprintSub', channel: 'write' },
];

/** Eine Zeilenform für „öffnen" (visuelle Regel 6): Symbol links, Titel + Nebenzeile, Pfeil rechts. */
function Row({ icon, title, sub, onClick, testId, badge, note, module }: { icon: ReactNode; title: string; sub: string; onClick: () => void; testId: string; badge?: string | null; note?: ReactNode; module?: string }) {
  return (
    <li>
      <button type="button" onClick={onClick} data-testid={testId} data-module={module} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-strong">
        {icon}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{title}</span>
          <span className="text-sm text-muted">{sub}</span>
        </span>
        {note}
        {badge && <span className="flex-none rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-medium text-gold-text">{badge}</span>}
        <Icon name="arrowRight" size={18} className="flex-none text-subtle" />
      </button>
    </li>
  );
}

function List({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <ul className="lx-glass flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)]" aria-label={label} data-testid={testId}>
      {children}
    </ul>
  );
}

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

/** Gruppen der Einstiege auf dem Platz `learn` (plan.md §1.3). Fremde Bereiche hängen ihre Zeilen per
 * `entries: [{ place: 'learn', group }]` an: `way` (Dein Weg, z. B. P1 „Deine Woche“), `errors`
 * (Aus deinen Fehlern), `grammar` (Grammatik & Fallen), `training` (Training, z. B. P7). Einstiege
 * ohne oder mit unbekannter Gruppe erscheinen unter „Training“ – nichts geht verloren. */
export const LEARN_GROUPS = ['path', 'way', 'errors', 'grammar', 'training'] as const;

function ForeignRows({ group }: { group: (typeof LEARN_GROUPS)[number] }) {
  const { t } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const all = entriesFor('learn');
  const known = new Set<string>(LEARN_GROUPS);
  const list = all.filter((e) => (group === 'training' ? !e.group || !known.has(e.group) || e.group === 'training' : e.group === group));
  return (
    <>
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
    </>
  );
}

export function LearnHub() {
  const { t, tn, lang } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const now = useClock((s) => s.now);
  const course = useLive((s) => s.docs['app/course']);
  const assess = useLive((s) => s.docs['app/assess']);
  const grammar = useLive((s) => s.collections.grammar);
  const repairDoc = useLive((s) => s.docs['app/repair']);
  const vocab = useLive((s) => s.collections.vocab);
  const tts = useSpeech((s) => s.status === 'ready');
  const inputs = useLearnInputs((s) => s.status);

  useEffect(() => {
    if (useLearnInputs.getState().status === 'idle') void loadLearnInputs();
  }, []);

  const lessons = useLearnInputs((s) => s.lessons);
  // `lessons`: erweiterte Lektionen (l25+, Kap. 6.2) kommen nach dem Lesen von `lesson/*` dazu.
  const next = useMemo(() => {
    void lessons;
    return pickLesson({ course, assess, lang });
  }, [course, assess, lang, lessons]);
  const meta = next ? lessonMeta(next.lid) : null;
  const { doneN, totalN } = useMemo(() => {
    const done = doneLessons(course);
    void lessons;
    const order = lessonOrder();
    return { doneN: order.filter((id) => done.has(id)).length, totalN: order.length };
  }, [course, lessons]);
  const nErr = useMemo(() => dueErrors(grammar ?? new Map(), now).length, [grammar, now]);
  const rep = useMemo(() => repairStats(repairDoc), [repairDoc]);
  const data = useMemo(() => {
    const cards = drillCards(now);
    return feasibleData(cards, lang, now);
    // `inputs` und `vocab`: neu rechnen, sobald Pool/Lektionen bzw. Karten da sind.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, lang, inputs, vocab]);

  const startDrillRound = (kind: DrillKind) => {
    unlockSpeech();
    const first = startDrill(kind);
    if (first === 'typed') api.focusNow();
    else api.blur();
    go({ name: 'drill', kind, ctx: 'xtra' });
  };
  const startErrors = () => {
    const first = startGrammar({ mode: 'errors' });
    if (first === 'typed') api.focusNow();
    go({ name: 'grammarSession', mode: 'errors' });
  };

  const drills = DRILLS.filter((d) => feasible(d.kind, data, { tts }));
  return (
    <motion.div className="flex flex-col gap-8 py-6 sm:py-10" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }} data-testid="learn-hub">
      <motion.div variants={item}>
        <TabTitle title={t('lhTitle')} />
      </motion.div>

      {/* 1. Dein Weg: Deine Woche (P1) und die Kurs-Karte (nächste Lektion, Fortschritt). */}
      <Section id="lh-way" title={t('nbLernenHubWay')}>
        {(entriesFor('learn', 'path').length > 0 || entriesFor('learn', 'way').length > 0) && (
          <List label={t('nbLernenHubWay')}>
            <ForeignRows group="path" />
            <ForeignRows group="way" />
          </List>
        )}
        <div className="lx-glass flex flex-col gap-3 rounded-[var(--radius-card)] p-5" data-testid="hub-course-card">
          <p className="lx-eyebrow">{t('lhCourse')}</p>
          <p className="text-lg font-semibold tracking-tight">{meta ? (lang === 'de' ? meta.de : meta.en) : t('courseComplete')}</p>
          <p className="text-sm text-muted">{t('csProgress', { done: doneN, total: totalN })}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {meta && (
              <Button variant="primary" iconAfter="arrowRight" onClick={() => go({ name: 'lesson', id: meta.id })} data-testid="hub-next-lesson">
                {t('lhOpenLesson')}
              </Button>
            )}
            <button type="button" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent-text hover:underline" onClick={() => go({ name: 'course' })} data-testid="hub-course">
              {t('lhAllLessons')}
              <Icon name="arrowRight" size={16} />
            </button>
          </div>
        </div>
      </Section>

      {/* 2. Aus deinen Fehlern (Prüfung Ü1: der einzige Abschnitt mit fälligen Elementen, deshalb oben). */}
      <Section id="lh-errors" title={t('nbLernenHubErrors')}>
        <List label={t('nbLernenHubErrors')} testId="hub-errors-list">
          {nErr > 0 ? (
            <Row icon={<ChannelIcon channel="grammar"><Icon name="refresh" /></ChannelIcon>} title={t('nbLernenHubGrammarErrors')} sub={tn('grDueBadge', nErr)} onClick={startErrors} testId="hub-errors" badge={String(nErr)} />
          ) : (
            <li className="flex min-h-14 items-center gap-3 px-4 py-3 text-sm text-muted" data-testid="hub-errors-none">
              <ChannelIcon channel="grammar"><Icon name="check" /></ChannelIcon>
              <span>{t('nbLernenHubNoErrors')}</span>
            </li>
          )}
          <li className="flex min-h-14 items-center gap-3 px-4 py-3" data-testid="hub-repair">
            <ChannelIcon channel="speak"><Icon name="refresh" /></ChannelIcon>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{t('nbLernenHubRepair')}</span>
              <span className="lx-tnum text-sm text-muted">{t('nbLernenHubRepairSub', { open: rep.open, safe: rep.safe })}</span>
            </span>
          </li>
          <ForeignRows group="errors" />
        </List>
      </Section>

      {/* 3. Grammatik & Fallen. */}
      <Section id="lh-grammar" title={t('nbLernenHubGrammar')}>
        <List label={t('nbLernenHubGrammar')}>
          <Row icon={<ChannelIcon channel="grammar"><Icon name="grammar" /></ChannelIcon>} title={t('lhGrammar')} sub={t('nbLernenHubGrammarSub')} onClick={() => go({ name: 'grammar' })} testId="hub-grammar" badge={nErr ? tn('grDueBadge', nErr) : null} />
          <Row icon={<ChannelIcon channel="grammar"><Icon name="target" /></ChannelIcon>} title={t('nbLernenHubPatterns')} sub={t('nbLernenHubPatternsSub')} onClick={() => go({ name: 'patterns' })} testId="hub-patterns" />
          <Row icon={<ChannelIcon channel="grammar"><Icon name="book" /></ChannelIcon>} title={t('nbLernenHubWissen')} sub={t('nbLernenHubWissenSub')} onClick={() => go({ name: 'wissen' })} testId="hub-wissen" />
          <ForeignRows group="grammar" />
        </List>
      </Section>

      {/* 4. Training: Kurzübungen (nur machbare, G5) und die neuen Übungen anderer Bereiche (P7). */}
      <Section id="lh-drills" title={t('nbLernenHubTraining')}>
        {drills.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {drills.map((d) => (
              <button
                key={d.kind}
                type="button"
                onClick={() => startDrillRound(d.kind)}
                data-testid={`hub-drill-${d.kind}`}
                className="lx-glass flex min-h-28 flex-col items-start gap-2 rounded-[var(--radius-card)] p-4 text-left transition-colors hover:bg-surface-strong"
              >
                <ChannelIcon channel={d.channel}>
                  <Icon name={d.icon} />
                </ChannelIcon>
                <span className="font-medium">{t(d.title)}</span>
                <span className="text-xs text-muted">{t(d.sub)}</span>
              </button>
            ))}
          </div>
        )}
        {entriesFor('learn').some((e) => !e.group || !(LEARN_GROUPS as readonly string[]).includes(e.group) || e.group === 'training') && (
          <List label={t('nbLernenHubTraining')}>
            <ForeignRows group="training" />
          </List>
        )}
      </Section>
    </motion.div>
  );
}
