from cm import *
import lib
from lib import mcc, ocl, err, kwt, W

G = 'grammar'; M = 'meaning'; C = 'calque'; P = 'partner'; R = 'register'
T = 'noun-phrase'

TOPIC = {
    'id': T, 'group': 'Grammatik-Pfad', 'level': 'C1', 'p0': 0.45,
    'name': 'Nominalgruppen – das Nomen ausbauen', 'name_en': 'Noun phrases: building around the noun',
    'rule': 'Um ein Nomen herum baut man Information auf: einen Satz ohne that („the system we tested“), ein Partizip („the files stored in the cloud“), ’s oder of („the manager’s decision“) und einen to-Infinitiv („the first to sign“).',
    'rule_en': 'You build information around a noun: a clause without that (“the system we tested”), a participle (“the files stored in the cloud”), ’s or of (“the manager’s decision”) and a to-infinitive (“the first to sign”).',
    'ex': ['This is the most reliable system we have tested.', 'She was the first customer to sign the new contract.'],
}

PAT = [
    pattern('np.contact', ('Nomen + Satz ohne that · the system we tested', 'noun + clause without that · the system we tested'),
            ('the + Superlativ / first / only + Nomen + (that) + Subjekt + Verb', 'the + superlative / first / only + noun + (that) + subject + verb'),
            ('Ein Relativsatz darf sein Relativpronomen verlieren, wenn es Objekt ist. Nach Superlativen, first, last und only steht er besonders oft.',
             'A relative clause may drop its pronoun when the pronoun is the object. It does so most often after superlatives, first, last and only.'),
            ['the most reliable', 'the only', 'the first', 'the best', 'the one we'],
            [('This is the most reliable system we have tested.', 'Das ist das zuverlässigste System, das wir getestet haben.', 'meeting'),
             ('The report you sent was very helpful.', 'Der Bericht, den Sie geschickt haben, war sehr hilfreich.', 'mail'),
             ('Is this the only option we have?', 'Ist das die einzige Möglichkeit, die wir haben?', 'talk')],
            ('This is the most reliable system what we have tested.', 'This is the most reliable system we have tested.',
             'Das Deutsche sagt „das System, das wir getestet haben“ mit Relativpronomen. Im Englischen entfällt es oft ganz, und „what“ ist nach einem Nomen nie ein Relativpronomen.',
             'German says “das System, das wir getestet haben” with a relative pronoun. English often drops it, and “what” is never a relative pronoun after a noun.'),
            ('rc.who-which', 'the system we tested', 'the system that we tested',
             'Gleiche Bedeutung. Ohne that klingt es knapper.', 'Same meaning. Without that it sounds shorter.'),
            [('This is the best offer we have received.', 'Ist es das beste Angebot, das wir bekommen haben?', 'Is it the best offer we have received?', True)],
            ('Ist das Relativpronomen Objekt? Dann darf es wegfallen. Subjekt und Verb folgen direkt auf das Nomen.', 'Is the relative pronoun the object? Then it may be dropped. Subject and verb follow the noun directly.')),
    pattern('np.participle', ('Partizip statt Relativsatz · the files stored', 'participle instead of a clause · the files stored'),
            ('Nomen + -ing / 3. Form (+ Zusatz)', 'noun + -ing / past participle (+ phrase)'),
            ('Statt eines Relativsatzes steht ein Partizip direkt hinter dem Nomen: -ing für aktive, die 3. Form für passive Bedeutung. Das macht den Satz kürzer.',
             'Instead of a relative clause a participle stands right after the noun: -ing for active, the past participle for passive meaning. This makes the sentence shorter.'),
            ['the team working', 'the files stored', 'the people involved', 'any questions raised', 'the issues related'],
            [('The team working on the migration meets every Monday.', 'Das Team, das an der Migration arbeitet, trifft sich montags.', 'meeting'),
             ('All files stored in the cloud are encrypted.', 'Alle in der Cloud gespeicherten Dateien sind verschlüsselt.', 'mail'),
             ('Please contact the people involved in the project.', 'Bitte kontaktieren Sie die am Projekt Beteiligten.', 'talk')],
            ('The people involving in the project agreed.', 'The people involved in the project agreed.',
             'Die Beteiligten werden beteiligt, sie beteiligen nichts. Passive Bedeutung braucht die 3. Form, nicht -ing.',
             'The people are involved by others, they do not involve anything. Passive meaning needs the past participle, not -ing.'),
            ('rc.who-which', 'the files that are stored in the cloud', 'the files stored in the cloud',
             'Gleiche Bedeutung. Das Partizip lässt that are weg.', 'Same meaning. The participle drops that are.'),
            [('The people involved in the project agreed.', 'Sind die Personen am Projekt beteiligt?', 'Are the people involved in the project?', True)],
            ('Hat das Nomen etwas getan (-ing) oder wurde mit ihm etwas getan (3. Form)?', 'Is the noun doing something (-ing) or having something done to it (past participle)?')),
    pattern('np.of-s', ("'s oder of · the company's CEO", "'s or of · the company's CEO"),
            ("Person / Firma + 's + Nomen · Nomen + of + Sache", "Person / company + 's + noun · noun + of + thing"),
            ("Bei Personen, Firmen und Zeitangaben steht oft ’s: the manager’s decision, today’s meeting. Bei Dingen und längeren Gruppen steht of: the end of the year.",
             "With people, companies and time words ’s is common: the manager’s decision, today’s meeting. With things and longer groups of is used: the end of the year."),
            ["'s", "s'", 'of the', "a day's", "today's"],
            [("The company's new CEO starts on Monday.", 'Der neue Chef der Firma fängt am Montag an.', 'meeting'),
             ('We reached the end of the quarter.', 'Wir haben das Ende des Quartals erreicht.', 'talk'),
             ("Please send me yesterday's figures.", 'Schicken Sie mir bitte die Zahlen von gestern.', 'mail')],
            ('The managers decision surprised everyone.', "The manager's decision surprised everyone.",
             'Der Besitz steht mit Apostroph und s. Das Deutsche kennt diesen Apostroph nicht, daher fehlt er leicht.',
             'Possession takes an apostrophe and s. German has no such apostrophe, so it is easily missing.'),
            ('pn.of', "the manager's decision", 'the decision of the manager',
             'Beides ist möglich. Das ’s klingt bei Personen natürlicher, of bei längeren Gruppen.', 'Both are possible. The ’s sounds more natural with people, of with longer groups.'),
            [("Today's meeting was cancelled.", 'Wurde das Meeting von heute abgesagt?', 'Was the meeting from today cancelled?', True)],
            ('Ist der Besitzer eine Person, eine Firma oder eine Zeitangabe? Dann ’s. Sonst of.', 'Is the owner a person, a company or a time word? Then ’s. Otherwise of.')),
    pattern('np.to-inf', ('Nomen + to-Infinitiv · the first to sign', 'noun + to-infinitive · the first to sign'),
            ('the first / last / only / best way + to + Grundform', 'the first / last / only / best way + to + base form'),
            ('Nach first, last, only, next und nach Nomen wie way, time, chance steht der to-Infinitiv. Er bestimmt das Nomen näher.',
             'After first, last, only, next and after nouns like way, time, chance the to-infinitive follows. It describes the noun more closely.'),
            ['the first to', 'the only one to', 'the best way to', 'a chance to', 'the last to'],
            [('She was the first customer to sign the new contract.', 'Sie war die erste Kundin, die den neuen Vertrag unterschrieb.', 'talk'),
             ('This is the best way to reduce costs.', 'Das ist der beste Weg, die Kosten zu senken.', 'meeting'),
             ('We need someone to lead the migration.', 'Wir brauchen jemanden, der die Migration leitet.', 'mail')],
            ('This is the best way for reduce costs.', 'This is the best way to reduce costs.',
             'Das Deutsche sagt „der beste Weg, um … zu“. Im Englischen folgt nach way direkt to + Grundform, nicht for.',
             'German says “der beste Weg, um … zu”. In English to + base form follows way directly, not for.'),
            ('np.contact', 'the first customer to sign', 'the first customer who signed',
             'Gleiche Aussage. To sign ist knapper und passt nach first, last und only.', 'Same statement. To sign is shorter and fits after first, last and only.'),
            [('She was the first customer to sign.', 'Haben andere Kunden vor ihr unterschrieben?', 'Did other customers sign before her?', False)],
            ('Folgt auf first, last, only oder way eine Handlung? Dann passt to + Grundform.', 'Does an action follow first, last, only or way? Then to + base form fits.')),
]

