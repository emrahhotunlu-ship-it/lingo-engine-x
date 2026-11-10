Artefakt-URL für alle ArtifactData-Aufrufe: {URL}
Verändere in diesem Artefakt NUR die Sammlung `wtq` wie unten beschrieben, nichts anderes.

**Auftrag: Jeden Tag 12 neue Wortkarten für Emrahs Wörter-Trainer aufbereiten**

Emrah ist deutscher Muttersprachler, Business-Englisch B2 → C1, arbeitet in Vertrieb/Projekten (Küchen-/Möbelbranche: Kunden, Lieferanten, Montage, Meetings, E-Mails). US-Englisch. Er will vor allem Englisch beim Hören (Videos, Meetings) besser verstehen. Die App fragt jeden Tag rund 50 Wörter ab; neue Wörter kommen auch aus dieser Lieferung.

**Schritt 1: Datum.** `heute` = Datum in Europe/Berlin (`JJJJ-MM-TT`), `monat` = `JJJJ-MM`.

**Schritt 2: Schon geliefert?** `ArtifactData` `list`, Sammlung `wtq`. Lies alle Dokumente `m-…` (Monatsdokumente, Aufbau `{ "v": 1, "items": [ … ], "days": { "<Datum>": <Anzahl> } }`). Steht in `wtq/m-<monat>` unter `days` schon `<heute>`, schreibe NICHTS und antworte „schon geliefert“. Merke dir alle schon gelieferten oder übersprungenen Wörter (`items[].w` und `skip[]`).

**Schritt 3: Nächste Wörter wählen.** `ArtifactData` `get` `wtq/todo`: `items` ist eine Liste `[Wort, Rang, Wortart, alte Bedeutung]`, nach Häufigkeit sortiert (häufigste zuerst). Die alte Bedeutung ist UNGEPRÜFT und oft falsch – nur ein Hinweis. Gehe die Liste von vorn durch und nimm die ersten 12 Wörter, die (a) noch nicht geliefert sind, (b) es als Lernwort noch nicht gibt (`ArtifactData` `get`, Sammlung `vocab`, doc_id = das Wort klein, Nicht-Buchstaben durch `-` ersetzt; existiert es, überspringen), (c) einen Lernwert für einen B2→C1-Lerner haben. Überspringe ohne Karte: Eigennamen, Abkürzungen, Fragmente, sehr seltene Fachwörter ohne Alltags- oder Berufswert, anstößige Wörter, Wörter, die im Deutschen gleich lauten und dasselbe heißen (team, system, browser). Übersprungene merkst du dir mit `"skip": "<Grund>"` (siehe Schritt 6), damit sie nicht wiederkommen.

**Schritt 4: Karte schreiben.** Je Wort ein Objekt:
`{"w":"earnings","p":"noun","d":"Gewinn, Ertrag","g":"the money a company or person makes","x":"Our quarterly earnings were higher than the bank had expected.","xd":"Unser Quartalsgewinn war höher, als die Bank erwartet hatte.","lvl":"B2","r":4521}`
- `p`: noun | verb | adjective | adverb | preposition | conjunction | phrase (die häufigste Wortart).
- `d`: deutsche Bedeutung der HÄUFIGSTEN Lesart (im Alltag oder Beruf), 1–3 Varianten derselben Lesart, Komma-getrennt; Verben im Infinitiv, Nomen ohne Artikel; natürliches heutiges Deutsch. Zwei verschiedene Bedeutungen nie mischen.
- `g`: kurze englische Erklärung, höchstens 12 Wörter, B2-Wortschatz, passend zu `d`.
- `x`: EIN natürlicher Satz, 8–16 Wörter, US-Englisch, wie ihn ein Muttersprachler sagt; Alltag oder Beruf (gern Kunden, Projekte, Meetings, Lieferung, Team); das Wort genau einmal in der Lesart von `d` (Beugung erlaubt). Der Zusammenhang lässt die Bedeutung erkennen und lässt KEIN anderes naheliegendes Wort als Lücken-Lösung zu (sonst Satz ändern). Keine Namen berühmter Personen, keine Marken, keine Klammern, keine britischen Wörter.
- `xd`: natürliche deutsche Übersetzung von `x` (kein Anglizismus), `d` kommt darin vor, wo natürlich.
- `lvl`: "B1" (kennt jeder B2-Lerner), "B2", "C1" oder "C2". B1-Wörter bekommen trotzdem eine Karte.
- `r`: der Rang aus `wtq/todo`.

**Schritt 5: Lehrer-Prüfung.** Starte einen Unteragenten mit dieser Rolle: „Du bist ein erfahrener Business-English-Lehrer (CELTA/DELTA, Cambridge-C1-Prüfer). Prüfe streng jede Karte: Bedeutung richtig und die häufigste Lesart? g passt zu d? x natürliches US-Englisch, zeigt die Bedeutung, lässt keine zweite Lösung zu? xd korrekt und natürlich? lvl plausibel? Antworte nur mit Korrekturen als JSON-Liste {w, fix:{…}} oder {w, drop:true, why}.“ Übernimm die Korrekturen. Gestrichene Karten zählen als übersprungen.

**Schritt 6: Selbstprüfung und Schreiben.** Jede Karte hat alle Felder, `x` 8–16 Wörter mit dem Wort, kein Feld leer, gültiges JSON. Dann `ArtifactData` `get` `wtq/m-<monat>`:
- existiert es nicht: `set` mit `{ "v": 1, "items": [<Karten>], "skip": [<übersprungene Wörter>], "days": { "<heute>": <Anzahl Karten> } }`;
- existiert es: `update` mit `if_version` (Version aus dem `get`) und den Feldern `items` (alte + neue Karten), `skip` (alte + neue), `days` (alte + `<heute>`). Nie alte Karten entfernen oder ändern.
Schreibe sonst nichts, lösche nichts.

**Schritt 7: Antwort.** Kurz: Datum, Anzahl Karten, die Wörter, übersprungene mit Grund.
