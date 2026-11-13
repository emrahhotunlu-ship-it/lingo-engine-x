# Politur P3 – Qualitätstor Grammatik-Inhalte (13.11.2026)

Auftrag (Plan §P3 Nr. 7): die Aufgaben, die in Emrahs Fokus-Themen drankommen, blind lösen und unfaire Aufgaben reparieren oder stilllegen.
Geprüft wurden `src/content/grammar/tasks-v2.json` (Umformen, Fehler finden, Bedeutungspaar) und `src/content/grammar/book.json` (Übung A/B) für
acht Themen: conditionals, mixed-cond, c1-participle, modals-deduction, passive, future-perf-cont, past-perfect, used-to.

## Vorgehen
1. Lernenden-Sicht ohne Lösung exportiert (Werkzeug G1, `scripts/grammar/g1/blind.g1.ts`, `G1_MODE=export`): **323 Aufgaben**.
2. Jede Aufgabe blind gelöst (erste natürliche Antwort) und zusätzlich **218 weitere Antworten** eingereicht, die ein B2/C1-Lernender ebenfalls
   geben könnte: andere gültige Formulierungen, britische Formen, eine zweite Korrekturstelle bei „Fehler finden“ – und bewusst falsche Formen als Gegenprobe.
3. Alle 541 Antworten durch die echte Prüfung der App geschickt (`G1_MODE=score`: `checkGrammar`, `checkKwt`, `checkFind`, `checkMeaning`).
4. Jede Abweichung aus Lehrersicht beurteilt (Rolle `.claude/agents/english-teacher.md`): mehrdeutig? offener Lösungsraum? gültige Lösung
   abgelehnt? gehört der Fehler zum Muster?

**Offen gesagt:** In dieser Helfer-Sitzung stand kein Werkzeug für Unter-Agenten zur Verfügung. Das blinde Lösen und die Beurteilung hat deshalb der
Bau-Helfer selbst in der Lehrer-Rolle gemacht; „blind“ war es durch das Werkzeug (Antworten ohne Blick auf die Lösung, gewertet von der echten
Prüfung). Die eine vorgesehene Gegenlesung durch `english-teacher` (arbeitsweise.md, eine Prüfung + eine Nachprüfung) steht noch aus und sollte
genau diese Liste lesen.

## Ergebnis in Zahlen
| | Zahl |
|---|---|
| Aufgaben blind gelöst | 323 (tasks-v2: 239, Buch A/B: 84) |
| erste natürliche Antwort von der App abgelehnt | **0** |
| zusätzliche Antworten | 218, davon zunächst abgelehnt 71 |
| davon zu Recht abgelehnt (wirklich falsch, Wortzahl überschritten, Stichwort ignoriert) oder ans Claude-Urteil übergeben | 48 |
| davon **zu Unrecht abgelehnt** → repariert | 23 Antworten in 26 Aufgaben (tasks-v2) + 3 (Buch) |
| stillgelegt (`retired.json`) | 2 |
| bekannte Befunde aus dem Prüfbericht (`audits.md`) | 6 von 6 bearbeitet |

Harte Unfairness in den acht Fokus-Themen nach der ersten natürlichen Antwort: 0 von 323. Die Lücke lag bei der **zweiten gültigen Antwort**:
rund 7 % der Aufgaben (23 von 323) lehnten eine Antwort ab, die ein Lehrer gelten ließe.

**Nachprüfung (13.11.2026, Gesamtlauf der Unit-Tests):** Die britischen „got“-Formen in `md-ch-k2`, `md-ih-k1` und `ut-get-k1` hatte nur das
Werkzeug G1 abgelehnt; das Urteil der App (`judge`) nimmt sie schon als britische Form an und sagt das dazu. Diese Ergänzungen sind deshalb wieder
entfernt (sonst fehlte der Hinweis „britische Form“). Alle übrigen Ergänzungen bleiben.

## Änderungen je Aufgabe
Nur Ergänzungen (weitere gültige Lösungen, zweite Korrekturstelle `errAlt`); keine Aufgabe wurde gelöscht, die Reihenfolge in `tasks-v2.json`
bleibt (die IDs `kwt-v2-<n>` hängen an der Position). Die Teile unter `scripts/grammar/parts/<thema>/v2.json` sind gleich nachgezogen.

