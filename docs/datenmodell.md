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
