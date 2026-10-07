import { useLayoutEffect } from 'react';
import { useNav } from '../../../app/nav';
import { StepBoundary } from '../../../app/shell/Boundary';
import type { GrammarAnswer } from '../../../domain/learn/types';
import { useHiddenInput } from '../../../engine/HiddenInput';
import { useHotkeys } from '../../../engine/useHotkeys';
import { useT } from '../../../i18n';
import { Button } from '../../../ui/Button';
import { SessionEnd } from '../../../ui/SessionEnd';
import { useCompanionSee } from '../../companion/seeing';
import { GrammarItem } from '../../grammar/GrammarItem';
import { ExerciseTop } from '../../learn/ui';
import { flush } from '../../progress/persist';
import { RepairItem } from '../RepairItem';
import { recordGrammarError, recordRepair } from '../store';
import { ensureAgain } from './resume';
import { answerAgain, leaveAgain, nextAgain, reportAgainDone, useAgain } from './session';
import type { RepairCard } from '../../../domain/repair/variant';

// Schritt 4 „Fehler korrigieren“ (Lernplattform 2.0 §5.7): ein Satz je Karte, in der Reihenfolge der Schlange. Ab Box 1 mit Muster
// kommt statt des Originals eine ungesehene Aufgabe zum selben Muster (`GrammarItem`); gebucht wird immer am Originaleintrag
// (`reviewError` bzw. `recordRepair`). Nie mehr drei Sätze in einem Feld; am Handy wird die Stelle angetippt, nie ein Ganzsatz-Feld.

/** Antwort am Originaleintrag buchen: Grammatikfehler über `reviewError`, Reparatur-Sätze über `recordRepair`. */
function book(c: RepairCard, ok: boolean, near: boolean, given: string): void {
  if (c.store === 'grammar' && c.topic && c.errorT !== undefined) void recordGrammarError(c.topic, c.errorT, ok, ok ? '' : given.slice(0, 160), near);
  else void recordRepair(c.id, ok, near);
}

export function AgainScreen() {
  const { t } = useT();
  const api = useHiddenInput();
  const back = useNav((s) => s.back);
  const s = useAgain();
  const card = s.cards[s.pos];
  useCompanionSee({ area: 'grammar', label: t('nbLernenAgainTitle'), phase: 'question' });

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
    if (s.block) reportAgainDone();
    else leave();
  };
  const progress = s.status === 'running' && s.cards.length ? { n: s.pos + 1, total: s.cards.length } : null;

  const onVariant = (c: RepairCard) => (a: GrammarAnswer) => {
    const ok = a.verdict === 'correct';
    const near = a.verdict === 'near';
    book(c, ok, near, a.given);
    answerAgain({ ok: ok || near, near });
    nextAgain();
    return null;
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="unit-again" data-phase={s.status} data-block={s.block ?? ''} data-profile={s.profile}>
      <ExerciseTop onClose={leave} progress={progress} ctx="duty" />
      {s.status === 'running' && card ? (
        <StepBoundary resetKey={`again-${s.pos}`} scope="unitAgain" onSkip={nextAgain}>
          {card.variant ? (
            <GrammarItem key={card.id} task={card.variant} ctx="duty" day={s.day} onDone={onVariant(card)} profile={s.profile} badge={t('fxRVariantBadge')} />
          ) : (
            <RepairItem
              key={card.id}
              item={{ id: card.id, wrong: card.wrong, right: card.right, ...(card.why ? { why: card.why } : {}), src: card.src, ...(card.fix ? { fix: card.fix } : {}), spans: card.spans, box: card.box, topic: card.topic ?? null, pat: card.pat }}
              mode="review"
              area="trainer"
              source={null}
              profile={s.profile}
              onResult={({ ok, near, given }) => {
                book(card, ok, near, given);
                answerAgain({ ok, near });
              }}
              onNext={() => {
                api.blur();
                nextAgain();
              }}
            />
          )}
        </StepBoundary>
      ) : !s.cards.length ? (
        <section className="lx-card flex flex-col items-start gap-3 p-[1.125rem]" data-testid="again-empty">
          <p className="lx-t-support text-muted">{t('fxREmpty')}</p>
          <Button variant="primary" iconAfter="arrowRight" onClick={finish} data-testid="again-done">
            {s.block ? t('nbShNext') : t('nbLernenDone')}
          </Button>
        </section>
      ) : (
        <div data-testid="summary">
          <SessionEnd
            mode="growth"
            title={t('fxREndTitle')}
            right={s.results.filter((r) => r.ok).length}
            total={s.results.length}
            ms={Math.max(1, s.endedAt - s.startedAt)}
            items={[]}
            mistakes={s.results.filter((r) => !r.ok).slice(0, 4).map((r) => ({ wrong: r.wrong, right: r.right, rule: r.why ?? '', when: t('gxEndTomorrow') }))}
            next={{ label: s.block ? t('nbShNext') : t('nbLernenDone'), run: finish }}
          />
        </div>
      )}
    </div>
  );
}
