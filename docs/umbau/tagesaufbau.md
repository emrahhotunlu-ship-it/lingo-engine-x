# Plan Tagesaufbau mit 5 Schritten (Stand 12.10.2026, einmaliger Planungsdurchgang, kein Code)

Auftrag: Emrah, 12.10.2026, `docs/entscheidungen.md` („Täglicher Aufbau“). Entscheidung: 1 Neue Wörter lernen · 2 Wörter wiederholen · 3 Grammatik nach Lernpfad · 4 Fehler wiederholen (Pflicht, zusammen etwa 23 Min.) · 5 Spezial des Tages (Extra, etwa 5 Min.; insgesamt etwa 30). Eigener Name, eigene Aufgabenstellung, eigenes Aufgabenbild je Schritt. Konzeptentwurf T in `docs/umbau/vokabel-plattform.md`. Zweig für den Bau: `claude/umbau-tagesaufbau` (nach Freigabe des Plans).

## 1. Ist-Zustand mit Belegen
- Vier Schritte, keiner heißt „Neue Wörter“: `src/domain/unit/planFor.ts:31` (`VG_MIN.full` = Wörter 8 · Grammatik 7 · Satzbau 5 · Fehler 3), Aufbau `planFor.ts:93-162` (voller Tag `:128-141`, kurz `:119-127`, Sonntag `:111-118`).
- Neue Wörter fahren im Schritt „Wiederholen“ mit: `domain/unit/review.ts:314-357` (`unitReviewGoal` liefert `fresh` innerhalb `goal.review`), eingestreut an Stelle 2, 5, 8 (`domain/unit/block1.ts:293`, `domain/srs/queue.ts:250`), Dosis über `capacityNew` (`domain/unit/backlog.ts:277`, 12-Minuten-Budget `:271`, 2 bis 5 Wörter, Bremse ab 15 Überfälligen `:258`). Die Runde selbst ist `startSession('pflicht')` (`features/vocab/session.ts:336`), neue Karten beginnen mit der Einführung (`phase: 'intro'`, `queue.ts:241`).
- Gleiche Aufgabenansicht: Schritt 1, 2 und 4 laufen über denselben Player (`ExerciseTop`, `features/learn/ui.tsx:118`) mit denselben Rahmen; Namen aus `nbHeuteBlock_*` (`src/i18n/parts/nbHeute.de.ts:17-24`), Zeilengründe `features/unit/labels.ts:126`.
- Satzbau ist Schritt 3 (Block 3, `task.order`), an Format-Tagen Kleines Wort/Wort umbauen/Umformen/Passendes Wort und samstags Tempo-Runde (`domain/c1/checkSchedule.ts:19-37`). Der C1-Check ersetzt Schritt 2 und 3 (`domain/c1/check/day.ts:12`).
- Schritt 4 „Fehler korrigieren“: `features/repair/again/session.ts`, Grenze `fixLimitFor` (`planFor.ts:47`), entfällt bei nichts fällig (`planFor.ts:146`).
- Plan-Speicherform: `buildUnitStored` (`domain/unit/plan.ts:79`) schreibt `duty` und `u.b = [Block, Art, Minuten, Args]`, `u.rv = 2` (`:70`), `PLAN_RV = 2` (`:12`). Pflicht = `plan.duty.every(...)` (`domain/plan/pflicht.ts:161`), Wiederholen über Protokoll `ctx:'rev'` (`domain/plan/buildPlan.ts:222`), alle anderen Schritte über `act[tag]['u-…'] ≥ 1` (`:243`, `unit/run.ts:262`).
- Was für Spezial schon da ist: Phrasal Verbs (`content/nb/extras.json` 25, Paket `c1/pack.json` Kategorie `phrasal` 45, Drill `nbdrill` Menge `phrasal`, `areas/training.tsx:34`), Idioms (nur Paket-Kategorie `idiom` 30, **kein eigener Drill**), Wortfamilien (c1x `wf` 122 Aufgaben, `wordFormation` 20, Paket `family` 33, Übungsart `wordfam`), Verwechslungspaare (**kein Inhalt**: Art `pair` ist ein Rumpf, `features/c1x/registry.ts:19`; nur Deutsch-Fallen `nb/traps.ts`, Übungsart `find_trap`, Kontrast von Claude), Hören (Hörschleife `listenLoop`, `areas/wortschatz.tsx:90`, geht am Handy mit Sprachausgabe; `dictation`/`listen_mc` nur mit Tastatur, `domain/srs/modes.ts:51`).

## 2. Zielbild je Schritt

Zeit „Wortschatz-Minuten“ W = 12 (ersetzt die doppelte Zeitquelle 480 s Plan gegen 720 s Kapazität, V0 des Vokabel-Plans): Schritt 1 + Schritt 2 = W.

