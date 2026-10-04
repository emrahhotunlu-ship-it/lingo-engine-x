// Eingebaute Schreibaufgaben (docs/neustart.md §5 Nr. 13): zwei Drittel Beruf (E-Mail, Meeting,
// Verhandlung, Absage, Präsentation …), ein Drittel Alltag. Die Aufgabe auf Englisch geht an die
// KI-Korrektur, die deutsche Fassung sieht Emrah. Je Aufgabe vier Schlüsselwörter zum Antippen.
// Alles fest eingebaut: Eine Schreibaufgabe kostet nur dann KI, wenn er „Korrigieren“ drückt.

export type WritingWord = { en: string; de: string };

export type WritingPrompt = {
  id: string;
  kind: 'work' | 'life';
  title: string;
  title_en: string;
  /** Aufgabe auf Englisch (Teil des KI-Auftrags). */
  task_en: string;
  /** Dieselbe Aufgabe auf Deutsch (Anzeige). */
  task_de: string;
  words: readonly WritingWord[];
  /** Zielwortzahl. */
  min: number;
  max: number;
};

const w = (en: string, de: string): WritingWord => ({ en, de });

type Def = [id: string, kind: 'work' | 'life', title: string, title_en: string, task_en: string, task_de: string, words: WritingWord[], min?: number, max?: number];

