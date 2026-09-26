# Übernommene Inhalte der alten App

Diese Dateien sind **Daten**, kein Code. Sie stammen aus der alten App („Sprachwerkstatt", Vertrag 0.2.49) und wurden in Phase 0 unverändert als JSON gesichert. Dort standen sie fest im Programmcode, deshalb gibt es sie nicht in der Datenbank.

| Datei | Inhalt | Genutzt ab |
|---|---|---|
| `course.json` | 6 Einheiten, 24 Lektionen (l01–l24) mit Can-Do-Ziel, Situation, 6 Zielwörtern; Lektionsschritte | Phase 0 (Übersicht), Phase 2 (Kurs) |
| `grammar.json` | 16 Grammatikthemen mit Start-Beherrschung `p0`, Regeln, 48 Startaufgaben | Phase 0, Phase 2 |
| `rules.json` | Regelwerk mit Begründungen und „Auch richtig"-Familien | Phase 2 |
| `vocab.json` | 40 Startvokabeln, Kollokationen, Namen der Abfragearten | Phase 0, Phase 1 |
| `dict.json` | eingebautes Wörterbuch (4.226 Wörter) für Wort-Antippen | Phase 1 |
| `vtest.json`, `cefr.json` | Wortschatztest, CEFR-Deskriptoren | Phase 6 |
| `passages.json` | Hörtexte, Schreibaufgaben, Artikel als Startbestand | Phase 4 |
| `scenes.json` | Rollenspiel-Szenen | Phase 3 |
| `feed-seed.json` | Beispiel-Beiträge im Format von `feed/<Datum>` | Tests |
| `context.json` | allgemeiner Berufskontext (ohne persönliche Daten) | Prompts |

Die Kennungen (`l01`, `passive`, Slugs der Vokabeln) bleiben unverändert, damit sie zu den Dokumentpfaden der Datenbank passen.
