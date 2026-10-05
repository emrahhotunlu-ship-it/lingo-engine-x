import { ActionBar, PrimaryAction } from '../../ui/ActionBar';
import { usePlayerSkip } from '../../app/shell/Player';
import { useRef, useState } from 'react';
import type { ScreenProps } from '../../app/registry';
import { useSettings } from '../../app/settings';
import { transforms } from '../../content/nb/load';
import type { Colloc } from '../../content/nb/schemas';
import { motorFilled, motorStart, type MotorItem, type MotorSet } from '../../domain/nbdrill/motor';
import { calqueVerb, collocDone, collocNeed, collocVerdict, type CollocStep } from '../../domain/nbdrill/colloc';
import { EnglishText } from '../../engine/EnglishText';
import { useHiddenInput } from '../../engine/HiddenInput';
import { KineticGap, type GapState as KGapState } from '../../engine/KineticGap';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { FeedbackPanel } from '../../ui/FeedbackPanel';
import type { Feedback, Fix } from '../../ui/feedback/types';
import { SessionEnd } from '../../ui/SessionEnd';
import { collocOf, collocSubmit, drillMs, drillRight, endDrill, ensureDrill, gapSubmit, giveUp, nextItem, skipItem, motorOf, useDrill, type DrillSession } from './session';
import { finishUnit, Note, StepBoundary, TaskHead, TrainingBar } from './shared';

// Tipp-Drill-Motor (Plan N101/N102): Kollokationen tippen und Satz-Umformung mit Schlüsselwort.
// Nur tippen, nie auswählen. Getippt wird direkt in die Lücke (Kap. 4.1). Lokal geprüft,
// britische Formen sind richtig (A7.3). Erst Hinweis, dann zweiter Versuch, dann Lösung mit Grund
// – der Grund steht auch bei richtiger Antwort (Kap. 2.4, Prüfbefund M9).

export function NbDrillScreen({ route }: ScreenProps<'nbdrill'>) {
  const { t } = useT();
  // Sitzung SYNCHRON vor dem ersten Zeichnen sicherstellen (Deep-Link, Neuladen ohne Player).
  useState(() => ensureDrill(route, useSettings.getState().lang));
  const s = useDrill((x) => x.s);
  usePlayerSkip(skipItem);

  if (!s || s.set !== route.set) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4" data-testid="nbdrill" data-state="empty">
        <TrainingBar route={route} unit={null} progress={null} />
        <p className="text-sm text-muted">{t('nbTrainingEmpty')}</p>
      </div>
    );
  }
  if (s.done) return <DrillEnd s={s} route={route} />;
  const c = collocOf(s);
  const mo = motorOf(s);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-8" data-testid="nbdrill" data-set={s.set} data-pos={s.pos} data-state="open">
      <TrainingBar route={route} unit={s.unit} progress={{ n: s.pos + 1, total: s.ids.length }} />
      <StepBoundary resetKey={`${s.set}-${s.pos}`} scope="nbdrill" onSkip={skipItem}>
        {c && <CollocItem key={c.id} s={s} c={c} />}
        {mo && <MotorItemView key={mo.id} s={s} m={mo} />}
      </StepBoundary>
    </div>
  );
}

// ------------------------------------------------------------------ Kollokationen

