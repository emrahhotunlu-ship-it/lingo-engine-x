from cm import *
import lib
from lib import mcc, ocl, err, kwt, W

G = 'grammar'; M = 'meaning'; C = 'calque'; P = 'partner'; R = 'register'
T = 'ellipsis'

TOPIC = {
    'id': T, 'group': 'Grammatik-Pfad', 'level': 'C1', 'p0': 0.45,
    'name': 'Ellipse – Wiederholung vermeiden', 'name_en': 'Ellipsis and avoiding repetition',
    'rule': 'Was schon gesagt ist, lässt man weg oder ersetzt es: „I think so“, „we did so“, „the new one“, „those of the old plan“, „I’d love to“. So klingt Englisch knapp und natürlich.',
    'rule_en': 'What has already been said is left out or replaced: “I think so”, “we did so”, “the new one”, “those of the old plan”, “I’d love to”. This makes English sound short and natural.',
    'ex': ['Will the update be ready on Friday? I think so.', 'The costs of the new plan are lower than those of the old one.'],
}

PAT = [
    pattern('el.so-not', ('so und not statt eines Satzes', 'so and not instead of a clause'),
            ('think / hope / expect / suppose / be afraid + so / not', 'think / hope / expect / suppose / be afraid + so / not'),
            ('Nach think, hope, expect, suppose und be afraid ersetzt so einen ganzen Satz in der Antwort, und not steht für die Verneinung. Auch „If so“ und „If not“ stehen für einen ganzen Gedanken.',
             'After think, hope, expect, suppose and be afraid, so replaces a whole clause in the answer, and not stands for the negative. “If so” and “If not” also stand for a whole thought.'),
            ['i think so', 'i hope so', 'i hope not', 'if so', 'if not', 'i am afraid not'],
            [('Will the update be ready on Friday? I think so.', 'Wird das Update am Freitag fertig? Ich denke schon.', 'talk'),
             ('Is the budget approved? I am afraid not.', 'Ist das Budget genehmigt? Leider nicht.', 'meeting'),
             ('If so, please send me the new date.', 'Falls ja, schicken Sie mir bitte das neue Datum.', 'mail')],
            ('Is it ready? I hope that not.', 'Is it ready? I hope not.',
             'Nach hope steht not direkt. Ein that davor ist falsch, weil not keinen Nebensatz einleitet. Das Deutsche hat „dass“ hier nicht.',
             'After hope, not follows directly. A that before it is wrong, because not does not introduce a clause. German has no “dass” here.'),
            ('el.do-so', 'Will you sign? I hope so.', 'You may sign. Please do so.',
             'So nach hope ersetzt den Gedanken. Do so ersetzt die Handlung.', 'So after hope replaces the thought. Do so replaces the action.'),
            [('Will they sign? I hope not.', 'Möchte ich, dass sie unterschreiben?', 'Do I want them to sign?', False)],
            ('Steht schon ein ganzer Gedanke vor der Antwort? Dann genügt so oder not hinter dem Verb.', 'Has the whole thought been said already? Then so or not after the verb is enough.')),
    pattern('el.do-so', ('do so, do the same · Verb ersetzen', 'do so, do the same · replacing a verb'),
            ('do so / do the same / do it ersetzt eine Handlung', 'do so / do the same / do it replaces an action'),
            ('Statt ein Verb mit seinem Objekt zu wiederholen, steht do so (förmlich), do the same oder do it. Auch ein Hilfsverb kann allein stehen: „She did, too.“',
             'Instead of repeating a verb with its object you use do so (formal), do the same or do it. An auxiliary can also stand alone: “She did, too.”'),
            ['do so', 'did so', 'do the same', 'did the same', 'do it'],
            [('The client asked us to review the draft, and we did so on Monday.', 'Der Kunde bat uns, den Entwurf zu prüfen, und das taten wir am Montag.', 'mail'),
             ('She signed the contract, and I did the same.', 'Sie unterschrieb den Vertrag, und ich tat dasselbe.', 'talk'),
             ('Anyone who wants to cancel may do so before Friday.', 'Wer stornieren möchte, kann das vor Freitag tun.', 'meeting')],
            ('She signed the contract, and I did same.', 'She signed the contract, and I did the same.',
             'Im Deutschen sagt man „ich tat dasselbe“. Im Englischen darf the nicht fehlen: the same.',
             'German says “ich tat dasselbe”. In English the must not be missing: the same.'),
            ('el.so-not', 'Will you sign? I hope so.', 'You may sign. Please do so.',
             'So nach hope ersetzt den Gedanken. Do so ersetzt die Handlung.', 'So after hope replaces the thought. Do so replaces the action.'),
            [('He reviewed the report and I did the same.', 'Habe ich den Bericht geprüft?', 'Did I review the report?', True)],
            ('Welche Handlung wurde schon genannt, und welches kurze Wort kann sie ersetzen?', 'Which action has been named already, and which short word can replace it?')),
    pattern('el.one-ones', ('one, ones · that of, those of', 'one, ones · that of, those of'),
            ('Adjektiv + one(s) / that of / those of statt eines Nomens', 'Adjective + one(s) / that of / those of instead of a noun'),
            ('One ersetzt ein zählbares Nomen. That of und those of ersetzen ein Nomen im Vergleich: Kosten werden mit Kosten verglichen, nicht mit einem Plan.',
             'One replaces a countable noun. That of and those of replace a noun in a comparison: costs are compared with costs, not with a plan.'),
            ['the new one', 'the ones', 'that of', 'those of', 'which one'],
            [('Our old system is slow, but the new one is fast.', 'Unser altes System ist langsam, aber das neue ist schnell.', 'meeting'),
             ('The costs of the new plan are lower than those of the old plan.', 'Die Kosten des neuen Plans sind niedriger als die des alten.', 'mail'),
             ('I prefer the ones we tested last year.', 'Ich bevorzuge die, die wir letztes Jahr getestet haben.', 'talk')],
            ('The costs of the new plan are lower than the old plan.', 'The costs of the new plan are lower than those of the old plan.',
             'Verglichen werden Kosten mit Kosten, nicht Kosten mit einem Plan. Das Deutsche sagt „als die des alten Plans“, im Englischen braucht man those of.',
             'Costs are compared with costs, not costs with a plan. German says “als die des alten Plans”, English needs those of.'),
            ('cmp.than', 'The new plan is cheaper than the old one.', 'The costs of the new plan are lower than those of the old one.',
             'One ersetzt ein Nomen im Singular. Those of ersetzt ein Pluralnomen mit of-Zusatz.', 'One replaces a singular noun. Those of replaces a plural noun with an of-phrase.'),
            [('The new office is bigger than the old one.', 'Vergleiche ich zwei Büros?', 'Am I comparing two offices?', True)],
            ('Welches Nomen soll nicht wiederholt werden, und ist es Singular oder Plural?', 'Which noun should not be repeated, and is it singular or plural?')),
    pattern('el.to-aux', ("to und Hilfsverb allein · I'd love to", "bare to and bare auxiliary · I'd love to"),
            ('Hilfsverb oder to ohne Verb am Ende', 'Auxiliary or to without a verb at the end'),
            ('Ist das Verb schon bekannt, bleibt nur das Hilfsverb oder to stehen: „She can, but he can’t.“ „I’d love to.“ Das Verb wird nicht wiederholt, to darf nicht fehlen.',
             'When the verb is already known, only the auxiliary or to is left: “She can, but he can’t.” “I’d love to.” The verb is not repeated, and to must not be missing.'),
            ["i'd love to", 'i would like to', 'she can', "he can't", 'if you want to'],
            [("Can you join the call? I'd love to, but I have another meeting.", 'Kannst du am Anruf teilnehmen? Sehr gern, aber ich habe ein anderes Meeting.', 'talk'),
             ('She can attend the workshop, but he cannot.', 'Sie kann am Workshop teilnehmen, er nicht.', 'meeting'),
             ('Please feel free to call me if you want to.', 'Rufen Sie mich gern an, wenn Sie möchten.', 'mail')],
            ('Can you join us? Yes, I would like.', 'Can you join us? Yes, I would like to.',
             'Das Deutsche lässt „zu“ bei „Ich möchte gern“ am Satzende weg. Im Englischen muss to stehen bleiben, damit klar ist, dass ein Infinitiv gemeint ist.',
             'German drops “zu” after “Ich möchte gern” at the end. English must keep to, so it is clear that an infinitive is meant.'),
            ('el.do-so', "I'd love to.", "I'd love to do so.",
             'Beide sind richtig. Das kurze to klingt im Gespräch natürlicher, do so förmlicher.', 'Both are correct. The short to sounds more natural in conversation, do so more formal.'),
            [("Can you come? I'd love to, but I can't.", 'Würde ich gern kommen?', 'Would I like to come?', True)],
            ('Ist das Verb schon genannt? Dann bleibt nur das Hilfsverb oder to übrig.', 'Has the verb been named already? Then only the auxiliary or to is left.')),
]