| Schritt | Name (DE / EN) | Wozu (Zeile unter dem Namen) | Minuten voller Tag | Zählt |
|---|---|---|---|---|
| 1 | Neue Wörter lernen / Learn new words | „Heute kommen n Wörter dazu, damit dein Wortschatz wächst.“ | 2 bis 7, Standard 4 (n × 80 s) | Pflicht |
| 2 | Wörter wiederholen / Review words | „Karten, die jetzt fällig sind, bleiben im Gedächtnis.“ | W minus Schritt 1, mindestens 5 (Standard 8) | Pflicht |
| 3 | Grammatik nach Lernpfad / Grammar path | „Das Thema deines Kapitels, ein Stück weiter.“ | 7 | Pflicht |
| 4 | Fehler wiederholen / Review mistakes | „Deine eigenen falschen Sätze, jetzt richtig.“ | 3 bis 4 (`fixMinutes`) | Pflicht, entfällt bei nichts fällig |
| 5 | Spezial des Tages / Special of the day | „Heute: <Art>, zur Abwechslung.“ | 5 | **Extra** |

Formen: voll Mo bis Sa (Ziel über 20) 4/8/7/3 = 22 Pflicht + 5 Spezial; kurz (Ziel 15 bis 20) 3/5/5/3 = 16, Spezial 3; winzig, Wiedereinstieg, Neustart-Woche (Ziel bis 10) 2/3/3/2 = 10, kein Spezial; Sonntag 3/5/Wochen-Check 5/2 = 15 (Schritt 3 ist dort der Wochen-Check, wie heute), kein Spezial; letzter Samstag mit C1-Check: der Check ersetzt Schritt 3, Spezial entfällt.

**Schritt 1 Neue Wörter lernen** (neu gebaut, `round: 'neu'` in `features/vocab/session.ts`)
- Posten: heutige neue Karten aus dem Eingangskorb (`newCards`, Korb und Tagesmix unverändert). Dosis n = `min(newQuotaLeft, capacityNew(Last), vorhandene)`; Bremse und Neustart-Woche wie heute (Mindestzahl `NEW_MIN` = 2, Kap. 15: nie ganz null, außer `newPerDay` = 0 oder kein neues Wort im Korb: dann entfällt der Schritt mit ruhiger Zeile). Vor dem Plan wird n und `goal.new` eingefroren.
- Ablauf je Wort: (a) Vorabfrage „Kennst du das schon?“ (bestehende `startKnownProbe`, nur bei Karten mit Ursprungssatz; richtig ohne Hilfe heißt „kenne ich“, `m:'known'`), (b) Einführung (Karte mit Lautschrift, Satz, Wortpartner; bestehend), (c) drei Pässe in **drei verschiedenen Aufgabenfamilien** (`familyOf`, `domain/srs/variety.ts`): Pass 1 Erkennen im Satz (`mc_en`/`ctx_mc`), Pass 2 Gegenrichtung oder Lücke mit Hinweis (`mc_de`/`match`/`cloze_hint`), Pass 3 getippt (`cloze`/`colloc`/`type`). Abstände durch Verschränken der Wörter: nach 3, nach etwa 6, ans Ende (`reinsertAt`-Logik wie `queue.ts:275`). Falsch: „Nochmal“ wie bisher, höchstens 4 Zeigen je Karte (`MAX_SHOWN` für diese Runde 4 statt 3).
- Buchung: Protokoll `ctx:'duty'` (vorhandener Wert, `Ctx` in `domain/learn/types.ts:8`), damit die Antworten **nicht** in „Wiederholen“ zählen (`buildPlan.ts:222`) und die Behaltensquote nicht verfälschen (`domain/progress/measures.ts:51`). Karten werden mit `intro = heute` angelegt wie bisher (Zähler „Neu sicher“). Fertig: `act[tag]['u-new'] = 1` über `markBlockDone`.
- **Leitplanke Barcroft (Wörter aktivieren, Stufe 1, 14.10.2026, fest):** In Schritt 1 „Neue Wörter“ (Einführung und die drei Pässe) gibt es **nie** freie Sätze. „Eigener Satz“ (`produce`) und jede andere frei formulierte Satzaufgabe (Satz bauen, Umformen, Register) sind erst erlaubt, wenn die Karte mindestens Stufe 3 hat **und** schon an mindestens zwei verschiedenen Tagen richtig abgerufen wurde (`activationReady`, `src/domain/srs/brief.ts`: Verlaufseinträge mit Note ≥ 2, Aufdecken und „Kenne ich“ zählen nicht). Erzwungen an drei Stellen: `supports` in `modes.ts` (die Aufgabe wird gar nicht angeboten), Wächter-Regel R13 in `guard.ts` (eine trotzdem gebaute Aufgabe fällt durch und wird ersetzt) und Test `tests/unit/aktivierung.test.ts`. Karten, die am selben Tag eingeführt wurden (`intro = heute`), haben keinen zweiten Tag und scheiden damit von selbst aus; der Baustein `round: 'neu'` darf diese Regel nie umgehen und keine eigene Satz-Art in `availableExercises` einhängen.
- Offen für Lernwissenschaft: Pass 2 und 3 am selben Tag dürfen die Stufe höchstens um 1 anheben (kein Aufblähen von S/Stufe durch Tageswiederholung); prüfen, wie `cardPatch` Antworten desselben Tages bucht.

