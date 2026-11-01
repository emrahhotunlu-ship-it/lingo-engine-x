# V3 Bau-Notiz: Lernkarte, Band, Sitzung (Großpaket A, Schritte 2–4)

Stand 01.11.2026. Grundlage: `plan.md` §6, `grosspaket-a.md`, Bilder `bilder/s1-*`. Diese Notiz geht vor dem Bau an learning-scientist (Ablauf, Rückmeldung) und english-teacher (Warum-Zeilen, Wozu-Sätze).

## 1. Karte (rein, `domain/card.ts`)
- **Sätze je Lexem**, Reihenfolge = Schlüsselliste für `pickSentence`: Ankersatz `ex` (Schlüssel `a`) → `wx` ohne `bad` → `sb` mit `src` read/c1 sofort, `src` ai nur bei wirksamer Freigabe (`app/profile.sbGate`, gleiche Regel wie `effectiveGate`) **und** 28 Tage nach Erzeugung. Schlüssel: `h` + hash32(en) in Basis 36 (stabil, ≤ 8 Zeichen; `lex.sn` erlaubt 80).
- **Lücke finden**: Satz in Wörter zerlegen; Treffer, wenn ein Wort (bzw. bei Mehrwort die erste und letzte Stelle) die Grundform, eine Beugung (`inflections`) oder eine unregelmäßige Form ist. Gesucht wird das Gefundene **so, wie es im Satz steht** (*brought* in *We brought the deadline forward*). Findet sich nichts, ist der Satz für dieses Lexem nicht nutzbar (nie eine Lücke raten). Hat das Lexem gar keinen nutzbaren Satz, wird jede Satzform zu „ohne Satz“ (deutscher Chunk → Englisch).
- **Leck-Prüfung**: steht das Ziel außerhalb der Lücke noch einmal im Satz (`leaks`), ist der Satz nicht nutzbar.
- **Ziel für die Auswertung** (`Target`): Antwort wie im Satz, `k`, Wortart aus `pos`, `syn` aus `gr.var` und Charge-`syn`, `evade`/`colloc` aus `LEX_INFO`, `uncount` aus `gr.cnt`, Nachbarwörter vor/nach der Lücke, `ff` aus `TRAP_KIND`.
- **Hinweis „Gesucht: …“** bis Stufe 4 (deutsche Bedeutung `de`), bei falschen Freunden mit Zusatz „sieht aus wie ein deutsches Wort“.
- **Tipp** (Schritt A und auf Wunsch): Anfangsbuchstabe + Wortzahl, zählt als „mit Hilfe“ (`hint = 1`, höchstens Hard).

## 2. Band nach jeder Antwort (rein, `domain/band.ts`)
Feste Reihenfolge wie im Bild s1-08…s1-13: Urteil · Lösungszeile · Warum · Wortpartner · Kommt wieder · Knöpfe.
- **Urteil**: ok → „Richtig“; syn → „Auch richtig“; typo/spell/infl/hyph → „Fast richtig“; evade → „Geht, gesucht war …“; colloc → „Partner falsch“; prep/plural/order → „Fast richtig“ (Note 2) bzw. „Noch nicht“ (Note 1); pos/other/wrong → „Noch nicht“; dunno → „Lösung“.
- **Lösungszeile**: bei „Fast richtig“ Buchstaben-Vergleich (fehlt = gelb unterstrichen, zu viel = rot durchgestrichen); sonst „Du: ~~x~~ → Richtig: y“.
- **Warum** (auch bei richtig, Kap. 2 Nr. 4), Vorrang: (1) Lehrer-Zeile `why` der Charge zum Stichwort, (2) Regel-Zeile zum Ausgang (Tippfehler, Rechtschreibliste, Beugung, Wortart, Verwechslungspaar, falscher Freund, Artikel, britisch, Präposition, Plural, Stellung, Partner), (3) Bedeutungszeile „*word* = Bedeutung (Wortart)“.
- **Wortpartner**: bis zu 2 aus `col` (`p`).
- **Kommt wieder** aus dem **gespeicherten** Ergebnis, nie neu gerechnet: Lernschritt heute → „gleich noch einmal (in einem neuen Satz | ohne Satz)“, danach „· dann morgen“, wenn der Termin morgen ist; sonst Datum des gebuchten Termins (`b.due` bzw. `u.due`) mit Zusatz „etwas früher, weil es knapp war“ (Note 2) oder „in einem neuen Satz“ (mehr als ein Satz da). Übung ohne Planwirkung: „Übung · ändert den Plan nicht“ + nächster Termin. Unit-Test: angezeigter Tag = `dayKey(gespeicherter due)`.
- **Knöpfe**: „Mehr“ immer; „War das auch richtig?“ bei Fast richtig/Noch nicht/Partner falsch; „Das wusste ich eigentlich“ bei „Noch nicht“ mit Planwirkung.

