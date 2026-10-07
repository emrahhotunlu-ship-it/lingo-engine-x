import { motion } from 'framer-motion';
import { useEffect, useLayoutEffect } from 'react';
import { leaveBack, useNav } from '../../app/nav';
import { patternById } from '../../domain/grammar/patterns';
import { patternState, type PatternState } from '../../domain/metrics/pattern';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useHotkeys } from '../../engine/useHotkeys';
import { useT } from '../../i18n';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { SessionEnd } from '../../ui/SessionEnd';
import { STATE_DOTS } from '../../ui/exercise';
import { flush } from '../progress/persist';
import { RoundTop, dutyLabel } from '../learn/ui';
import { startDuty } from '../learn/flow';
import { firstOpenDuty, useToday } from '../today/state';
import { GrammarItem } from './GrammarItem';
import { IntroFlow } from './IntroFlow';
import { StepBoundary } from '../../app/shell/Boundary';
import { topicName } from './topicUi';
import { ensureGrammar } from './resume';
import { cardsDue, commitGrammar, grammarProgress, inRepeat, inVortest, leaveGrammar, patternGrowth, reportGrammarDone, skipGrammar, startAfterIntro, touchGrammar, useGrammarSession } from './session';

// Grammatikrunde: eine Aufgabe zur Zeit, Wechsel als kurze Seitwärts-Überblendung. Esc verlässt
// die Runde – alles Beantwortete ist gespeichert bzw. vorgemerkt. Vorn steht bei einem neuen Muster der Vortest und die Einführung
// (`IntroFlow`), am Ende das Rundenende mit dem echten Zuwachs je Muster (Lernplattform 2.0 §5.4).

