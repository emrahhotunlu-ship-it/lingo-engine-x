"""Schritt 1 der Lernstoff-Bank: Kandidaten-Wörter mit Häufigkeitsrang.

Quellen (freie Lizenzen, Quellenangabe in der App):
- NGSL 1.2, NAWL 1.2, BSL 1.20, TSL 1.2 (Browne, Culligan, Phillips; CC BY-SA 4.0)
- NGSL mit SFI-Rangliste (31K, "SFI adj"): Häufigkeitsrang je Lemma

Ausgabe: <cache>/candidates.json  [{w, rank, sfi, d, lists:[...]}]
Aufruf: python3 scripts/bank/01_candidates.py <cache-ordner>
"""
import csv, json, re, sys, os
import openpyxl

cache = sys.argv[1]
MAX_RANK = 9000  # allgemeine Wörter jenseits der Listen nur bis zu diesem Häufigkeitsrang
WORD = re.compile(r"^[a-z][a-z'-]*[a-z]$")


def headwords(name):
    out = []
    with open(os.path.join(cache, name), encoding="utf-8-sig", errors="replace") as f:
        for row in csv.reader(f):
            if not row or row[0].startswith("#") or not row[0].strip():
                continue
            w = row[0].strip().lower()
            if WORD.match(w):
                out.append(w)
    return out


lists = {
    "core": headwords("NGSL_12_lemmatized_for_teaching.csv"),
    "academic": headwords("NAWL_12_lemmatized_for_teaching.csv"),
    "business": headwords("BSL_120_lemmatized_for_teaching.csv"),
    "toeic": headwords("TSL_12_lemmatized_for_teaching.csv"),
}

rank = {}
wb = openpyxl.load_workbook(os.path.join(cache, "sfi31k.xlsx"), read_only=True)
for i, r in enumerate(wb.worksheets[0].iter_rows(values_only=True)):
    if i == 0 or not r[0]:
        continue
    w = str(r[0]).strip().lower()
    if w not in rank:
        rank[w] = {"rank": int(r[7]) if r[7] else i, "sfi": round(float(r[3]), 2), "d": round(float(r[5]), 3)}

cands = {}
for tag, words in lists.items():
    for w in words:
        c = cands.setdefault(w, {"w": w, "lists": []})
        if tag not in c["lists"]:
            c["lists"].append(tag)
for w, info in rank.items():
    if info["rank"] <= MAX_RANK and WORD.match(w) and len(w) >= 3 and info["d"] >= 0.5 and w not in cands:
        cands[w] = {"w": w, "lists": ["general"]}
for w, c in cands.items():
    c.update(rank.get(w, {"rank": 30000, "sfi": 0, "d": 0}))

out = sorted(cands.values(), key=lambda c: c["rank"])
json.dump(out, open(os.path.join(cache, "candidates.json"), "w"), ensure_ascii=False)
from collections import Counter
print(len(out), Counter(t for c in out for t in c["lists"]))
