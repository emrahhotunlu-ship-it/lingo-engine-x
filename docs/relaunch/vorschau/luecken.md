# Lücken-Liste Relaunch: was fehlt in Konzept und Vorschau

Stand 27.10.2026 · geschrieben von Kai (Emrahs Anwalt im Relaunch-Team)

Auslöser: Emrah hat in der Vorschau bemerkt: „Der eigene Vokabeltrainer fehlt, oder?“ Er hatte recht, und niemand hatte es ihm gesagt. Diese Liste soll dafür sorgen, dass er **keine zweite solche Lücke** selbst finden muss.

**Verglichen wurden drei Dinge:**
1. **Was die App heute kann** (Live-Version v86): Bildschirme im Quelltext (`src/features`, `src/areas`, `src/modules/read`), Einstellungen, Stand-Notizen (`docs/umbau/stand.md`), Gesamtkonzept 04.10.2026, Lernplattform 3.0.
2. **Was das Relaunch-Konzept verspricht** (`docs/relaunch/konzept.md`, Entwurf 2.1).
3. **Was die Vorschau zeigt** (`docs/relaunch/vorschau/src/screens.js` mit H1–H16, Termin-Seite T, Wochenfrage W; `desk.js` mit L1–L10).

Dazu der Auftrag, Kapitel 2, 6 und 15 (Kap. 6 gilt seit dem Umbau nur noch für Wörter, Grammatik, Sprechen, Übersetzer, Claude und Lesen).

**Einstufungen in der Tabelle:**
- **Muss in die Vorschau:** Emrah würde es beim ersten Durchklicken vermissen oder täglich brauchen. Ohne Bild kann er nicht beurteilen, ob der Relaunch besser ist als heute.
- **Soll:** gehört dazu, darf aber nach den Muss-Bildschirmen kommen.
- **Reicht im Konzept:** läuft im Hintergrund oder ist im Konzept genau genug beschrieben, ein Bild bringt Emrah nichts Neues.
- **Bewusst gestrichen (mit Grund):** fällt weg, der Grund steht dabei.
- **Abgedeckt:** keine Lücke. Steht nur da, damit die Liste vollständig ist.

---

## 1. Die ganze Tabelle

Abkürzungen: „Konzept 3.2“ = Abschnitt 3.2 im Relaunch-Konzept. „H12“ = Bildschirm H12 der Vorschau (Handy), „L5“ = Laptop-Bildschirm.

### 1a. Heute und der Tagesablauf

| Nr | Funktion | Heute in der App | Im Konzept | In der Vorschau | Einstufung | Begründung aus Emrahs Sicht |
|---|---|---|---|---|---|---|
| 1 | Heute-Karte mit einem Knopf, Pflicht und Extra getrennt | ja, Reiter Heute | 2.1, 2.2 | H1 (alle Varianten), L1 | abgedeckt | Ich sehe sofort, was dran ist. |
| 2 | Weitermachen nach Unterbrechung | ja, „Weiter, wo du warst“-Zeilen | 13.1 | H1 „unterwegs“, Menü „Pause, später weiter“ | abgedeckt | Ich kann die App mitten im Block schließen. |
| 3 | Abschlusskarte des Tages | ja (Ergebnis-Karte, v86) | 11 | H10 | abgedeckt | Ich sehe, was der Tag gebracht hat. |
| 4 | Serie mit Ruhetag, Wochenstreifen | ja | 11 | H1 | abgedeckt | Meine Serie läuft weiter, ohne Schuldgefühl. |
| 5 | Aufholen nach 1–6 Tagen Pause | ja (Rückstand-Steuerung, Wiedereinstieg-Band) | 2.4 | H1 „Aufholen“ | abgedeckt | Ich komme nach ein paar Tagen ruhig zurück. |
| 6 | Wiedereinstieg nach langer Pause (2 Wochen und mehr) | ja (Neustart-Woche, „Willkommen zurück“) | 2.4 nur allgemein („Aufholen über Tage verteilt“) | fehlt | **Soll** | Nach dem Urlaub will ich keinen Berg sehen, sondern einen freundlichen Neuanfang. |
| 7 | Erster Start nach dem Umstieg (was ist neu, warum ist meine Wortzahl kleiner) | teils (Erststart-Ablauf aus dem Gesamtkonzept) | 3.2 „Erschwernis ankündigen“, 3.7 „ein Satz beim ersten Öffnen“ | fehlt | **Muss** | Ich öffne die neue App und meine 491 Wörter sind plötzlich 38. Ohne Erklärung denke ich, meine Daten sind weg. |
| 8 | Einstufung in Woche 0 (zwei Sitzungen à 25 Min.) | teils (Einstufungstest Grammatik, Wortschatztest) | 9.3 | fehlt | **Muss** | Das sind meine ersten zwei Tage im neuen Programm. Ich will vorher sehen, wie das aussieht und was am Ende herauskommt. |
| 9 | Themen-Test und Kapitel-Test: Ergebnis (bestanden / nicht bestanden) | ja (Kapitelprüfung, Themen-Check) | 4.2 | fehlt | **Muss** | „Nicht bestanden“ ist der heikelste Moment. Ich will sehen, dass er nicht entmutigt. |
| 10 | Meilenstein-Tage A und B alle 4 Wochen | teils (C1-Check im Monatsfenster) | 9.3 | fehlt | **Soll** | Alle 4 Wochen ein Prüfungstag statt Pflicht: das will ich einmal gesehen haben. |
| 11 | Mini-Vorher-Nachher nach 7 Tagen | nein | 9.4 | fehlt | **Soll** | Der erste Beweis, dass es wirkt. Ein kleines Bild reicht. |
| 12 | Wochenabschluss mit Wochenbericht | ja (Wochenrückblick 3.0) | 9.5 | nur W (Wochenfrage) | **Muss** | Jeden Sonntag mein Ritual. Ohne Bild weiß ich nicht, was ich jede Woche bekomme. |
| 13 | Fokus für die nächste Woche selbst wählen | ja (Fokus-Auswahl im Wochenrückblick) | fehlt | fehlt | **Soll** | Heute darf ich sagen „nächste Woche mehr Grammatik“. Das ist im Konzept einfach weg. |
| 14 | Schreibtag (Wochen-Mail) am Handy | nein (neu) | 2.5 | nur L9 (Laptop) | **Muss** | Ich lerne fast nur am Handy. Die Wochen-Mail gibt es aber nur als Laptop-Bild. |
| 15 | Missionstag, Mission mit Bericht | teils (Rollenspiel mit Bericht) | 6.3 | H1, H11, L6 | abgedeckt | |
| 16 | „Mein nächster Termin“ | nein (neu) | 2.1 | T | abgedeckt | |
| 17 | Wochenfrage Selbstsicherheit | nein (neu) | 6.5 | W | abgedeckt | |
| 18 | Tägliche Erinnerung (Tagesauftrag) und eigene Lernzeit | ja (Lernzeit in Einstellungen, Anleitung zur Erinnerung) | 11 („Erinnerung als Frage“) | fehlt | **Soll** | Wo stelle ich ein, wann ich lerne? Das Konzept sagt nur, was die Erinnerung fragt. |

