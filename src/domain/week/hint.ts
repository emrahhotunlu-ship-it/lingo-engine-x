import { THEMES, isThemeId } from '../../content/nb/themes';
import { isDayKey, isoWeek } from '../date';
import type { ThemeHint, ThemeId, WeekDoc, WeekHint } from './types';

// Termin- oder Preply-Thema hat Vorrang beim Wochenthema-Vorschlag (Neubau N17, Plan §1.5).
// Beim Speichern eines Termins („Mein nächster Termin“) oder einer Preply-Vorbereitung wird das
// passende Thema über die Schlüsselwörter der 16 Themen erkannt und als `app/week.hint` für die
// Kalenderwoche des Termins vermerkt. `themeFor` liest den Hinweis selbst – so zeigen alle
// Bildschirme denselben Vorschlag. Ein Termin schlägt Preply in derselben Woche. Rein und getestet.

type Doc = Record<string, unknown>;
export type WeekOp = { set: Doc } | { update: Doc } | null;

const WK_RE = /^\d{4}-W\d{2}$/;

/** Thema mit den meisten Schlüsselwort-Treffern (Wortanfänge, klein); `null` ohne Treffer. */
export function themeFromText(text: string): ThemeId | null {
  const hay = ` ${text.toLowerCase().replace(/[^a-z0-9äöüß&-]+/g, ' ')} `;
  let best: ThemeId | null = null;
  let bestN = 0;
  for (const th of THEMES) {
    let n = 0;
    for (const k of th.keywords) if (hay.includes(` ${k}`)) n += k.includes(' ') ? 2 : 1;
    if (n > bestN) {
      best = th.id;
      bestN = n;
    }
  }
  return best;
}

/** Hinweis für die Kalenderwoche von `day` (Termin- bzw. Stundendatum) aus einem freien Text. */
export function hintFor(src: WeekHint['src'], text: string, day: string): WeekHint | null {
  if (!isDayKey(day)) return null;
  const theme = themeFromText(text);
  return theme ? { wk: isoWeek(day), theme, src } : null;
}

/** `app/week.hint` tolerant lesen. */
export function readHint(raw: unknown): WeekHint | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const h = raw as Doc;
  if (typeof h.wk !== 'string' || !WK_RE.test(h.wk) || !isThemeId(h.theme)) return undefined;
  return { wk: h.wk, theme: h.theme, src: h.src === 'preply' ? 'preply' : 'meeting' };
}

/** Vorrang-Hinweis einer Woche für `suggestTheme` (nur, wenn der Hinweis diese Woche betrifft). */
export function hintOf(week: WeekDoc | null | undefined, wk: string): ThemeHint | undefined {
  const h = week?.hint;
  if (!h || h.wk !== wk) return undefined;
  return h.src === 'meeting' ? { meeting: h.theme } : { preply: h.theme };
}

/**
 * Schreibweg für `hint` (feldweise, für `writer.transform`). Fehlt das Dokument: anlegen mit `v: 1`.
 * `valid = false`: nichts schreiben. Ein Termin-Hinweis derselben Woche wird von Preply nie ersetzt.
 */
export function weekHintOp(cur: Doc | undefined, valid: boolean, hint: WeekHint | null): WeekOp {
  if (!hint) return null;
  if (!cur) return { set: { v: 1, hint } };
  if (!valid) return null;
  const old = readHint(cur.hint);
  if (old && old.wk === hint.wk && old.theme === hint.theme && old.src === hint.src) return null;
  if (old && old.wk === hint.wk && old.src === 'meeting' && hint.src === 'preply') return null;
  const patch: Doc = { hint };
  if (typeof cur.v !== 'number' || cur.v < 1) patch.v = 1;
  return { update: patch };
}
