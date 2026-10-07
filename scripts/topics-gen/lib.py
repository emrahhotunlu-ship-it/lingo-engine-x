import json, os
STAGE = {'B2': 0.0, 'B2+': 0.5, 'C1': 1.0}
FMT = {'mcc': -0.4, 'ocl': 0.0, 'err': 0.3, 'kwt': 0.6}

class Ctx:
    def __init__(self, base, place):
        self.out = {'mcc': [], 'ocl': [], 'err': [], 'kwt': []}
        self.count = {k: base for k in self.out}
        self.pos = 0
        self.place = place

CTX = Ctx(400, True)

def use(base, place):
    global CTX
    CTX = Ctx(base, place)
    return CTX

def bval(kind, level, adj):
    return round(STAGE[level] + FMT[kind] + adj, 2)

def base(kind, topic, pat, level, dom, adj, why_ok, why_wrong):
    CTX.count[kind] += 1
    it = {
        'id': f'{kind}-{CTX.count[kind]:04d}', 'kind': kind, 'area': 'gram', 'topic': topic,
        'level': level, 'dom': dom, 'src': 'seed',
    }
    if CTX.place:
        it['pool'] = 'place'
        it['b'] = bval(kind, level, adj)
    it['pat'] = pat
    it['why'] = {'ok': {'de': why_ok[0], 'en': why_ok[1]}, 'wrong': why_wrong}
    return it

def mcc(topic, pat, level, dom, adj, text, right, wrongs, ok, wr):
    assert len(wrongs) == 3 and len(wr) == 3, text
    it = base('mcc', topic, pat, level, dom, adj, ok, [{'opt': o, 'cat': c, 'de': d, 'en': e} for o, (c, d, e) in zip(wrongs, wr)])
    pos = CTX.pos % 4
    CTX.pos += 1
    opts = list(wrongs)
    opts.insert(pos, right)
    it.update({'text': text, 'options': opts, 'answer': pos})
    CTX.out['mcc'].append(it)

def ocl(topic, pat, level, dom, adj, text, accept, cls, chips, ok, wr=()):
    wr = list(wr)
    if not wr:
        # Begründung je Chip: sagt knapp, warum der Chip nicht passt und was gesucht ist (die Kernbegründung steht in why.ok).
        for c in chips:
            wr.append({'if': [c], 'de': f'„{c}“ passt hier nicht. Gesucht ist „{accept[0]}“.', 'en': f'“{c}” does not fit here. The word needed is “{accept[0]}”.'})
    it = base('ocl', topic, pat, level, dom, adj, ok, [dict(w) for w in wr])
    it.update({'text': text, 'accept': accept, 'cls': cls, 'chips': chips})
    CTX.out['ocl'].append(it)

def err(topic, pat, level, dom, adj, text, bad, ok, wr=()):
    it = base('err', topic, pat, level, dom, adj, ok, [dict(w) for w in wr])
    if bad is None:
        it['bad'] = None
    else:
        span, fix, choices = bad[:3]
        b = {'span': span, 'fix': fix, 'choices': choices}
        if len(bad) > 3 and bad[3]:
            b['nth'] = bad[3]
        it['bad'] = b
    it['text'] = text
    CTX.out['err'].append(it)

def kwt(topic, pat, level, dom, adj, lead, key, before, after, keys, tiles, extra, traps, ok, wr):
    it = base('kwt', topic, pat, level, dom, adj, ok, [dict(w) for w in wr])
    it.update({'lead': lead, 'key': key, 'before': before, 'after': after, 'keys': [{'a': a, 'b': b} for a, b in keys], 'tiles': tiles, 'extra': extra, 'traps': traps})
    CTX.out['kwt'].append(it)

def W(if_, de, en, not_=None, cat=None):
    d = {'if': if_}
    if not_: d['not'] = not_
    d['de'] = de; d['en'] = en
    return d

def dump(path, obj, indent=1, nl=True):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(obj, f, ensure_ascii=False, indent=indent)
        if nl:
            f.write('\n')

def write_place(root, prefix):
    items = []
    for kind in ('mcc', 'ocl', 'err', 'kwt'):
        items += CTX.out[kind]
    dump(f'{root}/place/{prefix}.json', {'v': 1, 'items': items})

def write_kinds(root, prefix):
    for kind, items in CTX.out.items():
        if items:
            dump(f'{root}/{kind}/{prefix}.json', {'v': 1, 'items': items})
