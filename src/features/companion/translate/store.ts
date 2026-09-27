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
  /** Übersetzung, soweit sie beim Streamen schon da ist (nur Anzeige). */
  partial: string;
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
  partial: '',
}));

/** Pure: Wert von `"translation"` aus einer unfertigen JSON-Antwort (beim Streamen). */
export function partialTranslation(raw: string): string {
  const m = /"translation"\s*:\s*"/.exec(raw);
  if (!m) return '';
  let out = '';
  for (let i = m.index + m[0].length; i < raw.length; i++) {
    const ch = raw[i]!;
    if (ch === '\\') {
      const nx = raw[i + 1];
      if (nx === undefined) break;
      out += nx === 'n' ? '\n' : nx === 't' ? ' ' : nx;
      i++;
      continue;
    }
    if (ch === '"') break;
    out += ch;
  }
  return out.trim();
}

export type TranslateCard = { word: string; de: string; ex: string };

/**
 * Pure: Karte aus einem Übersetzungsergebnis (Funktion der alten App „in den Vokabeltrainer“) –
 * nur bei einem Wort oder einer kurzen Wendung (≤ 4 Wörter) und mit englischem Beispielsatz.
 */
export function cardFromResult(r: Pick<TranslateOut, 'translation' | 'example'> & { from: TransLang; text: string }): TranslateCard | null {
  const clean = (x: string) => x.trim().replace(/^["'„“”‚‘’]+|["'„“”‚‘’.!?;:,]+$/g, '').trim();
  const en = clean(r.from === 'en' ? r.text : r.translation);
  const de = clean(r.from === 'en' ? r.translation : r.text);
  const words = (x: string) => x.split(/\s+/).filter(Boolean).length;
  const ex = r.example?.trim() ?? '';
  if (!en || !de || !ex || words(r.text) > 4 || words(en) > 5 || /\n/.test(en)) return null;
  // „Keep up“ → „keep up“; Eigennamen (im Beispielsatz nur großgeschrieben) bleiben.
  const lower = en[0]!.toLowerCase() + en.slice(1);
  const word = /^[A-Z][a-z]/.test(en) && (ex.includes(lower) || !ex.includes(en)) ? lower : en;
  return { word, de, ex };
}

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
  useTranslate.setState({ phase: 'queued', error: null, errorKind: null, result: null, partial: '' });
  try {
    const r = await askJson({
      template: translate,
      vars: { text, from, register: s.register, uiLang },
      signal: c.signal,
      ...(opts.refresh ? { refresh: true } : {}),
      onPartial: (raw) => {
        if (ctl !== c) return;
        const p = partialTranslation(raw);
        if (p !== useTranslate.getState().partial) useTranslate.setState({ partial: p });
      },
      onPhase: (p) => {
        if (ctl === c && p !== 'done' && p !== 'error') useTranslate.setState({ phase: p });
      },
    });
    if (ctl !== c) return;
    // W1: Claudes Angabe gilt auch bei fester Richtung (Englisch bei „DE → EN“ getippt).
    const src: TransLang = r.data.source ?? (from === 'auto' ? fromOf(s) : from);
    const history = pushHistory({ t: Date.now(), text, dir: src, reg: s.register, main: r.data.translation });
    useTranslate.setState({ phase: 'done', result: { ...r.data, from: src, text }, history, partial: '' });
  } catch (err) {
    if (ctl !== c) return;
    if (isAiFailure(err) && err.kind === 'cancelled') {
      useTranslate.setState({ phase: 'idle', partial: '' });
      return;
    }
    if (!isAiFailure(err)) logWarn('translate:run', err);
    useTranslate.setState({
      phase: 'error',
      partial: '',
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
