from cm import *
import lib
from lib import mcc, ocl, err, kwt, W

G = 'grammar'; M = 'meaning'; C = 'calque'; P = 'partner'; R = 'register'
T = 'stative-adv'

TOPIC = {
    'id': T, 'group': 'Grammatik-Pfad', 'level': 'C1', 'p0': 0.45,
    'name': 'Verlaufsform mit Zustandsverben', 'name_en': 'Continuous with stative verbs',
    'rule': 'Die Verlaufsform zeigt Wandel, Höflichkeit und Verhalten: „We are seeing growth“, „I was hoping you could help“, „You are being difficult“. Reine Zustände wie know, need oder belong stehen dagegen in der einfachen Form.',
    'rule_en': 'The continuous shows change, politeness and behavior: “We are seeing growth”, “I was hoping you could help”, “You are being difficult”. Pure states like know, need or belong stay in the simple form.',
    'ex': ['We are seeing a clear rise in demand.', 'I was hoping you could review the draft.'],
}

PAT = [
    pattern('sa.trend', ('are seeing, are getting · Entwicklung', 'are seeing, are getting · change'),
            ('be + -ing mit seeing, finding, getting, becoming, growing', 'be + -ing with seeing, finding, getting, becoming, growing'),
            ('Mit der Verlaufsform beschreibst du eine Entwicklung, die gerade läuft. Auch see und find stehen so, wenn sie „erleben“ heißen: „We are seeing growth.“',
             'The continuous describes a change that is under way. See and find also take it when they mean “experience”: “We are seeing growth.”'),
            ['are seeing', 'are finding', 'is getting', 'is becoming', 'is growing', 'increasingly'],
            [('We are seeing a clear rise in demand.', 'Wir erleben einen deutlichen Anstieg der Nachfrage.', 'meeting'),
             ('Customers are increasingly asking for shorter contracts.', 'Kunden fragen immer häufiger nach kürzeren Verträgen.', 'mail'),
             ('It is getting harder to find good staff.', 'Es wird immer schwerer, gute Leute zu finden.', 'talk')],
            ('Prices rise at the moment because of the new tax.', 'Prices are rising at the moment because of the new tax.',
             'Mit „at the moment“ oder „currently“ läuft der Vorgang gerade. Dafür braucht das Englische die Verlaufsform, die einfache Form passt nicht.',
             'With “at the moment” or “currently” the process is under way right now. English needs the continuous for that, the simple form does not fit.'),
            ('sa.no-ing', 'We are seeing growth.', 'We see the problem.',
             'See als „erleben“ geht in der Verlaufsform. See als „verstehen“ bleibt einfach.', 'See as “experience” takes the continuous. See as “understand” stays simple.'),
            [('Prices are rising at the moment.', 'Läuft die Veränderung gerade?', 'Is the change happening now?', True)],
            ('Läuft die Veränderung gerade? Dann nimm die Verlaufsform.', 'Is the change under way right now? Then use the continuous.')),
    pattern('sa.soft', ('was hoping, was wondering · höflich', 'was hoping, was wondering · polite'),
            ('I was hoping / wondering / thinking + (that / if) + you could …', 'I was hoping / wondering / thinking + (that / if) + you could …'),
            ('Die Verlaufsform macht eine Bitte weicher: „I was wondering if you could …“ klingt höflicher als „Can you …?“. Danach folgt ein Nebensatz in normaler Satzstellung.',
             'The continuous softens a request: “I was wondering if you could …” sounds more polite than “Can you …?”. A clause in normal word order follows.'),
            ['i was hoping', 'i am hoping', 'i was wondering', 'we were hoping', 'i was thinking'],
            [('I was hoping you could review the draft.', 'Ich hatte gehofft, Sie könnten den Entwurf prüfen.', 'mail'),
             ('I was wondering if we could move the call to Thursday.', 'Ich habe mich gefragt, ob wir den Anruf auf Donnerstag verschieben könnten.', 'mail'),
             ('We are hoping to hear from you by Friday.', 'Wir hoffen, bis Freitag von Ihnen zu hören.', 'meeting')],
            ('I was wondering could you send me the file.', 'I was wondering if you could send me the file.',
             'Nach wondering folgt ein Nebensatz mit if und normaler Satzstellung. Eine Frage mit vorgezogenem could passt hier nicht.',
             'After wondering a clause with if and normal word order follows. A question with could in front does not fit here.'),
            ('sa.no-ing', 'I am hoping you could help.', 'I hope you can help.',
             'Mit der Verlaufsform und could wird die Bitte weicher. Die einfache Form klingt direkter.', 'With the continuous and could the request gets softer. The simple form sounds more direct.'),
            [('I was wondering if you could help.', 'Klingt die Bitte weich und höflich?', 'Does the request sound soft and polite?', True)],
            ('Willst du eine Bitte weich machen? Dann nimm was hoping oder was wondering mit if you could.', 'Do you want to soften a request? Then use was hoping or was wondering with if you could.')),
    pattern('sa.being', ('is being, is always -ing · Verhalten', 'is being, is always -ing · behavior'),
            ('be being + Adjektiv für Verhalten · always + -ing für Ärger', 'be being + behavior adjective · always + -ing for annoyance'),
            ('Mit „is being“ beschreibst du Verhalten für begrenzte Zeit: „You are being difficult.“ Mit always + -ing zeigst du Ärger über eine Gewohnheit: „He is always complaining.“ Zustände wie tired oder ill nehmen kein being.',
             'With “is being” you describe behavior for a limited time: “You are being difficult.” With always + -ing you show annoyance at a habit: “He is always complaining.” States like tired or ill take no being.'),
            ['is being', 'are being', 'am being', 'is always', 'are always'],
            [('You are being unreasonable about the deadline.', 'Sie sind, was die Frist betrifft, gerade unvernünftig.', 'meeting'),
             ('He is always complaining about the coffee.', 'Er beschwert sich ständig über den Kaffee.', 'talk'),
             ('The client is being very helpful this week.', 'Der Kunde ist diese Woche sehr hilfsbereit.', 'mail')],
            ('She is being tired after the long flight.', 'She is tired after the long flight.',
             'Being steht nur bei Verhalten, das man steuern kann. Müdigkeit ist ein Zustand, deshalb heißt es einfach is tired.',
             'Being is used only for behavior you can control. Tiredness is a state, so it is simply is tired.'),
            ('sa.no-ing', 'He is being rude.', 'He is rude.',
             'Mit being ist es nur gerade so. Ohne being ist es sein Wesen.', 'With being it is only so right now. Without being it is his nature.'),
            [('He is being rude.', 'Ist er nur gerade unhöflich?', 'Is he rude only right now?', True)],
            ('Geht es um Verhalten für kurze Zeit? Dann passt is being. Geht es um Ärger über eine Gewohnheit? Dann passt always + -ing.', 'Is it behavior for a short time? Then is being fits. Is it annoyance at a habit? Then always + -ing fits.')),
    pattern('sa.no-ing', ('know, need, belong · keine Verlaufsform', 'know, need, belong · no continuous'),
            ('Zustandsverb in einfacher Form: know, believe, understand, need, want, belong, own', 'Stative verb in the simple form: know, believe, understand, need, want, belong, own'),
            ('Verben für Zustände, Meinungen und Besitz stehen meist in der einfachen Form: „I understand your concern.“ Bei think (nachdenken) und have (essen) geht die Verlaufsform: „I am thinking about it.“',
             'Verbs for states, opinions and possession usually stay in the simple form: “I understand your concern.” With think (consider) and have (eat) the continuous works: “I am thinking about it.”'),
            ['we need', 'i understand', 'i know', 'belongs to', 'we believe', 'it seems'],
            [('We need a decision by Friday.', 'Wir brauchen bis Freitag eine Entscheidung.', 'meeting'),
             ('The warehouse belongs to our parent company.', 'Das Lager gehört unserer Muttergesellschaft.', 'talk'),
             ('I understand your concern.', 'Ich verstehe Ihr Anliegen.', 'mail')],
            ('I am knowing the answer to your question.', 'I know the answer to your question.',
             'Know beschreibt einen Zustand. Zustände stehen in der einfachen Form, nicht mit be + -ing.',
             'Know describes a state. States stay in the simple form, not with be + -ing.'),
            ('sa.trend', 'We see the problem.', 'We are seeing growth.',
             'See als „verstehen“ bleibt einfach. See als „erleben“ geht mit -ing.', 'See as “understand” stays simple. See as “experience” takes -ing.'),
            [('We need a decision by Friday.', 'Ist need hier ein Zustand?', 'Is need a state here?', True)],
            ('Beschreibt das Verb einen Zustand, eine Meinung oder Besitz? Dann bleibt es einfach: know, need, belong.', 'Does the verb describe a state, an opinion or possession? Then it stays simple: know, need, belong.')),
]

