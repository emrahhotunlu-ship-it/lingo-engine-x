import { useLayoutEffect } from 'react';
import { useNav } from '../../../app/nav';
import { EnglishText } from '../../../engine/EnglishText';
import { useHiddenInput } from '../../../engine/HiddenInput';
import { useHotkeys } from '../../../engine/useHotkeys';
import { useT } from '../../../i18n';
import { Button } from '../../../ui/Button';
import { FeedbackPanel } from '../../../ui/FeedbackPanel';
import type { Feedback } from '../../../ui/feedback/types';
import { Icon } from '../../../ui/Icon';
import { useCompanionSee } from '../../companion/seeing';
import { ExerciseTop, TaskLine } from '../../learn/ui';
import { flush } from '../../progress/persist';
import { ensureAgain } from './resume';
import { compareAgain, leaveAgain, reportAgainDone, setAgainDraft, useAgain } from './session';

// Block 5 „Nochmal, aber besser“ (plan.md §1.5, N42, S4): Emrah schreibt seinen Text aus Block 3
// aus dem Kopf neu. Danach stehen Neufassung und bessere Fassung nebeneinander, darunter je
// Korrektur „jetzt richtig?“ mit Grund (Einheitsstil). Ohne KI: Muster bzw. Startsatz-Lösung.

export function AgainScreen() {
  const { t, tn } = useT();
  const api = useHiddenInput();
  const back = useNav((s) => s.back);
  const phase = useAgain((s) => s.phase);
  const src = useAgain((s) => s.src);
  const draft = useAgain((s) => s.draft);
  const checks = useAgain((s) => s.checks);
  const saved = useAgain((s) => s.saved);
  const block = useAgain((s) => s.block);
  useCompanionSee({ area: 'grammar', label: t('nbLernenAgainTitle'), phase: phase === 'write' ? 'question' : 'feedback' });

  const leave = () => {
    api.blur();
    leaveAgain();
    void flush();
    back();
  };
  useHotkeys({ escape: leave }, api.isInput);

  useLayoutEffect(() => {
    if (!useAgain.getState().active) ensureAgain();
  }, []);

  const finish = () => {
    if (block) reportAgainDone();
    else leave();
  };

  const empty = !src.before.trim();
  const okN = checks.filter((c) => c.ok).length;
  const fb: Feedback | null =
    phase === 'compare'
      ? {
          verdict: !checks.length ? 'unchecked' : okN === checks.length ? 'ok' : okN > 0 ? 'close' : 'wrong',
          effect: !checks.length ? t('nbLernenAgainNoChecks') : t('nbLernenAgainChecked', { ok: okN, total: checks.length }),
          // S4: je Korrektur – eingebaut (nur Grund) oder noch nicht (falsch → richtig, Grund).
          fixes: checks.map((c) => ({ kind: c.fix.kind, mine: c.ok ? c.fix.right : c.fix.mine, right: c.fix.right, why: c.fix.why || t('nbLernenFocusWhyFallback') })),
        }
      : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="unit-again" data-phase={phase} data-block={block ?? ''}>
      <ExerciseTop onClose={leave} progress={null} ctx="duty" />
      <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7">
        <header className="flex flex-col gap-2">
          <p className="inline-flex items-center gap-1 text-xs font-medium text-muted">
            <Icon name="refresh" size={14} />
            {t('nbLernenAgainTitle')}
          </p>
          <TaskLine task={empty ? t('nbLernenAgainEmptyTask') : src.olds?.length ? t('nbLernenAgainOldTask') : t('nbLernenAgainTask')} purpose={t('nbLernenAgainPurpose')} />
        </header>

        {empty ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted" data-testid="again-empty">
              {t('nbLernenAgainEmpty')}
            </p>
            <Button variant="primary" iconAfter="arrowRight" onClick={finish} data-testid="again-done">
              {block ? t('nbShNext') : t('nbLernenDone')}
            </Button>
          </div>
        ) : (
          <>
            {phase === 'write' && src.olds && src.olds.length > 0 && (
              <div className="flex flex-col gap-1" data-testid="again-olds">
                <p className="lx-eyebrow">{t('nbLernenAgainOldLead')}</p>
                <ul className="flex flex-col gap-1 text-base">
                  {src.olds.map((o) => (
                    <li key={o.id} lang="en">
                      {o.wrong}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {phase === 'write' && src.fixes.length > 0 && (
              <div className="flex flex-col gap-1" data-testid="again-remember">
                <p className="lx-eyebrow">{t('nbLernenAgainRemember')}</p>
                <ul className="flex flex-col gap-1 text-sm text-muted">
                  {src.fixes.map((f, i) => (
                    <li key={i}>{f.why || t('nbLernenFocusWhyFallback')}</li>
                  ))}
                </ul>
              </div>
            )}
            <textarea
              className="lx-field min-h-32 text-base"
              lang="en"
              rows={5}
              value={draft}
              readOnly={phase !== 'write'}
              onChange={(ev) => setAgainDraft(ev.target.value)}
              aria-label={t('nbLernenAgainInput')}
              placeholder={t('nbLernenAgainPlaceholder')}
              autoCapitalize="sentences"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              data-testid="again-input"
            />
            {phase === 'write' && (
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" disabled={!draft.trim()} onClick={compareAgain} data-testid="again-compare">
                  {t('nbLernenAgainCompare')}
                </Button>
              </div>
            )}
            {phase === 'compare' && (
              <>
                <div className="grid gap-3 sm:grid-cols-2" data-testid="again-versions">
                  <section className="flex flex-col gap-1 rounded-xl bg-surface px-3 py-2" data-testid="again-new">
                    <p className="lx-eyebrow">{t('nbLernenAgainNew')}</p>
                    <EnglishText text={draft.trim()} area="trainer" source={null} className="text-base leading-relaxed" />
                  </section>
                  <section className="flex flex-col gap-1 rounded-xl bg-surface px-3 py-2" data-testid="again-better" data-from={src.betterFrom ?? 'before'}>
                    <p className="lx-eyebrow">{src.better ? (src.betterFrom === 'trap' ? t('nbLernenAgainModel') : t('rxBetter')) : t('nbLernenAgainBefore')}</p>
                    <EnglishText text={src.better ?? src.before} area="trainer" source={null} className="text-base leading-relaxed" />
                  </section>
                </div>
                {saved > 0 && (
                  <p className="text-sm text-muted" data-testid="again-saved">
                    {tn('nbLernenAgainSaved', saved)}
                  </p>
                )}
                {fb && <FeedbackPanel fb={fb} onNext={finish} nextLabel={block ? t('nbShNext') : t('nbLernenDone')} />}
              </>
            )}
          </>
        )}
      </article>
    </div>
  );
}
