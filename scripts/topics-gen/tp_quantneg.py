from cm import *
import lib
from lib import mcc, ocl, err, kwt, W

G = 'grammar'; M = 'meaning'; C = 'calque'; P = 'partner'; R = 'register'
T = 'quant-neg'

TOPIC = {
    'id': T, 'group': 'Grammatik-Pfad', 'level': 'C1', 'p0': 0.45,
    'name': 'Verneinung und Mengen', 'name_en': 'Negation and quantity',
    'rule': 'Verneinung und Mengen haben feste Formen: „none of“ und „neither of“ für „keiner“, „hardly“ und „scarcely“ für „kaum“ (schon verneint), „no longer“ für „nicht mehr“ und „a number of“ gegen „the number of“.',
    'rule_en': 'Negation and quantity have fixed forms: “none of” and “neither of” for “not one”, “hardly” and “scarcely” for “barely” (already negative), “no longer” for “not any more” and “a number of” versus “the number of”.',
    'ex': ['None of the suppliers has replied yet.', 'We no longer offer this service.'],
}

PAT = [
    pattern('qn.none', ('none of, neither of · keiner von', 'none of, neither of · not one of'),
            ('none of / neither of (zwei) / not any of + the + Nomen', 'none of / neither of (two) / not any of + the + noun'),
            ('Für „keiner von …“ mit einem bestimmten Nomen sagt man none of. Bei genau zwei Dingen steht neither of. Das Verb ist nicht nochmal verneint.',
             'For “not one of …” with a specific noun you say none of. With exactly two things neither of is used. The verb is not negated again.'),
            ['none of', 'neither of', 'not any of', 'either of'],
            [('None of the suppliers has replied yet.', 'Keiner der Lieferanten hat bisher geantwortet.', 'mail'),
             ('Neither of the offers meets our budget.', 'Keines der beiden Angebote passt in unser Budget.', 'meeting'),
             ('I did not receive any of the documents.', 'Ich habe keines der Dokumente erhalten.', 'mail')],
            ('No one of the suppliers has replied yet.', 'None of the suppliers has replied yet.',
             'Für „keiner von …“ mit Nomen sagt man none of. No one of ist deutsch gedacht.',
             'For “not one of …” with a noun you say none of. No one of is German thinking.'),
            ('qn.hardly', 'None of the files were lost.', 'Hardly any files were lost.',
             'None of heißt: kein einziges. Hardly any heißt: sehr wenige.', 'None of means: not a single one. Hardly any means: very few.'),
            [('None of the offers is ready.', 'Ist mindestens ein Angebot fertig?', 'Is at least one offer ready?', False)],
            ('Meinst du „keiner von diesen“? Dann nimm none of, bei zwei Dingen neither of.', 'Do you mean “not one of these”? Then use none of, with two things neither of.')),
    pattern('qn.hardly', ('hardly, scarcely, barely · kaum', 'hardly, scarcely, barely · barely'),
            ('hardly / scarcely / barely + any / ever / enough (ohne not)', 'hardly / scarcely / barely + any / ever / enough (without not)'),
            ('Hardly, scarcely und barely sind schon verneint. Ein zweites not macht daraus Unsinn. Sie stehen oft vor any, ever oder enough: „We hardly had any time.“',
             'Hardly, scarcely and barely are already negative. A second not turns it into nonsense. They often stand before any, ever or enough: “We hardly had any time.”'),
            ['hardly any', 'hardly ever', 'scarcely', 'barely', 'rarely'],
            [('There was hardly any time left to prepare.', 'Es blieb kaum Zeit zur Vorbereitung.', 'meeting'),
             ('We barely noticed the change.', 'Wir haben die Änderung kaum bemerkt.', 'talk'),
             ('The team scarcely ever misses a deadline.', 'Das Team verpasst fast nie eine Frist.', 'mail')],
            ('We did not hardly have any time to prepare.', 'We hardly had any time to prepare.',
             'Hardly ist schon verneint. Das deutsche „kaum“ braucht im Englischen kein zweites not.',
             'Hardly is already negative. The German “kaum” needs no second not in English.'),
            ('qn.none', 'Hardly any files were lost.', 'None of the files were lost.',
             'Hardly any heißt: sehr wenige. None of heißt: kein einziges.', 'Hardly any means: very few. None of means: not a single one.'),
            [('We hardly had any time.', 'Hatten wir viel Zeit?', 'Did we have a lot of time?', False)],
            ('Meinst du „kaum“? Dann nimm hardly, scarcely oder barely, ohne zweites not.', 'Do you mean “barely”? Then use hardly, scarcely or barely, without a second not.')),
    pattern('qn.no-longer', ('no longer, any more · nicht mehr', 'no longer, any more · not any more'),
            ('no longer + Verb · not … any longer / any more (am Ende)', 'no longer + verb · not … any longer / any more (at the end)'),
            ('Für „nicht mehr“ bei der Zeit sagt man no longer vor dem Verb oder not … any longer am Ende. No more steht bei Mengen: „no more questions“.',
             'For “not any more” in time you say no longer before the verb or not … any longer at the end. No more is used with amounts: “no more questions”.'),
            ['no longer', 'not any longer', 'not any more', 'no more', 'anymore'],
            [('We no longer offer this service.', 'Wir bieten diesen Service nicht mehr an.', 'mail'),
             ('The old system is no longer supported.', 'Das alte System wird nicht mehr unterstützt.', 'meeting'),
             ('He does not work here any more.', 'Er arbeitet nicht mehr hier.', 'talk')],
            ('We no more offer this service.', 'We no longer offer this service.',
             'Für „nicht mehr“ bei der Zeit sagt man no longer. No more steht bei Mengen und vor Nomen.',
             'For “not any more” in time you say no longer. No more is used with amounts and before nouns.'),
            ('qn.hardly', 'He no longer works here.', 'He hardly works here.',
             'No longer heißt: früher ja, jetzt nein. Hardly heißt: fast nie.', 'No longer means: before yes, now no. Hardly means: almost never.'),
            [('He no longer works here.', 'Hat er früher hier gearbeitet?', 'Did he work here before?', True)],
            ('Meinst du „früher ja, jetzt nicht mehr“? Dann nimm no longer oder not any more.', 'Do you mean “before yes, now no”? Then use no longer or not any more.')),
    pattern('qn.number', ('a number of, the number of · Mengen', 'a number of, the number of · amounts'),
            ('a number of + Plural (Verb Plural) · the number of + Plural (Verb Singular)', 'a number of + plural (plural verb) · the number of + plural (singular verb)'),
            ('A number of heißt „einige“ und nimmt das Verb im Plural. The number of meint die Zahl selbst und nimmt das Verb im Singular. Dazu: few und little ohne a sind knapp, a few und a little sind genug.',
             'A number of means “several” and takes a plural verb. The number of means the figure itself and takes a singular verb. Also: few and little without a are scarce, a few and a little are enough.'),
            ['a number of', 'the number of', 'a great deal of', 'a few', 'few', 'a little'],
            [('A number of customers have complained about the delay.', 'Einige Kunden haben sich über die Verzögerung beschwert.', 'mail'),
             ('The number of complaints has fallen.', 'Die Zahl der Beschwerden ist gesunken.', 'meeting'),
             ('There is little we can do before Monday.', 'Vor Montag können wir kaum etwas tun.', 'talk')],
            ('The number of customers have risen sharply this year.', 'The number of customers has risen sharply this year.',
             'Beim Kern „the number“ steht das Verb im Singular. Bei „a number of“ steht es im Plural.',
             'With the core “the number” the verb is singular. With “a number of” it is plural.'),
            ('qn.hardly', 'Few people came.', 'A few people came.',
             'Few heißt: zu wenige. A few heißt: einige, genug.', 'Few means: too few. A few means: some, enough.'),
            [('A number of clients have left.', 'Sind es einige Kunden?', 'Are there several clients?', True)],
            ('Geht es um einige Dinge oder um die Zahl selbst? A number of: Plural. The number of: Singular.', 'Is it about several things or the figure itself? A number of: plural. The number of: singular.')),
]

