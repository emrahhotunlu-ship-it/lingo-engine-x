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
import { FkB1Item, FkB2Item } from '../FkItem';
import { RepairItem } from '../RepairItem';
import { markUnclear, recordGrammarError, recordRepair } from '../store';
import { ensureAgain } from './resume';
import { answerAgain, leaveAgain, nextAgain, reportAgainDone, skipAgain, useAgain } from './session';
import type { RepairCard } from '../../../domain/repair/variant';

// Schritt 4 „Fehler korrigieren“ (Lernplattform 2.0 §5.7): ein Satz je Karte, in der Reihenfolge der Schlange. Ab Box 1 mit Muster
// kommt statt des Originals eine ungesehene Aufgabe zum selben Muster (`GrammarItem`); gebucht wird immer am Originaleintrag
// (`reviewError` bzw. `recordRepair`). Nie mehr drei Sätze in einem Feld; am Handy wird die Stelle angetippt, nie ein Ganzsatz-Feld.

/** Antwort am Originaleintrag buchen: Grammatikfehler über `reviewError`, Reparatur-Sätze über `recordRepair`. */
function book(c: RepairCard, ok: boolean, near: boolean, given: string, variant = false): void {
  if (c.store === 'grammar' && c.topic && c.errorT !== undefined) void recordGrammarError(c.topic, c.errorT, ok, ok ? '' : given.slice(0, 160), near, variant);
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

  // Paket FK: „Kann ich nicht nachvollziehen“ – dauerhafter Merker am Eintrag (nie löschen), die Karte zählt nicht als falsch.
  const onUnclear = (c: RepairCard) => () => {
    api.blur();
    void markUnclear({ store: c.store, id: c.id, ...(c.topic ? { topic: c.topic } : {}), ...(c.errorT !== undefined ? { errorT: c.errorT } : {}) });
    skipAgain();
  };
  const onFk = (c: RepairCard) => (r: { ok: boolean; near: boolean; given: string; right: string; wrong: string; why: string }) => {
    book(c, r.ok, r.near, r.given, true);
    answerAgain({ ok: r.ok, near: r.near, wrong: r.wrong, right: r.right, why: r.why });
  };
  const next = () => {
    api.blur();
    nextAgain();
  };

  const onVariant = (c: RepairCard) => (a: GrammarAnswer) => {
    const ok = a.verdict === 'correct';
    const near = a.verdict === 'near';
    book(c, ok, near, a.given, true);
    answerAgain({ ok: ok || near, near });
    nextAgain();
    return null;
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="unit-again" data-phase={s.status} data-block={s.block ?? ''} data-profile={s.profile}>
      <ExerciseTop onClose={leave} progress={progress} ctx="duty" />
      {s.status === 'running' && card ? (
        <StepBoundary resetKey={`again-${s.pos}`} scope="unitAgain" onSkip={nextAgain}>
          {card.kind === 'b1' && card.fk1 ? (
            <FkB1Item key={card.id} task={card.fk1} area="trainer" source={null} onResult={onFk(card)} onNext={next} onUnclear={onUnclear(card)} />
          ) : card.kind === 'b2' && card.fk2 ? (
            <FkB2Item key={card.id} task={card.fk2} area="trainer" source={null} onResult={onFk(card)} onNext={next} onUnclear={onUnclear(card)} />
          ) : card.variant ? (
            <GrammarItem key={card.id} task={card.variant} ctx="duty" day={s.day} onDone={onVariant(card)} profile={s.profile} badge={t('fxRVariantBadge')} />
          ) : (
            <RepairItem
              key={card.id}
              item={{ id: card.id, wrong: card.wrong, right: card.right, ...(card.why ? { why: card.why } : {}), src: card.src, ...(card.fix ? { fix: card.fix } : {}), spans: card.spans, box: card.box, topic: card.topic ?? null, pat: card.pat, ctx: card.ctx ?? null, gapHint: card.gapHint ?? null, n: card.n ?? null }}
              mode="review"
              area="trainer"
              source={null}
              profile={s.profile}
              onResult={({ ok, near, given }) => {
                book(card, ok, near, given);
                answerAgain({ ok, near });
              }}
              onNext={next}
              onUnclear={onUnclear(card)}
            />
          )}
        </StepBoundary>
      ) : !s.cards.length || !s.results.length ? (
        <section className="lx-card flex flex-col items-start gap-3 p-[1.125rem]" data-testid="again-empty">
          <p className="lx-t-support text-muted">{s.cards.length ? t('fxRNoneLeft') : t('fxREmpty')}</p>
          <Button variant="primary" iconAfter="arrowRight" onClick={finish} data-testid="again-done">
            {s.block ? t('nbShNext') : t('nbLernenDone')}
          </Button>
        </section>
      ) : (
        <div data-testid="summary" className="flex flex-col gap-3">
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
          {s.skipped > 0 && (
            <p className="lx-t-support px-1 text-muted" data-testid="again-unclear-note" role="status">
              {t(s.skipped === 1 ? 'fxRUnclearOne' : 'fxRUnclearMany', { n: s.skipped })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