### 1b. Wörter

| Nr | Funktion | Heute in der App | Im Konzept | In der Vorschau | Einstufung | Begründung aus Emrahs Sicht |
|---|---|---|---|---|---|---|
| 19 | **Eigener Vokabeltrainer** (freie Runde, alle fälligen, Stapel, Richtung DE/EN, Anki-Modus mit Aufdecken und vier Noten, Rückgängig) | ja (Wörter → Üben, Stapel, Anki-Modus) | nur „freiwillige Zusatzrunde“ (2.1) und eine Zeile in der Notentabelle (3.3) | nur eine Zeile „Freiwillige Zusatzrunde“ | **Muss** (bereits beauftragt, Lena und Mara spezifizieren) | Das war meine Frage. Ich will Wörter auch außerhalb der Pflicht üben, so wie ich es will. |
| 20 | Wörterliste mit Suche und Filtern | ja | 13.3 | H12 Liste, L5 | abgedeckt | |
| 21 | Wort-Detail (Stufe, Ursprungssatz, Wortpartner, letzte Versuche) | ja | 3.5 | H12 „Wort geöffnet“ | abgedeckt | |
| 22 | **Wort selbst hinzufügen** (Wort, Bedeutung, eigener Satz, Claude schlägt vor) | ja („Hinzufügen“-Blatt) | fehlt (das Gesamtkonzept hatte es noch) | fehlt (Suche ohne „Hinzufügen“) | **Muss** | Mein Lehrer sagt ein Wort, ich will es sofort reinlegen. Heute geht das. |
| 23 | Mehrere Wörter aus einem Text übernehmen (z. B. aus einer Lehrer-Nachricht) | ja („Aus Text“) | fehlt | fehlt | **Soll** | Spart mir zehnmal Einzeleingabe. |
| 24 | **Wort bearbeiten** (Bedeutung oder Satz ändern) | ja | fehlt | fehlt | **Muss** | Wenn eine Karte falsch ist, will ich sie selbst reparieren, nicht melden und warten. |
| 25 | **Wort verwalten** (Kenne ich sicher · Morgen wieder · Ausblenden · Von vorn · Löschen) | ja (Aktionen im Wort-Blatt; Löschen auf Zuruf) | nur „vorerst pausieren“ ab 6 Fehlern (3.2) | fehlt | **Muss** | Ich muss ein Wort loswerden oder zurücksetzen können, ohne jemanden zu fragen. |
| 26 | Eigene Stapel (z. B. „Kunde X“, „Messe“) | ja | fehlt | fehlt | **Muss** (Teil von Nr. 19) | Gehört zum Vokabeltrainer, wird dort mit geklärt. |
| 27 | **Neue Wörter auf Wunsch holen** (Atlas mit 8.000 Einträgen, Wörterbuch-Suche, Wort-Himmel) | ja (Atlas, „neue Wörter auf Abruf“ war mein ausdrücklicher Wunsch) | Atlas nur als Rohstoff; Deckel 5 neue am Tag, 20 je Woche (3.2) | fehlt | **Muss** | Ich will mehr neue Wörter, wenn ich Lust habe. Wenn das nicht geht, will ich wenigstens sehen, warum, und was stattdessen geht. |
| 28 | Wortschatztest (Größe schätzen) | ja | 9.3 (nur Woche 0 und 16, Teil der Einstufung) | fehlt | reicht im Konzept | Kommt mit der Einstufung (Nr. 8). |
| 29 | **Wort-Fenster für ein neues, unbekanntes Wort** (Bedeutung im Satz wählen, als Karte speichern, mehrere Wörter als Wendung markieren) | ja (Sinn-Auswahl seit v84, Mehrwort-Markierung) | Kap. 15 Nr. 11 „Wort-Antippen überall“ | H2 „Wort angetippt“ zeigt nur ein Wort, das ich schon kann | **Muss** | Der häufigste Griff beim Lesen: unbekanntes Wort antippen und speichern. Genau das zeigt die Vorschau nicht. |
| 30 | Einführungskarte für neue Wörter | ja | 3.2 | H2 „Neues Wort“ | abgedeckt | |
| 31 | Wort-Werkstatt (hartnäckige Wörter) | ja | 3.2 | nur Zeile unter „Wenn du mehr willst“ | **Soll** | Ich will sehen, was dort mit meinen Problemwörtern passiert. |
| 32 | Hörschleife (Wörter nacheinander anhören, z. B. im Auto) | ja (Wörter → Anhören) | fehlt | fehlt | **Soll** | Eine Funktion, die heute da ist und still verschwindet. |
| 33 | Eselsbrücke, Übersetzung des Beispielsatzes, Synonym-Prüfung | ja | fehlt | H2 „Mehr“-Blatt ohne diese Teile | **Soll** | Kleine Hilfen, die ich kenne. Eine Zeile im „Mehr“-Blatt reicht. |
| 34 | Satzbank (eigene gute Sätze markieren und freigeben) | ja | 3.5 | fehlt | reicht im Konzept | Läuft im Hintergrund. |
| 35 | Wörter-Filter nach Art und Herkunft (Wendungen, aus Mission, vom Lehrer, selbst gespeichert) | teils (Filter in der Liste) | fehlt | H12 filtert nur nach Stufe | **Soll** | Wo finde ich die Wendungen, die ich aus der Mission „mitgenommen“ habe? |
| 36 | Wörter als Anki-Datei exportieren | ja (Einstellungen → Daten) | fehlt | fehlt | **Soll** | Heute da, im Konzept nicht erwähnt. |