**Schritt 2 Wörter wiederholen**: nur fällige Karten und Wendungen (`dueCards`, Aufholmodus ab 40 Überfälligen, Blutegel-Deckel), keine neuen Wörter, nie Fehlersätze (Entscheidung 11.10.2026). Heute eingeführte Karten (`intro === heute`) sind ausgeschlossen (sie gehören zu Schritt 1). Modus-Wahl als kleine Zeile auf der Startkarte („Modus: Automatisch ›“, `defaultsFor` in `session.ts:325`): Automatisch · Aufdecken (Anki) · Tippen; Aufdecken zählt wie Tippen für `goal.review`. `goal.review` = Zahl der fälligen Karten (ohne `fresh`), Budget `W×60 − Sekunden Schritt 1`, Rückstandszuschlag wie `backlogBudget`.

**Schritt 3 Grammatik nach Lernpfad**: unverändert `grammar` (Block 2, `u.gt` eingefroren, Kapitel-Arbeit, 6 Aufgaben), nur Name, Rahmen und Wortlaut neu. Die Prüfungsarten (Kleines Wort, Umformen, Passendes Wort, Fehler finden) stecken bereits in den 6 Aufgaben (`wantKinds`).

**Schritt 4 Fehler wiederholen**: unverändert die eine Fehlerschlange (`AgainScreen`), nur Name, Rahmen, Wortlaut. Der Rahmen zeigt „Dein Satz“ gegen „Richtig“ nebeneinander.

**Schritt 5 Spezial des Tages (Extra)**
- Arten (Emrahs fünf, plus eine Empfehlung): `phr` Phrasal Verbs · `idi` Idioms · `fam` Wortfamilien · `pair` Verwechslungspaare · `lis` Hören · `ord` Sätze bauen (Satzbau, siehe Empfehlung). Samstags `tempo` (Tempo-Runde) statt Rotation, wenn `flags.tempo` an ist.
- Auswahl, rein und deterministisch (`src/domain/unit/special.ts`, neu): `specialFor(day, facts)` bewertet jede verfügbare Art mit `min(Tage seit letztem Mal, 14) + 6 × Schwäche + Hash-Aufschlag` (Salz wie `SAY_SALT`, `domain/plan/channels.ts:71`), nie dieselbe Art wie gestern, jede verfügbare Art mindestens einmal in 10 Tagen. Schwäche (0 bis 1) aus vorhandenen Daten: schwächste Abrufwahrscheinlichkeit der Paketkarten der Kategorie, Fehler-Radar `app/radar` (Kategorien calque/partner/meaning/register), `trapForCard`. Eingefroren beim Anlegen des Plans in `u.sp` (Kap. 15: würfelt nie neu). Kein Eingabeprofil, keine Sprachausgabe im Plan (Regel „Plan hängt nie von der Umgebung ab“); stattdessen Rückfall beim Start: kein Ton → nächste Art der Rangliste, ehrlich genannt („Heute ohne Ton: …“).
- Verfügbarkeit: eine Art ist nur wählbar, wenn mindestens 6 ungesehene Aufgaben vorhanden sind (Schwelle als Konstante, Test).
- Start: erst nach Schritt 4 (oder wenn Schritt 4 entfällt, nach Schritt 3). Davor nur eine ruhige Hinweiszeile unter der Liste (kein zweiter Knopf, Kap. 2 Nr. 1).

| Art | Heute nutzbar | Fehlt |
|---|---|---|
| phr | Drill `phrasal` (25) + Paket 45 | Inhalt auf etwa 120 erweitern (2 Chargen à 40, Gegenlesung Englischlehrer 100 %) |
| idi | 30 Paketkarten | eigener Drill (Bedeutung erkennen, Lücke), Inhalt auf etwa 80 |
| fam | c1x `wf` 122, `wordFormation` 20 | nichts Blockierendes (Runde über `startFormatRound`, Kontext Extra) |
| pair | nichts | Inhalt etwa 60 Paare (2 bis 3 Aufgaben je Paar) und Oberfläche der Art `pair` (`kinds/Pair.tsx`, Rumpf ersetzen); bis dahin wird `pair` übersprungen |
| lis | Hörschleife (Handy mit Ton), Diktat (Tastatur) | Hören am Handy in der Leiter = V6 |
| ord | Drill `order` (`c1/order.json`, `drills/orderGen.ts`) | nichts |

