// P41 C1-Check Form C: 26 eigene Aufgaben (7 mcc · 7 ocl · 7 wf · 5 kwt), dazu kommen die 4 Anker (anchor.mjs) = 30 Aufgaben, 36 Punkte.
// Grammatik deckt alle sieben Kapitel ab. Quellformate: siehe scripts/c1x/build-check.mjs.
export const meta = { file: 'c', form: 'C' };
const W = (w, cat, text) => [w, cat, text];
export const items = [
  // ================= mcc =================
  {
    k: 'mcc', p: 'pc.recent', lv: 'B2', dom: 'biz',
    t: 'I ___ a lot of overtime lately, so I am taking Friday off to rest.',
    o: [['have been doing'],
      W('did', 'grammar', 'lately verlangt eine Zeit, die bis jetzt reicht; did ist abgeschlossen. || lately needs a tense that reaches up to now; did is finished.'),
      W('am doing', 'calque', 'Deutsch „ich mache in letzter Zeit viel“ steht im Präsens; mit lately braucht Englisch have been + -ing. || German uses the present here; with lately English needs have been + -ing.'),
      W('had done', 'grammar', 'had done blickt von einem Punkt in der Vergangenheit zurück; hier geht es um jetzt. || had done looks back from a point in the past; this is about now.')],
    ok: 'Was in letzter Zeit läuft und jetzt Spuren hinterlässt: have been + -ing mit lately/recently (I have been doing a lot of overtime). || An activity of the recent past that still affects now: have been + -ing with lately/recently.',
  },
  {
    k: 'mcc', p: 'cp.within', lv: 'B2+', dom: 'life',
    t: 'Please confirm your hotel booking ___ two days; otherwise the reservation will be canceled.',
    o: [['within'],
      W('during', 'calque', 'Deutsch „während“: during nennt einen Zeitraum, in dem etwas passiert, keine Frist. || during names a period in which something happens, not a time limit.'),
      W('since', 'grammar', 'since braucht einen Zeitpunkt in der Vergangenheit (since Monday). || since needs a point in the past (since Monday).'),
      W('until', 'meaning', 'until heißt „bis“ und braucht einen Zeitpunkt, keine Dauer. || until means “up to” and needs a point in time, not a length of time.')],
    ok: 'within + Zeitspanne = innerhalb von, spätestens nach (within two days). || within + period = inside that time limit (within two days).',
  },
  {
    k: 'mcc', p: 'ca.in-case', lv: 'B2+', dom: 'life',
    t: 'Take a warm jacket with you ___ it gets cold up in the mountains tonight.',
    o: [['in case'],
      W('unless', 'meaning', 'unless heißt „wenn nicht“: Du würdest die Jacke nur mitnehmen, wenn es NICHT kalt wird. || unless means “except if”: you would only take the jacket if it did NOT get cold.'),
      W('otherwise', 'grammar', 'otherwise verbindet keinen Nebensatz; es heißt „sonst“. || otherwise does not start a clause like this; it means “or else”.'),
      W('as long as', 'meaning', 'as long as heißt „solange“ oder „unter der Bedingung“; gemeint ist Vorsicht. || as long as means “on the condition that”; the sentence is about a precaution.')],
    ok: 'in case = für den Fall, dass: Du tust etwas vorher zur Vorsicht (Take a jacket in case it gets cold). || in case = as a precaution in the event that (Take a jacket in case it gets cold).',
  },
  {
    k: 'mcc', p: 'qu.indirect', lv: 'B2', dom: 'biz',
    t: 'Could you tell me where ___, so I can take the documents there directly?',
    o: [['the legal department is'],
      W('is the legal department', 'calque', 'Wie im Deutschen eine direkte Frage; nach Could you tell me where steht die Aussage-Wortstellung. || This is direct question order; after Could you tell me where, use statement word order.'),
      W('does the legal department', 'grammar', 'In einer indirekten Frage steht kein does, und es fehlt das Verb. || An indirect question has no does, and the verb is missing.'),
      W('the legal department are', 'grammar', 'the legal department ist hier Einzahl: is. || the legal department is singular here: is.')],
    ok: 'Indirekte Frage: Fragewort + Subjekt + Verb, wie in einer Aussage (where the legal department is). || Indirect question: question word + subject + verb, as in a statement (where the legal department is).',
  },
  {
    k: 'mcc', p: 'prp.no-prep', lv: 'B2', dom: 'biz',
    t: 'We will ___ the new pricing model at the next sales meeting on Thursday.',
    o: [['discuss'],
      W('discuss about', 'calque', 'Deutsch „über etwas diskutieren“; discuss steht ohne about. || German “über etwas diskutieren”; discuss takes no about.'),
      W('talk', 'grammar', 'talk braucht about: talk about the model. || talk needs about: talk about the model.'),
      W('speak', 'grammar', 'speak braucht about: speak about the model. || speak needs about: speak about the model.')],
    ok: 'discuss steht direkt mit Objekt, ohne Präposition: discuss the new model (aber: talk about). || discuss takes a direct object, no preposition: discuss the new model (but: talk about).',
  },
  {
    k: 'mcc', p: 'lx.pay-attention', area: 'lex', lex: ['pay attention'], lv: 'B2', dom: 'biz',
    t: 'Please ___ special attention to the delivery dates in section four of the contract.',
    o: [['pay'],
      W('make', 'calque', 'Deutsch „machen“ passt hier nicht; die Verbindung heißt pay attention. || German “machen” does not fit; the collocation is pay attention.'),
      W('put', 'partner', 'put attention sagt man nicht; es heißt pay attention to. || People do not say put attention; it is pay attention to.'),
      W('take', 'partner', 'take attention sagt man nicht; es heißt pay attention to. || People do not say take attention; it is pay attention to.')],
    ok: 'Feste Verbindung: pay attention to = auf etwas achten. || Fixed collocation: pay attention to = focus on something.',
  },
  {
    k: 'mcc', p: 'lx.make-progress', area: 'lex', lex: ['make progress'], lv: 'B2', dom: 'biz',
    t: 'The negotiations were difficult, but in the end we ___ real progress on the price.',
    o: [['made'],
      W('did', 'calque', 'Deutsch „Fortschritte machen“ führt zu do; es heißt make progress. || German “Fortschritte machen” leads to do; English says make progress.'),
      W('had', 'partner', 'had progress sagt man nicht; es heißt make progress. || People do not say have progress; it is make progress.'),
      W('took', 'partner', 'took progress sagt man nicht; es heißt make progress. || People do not say take progress; it is make progress.')],
    ok: 'Feste Verbindung: make progress = Fortschritte machen (progress ist unzählbar: kein a, kein -s). || Fixed collocation: make progress (progress is uncountable: no a, no -s).',
  },

  // ================= ocl =================
  {
    k: 'ocl', p: 'pt.by-until', lv: 'B2', dom: 'biz', cls: 'prep', a: ['by', 'before'],
    t: 'Please send me your comments ___ the end of Thursday at the latest, so I can still update the slides.',
    c: {
      until: 'until heißt „bis“ für eine Dauer; eine Frist (at the latest) braucht by. || until means “up to” for a duration; a deadline (at the latest) needs by.',
      since: 'since braucht einen Zeitpunkt in der Vergangenheit. || since needs a point in the past.',
      for: 'for nennt eine Dauer (for two days), keine Frist. || for names a duration (for two days), not a deadline.',
    },
    ok: 'Frist („spätestens bis“): by + Zeitpunkt (by the end of Thursday). Dauer („bis dahin durchgehend“): until. || Deadline: by + point in time (by the end of Thursday). Duration up to then: until.',
  },
  {
    k: 'ocl', p: 'fut.continuous', lv: 'B2+', dom: 'life', cls: 'aux', a: ['be'],
    t: 'This time tomorrow, I will ___ sitting on a plane to Chicago, so I cannot come to your party.',
    c: {
      being: 'will being gibt es nicht; nach will steht die Grundform be. || will being does not exist; the base form be follows will.',
      been: 'will been gibt es nicht; es fehlt have (will have been). || will been does not exist; have is missing (will have been).',
      have: 'will have sitting gibt es nicht; es heißt will be sitting. || will have sitting does not exist; it is will be sitting.',
    },
    ok: 'Was zu einem Zeitpunkt in der Zukunft gerade läuft: will be + -ing (This time tomorrow I will be sitting …). || Something in progress at a point in the future: will be + -ing (This time tomorrow I will be sitting …).',
  },
  {
    k: 'ocl', p: 'cn.third', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['had'],
    t: 'We would have won the contract if our offer ___ arrived one day earlier.',
    c: {
      would: 'Im if-Teil steht kein would; es heißt if our offer had arrived. || would does not go in the if-clause; it is if our offer had arrived.',
      has: 'has passt nicht zum gedachten Fall in der Vergangenheit (would have won). || has does not fit an imagined past (would have won).',
      have: 'have braucht hier had: if our offer had arrived. || have must be had here: if our offer had arrived.',
    },
    ok: 'Verpasste Chance (3. Konditional): if + had + Partizip, would have + Partizip. || A missed chance (third conditional): if + had + participle, would have + participle.',
  },
  {
    k: 'ocl', p: 'mnd.negation', lv: 'C1', dom: 'biz', cls: 'adv', a: ['not', 'never', "shouldn't"],
    t: 'Our lawyer recommended that we ___ sign anything until the audit is complete.',
    c: {
      "didn't": "Nach recommend that steht die Grundform; die Verneinung ist not, ohne do. || After recommend that, use the base form; the negative is not, without do.",
      no: 'no steht vor Nomen, nicht vor einem Verb. || no goes before nouns, not before a verb.',
      "won't": "Nach recommend that steht kein will; verneint wird mit not + Grundform. || No will after recommend that; the negative is not + base form.",
    },
    ok: 'Nach recommend, insist, suggest + that steht die Grundform; verneint: not + Grundform (that we not sign). || After recommend, insist, suggest + that, use the base form; the negative is not + base form (that we not sign).',
  },
  {
    k: 'ocl', p: 'ma.had-better', lv: 'B2', dom: 'life', cls: 'adv', a: ['better', 'best'],
    t: 'You had ___ leave now; the last train to the city goes in ten minutes.',
    c: {
      rather: 'had rather ist veraltet und heißt „lieber“; als Warnung steht had better. || had rather is old-fashioned and means “prefer”; a warning is had better.',
      must: 'had must gibt es nicht. || had must does not exist.',
      should: 'had should gibt es nicht. || had should does not exist.',
    },
    ok: 'Dringender Rat oder Warnung: had better + Grundform (You had better leave now). had best ist seltener, gilt aber auch. || Urgent advice or a warning: had better + base form (You had better leave now). had best is rarer but also accepted.',
  },
  {
    k: 'ocl', p: 'rc.where-why', lv: 'B2+', dom: 'biz', cls: 'rel', a: ['why', 'that'],
    t: 'That is exactly the reason ___ we switched to a cloud-based archive last year.',
    c: {
      because: 'the reason because gibt es nicht; nach the reason steht why oder that. || the reason because does not work; the reason is followed by why or that.',
      which: 'the reason which geht nicht; der Satz braucht why (oder that). || the reason which does not work; the sentence needs why (or that).',
      where: 'where steht nach einem Ort, nicht nach reason. || where follows a place, not reason.',
    },
    ok: 'Nach the reason steht why (oder that): the reason why we switched = der Grund, warum wir gewechselt haben. || the reason is followed by why (or that): the reason why we switched.',
  },
  {
    k: 'ocl', p: 'cp.having', lv: 'C1', dom: 'biz', cls: 'aux', a: ['Having'],
    t: '___ checked all the invoices twice, the accountant was sure the mistake was not hers.',
    c: {
      Being: 'Being checked wäre Passiv („geprüft werdend“); die Buchhalterin hat selbst geprüft. || Being checked would be passive; the accountant did the checking herself.',
      After: 'After checked geht nicht; nach After steht -ing: After checking. || After checked does not work; After needs -ing: After checking.',
      Has: 'Has am Satzanfang macht eine Frage, keinen Nebensatz. || Has at the start makes a question, not a participle clause.',
    },
    ok: 'Having + Partizip = nachdem (dasselbe Subjekt): Having checked all the invoices, the accountant … || Having + participle = after doing something (same subject): Having checked all the invoices, the accountant …',
  },

  // ================= wf =================
  {
    k: 'wf', p: 'lx.wf-noun', lv: 'B2', dom: 'biz',
    t: 'The new routing software has led to a fifteen percent ___ in fuel costs.',
    stem: 'REDUCE', a: ['reduction'], pos: 'noun', parts: { base: 'reduce', suf: ['tion'] },
    fam: ['reduce', 'reduced', 'reduction'],
    w: {
      reduce: '„reduce“ ist ein Verb; nach „a fifteen percent“ steht ein Nomen. || “reduce” is a verb; a noun follows “a fifteen percent”.',
      reduced: '„reduced“ ist eine Verbform oder ein Adjektiv; hier braucht der Satz ein Nomen. || “reduced” is a verb form or adjective; the sentence needs a noun.',
    },
    ok: 'Nach „a fifteen percent“ steht ein Nomen: reduce + -tion (das e fällt weg) = reduction (Senkung). || A noun follows “a fifteen percent”: reduce + -tion (drop the e) = reduction.',
  },
  {
    k: 'wf', p: 'lx.wf-adj', lv: 'B2+', dom: 'biz',
    t: 'Our prices are ___ to those of our main competitor, but our delivery is much faster.',
    stem: 'COMPARE', a: ['comparable'], pos: 'adj', parts: { base: 'compare', suf: ['able'] },
    fam: ['compare', 'comparable', 'comparison', 'comparatively'],
    w: {
      comparison: '„comparison“ ist ein Nomen; nach „are“ steht ein Adjektiv. || “comparison” is a noun; an adjective follows “are”.',
      comparatively: '„comparatively“ ist ein Adverb; nach „are“ steht ein Adjektiv. || “comparatively” is an adverb; an adjective follows “are”.',
      compare: '„compare“ ist ein Verb; nach „are“ steht ein Adjektiv. || “compare” is a verb; an adjective follows “are”.',
    },
    ok: 'Nach „are“ steht ein Adjektiv: compare + -able (das e fällt weg) = comparable (vergleichbar); comparable to = vergleichbar mit. || An adjective follows “are”: compare + -able (drop the e) = comparable; comparable to = similar to.',
  },
  {
    k: 'wf', p: 'lx.wf-adv', lv: 'B2', dom: 'life',
    t: 'Our new apartment is ___ located just five minutes from the main train station.',
    stem: 'CONVENIENT', a: ['conveniently'], pos: 'adv', parts: { base: 'convenient', suf: ['ly'] },
    fam: ['convenient', 'convenience', 'conveniently', 'inconvenient'],
    w: {
      convenient: '„convenient“ ist ein Adjektiv; vor „located“ steht ein Adverb. || “convenient” is an adjective; an adverb goes before “located”.',
      convenience: '„convenience“ ist ein Nomen; vor „located“ steht ein Adverb. || “convenience” is a noun; an adverb goes before “located”.',
      inconvenient: '„inconvenient“ ist ein Adjektiv mit dem Gegenteil; vor „located“ steht ein Adverb. || “inconvenient” is an adjective with the opposite meaning; an adverb goes before “located”.',
    },
    ok: 'Vor einem Partizip (located) steht ein Adverb: convenient + -ly = conveniently (günstig gelegen). || An adverb goes before a participle (located): convenient + -ly = conveniently.',
  },
  {
    k: 'wf', p: 'lx.wf-neg', lv: 'B2', dom: 'biz',
    t: 'It is still ___ whether the client will renew the contract next year.',
    stem: 'CLEAR', a: ['unclear'], pos: 'adj', parts: { pre: 'un', base: 'clear' },
    fam: ['clear', 'clearly', 'unclear', 'clarity'],
    w: {
      clear: '„clear“ ergibt mit „still … whether“ keinen Sinn; gemeint ist „noch nicht klar“. || “clear” makes no sense with “still … whether”; the sentence means “not yet known”.',
      clearly: '„clearly“ ist ein Adverb; nach „is still“ steht ein Adjektiv. || “clearly” is an adverb; an adjective follows “is still”.',
      clarity: '„clarity“ ist ein Nomen; nach „is still“ steht ein Adjektiv. || “clarity” is a noun; an adjective follows “is still”.',
    },
    ok: 'Nach „is still“ steht ein Adjektiv mit verneintem Sinn (whether = ob): un- + clear = unclear (unklar). || An adjective with a negative meaning follows “is still” (whether shows doubt): un- + clear = unclear.',
  },
  {
    k: 'wf', p: 'lx.wf-noun', lv: 'B2+', dom: 'biz',
    t: 'The elevators will be out of service on Saturday because of routine ___.',
    stem: 'MAINTAIN', a: ['maintenance'], pos: 'noun', parts: { base: 'maintain', suf: ['ance'], change: 'ai → e' },
    fam: ['maintain', 'maintained', 'maintenance'],
    w: {
      maintain: '„maintain“ ist ein Verb; nach „routine“ steht ein Nomen. || “maintain” is a verb; a noun follows “routine”.',
      maintained: '„maintained“ ist eine Verbform; nach „routine“ steht ein Nomen. || “maintained” is a verb form; a noun follows “routine”.',
    },
    ok: 'Nach „routine“ steht ein Nomen: maintain → maintenance (ai wird e, dazu -ance) = Wartung. || A noun follows “routine”: maintain → maintenance (ai becomes e, add -ance).',
  },
  {
    k: 'wf', p: 'lx.wf-verb', lv: 'B2+', dom: 'life',
    t: 'Next year we plan to ___ the old bathroom in our house.',
    stem: 'MODERN', a: ['modernize'], pos: 'verb', parts: { base: 'modern', suf: ['ize'] },
    fam: ['modern', 'modernize', 'modernization', 'modernity'],
    w: {
      modern: '„modern“ ist ein Adjektiv; nach „plan to“ steht ein Verb. || “modern” is an adjective; a verb follows “plan to”.',
      modernization: '„modernization“ ist ein Nomen; nach „plan to“ steht ein Verb. || “modernization” is a noun; a verb follows “plan to”.',
      modernity: '„modernity“ ist ein Nomen; nach „plan to“ steht ein Verb. || “modernity” is a noun; a verb follows “plan to”.',
    },
    ok: 'Nach „plan to“ steht ein Verb: modern + -ize = modernize (modernisieren; britisch auch modernise). || A verb follows “plan to”: modern + -ize = modernize (British also modernise).',
  },
  {
    k: 'wf', p: 'lx.wf-adj', lv: 'B2', dom: 'life',
    t: 'A good internet connection is ___ for anyone who works from home.',
    stem: 'ESSENCE', a: ['essential'], pos: 'adj', parts: { base: 'essence', suf: ['tial'], change: 'ce → tial' },
    fam: ['essence', 'essential', 'essentially'],
    w: {
      essence: '„essence“ ist ein Nomen; nach „is“ steht hier ein Adjektiv. || “essence” is a noun; an adjective follows “is” here.',
      essentially: '„essentially“ ist ein Adverb; nach „is“ steht ein Adjektiv. || “essentially” is an adverb; an adjective follows “is”.',
    },
    ok: 'Nach „is“ steht ein Adjektiv: essence → essential (ce wird zu tial) = unverzichtbar. || An adjective follows “is”: essence → essential (ce becomes tial) = absolutely necessary.',
  },

  // ================= kwt =================
  {
    k: 'kwt', p: 'pp.first-time', lv: 'B2+', dom: 'biz',
    lead: 'Lisa had never given a talk in English before the conference in Boston.', key: 'FIRST',
    before: 'The conference in Boston was the', after: 'a talk in English.', a: ['first time'], b: ['Lisa had given', 'she had given', 'that Lisa had given', 'that she had given'],
    x: ['has', 'gave', 'ever'], tiles: ['time', 'Lisa', 'had', 'given'],
    traps: [
      ['first time Lisa gave', 'Nach the first time steht hier das Plusquamperfekt (was): had given.', 'After the first time, use the past perfect here (was): had given.'],
      ['first time Lisa has given', 'Der Satz spielt in der Vergangenheit (was): had given, nicht has given.', 'The sentence is in the past (was): had given, not has given.'],
    ],
    ok: ['It was the first time + had + Partizip. Teil 1: first time. Teil 2: Lisa had given.', 'It was the first time + had + participle. Part 1: first time. Part 2: Lisa had given.'],
  },
  {
    k: 'kwt', p: 'ca.unless', lv: 'B2+', dom: 'biz',
    lead: 'We will cancel the order if the supplier does not confirm the date this week.', key: 'UNLESS',
    before: 'We will cancel the order', after: 'the date this week.', a: ['unless'], b: ['the supplier confirms', 'the supplier has confirmed'], x: ['not', 'will', 'if'],
    traps: [
      ['unless the supplier does not confirm', 'unless heißt schon „wenn nicht“: kein zweites not.', 'unless already means “if not”: no second not.'],
      ['unless the supplier will confirm', 'Nach unless steht kein will: the supplier confirms.', 'No will after unless: the supplier confirms.'],
    ],
    ok: ['unless = wenn nicht. Teil 1: unless. Teil 2: the supplier confirms, ohne not und ohne will.', 'unless = if not. Part 1: unless. Part 2: the supplier confirms, without not and without will.'],
  },
  {
    k: 'kwt', p: 'md.must-have', lv: 'B2+', dom: 'life',
    lead: 'I am convinced that somebody has taken my bike from the garden; it was here an hour ago.', key: 'MUST',
    before: 'Somebody', after: 'my bike from the garden.', a: ['must have'], b: ['taken', 'removed', 'borrowed'], x: ['can', 'had', 'took'],
    traps: [
      ['must had taken', 'Nach must steht have, nicht had: must have taken.', 'must is followed by have, not had: must have taken.'],
      ['must have took', 'took ist Past Simple; nach have steht das Partizip taken.', 'took is the past simple; have is followed by the participle taken.'],
    ],
    ok: ['Fast sicher (Vergangenheit): must have + Partizip. Teil 1: must have. Teil 2: taken.', 'Almost certain (past): must have + participle. Part 1: must have. Part 2: taken.'],
  },
  {
    k: 'kwt', p: 'vp.remember-forget', lv: 'B2+', dom: 'life',
    lead: 'I locked the front door this morning, but I have no memory of doing it.', key: 'REMEMBER',
    before: 'I locked the front door this morning, but I', after: 'it.', a: ['do not'], b: ['remember locking', 'remember doing'],
    v: [{ a: ['cannot', "can't"], b: ['remember locking', 'remember doing'] }], x: ['to', 'lock', 'forget'],
    traps: [
      ['do not remember to lock', 'remember to lock heißt „daran denken, es zu tun“; gemeint ist die Erinnerung: remember locking.', 'remember to lock means “not forget to do it”; the sentence means the memory: remember locking.'],
    ],
    ok: ['remember + -ing = sich an etwas Getanes erinnern. Teil 1: do not. Teil 2: remember locking.', 'remember + -ing = recall something you did. Part 1: do not. Part 2: remember locking.'],
  },
  {
    k: 'kwt', p: 'cmp.the-the', lv: 'C1', dom: 'biz',
    lead: 'The cost of fixing the problem rises with every week that we wait.', key: 'MORE',
    before: 'The longer we wait,', after: 'the problem becomes.', a: ['the more'], b: ['expensive', 'costly'], x: ['most', 'than', 'expensively'],
    traps: [
      ['the more expensively', 'Nach becomes steht ein Adjektiv: expensive, nicht expensively.', 'becomes is followed by an adjective: expensive, not expensively.'],
      ['more and more expensive', 'Das Muster heißt the …, the …: The longer we wait, the more expensive.', 'The pattern is the …, the …: The longer we wait, the more expensive.'],
    ],
    ok: ['Je …, desto …: the + Komparativ, the + Komparativ. Teil 1: the more. Teil 2: expensive.', 'The …, the …: the + comparative, the + comparative. Part 1: the more. Part 2: expensive.'],
  },
];
