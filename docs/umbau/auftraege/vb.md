# Auftrag Unterchat VB: Bilder der neuen Wörter-App zum Absegnen (vor V3/V4)

Du bist ein Unterchat von Lingo-Engine X. Lies zuerst `CLAUDE.md`, `docs/umbau/unterchats.md` (besonders Regel 4: **keine Fragen an Emrah**), in `docs/entscheidungen.md` die Einträge vom 28.10.–01.11.2026 (Vorschau als Untergrenze; Erledigt bleibt Indigo; Gedämpft-Hauptknopf weiße Schrift; D3: Regel-Karte erst nach dem Prüfen, „Warum“ sichtbar). Zweig: `claude/umbau-vb` (vom aktuellen `claude/umbau-fokus`). Bericht: `docs/umbau/berichte/vb.md`.

## Ziel
Emrah sieht die neuen Wörter-Bildschirme **als Bilder, bevor sie gebaut werden** (plan.md §1 Nr. 6, §7.1). Es entsteht **kein App-Code**: nur Bild-Entwürfe im Stil der Vorschau `WBft3EEx7jYYv4QHdepuNm` v2 (Quellen `docs/relaunch/vorschau/src`, Tokens `src/styles/index.css`, Bausteine `src/ui/v/*` als Vorbild für Maße und Farben).

## Maßstab
`docs/umbau/vokabeln/plan.md` §5, §6, §7, §7.1, §7.2 (N1, N4, N5, N7), §10 (Zeilen V3, V4); `synthese.md` §4.2 (B1–B13); `referenzen.md` §2.2; Bildvergleich `786X8ctWrDoi5U7vc469Fy` (Inhalt in `docs/umbau/vokabeln/anbieter/*.md`, nur lesen). Gemeinsame Übungsteile aus D3 (`src/ui/exercise/*`, `src/styles/parts/v-uebung.css`, Bilder `docs/umbau/berichte/d3/`) – die Wörter-Lernkarte soll sich wie die neue Übungsseite anfühlen.

## Bilder
**Satz 1 (vor V3, zuerst fertig machen und pushen):** B10 Einführung mit kurzem Versuch · Lernkarte Lücke (Tastatur offen, Ton, Tipp) · B3 Band „fast richtig“ und „falsch“ mit Diff und „Kommt wieder: …“ · Band „richtig“ mit Warum und 2 Wortpartnern · B4 „Das wusste ich eigentlich“ · B5 Kollokation „Wort richtig, Partner falsch“ · B12 Verwechslungspaar / falscher Freund · B13 eine der Formen M78–M81 · N1 „Warum heute?“ im Menü · B8 Heute-Zeile „Wörter · ca. 14 Min.“ und Abschluss „aufgestiegen / gestolpert / morgen ca. 12 Min.“ · B11 Wiederkehr nach Pause.
**Satz 2 (vor V4):** B2 Wort-Detail mit beiden Spuren, 7-teiligem Stufenbalken und N5 Zeitleiste · B1 Dashboard mit „Die nächsten 14 Tage“ in Minuten und Behaltensrate (N7) · B7 „Anwenden“ mit Claude und `offline` · B6 eigener Satz · B9 Einstellungen Wörter.

Je Bild: Handy 390 px **Dunkel**; die Lernkarte, das Band und das Wort-Detail zusätzlich **Hell** und einmal **Laptop 1440** (Kontextspalte). Deutsch; Beispielwörter aus Business-Englisch (erfunden, keine echten Daten). Jede Ergänzung gegenüber der Vorschau im Stil der Vorschau: ein Hauptknopf, ruhige Zeilen, keine Punkte. Wo du **besser als die Vorschau** vorschlägst, beide Varianten nebeneinander.

## Weg
Statische HTML-Entwürfe unter `docs/umbau/vokabeln/bilder/src/` (eingebettete Tokens, nichts extern), Bildschirmfotos per Playwright nach `docs/umbau/vokabeln/bilder/*.jpg` (Qualität ~80, klein halten), eine Übersicht `docs/umbau/vokabeln/bilder/README.md` (Bild → Methode/Plan-Abschnitt → was Emrah dort entscheidet). Inhalte (Sätze, Wortpartner, Warum-Texte) einmal durch `english-teacher` gegenlesen; ein Durchgang `ux-reviewer` gegen Vorschau und Kap. 2/4/8 (eine Prüfung, eine gezielte Nachprüfung). **Kein Artefakt veröffentlichen** (Regel 2).

## Abgrenzung (parallel laufen V2 und D5)
- Besitz: nur `docs/umbau/vokabeln/bilder/**` und dein Bericht.
- Nicht anfassen: `src/**`, `tests/**`, `scripts/**`, `dist/**`, alle anderen Dokumente.

## Umgebung
- Playwright: `PW_CHROMIUM=/opt/pw-browsers/chromium` (oder `chromium.launch({executablePath:'/opt/pw-browsers/chromium'})`). Nie `playwright install`.
- Platte ist knapp: Zwischendateien im Scratchpad, nicht im Repo.
- Früh und oft pushen (Satz 1 zuerst).

**Keine Fragen an Emrah** (weder Frage-Dialog noch Text, auch nicht in der Schlussnachricht). Die Entscheidungen, die Emrah an den Bildern treffen soll, kommen als `offene_fragen` (je mit Empfehlung, höchstens 6) in den Bericht; der Überchat zeigt Emrah die Bilder und stellt die Fragen im Frage-Dialog. Kurzfassung für Emrah (höchstens 8 Sätze, ohne Fachwörter). Nach Satz 1 **und** nach Satz 2 den Überchat wecken (Regel 6, Text „VB Satz 1 fertig …“ bzw. „VB fertig …“).
