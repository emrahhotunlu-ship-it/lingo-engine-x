"""Britische Schreibweisen und Wörter → amerikanische Form (Atlas-Bereinigung, nur zur Entwicklung).

`SPELL`: reine Schreibvarianten; sie lassen sich im Beispielsatz sicher durch die US-Form ersetzen.
`LEX`:   britische Wörter/Wendungen ohne gleiche US-Form (telly, lorry, mum …); hier gibt es keine sichere
         automatische Ersetzung (flat, lift sind auch US-Wörter mit anderem Sinn). Der Beispielsatz wird
         als `exWeak` markiert, ein britisches Stichwort wird ausgeblendet (`hidden`).
"""
import re

SPELL = {
    'colour': 'color', 'colours': 'colors', 'coloured': 'colored', 'colourful': 'colorful', 'favour': 'favor', 'favours': 'favors',
    'favourite': 'favorite', 'favourites': 'favorites', 'favoured': 'favored', 'honour': 'honor', 'honours': 'honors',
    'honoured': 'honored', 'honourable': 'honorable', 'behaviour': 'behavior', 'behaviours': 'behaviors', 'neighbour': 'neighbor',
    'neighbours': 'neighbors', 'neighbourhood': 'neighborhood', 'neighbouring': 'neighboring', 'labour': 'labor', 'humour': 'humor',
    'rumour': 'rumor', 'rumours': 'rumors', 'flavour': 'flavor', 'flavours': 'flavors', 'harbour': 'harbor', 'savour': 'savor',
    'vapour': 'vapor', 'vigour': 'vigor', 'rigour': 'rigor', 'endeavour': 'endeavor', 'armour': 'armor', 'odour': 'odor',
    'splendour': 'splendor', 'parlour': 'parlor', 'candour': 'candor', 'clamour': 'clamor', 'fervour': 'fervor', 'glamour': 'glamor',
    'organisation': 'organization', 'organisations': 'organizations', 'organise': 'organize', 'organised': 'organized',
    'organises': 'organizes', 'organising': 'organizing', 'realise': 'realize', 'realised': 'realized', 'realises': 'realizes',
    'realising': 'realizing', 'recognise': 'recognize', 'recognised': 'recognized', 'recognises': 'recognizes', 'recognising': 'recognizing',
    'apologise': 'apologize', 'apologised': 'apologized', 'apologises': 'apologizes', 'criticise': 'criticize', 'criticised': 'criticized',
    'criticises': 'criticizes', 'emphasise': 'emphasize', 'emphasised': 'emphasized', 'emphasises': 'emphasizes', 'emphasising': 'emphasizing',
    'specialise': 'specialize', 'specialised': 'specialized', 'specialises': 'specializes', 'summarise': 'summarize', 'summarised': 'summarized',
    'minimise': 'minimize', 'minimised': 'minimized', 'maximise': 'maximize', 'maximised': 'maximized', 'modernise': 'modernize',
    'modernised': 'modernized', 'authorise': 'authorize', 'authorised': 'authorized', 'standardise': 'standardize', 'standardised': 'standardized',
    'finalise': 'finalize', 'finalised': 'finalized', 'utilise': 'utilize', 'utilised': 'utilized', 'prioritise': 'prioritize',
    'prioritised': 'prioritized', 'customise': 'customize', 'customised': 'customized', 'capitalise': 'capitalize', 'capitalised': 'capitalized',
    'civilisation': 'civilization', 'colonisation': 'colonization', 'computerised': 'computerized', 'demoralising': 'demoralizing',
    'demoralised': 'demoralized', 'globalisation': 'globalization', 'immunisation': 'immunization', 'industrialised': 'industrialized',
    'localised': 'localized', 'memorise': 'memorize', 'memorised': 'memorized', 'normalise': 'normalize', 'optimise': 'optimize',
    'optimised': 'optimized', 'popularise': 'popularize', 'privatised': 'privatized', 'sympathise': 'sympathize', 'sympathised': 'sympathized',
    'terrorised': 'terrorized', 'urbanisation': 'urbanization', 'visualise': 'visualize', 'analyse': 'analyze', 'analysed': 'analyzed',
    'analyses': 'analyzes', 'analysing': 'analyzing', 'paralyse': 'paralyze', 'paralysed': 'paralyzed',
    'centre': 'center', 'centres': 'centers', 'centred': 'centered', 'theatre': 'theater', 'theatres': 'theaters', 'metre': 'meter',
    'metres': 'meters', 'kilometre': 'kilometer', 'kilometres': 'kilometers', 'centimetre': 'centimeter', 'litre': 'liter', 'litres': 'liters',
    'fibre': 'fiber', 'calibre': 'caliber', 'sombre': 'somber', 'lustre': 'luster', 'manoeuvre': 'maneuver', 'spectre': 'specter',
    'programme': 'program', 'programmes': 'programs', 'cheque': 'check', 'cheques': 'checks', 'tyre': 'tire', 'tyres': 'tires', 'kerb': 'curb',
    'plough': 'plow', 'ploughed': 'plowed', 'grey': 'gray', 'greyish': 'grayish', 'aluminium': 'aluminum', 'jewellery': 'jewelry',
    'defence': 'defense', 'offence': 'offense', 'pretence': 'pretense', 'licence': 'license', 'licences': 'licenses', 'practise': 'practice',
    'practised': 'practiced', 'practising': 'practicing', 'ageing': 'aging', 'sceptic': 'skeptic', 'sceptical': 'skeptical', 'scepticism': 'skepticism',
    'travelled': 'traveled', 'travelling': 'traveling', 'traveller': 'traveler', 'travellers': 'travelers', 'cancelled': 'canceled',
    'cancelling': 'canceling', 'cancellation': 'cancellation', 'labelled': 'labeled', 'labelling': 'labeling', 'modelled': 'modeled',
    'modelling': 'modeling', 'fuelled': 'fueled', 'fuelling': 'fueling', 'counsellor': 'counselor', 'counselling': 'counseling',
    'marshalling': 'marshaling', 'levelled': 'leveled', 'signalling': 'signaling', 'channelled': 'channeled', 'dialled': 'dialed',
    'enrol': 'enroll', 'fulfil': 'fulfill', 'instalment': 'installment', 'skilful': 'skillful', 'wilful': 'willful', 'catalogue': 'catalog',
    'dialogue': 'dialog', 'whilst': 'while', 'amongst': 'among', 'learnt': 'learned', 'spelt': 'spelled', 'burnt': 'burned',
    'dreamt': 'dreamed', 'spoilt': 'spoiled', 'smelt': 'smelled', 'mould': 'mold', 'moult': 'molt', 'smoulder': 'smolder',
    'draught': 'draft', 'storey': 'story', 'pyjamas': 'pajamas', 'mum': 'mom', 'artefact': 'artifact', 'artefacts': 'artifacts',
    'judgement': 'judgment', 'acknowledgement': 'acknowledgment', 'sulphur': 'sulfur', 'maths': 'math', 
    'anaemia': 'anemia', 'oestrogen': 'estrogen', 'foetus': 'fetus', 'diarrhoea': 'diarrhea', 'encyclopaedia': 'encyclopedia',
    'paediatric': 'pediatric', 'gaol': 'jail', 'tonne': 'ton', 'cosy': 'cozy', 'cosily': 'cozily', 'moustache': 'mustache', 'tranquillity': 'tranquility',
    'speciality': 'specialty', 'towards': 'toward', 'afterwards': 'afterward', 'backwards': 'backward',
}
# `dialogue`, `catalogue`, `towards`, `afterwards`, `backwards`, `cancellation` sind auch im US-Englisch geläufig: nie umschreiben.
KEEP_US_OK = {'dialogue', 'catalogue', 'towards', 'afterwards', 'backwards', 'cancellation', 'learnt', 'spelt', 'burnt', 'dreamt', 'smelt', 'spoilt', 'speciality'}
SPELL = {k: v for k, v in SPELL.items() if k not in KEEP_US_OK and k != v}

