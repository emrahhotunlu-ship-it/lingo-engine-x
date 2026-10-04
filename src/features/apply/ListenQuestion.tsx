import { useEffect, useMemo, useRef, useState } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { useNav } from '../../app/nav';
import { acceptListenAll, type ListenItem } from '../../domain/apply/listenQ';
import { normText } from '../../domain/text/normText';
import { EnglishText } from '../../engine/EnglishText';
import { useT } from '../../i18n';
import { speak, stopSpeech, unlockSpeech, useSpeech } from '../../platform/speech';
import { listenQ } from '../../prompts/listenQ';
import { AiRunPanel } from '../../ui/AiRunPanel';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { SessionEnd } from '../../ui/SessionEnd';
import { ExerciseTop, TaskLine } from '../learn/ui';
import { useVocabCards } from '../vocab/hub/data';

// Hörübung mit Frage (Anwenden, Stufe 2, Übung 3; Plan docs/umbau/anwenden-plan.md). Die Sprachausgabe liest einen
// kurzen Text mit einem Wort aus Emrahs Wortschatz vor, der Text bleibt verdeckt, danach eine Frage mit drei Antworten.
// Nach der Antwort: der Text mit der Belegstelle und ein Satz Grund. Freiwillig: schreibt nichts (keine Karten, keine
// FSRS-Termine, keine Note) – das ist Hören mit Sprachausgabe, keine Messung echter Hörfähigkeit. Hörfehler des Geräts
// zählen nie als Fehler. Von Claude geschrieben, nur formal geprüft: gekennzeichnet.

export const LISTEN_PLAYS_MAX = 3;
const ITEMS_ASKED = 3;

type Result = { picked: number; ok: boolean };

/** Wörter für die Texte: die schwächsten bekannten Karten zuerst, höchstens 8. */
export function pickListenWords(cards: ReturnType<typeof useVocabCards>): string[] {
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return cards
    .filter((c) => !c.hidden && !c.isNew && c.word.trim() && c.word.trim().split(/\s+/).length <= 3)
    .sort((a, b) => num(b.doc.lapses) - num(a.doc.lapses) || a.stage - b.stage || (a.key < b.key ? -1 : 1))
    .slice(0, 8)
    .map((c) => c.word.trim());
}

