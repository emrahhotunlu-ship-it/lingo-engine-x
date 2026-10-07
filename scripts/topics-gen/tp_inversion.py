from cm import *
import lib
from lib import mcc, ocl, err, kwt, W

G = 'grammar'; M = 'meaning'; C = 'calque'; P = 'partner'; R = 'register'
T = 'inversion'

TOPIC = {
    'id': T, 'group': 'Grammatik-Pfad', 'level': 'C1', 'p0': 0.45,
    'name': 'Inversion – Umstellung nach Einleitern', 'name_en': 'Inversion after fronted words',
    'rule': 'Steht ein verneinendes oder einschränkendes Wort vorn (Never, Rarely, Only after, No sooner, Should you), kommt das Hilfsverb vor das Subjekt: „Rarely have we seen such a plan.“ So klingt eine Aussage förmlich und betont.',
    'rule_en': 'When a negative or limiting word comes first (Never, Rarely, Only after, No sooner, Should you), the auxiliary goes before the subject: “Rarely have we seen such a plan.” This makes a statement formal and emphatic.',
    'ex': ['Never before had the team met a deadline so early.', 'Should you need any help, please let us know.'],
}

PAT = [
    pattern('inv.negative', ('Never, Rarely, Little · Hilfsverb vor Subjekt', 'Never, Rarely, Little · auxiliary before subject'),
            ('Never / Rarely / Seldom / Little + Hilfsverb + Subjekt + 3. Form', 'Never / Rarely / Seldom / Little + auxiliary + subject + participle'),
            ('Ein verneinendes oder einschränkendes Wort am Satzanfang betont die Aussage. Danach steht das Hilfsverb vor dem Subjekt, wie in einer Frage.',
             'A negative or limiting word at the start stresses the statement. The auxiliary then comes before the subject, as in a question.'),
            ['never', 'rarely', 'seldom', 'little', 'at no point', 'under no circumstances'],
            [('Rarely have I seen such a clear proposal.', 'Selten habe ich einen so klaren Vorschlag gesehen.', 'meeting'),
             ('Never before had the team met a deadline so early.', 'Noch nie hatte das Team eine Frist so früh eingehalten.', 'talk'),
             ('At no point did the client mention the budget.', 'Zu keinem Zeitpunkt erwähnte der Kunde das Budget.', 'mail')],
            ('Rarely we have seen such a clear proposal.', 'Rarely have we seen such a clear proposal.',
             'Im Deutschen rückt das Verb nach dem ersten Satzglied von selbst an die zweite Stelle. Im Englischen geschieht das nur nach solchen Einleitern, und man vergisst es, wenn der Satz sonst normal läuft.',
             'In German the verb moves to second place on its own after the first element. In English that only happens after words like these, and it is easy to forget when the sentence otherwise runs normally.'),
            ('em.neg-inversion', 'Rarely have we seen such a fast rollout.', 'We have rarely seen such a fast rollout.',
             'Am Satzanfang braucht rarely die Umstellung. Mitten im Satz steht es normal vor dem Verb.', 'At the start, rarely needs inversion. Inside the sentence it stands before the verb as usual.'),
            [('Never had we seen such demand.', 'Hatten wir diese Nachfrage schon einmal gesehen?', 'Had we seen such demand before?', False)],
            ('Welches Hilfsverb gehört vor das Subjekt, wenn der Satz mit diesem Einleiter beginnt?', 'Which auxiliary has to move in front of the subject when the sentence opens with this word?')),
    pattern('inv.only', ('Only after, Only when · Umstellung im Hauptsatz', 'Only after, Only when · main clause inverted'),
            ('Only + Zeit oder Bedingung + Hilfsverb + Subjekt + Verb', 'Only + time or condition + auxiliary + subject + verb'),
            ('Nach „Only after“, „Only when“ oder „Only then“ am Anfang folgt im Hauptsatz die Umstellung. Der Nebensatz davor bleibt normal.',
             'After “Only after”, “Only when” or “Only then” at the start, the main clause is inverted. The clause before it stays normal.'),
            ['only after', 'only when', 'only then', 'only if', 'only by'],
            [('Only after the pilot did we approve the full rollout.', 'Erst nach dem Pilotbetrieb gaben wir den ganzen Rollout frei.', 'meeting'),
             ('Only then did I understand the problem.', 'Erst dann habe ich das Problem verstanden.', 'talk'),
             ('Only when the client signs will we start the work.', 'Erst wenn der Kunde unterschreibt, fangen wir an.', 'mail')],
            ('Only after the pilot we approved the full rollout.', 'Only after the pilot did we approve the full rollout.',
             'Das Deutsche sagt „Erst nach dem Pilot haben wir …“, dort ist die Umstellung selbstverständlich. Im Englischen fehlt sie leicht, weil „only“ nicht wie ein Verneinungswort wirkt.',
             'German says “Erst nach dem Pilot haben wir …”, where the inverted order is natural. In English it is easy to miss, because “only” does not look like a negative word.'),
            ('inv.negative', 'Only then did I understand it.', 'Never did I understand it.',
             'Beide stellen um. Only grenzt den Zeitpunkt ein, Never verneint die ganze Aussage.', 'Both invert. Only limits the point in time, Never negates the whole statement.'),
            [('Only after the audit did we change the process.', 'Haben wir den Prozess vor der Prüfung geändert?', 'Did we change the process before the audit?', False)],
            ('Steht „Only“ mit Zeit oder Bedingung vorn? Dann braucht der Hauptsatz das Hilfsverb vor dem Subjekt.', 'Does “Only” with a time or condition open the sentence? Then the main clause needs the auxiliary before the subject.')),
    pattern('inv.sooner', ('No sooner … than, Hardly … when', 'No sooner … than, Hardly … when'),
            ('No sooner + had + Subjekt + 3. Form + than + Past Simple', 'No sooner + had + subject + participle + than + past simple'),
            ('Zwei Ereignisse folgen unmittelbar aufeinander. Das erste steht im Past Perfect mit Umstellung, das zweite im Past Simple.',
             'Two events follow each other immediately. The first is in the past perfect with inversion, the second in the past simple.'),
            ['no sooner', 'hardly', 'scarcely', 'barely', 'than', 'when'],
            [('No sooner had we signed than the prices rose.', 'Kaum hatten wir unterschrieben, stiegen die Preise.', 'talk'),
             ('Hardly had the meeting started when the alarm went off.', 'Das Meeting hatte kaum begonnen, da ging der Alarm los.', 'meeting'),
             ('Scarcely had she arrived when the call began.', 'Sie war kaum angekommen, da begann der Anruf.', 'mail')],
            ('No sooner had we signed when the prices rose.', 'No sooner had we signed than the prices rose.',
             'Zu „no sooner“ gehört „than“, zu „hardly“ und „scarcely“ gehört „when“. Beides wird leicht vertauscht, weil das Deutsche beides mit „als“ oder „da“ wiedergibt.',
             'No sooner goes with than, hardly and scarcely go with when. The two are easily mixed up, because German renders both with “als” or “da”.'),
            ('wo.hardly-sooner', 'Hardly had we started when it began to rain.', 'As soon as we started, it began to rain.',
             'Beide meinen „kaum … da“. Die Umstellung ist förmlicher und betont, wie plötzlich es kam.', 'Both mean “hardly … when”. The inversion is more formal and stresses how sudden it was.'),
            [('No sooner had she left than the phone rang.', 'Hat das Telefon geklingelt, bevor sie ging?', 'Did the phone ring before she left?', False)],
            ('Welches Wort gehört zu „no sooner“ und welches zu „hardly“? Und wo steht das Hilfsverb?', 'Which word goes with “no sooner” and which with “hardly”? And where does the auxiliary stand?')),
    pattern('inv.cond', ('Should you, Had we · Bedingung ohne if', 'Should you, Had we · condition without if'),
            ('Should / Were / Had + Subjekt + …, Hauptsatz', 'Should / Were / Had + subject + …, main clause'),
            ('Förmliche Bedingungen ohne „if“: Das Hilfsverb steht vorn. Should nennt eine Möglichkeit, Were … to eine Vorstellung, Had etwas Vergangenes.',
             'Formal conditions without “if”: the auxiliary comes first. Should names a possibility, Were … to an imagined case, Had something in the past.'),
            ['should you', 'were we to', 'were it not for', 'had we', 'had i'],
            [('Should you need any help, please let us know.', 'Falls Sie Hilfe brauchen, sagen Sie uns bitte Bescheid.', 'mail'),
             ('Were we to postpone the launch, costs would rise.', 'Würden wir den Start verschieben, stiegen die Kosten.', 'meeting'),
             ('Had we known about the outage, we would have warned you.', 'Hätten wir von dem Ausfall gewusst, hätten wir Sie gewarnt.', 'talk')],
            ('Should you will need help, please call us.', 'Should you need help, please call us.',
             'Das Deutsche sagt „Sollten Sie Hilfe brauchen“, und man fügt gern ein will hinzu, weil es um die Zukunft geht. Nach Should you steht aber die Grundform.',
             'German says “Sollten Sie Hilfe brauchen”, and people like to add will because it is about the future. After Should you, though, the base form follows.'),
            ('ca.inversion', 'Had we known, we would have acted.', 'If we had known, we would have acted.',
             'Gleiche Bedeutung. Die Fassung ohne if klingt förmlicher, etwa in Mails und Verträgen.', 'Same meaning. The version without if sounds more formal, for example in emails and contracts.'),
            [('Should you need help, call me.', 'Erwarte ich, dass Sie Hilfe brauchen werden?', 'Do I expect that you will need help?', False)],
            ('Welches Hilfsverb ersetzt das if, und welche Form folgt danach?', 'Which auxiliary replaces the if, and which form follows it?')),
]