FILE = topic_file(T, ('Ich kann die Verlaufsform gezielt nutzen: für Entwicklungen (are seeing), für höfliche Bitten (was hoping) und für Verhalten (is being). Bei Zuständen wie know oder need bleibe ich einfach.',
                      'I can use the continuous on purpose: for changes (are seeing), for polite requests (was hoping) and for behavior (is being). With states like know or need I stay simple.'),
                  PAT, [['sa.no-ing', 'sa.trend'], ['sa.soft', 'sa.being']],
                  (['Ist es ein Zustand, eine Meinung oder Besitz? Dann nimm die einfache Form: know, need, belong.',
                    'Läuft eine Entwicklung gerade? Dann nimm die Verlaufsform: are seeing, is getting.',
                    'Willst du freundlich fragen oder ein Verhalten beschreiben? Nimm was hoping, was wondering oder is being.'],
                   ['Is it a state, an opinion or possession? Use the simple form: know, need, belong.',
                    'Is a change under way? Use the continuous: are seeing, is getting.',
                    'Do you want to ask politely or describe behavior? Use was hoping, was wondering or is being.']))

RULES = rules_from(PAT,
    ('Die Verlaufsform zeigt, dass etwas läuft, vorläufig ist oder höflich klingen soll. Zustände (know, need, belong) bleiben in der einfachen Form.',
     'The continuous shows that something is under way, temporary, or meant to sound polite. States (know, need, belong) stay in the simple form.'),
    ('Im Beruf beschreibst du Trends („We are seeing …“) und bittest weich („I was wondering if …“). Wer die Grenze zu den Zustandsverben kennt, klingt sicher und nicht übertrieben.',
     'At work you describe trends (“We are seeing …”) and ask softly (“I was wondering if …”). If you know the border to stative verbs you sound sure and not overdone.'),
    ('Nicht verwechseln: Im Deutschen gibt es keine Verlaufsform. Aus „ich kenne“ wird nie „I am knowing“. Aus „er ist müde“ wird nie „he is being tired“.',
     'Do not mix up: German has no continuous. “Ich kenne” never becomes “I am knowing”. “Er ist müde” never becomes “he is being tired”.'),
    (['Zustand, Meinung oder Besitz? Einfache Form.', 'Läuft die Veränderung gerade? are seeing, is getting.', 'Weiche Bitte? was hoping, was wondering + if you could.', 'Verhalten für kurze Zeit? is being + Adjektiv.'],
     ['State, opinion or possession? Simple form.', 'Is a change under way? are seeing, is getting.', 'Soft request? was hoping, was wondering + if you could.', 'Behavior for a short time? is being + adjective.']))