FILE = topic_file(T, ('Ich kann Wiederholungen vermeiden: mit so und not, do so, one und ones, those of und mit einem allein stehenden to oder Hilfsverb.',
                      'I can avoid repetition: with so and not, do so, one and ones, those of, and with a bare to or auxiliary.'),
                  PAT, [['el.so-not', 'el.do-so'], ['el.one-ones', 'el.to-aux']],
                  (['Ist ein ganzer Gedanke schon gesagt (nach think, hope, expect)? Dann genügt so oder not.',
                    'Wurde eine Handlung schon genannt? Dann ersetzt do so oder do the same das Verb samt Objekt.',
                    'Soll ein Nomen nicht wiederholt werden? Nimm one(s), im Vergleich those of oder that of.'],
                   ['Has a whole thought been said already (after think, hope, expect)? Then so or not is enough.',
                    'Has an action been named already? Then do so or do the same replaces the verb and its object.',
                    'Should a noun not be repeated? Use one(s), and in a comparison those of or that of.']))

RULES = rules_from(PAT,
    ('Englisch lässt Bekanntes weg: so/not nach think und hope, do so statt des Verbs, one(s) statt des Nomens, those of im Vergleich, und am Ende nur to oder das Hilfsverb.',
     'English leaves out what is known: so/not after think and hope, do so instead of the verb, one(s) instead of the noun, those of in a comparison, and only to or the auxiliary at the end.'),
    ('Wiederholungen wirken im Englischen schwerfällig. Wer Ellipse beherrscht, klingt flüssig und muttersprachlich, vor allem in Mails und Meetings.',
     'Repetition sounds heavy in English. If you master ellipsis you sound fluent and native, especially in emails and meetings.'),
    ('Nicht verwechseln: so ersetzt einen Gedanken (I hope so), do so eine Handlung (please do so), one ein Nomen (the new one). Und to darf am Ende nie fehlen.',
     'Do not mix up: so replaces a thought (I hope so), do so an action (please do so), one a noun (the new one). And to must never be missing at the end.'),
    (['Was wurde schon gesagt: ein Gedanke, eine Handlung oder ein Nomen?', 'Gedanke: so oder not. Handlung: do so oder do the same. Nomen: one(s), those of.', 'Am Satzende steht to oder das Hilfsverb allein, wenn das Verb bekannt ist.'],
     ['What has been said already: a thought, an action or a noun?', 'Thought: so or not. Action: do so or do the same. Noun: one(s), those of.', 'At the end of the sentence, to or the auxiliary alone is left when the verb is known.']))

