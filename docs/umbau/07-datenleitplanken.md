# 07 – Datenleitplanken für den Umbau (Fokus Vokabeln + Grammatik, Wortschatz-Atlas mit ~8.000 Einträgen)

Stand 04.10.2026 (Commit `31a5975`) · Autor: data-guard · **Nur gelesen:** kein Code geändert, keine Test- oder Build-Läufe (Messwerte am Seed mit einem Wegwerf-Skript im Scratchpad).
Grundlage: Kap. 9, CLAUDE.md A6/A7, `docs/datenstruktur.json`, `docs/datenmodell.md`, `contract/db.d.ts`, `src/data/*`, `src/domain/{migration,plan,streak,date}`, `seed/sample-data.json`.

**Urteil:** Der Umbau ist datenseitig sicher machbar, wenn er nur **Oberfläche und Logik** entfernt und **jeden Pfad, jedes Schema und jede Registrierung stehen lässt**. Ohne Gegenmaßnahme sind zwei Dinge ein ALARM: (a) ein Dokument je Atlas-Wort, (b) das Löschen von Schemas oder Pfaden ausgeblendeter Funktionen (Sicherung und Rettung würden Daten still übergehen).

---

## 0. Die 10 wichtigsten Leitplanken

| # | Leitplanke | Beleg / Folge |
|---|---|---|
| L1 | **Das Register bleibt vollständig.** Kein Eintrag aus `APP_DOCS`/`COLLECTIONS` und kein Schema wird entfernt (auch nicht für Lesen, Hören, Entdecken, Schreiben, Preply, Business, Sprechen). Weg darf nur Code in `features/` und `domain/`. | `paths.ts:46-102`. Sicherung (`snapshot.ts:75`), Diagnose (`reads.ts:83`) und Rettung (`rescue.ts:115`, sonst `unknown_path`) laufen über genau dieses Register. Wer ein Schema löscht, löscht nichts in der Datenbank, aber die Daten fehlen danach in der Sicherung. |
| L2 | **Nichts löschen, nichts ersetzen.** Kein `delete()`, `set` nur auf fehlende Pfade, Bestehendes nur feldweise per `update`/`transform`. Ausnahmen bleiben die zwei vorhandenen: `app/lookup` (replace, nur Zwischenspeicher) und `app/profile` (compact, ausgeschaltet). | `writer.ts:85,87,166-190`; heute keine `.delete()` im Quelltext außerhalb des Entwicklungs-Adapters. Entfernte Funktionen schreiben nur nichts mehr. |
| L3 | **Alte Felder bleiben die Wahrheit.** Neues nur zusätzlich, tolerant (`looseObject`, `.nullish()`), unbekannte Felder durchreichen. Keine Umbenennung, kein Umcodieren (`S`, `D`, `due`, `stage`, `days`, `pflicht` …). | Kap. 9 R2/R6; `schemas.ts:13-20`. |
| L4 | **Serie hängt an Tatsachen, nie an der aktuellen Pflichtliste.** `pflicht[tag]` (nur setzen, nie entfernen) + `pflichtSince` (einmal, nie ändern). Jede Pflichtart zählt in `days` oder `xpDays` (Vorbedingung von `pflichtFor`). Planformat nur additiv (`v: 1`, Blocknummern 1–5). Nicht mehr ausführbare Pflichtpunkte eines alten gespeicherten Plans: abgeleitete Ansicht (Muster `forPhone`), nie den gespeicherten Plan umschreiben. | `pflicht.ts:49-60,120-125`, `streak.ts:36-79`, `unitMeta.ts:9`, `phone.ts:12-16,42-57`. Siehe Abschnitt 2. |
| L5 | **Ein Datumsschlüssel, eine Funktion:** nur `domain/date.ts` (`dayKey`, Wechsel 04:00, `legacyDayKey` bis `pflichtSince`). | Zwei Abweichungen heute: `weekly.ts:126-130`, `chunkCards.ts:113-117`. Nächste Zeitumstellung: **25.10.2026**. |
| L6 | **`daily/*` und `feed/*` nie schreiben**, beide Formate unverändert lesen; `dailySchema`/`feedSchema` bleiben. | `writer.ts:130-136`, `paths.ts:114`, `writer.test.ts:44`. |
| L7 | **Atlas = statische Datei im Bundle + Lernstand nur für angefangene Wörter, gebündelt in Teilstücken** (≤ 80 Dokumente für 8.000 Wörter). Nie ein Dokument je Wort. Atlas-IDs sind unveränderlich. | Abschnitt 4. |
| L8 | **Eine Karte, ein Ort.** Vorhandene `vocab/<id>`/`chunk/c-<id>` (auch ungültige) gewinnen immer. Eine einzige Funktion `hasCard(id)` in `src/data` für alle Anlegewege (Atlas, Tagesauftrag, Wort-Antippen, Lehrer-Feedback, C1-Paket, Übersetzer). | `dailyIntake.ts` (`known`), `pack.ts` (`packState`), `newCard.ts`. Sonst entstehen doppelte Karten. |
| L9 | **Kapazität hart messen:** ≤ 5.000 Dokumente (Warnung ab 3.500 statt 4.000), ≤ 200 KiB je Dokument (vor jedem Schreiben `jsonBytes` prüfen), jede gelesene Sammlung ≤ 900 Dokumente (die App geht von einem 1.000er-Fenster aus), wachsende Ströme gedeckelt. Zeitgetriebene Ströme (log, daily, feed) zählen mit. | `db.d.ts:418-427`, `profileSize.ts:12-14`, `snapshot.ts:78`, `reads.ts:61`. Siehe Abschnitt 4. |
| L10 | **Schreiben nur über `src/data/writer.ts`**, nur bei echter Änderung, je Dokument eine Operation zur Zeit, nie aus Render/Snapshot/Timer. Jeder neue Pfad hat vorher: Schema, Register-Eintrag, Seed-Beispiel, Test. | `writer.ts:92-105` (Warteschlange je Pfad), `db.d.ts:279-286`. |

---

## 1. Datenpfade in Gruppen

Definition: **G1** = wird weiter beschrieben. **G2** = nur lesen und aufbewahren (Oberfläche liest sie weiter: Stand, Verlauf, Serie, alte Pläne, Rückweg). **G3** = ausblendbar (keine Oberfläche liest sie mehr; Sicherung, Rettung und Diagnose zählen sie weiter mit). In G2 und G3 bleiben Schema, Register-Eintrag und Seed-Beispiel bestehen.

### G1 – weiter beschrieben

