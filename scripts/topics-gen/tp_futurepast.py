from cm import *
import lib
from lib import mcc, ocl, err, kwt, W

G = 'grammar'; M = 'meaning'; C = 'calque'; P = 'partner'; R = 'register'
T = 'future-past'

TOPIC = {
    'id': T, 'group': 'Grammatik-Pfad', 'level': 'C1', 'p0': 0.45,
    'name': 'Zukunft in der Vergangenheit', 'name_en': 'Future in the past',
    'rule': 'Wenn du aus der Vergangenheit auf etwas Späteres blickst, ändern sich die Formen: „was going to“ (Plan), „was about to“ (gerade im Begriff), „would“ (später geschah) und „was to“ (vorgesehen). Häufig ging der Plan nicht auf.',
    'rule_en': 'When you look from the past at something later, the forms change: “was going to” (plan), “was about to” (on the point of), “would” (later happened) and “was to” (meant to). Often the plan did not work out.',
    'ex': ['We were going to launch in May, but the supplier was late.', 'She joined in 2015 and would later lead the Berlin office.'],
}

PAT = [
    pattern('fp.was-going', ('was going to · der Plan von damals', 'was going to · the plan back then'),
            ('was / were going to + Grundform', 'was / were going to + base form'),
            ('Mit was going to nennst du einen Plan aus der Vergangenheit. Oft kam es anders: „We were going to launch in May, but the supplier was late.“',
             'With was going to you name a plan from the past. Often it turned out differently: “We were going to launch in May, but the supplier was late.”'),
            ['was going to', 'were going to', 'had been going to'],
            [('We were going to launch in May, but the supplier was late.', 'Wir wollten im Mai starten, aber der Lieferant war spät dran.', 'meeting'),
             ('I was going to call you, but the line was busy.', 'Ich wollte dich anrufen, aber die Leitung war besetzt.', 'talk'),
             ('She said she was going to resign.', 'Sie sagte, sie wolle kündigen.', 'mail')],
            ('We are going to launch in May, but the supplier was late.', 'We were going to launch in May, but the supplier was late.',
             'Ein Plan aus der Vergangenheit braucht was oder were going to. Das Hilfsverb are gehört in die Gegenwart.',
             'A plan from the past needs was or were going to. The auxiliary are belongs to the present.'),
            ('fp.about-to', 'I was going to leave.', 'I was about to leave.',
             'Was going to nennt einen Plan. Was about to heißt: kurz davor, es jetzt zu tun.', 'Was going to names a plan. Was about to means: on the point of doing it now.'),
            [('We were going to launch in May.', 'Hat der Start vielleicht nicht geklappt?', 'Did the launch perhaps not work out?', True)],
            ('Geht es um einen Plan von damals? Dann passt was going to.', 'Is it about a plan from back then? Then was going to fits.')),
    pattern('fp.about-to', ('was about to · gerade im Begriff', 'was about to · on the point of'),
            ('was / were about to + Grundform (… when …)', 'was / were about to + base form (… when …)'),
            ('Was about to heißt: Die Handlung stand unmittelbar bevor, dann kam etwas dazwischen. Oft folgt ein when-Satz: „I was about to leave when the client called.“',
             'Was about to means: the action was just about to happen, then something intervened. A when-clause often follows: “I was about to leave when the client called.”'),
            ['was about to', 'were about to', 'about to'],
            [('I was about to leave when the client called.', 'Ich wollte gerade gehen, als der Kunde anrief.', 'talk'),
             ('We were about to sign when the lawyer found an error.', 'Wir wollten gerade unterschreiben, als der Anwalt einen Fehler fand.', 'meeting'),
             ('The meeting was about to start when the power failed.', 'Die Besprechung sollte gerade beginnen, als der Strom ausfiel.', 'mail')],
            ('I was about leaving when the client called.', 'I was about to leave when the client called.',
             'Das deutsche „gerade am Gehen“ führt zu „about leaving“. Englisch sagt about to und die Grundform.',
             'The German “gerade am Gehen” leads to “about leaving”. English says about to and the base form.'),
            ('fp.was-going', 'I was about to leave.', 'I was going to leave.',
             'Was about to heißt: kurz davor. Was going to nennt einen Plan.', 'Was about to means: just before. Was going to names a plan.'),
            [('I was about to leave when she called.', 'War ich noch da, als sie anrief?', 'Was I still there when she called?', True)],
            ('Stand die Handlung kurz bevor? Dann passt was about to, oft mit when.', 'Was the action just about to happen? Then was about to fits, often with when.')),
    pattern('fp.would-narr', ('would · später geschah es', 'would · later it happened'),
            ('would (later / soon / eventually) + Grundform', 'would (later / soon / eventually) + base form'),
            ('Beim Erzählen blickst du von einem Punkt der Vergangenheit auf Späteres: „She joined in 2015 and would later lead the office.“ Auch nach Verben wie promised steht would statt will.',
             'When telling a story you look from a point in the past at something later: “She joined in 2015 and would later lead the office.” After verbs like promised too, would replaces will.'),
            ['would later', 'would soon', 'would eventually', 'would go on to', 'promised that he would'],
            [('She joined the firm in 2015 and would later lead the Berlin office.', 'Sie kam 2015 zur Firma und leitete später das Berliner Büro.', 'talk'),
             ('He promised that he would send the report by Monday.', 'Er versprach, den Bericht bis Montag zu schicken.', 'mail'),
             ('The product would go on to win several awards.', 'Das Produkt gewann später mehrere Preise.', 'meeting')],
            ('In 2015 she joined the firm and will later lead the Berlin office.', 'In 2015 she joined the firm and would later lead the Berlin office.',
             'Wer aus der Vergangenheit auf Späteres blickt, braucht would. Will gehört in die Gegenwart.',
             'If you look from the past at something later, you need would. Will belongs to the present.'),
            ('fp.was-to', 'She would later lead the office.', 'She was to lead the office.',
             'Would zeigt nur, dass es später geschah. Was to sagt, dass es so vorgesehen war.', 'Would shows only that it happened later. Was to says it was meant to be.'),
            [('She would later lead the office.', 'Geschah es später?', 'Did it happen later?', True)],
            ('Blickst du aus der Vergangenheit auf Späteres? Dann passt would, nicht will.', 'Do you look from the past at something later? Then would fits, not will.')),
    pattern('fp.was-to', ('was to · vorgesehen', 'was to · meant to'),
            ('was / were to + Grundform · was / were to have + 3. Form', 'was / were to + base form · was / were to have + participle'),
            ('Was to nennt, was vorgesehen war oder bestimmt schien: „The new office was to open in June.“ Mit was to have + 3. Form sagst du, dass es nicht geschah. Im Alltag sagt man meist was supposed to, was to klingt förmlich.',
             'Was to names what was planned or seemed destined: “The new office was to open in June.” With was to have + participle you say it did not happen. In everyday speech people mostly say was supposed to, was to sounds formal.'),
            ['was to', 'were to', 'was to have', 'was never to'],
            [('The new office was to open in June, but the permit was delayed.', 'Das neue Büro sollte im Juni eröffnen, aber die Genehmigung verzögerte sich.', 'mail'),
             ('She was to become the youngest director in the firm.', 'Sie sollte die jüngste Direktorin der Firma werden.', 'talk'),
             ('The talks were to have ended on Friday.', 'Die Gespräche hätten am Freitag enden sollen.', 'meeting')],
            ('The new office should open in June, but the permit was delayed.', 'The new office was to open in June, but the permit was delayed.',
             'Das deutsche „sollte“ wird hier nicht zu should. Für einen Plan in der Vergangenheit gilt was to.',
             'The German “sollte” does not become should here. For a plan in the past was to is used.'),
            ('fp.would-narr', 'She was to lead the office.', 'She would later lead the office.',
             'Was to sagt, dass es vorgesehen war. Would zeigt nur, dass es später geschah.', 'Was to says it was meant to be. Would shows only that it happened later.'),
            [('The talks were to end on Friday.', 'Nennt der Satz, was geplant war?', 'Does the sentence name what was planned?', True)],
            ('Geht es um etwas Vorgesehenes? Dann passt was to, bei einem nicht erfüllten Plan was to have + 3. Form.', 'Is it about something meant to happen? Then was to fits, for an unfulfilled plan was to have + participle.')),
]

