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
