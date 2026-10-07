"""Alltagsaufgaben (dom: life) zu den vier Themen von P36. Je Thema 12 Aufgaben: 3 mcc, 3 ocl, 3 err (eine ohne Fehler), 3 kwt."""
from lib import mcc, ocl, err, kwt, W

G = 'grammar'; M = 'meaning'
L = 'life'


def inversion():
    T = 'inversion'
    mcc(T, 'inv.negative', 'C1', L, 0.0, 'Rarely ___ such a quiet weekend with the kids at home.',
        'have we had', ['we have had', 'have had we', 'we do have'],
        ('Nach Rarely am Satzanfang steht das Hilfsverb vor dem Subjekt: Rarely have we had.', 'After Rarely at the start, the auxiliary comes before the subject: Rarely have we had.'),
        [(G, 'Ohne Umstellung fehlt die Inversion, die Rarely am Anfang verlangt.', 'Without inversion the order that Rarely at the start requires is missing.'),
         (G, 'Das Subjekt we muss hinter have stehen, nicht hinter had.', 'The subject we has to follow have, not had.'),
         (G, 'Do passt nicht zu Rarely have. Hier braucht es die 3. Form had.', 'Do does not fit Rarely have. Here the participle had is needed.')])
    mcc(T, 'inv.only', 'C1', L, 0.0, 'Only after I had cleaned the whole kitchen ___ that the oven was still on.',
        'did I notice', ['I noticed', 'noticed I', 'I did notice'],
        ('Nach Only after und dem Nebensatz steht did vor dem Subjekt, das Verb in der Grundform: did I notice.', 'After Only after and the clause, did stands before the subject and the verb takes the base form: did I notice.'),
        [(G, 'Hier fehlt die Umstellung nach Only after.', 'The inversion after Only after is missing here.'),
         (G, 'Das Verb steht vor dem Subjekt, aber ohne Hilfsverb. Man braucht did I notice.', 'The verb stands before the subject but without an auxiliary. You need did I notice.'),
         (G, 'did gehört vor das Subjekt, nicht dahinter.', 'did belongs before the subject, not after it.')])
    mcc(T, 'inv.cond', 'C1', L, 0.0, '___ late tonight, text me and I will keep your dinner warm.',
        'Should you be', ['You should be', 'If you would be', 'Were you being'],
        ('Should you be … ist eine Bedingung ohne if: Should steht vor dem Subjekt, danach die Grundform.', 'Should you be … is a condition without if: Should stands before the subject, then the base form.'),
        [(G, 'Ohne Umstellung entsteht eine Aussage, keine Bedingung.', 'Without inversion you get a statement, not a condition.'),
         (G, 'Nach if steht kein would. Außerdem ist if ein anderes Muster.', 'After if there is no would. Besides, if is a different pattern.'),
         (G, 'Were you being ist eine Frage in der Verlaufsform und keine Bedingung.', 'Were you being is a question in the continuous form and not a condition.')])

    ocl(T, 'inv.sooner', 'C1', L, 0.0, 'No sooner had we sat down at the café ___ it started to rain.',
        ['than'], 'conj', ['when', 'that', 'then'],
        ('Zu no sooner gehört than: No sooner had … than …', 'No sooner goes with than: No sooner had … than …'))
    ocl(T, 'inv.negative', 'C1', L, 0.0, 'Seldom ___ my neighbor leave the house before noon.',
        ['does'], 'aux', ['do', 'is', 'has'],
        ('Nach Seldom am Satzanfang steht does vor dem Subjekt: Seldom does my neighbor leave.', 'After Seldom at the start, does stands before the subject: Seldom does my neighbor leave.'))
    ocl(T, 'inv.only', 'C1', L, 0.0, 'Only when the baby fell asleep ___ we finally eat dinner.',
        ['could', 'did'], 'aux', ['do', 'can', 'are'],
        ('Nach Only when und dem Nebensatz steht das Hilfsverb vor dem Subjekt: Only when … could we eat.', 'After Only when and the clause, the auxiliary comes before the subject: Only when … could we eat.'))

    err(T, 'inv.negative', 'C1', L, 0.0, 'Never I have seen my grandmother so happy as at the wedding.',
        ('I have seen', ['have I seen'], ['have I seen', 'I did see', 'saw I']),
        ('Nach Never am Satzanfang steht have vor dem Subjekt: Never have I seen.', 'After Never at the start, have stands before the subject: Never have I seen.'))
    err(T, 'inv.sooner', 'C1', L, 0.0, 'No sooner we had left the house than we remembered the keys.',
        ('we had left', ['had we left'], ['had we left', 'we left', 'did we leave']),
        ('Nach No sooner steht had vor dem Subjekt: No sooner had we left.', 'After No sooner, had stands before the subject: No sooner had we left.'))
    err(T, 'inv.only', 'C1', L, 0.0, 'Only after the movie had ended did the children admit that they were scared.', None,
        ('Kein Fehler: Nach Only after und dem Nebensatz steht did vor dem Subjekt, wie hier.', 'No mistake: after Only after and the clause, did stands before the subject, as here.'))

    kwt(T, 'inv.negative', 'C1', L, 0.0, 'This was the first time I felt so tired after such a short hike.', 'HAVE', 'Never', 'so tired after such a short hike.',
        [(['have', 'before have'], ['I felt'])], ['I', 'felt'], ['had', 'did', 'been'], ['I have felt'],
        ('Nach Never steht das Hilfsverb vor dem Subjekt: Never have I felt.', 'After Never, the auxiliary comes before the subject: Never have I felt.'),
        [W(['i', 'have', 'felt'], 'Nach Never kommt have vor I: have I felt.', 'After Never, have comes before I: have I felt.')])
    kwt(T, 'inv.only', 'C1', L, 0.0, 'You are not allowed into the garden before you have rung the bell.', 'CAN', 'Only after you have rung the bell', 'the garden.',
        [(['can'], ['you enter'])], ['you', 'enter'], ['did', 'will', 'had'], ['you can enter'],
        ('Only after you have rung the bell can you enter … Nach dem Nebensatz steht can vor dem Subjekt.', 'Only after you have rung the bell can you enter … After the clause, can comes before the subject.'),
        [W(['you', 'can', 'enter'], 'Nach dem Nebensatz kommt can vor das Subjekt: can you enter.', 'After the clause, can comes before the subject: can you enter.')])
    kwt(T, 'inv.cond', 'C1', L, 0.0, 'If you want a lift to the station, just text me.', 'SHOULD', '', 'a lift to the station, just text me.',
        [(['Should'], ['you want'])], ['you', 'want'], ['will', 'would', 'if'], ['Should you will want'],
        ('Should you want … ist eine Bedingung ohne if und ohne will.', 'Should you want … is a condition without if and without will.'),
        [W(['should', 'will'], 'Nach Should you steht die Grundform, kein will.', 'After Should you the base form follows, no will.')])