## 3. Schreiben (eine Buchung je Antwort, zuerst rein gerechnet)
- Die Antwort wird rein gerechnet (`applyAnswer`) und das Band daraus gezeigt. Geschrieben wird **beim Weiter** bzw. sofort beim Verlassen (Bildschirmwechsel, `pagehide`/`visibilitychange`), genau einmal. So können „Das wusste ich eigentlich“ und „War das auch richtig?“ die Antwort ändern, bevor sie gebucht ist, ohne Rückbuchung.
- **„Das wusste ich eigentlich“** (B4): keine Note, Wiederkehr nach 3–5 Karten in einem neuen Satz; nur dieser neue Versuch wird gewertet. Verlauf mit Flag `override`. „Rückgängig“ bis zum Weiter.
- **„War das auch richtig?“**: mit Claude kurze Prüfung (Dienst von außen); Ja → Ausgang `syn` (keine Note, Wiederkehr mit gesuchtem Wort); ohne Claude → „Später prüfen lassen“ (Ausgang `unfair`, Meldung an die Inhaltsprüfung, keine Note).
- **Einführung** (B10): Versuch → Aufdecken → `introduce` (neue Schreibfunktion `writeIntro`: `transform` auf `lex` + Verlaufseintrag, Form `intro`, keine FSRS-Buchung). **„Kenne ich schon“** → Probe frei ohne Satz (`probe`, frei getippt): richtig → Einführung mit Kontrolle in 7 Tagen; falsch → normale Einführung.
- **Sperre**: Die neue Karte schreibt nur, wenn `vcfg.mod = 1` **und** `app/schema.vocabModule.state = 'done'` (data-guard V2).

## 4. Sitzung (Schritt 3)
Pflicht: fällig → neue eingestreut (erste nach 4) → Fehler nach 4 Karten zurück (Lernschritt) → Schritt A nach 3, Schritt B nach 8 Karten und 3 Min. Falscher Freund: Kontrastkarte (Paar mit Bedeutung, kein FSRS). Menü: „Warum heute?“ (fällig seit, zuletzt frei richtig, Spur und Stufe), „Aufgabe war unfair“. Rückkehr nach Pause: Runde merkt sich nichts im Browser außer dem Entwurf; offene Lernschritte stehen in `lex.step` und kommen in der nächsten Runde des Lerntags zuerst.

## 5. Einbau
- Bildschirme unter `src/modules/vocab/ui/`, nachgeladen über `api.ts` (`loadScreens()`), Route im Bereich Wörter, nur bei `vcfg.mod = 1`.
- Dienste von außen (Sprachausgabe, Wörterbuch `isWord`, Claude-Prüfung, Datumsformat) gibt der Bereich als Eigenschaften hinein; im Modul nur `shared.ts` erweitert um Oberflächen-Bausteine (`ExerciseShell`), Texte (`useT`) und Live-Daten.
- Texte nur in `src/i18n/parts/vm.de.ts`/`vm.en.ts`.