FILE = topic_file(T, ('Ich kann Aussagen förmlich und wirkungsvoll betonen: mit Umstellung nach Never, Rarely, Only after, No sooner und bei Bedingungen ohne if.',
                      'I can make statements formal and emphatic: with inversion after Never, Rarely, Only after, No sooner, and in conditions without if.'),
                  PAT, [['inv.negative', 'inv.only'], ['inv.sooner', 'inv.cond']],
                  ([ 'Beginnt der Satz mit Never, Rarely, Seldom, Little oder At no point: Hilfsverb vor das Subjekt.',
                     'Steht „Only“ mit Zeit oder Bedingung vorn: auch hier steht im Hauptsatz das Hilfsverb zuerst.',
                     'Fehlt das if in einer förmlichen Bedingung (Should you, Were we to, Had we): Hilfsverb zuerst.'],
                   ['Does the sentence open with Never, Rarely, Seldom, Little or At no point? Then put the auxiliary before the subject.',
                    'Does “Only” with a time or condition come first? Then the main clause also starts with the auxiliary.',
                    'Is the if missing from a formal condition (Should you, Were we to, Had we)? Then the auxiliary comes first.']))

RULES = rules_from(PAT,
    ('Nach einem verneinenden oder einschränkenden Einleiter am Satzanfang steht das Hilfsverb vor dem Subjekt: „Never have we seen such demand.“ Das gilt auch für Only after, No sooner und für Bedingungen ohne if (Should you, Had we).',
     'After a negative or limiting word at the start, the auxiliary comes before the subject: “Never have we seen such demand.” The same holds for Only after, No sooner and for conditions without if (Should you, Had we).'),
    ('Im Englischen betont man nicht mit der Stimme, sondern mit dem Satzbau. Die Umstellung macht aus einer Feststellung eine Betonung und klingt in Präsentationen und Mails souverän.',
     'English does not stress with the voice alone but with sentence structure. Inversion turns a statement into emphasis and sounds confident in presentations and emails.'),
    ('Aufpassen: Mitten im Satz bleibt alles normal („We have rarely seen …“). Nur am Satzanfang kehrt sich die Stellung um. Gibt es kein Hilfsverb, hilft do: „Rarely do we see …“.',
     'Careful: inside the sentence everything stays normal (“We have rarely seen …”). Only at the start does the order flip. If there is no auxiliary, do helps: “Rarely do we see …”.'),
    (['Steht ein Einleiter wie Never, Rarely, Only after, No sooner vorn?', 'Gibt es schon ein Hilfsverb? Dann kommt es vor das Subjekt.', 'Gibt es keines, setze do, does oder did davor.', 'Bei „No sooner“ folgt than, bei „Hardly“ folgt when.'],
     ['Does a word like Never, Rarely, Only after or No sooner come first?', 'Is there an auxiliary already? Then it goes before the subject.', 'If there is none, add do, does or did.', 'After “No sooner” comes than, after “Hardly” comes when.']))

