# Großpaket A – Wörter-App komplett (Refinement, 01.11.2026)

Grundlage: `plan.md` §6–8 und §10 (V3, V4, V5), Bilder `bilder/` (Satz 1 = V3, Satz 2 = V4), `synthese.md`. Emrahs Vorgabe 01.11.: drei Großpakete, je einmal gemeinsam planen, ein Test-Link am Ende, zwischendurch nur bei echten Fragen.

## 1. Was kommt (aus Emrahs Sicht)
**Teil 1 – Wörter lernen (V3, schon freigegeben):** eigene Lernkarte mit Band nach jeder Antwort (Buchstaben-Vergleich, „Warum“, 2 Wortpartner, „Kommt wieder: …“), neues Wort erst selbst versuchen, „Kenne ich schon“ mit kurzer Probe, „Das wusste ich eigentlich“, „War das auch richtig?“, „unfair/melden“, „Warum heute?“, Verwechsler-Karten, Start auf Heute „Wörter · ca. X Min.“, Abschluss (gelernt · aufgestiegen · gestolpert · morgen ca. X Min.), ruhige Rückkehr nach Pause.

**Teil 2 – Wörter anwenden und verstehen (V4):**
- **Anwenden** (2–4 Min.): kurze Mail/Slack/Antwort im Call mit 3–5 eigenen Wörtern der Stufen 4–6; Claude prüft jedes Wort einzeln (richtig · fast · falsch), eine natürlichere Fassung, Wirkung auf den Plan in Worten. Tippen oder sprechen.
- **Eigener Satz** auf Stufe 5/6: zwei gute eigene Sätze machen ein Wort „fest“ (Stufe 7).
- **Wort-Seite:** Stufenbalken 1–7, getrennt „Verstehen“ und „Selbst schreiben“ mit nächstem Termin, Verlauf als Zeitleiste über 6 Wochen, alle Sätze, Wortpartner, deine Sätze, wo du das Wort sonst gesehen hast; alle Aktionen der Vorschau.
- **Übersicht:** wie viele Wörter du selbst bildest, Minuten der nächsten 14 Tage, echte Behaltensrate gegen das Ziel (90 %).
- **Einstellungen Wörter:** Zielzeit, neue Wörter je Tag, Sicherheit mit Minuten, Anki-Modus.

**Teil 3 – Die richtigen neuen Wörter (V5):**
- **Einstufung:** kurzer Test je Häufigkeitsband (erst erkennen, dann selbst bilden mit Anfangsbuchstabe), damit keine Wörter kommen, die du längst kannst.
- **Neue Wörter nach Gewicht:** 30 % Wortpartner deiner Wörter · 30 % Beruf und Business-Wendungen · 25 % eigene Funde (Wort antippen, Lehrkraft, Lesen) · 15 % Häufigkeitsband ab deiner Grenze. Tiefe vor Breite.
- **Wortlisten** nur mit offener Lizenz (NGSL sicher; NAWL/BSL/Häufigkeit erst nach Prüfung der Lizenz an der Datei). Bedeutungen, Sätze und Partner schreiben wir selbst, die Lehrkraft (english-teacher) liest die ersten 40 gegen.
- Im Lesen markierte Wörter zählen als Begegnung, verändern aber nicht den Plan.
- **Alter Wörter-Bereich:** bleibt auf dem Test-Link erreichbar, bis du OK sagst; erst dann fliegt er aus dem Bau. Keine Funktion fällt weg (Liste `plan.md` §11).

**Gesammelte Kleinkorrekturen (kommen mit, kein eigener Link):** `bring forward` (US: *move up*), *economies of scale*, Fallen-Karte „Angebot → quote/proposal“, Heute-Endkarte „überfällig −48“, Mustername `pp.inversion`, Hell-Modus „fast richtig“ rosa statt gelb (prüfen), wackliger Test fxStage1.

## 2. Was es bringt
- Wörter kommen nicht mehr willkürlich: jede Karte sagt, warum sie heute dran ist; der Plan rechnet in Minuten und hält deine Zielzeit.
- Du siehst nach jeder Antwort genau, was falsch war und wann das Wort wiederkommt.
- Wörter werden nicht nur erkannt, sondern **benutzt** (Mail, Call, eigener Satz) – das ist der Schritt von B2 zu C1.
- Ehrliche Zahlen: echte Behaltensrate, 14-Tage-Minuten, aktive gegen passive Wörter.
- Neue Wörter passen zu deinem Beruf und deinem Stand statt einer festen Liste.

