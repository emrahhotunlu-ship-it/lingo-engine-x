# Bericht Unterchat VB: Bilder der neuen Wörter-App

Stand 01.11.2026 · Zweig `claude/umbau-vb` (vom Stand `731cabf` auf `claude/umbau-fokus`) · Auftrag `docs/umbau/auftraege/vb.md`

## Kurzfassung für Emrah
1. Du kannst jetzt 39 Bilder der neuen Wörter-App ansehen, bevor sie gebaut wird. Sie sehen aus wie die Vorschau, die du abgenommen hast.
2. In der Übung siehst du nach jeder Antwort ein Band. Es zeigt bei einem Tippfehler genau den fehlenden Buchstaben und immer ein „Warum“, auch wenn du richtig liegst. Dazu kommen zwei Wortpartner und der Tag, an dem das Wort wiederkommt.
3. Ein neues Wort versuchst du erst kurz selbst, dann deckst du es auf. Tippst du „Kenne ich schon“, prüft dich die App kurz.
4. Dazu gibt es „Das wusste ich eigentlich“, den Fall „Wort richtig, Partner falsch“, Karten für Wörter, die man leicht verwechselt, und „Warum heute?“ im Menü. Auch der Start mit Minuten, der Abschluss und eine ruhige Rückkehr nach einer Pause sind dabei.
5. Auf der Seite eines Wortes siehst du getrennt, wie gut du es verstehst und wie gut du es selbst schreibst. Dazu kommen ein Balken mit 7 Stufen und ein Verlauf über 6 Wochen.
6. In der Übersicht steht, wie viele Minuten die nächsten 14 Tage dauern und wie viel du wirklich behältst.
7. Neu ist „Anwenden“: Du schreibst eine kurze Mail mit drei deiner Wörter, und Claude prüft jedes Wort einzeln. Ohne Claude vergleichst du selbst mit einem Muster. Deine Pflicht zählt dann trotzdem, deine Termine bleiben gleich.
8. Wo ich mehr vorschlage als die Vorschau, liegen beide Fassungen nebeneinander. Die Übersicht steht in `docs/umbau/vokabeln/bilder/README.md`.

## ok
**ja.** Alle Bilder aus dem Auftrag (Satz 1 und Satz 2) liegen vor. Der Lehrer hat zweimal gegengelesen und alles ist eingearbeitet. Dazu kamen eine UX-Prüfung und eine gezielte Nachprüfung, deren Befunde ebenfalls eingearbeitet sind. Kein Blocker.

## commit
`bba67ba` (Zwischenstand), Endstand: letzter Commit auf `claude/umbau-vb` (Nachricht „VB fertig …“).

## Was entstanden ist
- `docs/umbau/vokabeln/bilder/README.md`: Bild → was es zeigt → Methode/Plan-Abschnitt → was Emrah entscheidet; dazu die Regeln, die über alle Bilder gleich gelten.
- `docs/umbau/vokabeln/bilder/s1-*.jpg` (26), `s2-*.jpg` (13), `vergleich-*.jpg` (6, links Vorschau, rechts Vorschlag).
- `docs/umbau/vokabeln/bilder/src/`: `vb-screens.js` und `vb.css` (die Entwürfe auf den Bausteinen der Vorschau), `build.mjs` (baut eine Datei ins Scratchpad, liest `docs/relaunch/vorschau/src` nur), `shoot.mjs` und `shots.json` (Fotos per Playwright), `vergleich.py` (Bildpaare). Kein App-Code, nichts außerhalb von `bilder/**` und diesem Bericht geändert, kein Artefakt veröffentlicht.

