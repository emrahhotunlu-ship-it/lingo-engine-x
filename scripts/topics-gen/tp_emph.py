from cm import *
import lib
from lib import mcc, ocl, err, kwt, W

G = 'grammar'; M = 'meaning'; C = 'calque'; P = 'partner'; R = 'register'
T = 'emph-plus'

TOPIC = {
    'id': T, 'group': 'Grammatik-Pfad', 'level': 'C1', 'p0': 0.45,
    'name': 'Hervorheben mit do und Voranstellung', 'name_en': 'Emphasis with do and fronting',
    'rule': 'Mit do („I do think“), einem vorangestellten Adjektiv („Tempting as it is“), so/such … that und einem vorgezogenen Objekt („This we must avoid“) hebst du Wichtiges hervor, ohne laut zu werden.',
    'rule_en': 'With do (“I do think”), a fronted adjective (“Tempting as it is”), so/such … that and a fronted object (“This we must avoid”) you stress what matters without raising your voice.',
    'ex': ['We did send the invoice last week; please check your spam folder.', 'Much as I would like to help, I cannot approve this.'],
}

PAT = [
    pattern('ep.do-emph', ('Emphatisches do · I do think, we did tell', 'Emphatic do · I do think, we did tell'),
            ('Subjekt + do / does / did (betont) + Grundform', 'Subject + do / does / did (stressed) + base form'),
            ('Das Hilfsverb do betont eine Aussage: Man widerspricht, bestätigt nachdrücklich oder räumt einen Zweifel aus. Es wird beim Sprechen betont.',
             'The auxiliary do stresses a statement: you contradict, confirm firmly or remove a doubt. It is spoken with stress.'),
            ['i do', 'we do', 'he does', 'she does', 'we did', 'they did'],
            [('We did send the invoice last week; please check your spam folder.', 'Wir haben die Rechnung letzte Woche wirklich geschickt; bitte prüfen Sie den Spam-Ordner.', 'mail'),
             ('I do understand your concern, but the deadline stays.', 'Ich verstehe Ihre Sorge durchaus, aber die Frist bleibt.', 'meeting'),
             ('He does know the product, believe me.', 'Er kennt das Produkt wirklich, glauben Sie mir.', 'talk')],
            ('We did sent the invoice last week.', 'We did send the invoice last week.',
             'Nach did steht die Grundform, auch wenn die Aussage in der Vergangenheit liegt. Im Deutschen betont man mit Wörtern wie „wirklich“ oder „doch“. Im Englischen trägt did die Vergangenheit, deshalb folgt die Grundform: did send.',
             'After did the base form follows, even when the statement is in the past. German has no such form, so the past form slips in.'),
            ('em.what-cleft', 'I do like the design.', 'What I like is the design.',
             'Do betont, dass etwas wahr ist. Der What-Satz betont, was wichtig ist.', 'Do stresses that something is true. The what-cleft stresses what matters.'),
            [('I do understand the problem.', 'Betone ich, dass ich das Problem verstehe?', 'Do I stress that I understand the problem?', True)],
            ('Welches Wort trägt die Betonung, und welche Form steht nach do, does oder did?', 'Which word carries the stress, and which form follows do, does or did?')),
    pattern('ep.concession', ('Tempting as it is · Voranstellung mit as', 'Tempting as it is · fronting with as'),
            ('Adjektiv / Adverb + as / though + Subjekt + Verb, Hauptsatz', 'Adjective / adverb + as / though + subject + verb, main clause'),
            ('Man stellt ein Adjektiv oder Adverb voran und räumt etwas ein: „Tempting as it is“ heißt „so verlockend es ist“. Danach folgt der Gegensatz.',
             'You front an adjective or adverb to concede a point: “Tempting as it is” means “although it is tempting”. The contrast follows.'),
            ['as it is', 'as it seems', 'though it seems', 'much as', 'hard as'],
            [('Tempting as it is, we should not cut the testing phase.', 'So verlockend es ist, wir sollten die Testphase nicht streichen.', 'meeting'),
             ('Much as I would like to help, I cannot approve this.', 'So gern ich helfen würde, ich kann das nicht genehmigen.', 'talk'),
             ('Surprising though it seems, the old tool is faster.', 'So überraschend es scheint, das alte Tool ist schneller.', 'mail')],
            ('Tempting as is it, we should wait.', 'Tempting as it is, we should wait.',
             'Nach as steht die normale Stellung (it is), nicht die Frageform. Man verwechselt es mit der Umstellung nach Never.',
             'After as the normal order (it is) follows, not the question order. It is mixed up with the inversion after Never.'),
            ('lk.although', 'Tempting as it is, we should wait.', 'Although it is tempting, we should wait.',
             'Gleiche Bedeutung. Die Voranstellung klingt rhetorischer und kürzer.', 'Same meaning. The fronted version sounds more rhetorical and shorter.'),
            [('Much as I like the plan, I cannot support it.', 'Unterstütze ich den Plan?', 'Do I support the plan?', False)],
            ('Welches Adjektiv oder Adverb gehört vor as, und bleibt danach die normale Stellung?', 'Which adjective or adverb goes before as, and does the normal order follow?')),
    pattern('ep.so-such', ('So … that, Such … that · Folge betonen', 'So … that, Such … that · stressing the result'),
            ('So + Adjektiv + Verb + Subjekt + that … / Such + Verb + Subjekt + that …', 'So + adjective + verb + subject + that … / Such + verb + subject + that …'),
            ('Mit vorangestelltem So oder Such betont man, wie stark etwas war, und nennt die Folge im that-Satz. Danach steht das Verb vor dem Subjekt.',
             'With So or Such at the start you stress how strong something was and name the result in the that-clause. The verb then comes before the subject.'),
            ['such was', 'so great was', 'so fast was', 'so strong was'],
            [('So fast was the rollout that nobody noticed the change.', 'Der Rollout lief so schnell, dass niemand die Änderung bemerkte.', 'talk'),
             ('Such was the demand that we ran out of stock.', 'Die Nachfrage war so groß, dass wir ausverkauft waren.', 'meeting'),
             ('So great was the interest that we added a second session.', 'Das Interesse war so groß, dass wir eine zweite Sitzung ansetzten.', 'mail')],
            ('So fast the rollout was that nobody noticed the change.', 'So fast was the rollout that nobody noticed the change.',
             'Im Deutschen heißt es „so schnell war der Rollout“, also Verb vor Subjekt. Im Englischen bleibt man leicht bei der normalen Stellung und vergisst die Umstellung.',
             'In German the verb comes before the subject (“so schnell war der Rollout”). In English it is easy to keep the normal order and forget the inversion.'),
            ('inv.negative', 'So strong was the signal that we checked twice.', 'The signal was so strong that we checked twice.',
             'Gleiche Aussage. Vorn mit Umstellung klingt es betonter und förmlicher.', 'Same statement. At the front with inversion it sounds more stressed and more formal.'),
            [('Such was the demand that we ran out of stock.', 'Waren wir ausverkauft?', 'Did we run out of stock?', True)],
            ('Welches Wort steht vorn (So oder Such), und steht das Verb vor dem Subjekt?', 'Which word comes first (So or Such), and does the verb stand before the subject?')),
    pattern('ep.object-front', ('Objekt voranstellen · This we must avoid', 'Fronting the object · This we must avoid'),
            ('Objekt + Subjekt + Verb (normale Reihenfolge)', 'Object + subject + verb (normal order)'),
            ('Das Objekt steht vorn, um es hervorzuheben oder an den vorigen Satz anzuschließen. Subjekt und Verb behalten ihre normale Reihenfolge.',
             'The object comes first to stress it or to link to the previous sentence. Subject and verb keep their normal order.'),
            ['this we', 'that i', 'some risks', 'one thing we'],
            [('This we must avoid at all costs.', 'Das müssen wir um jeden Preis vermeiden.', 'meeting'),
             ('Some risks you can plan for; others you cannot.', 'Auf manche Risiken kann man sich vorbereiten, auf andere nicht.', 'talk'),
             ('That proposal I cannot accept.', 'Diesen Vorschlag kann ich nicht akzeptieren.', 'mail')],
            ('This must we avoid at all costs.', 'This we must avoid at all costs.',
             'Im Deutschen steht nach dem vorgezogenen Objekt das Verb: „Das müssen wir vermeiden“. Im Englischen bleibt die Reihenfolge Subjekt vor Verb.',
             'In German the verb follows the fronted object (“Das müssen wir vermeiden”). In English the order subject before verb stays.'),
            ('inv.negative', 'This we must avoid.', 'Never must we do this.',
             'Ein vorgezogenes Objekt ändert die Reihenfolge nicht. Nach Never kehrt sie sich um.', 'A fronted object does not change the order. After Never it flips.'),
            [('That proposal I cannot accept.', 'Akzeptiere ich den Vorschlag?', 'Do I accept the proposal?', False)],
            ('Was steht vorn, und bleiben Subjekt und Verb in der normalen Reihenfolge?', 'What comes first, and do subject and verb keep their normal order?')),
]

