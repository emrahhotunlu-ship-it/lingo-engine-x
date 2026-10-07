from cm import *
import lib
from lib import mcc, ocl, err, kwt, W

G = 'grammar'; M = 'meaning'; C = 'calque'; P = 'partner'; R = 'register'
T = 'modals-prob'

TOPIC = {
    'id': T, 'group': 'Grammatik-Pfad', 'level': 'C1', 'p0': 0.45,
    'name': 'Wahrscheinlichkeit mit Modalverben', 'name_en': 'Probability with modals',
    'rule': 'Wie wahrscheinlich etwas ist, sagst du in Stufen: „may well“ (durchaus möglich), „is likely to“ (wahrscheinlich), „is bound to“ (so gut wie sicher) und „There is a good chance that …“.',
    'rule_en': 'You express how probable something is in steps: “may well” (quite possible), “is likely to” (probable), “is bound to” (almost certain) and “There is a good chance that …”.',
    'ex': ['The client may well reject the first offer.', 'Prices are bound to rise after the merger.'],
}

PAT = [
    pattern('mp.may-well', ('may well, might well · durchaus möglich', 'may well, might well · quite possible'),
            ('may / might / could + well + Grundform', 'may / might / could + well + base form'),
            ('Mit well wird die Möglichkeit stärker: „may well“ heißt „durchaus möglich“, fast „wahrscheinlich“. Es klingt vorsichtig und doch deutlich.',
             'Well makes the possibility stronger: “may well” means “quite possibly”, almost “probably”. It sounds careful yet clear.'),
            ['may well', 'might well', 'could well'],
            [('The client may well reject the first offer.', 'Es ist gut möglich, dass der Kunde das erste Angebot ablehnt.', 'meeting'),
             ('This could well be our best quarter so far.', 'Das könnte durchaus unser bestes Quartal bisher werden.', 'talk'),
             ('You might well need a second server by autumn.', 'Es kann gut sein, dass Sie bis zum Herbst einen zweiten Server brauchen.', 'mail')],
            ('The client may be well reject the first offer.', 'The client may well reject the first offer.',
             'Das deutsche „durchaus“ steht frei im Satz. Im Englischen steht well fest direkt hinter may, might oder could, ohne be dazwischen.',
             'The German “durchaus” can stand almost anywhere. In English well stands right after may, might or could, with no be between them.'),
            ('md.might-now', 'The client may well reject it.', 'The client may reject it.',
             'May well macht die Möglichkeit stärker. Ohne well bleibt sie offen.', 'May well makes the possibility stronger. Without well it stays open.'),
            [('The new tool might well be cheaper.', 'Ist es durchaus möglich, dass das Tool billiger ist?', 'Is it quite possible that the tool is cheaper?', True)],
            ('Wie stark ist die Möglichkeit? Soll sie fast wahrscheinlich klingen, dann gehört well hinter das Modalverb.', 'How strong is the possibility? If it should sound almost probable, well belongs right after the modal.')),
    pattern('mp.bound', ('be bound to, be sure to · fast sicher', 'be bound to, be sure to · almost certain'),
            ('be bound / sure / certain + to + Grundform', 'be bound / sure / certain + to + base form'),
            ('Etwas wird fast sicher passieren, weil die Lage es verlangt: „is bound to rise“. Es ist stärker als may und klingt wie ein Urteil.',
             'Something will almost certainly happen because the situation requires it: “is bound to rise”. It is stronger than may and sounds like a judgment.'),
            ['is bound to', 'are bound to', 'is sure to', 'is certain to'],
            [('Prices are bound to rise after the merger.', 'Die Preise werden nach der Fusion mit Sicherheit steigen.', 'meeting'),
             ('The client is sure to ask about the deadline.', 'Der Kunde wird ganz sicher nach der Frist fragen.', 'mail'),
             ('Someone is bound to notice the error.', 'Irgendjemand wird den Fehler ganz sicher bemerken.', 'talk')],
            ('Prices are bound rising after the merger.', 'Prices are bound to rise after the merger.',
             'Nach bound steht to und die Grundform. Das -ing kommt von Wendungen wie „look forward to“ und passt hier nicht.',
             'After bound comes to and the base form. The -ing comes from phrases like “look forward to” and does not fit here.'),
            ('mp.may-well', 'Prices are bound to rise.', 'Prices may well rise.',
             'Bound to ist fast sicher. May well ist durchaus möglich, aber nicht sicher.', 'Bound to is almost certain. May well is quite possible, but not certain.'),
            [('Someone is bound to notice the error.', 'Ist es fast sicher, dass es jemand bemerkt?', 'Is it almost certain that someone notices?', True)],
            ('Ist es fast sicher? Dann passt be bound to oder be sure to, gefolgt von der Grundform.', 'Is it almost certain? Then be bound to or be sure to fits, followed by the base form.')),
    pattern('mp.likely', ('be likely to, be unlikely to · wahrscheinlich', 'be likely to, be unlikely to · probable'),
            ('be (un)likely + to + Grundform · It is likely that …', 'be (un)likely + to + base form · It is likely that …'),
            ('Die Wahrscheinlichkeit wird mit likely oder unlikely ausgedrückt, auch gesteigert: „highly likely“, „most likely“. Das Subjekt der Aussage steht vorn.',
             'Probability is expressed with likely or unlikely, also strengthened: “highly likely”, “most likely”. The subject of the statement comes first.'),
            ['is likely to', 'is unlikely to', 'highly likely', 'most likely', 'not likely to'],
            [('The update is likely to be ready on Friday.', 'Das Update wird voraussichtlich am Freitag fertig.', 'mail'),
             ('A price cut is highly unlikely this year.', 'Eine Preissenkung ist dieses Jahr sehr unwahrscheinlich.', 'meeting'),
             ('The delay is unlikely to affect the launch.', 'Die Verzögerung wird den Start wahrscheinlich nicht beeinträchtigen.', 'talk')],
            ('The update is likely that it is ready on Friday.', 'The update is likely to be ready on Friday.',
             'Nach dem Subjekt steht likely + to + Grundform. „It is likely that …“ geht auch, aber dann beginnt der Satz mit it.',
             'After the subject comes likely + to + base form. “It is likely that …” works too, but then the sentence starts with it.'),
            ('mp.chance', 'The update is likely to be ready.', 'It is likely that the update will be ready.',
             'Gleiche Bedeutung. Mit it folgt ein that-Satz, mit dem Subjekt vorn ein to-Infinitiv.', 'Same meaning. With it a that-clause follows, with the subject first a to-infinitive.'),
            [('The delay is unlikely to affect the launch.', 'Wird die Verzögerung den Start wahrscheinlich beeinträchtigen?', 'Will the delay probably affect the launch?', False)],
            ('Soll es wahrscheinlich oder unwahrscheinlich klingen? Dann passt likely oder unlikely mit to und der Grundform.', 'Should it sound probable or improbable? Then likely or unlikely with to and the base form fits.')),
    pattern('mp.chance', ('a good chance, highly probable · Nominalstil', 'a good chance, highly probable · noun style'),
            ('There is a (good) chance that … · It is (highly) probable that …', 'There is a (good) chance that … · It is (highly) probable that …'),
            ('Mit Nomen und Adjektiv wie chance, possibility, probable drückt man Wahrscheinlichkeit aus, oft in Berichten. Danach steht ein that-Satz.',
             'With nouns and adjectives like chance, possibility, probable you express probability, often in reports. A that-clause follows.'),
            ['a good chance', 'a slim chance', 'there is a possibility', 'highly probable', 'it is possible that'],
            [('There is a good chance that the supplier will agree.', 'Es besteht eine gute Chance, dass der Lieferant zustimmt.', 'meeting'),
             ('It is highly probable that costs will rise.', 'Es ist sehr wahrscheinlich, dass die Kosten steigen.', 'mail'),
             ('There is only a slim chance of a refund.', 'Es besteht nur eine kleine Chance auf eine Rückerstattung.', 'talk')],
            ('It exists a good chance that the supplier will agree.', 'There is a good chance that the supplier will agree.',
             'Das deutsche „es besteht“ führt zu „it exists“. Englisch sagt there is.', 'German “es besteht” leads to “it exists”. English says there is.'),
            ('mp.bound', 'There is a good chance that prices will rise.', 'Prices are bound to rise.',
             'Chance nennt eine Möglichkeit. Bound to nennt etwas fast Sicheres.', 'Chance names a possibility. Bound to names something almost certain.'),
            [('There is only a slim chance of a refund.', 'Ist eine Rückerstattung sehr wahrscheinlich?', 'Is a refund very likely?', False)],
            ('Willst du eine Möglichkeit nennen? Dann passt there is a chance oder it is probable mit einem that-Satz.', 'Do you want to name a possibility? Then there is a chance or it is probable with a that-clause fits.')),
]

