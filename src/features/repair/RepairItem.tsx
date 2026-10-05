import { ActionBar, PrimaryAction } from '../../ui/ActionBar';
import { motion } from 'framer-motion';
import { useId, useRef, useState, type ReactNode } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { checkRepairLocal } from '../../domain/repair/check';
import type { RepairItem as Repair } from '../../domain/repair/repair';
import { EnglishText } from '../../engine/EnglishText';
import type { WordTapArea } from '../../engine/wordTap';
import { useT, type MessageKey } from '../../i18n';
import { repairCheck } from '../../prompts/repairCheck';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { AiRunPanel } from '../../ui/AiRunPanel';

// Ein Reparatur-Satz (Lernberatung 27.09., V2): der alte eigene Satz steht da, die bessere
// Fassung ist verborgen. Emrah schreibt den Satz neu → Prüfung (lokal zuerst, sonst
// repair-check@1, ohne KI zählt die lokale Prüfung) → Ergebnis, bessere Fassung mit Grund,
// antippbare Wörter → „Weiter". Keine Selbstbewertung. Vier Pflichtfragen: Aufgabe (Titel),
// Zweck (Info-Symbol), Was hatte ich / was ist richtig und Warum (Ergebnis).

export type RepairView = Pick<Repair, 'id' | 'wrong' | 'right' | 'why' | 'src' | 'fix'>;
const PREFILL_WORDS = 9;
const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

export type RepairVerdict = 'exact' | 'close' | 'ok' | 'no';

type Props = {
  item: RepairView;
  /** `review` = in der Wiederholung („Damals hast du gesagt"), `step` = direkt nach der Korrektur. */
  mode: 'review' | 'step';
  area: WordTapArea;
  source: string | null;
  /** Zusatz in der Statuszeile (z. B. „Satz 1 von 3"). */
  status?: ReactNode;
  onResult: (r: { ok: boolean; given: string; ms: number }) => void;
  onNext: () => void;
  onSkip?: () => void;
  nextLabel?: string;
};

const VERDICT_KEY: Record<RepairVerdict, MessageKey> = { exact: 'rxVerdictOk', ok: 'rxVerdictOk', close: 'rxVerdictClose', no: 'rxVerdictNo' };

