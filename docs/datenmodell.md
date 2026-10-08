# Datenmodell der neuen App

Stand: Phase 0. Grundlage sind die bestehende Datenbank (`docs/datenstruktur.json`) und die Analyse der alten App (`docs/altapp-analyse.md`).

## Grundsätze (Kap. 9)

1. **Dieselbe Datenbank.** Alle bestehenden Pfade und Felder werden gelesen und weitergeführt, nie gelöscht.
2. **Nur ergänzen.** Neue Formate kommen in neue Felder, die alten Felder bleiben stehen.
3. **Jeder Lesevorgang wird geprüft.** zod-Schemas in `src/data/schemas.ts` (`looseObject`: unbekannte Felder bleiben erhalten). Ungültige Dokumente werden gemeldet und nicht angefasst.
4. **Ein Schreibpfad.** `src/data/writer.ts`:
   - schreibt nur bei echter Änderung,
   - schreibt je Dokument nacheinander,
   - verweigert `daily/*` und `feed/*`,
   - hat keine Löschfunktion.
5. **Voreinstellungen sind Daten.** Lehrplan, 16 Grammatikthemen und 40 Startvokabeln liegen in `src/content/legacy/`. Die Datenbank gewinnt, wie in der alten App.

## Neu hinzugekommen (Datenversion 1)

| Pfad / Feld | Inhalt | Geschrieben von |
|---|---|---|
| `app/schema` | `{version, cutover, migratedAt, app, counts}`: Versionsvermerk der Umstellung. `cutover` ist der Umstellungstag und dient nur zur Information. | Umstellung v1 |
| `app/schema.pflichtSince` | erster Lerntag, an dem die App die Pflicht erfasst, ab da gilt die Pflicht-Regel der Serie | Phase 1 (Heute-Bildschirm), einmalig |
| `app/profile.pflicht` | `{<datum>: 1}`: Lerntage mit erledigter Pflicht | ab Phase 1 |
| `vocab/<id>.fsrs`, `chunk/<id>.fsrs` | FSRS-Startwerte (siehe `docs/fsrs-umrechnung.md`) | Umstellung v1, ab Phase 1 der Trainer |
| `app/profile.lang` | Oberflächensprache `de`/`en`. Das Feld ist bestehend und wird weiter genutzt. | Einstellungen |
| `app/profile.theme.m` | `dark`/`dim`/`light`/`auto`. Das Feld ist bestehend, `theme.p` bleibt erhalten. | Einstellungen |

## Umstellung (Version 1)

- **Trockenlauf:** `planMigrationV1` liest alles und schreibt nichts.
- **Bericht:** Er zeigt, was gefunden wurde, was ergänzt wird und was bleibt. Dazu kommen die Serie vorher und nachher sowie ungültige Dokumente.
- **Ausführen:** Das passiert erst nach Bestätigung (`applyMigrationV1`):
  1. `acquire`-Schloss auf `app/schema`, damit zwei Fenster nicht gleichzeitig umstellen.
  2. Noch nicht übertragene lokale Kopien der alten App (`sw2:__dirty`) **ergänzen** (`rescue.ts`):
     - fehlende Dokumente anlegen,
     - Profil: `days`/`xpDays`/`minutes`/`act` je Tag mit dem Maximum (nur echte Kalendertage bis heute, keine negativen Werte), Zähler nur nach oben,
     - Kurs: nur fehlende Lektionen,
     - alles andere, was abweicht (Listen wie Log, Radar, Chat; Karten; Themen; Einstellungen), wird **nicht** zusammengeführt, sondern gemeldet und bleibt im Browser (`sw2:`) und in der Sicherung (`browserCopies`),
     - ein Datenbank-Dokument mit unerwartetem Aufbau wird nie angefasst (`db_invalid`).

     Lesen, Rechnen und Schreiben laufen in einem Schritt der Warteschlange (`writer.transform`). Erledigt ist eine Kopie nur, wenn dieser frische Abgleich sie vollständig übernommen hat (`applyRescue.ts`); sonst bleibt sie offen und erscheint auf „Dein Stand“. `daily/*`, `feed/*` und unbekannte Pfade bleiben aus.
  - **Weitere Browser:** Hat ein anderer Browser noch Kopien, zeigt „Dein Stand“ dort „Aus diesem Browser nachtragen“. Es gelten dieselben Regeln (`lateRescue.ts`), behandelte Einträge merkt sich `lx:legacy-rescue` im Browser.
  3. `fsrs` je Karte ergänzen.
  4. `app/schema` schreiben.