FILE = topic_file(T, ('Ich kann Wahrscheinlichkeit in Stufen ausdrücken: durchaus möglich (may well), wahrscheinlich (likely), so gut wie sicher (bound to) und mit chance und probable.',
                      'I can express probability in steps: quite possible (may well), probable (likely), almost certain (bound to), and with chance and probable.'),
                  PAT, [['mp.may-well', 'mp.bound'], ['mp.likely', 'mp.chance']],
                  (['Ist es durchaus möglich, aber nicht sicher? Nimm may, might oder could mit well.',
                    'Ist es wahrscheinlich? Nimm be likely to, bei Verneinung be unlikely to.',
                    'Ist es fast sicher? Nimm be bound to oder be sure to. Willst du es sachlich schreiben, nimm there is a good chance that.'],
                   ['Is it quite possible but not certain? Use may, might or could with well.',
                    'Is it probable? Use be likely to, for the negative be unlikely to.',
                    'Is it almost certain? Use be bound to or be sure to. For a factual tone use there is a good chance that.']))

RULES = rules_from(PAT,
    ('Wahrscheinlichkeit hat Stufen: may well (durchaus möglich), is likely to (wahrscheinlich), is bound to (so gut wie sicher). Dazu kommt der Nominalstil: There is a good chance that …',
     'Probability comes in steps: may well (quite possible), is likely to (probable), is bound to (almost certain). The noun style adds: There is a good chance that …'),
    ('Im Berufsalltag sagst du nicht nur „vielleicht“. Wer Stufen kennt, schätzt klar ein und bleibt trotzdem vorsichtig. Wann ja, wann nein: Prognosen und Risikoberichte brauchen die Stufen, im lockeren Gespräch genügt oft „probably“.',
     'At work you say more than “maybe”. If you know the steps you can judge clearly and still stay careful. When yes, when no: forecasts and risk reports need the steps, in casual talk “probably” is often enough.'),
    ('Nicht verwechseln: may well ist stärker als may, aber schwächer als bound to. Nach bound und likely steht to + Grundform, nach chance ein that-Satz oder of.',
     'Do not mix up: may well is stronger than may but weaker than bound to. After bound and likely comes to + base form, after chance a that-clause or of.'),
    (['Wie sicher bist du? Wähle die Stufe.', 'Durchaus möglich: may/might/could well + Grundform.', 'Wahrscheinlich oder fast sicher: likely to, bound to + Grundform.', 'Sachlich: there is a good chance that …'],
     ['How sure are you? Choose the step.', 'Quite possible: may/might/could well + base form.', 'Probable or almost certain: likely to, bound to + base form.', 'Factual: there is a good chance that …']))

