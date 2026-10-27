# Bauliste Vorschau v2 (verbindlich, 27.10.2026)

Zusammengeführt aus `luecken.md` §4 (Kai) und `../vokabeltrainer.md` §8 (Lena+Mara). Die Nummern aus diesen beiden Dateien gelten **nicht** mehr, es gilt nur diese Liste. Inhalte zu jedem Bildschirm stehen in der genannten Quelle. Beispielinhalte stammen aus Kapitel 1 (`inhalte-kapitel1.md`). Jeder neue englische Satz wird in `neue-saetze-<Paket>.md` (A, B oder C) eingetragen (Bildschirm, Satz, Zweck), damit ihn der Lehrer gegenliest.

**Dateien:** Jeder Bau-Agent schreibt nur in seine eigenen Dateien. `build.mjs` setzt sie in dieser Reihenfolge zusammen: app.js, screens.js, screens-woerter.js, screens-mehr.js, screens-soll.js, desk.js, desk-woerter.js, desk-mehr.js. `app.js` und `style.css` werden nicht angefasst. Eigene Hilfsfunktionen stehen in der eigenen JS-Datei, eigenes CSS in `src/style-woerter.css`, `src/style-mehr.css` oder `src/style-soll.css`, jeweils mit eigenem Präfix (`tw-` Wörter, `tm-` Mehr, `ts-` Soll). Fehlt eine gemeinsame Hilfe wirklich, wird sie in die eigene Datei kopiert, nicht umgebaut.

## Paket A „Wörter“: Agent Nora-A, Dateien screens-woerter.js, desk-woerter.js, dazu Änderungen an H1, H2, H12, H15, H16 in screens.js und an L5 in desk.js

| Code | Name | Quelle | Varianten |
|---|---|---|---|
| H1 (geändert) | Heute | VT §8, Kai 21 | neu: `done` mit Zeile „Wörter üben · 14 fällig, zählt als Extra“ · `resume` („Runde fortsetzen · 6 von 10“) · `pause` (nach langer Pause) · `vacation` (Urlaub angekündigt) · `short` (Heute wenig Zeit) |
| H2 (geändert) | Aufgabe | Kai 21 | neu: `more` (Mehr-Blatt mit Eselsbrücke und Satzübersetzung) |
| H12 (geändert) | Wörter | VT §6, §8, Kai 21 | Karte „Üben“ oben · `list-before` · `list-nothing-due` · `resting-sheet` · `detail` (mit „Dieses Wort üben“, „Sag es“, „Pausieren“) · `filter` (Stand, Art, Herkunft, Schwierig) |
| H15 (geändert) | Wort-Popup | Kai 21 | neu: `saved` („In die Wörter“ mit „Rückgängig“) |
| H16 (geändert) | Zustände | Kai 21 | neu: `nosave` („Speichern geht gerade nicht“) |
| H17 | Trainer-Start | VT §2, §8 | `default` · `adjust` · `before-duty` · `new-words` · `brake` · `nothing-due` |
| H18 | Trainer-Aufgabe | VT §4, §8 | `free` · `gap` · `partner` · `situation` · `recognize` · `listen` · `speak` · `contrast` · `band-early` · `return` |
| H19 | Anki-Karte | VT §3.6, §8 | `recognize-front` · `recognize-back` · `produce-front` · `produce-back` · `undo` · `control` |
| H20 | Trainer-Ergebnis | VT §4.4, §8 | `normal` · `with-step` · `all-early` · `stopped` |
| H21 | Wörter sammeln | VT §6, §8 H21 + Kai Muss 3 und 5 | `search-empty` (Suche ohne Treffer → „Hinzufügen“) · `unknown-word` (Popup für ein neues Wort, Bedeutung zum Satz vorausgewählt) · `phrase` (zwei Wörter angetippt = Wendung) · `add-sheet` (Wort, Bedeutung, Satz; „Erkennen reicht“ / „Aktiv lernen“; Claude schlägt einen Satz vor) · `from-text` · `quota-full` (ehrliche Grenze) |
| H22 | Tempo | VT §8 | `run` · `end` |
| H23 | Wort verwalten | Kai Muss 4 | `actions` · `edit` · `delete-confirm` · `hidden` |
| L5 (geändert) | Wörter am Laptop | VT §8, Kai Muss 15 | `main` mit „Üben ⏎“ und „Hinzufügen“ · `resting` · `manage` (Wort-Detail mit allen Aktionen in der Kontextspalte) |
| L11 | Trainer-Start | VT §8 | `default` · `before-duty` · `new-words` |
| L12 | Trainer-Aufgabe | VT §8 | `task` · `checked` · `checked-early` · `contrast` |
| L13 | Anki am Laptop | VT §8 | `recognize` · `produce` |
| L14 | Trainer-Ergebnis | VT §8 | `normal` |

