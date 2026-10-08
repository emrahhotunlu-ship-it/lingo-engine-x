// P43 Prüfungsvorrat Kapitel 1, Teil a: pres-simple-cont, past-simple-perfect, pres-perf-cont. Je Thema 8 Aufgaben in der Reihenfolge
// ocl · kwt · err · ocl · kwt · err · ocl · kwt. Formate: siehe scripts/c1x/build-gate1.mjs.
export const items = [
  // ================= pres-simple-cont =================
  {
    k: 'ocl', p: 'psc.habit', lv: 'B2', dom: 'biz', cls: 'aux', a: ['does'],
    t: 'Why ___ our support team usually answer tickets faster on Tuesdays than on Fridays?',
    c: {
      is: 'is braucht -ing (answering), hier steht aber die Grundform answer. || is needs -ing (answering), but the sentence has the base form answer.',
      did: 'did meint die Vergangenheit, usually zeigt aber eine Gewohnheit. || did means the past, but usually points to a habit.',
      will: 'will meint die Zukunft, usually beschreibt aber eine Gewohnheit. || will means the future, but usually describes a habit.',
    },
    ok: 'Gewohnheit in der Frage: does + Grundform. Zu team (Singular) passt does. || A habit in a question takes does + base form. The singular team goes with does.',
  },
  {
    k: 'kwt', p: 'psc.now', lv: 'B2', dom: 'biz',
    lead: 'At the moment our IT department is replacing all the old laptops.', key: 'CURRENTLY',
    before: 'Our IT department', after: 'all the old laptops.', a: ['is currently'], b: ['replacing'], v: [{ a: ['is'], b: ['currently replacing'] }], x: ['replaced', 'does', 'has'],
    traps: [['is currently replace', 'Nach is steht die -ing-Form: replacing. Die Grundform replace passt nicht.', 'After is comes the -ing form: replacing. The base form replace does not fit.']],
    ok: ['Teil 1: is currently, denn die Lage gilt gerade jetzt. Teil 2: replacing, die -ing-Form zeigt, dass es im Moment läuft.', 'Part 1: is currently, because the situation applies right now. Part 2: replacing, the -ing form shows it is in progress at the moment.'],
  },
  {
    k: 'err', p: 'psc.dual', lv: 'B2', dom: 'biz',
    text: 'I think the new pricing model is too complicated for most of our small customers, so we should simplify it.',
    bad: null,
    ok: ['Kein Fehler: think im Sinn von „meinen“ ist ein Zustandsverb und steht ohne -ing. Mit -ing hieße es „nachdenken“.', 'No mistake: think meaning “to hold an opinion” is a state verb and takes no -ing. With -ing it would mean “to consider”.'],
    fa: [['think', 'Bei „meinen“ braucht think keine -ing-Form. I am thinking wäre hier falsch.', 'Meaning “to hold an opinion”, think needs no -ing form. I am thinking would be wrong here.']],
  },
  {
    k: 'ocl', p: 'psc.always', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['is'],
    t: 'Our new colleague ___ always forgetting to attach the files, and I have to remind him every single time.',
    c: {
      has: 'has + forgetting gibt es nicht; has braucht das Partizip forgotten. || has + forgetting does not exist; has needs the participle forgotten.',
      does: 'does braucht die Grundform, hier steht aber forgetting. || does needs the base form, but forgetting follows here.',
      was: 'was ist Vergangenheit, der Satz meint aber die Gegenwart. || was is past, but the sentence is about the present.',
    },
    ok: 'always + -ing drückt Ärger über Wiederholung aus: is always forgetting. is steht vor always. || always + -ing expresses annoyance at repetition: is always forgetting. is comes before always.',
  },
  {
    k: 'kwt', p: 'psc.habit', lv: 'B2', dom: 'biz',
    lead: 'It is very unusual for our CEO to work from home on Fridays.', key: 'HARDLY',
    before: 'Our CEO', after: 'from home on Fridays.', a: ['hardly ever'], b: ['works'], x: ['often', 'is', 'seldom'],
    traps: [['hardly ever work', 'Bei he/she/it braucht das Present Simple ein -s: works.', 'With he/she/it the present simple needs an -s: works.'], ['is hardly ever working', 'Eine Gewohnheit steht im Present Simple, nicht in der -ing-Form.', 'A habit takes the present simple, not the -ing form.']],
    ok: ['Teil 1: hardly ever steht vor dem Verb. Teil 2: works, mit -s bei he/she/it, denn es ist eine Gewohnheit.', 'Part 1: hardly ever goes before the verb. Part 2: works, with -s for he/she/it, because it is a habit.'],
  },
  {
    k: 'err', p: 'psc.state', lv: 'B2', dom: 'biz',
    text: 'We are needing the signed contract by Friday, otherwise the project cannot start on time.',
    bad: { span: 'are needing', fix: ['need'], ch: ['are need', 'needs'] },
    ok: ['need ist ein Zustandsverb und hat keine -ing-Form: We need … Deutsch „brauchen“ kennt keine Verlaufsform, Englisch auch hier nicht.', 'need is a state verb and has no -ing form: We need … Neither German nor English uses a continuous form here.'],
    c1: ['are braucht -ing oder ein Adjektiv; need ist die Grundform.', 'are needs -ing or an adjective; need is the base form.'],
    c2: ['needs passt zu he/she/it, nicht zu we.', 'needs goes with he/she/it, not with we.'],
  },
  {
    k: 'ocl', p: 'psc.state', lv: 'B2', dom: 'life', cls: 'aux', a: ['do'],
    t: 'I ___ not recognize this number; could you tell me who is calling, please?',
    c: {
      am: 'am not recognize gibt es nicht; recognize hat kein -ing. || am not recognize does not exist; recognize takes no -ing form.',
      have: 'have braucht ein Partizip (recognized), nicht die Grundform. || have needs a participle (recognized), not the base form.',
      is: 'is passt zu he/she/it, nicht zu I. || is goes with he/she/it, not with I.',
    },
    ok: 'recognize ist ein Zustandsverb: Present Simple mit do not, nie am recognizing. || recognize is a state verb: present simple with do not, never am recognizing.',
  },
  {
    k: 'kwt', p: 'psc.dual', lv: 'B2+', dom: 'life',
    lead: 'Few colleagues drink the new coffee in our kitchen because its flavor is rather bitter.', key: 'TASTES',
    before: 'Few colleagues drink the new coffee in our kitchen because it', after: '.', a: ['tastes'], b: ['rather bitter', 'quite bitter'], x: ['tasting', 'is', 'flavors'],
    traps: [['tastes rather bitterly', 'Nach tastes steht ein Adjektiv, kein Adverb: bitter, nicht bitterly.', 'After tastes comes an adjective, not an adverb: bitter, not bitterly.']],
    ok: ['Teil 1: tastes, denn „schmecken“ ist hier ein Zustandsverb ohne -ing. Teil 2: ein Adjektiv (rather bitter) beschreibt den Geschmack.', 'Part 1: tastes, because “to taste” is a state verb here, without -ing. Part 2: an adjective (rather bitter) describes the flavor.'],
  },

  // ================= past-simple-perfect =================
  {
    k: 'ocl', p: 'psp.finished-time', lv: 'B2', dom: 'biz', cls: 'aux', a: ['did'],
    t: 'Our CFO ___ not attend the meeting in Munich last Thursday because her flight was canceled.',
    c: {
      has: 'has braucht das Partizip (attended); last Thursday ist ein abgeschlossener Zeitpunkt. || has needs the participle (attended); last Thursday is a finished point in time.',
      does: 'does steht in der Gegenwart; last Thursday liegt in der Vergangenheit. || does is present tense; last Thursday is in the past.',
      is: 'is not attend gibt es nicht; vor der Grundform steht did. || is not attend does not exist; the base form needs did.',
    },
    ok: 'Mit last Thursday steht das Past Simple: did not + Grundform. || With last Thursday the past simple is used: did not + base form.',
  },
  {
    k: 'kwt', p: 'psp.since-for', lv: 'B2', dom: 'biz',
    lead: 'Our company moved into this building at the start of 2020 and is still based here.', key: 'SINCE',
    before: 'Our company', after: 'the start of 2020.', a: ['has been'], b: ['based here since'], v: [{ a: ['has been'], b: ['located here since'] }], x: ['for', 'was', 'lives'],
    traps: [['was based here since', 'Das Past Simple endet in der Vergangenheit; „seit“ bis heute braucht has been.', 'The past simple ends in the past; “since” up to now needs has been.'], ['is based here since', 'Deutsch sagt „ist seit … hier“ im Präsens. Englisch braucht has been.', 'German uses the present for “ist seit … hier”. English needs has been.']],
    ok: ['Teil 1: has been, weil die Lage bis heute dauert. Teil 2: since nennt den Startpunkt (Beginn von 2020).', 'Part 1: has been, because the situation lasts until today. Part 2: since names the starting point (the start of 2020).'],
  },
  {
    k: 'err', p: 'psp.experience', lv: 'B2+', dom: 'biz',
    text: 'This is the best onboarding workshop that I never attended in my five years at this company.',
    bad: { span: 'never attended', fix: ['have ever attended'], ch: ['have never attended', 'did ever attended'] },
    ok: ['Nach einem Superlativ steht ever: „der Beste, den ich je besucht habe“ = have ever attended (Present Perfect, Erfahrung bis heute).', 'After a superlative comes ever: “the best I have ever attended” = have ever attended (present perfect, experience up to now).'],
    c1: ['Nach einem Superlativ steht ever, nicht never: „der Beste, den ich nie besuchte“ ergibt keinen Sinn.', 'After a superlative comes ever, not never: “the best I have never attended” makes no sense.'],
    c2: ['Nach did steht die Grundform: did … attend, nicht attended.', 'After did comes the base form: did … attend, not attended.'],
  },
  {
    k: 'ocl', p: 'psp.result-now', lv: 'B2', dom: 'biz', cls: 'aux', a: ['have'],
    t: 'I ___ not received the signed contract yet, so I cannot start the project plan.',
    c: {
      am: 'am not received gibt es nicht; vor dem Partizip received steht have. || am not received does not exist; the participle received needs have.',
      was: 'was not received wäre Passiv („wurde nicht empfangen“) und passt nicht zu I. || was not received would be passive and does not fit I.',
      will: 'will braucht die Grundform (receive), nicht received. || will needs the base form (receive), not received.',
    },
    ok: 'yet verlangt das Present Perfect: have not received. Das Ergebnis gilt jetzt noch. || yet calls for the present perfect: have not received. The result still applies now.',
  },
  {
    k: 'kwt', p: 'psp.finished-time', lv: 'B2', dom: 'biz',
    lead: 'At what exact time did the failure of the system happen?', key: 'WHEN',
    before: '', after: 'exactly?', a: ['when did'], b: ['the system fail'], x: ['has', 'failed', 'does'],
    traps: [['when has the system failed', 'Mit when fragst du nach einem Zeitpunkt, deshalb steht das Past Simple: did … fail.', 'With when you ask for a point in time, so the past simple is used: did … fail.']],
    ok: ['Teil 1: when did, denn when nennt einen abgeschlossenen Zeitpunkt. Teil 2: the system fail, nach did steht die Grundform.', 'Part 1: when did, because when names a finished point in time. Part 2: the system fail, the base form follows did.'],
  },
  {
    k: 'err', p: 'psp.since-for', lv: 'B2', dom: 'biz',
    text: 'We are partners with the Hamburg team since 2019 and have never had a serious conflict.',
    bad: { span: 'are partners', fix: ['have been partners'], ch: ['were partners', 'are being partners'] },
    ok: ['since 2019 meint „bis heute“: Das braucht das Present Perfect, also have been partners. Deutsch nutzt hier das Präsens.', 'since 2019 means “up to today”: that needs the present perfect, so have been partners. German uses the present here.'],
    c1: ['were passt zu einem Ende in der Vergangenheit; since 2019 reicht aber bis heute.', 'were fits an end in the past, but since 2019 reaches up to today.'],
    c2: ['are being partners ist keine übliche Form; Zustände mit since stehen im Present Perfect.', 'are being partners is not a normal form; states with since use the present perfect.'],
  },
  {
    k: 'ocl', p: 'psp.since-for', lv: 'B2', dom: 'biz', cls: 'prep', a: ['for'],
    t: 'We have been using this document management system ___ more than six years without any major problem.',
    c: {
      since: 'since nennt einen Startpunkt (since 2019), nicht eine Dauer wie six years. || since names a starting point (since 2019), not a length like six years.',
      during: 'during steht vor einer Phase (during the project), nicht vor einer Dauer. || during goes before a phase (during the project), not before a length of time.',
      from: 'from braucht ein Gegenstück (from … to …); hier fehlt der Anfangspunkt. || from needs a counterpart (from … to …); there is no starting point here.',
    },
    ok: 'for + Zeitspanne (six years) beantwortet „wie lange“. Dazu passt have been using. || for + a length of time (six years) answers “how long”. have been using fits it.',
  },
  {
    k: 'kwt', p: 'psp.since-for', lv: 'B2', dom: 'biz',
    lead: 'Nobody has complained about the new release up to now.', key: 'FAR',
    before: 'There', after: 'about the new release.', a: ['have been'], b: ['no complaints so far', 'no complaints thus far'], x: ['had', 'any', 'yet'],
    traps: [['were no complaints so far', 'so far verlangt das Present Perfect: have been, nicht were.', 'so far calls for the present perfect: have been, not were.']],
    ok: ['Teil 1: have been, denn so far blickt bis jetzt. Teil 2: no complaints so far, so far = bis jetzt.', 'Part 1: have been, because so far looks up to now. Part 2: no complaints so far, so far = up to now.'],
  },

  // ================= pres-perf-cont =================
  {
    k: 'ocl', p: 'pc.duration', lv: 'B2', dom: 'biz', cls: 'aux', a: ['have'],
    t: 'Our engineers ___ been working on the migration script since early April, and it is still not stable.',
    c: {
      are: 'are been gibt es nicht; vor been steht have. || are been does not exist; been needs have.',
      did: 'did braucht die Grundform (work), nicht been working. || did needs the base form (work), not been working.',
      were: 'were been ist falsch; die Dauer bis jetzt braucht have been. || were been is wrong; duration up to now needs have been.',
    },
    ok: 'Eine Tätigkeit seit April bis heute: have been working (Present Perfect Continuous). || An activity from April up to today: have been working (present perfect continuous).',
  },
  {
    k: 'kwt', p: 'pc.since-for', lv: 'B2', dom: 'biz',
    lead: 'The client contacted us twenty minutes ago, and we are still on the line.', key: 'FOR',
    before: 'We', after: 'twenty minutes with the client.', a: ['have been talking'], b: ['for'], x: ['since', 'talked', 'are'],
    traps: [['are talking for', 'Deutsch sagt „wir sprechen seit 20 Minuten“ im Präsens. Englisch braucht have been talking.', 'German says “wir sprechen seit 20 Minuten” in the present. English needs have been talking.']],
    ok: ['Teil 1: have been talking, die Tätigkeit läuft noch. Teil 2: for + Dauer (twenty minutes).', 'Part 1: have been talking, the activity is still going on. Part 2: for + length of time (twenty minutes).'],
  },
  {
    k: 'err', p: 'pc.form', lv: 'B2', dom: 'biz',
    text: 'The auditors have been reviewing our travel expense reports for most of the afternoon now.',
    bad: null,
    ok: ['Kein Fehler: have been + -ing (reviewing) beschreibt eine Tätigkeit, die bis jetzt dauert.', 'No mistake: have been + -ing (reviewing) describes an activity that has lasted until now.'],
    fa: [['reviewing', 'Nach have been steht die -ing-Form. reviewing ist genau richtig.', 'After have been comes the -ing form. reviewing is exactly right.']],
  },
  {
    k: 'ocl', p: 'pc.recent', lv: 'B2+', dom: 'life', cls: 'aux', a: ['have'],
    t: 'You look exhausted: ___ you been sleeping badly lately, or is the new project too much?',
    c: {
      did: 'did braucht die Grundform (sleep); mit been sleeping muss have stehen. || did needs the base form (sleep); been sleeping needs have.',
      are: 'are you been gibt es nicht; vor been steht have. || are you been does not exist; been needs have.',
      do: 'do braucht die Grundform; been sleeping verlangt have. || do needs the base form; been sleeping calls for have.',
    },
    ok: 'lately blickt auf eine Spur in der Gegenwart: have you been sleeping. Die Frage fragt nach der letzten Zeit. || lately looks at a trace in the present: have you been sleeping. The question is about recent weeks.',
  },
  {
    k: 'kwt', p: 'pc.state-verbs', lv: 'B2+', dom: 'biz',
    lead: 'I met Dana in 2018, and I still know her.', key: 'SINCE',
    before: 'I', after: '2018.', a: ['have known'], b: ['Dana since'], x: ['been', 'knowing', 'for'],
    traps: [['know Dana since', 'Deutsch sagt „ich kenne sie seit …“ im Präsens. Englisch braucht have known.', 'German says “ich kenne sie seit …” in the present. English needs have known.'], ['have been knowing Dana since', 'know ist ein Zustandsverb und hat keine -ing-Form: have known.', 'know is a state verb and has no -ing form: have known.']],
    ok: ['Teil 1: have known, ein Zustandsverb steht im einfachen Present Perfect. Teil 2: Dana since, since nennt den Startpunkt.', 'Part 1: have known, a state verb uses the simple present perfect. Part 2: Dana since, since names the starting point.'],
  },
  {
    k: 'err', p: 'pc.since-for', lv: 'B2', dom: 'biz',
    text: 'The vendor has been promising a fix since three weeks, but nothing has changed so far.',
    bad: { span: 'since three weeks', fix: ['for three weeks'], ch: ['from three weeks', 'during three weeks'] },
    ok: ['for nennt eine Dauer (three weeks), since einen Startpunkt (since March). Deutsch „seit“ deckt beides ab.', 'for names a length (three weeks), since a starting point (since March). German “seit” covers both.'],
    c1: ['from braucht ein Gegenstück (from … to …) und passt nicht zu has been promising.', 'from needs a counterpart (from … to …) and does not fit has been promising.'],
    c2: ['during steht vor einer Phase (during the call), nicht vor einer Dauer.', 'during goes before a phase (during the call), not before a length of time.'],
  },
  {
    k: 'ocl', p: 'pc.cont-simple', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['has'],
    t: 'Our new colleague ___ written three reports since Monday, which is more than the whole team managed last week.',
    c: {
      is: 'is written ist Passiv; hier schreibt die Kollegin selbst. || is written is passive, but the colleague does the writing herself.',
      did: 'did braucht die Grundform (write), nicht written. || did needs the base form (write), not written.',
      was: 'was written wäre Passiv in der Vergangenheit; since Monday verlangt das Present Perfect. || was written would be a past passive; since Monday calls for the present perfect.',
    },
    ok: 'Ein Ergebnis zählt (three reports): einfaches Present Perfect, has written. Die -ing-Form betont die Tätigkeit. || A result is counted (three reports): simple present perfect, has written. The -ing form stresses the activity.',
  },
  {
    k: 'kwt', p: 'pc.duration', lv: 'B2+', dom: 'biz',
    lead: 'Dana started negotiating the contract in May and is still negotiating it.', key: 'BEEN',
    before: 'Dana', after: 'the contract since May.', a: ['has been'], b: ['negotiating'], x: ['negotiated', 'is', 'does'],
    traps: [['has been negotiated', 'Mit -ed wäre es Passiv („wurde verhandelt“). Dana verhandelt selbst, also -ing.', 'With -ed it would be passive (“was negotiated”). Dana negotiates herself, so -ing.']],
    ok: ['Teil 1: has been, weil es seit Mai bis jetzt läuft. Teil 2: negotiating, die -ing-Form zeigt die laufende Tätigkeit.', 'Part 1: has been, because it has run from May until now. Part 2: negotiating, the -ing form shows the ongoing activity.'],
  },
];
