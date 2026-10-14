// Lagen für „Eigener Satz“ (Wörter aktivieren, Stufe 1, docs/umbau/aktivierung.md). Daten, kein Code: Die Auswahl (`domain/srs/brief.ts`)
// wählt per Hash aus Karte, Tag und Verlauf eine Lage; die Aufgabe zeigt sie als „Lage: …“. Beruf etwa zwei Drittel, Alltag ein Drittel.
// Kennungen nie ändern: der Verlaufseintrag der Karte (`hist[].a`) verweist darauf. Einfache Sprache, Du-Form, eine Zeile, zweisprachig.
// Keine Lage verrät ein Zielwort oder setzt einen bestimmten Wortschatz voraus.

export type SceneKind = 'job' | 'daily';
export type ActivationScene = { id: string; kind: SceneKind; de: string; en: string };

export const ACTIVATION_SCENES: readonly ActivationScene[] = [
  // ---- Beruf (14)
  { id: 'j01', kind: 'job', de: 'Ein Kunde fragt nach dem Stand seiner Bestellung.', en: 'A customer asks about the status of his order.' },
  { id: 'j02', kind: 'job', de: 'Du schreibst einer Kundin, deren Lieferung sich verzögert.', en: 'You are writing to a customer whose delivery is delayed.' },
  { id: 'j03', kind: 'job', de: 'Du erklärst dem Finanzchef, warum das Budget nicht reicht.', en: 'You explain to the CFO why the budget is not enough.' },
  { id: 'j04', kind: 'job', de: 'In der Projektbesprechung nennst du ein Risiko.', en: 'In the project meeting you point out a risk.' },
  { id: 'j05', kind: 'job', de: 'Du verhandelst mit einem Lieferanten über den Preis.', en: 'You negotiate the price with a supplier.' },
  { id: 'j06', kind: 'job', de: 'Du fasst das Ergebnis eines Meetings für dein Team zusammen.', en: 'You sum up the result of a meeting for your team.' },
  { id: 'j07', kind: 'job', de: 'Ein Kunde sagt, das Angebot sei zu teuer.', en: 'A customer says your offer is too expensive.' },
  { id: 'j08', kind: 'job', de: 'Du schreibst eine kurze Nachricht an eine neue Kollegin.', en: 'You write a short message to a new colleague.' },
  { id: 'j09', kind: 'job', de: 'Du bereitest die Präsentation für die Geschäftsleitung vor.', en: 'You prepare the presentation for senior management.' },
  { id: 'j10', kind: 'job', de: 'Du sagst einen Termin ab und schlägst einen neuen vor.', en: 'You cancel an appointment and suggest a new one.' },
  { id: 'j11', kind: 'job', de: 'Ein Teammitglied hat die Frist verpasst.', en: 'A team member has missed the deadline.' },
  { id: 'j12', kind: 'job', de: 'Du gibst im Quartalsgespräch ehrliches Feedback.', en: 'You give honest feedback in the quarterly review.' },
  { id: 'j13', kind: 'job', de: 'Du beantwortest eine Reklamation per E-Mail.', en: 'You answer a complaint by email.' },
  { id: 'j14', kind: 'job', de: 'Du stellst einem Neukunden dein Unternehmen vor.', en: 'You introduce your company to a new client.' },
  // ---- Alltag (5)
  { id: 'd01', kind: 'daily', de: 'Du planst mit Freunden das Wochenende.', en: 'You plan the weekend with friends.' },
  { id: 'd02', kind: 'daily', de: 'Du bestellst in einem Café, das sehr voll ist.', en: 'You order in a café that is very busy.' },
  { id: 'd03', kind: 'daily', de: 'Du verschiebst einen Arzttermin.', en: 'You reschedule a doctor’s appointment.' },
  { id: 'd04', kind: 'daily', de: 'Du fragst im Hotel nach einem ruhigeren Zimmer.', en: 'You ask the hotel for a quieter room.' },
  { id: 'd05', kind: 'daily', de: 'Dein Nachbar fragt, ob du morgen sein Paket annimmst.', en: 'Your neighbor asks whether you can take in his parcel tomorrow.' },
];

export const sceneById = (id: string): ActivationScene | undefined => ACTIVATION_SCENES.find((s) => s.id === id);

/** Text der Lage in der Oberflächensprache; `null` bei unbekannter Kennung. */
export const sceneText = (id: string, lang: 'de' | 'en'): string | null => {
  const s = sceneById(id);
  return s ? s[lang] : null;
};
