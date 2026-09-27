// „Eine Botschaft, drei Tonlagen“ (Lernberatung 27.09., Vorschlag 8 / V7): Sachverhalte, die
// Emrah dreimal formuliert – als Slack-Nachricht an einen Kollegen, als Mail an den CFO des
// Kunden und als gesprochener Satz im Meeting. Überwiegend aus seinem Beruf (Head of Business
// Development, Cloud-Anbieter für DMS/ECM), einige aus dem Alltag im Team. Daten, kein Code
// (A6.11) – Kennungen nie ändern, sie stehen in `tones/*`.

export type ToneKind = 'job' | 'life';
export type ToneMessage = { id: string; kind: ToneKind; de: string; en: string };

export const TONE_MESSAGES: readonly ToneMessage[] = [
  // ------------------------------------------------------------------ Beruf
  { id: 'migration-delay', kind: 'job', de: 'Die Migration des Archivs verschiebt sich um zwei Wochen, weil der Export aus dem Altsystem länger dauert.', en: 'The archive migration will be delayed by two weeks because the export from the old system is taking longer.' },
  { id: 'price-increase', kind: 'job', de: 'Die Lizenzpreise steigen ab Januar um 6 %.', en: 'License prices will go up by 6% from January.' },
  { id: 'budget-no', kind: 'job', de: 'Der gewünschte Rabatt von 15 % ist nicht möglich; höchstens 5 % bei drei Jahren Laufzeit.', en: 'The requested 15% discount is not possible; at most 5% with a three-year term.' },
  { id: 'outage', kind: 'job', de: 'Gestern Abend war das Archiv zwei Stunden nicht erreichbar. Ursache ist behoben, Daten sind vollständig.', en: 'Last night the archive was unavailable for two hours. The cause has been fixed and no data was lost.' },
  { id: 'need-data', kind: 'job', de: 'Wir brauchen bis Freitag die Liste der Dokumenttypen, sonst verschiebt sich der Projektstart.', en: 'We need the list of document types by Friday, otherwise the project start will slip.' },
  { id: 'pilot-success', kind: 'job', de: 'Der Pilot in der Buchhaltung spart pro Woche rund zehn Stunden Arbeit.', en: 'The pilot in accounting saves roughly ten hours of work per week.' },
  { id: 'scope-extra', kind: 'job', de: 'Die gewünschte Schnittstelle zu SAP ist nicht im Angebot enthalten und kostet extra.', en: 'The requested SAP interface is not included in the offer and costs extra.' },
  { id: 'invoice-overdue', kind: 'job', de: 'Die Rechnung vom August ist seit drei Wochen überfällig.', en: 'The invoice from August has been overdue for three weeks.' },
  { id: 'contract-renewal', kind: 'job', de: 'Der Vertrag läuft Ende März aus; für eine Verlängerung brauchen wir bis Ende Februar eine Entscheidung.', en: 'The contract ends in late March; for a renewal we need a decision by the end of February.' },
  { id: 'key-person-leaves', kind: 'job', de: 'Die Projektleiterin auf unserer Seite verlässt das Unternehmen; ab nächster Woche übernimmt ein Kollege.', en: 'The project lead on our side is leaving the company; a colleague will take over from next week.' },
  { id: 'security-audit', kind: 'job', de: 'Das Sicherheitsaudit ist bestanden, es gibt nur zwei kleine Auflagen.', en: 'The security audit was passed, with only two minor follow-up items.' },
  { id: 'training-moved', kind: 'job', de: 'Die Anwenderschulung muss von Dienstag auf Donnerstag verlegt werden.', en: 'The user training has to be moved from Tuesday to Thursday.' },
  { id: 'feature-not-yet', kind: 'job', de: 'Die automatische E-Rechnungsprüfung kommt erst im nächsten Quartal, nicht wie angekündigt jetzt.', en: 'Automatic e-invoice validation will only come next quarter, not now as announced.' },
  { id: 'demo-cancel', kind: 'job', de: 'Die Demo morgen fällt aus, weil unser Techniker krank ist; wir brauchen einen neuen Termin.', en: 'Tomorrow\'s demo has to be canceled because our engineer is sick; we need a new date.' },
  { id: 'data-location', kind: 'job', de: 'Alle Daten liegen ausschließlich in Rechenzentren in Deutschland.', en: 'All data is stored exclusively in data centers in Germany.' },
  { id: 'deal-lost', kind: 'job', de: 'Der Kunde hat sich für einen Wettbewerber entschieden, vor allem wegen des Preises.', en: 'The customer chose a competitor, mainly because of the price.' },
  { id: 'faster-go-live', kind: 'job', de: 'Wir können den Go-live um eine Woche vorziehen, wenn die Testdaten bis Montag da sind.', en: 'We can bring the go-live forward by one week if the test data arrives by Monday.' },
  // ------------------------------------------------------------------ Alltag im Team
  { id: 'out-sick', kind: 'life', de: 'Du bist heute krank und kannst nicht an der Besprechung teilnehmen.', en: 'You are sick today and cannot attend the meeting.' },
  { id: 'running-late', kind: 'life', de: 'Du kommst wegen eines Staus etwa 20 Minuten später.', en: 'You will be about 20 minutes late because of a traffic jam.' },
  { id: 'vacation', kind: 'life', de: 'Du bist die nächsten zwei Wochen im Urlaub; deine Kollegin vertritt dich.', en: 'You will be on vacation for the next two weeks; your colleague is covering for you.' },
];

/** Die drei Tonlagen, immer in dieser Reihenfolge. */
export const TONE_REGISTERS = ['slack', 'cfo', 'meeting'] as const;
export type ToneRegister = (typeof TONE_REGISTERS)[number];
