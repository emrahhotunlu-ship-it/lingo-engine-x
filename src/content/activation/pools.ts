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

export const ACT_ROLES: readonly ActRole[] = [
  { id: 'buy', kind: 'job', de: 'Einkaufsleiter', en: 'Head of purchasing', tones: NF },
  { id: 'it', kind: 'job', de: 'IT-Leiter', en: 'Head of IT', tones: ALL },
  { id: 'cfo', kind: 'job', de: 'Finanzchef (CFO)', en: 'CFO', tones: NF },
  { id: 'team', kind: 'job', de: 'Dein Team', en: 'Your team', tones: CN },
  { id: 'boss', kind: 'job', de: 'Dein Chef', en: 'Your boss', tones: ALL },
  { id: 'partner', kind: 'job', de: 'Partnerfirma', en: 'A partner company', tones: NF },
  { id: 'friend', kind: 'daily', de: 'Ein Freund', en: 'A friend', tones: CN },
  { id: 'neighbor', kind: 'daily', de: 'Dein Nachbar', en: 'Your neighbor', tones: CN },
  { id: 'landlord', kind: 'daily', de: 'Dein Vermieter', en: 'Your landlord', tones: NF },
  { id: 'staff', kind: 'daily', de: 'Ein Service-Mitarbeiter', en: 'A service employee', tones: NF },
];

// ------------------------------------------------------------------ Lagen ohne Gegenüber (das Gegenüber kommt aus den Rollen)

export type ActEvent = { id: string; kind: PoolKind; de: string; en: string; tones: readonly PoolTone[] };

export const ACT_EVENTS: readonly ActEvent[] = [
  { id: 'e01', kind: 'job', de: 'Die Einführung verzögert sich um zwei Wochen.', en: 'The rollout is delayed by two weeks.', tones: ALL },
  { id: 'e02', kind: 'job', de: 'Das Angebot liegt über dem, was eingeplant war.', en: 'The proposal is above what was planned.', tones: NF },
  { id: 'e03', kind: 'job', de: 'Ein wichtiger Kunde droht zu kündigen.', en: 'An important client is threatening to cancel.', tones: NF },
  { id: 'e04', kind: 'job', de: 'Ein Lieferant liefert zu spät.', en: 'A supplier is delivering late.', tones: ALL },
  { id: 'e05', kind: 'job', de: 'Die Testphase war erfolgreich.', en: 'The pilot phase was a success.', tones: ALL },
  { id: 'e06', kind: 'job', de: 'Zwei Teams brauchen dieselben Leute.', en: 'Two teams need the same people.', tones: CN },
  { id: 'e07', kind: 'job', de: 'Die Sicherheitsprüfung hat Lücken gefunden.', en: 'The security review found gaps.', tones: NF },
  { id: 'e08', kind: 'job', de: 'Der Vertrag läuft nächsten Monat aus.', en: 'The contract expires next month.', tones: NF },
  { id: 'e09', kind: 'job', de: 'Die Kosten für das Projekt steigen.', en: 'The costs of the project are rising.', tones: ALL },
  { id: 'e10', kind: 'job', de: 'Ein neuer Wettbewerber kommt auf den Markt.', en: 'A new competitor is entering the market.', tones: ALL },
  { id: 'e11', kind: 'job', de: 'Die Entscheidung wird schon wieder verschoben.', en: 'The decision is being postponed again.', tones: ALL },
  { id: 'e12', kind: 'job', de: 'Die Zahlen des Quartals sind besser als geplant.', en: "This quarter's numbers are better than planned.", tones: ALL },
  { id: 'e13', kind: 'job', de: 'Eine Schulung für neue Nutzer steht an.', en: 'A training session for new users is coming up.', tones: ALL },
  { id: 'e14', kind: 'job', de: 'Die Daten aus dem alten System fehlen noch.', en: 'The data from the old system is still missing.', tones: ALL },
  { id: 'e15', kind: 'job', de: 'Es gibt ein Missverständnis über den Umfang.', en: 'There is a misunderstanding about the scope.', tones: NF },
  { id: 'e16', kind: 'job', de: 'Der Termin für die Abnahme steht fest.', en: 'The date for the final sign-off is set.', tones: ALL },
  { id: 'e17', kind: 'daily', de: 'Dein Paket ist nicht angekommen.', en: "Your package didn't arrive.", tones: ALL },
  { id: 'e18', kind: 'daily', de: 'Ein Termin passt dir nicht mehr.', en: 'An appointment no longer works for you.', tones: ALL },
  { id: 'e19', kind: 'daily', de: 'Auf der Rechnung steckt ein Fehler.', en: 'There is a mistake on the bill.', tones: NF },
  { id: 'e20', kind: 'daily', de: 'Das Wetter macht deinen Plan kaputt.', en: 'The weather ruins your plan.', tones: CN },
  { id: 'e21', kind: 'daily', de: 'Du suchst eine Empfehlung für ein Restaurant.', en: 'You are looking for a restaurant recommendation.', tones: CN },
];

