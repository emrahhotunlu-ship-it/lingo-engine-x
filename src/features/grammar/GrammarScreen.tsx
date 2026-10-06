import { motion } from 'framer-motion';
import { useCallback, useState } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useAiAvailable } from '../../ai/scope';
import { useLive } from '../../data/live';
import { logWarn } from '../../platform/diagnostics';
import { topicById } from '../../domain/content';
import { certainty, topicP } from '../../domain/grammar/bkt';
import { errorsOf } from '../../domain/grammar/errors';
import { lernweg } from '../../domain/grammar/path';
import { patternsOf } from '../../domain/grammar/patterns';
import { localizePattern, ruleOf } from '../../domain/grammar/rules';
import { ROUND_SIZE, unseenCount } from '../../domain/grammar/tasks';
import { EnglishText } from '../../engine/EnglishText';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT, type MessageKey } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { Button } from '../../ui/Button';
import { Disclosure } from '../../ui/Disclosure';
import { Sheet } from '../../ui/Sheet';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { toast } from '../../ui/Toast';
import { useLearnInputs } from '../learn/inputs';
import { CERTAINTY_KEYS, ScreenHeader } from '../learn/ui';
import { PathList } from './PathList';
import { PatternSheetBody } from './PatternSheet';
import { RuleSearch } from './WissenScreen';
import { generateTopicTasks } from './generate';
import { setExtraTasks, startGrammar } from './session';
import { Dots, topicName } from './topicUi';
import { useCompanionSee } from '../companion/seeing';

// Grammatik (Kap. 6.4, phase2-plan §5.2/5.3): Themen nach Sicherheit, schwächste zuerst; je Thema
// ein Regelblatt mit Formen, Signalwörtern, Kontrast zum Deutschen, typischen Fehlern und den
// eigenen fälligen Fehlern. Zahlen nur unter „Messwerte dahinter".

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
};

export { Dots, topicName } from './topicUi';

/**
 * Seite „Grammatik“ (Ziel alter Links und von `grammar?topic=`): Regel-Suche, Fallen-Zeile und derselbe Pfad wie im
 * Reiter. Der Reiter selbst (`LearnHub`) ist die Hauptansicht; diese Seite öffnet auf Wunsch sofort ein Themenblatt.
 */
export function GrammarScreen() {
  const { t } = useT();
  const go = useNav((s) => s.go);
  const back = useNav((s) => s.back);
  // `grammar?topic=` (Werkzeug der Woche, 1 Tipp von „Deine Woche“): das Themenblatt öffnet sofort.
  const deepTopic = useNav((s) => (s.route.name === 'grammar' ? (s.route.topic ?? null) : null));
  const [open, setOpen] = useState<string | null>(() => (deepTopic && topicById(deepTopic) ? deepTopic : null));
  useCompanionSee({ area: 'grammar', label: t('grTitle'), phase: 'idle' });
  const close = useCallback(() => setOpen(null), []);

  return (
    <motion.div className="flex flex-col gap-6 py-6 sm:py-10" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.03 } } }} data-testid="grammar">
      <motion.div variants={item}>
        <ScreenHeader eyebrow={t('lhGrammar')} title={t('grTitle')} lead={t('grLead')} back={back} />
      </motion.div>
      {/* UX-Beratung Nr. 9: „Wissen" geht in Grammatik auf – Suche oben, typische Fallen als Zeile. */}
      <motion.div variants={item} className="flex flex-col gap-1">
        <RuleSearch onOpen={setOpen} />
        <button type="button" onClick={() => go({ name: 'wissen' })} data-testid="open-wissen" className="flex min-h-12 w-full items-center gap-3 text-left text-sm font-medium text-muted transition-colors hover:text-fg">
          <Icon name="book" size={18} className="flex-none" />
          <span className="flex-1">{t('grTrapsLink')}</span>
          <Icon name="arrowRight" size={16} className="flex-none text-subtle" />
        </button>
      </motion.div>
      <motion.div variants={item}>
        <PathList onOpen={setOpen} />
      </motion.div>
      <TopicSheet topic={open} onClose={close} />
    </motion.div>
  );
}

const WEG_KEYS = ['nbLernenWeg1', 'nbLernenWeg2', 'nbLernenWeg3', 'nbLernenWeg4', 'nbLernenWeg5'] as const;

