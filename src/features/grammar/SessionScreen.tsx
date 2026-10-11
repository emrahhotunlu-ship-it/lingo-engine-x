import { CardStack } from '../../ui/CardStack';
import { useEffect, useLayoutEffect, useState } from 'react';
import { leaveBack, useNav } from '../../app/nav';
import { patternById } from '../../domain/grammar/patterns';
import { patternState, type PatternState } from '../../domain/metrics/pattern';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useHotkeys } from '../../engine/useHotkeys';
import { useT } from '../../i18n';
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
import { TT_N, TT_PASS } from '../../domain/grammar/topicTest';
import { skipTopicTest } from '../c1/skipTest';
import { cardsDue, commitGrammar, grammarProgress, inRepeat, inVortest, leaveGrammar, patternGrowth, reportGrammarDone, skipGrammar, startAfterIntro, touchGrammar, useGrammarSession, type TestState } from './session';

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
  // Themen-Test (K4): die ersten Aufgaben sind der Test, ohne Hilfe.
  const inTest = s.status === 'running' && !!s.test && s.pos < s.test.n;
  const badge = inTest && s.test ? t('pxKTestBadge', { n: s.pos + 1, total: s.test.n }) : vortest ? t('gxBadgeVortest', { n: s.pos + 1, total: s.intro?.vtN ?? 2 }) : inRepeat(s) ? t('nbLernenRepeatBadge') : task?.errorT !== null && task ? t('grReviewBadge') : null;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="grammar-session" data-mode={s.mode} data-ctx={s.ctx} data-profile={s.profile}>
      <RoundTop onClose={leave} progress={grammarProgress(s)} ctx={s.ctx} duty="ch:gram" />
      {/* Leistung (N45): kein Warten auf das Ausblenden – die nächste Aufgabe steht sofort da und rückt aus dem Kartenstapel nach vorn (P54, ≤ 300 ms). */}
      <CardStack stackKey={s.status === 'summary' ? 'summary' : showCards ? `intro-${s.step}` : `g-${s.step}`}>
        {showCards && s.intro ? (
          <IntroFlow
            topic={s.intro.topic}
            pats={s.intro.pats}
            fresh={s.intro.fresh}
            kurzMiss={s.intro.kurz === true && s.intro.passed === false}
            onGo={() => {
              const first = startAfterIntro();
              if (first === 'typed') api.focusNow();
            }}
          />
        ) : s.status === 'running' && task ? (
          <StepBoundary resetKey={`g-${s.step}`} scope="grammarSession" onSkip={skipGrammar}>
            <GrammarItem task={task} ctx={s.ctx} day={s.day} onDone={commitGrammar} profile={s.profile} noHelp={vortest || inTest} topicRound={s.mode === 'topic' || (!!s.intro && s.intro.topic === task.topic && !!task.pat && s.intro.pats.includes(task.pat))} badge={badge} />
          </StepBoundary>
        ) : (
          <div data-testid="summary">
            <GrammarEnd lang={lang} />
          </div>
        )}
      </CardStack>
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
      {...(s.test?.result ? { takeaways: <TestResult test={{ ...s.test, result: s.test.result }} lang={lang} /> } : {})}
      next={main}
      {...(!s.block && next ? { secondary: { label: t('sumBack'), run: back } } : {})}
    />
  );
}

/** Ergebnis des Themen-Tests (K4): bestanden oder „noch nicht“ mit den schwachen Stellen, „morgen noch einmal“ und dem Weg weiter. Nie gesperrt. */
function TestResult({ test, lang }: { test: TestState & { result: NonNullable<TestState['result']> }; lang: 'de' | 'en' }) {
  const { t } = useT();
  const s = useGrammarSession((x) => x);
  const [skipped, setSkipped] = useState(false);
  const r = test.result;
  const topic = topicName(test.topic, lang);
  const weak = [...new Set(s.results.slice(0, test.n).filter((x) => !x.ok || x.help).map((x) => x.pat).filter((x): x is string => !!x))]
    .map((id) => patternById(id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => (lang === 'de' ? p.name.de : p.name.en));
  if (r.ok)
    return (
      <div className="flex flex-col gap-1" data-testid="tt-result" data-ok="true" data-c={r.c} data-n={r.n}>
        <p className="m-0 font-semibold">{t('pxKTestPassTitle')}</p>
        <p className="m-0 text-sm text-muted">{t('pxKTestPassText', { c: r.c, n: r.n, topic })}</p>
      </div>
    );
  return (
    <div className="flex flex-col gap-2" data-testid="tt-result" data-ok="false" data-c={r.c} data-n={r.n}>
      <p className="m-0 font-semibold">{t('pxKTestFailTitle')}</p>
      <p className="m-0 text-sm text-muted">{t('pxKTestFailText', { c: r.c, n: r.n, need: r.n - (TT_N - TT_PASS) })}</p>
      {weak.length > 0 && (
        <>
          <p className="m-0 text-sm">{t('pxKTestWeak')}</p>
          <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5 text-sm" data-testid="tt-weak">
            {weak.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </>
      )}
      <p className="m-0 text-sm text-muted">{t('pxKTestAgain')}</p>
      {skipped ? (
        <p className="m-0 text-sm text-muted" role="status" data-testid="tt-skipped">
          {t('pxKTestSkipped')}
        </p>
      ) : (
        <div>
          <button
            type="button"
            className="inline-flex min-h-11 items-center text-sm font-medium text-accent-text hover:underline"
            data-testid="tt-skip"
            onClick={() => {
              setSkipped(true);
              void skipTopicTest(test.topic).then((ok) => {
                if (!ok) setSkipped(false);
              });
            }}
          >
            {t('pxKTestSkip')}
          </button>
        </div>
      )}
    </div>
  );
}