V = V2('el')
V.kwt('el.so-not', 'Will they sign today? I hope that they will not.', 'NOT', 'Will they sign today? I ___.', 'hope not', (2, 2),
      ('Richtig: I hope not. Not steht direkt hinter dem Verb.', 'Right: I hope not. Not follows the verb directly.'),
      [{'if': ['hope', 'that'], 'de': 'Vor not steht kein that: I hope not.', 'en': 'There is no that before not: I hope not.'}])
V.kwt('el.so-not', 'Is the report ready? I believe that it is.', 'SO', 'Is the report ready? I ___.', 'believe so', (2, 2),
      ('Richtig: I believe so. So ersetzt den ganzen Gedanken.', 'Right: I believe so. So replaces the whole thought.'),
      [{'if': ['so'], 'not': ['believe', 'think', 'hope', 'expect'], 'de': 'So steht hinter einem Verb wie think, hope, believe.', 'en': 'So follows a verb like think, hope, believe.'}], accepted=['think so', 'hope so', 'expect so'])
V.kwt('el.do-so', 'The client asked us to review the draft, and we reviewed it on Monday.', 'DID', 'The client asked us to review the draft, and we ___ on Monday.', 'did so', (2, 2),
      ('Richtig: we did so. Do so ersetzt die ganze Handlung.', 'Right: we did so. Do so replaces the whole action.'),
      [{'if': ['did', 'it'], 'de': 'Nach did steht so oder the same, nicht it so.', 'en': 'After did comes so or the same, not it so.'}])
V.kwt('el.do-so', 'She signed the contract, and I signed it too.', 'SAME', 'She signed the contract, and I ___ too.', 'did the same', (3, 3),
      ('Richtig: I did the same. The same ersetzt die Handlung.', 'Right: I did the same. The same replaces the action.'),
      [{'if': ['same'], 'not': ['the'], 'de': 'Vor same steht the: the same.', 'en': 'Before same you need the: the same.'}])
V.kwt('el.one-ones', 'Our old laptops are heavy, but our new laptops are light.', 'ONES', 'Our old laptops are heavy, but ___ are light.', 'the new ones', (3, 3),
      ('Richtig: the new ones. Ones ersetzt das Pluralnomen laptops.', 'Right: the new ones. Ones replaces the plural noun laptops.'),
      [{'if': ['new'], 'not': ['ones'], 'de': 'Hinter dem Adjektiv new braucht es ones.', 'en': 'After the adjective new you need ones.'}])
V.kwt('el.one-ones', 'The prices in our shop are lower than the prices in their shop.', 'THOSE', 'The prices in our shop are lower than ___ their shop.', 'those in', (2, 2),
      ('Richtig: those in their shop. Those ersetzt das Pluralnomen prices.', 'Right: those in their shop. Those replaces the plural noun prices.'),
      [{'if': ['those'], 'not': ['in'], 'de': 'Nach those folgt in und der Ort des Vergleichs: those in their shop.', 'en': 'After those comes in and the place compared: those in their shop.'}])
V.kwt('el.to-aux', 'Would you like to join the call? Yes, I would like to join it.', 'LOVE', 'Would you like to join the call? Yes, I would ___.', 'love to', (2, 2),
      ('Richtig: I would love to. Das Verb join entfällt, to bleibt.', 'Right: I would love to. The verb join is dropped, to stays.'),
      [{'if': ['love'], 'not': ['to'], 'de': 'Am Ende muss to nicht fehlen: love to.', 'en': 'At the end to has to stay: love to.'}])
V.kwt('el.to-aux', 'Anna can present the results, but Tom probably cannot present them.', 'CANNOT', 'Anna can present the results, but Tom ___.', 'probably cannot', (2, 2),
      ('Richtig: but Tom probably cannot. Das Verb present entfällt, das Hilfsverb bleibt.', 'Right: but Tom probably cannot. The verb present is dropped, the auxiliary stays.'), [])
