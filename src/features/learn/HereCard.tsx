import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { chapterRunOn, flags } from '../../app/flags';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { programChapters } from '../../domain/c1/chapters';
import type { ChapterCursor, TopicPhase } from '../../domain/c1/cursor';
import { canIntroduce, INTRO_BLOCK_ERRORS, introTopic, isNewTopic, lernweg, pathTopics, TOPIC_ROUND_MIN } from '../../domain/grammar/path';
import { rankTopics } from '../../domain/grammar/tasks';
import { grammarErrorsDue } from '../../domain/metrics';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT, type MessageKey } from '../../i18n';
import { VButton, VCard } from '../../ui/v';
import { chapterBtnKey, cursorPrep, startChapter, useChapterNow } from '../c1/chapterRun';
import { startGrammar } from '../grammar/session';
import { topicName } from '../grammar/topicUi';
import { useToday } from '../today/state';
import { useFix } from './fix';
import { grammarModuleOn } from '../../modules/grammar/api';

// „Du bist hier“ (Relaunch Teil 1c, D5 V-GRAMMATIK; Vorschau `hereCard` screens.js:445–450): Kleinüberschrift, Thema groß (20/26), eine Zeile,
// der Lernweg als geteilter Balken und EIN Hauptknopf. Ersetzt die Weiter-Karte des Reiters und den Kopf der C1-Reise (eine rote Linie, Kap. 2 Nr. 1).
// Zahlen: Phase und Knopf aus dem Kapitel-Cursor (`useChapterNow`, dieselbe Quelle wie das Kapitel-Detail und Heute); der Balken zeigt die echten
// fünf Lernweg-Punkte des Themas (`lernweg`, Punkte des Themenblatts) – die Vorschau zeigt „Schritt 3 von 7“, den Ablauf 0–7 gibt es erst mit F2.
// Ohne Kapitel-Arbeit (Schalter aus) gilt die bisherige Auswahl: das neue Thema des Tages oder das schwächste begonnene, mit Fehlersatz-Bremse.

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();
const K_LINE: Record<TopicPhase, MessageKey> = { intro: 'pxKNextIntro', practice: 'pxKNextPractice', test: 'pxKNextTest', done: 'pxKNextDone' };

/** Lernweg-Balken (Vorschau `.bar`, 6 px, 4 px Abstand): ein Abschnitt je Lernweg-Punkt, erreichte gefüllt. */
function Steps({ topic }: { topic: string | null }) {
  const { t } = useT();
  const now = useClock((s) => s.now);
  const docs = useLive((s) => s.collections.grammar) ?? EMPTY;
  if (!topic) return null;
  const done = lernweg(topic, docs.get(topic), now).done;
  const n = done.filter(Boolean).length;
  return (
    <div className="lx-vg-bar" data-testid="here-steps" data-n={n} data-total={done.length}>
      <span className="sr-only">{t('vgHereSteps', { n, total: done.length })}</span>
      {done.map((d, i) => (
        <i key={i} data-d={d ? '' : undefined} aria-hidden="true" />
      ))}
    </div>
  );
}

