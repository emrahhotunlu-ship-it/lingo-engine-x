# Wörter-App: Bilder zum Absegnen (Paket VB)

Entwürfe der neuen Wörter-Bildschirme **vor dem Bau** (`plan.md` §1 Nr. 6, §7.1). Kein App-Code: Die Bilder entstehen aus den Bausteinen der abgenommenen Vorschau `WBft3EEx7jYYv4QHdepuNm` v2 (`docs/relaunch/vorschau/src`, nur gelesen) plus den Ergänzungen in `src/vb-screens.js` und `src/vb.css`. Alle Wörter, Sätze, Daten und Zahlen sind erfunden. „Heute“ ist in allen Bildern **Di, 3.11.**

**Bauen und fotografieren** (Ausgabe ins Scratchpad, nicht ins Repo):
`node docs/umbau/vokabeln/bilder/src/build.mjs <tmp>/vb.html` · `PW_CHROMIUM=/opt/pw-browsers/chromium node docs/umbau/vokabeln/bilder/src/shoot.mjs <tmp>/vb.html docs/umbau/vokabeln/bilder` (Liste: `src/shots.json`) · Vergleiche: `python3 -I src/vergleich.py <aus> <vorschau> <entwurf>`.

Dateinamen: `s<Satz>-<Nr>-<Bild>-<Breite>-<Modus>.jpg`. `vergleich-*.jpg` = links Vorschau, rechts Vorschlag (dort, wo VB mehr als die Vorschau vorschlägt).

## Satz 1 (vor V3)

| Bild | Was es zeigt | Methode / Plan | Was Emrah entscheidet |
|---|---|---|---|
| `s1-01` B10 Versuch | Neues Wort: Satz mit Lücke, „Gesucht: …“, erst kurz selbst tippen; „Kenne ich schon“ und „Aufdecken“ | B10, M36, M16 · `synthese.md` §2.3 Stufe 1 | Erst selbst versuchen statt Lösung sofort zeigen? |
| `s1-02` B10 aufgedeckt | Lösung neutral in der Lücke, eigener Versuch eingeordnet („extend · auch richtig …“), Wortkarte mit Lautschrift, Ton normal/langsam, 3 Wortpartner | B10 · `vergleich-einfuehrung.jpg` | – |
| `s1-03` B10 Kenne ich schon | Probe statt Glauben: ohne Satz tippen; richtig → nur eine Kontrolle in 7 Tagen | M16 (7 statt 30 Tage, `synthese.md` §4.1) | – |
| `s1-04` Lernkarte | Satz groß, Eingabe in der Lücke, Tastatur offen, Ton (Satz anhören, Lücke als Ton) normal/0,7×, Tipp · Weiß ich nicht · Prüfen über der Tastatur (wie D3) | `plan.md` §6, M24, M25 | Ton-Knopf schon vor dem Prüfen? |
| `s1-05` mit Tipp | Tipp: erster Buchstabe und Wortzahl; zählt als „mit Hilfe“ | M44 | – |
| `s1-06` Hell, `s1-07` Laptop 1440 | Lernkarte in Hell; Laptop mit Kontextspalte „Wozu?“, „Warum heute?“ und „Heute“ | D3-Gerüst | – |
| `s1-08`, `s1-08b` (Hell) Band richtig | Urteil, „Du: …“, **Warum auch bei richtig**, Wortpartner (2), „Kommt wieder: Sa, 21.11.“ | B3, M54, Kap. 2 Nr. 4 | – |
| `s1-09` Band fast richtig | **Buchstaben-Vergleich**: fehlender Buchstabe gelb unterstrichen; Termin etwas früher | B3, M40, M48 · `vergleich-band-fast.jpg` | Buchstaben-Vergleich statt „durchgestrichen → richtig“? |
| `s1-10` Band falsch | Falsch → Richtig, Warum, „Kommt wieder: gleich noch einmal in einem neuen Satz · dann morgen“; „Mehr“ und „War das auch richtig?“, darunter leise „Das wusste ich eigentlich“ | B3, M49, M53 · `vergleich-band-falsch.jpg` | Band größer als in der Vorschau (2 Zeilen mehr) in Ordnung? |
| `s1-11`, `s1-12` Hell, `s1-13` Laptop | Band fast/falsch in Hell; Laptop: Band unter der Aufgabe, rechts Karte „Wort“ (Wortpartner, Kommt wieder, Stand 7-teilig) | D3 (Regel-Karte erst nach dem Prüfen) | – |
| `s1-14` B4 | Nach „Das wusste ich eigentlich“: „Gut, dann zeig es gleich … Nur diese Antwort zählt.“ + Rückgängig | B4, M42, W4 | – |
| `s1-15` B5 | Eigener Ausgang „Wort richtig, Partner falsch“: ~~hold~~ → give a presentation, Kontrastkarte morgen | B5, M56, M74 | – |
| `s1-16`, `s1-16b` B12 falscher Freund | Lücke mit *eventually* (Gesucht: schließlich); der Kontrast *eventually* ≠ eventuell erst im Band, damit nichts vorher verraten wird | B12, M14, D3 | – |
| `s1-17` B12 Paar | Wort-Werkstatt: „*effect* ruht, bis *affect* sitzt“ und Deutsch-Falle | B12, M14 | – |
| `s1-18`, `s1-19` B13 | Form M78 „Präposition zum Muster“ (*comply with*) als Aufgabe und Band | B13, M78 | – |
| `s1-20` N1 | Menü „…“ mit „Warum heute?“ oben: fällig seit 2 Tagen, zuletzt richtig am …, Spur und Stufe; dazu „Aufgabe war unfair“ | N1, M43 | – |
| `s1-21b` B8 Heute | Heute der Vorschau (Ring angetippt): der Wörter-Block dauert so lange, wie der Planer schätzt (hier 14 statt fest 7 Min.), Ring und Summe rechnen mit | B8, M68 | Wörter-Zeit schwankt je Tag (statt fest 7 Min.)? |
| `s1-22` B8 Start | „Wörter · ca. 14 Min.“, „Warum diese?“, Mischbalken fällig/neu/Anwenden, Hinweis „Plan steht für heute fest“ | B8, M68, M13, Kap. 15 | – |
| `s1-23` B8 Abschluss | Heute gelernt · Aufgestiegen · Gestolpert (mit Termin) · Morgen ca. 12 Min.; „Noch 5“ und „Fertig“ | B8, M71 · `vergleich-abschluss.jpg` | – |
| `s1-24` B11 Wiederkehr | „32 fällig · heute die 18, die du am ehesten vergisst, der Rest verteilt bis Do“, Balken heute/Mi/Do, trotzdem 2 neue, ohne Anwenden | B11, N4, M13, M12 | – |

