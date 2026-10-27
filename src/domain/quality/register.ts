// Register-Prüfungen (E1a). Rein.
// - `longForms`: Langformen, die in gesprochenen Formeln steif klingen („Let us …“, „I am …“, „do not …“). Nur ein Hinweis für Sprechformeln;
//   in formellen Texten und bei Betonung sind Langformen richtig.
// - `denglisch`: deutsch-englische Ausdrücke, die Muttersprachler so nicht sagen (Liste wächst mit dem Lehrer-Audit).

const LONG: ReadonlyArray<[RegExp, string]> = [
  // „Let us know“, „let us see“ (= erlaube uns) bleiben: nur der Vorschlag „Let us + Verb“ am Satzanfang.
  [/(^|[.!?]\s+|["“]\s*)let us\b(?!\s+(know|see|have|hear))/i, "let's"],
  [/\bI am\b/, "I'm"],
  [/\bI will\b/, "I'll"],
  [/\b(we|you|they) are\b/i, "we're/you're/they're"],
  [/\b(we|you|they) will\b/i, "we'll/you'll/they'll"],
  [/\b(do|does|did|is|are|was|were|will|would|could|should|have|has) not\b/i, "n't"],
  [/\bcannot\b/i, "can't"],
  [/\b(it|that|there) is\b(?![.,;:!?]|\s*$)/i, "it's/that's/there's"],
];

/** Gefundene Langformen (die gesprochene Kurzform je Fund). */
export function longForms(text: string): string[] {
  return LONG.filter(([re]) => re.test(text)).map(([, short]) => short);
}

/** Denglisch und Scheinanglizismen: Fund → was man stattdessen sagt. */
export const DENGLISCH: ReadonlyArray<{ re: RegExp; use: string }> = [
  { re: /\baudit[- ]proof\b/i, use: 'tamper-proof / legally compliant' },
  { re: /\brevision[- ](safe|proof)\b/i, use: 'tamper-proof / legally compliant' },
  { re: /\bbeamer\b/i, use: 'projector' },
  { re: /\boldtimer\b/i, use: 'classic car' },
  { re: /\bpublic viewing\b/i, use: 'outdoor screening' },
  { re: /\bmobbing\b/i, use: 'bullying' },
  { re: /\bmake an? (photo|picture)\b/i, use: 'take a photo' },
  { re: /\bin the internet\b/i, use: 'on the internet' },
  { re: /\bhandy\b(?=\s+(number|call|bill|contract))/i, use: 'cell phone' },
  { re: /\b(a|my|your|his|her|our|their) handy\b(?!\s+(tool|tip|way|guide|feature|thing))/i, use: 'cell phone' },
  { re: /\bhome office\b(?=\s+(day|days|rule|rules|policy|regulation))|\b(in|from|im) home office\b/i, use: 'working from home / remote work' },
  { re: /\bsince \d+ (years|months|weeks|days)\b/i, use: 'for … years' },
  { re: /\bchef\b(?=\s+of\b)|\bmy chef\b/i, use: 'boss / manager' },
  { re: /\bbecome (a|an|the) (answer|email|reply|discount|offer)\b/i, use: 'get / receive' },
];

export function denglisch(text: string): string[] {
  return [...new Set(DENGLISCH.filter((d) => d.re.test(text)).map((d) => d.use))];
}
