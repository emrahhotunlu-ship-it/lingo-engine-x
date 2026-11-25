# Wörter-Pflege und Wortfamilie (Mechanik)

Emrahs Entscheidungen vom 25.11.2026 (`docs/entscheidungen.md`): Wortfamilien üben in der normalen Wiederholung ab Stufe 3; wöchentliche Wörter-Pflege, eindeutige Korrekturen direkt, Zusammenführen nur mit seinem OK, Zusammengehöriges verknüpfen statt zusammenführen. Diese Datei beschreibt die Mechanik in der App. Die Inhalte (Korrekturen, Familien) liefert die Lehrer-Routine; echte Daten stehen nie im Repository.

## 1. Auftragsdokument `vmod/care`

Ein Dokument mit allen Aufträgen als Objekt-Map (Kennung → Auftrag). Map statt Liste, damit die Routine neue Aufträge mit `update` dazulegen kann und die App nur den Status ihres Auftrags schreibt, ohne fremde Einträge zu ersetzen.

```json
{
  "v": 1,
  "parts": ["care-2026-12"],
  "ops": {
    "fix-2026-11-25-decline-pos": {
      "k": "fix", "t": 1795600000000, "st": "open", "by": "pflege@1",
      "why": "Stichwort „to decline“ ist ein Verb.",
      "p": "vocab/decline",
      "set": { "pos": { "from": "noun", "to": "verb" }, "de": { "from": "Rückgang, Niedergang", "to": "zurückgehen, sinken; Rückgang" } }
    },
    "merge-2026-11-25-that-said": {
      "k": "merge", "t": 1795600000000, "st": "open", "by": "pflege@1", "why": "Gleiche Wendung zweimal.",
      "keep": "chunk/that-said", "drop": "chunk/c-that-said", "kw": "that said", "dw": "that said", "ok": "2026-11-25"
    },
    "link-2026-11-25-retention": {
      "k": "link", "t": 1795600000000, "st": "open", "by": "pflege@1", "why": "Eigener Fachbegriff.", "sm": false,
      "hs": { "vocab/retention": "retention", "vocab/customer-retention": "customer retention" }
    },
    "fam-2026-11-25-accurate": {
      "k": "fam", "t": 1795600000000, "st": "open", "by": "pflege@1",
      "p": "vocab/accurate", "w": "accurate", "from": null,
      "fam": [
        { "form": "accuracy", "pos": "noun", "de": "Genauigkeit", "ex": "OCR [accuracy] has improved a lot with the new engine." },
        { "form": "accurately", "pos": "adverb", "de": "genau, präzise", "ex": "The system [accurately] reads invoice numbers." }
      ]
    }
  }
}
```

Nach dem Anwenden setzt die App je Auftrag `st` (`done` · `skip` · `err`), `at` (Zeit) und `msg` (Grund oder `null`; `same` = war schon so). Alle anderen Felder bleiben, wie die Routine sie schrieb.

| Feld | Bedeutung |
|---|---|
| Kennung | `^[a-z0-9][a-z0-9_-]{0,47}$`, eindeutig über alle Teile |
| `k` | `fix`, `merge`, `link`, `fam` |
| `t` | Zeitpunkt des Auftrags (ms); angewendet wird nach `t`, dann Kennung |
| `st` | `open` wartet; nur `open` wird angewendet |
| `why`, `by` | Begründung des Lehrers (≤ 200 Zeichen), Absender |
| `fix.p`, `fix.set` | Karte und Felder `de`, `pos`, `ex`, `word` (nur `vocab/`) bzw. `en` (nur `chunk/`), je `{from, to}`; `from: null` = Feld fehlt/leer |
| `merge.keep`, `.drop`, `.kw`, `.dw`, `.ok` | Gewinner, Verlierer, ihre erwarteten Stichwörter, Emrahs OK (Tag). Ohne `ok` ist der Auftrag ungültig |
| `link.hs` | 2–6 Karten mit erwartetem Stichwort; `sm` = Lehrer-Hinweis „eigentlich ein Doppel“ (ohne Wirkung) |
| `fam.p`, `.w`, `.from`, `.fam` | Karte, erwartetes Stichwort, erwarteter bisheriger Stand von `famx` (`null` = keiner), neue Liste (1–6 Formen) |

