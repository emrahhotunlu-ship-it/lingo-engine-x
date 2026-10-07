// P21 Charge ocl-2: Kleines Wort, Kapitel 2 (Zeiten präzise und vorsichtig). Felder wie ocl-1.
export const meta = { file: 'k2-2' };
export const items = [
  // ---- c1-hedging ----
  {
    p: 'hg.modal', lv: 'C1', dom: 'biz', cls: 'aux', a: ['might', 'may', 'could'],
    t: 'The drop in orders ___ be linked to the price increase, but we have not analyzed the data yet.',
    c: {
      must: 'must drückt Sicherheit aus, ihr habt aber noch nicht geprüft. || must expresses certainty, but you have not checked yet.',
      shall: 'shall passt nicht zu einer vermuteten Ursache. || shall does not fit a suspected cause.',
      would: 'would braucht eine Bedingung (if …); hier steht keine. || would needs a condition (if …); there is none here.',
    },
    ok: 'Vorsichtige Möglichkeit: might/could/may + Grundform statt einer festen Behauptung. || Cautious possibility: might/could/may + base form instead of a flat claim.',
  },
  {
    p: 'hg.modal', lv: 'C1', dom: 'biz', cls: 'aux', a: ['might', 'may', 'could', 'should'],
    t: 'The new vendor ___ be cheaper than our current one, but we need to compare both offers first.',
    c: {
      must: 'must wäre eine Schlussfolgerung mit Sicherheit; der Vergleich steht noch aus. || must would be a confident conclusion; the comparison is still to come.',
      shall: 'shall passt nicht zu einer Vermutung über Preise. || shall does not fit a guess about prices.',
      would: 'would ohne if-Satz klingt unvollständig. || would without an if-clause sounds incomplete.',
    },
    ok: 'Noch nicht belegt, also vorsichtig: might/may/could be statt is. || Not yet proven, so cautious: might/may/could be instead of is.',
  },
  {
    p: 'hg.worth', lv: 'C1', dom: 'biz', cls: 'aux', a: ['be'],
    t: 'It could ___ worth asking the vendor for a written guarantee before we place the order.',
    c: {
      is: 'Nach could steht die Grundform be, nicht is. || After could comes the base form be, not is.',
      been: 'could been ist keine Form; es braucht be oder have been. || could been is not a form; it needs be or have been.',
      being: 'could being gibt es nicht; nach einem Modalverb steht die Grundform. || could being does not exist; a modal verb takes the base form.',
    },
    ok: 'Höfliche Empfehlung: It could/might be worth + -ing. || A polite suggestion: It could/might be worth + -ing.',
  },
  {
    p: 'hg.inclined', lv: 'C1', dom: 'biz', cls: 'part', a: ['to'],
    t: 'Personally, I would be inclined ___ wait for the second quote before we make a final decision.',
    c: {
      for: 'inclined for + Grundform gibt es nicht; es heißt inclined to + Grundform. || inclined for + base form does not exist; it is inclined to + base form.',
      of: 'inclined of ist keine Wendung. || inclined of is not a phrase.',
      at: 'inclined at ist keine Wendung. || inclined at is not a phrase.',
    },
    ok: 'Eigene Neigung vorsichtig sagen: I would be inclined to + Grundform. || Stating your own leaning cautiously: I would be inclined to + base form.',
  },
  {
    p: 'hg.seems', lv: 'C1', dom: 'biz', cls: 'conj', a: ['if', 'though'],
    t: 'It seems as ___ our competitor has lowered its prices again, because several customers have stopped ordering.',
    c: {
      when: 'as when ist keine Wendung nach seems; es heißt as if oder as though. || as when is not used after seems; it is as if or as though.',
      unless: 'unless heißt „außer wenn“ und passt nicht nach as. || unless means “except if” and does not follow as.',
      since: 'as since gibt es nicht. || as since does not exist.',
    },
    ok: 'Eindruck vorsichtig ausdrücken: It seems as if/as though + Satz. || Expressing an impression cautiously: It seems as if/as though + clause.',
  },
  {
    p: 'hg.downtoner', lv: 'C1', dom: 'biz', cls: 'adv', a: ['not', 'never'],
    t: 'To be honest, the new interface is ___ quite as intuitive as the old one, at least for our sales team.',
    c: {
      very: 'very quite gibt es nicht; very und quite stehen nicht zusammen. || very quite does not exist; very and quite do not go together.',
      too: 'too quite gibt es nicht. || too quite does not exist.',
      so: 'so quite gibt es nicht; „not quite as … as“ ist die weiche Kritik. || so quite does not exist; “not quite as … as” is the soft criticism.',
    },
    ok: 'Weiche Kritik: not quite + as … as, ohne „schlechter“ zu sagen. || Soft criticism: not quite + as … as, without saying “worse”.',
  },
  // ---- future-perf-cont ----
  {
    p: 'fut.continuous', lv: 'B2', dom: 'life', cls: 'aux', a: ['be'],
    t: 'This time tomorrow, the whole team will ___ sitting in the board meeting, so nobody will answer the phone.',
    c: {
      are: 'will are gibt es nicht; nach will steht die Grundform be. || will are does not exist; will takes the base form be.',
      been: 'will been ist falsch; will be + -ing ist die Form. || will been is wrong; will be + -ing is the form.',
      being: 'will being ist falsch; nach will steht be. || will being is wrong; will is followed by be.',
    },
    ok: 'Was zu einem künftigen Zeitpunkt gerade läuft: will be + -ing. || What will be in progress at a future moment: will be + -ing.',
  },
  {
    p: 'fut.continuous', lv: 'B2', dom: 'biz', cls: 'det', a: ['this', 'that'],
    t: 'At ___ time tomorrow, I will be meeting the new CFO in Zurich, so I will not read any e-mails.',
    c: {
      the: 'at the time tomorrow passt nicht; es braucht this time. || at the time tomorrow does not fit; it needs this time.',
      every: 'at every time tomorrow ist keine Wendung. || at every time tomorrow is not a phrase.',
      each: 'at each time tomorrow ist keine Wendung. || at each time tomorrow is not a phrase.',
    },
    ok: 'This time tomorrow nennt den künftigen Zeitpunkt, an dem die Handlung läuft: will be meeting. || This time tomorrow names the future moment when the action is in progress: will be meeting.',
  },
  {
    p: 'fut.cont-plan', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['will', 'would'],
    t: '___ you be needing the company car on Thursday, or may I take it to the airport?',
    c: {
      are: 'Are you be using ist falsch; mit be + -ing braucht es Will you be using. || Are you be using is wrong; with be + -ing it is Will you be using.',
      do: 'Do you be using gibt es nicht. || Do you be using does not exist.',
      can: 'Can you be using ist keine Form. || Can you be using is not a form.',
    },
    ok: 'Höfliche Frage nach Plänen: Will you be + -ing? klingt weniger drängend als Are you going to …? || A polite question about plans: Will you be + -ing? sounds less pushy than Are you going to …?',
  },
  {
    p: 'fut.perfect', lv: 'B2', dom: 'biz', cls: 'aux', a: ['have'],
    t: 'By the end of next year, our team will ___ opened twelve new offices across Europe.',
    c: {
      be: 'will be signed wäre Passiv; hier sind wir die, die unterschreiben lassen: will have signed. || will be signed would be passive; here we are the ones doing it: will have signed.',
      had: 'will had gibt es nicht; nach will steht have. || will had does not exist; will is followed by have.',
      has: 'will has gibt es nicht; nach will steht immer have. || will has does not exist; will is always followed by have.',
    },
    ok: 'Bis zu einem künftigen Zeitpunkt abgeschlossen: will have + Partizip. || Completed by a future moment: will have + participle.',
  },
  {
    p: 'fut.perfect', lv: 'B2+', dom: 'life', cls: 'aux', a: ['have'],
    t: 'By the time you read this message, I will already ___ boarded the plane to Singapore.',
    c: {
      be: 'will be boarded wäre Passiv; gemeint ist die Handlung des Sprechers. || will be boarded would be passive; the speaker\'s own action is meant.',
      had: 'will had gibt es nicht; nach will steht have. || will had does not exist; will is followed by have.',
      has: 'will has gibt es nicht; nach will steht have. || will has does not exist; will is followed by have.',
    },
    ok: 'By the time + Gegenwart, im Hauptsatz will have + Partizip: schon passiert bis dahin. || By the time + present, the main clause takes will have + participle: already done by then.',
  },
  {
    p: 'fut.perf-cont', lv: 'C1', dom: 'biz', cls: 'aux', a: ['been'],
    t: 'In October, the CFO will have ___ leading the finance department for exactly twelve years.',
    c: {
      be: 'will have be ist falsch; die Form heißt will have been + -ing. || will have be is wrong; the form is will have been + -ing.',
      being: 'will have being ist falsch. || will have being is wrong.',
      was: 'will have was gibt es nicht. || will have was does not exist.',
    },
    ok: 'Dauer bis zu einem künftigen Zeitpunkt: will have been + -ing. || Duration up to a future moment: will have been + -ing.',
  },
  {
    p: 'fut.perf-cont', lv: 'C1', dom: 'biz', cls: 'prep', a: ['for'],
    t: 'By December, she will have been managing the sales team ___ nearly eight years.',
    c: {
      since: 'since braucht einen Zeitpunkt („since 2017“), hier steht eine Länge. || since needs a point in time (“since 2017”), but here is a length.',
      in: 'in nearly eight years passt nicht zu will have been managing. || in nearly eight years does not fit will have been managing.',
      during: 'during nennt keinen Gesamtzeitraum bis zu einem Zeitpunkt. || during does not name a total span up to a point.',
    },
    ok: 'Länge der Zeit mit for: will have been managing for nearly eight years. || A length of time takes for: will have been managing for nearly eight years.',
  },
  // ---- past-perfect ----
  {
    p: 'pp.earlier', lv: 'B2', dom: 'biz', cls: 'aux', a: ['had'],
    t: 'By the time the CEO arrived at the venue, the presentation ___ already started without her.',
    c: {
      has: 'has already started gehört zur Gegenwart; hier geht es um früher als „arrived“. || has already started is present; here the action is earlier than “arrived”.',
      have: 'have passt nicht zu presentation (Singular) und nicht zur Vergangenheit. || have does not fit presentation (singular) or the past.',
      is: 'is already started ist keine Zeitform. || is already started is not a tense.',
    },
    ok: 'Das frühere von zwei Ereignissen in der Vergangenheit: had + Partizip. || The earlier of two past events: had + participle.',
  },
  {
    p: 'pp.earlier', lv: 'B2', dom: 'life', cls: 'aux', a: ['had'],
    t: 'I could not open the door of my apartment because I ___ left my keys at the office again.',
    c: {
      have: 'have left passt zur Gegenwart; „could not“ liegt schon in der Vergangenheit. || have left is present; “could not” is already in the past.',
      was: 'was left wäre Passiv; gemeint ist, dass ich sie liegen ließ. || was left would be passive; what is meant is that I left them.',
      did: 'did left gibt es nicht; nach did steht die Grundform. || did left does not exist; did takes the base form.',
    },
    ok: 'Was vor „could not“ passiert war: had left (Past Perfect). || What had happened before “could not”: had left (past perfect).',
  },
  {
    p: 'pp.duration', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['been'],
    t: 'We had ___ waiting for the client for two hours when he finally called to cancel the meeting.',
    c: {
      be: 'had be waiting ist falsch; die Form heißt had been + -ing. || had be waiting is wrong; the form is had been + -ing.',
      being: 'had being waiting ist falsch. || had being waiting is wrong.',
      was: 'had was waiting gibt es nicht. || had was waiting does not exist.',
    },
    ok: 'Dauer vor einem Zeitpunkt in der Vergangenheit: had been + -ing. || Duration before a past point: had been + -ing.',
  },
  {
    p: 'pp.duration', lv: 'B2+', dom: 'life', cls: 'prep', a: ['since', 'from'],
    t: 'The engineers were tired because they had been testing the system ___ midnight without a break.',
    c: {
      for: 'for braucht eine Länge („for ten hours“), hier steht eine Uhrzeit. || for needs a length of time (“for ten hours”), but here is a clock time.',
      during: 'during passt nicht vor einer Uhrzeit. || during does not fit before a clock time.',
      by: 'by heißt „spätestens um“; hier ist der Anfang gemeint. || by means “no later than”; the start is meant here.',
    },
    ok: 'Startpunkt der Dauer: since six o\'clock (oder from six o\'clock). || The starting point of the duration: since six o\'clock (or from six o\'clock).',
  },
  {
    p: 'pp.first-time', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['had'],
    t: 'It was the first time we ___ ever lost a bid against a smaller competitor, and the mood in the team was bad.',
    c: {
      have: 'have passt zur Gegenwart; „It was“ steht schon in der Vergangenheit. || have is present; “It was” is already in the past.',
      did: 'did lost gibt es nicht; nach did steht die Grundform. || did lost does not exist; did takes the base form.',
      was: 'was lost wäre Passiv: „wurde verloren“. || was lost would be passive.',
    },
    ok: 'It was the first time + had + Partizip: die Erfahrung liegt vor „was“. || It was the first time + had + participle: the experience lies before “was”.',
  },
  {
    p: 'pp.first-time', lv: 'B2+', dom: 'life', cls: 'adv', a: ['ever'],
    t: 'It was the first time he had ___ been to a trade fair, so everything felt new and exciting.',
    c: {
      never: 'never plus „first time“ ergibt eine doppelte Verneinung. || never plus “first time” makes a double negative.',
      yet: 'yet passt nicht zwischen had und been in dieser Aussage. || yet does not fit between had and been in this statement.',
      already: 'already bedeutet „schon“ und widerspricht „first time“. || already means “by then” and contradicts “first time”.',
    },
    ok: 'the first time + had ever + Partizip: in meinem Leben bis dahin. || the first time + had ever + participle: in his life up to then.',
  },
  {
    p: 'pp.reported', lv: 'B2', dom: 'biz', cls: 'aux', a: ['had'],
    t: 'He explained that the committee ___ already rejected the first draft before the meeting started.',
    c: {
      has: 'has gehört zur Gegenwart; nach einem Berichtsverb in der Vergangenheit rutscht has/have zu had. || has is present; after a reporting verb in the past has/have moves back to had.',
      have: 'have wird in der berichteten Rede zu had. || have becomes had in reported speech.',
      would: 'would rejected gibt es nicht; had + Partizip steht für das Frühere. || would rejected does not exist; had + participle expresses the earlier action.',
    },
    ok: 'Berichtete Rede in der Vergangenheit: have/has + Partizip wird zu had + Partizip. || Reported speech in the past: have/has + participle becomes had + participle.',
  },
  {
    p: 'pp.reported', lv: 'B2', dom: 'life', cls: 'aux', a: ['would'],
    t: 'He said that he ___ call me the next day, but I never heard from him again.',
    c: {
      will: 'will wird nach „said“ in der Vergangenheit zu would. || will becomes would after “said” in the past.',
      had: 'had call gibt es nicht; had braucht ein Partizip (called). || had call does not exist; had needs a participle (called).',
      has: 'has call gibt es nicht. || has call does not exist.',
    },
    ok: 'Berichtete Rede in der Vergangenheit: will wird zu would, tomorrow zu the next day. || Reported speech in the past: will becomes would, tomorrow becomes the next day.',
  },
  {
    p: 'pp.inversion', lv: 'C1', dom: 'biz', cls: 'conj', a: ['than'],
    t: 'No sooner had the new software been installed ___ the first complaints arrived from the sales team.',
    c: {
      when: 'when gehört zu Hardly … when; zu No sooner gehört than. || when belongs to Hardly … when; No sooner takes than.',
      then: 'then ist kein Bindewort für diesen Vergleich. || then is not the linking word for this comparison.',
      that: 'that passt nicht nach No sooner had … || that does not fit after No sooner had …',
    },
    ok: 'No sooner had + Subjekt + Partizip … than: kaum war etwas passiert, passierte das Nächste. || No sooner had + subject + participle … than: hardly had one thing happened when the next did.',
  },
  {
    p: 'pp.inversion', lv: 'C1', dom: 'life', cls: 'conj', a: ['when', 'before'],
    t: 'Hardly had we arrived at the hotel ___ it started to rain heavily, so we stayed in for the evening.',
    c: {
      than: 'than gehört zu No sooner; nach Hardly steht traditionell when. || than belongs to No sooner; after Hardly the standard word is when.',
      then: 'then ist kein Bindewort für diesen Satz. || then is not the linking word for this sentence.',
      while: 'while heißt „während“ und beschreibt Gleichzeitigkeit, hier folgt aber eins auf das andere. || while means “during” and describes simultaneity, but here one thing follows the other.',
    },
    ok: 'Hardly had + Subjekt + Partizip … when: kaum angekommen, schon passierte das Nächste. || Hardly had + subject + participle … when: hardly arrived, the next thing happened.',
  },
  // ---- used-to ----
  {
    p: 'ut.used-to', lv: 'B2', dom: 'biz', cls: 'aux', a: ['used'],
    t: 'We ___ to work in a small office near the station before the company grew to two hundred people.',
    c: {
      use: 'use to ohne did ist falsch; in der Aussage heißt es used to. || use to without did is wrong; in a statement it is used to.',
      would: 'would to work gibt es nicht; would steht ohne to. || would to work does not exist; would takes no to.',
      did: 'did to work gibt es nicht; did steht mit use to in Fragen und Verneinungen. || did to work does not exist; did goes with use to in questions and negatives.',
    },
    ok: 'Frühere Gewohnheit oder Lage, die es nicht mehr gibt: used to + Grundform. || A past habit or situation that no longer exists: used to + base form.',
  },
  {
    p: 'ut.would', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['would'],
    t: 'Every Friday afternoon, our old boss ___ invite the whole team for coffee and talk about the week.',
    c: {
      used: 'used invite gibt es nicht; es heißt used to invite. || used invite does not exist; it is used to invite.',
      did: 'did invite wäre betont und einmalig, nicht „jeden Freitag“. || did invite would be emphatic and one-off, not “every Friday”.',
      was: 'was invite gibt es nicht. || was invite does not exist.',
    },
    ok: 'Wiederholte Handlungen in der Vergangenheit: would + Grundform („every Friday“). || Repeated actions in the past: would + base form (“every Friday”).',
  },
  {
    p: 'ut.did-use-to', lv: 'B2', dom: 'biz', cls: 'part', a: ['use'],
    t: 'Did you ___ to work from home before the pandemic, or was it always an office job?',
    c: {
      used: 'Nach did steht use, nicht used: Did you use to … || After did comes use, not used: Did you use to …',
      using: 'use to hat kein -ing; nach did steht die Grundform. || use to has no -ing; after did the base form is used.',
      would: 'Did you would gibt es nicht. || Did you would does not exist.',
    },
    ok: 'Fragen und Verneinungen: did + use to (ohne d). || Questions and negatives: did + use to (without d).',
  },
  {
    p: 'ut.did-use-to', lv: 'B2', dom: 'life', cls: 'part', a: ['use'],
    t: 'I did not ___ to like jazz, but now I listen to it almost every evening after work.',
    c: {
      used: 'Nach did not steht use, nicht used. || After did not comes use, not used.',
      using: 'use to hat kein -ing. || use to has no -ing form.',
      get: 'did not get to like wäre eine andere Wendung („dazu kommen, etwas zu mögen“). || did not get to like would be a different phrase (“to come to like”).',
    },
    ok: 'Verneinung früherer Gewohnheiten: did not + use to. || Negating past habits: did not + use to.',
  },
  {
    p: 'ut.be-used-to', lv: 'B2+', dom: 'life', cls: 'part', a: ['used', 'accustomed'],
    t: 'Having lived in Seoul for years, he is perfectly ___ to working late into the evening.',
    c: {
      use: 'is use to gibt es nicht; die Wendung heißt be used to. || is use to does not exist; the phrase is be used to.',
      got: 'is got to ist keine Form; gewöhnt sein heißt is used to. || is got to is not a form; being accustomed is is used to.',
      getting: 'is getting to eating wäre „kommen dazu“, nicht „gewöhnt sein“. || is getting to eating would be “come to”, not “be accustomed”.',
    },
    ok: 'Schon gewöhnt: be used to + -ing oder Nomen. || Already accustomed: be used to + -ing or noun.',
  },
  {
    p: 'ut.get-used-to', lv: 'B2', dom: 'biz', cls: 'prep', a: ['to'],
    t: 'It will take the team some time to get used ___ the new approval workflow, but the training helps.',
    c: {
      for: 'get used for hat eine andere Bedeutung („verwendet werden für“). || get used for has a different meaning (“be used for”).',
      with: 'get used with ist falsch; es heißt get used to. || get used with is wrong; it is get used to.',
      at: 'get used at ist keine Wendung. || get used at is not a phrase.',
    },
    ok: 'Sich gewöhnen: get used to + Nomen oder -ing. || Becoming accustomed: get used to + noun or -ing.',
  },
  {
    p: 'rc.who-which', lv: 'B2', dom: 'biz', cls: 'rel', a: ['that', 'which'],
    t: 'The report ___ I sent you yesterday contains the figures for all regions, so please read the first page carefully.',
    c: {
      who: 'who steht für Personen; ein Bericht ist eine Sache. || who stands for people; a report is a thing.',
      whose: 'whose zeigt Besitz („dessen“), hier fehlt ein Besitzer. || whose shows possession, but there is no owner here.',
      what: 'what leitet keinen Relativsatz zu einem Nomen ein. || what does not introduce a relative clause to a noun.',
    },
    ok: 'Relativsatz zu einer Sache: that oder which; yesterday verlangt das Past Simple (sent). || A relative clause about a thing: that or which; yesterday needs the past simple (sent).',
  },
  // ---- c1-diplomacy ----
  {
    p: 'dip.wondering', lv: 'C1', dom: 'biz', cls: 'conj', a: ['if', 'whether'],
    t: 'I was wondering ___ you could send me the updated price list by tomorrow afternoon.',
    c: {
      that: 'wondering that passt nicht vor einer Bitte; gebraucht wird if oder whether. || wondering that does not fit before a request; if or whether is needed.',
      about: 'wondering about braucht ein Nomen oder -ing, keinen ganzen Satz. || wondering about needs a noun or -ing, not a full clause.',
      unless: 'unless heißt „außer wenn“ und leitet keine höfliche Frage ein. || unless means “except if” and does not introduce a polite question.',
    },
    ok: 'Weiche Bitte: I was wondering if/whether you could … (Vergangenheitsform macht es höflicher). || A soft request: I was wondering if/whether you could … (the past form makes it more polite).',
  },
  {
    p: 'dip.hoping', lv: 'C1', dom: 'biz', cls: 'part', a: ['to'],
    t: 'We were hoping ___ extend the deadline by two days, if that would be possible for your team.',
    c: {
      for: 'hoping for braucht ein Nomen, hier folgt ein Verb. || hoping for needs a noun, but a verb follows here.',
      that: 'hoping that braucht einen ganzen Satz mit Subjekt. || hoping that needs a full clause with a subject.',
      of: 'hoping of gibt es nicht. || hoping of does not exist.',
    },
    ok: 'Höflicher Wunsch: We were hoping to + Grundform. || A polite wish: We were hoping to + base form.',
  },
  {
    p: 'dip.possible', lv: 'C1', dom: 'biz', cls: 'part', a: ['to'],
    t: 'Would it be possible ___ move the meeting to Thursday morning, because several people are traveling on Wednesday?',
    c: {
      for: 'possible for braucht eine Person danach („for us to move“). || possible for needs a person after it (“for us to move”).',
      if: 'possible if + Grundform passt nicht; if braucht einen ganzen Satz. || possible if + base form does not fit; if needs a full clause.',
      that: 'possible that braucht einen Satz mit Subjekt. || possible that needs a clause with a subject.',
    },
    ok: 'Höfliche Frage: Would it be possible + to + Grundform? || A polite question: Would it be possible + to + base form?',
  },
  {
    p: 'dip.possible', lv: 'C1', dom: 'biz', cls: 'prep', a: ['for'],
    t: 'Would it be possible ___ us to join the call about ten minutes late, because of a customer meeting?',
    c: {
      to: 'possible to us ist falsch; vor der Person steht for. || possible to us is wrong; for goes before the person.',
      if: 'possible if us ist falsch. || possible if us is wrong.',
      that: 'possible that us ist falsch. || possible that us is wrong.',
    },
    ok: 'Mit Person: Would it be possible for us to + Grundform? || With a person: Would it be possible for us to + base form?',
  },
  {
    p: 'dip.understate', lv: 'C1', dom: 'biz', cls: 'art', a: ['a'],
    t: 'Honestly, that deadline could be a bit of ___ stretch for our team, given the holidays in December.',
    c: {
      the: 'a bit of the stretch ist keine feste Wendung; es heißt a bit of a stretch. || a bit of the stretch is not the fixed phrase; it is a bit of a stretch.',
      an: 'an steht vor Vokalen; stretch beginnt mit s. || an goes before vowel sounds; stretch begins with s.',
      one: 'a bit of one stretch gibt es nicht. || a bit of one stretch does not exist.',
    },
    ok: 'Weiche Kritik: could be a bit of a stretch klingt freundlicher als „is impossible“. || Soft objection: could be a bit of a stretch sounds friendlier than “is impossible”.',
  },
];
