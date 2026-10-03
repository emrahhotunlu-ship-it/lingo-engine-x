import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { askText } from '../ai/stream';
import { isAiFailure } from '../ai/types';
import { useAiAvailable } from '../ai/scope';
import { useRoute } from '../app/route';
import { useClock } from '../app/clock';
import { askPrompt, ASK_ID, PROMPT_VERSION } from '../prompts/coach';
import { countAiCall } from './aiCount';
import { logWarn } from '../platform/diagnostics';

// „Claude fragen" (docs/neustart.md §4): kennt die aktuelle Aufgabe, eine Anfrage je Knopfdruck.

export function AskSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const available = useAiAvailable();
  return (
    <Sheet open={open} onClose={onClose} title={t('cAsk')} closeLabel={t('cClose')}>
      {!available ? <p className="text-sm text-muted">{t('cAskNoAi')}</p> : <AskBody />}
    </Sheet>
  );
}

/** Inhalt des Blatts: wird beim Öffnen frisch eingehängt (Frage aus der Vorbelegung). */
function AskBody() {
  const { t, lang } = useT();
  const context = useRoute((s) => s.context);
  const preset = useRoute((s) => s.askPreset);
  const today = useClock((s) => s.today);
  const [question, setQuestion] = useState(preset);
  const [answer, setAnswer] = useState('');
  const [phase, setPhase] = useState<'idle' | 'thinking' | 'streaming' | 'slow' | 'error'>('idle');
  const ctl = useRef<AbortController | null>(null);
  useEffect(() => () => ctl.current?.abort(), []);

  async function send() {
    const q = question.trim();
    if (!q) return;
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setAnswer('');
    setPhase('thinking');
    countAiCall(today);
    try {
      const res = await askText({
        id: ASK_ID,
        version: PROMPT_VERSION,
        tier: 'default',
        input: askPrompt(q, context, lang),
        cache: false,
        signal: c.signal,
        priority: 'user',
        onPhase: (p) => {
          if (p === 'slow') setPhase('slow');
        },
        onText: (u) => {
          setPhase('streaming');
          setAnswer(u.text);
        },
      });
      setAnswer(res.text);
      setPhase('idle');
    } catch (err) {
      if (isAiFailure(err) && err.kind === 'cancelled') return setPhase('idle');
      logWarn('ask', err);
      setPhase('error');
    }
  }

  const busy = phase === 'thinking' || phase === 'streaming' || phase === 'slow';
  return (
    <div data-testid="ask">
      {context && <p className="mb-3 text-xs text-muted">{t('cAskContext', { ctx: context })}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t('cAskPlaceholder')}
          rows={3}
          className="w-full resize-none rounded-[var(--radius-control)] border border-line bg-surface p-3 text-base text-fg outline-none focus:border-accent"
          data-testid="ask-input"
        />
        <div className="mt-3 flex gap-2">
          {busy ? (
            <Button type="button" variant="secondary" icon="stop" onClick={() => ctl.current?.abort()}>
              {t('cAskStop')}
            </Button>
          ) : (
            <Button type="submit" variant="primary" icon="send" disabled={!question.trim()} data-testid="ask-send">
              {t('cAskSend')}
            </Button>
          )}
        </div>
      </form>
      <p className="mt-2 text-2xs text-subtle">{t('cAskHint')}</p>
      <div className="mt-5 whitespace-pre-wrap text-sm leading-relaxed" aria-live="polite" data-testid="ask-answer">
        {phase === 'thinking' && <span className="text-muted">{t('cAskThinking')}</span>}
        {phase === 'slow' && !answer && <span className="text-muted">{t('cAskSlow')}</span>}
        {phase === 'error' && <span className="text-danger-text">{t('cAskError')}</span>}
        {answer}
      </div>
    </div>
  );
}