V = V2('mp')
V.kwt('mp.may-well', 'It is quite possible that the client will reject the offer.', 'WELL', 'The client ___ reject the offer.', 'may well', (2, 2),
      ('Richtig: The client may well reject the offer. Well steht direkt hinter may.', 'Right: The client may well reject the offer. Well stands right after may.'),
      [{'if': ['may'], 'not': ['well'], 'de': 'Ohne well fehlt die Verstärkung: may well.', 'en': 'Without well the strengthening is missing: may well.'}], accepted=['might well', 'could well'])
V.kwt('mp.may-well', 'It is quite possible that this will be our best quarter.', 'WELL', 'This ___ be our best quarter.', 'could well', (2, 2),
      ('Richtig: This could well be our best quarter. Well steht direkt hinter could.', 'Right: This could well be our best quarter. Well stands right after could.'),
      [{'if': ['could'], 'not': ['well'], 'de': 'Ohne well fehlt die Verstärkung: could well.', 'en': 'Without well the strengthening is missing: could well.'}], accepted=['may well', 'might well'])
V.kwt('mp.bound', 'It is almost certain that prices will rise after the merger.', 'BOUND', 'Prices are ___ rise after the merger.', 'bound to', (2, 2),
      ('Richtig: Prices are bound to rise. Nach bound steht to und die Grundform.', 'Right: Prices are bound to rise. After bound comes to and the base form.'),
      [{'if': ['bound'], 'not': ['to'], 'de': 'Nach bound braucht es to: bound to rise.', 'en': 'After bound you need to: bound to rise.'}])
V.kwt('mp.bound', 'I am sure that someone will notice the error.', 'SURE', 'Someone is ___ notice the error.', 'sure to', (2, 2),
      ('Richtig: Someone is sure to notice the error. Nach sure steht to und die Grundform.', 'Right: Someone is sure to notice the error. After sure comes to and the base form.'),
      [{'if': ['sure'], 'not': ['to'], 'de': 'Nach sure braucht es to: sure to notice.', 'en': 'After sure you need to: sure to notice.'}])
V.kwt('mp.likely', 'I expect the update to be ready on Friday.', 'LIKELY', 'The update is ___ ready on Friday.', 'likely to be', (3, 3),
      ('Richtig: The update is likely to be ready. Nach likely steht to und die Grundform.', 'Right: The update is likely to be ready. After likely comes to and the base form.'),
      [{'if': ['likely', 'be'], 'not': ['to'], 'de': 'Nach likely braucht es to: likely to be.', 'en': 'After likely you need to: likely to be.'}])
V.kwt('mp.likely', 'It is improbable that the delay will affect the launch.', 'UNLIKELY', 'The delay is ___ the launch.', 'unlikely to affect', (3, 3),
      ('Richtig: The delay is unlikely to affect the launch. Unlikely ist schon verneint.', 'Right: The delay is unlikely to affect the launch. Unlikely is already negative.'),
      [{'if': ['unlikely', 'affect'], 'not': ['to'], 'de': 'Nach unlikely braucht es to: unlikely to affect.', 'en': 'After unlikely you need to: unlikely to affect.'}])
V.kwt('mp.chance', 'Probably the supplier will agree.', 'CHANCE', 'There is a good ___ the supplier will agree.', 'chance that', (2, 2),
      ('Richtig: There is a good chance that the supplier will agree. Danach folgt ein that-Satz.', 'Right: There is a good chance that the supplier will agree. A that-clause follows.'),
      [{'if': ['chance'], 'not': ['that'], 'de': 'Nach chance folgt that und der Satz.', 'en': 'After chance comes that and the clause.'}])
