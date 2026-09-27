// „Sag es“ (Lernberatung 27.09., V1/V2): kurze Situationen für freies Formulieren. Zwei Drittel
// aus Emrahs Beruf (Head of Business Development, Cloud-Anbieter für DMS/ECM), ein Drittel Alltag.
// Angezeigt wird die Fassung der Oberflächensprache; die Aufgabe ist immer: in 3–6 Sätzen auf
// Englisch antworten. Daten, kein Code (A6.11) – Kennungen nie ändern, sie stehen in `say/*`.

export type SayKind = 'job' | 'life';
export type Situation = { id: string; de: string; en: string; kind: SayKind };

export const SITUATIONS: readonly Situation[] = [
  // ------------------------------------------------------------------ Beruf
  { id: 'cfo-price', kind: 'job', de: 'Der CFO eines Mittelständlers sagt: „Ihr Angebot ist 20 % teurer als unser jetziges Archiv.“ Antworte ihm.', en: 'The CFO of a mid-sized company says: "Your offer is 20% more expensive than our current archive." Respond to him.' },
  { id: 'it-security', kind: 'job', de: 'Der IT-Leiter hat Bedenken, Dokumente in die Cloud zu legen. Nimm ihm die Sorge um Datenschutz und Sicherheit.', en: 'The head of IT is worried about moving documents to the cloud. Address his concerns about data protection and security.' },
  { id: 'discount', kind: 'job', de: 'Ein Kunde will 15 % Rabatt, sonst unterschreibt er nicht. Du kannst höchstens 5 % geben, wenn er für drei Jahre abschließt.', en: 'A customer wants a 15% discount or he won\'t sign. You can give 5% at most if he signs for three years.' },
  { id: 'reschedule', kind: 'job', de: 'Du musst den Termin mit einem wichtigen Interessenten morgen kurzfristig verschieben. Erkläre es und schlage zwei neue Termine vor.', en: 'You have to reschedule tomorrow\'s meeting with an important prospect at short notice. Explain why and suggest two new times.' },
  { id: 'pilot', kind: 'job', de: 'Der Kunde zögert vor dem großen Rollout. Schlage ein Pilotprojekt mit einer Abteilung für sechs Wochen vor.', en: 'The customer is hesitant about a full rollout. Suggest a six-week pilot project with one department.' },
  { id: 'status-update', kind: 'job', de: 'Im wöchentlichen Meeting sollst du kurz den Stand der drei größten Deals berichten. Einer hängt fest.', en: 'In the weekly meeting you give a short status update on your three biggest deals. One of them is stuck.' },
  { id: 'demo-follow', kind: 'job', de: 'Gestern war die Demo beim Interessenten. Fasse per Mail nach: Dank, zwei Kernpunkte, nächster Schritt.', en: 'Yesterday you gave the prospect a demo. Write a follow-up: thanks, two key points, the next step.' },
  { id: 'vida', kind: 'job', de: 'Ein Geschäftsführer fragt: „Was ist eigentlich ViDA und warum soll mich das jetzt schon interessieren?“ Erkläre es einfach.', en: 'A managing director asks: "What exactly is ViDA and why should I care about it now?" Explain it in simple terms.' },
  { id: 'einvoice', kind: 'job', de: 'Erkläre einem Kunden, was sich mit der Pflicht zur E-Rechnung in Deutschland für seine Buchhaltung ändert.', en: 'Explain to a customer what the e-invoicing mandate in Germany changes for his accounting team.' },
  { id: 'competitor', kind: 'job', de: 'Der Kunde sagt: „Ein Wettbewerber bietet fast dasselbe an.“ Arbeite heraus, was euch unterscheidet, ohne den Wettbewerber schlechtzumachen.', en: 'The customer says: "A competitor offers almost the same thing." Point out what sets you apart without badmouthing the competitor.' },
  { id: 'no-budget', kind: 'job', de: 'Die Interessentin sagt, dieses Jahr gebe es kein Budget mehr. Reagiere und halte das Gespräch offen.', en: 'The prospect says there is no budget left this year. React and keep the conversation going.' },
  { id: 'migration-delay', kind: 'job', de: 'Die Datenmigration beim Kunden verzögert sich um zwei Wochen. Informiere den Projektleiter des Kunden.', en: 'The customer\'s data migration is delayed by two weeks. Inform the customer\'s project lead.' },
  { id: 'partner-pitch', kind: 'job', de: 'Du willst ein IT-Systemhaus als Vertriebspartner gewinnen. Erkläre in wenigen Sätzen, was es davon hat.', en: 'You want to win an IT service provider as a reseller. Explain in a few sentences what\'s in it for them.' },
  { id: 'intro-call', kind: 'job', de: 'Ein Kaltakquise-Anruf: Stell dich und dein Unternehmen kurz vor und frag nach einem Termin.', en: 'A cold call: briefly introduce yourself and your company and ask for a meeting.' },
  { id: 'contract-renewal', kind: 'job', de: 'Der Vertrag eines Bestandskunden läuft in drei Monaten aus. Sprich die Verlängerung an und nenne einen Vorteil.', en: 'An existing customer\'s contract ends in three months. Bring up the renewal and mention one benefit.' },
  { id: 'upsell-workflow', kind: 'job', de: 'Ein zufriedener Archivkunde könnte das Workflow-Modul brauchen. Schlage es vor, ohne aufdringlich zu wirken.', en: 'A happy archive customer could use the workflow module. Suggest it without sounding pushy.' },
  { id: 'gobd', kind: 'job', de: 'Ein Steuerberater fragt, ob eure Lösung revisionssicher nach GoBD archiviert. Antworte klar und belegbar.', en: 'A tax advisor asks whether your solution archives in an audit-proof way under GoBD. Give a clear answer he can rely on.' },
  { id: 'escalation', kind: 'job', de: 'Ein Kunde beschwert sich über langsamen Support. Entschuldige dich und sag, was du konkret tust.', en: 'A customer complains about slow support. Apologize and say what you will do about it.' },
  { id: 'board-summary', kind: 'job', de: 'Fasse für die Geschäftsführung in wenigen Sätzen zusammen, warum ihr in den österreichischen Markt gehen solltet.', en: 'Summarize for the executive team why you should enter the Austrian market.' },
  { id: 'roi', kind: 'job', de: 'Der CFO will wissen, wann sich die Lösung rechnet. Erkläre den ROI mit einem einfachen Beispiel.', en: 'The CFO wants to know when the solution pays off. Explain the ROI with a simple example.' },
  { id: 'data-center', kind: 'job', de: 'Eine Behörde fragt, wo eure Daten liegen und wer darauf zugreifen kann. Antworte.', en: 'A public authority asks where your data is stored and who can access it. Answer them.' },
  { id: 'erp-integration', kind: 'job', de: 'Der Kunde nutzt SAP und fragt, wie aufwendig die Anbindung ist. Beruhige ihn und beschreibe den Ablauf.', en: 'The customer uses SAP and asks how much effort the integration takes. Reassure him and describe the process.' },
  { id: 'lost-deal', kind: 'job', de: 'Ihr habt einen großen Deal verloren. Frag den Kunden höflich nach den Gründen.', en: 'You lost a big deal. Politely ask the customer why.' },
  { id: 'team-kickoff', kind: 'job', de: 'Eröffne das Kick-off mit deinem Vertriebsteam für das neue Quartal: Ziel, Schwerpunkt, eine Bitte.', en: 'Open the kickoff with your sales team for the new quarter: goal, focus, one request.' },
  { id: 'trade-fair', kind: 'job', de: 'Auf der Messe spricht dich jemand am Stand an: „Was macht ihr eigentlich?“ Antworte kurz und neugierig machend.', en: 'At a trade fair someone stops at your booth: "So what do you actually do?" Give a short answer that makes them curious.' },
  { id: 'deadline-push', kind: 'job', de: 'Der Kunde möchte den Go-live um einen Monat vorziehen. Das ist knapp. Sag, was möglich ist und unter welchen Bedingungen.', en: 'The customer wants to move the go-live forward by a month. That\'s tight. Say what is possible and under which conditions.' },
  { id: 'reference', kind: 'job', de: 'Bitte einen zufriedenen Kunden, als Referenz für einen Interessenten zur Verfügung zu stehen.', en: 'Ask a happy customer to act as a reference for a prospect.' },
  // ------------------------------------------------------------------ Alltag
  { id: 'hotel-room', kind: 'life', de: 'Dein Hotelzimmer ist laut und die Klimaanlage geht nicht. Sprich an der Rezeption vor.', en: 'Your hotel room is noisy and the air conditioning doesn\'t work. Talk to the front desk.' },
  { id: 'weekend', kind: 'life', de: 'Ein Kollege aus den USA fragt am Montag: „How was your weekend?“ Erzähl ein bisschen.', en: 'A colleague from the US asks on Monday: "How was your weekend?" Tell him a little about it.' },
  { id: 'restaurant', kind: 'life', de: 'Im Restaurant ist dein Essen kalt und falsch. Beschwere dich freundlich beim Kellner.', en: 'At a restaurant your food is cold and not what you ordered. Complain politely to the server.' },
  { id: 'flight-delay', kind: 'life', de: 'Dein Anschlussflug ist weg. Kläre am Schalter, wie du heute noch nach Hause kommst.', en: 'You missed your connecting flight. Sort out at the desk how you can still get home today.' },
  { id: 'hobby', kind: 'life', de: 'Beim Abendessen mit Geschäftspartnern fragt jemand nach deinen Hobbys. Erzähl davon.', en: 'At dinner with business partners someone asks about your hobbies. Tell them about it.' },
  { id: 'recommend-city', kind: 'life', de: 'Ein Bekannter besucht zum ersten Mal deine Stadt. Empfiehl ihm, was er sehen und essen sollte.', en: 'An acquaintance is visiting your city for the first time. Recommend what to see and eat.' },
  { id: 'doctor', kind: 'life', de: 'Du bist auf Reisen krank geworden. Beschreibe dem Arzt deine Beschwerden.', en: 'You got sick while traveling. Describe your symptoms to the doctor.' },
  { id: 'neighbor', kind: 'life', de: 'Dein Nachbar feiert oft bis spät in die Nacht. Sprich ihn freundlich, aber klar darauf an.', en: 'Your neighbor often has parties until late at night. Bring it up with him in a friendly but clear way.' },
  { id: 'car-rental', kind: 'life', de: 'Bei der Mietwagenrückgabe soll ein Kratzer von dir sein, der schon vorher da war. Widersprich höflich.', en: 'When you return a rental car, they say a scratch is your fault, but it was already there. Object politely.' },
  { id: 'news', kind: 'life', de: 'Erzähl einem Freund von einer Nachricht, die dich diese Woche beschäftigt hat, und was du darüber denkst.', en: 'Tell a friend about a news story that caught your attention this week and what you think about it.' },
  { id: 'gym', kind: 'life', de: 'Du willst im Fitnessstudio deinen Vertrag pausieren. Erkläre den Grund und frag nach den Bedingungen.', en: 'You want to pause your gym membership. Explain why and ask about the conditions.' },
  { id: 'gift', kind: 'life', de: 'Du suchst in einem Geschäft ein Geschenk für jemanden. Beschreibe der Verkäuferin, was du dir vorstellst.', en: 'You\'re looking for a gift in a store. Describe to the sales assistant what you have in mind.' },
  { id: 'plans', kind: 'life', de: 'Ein Freund fragt, was du im nächsten Jahr erreichen willst – beruflich und privat. Antworte.', en: 'A friend asks what you want to achieve next year, at work and in your personal life. Answer him.' },
];

/** Situation nach Kennung. */
export const situationById = (id: string): Situation | undefined => SITUATIONS.find((s) => s.id === id);