V.find('el.so-not', 'Will they sign today? I hope that not.', (6, 6), '', 'Will they sign today? I hope not.',
       ('Der Fehler: vor not steht kein that. Richtig: I hope not.', 'The error: there is no that before not. Correct: I hope not.'),
       ('Nach hope folgt not direkt.', 'After hope, not follows directly.'))
V.find('el.so-not', 'Is the budget approved? I am afraid not.', None, None, None,
       ('Richtig: I am afraid not. Not steht für den ganzen verneinten Gedanken.', 'Right: I am afraid not. Not stands for the whole negative thought.'),
       ('I am afraid not ist richtig gebildet.', 'I am afraid not is correctly formed.'))
V.find('el.do-so', 'Our rivals lowered their prices, and we did same.', (8, 8), 'the same.', 'Our rivals lowered their prices, and we did the same.',
       ('Der Fehler: vor same steht the. Richtig: I did the same.', 'The error: before same you need the. Correct: I did the same.'),
       ('Vor same steht the.', 'Before same you need the.'))
V.find('el.do-so', 'Anyone who wants to cancel may do so before Friday.', None, None, None,
       ('Richtig: may do so ersetzt die Handlung cancel.', 'Right: may do so replaces the action cancel.'),
       ('may do so ist richtig gebildet.', 'may do so is correctly formed.'))
V.find('el.one-ones', 'The old printer is broken, so we bought a new.', (9, 9), 'new one.', 'The old printer is broken, so we bought a new one.',
       ('Der Fehler: nach a new fehlt das Wort one. Richtig: a new one.', 'The error: the word one is missing after a new. Correct: a new one.'),
       ('Hinter a new braucht es one.', 'After a new you need one.'))
V.find('el.one-ones', 'The fees of the new provider are lower than the old provider.', (9, 11), 'those of the old provider.', 'The fees of the new provider are lower than those of the old provider.',
       ('Der Fehler: Gebühren werden mit Gebühren verglichen. Richtig: lower than those of the old provider.', 'The error: fees are compared with fees. Correct: lower than those of the old provider.'),
       ('Im Vergleich steht those of statt des Nomens.', 'In a comparison those of stands instead of the noun.'))
V.find('el.to-aux', 'Can you join the call? Yes, I would like.', (8, 8), 'like to.', 'Can you join the call? Yes, I would like to.',
       ('Der Fehler: am Ende fehlt to. Richtig: I would like to.', 'The error: to is missing at the end. Correct: I would like to.'),
       ('Am Ende muss to stehen bleiben.', 'To has to stay at the end.'))
V.find('el.to-aux', 'She can attend the workshop, but he cannot to.', (7, 8), 'cannot.', 'She can attend the workshop, but he cannot.',
       ('Der Fehler: nach cannot steht kein to. Richtig: but he cannot.', 'The error: there is no to after cannot. Correct: but he cannot.'),
       ('Nach einem Modalverb steht kein to.', 'After a modal verb there is no to.'))
V.meaning('el.so-not', 'Will they sign? I hope so.', 'Will they sign? I hope not.',
          ('Welcher Satz sagt, dass ich die Unterschrift wünsche?', 'Which sentence says that I want them to sign?'), 'a',
          ('Richtig: Satz a. I hope so heißt, dass ich es mir wünsche, und das ist hier gemeint.', 'Right: sentence a. I hope so means that I hope they will.'),
          [('b', 'In b hoffe ich, dass sie nicht unterschreiben. Das ist das Gegenteil.', 'In b I hope they do not sign. That is the opposite.'), ('both', 'Die beiden Sätze sagen Gegensätzliches.', 'The two sentences say opposite things.')])
V.meaning('el.do-so', 'He reviewed the report and I did the same.', 'He reviewed the report and I reviewed nothing.',
          ('Welcher Satz sagt, dass ich den Bericht auch geprüft habe?', 'Which sentence says that I also reviewed the report?'), 'a',
          ('Richtig: Satz a. Did the same steht für reviewed the report.', 'Right: sentence a. Did the same stands for reviewed the report.'),
          [('b', 'In b habe ich nichts geprüft. Das ist das Gegenteil.', 'In b I reviewed nothing. That is the opposite.'), ('both', 'Die beiden Sätze sagen Gegensätzliches.', 'The two sentences say opposite things.')])
V.meaning('el.one-ones', 'Our laptops are older than those of the sales team.', 'Our laptops are older than the sales team.',
          ('Welcher Satz vergleicht unsere Laptops mit den Laptops des Vertriebs?', 'Which sentence compares our laptops with the sales team’s laptops?'), 'a',
          ('Richtig: Satz a. Those of ersetzt das Nomen laptops im Vergleich.', 'Right: sentence a. Those of replaces the noun laptops in the comparison.'),
          [('b', 'In b werden Laptops mit einem Team verglichen. Das ergibt keinen Sinn.', 'In b laptops are compared with a team. That makes no sense.'), ('both', 'Die beiden Sätze sagen nicht dasselbe.', 'The two sentences do not say the same.')])