### Fokus-Themen
| Aufgabe | Befund | Änderung |
|---|---|---|
| `cn-z-k2` conditionals, Umformen | „when a build has failed“ ist richtig, wurde abgelehnt | gilt jetzt (Wortzahl 3–5) |
| `cn-i-f1` conditionals, Fehler finden | „unless … don’t approve“: auch „unless → if“ ergibt einen richtigen Satz | zweite Korrekturstelle `errAlt` |
| `mc.kwt6` mixed-cond | „were not so inflexible“ (wörtlichste Umformung) abgelehnt | gilt jetzt, dazu „were less inflexible“ u. a. |
| `mc.kwt7` mixed-cond | „had never sent“ abgelehnt | gilt jetzt |
| `mc.kwt31` mixed-cond | „If we had tested“ erfüllt Stichwort und Wortzahl, wurde abgelehnt | gilt jetzt (auch richtig) |
| `mc.find32` mixed-cond | „If had the client signed“: „If the client had signed“ wurde abgelehnt | eine Stelle „If had the client“ mit beiden Lösungen |
| `cp-sub-f2` c1-participle | hängendes Partizip: Hauptsatz umbauen („I thought the figures were wrong.“) abgelehnt | zweite Korrekturstelle `errAlt` (wie `cp-sub-f1`) |
| `md-ch-k2`, `md-ih-k1` modals-deduction | britisches „got“ statt „gotten“: das Werkzeug G1 wertete es als falsch, die App (Tutor-Urteil `judge`) nimmt es schon als britische Form an („britisch, gilt“) | **nicht ergänzt** (Nachprüfung 13.11.: als feste Lösung eingetragen, verlöre die Antwort den Hinweis „britische Form“; Gold-Liste `uk-got-kwt`) |
| `md-mi-k1`, `md-cn-k2` modals-deduction | „might still be“, „can’t possibly be“ abgelehnt | gilt jetzt |
| `pv-pre-f2` passive | fehlendes „with“: Tipp auf das Nachbarwort „quickly“ zählte als falsche Stelle | zweite Korrekturstelle `errAlt` |
| `fpc-cn-f1`, `fpc-cn-k1`, `fpc-pf-k1` future-perf-cont | „will be“, „will be at“, „will already have sent“ abgelehnt | gilt jetzt |
| `fpc-pf-f4` future-perf-cont | „will launch“ ergibt einen richtigen Satz, wurde abgelehnt | gilt jetzt |
| `fpc-cp-f1` future-perf-cont | „be“ streichen („Will you need …?“) abgelehnt | zweite Korrekturstelle `errAlt` |
| `pp-ft-f1` past-perfect | „had ever won“ und (US-üblich) „won“ abgelehnt | gilt jetzt |
| `pp-rep-f3b` past-perfect | „they signed … two days earlier“ ist im US-Englisch normal | gilt jetzt |
| `pp-inv-m1` past-perfect (und `wo-hs-m1`) | Ja/Nein-Frage „Sagen beide Sätze dasselbe?“ passt nicht zu den Antworten a / b / beide | Frage umformuliert („Welcher Satz sagt: …?“) |
| `ut-get-k1` used-to | „was used to working“ abgelehnt; britisch „had got used to working“ nimmt die App schon als britische Form an | „was used to working“ gilt jetzt; die britische Form bleibt beim Urteil `judge` (Gold-Liste `kwt-got-used-british`) |
| Buch `pp-a4` | „had ever led“ abgelehnt | gilt jetzt |
| Buch `ut-a4` | „never used to“ abgelehnt | gilt jetzt |
| Buch `pv-a5` | „will have been delivered“ (mit „before the end of next week“ richtig) abgelehnt | gilt jetzt |

