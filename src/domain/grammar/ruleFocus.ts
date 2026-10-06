// „Kurz erklärt“ passend zur Aufgabe (Emrah 05.10.2026: „Passt Erläuterung und Übung zusammen?“): Das Regelblatt eines Themas
// enthält oft mehrere Muster (z. B. Mixed Conditional UND wish). Die Aufgabe braucht meist nur eines. Der Kurztext wird in Sätze
// zerlegt, der Satz mit der größten Wortübereinstimmung zur Aufgabe (Satz, Lösung, Stichwort) steht vorn, der Rest hinter „Ganze Regel“.
// Rein und deterministisch; ohne Treffer bleibt der ganze Text vorn.

const STOP = new Set(['the', 'and', 'for', 'with', 'you', 'are', 'was', 'were', 'will', 'would', 'that', 'this', 'have', 'has', 'had', 'not', 'but', 'now', 'der', 'die', 'das', 'und', 'mit', 'für', 'ist', 'sind', 'wird', 'nicht', 'ein', 'eine', 'den', 'dem', 'von', 'auf', 'bei', 'oder', 'nach', 'vor']);

const words = (s: string): string[] => (s.toLowerCase().match(/[a-zäöüß][a-zäöüß'-]{2,}/g) ?? []).filter((w) => !STOP.has(w));

/** Sätze zerlegen: Satzende (. ! ?) gefolgt von Anführungszeichen/Klammer und einem Großbuchstaben. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?][“”"’)]*)\s+(?=[A-ZÄÖÜ])/u)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function focusRule(core: string, task: { prompt: string; answer?: string; hint?: string | null }): { focus: string; rest: string } {
  const parts = splitSentences(core);
  if (parts.length < 3) return { focus: core, rest: '' };
  const probe = new Set(words(`${task.prompt} ${task.answer ?? ''} ${task.hint ?? ''}`));
  const scored = parts.map((p, i) => ({ p, i, s: words(p).filter((w) => probe.has(w)).length }));
  const best = Math.max(...scored.map((x) => x.s));
  if (best <= 0) return { focus: core, rest: '' };
  const top = scored.filter((x) => x.s === best);
  // Gleichstand zwischen weit entfernten Sätzen ist kein Signal.
  if (top.length > 2) return { focus: core, rest: '' };
  const keep = new Set(top.map((x) => x.i));
  return { focus: parts.filter((_, i) => keep.has(i)).join(' '), rest: parts.filter((_, i) => !keep.has(i)).join(' ') };
}
