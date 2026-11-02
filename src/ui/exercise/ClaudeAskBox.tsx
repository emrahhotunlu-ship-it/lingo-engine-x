import { useState, type FormEvent } from 'react';
import { openCompanion } from '../../features/companion/store';
import { useT } from '../../i18n';
import { Icon } from '../Icon';

// „Frag Claude“ (UX-Neuanfang B, Vorschau `5Zwv5noCiNwzrzzfQsfzXy`): Schnellfragen und eigene Frage, immer sichtbar – Emrah muss nicht erst
// einen Hilfe-Knopf suchen (02.11.2026). Vor dem Prüfen nur Fragen, die die Lösung nicht verraten; danach Warum, Beispiel, Abgrenzung.
// Jede Frage öffnet den Begleiter mit der Frage samt Aufgabe (Claude sieht die Übung über `useCompanionSee`).

export function ClaudeAskBox({ task, after, input = true, testId = 'claude-ask' }: { task: string; after: boolean; input?: boolean; testId?: string }) {
  const { t } = useT();
  const [text, setText] = useState('');
  const ask = (q: string): void => openCompanion({ tab: 'chat', send: t('vuAskWrap', { task, q }) });
  const quick = after ? [t('vuQWhy'), t('vuQExample'), t('vuQOther')] : [t('vuQTip'), t('vuQMeaning')];
  const submit = (e: FormEvent): void => {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;
    setText('');
    ask(q);
  };
  return (
    <section className="lx-ask" data-testid={testId} data-after={after ? '' : undefined} aria-label={t('vuAskHead')}>
      <h3 className="lx-vu-ctx-h lx-ask-h">
        <Icon name="sparkle" size={14} aria-hidden="true" />
        {t('vuAskHead')}
      </h3>
      <div className="lx-ask-quick" role="group" aria-label={t('vuAskHead')}>
        {quick.map((q) => (
          <button key={q} type="button" className="lx-ask-chip" onClick={() => ask(q)} data-testid="claude-ask-chip">
            {q}
          </button>
        ))}
      </div>
      {input && (
        <form className="lx-ask-form" onSubmit={submit}>
          <input
            className="lx-ask-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('vuAskPlaceholder')}
            aria-label={t('vuAskPlaceholder')}
            enterKeyHint="send"
            data-testid="claude-ask-input"
          />
          <button type="submit" className="lx-ask-send" disabled={!text.trim()} data-testid="claude-ask-send">
            {t('vuAskSend')}
          </button>
        </form>
      )}
    </section>
  );
}