V = V2('sa')
V.kwt('sa.trend', 'Prices are going up at the moment because of the new tax.', 'RISING', 'Prices ___ at the moment because of the new tax.', 'are rising', (2, 2),
      ('Richtig: Prices are rising at the moment. Mit at the moment braucht es die Verlaufsform.', 'Right: Prices are rising at the moment. With at the moment you need the continuous.'),
      [{'if': ['rising'], 'not': ['are'], 'de': 'Ohne are fehlt das Hilfsverb der Verlaufsform: are rising.', 'en': 'Without are the auxiliary of the continuous is missing: are rising.'}])
V.kwt('sa.trend', 'More and more customers ask for shorter contracts.', 'INCREASINGLY', 'Customers ___ asking for shorter contracts.', 'are increasingly', (2, 2),
      ('Richtig: Customers are increasingly asking. Das Adverb steht zwischen are und asking.', 'Right: Customers are increasingly asking. The adverb stands between are and asking.'),
      [{'if': ['increasingly'], 'not': ['are'], 'de': 'Vor increasingly braucht es are: are increasingly asking.', 'en': 'Before increasingly you need are: are increasingly asking.'}])
V.kwt('sa.soft', 'Could you send me the file by noon?', 'WONDERING', 'I was ___ you could send me the file by noon.', 'wondering if', (2, 2),
      ('Richtig: I was wondering if you could send me the file. Nach wondering folgt if und normale Satzstellung.', 'Right: I was wondering if you could send me the file. After wondering comes if and normal word order.'),
      [{'if': ['wondering'], 'not': ['if', 'whether'], 'de': 'Nach wondering folgt if oder whether.', 'en': 'After wondering comes if or whether.'}], accepted=['wondering whether'])
V.kwt('sa.soft', 'We hope to hear from you by Friday.', 'HOPING', 'We ___ to hear from you by Friday.', 'are hoping', (2, 2),
      ('Richtig: We are hoping to hear from you. Die Verlaufsform macht den Wunsch weicher.', 'Right: We are hoping to hear from you. The continuous makes the wish softer.'),
      [{'if': ['hoping'], 'not': ['are'], 'de': 'Ohne are fehlt das Hilfsverb: are hoping.', 'en': 'Without are the auxiliary is missing: are hoping.'}])
V.kwt('sa.being', 'He is rude to everyone at the moment.', 'BEING', 'He ___ rude to everyone at the moment.', 'is being', (2, 2),
      ('Richtig: He is being rude. Being zeigt Verhalten für begrenzte Zeit.', 'Right: He is being rude. Being shows behavior for a limited time.'),
      [{'if': ['being'], 'not': ['is'], 'de': 'Ohne is fehlt das Hilfsverb: is being.', 'en': 'Without is the auxiliary is missing: is being.'}])
V.kwt('sa.being', 'She complains about the coffee all the time, which is annoying.', 'ALWAYS', 'She ___ complaining about the coffee.', 'is always', (2, 2),
      ('Richtig: She is always complaining. Always + -ing zeigt Ärger über eine Gewohnheit.', 'Right: She is always complaining. Always + -ing shows annoyance at a habit.'),
      [{'if': ['always'], 'not': ['is'], 'de': 'Vor always braucht es is: is always complaining.', 'en': 'Before always you need is: is always complaining.'}])
V.kwt('sa.no-ing', 'We cannot continue without a decision by Friday.', 'NEED', 'We ___ a decision by Friday.', 'urgently need', (2, 2),
      ('Richtig: We urgently need a decision. Need ist ein Zustandsverb und bleibt einfach.', 'Right: We urgently need a decision. Need is a stative verb and stays simple.'),
      [{'if': ['needing'], 'de': 'Need ist ein Zustandsverb und steht nicht in der Verlaufsform.', 'en': 'Need is a stative verb and does not take the continuous.'}], accepted=['really need', 'simply need'])