| Pfad | Zweck | Anmerkung |
|---|---|---|
| `app/profile` | Serie und Zähler: `days`, `xpDays`, `minutes`, `act`, `pflicht`; Tagesplan `plan`; `history` (≤ 120), `lxSeq`, `xp`, `answers`, `vAnswers`, `gAnswers`; Einstellungen `lang`, `theme`, `voice`, `rate`, `goal`, `goalMin`, `newPerDay`, `sound`, `haptic`; `canDo`, `ema`, `n`, `sprints`, `vtests`, `checks`, `lap`, `name`, `created`, `ctx` | Ein Dokument für die Serie: nie `set`, nur Sammel-Warteschlange (`features/progress/persist.ts`) und `transform`. |
| `app/schema` | Versionsvermerk (`version`, `cutover`, `migratedAt`), `pflichtSince` | Nur `update`/`transform`. `v1.ts:233` nutzt beim ersten Lauf `set` (geschützt durch `isDone`, `v1.ts:169-175`). |
| `vocab/<id>`, `chunk/<id>` | Karten (Wörter, Wendungen) mit FSRS | Bleiben vollständig. Neue Karten nur anlegen (`createIfMissing`/`transform` mit `set`), nie ersetzen. |
| `grammar/<topicId>` | Lernstand je Grammatikthema (`p`, `n`, `c`, `due`, `errors[]`, `hist`, `seen`, `seenText`) | 16 alte + 7 `c1-*` Themen, Anlegen erst bei Gebrauch. |
| `log/<tag>` | Tagesprotokoll (≤ 300 Einträge je Tag) | Zählt „Wiederholen“ und Trefferquote. |
| `app/repair` | „Fehler korrigieren“ (Reparatur-Sätze, Boxen 1/3/9) | ≤ 150 Einträge, ≤ 200 KiB (`repair.ts:13,96`). |
| `app/radar` | Fehler-Radar | Neue Ereignisse nur noch aus Grammatik/Vokabeln/Satzbau. ≤ 400. |
| `app/pool` | Warteschlange Grammatikaufgaben (≤ 90), `lxDaily` = verarbeitete Tagesaufträge | Hängt am Tagesauftrag (Abschnitt 7). |
| `app/lookup`, `app/chat`, `app/memory` | Wörterbuch-Zwischenspeicher (≤ 400), „Claude fragen“ (≤ 40 Nachrichten), „Claude merkt sich“ (≤ 40) | Übersetzer und „Claude fragen“ bleiben. |
| `app/decks`, `app/week`, `app/levels`, `app/patterns`, `app/weekly`, `app/assess` | Stapel, Wochenthema, Stufen je Aufgabenart, Deutsch-Fallen, Wochenbericht (≤ 26), KI-Einschätzung (Hülle `{d,t,lang,answers,writings,data}`) | `app/assess` weiter in Hüllen-Form (A6.10); `dims` darf kürzer werden, alte Berichte bleiben. |
| `archive/profile-<JJJJ>` | ausgelagerte Profiljahre | Serie und Verlauf lesen sie mit (`live.ts:26`). Abo bleibt. |
| `daily/<tag>` | Grammatikaufgaben und Wörter vom Claude-Tagesauftrag | **nur lesen**, die Routine schreibt (L6). Wird weiter verarbeitet (Abschnitt 7). |
| neu: `vs/<segment>`, `app/atlas` | Atlas-Lernstand, Atlas-Einstellungen | Abschnitt 4 und 5. |

### G2 – nur lesen und aufbewahren

| Pfad | Zweck | Warum noch gelesen |
|---|---|---|
| `app/course`, `lesson/<id>` | Kursstand l01–l24 (+ l25 ff.) | **Entscheidung des Konzepts:** bleibt der Kurs, dann G1. Entfällt er, dann G2: `lessonDoneOn` (`pflicht.ts:56`) wertet alte Pläne aus, Stand zeigt den Kurs, Rettung ergänzt `app/course` (`rescue.ts:81-87`). |
| `feed/<tag>` | Beiträge des Tagesauftrags | Nur der Tagesauftrag schreibt. Die App liest nach dem Umbau nichts mehr daraus (Abschnitt 7). |
| `app/profile`-Altfelder: `disc`, `gen`, `listen[]`, `feed[]`, `mix`, `seen15`, `tour11`, `autoNext` und alte `act`-Schlüssel (`read`, `listen`, `write`, `discover`, `speak`, `biz`, `say`, `fluency`, `tones`, `u-in`) | Verlauf und Heatmap | Vorhandene Tageskarten bleiben unverändert. |
| `app/compare` | monatliche Vergleichsaufgabe (Sprechen/Schreiben) | Verlauf. |
| `app/week.preplyNext`, `app/week.hint`, `app/decks.flagged` | Preply-/Termin-Reste | Werden tolerant gelesen, nicht mehr ausgewertet. |
| `teacher/<Monat>` | Lehrer-Feedback | **Entscheidung:** bleibt „Lehrer-Feedback einfügen“ (liefert Wörter und Korrekturen), dann G1. |

### G3 – ausblendbar (Daten bleiben, nichts liest sie mehr)

`articles/*` (Lesen) · `reading/*` (Leseergebnisse) · `lpool/*` (Hörtexte) · `wprompt/*` (Schreibaufgaben) · `writing/*` (Schreiben) · `preply/*` (Preply-Pläne und -Importe) · `scene/*` (Rollenspiel-Szenen) · `talk/<Monat>` (Gespräche) · `biz/<Monat>` (Business-Einheiten) · `say/<Monat>` („Sag es“) · `fluency/<Monat>` · `meeting/<Monat>` · `tones/<Monat>`.

**Regeln für G2/G3:** (1) kein Code darf sie löschen, kürzen oder „aufräumen“; (2) kein Abo, kein `get()` mehr, wenn nichts sie anzeigt; (3) Schema und Register-Eintrag bleiben (L1); (4) Seed behält je ein Beispiel (der Superset-Test aus Abschnitt 6 braucht sie); (5) der Sicherungs-Test muss sie enthalten.

---

## 2. Serie und Pflicht (A6.13, A7)

**Wie die Serie heute rechnet:** `computeStreak` (`streak.ts:44-79`). Vor `pflichtSince` zählt die alte Regel (`days[k] > 0` oder `xpDays[k] > 0`), ab `pflichtSince` zählt ein Tag, wenn `pflicht[k]` gesetzt ist (am Tag `pflichtSince` selbst zusätzlich die alte Regel). Ein Ruhetag je ISO-Woche (Mo–So) bricht die Serie nicht, nur für Tage ab `pflichtSince`, nicht ansparbar (`streak.ts:70`). Zwischen 0 und 4 Uhr beginnt die Zählung am Kalendertag der alten App, wenn dort Aktivität liegt (`streak.ts:47-54`).

**Warum Änderungen der Pflichtpunkte die Serie nicht berühren:** vergangene Tage stehen als Tatsache in `app/profile.pflicht` (`healPflicht` setzt nur, nie 0, nie entfernen: `dayJobs.ts:134-135`). Neue Pflichtlisten wirken nur auf **künftige** Tage.

Leitplanken:

