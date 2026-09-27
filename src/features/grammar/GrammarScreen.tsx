import { motion } from 'framer-motion';
import { useCallback, useMemo, useState } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useAiAvailable } from '../../ai/scope';
import { useLive } from '../../data/live';
import { logWarn } from '../../platform/diagnostics';
import { TOPICS, topicById, GROUP_EN } from '../../domain/content';
import { certainty, topicP } from '../../domain/grammar/bkt';
import { dueErrors, errorsOf } from '../../domain/grammar/errors';
import { ruleOf } from '../../domain/grammar/rules';
import { unseenCount } from '../../domain/grammar/tasks';
import { EnglishText } from '../../engine/EnglishText';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { Disclosure } from '../../ui/Disclosure';
import { Sheet } from '../../ui/Sheet';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { toast } from '../../ui/Toast';
import { useLearnInputs } from '../learn/inputs';
import { CERTAINTY_KEYS, ScreenHeader } from '../learn/ui';
import { generateTopicTasks } from './generate';
import { setExtraTasks, startGrammar } from './session';
import { useCompanionSee } from '../companion/seeing';

// Grammatik (Kap. 6.4, phase2-plan §5.2/5.3): Themen nach Sicherheit, schwächste zuerst; je Thema
// ein Regelblatt mit Formen, Signalwörtern, Kontrast zum Deutschen, typischen Fehlern und den
// eigenen fälligen Fehlern. Zahlen nur unter „Messwerte dahinter".

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
};

export function topicName(id: string, lang: 'de' | 'en'): string {
  const tp = topicById(id);
  if (!tp) return id;
  return lang === 'en' ? (tp.name_en ?? tp.name) : tp.name;
}

export function Dots({ n }: { n: number }) {
  return (
    <span className="lx-dots" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="lx-dot" data-on={i < n || undefined} />
      ))}
    </span>
  );
}

export function GrammarScreen() {
  const { t, tn, lang } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const now = useClock((s) => s.now);
  const docs = useLive((s) => s.collections.grammar) ?? EMPTY;
  const [open, setOpen] = useState<string | null>(null);
  useCompanionSee({ area: 'grammar', label: t('grTitle'), phase: 'idle' });
  const close = useCallback(() => setOpen(null), []);

  const topics = useMemo(
    () =>
      TOPICS.map((tp) => {
        const doc = docs.get(tp.id);
        const p = topicP(tp.id, doc, now);
        const c = certainty(p, { n: typeof doc?.n === 'number' ? doc.n : 0, recent: Array.isArray(doc?.recent) ? (doc.recent as number[]) : null });
        return { id: tp.id, group: tp.group, p, c };
      }).sort((a, b) => a.p - b.p || (a.id < b.id ? -1 : 1)),
    [docs, now],
  );
  const due = useMemo(() => dueErrors(docs, now), [docs, now]);

  const start = (mode: 'xtra' | 'errors') => {
    const first = startGrammar({ mode });
    if (first === 'typed') api.focusNow();
    go({ name: 'grammarSession', mode });
  };

  return (
    <motion.div className="flex flex-col gap-6 py-6 sm:py-10" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.03 } } }} data-testid="grammar">
      <motion.div variants={item}>
        <ScreenHeader eyebrow={t('lhGrammar')} title={t('grTitle')} lead={t('grLead')} back={() => go({ name: 'learn' })} />
      </motion.div>
      <motion.div variants={item} className="flex flex-wrap gap-3">
        <Button variant="primary" iconAfter="arrowRight" onClick={() => start('xtra')} data-testid="gr-start">
          {t('grFreeRound')}
        </Button>
        {due.length > 0 && (
          <Button variant="secondary" icon="refresh" onClick={() => start('errors')} data-testid="gr-errors">
            {t('grErrors', { n: due.length })}
          </Button>
        )}
        <Button variant="ghost" icon="book" onClick={() => go({ name: 'wissen' })} data-testid="open-wissen">
          {t('lhWissen')}
        </Button>
      </motion.div>
      <motion.ul variants={item} className="grid gap-2 sm:grid-cols-2" aria-label={t('grTopics')}>
        {topics.map((tp) => {
          const nDue = due.filter((d) => d.topic === tp.id).length;
          return (
            <li key={tp.id}>
              <button
                type="button"
                className="lx-glass flex w-full items-center justify-between gap-3 rounded-[var(--radius-card)] px-4 py-3 text-left transition-colors hover:bg-surface-strong"
                onClick={() => setOpen(tp.id)}
                data-testid="topic"
                data-topic={tp.id}
                data-p={tp.p.toFixed(2)}
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium">{topicName(tp.id, lang)}</span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                    <Dots n={tp.c.dots} />
                    <span className="whitespace-nowrap">{t(CERTAINTY_KEYS[tp.c.word])}</span>
                    <span className="whitespace-nowrap text-subtle">· {lang === 'en' ? (GROUP_EN[tp.group] ?? tp.group) : tp.group}</span>
                  </span>
                </span>
                {nDue > 0 && <span className="flex-none rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-medium text-gold-text">{tn('grDueBadge', nDue)}</span>}
              </button>
            </li>
          );
        })}
      </motion.ul>
      <TopicSheet topic={open} onClose={close} />
    </motion.div>
  );
}