FILE = topic_file(T, ('Ich kann Verneinung und Mengen genau ausdrücken: none of und neither of, hardly und scarcely, no longer sowie a number of und the number of.',
                      'I can express negation and quantity precisely: none of and neither of, hardly and scarcely, no longer, and a number of versus the number of.'),
                  PAT, [['qn.none', 'qn.hardly'], ['qn.no-longer', 'qn.number']],
                  (['Meinst du „keiner von diesen“? Nimm none of, bei zwei neither of.',
                    'Meinst du „kaum“? Nimm hardly, scarcely oder barely, ohne zweites not.',
                    'Meinst du „nicht mehr“? Nimm no longer. Geht es um Mengen? Prüfe a number of und the number of.'],
                   ['Do you mean “not one of these”? Use none of, with two things neither of.',
                    'Do you mean “barely”? Use hardly, scarcely or barely, without a second not.',
                    'Do you mean “not any more”? Use no longer. Is it about amounts? Check a number of and the number of.']))

RULES = rules_from(PAT,
    ('Hardly, scarcely und barely sind schon verneint. None of und neither of stehen für „keiner“. No longer heißt „nicht mehr“. A number of nimmt Plural, the number of Singular.',
     'Hardly, scarcely and barely are already negative. None of and neither of stand for “not one”. No longer means “not any more”. A number of takes plural, the number of singular.'),
    ('Im Beruf brauchst du genaue Mengen: „None of the suppliers …“, „We no longer offer …“, „The number of complaints has fallen“. Das klingt klar und sicher.',
     'At work you need exact amounts: “None of the suppliers …”, “We no longer offer …”, “The number of complaints has fallen”. It sounds clear and sure.'),
    ('Nicht verwechseln: Das deutsche „nicht mehr“ ist bei der Zeit no longer, nicht no more. „Kaum“ braucht kein zweites not.',
     'Do not mix up: the German “nicht mehr” is no longer for time, not no more. “Kaum” needs no second not.'),
    (['Keiner von diesen? none of / neither of.', 'Kaum? hardly / scarcely / barely, ohne not.', 'Nicht mehr? no longer.', 'Einige oder die Zahl? a number of / the number of.'],
     ['Not one of these? none of / neither of.', 'Barely? hardly / scarcely / barely, without not.', 'Not any more? no longer.', 'Several or the figure? a number of / the number of.']))