1. **Pflicht-Tatsachen sind unantastbar.** Keine Neuberechnung vergangener Tage, kein Entfernen oder Auf-0-Setzen von `pflicht[...]`, kein Verändern von `days`/`xpDays`/`minutes`/`act` vergangener Tage (auch nicht „aufräumen“ der Lesen-/Hören-Schlüssel). `pflichtSince` wird nie neu gesetzt und nie geändert (`pflicht.ts:120-125`); `app/schema` nur per `update`.
2. **Der Tagesplan bleibt „einmal je Lerntag gespeichert“** und enthält nur Kanal-Kennungen und Begründungs-Schlüssel (`why`), keine Texte; er wird nie bei jedem Neuzeichnen neu berechnet (`buildPlan.ts:132-139`: ein gespeicherter Plan von heute bleibt immer unverändert, die neue Pflicht gilt erst ab dem Folgetag).
3. **Planformat nur additiv.** `plan.v` bleibt `1`, `u.v` bleibt `1`, Blocknummern bleiben 1–5 (`unitMeta.ts:9`), neue Blockarten sind nur neue Zeichenketten in `u.b`. Grund: `readPlan` (`buildPlan.ts:28`) liefert bei `v ≠ 1` `null`; dann baut ein veralteter zweiter Tab einen neuen Plan (`buildPlan.ts:136-146`) und `storePlan` schreibt ihn per `update({plan})` über den gespeicherten (`today/store.ts:225-243`, `update` verschmilzt Objekte, ersetzt Arrays wie `duty` ganz).
4. **Der Umstellungstag ist die Gefahrenstelle.** Am ersten Lerntag mit der Umbau-Version kann ein gespeicherter Plan der alten Form vorliegen (Blöcke `input.*`, `task.say`/`roleplay`/`tones`, `focus`, Kanäle `ch:u-in`, `ch:u-task`, `ch:u-focus`, `ch:u-check`). Beachten: `ch:u-focus` und `ch:u-task` bedeuteten vorher etwas anderes als im Plan vom 04.10. (`week/plan.ts:38-44,95-103`). Gezählt wird nur `act[tag]['u-…'] ≥ 1` (`pflicht.ts:57-58`). **Regel:** Ein gespeicherter Plan mit nicht mehr ausführbaren Blockarten wird als **abgeleitete Ansicht** gelesen (wie `forPhone`: `duty` bleibt gleich lang, derselbe Pflichtkanal, nur Art und Minuten des Blocks ändern sich, der gespeicherte Plan bleibt unberührt). `pflichtFor`, Statuszeile, Zähler und Knopf lesen dieselbe Ansicht (Kap. 2.2 „keine Widersprüche“). Eine Pflicht darf nie unerfüllbar werden (`storedUnitPlan` fällt heute auf eingefrorene Blöcke zurück: `unit/plan.ts:74-89`, die Blockanbieter dafür dürfen nicht ersatzlos gelöscht werden).
5. **Jede Pflichtart bucht Aktivität.** `pflichtFor` verlangt `days > 0` oder `xpDays > 0` oder Stapelaktivität (`pflicht.ts:51`; `healPflicht` setzt `batchActivity: false`, `dayJobs.ts:135`). Satzbau, Grammatikrunde und „Fehler korrigieren“ müssen also `answers`/`days`/`xpDays` mitzählen, sonst bleibt ein vollständig erledigter Tag ohne `pflicht[tag]`. Auch die alten Schlüssel (`days`, `minutes`, `act`, Tagesbild `history[]` mit allen Feldern, fehlende Kanäle als `0`) werden weiter geschrieben (A6.13).
6. **Pflicht ohne KI und ohne Sprachausgabe erfüllbar** (`dutiesFeasible`, `pflicht.ts:63-77`): Wortschatz, Grammatikrunde, Satzbau (fester Pool, `lernen.tsx:107`) und „Fehler korrigieren“ (lokal prüfbar) erfüllen das; neue Blockarten brauchen einen Rückfall ohne KI.
7. **Ruhetag und Tagesgrenze:** Ruhetagsregel (ein Tag je ISO-Woche, `isoWeek`, `date.ts:50-58`) und 04:00-Grenze (`dayKey`, `date.ts:12-18`) bleiben wörtlich. Was sich ändern darf: welche Blöcke ein Wochentag hat (z. B. Sonntag, `week/plan.ts:83-88`). Ein Block, der vor 04:00 beginnt und danach endet, wird über `healDay` dem richtigen Tag zugeordnet (`today/store.ts:384-389`). Der Wochenstreifen nutzt `restDays` aus `computeStreak` (`streak.ts:113-127`), nicht eine zweite Rechnung.
8. **Streak-Äquivalenz als Test (Abschnitt 6, D14):** Dasselbe Profil mit alter und neuer Plan-Struktur ergibt dieselbe Serie; ein gespeicherter alter Plan lässt sich mit der neuen Oberfläche vollständig abschließen und setzt `pflicht[heute]`.

Empfehlung zum Zeitpunkt: Umbau nach 04:00 an einem Tag live nehmen, an dem Emrah die Pflicht schon erledigt hat, oder direkt vor dem ersten Öffnen. Dann liegt kein halber alter Plan vor. Die Regel 4 gilt trotzdem (zweites Gerät, zweiter Tab mit altem Stand).

---

## 3. Sicherung, Export und Umstellungs-Rettung

**Sicherung (`exportData.ts:15-41`)** liest über `loadSnapshot` **jedes Dokument jeder registrierten Sammlung** und gibt es unverändert aus, dazu `schemaVersion`, `documentCount` und – wenn vorhanden – `browserCopies` (die Kopien der alten App aus `sw2:`). Muss so bleiben und zusätzlich enthalten:

- alle neuen Sammlungen (`vs`) und `app/atlas` – nur wenn sie im Register stehen (L1/L10). Der Test aus D17 vergleicht die Pfadmenge der Datenbank mit der der Sicherung.
- `atlasVersion` (Inhaltsversion der statischen Atlasdatei, Abschnitt 4), damit eine Wiederherstellung die Wort-IDs zuordnen kann. Die Atlasdatei selbst liegt in der App und nicht in der Sicherung.
- einen Hinweis, wenn eine Sammlung genau 1.000 Dokumente lieferte (heute fehlt er in der Sicherung, siehe Befund B2).
- die CSV-Ausgabe für Anki (`exportData.ts:43-49`) liest die Live-Sammlung `vocab`; sie muss die virtuelle Karten-Sammlung (Altkarten + Atlas-Karten) benutzen.

**Umstellung v1 (`v1.ts`, `SCHEMA_VERSION = 1`)** bleibt unverändert lauffähig: Trockenlauf (`planMigrationV1` schreibt nichts), Bestätigung, `acquire`-Lease (`v1.ts:177`), idempotent (`v1.ts:169-175`), `fsrs` je Karte nur zusätzlich, Serie vorher/nachher im Bericht. Der Umbau braucht **keine v2**, solange alles additiv und träge angelegt wird (L3, Abschnitt 5). Eine v2 ist nur nötig, wenn **bestehende Dokumente umgerechnet** werden sollen (z. B. FSRS-Startwerte je Grammatikthema aus `p`, `due`, `errors[].box`). Dann gelten wieder alle Regeln aus Kap. 9 R3/R5: Trockenlauf-Bericht, Emrahs Bestätigung vor dem Schreiben, `acquire`, idempotent, Umrechnung dokumentiert (Muster `docs/fsrs-umrechnung.md`), `update` statt `set` auf `app/schema` (sonst geht `pflichtSince` verloren), Test auf dem Seed.

