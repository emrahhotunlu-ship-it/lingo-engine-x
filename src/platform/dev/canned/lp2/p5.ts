// Testantworten Lernplattform 2.0, Paket P5 (docs/umbau/lernplattform-2.md §10.0/§10.3). Besitzer: nur dieses Paket.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

import { registerCannedReply } from '../../fakeSample';
import { grammarItemsReply } from '../../cannedLearn';

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
  const pats = patternsIn(input);
  if (!pats.length) return JSON.stringify(base);
  base.items.forEach((it, k) => {
    const p = pats[k % pats.length] as Pat;
    it.pat = p.id;
    const prompt = String(it.prompt);
    it.prompt = prompt.includes('→') ? prompt : prompt.replace(/([.?!])$/, `, ${p.signal}$1`);
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