- **Gesperrt:** Die Umstellung läuft nicht bei ungültigem `app/profile` oder bei möglicherweise gekappten Abfragen. Dann gibt es nur Sicherung und Hinweis.
- **Wiederholbar:** Bereits ergänzte Karten werden übersprungen, ein zweiter Lauf erkennt die Version. FSRS wird beim Ausführen aus dem frischen Stand jeder Karte berechnet.
- **Test:** `tests/unit/migration.test.ts` prüft gleiche Anzahlen, gleiche Serie, nichts gelöscht und bytegleiche `daily/*` und `feed/*`, zu mehreren Zeitpunkten.

## Lerntag und Serie

- Der Lerntag wechselt um **04:00 Uhr** Ortszeit (`src/domain/date.ts`).
- **Vor `pflichtSince`** zählt die alte Regel: `days[k] > 0` oder `xpDays[k] > 0`. Das gilt auch nach der Umstellung, solange Phase 1 die Pflicht noch nicht erfasst.
- **Ab `pflichtSince`** zählt ein Tag, wenn die Pflicht erledigt ist. Ein Ruhetag je ISO-Woche bricht die Serie nicht (`src/domain/streak.ts`).
- Zwischen 0 und 4 Uhr zählt zusätzlich der Kalendertag der alten App (keine Lücke bei nächtlicher Umstellung).

## Kapazität (contract/db.d.ts)

- Höchstens **5.000 Dokumente**, **256 KiB** je Dokument, **64 Abonnements** je Ansicht.
- Die Testdaten haben 196 Dokumente, eine echte Datenbank nach einem Jahr grob 1.000 bis 1.500.
- Wachsende Ströme werden gedeckelt:
  - bestehende Deckel: Log 300 je Tag, Radar 400, Lookup 400, Chat 40
  - neue Ströme: werden zusammengefasst statt ein Dokument je Eintrag
- Die Diagnose-Ansicht zeigt die aktuelle Dokumentzahl.

## Ergänzungen Phase 3 – Sprechen und Business

Nur neue Felder und Sammlungen; alte Felder bleiben unverändert, gelöscht wird nie.

