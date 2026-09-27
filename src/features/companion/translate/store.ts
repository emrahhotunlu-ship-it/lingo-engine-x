import { create } from 'zustand';
import { askJson } from '../../../ai/gate';
import { isAiFailure, type AiMessageKey, type AiPhase } from '../../../ai/types';
import { useSettings } from '../../../app/settings';
import { detectLang } from '../../../domain/lang/detect';
import { isDictWord } from '../../../domain/lexicon/dict';
import { logWarn } from '../../../platform/diagnostics';
import { translate, TRANSLATE_MAX, type Register, type TransLang, type TranslateFrom, type TranslateOut } from '../../../prompts/translate';
import { pushHistory, readHistory, type HistoryEntry } from './history';

// Zustand des Übersetzers (Phase 5 §3.3/§8.2). Ein Aufruf je „Übersetzen" (ausdrückliche Handlung).
// Richtung: „Automatisch“ (Standard) oder fest DE → EN / EN → DE. Automatisch erkennt die App
// eindeutige Texte selbst; ist sie unsicher (kurze Wendungen), bestimmt Claude die Sprache. Der Aufruf lebt im Store: Reiterwechsel bricht ihn nicht ab.

type Phase = AiPhase | 'idle';

type State = {
  text: string;
  /** `null` = automatisch aus dem Text. */
  dirOverride: TransLang | null;
  register: Register;
  phase: Phase;
  result: (TranslateOut & { from: TransLang; text: string }) | null;
  error: AiMessageKey | null;
  errorKind: string | null;
  history: HistoryEntry[];
};

export const useTranslate = create<State>(() => ({
  text: '',
  dirOverride: null,
  register: 'neutral',
  phase: 'idle',
  result: null,
  error: null,
  errorKind: null,
  history: readHistory(),
}));

let ctl: AbortController | null = null;

/**
 * Ausgangssprache: gewählt oder erkannt. Kurze Texte ohne Funktionswörter („Keep up“) erkennt
 * `detectLang` nicht; dann entscheidet das englische Wörterbuch: ohne Umlaut und überwiegend
 * bekannte englische Wörter → Englisch, sonst Deutsch.
 */
export function fromOf(s: Pick<State, 'text' | 'dirOverride'>): TransLang {
  if (s.dirOverride) return s.dirOverride;
  const got = detectLang(s.text);
  if (got !== 'unknown') return got;
  if (/[äöüÄÖÜß]/.test(s.text)) return 'de';
  const words = s.text.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) ?? [];
  const en = words.filter((w) => isDictWord(w)).length;
  return words.length > 0 && en * 2 > words.length ? 'en' : 'de';
}

export function setTranslateText(text: string): void {
  useTranslate.setState({ text: text.slice(0, TRANSLATE_MAX) });
}

/** Was an Claude geht: feste Wahl, eindeutige Erkennung oder `auto`. */
export function requestFrom(s: Pick<State, 'text' | 'dirOverride'>): TranslateFrom {
  if (s.dirOverride) return s.dirOverride;
  const got = detectLang(s.text);
  return got === 'unknown' ? 'auto' : got;
}

/** Richtung wählen: `null` = automatisch. */
export function setDirection(dir: TransLang | null): void {
  useTranslate.setState({ dirOverride: dir, result: null, phase: 'idle', error: null });
}

/**
 * Ton wählen. Steht schon ein Ergebnis für denselben Text da, wird es im neuen Ton neu übersetzt
 * (ein Aufruf auf diesen Klick) – sonst passte das angezeigte Ergebnis nicht mehr zur Auswahl.
 */
export function setRegister(register: Register): void {
  const s = useTranslate.getState();
  if (s.register === register) return;
  useTranslate.setState({ register });
  if (s.result && !isTranslating() && s.result.text === s.text.trim()) void runTranslate();
}

export function isTranslating(): boolean {
  const p = useTranslate.getState().phase;
  return p === 'queued' || p === 'thinking' || p === 'streaming' || p === 'slow';
}

export async function runTranslate(opts: { refresh?: boolean } = {}): Promise<void> {
  const s = useTranslate.getState();
  const text = s.text.trim();
  if (!text || isTranslating()) return;
  const from = requestFrom(s);
  const uiLang = useSettings.getState().lang;
  ctl?.abort();
  const c = new AbortController();
  ctl = c;
  useTranslate.setState({ phase: 'queued', error: null, errorKind: null, result: null });
  try {
    const r = await askJson({
      template: translate,
      vars: { text, from, register: s.register, uiLang },
      signal: c.signal,
      ...(opts.refresh ? { refresh: true } : {}),
      onPhase: (p) => {
        if (ctl === c && p !== 'done' && p !== 'error') useTranslate.setState({ phase: p });
      },
    });
    if (ctl !== c) return;
    const src: TransLang = from === 'auto' ? (r.data.source ?? fromOf(s)) : from;
    const history = pushHistory({ t: Date.now(), text, dir: src, reg: s.register, main: r.data.translation });
    useTranslate.setState({ phase: 'done', result: { ...r.data, from: src, text }, history });
  } catch (err) {
    if (ctl !== c) return;
    if (isAiFailure(err) && err.kind === 'cancelled') {
      useTranslate.setState({ phase: 'idle' });
      return;
    }
    if (!isAiFailure(err)) logWarn('translate:run', err);
    useTranslate.setState({
      phase: 'error',
      error: isAiFailure(err) ? (err.messageKey ?? 'aiFailed') : 'aiFailed',
      errorKind: isAiFailure(err) ? err.kind : 'failed',
    });
  } finally {
    if (ctl === c) ctl = null;
  }
}

export function stopTranslate(): void {
  ctl?.abort();
}

export function fillFromHistory(e: HistoryEntry): void {
  useTranslate.setState({ text: e.text, dirOverride: null, register: e.reg, result: null, phase: 'idle', error: null });
}
