"""Schritt 3: Lernstoff-Bank zusammenbauen → src/content/bank/words.json

Führt zusammen:
- Kandidaten mit Häufigkeitsrang (01_candidates.py),
- Wiktionary-Auszug (02_kaikki.py): deutsche Bedeutung, englische Definition, US-Lautschrift,
  Synonyme, Wortfamilie,
- Tatoeba-Satzpaare Englisch–Deutsch (manythings.org/anki deu-eng, CC BY 2.0 FR) als Beispielsätze,
- Kontrollwörter (Pseudowörter) für den Wortschatz-Test.
Aufruf: python3 scripts/bank/03_build.py <cache-ordner>
"""
import csv, json, os, re, sys
from collections import defaultdict
from wordfreq import zipf_frequency

cache = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
out_dir = os.path.join(root, "src", "content", "bank")
os.makedirs(out_dir, exist_ok=True)

cands = json.load(open(os.path.join(cache, "candidates.json")))
rank = {c["w"]: c["rank"] for c in cands}
POS_SHORT = {"noun": "n", "verb": "v", "adj": "adj", "adv": "adv", "prep": "prep", "conj": "conj", "pron": "pron",
             "det": "det", "num": "num", "intj": "intj", "phrase": "phr", "prep_phrase": "phr", "particle": "part", "article": "det"}
FUNCTION_POS = {"prep", "conj", "pron", "det", "article", "particle", "num", "intj"}

# ---------- Wiktionary ----------
entries = defaultdict(list)
# kaikki2.jsonl (je Wort geholt, vollständige Übersetzungen) hat Vorrang vor dem Gesamtexport.
kfile = "kaikki2.jsonl" if os.path.exists(os.path.join(cache, "kaikki2.jsonl")) else "kaikki.jsonl"
for line in open(os.path.join(cache, kfile), encoding="utf-8"):
    e = json.loads(line)
    entries[e["w"]].append(e)

BAD_DE = re.compile(r"[\[\]{}<>=|]|^-|-$")


def german_groups(e):
    groups, order = defaultdict(list), []
    for t in e["de"]:
        w = t["w"].strip()
        if not w or len(w) > 40 or BAD_DE.search(w):
            continue
        s = t.get("s", "")
        if s not in groups:
            order.append(s)
        if w not in groups[s]:
            groups[s].append(w)
    return [(s, groups[s]) for s in order]


STOP_DE = {"sich", "der", "die", "das", "den", "dem", "ein", "eine", "einen", "etw", "etwas", "jdn", "jdm", "jds", "jemanden",
           "jemandem", "jemandes", "zu", "in", "an", "auf", "mit", "von", "für", "um", "über"}


def de_core(t):
    return [x for x in re.findall(r"[A-Za-zÄÖÜäöüß]+", t) if x.lower() not in STOP_DE]


def de_ok(t):
    """Standarddeutsch und gebräuchlich (filtert Dialekt, alte Schreibung, Kuriositäten)."""
    c = de_core(t)
    return bool(c) and min(zipf_frequency(x, "de") for x in c) >= 1.8


# Falsche Freunde: Diese deutschen Wörter sind gerade NICHT die Bedeutung des englischen Worts.
FALSE_FRIENDS = {"actual": {"aktuell"}, "actually": {"aktuell"}, "eventually": {"eventuell"}, "become": {"bekommen", "stehen"},
                 "sensible": {"sensibel"}, "gift": {"Gift"}, "brave": {"brav"}, "consequent": {"konsequent"},
                 "sympathetic": {"sympathisch"}, "ordinary": {"ordinär"}, "fabric": {"Fabrik"}, "chef": {"Chef"},
                 "handy": {"Handy"}, "also": {"also"}, "meaning": {"Meinung"}, "map": {"Mappe"}, "art": {"Art"},
                 "spend": {"spenden"}, "billion": {"Billion"}, "concur": {"konkurrieren"}, "undertaker": {"Unternehmer"},
                 "provision": {"Provision"}, "rate": {"Rat"}, "irritate": {"irritieren"}, "dome": {"Dom"}, "chips": {"Chips"},
                 "sea": {"See"}, "self-conscious": {"selbstbewusst"}, "public viewing": {"Public Viewing"}, "oldtimer": {"Oldtimer"}}


def de_stems(t):
    return [x.lower()[: max(4, len(x) - 2)] for x in de_core(t)]