V.kwt('mp.chance', 'It is very probable that costs will rise.', 'HIGHLY', 'It is ___ that costs will rise.', 'highly probable', (2, 2),
      ('Richtig: It is highly probable that costs will rise. Das Adverb highly verstärkt probable.', 'Right: It is highly probable that costs will rise. The adverb highly strengthens probable.'),
      [{'if': ['highly'], 'not': ['probable'], 'de': 'Hinter highly steht das Wort probable.', 'en': 'After highly you need probable.'}])
V.find('mp.may-well', 'You might to well need a second server by autumn.', (2, 3), 'well', 'You might well need a second server by autumn.',
       ('Der Fehler: nach might steht kein to. Richtig: You might well need …', 'The error: there is no to after might. Correct: You might well need …'),
       ('Nach might steht well direkt, ohne to.', 'After might, well follows directly, with no to.'))
V.find('mp.may-well', 'This could well be our best quarter so far.', None, None, None,
       ('Richtig: could well be. Well steht direkt hinter could.', 'Right: could well be. Well stands right after could.'),
       ('could well be ist richtig gebildet.', 'could well be is correctly formed.'))
V.find('mp.bound', 'Sales are bound falling after the price increase.', (3, 3), 'to fall', 'Sales are bound to fall after the price increase.',
       ('Der Fehler: nach bound steht to + Grundform. Richtig: bound to fall.', 'The error: after bound comes to + base form. Correct: bound to fall.'),
       ('Nach bound steht to und die Grundform.', 'After bound comes to and the base form.'))
V.find('mp.bound', 'The customer is certain ask about the deadline.', (4, 4), 'to ask', 'The customer is certain to ask about the deadline.',
       ('Der Fehler: nach certain steht to + Grundform. Richtig: certain to ask.', 'The error: after certain comes to + base form. Correct: certain to ask.'),
       ('Nach certain steht to und die Grundform.', 'After certain comes to and the base form.'))
V.find('mp.likely', 'The update is likely finish on Friday.', (3, 4), 'likely to finish', 'The update is likely to finish on Friday.',
       ('Der Fehler: nach likely fehlt to. Richtig: likely to finish.', 'The error: to is missing after likely. Correct: likely to finish.'),
       ('Nach likely steht to und die Grundform.', 'After likely comes to and the base form.'))
V.find('mp.likely', 'A price cut is highly unlikely this year.', None, None, None,
       ('Richtig: highly unlikely. Highly verstärkt das Wort unlikely.', 'Right: highly unlikely. Highly strengthens unlikely.'),
       ('highly unlikely ist richtig gebildet.', 'highly unlikely is correctly formed.'))
V.find('mp.chance', 'It exists only a slim chance of a refund.', (0, 1), 'There is', 'There is only a slim chance of a refund.',
       ('Der Fehler: „es besteht“ heißt there is, nicht it exists. Richtig: There is only a slim chance …', 'The error: “es besteht” is there is, not it exists. Correct: There is only a slim chance …'),
       ('Englisch sagt there is, nicht it exists.', 'English says there is, not it exists.'))
V.find('mp.chance', 'There is slim chances of a refund this year.', (2, 3), 'a slim chance', 'There is a slim chance of a refund this year.',
       ('Der Fehler: chance steht im Singular mit a. Richtig: a slim chance.', 'The error: chance is singular with a. Correct: a slim chance.'),
       ('Hier braucht chance den Artikel a und den Singular.', 'Here chance needs the article a and the singular.'))
V.meaning('mp.may-well', 'The client may well reject it.', 'The client may reject it.',
          ('Welcher Satz macht die Ablehnung wahrscheinlicher?', 'Which sentence makes the rejection more likely?'), 'a',
          ('Richtig: Satz a. May well macht die Möglichkeit stärker.', 'Right: sentence a. May well makes the possibility stronger.'),
          [('b', 'In b bleibt die Möglichkeit offen, ohne Verstärkung.', 'In b the possibility stays open, without strengthening.'), ('both', 'Nicht gleich stark: Nur a verstärkt die Möglichkeit.', 'Not equally strong: only a strengthens the possibility.')])
V.meaning('mp.bound', 'Prices are bound to rise.', 'Prices may well rise.',
          ('Welcher Satz sagt, dass der Anstieg fast sicher ist?', 'Which sentence says the rise is almost certain?'), 'a',
          ('Richtig: Satz a. Be bound to nennt etwas, das fast sicher ist.', 'Right: sentence a. Be bound to names something almost certain.'),
          [('b', 'In b ist der Anstieg nur durchaus möglich, nicht fast sicher.', 'In b the rise is only quite possible, not almost certain.'), ('both', 'Nicht gleich sicher: Nur a ist fast sicher.', 'Not equally sure: only a is almost certain.')])
V.meaning('mp.likely', 'The delay is unlikely to affect the launch.', 'The delay is likely to affect the launch.',
          ('Welcher Satz sagt, dass der Start wahrscheinlich nicht betroffen ist?', 'Which sentence says the launch is probably not affected?'), 'a',
          ('Richtig: Satz a. Unlikely ist das Wort für „unwahrscheinlich“.', 'Right: sentence a. Unlikely means “improbable”.'),
          [('b', 'In b ist die Auswirkung wahrscheinlich. Das ist das Gegenteil.', 'In b the effect is probable. That is the opposite.'), ('both', 'Die beiden Sätze sagen Gegensätzliches.', 'The two sentences say opposite things.')])
