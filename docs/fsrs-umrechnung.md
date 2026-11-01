# Umrechnung alter Lernstände in FSRS-Startwerte

Kap. 9, Regel 5: „Alte Vokabel-Lernstände werden dokumentiert in FSRS-Startwerte umgerechnet."
Umsetzung: `src/domain/srs/legacyFsrs.ts`. Tests: `tests/unit/legacyFsrs.test.ts`.

## Ausgangslage

Die alte App (siehe `docs/altapp-analyse.md`, Abschnitt 4) plant Wiederholungen mit einem eigenen, FSRS-ähnlichen Modell:

| Feld | Bedeutung in der alten App |
|---|---|
| `S` | Stabilität in **Tagen** (höchstens 365) |
| `D` | Schwierigkeit von 1 bis 10 (Start 5) |
| `due`, `last` | Zeitpunkte in Epoch-Millisekunden |
| `state` | `new` · `learning` · `review` |
| `reps`, `lapses` | Wiederholungen, Fehler |

Die Vergessenskurve ist die von FSRS v4: `R(t) = (1 + t / (9·S))^-1`.

## Warum S direkt übernommen werden darf

In FSRS ist die Stabilität als die Zeit definiert, nach der die Abrufwahrscheinlichkeit auf 90 % gesunken ist.
Für die alte Kurve gilt bei `t = S`: `R = (1 + 1/9)^-1 = 0,9`.
Beide Modelle meinen mit S also dieselbe Größe. Die Einheit ist in beiden Fällen Tage.
Die Kurvenform von FSRS-6 (ts-fsrs 5) weicht zwischen den Stützstellen leicht ab. Das korrigiert sich mit jeder neuen Bewertung von selbst.

## Regeln

| Alte Karte | FSRS-Startwert |
|---|---|
| `state = new`, `S ≤ 0` oder ohne Wiederholung | `State.New`, Stabilität 0, Schwierigkeit 0, fällig = alter `due` oder jetzt |
| `state = review` | `State.Review` |
| `state = learning` und `lapses > 0` | `State.Relearning` |
| `state = learning` ohne Fehler | `State.Learning` |
| `S` | `stability = S`, begrenzt auf 0,1–36.500 Tage |
| `D` | `difficulty = D`, begrenzt auf 1–10; fehlt D, dann 5 |
| `due` | übernommen; fehlt es, dann `last + S Tage` |
| `last` | `last` (0 oder fehlend → `null`) |
| `reps`, `lapses` | übernommen (ganzzahlig, ≥ 0; `reps` bei gelernten Karten mindestens 1) |
| `scheduledDays` | `round((due − last) / 1 Tag)` |

## Speicherung

Die Werte kommen **zusätzlich** in das neue Feld `fsrs` der Karte (`vocab/<id>`, `chunk/<id>`):

```json
{ "v": 1, "due": 1789920000000, "stability": 12.5, "difficulty": 6.2, "state": 2,
  "reps": 7, "lapses": 1, "last": 1789660800000, "scheduledDays": 12, "learningSteps": 0, "src": "legacy" }
```

Die alten Felder `S`, `D`, `due`, `last`, `state`, `stage` bleiben unverändert stehen (Kap. 9, Regel 2).
Die Umstellung schreibt mit `update({fsrs})`. Das verlangt ein bestehendes Dokument und verschmilzt nur dieses eine Feld.
Ab Phase 1 plant die App mit `fsrs` weiter (`toTsFsrsCard`).
Startvokabeln ohne eigenes Dokument sind neue Karten. Sie bekommen ihr `fsrs`-Feld bei der ersten Wiederholung.

---

## Wörter-Modul V1 (31.10.2026): Umrechnung in `lex` mit zwei Spuren

Plan: `docs/umbau/vokabeln/plan.md` §9. Umsetzung: `src/modules/vocab/domain/migrate.ts` (rein) und `src/modules/vocab/data/migrate.ts`
(Trockenlauf, Sperre, Schreiben). Tests: `tests/unit/vocab/migration.test.ts`. ts-fsrs ist auf **exakt 5.4.2** festgelegt.

Die Umrechnung schreibt **nur** das neue Feld `lex` (und `vlog/*`, `app/schema.vocabModule`). Die Felder oben (`fsrs`, `S`, `D`, `due`, `stage`,
`hist`, `modes`, `xs`, `pa`/`ac`/`co` …) bleiben **bytegleich**. Gespiegelt wird erst bei der nächsten Antwort mit Planwirkung.

