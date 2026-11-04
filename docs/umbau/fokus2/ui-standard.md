# UI-Standard Lingo (Fokus 2.0, 04.11.2026)

Emrah 04.11.2026: „Welche Schriftgröße sollte welcher Text haben? Ist es leicht und übersichtlich? Bequem fürs Auge? Intuitiv? Befolge die Regeln moderner und guter Software … achte auch auf Logik und qualitativen Inhalt sowie Aufgaben!“
Grundlage: Apple Human Interface Guidelines (Typografie/Dynamic Type, Layout, Tastatur), Material Design 3 (Type Scale, 8-dp-Raster, Zustände), Nielsens 10 Heuristiken, WCAG 2.2 AA. **Jeder Bildschirm von Wörter, Grammatik, Anwenden und Heute wird gegen diese Liste gebaut und geprüft (ux-reviewer: Bestanden/Nicht bestanden je Punkt).**

## 1. Schrift: EINE Größenreihe (Ist-Zustand: ~40 verschiedene Größen → Ziel: 6 Rollen)
| Rolle | Wofür | Handy (< 768) | Tablet/iPhone aufgeklappt, Laptop | Gewicht | Zeilenhöhe |
|---|---|---|---|---|---|
| **Hauptinhalt** | der Satz mit Lücke, das Stichwort, die deutsche Vorgabe – das, worum es geht | 24 px | 28 px | 500 (Stichwort 600) | 1.35 |
| **Titel** | Seitentitel („Heute“, „Wörter“), Lösung im Urteilsstreifen | 22 px | 24 px | 600 | 1.3 |
| **Aufgabe** | „Setz das fehlende Wort ein.“, Kartenüberschriften | 17 px | 18 px | 600 | 1.4 |
| **Text** | Erklärung „Warum“, Bedeutung, Beispielsätze, Knöpfe | 17 px | 17 px | 400 | 1.5 |
| **Hinweis** | „Gesucht: …“, Übersetzung, Zweck-Zeile, Kommt-wieder-Zeile | 15 px | 15 px | 400 | 1.45 |
| **Klein** | Statuszeile, Überzeilen („DAS WORT“), Lautschrift/Wortart | 13 px | 13 px | 500 | 1.35 |
Regeln: nie unter 13 px; höchstens **4 Rollen je Karte**; Großbuchstaben-Überzeilen nur in „Klein“ mit Laufweite; Antwort in der Lücke = Größe des Hauptinhalts; Lösung nie größer als der Satz.

## 2. Raster, Abstände, Breite
- 8-px-Raster: Abstände 4 · 8 · 12 · 16 · 24 · 32. Kartenpolster 20 (Handy) / 24 (ab 768).
- Abstand zwischen Gruppen (Status → Aufgabe → Hinweis → Satz → Knöpfe) **24**, innerhalb einer Gruppe **8**.
- Zeilenlänge Fließtext höchstens ~70 Zeichen (max. 40 rem); Karten nie volle 2560 px breit.
- Kein Leerraum ohne Zweck: Inhalt beginnt oben, Knöpfe folgen direkt dem Inhalt (keine feste Leiste am Touch-Gerät).

## 3. Bedienung (Touch, Tastatur)
- Tippflächen ≥ 44 × 44 px; Hauptknopf 52 px hoch; **genau ein Hauptknopf** je Zustand.
- Bildschirmtastatur: Aufgabe, Eingabe und Hauptknopf bleiben darüber sichtbar; Eingabetaste = Hauptknopf. Keine Autofill-/Kontaktvorschläge.
- Schreibmarke steht in der Eingabe auf Schrifthöhe; Eingabefeld ist das auffälligste Bedienelement der Karte.
- Zustände sichtbar: gedrückt, gesperrt (mit Grund), lädt (Skelett, kein Spinner).

## 4. Klarheit (Nielsen)
- Jede Zeile hat eine Aufgabe; nichts doppelt (kein „Wörter“ zweimal, kein Zähler zweimal).
- Keine unerklärten Zeichen (Punkte, Kreise, Farben ohne Bedeutung).
- Sprache des Nutzers: keine Fachwörter („Abruf“, „Spur“, „Stufe 4“) in der Oberfläche.
- Nach dem Prüfen in fester Reihenfolge: Urteil → deine Antwort/Lösung im Satz → Warum (1–2 Sätze, passend zur eigenen Antwort) → Merke/Beispiel → „Mehr“ eingeklappt.
- Fehler verhindern: eindeutige Aufgabe (eine Lösung, Hinweis sichtbar), keine Fangfragen.

## 5. Farbe und Kontrast
- Text ≥ 4,5 : 1, große Schrift ≥ 3 : 1, auch Hinweis-Text im Glas; Farbe nie allein Bedeutungsträger (✓/✕ + Wort).
- Akzent nur für Hauptknopf, Lücke und Markierung; Grün/Rot nur für richtig/falsch.

## 6. Logik (Kap. 2 Nr. 2, Kap. 15)
- Ein Zähler je Sache, eine Quelle (Heute und Runde zählen dieselben Wörter); Gesamtzahl wächst nie durch Fehler.
- Erledigt = Zustand, kein Knopf; Fortsetzen nach Verlassen; nichts würfelt sich neu.
- Statuswörter stimmen (heute eingeführt ≠ „Wiederholung“).

## 7. Inhalt und Aufgaben
- Jede Aufgabe: natürlicher Satz, eine eindeutige Lösung, Hinweis passt zur Lösung (Wortart, Form), US-Englisch (britisch gilt als richtig).
- Neues Wort: Bedeutung, ein Beispielsatz aus dem Berufsalltag, typische Wortpartner; fehlt ein Satz, wird keiner erfunden, aber geprüft nachgeliefert.
- Erklärungen kurz, auf die eigene Antwort bezogen, nie abgeschnitten.
- Prüfung: english-teacher-Stichprobe je Kartenart vor jedem Test-Link.
