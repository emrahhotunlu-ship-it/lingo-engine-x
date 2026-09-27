import { motion } from 'framer-motion';
import { useId, useRef, useState, type ReactNode } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { EnglishText } from '../../engine/EnglishText';
import { useT, type MessageKey } from '../../i18n';
import { patternCheck, type PatternCheckOut } from '../../prompts/patternCheck';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { AiRunPanel, isBusy } from '../input/AiRunPanel';

// Neuer Satz im Kurzdrill einer Deutsch-Falle (Lernberatung 27.09., V3): Aufgabe (Englisch,
// antippbar) → eigener Satz → pattern-check@1 → Urteil, bessere Fassung, Grund → „Weiter“.
// Keine Selbstbewertung. Ohne Claude lässt sich der Satz nicht prüfen: dann nur „Überspringen“.
// Vier Pflichtfragen: Aufgabe (Titel), Zweck (Info-Symbol), Was hatte ich / was ist richtig, Warum.

type Props = {
  task: string;
  pattern: string;
  example: string;
  status?: ReactNode;
  onResult: (ok: boolean) => void;
  onNext: () => void;
};

const VERDICT_KEY: Record<PatternCheckOut['verdict'], MessageKey> = { correct: 'ptVerdict_correct', minor: 'ptVerdict_minor', wrong: 'ptVerdict_wrong' };

export function FreeItem({ task, pattern, example, status, onResult, onNext }: Props) {
  const { t, lang } = useT();
  const ai = useAiAvailable();
  const ask = useAsk(patternCheck);
  const [text, setText] = useState('');
  const [res, setRes] = useState<{ out: PatternCheckOut; given: string } | null>(null);
  const [info, setInfo] = useState(false);
  const infoId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const busy = isBusy(ask.phase);

  const check = async () => {
    const given = text.trim();
    if (res || busy || !given || !ai) return;
    field.current?.blur();
    const out = await ask.run({ pattern, example, task, sentence: given, uiLang: lang });
    // Nicht erreichbar oder unlesbar: nicht als falsch werten, „Prüfen“ fragt erneut.
    if (!out) return;
    setRes({ out, given });
    onResult(out.verdict !== 'wrong');
  };

  const tone = !res ? '' : res.out.verdict === 'wrong' ? 'text-danger-text' : res.out.verdict === 'minor' ? 'text-gold-text' : 'text-accent-text';

  return (
    <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="pattern-free" data-state={res ? res.out.verdict : 'open'}>
      <header className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted">
          <span className="inline-flex items-center gap-1">
            <Icon name="target" size={14} />
            {t('ptFreeKind')}
          </span>
          {status && (
            <>
              <span aria-hidden="true">·</span>
              <span className="lx-tnum">{status}</span>
            </>
          )}
        </p>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl" data-testid="pattern-free-title">
            {t('ptFreeTask')}
          </h2>
          <button
            type="button"
            className="-m-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-subtle transition-colors hover:text-fg"
            aria-label={t('ptInfo')}
            aria-expanded={info}
            aria-controls={infoId}
            onClick={() => setInfo((v) => !v)}
          >
            <Icon name="info" size={18} />
          </button>
        </div>
        {info && (
          <p id={infoId} className="text-sm text-muted">
            {t('ptFreePurpose')}
          </p>
        )}
      </header>

      <div className="flex flex-col gap-3">
        <EnglishText as="p" text={task} area="lesson" source="app/patterns" className="text-lg leading-relaxed" testId="pattern-free-task" />
        <textarea
          ref={field}
          className="lx-field min-h-24 text-base"
          lang="en"
          rows={3}
          value={text}
          readOnly={!!res || busy}
          onChange={(ev) => setText(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter' && !ev.shiftKey) {
              ev.preventDefault();
              if (res) onNext();
              else void check();
            }
          }}
          aria-label={t('ptFreeLabel')}
          placeholder={t('ptFreeLabel')}
          autoCapitalize="sentences"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          data-testid="pattern-free-input"
        />
        {busy && <AiRunPanel phase={ask.phase} error={null} onStop={ask.stop} skeleton={false} />}
        {!busy && !res && ask.error && <AiRunPanel phase="error" error={ask.error} onRetry={() => void check()} skeleton={false} />}
        {!ai && !res && (
          <p className="text-sm text-muted" data-testid="pattern-free-noai">
            {t('ptFreeNoAi')}
          </p>
        )}
      </div>

      {!res && (
        <div className="flex flex-wrap items-center gap-3">
          {ai && (
            <Button variant="primary" disabled={!text.trim() || busy} onClick={() => void check()} data-testid="pattern-free-check" data-ai="">
              {t('ptCheck')}
            </Button>
          )}
          <Button variant="ghost" disabled={busy} onClick={onNext} data-testid="pattern-free-skip">
            {t('ptSkip')}
          </Button>
        </div>
      )}

      {res && (
        <motion.section
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: EASE_OUT }}
          className="flex flex-col gap-3 border-t border-line pt-4"
          data-testid="pattern-free-result"
        >
          <p className={`text-base font-semibold ${tone}`} data-testid="pattern-free-verdict" data-verdict={res.out.verdict} role="status">
            {t(VERDICT_KEY[res.out.verdict])}
          </p>
          <p className="text-sm leading-relaxed">
            <span className="text-muted">{t('ptYouWrote')}: </span>
            <span lang="en">{res.given}</span>
          </p>
          {res.out.fixed.trim() && (
            <div className="flex flex-col gap-1 rounded-xl bg-surface px-3 py-2">
              <p className="text-sm text-muted">{t('ptFixed')}</p>
              <EnglishText text={res.out.fixed} area="lesson" source="app/patterns" className="text-base font-medium leading-relaxed" testId="pattern-free-fixed" />
            </div>
          )}
          <p className="text-sm text-muted" data-testid="pattern-free-why">
            {t('ptWhy')}: {res.out.why}
          </p>
          <div>
            <Button variant="primary" iconAfter="arrowRight" onClick={onNext} data-testid="pattern-free-next">
              {t('ptNext')}
            </Button>
          </div>
        </motion.section>
      )}
    </article>
  );
}
