import { useState } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { getWriter } from '../../data';
import { storedTranslation, translationPatch } from '../../domain/srs/examples';
import type { TrainCard } from '../../domain/srs/types';
import { useT } from '../../i18n';
import { logError } from '../../platform/diagnostics';
import { translate } from '../../prompts/translate';

// Deutsche Übersetzung eines Beispielsatzes (Emrah 02.10.2026): auf Tipp, einmal von Claude, dann an der
// Karte gespeichert (`exDe`, nur ergänzt). Ohne gespeicherte Übersetzung und ohne Claude: nichts anzeigen.

export function ExampleTranslation({ card, en }: { card: TrainCard; en: string }) {
  const { t, lang } = useT();
  const ai = useAiAvailable();
  const ask = useAsk(translate);
  const [shown, setShown] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const text = fresh ?? storedTranslation(card.doc, en);
  const busy = ask.phase === 'queued' || ask.phase === 'thinking' || ask.phase === 'streaming' || ask.phase === 'slow';
  const failed = ask.phase === 'error' || (ask.error !== null && !busy);
  if (!text && !ai) return null;

  const run = async () => {
    setShown(true);
    if (text || busy) return;
    const out = await ask.run({ text: en, from: 'en', register: 'neutral', uiLang: lang });
    const de = out?.translation.trim();
    if (!de) return;
    setFresh(de);
    const writer = getWriter();
    if (!writer || !card.inDb) return;
    try {
      await writer.transform(card.path, (cur) => {
        const p = translationPatch(cur, en, de);
        return p ? { update: p } : null;
      });
    } catch (err) {
      logError('vocab:exDe', err, card.path);
    }
  };

  return (
    <span className="mt-0.5 flex flex-col items-start" data-testid="example-trans">
      {text && shown ? (
        <span className="text-sm text-muted" lang="de" data-testid="example-trans-text">
          {text}
        </span>
      ) : (
        <button type="button" className="min-h-11 -my-2 text-sm text-subtle underline" onClick={() => void run()} disabled={busy} data-testid="example-trans-btn">
          {busy ? t('trTransBusy') : t('trTrans')}
        </button>
      )}
      {failed && !text && <span className="text-xs text-subtle">{t('trTransFail')}</span>}
    </span>
  );
}