V = V2('qn')
V.kwt('qn.none', 'No supplier among those we asked has replied yet.', 'NONE', '___ the suppliers has replied yet.', 'None of', (2, 2),
      ('Richtig: None of the suppliers has replied. None of heißt „keiner von“.', 'Right: None of the suppliers has replied. None of means “not one of”.'),
      [{'if': ['none'], 'not': ['of'], 'de': 'Vor einem bestimmten Nomen braucht es none of.', 'en': 'Before a specific noun you need none of.'}])
V.kwt('qn.none', 'Both offers fail to meet our budget.', 'NEITHER', '___ the offers meets our budget.', 'Neither of', (2, 2),
      ('Richtig: Neither of the offers meets our budget. Neither of steht bei genau zwei Dingen.', 'Right: Neither of the offers meets our budget. Neither of is used with exactly two things.'),
      [{'if': ['neither'], 'not': ['of'], 'de': 'Vor einem bestimmten Nomen braucht es neither of.', 'en': 'Before a specific noun you need neither of.'}])
V.kwt('qn.hardly', 'We had almost no time to prepare.', 'HARDLY', 'We ___ any time to prepare.', 'hardly had', (2, 2),
      ('Richtig: We hardly had any time. Hardly ist schon verneint, deshalb kein not.', 'Right: We hardly had any time. Hardly is already negative, so no not.'),
      [{'if': ['hardly'], 'not': ['had'], 'de': 'Hardly steht vor dem Verb: hardly had.', 'en': 'Hardly stands before the verb: hardly had.'}], )
V.kwt('qn.hardly', 'The team almost never misses a deadline.', 'SCARCELY', 'The team ___ misses a deadline.', 'scarcely ever', (2, 2),
      ('Richtig: The team scarcely ever misses a deadline. Scarcely ever ist die Wendung für „fast nie“.', 'Right: The team scarcely ever misses a deadline. Scarcely ever means “almost never”.'),
      [{'if': ['scarcely'], 'not': ['ever'], 'de': 'Zu scarcely gehört hier ever: scarcely ever.', 'en': 'Scarcely goes with ever here: scarcely ever.'}], )
V.kwt('qn.no-longer', 'We stopped offering this service last year.', 'LONGER', 'We ___ offer this service.', 'no longer', (2, 2),
      ('Richtig: We no longer offer this service. No longer steht vor dem Verb.', 'Right: We no longer offer this service. No longer stands before the verb.'),
      [{'if': ['longer'], 'not': ['no'], 'de': 'Vor longer braucht es no: no longer.', 'en': 'Before longer you need no: no longer.'}])
V.kwt('qn.no-longer', 'He left the company last spring.', 'MORE', 'He does not work here ___.', 'any more', (2, 2),
      ('Richtig: He does not work here any more. Am Ende steht any more oder any longer.', 'Right: He does not work here any more. At the end any more or any longer is used.'),
      [{'if': ['more'], 'not': ['any'], 'de': 'Nach not braucht es any more.', 'en': 'After not you need any more.'}], )
V.kwt('qn.number', 'Many customers have complained about the delay.', 'NUMBER', '___ customers have complained about the delay.', 'A number of', (3, 3),
      ('Richtig: A number of customers have complained. A number of heißt „einige“ und nimmt das Verb im Plural.', 'Right: A number of customers have complained. A number of means “several” and takes a plural verb.'),
      [{'if': ['number'], 'not': ['of'], 'de': 'Nach number braucht es of.', 'en': 'After number you need of.'}])
V.kwt('qn.number', 'Complaints have fallen over the last quarter.', 'NUMBER', '___ complaints has fallen over the last quarter.', 'The number of', (3, 3),
      ('Richtig: The number of complaints has fallen. Bei the number of steht das Verb im Singular.', 'Right: The number of complaints has fallen. With the number of the verb is singular.'),
      [{'if': ['number'], 'not': ['the'], 'de': 'Für die Zahl selbst braucht es the number of.', 'en': 'For the figure itself you need the number of.'}])
