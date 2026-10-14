# Wörter aktivieren – Gesamtplan (14.10.2026, Lernwissenschaftler + Englischlehrer)

Emrahs Frage: Gelernte Wörter müssen aktiv und variabel benutzt werden (nicht immer derselbe Satz/dasselbe Muster), ohne Mikrofon, nur am Handy.

## Befund (beide Fachleute übereinstimmend)
- Die Leiter bringt Wörter ins Gedächtnis (Erkennen, Auswählen, Lücke), das **Benutzen** fehlt: Echte Daten: ~480 Antworten Erkennen/Lücke/Aufdecken, nur 6 mit `produce` (freier Satz).
- `modes.ts:107`: `produce` erscheint am Handy nie (`!env.touch`). `complete` ohne Satzanfang erst ab Stufe 5, Anweisung `task_complete_free` immer derselbe Wortlaut, Zielwort immer sichtbar.
- Eigene Sätze werden nicht gespeichert (`histEntry` ohne Satz) → keine Variationsprüfung, kein Zähler „aktiv benutzt“.
- `col` (Wortpartner) bei allen 194 Karten leer → `colloc`/`colloc_gap` entfallen.
- `produceCheck@1` kennt kein Szenario/Register/Zeitform, nur ein Zielwort, keine drei Schichten.

## Prinzipien
Generierungseffekt, Produktion vs. Rezeption, generativer Gebrauch (neue Verbindung/Lage), Encoding Variability (erst ab Stufe 3), TOPRA/Barcroft (keine freien Sätze beim ersten Lernen: Schritt „Neue Wörter“ bleibt), Transfer-appropriate processing (Textsorten wie im Beruf), Spacing (FSRS), Interleaving, Abruf in neuem Kontext (zuletzt OHNE Zielwort).

## Fahrplan je Wort (Richtwerte, Zeitpunkt bestimmt FSRS, Aktivierung ersetzt eine Wiederholung)
A1 gestützt (Stufe ≥ 3, ~Tag 3–5: Satzanfang ergänzen/Satz bauen, Wort sichtbar) · A2 neue Lage (Stufe ≥ 4, ≥ 5 Tage später: Mini-Szene mit Rolle/Gegenüber, Satzform vorgegeben) · A3 umformen (≥ 10 Tage: Ton/Register wechseln, umschreiben, erweitern) · A4 ohne Vorgabe (Stufe 5, ≥ 14 Tage: deutscher Impuls/Lage, Zielwort NICHT genannt) · A5 Kernwörter (Kundenmail mit 2–3 Zielwörtern, eigenen Satz aufwerten). 4 Aktivierungen über 5–6 Wochen (Kernwörter 5 über 8–10; **Richtwert für junge Karten – bei reifen Karten folgen die Schritte den FSRS-Terminen, das kann Monate dauern**), mindestens 5 eigene Sätze in ≥ 3 Textsorten, ≥ 2 Registern, ≥ 2 Zeitformen vor „Fest“.
Tagesgrenze (seit 14.10.2026 in Satz-Einheiten, `docs/entscheidungen.md`): höchstens 4 Einheiten (Kundenmail 2, Kombi-Satz 1,5, sonst 1; etwa 4 bis 8 Minuten), innerhalb von „Wörter wiederholen“; ab 40 Überfälligen höchstens 2 Einheiten und nur A4, ab 80 keine. Vorrang A4 > A3 > A2 > A1.

## Variation erzwingen (deterministisch, kein Würfeln beim Neuzeichnen)
Pools als Daten (vom english-teacher gegengelesen): ~12 Beruf- + 4 Alltag-Szenen (~70 Situationen), 6 Rollen, 8 Textsorten, 3 Register, 5 Zeitformen, Satzformen, Subjekte, Längen, 3 Wortlaute je Art. Auswahl per Hash (Karte, Schritt, Tag), je Merkmal „am längsten nicht benutzt“; zwei Aktivierungen derselben Karte unterscheiden sich in ≥ 3 Merkmalen; nie dieselbe Art zweimal hintereinander. Vorgabencode (<40 Zeichen) im Verlauf und Kartenzähler `na`.

## Formate (ohne Mikrofon)
Satzanfang ergänzen · Einwand in 1 Satz · Kundenmail beantworten (2 Zielwörter) · Register wechseln (Slack→CFO) · Rolle/Zeitform wechseln · Meeting-Notiz · Zusammenfassung · Slack/LinkedIn/Angebot · Fehlersatz reparieren (3 typische Fehler) · präziser machen · Wortpartner wählen+anwenden · Hedging/Diskursmarker · Kontrastpaar · Betreffzeile · Transfer ohne Stichwort · Lücken-Mail · Kombi-Satz (2 Wörter aus verschiedenen Karten) · eigenen Satz aufwerten. Vollständige Beispiele siehe Berichte (Aufgaben A–E: Kundenmail, Register, Meeting-Notiz, Fehlersatz, Transfer).

