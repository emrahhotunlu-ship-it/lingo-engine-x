import { de, type MessageKey } from './de';
import { en } from './en';
import { useSettings, type Lang } from '../app/settings';

// Übersetzung mit Platzhaltern {name} und Mehrzahl (_one / _other).

export type { MessageKey, Lang };
type Vars = Record<string, string | number>;
export type PluralBase = MessageKey extends infer K ? (K extends `${infer B}_one` ? B : never) : never;

const dicts: Record<Lang, Record<MessageKey, string>> = { de, en };
const locales: Record<Lang, string> = { de: 'de-DE', en: 'en-US' };

export function formatNumber(lang: Lang, n: number): string {
  return new Intl.NumberFormat(locales[lang]).format(n);
}

export function formatDate(lang: Lang, ms: number): string {
  return new Intl.DateTimeFormat(locales[lang], { day: 'numeric', month: 'long', year: 'numeric' }).format(ms);
}

export function translate(lang: Lang, key: MessageKey, vars?: Vars): string {
  // Ein fehlender Schlüssel zeigt sich als er selbst (nie ein leerer Text); `i18nParts.test.ts` prüft, dass jeder benutzte Schlüssel existiert.
  const template = dicts[lang][key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => {
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
  return {
    lang,
    t: (key: MessageKey, vars?: Vars) => translate(lang, key, vars),
    tn: (base: PluralBase, n: number, vars?: Vars) => translatePlural(lang, base, n, vars),
    num: (n: number) => formatNumber(lang, n),
    date: (ms: number) => formatDate(lang, ms),
  };
}
