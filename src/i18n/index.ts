import { de, type MessageKey } from './de';
import { useSettings, type Lang } from '../app/settings';
import { dicts, ensureLang, hasLang, useDicts } from './dicts';

// Übersetzung mit Platzhaltern {name} und Mehrzahl (_one / _other).

export type { MessageKey, Lang };
export { ensureLang, hasLang };
type Vars = Record<string, string | number>;
export type PluralBase = MessageKey extends infer K ? (K extends `${infer B}_one` ? B : never) : never;

// Großpaket C „schneller Start“: Wörterbücher und Nachladen stehen in `dicts.ts` (ohne Einstellungen, damit Tests sie vorab laden können).
useSettings.subscribe((s) => void ensureLang(s.lang));

const locales: Record<Lang, string> = { de: 'de-DE', en: 'en-US' };

export function formatNumber(lang: Lang, n: number): string {
  return new Intl.NumberFormat(locales[lang]).format(n);
}

export function formatDate(lang: Lang, ms: number): string {
  return new Intl.DateTimeFormat(locales[lang], { day: 'numeric', month: 'long', year: 'numeric' }).format(ms);
}

/** Kurzes Datum ohne Jahr („12. Okt.“ / „Oct 12“) für „zuletzt falsch am …“. */
export function formatShortDate(lang: Lang, ms: number): string {
  return new Intl.DateTimeFormat(locales[lang], { day: 'numeric', month: 'short' }).format(ms);
}

export function translate(lang: Lang, key: MessageKey, vars?: Vars): string {
  // Ein fehlender Schlüssel zeigt sich als er selbst (nie ein leerer Text); `i18nParts.test.ts` prüft, dass jeder benutzte Schlüssel existiert.
  const dict: Record<MessageKey, string> = dicts[lang] ?? de;
  const template: string = dict[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m: string, name: string) => {
    const v = vars[name];
    if (v === undefined) return m;
    return typeof v === 'number' ? formatNumber(lang, v) : v;
  });
}

export function translatePlural(lang: Lang, base: PluralBase, n: number, vars?: Vars): string {
  const key = `${base}_${n === 1 ? 'one' : 'other'}` as MessageKey;
  return translate(lang, key, { n, ...vars });
}

export function useT() {
  const lang = useSettings((s) => s.lang);
  // Neu zeichnen, sobald ein nachgeladenes Wörterbuch da ist.
  useDicts((s) => s.v);
  return {
    lang,
    t: (key: MessageKey, vars?: Vars) => translate(lang, key, vars),
    tn: (base: PluralBase, n: number, vars?: Vars) => translatePlural(lang, base, n, vars),
    num: (n: number) => formatNumber(lang, n),
    date: (ms: number) => formatDate(lang, ms),
    dateShort: (ms: number) => formatShortDate(lang, ms),
  };
}