**Satzbau und Formate (Empfehlung)**: Satzbau wird sechste Spezial-Art (seltener, etwa 1 von 8 Tagen). Die Format-Runden (Kleines Wort, Umformen, Passendes Wort) verlassen die Pflicht, bleiben unter „Anwenden“ (Extra) und stecken weiter in den Aufgaben von Schritt 3; Wort umbauen = Spezial `fam`; Tempo-Runde = Spezial am Samstag. Begründung: Zeit (Schritt 3 + Satzbau wären 12 Min.), vier Pflichtschritte, Abwechslung. Gegenstimme: weniger feste C1-Prüfungsformate in der Pflicht; Lernwissenschaft prüft vor dem Bau (Frage 1).

**Aufgabenstellungen (Wortlaut-Varianten, damit Überschriften nicht gleich klingen)**: je Schritt ein eigener Kopf (Eyebrow) und eine Anweisungszeile aus 3 Varianten, gewählt per Tages-Hash (deterministisch, nicht per Zufall beim Zeichnen). Vorschläge (Englischlehrer prüft DE und EN):
- Neu: „Präge dir ein: …“ · „Was könnte das heißen?“ · „Wie würdest du es sagen?“
- Wiederholen: „Weißt du es noch?“ · „Zeig, was sitzt.“ · „Kurz erinnern, dann weiter.“
- Grammatik: „Wende die Regel an.“ · „Welche Form passt?“ · „Baue den Satz richtig.“
- Fehler: „Mach es richtig.“ · „Dein Satz von früher.“ · „Finde die Stelle.“
- Spezial: je Art eigene Zeile, z. B. „Phrasal Verb des Tages“, „Redewendung des Tages“.

**Aufgabenbild je Schritt** (Tokens vorhanden, `src/styles/index.css:81-88`, kein neuer Farbwert): Neu = `--lx-ch-cards` (violett), große Wortkarte, 3 Punkte je Wort für die Pässe; Wiederholen = violett gedämpft, Zähler „n von N“; Grammatik = `--lx-ch-grammar` (blau), Eyebrow mit Kapitel; Fehler = `--lx-ch-write` (orange), Gegenüberstellung falsch/richtig; Spezial = `--lx-ch-discover` (limette), gestrichelter Rand als Zeichen „Extra“. Kontrasttest erweitern (alle drei Modi).

## 3. Daten, Planversion, Rückweg, Zählung

**Befund zur Regelversion**: Eine neue Zahl `u.rv = 3` wäre für die Live-Version v75 ein Rückfall auf die alte Regel, denn `readUnitMeta` liest nur `o.rv === 2` (`domain/plan/unitMeta.ts:175`); sonst fehlt `rv`, `planRvOf` ergibt 1 und `unitStepArgs` (`unit/plan.ts:159-165`) würde Fehlersätze in die Wörter-Runde mischen (verbotene Grammatik in Vokabelrunden). Deshalb **`u.rv` bleibt 2** und die neue Form trägt ein eigenes rein ergänzendes Feld **`u.ta = 1`** (Tagesaufbau-Version). `u.v` und `p.v` bleiben 1 (`buildPlan.ts:28` verwirft sonst den ganzen Plan).

Gespeicherter Plan eines neuen Tages (voller Tag, `app/profile.plan`):
```
v:1  duty:['ch:u-new','review','ch:u-focus','ch:u-again']   (Reihenfolge = Anzeige)
goal:{review:<fällig>, due:<fällig>, new:<n>, ahead:0}
u:{v:1, rv:2, ta:1, sp:'phr', shape, goalMin, min,
   b:[[4,'newwords',4],[1,'review',8],[2,'grammar',7,{errs:0}],[5,'again',3,{limit:5}]], gt, ps, ov, sure, c1?, nx?}
```
Blocknummern bleiben im Bereich 1 bis 5 (`unitMeta.ts:103`): Neue Wörter nutzen die freie Nummer 4 mit neuer Art `newwords`; Wiederholen 1, Grammatik 2, Fehler 5, Wochen-Check 3. Satzbau (3) kommt in neuen Plänen nicht mehr vor.