**Rettung der Browser-Kopien (`rescue.ts`, `applyRescue.ts`, `lateRescue.ts`, `LateRescueCard.tsx`, `lx:legacy-rescue`)** bleibt vollständig, bis auf iPhone **und** MacBook keine offene `sw2:__dirty`-Kopie mehr liegt:

- Die Rettung klassifiziert über das Register (`rescue.ts:115`). Pfade ausgeblendeter Funktionen (z. B. ein altes `writing/…` aus `sw2:`) müssen klassifizierbar bleiben (L1), sonst bleibt die einzige Kopie im Browser liegen.
- Automatisch übernommen wird weiter nur: fehlende Dokumente anlegen, `app/profile` (`days`/`xpDays`/`minutes`/`act` je Tag mit Maximum, Zähler nur nach oben, `rescue.ts:53-79`), `app/course` (nur fehlende Lektionen, `rescue.ts:81-87`). Das gilt auch dann, wenn der Kurs aus der Oberfläche verschwindet.
- `daily/*` und `feed/*` bleiben `read_only` (`rescue.ts:117`).
- Schreiben in einem Schritt (`writer.transform`), nie Neueres überschreiben, ungültiges Datenbank-Dokument nie anfassen (`db_invalid`).

---

## 4. Kapazität und Speichermodell für den Wortschatz-Atlas

Grenzen laut Vertrag (`contract/db.d.ts:418-427`, A6.6): **≤ 5.000 Dokumente je Artefakt**, **≤ 256 KiB je Dokument** (32 Ebenen), 64 Abos je Ansicht, `limit(n)` nur 1–1.000 (`db.d.ts:376-379`). Abfragen scannen die Sammlung ohne Index; der Vertrag empfiehlt „Hunderte bis niedrige Tausende“ Dokumente je abgefragter Sammlung (`db.d.ts:361-363`).

### 4.1 Stand heute

- **Seed** (`seed/sample-data.json`): **211 Dokumente** (`docs/datenmodell.md:59` nennt noch 196, veraltet): 138 `vocab` (im Mittel 0,8 KiB, alle Stufen 0–5; Kap. 3.3 verlangt ~150, der Startwortschatz überlagert, nicht nachgezählt), 12 `grammar`, 14 `log`, 6 `lesson`, 4 `feed` (bis 19 KiB), 3 `daily`, 7 `chunk`, `app/profile` 9 KiB für 31 Tage. Der Seed ist bewusst im **alten Format** (keine `fsrs`, kein `app/schema`), damit der Umstellungstest etwas zum Umstellen hat.
- **Emrahs echte Datenbank:** Zahl **nicht bekannt**; `docs/datenmodell.md:59` rechnet 1.000–1.500 nach einem Jahr. Einstellungen → Diagnose zeigt die Dokumentenzahl je Sammlung (`countDocuments`, `reads.ts:72-91`). **Diese Zahl vor der Feinplanung ablesen lassen.**

### 4.2 Wachsende Pfade

| Pfad | Wachstum | Deckel heute | Anmerkung |
|---|---|---|---|
| `log/<tag>` | +1 Dokument je Lerntag (~365/Jahr) | 300 Einträge je Tag | Anzahl der Dokumente unbegrenzt. |
| `daily/<tag>` | +1 je Tag (Routine, ~2 KiB) | – | `readCollection('daily')` liest alle (`dayJobs.ts:33`); ab 1.000 Dokumenten Rückfall auf die letzten 30 Tage (`dayJobs.ts:35-44`). |
| `feed/<tag>` | +1 je Tag (Routine, bis 19 KiB) | – | **Nach dem Umbau ohne Leser** (Abschnitt 7). |
| `vocab/<id>`, `chunk/<id>` | 1 Dokument je Karte | – | Bei 4–5 neuen Wörtern/Tag +1.500–1.800/Jahr, wenn jede Atlas-Karte ein Dokument wäre. |
| `app/profile` | ~130 B/Tag (114 B Tageskarten + `pflicht`), ≈ 47 KB/Jahr (gemessen am Seed) | `history` ≤ 120 | Warnung ab 128 KiB, Auslagern ab 160 KiB (`profileSize.ts:12-14`); `COMPACT_ENABLED = false` (`compactRun.ts:13`). Reicht rechnerisch für mehrere Jahre. |
| `app/radar` / `lookup` / `chat` / `repair` / `pool` / `weekly` / `memory` | gedeckelt | 400 (≤ 240 KiB, `domain/grammar/radar.ts:8`) / 400 / 40 / 150 (≤ 200 KiB, `domain/repair/repair.ts:13,96`) / 90 / 26 / 40 | `app/repair` wirft beim Überlauf die ältesten Einträge heraus (`repair.ts:100-105`); bei „Fehler korrigieren“ als Kernblock beobachten. |
| `out/<Monat>`, `teacher/<Monat>` | 1 Dokument je Monat | 400 / 200 Einträge, < 200 KiB | |
| `grammar/<id>` | einmalig 23 (16 + 7 `c1-*`) | – | Neue Themen: höchstens einige Dutzend. |

### 4.3 Hochrechnung (Dokumente je Jahr, Zahl Emrahs N0 noch offen)

| Modell | Zuwachs/Jahr | 5.000 erreicht (bei N0 = 1.000) |
|---|---|---|
| A: ein Dokument je angefangenem Atlas-Wort | 3 × 365 + 1.800 + ~30 ≈ **2.900** | nach **~1,4 Jahren**; zusätzlich reißt `vocab` das 1.000er-Fenster |
| B: Teilstücke (Abschnitt 4.4) | 3 × 365 + ~30 + einmalig ≤ 80 ≈ **1.150** | nach **~3,5 Jahren** |
| C: wie B, Routine schreibt keinen `feed` mehr | ≈ **750** | nach **~5 Jahren** |

Schon ohne Atlas laufen log/daily/feed mit ~1.100 Dokumenten im Jahr auf die Grenze zu. Der Atlas darf deshalb keinen weiteren Strom in Dokumenten je Eintrag erzeugen (A6.6).

### 4.4 Vorgeschlagenes Speichermodell: Inhalt im Bundle, Lernstand in Teilstücken

