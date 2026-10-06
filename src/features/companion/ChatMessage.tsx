import { useState } from 'react';
import { msgLang, type ChatMsg } from '../../domain/companion/chatDoc';
import { Markdown } from '../../engine/Markdown';
import { useT } from '../../i18n';
import { Icon } from '../../ui/Icon';

// Eine Nachricht im Verlauf (Phase 5 §8.1): Nutzer rechts auf Fläche, Claude links ohne Blase in
// voller Lesebreite. Antworten in anderer Sprache als die Oberfläche erscheinen eingeklappt –
// nie gemischt (E5-04, Kap. 15) – mit „Auf {Sprache} neu fragen".

export type MsgState = 'streaming' | 'done' | 'stopped' | 'error' | 'foreign';

type Props = {
  msg: ChatMsg;
  state: MsgState;
  earlier?: boolean;
  truncated?: boolean;
  interrupted?: boolean;
  onAskAgain?: () => void;
};

export function ChatMessage({ msg, state, earlier, truncated, interrupted, onAskAgain }: Props) {
  const { t, lang } = useT();
  const [show, setShow] = useState(false);
  const detected = msgLang(msg);
  const dataLang = detected === 'unknown' ? (msg.lang ?? lang) : detected;
  const langName = (l: string) => (l === 'en' ? t('cmpLangEn') : t('cmpLangDe'));

  if (msg.role === 'user') {
    return (
      <div className={`flex justify-end ${earlier ? 'opacity-70' : ''}`} data-testid="chat-msg" data-role="user" data-lang={dataLang} data-state={state}>
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-surface-strong px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
          <span className="sr-only">{t('cmpYou')}: </span>
          {msg.content}
        </div>
      </div>
    );
  }

  const foreign = state === 'foreign';
  const body = <Markdown text={msg.content} streaming={state === 'streaming'} uiLang={dataLang === 'en' ? 'en' : 'de'} className="text-sm leading-relaxed" />;
  return (
    <div className={`flex max-w-[68ch] flex-col gap-1.5 ${earlier ? 'opacity-70' : ''}`} data-testid="chat-msg" data-role="assistant" data-lang={dataLang} data-state={state}>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Icon name="sparkle" size={14} />
        {t('cmpTitle')}
      </p>
      {foreign ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-expanded={show}
              onClick={() => setShow((v) => !v)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-muted hover:text-fg"
              data-testid="chat-foreign-toggle"
            >
              <Icon name="chevronDown" size={18} className={show ? 'rotate-180 transition-transform' : 'transition-transform'} />
              {t('cmpForeign', { lang: langName(dataLang) })}
            </button>
            {onAskAgain && (
              <button type="button" onClick={onAskAgain} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-accent-text hover:underline" data-testid="chat-ask-again" data-ai="">
                {t('cmpAskAgainLang', { lang: langName(lang) })}
              </button>
            )}
          </div>
          {show && <div lang={dataLang}>{body}</div>}
        </div>
      ) : (
        <div lang={dataLang}>{body}</div>
      )}
      {(state === 'stopped' || interrupted) && <p className="text-xs text-subtle">{interrupted ? t('cmpInterrupted') : t('cmpStopped')}</p>}
      {truncated && <p className="text-xs text-subtle">{t('cmpCut')}</p>}
    </div>
  );
}
