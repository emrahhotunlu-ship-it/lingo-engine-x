// Lagen für „Eigener Satz“ (Wörter aktivieren, Stufe 1, docs/umbau/aktivierung.md). Daten, kein Code: Die Auswahl (`domain/srs/brief.ts`)
// wählt per Hash aus Karte, Tag und Verlauf eine Lage; die Aufgabe zeigt sie als „Lage: …“. Beruf etwa zwei Drittel, Alltag ein Drittel.
// Kennungen nie ändern: der Verlaufseintrag der Karte (`hist[].a`) verweist darauf. Einfache Sprache, Du-Form, eine Zeile, zweisprachig.
// Die Lage soll das Zielwort nicht verraten: steht es doch darin, überspringt die Auswahl sie (`sceneLeaks`). Je Lage nennt `tones` die glaubwürdigen Töne.

export type SceneKind = 'job' | 'daily';
/** Töne, die in der Lage glaubwürdig sind: c = locker, n = neutral, f = formell. Fehlt das Feld, passen alle drei. */
export type SceneTone = 'c' | 'n' | 'f';
export type ActivationScene = { id: string; kind: SceneKind; de: string; en: string; tones?: readonly SceneTone[] };

const CN: readonly SceneTone[] = ['c', 'n'];
const NF: readonly SceneTone[] = ['n', 'f'];

export const ACTIVATION_SCENES: readonly ActivationScene[] = [
  // ---- Beruf (21): Verkauf und Business Development für Cloud-Software, Kundengespräche, Team
  { id: 'j01', kind: 'job', de: 'Ein Kunde fragt, wie weit die Einführung bei ihm ist.', en: 'A client asks how their implementation is going.' },
  { id: 'j02', kind: 'job', de: 'Du schreibst einer Kundin, dass sich ihr Go-live verzögert.', en: 'You write to a client whose go-live has been delayed.' },
  { id: 'j03', kind: 'job', de: 'Du erklärst dem Finanzchef, warum das Budget nicht reicht.', en: "You explain to the CFO why the budget isn't enough.", tones: NF },
  { id: 'j04', kind: 'job', de: 'In der Projektbesprechung nennst du ein Risiko.', en: 'In the project meeting you point out a risk.', tones: CN },
  { id: 'j05', kind: 'job', de: 'Ein Kunde will 20 % Rabatt. Du verhandelst.', en: 'A client wants a 20% discount. You negotiate.' },
  { id: 'j06', kind: 'job', de: 'Du fasst das Ergebnis eines Meetings für dein Team zusammen.', en: 'You sum up the outcome of a meeting for your team.', tones: CN },
  { id: 'j07', kind: 'job', de: 'Ein Kunde sagt, dein Angebot sei zu teuer.', en: 'A customer says your proposal is too expensive.' },
  { id: 'j08', kind: 'job', de: 'Du schreibst eine kurze Nachricht an eine neue Kollegin.', en: 'You write a short message to a new colleague.', tones: CN },
  { id: 'j09', kind: 'job', de: 'Du stellst der Geschäftsleitung die Quartalszahlen vor.', en: 'You present the quarterly numbers to the leadership team.', tones: NF },
  { id: 'j10', kind: 'job', de: 'Du sagst einen Termin ab und schlägst einen neuen vor.', en: 'You cancel a meeting and suggest a new time.' },
  { id: 'j11', kind: 'job', de: 'Ein Teammitglied hat eine Frist verpasst. Du sprichst es an.', en: 'A team member missed a deadline. You bring it up with them.', tones: CN },
  { id: 'j12', kind: 'job', de: 'Du gibst im Quartalsgespräch ehrliches Feedback.', en: 'You give honest feedback in the quarterly review.' },
  { id: 'j13', kind: 'job', de: 'Du beantwortest eine Reklamation per E-Mail.', en: 'You respond to a customer complaint by email.', tones: NF },
  { id: 'j14', kind: 'job', de: 'Du stellst einem Interessenten dein Unternehmen vor.', en: 'You introduce your company to a prospect.', tones: NF },
  { id: 'j15', kind: 'job', de: 'Im Erstgespräch fragst du, wie der Kunde heute mit seinen Dokumenten arbeitet.', en: 'In the first call, you ask how the client handles documents today.', tones: NF },
  { id: 'j16', kind: 'job', de: 'Nach einer Demo schreibst du dem Interessenten eine Follow-up-Mail.', en: 'After a demo, you write a follow-up email to the prospect.', tones: NF },
  { id: 'j17', kind: 'job', de: 'Ein Interessent hat Bedenken wegen Datenschutz und Hosting.', en: 'A prospect is worried about data privacy and hosting.', tones: NF },
  { id: 'j18', kind: 'job', de: 'Ein Interessent fürchtet, dass der Umstieg zu aufwendig wird.', en: 'A prospect fears that switching systems will take too much effort.', tones: NF },
  { id: 'j19', kind: 'job', de: 'Du sprichst mit einem Bestandskunden über die Vertragsverlängerung.', en: 'You talk to an existing client about renewing their contract.', tones: NF },
  { id: 'j20', kind: 'job', de: 'Du schreibst einem neuen Kontakt auf LinkedIn zum ersten Mal.', en: 'You send a first message to a new contact on LinkedIn.', tones: CN },
  { id: 'j21', kind: 'job', de: 'Nach dem Abschluss übergibst du den Kunden an das Customer-Success-Team.', en: 'After the deal closes, you hand the client over to the customer success team.', tones: CN },
  // ---- Alltag (9)
  { id: 'd01', kind: 'daily', de: 'Du planst mit Freunden das Wochenende.', en: 'You plan the weekend with friends.', tones: CN },
  { id: 'd02', kind: 'daily', de: 'Du bestellst in einem Café, das sehr voll ist.', en: 'You order in a café that is very busy.', tones: CN },
  { id: 'd03', kind: 'daily', de: 'Du verschiebst einen Arzttermin.', en: 'You reschedule a doctor’s appointment.', tones: NF },
  { id: 'd04', kind: 'daily', de: 'Du fragst im Hotel nach einem ruhigeren Zimmer.', en: 'You ask the hotel for a quieter room.', tones: NF },
  { id: 'd05', kind: 'daily', de: 'Dein Nachbar fragt, ob du morgen sein Paket annimmst.', en: 'Your neighbor asks if you can sign for his package tomorrow.', tones: CN },
  { id: 'd06', kind: 'daily', de: 'Du gibst im Laden einen Pullover zurück.', en: 'You return a sweater to a store.', tones: CN },
  { id: 'd07', kind: 'daily', de: 'Du sagst im Restaurant, dass du allergisch bist.', en: 'You tell the server at a restaurant about your food allergy.', tones: CN },
  { id: 'd08', kind: 'daily', de: 'Es gibt ein Problem mit deinem Mietwagen.', en: 'There is a problem with your rental car.', tones: NF },
  { id: 'd09', kind: 'daily', de: 'Du rufst den Vermieter an, weil die Heizung nicht funktioniert.', en: "You call your landlord because the heat isn't working.", tones: NF },
];