**1. Inhalt (nicht in der Datenbank).** `src/content/atlas/…` im Bundle.
- Eintrag: `id` (unveränderlich, = Karten-ID = `slug(en)`, bei gleicher Schreibweise mit Wortart-Suffix, z. B. `present-noun`), `en`, `pos`, `de`, `def`, `ex` (Ursprungssatz **Pflicht**, Kap. 15), `band` (1–8), `fam` (Wortfamilie), `reg`, `seg` (Teilstück, z. B. `b3-04`, fest zugeordnet).
- Größe: das C1-Paket braucht ~305 B je Eintrag (`pack.json`: 76 KB für 250). 8.000 Einträge ≈ **2,4 MB** roh; dist heute 3,7 MB, Grenze 16 MB. Kompakte Form (Tupel je Band als JSON-Zeichenkette) und **erst beim Öffnen des Atlas parsen**, nicht im Start (Kap. 14: < 2 s bis zur Heute-Ansicht).
- **Nur anhängen, nie umnummerieren, nie entfernen** (ein veralteter Eintrag bekommt `retired: true`). Ein eingechecktes Manifest `atlas.ids.json` listet alle je veröffentlichten IDs samt `seg`; ein Test prüft Eindeutigkeit, Format, dass nichts fehlt und dass `seg` unverändert ist (D18).

**2. Lernstand (Datenbank): neue Sammlung `vs`.** Ein Dokument je Teilstück = 100 Wörter eines Bandes (`vs/b3-04`).
- **Obergrenze 8.000 / 100 = 80 Dokumente**, auch wenn jedes Wort angefangen ist. Das schont 5.000-Grenze und 1.000er-Fenster; ein Abo auf `vs` (+1 Abo, `live.ts:26`).
- Größe: eine Karte ohne Texte (`S`, `D`, `due`, `last`, `reps`, `lapses`, `state`, `stage`, `intro`, `hist` ≤ 12, `xs`, `fsrs`) ≈ **690 B** (am Seed gemessen: 509 B Planungsfelder + 162 B `fsrs` + Schlüssel). 100 Karten ≈ **67 KiB**, Obergrenze des Dokuments 200 KiB (≈ 290 Karten). `de`/`def`/`ex`/`pos` werden nicht kopiert (stehen im Atlas). Vor jedem Schreiben `jsonBytes` prüfen, wie bei `app/repair` (`domain/repair/repair.ts:96-105`); bei Überschreitung Hinweis statt Schreiben. **Startlast:** Das Abo liefert alle Teilstücke auf einmal (≈ 0,7 KB je angefangenem Wort, 4.000 Wörter ≈ 2,8 MB); im Großdatensatz messen (Ziel Kap. 14: < 2 s bis zur Heute-Ansicht), `fake=large` entsprechend um Atlas-Karten erweitern.
- Form: `w` ist ein **Objekt** `{ <karten-id>: { k?, c?, t } }` (nicht ein Array): `update` verschmilzt Objekte rekursiv, Arrays ersetzt es ganz (`db.d.ts:289-296`). So überschreiben sich zwei Geräte nur beim selben Wort, nie das ganze Dokument. `k` = Atlas-Kennzeichen (1 „kenne ich“ · 2 „später“ · 3 ausgeblendet), `c` = Karte (nur wenn eingeführt, mit denselben Feldnamen wie `vocab`, damit `buildTrainCards`, `applyReview` und die Wortliste ohne Umbau laufen).
- Schreibweg: `writer.transform('vs/<seg>', cur => cur ? { update: { w: { [id]: patch } } } : { set: { v: 1, seg, w: { [id]: patch } } })`. Anlegen eines Teilstücks nur beim ersten eingeführten Wort (einmalig ≤ 80 `set` auf fehlende Pfade). Antworten innerhalb ~1–2 s zu **einem** Schreibvorgang je Teilstück bündeln (`db.d.ts:283-286`); je Teilstück läuft ohnehin nur eine Operation zugleich (`writer.ts:92-105`).
- **Keine Zähler als Wahrheit:** Band-Zähler („angefangen“, „aktiv fest“, „erwartet gekonnt“) werden aus Atlas-Index und Lernstand **abgeleitet** (8.000 Nachschläge im Speicher), nicht gespeichert.

**3. Lesen und Schreiben aus einer Hand.** `src/data` stellt den Rest der App eine **virtuelle Sammlung** `vocab` bereit: Altkarten (`vocab/*`) ∪ Karten aus `vs/*`, jeweils mit `id` = Karten-ID. Verbraucher (Plan, Trainer, Wortliste, Stapel, Eingangskorb, Anki-CSV, Diagnose, Sicherung) sehen eine Karte und kennen den Speicherort nicht; Schreibwege werden in `src/data` nach Karten-ID geroutet (Altkarte → `vocab/<id>` wie heute, Atlas-Karte → `vs/<seg>`). `hasCard(id)` fragt beide.

**4. Karte einführen (Reihenfolge der Prüfungen):** (a) `hasCard(id)`: gibt es `vocab/<id>` oder `chunk/c-<id>` (auch ungültig) → verknüpfen, **nichts anlegen**; (b) `vs/<seg>.w[id].c` vorhanden → nichts tun; (c) sonst `c` anlegen, nur wenn es fehlt (nie ersetzen). Das Tageskontingent wird aus den Daten gezählt (`intro`/`added` mit `dayKey`), nicht aus einem Zähler (mehrere Geräte).

**5. Verträglichkeit mit den vorhandenen `vocab/<id>`-Dokumenten (die bleiben):**
- Nichts wird verschoben, gelöscht oder umgeschrieben. Der Atlas-Status einer Altkarte wird **gelesen** (Abgleich `id`, bei C1-Paket-Karten `origin.ref = c1pack/<id>`), nicht in das Altdokument geschrieben. Dadurch kein Schreiben auf hunderten Dokumenten und kein Trockenlauf nötig.
- Gleiche ID-Menge: `log`-Einträge `{k:'v', id}`, `app/decks.filter.ids` (≤ 500) und `entryCardKey` (`logPatch.ts:56-63`, nur ein Schlüssel zum Zählen, kein Dokumentzugriff) arbeiten mit der Karten-ID und bleiben gültig.
- `fsrs`: Altkarten haben es seit der Umstellung v1; Atlas-Karten starten direkt mit `fsrs` plus gespiegelten `S`/`D`/`due`/`last`/`state`/`stage`, damit Karten-Logik, `matchDeck` und CSV gleich laufen.
- C1-Paket (`pack.json`, 250 Einträge): bleibt gültig. Die 250 werden Band 1 des Atlas oder über eine Tabelle `c1pack/<id> → Atlas-ID` verknüpft; bereits angelegte Paket-Karten bleiben in `vocab/`/`chunk/` (`packState` liest beide).
- Rückweg zur alten App: Altkarten bleiben sichtbar. Karten in `vs/*` sind für die alte App unsichtbar (unbekannte Sammlung), bleiben aber in der Datenbank und in der Sicherung. Das ist der einzige Preis des Modells und muss Emrah gesagt werden.
- Eigene Funde (Wort-Antippen, Übersetzer, Lehrer-Feedback, Tagesauftrag `src:'coach'`) bleiben eigene Dokumente `vocab/<id>` mit Ursprungssatz; Diagnose warnt, wenn `vocab` > 700 Dokumente hat.

**6. Warum nicht „ein Dokument je angefangenem Wort“?** Es hält 5.000 nur ~1,4 Jahre (Modell A) und reißt die 1.000-Dokumente-Grenze der Abfrage auf `vocab`. Es ist erlaubt, solange `vocab` unter ~900 Dokumenten bleibt, trägt aber den Atlas nicht.