### Bekannte Befunde aus dem Prüfbericht
| Stelle | Aufgabe | Befund | Änderung |
|---|---|---|---|
| `tasks-v2.json:8671` | `cmp-than-k2` | Umformung mit offenem Lösungsraum („The test took ___.“) | 7 weitere gültige Lösungen („an hour longer than planned“, „more time than planned“ …) |
| `:20400` | `lk-dsp-f1` | zweite Korrektur fehlt („Despite the project being late“) | `errAlt` an „was → being“, dazu „Despite the fact that“ |
| `:41866` | `rs-bs-k2` | richtige Antwort abgelehnt („he hasn’t seen“, wenn es noch gilt) | gilt jetzt, Begründung nennt beide Formen, die widersprechende Regel ist entfernt |
| `:3132` | `em-wc-f2` | weich: „The thing we need most …“ abgelehnt | gilt jetzt |
| `:14733` | `ep-f8` | der Fehler (Verbform nach „must“) gehört nicht zum Muster „Objekt nach vorn“ | **stillgelegt** |
| `:14796` | `ep-m2` | ohne Lernwert: die Antwort steht wörtlich im Satz („cannot support“) | **stillgelegt** |

### Ersatz für die stillgelegten Aufgaben (Nachprüfung 13.11.2026)
Damit jedes Muster von `emph-plus` weiter mindestens 2 „Fehler finden“ und 1 Bedeutungspaar hat (Abnahme der neuen Themen), stehen hinten in
`tasks-v2.json` (und in `scripts/grammar/parts/emph-plus/v2.json`) zwei neue Aufgaben – **noch ohne Gegenlesung durch `english-teacher`**:

| Aufgabe | Muster | Inhalt |
|---|---|---|
| `ep-f9` | ep.object-front | „Those figures did we check twice.“ → „Those figures we checked twice.“ (nach dem vorgezogenen Objekt keine Umstellung; der Fehler gehört zum Muster) |
| `ep-m5` | ep.concession | a „Small as our team is, we finished the project on time.“ · b „As our team is small, we finished the project on time.“ – Frage: In welchem Satz ist das kleine Team der Grund? Lösung b (Einräumung mit Adjektiv vor *as* gegen *as* = „weil“) |

## Stilllegen – wie es wirkt
`src/content/grammar/retired.json` (Schlüssel `thema|satzschlüssel`). Neu ist, dass stillgelegte Aufgaben auch **nicht mehr gestellt** werden
(`allSeedTasks` und der c1x-Adapter `legacyV2Items` filtern sie heraus); vorher blendete die Datei nur gespeicherte Fehlersätze aus. Der Inhalt
bleibt in `tasks-v2.json` stehen, damit sich keine Kennung verschiebt.

## Bewusst nicht geändert
- Antworten, die das Stichwort in Klammern ignorieren („must be speaking“ bei `(must / talk)`), bleiben falsch.
- Antworten über der Wortzahl bleiben falsch (die Grenze steht in der Aufgabe).
- Formulierungen, die den Sinn verschieben („can’t have seen“ statt „received“), gehen wie bisher ans Claude-Urteil („Auch richtig?“).
- `md-mi-f1` („He maybe … → Maybe he is …“) und `ut-usd-f1` („never use to → didn’t use to“): die zweite Korrektur bräuchte eine überlappende
  Stelle; in der App ersetzt man genau die angetippte Stelle, dort kann man sie gar nicht eingeben.
- Lücken des Buchs zum Muster „It was the first time … had + 3. Form“ verlangen weiter die Form des Musters (`led` allein bleibt falsch), weil
  genau diese Form geübt wird; bei „Fehler finden“ gilt die US-übliche Form (`pp-ft-f1`).

## Wie man es wiederholt
```
G1_MODE=export G1_OUT=<ordner> npx vitest run --config scripts/grammar/g1/vitest.config.mjs   # blind-NN.json
# Antworten als <ordner>/answers-NN.json ({ "<id>": Antwort })
G1_MODE=score  G1_OUT=<ordner> npx vitest run --config scripts/grammar/g1/vitest.config.mjs   # mismatch.json
```
Nie `npm run grammar:build` ausführen; `tasks-v2.json` und die Teile werden von Hand gleich gehalten (`npm run grammar:check -- <thema>`).