def ranked_german(e, german_sides):
    """Übersetzungen eines Eintrags, nach Gebrauch in echten Satzpaaren und Häufigkeit sortiert."""
    seen, out = set(FALSE_FRIENDS.get(e["w"], ())), []
    flat = [(s, w) for s, ws in german_groups(e) for w in ws]
    words = {w for _, w in flat}
    for i, (s, w) in enumerate(flat):
        if w in seen or not de_ok(w):
            continue
        if "ß" in w and w.replace("ß", "ss") in words:
            continue
        seen.add(w)
        st = de_stems(w)
        hits = sum(1 for g in german_sides if all(x in g for x in st)) if st else 0
        z = min(zipf_frequency(x, "de") for x in de_core(w))
        out.append({"w": w, "s": s, "score": hits + 0.3 * z - 0.01 * i, "hits": hits})
    out.sort(key=lambda x: -x["score"])
    return out


def clean_ipa(ipa):
    ipa = re.sub(r"\([^)]*\)", "", ipa)
    for a, b in [(".", ""), ("͡", ""), ("ɹ", "r"), ("ɚ", "ər"), ("ɝ", "ɜr"), ("̩", ""), ("̯", ""), ("ɫ", "l"), ("ɾ", "t")]:
        ipa = ipa.replace(a, b)
    return ipa.strip()


def us_ipa(e):
    best = None
    for s in e["ipa"]:
        tags = " ".join(s["t"])
        ipa = s["i"]
        if not ipa.startswith("/"):
            continue
        if "US" in tags or "General-American" in tags:
            return ipa.strip("/")
        if best is None and "Received-Pronunciation" not in tags and "UK" not in tags:
            best = ipa.strip("/")
    if best is None and e["ipa"]:
        first = e["ipa"][0]["i"]
        if first.startswith("/"):
            best = first.strip("/")
    return best


def clean_gloss(g):
    g = re.sub(r"\s+", " ", g).strip()
    return g if len(g) <= 140 else g[:137].rsplit(" ", 1)[0] + " …"


# ---------- Wortformen ----------
forms = defaultdict(set)  # Form -> Lemmata


def add_form(form, lemma):
    form = form.strip().lower()
    if re.fullmatch(r"[a-z][a-z'-]*", form):
        forms[form].add(lemma)


for name in ["NGSL_12_lemmatized_for_teaching.csv", "NAWL_12_lemmatized_for_teaching.csv",
             "BSL_120_lemmatized_for_teaching.csv", "TSL_12_lemmatized_for_teaching.csv"]:
    with open(os.path.join(cache, name), encoding="utf-8-sig", errors="replace") as f:
        for row in csv.reader(f):
            if not row or row[0].startswith("#"):
                continue
            lemma = row[0].strip().lower()
            for form in row:
                add_form(form, lemma)
for w, es in entries.items():
    if " " in w:
        continue
    add_form(w, w)
    for e in es:
        for f in e["forms"]:
            if " " not in f:
                add_form(f, w)

# ---------- Tatoeba ----------
BRIT = [("our", "or"), ("ise", "ize"), ("ised", "ized"), ("ising", "izing"), ("isation", "ization"), ("yse", "yze"), ("tre", "ter"), ("ogue", "og")]
BLOCK = {"kill", "killed", "kills", "killing", "suicide", "sex", "sexy", "drunk", "naked", "rape", "gun", "guns", "shot", "die", "died", "dead", "murder", "beer", "wine", "drug", "drugs", "hate", "stupid", "idiot", "god", "jesus", "hell", "damn", "fuck", "shit"}
TOKEN = re.compile(r"[A-Za-z][A-Za-z'-]*")


def british(tok):
    if tok in rank:
        return False
    for b, a in BRIT:
        if tok.endswith(b) and (tok[: -len(b)] + a) in rank:
            return True
    return tok in {"grey", "mum", "tyre", "cheque", "programme", "aeroplane", "colour", "favourite", "travelled", "cancelled", "jewellery", "pyjamas", "maths", "practise", "licence", "defence", "offence"}


pairs, seen = [], set()
for line in open(os.path.join(cache, "deu.txt"), encoding="utf-8"):
    parts = line.rstrip("\n").split("\t")
    if len(parts) < 2:
        continue
    en, de = parts[0].strip(), parts[1].strip()
    if en in seen or len(en) > 140:
        continue
    seen.add(en)
    toks = [t.lower() for t in TOKEN.findall(en)]
    if len(toks) < 5 or len(toks) > 18 or any(t in BLOCK for t in toks) or any(british(t) for t in toks):
        continue
    pairs.append((en, de, toks))
print("tatoeba pairs", len(pairs), file=sys.stderr)

