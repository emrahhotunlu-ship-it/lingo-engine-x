# Großpaket P „Politur“ (Plan, 13.11.2026)

Auftrag Emrah 13.11.2026 (Wortlaut im Chat): „einmal komplett polieren … Logiken … UI und UX deutlich verbessern, Design für Laptop, iPhone Duo … wie man Wörter lernt, sehr effektiv, wie man Grammar lernt (immer noch nicht richtig gut gelöst), Anwenden, wo ich Grammar und Vokabeln, die ich lerne … anwenden muss“. Grundlage: vier Prüfberichte `audits.md` (UX/Design Note 6/10; Wörter; Grammatik; Anwenden) und Emrahs echte Lerndaten.

## Leitidee
Ein Tag = **Wörter (70 %) → Grammatik (20 %) → Anwenden (10 %)**, und alle drei hängen zusammen: Grammatik übt EIN Thema über mehrere Tage, Anwenden benutzt genau dieses Thema und Wörter, die gerade gelernt werden; was dort richtig sitzt, zählt als Beleg.

## Pakete (parallel gebaut, getrennte Dateibereiche)

### P1 Design und Bedienung (alle Geräte: Außendisplay 375, Innendisplay 669, Laptop 1440)
1. Umformung: Baustein-Vorrat im Kartenfluss unter der Ablage, nie schwebend (`styles/parts/dz2.css:114-131`, `features/c1x/kinds/Kwt.tsx:126-129`).
2. Neue Karte beginnt immer oben (Kartenwechsel rollt an den Anfang; `ui/exercise/ExerciseShell.tsx:294`, `app/shell/Layers.tsx:105-113`).
3. Stift-Knopf in Übungen ins Menü „…“, sonst schmale Lasche am Rand, nie über der Karte (`styles/parts/shell.css:541-546`, `features/system/pen/PenMode.tsx`).
4. Ein Abschluss je Schritt statt zwei; Hauptknopf „Weiter: Grammatik/Anwenden“ (`modules/vocab/ui/LearnScreen.tsx:464-502`, `features/unit/UnitCard.tsx:80`, `ui/SessionEnd.tsx`).
5. Kurze Bildschirme (< 760 px Höhe): schlankere Leiste, „Weiter“ direkt unter dem Warum, Auswahl-Urteil verschiebt nichts (`ExerciseShell.tsx:562`, `styles/parts/kern.css`).
6. Ein Kopf für alle Übungen (✕ · Titel · Zähler · Claude-Symbol · …), feste Inhaltsbreite am Laptop (`ui/ExerciseBar.tsx:107-121`).
7. Widersprüche weg (Heute erledigt Minuten, „kommt morgen wieder“ vs. „Morgen: …“, Termin in der Vergangenheit, „zzz passt nicht in diesen Satz“, Zähler).
8. Einstellungen › Wörter: eine Hauptfrage, Rest unter „Erweitert“, Auswahlleisten ohne Umbruch, veraltete Texte raus.
9. Reiterleiste deckender, Innendisplay (Touch) Navigation unten statt Seitenleiste ohne Beschriftung.

### P2 Wörter lernen
1. **Wiederholungen zuerst** (≥ 60 % der Wörter-Zeit), neue = Rest (mind. 2), Einführung echt messen (`modules/vocab/domain/day.ts:70-98`, `ui/learnRun.ts:1300-1312`).
2. **Tempo nach Behalten**: neue Wörter je Tag aus „am Folgetag frei richtig“ der letzten 14 Tage (≥ 85 % +1, < 70 % −2, Grenzen 3–10).
3. Wendungen richtig benoten (`domain/flow.ts:121`, `domain/grade.ts:36`); Fehler → morgen wieder (`domain/planner.ts:247-286`).
4. **Hören**: Einführung liest Wort und Satz vor; Verstehen-Abfragen abwechselnd „Hören → Bedeutung“ und „Satz hören → Wort tippen“ (neue Karten in `flow.ts`/`LearnCard.tsx`, Notenregeln vorhanden).
5. „Kennst du es schon?“ vor der Einführung (fertige Probe-Logik `planner.ts:136-154`): bekannt → Kontrolle in 7 Tagen.
6. Auswahl-Karte: Ablenker aus eingeführten, ähnlichen Wörtern; falsche Wahl zeigt die Einführung kurz noch einmal.
7. Problemwörter ab dem 3. Vergessen: neuer Satz, Gegenüberstellung, Merkhilfe.