FILE = topic_file(T, ('Ich kann Nomen ausbauen: mit Sätzen ohne that, mit Partizipien, mit ’s und of und mit to-Infinitiv („the most reliable system we have tested“).',
                      'I can build around nouns: with clauses without that, with participles, with ’s and of, and with the to-infinitive (“the most reliable system we have tested”).'),
                  PAT, [['np.contact', 'np.participle'], ['np.of-s', 'np.to-inf']],
                  (['Ist das Relativpronomen Objekt? Dann darf es wegfallen: the system we tested.',
                    'Gibt es ein Verb, das das Nomen tut oder erleidet? Nimm -ing oder die 3. Form: the team working, the files stored.',
                    'Folgt first, last, only oder way? Dann passt to + Grundform: the first to sign.'],
                   ['Is the relative pronoun the object? Then it may be dropped: the system we tested.',
                    'Is there a verb the noun does or undergoes? Use -ing or the past participle: the team working, the files stored.',
                    'Does first, last, only or way come before? Then to + base form fits: the first to sign.']))

RULES = rules_from(PAT,
    ('Du baust Information um ein Nomen herum: ohne that („the system we tested“), mit Partizip („the files stored in the cloud“), mit ’s oder of und mit to + Grundform („the best way to reduce costs“).',
     'You build information around a noun: without that (“the system we tested”), with a participle (“the files stored in the cloud”), with ’s or of and with to + base form (“the best way to reduce costs”).'),
    ('Gute Texte auf C1 packen viel Information in wenige Wörter. Statt zweier Sätze steht eine Nominalgruppe, und das macht Mails und Berichte klar und knapp.',
     'Good C1 writing packs a lot of information into few words. Instead of two sentences there is one noun phrase, which makes emails and reports clear and short.'),
    ('Nicht verwechseln: -ing hat das Nomen aktiv getan (the team working), die 3. Form passiv (the files stored). Ein that darf nur fehlen, wenn es Objekt ist, nie als Subjekt.',
     'Do not mix up: -ing means the noun is doing it (the team working), the past participle means it undergoes it (the files stored). A that may only be dropped when it is the object, never as the subject.'),
    (['Welche Information gehört zum Nomen? Packe sie direkt dahinter.', 'Satz ohne that: nur wenn das Pronomen Objekt ist.', 'Partizip: -ing aktiv, 3. Form passiv.', 'Nach first, last, only, way: to + Grundform.'],
     ['Which information belongs to the noun? Put it right after it.', 'Clause without that: only when the pronoun is the object.', 'Participle: -ing active, past participle passive.', 'After first, last, only, way: to + base form.']))

