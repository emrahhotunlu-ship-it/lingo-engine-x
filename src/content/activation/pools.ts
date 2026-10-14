// Vorgaben-Pools für die Aktivierungs-Aufgaben A2–A5 (Wörter aktivieren, Stufe 2; docs/umbau/aktivierung.md, „Variation erzwingen“).
// Daten, kein Code: Die Auswahl (`domain/srs/actBrief.ts`) wählt per Hash aus Karte, Tag und Verlauf. Kennungen NIE ändern: Der Verlaufseintrag
// der Karte (`hist[].a`) und die Sammelakte `act/<Monat>` verweisen darauf. Einfache Sprache, Du-Form, zweisprachig, US-Englisch.
// Die Texte stehen unter Vorbehalt der Gegenlesung durch den Englischlehrer (Charge folgt).

export type PoolKind = 'job' | 'daily';
/** Ton: c = locker, n = neutral, f = formell. */
export type PoolTone = 'c' | 'n' | 'f';
const ALL: readonly PoolTone[] = ['c', 'n', 'f'];
const CN: readonly PoolTone[] = ['c', 'n'];
const NF: readonly PoolTone[] = ['n', 'f'];

// ------------------------------------------------------------------ Rollen (Gegenüber)

export type ActRole = { id: string; kind: PoolKind; de: string; en: string; tones: readonly PoolTone[] };

/** Rollen im Beruf sitzen meist beim Kunden (Emrah verkauft): „beim Kunden“ steht dabei, damit klar ist, wer spricht (Englischlehrer A9). */
export const ACT_ROLES: readonly ActRole[] = [
  { id: 'buy', kind: 'job', de: 'Einkaufsleiter beim Kunden', en: 'Head of procurement at a prospect', tones: NF },
  { id: 'it', kind: 'job', de: 'IT-Leiter beim Kunden', en: 'Head of IT at a client', tones: ALL },
  { id: 'cfo', kind: 'job', de: 'Finanzchef (CFO) beim Kunden', en: 'CFO at a client', tones: NF },
  { id: 'team', kind: 'job', de: 'Dein Team', en: 'Your team', tones: CN },
  { id: 'boss', kind: 'job', de: 'Dein Chef', en: 'Your boss', tones: ALL },
  { id: 'partner', kind: 'job', de: 'Kontakt bei einer Partnerfirma', en: 'A contact at a partner company', tones: NF },
  { id: 'friend', kind: 'daily', de: 'Ein Freund', en: 'A friend', tones: CN },
  { id: 'neighbor', kind: 'daily', de: 'Dein Nachbar', en: 'Your neighbor', tones: CN },
  { id: 'landlord', kind: 'daily', de: 'Dein Vermieter', en: 'Your landlord', tones: NF },
  { id: 'staff', kind: 'daily', de: 'Ein Service-Mitarbeiter', en: 'A customer service rep', tones: NF },
];

// ------------------------------------------------------------------ Lagen ohne Gegenüber (das Gegenüber kommt aus den Rollen)

export type ActEvent = { id: string; kind: PoolKind; de: string; en: string; tones: readonly PoolTone[] };

