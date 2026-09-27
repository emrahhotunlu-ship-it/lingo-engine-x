import { motion } from 'framer-motion';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useClock } from '../../app/clock';
import { INPUT_MODULES } from '../../app/modules';
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
import { Button } from '../../ui/Button';
import { ChannelIcon, type Channel } from '../../ui/Card';
import { Icon, type IconName } from '../../ui/Icon';
import { InputIcon, type InputIconName } from '../../ui/InputIcon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { startDrill, drillCards, type DrillKind } from '../drills/session';
import { feasible } from '../../domain/plan/channels';
import { feasibleData } from '../today/store';
import { loadLearnInputs, useLearnInputs } from './inputs';
import { useChannelState } from '../input/InputOffers';
import { TabTitle } from '../system/Chrome';
import { FreeRoundSheet } from '../vocab/FreeRoundSheet';

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

const INPUT_SUB: Record<string, MessageKey> = { read: 'lhReadSub', listen: 'lhListenSub', write: 'lhWriteSub', discover: 'lhDiscoverSub' };

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

const ModuleIcon = ({ name, channel }: { name: InputIconName; channel: Channel }) => (
  <span className="inline-flex size-9 flex-none items-center justify-center rounded-xl bg-surface" style={{ color: `var(--lx-ch-${channel})` }}>
    <InputIcon name={name} />
  </span>
);

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
  const [freeRound, setFreeRound] = useState(false);

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

  const drills = DRILLS.filter((d) => feasible(d.kind, data, { tts }));
  return (
    <motion.div className="flex flex-col gap-8 py-6 sm:py-10" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }} data-testid="learn-hub">
      <motion.div variants={item}>
        <TabTitle title={t('lhTitle')} />
      </motion.div>

      <Section id="lh-course" title={t('lhCourse')}>
        <div className="lx-glass flex flex-col gap-3 rounded-[var(--radius-card)] p-5">
          <p className="text-sm text-muted">{t('csProgress', { done: doneN, total: totalN })}</p>
          <p className="text-lg font-semibold tracking-tight">{meta ? (lang === 'de' ? meta.de : meta.en) : t('courseComplete')}</p>
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

      <Section id="lh-library" title={`${t('lhVocab')} · ${t('lhGrammar')}`}>
        <List label={t('lhLibrary')}>
          <Row
            icon={<ChannelIcon channel="cards"><Icon name="cards" /></ChannelIcon>}
            title={t('lhVocab')}
            sub={nDue ? tn('vocabDue', nDue) : t('lhVocabSub')}
            onClick={() => go({ name: 'vocab' })}
            testId="hub-vocab"
          />
          <Row
            icon={<ChannelIcon channel="cards"><Icon name="plus" /></ChannelIcon>}
            title={t('lhVocabFree')}
            sub={t('lhFreeRoundSub')}
            onClick={() => setFreeRound(true)}
            testId="hub-free-round"
          />
          <Row
            icon={<ChannelIcon channel="grammar"><Icon name="grammar" /></ChannelIcon>}
            title={t('lhGrammar')}
            sub={t('lhGrammarSub')}
            onClick={() => go({ name: 'grammar' })}
            testId="hub-grammar"
            badge={nErr ? tn('grDueBadge', nErr) : null}
          />
        </List>
      </Section>

      {drills.length > 0 && (
        <Section id="lh-drills" title={t('lhDrills')}>
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
        </Section>
      )}

      <InputSections />

      <FreeRoundSheet open={freeRound} onClose={() => setFreeRound(false)} />
    </motion.div>
  );
}

/**
 * Lesen, Hören, Schreiben (mit „Sag es“) und Entdecken – auch Wurzel des Reiters „Lesen“ im
 * Neubau-Rahmen (WP0a: `areas/lesen.tsx`, bis P4 die Bibliothek baut).
 */
export function InputSections() {
  const { t } = useT();
  const go = useNav((s) => s.go);
  const { rows } = useChannelState();
  const done = (id: string) => rows.find((r) => r.module.id === id)?.done ?? false;
  const practiced = (id: string) =>
    done(id) ? (
      // Freiwilliges Angebot (Kap. 2.6): Hinweis „heute geübt", kein „Erledigt"-Häkchen am Knopf.
      <span className="flex-none whitespace-nowrap text-xs text-muted" data-testid="module-done">
        {t('inPracticedToday')}
      </span>
    ) : null;
  const moduleRow = (id: 'read' | 'listen' | 'write' | 'discover') => {
    const m = INPUT_MODULES.find((x) => x.id === id);
    if (!m) return null;
    return (
      <Row
        key={m.id}
        icon={<ModuleIcon name={m.icon} channel={m.channel} />}
        title={t(m.label)}
        sub={t(INPUT_SUB[m.id] ?? 'lhReadSub')}
        onClick={() => go(m.route)}
        testId="module"
        module={m.id}
        note={practiced(m.id)}
      />
    );
  };

  return (
    <>
      <Section id="lh-input" title={t('lhInput')}>
        <List label={t('lhInput')} testId="input-modules">
          {moduleRow('read')}
          {moduleRow('listen')}
          {moduleRow('write')}
          {/* Lernberatung 27.09.: „Sag es" auch freiwillig, jederzeit (zählt nur, wenn es heute Pflicht ist). */}
          <Row icon={<ChannelIcon channel="speak"><Icon name="chat" /></ChannelIcon>} title={t('sayTitle')} sub={t('lhSaySub')} onClick={() => go({ name: 'say' })} testId="hub-say" />
        </List>
      </Section>

      <Section id="lh-discover" title={t('ch_discover')}>
        <List label={t('ch_discover')}>{moduleRow('discover')}</List>
      </Section>

    </>
  );
}