V = V2('np')
V.kwt('np.contact', 'I liked the report that you sent last week.', 'SENT', 'I liked the report ___ last week.', 'you sent', (2, 2),
      ('Richtig: the report you sent last week. Das Pronomen that ist Objekt und darf fehlen.', 'Right: the report you sent last week. The pronoun that is the object and may be dropped.'),
      [{'if': ['you', 'sent'], 'not': ['sent'], 'de': 'Das Schlüsselwort sent muss in der Lücke stehen.', 'en': 'The key word sent must be in the gap.'}])
V.kwt('np.contact', 'This is the best offer which we have received so far.', 'BEST', 'This is the ___ we have received so far.', 'best offer', (2, 2),
      ('Richtig: the best offer we have received so far. Nach dem Superlativ darf das Pronomen fehlen.', 'Right: the best offer we have received so far. After the superlative the pronoun may be dropped.'),
      [{'if': ['offer'], 'not': ['best'], 'de': 'Das Schlüsselwort best gehört vor offer.', 'en': 'The key word best belongs before offer.'}])
V.kwt('np.participle', 'The staff who are working on the audit meet every Friday.', 'WORKING', 'The ___ the audit meet every Friday.', 'staff working on', (3, 3),
      ('Richtig: The staff working on the audit. Das aktive Partizip ersetzt who are working.', 'Right: The staff working on the audit. The active participle replaces who are working.'),
      [{'if': ['staff', 'working'], 'not': ['on'], 'de': 'Nach working braucht es on: working on the audit.', 'en': 'After working you need on: working on the audit.'}])
V.kwt('np.participle', 'All questions that were raised in the meeting are listed below.', 'RAISED', 'All ___ in the meeting are listed below.', 'questions raised', (2, 2),
      ('Richtig: All questions raised in the meeting. Das passive Partizip ersetzt that were raised.', 'Right: All questions raised in the meeting. The passive participle replaces that were raised.'),
      [{'if': ['raised'], 'not': ['questions'], 'de': 'Das Nomen questions steht vor dem Partizip.', 'en': 'The noun questions stands before the participle.'}])
V.kwt('np.of-s', "The manager's decision surprised everyone.", 'OF', 'The decision ___ surprised everyone.', 'of the manager', (3, 3),
      ('Richtig: The decision of the manager surprised everyone. Of ersetzt das ’s.', 'Right: The decision of the manager surprised everyone. Of replaces the ’s.'),
      [{'if': ['manager'], 'not': ['of'], 'de': 'Das Schlüsselwort of muss vor the manager stehen.', 'en': 'The key word of must come before the manager.'}])
V.kwt('np.of-s', "The company's CEO resigned yesterday.", 'OF', 'The CEO ___ resigned yesterday.', 'of the company', (3, 3),
      ('Richtig: The CEO of the company resigned yesterday. Of ersetzt das ’s.', 'Right: The CEO of the company resigned yesterday. Of replaces the ’s.'),
      [{'if': ['company'], 'not': ['of'], 'de': 'Das Schlüsselwort of muss vor the company stehen.', 'en': 'The key word of must come before the company.'}])
V.kwt('np.to-inf', 'Our CFO was the first person who read the report.', 'FIRST', 'Our CFO was the ___ the report.', 'first person to read', (4, 4),
      ('Richtig: the first person to read the report. Nach first steht der to-Infinitiv.', 'Right: the first person to read the report. After first the to-infinitive follows.'),
      [{'if': ['first', 'person'], 'not': ['to'], 'de': 'Nach first person steht to + Grundform: to read.', 'en': 'After first person comes to + base form: to read.'}])
V.kwt('np.to-inf', 'This is the best way of reducing costs.', 'WAY', 'This is the best ___ costs.', 'way to reduce', (3, 3),
      ('Richtig: the best way to reduce costs. Nach way steht to + Grundform.', 'Right: the best way to reduce costs. After way comes to + base form.'),
      [{'if': ['way'], 'not': ['to'], 'de': 'Nach way steht to + Grundform: to reduce.', 'en': 'After way comes to + base form: to reduce.'}])
