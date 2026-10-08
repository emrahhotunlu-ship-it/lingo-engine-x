// P41 C1-Check Form A: 26 eigene Aufgaben (7 mcc · 7 ocl · 7 wf · 5 kwt), dazu kommen die 4 Anker (anchor.mjs) = 30 Aufgaben, 36 Punkte.
// Grammatik deckt alle sieben Kapitel ab. Quellformate: siehe scripts/c1x/build-check.mjs.
export const meta = { file: 'a', form: 'A' };
const W = (w, cat, text) => [w, cat, text];
export const items = [
  // ================= mcc =================
  {
    k: 'mcc', p: 'pc.duration', lv: 'B2', dom: 'biz',
    t: 'Our team ___ on the migration project since the beginning of March, and we expect to finish in June.',
    o: [['has been working'],
      W('is working', 'calque', 'Deutsch „arbeitet seit März“ steht im Präsens; Englisch braucht für „seit“ has been + -ing. || German uses the present with “seit”; English needs has been + -ing with since.'),
      W('works', 'grammar', 'Mit since und einer Dauer bis jetzt steht kein Present Simple. || since with a duration up to now does not take the present simple.'),
      W('worked', 'grammar', 'worked ist abgeschlossen; die Arbeit läuft aber noch (we expect to finish). || worked is finished, but the work is still going on (we expect to finish).')],
    ok: 'Eine Tätigkeit läuft seit einem Zeitpunkt bis jetzt und geht weiter: has been + -ing (has been working since March). || An activity that started in the past and is still going on: has been + -ing (has been working since March).',
  },
  {
    k: 'mcc', p: 'ff.was-going-to', lv: 'B2', dom: 'biz',
    t: 'I ___ call you yesterday afternoon, but the client meeting ran over and I completely forgot.',
    o: [['was going to'],
      W('am going to', 'grammar', 'am going to plant die Zukunft; yesterday zeigt einen früheren Plan. || am going to plans the future; yesterday shows an earlier plan.'),
      W('will', 'grammar', 'will passt nicht zu yesterday; gemeint ist ein Plan, der nicht geklappt hat. || will does not fit yesterday; the sentence means a plan that did not work out.'),
      W('have been going to', 'grammar', 'have been going to ist keine übliche Form für einen früheren Plan. || have been going to is not a normal form for an earlier plan.')],
    ok: 'Ein früherer Plan, der nicht geklappt hat: was/were going to + Grundform (I was going to call you, but …). || An earlier plan that did not work out: was/were going to + base form (I was going to call you, but …).',
  },
  {
    k: 'mcc', p: 'md.cant-have', lv: 'B2+', dom: 'biz',
    t: 'Tom ___ the whole contract yet: it only arrived five minutes ago and it is forty pages long.',
    o: [['cannot have read'],
      W("shouldn't have read", 'meaning', 'shouldn’t have read ist Kritik („hätte nicht lesen sollen“); gemeint ist „hat es sicher nicht gelesen“. || shouldn’t have read is criticism; the sentence means he surely did not read it.'),
      W('must have read', 'meaning', 'must have read heißt „hat es sicher gelesen“; der Satz zeigt das Gegenteil. || must have read means “has surely read it”; the sentence shows the opposite.'),
      W('would have read', 'grammar', 'would have read ist ein Konditional; hier geht es um eine Schlussfolgerung. || would have read is a conditional; this sentence is a deduction.')],
    ok: 'Sicher NICHT passiert (Schlussfolgerung über Vergangenes): can’t/cannot have + Partizip (US-Englisch auch must not have). Fünf Minuten für vierzig Seiten reichen nicht. || Surely did NOT happen (a deduction about the past): can’t/cannot have + participle (in US English also must not have). Five minutes are not enough for forty pages.',
  },
  {
    k: 'mcc', p: 'gi.meaning', lv: 'B2+', dom: 'life',
    t: 'I clearly remember ___ the spare key to our neighbor before we left, so she must still have it.',
    o: [['giving'],
      W('to give', 'meaning', 'remember to give heißt „daran denken, es zu tun“; hier geht es um die Erinnerung an etwas Getanes. || remember to give means “not forget to do it”; here it is the memory of something done.'),
      W('give', 'grammar', 'Nach remember steht keine Grundform ohne to. || remember is not followed by the bare base form.'),
      W('to giving', 'grammar', 'remember to giving gibt es nicht. || remember to giving does not exist.')],
    ok: 'remember + -ing = sich an etwas Getanes erinnern (I remember giving it to her). remember + to = daran denken, etwas zu tun. || remember + -ing = recall something you did (I remember giving it to her). remember + to = not forget to do something.',
  },
  {
    k: 'mcc', p: 'em.what-cleft', lv: 'C1', dom: 'biz',
    t: '___ we really need now is a clear decision from management, not another round of meetings.',
    o: [['What'],
      W('That', 'grammar', 'That kann keinen Satzteil „das, was“ einleiten. || That cannot start a clause meaning “the thing that”.'),
      W('Which', 'calque', 'Deutsch „Was wir brauchen“ verleitet zu Which; „das, was“ heißt im Englischen What. || German “Was wir brauchen” tempts you to use Which; “the thing that” is What in English.'),
      W('It', 'grammar', 'Mit It fehlt das that: richtig wäre „It is a clear decision that we need“. || It needs that: It is a clear decision that we need.')],
    ok: 'Betonung mit What-Satz: What we need is … (= Das, was wir brauchen, ist …). So rückst du das Wichtigste nach hinten ins Licht. || Emphasis with a what-clause: What we need is … (= the thing that we need is …). It puts the key point in focus at the end.',
  },
  {
    k: 'mcc', p: 'lx.conduct-survey', area: 'lex', lex: ['conduct a survey'], lv: 'B2+', dom: 'biz',
    t: 'Before we change the product, we want to ___ a short survey among our existing customers.',
    o: [['conduct'],
      W('make', 'calque', 'Deutsch „eine Umfrage machen“; im Englischen heißt es conduct (oder do/run) a survey. || German “eine Umfrage machen”; English says conduct (or do/run) a survey.'),
      W('lead', 'partner', 'lead passt zu a team oder a meeting, nicht zu a survey. || lead goes with a team or a meeting, not with a survey.'),
      W('hold', 'partner', 'hold passt zu a meeting oder an event, nicht zu a survey. || hold goes with a meeting or an event, not with a survey.')],
    ok: 'Feste Verbindung: conduct a survey = eine Umfrage durchführen (auch do/run a survey). || Fixed collocation: conduct a survey = carry out a survey (also do/run a survey).',
  },
  {
    k: 'mcc', p: 'lx.strike-balance', area: 'lex', lex: ['strike a balance'], lv: 'C1', dom: 'biz',
    t: 'With the new product line, we have tried to ___ a balance between speed and quality.',
    o: [['strike'],
      W('hit', 'partner', 'hit a balance sagt man nicht; die Verbindung heißt strike a balance. || People do not say hit a balance; the collocation is strike a balance.'),
      W('make', 'calque', 'Deutsch „eine Balance herstellen“ führt zu make; es heißt strike a balance. || German “eine Balance herstellen” leads to make; English says strike a balance.'),
      W('beat', 'partner', 'beat heißt „schlagen, besiegen“ und passt nicht zu balance. || beat means “defeat” and does not go with balance.')],
    ok: 'Feste Verbindung: strike a balance between A and B = ein Gleichgewicht zwischen A und B finden. || Fixed collocation: strike a balance between A and B = find the right mix of A and B.',
  },

  // ================= ocl =================
  {
    k: 'ocl', p: 'pp.earlier', lv: 'B2', dom: 'life', cls: 'aux', a: ['had'],
    t: 'By the time we finally got to the movie theater, the film ___ already started.',
    c: {
      has: 'has passt nicht zur Vergangenheit (got); vor einem früheren Zeitpunkt steht had. || has does not fit the past (got); before an earlier point in time use had.',
      is: 'is started gibt es so nicht; gemeint ist „hatte schon begonnen“. || is started does not work here; the sentence means “had already begun”.',
      did: 'did braucht die Grundform (start), nicht started. || did needs the base form (start), not started.',
    },
    ok: 'Vor einem Zeitpunkt in der Vergangenheit schon passiert: had + Partizip (the film had already started). || Already happened before a point in the past: had + participle (the film had already started).',
  },
  {
    k: 'ocl', p: 'tc.present-perfect', lv: 'B2+', dom: 'biz', cls: 'conj', a: ['as'],
    t: 'I will forward you the final figures as soon ___ the finance team has approved them.',
    c: {
      like: 'as soon like gibt es nicht; die feste Verbindung ist as soon as. || as soon like does not exist; the fixed phrase is as soon as.',
      than: 'than steht nach einem Vergleich (sooner than), nicht nach as soon. || than follows a comparative (sooner than), not as soon.',
      so: 'so soon so gibt es nicht; es heißt as soon as. || as soon so does not exist; it is as soon as.',
    },
    ok: 'as soon as = sobald. Danach steht kein will, sondern Gegenwart oder Present Perfect (has approved). || as soon as = the moment that. It is followed by the present or present perfect (has approved), not will.',
  },
  {
    k: 'ocl', p: 'ca.inversion', lv: 'C1', dom: 'biz', cls: 'aux', a: ['Should'],
    t: '___ the shipment arrive damaged, please send us photos within two working days.',
    c: {
      If: 'If braucht arrives: If the shipment arrives. Mit arrive steht Should davor. || If needs arrives: If the shipment arrives. With arrive, Should goes first.',
      Would: 'Would am Anfang macht eine Frage, keine Bedingung. || Would at the start makes a question, not a condition.',
      Does: 'Does am Anfang macht eine Frage; der Satz ist eine Bedingung. || Does at the start makes a question; the sentence is a condition.',
    },
    ok: 'Förmliche Bedingung ohne if: Should + Subjekt + Grundform (Should the shipment arrive damaged = falls die Lieferung beschädigt ankommt). || A formal condition without if: Should + subject + base form (Should the shipment arrive damaged = if it arrives damaged).',
  },
  {
    k: 'ocl', p: 'qu.if-whether', lv: 'B2', dom: 'life', cls: 'conj', a: ['if', 'whether'],
    t: 'My mother wanted to know ___ her new phone would work with the old charger.',
    c: {
      that: 'that leitet eine Aussage ein; hier ist eine Ja/Nein-Frage gemeint (ob). || that starts a statement; this is a yes/no question (ob).',
      what: 'what fragt nach einer Sache; hier ist eine Ja/Nein-Frage gemeint. || what asks about a thing; this is a yes/no question.',
      which: 'which fragt nach einer Auswahl; hier geht es um ja oder nein. || which asks about a choice; this is about yes or no.',
    },
    ok: 'Indirekte Ja/Nein-Frage: if oder whether (= ob). Danach normale Satzstellung: her new phone would work. || Indirect yes/no question: if or whether. Normal word order follows: her new phone would work.',
  },
  {
    k: 'ocl', p: 'hg.worth', lv: 'B2+', dom: 'biz', cls: 'adv', a: ['worth'],
    t: 'It might be ___ checking the old contract once more before we sign anything new.',
    c: {
      worthy: 'worthy braucht of (worthy of attention); vor -ing steht worth. || worthy needs of (worthy of attention); worth goes before -ing.',
      value: 'value ist ein Nomen oder Verb; „lohnt sich“ heißt worth + -ing. || value is a noun or verb; “it pays to” is worth + -ing.',
      wise: 'wise braucht to + Grundform (wise to check), nicht -ing. || wise needs to + base form (wise to check), not -ing.',
    },
    ok: 'Höflicher Vorschlag: It might be worth + -ing (= es könnte sich lohnen, … zu). || A polite suggestion: It might be worth + -ing (= it could be useful to …).',
  },
  {
    k: 'ocl', p: 'art.indefinite', lv: 'B2', dom: 'life', cls: 'art', a: ['a', 'one'],
    t: 'My brother moved back home to Germany after only ___ year in Canada.',
    c: {
      the: 'the year meint ein bestimmtes Jahr; hier geht es um die Dauer „ein Jahr“. || the year means a specific year; this is about the length “one year”.',
      an: 'an steht vor einem Vokal-Laut; year beginnt mit einem j-Laut. || an goes before a vowel sound; year starts with a y sound.',
      per: 'per year heißt „pro Jahr“; gemeint ist „nach nur einem Jahr“. || per year means “each year”; the sentence means “after only one year”.',
    },
    ok: 'Vor einem zählbaren Nomen im Singular steht a (oder one, wenn du die Zahl betonst): after only a year. || A singular countable noun takes a (or one to stress the number): after only a year.',
  },
  {
    k: 'ocl', p: 'inv.only', lv: 'C1', dom: 'biz', cls: 'aux', a: ['did'],
    t: 'Only after the system had crashed twice ___ we realize how outdated our backups were.',
    c: {
      had: 'had we realize geht nicht; had braucht ein Partizip (realized). || had we realize does not work; had needs a participle (realized).',
      were: 'were we realize gibt es nicht; vor der Grundform steht did. || were we realize does not exist; did goes before the base form.',
      do: 'do passt nicht zur Vergangenheit (had crashed, were). || do does not fit the past (had crashed, were).',
    },
    ok: 'Nach Only after … am Satzanfang kommt die Frage-Wortstellung: did + Subjekt + Grundform (did we realize). || After Only after … at the start, use question word order: did + subject + base form (did we realize).',
  },

  // ================= wf =================
  {
    k: 'wf', p: 'lx.wf-noun', lv: 'B2', dom: 'biz',
    t: 'Since the ___ of flexible working hours, fewer people have called in sick.',
    stem: 'INTRODUCE', a: ['introduction'], pos: 'noun', parts: { base: 'introduce', suf: ['tion'] },
    fam: ['introduce', 'introduction', 'introductory', 'introduced'],
    w: {
      introduce: '„introduce“ ist ein Verb; nach „the“ und vor „of“ steht ein Nomen. || “introduce” is a verb; a noun goes after “the” and before “of”.',
      introductory: '„introductory“ ist ein Adjektiv (einführend); hier braucht der Satz ein Nomen. || “introductory” is an adjective; the sentence needs a noun.',
      introduced: '„introduced“ ist eine Verbform; hier braucht der Satz ein Nomen. || “introduced” is a verb form; the sentence needs a noun.',
    },
    ok: 'Nach „the“ und vor „of“ steht ein Nomen: introduce + -tion (das e fällt weg) = die Einführung. || A noun goes after “the” and before “of”: introduce + -tion (drop the e) = introduction.',
  },
  {
    k: 'wf', p: 'lx.wf-adj', lv: 'B2+', dom: 'biz',
    t: 'The new booking tool is so ___ that most of our staff used it without any training.',
    stem: 'INTUITION', a: ['intuitive'], pos: 'adj', parts: { base: 'intuit', suf: ['ive'] },
    fam: ['intuition', 'intuitive', 'intuitively'],
    w: {
      intuition: '„intuition“ ist ein Nomen; nach „so“ steht ein Adjektiv. || “intuition” is a noun; an adjective follows “so”.',
      intuitively: '„intuitively“ ist ein Adverb; nach „is so“ braucht der Satz ein Adjektiv. || “intuitively” is an adverb; after “is so” the sentence needs an adjective.',
    },
    ok: 'Nach „is so“ steht ein Adjektiv: intuit + -ive = intuitive (leicht verständlich, selbsterklärend). || An adjective follows “is so”: intuit + -ive = intuitive (easy to use without help).',
  },
  {
    k: 'wf', p: 'lx.wf-adv', lv: 'B2+', dom: 'life',
    t: 'Since we got a new router, the internet in our apartment has become ___ faster.',
    stem: 'NOTICE', a: ['noticeably'], pos: 'adv', parts: { base: 'notice', suf: ['ably'] },
    fam: ['notice', 'noticeable', 'noticeably'],
    w: {
      noticeable: '„noticeable“ ist ein Adjektiv; vor „faster“ steht ein Adverb. || “noticeable” is an adjective; an adverb goes before “faster”.',
      notice: '„notice“ ist ein Nomen oder Verb; vor „faster“ steht ein Adverb. || “notice” is a noun or verb; an adverb goes before “faster”.',
    },
    ok: 'Vor einem Adjektiv im Vergleich (faster) steht ein Adverb: notice + -ably = noticeably (spürbar). || An adverb goes before a comparative (faster): notice + -ably = noticeably.',
  },
  {
    k: 'wf', p: 'lx.wf-neg', lv: 'B2+', dom: 'biz',
    t: 'With so many new staff starting at once, a few delays in the first week were simply ___.',
    stem: 'AVOID', a: ['unavoidable'], pos: 'adj', parts: { pre: 'un', base: 'avoid', suf: ['able'] },
    fam: ['avoid', 'avoidable', 'unavoidable', 'avoidance'],
    w: {
      avoidable: '„avoidable“ heißt vermeidbar; gemeint ist das Gegenteil (simply = einfach nicht zu ändern). || “avoidable” means it could be avoided; the sentence means the opposite.',
      avoid: '„avoid“ ist ein Verb; nach „were simply“ steht ein Adjektiv. || “avoid” is a verb; an adjective follows “were simply”.',
      avoidance: '„avoidance“ ist ein Nomen; nach „were simply“ steht ein Adjektiv. || “avoidance” is a noun; an adjective follows “were simply”.',
    },
    ok: 'Nach „were“ steht ein Adjektiv, und der Sinn ist verneint: un- + avoid + -able = unavoidable (nicht zu vermeiden). || An adjective follows “were”, and the meaning is negative: un- + avoid + -able = unavoidable.',
  },
  {
    k: 'wf', p: 'lx.wf-noun', lv: 'B2', dom: 'life',
    t: 'We had real ___ finding a hotel near the beach, so we stayed in the next town.',
    stem: 'DIFFICULT', a: ['difficulty', 'difficulties'], pos: 'noun', parts: { base: 'difficult', suf: ['y'] },
    fam: ['difficult', 'difficulty', 'difficulties'],
    w: {
      difficult: '„difficult“ ist ein Adjektiv; nach „had real“ steht ein Nomen. || “difficult” is an adjective; a noun follows “had real”.',
    },
    ok: 'Nach „had real“ steht ein Nomen: difficult + -y = difficulty (have difficulty + -ing = Mühe haben, etwas zu tun). Auch difficulties passt. || A noun follows “had real”: difficult + -y = difficulty (have difficulty + -ing). difficulties also fits.',
  },
  {
    k: 'wf', p: 'lx.wf-verb', lv: 'B2', dom: 'biz',
    t: 'Could we ___ the weekly meeting to thirty minutes, since most points are settled by e-mail anyway?',
    stem: 'SHORT', a: ['shorten'], pos: 'verb', parts: { base: 'short', suf: ['en'] },
    fam: ['short', 'shorten', 'shortly', 'shortage'],
    w: {
      short: '„short“ ist ein Adjektiv; nach „Could we“ steht ein Verb. || “short” is an adjective; a verb follows “Could we”.',
      shortly: '„shortly“ heißt „bald“; nach „Could we“ steht ein Verb. || “shortly” means “soon”; a verb follows “Could we”.',
      shortage: '„shortage“ ist ein Nomen (Mangel); hier braucht der Satz ein Verb. || “shortage” is a noun; the sentence needs a verb.',
    },
    ok: 'Nach „Could we“ steht ein Verb: short + -en = shorten (kürzen). So bilden viele Adjektive ein Verb: wide → widen, deep → deepen. || A verb follows “Could we”: short + -en = shorten. Many adjectives form verbs this way: wide → widen.',
  },
  {
    k: 'wf', p: 'lx.wf-noun', lv: 'B2', dom: 'biz',
    t: 'Under her ___, the small sales team doubled its revenue within two years.',
    stem: 'LEADER', a: ['leadership'], pos: 'noun', parts: { base: 'leader', suf: ['ship'] },
    fam: ['lead', 'leader', 'leadership', 'leading'],
    w: {
      leader: '„under her leader“ geht nicht; gemeint ist die Führung, nicht die Person. || “under her leader” does not work; the sentence means the guidance, not the person.',
      leading: '„leading“ ist eine Verbform oder ein Adjektiv; nach „her“ steht hier ein Nomen. || “leading” is a verb form or adjective; a noun follows “her” here.',
      lead: '„lead“ ist nicht aus LEADER gebildet, und „under her lead“ ist unüblich; gemeint ist leadership (die Führung). || “lead” is not formed from LEADER, and “under her lead” is unusual; the word needed is leadership.',
    },
    ok: 'Nach „Under her“ steht ein Nomen: leader + -ship = leadership (die Führung). -ship bildet abstrakte Nomen: partner → partnership. || A noun follows “Under her”: leader + -ship = leadership. -ship forms abstract nouns: partner → partnership.',
  },

  // ================= kwt =================
  {
    k: 'kwt', p: 'ut.be-used-to', lv: 'B2+', dom: 'life',
    lead: 'My grandmother gets up at five every morning, so it is nothing unusual for her.', key: 'USED',
    before: 'My grandmother', after: 'up at five every morning.', a: ['is used'], b: ['to getting'],
    v: [{ a: ['has gotten used', 'has got used', 'has become used'], b: ['to getting'] }], x: ['get', 'uses', 'being'],
    traps: [
      ['is used to get', 'Nach be used to steht -ing: is used to getting.', 'be used to is followed by -ing: is used to getting.'],
      ['used to get', 'used to get heißt „früher“; gemeint ist „gewohnt sein“: is used to getting.', 'used to get means “in the past”; the sentence means “be accustomed to”: is used to getting.'],
    ],
    ok: ['Teil 1: is used, so sagst du „gewohnt sein“. Teil 2: to getting, nach be used to steht -ing.', 'Part 1: is used, that is how you say “be accustomed”. Part 2: to getting, be used to is followed by -ing.'],
  },
  {
    k: 'kwt', p: 'fut.perfect', lv: 'B2+', dom: 'life',
    lead: 'The builders will finish our new kitchen before the end of next month.', key: 'HAVE',
    before: 'By the end of next month, the builders', after: 'our new kitchen.', a: ['will have'], b: ['finished', 'completed'],
    v: [{ a: ['are going'], b: ['to have finished', 'to have completed'] }], x: ['be', 'finishing', 'had'],
    traps: [
      ['will have finish', 'Nach will have steht das Partizip: finished.', 'will have is followed by the participle: finished.'],
      ['would have finished', 'would have ist Konditional; ein Zeitpunkt in der Zukunft braucht will have finished.', 'would have is a conditional; a point in the future needs will have finished.'],
    ],
    ok: ['Teil 1: will have, so sagst du „wird … haben“. Teil 2: finished, das Partizip, weil die Arbeit bis dahin fertig ist.', 'Part 1: will have, the future perfect. Part 2: finished, the participle, because the work will be done by then.'],
  },
  {
    k: 'kwt', p: 'mc.past-cond', lv: 'C1', dom: 'biz', nc: true,
    lead: 'We did not back up the server, so we are now missing three weeks of data.', key: 'WOULD',
    before: 'If we had backed up the server, we', after: 'three weeks of data now.', a: ['would not'], b: ['be missing'],
    v: [{ a: ['would still'], b: ['have'] }], x: ['been', 'missed', 'will'],
    traps: [
      ['would not have missed', 'Das Ergebnis betrifft jetzt (now): would not be missing, nicht would have missed.', 'The result is about now: would not be missing, not would have missed.'],
    ],
    ok: ['Gemischtes Konditional: Vergangenheit im if-Teil (had backed up), Folge jetzt: would not be missing. Teil 1: would not. Teil 2: be missing.', 'Mixed conditional: past in the if-clause (had backed up), result now: would not be missing. Part 1: would not. Part 2: be missing.'],
  },
  {
    k: 'kwt', p: 'ma.should-have', lv: 'B2+', dom: 'biz',
    lead: 'It was a mistake not to tell the client about the delay earlier.', key: 'SHOULD',
    before: 'We', after: 'the client about the delay earlier.', a: ['should have'], b: ['told', 'informed'], x: ['ought', 'had', 'telling'],
    traps: [
      ['should have tell', 'Nach should have steht das Partizip: told.', 'should have is followed by the participle: told.'],
      ['should had told', 'Nach should steht have, nicht had: should have told.', 'should is followed by have, not had: should have told.'],
    ],
    ok: ['Kritik an Vergangenem: should have + Partizip. Teil 1: should have. Teil 2: told.', 'Criticism of the past: should have + participle. Part 1: should have. Part 2: told.'],
  },
  {
    k: 'kwt', p: 'inv.sooner', lv: 'C1', dom: 'biz',
    lead: 'As soon as we had launched the update, customers started reporting bugs.', key: 'SOONER',
    before: 'No', after: 'the update than customers started reporting bugs.', a: ['sooner'], b: ['had we launched', 'had we released', 'had we rolled out'], x: ['did', 'have', 'soon'],
    traps: [
      ['sooner we had launched', 'Nach No sooner kommt die Frage-Wortstellung: had we launched.', 'No sooner is followed by question word order: had we launched.'],
      ['sooner did we launch', 'Hier steht das Plusquamperfekt: had we launched, nicht did we launch.', 'This needs the past perfect: had we launched, not did we launch.'],
    ],
    ok: ['No sooner … than = kaum … da. Teil 1: sooner. Teil 2: had we launched, mit Frage-Wortstellung und Plusquamperfekt.', 'No sooner … than = the moment … then. Part 1: sooner. Part 2: had we launched, with question word order and the past perfect.'],
  },
];
