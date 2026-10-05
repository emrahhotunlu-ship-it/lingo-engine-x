#!/usr/bin/env python3
"""Baut src/content/atlas/atlas.json aus offenen Quellen (nur zur Entwicklung, läuft nie in der App).

Quellen (siehe docs/atlas-quellen.md):
  - wordfreq (Häufigkeit, CC BY-SA)            -> Auswahl und Rang
  - WordNet 3.1 (npm wordnet-db, Princeton)    -> Wortart, englische Erklärung
  - FreeDict eng-deu 1.9 (GPL-3)               -> deutsche Bedeutung
  - Tatoeba (CC BY 2.0 FR)                     -> Beispielsatz mit deutscher Übersetzung
Aufruf: SRC=/tmp/atl python3 scripts/atlas/build_atlas.py
"""
import bz2, json, os, re, sys, xml.etree.ElementTree as ET
from collections import defaultdict
from wordfreq import top_n_list, zipf_frequency

SRC = os.environ.get('SRC', '/tmp/atl')
OUT = os.environ.get('OUT', 'src/content/atlas/atlas.json')
SKIP_BELOW = 2500      # die häufigsten ~2.500 Wörter gelten als Grundwortschatz
MAX_RANK = int(os.environ.get('MAX_RANK', '30000'))
TARGET = 7600

# --- WordNet -----------------------------------------------------------
WN = f'{SRC}/wn/package/dict'
POS = {'noun': 'n', 'verb': 'v', 'adj': 'a', 'adv': 'r'}
POSNAME = {'noun': 'noun', 'verb': 'verb', 'adj': 'adjective', 'adv': 'adverb'}
wn_first = {}          # (lemma, pos) -> (gloss, capitalized_first_word)
def load_wn(pos):
    data = {}
    with open(f'{WN}/data.{pos}', encoding='utf8') as f:
        for line in f:
            if line.startswith('  '): continue
            head, _, gloss = line.partition('|')
            off = head.split()[0]
            words = head.split()[4]
            data[off] = (gloss.strip(), words)
    with open(f'{WN}/index.{pos}', encoding='utf8') as f:
        for line in f:
            if line.startswith('  '): continue
            p = line.split()
            lemma, cnt, ptrs = p[0], int(p[2]), int(p[3])
            offs = p[6 + ptrs:]
            if not offs: continue
            gloss, w1 = data[offs[0]]
            wn_first[(lemma, pos)] = (gloss, w1, cnt)
for p in POS: load_wn(p)

# --- FreeDict ------------------------------------------------------------
de = defaultdict(lambda: defaultdict(list))  # orth -> pos -> [quotes]
FDPOS = {'n': 'noun', 'v': 'verb', 'adj': 'adj', 'adv': 'adv'}
for ev, el in ET.iterparse(f'{SRC}/fd/eng-deu/eng-deu.tei'):
    if el.tag.endswith('entry'):
        orth = None; pos = None; quotes = []; has_gen = False
        for e in el.iter():
            t = e.tag.split('}')[-1]
            if t == 'orth' and orth is None: orth = (e.text or '').strip()
            elif t == 'pos' and pos is None: pos = (e.text or '').strip()
            elif t == 'quote': quotes.append((e.text or '').strip())
            elif t == 'gen': has_gen = True  # FreeDict kennzeichnet Nomen nur über das Geschlecht der Übersetzung
        if pos is None and has_gen: pos = 'n'
        if orth and ' ' not in orth and pos in FDPOS and quotes:
            de[orth.lower()][FDPOS[pos]] += [q for q in quotes if q]
        el.clear()

# --- Tatoeba ---------------------------------------------------------------
def tsv(path):
    with bz2.open(path, 'rt', encoding='utf8') as f:
        for line in f:
            yield line.rstrip('\n').split('\t')
eng = {r[0]: r[2] for r in tsv(f'{SRC}/eng_sentences.tsv.bz2') if len(r) >= 3}
deu = {r[0]: r[2] for r in tsv(f'{SRC}/deu_sentences.tsv.bz2') if len(r) >= 3}
pairs = {}
for r in tsv(f'{SRC}/eng-deu_links.tsv.bz2'):
    if len(r) >= 2 and r[0] in eng and r[1] in deu:
        pairs.setdefault(r[0], deu[r[1]])