export function GrammarSessionScreen() {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const back = useNav((s) => s.back);
  const s = useGrammarSession();
  const task = s.tasks[s.pos];

  const leave = () => {
    api.blur();
    leaveGrammar();
    void flush();
    back();
  };
  useHotkeys({ escape: leave }, api.isInput);

  // Neuladen/Deep-Link (G3): erst aus dem Fortsetz-Speicher herstellen, sonst neu starten.
  useLayoutEffect(() => {
    const r = useNav.getState().route;
    if (!useGrammarSession.getState().active && r.name === 'grammarSession') ensureGrammar(r);
  }, []);

  useEffect(() => {
    if (!useGrammarSession.getState().active && useNav.getState().route.name === 'grammarSession') back();
  }, [s.active, back]);

  useEffect(() => {
    const onAny = () => touchGrammar();
    window.addEventListener('pointerdown', onAny, { passive: true });
    window.addEventListener('keydown', onAny);
    return () => {
      window.removeEventListener('pointerdown', onAny);
      window.removeEventListener('keydown', onAny);
    };
  }, []);

  const showCards = cardsDue(s) && !!s.intro;
  const vortest = inVortest(s);
  const badge = vortest ? t('gxBadgeVortest', { n: s.pos + 1 }) : inRepeat(s) ? t('nbLernenRepeatBadge') : task?.errorT !== null && task ? t('grReviewBadge') : null;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="grammar-session" data-mode={s.mode} data-ctx={s.ctx} data-profile={s.profile}>
      <RoundTop onClose={leave} progress={grammarProgress(s)} ctx={s.ctx} duty="ch:gram" />
      {/* Leistung (N45): kein Warten auf das Ausblenden – die nächste Aufgabe steht sofort da
          und blendet nur kurz ein (≤ 150 ms, Deckkraft/Verschieben). */}
      <motion.div key={s.status === 'summary' ? 'summary' : showCards ? `intro-${s.step}` : `g-${s.step}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: DURATION.fast, ease: EASE_OUT }}>
        {showCards && s.intro ? (
          <IntroFlow
            topic={s.intro.topic}
            pats={s.intro.pats}
            fresh={s.intro.fresh}
            onGo={() => {
              const first = startAfterIntro();
              if (first === 'typed') api.focusNow();
            }}
          />
        ) : s.status === 'running' && task ? (
          <StepBoundary resetKey={`g-${s.step}`} scope="grammarSession" onSkip={skipGrammar}>
            <GrammarItem task={task} ctx={s.ctx} day={s.day} onDone={commitGrammar} profile={s.profile} noHelp={vortest} topicRound={s.mode === 'topic' || (!!s.intro && s.intro.topic === task.topic && !!task.pat && s.intro.pats.includes(task.pat))} badge={badge} />
          </StepBoundary>
        ) : (
          <div data-testid="summary">
            <GrammarEnd lang={lang} />
          </div>
        )}
      </motion.div>
    </div>
  );
}

const dots = (st: PatternState): number => STATE_DOTS[st];

/** Rundenende (§5.4): je geübtem Muster eine Zeile, deren Punkte wandern; „Neu sicher“, „Noch wackelig“, Fehlerliste mit „kommt morgen wieder“. */
function GrammarEnd({ lang }: { lang: 'de' | 'en' }) {
  const { t, tn } = useT();
  const s = useGrammarSession((x) => x);
  const api = useHiddenInput();
  const duties = useToday((x) => x.duties);
  const ready = useToday((x) => x.ready);
  const back = () => leaveBack(leaveGrammar);
  const growth = patternGrowth(s);
  const pick = (b: { de: string; en: string }): string => (lang === 'de' ? b.de : b.en);
  const name = (id: string): string => {
    const p = patternById(id);
    return p ? pick(p.name) : id;
  };
  const items = growth.map((g) => ({
    label: name(g.pat),
    from: dots(patternState(g.from, s.day)),
    to: dots(patternState(g.to, s.day)),
    max: 4,
    state: patternState(g.to, s.day),
  }));
  const facts: string[] = [];
  for (const g of growth) {
    const was = patternState(g.from, s.day);
    const now = patternState(g.to, s.day);
    if ((was === 'new' || was === 'learning') && (now === 'safe' || now === 'firm')) facts.push(t('gxEndSafe', { name: name(g.pat), k: g.clean, n: g.n }));
  }
  const wrongPats = new Set(s.results.filter((r) => !r.ok && r.pat).map((r) => r.pat as string));
  for (const g of growth) if (wrongPats.has(g.pat) && patternState(g.to, s.day) === 'learning') facts.push(t('gxEndWobbly', { name: name(g.pat) }));
  const mistakes = s.results
    .filter((r): r is typeof r & { right: string } => !r.ok && !!r.right)
    .slice(0, 4)
    .map((r) => ({ wrong: (r.given ?? '').trim() || '…', right: r.right, rule: r.pat ? name(r.pat) : topicName(r.topic, lang), when: t('gxEndTomorrow') }));
  // Ohne Muster (Themen ohne Musterdatei): die geübten Themen als Zeilen ohne Punkte.
  const plain = growth.length ? [] : [...new Set(s.results.map((r) => r.topic))].map((tp) => t('gxEndNoPattern', { topic: topicName(tp, lang) }));
  const right = s.results.filter((r) => r.ok).length;
  const next = s.block ? null : ready ? firstOpenDuty({ duties }) : null;
  const main = s.block
    ? { label: t('nbShNext'), run: reportGrammarDone }
    : next
      ? {
          label: t('lrNextDuty', { step: dutyLabel(next, t) }),
          run: () => {
            leaveGrammar();
            startDuty(next, api);
          },
        }
      : { label: t('sumBack'), run: back };
  void tn;
  return (
    <SessionEnd
      mode="growth"
      title={s.results.length ? t('gxEndTitle') : t('grNothing')}
      right={right}
      total={s.results.length}
      ms={s.activeMs}
      items={items}
      facts={[...facts, ...plain]}
      mistakes={mistakes}
      next={main}
      {...(!s.block && next ? { secondary: { label: t('sumBack'), run: back } } : {})}
    />
  );
}
