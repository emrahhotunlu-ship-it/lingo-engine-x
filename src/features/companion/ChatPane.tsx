import { useAiAvailable } from '../../ai/scope';
import { useNav } from '../../app/nav';
import { msgLang, type ChatMsg } from '../../domain/companion/chatDoc';
import { suggestions, type SuggestKey } from '../../domain/companion/suggest';
import { Markdown } from '../../engine/Markdown';
import { useT } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { openPreplyPrep } from '../preply/store';
import { startClaudeDrill } from './drill';
import { ChatMessage, type MsgState } from './ChatMessage';
import { Composer } from './Composer';
import { useCurrentSeeing } from './seeing';
import { allMsgs, closeCompanion, msgKey, resend, retrySave, sendMessage, stopTurn, useCompanion } from './store';
import { useStickToBottom } from '../../ui/chat/scroll';
import { NewerPill } from '../../ui/chat/ChatInput';
import { AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

// Reiter „Fragen" des Begleiters (Phase 5 §8.1): Verlauf ohne Scroll-Springen, laufende Antwort,
// Fehler mit „Erneut senden", Vorschläge und Aktionen, Eingabe.

export function ChatPane({ focusSeq }: { focusSeq: number }) {
  const { t, lang } = useT();
  const s = useCompanion();
  const seeing = useCurrentSeeing();
  const go = useNav((n) => n.go);
  const { scroller, content, jump, toBottom } = useStickToBottom();
  const ai = useAiAvailable();

  const msgs = allMsgs(s);
  const turn = s.turn;
  const running = turn.status === 'queued' || turn.status === 'thinking' || turn.status === 'streaming' || turn.status === 'slow';
  const current = msgs.filter((m) => !s.since || (m.t ?? 0) >= s.since);
  const earlier = s.since ? msgs.filter((m) => (m.t ?? 0) < s.since) : [];
  const lastAssistant = [...current].reverse().find((m) => m.role === 'assistant');
  const afterReply = !!lastAssistant && !running && turn.status !== 'error';
  const chips = suggestions({ seeing, hasWord: !!s.attach, afterReply });
  const unsaved = s.saveState === 'local' || s.saveState === 'invalid';
  const langName = (l: string) => (l === 'en' ? t('cmpLangEn') : t('cmpLangDe'));

  const send = (text: string) => {
    void sendMessage(text);
  };

  // Eigenes Senden ist eine ausdrückliche Handlung: nach unten (§8.1) – auf jedem Weg (Eingabe,
  // Vorschlag, „Claude fragen" aus dem Wort-Popup), auch wenn vorher hochgescrollt war.
  const sentSeq = s.sentSeq;
  useEffect(() => {
    if (!sentSeq) return;
    toBottom();
    const id = requestAnimationFrame(() => toBottom());
    return () => cancelAnimationFrame(id);
  }, [sentSeq, toBottom]);

  // Vorschläge: vor dem ersten Wechsel umbrechend; sobald ein Gespräch läuft, eine Zeile zum Wischen.
  const compact = current.length > 0 || running;

  const stateOf = (m: ChatMsg): MsgState => {
    if (m.role === 'user') return turn.status === 'error' && turn.userMsg && msgKey(turn.userMsg) === msgKey(m) ? 'error' : 'done';
    if (m.stopped) return 'stopped';
    const l = msgLang(m);
    return l !== 'unknown' && l !== lang ? 'foreign' : 'done';
  };

  const render = (m: ChatMsg, early: boolean) => (
    <ChatMessage
      key={msgKey(m)}
      msg={m}
      state={stateOf(m)}
      earlier={early}
      truncated={!!s.notes[msgKey(m)]?.truncated}
      {...(!early && m.role === 'assistant' && stateOf(m) === 'foreign' ? { onAskAgain: () => send(t('cmpAskAgainMsg', { lang: langName(lang) })) } : {})}
    />
  );

  const action = (kind: 'practice' | 'preply' | 'drill') => {
    if (kind === 'drill') {
      // N96: die letzte Frage und Antwort sind das Thema der fünf Aufgaben.
      const lastUser = [...current].reverse().find((m) => m.role === 'user');
      const context = [lastUser ? `Learner: ${lastUser.content}` : '', lastAssistant ? `Tutor: ${lastAssistant.content}` : ''].filter(Boolean).join('\n\n');
      closeCompanion();
      startClaudeDrill(context);
      go({ name: 'claudeDrill' });
      return;
    }
    if (kind === 'preply') {
      const topic = s.attach?.word ?? seeing?.label ?? '';
      closeCompanion();
      openPreplyPrep(topic ? { title: topic } : null);
      return;
    }
    closeCompanion();
    // Im Trainer führt „Weiter üben" zurück zur Übung, sonst zu „Heute" mit dem einen großen Knopf.
    if (seeing?.area !== 'trainer') go({ name: 'today' });
  };

  const phaseLabel = turn.status === 'slow' ? t('aiSlow') : turn.status === 'queued' ? t('aiQueued') : t('aiThinking');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          className="absolute inset-0 overflow-y-auto overscroll-contain px-4 sm:px-6"
          style={{ overflowAnchor: 'none' }}
          role="log"
          aria-live="off"
          aria-label={t('cmpLog')}
          data-testid="chat-log"
          tabIndex={0}
        >
          <div ref={content} className="mx-auto flex w-full max-w-[48rem] flex-col gap-5 py-4">
            {earlier.length > 0 && (
              <>
                {earlier.map((m) => render(m, true))}
                <div className="flex items-center gap-3 text-xs text-subtle" data-testid="chat-earlier">
                  <span className="h-px flex-1 bg-[var(--lx-border)]" />
                  {t('cmpEarlier')}
                  <span className="h-px flex-1 bg-[var(--lx-border)]" />
                </div>
              </>
            )}
            {current.length === 0 && !running && (
              <p className="max-w-[60ch] text-[0.95rem] leading-relaxed text-muted" data-testid="chat-empty">
                {t('cmpEmpty')}
              </p>
            )}
            {current.map((m) => render(m, false))}
            {running && (
              <div className="flex max-w-[68ch] flex-col gap-1.5" data-testid="chat-msg" data-role="assistant" data-lang={lang} data-state="streaming">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                  <Icon name="sparkle" size={14} />
                  {t('cmpTitle')}
                </p>
                {turn.text ? (
                  <Markdown text={turn.text} streaming uiLang={lang} className="text-[0.95rem] leading-relaxed" />
                ) : (
                  <p className="lx-thinking text-sm text-muted" data-testid="ai-phase" data-ai-phase={turn.status}>
                    {phaseLabel}
                  </p>
                )}
                {turn.text && turn.status === 'slow' && (
                  <p className="text-xs text-muted" data-testid="ai-phase" data-ai-phase="slow">
                    {t('aiSlow')}
                  </p>
                )}
              </div>
            )}
            {turn.status === 'error' && (
              <div className="flex flex-col gap-2" role="alert" data-testid="chat-error" data-kind={turn.errorKind ?? ''}>
                {turn.text && (
                  <div className="flex max-w-[68ch] flex-col gap-1" data-testid="chat-msg" data-role="assistant" data-lang={lang} data-state="error">
                    <Markdown text={turn.text} streaming={false} uiLang={lang} className="text-[0.95rem] leading-relaxed" />
                    <p className="text-xs text-subtle">{t('cmpInterrupted')}</p>
                  </div>
                )}
                <p className="text-sm text-danger-text">{t(turn.errorKey ?? 'aiFailed')}</p>
                {ai && turn.errorKind !== 'unavailable' && (
                  <div>
                    <button
                      type="button"
                      onClick={resend}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold hover:bg-surface"
                      data-testid="chat-retry"
                      data-ai=""
                    >
                      <Icon name="refresh" size={18} />
                      {t('cmpResend')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <AnimatePresence>{jump && <NewerPill label={t('cmpJump')} onClick={toBottom} testId="chat-jump" className="absolute bottom-3 left-1/2 -translate-x-1/2" />}</AnimatePresence>
      </div>
      <p className="sr-only" aria-live="polite">
        {s.finished > 0 ? t('cmpDone', { n: s.finished }) : ''}
      </p>
      <div className="flex flex-col gap-2 border-t border-line px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:px-6">
        {(unsaved || s.saveState === 'failed') && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted" data-testid="chat-unsaved">
            <span>{s.saveState === 'failed' ? t('cmpSaveFailed') : t('cmpUnsaved')}</span>
            {s.saveState === 'failed' && (
              <button type="button" onClick={() => void retrySave()} className="min-h-11 font-semibold text-accent-text hover:underline" data-testid="chat-save-retry">
                {t('cmpSaveRetry')}
              </button>
            )}
          </div>
        )}
        {!running && ai && (
          <div
            className={compact ? '-mx-4 flex flex-nowrap gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6' : 'flex flex-wrap gap-2'}
            role="group"
            aria-label={t('cmpSuggestLabel')}
            data-testid="chat-suggestions"
            data-compact={compact ? '' : undefined}
            data-hscroll={compact ? '' : undefined}
          >
            {chips.map((k: SuggestKey) => (
              <button
                key={k}
                type="button"
                onClick={() => send(t(k))}
                className="inline-flex min-h-11 flex-none items-center rounded-full border border-line px-4 text-sm font-medium text-fg hover:bg-surface"
                data-testid="chat-suggestion"
                data-key={k}
                data-ai=""
              >
                {t(k)}
              </button>
            ))}
            {afterReply && (
              <>
                <button
                  type="button"
                  onClick={() => action('drill')}
                  className="inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full bg-accent-soft px-4 text-sm font-semibold text-accent-text"
                  data-testid="chat-action"
                  data-action="drill"
                  data-ai=""
                >
                  <Icon name="target" size={16} />
                  {t('nbProfilDrillOffer')}
                </button>
                <button
                  type="button"
                  onClick={() => action('practice')}
                  className="inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full bg-accent-soft px-4 text-sm font-semibold text-accent-text"
                  data-testid="chat-action"
                  data-action="practice"
                >
                  <Icon name="arrowRight" size={16} />
                  {seeing?.area === 'trainer' ? t('cmpActBack') : t('cmpActPractice')}
                </button>
                <button
                  type="button"
                  onClick={() => action('preply')}
                  className="inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full bg-accent-soft px-4 text-sm font-semibold text-accent-text"
                  data-testid="chat-action"
                  data-action="preply"
                >
                  <Icon name="book" size={16} />
                  {t('cmpActPreply')}
                </button>
              </>
            )}
          </div>
        )}
        {ai || running ? (
          <Composer running={running} onSend={send} onStop={stopTurn} prefill={s.prefill?.tab === 'chat' ? s.prefill : null} focusSeq={focusSeq} />
        ) : (
          <p className="text-sm text-muted" data-testid="chat-unavailable">
            {t('aiUnavailable')}
          </p>
        )}
      </div>
    </div>
  );
}