| Pfad | Neu | Schreibweg |
|---|---|---|
| `talk/<JJJJ-MM>` | `{v, month, runs[]}` – je Gespräch `{id, t, day, scene, title, src, turns, ms, end, goal, clean, errs, taken, lines ≤ 16, report, lang, tier, v}`; ≤ 200 KiB (Verdichtung: zuerst `lines`, dann `report.focus/strengths` der ältesten) | `transform`, idempotent über `run.id` (Gesprächsende; KI-Bericht wird nachgetragen) |
| `biz/<JJJJ-MM>` | `{v, month, items[]}` – `mail` / `pitch` / `play`; ≤ 200 KiB (Verdichtung: zuerst die Texte der ältesten) | `transform`, idempotent über `item.id` |
| `say/<JJJJ-MM>` | `{v, month, items[]}` – „Sag es“ (Lernberatung V1/V2): `{id, t, day, sit, kind, a1, a2, fb1, fb2, ms, lang, ai}`; ≤ 200 KiB (Verdichtung: zuerst die Rückmeldungen, dann die Texte der ältesten) | `transform`, idempotent über `item.id` (nach der ersten Prüfung und am Ende) |
| `fluency/<JJJJ-MM>` | `{v, month, items[]}` – Flüssigkeit 90 – 60 – 45 (Lernberatung V6): `{id, t, day, q, kind, rounds[{sec, text, ms, words, wpm, sentences, full}], fb, ms, lang, ai}`; ≤ 200 KiB (Verdichtung: zuerst `fb`, dann die Texte der ältesten) | `transform`, idempotent über `item.id` (nach Runde 3 und nach der Rückmeldung); Log `type:'fluency'`, `act.fluency` (freiwillig) |
| `meeting/<JJJJ-MM>` | `{v, month, items[]}` – „Mein nächster Termin“ (Lernberatung V4), nur echte Eingaben: `{id, t, day, who, topic, tricky, notes, when, prep{phrases, objections, scene}, sceneId, debrief[] (≤ 24), lang}`; ≤ 200 KiB (Verdichtung beim ältesten: `prep.scene`, dann `prep.objections`, dann `prep`) | `transform`, idempotent über `item.id`; Generalprobe → `scene/sc-ai…` (`pv: meeting-prep@1`, `meeting`), Wendungen → `chunk/c-…` (`origin.kind: meeting`) |
| `tones/<JJJJ-MM>` | `{v, month, items[]}` – „Eine Botschaft, drei Tonlagen“ (Lernberatung, Vorschlag 8): `{id, t, day, msg, kind, texts {slack, cfo, meeting}, fb {versions[], corrections[], tip} \| null, ms, lang, ai}`; ≤ 200 KiB (Verdichtung: zuerst `fb`, dann die Texte der ältesten) | `transform`, idempotent über `item.id` (am Ende); Log `type:'tones'`, `act[tag].tones` (Extra), echte Fehler → `app/repair` mit `src:'tone'` |
| `grammar/c1-*` | 7 Themen des C1-Werkzeugkastens (Lernberatung, Vorschlag 7) im Format der 16 alten Themen, Startwerte aus `src/content/c1/toolkit.json`; der Claude-Tagesauftrag kennt nur die 16 alten Kennungen | wie `grammar/<id>` |
| `chunk/c-<slug>` | zusätzlich `def`, `whyLang`, `origin {v, kind, ref, title, t}`, `src.kind` (`scene`/`mail`/`pitch`/`biz`), `src.ts`; `also` wird nie geschrieben | nur anlegen, wenn die Wendung fehlt; „Wieder aufnehmen“ = `update({hidden:false})` |
| `chunk/<id>` (Wiederholung, 27.09.2026) | nach jeder Antwort im Trainer wie Karten: `fsrs` (zusätzlich), gespiegelt `S`, `D`, `due`, `last`, `state`, `reps`, `lapses`, `stage`, `intro`, dazu `xs`, `hist[] {t, m, g, x}` (≤ 12) und `modes` nur für `cloze`/`produce` (Modi der alten Wendungs-Wiederholung); nie `pa`/`ac`/`co`/`colN`; optional `xEx` (KI-Beispiele) und `mnemo` wie Karten | `writer.transform` (`reviewWrite` → `chunkPatch`, `chunkPatchSchema`), nie angelegt, nie bei `hidden` |
| `vocab/<id>.hist[].x` | Übungsart der Antwort (neu, zusätzlich zu `m`); für „nicht dieselbe Art wie zuletzt“ | wie die übrigen Kartenfelder |
| `log/<tag>` (Wendungen) | Einträge `{t, ok, lang, type:'chunk', id, m:'tr-<art>', q, given, ans, g, ms, ctx}` – Form der alten App, kein `k`; zählen zu „Wiederholen“ (`entryCardKey` → `chunk/<id>`) | gemeinsamer Puffer (`recordAnswer`) |
| `scene/<id>` | Lauf-Vermerk `runs`, `lastRun`, `done:true` (nur wenn fehlend/false); KI-Szenen `scene/sc-ai<ms36>` mit `src:'ai'`, `pv`, `gram`, `words` | `transform` bzw. `createIfMissing` |
| `app/radar.events` | Quellen `k` (Sprechen) und `b` (Business), nur Fehler zu Grammatikthemen, Kategorie der alten App (`topicCat`), ≤ 400 | gemeinsamer Puffer (`recordActivity`) |
| `log/<tag>` | Einträge `{t, ok, lang, type:'speak'|'biz', id, m, q, n, ms, ctx:'spk'|'biz'}` – nie `k:'v'`, nie `ctx:'rev'|'xtra'` | gemeinsamer Puffer (`recordActivity`) |
| `app/profile` | `act[tag].speak` / `speak~` / `biz`; `days`/`answers` + eigene Züge (`countAs`); `voice`, `rate` (Felder der alten App) | gemeinsamer Puffer bzw. `patch` |

