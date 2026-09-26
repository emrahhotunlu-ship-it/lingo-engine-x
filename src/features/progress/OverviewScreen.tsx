import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useT, type MessageKey } from '../../i18n';
import { Card, ChannelIcon } from '../../ui/Card';
import { Disclosure } from '../../ui/Disclosure';
import { Icon } from '../../ui/Icon';
import { Bar } from '../../ui/ProgressRing';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { useLive } from '../../data/live';
import { buildOverview } from '../../domain/overview';

// „Dein Stand" (Fundament-Version): zeigt, dass alle bisherigen Daten angekommen sind.
// Eine große Zahl pro Karte, Messwerte nur eingeklappt (Kap. 5, Kap. 8).

const STAGES: MessageKey[] = ['stage0', 'stage1', 'stage2', 'stage3', 'stage4', 'stage5'];
const EMPTY = new Map<string, Record<string, unknown>>();

/** Aktuelle Zeit, jede Minute neu – so wechselt der Lerntag auch bei offener App. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** Eine große Zahl pro Karte, die Einheit direkt daneben – nichts doppelt (Kap. 8, Kap. 15). */
function BigNumber({ value, unit, testId }: { value: string; unit: string; testId: string }) {
  return (
    <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
      <span className="lx-tnum text-4xl font-semibold tracking-tight" data-testid={testId}>
        {value}
      </span>
      <span className="text-base text-muted">{unit}</span>
    </p>
  );
}

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
};