V = V2('inv')
V.kwt('inv.negative', 'We rarely see such a fast approval.', 'RARELY', '___ such a fast approval.', 'Rarely do we see', (4, 4),
      ('Richtig: Rarely do we see such a fast approval. Am Satzanfang steht das Hilfsverb vor dem Subjekt.', 'Right: Rarely do we see such a fast approval. At the start the auxiliary comes before the subject.'),
      [{'if': ['rarely', 'we'], 'not': ['do'], 'de': 'Nach rarely am Satzanfang kommt do vor das Subjekt: Rarely do we …', 'en': 'After rarely at the start, do goes before the subject: Rarely do we …'}])
V.kwt('inv.negative', 'He had never seen such a mess before.', 'NEVER', '___ such a mess before.', 'Never had he seen', (4, 4),
      ('Richtig: Never had he seen such a mess before. Das Hilfsverb had steht vor dem Subjekt.', 'Right: Never had he seen such a mess before. The auxiliary had goes before the subject.'),
      [{'if': ['never', 'he'], 'not': ['had'], 'de': 'Nach never am Satzanfang kommt had vor das Subjekt: Never had he seen …', 'en': 'After never at the start, had goes before the subject: Never had he seen …'}])
V.kwt('inv.only', 'We will start only when the client signs.', 'ONLY', '___ the client signs will we start.', 'Only when', (2, 2),
      ('Richtig: Only when the client signs will we start. Im Hauptsatz steht will vor we.', 'Right: Only when the client signs will we start. In the main clause will goes before we.'),
      [{'if': ['when', 'the'], 'not': ['only'], 'de': 'Ohne only fehlt die Betonung. Die Lücke braucht Only when.', 'en': 'Without only the stress is missing. The gap needs Only when.'}])
V.kwt('inv.only', 'The full rollout was approved only after the pilot.', 'ONLY', '___ the pilot was the full rollout approved.', 'Only after', (2, 2),
      ('Richtig: Only after the pilot was the full rollout approved. Hinter Only after steht die Umstellung.', 'Right: Only after the pilot was the full rollout approved. The inversion follows Only after.'),
      [{'if': ['after'], 'not': ['only'], 'de': 'Das Schlüsselwort only gehört an den Anfang.', 'en': 'The key word only belongs at the start.'}])
V.kwt('inv.sooner', 'As soon as we signed the contract, the prices rose.', 'SOONER', '___ had we signed the contract than the prices rose.', 'No sooner', (2, 2),
      ('Richtig: No sooner had we signed the contract than the prices rose. Auf no sooner folgt than.', 'Right: No sooner had we signed the contract than the prices rose. No sooner is followed by than.'),
      [{'if': ['sooner'], 'not': ['no'], 'de': 'Es heißt no sooner, mit no.', 'en': 'It is no sooner, with no.'}])
V.kwt('inv.sooner', 'We had barely finished the call when the client rang again.', 'HARDLY', '___ we finished the call when the client rang again.', 'Hardly had', (2, 2),
      ('Richtig: Hardly had we finished the call when the client rang again. Zu hardly passt when.', 'Right: Hardly had we finished the call when the client rang again. Hardly goes with when.'),
      [{'if': ['had'], 'not': ['hardly'], 'de': 'Das Schlüsselwort hardly muss vorn stehen.', 'en': 'The key word hardly must come first.'}])
V.kwt('inv.cond', 'If you require assistance, please write to us.', 'SHOULD', '___ require assistance, please write to us.', 'Should you', (2, 2),
      ('Richtig: Should you require assistance, … Should ersetzt das if, danach steht die Grundform.', 'Right: Should you require assistance, … Should replaces the if, and the base form follows.'),
      [{'if': ['should', 'will'], 'de': 'Nach Should you steht kein will, nur die Grundform.', 'en': 'After Should you there is no will, only the base form.'}])
V.kwt('inv.cond', 'If we had known about the outage, we would have warned you.', 'HAD', '___ about the outage, we would have warned you.', 'Had we known', (3, 3),
      ('Richtig: Had we known about the outage, … Had ersetzt das if, das Subjekt folgt direkt.', 'Right: Had we known about the outage, … Had replaces the if, and the subject follows directly.'),
      [{'if': ['had', 'known'], 'not': ['we'], 'de': 'Nach Had folgt das Subjekt we: Had we known.', 'en': 'After Had comes the subject we: Had we known.'}])