## 3. Wie es aussieht
Wie die abgenommene Vorschau (ein Hauptknopf, ruhige Zeilen, gleiche Farben). Bilder: Teil 1 = `bilder/s1-*` (schon gesehen), Teil 2 = `bilder/s2-*` (13 Bilder, jetzt zum Ansehen), Teil 3 = Einstufung und Hinzufügen (Bilder entstehen vor dem Bau von Teil 3 und kommen mit den Fragen dazu).

## 4. Wie ich vorgehe (Reihenfolge, Agenten, Skills)
| Schritt | Was | Prüfer / Werkzeug |
|---|---|---|
| 1 | Daten absichern (Verlauf nicht bei jedem Start laden, eigene Sicherung, Tagesplan zuerst speichern, Schutz gegen ältere Versionen) | data-guard |
| 2 | Lernkarte + Band | learning-scientist vorher, english-teacher (Warum-Zeilen, Wozu-Sätze), ux-reviewer gegen Bilder s1 |
| 3 | Sitzung (fällig → neu eingestreut → Fehler nach 3–5 Karten zurück, Verwechsler-Karte) | learning-scientist |
| 4 | Start auf Heute + Abschluss | ux-reviewer |
| 5 | Anwenden + eigener Satz (3 neue Claude-Vorlagen, Regeln aus `contract/sample.d.ts`: kein eigener Timer, kein Neuversuch außer bei Schema-Fehler, Fehlerzustand mit „Erneut versuchen“) | learning-scientist + english-teacher prüfen die Vorlagen |
| 6 | Wort-Seite, Übersicht, Einstellungen | ux-reviewer gegen Bilder s2, data-guard (Verlauf) |
| 7 | Wortlisten (Lizenz prüfen, Liste einbinden mit Namensnennung), Einstufung, Gewichte, neue Wörter | english-teacher (erste 40), data-guard (neue Sammlung) |
| 8 | Kleinkorrekturen | english-teacher |
| 9 | Abschluss: Skill `code-review` einmal über alles, volles `npm run verify`, Lerntag-Durchlauf am Handy-Format (Dunkel/Hell), platform-guard | dann **ein Test-Link** mit Klick-Anleitung |

Ich arbeite allein im Hauptchat, Prüfer gezielt (höchstens 2–3 gleichzeitig), je Prüfer eine Prüfung und eine Nachprüfung. Auf dem Test-Link wird die neue Wörter-App für die Kopie deiner Daten eingeschaltet (Schalter `vcfg.mod`); die Umrechnung deiner Wörter läuft dort zuerst im Trockenlauf mit Bericht.

## 5. Was sich nicht ändert
Heute (außer der Wörter-Zeile), Grammatik, Praxis, Lesen, Sprechen, Begleiter. Die Live-App bleibt unberührt bis „Ja live nehmen“. Deine Daten werden nie gelöscht; der alte Lernstand bleibt neben dem neuen stehen (Rückweg).

## 6. Risiken
- **Groß:** du siehst lange nichts Klickbares. Abhilfe: Fragen mit Bildern, sobald eine echte Entscheidung ansteht.
- **Umrechnung deiner echten Wörter:** erst Trockenlauf mit Bericht auf dem Test-Link, Sperre bei Unklarem.
- **App-Größe:** neue Teile werden nachgeladen, damit der Start nicht langsamer wird (Budget-Tor).
- **Wortlisten-Lizenzen:** was nicht sicher offen ist, kommt nicht hinein.
- **Nutzungsgrenze:** wenn das Kontingent knapp wird, halte ich an einem sauberen Zwischenstand an.

## 7. Fragen (beantwortet 01.11.)
Plan so bauen (alle drei Teile) · Spur „Selbst schreiben“ · Anwenden ohne Claude: „Später prüfen lassen“ · niedrige Behaltensrate: junge Wörter früher mit Minuten-Hinweis. Bilder Teil 3 (Einstufung, Hinzufügen) entstehen vor dessen Bau; Fragen dazu nur bei echter Entscheidung.