FILE = topic_file(T, ('Ich kann aus der Vergangenheit auf Späteres blicken: Pläne (was going to), unmittelbar Bevorstehendes (was about to), spätere Folgen (would) und Vorgesehenes (was to).',
                      'I can look from the past at what came later: plans (was going to), what was imminent (was about to), later results (would) and what was meant to be (was to).'),
                  PAT, [['fp.was-going', 'fp.about-to'], ['fp.would-narr', 'fp.was-to']],
                  (['Ging es um einen Plan von damals? Nimm was going to.',
                    'Stand es kurz bevor, dann kam etwas dazwischen? Nimm was about to + when.',
                    'Blickst du erzählend auf Späteres? Nimm would. War es vorgesehen? Nimm was to.'],
                   ['Was it a plan from back then? Use was going to.',
                    'Was it just about to happen, then something intervened? Use was about to + when.',
                    'Do you look ahead while telling a story? Use would. Was it meant to be? Use was to.']))

RULES = rules_from(PAT,
    ('Von der Vergangenheit aus gesehen verschieben sich die Zukunftsformen: will wird would, am going to wird was going to. Dazu kommen was about to und was to.',
     'Seen from the past, the future forms shift: will becomes would, am going to becomes was going to. Was about to and was to are added.'),
    ('Im Beruf erzählst du von geplatzten Plänen („We were going to launch …“) und Verläufen („She would later lead …“). Wann ja, wann nein: Im Alltag genügt „was going to“, „was to“ und „would later“ gehören eher in Berichte und Erzählungen.',
     'At work you talk about plans that fell through (“We were going to launch …”) and careers (“She would later lead …”). When yes, when no: in everyday talk “was going to” is enough, “was to” and “would later” fit reports and stories better.'),
    ('Nicht verwechseln: Das deutsche „sollte“ ist nicht immer should. Für Vorgesehenes aus der Vergangenheit sagt Englisch was to oder was supposed to.',
     'Do not mix up: the German “sollte” is not always should. For something meant to happen in the past English says was to or was supposed to.'),
    (['Blickst du aus der Vergangenheit auf Späteres?', 'Plan von damals: was going to.', 'Kurz davor: was about to + Grundform.', 'Später geschah es: would. Vorgesehen: was to.'],
     ['Do you look from the past at something later?', 'Plan from back then: was going to.', 'Just before: was about to + base form.', 'It happened later: would. Meant to be: was to.']))