V.find('inv.negative', 'Seldom we receive feedback this quickly.', (1, 2), 'do we receive', 'Seldom do we receive feedback this quickly.',
       ('Der Fehler: nach Seldom am Anfang fehlt do vor dem Subjekt. Richtig: Seldom do we receive …', 'The error: after Seldom at the start, do is missing before the subject. Correct: Seldom do we receive …'),
       ('Nach Seldom kommt das Hilfsverb vor das Subjekt.', 'After Seldom the auxiliary comes before the subject.'))
V.find('inv.negative', 'Little did the board know about the real costs.', None, None, None,
       ('Richtig: Little did the board know … Nach Little am Anfang steht did vor dem Subjekt.', 'Right: Little did the board know … After Little at the start, did stands before the subject.'),
       ('Little did the board know ist richtig umgestellt.', 'Little did the board know is correctly inverted.'))
V.find('inv.only', 'Only after the test phase we released the update.', (5, 6), 'did we release', 'Only after the test phase did we release the update.',
       ('Der Fehler: nach Only after fehlt die Umstellung. Richtig: Only after the test phase did we release …', 'The error: after Only after the inversion is missing. Correct: Only after the test phase did we release …'),
       ('Nach Only after steht das Hilfsverb vor dem Subjekt.', 'After Only after the auxiliary comes before the subject.'))
V.find('inv.only', 'Only when the client signs we will start the work.', (5, 6), 'will we', 'Only when the client signs will we start the work.',
       ('Der Fehler: im Hauptsatz steht will vor dem Subjekt. Richtig: Only when the client signs will we start …', 'The error: in the main clause will goes before the subject. Correct: Only when the client signs will we start …'),
       ('Im Hauptsatz nach Only when kommt das Hilfsverb zuerst.', 'In the main clause after Only when the auxiliary comes first.'))
V.find('inv.sooner', 'No sooner had we left the office when the storm began.', (7, 7), 'than', 'No sooner had we left the office than the storm began.',
       ('Der Fehler: zu no sooner gehört than, nicht when. Richtig: No sooner had we left the office than …', 'The error: no sooner goes with than, not when. Correct: No sooner had we left the office than …'),
       ('Zu no sooner gehört than.', 'No sooner goes with than.'))
V.find('inv.sooner', 'Hardly we had started the call when the line dropped.', (1, 2), 'had we', 'Hardly had we started the call when the line dropped.',
       ('Der Fehler: nach Hardly steht had vor dem Subjekt. Richtig: Hardly had we started the call …', 'The error: after Hardly, had goes before the subject. Correct: Hardly had we started the call …'),
       ('Nach Hardly kommt das Hilfsverb vor das Subjekt.', 'After Hardly the auxiliary comes before the subject.'))
V.find('inv.cond', 'Should you will need support, please contact the help desk.', (2, 3), 'need', 'Should you need support, please contact the help desk.',
       ('Der Fehler: nach Should you steht die Grundform ohne will. Richtig: Should you need support, …', 'The error: after Should you the base form follows without will. Correct: Should you need support, …'),
       ('Nach Should you steht die Grundform.', 'After Should you comes the base form.'))
V.find('inv.cond', 'Had the team known about the delay, they would have called us.', None, None, None,
       ('Richtig: Had the team known … ersetzt das If the team had known.', 'Right: Had the team known … replaces If the team had known.'),
       ('Had the team known ist richtig gebildet.', 'Had the team known is correctly formed.'))
V.meaning('inv.negative', 'Never have I seen such a clear plan.', 'I have never seen such a clear plan.',
          ('Welcher Satz betont stärker, dass es so etwas noch nie gab?', 'Which sentence stresses more that this has never happened before?'), 'a',
          ('Richtig: Satz a. Die Umstellung nach Never hebt die Aussage stärker hervor.', 'Right: sentence a. The inversion after Never makes the statement stronger.'),
          [('b', 'In b steht dasselbe ohne Umstellung. Es ist sachlich, nicht betont.', 'Sentence b says the same without inversion. It is neutral, not stressed.'), ('both', 'Nicht gleich stark: Nur a ist betont.', 'Not equally strong: only a is stressed.')])
V.meaning('inv.only', 'Only after the audit did we change the process.', 'We changed the process before the audit.',
          ('Welcher Satz sagt, dass der Prozess erst nach der Prüfung geändert wurde?', 'Which sentence says the process was changed only after the audit?'), 'a',
          ('Richtig: Satz a. Only after heißt „erst nach“.', 'Right: sentence a. Only after means “not until after”.'),
          [('b', 'In b geschieht die Änderung vor der Prüfung, das ist das Gegenteil.', 'In b the change happens before the audit, which is the opposite.'), ('both', 'Die beiden Sätze sagen Gegenteiliges.', 'The two sentences say opposite things.')])
V.meaning('inv.sooner', 'No sooner had she left than the phone rang.', 'She left a long time after the phone rang.',
          ('Welcher Satz sagt, dass das Telefon gleich nach ihrem Weggang klingelte?', 'Which sentence says the phone rang right after she left?'), 'a',
          ('Richtig: Satz a. No sooner … than heißt „kaum … da“, es ist fast gleichzeitig.', 'Right: sentence a. No sooner … than means “hardly … when”: almost at once.'),
          [('b', 'In b klingelt das Telefon lange vor ihrem Weggang. Das ist die falsche Reihenfolge.', 'In b the phone rings long before she leaves. That is the wrong order.'), ('both', 'Die Reihenfolge der beiden Sätze ist verschieden.', 'The order of events differs between the two sentences.')])