Wortarten in `fam[].pos`: `noun`, `verb`, `adjective`/`adj`, `adverb`/`adv`, `phrasal verb`, `phrase`, `preposition`, `conjunction`. Abgefragt werden nur Nomen, Verb, Adjektiv und Adverb; die anderen stehen nur auf der Wortseite. `ex`: 8–200 Zeichen, genau eine `[Form]` (gebeugt erlaubt, z. B. `[implemented]`).

**Größe (A6 Nr. 6):** ein Dokument höchstens 256 KiB. Der erste Durchgang (86 Korrekturen, 9 Zusammenführungen, 43 Verknüpfungen, 130 Familien) braucht etwa 90 KB. Wird `vmod/care` zu groß (Richtwert 150 KB), legt die Routine ein Teil-Dokument `vmod/care-<name>` (`^care-[a-z0-9-]{1,24}$`, höchstens 12) mit demselben Aufbau `{v: 1, ops}` an und trägt seinen Namen in `vmod/care.parts` ein. Erledigte Aufträge bleiben stehen (sie sind das vollständige Protokoll).

Schemas: `src/modules/vocab/data/schemas.ts` (`careOpSchema`, `careDocSchema`, `famEntrySchema`).

## 2. Ablauf in der App

1. Beim App-Start mit eingeschalteter Wörter-App liest `features/vocab/autoSwitch.ts` einmal alles (dasselbe Lesen wie das Nachholen alter Antworten), holt alte Antworten nach und ruft dann `startCare` (`modules/vocab/ui/switch.ts`). Wächter wie beim Nachholen: Wörter-App an, Umrechnung fertig, Profil gültig, nichts gekappt.
2. `applyCare` (`modules/vocab/data/care.ts`) nimmt jeden offenen, gültigen Auftrag; ungültige werden `err`/`shape`.
3. Jede Karte wird mit `writer.transform` auf dem **frischen** Stand gerechnet (`modules/vocab/domain/care.ts`): passt der erwartete alte Wert nicht mehr → `skip` (`stale:<feld>`), Karte fehlt → `skip`/`missing`, schon neu → `done`/`same`. Nie wird Neueres überschrieben.
4. Danach schreibt EIN `transform` je Auftragsdokument die Status, nur für Aufträge, die dort noch `open` sind.
5. Kein Wiederholen in einer Schleife: `err` bleibt, bis die Routine den Auftrag wieder auf `open` setzt. Weil jeder Schritt idempotent ist, schadet ein zweiter Lauf (zweites Gerät, Abbruch zwischen Karte und Status) nie.

### Was jede Art an der Karte schreibt

- **fix:** nur die geänderten Felder; alle oder keins. Alter Wert in den Pflege-Verlauf `care` (`[{id, t, k, old}]`, höchstens 50, neueste zuletzt).
- **merge:** am Verlierer `hidden: true`, `merged: {into, t, id, h}` (`h` = war schon pausiert) und – mit Lernstand – `lex.of = keep` (das Doppel-Zeichen der Wörter-App). Nichts wird gelöscht: Lernstand, alte Felder und Antworten (Dokument und Verlauf `vlog`) des Verlierers bleiben, der Gewinner wird nicht verändert. `lex.of`/`hidden` halten den Verlierer aus Plan, Abfragen und allen Zählern (Katalog, „Wörter im Lernen“, Tageszähler, alter Bereich). Übersprungen bei falschem Stichwort, wenn der Gewinner selbst ein Doppel ist (keine Ketten) oder der Verlierer schon in ein anderes Wort zusammengeführt ist.
- **link:** `rel` an jeder Karte der Gruppe um die anderen ergänzt (nie entfernt, höchstens 12). Erst werden alle Karten frisch geprüft, dann geschrieben.
- **fam:** `famx` gesetzt, alter Stand in `care`. Das alte Feld `fam` (`{noun, verb, adj, adv}` aus dem C1-Paket, `src/domain/c1pack/packFields.ts`) bleibt unberührt und wird weiter gelesen; die Wortseite zeigt es, solange es kein `famx` gibt.