## befunde
1. **Hell-Modus: „fast richtig“ wird rosa statt gelb, auch in der Vorschau und vermutlich in der App** (ux-reviewer). Ursache: `color-mix(in oklch, var(--surface) 90%, var(--near))` mischt mit Weiß (`oklch(1 0 0)`, Farbton 0 = Rot) und zieht den Ton Richtung Rot. Damit ist das Band „fast“ in Hell kaum von „falsch“ zu unterscheiden. In den Bildern ist es mit `in srgb` gelöst (`vb.css`, Ende). **Für D5/V3:** die Zustandsflächen in `src/styles/parts/v-uebung.css`/`band.css` prüfen, die gleiche Mischung wie in `docs/relaunch/vorschau/src/style.css:276–278` (nur gemeldet, Besitz D5).
2. Teile der Vorschau widersprechen dem Wörter-Plan und sind in den Bildern angepasst: „Zu leicht“ prüft nach **7** statt 30 Tagen (M16), die Stufen heißen S1–S7 statt S0–S5 (W2), die Wörter-Zeit auf Heute ist eine Schätzung (14 Min.) statt fest 7 Min. (B8).
3. english-teacher, Durchgang 1: 15 Befunde, alle umgesetzt, z. B. eindeutige Lücken (renew/extend, eventually), „purchasing“ als „Auch richtig“, „make a presentation“ als Partner, Warum mit Wortart, keine Fachwörter („Spur Benutzen“ → „Selbst schreiben“). Durchgang 2: 12 Befunde, alle umgesetzt, z. B. *sign off the order* (ohne *on*) gilt als richtig (britisch üblich), dafür zeigt das Anwenden-Bild den typischen Fehler *postpone on next week* → *postpone to / until*. Neue Wörter von heute stehen nicht zugleich auf Stufe 4–6.
4. ux-reviewer, Durchgang 1 (Satz 1): 6 Muss- und 9 Soll-Befunde, alle umgesetzt, z. B. „War das auch richtig?“ wieder in jedem Fehler-Band und „Das wusste ich eigentlich“ als ruhiger Link darunter; keine Lösung vor dem Prüfen; Lösung nach dem Aufdecken neutral statt grün; nur der falsche Teil rot; Zähler und Minuten stimmig. Nachprüfung Satz 1 und erste Prüfung Satz 2: 2 offene Stellen aus Satz 1 und 6 Muss- und 9 Soll-Befunde für Satz 2, alle umgesetzt, z. B. die Wochenleiste auf Di, das Wort-Detail mit allen Aktionen der Vorschau, das Dashboard mit einer großen Zahl wie die Vorschau und Zuwachs/Vorher-Nachher darunter, gleiche Minuten in allen Bildern (heute 14, morgen 12), die Regel „Zielzeit hat Vorrang“ in den Einstellungen und „Deine Pflicht zählt trotzdem“ ohne Claude.

## zahlen
- 39 Bilder: Satz 1 = 26, Satz 2 = 13, dazu 6 Vergleiche. Handy 390 px Dunkel. Lernkarte, Band und Wort-Detail zusätzlich in Hell und am Laptop 1440. Größe 5,4 MB (JPEG, Qualität 80).
- Bildliste: `src/shots.json`. Alle Bilder entstehen in einem Lauf neu (ca. 1 Min.).

## nicht_gelaufen
- Keine zweite UX-Nachprüfung der Satz-2-Korrekturen. Nach der Regel „eine Prüfung, eine gezielte Nachprüfung“ war die Nachprüfung schon mit der ersten Satz-2-Prüfung zusammengelegt. Ich habe die Korrekturen selbst an den neuen Bildern geprüft.
- Kein Gedämpft-Modus und kein Englisch: Der Auftrag verlangt Dunkel, für die Lernkarte, das Band und das Wort-Detail zusätzlich Hell und 1440.
- Keine App-Tests, weil es keinen App-Code gibt.
- Ton, Diktat und Tastatur sind gezeichnet, nicht bedienbar (reine Bild-Entwürfe).

## offene_fragen
Je mit Empfehlung. Die Bilder sind mit der Empfehlung gebaut.
1. **Neues Wort: erst kurz selbst versuchen, dann aufdecken** (`s1-01`, `s1-02`), oder die Lösung wie in der Vorschau sofort zeigen? **Empfehlung: erst versuchen.** Ein Versuch, auch ein falscher, hilft beim Behalten (M36). „Kenne ich schon“ prüft dich kurz (`s1-03`).
2. **Ergebnis-Band mit Buchstaben-Vergleich, „Warum“, 2 Wortpartnern und „Kommt wieder: …“** (`vergleich-band-fast.jpg`, `vergleich-band-falsch.jpg`). Es wird dadurch etwa zwei Zeilen höher als in der Vorschau. **Empfehlung: ja.** So siehst du genau, was falsch war, und wann das Wort zurückkommt.
3. **Wörter-Zeit auf Heute als Schätzung**, die von Tag zu Tag schwanken kann (`s1-21b`, `s1-22`: „ca. 14 Min.“), statt fest 7 Minuten? **Empfehlung: ja, Schätzung.** Die 14-Tage-Vorschau hält die Schwankung klein (`s2-05`).
4. **Spur „Benutzen“ heißt in der App „Selbst schreiben“** (`s2-01`: „Verstehen · sicher“ / „Selbst schreiben · auf dem Weg“)? **Empfehlung: ja.** Das ist klarer als „Benutzen“ und passt zu „bildest du selbst“.
5. **Anwenden ohne Claude: Knopf „Später prüfen lassen“** (`s2-09`, `s2-12`). Der Text wird gespeichert und geprüft, sobald Claude wieder erreichbar ist. Erst dann wirkt er auf deinen Plan. **Empfehlung: ja.** Sonst geht ein guter Satz für Stufe 7 verloren.
6. **Behaltensrate deutlich unter dem Ziel** (`s2-06`): Darf die App dann selbst junge Wörter etwas früher planen und dir das als Hinweis mit Minuten sagen? **Empfehlung: ja, mit Hinweis.** Die Zielzeit hat weiter Vorrang.

## Schlussmeldung
VB fertig. Der Überchat zeigt Emrah die Bilder (README) und stellt die sechs Fragen im Frage-Dialog. Danach kann V3 mit den abgesegneten Bildern starten.