V.meaning('inv.cond', 'Had we known, we would have acted.', 'If we had known, we would have acted.',
          ('Bedeuten beide Sätze dasselbe?', 'Do both sentences mean the same?'), 'both',
          ('Richtig: beide. Had we known ersetzt If we had known, nur förmlicher.', 'Right: both. Had we known replaces If we had known, just more formally.'),
          [('a', 'Nicht nur a: b sagt mit if dasselbe.', 'Not only a: b says the same with if.'), ('b', 'Nicht nur b: a sagt ohne if dasselbe.', 'Not only b: a says the same without if.')])

ORDER = [
    order_item('inv.negative', 'Never before had the team met a deadline so early.', 'Noch nie zuvor hatte das Team eine Frist so früh eingehalten.',
               ['never before', 'had', 'the team', 'met', 'a deadline', 'so early'],
               ('Nach Never before steht das Hilfsverb had vor dem Subjekt the team. Danach folgt die 3. Form met.', 'After Never before, the auxiliary had comes before the subject the team. The participle met follows.'),
               'Never before the team had met a deadline so early.', ('had', 'the team had', 'Im Deutschen stünde das Verb von selbst vorn. Im Englischen muss man had bewusst vor das Subjekt setzen.', 'German would put the verb first on its own. In English you have to put had before the subject on purpose.'),
               single='Nach Never before kommt had vor the team; met, a deadline und so early bleiben danach in dieser Reihenfolge.'),
    order_item('inv.negative', 'At no point did the client mention the budget.', 'Zu keinem Zeitpunkt erwähnte der Kunde das Budget.',
               ['at no point', 'did', 'the client', 'mention', 'the budget'],
               ('Nach At no point steht did vor dem Subjekt, das Verb danach in der Grundform: did the client mention.', 'After At no point, did stands before the subject, and the verb follows in the base form: did the client mention.'),
               'At no point the client mentioned the budget.', ('did', 'mentioned', 'Nach did steht die Grundform mention, nicht mentioned.', 'After did the base form mention is used, not mentioned.'),
               single='At no point verlangt did vor the client; mention steht in der Grundform direkt vor the budget.'),
    order_item('inv.only', 'Only after the pilot did we approve the full rollout.', 'Erst nach dem Pilotbetrieb gaben wir den ganzen Rollout frei.',
               ['only after', 'the pilot', 'did', 'we', 'approve', 'the full rollout'],
               ('Nach Only after und der Zeitangabe steht did vor dem Subjekt we. Das Verb bleibt in der Grundform.', 'After Only after and the time phrase, did stands before the subject we. The verb stays in the base form.'),
               'Only after the pilot we approved the full rollout.', ('did', 'approved', 'Ohne did bleibt die normale Stellung stehen, und das Verb wird zu approved. Hier muss did vor we.', 'Without did the normal order stays and the verb becomes approved. Here did must go before we.'),
               single='Only after the pilot bleibt zusammen vorn; danach kommen did, we und approve in dieser Reihenfolge.'),
    order_item('inv.only', 'Only when the client signs will we start the work.', 'Erst wenn der Kunde unterschreibt, fangen wir mit der Arbeit an.',
               ['only when', 'the client', 'signs', 'will', 'we', 'start', 'the work'],
               ('Im Nebensatz mit Only when steht das Präsens (signs), im Hauptsatz kommt will vor das Subjekt we.', 'In the clause with Only when the present is used (signs), and in the main clause will goes before the subject we.'),
               'Only when the client signs we will start the work.', ('will', 'we will', 'Nach Only when mit Nebensatz kehrt der Hauptsatz um: will we, nicht we will.', 'After Only when plus a clause, the main clause flips: will we, not we will.'),
               single='Der Nebensatz only when the client signs steht vorn; im Hauptsatz folgen will, we und start the work.'),
    order_item('inv.sooner', 'No sooner had we signed the contract than the prices rose.', 'Kaum hatten wir den Vertrag unterschrieben, stiegen die Preise.',
               ['no sooner', 'had', 'we', 'signed', 'the contract', 'than', 'the prices', 'rose'],
               ('No sooner verlangt had vor dem Subjekt und später than. Das zweite Ereignis steht im Past Simple.', 'No sooner requires had before the subject and than later. The second event is in the past simple.'),
               'No sooner had we signed the contract when the prices rose.', ('than', 'when', 'Zu no sooner gehört than. When gehört zu hardly und scarcely.', 'No sooner goes with than. When goes with hardly and scarcely.'),
               single='No sooner had we signed bildet den ersten Teil; than leitet das zweite Ereignis ein.'),
    order_item('inv.sooner', 'Hardly had the meeting started when the alarm went off.', 'Das Meeting hatte kaum begonnen, da ging der Alarm los.',
               ['hardly', 'had', 'the meeting', 'started', 'when', 'the alarm', 'went off'],
               ('Hardly verlangt had vor dem Subjekt und später when. Das zweite Ereignis steht im Past Simple.', 'Hardly requires had before the subject and when later. The second event is in the past simple.'),
               'Hardly the meeting had started when the alarm went off.', ('had', 'the meeting had', 'Nach Hardly kommt had zuerst, dann erst das Subjekt.', 'After Hardly, had comes first and the subject after it.'),
               single='Hardly had the meeting started ist der erste Teil; when verbindet ihn mit the alarm went off.'),
    order_item('inv.cond', 'Should you need any help, please let us know.', 'Falls Sie Hilfe brauchen, sagen Sie uns bitte Bescheid.',
               ['should', 'you', 'need', 'any help', 'please', 'let us know'],
               ('Should steht vor dem Subjekt you und ersetzt das if. Danach folgt die Grundform need.', 'Should stands before the subject you and replaces the if. The base form need follows.'),
               'Should you will need any help, please let us know.', ('need', 'will need', 'Nach Should you steht die Grundform, kein will.', 'After Should you the base form follows, no will.'),
               single='Should you need any help bildet den Bedingungsteil; please let us know ist der Hauptsatz danach.'),
    order_item('inv.cond', 'Had we known about the outage, we would have warned you.', 'Hätten wir von dem Ausfall gewusst, hätten wir Sie gewarnt.',
               ['had', 'we', 'known', 'about the outage', 'we', 'would have warned', 'you'],
               ('Had steht vor dem Subjekt we und ersetzt das if. Im Hauptsatz folgt would have + 3. Form.', 'Had stands before the subject we and replaces the if. The main clause takes would have + participle.'),
               'Had we known about the outage, we would warn you.', ('known', 'knew', 'Nach Had steht die 3. Form known, nicht knew.', 'After Had the participle known follows, not knew.'),
               single='Der Bedingungsteil had we known about the outage steht zuerst; im Hauptsatz folgen we, would have warned und you.'),
]

