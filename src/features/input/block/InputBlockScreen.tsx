import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNav } from '../../../app/nav';
import { useSettings } from '../../../app/settings';
import type { ScreenProps } from '../../../app/registry';
import { unitDone } from '../../../app/unit/done';
import { usePlayerSkip } from '../../../app/shell/Player';
import { useLive } from '../../../data/live';
import { ladderFor } from '../../../domain/input/ladder';
import { summaryReady } from '../../../domain/input/unitInput';
import { wordCount } from '../../../domain/input/textStats';
import type { ChoiceResult } from '../../../domain/input/types';
import { EnglishText } from '../../../engine/EnglishText';
import { useT } from '../../../i18n';
import { stopSpeech, useSpeech } from '../../../platform/speech';
import { Button } from '../../../ui/Button';
import { Skeleton } from '../../../ui/Skeleton';
import { toast } from '../../../ui/Toast';
import { loadFeedOnce, useFeed } from '../../discover/feedStore';
import { TempoPlayer } from '../../listen/TempoPlayer';
import { ReaderText } from '../../read/ReaderText';
import { useActiveClock } from '../activeClock';
import { ChunkList } from '../ChunkList';
import { completeListening, completeReading, saveReadingSummary } from '../complete';
import { listenRows } from '../derive';
import { clearDraft, loadDraft } from '../draft';
import { DraftArea } from '../DraftArea';
import { ensureLibrary, useInputLibrary } from '../library';
import { QuestionCard } from '../QuestionCard';
import { StatusLine } from '../StatusLine';
import { UnitShell } from '../UnitShell';
import { blockRoutes } from '../resume';
import { freshRun, patchRun, runKey, useBlockRun, type BlockStep } from './run';
import { sourceFromRef, type BlockSource } from './source';

// Block 2 der Tageseinheit (Neubau N53; Prüfung M7, M9, S1): Text lesen oder Hörtext mit
// Tempo-Leiter → Kernfrage + Frage „zwischen den Zeilen“, je mit Belegstelle und Grund (auch bei
// richtig) → (ohne KI am Dienstag) Zusammenfassung in 3 Sätzen → 2–3 Wendungen mitnehmen → fertig.
// Die Antworten gehen beim Abschluss der Fragen in die db (Lesen/Hören wie bisher), der Block
// meldet sich mit `unitDone(2)`. Ohne KI vollständig erfüllbar (Themen-Text aus P7a).

export function InputBlockScreen({ route }: ScreenProps<'inputUnit'>) {
  const { t, lang } = useT();
  const back = useNav((s) => s.back);
  const libStatus = useInputLibrary((s) => s.status);
  const lpool = useInputLibrary((s) => s.docs.lpool);
  const articles = useInputLibrary((s) => s.docs.articles);
  const feedDocs = useFeed((s) => s.docs);
  const needsLib = !route.ref.startsWith('theme:');

  useEffect(() => {
    if (!needsLib) return;
    void ensureLibrary();
    if (route.ref.startsWith('feed:')) void loadFeedOnce();
  }, [needsLib, route.ref]);

  // Quelle aus der Route (nach dem Neuladen dieselbe); Bibliothek und Feed werden bei Bedarf nachgeladen.
  const src = useMemo(() => sourceFromRef(route.ref, lang), [route.ref, lang, lpool, articles, feedDocs]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!src) {
    const loading = needsLib && (libStatus === 'idle' || libStatus === 'loading');
    if (loading) {
      return (
        <div className="flex flex-col gap-4 py-8" role="status" aria-label={t('inSkeleton')} data-testid="unit-skeleton">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full max-w-xl" />
        </div>
      );
    }
    return (
      <UnitShell kind={route.kind} ctx="duty" state="missing" title={t(route.kind === 'listen' ? 'nbLesenBlockListen' : 'nbLesenBlockRead')} onClose={back}>
        <div className="flex flex-col items-start gap-3" role="alert">
          <p className="text-sm text-muted">{t('nbLesenSourceMissing')}</p>
          <Button onClick={back}>{t('nbLesenBackToday')}</Button>
        </div>
      </UnitShell>
    );
  }
  blockRoutes.set(runKey(route.day, route.ref), route);
  return <BlockUnit key={`${route.day}|${route.ref}`} src={src} day={route.day} kind={route.kind} summary={route.summary === true} />;
}

