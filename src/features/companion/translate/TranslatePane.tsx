import { useEffect, useRef, type KeyboardEvent } from 'react';
import { useAiAvailable } from '../../../ai/scope';
import { EnglishText } from '../../../engine/EnglishText';
import { useT, type MessageKey } from '../../../i18n';
import { speak, unlockSpeech, useSpeech } from '../../../platform/speech';
import { TRANSLATE_MAX, type Register } from '../../../prompts/translate';
import { IconButton } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { CopyButton } from '../../preply/CopyBox';
import { useCompanion } from '../store';
import { fillFromHistory, fromOf, isTranslating, runTranslate, setRegister, setTranslateText, stopTranslate, swapDirection, useTranslate } from './store';

// Übersetzer im Begleiter (Phase 5 §8.2, Kap. 6.12): Eingabe, Richtung ⇄, Ton (Formell/Neutral/
// Locker), „Übersetzen". Ergebnis: Hauptfassung (englisch antippbar, 🔊, Kopieren), Alternativen mit
// Ton-Chip, Hinweise, Begriffe. Verlauf der letzten 5 lokal. Englische Wörter lassen sich über
// das Wort-Antippen als Karte speichern (`src: 'translate'`, Ursprungssatz = Übersetzung).

const REG_KEY: Record<Register, MessageKey> = { formal: 'tlRegFormal', neutral: 'tlRegNeutral', casual: 'tlRegCasual' };

const short = (s: string, max = 70): string => (Array.from(s).length <= max ? s : `${Array.from(s).slice(0, max - 1).join('')}…`);