V.find('qn.none', 'No one of the suppliers has replied to our inquiry yet.', (0, 2), 'None of', 'None of the suppliers has replied to our inquiry yet.',
       ('Der Fehler: Für „keiner von“ steht none of. Richtig: None of the suppliers.', 'The error: for “not one of” none of is used. Correct: None of the suppliers.'),
       ('Statt no one of steht none of.', 'Instead of no one of, none of is used.'))
V.find('qn.none', 'I did not receive any of the documents you mentioned.', None, None, None,
       ('Richtig: not … any of heißt „keines von“.', 'Right: not … any of means “none of”.'),
       ('not any of ist richtig gebildet.', 'not any of is correctly formed.'))
V.find('qn.hardly', 'There was not hardly any time left to prepare for the audit.', (2, 3), 'hardly', 'There was hardly any time left to prepare for the audit.',
       ('Der Fehler: Hardly ist schon verneint, ein zweites not ist zu viel.', 'The error: hardly is already negative, a second not is too much.'),
       ('Hardly braucht kein not.', 'Hardly needs no not.'))
V.find('qn.hardly', 'We barely noticed the change in the schedule.', None, None, None,
       ('Richtig: barely noticed ist „kaum bemerkt“.', 'Right: barely noticed means “hardly noticed”.'),
       ('barely noticed ist richtig gebildet.', 'barely noticed is correctly formed.'))
V.find('qn.no-longer', 'Our team no more supports the old software version.', (2, 3), 'no longer', 'Our team no longer supports the old software version.',
       ('Der Fehler: Für „nicht mehr“ bei der Zeit steht no longer.', 'The error: for “not any more” in time no longer is used.'),
       ('No more steht bei Mengen, hier gilt no longer.', 'No more is used with amounts, here no longer applies.'))
V.find('qn.no-longer', 'The old system is not longer supported by the vendor.', (4, 5), 'no longer', 'The old system is no longer supported by the vendor.',
       ('Der Fehler: Es heißt no longer, nicht not longer.', 'The error: it is no longer, not not longer.'),
       ('Die feste Form heißt no longer.', 'The fixed form is no longer.'))
V.find('qn.number', 'The number of requests have doubled since the update.', (4, 4), 'has', 'The number of requests has doubled since the update.',
       ('Der Fehler: Bei the number of steht das Verb im Singular: has.', 'The error: with the number of the verb is singular: has.'),
       ('Kern ist number, deshalb Singular.', 'The core is number, so singular.'))
V.find('qn.number', 'A number of clients has asked about the new tariff.', (4, 4), 'have', 'A number of clients have asked about the new tariff.',
       ('Der Fehler: Bei a number of steht das Verb im Plural: have.', 'The error: with a number of the verb is plural: have.'),
       ('A number of heißt „einige“, deshalb Plural.', 'A number of means “several”, so plural.'))
V.meaning('qn.none', 'None of the offers is ready.', 'Not all of the offers are ready.',
          ('Welcher Satz sagt, dass kein einziges Angebot fertig ist?', 'Which sentence says that not a single offer is ready?'), 'a',
          ('Richtig: Satz a. None of ist: kein einziges.', 'Right: sentence a. None of means: not a single one.'),
          [('b', 'In b sind einige Angebote fertig.', 'In b some offers are ready.'), ('both', 'Nicht gleich: Nur a sagt, dass keines fertig ist.', 'Not the same: only a says none is ready.')])
V.meaning('qn.hardly', 'We hardly had any time.', 'We had plenty of time.',
          ('Welcher Satz sagt, dass fast keine Zeit da war?', 'Which sentence says that there was almost no time?'), 'a',
          ('Richtig: Satz a. Hardly any ist: kaum etwas.', 'Right: sentence a. Hardly any means: almost none.'),
          [('b', 'In b war viel Zeit da, nicht wenig.', 'In b there was plenty of time.'), ('both', 'Die Sätze sagen Gegensätzliches.', 'The sentences say opposite things.')])
V.meaning('qn.no-longer', 'He no longer works here.', 'He does not work here yet.',
          ('Welcher Satz sagt, dass er früher hier gearbeitet hat?', 'Which sentence says that he used to work here?'), 'a',
          ('Richtig: Satz a. No longer heißt: früher ja, jetzt nein.', 'Right: sentence a. No longer means: before yes, now no.'),
          [('b', 'In b hat er noch nicht angefangen. Das ist etwas anderes.', 'In b he has not started yet. That is something else.'), ('both', 'Nicht gleich: Nur a meint, dass er früher hier war.', 'Not the same: only a means he was here before.')])