/** `inRound`: aus einer laufenden Runde geöffnet („Ganzes Thema ansehen“) – nur lesen, nichts Neues starten. */
export function TopicSheet({ topic, onClose, inRound = false }: { topic: string | null; onClose: () => void; inRound?: boolean }) {
  const { t, lang } = useT();
  return (
    <Sheet open={!!topic} onClose={onClose} title={topic ? topicName(topic, lang) : t('grTitle')} closeLabel={t('close')}>
      {topic && <RuleSheet key={topic} topic={topic} onStarted={onClose} inRound={inRound} />}
    </Sheet>
  );
}

function RuleSheet({ topic, onStarted, inRound = false }: { topic: string; onStarted: () => void; inRound?: boolean }) {
  const { t, tn, lang, num } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const now = useClock((s) => s.now);
  const ai = useAiAvailable();
  const doc = useLive((s) => s.collections.grammar?.get(topic));
  const inputs = useLearnInputs();
  const rule = ruleOf(topic, lang);
  // Mit Musterdatei ersetzt das Themenblatt den Querschnitt (Lernplattform 2.0 §5.5); ohne bleibt das Regelblatt wie bisher.
  const tpats = patternsOf(topic);
  useCompanionSee({ area: 'grammar', label: `${t('grTitle')} · ${topicName(topic, lang)}`, phase: 'idle' });
  const p = topicP(topic, doc, now);
  const cert = certainty(p, { n: typeof doc?.n === 'number' ? doc.n : 0, recent: Array.isArray(doc?.recent) ? (doc.recent as number[]) : null });
  const weg = lernweg(topic, doc, now);
  const errs = errorsOf(doc).filter((e) => e.done !== true);
  const unseen = unseenCount(topic, doc, [inputs.pool, inputs.dailyOpen]);
  const [gen, setGen] = useState<{ phase: 'idle' | 'busy' | 'error'; ctl: AbortController | null }>({ phase: 'idle', ctl: null });

  const startTopic = () => {
    const first = startGrammar({ mode: 'topic', topic });
    if (first === 'typed') api.focusNow();
    onStarted();
    go({ name: 'grammarSession', mode: 'topic', topic });
  };

  const practicePattern = (pat: string) => {
    const first = startGrammar({ mode: 'topic', topic, pat });
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
      {/* Der Knopf bleibt oben stehen, auch beim Lesen der Regel (Gesamtkonzept 3.4, U-07). */}
      {!inRound && (
        <div className="sticky top-0 z-10 -mx-5 flex flex-col gap-2 bg-surface-solid px-5 pt-1 pb-3 sm:-mx-6 sm:px-6">
          <Button variant="primary" iconAfter="arrowRight" onClick={startTopic} data-testid="topic-start">
            {t('nbLernenPractice', { n: ROUND_SIZE.topic })}
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-2" data-testid="rule-certainty">
        <p className="flex items-center gap-2 text-sm text-muted">
          <Dots n={cert.dots} />
          {t(CERTAINTY_KEYS[cert.word])}
        </p>
        <ol className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted" aria-label={t('nbLernenWegLabel')} data-testid="lernweg">
          {WEG_KEYS.map((k, i) => (
            <li key={k} data-done={weg.done[i] || undefined} data-current={weg.current === i || undefined} className={weg.done[i] ? 'text-fg' : weg.current === i ? 'font-medium text-accent-text' : ''}>
              {weg.done[i] ? '✓ ' : ''}
              {t(k)}
            </li>
          ))}
        </ol>
      </div>
      {tpats && <PatternSheetBody topic={topic} tp={tpats} onPractice={practicePattern} readOnly={inRound} />}
      {!tpats && rule && (
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
                      {f.name} · <span data-testid="rule-pattern">{localizePattern(f.pattern, (id) => t(`grTerm_${id}` as MessageKey))}</span>
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
      {!tpats && errs.length > 0 && (
        <section className="flex flex-col gap-2" data-testid="own-errors">
          <h3 className="lx-eyebrow">{t('grOwnErrors')}</h3>
          <ul className="flex flex-col gap-2">
            {errs.slice(-5).reverse().map((e) => (
              <li key={String(e.t)} className="flex flex-col gap-0.5 text-sm">
                <span lang="en">{typeof e.q === 'string' ? e.q : ''}</span>
                <span>
                  <span className="lx-diff-off" lang="en">
                    {typeof e.given === 'string' && e.given.trim() ? e.given : t('nbLernenDontKnow')}
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
        {!inRound && ai && unseen < 8 && (
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