## Bewertung
Lokal zuerst (Zielwörter auch gebeugt, Länge, Satzform, bekannte deutsche Fehlermuster, Neuheit gegen Ursprungssatz/Beispielsätze/eigene frühere Sätze, Jaccard < 0,6) → bei Durchfall sofort Rückmeldung ohne KI. Dann Claude `quick` (ein Aufruf je Aufgabe, `activate-check@1`: drei Schichten richtig/C1-Fassung/warum, `errType`, `reusable`). Noten: Gut/Schwer/Nochmal, nie Leicht; ohne Claude höchstens Schwer und „ungeprüft“. Fehler → „Fehler wiederholen“ und Radar.

## Speicher
`act/<JJJJ-MM>` Sammelakte je Monat (~400 B/Eintrag, Wächter 200 KiB, Fortsetzung `-b`), auf der Karte nur Zähler `ac` (~120 B). Wiederverwendung geprüfter Sätze als „Dein Satz vom …“ (nur Stufe ≥ 4). data-guard vor dem Bau.

## Messung
„Einsatzbereit“: Stufe ≥ 4, ≥ 2 von Claude geprüfte richtige Aktivierungen mit ≥ 3 verschiedenen Merkmalen, davon 1 ohne gezeigtes Wort, ≥ 14 Tage Abstand, letzte ≤ 60 Tage. Freie Benutzung in Chat/Übersetzer/Preply lokal erkennen. Anzeige als vierte Zahl, eingeklappt.

## Bau in Stufen
- **Stufe 1 (klein, wirkt sofort) – gebaut 14.10.2026, Zweig `claude/umbau-aktiv1` (Details `stand.md`):** `produce`/„Eigener Satz“ am Handy freigeben (Zusammenführen mit `complete` ohne Anfang, ehrlich benannt) · variable Aufgabenstellung (Lage/Satzform/Ton aus Pool, 3 Wortlaute, per Hash) · Abschreibprüfung gegen alle gezeigten Beispielsätze (0,6) · `produceCheck` v2 (drei Schichten, Vorgaben, `errType`) · Leitplanke Barcroft in `tagesaufbau.md`.
- **Stufe 2 (mittel) – gebaut 14.10.2026, Zweig `claude/umbau-aktiv2` (Details `stand.md`):** Fahrplan A1–A4 mit Vorrang/Tagesgrenze im Schritt „Wörter wiederholen“, `ac`-Zähler, Speicher `act/…`, Formate 3/4/5/10/13, `activate-check@1`, Messung „einsatzbereit“. Dazu `col` (Wortpartner) für die 194 Karten als Inhaltscharge mit Gegenlesung.
- **Stufe 3 (groß):** Spezial „Schreibwerkstatt“ (1×/Woche), Pool ~40 Lagen/Rollen, Erkennung freier Benutzung, Transfer ohne Stichwort als Bedingung für „Fest“.
Prüfer je Stufe: learning-scientist, english-teacher (Inhalte 100 %), data-guard, ux-reviewer.


## Datenregeln für Stufe 2 (data-guard, 14.10.2026 – verbindlich)
1. Zähler heißt `na` (nie `ac`); `cardPatchSchema` (strict) bewusst erweitern. `vs/<seg>` gibt es nicht – Wendungen liegen in `chunk/<id>`, dort sind `pa/ac/co/colN` verboten.
2. `act/<JJJJ-MM>` in `COLLECTIONS` (paths.ts) mit `looseObject` eintragen (sonst fehlt sie in Sicherung/Export).
3. Einträge als Objekt-Map `{ e: { "<id>": {…} } }` mit deterministischer ID, nie als Liste (Listen werden ganz ersetzt).
4. Immer `writer.transform` (frisch lesen → prüfen → update); idempotent (existiert die ID, nichts schreiben); nie aus Render/Timer.
5. Größenwächter vor dem Schreiben (UTF-8-Bytes, 200 KiB, dann `-b`), Feldkürzung (Satz 300, C1-Fassung 400, Begründung 300 Zeichen).
6. Monatsschlüssel aus dem Lerntag (`dayKey`, 04:00), nicht `new Date()`.
7. Kartenzähler `na` nur in derselben Schreibaktion wie die Antwort (`reviewWrite`); er ist abgeleitet und aus `act/` neu berechenbar.
8. Nie `delete`; ungültige Einträge melden und auslassen; Export muss `act/` enthalten (Test).
9. Tests vor dem Bau: zwei parallele Schreiber, Wiederholung ohne Doppelung, Überlauf nach `-b`, Monatswechsel 03:59/04:00, Seed-Test.
Stufe-1-Warnung: `recallDays` (brief.ts) soll `m:'known'` ausschließen.