FILE = topic_file(T, ('Ich kann Wichtiges hervorheben: mit do, mit vorangestelltem Adjektiv (Tempting as it is), mit So … that, Such … that und mit vorgezogenem Objekt.',
                      'I can stress what matters: with do, with a fronted adjective (Tempting as it is), with So … that, Such … that and with a fronted object.'),
                  PAT, [['ep.do-emph', 'ep.concession'], ['ep.so-such', 'ep.object-front']],
                  (['Willst du bestätigen oder einen Zweifel ausräumen? Setze do, does oder did vor die Grundform.',
                    'Willst du etwas einräumen und dann widersprechen? Stelle das Adjektiv vor as und lasse die normale Stellung folgen.',
                    'Soll die Folge betont werden? Beginne mit So oder Such, dann steht das Verb vor dem Subjekt.'],
                   ['Do you want to confirm or remove a doubt? Put do, does or did before the base form.',
                    'Do you want to concede a point and then object? Put the adjective before as and keep the normal order.',
                    'Should the result be stressed? Start with So or Such, and the verb stands before the subject.']))

RULES = rules_from(PAT,
    ('Vier Wege zur Betonung: do vor der Grundform („I do think“), ein vorangestelltes Adjektiv mit as („Tempting as it is“), So/Such … that mit Umstellung und ein vorgezogenes Objekt („This we must avoid“).',
     'Four ways to stress: do before the base form (“I do think”), a fronted adjective with as (“Tempting as it is”), So/Such … that with inversion and a fronted object (“This we must avoid”).'),
    ('Englisch betont mit der Stimme und mit dem Satzbau: do wird beim Sprechen betont, die anderen Formen ändern die Wortstellung. Wann ja, wann nein: do und Tempting as it is sind im Alltag und in Mails üblich. So … that und Such was … sind gehoben. Das vorgezogene Objekt (This we must avoid) ist selten, lies es zu erkennen, setze es sparsam ein.',
     'English stresses with the voice and with sentence structure: do is stressed in speech, the other forms change the word order. When yes, when no: do and Tempting as it is are common in everyday speech and emails. So … that and Such was … are elevated. The fronted object (This we must avoid) is rare: learn to recognize it and use it sparingly.'),
    ('Nicht verwechseln: Nach as bleibt die normale Stellung („as it is“). Nach So/Such am Satzanfang kehrt sie sich um („So fast was …“). Nach do steht immer die Grundform.',
     'Do not mix up: after as the normal order stays (“as it is”). After So/Such at the start it flips (“So fast was …”). After do the base form always follows.'),
    (['Willst du bestätigen? Setze do/does/did vor die Grundform.', 'Willst du einräumen? Adjektiv + as + Subjekt + Verb.', 'Willst du die Folge betonen? So/Such vorn, Verb vor Subjekt, dann that.', 'Willst du ein Objekt hervorheben? Stelle es vor das Subjekt, ohne Umstellung.'],
     ['Do you want to confirm? Put do/does/did before the base form.', 'Do you want to concede? Adjective + as + subject + verb.', 'Do you want to stress the result? So/Such first, verb before subject, then that.', 'Do you want to stress an object? Put it before the subject, without inversion.']))

