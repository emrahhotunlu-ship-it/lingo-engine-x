# Großpaket G – Grammatik + Wiederholen neu (Refinement, Entwurf 02.11.2026)

Grundlage: `g0-bestand.md` (Bestandsaufnahme mit Belegen). Vorbild: Wörter-App (`src/modules/vocab`, Ablauf `docs/umbau/vokabeln/grosspaket-a.md`).
Status: **Entwurf an Emrah**. Gebaut wird erst nach seinem OK.

## Warum
- **Fehlerquote:** In der Stichprobe hatten rund 14 % der Grammatik-Aufgaben Befunde, 5 % waren hart falsch. Das ist etwa eine kaputte Aufgabe pro Tag.
  - Ursache: Antwortlisten sind aus dem Gedächtnis geschrieben, niemand hat die Aufgaben blind gelöst.
- **Bewertung:** Zwei Bewertungswege (`check.ts`, `scoreC1`) laufen in einem 1.258-Zeilen-Bildschirm. Die Claude-Zweitmeinung prüft nur wenige Aufgabenarten.
- **Melden:** Meldungen landen in `app/c1.bad`, niemand wertet sie aus. Die gemeldete Aufgabe zählt trotzdem.
- **Fehlersätze:** Eigene Fehlersätze aus Anwenden haben keinen Pflichtweg mehr (LS5).
- **Reiter:** Der Grammatik-Reiter beginnt mit „Test starten“, darunter steht eine zweite Themenliste, und die Fehlersätze stehen an zwei Orten (M12).

## Schritte
| | Schritt | Inhalt |
|---|---|---|
| G1 | Aufgaben-Prüfung | Jede Aufgabe (~2.900) wird blind gelöst. Abweichungen gehen an den Lehrer. Kaputte Aufgaben werden repariert oder fliegen raus. Die offenen Einzelfälle werden behoben („studied“, verratener Hinweis, Fallen-Alternativen, Emrahs drei Fälle). |
| G2 | Eine Bewertung | Ein Bewertungsweg für alle Arten. „Auch richtig“-Listen, britische Formen gelten. Claude-Zweitmeinung bei jeder unsicheren Antwort. Erklärung ohne Abschneiden und ohne Doppel. |
| G3 | Grammatik-Runde neu | Lernkarte im neuen Design wie in der Wörter-App: Aufgabe, Lösung in der Lücke, „Warum“, „Merke“, Band, Abschluss. Eigener Verlauf je Antwort (wie `vlog`). |
| G4 | Wiederholen neu | Eigene Fehler aus Grammatik und Anwenden kommen in einer festen Reihenfolge zurück, als Teil des Grammatik-Schritts. |
| G5 | Grammatik-Reiter neu | Ein Themen-Weg, Fehlersätze an einem Ort, kein „Test starten“ ganz oben. Dazu M10, M14, M15 und K-Punkte. |
| G6 | Melden richtig | „Aufgabe war unfair“: Die Antwort zählt nicht, der Eintrag bleibt im Verlauf. Wöchentliche Auswertung mit der Lehrer-Routine. |
| G7 | Fortschritt | Kennzahlen und Wochenrückblick (M11). |
| G8 | Schlussprüfung | Prüfung und **ein** Test-Link. |

## Was gleich bleibt
- Lernstand je Thema, Daten und Serie.
- Tagesweg mit 3 Schritten.
- Die Wörter-App.

Die neue Grammatik kommt wie die Wörter-App erst hinter einen Schalter. Rückweg: der alte Weg.

## Team
| Rolle | Aufgabe |
|---|---|
| english-teacher | Inhalte und Erklärungen |
| learning-scientist | Ablauf und Wiederholen |
| ux-reviewer | Bildschirme |
| data-guard | Daten |
| platform-guard | vor dem Test-Link |
| Helfer | blindes Lösen in Chargen |

Prüfmodus: Schnell-Modus.

## Risiken
- **Menge (G1):** 2.900 Aufgaben brauchen Zeit. Vorschlag: zuerst nur geprüfte Aufgaben ausspielen, ungeprüfte ruhen.
- **Zwei Wege parallel:** Bis zum Umschalten laufen alter und neuer Weg nebeneinander (Schalter wie bei der Wörter-App).
