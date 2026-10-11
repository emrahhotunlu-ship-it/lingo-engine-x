import { pendingName } from '../../domain/c1/chapters';
import type { ProgramChapter } from '../../domain/c1/programTypes';
import type { ChapterProgress, TopicProgress } from '../../domain/c1/state';
import { useT, type MessageKey } from '../../i18n';
import { CopyBox } from '../../ui/CopyBox';
import { ProgressRing } from '../../ui/ProgressRing';
import { Sheet } from '../../ui/Sheet';
import { topicName } from '../grammar/topicUi';
import { filmForTopics } from '../../domain/c1/anim';
import { FilmLauncher, filmEnabled } from './film/FilmLauncher';
import { GateSection } from './gate/GateCard';
import { chapterRunOn, flags } from '../../app/flags';
import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { chapterPhases, type TopicPhase } from '../../domain/c1/cursor';
import { useHiddenInput } from '../../engine/HiddenInput';
import { Button } from '../../ui/Button';
import { chapterBtnKey, cursorPrep, startChapter, useChapterNow } from './chapterRun';
import { Icon } from '../../ui/Icon';

const PHASE_KEY: Record<TopicPhase, MessageKey> = { intro: 'pxKPhaseIntro', practice: 'pxKPhasePractice', test: 'pxKPhaseTest', done: 'pxKPhaseDone' };
const TONE_CLASS: Record<TopicTone, string> = { new: 'bg-surface-strong text-fg', learning: 'bg-hint-soft text-hint-text', safe: 'bg-ok-soft text-ok-text', done: 'bg-ok-soft text-ok-text' };
const EMPTY = new Map<string, Record<string, unknown>>();

// Kapitelblatt (Lernplattform 3.0 P32): ein Kapitel des C1-Programms mit Ziel („Abgeschlossen heißt …“), den Themen mit Ring „Muster sicher a/b“,
// der Prüfungsfokus und der Satz für den Lehrer. Alle Zahlen kommen aus `chapterState` (eine Quelle); das Blatt rechnet nichts selbst.

type TopicTone = 'new' | 'learning' | 'safe' | 'done';

/**
 * Zustand eines Themas für die Anzeige, nur aus dem Fortschritt abgeleitet. Im Kapitel-Modus (`run`) gilt ein Thema mit bestandenem Themen-Test
 * als „Geschafft“ (`done`, dieselbe Regel wie Zähler und Phase), sonst wie bisher „sicher“.
 */
export function topicTone(t: TopicProgress, run = false): TopicTone {
  if (run && t.done) return 'done';
  if (t.safe) return 'safe';
  return t.introduced ? 'learning' : 'new';
}

export const TONE_KEY: Record<TopicTone, MessageKey> = { new: 'nbLernenStateNew', learning: 'nbLernenStateLearning', safe: 'nbLernenStateSafe', done: 'pxKPhaseDone' };