V = V2('ep')
V.kwt('ep.do-emph', 'He knows the product very well, believe me.', 'DOES', 'He ___ the product very well, believe me.', 'does know', (2, 2),
      ('Richtig: He does know the product very well. Nach does steht die Grundform know.', 'Right: He does know the product very well. After does the base form know follows.'),
      [{'if': ['does', 'knows'], 'de': 'Nach does steht die Grundform: know, nicht knows.', 'en': 'After does the base form follows: know, not knows.'}])
V.kwt('ep.do-emph', 'We sent the invoice last week, I promise.', 'DID', 'We ___ the invoice last week, I promise.', 'did send', (2, 2),
      ('Richtig: We did send the invoice. Nach did steht die Grundform send.', 'Right: We did send the invoice. After did the base form send follows.'),
      [{'if': ['did', 'sent'], 'de': 'Nach did steht die Grundform: send, nicht sent.', 'en': 'After did the base form follows: send, not sent.'}])
V.kwt('ep.concession', 'Although I would like to help, I cannot approve this.', 'MUCH', '___ I would like to help, I cannot approve this.', 'Much as', (2, 2),
      ('Richtig: Much as I would like to help, … Das Wort Much steht mit as am Anfang.', 'Right: Much as I would like to help, … Much as I would like to.'),
      [{'if': ['much'], 'not': ['as'], 'de': 'Zu Much gehört as: Much as I would like to help.', 'en': 'Much goes with as: Much as I would like to help.'}])
V.kwt('ep.concession', 'Even though it seems surprising, the old tool is faster.', 'SURPRISING', '___ it seems, the old tool is faster.', 'Surprising though', (2, 2),
      ('Richtig: Surprising though it seems, … Das Adjektiv steht vor though.', 'Right: Surprising though it seems, … The adjective stands before though.'),
      [{'if': ['surprising'], 'not': ['though'], 'de': 'Nach dem Adjektiv braucht es though (oder as): Surprising though it seems.', 'en': 'After the adjective you need though (or as): Surprising though it seems.'}])
V.kwt('ep.so-such', 'The demand was so strong that we ran out of stock.', 'SUCH', '___ the demand that we ran out of stock.', 'Such was', (2, 2),
      ('Richtig: Such was the demand that … Nach Such steht das Verb vor dem Subjekt.', 'Right: Such was the demand that … After Such the verb stands before the subject.'),
      [{'if': ['such'], 'not': ['was'], 'de': 'Nach Such am Satzanfang folgt was: Such was the demand.', 'en': 'After Such at the start was follows: Such was the demand.'}])
V.kwt('ep.so-such', 'The delay was so serious that the client cancelled the order.', 'SO', '___ was the delay that the client cancelled the order.', 'So serious', (2, 2),
      ('Richtig: So serious was the delay that … Das Adjektiv steht direkt hinter So.', 'Right: So serious was the delay that … The adjective follows So directly.'),
      [{'if': ['so'], 'not': ['serious'], 'de': 'Hinter So braucht es ein Adjektiv: So serious was …', 'en': 'After So you need an adjective: So serious was …'}])
V.kwt('ep.object-front', 'I cannot accept that proposal.', 'THAT', '___ I cannot accept.', 'That proposal', (2, 2),
      ('Richtig: That proposal I cannot accept. Das Objekt steht vorn.', 'Right: That proposal I cannot accept. The object comes first.'),
      [{'if': ['that'], 'not': ['proposal'], 'de': 'Das vorgezogene Objekt ist that proposal, nicht nur that.', 'en': 'The fronted object is that proposal, not only that.'}])
V.kwt('ep.object-front', 'We cannot agree to this condition.', 'CONDITION', '___ we cannot agree to.', 'This condition', (2, 2),
      ('Richtig: This condition we cannot agree to. Das Objekt steht vorn, die Reihenfolge danach bleibt normal.', 'Right: This condition we cannot agree to. The object comes first, the order after it stays normal.'), [])
V.find('ep.do-emph', 'She does knows the market better than anyone.', (2, 2), 'know', 'She does know the market better than anyone.',
       ('Der Fehler: nach does steht die Grundform know, nicht knows.', 'The error: after does comes the base form know, not knows.'),
       ('Nach does steht die Grundform.', 'After does the base form follows.'))
