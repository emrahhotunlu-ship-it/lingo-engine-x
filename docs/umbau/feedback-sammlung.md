# Emrahs Rückmeldungen – Sammlung für den Masterplan (nur anhängen)

Stand 26.10.2026. Emrah (26.10.): „Du sammelst das, was ich bisher und künftig gebe, dann machen wir einen Masterplan, wie wir es besser machen.“
Regel: Jede neue Rückmeldung (Screenshot oder Satz) wird hier unter dem passenden Thema angehängt, mit Datum und Kurzbefund. Der Masterplan entsteht, wenn Emrah „Masterplan jetzt“ sagt. Erledigt = live (Version), offen = noch nicht.

## Themen (Ursachen hinter den Einzelfällen)
- **T1 Inhaltsqualität**: Karten, Sätze, Bedeutungen und Beispiele passen nicht zusammen oder sind ungeprüft (KI-/Artikel-generiert, Seed, alte Daten).
- **T2 Eindeutigkeit der Aufgabe**: Man kann nicht erschließen, WAS gemeint ist (Lücke ohne Hinweis, mehrere Lösungen, Platzzahl unklar, Fehlersatz ohne erkennbaren Fehler).
- **T3 Erklärungen**: generisch, passen nicht zur eigenen Antwort, abgeschnitten, Fachsprache, widersprechen sich.
- **T4 Anzeige/Hierarchie**: Wesentliches nicht hervorgehoben, Doppelungen, Layout, Hintergrund.
- **T5 Lernwirkung**: Merken/Fest/Wiederholung, Schwierigkeit, Frust.
- **T6 Intelligenz der Engine**: App soll auf Emrah zuschneiden, nicht „starrer Code“.
- **T7 Arbeitsweise/Kosten/Tempo**: Dauer, Tokens, Tests, ein Link, Kommunikation in einfachen Worten.
- **T8 Ideen/Backlog**: Mehrwort-Markierung, Cloudflare/API, Microservice, Jarvis.

## Einzelfälle (Datum · Befund · Thema · Stand)
| Datum | Rückmeldung | Thema | Stand |
|---|---|---|---|
| bis 19.10. | Neue Wörter/Wendungen schwer zu merken; Status unstimmig; derselbe Satz immer wieder; „Fehler korrigieren“ unlösbar | T5 T1 T2 | live v81–v83 (FK, WL, ST, Wort-Lernen 2) |
| 19.10. | „Walking to work“: Fehler finden zu schwer; „had“ vs „used to have“: „woher soll ich schätzen, was du willst“ | T2 T3 | Engine v82 (Auch richtig, Zielform); Aufgabe „Walking“ noch nicht erleichtert |
| 19.10. | Aufgaben/Erklärungen nicht intelligent, „starrer Code“; will KI, die Fortschritt/Antworten/Interaktionen prüft und die App zuschneidet | T6 | Engine S0–S4 live v82; E8-Lehrer-Routine offen |
| 20.10. | Fehlersatz „by Friday“ → „until“ falsch gespeichert, Erklärung unpassend, unlösbar | T1 T2 T3 | Wächter live v82 |
| 21.10. | Bausteine „Viertelprozentpunkt“: Platzhalter-Zahl unklar, Lösung nicht herleitbar, alles rot | T2 T4 | live v83 |
| 21.10. | Hintergrund am großen Bildschirm unscharf (3. Meldung) | T4 | CSS-Verläufe live v83 (bitte weiter beobachten) |
| 21.10. | Wunsch: mehrere Wörter markieren, Bedeutung im Zusammenhang/Karte | T8 | live v83 |
| 21.10. | Merken von Wörtern reicht nicht; wissenschaftlich bessere Methoden prüfen (Opus) | T5 | Wort-Lernen 2 live v83; Wirkung beobachten |
| 21.10. | Testen dauert zu lange, verbrennt Tokens | T7 | Testorganisation offen (schneller Lauf, Wackler beheben) |
| 25.10. | Wort-Popup „declined“ zeigt Nomen „Rückgang“; Bedeutung passt nicht zum Satz | T1 | live v84 (4.400 Stellen noch unmarkiert falsch) |
| 25.10. | Einführungskarte „to adjust“: Bedeutung klein, „Adjusted earnings“ passt nicht zur Verb-Karte | T4 T1 | live v84 |
| 25.10. | Lücke „…technique and ___“ (attitude): kein deutscher Hinweis, abgeschnittener Auszug | T2 | live v84 |
| 26.10. | „adaptive attempts“ (Artikel-Karte): keine feste Wendung, Ablenker unpassend | T1 | live v85 (Routinen angepasst, Wirkung ab 27.10. prüfen) |
| 26.10. | „just announced“ (Satz umschreiben, JUST): Antwort richtig, Erklärung lobt „has just announced“ statt seiner Form | T3 | offen (Erklärung zur eigenen Antwort) |
| 26.10. | Frage: Prüfung/Erklärung/Generierung mit KI statt App-Logik? | T6 T8 | Antwort gegeben (Hybrid); erster Schritt = automatische Erklärung zur eigenen Antwort, offen |
| 26.10. | Fehlersatz „Have our figures in the balance sheet recovered?“ (aus deinem Text, Stelle 2 von 2): sehr schwer nachzuvollziehen. Befund: Fehlersatz mischt Grammatik („Is“→„Have“, Subjekt „figures“ Plural) und Tippfehler („sheed“→„sheet“) ohne erkennbaren Zusammenhang; „recover“ passt bei Zahlen kaum; Erklärung beginnt mit „Recover ist im richtigen Sinn“ (irrelevant) und ist abgeschnitten („nicht „Is…“); Warum-Text nennt die Regel nicht in einfachen Worten | T1 T2 T3 | offen |
| 26.10. | Cloudflare/API-Umzug und Microservice/Jarvis-Ideen erfragt | T8 | beantwortet; kein Umbau beschlossen |

## Offene Muster (Hypothesen für den Masterplan, noch nicht entschieden)
1. **Qualitäts-Tor für ALLE Inhalte** (nicht nur Wortkarten): jede Aufgabe/Erklärung durchläuft Regelprüfung + Lehrer-/KI-Gegenlesung vor dem Erscheinen (heute teils nur Stichprobe).
2. **Erklärung zur eigenen Antwort** statt Standardtext (automatisch kurz, gespeichert, Tagesgrenze, Prüfregeln als Sicherung).
3. **Eindeutigkeits-Prüfung** vor jeder Aufgabe (eine Lösung, Hinweis sichtbar, kein Tippfehler-Mix im Fehlersatz).
4. **Fehlersätze aus eigenen Texten** nur mit einem erkennbaren, erklärbaren Fehler (ein Fehler je Satz, Grund in einfachen Worten, nie abgeschnitten).
5. **Hierarchie in der Anzeige**: Antwort/Bedeutung zuerst, Regel in einem Satz, Details unter „Mehr“.
6. **Testorganisation**: schneller Lauf, Wackler beseitigen, ein Gesamtlauf nur vor dem Link.