V.kwt('sa.no-ing', 'Your concern is clear to me.', 'UNDERSTAND', 'I ___ your concern.', 'fully understand', (2, 2),
      ('Richtig: I fully understand your concern. Understand ist ein Zustandsverb und bleibt einfach.', 'Right: I fully understand your concern. Understand is a stative verb and stays simple.'),
      [{'if': ['understanding'], 'de': 'Understand steht nicht in der Verlaufsform.', 'en': 'Understand does not take the continuous.'}], accepted=['completely understand', 'totally understand'])
V.find('sa.trend', 'Our costs rise at the moment because of the new supplier.', (2, 2), 'are rising', 'Our costs are rising at the moment because of the new supplier.',
       ('Der Fehler: Mit at the moment braucht es die Verlaufsform. Richtig: are rising.', 'The error: with at the moment you need the continuous. Correct: are rising.'),
       ('Ein Vorgang, der gerade läuft, steht in der Verlaufsform.', 'A process that is under way takes the continuous.'))
V.find('sa.trend', 'We are seeing a steady rise in orders, and the market is becoming more competitive.', None, None, None,
       ('Richtig: are seeing und is becoming beschreiben laufende Entwicklungen.', 'Right: are seeing and is becoming describe changes under way.'),
       ('Beide Verlaufsformen sind richtig gebildet.', 'Both continuous forms are correctly formed.'))
V.find('sa.soft', 'I was wondering could we move the call to Thursday.', (3, 4), 'if we could', 'I was wondering if we could move the call to Thursday.',
       ('Der Fehler: Nach wondering folgt if und normale Satzstellung. Richtig: if we could move.', 'The error: after wondering comes if and normal word order. Correct: if we could move.'),
       ('Nach wondering steht ein Nebensatz mit if.', 'After wondering a clause with if follows.'))
V.find('sa.soft', 'I am hoping that you could review the draft before the meeting.', None, None, None,
       ('Richtig: I am hoping that you could … ist eine weiche Bitte.', 'Right: I am hoping that you could … is a soft request.'),
       ('am hoping that you could ist richtig gebildet.', 'am hoping that you could is correctly formed.'))
V.find('sa.being', 'The whole team is being exhausted after the product launch, so we will close early.', (4, 5), 'exhausted', 'The whole team is exhausted after the product launch, so we will close early.',
       ('Der Fehler: Erschöpfung ist ein Zustand, deshalb ohne being. Richtig: is exhausted.', 'The error: exhaustion is a state, so no being. Correct: is exhausted.'),
       ('Being steht nur bei Verhalten, nicht bei Zuständen.', 'Being is used for behavior, not for states.'))
V.find('sa.being', 'He always is complaining about the coffee in the office.', (1, 3), 'is always complaining', 'He is always complaining about the coffee in the office.',
       ('Der Fehler: Always steht hinter is. Richtig: is always complaining.', 'The error: always stands after is. Correct: is always complaining.'),
       ('Das Adverb always steht zwischen is und -ing.', 'The adverb always stands between is and -ing.'))
V.find('sa.no-ing', 'We are needing a decision from the board by Friday.', (1, 2), 'need', 'We need a decision from the board by Friday.',
       ('Der Fehler: Need ist ein Zustandsverb. Richtig: We need a decision.', 'The error: need is a stative verb. Correct: We need a decision.'),
       ('Zustandsverben stehen nicht in der Verlaufsform.', 'Stative verbs do not take the continuous.'))
V.find('sa.no-ing', 'The warehouse is belonging to our parent company.', (2, 3), 'belongs', 'The warehouse belongs to our parent company.',
       ('Der Fehler: Belong ist ein Zustandsverb. Richtig: belongs to.', 'The error: belong is a stative verb. Correct: belongs to.'),
       ('Besitz wird einfach ausgedrückt.', 'Possession is expressed simply.'))
V.meaning('sa.trend', 'Prices are rising.', 'Prices rise.',
          ('Welcher Satz beschreibt einen Anstieg, der gerade läuft?', 'Which sentence describes a rise that is happening now?'), 'a',
          ('Richtig: Satz a. Die Verlaufsform zeigt den laufenden Vorgang.', 'Right: sentence a. The continuous shows the process under way.'),
          [('b', 'In b ist es eine allgemeine Aussage, kein Vorgang jetzt.', 'In b it is a general statement, not a process now.'), ('both', 'Nicht gleich: Nur a beschreibt den Vorgang jetzt.', 'Not the same: only a describes the process now.')])
V.meaning('sa.soft', 'I was wondering if you could help.', 'Can you help?',
          ('Welcher Satz klingt weicher und höflicher?', 'Which sentence sounds softer and more polite?'), 'a',
          ('Richtig: Satz a. Was wondering macht die Bitte weicher.', 'Right: sentence a. Was wondering softens the request.'),
          [('b', 'Satz b ist eine direkte Frage und klingt härter.', 'Sentence b is a direct question and sounds harder.'), ('both', 'Nicht gleich höflich: Nur a ist weich.', 'Not equally polite: only a is soft.')])
