// P21 Charge ocl-1: Kleines Wort, Kapitel 1 (Zeiten im Alltag). Felder: p Muster · lv · dom · t Satz · a Lösungen · cls · c Chips mit „DE || EN“ · ok „DE || EN“.
export const meta = { file: 'k2-1' };
export const items = [
  // ---- pres-simple-cont ----
  {
    p: 'psc.habit', lv: 'B2', dom: 'biz', cls: 'aux', a: ['do'],
    t: 'Why ___ our customers usually pay at the end of the quarter rather than at the start?',
    c: {
      are: 'Nach are steht -ing, hier steht aber die Grundform pay. || After are the verb takes -ing, but the sentence has the base form pay.',
      does: 'customers ist Plural, does passt nur zu he, she und it. || customers is plural; does only goes with he, she and it.',
      have: 'have braucht ein Partizip (paid), nicht die Grundform. || have needs a participle (paid), not the base form.',
    },
    ok: 'Gewohnheit in der Frage: do/does + Grundform. Zu customers (Plural) passt do. || A habit in a question takes do/does + base form. The plural customers takes do.',
  },
  {
    p: 'psc.habit', lv: 'B2', dom: 'life', cls: 'aux', a: ['does'],
    t: 'My brother ___ not drink coffee after lunch because it keeps him awake all night.',
    c: {
      is: 'is not drink gibt es nicht; mit not + Grundform braucht es do/does. || is not drink does not exist; not + base form needs do/does.',
      do: 'brother ist Singular: do passt zu I, you, we, they. || brother is singular: do goes with I, you, we, they.',
      has: 'has braucht ein Partizip (drunk), nicht die Grundform. || has needs a participle (drunk), not the base form.',
    },
    ok: 'Verneinung im Present Simple: does not + Grundform; bei he/she/it steht does. || Negative in the present simple: does not + base form; he/she/it takes does.',
  },
  {
    p: 'psc.now', lv: 'B2', dom: 'biz', cls: 'aux', a: ['are'],
    t: 'Please do not come in; the engineers ___ testing the new scanner right now.',
    c: {
      do: 'do + running gibt es nicht; vor -ing steht eine Form von be. || do + running does not exist; -ing needs a form of be.',
      have: 'have + running ist keine Zeitform; „gerade jetzt“ braucht am/is/are + -ing. || have + running is not a tense; “right now” needs am/is/are + -ing.',
      were: 'were ist Vergangenheit, „right now“ meint die Gegenwart. || were is past, but “right now” means the present.',
    },
    ok: 'Was gerade passiert: am/is/are + -ing. Zu we passt are. || What is happening now: am/is/are + -ing. We goes with are.',
  },
  {
    p: 'psc.state', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['do', 'can'],
    t: 'At the moment I ___ not understand why the report shows two different totals for May.',
    c: {
      am: 'am not understand ist keine Form; und understand hat kein -ing. || am not understand is not a form, and understand has no -ing form.',
      will: 'will verschiebt es in die Zukunft; „at the moment“ meint jetzt. || will moves it to the future, but “at the moment” means now.',
      have: 'have not understand gibt es nicht; have braucht das Partizip understood. || have not understand does not exist; have needs the participle understood.',
    },
    ok: 'understand ist ein Zustandsverb und steht im Present Simple: do not understand, nie am understanding. || understand is a state verb and takes the present simple: do not understand, never am understanding.',
  },
  {
    p: 'psc.dual', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['is'],
    t: 'Our director ___ having dinner with the client tonight, so she will not be in the office.',
    c: {
      has: 'has having ist falsch; have als Handlung („essen“) braucht be + -ing. || has having is wrong; the action have (“to eat”) takes be + -ing.',
      does: 'does having gibt es nicht; vor -ing steht be. || does having does not exist; -ing needs be.',
      will: 'will having ist keine Form; will braucht die Grundform. || will having is not a form; will needs the base form.',
    },
    ok: 'have im Sinn von „essen“ ist eine Handlung und steht mit be + -ing: is having dinner. || have meaning “to eat” is an action and takes be + -ing: is having dinner.',
  },
  {
    p: 'psc.always', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['is'],
    t: 'Look at this e-mail: the vendor ___ always changing the delivery dates again, and it really annoys me.',
    c: {
      has: 'has always changing ist falsch; für den Ärger braucht es is + always + -ing. || has always changing is wrong; the annoyance needs is + always + -ing.',
      does: 'does always changing gibt es nicht; vor -ing steht be. || does always changing does not exist; -ing needs be.',
      are: 'vendor ist Singular, also is und nicht are. || vendor is singular, so is and not are.',
    },
    ok: 'Ärger über ständige Wiederholung: is/are + always + -ing. Zu vendor passt is. || Annoyance at constant repetition: is/are + always + -ing. vendor goes with is.',
  },
  // ---- past-simple-perfect ----
  {
    p: 'psp.finished-time', lv: 'B2', dom: 'biz', cls: 'aux', a: ['did'],
    t: 'When ___ the client finally sign the contract, and who was in the room at that point?',
    c: {
      has: 'has braucht ein Partizip (signed); hier steht die Grundform sign. || has needs a participle (signed); the sentence has the base form sign.',
      was: 'was sign ist falsch; in der Frage nach einem Zeitpunkt steht did + Grundform. || was sign is wrong; a question about a point in time takes did + base form.',
      does: 'does ist Gegenwart, die Frage geht aber um etwas Vergangenes. || does is present, but the question is about the past.',
    },
    ok: 'Frage nach einem Zeitpunkt in der Vergangenheit: When did + Subjekt + Grundform. || A question about a past point in time: When did + subject + base form.',
  },
  {
    p: 'psp.finished-time', lv: 'B2', dom: 'life', cls: 'prep', a: ['in'],
    t: 'We moved to Frankfurt ___ 2019, and my daughter was born there two years later.',
    c: {
      since: 'since nennt den Anfang bis heute; die Handlung ist aber abgeschlossen. || since names a start up to now, but the action is finished.',
      for: 'for nennt eine Dauer, hier steht aber ein Jahr als Zeitpunkt. || for names a length of time, but here a year is a point in time.',
      at: 'at steht bei Uhrzeiten, nicht bei Jahreszahlen. || at goes with clock times, not with years.',
    },
    ok: 'Abgeschlossene Zeit mit Jahreszahl: Past Simple und in 2019. || A finished time with a year: past simple and in 2019.',
  },
  {
    p: 'psp.since-for', lv: 'B2', dom: 'life', cls: 'prep', a: ['since'],
    t: 'Our family has used the same holiday cottage ___ 2018, and nobody wants to change it.',
    c: {
      for: 'for braucht eine Länge („for six years“), keine Jahreszahl. || for needs a length of time (“for six years”), not a year.',
      in: 'in 2018 passt zum Past Simple, nicht zu has used. || in 2018 goes with the past simple, not with has used.',
      from: 'from 2018 braucht ein „to“ oder „until“; mit has used gilt since. || from 2018 needs “to” or “until”; with has used you need since.',
    },
    ok: 'Dauer bis heute ab einem Zeitpunkt: has/have + Partizip + since + Zeitpunkt. || Duration up to now from a point in time: has/have + participle + since + point in time.',
  },
  {
    p: 'psp.since-for', lv: 'B2', dom: 'life', cls: 'prep', a: ['for'],
    t: 'Our firm has supplied the regional hospital ___ more than twenty years, and we have never missed a delivery.',
    c: {
      since: 'since braucht einen Zeitpunkt („since 2011“), keine Länge. || since needs a point in time (“since 2011”), not a length.',
      during: 'during nennt einen Zeitraum, in dem etwas geschieht, nicht die Länge bis heute. || during names a period in which something happens, not the length up to now.',
      in: 'in passt nicht zu einer Länge von Jahren mit have known. || in does not fit a length of years with have known.',
    },
    ok: 'Länge der Zeit: for + fifteen years; since stünde nur vor einem Startpunkt. || A length of time: for + fifteen years; since only comes before a starting point.',
  },
  {
    p: 'psp.experience', lv: 'B2', dom: 'biz', cls: 'adv', a: ['ever'],
    t: 'Have you ___ worked with a customer who changed the scope after the contract was signed?',
    c: {
      yet: 'yet steht am Satzende in Fragen nach einem erwarteten Ereignis. || yet comes at the end of questions about an expected event.',
      just: 'just bedeutet „gerade eben“, nicht „je im Leben“. || just means “a moment ago”, not “at any time in your life”.',
      soon: 'soon bedeutet „bald“ und passt nicht zu have worked. || soon means “shortly” and does not fit have worked.',
    },
    ok: 'Erfahrung im bisherigen Leben fragt man mit Have you ever + Partizip? || You ask about experience so far in life with Have you ever + participle?',
  },
  {
    p: 'psp.experience', lv: 'B2+', dom: 'life', cls: 'adv', a: ['never', 'not'],
    t: 'I have ___ been to Japan, so I have no idea what to expect from the trip next month.',
    c: {
      ever: 'ever steht in Fragen oder nach Superlativen, nicht in einer solchen Aussage. || ever belongs in questions or after superlatives, not in a statement like this.',
      yet: 'yet passt nicht zwischen have und been in dieser Aussage. || yet does not fit between have and been in this statement.',
      just: 'just bedeutet „gerade eben“ und widerspricht „no idea“. || just means “a moment ago” and contradicts “no idea”.',
    },
    ok: 'Keine Erfahrung bis jetzt: have never been (oder have not been). || No experience so far: have never been (or have not been).',
  },
  {
    p: 'psp.result-now', lv: 'B2', dom: 'biz', cls: 'adv', a: ['just', 'already', 'recently', 'now', 'finally'],
    t: 'Could you check the figures again? The finance team has ___ sent me a corrected version.',
    c: {
      ever: 'ever steht in Fragen und Verneinungen, nicht in einer solchen Aussage. || ever belongs in questions and negatives, not in a statement like this.',
      yet: 'yet steht am Ende von Fragen und Verneinungen, nicht vor dem Partizip. || yet comes at the end of questions and negatives, not before the participle.',
      ago: 'ago steht nach einer Zeitangabe und braucht das Past Simple. || ago follows a time expression and needs the past simple.',
    },
    ok: 'Gerade eben oder schon passiert, Ergebnis jetzt: has/have + just/already + Partizip. || Happened a moment ago or by now, result now: has/have + just/already + participle.',
  },
  {
    p: 'psp.result-now', lv: 'B2', dom: 'life', cls: 'adv', a: ['yet'],
    t: 'I have not decided ___ whether I will accept the new offer, so please give me until Friday.',
    c: {
      already: 'already steht in Aussagen, nicht in einer Verneinung wie „have not decided“. || already belongs in statements, not in a negative like “have not decided”.',
      ever: 'ever passt nicht zu „have not decided … whether“. || ever does not fit “have not decided … whether”.',
      still: 'still würde vor have not stehen: „I still have not decided“. || still would stand before have not: “I still have not decided”.',
    },
    ok: 'Noch nicht, aber erwartet: have not + Partizip + yet. || Not yet, but expected: have not + participle + yet.',
  },
  // ---- pres-perf-cont ----
  {
    p: 'pc.duration', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['have'],
    t: 'Our two developers ___ been fixing the login bug since Monday morning, and it is still not solved.',
    c: {
      are: 'are been gibt es nicht; vor been steht have/has. || are been does not exist; been needs have/has.',
      had: 'had been bezieht sich auf einen früheren Zeitpunkt; „since Monday … still“ reicht bis jetzt. || had been refers to an earlier point; “since Monday … still” reaches up to now.',
      were: 'were been ist falsch; die Form heißt have/has been + -ing. || were been is wrong; the form is have/has been + -ing.',
    },
    ok: 'Dauer bis jetzt mit Handlung: have/has been + -ing; zu two developers (Plural) passt have. || Duration up to now with an activity: have/has been + -ing; the plural two developers goes with have.',
  },
  {
    p: 'pc.since-for', lv: 'B2', dom: 'life', cls: 'prep', a: ['for'],
    t: 'The construction crew has been drilling next door ___ four hours, and I cannot make a single phone call.',
    c: {
      since: 'since braucht einen Startpunkt („since noon“), hier steht eine Länge. || since needs a starting point (“since noon”), but here is a length.',
      during: 'during passt nicht zu has been playing + Länge der Zeit. || during does not fit has been playing + a length of time.',
      from: 'from passt nicht ohne „to“; die Länge nennt for. || from does not work without “to”; for names the length.',
    },
    ok: 'for + Länge der Zeit (four hours), since + Zeitpunkt (since noon). || for + length of time (four hours), since + point in time (since noon).',
  },
  {
    p: 'pc.recent', lv: 'B2+', dom: 'biz', cls: 'det', a: ['last', 'past'],
    t: 'Over the ___ few months, orders from the Nordic region have been going up, and the board is finally starting to take notice.',
    c: {
      next: 'next verlangt die Zukunft; have been going up beschreibt die Zeit bis jetzt. || next needs the future; have been going up describes the time up to now.',
      following: 'following passt zu einem Zeitraum nach einem genannten Ereignis. || following fits a period after a named event.',
      every: 'every few months heißt „alle paar Monate“ und beschreibt keine Entwicklung bis jetzt. || every few months means “once in a while” and describes no development up to now.',
    },
    ok: 'Entwicklung in letzter Zeit: over the last/past few months + have been + -ing. || A recent development: over the last/past few months + have been + -ing.',
  },
  {
    p: 'pc.form', lv: 'B2', dom: 'life', cls: 'aux', a: ['has'],
    t: 'How long ___ the delivery truck been standing outside, and has anybody asked the driver what he wants?',
    c: {
      have: 'have passt zu I, you, we, they; ein einzelner Lastwagen verlangt has. || have goes with I, you, we, they; a single truck needs has.',
      is: 'is been ist keine Form; vor been steht has/have. || is been is not a form; been needs has/have.',
      did: 'did + been gibt es nicht; die Dauer bis jetzt braucht has been + -ing. || did + been does not exist; duration up to now needs has been + -ing.',
    },
    ok: 'Frage nach der Dauer bis jetzt: How long + has/have + Subjekt + been + -ing. Zu truck gehört has. || A question about duration up to now: How long + has/have + subject + been + -ing. truck takes has.',
  },
  {
    p: 'pc.cont-simple', lv: 'B2+', dom: 'biz', cls: 'adv', a: ['far'],
    t: 'So ___, we have signed twelve new customers this quarter, but I have been talking to many more.',
    c: {
      long: 'So long heißt „bis bald“ und passt nicht zu einer Zahl. || So long means “goodbye” and does not fit a count.',
      much: 'So much passt hier nicht; „so far“ ist die feste Wendung. || So much does not fit here; “so far” is the fixed phrase.',
      well: 'So well bedeutet „so gut“ und nennt keinen Zeitraum bis jetzt. || So well means “so successfully” and does not name a period up to now.',
    },
    ok: 'So far = bis jetzt, mit der Zahl als Ergebnis: have signed twelve. || So far = up to now, with the number as the result: have signed twelve.',
  },
  // ---- future-forms ----
  {
    p: 'ff.will-now', lv: 'B2', dom: 'biz', cls: 'aux', a: ['will', 'shall'],
    t: 'Thanks for the reminder about the missing signature; I ___ get it signed by the end of the day, I promise.',
    c: {
      am: 'am get ergibt keinen Satz; für ein Versprechen steht will + Grundform. || am get does not make a sentence; a promise takes will + base form.',
      do: 'do get sagt nichts über die Zukunft. || do get says nothing about the future.',
      have: 'have get gibt es nicht; have braucht got oder gotten. || have get does not exist; have needs got or gotten.',
    },
    ok: 'Entschluss und Versprechen im Gespräch: I will + Grundform. || A decision and promise during the conversation: I will + base form.',
  },
  {
    p: 'ff.going-to', lv: 'B2', dom: 'life', cls: 'aux', a: ['are'],
    t: 'We ___ going to renovate the kitchen next spring because the old one is falling apart.',
    c: {
      will: 'will + going to kann man nicht verbinden. || will and going to cannot be combined.',
      do: 'do + going to gibt es nicht; vor going to steht am/is/are. || do + going to does not exist; going to needs am/is/are.',
      have: 'have + going to ist falsch; die Form lautet be going to. || have + going to is wrong; the form is be going to.',
    },
    ok: 'Ein schon geplantes Vorhaben: am/is/are + going to + Grundform; zu we gehört are. || A plan already made: am/is/are + going to + base form; we goes with are.',
  },
  {
    p: 'ff.was-going-to', lv: 'B2', dom: 'biz', cls: 'aux', a: ['was'],
    t: 'I ___ going to send you the minutes yesterday, but my laptop broke and I lost all my notes.',
    c: {
      am: 'am going to meint die Gegenwart; „my laptop broke“ zeigt, dass der Plan Vergangenheit ist. || am going to is present; “my laptop broke” shows the plan is past.',
      were: 'were passt zu you, we, they; I verlangt was. || were goes with you, we, they; I needs was.',
      will: 'will ist Zukunft; hier geht es um einen geplatzten Plan in der Vergangenheit. || will is future; this is about a plan that fell through in the past.',
    },
    ok: 'Plan, der nicht klappte: was/were going to + Grundform; zu I gehört was. || A plan that fell through: was/were going to + base form; I goes with was.',
  },
  {
    p: 'ff.fixed-times', lv: 'B2', dom: 'life', cls: 'prep', a: ['at'],
    t: 'Our train to the lake in Bavaria leaves ___ 7:45 tomorrow morning, so please be at the station by 7:15.',
    c: {
      in: 'in steht bei Zeiträumen („in May“), nicht bei einer Uhrzeit. || in goes with periods (“in May”), not with a clock time.',
      on: 'on steht bei Tagen und Daten („on Monday“). || on goes with days and dates (“on Monday”).',
      by: 'by heißt „spätestens um“, der Zug fährt aber genau um 7:45. || by means “no later than”, but the train leaves exactly at 7:45.',
    },
    ok: 'Fahrplan im Present Simple, Uhrzeit mit at: leaves at 7:45. || A timetable takes the present simple, clock time takes at: leaves at 7:45.',
  },
  {
    p: 'ff.about-to', lv: 'B2+', dom: 'life', cls: 'part', a: ['to'],
    t: 'Hurry up, the doors of the train are about ___ close, and the next one leaves in an hour.',
    c: {
      for: 'about for close ist keine Wendung; es heißt be about to + Grundform. || about for close is not a phrase; it is be about to + base form.',
      of: 'about of close gibt es nicht; nach about folgt hier to. || about of close does not exist; to follows about here.',
      by: 'about by close gibt es nicht; die feste Wendung ist about to. || about by close does not exist; the fixed phrase is about to.',
    },
    ok: 'Gleich passiert es: be about to + Grundform. || It happens any moment now: be about to + base form.',
  },
  {
    p: 'ff.no-will-after', lv: 'B2', dom: 'biz', cls: 'conj', a: ['unless', 'until'],
    t: 'We will not be able to deliver the update on Friday ___ the client sends us the missing data today.',
    c: {
      if: 'if ergäbe die falsche Bedeutung: Wir liefern nicht, falls er sendet. || if would give the wrong meaning: we do not deliver if he sends it.',
      since: 'since heißt „weil“ oder „seit“; hier geht es um eine Voraussetzung. || since means “because” or “from the time”; this is a requirement.',
      although: 'although heißt „obwohl“; es gibt keinen Gegensatz, sondern eine Voraussetzung. || although means “even though”; there is no contrast, only a requirement.',
    },
    ok: 'unless = außer wenn, mit Gegenwart statt will: unless the client sends. || unless = except if, with the present instead of will: unless the client sends.',
  },
  // ---- time-clauses ----
  {
    p: 'tc.present-for-future', lv: 'B2', dom: 'biz', cls: 'adv', a: ['soon'],
    t: 'We will start the rollout as ___ as the client has signed off the test report.',
    c: {
      long: 'as long as bedeutet „solange“ und passt nicht zu „sobald es abgenommen ist“. || as long as means “provided that” and does not fit “as soon as it is signed off”.',
      well: 'as well as heißt „sowie“ und hat keinen Zeitbezug. || as well as means “and also” and has no time reference.',
      much: 'as much as nennt eine Menge, keinen Zeitpunkt. || as much as names an amount, not a point in time.',
    },
    ok: 'Zeitsatz mit as soon as und Gegenwart statt will: as soon as the client has signed off. || A time clause with as soon as and the present instead of will: as soon as the client has signed off.',
  },
  {
    p: 'tc.present-for-future', lv: 'B2', dom: 'life', cls: 'aux', a: ['are'],
    t: 'When my parents arrive on Saturday, we ___ going to take them to the old town for dinner.',
    c: {
      will: 'will + going to kann man nicht verbinden. || will and going to cannot be combined.',
      do: 'do + going to gibt es nicht; vor going to steht am/is/are. || do + going to does not exist; going to needs am/is/are.',
      have: 'have + going to ist falsch; die Form lautet be going to. || have + going to is wrong; the form is be going to.',
    },
    ok: 'Nach when steht die Gegenwart (arrive), nicht will; der Plan selbst: are going to. || After when the present is used (arrive), not will; the plan itself: are going to.',
  },
  {
    p: 'tc.present-perfect', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['has'],
    t: 'Once the supplier ___ confirmed the delivery slot, we will inform all regional offices.',
    c: {
      will: 'Nach once steht keine Zukunft mit will. || After once you do not use will.',
      are: 'are confirmed passt nicht zu supplier (Singular) und ist keine Perfektform. || are confirmed does not fit supplier (singular) and is not a perfect form.',
      had: 'had confirmed ist Vergangenheit; hier wird eine künftige Voraussetzung beschrieben. || had confirmed is past; this describes a future condition.',
    },
    ok: 'Eine Handlung muss vorher abgeschlossen sein: once + Present Perfect, im Hauptsatz will. || An action must be completed first: once + present perfect, will in the main clause.',
  },
  {
    p: 'tc.by-the-time', lv: 'B2+', dom: 'biz', cls: 'prep', a: ['by'],
    t: '___ the time the new CEO starts in January, we will already have moved the whole team into the new building.',
    c: {
      at: 'at the time heißt „damals“ und passt nicht zu einer künftigen Frist. || at the time means “back then” and does not fit a future deadline.',
      on: 'on the time ist keine Wendung. || on the time is not a phrase.',
      in: 'in the time bedeutet „in der Zeit“ und passt nicht zu einer Frist. || in the time means “within the time” and does not fit a deadline.',
    },
    ok: 'By the time + Gegenwart: spätestens bis dahin; im Hauptsatz Future Perfect. || By the time + present: no later than then; the main clause takes the future perfect.',
  },
  {
    p: 'tc.noun-clause', lv: 'B2+', dom: 'biz', cls: 'conj', a: ['when', 'if', 'whether'],
    t: 'I do not know ___ the new software will be ready, but I will ask our IT department tomorrow.',
    c: {
      unless: 'unless heißt „außer wenn“ und leitet keine indirekte Frage ein. || unless means “except if” and does not introduce an indirect question.',
      until: 'until nennt einen Endpunkt und leitet hier keine indirekte Frage ein. || until names an end point and does not introduce an indirect question here.',
      while: 'while heißt „während“ und leitet hier keine indirekte Frage ein. || while means “during the time that” and does not introduce an indirect question here.',
    },
    ok: 'In einer indirekten Frage bleibt will (when/if/whether it will be ready); die Gegenwart gilt nur im Zeitsatz. || In an indirect question will stays (when/if/whether it will be ready); the present is only for time clauses.',
  },
  {
    p: 'tc.noun-clause', lv: 'B2', dom: 'life', cls: 'conj', a: ['whether', 'if'],
    t: 'I am not sure ___ my flight will be on time, because there is a strike at the airport.',
    c: {
      when: 'when fragt nach einem Zeitpunkt; hier geht es um ja oder nein. || when asks for a point in time; this is a yes/no question.',
      unless: 'unless heißt „außer wenn“ und leitet keine Frage ein. || unless means “except if” and does not introduce a question.',
      about: 'about braucht ein Nomen oder -ing, keinen ganzen Satz. || about needs a noun or -ing, not a full clause.',
    },
    ok: 'Ja/Nein-Frage nach not sure: whether oder if, und will bleibt. || A yes/no question after not sure: whether or if, and will stays.',
  },
  {
    p: 'tc.present-for-future', lv: 'B2', dom: 'biz', cls: 'conj', a: ['until', 'till'],
    t: 'Our support team will keep answering calls ___ the last customer on the line has been helped.',
    c: {
      unless: 'unless heißt „außer wenn“; hier ist „bis“ gemeint. || unless means “except if”; here “up to the time that” is meant.',
      since: 'since nennt einen Startpunkt, hier geht es um ein Ende. || since names a starting point, but this is about an end.',
      while: 'while heißt „während“ und passt nicht zu einer abgeschlossenen Handlung (has been helped). || while means “during” and does not fit a completed action (has been helped).',
    },
    ok: 'until = bis; danach steht die Gegenwart (has been helped), kein will. || until = up to the time that; the present follows (has been helped), never will.',
  },
];
