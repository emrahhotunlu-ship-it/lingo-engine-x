import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import { useNav } from '../../app/nav';
import { checkPct, type Pair } from '../../domain/check/record';
import { meaningOf } from '../../domain/srs/cards';
import { normalize } from '../../domain/answer/normalize';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useHotkeys } from '../../engine/useHotkeys';
import { useT } from '../../i18n';
import { SessionEnd } from '../../ui/SessionEnd';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { useCompanionSee } from '../companion/seeing';
import { GrammarItem } from '../grammar/GrammarItem';
import { topicName } from '../grammar/GrammarScreen';
import { useEndActions } from '../drills/endActions';
import { RoundTop } from '../learn/ui';
import { flush } from '../progress/persist';
import { ExerciseView } from '../vocab/ExerciseView';
import { commitCheckGrammar, commitCheckWord, leaveCheck, useCheck } from './session';

// Wochen-Check (M10): eine Aufgabe zur Zeit, ohne Tipps; am Ende das Ergebnis als Status gegen den
// letzten Check, Bereiche, Themen für die nächste Woche und Wörter, die wiederkommen. Klar als Extra
// gekennzeichnet (Kap. 2.6); zählt nie als Pflicht.

function AreaStat({ label, pair, testId }: { label: string; pair: Pair; testId: string }) {
  const { num } = useT();
  return (
    <div className="flex flex-col gap-0.5 rounded-[var(--radius-control)] border border-line px-3 py-2" data-testid={testId}>
      <span className="lx-tnum text-lg font-semibold">{pair.n ? `${num(pair.ok)}/${num(pair.n)}` : '–'}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

export function CheckScreen() {
  const { t } = useT();
  const api = useHiddenInput();
  const back = useNav((s) => s.back);
  const s = useCheck();
  const item = s.items[s.pos];
  // Die Aufgabe merkt sich ihren Schritt: eine ausgeblendete Aufgabe kann nichts mehr eintragen.
  const step = s.step;
  useCompanionSee({ area: 'overview', label: t('ckTitle'), phase: 'idle' });

  const leave = () => {
    api.blur();
    leaveCheck();
    void flush();
    back();
  };
  useHotkeys({ escape: leave }, api.isInput);

  useEffect(() => {
    if (!s.active && useNav.getState().route.name === 'check') back();
  }, [s.active, back]);

  const knownWords = useMemo(() => new Set(s.pool.map((c) => normalize(c.lemma))), [s.pool]);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 overflow-x-clip py-4 sm:py-8" data-testid="check-screen" data-status={s.status}>
      <RoundTop onClose={leave} closeLabel={t('ckClose')} progress={s.status === 'running' ? { n: s.pos + 1, total: s.items.length } : null} ctx={s.unit ? 'duty' : 'extra'} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={s.status === 'summary' ? 'summary' : `c-${s.step}`}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: DURATION.base, ease: EASE_OUT }}
        >
          {s.status === 'running' && item?.kind === 'v' && s.exercise ? (
            <div data-testid="check-item" data-kind="v" data-ex={s.exercise.ex} data-n={s.pos + 1}>
              <ExerciseView exercise={s.exercise} knownWords={knownWords} onDone={() => undefined} onCommit={(a) => commitCheckWord(a, step)} noHelp />
            </div>
          ) : s.status === 'running' && item?.kind === 'g' ? (
            <div data-testid="check-item" data-kind="g" data-n={s.pos + 1}>
              <GrammarItem task={item.task} ctx={s.unit ? 'duty' : 'xtra'} day={s.day} onDone={(a) => commitCheckGrammar(a, step)} noHelp profile={s.profile} badge={t('ckBadge')} />
            </div>
          ) : (
            <CheckEnd />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Rundenende des Wochen-Checks im Übungsgerüst (`SessionEnd`): Ergebnis in Prozent, Vergleich, Bereiche, Themen, Wörter. */
function CheckEnd() {
  const { t, lang, date } = useT();
  const s = useCheck();
  const end = useEndActions({ onBack: leaveCheck, backLabel: t('ckBack'), backTo: { name: 'overview', tab: 'history' } });
  const rec = s.record;
  const pct = rec ? checkPct(rec) : 0;
  const prevPct = s.prev ? checkPct(s.prev) : null;
  const words = (rec?.words ?? [])
    .map((id) => [...s.cards.values()].find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c);
  const detail = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="lx-t-task" data-testid="check-result" data-pct={pct}>
          {t('ckDone', { pct })}
        </h2>
        <p className="lx-t-support text-muted" data-testid="check-compare">
          {prevPct === null || !s.prev ? t('ckFirst') : t(pct > prevPct ? 'ckVsUp' : pct < prevPct ? 'ckVsDown' : 'ckVsSame', { prev: prevPct, date: date(s.prev.t) })}
        </p>
      </div>
      {rec && (
        <div className="grid grid-cols-3 gap-2">
          <AreaStat label={t('ckAreaVocab')} pair={rec.vocab} testId="check-area-vocab" />
          <AreaStat label={t('ckAreaColloc')} pair={rec.colloc} testId="check-area-colloc" />
          <AreaStat label={t('ckAreaGram')} pair={rec.gram} testId="check-area-gram" />
        </div>
      )}
      {rec && rec.topics.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="lx-t-support font-medium">{t('ckFocus')}</p>
          <ul className="flex flex-wrap gap-2">
            {rec.topics.map((tp) => (
              <li key={tp} className="lx-t-support rounded-full border border-line px-3 py-1">
                {topicName(tp, lang)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {words.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="lx-t-support font-medium">{t('ckWords')}</p>
          <ul className="flex flex-wrap gap-2">
            {words.map((c) => (
              <li key={c.id} className="lx-t-support rounded-full border border-line px-3 py-1">
                <span lang="en" className="font-medium">
                  {c.word}
                </span>
                {meaningOf(c, lang) && <span className="text-muted"> · {meaningOf(c, lang)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!rec && <p className="lx-t-support text-muted">{t('ckTooFew')}</p>}
      {s.saved === 'failed' && (
        <p className="lx-t-support text-danger-text" role="alert">
          {t('ckSaveFailed')}
        </p>
      )}
      <p className="lx-t-meta text-subtle">{t('ckNote')}</p>
    </div>
  );
  const right = s.results.filter((r) => r.ok).length;
  return (
    <div data-testid="check-summary" data-saved={s.saved}>
      <SessionEnd
        mode="growth"
        title={t('ckTitle')}
        right={right}
        total={s.results.length}
        ms={0}
        takeaways={detail}
        next={end.main}
        {...(end.secondary ? { secondary: end.secondary } : {})}
      />
    </div>
  );
}