export const ACT_EVENTS: readonly ActEvent[] = [
  { id: 'e01', kind: 'job', de: 'Die Einführung verzögert sich um zwei Wochen.', en: 'The rollout is delayed by two weeks.', tones: ALL },
  { id: 'e02', kind: 'job', de: 'Das Angebot liegt über dem Budget.', en: 'The proposal comes in over budget.', tones: NF },
  { id: 'e03', kind: 'job', de: 'Ein wichtiger Kunde droht zu kündigen.', en: 'An important client is threatening to cancel.', tones: NF },
  { id: 'e04', kind: 'job', de: 'Ein Lieferant liefert zu spät.', en: 'A supplier is delivering late.', tones: ALL },
  { id: 'e05', kind: 'job', de: 'Die Pilotphase war erfolgreich.', en: 'The pilot phase was a success.', tones: ALL },
  { id: 'e06', kind: 'job', de: 'Zwei Teams brauchen dieselben Leute.', en: 'Two teams need the same people.', tones: CN },
  { id: 'e07', kind: 'job', de: 'Die Sicherheitsprüfung hat Lücken gefunden.', en: 'The security review found gaps.', tones: NF },
  { id: 'e08', kind: 'job', de: 'Der Vertrag läuft nächsten Monat aus.', en: 'The contract expires next month.', tones: NF },
  { id: 'e09', kind: 'job', de: 'Die Kosten für das Projekt steigen.', en: 'Project costs are rising.', tones: ALL },
  { id: 'e10', kind: 'job', de: 'Ein neuer Wettbewerber kommt auf den Markt.', en: 'A new competitor is entering the market.', tones: ALL },
  { id: 'e11', kind: 'job', de: 'Die Entscheidung wird schon wieder verschoben.', en: 'The decision is being postponed again.', tones: ALL },
  { id: 'e12', kind: 'job', de: 'Die Zahlen des Quartals sind besser als geplant.', en: "This quarter's numbers came in ahead of plan.", tones: ALL },
  { id: 'e13', kind: 'job', de: 'Eine Schulung für neue Nutzer steht an.', en: 'A training session for new users is coming up.', tones: ALL },
  { id: 'e14', kind: 'job', de: 'Die Daten aus dem alten System sind noch nicht übernommen.', en: "The data from the old system hasn't been migrated yet.", tones: ALL },
  { id: 'e15', kind: 'job', de: 'Es gibt ein Missverständnis über den Umfang.', en: 'There is a misunderstanding about the scope.', tones: NF },
  { id: 'e16', kind: 'job', de: 'Der Termin für die Abnahme steht fest.', en: 'The sign-off date has been set.', tones: ALL },
  { id: 'e17', kind: 'daily', de: 'Dein Paket ist nicht angekommen.', en: "Your package hasn't arrived.", tones: ALL },
  { id: 'e18', kind: 'daily', de: 'Ein Termin passt dir nicht mehr.', en: 'An appointment no longer works for you.', tones: ALL },
  { id: 'e19', kind: 'daily', de: 'Auf der Rechnung ist ein Fehler.', en: 'There is a mistake on the bill.', tones: NF },
  { id: 'e20', kind: 'daily', de: 'Das Wetter macht deinen Plan kaputt.', en: 'The weather is ruining your plans.', tones: CN },
  { id: 'e21', kind: 'daily', de: 'Du suchst eine Empfehlung für ein Restaurant.', en: 'You are looking for a restaurant recommendation.', tones: CN },
];

// ------------------------------------------------------------------ Textsorten

/** `roles`: Gegenüber, die zur Textsorte passen (`null` = alle). Eine LinkedIn-Nachricht an den Chef oder ein Absatz im Angebot an das eigene Team gibt es nicht. */
export type ActTextType = { id: string; de: string; en: string; tones: readonly PoolTone[]; roles: readonly string[] | null };

/** `de` ohne Artikel („als E-Mail“), `en` mit Artikel („as an email“). */
export const ACT_TYPES: readonly ActTextType[] = [
  { id: 'mail', de: 'E-Mail', en: 'an email', tones: ALL, roles: null },
  { id: 'slack', de: 'Slack-Nachricht', en: 'a Slack message', tones: CN, roles: ['team', 'boss', 'it'] },
  { id: 'notes', de: 'Meeting-Notiz', en: 'a meeting recap', tones: ['n'], roles: ['team', 'boss'] },
  { id: 'linkedin', de: 'LinkedIn-Nachricht', en: 'a LinkedIn message', tones: CN, roles: ['partner', 'buy', 'it', 'cfo'] },
  { id: 'offer', de: 'Absatz im Angebot', en: 'a paragraph in a proposal', tones: NF, roles: ['buy', 'it', 'cfo', 'partner'] },
  { id: 'summary', de: 'Zusammenfassung', en: 'a summary', tones: ['n', 'f'], roles: null },
];

// ------------------------------------------------------------------ Kundenmails (A5)

/** Antwortziel der Kundenmail (A5): was die Antwort leisten soll – a bestätigen, d ablehnen + Alternative, q Rückfrage stellen, f Problem lösen + Frist. */
export type MailGoal = 'a' | 'd' | 'q' | 'f';
/** `goals`: nur Ziele, die zur Mail natürlich passen (sonst bekäme eine gute Antwort „Vorgabe verfehlt“, Englischlehrer A2). `de` = Übersetzung. */
export type ActMail = { id: string; en: string; de: string; tones: readonly PoolTone[]; goals: readonly MailGoal[] };