V.meaning('el.to-aux', "I'd love to.", "I'd love to do so.",
          ('Bedeuten beide Sätze dasselbe?', 'Do both sentences mean the same?'), 'both',
          ('Richtig: beide. Das kurze to und do so ersetzen dieselbe bekannte Handlung.', 'Right: both. The short to and do so replace the same known action.'),
          [('a', 'Nicht nur a: b sagt dasselbe förmlicher.', 'Not only a: b says the same more formally.'), ('b', 'Nicht nur b: a sagt dasselbe kürzer.', 'Not only b: a says the same more briefly.')])

ORDER = [
    order_item('el.so-not', 'If so, please send me the new date.', 'Falls ja, schicken Sie mir bitte das neue Datum.',
               ['if', 'so', 'please', 'send me', 'the new date'],
               ('If so ersetzt einen ganzen Gedanken: Falls das zutrifft. Danach folgt die Bitte.', 'If so replaces a whole thought: if that is the case. The request follows.'),
               'If it so, please send me the new date.', ('so', 'it so', 'Nach if steht so allein, ohne it.', 'After if, so stands alone without it.'),
               single='If so bildet den Anfang; please send me the new date folgt danach.'),
    order_item('el.so-not', 'I am afraid not, but we can try again next week.', 'Leider nicht, aber wir können es nächste Woche noch einmal versuchen.',
               ['I am afraid', 'not', 'but', 'we can try', 'again', 'next week'],
               ('Not steht direkt hinter dem Verb und ersetzt den verneinten Gedanken. Danach folgt der zweite Teil mit but.', 'Not follows the verb directly and replaces the negative thought. The second part with but follows.'),
               'I am afraid that not, but we can try again next week.', ('not', 'that not', 'Vor not steht kein that.', 'There is no that before not.'),
               single='I am afraid not bildet den ersten Teil; but we can try again next week folgt danach.'),
    order_item('el.do-so', 'She signed the contract, and I did the same.', 'Sie unterschrieb den Vertrag, und ich tat dasselbe.',
               ['she signed', 'the contract', 'and', 'I', 'did', 'the same'],
               ('Did the same ersetzt die ganze Handlung signed the contract. Das Verb wird nicht wiederholt.', 'Did the same replaces the whole action signed the contract. The verb is not repeated.'),
               'She signed the contract, and I did same.', ('the same', 'same', 'Vor same steht the.', 'Before same you need the.'),
               single='She signed the contract ist der erste Teil; and I did the same folgt danach.'),
    order_item('el.do-so', 'Anyone who wants to cancel may do so before Friday.', 'Wer stornieren möchte, kann das vor Freitag tun.',
               ['anyone', 'who wants to', 'cancel', 'may do so', 'before Friday'],
               ('Do so ersetzt die Handlung cancel und klingt förmlich. Es steht direkt hinter dem Modalverb may.', 'Do so replaces the action cancel and sounds formal. It stands directly after the modal may.'),
               'Anyone who wants to cancel may do it so before Friday.', ('may do so', 'may do it so', 'Es heißt do so, nicht do it so.', 'It is do so, not do it so.'),
               single='Anyone who wants to cancel ist das Subjekt; may do so before Friday folgt danach.'),
    order_item('el.one-ones', 'Our old system is slow, but the new one is fast.', 'Unser altes System ist langsam, aber das neue ist schnell.',
               ['our old system', 'is slow', 'but', 'the new one', 'is fast'],
               ('One ersetzt das Nomen system. Hinter dem Adjektiv new darf one nicht fehlen.', 'One replaces the noun system. After the adjective new, one must not be missing.'),
               'Our old system is slow, but the new is fast.', ('the new one', 'the new', 'Nach new braucht es one.', 'After new you need one.'),
               single='Der erste Teil our old system is slow steht vorn; but the new one is fast folgt danach.'),
    order_item('el.one-ones', 'The costs of the new plan are lower than those of the old plan.', 'Die Kosten des neuen Plans sind niedriger als die des alten Plans.',
               ['the costs', 'of the new plan', 'are lower', 'than', 'those of', 'the old plan'],
               ('Those of ersetzt das Pluralnomen costs im Vergleich: Kosten werden mit Kosten verglichen.', 'Those of replaces the plural noun costs in the comparison: costs are compared with costs.'),
               'The costs of the new plan are lower than the old plan.', ('those of', 'the costs of', 'Ohne those of würden Kosten mit einem Plan verglichen.', 'Without those of costs would be compared with a plan.'),
               single='The costs of the new plan steht vorn; are lower than those of the old plan folgt danach.'),
    order_item('el.to-aux', "Can you join us? I'd love to, but I have another meeting.", 'Kannst du uns begleiten? Sehr gern, aber ich habe ein anderes Meeting.',
               ['can you', 'join us', "I'd love to", 'but', 'I have', 'another meeting'],
               ('Bei I’d love to entfällt das Verb join, aber to bleibt stehen. Danach folgt der Einwand mit but.', 'With I’d love to, the verb join is dropped but to stays. The objection with but follows.'),
               "Can you join us? I'd love, but I have another meeting.", ("I'd love to", "I'd love", 'Am Ende muss to stehen bleiben.', 'At the end to has to stay.'),
               single='Die Frage can you join us kommt zuerst, dann I’d love to und der Einwand mit but.'),
    order_item('el.to-aux', 'She can attend the workshop, but he cannot.', 'Sie kann am Workshop teilnehmen, er nicht.',
               ['she', 'can attend', 'the workshop', 'but', 'he', 'cannot'],
               ('Nach cannot entfällt das Verb attend, das Hilfsverb steht allein. Kein to danach.', 'After cannot the verb attend is dropped, the auxiliary stands alone. No to after it.'),
               'She can attend the workshop, but he cannot to.', ('cannot', 'cannot to', 'Nach cannot steht kein to.', 'After cannot there is no to.'),
               single='She can attend the workshop steht vorn; but he cannot beendet den Satz.'),
]