### 1c. Grammatik

| Nr | Funktion | Heute in der App | Im Konzept | In der Vorschau | Einstufung | Begründung aus Emrahs Sicht |
|---|---|---|---|---|---|---|
| 37 | Grammatik-Weg mit Kapiteln und „Du bist hier“ | ja | 4, 8.2 | H6, L4 | abgedeckt | |
| 38 | Erklärung mit Muster-Tabelle, „Problem zuerst“ | teils (Mini-Lektion) | 4.2 | H5 | abgedeckt | |
| 39 | **Ein Thema frei üben** (beliebiges Thema wählen, Extra-Runde, auch frühere Themen wiederholen) | ja (Grammatik → Thema → Üben, „Nochmal“) | fehlt (nur die Pflicht entscheidet) | fehlt (H6 hat keinen Übe-Knopf) | **Muss** | „Ich will heute nur Grammatik üben.“ Heute geht das, im Relaunch nicht. |
| 40 | Regeln nachschlagen ohne zu üben (Muster, Deutsch-Fallen, Struktur-Film) | ja (Wissen, Muster, Fallen, Struktur-Film) | Falle je Thema (4.2) | H5 nur innerhalb des Ablaufs | **Soll** | Vor dem Kundentermin will ich schnell nachlesen, wie „if“ mit „would“ geht. |
| 41 | **Deine Fehler** (Liste der Fehlersätze nach Thema: offen, behoben, wiederkehrend) | ja (Fortschritt → Fehler) | 7.2 nur als Speicher und Ablauf | fehlt | **Muss** | Wo sehe ich meine Fehler? Das ist eine der ersten Fragen jedes Lerners. |
| 42 | Auch richtig, Erklär mir meine Antwort, Warum diese Aufgabe | ja | 15 Nr. 2, 7.3 | H2 „auch richtig“, Menü „…“ | abgedeckt | |
| 43 | Übungsarten frei wählen (Wortpartner, Umformen, Wortform, Förmlicher sagen, Phrasal Verbs, Übergänge) | ja (Reiter Anwenden, 6 Trainings) | nur als Formen in der Pflicht (10) | fehlt | **Soll** | Heute kann ich gezielt „Phrasal Verbs“ üben. Im Konzept nur noch, wenn der Plan es will. |
| 44 | C1-Prüfungsformate frei üben (Umformen mit Schlüsselwort, Fehler finden, Kleines Wort, Passendes Wort) und Tempo-Runde | ja (Lernplattform 3.0, R1/R2) | nur in Tests und Meilensteinen (9.3) | fehlt | **Soll** | Ich habe für C1-Formate bezahlt, sie sollen frei erreichbar bleiben. |
| 45 | Sprint (Runde gegen die Zeit) | ja | fehlt; im Gesamtkonzept 04.10. (Kap. 10) gestrichen | fehlt | bewusst gestrichen | Grund: Zeitdruck kommt jetzt über Block 6 „Flüssigkeit“ und die Tempo-Runde. Das Konzept soll das in einem Satz sagen. |

### 1d. Praxis: Sprechen, Hören, Lesen, Schreiben