Browser-Speicher (nur Bequemlichkeit): `lx:roleplay:<szene>` (Fortsetzen, ≤ 40 KB), `lx:draft:speak:<szene>`, `lx:draft:mail`, `lx:draft:pitch`, `lx:speak-autoplay`, `lx:stt-blocked`.

## Phase 5: Begleiter und Übersetzer (nur neue, optionale Felder)

Plan: `docs/phase5-plan.md` §5, E5-22. Alte Felder und Formen bleiben unverändert, es wird nichts gelöscht.

| Dokument | Neu | Schreibweg |
|---|---|---|
| `app/chat` | `since` (Beginn des laufenden Gesprächs); je Nachricht `t`, `lang`, `ctx`, `stopped` | `features/companion/persistChat.ts` (`transform`, ≤ 40 Nachrichten, ≤ 180 KB) |

Browser-Speicher (nur Bequemlichkeit): `lx:draft:chat`, `lx:translate-history` (≤ 20), `lx:companion-tab`, `lx:companion-tier`.
Abos: `app/chat` nur bei offenem Begleiter (`src/data/watch.ts`).

### Preply-Brücke (bis 28.09.2026) – entfernt, Daten bleiben

Emrahs Vorgabe vom 28.09.2026: der Preply-Bereich (Vorbereiten, Import, Verlauf, „Als Preply-
Stunde", „Mit Lehrer besprechen") ist vollständig aus der Oberfläche entfernt. Die Dokumente
`preply/pp<ms>` und `preply/pi<ms>` (Plan, Import, Übungen, `hwDone`), `app/decks.flagged` und
`app/week.preplyNext`/`app/week.hint.src:'preply'` bleiben unangetastet in der Datenbank stehen
(Kap. 9, Regel 6: nichts wird gelöscht) und werden weiterhin tolerant gelesen, u. a. für „Dein
Stand" (Deutsch-Fallen, Einschätzung) und den Eingangskorb-Stapel `src:preply`. Neu geschrieben
wird dorthin nichts mehr. An ihre Stelle tritt „Lehrer-Feedback einfügen" (siehe unten).

## Lehrer-Feedback einfügen (ab 28.09.2026, ersetzt die Preply-Brücke)

`docs/neubau/plan.md` Abschnitt L. Emrah fügt das Feedback seines Lehrers als Text ein; die Vorlage
`teacher-feedback@1` (`src/prompts/teacherFeedback.ts`) zerlegt ihn in Wörter/Wendungen,
Korrekturen und Übungsideen. Nur auf Tipp, kein eigener Timer, keine automatische Wiederholung
(A6.2/A6.3).

| Dokument | Felder | Schreibweg |
|---|---|---|
| `teacher/<JJJJ-MM>` | `{v: 1, items: [{id, t, lang, raw, title, summary, corrections: [{wrong, right, why}], words: [{en, de, pos, ex, fromLesson}], tasks: string[]}]}` | `src/features/teacher/actions.ts::saveTeacherFeedback` (`writer.transform`, `src/domain/teacher/store.ts`: ≤ 200 Einträge, `raw` ≤ 4 KB, Dokument < 200 KiB, wie `out/<Monat>`) |
| `vocab/<id>` | Kartenvorschlag übernehmen: `src: 'teacher'`, `origin.kind: 'teacher'` | über `addWord`/`saveCardOp` (Ursprungssatz Pflicht, Kap. 15) |
| `app/repair` | Korrektur übernehmen: Reparatur-Satz mit `src: 'teacher'` | `domain/repair/sources.ts::repairsFromTeacher` → `saveRepairs` |