MAP = {
    'Is it ready? I hope that not.': {'pat': 'el.so-not', 'why': {
        'ok': B('Nach hope folgt not direkt: I hope not.', 'After hope, not follows directly: I hope not.'),
        'wrong': [{'if': ['that'], 'de': 'Vor not steht kein that.', 'en': 'There is no that before not.'},
                  {'not': ['not'], 'de': 'Die Verneinung heißt hier not: I hope not.', 'en': 'The negative here is not: I hope not.'}]}},
    'She signed the contract, and I did same.': {'pat': 'el.do-so', 'why': {
        'ok': B('Es heißt did the same: Vor same steht the.', 'It is did the same: before same you need the.'),
        'wrong': [{'not': ['the'], 'de': 'Vor same steht the: the same.', 'en': 'Before same you need the: the same.'},
                  {'if': ['it'], 'de': 'Es heißt did the same, nicht did it.', 'en': 'It is did the same, not did it.'}]}},
    'The costs of the new plan are lower than the old plan.': {'pat': 'el.one-ones', 'why': {
        'ok': B('Kosten werden mit Kosten verglichen: those of the old plan.', 'Costs are compared with costs: those of the old plan.'),
        'wrong': [{'not': ['those'], 'de': 'Im Vergleich steht those of statt des Nomens costs.', 'en': 'In the comparison those of stands instead of the noun costs.'},
                  {'if': ['that', 'of'], 'de': 'Costs ist Plural, deshalb those of, nicht that of.', 'en': 'Costs is plural, so those of, not that of.'}]}},
    'Can you join us? Yes, I would like.': {'pat': 'el.to-aux', 'why': {
        'ok': B('Am Ende muss to nicht fehlen: Yes, I would like to.', 'At the end to has to stay: Yes, I would like to.'),
        'wrong': [{'not': ['to'], 'de': 'Nach would like muss to stehen bleiben.', 'en': 'After would like, to has to stay.'},
                  {'if': ['to', 'join'], 'de': 'Das Verb join entfällt, nur to bleibt.', 'en': 'The verb join is dropped, only to stays.'}]}},
}

