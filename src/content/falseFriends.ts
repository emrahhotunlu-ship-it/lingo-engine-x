// Falsche Freunde und Interferenzfehler deutschsprachiger Lernender (Auswertung 15.10.2026: Die KI übernahm „I suggest absolving“ und ließ
// „eventually“ im Sinn von „eventuell“ stehen). Daten, kein Code: jede Zeile nennt das deutsche Wort, das gemeint ist, die richtige englische
// Entsprechung und ein Erkennungsmuster `bad` für den eindeutigen Fehlgebrauch. Nur eindeutige Muster sperren (Selbstprüfung der korrigierten
// Fassung, `src/domain/text/correctness.ts`); `bad: null` heißt: nur Hinweis an die KI im Prompt (zu oft auch richtig verwendet).
// Englisch, weil es in Prompts geht.

export type FalseFriend = {
  /** Das englische Wort (Grundform), um das es geht. */
  word: string;
  /** Das deutsche Wort, das Lernende meinen. */
  de: string;
  /** Richtige englische Wörter für die gemeinte Bedeutung. */
  en: string;
  /** Eindeutiger Fehlgebrauch im Satz; `null` = nur Prompt-Hinweis. */
  bad: RegExp | null;
};

export const FALSE_FRIENDS: readonly FalseFriend[] = [
  // „eventuell“ = vielleicht. eventually = schließlich, am Ende.
  { word: 'eventually', de: 'eventuell', en: 'possibly, perhaps, maybe', bad: /\b(?:can|could|may|might)\s+eventually\b|\beventually\s*,?\s+(?:we|i|you|they)\s+(?:can|could|may|might)\b/i },
  // „aktuell“ = current. actual = tatsächlich.
  { word: 'actual', de: 'aktuell', en: 'current, latest, up to date', bad: /\b(?:the\s+)?actual\s+(?:situation|trend|trends|development|developments|news|market\s+situation)\b/i },
  // „absolvieren“ = complete, finish, take (a course). absolve = freisprechen.
  { word: 'absolve', de: 'absolvieren', en: 'complete, finish, take (a course)', bad: /\babsolv(?:e|es|ed|ing)\b/i },
  // „zuerst“ = first of all. at first = anfangs (im Gegensatz zu später).
  { word: 'at first', de: 'zuerst', en: 'first, first of all, to begin with', bad: /\bat\s+first\s*,?\s+(?:we|i|you|let['’]s)\s+(?:need|have\s+to|must|should|will|take|want|can|could|would|ask|check|clarify|discuss)\b/i },
  // „bekommen“ = get, receive. become = werden.
  { word: 'become', de: 'bekommen', en: 'get, receive', bad: /\b(?:I|we)\s+(?:will\s+|['’]ll\s+)?bec(?:o|a)me\s+(?:an?\s+|the\s+)?(?:gift|present|offer|bill|invoice|email|mail|message|reply|discount|refund)\b/i },
  // „Chef“ = boss, manager. chef = Koch.
  { word: 'chef', de: 'Chef', en: 'boss, manager, supervisor', bad: /\b(?:my|our|your|his|her|their)\s+chef\b|\bchef\s+of\s+(?:the\s+)?(?:department|team|sales|company|division)\b/i },
  // „kontrollieren“ = check. control = beherrschen, steuern.
  { word: 'control', de: 'kontrollieren', en: 'check, verify, review', bad: /\bcontrol(?:s|led|ling)?\s+(?:the\s+)?(?:invoices?|documents?|numbers|figures|contracts?|bills?)\s+(?:for|if|whether)\b/i },
  // „konsequent“ = consistent(ly). consequent = daraus folgend.
  { word: 'consequent', de: 'konsequent', en: 'consistent(ly), rigorous(ly)', bad: /\b(?:act|acts|acting|follow|follows|following|apply|applies|applying|implement|implements|implementing|use|uses|using|proceed|proceeding|pursue|pursuing|enforce|enforcing)\s+consequently\b|\bconsequent\b(?!\s+(?:upon|on|to)\b)/i },
  // „Möglichkeit zu …“ = option / chance to …; „possibility to“ + Infinitiv ist Deutsch.
  { word: 'possibility', de: 'Möglichkeit', en: 'option, opportunity, chance (to …)', bad: /\bpossibilit(?:y|ies)\s+to\s+[a-z]+/i },
  // „sensibel“ = sensitive. sensible = vernünftig.
  { word: 'sensible', de: 'sensibel', en: 'sensitive', bad: /\bsensible\s+(?:data|information|topics?|subjects?|issues?|matters?|documents?|content|areas?|customers?)\b/i },
  // „Handy“ = cell phone. handy = praktisch.
  { word: 'handy', de: 'Handy', en: 'cell phone, mobile phone', bad: /\b(?:my|your|his|her|our|their|the|a)\s+handy\b(?!\s+(?:tool|tools|feature|features|way|trick|tricks|shortcut|option|for|to|when|if|in|that|and|guide|reference|list|checklist|template)\b)/i },
  // „Gift“ = poison. gift = Geschenk.
  { word: 'gift', de: 'Gift', en: 'poison', bad: /\b(?:toxic|poisonous)\s+gift\b|\bgift\s+(?:in|for)\s+(?:the\s+)?(?:food|water|drinks?|plants?|fish)\b/i },
  // „bald“ = soon. bald = kahl.
  { word: 'bald', de: 'bald', en: 'soon', bad: /\b(?:see|call|meet|talk|write|send|contact|speak|reply|respond)(?:\s+you)?\s+bald\b|\b(?:we|I)\s+(?:will|['’]ll)\s+bald\b/i },
  // „Fabrik“ = factory, plant. fabric = Stoff.
  { word: 'fabric', de: 'Fabrik', en: 'factory, plant', bad: /\b(?:production|manufacturing)\s+fabrics?\b/i },
  // Nur Hinweis, kein eindeutiges Muster.
  { word: 'pension', de: 'Pension (Gästehaus)', en: 'guesthouse, B&B', bad: null },
  { word: 'sympathetic', de: 'sympathisch', en: 'nice, likeable, pleasant', bad: null },
  { word: 'realize', de: 'realisieren', en: 'implement, carry out, deliver', bad: null },
  { word: 'prove', de: 'prüfen', en: 'check, review', bad: null },
] as const;

/** Kurzfassung für Prompts: „"eventually" is NOT German "eventuell" (use: possibly, perhaps, maybe)“. */
export function falseFriendLines(max = 20): string[] {
  return FALSE_FRIENDS.slice(0, max).map((f) => `"${f.word}" is NOT German "${f.de}" (use: ${f.en})`);
}
