import { useEffect, useState } from 'react';
import { useAsk } from '../../ai/useAsk';
import type { TrainCard } from '../../domain/srs/types';
import { useT } from '../../i18n';
import { synonymCheck } from '../../prompts/synonymCheck';
import { AiRunPanel } from '../../ui/AiRunPanel';
import { Button } from '../../ui/Button';

// „War das auch richtig?“ (Lernplattform 2.0 §4.8): andere Synonyme prüft Claude NUR auf Antippen – ohne Antippen gibt es keine
// `sample`-Anfrage. Ergebnis gekennzeichnet („von Claude, kann Fehler enthalten“); bei „ja“ gilt „Ich lag richtig“ (höchstens „Gut“).

/** `onBusy` (Korrekturrunde P3, Punkt 4): Solange Claude prüft, wird die Antwort beim Verlassen nicht gebucht. */
export function SynonymCheck({ card, given, onOk, onBusy }: { card: TrainCard; given: string; onOk: () => void; onBusy?: (busy: boolean) => void }) {
  const { t, lang } = useT();
  const ask = useAsk(synonymCheck);
  const [out, setOut] = useState<{ ok: boolean; why: string } | null>(null);
  const busy = ask.phase === 'queued' || ask.phase === 'thinking' || ask.phase === 'slow' || ask.phase === 'streaming';
  useEffect(() => {
    onBusy?.(busy);
  }, [busy, onBusy]);
  useEffect(() => () => onBusy?.(false), [onBusy]);
  if (!given.trim()) return null;
  const run = async () => {
    const sentence = card.context ? `${card.context.sentence.slice(0, card.context.start)}___${card.context.sentence.slice(card.context.end)}` : card.word;
    const r = await ask.run({ target: card.word, meaning: (lang === 'de' ? card.de : card.def) ?? card.def ?? card.de ?? '', sentence, given: given.trim(), uiLang: lang });
    if (r) setOut(r);
  };
  return (
    <div className="flex flex-col gap-2" data-testid="synonym">
      {!out && (
        // Im Band neben „Mehr“: gleiche Knopfart (Punkt 1d), eine Zeile.
        <Button variant="secondary" onClick={() => void run()} disabled={busy} data-testid="synonym-ask">
          {t('wxSynonymAsk')}
        </Button>
      )}
      {!out && <AiRunPanel phase={ask.phase} error={ask.error} onStop={ask.stop} onRetry={() => void run()} skeleton={false} />}
      {out && (
        <div className="lx-inset flex flex-col gap-1" data-testid="synonym-result" data-ok={out.ok ? '' : undefined}>
          <p className="lx-t-support" lang={lang}>
            {out.why}
          </p>
          <p className="lx-t-meta text-subtle">{t('wxAiNote')}</p>
          {out.ok && (
            <div>
              <Button variant="secondary" onClick={onOk} data-testid="synonym-accept">
                {t('exMenuOverride')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