/** Erlaubte Töne der Lage (immer mindestens zwei). */
export const tonesOf = (s: Pick<ActivationScene, 'tones'>): readonly SceneTone[] => s.tones ?? ['c', 'n', 'f'];

/**
 * Verrät die Lage das Zielwort? Dann wird sie für diese Karte übersprungen (die Aufgabe wäre sonst geschenkt). Vergleich ohne Groß-/Kleinschreibung
 * gegen beide Sprachen (Budget, Feedback, Risiko …): ab 5 Buchstaben am Wortanfang (complain → complaint), kürzere Wörter nur ganz.
 */
export function sceneLeaks(s: Pick<ActivationScene, 'de' | 'en'>, lemma: string): boolean {
  const l = lemma.toLowerCase().trim().replace(/[^a-z' -]/g, '');
  if (l.length < 3) return false;
  const words = l.split(/\s+/).filter((w) => w.length >= 3);
  const text = `${s.en} ${s.de}`.toLowerCase();
  return words.some((w) => new RegExp(`(?:^|[^a-zäöüß])${w}${w.length >= 5 ? '' : '(?![a-zäöüß])'}`).test(text));
}

export const sceneById = (id: string): ActivationScene | undefined => ACTIVATION_SCENES.find((s) => s.id === id);

/** Text der Lage in der Oberflächensprache; `null` bei unbekannter Kennung. */
export const sceneText = (id: string, lang: 'de' | 'en'): string | null => {
  const s = sceneById(id);
  return s ? s[lang] : null;
};