/** Kurze Mails von Kunden, auf die Emrah antwortet. Englisch (US, Kurzformen wie in echten Mails); sie enthalten keine Zielwörter (die Auswahl prüft das je Karte). */
export const ACT_MAILS: readonly ActMail[] = [
  { id: 'm01', en: "Hi, the go-live date keeps moving. Our team can't plan around this. Can you tell me what's going on and when we'll actually start?", de: 'Hallo, der Starttermin verschiebt sich ständig. Unser Team kann so nicht planen. Können Sie mir sagen, was los ist und wann wir wirklich anfangen?', tones: NF, goals: ['a', 'f'] },
  { id: 'm02', en: 'Hello, we compared your quote with two other providers. Yours is the most expensive. Why should we choose you?', de: 'Guten Tag, wir haben Ihr Angebot mit zwei anderen Anbietern verglichen. Ihres ist das teuerste. Warum sollten wir uns für Sie entscheiden?', tones: NF, goals: ['a', 'q'] },
  { id: 'm03', en: "Hi, our IT department has questions about where the data is stored and who can see it. Can you send us something we can forward to them?", de: 'Hallo, unsere IT-Abteilung hat Fragen dazu, wo die Daten liegen und wer sie sehen kann. Können Sie uns etwas schicken, das wir weiterleiten können?', tones: NF, goals: ['a', 'q'] },
  { id: 'm04', en: "Hello, thanks for the demo last week. My boss liked it, but she wants to know how long the switch from our old tool would take.", de: 'Guten Tag, danke für die Vorführung letzte Woche. Meiner Chefin hat sie gefallen, aber sie möchte wissen, wie lange der Wechsel von unserem alten Werkzeug dauern würde.', tones: NF, goals: ['a', 'q'] },
  { id: 'm05', en: "Hi, two of my colleagues haven't been able to log in since yesterday. We have a deadline on Friday. Please help us as soon as possible.", de: 'Hallo, zwei meiner Kollegen können sich seit gestern nicht mehr anmelden. Wir haben am Freitag eine Frist. Bitte helfen Sie uns so schnell wie möglich.', tones: ALL, goals: ['f', 'a'] },
  { id: 'm06', en: "Hello, our contract ends in six weeks. Before we decide on a renewal, I'd like to talk about what we're getting for the price.", de: 'Guten Tag, unser Vertrag endet in sechs Wochen. Bevor wir über eine Verlängerung entscheiden, möchte ich darüber sprechen, was wir für den Preis bekommen.', tones: NF, goals: ['a', 'd', 'q'] },
  { id: 'm07', en: 'Hi, can we move our call from Thursday to next week? And could you send the agenda in advance?', de: 'Hallo, können wir unser Telefonat von Donnerstag auf nächste Woche verschieben? Und könnten Sie vorab die Tagesordnung schicken?', tones: ALL, goals: ['a', 'd'] },
  { id: 'm08', en: "Hello, I read your latest report. The numbers for the Midwest region don't match what we expected. Can you explain the difference?", de: 'Guten Tag, ich habe Ihren letzten Bericht gelesen. Die Zahlen für die Region Mittlerer Westen passen nicht zu dem, was wir erwartet haben. Können Sie den Unterschied erklären?', tones: NF, goals: ['q', 'f'] },
  { id: 'm09', en: "Hi, we're happy with SharePoint and don't see why we should switch. Can you give me one good reason to take another look?", de: 'Hallo, wir sind mit SharePoint zufrieden und sehen nicht, warum wir wechseln sollten. Können Sie mir einen guten Grund nennen, noch einmal hinzuschauen?', tones: ALL, goals: ['q', 'a'] },
  { id: 'm10', en: "Hello, our budget has been frozen until the end of the year, so I can't sign anything right now. Can we pick this up in January?", de: 'Guten Tag, unser Budget ist bis Jahresende eingefroren, deshalb kann ich jetzt nichts unterschreiben. Können wir im Januar weitermachen?', tones: NF, goals: ['a', 'd'] },
  { id: 'm11', en: "Hi, just send me some documents and I'll take a look when I find the time.", de: 'Hallo, schicken Sie mir einfach ein paar Unterlagen, ich schaue sie an, wenn ich Zeit habe.', tones: ALL, goals: ['q', 'a'] },
  { id: 'm12', en: 'Hello, our purchasing department wants a 20 percent discount before they approve the order. Is there anything you can do?', de: 'Guten Tag, unser Einkauf will 20 Prozent Rabatt, bevor er die Bestellung freigibt. Können Sie da etwas tun?', tones: NF, goals: ['d', 'q'] },
  { id: 'm13', en: 'Hi, our works council and our data protection officer both have to sign off before we can go ahead. What do they need from you?', de: 'Hallo, unser Betriebsrat und unser Datenschutzbeauftragter müssen beide zustimmen, bevor wir loslegen können. Was brauchen sie von Ihnen?', tones: NF, goals: ['q', 'a'] },
  { id: 'm14', en: "Hello, before we sign, I'd like to talk to a customer in our industry who already uses your solution. Can you set that up?", de: 'Guten Tag, bevor wir unterschreiben, möchte ich mit einem Kunden aus unserer Branche sprechen, der Ihre Lösung schon nutzt. Können Sie das einrichten?', tones: NF, goals: ['a', 'd', 'f'] },
  { id: 'm15', en: "Hi, last month's invoice shows a license fee we never agreed to. Can you check this and get back to me by Wednesday?", de: 'Hallo, auf der Rechnung vom letzten Monat steht eine Lizenzgebühr, die wir nie vereinbart haben. Können Sie das prüfen und sich bis Mittwoch melden?', tones: ALL, goals: ['f', 'a'] },
  { id: 'm16', en: "Hello, we're thinking about starting with a smaller package. What would you leave out, and what can't we do without?", de: 'Guten Tag, wir überlegen, mit einem kleineren Paket zu starten. Was würden Sie weglassen, und worauf können wir nicht verzichten?', tones: NF, goals: ['q', 'a'] },
  { id: 'm17', en: "Hi, the training for our new users is next Tuesday, but I haven't received any materials yet. Can you send them today?", de: 'Hallo, die Schulung für unsere neuen Nutzer ist nächsten Dienstag, aber ich habe noch keine Unterlagen bekommen. Können Sie sie heute schicken?', tones: ALL, goals: ['f', 'a'] },
  { id: 'm18', en: 'Hello, another vendor offered us a free trial for six months. Can you match that, or at least come close?', de: 'Guten Tag, ein anderer Anbieter hat uns eine kostenlose Testphase von sechs Monaten angeboten. Können Sie da mithalten oder zumindest nahekommen?', tones: NF, goals: ['d', 'q'] },
  { id: 'm19', en: "Hi, we've been using the system for three months now, and some people still don't know how to use it. What would you suggest?", de: 'Hallo, wir nutzen das System jetzt seit drei Monaten, und manche wissen immer noch nicht, wie es geht. Was würden Sie vorschlagen?', tones: ALL, goals: ['q', 'a'] },
  { id: 'm20', en: 'Hello, our CEO wants a short summary of the project status by tomorrow morning. Can you put one together?', de: 'Guten Tag, unser Geschäftsführer möchte bis morgen früh eine kurze Zusammenfassung des Projektstands. Können Sie eine zusammenstellen?', tones: NF, goals: ['a', 'f'] },
];