export function ChapterSheet({ open, chapter, progress, onClose }: { open: boolean; chapter: ProgramChapter | null; progress: ChapterProgress | null; onClose: () => void }) {
  const { t, lang } = useT();
  // Kapitelstart (P61): der Struktur-Film des ersten Themas mit Film, ein Startknopf, der Film klappt hier im Blatt auf.
  const film = progress && filmEnabled() ? filmForTopics(progress.topics.filter((r) => r.exists).map((r) => r.id)) : null;
  // Kapitel-Arbeit (K5): ein Hauptknopf „Kapitel starten/Weiterarbeiten“ und je Thema die Phase (Neu kennenlernen · Üben · Themen-Test · Geschafft).
  const run = chapterRunOn() && !!progress?.ready;
  const api = useHiddenInput();
  const today = useClock((x) => x.today);
  const docs = useLive((x) => x.collections.grammar) ?? EMPTY;
  const phases = useMemo(() => (run && progress ? chapterPhases({ chapter: progress, docs, today }) : null), [run, progress, docs, today]);
  // Das wirksame Kapitel („Du bist hier“): derselbe Cursor wie die Weiter-Karte im Reiter, deshalb derselbe Knopftext und der Tagessatz nur hier.
  const { cursor } = useChapterNow();
  const active = run && !!chapter && cursor?.n === chapter.n ? cursor : null;
  const prep = useMemo(() => cursorPrep(active, docs), [active, docs]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={chapter ? t('pxChTitle', { n: chapter.n, name: chapter.name[lang] }) : ''}
      closeLabel={t('pxChClose')}
    >
      {chapter && progress && (
        <div className="flex flex-col gap-5 pb-2" data-testid="chapter-sheet" data-chapter={chapter.id} data-status={progress.status}>
          <section className="flex flex-col gap-1.5" aria-labelledby="px-ch-goal">
            <h3 id="px-ch-goal" className="lx-eyebrow">
              {t('pxChGoal')}
            </h3>
            <p className="leading-relaxed" data-testid="chapter-goal">
              {chapter.done[lang]}
            </p>
            {progress.ready ? (
              // Im Kapitel-Modus zählt „geschafft“ wie die Liste unten (sicher oder Themen-Test bestanden), sonst wie bisher „sicher“.
              <p className="lx-tnum text-sm text-muted" data-testid="chapter-sheet-pats" data-safe={run ? progress.topicDone : progress.topicSafe} data-total={progress.liveTopics}>
                {run ? t('pxKDoneCount', { a: progress.topicDone, b: progress.liveTopics }) : t('hxPathSafe', { a: progress.topicSafe, b: progress.liveTopics })}
              </p>
            ) : (
              <p className="text-sm text-muted" data-testid="chapter-sheet-soon">
                {t('pxMapSoon')}
              </p>
            )}
          </section>

          {run && chapter && progress && (
            <section className="flex flex-col gap-2" aria-label={t('pxKStart')} data-testid="chapter-run">
              <p className="text-sm text-muted" data-testid="chapter-daily" data-active={active ? 'true' : 'false'}>
                {t(active ? 'pxKDaily' : 'pxKDailyIf')}
              </p>
              <div>
                <Button
                  variant="primary"
                  iconAfter="arrowRight"
                  data-testid="chapter-start"
                  data-chapter={chapter.n}
                  onClick={() => {
                    startChapter(chapter.n - 1, api);
                    onClose();
                  }}
                >
                  {active ? t(chapterBtnKey(active, prep)) : progress.introduced > 0 ? t('pxKContinue') : t('pxKStart')}
                </Button>
              </div>
            </section>
          )}

          {film && (
            <section className="flex flex-col gap-2" aria-labelledby="px-ch-film" data-testid="chapter-film">
              <h3 id="px-ch-film" className="lx-eyebrow">
                {t('eeFmChapterTitle')}
              </h3>
              <FilmLauncher film={film} />
            </section>
          )}

          <section className="flex flex-col gap-2" aria-labelledby="px-ch-topics">
            <h3 id="px-ch-topics" className="lx-eyebrow">
              {t('pxChTopics')}
            </h3>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {progress.topics.map((r) => {
                const name = r.exists ? topicName(r.id, lang) : (pendingName(r.id, lang) ?? r.id);
                const tone = topicTone(r, run);
                const phase = r.exists ? phases?.get(r.id) : undefined;
                // Kapitel-Modus: „Geschafft“ (sicher oder Test bestanden) füllt den Ring und zeigt das Häkchen – dieselbe Quelle wie die Phase.
                const full = run && r.done;
                return (
                  <li
                    key={r.id}
                    data-testid="chapter-topic"
                    data-topic={r.id}
                    data-exists={r.exists ? 'true' : 'false'}
                    className="bg-surface-solid flex min-h-14 items-center gap-3 rounded-[0.875rem] border border-line px-3.5 py-2"
                  >
                    <span className="relative flex flex-none items-center justify-center" data-testid="chapter-topic-ring" data-done={full ? 'true' : undefined}>
                      <ProgressRing
                        value={full ? 1 : r.patTotal > 0 ? r.patSafe / r.patTotal : 0}
                        size={32}
                        stroke={4}
                        label={phase ? t('pxKTopicAria', { name, phase: t(PHASE_KEY[phase]) }) : t('pxChTopicAria', { name, a: r.patSafe, b: r.patTotal })}
                      />
                      {full && <Icon name="check" size={16} className="absolute text-ok-text" aria-hidden="true" />}
                    </span>
                    {/* UX-Prüfung B2: eine Maßeinheit – je Thema nur der Zustand (Neu · Lernt · Sicher); die Muster stehen im Themenblatt. */}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{name}</span>
                      {!r.exists && <span className="text-sm text-muted">{t('pxChTopicSoon')}</span>}
                      {phase && (
                        <span className={`text-sm ${phase === 'done' ? 'font-medium text-ok-text' : 'text-muted'}`} data-testid="chapter-topic-phase" data-phase={phase}>
                          {t(PHASE_KEY[phase])}
                        </span>
                      )}
                    </span>
                    {/* Kapitel-Modus: die Phase darunter ist der EINE Zustand (kein zweites „Neu“/„Lernt“ daneben); sonst der Zustands-Chip. */}
                    {r.exists && !phase && (
                      <span className={`inline-flex h-6 flex-none items-center rounded-full px-2.5 text-xs font-bold ${TONE_CLASS[tone]}`} data-testid="chapter-topic-chip" data-tone={tone}>
                        {t(TONE_KEY[tone])}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {flags.program && <GateSection chapter={chapter.n} />}

          <section className="flex flex-col gap-1" aria-labelledby="px-ch-exam">
            <h3 id="px-ch-exam" className="lx-eyebrow">
              {t('pxChExam')}
            </h3>
            <p className="text-sm text-muted" data-testid="chapter-exam">
              {chapter.exam.focus[lang]}
            </p>
            <p className="text-sm text-muted">{t('pxChWeeks', { n: String(chapter.weeks).replace('.', lang === 'de' ? ',' : '.') })}</p>
          </section>

          <section className="flex flex-col gap-2" aria-labelledby="px-ch-teacher">
            <h3 id="px-ch-teacher" className="lx-eyebrow">
              {t('pxChTeacher')}
            </h3>
            <p className="text-sm text-muted">{t('pxChTeacherHelp')}</p>
            <CopyBox text={chapter.note} label={t('pxChTeacher')} testId="chapter-note-copy" copiedTestId="chapter-note-copied" />
          </section>
        </div>
      )}
    </Sheet>
  );
}