V.find('np.contact', 'That was the best presentation what I have seen.', (5, 5), '', 'That was the best presentation I have seen.',
       ('Der Fehler: what ist kein Relativpronomen nach einem Nomen. Richtig: the best presentation I have seen.', 'The error: what is not a relative pronoun after a noun. Correct: the best presentation I have seen.'),
       ('Nach dem Nomen steht that oder nichts, nie what.', 'After the noun comes that or nothing, never what.'))
V.find('np.contact', 'The report that you sent it was very helpful.', (5, 5), '', 'The report that you sent was very helpful.',
       ('Der Fehler: das it ist doppelt, denn that ist schon das Objekt. Richtig: the report that you sent.', 'The error: it is doubled, because that is already the object. Correct: the report that you sent.'),
       ('Das Objekt steht nur einmal, entweder als that oder gar nicht.', 'The object appears only once, either as that or not at all.'))
V.find('np.participle', 'All the files storing in the cloud are encrypted.', (3, 3), 'stored', 'All the files stored in the cloud are encrypted.',
       ('Der Fehler: die Dateien werden gespeichert, also die 3. Form stored.', 'The error: the files are stored, so the past participle stored.'),
       ('Passive Bedeutung braucht die 3. Form.', 'Passive meaning needs the past participle.'))
V.find('np.participle', 'All requests related to the new tool must go through the help desk.', None, None, None,
       ('Richtig: All requests related to the new tool. Das Partizip related ersetzt that are related.', 'Right: All requests related to the new tool. The participle related replaces that are related.'),
       ('All requests related to ist richtig gebildet.', 'All requests related to is correctly formed.'))
V.find('np.of-s', 'The managers decision surprised the whole team.', (1, 1), "manager's", "The manager's decision surprised the whole team.",
       ('Der Fehler: der Besitz braucht den Apostroph. Richtig: the manager’s decision.', 'The error: possession needs the apostrophe. Correct: the manager’s decision.'),
       ('Der Besitz steht mit Apostroph und s.', 'Possession takes an apostrophe and s.'))
V.find('np.of-s', 'The company CEO resigned yesterday.', (1, 2), "company's CEO", "The company's CEO resigned yesterday.",
       ('Der Fehler: zwischen Firma und CEO fehlt das ’s. Richtig: the company’s CEO.', 'The error: the ’s is missing between company and CEO. Correct: the company’s CEO.'),
       ('Der Besitzer braucht ’s.', 'The owner needs ’s.'))
V.find('np.to-inf', 'We need someone lead the migration.', (3, 3), 'to lead', 'We need someone to lead the migration.',
       ('Der Fehler: nach someone steht to + Grundform. Richtig: someone to lead.', 'The error: after someone comes to + base form. Correct: someone to lead.'),
       ('Nach someone braucht es to + Grundform.', 'After someone you need to + base form.'))
V.find('np.to-inf', 'She was the last person to leave the office on Friday.', None, None, None,
       ('Richtig: the last person to leave. Nach last steht to + Grundform.', 'Right: the last person to leave. After last comes to + base form.'),
       ('the last person to leave ist richtig gebildet.', 'the last person to leave is correctly formed.'))
V.meaning('np.contact', 'This is the best offer we have received.', 'This is the best offer that we have received.',
          ('Bedeuten beide Sätze dasselbe?', 'Do both sentences mean the same?'), 'both',
          ('Richtig: beide. Das that darf nach dem Superlativ fehlen.', 'Right: both. The that may be dropped after the superlative.'),
          [('a', 'Nicht nur a: b sagt mit that dasselbe.', 'Not only a: b says the same with that.'), ('b', 'Nicht nur b: a sagt ohne that dasselbe.', 'Not only b: a says the same without that.')])
V.meaning('np.participle', 'The manager criticizing the plan left.', 'The manager criticized by the board left.',
          ('Welcher Satz sagt, dass der Manager kritisiert wurde?', 'Which sentence says that the manager was criticized?'), 'b',
          ('Richtig: Satz b. Die 3. Form criticized hat passive Bedeutung.', 'Right: sentence b. The past participle criticized has passive meaning.'),
          [('a', 'In a kritisiert der Manager den Plan. Das ist aktiv.', 'In a the manager criticizes the plan. That is active.'), ('both', 'Aktiv und passiv sind verschieden.', 'Active and passive are different.')])
V.meaning('np.of-s', "the manager's decision", 'the decision of the managers',
          ('Welcher Ausdruck meint die Entscheidung mehrerer Manager?', 'Which expression means the decision of several managers?'), 'b',
          ('Richtig: b. Managers im Plural mit of meint mehrere Personen.', 'Right: b. Managers in the plural with of means several people.'),
          [('a', 'In a steht manager im Singular: eine Person.', 'In a manager is singular: one person.'), ('both', 'Singular und Plural sind verschieden.', 'Singular and plural are different.')])