const DEFS: Def[] = [
  // ---- Beruf (27)
  [
    'delay-mail', 'work', 'Lieferung verspätet', 'Delivery delay',
    'Write an email to a client: your delivery will be two weeks late. Apologize, explain the reason in one sentence and offer a solution.',
    'Schreib eine E-Mail an einen Kunden: Deine Lieferung kommt zwei Wochen später. Entschuldige dich, erkläre den Grund in einem Satz und biete eine Lösung an.',
    [w('delay', 'Verzögerung'), w('apologize', 'sich entschuldigen'), w('inconvenience', 'Unannehmlichkeit'), w('deliver', 'liefern')],
  ],
  [
    'meeting-summary', 'work', 'Meeting zusammenfassen', 'Meeting summary',
    'Summarize a meeting for colleagues who could not attend: the main decisions and the next steps.',
    'Fasse ein Meeting für Kollegen zusammen, die nicht dabei waren: die wichtigsten Entscheidungen und die nächsten Schritte.',
    [w('agree', 'zustimmen, sich einigen'), w('decision', 'Entscheidung'), w('follow up', 'nachfassen'), w('deadline', 'Frist')],
  ],
  [
    'discount-no', 'work', 'Rabatt höflich ablehnen', 'Decline a discount',
    'A client asks for a 15 % discount. Say no politely, but offer something else in return.',
    'Ein Kunde will 15 % Rabatt. Sag höflich nein, biete aber etwas anderes an.',
    [w('discount', 'Rabatt'), w('offer', 'anbieten'), w('in return', 'im Gegenzug'), w('flexible', 'flexibel')],
  ],
  [
    'decline-offer', 'work', 'Angebot ablehnen', 'Decline an offer',
    'Decline a job or partnership offer politely. Thank them, give a short reason and keep the door open.',
    'Lehne ein Job- oder Partnerschaftsangebot höflich ab. Bedanke dich, nenne kurz den Grund und lass die Tür offen.',
    [w('decline', 'ablehnen'), w('appreciate', 'schätzen'), w('unfortunately', 'leider'), w('opportunity', 'Gelegenheit')],
  ],
  [
    'investor-pitch', 'work', 'Produkt vorstellen', 'Product pitch',
    'Describe your product in four sentences to a skeptical investor: the problem, your solution, your customers and why you will win.',
    'Beschreibe dein Produkt in vier Sätzen einem skeptischen Investor: das Problem, deine Lösung, deine Kunden und warum ihr gewinnt.',
    [w('solve', 'lösen'), w('customer', 'Kunde'), w('growth', 'Wachstum'), w('competitor', 'Wettbewerber')],
  ],
  [
    'demo-followup', 'work', 'Nach der Demo nachfassen', 'Follow-up after a demo',
    'Write a follow-up email to a prospect who has not answered since your product demo. Stay friendly and suggest a clear next step.',
    'Schreib eine Nachfass-E-Mail an einen Interessenten, der sich seit deiner Produktvorführung nicht gemeldet hat. Bleib freundlich und schlag einen klaren nächsten Schritt vor.',
    [w('follow up', 'nachfassen'), w('concern', 'Bedenken'), w('demo', 'Vorführung'), w('next step', 'nächster Schritt')],
  ],
  [
    'intro-client', 'work', 'Neuem Kunden vorstellen', 'Introduce yourself',
    'Introduce yourself and your company to a new client. Say what you are responsible for and what you can offer.',
    'Stell dich und deine Firma einem neuen Kunden vor. Sag, wofür du zuständig bist und was du anbieten kannst.',
    [w('responsible', 'verantwortlich'), w('look forward to', 'sich freuen auf'), w('collaboration', 'Zusammenarbeit'), w('offer', 'anbieten')],
  ],
  [
    'ask-quote', 'work', 'Angebot anfragen', 'Ask for a quote',
    'Ask a supplier for a quote. Describe what you need, the quantity and when you need it.',
    'Bitte einen Lieferanten um ein Angebot. Beschreibe, was du brauchst, die Menge und bis wann.',
    [w('quote', 'Angebot, Preisangabe'), w('quantity', 'Menge'), w('availability', 'Verfügbarkeit'), w('require', 'benötigen')],
  ],
  [
    'reschedule', 'work', 'Termin verschieben', 'Reschedule a meeting',
    'Ask to move a meeting. Give a short reason and suggest two alternative times.',
    'Bitte darum, einen Termin zu verschieben. Nenne kurz den Grund und schlag zwei andere Zeiten vor.',
    [w('reschedule', 'verschieben'), w('conflict', 'Terminüberschneidung'), w('convenient', 'passend'), w('alternative', 'Alternative')],
  ],
  [
    'complain-service', 'work', 'Über Service beschweren', 'Complain politely',
    'Complain politely to a service provider: something went wrong twice. Say what you expect now.',
    'Beschwere dich höflich bei einem Dienstleister: Etwas ist zweimal schiefgelaufen. Sag, was du jetzt erwartest.',
    [w('complain', 'sich beschweren'), w('issue', 'Problem'), w('resolve', 'lösen'), w('compensation', 'Entschädigung')],
  ],
  [
    'status-update', 'work', 'Statusbericht', 'Status update',
    'Write a short weekly update for your manager: what is going well, one problem and one request.',
    'Schreib deinem Chef ein kurzes Wochenupdate: was gut läuft, ein Problem und eine Bitte.',
    [w('progress', 'Fortschritt'), w('obstacle', 'Hindernis'), w('on track', 'im Plan'), w('request', 'Bitte, Anfrage')],
  ],
  [
    'thank-client', 'work', 'Kunden danken', 'Thank a client',
    'Thank a client after you closed a deal. Mention what you enjoyed and what happens next.',
    'Bedanke dich bei einem Kunden nach einem Abschluss. Erwähne, was dir gefallen hat und wie es weitergeht.',
    [w('appreciate', 'schätzen'), w('trust', 'Vertrauen'), w('partnership', 'Partnerschaft'), w('deliver', 'liefern')],
  ],
  [
    'contract-change', 'work', 'Vertragsänderung erklären', 'Contract change',
    'Explain to a client one change in the contract terms and why it is fair.',
    'Erkläre einem Kunden eine Änderung in den Vertragsbedingungen und warum sie fair ist.',
    [w('terms', 'Bedingungen'), w('amendment', 'Änderung'), w('clause', 'Klausel'), w('effective', 'gültig ab')],
  ],
  [
    'kickoff-invite', 'work', 'Einladung zum Kickoff', 'Kickoff invitation',
    'Invite your team to the project kickoff. Include the goal, the agenda and what you expect from everyone.',
    'Lade dein Team zum Projektstart ein. Nenne das Ziel, die Tagesordnung und was du von allen erwartest.',
    [w('agenda', 'Tagesordnung'), w('objective', 'Ziel'), w('attend', 'teilnehmen'), w('timeline', 'Zeitplan')],
  ],
  [
    'handover', 'work', 'Übergabe vor dem Urlaub', 'Handover note',
    'Write a handover note for a colleague who covers for you during your holiday: what is urgent and who to contact.',
    'Schreib eine Übergabe für einen Kollegen, der dich im Urlaub vertritt: was dringend ist und wen er fragen kann.',
    [w('cover', 'vertreten'), w('urgent', 'dringend'), w('handle', 'erledigen, bearbeiten'), w('contact', 'Kontakt')],
  ],
  [
    'give-feedback', 'work', 'Feedback geben', 'Give feedback',
    'Give constructive feedback to a colleague about a presentation: one strength and two suggestions.',
    'Gib einem Kollegen konstruktives Feedback zu einer Präsentation: eine Stärke und zwei Vorschläge.',
    [w('strength', 'Stärke'), w('improve', 'verbessern'), w('suggest', 'vorschlagen'), w('clear', 'klar')],
  ],
  [
    'ask-raise', 'work', 'Gespräch über Gehalt', 'Ask for a raise',
    'Ask your manager for a meeting about a raise. Give two good reasons.',
    'Bitte deinen Chef um ein Gespräch über eine Gehaltserhöhung. Nenne zwei gute Gründe.',
    [w('contribution', 'Beitrag'), w('responsibility', 'Verantwortung'), w('raise', 'Gehaltserhöhung'), w('review', 'Überprüfung')],
  ],
  [
    'market-trend', 'work', 'Markttrend beschreiben', 'Market trend',
    'Describe a trend in your industry and what it means for your company.',
    'Beschreibe einen Trend in deiner Branche und was er für deine Firma bedeutet.',
    [w('trend', 'Trend'), w('demand', 'Nachfrage'), w('increase', 'steigen'), w('impact', 'Auswirkung')],
  ],
  [
    'fix-process', 'work', 'Prozess verbessern', 'Improve a process',
    'Describe a problem in your team\'s process and propose a fix.',
    'Beschreibe ein Problem im Ablauf deines Teams und schlag eine Lösung vor.',
    [w('bottleneck', 'Engpass'), w('propose', 'vorschlagen'), w('efficient', 'effizient'), w('implement', 'umsetzen')],
  ],
  [
    'reference', 'work', 'Empfehlung schreiben', 'Reference letter',
    'Write a short recommendation for a former colleague who applies for a new job.',
    'Schreib eine kurze Empfehlung für einen früheren Kollegen, der sich auf einen neuen Job bewirbt.',
    [w('reliable', 'zuverlässig'), w('skilled', 'fähig'), w('recommend', 'empfehlen'), w('contribute', 'beitragen')],
  ],
  [
    'renewal', 'work', 'Vertragsverlängerung', 'Renewal',
    'Convince a client to renew the annual subscription. Name two concrete benefits.',
    'Überzeuge einen Kunden, das Jahresabo zu verlängern. Nenne zwei konkrete Vorteile.',
    [w('renewal', 'Verlängerung'), w('benefit', 'Vorteil'), w('value', 'Wert'), w('upgrade', 'Aufwertung')],
  ],
  [
    'project-risk', 'work', 'Risiko melden', 'Project risk',
    'Warn your manager about a risk to a project deadline. Say what could happen and what you suggest.',
    'Warne deinen Chef vor einem Risiko für einen Projekttermin. Sag, was passieren könnte und was du vorschlägst.',
    [w('risk', 'Risiko'), w('deadline', 'Frist'), w('reduce', 'verringern'), w('resources', 'Mittel, Ressourcen')],
  ],
  [
    'cold-mail', 'work', 'Erste E-Mail an Entscheider', 'Cold email',
    'Write a first email to a decision maker at a company you would like as a customer. Keep it short and relevant.',
    'Schreib eine erste E-Mail an einen Entscheider in einer Firma, die du als Kunden gewinnen willst. Kurz und relevant.',
    [w('reach out', 'sich melden'), w('challenge', 'Herausforderung'), w('relevant', 'relevant'), w('schedule', 'vereinbaren, planen')],
  ],
  [
    'post-lesson', 'work', 'Beitrag über eine Lektion', 'Lesson learned',
    'Write a short LinkedIn post about something you learned in a recent project.',
    'Schreib einen kurzen LinkedIn-Beitrag darüber, was du in einem Projekt gelernt hast.',
    [w('lesson', 'Lektion'), w('challenge', 'Herausforderung'), w('achieve', 'erreichen'), w('team', 'Team')],
  ],
  [
    'conference-follow', 'work', 'Nach der Konferenz', 'After a conference',
    'Write a message to someone you met at a conference. Mention what you talked about and suggest to stay in touch.',
    'Schreib jemandem, den du auf einer Konferenz getroffen hast. Erwähne, worüber ihr gesprochen habt, und schlag vor, in Kontakt zu bleiben.',
    [w('conference', 'Konferenz'), w('insight', 'Einblick'), w('stay in touch', 'in Kontakt bleiben'), w('exchange', 'austauschen')],
  ],
  [
    'welcome-new', 'work', 'Neues Teammitglied begrüßen', 'Welcome a new colleague',
    'Write a welcome message for a new team member. Say what the first week looks like.',
    'Schreib eine Willkommensnachricht für ein neues Teammitglied. Sag, wie die erste Woche aussieht.',
    [w('welcome', 'willkommen'), w('support', 'unterstützen'), w('expect', 'erwarten'), w('introduce', 'vorstellen')],
  ],
  [
    'confirm-points', 'work', 'Verhandlungspunkte bestätigen', 'Confirm what we agreed',
    'After a negotiation call, confirm in writing the points you agreed on and the next step.',
    'Bestätige nach einem Verhandlungsgespräch schriftlich die vereinbarten Punkte und den nächsten Schritt.',
    [w('confirm', 'bestätigen'), w('agree', 'vereinbaren'), w('as discussed', 'wie besprochen'), w('proceed', 'fortfahren')],
  ],
  // ---- Alltag (13)
  [
    'weekend', 'life', 'Dein Wochenende', 'Your weekend',
    'Describe what you did last weekend and what you liked most.',
    'Beschreibe, was du letztes Wochenende gemacht hast und was dir am besten gefallen hat.',
    [w('relax', 'sich entspannen'), w('enjoy', 'genießen'), w('meet', 'treffen'), w('spend', 'verbringen')],
    35, 100,
  ],
  [
    'restaurant', 'life', 'Restaurant empfehlen', 'Recommend a restaurant',
    'Recommend a restaurant to a friend. Say what is good there and when to go.',
    'Empfiehl einem Freund ein Restaurant. Sag, was dort gut ist und wann man hingehen sollte.',
    [w('recommend', 'empfehlen'), w('atmosphere', 'Atmosphäre'), w('reservation', 'Reservierung'), w('worth', 'wert')],
    35, 100,
  ],
  [
    'holiday-plan', 'life', 'Urlaubsplan', 'Holiday plan',
    'Describe a trip you would like to take and why.',
    'Beschreibe eine Reise, die du gern machen würdest, und warum.',
    [w('destination', 'Reiseziel'), w('explore', 'erkunden'), w('afford', 'sich leisten'), w('itinerary', 'Reiseplan')],
    35, 100,
  ],
  [
    'your-city', 'life', 'Deine Stadt', 'Your city',
    'Describe your city to a visitor: what to see and what to avoid.',
    'Beschreibe deine Stadt einem Besucher: was man sehen sollte und was man meiden sollte.',
    [w('sightseeing', 'Sehenswürdigkeiten'), w('crowded', 'überfüllt'), w('neighborhood', 'Viertel'), w('avoid', 'meiden')],
    35, 100,
  ],
  [
    'recent-film', 'life', 'Film oder Serie', 'A film or series',
    'Tell a friend about a film, series or book you enjoyed recently without spoiling the end.',
    'Erzähl einem Freund von einem Film, einer Serie oder einem Buch, das dir zuletzt gefallen hat, ohne das Ende zu verraten.',
    [w('plot', 'Handlung'), w('character', 'Figur'), w('suspense', 'Spannung'), w('recommend', 'empfehlen')],
    35, 100,
  ],
  [
    'recent-decision', 'life', 'Eine Entscheidung', 'A decision',
    'Describe a difficult decision you made recently and how you made it.',
    'Beschreibe eine schwierige Entscheidung, die du kürzlich getroffen hast, und wie du sie getroffen hast.',
    [w('decide', 'entscheiden'), w('consider', 'abwägen'), w('option', 'Möglichkeit'), w('regret', 'bereuen')],
    35, 100,
  ],
  [
    'small-win', 'life', 'Ein kleiner Erfolg', 'A small success',
    'Write about a small success you had this week and what helped you.',
    'Schreib über einen kleinen Erfolg in dieser Woche und was dir dabei geholfen hat.',
    [w('succeed', 'gelingen'), w('manage', 'schaffen'), w('proud', 'stolz'), w('effort', 'Mühe')],
    35, 100,
  ],
  [
    'home-office', 'life', 'Homeoffice: dafür und dagegen', 'Working from home',
    'Give two advantages and two disadvantages of working from home and say what you prefer.',
    'Nenne zwei Vorteile und zwei Nachteile von Arbeiten im Homeoffice und sag, was du bevorzugst.',
    [w('advantage', 'Vorteil'), w('distraction', 'Ablenkung'), w('commute', 'Pendeln'), w('prefer', 'bevorzugen')],
    35, 100,
  ],
  [
    'decline-invite', 'life', 'Einladung absagen', 'Decline an invitation',
    'A friend invites you to a birthday party but you cannot come. Write a friendly message.',
    'Ein Freund lädt dich zu einer Geburtstagsfeier ein, aber du kannst nicht kommen. Schreib eine freundliche Nachricht.',
    [w('invitation', 'Einladung'), w('unfortunately', 'leider'), w('make it', 'es schaffen'), w('celebrate', 'feiern')],
    30, 90,
  ],
  [
    'free-day', 'life', 'Ein freier Tag', 'A free day',
    'How would you spend a perfect free day? Describe it from morning to evening.',
    'Wie würdest du einen perfekten freien Tag verbringen? Beschreibe ihn vom Morgen bis zum Abend.',
    [w('wake up', 'aufwachen'), w('afterwards', 'danach'), w('typically', 'typischerweise'), w('lazy', 'faul')],
    35, 100,
  ],
  [
    'role-model', 'life', 'Ein Vorbild', 'Someone you admire',
    'Write about a person you admire and what you can learn from them.',
    'Schreib über einen Menschen, den du bewunderst, und was du von ihm lernen kannst.',
    [w('admire', 'bewundern'), w('inspire', 'inspirieren'), w('achievement', 'Leistung'), w('quality', 'Eigenschaft')],
    35, 100,
  ],
  [
    'stay-fit', 'life', 'Fit bleiben', 'Staying fit',
    'Give a friend three tips to stay fit when you have little time.',
    'Gib einem Freund drei Tipps, wie man fit bleibt, wenn man wenig Zeit hat.',
    [w('exercise', 'Sport machen'), w('habit', 'Gewohnheit'), w('routine', 'Routine'), w('healthy', 'gesund')],
    35, 100,
  ],
  [
    'neighbor-noise', 'life', 'Lärm im Haus', 'Noise complaint',
    'Write a polite note to a neighbor whose music is too loud in the evenings.',
    'Schreib einem Nachbarn einen höflichen Zettel: Seine Musik ist abends zu laut.',
    [w('neighbor', 'Nachbar'), w('disturb', 'stören'), w('noise', 'Lärm'), w('understand', 'verstehen')],
    30, 90,
  ],
];

export const WRITING_PROMPTS: readonly WritingPrompt[] = DEFS.map(([id, kind, title, title_en, task_en, task_de, words, min, max]) => ({
  id,
  kind,
  title,
  title_en,
  task_en,
  task_de,
  words,
  min: min ?? 40,
  max: max ?? 120,
}));

export const promptById = (id: string): WritingPrompt | undefined => WRITING_PROMPTS.find((p) => p.id === id);