def emph():
    T = 'emph-plus'
    mcc(T, 'ep.do-emph', 'C1', L, 0.0, 'I know you think I forgot, but I really ___ the milk this morning.',
        'did buy', ['did bought', 'do buy', 'bought did'],
        ('Das betonte did steht vor der Grundform: I really did buy the milk.', 'The stressed did stands before the base form: I really did buy the milk.'),
        [(G, 'Nach did steht die Grundform buy, nicht bought.', 'After did the base form buy follows, not bought.'),
         (G, 'Do passt nicht zur Vergangenheit. Hier braucht es did.', 'Do does not fit the past. Here did is needed.'),
         (G, 'did steht vor dem Verb, nicht dahinter.', 'did stands before the verb, not after it.')])
    mcc(T, 'ep.concession', 'C1', L, 0.0, '___ it is, we cannot afford a holiday abroad this year.',
        'Tempting as', ['Tempting that', 'Tempting but', 'Although tempting as'],
        ('Tempting as it is … räumt etwas ein: Adjektiv, as, dann Subjekt und Verb in normaler Stellung.', 'Tempting as it is … concedes a point: adjective, as, then subject and verb in normal order.'),
        [(G, 'That leitet hier keinen Einwand ein. Es braucht as.', 'That does not introduce a concession here. It needs as.'),
         (G, 'But ist eine Konjunktion und kann nicht hinter dem Adjektiv stehen.', 'But is a conjunction and cannot follow the adjective.'),
         (G, 'Although und as zusammen doppeln den Einwand.', 'Although and as together double the concession.')])
    mcc(T, 'ep.so-such', 'C1', L, 0.0, 'So loud ___ that the neighbors called the police.',
        'was the music', ['the music was', 'the music were', 'were the music'],
        ('Nach So + Adjektiv am Anfang steht das Verb vor dem Subjekt: So loud was the music.', 'After So + adjective at the start, the verb comes before the subject: So loud was the music.'),
        [(G, 'Ohne Umstellung fehlt die Inversion nach So loud.', 'Without inversion the order after So loud is missing.'),
         (G, 'Music ist Singular, deshalb was, nicht were.', 'Music is singular, so was, not were.'),
         (G, 'Music ist Singular. Were passt nicht dazu.', 'Music is singular. Were does not fit.')])

    ocl(T, 'ep.so-such', 'C1', L, 0.0, 'Such ___ his excitement that he could not sleep the night before the trip.',
        ['was'], 'aux', ['is', 'has', 'did'],
        ('Nach Such am Anfang steht das Verb vor dem Subjekt: Such was his excitement.', 'After Such at the start, the verb comes before the subject: Such was his excitement.'))
    ocl(T, 'ep.concession', 'C1', L, 0.0, 'Much ___ I love chocolate, I try to eat it only on weekends.',
        ['as', 'though'], 'conj', ['that', 'so', 'how'],
        ('Much as I love … räumt etwas ein und heißt „so sehr ich … mag“.', 'Much as I love … concedes a point and means “as much as I love …”.'))
    ocl(T, 'ep.do-emph', 'C1', L, 0.0, 'I did ___ you about the leak, but you were not listening.',
        ['tell'], 'part', ['told', 'telling', 'tells'],
        ('Das betonte did steht vor der Grundform: I did tell you.', 'The stressed did stands before the base form: I did tell you.'))

    err(T, 'ep.object-front', 'C1', L, 0.0, 'This must we always remember when we plan a family trip.',
        ('must we always remember', ['we must always remember'], ['we must always remember', 'must always we remember', 'we always must to remember']),
        ('Bei vorangestelltem Objekt bleibt die Reihenfolge danach normal: This we must always remember.', 'With a fronted object the order after it stays normal: This we must always remember.'))
    err(T, 'ep.do-emph', 'C1', L, 0.0, 'She does loves her new flat, even though it is small.',
        ('does loves', ['does love'], ['does love', 'do love', 'does loving']),
        ('Nach does steht die Grundform: does love.', 'After does the base form follows: does love.'))
    err(T, 'ep.concession', 'C1', L, 0.0, 'Strange as it may seem, the best coffee in town is sold at the petrol station.', None,
        ('Kein Fehler: Adjektiv + as + it may seem räumt etwas ein.', 'No mistake: adjective + as + it may seem concedes a point.'))

    kwt(T, 'ep.concession', 'C1', L, 0.0, 'Although the offer sounds attractive, I will stay at home tonight.', 'TEMPTING', '', 'is, I will stay at home tonight.',
        [(['Tempting as'], ['the offer'])], ['as', 'the', 'offer'], ['that', 'so', 'it'], [],
        ('Tempting as the offer is, … Das Adjektiv steht vor as, dann die normale Stellung.', 'Tempting as the offer is, … The adjective stands before as, then the normal order.'), [])
    kwt(T, 'ep.do-emph', 'C1', L, 0.0, 'I really enjoyed the concert last night.', 'DID', 'I', 'the concert last night.',
        [(['really did'], ['enjoy'])], ['really', 'enjoy'], ['enjoyed', 'do', 'was'], ['really did enjoyed'],
        ('Das betonte did steht vor der Grundform enjoy.', 'The stressed did stands before the base form enjoy.'),
        [W(['did', 'enjoyed'], 'Nach did steht die Grundform enjoy.', 'After did the base form enjoy follows.')])
    kwt(T, 'ep.so-such', 'C1', L, 0.0, 'The noise was so loud that the neighbors complained.', 'SUCH', '', 'that the neighbors complained.',
        [(['Such was'], ['the noise'])], ['was', 'the', 'noise'], ['so', 'is', 'it'], ['Such the noise was'],
        ('Such was the noise that … Das Verb steht vor dem Subjekt.', 'Such was the noise that … The verb stands before the subject.'),
        [W(['such', 'the', 'noise', 'was'], 'Nach Such am Anfang kommt was vor das Subjekt: Such was the noise.', 'After Such at the start, was comes before the subject: Such was the noise.')])


