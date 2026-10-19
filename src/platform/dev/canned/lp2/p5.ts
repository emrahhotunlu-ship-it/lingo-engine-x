// Testantworten Lernplattform 2.0, Paket P5 (docs/umbau/lernplattform-2.md §10.0/§10.3). Besitzer: nur dieses Paket.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

import { registerCannedReply } from '../../fakeSample';
import { grammarItemsReply } from '../../cannedLearn';
import { foreignSignalPattern, hasSignal, patternNearGap, patternsOf } from '../../../../domain/grammar/patterns';

type Pat = { id: string; signal: string };

/** `- <id> | <Name> | <Formel> | signals: a, b` aus der Eingabe von `grammar-items@3`. */
function patternsIn(input: string): Pat[] {
  const out: Pat[] = [];
  for (const m of input.matchAll(/^- ([a-z0-9]+\.[a-z0-9-]+) \|[^|]*\|[^|]*\| signals: (.*)$/gm)) {
    const signal = (m[2] ?? '').split(',')[0]?.trim() ?? '';
    if (m[1] && signal) out.push({ id: m[1], signal });
  }
  return out;
}

/**
 * Feste, realistische Antwort für `grammar-items@3`: wie @1/@2, dazu bei Themen mit Muster je Aufgabe ein `pat` der Liste, ein Signalwort des Musters
 * im Satz und bei Auswahlaufgaben eine Begründung für eine falsche Option (`why_not`).
 */
export function grammarItemsReplyV3(input: string): string {
  const base = JSON.parse(grammarItemsReply(input)) as { items: Array<Record<string, unknown>> };
  // @5: Selbstprüfung je Aufgabe, Ziel-Satz für „Satz verbessern“ (Tutor-Engine v3 §6.3).
  for (const it of base.items) {
    it.self = { solved: it.answer, also: [] };
    if (it.type === 'correct') it.goal = { de: 'Der Bericht ist letzte Woche verschickt worden.', en: 'The report went out last week.' };
  }
  const pats = patternsIn(input);
  if (!pats.length) return JSON.stringify(base);
  const topic = base.items[0]?.topic;
  const tp = patternsOf(typeof topic === 'string' ? topic : '');
  // Passt der Satz zu diesem Muster (wie die Prüfung von `grammar-items`: Signal im Satz, ein fremdes Signal nur, wenn das eigene der Lücke näher ist)?
  const fits = (prompt: string, answer: string, id: string): boolean => {
    const own = tp?.patterns.find((x) => x.id === id);
    if (!tp || !own) return true;
    if (!own.signals.some((sg) => hasSignal(`${prompt.replace(/_{3,}/, answer)} ${answer}`, sg))) return false;
    if (!/_{3,}/.test(prompt) || !foreignSignalPattern(tp, id, prompt.replace(/_{3,}/, ' '))) return true;
    return patternNearGap(tp, prompt, answer)?.id === id;
  };
  base.items.forEach((it, k) => {
    const prompt = String(it.prompt);
    const answer = String(it.answer);
    const add = (q: Pat): string => (prompt.includes('→') ? prompt : prompt.replace(/([.?!])$/, `, ${q.signal}$1`));
    // Zuerst ein Muster, dessen Signal schon im Satz steht, sonst eines mit angehängtem Signal (wie bisher reihum).
    const order = pats.map((_, j) => pats[(k + j) % pats.length] as Pat);
    const hit = order.find((q) => fits(prompt, answer, q.id)) ?? order.find((q) => fits(add(q), answer, q.id));
    const fallback = pats[k % pats.length];
    if (!fallback) return;
    const p = hit ?? fallback;
    it.pat = p.id;
    it.prompt = hit && fits(prompt, answer, hit.id) ? prompt : add(p);
    if (it.type === 'mc' && Array.isArray(it.options)) {
      const wrong = (it.options as string[]).find((o) => o !== it.answer);
      if (wrong) it.why_not = [{ opt: wrong, de: `„${wrong}“ passt nicht zum Signalwort „${p.signal}“.`, en: `“${wrong}” does not fit the signal “${p.signal}”.` }];
    }
  });
  return JSON.stringify(base);
}

/** Meldet die Testantworten von P5 an. */
export function registerLp2P5Replies(): void {
  registerCannedReply('grammar-items', grammarItemsReplyV3);
}
