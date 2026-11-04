import { create } from 'zustand';
import { de, type MessageKey } from './de';
import type { Lang } from '../app/settings';
import { logError } from '../platform/diagnostics';

// Großpaket C „schneller Start“ (04.11.2026, Plan Stufe 1 P10 Nr. 4): Deutsch steht in der Startdatei, Englisch wird erst geladen, wenn es
// gebraucht wird (Start mit Englisch, Sprachwechsel). Bis es da ist, gilt Deutsch; danach zeichnet `useT` neu (`useDicts`).
export const dicts: Partial<Record<Lang, Record<MessageKey, string>>> = { de };
export const useDicts = create<{ v: number }>(() => ({ v: 0 }));
let enLoading: Promise<void> | null = null;

/** Wörterbuch einer Sprache bereitstellen (Englisch nachladen). Wiederholbar; ein Fehler wird protokolliert, dann gilt Deutsch. */
export function ensureLang(lang: Lang): Promise<void> {
  if (dicts[lang]) return Promise.resolve();
  enLoading ??= import('./en')
    .then((m) => {
      dicts.en = m.en;
      useDicts.setState((s) => ({ v: s.v + 1 }));
    })
    .catch((err: unknown) => {
      logError('i18n:load', err, lang);
      enLoading = null;
    });
  return enLoading;
}