def c1x():
    mcc(T, 'el.so-not', 'C1', 'biz', 0.0, 'Will the migration finish by Friday? I ___, but we should prepare a plan B.',
        'hope so', ['hope it so', 'hope that', 'hope yes'],
        ('Nach hope ersetzt so den ganzen Gedanken: I hope so.', 'After hope, so replaces the whole thought: I hope so.'),
        [(G, 'Es heißt hope so, ohne it.', 'It is hope so, without it.'),
         (G, 'Hope that braucht danach einen Satz. Allein steht es nicht.', 'Hope that needs a clause after it. It cannot stand alone.'),
         (C, 'Das deutsche „ich hoffe ja“ verleitet zu yes. Englisch sagt so.', 'The German “ich hoffe ja” suggests yes. English says so.')])
    mcc(T, 'el.so-not', 'C1', 'biz', 0.0, 'Has the client approved the offer? I ___; they still have questions.',
        'am afraid not', ['am afraid no', 'am afraid that not', 'am afraid so'],
        ('Die Antwort ist negativ, und not steht für den ganzen Gedanken: I am afraid not.', 'The answer is negative, and not stands for the whole thought: I am afraid not.'),
        [(G, 'No steht nicht für einen Gedanken, hier braucht es not.', 'No does not stand for a thought, here you need not.'),
         (G, 'Vor not steht kein that.', 'There is no that before not.'),
         (M, 'So wäre eine positive Antwort, aber es gibt noch Fragen.', 'So would be a positive answer, but there are still questions.')])
    mcc(T, 'el.do-so', 'C1', 'biz', 0.0, 'Employees who wish to change their working hours must ___ in writing.',
        'do so', ['do it so', 'so do', 'do such'],
        ('Do so ersetzt die ganze Handlung change their working hours und klingt förmlich.', 'Do so replaces the whole action change their working hours and sounds formal.'),
        [(G, 'Es heißt do so, nicht do it so.', 'It is do so, not do it so.'),
         (G, 'So do steht für etwas anderes (so do I) und nicht nach must.', 'So do stands for something else (so do I) and not after must.'),
         (G, 'Do such ist keine feste Wendung.', 'Do such is not a fixed phrase.')])
    mcc(T, 'el.do-so', 'C1', 'biz', 0.0, 'He reviewed every contract carefully, and his colleagues ___.',
        'did the same', ['did same', 'did it the same', 'did so same'],
        ('Did the same ersetzt die Handlung reviewed every contract carefully.', 'Did the same replaces the action reviewed every contract carefully.'),
        [(G, 'Vor same steht the.', 'Before same you need the.'),
         (G, 'Es heißt did the same, ohne it.', 'It is did the same, without it.'),
         (G, 'Do so und the same lassen sich nicht mischen.', 'Do so and the same cannot be combined.')])
    mcc(T, 'el.one-ones', 'C1', 'biz', 0.0, 'These laptops are older than ___ of the sales team.',
        'those', ['that', 'these', 'them'],
        ('Laptops ist Plural: those of ersetzt das Nomen im Vergleich.', 'Laptops is plural: those of replaces the noun in the comparison.'),
        [(G, 'That of gehört zu einem Singular. Laptops ist Plural.', 'That of belongs to a singular. Laptops is plural.'),
         (G, 'These weist auf etwas Nahes hin und passt nicht in den Vergleich.', 'These points to something near and does not fit the comparison.'),
         (G, 'Them passt nicht hinter than … of.', 'Them does not fit after than … of.')])
    mcc(T, 'el.to-aux', 'C1', 'biz', 0.0, "Are you joining the training on Friday? Yes, I would love ___, but my flight is late.",
        'to', ['so', 'for', 'at'],
        ('Das Verb attend entfällt, aber to bleibt: I’d love to.', 'The verb attend is dropped, but to stays: I’d love to.'),
        [(G, 'So gehört zu think und hope, nicht zu love.', 'So belongs to think and hope, not to love.'),
         (G, 'For passt nicht zu einem weggelassenen Infinitiv.', 'For does not fit a dropped infinitive.'),
         (G, 'At passt nicht zu einem weggelassenen Infinitiv.', 'At does not fit a dropped infinitive.')])

    ocl(T, 'el.so-not', 'C1', 'biz', 0.0, 'Will the new tool be cheaper? I expect ___, but I have not seen the quote yet.',
        ['so'], 'adv', ['too', 'also', 'yet'],
        ('Nach expect ersetzt so den ganzen Gedanken: I expect so.', 'After expect, so replaces the whole thought: I expect so.'))
    ocl(T, 'el.so-not', 'C1', 'biz', 0.0, 'Is the report finished? I am afraid ___; we are still checking the figures.',
        ['not'], 'adv', ['no', 'nor', 'never'],
        ('Nach be afraid steht not für den verneinten Gedanken: I am afraid not.', 'After be afraid, not stands for the negative thought: I am afraid not.'))
    ocl(T, 'el.do-so', 'C1', 'biz', 0.0, 'Our competitors reduced their prices in May, and we ___ the same in June.',
        ['did'], 'aux', ['do', 'had', 'were'],
        ('Did the same ersetzt die Handlung reduced our prices.', 'Did the same replaces the action reduced our prices.'))
    ocl(T, 'el.do-so', 'C1', 'biz', 0.0, 'Anyone who wants to withdraw from the course may do ___ until the end of the month.',
        ['so', 'it'], 'adv', ['such', 'thus', 'either'],
        ('Do so ersetzt die Handlung withdraw from the course.', 'Do so replaces the action withdraw from the course.'))
    ocl(T, 'el.one-ones', 'C1', 'biz', 0.0, 'I do not like the old design, but the new ___ looks much better.',
        ['one'], 'pron', ['ones', 'that', 'it'],
        ('One ersetzt das Nomen design. Hinter new darf es nicht fehlen.', 'One replaces the noun design. After new it must not be missing.'))
    ocl(T, 'el.to-aux', 'C1', 'biz', 0.0, 'I did not call the client, although I was asked ___.',
        ['to'], 'part', ['for', 'at', 'on'],
        ('Das Verb call entfällt, aber to bleibt: although I was asked to.', 'The verb call is dropped, but to stays: although I was asked to.'))

    err(T, 'el.so-not', 'C1', 'biz', 0.0, 'Will the update be ready by Monday? I hope that not, because the testers are away.',
        ('hope that not', ['hope not'], ['hope not', 'hope it not', 'hope no']),
        ('Nach hope folgt not direkt, ohne that.', 'After hope, not follows directly, without that.'))
    err(T, 'el.do-so', 'C1', 'biz', 0.0, 'Our rivals lowered their prices, and we did the same last month.', None,
        ('Kein Fehler: Did the same ersetzt lowered our prices.', 'No mistake: Did the same replaces lowered our prices.'))
    err(T, 'el.one-ones', 'C1', 'biz', 0.0, 'Our current provider is expensive, so we are looking for a cheaper.',
        ('a cheaper', ['a cheaper one'], ['a cheaper one', 'a cheaper it', 'cheaper one a']),
        ('Hinter dem Adjektiv cheaper braucht es one.', 'After the adjective cheaper you need one.'))
    err(T, 'el.to-aux', 'C1', 'biz', 0.0, 'Can you attend the workshop on Friday? Yes, I would like.',
        ('would like', ['would like to'], ['would like to', 'would like for', 'would like of']),
        ('Am Ende muss to stehen bleiben: I would like to.', 'At the end to has to stay: I would like to.'))
    err(T, 'el.one-ones', 'C1', 'biz', 0.0, 'The fees of our provider are higher than the new provider.',
        ('than the new provider', ['than those of the new provider'], ['than those of the new provider', 'than that of the new provider', 'than the ones the new provider']),
        ('Gebühren werden mit Gebühren verglichen: those of the new provider.', 'Fees are compared with fees: those of the new provider.'))
    err(T, 'el.one-ones', 'C1', 'biz', 0.0, 'The new tool is faster than the old one, but the old one is cheaper to run.', None,
        ('Kein Fehler: One ersetzt das Nomen tool.', 'No mistake: One replaces the noun tool.'))

    kwt(T, 'el.so-not', 'C1', 'biz', 0.0, 'I hope they will never renew the contract.', 'NOT', 'Will they renew the contract?', '.',
        [(['I hope'], ['not'])], ['I', 'hope'], ['so', 'that', 'no'], [],
        ('I hope not. Not steht direkt hinter dem Verb und ersetzt den Gedanken.', 'I hope not. Not follows the verb directly and replaces the thought.'), [])
    kwt(T, 'el.do-so', 'C1', 'biz', 0.0, 'Anyone can cancel before Friday, but cancellations must be made in writing.', 'SO', 'Anyone can cancel before Friday, but', 'in writing.',
        [(['they must'], ['do so'])], ['they', 'must', 'do'], ['it', 'such', 'does'], ['they must do it so'],
        ('Do so ersetzt die Handlung cancel.', 'Do so replaces the action cancel.'),
        [W(['do', 'it', 'so'], 'Es heißt do so, nicht do it so.', 'It is do so, not do it so.')])
    kwt(T, 'el.do-so', 'C1', 'biz', 0.0, 'Our competitors cut their prices in May, and we cut ours in June, too.', 'SAME', 'Our competitors cut their prices in May, and we', 'in June.',
        [(['did the'], ['same'])], ['did', 'the'], ['do', 'so', 'it'], ['did same'],
        ('Did the same ersetzt die Handlung cut our prices.', 'Did the same replaces the action cut our prices.'),
        [W(['did', 'same'], 'Vor same steht the: the same.', 'Before same you need the: the same.', ['the'])])
    kwt(T, 'el.one-ones', 'C1', 'biz', 0.0, 'The old printer is broken, so we bought a new printer.', 'ONE', 'The old printer is broken, so we bought', '.',
        [(['a new'], ['one'])], ['a', 'new'], ['it', 'ones', 'other'], ['a new ones'],
        ('One ersetzt das Nomen printer.', 'One replaces the noun printer.'),
        [W(['ones'], 'Printer ist Singular, deshalb one, nicht ones.', 'Printer is singular, so one, not ones.')])
    kwt(T, 'el.one-ones', 'C1', 'biz', 0.0, 'The fees of the new provider are lower than the fees of the old provider.', 'THOSE', 'The fees of the new provider are', 'the old provider.',
        [(['lower than'], ['those of'])], ['lower', 'than', 'of'], ['that', 'the', 'ones'], [],
        ('Those of ersetzt das Pluralnomen fees im Vergleich.', 'Those of replaces the plural noun fees in the comparison.'), [])
    kwt(T, 'el.to-aux', 'C1', 'biz', 0.0, 'Yes, I would like to join you for lunch, but I have another meeting.', 'LOVE', 'Would you join us for lunch? Yes,', 'but I have another meeting.',
        [(["I'd"], ['love to'])], ["I'd", 'to'], ['it', 'so', 'of'], [],
        ("I'd love to. Das Verb join entfällt, to bleibt.", "I'd love to. The verb join is dropped, to stays."), [])

def place():
    mcc(T, 'el.one-ones', 'B2+', 'biz', -0.1, 'The previous report was too long, so please write a shorter ___.',
        'one', ['it', 'ones', 'that'],
        ('One ersetzt das Nomen report, damit es nicht wiederholt wird.', 'One replaces the noun report so that it is not repeated.'),
        [(G, 'It ersetzt keinen Teil einer Nominalgruppe nach einem Adjektiv.', 'It does not replace part of a noun phrase after an adjective.'),
         (G, 'Ones ist Plural, aber a shorter steht im Singular.', 'Ones is plural, but a shorter is singular.'),
         (G, 'That passt nicht hinter a shorter.', 'That does not fit after a shorter.')])
    ocl(T, 'el.so-not', 'C1', 'biz', 0.0, 'Are the results final? I hope ___, because we still want to correct two figures.',
        ['not'], 'adv', ['no', 'nor', 'never'],
        ('Nach hope steht not für den verneinten Gedanken: I hope not.', 'After hope, not stands for the negative thought: I hope not.'))
