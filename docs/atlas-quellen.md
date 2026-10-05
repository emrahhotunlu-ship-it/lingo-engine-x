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
