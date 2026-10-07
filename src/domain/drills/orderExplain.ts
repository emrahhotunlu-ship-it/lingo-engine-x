import type { ExplainExample, ExplainLine, ExplanationModel, ResultVerdict } from '../explain/types';
import { patternById } from '../grammar/patterns';
import type { Lang } from '../srs/types';
import type { OrderItem } from './order';

// Erklär-Karte des Satzbaus (Lernplattform 2.0 §5.8): Muster · Warum · warum der Fallen-Baustein falsch ist. Beispiele nur aus
// demselben Muster (nie ein Zufallssatz des Themas, nie Rechnungs- oder Lizenzsätze). Rein.

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Beispiele desselben Musters ohne den Übungssatz selbst (höchstens 2). */
export function orderExamples(item: Pick<OrderItem, 'pat' | 'sentence'>): ExplainExample[] {
  const pat = item.pat ? patternById(item.pat) : null;
  if (!pat) return [];
  return pat.ex
    .filter((x) => norm(x.en) !== norm(item.sentence))
    .slice(0, 2)
    .map((x) => ({ en: x.en, de: x.de ?? null, ctx: x.ctx }));
}

export function orderExplanation(i: { item: OrderItem; lang: Lang; usedTrap: boolean; topicName: string | null; verdict: ResultVerdict }): ExplanationModel {
  const { item, lang } = i;
  const pat = item.pat ? patternById(item.pat) : null;
  const lines: ExplainLine[] = [];
  if (pat) lines.push({ k: 'pattern', name: lang === 'en' ? pat.name.en : pat.name.de, formula: lang === 'en' ? pat.form.en : pat.form.de });
  else if (i.topicName) lines.push({ k: 'pattern', name: i.topicName, formula: null });
  const trap = item.trap ?? null;
  if (trap && i.usedTrap) lines.push({ k: 'yours', given: trap.instead, text: lang === 'en' ? trap.why.en : trap.why.de });
  lines.push({ k: 'why', text: item.why[lang] });
  if (item.bad) lines.push({ k: 'mistake', bad: item.bad, good: item.sentence, cause: null });
  if (trap && !i.usedTrap) lines.push({ k: 'contrast', a: trap.tile, b: trap.instead, diff: lang === 'en' ? trap.why.en : trap.why.de });
  return { lines, examples: orderExamples(item), mark: pat?.signals ?? [], ai: item.ai === true, source: pat ? 'pattern' : 'task' };
}