V = V2('fp')
V.kwt('fp.was-going', 'We planned to launch in May, but the supplier was late.', 'GOING', 'We ___ launch in May, but the supplier was late.', 'were going to', (3, 3),
      ('Richtig: We were going to launch in May. Was oder were going to nennt den Plan.', 'Right: We were going to launch in May. Was or were going to names the plan.'),
      [{'if': ['going'], 'not': ['were'], 'de': 'Zu we passt were: were going to.', 'en': 'With we, were fits: were going to.'}])
V.kwt('fp.was-going', 'I intended to call you, but the line was busy.', 'GOING', 'I ___ call you, but the line was busy.', 'was going to', (3, 3),
      ('Richtig: I was going to call you. Was going to nennt den Plan.', 'Right: I was going to call you. Was going to names the plan.'),
      [{'if': ['going'], 'not': ['to'], 'de': 'Nach going braucht es to und die Grundform.', 'en': 'After going you need to and the base form.'}])
V.kwt('fp.about-to', 'I almost left when the client called.', 'ABOUT', 'I was ___ leave when the client called.', 'about to', (2, 2),
      ('Richtig: I was about to leave. Nach about steht to und die Grundform.', 'Right: I was about to leave. After about comes to and the base form.'),
      [{'if': ['about'], 'not': ['to'], 'de': 'Nach about braucht es to.', 'en': 'After about you need to.'}])
V.kwt('fp.about-to', 'We nearly signed the contract when the lawyer found an error.', 'ABOUT', 'We were ___ sign the contract when the lawyer found an error.', 'about to', (2, 2),
      ('Richtig: We were about to sign. Danach kam der Fehler dazwischen.', 'Right: We were about to sign. Then the error intervened.'),
      [{'if': ['about'], 'not': ['to'], 'de': 'Nach about braucht es to.', 'en': 'After about you need to.'}])
V.kwt('fp.would-narr', 'In 2015 she joined the firm, and she became head of the Berlin office later.', 'WOULD', 'In 2015 she joined the firm and ___ lead the Berlin office.', 'would later', (2, 2),
      ('Richtig: she would later lead the Berlin office. Would blickt aus der Vergangenheit auf Späteres.', 'Right: she would later lead the Berlin office. Would looks from the past at something later.'),
      [{'if': ['would'], 'not': ['later', 'soon', 'eventually'], 'de': 'Hier fehlt das Wort, das „später“ ausdrückt: would later.', 'en': 'The word for “later” is missing here: would later.'}], accepted=['would soon', 'would eventually'])
V.kwt('fp.would-narr', 'He promised: I will send the report by Monday.', 'WOULD', 'He promised that he ___ the report by Monday.', 'would send', (2, 2),
      ('Richtig: he would send the report. Nach promised steht would statt will.', 'Right: he would send the report. After promised, would replaces will.'),
      [{'if': ['would'], 'not': ['send'], 'de': 'Nach would steht die Grundform send.', 'en': 'After would comes the base form send.'}])
V.kwt('fp.was-to', 'The talks had been planned for Friday.', 'WERE', 'The talks ___ end on Friday.', 'were to', (2, 2),
      ('Richtig: The talks were to end on Friday. Were to nennt das, was vorgesehen war.', 'Right: The talks were to end on Friday. Were to names what was planned.'),
      [{'if': ['were'], 'not': ['to'], 'de': 'Nach were braucht es to und die Grundform.', 'en': 'After were you need to and the base form.'}])
V.kwt('fp.was-to', 'The new office has been scheduled for June, but the permit was delayed.', 'OPEN', 'The new office ___ in June, but the permit was delayed.', 'was to open', (3, 3),
      ('Richtig: The new office was to open in June. Was to nennt den Plan.', 'Right: The new office was to open in June. Was to names the plan.'),
      [{'if': ['open'], 'not': ['to'], 'de': 'Vor open braucht es was to.', 'en': 'Before open you need was to.'}])