function CollocItem({ s, c }: { s: DrillSession; c: Colloc }) {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const st = s.colloc;
  const typed = useRef('');
  const [shownAt] = useState(() => ({ current: performance.now() }));
  const [attempt, setAttempt] = useState(0);
  const [step, setStep] = useState<CollocStep | null>(null);
  if (!st) return null;
  const done = collocDone(c, st);
  const need = collocNeed(c);

  const check = () => {
    if (done) return;
    const given = typed.current.trim();
    if (!given) return;
    const r = collocSubmit(given, performance.now() - shownAt.current);
    setStep(r);
    typed.current = '';
    setAttempt((n) => n + 1);
    const after = useDrill.getState().s?.colloc;
    if (after && collocDone(c, after)) api.blur();
    else api.focusNow();
  };
  const dontKnow = () => {
    giveUp(performance.now() - shownAt.current);
    setStep({ kind: 'solution' });
    api.blur();
  };

  const verdict = done ? collocVerdict(c, st) : null;
  const contrast: Fix = { kind: 'trap', mine: c.wrong.phrase, right: c.wrong.right, why: c.wrong.note[lang] };
  const fb: Feedback | null = verdict
    ? {
        verdict,
        solution: c.verbs.map((v) => v.v).join(' · ') + ` + ${c.noun}`,
        fixes: [contrast],
        why: { question: `${c.noun}: ${c.verbs.map((v) => v.v).join(', ')} – ${c.wrong.phrase} → ${c.wrong.right}` },
      }
    : null;
  const gapState: KGapState = 'input';

  return (
    <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="colloc-item" data-id={c.id} data-state={done ? (verdict ?? 'done') : 'open'}>
      <TaskHead status={`${t('nbTrainingColloc')} · ${t('nbTrainingCollocNeed', { n: need })}`} task={t('nbTrainingCollocTask')} purpose={t('nbTrainingCollocPurpose')} />
      <div className="flex flex-col items-center gap-1 py-2 text-center">
        <p lang="en" className="text-3xl font-semibold tracking-tight" data-testid="colloc-noun">
          {c.noun}
        </p>
        <p className="text-sm text-muted">{c.de}</p>
      </div>
      <ul className="flex flex-wrap justify-center gap-2" data-testid="colloc-found" data-n={st.found.length}>
        {Array.from({ length: need }, (_, i) => {
          const v = st.found[i];
          return (
            <li key={i} className={`lx-chip ${v ? '' : 'text-subtle'}`} data-found={v ? 'true' : 'false'}>
              {v ? `${v} … ${c.noun}` : '…'}
            </li>
          );
        })}
      </ul>
      {!done && (
        <>
          <p className="lx-sentence text-center" lang="en">
            <KineticGap
              key={attempt}
              label={t('nbTrainingCollocInput', { noun: c.noun })}
              maxLength={40}
              state={gapState}
              onChange={(v) => {
                typed.current = v;
              }}
              onEnter={check}
            />{' '}
            <span className="text-muted">… {c.noun}</span>
          </p>
          {step && <StepNote step={step} c={c} />}
          <div className="flex flex-wrap items-center gap-3">
            <ActionBar stateKey="check">
              <PrimaryAction onClick={check} testId="drill-check">
                {t('nbTrainingCheck')}
              </PrimaryAction>
            </ActionBar>
            <Button variant="ghost" onClick={dontKnow} data-testid="drill-dontknow">
              {t('nbTrainingDontKnow')}
            </Button>
          </div>
        </>
      )}
      {done && fb && (
        <div className="flex flex-col gap-4 border-t border-line pt-4" data-testid="drill-result">
          {step?.kind === 'solution' && st.found.length < need && <Note tone="warn" kind="solution">{t('nbTrainingCollocAll')}</Note>}
          <FeedbackPanel fb={fb} onNext={nextItem} />
          <div className="flex flex-col gap-2" data-testid="colloc-examples">
            <p className="lx-eyebrow">{t('nbTrainingCollocAll')}</p>
            {c.verbs.map((v) => (
              <div key={v.v} className="flex flex-col gap-0.5">
                <p className="text-sm">
                  <span className="font-medium" lang="en">
                    {v.v}
                  </span>{' '}
                  <span className="text-muted">· {v.de}</span>
                </p>
                <EnglishText text={v.ex} area="lesson" source={`colloc/${c.id}`} className="text-sm leading-relaxed text-muted" />
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function StepNote({ step, c }: { step: CollocStep; c: Colloc }) {
  const { t, lang } = useT();
  switch (step.kind) {
    case 'hit':
      return (
        <Note tone="ok" kind="hit" testId="drill-step">
          {t('nbTrainingCollocHit', { phrase: `${step.verb} … ${c.noun}` })}
        </Note>
      );
    case 'dup':
      return (
        <Note tone="info" kind="dup" testId="drill-step">
          {t('nbTrainingCollocDup')}
        </Note>
      );
    case 'calque':
      return (
        <Note tone="warn" kind="calque" testId="drill-step">
          <p className="font-medium">{t('nbTrainingCollocCalque', { phrase: `${calqueVerb(c)} … ${c.noun}` })}</p>
          <p className="text-muted">{c.wrong.note[lang]}</p>
          <p className="text-muted">{t('nbTrainingTryAgain')}</p>
        </Note>
      );
    case 'hint':
      return (
        <Note tone="warn" kind="hint" testId="drill-step">
          {t('nbTrainingCollocHint', { first: step.first })}
        </Note>
      );
    default:
      return null;
  }
}

// ------------------------------------------------------------------ Motor-Sätze (Umformung, Wortbildung, Register, Phrasal Verbs, Überleitungen)

const MOTOR_TEXT: Record<MotorSet, { name: MessageKey; task: MessageKey; purpose: MessageKey }> = {
  transform: { name: 'nbTrainingTransform', task: 'nbTrainingTransformTask', purpose: 'nbTrainingTransformPurpose' },
  wordform: { name: 'nbTrainingWordform', task: 'nbTrainingWordformTask', purpose: 'nbTrainingWordformPurpose' },
  register: { name: 'nbTrainingRegister', task: 'nbTrainingRegisterTask', purpose: 'nbTrainingRegisterPurpose' },
  phrasal: { name: 'nbTrainingPhrasal', task: 'nbTrainingPhrasalTask', purpose: 'nbTrainingPhrasalPurpose' },
  transition: { name: 'nbTrainingTransition', task: 'nbTrainingTransitionTask', purpose: 'nbTrainingTransitionPurpose' },
};

function MotorItemView({ s, m }: { s: DrillSession; m: MotorItem }) {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const g = s.gap;
  const typed = useRef('');
  const [draft, setDraft] = useState('');
  const [shownAt] = useState(() => ({ current: performance.now() }));
  if (!g) return null;
  const full = !m.gap;
  const tr = m.set === 'transform' ? (transforms().find((x) => x.id === m.id) ?? null) : null;
  const check = () => {
    if (g.final) {
      nextItem();
      return;
    }
    const given = (full ? draft : typed.current).trim();
    if (!given) return;
    const r = gapSubmit(given, performance.now() - shownAt.current);
    typed.current = '';
    setDraft('');
    const after = useDrill.getState().s?.gap;
    if (!full) {
      if (r && after && !after.final) api.focusNow();
      else api.blur();
    }
  };
  const dontKnow = () => {
    giveUp(performance.now() - shownAt.current);
    if (!full) api.blur();
  };
  const solution = m.answers[0] ?? '';
  const hint = !g.final && g.check ? g.check.hint : null;
  const hintText =
    hint === 'keyword' ? t('nbTrainingHintKeyword', { key: m.chip }) : hint === 'length' ? t('nbTrainingHintLength') : hint === 'start' ? t('nbTrainingHintStart', { start: motorStart(m, tr) }) : null;
  const last = g.given[g.given.length - 1] ?? '';
  const right = g.check?.verdict === 'ok' ? g.check.match : solution;
  const fb: Feedback | null =
    g.final && g.check
      ? {
          verdict: g.check.verdict === 'ok' ? (g.tries === 1 ? 'ok' : 'close') : g.check.verdict === 'close' ? 'close' : 'wrong',
          ...(g.check.uk ? { effect: t('nbTrainingUkNote', { us: g.check.match }) } : {}),
          ...(last ? { mine: motorFilled(m, last) } : {}),
          solution: motorFilled(m, right),
          fixes: [{ kind: 'form', mine: g.check.verdict === 'ok' ? '' : last, right, why: m.why[lang] }],
          ...(m.answers.length > 1 ? { upgrades: m.answers.filter((a) => a !== right).map((a) => ({ to: motorFilled(m, a) })) } : {}),
          why: { question: `${m.source ?? m.gap ?? ''} → ${motorFilled(m, solution)} (${m.chip})` },
        }
      : null;
  const gapIdx = m.gap ? m.gap.indexOf('___') : -1;
  const gapNode = g.final ? (
    <span className="lx-gap font-medium" data-testid="gap" data-state="reveal" style={{ width: 'auto' }}>
      {right}
    </span>
  ) : (
    <KineticGap key={g.tries} label={t('nbTrainingTransformGap')} maxLength={60} state="input" onChange={(v) => (typed.current = v)} onEnter={check} />
  );
  const txt = MOTOR_TEXT[m.set];
  return (
    <article
      className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7"
      data-testid={`${m.set}-item`}
      data-set={m.set}
      data-id={m.id}
      data-tries={g.tries}
      data-state={g.final ? (fb?.verdict ?? 'done') : 'open'}
    >
      <TaskHead status={t(txt.name)} task={t(txt.task)} purpose={t(txt.purpose)} />
      <div className="flex flex-col gap-3">
        {m.source && (
          <p className="text-lg leading-relaxed" lang="en" data-testid="motor-source">
            {m.gap && <span className="mr-2 text-xs font-semibold text-subtle">A</span>}
            {m.source}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="lx-chip font-semibold tracking-wide" data-testid="motor-chip" lang="en">
            {m.chip}
          </span>
          {m.note && <span className="text-muted">{m.note[lang]}</span>}
        </div>
        {m.gap && (
          <div className="flex items-baseline gap-2">
            {m.source && <span className="text-xs font-semibold text-subtle">B</span>}
            <EnglishText as="p" className="lx-sentence" testId="motor-gap" text={m.gap} area="lesson" source={`${m.set}/${m.id}`} slot={gapIdx >= 0 ? { start: gapIdx, end: gapIdx + 3, node: gapNode } : null} />
          </div>
        )}
        {full && !g.final && (
          <textarea
            className="lx-field min-h-20 text-base"
            lang="en"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                check();
              }
            }}
            aria-label={t('nbTrainingMotorFull')}
            placeholder={t('nbTrainingMotorFull')}
            autoCapitalize="sentences"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-testid="motor-input"
          />
        )}
      </div>
      {!g.final && (
        <>
          {hintText && (
            <Note tone="warn" kind={hint ?? 'hint'} testId="drill-step">
              {hintText}
            </Note>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <ActionBar stateKey="check">
              <PrimaryAction onClick={check} testId="drill-check">
                {t('nbTrainingCheck')}
              </PrimaryAction>
            </ActionBar>
            <Button variant="ghost" onClick={dontKnow} data-testid="drill-dontknow">
              {t('nbTrainingDontKnow')}
            </Button>
          </div>
        </>
      )}
      {fb && (
        <div className="border-t border-line pt-4" data-testid="drill-result">
          <FeedbackPanel fb={fb} onNext={nextItem} />
        </div>
      )}
    </article>
  );
}

// ------------------------------------------------------------------ Ende

function DrillEnd({ s, route }: { s: DrillSession; route: ScreenProps<'nbdrill'>['route'] }) {
  const { t } = useT();
  const finish = () => {
    const unit = s.unit;
    endDrill();
    finishUnit(unit);
  };
  const takeaways =
    s.set === 'colloc'
      ? s.ids
          .map((id) => {
            const c = collocOf({ ...s, pos: s.ids.indexOf(id) });
            return c ? `${c.verbs[0]?.v ?? ''} … ${c.noun}` : '';
          })
          .filter(Boolean)
      : [];
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-8" data-testid="nbdrill" data-set={s.set} data-state="done">
      <TrainingBar route={route} unit={s.unit} progress={null} onClose={finish} />
      <SessionEnd
        right={drillRight(s)}
        total={s.results.length}
        ms={drillMs(s)}
        takeaways={
          takeaways.length ? (
            <ul className="flex flex-wrap gap-2" lang="en">
              {takeaways.map((x) => (
                <li key={x} className="lx-chip">
                  {x}
                </li>
              ))}
            </ul>
          ) : undefined
        }
        next={{ label: s.unit ? t('nbTrainingNext') : t('nbTrainingDone'), run: finish }}
      />
    </div>
  );
}