export function OverviewScreen() {
  const { t, tn, num, date, lang } = useT();
  const docs = useLive((s) => s.docs);
  const vocab = useLive((s) => s.collections.vocab) ?? EMPTY;
  const grammar = useLive((s) => s.collections.grammar) ?? EMPTY;
  const now = useNow();

  const ov = useMemo(
    () =>
      buildOverview({
        nowMs: now,
        profile: docs['app/profile'],
        course: docs['app/course'],
        assess: docs['app/assess'],
        schema: docs['app/schema'],
        vocab,
        grammar,
      }),
    [now, docs, vocab, grammar],
  );

  const next = ov.course.next;
  return (
    <motion.div
      className="flex flex-col gap-6 py-6 sm:py-10"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.04 } } }}
    >
      <motion.header variants={item} className="flex flex-col gap-3">
        <p className="lx-eyebrow">{t('ovEyebrow')}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('ovTitle')}</h1>
        <p className="max-w-2xl text-base text-muted">{t('ovLead')}</p>
      </motion.header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
        <motion.div variants={item} className="xl:col-span-4">
          <Card className="h-full" aria-labelledby="ov-streak">
            <p id="ov-streak" className="lx-eyebrow">
              {t('streakLabel')}
            </p>
            <BigNumber value={num(ov.streak.count)} unit={t(ov.streak.count === 1 ? 'streakUnit_one' : 'streakUnit_other')} testId="streak-count" />
            <p className={`mt-3 inline-flex items-center gap-2 text-sm ${ov.streak.todayDone ? 'text-accent-text' : 'text-muted'}`}>
              {ov.streak.todayDone && <Icon name="check" size={18} />}
              {t(ov.streak.todayDone ? 'streakTodayDone' : 'streakTodayOpen')}
            </p>
          </Card>
        </motion.div>

        <motion.div variants={item} className="xl:col-span-4">
          <Card className="h-full" aria-labelledby="ov-course">
            <p id="ov-course" className="lx-eyebrow">
              {t('courseLabel')}
            </p>
            <BigNumber value={num(ov.course.done)} unit={t('courseUnit', { total: ov.course.total })} testId="course-done" />
            <p className="mt-3 text-sm text-muted">
              {next ? t('courseNext', { title: lang === 'de' ? next.de : next.en }) : t('courseComplete')}
            </p>
          </Card>
        </motion.div>

        <motion.div variants={item} className="md:col-span-2 xl:col-span-4 xl:row-span-2">
          <Card className="h-full" channel="cards" aria-labelledby="ov-vocab">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p id="ov-vocab" className="lx-eyebrow">
                  {t('vocabLabel')}
                </p>
                <BigNumber value={num(ov.vocab.total)} unit={t(ov.vocab.total === 1 ? 'vocabUnit_one' : 'vocabUnit_other')} testId="vocab-total" />
              </div>
              <ChannelIcon channel="cards">
                <Icon name="cards" />
              </ChannelIcon>
            </div>
            <p className="lx-tnum mt-3 text-sm font-medium text-fg">
              {tn('vocabDue', ov.vocab.due)}
              {ov.vocab.hidden > 0 && <span className="font-normal text-muted"> · {tn('vocabHidden', ov.vocab.hidden)}</span>}
            </p>
            <ol className="mt-4 flex flex-col gap-2" aria-label={t('vocabLabel')}>
              {ov.vocab.byStage.map((n, i) => (
                <li key={STAGES[i]} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                  <span className="text-xs text-muted">{t(STAGES[i] ?? 'stage0')}</span>
                  <span className="lx-tnum text-xs text-muted">{num(n)}</span>
                  <div className="col-span-2">
                    <Bar value={ov.vocab.total ? n / ov.vocab.total : 0} label={`${t(STAGES[i] ?? 'stage0')}: ${num(n)}`} tone="muted" />
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </motion.div>

        <motion.div variants={item} className="xl:col-span-4">
          <Card className="h-full" channel="grammar" aria-labelledby="ov-grammar">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p id="ov-grammar" className="lx-eyebrow">
                  {t('grammarLabel')}
                </p>
                <h2 className="mt-3 text-lg font-semibold">{t('grammarWeakest')}</h2>
              </div>
              <ChannelIcon channel="grammar">
                <Icon name="grammar" />
              </ChannelIcon>
            </div>
            <ul className="mt-4 flex flex-col gap-4">
              {ov.grammar.weakest.map((g) => (
                <li key={g.id} className="flex flex-col gap-2">
                  <span className="text-sm font-medium">{lang === 'en' ? g.nameEn : g.name}</span>
                  <Bar value={g.p} label={lang === 'en' ? g.nameEn : g.name} tone="muted" />
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <Disclosure label={t('measuresToggle')}>
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">{t('measuresMastery')}</caption>
                  <thead>
                    <tr className="text-subtle">
                      <th scope="col" className="py-1 font-medium">
                        {t('grammarLabel')}
                      </th>
                      <th scope="col" className="py-1 text-right font-medium">
                        {t('measuresMastery')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ov.grammar.topics.map((g) => (
                      <tr key={g.id} className="border-t border-line">
                        <td className="py-1.5 pr-3 text-muted">
                          {lang === 'en' ? g.nameEn : g.name} <span className="text-subtle">· {tn('measuresAnswers', g.n)}</span>
                        </td>
                        <td className="lx-tnum py-1.5 text-right text-muted">{num(Math.round(g.p * 100))} %</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Disclosure>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item} className="xl:col-span-4">
          <Card className="h-full" aria-labelledby="ov-assess">
            <p id="ov-assess" className="lx-eyebrow">
              {t('assessLabel')}
            </p>
            {ov.assess ? (
              <>
                {ov.assess.cefr && <p className="mt-3 text-4xl font-semibold tracking-tight">{ov.assess.cefr}</p>}
                {/* Sprachtreue (Kap. 10): gespeicherte Texte nur in ihrer eigenen Sprache zeigen, nie gemischt. */}
                {ov.assess.lang === lang && ov.assess.level && <p className="mt-2 text-sm text-fg">{ov.assess.level}</p>}
                {ov.assess.lang === lang && ov.assess.why && <p className="mt-2 text-sm text-muted">{ov.assess.why}</p>}
                {ov.assess.lang !== lang && (ov.assess.level || ov.assess.why) && <p className="mt-2 text-sm text-muted">{t('assessOtherLang')}</p>}
              </>
            ) : (
              <p className="mt-3 text-sm text-muted">{t('assessNone')}</p>
            )}
          </Card>
        </motion.div>
      </div>

      {ov.schema && ov.schema.migratedAt > 0 && (
        <motion.p variants={item} className="text-xs text-subtle">
          {t('migratedOn', { date: date(ov.schema.migratedAt) })}
        </motion.p>
      )}
    </motion.div>
  );
}