# ------------------------------------------------------------------ c1x (P36, Ids ab 0500)
def c1x():
    mcc(T, 'inv.negative', 'C1', 'biz', 0.0, 'Little ___ that the whole system was about to fail.',
        'did they realize', ['they realized', 'realized they', 'they did realize'],
        ('Nach Little am Satzanfang steht did vor dem Subjekt, das Verb in der Grundform: Little did they realize.', 'After Little at the start, did goes before the subject and the verb takes the base form: Little did they realize.'),
        [(G, 'Ohne Umstellung fehlt die Betonung, die Little am Anfang verlangt.', 'Without inversion the stress that Little at the start requires is missing.'),
         (G, 'Das Verb steht in der falschen Stelle: Das Hilfsverb did gehört vor das Subjekt.', 'The verb is in the wrong place: the auxiliary did belongs before the subject.'),
         (G, 'did steht hinter dem Subjekt. Nach Little muss es davor stehen.', 'did stands after the subject. After Little it has to stand before it.')])
    mcc(T, 'inv.negative', 'C1', 'biz', 0.0, 'At no point ___ any concerns about the data migration during the call.',
        'did the client raise', ['the client raised', 'raised the client', 'the client did raise'],
        ('Nach At no point steht did vor dem Subjekt, das Verb in der Grundform: did the client raise.', 'After At no point, did stands before the subject and the verb takes the base form: did the client raise.'),
        [(G, 'Ohne Umstellung stimmt die Stellung nach At no point nicht.', 'Without inversion the word order after At no point is wrong.'),
         (G, 'Das Verb raised steht vor dem Subjekt, aber es fehlt das Hilfsverb did.', 'The verb raised comes before the subject, but the auxiliary did is missing.'),
         (G, 'did darf nicht hinter dem Subjekt stehen. Es gehört davor.', 'did must not follow the subject. It belongs before it.')])
    mcc(T, 'inv.only', 'C1', 'biz', 0.0, 'Only after the security review ___ the new portal to all employees.',
        'did we open', ['we opened', 'opened we', 'we did open'],
        ('Nach Only after und der Zeitangabe steht did vor dem Subjekt we, das Verb in der Grundform.', 'After Only after and the time phrase, did stands before the subject we and the verb takes the base form.'),
        [(G, 'Hier fehlt die Umstellung nach Only after.', 'The inversion after Only after is missing here.'),
         (G, 'Das Verb steht vor dem Subjekt, aber ohne Hilfsverb. Man braucht did we open.', 'The verb comes before the subject but without an auxiliary. You need did we open.'),
         (G, 'did gehört vor das Subjekt, nicht dahinter.', 'did belongs before the subject, not after it.')])
    mcc(T, 'inv.sooner', 'C1', 'biz', 0.0, 'No sooner ___ the new office than we realized it was too small.',
        'had we moved into', ['we had moved into', 'did we move into', 'we moved into'],
        ('Nach No sooner steht had vor dem Subjekt, dann die 3. Form: No sooner had we moved into … than.', 'After No sooner, had comes before the subject, then the participle: No sooner had we moved into … than.'),
        [(G, 'Ohne Umstellung bleibt die normale Stellung stehen. Nach No sooner kehrt sie sich um.', 'Without inversion the normal order stays. After No sooner it flips.'),
         (G, 'Mit did und Grundform bleibt die Vorzeitigkeit weg, die no sooner … than braucht.', 'With did and the base form the earlier-action meaning that no sooner … than needs is lost.'),
         (G, 'Past Simple ohne Umstellung passt nicht zu No sooner.', 'The past simple without inversion does not fit No sooner.')])
    mcc(T, 'inv.cond', 'C1', 'biz', 0.0, '___ any questions about the contract, please do not hesitate to contact our legal team.',
        'Should you have', ['You should have', 'If you would have', 'Have you had'],
        ('Should you have … ist eine förmliche Bedingung ohne if: Should steht vor dem Subjekt, danach die Grundform.', 'Should you have … is a formal condition without if: Should stands before the subject, then the base form.'),
        [(G, 'Ohne Umstellung entsteht kein Bedingungssatz, sondern eine Aussage.', 'Without inversion you get a statement, not a condition.'),
         (G, 'Nach if steht kein would. Außerdem ist if schon ein anderes Muster.', 'After if there is no would. Besides, if is a different pattern.'),
         (M, 'Have you had fragt nach etwas Vergangenem und ist keine Bedingung.', 'Have you had asks about the past and is not a condition.')])
    mcc(T, 'inv.cond', 'B2+', 'biz', -0.2, '___ the budget been approved earlier, the project would have finished on time.',
        'Had', ['Has', 'Would', 'Were'],
        ('Had the budget been approved … ersetzt If the budget had been approved. Had steht vor dem Subjekt.', 'Had the budget been approved … replaces If the budget had been approved. Had stands before the subject.'),
        [(G, 'Has passt nicht zu been approved im Sinn einer verpassten Chance.', 'Has does not fit been approved in the sense of a missed chance.'),
         (G, 'Would the budget been ist keine gültige Form.', 'Would the budget been is not a valid form.'),
         (G, 'Were the budget been approved mischt zwei Formen.', 'Were the budget been approved mixes two forms.')])

    ocl(T, 'inv.negative', 'C1', 'biz', 0.0, 'Never ___ the team faced such a complex migration in so short a time.',
        ['has', 'had'], 'aux', ['did', 'was', 'would'],
        ('Nach Never am Satzanfang steht das Hilfsverb vor dem Subjekt: Never has/had the team faced.', 'After Never at the start the auxiliary comes before the subject: Never has/had the team faced.'))
    ocl(T, 'inv.only', 'C1', 'biz', 0.0, 'Only then ___ we understand how serious the problem really was.',
        ['did', 'could', 'would'], 'aux', ['do', 'are', 'have'],
        ('Nach Only then steht das Hilfsverb vor dem Subjekt: Only then did we understand.', 'After Only then the auxiliary comes before the subject: Only then did we understand.'))
    ocl(T, 'inv.sooner', 'C1', 'biz', 0.0, 'No sooner had the meeting ended ___ the next call started.',
        ['than'], 'conj', ['when', 'that', 'then'],
        ('Zu no sooner gehört than: No sooner had … than …', 'No sooner goes with than: No sooner had … than …'))
    ocl(T, 'inv.sooner', 'C1', 'biz', 0.0, 'Hardly had we opened the file ___ the program crashed.',
        ['when', 'before'], 'conj', ['than', 'that', 'then'],
        ('Zu hardly gehört when (oder before): Hardly had … when …', 'Hardly goes with when (or before): Hardly had … when …'))
    ocl(T, 'inv.cond', 'C1', 'biz', 0.0, '___ you need further information, our team will be happy to help.',
        ['Should'], 'aux', ['Would', 'Could', 'Might'],
        ('Should you need … ist eine förmliche Bedingung ohne if.', 'Should you need … is a formal condition without if.'))
    ocl(T, 'inv.cond', 'C1', 'biz', 0.0, 'Were it not ___ the support of our partners, we could not have finished on time.',
        ['for'], 'prep', ['of', 'to', 'by'],
        ('Were it not for + Nomen heißt „wenn nicht … gewesen wäre“ und ersetzt but for.', 'Were it not for + noun means “if it had not been for” and replaces but for.'))

    err(T, 'inv.sooner', 'C1', 'biz', 0.0, 'Hardly the update had finished when the first complaints arrived.',
        ('the update had finished', ['had the update finished'], ['had the update finished', 'the update has finished', 'has the update finished']),
        ('Nach Hardly steht had vor dem Subjekt: Hardly had the update finished when …', 'After Hardly, had stands before the subject: Hardly had the update finished when …'))
    err(T, 'inv.only', 'C1', 'biz', 0.0, 'Only after the contract was signed we could begin the migration.',
        ('we could begin', ['could we begin'], ['could we begin', 'could begin we', 'began we']),
        ('Nach Only after steht das Hilfsverb vor dem Subjekt: could we begin.', 'After Only after the auxiliary comes before the subject: could we begin.'))
    err(T, 'inv.negative', 'C1', 'biz', 0.0, 'Under no circumstances you should share your login details with colleagues.',
        ('you should share', ['should you share'], ['should you share', 'you must share', 'should share you']),
        ('Nach Under no circumstances steht should vor dem Subjekt: should you share.', 'After Under no circumstances, should stands before the subject: should you share.'))
    err(T, 'inv.cond', 'C1', 'biz', 0.0, 'Should you will have any questions, please contact the service team.',
        ('will have', ['have'], ['have', 'had', 'having']),
        ('Nach Should you steht die Grundform ohne will: Should you have …', 'After Should you the base form follows without will: Should you have …'))
    err(T, 'inv.only', 'C1', 'biz', 0.0, 'Not until the audit began did the team realize how many files were missing.', None,
        ('Kein Fehler: Nach Not until am Anfang steht did vor dem Subjekt, wie hier.', 'No mistake: after Not until at the start, did stands before the subject, as here.'))
    err(T, 'inv.cond', 'C1', 'biz', 0.0, 'Had we invested in monitoring earlier, the outage would have been much shorter.', None,
        ('Kein Fehler: Had we invested ersetzt If we had invested.', 'No mistake: Had we invested replaces If we had invested.'))

    kwt(T, 'inv.negative', 'C1', 'biz', 0.0, 'This is the first time we have seen such a high demand.', 'NEVER', '', 'such a high demand.',
        [(['Never before'], ['have we seen'])], ['before', 'have', 'we', 'seen'], ['has', 'been', 'saw'], ['Never before we have seen'],
        ('Nach Never before steht das Hilfsverb vor dem Subjekt: Never before have we seen.', 'After Never before, the auxiliary comes before the subject: Never before have we seen.'),
        [W(['we', 'have', 'seen'], 'Nach Never before kommt have vor we: have we seen.', 'After Never before, have comes before we: have we seen.')])
    kwt(T, 'inv.sooner', 'C1', 'biz', 0.0, 'The client changed the requirements right after we began the work.', 'SOONER', '', 'the work than the client changed the requirements.',
        [(['No sooner'], ['had we begun'])], ['No', 'had', 'we', 'begun'], ['when', 'did', 'have'], [],
        ('No sooner had we begun the work than … Zu no sooner gehört than.', 'No sooner had we begun the work than … No sooner goes with than.'), [])
    kwt(T, 'inv.only', 'C1', 'biz', 0.0, 'The system can open to all users when the data check ends, but not before.', 'ONLY', '', 'can the system open to all users.',
        [(['Only when'], ['the data check ends', 'the check is done'])], ['when', 'the', 'data', 'check', 'ends'], ['did', 'if', 'will'], [],
        ('Only when the data check ends can the system open … Nach Only when kommt can vor das Subjekt.', 'Only when the data check ends can the system open … After Only when, can comes before the subject.'), [])
    kwt(T, 'inv.cond', 'C1', 'biz', 0.0, 'If you need further details, simply reply to this email.', 'SHOULD', '', 'further details, simply reply to this email.',
        [(['Should'], ['you need'])], ['you', 'need'], ['will', 'would', 'if'], ['Should you will need'],
        ('Should you need … ist eine förmliche Bedingung ohne if und ohne will.', 'Should you need … is a formal condition without if and without will.'),
        [W(['should', 'will'], 'Nach Should you steht die Grundform, kein will.', 'After Should you the base form follows, no will.')])
    kwt(T, 'inv.cond', 'C1', 'biz', 0.0, 'Without the support of our partners, we could not have finished on time.', 'WERE', '', 'the support of our partners, we could not have finished on time.',
        [(['Were it'], ['not for'])], ['it', 'not', 'for'], ['had', 'was', 'without'], [],
        ('Were it not for + Nomen heißt „wenn nicht … gewesen wäre“.', 'Were it not for + noun means “if it had not been for”.'), [])
    kwt(T, 'inv.sooner', 'C1', 'biz', 0.0, 'We had barely opened the report when the phone rang.', 'HARDLY', '', 'opened the report when the phone rang.',
        [(['Hardly'], ['had we'])], ['had', 'we'], ['has', 'did', 'than'], ['Hardly we had'],
        ('Hardly had we opened … when … Nach Hardly steht had vor dem Subjekt.', 'Hardly had we opened … when … After Hardly, had stands before the subject.'),
        [W(['hardly', 'we', 'had'], 'Nach Hardly kommt had vor we: had we.', 'After Hardly, had comes before we: had we.')])