V.meaning('np.to-inf', 'She was the first customer to sign.', 'She was the first customer who signed.',
          ('Bedeuten beide Sätze dasselbe?', 'Do both sentences mean the same?'), 'both',
          ('Richtig: beide. To sign ersetzt who signed, nur knapper.', 'Right: both. To sign replaces who signed, just shorter.'),
          [('a', 'Nicht nur a: b sagt dasselbe mit einem Relativsatz.', 'Not only a: b says the same with a relative clause.'), ('b', 'Nicht nur b: a sagt dasselbe kürzer.', 'Not only b: a says the same more briefly.')])

ORDER = [
    order_item('np.contact', 'This is the most reliable system we have tested.', 'Das ist das zuverlässigste System, das wir getestet haben.',
               ['this', 'is', 'the most reliable', 'system', 'we', 'have tested'],
               ('Nach dem Superlativ system folgt der Satz ohne that: we have tested. Das Pronomen ist Objekt und darf fehlen.', 'After the superlative system the clause follows without that: we have tested. The pronoun is the object and may be dropped.'),
               'This is the most reliable system what we have tested.', ('system', 'system what', 'Nach dem Nomen steht nie what, nur that oder nichts.', 'After the noun comes never what, only that or nothing.'),
               single='This is steht vorn; the most reliable system we have tested folgt danach in dieser Reihenfolge.'),
    order_item('np.contact', 'The report you sent was very helpful.', 'Der Bericht, den Sie geschickt haben, war sehr hilfreich.',
               ['the report', 'you sent', 'was', 'very', 'helpful'],
               ('You sent ist ein Satz ohne that und gehört direkt hinter das Nomen the report.', 'You sent is a clause without that and belongs directly after the noun the report.'),
               'The report you sent it was very helpful.', ('you sent', 'you sent it', 'Das Objekt steht nur einmal: that ist es schon.', 'The object appears only once: that is the object already.'),
               single='The report you sent bildet das Subjekt; was very helpful folgt danach.'),
    order_item('np.participle', 'All files stored in the cloud are encrypted.', 'Alle in der Cloud gespeicherten Dateien sind verschlüsselt.',
               ['all files', 'stored', 'in the cloud', 'are', 'encrypted'],
               ('Das Partizip stored steht direkt hinter dem Nomen files und hat passive Bedeutung.', 'The participle stored stands directly after the noun files and has passive meaning.'),
               'All files storing in the cloud are encrypted.', ('stored', 'storing', 'Die Dateien werden gespeichert: 3. Form, nicht -ing.', 'The files are stored: past participle, not -ing.'),
               single='All files stored in the cloud bildet das Subjekt; are encrypted folgt danach.'),
    order_item('np.participle', 'The team working on the migration meets every Monday.', 'Das Team, das an der Migration arbeitet, trifft sich jeden Montag.',
               ['the team', 'working', 'on the migration', 'meets', 'every Monday'],
               ('Das Partizip working ersetzt that is working und steht direkt hinter dem Nomen the team.', 'The participle working replaces that is working and stands directly after the noun the team.'),
               'The team works on the migration meets every Monday.', ('working', 'works', 'Hier steht das aktive Partizip -ing, kein zweites Verb.', 'The active participle -ing stands here, not a second verb.'),
               single='The team working on the migration ist das Subjekt; meets every Monday folgt danach.'),
    order_item('np.of-s', "The company's new CEO starts on Monday.", 'Der neue Chef der Firma fängt am Montag an.',
               ['the', "company's", 'new CEO', 'starts', 'on Monday'],
               ('Der Besitzer company steht mit ’s vor dem Nomen: the company’s new CEO.', 'The owner company stands with ’s before the noun: the company’s new CEO.'),
               'The company new CEO starts on Monday.', ("company's", 'company', 'Der Besitz braucht ’s.', 'Possession needs ’s.'),
               single="The company's new CEO bildet das Subjekt; starts on Monday folgt danach."),
    order_item('np.of-s', 'The roof of the building was damaged by the storm.', 'Das Dach des Gebäudes wurde durch den Sturm beschädigt.',
               ['the roof', 'of the building', 'was', 'damaged', 'by the storm'],
               ('Bei einem Ding steht of: the roof of the building. Das Passiv folgt mit was damaged.', 'With a thing, of is used: the roof of the building. The passive follows with was damaged.'),
               'The building roof of was damaged by the storm.', ('of the building', 'the building', 'Bei Dingen nimmt man of, nicht ’s.', 'With things you use of, not ’s.'),
               single='The roof of the building bildet das Subjekt; was damaged by the storm folgt danach.'),
    order_item('np.to-inf', 'She was the first customer to sign the new contract.', 'Sie war die erste Kundin, die den neuen Vertrag unterschrieb.',
               ['she was', 'the first', 'customer', 'to sign', 'the new contract'],
               ('Nach the first customer folgt to + Grundform: to sign. Das ersetzt den Relativsatz who signed.', 'After the first customer comes to + base form: to sign. It replaces who signed.'),
               'She was the first customer who to sign the new contract.', ('to sign', 'who to sign', 'Entweder who signed oder to sign, nicht beides.', 'Either who signed or to sign, not both.'),
               single='She was the first customer steht vorn; to sign the new contract folgt danach.'),
    order_item('np.to-inf', 'This is the best way to reduce costs.', 'Das ist der beste Weg, die Kosten zu senken.',
               ['this is', 'the best way', 'to', 'reduce', 'costs'],
               ('Nach way folgt to + Grundform: to reduce. Das Deutsche sagt „um … zu“, das Englische nur to.', 'After way comes to + base form: to reduce. German says “um … zu”, English only to.'),
               'This is the best way for reduce costs.', ('to', 'for', 'Nach way steht to, nicht for.', 'After way comes to, not for.'),
               single='This is the best way bildet den Anfang; to reduce costs folgt danach.'),
]