export function TranslatePane({ focusSeq }: { focusSeq: number }) {
  const { t, lang } = useT();
  const s = useTranslate();
  const ai = useAiAvailable();
  const speech = useSpeech((x) => x.status);
  const prefill = useCompanion((c) => (c.prefill?.tab === 'translate' ? c.prefill : null));
  const input = useRef<HTMLTextAreaElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const from = fromOf(s);
  const to = from === 'de' ? 'en' : 'de';
  const busy = isTranslating();

  useEffect(() => {
    if (focusSeq > 0) input.current?.focus({ preventScroll: true });
  }, [focusSeq]);

  useEffect(() => {
    if (!prefill) return;
    setTranslateText(prefill.text);
    input.current?.focus();
  }, [prefill]);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    e.preventDefault();
    void runTranslate();
  };

  const r = s.result;
  const resultIsEn = r ? r.from === 'de' : false;
  const langName = (l: 'de' | 'en') => (l === 'en' ? t('cmpLangEn') : t('cmpLangDe'));
  const english = (text: string, testId?: string) => <EnglishText as="span" text={text} area="translate" source={null} title={null} {...(testId ? { testId } : {})} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
      <div className="mx-auto flex w-full max-w-[48rem] flex-col gap-4 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={swapDirection}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold hover:bg-surface"
            data-testid="tr-dir"
            data-dir={`${from}-${to}`}
            aria-label={`${t('tlDirLabel')}: ${t('tlFromTo', { from: langName(from), to: langName(to) })}. ${t('tlSwap')}`}
          >
            {t('tlFromTo', { from: langName(from), to: langName(to) })}
            <Icon name="refresh" size={16} />
          </button>
          <div role="radiogroup" aria-label={t('tlRegister')} className="flex rounded-[var(--radius-control)] bg-track p-1" data-testid="tr-register">
            {(['formal', 'neutral', 'casual'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={s.register === v}
                onClick={() => setRegister(v)}
                className={`min-h-9 rounded-[calc(var(--radius-control)-4px)] px-3 text-sm ${s.register === v ? 'bg-surface-solid font-semibold text-fg shadow-sm' : 'font-medium text-muted hover:text-fg'}`}
                data-value={v}
              >
                {t(REG_KEY[v])}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tr-input" className="sr-only">
            {t('tlInputLabel')}
          </label>
          <textarea
            id="tr-input"
            ref={input}
            value={s.text}
            onChange={(e) => setTranslateText(e.target.value)}
            onKeyDown={onKey}
            rows={4}
            maxLength={TRANSLATE_MAX}
            placeholder={t('tlPlaceholder')}
            className="w-full resize-y rounded-2xl border border-line bg-surface-solid px-4 py-3 text-base leading-relaxed text-fg outline-none placeholder:text-subtle focus:border-[var(--lx-fg-subtle)]"
            data-testid="tr-input"
            lang={from}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="lx-tnum text-xs text-subtle" data-testid="tr-count">
              {t('tlCount', { n: s.text.length, max: TRANSLATE_MAX })}
            </span>
            {ai &&
              (busy ? (
                <button type="button" onClick={stopTranslate} className="inline-flex min-h-11 items-center rounded-xl bg-surface-strong px-4 text-sm font-semibold" data-testid="ai-stop">
                  {t('aiStop')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void runTranslate()}
                  disabled={!s.text.trim()}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-40"
                  data-testid="tr-go"
                  data-ai=""
                >
                  {t('tlGo')}
                </button>
              ))}
          </div>
        </div>

        {busy && (
          <p className="text-sm text-muted" role="status" data-testid="ai-phase" data-ai-phase={s.phase}>
            {s.phase === 'slow' ? t('aiSlow') : s.phase === 'queued' ? t('aiQueued') : t('aiThinking')}
          </p>
        )}
        {s.phase === 'error' && s.error && (
          <div className="flex flex-wrap items-center gap-3" role="alert">
            <p className="text-sm text-danger-text">{t(s.error)}</p>
            {s.errorKind !== 'unavailable' && (
              <button type="button" onClick={() => void runTranslate({ refresh: s.errorKind === 'invalid' })} className="min-h-11 text-sm font-semibold text-accent-text hover:underline" data-testid="ai-retry" data-ai="">
                {t('aiRetry')}
              </button>
            )}
          </div>
        )}

        {r && !busy && (
          <section className="flex flex-col gap-4" data-testid="tr-result" aria-label={t('tlResult')}>
            <div className="flex flex-col gap-2 rounded-2xl bg-surface px-4 py-3" data-testid="tr-main" lang={resultIsEn ? 'en' : 'de'}>
              <div ref={mainRef} className="text-lg leading-relaxed font-medium whitespace-pre-line">
                {resultIsEn ? english(r.translation) : r.translation}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-text">{t(REG_KEY[r.register])}</span>
                {resultIsEn && speech === 'ready' && (
                  <IconButton
                    icon="speaker"
                    label={t('tlListen')}
                    onClick={() => {
                      unlockSpeech();
                      void speak(r.translation);
                    }}
                    data-testid="tr-listen"
                  />
                )}
                <CopyButton text={r.translation} target={() => mainRef.current} testId="tr-copy" />
              </div>
            </div>
            {r.alternatives.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="lx-eyebrow">{t('tlAlternatives')}</p>
                <ul className="flex flex-col gap-2">
                  {r.alternatives.map((a, i) => (
                    <li key={i} className="flex flex-col gap-1 rounded-xl border border-line px-3 py-2" data-testid="tr-alt" data-register={a.register} lang={resultIsEn ? 'en' : 'de'}>
                      <span className="text-[0.95rem] leading-relaxed">{resultIsEn ? english(a.text) : a.text}</span>
                      <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className="rounded-full bg-surface-strong px-2 py-0.5 font-semibold">{t(REG_KEY[a.register])}</span>
                        {a.note && <span lang={lang}>{a.note}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {r.notes.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="lx-eyebrow">{t('tlNotes')}</p>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed">
                  {r.notes.map((n, i) => (
                    <li key={i} data-testid="tr-note" lang={lang}>
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {r.terms.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="lx-eyebrow">{t('tlTerms')}</p>
                <ul className="flex flex-wrap gap-2">
                  {r.terms.map((x, i) => (
                    <li key={i} className="rounded-full border border-line px-3 py-1 text-sm" data-testid="tr-term">
                      {english(x.en)}
                      <span className="text-muted" lang="de">
                        {' '}
                        – {x.de}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {s.history.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-line pt-4" data-testid="tr-history">
            <p className="lx-eyebrow">{t('tlHistory')}</p>
            <ul className="flex flex-col">
              {s.history.slice(0, 5).map((h) => (
                <li key={`${h.t}`}>
                  <button type="button" onClick={() => fillFromHistory(h)} className="flex min-h-11 w-full min-w-0 flex-col justify-center rounded-lg px-2 py-1.5 text-left text-sm break-words hover:bg-surface">
                    <span className="text-fg">{short(h.text)}</span>
                    <span className="text-muted">→ {short(h.main)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
