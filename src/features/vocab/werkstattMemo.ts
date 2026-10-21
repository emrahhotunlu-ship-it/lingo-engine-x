import { create } from 'zustand';
import { askJson } from '../../ai/gate';
import { selectAiAvailable } from '../../ai/scope';
import { takeTutorCall, tutorLeft } from '../../ai/tutorBudget';
import { AiFailure } from '../../ai/types';
import { getWriter } from '../../data';
import { useLive } from '../../data/live';
import { dayKey } from '../../domain/date';
import { meaningOf } from '../../domain/srs/cards';
import type { Diagnosis } from '../../domain/srs/werkstatt';
import type { Lang, TrainCard } from '../../domain/srs/types';
import { tutorCtx } from '../../domain/tutor/ctx';
import { useCapabilities } from '../../platform/capabilities';
import { logError, logWarn } from '../../platform/diagnostics';
import { MNEMO_OPT_MAX_WORDS, mnemonicOptions, type MnemonicOptionsWord } from '../../prompts/mnemonicOptions';
import { ownMnemoPatch } from './mnemonic';

// Merkhilfen der Wort-Werkstatt (Wort-Lernen 2, Teil 2): Claude schlägt je Werkstatt-Wort zwei Merkhilfen vor (`mnemonic-options@1`, gebündelt: alle
// Werkstatt-Wörter der Runde – höchstens 2 – in EINEM Aufruf). Automatisch nur, wenn in dieser Ansicht schon ein Nutzeraufruf beantwortet wurde
// (`sampleConfirmed`, nie ein Zustimmungsdialog ungefragt) und die Tutor-Tagesbremse noch Platz hat; sonst per Knopf. Kein Neuversuch aus dem Code.
// Die Vorschläge leben nur im Arbeitsspeicher; gespeichert wird allein, was Emrah auswählt oder selbst schreibt (`mnemo.own = 1`, ein Schreibweg).

export type MemoPhase = 'loading' | 'done' | 'error' | 'budget';
export type MemoEntry = { phase: MemoPhase; options?: readonly [string, string] };
type MemoState = { day: string; lang: Lang | null; items: Record<string, MemoEntry> };

export const useWkMemo = create<MemoState>(() => ({ day: '', lang: null, items: {} }));

let ctl: AbortController | null = null;

/** Laufende Anfrage abbrechen (Bildschirmwechsel, CLAUDE.md A6 Nr. 2). */
export function abortWkMemos(): void {
  ctl?.abort();
  ctl = null;
}

export type MemoCard = { card: TrainCard; diag: Diagnosis };

function wordOf(x: MemoCard, lang: Lang): MnemonicOptionsWord {
  // Partnerwort-Diagnose: die verfehlte Verbindung mitgeben (Lehrer-Prüfung 21.10.2026), sonst das verwechselte bzw. falsch getippte Wort.
  const other = x.diag.partner?.p ?? x.diag.other?.word ?? x.diag.wrong ?? '';
  return { id: x.card.key, en: x.card.word, meaning: meaningOf(x.card, lang) ?? '', sentence: x.card.context?.sentence ?? '', issue: x.diag.kind, other };
}

function fresh(lang: Lang): MemoState {
  const day = dayKey(Date.now());
  const s = useWkMemo.getState();
  if (s.day === day && s.lang === lang) return s;
  const next = { day, lang, items: {} };
  useWkMemo.setState(next);
  return next;
}

/**
 * Vorschläge holen. `auto`: still und nur unter den Bedingungen oben (keine Meldung, wenn nicht); `user`: auf Knopfdruck, bei leerer Tagesbremse
 * mit Hinweis. Wörter, die schon Vorschläge haben oder laden, werden nicht noch einmal gefragt; ein Knopfdruck nach einem Fehler fragt neu
 * (Zwischenspeicher einmal übergangen).
 */
export function requestWkMemos(list: readonly MemoCard[], lang: Lang, how: 'auto' | 'user'): void {
  const cap = useCapabilities.getState();
  if (!selectAiAvailable(cap)) return;
  if (how === 'auto' && (!cap.sampleConfirmed || tutorLeft() <= 0)) return;
  const st = fresh(lang);
  const retry = list.some((x) => st.items[x.card.key]?.phase === 'error');
  const open = list.filter((x) => {
    const p = st.items[x.card.key]?.phase;
    return !p || (how === 'user' && (p === 'error' || p === 'budget'));
  });
  const head = open.slice(0, MNEMO_OPT_MAX_WORDS);
  if (!head.length) return;
  const mark = (phase: MemoPhase, opts?: Record<string, readonly [string, string]>) =>
    useWkMemo.setState((s) => {
      const items = { ...s.items };
      for (const x of head) {
        const o = opts?.[x.card.key];
        items[x.card.key] = o ? { phase: 'done', options: o } : { phase: phase === 'done' ? 'error' : phase };
      }
      return { items };
    });
  if (!takeTutorCall()) {
    if (how === 'user') mark('budget');
    return;
  }
  mark('loading');
  ctl?.abort();
  const c = new AbortController();
  ctl = c;
  const vars = { words: head.map((x) => wordOf(x, lang)), uiLang: lang, ctx: tutorCtx(useLive.getState().docs['app/profile'] ?? null) };
  void askJson({ template: mnemonicOptions, vars, signal: c.signal, refresh: how === 'user' && retry })
    .then((r) => {
      if (ctl !== c) return;
      const byId: Record<string, readonly [string, string]> = {};
      for (const it of r.data.items) byId[it.id] = it.options;
      mark('done', byId);
    })
    .catch((err: unknown) => {
      if (err instanceof AiFailure && err.kind === 'cancelled') {
        // Abgebrochen: nichts bleibt „lädt“ stehen; ein späterer Besuch darf neu fragen.
        useWkMemo.setState((s) => {
          const items = { ...s.items };
          for (const x of head) if (items[x.card.key]?.phase === 'loading') delete items[x.card.key];
          return { items };
        });
        return;
      }
      logWarn('vocab:wk-memo', err instanceof AiFailure ? { code: err.code, message: err.kind } : err);
      if (ctl === c) mark('error');
    });
}

/** Merkhilfe übernehmen (gewählt oder selbst geschrieben): `mnemo {text, lang, t, own: 1}` über den einen Schreibweg. `true` = gespeichert oder schon so. */
export async function saveOwnMemo(card: TrainCard, text: string, lang: Lang): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  // Datenprüfer K2: Nur in ein vorhandenes Dokument schreiben (eine Merkhilfe legt nie ein neues an; sonst Fehler `missing`).
  if (!card.inDb) {
    logWarn('vocab:wk-memo-save', { reason: 'not_in_db' }, card.path);
    return false;
  }
  try {
    await writer.transform(card.path, (cur) => ownMnemoPatch(cur, card.path, { text, lang, t: Date.now() }));
    return true;
  } catch (err) {
    logError('vocab:wk-memo-save', err, card.path);
    return false;
  }
}