V.meaning('qn.number', 'A number of clients have left.', 'The number of clients has fallen.',
          ('Welcher Satz sagt, dass einige Kunden gegangen sind?', 'Which sentence says that several clients have left?'), 'a',
          ('Richtig: Satz a. A number of ist „einige“.', 'Right: sentence a. A number of means “several”.'),
          [('b', 'In b geht es um die Zahl der Kunden, die gesunken ist.', 'In b it is about the figure of clients, which has fallen.'), ('both', 'Nicht gleich: Nur a nennt einige Kunden.', 'Not the same: only a names several clients.')])

ORDER = [
    order_item('qn.none', 'None of the offers meets our budget.', 'Keines der Angebote passt in unser Budget.',
               ['none of', 'the offers', 'meets', 'our', 'budget'],
               ('None of heißt „keiner von“. Danach folgt das bestimmte Nomen the offers.', 'None of means “not one of”. The specific noun the offers follows.'),
               'No one of the offers meets our budget.', ('none of', 'no one of', 'Für „keiner von“ steht none of.', 'For “not one of” none of is used.'),
               single='None of bildet den Anfang; the offers meets our budget folgt danach.'),
    order_item('qn.none', 'Neither of the managers attended the workshop.', 'Keiner der beiden Manager nahm am Workshop teil.',
               ['neither of', 'the managers', 'attended', 'the', 'workshop'],
               ('Neither of steht bei genau zwei Personen. Danach folgt das Nomen the managers.', 'Neither of is used with exactly two people. The noun the managers follows.'),
               'Not of the managers attended the workshop.', ('neither of', 'not of', 'Für „keiner von beiden“ steht neither of.', 'For “neither of the two” neither of is used.'),
               single='Neither of bildet den Anfang; the managers attended the workshop folgt danach.'),
    order_item('qn.hardly', 'We hardly had any time to prepare for the call.', 'Wir hatten kaum Zeit, uns auf das Gespräch vorzubereiten.',
               ['we', 'hardly', 'had', 'any time', 'to prepare', 'for the call'],
               ('Hardly steht vor dem Verb und ist schon verneint. Danach folgt any time.', 'Hardly stands before the verb and is already negative. Any time follows.'),
               'We did not hardly have any time to prepare for the call.', ('hardly', 'did not hardly', 'Hardly braucht kein zweites not.', 'Hardly needs no second not.'),
               single='We hardly had bildet den Anfang; any time to prepare for the call folgt danach.'),
    order_item('qn.hardly', 'The team scarcely ever misses a deadline.', 'Das Team verpasst fast nie eine Frist.',
               ['the team', 'scarcely ever', 'misses', 'a', 'deadline'],
               ('Scarcely ever heißt „fast nie“ und ist schon verneint.', 'Scarcely ever means “almost never” and is already negative.'),
               'The team does not scarcely ever miss a deadline.', ('scarcely ever', 'does not scarcely ever', 'Scarcely braucht kein not.', 'Scarcely needs no not.'),
               single='The team scarcely ever bildet den Anfang; misses a deadline folgt danach.'),
    order_item('qn.no-longer', 'We no longer offer this service to private customers.', 'Wir bieten diesen Service privaten Kunden nicht mehr an.',
               ['we', 'no longer', 'offer', 'this service', 'to private customers'],
               ('No longer steht vor dem Verb und heißt „nicht mehr“.', 'No longer stands before the verb and means “not any more”.'),
               'We no more offer this service to private customers.', ('no longer', 'no more', 'Für „nicht mehr“ bei der Zeit steht no longer.', 'For “not any more” in time no longer is used.'),
               single='We no longer bildet den Anfang; offer this service to private customers folgt danach.'),
    order_item('qn.no-longer', 'He does not work here any more.', 'Er arbeitet nicht mehr hier.',
               ['he', 'does not', 'work', 'here', 'any more'],
               ('Nach does not steht am Ende any more und bedeutet „nicht mehr“.', 'After does not, any more at the end means “not any more”.'),
               'He does not work here no more.', ('any more', 'no more', 'Nach not steht kein zweites no.', 'After not no second no follows.'),
               single='He does not work bildet den Anfang; here any more folgt danach.'),
    order_item('qn.number', 'A number of customers have complained about the delay.', 'Einige Kunden haben sich über die Verzögerung beschwert.',
               ['a number of', 'customers', 'have', 'complained', 'about the delay'],
               ('A number of heißt „einige“ und nimmt das Verb im Plural: have.', 'A number of means “several” and takes a plural verb: have.'),
               'A number of customers has complained about the delay.', ('have', 'has', 'Bei a number of steht das Verb im Plural.', 'With a number of the verb is plural.'),
               single='A number of customers bildet den Anfang; have complained about the delay folgt danach.'),
    order_item('qn.number', 'The number of complaints has fallen since March.', 'Die Zahl der Beschwerden ist seit März gesunken.',
               ['the number of', 'complaints', 'has', 'fallen', 'since March'],
               ('The number of meint die Zahl selbst und nimmt das Verb im Singular: has.', 'The number of means the figure itself and takes a singular verb: has.'),
               'The number of complaints have fallen since March.', ('has', 'have', 'Bei the number of steht das Verb im Singular.', 'With the number of the verb is singular.'),
               single='The number of complaints bildet den Anfang; has fallen since March folgt danach.'),
]