| Nr | Funktion | Heute in der App | Im Konzept | In der Vorschau | Einstufung | Begründung aus Emrahs Sicht |
|---|---|---|---|---|---|---|
| 46 | Rollenspiel mit Analyse und Abschlussbericht | ja | 6.3 (als Mission) | H11, L6 | abgedeckt | |
| 47 | Szenen frei auswählen („Alle“ unter Sprechen) | ja (Szenenliste) | 13.1 „Alle …“ | H13 „Alle“ tut nichts | **Soll** | Ich will eine bestimmte Szene üben, z. B. Preisverhandlung. |
| 48 | **Einwand-Training** (5 Stufen) und „Zeit gewinnen“ | ja (beides) | nur „Hot Seat“ als Form (10) und Einwände in den Szenarien (8.4) | nur Zeile „Hot Seat“ | **Muss** | Das hatte ich ausdrücklich als freiwilliges Sprechen behalten. Es steht nirgends mehr. |
| 49 | Hören: Mini-Diktat, Sprachnachrichten, Shadowing | teils (neu) | 5 | H7, H13 | abgedeckt | |
| 50 | Sag es (Diktat), Flüssigkeit | teils (neu) | 6.1, 6.2 | H8, H9 | abgedeckt | |
| 51 | Tagesartikel und Leser | ja | 15 „außerdem“ | H13 „Lesen“ | abgedeckt | |
| 52 | Kurse (Kursseite, Lektion), ältere Artikel | ja (Kurse K1, K5, Lese-Archiv) | 15 „außerdem“, 13.1 | nur Zeile „Kurse“ | **Soll** | Ich mache die Kurse gerade. Ich will sehen, wie Kursseite und Lektion künftig aussehen. |
| 53 | Satz-Klinik (eigenen Satz prüfen lassen) | ja | fehlt | fehlt | **Soll** | Vor einer echten Mail prüfe ich einen Satz. Passt als dritter Reiter ins Fragen-Blatt. |
| 54 | Mail-Werkstatt (eigene echte Mail verbessern) | ja | fehlt (nur die Übungs-Mail am Schreibtag, 2.5) | fehlt | **Soll** | Das ist der Nutzen für meinen Job. Die Wochen-Mail ist eine Übung, keine echte Mail. |
| 55 | Arbeitsalltag-Sätze, Kombi-Satz, Hörfrage im Reiter Anwenden | ja | Block 5 und Formenkatalog (2.2, 10) | H8 | reicht im Konzept | Geht in den neuen Blöcken auf. |
| 56 | Claude stellt mir eine Übung | ja (Claude-Übung) | 13.1 (Claude in der Übung) | H15 | reicht im Konzept | |

### 1e. Lehrer, Claude, Übersetzer

| Nr | Funktion | Heute in der App | Im Konzept | In der Vorschau | Einstufung | Begründung aus Emrahs Sicht |
|---|---|---|---|---|---|---|
| 57 | **Lehrer-Korrekturen einfügen** (Text aus Preply einfügen, App macht Fehlersätze und Karten daraus) | ja (Grammatik → „Lehrer-Feedback einfügen“) | nur als Herkunft in der Fehlerschleife (7.2) | fehlt | **Muss** | Jede Woche habe ich Preply. Wohin mit den Korrekturen? Das Gesamtkonzept hatte es ausdrücklich unter „Was bleibt“. |
| 58 | Preply-Zettel der Woche und Monatsformular des Lehrers | nein (neu) | 8.5 | fehlt | **Soll** | Neu und gut, aber ich will sehen, wie ich ihn meinem Lehrer gebe. |
| 59 | Claude fragen mit Kontext | ja | 13.1, 13.3 | H15, L7 | abgedeckt | |
| 60 | Übersetzer mit Alternativen, „In die Wörter“ | ja | 13.1 | H15 „Übersetzen“ | abgedeckt | |
| 61 | Rückgängig nach „In die Wörter“ | ja (Hinweis mit Rückgängig) | fehlt (das Gesamtkonzept hatte es) | fehlt | **Soll** | Ich tippe oft daneben. |
| 62 | Problem melden | ja | 14.1 | Menü „…“ | abgedeckt | |

### 1f. Fortschritt

| Nr | Funktion | Heute in der App | Im Konzept | In der Vorschau | Einstufung | Begründung aus Emrahs Sicht |
|---|---|---|---|---|---|---|
| 63 | Fortschritt-Übersicht mit C1-Schätzung und 4 Kacheln | ja (anders) | 9.2 | H14, L8 | abgedeckt | |
| 64 | Detailseiten für Wörter, Grammatik, Hören (C1-Karte, Kann-Beschreibungen, Kurven) | teils (Weg zu C1, Urteil) | 9.2 Nr. 3 | nur Sprechen (H14 „Detail Sprechen“) | **Soll** | Ich tippe zuerst auf „Wörter“, nicht auf „Sprechen“. |
| 65 | Verlauf (was habe ich wann gemacht, Tage im Kalender) | ja (Fortschritt → Verlauf) | fehlt (nur „Minuten nicht als Leistung“) | fehlt | **Soll** | Ich will sehen, was ich gestern und letzte Woche gemacht habe, auch ohne Leistungszahl. |
| 66 | KI-Urteil in Worten, Weg zu C1 | ja | 9.2, 9.3 | H14 oben | reicht im Konzept | |
| 67 | Messwerte (Behaltensquote, Minuten) | ja | 9.5 „Alle Messwerte“ | fehlt | reicht im Konzept | Kommt mit dem Wochenbericht (Nr. 12). |
| 68 | Tests freiwillig starten (C1-Check, Wortschatztest) | ja (Profil → Tests) | nur geplante Tests (9.3) | fehlt | **Soll** | Heute kann ich mich testen, wann ich will. Wenn das wegfällt, soll die App es sagen. |

### 1g. Einstellungen und Sicherheit