V.meaning('sa.being', 'He is being rude.', 'He is rude.',
          ('Welcher Satz sagt, dass er sich nur im Moment so verhält?', 'Which sentence says he behaves like this only right now?'), 'a',
          ('Richtig: Satz a. Is being zeigt Verhalten für begrenzte Zeit.', 'Right: sentence a. Is being shows behavior for a limited time.'),
          [('b', 'Satz b beschreibt sein Wesen, nicht nur den Moment.', 'Sentence b describes his nature, not just the moment.'), ('both', 'Nicht gleich: Nur a meint den Moment.', 'Not the same: only a means the moment.')])
V.meaning('sa.no-ing', 'I think it is a good plan.', 'I am thinking about the plan.',
          ('Welcher Satz sagt, dass ich gerade darüber nachdenke?', 'Which sentence says I am considering it right now?'), 'b',
          ('Richtig: Satz b. Think als „nachdenken“ geht in der Verlaufsform.', 'Right: sentence b. Think as “consider” takes the continuous.'),
          [('a', 'In a heißt think „meinen“ und bleibt einfach. Das ist eine Meinung.', 'In a think means “believe” and stays simple. That is an opinion.'), ('both', 'Nicht gleich: Nur b meint das Nachdenken.', 'Not the same: only b means the considering.')])

ORDER = [
    order_item('sa.trend', 'We are seeing a clear rise in demand this quarter.', 'Wir erleben in diesem Quartal einen deutlichen Anstieg der Nachfrage.',
               ['we', 'are seeing', 'a clear rise', 'in demand', 'this quarter'],
               ('Are seeing ist die Verlaufsform für eine Entwicklung, die gerade läuft. Danach folgt das Objekt a clear rise.', 'Are seeing is the continuous for a change under way. The object a clear rise follows.'),
               'We see a clear rise in demand this quarter.', ('are seeing', 'see', 'Für einen laufenden Trend steht die Verlaufsform.', 'For a trend under way the continuous is used.'),
               single='We are seeing bildet den Anfang; a clear rise in demand this quarter folgt danach.'),
    order_item('sa.trend', 'Customers are increasingly asking for shorter contracts.', 'Kunden fragen immer häufiger nach kürzeren Verträgen.',
               ['customers', 'are', 'increasingly', 'asking', 'for shorter contracts'],
               ('Increasingly steht zwischen are und asking. Die Verlaufsform zeigt den Trend.', 'Increasingly stands between are and asking. The continuous shows the trend.'),
               'Customers are increasingly ask for shorter contracts.', ('asking', 'ask', 'Nach are steht die -ing-Form.', 'After are comes the -ing form.'),
               single='Customers are increasingly bildet den Anfang; asking for shorter contracts folgt danach.'),
    order_item('sa.soft', 'I was wondering if you could send me the file.', 'Ich habe mich gefragt, ob Sie mir die Datei schicken könnten.',
               ['I was wondering', 'if', 'you could', 'send me', 'the file'],
               ('Nach was wondering folgt if und normale Satzstellung: if you could send me.', 'After was wondering comes if and normal word order: if you could send me.'),
               'I was wondering could you send me the file.', ('if', 'could you', 'Nach wondering steht if und das Subjekt vor could.', 'After wondering comes if and the subject before could.'),
               single='I was wondering bildet den Anfang; if you could send me the file folgt danach.'),
    order_item('sa.soft', 'We are hoping to hear from you by Friday.', 'Wir hoffen, bis Freitag von Ihnen zu hören.',
               ['we', 'are hoping', 'to hear', 'from you', 'by Friday'],
               ('Are hoping macht den Wunsch weicher als hope. Danach folgt to hear.', 'Are hoping makes the wish softer than hope. To hear follows.'),
               'We hoping to hear from you by Friday.', ('are hoping', 'hoping', 'Ohne are fehlt das Hilfsverb der Verlaufsform.', 'Without are the auxiliary of the continuous is missing.'),
               single='We are hoping bildet den Anfang; to hear from you by Friday folgt danach.'),
    order_item('sa.being', 'You are being unreasonable about the deadline.', 'Sie sind, was die Frist betrifft, gerade unvernünftig.',
               ['you', 'are being', 'unreasonable', 'about', 'the deadline'],
               ('Are being zeigt Verhalten für begrenzte Zeit. Danach folgt das Adjektiv unreasonable.', 'Are being shows behavior for a limited time. The adjective unreasonable follows.'),
               'You are being unreasonably about the deadline.', ('unreasonable', 'unreasonably', 'Nach being steht ein Adjektiv, kein Adverb.', 'After being comes an adjective, not an adverb.'),
               single='You are being bildet den Anfang; unreasonable about the deadline folgt danach.'),
    order_item('sa.being', 'He is always complaining about the coffee.', 'Er beschwert sich ständig über den Kaffee.',
               ['he', 'is always', 'complaining', 'about', 'the coffee'],
               ('Always steht zwischen is und -ing und zeigt den Ärger über die Gewohnheit.', 'Always stands between is and -ing and shows the annoyance at the habit.'),
               'He always is complaining about the coffee.', ('is always', 'always is', 'Always steht hinter is, nicht davor.', 'Always stands after is, not before it.'),
               single='He is always bildet den Anfang; complaining about the coffee folgt danach.'),
    order_item('sa.no-ing', 'I understand your concern about the delivery date.', 'Ich verstehe Ihr Anliegen zum Liefertermin.',
               ['I', 'understand', 'your concern', 'about', 'the delivery date'],
               ('Understand ist ein Zustandsverb und bleibt in der einfachen Form.', 'Understand is a stative verb and stays in the simple form.'),
               'I am understanding your concern about the delivery date.', ('understand', 'am understanding', 'Zustandsverben nehmen keine Verlaufsform.', 'Stative verbs take no continuous.'),
               single='I understand bildet den Anfang; your concern about the delivery date folgt danach.'),
    order_item('sa.no-ing', 'This folder belongs to the finance team.', 'Dieser Ordner gehört dem Finanzteam.',
               ['this folder', 'belongs', 'to', 'the', 'finance team'],
               ('Belong ist ein Zustandsverb und bleibt einfach: belongs to.', 'Belong is a stative verb and stays simple: belongs to.'),
               'This folder is belonging to the finance team.', ('belongs', 'is belonging', 'Besitz steht in der einfachen Form.', 'Possession is expressed in the simple form.'),
               single='This folder belongs bildet den Anfang; to the finance team folgt danach.'),
]

