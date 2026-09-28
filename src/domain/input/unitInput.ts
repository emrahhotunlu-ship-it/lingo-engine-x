import type { ThemeText } from '../../content/nb/schemas';
import { isoWeek, normText, phraseCore, resolveBlock, themeRef, unitPlanFor } from '../week';
import type { InputSrc, ThemeId, UnitEnv, WeekDoc, WeekTheme } from '../week/types';
import { sentenceSplit } from './textStats';
import type { ArticleItem, Question } from './types';

// Block 2 der Tageseinheit (Neubau N53, Prüfung Tageseinheit M7, M9, S1): Quelle je Wochentag und
// Umgebung, Fragen mit Belegstelle und Grund, Wendungen zum Merken, Sätze zum Nachsprechen.
// Rein – die Oberfläche entscheidet damit synchron im Klick (`UnitBlockProvider.start`).

export type InputBlockPlan = {
  kind: 'read' | 'listen';
  src: InputSrc;
  /** Ohne KI am Dienstag: Themen-Text vorlesen, dann „in 3 Sätzen zusammenfassen“ (M7). */
  summary: boolean;
  /** Tempo-Leiter beim Hören (N54). */
  ladder: boolean;
};

/**
 * Quelle von Block 2 für einen Lerntag, so wie P1 den Block auflöst (`unitPlanFor` + `resolveBlock`).
 * Das Thema kommt aus `UnitCtx.theme`; die volle Einheit wird angenommen (Block 2 gibt es nur dort).
 * `null`, wenn Block 2 heute kein Lese-/Hör-Input ist (Posteingang, Sa, So).
 */
export function inputBlockPlan(day: string, theme: ThemeId, env: UnitEnv): InputBlockPlan | null {
  const week: WeekDoc = { v: 1, cur: { wk: isoWeek(day), theme, by: 'user' } };
  const plan = unitPlanFor(day, week, { goalMin: 30 });
  const b = plan.blocks.find((x) => x.block === 2);
  if (!b) return null;
  const r = resolveBlock(b, env);
  if (r.kind !== 'input.read' && r.kind !== 'input.listen') return null;
  return {
    kind: r.kind === 'input.listen' ? 'listen' : 'read',
    src: r.opts.src ?? 'theme-text',
    summary: r.opts.summary === true,
    ladder: r.opts.ladder === true,
  };
}

/** Fragen des Themen-Texts (Kernfrage, „zwischen den Zeilen“) im gemeinsamen Format, mit Belegzitat. */
export function themeQuestions(tt: Pick<ThemeText, 'id' | 'core' | 'between'>, lang: 'de' | 'en'): Question[] {
  const one = (q: ThemeText['core'], key: string, type: Question['type']): Question => ({
    key: `${tt.id}#${key}`,
    q: q.q[lang],
    qLang: lang,
    options: [...q.options],
    answer: q.answer,
    type,
    explain: { de: q.why.de, en: q.why.en },
    quote: q.quote,
  });
  return [one(tt.core, 'core', 'gist'), one(tt.between, 'between', 'inference')];
}

/** Satz des Texts, der ein Zitat enthält (Belegstelle); sonst das Zitat selbst. */
export function quoteSentence(text: string, quote: string): string {
  const q = quote.trim();
  if (!q) return '';
  const low = q.toLowerCase();
  for (const s of sentenceSplit(text)) if (s.text.toLowerCase().includes(low)) return s.text;
  return q;
}

/** Satz des Texts, in dem eine Wendung steht (Ursprungssatz der Karte). */
export function phraseSentence(text: string, phrase: string): string | null {
  const low = phrase.trim().toLowerCase().replace(/[?.!]+$/, '');
  if (!low) return null;
  for (const s of sentenceSplit(text)) if (s.text.toLowerCase().includes(low)) return s.text;
  return null;
}

/** Bis zu 3 Sätze zum Nachsprechen: vorgegeben, sonst die ersten gut sprechbaren (6–22 Wörter). */
export function shadowSentences(text: string, given: readonly string[] = [], n = 3): string[] {
  const out = given.map((s) => s.trim()).filter(Boolean).slice(0, n);
  if (out.length >= n) return out;
  for (const s of sentenceSplit(text)) {
    const w = s.text.split(/\s+/).filter(Boolean).length;
    if (w >= 6 && w <= 22 && !out.includes(s.text)) out.push(s.text);
    if (out.length >= n) break;
  }
  return out;
}

/** Zusammenfassung „in 3 Sätzen“ (M7, ohne KI): genug, wenn 2–4 Sätze mit zusammen ≥ 15 Wörtern. */
export function summaryReady(text: string): boolean {
  const s = sentenceSplit(text.trim());
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return s.length >= 2 && words >= 15;
}

/** Kennung eines Themen-Texts als Lese-Einheit (`x-t01` …). */
export const isThemeTextId = (id: string): boolean => /^x-t(0[1-9]|1[0-6])$/.test(id);

/**
 * Themen-Text als Lese-Einheit. `ref` = `theme:<id>`: gespeicherte Wörter tragen so das Wochenthema
 * (`origin.ref`, `isThemeCard`). Nicht in der Datenbank (Herkunft `legacy`).
 */
export function themeArticle(tt: ThemeText, theme: Pick<WeekTheme, 'id' | 'kind' | 'title' | 'phrases'>, lang: 'de' | 'en'): ArticleItem {
  return {
    ref: themeRef(theme.id),
    id: tt.id,
    level: 'B2+',
    domain: theme.kind === 'life' ? 'life' : 'work',
    title: tt.title,
    topic: { de: theme.title.de, en: theme.title.en },
    text: tt.text,
    keypoints: [],
    // Glossar: die Wendungen der Woche, die im Text stehen.
    glossary: theme.phrases.filter((p) => ` ${normText(tt.text)} `.includes(` ${phraseCore(p.en)} `)).map((p) => ({ w: p.en, de: p.de, def: p.def })),
    questions: themeQuestions(tt, lang),
    origin: 'legacy',
  };
}

export type NoticeRow = { en: string; de?: string; note?: string };

/** Wendungen zum Merken mit Bedeutung aus den Wendungen der Woche (wenn eine passt). */
export function noticeRows(notice: readonly string[], phrases: WeekTheme['phrases'], lang: 'de' | 'en'): NoticeRow[] {
  return notice.map((en) => {
    const core = phraseCore(en);
    const hit = phrases.find((p) => {
      const pc = phraseCore(p.en);
      return !!pc && !!core && (pc.includes(core) || core.includes(pc));
    });
    const row: NoticeRow = { en };
    if (hit) {
      row.de = hit.de;
      if (lang === 'en') row.note = hit.def;
    }
    return row;
  });
}
