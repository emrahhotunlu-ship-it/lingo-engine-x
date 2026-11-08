# Lernkern – Bauplan (Entwurf 08.11.2026)

Leitvorgaben (Emrah, 08.11.2026, `docs/entscheidungen.md`): Grammatik wie aus einem Buch, Vokabeltrainer mit Stufen, Lernen durch Anwenden. Fehler werden an SEINEM Satz erklärt (du → richtig · warum · nochmal).
Vorgehen: Inhalte zuerst als Muster zum Ausprobieren → Emrahs OK → Bau in Schritten → **ein** Test-Link → live nur nach „Ja live nehmen“. Kein Design-Wechsel, höchstens ein Live-Gang pro Woche.

## Grundsatz
Neuer Bereich `src/modules/lernkern/` **neben** dem Bestehenden. Er liest alte Daten nur und schreibt ausschließlich in eigene, neue Pfade. Schalter `app/profile.lkcfg.mod` (Standard 0). Ist er aus, bleibt alles wie heute, die Lernkern-Teil-Datei wird nicht geladen. Kein Wort wird gelöscht.

**Wiederverwendet:**
- Bausteine: `ExerciseShell`, `KineticGap`/`HiddenInput`, KI-Tor `src/ai/gate.ts`, Vorlagen-Muster `src/prompts`, `Writer.transform`
- Logik: FSRS-Spur aus `vocab/domain/tracks.ts` (als Kopie mit Gleichheitstest), `checkAnswer` (über die Tür `vocab/api` → `loadWordKit`), `alignWords`, Datumslogik
- Inhalte: `content/apply/frames.json`, `content/grammar/patterns/*`

**Nicht wiederverwendet:**
- `learnRun.ts`, Wörter-Planer (7 Stufen, zwei Spuren)
- `features/grammar/session.ts`/`GrammarItem.tsx`
- das `vlog`-Tupel

## Daten (neue Pfade)
| Pfad | Inhalt |
|---|---|
| `app/profile.lkcfg` | `{mod: 0\|1, own?: 0–5}` |
| `lkw/s00`…`s31` | Wortstände als Map, per Hash auf 32 Teile verteilt: Stufe `st` 1–5, Fehler in Folge `e`, FSRS-Spur `tr`, freie Abruftage `ok`, Satz-Rotation `si`, pausiert `p`, Herkunft `m` |
| `lk/g` | Fortschritt je Einheit und Teil A–E |
| `lk/day` | eingefrorener Tagesplan (in `REPLACEABLE`) |
| `lk/eix`, `lk/mig`, `lk/lock`, `lk/dxq` | Verzeichnis, Übernahme-Marke, Sperre, Claude-Diagnosen als Katalog-Kandidaten |
| `lke/<JJJJ-MM>-a\|b` | Fehler mit Diagnose `dx` und Rückruf-Stand `rs` (+1/+3/+7 Tage) |
| `lkk/<JJJJ-MM>` | Kennzahlen als Mengen |

Etwa 75 Dokumente pro Jahr. Schreibvorgänge nur bei einer Antwort oder einem Blockende.

**Übernahme** (Probelauf → Sicherung → Übernehmen, wiederholbar, sperrt bei unsicherer Lesung):
- `lex`-Stufe lv → Lernkern-Stufe: lv 1–2 → 2, lv 3–4 → 3, lv 5–6 → 4, lv 7 oder (lv ≥ 5 und s ≥ 21) → 5. Die FSRS-Spur wird unverändert kopiert.
- Eigene, nie eingeführte Wörter werden Kandidaten für „neu“.
- Offene Grammatikfehler werden `lke`-Einträge.
- Beim Wieder-Einschalten gewinnt je Wort die neuere Spur, eine Stufe sinkt dabei nie.

## Vokabeltrainer
Emrah 08.11.2026: „Ich will nicht bei jedem Wort einen Satz schreiben müssen, dann ist mein Tempo zu langsam.“ Deshalb tippt er pro Wort **nur das Wort in die Lücke**. Eigene Sätze gibt es nur im Block Anwenden (2 Wörter pro Tag).

| Stufe | Aufgabe | Aufstieg |
|---|---|---|
| 1 Kennenlernen | Bedeutung, Satz, Merksatz zur deutschen Falle, ein Tipp | sofort |
| 2 Erkennen | Lückensatz (mit DE-Übersetzung), 4 Wörter zur Auswahl, Ablenker sicher falsch | richtig → 3 |
| 3 Erinnern | neuer Lückensatz, Wort tippen, Anfangsbuchstaben als Hilfe | richtig → 4 |
| 4 Frei | neuer Lückensatz, Wort tippen ohne Hilfe | richtig an 2 Tagen → 5 |
| 5 Fest | jedes Mal ein neuer Lückensatz, große Abstände | – |