„Jetzt üben" startet die vorhandene Übung „Mach mir eine Übung dazu" (`claude-drill@1`,
`src/features/companion/drill.ts`) mit dem Feedback als Kontext – keine neue Übungs-Engine.
Ohne Claude (`not_granted`): Hinweis und ein reiner Zeilen-Rückfall (`src/domain/teacher/fallback.ts`,
Muster „Wort – Bedeutung"), ohne Speicherweg (kein Ursprungssatz, Kap. 15).
## Phase 4: Lesen, Hören, Schreiben, Entdecken

Alle Formate bleiben Altformat; neue Felder sind nur zusätzlich und tolerant gelesen (`nullish`). Geschrieben wird nur auf eine Handlung hin, über den einen Writer; alles in `app/profile`, `log/<tag>` und `app/radar` nur über die gemeinsame Sammel-Warteschlange (`features/progress/persist.ts`: `recordUnitEnd`, `recordChannelEntries`, `recordRadar`, `recordProfileFields`). `feed/*` und `daily/*` werden nie geschrieben.

| Dokument | Wann | Operation | Neue Felder |
|---|---|---|---|
| `articles/ai<t>` | Text erzeugt, eigener Text (M16, `src:'own'`), Aufbereitung eines eigenen Texts | `createIfMissing` bzw. `transform → update` | `topic_en`, `questions`, `domain`, `t`, `pv` |
| `lpool/ai<t>` | Hörtext erzeugt | `createIfMissing` | `topic_en`, `vocab[].def`, `domain`, `t`, `pv` |
| `reading/r<t>` | letzte Frage beantwortet (Einheit fertig); Zusammenfassung/Prüfung später | `createIfMissing`, dann `transform → update` | `quiz {n, ok}`, `domain`, `ref`, `res.lang`, `res.pv` |
| `wprompt/<tag>` | erstes Öffnen von Schreiben; „Andere Aufgabe"/„Eigenes Thema" nur ohne heutigen Text | `transform` (anlegen, sonst gespeicherte gewinnt) bzw. `update` | `p.domain`, `t` |
| `writing/w<t>` | erste Abgabe; Überarbeitung; Korrektur | `createIfMissing`, dann `transform → update` | `lang`, `domain`, `rev`, `res.{usHints, lang, pv, rev}` |
| `app/profile` | Einheit abgeschlossen (Sammel-Schreibweg, `lxSeq`) | wie Phase 1 | Zähler wie alte App: `days`, `answers`, `xpDays` (+10/+3 je Frage, +15 je Einheit), `act[tag].{read,listen,write,discover}`, `minutes`, `mix`, `listen[]` (≤ 80, plus `help`), `ema/n.listen` |
| `app/profile.disc`, `.gen` | Schritt in Entdecken; KI-Erzeugung | Sammel-Warteschlange (`recordProfileFields`), nur bei Änderung | – |
| `app/radar` | Korrektur mit Fehlern (Quelle `w` Schreiben/Anwenden, `r` Lesen), Kategorie der alten App (`topicCat`/`normCat`) | Sammel-Warteschlange (`recordRadar` → `mergeRadar`, ≤ 400) | – (britische Formen nie) |
| `log/<tag>` | Verständnisfragen | Sammel-Schreibweg | Einträge `{t, ok, lang, type, ref, q, given, ans, ms, ctx}` (`ch` Pflicht, `xtra` Extra) ohne `id`/`k` |
| `vocab/<slug>` | „Als Karte speichern" (Wort-Antippen, Wendungen) | Phase-1-Weg | `src ∈ {read, listen, write}`, `origin.kind ∈ {read, listen, write, discover}` |

- **Erledigt** heißt je Kanal: `act[tag][kanal] ≥ 1` (gespeichert ⊕ Puffer, `domain/plan/inputChannels.ts`).
- **Hören** schreibt kein eigenes Dokument (`profile.listen[]`), **Entdecken** nur `profile.disc` – der Text beim Anwenden bleibt im Browser.
- **Abos:** zusätzlich genau eines auf `feed` (sortiert nach `d`, 21 Dokumente), nur solange Entdecken offen ist; alles andere per `get()`.
- **Kapazität:** höchstens 6 neue Dokumente je Tag bei Vollnutzung aller vier Module, im Mittel ≤ 4 (Test `tests/unit/inputData.test.ts`). Die Diagnose zeigt zusätzlich die Zahl der Entdecken-Einträge.

## Ergänzungen Phase 6/7 (additiv, nichts gelöscht)

| Pfad | Neu | Schreibweg |
|---|---|---|
| `app/assess` | Hülle `{d, t, lang, answers, writings, data}` wie die alte App, dazu `v: 2`, `pv: 'assess@1'`, `tier` (antwortende Stufe), `basis`, `hist[]` (≤ 60), `run {d, t, by}` (Tagessperre); `data.strengths[].ev`, `data.blockers[].ev`, `data.focus.channels`. Ab assess@4 (Lernplattform 3.0 P45, Schalter `way`, `pv: 'assess@4'`) zusätzlich `data.c1 = {status: 'not_yet'\|'on_track'\|'ready', why (≤ 300, Oberflächensprache, keine Punkt- oder Prozentzahl), missing: [{crit: 'k1'…'k7', title}] (≤ 3, nur offene Kriterien), ev: ['c1:k4' \| 'chk:JJJJ-MM' \| 'gate:N' \| 'place']}`; `ready` nur, wenn der Code alle sieben Kriterien als erreicht meldet. `data` immer vollständig (fehlend = `null`, also auch `c1: null`). Flache Form wird weiter gelesen. | `assessRun` → `writer.transform` (`assessWrite`), vorher `acquire` (240 s) |
| `app/weekly` | `{items: [{w, lang, t, pv, facts[], text {headline, learned[{text, ref}], next}}]}` (≤ 26) | `weeklyRun` → `writer.transform` |
| `app/patterns` | `{d, t, lang, pv, items: [{id, title_de, title_en, rule, examples[{wrong,right}] ≤ 4, count, keys ≤ 6, tasks ≤ 3}] ≤ 8, history: [{w, counts{id:n}}] ≤ 26}` – persönliche Deutsch-Fallen (Lernberatung V3); `items` werden beim Neu-Erkennen ersetzt (abgeleitete Daten), `history` wird nur ergänzt | `features/patterns/store.ts` → `writer.transform` |
| `app/profile` | `goalMin` (10–40, Standard 25), `sound` (Standard aus), `canDo[<cefrId>] = Lerntag \| null`, `history[].lx = 1` (Tagesbild dieser App), `history[].va` (Fest-Zahl des Tages, nur Vokabeln, für „+n in 28 Tagen“), `history[].vu` (Wörter und Wendungen fest, `festUnits`; LP3 P22, rein ergänzend, `va` bleibt unverändert), `history[].dc` (Dokumentzahl des Tages, LP3 P22, Grundlage der Prognose in P29), `vtests[].v = 'lx1'`, `act[tag].vtest` | Einstellungen über `app/actions` (optimistisch mit Rückrollen); Tagesbild und Test über die Sammel-Warteschlange |
| `app/profile.ms` | `{<id>: Lerntag}` – Meilensteine (Katalog Lernplattform 3.0 K-14: `fest100/250/500/750/1000/1500`, `topic1`, `fix10`, `overdue0`, `place`, `ch1`–`ch7`, `c1check1`, `c1ready`), je ID einmal über alle Geräte. Wert `JJJJ-MM-TT` = gezeigt (zählt gegen das Budget: ≤ 1 Karte je Sitzung, ≤ 2 je ISO-Woche), `JJJJ-MM-TT~` = still gemerkt (gleichzeitig erreicht oder Umstellung auf `festUnits`); `fu` = Umstellung erledigt. Nur ergänzend, nie überschrieben oder gelöscht | ≤ 30 Schlüssel (20 vergeben) | `claimMilestone` → `recordProfileFields` → `claimMilestones` (Lesen, Prüfen, Schreiben in einem Schritt; Heute-Abschluss und Kapitelprüfung) |
| `app/c1` | `{v: 1, place?, checks[], gates[], prod[], bad[]}` – C1-Programm (Lernplattform 3.0 §4.8): Einstufung, C1-Checks, Kapitelprüfungen, Produktionsmengen, gemeldete Aufgaben. `gates[i] = {d, ch, g: [richtig, gesamt], w: [richtig, gesamt], ok}` (Kapitelprüfung, P42: `w: [0, 0]` = Wörterteil entfallen); Kapitelstand wird nie gespeichert (abgeleitet). `checks[i] = {d, f, inp: 'desk'\|'touch', p: [mcc, ocl, wf, kwt] (Höchstwerte 8 · 8 · 8 · 12), pts, max: 36, fc?}`; `fc` (P44) = eingefrorene Prognose `{from: 'JJJJ-MM', to: 'JJJJ-MM', late: 'k1'…'k7'}` oder `null` (Pause/kein Tempo), geschrieben genau einmal im Check-Fenster (letzte Woche des Monats) für den neuesten Check dieses Monats, nur ab ≥ 3 Checks und ≥ 6 Wochen Programm (`withFc`); nur Laptop-Checks (`inp: 'desk'`) zählen für K5. `prod[i] = {d, s: 'mail'\|'clinic'\|'talk', w, e, wk?}` (P44, K7): `w` = eigene Wörter, `e` = Fehler (`sev: 'error'`, Mittel zweier Zählungen, halbe Werte möglich), Stil zählt nie, eingefügte Texte und Übersetzer-Nutzung werden abgelehnt; älter als 8 Wochen verdichtet zu Wochensummen (`wk: true`). Einziger Schreiber von `prod`: `domain/c1/prod.ts` (`addProd`); bis P46/P47/P51 gibt es keine Einträge | ≤ 30 KB; `gates` ≤ 35 (≤ 5 je Kapitel), `checks` ≤ 24, `prod` ≤ 150, `bad` ≤ 300 | `patchC1` → `writer.transform` (nur ergänzend, nur bei Änderung, nie in ein ungültiges Dokument; über den Grenzen verwirft `compactC1` die ältesten Einträge mit `logWarn`); Kapitelprüfung: `saveGate` |
| `app/profile.plan.u` | zusätzlich optional `cb` (`'reduced'`\|`'restart'`: Plan-Form nach einer Pause), `ov` (überfällige Karten beim Planen), `sure` (sichere Karten beim Planen); Block 5 `again` fehlt, wenn beim Planen kein Fehlersatz fällig war. Ältere Pläne ohne diese Felder bleiben lesbar | – | Tagesplan (einmal je Lerntag) |
| `app/profile.plan.why` | `[key, n, ref]` additiv, z. B. `['whyFocus', 0, 'grammar:mixed-cond']`, `['whyDue', 4, 'gram']` | Tagesplan (einmal je Lerntag) |
| `archive/profile-<JJJJ>` | ausgelagerte Tageskarten `days, xpDays, minutes, act, pflicht` eines Jahres (`v: 1, year, from, t`) | `runCompact` (erst nach Abnahme freigeschaltet, `COMPACT_ENABLED`) |
| `lesson/l25…` | Kurs-Erweiterung (Kap. 6.2): `plan {pv: 'course-extend@1', unit {id: 'u7', n, en, de, goal_en, goal_de, kind}, en, de, cando_en, cando_de, situation, grammar, level, words[[en, de]]}`, `lx {pv, lang, ext: true}`, zunächst ohne Inhalt; „Lektion vorbereiten“ ergänzt nur leere Felder (ohne `lx.regen`) | `saveExtension` → `writer.createIfMissing` je Lektion (nie überschrieben), Kennungen nach frischem Lesen aller `lesson/*` |
| `app/profile.haptic` | Vibration beim Prüfen (Kap. 4.3), Standard an; nur `false` schaltet ab | `changeHaptic` über `app/actions` (optimistisch) |
| `scene/sc-price`, `scene/sc-pitch` | feste Szenen als Inhalt (`content/speak/scenes.json`); das Dokument entsteht wie bei den alten Szenen erst mit dem ersten Lauf | `saveRun` → `sceneRunOp` |

## Ergänzungen Neubau (docs/neubau/plan.md §4.10, additiv, nichts gelöscht)

Deklariert in WP0a (`src/data/{paths,schemas}.ts`, tolerant/`looseObject`); geschrieben wird nur über `writer.transform`, feldweise. Beide `app/*`-Dokumente sind **keine** Live-Abos: Sie werden nur in ihrem Bereich per `useDocWatch` gelesen. Sicherung und Export enthalten sie automatisch (`APP_DOC_PATHS`, `COLLECTION_NAMES`).

| Pfad | Neu | Grenze | Schreibweg |
|---|---|---|---|
| `app/decks` | `{v: 1, decks: {<id>: {name, order, created, mode?: 'type'\|'flip', dir?: 'de-en'\|'en-de'\|'mix', size?, hidden?, filter {kinds?, src?, stage {min?, max?}?, due?, hard?, query?, ids? (≤ 500)}}}, builtin?: {<id>: {mode?, dir?, size?}}, prefs?: {dir?: 'de-en'\|'en-de'\|'mix', grades?: 4\|2, mode?: 'auto'\|'type'\|'flip'}, flagged?: string[] (≤ 200)}` – eigene Stapel als gespeicherte Filter; Karten bekommen **kein** neues Feld, die Zugehörigkeit ergibt `matchDeck(card, filter)`. Löschen eines Stapels = `hidden: true` (zählt in die 40). Grenzen werden vor jedem Schreiben geprüft (`domain/srs/decks.ts`), verletzt → Hinweis statt Schreiben | ≤ 40 Stapel, ≤ 500 IDs je Stapel, ≤ 2.000 IDs gesamt, `flagged` ≤ 200, `jsonBytes` ≤ 64 KiB | P3 → `writer.transform` |
| `app/week` | `{v: 1, cur?: {wk: 'JJJJ-Www', theme: 't01'…'t16', by: 'auto'\|'user', at}, hist?: [{wk, theme, by}], targets?: {wk, traps: string[], tool: string}, hint?: {wk, theme, src: 'meeting'}}` – Wochenthema und Wochenziele; `hint` = Terminthema mit Vorrang beim Vorschlag (N17). Frühere Felder `preplyNext` und `targets.preply` sowie `hint.src:'preply'` (bis 28.09.2026) werden, falls noch vorhanden, tolerant gelesen und nicht mehr ausgewertet oder geschrieben | ≤ 26 Wochen in `hist`, < 8 KiB | P1 → `writer.transform` |
| `out/<JJJJ-MM>` | `{v: 1, items: [{id, k, d, theme?, ok?, text?, fb?, ms?}]}` – Ergebnisse der neuen Übungen (Kollokationen, Einwände, Posteingang, Nachsprechen …) als Monatsdokument (A6.6) | ≤ 400 Einträge, `text`/`fb` je ≤ 2 KB | P7 → `writer.transform`, idempotent über `item.id`; Antworten zusätzlich ins Tagesprotokoll über `recordChannelEntries` |

## Ergänzungen Paket B (docs/backlog.md §1, additiv, nichts gelöscht)

| Pfad | Neu | Grenze | Schreibweg |
|---|---|---|---|
| `app/memory` | `{v: 1, items: [{id, text, src: 'chat:<t>'\|'meeting:<id>', t, lang?: 'de'\|'en'}]}` – „Claude merkt sich“ (B5): Fakten aus Gesprächen, in den Einstellungen sichtbar und einzeln löschbar (Löschen entfernt nur den einen Eintrag, nie das Dokument); eine erneute Aufnahme derselben Quelle ersetzt deren Fakten. **Live-Abo** (`LIVE_DOCS`), weil die Vorlagen die Fakten synchron im Klick lesen | ≤ 5 je Quelle, ≤ 40 gesamt (älteste fallen heraus), ≤ 160 Zeichen je Fakt, < 16 KiB | `features/companion/memory.ts` → `writer.transform`; unerwarteter Aufbau → nichts geschrieben |
| `app/compare` | `{v: 1, items: [{month: 'JJJJ-MM', day, t, task: 'ct1'…, speak {text, sec, m {words, traps, per100, wpm, phrases[]}}, write {text, m}, base?: 'JJJJ-MM', verdict? {summary, better[] ≤ 3, next, level, lang, pv}}]}` – monatliche Vergleichsaufgabe (B1); derselbe Monat wird ersetzt. Kein Live-Abo (`useDocWatch` auf Heute nur in der letzten Monatswoche, im Stand und in der Übung) | ≤ 12 Läufe, Texte ≤ 1.500 Zeichen, Urteil ≤ 1.200 Zeichen, < 120 KiB | `features/progress/compare/store.ts` → `writer.transform`; unerwarteter Aufbau → nichts geschrieben |

**Lokal** (`platform/storage`, nur Bequemlichkeit): `lx:plan:<tag>` (P1), `lx:resume` und `lx:resume:<id>` (Hülle `{v, id, day, savedAt, tabId, route, data}`, ≤ 50 KB; `src/app/resume.ts`).

**LP3 P22:** `vocab/*` und `chunk/*` bekommen das ergänzende Feld `ff` (erster Fest-Tag, `JJJJ-MM-TT`, 10 Zeichen), einmal im selben Schreibvorgang gesetzt (`applyReview.ts`), nie überschrieben, nichts gelöscht.
