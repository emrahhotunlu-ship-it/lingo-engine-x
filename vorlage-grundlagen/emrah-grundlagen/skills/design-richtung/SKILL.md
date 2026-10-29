---
name: design-richtung
description: Legt eine eigenständige, hochwertige Design-Richtung fest, bevor Oberflächen gebaut oder umgebaut werden – Vorbilder, eine Musterseite zum Abnicken, Design-Tokens, Bewegung und alle Zustände – und schreibt sie nach docs/design.md. Einsetzen bei "sieht nicht gut aus", "premium", "outstanding", "neues Design", bei einer neuen App oder einem großen Umbau der Oberfläche.
---

# Design-Richtung

Ohne Vorbild baut KI ordentlichen Durchschnitt. Dieser Skill legt zuerst einen klaren Geschmack fest und baut erst danach.

## Ablauf

1. **Kern lesen:** `docs/produkt.md`. Das Gefühl der Oberfläche muss zum Versprechen passen (ruhig und präzise, warm und persönlich, schnell und kraftvoll …).
2. **Vorbilder:** Emrah um drei bis fünf Screenshots von Apps bitten, die er großartig findet. Hat er keine, schlag drei bekannte Vorbilder vor, die zum Kern passen, mit je einem Satz, warum. Je Vorbild festhalten, was genau gut ist: Schrift, Abstände, Farbe, Dichte, Bewegung, Ton der Texte.
3. **Zwei Richtungen:** Zwei deutlich verschiedene Richtungen in je drei Zeilen beschreiben (Name, Gefühl, Merkmale) und eine davon empfehlen.
4. **Musterseite:** Genau eine Seite bauen, mit echtem Inhalt der App (kein Platzhaltertext). Sie enthält das wichtigste Element des Hauptbildschirms, Farbpalette, Schriftskala, Knöpfe in allen Zuständen, eine Karte, eine Liste, einen leeren Zustand, ein Lade-Skelett, einen Fehler, eine besondere Mikro-Animation, Hell und Dunkel. Emrah als Screenshot oder Artefakt zeigen. Höchstens zwei Runden bis zu seinem Ja.
5. **Festschreiben:** `docs/design.md` mit:
   - Tokens: Farben als Rollen (Hintergrund, Fläche, Text, gedämpft, Akzent, Erfolg, Warnung), Schriftskala, Abstände im 4/8-Raster, Radien, Ebenen und Schatten, Bewegung (Dauer, Kurven).
   - Regeln mit Do und Don't.
   - Die Erkennungsmerkmale: zwei bis drei Details, die die App unverwechselbar machen.
6. Ist der Skill `frontend-design` verfügbar, beim Bauen zusätzlich dessen Regeln anwenden.

## Prüfliste „hochwertig statt KI-Look“

- Keine typische KI-Optik: kein beliebiger Blau-Lila-Verlauf, keine Emojis als Symbole, keine Karten in Karten, kein Text in Riesengröße ohne Grund, keine zufälligen Schatten.
- Klare Schrifthierarchie mit fester Skala; Zahlen in Tabellenziffern; Zeilen 45–75 Zeichen lang.
- Großzügiger Weißraum, ein konsequentes Raster, pixelgenaue Ausrichtung.
- Farbe sparsam: eine Akzentfarbe, die immer dasselbe bedeutet.
- Jeder Zustand ist gestaltet: leer, lädt, Fehler, Erfolg, offline, sehr viel Inhalt, sehr wenig Inhalt.
- Bewegung mit Zweck: 150–250 ms, weich auslaufend, Ursache und Wirkung sichtbar; „reduzierte Bewegung“ beachten.
- Touch zuerst: Tippziele mindestens 44 px, wichtige Knöpfe in Daumenreichweite, Rückmeldung in unter 100 ms.
- Texte kurz, menschlich und konkret. Kein Platzhaltertext, keine Fachbegriffe.
- Ein Detail, das man sich merkt.
