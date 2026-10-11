import { CardStack } from '../../ui/CardStack';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
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
import { chapterBtnKey, cursorPrep, runCursor, startChapter } from '../c1/chapterRun';
import { useChosenChapter } from '../c1/chosen';
import { chapterNow, withTestOutcome } from '../../domain/c1/cursor';
import { programChapters } from '../../domain/c1/chapters';
import { chapterRunOn } from '../../app/flags';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
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
  const badge = inTest && s.test ? t('pxKTestBadge') : vortest ? t('gxBadgeVortest', { n: s.pos + 1, total: s.intro?.vtN ?? 2 }) : inRepeat(s) ? t('nbLernenRepeatBadge') : task?.errorT !== null && task ? t('grReviewBadge') : null;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="grammar-session" data-mode={s.mode} data-ctx={s.ctx} data-profile={s.profile}>
      <RoundTop onClose={leave} progress={grammarProgress(s)} ctx={s.ctx} duty="ch:gram" />
      {/* Kapitel-Arbeit: Themen-Test noch in Vorbereitung (zu wenig Testaufgaben), stattdessen Übung: kurzer Hinweis vor der ersten Aufgabe. */}
      {s.prep && s.status === 'running' && s.pos === 0 && !showCards && (
        <p className="m-0 text-sm text-muted" role="status" data-testid="tt-prep">
          {t('pxKTestPrep')}
        </p>
      )}
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
            <GrammarItem task={task} ctx={s.ctx} day={s.day} onDone={commitGrammar} profile={s.profile} noHelp={vortest || inTest} badgeTone={inTest ? 'hint' : undefined} topicRound={s.mode === 'topic' || (!!s.intro && s.intro.topic === task.topic && !!task.pat && s.intro.pats.includes(task.pat))} badge={badge} />
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
const EMPTY_DOCS = new Map<string, Record<string, unknown>>();

