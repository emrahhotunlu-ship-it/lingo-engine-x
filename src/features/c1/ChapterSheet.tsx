import { pendingName } from '../../domain/c1/chapters';
import type { ProgramChapter } from '../../domain/c1/programTypes';
import type { ChapterProgress, TopicProgress } from '../../domain/c1/state';
import { useT, type MessageKey } from '../../i18n';
import { CopyBox } from '../../ui/CopyBox';
import { Sheet } from '../../ui/Sheet';
import { Icon } from '../../ui/Icon';
import { VButton, VRow } from '../../ui/v';
import { topicName } from '../grammar/topicUi';
import { TopicSheet } from '../grammar/GrammarScreen';
import { filmForTopics } from '../../domain/c1/anim';
import { FilmLauncher, filmEnabled } from './film/FilmLauncher';
import { GateSection } from './gate/GateCard';
import { chapterRunOn, flags } from '../../app/flags';
import { useMemo, useState } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { chapterPhases, type TopicPhase } from '../../domain/c1/cursor';
import { errorsDueByTopic } from '../../domain/metrics';
import { useHiddenInput } from '../../engine/HiddenInput';
import { chapterBtnKey, cursorPrep, startChapter, useChapterNow } from './chapterRun';
import { useFix } from '../learn/fix';

const PHASE_KEY: Record<TopicPhase, MessageKey> = { intro: 'pxKPhaseIntro', practice: 'pxKPhasePractice', test: 'pxKPhaseTest', done: 'pxKPhaseDone' };
const EMPTY = new Map<string, Record<string, unknown>>();

// Kapitel-Detail (Relaunch Teil 1c, D5 V-GRAMMATIK; Vorschau `chapterDetail` screens.js:451–467, H6 `chapter`, L4 Kontextspalte).
// EIN Inhalt an drei Orten: als eigene Seite am Handy (`view="page"`, Route `chapter`), in der Kontextspalte am Laptop (`column`) und als Blatt
// über der C1-Reise (`sheet`, Programmkarte P32). Aufbau wie die Vorschau: Kapitel-Kopf, Themenkarte mit Zustandszeichen, Zeilen „Deine Fehler“
// und „Lehrerin“, dann „Abgeschlossen heißt“. Dazu alle bisherigen Teile des Kapitelblatts (P32/K5/P42/P61): Kapitel starten/weiterarbeiten,
// Struktur-Film, Abschlussprüfung, Prüfungsfokus mit Wochen-Schätzung, Satz für den Lehrer – und neu der Weg zur C1-Reise und zu jedem Thema.
// Alle Zahlen kommen aus `chapterState`/`chapterPhases` (eine Quelle); das Detail rechnet nichts selbst und speichert nichts.

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

export type ChapterView = 'page' | 'column' | 'sheet';

/** Kleinüberschrift des Kapitels (Vorschau „Kapitel 1 · jetzt Woche 2“): Nummer und Zustand in Worten. */
function eyebrowKey(p: ChapterProgress, later: boolean): MessageKey {
  if (p.status === 'current') return 'vgChEyeNow';
  if (p.status === 'done') return 'vgChEyeDone';
  if (!p.ready) return 'vgChEyeSoon';
  return later ? 'vgChEyeLater' : 'vgChEyeOpen';
}

/**
 * `slim` (Großpaket G8, UX M1): Kontextspalte mit neuer Grammatik – ohne Themenliste, Start-Knopf und die Zeilen Fehler/Lehrkraft/Reise, die der
 * Themen-Weg links schon zeigt (Entscheidung 4: ein Weg, Fehlersätze an einem Ort; Kap. 15). Es bleiben Film, Abschlussprüfung und Ziel.
 */
