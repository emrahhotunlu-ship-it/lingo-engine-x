import { themeById } from '../../content/nb/themes';
import { hasWords, normText, phraseCore } from './text';
import type { ThemeId, WeekTheme } from './types';

// Gehört eine Karte zum Wochenthema? (Plan N23, anki-regeln §5 Stufe 4, Prüfung M1: nur für fällige
// und neue Karten, nie zum Vorziehen). Rein, ohne Wörterbuch.
// Treffer, wenn
// 1. die Herkunft das Thema nennt (`origin.ref`/`src`/`theme` = `theme:t03` bzw. `t03`),
// 2. die Karte eine Wendung der Woche ist (oder eine Wendung sie ganz enthält, ab 2 Wörtern), oder
// 3. ein Stichwort des Themas als Wortanfang in der Karte steht (nur im englischen Wort, nicht im Satz).

export type ThemeCardLike = {
  word?: string | null;
  lemma?: string | null;
  en?: string | null;
  src?: unknown;
  doc?: Readonly<Record<string, unknown>> | null;
};

/** Kennzeichen für Karten, die aus einer Übung zum Thema entstehen (`origin.ref`). */
export const themeRef = (id: ThemeId): string => `theme:${id}`;

const TAG_RE = /(?:^|[^a-z0-9])theme:(t\d{2})(?![0-9])/;

function tagOf(v: unknown): string | null {
  if (typeof v === 'string') {
    const m = TAG_RE.exec(v.toLowerCase());
    return m?.[1] ?? null;
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Readonly<Record<string, unknown>>;
    return tagOf(o.ref) ?? tagOf(o.kind) ?? tagOf(o.theme);
  }
  return null;
}

function keywordHit(word: string, keyword: string): boolean {
  const k = normText(keyword);
  if (!k) return false;
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^| )${esc}`).test(word);
}

export function isThemeCard(card: ThemeCardLike, theme: WeekTheme | ThemeId | null | undefined): boolean {
  const t = typeof theme === 'string' ? themeById(theme) : (theme ?? null);
  if (!t) return false;
  const doc = card.doc ?? null;
  const direct = doc && typeof doc.theme === 'string' ? doc.theme : null;
  if (direct === t.id) return true;
  const tag = tagOf(card.src) ?? tagOf(doc?.origin) ?? tagOf(doc?.src);
  if (tag) return tag === t.id;

  const raw = card.word ?? card.en ?? card.lemma ?? (typeof doc?.word === 'string' ? doc.word : typeof doc?.en === 'string' ? doc.en : '');
  const word = normText(raw ?? '');
  if (!word) return false;
  for (const p of t.phrases) {
    const core = phraseCore(p.en);
    if (core === word) return true;
    if (word.split(' ').length >= 2 && (hasWords(core, word) || hasWords(word, core))) return true;
  }
  return t.keywords.some((k) => keywordHit(word, k));
}