def ellipsis():
    T = 'ellipsis'
    mcc(T, 'el.so-not', 'C1', L, 0.0, '"Will it rain tomorrow?" "I hope ___, because we are planning a picnic."',
        'not', ['no', 'that not', 'not so'],
        ('Nach hope steht not direkt für den verneinten Gedanken: I hope not.', 'After hope, not stands directly for the negative thought: I hope not.'),
        [(G, 'No steht nicht hinter hope. Dort braucht es not.', 'No does not follow hope. There it needs not.'),
         (G, 'Nach hope folgt not direkt, ohne that.', 'After hope, not follows directly, without that.'),
         (G, 'So not ist keine feste Folge nach hope.', 'Not so is not a fixed sequence after hope.')])
    mcc(T, 'el.do-so', 'C1', L, 0.0, 'My brother always leaves his shoes in the hall, and my sister ___.',
        'does the same', ['does same', 'does it the same', 'is the same'],
        ('Does the same ersetzt die Handlung leaves her shoes in the hall.', 'Does the same replaces the action leaves her shoes in the hall.'),
        [(G, 'Vor same steht the: the same.', 'Before same you need the: the same.'),
         (G, 'Does the same braucht kein it.', 'Does the same needs no it.'),
         (G, 'Is the same wäre ein Vergleich und ersetzt keine Handlung.', 'Is the same would be a comparison and does not replace an action.')])
    mcc(T, 'el.one-ones', 'C1', L, 0.0, 'My old phone is slow, so I am thinking of buying a new ___.',
        'one', ['ones', 'it', 'that'],
        ('One ersetzt das Nomen phone. Hinter new darf es nicht fehlen.', 'One replaces the noun phone. After new it must not be missing.'),
        [(G, 'Phone ist Singular, deshalb one, nicht ones.', 'Phone is singular, so one, not ones.'),
         (G, 'It kann kein Adjektiv-Nomen ersetzen. Es braucht one.', 'It cannot replace an adjective-noun phrase. It needs one.'),
         (G, 'That steht nicht hinter einem Adjektiv.', 'That does not follow an adjective.')])

    ocl(T, 'el.to-aux', 'C1', L, 0.0, '"Are you coming to the party?" "I would like ___, but I have to work."',
        ['to'], 'part', ['for', 'at', 'on'],
        ('Das Verb come entfällt, aber to bleibt: I would like to.', 'The verb come is dropped, but to stays: I would like to.'))
    ocl(T, 'el.so-not', 'C1', L, 0.0, '"Is the shop open on Sundays?" "I think ___."',
        ['so'], 'adv', ['it', 'yes', 'that'],
        ('Nach think ersetzt so den ganzen Gedanken: I think so.', 'After think, so replaces the whole thought: I think so.'))
    ocl(T, 'el.one-ones', 'C1', L, 0.0, 'I like both jackets, but the red ___ suits you better.',
        ['one'], 'pron', ['ones', 'that', 'it'],
        ('One ersetzt das Nomen jacket. Hinter red darf es nicht fehlen.', 'One replaces the noun jacket. After red it must not be missing.'))

    err(T, 'el.do-so', 'C1', L, 0.0, 'My sister cleaned the kitchen yesterday, and I will do same tomorrow.',
        ('do same', ['do the same'], ['do the same', 'do it same', 'does same']),
        ('Vor same steht the: do the same.', 'Before same you need the: do the same.'))
    err(T, 'el.so-not', 'C1', L, 0.0, 'Is the café open today? I am afraid no, it closes on Mondays.',
        ('afraid no', ['afraid not'], ['afraid not', 'afraid that no', 'afraid nothing']),
        ('Nach be afraid steht not für den verneinten Gedanken: I am afraid not.', 'After be afraid, not stands for the negative thought: I am afraid not.'))
    err(T, 'el.to-aux', 'C1', L, 0.0, 'I wanted to join the choir, but my friends told me not to.', None,
        ('Kein Fehler: Das Verb join entfällt, aber to bleibt: told me not to.', 'No mistake: the verb join is dropped, but to stays: told me not to.'))

    err(T, 'el.so-not', 'C1', L, 0.0, 'Will it rain at the weekend? I do not hope so, because we are planning a picnic.',
        ('do not hope so', ['hope not'], ['hope not', 'do not hope not', 'hope so not']),
        ('Es heißt I hope not, nicht I do not hope so. Not ersetzt den Gedanken.', 'It is I hope not, not I do not hope so. Not replaces the thought.'))
    err(T, 'el.so-not', 'C1', L, 0.0, 'I do not like coffee, and neither I do tea, so we ordered water.',
        ('neither I do', ['neither do I'], ['neither do I', 'neither I do', 'so do I']),
        ('Nach neither steht das Hilfsverb vor dem Subjekt: neither do I.', 'After neither the auxiliary comes before the subject: neither do I.'))
    err(T, 'el.one-ones', 'C1', L, 0.0, 'My phone is old, so I bought a new at the weekend.',
        ('a new', ['a new one'], ['a new one', 'a new ones', 'the new it']),
        ('Hinter dem Adjektiv new braucht es one.', 'After the adjective new you need one.'))
    kwt(T, 'el.so-not', 'C1', L, 0.0, 'Is Tom coming to the party? I suppose he is coming.', 'SO', 'Is Tom coming to the party?', '.',
        [(['I suppose'], ['so'])], ['I', 'suppose'], ['it', 'that', 'yes'], ['I suppose it'],
        ('I suppose so. So steht direkt hinter dem Verb und ersetzt den Gedanken.', 'I suppose so. So follows the verb directly and replaces the thought.'),
        [W(['suppose', 'it'], 'Nach suppose steht so, nicht it.', 'After suppose comes so, not it.')])
    kwt(T, 'el.do-so', 'C1', L, 0.0, 'My brother always takes the bus, and my sister takes the bus too.', 'DOES', 'My brother always takes the bus, and my sister', '.',
        [(['does the'], ['same'])], ['the', 'same'], ['do', 'so', 'it'], ['does same'],
        ('Does the same ersetzt die Handlung takes the bus.', 'Does the same replaces the action takes the bus.'),
        [W(['does', 'same'], 'Vor same steht the: the same.', 'Before same you need the: the same.', ['the'])])
    kwt(T, 'el.one-ones', 'C1', L, 0.0, 'These apples are sweeter than the apples that we bought last week.', 'ONES', 'These apples are sweeter than', 'we bought last week.',
        [(['the ones'], ['that'])], ['the', 'that'], ['those', 'it', 'what'], [],
        ('The ones ersetzt das Pluralnomen apples.', 'The ones replaces the plural noun apples.'), [])


