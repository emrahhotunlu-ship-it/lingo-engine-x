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

// Kapitelblatt (Lernplattform 3.0 P32): ein Kapitel des C1-Programms mit Ziel („Abgeschlossen heißt …“), den Themen mit Ring „Muster sicher a/b“,
// der Prüfungsfokus und der Satz für den Lehrer. Alle Zahlen kommen aus `chapterState` (eine Quelle); das Blatt rechnet nichts selbst.

type TopicTone = 'new' | 'learning' | 'safe';

/** Zustand eines Themas für die Anzeige, nur aus dem Fortschritt abgeleitet. */
export function topicTone(t: TopicProgress): TopicTone {
  if (t.safe) return 'safe';
  return t.introduced ? 'learning' : 'new';
}

export const TONE_KEY: Record<TopicTone, MessageKey> = { new: 'nbLernenStateNew', learning: 'nbLernenStateLearning', safe: 'nbLernenStateSafe' };
const TONE_CLASS: Record<TopicTone, string> = { new: 'bg-surface-strong text-fg', learning: 'bg-hint-soft text-hint-text', safe: 'bg-ok-soft text-ok-text' };

export function ChapterSheet({ open, chapter, progress, onClose }: { open: boolean; chapter: ProgramChapter | null; progress: ChapterProgress | null; onClose: () => void }) {
  const { t, lang } = useT();
  // Kapitelstart (P61): der Struktur-Film des ersten Themas mit Film, ein Startknopf, der Film klappt hier im Blatt auf.
  const film = progress && filmEnabled() ? filmForTopics(progress.topics.filter((r) => r.exists).map((r) => r.id)) : null;
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
              <p className="lx-tnum text-sm text-muted" data-testid="chapter-sheet-pats" data-safe={progress.topicSafe} data-total={progress.liveTopics}>
                {t('hxPathSafe', { a: progress.topicSafe, b: progress.liveTopics })}
              </p>
            ) : (
              <p className="text-sm text-muted" data-testid="chapter-sheet-soon">
                {t('pxMapSoon')}
              </p>
            )}
          </section>

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
                const tone = topicTone(r);
                return (
                  <li
                    key={r.id}
                    data-testid="chapter-topic"
                    data-topic={r.id}
                    data-exists={r.exists ? 'true' : 'false'}
                    className="bg-surface-solid flex min-h-14 items-center gap-3 rounded-[0.875rem] border border-line px-3.5 py-2"
                  >
                    <span className="flex-none">
                      <ProgressRing value={r.patTotal > 0 ? r.patSafe / r.patTotal : 0} size={32} stroke={4} label={t('pxChTopicAria', { name, a: r.patSafe, b: r.patTotal })} />
                    </span>
                    {/* UX-Prüfung B2: eine Maßeinheit – je Thema nur der Zustand (Neu · Lernt · Sicher); die Muster stehen im Themenblatt. */}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{name}</span>
                      {!r.exists && <span className="text-sm text-muted">{t('pxChTopicSoon')}</span>}
                    </span>
                    {r.exists && <span className={`inline-flex h-6 flex-none items-center rounded-full px-2.5 text-xs font-bold ${TONE_CLASS[tone]}`}>{t(TONE_KEY[tone])}</span>}
                  </li>
                );
              })}
            </ul>
          </section>

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