MAP = {
    'No one of the suppliers has replied yet.': {'pat': 'qn.none', 'why': {
        'ok': B('Für „keiner von“ steht none of: None of the suppliers has replied.', 'For “not one of” none of is used: None of the suppliers has replied.'),
        'wrong': [{'if': ['no', 'one', 'of'], 'de': 'No one of ist deutsch gedacht. Es braucht none of.', 'en': 'No one of is German thinking. It needs none of.'},
                  {'not': ['none'], 'de': 'Hier steht none of.', 'en': 'Here none of is used.'}]}},
    'We did not hardly have any time to prepare.': {'pat': 'qn.hardly', 'why': {
        'ok': B('Hardly ist schon verneint: We hardly had any time.', 'Hardly is already negative: We hardly had any time.'),
        'wrong': [{'if': ['not', 'hardly'], 'de': 'Hardly ist schon verneint, ein zweites not ist zu viel.', 'en': 'Hardly needs no second not.'},
                  {'not': ['hardly'], 'de': 'Das Wort für „kaum“ fehlt: hardly.', 'en': 'The word for “barely” is missing: hardly.'}]}},
    'We no more offer this service.': {'pat': 'qn.no-longer', 'why': {
        'ok': B('Für „nicht mehr“ bei der Zeit steht no longer: We no longer offer this service.', 'For “not any more” in time no longer is used: We no longer offer this service.'),
        'wrong': [{'if': ['no', 'more'], 'de': 'No more steht bei Mengen. Hier gilt no longer.', 'en': 'No more is used with amounts. Here no longer applies.'},
                  {'not': ['longer'], 'de': 'Hier ist no longer nötig, nicht no more.', 'en': 'It needs no longer.'}]}},
    'The number of customers have risen sharply this year.': {'pat': 'qn.number', 'why': {
        'ok': B('Bei the number of steht das Verb im Singular: The number of customers has risen.', 'With the number of the verb is singular: The number of customers has risen.'),
        'wrong': [{'if': ['have'], 'de': 'Kern ist number, deshalb has statt have.', 'en': 'The core is number, so has instead of have.'},
                  {'not': ['has'], 'de': 'Das Verb heißt has.', 'en': 'The verb is has.'}]}},
}