V.find('fp.was-going', 'We are going to launch in June, but the supplier delayed everything.', (1, 2), 'were going', 'We were going to launch in June, but the supplier delayed everything.',
       ('Der Fehler: Der Plan liegt in der Vergangenheit. Richtig: were going to.', 'The error: the plan lies in the past. Correct: were going to.'),
       ('Ein Plan von damals braucht was oder were going to.', 'A plan from back then needs was or were going to.'))
V.find('fp.was-going', 'I was going to call you earlier, but the line was busy all morning.', None, None, None,
       ('Richtig: was going to call nennt den Plan von damals.', 'Right: was going to call names the plan from back then.'),
       ('was going to call ist richtig gebildet.', 'was going to call is correctly formed.'))
V.find('fp.about-to', 'Our guests were about arriving when we noticed the missing chairs.', (3, 4), 'about to arrive', 'Our guests were about to arrive when we noticed the missing chairs.',
       ('Der Fehler: Nach about steht to und die Grundform. Richtig: about to arrive.', 'The error: after about comes to and the base form. Correct: about to arrive.'),
       ('Nach about steht to und die Grundform.', 'After about comes to and the base form.'))
V.find('fp.about-to', 'She was about to hang up when the call finally connected.', None, None, None,
       ('Richtig: was about to hang up, dann kam der Anruf dazwischen.', 'Right: was about to hang up, then the call intervened.'),
       ('was about to hang up ist richtig gebildet.', 'was about to hang up is correctly formed.'))
V.find('fp.would-narr', 'He joined as a trainee in 2012 and will later become the head of sales.', (8, 10), 'would later become', 'He joined as a trainee in 2012 and would later become the head of sales.',
       ('Der Fehler: Aus der Vergangenheit auf Späteres braucht es would. Richtig: would later become.', 'The error: looking from the past at something later needs would. Correct: would later become.'),
       ('Beim Erzählen aus der Vergangenheit steht would.', 'When telling from the past, would is used.'))
V.find('fp.would-narr', 'She promised that she will review the draft by Monday.', (4, 5), 'would review', 'She promised that she would review the draft by Monday.',
       ('Der Fehler: Nach promised steht would statt will. Richtig: would review.', 'The error: after promised, would replaces will. Correct: would review.'),
       ('Nach einem Verb der Vergangenheit rückt will zu would.', 'After a verb in the past, will shifts to would.'))
V.find('fp.was-to', 'The new warehouse should open in March, but the permit was delayed.', (3, 4), 'was to open', 'The new warehouse was to open in March, but the permit was delayed.',
       ('Der Fehler: Für einen Plan in der Vergangenheit gilt was to. Richtig: was to open.', 'The error: for a plan in the past was to is used. Correct: was to open.'),
       ('Statt should steht was to.', 'Instead of should, was to is used.'))
V.find('fp.was-to', 'The talks was to end on Friday, but they ran into the weekend.', (2, 3), 'were to', 'The talks were to end on Friday, but they ran into the weekend.',
       ('Der Fehler: Talks ist Plural, deshalb were to. Richtig: The talks were to end.', 'The error: talks is plural, so were to. Correct: The talks were to end.'),
       ('Zu einem Plural passt were to.', 'With a plural, were to fits.'))
V.meaning('fp.was-going', 'We were going to launch in May.', 'We launched in May.',
          ('Welcher Satz sagt, dass der Plan vermutlich nicht aufging?', 'Which sentence suggests the plan probably did not work out?'), 'a',
          ('Richtig: Satz a. Was going to nennt einen Plan, der oft nicht eintrat.', 'Right: sentence a. Was going to names a plan that often did not happen.'),
          [('b', 'In b hat der Start stattgefunden.', 'In b the launch took place.'), ('both', 'Nicht gleich: Nur a nennt einen Plan.', 'Not the same: only a names a plan.')])
V.meaning('fp.about-to', 'I was about to leave when she called.', 'I had already left when she called.',
          ('Welcher Satz sagt, dass ich noch da war?', 'Which sentence says I was still there?'), 'a',
          ('Richtig: Satz a. Was about to heißt: kurz davor, aber noch nicht geschehen.', 'Right: sentence a. Was about to means: just before, but not yet done.'),
          [('b', 'In b war ich schon weg und nicht mehr da.', 'In b I was already gone.'), ('both', 'Nicht gleich: Nur a meint, dass ich noch da war.', 'Not the same: only a means I was still there.')])
V.meaning('fp.would-narr', 'She would later lead the office.', 'She will lead the office.',
          ('Welcher Satz blickt aus der Vergangenheit auf Späteres?', 'Which sentence looks from the past at something later?'), 'a',
          ('Richtig: Satz a. Would blickt aus der Vergangenheit voraus.', 'Right: sentence a. Would looks ahead from the past.'),
          [('b', 'Satz b spricht von der Zukunft aus der Gegenwart.', 'Sentence b speaks of the future from the present.'), ('both', 'Nicht gleich: Nur a blickt aus der Vergangenheit.', 'Not the same: only a looks from the past.')])