def nounphrase():
    T = 'noun-phrase'
    mcc(T, 'np.contact', 'C1', L, 0.0, 'This is the best pizza ___ in years.',
        'I have had', ['what I have had', 'that had I', 'I have had it'],
        ('Nach the best kann das Relativpronomen fehlen: the best pizza I have had.', 'After the best, the relative pronoun may be dropped: the best pizza I have had.'),
        [(G, 'What leitet hier keinen Relativsatz ein.', 'What does not introduce a relative clause here.'),
         (G, 'Nach that steht das Subjekt vor dem Verb: that I had.', 'After that the subject comes before the verb: that I had.'),
         (G, 'Das Objekt pizza steht schon vorn, it ist doppelt.', 'The object pizza already stands first, so it is doubled.')])
    mcc(T, 'np.participle', 'C1', L, 0.0, 'The kids ___ in the garden are my neighbor’s.',
        'playing', ['play', 'played', 'are playing'],
        ('Das Partizip playing ersetzt who are playing: the kids playing in the garden.', 'The participle playing replaces who are playing: the kids playing in the garden.'),
        [(G, 'Ein zweites Verb ohne who geht nicht: playing statt play.', 'A second verb without who does not work: playing instead of play.'),
         (G, 'Played ist passiv und passt nicht zu Kindern, die selbst spielen.', 'Played is passive and does not fit kids who play themselves.'),
         (G, 'Are playing doppelt das Verb are.', 'Are playing doubles the verb are.')])
    mcc(T, 'np.of-s', 'C1', L, 0.0, 'We stayed at ___ house for the weekend.',
        'my parents’', ['my parent’s', 'of my parents', 'my parents house'],
        ('Bei Personen steht ’s oder s’: my parents’ house (Plural mit Apostroph hinter dem s).', 'With people ’s or s’ is used: my parents’ house (plural with the apostrophe after the s).'),
        [(M, 'My parent’s heißt nur ein Elternteil.', 'My parent’s means only one parent.'),
         (G, 'Of my parents house ist falsch gestellt. Bei Personen steht ’s.', 'Of my parents house is out of place. With people ’s is used.'),
         (G, 'Ohne Apostroph fehlt die Besitzform.', 'Without an apostrophe the possessive form is missing.')])

    ocl(T, 'np.to-inf', 'C1', L, 0.0, 'She was the last guest ___ leave the party.',
        ['to'], 'part', ['who', 'for', 'that'],
        ('Nach the last steht to + Grundform: the last guest to leave.', 'After the last comes to + base form: the last guest to leave.'))
    ocl(T, 'np.contact', 'C1', L, 0.0, 'This is the best present ___ I have ever received.',
        ['that'], 'rel', ['what', 'who', 'where'],
        ('Nach der Steigerung the best darf that stehen oder fehlen. What, who und where passen nicht.', 'After the superlative the best, that may stay or be dropped. What, who and where do not fit.'))
    ocl(T, 'np.of-s', 'C1', L, 0.0, 'The name ___ the street is difficult to pronounce.',
        ['of'], 'prep', ['from', 'to', 'for'],
        ('Bei Sachen steht of: the name of the street.', 'With things of is used: the name of the street.'))

    err(T, 'np.participle', 'C1', L, 0.0, 'The children involving in the school play need to arrive by eight.',
        ('involving', ['involved'], ['involved', 'involve', 'involves']),
        ('Die Kinder werden einbezogen, deshalb das passive Partizip: the children involved.', 'The children are involved, so the passive participle is used: the children involved.'))
    err(T, 'np.to-inf', 'C1', L, 0.0, 'The best way for save money is to cook at home.',
        ('for save', ['to save'], ['to save', 'for to save', 'of saving']),
        ('Nach the best way steht to + Grundform: the best way to save.', 'After the best way comes to + base form: the best way to save.'))
    err(T, 'np.of-s', 'C1', L, 0.0, 'Yesterday’s lesson was much shorter than last week’s.', None,
        ('Kein Fehler: Zeitangaben nehmen ’s, und last week’s ersetzt das Nomen.', 'No mistake: time words take ’s, and last week’s replaces the noun.'))

    kwt(T, 'np.contact', 'C1', L, 0.0, 'This is the best flight that my search turned up.', 'FIND', 'This is the best flight', '.',
        [(['I could'], ['find'])], ['I', 'could'], ['what', 'who', 'it'], [],
        ('the best flight I could find. Das Pronomen that darf fehlen.', 'the best flight I could find. The pronoun that may be dropped.'), [])
    kwt(T, 'np.participle', 'C1', L, 0.0, 'Everyone who received an invitation to the wedding must reply by Friday.', 'INVITED', 'Everyone', 'must reply by Friday.',
        [(['invited'], ['to the wedding'])], ['to', 'the', 'wedding'], ['who', 'is', 'inviting'], [],
        ('everyone invited to the wedding. Das passive Partizip ersetzt who is invited.', 'everyone invited to the wedding. The passive participle replaces who is invited.'), [])
    kwt(T, 'np.to-inf', 'C1', L, 0.0, 'Anna was the only person who answered the question.', 'TO', 'Anna was the', 'the question.',
        [(['only person'], ['to answer'])], ['only', 'person', 'answer'], ['who', 'answered', 'for'], [],
        ('the only person to answer. Nach only steht to + Grundform.', 'the only person to answer. After only comes to + base form.'), [])


LIFE = {'inversion': inversion, 'emph-plus': emph, 'ellipsis': ellipsis, 'noun-phrase': nounphrase}