// ------------------------------------------------------------------ Antwortziele der Kundenmail, Erweiterungen, Umschreibungen

/** Antwortziel der Kundenmail (A5): was die Antwort leisten soll. */
export const MAIL_GOALS = ['a', 'd', 'q', 'f'] as const satisfies readonly MailGoal[];
/** Satz erweitern (A3): Grund, Folge, Beispiel, Gegensatz. */
export const EXTEND_KINDS = ['r', 'c', 'e', 'x'] as const;
/** Umschreiben (A3): kürzer, konkreter, anderer Satzanfang. */
export const REWRITE_KINDS = ['k', 'p', 'o'] as const;

export type ActPools = {
  roles: readonly ActRole[];
  events: readonly ActEvent[];
  types: readonly ActTextType[];
  mails: readonly ActMail[];
};
export const ACT_POOLS: ActPools = { roles: ACT_ROLES, events: ACT_EVENTS, types: ACT_TYPES, mails: ACT_MAILS };

export const roleById = (id: string): ActRole | undefined => ACT_ROLES.find((r) => r.id === id);
export const eventById = (id: string): ActEvent | undefined => ACT_EVENTS.find((e) => e.id === id);
export const typeById = (id: string): ActTextType | undefined => ACT_TYPES.find((t) => t.id === id);
export const mailById = (id: string): ActMail | undefined => ACT_MAILS.find((m) => m.id === id);

/**
 * Töne, die in den genannten Mengen glaubwürdig sind. Eine Menge wird nur angewendet, wenn mindestens zwei Töne übrig bleiben (lieber ein Ton, der
 * weniger gut passt, als keine Abwechslung). Nie leer.
 */
export function toneOptions(...sets: ReadonlyArray<readonly PoolTone[]>): PoolTone[] {
  let cur: PoolTone[] = [...ALL];
  for (const s of sets) {
    const next = cur.filter((t) => s.includes(t));
    if (next.length >= 2) cur = next;
  }
  return cur;
}