V.meaning('fp.was-to', 'The talks were to end on Friday.', 'The talks ended on Friday.',
          ('Welcher Satz nennt, was geplant war?', 'Which sentence names what was planned?'), 'a',
          ('Richtig: Satz a. Were to nennt das Vorgesehene.', 'Right: sentence a. Were to names what was meant to be.'),
          [('b', 'In b endeten die Gespräche, es war kein Plan.', 'In b the talks ended, it was not a plan.'), ('both', 'Nicht gleich: Nur a nennt einen Plan.', 'Not the same: only a names a plan.')])

ORDER = [
    order_item('fp.was-going', 'We were going to launch the product in May.', 'Wir wollten das Produkt im Mai auf den Markt bringen.',
               ['we', 'were going to', 'launch', 'the product', 'in May'],
               ('Were going to nennt den Plan von damals. Danach folgt die Grundform launch.', 'Were going to names the plan from back then. The base form launch follows.'),
               'We are going to launch the product in May.', ('were going to', 'are going to', 'Ein Plan von damals braucht were, nicht are.', 'A plan from back then needs were, not are.'),
               single='We were going to bildet den Anfang; launch the product in May folgt danach.'),
    order_item('fp.was-going', 'I was going to call you earlier this morning.', 'Ich wollte dich heute früh anrufen.',
               ['I', 'was going to', 'call you', 'earlier', 'this morning'],
               ('Was going to nennt den Plan. Danach folgt die Grundform call.', 'Was going to names the plan. The base form call follows.'),
               'I was going call you earlier this morning.', ('was going to', 'was going', 'Nach going braucht es to.', 'After going you need to.'),
               single='I was going to bildet den Anfang; call you earlier this morning folgt danach.'),
    order_item('fp.about-to', 'We were about to sign when the lawyer found an error.', 'Wir wollten gerade unterschreiben, als der Anwalt einen Fehler fand.',
               ['we were', 'about to', 'sign', 'when', 'the lawyer', 'found', 'an error'],
               ('Were about to heißt: kurz davor. Der Satz mit when zeigt, was dazwischen kam; das ist die Pointe.', 'Were about to means: just before. The when-clause shows what intervened.'),
               'We were about signing when the lawyer found an error.', ('about to', 'about', 'Nach about steht to und die Grundform.', 'After about comes to and the base form.'),
               single='We were about to bildet den Anfang; sign when the lawyer found an error folgt danach.'),
    order_item('fp.about-to', 'The meeting was about to start when the power failed.', 'Die Besprechung sollte gerade beginnen, als der Strom ausfiel.',
               ['the meeting', 'was', 'about to', 'start', 'when', 'the power', 'failed'],
               ('Was about to heißt: kurz davor. Der Satz mit when zeigt, was dazwischen kam; das ist die Pointe.', 'Was about to means: just before. When shows what intervened.'),
               'The meeting was about starting when the power failed.', ('start', 'starting', 'Nach about to steht die Grundform.', 'After about to comes the base form.'),
               single='The meeting was bildet den Anfang; about to start when the power failed folgt danach.'),
    order_item('fp.would-narr', 'She joined the firm in 2015 and would later lead the Berlin office.', 'Sie kam 2015 zur Firma und leitete später das Berliner Büro.',
               ['she', 'joined', 'the firm', 'in 2015', 'and', 'would later', 'lead', 'the Berlin office'],
               ('Would later blickt aus der Vergangenheit auf Späteres. Danach folgt die Grundform lead.', 'Would later looks from the past at something later. The base form lead follows.'),
               'She joined the firm in 2015 and will later lead the Berlin office.', ('would later', 'will later', 'Aus der Vergangenheit heraus steht would, nicht will.', 'Seen from the past, would is used, not will.'),
               single='She joined the firm in 2015 bildet den Anfang; and would later lead the Berlin office folgt danach.'),
    order_item('fp.would-narr', 'He promised that he would send the report by Monday.', 'Er versprach, den Bericht bis Montag zu schicken.',
               ['he promised', 'that', 'he', 'would send', 'the report', 'by Monday'],
               ('Nach promised steht would statt will. Danach folgt die Grundform send.', 'After promised, would replaces will. The base form send follows.'),
               'He promised that he will send the report by Monday.', ('would send', 'will send', 'Nach einem Verb der Vergangenheit steht would.', 'After a verb in the past, would is used.'),
               single='He promised that he bildet den Anfang; would send the report by Monday folgt danach.'),
    order_item('fp.was-to', 'The new office was to open in June.', 'Das neue Büro sollte im Juni eröffnen.',
               ['the new office', 'was to', 'open', 'in', 'June'],
               ('Was to nennt, was vorgesehen war. Danach folgt die Grundform open.', 'Was to names what was meant to be. The base form open follows.'),
               'The new office should open in June.', ('was to', 'should', 'Für einen Plan in der Vergangenheit steht was to.', 'For a plan in the past was to is used.'),
               single='The new office was to bildet den Anfang; open in June folgt danach.'),
    order_item('fp.was-to', 'She was to become the youngest director in the firm.', 'Sie sollte die jüngste Direktorin der Firma werden.',
               ['she', 'was to', 'become', 'the youngest director', 'in the firm'],
               ('Was to nennt, was vorgesehen schien. Danach folgt die Grundform become.', 'Was to names what seemed meant to be. The base form become follows.'),
               'She was to became the youngest director in the firm.', ('become', 'became', 'Nach was to steht die Grundform.', 'After was to comes the base form.'),
               single='She was to bildet den Anfang; become the youngest director in the firm folgt danach.'),
]