| Nr | Funktion | Heute in der App | Im Konzept | In der Vorschau | Einstufung | Begründung aus Emrahs Sicht |
|---|---|---|---|---|---|---|
| 69 | **Einstellungen-Bildschirm überhaupt** | ja (6 Gruppen: Lernen, Wörter, Stimme und Ton, Mein Kontext, Aussehen, Daten) | nur „Zahnrad oben rechts, mit Diagnose“ (9.2, 13.1) | fehlt (Zahnrad tut nichts) | **Muss** | Wo ändere ich etwas? Die einfachste Frage, und es gibt keine Antwort. |
| 70 | Sprache Deutsch/Englisch, Hell/Gedämpft/Dunkel/Automatisch | ja | 12 (nur Gestaltung) | nur als Schalter der Vorschau, nicht als Einstellung | **Muss** (Teil von Nr. 69) | |
| 71 | Farbwahl (4 Farbwelten) | ja | fehlt (Iris als feste Handlungsfarbe entschieden) | fehlt | **Soll** | Entscheiden und sagen: bleibt die Wahl oder fällt sie weg? |
| 72 | Stimme wählen und Probe hören, Sprechtempo | ja | 5.2 („sagt die App in den Einstellungen offen“) | fehlt | **Muss** (Teil von Nr. 69) | Am Handy klingt die Stimme oft schlecht. Ich muss sie wechseln können. |
| 73 | Klänge, Haptik, Effekte (mit Vorschau der Momente) | ja | 11, 13.1 (Haptik) | fehlt | **Muss** (Teil von Nr. 69) | Im Büro will ich den Ton aus haben. |
| 74 | Abfrageart und Richtung (Aufdecken/Tippen/automatisch, DE→EN, EN→DE, gemischt), Noten anzeigen | ja (Einstellungen → Wörter) | nur Anki-Modus in der Notentabelle (3.3) | fehlt | **Muss** (Teil von Nr. 19 und 69) | |
| 75 | Neue Wörter pro Tag, Tagesziel in Minuten | ja (einstellbar) | fest: 3–4 neue Wörter, 28 Min. (3.2, 19) | fehlt | **Muss** (Teil von Nr. 69) | Wenn es fest ist, will ich das in den Einstellungen lesen, statt den Regler zu suchen. |
| 76 | Mein Beruf (Branche, Rolle, Situationen) und freier Arbeitskontext | ja (Sätze werden darauf zugeschnitten) | fehlt (nur „Mein nächster Termin“) | fehlt | **Muss** (Teil von Nr. 69) | Davon hängt ab, ob die Sätze nach meinem Job klingen. |
| 77 | „Claude merkt sich“ ansehen und löschen | ja | 6.3 erwähnt ein Gedächtnis | fehlt | **Muss** (Teil von Nr. 69) | Ich will sehen und löschen können, was Claude über mich speichert. |
| 78 | Eingabe-Einstellung (Handy-Tastatur, Autokorrektur) | ja | fehlt | fehlt | **Soll** | |
| 79 | Auto-Weiter an/aus | ja | 7.2 Nr. 2: Rückmeldung bleibt, bis ich „Weiter“ tippe | fehlt | bewusst gestrichen | Grund: Ich soll das Warum immer lesen können. |
| 80 | **Datensicherung als Datei** (alles herunterladen) | ja (Einstellungen → Daten) | fehlt (nur „Sicherung vor jedem Live-Gang“, 14.1) | fehlt | **Muss** | Auftrag Kap. 6.14 verlangt es. Vor dem großen Umbau will ich selbst eine Sicherung ziehen können. |
| 81 | **Diagnose** (Version, Startzeit „Knopf nach x,x s“, Fehlerprotokoll, Dokumentzahl) | ja | 14.2 (ich soll ein Foto davon schicken) | fehlt | **Muss** | Ich soll nach Stufe 1 ein Foto schicken, finde die Seite aber nicht. |
| 82 | Quellen und Lizenzen | ja | fehlt (das Gesamtkonzept verlangte eine Quellenseite) | fehlt | **Soll** | Pflicht wegen der Wortlisten mit Namensnennung. |
| 83 | Stichprobe Satzbank, Prognose Dokumentzahl | ja | 14.1, 16.1 | fehlt | reicht im Konzept | Gehört in die Diagnose. |
| 84 | „Aus diesem Browser nachtragen“ (Rettung alter Kopien vom Umzug September) | ja | fehlt | fehlt | bewusst streichen (Vorschlag, Emrah bestätigt) | Grund: Der Umzug ist einen Monat her. Die Zeile wird nur noch selten gebraucht. |
| 85 | Profil-Blatt (Kopf links) mit Stand, Tests, Mehr | ja | 13.1: Kopf hat nur „Fragen“ | fehlt | bewusst gestrichen | Grund: ein Ort weniger. **Aber** seine Inhalte brauchen ein neues Zuhause: Stand → Fortschritt, Tests → Nr. 68, Mehr → Nr. 69. |
| 86 | Ausfälle (Claude weg, Vorlesen geht nicht, leere Liste) | ja | 14.1 | H16 | abgedeckt | |
| 87 | Ausfall „Speichern geht gerade nicht“ (Datenbank nicht erreichbar) | ja (Hinweis und Sperre) | 14.1 nur allgemein | fehlt | **Soll** | Der Fall, vor dem ich am meisten Angst habe: verliere ich gerade meinen Fortschritt? |

**Zählung der Tabelle:**
- **18 Muss-Lücken:** Nr. 7, 8, 9, 12, 14, 19, 22, 24, 25, 27, 29, 39, 41, 48, 57, 69, 80, 81. Dazu 8 Muss-Teile, die in Nr. 19 oder Nr. 69 stecken (Nr. 26, 70, 72–77).
- **27 Soll-Lücken:** Nr. 6, 10, 11, 13, 18, 23, 31, 32, 33, 35, 36, 40, 43, 44, 47, 52, 53, 54, 58, 61, 64, 65, 68, 71, 78, 82, 87.
- reicht im Konzept: 7 · bewusst gestrichen: 4 (davon 1 als Vorschlag) · abgedeckt: 23. Summe: 87 Funktionen.
- Dazu kommen 10 Erwartungen aus Abschnitt 3 (alle „Soll“).

---

## 2. Stille Verluste