Lesbarkeit durch die Live-Version v75 (aus `unitMeta.ts`, `buildPlan.ts`, `retire.ts`, `rows.ts` gelesen):
- `readPlan` verlangt nur `d`, `v:1`; `readUnitMeta` nimmt jede Art als Text, Blocknummer 1 bis 5, Minuten als Zahl; unbekannte Felder (`ta`, `sp`) und Argumente (`readArgs` kennt nur errs/repairs/limit/mode/fmt) fallen still weg, der Plan bleibt gültig.
- Die Art `newwords` ist für v75 „entfallen“ (`isRetiredKind`, `retire.ts:77`): `forFocus` (`:95-112`) schneidet Block und Pflichtpunkt `ch:u-new` gleichzeitig heraus, Länge von `duty` und `u.b` bleibt gleich. v75 zeigt an so einem Tag drei Schritte (Wörter wiederholen, Grammatik, Fehler korrigieren) mit voller Regel 2; die neuen Wörter holt dort das Wiederholen über `goal.new` (`session.ts:361-362`). Kein Datenverlust, Serie rechnet aus `pflicht[tag]` und `act`.
- Rückrichtung: Pläne ohne `u.ta` (Plan von heute vor der Auslieferung, zweites Gerät mit alter Version) laufen in der neuen App in der alten Vier-Schritt-Form zu Ende; der alte Zweig von `unitPlanFor` bleibt mindestens bis eine Woche nach dem Live-Gang.
- Zweitgerät-Sonderfall: erledigt das alte Gerät die Pflicht, fehlt `act['u-new']`. Selbstheilung: Schritt 1 gilt auch als erledigt, wenn heute mindestens `goal.new` Karten mit `intro = heute` existieren (Prüfung in `healDay`, `features/today/store.ts`), Test.

Rückweg (drei Stufen): (1) Schalter `flags.dayBuild` aus (neu in `app/flags.ts`, je Gerät übersteuerbar wie `chapterRun`): neue Pläne wieder Vier-Schritt, heutiger bleibt gültig. (2) Vorherige Version erneut veröffentlichen (v75 `1791741081-b412` notieren, Emrahs Regel A7): liest neue Pläne laut Test unten. (3) Daten: keine neuen Dokumente, nichts zu bereinigen.

Neue Felder, alle ergänzend: `u.ta`, `u.sp` (Plan); `act[tag]['u-new']`, `act[tag]['u-sp']` (bestehendes Dokument `app/profile`, Schema erlaubt beliebige Schlüssel, `src/data/schemas.ts:118`); `app/profile.spl` = `{phr:'JJJJ-MM-TT', idi, fam, pair, lis, ord}` höchstens 7 Schlüssel (letzter Tag je Art, für die Rotation). Keine Dokumente je Eintrag (A6 Nr. 6). `UNIT_DUTY_CHANNELS` (`channels.ts:50`) bekommt `u-new`; `UNIT_CH_MINUTES` den Rückfallwert 4; `LIVE_KINDS` (`retire.ts:71`) bekommt `newwords` (für die neue App; die Version-v75-Kopie im Test bleibt unverändert).

**Zählung** (Bedeutung unverändert):
- Pflicht = Schritt 1 bis 4 (4 Segmente im Ring). Schritt 1 über `u-new`, Schritt 2 über Protokoll `ctx:'rev'` gegen `goal.review`, Schritt 3 `u-focus`, Schritt 4 `u-again`. Entfallene Schritte (nichts fällig, kein neues Wort) stehen nicht in `duty`, wie heute (`planFor.ts:146`).
- `pflicht[datum]` setzt weiterhin nur `pflichtFor` über `plan.duty` (`dayJobs.ts:138`); `days`, `xpDays`, `minutes`, `act` schreibt `recordRoundEnd` unverändert; Ruhetag je Kalenderwoche, Tageswechsel 04:00 und `pflichtSince` unberührt (`domain/streak.ts`).
- **Schritt 4 „Fehler wiederholen“** zählt wie heute als Pflicht über `u-again`. Neue Fehler, die heute in Schritt 3 entstehen, sind erst morgen fällig (`fehlersaetzeDue` ohne Anlegetag).
- **Schritt 5 Spezial** steht nicht in `duty`: kein Einfluss auf Ring-Zahl, `pflichtFor`, Serie, Ruhetag. Fertig = `act[tag]['u-sp'] = 1` (optimistisch über `markUnitLocal`) plus `spl[art] = Tag`; Antworten laufen als `ctx:'xtra'` (zählt als „Extra“ in `deriveToday`, `buildPlan.ts:223`), Lernzeit zählt in `minutes`. Erledigt ist Zustand (Häkchen, nicht mehr startbar), Kap. 2 Nr. 2.
- Die Antwortzahl „n Wörter neu“ im Abschluss liest weiter `intro = heute`; `Neu sicher` und Meilensteine unverändert.

## 4. Oberfläche