V.find('ep.do-emph', 'We did warn them about the risk in March.', None, None, None,
       ('Richtig: Nach did steht die Grundform warn. So betont man, dass die Warnung erfolgte.', 'Right: after did the base form warn follows. This stresses that the warning happened.'),
       ('We did warn them ist richtig gebildet.', 'We did warn them is correctly formed.'))
V.find('ep.concession', 'Tempting as is it, we should wait for the results.', (2, 3), 'it is,', 'Tempting as it is, we should wait for the results.',
       ('Der Fehler: nach as steht die normale Stellung it is. Richtig: Tempting as it is, …', 'The error: after as the normal order it is follows. Correct: Tempting as it is, …'),
       ('Nach as bleibt die normale Stellung.', 'After as the normal order stays.'))
V.find('ep.concession', 'Hard as we tried, the migration not finished in time.', (6, 6), 'was not', 'Hard as we tried, the migration was not finished in time.',
       ('Der Fehler: im Hauptsatz fehlt das Hilfsverb was. Richtig: the migration was not finished.', 'The error: the main clause lacks the auxiliary was. Correct: the migration was not finished.'),
       ('Der Hauptsatz nach der Voranstellung ist ein ganz normaler Satz.', 'The main clause after the fronting is a perfectly normal sentence.'))
V.find('ep.so-such', 'So strong the signal was that the team checked the antenna.', (2, 4), 'was the signal', 'So strong was the signal that the team checked the antenna.',
       ('Der Fehler: nach So strong kommt das Verb vor das Subjekt. Richtig: So strong was the signal that …', 'The error: after So strong the verb comes before the subject. Correct: So strong was the signal that …'),
       ('Nach So + Adjektiv am Anfang steht das Verb vor dem Subjekt.', 'After So + adjective at the start the verb stands before the subject.'))
V.find('ep.so-such', 'So great was the interest that we added a second session.', None, None, None,
       ('Richtig: So great was the interest that … Verb vor Subjekt, dann der that-Satz.', 'Right: So great was the interest that … verb before subject, then the that-clause.'),
       ('So great was the interest that … ist richtig gebildet.', 'So great was the interest that … is correctly formed.'))
V.find('ep.object-front', 'That proposal cannot I accept under any terms.', (2, 3), 'I cannot', 'That proposal I cannot accept under any terms.',
       ('Der Fehler: nach dem vorgezogenen Objekt bleibt die normale Reihenfolge: I cannot accept.', 'The error: after the fronted object the normal order stays: I cannot accept.'),
       ('Nach dem vorgezogenen Objekt steht das Subjekt vor dem Verb.', 'After the fronted object the subject comes before the verb.'))
V.find('ep.object-front', 'This risk we must avoiding at all costs.', (4, 4), 'avoid', 'This risk we must avoid at all costs.',
       ('Der Fehler: nach must steht die Grundform avoid.', 'The error: after must the base form avoid follows.'),
       ('Nach must steht die Grundform.', 'After must the base form follows.'))
V.meaning('ep.do-emph', 'I do like the design.', 'I like the design.',
          ('Welcher Satz betont, dass ich das Design wirklich mag?', 'Which sentence stresses that I really like the design?'), 'a',
          ('Richtig: Satz a. Das betonte do hebt die Aussage hervor.', 'Right: sentence a. The stressed do emphasizes the statement.'),
          [('b', 'In b steht dasselbe ohne Betonung. Es ist neutral.', 'Sentence b says the same without stress. It is neutral.'), ('both', 'Nicht gleich stark: Nur a ist betont.', 'Not equally strong: only a is stressed.')])
V.meaning('ep.concession', 'Much as I like the plan, I cannot support it.', 'I like the plan, so I support it.',
          ('Welcher Satz sagt, dass ich den Plan nicht unterstütze?', 'Which sentence says that I do not support the plan?'), 'a',
          ('Richtig: Satz a. Much as räumt etwas ein und setzt dann den Gegensatz.', 'Right: sentence a. Much as concedes a point and then sets the contrast.'),
          [('b', 'In b unterstütze ich den Plan. Das ist das Gegenteil.', 'In b I support the plan. That is the opposite.'), ('both', 'Die beiden Sätze sagen Gegensätzliches.', 'The two sentences say opposite things.')])
V.meaning('ep.so-such', 'Such was the demand that we ran out of stock.', 'The demand was low, so we kept the stock.',
          ('Welcher Satz sagt, dass die Nachfrage sehr groß war?', 'Which sentence says that the demand was very high?'), 'a',
          ('Richtig: Satz a. Such was the demand that … zeigt eine sehr große Nachfrage mit Folge.', 'Right: sentence a. Such was the demand that … shows very high demand with a result.'),
          [('b', 'In b war die Nachfrage niedrig. Das ist das Gegenteil.', 'In b the demand was low. That is the opposite.'), ('both', 'Die beiden Sätze sagen Gegensätzliches.', 'The two sentences say opposite things.')])
V.meaning('ep.object-front', 'That proposal I cannot accept.', 'I cannot accept that proposal.',
          ('Bedeuten beide Sätze dasselbe?', 'Do both sentences mean the same?'), 'both',
          ('Richtig: beide. Das vorgezogene Objekt ändert die Bedeutung nicht, nur die Betonung.', 'Right: both. The fronted object does not change the meaning, only the emphasis.'),
          [('a', 'Nicht nur a: b sagt inhaltlich dasselbe.', 'Not only a: b says the same in content.'), ('b', 'Nicht nur b: a sagt inhaltlich dasselbe.', 'Not only b: a says the same in content.')])