export function ChapterDetail({
  chapter,
  progress,
  view,
  later = false,
  onStarted,
  slim = false,
}: {
  chapter: ProgramChapter;
  progress: ChapterProgress;
  view: ChapterView;
  later?: boolean;
  onStarted?: () => void;
  slim?: boolean;
}) {
  const { t, tn, lang } = useT();
  const go = useNav((s) => s.go);
  const [topic, setTopic] = useState<string | null>(null);
  // Kapitelstart (P61): der Struktur-Film des ersten Themas mit Film.
  const film = filmEnabled() ? filmForTopics(progress.topics.filter((r) => r.exists).map((r) => r.id)) : null;
  // Kapitel-Arbeit (K5): Knopf „Kapitel starten/Weiterarbeiten“ und je Thema die Phase (Neu kennenlernen · Üben · Themen-Test · Geschafft).
  const run = chapterRunOn() && progress.ready;
  const api = useHiddenInput();
  const today = useClock((x) => x.today);
  const now = useClock((x) => x.now);
  const docs = useLive((x) => x.collections.grammar) ?? EMPTY;
  const phases = useMemo(() => (run ? chapterPhases({ chapter: progress, docs, today }) : null), [run, progress, docs, today]);
  // Das wirksame Kapitel („Du bist hier“): derselbe Cursor wie „Du bist hier“ im Reiter, deshalb derselbe Knopftext.
  const { cursor } = useChapterNow();
  const active = run && cursor?.n === chapter.n ? cursor : null;
  const prep = useMemo(() => cursorPrep(active, docs), [active, docs]);
  // „Deine Fehler“: fällige Fehlersätze der Themen dieses Kapitels; der Start ist derselbe wie auf der Wurzel (alle fälligen, heute begrenzt).
  const fix = useFix();
  const dueHere = useMemo(() => {
    const by = errorsDueByTopic(docs, now);
    return progress.topics.reduce((s, r) => s + (by.get(r.id) ?? 0), 0);
  }, [docs, now, progress]);
  // Ein Hauptknopf je Bildschirm (§6.6) und keine Widersprüche (Kap. 2 Nr. 2, ux-reviewer D5 M2/S3): voll nur auf der Kapitelseite des Kapitels,
  // das jetzt dran ist. Ein anderes Kapitel bekommt einen Zweitknopf (noch nicht dran: „Kapitel vorziehen“). Am Laptop trägt „Du bist hier“ den
  // Hauptknopf; für das aktuelle Kapitel steht er in der Spalte nicht noch einmal.
  const startVariant = view !== 'column' && progress.status === 'current' ? 'pri' : 'sec';
  const showStart = !(view === 'column' && active);
  // Laufendes Thema (Zeichen „läuft“): das Thema des Cursors, sonst das erste begonnene, noch nicht geschaffte.
  const curTopic = active?.topic ?? progress.topics.find((r) => r.exists && r.introduced && !(run ? r.done : r.safe))?.id ?? null;

  return (
    <div className="lx-vg-detail" data-testid="chapter-sheet" data-chapter={chapter.id} data-status={progress.status} data-view={view}>
      {view !== 'sheet' && (
        <header className="lx-vg-dhead">
          <p className="lx-vg-lbl" data-testid="chapter-eyebrow">
            {t(eyebrowKey(progress, later), { n: chapter.n })}
          </p>
          <h2 className="lx-vg-dh2 lx-v-disp">{chapter.name[lang]}</h2>
        </header>
      )}
      {later && (
        <p className="lx-vg-p2" data-testid="chapter-later">
          {t('vgChLaterNote')}
        </p>
      )}

      {!slim && (
        <ul className="lx-v-card lx-vg-topics" aria-label={t('pxChTopics')}>
          {progress.topics.map((r) => {
            const name = r.exists ? topicName(r.id, lang) : (pendingName(r.id, lang) ?? r.id);
            const tone = topicTone(r, run);
            const phase = r.exists ? phases?.get(r.id) : undefined;
            // Kapitel-Modus: „Geschafft“ (sicher oder Test bestanden) zeigt das Häkchen – dieselbe Quelle wie die Phase. Sonst „Sicher/Fest“.
            const full = run ? r.done : tone === 'safe';
            const state = full ? 'done' : r.id === curTopic ? 'run' : 'open';
            const subText = !r.exists ? t('pxChTopicSoon') : phase ? t(PHASE_KEY[phase]) : t(TONE_KEY[tone]);
            const label = phase ? t('pxKTopicAria', { name, phase: t(PHASE_KEY[phase]) }) : t('pxChTopicAria', { name, a: r.patSafe, b: r.patTotal });
            const inner = (
              <>
                <span className="lx-vg-tname">{name}</span>
                {phase ? (
                  <span className="lx-vg-tsub" data-testid="chapter-topic-phase" data-phase={phase}>
                    {subText}
                  </span>
                ) : r.exists ? (
                  <span className="lx-vg-tsub" data-testid="chapter-topic-chip" data-tone={tone}>
                    {subText}
                  </span>
                ) : (
                  <span className="lx-vg-tsub">{subText}</span>
                )}
              </>
            );
            return (
              <li key={r.id} className="lx-v-st lx-vg-topic" data-state={state} data-testid="chapter-topic" data-topic={r.id} data-exists={r.exists ? 'true' : 'false'}>
                <span className="lx-v-st-mk" data-testid="chapter-topic-ring" data-done={full ? 'true' : undefined} role="img" aria-label={label}>
                  {full && <Icon name="check" size={14} />}
                </span>
                {r.exists ? (
                  <>
                    <button type="button" className="lx-vg-tnm" onClick={() => setTopic(r.id)} aria-label={`${t('vgTopicOpen', { name })} · ${subText}`} data-testid="chapter-topic-open">
                      {inner}
                    </button>
                    {/* Vorschau H6 `chapter`: am laufenden Thema der Link „Erklärung“ (Themenblatt mit Regel, Beispielen und Fallen). */}
                    {state === 'run' && (
                      <button type="button" className="lx-vg-link lx-vg-explain" onClick={() => setTopic(r.id)} data-testid="chapter-topic-explain">
                        {t('vgExplain')}
                      </button>
                    )}
                  </>
                ) : (
                  <span className="lx-vg-tnm">{inner}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {run && !slim && (
        <section className="lx-vg-sec" aria-label={t('pxKStart')} data-testid="chapter-run">
          <p className="lx-vg-p2" data-testid="chapter-daily" data-active={active ? 'true' : 'false'}>
            {t(active ? 'pxKDaily' : 'pxKDailyIf')}
          </p>
          {showStart && (
            <VButton
              variant={startVariant}
              full
              data-testid="chapter-start"
              data-chapter={chapter.n}
              onClick={() => {
                startChapter(chapter.n - 1, api);
                onStarted?.();
              }}
            >
              {active ? t(chapterBtnKey(active, prep)) : later ? t('vgChPull') : progress.introduced > 0 ? t('pxKContinue') : t('pxKStart')}
            </VButton>
          )}
        </section>
      )}

      {!slim && (
        <div className="lx-vg-rows">
          <VRow icon="flag" title={t('vgErrors')} sub={dueHere > 0 ? tn('vgErrorsCh', dueHere) : t('vgErrorsChNone')} onClick={() => fix.start(api)} data-testid="chapter-errors" />
          <VRow icon="pen" title={t('vgTeacher')} sub={t('vgTeacherSub')} onClick={() => go({ name: 'teacherFeedback' })} data-testid="chapter-teacher" />
          {view !== 'sheet' && flags.program && <VRow icon="map" title={t('vgJourney')} sub={t('vgJourneySub')} onClick={() => go({ name: 'journey' })} data-testid="chapter-journey" />}
        </div>
      )}

      {film && (
        <section className="lx-vg-sec" aria-labelledby={`vg-film-${view}`} data-testid="chapter-film">
          <h3 id={`vg-film-${view}`} className="lx-vg-lbl">
            {t('eeFmChapterTitle')}
          </h3>
          <FilmLauncher film={film} />
        </section>
      )}

      {flags.program && <GateSection chapter={chapter.n} />}

      <section className="lx-vg-sec" aria-labelledby={`vg-goal-${view}`}>
        <h3 id={`vg-goal-${view}`} className="lx-vg-lbl">
          {t('pxChGoal')}
        </h3>
        <p className="lx-vg-p2" data-testid="chapter-goal">
          {chapter.done[lang]}
        </p>
        {progress.ready ? (
          // Im Kapitel-Modus zählt „geschafft“ wie die Liste (sicher oder Themen-Test bestanden), sonst wie bisher „sicher“.
          <p className="lx-vg-p2 lx-v-num" data-testid="chapter-sheet-pats" data-safe={run ? progress.topicDone : progress.topicSafe} data-total={progress.liveTopics}>
            {run ? t('pxKDoneCount', { a: progress.topicDone, b: progress.liveTopics }) : t('hxPathSafe', { a: progress.topicSafe, b: progress.liveTopics })}
          </p>
        ) : (
          <p className="lx-vg-p2" data-testid="chapter-sheet-soon">
            {t('pxMapSoon')}
          </p>
        )}
      </section>

      <section className="lx-vg-sec" aria-labelledby={`vg-exam-${view}`}>
        <h3 id={`vg-exam-${view}`} className="lx-vg-lbl">
          {t('pxChExam')}
        </h3>
        <p className="lx-vg-p2" data-testid="chapter-exam">
          {chapter.exam.focus[lang]}
        </p>
        <p className="lx-vg-p2">{t('pxChWeeks', { n: String(chapter.weeks).replace('.', lang === 'de' ? ',' : '.') })}</p>
      </section>

      <section className="lx-vg-sec" aria-labelledby={`vg-teacher-${view}`}>
        <h3 id={`vg-teacher-${view}`} className="lx-vg-lbl">
          {t('pxChTeacher')}
        </h3>
        <p className="lx-vg-p2">{t('pxChTeacherHelp')}</p>
        <CopyBox text={chapter.note} label={t('pxChTeacher')} testId="chapter-note-copy" copiedTestId="chapter-note-copied" />
      </section>

      <TopicSheet topic={topic} onClose={() => setTopic(null)} />
    </div>
  );
}

/** Kapitelblatt über der C1-Reise (Programmkarte P32): derselbe Inhalt als Blatt. */
export function ChapterSheet({ open, chapter, progress, onClose }: { open: boolean; chapter: ProgramChapter | null; progress: ChapterProgress | null; onClose: () => void }) {
  const { t, lang } = useT();
  return (
    <Sheet open={open} onClose={onClose} title={chapter ? t('pxChTitle', { n: chapter.n, name: chapter.name[lang] }) : ''} closeLabel={t('pxChClose')}>
      {chapter && progress && <ChapterDetail chapter={chapter} progress={progress} view="sheet" onStarted={onClose} />}
    </Sheet>
  );
}
