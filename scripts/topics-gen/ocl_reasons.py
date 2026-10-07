"""Begründungen je Ablenker bei den Lückenaufgaben (ocl) der neuen Themen: Text -> {Ablenker: (de, en)}.
Jeder Eintrag sagt in einem Halbsatz, warum der Ablenker hier nicht passt (Lehrer-Gegenlesung P35/P36)."""

R = {
    'Never ___ the team faced such a complex migration in so short a time.': {
        'did': ('did braucht die Grundform, hier steht aber faced (3. Form wäre nötig).', 'did needs the base form, but faced is already a past form here.'),
        'was': ('was passt nicht zu faced, es fehlt das Hilfsverb für die Vorzeitigkeit.', 'was does not fit faced, the auxiliary for the earlier action is missing.'),
        'would': ('would braucht die Grundform, hier folgt aber faced.', 'would needs the base form, but faced follows.')},
    'Only then ___ we understand how serious the problem really was.': {
        'do': ('do ist Präsens, der Satz erzählt aber von früher (was).', 'do is present, but the sentence tells about the past (was).'),
        'are': ('are passt nicht zu understand, es fehlt die Vergangenheit.', 'are does not fit understand, the past tense is missing.'),
        'have': ('have verlangt die 3. Form, hier folgt aber die Grundform understand.', 'have needs the participle, but the base form understand follows.')},
    'No sooner had the meeting ended ___ the next call started.': {
        'when': ('when gehört zu hardly, nicht zu no sooner.', 'when goes with hardly, not with no sooner.'),
        'that': ('that leitet hier keinen Vergleich ein, zu no sooner gehört than.', 'that does not introduce a comparison here, no sooner goes with than.'),
        'then': ('then ist ein Zeitwort („dann“), kein Bindewort für no sooner.', 'then is a time word (“then”), not the connector for no sooner.')},
    'Hardly had we opened the file ___ the program crashed.': {
        'than': ('than gehört zu no sooner, nicht zu hardly.', 'than goes with no sooner, not with hardly.'),
        'that': ('that verbindet hier nichts, zu hardly gehört when.', 'that connects nothing here, hardly goes with when.'),
        'then': ('then ist ein Zeitwort, es verbindet die beiden Sätze nicht.', 'then is a time word, it does not join the two clauses.')},
    '___ you need further information, our team will be happy to help.': {
        'Would': ('Would you need … ist keine Bedingung, hier braucht es Should oder If.', 'Would you need … is not a condition, Should or If is needed here.'),
        'Could': ('Could you need … fragt nach Möglichkeit und leitet keine Bedingung ein.', 'Could you need … asks about possibility and does not open a condition.'),
        'Might': ('Might you need … klingt altmodisch und ist keine übliche Bedingung.', 'Might you need … sounds old-fashioned and is not a usual condition.')},
    'Had it not been ___ the support of our partners, we could not have finished on time.': {
        'of': ('of passt nicht zu been, die feste Wendung ist had it not been for.', 'of does not fit been, the fixed phrase is had it not been for.'),
        'to': ('to nennt eine Richtung, die Wendung braucht for.', 'to names a direction, the phrase needs for.'),
        'by': ('by nennt den Urheber, die Wendung braucht for.', 'by names the agent, the phrase needs for.')},
    'No sooner had we sat down at the café ___ it started to rain.': {
        'when': ('when gehört zu hardly, zu no sooner gehört than.', 'when goes with hardly, no sooner goes with than.'),
        'that': ('that leitet hier keinen Vergleich ein, es braucht than.', 'that does not introduce a comparison here, it needs than.'),
        'then': ('then ist ein Zeitwort („dann“), kein Bindewort.', 'then is a time word (“then”), not a connector.')},
    'Seldom ___ my neighbor leave the house before noon.': {
        'do': ('do passt zu Mehrzahl, my neighbor ist Einzahl.', 'do goes with plural, my neighbor is singular.'),
        'is': ('is braucht ein -ing oder eine 3. Form, hier steht die Grundform leave.', 'is needs an -ing or a participle, but the base form leave stands here.'),
        'has': ('has verlangt die 3. Form (left), hier steht die Grundform leave.', 'has needs the participle (left), but the base form leave stands here.')},
    'Only when the baby fell asleep ___ we finally eat dinner.': {
        'do': ('do ist Präsens, der Nebensatz steht aber in der Vergangenheit.', 'do is present, but the clause before it is in the past.'),
        'can': ('can ist Präsens und passt nicht zu fell asleep.', 'can is present and does not fit fell asleep.'),
        'are': ('are braucht ein -ing, hier steht die Grundform eat.', 'are needs an -ing form, but the base form eat stands here.')},
    'She said we never answered, but we ___ reply to her email on Tuesday.': {
        'do': ('do ist Präsens, die Antwort liegt aber in der Vergangenheit (on Tuesday).', 'do is present, but the reply lies in the past (on Tuesday).'),
        'does': ('does gehört zu he, she, it, nicht zu we.', 'does goes with he, she, it, not with we.'),
        'had': ('had verlangt die 3. Form, hier folgt die Grundform reply.', 'had needs the participle, but the base form reply follows.')},
    'You say he does not speak French, but he really ___ speak it fluently.': {
        'do': ('do gehört zu I, you, we, they, nicht zu he.', 'do goes with I, you, we, they, not with he.'),
        'did': ('did ist Vergangenheit, der Satz spricht aber von seinem Können jetzt.', 'did is past, but the sentence is about his ability now.'),
        'is': ('is braucht ein -ing oder eine 3. Form, hier folgt die Grundform speak.', 'is needs an -ing or a participle, but the base form speak follows.')},
    'Much ___ I would like to attend, I have another meeting at that time.': {
        'that': ('Much that ist keine gültige Verbindung für einen Einwand.', 'Much that is not a valid combination for a concession.'),
        'so': ('Much so gibt es nur als very much so („allerdings“), es leitet keinen Einwand ein.', 'Much so exists only as very much so (“indeed”), it does not start a concession.'),
        'if': ('if nennt eine Bedingung, hier soll aber ein Einwand stehen.', 'if names a condition, but a concession is needed here.')},
    'Hard ___ we tried, the migration was not finished before the deadline.': {
        'that': ('Hard that we tried ist keine gültige Verbindung für einen Einwand.', 'Hard that we tried is not a valid combination for a concession.'),
        'so': ('Hard so we tried drückt keinen Einwand aus.', 'Hard so we tried does not express a concession.'),
        'if': ('if nennt eine Bedingung, hier soll aber ein Einwand stehen.', 'if names a condition, but a concession is needed here.')},
    'So strong was the wind ___ the organizers canceled the outdoor concert.': {
        'which': ('which bezieht sich auf ein Nomen, hier folgt aber die Folge des ganzen Satzes.', 'which refers to a noun, but here the result of the whole clause follows.'),
        'what': ('what leitet keinen Folgesatz ein, nach so … that braucht es that.', 'what does not start a result clause, so … that needs that.'),
        'as': ('as vergleicht, die Folge wird aber mit that angeschlossen.', 'as compares, but the result is joined with that.')},
    'It was ___ a good offer that we accepted it at once.': {
        'so': ('so steht vor einem Adjektiv allein, vor a + Nomen braucht es such.', 'so goes before an adjective alone, before a + noun it needs such.'),
        'very': ('very verstärkt nur ein Adjektiv und nennt keine Folge mit that.', 'very only strengthens an adjective and names no result with that.'),
        'too': ('too steht vor einem Adjektiv und verlangt danach to + Infinitiv, keinen that-Satz.', 'too stands before an adjective and needs to + infinitive after it, not a that-clause.')},
    'Such ___ his excitement that he could not sleep the night before the trip.': {
        'is': ('is ist Präsens, die Geschichte liegt aber in der Vergangenheit (could not).', 'is is present, but the story lies in the past (could not).'),
        'has': ('has verlangt eine 3. Form und passt nicht zu Such … that.', 'has needs a participle and does not fit Such … that.'),
        'did': ('did braucht die Grundform, hier steht aber ein Nomen.', 'did needs the base form, but a noun follows here.')},
    'Much ___ I love chocolate, I try to eat it only on weekends.': {
        'that': ('Much that ist keine gültige Verbindung für einen Einwand.', 'Much that is not a valid combination for a concession.'),
        'so': ('Much so bedeutet „sehr“ und leitet keinen Einwand ein.', 'Much so means “very” and does not start a concession.'),
        'how': ('how fragt nach der Art, hier soll aber ein Einwand stehen.', 'how asks about manner, but a concession is needed here.')},
    'I did ___ you about the leak, but you were not listening.': {
        'told': ('Nach did steht die Grundform, nicht die 2. Form told.', 'After did the base form follows, not the past form told.'),
        'telling': ('Nach did steht die Grundform, nicht -ing.', 'After did the base form follows, not -ing.'),
        'tells': ('Nach did steht die Grundform, kein -s.', 'After did the base form follows, no -s.')},
    'Will the new tool be cheaper? I expect ___, but I have not seen the quote yet.': {
        'too': ('too heißt „auch“ und ersetzt keinen Gedanken nach expect.', 'too means “also” and does not replace a thought after expect.'),
        'also': ('also heißt „auch“ und ersetzt keinen Gedanken nach expect.', 'also means “also” and does not replace a thought after expect.'),
        'yet': ('yet nennt „bisher“ und ersetzt den Gedanken nicht, nach expect steht so.', 'yet means “so far” and does not replace the thought, expect takes so.')},
    'Is the report finished? I am afraid ___; we are still checking the figures.': {
        'no': ('no steht nicht für einen ganzen Gedanken nach be afraid, dort steht not.', 'no does not stand for a whole thought after be afraid, not does.'),
        'nor': ('nor verbindet zwei Verneinungen und ersetzt hier keinen Gedanken.', 'nor joins two negatives and does not replace a thought here.'),
        'never': ('never heißt „nie“ und die Antwort wäre viel zu stark.', 'never means “never” and the answer would be far too strong.')},
    'Our competitors moved to a new platform in May, and we ___ the same in June.': {
        'do': ('do ist Präsens, der Satz erzählt aber von Mai und Juni (Vergangenheit).', 'do is present, but the sentence is about May and June (past).'),
        'had': ('had verlangt eine 3. Form, hier steht the same für die Handlung.', 'had needs a participle, but the same stands for the action here.'),
        'were': ('were braucht ein -ing oder eine 3. Form und ersetzt die Handlung nicht.', 'were needs an -ing or a participle and does not replace the action.')},
    'Anyone who wants to withdraw from the course may do ___ until the end of the month.': {
        'such': ('do such ist keine feste Wendung, es heißt do so.', 'do such is not a fixed phrase, it is do so.'),
        'thus': ('thus heißt „deshalb“ und ersetzt nicht die Handlung.', 'thus means “therefore” and does not replace the action.'),
        'either': ('either heißt „auch nicht“ und ersetzt die Handlung nicht.', 'either means “not either” and does not replace the action.')},
    'I do not like the old design, but the new ___ looks much better.': {
        'ones': ('ones ist Mehrzahl, design und looks stehen aber in der Einzahl.', 'ones is plural, but design and looks are singular.'),
        'that': ('that ersetzt kein Nomen hinter einem Adjektiv, es braucht one.', 'that does not replace a noun after an adjective, it needs one.'),
        'it': ('it kann nach einem Adjektiv nicht stehen, es braucht one.', 'it cannot follow an adjective, it needs one.')},
    'I did not call the client, although I was asked ___.': {
        'for': ('for gehört nicht zu dem weggelassenen Infinitiv, es braucht to.', 'for does not belong to the dropped infinitive, it needs to.'),
        'at': ('at gehört nicht zu dem weggelassenen Infinitiv, es braucht to.', 'at does not belong to the dropped infinitive, it needs to.'),
        'on': ('on gehört nicht zu dem weggelassenen Infinitiv, es braucht to.', 'on does not belong to the dropped infinitive, it needs to.')},
    '"Are you coming to the party?" "I would like ___, but I have to work."': {
        'for': ('for steht nicht für den weggelassenen Infinitiv, es braucht to.', 'for does not stand for the dropped infinitive, it needs to.'),
        'at': ('at steht nicht für den weggelassenen Infinitiv, es braucht to.', 'at does not stand for the dropped infinitive, it needs to.'),
        'on': ('on steht nicht für den weggelassenen Infinitiv, es braucht to.', 'on does not stand for the dropped infinitive, it needs to.')},
    '"Is the store open on Sundays?" "I think ___."': {
        'it': ('it ersetzt den Gedanken nicht, nach think steht so.', 'it does not replace the thought, think takes so.'),
        'yes': ('yes ist eine Antwort für sich und steht nicht hinter think.', 'yes is an answer on its own and does not follow think.'),
        'that': ('that braucht danach einen Satz, allein ersetzt es nichts.', 'that needs a clause after it, alone it replaces nothing.')},
    'I like both jackets, but the red ___ suits you better.': {
        'ones': ('ones ist Mehrzahl, jacket und suits stehen aber in der Einzahl.', 'ones is plural, but jacket and suits are singular.'),
        'that': ('that ersetzt kein Nomen hinter einem Adjektiv, es braucht one.', 'that does not replace a noun after an adjective, it needs one.'),
        'it': ('it kann nach einem Adjektiv nicht stehen, es braucht one.', 'it cannot follow an adjective, it needs one.')},
    'This is the best solution ___ have found so far.': {
        'what': ('what ist nach einem Nomen kein Relativpronomen.', 'what is not a relative pronoun after a noun.'),
        'who': ('who passt nur zu Personen, solution ist eine Sache.', 'who only fits people, solution is a thing.'),
        'it': ('it ist kein Subjekt zu have found und ersetzt that nicht.', 'it is not the subject of have found and does not replace that.')},
    'The colleague ___ I spoke to yesterday has already left the company.': {
        'what': ('what ist nach einem Nomen kein Relativpronomen.', 'what is not a relative pronoun after a noun.'),
        'which': ('which gilt für Sachen, colleague ist eine Person.', 'which is for things, colleague is a person.'),
        'whose': ('whose zeigt Besitz an, hier wird die Person nur genannt.', 'whose shows possession, but here the person is only named.')},
    'The measures proposed ___ the committee were approved yesterday.': {
        'from': ('from nennt die Herkunft, der Urheber wird mit by angeschlossen.', 'from names the origin, the agent is joined with by.'),
        'at': ('at nennt einen Ort oder Punkt, nicht den Urheber.', 'at names a place or point, not the agent.'),
        'of': ('of nennt keinen Urheber nach einem passiven Partizip.', 'of names no agent after a passive participle.')},
    'Any issues related ___ the update should be reported today.': {
        'with': ('related with ist unüblich, die feste Verbindung heißt related to.', 'related with is unusual, the fixed combination is related to.'),
        'for': ('related for gibt es nicht, es heißt related to.', 'related for does not exist, it is related to.'),
        'at': ('related at gibt es nicht, es heißt related to.', 'related at does not exist, it is related to.')},
    'We have reached the end ___ the quarter.': {
        'from': ('from nennt den Anfangspunkt, the end of verlangt of.', 'from names a starting point, the end of needs of.'),
        'in': ('in nennt einen Zeitraum, nach the end steht of.', 'in names a period, after the end comes of.'),
        'at': ('at nennt einen Punkt, nach the end steht of.', 'at names a point, after the end comes of.')},
    'He was the last colleague ___ leave the office on Friday.': {
        'for': ('for gibt es nach the last colleague nicht, es folgt to + Grundform.', 'for does not follow the last colleague, to + base form does.'),
        'at': ('at passt nicht vor einer Grundform, es braucht to.', 'at does not fit before a base form, it needs to.'),
        'of': ('of passt nicht vor einer Grundform, es braucht to.', 'of does not fit before a base form, it needs to.')},
    'The report shows the extent ___ which costs have risen since January.': {
        'of': ('the extent of which klingt falsch, hier gehört to which.', 'the extent of which sounds wrong, to which belongs here.'),
        'at': ('at passt nicht zu extent, die feste Wendung ist to which.', 'at does not fit extent, the fixed phrase is to which.'),
        'for': ('for passt nicht zu extent, die feste Wendung ist to which.', 'for does not fit extent, the fixed phrase is to which.')},
    'Those ___ live near the station can walk to work.': {
        'whom': ('whom ist ein Objekt, hier ist die Gruppe Subjekt von live.', 'whom is an object, here the group is the subject of live.'),
        'which': ('which gilt für Sachen, hier geht es um Menschen.', 'which is for things, here it is about people.'),
        'what': ('what leitet keinen Relativsatz nach those ein.', 'what does not start a relative clause after those.')},
    'She was the last guest ___ leave the party.': {
        'who': ('who bräuchte ein gebeugtes Verb (who left), hier folgt die Grundform.', 'who would need an inflected verb (who left), but the base form follows.'),
        'for': ('for gibt es nach the last guest nicht, es folgt to + Grundform.', 'for does not follow the last guest, to + base form does.'),
        'that': ('that bräuchte ein gebeugtes Verb (that left), hier folgt die Grundform.', 'that would need an inflected verb (that left), but the base form follows.')},
    'This is the best present ___ I have ever received.': {
        'what': ('what ist nach einem Nomen kein Relativpronomen.', 'what is not a relative pronoun after a noun.'),
        'who': ('who passt nur zu Personen, present ist eine Sache.', 'who only fits people, present is a thing.'),
        'where': ('where fragt nach einem Ort, hier ist present das Objekt.', 'where asks about a place, but present is the object here.')},
    'The name ___ the street is difficult to pronounce.': {
        'from': ('from nennt die Herkunft, bei einem Namen steht of.', 'from names the origin, with a name of is used.'),
        'to': ('to nennt eine Richtung, nach the name steht of.', 'to names a direction, after the name comes of.'),
        'for': ('for nennt einen Zweck, nach the name steht of.', 'for names a purpose, after the name comes of.')},
}
