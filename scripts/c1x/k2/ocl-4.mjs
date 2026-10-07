// P21 Charge ocl-4: Kleines Wort, Kapitel 3 (mixed-cond) und Ergänzungen zu den Kapiteln 1–2. Felder wie ocl-1.
export const meta = { file: 'k2-4' };
export const items = [
  // ---- mixed-cond ----
  {
    p: 'mc.past-cond', lv: 'C1', dom: 'biz', cls: 'aux', a: ['would', 'might', 'could'],
    t: 'If we had invested in cloud storage two years ago, we ___ not have this capacity problem now.',
    c: {
      will: 'will steht nicht in dieser unwirklichen Aussage über heute. || will does not fit this unreal statement about today.',
      had: 'had not have gibt es nicht; im Hauptsatz steht would not have. || had not have does not exist; the main clause takes would not have.',
      did: 'did not have beschreibt keine unwirkliche Folge. || did not have does not describe an unreal result.',
    },
    ok: 'Vergangene Ursache, heutige Folge: if + Past Perfect, would + Grundform. || A past cause with a result today: if + past perfect, would + base form.',
  },
  {
    p: 'mc.present-cond', lv: 'C1', dom: 'life', cls: 'aux', a: ['would', 'might', 'could'],
    t: 'If I were better at math, I ___ have chosen a different career years ago, and I would earn more now.',
    c: {
      will: 'will have passt nicht zu einer unwirklichen Bedingung. || will have does not fit an unreal condition.',
      had: 'had have gibt es nicht; im Hauptsatz steht would have + Partizip. || had have does not exist; the main clause takes would have + participle.',
      did: 'did have drückt keine unwirkliche Folge aus. || did have does not express an unreal result.',
    },
    ok: 'Heutiger Zustand, frühere Folge: if + Past Simple, would have + Partizip. || A present state with an earlier result: if + past simple, would have + participle.',
  },
  {
    p: 'mc.wish-now', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['had'],
    t: 'I wish we ___ more storage space; the current server is full again, and it is only the middle of the month.',
    c: {
      have: 'wish + have gibt es nicht; für Wünsche über heute braucht wish die Vergangenheit. || wish + have does not exist; wishes about now need wish + past.',
      has: 'wish we has ist falsch. || wish we has is wrong.',
      would: 'wish + would drückt Ärger über Verhalten aus, nicht den Wunsch nach Besitz. || wish + would expresses annoyance at behavior, not a wish to own something.',
    },
    ok: 'Wunsch über die Gegenwart: wish + Past Simple (had). || A wish about the present: wish + past simple (had).',
  },
  {
    p: 'mc.wish-now', lv: 'B2', dom: 'life', cls: 'aux', a: ['were', 'was'],
    t: 'I wish it ___ already Friday; this week has been exhausting, and I have another long meeting tomorrow.',
    c: {
      is: 'wish + is gibt es nicht; wish braucht die Vergangenheit. || wish + is does not exist; wish needs the past.',
      be: 'wish + be gibt es nicht. || wish + be does not exist.',
      would: 'wish + would passt nicht zu einem Zustand wie „es ist Freitag“. || wish + would does not fit a state like “it is Friday”.',
    },
    ok: 'Wunsch über jetzt: wish + Vergangenheit (it were/was Friday). || A wish about now: wish + past (it were/was Friday).',
  },
  {
    p: 'mc.wish-past', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['had'],
    t: 'I wish I ___ asked for a written confirmation before sending the goods, because now the customer denies everything.',
    c: {
      have: 'wish + have asked gibt es nicht; für Bedauern über früher braucht wish had + Partizip. || wish + have asked does not exist; regret about the past needs wish + had + participle.',
      would: 'wish + would asked gibt es nicht. || wish + would asked does not exist.',
      did: 'wish + did asked ist falsch. || wish + did asked is wrong.',
    },
    ok: 'Bedauern über die Vergangenheit: wish + Past Perfect (had asked). || Regret about the past: wish + past perfect (had asked).',
  },
  {
    p: 'mc.wish-past', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['had'],
    t: 'She wishes she ___ not signed the contract without reading the small print, but now it is too late.',
    c: {
      has: 'wishes she has not signed gibt es nicht; es braucht had not signed. || wishes she has not signed does not exist; it needs had not signed.',
      would: 'wishes she would not signed gibt es nicht. || wishes she would not signed does not exist.',
      did: 'wishes she did not signed ist falsch. || wishes she did not signed is wrong.',
    },
    ok: 'Bedauern: wish + had (not) + Partizip. || Regret: wish + had (not) + participle.',
  },
  {
    p: 'mc.wish-would', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['would'],
    t: 'I wish the client ___ stop changing the requirements every other day; we can never finish anything.',
    c: {
      will: 'wish + will gibt es nicht; für Ärger über Verhalten steht wish + would. || wish + will does not exist; annoyance at behavior takes wish + would.',
      had: 'wish + had stop gibt es nicht; had braucht ein Partizip (stopped). || wish + had stop does not exist; had needs a participle (stopped).',
      did: 'wish + did stop ist falsch. || wish + did stop is wrong.',
    },
    ok: 'Ärger über wiederholtes Verhalten anderer: wish + would + Grundform. || Annoyance at other people\'s repeated behavior: wish + would + base form.',
  },
  {
    p: 'mc.wish-would', lv: 'B2', dom: 'life', cls: 'aux', a: ['would'],
    t: 'I wish you ___ not leave your coffee cups all over the meeting room; it looks terrible every afternoon.',
    c: {
      will: 'wish you will not leave ist falsch; hier steht wish + would. || wish you will not leave is wrong; here it is wish + would.',
      did: 'wish you did not leave wäre Wunsch über einen Zustand, nicht über künftiges Verhalten. || wish you did not leave would be a wish about a state, not about future behavior.',
      had: 'wish you had not leave ist falsch. || wish you had not leave is wrong.',
    },
    ok: 'Ärger über Gewohnheiten: wish + would (not) + Grundform. || Annoyance at habits: wish + would (not) + base form.',
  },
  {
    p: 'mc.inversion', lv: 'C1', dom: 'biz', cls: 'aux', a: ['had'],
    t: '___ I known about the delay, I would have informed the client immediately instead of letting him find out.',
    c: {
      have: 'Have I known gibt es hier nicht; die Umstellung der dritten Bedingung beginnt mit Had. || Have I known does not fit; the inverted third conditional starts with Had.',
      did: 'Did I known ist falsch. || Did I known is wrong.',
      would: 'Would I known ist falsch. || Would I known is wrong.',
    },
    ok: 'Förmlich ohne if: Had + Subjekt + Partizip, would have … || Formal without if: Had + subject + participle, would have …',
  },
  {
    p: 'mc.inversion', lv: 'C1', dom: 'biz', cls: 'aux', a: ['were'],
    t: '___ I in your position, I would not accept the offer without negotiating the payment terms first.',
    c: {
      was: 'Was I in your position gibt es in dieser förmlichen Umstellung nicht. || Was I in your position does not exist in this formal inversion.',
      am: 'Am I in your position wäre eine Frage. || Am I in your position would be a question.',
      be: 'Be I in your position ist veraltet. || Be I in your position is archaic.',
    },
    ok: 'Förmlich ohne if: Were + Subjekt …, would … (= If I were in your position). || Formal without if: Were + subject …, would … (= If I were in your position).',
  },
  // ---- Ergänzungen Kapitel 1–2 ----
  {
    p: 'pc.state-verbs', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['have'],
    t: 'How long ___ you known the client, and did you ever work with his predecessor?',
    c: {
      are: 'How long are you known wäre Passiv und falsch gebaut. || How long are you known would be a badly built passive.',
      did: 'How long did you known ist falsch; nach did steht die Grundform. || How long did you known is wrong; after did comes the base form.',
      do: 'How long do you known ist falsch. || How long do you known is wrong.',
    },
    ok: 'know ist ein Zustandsverb: have known (nie have been knowing). || know is a state verb: have known (never have been knowing).',
  },
  {
    p: 'pc.state-verbs', lv: 'B2', dom: 'life', cls: 'aux', a: ['have'],
    t: 'I ___ known my neighbor since university, so I trust his judgment about anything related to property.',
    c: {
      am: 'I am known bedeutet „ich bin bekannt“ und ist Passiv. || I am known means “I am famous” and is passive.',
      was: 'I was known wäre Passiv in der Vergangenheit. || I was known would be passive in the past.',
      had: 'had known passt zu einer früheren Zeit, hier gilt es bis heute. || had known fits an earlier time, but this reaches up to now.',
    },
    ok: 'Zustand bis jetzt mit since: have known (Present Perfect, keine -ing-Form). || A state up to now with since: have known (present perfect, no -ing form).',
  },
  {
    p: 'pc.cont-simple', lv: 'B2+', dom: 'biz', cls: 'det', a: ['many'],
    t: 'How ___ emails have you written since this morning, and have you replied to the customers?',
    c: {
      much: 'much steht bei nicht zählbaren Dingen; emails sind zählbar. || much goes with uncountable things; emails are countable.',
      long: 'How long fragt nach der Dauer, nicht nach der Zahl. || How long asks about duration, not about number.',
      often: 'How often fragt nach der Häufigkeit. || How often asks about frequency.',
    },
    ok: 'Zahl als Ergebnis fragt man mit How many + have written (einfache Form). || A number as the result is asked with How many + have written (simple form).',
  },
  {
    p: 'pc.cont-simple', lv: 'B2', dom: 'biz', cls: 'adv', a: ['long'],
    t: 'How ___ have you been waiting for the technician, and did anyone give you an estimated time?',
    c: {
      many: 'How many fragt nach einer Zahl; hier geht es um die Dauer. || How many asks for a number; this is about duration.',
      much: 'How much fragt nach einer Menge. || How much asks for an amount.',
      often: 'How often fragt nach der Häufigkeit, nicht nach der Dauer. || How often asks about frequency, not duration.',
    },
    ok: 'Dauer bis jetzt: How long + have you been + -ing. || Duration up to now: How long + have you been + -ing.',
  },
  {
    p: 'psc.state', lv: 'B2', dom: 'biz', cls: 'aux', a: ['does'],
    t: 'She ___ not belong to the sales team anymore; she moved to the finance department last month.',
    c: {
      do: 'do passt zu I, you, we, they; she verlangt does. || do goes with I, you, we, they; she needs does.',
      is: 'is not belong ist keine Form. || is not belong is not a form.',
      has: 'has not belong ist keine Form; belong braucht die Grundform. || has not belong is not a form; belong needs the base form.',
    },
    ok: 'belong ist ein Zustandsverb: Present Simple, Verneinung does not belong. || belong is a state verb: present simple, negative does not belong.',
  },
  {
    p: 'psc.dual', lv: 'B2', dom: 'biz', cls: 'aux', a: ['are'],
    t: 'We ___ thinking about moving the whole archive to a new data center next year, but nothing is decided yet.',
    c: {
      do: 'do thinking gibt es nicht; vor -ing steht eine Form von be. || do thinking does not exist; -ing needs a form of be.',
      have: 'have thinking ist keine Form. || have thinking is not a form.',
      will: 'will thinking ist keine Form; will braucht die Grundform. || will thinking is not a form; will needs the base form.',
    },
    ok: 'think im Sinn von „überlegen“ ist eine Handlung: are thinking. || think meaning “consider” is an action: are thinking.',
  },
  {
    p: 'ff.fixed-times', lv: 'B2', dom: 'biz', cls: 'prep', a: ['on'],
    t: 'The conference starts ___ Tuesday at nine and ends on Friday afternoon, so we should book the hotel soon.',
    c: {
      in: 'in steht vor Monaten und Jahren, nicht vor Wochentagen. || in goes before months and years, not weekdays.',
      at: 'at steht vor Uhrzeiten und Punkten wie at night. || at goes before clock times and points like at night.',
      by: 'by heißt „spätestens“, die Konferenz beginnt aber genau an diesem Tag. || by means “no later than”, but the conference begins on that day.',
    },
    ok: 'Wochentage mit on: starts on Tuesday (Fahrplan im Present Simple). || Weekdays take on: starts on Tuesday (a timetable in the present simple).',
  },
  {
    p: 'ff.no-will-after', lv: 'B2', dom: 'biz', cls: 'adv', a: ['as'],
    t: 'I will call you as soon ___ I land in Frankfurt, so please keep your phone nearby this evening.',
    c: {
      so: 'as soon so gibt es nicht; die Wendung heißt as soon as. || as soon so does not exist; the phrase is as soon as.',
      at: 'as soon at gibt es nicht. || as soon at does not exist.',
      how: 'as soon how gibt es nicht. || as soon how does not exist.',
    },
    ok: 'as soon as + Gegenwart (I land), im Hauptsatz will. || as soon as + present (I land), will in the main clause.',
  },
  {
    p: 'ff.will-now', lv: 'B2', dom: 'biz', cls: 'aux', a: ['shall', 'should'],
    t: '___ I send you the updated figures right now, or would you prefer to have them tomorrow morning?',
    c: {
      will: 'Will I send you klingt wie eine Frage nach der Zukunft, nicht wie ein Angebot. || Will I send you sounds like a question about the future, not like an offer.',
      do: 'Do I send you fragt eher nach einer Regel als nach einem Angebot. || Do I send you asks about a rule more than it offers help.',
      am: 'Am I send you ist keine Form. || Am I send you is not a form.',
    },
    ok: 'Angebot und Vorschlag: Shall I … ? oder Should I … ? || An offer or suggestion: Shall I … ? or Should I … ?',
  },
  {
    p: 'ff.going-to', lv: 'B2', dom: 'life', cls: 'aux', a: ['is'],
    t: 'Look at the sky: it ___ going to rain, so let us take the car instead of walking to the station.',
    c: {
      will: 'will + going to kann man nicht verbinden. || will and going to cannot be combined.',
      does: 'does going to gibt es nicht. || does going to does not exist.',
      has: 'has going to ist falsch; die Form lautet be going to. || has going to is wrong; the form is be going to.',
    },
    ok: 'Vorhersage mit sichtbarem Zeichen: is going to + Grundform. || A prediction based on what you can see: is going to + base form.',
  },
  {
    p: 'ff.was-going-to', lv: 'B2', dom: 'biz', cls: 'aux', a: ['were'],
    t: 'We ___ going to launch the new product in May, but the supplier delayed everything by six weeks.',
    c: {
      are: 'are going to ist Gegenwart; der Plan ist aber geplatzt (delayed). || are going to is present, but the plan has fallen through (delayed).',
      was: 'was passt zu I, he, she, it; zu we gehört were. || was goes with I, he, she, it; we needs were.',
      will: 'will launch ist Zukunft; gemeint ist ein Plan in der Vergangenheit. || will launch is future; a plan in the past is meant.',
    },
    ok: 'Geplatzter Plan: was/were going to + Grundform; zu we gehört were. || A plan that fell through: was/were going to + base form; we goes with were.',
  },
  {
    p: 'ut.would', lv: 'B2+', dom: 'life', cls: 'aux', a: ['would'],
    t: 'When I was a student, I ___ spend hours in the library every evening and read until it closed.',
    c: {
      used: 'used spend gibt es nicht; es heißt used to spend. || used spend does not exist; it is used to spend.',
      did: 'did spend wäre betont und einmalig, nicht „jeden Abend“. || did spend would be emphatic and one-off, not “every evening”.',
      was: 'was spend gibt es nicht. || was spend does not exist.',
    },
    ok: 'Wiederholte Handlungen in der Vergangenheit: would + Grundform. || Repeated actions in the past: would + base form.',
  },
  {
    p: 'ut.used-to', lv: 'B2', dom: 'life', cls: 'aux', a: ['used'],
    t: 'There ___ to be a small café on this corner, but it closed last year and now it is a phone shop.',
    c: {
      use: 'there use to gibt es in der Aussage nicht; es heißt used to. || there use to does not exist in a statement; it is used to.',
      would: 'would gilt nicht für Zustände wie „es gab ein Café“; hier steht used to. || would does not work for states like “there was a café”; here used to is needed.',
      did: 'there did to be gibt es nicht. || there did to be does not exist.',
    },
    ok: 'Zustand in der Vergangenheit, der nicht mehr gilt: used to + Grundform (nicht would). || A past state that no longer holds: used to + base form (not would).',
  },
  {
    p: 'dip.wondering', lv: 'B2+', dom: 'biz', cls: 'conj', a: ['if', 'whether'],
    t: 'I was wondering ___ it would be possible to reschedule our call to Thursday, because of a customer visit.',
    c: {
      that: 'wondering that passt nicht vor einer Frage nach Möglichkeit. || wondering that does not fit before a question about possibility.',
      when: 'wondering when fragt nach der Zeit; hier geht es um ja oder nein. || wondering when asks about time; this is a yes/no question.',
      what: 'wondering what braucht eine offene Frage mit einem Fragewort als Teil. || wondering what needs an open question with a question word as part.',
    },
    ok: 'Weiche Bitte: I was wondering if/whether + Satz. || A soft request: I was wondering if/whether + clause.',
  },
  {
    p: 'cn.were', lv: 'B2', dom: 'biz', cls: 'aux', a: ['were', 'was'],
    t: 'If it ___ up to me, I would choose the cheaper option, but the board makes the final decision.',
    c: {
      is: 'if it is up to me wäre eine reale Möglichkeit; zu would passt die unwirkliche Form. || if it is up to me would be a real possibility; with would the unreal form fits.',
      be: 'if it be up to me ist veraltet. || if it be up to me is archaic.',
      would: 'would steht im Hauptsatz, nicht im if-Satz. || would belongs in the main clause, not the if-clause.',
    },
    ok: 'Unwirkliche Annahme: if + were/was …, would + Grundform. || An unreal assumption: if + were/was …, would + base form.',
  },
  {
    p: 'cn.third', lv: 'B2', dom: 'biz', cls: 'aux', a: ['had'],
    t: 'I would have called you earlier if I ___ known that the meeting had been cancelled until this morning.',
    c: {
      have: 'if I have known passt nicht zu would have; hier braucht der if-Satz had known. || if I have known does not fit would have; the if-clause needs had known.',
      would: 'would steht im Hauptsatz, nicht nach if. || would belongs in the main clause, not after if.',
      did: 'if I did known ist falsch. || if I did known is wrong.',
    },
    ok: 'Dritte Bedingung: if + Past Perfect (had known), would have + Partizip. || Third conditional: if + past perfect (had known), would have + participle.',
  },
];