ORDER = [
    order_item('ep.do-emph', 'We did send the invoice last week.', 'Wir haben die Rechnung letzte Woche wirklich geschickt.',
               ['we', 'did', 'send', 'the invoice', 'last week'],
               ('Das betonte did steht vor der Grundform send. Nach did wird das Verb nicht mehr gebeugt.', 'The stressed did stands before the base form send. After did the verb is no longer inflected.'),
               'We did sent the invoice last week.', ('send', 'sent', 'Nach did steht die Grundform, auch in der Vergangenheit.', 'After did the base form follows, even in the past.'),
               single='Das Subjekt we kommt zuerst, dann did, die Grundform send und danach the invoice und last week.'),
    order_item('ep.do-emph', 'I do understand your concern, but the deadline stays.', 'Ich verstehe Ihre Sorge durchaus, aber die Frist bleibt.',
               ['I', 'do', 'understand', 'your concern', 'but', 'the deadline', 'stays'],
               ('Zu I gehört do vor der Grundform understand. Das betont das Verstehen vor dem Gegensatz mit but.', 'With I the form is do before the base form understand. This stresses understanding before the contrast with but.'),
               'I understand do your concern, but the deadline stays.', ('do', 'does', 'Zu I und we gehört do, zu he und she gehört does.', 'With I and we use do, with he and she use does.'),
               single='I do understand your concern ist der erste Teil; but the deadline stays kommt danach.'),
    order_item('ep.concession', 'Tempting as it is, we should not cut the testing phase.', 'So verlockend es ist, sollten wir die Testphase nicht streichen.',
               ['tempting', 'as', 'it is', 'we', 'should not', 'cut', 'the testing phase'],
               ('Das Adjektiv steht vor as, danach folgt die normale Stellung it is. Der Hauptsatz beginnt nach dem Komma.', 'The adjective comes before as, and the normal order it is follows. The main clause begins after the comma.'),
               'Tempting as is it, we should not cut the testing phase.', ('it is', 'is it', 'Nach as bleibt die normale Stellung it is.', 'After as the normal order it is stays.'),
               single='Tempting as it is bildet den ersten Teil; we should not cut the testing phase ist der Hauptsatz.'),
    order_item('ep.concession', 'Much as I would like to help, I cannot approve this.', 'So gern ich helfen würde, ich kann das nicht genehmigen.',
               ['much as', 'I', 'would like', 'to help', 'I', 'cannot approve', 'this'],
               ('Much as leitet den Einwand ein und braucht normale Satzstellung. Danach folgt der Hauptsatz.', 'Much as introduces the concession and takes normal word order. The main clause follows.'),
               'Much I would like to help as, I cannot approve this.', ('much as', 'much', 'Much gehört mit as zusammen, sie bilden einen Baustein.', 'Much belongs with as, they form one block.'),
               single='Much as I would like to help bildet den ersten Teil, danach folgt I cannot approve this.'),
    order_item('ep.so-such', 'So fast was the rollout that nobody noticed the change.', 'Der Rollout lief so schnell, dass niemand die Änderung bemerkte.',
               ['so fast', 'was', 'the rollout', 'that', 'nobody', 'noticed', 'the change'],
               ('So fast steht vorn, danach das Verb was vor dem Subjekt the rollout. Der that-Satz nennt die Folge.', 'So fast comes first, then the verb was before the subject the rollout. The that-clause names the result.'),
               'So fast the rollout was that nobody noticed the change.', ('was', 'the rollout was', 'Nach So + Adjektiv am Anfang steht das Verb vor dem Subjekt.', 'After So + adjective at the start the verb stands before the subject.'),
               single='So fast was the rollout bildet den ersten Teil; that nobody noticed the change nennt die Folge.'),
    order_item('ep.so-such', 'Such was the demand that we ran out of stock.', 'Die Nachfrage war so groß, dass wir ausverkauft waren.',
               ['such', 'was', 'the demand', 'that', 'we', 'ran out', 'of stock'],
               ('Such steht vorn, danach das Verb was vor dem Subjekt the demand. Der that-Satz nennt die Folge.', 'Such comes first, then the verb was before the subject the demand. The that-clause names the result.'),
               'Such the demand was that we ran out of stock.', ('was', 'the demand was', 'Nach Such am Anfang steht das Verb vor dem Subjekt.', 'After Such at the start the verb stands before the subject.'),
               single='Such was the demand bildet den ersten Teil; that we ran out of stock ist die Folge.'),
    order_item('ep.object-front', 'That proposal I cannot accept under any terms.', 'Diesen Vorschlag kann ich unter keinen Umständen akzeptieren.',
               ['that proposal', 'I', 'cannot accept', 'under', 'any terms'],
               ('Das Objekt that proposal steht vorn. Danach bleibt die normale Reihenfolge: Subjekt I, dann Verb cannot accept.', 'The object that proposal comes first. The normal order then stays: subject I, then verb cannot accept.'),
               'That proposal cannot I accept under any terms.', ('I', 'cannot I', 'Nach dem vorgezogenen Objekt steht das Subjekt vor dem Verb.', 'After the fronted object the subject comes before the verb.'),
               single='That proposal steht vorn, danach I cannot accept, am Ende under any terms.'),
    order_item('ep.object-front', 'This risk we must avoid at all costs.', 'Dieses Risiko müssen wir um jeden Preis vermeiden.',
               ['this risk', 'we', 'must', 'avoid', 'at all costs'],
               ('Das Objekt this risk steht vorn, danach wie gewohnt Subjekt we, Modalverb must und Grundform avoid.', 'The object this risk comes first, then as usual the subject we, the modal must and the base form avoid.'),
               'This risk must we avoid at all costs.', ('we', 'must we', 'Nach dem vorgezogenen Objekt bleibt die Reihenfolge we must.', 'After the fronted object the order we must stays.'),
               single='This risk steht vorn, danach we must avoid, am Ende at all costs.'),
]