def place():
    mcc(T, 'inv.only', 'C1', 'biz', 0.0, 'Not until the contract was signed ___ the technical team begin its preparation.',
        'did', ['had', 'was', 'does'],
        ('Nach Not until am Anfang steht did vor dem Subjekt, danach die Grundform begin.', 'After Not until at the start, did stands before the subject, then the base form begin.'),
        [(G, 'had würde die 3. Form verlangen, hier folgt aber begin.', 'had would need the participle, but begin follows here.'),
         (G, 'was passt nicht zu begin.', 'was does not fit begin.'),
         (G, 'Das Präsens does passt nicht zu was signed in der Vergangenheit.', 'The present does does not fit was signed in the past.')])
    kwt(T, 'inv.negative', 'C1', 'biz', 0.0, 'The board did not realize how serious the problem was.', 'LITTLE', '', 'realize how serious the problem was.',
        [(['Little did'], ['the board'])], ['did', 'the', 'board'], ['does', 'would', 'not'], ['Little the board did'],
        ('Nach Little am Satzanfang steht did vor dem Subjekt: Little did the board realize.', 'After Little at the start, did stands before the subject: Little did the board realize.'),
        [W(['little', 'board', 'did'], 'Nach Little kommt did vor the board.', 'After Little, did comes before the board.')])