---

## 5. Neue Felder, die der Umbau braucht (nur ergänzend)

Alle Schemas `looseObject`, Felder `.nullish()` (A6.16). Alles wird erst beim ersten Gebrauch angelegt (`set` nur auf fehlende Pfade, sonst `update`), eine Umstellung (v2) ist dafür nicht nötig.

| Pfad / Feld | Schema-Vorschlag | Schreibweg | Grenze |
|---|---|---|---|
| **`vs/<seg>`** (neue Sammlung, Register + `LIVE_COLLECTIONS`) | `{ v: num, seg: str, w: record(str, looseObject{ k: num, t: num, c: looseObject{…schedulingFields, fsrs, xs, hist…}.nullish() }) }`; `k` 1 kenne ich · 2 später · 3 ausgeblendet; `c` = Karte wie `vocab` (`schemas.ts:260-276`) | `writer.transform` → `update({w:{[id]:patch}})`, fehlendes Teilstück `set`; Antworten gebündelt | ≤ 80 Dokumente, je < 200 KiB (typisch 67 KiB) |
| **`app/atlas`** (Register, kein Live-Abo, `useDocWatch` im Bereich) | `{ v: 1, av: str\|num, since: dayKey, cur?: { band: num }, probes?: [{ d: dayKey, band: num, n: num, known: num }] }`; `av` = Inhaltsversion der Atlasdatei beim ersten Gebrauch | `transform` → `update`, nur bei Änderung | < 8 KiB, `probes` ≤ 40 |
| `grammar/<id>.lx` (optional, additiv) | `{ v: 1, stage?: 0–5, fsrs?: FsrsStored-Form, rule?: dayKey, t?: num }` – **Schatten**, steuert nichts, solange `p`, `due`, `errors[]` die Wahrheit bleiben (wie `errors[].fsrs`, `schemas.ts:348-350`) | `transform` → `update({lx})` auf bestehendem Dokument; fehlendes Thema wie bisher (`domain/grammar/write.ts`) | < 1 KiB je Thema |
| `app/levels` (besteht, `schemas.ts:62`) | `k.<art>: { l: 1–5, w[≤ 8], n, ch }`; neue Aufgabenarten nur als neue Schlüssel | `levelsPatch` ersetzt nur den einen Eintrag (`features/levels/*`) | < 4 KiB |
| `app/weekly` (besteht, `schemas.ts:96`) | Wochenbericht über Wortschatz und Grammatik: neue `facts`-Arten additiv; alte Berichte (auch mit Lesen/Hören-Fakten) bleiben und werden tolerant angezeigt | `weeklyRun` → `writer.transform` | ≤ 26 Wochen |
| `app/profile` | `act[tag]` neue Schlüssel nur additiv; `pflicht[tag] = 1`; Tagesbild `history[].lx = 1` mit allen alten Feldern (fehlende Kanäle `0`) | Sammel-Warteschlange (`persist.ts`), nie `set` | Profil < 160 KiB (Diagnose) |
| `app/schema` | nichts Neues. `version` bleibt `1`, solange alles additiv ist; `pflichtSince` unverändert | nur `update` | – |

Nicht speichern (immer ableiten): Band-Zähler des Atlas, „Aktiv fest“/„Übt“/„Erwartet gekonnt“, Wochenzahlen, Serie.
Wichtig beim Rückweg: Schreibt die alte App ein Dokument aus ihrer Browser-Kopie zurück, gehen darin neue Felder verloren (CLAUDE.md A7, 26.09. 18:10). Neue Felder in Altdokumenten (`lx`, `fsrs`) dürfen deshalb nie die einzige Quelle einer Entscheidung sein; Atlas-Daten in `vs/*` und `app/atlas` kennt die alte App gar nicht und überschreibt sie nie.

---

## 6. Prüfkatalog für data-guard nach dem Umbau (automatisierbar)

„Status“ nennt den Stand am 04.10.2026 (Dateien vorhanden, nicht erneut ausgeführt).

