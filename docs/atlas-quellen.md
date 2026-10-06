# Atlas: Quellen und Lizenzen

Die Wortliste `src/content/atlas/atlas.json` entsteht mit `scripts/atlas/build_atlas.py` aus offenen Quellen (nur zur Entwicklung, nie in der App) und wird danach von Claude auf Sinn, Wortart und Eignung für C1 durchgesehen (Korrekturen und Streichungen; Wörter mit britischer Schreibweise fliegen raus).

| Quelle | Wofür | Lizenz |
|---|---|---|
| wordfreq 3.1 | Auswahl und Häufigkeitsrang (ab Rang 2.500, die häufigsten gelten als Grundwortschatz) | Code MIT, Daten CC BY-SA 4.0 |
| WordNet 3.1 (npm `wordnet-db`, Princeton) | Wortart, englische Erklärung | WordNet-Lizenz (frei nutzbar mit Hinweis) |
| FreeDict eng-deu 1.9 | deutsche Bedeutung | GPL-3.0 |
| Tatoeba (eng, deu, Verknüpfungen) | Beispielsatz mit deutscher Übersetzung | CC BY 2.0 FR |

Hinweise
- Der Quellenhinweis steht im Atlas (`atCredits`).
- FreeDict ist GPL-3.0: Die App ist privat und wird nicht weitergegeben. Würde die App je verteilt, müsste dieser Teil neu bewertet werden.
- Auswahlregel gegen falsche Bedeutungen: eine deutsche Bedeutung muss im deutschen Beispielsatz vorkommen oder das Wort hat nur eine Bedeutung; danach prüft Claude jeden Eintrag.
- Neu bauen: `SRC=/tmp/atl python3 scripts/atlas/build_atlas.py` (Quellen vorher laden, siehe Kopf des Skripts), danach erneut durchsehen lassen.

## Bereinigung (Lernplattform 2.0, P3, 06.10.2026)
`python3 scripts/atlas/clean_atlas.py` (nur Python-Standardbibliothek, idempotent) bereinigt `atlas.json` **ohne** Neuaufbau aus den Quellen. Nichts wird gelöscht; `meta.json` wird mitgeschrieben (sichtbare Einträge, Paketgröße).
- **Ausgeblendet (`hidden`)**: britisches Stichwort (`scripts/atlas/british.py`), Wortart passt nicht zur Definition und lässt sich nicht sicher berichtigen.
- **Berichtigt**: britische Schreibung im Beispielsatz → US-Form; englische Brocken in der deutschen Bedeutung (`d`, z. B. „introduction of the euro“); Wortart `p`, wenn Definition und deutsche Bedeutung eindeutig dazu passen; wenige Handkorrekturen nach Englischlehrer-Prüfung (`OVERRIDES`).
- **Markiert**: `basic` (Grundwortschatz: Rang < 3.300 oder alltägliche Dinge wie jeans/lighter/euro; die NGSL-Kernliste war offline nicht verfügbar, die Rangschwelle ist ein Näherungswert), `exWeak` (Beispielsatz mit Vorname wie „Tom“ oder britischem Wort wie „lorry“).
- Die Band-Kennungen (`core`, `plus`, `c1`, `rare`) bleiben; ihre Anzeigenamen („häufig · mittel · selten“) stehen in den Texten der Atlas-Seite (nicht in diesen Daten).
- Lizenzen unverändert: FreeDict GPL-3 (private App), Tatoeba CC BY 2.0 FR, wordfreq/WordNet wie oben.
