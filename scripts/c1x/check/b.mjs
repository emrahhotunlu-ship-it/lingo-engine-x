// P41 C1-Check Form B: 26 eigene Aufgaben (7 mcc · 7 ocl · 7 wf · 5 kwt), dazu kommen die 4 Anker (anchor.mjs) = 30 Aufgaben, 36 Punkte.
// Grammatik deckt alle sieben Kapitel ab. Quellformate: siehe scripts/c1x/build-check.mjs.
export const meta = { file: 'b', form: 'B' };
const W = (w, cat, text) => [w, cat, text];
export const items = [
  // ================= mcc =================
  {
    k: 'mcc', p: 'sa.no-ing', lv: 'B2', dom: 'life',
    t: 'This bike ___ to my sister, so please ask her before you take it to the lake.',
    o: [['belongs'],
      W('is belonging', 'calque', 'belong ist ein Zustandsverb und steht nicht in der -ing-Form, auch wenn es „jetzt“ gilt. || belong is a state verb and does not take -ing, even when it is true “now”.'),
      W('belong', 'grammar', 'Bei he/she/it (this bike) braucht das Verb ein -s: belongs. || With he/she/it (this bike) the verb needs -s: belongs.'),
      W('is belonged', 'grammar', 'belong hat kein Passiv: is belonged gibt es nicht. || belong has no passive: is belonged does not exist.')],
    ok: 'Zustandsverben wie belong, own, know stehen im Present Simple, nicht mit -ing: This bike belongs to my sister. || State verbs such as belong, own, know take the present simple, not -ing: This bike belongs to my sister.',
  },
  {
    k: 'mcc', p: 'fp.was-to', lv: 'C1', dom: 'biz',
    t: 'The new office ___ open in May, but the building work fell behind schedule and it opened in July.',
    o: [['was to'],
      W('is to', 'grammar', 'is to plant die Zukunft; der Satz erzählt einen früheren Plan. || is to plans the future; the sentence tells an earlier plan.'),
      W('will', 'grammar', 'will passt nicht zu fell und opened; gemeint ist ein früherer Plan. || will does not fit fell and opened; the sentence means an earlier plan.'),
      W('has to', 'calque', 'Deutsch „sollte“ heißt hier nicht „muss“; ein früherer Plan ist was to. || German “sollte” does not mean “must” here; an earlier plan is was to.')],
    ok: 'Ein früherer, fester Plan (oft nicht erfüllt): was/were to + Grundform (The office was to open in May = sollte im Mai eröffnen). || An earlier fixed plan (often not fulfilled): was/were to + base form (The office was to open in May).',
  },
  {
    k: 'mcc', p: 'mnd.verbs', lv: 'C1', dom: 'biz',
    t: 'The client has insisted that the final report ___ in both English and German.',
    o: [['be written'],
      W('to be written', 'grammar', 'Nach insist that steht ein ganzer Satz mit Grundform, kein to. || insist that is followed by a clause with the base form, no to.'),
      W('being written', 'grammar', 'being written ist keine Verbform eines Satzes; es fehlt die Grundform be. || being written cannot be the verb of a clause; the base form be is needed.'),
      W('writes', 'meaning', 'Der Bericht schreibt nicht selbst; gemeint ist das Passiv be written. || The report does not write anything; the passive be written is needed.')],
    ok: 'Nach Verben wie insist, demand, recommend + that steht die Grundform, auch im Passiv: that the report be written. || After verbs like insist, demand, recommend + that, use the base form, also in the passive: that the report be written.',
  },
  {
    k: 'mcc', p: 'mp.bound', lv: 'C1', dom: 'biz',
    t: 'With so many changes at once, there are ___ to be a few problems in the first week.',
    o: [['bound'],
      W('obliged', 'meaning', 'obliged to heißt „verpflichtet“; gemeint ist „mit Sicherheit“. || obliged to means “required”; the sentence means “almost certain”.'),
      W('forced', 'meaning', 'forced to heißt „gezwungen“; gemeint ist „mit Sicherheit“. || forced to means “made to”; the sentence means “almost certain”.'),
      W('determined', 'meaning', 'determined to heißt „fest entschlossen“; Probleme sind nicht entschlossen. || determined to means “firmly decided”; problems cannot decide anything.')],
    ok: 'be bound to + Grundform = mit Sicherheit (There are bound to be problems = es wird sicher Probleme geben). || be bound to + base form = almost certain (There are bound to be problems).',
  },
  {
    k: 'mcc', p: 'lk.despite', lv: 'B2+', dom: 'biz',
    t: '___ the tight budget, the team managed to deliver every feature the client had asked for.',
    o: [['Despite'],
      W('Although', 'grammar', 'Although braucht einen ganzen Satz (Although the budget was tight); hier folgt nur ein Nomen. || Although needs a full clause (Although the budget was tight); only a noun follows here.'),
      W('However', 'grammar', 'However verbindet zwei Sätze, nicht ein Nomen mit einem Satz. || However links two sentences, not a noun with a clause.'),
      W('Even though', 'grammar', 'Even though braucht einen ganzen Satz mit Verb; hier folgt nur ein Nomen. || Even though needs a full clause with a verb; only a noun follows here.')],
    ok: 'Despite (oder In spite of) + Nomen: Despite the tight budget. Although/Even though brauchen einen ganzen Satz mit Verb. || Despite (or In spite of) + noun: Despite the tight budget. Although/Even though need a full clause with a verb.',
  },
  {
    k: 'mcc', p: 'lx.take-a-look', area: 'lex', lex: ['take a look'], lv: 'B2', dom: 'biz',
    t: 'Could you ___ a quick look at my slides before I send them to the client?',
    o: [['take'],
      W('throw', 'calque', 'Deutsch „einen Blick werfen“; im Englischen heißt es take (oder have) a look. || German “einen Blick werfen”; English says take (or have) a look.'),
      W('do', 'partner', 'do a look sagt man nicht; es heißt take a look. || People do not say do a look; it is take a look.'),
      W('make', 'calque', 'Deutsch „machen“ führt zu make; es heißt take a look. || German “machen” leads to make; English says take a look.')],
    ok: 'Feste Verbindung: take a look at = sich etwas ansehen (auch have a look at). || Fixed collocation: take a look at = look at something (also have a look at).',
  },
  {
    k: 'mcc', p: 'lx.make-decision', area: 'lex', lex: ['make a decision'], lv: 'B2', dom: 'biz',
    t: 'We need to ___ a decision on the new supplier before the end of the week.',
    o: [['make'],
      W('meet', 'calque', 'Deutsch „eine Entscheidung treffen“; treffen heißt hier nicht meet. Es heißt make a decision. || German “eine Entscheidung treffen”; treffen is not meet here. English says make a decision.'),
      W('do', 'partner', 'do a decision sagt man nicht; es heißt make a decision. || People do not say do a decision; it is make a decision.'),
      W('hit', 'calque', 'Deutsch „treffen“ wie ein Ziel treffen; hit a decision sagt man nicht. || German “treffen” as in hitting a target; people do not say hit a decision.')],
    ok: 'Feste Verbindung: make a decision = eine Entscheidung treffen (auch reach a decision). || Fixed collocation: make a decision (also reach a decision).',
  },

  // ================= ocl =================
  {
    k: 'ocl', p: 'ut.would', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['would'],
    t: 'When I was a trainee, my boss ___ check every e-mail I wrote before I was allowed to send it.',
    c: {
      was: 'was check gibt es nicht; vor der Grundform steht kein was. || was check does not exist; no was goes before the base form.',
      has: 'has check gibt es nicht; has braucht ein Partizip, und der Satz spielt in der Vergangenheit. || has check does not exist; has needs a participle, and the sentence is in the past.',
      had: 'had check gibt es nicht; had braucht ein Partizip (checked). || had check does not exist; had needs a participle (checked).',
    },
    ok: 'Wiederholte Handlung in der Vergangenheit: would + Grundform (my boss would check = pflegte zu prüfen). || A repeated action in the past: would + base form (my boss would check every e-mail).',
  },
  {
    k: 'ocl', p: 'tc.by-the-time', lv: 'B2+', dom: 'biz', cls: 'prep', a: ['By'],
    t: '___ the time the signed contract arrives, the price will already have changed.',
    c: {
      Until: 'Until the time heißt „bis zu dem Zeitpunkt“ (Dauer); hier ist ein Stichtag gemeint. || Until the time means a duration up to then; this sentence means a deadline.',
      In: 'In the time heißt „in der Zeit“ (Dauer), nicht „bis“. || In the time means “during the time”, not “by”.',
      On: 'On the time gibt es so nicht. || On the time does not exist in this sense.',
    },
    ok: 'By the time = bis (spätestens wenn). Danach Gegenwart (arrives), im Hauptsatz oft will have + Partizip. || By the time = by the moment when. The present follows (arrives); the main clause often has will have + participle.',
  },
  {
    k: 'ocl', p: 'cn.were', lv: 'B2', dom: 'life', cls: 'aux', a: ['were', 'was'],
    t: 'If I ___ you, I would take an umbrella, because it looks like rain this afternoon.',
    c: {
      am: 'am passt nicht zu would; If I were you ist ein gedachter Fall. || am does not fit would; If I were you is an imagined case.',
      be: 'be ohne Zeitform geht hier nicht; es heißt If I were you. || be has no tense here; it is If I were you.',
      would: 'Im if-Teil steht kein would. || would does not go in the if-clause.',
    },
    ok: 'Rat geben: If I were you, I would … (auch was ist umgangssprachlich üblich). || Giving advice: If I were you, I would … (was is also common in informal English).',
  },
  {
    k: 'ocl', p: 'pv.progressive', lv: 'B2+', dom: 'life', cls: 'aux', a: ['being'],
    t: 'Sorry about the noise: the apartment next door is ___ renovated this week.',
    c: {
      been: 'is been gibt es nicht; nach is steht being. || is been does not exist; being follows is.',
      be: 'is be gibt es nicht. || is be does not exist.',
      having: 'is having renovated gibt es nicht; das Passiv braucht being. || is having renovated does not exist; the passive needs being.',
    },
    ok: 'Passiv, das gerade läuft: is/are being + Partizip (is being renovated = wird gerade renoviert). || A passive in progress: is/are being + participle (is being renovated).',
  },
  {
    k: 'ocl', p: 'md.might-have', lv: 'B2+', dom: 'life', cls: 'aux', a: ['have'],
    t: 'I cannot find my keys anywhere; I might ___ left them on the train this morning.',
    c: {
      had: 'Nach might steht die Grundform have, nicht had. || might is followed by the base form have, not had.',
      be: 'might be left wäre Passiv; ich habe sie selbst liegen lassen. || might be left would be passive; I left them myself.',
      of: 'might of gibt es nicht; es klingt nur wie might’ve (might have). || might of does not exist; it only sounds like might’ve.',
    },
    ok: 'Vielleicht in der Vergangenheit passiert: might have + Partizip (I might have left them). || Something that maybe happened in the past: might have + participle (I might have left them).',
  },
  {
    k: 'ocl', p: 'qn.none', lv: 'B2+', dom: 'biz', cls: 'det', a: ['None'],
    t: '___ of the three suppliers could deliver before Christmas, so we had to postpone the launch.',
    c: {
      Neither: 'Neither of steht nur bei zwei; hier sind es drei Lieferanten. || Neither of is only for two; here there are three suppliers.',
      No: 'No of gibt es nicht; vor of steht None. || No of does not exist; None goes before of.',
      Nothing: 'Nothing meint Dinge, nicht Personen oder Firmen. || Nothing refers to things, not people or companies.',
    },
    ok: 'Keiner von mehr als zwei: None of + the + Nomen (None of the three suppliers). Bei genau zwei: Neither of. || Not one of more than two: None of + the + noun. With exactly two: Neither of.',
  },
  {
    k: 'ocl', p: 'el.so-not', lv: 'B2+', dom: 'life', cls: 'adv', a: ['so'],
    t: 'Will the weather be good enough for the barbecue on Saturday? I hope ___, because we have invited twenty people.',
    c: {
      it: 'I hope it geht nicht; it ersetzt keinen ganzen Satz. || I hope it does not work; it cannot replace a whole clause.',
      that: 'that braucht einen Satz danach (I hope that it will be). || that needs a clause after it (I hope that it will be).',
      yes: 'I hope yes ist Deutsch gedacht („ich hoffe ja“); es heißt I hope so. || I hope yes is German thinking; English says I hope so.',
    },
    ok: 'so ersetzt einen ganzen Satz nach hope, think, expect: I hope so (= ich hoffe es). Verneint: I hope not. || so replaces a whole clause after hope, think, expect: I hope so. Negative: I hope not.',
  },

  // ================= wf =================
  {
    k: 'wf', p: 'lx.wf-noun', lv: 'B2', dom: 'biz',
    t: 'Thank you for your ___ while we fix the problem with the payment system.',
    stem: 'PATIENT', a: ['patience'], pos: 'noun', parts: { base: 'patient', suf: ['ce'], change: 't → ce' },
    fam: ['patient', 'patience', 'patiently', 'impatient'],
    w: {
      patient: '„patient“ ist ein Adjektiv (oder „der Patient“); nach „your“ ist hier die Geduld gemeint. || “patient” is an adjective (or a person in hospital); the sentence means the quality.',
      patiently: '„patiently“ ist ein Adverb; nach „your“ steht ein Nomen. || “patiently” is an adverb; a noun follows “your”.',
      impatient: '„impatient“ ist ein Adjektiv und heißt das Gegenteil. || “impatient” is an adjective with the opposite meaning.',
    },
    ok: 'Nach „your“ steht ein Nomen: patient → patience (das t wird zu ce) = die Geduld. || A noun follows “your”: patient → patience (t becomes ce).',
  },
  {
    k: 'wf', p: 'lx.wf-adj', lv: 'B2+', dom: 'biz',
    t: 'Luckily, the figures in this report are fully ___ with the numbers that finance sent us last week.',
    stem: 'CONSIST', a: ['consistent'], pos: 'adj', parts: { base: 'consist', suf: ['ent'] },
    fam: ['consist', 'consistent', 'consistency', 'consistently'],
    w: {
      consist: '„consist“ ist ein Verb (consist of = bestehen aus); nach „are fully“ steht ein Adjektiv. || “consist” is a verb (consist of); an adjective follows “are fully”.',
      consistency: '„consistency“ ist ein Nomen; nach „are fully“ steht ein Adjektiv. || “consistency” is a noun; an adjective follows “are fully”.',
      consistently: '„consistently“ ist ein Adverb; nach „are fully“ steht ein Adjektiv. || “consistently” is an adverb; an adjective follows “are fully”.',
    },
    ok: 'Nach „are fully“ steht ein Adjektiv: consist + -ent = consistent (stimmig). consistent with = übereinstimmend mit. || An adjective follows “are fully”: consist + -ent = consistent. consistent with = matching.',
  },
  {
    k: 'wf', p: 'lx.wf-adv', lv: 'B2+', dom: 'life',
    t: 'My daughter learned to swim ___ quickly and now wants to join a swimming club.',
    stem: 'ASTONISH', a: ['astonishingly'], pos: 'adv', parts: { base: 'astonish', suf: ['ing', 'ly'] },
    fam: ['astonish', 'astonishing', 'astonishingly', 'astonished'],
    w: {
      astonishing: '„astonishing“ ist ein Adjektiv; vor „quickly“ steht ein Adverb. || “astonishing” is an adjective; an adverb goes before “quickly”.',
      astonished: '„astonished“ heißt „erstaunt“ (ein Gefühl); vor „quickly“ steht ein Adverb. || “astonished” describes a feeling; an adverb goes before “quickly”.',
      astonish: '„astonish“ ist ein Verb; vor „quickly“ steht ein Adverb. || “astonish” is a verb; an adverb goes before “quickly”.',
    },
    ok: 'Vor einem Adverb (quickly) steht ein Adverb: astonish + -ing + -ly = astonishingly (erstaunlich). || An adverb goes before another adverb (quickly): astonish + -ing + -ly = astonishingly.',
  },
  {
    k: 'wf', p: 'lx.wf-neg', lv: 'B2+', dom: 'biz',
    t: 'Printing every e-mail is ___ and expensive, so please only print what you really need.',
    stem: 'PRACTICAL', a: ['impractical', 'unpractical'], pos: 'adj', parts: { pre: 'im', base: 'practical' },
    fam: ['practical', 'impractical', 'unpractical', 'practically'],
    w: {
      practical: '„practical“ heißt praktisch; der Satz meint das Gegenteil (und teuer, also nur drucken, was nötig ist). || “practical” means useful; the sentence means the opposite.',
      practically: '„practically“ ist ein Adverb (fast); nach „is“ steht ein Adjektiv. || “practically” is an adverb (almost); an adjective follows “is”.',
    },
    ok: 'Nach „is“ steht ein Adjektiv mit verneintem Sinn: im- + practical = impractical (unpraktisch); unpractical ist seltener, gilt aber auch. || An adjective with a negative meaning follows “is”: im- + practical = impractical; unpractical is rarer but also accepted.',
  },
  {
    k: 'wf', p: 'lx.wf-noun', lv: 'B2', dom: 'biz',
    t: 'All ___ must sign in at the front desk and wear a badge at all times.',
    stem: 'VISIT', a: ['visitors'], pos: 'noun', parts: { base: 'visit', suf: ['or', 's'] },
    fam: ['visit', 'visitor', 'visitors', 'visiting'],
    w: {
      visitor: 'Nach „All“ steht hier der Plural: visitors. || After “All” the plural is needed here: visitors.',
      visit: '„visit“ ist der Besuch, nicht die Person; der Satz meint Personen. || “visit” is the event, not the person; the sentence means people.',
      visiting: '„visiting“ ist eine Verbform; nach „All“ steht ein Nomen im Plural. || “visiting” is a verb form; a plural noun follows “All”.',
    },
    ok: 'Personen, die etwas tun: visit + -or = visitor (Besucher); nach „All“ im Plural: visitors. || People who do something: visit + -or = visitor; after “All” in the plural: visitors.',
  },
  {
    k: 'wf', p: 'lx.wf-verb', lv: 'B2+', dom: 'biz',
    t: 'We need to ___ our position in the Asian market before our competitors do.',
    stem: 'STRONG', a: ['strengthen'], pos: 'verb', parts: { base: 'strong', suf: ['th', 'en'], change: 'o → e' },
    fam: ['strong', 'strength', 'strengthen', 'strongly'],
    w: {
      strong: '„strong“ ist ein Adjektiv; nach „need to“ steht ein Verb. || “strong” is an adjective; a verb follows “need to”.',
      strength: '„strength“ ist ein Nomen (die Stärke); nach „need to“ steht ein Verb. || “strength” is a noun; a verb follows “need to”.',
      strongly: '„strongly“ ist ein Adverb; nach „need to“ steht ein Verb. || “strongly” is an adverb; a verb follows “need to”.',
    },
    ok: 'Nach „need to“ steht ein Verb: strong → strength (o wird e) → strengthen (stärken). || A verb follows “need to”: strong → strength (o becomes e) → strengthen.',
  },
  {
    k: 'wf', p: 'lx.wf-adj', lv: 'B2', dom: 'life',
    t: 'The hotel staff were extremely ___ when my luggage got lost at the airport.',
    stem: 'HELP', a: ['helpful'], pos: 'adj', parts: { base: 'help', suf: ['ful'] },
    fam: ['help', 'helpful', 'helpless', 'helpfully'],
    w: {
      helpless: '„helpless“ heißt hilflos; gemeint ist, dass das Personal geholfen hat. || “helpless” means unable to help yourself; the sentence means the staff helped.',
      help: '„help“ ist ein Nomen oder Verb; nach „were extremely“ steht ein Adjektiv. || “help” is a noun or verb; an adjective follows “were extremely”.',
      helpfully: '„helpfully“ ist ein Adverb; nach „were extremely“ steht ein Adjektiv. || “helpfully” is an adverb; an adjective follows “were extremely”.',
    },
    ok: 'Nach „were extremely“ steht ein Adjektiv: help + -ful = helpful (hilfsbereit). || An adjective follows “were extremely”: help + -ful = helpful.',
  },

  // ================= kwt =================
  {
    k: 'kwt', p: 'psp.since-for', lv: 'B2', dom: 'life',
    lead: 'I last spoke to my cousin in Toronto in March.', key: 'SPOKEN',
    before: 'I', after: 'my cousin in Toronto since March.', a: ['have not'], b: ['spoken to', 'spoken with'], x: ['did', 'speak', 'was'],
    traps: [
      ['have not spoken', 'Es fehlt to: spoken to my cousin.', 'to is missing: spoken to my cousin.'],
      ['had not spoken to', 'Bis heute gilt das Present Perfect: have not spoken to, nicht had.', 'Up to now needs the present perfect: have not spoken to, not had.'],
    ],
    ok: ['Teil 1: have not, Present Perfect für „bis heute nicht“. Teil 2: spoken to, mit since March.', 'Part 1: have not, the present perfect for “not up to now”. Part 2: spoken to, with since March.'],
  },
  {
    k: 'kwt', p: 'fut.perf-cont', lv: 'C1', dom: 'life',
    lead: 'Next March it will be ten years since my parents started living in Spain.', key: 'BEEN',
    before: 'By next March, my parents', after: 'in Spain for ten years.', a: ['will have'], b: ['been living'], x: ['be', 'lived', 'are'],
    traps: [
      ['will have been live', 'Nach been steht hier -ing: been living.', 'been is followed by -ing here: been living.'],
      ['have been living', 'Es geht um einen Zeitpunkt in der Zukunft (By next March): will have been living.', 'This is about a point in the future (By next March): will have been living.'],
    ],
    ok: ['Dauer bis zu einem Zeitpunkt in der Zukunft: will have been + -ing. Teil 1: will have. Teil 2: been living.', 'Duration up to a point in the future: will have been + -ing. Part 1: will have. Part 2: been living.'],
  },
  {
    k: 'kwt', p: 'cn.if-words', lv: 'B2+', dom: 'biz',
    lead: 'We will deliver on Monday, but only if you pay the invoice this week.', key: 'PROVIDED',
    before: 'We will deliver on Monday', after: 'the invoice this week.', a: ['provided'], b: ['that you pay', 'you pay'], x: ['if', 'only', 'paying'],
    traps: [
      ['provided you will pay', 'Nach provided steht kein will: you pay.', 'No will after provided: you pay.'],
      ['provided that you will pay', 'Nach provided that steht kein will: you pay.', 'No will after provided that: you pay.'],
    ],
    ok: ['provided (that) = nur wenn, unter der Bedingung. Teil 1: provided. Teil 2: that you pay, in der Gegenwart, ohne will.', 'provided (that) = only if. Part 1: provided. Part 2: that you pay, in the present, without will.'],
  },
  {
    k: 'kwt', p: 'rs.request', lv: 'B2+', dom: 'biz',
    lead: 'Ms. Lee said to Tom: “Please send me the updated price list.”', key: 'ASKED',
    before: 'Ms. Lee', after: 'the updated price list.', a: ['asked Tom'], b: ['to send her', 'to send'], x: ['said', 'told', 'for'],
    tiles: ['Tom', 'to', 'send', 'her'],
    traps: [
      ['asked Tom send her', 'Nach asked + Person steht to + Grundform: to send.', 'asked + person is followed by to + base form: to send.'],
      ['asked Tom sending her', 'Nach asked + Person steht to + Grundform, nicht -ing.', 'asked + person is followed by to + base form, not -ing.'],
    ],
    ok: ['Bitte in indirekter Rede: asked + Person + to + Grundform. Teil 1: asked Tom. Teil 2: to send her.', 'A request in reported speech: asked + person + to + base form. Part 1: asked Tom. Part 2: to send her.'],
  },
  {
    k: 'kwt', p: 'vp.stop-try', lv: 'B2+', dom: 'biz',
    lead: 'On the way to the airport, Tom pulled over for a moment so that he could call the client.', key: 'STOPPED',
    before: 'On the way to the airport, Tom', after: '.', a: ['stopped'], b: ['to call the client', 'to phone the client'],
    v: [{ a: ['stopped briefly'], b: ['to call the client', 'to phone the client'] }], x: ['calling', 'for', 'had'],
    traps: [
      ['stopped calling the client', 'stopped calling heißt „hörte auf anzurufen“; gemeint ist „hielt an, um anzurufen“: stopped to call.', 'stopped calling means he quit calling; the sentence means he stopped in order to call: stopped to call.'],
      ['stopped for calling the client', 'Deutsch „zum Anrufen“; „um zu“ heißt to + Grundform: stopped to call.', 'German “zum Anrufen”; a purpose is to + base form: stopped to call.'],
    ],
    ok: ['stop + to = anhalten, um etwas zu tun. Teil 1: stopped. Teil 2: to call the client.', 'stop + to = stop in order to do something. Part 1: stopped. Part 2: to call the client.'],
  },
];
