import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { useSettings } from '../../app/settings';
import { wordCount } from '../../domain/input/textStats';
import { useT, type MessageKey } from '../../i18n';
import { toneRead } from '../../prompts/nb/p4/toneRead';
import { AiRunPanel, isBusy } from '../input/AiRunPanel';

// Ton-Erkennung im eigenen Text (Backlog B9, Markt GR2): auf Tipp „Wie wirkt das?“ → „Wirkt: höflich,
// direkt“ mit einem Satz Begründung und höchstens einem Tipp. Nur mit Claude, ab 12 Wörtern; nichts
// wird gespeichert (reine Rückmeldung zum Entwurf).

export const TONE_MIN_WORDS = 12;

export function ToneRead({ text }: { text: string }) {
  const { t } = useT();
  const ai = useAiAvailable();
  const ask = useAsk(toneRead);
  if (!ai || wordCount(text) < TONE_MIN_WORDS) return null;
  const run = (refresh = false) => void ask.run({ text: text.trim(), uiLang: useSettings.getState().lang }, refresh ? { refresh: true } : undefined);
  const out = ask.data;
  return (
    <div className="flex flex-col gap-2" data-testid="tone-read">
      {!isBusy(ask.phase) && (
        <div>
          <button type="button" className="min-h-11 text-sm font-medium text-accent-text" onClick={() => run()} data-testid="tone-ask" data-ai="">
            {t('nbLesenToneAsk')}
          </button>
        </div>
      )}
      <AiRunPanel phase={ask.phase} error={ask.error} onStop={ask.stop} onRetry={() => run(true)} skeleton={false} />
      {out && !isBusy(ask.phase) && (
        <div className="flex flex-col gap-1 rounded-xl bg-surface px-3 py-2" data-testid="tone-result" data-tones={out.tones.join(' ')} aria-live="polite">
          <p className="text-sm font-semibold">{t('nbLesenToneLabel', { tones: out.tones.map((x) => t(`nbLesenTone_${x}` as MessageKey)).join(', ') })}</p>
          <p className="text-sm text-muted">{out.note}</p>
          {out.tip && <p className="text-sm">{out.tip}</p>}
        </div>
      )}
    </div>
  );
}
