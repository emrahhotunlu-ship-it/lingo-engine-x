// P43 Prüfungsvorrat Kapitel 3 (Bedingung und Wunsch): conditionals, cond-alt, mixed-cond, c1-diplomacy.
// Reihenfolge je Thema: ocl · kwt · err · ocl · kwt · err · ocl · kwt.
export const items = [
  // ================= conditionals =================
  {
    k: 'ocl', p: 'cn.zero', lv: 'B2', dom: 'life', cls: 'conj', a: ['If', 'When', 'Whenever', 'if', 'when', 'whenever'],
    t: '___ you press and hold the power button for ten seconds, the device always restarts.',
    c: {
      Would: 'Would eröffnet eine Frage, hier steht aber eine Aussage. || Would opens a question, but this is a statement.',
      Despite: 'Despite braucht ein Nomen oder -ing, keinen ganzen Satz mit you press. || Despite needs a noun or -ing, not a whole clause like you press.',
      During: 'During steht vor einer Phase und nicht vor einem Satz. || During goes before a phase and not before a clause.',
    },
    ok: 'Eine feste Regel oder ein Naturgesetz: If/When + Present Simple, Present Simple (Zero Conditional). || A fixed rule or law: If/When + present simple, present simple (zero conditional).',
  },
  {
    k: 'kwt', p: 'cn.first', lv: 'B2', dom: 'biz',
    lead: 'Whether we ship tomorrow depends on the supplier confirming by noon.', key: 'IF',
    before: 'We', after: 'the supplier confirms by noon.', a: ['will ship'], b: ['tomorrow if', 'tomorrow only if'], v: [{ a: ['will only ship'], b: ['tomorrow if'] }], x: ['would', 'shipped', 'when'],
    traps: [['ship tomorrow if', 'Im Hauptsatz des First Conditional steht will: will ship.', 'The main clause of the first conditional takes will: will ship.']],
    ok: ['Teil 1: will ship, im Hauptsatz steht will. Teil 2: tomorrow if, danach folgt der if-Satz mit dem Present Simple.', 'Part 1: will ship, the main clause takes will. Part 2: tomorrow if, the if clause with the present simple follows.'],
  },
  {
    k: 'err', p: 'cn.second', lv: 'B2', dom: 'life',
    text: 'If I would live closer to the office, I would cycle to work every day instead of driving.',
    bad: { span: 'would live', fix: ['lived'], ch: ['will live', 'am living'] },
    ok: ['Second Conditional: if + Past Simple, would + Grundform. Im if-Satz steht kein would: If I lived …', 'Second conditional: if + past simple, would + base form. No would in the if clause: If I lived …'],
    c1: ['Im if-Satz steht kein will; für Unwirkliches nutzt man die Vergangenheit.', 'No will in the if clause; for unreal situations the past is used.'],
    c2: ['am living ist Gegenwart; für etwas Unwirkliches braucht der if-Satz die Vergangenheit.', 'am living is present; for something unreal the if clause needs the past.'],
  },
  {
    k: 'ocl', p: 'cn.were', lv: 'B2', dom: 'life', cls: 'aux', a: ['were'],
    t: 'If I ___ you, I would talk to my manager before accepting the new role.',
    c: {
      am: 'am passt nicht zu einem Ratschlag in der Möglichkeitsform; es gilt If I were you. || am does not fit advice in the hypothetical; the rule is If I were you.',
      be: 'be allein steht nicht nach If I; der Ratschlag braucht were. || be alone does not follow If I; advice needs were.',
      would: 'would steht im Hauptsatz, nicht im if-Satz. || would belongs in the main clause, not in the if clause.',
    },
    ok: 'If I were you: Ratschlag in der Möglichkeitsform, mit were für alle Personen. || If I were you: advice in the hypothetical, with were for all persons.',
  },
  {
    k: 'kwt', p: 'cn.third', lv: 'B2+', dom: 'biz',
    lead: 'We did not test the update earlier, so the bug stayed in the product.', key: 'HAD',
    before: 'The bug would have been found if we', after: 'earlier.', a: ['had tested'], b: ['the update'], x: ['would', 'have', 'testing'],
    traps: [['had test the update', 'Nach had steht das Partizip: tested.', 'The participle follows had: tested.']],
    ok: ['Teil 1: had tested, im if-Satz des Third Conditional steht had + Partizip. Teil 2: the update, danach folgt das Objekt.', 'Part 1: had tested, the if clause of the third conditional takes had + participle. Part 2: the update, the object follows.'],
  },
  {
    k: 'err', p: 'cn.if-words', lv: 'B2+', dom: 'biz',
    text: 'We will agree to the discount provided that you will order at least five hundred units.',
    bad: { span: 'you will order', fix: ['you order'], ch: ['you would order', 'you ordered'] },
    ok: ['Nach provided that steht wie nach if das Present Simple, nicht will: provided that you order.', 'After provided that the present simple is used, as after if, not will: provided that you order.'],
    c1: ['would order gehört in eine unwirkliche Bedingung, hier geht es um die Zukunft.', 'would order belongs to an unreal condition, but this is about the future.'],
    c2: ['ordered verschiebt es in die Vergangenheit; der Satz meint aber die Zukunft.', 'ordered moves it to the past, but the sentence means the future.'],
  },
  {
    k: 'ocl', p: 'cn.first', lv: 'B2', dom: 'life', cls: 'aux', a: ['does'],
    t: 'If the weather ___ not improve by tomorrow, we will move the barbecue indoors.',
    c: {
      will: 'Nach if steht kein will; im if-Satz gilt die Gegenwart. || No will follows if; the present is used in the if clause.',
      did: 'did würde die Vergangenheit meinen; der Satz handelt von morgen. || did would mean the past, but the sentence is about tomorrow.',
      is: 'is not improve gibt es nicht; vor der Grundform steht does. || is not improve does not exist; the base form needs does.',
    },
    ok: 'First Conditional: if + Present Simple, will + Grundform. Im if-Satz steht kein will: If the weather does not improve … || First conditional: if + present simple, will + base form. No will in the if clause: If the weather does not improve …',
  },
  {
    k: 'kwt', p: 'cn.if-words', lv: 'B2+', dom: 'biz',
    lead: 'We can only start the migration if the client approves the schedule first.', key: 'UNLESS',
    before: 'We', after: 'the client approves the schedule.', a: ['cannot start'], b: ['the migration unless'], v: [{ a: ["can't start"], b: ['the migration unless'] }], x: ['until', 'if', 'without'],
    nc: true,
    traps: [['cannot start migration unless', 'Der Artikel fehlt: the migration.', 'The article is missing: the migration.']],
    ok: ['Teil 1: cannot start, die Verneinung steckt schon im Hauptsatz. Teil 2: the migration unless, unless bedeutet „wenn nicht“ und braucht keine zweite Verneinung.', 'Part 1: cannot start, the negation is already in the main clause. Part 2: the migration unless, unless means “if not” and needs no second negation.'],
  },

  // ================= cond-alt =================
  {
    k: 'ocl', p: 'ca.unless', lv: 'B2', dom: 'life', cls: 'conj', a: ['unless'],
    t: 'We will go for a walk after dinner ___ it starts to rain heavily.',
    c: {
      despite: 'despite braucht ein Nomen oder -ing, keinen ganzen Satz. || despite needs a noun or -ing, not a whole clause.',
      whereas: 'whereas stellt zwei Dinge gegenüber und passt nicht zu einer Ausnahme. || whereas contrasts two things and does not fit an exception.',
      during: 'during steht vor einer Phase und nicht vor einem Satz. || during goes before a phase and not before a clause.',
    },
    ok: 'unless nennt die einzige Ausnahme („wenn nicht“): Wir gehen, außer es regnet stark. || unless names the only exception (“if not”): we go, except if it rains heavily.',
  },
  {
    k: 'kwt', p: 'ca.as-long-as', lv: 'B2', dom: 'biz',
    lead: 'We will go ahead with the launch only if the client approves the draft.', key: 'LONG',
    before: 'We will go ahead with the launch', after: 'the draft.', a: ['as long'], b: ['as the client approves'], v: [{ a: ['so long'], b: ['as the client approves'] }], x: ['unless', 'if', 'when'],
    traps: [['as long as the client approved', 'Nach as long as steht die Gegenwart (approves), nicht die Vergangenheit.', 'The present (approves) follows as long as, not the past.']],
    ok: ['Teil 1: as long, damit beginnt as long as („solange“, „sofern“). Teil 2: as the client approves, danach steht die Gegenwart, kein will.', 'Part 1: as long, that starts as long as (“provided that”). Part 2: as the client approves, the present follows, no will.'],
  },
  {
    k: 'err', p: 'ca.otherwise', lv: 'B2', dom: 'biz',
    text: 'Please sign the contract today, else we cannot start the project before the end of the month.',
    bad: { span: 'else', fix: ['otherwise', 'or else', 'or'], ch: ['besides', 'instead'] },
    ok: ['Deutsch „sonst“ heißt otherwise (oder or else). else allein ist nach einem Komma kein Bindewort.', 'German “sonst” is otherwise (or or else). else alone is not a conjunction after a comma.'],
    c1: ['besides heißt „außerdem“, nicht „sonst“.', 'besides means “in addition”, not “or else”.'],
    c2: ['instead heißt „stattdessen“ und passt nicht in diesen Satz.', 'instead means “in place of” and does not fit this sentence.'],
  },
  {
    k: 'ocl', p: 'ca.in-case', lv: 'B2', dom: 'biz', cls: 'prep', a: ['in'],
    t: 'Bring a printed copy of the slides ___ case the projector does not work.',
    c: {
      on: 'on case gibt es nicht in dieser Bedeutung; die feste Wendung ist in case. || on case does not exist in this meaning; the fixed phrase is in case.',
      at: 'at case ist keine feste Wendung; es heißt in case. || at case is not a fixed phrase; it is in case.',
      by: 'by case ist keine feste Wendung; es heißt in case. || by case is not a fixed phrase; it is in case.',
    },
    ok: 'in case bedeutet „für den Fall, dass“ und beschreibt eine Vorsichtsmaßnahme. || in case means “just in case” and describes a precaution.',
  },
  {
    k: 'kwt', p: 'ca.but-for', lv: 'C1', dom: 'biz',
    lead: 'Without your help, the launch would have failed.', key: 'BUT',
    before: 'The launch would have failed', after: '.', a: ['but for'], b: ['your help', 'you'], x: ['without', 'if', 'unless'],
    traps: [['but for you helped', 'Nach but for steht ein Nomen (your help), kein ganzer Satz.', 'A noun (your help) follows but for, not a whole clause.']],
    ok: ['Teil 1: but for, damit sagst du „ohne“ in der Rückschau. Teil 2: your help, nach but for folgt ein Nomen.', 'Part 1: but for, that is how you say “without” looking back. Part 2: your help, a noun follows but for.'],
  },
  {
    k: 'err', p: 'ca.inversion', lv: 'C1', dom: 'biz',
    text: 'Had we known about the delay, we had rescheduled the launch and informed the client in time.',
    bad: { span: 'we had rescheduled', fix: ['we would have rescheduled', "we'd have rescheduled"], ch: ['we would reschedule', 'would we have rescheduled'] },
    ok: ['Der Hauptsatz einer unwirklichen Bedingung in der Vergangenheit: would have + Partizip. had steht nur im Had-we-known-Teil.', 'The main clause of an unreal past condition: would have + participle. had only stands in the Had-we-known part.'],
    c1: ['would reschedule wäre Gegenwart oder Zukunft; hier geht es um etwas Vergangenes.', 'would reschedule would be present or future; this is about the past.'],
    c2: ['would we have rescheduled stellt die Wörter um; die Umstellung gehört nur in den ersten Teil.', 'would we have rescheduled inverts the words; the inversion belongs only in the first part.'],
  },
  {
    k: 'ocl', p: 'ca.as-long-as', lv: 'B2', dom: 'biz', cls: 'conj', a: ['as'],
    t: 'You can work from home on Fridays as long ___ your calendar stays up to date.',
    c: {
      if: 'as long if gibt es nicht; die Wendung ist as long as. || as long if does not exist; the phrase is as long as.',
      than: 'as long than gibt es nicht; die Wendung ist as long as. || as long than does not exist; the phrase is as long as.',
      that: 'as long that gibt es nicht; die Wendung ist as long as. || as long that does not exist; the phrase is as long as.',
    },
    ok: 'as long as bedeutet „solange“ oder „sofern“ und nennt eine Bedingung. Danach steht die Gegenwart. || as long as means “provided that” and names a condition. The present follows.',
  },
  {
    k: 'kwt', p: 'ca.in-case', lv: 'B2', dom: 'life',
    lead: 'The forecast might be wrong, so I will take an umbrella just to be safe.', key: 'CASE',
    before: 'I will take an umbrella', after: 'wrong.', a: ['in case'], b: ['the forecast is'], x: ['if', 'unless', 'when'],
    traps: [['in case the forecast will be', 'Nach in case steht die Gegenwart, kein will.', 'The present follows in case, no will.']],
    ok: ['Teil 1: in case, so sagst du „für den Fall, dass“. Teil 2: the forecast is, danach folgt das Present Simple.', 'Part 1: in case, that is how you say “just in case”. Part 2: the forecast is, the present simple follows.'],
  },

  // ================= mixed-cond =================
  {
    k: 'ocl', p: 'mc.wish-now', lv: 'B2', dom: 'life', cls: 'aux', a: ['had'],
    t: 'I wish I ___ more time to practice the guitar, but my job keeps me busy every evening.',
    c: {
      have: 'Nach wish steht für die Gegenwart die Vergangenheit, nicht die Grundform have. || After wish the past is used for the present, not the base form have.',
      would: 'would more time ergibt keinen Satz; would braucht ein Verb. || would more time makes no sentence; would needs a verb.',
      will: 'will steht nicht nach wish; für einen Wunsch jetzt gilt die Vergangenheit. || will does not follow wish; a wish about now takes the past.',
    },
    ok: 'wish + Past Simple beschreibt einen Wunsch für jetzt, der nicht erfüllt ist: I wish I had. || wish + past simple describes a wish about now that is not fulfilled: I wish I had.',
  },
  {
    k: 'kwt', p: 'mc.wish-past', lv: 'B2+', dom: 'life',
    lead: 'I did not call my grandmother last week, and now I regret it.', key: 'WISH',
    before: 'I', after: 'my grandmother last week.', a: ['wish I', 'wish that I'], b: ['had called'], x: ['would', 'have', 'regret'], tiles: ['I', 'had', 'called'],
    traps: [['wish I would have called', 'Nach wish steht für Vergangenes had + Partizip, nicht would have.', 'After wish for the past had + participle is used, not would have.']],
    ok: ['Teil 1: wish I, so beginnt der Wunsch oder das Bedauern. Teil 2: had called, nach wish steht für Vergangenes had + Partizip.', 'Part 1: wish I, that is how the wish or regret begins. Part 2: had called, after wish the past takes had + participle.'],
  },
  {
    k: 'err', p: 'mc.high-time', lv: 'B2+', dom: 'biz',
    text: 'It is high time we hire a second developer, because the migration is already three months late.',
    bad: { span: 'we hire', fix: ['we hired'], ch: ['we would hire', 'we will hire'] },
    ok: ['Nach It is high time steht die Vergangenheit, auch wenn es um jetzt geht: It is high time we hired. Das drückt Dringlichkeit aus.', 'After It is high time the past is used, even though it is about now: It is high time we hired. It expresses urgency.'],
    c1: ['would hire passt nicht nach high time; hier genügt die einfache Vergangenheit.', 'would hire does not fit after high time; the simple past is enough here.'],
    c2: ['will hire steht nach It is high time nicht; es gilt die Vergangenheit.', 'will hire does not follow It is high time; the past is used.'],
  },
  {
    k: 'ocl', p: 'mc.wish-would', lv: 'B2', dom: 'life', cls: 'aux', a: ['would'],
    t: 'I wish our neighbors ___ stop playing loud music late at night; I cannot sleep.',
    c: {
      will: 'Nach wish steht would für Ärger über Verhalten, nicht will. || After wish would expresses annoyance at behavior, not will.',
      are: 'are stop gibt es nicht; wish + are passt nicht zu Ärger über andere. || are stop does not exist; wish + are does not fit annoyance at others.',
      had: 'had stop gibt es nicht; had braucht ein Partizip. || had stop does not exist; had needs a participle.',
    },
    ok: 'wish + would drückt aus, dass dich das Verhalten anderer ärgert und du Veränderung willst. || wish + would expresses that other people’s behavior annoys you and you want a change.',
  },
  {
    k: 'kwt', p: 'mc.past-cond', lv: 'B2+', dom: 'biz',
    lead: 'We did not invest in testing last year, and now we have many bugs.', key: 'HAD',
    before: 'We would have fewer bugs now if we', after: 'last year.', a: ['had invested'], b: ['in testing'], x: ['would', 'have', 'invest'],
    traps: [['had invest in testing', 'Nach had steht das Partizip: invested.', 'The participle follows had: invested.']],
    ok: ['Teil 1: had invested, der if-Satz beschreibt die Vergangenheit mit had + Partizip. Teil 2: in testing, danach folgt die Ergänzung.', 'Part 1: had invested, the if clause describes the past with had + participle. Part 2: in testing, the complement follows.'],
  },
  {
    k: 'err', p: 'mc.wish-past', lv: 'B2', dom: 'life',
    text: "I wish I had listened to my sister's advice before I bought that old car last spring.",
    bad: null,
    ok: ['Kein Fehler: wish + had + Partizip drückt Bedauern über Vergangenes aus: I wish I had listened.', 'No mistake: wish + had + participle expresses regret about the past: I wish I had listened.'],
    fa: [['had', 'had listened ist hier richtig, denn es geht um Vergangenes, das nicht mehr zu ändern ist.', 'had listened is right here, because it is about the past, which cannot be changed.']],
  },
  {
    k: 'ocl', p: 'mc.present-cond', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['were', 'was'],
    t: 'If our team ___ bigger, we would have won the bid last month instead of losing it to a competitor.',
    c: {
      is: 'is bigger passt nicht zu would have won; die Bedingung gilt für heute und ist unwirklich. || is bigger does not fit would have won; the condition applies to today and is unreal.',
      would: 'would steht im Hauptsatz, nicht im if-Satz. || would belongs in the main clause, not in the if clause.',
      had: 'had bigger gibt es nicht; had braucht ein Partizip. || had bigger does not exist; had needs a participle.',
    },
    ok: 'Gemischte Bedingung: If + Past Simple (ein Zustand, der jetzt gilt), would have + Partizip (Folge in der Vergangenheit). || Mixed conditional: If + past simple (a state that holds now), would have + participle (a result in the past).',
  },
  {
    k: 'kwt', p: 'mc.inversion', lv: 'C1', dom: 'biz',
    lead: 'We did not hire another developer, so the migration is not finished yet.', key: 'HAD',
    before: 'The migration would be finished by now', after: '.', a: ['had we'], b: ['hired another developer'], v: [{ a: ['if we had'], b: ['hired another developer'] }], x: ['would', 'have', 'been'],
    traps: [['had we hire another developer', 'Nach had we steht das Partizip: hired.', 'The participle follows had we: hired.']],
    ok: ['Teil 1: had we, die Umstellung ersetzt if: Had we hired … Teil 2: hired another developer, danach folgt das Partizip.', 'Part 1: had we, the inversion replaces if: Had we hired … Part 2: hired another developer, the participle follows.'],
  },

  // ================= c1-diplomacy =================
  {
    k: 'ocl', p: 'dip.wondering', lv: 'B2+', dom: 'biz', cls: 'conj', a: ['if', 'whether'],
    t: 'I was wondering ___ you could confirm the venue and the catering for next Thursday.',
    c: {
      could: 'Nach I was wondering folgt if oder whether, keine Frageform mit could. || I was wondering is followed by if or whether, not a question form with could.',
      that: 'that passt nicht, weil es eine Frage und keine Aussage ist. || that does not fit, because this is a question and not a statement.',
      do: 'do passt nicht; die indirekte Frage braucht if oder whether. || do does not fit; the indirect question needs if or whether.',
    },
    ok: 'I was wondering if … macht die Bitte weich: if oder whether leitet die indirekte Frage ein. || I was wondering if … makes the request soft: if or whether introduces the indirect question.',
  },
  {
    k: 'kwt', p: 'dip.possible', lv: 'B2+', dom: 'biz',
    lead: 'Please resend the invoice with the correct VAT number.', key: 'POSSIBLE',
    before: '', after: 'resend the invoice with the correct VAT number?', a: ['would it be', 'is it'], b: ['possible to'], x: ['could', 'if', 'wonder'],
    traps: [['would it be possible that', 'Nach possible steht to + Grundform, kein that-Satz.', 'To + base form follows possible, not a that clause.']],
    ok: ['Teil 1: would it be, die Frageform macht die Bitte höflich. Teil 2: possible to, danach steht die Grundform.', 'Part 1: would it be, the question form makes the request polite. Part 2: possible to, the base form follows.'],
  },
  {
    k: 'err', p: 'dip.hoping', lv: 'B2+', dom: 'biz',
    text: 'We were hoping to getting your feedback on the draft before the end of the week.',
    bad: { span: 'to getting', fix: ['to get'], ch: ['getting', 'for getting'] },
    ok: ['Nach hoping folgt to + Grundform: hoping to get. Die -ing-Form passt hier nicht.', 'To + base form follows hoping: hoping to get. The -ing form does not fit here.'],
    c1: ['getting allein lässt to weg; hope verlangt to + Grundform.', 'getting alone leaves out to; hope requires to + base form.'],
    c2: ['for getting passt nicht zu hope; hier folgt to + Grundform.', 'for getting does not fit hope; to + base form follows here.'],
  },
  {
    k: 'ocl', p: 'dip.understate', lv: 'B2+', dom: 'biz', cls: 'prep', a: ['of'],
    t: 'Delivering by Friday would be a bit ___ a stretch for our team, to be honest.',
    c: {
      from: 'a bit from a challenge gibt es nicht; die Wendung ist a bit of a. || a bit from a challenge does not exist; the phrase is a bit of a.',
      than: 'than steht nach einem Komparativ, nicht nach a bit. || than follows a comparative, not a bit.',
      for: 'a bit for a challenge ist keine feste Wendung. || a bit for a challenge is not a fixed phrase.',
    },
    ok: 'a bit of a challenge ist eine höfliche Untertreibung für einen echten Einwand. || a bit of a challenge is a polite understatement for a real objection.',
  },
  {
    k: 'kwt', p: 'dip.wondering', lv: 'B2+', dom: 'biz',
    lead: 'Please send me the agenda for the meeting before Friday.', key: 'COULD',
    before: 'I was wondering', after: 'me the agenda for the meeting before Friday.', a: ['whether you'], b: ['could send'], v: [{ a: ['if you'], b: ['could send'] }], x: ['can', 'would', 'sending'],
    traps: [['whether could you send', 'Nach whether steht die normale Wortstellung: you could send.', 'Normal word order follows whether: you could send.']],
    ok: ['Teil 1: whether you, die indirekte Frage hat normale Wortstellung. Teil 2: could send, could macht die Bitte höflich.', 'Part 1: whether you, the indirect question has normal word order. Part 2: could send, could makes the request polite.'],
  },
  {
    k: 'err', p: 'dip.possible', lv: 'B2', dom: 'biz',
    text: 'Would it be possible to move our call to Thursday afternoon, if that suits your calendar?',
    bad: null,
    ok: ['Kein Fehler: Would it be possible to … + Grundform ist die höfliche Standardfrage.', 'No mistake: Would it be possible to … + base form is the polite standard question.'],
    fa: [['possible', 'possible to move ist hier richtig; nach possible folgt to + Grundform.', 'possible to move is right here; to + base form follows possible.']],
  },
  {
    k: 'ocl', p: 'dip.hoping', lv: 'B2+', dom: 'biz', cls: 'aux', a: ['would', 'might'],
    t: 'We were hoping you ___ be able to share the draft with us before the end of the week.',
    c: {
      is: 'is be able gibt es nicht; nach were hoping steht would. || is be able does not exist; would follows were hoping.',
      can: 'can be able ist doppelt; außerdem fehlt die Zeitenfolge nach were hoping. || can be able is doubled; also the tense sequence after were hoping is missing.',
      do: 'do be able gibt es nicht; nach were hoping steht would. || do be able does not exist; would follows were hoping.',
    },
    ok: 'We were hoping you would … drückt einen höflichen Wunsch aus; would rückt die Bitte in die Ferne. || We were hoping you would … expresses a polite wish; would puts distance on the request.',
  },
  {
    k: 'kwt', p: 'dip.understate', lv: 'B2+', dom: 'biz',
    lead: 'The new deadline is a serious problem for our team.', key: 'BIT',
    before: 'The new deadline is', after: 'for our team.', a: ['a bit'], b: ['of a challenge', 'of a problem', 'of an issue'], x: ['little', 'very', 'much'],
    traps: [['a bit a challenge', 'Nach a bit steht of: a bit of a challenge.', 'Of follows a bit: a bit of a challenge.']],
    ok: ['Teil 1: a bit macht die Aussage milder. Teil 2: of a challenge, die feste Wendung heißt a bit of a …', 'Part 1: a bit makes the statement milder. Part 2: of a challenge, the fixed phrase is a bit of a …'],
  },
];
