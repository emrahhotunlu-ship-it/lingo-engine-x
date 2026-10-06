#!/usr/bin/env python3
"""Fügt die Zusatzfelder (col, gap, trap, fam, alt, scene, starts) in src/content/c1/pack.json ein (nur zur Entwicklung).

Aufruf: python3 scripts/pack/merge_extras.py <ordner-mit-json-dateien>
Jede Datei: {"<id>": {col, gap, fam, alt, scene, starts, flag?}}. Bestehende Felder werden nie verändert oder entfernt.
Ungültige Felder werden NICHT übernommen und berichtet. `trap` wird aus dem Fallen-Index (src/content/nb/trapIndex.ts) abgeleitet.
"""
import glob, json, os, re, sys

PACK = 'src/content/c1/pack.json'
TOK = re.compile(r"[A-Za-z][A-Za-z'-]*")
BAD = re.compile(r'["\[\]]')


def toks(s): return [t.lower() for t in TOK.findall(s)]


def stem(t): return t[:5] if len(t) >= 6 else t


def check(e, x, why):
    out = {}
    cat, en = e['cat'], e['en']
    et = toks(en)
    def ok_text(*ss):
        return all(isinstance(s, str) and not BAD.search(s) for s in ss)
    c = x.get('col')
    if isinstance(c, list) and 2 <= len(c) <= 3 and all(isinstance(i, dict) and ok_text(i.get('en'), i.get('ex', '')) and 2 <= len(i['en']) <= 40 and len(i.get('ex', 'x' * 8)) >= 8 and len(i.get('ex', '')) <= 140 and i['en'].lower() != en.lower() for i in c):
        out['col'] = [{'en': i['en'].strip(), **({'ex': i['ex'].strip()} if i.get('ex') else {})} for i in c]
    else: why.append('col')
    g = x.get('gap')
    if g is not None:
        if cat in ('colloc', 'phrasal') and isinstance(g, dict) and g.get('at', '').lower() in et and isinstance(g.get('wrong'), list) and 1 <= len(g['wrong']) <= 3 and ok_text(*g['wrong']) and all(w.lower() not in et and w.lower() != g['at'].lower() for w in g['wrong']):
            out['gap'] = {'at': g['at'], 'wrong': [w.strip() for w in g['wrong']]}
        else: why.append('gap')
    elif cat in ('colloc', 'phrasal'): why.append('gap-fehlt')
    f = x.get('fam')
    if f:
        f = {k: v for k, v in f.items() if k in ('noun', 'verb', 'adj', 'adv') and isinstance(v, str) and 2 <= len(v) <= 30 and ok_text(v)}
        if f: out['fam'] = f
    a = x.get('alt')
    if a:
        a = [s.strip() for s in a if isinstance(s, str) and ok_text(s) and 2 <= len(s.strip()) <= 40 and s.strip().lower() != en.lower()][:4]
        if a: out['alt'] = a
    s = x.get('scene')
    if s is not None:
        bad = not (isinstance(s, dict) and ok_text(s.get('de'), s.get('en')) and 3 <= len(s['de']) <= 220 and 3 <= len(s['en']) <= 220)
        if not bad:
            sset = {stem(t) for t in toks(s['en'])}
            keys = [stem(t) for t in et if len(t) >= 4]
            if en.lower() in s['en'].lower() or any(k in sset for k in keys): bad = True
        if bad: why.append('scene')
        else: out['scene'] = {'de': s['de'].strip(), 'en': s['en'].strip()}
    elif cat in ('colloc', 'frame', 'phrasal', 'idiom'): why.append('scene-fehlt')
    st = x.get('starts')
    if st is not None:
        keys = [stem(t) for t in et if len(t) >= 4] or [et[0]]
        if isinstance(st, list) and len(st) == 2 and all(isinstance(i, str) and ok_text(i) and 8 <= len(i.strip()) <= 70 and not any(k in {stem(t) for t in toks(i)} for k in keys) for i in st):
            out['starts'] = [i.strip().rstrip('.') for i in st]
        else: why.append('starts')
    elif cat in ('word', 'tech', 'family'): why.append('starts-fehlt')
    return out


def main():
    d = sys.argv[1]
    extra = {}
    for fn in sorted(glob.glob(os.path.join(d, '*.json'))):
        extra.update(json.load(open(fn, encoding='utf8')))
    pack = json.load(open(PACK, encoding='utf8'))
    flags, bad = [], {}
    n = 0
    for e in pack['items']:
        x = extra.get(e['id'])
        if x is None: bad[e['id']] = ['ganz']; continue
        why = []
        for k, v in check(e, x, why).items():
            if k not in e: e[k] = v
        if x.get('flag'): flags.append((e['id'], x['flag']))
        if why: bad[e['id']] = why
        n += 1
    json.dump(pack, open(PACK, 'w', encoding='utf8'), ensure_ascii=False, indent=2)
    open(PACK, 'a').write('\n')
    print('übernommen', n, 'von', len(pack['items']), '; mit Beanstandung', len(bad))
    json.dump({'bad': bad, 'flags': flags}, open(os.path.join(d, 'report.json'), 'w'), ensure_ascii=False, indent=1)


main()
