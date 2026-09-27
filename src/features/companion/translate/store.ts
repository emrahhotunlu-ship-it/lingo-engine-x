import { create } from 'zustand';
import { askJson } from '../../../ai/gate';
import { isAiFailure, type AiMessageKey, type AiPhase } from '../../../ai/types';
import { useSettings } from '../../../app/settings';
import { detectLang } from '../../../domain/lang/detect';
import { isDictWord } from '../../../domain/lexicon/dict';
import { logWarn } from '../../../platform/diagnostics';
import { translate, TRANSLATE_MAX, type Register, type TransLang, type TranslateOut } from '../../../prompts/translate';
import { pushHistory, readHistory, type HistoryEntry } from './history';

// Zustand des Übersetzers (Phase 5 §3.3/§8.2). Ein Aufruf je „Übersetzen" (ausdrückliche Handlung).
// Die Richtung schlägt die Spracherkennung vor (`unknown` → Deutsch → Englisch); der Umschalter
// überschreibt sie. Der Aufruf lebt im Store: Reiterwechsel bricht ihn nicht ab.

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

export function swapDirection(): void {
  const s = useTranslate.getState();
  useTranslate.setState({ dirOverride: fromOf(s) === 'de' ? 'en' : 'de' });
}

export function setRegister(register: Register): void {
  useTranslate.setState({ register });
}

export function isTranslating(): boolean {
  const p = useTranslate.getState().phase;
  return p === 'queued' || p === 'thinking' || p === 'streaming' || p === 'slow';
}

export async function runTranslate(opts: { refresh?: boolean } = {}): Promise<void> {
  const s = useTranslate.getState();
  const text = s.text.trim();
  if (!text || isTranslating()) return;
  const from = fromOf(s);
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
    const history = pushHistory({ t: Date.now(), text, dir: from, reg: s.register, main: r.data.translation });
    useTranslate.setState({ phase: 'done', result: { ...r.data, from, text }, history });
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
  useTranslate.setState({ text: e.text, dirOverride: e.dir, register: e.reg, result: null, phase: 'idle', error: null });
}