MAP = {
    'We are going to launch in May, but the supplier was late.': {'pat': 'fp.was-going', 'why': {
        'ok': B('Ein Plan von damals braucht were going to: We were going to launch in May.', 'A plan from back then needs were going to: We were going to launch in May.'),
        'wrong': [{'if': ['are', 'going'], 'de': 'Are gehört in die Gegenwart. Hier passt were.', 'en': 'Are belongs to the present. Here were fits.'},
                  {'not': ['were'], 'de': 'Es braucht hier were going to, nicht are.', 'en': 'It needs were going to.'}]}},
    'I was about leaving when the client called.': {'pat': 'fp.about-to', 'why': {
        'ok': B('Nach about steht to und die Grundform: I was about to leave.', 'After about comes to and the base form: I was about to leave.'),
        'wrong': [{'if': ['about', 'leaving'], 'de': 'About leaving ist deutsch gedacht. Es braucht about to leave.', 'en': 'About leaving is German thinking. It needs about to leave.'},
                  {'not': ['to'], 'de': 'Nach about braucht es to.', 'en': 'After about you need to.'}]}},
    'In 2015 she joined the firm and will later lead the Berlin office.': {'pat': 'fp.would-narr', 'why': {
        'ok': B('Aus der Vergangenheit auf Späteres: she would later lead the office.', 'From the past at something later: she would later lead the office.'),
        'wrong': [{'if': ['will'], 'de': 'Will gehört in die Gegenwart. Hier braucht es would.', 'en': 'Will belongs to the present. Here it needs would.'},
                  {'not': ['would'], 'de': 'Hier ist would later nötig, nicht will.', 'en': 'It needs would later.'}]}},
    'The new office should open in June, but the permit was delayed.': {'pat': 'fp.was-to', 'why': {
        'ok': B('Für einen Plan in der Vergangenheit gilt was to: The new office was to open in June.', 'For a plan in the past was to is used: The new office was to open in June.'),
        'wrong': [{'if': ['should'], 'de': 'Das deutsche „sollte“ wird hier nicht zu should. Es braucht was to.', 'en': 'The German “sollte” does not become should here. It needs was to.'},
                  {'not': ['was', 'to'], 'de': 'Es braucht was to und die Grundform.', 'en': 'It needs was to and the base form.'}]}},
}