Das sind Dinge, die die App **heute kann**, die das Konzept aber **weder übernimmt noch ausdrücklich streicht**. Sie sind am gefährlichsten: Emrah merkt es erst, wenn er sie sucht und sie weg sind.

**Die fünf wichtigsten:**

1. **Fast alle Einstellungen** (Nr. 69–78). Das Konzept sagt nur „Zahnrad mit Diagnose“. Heute gibt es: Sprache, Hell/Dunkel, Farbwahl, Stimme mit Probe, Klänge, Haptik, Effekte, Abfrageart und Richtung, neue Wörter pro Tag, Tagesziel, Lernzeit mit Erinnerungs-Anleitung, Eingabe-Einstellung, Mein Beruf, freier Arbeitskontext, „Claude merkt sich“, Datensicherung, Anki-Export, Quellen, Diagnose. Nichts davon ist im Konzept einer Gruppe zugeordnet.
2. **Wörter selbst verwalten** (Nr. 22–27). Hinzufügen, aus Text übernehmen, bearbeiten, ausblenden, „Kenne ich sicher“, „Morgen wieder“, „Von vorn“, löschen, eigene Stapel, Atlas mit Wörterbuch-Suche, neue Wörter auf Abruf. Im Konzept bestimmt der Plan allein, welche Wörter kommen. Emrahs ausdrücklicher Wunsch „neue Wörter auf Abruf“ widerspricht dem Deckel von 5 am Tag; das muss offen entschieden werden.
3. **Freies Üben außerhalb der Pflicht** (Nr. 39, 43, 44, 48). Grammatik-Thema frei wählen, die sechs Trainings, C1-Formate, Tempo-Runde, Einwand-Training, „Zeit gewinnen“. Das Konzept bietet nur „Wenn du mehr willst“ mit höchstens drei Einträgen (Lesen, Kurse, Wort-Werkstatt, Zusatzrunde). Das Einwand-Training hatte Emrah am 04.10. ausdrücklich als Extra behalten.
4. **Lehrer-Korrekturen einfügen, Fehler-Übersicht und Verlauf** (Nr. 41, 57, 65). Die Fehlerschleife ist im Konzept genau beschrieben, aber nur als Ablauf. Eine Seite „Deine Fehler“, den Verlauf und den Weg, Preply-Korrekturen einzufügen, gibt es nicht mehr. Das Gesamtkonzept hatte „Lehrer-Feedback einfügen“ noch unter „Was bleibt“.
5. **Datensicherung und Anki-Export** (Nr. 36, 80). Der Auftrag (Kap. 6.14) verlangt einen Datenexport als Datei. Das Konzept spricht nur von der Sicherung durch uns vor einem Live-Gang. Emrah selbst hätte keinen Knopf mehr.

**Weitere stille Verluste** (kleiner, aber vollständig):
- Hörschleife für Wörter (Nr. 32).
- Eselsbrücke, Übersetzung des Beispielsatzes, Synonym-Prüfung (Nr. 33).
- Struktur-Film und Nachschlagen von Mustern und Deutsch-Fallen ohne Übung (Nr. 40).
- Fokus für die nächste Woche selbst wählen (Nr. 13).
- Satz-Klinik und Mail-Werkstatt (Nr. 53, 54).
- Tests freiwillig starten: C1-Check, Wortschatztest (Nr. 68).
- Lese-Archiv und Kursseite mit Lektionen (Nr. 52; das Konzept nennt Kurse, zeigt aber nichts).
- Mein Beruf als Grundlage der Beispielsätze (Nr. 76).
- Farbwahl (Nr. 71), Eingabe-Einstellung (Nr. 78), Quellenseite (Nr. 82).
- Rückgängig nach dem Speichern eines Wortes (Nr. 61).
- „Aus diesem Browser nachtragen“ (Nr. 84; Vorschlag: bewusst streichen).

**Bitte ins Konzept:** Für jeden dieser Punkte gehört eine Zeile in Kapitel 15 („bleibt, und zwar hier: …“) oder in eine neue Liste „Fällt weg, weil …“. Dann gibt es keine stillen Verluste mehr.

---

## 3. Was Emrah als Nutzer erwarten würde

Das gibt es **weder heute noch im Konzept**. Maßstab: Emrah lernt jeden Tag 28 Minuten am Handy und kennt Speak, Duolingo, Anki, Lingvist und Busuu.