MAP = {
    'This is the most reliable system what we have tested.': {'pat': 'np.contact', 'why': {
        'ok': B('Nach dem Nomen steht that oder nichts: the system we have tested.', 'After the noun comes that or nothing: the system we have tested.'),
        'wrong': [{'if': ['what'], 'de': 'What ist kein Relativpronomen nach einem Nomen.', 'en': 'What is not a relative pronoun after a noun.'},
                  {'if': ['which', 'who'], 'de': 'Hier genügt nichts oder that.', 'en': 'Here nothing or that is enough.'}]}},
    'The people involving in the project agreed.': {'pat': 'np.participle', 'why': {
        'ok': B('Die Beteiligten sind beteiligt: Passiv braucht die 3. Form involved.', 'The people are involved: the passive needs the past participle involved.'),
        'wrong': [{'if': ['involving'], 'de': 'Involving ist aktiv. Hier ist die 3. Form involved nötig.', 'en': 'Involving is active. Here the past participle involved is needed.'},
                  {'not': ['involved'], 'de': 'Es heißt hier: the people involved in the project, mit der 3. Form.', 'en': 'It is the people involved in the project.'}]}},
    'The managers decision surprised everyone.': {'pat': 'np.of-s', 'why': {
        'ok': B("Der Besitz steht mit Apostroph: the manager's decision.", "Possession takes an apostrophe: the manager's decision."),
        'wrong': [{'not': ["manager's"], 'de': 'Es fehlt das ’s nach manager.', 'en': 'The ’s after manager is missing.'},
                  {'if': ["managers'"], 'de': 'Eine Person: ’s steht nach dem Singular.', 'en': 'One person: ’s comes after the singular.'}]}},
    'This is the best way for reduce costs.': {'pat': 'np.to-inf', 'why': {
        'ok': B('Nach way folgt to + Grundform: the best way to reduce costs.', 'After way comes to + base form: the best way to reduce costs.'),
        'wrong': [{'if': ['for'], 'de': 'Nach way steht to, nicht for.', 'en': 'After way comes to, not for.'},
                  {'not': ['to'], 'de': 'Vor der Grundform reduce braucht es to.', 'en': 'Before the base form reduce you need to.'}]}},
}

