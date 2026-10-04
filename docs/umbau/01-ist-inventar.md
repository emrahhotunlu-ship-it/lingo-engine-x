# 01 · Ist-Inventar der App (Stand 31a5975, 04.10.2026)

Zweck: Bestandsaufnahme für den Umbau auf „nur Vokabeln und Grammatik“. Maßstab: Wortschatz, Grammatik, Satzbau, Fehler korrigieren, Übersetzer, Claude fragen, Einstellungen, Fortschritt nur dafür; Sprechen nur als freiwilliges Extra.
Methode: nur gelesen (Quelltext, Texte), nichts gebaut, getestet oder geändert. Belege als `Datei:Zeile`; Textzeilen stammen aus `src/i18n/parts/*.de.ts` bzw. `src/i18n/de.ts`. „Vermutung“ = aus dem Code gelesen, nicht im Lauf geprüft. Zahlen zu Texten und Zeilen sind maschinell gezählt (Skript, nur Näherung).

Legende Weg (Tipps ab dem Reiter „Heute“): H = Reiter Heute · W = Wortschatz · G = Grammatik · F = Fortschritt · P = Profil-Knopf oben links (Profil-Blatt) · Z = Zahnrad · C = Claude-Symbol · Ü = Übersetzer-Symbol.
Legende Daten: `p` = app/profile · `c` = app/course · `as` = app/assess · `rd` = app/radar · `po` = app/pool · `ch` = app/chat · `lk` = app/lookup · `sc` = app/schema · `wk` = app/week · `rp` = app/repair · `pt` = app/patterns · `dk` = app/decks · `mem` = app/memory · `cmp` = app/compare · `lv` = app/levels · `wl` = app/weekly · `v` = vocab/* · `ck` = chunk/* · `g` = grammar/* · `ls` = lesson/* · `lg` = log/<Tag> · `dy` = daily/* · `ar` = archive/* · `out` = out/* · `th` = teacher/* · L = liest · S = schreibt.

---

## 0. Zahlen auf einen Blick

| Was | Zahl |
|---|---|
| Reiter unten | 4: Heute · Wortschatz · Grammatik · Fortschritt (`src/app/shell/tabs.ts:37-42`); dazu im Kopf 4 Knöpfe: Profil mit „Serie n“, Übersetzen, Claude, Zahnrad (`TopBar.tsx:41-52`) |
| Routen (Bildschirme) | 50 = 4 Reiter-Wurzeln + 16 Seiten + 30 Übungen |
| Urteil über die 50 Routen | 13 BEHALTEN · 12 VEREINFACHEN · 2 ZUSAMMENLEGEN · 22 AUSBLENDEN · 1 STREICHEN |
| Von „Heute“ aus direkt erreichbare entfallene Bereiche | 1 Zeile „Sprechen üben (freiwillig)“ (`TodayScreen.tsx:463-475`) öffnet den ganzen alten Sprechen-Bereich (Gespräche + Schreiben, 22 feste Einstiege plus Szenenkarten); außerdem „Üben“-Knöpfe im Urteil (`actionRoute.ts:26-29`). Lesen, Hören und Entdecken haben keinen sichtbaren Einstieg mehr (Reiter entfernt), der Code hängt aber noch; die Schreibaufgabe steht noch unter „Sprechen üben“ › Segment „Schreiben“ (`areas/lesen.tsx:58-59`). |
| Blockarten der Tageseinheit im Code | 17; im aktuellen Plan nur 5 (Wiederholen, Grammatik, Satzbau, Fehler korrigieren; sonntags nur Wiederholen + Wochen-Check) |
| Einstellungen | 21 Bedienelemente/Abschnitte in 6 Gruppen |
| „Dein Stand“ | 31 Bausteine: 8 fokus-sauber · 14 gemischt · 4 entfallen · 5 neutral/Doppelung |
| Can-Do-Liste (Ziel C1) | 40 Punkte (B2 16, C1 24) in 8 Gruppen à 5; nur 10 (Wortschatz, Grammatik) passen zum Fokus |
| Vokabel-Abfragearten | 14 (+ „Aufdecken“) über 5 Stufen (`src/domain/srs/modes.ts:12-29`) |
| Stapel im Wortschatz | 13 eingebaute (`VocabHub.tsx:35-49`) + eigene |
| Grammatik | 16 B2-Themen + 7 C1-Werkzeuge; 25 Deutsch-Fallen; Satzbau-Pool 57 Sätze (7 Themen) |
| Wochenthemen | 16: 11 „Beruf“ (Vertrieb/Business), 1 „Beruf & Alltag“, 4 „Alltag“ (`src/content/nb/themes.ts`) |
| Kurs | 24 Lektionen in 6 Einheiten (+ von Claude erweiterte ab l25) |
| Deutsche Texte in i18n | 3.018; davon 836 nur von entfallenen Bereichen benutzt, 162 von keinem Code benutzt, ~345 nur über dynamische Schlüssel erreichbar (ungeprüft) |
| Code der entfallenen Bereiche | 14 Feature-Ordner = 17.153 von 42.533 Zeilen in `src/features` (40 %), dazu ≈ 3.400 Zeilen `src/domain`, ≈ 3.300 Zeilen `src/prompts`, 4 große JSON-Inhalte in `src/content/nb` (texts, inbox, objections, scenes ≈ 115 kB) + `legacy/passages|feed-seed|scenes.json` (≈ 130 kB) |
| Tests zu entfallenen Bereichen (nach Dateinamen geschätzt) | E2E: ≈ 12 klar + 4 gemischt von 76 Specs; Unit: ≈ 23 von 155 Dateien |

---

## 1. Rahmen: Reiter, Kopf, Leisten, Zustände

| Element | Anzeigename · Beleg | Zweck | Urteil – Grund |
|---|---|---|---|
| Reiterleiste | Heute · Wortschatz · Grammatik · Fortschritt (`nbSh.de.ts:5,6,9,10`); „Lesen“, „Sprechen“ als Texte noch da (`nbSh.de.ts:7,8`) | Hauptnavigation, Abzeichen „n offen“ nur an Heute | VEREINFACHEN – Reiter „Grammatik“ heißt auf der Seite „Üben“ (§8 Nr. 1); Seitentitel von „Fortschritt“ ist „Dein Stand“ |
| Kopf auf jeder Reiter-Wurzel | Profil-Knopf (Initiale + „Serie n“), Übersetzen, Claude, Zahnrad (`TopBar.tsx`, `Chrome.tsx`) | Übersetzer/Claude/Einstellungen überall mit einem Tipp (Emrahs Vorgabe) | BEHALTEN – Vorgabe; Claude/Übersetzer verschwinden ohne KI |
| Übungsleiste (jede Übung) | ✕, „n von m“, „Pflicht n von m“ · „Extra“ · „Tageseinheit · Block n von 4“, Übersetzen, Claude, Zahnrad (`learn/ui.tsx:117-168`) | gemeinsamer Rahmen aller Übungen | BEHALTEN |
| Zeile „Weitermachen: …“ | auf Heute und am Herkunftsplatz (`ResumeRow.tsx`) | Fortsetzen nach Neuladen | BEHALTEN |
| Schwebende Zeile „Korrektur läuft/fertig · Ansehen“ + Ladepunkt am Reiter | `AiTaskNotice.tsx`, `TabBar.tsx:56-62` | nur für KI-Korrekturen von Schreiben/Lesen/Entdecken | STREICHEN – gehört zu entfallenen Bereichen; Rahmen importiert aus `features/input` (§10) |
| „Was ist neu“ | `system/WhatsNew.tsx` (57 Z.) – nirgends eingebunden | Update-Hinweis | STREICHEN – tot |
| Systemzustände | Laden · Keine Datenbank · Verbindung unterbrochen · Umstellung · „Aus diesem Browser nachtragen“ | Sicherheitsnetz | BEHALTEN |

### Bausteine der vier Reiter-Wurzeln

| Reiter | Baustein (wie Emrah ihn sieht) | Urteil – Grund |
|---|---|---|
| Heute | Datum · „Serie: n Tage“ | BEHALTEN |
| Heute | Zeile „Wochenthema: …“ (antippbar → Deine Woche; `TodayScreen.tsx:208-218`) | VEREINFACHEN – ist ein Business-Szenario („CFO: Preis, ROI …“), das mit keinem der 4 Blöcke mehr zu tun hat |
| Heute | Tageskarte „Deine Tageseinheit“: Titel (= Wochenthema, `:578`), Ring „x von y · noch ca. n Min.“, Blockliste (Name, Grund, Min., Häkchen), 1 Knopf „Starten/Weiter: …“ | BEHALTEN – die rote Linie; Titel ändern |
| Heute | Fertig-Karte + „Lohnt sich jetzt“ (1 Zeile; kann auch „Diktat“ vorschlagen, `:75-101`) + „Mehr üben ›“ (nur nach Fertig, `:431`) | VEREINFACHEN – Vorschläge auf Wortschatz/Grammatik begrenzen |
| Heute | „Sprechen üben (freiwillig)“ (`:463-475`) | VEREINFACHEN – nur auf das gewählte Sprechen-Extra zeigen |
| Heute | Ruhige Zeilen: „Wochen-Check der letzten Woche nachholen“ (Mo), „Dein Wochenbericht ist da“ (Mo), „Aus diesem Browser nachtragen“, „Noch nicht alles gespeichert“, „Plan nur auf diesem Gerät gespeichert“, „Heute gilt noch der Plan von vorhin“, Handy-Hinweis (`:447-457`) | BEHALTEN bis auf den Handy-Hinweis (nur alte Pläne) |
| Wortschatz | Titel + „Hinzufügen“ · Suche (≤ 8 Treffer) | BEHALTEN |
| Wortschatz | Hero „Alle fälligen“: Neu · Lernen · Fällig, „ca. n Min.“, Hinweiszeilen (Rückstand, Bremse, Aufholmodus, „Der Knopf startet die Pflicht von heute …“), Modus (Automatisch/Aufdecken/Tippen), Knopf „Wiederholen“ (`VocabHub.tsx:160-216`) | VEREINFACHEN – bis zu 4 Hinweiszeilen, Knopf ändert still seine Bedeutung (Pflicht oder freie Runde) |
| Wortschatz | „Die nächsten 7 Tage“ (Balken) | BEHALTEN |
| Wortschatz | Stapel: Eingangskorb + eingebaute (nur nicht leere) + eigene + „Neuer Stapel“ (`:235-258`) | VEREINFACHEN – 13 eingebaute Stapel, davon mehrere inhaltlich doppelt (Schwierig/Hartnäckig/Fehler der Woche) |
| Wortschatz | „Zuletzt hinzugefügt“ (5) + „Alle n Einträge“ (`:260-273`) | BEHALTEN |
| Wortschatz | „Mehr üben ›“ → Blatt „Extra-Runde“ (`:274-278`) | ZUSAMMENLEGEN – zweites „Mehr üben“ (§8 Nr. 2) |
| Grammatik („Üben“) | „Dein Weg“: Zeile „Deine Woche“ + Kurs-Karte (nächste Lektion, „Alle Lektionen“) (`LearnHub.tsx:181-204`) | VEREINFACHEN |
| Grammatik („Üben“) | „Aus deinen Fehlern“: „Grammatik-Fehler (n fällig)“ + „Reparatur-Sätze: x offen · y sicher“ (nicht antippbar, `:217-223`) (`:207-226`) | VEREINFACHEN |
| Grammatik („Üben“) | „Grammatik & Fallen“: Grammatik · Deutsch-Fallen · Nachschlagen (`:229-236`) | BEHALTEN (Nachschlagen zusammenlegen) |
| Grammatik („Üben“) | „Training“: 4 Kacheln (Lückenjagd, Satzbau, Diktat, Sprint; `:40-45`) + 6 Tipp-Drills + „Lehrer-Feedback einfügen“ (`:239-264`) | VEREINFACHEN – gemischt aus Wortschatz, Grammatik, Hören, Lehrer-Feedback |
| Fortschritt („Dein Stand“) | Kopfkarte + 5 innere Reiter | VEREINFACHEN – §6 |

---

## 2. Routen und Übungen (50)

### 2.1 Heute (5)

| Anzeigename | Route | Weg | Zweck | Daten | Urteil – Grund |
|---|---|---|---|---|---|
| Heute | `today` (Reiter) | Start | Tageskarte, Ring, Blockliste, 1 Knopf; danach Fertig-Karte | L p, sc, wk, c, as, rp, lg, v, g, ck, ar, dy · S p (plan, pflicht, act), sc (pflichtSince), wk, lg, v (neue Karten aus daily), po | VEREINFACHEN – Kern bleibt; Wochenthema-Kopf, „Sprechen üben“, Handy-Hinweis ändern |
| Deine Woche | `week` | H › Zeile „Wochenthema“ (1) · G › Dein Weg (2) | Thema, „Kernaufgabe“ (`WeekPage.tsx:42` zeigt `th.task`, z. B. „Einen Preiseinwand entkräften …“), 5 Wendungen, Ziele (Werkzeug, Falle, Zählziele), Wochenplan Mo–So, „Thema ändern“ (16 Themen) | L wk, p.goalMin · S wk | VEREINFACHEN – als „Wochenfokus“ nur Wendungen, Grammatik-Werkzeug, Falle; Kernaufgabe und Themenliste raus |
| Tageseinheit-Karte | `unitCard` (confirm, next) | H › Starten (1) | Bestätigung des Wochenthemas am ersten Lerntag der Woche; Zwischenkarte „✓ geschafft – Als Nächstes“; Ende mit Bilanz | L wk · S wk | VEREINFACHEN – Bestätigung (16 Business-Themen, `UnitCard.tsx:34-92`) streichen; Zwischenkarte und Ende behalten |
| Ersatzschritte | `unitStep` (input, again, check) | nur als Rückfall | Lesetext mit Kundenmail, „Nochmal schreiben“, leerer Wochen-Check | S p.act | VEREINFACHEN – `input`/`again` praktisch tot (nur wenn ein Anbieter eines alten Plans scheitert), `check`-Hinweis behalten |
| Wochen-Check | `check` | H › Sonntag-Block (1) · P › Tests › Wochen-Check › Check starten (3) · Montag-Zeile | 12 gemischte Aufgaben ohne Tipps (Wörter, Wendungen, Grammatik), Ergebnis gegen letzten Check | L v, ck, g, p.checks · S p (checks, act, Zähler), v, g | BEHALTEN – passt zum Fokus; Aussage „Extra/freiwillig“ vs. Sonntag-Pflicht klären (§8 Nr. 5) |

### 2.2 Wortschatz (6)

| Anzeigename | Route | Weg | Zweck | Daten | Urteil – Grund |
|---|---|---|---|---|---|
| Wortschatz | `vocab` (Reiter) | 1 | siehe §1 | L v, ck, dk, p, wk · S dk | BEHALTEN – Kern |
| Alle Einträge | `vocabList` | W › „Alle n Einträge“ (2) | Liste, Suche, 10 Filter-Chips, Sortierung, Auswählen (Ausblenden, zu Stapel) | L v, ck, dk · S v.hidden, dk | BEHALTEN |
| Stapel | `deck` | W › Stapelzeile (2) | Zähler, Modus (Aufdecken/Tippen/Hören), Richtung, Größe, „Lernen“, Umbenennen/Ausblenden, Kartenliste | L v, ck, dk · S dk | VEREINFACHEN – Modus-Liste weicht von Hub und Einstellungen ab (§8 Nr. 13) |
| Vokabeltrainer | `trainer` | H › Starten (1) · W › Wiederholen (2) | Anki-artig: Aufdecken + 4 Knöpfe oder Tippen; Note automatisch; 14 Abfragearten; Beispiele, Wort-Antippen, Rückgängig | L v, ck, dk, rp, p, lg · S v, ck (FSRS, Verlauf), lg, p (Zähler, Pflicht, ema), rd, rp | BEHALTEN – Kern |
| Hörschleife | `listenLoop` | W › Mehr üben › Hörschleife (3) | 10 Sätze hören und nachsprechen, ohne Wertung | L v · S – | AUSBLENDEN – Hören/Sprechen, zählt nicht als Wiederholung (`nbWs.de.ts:218-221`) |
| Lehrer-Feedback einfügen | `teacherFeedback` | G › Training (2) · W › Hinzufügen › Lehrer-Feedback (3) | Lehrer-Notizen → Kartenvorschläge (Wortschatz), Korrekturen (Reparatur-Sätze), Übung | S th, v, ck, rp | BEHALTEN – einzige Quelle für Reparatur-Sätze neben Deutsch-Fallen; Einstieg doppelt (§8 Nr. 19) |

### 2.3 Grammatik / „Üben“ (11)

| Anzeigename | Route | Weg | Zweck | Daten | Urteil – Grund |
|---|---|---|---|---|---|
| Grammatik (Seitentitel „Üben“) | `learn` (Reiter) | 1 | siehe §1 | L c, as, g, rp, v, ls | VEREINFACHEN – Name, Inhalt und Training neu ordnen |
| Dein Kurs | `course` | G › Kurs-Karte › „Alle Lektionen“ (2) | 24 Lektionen/6 Einheiten (+ l25+), Meilensteine „Kann jetzt: …“ | L c, as, ls | VEREINFACHEN – siehe Lektion |
| Lektion | `lesson` | G › „Nächste Lektion öffnen“ (2) | 4 Schritte, ca. 12 Min.: Wörter · Dialog · Grammatik · Anwenden (`learn.de.ts:58-61,64`) | L c, ls, v, g, as · S c.done, ls (Claude-Inhalt), writing (Text aus „Anwenden“, `LessonSteps.tsx:437-444`), v, g, p, rd | VEREINFACHEN – Dialog (Hören/Lesen) und Anwenden (Text schreiben) raus; Wörter + Grammatik bleiben |
| Grammatik | `grammar` | G › Grammatik & Fallen › Grammatik (2) | Themen nach Sicherheit (B2 / C1-Werkzeugkasten), Regelblatt, „Freie Runde · 8 Aufgaben“, „Deine Fehler · n fällig“, Regelsuche | L g, ls, po, dy | BEHALTEN – Kern |
| Grammatikrunde | `grammarSession` | H › Block „Grammatik“ (1) · Grammatik-Seite › Freie Runde (3) · Fortschritt › „Üben“ | Auswahl · Lücke · Umformen · Verbessern; bei Fehler Hinweis, zweiter Versuch, Lösung mit Grund | L g, po, dy, ls, as, p · S g, lg, p, rd, po | BEHALTEN – Kern |
| Nachschlagen | `wissen` | G › Nachschlagen (2) | Regelsuche + 25 Deutsch→Englisch-Fallen | – | ZUSAMMENLEGEN – Suchfeld und Fallen-Link stehen schon auf „Grammatik“ (`GrammarScreen.tsx:109-116`) |
| Deine Deutsch-Fallen | `patterns` | G › Deutsch-Fallen (2) · F › Fehler › Karte | eigene Muster (Claude), 25 Startfallen, Kurzdrill, Wochenfokus | L rd, rp, pt, g; Fehlerquellen auch talk, say, writing, preply · S pt, rp, rd | BEHALTEN – Fehlerquellen auf Fokus beschränken; ✕ führt falsch in „Fortschritt“ (§8 Nr. 17) |
| Lückenjagd · Satzbau · Diktat · Sprint | `drill` | G › Training-Kachel (2); Satzbau auch H › Block 3 | Wortpartner im Satz · Satz aus Bausteinen mit deutscher Bedeutung vorab · Satz hören und schreiben · 90 s Sprint | L v, g, ck · S lg, p (+ sprints), rd | VEREINFACHEN – Satzbau, Lückenjagd, Sprint bleiben; Diktat = Hören → ausblenden (Entscheidung) |
| Tipp-Drills (6) | `nbdrill` | G › Training-Zeile (2) | Kollokationen · Satz-Umformung · Wortbildung · Register-Leiter · Phrasal Verbs · Überleitungen | L content/nb · S out | ZUSAMMENLEGEN – Inhalt passt zu Vokabeln/Grammatik; Einstieg bündeln; „Mail ↔ Call“-Texte neutralisieren |
| Fokus (alter Block 4) | `unitFocus` | – | Block 4 „Fokus“ | – | STREICHEN – kein Plan enthält ihn mehr (`week/plan.ts` kennt nur review, grammar, task.order, again, task.check) |
| Fehler korrigieren | `unitAgain` | H › Block „Fehler korrigieren“ (1) | alte falsche Sätze neu schreiben, beide Fassungen nebeneinander, Reparatur-Box 1/3/9 Tage | L rp · S rp | BEHALTEN – aber Speisung und Doppelung klären (§8 Nr. 7) |

### 2.4 Fortschritt und Profil (6)

| Anzeigename | Route | Weg | Zweck | Daten | Urteil – Grund |
|---|---|---|---|---|---|
| Fortschritt (Seitentitel „Dein Stand“) | `overview` (Reiter) | 1 | Kopfkarte + 5 innere Reiter | siehe §6 | VEREINFACHEN – §6 |
| Wochen-Check (Seite) | `checks` | P › Tests › Wochen-Check (2) | Start + bisherige Checks | L p.checks | BEHALTEN |
| Wochenbericht | `weekly` | P › Wochenbericht (2) · Montag: H › „Ansehen“ (1) | Fakten der Vorwoche + Claude-Text | L p, v, g, writing, talk, wprompt, wl · S wl | VEREINFACHEN – Fakten „Text geschrieben“/„Gespräch geführt“ raus (`progress.de.ts:148,150`) |
| Wortschatztest | `vtest` | P › Tests › Wortschatztest (2) | 3 Teile (Kennst du das Wort? · Bedeutung · Schreib es), ca. 8 Min.; schätzt passiven/aktiven Wortschatz | S p.vtests | BEHALTEN – Messwert für das 8.000-Ziel; zusätzlich im Wortschatz-Reiter anbieten |
| Übung von Claude | `claudeDrill` | C › Antwort › „Mach mir eine Übung dazu“ | 5 Lückensätze zum Thema | – | BEHALTEN |
| Monatsvergleich | `compare` | F › Verlauf › Karte › Starten (3) | gleiche Sprech- (45 s) und Schreibaufgabe (Mail) jeden Monat | L/S cmp | AUSBLENDEN – Sprechen + Schreiben + Mail (`nbProfil.de.ts:101-122`); Heute-Zeile `TodayCompareRow` ist nicht eingebunden |

### 2.5 Entfallende Bereiche (22 Routen in drei Gruppen; `listenLoop`, `compare` und `unitFocus` stehen oben bei ihrem Bereich)

| Gruppe | Routen · Anzeigename | Weg heute | Daten (bleiben, nie löschen) | Urteil |
|---|---|---|---|---|
| Lesen · Hören · Entdecken · Schreiben (9) | `library` „Lesen“, `discover` „Entdecken“, `history` „Verlauf“ je Kanal, `read`, `listen`, `write`, `discoverItem`, `inputUnit`, `listenDialog` („Meeting hören“) | `library`, `read`, `listen`, `discover`, `discoverItem`, `inputUnit`, `listenDialog`: kein sichtbarer Einstieg (nur Deep-Link oder „Weitermachen“-Zeile aus altem Speicher, Vermutung); `write` und `history` (Schreiben): H › „Sprechen üben“ › Segment „Schreiben“ › Schreibaufgabe / Verlauf Schreiben (3 bis 4) | feed, writing, articles, reading, lpool, wprompt, p.disc, p.gen, p.listen | AUSBLENDEN, danach Code entfernen |
| Sprechen (10) | `speak` „Sprechen“ (Gespräche · Schreiben), `meeting` „Mein nächster Termin“, `playbook` „Verhandlungs-Baukasten“, `roleplay`, `mail` „E-Mail verbessern“, `pitch` „Präsentations-Coach“, `say` „Sag es“, `fluency` „Flüssigkeit 90-60-45“, `tones` „Drei Tonlagen“, `sptask` (Pitch 30/60/120, Diagramm, Umschreiben, Rückübersetzung) | H › „Sprechen üben (freiwillig)“ (1), alles Weitere 2 bis 3 | scene, talk, biz, say, fluency, meeting, tones, p, rp, ck | `speak` VEREINFACHEN und `roleplay` BEHALTEN als einziges Extra (Annahme, Entscheidung offen); `meeting`, `playbook`, `mail`, `pitch`, `say`, `fluency`, `tones`, `sptask` AUSBLENDEN |
| Einwand · Posteingang · Aussprache (3) | `pressure` „Einwand-Training“ (+ „Heißer Stuhl“, „Zeit gewinnen“), `inbox` „Posteingang“, `pron` „Nachsprechen“ (+ Betonung, Zahlen) | im Sprechen-Bereich unter „Training“ | out, lv | AUSBLENDEN |

---

## 3. Tageseinheit: Blockarten (17)

Plan heute (`src/domain/week/plan.ts:72-104`, Tagesziel 25 Min.): Mo–Sa Wiederholen 8 · Grammatik 7 · Satzbau 5 · Fehler korrigieren 3. Tagesziel ≤ 20: ohne Satzbau; ≤ 10: 3/4/2 Min. Sonntag: Wiederholen 5 + Wochen-Check 5. Interne Blocknummern 1, 2, 3, 5 (4 fehlt).

| Art | Anzeigename | Im Plan? | Route | Urteil |
|---|---|---|---|---|
| review | Wiederholen | ja | `trainer` | BEHALTEN |
| grammar | Grammatik | ja | `grammarSession` | BEHALTEN |
| task.order | Satzbau | ja (nur > 20 Min.) | `drill` | BEHALTEN |
| again | Fehler korrigieren | ja | `unitAgain` | BEHALTEN (klären) |
| task.check | Wochen-Check | Sonntag | `check` | BEHALTEN |
| focus | Fokus | nein | `unitFocus` | STREICHEN |
| focus.colloc | Kollokationen | nur alte Handy-Pläne | `nbdrill` | Kind streichen, Übung bleibt im Training |
| input.read · input.listen | Input | nein | `inputUnit`, `unitStep` | AUSBLENDEN |
| pron.shadow | Nachsprechen | nein | `pron` | AUSBLENDEN |
| task.say · task.fluency · task.tones | Sag es · Flüssigkeit · Tonlagen | nein | `say`, `fluency`, `tones` | AUSBLENDEN |
| task.inbox · task.objection | Posteingang · Einwand-Training | nein (Einwand nur als Handy-Ersatz alter Pläne) | `inbox`, `pressure` | AUSBLENDEN |
| task.meeting · task.roleplay | Generalprobe · Rollenspiel | nein | `roleplay` | AUSBLENDEN |

---

## 4. Blätter und Überlagerungen

| Anzeigename | Kennung | Weg | Inhalt | Urteil – Grund |
|---|---|---|---|---|
| Profil | `profile` | P (1) | Kopf (Serie, Wochenstreifen, „Einschätzung von Claude“ in 1 Satz), Gruppe „Dein Stand“ (5 Zeilen), „Tests“ (Wochen-Check, Wortschatztest), „Wochenbericht“, „Aus diesem Browser nachtragen“, Zeile „Dein Stand ›“, Zeile „Einstellungen ›“ (`ProfileSections.tsx`, `SheetHost.tsx:40-58`) | VEREINFACHEN – 6 Wege zur selben Seite, die unten schon als Reiter steht (§8 Nr. 15) |
| Einstellungen | `settings` | Z (1) | §5 | VEREINFACHEN |
| Wort (Wortblatt) | `word` | W › Wort (2) · überall: Wort antippen › Karte | Stufe, nächste Wiederholung, Beispiele, Wortpartner, Bilanz je Abfrageart, Verlauf, Merkhilfe (Claude), Probe „Wie heißt das Wort?“, Aktionen (Jetzt üben, Kann ich sicher, Morgen wieder, Ausblenden, Von vorn), zu Stapel, bearbeiten, Messwerte (`WordSheet.tsx`) | BEHALTEN – „Ursprung: Gespräch/E-Mail/Präsentation/Baukasten“ (`trainer.de.ts:47-50`) nur bei Karten aus entfallenen Bereichen |
| Hinzufügen | `add` | W › Hinzufügen (2) | Eigenes Wort · Neue Wörter von Claude / Fachwörter für den Beruf · „Aus Text“ · Lehrer-Feedback | BEHALTEN |
| Extra-Runde | `x:extra` | W › Mehr üben › (2) | 5 Auswahlen (Heute vergessen, Morgen fällige vorziehen, Hartnäckige, Fehler der Woche, + neue Karten), Hörschleife, 3 Stapel-Chips + eigene (`Sheets.tsx:112-218`) | ZUSAMMENLEGEN – doppelt zu Stapelliste und Hero |
| Neuer Stapel | `x:deck-new` | W › Stapel › Neuer Stapel (3) | Name, Filter „Herkunft“ mit 9 Quellen (Nachgeschlagen, Lesen, Übersetzer, Preply, Lektion, Beruf, Claude, Eigene, Gespräche; `Sheets.tsx:38`), Art, „Nur schwierige“, Suchtext | VEREINFACHEN – 3 Quellen gehören zu entfallenen Bereichen |
| Regelblatt | lokal in `GrammarScreen.tsx:162-368` | G › Grammatik › Thema (3) | Regel, Formen, Signalwörter, Kontrast zum Deutschen, Fehler, „Dieses Thema üben · 8 Aufgaben“, „Neue Aufgaben zu …“ (Claude) | BEHALTEN |
| Nachschlage-Fenster | Überlagerung (`LookupPopover.tsx`) | überall: Wort antippen | Bedeutung im Satz, US-Lautschrift, Aussprache, „Als Karte speichern“, „Claude fragen“ | BEHALTEN |
| Claude + Übersetzer | Überlagerung (`CompanionOverlay.tsx`) | C / Ü (1) | Reiter „Fragen“ und „Übersetzen“ (Richtung, Ton, „In den Vokabeltrainer“) | BEHALTEN |
| Rollenspiel-Blätter | lokal in `SceneBriefing`, `SceneCreateSheet`, `RoleplayScreen` | im Sprechen-Bereich | Einweisung, „Neue Szene“ | AUSBLENDEN |
| Freie Runde (Blatt) | `FreeRoundSheet.tsx` (63 Z.) | nirgends eingebunden | – | STREICHEN – tot |

---

## 5. Einstellungen (21)

| Nr. | Gruppe › Einstellung (Anzeigename) | Wirkung · Speicherort | Urteil – Grund |
|---|---|---|---|
| 1 | Lernen › Neue Wörter pro Tag (0/2/5/10) | Kontingent neuer Karten; bei Rückstand weniger, mindestens 2 · `p.newPerDay` | BEHALTEN |
| 2 | Lernen › Tagesziel in Minuten (10 bis 40) | Plan: ≤ 20 Min. = ohne Satzbau; ≤ 10 Min. = noch kürzer · `p.goalMin` | BEHALTEN – Hinweistext nennt diese Wirkung nicht |
| 3 | Lernen › Automatisch weiter (An/Aus) | nach richtiger Antwort ohne Hilfe · `p.autoNext` | BEHALTEN |
| 4 | Lernen › „Am Handy kurze Aufgabe statt Sprechen und Schreiben“ (nur auf Handy sichtbar) | wirkt nur noch auf alte, eingefrorene Pläne; neue Pläne enthalten nichts mehr zu ersetzen (`phone.ts:23`, `heute.tsx:110`) · localStorage | STREICHEN – Einstellung ohne Wirkung |
| 5 | Wortschatz › Standard-Modus beim Wiederholen (Automatisch/Aufdecken/Tippen) | `dk.prefs.mode` | BEHALTEN |
| 6 | Wortschatz › Richtung in Stapeln (DE→EN/EN→DE/Gemischt) | nur Stapel-Runden; „Tageseinheit und Alle fälligen fragen immer Deutsch → Englisch“ (`nbWs.de.ts:205`) · `dk.prefs.dir` | VEREINFACHEN – begrenzte Wirkung, unklare Regel |
| 7 | Wortschatz › Knöpfe beim Aufdecken (4/2) | `dk.prefs.grades` | BEHALTEN |
| 8 | Stimme & Ton › Stimme (Liste, Probehören) | Aussprache im Trainer und Wort-Antippen · `p.voice` | BEHALTEN |
| 9 | Stimme & Ton › Tempo (Regler) | `p.rate` | BEHALTEN |
| 10 | Stimme & Ton › „Antworten im Rollenspiel vorlesen“ (`voice.de.ts:7`) | nur Rollenspiel · localStorage | STREICHEN, falls Rollenspiel nicht bleibt |
| 11 | Stimme & Ton › Töne bei richtig/falsch | `p.sound` | BEHALTEN |
| 12 | Stimme & Ton › Vibration | auf iPhone nur Hinweis „nicht verfügbar“ · `p.haptic` | AUSBLENDEN auf iOS |
| 13 | Mein Kontext › Beruflicher Kontext (Textfeld) | Claude-Prompts (Fachwörter, Beispielsätze); Hinweistext nennt „Lese- und Hörtexte, Schreibaufgaben und Rollenspiele“ (`stand.de.ts:79`) · `p.ctx` | BEHALTEN – Text kürzen |
| 14 | Mein Kontext › Claude merkt sich (Liste, einzeln löschbar) | `mem`; Text „aus deinen Gesprächen … im Gespräch auf Merken“ (`nbProfil.de.ts:95`) | BEHALTEN – Text anpassen |
| 15 | Darstellung › Sprache (Deutsch/English) | `p.lang` | BEHALTEN |
| 16 | Darstellung › Darstellung (Dunkel/Gedämpft/Hell/Automatisch) | `p.theme.m` | BEHALTEN |
| 17 | Darstellung › Farbthema (Salbei/Ozean/Pflaume/Graphit) | `p.theme.p` | VEREINFACHEN – optional |
| 18 | Daten › Alle Daten als JSON sichern | Sicherung (Datei) | BEHALTEN |
| 19 | Daten › Karten als CSV für Anki | Export | BEHALTEN |
| 20 | Daten › Quellen und Lizenzen | Text | BEHALTEN |
| 21 | Daten › Diagnose (Version, Fähigkeiten, Dokumente n von 5.000, Profilgröße, Chat, Datenversion, „Entdecken-Einträge“, Messwerte, Fehlerprotokoll) | Technik | VEREINFACHEN – Zeile „Entdecken-Einträge“ (`input.de.ts:232`) raus |

---

## 6. „Dein Stand“ / Fortschritt: jeder Baustein

Struktur: Reiter „Fortschritt“ (`nbSh.de.ts:10`) → Seite „Dein Stand“ (`de.ts:169`) → Kopfkarte → 5 innere Reiter Urteil · Fehler · Ziel C1 · Zahlen · Verlauf (`ProgressScreen.tsx:31-37,129-137`). Zusätzlich dieselben Inhalte im Profil-Blatt. Öffnen der Seite startet höchstens einmal je Tag eine Claude-Einschätzung (`ProgressScreen.tsx:88-90`); Öffnen von „Fehler“ einmal je Woche eine Erkennung der Deutsch-Fallen (`patterns/StandCard.tsx:27-29`).
Fokus: ✓ sauber · ~ gemischt · ✗ hängt an entfallenen Bereichen · – neutral.

| Nr. | Baustein (Anzeige) | Quelle der Zahl | Zeigt | Hängt an Lesen/Hören/Schreiben/Sprechen/Entdecken/Business/Preply? | Fokus | Urteil |
|---|---|---|---|---|---|---|
| 1 | Titel „Dein Stand“ (`ProgressScreen.tsx:110`) | – | – | Reiter heißt „Fortschritt“ | – | Namen vereinheitlichen |
| 2 | Kopfkarte „Kurs n von 24 Lektionen“ (`:116`) | `c.done`, Nenner `LESSONS.length` (`domain/overview.ts:121`) | fertige Lektionen | Lektion hat Dialog (Hören/Lesen) + Anwenden (Schreiben); Nenner ohne l25+ | ✗ | STREICHEN oder Kurs neu zuschneiden |
| 3 | Kopfkarte „Wortschatz N Karten“ (`:117`) | `v` + 40 Startwörter, ohne Wendungen (`domain/overview.ts:34-45,86-98`) | Zahl aktiver Karten | nein | ✓ | BEHALTEN – Zahl vereinheitlichen |
| 4 | Kopfkarte „Niveau B2+ laut Claude“ (`:118`) | `as.cefr` | Gesamtstufe | Claude urteilt über 6 Fertigkeiten (`prompts/assess.ts:221`), Belege u. a. Lesen, Hören, Sprechen, Preply (`domain/assessment/evidence.ts:57,59`) | ~ | VEREINFACHEN – nur Grammatik + Wortschatz |
| 5 | Niveau-Leiste B1 bis C1+ mit Band (`StandHeader.tsx:56-83`) | `as.dims` (Belastbarkeit) | Stufe + Unsicherheit | wie Nr. 4 | ~ | VEREINFACHEN |
| 6 | „Aus diesem Browser nachtragen“ | Browser-Kopien der alten App | Hinweis | nein | – | BEHALTEN (technisch) |
| 7 | Urteil: Gesamtstufe, Trend, Begründung, Entwicklung, „Vorschlag für heute“ (`JudgeTab.tsx:117-170`) | `as` | Claude-Urteil | alle 6 | ~ | VEREINFACHEN |
| 8 | Urteil: „Fertigkeiten“ ×6: Grammatik, Wortschatz, **Lesen, Hören, Schreiben, Sprechen** + Belastbarkeitspunkte (`:172-191`, `progress.de.ts:60-65`) | `as.dims` | Stufe je Fertigkeit | 4 von 6 | ~ (2 ✓, 4 ✗) | 4 Zeilen streichen |
| 9 | Urteil: „Fokus der nächsten Tage“ + „Üben“ (`:193-209`) | `as.focus.action` | Empfehlung | Aktionen dürfen Rollenspiel, E-Mail-Refiner, Verhandlungs-Baukasten, Präsentations-Coach sein (`actionRoute.ts:26-29`, `assessment/actions.ts:7`) | ~ | Aktionsliste auf Wortschatz/Grammatik begrenzen |
| 10 | Urteil: Stärken (2), „Was dich noch von C1 trennt“ (2 bis 3) mit „So geht es richtig“ und „Üben“ (`:211-272`) | `as` | freie Claude-Texte | kann Lesen/Sprechen nennen (Prompt verlangt je 2 und 2–3 ohne Fokusbegrenzung, `assess.ts:221`) | ~ | VEREINFACHEN (Vermutung zum Prompt) |
| 11 | Urteil: „Neu einschätzen“ / automatisch (`:81`) | – | Knopf | nein | – | BEHALTEN |
| 12 | Fehler: „Reparatur-Sätze: x offen, y sicher“ (`repair/StandLine.tsx`) | `rp` | Zahl | Sätze stammen aus Sag es, Gespräch, Schreiben, Preply, Flüssigkeit, Tonlagen (`domain/repair/repair.ts:18`) | ~ | BEHALTEN, Zufluss klären |
| 13 | Fehler: Karte „Deine Deutsch-Fallen“ (Top 3, Verlauf, Wochenfokus) | `pt`, `rp` | Fehlermuster | Erkennung „aus Gesprächen, Texten, Preply, Sag es und Übungen“ (`patterns.de.ts:7`) | ~ | BEHALTEN, Quellen kürzen |
| 14 | Fehler: Fehler-Radar 30 Tage, 14 Kategorien (Zeitformen … Rechtschreibung), Trend, Beispiele, „Üben“ (`ErrorsTab.tsx:51-104`) | `rd` | Fehlerzahl je Kategorie | Quellenzeile „Aus: Grammatik · Schreiben · Lesen · Wörter · Sprint · Rollenspiel · Business“ (`:28,67-71`, `progress.de.ts:91-97`) | ~ | Kategorien BEHALTEN, Quellenzeile kürzen |
| 15 | Ziel C1: Wortschatzziel „8.000 Wörter · jetzt etwa X · in rund n Wochen“ (`PathTab.tsx:121-130`) | `p.vtests` + gefestigte Karten seit Test (`domain/vocab/goal.ts`) | Fortschritt zum 8.000-Ziel | nein | ✓ | BEHALTEN – zentral, aber nur hier sichtbar |
| 16 | Ziel C1: „Was laut Claude noch zu C1 fehlt“ (`:133`) | `as.c1gap` | Liste | alle Fertigkeiten | ~ | VEREINFACHEN |
| 17 | Ziel C1: Can-Do-Liste, 40 Punkte, 8 Gruppen: Hören 5, Lesen 5, Sprechen 5, Schreiben 5, Flüssigkeit 5, Register & Stil 5, Wortschatz 5, Grammatik 5 (`:146-190`, `src/content/legacy/cefr.json`) | Belege aus `writing/*` (`:45`), Hörergebnissen (`:66`), Claude-Sprechstufe (`:60`), Wortschatztest, Grammatik; Selbstmarkierung `p.canDo` | Status je Punkt, C1 erst mit 2 Belegen | 30 von 40 | ✗ | auf 10 Punkte (Wortschatz, Grammatik) kürzen |
| 18 | Zahlen: Heatmap „Aktivität · letzte 26 Wochen“ (`StatsTab.tsx:71-76`) | `p.minutes` (alle Übungen) | Minuten je Tag | nein (neutral) | ✓ | BEHALTEN |
| 19 | Zahlen: „Wortschatz-Statistik“: Erinnerungsquote 30 Tage, Median-Stabilität, Aktiv fest (dazu n in Übung), Erwartet gekonnt, Sichere Einträge, Gefestigt + Zustände Neu/Lernen/Jung/Gefestigt (`vocab/hub/Sections.tsx:72-114`) | `v` + `ck` (FSRS) | Kartenstand | nein | ✓ | BEHALTEN, 6+4 Zahlen auf 3 verdichten |
| 20 | Verlauf: Wochenzeile „Deutsch-Fallen“ (`HistoryTab.tsx:99`) | `pt` | Fallen seltener/häufiger | Erkennungsquellen wie Nr. 13 | ~ | BEHALTEN |
| 21 | Verlauf: Karte „Monatsvergleich“ (Sprechen 45 s + Schreiben Mail) (`:101`) | `cmp` | zwei Fassungen + Claude | Sprechen, Schreiben, Mail | ✗ | AUSBLENDEN |
| 22 | Verlauf: Diagramm „Verlauf der letzten 120 Tage“, 4 Linien Grammatik · Wörter erkennen · **Hören** · **Schreiben** (`:105-122`, `progress.de.ts:154,157-160`) | `p.history`: gr = Mittel der Themen, vo = ema.recog, li = ema.listen, wr = ema.write (`domain/progress/history.ts`, `profilePatch.ts:58-61`, `progress/persist.ts:222-227`) | Trefferquoten nach Antwortart | Beschriftung „Hören/Schreiben“, Daten aber Vokabel-Diktat und Übung „Diktat“ bzw. alle getippten Vokabel- und Grammatik-Antworten | ~ | umbenennen (Vokabeln erkennen · Vokabeln tippen · Grammatik), nicht Fertigkeiten nennen |
| 23 | Verlauf: „Einschätzungen und Meilensteine“ (`:126`) | `as.hist`, `c` | Stufenverlauf + Kurs-Einheiten | Meilensteine = Kurs | ~ | VEREINFACHEN |
| 24 | Verlauf: „Letzte Fortschritte aus der alten App“ mit Bereichsnamen Lesen, Hören, Schreiben, Sprechen, Entdecken, Preply (`ChecksCard.tsx:20-40,166-215`, `stand.de.ts:40-56`) | `p.feed` (nur alt) | Tabelle | ja | ✗ | Ansicht STREICHEN, Daten bleiben |
| 25 | Verlauf: „Messwerte dahinter“ (Grammatik je Thema: Beherrschung, letzte 10, fällig) (`:34-80`) | `g` | Themenstand | nein | ✓ | BEHALTEN |
| 26 | Profil-Blatt Kopf: Serie, Wochenstreifen (Pflicht · nur Extra · Ruhetag · offen), Urteil in 1 Satz | `p`, `sc`, `ar`, `as` | Serie | Urteilssatz wie Nr. 4 | ✓ | BEHALTEN |
| 27 | Profil-Blatt: 5 Zeilen „Urteil · Fehler · Ziel C1 · Zahlen · Verlauf“ + „Dein Stand ›“ | – | Sprung auf Seite 6 Wege | – | Doppelung | auf 0 bis 1 Weg kürzen |
| 28 | Profil-Blatt: Tests „Wochen-Check“, „Wortschatztest“ | `p.checks`, `p.vtests` | Einstieg | nein | ✓ | BEHALTEN |
| 29 | Wochenbericht (Seite) | `v`, `g`, `writing`, `talk`, `wprompt`, `p` | Wörter, Themen, Fehlersätze, „Text geschrieben“, „Gespräch geführt“, Zeit/Pflicht | 2 Faktenarten | ~ | VEREINFACHEN |
| 30 | „Aus diesem Browser nachtragen“ (Profil-Blatt) | Browser-Kopien | Hinweis | nein | – | BEHALTEN |
| 31 | Heute: Fertig-Bilanz „n Min. · x von y Blöcken · a Antworten, p % richtig“ (`nbHeute.de.ts:49`) | `lg`, Plan | Tagesbilanz | nein | ✓ | BEHALTEN |

---

## 7. Erwähnungen entfallener Bereiche in sichtbaren Texten und Bildschirmen

Nur Stellen in Bildschirmen, die im Fokus-Umfang bleiben oder dorthin führen. Zeilen sind die der jeweiligen Datei.

### Heute (`TodayScreen.tsx`, `UnitCard.tsx`, `UnitStep.tsx`, `WeekPage.tsx`, `unit/labels.ts`)

| Datei:Zeile | Text | Wirkung |
|---|---|---|
| `nbHeute.de.ts:6` | „Wochenthema: {theme}“ | Kopfzeile + Kartentitel (`TodayScreen.tsx:216,578`); 11 der 16 Themen sind Vertrieb (z. B. „CFO: Preis, ROI, Business Case“, „Verhandeln: Rabatt gegen Laufzeit“, „Messe, Networking, LinkedIn“) |
| `nbHeute.de.ts:147` | „Sprechen üben (freiwillig)“ | öffnet den ganzen alten Sprechen-Bereich |
| `nbHeute.de.ts:54` | „Mehr üben“ | führt in den Reiter „Grammatik“ (Seitentitel „Üben“) |
| `nbHeute.de.ts:65-67,71-74` | „Neue Woche“ · „Thema dieser Woche“ · „Alle Aufgaben der Woche hängen an diesem Thema: Text, Wendungen, Aufgabe und Szene.“ · „Beruf“/„Beruf & Alltag“/„Alltag“ | Bestätigungskarte (`UnitCard.tsx:48-51`); Text, Aufgabe, Szene gibt es nicht mehr |
| `nbHeute.de.ts:120,123-125` | „Thema, Wendungen und Ziele der Woche“ · „Kernaufgabe“ · „Sprachfokus“ | `WeekPage.tsx:42` zeigt `th.task` als Untertitel: eine Sprech-/Schreib-/Business-Aufgabe |
| `nbHeute.de.ts:18-20,29-40,45` | Blocknamen „Input“, „Aufgabe“, „Fokus“; Gründe „Kurzer Text zum Thema“, „Hörstück zum Thema“, „Kundenmail lesen …“, „Wendungen der Woche nachsprechen“, „Sag es zum Thema“, „90 · 60 · 45 Sek.“, „Eine Botschaft, drei Tonlagen“, „Antwort auf die Kundenmail“, „Einwände entkräften“, „Generalprobe für deinen Termin“, „Rollenspiel zum Thema“, „Kollokationen zum Thema selbst tippen“ | nur sichtbar für eingefrorene alte Pläne (`unit/labels.ts:21-46`) |
| `nbHeute.de.ts:56,58` | „Heute gilt noch der Plan von vorhin …“ · „Am Handy ist die Aufgabe des Tages kurz und ohne Sprechen: {to}. Sprechen und längeres Schreiben gehen am Laptop besser.“ | nur alter Plan (`TodayScreen.tsx:447-457`) |
| `nbHeute.de.ts:84-106` | „Lies den Text. Tippe Wörter an …“ · „Mail von {from}“ · „Was will der Kunde eigentlich?“ · „Sag es noch einmal aus dem Kopf – kürzer, klarer, mit den Wendungen der Woche.“ · „schreib 3 Sätze zur Aufgabe der Woche“ | Ersatzschritte `unitStep` (praktisch tot) |
| `nbHeute.de.ts:59-60` | „Aufgabe des Tages am Laptop diese Woche: n von total“ · „Sag es jetzt als Extra“ | Text und `lapThisWeek` nirgends benutzt (tot) |
| `TodayScreen.tsx:75-101` | „Lohnt sich jetzt“ kann „Diktat“ vorschlagen (`channels.ts:36`, Fertigkeit „listening“) | Hören taucht als Empfehlung auf |

### Wortschatz (`vocab/*`, `Sheets.tsx`, `WordSheet.tsx`, Trainer)

| Datei:Zeile | Text | Wirkung |
|---|---|---|
| `nbWs.de.ts:115,116,118,123`, `Sheets.tsx:38` | Herkunft-Chips „Lesen“, „Hören“, „Preply“, „Gespräche“ (von 9 Quellen) | Blatt „Neuer Stapel“ |
| `nbWs.de.ts:71` | Stapel „Vom Lehrer“ (Quelle `src:preply`) | Stapelliste, falls Karten vorhanden |
| `nbWs.de.ts:215-217` | Modus „Hören“, Hinweis „Die Karte wird vorgelesen …“ | `DeckScreen.tsx:76-78` |
| `nbWs.de.ts:218-234` | „Hörschleife“ · „10 Sätze hören und nachsprechen, ohne Bewertung“ · „… trainieren Hörverstehen und Aussprache“ | Blatt „Extra-Runde“ (`Sheets.tsx:159-178`), Seite `listenLoop` |
| `trainer.de.ts:14,17,20` | Abfragearten „Hören“, „Diktat“, „Aus der Situation“ | Stufe 1 und 5 der Leiter (`domain/srs/modes.ts:15,24`) |
| `de.ts:309,312`, `trainer.de.ts:21-23` | Zwecktexte: „beim Lesen und Hören“, „wie im Meeting“, „wie im echten Gespräch“, „im Meeting sofort erkennst“, „in der Lage aus deinem Gespräch“ | Info-Symbol in Übungen |
| `trainer.de.ts:11,41` | „Schreib einen eigenen Satz … aus deinem Arbeitsalltag“ · „Schreib einen ganzen Satz (mindestens sechs Wörter)“ | Abfrageart „Eigener Satz“ |
| `trainer.de.ts:47-50` | Ursprung „Gespräch“, „E-Mail“, „Präsentation“, „Baukasten“ | Wortblatt bei Wendungen aus entfallenen Bereichen |

### Grammatik-Reiter, Kurs, Training (`LearnHub.tsx`, `course/*`, `nbdrill/*`, `patterns/*`)

| Datei:Zeile | Text | Wirkung |
|---|---|---|
| `learn.de.ts:28` · `nbSh.de.ts:9` · `learn.de.ts:9` | Seitentitel „Üben“ · Reiter „Grammatik“ · „Zurück zu Üben“ | Namenskonflikt (§8 Nr. 1) |
| `nav.de.ts:16,19-22` | „Lesen, Hören, Schreiben“, „Beiträge zum Lesen, Hören und Ansehen“, „Texte auf deinem Niveau“, „Hören und verstehen“, „Schreiben mit Korrektur“ | nur im toten `InputSections` (`LearnHub.tsx:273-320`) |
| `learn.de.ts:43` | „Hören und den ganzen Satz schreiben“ | Kachel „Diktat“ (`LearnHub.tsx:43`) |
| `learn.de.ts:257-259` | „Hören und genau schreiben …“ · „So klingt es im Gespräch nach dir …“ · „… macht dich im Gespräch flüssiger“ | Info-Texte Diktat, Satzbau, Sprint |
| `learn.de.ts:59,61,64,68,77,78,89,91,92,105` | Lektionsschritte „Dialog“, „Anwenden“; „Hör dir den Dialog an …“; „Lies den Dialog …“; „Schreib einen kurzen Text, wie ihn die Aufgabe beschreibt.“; „Dein Text“; „Schreib hier auf Englisch …“; „Grundfassung ohne KI: … und ein eigener Text.“ | Lektion (`LessonSteps.tsx:238-573`) |
| `nbTraining.de.ts:73-78` | „Schreib den Satz auf der Zielstufe neu.“ · „… in der Mail an den CFO formell.“ · „Mail ↔ Call“ · „… wie man ihn im Call sagt – oder umgekehrt für die Mail.“ | Tipp-Drills Register-Leiter, Phrasal Verbs |
| `patterns.de.ts:7` | „… aus Gesprächen, Texten, Preply, „Sag es“ und Übungen.“ | Seite „Deine Deutsch-Fallen“, Karte im Fortschritt |
| `teacher.de.ts:6-7,23-24` | „Lehrer-Feedback einfügen“ / „… aus Notizen deines Lehrers …“ | Training-Zeile und Blatt „Hinzufügen“ |

### Fortschritt und Profil

| Datei:Zeile | Text | Wirkung |
|---|---|---|
| `progress.de.ts:60-65` | Fertigkeiten „Grammatik, Wortschatz, Lesen, Hören, Schreiben, Sprechen“ | Urteil (`JudgeTab.tsx:182`) |
| `progress.de.ts:154,159,160` | „Liniendiagramm: Beherrschung in Grammatik, Wörtern, Hören und Schreiben …“ · „Hören“ · „Schreiben“ | Verlauf-Diagramm |
| `progress.de.ts:92,93,96,97` | Fehlerquellen „Schreiben“, „Lesen“, „Rollenspiel“, „Business“ | Fehler-Radar (`ErrorsTab.tsx:67-71`) |
| `progress.de.ts:22-25` | „Rollenspiel“, „E-Mail-Refiner“, „Verhandlungs-Baukasten“, „Präsentations-Coach“ | Label und Ziel der „Üben“-Knöpfe (`actionRoute.ts:26-29`) |
| `progress.de.ts:55` | „Claude liest deine echten Antworten, Texte und Gespräche …“ | Info zum Urteil |
| `progress.de.ts:114,125` · `cefr.json` | „Was du auf dem Weg nach C1 können sollst“ · Gruppen Hören, Lesen, Sprechen, Schreiben, Flüssigkeit, Register & Stil | Can-Do-Liste |
| `progress.de.ts:148,150` | „Text geschrieben: {title}“ · „Gespräch geführt: {title}“ | Wochenbericht (`WeeklyCard.tsx:35-46`) |
| `stand.de.ts:40,44-46,48,49,55` | „Letzte Fortschritte aus der alten App“; Bereiche „Lesen“, „Hören“, „Schreiben“, „Sprechen“, „Entdecken“, „Preply“ | Verlauf-Tabelle |
| `nbProfil.de.ts:101-122` | „Monatsvergleich“, „Dieselbe Sprech- und Schreibaufgabe …“, „Sprechen (45 Sekunden)“, „Schreiben (Mail)“, „Schreib die Mail auf Englisch.“ | Karte im Verlauf, Seite `compare` |
| `nbProfil.de.ts:16` | „Einschätzung von Claude“ (Satz aus allen Fertigkeiten) | Profil-Blatt |

### Einstellungen, Claude, Umstellung

| Datei:Zeile | Text | Wirkung |
|---|---|---|
| `voice.de.ts:7` | „Antworten im Rollenspiel vorlesen“ | Einstellung |
| `stand.de.ts:79,80` | „… für Fachwörter, Lese- und Hörtexte, Schreibaufgaben und Rollenspiele.“ · „… viele Kundentermine“ | Einstellung „Beruflicher Kontext“ |
| `nbHeute.de.ts:61-63` | „Am Handy“ · „Am Handy kurze Aufgabe statt Sprechen und Schreiben“ · „Statt Sprechen und längerem Schreiben …“ | Einstellung ohne Wirkung |
| `input.de.ts:232` | „Entdecken-Einträge“ | Diagnose |
| `nbProfil.de.ts:95` | „Fakten aus deinen Gesprächen … Tippe im Gespräch auf „Merken““ | Einstellung „Claude merkt sich“ |
| `companion.de.ts:37,60,61` | „… Wörter, Grammatik, eine E-Mail …“ · Vorschlag „Hilf mir bei einer E-Mail“ · „Was soll ich meinen Lehrer fragen?“ | Claude-Fenster, Standard-Vorschläge ohne Kontext (`domain/companion/suggest.ts:36`) |
| `companion.de.ts:21,38` | „Neues Gespräch“ · „Gespräch mit Claude“ | meint den Chat, kollidiert mit dem Segment „Gespräche“ (Rollenspiel) |
| `de.ts:114,157-165` | „Entdecken-Beiträge“, „Rollenspiel-Szenen“, „Preply“, „Artikel“, „Leseergebnisse“, „Hörtexte“, „Schreibaufgaben“ | nur Umstellung/Nachtragen (einmalig), niedrige Schwere |

Tote Texte: 162 Texte ohne jede Verwendung, darunter die ganze Preply-Brücke (`companion.de.ts:92-172`, 79 Texte), 13 in `input.de.ts`, 9 in `nbSprechen.de.ts`, 12 in `nbTraining.de.ts`, 8 in `nbSh.de.ts`, 7 in `nbWs.de.ts`; dazu Texte nicht eingebundener Bausteine: `WhatsNew` (`stand.de.ts:94-104`) und `InputSections` (`nav.de.ts:16-22`).

---

## 8. Widersprüche und Unlogisches (nach Schwere)

Schwere: H = verwirrt den Kernablauf oder ist sachlich falsch · M = stört, aber nicht blockierend · N = Schönheitsfehler/Wartung.

| Nr. | Schwere | Ort A sagt … | Ort B sagt oder tut … | Belege |
|---|---|---|---|---|
| 1 | H | Reiter heißt „Grammatik“. | Die Seite darunter heißt „Üben“, der Rückweg „Zurück zu Üben“, „Mehr üben“ auf Heute führt dorthin; die Seite enthält Kurs, Fehlerliste, Wortschatz-Übungen (Kollokationen, Wortbildung, Phrasal Verbs), Hören (Diktat) und Lehrer-Feedback; darunter eine Seite „Grammatik“ (dreimal dasselbe Wort). | `nbSh.de.ts:9`; `learn.de.ts:28,9`; `nbHeute.de.ts:54`; `LearnHub.tsx:177,181-264` |
| 2 | H | „Mehr üben“ auf Heute führt in den Reiter „Grammatik“. | „Mehr üben ›“ im Wortschatz öffnet das Blatt „Extra-Runde“. Dazu „Freie Runde · 8 Aufgaben“, „Freie Runde Vokabeln“, „Extra-Runde“, „Noch eine Runde“: vier Namen für „freiwillig weiterüben“. | `TodayScreen.tsx:431`; `VocabHub.tsx:274-278`; `learn.de.ts:118,273`; `nbWs.de.ts:135,48` |
| 3 | H | Fokus: „nur Vokabeln und Grammatik“. | Fortschritt zeigt weiter Lesen, Hören, Schreiben, Sprechen: Fertigkeiten (4 von 6), Can-Do (30 von 40), Diagramm-Linien, Fehler-Quellen, Alt-Tabelle, Monatsvergleich, Wochenbericht, Claude-Urteil. | §6 Nr. 8, 17, 21, 22, 24, 29 |
| 4 | H | Diagramm nennt Linien „Hören“ und „Schreiben“. | Die Werte sind Antwortarten: „Hören“ = Vokabel-Diktat (Stufe 5) und Übung „Diktat“, „Schreiben“ = alle getippten Vokabel-Antworten und Grammatik-Lücken, -Umformungen, -Verbesserungen. | `HistoryTab.tsx:25-30`; `progress.de.ts:154,159-160`; `profilePatch.ts:58-61`; `progress/persist.ts:222-227` |
| 5 | H | Wochen-Check-Seite: „ein Extra, einmal je Kalenderwoche“; Zeile trägt das Etikett „Extra“; Bildschirm-Kommentar „zählt nie als Pflicht“. | Sonntags ist er Pflichtblock der Tageseinheit („Wochen-Check · 12 Aufgaben zur Woche · 5 Min.“). | `nbProfil.de.ts:31`; `ChecksCard.tsx:108`; `CheckScreen.tsx:20-22`; `week/plan.ts:83-88`; `nbHeute.de.ts:22,41` |
| 6 | H | Heute-Karte trägt das Wochenthema als Titel („CFO: Preis, ROI, Business Case“), Bestätigungskarte: „Alle Aufgaben der Woche hängen an diesem Thema: Text, Wendungen, Aufgabe und Szene“, „Kernaufgabe“ = Sprech-/Schreibaufgabe. | Die 4 Blöcke (Wiederholen, Grammatik, Satzbau, Fehler korrigieren) haben mit dem Thema nur über die Kartenauswahl zu tun; Text, Aufgabe, Szene existieren nicht mehr; am ersten Tag jeder Woche unterbricht eine Bestätigungskarte mit 16 Themen. | `TodayScreen.tsx:578`; `nbHeute.de.ts:67`; `WeekPage.tsx:42`; `UnitCard.tsx:34-92`; `themes.ts` |
| 7 | H | Pflichtblock „Fehler korrigieren“ (3 Min.). | Er nimmt nur fällige Reparatur-Sätze (höchstens 3); Block 1 fragt dieselben Sätze schon zu Beginn ab (bis 3, `domain/week/review.ts:10`; Tagesgrenze 4, `daily.ts:9`). Danach ist der Block meist leer („… Der Block ist erledigt.“), zählt aber als Pflicht. Zufluss neuer Sätze kommt fast nur aus entfallenen Bereichen (Rollenspiel, Sag es, Flüssigkeit, Tonlagen, toter Block Fokus); übrig: Deutsch-Fallen-Drill und Lehrer-Feedback. (Aus dem Code gelesen, nicht im Lauf geprüft.) | `domain/repair/unit.ts:240-262`; `domain/week/review.ts:10`; `vocab/session.ts:372`; `nbLernen.de.ts:31-32`; Aufrufer `saveRepairs`: `useRoleplay.ts:194`, `SayScreen.tsx:176`, `FluencyScreen.tsx:189`, `TonesScreen.tsx:114`, `grammar/focus/session.ts:114` (tot) gegenüber `PatternDrill.tsx:107`, `teacher/actions.ts:41` (bleiben) |
| 8 | H | Urteil und Fehler-Radar: Knopf „Üben“. | Ziele sind Rollenspiel, E-Mail-Refiner, Verhandlungs-Baukasten, Präsentations-Coach; Claude darf zusätzlich write/read/listen/discover/speak/business wählen (write/read/listen/discover haben kein Ziel = kein Knopf; ob der Fokus dann noch etwas bewirkt, ist unklar, Vermutung: nein). | `actionRoute.ts:26-29`; `domain/assessment/actions.ts:7,33-46` |
| 9 | H | „Sprechen üben (freiwillig)“ auf Heute. | Öffnet den ganzen alten Bereich: Segment „Schreiben“, Business-Szenen, Termine, Pitch, Playbook, Einwand-Training, Posteingang, Aussprache: 22 feste Einstiege plus Szenenkarten statt ein Extra. | `TodayScreen.tsx:463-475`; `SpeakHub.tsx:173-334`; `areas/training.tsx:66-157` |
| 10 | H | Kopfkarte: „Kurs 12 von 24 Lektionen“; „Wortschatz N Karten“. | Sobald Claudes Zusatzlektionen ab l25 existieren, zählen Kurs-Seite und Hub sie mit (dann z. B. „12 von 30“), die Kopfkarte nicht; „Alle n Einträge“ im Wortschatz zählt Wendungen mit, die Kopfkarte nicht. | `domain/overview.ts:121`; `CourseScreen.tsx:42-43`; `LearnHub.tsx:145-150`; `VocabHub.tsx:272`; `domain/overview.ts:86-98` |
| 11 | H | Auf einer Seite stehen sechs Zahlen für „wie viele Wörter kann ich“. | „Wortschatz N Karten“ · „Wortschatzziel: jetzt etwa X“ (Test + gefestigte) · „Aktiv fest“ · „Erwartet gekonnt“ · „Sichere Einträge“ · „Gefestigt“: verschiedene Definitionen, keine Erklärung des Unterschieds. Das 8.000-Ziel steht nur im 3. inneren Reiter von Fortschritt, nicht im Wortschatz-Reiter; der Wortschatztest nur im Profil-Blatt. | `ProgressScreen.tsx:117`; `PathTab.tsx:121-130`; `Sections.tsx:90-96`; `domain/srs/retention.ts` |
| 12 | M | Claude-Fenster ohne Kontext schlägt vor: „Hilf mir bei einer E-Mail“, „Was soll ich meinen Lehrer fragen?“. | Beide Themen entfallen. | `companion.de.ts:37,60,61`; `suggest.ts:36` |
| 13 | M | „Modus“ im Wortschatz-Reiter: Automatisch · Aufdecken · Tippen. | Stapel-Seite: Aufdecken · Tippen · Hören; Einstellungen: wie Reiter; „Richtung“ nur in Stapeln, Hinweis „Tageseinheit und Alle fälligen fragen immer Deutsch → Englisch“. | `VocabHub.tsx:205-215`; `DeckScreen.tsx:74-80`; `Sections.tsx:27-38`; `nbWs.de.ts:205` |
| 14 | M | Fehler-Wiederholung heißt je Ort anders. | „Grammatik-Fehler“, „Reparatur-Sätze“, „Fehler korrigieren“ (Block), „Fehler-Radar“, „Deutsch-Fallen“, „Fehler der Woche“ (Stapel), „Schwierig“/„Hartnäckig“ (Stapel), „Deine Fehler · n fällig“ (Knopf): acht Namen für „falsch gemacht, später wieder üben“. | `nbLernen.de.ts:45-49`; `nbWs.de.ts:63,64,68`; `learn.de.ts:119` |
| 15 | M | Reiter „Fortschritt“ steht unten. | Das Profil-Blatt führt sechsfach zur selben Seite („Dein Stand ›“ plus Urteil, Fehler, Ziel C1, Zahlen, Verlauf); Namen: Reiter „Fortschritt“, Seite „Dein Stand“, Gruppe „Stand“, Zeile „Statistik“ (`nbShOverviewSub`) = Reiter „Zahlen“. | `SheetHost.tsx:40-49`; `ProfileSections.tsx:134-153`; `nbSh.de.ts:43`; `nbProfil.de.ts:27` |
| 16 | M | „Reparatur-Sätze: x offen · y sicher“ in „Aus deinen Fehlern“ sieht wie eine antippbare Zeile aus. | Ist nicht antippbar; die Zeile „Grammatik-Fehler“ wird bei 0 zu Text ohne Pfeil. | `LearnHub.tsx:209-223` |
| 17 | M | „Deutsch-Fallen“ wurde aus dem Reiter „Grammatik“ geöffnet. | ✕ führt in den Reiter „Fortschritt“ statt zurück. | `PatternsScreen.tsx:46` |
| 18 | M | Einstellung „Am Handy kurze Aufgabe statt Sprechen und Schreiben“. | Neue Pläne enthalten keine Sprech-/Schreibaufgabe mehr, der Schalter ersetzt nichts. | `phone.ts:23`; `heute.tsx:110` |
| 19 | M | Lehrer-Feedback gehört zum Wortschatz (Karten, Reparatur-Sätze). | Eintrag steht im Reiter „Grammatik“ unter „Training“ und zusätzlich im Blatt „Hinzufügen“. | `areas/wortschatz.tsx:93`; `AddWordSheet.tsx:200-215` |
| 20 | M | Reiter „Grammatik“ enthält einen Kurs. | Zwei von vier Lektionsschritten sind Dialog (Hören/Lesen) und Anwenden (Text schreiben); Meilensteine sind Sprech-/Mail-Ziele („Kann jetzt: …“). | `learn.de.ts:58-61`; `CourseScreen.tsx:70-77` |
| 21 | M | Fokus: „Hören entfällt“. | Vokabel-Leiter hat Hör-Abfragen (Stufe 1 „Hören“, Stufe 5 „Diktat“), „Diktat“ als Übungskachel, „Lohnt sich jetzt“ kann es vorschlagen, Stapel-Modus „Hören“, „Hörschleife“. Entscheidung nötig. | `modes.ts:15,24`; `LearnHub.tsx:43`; `TodayScreen.tsx:75-101`; `DeckScreen.tsx:78`; `Sheets.tsx:159-178` |
| 22 | N | Einstellungstexte nennen Rollenspiel, Lese-/Hörtexte, Gespräche, Entdecken. | Siehe §7 „Einstellungen“. | `voice.de.ts:7`; `stand.de.ts:79`; `nbProfil.de.ts:95`; `input.de.ts:232` |
| 23 | N | Serie wird dreimal einzeln berechnet (Heute, Profil-Knopf, Profil-Blatt). | Gleiche Funktion, drei Kopien. | `TodayScreen.tsx:178-190`; `useStreak.ts:15-34`; `weekDots.ts:streakView` |
| 24 | N | Kommentare und Namen: „Sechs Reiter“, Plätze `read`/`speak`/`write`, Bereich „lesen“ | Es gibt vier Reiter. | `TabBar.tsx:15`; `tabs.ts:16,30-33`; `areas/system.tsx:16-18` |

---

## 9. Daten

### 9.1 Weiter schreiben (Fokus-Funktionen)

| Pfad | Geschrieben von | Anmerkung |
|---|---|---|
| `vocab/<id>`, `chunk/<id>` | Trainer, Wort-Antippen, Übersetzer, „Hinzufügen“, Lehrer-Feedback, C1-Paket (250 Einträge, bis 2 neue Karten je Tag), Tagesauftrag-Aufnahme | Kern; FSRS zusätzlich, alte Felder gespiegelt |
| `grammar/<topic>` | Grammatikrunde, Wochen-Check | |
| `log/<Tag>` | alle Übungen (Sammel-Warteschlange) | |
| `app/profile` | Zähler (days, xpDays, minutes, act, ema, n, answers …), plan, pflicht, vtests, checks, sprints, history, canDo, Einstellungen (goalMin, newPerDay, sound, haptic, autoNext, voice, rate, ctx, lang, theme) | `act`-Schlüssel `u-in`, `u-task`, `u-focus`, `u-again`, `u-check` bleiben, damit die Serienregel stabil bleibt |
| `app/schema` | pflichtSince, Umstellungsvermerk | nie ändern |
| `app/decks`, `app/week`, `app/repair`, `app/patterns`, `app/pool`, `app/radar`, `app/assess`, `app/weekly`, `app/lookup`, `app/chat`, `app/memory` | Stapel, Wochenfokus, Reparatur-Sätze, Deutsch-Fallen, Aufgabenpool, Fehler-Radar, Urteil, Wochenbericht, Wort-Cache, Claude-Chat, Claude-Gedächtnis | `app/week` bleibt nur, wenn der Wochenfokus bleibt |
| `app/course`, `lesson/<id>` | Kurs | nur, wenn der Kurs bleibt (zugeschnitten auf Wörter + Grammatik) |
| `out/<Monat>`, `teacher/<Monat>`, `archive/*` | Tipp-Drills, Lehrer-Feedback, ausgelagerte Profiljahre | |
| `daily/<Tag>` | nur lesen: Claude-Tagesauftrag liefert Wörter und Grammatik-Aufgaben, die die App aufnimmt | Routine liegt außerhalb des Repos |

### 9.2 Nur lesen und aufbewahren (nie löschen)

| Pfad | Gehörte zu | Offene Lesezugriffe im Fokus-Umfang (beim Umbau entfernen, Daten unberührt lassen) |
|---|---|---|
| `feed/*` | Entdecken (vom Tagesauftrag geschrieben; die Routine schreibt weiter `feed/<morgen>`, Änderung nur mit Emrahs „Ja, Auftrag ändern“) | Migration/Nachtragen |
| `writing/*`, `wprompt/*`, `articles/*`, `reading/*`, `lpool/*` | Schreiben, Lesen, Hören (`writing/*` schreibt heute noch der Schritt „Anwenden“ der Lektion) | Wochenbericht, Can-Do, Urteil-Belege, Deutsch-Fallen-Erkennung |
| `scene/*`, `talk/*`, `say/*`, `fluency/*`, `meeting/*`, `tones/*`, `biz/*` | Sprechen, Business | Wochenbericht („gesprochen“), Urteil-Belege, Deutsch-Fallen-Erkennung, Wendungen mit Ursprung „Gespräch“ |
| `preply/*`, `app/week.preplyNext`, `app/decks.flagged` | Preply | Stapel „Vom Lehrer“, Fehler-Quelle |
| `app/compare`, `app/levels` | Monatsvergleich, Einwand-Training | Verlauf-Karte |
| Profilfelder `disc`, `gen`, `mix`, `listen`, `feed`, `lap`, `seen15`, `tour11` | Entdecken, Lesen/Hören, Alt-Daten | Verlauf-Tabelle (`feed`) |

---

## 10. Aufräum-Brocken und Abhängigkeiten

1. **Entfallene Bereiche (der größte Block).** 14 Feature-Ordner (`business`, `discover`, `fluency`, `inbox`, `input`, `listen`, `meeting`, `pressure`, `pron`, `read`, `say`, `speak`, `tones`, `write`) = 17.153 Zeilen; dazu `src/domain/{business,discover,fluency,input,meeting,say,speak,tones}` ≈ 3.250 + `compare` 152; Prompts (21 Dateien wie `roleplayTurn`, `meetingPrep`, `mailRefine`, `pitchScript`, `readingText`, `listeningText`, `writingReview`, dazu `nb/p4`, `nb/p5`, `nb/p7`; `nb/p6` „Mach mir eine Übung dazu“ bleibt) ≈ 3.300; Inhalte `content/nb/{texts,inbox,objections,scenes}.json` (`extras`, `collocations`, `transforms` gehören zu den Tipp-Drills und bleiben), `content/business`, `content/speak`, `legacy/{passages,feed-seed,scenes}.json`; 836 Texte; 22 Routen; Tests.
   Kopplungen, die zuerst gelöst werden müssen (sonst bricht der Bau): `app/shell/TabBar.tsx:2` und `Shell.tsx:14` importieren `features/input/aiTasks` und `AiTaskNotice`; `AiRunPanel` (aus `features/input`) nutzen `patterns/FreeItem`, `patterns/PatternsScreen`, `vocab/ExerciseView`, `repair/RepairItem`; `LearnHub.tsx:4,25` nutzt `app/modules` und `input/InputOffers`; `settings/VoiceSection.tsx` nutzt `speak/autoplay`; `vocab/session.ts` nutzt `speak/useSceneLibrary` und `domain/speak/library`; `lookup/LookupPopover.tsx` nutzt `domain/input/cardSrc`; `unit/run.ts` nutzt `domain/say/sayDoc`; `settings/SettingsSheet.tsx` nutzt `domain/discover/steps`; `nbdrill/unitBlocks.ts` zieht `inbox`, `pron`, `pressure` herein; `features/levels` hängt nur an `pressure`; Prompt-Typen importieren aus `domain/speak|tones|business`.
2. **Tageseinheit- und Wochenthema-Maschinerie.** 17 Blockarten, davon 12 tot für neue Pläne: `domain/week` (946 Z.), `domain/unit` (425), `domain/plan` (1.001, darunter `phone.ts`), `features/unit` (930, darunter `run.ts:fallback`, Ersatzschritte, Bestätigungskarte), `features/week` (303), `areas/lernen.tsx` (Block `focus`), `features/grammar/focus/*`, `nbHeuteWhy_*`/`nbHeuteBlock_*`-Texte, 16 Wochenthemen mit Szene, Frage, Zählzielen in `content/nb/themes.ts`, Handy-Schalter samt `viewPlan`.
3. **Fortschritt und Urteil neu schneiden.** `features/progress` (3.353 Z., 20 Dateien), `domain/assessment` (975), `domain/progress` (1.364): 6 Fertigkeiten auf 2, Can-Do 40 auf 10, Belegpaket (12 Abschnitte: p, g, r, w, v, l, rd, li, s, pp, cd, a) auf die Fokus-Quellen, Prompt `assess.ts`, Aktionsliste, Diagramm-Linien, Wochenbericht-Fakten, Alt-Tabelle, Monatsvergleich.
4. Kleinere Brocken: tote Dateien (`FreeRoundSheet`, `WhatsNew`, `WeekStrip`, `TodayCompareRow`, `LearnHub.InputSections`, `lapThisWeek`/`lapPatch`); Reiter-Plätze `read`/`speak`/`write` (`tabs.ts:16`); drei Kopien der Serien-Rechnung; ausgeblendete Bereiche stehen weiter in `src/areas/{lesen,sprechen,training}.tsx` und im Routen-Register (50 Namen, `registry.ts`).

---

## 11. Offene Entscheidungen für das Konzept (aus dem Inventar)

- Welches Sprechen bleibt als „freiwilliges Extra“ (Annahme hier: nur Rollenspiel mit Szenen)? Sag es, Flüssigkeit, Aussprache, Einwand-Training und Posteingang sind hier AUSBLENDEN.
- Hören innerhalb der Vokabel-Leiter (Abfragen „Hören“, „Diktat“, Hörschleife): als Abfragearten behalten oder entfernen?
- Kurs: behalten (zugeschnitten auf Wörter + Grammatik) oder durch Grammatik-Themen + Wortschatz-Pakete ersetzen?
- Wochenthema: zu „Wochenfokus“ (Wendungen, Werkzeug, Falle) umbauen oder ganz streichen?
- „Fehler korrigieren“: Zufluss neu definieren (Grammatik-Fehlersätze, Lehrer-Feedback, Deutsch-Fallen) oder Block zusammenlegen.
- Claude-Tagesauftrag: weiter `feed/<morgen>` schreiben lassen? (Routine außerhalb des Repos.)