Heute (`features/today/TodayScreen.tsx:174-250`): Ring mit 4 Segmenten (`dutyFills`), Liste mit 4 Pflichtzeilen (Name, Zeile „wozu“, Minuten, Zustand), darunter eine abgesetzte Zeile „Danach · Spezial des Tages: Phrasal Verbs · Extra · 5 Min.“ (gestrichelt, keine Schaltfläche, wird nach Schritt 4 zum Eintrag in `DoneCard3`/`ExtraRow` mit eigenem Zustand). **Ein** großer Knopf wie bisher („Los: Neue Wörter lernen“, `nbHeuteStart`, `nbHeuteContinue`). Titel „Als Nächstes“ nennt den Schritt (`nextTitle`, `:163`). Neue Zeilenfarbe je Schritt über `BlockDot` (`:135`, bisher nur zwei Farben).

Player und Zwischenkarte: Kopf „Schritt n von 4“ (`ExerciseTop` `progress`, `UnitStep.tsx:100`, `UnitCard.tsx:217`); nach Schritt 4 die Zwischenkarte (`UnitCard.tsx:170`) mit Hauptknopf „Zum Abschluss“ und leiser Zweitaktion „Spezial des Tages starten (Extra, 5 Min.)“; im Spezial Kopf „Schritt 5 von 5 · Extra“, gestrichelter Fortschritt. Fünf Punkte in der Schrittleiste, der fünfte gestrichelt. ✕ speichert wie bisher.

Neue Bausteine: `features/unit/frames.ts` (Rahmen je Schritt: Eyebrow-Schlüssel, Anweisungsvarianten, Token), `features/unit/special.ts` (Start und Ende des Spezials, Rückfälle), `features/vocab/NewWordsScreen` bzw. Erweiterung des Trainers um `round: 'neu'`, `domain/unit/special.ts`, `domain/unit/layout.ts` (Zeitentabelle je Form).

Vorgeschlagene i18n-Schlüssel (Präfix `ta`, DE + EN, Wortlaut Vorschlag, Prüfung Englischlehrer; alte `nbHeuteBlock_review/again/grammar/order` und `nbHeuteWhy_*` werden ersetzt, nicht doppelt gehalten):
`taNameNew` Neue Wörter lernen / Learn new words · `taNameReview` Wörter wiederholen / Review words · `taNameGrammar` Grammatik nach Lernpfad / Grammar path · `taNameFix` Fehler wiederholen / Review mistakes · `taNameSpecial` Spezial des Tages / Special of the day · `taWhyNew` {n} neue Wörter für heute / {n} new words for today · `taWhyReview` {n} fällige Karten / {n} cards due · `taWhyGrammar` Kapitel {n} · {topic} / Chapter {n} · {topic} · `taWhyFix` {n} eigene Sätze / {n} of your own sentences · `taWhySpecial` Heute: {kind} / Today: {kind} · `taExtraTag` Extra · zählt nicht zur Pflicht / Extra · not part of today’s goal · `taStepOf` Schritt {n} von {total} / Step {n} of {total} · `taStepSpecial` Schritt 5 von 5 · Extra / Step 5 of 5 · Extra · `taEyebrowNew/Review/Grammar/Fix/Special` NEU · WIEDERHOLEN · REGEL · DEIN FEHLER · SPEZIAL · `taIns_<schritt>_1..3` (Anweisungsvarianten, siehe oben) · `taKind_phr/idi/fam/pair/lis/ord/tempo` Phrasal Verbs · Redewendungen · Wortfamilien · Verwechslungspaare · Hören · Sätze bauen · Tempo-Runde · `taPassDots` Durchgang {n} von 3 · `taProbe` Kennst du das schon? · `taNoNew` Heute keine neuen Wörter im Korb. · `taNoDue` Heute ist nichts fällig. · `taSpecialLater` Danach: Spezial des Tages · `taSpecialStart` Spezial starten (Extra) · `taSpecialDone` Spezial erledigt · `taNoSound` Heute ohne Ton: stattdessen {kind} · `taModeLine` Modus: {mode} ›.

Gestaltung nach Kap. 2 und 8: eine rote Linie, ein Knopf, Pflicht und Extra sichtbar getrennt, Dunkel/Gedämpft/Hell, 390 und 1440 px, Kontrasttest; keine Animation über 300 ms ohne Lerninhalt.

## 5. Risiken, Tests, Pakete

