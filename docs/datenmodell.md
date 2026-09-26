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
     - Profil: `days`/`xpDays`/`minutes`/`act` je Tag mit dem Maximum, Zähler nur nach oben,
     - Kurs: nur fehlende Lektionen,
     - Log: Einträge vereinigen,
     - Karten und Themen: nur wenn `last` neuer ist,
     - sonst nur fehlende Felder.

     Listen werden vereinigt (Fehlersätze über `q`, Tageswerte über `d`), nichts wird gekappt. Lesen, Rechnen und Schreiben laufen in einem Schritt der Warteschlange (`writer.transform`). `daily/*`, `feed/*` und unbekannte Pfade bleiben aus.
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
