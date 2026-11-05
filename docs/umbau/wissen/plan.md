# Großpaket W „Wörter-Wissen“ (05.11.2026, Emrahs Wahl „A“)

Ziel (Emrah, Kommentar K5 03.11.: „keine Beispielsätze oder wie das Wort angewendet wird … das war in der alten App besser“): Jedes Lernwort zeigt Bedeutung, Wortpartner und zwei Beispielsätze aus dem Berufsalltag – geprüft, nichts erfunden. Dazu Anwenden-Feinschliff aus der Lehrer-Prüfung. Großer Bildschirm (K14) und Ladezeiten folgen im nächsten Paket.

## Befund (Explore 05.11.2026)
- Felder gibt es schon: `vocab/<id>.col` (Wortpartner `{p,de,gap,opts,ex}`), `wx` (Sätze `{en,de,sit,t,pv}`, ≤ 4), `sb` (Satzbank), `pos`. Keine Schemaänderung nötig.
- Die neue Wörter-App LIEST sie (Einführung `partnersOf(col)`, Band/Wortkarte, `moreExamples` aus `sentencesOf` = `ex`, `wx`, `sb`), FÜLLT sie aber nirgends: die alten Schreiber (`card-examples@4` beim Aufdecken im alten Trainer, Runden-Ende `session.ts`) laufen mit der neuen Wörter-App nicht mehr. Neue Wörter bekommen `col: []`.
- Fehler: `LearnCard.tsx:260–264` zeigt ohne `col` ersatzweise `teach.colloc`, das aus der FALSCH-Liste einer Falle stammt (z. B. „hold a presentation“) → falsche Wortpartner unter „Oft zusammen mit“.
- Inhalte nach Stichwort: nur `col/charge1.json` (100 Wörter); Atlas (6.346, Satzqualität 3/10, gesperrt), c1-Paket (443, nach Paket-Kennung).

## Pakete
**W1 Fehler zuerst:** falsche Wortpartner-Ersatzanzeige entfernen (`teach.colloc` nur noch, wenn es echte Partner sind; Fallen-Falschformen nie als Partner). Test.

**W2 Wort-Wissen ergänzen (Claude, im Hintergrund):** neue Vorlage `word-know@1` (versioniert, zod, `default`), je Aufruf bis zu 5 Wörter derselben Runde: je Wort 3 Wortpartner als feste Einheiten (Kern + Partner, Satz enthält genau die Einheit, Deutsch in derselben Form) und 2 Beispielsätze aus Emrahs Berufsalltag (Profil `ctx`, DMS/Cloud, ≤ 22 Wörter, US-Englisch, mit deutscher Übersetzung), passend zur gespeicherten Bedeutung (`de`, `pos`, Ursprungssatz). Code-Prüfung vor dem Speichern: Wort/Wendung steht wörtlich im Satz, Einheiten-Regel (`lexical-unit`-Regeln, keine Präposition am Ende, keine Fallen-Falschform), Satzlänge, keine Doppel, Sprachtreue. Speichern nur in leere Felder (`col` nur wenn leer, `wx` bis 4, Herkunft `pv: 'know1'`), nie Überschreiben, nie Löschen; `pos` nur ergänzen, wenn leer.
  - Reihenfolge: zuerst die Wörter des heutigen Plans und die nächsten neuen Wörter, dann der Rest nach Fälligkeit. Hintergrund-Budget (`ai/gate` `priority: 'background'`), z. B. 10 Aufrufe/Tag = bis 50 Wörter/Tag → Emrahs ~490 Wörter in rund zwei Wochen; nie in einer Schleife, Fehlercodes wie üblich (kein Wiederholen bei `rate_limited`).
  - Einsatz: Wortpartner und Sätze erscheinen sofort als **Anzeige** (Einführung, Ergebnis, Wortseite). Als **Abfragesatz** (Lücke) erst nach der bestehenden Satzbank-Regel (`sbGate`, 4 Wochen) – Frage an Emrah.
**W3 Wortseite:** Wortpartner + alle Beispielsätze (mit Übersetzung zum Aufdecken), „Fehlt etwas? Jetzt ergänzen“ (einzelner Aufruf auf Knopfdruck).
**W4 Wendungen (`chunk/*`):** bekommen einen geprüften Beispielsatz (`ex` fehlt bei allen alten Wendungen aus Rollenspiel/Mail) über dieselbe Vorlage; Feld `ex` nur wenn leer.
**W5 Anwenden-Feinschliff (Lehrer-Prüfung F3):** K1 „So klingt es gehobener“ (1–2 Stil-Upgrades je Text, zitiert und begründet), K7 Anrede/Empfänger vorgegeben und geprüft, K8 geprüfter Artikel-Vorrat (mehr Texte für Tage ohne Tagesartikel), K9 optionale Satzanfänge als Starthilfe (zählt als Hilfe), K14 keine Wiederholung derselben Mail/desselben Artikels innerhalb von 14 Tagen.
**W6 Gesammeltes:** K4/K7/K12/K13-Korrekturen vom 05.11. (gebaut), Hinweise nicht über dem Kartentitel.

## Prüfung
english-teacher: Vorlage `word-know@1` + 30 Probewörter (Ausgabe des Entwicklungs-Adapters und eine echte Stichprobe) VOR dem Bau der Anzeige und vor dem Test-Link; learning-scientist: Einsatz der Sätze (Anzeige vs. Abfrage), Anwenden-Änderungen; data-guard: Schreibweg (nur leere Felder, Dokumentgrößen, 256 KiB), platform-guard: Aufrufe gegen `contract/sample.d.ts`; ux-reviewer: Einführung, Ergebnis, Wortseite, Anwenden (390/744/1440). Ein Test-Link am Ende, live nur nach „Ja live nehmen“.