MAP = {
    'Prices rise at the moment because of the new tax.': {'pat': 'sa.trend', 'why': {
        'ok': B('Mit at the moment läuft der Vorgang gerade: Prices are rising at the moment.', 'With at the moment the process is under way: Prices are rising at the moment.'),
        'wrong': [{'if': ['rise'], 'de': 'Die einfache Form passt nicht zu at the moment. Es braucht are rising.', 'en': 'The simple form does not fit at the moment. It needs are rising.'},
                  {'not': ['rising'], 'de': 'Der laufende Anstieg steht in der Verlaufsform.', 'en': 'The rise under way takes the continuous.'}]}},
    'I was wondering could you send me the file.': {'pat': 'sa.soft', 'why': {
        'ok': B('Nach wondering folgt if und normale Satzstellung: if you could send me.', 'After wondering comes if and normal word order: if you could send me.'),
        'wrong': [{'not': ['if'], 'de': 'Nach wondering braucht es if.', 'en': 'After wondering you need if.'},
                  {'if': ['could', 'you'], 'de': 'Das Subjekt you steht vor could, nicht dahinter.', 'en': 'The subject you stands before could, not after it.'}]}},
    'She is being tired after the long flight.': {'pat': 'sa.being', 'why': {
        'ok': B('Müdigkeit ist ein Zustand, deshalb ohne being: She is tired.', 'Tiredness is a state, so no being: She is tired.'),
        'wrong': [{'if': ['being'], 'de': 'Being steht nur bei Verhalten, nicht bei Zuständen.', 'en': 'Being is used for behavior, not for states.'},
                  {'not': ['tired'], 'de': 'Der Zustand lautet is tired.', 'en': 'The state is is tired.'}]}},
    'I am knowing the answer to your question.': {'pat': 'sa.no-ing', 'why': {
        'ok': B('Know ist ein Zustandsverb und bleibt einfach: I know the answer.', 'Know is a stative verb and stays simple: I know the answer.'),
        'wrong': [{'if': ['knowing'], 'de': 'Know steht nicht in der Verlaufsform.', 'en': 'Know does not take the continuous.'},
                  {'not': ['know'], 'de': 'Die einfache Form heißt know.', 'en': 'The simple form is know.'}]}},
}