### Spuren
| Spur | Bedeutung | Startwert |
|---|---|---|
| `u` Verstehen | Bedeutung erkennen, nennen | siehe „Startpunkt“ |
| `b` Benutzen | Form selbst bilden (frei getippt) | aus den freien getippten Antworten im Verlauf, sonst leer |

Spurfelder: `due`, `s` (Stabilität), `d` (Schwierigkeit), `st` (0 neu, 1 lernt, 2 Wiederholung, 3 neu lernen), `reps`, `lapses`, `last`, `sd`, `ls`
wie `fsrs` (kurz benannt). Planer: ts-fsrs 5.4.2, `request_retention` = `vcfg.ret` (Standard 0,9), `maximum_interval` 365, ohne Fuzz und ohne
Kurzzeit-Schritte (das machen Korridor, Lastausgleich und Lernschritte des Moduls).

### Startpunkt
| Fall | Verstehen `u` | Benutzen `b` |
|---|---|---|
| Karte neu (`state: new` oder `reps = 0`) | leer, `intro = null` (das Modul führt sie ein) | leer |
| Verlauf **vollständig** (Zahl der Einträge aus `hist` und `log/<Tag>` ≥ `reps`, `hist` nicht voll) | leere Spur, ab der ersten Antwort nachgespielt | leere Spur, ab der ersten freien getippten Antwort nachgespielt |
| Verlauf **unvollständig** (sonst) | gespeicherter Stand: `fsrs` (sonst `S`, `D`, `due`, `last`, `reps`, `lapses`) unverändert, also `s = stability`, `d = difficulty` (1–10), `st` aus `state` | aus den vorhandenen freien Einträgen nachgespielt |
| kein Verlauf, alte Stufe 4–5 | gespeicherter Stand | `s = min(stability, 7)`, `d = difficulty`, `last` wie alt, `due` aus der Rückstandsverteilung |

### Nachspielen (je Antwort)
- Form aus der alten Übungsart (`x`, sonst `m`): frei getippt (`type`, `cloze`, `cloze_part`, `situation`, `produce`, `colloc`, `say_it`) → Benutzen
  (Kopplung: Note ≥ 2 bucht dieselbe Note auch auf Verstehen, Again nicht); `cloze_hint`, `tiles` → Benutzen höchstens Hard; Hören/Diktat →
  Verstehen höchstens Good; Auswahl (`mc_*`, `recog`, `ctx_mc`, `listen_mc`, `match`, `find_trap`, `contrast`) → **keine Wirkung**, nur Verlauf;
  `flip` (Aufdecken) → nur Verstehen; `known` und ungeprüfte Antworten (`u: 1`) → nichts.
- **Je Lerntag und Spur zählt nur die erste Antwort** (Tageswechsel 04:00 Europe/Berlin).
- Fehler laufen als Again mit. Override (`log.override`) wirkt nicht. Eine `hist`-Antwort mit Note ≥ 3 ohne passenden Log-Eintrag an einem Tag,
  für den es ein Log gibt, zählt höchstens Hard.
- Belege `ev.f`: Lerntage nach dem Einführungstag mit freiem richtigem Abruf ohne Tipp (höchstens 8).

### Stufe (1–7)
Mit Benutzen-Spur: 3; 4 bei ≥ 2 Tagen in `ev.f`; 5 zusätzlich bei ≥ 3 Tagen und `b.s ≥ 7`; 6 bei `b.s ≥ 21`; **höchstens alte Stufe + 1, nie über 6**
(Stufe 7 braucht eigene geprüfte Sätze ab Stufe 5, die es im Bestand nicht gibt). Ohne Benutzen-Spur: `min(3, alte Stufe + 1)`, alte Stufe 4–5 → 4.

### Rückstand beim Umstieg (F4)
Alle Lexeme, deren Spur vor dem heutigen Lerntag fällig war, werden nach Gefährdung sortiert (Abrufwahrscheinlichkeit der führenden Spur, kleinste
zuerst) und über **7 Lerntage** verteilt, mit gleich vielen erwarteten Minuten je Tag (Median-Zeit je Form). Geschrieben wird nur `u.due` bzw. `b.due`
auf 04:00 des Zieltags. Danach regelt der Tagesplan den Rest (höchstens 2 Tagesbudgets je Tag, nur Randwörter werden weiter verschoben, je
höchstens 3-mal).

### Rückweg (Schalter `vcfg.mod`)
Ist das Modul aus, plant der alte Bereich aus den gespiegelten alten Feldern. Beim Einschalten spielt das Modul nur Antworten mit `t > lex.sync`
nach (gleiche Regeln, entdoppelt über `t`). Ist `hist` voll und liegt der älteste Eintrag nach `lex.sync`, ist die Lücke unvollständig: gemeldet,
nicht geraten.
