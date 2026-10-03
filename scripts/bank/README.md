# Lernstoff-Bank (src/content/bank/words.json)

Erzeugt einmalig in der Cloud-Umgebung, Ergebnis liegt im Repository. Emrah führt nichts aus.

1. `python3 scripts/bank/01_candidates.py <cache>`: Wortlisten NGSL, NAWL, BSL, TSL und SFI-Häufigkeitsrang (newgeneralservicelist.com, CC BY-SA 4.0) → Kandidaten.
2. `python3 scripts/bank/02_kaikki.py <cache>` (Gesamtexport als Strom) und `02b_kaikki_words.py <cache>` (je Wort, vollständige Übersetzungen): Wiktionary über kaikki.org (CC BY-SA 4.0).
3. `python3 scripts/bank/03_build.py <cache>`:
   - Tatoeba-Satzpaare Englisch–Deutsch (manythings.org/anki `deu-eng.zip`, CC BY 2.0 FR),
   - Lerner-Definitionen (NGSL, TSL, NAWL),
   - US-Lautschrift (`src/content/pron/us-ipa.json`),
   - die geprüften Korrekturen aus `review-fixes.jsonl`.

Der Cache-Ordner braucht die Dateien der Quellen:
- `NGSL_12_lemmatized_for_teaching.csv` u. a. sowie `sfi31k.xlsx`, `ngsl_def.xlsx`, `tsl_def.xlsx`, `NAWL_12_with_en_definitions.csv`,
- `deu.txt`.

Python-Pakete: `wordfreq`, `openpyxl`.

`review-fixes.jsonl`: einmalige Durchsicht aller Einträge (deutsche Bedeutungen, Lerner-Definition, Wortart) durch Claude am 03.10.2026. Eine Zeile je korrigiertem Eintrag.