def c1x():
    mcc(T, 'np.contact', 'C1', 'biz', 0.0, 'That was the most convincing presentation ___ at this conference.',
        'I have seen', ['what I have seen', 'I have seen it', 'who I have seen'],
        ('Nach dem Superlativ presentation darf das Pronomen fehlen: I have seen.', 'After the superlative presentation the pronoun may be dropped: I have seen.'),
        [(G, 'What ist nach einem Nomen kein Relativpronomen.', 'What is not a relative pronoun after a noun.'),
         (G, 'Das Objekt steht nur einmal. Ein zusätzliches it ist zu viel.', 'The object appears only once. An extra it is too much.'),
         (G, 'Who passt nur zu Personen, hier geht es um eine Präsentation.', 'Who only fits people; here it is about a presentation.')])
    mcc(T, 'np.contact', 'C1', 'biz', 0.0, 'The report ___ was very helpful for the preparation of the meeting.',
        'you sent', ['what you sent', 'you sent it', 'who you sent'],
        ('Nach dem Nomen report darf that fehlen: the report you sent.', 'After the noun report that may be dropped: the report you sent.'),
        [(G, 'What ist nach einem Nomen kein Relativpronomen.', 'What is not a relative pronoun after a noun.'),
         (G, 'Das Objekt steht nur einmal: it ist hier doppelt.', 'The object appears only once: it is doubled here.'),
         (G, 'Who passt nur zu Personen.', 'Who only fits people.')])
    mcc(T, 'np.participle', 'C1', 'biz', 0.0, 'All employees ___ in the project must complete the security training.',
        'involved', ['involving', 'involve', 'are involving'],
        ('Die Mitarbeiter sind beteiligt: Passiv braucht die 3. Form involved direkt hinter dem Nomen.', 'The employees are involved: the passive needs the past participle involved right after the noun.'),
        [(G, 'Involving wäre aktiv: die Mitarbeiter würden etwas beteiligen.', 'Involving would be active: the employees would involve something.'),
         (G, 'Hinter dem Nomen steht ein Partizip, kein finites Verb.', 'A participle follows the noun, not a finite verb.'),
         (G, 'Are involving ist aktiv und ergibt hier keinen Satzbau.', 'Are involving is active and does not fit the structure here.')])
    mcc(T, 'np.participle', 'C1', 'biz', 0.0, 'Any questions ___ during the workshop will be answered in writing.',
        'raised', ['raising', 'raise', 'arisen'],
        ('Die Fragen werden gestellt: Passiv braucht die 3. Form raised direkt hinter dem Nomen.', 'The questions are raised: the passive needs the past participle raised right after the noun.'),
        [(G, 'Raising wäre aktiv: die Fragen würden etwas aufwerfen.', 'Raising would be active: the questions would raise something.'),
         (G, 'Hinter dem Nomen steht ein Partizip, kein Infinitiv.', 'A participle follows the noun, not an infinitive.'),
         (M, 'Arisen heißt „entstanden“ und braucht ein anderes Verb.', 'Arisen means “come up” and needs a different verb.')])
    mcc(T, 'np.of-s', 'C1', 'biz', 0.0, 'We have to wait for ___ decision before we can sign the contract.',
        "Tom's", ['Toms', 'Tom', 'of Tom'],
        ('Der Besitz bei einer Person steht mit ’s: Tom’s decision.', 'Possession with a person takes ’s: Tom’s decision.'),
        [(G, 'Toms ohne Apostroph ist ein Plural, kein Besitz.', 'Toms without an apostrophe is a plural, not possession.'),
         (G, 'Tom allein zeigt keinen Besitz an.', 'Tom alone does not show possession.'),
         (G, 'Of Tom steht hinter dem Nomen, nicht davor.', 'Of Tom stands after the noun, not before it.')])
    mcc(T, 'np.to-inf', 'C1', 'biz', 0.0, 'She was the first customer ___ the new subscription.',
        'to buy', ['buying', 'who buy', 'for buy'],
        ('Nach the first customer folgt to + Grundform: to buy.', 'After the first customer comes to + base form: to buy.'),
        [(G, 'Nach first customer steht nicht -ing, sondern to + Grundform.', 'After first customer comes not -ing but to + base form.'),
         (G, 'Who buy ist falsch gebeugt, es müsste who bought heißen.', 'Who buy is wrongly inflected; it would have to be who bought.'),
         (G, 'For buy gibt es nicht: nach dem Nomen steht to.', 'For buy does not exist: to follows the noun.')])

    ocl(T, 'np.contact', 'C1', 'biz', 0.0, 'This is the best solution ___ have found so far.',
        ['we', 'I', 'they', 'you'], 'pron', ['what', 'who', 'it'],
        ('Nach dem Superlativ solution darf that fehlen: the best solution we have found.', 'After the superlative solution that may be dropped: the best solution we have found.'))
    ocl(T, 'np.contact', 'C1', 'biz', 0.0, 'The colleague ___ I spoke to yesterday has already left the company.',
        ['that', 'who', 'whom'], 'rel', ['what', 'which', 'whose'],
        ('Eine Person als Objekt: that, who oder whom (oder gar nichts).', 'A person as the object: that, who or whom (or nothing at all).'))
    ocl(T, 'np.participle', 'C1', 'biz', 0.0, 'The people involved ___ the project agreed to the new schedule.',
        ['in'], 'prep', ['on', 'at', 'of'],
        ('Involved wird mit in verbunden: involved in the project.', 'Involved goes with in: involved in the project.'))
    ocl(T, 'np.participle', 'C1', 'biz', 0.0, 'Any issues related ___ the update should be reported today.',
        ['to'], 'prep', ['with', 'for', 'at'],
        ('Related wird mit to verbunden: related to the update.', 'Related goes with to: related to the update.'))
    ocl(T, 'np.of-s', 'C1', 'biz', 0.0, 'We have reached the end ___ the quarter.',
        ['of'], 'prep', ['from', 'in', 'at'],
        ('Bei einer Zeitangabe als Ding steht of: the end of the quarter.', 'With a time period as a thing, of is used: the end of the quarter.'))
    ocl(T, 'np.to-inf', 'C1', 'biz', 0.0, 'She was the first customer ___ sign the new contract.',
        ['to'], 'prep', ['for', 'at', 'of'],
        ('Nach the first customer folgt to + Grundform: to sign.', 'After the first customer comes to + base form: to sign.'))

    err(T, 'np.contact', 'C1', 'biz', 0.0, 'Is this the only offer what we have received so far?',
        ('what', ['that', 'which'], ['that', 'who', 'whom']),
        ('Nach dem Nomen offer steht that, which oder nichts, nie what.', 'After the noun offer comes that, which or nothing, never what.'))
    err(T, 'np.participle', 'C1', 'biz', 0.0, 'The employees involving in the pilot project received a bonus.',
        ('involving', ['involved'], ['involved', 'involve', 'involves']),
        ('Die Mitarbeiter sind beteiligt: Passiv braucht die 3. Form involved.', 'The employees are involved: the passive needs the past participle involved.'))
    err(T, 'np.of-s', 'C1', 'biz', 0.0, 'The manager decision surprised the whole team on Monday.',
        ('manager decision', ["manager's decision"], ["manager's decision", 'managers decision', 'manager decisions']),
        ('Der Besitz steht mit ’s: the manager’s decision.', 'Possession takes ’s: the manager’s decision.'))
    err(T, 'np.to-inf', 'C1', 'biz', 0.0, 'This is the best way for increase our sales in Asia.',
        ('for increase', ['to increase'], ['to increase', 'for increase', 'to increasing']),
        ('Nach way steht to + Grundform: to increase.', 'After way comes to + base form: to increase.'))
    err(T, 'np.participle', 'C1', 'biz', 0.0, 'Everyone working on the migration received the new access rules.', None,
        ('Kein Fehler: Working ersetzt who is working.', 'No mistake: Working replaces who is working.'))
    err(T, 'np.to-inf', 'C1', 'biz', 0.0, 'She was the last customer to sign the contract before the deadline.', None,
        ('Kein Fehler: Nach the last customer folgt to + Grundform.', 'No mistake: after the last customer comes to + base form.'))

    kwt(T, 'np.contact', 'C1', 'biz', 0.0, 'That was the most useful training that I have ever joined.', 'ATTENDED', 'That was the most useful training', '.',
        [(['I have', 'that I have'], ['attended'])], ['I', 'have'], ['that', 'what', 'which'], [],
        ('the most useful training I have attended. Das Pronomen that darf fehlen.', 'the most useful training I have attended. The pronoun that may be dropped.'), [])
    kwt(T, 'np.contact', 'C1', 'biz', 0.0, 'The proposal which they handed to us last week was far too expensive.', 'SENT', 'The proposal', 'last week was far too expensive.',
        [(['they', 'that they'], ['sent us'])], ['they', 'us'], ['what', 'who', 'it'], [],
        ('the proposal they sent us. Das Pronomen that darf fehlen.', 'the proposal they sent us. The pronoun that may be dropped.'), [])
    kwt(T, 'np.participle', 'C1', 'biz', 0.0, 'The employees who work on the pilot received a bonus.', 'WORKING', 'The', 'the pilot received a bonus.',
        [(['employees'], ['working on'])], ['employees', 'on'], ['work', 'who', 'are'], [],
        ('the employees working on the pilot. Das aktive Partizip ersetzt who work.', 'the employees working on the pilot. The active participle replaces who work.'), [])
    kwt(T, 'np.participle', 'C1', 'biz', 0.0, 'All the documents that we mailed to the client are listed below.', 'SENT', 'All the', 'the client are listed below.',
        [(['documents'], ['sent to'])], ['documents', 'to'], ['mailing', 'that', 'are'], [],
        ('the documents sent to the client. Das passive Partizip ersetzt that were sent.', 'the documents sent to the client. The passive participle replaces that were sent.'), [])
    kwt(T, 'np.of-s', 'C1', 'biz', 0.0, 'The decision made by the manager surprised everyone.', 'OF', 'The decision', 'surprised everyone.',
        [(['of the'], ['manager'])], ['the', 'manager'], ['by', 'from', 'for'], [],
        ('the decision of the manager. Bei einer Person ist auch ’s möglich, hier gilt of.', 'the decision of the manager. With a person ’s is also possible, here of is used.'), [])
    kwt(T, 'np.to-inf', 'C1', 'biz', 0.0, 'She was the first customer who signed the new contract.', 'TO', 'She was the', 'the new contract.',
        [(['first customer'], ['to sign'])], ['first', 'customer', 'sign'], ['who', 'signed', 'for'], [],
        ('the first customer to sign. Nach first steht to + Grundform.', 'the first customer to sign. After first comes to + base form.'), [])