## Paket B „Rund um den Tag“: Agent Nora-B, Dateien screens-mehr.js, desk-mehr.js

| Code | Name | Quelle | Varianten |
|---|---|---|---|
| H24 | Einstellungen | Kai Muss 1 | `overview` · `voice` · `context` · `data` · `diagnosis` |
| H25 | Erster Start nach dem Umstieg | Kai Muss 6 | `welcome` · `honest` · `placement-start` · `placement-mid` · `placement-result` |
| H26 | Deine Fehler | Kai Muss 7 | `list` · `open` · `empty` |
| H27 | Grammatik-Thema frei üben | Kai Muss 8 | `topic` · `free-round` · `result` · `lookup` |
| H28 | Lehrer (Preply) | Kai Muss 9 | `paste` · `confirm` · `note` · `monthly` |
| H29 | Sprechen: alle Einträge | Kai Muss 10 | `list` · `objection` · `scene` |
| H30 | Wochenabschluss | Kai Muss 11 | `report` · `all` · `focus` |
| H31 | Test-Ergebnis | Kai Muss 12 | `passed` · `failed` · `chapter` · `milestone` |
| H32 | Wochen-Mail am Handy | Kai Muss 13 | `task` · `writing` · `feedback` · `rewrite` |
| L15 | Einstellungen am Laptop | Kai Muss 14 | `overview` · `diagnosis` |
| L16 | Fehler und Grammatik-Thema am Laptop | Kai Soll 22 | `errors` · `topic` |
| L17 | Wochenabschluss am Laptop | Kai Soll 22 | `report` |

## Paket C „Soll“: Agent Nora-C, Datei screens-soll.js

| Code | Name | Quelle | Varianten |
|---|---|---|---|
| H33 | Mehr üben | Kai Soll 16 | `list` · `workshop` · `result` |
| H34 | Fortschritt-Details und Verlauf | Kai Soll 17 | `words` · `grammar` · `listening` · `history` |
| H35 | Lesen: Kurse und Archiv | Kai Soll 18 | `course` · `lesson` · `archive` |
| H36 | Prüfen (Satz-Klinik, Mail-Werkstatt) | Kai Soll 19 | `sentence` · `mail` |
| H37 | So funktioniert's | Kai Soll 20 | `overview` · `stages` |

## Regeln für alle

- Erreichbarkeit: Jeder neue Bildschirm muss auch über einen echten Knopf in einem bestehenden Bildschirm erreichbar sein, nicht nur über das Menü (z. B. Zahnrad → H24, Wörter → „Üben“ → H17).
- Kapitel 2 des Auftrags: ein Hauptknopf je Bildschirm, Pflicht und Extra sichtbar getrennt, „Erledigt heißt erledigt“, die vier Fragen bei jeder Übung, keine Punkte und kein Vorwurf.
- Stufennamen, Tagesplan, Spielplan der Geschichte (Mo Angebot … Fr Mail; heute Donnerstag) und Zahlen müssen zu den bestehenden Bildschirmen passen: dieselben Wörter, dieselbe Zahl fälliger Wörter (14) und dieselben Daten.
- Deutsch und Englisch (`L(de,en)`) für jeden Text, alle drei Modi, Akzent iris/amber.
- Nichts extern laden, Datei < 2 MB (prüft build.mjs).