def c1x():
    mcc(T, 'sa.trend', 'C1', 'biz', 0.0, 'At the moment, our service desk ___ a sharp increase in requests.',
        'is seeing', ['sees', 'is seen', 'does see'],
        ('Mit at the moment läuft der Vorgang: is seeing. Hier heißt see „erleben“ und nimmt die Verlaufsform.', 'With at the moment the process is under way: is seeing. Here see means “experience” and takes the continuous.'),
        [(G, 'Die einfache Form passt nicht zu at the moment.', 'The simple form does not fit at the moment.'),
         (G, 'Is seen ist Passiv. Der Service Desk erlebt aktiv.', 'Is seen is passive. The service desk experiences actively.'),
         (G, 'Does see ist hier nur eine Betonung und passt nicht zum laufenden Vorgang.', 'Does see is only an emphasis here and does not fit the process under way.')])
    mcc(T, 'sa.soft', 'C1', 'biz', 0.0, 'I was ___ you could send me the updated figures before the call.',
        'hoping', ['hope', 'hoped', 'to hope'],
        ('Was hoping macht die Bitte weich: I was hoping you could send me …', 'Was hoping softens the request: I was hoping you could send me …'),
        [(G, 'Nach was steht die -ing-Form, nicht hope.', 'After was comes the -ing form, not hope.'),
         (G, 'Nach was steht kein Partizip hoped.', 'After was there is no participle hoped.'),
         (G, 'Was to hope hat eine andere Bedeutung („sollte hoffen“).', 'Was to hope has a different meaning (“was supposed to hope”).')])
    mcc(T, 'sa.being', 'C1', 'biz', 0.0, 'The client ___ unreasonable today because the deadline is so close.',
        'is being', ['being', 'is be', 'has being'],
        ('Is being zeigt Verhalten für begrenzte Zeit: today deutet auf den Moment hin.', 'Is being shows behavior for a limited time: today points to the moment.'),
        [(G, 'Ohne is fehlt das Hilfsverb.', 'Without is the auxiliary is missing.'),
         (G, 'Nach is steht being, nicht be.', 'After is comes being, not be.'),
         (G, 'Has being ist keine Verbform des Englischen.', 'Has being is not an English verb form.')])
    mcc(T, 'sa.no-ing', 'C1', 'biz', 0.0, 'We ___ a clear decision from the board before we can start the project.',
        'need', ['are needing', 'needing', 'do needing'],
        ('Need ist ein Zustandsverb und bleibt einfach: We need a clear decision.', 'Need is a stative verb and stays simple: We need a clear decision.'),
        [(G, 'Need nimmt keine Verlaufsform.', 'Need takes no continuous.'),
         (G, 'Ohne Hilfsverb ist needing kein Prädikat.', 'Without an auxiliary needing is not a predicate.'),
         (G, 'Do needing mischt zwei Formen.', 'Do needing mixes two forms.')])
    mcc(T, 'sa.soft', 'C1', 'life', 0.0, 'I ___ if you could help me move the sofa on Saturday.',
        'was wondering', ['wonder to', 'was wonder', 'am wonder'],
        ('Was wondering macht die Bitte freundlich und weich: I was wondering if you could …', 'Was wondering makes the request friendly and soft: I was wondering if you could …'),
        [(G, 'Nach wonder steht nicht to, sondern if.', 'After wonder comes if, not to.'),
         (G, 'Nach was steht die -ing-Form wondering.', 'After was comes the -ing form wondering.'),
         (G, 'Nach am steht ebenfalls die -ing-Form.', 'After am the -ing form follows as well.')])
    mcc(T, 'sa.no-ing', 'C1', 'life', 0.0, 'This old watch ___ to my grandfather, so I treat it carefully.',
        'belongs', ['is belonging', 'belonging', 'does belonging'],
        ('Belong ist ein Zustandsverb und bleibt einfach: belongs to.', 'Belong is a stative verb and stays simple: belongs to.'),
        [(G, 'Belong nimmt keine Verlaufsform.', 'Belong takes no continuous.'),
         (G, 'Ohne Hilfsverb ist belonging kein Prädikat.', 'Without an auxiliary belonging is not a predicate.'),
         (G, 'Does belonging mischt zwei Formen.', 'Does belonging mixes two forms.')])

    ocl(T, 'sa.trend', 'C1', 'biz', 0.0, 'Our clients are ___ requesting flexible payment terms, and we have to react.',
        ['increasingly'], 'adv', ['increase', 'increased', 'increasing'],
        ('Increasingly steht als Adverb zwischen are und asking: are increasingly asking.', 'Increasingly stands as an adverb between are and asking: are increasingly asking.'))
    ocl(T, 'sa.soft', 'C1', 'biz', 0.0, 'We are ___ to hear from you by the end of the week.',
        ['hoping'], 'part', ['hope', 'hoped', 'hopeful'],
        ('Are hoping macht den Wunsch weicher als hope.', 'Are hoping makes the wish softer than hope.'))
    ocl(T, 'sa.being', 'C1', 'biz', 0.0, 'You are ___ unreasonable about the schedule, and the whole team has noticed.',
        ['being'], 'aux', ['be', 'been', 'are'],
        ('Are being zeigt Verhalten für begrenzte Zeit.', 'Are being shows behavior for a limited time.'))
    ocl(T, 'sa.no-ing', 'C1', 'biz', 0.0, 'The data center ___ to our parent company, so we need their approval.',
        ['belongs'], 'part', ['belonging', 'belong', 'belonged'],
        ('Belong ist ein Zustandsverb und bleibt einfach: belongs to.', 'Belong is a stative verb and stays simple: belongs to.'))
    ocl(T, 'sa.trend', 'C1', 'life', 0.0, 'It is getting ___ to find a flat in this city, even for a small family.',
        ['harder'], 'adv', ['hardly', 'hardest', 'hardness'],
        ('Is getting + Komparativ beschreibt eine Entwicklung: is getting harder.', 'Is getting + comparative describes a change: is getting harder.'))
    ocl(T, 'sa.being', 'C1', 'life', 0.0, 'My brother is ___ silly today because he wants to cheer us up.',
        ['being'], 'aux', ['be', 'been', 'having'],
        ('Is being zeigt Verhalten für begrenzte Zeit: is being silly.', 'Is being shows behavior for a limited time: is being silly.'))

    err(T, 'sa.trend', 'C1', 'biz', 0.0, 'Prices in the sector rise at the moment, so we are reviewing our offers.',
        ('rise at the moment', ['are rising at the moment'], ['are rising at the moment', 'rises at the moment', 'rising at the moment']),
        ('Mit at the moment braucht es die Verlaufsform: are rising.', 'With at the moment you need the continuous: are rising.'))
    err(T, 'sa.soft', 'C1', 'biz', 0.0, 'I was wondering could we shift the review to Thursday afternoon.',
        ('could we shift', ['if we could shift'], ['if we could shift', 'if could we shift', 'whether could we shift']),
        ('Nach wondering folgt if und normale Satzstellung: if we could shift.', 'After wondering comes if and normal word order: if we could shift.'))
    err(T, 'sa.being', 'C1', 'biz', 0.0, 'The client is being very exhausted after the long negotiation, so let us end early.',
        ('being very exhausted', ['very exhausted'], ['very exhausted', 'been very exhausted', 'being exhausted very']),
        ('Erschöpfung ist ein Zustand, deshalb ohne being: is very exhausted.', 'Exhaustion is a state, so no being: is very exhausted.'))
    err(T, 'sa.no-ing', 'C1', 'biz', 0.0, 'We are needing written confirmation before we can release the budget.',
        ('are needing', ['need'], ['need', 'needing', 'do needing']),
        ('Need ist ein Zustandsverb und bleibt einfach: We need.', 'Need is a stative verb and stays simple: We need.'))
    err(T, 'sa.being', 'C1', 'life', 0.0, 'My little brother is being silly today because he wants us to laugh.', None,
        ('Kein Fehler: Silly beschreibt Verhalten, deshalb passt is being.', 'No mistake: silly describes behavior, so is being fits.'))
    err(T, 'sa.soft', 'C1', 'life', 0.0, 'We are hoping to see you at the barbecue on Saturday.', None,
        ('Kein Fehler: Are hoping macht die Einladung freundlich und weich.', 'No mistake: are hoping makes the invitation friendly and soft.'))

    kwt(T, 'sa.trend', 'C1', 'biz', 0.0, 'Orders are going up fast this month.', 'SEEING', 'We', 'in orders this month.',
        [(['are seeing'], ['a fast rise'])], ['are', 'a', 'fast', 'rise'], ['see', 'saw', 'seen'], [],
        ('are seeing a fast rise. Die Verlaufsform zeigt die laufende Entwicklung.', 'are seeing a fast rise. The continuous shows the change under way.'), [])
    kwt(T, 'sa.soft', 'C1', 'biz', 0.0, 'Could you confirm the venue for the workshop?', 'HOPING', 'I was', 'confirm the venue for the workshop.',
        [(['hoping'], ['you could'])], ['you', 'could'], ['hope', 'hoped', 'to'], [],
        ('was hoping you could. Die Verlaufsform macht die Bitte weicher.', 'was hoping you could. The continuous softens the request.'), [])
    kwt(T, 'sa.being', 'C1', 'biz', 0.0, 'The client behaves in a very difficult way today.', 'BEING', 'The client', 'today.',
        [(['is being'], ['very difficult'])], ['is', 'very', 'difficult'], ['be', 'been', 'has'], [],
        ('is being very difficult. Being zeigt Verhalten für begrenzte Zeit.', 'is being very difficult. Being shows behavior for a limited time.'), [])
    kwt(T, 'sa.no-ing', 'C1', 'biz', 0.0, 'A decision is required by Friday.', 'NEED', 'We', 'by Friday.',
        [(['urgently need'], ['a decision'])], ['urgently', 'a', 'decision'], ['are', 'needing', 'needed'], ['are needing'],
        ('urgently need a decision. Need ist ein Zustandsverb und bleibt einfach.', 'urgently need a decision. Need is a stative verb and stays simple.'),
        [W(['needing'], 'Need ist ein Zustandsverb und steht nicht in der Verlaufsform.', 'Need is a stative verb and does not take the continuous.')])
    kwt(T, 'sa.trend', 'C1', 'life', 0.0, 'Houses in this area become more expensive every year.', 'GETTING', 'Houses in this area are', 'every year.',
        [(['getting'], ['more expensive'])], ['more', 'expensive'], ['get', 'got', 'gets'], [],
        ('are getting more expensive. Die Verlaufsform zeigt die laufende Entwicklung.', 'are getting more expensive. The continuous shows the change under way.'), [])
    kwt(T, 'sa.soft', 'C1', 'life', 0.0, 'We hope you can come to our housewarming party.', 'HOPING', 'We', 'come to our housewarming party.',
        [(['are hoping'], ['you can'])], ['are', 'you', 'can'], ['hope', 'hoped', 'to'], [],
        ('are hoping you can come. Die Verlaufsform macht die Einladung freundlicher.', 'are hoping you can come. The continuous makes the invitation friendlier.'), [])

def place():
    mcc(T, 'sa.trend', 'B2+', 'biz', -0.1, 'Prices in this sector ___ at the moment, so customers are asking questions.',
        'are rising', ['rise', 'rises', 'are rise'],
        ('Mit at the moment braucht es die Verlaufsform: are rising.', 'With at the moment you need the continuous: are rising.'),
        [(G, 'Die einfache Form passt nicht zu at the moment.', 'The simple form does not fit at the moment.'),
         (G, 'Prices ist Plural, deshalb nicht rises.', 'Prices is plural, so not rises.'),
         (G, 'Nach are steht die -ing-Form.', 'After are comes the -ing form.')])
    err(T, 'sa.no-ing', 'C1', 'life', 0.0, 'We are knowing the answer already, so there is no need for another meeting.',
        ('are knowing', ['know'], ['know', 'knowing', 'do knowing']),
        ('Know ist ein Zustandsverb und bleibt einfach: We know.', 'Know is a stative verb and stays simple: We know.'))
