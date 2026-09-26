import type { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import type { PromptTemplate, UiLang } from './types';

// Gemeinsame Bausteine der Vorlagen.

/** Obergrenze je Prompt in UTF-8-Bytes. `sample` erlaubt 64 KiB; der Rest bleibt Reserve für den Neuversuch. */
export const PROMPT_MAX_BYTES = 60_000;
/** Harte Grenze aus contract/sample.d.ts (`maxPromptBytes`). */
export const SAMPLE_MAX_BYTES = 65_536;

const encoder = new TextEncoder();

export function promptBytes(text: string): number {
  return encoder.encode(text).length;
}

/** Kopfzeile, an der der Entwicklungs-Adapter die Vorlage erkennt. */
export function header(t: Pick<PromptTemplate<unknown, unknown>, 'id' | 'version'>): string {
  return `[${t.id}@${t.version}]`;
}

export function langName(lang: UiLang): 'German' | 'English' {
  return lang === 'de' ? 'German' : 'English';
}

/**
 * Nutzertext als eine Zeile: Zeilenumbrüche und Steuerzeichen werden zu Leerzeichen,
 * damit der Text keine eigenen Prompt-Zeilen erzeugen kann. Gekürzt auf höchstens
 * `max` Zeichen (Codepunkte), mit „…" am Ende.
 */
export function clip(text: string, max: number): string {
  // eslint-disable-next-line no-control-regex -- Steuerzeichen werden bewusst entfernt
  const flat = text.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim();
  const chars = Array.from(flat);
  if (chars.length <= max) return flat;
  return chars.slice(0, Math.max(0, max - 1)).join('').trimEnd() + '…';
}

/**
 * zod-Prüfung der Sprachtreue: Die genannten Felder müssen in der Oberflächensprache
 * geschrieben sein. Geprüft wird erst ab 4 Wörtern und nur bei eindeutigem Ergebnis.
 */
export function langOf<K extends string>(fields: readonly K[], lang: UiLang) {
  return (value: Partial<Record<K, unknown>>, ctx: z.RefinementCtx): void => {
    for (const f of fields) {
      const v = value[f];
      if (typeof v === 'string' && isWrongLang(v, lang)) {
        ctx.addIssue({ code: 'custom', path: [f], message: `must be written in ${langName(lang)}` });
      }
    }
  };
}