/** Rundenende (§5.4): je geübtem Muster eine Zeile, deren Punkte wandern; „Neu sicher“, „Noch wackelig“, Fehlerliste mit „kommt morgen wieder“. */
function GrammarEnd({ lang }: { lang: 'de' | 'en' }) {
  const { t, tn } = useT();
  const s = useGrammarSession((x) => x);
  const api = useHiddenInput();
  const duties = useToday((x) => x.duties);
  const ready = useToday((x) => x.ready);
  const back = () => leaveBack(leaveGrammar);
  // Themen-Test (K4): „Nächstes Thema trotzdem beginnen“ gilt für Ergebnisblock und Hauptknopf zugleich.
  const [skipped, setSkipped] = useState(false);
  const testRes: TestDone | null = s.test?.result ? { ...s.test, result: s.test.result } : null;
  const chapterNext = useTestNext(testRes, skipped, s.day);
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
    : (chapterNext ??
      (next
        ? {
            label: t('lrNextDuty', { step: dutyLabel(next, t) }),
            run: () => {
              leaveGrammar();
              startDuty(next, api);
            },
          }
        : { label: t('sumBack'), run: back }));
  void tn;
  if (testRes) {
    // Themen-Test (UX-Prüfung Kapitel-Arbeiten): Überschrift = Ergebnis mit Zahl, der Ergebnisblock steht oben und wiederholt die Zahl nicht. Die
    // schwachen Stellen stehen EINMAL als Liste („Das übst du als Nächstes“) und in der Fehlerliste mit Vergleich – kein „Noch wackelig“, kein
    // „Was sich bewegt hat“. „Zurück zu Heute“ bleibt der ruhige zweite Weg.
    const r = testRes.result;
    return (
      <SessionEnd
        mode="growth"
        title={t(r.ok ? 'pxKTestPassHead' : 'pxKTestFailHead', { c: r.c, n: r.n })}
        hideScore
        right={right}
        total={s.results.length}
        ms={s.activeMs}
        lead={<TestResult test={testRes} lang={lang} skipped={skipped} onSkip={setSkipped} />}
        mistakes={mistakes}
        next={main}
        {...(!s.block && (chapterNext || next) ? { secondary: { label: t('sumBack'), run: back } } : {})}
      />
    );
  }
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

type TestDone = TestState & { result: NonNullable<TestState['result']> };

/** Schwache Muster des Tests (falsch oder mit Hilfe): dieselbe Regel wie `tt.w` beim Schreiben (`session.ts`). */
function testWeakIds(results: ReadonlyArray<{ ok: boolean; help?: boolean; pat?: string | null }>, n: number): string[] {
  return [...new Set(results.slice(0, n).filter((x) => !x.ok || x.help).map((x) => x.pat).filter((x): x is string => !!x))];
}

/**
 * Hauptknopf nach dem Themen-Test, aus demselben Kapitel-Cursor wie die Weiter-Karte im Reiter:
 * - nicht bestanden: „Schwache Stellen üben“ (Übung desselben Themas, genau die schwachen Muster wie `tt.w`, wie die Phase „Üben“ des Cursors);
 * - bestanden oder „trotzdem weiter“: der nächste Schritt im Kapitel („Thema beginnen: …“, sonst derselbe Knopftext wie die Weiter-Karte).
 * `null` ohne Themen-Test oder ohne Kapitel-Arbeit (dann gilt der bisherige Knopf).
 */
function useTestNext(test: TestDone | null, skipped: boolean, day: string): { label: string; run: () => void } | null {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const docs = useLive((x) => x.collections.grammar) ?? EMPTY_DOCS;
  const nowMs = useClock((x) => x.now);
  const chosen = useChosenChapter();
  const results = useGrammarSession((x) => x.results);
  const topic = test?.topic ?? null;
  const ok = test?.result.ok ?? false;
  const cursor = useMemo(
    () => (topic ? chapterNow({ docs: withTestOutcome(docs, topic, { day, ok, skipped }), today: day, nowMs, chosen }).cursor : null),
    [topic, ok, docs, day, nowMs, chosen, skipped],
  );
  const prep = useMemo(() => cursorPrep(cursor, docs), [cursor, docs]);
  if (!test || !chapterRunOn()) return null;
  if (!test.result.ok && !skipped) {
    const pats = testWeakIds(results, test.n);
    return {
      label: t('pxKTestPracticeBtn'),
      run: () => {
        leaveGrammar();
        runCursor({ chapter: cursor?.chapter ?? 0, n: cursor?.n ?? 1, topic: test.topic, phase: 'practice', pats, retry: false }, api);
      },
    };
  }
  if (!cursor) return null;
  if (cursor.phase === 'done') {
    if (cursor.chapter + 1 >= programChapters().length) return null;
    return {
      label: t('pxKBtnDone'),
      run: () => {
        leaveGrammar();
        startChapter(cursor.chapter + 1, api);
      },
    };
  }
  const label = cursor.phase === 'intro' && cursor.topic ? t('pxKEndTopicBtn', { topic: topicName(cursor.topic, lang) }) : t(chapterBtnKey(cursor, prep));
  return {
    label,
    run: () => {
      leaveGrammar();
      runCursor(cursor, api);
    },
  };
}

/** Ergebnis des Themen-Tests (K4), oben im Rundenende: bestanden oder „noch nicht“ mit den schwachen Stellen, „morgen noch einmal“ und dem Weg weiter. Nie gesperrt. */
function TestResult({ test, lang, skipped, onSkip }: { test: TestDone; lang: 'de' | 'en'; skipped: boolean; onSkip: (v: boolean) => void }) {
  const { t } = useT();
  const results = useGrammarSession((x) => x.results);
  const r = test.result;
  const topic = topicName(test.topic, lang);
  const weak = testWeakIds(results, test.n)
    .map((id) => patternById(id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => (lang === 'de' ? p.name.de : p.name.en));
  if (r.ok)
    return (
      <div className="flex flex-col gap-1" data-testid="tt-result" data-ok="true" data-c={r.c} data-n={r.n}>
        <p className="m-0 text-sm text-muted">{t('pxKTestPassLine', { topic })}</p>
      </div>
    );
  return (
    <div className="flex flex-col gap-2" data-testid="tt-result" data-ok="false" data-c={r.c} data-n={r.n}>
      <p className="m-0 text-sm text-muted">{t('pxKTestFailLine', { need: r.n - (TT_N - TT_PASS) })}</p>
      {/* Nach „trotzdem weiter“ geht es mit dem nächsten Thema weiter: dann keine Liste „Das übst du als Nächstes“ mehr. */}
      {weak.length > 0 && !skipped && (
        <>
          <p className="m-0 text-sm">{t('pxKTestWeak')}</p>
          <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5 text-sm" data-testid="tt-weak">
            {weak.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </>
      )}
      {!skipped && <p className="m-0 text-sm text-muted">{t('pxKTestAgain')}</p>}
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
              onSkip(true);
              void skipTopicTest(test.topic).then((saved) => {
                if (!saved) onSkip(false);
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