export function HereCard() {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const docs = useLive((s) => s.collections.grammar) ?? EMPTY;
  const fix = useFix();
  // Großpaket G5 (M12): mit der neuen Grammatik beginnt der Reiter nicht mit „Test starten“; derselbe Schritt heißt „Thema abschließen“.
  const gmod = useLive((s) => grammarModuleOn(s.docs['app/profile']));

  // Kapitel-Arbeit (K5): „Du bist hier“ und der Knopf kommen aus EINEM Cursor (Einführung, Übung oder Themen-Test).
  const chapterNowRes = useChapterNow();
  const cursor: ChapterCursor | null = chapterRunOn() && flags.program ? chapterNowRes.cursor : null;
  const prep = useMemo(() => cursorPrep(cursor, docs), [cursor, docs]);

  // Ohne Kapitel: das eine neue Thema des Tages (eingefroren im Plan `u.gt`, nie neu berechnet), sonst das schwächste begonnene Thema.
  const planGt = useToday((s) => s.plan?.u?.gt);
  const next = useMemo(() => {
    const intro = planGt ? planGt.intro : introTopic(docs, today, now);
    if (intro) return { id: intro, fresh: true };
    const ranked = rankTopics({ grammarDocs: docs, nowMs: now, seed: today, introduce: null });
    const id = ranked[0]?.topic ?? pathTopics()[0];
    return id ? { id, fresh: isNewTopic(docs.get(id)) } : null;
  }, [docs, now, today, planGt]);
  const braked = useMemo(() => canIntroduce(docs, today, now), [docs, today, now]);
  const nBrake = braked.ok ? 0 : braked.reason === 'errors' ? grammarErrorsDue({ grammarDocs: docs, nowMs: now, today }) : 0;
  const brakeActive = !braked.ok && braked.reason === 'errors' && fix.nDue > 0;

  const startNext = () => {
    if (!next) return;
    const first = startGrammar({ mode: 'topic', topic: next.id });
    // Ein neues Thema beginnt mit der Mini-Lektion, dort gibt es noch keine Tastatur.
    if (first === 'typed' && !next.fresh) api.focusNow();
    go({ name: 'grammarSession', mode: 'topic', topic: next.id });
  };

  if (cursor) {
    const chs = programChapters();
    const title = cursor.topic ? topicName(cursor.topic, lang) : (chs[cursor.chapter]?.name[lang] ?? '');
    const canGo = cursor.phase !== 'done' || cursor.chapter + 1 < chs.length;
    return (
      <VCard raised className="lx-vg-here" aria-labelledby="vg-here-t" data-testid="hub-next-topic" data-topic={cursor.topic ?? ''} data-chapter={cursor.n} data-phase={cursor.phase}>
        <p className="lx-vg-lbl">{t('vgHereChapter', { n: cursor.n })}</p>
        <h2 id="vg-here-t" className="lx-vg-h2 lx-v-disp">
          {title}
        </h2>
        <p className="lx-vg-p2" data-testid="hub-next-line">
          {prep ? t('pxKTestPrep') : t(cursor.phase === 'test' && cursor.retry ? 'pxKNextRetry' : K_LINE[cursor.phase], { n: cursor.phase === 'intro' ? TOPIC_ROUND_MIN + 1 : TOPIC_ROUND_MIN })}
        </p>
        <Steps topic={cursor.topic} />
        {canGo && (
          <VButton variant="pri" full className="lx-vg-go" onClick={() => startChapter(cursor.phase === 'done' ? cursor.chapter + 1 : cursor.chapter, api)} data-testid="hub-next-start" data-action={cursor.phase} data-prep={prep ? 'true' : undefined}>
            {gmod && cursor.phase === 'test' && !prep ? t('gmBtnTest') : t(chapterBtnKey(cursor, prep))}
          </VButton>
        )}
      </VCard>
    );
  }

  if (!next) return null;
  return (
    <VCard raised className="lx-vg-here" aria-labelledby="vg-here-t" data-testid="hub-next-topic" data-topic={next.id}>
      <p className="lx-vg-lbl">{t('nbLernenNextEyebrow')}</p>
      <h2 id="vg-here-t" className="lx-vg-h2 lx-v-disp">
        {topicName(next.id, lang)}
      </h2>
      <p className="lx-vg-p2" data-testid="hub-next-line">
        {next.fresh ? t('nbLernenNextNew', { n: TOPIC_ROUND_MIN + 1 }) : t('nbLernenNextMin', { n: TOPIC_ROUND_MIN })}
      </p>
      <Steps topic={next.id} />
      {brakeActive ? (
        <>
          <VButton variant="pri" full className="lx-vg-go" onClick={() => fix.start(api)} data-testid="hub-next-start" data-action="fix" data-n={fix.nToday}>
            {t('hxLearnFixBtn', { n: fix.nToday })}
          </VButton>
          <p className="lx-vg-p2" data-testid="hub-intro-brake">
            {t('hxLearnBrake', { limit: INTRO_BLOCK_ERRORS, n: nBrake })}
          </p>
          <button type="button" onClick={startNext} className="lx-vg-link" data-testid="hub-next-anyway">
            {t('hxLearnAnyway', { topic: topicName(next.id, lang) })}
          </button>
        </>
      ) : (
        <VButton variant="pri" full className="lx-vg-go" onClick={startNext} data-testid="hub-next-start" data-action="topic">
          {next.fresh ? t('hxLearnStartNew') : t('nbLernenNextStart')}
        </VButton>
      )}
    </VCard>
  );
}