V.meaning('mp.chance', 'There is a good chance that the supplier will agree.', 'The supplier will agree for certain.',
          ('Welcher Satz sagt, dass die Zustimmung möglich, aber nicht sicher ist?', 'Which sentence says the agreement is possible but not certain?'), 'a',
          ('Richtig: Satz a. A good chance nennt eine Möglichkeit, keine Sicherheit.', 'Right: sentence a. A good chance names a possibility, not certainty.'),
          [('b', 'In b ist die Zustimmung sicher. Das ist stärker als eine Chance.', 'In b the agreement is certain. That is stronger than a chance.'), ('both', 'Nicht gleich sicher: Nur b ist sicher.', 'Not equally sure: only b is certain.')])

ORDER = [
    order_item('mp.may-well', 'The client may well reject the first offer.', 'Der Kunde lehnt das erste Angebot gut möglich ab.',
               ['the client', 'may', 'well', 'reject', 'the first', 'offer'],
               ('Well steht direkt hinter dem Modalverb may und macht die Möglichkeit stärker. Danach folgt die Grundform reject.', 'Well stands right after the modal may and makes the possibility stronger. The base form reject follows.'),
               'The client may be well reject the first offer.', ('well', 'be well', 'Zwischen may und well steht kein be.', 'There is no be between may and well.'),
               single='The client may well bildet den Anfang; reject the first offer folgt danach.'),
    order_item('mp.may-well', 'You might well need a second server by autumn.', 'Es kann gut sein, dass Sie bis zum Herbst einen zweiten Server brauchen.',
               ['you', 'might well', 'need', 'a second server', 'by autumn'],
               ('Might well heißt „durchaus möglich“. Danach folgt die Grundform need ohne to.', 'Might well means “quite possibly”. The base form need follows, without to.'),
               'You might to well need a second server by autumn.', ('might well', 'might to well', 'Nach might steht kein to.', 'After might there is no to.'),
               single='You might well need bildet den ersten Teil; a second server by autumn folgt danach.'),
    order_item('mp.bound', 'Prices are bound to rise after the merger.', 'Die Preise werden nach der Fusion mit Sicherheit steigen.',
               ['prices', 'are bound', 'to rise', 'after', 'the merger'],
               ('Be bound to nennt etwas fast Sicheres. Nach bound steht to und die Grundform rise.', 'Be bound to names something almost certain. After bound comes to and the base form rise.'),
               'Prices are bound rising after the merger.', ('to rise', 'rising', 'Nach bound steht to + Grundform, kein -ing.', 'After bound comes to + base form, no -ing.'),
               single='Prices are bound bildet den Anfang; to rise after the merger folgt danach.'),
    order_item('mp.bound', 'Someone is bound to notice the error.', 'Irgendjemand wird den Fehler ganz sicher bemerken.',
               ['someone', 'is', 'bound', 'to notice', 'the error'],
               ('Is bound to ist fast sicher. Nach bound steht to und die Grundform notice.', 'Is bound to is almost certain. After bound comes to and the base form notice.'),
               'Someone is bound notice the error.', ('to notice', 'notice', 'Nach bound braucht es to.', 'After bound you need to.'),
               single='Someone is bound bildet den Anfang; to notice the error folgt danach.'),
    order_item('mp.likely', 'The update is likely to be ready on Friday.', 'Das Update wird voraussichtlich am Freitag fertig.',
               ['the update', 'is likely', 'to be', 'ready', 'on Friday'],
               ('Nach is likely steht to und die Grundform be. Das Subjekt the update steht vorn.', 'After is likely comes to and the base form be. The subject the update comes first.'),
               'The update is likely that it is ready on Friday.', ('to be', 'that it is', 'Mit dem Subjekt vorn folgt likely to, kein that-Satz.', 'With the subject first, likely to follows, not a that-clause.'),
               single='The update is likely bildet den Anfang; to be ready on Friday folgt danach.'),
    order_item('mp.likely', 'The delay is unlikely to affect the launch.', 'Die Verzögerung wird den Start wahrscheinlich nicht beeinträchtigen.',
               ['the delay', 'is', 'unlikely', 'to affect', 'the launch'],
               ('Unlikely ist schon verneint. Nach unlikely steht to und die Grundform affect.', 'Unlikely is already negative. After unlikely comes to and the base form affect.'),
               'The delay is not likely affect the launch.', ('to affect', 'affect', 'Nach unlikely braucht es to.', 'After unlikely you need to.'),
               single='The delay is unlikely bildet den Anfang; to affect the launch folgt danach.'),
    order_item('mp.chance', 'There is a good chance that the supplier will agree.', 'Es besteht eine gute Chance, dass der Lieferant zustimmt.',
               ['there is', 'a good chance', 'that', 'the supplier', 'will agree'],
               ('There is a good chance nennt eine Möglichkeit. Danach folgt ein that-Satz mit dem Subjekt the supplier.', 'There is a good chance names a possibility. A that-clause with the subject the supplier follows.'),
               'It exists a good chance that the supplier will agree.', ('there is', 'it exists', 'Englisch sagt there is, nicht it exists.', 'English says there is, not it exists.'),
               single='There is a good chance bildet den Anfang; that the supplier will agree folgt danach.'),
    order_item('mp.chance', 'It is highly probable that costs will rise.', 'Es ist sehr wahrscheinlich, dass die Kosten steigen.',
               ['it is', 'highly', 'probable', 'that', 'costs', 'will rise'],
               ('Highly verstärkt probable. Danach folgt ein that-Satz mit der Prognose.', 'Highly strengthens probable. A that-clause with the forecast follows.'),
               'It is high probable that costs will rise.', ('highly', 'high', 'Vor einem Adjektiv steht das Adverb highly, nicht high.', 'Before an adjective the adverb highly is used, not high.'),
               single='It is highly probable bildet den Anfang; that costs will rise folgt danach.'),
]

