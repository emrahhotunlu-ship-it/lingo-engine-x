"""Weitere Begründungen je Ablenker (P37, Einstufung, neue Texte): Text -> {Ablenker: (de, en)}."""

R2 = {
    'The supplier ___ well refuse to change the delivery date at this stage.': {
        'must': ('must well gibt es nicht, die feste Verstärkung ist may well, might well oder could well.', 'must well does not exist, the fixed strengthening is may well, might well or could well.'),
        'would': ('would well ist keine feste Wendung für eine Möglichkeit.', 'would well is not a fixed phrase for a possibility.'),
        'shall': ('shall well gibt es nicht, es braucht may, might oder could.', 'shall well does not exist, it needs may, might or could.')},
    'This ___ well be the warmest fall we have had in years.': {
        'must': ('must well ist keine feste Verbindung, es braucht could, may oder might.', 'must well is not a fixed combination, it needs could, may or might.'),
        'will': ('will well drückt keine Möglichkeit aus, es braucht could, may oder might.', 'will well expresses no possibility, it needs could, may or might.'),
        'shall': ('shall well gibt es nicht, es braucht could, may oder might.', 'shall well does not exist, it needs could, may or might.')},
    'Someone is bound ___ ask about the price sooner or later.': {
        'for': ('bound for heißt „unterwegs nach“, hier folgt aber eine Grundform.', 'bound for means “heading to”, but a base form follows here.'),
        'at': ('at passt nicht vor eine Grundform, es braucht to.', 'at does not fit before a base form, it needs to.'),
        'on': ('on passt nicht vor eine Grundform, es braucht to.', 'on does not fit before a base form, it needs to.')},
    'The delay is unlikely ___ affect the launch date.': {
        'for': ('for gibt es nach unlikely nicht, es folgt to + Grundform.', 'for does not follow unlikely, to + base form does.'),
        'of': ('of gibt es nach unlikely nicht, es folgt to + Grundform.', 'of does not follow unlikely, to + base form does.'),
        'at': ('at passt nicht vor eine Grundform, es braucht to.', 'at does not fit before a base form, it needs to.')},
    'It is highly likely ___ the board will approve the plan next week.': {
        'to': ('Mit it am Anfang folgt ein that-Satz, kein to-Infinitiv.', 'With it at the start a that-clause follows, not a to-infinitive.'),
        'if': ('if heißt „ob“ oder „falls“ und nennt hier keine Wahrscheinlichkeit.', 'if means “whether” or “in case” and names no probability here.'),
        'which': ('which bezieht sich auf ein Nomen, hier folgt aber ein ganzer Satz.', 'which refers to a noun, but a whole clause follows here.')},
    'There is only a slim chance ___ finding a table without a booking.': {
        'on': ('on passt nicht zu chance, die feste Verbindung ist chance of.', 'on does not fit chance, the fixed combination is chance of.'),
        'at': ('at passt nicht zu chance, die feste Verbindung ist chance of.', 'at does not fit chance, the fixed combination is chance of.'),
        'by': ('by nennt einen Urheber, nach chance steht of.', 'by names an agent, after chance comes of.')},
    'Our clients are ___ requesting flexible payment terms, and we have to react.': {
        'increase': ('increase ist ein Verb oder Nomen, hier steht ein Adverb vor requesting.', 'increase is a verb or noun, but an adverb stands before requesting here.'),
        'increased': ('increased ist eine Verbform und kein Adverb.', 'increased is a verb form and not an adverb.'),
        'increasing': ('increasing ist ein Adjektiv, vor requesting braucht es ein Adverb.', 'increasing is an adjective, before requesting an adverb is needed.')},
    'We are ___ to hear from you by the end of the week.': {
        'hope': ('hope ist die Grundform, nach are braucht es hoping.', 'hope is the base form, after are hoping is needed.'),
        'hoped': ('hoped ist die 2. Form, nach are braucht es hoping.', 'hoped is the past form, after are hoping is needed.'),
        'hopeful': ('hopeful ist ein Adjektiv und verlangt hopeful of hearing.', 'hopeful is an adjective and would need hopeful of hearing.')},
    'He is always ___ about the coffee in the office, and everyone is tired of it.': {
        'complain': ('Nach is always braucht es die -ing-Form, nicht die Grundform.', 'After is always the -ing form is needed, not the base form.'),
        'complained': ('Nach is always braucht es die -ing-Form, nicht die 2. Form.', 'After is always the -ing form is needed, not the past form.'),
        'complains': ('Nach is steht kein Verb mit -s, es braucht die -ing-Form.', 'After is no verb with -s follows, the -ing form is needed.')},
    'The data center belongs ___ our parent company, so we need their approval.': {
        'for': ('belong for gibt es nicht, es heißt belong to.', 'belong for does not exist, it is belong to.'),
        'at': ('belong at gibt es nicht, es heißt belong to.', 'belong at does not exist, it is belong to.'),
        'of': ('belong of gibt es nicht, es heißt belong to.', 'belong of does not exist, it is belong to.')},
    'It is getting ___ harder to find an apartment in this city, even for a small family.': {
        'more': ('more harder ist doppelt gesteigert, harder steht schon im Komparativ.', 'more harder is doubly comparative, harder is already a comparative.'),
        'very': ('very steht nicht vor einem Komparativ, dort braucht es much, even oder far.', 'very does not stand before a comparative, much, even or far is needed there.'),
        'most': ('most gehört zum Superlativ, nicht vor harder.', 'most belongs to the superlative, not before harder.')},
    'My little sister is always ___ my things without asking.': {
        'borrow': ('Nach is always braucht es die -ing-Form, nicht die Grundform.', 'After is always the -ing form is needed, not the base form.'),
        'taken': ('taken ist ein Partizip und würde ein Passiv bilden, das ist nicht gemeint.', 'taken is a participle and would form a passive, which is not meant.'),
        'used': ('used ist ein Partizip und würde ein Passiv bilden, das ist nicht gemeint.', 'used is a participle and would form a passive, which is not meant.')},
    'The team was ___ to present the results on Monday, but the data was incomplete.': {
        'go': ('Nach was steht going, nicht go.', 'After was comes going, not go.'),
        'went': ('went ist die 2. Form und passt nicht hinter was.', 'went is the past form and does not fit after was.'),
        'gone': ('gone ist eine 3. Form und passt nicht zum Plan von damals.', 'gone is a participle and does not fit the plan from back then.')},
    'The auditors were about ___ present their findings when the fire alarm went off.': {
        'for': ('for gehört nicht zu about, hier folgt to + Grundform.', 'for does not go with about, to + base form follows here.'),
        'of': ('about of gibt es nicht, es heißt about to.', 'about of does not exist, it is about to.'),
        'at': ('about at gibt es nicht, es heißt about to.', 'about at does not exist, it is about to.')},
    'She started as an intern in 2014 and ___ later become our head of design.': {
        'will': ('will gehört in die Gegenwart, die Geschichte liegt aber in der Vergangenheit.', 'will belongs to the present, but the story lies in the past.'),
        'shall': ('shall wirkt hier altmodisch und passt nicht zur Erzählung.', 'shall sounds old-fashioned here and does not fit the narrative.'),
        'is': ('is braucht ein -ing oder eine 3. Form, hier folgt die Grundform become.', 'is needs an -ing or a participle, but the base form become follows.')},
    'The new system was ___ go live in October, but testing took longer.': {
        'for': ('was for gibt es hier nicht, es heißt was to.', 'was for does not exist here, it is was to.'),
        'at': ('was at gibt es hier nicht, es heißt was to.', 'was at does not exist here, it is was to.'),
        'on': ('was on gibt es hier nicht, es heißt was to.', 'was on does not exist here, it is was to.')},
    'My grandparents moved to Hamburg in 1960, where they ___ later open a small bakery.': {
        'will': ('will gehört in die Gegenwart, die Geschichte liegt aber in der Vergangenheit.', 'will belongs to the present, but the story lies in the past.'),
        'shall': ('shall wirkt hier altmodisch und passt nicht zur Erzählung.', 'shall sounds old-fashioned here and does not fit the narrative.'),
        'are': ('are braucht ein -ing oder eine 3. Form, hier folgt die Grundform open.', 'are needs an -ing or a participle, but the base form open follows.')},
    'The trip ___ to start on Friday, but the storm changed our plans.': {
        'is': ('is gehört in die Gegenwart, der Plan lag aber in der Vergangenheit.', 'is belongs to the present, but the plan lay in the past.'),
        'has': ('has to wäre Gegenwart, der Plan lag in der Vergangenheit (changed).', 'has to would be present, but the plan lay in the past (changed).'),
        'be': ('be allein bildet hier keine Vergangenheit, es braucht was.', 'be alone forms no past here, was is needed.')},
    'Neither ___ the two proposals fits our timeline, so we need a third option.': {
        'from': ('neither from gibt es nicht, es heißt neither of.', 'neither from does not exist, it is neither of.'),
        'to': ('neither to gibt es nicht, es heißt neither of.', 'neither to does not exist, it is neither of.'),
        'for': ('neither for gibt es nicht, es heißt neither of.', 'neither for does not exist, it is neither of.')},
    'We have ___ ever had a complaint about this product line.': {
        'nearly': ('nearly ever gibt es nicht, es heißt hardly ever.', 'nearly ever does not exist, it is hardly ever.'),
        'almost': ('almost ever gibt es nicht, es heißt almost never oder hardly ever.', 'almost ever does not exist, it is almost never or hardly ever.'),
        'none': ('none ist ein Pronomen und steht nicht vor ever.', 'none is a pronoun and does not stand before ever.')},
    'The old contract is no ___ valid because it expired in June.': {
        'later': ('no later heißt „nicht später“ und passt nicht zu valid.', 'no later means “not later” and does not fit valid.'),
        'farther': ('farther meint Entfernung, hier geht es um Zeit.', 'farther is about distance, but here it is about time.'),
        'shorter': ('no shorter vergleicht die Länge und nennt keinen Zeitpunkt.', 'no shorter compares length and names no point in time.')},
    'A large ___ of our customers have switched to the annual plan.': {
        'amount': ('amount steht nur vor nicht zählbaren Nomen, customers ist zählbar.', 'amount stands only before uncountable nouns, customers is countable.'),
        'deal': ('a great deal of steht vor nicht zählbaren Nomen, nicht mit large.', 'a great deal of stands before uncountable nouns, not with large.'),
        'quantity': ('quantity passt zu Waren, nicht zu Kunden.', 'quantity fits goods, not customers.')},
    'There is ___ any milk left, so I will go to the store.': {
        'nearly': ('nearly any gibt es nicht, es heißt hardly any.', 'nearly any does not exist, it is hardly any.'),
        'almost': ('almost any heißt „fast jede“ und passt hier nicht zu „kaum Milch“.', 'almost any means “nearly every” and does not fit “hardly any milk”.'),
        'none': ('none steht nicht vor any, es heißt hardly any.', 'none does not stand before any, it is hardly any.')},
    'I invited ten colleagues, but ___ of them could come on Saturday.': {
        'no': ('no of them gibt es nicht, es heißt none of them.', 'no of them does not exist, it is none of them.'),
        'nobody': ('nobody of them gibt es nicht, es heißt none of them.', 'nobody of them does not exist, it is none of them.'),
        'not': ('not of them gibt es nicht, es heißt none of them.', 'not of them does not exist, it is none of them.')},
    'We booked a ten-___ trip to Portugal for the summer vacation.': {
        'days': ('Vor einem Nomen bleibt die Maßangabe im Singular: ten-day.', 'Before a noun the measure stays singular: ten-day.'),
        'daily': ('daily heißt „täglich“ und nennt keine Dauer.', 'daily means “every day” and names no duration.'),
        'date': ('date heißt „Datum“ und nennt keine Dauer.', 'date means a calendar date and names no duration.')},
    'Is the café already closed? I hope ___, because I really need a coffee.': {
        'no': ('no ersetzt keinen Gedanken nach hope, dort steht not.', 'no does not replace a thought after hope, not does.'),
        'nor': ('nor verbindet zwei Verneinungen und ersetzt hier keinen Gedanken.', 'nor joins two negatives and does not replace a thought here.'),
        'never': ('never heißt „nie“ und ersetzt keinen Gedanken nach hope.', 'never means “never” and does not replace a thought after hope.')},
    'Given the current figures, this is bound ___ be our best year so far.': {
        'for': ('bound for heißt „unterwegs nach“, hier folgt aber eine Grundform.', 'bound for means “heading to”, but a base form follows here.'),
        'at': ('at passt nicht vor eine Grundform, es braucht to.', 'at does not fit before a base form, it needs to.'),
        'on': ('on passt nicht vor eine Grundform, es braucht to.', 'on does not fit before a base form, it needs to.')},
    'My bus was just about ___ leave when I reached the stop.': {
        'for': ('for gehört nicht zu about, hier folgt to + Grundform.', 'for does not go with about, to + base form follows here.'),
        'of': ('about of gibt es nicht, es heißt about to.', 'about of does not exist, it is about to.'),
        'at': ('about at gibt es nicht, es heißt about to.', 'about at does not exist, it is about to.')},
    'Our new intern ___ always forgetting to save his files, which drives the whole team crazy.': {
        'has': ('has verlangt eine 3. Form, nach always steht aber -ing: is always forgetting.', 'has needs a participle, but always is followed by -ing: is always forgetting.'),
        'does': ('does braucht die Grundform, hier steht aber forgetting.', 'does needs the base form, but forgetting stands here.'),
        'was': ('was liegt in der Vergangenheit, der Satz beschreibt aber jetzt.', 'was lies in the past, but the sentence describes now.')},
    'She told me that the shipment ___ already left the warehouse before the customer called.': {
        'has': ('has ist Präsens, der Satz erzählt aber von früher.', 'has is present, but the sentence tells about the past.'),
        'was': ('was verlangt hier ein -ing oder Passiv, left ist aber aktiv.', 'was would need an -ing or passive here, but left is active.'),
        'did': ('did braucht die Grundform, hier steht aber left.', 'did needs the base form, but left stands here.')},
    'The manager will call you back as soon as the test results ___ available.': {
        'will': ('Nach as soon as steht kein will, sondern die Gegenwart.', 'After as soon as there is no will, the present tense is used.'),
        'have': ('have passt nicht zu results ohne eine 3. Form danach.', 'have does not fit results without a participle after it.'),
        'were': ('were liegt in der Vergangenheit, gemeint ist aber die Zukunft.', 'were lies in the past, but the future is meant.')},
    'The new interface must be live ___ the end of the third quarter at the very latest.': {
        'until': ('until meint „bis dahin andauernd“, hier geht es um eine Frist.', 'until means “continuing up to then”, but here it is a deadline.'),
        'for': ('for nennt eine Dauer, keine Frist.', 'for names a duration, not a deadline.'),
        'at': ('at nennt einen Punkt, hier aber keine Frist.', 'at names a point, but here it is not a deadline.')},
    'If we ___ chosen the cheaper supplier last year, we would not be facing these delays now.': {
        'would': ('would steht nicht im if-Satz, dort braucht es had.', 'would does not stand in the if-clause, had is needed there.'),
        'has': ('has ist Präsens, last year verlangt die Vergangenheit.', 'has is present, last year needs the past.'),
        'did': ('did braucht die Grundform, hier steht aber chosen.', 'did needs the base form, but chosen stands here.')},
    'The company is said ___ be planning to relocate its headquarters to Austin next year.': {
        'for': ('is said for gibt es nicht, es heißt is said to.', 'is said for does not exist, it is is said to.'),
        'of': ('is said of gibt es nicht, es heißt is said to.', 'is said of does not exist, it is is said to.'),
        'at': ('is said at gibt es nicht, es heißt is said to.', 'is said at does not exist, it is is said to.')},
    'Excuse me, could you tell me where the nearest printer ___, please?': {
        'does': ('In der indirekten Frage steht kein does, die Satzstellung ist normal.', 'In an indirect question there is no does, the word order is normal.'),
        'are': ('are passt nicht zu printer, das ist Einzahl.', 'are does not fit printer, which is singular.'),
        'has': ('has verlangt eine 3. Form und passt nicht zu where.', 'has needs a participle and does not fit where.')},
    'The invoice ___ have come from Hanna: she was on vacation in Spain all of last week.': {
        'must': ('must have come hieße „bestimmt gekommen“, der Urlaub schließt das aber aus.', 'must have come would mean “certainly came”, but the vacation rules that out.'),
        'might': ('might have come hieße „vielleicht“, die Aussage ist aber ein sicherer Ausschluss.', 'might have come would mean “perhaps”, but the statement is a firm exclusion.'),
        'should': ('should have come hieße „hätte kommen sollen“, das ist ein anderer Sinn.', 'should have come would mean “ought to have come”, which is a different meaning.')},
    'We are looking forward ___ working with your new team next month.': {
        'for': ('look forward for gibt es nicht, es heißt look forward to.', 'look forward for does not exist, it is look forward to.'),
        'at': ('look forward at gibt es nicht, es heißt look forward to.', 'look forward at does not exist, it is look forward to.'),
        'on': ('look forward on gibt es nicht, es heißt look forward to.', 'look forward on does not exist, it is look forward to.')},
    'There has been a sharp increase ___ demand for our cloud services since the new campaign started.': {
        'of': ('increase of braucht danach eine Zahl, vor demand steht in.', 'increase of needs a figure after it, before demand in is used.'),
        'on': ('increase on gibt es in dieser Bedeutung nicht, es heißt increase in.', 'increase on does not exist in this meaning, it is increase in.'),
        'for': ('increase for nennt den Nutznießer, nicht den Bereich.', 'increase for names a beneficiary, not the area.')},
    'We received too ___ complaints about the new app this month, so we must react quickly.': {
        'much': ('much steht vor nicht zählbaren Nomen, complaints ist zählbar.', 'much stands before uncountable nouns, complaints is countable.'),
        'few': ('too few heißt „zu wenige“, das passt nicht zu einer Sorge über viele Beschwerden.', 'too few means “not enough”, which does not fit worry about many complaints.'),
        'little': ('little steht vor nicht zählbaren Nomen, complaints ist zählbar.', 'little stands before uncountable nouns, complaints is countable.')},
    '___ completed the first phase, the team moved on to the integration tests.': {
        'Had': ('Had completed ohne Subjekt ergibt keinen Nebensatz.', 'Had completed without a subject forms no clause.'),
        'Being': ('Being completed wäre Passiv und passt nicht zur Handlung des Teams.', 'Being completed would be passive and does not fit the team’s action.'),
        'Been': ('Been allein steht nicht am Satzanfang, es braucht having.', 'Been alone does not start a sentence, having is needed.')},
}