| Nr | Erwartung | Wie es andere machen | Einstufung | Vorschlag |
|---|---|---|---|---|
| E1 | **Urlaub oder Reise ankündigen** („nächste Woche 5 Tage weg“), damit danach kein Berg wartet | Duolingo: Serien-Schutz; Anki: Stapel pausieren | **Soll** | Eine Zeile in den Einstellungen und eine Variante von H1 „Urlaub angekündigt“. Die Serie ruht, Wiederholungen werden vorher leicht vorgezogen. |
| E2 | **Kurzer Tag auf Wunsch** („heute nur 10 Minuten“) | Speak und Busuu: Lerneinheiten in verschiedenen Längen | **Soll** | Auf Heute unter dem Knopf „Heute wenig Zeit?“: Pflicht anteilig kürzen, wie nach einer Pause (Konzept 2.4). Die Serie zählt. |
| E3 | **Ruhetag selbst wählen** (z. B. immer Sonntag) | Duolingo: Ruhetage planbar | **Soll** | Eine Zeile in den Einstellungen. |
| E4 | **„So funktioniert's“**: was heißt S0 bis S5, „bildest du selbst“, „auf dem Weg“, Ring, Serie, Mission, Meilenstein | Lingvist und Busuu: kurze Hilfeseiten | **Soll** (das Wichtigste davon gehört in den ersten Start, Nr. 7) | Eigene kleine Seite, erreichbar aus Fortschritt und den Einstellungen. |
| E5 | **Eine Suche für alles** (Wort, Grammatikthema, Fehlersatz) | Busuu, Lingvist: Suche im Wortschatz und in der Grammatik | **Soll** | Die Suche in Wörter findet auch Grammatikthemen und springt dorthin. |
| E6 | **„Meine Wendungen“**: gespeicherte Redemittel aus Missionen, Übersetzer, Lehrer an einem Ort | Speak: gespeicherte Ausdrücke | **Soll** | Filter in der Wörterliste nach Art und Herkunft (Nr. 35). |
| E7 | **Ziel ändern** (C1 bis wann, an wie vielen Tagen pro Woche) | Duolingo, Busuu: Lernziel einstellbar | **Soll** | Eine Zeile in den Einstellungen; die C1-Schätzung zeigt, was das Ziel verlangt. |
| E8 | **„Zu leicht“ / „Kenne ich längst“** bei jeder Aufgabe | Lingvist: „Wort kenne ich“; Busuu: Rückmeldung zur Schwierigkeit | **Soll** | Ein Eintrag im Menü „…“ der Übung. Das Wort springt einmal frei abgefragt nach vorn. |
| E9 | **Schriftgröße** | iOS-Apps folgen der Systemschrift | **Soll** | Die App folgt der Schriftgröße des iPhones; eine Probe in den Einstellungen. |
| E10 | **Den Preply-Zettel teilen** (kopieren oder als Datei an den Lehrer) | Busuu: Lernstand teilen | **Soll** (Teil von Nr. 58) | Knopf „Kopieren“ auf dem Zettel. |

Bei den Beispielfragen aus dem Auftrag sieht die Antwort so aus:
- **Wo ändere ich Einstellungen?** Heute: Profil → Einstellungen. Relaunch: Zahnrad auf Fortschritt, aber ohne Inhalt. → H17.
- **Wo sehe ich meine Fehler?** Heute: Fortschritt → Fehler. Relaunch: nirgends. → H23.
- **Wie suche ich ein Wort und lege es an?** Suchen geht (H12), Anlegen nicht. → H19.
- **Wie übe ich nur Grammatik?** Heute: Grammatik → Thema → Üben. Relaunch: gar nicht. → H24.
- **Was passiert nach einem verpassten Tag?** Gut gelöst (H1 „Aufholen“). Für lange Pausen fehlt ein Bild. → H1-Variante.
- **Wo liegen gespeicherte Wendungen?** Unklar, die Liste filtert nur nach Stufe. → Filter in H12, E6.
- **Wie sieht der allererste Start aus?** Nicht gezeigt. → H22.

---

## 4. Bildschirme, die Nora ergänzen muss (nach Wichtigkeit)

Die Codes setzen die Vorschau fort (Handy ab H17, Laptop ab L11). Varianten in Klammern.

### Muss