export function TopicSheet({ topic, onClose }: { topic: string | null; onClose: () => void }) {
  const { t, lang } = useT();
  return (
    <Sheet open={!!topic} onClose={onClose} title={topic ? topicName(topic, lang) : t('grTitle')} closeLabel={t('close')}>
      {topic && <RuleSheet key={topic} topic={topic} onStarted={onClose} />}
    </Sheet>
  );
}

function RuleSheet({ topic, onStarted }: { topic: string; onStarted: () => void }) {
  const { t, tn, lang, num } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const now = useClock((s) => s.now);
  const ai = useAiAvailable();
  const doc = useLive((s) => s.collections.grammar?.get(topic));
  const inputs = useLearnInputs();
  const rule = ruleOf(topic, lang);
  useCompanionSee({ area: 'grammar', label: `${t('grTitle')} · ${topicName(topic, lang)}`, phase: 'idle' });
  const p = topicP(topic, doc, now);
  const errs = errorsOf(doc).filter((e) => e.done !== true);
  const unseen = unseenCount(topic, doc, [inputs.pool, inputs.dailyOpen]);
  const [gen, setGen] = useState<{ phase: 'idle' | 'busy' | 'error'; ctl: AbortController | null }>({ phase: 'idle', ctl: null });

  const startTopic = () => {
    const first = startGrammar({ mode: 'topic', topic });
    if (first === 'typed') api.focusNow();
    onStarted();
    go({ name: 'grammarSession', mode: 'topic', topic });
  };

  const generate = async () => {
    const ctl = new AbortController();
    setGen({ phase: 'busy', ctl });
    try {
      const tasks = await generateTopicTasks(topic, ctl.signal);
      setExtraTasks(tasks);
      setGen({ phase: 'idle', ctl: null });
      toast(tn('grGenerated', tasks.length));
    } catch (err) {
      if (!ctl.signal.aborted) logWarn('grammar:generate', err, topic);
      setGen({ phase: ctl.signal.aborted ? 'idle' : 'error', ctl: null });
    }
  };

  const src = { area: 'trainer' as const, source: `grammar/${topic}` };
  return (
    <div className="flex flex-col gap-6 pb-4" data-testid="rule-sheet" data-topic={topic}>
      <p className="flex items-center gap-2 text-sm text-muted" data-testid="rule-certainty">
        <Dots n={certainty(p, { n: typeof doc?.n === 'number' ? doc.n : 0 }).dots} />
        {t(CERTAINTY_KEYS[certainty(p, { n: typeof doc?.n === 'number' ? doc.n : 0, recent: Array.isArray(doc?.recent) ? (doc.recent as number[]) : null }).word])}
      </p>
      {rule && (
        <>
          <section className="flex flex-col gap-2">
            <h3 className="lx-eyebrow">{t('grRule')}</h3>
            <p className="text-base font-medium" lang={lang}>
              {rule.core}
            </p>
            {rule.why && (
              <p className="text-sm text-muted" lang={lang}>
                {rule.why}
              </p>
            )}
          </section>
          {rule.steps.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="lx-eyebrow">{t('grSteps')}</h3>
              <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm" lang={lang}>
                {rule.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </section>
          )}
          {rule.forms.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="lx-eyebrow">{t('grForms')}</h3>
              <ul className="flex flex-col gap-2">
                {rule.forms.map((f) => (
                  <li key={f.name + f.pattern} className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium" lang={lang}>
                      {f.name} · <span lang="en">{f.pattern}</span>
                    </span>
                    <EnglishText as="span" className="text-sm text-muted" text={f.ex} {...src} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {rule.signals.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="lx-eyebrow">{t('grSignals')}</h3>
              <ul className="flex flex-wrap gap-2">
                {rule.signals.map((s) => (
                  <li key={s.signal} className="rounded-full border border-line px-3 py-1 text-sm">
                    <span lang="en" className="font-medium">
                      {s.signal}
                    </span>
                    <span className="text-muted" lang={lang}>
                      {' '}
                      – {s.meaning}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {rule.contrast && (
            <section className="flex flex-col gap-2">
              <h3 className="lx-eyebrow">{t('grContrast')}</h3>
              <p className="text-sm" lang={lang}>
                {rule.contrast}
              </p>
            </section>
          )}
          {rule.traps.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="lx-eyebrow">{t('grTraps')}</h3>
              <ul className="flex flex-col gap-3">
                {rule.traps.map((tr) => (
                  <li key={tr.bad} className="flex flex-col gap-0.5 text-sm">
                    <span className="lx-diff-off" lang="en">
                      {tr.bad}
                    </span>
                    <EnglishText as="span" className="font-medium" text={tr.good} {...src} />
                    <span className="text-muted" lang={lang}>
                      {tr.why}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {rule.alts.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="lx-eyebrow">{t('grAlsoRight')}</h3>
              {rule.alts.map((a) => (
                <p key={a} className="text-sm text-muted" lang={lang}>
                  {a}
                </p>
              ))}
            </section>
          )}
        </>
      )}
      {errs.length > 0 && (
        <section className="flex flex-col gap-2" data-testid="own-errors">
          <h3 className="lx-eyebrow">{t('grOwnErrors')}</h3>
          <ul className="flex flex-col gap-2">
            {errs.slice(-5).reverse().map((e) => (
              <li key={String(e.t)} className="flex flex-col gap-0.5 text-sm">
                <span lang="en">{typeof e.q === 'string' ? e.q : ''}</span>
                <span>
                  <span className="lx-diff-off" lang="en">
                    {typeof e.given === 'string' ? e.given : ''}
                  </span>
                  <span className="text-muted"> → </span>
                  <span className="font-medium" lang="en">
                    {typeof e.ans === 'string' ? e.ans : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="flex flex-col gap-3">
        <Button variant="primary" iconAfter="arrowRight" onClick={startTopic} data-testid="topic-start">
          {t('grPractice')}
        </Button>
        {ai && unseen < 8 && (
          <Button
            variant="secondary"
            icon="sparkle"
            onClick={() => (gen.phase === 'busy' ? gen.ctl?.abort() : void generate())}
            data-testid="gr-generate"
            data-ai=""
            aria-busy={gen.phase === 'busy' || undefined}
          >
            {gen.phase === 'busy' ? t('aiStop') : t('grNew', { topic: topicName(topic, lang) })}
          </Button>
        )}
        {gen.phase === 'busy' && (
          <p className="text-sm text-muted" role="status">
            {t('aiThinking')}
          </p>
        )}
        {gen.phase === 'error' && (
          <p className="text-sm text-danger-text" role="alert">
            {t('aiFailed')}
          </p>
        )}
      </div>
      <Disclosure label={t('grRaw')}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm" data-testid="gr-raw">
          <dt className="text-muted">{t('grRawP')}</dt>
          <dd className="lx-tnum">{num(Math.round(p * 100))} %</dd>
          <dt className="text-muted">{t('grRawN')}</dt>
          <dd className="lx-tnum">{num(typeof doc?.n === 'number' ? doc.n : 0)}</dd>
          <dt className="text-muted">{t('grRawC')}</dt>
          <dd className="lx-tnum">{num(typeof doc?.c === 'number' ? doc.c : 0)}</dd>
        </dl>
      </Disclosure>
    </div>
  );
}