## 6. Vorprüfung (01.11.2026) – übernommen
**learning-scientist (nachbessern, umgesetzt):**
1. **„Das wusste ich eigentlich“**: erste Antwort ohne Note (Flag `override`), Wiederkehr nach 4 Karten in neuem Satz (`step.n = 20`); die Wiederkehr zählt höchstens „Schwer“, ohne Beleg-Tag, ohne Aufstieg; falsch = normaler Fehlerweg. Nur bei der ersten Antwort des Lexems am Lerntag (`lex.day` ≠ heute, kein Lernschritt heute), damit höchstens einmal je Tag. Planer + Test angepasst.
2. **„Später prüfen lassen“** (ohne Claude): keine Note, Meldung an die Inhaltsprüfung (`unfair`), aber Wiederkehr wie 1. (`step.n = 21`, Deckel „Schwer“), gleiche Tagesregel. Neues Flag `later = 128`.
3. **Schreiben beim Weiter**: `t`, `ms`, `fk` werden beim Prüfen eingefroren; der Bestand im Speicher (Katalog) wird vor `SessionRun.done` mit dem rein gerechneten Lexem ersetzt; Schlüssel je Antwort = `vlogKey(t)` (idempotent); offener Antwortentwurf zusätzlich im Browser (`lx:vm-pending`) und beim nächsten Start nachgebucht (nur wenn `lex.sync < t`).
4. **Urteilswörter**: `spell` → „Schreibweise“, `infl` → „Richtiges Wort, falsche Form“. Lösungszeile immer: richtig „Du: y ✓“, Auch richtig „Du: x ✓ · geübt wird: y“.
5. **Kap. 5 Nr. 11**: bei `wrong`/`other` zeigt Warum, was das getippte Wort heißt (Wörterbuch von außen, `meaningOf`), sonst die Regel-Zeile.
6. **„Kenne ich schon“**: Probe ohne Satz und ohne Stützen; richtig → Benutzen-Spur bucht „Gut“, Termin fest Tag 7, Stufe 3, kein Beleg-Tag; Auch richtig/Ausweichwort/falsch → normale Einführung.
7. **Satzwahl**: Ankersatz nur bei Einführung und Schritt A, danach `pickSentence` (am längsten nicht gezeigt); Wiederkehr nie im Fehlersatz. „Lücke nicht gefunden“ wird an die Inhaltsprüfung gemeldet (`logWarn` + Zähler), Form „ohne Satz“ nur, wenn gar kein Satz nutzbar ist. Trennbare Phrasal Verbs: Teile als getrennte Lücken, Objekt bleibt stehen (höchstens 2 Wörter dazwischen), Antwort = Teile mit Leerzeichen.
8. **Wozu** je Form fest in der Aufgabenzeile (`vm.de/en`); Kontrastkarte: „Übung · ändert den Plan nicht“.

**english-teacher (umgesetzt):** Regel-Zeilen je Ausgang/Hinweis, Urteilswörter („Geht – genauer: …“, „Wortpartner falsch“, EN „Here's the answer“), Aufgabe/Wozu je Form wörtlich in `src/i18n/parts/vm.*.ts`. Neuer Hinweis `an` (a↔an nach Laut, nicht Tippfehler). Platzhalter `{hit}`, `{pair}`. Offen als Inhalt (Großpaket A Schritt 8): eigener Grund je Eintrag der Rechtschreibliste; `ok · article` nur angleichen, wenn der Artikel in den Satz passt.

## 7. Umgesetzt in Schritt 2a (01.11.2026)
- `domain/card.ts` (Sätze, Lücke inkl. getrennter Phrasal Verbs, Leck, Satzwahl, Ziel, Gesucht, Tipp), `domain/diff.ts` (Buchstaben-Vergleich), `domain/band.ts` (Urteil, Lösungszeile, Warum, Wortpartner, Kommt wieder, Knöpfe), Planer `mayVoid`/`probeKnown`/Flag `later`, Texte `vm.de/en`. Tests `tests/unit/vocab/v3.test.ts`.
- **Warum, Vorrang wie gebaut:** Formfehler und Auch richtig → Regel-Zeile (erklärt genau diesen Fehler); richtig ohne Hinweis und falscher Freund → Lehrer-Zeile `why` der Charge (nur Deutsch; Englisch → Bedeutungszeile bzw. Regel-Zeile); anderes Wort/falsch → was das getippte Wort heißt (`meaningOf`), sonst Regel-Zeile; Weiß ich nicht → Lösung mit Bedeutung.
- „War das auch richtig?“ nicht bei „Geht – genauer“ (die Antwort gilt dort schon).
