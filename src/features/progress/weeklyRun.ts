import { askJson } from '../../ai/gate';
import { isAiFailure } from '../../ai/types';
import { getWriter } from '../../data';
import { citableFacts, topicName, type WeekFact } from '../../domain/progress/weekly';
import { weeklyReport, type WeeklyOut } from '../../prompts/weeklyReport';
import { logError, logWarn } from '../../platform/diagnostics';
import { aiUsable } from './assessRun';

// Wochenbericht als gespeicherter KI-Text (Plan E15, §6.2): einmal je abgeschlossener ISO-Woche
// und Sprache, beim Öffnen des Reiters „Verlauf". Ohne mindestens drei zitierbare Fakten gibt es
// nur die Fakten. Gespeichert in `app/weekly.items[]` (≤ 26), nie automatisch wiederholt.

type Doc = Record<string, unknown>;
export const WEEKLY_MAX = 26;
export const WEEKLY_MIN_FACTS = 3;

export type WeeklyItem = { w: string; lang: 'de' | 'en'; t: number; pv: string; facts: string[]; text: WeeklyOut };

/** Gespeicherter Bericht für Woche und Sprache (Sprachtreue: nie in der anderen Sprache zeigen). */
export function storedWeekly(doc: Doc | null | undefined, w: string, lang: 'de' | 'en'): WeeklyItem | null {
  const items = Array.isArray(doc?.items) ? (doc.items as unknown[]) : [];
  for (const x of items) {
    const o = x && typeof x === 'object' ? (x as Doc) : {};
    const text = o.text && typeof o.text === 'object' ? (o.text as Doc) : null;
    if (o.w !== w || o.lang !== lang || !text || typeof text.headline !== 'string' || !Array.isArray(text.learned)) continue;
    return o as unknown as WeeklyItem;
  }
  return null;
}

/** Schreibvorgang für `writer.transform('app/weekly', …)`: gleiche Woche+Sprache ersetzt, ≤ 26. */
export function weeklyOp(cur: Doc | undefined, item: WeeklyItem): { set: Doc } | { update: Doc } | null {
  if (!cur) return { set: { items: [item] } };
  const items = (Array.isArray(cur.items) ? (cur.items as unknown[]) : []).filter((x) => {
    const o = x && typeof x === 'object' ? (x as Doc) : {};
    return !(o.w === item.w && o.lang === item.lang);
  });
  return { update: { items: [...items, item].slice(-WEEKLY_MAX) } };
}

/** Fakt als neutrale englische Zeile für den Prompt (Inhalte, keine Oberflächentexte). */
export function factLine(f: WeekFact): string {
  switch (f.kind) {
    case 'word':
      return `new word "${f.word}" still recalled after at least one day${f.stable ? ' (now stable)' : ''}`;
    case 'topic':
      return `grammar topic "${topicName(f.topic, 'en')}": mastery ${Math.round(f.from * 100)}% → ${Math.round(f.to * 100)}%`;
    case 'fixed':
      return `${f.n} former mistake sentence(s) in "${topicName(f.topic, 'en')}" now answered correctly`;
    case 'text':
      return `wrote and revised a text: "${f.titles?.en || f.title || (f.lesson ? `lesson ${f.lesson}` : 'free text')}"`;
    case 'talk':
      return `held a role-play conversation: "${f.title}"`;
    case 'time':
      return `${f.minutes} minutes on ${f.activeDays} days`;
  }
}

export type WeeklyResult = 'stored' | 'skipped' | 'error';

/** KI-Text für die Woche erzeugen und speichern (nur wenn nötig und möglich). */
export async function ensureWeeklyText(i: { w: string; lang: 'de' | 'en'; facts: readonly WeekFact[]; stored: WeeklyItem | null; signal: AbortSignal; refresh?: boolean }): Promise<WeeklyResult> {
  const cite = citableFacts(i.facts);
  if (i.stored || cite.length < WEEKLY_MIN_FACTS || !aiUsable()) return 'skipped';
  const writer = getWriter();
  if (!writer) return 'skipped';
  try {
    const facts = cite.map((f) => ({ id: f.id, text: factLine(f) }));
    const r = await askJson({ template: weeklyReport, vars: { lang: i.lang, week: i.w, facts }, signal: i.signal, priority: 'background', refresh: i.refresh === true });
    const item: WeeklyItem = { w: i.w, lang: i.lang, t: Date.now(), pv: `${weeklyReport.id}@${weeklyReport.version}`, facts: facts.map((f) => f.id), text: r.data };
    await writer.transform('app/weekly', (cur) => (storedWeekly(cur, i.w, i.lang) ? null : weeklyOp(cur, item)));
    return 'stored';
  } catch (err) {
    if (isAiFailure(err)) {
      if (err.kind !== 'cancelled') logWarn('weekly:ai', err);
      return err.kind === 'cancelled' ? 'skipped' : 'error';
    }
    logError('weekly:save', err, 'app/weekly');
    return 'error';
  }
}