### P3 Grammatik lernen (Emrahs Weg ist die gemischte Runde mit Kapitel-Fokus, nicht das Buch)
1. **Ein Thema pro Runde in Lernstufen**: Aufwärmen (1–2 fällige Wiederholungen aus früheren Themen) → Fokus (3–4 Aufgaben EIN Thema, Stufe des Tages: Verstehen → Bilden → Umformen → Mischen) → nächster Tag baut darauf auf. Neues Thema immer mit kurzer Regel (Einführungskarten vorhanden, `features/grammar/SessionScreen.tsx:125-135`).
2. Schwache C1-Themen gezielt (Bedingungssätze, Partizipien, Modalverben, Passiv): Reihenfolge nach Bedarf, aber ein Thema bleibt, bis es sitzt.
3. Fehler aus dem Einstufungstest ruhen, bis ihr Thema eingeführt ist (`modules/grammar/domain/repairTasks.ts`, `features/grammar/session.ts:310-312`).
4. **Eine Fehler-Karte**: geprüfter Text sofort, Claude nur auf Tipp, Lösung einmal, ein Warum, flach (`features/grammar/MistakeCard.tsx`, `GrammarItem.tsx`).
5. Zeit ehrlich (angehängte Fehlersätze höchstens 2).
6. Grammatik-Reiter: ein Weg „Du bist hier: Thema · Tag 2 von 4“; Buch und Kapitel als Detail; Knopf „Themen-Test starten · 6 Aufgaben“.
7. Inhalts-Qualitätstor `content/grammar/tasks-v2.json` (Fehler finden/Umformen) mit `english-teacher`, zuerst die Aufgaben, die in Emrahs Themen drankommen; unfaire stilllegen (`retired.json`).

### P4 Anwenden als Brücke
1. **Täglich 2 Brücken-Sätze als Pflicht** (passt in 2–3 Min.): Satz 1 mit einem Wort, das gerade gelernt wird (Stufe 3–4), und dem Grammatik-Thema des Tages; Satz 2 mit einem Wort, das sitzt (Stufe 5–6), und einem sicheren früheren Muster. Mails/Zusammenfassung unter „Frei üben“ (volle Länge).
2. Vorgabe sichtbar: „Benutze: Wort (Bedeutung) · Muster (Formel)“.
3. Neue Vorlage `apply-bridge@1`: Urteil je Wort und je Muster mit einem Satz Grund + „Merk dir: …“.
4. Rückfluss: richtig benutztes Wort ab Stufe 5 zählt für „frei verwendet“ (Stufe 7), Muster bekommt einen Beleg (eigener Zähler, kein BKT); falsch → Fehlersatz mit Muster und Kontext. Ergänzend, nichts wird gelöscht (data-guard).
5. Mail-Vorlagen @3: Wörter mit Bedeutung übergeben, `used` mit Grund.

## Vorgehen
- Vier Bau-Helfer parallel (Fable, hoch), je Paket ein eigener Zweig/Arbeitsordner; ich führe zusammen, prüfe, löse Konflikte.
- Prüfer: ux-reviewer (P1 nach dem Bau, alle drei Geräte), learning-scientist (P2/P4), english-teacher (P3 Inhalte, P4 Vorlage), data-guard (P2/P4 Rückfluss), platform-guard vor dem Test-Link. Je Prüfer eine Prüfung + eine Nachprüfung.
- Ein Test-Link am Ende; live nur nach „Ja live nehmen“.

## Was sich nicht ändert
Lernstände, Serie, Wörter-Listen, Stimme, Stift, 70/20/10, Tageswechsel 04:00. Nichts wird gelöscht.

## Offene Entscheidungen (Emrah)
E1 Grammatik ein Thema über mehrere Tage · E2 Anwenden = 2 Brücken-Sätze täglich, Mails freiwillig · E3 neue Wörter nach Behalten + Hören · E4 Stift-Knopf ins Menü.
