"""Schritt 2b: Wiktionary je Wort von kaikki.org holen (enthält die vollständigen Übersetzungstabellen,
die im Gesamtexport bei vielen Wörtern fehlen). Nutzt compact() aus 02_kaikki.py.
Aufruf: python3 scripts/bank/02b_kaikki_words.py <cache-ordner>
Ausgabe: <cache>/kaikki2.jsonl
"""
import importlib.util, json, os, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from wordfreq import zipf_frequency

cache = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
sys.argv = [sys.argv[0], cache]
spec = importlib.util.spec_from_file_location("k", os.path.join(here, "02_kaikki.py"))
# compact() ohne den Stromteil laden: nur Funktionsdefinitionen ausführen
src = open(os.path.join(here, "02_kaikki.py")).read().split("\nn = kept = 0")[0]
ns = {"__name__": "k"}
exec(compile(src, "02_kaikki.py", "exec"), ns)
compact, KEEP_POS = ns["compact"], ns["KEEP_POS"]

words = [c["w"] for c in json.load(open(os.path.join(cache, "candidates.json")))]
phr = set()
for line in open(os.path.join(cache, "kaikki.jsonl")):
    w = json.loads(line)["w"]
    if " " in w and zipf_frequency(w, "en") >= 2.6:
        phr.add(w)
todo = words + sorted(phr)
print("fetch", len(todo), file=sys.stderr)


def fetch(w):
    p = w[0] + "/" + w[:2] + "/" + w
    url = "https://kaikki.org/dictionary/English/meaning/" + urllib.parse.quote(p) + ".jsonl"
    try:
        with urllib.request.urlopen(url, timeout=40) as r:
            body = r.read().decode("utf-8")
    except Exception as err:  # 404 = kein Eintrag
        return w, [], str(err)[:60]
    out = []
    for line in body.splitlines():
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if e.get("pos") in KEEP_POS and e.get("word") == w:
            try:
                c = compact(e)
            except (KeyError, TypeError, AttributeError):
                c = None
            if c:
                out.append(c)
    return w, out, None


errs = 0
with open(os.path.join(cache, "kaikki2.jsonl"), "w") as f, ThreadPoolExecutor(16) as pool:
    for i, (w, out, err) in enumerate(pool.map(fetch, todo)):
        errs += bool(err)
        for c in out:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")
        if i % 1000 == 0:
            print(i, w, file=sys.stderr, flush=True)
print("done errors", errs, file=sys.stderr)
