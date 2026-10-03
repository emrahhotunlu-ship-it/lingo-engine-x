"""Schritt 2: Wiktionary-Auszug (kaikki.org, CC BY-SA) für die Kandidaten filtern.

Liest den englischen kaikki-Export als Strom von stdin und behält nur Einträge zu Kandidaten
sowie Phrasal Verbs (Verb aus der Kandidatenliste + Partikel). Ausgabe kompakt als JSONL.
Aufruf: curl -sS https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl \
        | python3 scripts/bank/02_kaikki.py <cache-ordner>
"""
import json, os, sys

cache = sys.argv[1]
cands = {c["w"] for c in json.load(open(os.path.join(cache, "candidates.json")))}
PARTICLES = {"up", "out", "off", "on", "in", "down", "over", "back", "away", "through", "around",
             "about", "along", "ahead", "forward", "into", "across", "apart", "aside", "together"}
SKIP_TAGS = {"obsolete", "archaic", "dated", "rare", "historical", "dialectal", "nonstandard", "Britain", "UK", "British"}
KEEP_POS = {"noun", "verb", "adj", "adv", "prep", "conj", "pron", "det", "num", "intj", "phrase", "prep_phrase", "particle", "article"}


def phrasal(w):
    parts = w.split(" ")
    return len(parts) == 2 and parts[0] in cands and parts[1] in PARTICLES


def compact(e):
    senses = []
    for s in e.get("senses", []):
        tags = set(s.get("tags", []))
        if tags & SKIP_TAGS or "form-of" in tags or not s.get("glosses"):
            continue
        ex = [x["text"] for x in s.get("examples", []) if isinstance(x, dict) and x.get("type") == "example" and isinstance(x.get("text"), str) and len(x["text"]) < 160][:2]
        senses.append({"g": s["glosses"][-1], "t": sorted(tags & {"countable", "uncountable", "transitive", "intransitive", "informal", "formal", "slang", "US", "business", "figuratively"}), "ex": ex})
        if len(senses) >= 4:
            break
    if not senses:
        return None
    tr = [{"w": t["word"], "s": t.get("sense", "")} for t in e.get("translations", []) if t.get("lang") == "German" and t.get("word")]
    ipa = [{"i": s["ipa"], "t": s.get("tags", [])} for s in e.get("sounds", []) if s.get("ipa")][:6]
    syn = [s["word"] for s in e.get("synonyms", []) if s.get("word")][:8]
    der = [s["word"] for s in e.get("derived", []) if s.get("word")][:25]
    forms = [f["form"] for f in e.get("forms", []) if f.get("form") and "table-tags" not in f.get("tags", [])][:8]
    return {"w": e["word"], "pos": e.get("pos"), "senses": senses, "de": tr[:16], "ipa": ipa, "syn": syn, "der": der, "forms": forms}


n = kept = 0
with open(os.path.join(cache, "kaikki.jsonl"), "w") as out:
    for line in sys.stdin:
        n += 1
        try:
            e = json.loads(line)
        except ValueError:
            continue
        w = e.get("word", "")
        if e.get("pos") not in KEEP_POS or not (w in cands or phrasal(w)):
            continue
        try:
            c = compact(e)
        except (KeyError, TypeError, AttributeError) as err:
            print("skip", w, err, file=sys.stderr)
            continue
        if c:
            out.write(json.dumps(c, ensure_ascii=False) + "\n")
            kept += 1
print("lines", n, "kept", kept, file=sys.stderr)