lemma_rank = lambda l: rank.get(l, 30000)
by_lemma = defaultdict(list)
for idx, (en, de, toks) in enumerate(pairs):
    lemmas_per_tok = [forms.get(t, set()) for t in toks]
    hardest = max((min(lemma_rank(l) for l in ls) for ls in lemmas_per_tok if ls), default=0)
    unknown = sum(1 for t, ls in zip(toks, lemmas_per_tok) if not ls and not t[0].isupper())
    for ls in lemmas_per_tok:
        for l in ls:
            if len(by_lemma[l]) < 400:
                by_lemma[l].append((idx, hardest, unknown))


def pick_examples(lemma):
    r = lemma_rank(lemma)
    scored = []
    for idx, hardest, unknown in by_lemma.get(lemma, []):
        n = len(pairs[idx][2])
        score = -abs(n - 11) - 3 * unknown - (0 if hardest <= max(r, 3000) else 4)
        scored.append((score, idx))
    scored.sort(reverse=True)
    out, starts = [], set()
    for _, idx in scored:
        en, de, toks = pairs[idx]
        if toks[0] in starts:
            continue
        starts.add(toks[0])
        out.append([en, de])
        if len(out) == 3:
            break
    return out


# ---------- Lerner-Definitionen und US-Lautschrift ----------
import openpyxl
learner_def = {}
for fname in ["ngsl_def.xlsx", "tsl_def.xlsx"]:
    fp = os.path.join(cache, fname)
    if os.path.exists(fp):
        for i, r in enumerate(openpyxl.load_workbook(fp, read_only=True).worksheets[0].iter_rows(values_only=True)):
            if i and r[0] and r[1]:
                learner_def.setdefault(str(r[0]).strip().lower(), str(r[1]).strip())
with open(os.path.join(cache, "NAWL_12_with_en_definitions.csv"), encoding="utf-8-sig", errors="replace") as f:
    for i, row in enumerate(csv.reader(f)):
        if i and len(row) > 1 and row[0] and row[1]:
            learner_def.setdefault(row[0].strip().lower(), row[1].strip())
cmu_ipa = json.load(open(os.path.join(cache, "us-ipa.json"), encoding="utf-8"))  # CMU, US (aus git show cd82ca3:src/content/pron/us-ipa.json)


def german_sides_of(lemma):
    return [pairs[idx][1].lower() for idx, _, _ in by_lemma.get(lemma, [])]


def best_gloss(e, sense_hint):
    hint = set(re.findall(r"[a-z]+", sense_hint.lower()))
    best, best_n = e["senses"][0]["g"], 0
    for sn in e["senses"]:
        n = len(hint & set(re.findall(r"[a-z]+", sn["g"].lower())))
        if n > best_n:
            best, best_n = sn["g"], n
    return best


# ---------- Bank ----------
def make_id(w):
    w = re.sub(r"^to ", "", w.lower())
    return re.sub(r"[^a-z0-9]+", "-", w).strip("-")


words, missing = [], 0
for c in cands:
    w = c["w"]
    es = entries.get(w, [])
    with_de = [e for e in es if german_groups(e)]
    if not with_de:
        missing += 1
        continue
    sides = german_sides_of(w)
    ranked = [(e, ranked_german(e, sides)) for e in with_de]
    ranked = [(e, r) for e, r in ranked if r]
    if not ranked:
        missing += 1
        continue
    ranked.sort(key=lambda er: -er[1][0]["score"])
    prim, prim_tr = ranked[0]
    if prim["pos"] in FUNCTION_POS and c["rank"] < 400:
        continue  # Funktionswörter wie "the", "of": kein Lernstoff
    de = ", ".join(t["w"] for t in prim_tr[:3])
    en = learner_def.get(w)
    if not en or (en.lower().startswith("to ") and prim["pos"] != "verb"):
        en = best_gloss(prim, prim_tr[0]["s"])
    item = {"i": make_id(w), "w": w, "p": POS_SHORT.get(prim["pos"], prim["pos"]), "r": c["rank"], "l": c["lists"], "de": de,
            "en": clean_gloss(en)}
    alt = []
    for e, tr in ranked[1:]:
        if e["pos"] != prim["pos"] and len(alt) < 2 and not any(a["p"] == POS_SHORT.get(e["pos"], e["pos"]) for a in alt):
            alt.append({"p": POS_SHORT.get(e["pos"], e["pos"]), "de": ", ".join(t["w"] for t in tr[:2]), "en": clean_gloss(best_gloss(e, tr[0]["s"]))})
    if alt:
        item["m"] = alt
    ipa = cmu_ipa.get(w) or clean_ipa(us_ipa(prim) or next((us_ipa(e) for e in es if us_ipa(e)), None) or "")
    if ipa:
        item["ipa"] = ipa
    ex = pick_examples(w)
    if not ex:
        wex = [x for e in es for s in e["senses"] for x in s["ex"] if w in x.lower()][:1]
        ex = [[x, ""] for x in wex]
    if ex:
        item["ex"] = ex
    syn = [s for s in prim["syn"] if s in rank and s != w and " " not in s][:4]
    if syn:
        item["syn"] = syn
    stem = w[: max(4, len(w) - 3)]
    fam = sorted({d for e in es for d in e["der"] if " " not in d and d.startswith(stem) and d != w and (d in rank or zipf_frequency(d, "en") >= 2.5)})[:4]
    if fam:
        item["fam"] = fam
    words.append(item)

