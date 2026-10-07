import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { useNav } from '../../app/nav';
import { acceptListenAll, type ListenItem } from '../../domain/apply/listenQ';
import { usesChunk } from '../../domain/text/chunkMatch';
import { normText } from '../../domain/text/normText';
import { Choices } from '../../engine/Choices';
import { EnglishText } from '../../engine/EnglishText';
import { useT } from '../../i18n';
import { useInputProfile } from '../../platform/input';
import { speak, stopSpeech, unlockSpeech, useSpeech } from '../../platform/speech';
import { listenQ } from '../../prompts/listenQ';
import { AiRunPanel } from '../../ui/AiRunPanel';
import { Button } from '../../ui/Button';
import { SessionEnd } from '../../ui/SessionEnd';
import { ExerciseShell, type ShellFeedback, type ShellSecondary } from '../../ui/exercise';
import { ExerciseTop } from '../learn/ui';
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
  const [cloze, setCloze] = useState(false);
  const live = useInputProfile();
  const [touch] = useState(() => live === 'touch');
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
    // Ohne Ton (Lückenaufgabe) gibt es keine Hörwertung und keine Note.
    if (!cloze) setResults((l) => [...l, r]);
  };
  const next = () => {
    setPos((p) => p + 1);
    setCloze(false);
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
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cur, res]);

  const quoteIn = (text: string, quote: string): [string, string, string] | null => {
    const i = text.toLowerCase().indexOf(quote.toLowerCase());
    if (i >= 0) return [text.slice(0, i), text.slice(i, i + quote.length), text.slice(i + quote.length)];
    return normText(text).includes(normText(quote)) ? [text, '', ''] : null;
  };

  const phase: 'listen' | 'answer' | 'result' = res ? 'result' : heard > 0 || cloze ? 'answer' : 'listen';
  const noSound = () => {
    stopSpeech();
    setCloze(true);
    setSkipped((n) => n + 1);
  };
  const plays = t('fxLListenPlays', { n: Math.min(heard, LISTEN_PLAYS_MAX), max: LISTEN_PLAYS_MAX });
  const textBlock = (cur: ListenItem) => {
    const parts = quoteIn(cur.text, cur.quote);
    return parts ? (
      <p lang="en" className="lx-t-prompt" data-testid="listen-q-text">
        <EnglishText as="span" text={parts[0]} area="trainer" source={null} />
        <mark className="rounded bg-accent-soft px-0.5 text-fg" data-testid="listen-q-quote">
          {parts[1]}
        </mark>
        <EnglishText as="span" text={parts[2]} area="trainer" source={null} />
      </p>
    ) : (
      <EnglishText text={cur.text} area="trainer" source={null} className="lx-t-prompt" testId="listen-q-text" />
    );
  };
  const question = (cur: ListenItem) => (
    <p lang="en" className="font-medium" data-testid="listen-q-question">
      {cur.question}
    </p>
  );

  let promptNode: ReactNode = null;
  if (cur) {
    if (phase === 'listen') {
      promptNode = (
        <p className="lx-t-support text-muted" data-testid="listen-q-plays">
          {t('fxLListenHidden')} · {plays}
        </p>
      );
    } else if (phase === 'answer') {
      promptNode = (
        <div className="flex flex-col gap-3">
          {cloze && (
            <p lang="en" className="lx-t-prompt" data-testid="listen-q-cloze">
              {gapped(cur.text, cur.word)}
            </p>
          )}
          {question(cur)}
        </div>
      );
    } else {
      promptNode = (
        <div className="flex flex-col gap-3" data-testid="listen-q-result">
          {question(cur)}
          {textBlock(cur)}
        </div>
      );
    }
  }

  const secondary: ShellSecondary[] = [];
  if (phase === 'answer' && !cloze) secondary.push({ id: 'replay', label: t('fxLListenReplay', { n: Math.min(heard, LISTEN_PLAYS_MAX), max: LISTEN_PLAYS_MAX }), onClick: () => void play(), testId: 'listen-q-play', disabled: speaking || heard >= LISTEN_PLAYS_MAX });
  if (!cloze) secondary.push({ id: 'noSound', label: t('fxLNoSound'), onClick: noSound, testId: 'listen-q-nosound' });

  const fb: ShellFeedback | null =
    res && cur
      ? {
          verdict: res.ok ? 'ok' : 'wrong',
          explanation: { lines: [{ k: 'why', text: cur.why }], examples: [], mark: [], ai: true, source: 'fallback' },
          depth: 'full',
          auto: false,
        }
      : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="listen-q" data-state={finished ? 'done' : cur ? 'open' : 'loading'}>
      <ExerciseTop onClose={close} progress={items && !finished ? { n: pos + 1, total: items.length } : null} ctx="xtra" />
      {!tts || !ai || !words.length ? (
        <p className="lx-glass rounded-[var(--radius-card)] p-5 lx-t-support text-muted" data-testid="listen-q-unavailable">
          {t('apListenQUnavailable')}
        </p>
      ) : empty ? (
        <div className="lx-glass flex flex-col items-start gap-3 rounded-[var(--radius-card)] p-5" data-testid="listen-q-empty">
          <p className="lx-t-support text-muted">{t('apListenQEmpty')}</p>
          <Button variant="secondary" icon="refresh" onClick={() => { setEmpty(false); void load(); }}>
            {t('aiRetry')}
          </Button>
        </div>
      ) : !items ? (
        <AiRunPanel phase={ask.phase} error={ask.error} onStop={ask.stop} onRetry={() => void load()} />
      ) : finished ? (
        <>
          <SessionEnd right={results.filter((r) => r.ok).length} total={Math.max(1, items.length - skipped)} ms={Math.max(1, endedAt - startedAt)} next={{ label: t('lrBackToApply'), run: close }} />
          <p className="lx-t-meta text-subtle" data-testid="listen-q-endnotice">{t('apListenQEndNotice')}</p>
        </>
      ) : (
        cur && (
          <div data-testid="listen-q-item" data-id={cur.id} data-state={res ? (res.ok ? 'ok' : 'wrong') : cloze ? 'cloze' : heard ? 'asking' : 'listening'}>
            <ExerciseShell
              meta={{ ex: 'listen_q', id: cur.id, kind: cloze ? 'cloze' : 'listen' }}
              status={{ area: 'words', state: null, kindLabel: cloze ? t('fxLKindListenCloze') : t('fxLKindListen'), badge: touch ? t('fxLListenPhoneBadge') : null }}
              task={{ text: cloze ? t('fxLListenClozeTask') : t('apListenQTask'), purpose: t('apListenQPurpose') }}
              prompt={promptNode}
              answer={
                phase === 'listen' ? (
                  deviceFail ? (
                    <p className="lx-t-support text-muted" role="status" data-testid="listen-q-devicefail">
                      {t('apListenQDeviceHint')}
                    </p>
                  ) : null
                ) : (
                  <Choices options={cur.options} chosen={res ? res.picked : null} correct={res ? cur.answer : null} revealed={!!res} onPick={pick} lang="en" collapse={touch} label={cur.question} testId="listen-q-options" />
                )
              }
              hint={phase === 'listen' && touch && !deviceFail ? { text: t('fxLListenSoundOn'), tone: 'hint' } : null}
              secondary={secondary}
              primary={
                res
                  ? { label: t('exNext'), onClick: next, testId: 'listen-q-next' }
                  : { label: t('fxLListenPlay'), onClick: () => void play(), testId: 'listen-q-play', disabled: speaking || heard >= LISTEN_PLAYS_MAX || phase !== 'listen', busy: speaking, busyLabel: t('fxLListenPlaying') }
              }
              barOverride={!res && phase === 'answer' ? <span data-fxl-nobar="" /> : undefined}
              feedback={fb}
            />
          </div>
        )
      )}
    </div>
  );
}

/** Der Text mit einer Lücke an der ersten Stelle des Zielworts (auch gebeugt); ohne Treffer bleibt der Text ganz. */
export function gapped(text: string, word: string): string {
  const toks = text.split(/(\s+)/);
  const i = toks.findIndex((x) => x.trim() && usesChunk(x.replace(/[^\p{L}'’-]/gu, ''), word));
  if (i < 0) return text;
  const tok = toks[i] ?? '';
  return toks.map((x, k) => (k === i ? tok.replace(/[\p{L}'’-]+/u, '____') : x)).join('');
}
