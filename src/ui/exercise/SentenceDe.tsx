import { useState } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { useT } from '../../i18n';
import { translate } from '../../prompts/translate';

// Deutsche Übersetzung des gezeigten Satzes in der Rückmeldung (Live-Kommentar 24.11.2026, „Warum wird an dieser Stelle nicht die deutsche
// Übersetzung angezeigt oder mindestens angeboten?“). Gespeicherte Übersetzung des Satzes: immer sichtbar. Ohne: ein kleiner Knopf
// „Auf Deutsch“, der genau diesen Satz EINMAL auf Tipp über das KI-Tor übersetzt (`translate@3`, quick, 24 h zwischengespeichert) – nie von
// selbst, kein eigener Timeout, kein Wiederholen (A6.2/A6.3; ein zweiter Tipp nach einem Fehler ist der Neuversuch des Nutzers). Gespeichert
// wird nichts: das Wörter-Modul hat keinen Schreibweg für Satz-Übersetzungen (Schreibgrenze vocab/ in tests/unit/vocab/isolation.test.ts).
// Ohne Claude und ohne gespeicherte Übersetzung: nichts.

export function SentenceDe({ en, de }: { en: string; de: string | null }) {
  const { t, lang } = useT();
  const ai = useAiAvailable();
  const ask = useAsk(translate);
  const [fresh, setFresh] = useState<string | null>(null);
  const text = de?.trim() || fresh;
  const busy = ask.phase === 'queued' || ask.phase === 'thinking' || ask.phase === 'streaming' || ask.phase === 'slow';
  if (!text && (!ai || !en.trim())) return null;
  if (text)
    return (
      <p className="lx-t-support m-0 text-muted" data-testid="vm-sent-de">
        <span className="text-subtle">{t('vmSentDeLabel')}: </span>
        <span lang="de" data-testid="vm-sent-de-text">
          {text}
        </span>
      </p>
    );
  const run = async () => {
    if (busy) return;
    const out = await ask.run({ text: en, from: 'en', register: 'neutral', uiLang: lang });
    const tr = out?.translation.trim();
    if (tr) setFresh(tr);
  };
  return (
    <div className="flex flex-col items-start gap-1" data-testid="vm-sent-de-ask">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="lx-kspeak" onClick={() => void run()} disabled={busy} aria-busy={busy || undefined} data-testid="vm-sent-de-btn">
          <span>{busy ? t('vmSentDeBusy') : t('vmSentDeBtn')}</span>
        </button>
        {ask.phase === 'slow' ? (
          <button type="button" className="lx-kspeak" onClick={ask.stop} data-testid="vm-sent-de-stop">
            <span>{t('aiStop')}</span>
          </button>
        ) : null}
      </div>
      {ask.phase === 'slow' ? <p className="lx-t-meta m-0 text-subtle">{t('aiSlow')}</p> : null}
      {ask.phase === 'error' ? (
        <p className="lx-t-meta m-0 text-subtle" data-testid="vm-sent-de-fail">
          {t('vmSentDeFail')}
        </p>
      ) : null}
    </div>
  );
}