function BlockUnit({ src, day, kind, summary }: { src: BlockSource; day: string; kind: 'read' | 'listen'; summary: boolean }) {
  const { t } = useT();
  const back = useNav((s) => s.back);
  const clock = useActiveClock();
  const speech = useSpeech((s) => s.status);
  const profile = useLive((s) => s.docs['app/profile']);
  const key = runKey(day, src.ref);
  const run = useBlockRun((s) => (s.run && s.run.key === key ? s.run : null));
  const [showText, setShowText] = useState(false);
  const [sum, setSum] = useState(() => loadDraft(`unit:${key}`));
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const ladder = useMemo(() => ladderFor(listenRows(profile)), [profile]);

  // Neuer Lauf, wenn keiner zu dieser Route gehört (erster Start oder Fortsetzen ohne Momentaufnahme).
  useEffect(() => {
    if (!useBlockRun.getState().run || useBlockRun.getState().run?.key !== key) useBlockRun.setState({ run: freshRun(key, src.title) });
  }, [key, src.title]);
  useEffect(() => () => stopSpeech(), []);

  const step: BlockStep = run?.step ?? 'input';
  const results = run?.results ?? [];
  const qi = run?.qi ?? 0;
  const passes = run?.passes ?? 0;
  const setStep = (s: BlockStep) => patchRun(key, { step: s });
  const listen = kind === 'listen' && speech !== 'unsupported' && speech !== 'novoice';
  const nQ = src.questions.length;

  /** Abschluss der Fragen (einmal): Lesen → `reading/r<t>`, Hören → Profil; Log wie bisher. */
  const complete = async (list: readonly ChoiceResult[]): Promise<boolean> => {
    const cur = useBlockRun.getState().run;
    if (cur?.key === key && cur.saved) return true;
    if (saving.current) return false;
    saving.current = true;
    try {
      const uiLang = useSettings.getState().lang;
      if (listen && !summary) {
        const ok = await completeListening({ day, item: { id: src.item.id, ref: src.item.ref, level: src.level, domain: src.domain }, questions: src.questions, results: list, plays: Math.max(1, passes), rate: ladder.first, help: false, activeMs: clock.ms(), lang: uiLang, ctx: 'duty' });
        if (!ok) throw new Error('listen:complete');
        patchRun(key, { saved: true });
      } else {
        const id = await completeReading({ day, item: src.item, questions: src.questions, results: list, activeMs: clock.ms(), lang: uiLang, ctx: 'duty' });
        patchRun(key, { saved: true, readingId: id });
      }
      return true;
    } catch {
      toast(t('inSaveFailed'), 'error');
      return false;
    } finally {
      saving.current = false;
    }
  };

  const afterQuestions = async (list: readonly ChoiceResult[]) => {
    if (summary) {
      setStep('summary');
      return;
    }
    if (await complete(list)) setStep('notice');
  };

  const saveSummary = async () => {
    setBusy(true);
    try {
      if (!(await complete(results))) return;
      const id = useBlockRun.getState().run?.readingId;
      if (id) await saveReadingSummary(id, sum.trim(), wordCount(sum), null);
      clearDraft(`unit:${key}`);
      patchRun(key, { step: 'notice' });
    } catch {
      toast(t('inSaveFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    stopSpeech();
    patchRun(key, { step: 'done' });
    unitDone(2);
    // Ohne angemeldeten Ablauf (P1) zurück zur Herkunft statt stehen zu bleiben.
    queueMicrotask(() => {
      if (useNav.getState().route.name === 'inputUnit') back();
    });
  };

  const close = () => {
    stopSpeech();
    back();
  };

  // „Diese Aufgabe überspringen“ (Fehlergrenze): ohne Bewertung zum nächsten Schritt.
  usePlayerSkip(() => {
    const cur = useBlockRun.getState().run;
    const s = cur?.key === key ? cur.step : 'input';
    if (s === 'input') patchRun(key, { step: nQ ? 'q' : 'notice' });
    else if (s === 'q') {
      if ((cur?.qi ?? 0) + 1 < nQ) patchRun(key, { qi: (cur?.qi ?? 0) + 1 });
      else void afterQuestions(cur?.results ?? []);
    } else if (s === 'summary') patchRun(key, { step: 'notice' });
    else finish();
  });

  const status = <StatusLine channel={kind === 'listen' ? 'listen' : 'read'} level={src.level} domain={src.domain} minutes={5} />;
  const title = t(kind === 'listen' ? 'nbLesenBlockListen' : 'nbLesenBlockRead');
  let task: string | undefined = t(listen ? (summary ? 'nbLesenBlockTaskSummary' : 'nbLesenBlockTaskListen') : 'nbLesenBlockTaskRead');
  let body: ReactNode;
  let aside: ReactNode = null;

  if (step === 'input') {
    body = (
      <div className="flex flex-col gap-5" data-testid="block-input">
        <h2 className="text-2xl font-semibold tracking-tight" lang="en">
          {src.title}
        </h2>
        {listen ? (
          <>
            <TempoPlayer text={src.text} ladder={ladder} passes={passes} onPass={(n) => patchRun(key, { passes: n })} pos={run?.pos ?? 0} onPos={(i) => patchRun(key, { pos: i })} />
            <p className="text-sm text-muted" data-testid="listen-hint">
              {passes > 0 ? t('nbLesenHeardOnce') : t('nbLesenListenFirst')}
            </p>
            {showText && <ReaderText text={src.text} title={src.title} sourceRef={src.cardRef} area="listen" practice={false} />}
          </>
        ) : (
          <ReaderText text={src.text} title={src.title} sourceRef={src.cardRef} area="read" practice={false} />
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => setStep(nQ ? 'q' : summary ? 'summary' : 'notice')} data-testid="block-to-questions">
            {t('nbLesenToQuestions')}
          </Button>
          {listen && !showText && (
            <Button variant="ghost" onClick={() => setShowText(true)} data-testid="block-show-text">
              {t('nbLesenShowText')}
            </Button>
          )}
        </div>
      </div>
    );
  } else if (step === 'q') {
    task = t('inTaskChoose');
    const q = src.questions[qi];
    body = (
      <h2 className="text-xl font-semibold tracking-tight" lang="en">
        {src.title}
      </h2>
    );
    aside = q ? (
      <QuestionCard
        key={q.key}
        question={q}
        index={qi}
        total={nQ}
        source={src.text}
        area={kind === 'listen' ? 'listen' : 'read'}
        sourceRef={src.cardRef}
        sourceTitle={src.title}
        speakable={listen}
        onAnswered={(r) => patchRun(key, { results: [...results.filter((x) => x.key !== r.key), r] })}
        onNext={() => {
          const list = useBlockRun.getState().run?.results ?? results;
          if (qi + 1 < nQ) patchRun(key, { qi: qi + 1 });
          else void afterQuestions(list);
        }}
        nextLabel={qi + 1 < nQ ? t('inNext') : t('inFinish')}
      />
    ) : null;
  } else if (step === 'summary') {
    task = t('nbLesenSummaryTask');
    const core = src.questions[0];
    const ready = summaryReady(sum);
    body = (
      <section className="flex max-w-[68ch] flex-col gap-3" data-testid="block-summary">
        <p className="text-xs text-subtle">{t('nbLesenSummaryHint')}</p>
        <DraftArea value={sum} onChange={setSum} label={t('nbLesenSummaryLabel')} draftKey={`unit:${key}`} rows={5} testId="block-summary-draft" />
        {!ready && sum.trim() && <p className="text-xs text-muted">{t('nbLesenSummaryShort')}</p>}
        <div>
          <Button variant="primary" disabled={!ready} busy={busy} onClick={() => void saveSummary()} data-testid="block-summary-save">
            {t('nbLesenSummarySave')}
          </Button>
        </div>
        {core && (
          <details className="text-sm text-muted">
            <summary className="cursor-pointer">{t('nbLesenSummaryCompare')}</summary>
            <p className="mt-2" lang="en">
              {core.options[core.answer]}
            </p>
          </details>
        )}
      </section>
    );
  } else if (step === 'notice') {
    task = t('nbLesenNoticeTask');
    body = (
      <section className="flex max-w-[68ch] flex-col gap-4" data-testid="block-notice">
        <p className="lx-eyebrow">{t('nbLesenNoticeTitle')}</p>
        <ChunkList rows={src.notice} sourceText={src.text} area={kind === 'listen' ? 'listen' : 'read'} sourceRef={src.cardRef} title={src.title} saveAll testId="notice-row" />
        <div className="lx-glass flex flex-col gap-1 rounded-[var(--radius-card)] p-5" data-testid="unit-done" data-state="done">
          <p className="lx-eyebrow text-accent-text">{t('nbLesenBlockDone')}</p>
          {nQ > 0 && <p className="lx-tnum text-sm text-muted">{t('rdQuiz', { ok: results.filter((r) => r.correct).length, n: results.length })}</p>}
          {speech === 'ready' && src.shadow.length > 0 && <p className="text-sm text-muted">{t('nbLesenShadowNext')}</p>}
        </div>
        <div>
          <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={finish} data-testid="block-next">
            {t('nbLesenBlockNext')}
          </Button>
        </div>
      </section>
    );
  } else {
    task = undefined;
    body = (
      <div className="flex flex-col items-start gap-3" data-testid="block-finished">
        <p className="lx-eyebrow text-accent-text">{t('nbLesenBlockDone')}</p>
        <EnglishText text={src.title} area="read" source={src.cardRef} title={src.title} as="p" className="text-lg font-semibold" />
        <Button onClick={close}>{t('nbLesenBackToday')}</Button>
      </div>
    );
  }

  return (
    <UnitShell kind={kind} ctx="duty" state={step} title={title} seeDetail={src.title} onClose={close} status={status} task={task} purpose={t('nbLesenBlockPurpose')} aside={aside}>
      <div data-testid="input-block" data-step={step} data-ref={src.ref} data-kind={kind} data-summary={summary || undefined}>
        {body}
      </div>
    </UnitShell>
  );
}