export function ListenQuestionScreen() {
  const { t, lang } = useT();
  const back = useNav((s) => s.back);
  const ai = useAiAvailable();
  const tts = useSpeech((s) => s.status === 'ready');
  const cards = useVocabCards();
  const ask = useAsk(listenQ);
  const [items, setItems] = useState<ListenItem[] | null>(null);
  const [empty, setEmpty] = useState(false);
  const [pos, setPos] = useState(0);
  const [heard, setHeard] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [deviceFail, setDeviceFail] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const [res, setRes] = useState<Result | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [startedAt] = useState(() => performance.now());
  const [endedAt, setEndedAt] = useState(0);
  const words = useMemo(() => pickListenWords(cards), [cards]);
  const started = useRef(false);

  const load = async () => {
    const out = await ask.run({ words, avoid: [], n: ITEMS_ASKED, uiLang: lang });
    if (!out) return;
    const ok = acceptListenAll(out.items, lang);
    if (ok.length) setItems(ok);
    else setEmpty(true);
  };
  // Der Tipp auf die Kachel ist die Handlung; hier genau ein Aufruf beim Öffnen.
  useEffect(() => {
    if (started.current || !ai || !words.length) return;
    started.current = true;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai, words.length]);
  useEffect(() => () => stopSpeech(), []);

  const close = () => {
    stopSpeech();
    back();
  };
  const cur = items?.[pos] ?? null;
  const finished = !!items && pos >= items.length;

  const play = async () => {
    if (!cur || speaking || heard >= LISTEN_PLAYS_MAX) return;
    unlockSpeech();
    setSpeaking(true);
    const o = await speak(cur.text);
    setSpeaking(false);
    // Nur ein vollständiges Vorlesen zählt; Geräteprobleme verbrauchen keinen Versuch.
    if (o === 'done') {
      setHeard((h) => h + 1);
      setDeviceFail(false);
    } else if (o === 'error' || o === 'unavailable') setDeviceFail(true);
  };
  const pick = (i: number) => {
    if (!cur || res) return;
    stopSpeech();
    const r = { picked: i, ok: i === cur.answer };
    setRes(r);
    setResults((l) => [...l, r]);
  };
  const skip = () => {
    setSkipped((n) => n + 1);
    next();
  };
  const next = () => {
    setPos((p) => p + 1);
    setHeard(0);
    setRes(null);
    setDeviceFail(false);
    setEndedAt(performance.now());
  };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (!cur || ev.metaKey || ev.ctrlKey || ev.altKey || (ev.target as HTMLElement | null)?.tagName === 'BUTTON') return;
      if (res && ev.key === 'Enter') {
        ev.preventDefault();
        next();
      } else if (!res && heard > 0 && ['1', '2', '3'].includes(ev.key)) pick(Number(ev.key) - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, res, heard]);

  const quoteIn = (text: string, quote: string): [string, string, string] | null => {
    const i = text.toLowerCase().indexOf(quote.toLowerCase());
    if (i >= 0) return [text.slice(0, i), text.slice(i, i + quote.length), text.slice(i + quote.length)];
    return normText(text).includes(normText(quote)) ? [text, '', ''] : null;
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="listen-q" data-state={finished ? 'done' : cur ? 'open' : 'loading'}>
      <ExerciseTop onClose={close} progress={items && !finished ? { n: pos + 1, total: items.length } : null} ctx="xtra" />
      {!tts || !ai || !words.length ? (
        <p className="lx-glass rounded-[var(--radius-card)] p-5 text-sm text-muted" data-testid="listen-q-unavailable">
          {t('apListenQUnavailable')}
        </p>
      ) : empty ? (
        <div className="lx-glass flex flex-col items-start gap-3 rounded-[var(--radius-card)] p-5" data-testid="listen-q-empty">
          <p className="text-sm text-muted">{t('apListenQEmpty')}</p>
          <Button variant="secondary" icon="refresh" onClick={() => { setEmpty(false); void load(); }}>
            {t('aiRetry')}
          </Button>
        </div>
      ) : !items ? (
        <AiRunPanel phase={ask.phase} error={ask.error} onStop={ask.stop} onRetry={() => void load()} />
      ) : finished ? (
        <>
        <SessionEnd right={results.filter((r) => r.ok).length} total={Math.max(1, items.length - skipped)} ms={Math.max(1, endedAt - startedAt)} next={{ label: t('lrBackToApply'), run: close }} />
        <p className="text-xs text-subtle" data-testid="listen-q-endnotice">{t('apListenQEndNotice')}</p>
        </>
      ) : (
        cur && (
          <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="listen-q-item" data-id={cur.id} data-state={res ? (res.ok ? 'ok' : 'wrong') : heard ? 'asking' : 'listening'}>
            <TaskLine task={t('apListenQTask')} purpose={t('apListenQPurpose')} />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" icon={speaking ? 'speaker' : 'play'} disabled={speaking || heard >= LISTEN_PLAYS_MAX} onClick={() => void play()} data-testid="listen-q-play">
                {heard === 0 ? t('apListenQPlay') : t('apListenQAgain')}
              </Button>
              <span className="lx-tnum text-sm text-muted" data-testid="listen-q-plays">
                {t('apListenQPlays', { n: Math.min(heard, LISTEN_PLAYS_MAX), max: LISTEN_PLAYS_MAX })}
              </span>
            </div>
            {deviceFail && !res && heard === 0 && (
              <div className="flex flex-wrap items-center gap-3" data-testid="listen-q-devicefail">
                <p className="text-sm text-muted" role="status">
                  {t('apListenQDeviceHint')}
                </p>
                <Button variant="secondary" onClick={skip} data-testid="listen-q-skip">
                  {t('apListenQSkip')}
                </Button>
              </div>
            )}
            {(heard > 0 || res) && (
              <div className="flex flex-col gap-3">
                <p className="text-base font-medium" lang="en" data-testid="listen-q-question">
                  {cur.question}
                </p>
                <ul className="flex flex-col gap-2">
                  {cur.options.map((o, i) => {
                    const right = !!res && i === cur.answer;
                    const wrong = !!res && res.picked === i && !res.ok;
                    return (
                      <li key={o}>
                        <button
                          type="button"
                          disabled={!!res}
                          onClick={() => pick(i)}
                          lang="en"
                          data-testid="listen-q-option"
                          data-right={right ? 'true' : undefined}
                          className={`flex min-h-12 w-full items-center gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-left text-base ${right ? 'border-accent bg-accent-soft' : wrong ? 'border-danger' : 'border-line'}`}
                        >
                          {right && <Icon name="check" size={16} className="flex-none text-accent-text" />}
                          {wrong && <Icon name="close" size={16} className="flex-none text-danger-text" />}
                          <span>{o}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {res && (
              <div className="flex flex-col gap-3 border-t border-line pt-4" data-testid="listen-q-result">
                <p className={`text-base font-semibold ${res.ok ? 'text-accent-text' : 'text-danger-text'}`} role="status">
                  {res.ok ? t('apListenQRight') : t('apListenQWrong')}
                </p>
                <div className="flex flex-col gap-1 rounded-xl bg-surface px-3 py-2">
                  <p className="text-sm text-muted">{t('apListenQText')}</p>
                  {(() => {
                    const parts = quoteIn(cur.text, cur.quote);
                    return parts ? (
                      <p lang="en" className="text-base leading-relaxed" data-testid="listen-q-text">
                        <EnglishText as="span" text={parts[0]} area="trainer" source={null} />
                        <mark className="rounded bg-accent-soft px-0.5 text-fg" data-testid="listen-q-quote">
                          {parts[1]}
                        </mark>
                        <EnglishText as="span" text={parts[2]} area="trainer" source={null} />
                      </p>
                    ) : (
                      <EnglishText text={cur.text} area="trainer" source={null} className="text-base leading-relaxed" testId="listen-q-text" />
                    );
                  })()}
                </div>
                <p className="text-sm text-muted" data-testid="listen-q-why">
                  {t('rxWhy')}: {cur.why}
                </p>
                <p className="text-xs text-subtle">{t('apListenQNotice')}</p>
                <div>
                  <Button variant="primary" iconAfter="arrowRight" onClick={next} data-testid="listen-q-next">
                    {t('rxNext')}
                  </Button>
                </div>
              </div>
            )}
          </article>
        )
      )}
    </div>
  );
}
