# Funktionsabgleich: alte App („Sprachwerkstatt", JLL8) gegen die neuen Pläne

Stand: 26.09.2026. Grundlage für Emrahs Vorgabe „nicht schlechter als die alte App" (CLAUDE.md A7, „Funktionsgleichheit und Tempo").

**Quellen der alten App** (nur gelesen, kein Code übernommen):
- gesicherter Quelltext `scratchpad/jll8/js/*` (46 Module, u. a. `today.js`, `cards.js`, `vocab.js`, `session.js`, `lesson.js`, `grammar.js`, `wissen.js`, `drills.js`, `sprint.js`, `read.js`, `listen.js`, `write.js`, `features/speak*.js`, `features/discover.js`, `features/chunkreview.js`, `preply.js`, `chat.js`, `claudespace.js`, `lookup.js`, `progress.js`, `assess.js`, `shell.js`, `i18n.js`);
- `docs/altapp-analyse.md`.

Gezählt wurde nur, was die alte App **tatsächlich zeigt**. Texte ohne Aufrufer im Code (z. B. Meilenstein `msTitle`, Onboarding-Liste `onbTitle`, „Neu in dieser Version" `new15T`) gelten als nicht vorhanden.

**Neue Pläne:** `docs/phase1-plan.md` … `docs/phase6-plan.md` (Phase 6 enthält Phase 7 in §12), CLAUDE.md A7, `docs/auftrag.md` Kap. 6.

**Legende:**
- ✅ abgedeckt (gleichwertig oder besser)
- ◐ SCHWÄCHER (vorhanden, aber mit spürbar weniger Umfang)
- ✗ FEHLT (in keinem Plan)
- ⊘ bewusst entfallen (Grund steht dabei; keine Ergänzung nötig)

Alle Ergänzungen folgen Emrahs Regeln aus A7 (18:15 Uhr und „Vollausbau"):
- keine Selbstbewertung,
- Status statt Erklärtexten (Zweck nur hinter dem Info-Symbol),
- Beispiele statt „Warum"-Absätzen,
- jedes englische Wort antippbar (mit „Claude fragen"),
- Buchstaben-Platzhalter in den Stufen mit Hilfe.

---

## 1. Rahmen und Navigation

| Funktion der alten App | Neue Pläne | Status | Anmerkung |
|---|---|---|---|
| 5 Hauptreiter (Heute · Sprechen · Entdecken · Üben · Nachschlagen) mit Unterreitern, Seitenleiste am Rechner (`shell.js` TABS, LEARN_SUBS) | P2 §3 Navigation (3 Reiter Heute · Lernen · Dein Stand); P3 Route `speak`; P4 §2.3 Routen, `modules.ts` „falls Phase 2 ihn nicht hat"; P5 D2 „Preply dort oder auf Dein Stand" | ◐ | Jede Phase hängt ihre Bildschirme „irgendwo" an. Eine verbindliche Gesamtkarte, wo Sprechen, Entdecken, Lesen/Hören/Schreiben, Preply und Wortschatz liegen, fehlt. → **M13** |
| Reiter-Kennzeichen „Pflicht / frei wählbar / nur Info" (`TAB_NATURE`) | Kap. 2.6; P1 §5.2 Pflicht/Extra auf Heute | ✅ | Trennung Pflicht/Freiwillig steht auf Heute, nicht an jedem Reiter |
| Zahl am Reiter (offene Pflicht an „Heute", fällige Karten), Ladekreis bei laufender KI-Korrektur (`tabBadge`) | – | ✗ | → **M13** |
| Bildlaufposition je Liste wird gemerkt (`SCROLL_KEEP`) | – | ✗ | Kleinigkeit → **M13** |
| Kopfzeile mit Serie, Stufe, XP | P1 §5.2 (Serie); P1 E23 (XP nie angezeigt) | ✅/⊘ | XP-Anzeige bewusst weg (Kap. 2.3, Kap. 7) |
| Einführung beim ersten Start (3 Folien, `tour11`) | – | ⊘ | Emrah kennt die App. Sinnvoll ist nur ein einmaliger Hinweis „Was ist neu" nach dem Umzug → **M20** |
| Info-Blätter „Was bedeutet das?" (`iLevelT`, `iStageT`, …) | P2 §5.0, P3 D8, P4 §4 (Info-Symbol) | ✅ | A7: Zweck nur hinter dem Info-Symbol |
| Hintergrund-Vorbereitung von Artikeln, Hörtexten, Schreibaufgaben (`prewarmAll`, `lastAutoGen`, `autoTopUp`) | P1 §1.2, P4 §0.2 | ⊘ | `sample.d.ts`: KI nur auf ausdrückliche Handlung. Ersatz: Startbestand + Knopf |

## 2. Heute / Start

| Funktion der alten App | Neue Pläne | Status | Anmerkung |
|---|---|---|---|
| Eine Tageskarte: „Noch nicht fertig · 1/3 · es fehlt …" bzw. „Fertig für heute", Minuten heute (`renderCourse`) | P1 §5.2; P2 §6.2 `deriveToday` | ✅ | |
| Pflicht (Lektion + Wiederholen + Kanal) und Freiwilliges getrennt, Erledigtes ohne Knopf | P2 §6; P6 §5 | ✅ | |
| Begründung je Zeile („seit 5 Tagen nicht", „Claudes Fokus") | P2 D14; P6 §5.5 | ✅ | |
| Tagesplan einmal pro Tag gespeichert | P1 §3.6; P6 E9 | ✅ | |
| Tagesbilanz „Heute schon gemacht" (Minuten, richtig) | P1 §5.2 Nr. 6; P6 E11 | ✅ | |
| „Weiter mit: {nächster Schritt}" direkt aus der Zusammenfassung einer Runde (`sumNext`), Planleiste während der Übung („Schritt 2 von 3") | P1 §5.3 Zusammenfassung: nur „Zurück zu Heute" | ◐ | Ein Tipp mehr je Pflichtschritt → **M11** |
| „Liegt am längsten": die zwei vernachlässigten Bereiche als Abkürzung (`peek`) | P6 §5 (Gewichtung „wie lange liegengeblieben") | ✅ | als Grund in der Planzeile |
| Statuskarte am Rand: Stufe mit Niveau-Leiste, XP heute, Serie, aktive Wörter, Wortschatzziel, **Wochenstreifen mit 7 Tagesringen** (`statusCardHtml`, `weekStrip`) | P1 §5.2 Nr. 1 (Serie + Ruhetag-Zeile); P1 §4.9 und P6 (Wortschatzziel auf Dein Stand); P6 §7.4 Heatmap 26 Wochen | ◐ | Der Wochenstreifen fehlt. Er passt gut zur neuen Serienregel (Pflicht je Tag, ein Ruhetag Mo–So) → **M7** |
| Fokus-Karte „Heute im Fokus" / Mini-Einschätzung auf der Startseite (`focusCardHtml`, `assessFocusHtml`) | P6 §5.5 „Keine Einschätzung auf Heute", Fokus fließt als Grund in den Plan | ⊘ | Kap. 2.1 (eine rote Linie) |
| Begrüßung nach Tageszeit | – | ⊘ | ohne Nutzen |
| Wortschatz bis C1 (8.000) mit Tempo | P1 §4.9; P6 §1 | ✅ | |
| Veränderungs-Chips nach einem Schritt („Was sich verändert hat", Level-Score) | – | ⊘ | Kap. 2.3 Urteil statt Punktestand |

## 3. Vokabeltrainer (Karten)

| Funktion der alten App | Neue Pläne | Status | Anmerkung |
|---|---|---|---|
| Fünfstufige Leiter mit Abfrageart je Stufe, automatisch bewertet (`cards.js` TR_EX, 10 Arten) | P1 §4.2 (13 Arten, ≥ 2 je Stufe), §4.3 | ✅ | besser |
| Neue Wörter unter die Wiederholungen gemischt, Kontingent 0/2/5/10 | P1 §4.5, §1.1 Nr. 5 | ✅ | |
| Blutegel-Marke „Problemwort" | P1 §4.3 Chip „hartnäckig" | ✅ | |
| **„Merkhilfe von Claude"** (Eselsbrücke für Problemwörter, `leechBtn`) | P1 §1.2 „Eselsbrücken → Phase 2, learning-scientist entscheidet"; Phase 2: nicht enthalten | ✗ | → **M3** |
| **„Ich lag richtig"** (Einspruch, wenn die automatische Prüfung irrt, `trOverride`) | – | ✗ | Mit automatischer Einstufung wichtiger als vorher → **M4** |
| **„Einmal richtig schreiben"** nach falscher getippter Antwort (`copyTitle`) | – | ✗ | → **M5** |
| **Nach richtiger Antwort automatisch weiter** (`autoNext`, in den Einstellungen abschaltbar; Feld `profile.autoNext` gibt es noch) | A7 „nur Weiter"; kein Plan | ✗ | → **M6** |
| Stapel wählen (Fällig + neu · nur fällige · Schwierige · Beruf · Alle) und Rundengröße 10/20/30 (`TR_DECKS`) | P1 §4.5: feste Pflichtrunde + „Freiwillig weiterüben · 10 Karten" | ◐ | → **M9** |
| Tastatur: 1–4, Enter, Leertaste | P1 §5.3 | ✅ | |
| Eigener Satz mit KI-Prüfung | P1 §4.2 `produce`, §4.10 | ✅ | |
| „Weiß ich nicht", Tipp | P1 §5.3; P2 §5.0 | ✅ | |
| Selbstbewertung Nochmal/Schwer/Gut/Leicht (ältere Karteikarten) | A7 18:15 | ⊘ | von Emrah abgeschafft |

## 4. Wortschatz-Liste (Bereich „Wortschatz", `vocab.js`)

| Funktion der alten App | Neue Pläne | Status | Anmerkung |
|---|---|---|---|
| **Liste aller Wörter** mit Stufen-Punkten, Bedeutung, Fälligkeit | – (P1 „Dein Stand" zeigt nur Zahlen je Stufe) | ✗ | → **M1** |
| **Filter** Alle · Unsicher (Stufe 1–2) · Fällig · Neu · Nur mit Hilfe (Stufe 3) · Beruf · Sicher (4–5); **Sortierung** Stufe / A–Z | – | ✗ | → **M1** |
| Kennzahlen „In deinen Karten": gesamt · heute fällig · passiv · aktiv · Kollokationen | P1 §1.1 Nr. 6 (Stufen, Wendungen) | ◐ | → **M1** |
| **Wortblatt** je Wort: Stufe, Abrufwahrscheinlichkeit jetzt, Stabilität, Schwierigkeit, nächste Wiederholung, Wiederholungen/Vergessen, Bilanz je Abfrageart, Kollokationen, Aussprechen | P1 §5.6 (Nachschlagen zeigt Bedeutung, Stufe, „Wieder aufnehmen"); P6 §7.5 Messwerte nur gesamt | ✗ | → **M1** |
| **Aktionen am Wort:** Jetzt üben · „Kenne ich sicher" (Kontrolle in 30 Tagen) · Zurücksetzen · Entfernen (`hidden`) | P1 §1.2 „Kenne ich schon, Karten bearbeiten → Phase 2"; Phase 2: nicht enthalten. Nur „Wieder aufnehmen/Rückgängig" im Nachschlagen | ✗ | → **M1**, **M2** |
| **Eigenes Wort hinzufügen** (EN + DE) | nur über Wort-Antippen in Texten (P1 §5.6, P4 F21) | ✗ | → **M2** |
| **„8 neue Wörter von Claude"** und **„Fachwörter für deinen Job"** auf Knopfdruck (`gen8`, `genJob`) | P1 §1.2 „autoTopUp → Phase 2"; Phase 2: nicht enthalten | ✗ | Ohne das geht der Vorrat an neuen Wörtern leer → **M2** |
| Zeile „Neue Wörter heute: 3 von 5 offen / Kontingent ausgeschöpft / kein Vorrat" | P1 Einstellungen (nur Auswahl) | ◐ | → **M1** |
| Einstieg „Aus Preply importieren" | P5 §8.3 | ✅ | anderer Ort |
| Wortschatztest-Banner mit Schätzung passiv/aktiv | P6 §8, E18 | ✅ | |

## 5. Wortschatztest

| Funktion der alten App | Neue Pläne | Status | Anmerkung |
|---|---|---|---|
| Ja/Nein über Häufigkeitsbänder mit Fantasiewörtern, Bedeutungsprobe, aktiver Abruf, Ergebnis passiv/aktiv mit Band, CEFR, Tasten J/N (`vocab.js` vt*) | P6 §8 (E17), Tasten J/N | ✅ | |

## 6. Grammatik und Nachschlagewerk „Wissen"

| Funktion der alten App | Neue Pläne | Status | Anmerkung |
|---|---|---|---|
| 16 Themen mit Beherrschung (BKT, Verfall), Status Neu/Schwach/Im Aufbau/Gefestigt/Gemeistert | P2 §4.3, §5.2 | ✅ | |
| Themenblatt: Regel mit Begründung, Entscheidungsweg, Formen, Signalwörter, Kontrast zum Deutschen, typische Fehler, „Wann beides richtig ist", letzte eigene Fehler | P2 §5.2 „Themenblatt" | ✅ | |
| „Dieses Thema üben · 8 Aufgaben", neue Aufgaben von Claude | P2 §3 `grammarSession{topic}`, §5.2 | ✅ | |
| Wort-für-Wort-Vergleich, „Auch richtig", „Warum nicht deine Option?" | P2 §5.0 | ✅ | als Vergleich + Form-Hinweis + Beispiele (A7) |
| Fehler-Wiederholung (Boxen 1/3/9), „Nur meine Fehler" | P2 D1, §5.3 | ✅ | |
| „Noch genauer erklären" (Claude) | P5 §8.4 (Begleiter sieht die Aufgabe) | ✅ | |
| **Wissen: Suche über alle Regeln** („Passiv", „by Friday", „would") | – | ✗ | → **M8** |
| **Wissen: „Deutsch → Englisch: wo es klemmt"** (Fallen-Übersicht, `wsDeT`) | nur je Thema im Regelblatt (`contrast`, `traps`) | ◐ | → **M8** |
| Wissen: „Deine Baustellen" (schwächste Themen) | P2 Themenliste (sortiert nach Sicherheit); P6 Blocker | ✅ | |

## 7. Kurs und Lektionen

| Funktion der alten App | Neue Pläne | Status | Anmerkung |
|---|---|---|---|
| 24 Lektionen in 6 Einheiten, Weg zu C1 mit Fortschrittsbalken | P2 §5.1, B2 | ✅ | |
| Wörter → Dialog (hören, lesen, Übersetzung zeigen, Fragen) → Grammatik → eigene Produktion mit KI-Urteil | P2 §5.1 | ✅ | |
| Lektion ohne KI (Ersatzfassung) | P2 D11 | ✅ | |
| Nächste Lektion wird vorbereitet | P2 §5.1 („auf Knopfdruck") | ⊘ | `sample.d.ts` (keine Vorab-Erzeugung) |
| Meilenstein je Einheit (Kap. 7 verlangt ihn; in der alten App nur als Text ohne Aufrufer) | P6 §7.4 nur als Marke im Verlaufsdiagramm | ◐ | Kap. 7 „Meilensteine je Einheit" → **M17** |

## 8. Übungen (Drills, Sprint, gemischte Runde, Wochen-Check)

| Funktion der alten App | Neue Pläne | Status | Anmerkung |
|---|---|---|---|
| Diktat (Satz hören, Wort für Wort, „Langsamer", Fehlerarten Hilfsverb/Artikel/Präposition/Endung) | P2 §5.4 | ✅ | |
| Lückenjagd (Kollokation im Satz, „wozu gehört deine Wahl") | P2 §5.5 | ✅ | |
| Satzbau aus Bausteinen mit Regelhinweis | P2 §5.6 | ✅ | |
| Sprint 60 s mit Combo, Rekord, Reaktionszeit, „Das übst du nochmal" | P2 §5.7 (90 s, Tempozahl + Wochenschnitt, Fehlerliste) | ✅/⊘ | Combo und Rekord bewusst weg (Kap. 7) |
| „Kollokationen üben" (eigene Runde) | P2 §5.5 Lückenjagd; P1 `colloc` | ✅ | |
| Gemischte Runde Grammatik + Vokabeln (`session.js`) | P1 Trainer + P2 Grammatik getrennt, beide verschachtelt | ✅ | |
| **Wochen-Check:** einmal pro Woche 12 gemischte Aufgaben ohne Tipps, Ergebnis in % gegen den letzten Check, Themen für die nächste Woche (`startSession("check")`, `profile.checks[]`) | – | ✗ | → **M10** |

## 9. Lesen

| Funktion der alten App | Neue Pläne | Status | Anmerkung |
|---|---|---|---|
| Artikelliste, neuer Artikel von Claude | P4 §4.1 | ✅ | |
| **Themenwahl beim Erzeugen** (Überrasch mich · Business · Tech & KI · Fußball · Reisen · Wissenschaft · Film) | P4 §5 `topicHint` nur in der Vorlage, keine Oberfläche | ◐ | → **M12** |
| Wörter antippen, Schlüsselwörter (Glossar) | P4 §4.1 | ✅ | |
| Zusammenfassung mit KI-Prüfung (Kernaussagen, Missverständnisse, Sprache, Musterzusammenfassung) | P4 §4.1 Nr. 5, F17 | ✅ | |
| Verständnisfragen | P4 §4.1 Nr. 3 (neu, automatisch bewertet, mit Beleg) | ✅ | besser |
| „Schlüsselwörter als Karten" (alle auf einmal) | P4 F22 (je Wendung einzeln) | ◐ | klein → **M12** |

## 10. Hören

| Funktion der alten App | Neue Pläne | Status | Anmerkung |
|---|---|---|---|
| Abspielen/Pause, **Fortschrittsbalken**, „Satz zurück", **Tempo**, „n× gehört" | P4 §4.2 Nr. 3 (`AudioBar`, Abschnitt n von m, Tempo 0,8–1,0, `plays`) | ✅ | |
| Fragen (Kernaussage / Detail / zwischen den Zeilen), Wörter aus dem Text | P4 §4.2 | ✅ | |
| Neuer Hörtext „zu deinem Job" | P4 §5 `listening-text@1` (Beruf/Alltag nach `mix`) | ✅ | |
| **Shadowing mit automatischer Pause** („Zuhören … – Jetzt du!", Satz für Satz) | P4 §4.2 Nr. 5 (Transkript, Abschnitte einzeln abspielbar, „Sprich leise mit") | ◐ | → **M12** |
| Ohne Sprachausgabe: Text als Lesetext | P4 §4.2 | ✅ | |

## 11. Schreiben

| Funktion der alten App | Neue Pläne | Status | Anmerkung |
|---|---|---|---|
| Aufgabe für dich, „Andere Aufgabe", Aufgabe auf Englisch zeigen, Fokus, Zielumfang, Wortzähler, Entwurf | P4 §4.3 | ✅ | |
| Nützliche Wendungen **antippen zum Einfügen** | P4 §4.3 (Chips haken sich beim Tippen ab, antippbar = Nachschlagen) | ◐ | Einfügen per Tipp fehlt → **M12** |
| **Eigenes Thema** („Worüber willst du schreiben?", `wOwn`) | – | ✗ | → **M12** |
| Bewertung: CEFR, 5 Kriterien, Stärken, Fehler nach Kategorie, verbesserte C1-Fassung, „Präziser ausdrücken" (Upgrades), Wendungen zum Mitnehmen, Tipp, + Karte | P4 §4.3 Nr. 4 | ✅ | Kriterien als Punktreihe (A7) |
| Überarbeiten, Verlauf aller Texte | P4 §4.3 Nr. 5, 7 | ✅ | |
| **Korrektur läuft im Hintergrund weiter**, während man etwas anderes macht („Sprint in der Zwischenzeit", Hinweis am Reiter) | P4 §4.3 Nr. 3 (`AiRunPanel` im Bildschirm; A6.2 bricht beim Bildschirmwechsel ab) | ◐ | 20–40 s Warten erzwungen → **M14** |

## 12. Sprechen, Szenen, Wendungen

| Funktion der alten App | Neue Pläne | Status | Anmerkung |
|---|---|---|---|
| Szenenbibliothek, neue Szene aus Wunschthema, Einweisung (Ziel, Gegenüber, Wendungen) | P3 §5.1, §5.2 | ✅ | |
| Rollenspiel, Figur korrigiert nie, Analysepanel mit 3 Schichten, „mitnehmen" | P3 §5.2, §5.3 | ✅ | |
| Abschlussbericht (Ziel erreicht, Stärken, Lücke zu C1, Mitnehmen) | P3 §5.4 | ✅ | |
| Stimme an/aus im Gespräch | P3 §1 Nr. 5 | ✅ | |
| Wendungen-Wiederholung mit 3 Arten: Lücke im Originalsatz · frei erzeugen · **aus der Situation heraus** („Du bist wieder in dieser Szene …"), „Damals hattest du gesagt" (`chunkreview.js`) | P1 §4.2 (Chunks in allen Karten-Arten), P3 §3.3 | ◐ | Die Situations-Abfrage fehlt → **M15** |
| Business-Suite (neu im Auftrag) | P3 §5.5 | ✅ | neu |

## 13. Entdecken

| Funktion der alten App | Neue Pläne | Status | Anmerkung |
|---|---|---|---|
| Beiträge aus `feed/*`, vier Schritte, Podcasts/Vorträge mit Hörhilfe, Wendungen abhaken, „Claude drauf schauen lassen" | P4 §4.4 | ✅ | |
| Eigene Beiträge (`feed/<datum>-own-*`, in der alten App über den Chat „create_input_lesson" aus eingefügtem Text) | P4 §1 „Eigene Beiträge hinzufügen – verboten (würde `feed/*` schreiben)"; Anzeige der alten `-own-` ✅ | ◐ | Anlegen fehlt → **M16** |

## 14. Preply-Brücke

| Funktion der alten App | Neue Pläne | Status | Anmerkung |
|---|---|---|---|
| Stunde vorbereiten (Ziel, Aufwärmen, Sprechanlässe, Sätze, Fehler-Fokus, Nachricht kopieren) | P5 §8.3 | ✅ | |
| Vom Lehrer übernehmen (Korrekturen, Aufgaben, Wörter, Hausaufgabe), Übernahme nach Bestätigung | P5 §5.4, §5.5, §8.3 | ✅ | besser (einzeln abwählbar) |
| „Stunde gehalten", Verlauf | P5 E5-17, §8.3 | ✅ | |
| **„Daraus eine Preply-Stunde machen" von überall** (Artikel, Text, Grammatikthema, Szene; `ppMake`) | P5 §8.3 Anlass-Chips nur: freies Gespräch, aktuelle Lektion, Thema, letzter Import | ◐ | → **M18** |

## 15. Claude-Chat und Claude-Raum

| Funktion der alten App | Neue Pläne | Status | Anmerkung |
|---|---|---|---|
| Chat mit Kontext der laufenden Aufgabe (ohne Lösung vor dem Prüfen), Vorschläge, Markdown mit Tabellen, „Zum Ende", Verlauf ≤ 40 | P5 §6.1, §8.1, E5-05, E5-07, E5-08 | ✅ | |
| Voller Claude-Bereich, Claude-Knopf an jeder Aufgabe | P5 §8.1 (Overlay, Vollbild am Handy), §8.4 `useCompanionSee` | ✅ | |
| **Umschalter „Schnell / Gründlich"** (`chTier` quick/default) | P5 E5-01 (fest `default`) | ◐ | → **M19** |
| **Chat kann handeln** (Werkzeuge: Karten anlegen, eigene Karten suchen, Bildschirm öffnen, Übung starten, Lese-Einheit aus eingefügtem Text bauen, Import öffnen) | P5 §1 „`tools` im Chat nicht geplant" | ◐ | Emrah hatte das am 24.09. ausdrücklich gewünscht (`claudespace.js`) → **M19** |

## 16. Übersetzer und Nachschlagen

| Funktion der alten App | Neue Pläne | Status | Anmerkung |
|---|---|---|---|
| Übersetzer DE↔EN, automatisch erkannt, Alternativen, Beispiele, „Zuletzt übersetzt", Enter übersetzt | P5 §6.2, §8.2 (plus Register, Verlauf 5, Taste `/`) | ✅ | besser |
| Übersetzung als Karteikarte speichern | P5 §8.2 (EN antippbar → Karte, `src:'translate'`) | ✅ | |
| Wort antippen: Wörterbuch zuerst, Grundform, „Im Kontext erklären", „In deinen Vokabeln", als Karte, Frag Claude | P1 §5.6; P5 E5-09 | ✅ | plus US-Lautschrift, Ursprungssatz |

## 17. Fortschritt

| Funktion der alten App | Neue Pläne | Status | Anmerkung |
|---|---|---|---|
| Claudes Einschätzung (Stufe, Trend, Stärken, Blocker mit „So geht's", Fokus, Lücke zu C1, Niveau je Fertigkeit mit Datenlage) | P6 §4 | ✅ | |
| **Aktivitäts-Heatmap** (12 Wochen) | P6 §7.4 (26 Wochen) | ✅ | |
| **Fehler-Radar** mit Trend und Beispielen je Kategorie, „Üben" | P6 §7.1 | ✅ | |
| **Can-Do-Liste B2 → C1** mit „Kann ich" (selbst abhaken, rückgängig) | P6 §7.2, E16 | ✅ | |
| **Dimensionen** (Level je Bereich mit Messgenauigkeit) | P6 §4 (6 Fertigkeiten mit Belastbarkeit), §7.5 Messwerte | ✅ | |
| **Niveau-Leiste** (Skala B1 … C2 mit Punkt und hellem Band der Unsicherheit, `scaleHtml`) | P6 §10.2 „Stufen als ruhige Pillen" | ◐ | → **M7** |
| Verlauf als Liniendiagramm | P6 §7.4 | ✅ | |
| Wochenvergleich (7 Tage gegen die 7 davor) | P6 §7.3 Wochenbericht | ✅ | |
| „Deine größten Hebel" (schwächster Bereich, Thema, Fehlermuster mit Üben) | P6 Blocker mit „Üben" | ✅ | |
| KPIs (passiv, aktiv, Ø Grammatik, Kollokationen, XP der Woche), „So wächst dein Level" | P6 §7.5 eingeklappt | ✅/⊘ | Punktestände bewusst eingeklappt |
| Letzte Fortschritte (`profile.feed[]`), Ergebnisse der Wochen-Checks (`profile.checks[]`) | – | ◐ | Kap. 14 „alle bisherigen Daten sichtbar" → **M10** |

## 18. Einstellungen

| Funktion der alten App | Neue Pläne | Status | Anmerkung |
|---|---|---|---|
| Sprache der App | vorhanden (Phase 0/MVP) | ✅ | |
| Hell/Dunkel: System · Hell · Gedämpft · Dunkel | vorhanden (`app/settings.ts`, `auto`) | ✅ | |
| **Farbthema: Salbei · Ozean · Pflaume · Graphit** (`theme.p`, `PALETTES`) | – | ✗ | → **M21** |
| Neue Wörter pro Tag | P1 §1.1 Nr. 5 | ✅ | |
| **Nach richtiger Antwort automatisch weiter** | – | ✗ | → **M6** |
| **Beruflicher Kontext** (Freitext ≤ 400, steuert Fachwörter, Schreib- und Hörtexte, Szenen; `profile.ctx`) | P5 `prompts/work.ts` als **feste Konstante** | ◐ | → **M22** |
| Stimme (mit Hörprobe), Standard-Sprechtempo 0,8–1,1 | P3 §5.6; P6 §9 | ✅ | |
| Tagesziel | P6 E11 (Minuten statt XP) | ✅ | |
| Ton, Diagnose, Datenexport | P6 §9; vorhanden | ✅ | neu |

## 19. Querschnitt

| Funktion der alten App | Neue Pläne | Status | Anmerkung |
|---|---|---|---|
| Tastaturkürzel (1–4, Enter, Leertaste, J/N, Esc, Strg+Enter im Diktat) | P1 §5.3; P4 §4.5; P5 §8.2 `/`; P6 §8 | ✅ | |
| Sprachausgabe robust am Handy | P3 §7; P4 §2.4 | ✅ | |
| Fehlermeldungen je KI-Fehlercode | Phase 1 WP1 (KI-Tor) | ✅ | |
| XP je Antwort, „+XP", „Neues Level" | P1 E23 | ⊘ | Kap. 2.3, Kap. 7; XP wird still weitergeführt (Rückweg, alte Serienregel) |

---

## Muss ergänzt werden

Jeder Punkt nennt Phase und Arbeitspaket. „Trainer-Umbau" meint den laufenden Umbau nach A7 18:15 Uhr (`autoGrade`, `StatusLine`, Beispiele, Wort-Antippen, Platzhalter; phase2-plan §0).

### Hoch (spürbare Lücke gegenüber der alten App)

- **M1 – Wortschatz-Bereich (Liste und Wortblatt)** · **Phase 2, neues Paket „W – Wortschatz"** (`src/features/vocab/list/*`, Route `vocab` im Reiter Lernen, Verdrahtung in INT).
  - Liste aller `vocab/*` und `chunk/*`, mit Suche.
  - Filter: Alle · Fällig · Neu · Unsicher (1–2) · Mit Hilfe (3) · Sicher (4–5) · Beruf · Wendungen · Ausgeblendet. Sortierung: Stufe / A–Z.
  - Kopfzeile als Status: gesamt · heute fällig · neu heute „3 von 5" bzw. „Vorrat leer".
  - Wortblatt (A7: Status statt Erklärtext):
    - oben Sicherheit (5 Punkte + Wort) und Stufe;
    - nächste Wiederholung; Bilanz je Abfrageart;
    - Ursprungssatz + 2–3 Beispiele, Kollokationen, 🔊, jedes Wort antippbar;
    - FSRS-Zahlen nur unter „Messwerte".
  - Aktionen: „Jetzt üben", Ausblenden/Wieder aufnehmen (`hidden`, nie löschen), Zurücksetzen (nur FSRS-Zusatzfelder, alte Felder bleiben, data-guard).
- **M2 – Wörter hinzufügen** · **Phase 2, Paket W**, Vorlage `word-gen@1` in Paket A oder W.
  - Eigenes Wort (EN, DE optional). Ohne Ursprungssatz auf Knopfdruck ein KI-Beispielsatz (Kap. 15: keine Karte ohne Satz); ohne KI Pflichtfeld „Dein Satz".
  - „Neue Wörter von Claude" und „Fachwörter für meinen Beruf", je 8, nur auf Klick (`sample.d.ts`), `src:'ai'`/`'job'`, mit Beispielsatz.
  - „Kenne ich schon" **ohne Selbstbewertung**: eine Probeabfrage (freier Abruf, Stufe 4). Richtig → Stufe 4, fällig in 30 Tagen. Falsch → bleibt.
- **M3 – Merkhilfe für hartnäckige Wörter** · **Phase 2, Trainer-Umbau** + Wortblatt (M1).
  - Knopf „Merkhilfe" am Chip „hartnäckig" (`lapses ≥ 4`), nur nach dem Prüfen.
  - `sample.json`, `quick`, einmal erzeugt und an der Karte gespeichert (neues Feld `mnemo {text, lang, t}`, `nullish`; data-guard).
- **M4 – Einspruch „Ich lag richtig"** · **Phase 2, Trainer-Umbau** und Paket C (Grammatik).
  - Nur bei rot und nur bei getippten Antworten.
  - Die Antwort zählt dann als richtig mit höchstens „Gut", im Log `override:true`. Bei Grammatik kein Fehlereintrag.
  - Kein Bewertungsknopf, sondern eine Korrektur des Prüfers (A7 bleibt erfüllt). learning-scientist prüft.
- **M6 – Automatisch weiter nach richtiger Antwort** · **Phase 2, Trainer-Umbau** (Trainer, Grammatik, Übungen) + **Phase 6, Paket F** (Schalter).
  - Nach grün ohne Hilfe nach etwa 1,2 s weiter, mit sichtbarem Ablaufbalken am Knopf „Weiter". Ein Tipp hält an.
  - Feld `profile.autoNext` (besteht schon, Standard an wie in der alten App). Reduzierte Bewegung: Balken ohne Animation.
- **M13 – Eine Navigationskarte für die ganze App** · **Phase 2, S0b** (`app/nav.ts`, `modules.ts`), gilt für Phase 3–5.
  - Reiter: Heute · Lernen (Kurs, Wortschatz, Grammatik, Übungen, Lesen, Hören, Schreiben) · Sprechen (Rollenspiel, Business) · Entdecken · Dein Stand. Preply und Claude im Kopf.
  - Zahl der offenen Pflichtpunkte am Reiter Heute. Ladepunkt, solange eine KI-Korrektur läuft (M14).
  - Bildlaufposition je Liste merken.
- **M14 – KI-Korrekturen laufen beim Bildschirmwechsel weiter** · **Phase 4, P3/P6** (Schreiben, Lesezusammenfassung, Anwenden).
  - `writing-review@1` als App-Aufgabe wie die Einschätzung (phase6 E7): Abbruch nur per Stopp oder `pagehide`.
  - Ergebnis wird gespeichert, Hinweis „Korrektur fertig · Ansehen". A6.2 gilt weiter für Übungen.

### Mittel

- **M5 – „Einmal richtig schreiben"** · **Phase 2, Trainer-Umbau** + Paket C.
  - Nach rot bei getippten Antworten optional ein Abschreibfeld mit der Lösung. Zählt nicht als Antwort, ändert keine Note.
- **M7 – Wochenstreifen und Niveau-Leiste** · **Phase 6, Paket D** (Kopfzeile von „Dein Stand", E18).
  - Mo–So als 7 Ringe: Pflicht erledigt / Ruhetag / offen / Zukunft. Mit Text, nie nur Farbe. Auf Heute bleibt nur die Serienzeile (Kap. 2.1).
  - Urteil-Reiter: Skala B1 · B1+ · B2 · B2+ · C1 · C1+ mit Punkt für Claudes Stufe und hellem Band für die Belastbarkeit. Keine Punktzahl.
- **M8 – Nachschlagewerk „Wissen"** · **Phase 2, Paket C**.
  - Suche über alle 16 Regelblätter (Name, Signalwörter, Formen, Beispiele), zweisprachig.
  - Übersicht „Deutsch → Englisch: typische Fallen" aus `rules.json` (`contrast`, `traps`), jede mit Beispiel und Sprung zum Thema.
- **M9 – Freie Runde mit Auswahl** · **Phase 2, Trainer-Umbau** (Extra-Runde).
  - Nach erledigter Pflicht wählbar: Schwierige Wörter · Beruf · Nur Wendungen · Alle, Größe 10/20/30.
  - Nur im Extra-Bereich (Kap. 2.6).
- **M10 – Wochen-Check und Sichtbarkeit alter Daten** · **Phase 6, Paket B/D**.
  - Freiwilliger Wochen-Check: 12 gemischte Aufgaben ohne Tipps. Ergebnis als Status gegen den letzten Check.
  - Schreibt weiter `profile.checks[]` (≤ 20, Altformat) und ist Beleg für die Einschätzung (`evidence.ts`).
  - Im Verlauf lesbar: alte `checks[]` und `feed[]` (Kap. 14).
- **M11 – „Weiter mit dem nächsten Pflichtschritt"** · **Phase 2, Paket E2**.
  - Primärknopf jeder Pflicht-Zusammenfassung: „Weiter: {nächster offener Pflichtpunkt}". Ist alles erledigt, „Zurück zu Heute".
  - Schmale Planleiste in Pflichtrunden („Pflicht 2 von 3").
- **M12 – Lesen, Hören, Schreiben: Wahlmöglichkeiten** · **Phase 4, P4/P5/P6**.
  - Lesen: Themen-Chips beim Erzeugen (Überrasch mich · Business · Tech & KI · Fußball · Reisen · Wissenschaft · Film) → `topicHint`. „Alle Wendungen als Karten" (nur mit Ursprungssatz).
  - Hören: Shadowing-Modus mit automatischer Pause nach jedem Satz („Jetzt du") und ohne Wertung.
  - Schreiben: „Eigenes Thema" (Freitext ≤ 120 → `writing-prompt@1` mit Thema). Wendungs-Chips fügen sich per Tipp an der Schreibmarke ein.
- **M15 – Wendungen „aus der Situation heraus"** · **Phase 3, Paket B** (`chunkCards`) bzw. INT in `srs/modes.ts`.
  - Neue Abfrageart für Chunks mit `src.scene` (Stufe 4/5): Szene und Absicht („Du willst sagen: …") → Wendung frei tippen.
  - Dazu „Damals hattest du gesagt: …" als Beispiel nach dem Prüfen.

### Niedrig

- **M16 – Eigenen Text als Lese-Einheit** · **Phase 4, P4** (+ Beschluss mit data-guard).
  - Eingefügten Text (≤ 8.000 Zeichen) als `articles/ai<ms>` mit `src:'own'` speichern, **nicht** in `feed/*`. Glossar und Fragen erzeugt `reading-text@1` im Modus „aus Text" auf Klick.
- **M17 – Meilenstein je Einheit** · **Phase 2, Paket B2** (Kursliste).
  - Sind alle 4 Lektionen erledigt, wird die Einheit zum Zustand „Meilenstein · Kann jetzt: {Can-Do}" (Kap. 7), ohne Knopf und ohne Feuerwerk.
- **M18 – „Als Preply-Stunde" von überall** · **Phase 5, Paket F** (Anbindungen) + E.
  - Kleiner Knopf im Menü von Artikel, Text, Grammatikthema, Szene und Bericht. Öffnet Preply-Vorbereiten mit dem Anlass-Chip „Zu: {Titel}" (aus `useCompanionSee`).
- **M19 – Begleiter: Tiefe und Aktionen** · **Phase 5, Paket A/C**.
  - Umschalter „Schnell · Gründlich" (`quick`/`default`), Standard Gründlich.
  - Aktions-Chips ohne `tools`, lokal aus dem Kontext: „Übung dazu starten", „Bildschirm öffnen".
  - Englische Begriffe der Antwort über Wort-Antippen als Karte speicherbar (mit dem Antwortsatz als Ursprungssatz).
  - Eigener Text als Lese-Einheit über M16.
- **M20 – Einmaliger Hinweis „Was ist neu"** · **Phase 7, P7-5**.
  - Nach dem Umzug ein Blatt mit 3 Zeilen (wo Wortschatz, Wissen und Preply jetzt liegen). Merker in `localStorage`.
- **M21 – Farbthemen** · **Phase 6, Paket F**, Prüfung in **Phase 7, P7-2**.
  - Vier Akzentvarianten zu Salbei/Ozean/Pflaume/Graphit als Token-Sätze, je in Dunkel/Gedämpft/Hell mit Kontrasttest.
  - Wert aus `profile.theme.p` lesen und schreiben, altes Format bleibt.
- **M22 – Beruflicher Kontext einstellbar** · **Phase 6, Paket F** (Feld) + Vorlagen aus Phase 3/4/5 (`prompts/work.ts` liest `profile.ctx`, Konstante nur als Rückfall).
  - Textfeld ≤ 400 Zeichen in den Einstellungen.

### Bewusst nicht übernommen (keine Ergänzung)

- XP-Anzeige, Level-Punkte, Combo, Rekord, Veränderungs-Chips (Kap. 2.3, Kap. 7).
- Selbstbewertung Nochmal/Schwer/Gut/Leicht (A7).
- Automatische Vorab-Erzeugung im Hintergrund (`sample.d.ts`).
- Einschätzung und Fokus-Karte auf Heute (Kap. 2.1).
- Einführungstour für neue Nutzer (ersetzt durch M20).