Risiken: (1) Übergangstag und zweites Gerät (siehe 3). (2) Doppelzählung neuer Wörter (`ctx`), Test mit Plan, in dem Schritt 1 und 2 dieselbe Karte berühren. (3) Zeit über 30 Minuten: Zeitentabelle und Simulation mit Obergrenze. (4) Korb leer: Schritt 1 schrumpft oder entfällt; Abhängigkeit von V3 (Zufuhr). (5) Stufen-Aufblähung durch Pässe am selben Tag. (6) Spezial-Inhalt dünn: Wiederholung derselben Aufgaben, Gegenmittel Verfügbarkeitsschwelle und Inhaltschargen. (7) C1-Check-Kopplung (`CHECK_REPLACES = [2, 3]` wirkt nur noch auf Block 2) und Tempo-Metrik (`domain/metrics/tempo.ts`) ohne Pflicht-Format. (8) iPhone-Tastatur: Start jedes Schritts synchron im Klick (`unit/run.ts:172`). (9) Fortsetzen: Momentaufnahme des Trainers muss `round: 'neu'` kennen (`TRAINER_RESUME_ID`). (10) Pflicht ohne KI: Spezial-Arten ohne Claude, Schritt 1 ohne Tutor. (11) Zeitumstellung 25.10.2026 (25-Stunden-Tag) und Tageswechsel 04:00: Plan, `u.sp`, `spl` und Lauf-Tag nutzen `dayKey`, nie `Date` roh.

Tests:
- Unit: `unitPlanFor` Zeitentabelle je Form (voll, kurz, winzig, Sonntag, Check-Samstag, reduced, restart); `buildUnitStored` neue Form; `unitMeta` liest `ta`/`sp`; `forFocus` mit `newwords`; `specialFor` (deterministisch, nie zweimal in Folge, jede Art in 10 Tagen, Verfügbarkeit, Samstag Tempo); Dosis-Aufteilung (`goal.new` + `goal.review`, Bremse, Neustart); Schritt-2-Ausschluss heutiger Karten; Zählung (`deriveToday`, `pflichtFor`): Schritt 5 nie in der Pflicht; Selbstheilung `u-new`.
- Rückweg: neue eingefrorene Kopie des Lesers der Live-Version v75 `tests/unit/fixtures/planV75.ts` (wörtlich, wie `plan8d8f3a3.ts`/`planLp2.ts`) und `planRollbackTagesaufbau.test.ts` nach Muster von `planRollbackV3.test.ts`: alle Formen, `p.v`/`u.v` = 1, `u.rv` = 2, v75-Ansicht hat die drei alten Schritte, Pflicht von v75 erfüllbar, `act`-Schlüssel `u-new`/`u-sp` stören v75 nicht (`unitDonePatch`).
- Langlauf `tests/unit/dayBuildSim.test.ts` (nach `backlogSim.test.ts`): 120 Tage, Tage 1 bis 40 Regel 2, Umschaltung mitten am Tag (Plan bleibt alt), Tage 41 bis 80 neue Form, Rückweg auf Tag 81 (Schalter aus), mit Lücken, Rückstand, leerem Korb, Zeitumstellung 25.10.2026 und 28.03.2027, Wiedereinstieg. Prüft: Serie identisch zu einer Vergleichsrechnung nur aus `pflicht[]`, nie ein Tag ohne erfüllbare Pflicht, Minuten je Tag unter Obergrenze, mindestens 2 neue Wörter an Tagen mit Korb, Berg Überfälliger höchstens 81 und Treffquote reifer Karten mindestens 0,87 (Maßstab `backlogSim`), Spezial-Verteilung.
- E2E: `dayBuild.spec.ts` (Heute: 4 Zeilen + Hinweiszeile, ein Knopf, Ring 4 Segmente), `newWords.spec.ts` (Vorabfrage, Einführung, drei verschiedene Familien, Zähler, Fortsetzen), `special.spec.ts` (Start erst nach Schritt 4, Zustand erledigt, Rückfall ohne Ton), Rückweg-E2E (Plan mit `ta` in Dev-Adapter, Seite zeigt alte Form mit Schalter aus), angepasste `today.spec.ts`, `today-duties.spec.ts`, `planWeek.spec.ts`; Handy 390 px und Desktop, drei Modi, DE und EN, axe.

Arbeitspakete (Größe, Prüfer; höchstens 2 bis 3 Agenten gleichzeitig, Prüftore G0 bis G4 laut `arbeitsweise.md`):

