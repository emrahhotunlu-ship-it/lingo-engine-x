# Prüfung Nora (G2, ux-reviewer) – Test-Link 1a

Stand 28.10.2026, `dist` von `9bbad4d`. 390/1440 (Breitenproben 1024/1280/1920/2560), Dunkel/Gedämpft/Hell, DE/EN, Akzente Iris/Bernstein. Vergleichsliste `stufe1-plan.md` §6.7. (Datei von der Hauptsitzung aus dem Prüfbericht angelegt.)

**Vergleichsliste:** Heute ✅ (Soll S1), Skelett/Startbild ❌ (M1), Wörter-Übung ❌ (M2), Grammatik ✅ (Soll S4), Reiter Grammatik/Wörter/Praxis/Fortschritt ✅, Blatt Fragen ✅, Ausfälle teils (S6), Breitenproben ✅ (S3), Ergebnis-Karte ✅, Themenwahl ✅, Diktat ✅, Tastenhilfe ✅, verbotene Muster nur M1.

## Muss (Veto)
- **M1** Zahnrad im Ladezustand (Skelett, Startbild), `Shell.tsx:148`. → **behoben:** beim Laden leere `size-11`-Stelle wie `#lx-boot`; Einstellungen im ruhigen Hinweis „dauert länger“ (`HomeSkeleton.tsx`). Test `start.spec.ts`.
- **M2** Bei richtiger Antwort kein Warum (nur Merke), `ExerciseView.tsx:1273` (`verdict !== 'correct'`). → **behoben:** Bedingung gestrichen. Test `band.spec.ts` „richtig: Zeile 3 zeigt das Warum“.

## Soll (Backlog, mit 1b bzw. Stufe 2 klären)
- S1 Tageskarte zu hoch für wenige Schritte (feste `--lx-today-card-h`), Höhe aus Blockzahl.
- S2 Kontextspalte ≥ 1280 leer: Heute „Diese Woche“, Übung vor dem Prüfen „Wozu“.
- S3 Übung bei 2560: ~34 % ungenutzt (A4), `breiten.spec` auch für eine Übung.
- S4 Lösung erscheint ~1 s verzögert in der Lücke (Hauptfaden), Profil messen.
- S5 Doppeltes: „Deine Antwort … → overcame“ + „Richtig: overcame“ (1440); Satzliste im Mehr-Blatt; Menü „Mehr Infos“ doppelt „Mehr“, „Ich lag richtig“/„War das auch richtig?“ eindeutig benennen.
- S6 „Datenbank nicht verfügbar“ ohne „Erneut versuchen“; Karte bei 1440 nach 2,5 s blass.

## Kann
K1 Ergebnis-Karte „Zurück →“, Extra-Kennzeichnung · K2 Fluchtlinie Knopfzeile 1440 · K3 Hell: Nebenknöpfe wirken deaktiviert · K4 Hinweisrunde Lücke vs. Hinweistext · K5 „…“-Menü am Handy (8 Einträge, ohne Symbole) · K6 Diktat Kopfzeile „nicht geprüft“ neben ✓ (Linux), Versionsangabe gesperrt · K7 Rahmen (Logo, Einklappen, „Fragen“ ohne Beschriftung, Enter-Kappe, Radio-Kreise) · K8 Fragen-Blatt (doppelter Fokusrahmen, Chips ohne Verlauf) · K9 Serienzeile unverständlich, „items on the week“ · K10 Grammatik-Band an Zeilengrenze kappen.

**Veto: ja (M1, M2)** – Nachprüfung nur Skelett/Startbild 390/1440 und Wörter-Übung „Richtig“ 390/1440.
