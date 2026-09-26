import { create } from 'zustand';
import { logWarn } from './diagnostics';
import { KEY_PREFIX, local } from './storage';

// Spracheingabe (Plan D5, §7): einziger Zugriff auf `SpeechRecognition`. `contract/` kennt keine
// Mikrofon-Fähigkeit – im eingebetteten claude.ai-iframe ist das Mikrofon ungewiss. Deshalb:
// - Knopf nur, wenn die Schnittstelle existiert, die Permissions-Policy nicht dagegen spricht und
//   kein früherer Start in diesem Browser gescheitert ist (`lx:stt-blocked`),
// - scheitert ein Start (not-allowed, service-not-allowed, audio-capture, Wurf bei start()),
//   verschwindet der Knopf sofort und dauerhaft,
// - das Ergebnis landet immer im Textfeld, nie wird automatisch gesendet.

export type SttStatus = 'unknown' | 'available' | 'blocked' | 'unsupported';

type SttState = { status: SttStatus; listening: boolean; interim: string };

export const useStt = create<SttState>(() => ({ status: 'unknown', listening: false, interim: '' }));

export const STT_BLOCKED_KEY = `${KEY_PREFIX}stt-blocked`;
const BLOCKING = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

type RecResultList = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives?: number;
  onresult: ((ev: { results: RecResultList; resultIndex?: number }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionCtor = new () => RecognitionLike;

function ctor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  const c = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return typeof c === 'function' ? (c as RecognitionCtor) : null;
}

/** Erlaubt die Permissions-Policy das Mikrofon? `null` = nicht abfragbar. */
function policyAllows(): boolean | null {
  try {
    const d = document as unknown as {
      permissionsPolicy?: { allowsFeature(f: string): boolean };
      featurePolicy?: { allowsFeature(f: string): boolean };
    };
    const p = d.permissionsPolicy ?? d.featurePolicy;
    return p ? p.allowsFeature('microphone') : null;
  } catch (err) {
    logWarn('stt:policy', err);
    return null;
  }
}

/** Erkennung ohne Mikrofonzugriff (fragt nichts, startet nichts). */
export function initStt(): SttStatus {
  let status: SttStatus;
  if (!ctor()) status = 'unsupported';
  else if (local.get(STT_BLOCKED_KEY)) status = 'blocked';
  else if (policyAllows() === false) status = 'blocked';
  else status = 'available';
  useStt.setState({ status });
  return status;
}

function markBlocked(reason: string): void {
  local.set(STT_BLOCKED_KEY, String(Date.now()));
  useStt.setState({ status: 'blocked', listening: false, interim: '' });
  logWarn('stt:blocked', { code: reason, message: 'speech input unavailable in this view' });
}

export type ListenResult = { text: string } | { error: 'blocked' | 'no-speech' | 'aborted' | 'failed' };

/**
 * Einmal zuhören (nur auf einen Klick hin). Löst mit dem erkannten Text oder einem Fehler auf,
 * nie mit einer Ablehnung.
 */
export function listen(opts: { lang: 'en-US'; onInterim?: (t: string) => void; signal: AbortSignal }): Promise<ListenResult> {
  const C = ctor();
  if (!C || useStt.getState().status !== 'available') return Promise.resolve({ error: 'blocked' });
  return new Promise<ListenResult>((resolve) => {
    let done = false;
    let finalText = '';
    let lastInterim = '';
    let rec: RecognitionLike;
    const finish = (r: ListenResult) => {
      if (done) return;
      done = true;
      opts.signal.removeEventListener('abort', onAbort);
      if (useStt.getState().status === 'available') useStt.setState({ listening: false, interim: '' });
      resolve(r);
    };
    const onAbort = () => {
      try {
        rec.abort();
      } catch (err) {
        logWarn('stt:abort', err);
      }
      finish({ error: 'aborted' });
    };
    try {
      rec = new C();
      rec.lang = opts.lang;
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      rec.onresult = (ev) => {
        let interim = '';
        let fin = '';
        for (let i = 0; i < ev.results.length; i++) {
          const r = ev.results[i];
          const t = r?.[0]?.transcript ?? '';
          if (r?.isFinal) fin += t;
          else interim += t;
        }
        if (fin) finalText = fin.trim();
        lastInterim = interim.trim();
        const shown = (finalText + ' ' + lastInterim).trim();
        useStt.setState({ interim: shown });
        opts.onInterim?.(shown);
      };
      rec.onerror = (ev) => {
        const code = ev?.error ?? 'unknown';
        if (BLOCKING.has(code)) {
          markBlocked(code);
          finish({ error: 'blocked' });
        } else if (code === 'no-speech') {
          logWarn('stt:no-speech', { code, message: 'nothing heard' });
          finish({ error: 'no-speech' });
        } else if (code === 'aborted') finish({ error: 'aborted' });
        else {
          logWarn('stt:error', { code, message: 'recognition failed' });
          finish({ error: 'failed' });
        }
      };
      rec.onend = () => {
        const text = (finalText || lastInterim).trim();
        finish(text ? { text } : { error: 'no-speech' });
      };
      opts.signal.addEventListener('abort', onAbort, { once: true });
      if (opts.signal.aborted) {
        onAbort();
        return;
      }
      useStt.setState({ listening: true, interim: '' });
      rec.start();
    } catch (err) {
      logWarn('stt:start', err);
      markBlocked('start_failed');
      finish({ error: 'blocked' });
    }
  });
}

/** Nur für Tests. */
export function resetStt(): void {
  useStt.setState({ status: 'unknown', listening: false, interim: '' });
}