- Je Karte 4 geprüfte Lückensätze, eine Liste `auch_richtig` je Satz („Passt auch. Gesucht war: …“) und 3 Ablenker.
- Zwei Fehler in Folge → eine Stufe zurück. Ein Tippfehler zählt als „fast richtig“.
- Abstands-Deckel je Stufe: 2, 7, 21 und 365 Tage.
- Fest 5 neue Wörter pro Tag, eigene zuerst (Standard bis 3), Rest aus einer geprüften C1-Business-Liste.
- Die Stufenleiste mit der Zahl je Stufe ist überall sichtbar.

## Grammatik-Einheiten (wie ein Buchkapitel)
- **A Verstehen:** Regel höchstens 60 Wörter, Tabelle, deutsche Falle.
- **B Form bilden:** Lücke mit Verb-Vorgabe.
- **C Unterscheiden:** A/B.
- **D Übersetzen DE→EN:** gewertet wird nur das Prüfmerkmal (benannte Erkenner `must`/`mustNot`).
- **E Anwenden:** eigener Satz, Claude korrigiert.

Geschafft je Teil: B ≥ 6/8, C ≥ 6/8, D ≥ 4/6, E 2 angenommene Sätze. Jede Einheit hat zurückgehaltene Aufgaben (`pool: rec`) für den Rückruf mit **neuem** Satz.

## Diagnose (Kern)
1. Katalog der Aufgabe (`dx.if`/`dx.hit`): sofort, ohne KI.
2. Sonst `lk-diagnose@1` über das KI-Tor, Stufe `quick`, zod-Prüfung: `du` wörtlich aus seiner Antwort, `richtig` aus der Lösung, `warum` genau EIN Satz, der du oder richtig nennt. Höchstens ein Neuversuch, nur bei Schema-Fehler (A6 Nr. 2 und 3).
3. Rückfall ohne KI über Satzvorlagen. Der Knopf „Claude erklären lassen“ bleibt.

Gespeichert in `lke`, damit nie zweimal gefragt wird. Anzeige: du → richtig · warum · „Gleich nochmal“ direkt in der Karte.

## Tag und Messgrößen
- 25 Minuten = 3 Rückruf / 10 Wörter / 9 Grammatik / 3 Anwenden (Anteile 12/40/36/Rest).
- Der Plan wird beim ersten Öffnen eingefroren, je Block gibt es einen Zeitdeckel. Pflicht und Serie laufen über `recordRoundEnd`/`recordProfileFields`.
- Messgrößen: „Wörter sicher behalten pro Woche“ (frei richtig nach ≥ 7 Tagen Pause) und „Fehler je Grammatik-Thema pro Woche“ mit Vergleich zur Vorwoche.

## Navigation
Die 4 Reiter bleiben. Ist der Schalter an, zeigen ihre Wurzeln den Lernkern (Vorbild `VocabTab`/`vocabModuleOn`). Der Schalter sitzt in Einstellungen › Lernen, mit Probelauf-Bericht.

## Bauschritte (je ein sichtbares Ergebnis)
0. Musterinhalte zum Ausprobieren und Emrahs OK (läuft).
1. Gerüst und Schalter, Isolationstest.
2. Datenmodell, Kapazitätstest.
3. Inhalte Charge 1 (40 Karten, 3 Einheiten) mit Lehrer-Gegenlesung und Bildschirm-Durchsicht `lkReview`.
4. Vokabeltrainer Stufen 1–3.
5. Übernahme.
6. Grammatik A–D.
7. Diagnose und Rückruf.
8. Anwenden (Stufe 4/5, Teil E).
9. Tagesablauf und Messgrößen.
10. Prüfer (je eine Prüfung plus eine Nachprüfung), `verify`, **ein** Test-Link.

## Risiken
- **Getrennte Lernstände (alt/neu):** Hinweis im Schalter; die neuere Spur gewinnt.
- **Falsches „falsch“ bei freien Sätzen:** nur Zielwort bzw. Merkmal werten, „unsicher“ statt „falsch“, „Ich lag richtig“.
- **Inhaltsmenge:** Chargen mit Gegenlesung.
- **Pflicht nur aus einer Quelle zählen.**
- **Tippzeit am Handy:** echte Zeiten messen.
- **KI-Kosten:** Katalog zuerst, Zwischenspeicher.
- **Ladezeit:** Teil-Datei nachladen, Budget.
- **Zu viel auf einmal:** Schritte einzeln prüfen.