# ---------- Phrasal Verbs ----------
phrasal = []
for w, es in entries.items():
    if " " not in w:
        continue
    with_de = [e for e in es if german_groups(e)]
    if not with_de:
        continue
    z = zipf_frequency(w, "en")
    if z < 2.6:
        continue
    verb, part = w.split(" ")
    pat = re.compile(r"\b(" + "|".join(sorted({f for f, ls in forms.items() if verb in ls} | {verb}, key=len, reverse=True)) + r")\s+" + part + r"\b", re.I)
    hits_ex = [(en, de) for en, de, _ in pairs if pat.search(en)]
    sides = [de.lower() for _, de in hits_ex[:300]]
    ranked = sorted(((e, ranked_german(e, sides)) for e in with_de), key=lambda er: -(er[1][0]["score"] if er[1] else -99))
    prim, tr = ranked[0]
    if not tr:
        continue
    ex = [[en, de] for en, de in hits_ex if 6 <= len(en.split()) <= 16][:3]
    item = {"i": make_id(w), "w": w, "p": "pv", "z": round(z, 2), "de": ", ".join(t["w"] for t in tr[:3]), "en": clean_gloss(best_gloss(prim, tr[0]["s"]))}
    if ex:
        item["ex"] = ex
    phrasal.append(item)
phrasal.sort(key=lambda x: -x["z"])
phrasal = phrasal[:700]

# ---------- Kontrollwörter ----------
PSEUDO = """plenter contrastly berrow fandle glomerate mardle obscurant prenticate quolity rantish scrontle
trevious unbrastic vardy wholent yarnest zelt abrogent bluster cobbish dispectful empirate flinder gortle hasting
innocuate jentle kerrish lapidate mollicent nostrate overcome palantine quavish rendle sanctimate tergiverse
umbrous vorticate wimple yorish adventage beligerate cardony devastize explatory fornicade glimmish hortify
interlude jospel kindlement lumberance meditory nexation oblivate perposal quintify ressional skimpate turbify""".split()
pseudo = [p for p in PSEUDO if zipf_frequency(p, "en") == 0 and p not in rank and p not in forms][:40]

# ---------- Geprüfte Korrekturen (einmalige Durchsicht, scripts/bank/review-fixes.jsonl) ----------
fix_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "review-fixes.jsonl")
if os.path.exists(fix_path):
    by_id = {w["i"]: w for w in words + phrasal}
    applied = 0
    for line in open(fix_path, encoding="utf-8"):
        line = line.strip()
        if not line:
            continue
        fx = json.loads(line)
        w = by_id.get(fx.get("i"))
        if not w:
            continue
        for k in ("de", "en", "p"):
            if isinstance(fx.get(k), str) and fx[k].strip():
                w[k] = fx[k].strip()
        applied += 1
    print("review fixes applied", applied, file=sys.stderr)

bank = {"v": 1, "src": "NGSL/NAWL/BSL/TSL 1.2 (CC BY-SA 4.0), Wiktionary via kaikki.org (CC BY-SA 4.0), Tatoeba (CC BY 2.0 FR)",
        "words": words, "phrasal": phrasal, "pseudo": pseudo}
path = os.path.join(out_dir, "words.json")
json.dump(bank, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
from collections import Counter
print("words", len(words), "missing-de", missing, "phrasal", len(phrasal), "pseudo", len(pseudo), file=sys.stderr)
print("with ex", sum(1 for x in words if x.get("ex") and x["ex"][0][1]), "ipa", sum(1 for x in words if x.get("ipa")), file=sys.stderr)
print("lists", Counter(t for x in words for t in x["l"]), file=sys.stderr)
print("size MB", round(os.path.getsize(path) / 1e6, 2), file=sys.stderr)