def place():
    mcc(T, 'np.participle', 'B2+', 'biz', 0.0, 'Please contact all colleagues ___ in the data migration before Friday.',
        'involved', ['involve', 'involving', 'to involved'],
        ('Die Kollegen sind beteiligt: Passiv braucht die 3. Form involved direkt hinter dem Nomen.', 'The colleagues are involved: the passive needs the past participle involved right after the noun.'),
        [(G, 'Hinter dem Nomen steht ein Partizip, keine Grundform.', 'A participle follows the noun, not a base form.'),
         (G, 'Involving wäre aktiv: die Kollegen würden etwas beteiligen.', 'Involving would be active: the colleagues would involve something.'),
         (G, 'To involved ist keine gültige Form.', 'To involved is not a valid form.')])
    kwt(T, 'np.to-inf', 'C1', 'biz', 0.0, 'Asking the supplier directly is the best method.', 'WAY', '', 'to ask the supplier directly.',
        [(['The best'], ['way'])], ['The', 'best'], ['for', 'method', 'of'], ['The best way for'],
        ('the best way to ask. Nach way steht to + Grundform.', 'the best way to ask. After way comes to + base form.'),
        [W(['best', 'way', 'for'], 'Nach way folgt to, nicht for.', 'After way comes to, not for.')])