TOK = re.compile(r"[A-Za-z']+")
by_word = defaultdict(list)
for sid, de_s in pairs.items():
    s = eng[sid]
    n = len(s.split())
    if not (6 <= n <= 16) or not s[0].isupper() or s[-1] not in '.?!' or '"' in s or '"' in de_s: continue
    for w in set(t.lower() for t in TOK.findall(s)):
        by_word[w].append((n, s, de_s))

# --- Auswahl ---------------------------------------------------------------
existing = set()
for fn in ('src/content/c1/pack.json',):
    for it in json.load(open(fn))['items']: existing.add(it['en'].lower())
out = []
seen = set()
for rank, w in enumerate(top_n_list('en', 60000)):
    if rank < SKIP_BELOW: continue
    if len(out) >= TARGET or rank > MAX_RANK: break
    if not re.fullmatch(r'[a-z]{4,}', w) or w in existing or w in seen: continue
    # beste Wortart: die mit WordNet-Eintrag UND deutscher Bedeutung
    pick = None
    for pos in ('noun', 'verb', 'adj', 'adv'):
        g = wn_first.get((w, pos))
        if not g: continue
        if g[1][:1].isupper(): continue  # Eigenname
        # Sinn-Sicherheit: nur Wörter mit EINER Bedeutung (WordNet) oder mit Beleg im Beispielsatz
        qs = de.get(w, {}).get(POSNAME[pos] if pos != 'adj' else 'adj') if False else de.get(w, {}).get({'noun': 'noun', 'verb': 'verb', 'adj': 'adj', 'adv': 'adv'}[pos])
        if not qs: continue
        pick = (pos, g, qs); break
    if not pick: continue
    pos, (gloss, _, scnt), qs = pick
    gl = gloss.split(';')[0].strip()
    gl = re.sub(r'\s+', ' ', gl)
    if len(gl) < 5 or len(gl) > 160: continue
    # Sinn-Prüfung: Beispielsatz nötig, und eine deutsche Bedeutung muss in seiner Übersetzung vorkommen
    cands = sorted(by_word.get(w, []))
    chosen = None
    for _, ex, exd in cands:
        low = exd.lower()
        hit = []
        for q in qs:
            q0 = re.sub(r'\s*\(.*?\)\s*', ' ', q).strip()
            if not q0 or len(q0) > 40 or '"' in q0: continue
            toks = [t for t in re.findall(r'[a-zäöüß]+', q0.lower()) if len(t) >= 4 and t not in ('jdn', 'etw', 'jemanden', 'jemandem', 'etwas', 'sich')]
            if any(t[:max(4, len(t) - 2)] in low for t in toks): hit.append(q0)
        if hit:
            chosen = (ex, exd, hit); break
    if not chosen:
        # eindeutiges Wort (eine Bedeutung): die deutsche Bedeutung ist sicher, Beispielsatz nur wenn vorhanden
        if scnt != 1 or len(qs) > 4: continue
        ex, exd = (cands[len(cands) // 3][1], cands[len(cands) // 3][2]) if cands else ('', '')
        hit = []
        verified = 0
    else:
        ex, exd, hit = chosen
        verified = 1
    ds = []
    for q in hit + [re.sub(r'\s*\(.*?\)\s*', ' ', q).strip() for q in qs]:
        if q and q.lower() not in [d.lower() for d in ds] and len(q) <= 40 and '"' not in q: ds.append(q)
        if len(ds) == 2: break
    if not ds: continue
    seen.add(w)
    out.append({'w': w, 'p': POSNAME[pos], 'd': ', '.join(ds), 'g': gl, 'x': ex, 'xd': exd, 'r': rank, 'v': verified})

os.makedirs('src/content/atlas', exist_ok=True)
json.dump({'v': 1, 'items': out}, open(OUT, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'Einträge;', sum(1 for o in out if o['x']), 'mit Beispielsatz;', os.path.getsize(OUT) // 1024, 'KB')