| Paket | Inhalt | Größe | Prüfer |
|---|---|---|---|
| T0 | Entscheidungen, Rückweg-Leser v75 einfrieren, Typen `ta`/`sp`/`newwords`, Zeitquelle W (V0-a) | S | data-guard |
| T1 | Domäne: `layout.ts`, `unitPlanFor`/`buildUnitStored`/`unitMeta`/`retire`/`rows`, Dosis-Aufteilung in `review.ts`, Selbstheilung, Rückweg- und Planer-Tests | M | data-guard, learning-scientist (Dosis, Zeit) |
| T2 | Schritt 1: `round: 'neu'`, Warteschlange, Pässe, Buchung `ctx:'duty'`, Fortsetzen, Schritt-2-Ausschluss | L | learning-scientist, english-teacher (Texte), ux-reviewer |
| T3 | Schritte 2 bis 4 umrahmen: Namen, Rahmen, Wortlaut, Modus-Zeile, Fehler wiederholen | M | english-teacher, ux-reviewer |
| T4 | Spezial: `special.ts`, `spl`, Start/Ende, Rückfälle, Verfügbarkeit, Extra-Zustand | M | learning-scientist, data-guard |
| T5 | Heute, Player, Zwischenkarte, Abschluss, i18n DE+EN, Kontrast | M | ux-reviewer, english-teacher |
| T6a–c | Inhalt: Phrasal Verbs (+95), Idioms (Drill + 50), Verwechslungspaare (Art `pair` + 60 Paare); Chargen höchstens 40 | M je Charge | english-teacher 100 %, learning-scientist |
| T7 | Langlauf, E2E, Zeitumstellung, Rückweg, G4, Test-Link | M | qa-runner, platform-guard, data-guard |

Reihenfolge: T0, T1 (parallel T6a), T2 (parallel T3), T4 (parallel T6b/c), T5, T7. `pair` und `idi` gehen erst nach T6b/c in die Rotation; bis dahin springt die Auswahl über sie hinweg. Ein Test-Link nach T7; Live nur nach „Ja live nehmen“ (A7), Rückweg v75 notieren.

## 6. Zusammenspiel mit Vokabel-Plattform (V0 bis V7) und Qualitätstor Q
- **Zuerst Q** (Entscheidung 12.10.2026): Q1 Wächter im Programm, Q3 strengere KI-Annahme und Q5 Regel-Test je Fehlerklasse müssen vor dem Test-Link von T2/T4 stehen, weil Schritt 1 dieselbe Karte dreimal hintereinander in neuen Aufgaben zeigt und das Spezial neue Aufgabenflächen öffnet. Q2 (Audit mit Emrahs echten Karten) läuft vor dem Test-Link über alle Arten von Schritt 1, Q4 („Aufgabe melden“) gehört in denselben Link.
- **V0-a** (eine Zeitquelle, Wortschatz-Minuten 12) wird in T0 vorgezogen, weil Schritt 1 und 2 sie teilen. V0 Rest (Grenzen, Atlas nachzählen, Langzeit-Simulation) unabhängig.
- **V1** (Sammeldokumente `vs/<seg>`) nicht Voraussetzung; Schritt 1 liest Karten über `allTrainCards`. Wird V1 später gebaut, ändert sich nur die Kartenquelle.
- **V2** (zwei Spuren) setzt auf T auf: aktive Spur = Schritt 1 (Standard 3), passive Spur (E→D aufdecken, 6 bis 8) wird später Teil B von Schritt 1 oder ein eigener Pflichtteil; Plan-Hook ist `goal.new` (aktiv) plus ein weiteres additives Feld; die 30-Minuten-Grenze wird dort neu verhandelt.
- **V3** (Zufuhr/Atlas-Vorsortierung) sichert den Korb für Schritt 1.
- **V5** (Blutegel einheitlich) wirkt in Schritt 2. **V6** (Hören am Handy, Verwechslungspaare dauerhaft) erweitert Spezial `lis` und `pair`. **V7** (Inhalte Atlas) liefert Wortpartner/Familie für Schritt-1-Pässe und `fam`.
- Reihenfolge: Q, T0/T1 (parallel V0), T2 bis T5, Test-Link, dann V1, V2, V3 in der Reihenfolge des Vokabel-Plans.

## 7. Offene Fragen an Emrah (höchstens drei)
1. **Satzbau und die Prüfungsübungen (Kleines Wort, Umformen, Passendes Wort, Tempo-Runde):** Bisher waren sie ein fester Pflichtschritt. Sollen sie aus der Pflicht heraus und als Abwechslung in „Spezial des Tages“ auftauchen? Empfehlung: ja. Satzbau kommt als sechste Spezial-Art dazu, samstags gibt es die Tempo-Runde als Spezial, die Regelübungen im Grammatik-Schritt mischen die Prüfungsarten weiter mit. So bleiben es vier Pflichtschritte und etwa 30 Minuten mit Spezial.
2. **Spezial schon vor dem Ende der Pflicht startbar?** Empfehlung: nein. Davor steht nur eine Hinweiszeile („Danach: Spezial des Tages“), den Start gibt es erst nach Schritt 4, damit nur ein großer Knopf bleibt und die Pflicht zuerst kommt.
3. **Sonntag und kurze Tage:** Sollen auch dort täglich neue Wörter kommen? Empfehlung: ja, dann 2 bis 3 Wörter (an kurzen Tagen und sonntags bleiben Schritt 3 und das Spezial schlank: Sonntag Wochen-Check wie heute, kein Spezial).