MAP = {
    'The client may be well reject the first offer.': {'pat': 'mp.may-well', 'why': {
        'ok': B('Well steht direkt hinter may: The client may well reject the first offer.', 'Well stands right after may: The client may well reject the first offer.'),
        'wrong': [{'if': ['be', 'well'], 'de': 'Zwischen may und well steht kein be.', 'en': 'There is no be between may and well.'},
                  {'not': ['well'], 'de': 'Die Verstärkung heißt may well.', 'en': 'The strengthening is may well.'}]}},
    'Prices are bound rising after the merger.': {'pat': 'mp.bound', 'why': {
        'ok': B('Nach bound steht to und die Grundform: Prices are bound to rise.', 'After bound comes to and the base form: Prices are bound to rise.'),
        'wrong': [{'if': ['rising'], 'de': 'Nach bound steht kein -ing, sondern to rise.', 'en': 'After bound there is no -ing but to rise.'},
                  {'not': ['to'], 'de': 'Nach bound braucht es to.', 'en': 'After bound you need to.'}]}},
    'The update is likely that it is ready on Friday.': {'pat': 'mp.likely', 'why': {
        'ok': B('Mit dem Subjekt vorn folgt likely to: The update is likely to be ready.', 'With the subject first, likely to follows: The update is likely to be ready.'),
        'wrong': [{'if': ['that'], 'de': 'Nach dem Subjekt steht kein that-Satz, sondern to be.', 'en': 'After the subject there is no that-clause but to be.'},
                  {'not': ['to'], 'de': 'Nach likely braucht es to + Grundform.', 'en': 'After likely you need to + base form.'}]}},
    'It exists a good chance that the supplier will agree.': {'pat': 'mp.chance', 'why': {
        'ok': B('Englisch sagt nicht it exists, sondern there is: There is a good chance that the supplier will agree.', 'English says there is: There is a good chance that the supplier will agree.'),
        'wrong': [{'if': ['it', 'exists'], 'de': 'Das deutsche „es besteht“ heißt there is, nicht it exists.', 'en': 'The German “es besteht” is there is, not it exists.'},
                  {'not': ['there'], 'de': 'Der Satz beginnt mit there is.', 'en': 'The sentence starts with there is.'}]}},
}

