# Prüfliste Touch-Bedienung (Großpaket T, 07.11.2026)

Die Liste ergänzt `docs/umbau/fokus2/ui-standard.md` für Touch und Tastatur. Grundlagen:
- Apple Human Interface Guidelines (Layout, Keyboards, Buttons, Feedback)
- Material Design 3 (Layout, Buttons, Text fields)
- Nielsen Norman Group (10 Heuristiken, Progressive Disclosure, Mobile Forms)
- WCAG 2.2 AA (2.5.8 Target Size, 1.4.10 Reflow, 3.2.1/3.2.2 On Focus/On Input)

Geprüft wird jede Übungskarte von Wörter, Grammatik und Anwenden, jeweils:
- auf **iPad hochkant (704 × 1000)** und **iPhone (390 × 844)**,
- mit Touch-Bedienung (`lx:input = touch`),
- mit und ohne simulierte Tastatur (Höhe × 0,58),
- in jedem Zustand: Aufgabe, Tippen, Ergebnis richtig, Ergebnis falsch, „Mehr“ offen.

Je Punkt gilt Bestanden oder Nicht bestanden, mit Bildschirmfoto.

## A. Tastatur (HIG Keyboards; WCAG 3.2.1)
1. **Keine Tastatur ohne Absicht.** Eine neue Karte, „Weiter“, „Tipp“ oder ein Fehler öffnen am Touch-Gerät keine Tastatur. Nur ein Tipp auf die Lücke oder das Feld öffnet sie. Gemessen wird `document.activeElement` nach dem Kartenwechsel: nicht `gap-input`.
2. **Die Lücke lädt ein.** Eine leere Lücke ohne Fokus zeigt am Touch-Gerät eine pulsierende Linie (`data-idle`). Bei reduzierter Bewegung pulsiert sie nicht.
3. **Eingabetaste = Hauptknopf.** Die Eingabetaste prüft, danach schließt die Tastatur (Entscheidung 05.11.).
4. **Mit offener Tastatur** bleiben Satz und Lücke sichtbar. Prüfen geht per Eingabetaste, auch wenn der Knopf verdeckt ist.

## B. Fläche und Ordnung (M3 Layout; Nielsen #8 Ästhetik/Minimalismus)
5. **Eine Fläche je Ebene.** Kein Kasten in einem Kasten mit eigenem Rand oder Schatten. Ruhige Flächen ohne Rand für „Warum“ und „Regel“ sind erlaubt.
6. **Nichts ragt über eine Kante.** Jeder Knopf liegt mit mindestens 8 px Abstand innerhalb seiner Fläche. Gemessen wird das Rechteck des Knopfs gegen das Rechteck der Karte.
7. **Geschlossene Formen.** Das Urteil steht oben IN der Rückmeldekarte. Diese Karte ist rundum gerahmt, nichts ist unten offen oder abgeschnitten.
8. **Feste Reihenfolge der Rückmeldung:**
   1. Urteil
   2. Lösung im Satz
   3. Warum
   4. Regel (Grammatik)
   5. Nachtippen oder Handlung
   6. „Mehr“
   7. „Kommt wieder …“
   8. Hauptknopf
9. **Nichts doppelt.** Der Bereichsname steht nur in der Übungsleiste, nicht noch einmal in der Statuszeile.

## C. Menge (NN/g Progressive Disclosure)
10. **Kopf der Aufgabe höchstens drei Zeilen** vor dem Satz. Die Zweckzeile steht offen nur bei der ersten Karte einer Art, danach hinter „Wozu?“ an derselben Stelle.
11. **Ergebnis kurz.** Sofort sichtbar sind nur die Punkte 1–5 aus B8 und der Hauptknopf.
    - Bei Wörtern stehen Wortkarte, weitere Beispiele und Claudes Erklärung unter „Mehr zum Wort“.
    - Claude startet erst beim Aufklappen.
12. **Richtig auf einen Blick.** Die richtige Antwort braucht am iPad keinen Bildlauf bis „Weiter“.

## D. Bedienelemente (HIG Buttons; WCAG 2.5.8)
13. **Tippflächen mindestens 44 × 44 px**, der Hauptknopf ist mindestens 52 px hoch, mit mindestens 8 px Abstand zwischen Knöpfen.
14. **Genau ein Hauptknopf** je Zustand. Nebenknöpfe sind leise.
15. **Knopfzeile ohne eigene Fläche.** Am Touch-Gerät haftet sie nicht und schwebt nie über Text.

## E. Inhalt
16. **Abfragesätze sind ganze, natürliche Sätze.** Sie enthalten nie eine Übungslücke („?“, „___“, „…“) und nie einen Verb-Hinweis in Klammern („(feel)“).
17. **Ein Wort, das aus einer Übung gespeichert wird,** bekommt nie den Übungssatz als Beispielsatz.

## F. Barrierefreiheit und Sprache
18. Die Liste wird in den Modi Dunkel, Gedämpft und Hell geprüft. axe meldet keine Verstöße (wcag2a/aa) auf Aufgabe und Ergebnis.
19. Ausgeblendete Teile bleiben für Vorleseprogramme erreichbar:
    - Bereichsname,
    - Zweck über „Wozu?“,
    - „Mehr“ mit `aria-expanded`.
20. Deutsch und Englisch haben dieselbe Ordnung; kein Text ist abgeschnitten.