MAP = {
    'Rarely we have seen such a clear proposal.': {'pat': 'inv.negative', 'why': {
        'ok': B('„Rarely“ am Satzanfang verlangt die Umstellung wie in einer Frage: Rarely have we seen.', '“Rarely” at the start requires inversion as in a question: Rarely have we seen.'),
        'wrong': [{'if': ['we', 'have'], 'de': 'Das Hilfsverb steht vor dem Subjekt: Rarely have we seen.', 'en': 'The auxiliary comes before the subject: Rarely have we seen.'},
                  {'if': ['did'], 'de': 'Mit seen bleibt es bei have, nicht did: Rarely have we seen.', 'en': 'With seen keep have, not did: Rarely have we seen.'}]}},
    'Only after the pilot we approved the full rollout.': {'pat': 'inv.only', 'why': {
        'ok': B('Nach „Only after“ steht did vor dem Subjekt, das Verb in der Grundform: did we approve.', 'After “Only after”, did stands before the subject and the verb takes the base form: did we approve.'),
        'wrong': [{'not': ['did'], 'de': 'Vor das Subjekt we gehört did: Only after the pilot did we approve.', 'en': 'Before the subject we you need did: Only after the pilot did we approve.'},
                  {'if': ['approved'], 'de': 'Nach did steht die Grundform: approve, nicht approved.', 'en': 'After did comes the base form: approve, not approved.'}]}},
    'No sooner had we signed when the prices rose.': {'pat': 'inv.sooner', 'why': {
        'ok': B('Zu „no sooner“ gehört than: No sooner had we signed than the prices rose.', '“No sooner” goes with than: No sooner had we signed than the prices rose.'),
        'wrong': [{'if': ['when'], 'de': 'When gehört zu hardly. Zu no sooner gehört than.', 'en': 'When goes with hardly. No sooner goes with than.'},
                  {'not': ['than'], 'de': 'Zu no sooner gehört than.', 'en': 'No sooner goes with than.'}]}},
    'Should you will need help, please call us.': {'pat': 'inv.cond', 'why': {
        'ok': B('Nach Should you steht die Grundform ohne will: Should you need help.', 'After Should you the base form follows without will: Should you need help.'),
        'wrong': [{'if': ['will'], 'de': 'Nach Should you steht kein will, nur die Grundform.', 'en': 'After Should you there is no will, only the base form.'},
                  {'not': ['should'], 'de': 'Die förmliche Bedingung beginnt mit Should you.', 'en': 'The formal condition starts with Should you.'}]}},
}
