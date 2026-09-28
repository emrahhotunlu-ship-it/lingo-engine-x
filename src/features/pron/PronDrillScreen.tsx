import { useState } from 'react';
import type { ScreenProps } from '../../app/registry';
import { useSettings } from '../../app/settings';
import type { NumberItem, StressItem } from '../../content/nb/schemas';
import { stressedWord } from '../../domain/nbdrill/stress';
import { SpeakButton } from '../../engine/SpeakButton';
import { useT } from '../../i18n';
import { speak } from '../../platform/speech';
import { Button } from '../../ui/Button';
import { FeedbackPanel } from '../../ui/FeedbackPanel';
import type { Feedback } from '../../ui/feedback/types';
import { SessionEnd } from '../../ui/SessionEnd';
import { finishUnit, StepBoundary, TaskHead, TrainingBar } from '../nbdrill/shared';
import { endPronDrill, ensurePronDrill, nextPron, numberOf, revealNumber, skipPron, stressOf, tapSyllable, usePronDrill, type PronDrillSession } from './drill';

// Aussprache-Minute (Soll N109): Wortbetonung und Zahlen/Daten/Beträge. Ohne KI, lokal.
// Betonung: betonte Silbe antippen → Lösung mit Grund (deutsches Lehnwort betont anders) und
// Aussprache. Zahlen: laut sagen, dann Lösung aufdecken und hören – keine Wertung.

export function PronDrillScreen({ route }: ScreenProps<'pron'>) {
  const { t } = useT();
  useState(() => ensurePronDrill(route, useSettings.getState().lang));
  const s = usePronDrill((x) => x.s);
  if (!s || s.kind !== route.kind) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4" data-testid="pron" data-state="empty">
        <TrainingBar route={route} unit={null} progress={null} />
        <p className="text-sm text-muted">{t('nbTrainingEmpty')}</p>
      </div>
    );
  }
  if (s.done) {
    const finish = () => {
      endPronDrill();
      finishUnit(null);
    };
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-8" data-testid="pron" data-kind={s.kind} data-state="done">
        <TrainingBar route={route} unit={null} progress={null} onClose={finish} />
        <SessionEnd right={s.results.filter((r) => r.ok).length} total={s.results.length} ms={s.ms ?? 0} next={{ label: t('nbTrainingDone'), run: finish }} />
      </div>
    );
  }
  const w = stressOf(s);
  const n = numberOf(s);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-8" data-testid="pron" data-kind={s.kind} data-pos={s.pos} data-state="open">
      <TrainingBar route={route} unit={null} progress={{ n: s.pos + 1, total: s.ids.length }} />
      <StepBoundary resetKey={s.pos} scope="pron" onSkip={skipPron}>
        {w && <StressStep key={w.id} s={s} w={w} />}
        {n && <NumberStep key={n.id} s={s} n={n} />}
      </StepBoundary>
    </div>
  );
}

function StressStep({ s, w }: { s: PronDrillSession; w: StressItem }) {
  const { t } = useT();
  const done = s.tapped !== null;
  const ok = done && s.tapped === w.stress;
  const tap = (i: number) => {
    if (tapSyllable(i) !== null) void speak(w.word);
  };
  const fb: Feedback | null = done
    ? {
        verdict: ok ? 'ok' : 'wrong',
        solution: stressedWord(w.syll, w.stress),
        fixes: [{ kind: 'form', mine: ok ? '' : stressedWord(w.syll, s.tapped ?? 0), right: stressedWord(w.syll, w.stress), why: t('nbTrainingStressWhy', { de: w.de }) }],
      }
    : null;
  return (
    <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="stress-item" data-id={w.id} data-state={done ? (ok ? 'ok' : 'wrong') : 'open'}>
      <TaskHead status={t('nbTrainingStress')} task={t('nbTrainingStressTask')} purpose={t('nbTrainingStressPurpose')} />
      <p className="text-center text-sm text-muted">{w.de}</p>
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label={w.word} lang="en">
        {w.syll.map((sy, i) => (
          <button
            key={i}
            type="button"
            disabled={done}
            onClick={() => tap(i)}
            className={`min-h-12 min-w-12 rounded-xl border px-4 text-2xl font-semibold transition-colors ${done && i === w.stress ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-surface-strong'}`}
            data-testid={`syll-${i}`}
          >
            {sy}
          </button>
        ))}
      </div>
      {fb && (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <div className="flex items-center gap-2">
            <SpeakButton text={w.word} testId="stress-speak" />
          </div>
          <FeedbackPanel fb={fb} onNext={nextPron} />
        </div>
      )}
    </article>
  );
}

function NumberStep({ s, n }: { s: PronDrillSession; n: NumberItem }) {
  const { t, lang } = useT();
  const shown = s.tapped !== null;
  const reveal = () => {
    revealNumber();
    void speak(n.say[0] ?? '');
  };
  const fb: Feedback | null = shown ? { verdict: 'unchecked', solution: n.say[0] ?? '', fixes: [{ kind: 'form', mine: '', right: n.say.join(' / '), why: n.note[lang] }] } : null;
  return (
    <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="number-item" data-id={n.id} data-state={shown ? 'shown' : 'open'}>
      <TaskHead status={t('nbTrainingNumbers')} task={t('nbTrainingNumbersTask')} purpose={t('nbTrainingNumbersPurpose')} />
      <p className="lx-tnum py-4 text-center text-4xl font-semibold tracking-tight" data-testid="number-show">
        {n.show}
      </p>
      {!shown ? (
        <div>
          <Button variant="primary" onClick={reveal} data-testid="number-reveal">
            {t('nbTrainingNumbersReveal')}
          </Button>
        </div>
      ) : (
        fb && (
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <SpeakButton text={n.say[0] ?? ''} testId="number-speak" />
            <FeedbackPanel fb={fb} onNext={nextPron} />
          </div>
        )
      )}
    </article>
  );
}
