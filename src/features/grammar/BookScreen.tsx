import { useState } from 'react';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { bookChapters, BOOK_PARTS, EXAM_N, LESSON_PASS, LESSON_TEST_N, pageDone, pageTasks, type BookPart, type BookStep } from '../../domain/grammar/book';
import { patternsOf } from '../../domain/grammar/patterns';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT, type MessageKey } from '../../i18n';
import { toast } from '../../ui/Toast';
import { VButton } from '../../ui/v/VButton';
import { VRow } from '../../ui/v/VRow';
import { useCompanionSee } from '../companion/seeing';
import { ScreenHeader } from '../learn/ui';
import { bookNextOf, bookView, pageResult } from './bookStore';
import { useClock } from '../../app/clock';
import { TopicSheet } from './GrammarScreen';
import { startGrammar } from './session';
import { topicName } from './topicUi';

// Grammatik-Buch (Emrah 08.11.2026: „Gezielte Grammatik-Übungen wie im Buch, wo man dann auch eine Klausur schreibt“; docs/umbau/buch/plan.md).
// `book`: alle Kapitel mit ihren Lektionen und der Klausur, oben „Weiter im Buch“. `bookLesson`: eine Lektion mit Regel, Übung A/B/C und Test.

type Api = ReturnType<typeof useHiddenInput>;
type Go = ReturnType<typeof useNav.getState>['go'];

const PART_KEY: Record<BookPart, MessageKey> = {
  A: 'bkPartA',
  B: 'bkPartB',
  C: 'bkPartC',
  T: 'bkPartT',
};
const PART_SHORT: Record<BookPart, MessageKey> = {
  A: 'bkPartShortA',
  B: 'bkPartShortB',
  C: 'bkPartShortC',
  T: 'bkPartShortT',
};

/** Eine Seite bzw. die Klausur starten. `attempt` = bisherige Versuche (ein neuer Versuch mischt den Test bzw. die Klausur neu). */
export function startBookStep(step: BookStep, attempt: number, api: Api, go: Go): boolean {
  const first =
    step.kind === 'exam'
      ? startGrammar({
          mode: 'topic',
          topic: null,
          book: { part: 'X', topic: null, chapter: step.chapter, attempt },
        })
      : startGrammar({
          mode: 'topic',
          topic: step.topic,
          book: {
            part: step.part,
            topic: step.topic,
            chapter: step.chapter,
            attempt,
          },
        });
  if (first === null && step.kind === 'page' && !pageTasks(step.topic, step.part, attempt).length) return false;
  if (first === 'typed') api.focusNow();
  go({
    name: 'grammarSession',
    mode: 'topic',
    ...(step.kind === 'page' ? { topic: step.topic } : {}),
  });
  return true;
}

/** Name einer Seite für Zeilen und Hinweise („Übung B · Unterscheiden“). */
export function pageLabel(part: BookPart, t: (k: MessageKey) => string): string {
  return t(PART_KEY[part]);
}

/** „Weiter im Buch“: nächste offene Seite (Tagesvorschlag); `null`, wenn das Buch geschafft ist. */
export function useBookNext(): BookStep | null {
  const doc = useLive((s) => s.docs['app/book']);
  const now = useClock((s) => s.now);
  return bookNextOf(doc, now);
}

function NextCard() {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const doc = useLive((s) => s.docs['app/book']);
  const v = bookView(doc);
  const now = useClock((s) => s.now);
  const next = bookNextOf(doc, now);
  const chN = (id: string) => bookChapters().find((c) => c.id === id)?.n ?? 1;
  if (!next)
    return (
      <p className="lx-t-support m-0 text-muted" data-testid="book-all-done">
        {t('bkAllDone')}
      </p>
    );
  const text =
    next.kind === 'exam'
      ? t('bkNextExam', { ch: chN(next.chapter) })
      : t('bkNextPage', {
          ch: chN(next.chapter),
          topic: topicName(next.topic, lang),
          page: t(PART_KEY[next.part]),
        });
  const attempt = next.kind === 'exam' ? v.exams(next.chapter).length : (v.page(next.topic, next.part)?.k ?? 0);
  return (
    <section className="lx-card flex flex-col gap-3 p-4" data-testid="book-next">
      <h2 className="lx-vg-lbl m-0">{t('bkNextHead')}</h2>
      <p className="lx-t-body m-0">{text}</p>
      <div>
        <VButton variant="pri" icon="play" onClick={() => startBookStep(next, attempt, api, go) || toast(t('grNothing'))} data-testid="book-next-go">
          {t('bkNextGo')}
        </VButton>
      </div>
    </section>
  );
}