LEX = ['telly', 'lorry', 'lorries', 'petrol', 'biscuit', 'biscuits', 'trousers', 'colleague-', 'autumn', 'holiday', 'holidays', 'flat', 'flats', 'lift', 'lifts',
       'mobile phone', 'rubbish', 'queue', 'queues', 'queued', 'queuing', 'chips', 'crisps', 'sweets', 'bin', 'bins', 'dustbin', 'boot', 'bonnet', 'pavement',
       'motorway', 'tube', 'underground', 'garden', 'gardens', 'torch', 'nappy', 'nappies', 'cooker', 'jumper', 'trainers', 'tap', 'taps', 'fortnight', 'cinema',
       'university', 'maths', 'pounds', 'pound', 'bloke', 'blokes', 'mate', 'mates', 'cheers', 'quid', 'tea', 'pub', 'pubs', 'chemist', 'fancy dress']
# Nur sichere Brit-Wörter lösen eine Markierung aus; mehrdeutige (flat, lift, tap, garden …) stehen NICHT in diesem Satz.
LEX_SAFE = {'telly', 'lorry', 'lorries', 'petrol', 'dustbin', 'bonnet', 'pavement', 'motorway', 'nappy', 'nappies', 'fortnight', 'bloke', 'blokes',
            'quid', 'chemist', 'whilst', 'amongst', 'mum', 'mummy', 'queue', 'queues', 'queued', 'queuing', 'cooker', 'jumper', 'trainers', 'torch', 'rubbish', 'crisps', 'mobile phone'}

_TOK = re.compile(r"[A-Za-z]+(?:'[a-z]+)?")


def lex_hits(text: str) -> list[str]:
    low = text.lower()
    return [w for w in LEX_SAFE if re.search(r'(?<![a-z])' + re.escape(w) + r'(?![a-z])', low)]


OUR_STEMS = ('colour', 'odour', 'favour', 'honour', 'humour', 'neighbour', 'labour', 'flavour', 'rumour', 'harbour', 'vapour', 'behaviour')


def _us_word(low: str):
    if low in SPELL:
        return SPELL[low]
    for st in OUR_STEMS:
        if st in low:
            return low.replace(st, st.replace('our', 'or'))
    return None


def spell_hits(text: str) -> list[str]:
    return [t for t in _TOK.findall(text) if _us_word(t.lower())]


def to_us(text: str) -> str:
    def sub(m: re.Match) -> str:
        t = m.group(0)
        us = _us_word(t.lower())
        if not us:
            return t
        return us.capitalize() if t[:1].isupper() else us
    return _TOK.sub(sub, text)
