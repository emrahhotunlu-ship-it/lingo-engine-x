"""Hilfen für die Themen-Module (P36/P37): Muster, Regelblatt, LP2-Teile (v2, Satzbau)."""
import re

def B(de, en):
    return {'de': de, 'en': en}

def pattern(id, name, form, use, signals, ex, trap, contrast, ccq, nudge):
    """name/form/use/nudge = (de, en); ex = [(en, de, ctx)], trap = (bad, good, cause_de, cause_en),
    contrast = (with, a, b, diff_de, diff_en) | None, ccq = [(s, q_de, q_en, a)]"""
    p = {
        'id': id, 'name': B(*name), 'form': B(*form), 'use': B(*use), 'signals': signals,
        'ex': [{'en': e, 'de': d, 'ctx': c} for e, d, c in ex],
        'trap': {'bad': trap[0], 'good': trap[1], 'cause': B(trap[2], trap[3])},
    }
    if contrast:
        p['contrast'] = {'with': contrast[0], 'a': contrast[1], 'b': contrast[2], 'diff': B(contrast[3], contrast[4])}
    p['ccq'] = [{'s': s, 'q': B(qd, qe), 'a': a} for s, qd, qe, a in ccq]
    p['nudge'] = B(*nudge)
    return p

def topic_file(topic, can_do, patterns, intro_plan, decide):
    ids = [p['id'] for p in patterns]
    return {
        'topic': topic, 'canDo': B(*can_do), 'order': ids, 'introPlan': intro_plan,
        'decide': {'de': decide[0], 'en': decide[1]}, 'patterns': patterns,
    }

class V2:
    def __init__(self, code):
        self.code = code
        self.items = []
        self.n = {'k': 0, 'f': 0, 'm': 0}

    def _id(self, t):
        self.n[t] += 1
        return f'{self.code}-{t}{self.n[t]}'

    def kwt(self, pat, frm, key, frame, answer, words, ok, rules, accepted=()):
        wrong = [{'not': [key.lower()], 'de': f'Das Schlüsselwort {key.lower()} muss unverändert in der Lücke stehen.', 'en': f'The key word {key.lower()} must stay unchanged in the gap.'}]
        for r in rules:
            wrong.append(r)
        self.items.append({'id': self._id('k'), 'type': 'kwt', 'pat': pat, 'from': frm, 'key': key, 'frame': frame, 'answer': answer, 'accepted': list(accepted), 'words': list(words),
                           'why': {'ok': B(*ok), 'wrong': wrong}})

    def find(self, pat, prompt, err, answer, fixed, ok, hint):
        """err = (a, b) | None; hint = (de, en) Kurzerklärung für die Rückmeldungen."""
        if err is None:
            wrong = [{'tap': '*', 'de': f'Hier ist alles richtig: {hint[0]}', 'en': f'Everything is right here: {hint[1]}'}]
            self.items.append({'id': self._id('f'), 'type': 'find', 'pat': pat, 'prompt': prompt, 'err': None, 'accepted': [], 'why': {'ok': B(*ok), 'wrong': wrong}})
            return
        wrong = [{'tap': 'none', 'de': f'Doch, hier steckt ein Fehler: {hint[0]}', 'en': f'There is an error: {hint[1]}'},
                 {'tap': '*', 'de': f'Der Fehler liegt woanders: {hint[0]}', 'en': f'The error is elsewhere: {hint[1]}'}]
        self.items.append({'id': self._id('f'), 'type': 'find', 'pat': pat, 'prompt': prompt, 'err': list(err), 'answer': answer, 'fixed': fixed, 'accepted': [], 'why': {'ok': B(*ok), 'wrong': wrong}})

    def meaning(self, pat, a, b, q, answer, ok, wrong):
        """wrong = [(opt, de, en)]"""
        self.items.append({'id': self._id('m'), 'type': 'meaning', 'pat': pat, 'a': a, 'b': b, 'q': B(*q), 'answer': answer,
                           'why': {'ok': B(*ok), 'wrong': [{'opt': o, 'de': d, 'en': e} for o, d, e in wrong]}})

def order_item(pat, en, de, chunks, ok, bad, trap, alt=None, single=None):
    o = {'pat': pat, 'en': en, 'de': de, 'chunks': chunks}
    if alt:
        o['alt'] = alt
    else:
        o['single'] = single
    o['why'] = list(ok)
    o['bad'] = bad
    o['trap'] = {'tile': trap[0], 'instead': trap[1], 'why': B(trap[2], trap[3])}
    return o

def rules_from(patterns, core, why, contrast, steps):
    """Regelblatt im Format von toolkit.json/rules aus den Mustern ableiten.
    core/why/contrast = (de, en); steps = (list_de, list_en)."""
    forms = []
    for p in patterns:
        forms.append([[p['name']['de'].split('·')[0].strip(), p['name']['en'].split('·')[0].strip()], p['form']['en'], p['ex'][0]['en']])
    signals = []
    for p in patterns:
        s = p['signals']
        signals.append([' / '.join(s[:2]), [p['name']['de'].split('·')[0].strip(), p['name']['en'].split('·')[0].strip()]])
    traps = [{'bad': p['trap']['bad'], 'good': p['trap']['good'], 'why': [p['trap']['cause']['de'], p['trap']['cause']['en']]} for p in patterns[:4]]
    return {'core': list(core), 'why': list(why), 'contrast': list(contrast), 'steps': [list(steps[0]), list(steps[1])], 'forms': forms, 'signals': signals, 'traps': traps}