1. **H17 Einstellungen.** Erreichbar über das Zahnrad auf Fortschritt. Sechs Gruppen als Zeilenlisten: Lernen (neue Wörter pro Tag und Tagesdauer als feste Werte mit einem Satz Begründung, Lernzeit und Erinnerung, Ruhetag, Urlaub), Wörter (Abfrageart, Richtung, Anki-Modus), Stimme und Ton (Stimme mit Probe, Tempo, Klänge, Haptik, Effekte), Mein Kontext (Mein Beruf, freier Text, „Claude merkt sich“ mit Löschen), Aussehen (Sprache, Hell/Gedämpft/Dunkel, Farbe falls sie bleibt), Daten (Sicherung herunterladen, Anki-Export, Quellen, Diagnose). *Varianten:* Übersicht · Stimme gewählt mit Probe · Mein Kontext · Daten · Diagnose aufgeklappt mit „Knopf nach 1,8 s“.
2. **H18 Eigener Vokabeltrainer.** Bereits beauftragt; Lena und Mara spezifizieren ihn getrennt. Hier nur als Platzhalter in der Liste. *Varianten:* nach deren Spezifikation.
3. **H19 Wörter sammeln.** Aus der Wörterliste: Suche ohne Treffer bietet „Hinzufügen“ an; Blatt mit Wort, Bedeutung und Satz, Claude schlägt einen Satz vor. Dazu „Aus Text übernehmen“ und „Neue Wörter holen“ aus dem Atlas, mit ehrlicher Grenze („heute schon 5 neue; weitere kommen als ‚erkennst du‘ dazu“). *Varianten:* Suche ohne Treffer · Hinzufügen-Blatt · aus Text (markierte Wörter) · Neue Wörter holen · Hinweis „Gespeichert · Rückgängig“.
4. **H20 Wort verwalten.** Die Wort-Detailseite aus H12 bekommt ihre Aktionen: Bearbeiten (Bedeutung, Satz), Kenne ich sicher, Morgen wieder, Ausblenden, Von vorn, Löschen mit Rückfrage, Zu Stapel. *Varianten:* Aktionsliste · Bearbeiten · Löschen-Rückfrage · ausgeblendetes Wort.
5. **H21 Wort-Fenster für ein neues Wort.** Ein Wort, das noch nicht in meinen Wörtern ist: Bedeutungen zur Wahl, die passende zum Satz vorausgewählt, Knopf „In die Wörter“ (mit Ursprungssatz). Zwei Wörter nacheinander antippen markiert eine Wendung. *Varianten:* unbekanntes Wort · Bedeutung wählen · Wendung markiert · gespeichert.
6. **H22 Erster Start nach dem Umstieg.** Drei kurze Seiten: was neu ist; warum die Zahl „bildest du selbst“ jetzt kleiner ist („dein ehrlicher Startpunkt“, alle Wörter sind noch da); die Einstufung in Woche 0 mit ihren zwei Sitzungen. Dann das Ergebnis der Einstufung mit Ausgangswerten und Themenvorschlag. *Varianten:* Willkommen · ehrlicher Neustart · Einstufung Start · Einstufung mitten drin · Einstufung Ergebnis.
7. **H23 Deine Fehler.** Erreichbar über Grammatik und Fortschritt. Fehlersätze nach Thema gruppiert, getrennt in offen, behoben und wiederkehrend; ein Fehler geöffnet zeigt Originalsatz, Korrektur, Warum, Herkunft (Übung, Mission, Lehrer) und den nächsten Termin. *Varianten:* Liste · Fehler geöffnet · nichts offen.
8. **H24 Grammatik-Thema frei üben.** Im Reiter Grammatik ein Thema öffnen: Zustand, Regel in einem Satz, Knopf „Üben (Extra)“, „Erklärung lesen“, frühere Themen zum Wiederholen. Eine freie Runde endet mit einer kleinen Ergebnis-Karte, die als Extra zählt. *Varianten:* Thema geöffnet · freie Runde · Ergebnis Extra · Nachschlagen (Muster, Deutsch-Falle).
9. **H25 Lehrer.** Ein Ort für Preply. Korrekturen einfügen (beliebiger Text), die App schlägt Fehlersätze und Karten vor, ich bestätige. Dazu der Zettel der Woche mit „Kopieren“ und das Monatsformular. *Varianten:* Einfügen · Vorschlag bestätigen · Zettel der Woche · Monatsformular.
10. **H26 Sprechen: alle Einträge.** „Alle“ unter Praxis → Sprechen: Szenen frei wählen, Einwand-Training mit 5 Stufen, Zeit gewinnen, Hot Seat. *Varianten:* Liste · Einwand-Training Stufe 2 · Szene wählen.
11. **H27 Wochenabschluss.** Gemessener Fortschritt in Alltagssprache, höchstens drei Ampelzeilen, ein Satz, was die App angepasst hat, „Alle Messwerte“, die Wochenfrage und (wenn sie bleibt) die Fokuswahl für die nächste Woche. *Varianten:* Bericht · alle Messwerte · Fokus wählen.
12. **H28 Test-Ergebnis.** Für Themen-Test, Kapitel-Test und Meilenstein. Bestanden mit vorher → nachher; nicht bestanden mit „was fehlt“ und „nächster Versuch am …“, ohne Tadel. *Varianten:* Themen-Test bestanden · nicht bestanden · Kapitel abgeschlossen (Vollbild-Moment) · Meilenstein mit Kurve „Trend, nicht geeicht“.
13. **H29 Wochen-Mail am Handy.** Der Schreibtag in der Handy-Gestalt: Aufgabe, Schreiben mit offener Tastatur (Zielwörter haken sich ab), Rückmeldung in vier Kategorien zum Blättern. *Varianten:* Aufgabe · Schreiben · Rückmeldung Seite 1 · umformulierte Fassung.
14. **L11 Einstellungen am Laptop.** Gruppen links, Inhalt rechts; Diagnose als eigene Gruppe.
15. **L12 Wörter verwalten am Laptop.** Liste in der Bühne, Wort-Detail mit allen Aktionen in der Kontextspalte, „Hinzufügen“ oben.

### Soll

16. **H30 Mehr üben.** Die freie Bibliothek hinter „Wenn du mehr willst“ und dem Reiter Grammatik: die sechs Trainings, die C1-Formate, die Tempo-Runde, die Wort-Werkstatt, die Hörschleife. *Varianten:* Liste · Wort-Werkstatt · Ergebnis Extra.
17. **H31 Fortschritt-Details und Verlauf.** Detail Wörter (Balken, „auf dem Weg“, Zuwachs), Detail Grammatik (C1-Karte mit „Abgeschlossen heißt …“), Detail Hören, Verlauf als Kalender mit den Tagen. *Varianten:* Wörter · Grammatik · Hören · Verlauf.
18. **H32 Lesen: Kurse und Archiv.** Kursseite mit Lektionen und Stand, eine Lektion, ältere Tagesartikel. *Varianten:* Kursseite · Lektion · Archiv.
19. **H33 Fragen-Blatt, dritter Reiter „Prüfen“.** Satz-Klinik und Mail-Werkstatt: eigenen Satz oder eigene Mail einfügen, verbesserte Fassung mit Warum, Wendungen in die Wörter. *Varianten:* Satz prüfen · Mail verbessern.
20. **H34 So funktioniert's.** Eine ruhige Seite: Stufen S0 bis S5, Ring, Serie, Mission, Meilenstein. *Varianten:* Übersicht · Stufen.
21. **Neue Varianten an bestehenden Bildschirmen.** H1 „nach langer Pause“, H1 „Urlaub angekündigt“, H1 „Heute wenig Zeit“; H2 „Mehr“-Blatt mit Eselsbrücke und Satzübersetzung; H12 Filter „Wendungen · vom Lehrer · selbst gespeichert“; H15 „In die Wörter“ mit „Rückgängig“; H16 „Speichern geht gerade nicht“.
22. **L13 Deine Fehler und Grammatik-Thema am Laptop**, **L14 Wochenabschluss am Laptop.**

**Bitte an das Team:** Wenn ein Muss-Bildschirm bewusst nicht kommen soll, wird er mit Grund unter „bewusst gestrichen“ eingetragen und Emrah in einem Satz gesagt. Still weglassen ist keine Option.