def c1x():
    mcc(T, 'mp.may-well', 'C1', 'biz', 0.0, 'The regulator ___ reject our proposal, so we should prepare an alternative.',
        'may well', ['may be well', 'may to well', 'may very'],
        ('Well steht direkt hinter may und macht die Ablehnung durchaus möglich: may well reject.', 'Well stands right after may and makes the rejection quite possible: may well reject.'),
        [(G, 'Zwischen may und well steht kein be.', 'There is no be between may and well.'),
         (G, 'Nach may steht kein to.', 'After may there is no to.'),
         (G, 'Very verstärkt hier nicht die Möglichkeit. Es braucht well.', 'Very does not strengthen the possibility here. It needs well.')])
    mcc(T, 'mp.may-well', 'C1', 'life', 0.0, 'With the clouds getting darker, it ___ rain before we reach the lake.',
        'could well', ['could be well', 'could to well', 'could good'],
        ('Well steht direkt hinter could: could well rain heißt „es kann durchaus regnen“.', 'Well stands right after could: could well rain means “it may quite possibly rain”.'),
        [(G, 'Zwischen could und well steht kein be.', 'There is no be between could and well.'),
         (G, 'Nach could steht kein to.', 'After could there is no to.'),
         (G, 'Good ist ein Adjektiv und verstärkt hier nichts.', 'Good is an adjective and strengthens nothing here.')])
    mcc(T, 'mp.bound', 'C1', 'biz', 0.0, 'Anyone who reads the contract carefully ___ notice the missing clause.',
        'is bound to', ['is bound', 'is bound for', 'is binding to'],
        ('Is bound to nennt etwas fast Sicheres. Danach folgt die Grundform notice.', 'Is bound to names something almost certain. The base form notice follows.'),
        [(G, 'Nach bound braucht es to.', 'After bound you need to.'),
         (G, 'Nach bound steht to, nicht for.', 'After bound comes to, not for.'),
         (M, 'Binding heißt „verbindlich“ und ist hier nicht gemeint.', 'Binding means “obligatory” and is not meant here.')])
    mcc(T, 'mp.bound', 'C1', 'life', 0.0, 'Do not worry about the exam, you ___ pass; you have studied so hard.',
        'are sure to', ['are sure', 'are surely to', 'are sure for'],
        ('Be sure to nennt etwas fast Sicheres. Danach folgt die Grundform pass.', 'Be sure to names something almost certain. The base form pass follows.'),
        [(G, 'Nach sure braucht es to.', 'After sure you need to.'),
         (G, 'Das Adverb surely passt nicht in diese feste Wendung.', 'The adverb surely does not fit this fixed phrase.'),
         (G, 'Nach sure steht to, nicht for.', 'After sure comes to, not for.')])
    mcc(T, 'mp.likely', 'C1', 'biz', 0.0, 'The new interface ___ confuse existing customers, so we planned a short guide.',
        'is likely to', ['is likely that', 'is likelihood to', 'is like to'],
        ('Mit dem Subjekt vorn folgt likely to und die Grundform confuse.', 'With the subject first, likely to follows with the base form confuse.'),
        [(G, 'Nach dem Subjekt steht kein that-Satz, sondern to + Grundform.', 'After the subject there is no that-clause but to + base form.'),
         (G, 'Likelihood ist ein Nomen und kein Adjektiv.', 'Likelihood is a noun, not an adjective.'),
         (G, 'Like to heißt „mögen“, nicht „wahrscheinlich“.', 'Like to means “enjoy”, not “probable”.')])
    mcc(T, 'mp.chance', 'C1', 'biz', 0.0, 'There ___ that the contract will be signed before the end of the month.',
        'is a good chance', ['is good chance', 'are a good chance', 'has a good chance'],
        ('There is a good chance that … nennt eine Möglichkeit. A steht vor good chance.', 'There is a good chance that … names a possibility. A stands before good chance.'),
        [(G, 'Chance ist zählbar im Singular und braucht den Artikel a.', 'Chance is countable in the singular and needs the article a.'),
         (G, 'Chance steht im Singular, deshalb is, nicht are.', 'Chance is singular, so is, not are.'),
         (G, 'There has passt nicht zu einer Möglichkeit.', 'There has does not fit a possibility.')])

    ocl(T, 'mp.may-well', 'C1', 'biz', 0.0, 'The supplier may ___ refuse to change the delivery date at this stage.',
        ['well'], 'adv', ['good', 'very', 'much'],
        ('Well steht direkt hinter may und macht die Möglichkeit stärker: may well refuse.', 'Well stands right after may and makes the possibility stronger: may well refuse.'))
    ocl(T, 'mp.may-well', 'C1', 'life', 0.0, 'This could ___ be the warmest autumn we have had in years.',
        ['well'], 'adv', ['good', 'best', 'more'],
        ('Well steht direkt hinter could: could well be.', 'Well stands right after could: could well be.'))
    ocl(T, 'mp.bound', 'C1', 'biz', 0.0, 'Someone is bound ___ ask about the price sooner or later.',
        ['to'], 'prep', ['for', 'at', 'on'],
        ('Nach bound steht to und die Grundform: bound to ask.', 'After bound comes to and the base form: bound to ask.'))
    ocl(T, 'mp.likely', 'C1', 'biz', 0.0, 'The delay is unlikely ___ affect the launch date.',
        ['to'], 'prep', ['for', 'of', 'at'],
        ('Nach unlikely steht to und die Grundform: unlikely to affect.', 'After unlikely comes to and the base form: unlikely to affect.'))
    ocl(T, 'mp.likely', 'C1', 'biz', 0.0, 'It is highly likely ___ the board will approve the plan next week.',
        ['that'], 'conj', ['to', 'if', 'which'],
        ('Mit it folgt ein that-Satz: It is highly likely that the board will approve.', 'With it a that-clause follows: It is highly likely that the board will approve.'))
    ocl(T, 'mp.chance', 'C1', 'life', 0.0, 'There is only a slim chance ___ finding a table without a booking.',
        ['of'], 'prep', ['on', 'at', 'by'],
        ('Nach chance steht of und das Nomen: a chance of a refund.', 'After chance comes of and the noun: a chance of a refund.'))

    err(T, 'mp.may-well', 'C1', 'biz', 0.0, 'The client may be well reject our first offer, so we should prepare alternatives.',
        ('may be well reject', ['may well reject'], ['may well reject', 'may be reject', 'may well rejecting']),
        ('Well steht direkt hinter may, ohne be: may well reject.', 'Well stands right after may, without be: may well reject.'))
    err(T, 'mp.bound', 'C1', 'life', 0.0, 'My sister is bound getting lost without a map, so I will drive her there.',
        ('bound getting', ['bound to get'], ['bound to get', 'bound to getting', 'bound get']),
        ('Nach bound steht to und die Grundform: bound to get.', 'After bound comes to and the base form: bound to get.'))
    err(T, 'mp.likely', 'C1', 'biz', 0.0, 'The project is likely that finish a week late because of the delay.',
        ('likely that finish', ['likely to finish'], ['likely to finish', 'likely finishing', 'likely finishes']),
        ('Mit dem Subjekt vorn folgt likely to und die Grundform.', 'With the subject first, likely to and the base form follow.'))
    err(T, 'mp.chance', 'C1', 'biz', 0.0, 'It exists a slim chance that the board will reject the budget.',
        ('It exists', ['There is'], ['There is', 'There exist', 'It has']),
        ('Englisch sagt there is, nicht it exists.', 'English says there is, not it exists.'))
    err(T, 'mp.likely', 'C1', 'life', 0.0, 'Our neighbors are unlikely to move before the summer.', None,
        ('Kein Fehler: Unlikely to + Grundform nennt eine unwahrscheinliche Handlung.', 'No mistake: Unlikely to + base form names an improbable action.'))
    err(T, 'mp.chance', 'C1', 'biz', 0.0, 'There is a high chance that the supplier will ask for an extension.', None,
        ('Kein Fehler: There is a high chance that … nennt eine Möglichkeit.', 'No mistake: There is a high chance that … names a possibility.'))

    kwt(T, 'mp.may-well', 'C1', 'biz', 0.0, 'It is quite possible that the regulator will reject our proposal.', 'WELL', 'The regulator', 'our proposal.',
        [(['may well'], ['reject'])], ['may', 'reject'], ['be', 'to', 'good'], [],
        ('may well reject. Well steht direkt hinter may.', 'may well reject. Well stands right after may.'), [])
    kwt(T, 'mp.may-well', 'C1', 'life', 0.0, 'Maybe this will turn out to be the best holiday we ever had.', 'WELL', 'This', 'the best holiday we ever had.',
        [(['could well', 'may well', 'might well'], ['be'])], ['could', 'be'], ['to', 'very', 'good'], [],
        ('could well be. Well steht direkt hinter dem Modalverb.', 'could well be. Well stands right after the modal.'), [])
    kwt(T, 'mp.bound', 'C1', 'biz', 0.0, 'Prices will almost certainly rise once the merger is complete.', 'BOUND', 'Prices are', 'after the merger.',
        [(['bound to'], ['rise'])], ['to', 'rise'], ['for', 'rising', 'be'], ['bound rising'],
        ('bound to rise. Nach bound steht to und die Grundform.', 'bound to rise. After bound comes to and the base form.'),
        [W(['bound', 'rising'], 'Nach bound steht to + Grundform, kein -ing.', 'After bound comes to + base form, no -ing.')])
    kwt(T, 'mp.likely', 'C1', 'biz', 0.0, 'Most probably the update will be ready by Friday.', 'LIKELY', 'The update', 'be ready by Friday.',
        [(['is'], ['likely to'])], ['is', 'to'], ['are', 'that', 'for'], [],
        ('is likely to be. Nach likely steht to und die Grundform.', 'is likely to be. After likely comes to and the base form.'), [])
    kwt(T, 'mp.chance', 'C1', 'life', 0.0, 'My landlord will probably agree to a lower rent.', 'CHANCE', '', 'my landlord will agree to a lower rent.',
        [(['There is a'], ['good chance that'])], ['There', 'is', 'a', 'good', 'that'], ['exists', 'it', 'for'], [],
        ('There is a good chance that … Danach folgt ein that-Satz.', 'There is a good chance that … A that-clause follows.'), [])
    kwt(T, 'mp.likely', 'C1', 'biz', 0.0, 'The delay probably will not affect the launch.', 'UNLIKELY', 'The delay is', 'the launch.',
        [(['unlikely'], ['to affect'])], ['to', 'affect'], ['not', 'likely', 'for'], [],
        ('unlikely to affect. Nach unlikely steht to und die Grundform.', 'unlikely to affect. After unlikely comes to and the base form.'), [])

def place():
    mcc(T, 'mp.may-well', 'B2+', 'biz', -0.1, 'The new competitor is cheaper, so our customers ___ switch within a few months.',
        'may well', ['may be well', 'may good', 'might to'],
        ('Well steht direkt hinter may und macht den Wechsel durchaus möglich: may well switch.', 'Well stands right after may and makes the switch quite possible: may well switch.'),
        [(G, 'Zwischen may und well steht kein be.', 'There is no be between may and well.'),
         (G, 'Good verstärkt hier nichts, es braucht well.', 'Good strengthens nothing here, it needs well.'),
         (G, 'Nach might steht kein to.', 'After might there is no to.')])
    ocl(T, 'mp.bound', 'C1', 'biz', 0.0, 'Given the current figures, this is bound ___ be our best year so far.',
        ['to'], 'prep', ['for', 'at', 'on'],
        ('Nach bound steht to und die Grundform: bound to be.', 'After bound comes to and the base form: bound to be.'))