def c1x():
    mcc(T, 'fp.was-going', 'C1', 'biz', 0.0, 'We ___ launch the new tool in May, but the vendor delayed the delivery.',
        'were going to', ['are going to', 'went to', 'would to'],
        ('Ein Plan von damals braucht were going to. Der Satz mit but zeigt, dass es nicht klappte.', 'A plan from back then needs were going to. The sentence with but shows it did not work.'),
        [(G, 'Are gehört in die Gegenwart. Hier liegt der Plan in der Vergangenheit.', 'Are belongs to the present. Here the plan lies in the past.'),
         (G, 'Went to bedeutet „ging zu“, nicht „wollte“.', 'Went to means “walked to”, not “planned to”.'),
         (G, 'Would to ist keine feste Form.', 'Would to is not a fixed form.')])
    mcc(T, 'fp.about-to', 'C1', 'biz', 0.0, 'I ___ close the file when the client called with a new request.',
        'was about to', ['was about', 'am about to', 'was to about'],
        ('Was about to heißt: kurz davor. When zeigt, was dazwischenkam.', 'Was about to means: just before. When shows what intervened.'),
        [(G, 'Nach about braucht es to und die Grundform.', 'After about you need to and the base form.'),
         (G, 'Am about to gehört in die Gegenwart.', 'Am about to belongs to the present.'),
         (G, 'To about stellt die Wörter um. Die feste Form heißt about to.', 'To about swaps the words. The fixed form is about to.')])
    mcc(T, 'fp.would-narr', 'C1', 'biz', 0.0, 'In 2016 he joined our Munich office and ___ later run the whole region.',
        'would', ['will', 'is going to', 'shall'],
        ('Aus der Vergangenheit auf Späteres blickst du mit would: he would later run the region.', 'To look from the past at something later you use would: he would later run the region.'),
        [(G, 'Will gehört in die Gegenwart.', 'Will belongs to the present.'),
         (G, 'Is going to gehört in die Gegenwart.', 'Is going to belongs to the present.'),
         (R, 'Shall wirkt hier altmodisch und passt nicht zur Erzählung.', 'Shall sounds old-fashioned here and does not fit the narrative.')])
    mcc(T, 'fp.was-to', 'C1', 'biz', 0.0, 'The merger ___ be completed by June, but the regulator asked for more time.',
        'was to', ['is to', 'was being to', 'were to'],
        ('Was to nennt, was vorgesehen war: The merger was to be completed.', 'Was to names what was meant to be: The merger was to be completed.'),
        [(G, 'Is to gehört in die Gegenwart.', 'Is to belongs to the present.'),
         (G, 'Was being to ist keine gültige Form.', 'Was being to is not a valid form.'),
         (G, 'Merger ist Singular, deshalb was, nicht were.', 'Merger is singular, so was, not were.')])
    mcc(T, 'fp.about-to', 'C1', 'life', 0.0, 'We ___ sit down for dinner when the neighbors rang the bell.',
        'were about to', ['were about', 'are about to', 'were to about'],
        ('Were about to heißt: kurz davor. When zeigt, was dazwischenkam.', 'Were about to means: just before. When shows what intervened.'),
        [(G, 'Nach about braucht es to und die Grundform.', 'After about you need to and the base form.'),
         (G, 'Are about to gehört in die Gegenwart.', 'Are about to belongs to the present.'),
         (G, 'To about stellt die Wörter um. Die feste Form heißt about to.', 'To about swaps the words. The fixed form is about to.')])
    mcc(T, 'fp.was-going', 'C1', 'life', 0.0, 'I ___ tell you about the surprise, but my sister already did.',
        'was going to', ['am going to', 'was go to', 'would to'],
        ('Was going to nennt den Plan von damals; but zeigt, dass es anders kam.', 'Was going to names the plan from back then; but shows it turned out differently.'),
        [(G, 'Am gehört in die Gegenwart.', 'Am belongs to the present.'),
         (G, 'Nach was steht going, nicht go.', 'After was comes going, not go.'),
         (G, 'Would to ist keine feste Form.', 'Would to is not a fixed form.')])

    ocl(T, 'fp.was-going', 'C1', 'biz', 0.0, 'The team was ___ to present the results on Monday, but the data was incomplete.',
        ['going', 'supposed', 'due', 'meant', 'scheduled', 'expected', 'planning', 'set'], 'part', ['go', 'went', 'gone'],
        ('Was going to nennt den Plan von damals.', 'Was going to names the plan from back then.'))
    ocl(T, 'fp.about-to', 'C1', 'biz', 0.0, 'The auditors were about ___ present their findings when the fire alarm went off.',
        ['to'], 'part', ['for', 'of', 'at'],
        ('Nach about steht to und die Grundform: about to sign.', 'After about comes to and the base form: about to sign.'))
    ocl(T, 'fp.would-narr', 'C1', 'biz', 0.0, 'She started as an intern in 2014 and ___ later become our head of design.',
        ['would'], 'aux', ['will', 'shall', 'is'],
        ('Aus der Vergangenheit auf Späteres: would later become.', 'From the past at something later: would later become.'))
    ocl(T, 'fp.was-to', 'C1', 'biz', 0.0, 'The new system was ___ go live in October, but testing took longer.',
        ['to'], 'part', ['for', 'at', 'on'],
        ('Was to nennt den Plan: was to go live.', 'Was to names the plan: was to go live.'))
    ocl(T, 'fp.would-narr', 'C1', 'life', 0.0, 'My grandparents moved to Hamburg in 1960, where they ___ later open a small bakery.',
        ['would'], 'aux', ['will', 'shall', 'are'],
        ('Aus der Vergangenheit auf Späteres: would later open.', 'From the past at something later: would later open.'))
    ocl(T, 'fp.was-to', 'C1', 'life', 0.0, 'The trip ___ to start on Friday, but the storm changed our plans.',
        ['was', 'had'], 'aux', ['is', 'has', 'be'],
        ('Was to nennt den Plan: The trip was to start on Friday.', 'Was to names the plan: The trip was to start on Friday.'))

    err(T, 'fp.was-going', 'C1', 'biz', 0.0, 'We are going to publish the report in March, but the board asked for changes.',
        ('are going to', ['were going to'], ['were going to', 'was going to', 'had going to']),
        ('Der Plan liegt in der Vergangenheit: were going to.', 'The plan lies in the past: were going to.'))
    err(T, 'fp.about-to', 'C1', 'biz', 0.0, 'The CEO was about announcing the merger when the news leaked.',
        ('about announcing', ['about to announce'], ['about to announce', 'about to announcing', 'about for announce']),
        ('Nach about steht to und die Grundform: about to announce.', 'After about comes to and the base form: about to announce.'))
    err(T, 'fp.would-narr', 'C1', 'biz', 0.0, 'The startup began with three people in 2015 and will later employ two hundred.',
        ('will later employ', ['would later employ', 'went on to employ', 'later employed'], ['would later employ', 'would later employs', 'is later employing']),
        ('Aus der Vergangenheit auf Späteres: would later employ.', 'From the past at something later: would later employ.'))
    err(T, 'fp.was-to', 'C1', 'biz', 0.0, 'The new director should join us in January, but she took another job.',
        ('should join', ['was to join', 'was supposed to join', 'was going to join', 'was due to join', 'should have joined'], ['was to join', 'was to joining', 'is to join']),
        ('Für einen Plan in der Vergangenheit gilt was to: was to join.', 'For a plan in the past was to is used: was to join.'))
    err(T, 'fp.about-to', 'C1', 'life', 0.0, 'I was about to leave the house when I noticed that the oven was still on.', None,
        ('Kein Fehler: Was about to + Grundform, dann kommt etwas dazwischen.', 'No mistake: was about to + base form, then something intervenes.'))
    err(T, 'fp.was-going', 'C1', 'life', 0.0, 'We were going to move to Lisbon, but the apartment prices changed our minds.', None,
        ('Kein Fehler: Were going to nennt den Plan von damals.', 'No mistake: were going to names the plan from back then.'))

    kwt(T, 'fp.was-going', 'C1', 'biz', 0.0, 'We planned to open a second office in Vienna, but the lease fell through.', 'GOING', 'We', 'a second office in Vienna, but the lease fell through.',
        [(['were going'], ['to open'])], ['were', 'to', 'open'], ['are', 'went', 'gone'], [],
        ('were going to open. Were going to nennt den Plan von damals.', 'were going to open. Were going to names the plan from back then.'), [])
    kwt(T, 'fp.about-to', 'C1', 'biz', 0.0, 'The team was on the point of submitting the report when the server crashed.', 'ABOUT', 'The team was', 'the report when the server crashed.',
        [(['about to'], ['submit'])], ['to', 'submit'], ['for', 'submitting', 'at'], [],
        ('was about to submit. Nach about steht to und die Grundform.', 'was about to submit. After about comes to and the base form.'), [])
    kwt(T, 'fp.would-narr', 'C1', 'biz', 0.0, 'He joined the firm in 2014 and became CFO six years later.', 'WOULD', 'He joined the firm in 2014 and', 'six years later.',
        [(['would'], ['become CFO'])], ['become', 'CFO'], ['will', 'became', 'is'], [],
        ('would become CFO. Aus der Vergangenheit auf Späteres blickt would.', 'would become CFO. Would looks from the past at something later.'), [])
    kwt(T, 'fp.was-to', 'C1', 'biz', 0.0, 'The conference had been planned for September, but a strike forced a delay.', 'WAS', 'The conference', 'in September, but a strike forced a delay.',
        [(['was to', 'was supposed to', 'was going to', 'was due to', 'was meant to', 'was scheduled to', 'was set to'], ['take place', 'be held'])], ['to', 'take', 'place'], ['should', 'is', 'were'], [],
        ('was to take place. Was to nennt das Vorgesehene.', 'was to take place. Was to names what was meant to be.'), [])
    kwt(T, 'fp.about-to', 'C1', 'life', 0.0, 'I almost fell asleep when the phone rang.', 'ABOUT', 'I was', 'when the phone rang.',
        [(['about to'], ['fall asleep'])], ['to', 'fall', 'asleep'], ['for', 'falling', 'at'], [],
        ('was about to fall asleep. Nach about steht to und die Grundform.', 'was about to fall asleep. After about comes to and the base form.'), [])
    kwt(T, 'fp.was-going', 'C1', 'life', 0.0, 'I intended to bake a cake for your birthday, but I ran out of time.', 'GOING', 'I', 'a cake for your birthday, but I ran out of time.',
        [(['was going'], ['to bake'])], ['was', 'to', 'bake'], ['am', 'went', 'gone'], [],
        ('was going to bake. Was going to nennt den Plan von damals.', 'was going to bake. Was going to names the plan from back then.'), [])

def place():
    mcc(T, 'fp.was-going', 'B2+', 'biz', -0.1, 'Last year we ___ expand into Spain, but the funding fell through.',
        'were going to', ['are going to', 'went to', 'would to'],
        ('Ein Plan von damals braucht were going to.', 'A plan from back then needs were going to.'),
        [(G, 'Are gehört in die Gegenwart.', 'Are belongs to the present.'),
         (G, 'Went to bedeutet „ging zu“, nicht „wollte“.', 'Went to means “walked to”, not “planned to”.'),
         (G, 'Would to ist keine feste Form.', 'Would to is not a fixed form.')])
    ocl(T, 'fp.about-to', 'C1', 'life', 0.0, 'My bus was just about ___ leave when I reached the stop.',
        ['to'], 'part', ['for', 'of', 'at'],
        ('Nach about steht to und die Grundform: about to leave.', 'After about comes to and the base form: about to leave.'))
