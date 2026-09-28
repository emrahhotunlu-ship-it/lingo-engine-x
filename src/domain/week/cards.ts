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

/** Stichwort als Wortanfang: kurze Stichwörter (≤ 3 Zeichen) nur ganz (oder mit -s), sonst ≤ 4 Zeichen Endung. */
function keywordRe(keyword: string): RegExp | null {
  const k = normText(keyword);
  if (!k) return null;
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tail = k.length <= 3 ? 's?' : "[a-z']{0,4}";
  return new RegExp(`(?:^| )${esc}${tail}(?= |$)`);
}

// Leistung (perf.spec, Großdatensatz): Wendungskerne und Stichwort-Regex je Thema nur EINMAL bauen,
// nicht für jede der bis zu 1.500 fälligen Karten neu (normText + RegExp je Karte × Wendung/Stichwort).
type Prepared = { cores: readonly string[]; keys: readonly RegExp[] };
const PREPARED = new WeakMap<WeekTheme, Prepared>();

function prepared(t: WeekTheme): Prepared {
  const hit = PREPARED.get(t);
  if (hit) return hit;
  const p: Prepared = { cores: t.phrases.map((x) => phraseCore(x.en)), keys: t.keywords.map(keywordRe).filter((r): r is RegExp => r !== null) };
  PREPARED.set(t, p);
  return p;
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
  const { cores, keys } = prepared(t);
  const multi = word.split(' ').length >= 2;
  for (const core of cores) {
    if (core === word) return true;
    if (multi && (hasWords(core, word) || hasWords(word, core))) return true;
  }
  return keys.some((re) => re.test(word));
}