| # | Prüfung | Automatisierung | Soll | Status |
|---|---|---|---|---|
| D1 | Register vollständig (L1) | Test mit eingechecktem Manifest: 16 `APP_DOCS` + 23 `COLLECTIONS` (`paths.ts:46-102`) bleiben; jede in `src/` beschriebene Pfad-Wurzel steht im Register | Differenz leer | fehlt |
| D2 | Ein einziger Schreibpfad | ESLint `no-restricted-syntax` oder Test mit Textsuche: `.set(`/`.update(`/`.delete(` auf `db.doc`/`collection` nur in `src/data/writer.ts` und `src/platform/dev/**` | 0 weitere Treffer | heute erfüllt (Suche 04.10.), nicht erzwungen |
| D3 | Kein Löschen | `memoryDb.writes()` nach jedem Szenario ohne `op: 'delete'`; Textsuche `.delete()` | 0 | nur Writer-Test (`writer.test.ts:52`) |
| D4 | Kein Voll-Ersatz bestehender Dokumente | Protokoll des Entwicklungs-Adapters um „existierte vorher“ erweitern (`memoryDb.ts:345,355`); `set` nur auf neue Pfade, Ausnahmen `app/lookup` (replace) und `app/profile` (compact) | 0 Verstöße | fehlt (Protokoll kennt es nicht) |
| D5 | **Superset-Test der Nutzung:** Szenario der Umbau-App auf dem Seed nach Umstellung v1 (Heute-Tag, Wortschatz, Grammatik, Satzbau, Fehler korrigieren, Atlas-Einführung, Antippen, Übersetzer) | Pfadmenge nachher ⊇ vorher; jedes Feld jedes Altdokuments nachher gleich, Ausnahmen aus ausdrücklicher Liste (`fsrs`, additive Felder, gedeckelte Listen, `app/lookup`) | keine Lücke | nur für die Umstellung (`migration.test.ts`, 12 Fälle) |
| D6 | Unbekannte Felder bleiben | Eigenschaftstest über alle Schemas: Fixture + `zzNeu: {a:1}` → nach `validateDoc` vorhanden; Textsuche: in `src/data/schemas.ts` kein `z.object(`, `.strict(`, `.strip(` | alle bestehen | ein Fall (`schemas.test.ts:41`) |
| D7 | Feldnamen exakt gegen Anhang B | Test liest `docs/datenstruktur.json` und prüft, dass **jeder Feldname** im `shape` des Schemas steht (`D`, `S` …) | alle 14 Pfade | **Lücke:** heutiger Test prüft nur Akzeptanz (`schemas.test.ts:24-31`); wegen `looseObject` + optional bliebe ein Tippfehler unbemerkt. Handprobe 04.10.: alle 14 Pfade stimmen. |
| D8 | Ungültig: melden, auslassen, nie überschreiben | Fixture je Pfad mit falschem Typ → in `useLive.invalid`, nicht in der Sammlung (`live.ts:177-179`), danach kein Schreibvorgang auf dem Pfad, `hasCard` meldet „vorhanden“ | bestanden | Umstellung ja (`migration.test.ts:206`), Live-Pfad prüfen |
| D9 | Nur bei Änderung, eine Operation je Dokument | (a) zweiter Start am selben Lerntag + 10 s Ruhe → `writes()` unverändert; (b) Entwicklungs-Adapter wirft bei zwei gleichzeitigen Schreibvorgängen auf demselben Pfad | bestanden | (a) teilweise (`persist.test.ts:170`), (b) fehlt |
| D10 | Nie aus Render/Snapshot/Timer | E2E: nach dem Laden bis zur ersten Eingabe nur die einmaligen Tagesschritte (Plan, Tagesbild, Zulauf Tagesauftrag, Atlas-/Paket-Einführung) in `writes()` | genau diese | teilweise |
| D11 | Kapazität Größe | Großdatensatz (`?fake=large`) + 3-Jahres-Simulation (Muster `backlogSim.test.ts`): jedes Dokument < 200 KiB (`jsonBytes`); Atlas voll (8.000 Wörter angefangen): ≤ 80 `vs`-Dokumente, je < 200 KiB; Startlast gemessen | bestanden | `capacity.test.ts` nur Profil |
| D12 | Kapazität Anzahl | 3-Jahres-Simulation (log + daily + feed + Karten + Monatsdokumente): < 5.000 Dokumente; Diagnose warnt ab 3.500; `vocab`-Sammlung < 900 (Warnung ab 700) | bestanden | Warnschwelle heute 4.000 |
| D13 | 1.000er-Fenster | Entwicklungs-Adapter-Option `defaultLimit: 1000` für Abfragen ohne `limit`; Live-Abo und Sicherung melden eine Sammlung mit genau 1.000 Dokumenten | gemeldet | fehlt (`live.ts` prüft nichts, `memoryDb.ts:231` kappt nie) |
| D14 | Serie über Strukturwechsel (A6.13) | `computeStreak` mit Seed-Profil + `pflicht` + `pflichtSince`: dieselbe Zahl mit Plan alt/neu; gespeicherter alter Plan (alle Wochentage, auch mit `ch:u-in`, `roleplay`) lässt sich mit der Umbau-Oberfläche abschließen und setzt `pflicht[heute]`; Ruhetag je ISO-Woche; 03:59/04:00; Zeitumstellung 25.10.2026 (25-Stunden-Tag) und 28.03.2027; `TZ=Europe/Berlin` | alle gleich | `streak.test.ts`, `pflicht.test.ts` vorhanden; Fall „alter Plan“ fehlt |
| D15 | Ein Datumsschlüssel | Textsuche `toISOString().slice`, `getFullYear()`, `- 4 * 3_600_000` außerhalb `domain/date.ts` | 0 Treffer | 2 Treffer (Befund B3) |
| D16 | `daily/*`, `feed/*` nie geschrieben, Format bytegleich | `writes()` nach jedem Szenario ohne diese Pfade; Fixtures bytegleich | bestanden | Umstellung ja, Nutzungs-Szenario fehlt |
| D17 | Sicherung vollständig | Pfadmenge von `exportAll().documents` == Pfadmenge der Datenbank (inkl. `vs/*`, `app/atlas`); `browserCopies` bei offenen `sw2`-Kopien; `atlasVersion`; Hinweis bei 1.000 | gleich | fehlt |
| D18 | Atlas-Wächter | IDs eindeutig und im Format; Manifest-Vergleich (nichts fehlt, `seg` unverändert); jeder Eintrag mit `ex`, der die Form enthält (Kap. 15, Muster `tests/unit/c1pack.test.ts`); US-Schreibweise; Kollisionen mit Altkarten aufgelöst; Größe ≤ 2,5 MB; Atlas wird im Start nicht geparst | bestanden | fehlt (Atlas neu) |
| D19 | Keine Doppelkarten | Eigenschaftstest mit zufälliger Folge aus Atlas-Einführung, Antippen, Tagesauftrag `newWords`, Lehrer-Feedback, Paket, Übersetzer: jede Karten-ID höchstens einmal in `vocab/*` ∪ `vs/*`; vorhandene (auch ungültige) Altkarte bleibt unverändert | bestanden | fehlt |
| D20 | Tagesauftrag unverändert verträglich | Seed-Fixtures `daily/*` durch `dailyIntake`: 16 Themen-IDs akzeptiert, `newWords` → Karte, Atlas-Treffer → keine zweite Karte | bestanden | `dailyIntake.test.ts` vorhanden |
| D21 | Alte Dokumente weiter lesbar | je Pfad aus G1–G3 eine Fixture (Formen aus `docs/altapp-analyse.md` §4–5) durch `schemaForPath().safeParse`; Stand, Fortschritt und Wochenbericht rendern ohne `undefined`/`NaN` | bestanden | teilweise (Seed) |
| D22 | Umstellung v1 und Rettung bleiben grün | `migration.test.ts`, `rescue.test.ts` unverändert grün | grün | vorhanden |
| D23 | Keine echten Daten | `git grep` nach E-Mail-Adressen, echten Namen, Firmennamen; Seed bleibt erfunden | 0 | siehe Befunde B8, B9 |

---

## 7. Der tägliche Claude-Auftrag (nur beschreiben, nicht ändern)

**Was er tut** (CLAUDE.md A7, 27.09.2026): Routine „Englisch – Tagesaufgaben & Entdecken-Beiträge“, zeigt auf `JLL8…`, Datenmodell der alten App, schreibt abends **nur** `daily/<morgen>` und `feed/<morgen>` und nur, wenn sie noch nicht existieren; nur die 16 Grammatik-IDs; US-Englisch.

**Was die App daraus liest:** `daily/*` – alle liegengebliebenen Tage, vom ältesten an (`dailyIntake.ts:44-52`, `dayJobs.ts:22-88`): `newWords` → Karten (`src: 'coach'`, `createIfMissing`, bekannte ID wird ausgelassen), `grammarItems` → `app/pool` (≤ 90, Fingerabdruck je Tag in `lxDaily`). `feed/*` – nur Entdecken (`watch.ts:242-263`, genau ein Abo auf die neuesten 21) und der Eingabe-Block (`features/input/block/source.ts`).