Neue Kartenfelder (`famx`, `rel`, `merged`, `care`) sind in `src/data/schemas.ts` tolerant (`loose`) eingetragen.

## 3. Abfrage „Wortfamilie“

- Form `family` (Benutzen-Spur, bis „Leicht“, freier Abruf; `grade.ts`) auf den Stufen 3–7 der Leiter (`forms.ts`), nur mit geprüfter Familie (`famx`, abfragbare Wortart) und höchstens jede 3. Benutzen-Abfrage des Worts (`familySlot`, gezählt über `fq.h`), nie zweimal in Folge. Keine Extra-Zeit: sie ersetzt eine fällige Abfrage.
- Karte (`domain/card.ts` `familyCard`, `domain/flow.ts`): Satz der Form, Lücke an der markierten Stelle, Stammwort in Klammern dahinter („The new billing system was a real ___ (achieve) for the team.“). Formen reihum. Gesucht ist genau die Form: keine Synonyme des Stichworts; eine andere Form der Familie (auch das Stichwort selbst) gilt als „richtige Familie, falsche Wortart“.
- Gebucht wird an der Karte selbst (kein eigener Lernstand); der Satz zählt weder als „zuletzt gezeigter Satz“ noch für „satzgebunden“.
- Vier Fragen: Aufgabe „Bilde aus dem Wort in Klammern die passende Form.“, Wozu, Lösungszeile (deine Eingabe / Lösung), Warum mit Form, Wortart und Bedeutung („achievement (n) – Leistung, Erfolg. Hier braucht der Satz ein Nomen, gebildet aus „achieve“.“). Texte `vmTask_family`, `vmWozu_family`, `vmWhyFam*` in `src/i18n/parts/vm.*.ts`.

## 4. Wortseite

Abschnitte „Wortfamilie“ (Form, Wortart, Bedeutung) und „Gehört zusammen mit“ (verknüpfte Karten, antippbar zur Wortseite). Der Gewinner nennt die zusammengeführten Doppel; die Seite eines Verlierers zeigt „… zusammengeführt und ruht“ mit Verweis auf den Gewinner und keine Aktionen.

## 5. Wie die Routine Aufträge anlegt

1. Lehrer-Durchgang über neue/geänderte Wörter (english-teacher gegengelesen). Eindeutige Korrekturen und Familien gehen direkt als `fix`/`fam`; Zusammenführen erst nach Emrahs „OK“ (Tag in `ok`); Zusammengehöriges als `link`.
2. Für jeden Auftrag den **aktuellen** Wert aus der Live-Datenbank lesen und als `from` bzw. `kw`/`dw`/`w`/`hs` eintragen (sonst überspringt die App ihn).
3. Mit ArtifactData `update` auf `vmod/care` nur neue Kennungen unter `ops` einmischen (fehlt das Dokument: `set` mit `{v: 1, ops: {...}}`). Nie bestehende Aufträge ersetzen; einen Auftrag erneut versuchen = nur `st: "open"` setzen.
4. Größe prüfen (Abschnitt 1); bei Bedarf neues Teil-Dokument und `parts` ergänzen.
5. Beim nächsten App-Start wendet die App an; das Ergebnis steht in `st`/`msg` und im Diagnose-Protokoll (`vocab:care`).

Testdaten: `src/platform/dev/careSample.ts` (erfunden; Dev-Server `?fake=care`), Tests `tests/unit/vocab/care.test.ts`, `tests/e2e/vcare.spec.ts`.
