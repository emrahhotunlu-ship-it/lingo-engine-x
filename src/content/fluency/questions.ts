// Flüssigkeit 90 – 60 – 45 (Lernberatung 27.09., V6 / Vorschlag 5): Fragen für die 4-3-2-Übung.
// Überwiegend aus Emrahs Beruf (Head of Business Development, Cloud-Anbieter für DMS/ECM), dazu
// wenige Alltagsfragen. Die Frage steht immer auf Englisch (sie wird auf Englisch beantwortet),
// `de` ist nur die Lesehilfe. Daten, kein Code (A6.11) – Kennungen nie ändern, sie stehen in `fluency/*`.

export type FluencyKind = 'job' | 'life';
export type FluencyQuestion = { id: string; en: string; de: string; kind: FluencyKind };

export const FLUENCY_QUESTIONS: readonly FluencyQuestion[] = [
  // ------------------------------------------------------------------ Beruf
  { id: 'cloud-archive', kind: 'job', en: 'Why should a mid-sized company move its archive to the cloud?', de: 'Warum sollte ein Mittelständler sein Archiv in die Cloud verlegen?' },
  { id: 'vida-cfo', kind: 'job', en: 'Explain ViDA to a CFO in plain English.', de: 'Erkläre einem CFO ViDA in einfachen Worten.' },
  { id: 'einvoice', kind: 'job', en: 'What does the e-invoicing mandate change for a German accounting team?', de: 'Was ändert die E-Rechnungspflicht für eine deutsche Buchhaltung?' },
  { id: 'dms-value', kind: 'job', en: 'What is the business value of a document management system?', de: 'Welchen geschäftlichen Nutzen hat ein Dokumentenmanagementsystem?' },
  { id: 'security', kind: 'job', en: 'How would you convince a skeptical head of IT that your cloud is secure?', de: 'Wie überzeugst du einen skeptischen IT-Leiter, dass eure Cloud sicher ist?' },
  { id: 'gdpr', kind: 'job', en: 'How does your solution help a customer stay GDPR-compliant?', de: 'Wie hilft eure Lösung einem Kunden, DSGVO-konform zu bleiben?' },
  { id: 'price', kind: 'job', en: 'A prospect says you are too expensive. How do you justify the price?', de: 'Ein Interessent sagt, ihr seid zu teuer. Wie begründest du den Preis?' },
  { id: 'competitor', kind: 'job', en: 'What sets your company apart from its biggest competitor?', de: 'Was unterscheidet euer Unternehmen vom größten Wettbewerber?' },
  { id: 'pilot', kind: 'job', en: 'Why is a pilot project a good first step for a hesitant customer?', de: 'Warum ist ein Pilotprojekt ein guter erster Schritt für einen zögernden Kunden?' },
  { id: 'partner', kind: 'job', en: 'What makes a reseller partnership successful for both sides?', de: 'Was macht eine Vertriebspartnerschaft für beide Seiten erfolgreich?' },
  { id: 'migration', kind: 'job', en: 'Walk a customer through a typical migration from paper files to a digital archive.', de: 'Führe einen Kunden durch eine typische Umstellung von Papierakten auf ein digitales Archiv.' },
  { id: 'roi', kind: 'job', en: 'How would you calculate the return on investment of a digital archive?', de: 'Wie würdest du den Return on Investment eines digitalen Archivs berechnen?' },
  { id: 'ai-docs', kind: 'job', en: 'How will AI change the way companies handle documents in the next five years?', de: 'Wie wird KI in den nächsten fünf Jahren den Umgang mit Dokumenten verändern?' },
  { id: 'saas-onprem', kind: 'job', en: 'What are the pros and cons of SaaS compared to an on-premises solution?', de: 'Was spricht für und gegen SaaS im Vergleich zu einer Lösung im eigenen Rechenzentrum?' },
  { id: 'retention', kind: 'job', en: 'Why do retention periods for business records matter, and what goes wrong without a system?', de: 'Warum sind Aufbewahrungsfristen wichtig, und was läuft ohne System schief?' },
  { id: 'deal-stuck', kind: 'job', en: 'One of your big deals has been stuck for two months. What do you do next?', de: 'Einer deiner großen Deals hängt seit zwei Monaten fest. Was tust du als Nächstes?' },
  { id: 'kpi', kind: 'job', en: 'Which three KPIs matter most for a business development team, and why?', de: 'Welche drei Kennzahlen sind für Business Development am wichtigsten, und warum?' },
  { id: 'onboarding', kind: 'job', en: 'Describe a good onboarding process for a new enterprise customer.', de: 'Beschreibe ein gutes Onboarding für einen neuen Großkunden.' },
  { id: 'discount', kind: 'job', en: 'When is it smart to give a discount, and when should you refuse?', de: 'Wann ist ein Rabatt klug, und wann solltest du ablehnen?' },
  { id: 'workflow', kind: 'job', en: 'Explain how an automated invoice approval workflow saves time.', de: 'Erkläre, wie ein automatischer Freigabeprozess für Rechnungen Zeit spart.' },
  { id: 'change-mgmt', kind: 'job', en: 'Employees resist a new document system. How do you win them over?', de: 'Die Mitarbeiter wehren sich gegen ein neues Dokumentensystem. Wie gewinnst du sie?' },
  { id: 'trade-fair', kind: 'job', en: 'Is a big trade fair still worth the money for a software company?', de: 'Lohnt sich eine große Messe für ein Softwareunternehmen noch?' },
  { id: 'remote-sales', kind: 'job', en: 'What is different about selling to customers you never meet in person?', de: 'Was ist anders, wenn du an Kunden verkaufst, die du nie persönlich triffst?' },
  { id: 'elevator', kind: 'job', en: 'Give the elevator pitch for your company to a managing director.', de: 'Halte vor einem Geschäftsführer den Elevator Pitch für dein Unternehmen.' },
  { id: 'lost-deal', kind: 'job', en: 'Tell me about a deal you lost and what you learned from it.', de: 'Erzähl von einem verlorenen Deal und was du daraus gelernt hast.' },
  // ------------------------------------------------------------------ Alltag
  { id: 'weekend', kind: 'life', en: 'What makes a perfect weekend for you?', de: 'Was macht für dich ein perfektes Wochenende aus?' },
  { id: 'city', kind: 'life', en: 'Would you rather live in a big city or in the countryside, and why?', de: 'Würdest du lieber in einer Großstadt oder auf dem Land leben, und warum?' },
  { id: 'learning', kind: 'life', en: 'What is the best way to learn a new language as an adult?', de: 'Wie lernt man als Erwachsener am besten eine neue Sprache?' },
  { id: 'travel', kind: 'life', en: 'Describe a trip that changed the way you see things.', de: 'Beschreibe eine Reise, die deinen Blick auf etwas verändert hat.' },
  { id: 'habits', kind: 'life', en: 'Which daily habit has helped you most, and why?', de: 'Welche tägliche Gewohnheit hat dir am meisten geholfen, und warum?' },
];