**Was sich durch den Umbau ändert:**
1. **Format: nichts.** `dailySchema`/`feedSchema` bleiben, `daily/*` und `feed/*` werden nie geschrieben (L6). Die Grammatik-IDs der Routine bleiben die 16 alten (`datenmodell.md:77`: die 7 `c1-*` kennt sie nicht). **Die 16 IDs dürfen nicht umbenannt werden.** Neue Grammatikthemen im Umbau brauchen keine Änderung der Routine.
2. **`daily` bleibt wichtig** (Wortschatz und Grammatik): `daily.newWords` und `grammarItems` laufen weiter durch den Zulauf. Der Schlüssel `daily/<datum>` ist der Kalendertag der Routine (`openDailyDays` rechnet mit `legacyDayKey`) – nicht auf den 04:00-Lerntag umstellen.
3. **`feed` hat nach dem Umbau keinen Leser mehr.** Die Routine schreibt trotzdem täglich ein Dokument bis 19 KiB (≈ 365 Dokumente und ≈ 7 MB im Jahr). Entscheidung für Emrah, die Routine liegt außerhalb des Repositorys und wird nur mit seinem „Ja, Auftrag ändern“ angepasst: **(A)** unverändert lassen (kein Risiko, Modell B in 4.3), **(B)** Routine schreibt nur noch `daily` (spart ~365 Dokumente im Jahr, Modell C). Schema, Register und bereits vorhandene `feed/*` bleiben in beiden Fällen.
4. **`daily.newWords` und Atlas:** Die Routine kennt den Atlas nicht. Steht ein Wort schon im Atlas (gleiche ID), legt die App **keine zweite Karte** an, sondern führt die Atlas-Karte ein bzw. lässt eine vorhandene bestehen (`hasCard`, L8). Wörter außerhalb des Atlas wie bisher als `vocab/<id>`.
5. `app/pool.lxDaily` wächst um ~50 B je Tag (unkritisch); `app/pool` bleibt die Warteschlange der Tagesaufgaben (≤ 90).

---

## 8. Befunde am heutigen Stand

- **B1 · WARNUNG (wird ALARM, sobald der Atlas Dokumente je Wort erzeugt)** – `src/data/live.ts:160-195` – Live-Abo auf `vocab`/`grammar`/`chunk`/`archive` ohne Prüfung auf genau 1.000 Treffer (anders als `snapshot.ts:78`, `reads.ts:61`); `src/platform/dev/memoryDb.ts:231` kennt kein Standardlimit, Tests sehen eine Kappung nie. Der Vertrag nennt für Abfragen ohne `limit` keine Obergrenze (nur `limit` ≤ 1.000, `db.d.ts:376-379`); die 1.000 ist eine Annahme der Codebasis. – L9, Kap. 9 R1/R6, A6.6 – Folge: Schneidet die Plattform bei 1.000 ab, fehlen Karten still in Plan, Wortliste und Fortschritt (die Serie hängt nicht daran). Gegenmaßnahme: Modell B (4.4), D13, Diagnose-Zahl lesen lassen.
- **B2 · WARNUNG** – `src/features/settings/exportData.ts:15-41` – Die Sicherung übernimmt „möglicherweise gekappt“ (`snapshot.ts:69-81`) nicht in ihre Ausgabe. – Kap. 9 R1 – Folge: Bei > 1.000 Dokumenten in einer Sammlung kann eine Sicherung still unvollständig sein.
- **B3 · WARNUNG** – `src/domain/progress/weekly.ts:126-130` (Tag = `t − 4 h`, was `date.ts:13-14` ausdrücklich verwirft) und `src/domain/srs/chunkCards.ts:113-117` (UTC-Tag für die Reihenfolge neuer Wendungen) – A7 „überall dieselbe Funktion“ – Folge: Wochenfakten und Reihenfolge können an der Zeitumstellung (25.10.2026) oder nach Mitternacht um einen Tag abweichen; die Serie ist nicht betroffen.
- **B4 · WARNUNG** – `src/domain/migration/v1.ts:233` – `writer.set('app/schema', …)` ersetzt das ganze Dokument. Heute durch `isDone` (`v1.ts:169-175`) und die Lease geschützt. – Kap. 9 R1 – Folge: Jede spätere Fortschreibung (v2) muss `update` nehmen, sonst geht `pflichtSince` verloren und die Serie fällt auf die alte Regel zurück.
- **B5 · WARNUNG** – `src/platform/dev/memoryDb.ts:149,343-355` – Schreibprotokoll ohne „Dokument existierte“, kein Wächter gegen parallele Schreibvorgänge je Pfad – Kap. 9 R1, A6/3.4 – Folge: Die Regeln „kein Voll-Ersatz“ und „eine Operation je Dokument“ sind nicht automatisch prüfbar (D4, D9).
- **B6 · WARNUNG** – Kapazität: log + daily + feed ≈ 1.100 Dokumente/Jahr; Warnschwelle erst bei 4.000 (`profileSize.ts:14`); `docs/datenmodell.md:59` nennt 196 statt 211 Dokumente im Seed – A6.6 – Folge: Die 5.000er-Grenze kommt auch ohne Atlas in einigen Jahren; mit einem Dokument je Atlas-Wort nach ~1,4 Jahren.
- **B7 · WARNUNG (gering)** – `tests/unit/schemas.test.ts:24-31` – gleicht Feldnamen nicht gegen Anhang B ab (D7). Handprobe: alle 14 Pfade von Anhang B haben ein Schema mit exakt passenden Feldnamen (`D`, `S`, `due`, `stage`, `pflicht` …).
- **B8 · WARNUNG (gering)** – `seed/sample-data.json` (z. B. `feed/*` bei Zeile 2867-2873 und 3105-3115) – Die Feed-Beispiele stammen aus `src/content/legacy/feed-seed.json` und tragen echte Nachrichten-URLs und Zitate echter Personen; Kap. 3.3/A6.1 verlangen erfundene Daten. Kein Personenbezug zu Emrah. – Folge: keine für den Umbau; bei der nächsten Seed-Erzeugung ersetzen.
- **B9 · INFO (kein Befund)** – `git grep`: keine E-Mail-Adresse im Repository (nur die Lizenzdatei des Aussprache-Wörterbuchs, `src/content/pron/LICENSE-cmudict.txt:51`), kein Firmenname; Profil im Seed ist erfunden („Alex Muster“). Berufsrolle und Vorname stehen in Quelltext-Kommentaren (z. B. `src/content/say/situations.ts:2`), unkritisch.
- **B10 · OK heute:** keine `.delete()` außerhalb des Entwicklungs-Adapters, jedes `set`/`update` im Quelltext liegt in `src/data/writer.ts`; `daily`/`feed` werden vom Writer verweigert (`writer.ts:130-136`); alle Schemas sind `looseObject` (`schemas.ts:13-20`); Umstellung v1 mit Trockenlauf, Lease und Idempotenz getestet (`tests/unit/migration.test.ts`, 12 Fälle).

---

## 9. Offene Fragen vor der Umsetzung

1. **Emrahs Dokumentenzahl** (Einstellungen → Diagnose) – entscheidet über N0 in 4.3 und darüber, ob `vocab` schon nahe 1.000 liegt.
2. **Bleibt der Kurs** (`app/course`, `lesson/*`) und **„Lehrer-Feedback einfügen“** (`teacher/*`)? Davon hängt G1 gegen G2 ab.
3. **Rückweg zur alten App** weiter zusagen? Altkarten bleiben dort sichtbar, Atlas-Karten (`vs/*`) nicht.
4. **Routine:** `feed` weiter schreiben lassen (A) oder abstellen (B)? Nur mit Emrahs „Ja, Auftrag ändern“.
5. **Zeitpunkt der Live-Schaltung** nach 04:00 an einem Tag mit erledigter Pflicht (Abschnitt 2, Regel 4).