MAP = {
    'We did sent the invoice last week.': {'pat': 'ep.do-emph', 'why': {
        'ok': B('Nach did steht die Grundform: We did send the invoice.', 'After did the base form follows: We did send the invoice.'),
        'wrong': [{'if': ['sent'], 'de': 'Nach did steht send, nicht sent.', 'en': 'After did use send, not sent.'},
                  {'if': ['sends'], 'de': 'Nach did steht send, nicht sends.', 'en': 'After did use send, not sends.'}]}},
    'Tempting as is it, we should wait.': {'pat': 'ep.concession', 'why': {
        'ok': B('Nach as bleibt die normale Stellung: Tempting as it is.', 'After as the normal order stays: Tempting as it is.'),
        'wrong': [{'if': ['is', 'it'], 'not': ['as'], 'de': 'Das Adjektiv Tempting steht vor as.', 'en': 'The adjective Tempting stands before as.'},
                  {'not': ['it'], 'de': 'Es heißt as it is, mit dem Subjekt it.', 'en': 'It is as it is, with the subject it.'}]}},
    'So fast the rollout was that nobody noticed the change.': {'pat': 'ep.so-such', 'why': {
        'ok': B('Nach So fast steht das Verb vor dem Subjekt: So fast was the rollout.', 'After So fast the verb stands before the subject: So fast was the rollout.'),
        'wrong': [{'if': ['rollout', 'was'], 'not': ['fast'], 'de': 'Das Adjektiv fast gehört direkt hinter So.', 'en': 'The adjective fast belongs right after So.'},
                  {'not': ['was'], 'de': 'Zwischen So fast und the rollout muss was stehen.', 'en': 'Between So fast and the rollout you need was.'}]}},
    'This must we avoid at all costs.': {'pat': 'ep.object-front', 'why': {
        'ok': B('Nach dem vorgezogenen Objekt bleibt die Reihenfolge: This we must avoid.', 'After the fronted object the order stays: This we must avoid.'),
        'wrong': [{'if': ['must', 'we'], 'de': 'Subjekt vor Verb: we must, nicht must we.', 'en': 'Subject before verb: we must, not must we.'},
                  {'not': ['we'], 'de': 'Das Subjekt we fehlt vor must.', 'en': 'The subject we is missing before must.'}]}},
}

