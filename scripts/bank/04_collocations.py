"""Schritt 4: Verb-Nomen-Kollokationen (make/do/take/give …) aus den Tatoeba-Satzpaaren zählen.

Behalten wird ein Nomen nur, wenn ein Verb der Gruppe make/do/take/have/give mindestens 80 % der
Treffer hat (mind. 6). So ist die Auswahl „___ a decision" eindeutig.
Ausgabe: src/content/bank/colloc.json  [{v, n, k, ex:[en, de]}]
Aufruf: python3 scripts/bank/04_collocations.py <cache-ordner>
"""
import json, os, re, sys
from collections import Counter, defaultdict

cache = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
bank = json.load(open(os.path.join(root, "src", "content", "bank", "words.json"), encoding="utf-8"))
nouns = {w["w"] for w in bank["words"] if w["p"] == "n" and w["r"] <= 8000}
VERBS = {
    "make": "make makes made making", "do": "do does did done doing", "take": "take takes took taken taking",
    "have": "have has had having", "give": "give gives gave given giving",
}
form2verb = {f: v for v, fs in VERBS.items() for f in fs.split()}
SKIP = {"a", "an", "the", "some", "no", "my", "your", "his", "her", "our", "their", "its", "this", "that", "any", "every", "another", "more", "much", "great", "good", "big", "final", "quick", "short", "long", "real", "serious", "huge", "important", "lot", "few"}
TOK = re.compile(r"[A-Za-z']+")
plural = lambda t: t[:-1] if t.endswith("s") and t[:-1] in nouns else t

counts = defaultdict(Counter)
examples = {}
seen = set()
for line in open(os.path.join(cache, "deu.txt"), encoding="utf-8"):
    parts = line.rstrip("\n").split("\t")
    if len(parts) < 2 or parts[0] in seen:
        continue
    en, de = parts[0], parts[1]
    seen.add(en)
    toks = [t.lower() for t in TOK.findall(en)]
    for i, t in enumerate(toks):
        v = form2verb.get(t)
        if not v:
            continue
        j = i + 1
        while j < len(toks) and j <= i + 3 and toks[j] in SKIP:
            j += 1
        if j >= len(toks) or j == i + 1 and toks[j] not in nouns:
            # direkt folgendes Nomen ohne Artikel nur bei Nomen ohne Artikel-Zwang (z. B. "take care")
            pass
        if j < len(toks):
            n = plural(toks[j])
            if n in nouns:
                counts[n][v] += 1
                if v != "have" and 6 <= len(toks) <= 14 and (n, v) not in examples:
                    examples[(n, v)] = [en, de]

out = []
for n, c in counts.items():
    total = sum(c.values())
    v, k = c.most_common(1)[0]
    if v == "have" or total < 6 or k / total < 0.8 or (n, v) not in examples or n in {"time", "thing", "way", "lot", "one", "people", "man"}:
        continue
    out.append({"v": v, "n": n, "k": k, "ex": examples[(n, v)]})
out.sort(key=lambda x: -x["k"])
json.dump(out, open(os.path.join(root, "src", "content", "bank", "colloc.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(out), Counter(x["v"] for x in out), [f'{x["v"]} {x["n"]}' for x in out[:40]], file=sys.stderr)

# ---------- Aufgaben: Verb im Beispielsatz durch eine Lücke ersetzen, Optionen in derselben Form ----------
NOISE = {"end", "morning", "afternoon", "average", "coat", "stair", "fool", "sip", "subway", "taxi", "medicine", "pill", "medication", "elevator", "bath", "nap"}
TABLE = {v: fs.split() for v, fs in VERBS.items()}
SLOTS = {"make": [0, 1, 2, 2, 3], "do": [0, 1, 2, 3, 4], "take": [0, 1, 2, 3, 4], "have": [0, 1, 2, 2, 3], "give": [0, 1, 2, 3, 4]}
# Form je Platz: 0 Grundform, 1 3. Person, 2 Vergangenheit, 3 Partizip, 4 -ing
FORMS = {"make": ["make", "makes", "made", "made", "making"], "do": ["do", "does", "did", "done", "doing"], "take": ["take", "takes", "took", "taken", "taking"],
         "have": ["have", "has", "had", "had", "having"], "give": ["give", "gives", "gave", "given", "giving"]}
items = []
for x in out:
    if x["n"] in NOISE:
        continue
    en, de = x["ex"]
    m = None
    for slot, form in enumerate(FORMS[x["v"]]):
        m = re.search(r"\b" + form + r"\b", en, re.I)
        if m:
            break
    if not m:
        continue
    others = [v for v in ["make", "do", "take", "give", "have"] if v != x["v"]][:3]
    opts = sorted([FORMS[x["v"]][slot]] + [FORMS[v][slot] for v in others])
    prompt = en[: m.start()] + "___" + en[m.end():]
    items.append({"p": prompt, "a": FORMS[x["v"]][slot], "o": opts, "de": de})
biz = json.load(open(os.path.join(root, "src", "content", "bank", "colloc-business.json"), encoding="utf-8"))
for p, a, o, de in biz:
    items.append({"p": p, "a": a, "o": o, "de": de, "biz": 1})
json.dump(items, open(os.path.join(root, "src", "content", "bank", "colloc.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("items", len(items), items[:2], file=sys.stderr)