## Satz 2 (vor V4)

| Bild | Was es zeigt | Methode / Plan | Was Emrah entscheidet |
|---|---|---|---|
| `s2-01` B2 Wort-Detail (Dunkel), `s2-02` (Hell) | Stufenbalken mit 7 Teilen in 3 Tönen (erkennst du · auf dem Weg · bildest du selbst), darunter **zwei Spuren**: „Verstehen · sicher · nächster Abruf Sa, 21.11.“ / „Selbst schreiben · auf dem Weg · nächster Abruf Fr, 6.11.“, nächster Schritt in Worten; Verlauf-Zeitleiste; Ursprungssatz; Wortpartner; Deine Sätze; auch woanders gesehen (N6) | B2, M66, M7, W2, N5, N6 · `vergleich-wort-detail.jpg` | Spur „Benutzen“ heißt für Emrah „Selbst schreiben“? |
| `s2-03` N5 Verlauf | Zeitleiste 6 Wochen (ein Feld je Tag: grün frei, gelb mit Hilfe, rot falsch, grau nur Übung) und Liste der Versuche mit Wirkung („keine Wirkung auf den Plan“, „Aufstieg auf Stufe 4“) | N5, `vlog` | Zeitleiste mit Feldern statt Punkten? |
| `s2-04` Laptop 1440 | Wort-Detail auf der Bühne, rechts Üben, Wortpartner, Deine Sätze, Belege | B2 | – |
| `s2-05` B1 Dashboard | zwei Zahlen aktiv/passiv, Gruppen S1–S7, **Die nächsten 14 Tage in Minuten** (Sonntag flach), **Behaltensrate 89 % (Ziel 90 %) · gefestigt 93 % · jung 86 %** | B1, M63, M18, N7 · `vergleich-dashboard.jpg` | – |
| `s2-06` N7 Abweichung | Mehr als 5 Punkte unter dem Ziel: Hinweis in Worten mit Folge („ca. 2 Min. mehr am Tag“) | N7 | Darf die App bei Abweichung selbst nachsteuern (mit Hinweis)? |
| `s2-07` B7 Anwenden | Lage auf Deutsch (Mail an Kunden), 3 Zielwörter als Chips in der Grundform, Textfeld, Diktat, „Prüfen“ | B7, Emrah 4.5, `plan.md` §7 | – |
| `s2-08` B7 Rückmeldung | je Zielwort ✓/~ mit einem Satz, Markierung im Text, „So ginge es natürlicher“ (nur 1 Korrektur), Wirkung auf den Plan in Worten; „War das auch richtig?“ | B7, M32, `synthese.md` §2.5 | – |
| `s2-09` B7 ohne Claude | Hinweis, Muster zum Selbstvergleich, **zählt nicht für den Plan**; „Später prüfen lassen“ | B7, W6 | „Später prüfen lassen“ anbieten (Text wird gespeichert und nachgeprüft)? |
| `s2-10` B6 eigener Satz | Stufe 6: Lage im Call, eigener Satz tippen oder diktieren, Hinweis „nicht zu nah am Beispiel“ | B6, M33 | – |
| `s2-11` B6 Rückmeldung | Sinn · natürlich · Wortpartner je mit ✓ und Begründung; „1 von 2 eigenen Sätzen für Stufe 7“; „Nochmal selbst schreiben“ | B6, Stufe 7 (Emrah 30.10. Nr. 4) | – |
| `s2-12` B6 ohne Claude | Hinweis, „So benutzt man es“, zählt nicht für Stufe 7 | B6, W6 | – |
| `s2-13` B9 Einstellungen | Zielzeit 10/15/20/30 Min. (Standard 15), neue Wörter 0/2/5/10 (mind. 2), Sicherheit 85/90/95 % **mit Minuten**, Anki-Modus (nur Verstehen), Satz vor dem Prüfen anhören | B9, M17, Emrah F3/F5 | – |
