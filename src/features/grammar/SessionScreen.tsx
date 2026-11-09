import type { GrammarAnswer } from '../../domain/learn/types';
import { CardStack } from '../../ui/CardStack';
import { useBand } from '../../ui/exercise/bandStore';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { leaveBack, useNav } from '../../app/nav';
import { patternById, whyFor } from '../../domain/grammar/patterns';
import { patternState, type PatternState } from '../../domain/metrics/pattern';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useHotkeys } from '../../engine/useHotkeys';
import { useT } from '../../i18n';
import { SessionEnd } from '../../ui/SessionEnd';
import { STATE_DOTS } from '../../ui/exercise';
import { flush } from '../progress/persist';
import { RoundTop, dutyLabel } from '../learn/ui';
import { startDuty } from '../learn/flow';
import { firstOpenDuty, grammarDutyId, useToday } from '../today/state';
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
import { grammarModuleOn } from '../../modules/grammar/api';
import { useWhyReason, useWinOn } from '../tutor/WhyLine';
import { proofText, sureNote } from '../tutor/whyText';
import { scheduleLearner, useLearner } from '../tutor/learnerLive';
import { bookChapters, examGrade, LESSON_PASS } from '../../domain/grammar/book';

/** Stelle einer Lektion im Buch (Kapitel, dann Lektion), für die Reihenfolge im Klausur-Ergebnis. */
const bookOrder = (topic: string): number => {
  let i = 0;
  for (const c of bookChapters()) for (const tp of c.topics) {
    if (tp === topic) return i;
    i++;
  }
  return i;
};
import { pageLabel, startBookStep } from './BookScreen';
import { bookGrammarLeft, bookKeys, bookTesting, cardsDue, commitGrammar, grammarProgress, inRepeat, inVortest, leaveGrammar, patternGrowth, reportGrammarDone, skipGrammar, startAfterIntro, testVoidOpen, touchGrammar, useGrammarSession, type TestState } from './session';

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
  const gmod = useLive((x) => grammarModuleOn(x.docs['app/profile']));
  const vortest = inVortest(s);
  // Themen-Test (K4): die ersten Aufgaben sind der Test, ohne Hilfe.
  const inTest = s.status === 'running' && !!s.test && s.pos < s.test.n;
  // Grammatik-Buch: Lektionstest und Klausur ohne Hilfe; die Klausur ohne Rückmeldung je Aufgabe (`blind`).
  const bookTest = s.status === 'running' && bookTesting(s.book) && !inRepeat(s);
  const blind = bookTest && s.book?.part === 'X';
  const tutorOn = !vortest && !inTest && !bookTest && !inRepeat(s);
  // Klausur ohne Claude: die Übungsleiste zeigt dann weder „Frag Claude“ noch Begleiter oder Übersetzer.
  useEffect(() => {
    useBand.setState({ noAi: blind });
    return () => useBand.setState({ noAi: false });
  }, [blind]);
  const reason = useWhyReason(task ?? null, tutorOn && s.status === 'running');
  const win = useWinOn(task ?? null, tutorOn);
  // Buch-Seite: nach den Seiten-Aufgaben angehängte Fehlersätze bzw. Wiederholung sichtbar zählen (Nachprüfung 09.11.2026 N1).
  const bookExtra = !!s.book?.n && s.status === 'running' && s.pos >= s.book.n ? { n: s.pos - s.book.n + 1, total: s.tasks.length - s.book.n } : null;
  const badge = bookExtra ? t('bkExtraBadge', bookExtra) : bookTest ? (blind ? t('bkExamBadge', { n: s.pos + 1, total: s.tasks.length }) : t('bkTestBadge')) : win ? t('ttWin') : inTest && s.test ? t('pxKTestBadge') : vortest ? t('gxBadgeVortest', { n: s.pos + 1, total: s.intro?.vtN ?? 2 }) : inRepeat(s) ? t('nbLernenRepeatBadge') : task?.errorT !== null && task ? t('grReviewBadge') : null;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="grammar-session" data-mode={s.mode} data-ctx={s.ctx} data-profile={s.profile}>
      {/* Grammatik-Buch (UX-Prüfung 09.11.2026 S3): der Kopf nennt Lektion und Seite bzw. die Klausur statt nur „Grammatik“. */}
      <RoundTop onClose={leave} progress={grammarProgress(s)} ctx={s.ctx} duty={grammarDutyId(s.day) ?? 'ch:gram'} area="grammar" areaLabel={bookHead(s.book, t, lang)} />
      {/* Kapitel-Arbeit: Themen-Test noch in Vorbereitung (zu wenig Testaufgaben), stattdessen Übung: kurzer Hinweis vor der ersten Aufgabe. */}
      {s.prep && s.status === 'running' && s.pos === 0 && !showCards && (
        <p className="m-0 text-sm text-muted" role="status" data-testid="tt-prep">
          {t('pxKTestPrep')}
        </p>
      )}
      {/* Grammatik-Buch: vor der ersten Aufgabe sagen, dass dies der Lektionstest bzw. die Klausur ist (UX-Prüfung 09.11.2026). */}
      {bookTest && s.pos === 0 && (
        <p className="m-0 text-sm text-muted" role="status" data-testid="book-test-intro">
          {blind ? t('bkExamIntro', { n: s.tasks.length }) : t('bkTestIntro', { n: s.tasks.length, pass: LESSON_PASS })}
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
            {/* Tutor-Engine v3 (S2/S3): nach dem Tausch „Kurz etwas Bekanntes“ als Plakette in der Statuszeile (U3: kein reservierter Platz); „Warum diese Aufgabe?“ steht im ⓘ – nicht im Vortest, im Test und in der Wiederholung. */}
            <GrammarItem task={task} ctx={s.ctx} day={s.day} onDone={commitGrammar} onLeave={leaveBook} profile={s.profile} noHelp={vortest || inTest || bookTest} blind={blind} testVoid={inTest && testVoidOpen(s)} badgeTone={win || inTest || bookTest || bookExtra ? 'hint' : undefined} topicRound={s.mode === 'topic' || (!!s.intro && s.intro.topic === task.topic && !!task.pat && s.intro.pats.includes(task.pat))} badge={badge} {...(win ? { badgeTestId: 'tutor-win' } : {})} tutor={tutorOn && !s.fixed} reason={reason} mod={gmod} />
          </StepBoundary>
        ) : (
          <div data-testid="summary">
            {s.book ? <BookEnd lang={lang} /> : <GrammarEnd lang={lang} />}
          </div>
        )}
      </CardStack>
    </div>
  );
}

