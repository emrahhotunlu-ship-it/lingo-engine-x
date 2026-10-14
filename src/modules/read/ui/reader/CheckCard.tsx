import { useState } from 'react';
import type { Check } from '../../schemas';
import { judgeCheck } from '../../domain/readerCheck';
import { rdrText, type RdrLang } from '../../domain/readerText';
import { EnglishText, Icon } from '../../sharedUi';

// Verständnis-Check (docs/umbau/lesen-plan.md §2.2): höchstens drei Fragen, ohne Wertung und Punkte, kein KI-Aufruf beim Antworten.
// Rückmeldung nach dem festen Vier-Fragen-Raster (Kap. 2 Nr. 4): Was tun · Wozu · Deine Antwort / Richtig · Warum.
// Die Begründung (`why`) kommt auch bei richtiger Antwort.

export type CheckCardProps = {
  checks: readonly Check[];
  articleId: string;
  title: string;
  lang: RdrLang;
  /** Antworten (Fragenummer ab 0 → gewählte Antwort), bei jeder neuen Antwort. */
  onAnswers: (answers: Record<number, number>) => void;
};

export function CheckCard({ checks, articleId, title, lang, onAnswers }: CheckCardProps) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  if (!checks.length) return null;
  const pick = (qi: number, ai: number) => {
    if (answers[qi] !== undefined) return;
    const next = { ...answers, [qi]: ai };
    setAnswers(next);
    onAnswers(next);
  };
  return (
    <section className="lx-card flex flex-col gap-4 p-4" aria-labelledby="rdr-check-h" data-testid="rdr-check">
      <div className="flex flex-col gap-1">
        <h2 id="rdr-check-h" className="m-0 text-base font-semibold text-fg">
          {rdrText(lang, 'rdrCheck')}
        </h2>
        <p className="m-0 text-xs text-muted">{rdrText(lang, 'rdrCheckHint')}</p>
      </div>
      {checks.map((q, qi) => {
        const picked = answers[qi];
        const out = picked === undefined ? null : judgeCheck(q, picked);
        return (
          <div key={q.q} role="group" aria-label={rdrText(lang, 'rdrQuestionN', { n: qi + 1, total: checks.length })} className="flex flex-col gap-2" data-testid="rdr-q" data-answered={out ? (out.right ? 'right' : 'wrong') : undefined}>
            <p className="m-0 text-2xs uppercase tracking-wide text-subtle">{rdrText(lang, 'rdrQuestionN', { n: qi + 1, total: checks.length })}</p>
            <EnglishText as="p" text={q.q} area="read" source={articleId} title={title} className="m-0 text-base font-medium leading-7 text-fg" />
            <dl className={`m-0 flex flex-col gap-0.5 text-xs text-muted ${out ? 'opacity-70' : ''}`}>
                <div className="flex gap-1.5">
                  <dt className="font-semibold">{rdrText(lang, 'rdrDo')}:</dt>
                  <dd className="m-0">{rdrText(lang, 'rdrDoText')}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="font-semibold">{rdrText(lang, 'rdrPurpose')}:</dt>
                  <dd className="m-0">{rdrText(lang, 'rdrPurposeText')}</dd>
                </div>
            </dl>
            <div className="flex flex-col gap-2">
              {q.o.map((opt, ai) => {
                const mine = picked === ai;
                const right = !!out && ai === out.correct;
                const tone = !out ? 'lx-glass text-fg hover:bg-surface-strong' : right ? 'border border-ok bg-ok-soft text-fg' : mine ? 'border border-wrong bg-wrong-soft text-fg' : 'lx-glass text-muted opacity-70';
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={!!out}
                    aria-pressed={mine}
                    onClick={() => pick(qi, ai)}
                    data-testid="rdr-opt"
                    data-state={!out ? undefined : right ? 'right' : mine ? 'wrong' : 'other'}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-left text-sm leading-5 ${tone}`}
                  >
                    {out && (right || mine) ? <Icon name={right ? 'check' : 'close'} size={16} /> : null}
                    <span lang="en">{opt}</span>
                  </button>
                );
              })}
            </div>
            {out ? (
              <div className="flex flex-col gap-1.5 text-sm" role="status" data-testid="rdr-q-feedback">
                <p className={`m-0 flex items-center gap-1.5 font-semibold ${out.right ? 'text-ok-text' : 'text-wrong-text'}`}>
                  <Icon name={out.right ? 'check' : 'close'} size={16} />
                  {rdrText(lang, out.right ? 'rdrRightMsg' : 'rdrWrongMsg')}
                </p>
                {!out.right ? (
                  <p className="m-0 text-muted">
                    <span className="font-semibold">{rdrText(lang, 'rdrYours')}:</span> <span lang="en">{q.o[out.picked]}</span>
                  </p>
                ) : null}
                <p className="m-0 text-muted">
                  <span className="font-semibold">{rdrText(lang, 'rdrCorrect')}:</span> <span lang="en">{q.o[out.correct]}</span>
                </p>
                <p className="m-0 text-fg">
                  <span className="font-semibold">{rdrText(lang, 'rdrWhy')}:</span> <span lang="de">{q.why}</span>
                </p>
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