def c1x():
    mcc(T, 'ep.do-emph', 'C1', 'biz', -0.1, "You say nobody warned you, but we ___ warn you in last month's email.",
        'did', ['do', 'does', 'were'],
        ('Das betonte did steht vor der Grundform: we did warn you. Es widerspricht dem Vorwurf.', 'The stressed did stands before the base form: we did warn you. It rebuts the accusation.'),
        [(G, 'Do ist Präsens. „Last month’s email“ liegt in der Vergangenheit.', 'Do is present. “Last month’s email” is in the past.'),
         (G, 'Does gehört zu he, she, it, nicht zu we, und es ist Präsens.', 'Does goes with he, she, it, not with we, and it is present.'),
         (G, 'Were we warn ist keine gültige Form.', 'Were we warn is not a valid form.')])
    mcc(T, 'ep.do-emph', 'C1', 'biz', 0.0, "Don't underestimate her: she really ___ know the tax rules better than any of us do.",
        'does', ['do', 'did', 'is'],
        ('Zu she gehört does, danach die Grundform know. Das betont, dass es wirklich stimmt.', 'With she the form is does, followed by the base form know. This stresses that it is really true.'),
        [(G, 'Do gehört zu I, you, we, they, nicht zu she.', 'Do goes with I, you, we, they, not with she.'),
         (G, 'Did ist Vergangenheit. Der Satz endet mit dem Präsens do.', 'Did is past. The sentence ends with the present do.'),
         (G, 'Is know ist keine gültige Form.', 'Is know is not a valid form.')])
    mcc(T, 'ep.concession', 'C1', 'biz', 0.0, '___ as it sounds, the old tool is still faster than the new one.',
        'Odd', ['Oddly', 'Odder', 'Odd that'],
        ('Das Adjektiv steht vor as: Odd as it sounds. Im amerikanischen Englisch ist As odd as it sounds üblicher.', 'The adjective stands before as: Odd as it sounds. In American English As odd as it sounds is more common.'),
        [(G, 'Ein Adverb passt nicht vor as + it sounds. Es braucht das Adjektiv.', 'An adverb does not fit before as + it sounds. It needs the adjective.'),
         (G, 'Odder ist ein Komparativ und passt nicht zu dieser Wendung.', 'Odder is a comparative and does not fit this phrase.'),
         (G, 'Odd that gehört zu einem anderen Muster. Hier folgt as it sounds.', 'Odd that belongs to a different pattern. Here as it sounds follows.')])
    mcc(T, 'ep.concession', 'C1', 'biz', 0.0, '___ I respect your opinion, I cannot agree with this decision.',
        'Much as', ['As much', 'Much that', 'Much how'],
        ('Much as I respect … heißt „so sehr ich … respektiere“. Im amerikanischen Englisch ist As much as I respect üblicher.', 'Much as I respect … means “although I respect it very much”. In American English As much as I respect is more common.'),
        [(G, 'As much steht in einem anderen Muster (as much as), nicht am Satzanfang.', 'As much belongs to another pattern (as much as), not to the sentence start.'),
         (G, 'Much that ist keine gültige Verbindung.', 'Much that is not a valid combination.'),
         (G, 'Much how ist keine gültige Verbindung.', 'Much how is not a valid combination.')])
    mcc(T, 'ep.so-such', 'C1', 'biz', 0.0, '___ was the response that the website crashed within minutes.',
        'Such', ['So', 'Such a', 'Very'],
        ('Such was the response that … nennt die Folge: Such steht vor was, danach der that-Satz.', 'Such was the response that … names the result: Such stands before was, then the that-clause.'),
        [(G, 'So braucht ein Adjektiv direkt dahinter (So great was …).', 'So needs an adjective right after it (So great was …).'),
         (G, 'Such a braucht ein Nomen direkt dahinter, nicht was.', 'Such a needs a noun right after it, not was.'),
         (G, 'Very kann nicht so am Satzanfang stehen.', 'Very cannot start the sentence like this.')])
    mcc(T, 'ep.object-front', 'C1', 'biz', 0.0, 'This risk ___ at all costs, whatever the client says.',
        'we must avoid', ['must we avoid', 'avoid we must', 'we avoid must'],
        ('Das Objekt steht vorn, danach bleibt die normale Reihenfolge: we must avoid.', 'The object comes first, and the normal order stays: we must avoid.'),
        [(G, 'Hier kehrt sich nichts um. Nach einem vorgezogenen Objekt bleibt das Subjekt vor dem Verb.', 'Nothing flips here. After a fronted object the subject stays before the verb.'),
         (G, 'Das Verb avoid gehört nach must, nicht vor das Subjekt.', 'The verb avoid belongs after must, not before the subject.'),
         (G, 'must gehört vor die Grundform avoid.', 'must belongs before the base form avoid.')])

    ocl(T, 'ep.do-emph', 'C1', 'biz', 0.0, 'She said we never answered, but we ___ reply to her email on Tuesday.',
        ['did'], 'aux', ['do', 'does', 'had'],
        ('Das betonte did widerspricht dem Vorwurf: we did reply (Grundform reply).', 'The stressed did rebuts the accusation: we did reply (base form reply).'))
    ocl(T, 'ep.do-emph', 'C1', 'biz', 0.0, 'You say he does not speak French, but he really ___ speak it fluently.',
        ['does', 'can'], 'aux', ['do', 'did', 'is'],
        ('Zu he gehört does vor der Grundform speak. Das widerspricht dem Einwand und betont, dass es wirklich stimmt.', 'With he the form is does before the base form speak. It rebuts the objection and stresses that it is really true.'))
    ocl(T, 'ep.concession', 'C1', 'biz', 0.0, 'Much ___ I would like to attend, I have another meeting at that time.',
        ['as', 'though'], 'conj', ['that', 'so', 'if'],
        ('Much as I would like to … räumt etwas ein: „so gern ich möchte“.', 'Much as I would like to … concedes a point: “as much as I would like to”.'))
    ocl(T, 'ep.concession', 'C1', 'biz', 0.0, 'Hard ___ we tried, the migration was not finished before the deadline.',
        ['as', 'though'], 'conj', ['that', 'so', 'if'],
        ('Hard as we tried … räumt etwas ein: „so sehr wir uns bemühten“. Danach folgt ein normaler Hauptsatz.', 'Hard as we tried … concedes a point: “however hard we tried”. A normal main clause follows.'))
    ocl(T, 'ep.so-such', 'C1', 'biz', 0.0, 'So strong was the wind ___ the organizers canceled the outdoor concert.',
        ['that'], 'conj', ['which', 'what', 'as'],
        ('So … was … that nennt die Folge: that leitet sie ein.', 'So … was … that names the result: that introduces it.'))
    ocl(T, 'ep.so-such', 'C1', 'biz', 0.0, 'It was ___ a good offer that we accepted it at once.',
        ['such'], 'det', ['so', 'very', 'too'],
        ('Vor a + Adjektiv + Nomen steht such: such a good offer. So braucht kein a danach.', 'Before a + adjective + noun you use such: such a good offer. So takes no a after it.'))

    err(T, 'ep.do-emph', 'C1', 'biz', 0.0, 'He does sends the weekly report on time, so please stop worrying.',
        ('sends', ['send'], ['send', 'sent', 'sending']),
        ('Nach does steht die Grundform: does send.', 'After does the base form follows: does send.'))
    err(T, 'ep.concession', 'C1', 'biz', 0.0, 'Hard we tried, we could not reach the client by phone.',
        ('Hard we tried', ['Hard as we tried', 'Hard though we tried', 'However hard we tried'], ['Hard as we tried', 'Hard that we tried', 'Hard so we tried']),
        ('Bei der Voranstellung fehlt as: Hard as we tried, … Ohne as ist der Einwand nicht ausgedrückt.', 'The as is missing in the fronting: Hard as we tried, … Without as the concession is not expressed.'))
    err(T, 'ep.so-such', 'C1', 'biz', 0.0, 'Such was the demand what the shop ran out of stock within an hour.',
        ('what', ['that'], ['that', 'which', 'as']),
        ('Der that-Satz nennt die Folge: Such was the demand that …', 'The that-clause names the result: Such was the demand that …'))
    err(T, 'ep.object-front', 'C1', 'biz', 0.0, 'This decision must we reverse before the end of the quarter.',
        ('must we reverse', ['we must reverse'], ['we must reverse', 'must reverse we', 'we reverse must']),
        ('Nach einem vorgezogenen Objekt bleibt die normale Reihenfolge: we must reverse.', 'After a fronted object the normal order stays: we must reverse.'))
    err(T, 'ep.concession', 'C1', 'biz', 0.0, 'Tempting as it is, we should not skip the final review.', None,
        ('Kein Fehler: Nach as bleibt die normale Stellung (it is).', 'No mistake: after as the normal order (it is) stays.'))
    err(T, 'ep.so-such', 'C1', 'biz', 0.0, 'So great was the interest that we added a second session on Friday.', None,
        ('Kein Fehler: Nach So great steht das Verb was vor dem Subjekt.', 'No mistake: after So great the verb was stands before the subject.'))

    kwt(T, 'ep.do-emph', 'C1', 'biz', 0.0, 'She truly knows the market better than anyone.', 'DOES', 'She', 'the market better than anyone.',
        [(['truly'], ['does know']), (['does truly'], ['know'])], ['truly', 'know'], ['do', 'knows', 'did'], ['truly does knows'],
        ('Das betonte does steht vor der Grundform know.', 'The stressed does stands before the base form know.'),
        [W(['does', 'knows'], 'Nach does steht die Grundform know.', 'After does the base form know follows.')])
    kwt(T, 'ep.do-emph', 'C1', 'biz', 0.0, 'We definitely sent the invoice on the first of March.', 'DID', 'We', 'the invoice on the first of March.',
        [(['definitely'], ['did send']), (['did definitely'], ['send'])], ['definitely', 'send'], ['sent', 'do', 'had'], ['definitely did sent'],
        ('Das betonte did steht vor der Grundform send.', 'The stressed did stands before the base form send.'),
        [W(['did', 'sent'], 'Nach did steht die Grundform send.', 'After did the base form send follows.')])
    kwt(T, 'ep.concession', 'C1', 'biz', 0.0, 'Although I would like to help, I cannot approve this request.', 'MUCH', '', 'would like to help, I cannot approve this request.',
        [(['Much as', 'As much as'], ['I'])], ['as', 'I'], ['that', 'so', 'of'], [],
        ('Much as I would like to help … räumt etwas ein.', 'Much as I would like to help … concedes a point.'), [])
    kwt(T, 'ep.concession', 'C1', 'biz', 0.0, 'Even though it sounds unexpected, the old tool is faster.', 'SURPRISING', '', 'sounds, the old tool is faster.',
        [(['Surprising as', 'As surprising as'], ['it'])], ['as', 'it'], ['is', 'that', 'so'], [],
        ('Surprising as it sounds, … Das Adjektiv steht vor as, dann die normale Stellung.', 'Surprising as it sounds, … The adjective stands before as, then the normal order.'), [])
    kwt(T, 'ep.so-such', 'C1', 'biz', 0.0, 'The demand was so high that we ran out of stock.', 'SUCH', '', 'that we ran out of stock.',
        [(['Such was'], ['the demand'])], ['was', 'the', 'demand'], ['so', 'a', 'very'], [],
        ('Such was the demand that … Das Verb steht vor dem Subjekt.', 'Such was the demand that … The verb stands before the subject.'), [])
    kwt(T, 'ep.do-emph', 'C1', 'biz', 0.0, 'They claim we never paid, but we settled the invoice in full.', 'DID', 'They claim we never paid, but we', 'the invoice in full.',
        [(['really did'], ['pay']), (['did actually', 'did really', 'did indeed', 'did in fact'], ['pay'])], ['really', 'pay'], ['paid', 'do', 'had'], ['really did paid'],
        ('Das betonte did widerspricht dem Vorwurf und steht vor der Grundform pay.', 'The stressed did rebuts the accusation and stands before the base form pay.'),
        [W(['did', 'paid'], 'Nach did steht die Grundform pay.', 'After did the base form pay follows.')])

def place():
    mcc(T, 'ep.so-such', 'C1', 'biz', 0.0, 'So complex ___ the contract that even the lawyers needed two weeks to read it.',
        'was', ['is', 'had', 'did'],
        ('Nach So complex steht das Verb vor dem Subjekt: So complex was the contract that …', 'After So complex the verb stands before the subject: So complex was the contract that …'),
        [(G, 'Is passt nicht zu needed in der Vergangenheit.', 'Is does not fit needed in the past.'),
         (G, 'Had ist hier kein Vollverb. Es fehlt die 3. Form.', 'Had is not a main verb here. The participle is missing.'),
         (G, 'Did braucht eine Grundform danach, hier fehlt sie.', 'Did needs a base form after it, which is missing here.')])
    err(T, 'ep.concession', 'C1', 'biz', 0.0, 'Surprising as is it, the cheaper tool is also the more reliable one.',
        ('is it', ['it is'], ['it is', 'is it', 'it has']),
        ('Nach as bleibt die normale Stellung: Surprising as it is.', 'After as the normal order stays: Surprising as it is.'))
