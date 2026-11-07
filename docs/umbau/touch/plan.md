# Großpaket T – Touch-Bedienung nach Richtlinien (07.11.2026)

Auslöser: Emrah, iPad/„iPhone Duo“ hochkant, 7 Fotos der Wörter-Runde: „jedes Mal geht die Tastatur auf und man sieht nicht mehr alles … Objekte ragen aus Objekten raus … ich finde das ganze UI und vor allem UX nicht gut … da gibt es doch bestimmt Richtlinien“.
Entscheidungen (alle „A“, `docs/entscheidungen.md` 07.11.2026): Tastatur erst auf Tippen · Rückmeldung kurz + Aufklappen · Paket vor „Dein Können“.
Grundlage: `docs/umbau/fokus2/ui-standard.md` (bleibt gültig) + Prüfliste `pruefliste.md` (neu, enger auf Touch und Tastatur).

## Befunde aus den Fotos (Ist)
| # | Was Emrah sieht | Ursache | Regel |
|---|---|---|---|
| B1 | Tastatur geht bei jeder Karte sofort auf, halbe Karte verdeckt | `api.focusNow()` beim Kartenwechsel (LearnCard, LearnScreen-Start, `next`) | HIG: Tastatur nur auf Absicht; nichts Wichtiges verdecken |
| B2 | iOS-Leiste (Pfeile/Haken) liegt auf „Prüfen“ | Knopfleiste kennt `visualViewport` nicht | HIG Keyboard avoidance |
| B3 | „Weiß ich nicht“ sitzt auf der Kante eines inneren Kastens | Kasten in Kasten (Karte › Aktionsfläche), negative Ränder | M3: eine Fläche je Ebene; Nielsen „Ästhetik/Minimalismus“ |
| B4 | „Noch nicht richtig“-Streifen unten abgeschnitten | Urteil als eigener Kopf mit eckiger Unterkante über dem Inhalt | Gestalt: geschlossene Form |
| B5 | Nach Fehler: Warum + Nachtippen + Claude-Skelett + ganze Wortkarte gleichzeitig | alles sofort offen, Claude startet von selbst | NN/g Progressive Disclosure |
| B6 | 3 Zeilen Text vor der Aufgabe („Wörter · Wiederholung“, Zweck, Aufgabe, Gesucht) | Kopfzeilen immer sichtbar | ein Blick = eine Aufgabe |
| B7 | „He ? (feel) tired lately.“ als Wort-Satz | Wort aus Grammatik-Übung gespeichert, Übungssatz mit Lücke/Hinweis als `ex` | Inhalt: natürlicher, vollständiger Satz |

## Schritte (je Schritt Ergebnis + Test)
- **T0 Prüfliste** `docs/umbau/touch/pruefliste.md`: 20 prüfbare Punkte (HIG, M3, NN/g, WCAG 2.2), je Punkt „wie gemessen“.
- **T1 Satz-Fehler (B7):**
  - Übungssätze (Lücke `?`/`___`/`…`, Hinweis „(feel)“) nie als Abfragesatz, auch rückwirkend.
  - Beim Speichern aus einer Übung wird der vollständige Satz genommen bzw. keiner.
- **T2 Tastatur (B1, B2):**
  - Am Touch-Gerät (`useInputProfile() !== 'keys'`) kein automatisches Fokussieren mehr. Die Lücke zeigt „Tippen zum Schreiben“, und ein Tipp öffnet die Tastatur.
  - Ist die Tastatur offen (`visualViewport`):
    - Die Karte rückt zusammen, die Kopfzeilen sind aus.
    - Die Knopfleiste sitzt direkt über Tastatur und iOS-Leiste.
    - Die Lücke bleibt sichtbar.
  - Laptop unverändert.
  - Gilt für Wörter, Grammatik und Anwenden.
- **T3 Eine Fläche (B3, B4, B6):**
  - Karte ohne inneren Aktionskasten.
  - Knöpfe in einer Zeile mit Kartenpolster.
  - Urteil als Zeile in der Karte, nicht als abgeschnittener Kopf.
  - Kopf: höchstens eine Zeile Status. Die Zweckzeile steht nur beim ersten Auftreten einer Aufgabenart.
- **T4 Rückmeldung kurz (B5):**
  - Sofort sichtbar: Urteil, Lösung im Satz, ein Satz Warum, Nachtippen (bei Fehler) und Hauptknopf.
  - Eingeklappt unter „Mehr zum Wort“: Wortkarte, Beispiele und Claude-Erklärung. Claude startet erst beim Aufklappen oder bei „Frag Claude“.
  - Grammatik und Anwenden bekommen dieselbe Ordnung.
- **T5 Prüfung:**
  - Bildschirmfotos auf iPad hochkant (744 × 1133) und iPhone (390 × 844), jeweils mit und ohne simulierte Tastatur, für alle Kartenarten und Zustände.
  - Dazu ux-reviewer gegen die Prüfliste, learning-scientist (Rückmeldung eingeklappt: die vier Pflichtfragen bleiben beantwortet), Tests und platform-guard.
  - Danach ein Test-Link.

## Nicht in T
„Dein Können“ (danach), K14 großer Bildschirm, Ladezeiten.
