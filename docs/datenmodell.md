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
| `chunk/c-<slug>` | zusätzlich `def`, `whyLang`, `origin {v, kind, ref, title, t}`, `src.kind` (`scene`/`mail`/`pitch`/`biz`), `src.ts`; `also` wird nie geschrieben | nur anlegen, wenn die Wendung fehlt; „Wieder aufnehmen“ = `update({hidden:false})` |
| `chunk/<id>` (Wiederholung, 27.09.2026) | nach jeder Antwort im Trainer wie Karten: `fsrs` (zusätzlich), gespiegelt `S`, `D`, `due`, `last`, `state`, `reps`, `lapses`, `stage`, `intro`, dazu `xs`, `hist[] {t, m, g, x}` (≤ 12) und `modes` nur für `cloze`/`produce` (Modi der alten Wendungs-Wiederholung); nie `pa`/`ac`/`co`/`colN`; optional `xEx` (KI-Beispiele) und `mnemo` wie Karten | `writer.transform` (`reviewWrite` → `chunkPatch`, `chunkPatchSchema`), nie angelegt, nie bei `hidden` |
| `vocab/<id>.hist[].x` | Übungsart der Antwort (neu, zusätzlich zu `m`); für „nicht dieselbe Art wie zuletzt“ | wie die übrigen Kartenfelder |
| `log/<tag>` (Wendungen) | Einträge `{t, ok, lang, type:'chunk', id, m:'tr-<art>', q, given, ans, g, ms, ctx}` – Form der alten App, kein `k`; zählen zu „Wiederholen“ (`entryCardKey` → `chunk/<id>`) | gemeinsamer Puffer (`recordAnswer`) |
| `scene/<id>` | Lauf-Vermerk `runs`, `lastRun`, `done:true` (nur wenn fehlend/false); KI-Szenen `scene/sc-ai<ms36>` mit `src:'ai'`, `pv`, `gram`, `words` | `transform` bzw. `createIfMissing` |
| `app/radar.events` | Quellen `k` (Sprechen) und `b` (Business), nur Fehler zu Grammatikthemen, Kategorie der alten App (`topicCat`), ≤ 400 | gemeinsamer Puffer (`recordActivity`) |
| `log/<tag>` | Einträge `{t, ok, lang, type:'speak'|'biz', id, m, q, n, ms, ctx:'spk'|'biz'}` – nie `k:'v'`, nie `ctx:'rev'|'xtra'` | gemeinsamer Puffer (`recordActivity`) |
| `app/profile` | `act[tag].speak` / `speak~` / `biz`; `days`/`answers` + eigene Züge (`countAs`); `voice`, `rate` (Felder der alten App) | gemeinsamer Puffer bzw. `patch` |

Browser-Speicher (nur Bequemlichkeit): `lx:roleplay:<szene>` (Fortsetzen, ≤ 40 KB), `lx:draft:speak:<szene>`, `lx:draft:mail`, `lx:draft:pitch`, `lx:speak-autoplay`, `lx:stt-blocked`.

## Phase 5: Begleiter und Preply-Brücke (nur neue, optionale Felder)

Plan: `docs/phase5-plan.md` §5, E5-22. Alte Felder und Formen bleiben unverändert, es wird nichts gelöscht.

| Dokument | Neu | Schreibweg |
|---|---|---|
| `app/chat` | `since` (Beginn des laufenden Gesprächs); je Nachricht `t`, `lang`, `ctx`, `stopped` | `features/companion/persistChat.ts` (`transform`, ≤ 40 Nachrichten, ≤ 180 KB) |
| `preply/pp<ms>` | `pv`, `heldDay`, `heldMin`; `ctx.kind: 'held'` für „Stunde ohne Plan" | `features/preply/actions.ts` (`createIfMissing`, gehalten per `transform`) |
| `preply/pi<ms>` | `t`, `lang`, `pv`, `items` (Übungen, `tasks` bleibt Liste von Texten), `sel`, `res`, `hwDone` | `features/preply/actions.ts` (`applied:false` vor der Übernahme) |
| `app/pool.items[]` | `id` (`pi<ms>-t<i>`) | Übernahme, kein Verdrängen bei 90 |
| `vocab/<id>` | `src: 'preply' \| 'translate'`, `origin.kind: 'preply' \| 'translate' \| 'companion'` | über `saveCardOp` (nur anlegen oder Satz ergänzen) |
| `grammar/<topic>.errors[]` | Einträge mit `src: 'preply'` (Box 0, fällig +1 Tag) | Deckel 10: erst erledigte, dann älteste |
| `app/radar.events[]` | Einträge mit `s: 'g'` aus Lehrer-Korrekturen, Kategorie der alten App | Sammel-Warteschlange (`learnRecorder.radar`), Deckel 400, nach Zeit |
| `app/profile` | `act[tag].preply`, `minutes[tag]` (keine `days`/`xpDays`/Pflicht), `lxSeq` gegen Doppelzählung | Sammel-Warteschlange (`recordRoundEnd`, `act:'preply'`) |

Browser-Speicher (nur Bequemlichkeit): `lx:draft:chat`, `lx:draft:preply-import`, `lx:translate-history` (≤ 20), `lx:companion-tab`, `lx:companion-tier`.
Abos: `app/chat` nur bei offenem Begleiter, `preply` nur bei offenem Preply-Bildschirm (`src/data/watch.ts`).
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
| `app/assess` | Hülle `{d, t, lang, answers, writings, data}` wie die alte App, dazu `v: 2`, `pv: 'assess@1'`, `tier` (antwortende Stufe), `basis`, `hist[]` (≤ 60), `run {d, t, by}` (Tagessperre); `data.strengths[].ev`, `data.blockers[].ev`, `data.focus.channels`. `data` immer vollständig (fehlend = `null`). Flache Form wird weiter gelesen. | `assessRun` → `writer.transform` (`assessWrite`), vorher `acquire` (240 s) |
| `app/weekly` | `{items: [{w, lang, t, pv, facts[], text {headline, learned[{text, ref}], next}}]}` (≤ 26) | `weeklyRun` → `writer.transform` |
| `app/profile` | `goalMin` (10–40, Standard 25), `sound` (Standard aus), `canDo[<cefrId>] = Lerntag \| null`, `history[].lx = 1` (Tagesbild dieser App), `vtests[].v = 'lx1'`, `act[tag].vtest` | Einstellungen über `app/actions` (optimistisch mit Rückrollen); Tagesbild und Test über die Sammel-Warteschlange |
| `app/profile.plan.why` | `[key, n, ref]` additiv, z. B. `['whyFocus', 0, 'grammar:mixed-cond']`, `['whyDue', 4, 'gram']` | Tagesplan (einmal je Lerntag) |
| `archive/profile-<JJJJ>` | ausgelagerte Tageskarten `days, xpDays, minutes, act, pflicht` eines Jahres (`v: 1, year, from, t`) | `runCompact` (erst nach Abnahme freigeschaltet, `COMPACT_ENABLED`) |