// ------------------------------------------------------------------ Textsorten

export type ActTextType = { id: string; de: string; en: string; tones: readonly PoolTone[] };

/** `de` ohne Artikel („als E-Mail“), `en` mit Artikel („as an email“). */
export const ACT_TYPES: readonly ActTextType[] = [
  { id: 'mail', de: 'E-Mail', en: 'an email', tones: ALL },
  { id: 'slack', de: 'Slack-Nachricht', en: 'a Slack message', tones: CN },
  { id: 'notes', de: 'Meeting-Notiz', en: 'a meeting note', tones: ['n'] },
  { id: 'linkedin', de: 'LinkedIn-Nachricht', en: 'a LinkedIn message', tones: NF },
  { id: 'offer', de: 'Absatz im Angebot', en: 'a paragraph in a proposal', tones: NF },
  { id: 'summary', de: 'Zusammenfassung', en: 'a summary', tones: ['n', 'f'] },
];

// ------------------------------------------------------------------ Kundenmails (A5)

export type ActMail = { id: string; en: string; tones: readonly PoolTone[] };

/** Kurze Mails von Kunden, auf die Emrah antwortet. Englisch (US); sie enthalten keine Zielwörter (die Auswahl prüft das je Karte). */
export const ACT_MAILS: readonly ActMail[] = [
  { id: 'm01', en: "Hi, the go-live date keeps moving. Our team can't plan around this. Can you tell me what is going on and when we will actually start?", tones: NF },
  { id: 'm02', en: 'Hello, we compared your offer with two other providers. Yours is the most expensive one. Why should we choose you?', tones: NF },
  { id: 'm03', en: "Hi, our IT department has questions about where the data is stored and who can see it. Can you send us something we can forward to them?", tones: NF },
  { id: 'm04', en: "Hello, thanks for the demo last week. My boss liked it, but she wants to know how long the switch from our old tool would take.", tones: NF },
  { id: 'm05', en: "Hi, two of my colleagues can't log in since yesterday. We have a deadline on Friday. Please help us as soon as possible.", tones: ALL },
  { id: 'm06', en: "Hello, our contract ends in six weeks. Before we decide on a renewal, I would like to talk about what we get for the price.", tones: NF },
  { id: 'm07', en: 'Hi, can we move our call from Thursday to next week? And could you send the agenda in advance?', tones: ALL },
  { id: 'm08', en: "Hello, I read your last report. The numbers for the second region don't match what we expected. Can you explain the difference?", tones: NF },
];

// ------------------------------------------------------------------ Antwortziele der Kundenmail, Erweiterungen, Umschreibungen

/** Antwortziel der Kundenmail (A5): was die Antwort leisten soll. */
export const MAIL_GOALS = ['a', 'd', 'q', 'f'] as const;
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
