// P21 Charge mcc-2: Passendes Wort, Bereich Grammatik, Kapitel 2 und 3. Quellformat wie mcc-1.
export const meta = { file: 'k2-2' };
const W = (w, cat, text) => [w, cat, text];
export const items = [
  // ---- c1-hedging ----
  {
    p: 'hg.modal', lv: 'B2+', dom: 'biz',
    t: 'The delay ___ be caused by the new firewall, but we have not checked the server logs yet.',
    o: [['might'], W('must', 'meaning', 'must drückt Sicherheit aus, ihr habt aber noch nicht geprüft. || must expresses certainty, but you have not checked yet.'), W('can', 'calque', '„Das kann an der Firewall liegen“ ist Deutsch gedacht; can heißt „grundsätzlich möglich“, für eine Vermutung gilt might/could. || “Das kann an der Firewall liegen” is German thinking; can means “possible in general”, for a guess use might/could.'), W('would', 'grammar', 'would braucht eine Bedingung (if …). || would needs a condition (if …).')],
    ok: 'Vorsichtige Vermutung ohne Beleg: might/could/may + Grundform. || A cautious guess without proof: might/could/may + base form.',
  },
  {
    p: 'hg.worth', lv: 'B2+', dom: 'biz',
    t: 'It might be ___ checking the contract once more before we sign anything on Friday afternoon.',
    o: [['worth'], W('worthy', 'calque', 'worthy heißt „würdig“; „es lohnt sich“ heißt worth + -ing. || worthy means “deserving”; “it is worth the effort” is worth + -ing.'), W('valuable', 'calque', 'valuable beschreibt Dinge mit Wert, nicht „es lohnt sich zu prüfen“. || valuable describes things with value, not “it pays to check”.'), W('value', 'grammar', 'value ist ein Nomen oder Verb; vor -ing steht worth. || value is a noun or verb; worth goes before -ing.')],
    ok: 'Höfliche Empfehlung: It might be worth + -ing. || A polite suggestion: It might be worth + -ing.',
  },
  {
    p: 'hg.seems', lv: 'B2+', dom: 'biz',
    t: 'It ___ that the client has changed his mind about the budget, because nobody has replied to our offer.',
    o: [['seems'], W('shines', 'calque', 'Deutsch „es scheint“ ist englisch seem; shine heißt „leuchten“. || German “es scheint” is seem in English; shine means “give light”.'), W('looks like', 'grammar', 'looks like + that-Satz gibt es nicht; es heißt It seems that … oder It looks like + Satz ohne that. || looks like + that-clause does not exist; it is It seems that … or It looks like + clause without that.'), W('seem', 'grammar', 'It braucht seems mit -s. || It needs seems with -s.')],
    ok: 'Eindruck vorsichtig ausdrücken: It seems (that) + Satz. || Expressing an impression cautiously: It seems (that) + clause.',
  },
  // ---- future-perf-cont ----
  {
    p: 'fut.continuous', lv: 'B2', dom: 'life',
    t: 'This time next week, we ___ on a beach in Portugal, far away from our inboxes and from every meeting.',
    o: [['will be sitting'], W('sit', 'calque', 'Deutsch nutzt das Präsens für die Zukunft („wir sitzen am Strand“); Englisch braucht will be + -ing. || German uses the present for the future (“wir sitzen am Strand”); English needs will be + -ing.'), W('will have sat', 'grammar', 'will have sat beschreibt etwas Abgeschlossenes, nicht „gerade dabei“. || will have sat describes something completed, not “in the middle of”.'), W('would be sitting', 'grammar', 'would be sitting braucht eine Bedingung. || would be sitting needs a condition.')],
    ok: 'Was zu einem künftigen Zeitpunkt gerade läuft: will be + -ing. || What will be in progress at a future moment: will be + -ing.',
  },
  {
    p: 'fut.cont-plan', lv: 'B2+', dom: 'biz',
    t: '___ you be using the meeting room at four, or may I book it for a quick team workshop?',
    o: [['Will'], W('Are', 'grammar', 'Are you be using ist keine Form; mit be + -ing braucht es will be. || Are you be using is not a form; with be + -ing it needs will be.'), W('Do', 'calque', 'Deutsch fragt „Benutzt du den Beamer um zwei?“ im Präsens; Englisch: Will you be using …? || German asks “Benutzt du den Beamer um zwei?” in the present; English: Will you be using …?'), W('Have', 'grammar', 'Have you be using ist keine Form. || Have you be using is not a form.')],
    ok: 'Höfliche Frage nach Plänen: Will you be + -ing? || A polite question about plans: Will you be + -ing?',
  },
  {
    p: 'fut.perfect', lv: 'B2', dom: 'biz',
    t: 'By the end of this quarter, we ___ fifty new customers in the Nordic region, as our plan says.',
    o: [['will have signed'], W('have signed', 'calque', 'Deutsch sagt „bis Quartalsende haben wir 50 gewonnen“ im Perfekt; Englisch braucht für die Zukunft will have signed. || German says “bis Quartalsende haben wir 50 gewonnen” in the perfect; English needs will have signed for the future.'), W('will be signed', 'grammar', 'will be signed ist Passiv: die Kunden würden unterschrieben. || will be signed is passive: the customers would be signed.'), W('would have signed', 'grammar', 'would have signed braucht eine Bedingung. || would have signed needs a condition.')],
    ok: 'Bis zu einem künftigen Zeitpunkt abgeschlossen: will have + Partizip. || Completed by a future moment: will have + participle.',
  },
  {
    p: 'fut.perf-cont', lv: 'B2+', dom: 'biz',
    t: 'Next June, I ___ for this company for exactly ten years, and I still enjoy my job every day.',
    o: [['will have been working'], W('will work', 'calque', 'Deutsch sagt „ich werde zehn Jahre hier arbeiten“; für die Dauer bis zu einem künftigen Zeitpunkt braucht Englisch will have been working. || German says “ich werde zehn Jahre hier arbeiten”; for duration up to a future point English needs will have been working.'), W('am working', 'calque', 'am working beschreibt nur das Jetzt. || am working describes only the present.'), W('have been working', 'grammar', 'have been working reicht nur bis heute, „next June“ liegt in der Zukunft. || have been working reaches only to today, but “next June” is in the future.')],
    ok: 'Dauer bis zu einem künftigen Zeitpunkt: will have been + -ing. || Duration up to a future moment: will have been + -ing.',
  },
  // ---- past-perfect ----
  {
    p: 'pp.earlier', lv: 'B2', dom: 'biz',
    t: 'By the time the technician arrived at the office, the main server ___ already crashed twice.',
    o: [['had'], W('has', 'grammar', 'has gehört zur Gegenwart; gemeint ist früher als „arrived“. || has is present; earlier than “arrived” is meant.'), W('was', 'calque', 'Deutsch sagt „war schon gestartet“ (mit sein); Englisch bildet das Past Perfect mit had. || German says “war schon gestartet” (with sein); English builds the past perfect with had.'), W('did', 'grammar', 'did already started gibt es nicht; nach did steht die Grundform. || did already started does not exist; after did comes the base form.')],
    ok: 'Das frühere von zwei Ereignissen in der Vergangenheit: had + Partizip. || The earlier of two past events: had + participle.',
  },
  {
    p: 'pp.duration', lv: 'B2+', dom: 'life',
    t: 'He looked exhausted because he had been driving ___ five o\'clock that morning without a proper break.',
    o: [['since'], W('for', 'grammar', 'for braucht eine Länge („for ten hours“), hier steht eine Uhrzeit. || for needs a length of time (“for ten hours”), but here is a clock time.'), W('during', 'grammar', 'during passt nicht vor einer Uhrzeit. || during does not fit before a clock time.'), W('by', 'calque', 'Deutsch „bis sechs Uhr“ klingt wie by; gemeint ist der Anfang, also since. || German “bis sechs Uhr” sounds like by; the start is meant, so since.')],
    ok: 'Startpunkt einer Dauer in der Vergangenheit: had been + -ing + since + Uhrzeit. || The starting point of a past duration: had been + -ing + since + clock time.',
  },
  {
    p: 'pp.first-time', lv: 'B2+', dom: 'biz',
    t: 'It was the first time she ___ ever presented to a board in English, and her hands were shaking.',
    o: [['had'], W('have', 'calque', 'Deutsch sagt „das erste Mal, dass ich gesprochen habe“ (Perfekt); nach „It was“ steht im Englischen had. || German says “das erste Mal, dass ich gesprochen habe” (perfect); after “It was” English uses had.'), W('was', 'grammar', 'was spoken wäre Passiv. || was spoken would be passive.'), W('did', 'grammar', 'did spoken gibt es nicht; nach did steht die Grundform. || did spoken does not exist; after did comes the base form.')],
    ok: 'It was the first time + had + Partizip. || It was the first time + had + participle.',
  },
  {
    p: 'pp.reported', lv: 'B2', dom: 'biz',
    t: 'She told me that the board ___ already approved the budget the day before the public announcement.',
    o: [['had'], W('has', 'calque', 'Deutsch sagt „sie sagte, der Vorstand hat genehmigt“ (Perfekt); nach „told“ rutscht has einen Schritt zurück zu had. || German says “sie sagte, der Vorstand hat genehmigt” (perfect); after “told” has moves one step back to had.'), W('have', 'grammar', 'have wird in der berichteten Rede zu had, und board passt hier auch nicht zu have. || have becomes had in reported speech, and board does not take have here either.'), W('would', 'grammar', 'would approved gibt es nicht; had + Partizip steht für das Frühere. || would approved does not exist; had + participle expresses the earlier action.')],
    ok: 'Berichtete Rede in der Vergangenheit: has/have + Partizip wird zu had + Partizip. || Reported speech in the past: has/have + participle becomes had + participle.',
  },
  {
    p: 'pp.inversion', lv: 'C1', dom: 'biz',
    t: 'No sooner had we signed the contract ___ the client asked for several changes to the payment terms.',
    o: [['than'], W('when', 'grammar', 'when gehört zu Hardly … when; zu No sooner gehört than. || when belongs to Hardly … when; No sooner takes than.'), W('then', 'calque', 'Deutsch „kaum …, dann“ klingt wie then; Englisch braucht than. || German “kaum …, dann” sounds like then; English needs than.'), W('as', 'calque', 'Deutsch „kaum …, als“ klingt wie as; Englisch braucht than. || German “kaum …, als” sounds like as; English needs than.')],
    ok: 'No sooner had + Subjekt + Partizip … than. || No sooner had + subject + participle … than.',
  },
  // ---- used-to ----
  {
    p: 'ut.used-to', lv: 'B2', dom: 'biz',
    t: 'Our team ___ to work in a tiny office near the river before the company moved into the new tower.',
    o: [['used'], W('use', 'calque', 'Deutsch „wir pflegten zu arbeiten“ führt zu use to; in der Aussage heißt es used to. || German “wir pflegten zu arbeiten” leads to use to; in a statement it is used to.'), W('would', 'grammar', 'would to work gibt es nicht; would steht ohne to. || would to work does not exist; would takes no to.'), W('were', 'grammar', 'were to work hat eine andere Bedeutung („sollten arbeiten“). || were to work has a different meaning (“were supposed to work”).')],
    ok: 'Frühere Gewohnheit oder Lage: used to + Grundform. || A past habit or situation: used to + base form.',
  },
  {
    p: 'ut.would', lv: 'B2+', dom: 'biz',
    t: 'On Friday evenings, our previous manager ___ order pizza for the whole team and stay until the last ticket was closed.',
    o: [['would'], W('used', 'grammar', 'used invite gibt es nicht; es heißt used to invite. || used invite does not exist; it is used to invite.'), W('does', 'grammar', 'does ist Gegenwart; „old boss“ liegt in der Vergangenheit. || does is present; “old boss” is in the past.'), W('was', 'calque', 'Deutsch „er war es gewohnt einzuladen“ klingt wie was; wiederholte Handlungen in der Vergangenheit: would. || German “er pflegte einzuladen” sounds like was; repeated past actions: would.')],
    ok: 'Wiederholte Handlungen in der Vergangenheit: would + Grundform. || Repeated actions in the past: would + base form.',
  },
  {
    p: 'ut.be-used-to', lv: 'B2+', dom: 'life',
    t: 'After a decade in Madrid, my sister is completely ___ to having dinner at ten o\'clock in the evening.',
    o: [['used'], W('use', 'grammar', 'is use to gibt es nicht; die Wendung heißt be used to. || is use to does not exist; the phrase is be used to.'), W('usual', 'calque', 'usual heißt „üblich“, nicht „gewohnt“ (false friend zu „gewöhnlich“). || usual means “common”, not “accustomed” (a false friend of “gewöhnlich”).'), W('usually', 'grammar', 'usually ist ein Adverb („normalerweise“) und passt nicht vor to. || usually is an adverb (“normally”) and does not fit before to.')],
    ok: 'Schon gewöhnt: be used to + -ing. || Already accustomed: be used to + -ing.',
  },
  {
    p: 'ut.get-used-to', lv: 'B2', dom: 'biz',
    t: 'It took me a few weeks before I got used ___ the new ticket system, but now I could not work without it.',
    o: [['to'], W('on', 'calque', 'Deutsch „gewöhnen an“ verleitet zu on; Englisch sagt get used to. || German “gewöhnen an” tempts you to say on; English says get used to.'), W('with', 'grammar', 'get used with ist falsch; es heißt get used to. || get used with is wrong; it is get used to.'), W('for', 'grammar', 'get used for hat eine andere Bedeutung („verwendet werden für“). || get used for has a different meaning (“be used for”).')],
    ok: 'Sich gewöhnen: get used to + Nomen oder -ing. || Becoming accustomed: get used to + noun or -ing.',
  },
  // ---- c1-diplomacy ----
  {
    p: 'dip.possible', lv: 'B2+', dom: 'biz',
    t: 'Would it be possible ___ our team to start the workshop half an hour later, because of a delayed flight?',
    o: [['for'], W('to', 'calque', '„Möglich für uns“ ist possible for us; to wäre „zu uns“. || “Möglich für uns” is possible for us; to would mean “towards us”.'), W('by', 'grammar', 'by passt nicht nach possible. || by does not fit after possible.'), W('with', 'grammar', 'with passt nicht nach possible. || with does not fit after possible.')],
    ok: 'Mit Person: Would it be possible for us to + Grundform? || With a person: Would it be possible for us to + base form?',
  },
  // ---- conditionals ----
  {
    p: 'cn.zero', lv: 'B2', dom: 'biz',
    t: 'Whenever our system ___ a payment error, it automatically sends an alert to the finance team.',
    o: [['detects'], W('will detect', 'calque', 'Deutsch sagt „wann immer es einen Fehler erkennen wird“; nach whenever steht im Englischen die Gegenwart. || German says “wann immer es einen Fehler erkennen wird”; English uses the present after whenever.'), W('would detect', 'grammar', 'would detect braucht eine unwirkliche Bedingung. || would detect needs an unreal condition.'), W('is detecting', 'grammar', 'is detecting beschreibt einen Vorgang jetzt, nicht eine feste Regel. || is detecting describes a process now, not a fixed rule.')],
    ok: 'Feste Regel: whenever/if + Gegenwart, Gegenwart. || A fixed rule: whenever/if + present, present.',
  },
  {
    p: 'cn.were', lv: 'B2+', dom: 'biz',
    t: 'If I ___ you, I would double-check the bank details before transferring any money to that new supplier.',
    o: [['were'], W('am', 'grammar', 'am passt nicht zu einem Ratschlag mit would. || am does not fit advice with would.'), W('would be', 'calque', 'Deutsch sagt „wenn ich du wäre“ oder „würde sein“; im Englischen steht im if-Satz were, nie would. || German says “wenn ich du wäre”; in English the if-clause takes were, never would.'), W('be', 'grammar', 'if I be you ist veraltet. || if I be you is archaic.')],
    ok: 'Ratschlag: If I were you, I would … || Advice: If I were you, I would …',
  },
  {
    p: 'cn.second', lv: 'B2', dom: 'biz',
    t: 'If our department ___ a bigger budget, we would buy a second server for the archive right away.',
    o: [['had'], W('would have', 'calque', 'Deutsch sagt „wenn wir mehr Geld haben würden“; im Englischen steht im if-Satz die Vergangenheit, nie would. || German says “wenn wir mehr Geld haben würden”; in English the if-clause takes the past, never would.'), W('has', 'grammar', 'has passt nicht zu einer unwirklichen Annahme. || has does not fit an unreal assumption.'), W('have', 'grammar', 'have ist Gegenwart; für die unwirkliche Annahme braucht der if-Satz die Vergangenheit. || have is present; the unreal if-clause needs the past.')],
    ok: 'Unwirkliche Gegenwart: if + Past Simple, would + Grundform. || Unreal present: if + past simple, would + base form.',
  },
  {
    p: 'cn.third', lv: 'B2+', dom: 'biz',
    t: 'If we ___ the figures twice, we would have noticed the mistake long before the audit.',
    o: [['had checked'], W('would have checked', 'calque', 'Deutsch sagt „wenn wir geprüft hätten“ oder „würden geprüft haben“; im if-Satz steht im Englischen kein would. || German says “wenn wir geprüft hätten”; in English the if-clause has no would.'), W('checked', 'grammar', 'checked im if-Satz meint die Gegenwart; hier geht es um die verpasste Vergangenheit. || checked in the if-clause means the present; this is about the missed past.'), W('have checked', 'grammar', 'have checked passt nicht zu would have im Hauptsatz. || have checked does not fit would have in the main clause.')],
    ok: 'Verpasste Chance: if + Past Perfect, would have + Partizip. || A missed chance: if + past perfect, would have + participle.',
  },
  {
    p: 'cn.if-words', lv: 'B2+', dom: 'biz',
    t: 'You may borrow the company laptop over the holidays ___ you promise to keep it locked away at night.',
    o: [['provided'], W('unless', 'meaning', 'unless würde die Bedingung umkehren: nur wenn du es nicht versprichst. || unless would reverse the condition: only if you do not promise it.'), W('supposed', 'calque', 'Deutsch „vorausgesetzt“ führt zu supposed; die Wendung ist provided (that). || German “vorausgesetzt” leads to supposed; the phrase is provided (that).'), W('until', 'meaning', 'until nennt einen Zeitpunkt, keine Bedingung. || until names a point in time, not a condition.')],
    ok: 'Bedingung mit Auflage: provided/providing (that) + Gegenwart. || A condition with a requirement: provided/providing (that) + present.',
  },
  // ---- cond-alt ----
  {
    p: 'ca.unless', lv: 'B2+', dom: 'biz',
    t: 'We will terminate the contract ___ the vendor fixes the security problem within the next two weeks.',
    o: [['unless'], W('if', 'meaning', 'if würde die Bedeutung umkehren: Wir stornieren, falls er bestätigt. || if would reverse the meaning: we cancel if he confirms.'), W('except', 'calque', 'Deutsch „außer wenn“ führt zu except; vor einem Satz heißt es unless. || German “außer wenn” leads to except; before a clause it is unless.'), W('without', 'calque', 'Deutsch „ohne dass“ führt zu without; mit einem Satz steht unless. || German “ohne dass” leads to without; with a clause use unless.')],
    ok: 'unless = außer wenn; im Nebensatz steht die Gegenwart ohne zweites not. || unless = except if; the clause takes the present with no second not.',
  },
  {
    p: 'ca.otherwise', lv: 'B2', dom: 'biz',
    t: 'Please confirm the booking by noon tomorrow. ___, we cannot hold the conference room for your team.',
    o: [['Otherwise'], W('Else', 'calque', 'Deutsch „sonst“ führt zu else; allein heißt es otherwise (oder or else). || German “sonst” leads to else; on its own it is otherwise (or or else).'), W('Therefore', 'meaning', 'Therefore nennt eine Folge, hier folgt eine Warnung. || Therefore names a result, but here a warning follows.'), W('Moreover', 'meaning', 'Moreover fügt Gleichartiges hinzu, keine Warnung. || Moreover adds something similar, not a warning.')],
    ok: 'Otherwise = sonst: was passiert, wenn die Bitte nicht erfüllt wird. || Otherwise = or else: what happens if the request is not met.',
  },
  {
    p: 'ca.inversion', lv: 'C1', dom: 'biz',
    t: '___ the board known about the security gap earlier, it would have approved the new budget months ago.',
    o: [['Had'], W('If', 'grammar', 'If we known gibt es nicht; mit if braucht es had known. || If we known does not exist; with if it needs had known.'), W('Have', 'calque', 'Deutsch „Hätten wir gewusst“ verleitet zu Have; die englische Umstellung beginnt mit Had. || German “Hätten wir gewusst” tempts you to say Have; the English inversion starts with Had.'), W('Did', 'grammar', 'Did we known ist falsch; nach did steht die Grundform. || Did we known is wrong; after did comes the base form.')],
    ok: 'Förmlich ohne if: Had + Subjekt + Partizip, would have … || Formal without if: Had + subject + participle, would have …',
  },
  {
    p: 'ca.in-case', lv: 'B2', dom: 'life',
    t: 'Take an umbrella ___ it rains later this afternoon, because the weather forecast is not very reliable.',
    o: [['in case'], W('in the case', 'grammar', 'in the case braucht „that“ oder „of“; für Vorsorge heißt es in case. || in the case needs “that” or “of”; for precaution it is in case.'), W('in any case', 'meaning', 'in any case heißt „jedenfalls“, nicht „für den Fall“. || in any case means “anyway”, not “just in case”.'), W('for case', 'calque', 'Deutsch „für den Fall“ führt zu for case; im Englischen heißt es in case. || German “für den Fall” leads to for case; English says in case.')],
    ok: 'Vorsorge: in case + Gegenwart. || Precaution: in case + present.',
  },
  // ---- mixed-cond ----
  {
    p: 'mc.wish-now', lv: 'B2+', dom: 'biz',
    t: 'I wish our office ___ a bigger kitchen; twenty people share one tiny coffee machine every single morning.',
    o: [['had'], W('have', 'calque', 'Deutsch „ich wünschte, wir haben“ steht im Präsens; wish braucht für die Gegenwart die Vergangenheit. || German “ich wünschte, wir haben” is in the present; wish needs the past for the present.'), W('would have', 'calque', 'Deutsch „ich wünschte, wir würden haben“ führt zu would have; für einen Zustand steht die Vergangenheit. || German “ich wünschte, wir würden haben” leads to would have; for a state the past is used.'), W('has', 'grammar', 'has passt nicht zu we. || has does not fit we.')],
    ok: 'Wunsch über die Gegenwart: wish + Past Simple (had). || A wish about the present: wish + past simple (had).',
  },
  {
    p: 'mc.wish-past', lv: 'B2+', dom: 'biz',
    t: 'I wish I ___ for a written confirmation before sending the goods, because now the customer denies everything.',
    o: [['had asked'], W('would ask', 'calque', 'Deutsch „ich wünschte, ich würde fragen“ führt zu would ask; Bedauern über früher braucht had + Partizip. || German “ich wünschte, ich würde fragen” leads to would ask; regret about the past needs had + participle.'), W('asked', 'grammar', 'asked nach wish meint die Gegenwart, hier geht es um früher. || asked after wish means the present, but this is about the past.'), W('have asked', 'calque', 'Deutsch „ich wünschte, ich habe gefragt“ (Perfekt) führt zu have asked; nach wish steht had asked. || German “ich wünschte, ich habe gefragt” (perfect) leads to have asked; after wish use had asked.')],
    ok: 'Bedauern über die Vergangenheit: wish + Past Perfect (had asked). || Regret about the past: wish + past perfect (had asked).',
  },
  {
    p: 'mc.wish-would', lv: 'B2+', dom: 'biz',
    t: 'I wish the client ___ changing the requirements every other day; we can never finish anything.',
    o: [['would stop'], W('will stop', 'calque', 'Deutsch „ich wünschte, er wird aufhören“ führt zu will stop; nach wish steht would. || German “ich wünschte, er wird aufhören” leads to will stop; after wish use would.'), W('stops', 'grammar', 'stops (Präsens) nach wish geht nicht; für Ärger steht would. || stops (present) after wish does not work; for annoyance use would.'), W('is stopping', 'grammar', 'is stopping nach wish gibt es nicht. || is stopping after wish does not exist.')],
    ok: 'Ärger über wiederholtes Verhalten: wish + would + Grundform. || Annoyance at repeated behavior: wish + would + base form.',
  },
  {
    p: 'mc.inversion', lv: 'C1', dom: 'biz',
    t: '___ I known about the strike, I would have booked a different flight instead of waiting at the airport.',
    o: [['Had'], W('If', 'grammar', 'If I known gibt es nicht; mit if braucht es had known. || If I known does not exist; with if it needs had known.'), W('Have', 'calque', 'Deutsch „Hätte ich gewusst“ verleitet zu Have; die englische Umstellung beginnt mit Had. || German “Hätte ich gewusst” tempts you to say Have; the English inversion starts with Had.'), W('Would', 'calque', 'Deutsch „Würde ich gewusst haben“ führt zu Would; in der Umstellung steht Had. || German “Würde ich gewusst haben” leads to Would; the inversion uses Had.')],
    ok: 'Förmlich ohne if: Had + Subjekt + Partizip, would have … || Formal without if: Had + subject + participle, would have …',
  },
];