export function BookScreen() {
  const { t, lang } = useT();
  const go = useNav((s) => s.go);
  const back = useNav((s) => s.back);
  const api = useHiddenInput();
  const doc = useLive((s) => s.docs['app/book']);
  const v = bookView(doc);
  const nextStep = bookNextOf(doc, useClock.getState().now);
  // 47 Lektionen auf einer Seite sind zu lang: offen ist nur das Kapitel des nächsten Schritts, die anderen öffnen sich per Tipp.
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(nextStep ? [nextStep.chapter] : []));
  const toggle = (id: string) => setOpen((o) => (o.has(id) ? new Set([...o].filter((x) => x !== id)) : new Set([...o, id])));
  useCompanionSee({ area: 'grammar', label: t('bkTitle'), phase: 'idle' });
  return (
    <div className="lx-vg mx-auto flex w-full max-w-3xl flex-col gap-5 py-4" data-testid="book">
      <ScreenHeader title={t('bkTitle')} lead={t('bkLead')} back={back} />
      <NextCard />
      {bookChapters().map((c) => {
        const done = c.topics.filter((tp) => BOOK_PARTS.every((p) => pageDone(p, v.page(tp, p)))).length;
        const exams = v.exams(c.id);
        const last = exams[exams.length - 1];
        const best = exams.length ? Math.min(...exams.map((e) => e.g)) : null;
        const examSub =
          best !== null && best <= 3
            ? t('bkExamPassed', { g: best })
            : last
              ? t('bkExamLast', { g: last.g, p: last.p })
              : done === c.topics.length
                ? t('bkExamReady')
                : t('bkExamOpen');
        return (
          <section key={c.id} className="flex flex-col gap-2" data-testid={`book-ch-${c.id}`} data-open={open.has(c.id) ? '1' : '0'}>
            <h2 className="m-0">
              <button type="button" className="lx-v-row w-full" aria-expanded={open.has(c.id)} onClick={() => toggle(c.id)} data-testid={`book-ch-toggle-${c.id}`}>
                <span className="lx-v-row-t">
                  <b>{t('bkChapter', { n: c.n, name: c.name[lang] })}</b>
                  <span>
                    {t('bkLessonsDone', { done, n: c.topics.length })} · {examSub}
                  </span>
                </span>
                <span
                  className="lx-v-row-chev"
                  aria-hidden="true"
                  style={{
                    transform: open.has(c.id) ? 'rotate(90deg)' : undefined,
                  }}
                >
                  ›
                </span>
              </button>
            </h2>
            {open.has(c.id) && (
              <div className="lx-vg-rows">
                {c.topics.map((tp) => (
                  <VRow
                    key={tp}
                    icon={BOOK_PARTS.every((p) => pageDone(p, v.page(tp, p))) ? 'check' : 'book'}
                    title={topicName(tp, lang)}
                    sub={BOOK_PARTS.map((p) => `${t(PART_SHORT[p])} ${pageDone(p, v.page(tp, p)) ? '✓' : '·'}`).join('  ')}
                    onClick={() => go({ name: 'bookLesson', topic: tp })}
                    data-testid={`book-lesson-${tp}`}
                  />
                ))}
                <VRow
                  icon="target"
                  title={t('bkExam', { n: c.n })}
                  sub={`${t('bkExamSub', { n: EXAM_N })} · ${examSub}`}
                  onClick={() => startBookStep({ kind: 'exam', chapter: c.id }, exams.length, api, go)}
                  data-testid={`book-exam-${c.id}`}
                />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function BookLessonScreen() {
  const { t, lang } = useT();
  const back = useNav((s) => s.back);
  const go = useNav((s) => s.go);
  const api = useHiddenInput();
  const topic = useNav((s) => (s.route.name === 'bookLesson' ? s.route.topic : null));
  const doc = useLive((s) => s.docs['app/book']);
  const [sheet, setSheet] = useState(false);
  const v = bookView(doc);
  const ch = bookChapters().find((c) => !!topic && c.topics.includes(topic));
  useCompanionSee({
    area: 'grammar',
    label: topic ? `${t('bkTitle')} · ${topicName(topic, lang)}` : t('bkTitle'),
    phase: 'idle',
  });
  if (!topic || !ch) return null;
  const goal = patternsOf(topic)?.canDo?.[lang] ?? null;
  const subOf = (p: BookPart): string => {
    const st = v.page(topic, p);
    const n = p === 'T' ? LESSON_TEST_N : pageTasks(topic, p).length;
    const what = p === 'T' ? t('bkPartSubT', { n, pass: LESSON_PASS }) : t(p === 'A' ? 'bkPartSubA' : p === 'B' ? 'bkPartSubB' : 'bkPartSubC', { n });
    const state = !st
      ? t('bkStateOpen')
      : p === 'T'
        ? t(pageDone('T', st) ? 'bkStateTestPass' : 'bkStateTestFail', {
            best: st.best,
            n: st.n,
          })
        : t('bkStateDone', { c: pageResult(doc, topic, p)?.c ?? 0, n: st.n });
    return `${what} · ${state}`;
  };
  return (
    <div className="lx-vg mx-auto flex w-full max-w-3xl flex-col gap-5 py-4" data-testid="book-lesson" data-topic={topic}>
      <ScreenHeader eyebrow={t('bkChapter', { n: ch.n, name: ch.name[lang] })} title={topicName(topic, lang)} lead={goal ?? undefined} back={back} />
      <div className="lx-vg-rows">
        <VRow icon="book" title={t('bkRule')} sub={t('bkRuleSub')} onClick={() => setSheet(true)} data-testid="book-rule" />
        {BOOK_PARTS.map((p) => (
          <VRow
            key={p}
            icon={pageDone(p, v.page(topic, p)) ? 'check' : p === 'T' ? 'target' : 'pen'}
            title={t(PART_KEY[p])}
            sub={subOf(p)}
            onClick={() => startBookStep({ kind: 'page', chapter: ch.id, topic, part: p }, v.page(topic, p)?.k ?? 0, api, go) || toast(t('grNothing'))}
            data-testid={`book-part-${p}`}
          />
        ))}
      </div>
      <button type="button" className="lx-vg-quiet" onClick={() => go({ name: 'book' })} data-testid="book-lesson-all">
        {t('bkTitle')}
      </button>
      <TopicSheet topic={sheet ? topic : null} onClose={() => setSheet(false)} />
    </div>
  );
}
