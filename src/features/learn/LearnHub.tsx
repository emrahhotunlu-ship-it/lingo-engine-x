import { motion } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { lessonMeta, lessonOrder } from '../../domain/course/catalog';
import { doneLessons } from '../../domain/course/courseDone';
import { pickLesson } from '../../domain/course/next';
import { dueErrors } from '../../domain/grammar/errors';
import { dueCards } from '../../domain/srs/queue';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT, type MessageKey } from '../../i18n';
import { useSpeech, unlockSpeech } from '../../platform/speech';
import { Card, ChannelIcon, type Channel } from '../../ui/Card';
import { Icon, type IconName } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { startDrill, drillCards, type DrillKind } from '../drills/session';
import { feasible } from '../../domain/plan/channels';
import { feasibleData } from '../today/store';
import { loadLearnInputs, useLearnInputs } from './inputs';
import { InputModules } from '../input/InputModules';

// Reiter „Lernen" (M13): Kurs, Wortschatz, Grammatik, Wissen und Übungen an einem Ort. Nichts
// hier ist Pflicht – die Pflicht steht auf „Heute" (Kap. 2.6). Übungen, die gerade nicht machbar
// sind (zu wenig Material, keine Sprachausgabe), erscheinen nicht – kein toter Knopf.

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

function Row({ icon, channel, title, sub, onClick, testId, badge }: { icon: IconName; channel: Channel; title: string; sub: string; onClick: () => void; testId: string; badge?: string | null }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} className="lx-glass flex w-full items-center gap-4 rounded-[var(--radius-card)] p-4 text-left transition-colors hover:bg-surface-strong">
      <ChannelIcon channel={channel}>
        <Icon name={icon} />
      </ChannelIcon>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-muted">{sub}</span>
      </span>
      {badge && <span className="flex-none rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-medium text-gold-text">{badge}</span>}
      <Icon name="arrowRight" size={18} className="flex-none text-subtle" />
    </button>
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
  const { data, nDue } = useMemo(() => {
    const cards = drillCards(now);
    return { data: feasibleData(cards, lang, now), nDue: dueCards(cards, now).length };
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

  return (
    <motion.div className="flex flex-col gap-8 py-6 sm:py-10" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }} data-testid="learn-hub">
      <motion.header variants={item} className="flex flex-col gap-2">
        <p className="lx-eyebrow">{t('tabLearn')}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('lhTitle')}</h1>
        <p className="max-w-2xl text-base text-muted">{t('lhLead')}</p>
      </motion.header>

      <motion.section variants={item} className="flex flex-col gap-3" aria-labelledby="lh-course">
        <h2 id="lh-course" className="lx-eyebrow">
          {t('lhCourse')}
        </h2>
        <Card channel="read" className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t('csProgress', { done: doneN, total: totalN })}</p>
          <p className="text-lg font-semibold tracking-tight">{meta ? (lang === 'de' ? meta.de : meta.en) : t('courseComplete')}</p>
          <div className="flex flex-wrap gap-2">
            {meta && (
              <button type="button" className="lx-chip" data-on="" onClick={() => go({ name: 'lesson', id: meta.id })} data-testid="hub-next-lesson">
                {t('lhOpenLesson')}
              </button>
            )}
            <button type="button" className="lx-chip" onClick={() => go({ name: 'course' })} data-testid="hub-course">
              {t('lhAllLessons')}
            </button>
          </div>
        </Card>
      </motion.section>

      <motion.section variants={item} className="grid gap-3 sm:grid-cols-2" aria-label={t('lhLibrary')}>
        <Row icon="cards" channel="cards" title={t('lhVocab')} sub={nDue ? tn('vocabDue', nDue) : t('lhVocabSub')} onClick={() => go({ name: 'vocab' })} testId="hub-vocab" />
        <Row icon="grammar" channel="grammar" title={t('lhGrammar')} sub={t('lhGrammarSub')} onClick={() => go({ name: 'grammar' })} testId="hub-grammar" badge={nErr ? tn('grDueBadge', nErr) : null} />
        <Row icon="book" channel="read" title={t('lhWissen')} sub={t('lhWissenSub')} onClick={() => go({ name: 'wissen' })} testId="hub-wissen" />
      </motion.section>

      {/* Phase 4 (M13): Lesen, Hören, Schreiben – freiwillig, mit Verlauf. Entdecken hat einen eigenen Reiter. */}
      <motion.div variants={item}>
        <InputModules only={['read', 'listen', 'write']} />
      </motion.div>

      <motion.section variants={item} className="flex flex-col gap-3" aria-labelledby="lh-drills">
        <h2 id="lh-drills" className="lx-eyebrow">
          {t('lhDrills')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {DRILLS.filter((d) => feasible(d.kind, data, { tts })).map((d) => (
            <Row key={d.kind} icon={d.icon} channel={d.channel} title={t(d.title)} sub={t(d.sub)} onClick={() => startDrillRound(d.kind)} testId={`hub-drill-${d.kind}`} />
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}