export function RepairItem({ item, mode, area, source, status, onResult, onNext, onSkip, nextLabel }: Props) {
  const { t, lang } = useT();
  const ai = useAiAvailable();
  const ask = useAsk(repairCheck);
  // Lange Sätze (Emrah 02.10.2026): Der alte Satz steht schon im Feld, korrigiert wird nur die falsche Stelle –
  // kein halber Roman auf dem Handy. Kurze Sätze bleiben leer (aus dem Kopf abrufen).
  const prefill = wordCount(item.wrong) >= PREFILL_WORDS;
  const [text, setText] = useState(() => (prefill ? item.wrong.trim() : ''));
  const [res, setRes] = useState<{ verdict: RepairVerdict; note: string | null; given: string } | null>(null);
  const [info, setInfo] = useState(false);
  const infoId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const [shownAt] = useState(() => performance.now());
  const busy = ask.phase === 'queued' || ask.phase === 'thinking' || ask.phase === 'slow' || ask.phase === 'streaming';
  const srcKey = `rxSrc_${item.src}` as MessageKey;

  const finish = (verdict: RepairVerdict, note: string | null, given: string) => {
    setRes({ verdict, note, given });
    onResult({ ok: verdict !== 'no', given, ms: performance.now() - shownAt });
  };

  const check = async () => {
    const given = text.trim();
    if (res || busy || !given) return;
    field.current?.blur();
    const local = checkRepairLocal(given, item);
    if (local !== 'no' || !ai) {
      finish(local, null, given);
      return;
    }
    const out = await ask.run({ wrong: item.wrong, right: item.right, why: item.why ?? '', given, uiLang: lang });
    // KI nicht erreichbar, abgebrochen oder unlesbar: nicht als falsch werten (Lernwissenschaft
    // 27.09.) – der Satz bleibt offen, der Fehler steht da, „Prüfen" fragt erneut.
    if (!out) return;
    finish(out.ok ? 'ok' : 'no', out.note ?? null, given);
  };

  const tone = !res ? '' : res.verdict === 'no' ? 'text-danger-text' : res.verdict === 'close' ? 'text-gold-text' : 'text-accent-text';

  return (
    <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="repair-item" data-id={item.id} data-mode={mode} data-state={res ? res.verdict : 'open'}>
      <header className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted">
          <span className="inline-flex items-center gap-1">
            <Icon name="refresh" size={14} />
            {t('rxKind')}
          </span>
          <span aria-hidden="true">·</span>
          <span>{t(srcKey)}</span>
          {status && (
            <>
              <span aria-hidden="true">·</span>
              <span className="lx-tnum">{status}</span>
            </>
          )}
        </p>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl" data-testid="repair-task">
            {t('rxTask')}
          </h2>
          <button
            type="button"
            className="-m-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-subtle transition-colors hover:text-fg"
            aria-label={t('rxInfo')}
            aria-expanded={info}
            aria-controls={infoId}
            onClick={() => setInfo((v) => !v)}
          >
            <Icon name="info" size={18} />
          </button>
        </div>
        {info && (
          <p id={infoId} className="text-sm text-muted">
            {t('rxPurpose')}
          </p>
        )}
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted">{mode === 'review' ? t('rxThen') : t('rxYours')}</p>
          {/* Der alte Satz ist bewusst nicht antippbar: er enthält den Fehler. */}
          <p lang="en" className="text-lg leading-relaxed" data-testid="repair-wrong">
            “{item.wrong}”
          </p>
        </div>
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
          aria-label={t('rxInputLabel')}
          placeholder={t('rxInputLabel')}
          autoCapitalize="sentences"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          data-testid="repair-input"
        />
        {prefill && !res && (
          <p className="text-xs text-subtle" data-testid="repair-edit-hint">
            {t('rxEditHint')}
          </p>
        )}
        {busy && <AiRunPanel phase={ask.phase} error={null} onStop={ask.stop} skeleton={false} />}
        {!busy && !res && ask.error && <AiRunPanel phase="error" error={ask.error} onRetry={() => void check()} skeleton={false} />}
      </div>

      {!res && (
        <div className="flex flex-wrap items-center gap-3">
          <ActionBar stateKey="check">
            <PrimaryAction disabled={!text.trim() || busy || (prefill && text.trim() === item.wrong.trim())} onClick={() => void check()} testId="repair-check">
              {t('rxCheck')}
            </PrimaryAction>
          </ActionBar>
          {onSkip && (
            <Button variant="ghost" disabled={busy} onClick={onSkip} data-testid="repair-skip">
              {t('rxSkip')}
            </Button>
          )}
        </div>
      )}

      {res && (
        <motion.section
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: EASE_OUT }}
          aria-label={t('rxResultLabel')}
          className="flex flex-col gap-3 border-t border-line pt-4"
          data-testid="repair-result"
        >
          <p className={`text-base font-semibold ${tone}`} data-testid="repair-verdict" data-verdict={res.verdict} role="status">
            {t(VERDICT_KEY[res.verdict])}
          </p>
          {res.note && <p className="text-sm text-muted">{res.note}</p>}
          {res.verdict !== 'exact' && (
            <p className="text-sm leading-relaxed">
              <span className="text-muted">{t('rxYouWrote')}: </span>
              <span lang="en" data-testid="repair-given">
                {res.given}
              </span>
            </p>
          )}
          <div className="flex flex-col gap-1 rounded-xl bg-surface px-3 py-2">
            <p className="text-sm text-muted">{t('rxBetter')}</p>
            <EnglishText text={item.right} area={area} source={source} className="text-base font-medium leading-relaxed" testId="repair-right" />
          </div>
          {item.why && (
            <p className="text-sm text-muted" data-testid="repair-why">
              {t('rxWhy')}: {item.why}
            </p>
          )}
          <ActionBar stateKey="next">
            <PrimaryAction iconAfter="arrowRight" onClick={onNext} testId="repair-next">
              {nextLabel ?? t('rxNext')}
            </PrimaryAction>
          </ActionBar>
        </motion.section>
      )}
    </article>
  );
}
