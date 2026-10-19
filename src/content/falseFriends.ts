// Falsche Freunde und Interferenzfehler deutschsprachiger Lernender (Auswertung 15.10.2026: Die KI übernahm „I suggest absolving“ und ließ
// „eventually“ im Sinn von „eventuell“ stehen). Daten, kein Code: jede Zeile nennt das deutsche Wort, das gemeint ist, die richtige englische
// Entsprechung und ein Erkennungsmuster `bad` für den eindeutigen Fehlgebrauch. Nur eindeutige Muster sperren (Selbstprüfung der korrigierten
// Fassung, `src/domain/text/correctness.ts`); `bad: null` heißt: nur Hinweis an die KI im Prompt (zu oft auch richtig verwendet).
// Die Reihenfolge ist die Reihenfolge nach Berufsrelevanz (Dokumentenmanagement, Vertrieb): `falseFriendLines` liefert alle, die wichtigen zuerst.
// Muster sind bewusst eng: Ein Treffer sperrt eine KI-Fassung („noch nicht sicher geprüft“), also lieber eine richtige Fassung durchlassen.
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
  // „eventuell“ = vielleicht. eventually = schließlich, am Ende. „We could eventually expand“ (= irgendwann) ist richtig: gesperrt nur mit naher Zeitangabe.
  { word: 'eventually', de: 'eventuell', en: 'possibly, perhaps, maybe', bad: /\b(?:could|can|would)\s+you\s+eventually\b|\beventually\b[^.!?]{0,40}\b(?:tomorrow|today|tonight|next\s+week|this\s+week)\b/i },
  // „realisieren“ = implement, carry out. „realize savings/benefits/value/ROI“ ist richtig (Wertverkauf).
  { word: 'realize', de: 'realisieren', en: 'implement, carry out (but "realize savings/value" is right)', bad: null },
  // „kontrollieren“ = check. control = beherrschen, steuern.
  { word: 'control', de: 'kontrollieren', en: 'check, verify, review', bad: /\bcontrol(?:s|led|ling)?\s+(?:the\s+)?(?:invoices?|documents?|numbers|figures|contracts?|bills?)\s+(?:for|if|whether)\b/i },
  // „aktuell“ = current. actual = tatsächlich. „the actual situation is worse“ ist richtig.
  { word: 'actual', de: 'aktuell', en: 'current, latest, up to date', bad: /\b(?:the|our)\s+actual\s+(?:version|release|status|state)\b|\bat\s+the\s+actual\s+moment\b/i },
  // „Möglichkeit zu …“ = option / chance to …; „possibility to“ + Infinitiv ist Deutsch.
  { word: 'possibility', de: 'Möglichkeit', en: 'option, opportunity, chance (to …)', bad: /\bpossibilit(?:y|ies)\s+to\s+[a-z]+/i },
  // „konsequent“ = consistent(ly). consequent = daraus folgend; das Adjektiv vor einem Nomen ist richtig („the consequent delays“).
  { word: 'consequent', de: 'konsequent', en: 'consistent(ly), rigorous(ly)', bad: /\b(?:act|acts|acting|follow|follows|following|apply|applies|applying|implement|implements|implementing|use|uses|using|proceed|proceeding|pursue|pursuing|enforce|enforcing)\s+consequently\b|\b(?:be|is|are|am|was|were|been|being|stay|stays|stayed|remain|remains|remained|very|more|really|so|too|quite)\s+consequent\b(?!\s+(?:upon|on|to)\b)|\bconsequent\s+(?:in|with|about)\b/i },
  // „sensibel“ = sensitive. sensible = vernünftig („sensible customers“ ist richtig).
  { word: 'sensible', de: 'sensibel', en: 'sensitive', bad: /\bsensible\s+(?:data|information|topics?|subjects?|issues?|matters?|documents?|content|areas?)\b/i },
  // „Provision“ (Vertrieb) = commission. provision = Bestimmung, Vorsorge.
  { word: 'provision', de: 'Provision', en: 'commission', bad: /\b(?:earn|earns|earned|receive|receives|received|get|gets|got)\s+(?:a\s+|the\s+|some\s+)?provisions?\b(?!\s+(?:of|in|that|to)\b)/i },
  // „Branche“ = industry, sector. branch = Filiale, Zweig.
  { word: 'branch', de: 'Branche', en: 'industry, sector', bad: /\bin\s+the\s+(?:software|insurance|automotive|logistics|banking|IT|pharma|retail|finance)\s+branch\b/i },
  // „zuerst“ = first of all. at first = anfangs (im Gegensatz zu später). „At first I could only read it, now …“ ist richtig.
  { word: 'at first', de: 'zuerst', en: 'first, first of all, to begin with', bad: /\bat\s+first\s*,?\s+(?:(?:we|i|you)\s+(?:need|have\s+to|must|should)|let['’]s)\b/i },
  // „prüfen“ = check, review. prove = beweisen.
  { word: 'prove', de: 'prüfen', en: 'check, review', bad: null },
  // „Billion“ = trillion (10^12). billion = Milliarde.
  { word: 'billion', de: 'Billion', en: 'trillion (German Billion = 10^12)', bad: null },
  // „Konzern“ = group, corporation. concern = Sorge.
  { word: 'concern', de: 'Konzern', en: 'group, corporation', bad: null },
  // „seriös“ = reputable, credible. serious = ernst.
  { word: 'serious', de: 'seriös', en: 'reputable, credible', bad: null },
  // „mittlerweile“ = by now, in the meantime. meanwhile = währenddessen.
  { word: 'meanwhile', de: 'mittlerweile', en: 'by now, in the meantime', bad: null },
  // „Konzept“ = plan, draft, outline. concept = Idee, Grundgedanke.
  { word: 'concept', de: 'Konzept', en: 'plan, draft, outline', bad: null },
  // „also“ = so, therefore. also = auch.
  { word: 'also', de: 'also', en: 'so, therefore', bad: null },
  // „bekommen“ = get, receive. become = werden.
  { word: 'become', de: 'bekommen', en: 'get, receive', bad: /\b(?:I|we)\s+(?:will\s+|['’]ll\s+)?bec(?:o|a)me\s+(?:an?\s+|the\s+)?(?:gift|present|offer|bill|invoice|email|mail|message|reply|discount|refund)\b/i },
  // „Chef“ = boss, manager. chef = Koch. „Our chef recommends the salmon“ ist richtig: gesperrt nur „my chef“ und „chef of the department“.
  { word: 'chef', de: 'Chef', en: 'boss, manager, supervisor', bad: /\bmy\s+chef\b|\bchef\s+of\s+(?:the\s+)?(?:department|team|sales|company|division)\b/i },
  // „Handy“ = cell phone. handy = praktisch. „a handy tool“ ist richtig: gesperrt nur, was nur das deutsche Handy sein kann („on my handy“, „my handy number“).
  { word: 'handy', de: 'Handy', en: 'cell phone, mobile phone', bad: /\b(?:on|to|via|from)\s+(?:my|your|his|her|our|their)\s+handy\b|\b(?:my|your|his|her|their)\s+handy\s*(?:number|battery|[.,!?]|$)/i },
  // „bald“ = soon. bald = kahl.
  { word: 'bald', de: 'bald', en: 'soon', bad: /\b(?:see|call|meet|talk|write|send|contact|speak|reply|respond)(?:\s+you)?\s+bald\b|\b(?:we|I)\s+(?:will|['’]ll)\s+bald\b/i },
  // „Fabrik“ = factory, plant. fabric = Stoff.
  { word: 'fabric', de: 'Fabrik', en: 'factory, plant', bad: /\b(?:production|manufacturing)\s+fabrics?\b/i },
  // „absolvieren“ = complete, finish, take (a course). absolve = freisprechen; „absolve the vendor of liability“ ist richtige Vertragssprache.
  { word: 'absolve', de: 'absolvieren', en: 'complete, finish, take (a course)', bad: /\babsolv(?:e|es|ed|ing)\b(?!(?:\s+[\w'’-]+){1,3}\s+(?:of|from)\b)/i },
  // „selbstbewusst“ = self-confident. self-conscious = befangen.
  { word: 'self-conscious', de: 'selbstbewusst', en: 'self-confident', bad: null },
  // „Pension“ (Gästehaus).
  { word: 'pension', de: 'Pension (Gästehaus)', en: 'guesthouse, B&B', bad: null },
  // „sympathisch“ = nice, likeable. sympathetic = mitfühlend.
  { word: 'sympathetic', de: 'sympathisch', en: 'nice, likeable, pleasant', bad: null },
  // „Gift“ = poison. gift = Geschenk (in den USA auch Spende: „a gift for the food bank“ ist richtig), kaum Bezug zum Beruf.
  { word: 'gift', de: 'Gift', en: 'poison', bad: null },
] as const;

/**
 * Kurzfassung für Prompts: die ersten `PROMPT_FRIENDS` Einträge (die wichtigsten für den Beruf stehen vorn; die letzten sind Randfälle ohne Berufsbezug, deren eindeutige
 * Muster die lokale Selbstprüfung ohnehin fängt), knapp („eventuell = possibly, perhaps, maybe (not "eventually")“). Nicht absolut:
 * Der Satz davor (`FALSE_FRIEND_NOTE`) sagt, dass das englische Wort bleibt, wo es englisch gebraucht wird („He could eventually expand“, „realize savings“).
 */
export const PROMPT_FRIENDS = 17;
export function falseFriendLines(max = PROMPT_FRIENDS): string[] {
  return FALSE_FRIENDS.slice(0, max).map((f) => `${f.de} = ${f.en} (not ${f.word})`);
}

/** Einleitung der Liste im Prompt: gilt nur für die deutsche Bedeutung, englisch gebrauchte Wörter bleiben. */
export const FALSE_FRIEND_NOTE = 'Wrong only if the learner means the German word; keep English words used in their English sense';