def c1x():
    mcc(T, 'qn.none', 'C1', 'biz', 0.0, '___ the candidates we interviewed meets all of the requirements.',
        'None of', ['No one of', 'Not of', 'Nobody of'],
        ('None of heißt „keiner von“. Danach folgt das bestimmte Nomen the candidates.', 'None of means “not one of”. The specific noun the candidates follows.'),
        [(C, 'No one of ist deutsch gedacht. Es braucht none of.', 'No one of is German thinking. It needs none of.'),
         (G, 'Not of ist keine feste Form für „keiner von“.', 'Not of is not a fixed form for “not one of”.'),
         (G, 'Nobody of gibt es nicht. Es heißt none of.', 'Nobody of does not exist. It is none of.')])
    mcc(T, 'qn.hardly', 'C1', 'biz', 0.0, 'The audit team ___ any errors in the final accounts.',
        'hardly found', ['did not hardly find', 'found hardly not', 'hardly not found'],
        ('Hardly ist schon verneint und steht vor dem Verb: hardly found.', 'Hardly is already negative and stands before the verb: hardly found.'),
        [(G, 'Hardly braucht kein zweites not.', 'Hardly needs no second not.'),
         (G, 'Hardly steht vor dem Verb, und not ist überflüssig.', 'Hardly stands before the verb, and not is superfluous.'),
         (G, 'Zwei Verneinungen heben sich nicht auf, sie passen hier nicht.', 'Two negatives do not fit here.')])
    mcc(T, 'qn.no-longer', 'C1', 'biz', 0.0, 'Our supplier ___ the old model, so we have to switch to the new one.',
        'no longer produces', ['no more produces', 'is not longer producing', 'does not produce longer'],
        ('No longer steht vor dem Verb und heißt „nicht mehr“.', 'No longer stands before the verb and means “not any more”.'),
        [(G, 'No more steht bei Mengen. Für die Zeit gilt no longer.', 'No more is used with amounts. For time no longer applies.'),
         (G, 'Es heißt no longer, nicht not longer.', 'It is no longer, not not longer.'),
         (G, 'Longer steht nicht am Ende dieser Form.', 'Longer does not stand at the end of this form.')])
    mcc(T, 'qn.number', 'C1', 'biz', 0.0, 'The number of open tickets ___ since we hired two more engineers.',
        'has dropped', ['have dropped', 'are dropping', 'were dropped'],
        ('Bei the number of steht das Verb im Singular: has dropped.', 'With the number of the verb is singular: has dropped.'),
        [(G, 'Kern ist number, deshalb has statt have.', 'The core is number, so has instead of have.'),
         (G, 'Are dropping passt nicht zu since.', 'Are dropping does not fit since.'),
         (G, 'Were dropped ist Passiv, und die Zeitform stimmt nicht.', 'Were dropped is passive, and the tense is wrong.')])
    mcc(T, 'qn.none', 'C1', 'life', 0.0, 'I looked at four flats, but ___ them had a balcony.',
        'none of', ['no one of', 'not of', 'nothing of'],
        ('None of heißt „keine von“. Danach folgt das Pronomen them.', 'None of means “not one of”. The pronoun them follows.'),
        [(C, 'No one of ist deutsch gedacht. Es braucht none of.', 'No one of is German thinking. It needs none of.'),
         (G, 'Not of ist keine feste Form.', 'Not of is not a fixed form.'),
         (G, 'Nothing steht für Sachen ohne Zahl, hier geht es um vier Wohnungen.', 'Nothing stands for things without number, here it is four flats.')])
    mcc(T, 'qn.number', 'C1', 'life', 0.0, 'A number of my friends ___ moved abroad in the last few years.',
        'have', ['has', 'is', 'was'],
        ('A number of heißt „einige“ und nimmt das Verb im Plural: have moved.', 'A number of means “several” and takes a plural verb: have moved.'),
        [(G, 'Bei a number of steht das Verb im Plural.', 'With a number of the verb is plural.'),
         (G, 'Is passt nicht zu moved.', 'Is does not fit moved.'),
         (G, 'Was passt nicht zu in the last few years.', 'Was does not fit in the last few years.')])

    ocl(T, 'qn.none', 'C1', 'biz', 0.0, 'Neither ___ the two proposals fits our timeline, so we need a third option.',
        ['of'], 'prep', ['from', 'to', 'for'],
        ('Nach neither steht of und das bestimmte Nomen: neither of the proposals.', 'After neither comes of and the specific noun: neither of the proposals.'))
    ocl(T, 'qn.hardly', 'C1', 'biz', 0.0, 'We have ___ ever had a complaint about this product line.',
        ['hardly', 'scarcely', 'barely'], 'adv', ['nearly', 'almost', 'none'],
        ('Hardly ever heißt „fast nie“. Hardly ist schon verneint.', 'Hardly ever means “almost never”. Hardly is already negative.'))
    ocl(T, 'qn.no-longer', 'C1', 'biz', 0.0, 'The old contract is no ___ valid because it expired in June.',
        ['longer'], 'adv', ['later', 'farther', 'shorter'],
        ('No longer heißt „nicht mehr“.', 'No longer means “not any more”.'))
    ocl(T, 'qn.number', 'C1', 'biz', 0.0, 'A large ___ of our customers have switched to the annual plan.',
        ['number'], 'det', ['amount', 'deal', 'quantity'],
        ('A large number of steht vor zählbaren Nomen im Plural.', 'A large number of is used before countable plural nouns.'))
    ocl(T, 'qn.hardly', 'C1', 'life', 0.0, 'There is ___ any milk left, so I will go to the shop.',
        ['hardly', 'barely', 'scarcely'], 'adv', ['nearly', 'almost', 'none'],
        ('Hardly any heißt „kaum etwas“. Hardly ist schon verneint.', 'Hardly any means “almost none”. Hardly is already negative.'))
    ocl(T, 'qn.none', 'C1', 'life', 0.0, 'I invited ten colleagues, but ___ of them could come on Saturday.',
        ['none'], 'pron', ['no', 'nobody', 'not'],
        ('None of them heißt „keiner von ihnen“.', 'None of them means “not one of them”.'))

    err(T, 'qn.none', 'C1', 'biz', 0.0, 'No one of the shortlisted vendors has submitted a complete proposal.',
        ('No one of', ['None of'], ['None of', 'Nothing of', 'No of']),
        ('Für „keiner von“ mit Nomen steht none of.', 'For “not one of” with a noun none of is used.'))
    err(T, 'qn.hardly', 'C1', 'biz', 0.0, 'We did not hardly change the layout, only the colors.',
        ('did not hardly change', ['hardly changed'], ['hardly changed', 'did hardly changed', 'not hardly changed']),
        ('Hardly ist schon verneint, ein zweites not ist zu viel.', 'Hardly is already negative, a second not is too much.'))
    err(T, 'qn.no-longer', 'C1', 'biz', 0.0, 'The platform is not longer available for customers in the EU.',
        ('not longer', ['no longer'], ['no longer', 'not later', 'non longer']),
        ('Die feste Form heißt no longer.', 'The fixed form is no longer.'))
    err(T, 'qn.number', 'C1', 'biz', 0.0, 'The number of defects have fallen sharply since we changed supplier.',
        ('number of defects have', ['number of defects has'], ['number of defects has', 'number of defects are', 'numbers of defects have']),
        ('Bei the number of steht das Verb im Singular: has.', 'With the number of the verb is singular: has.'))
    err(T, 'qn.hardly', 'C1', 'life', 0.0, 'There was hardly any traffic, so we arrived early.', None,
        ('Kein Fehler: Hardly any heißt „kaum“ und braucht kein not.', 'No mistake: hardly any means “barely any” and needs no not.'))
    err(T, 'qn.none', 'C1', 'life', 0.0, 'None of my cousins lives in the same city as my parents.', None,
        ('Kein Fehler: None of + Nomen heißt „keiner von“.', 'No mistake: none of + noun means “not one of”.'))

    kwt(T, 'qn.none', 'C1', 'biz', 0.0, 'Both proposals fail to meet our requirements.', 'NEITHER', '', 'meets our requirements.',
        [(['Neither of'], ['the proposals'])], ['of', 'the', 'proposals'], ['No', 'none', 'not'], [],
        ('Neither of the proposals meets … Neither of steht bei genau zwei Dingen.', 'Neither of the proposals meets … Neither of is used with exactly two things.'), [])
    kwt(T, 'qn.hardly', 'C1', 'biz', 0.0, 'We had almost no time to prepare the presentation.', 'HARDLY', 'We', 'to prepare the presentation.',
        [(['hardly'], ['had any time'])], ['had', 'any', 'time'], ['not', 'no', 'did'], [],
        ('hardly had any time. Hardly ist schon verneint.', 'hardly had any time. Hardly is already negative.'), [])
    kwt(T, 'qn.no-longer', 'C1', 'biz', 0.0, 'The vendor stopped supporting this version last year.', 'LONGER', 'The vendor', 'this version.',
        [(['no longer'], ['supports'])], ['no', 'supports'], ['not', 'more', 'supported'], [],
        ('no longer supports. No longer steht vor dem Verb.', 'no longer supports. No longer stands before the verb.'), [])
    kwt(T, 'qn.number', 'C1', 'biz', 0.0, 'Many clients have asked for a refund this month.', 'NUMBER', '', 'for a refund this month.',
        [(['A number of'], ['clients have asked'])], ['A', 'of', 'clients', 'have', 'asked'], ['has', 'amount', 'deal'], [],
        ('A number of clients have asked. A number of nimmt das Verb im Plural.', 'A number of clients have asked. A number of takes a plural verb.'), [])
    kwt(T, 'qn.hardly', 'C1', 'life', 0.0, 'I almost never watch television in the evening.', 'SCARCELY', 'I', 'television in the evening.',
        [(['scarcely ever'], ['watch'])], ['ever', 'watch'], ['not', 'never', 'hardly'], [],
        ('scarcely ever watch. Scarcely ever heißt „fast nie“.', 'scarcely ever watch. Scarcely ever means “almost never”.'), [])
    kwt(T, 'qn.none', 'C1', 'life', 0.0, 'Nobody among my neighbors owns a car.', 'NONE', '', 'has a car.',
        [(['None of'], ['my neighbors'])], ['of', 'my', 'neighbors'], ['No', 'nobody', 'not'], [],
        ('None of my neighbors has a car. None of heißt „keiner von“.', 'None of my neighbors has a car. None of means “not one of”.'), [])

def place():
    mcc(T, 'qn.number', 'B2+', 'biz', -0.1, 'The number of applications ___ risen sharply this year.',
        'has', ['have', 'are', 'were'],
        ('Bei the number of steht das Verb im Singular: has risen.', 'With the number of the verb is singular: has risen.'),
        [(G, 'Kern ist number, deshalb has statt have.', 'The core is number, so has instead of have.'),
         (G, 'Are passt nicht zu risen.', 'Are does not fit risen.'),
         (G, 'Were passt nicht zu risen.', 'Were does not fit risen.')])
    kwt(T, 'qn.hardly', 'C1', 'life', 0.0, 'I had almost no energy left after the long hike.', 'HARDLY', 'I', 'left after the long hike.',
        [(['hardly'], ['had any energy'])], ['had', 'any', 'energy'], ['not', 'no', 'did'], [],
        ('hardly had any energy. Hardly ist schon verneint.', 'hardly had any energy. Hardly is already negative.'), [])
