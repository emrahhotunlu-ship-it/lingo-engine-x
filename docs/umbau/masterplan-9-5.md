# Masterplan „9,5 von 10“ (26.10.2026)

Anlass: Emrah bewertet die App mit 6/10 (UI/UX, Bedienung, Intelligenz/Logik, Vielfalt, roter Faden zu C1) und will 9,5/10.
Grundlage: vier Opus-Prüfungen vom 26.10. (Technik/Intelligenz, Lernmethoden, Inhaltsqualität, UI/UX – Letzte noch offen) und `feedback-sammlung.md`.

## Entscheidungen (Emrah, 26.10.2026, „Beides ja, kannst über Nacht anfangen“)
1. Pflicht darf von ~23 auf ~28 Minuten wachsen (Sprechen/Flüssigkeit ~4 Min, Input mit eigenen Lernwörtern ~5 Min). Ändert die Entscheidung vom 04.10. (Fokus nur Wörter/Grammatik).
2. Im Artefakt bleiben, kein Cloudflare-Umzug (neu prüfen nur bei Push/Aussprache-Bewertung).
3. Live nur nach ausdrücklichem „Ja live“; vorher ein Test-Link am Ende eines großen Pakets.

## Etappen (Reihenfolge verbindlich)
- **E1 Fertig und verlässlich** (zuerst): Qualitätstor für alle Inhalte (Pflicht-Erklärung je falscher Option, Gegenprobe Ablenker, Antwort-Varianten, Niveau-Prüfung, Ein-Fehler-Regel für Fehlersätze, Register/Denglisch, absolute Regeln „immer/nie/nur“, Dubletten, Rollen-Prüfung); `lintTask` wird Sperre; 4 klare Mängel + Items 5–11 des Lehrer-Audits sofort korrigieren; 125 leere Fehlerlisten (c1x) nachfüllen; Testorganisation (schneller Lauf <5 Min, Gesamtlauf nur vor Link, Wackler/perf.spec).
- **E2 Erklärung zur eigenen Antwort** automatisch, kurz, gespeichert, unter `tutorBudget`.
- **E3 Ein Lernbild für alles** (`act`, Diagnosen anschließen; Vokabelrunde und Tagesplan nutzen es; „Warum heute das?“).
- **E4 Flüssigkeit/Hören/Aussprache** (Sprech-Runde 4/3/2, Shadowing `nbdrill/shadow.ts`, Wortbetonung `stress.ts`, Input mit eigenen Lernwörtern, „Mein nächster Kundentermin“).
- **E5 Design 9,5** (nach UX-Audit: Hierarchie, Karten-System, Bewegung, Konsistenz, Ladezustände).
- **E6 Roter Faden C1** (sichtbarer Weg, Messpunkte alle 4 Wochen, R4 Messen).
- **E7 Initiative + E8-Lehrer-Routine** (nach Probelauf).

Messpunkte „9,5“: siehe Abschnitt Messen im Lernmethoden-Audit (Sprechprobe, Schreibprobe, Wortschatztest, Lehrerurteil alle 4 Wochen) plus Emrahs eigene Note nach jedem Link.

## UX-Audit 26.10. (Opus, Gesamtnote 5,5–6) – Kern
Hauptgründe „buggy/unfertig“: (1) Zahlen widersprechen sich (12 Min./52 Karten; 46/52/62 fällig; wachsender Zähler; 3 Zähler im Einwand-Training), (2) Ladezeit 2,4 s / ~5,8 s gebremst, leer, Knopf rutscht nach, (3) Ergebnis-Karten zu lang, Wort 5–6×, (4) falsch sieht grün aus, „Auch richtig“ erst rot dann grün, (5) Farbrollen zerfasert, (6) Wiederholungen und Textwände (Anwenden 15 Zeilen, Wörter-Reiter, Grammatik-Ende), (7) statisch (keine Abschlussmomente), (8) Scroll-Position bleibt, (9) nackte Textknöpfe, Chat als Desktop-Fenster, (10) Entwickler-Dinge in Einstellungen, (11) Hell/2560 px unfertig, (12) Textfehler („1 Züge“, „(have)“-Rest, „formeller discontinue.“).
Etappen: U1 Ehrlich (eine Quelle für Zahlen + Konsistenztest, falsch nie grün, Auch-richtig neutral, Scroll oben, Textfehler) · U2 Schnell (Start-Bild, feste Höhe, Code aufteilen) · U3 Rückmeldung (ein Bauplan, Ergebniskarte 3 Blöcke, Abschlussmomente) · U4 System (Farbrollen, Knopfarten, Chat als Blatt) · U5 Entrümpeln (Reiter, Fortschritt, Einstellungen→Diagnose) · U6 Lebendig (Übergänge, zählende Zahlen) · U7 Groß (1440/2560). Screenshots: Scratchpad `audit-ux/`.