/**
 * Korrekturrunde P3 (Punkt 4, LS3): Antwort beim Verlassen buchen. `stay` (Seite verborgen): speichern, die Aufgabe bleibt stehen;
 * `go` (Runde, Reiter, Bildschirm verlassen): buchen und weiterrechnen – nur, solange genau diese Aufgabe in der Runde steht.
 */
function leaveBook(a: GrammarAnswer, mode: 'stay' | 'go'): void {
  const s = useGrammarSession.getState();
  if (!s.active || s.status !== 'running' || s.tasks[s.pos]?.key !== a.task.key) return;
  if (mode === 'stay') bookGrammarLeft(a);
  else commitGrammar(a);
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
  const proofs = useLearner((x) => x.model?.proofs);
  // Nach dem Zeichnen einmal neu rechnen, damit der Beleg die eben gegebenen Antworten kennt (nie vor dem Zeichnen).
  useEffect(() => scheduleLearner(), []);
  const pick = (b: { de: string; en: string }): string => (lang === 'de' ? b.de : b.en);
  const name = (id: string): string => {
    const p = patternById(id);
    return p ? pick(p.name) : id;
  };
  // U3: je Muster EINE Zeile mit Status-Punkt; „Neu sicher“, „Noch wackelig“, der Fortschrittsbeleg und die Fehler dieses Musters stehen in
  // dieser Zeile (vorher stand dasselbe Thema bis zu dreimal da: Punkte, Satz, Fehlerliste). Nur was keinem Muster gehört, bleibt darunter.
  const notes = new Map<string, string[]>();
  const note = (pat: string, text: string) => notes.set(pat, [...(notes.get(pat) ?? []), text]);
  const facts: string[] = [];
  for (const g of growth) {
    const was = patternState(g.from, s.day);
    const now = patternState(g.to, s.day);
    if ((was === 'new' || was === 'learning') && (now === 'safe' || now === 'firm')) note(g.pat, t('gxEndSafe', { k: g.clean, n: g.n }));
  }
  // Fortschrittsbeleg (Tutor-Engine v3 S2): nur aus dem Protokoll (`progressProof`), nur bei echtem Zuwachs, höchstens zwei Zeilen.
  if (proofs) {
    let k = 0;
    for (const g of growth) {
      const pr = proofs.get(g.pat);
      if (pr && pr.trend === 'up' && k < 2) {
        note(g.pat, proofText(g.pat, pr, lang));
        k++;
      }
    }
    if (k > 0) facts.push(sureNote(lang));
  }
  const wrongPats = new Set(s.results.filter((r) => !r.ok && r.pat).map((r) => r.pat as string));
  const grown = new Set(growth.map((g) => g.pat));
  const allMistakes = s.results
    .filter((r): r is typeof r & { right: string } => !r.ok && !!r.right)
    .slice(0, 4)
    .map((r) => ({ pat: r.pat ?? null, wrong: (r.given ?? '').trim() || '…', right: r.right, rule: r.pat ? name(r.pat) : topicName(r.topic, lang), when: t('gxEndTomorrow') }));
  // „Noch wackelig · kommt morgen wieder“ nur, wenn die Zeile nicht schon einen Fehler mit „kommt morgen wieder“ zeigt.
  for (const g of growth) if (wrongPats.has(g.pat) && patternState(g.to, s.day) === 'learning' && !allMistakes.some((m) => m.pat === g.pat)) note(g.pat, t('gxEndWobbly'));
  const strip = (m: (typeof allMistakes)[number]) => ({ wrong: m.wrong, right: m.right, rule: m.rule, when: m.when });
  const mistakes = allMistakes.filter((m) => !m.pat || !grown.has(m.pat)).map(strip);
  const items = growth.map((g) => ({
    label: name(g.pat),
    from: dots(patternState(g.from, s.day)),
    to: dots(patternState(g.to, s.day)),
    max: 4,
    state: patternState(g.to, s.day),
    notes: notes.get(g.pat) ?? [],
    mistakes: allMistakes.filter((m) => m.pat === g.pat).map(strip),
  }));
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
        mistakes={allMistakes.map(strip)}
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

/** Kopfzeile einer Buch-Runde: „used to · Übung A“ bzw. „Klausur Kapitel 1“. */
function bookHead(b: ReturnType<typeof useGrammarSession.getState>['book'], t: ReturnType<typeof useT>['t'], lang: 'de' | 'en'): string | undefined {
  if (!b) return undefined;
  if (b.part === 'X') return t('bkExam', { n: bookChapters().find((c) => c.id === b.chapter)?.n ?? 1 });
  // Seite zuerst: am iPhone wird der Kopf gekürzt, dann bleibt „Übung A“ stehen (Nachprüfung 09.11.2026).
  return b.topic ? `${t(b.part === 'A' ? 'bkPartShortA' : b.part === 'B' ? 'bkPartShortB' : b.part === 'C' ? 'bkPartShortC' : 'bkPartT')} · ${topicName(b.topic, lang)}` : undefined;
}

/**
 * Ende einer Buch-Seite bzw. Klausur (Emrah 08.11.2026): Ergebnis als Zahl bzw. Note + Prozent; in der Klausur je Lektion „x von n“ und die
 * schwachen Lektionen; darunter JEDER Fehler mit Lösung und Begründung (in der Klausur kamen sie während der Aufgaben nicht).
 */
function BookEnd({ lang }: { lang: 'de' | 'en' }) {
  const { t } = useT();
  const s = useGrammarSession((x) => x);
  const api = useHiddenInput();
  const go = useNav((x) => x.go);
  const b = s.book;
  if (!b) return null;
  const keys = bookKeys(s);
  const rows = s.results.filter((r) => !r.xt && keys.has(r.key));
  const c = rows.filter((r) => r.ok).length;
  const n = rows.length;
  const exam = b.part === 'X';
  const g = examGrade(c, n);
  const title = exam
    ? t('bkEndExam', { g: g.grade, p: g.pct })
    : b.part === 'T'
      ? t(c >= Math.min(LESSON_PASS, n) ? 'bkEndTestPass' : 'bkEndTestFail', { c, n, pass: LESSON_PASS })
      : t('bkEndPage', { page: `${b.topic ? `${topicName(b.topic, lang)} · ` : ''}${b.part === 'X' ? '' : pageLabel(b.part, t)}`, c, n });
  const taskOf = (key: string) => s.tasks.find((x) => x.key === key);
  const mistakes = rows
    .filter((r) => !r.ok)
    .map((r) => {
      const task = taskOf(r.key);
      // Erklärungen A (Emrah): zuerst die Erklärung zu genau dieser falschen Antwort (`why.wrong`), sonst die Begründung der Lösung.
      const hit = task ? whyFor(task, { given: r.given ?? '', picked: r.given ?? '' }).rule : null;
      const why = hit ? hit[lang] : task ? ((lang === 'de' ? task.expl.de : task.expl.en) ?? '') : '';
      // UX-Prüfung 09.11.2026 S1: keine Rohwerte („none“, „a → b“), sondern Wortlaut.
      const mx = task?.x?.kind === 'meaning' ? task.x : null;
      // Bedeutungspaar: mit Buchstaben, weil das Warum von „a“ und „b“ spricht (Nachprüfung 09.11.2026 N3).
      const shown = (v: string): string => (v === 'none' ? t('exNoError') : mx ? (v === 'a' ? `a) ${mx.a}` : v === 'b' ? `b) ${mx.b}` : v === 'both' ? t('gxMeaningBoth') : v) : v);
      return { wrong: shown((r.given ?? '').trim()) || '…', right: shown(r.right ?? ''), rule: why || topicName(r.topic, lang), when: '' };
    });
  const byTopic = new Map<string, { c: number; n: number }>();
  for (const r of rows) {
    const e = byTopic.get(r.topic) ?? { c: 0, n: 0 };
    e.n++;
    if (r.ok) e.c++;
    byTopic.set(r.topic, e);
  }
  const weak = [...byTopic.entries()].filter(([, e]) => e.c * 2 < e.n).map(([tp]) => tp);
  const lead = exam ? (
    <div className="flex flex-col gap-2" data-testid="book-exam-result" data-grade={g.grade} data-pct={g.pct}>
      <p className="lx-t-body m-0">{t(g.passed ? 'bkEndExamPass' : 'bkEndExamFail', { c, n })}</p>
      {/* UX-Prüfung 09.11.2026 S7: Lektionen in Buch-Reihenfolge, schwache mit Marke – keine zweite Liste derselben Lektionen. */}
      <ul className="m-0 flex list-none flex-col gap-1 p-0 lx-t-support" data-testid="book-exam-lessons">
        {[...byTopic.entries()]
          .sort(([a], [b]) => bookOrder(a) - bookOrder(b))
          .map(([tp, e]) => (
            <li key={tp} className={weak.includes(tp) ? 'text-wrong-text' : ''} data-weak={weak.includes(tp) ? '1' : undefined}>
              {t('bkEndLesson', { topic: topicName(tp, lang), c: e.c, n: e.n })}
              {weak.includes(tp) ? ` · ${t('bkEndWeakMark')}` : ''}
            </li>
          ))}
      </ul>
      {!weak.length && <p className="lx-t-meta m-0 text-muted">{t('bkEndWeakNone')}</p>}
    </div>
  ) : null;
  const again = () => {
    leaveGrammar();
    const step = b.part === 'X' ? { kind: 'exam' as const, chapter: b.chapter ?? '' } : { kind: 'page' as const, chapter: b.chapter ?? '', topic: b.topic ?? '', part: b.part };
    startBookStep(step, b.attempt + 1, api, go);
  };
  const back = () => leaveBack(leaveGrammar);
  return (
    <SessionEnd
      mode="growth"
      title={title}
      hideScore
      right={c}
      total={n}
      ms={s.activeMs}
      {...(lead ? { lead } : {})}
      mistakes={mistakes}
      {...(mistakes.length ? { mistakesNote: t('bkEndMistakesNote') } : {})}
      next={s.block ? { label: t('nbShNext'), run: reportGrammarDone } : { label: t('bkEndBack'), run: back }}
      secondary={{ label: t('bkEndAgain'), run: again }}
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
 * - bestanden oder „trotzdem weiter“: der nächste Schritt im Kapitel („Nächstes Thema beginnen“, sonst derselbe Knopftext wie die Weiter-Karte).
 * `null` ohne Themen-Test oder ohne Kapitel-Arbeit (dann gilt der bisherige Knopf).
 */
function useTestNext(test: TestDone | null, skipped: boolean, day: string): { label: string; run: () => void } | null {
  const { t } = useT();
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
  const label = cursor.phase === 'intro' && cursor.topic ? t('pxKEndTopicBtn') : t(chapterBtnKey(cursor, prep));
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
