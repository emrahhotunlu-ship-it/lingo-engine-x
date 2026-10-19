# Tutor-Engine v2: Konzept (Stand 19.10.2026)

> Status: Konzept v2 von Opus (hoher Aufwand), 19.10.2026; wartet auf zweite Prüfung und Emrahs Entscheidungen (Abschnitt 8). Ersetzt `tutor-engine.md`.

Ablage: `/home/user/lingo-engine-x/docs/umbau/tutor-engine-v2.md`. Dieses Konzept ersetzt `/home/user/lingo-engine-x/docs/umbau/tutor-engine.md`. Grundlage sind `ki-tutor.md`, `wort-lernen-plan.md`, `aktivierung.md`, `tagesaufbau.md`, `gesamtkonzept.md` und die Verträge `contract/sample.d.ts` und `contract/db.d.ts` (0.2.49).

---

## 0. Kritik am Entwurf (19.10.)

**Zu klein gedacht**

1. **Das Lernermodell ist nur eine Liste von Kennzahlen.** Es fehlen Fehlerannahmen mit Zustand (offen, bestätigt, widerlegt) und mit Belegen. Damit kann die Engine nie sagen, *warum* Emrah etwas falsch macht, und eine Annahme nicht gezielt prüfen. Es fehlt außerdem eine feste Tabelle typischer Übertragungen aus dem Deutschen (z. B. „seit“ → *since/for* mit Present Perfect, „würde“ im if-Satz, „Ich bin hier seit…“). Diese Tabelle ist Inhalt, nicht KI.
2. **Die Auswahl der nächsten Aufgabe ist eine undurchsichtige Formel.** Gemeint ist „Bedarf × fällig × Abwechslung × Schwierigkeit“. Kap. 2 verlangt „Erklären, warum“. Die Auswahl muss deshalb einen *Grund* liefern, den die Oberfläche zeigen kann („Weil du *had* und *used to* zuletzt dreimal getauscht hast“). Eine Punktzahl reicht nicht.
3. **Der Entwurf ignoriert, was es schon gibt.** Vorhanden sind:
   - `confusion.ts`: `patStats`, `pairsOf`, `EVIDENCE_MAX_BYTES` 4.900
   - `explainOps.ts`: `explainOps`, `Ax`, `withAx`
   - `diag.ts`: Wochen-Diagnose mit `acquire`
   - `contrast.ts`: `contrastTasks`
   - `edits.ts`: `error`/`upgrade`, `locateEdits`
   - `tutorBudget.ts`: `TUTOR_PER_DAY = 20`
   - `budget.ts`: `BG_PER_DAY = 6`

   v2 baut auf diesen Teilen auf. Neue Doppelstrukturen entstehen nicht.
4. **Die Wortseite fehlt fast ganz.** Wortschatz, Grammatik und Gebrauch (Aktivierung A1–A5) müssen in *einem* Modell stehen. Sonst gibt es weiter drei Arten von „sicher“.

**Übertrieben oder riskant**

5. **Drei Ordnungssysteme stehen nebeneinander:** 8 Diagnose-Codes, 13 Didaktik-Züge und 10 Prinzipien. v2 verdichtet sie auf **einen** Code-Satz für die Ursache und **einen** Satz von 6 Zügen in der Engine. Die Prinzipien werden zu Testregeln (Abschnitt 6).
6. **`app/pool.alt` als *globale* gelernte Alternativen ist gefährlich.** Ein einziges falsches „Auch richtig“ von Claude würde sich dauerhaft durch alle Aufgaben ziehen. In v2 gilt eine Alternative nur **für die eine Aufgabe**. Allgemeine Regeln (Familien) kommen nur per Code mit Regel-Test (Q5).
7. **Z11 „Selbsterklärung mit 3 Gründen“ ist am Handy zu teuer.** v2 ersetzt sie durch eine Ein-Tipp-Begründung als Auswahl.
8. **„Späte Uhrzeit“ als Zeichen für die Tagesform** ist nicht belegt. Es wird gestrichen.

**Widersprüche zur Plattform und zu Kap. 2**

9. **Erfolgsziel:** Der Entwurf nennt 70–85 %, `gesamtkonzept.md` 70–90 %. v2 legt fest: **Zielbereich 75–85 %, harte Grenzen 70/90.**
10. **„unsure“ ohne Festlegung, was als erledigt zählt, verletzt Kap. 2 Nr. 2.** v2: Eine Antwort mit „nicht sicher prüfbar“ gilt im Tagesplan als **erledigt**, bewegt aber **keinen** Lernwert.
11. **Claude als Richter verletzt T-R2 („die App urteilt“) und T-R8.** v2 löst das so: Claude darf ein Urteil nur von *unsure* nach *auch richtig* **anheben** oder ein *wrong* mit einer **gefundenen Stelle** belegen. Claude bewegt nie BKT, Stufe oder FSRS (Abschnitt 4.3).
12. **Hintergrund-Budget:** `ki-tutor.md` nennt 5 am Tag, der Code hat 6 (`/home/user/lingo-engine-x/src/ai/budget.ts:15`). Maßgeblich ist der Code. Der Text in `ki-tutor.md` wird bei Gelegenheit angeglichen.

---

## 1. Was „Intelligenz“ hier konkret heißt

Intelligenz heißt hier: Die App **weiß, erklärt und prüft**. Sie hat ein ausdrücklich formuliertes, abgeleitetes Bild von Emrah. Daraus trifft sie jede Entscheidung, und jede Entscheidung hat einen nennbaren Grund. Das Bild und die Entscheidungen sind reine Funktionen in `src/domain/tutor/`, deterministisch und testbar. Claude ist ein **Fachkollege an wenigen Stellen**, nicht die Steuerung.

### 1.1 Lernermodell: sechs Bereiche, abgeleitet und nie gespeichert

| Bereich | Inhalt | Quelle (vorhanden) |
|---|---|---|
| Wissen Grammatik | je Muster: BKT-p, `certainty` 0–5, Quote 28 Tage (nur feste Aufgaben), freie Tage, letzter Fehler, `TopicState` | `grammar/bkt.ts`, `path.ts`, Log |
| Wissen Wörter | je Karte: R (FSRS), freie Tage, Zahl verschiedener Sätze, Stufe, **eine** Statuszeile (ST) | `srs`, `hist`, `variety.ts` |
| Gebrauch | je Karte und Muster: frei benutzt, von Claude geprüft, einsatzbereit | `act/<JJJJ-MM>`, `prod` |
| Fehlerannahmen | `Hypothesis` mit Ursache, Gegenmuster, Belegen und Zustand | Log-Felder `h`/`pat`, `errors[]`, `diag[]` |
| Tempo | Median der Antwortzeit je Aufgabenart und Form (Unterbrechungen > 60 s nicht gezählt, INTERRUPT_MS) | Log `ms` |
| Ziele | Kapitel, C1-Zielmuster, Berufskontext `ctx2` | `slotPlan`, `ctx2.ts` |

Die **Tagesform** ist ausdrücklich **nicht** Teil des Modells. Sie ist ein flüchtiger Zustand der Sitzung (Zustand-Store, Abschnitt 2) und wird nie gespeichert.

**Die Übertragungstabelle Deutsch → Englisch** liegt in `src/content/tutor/l1.json` (neu). Sie umfasst etwa 40 Einträge, jeder mit `{code, pat, vs, trigger(de), example{de,en}, why{de,en}}`. Sie wird vom english-teacher gegengelesen. Beispiele:
- `l1:seit-praesens`
- `l1:wuerde-if`
- `l1:had-gewohnheit` (deutsches Präteritum für eine Gewohnheit in der Vergangenheit)
- `l1:partizip-subjekt`
- `l1:make-do`

**Ursachen-Codes** (einheitlich für die lokale Diagnose, für Claude und für das Log):

`form | typo | confuse | l1 | auxform | span | order | lexis | unknown`

`confuse` und `l1` tragen zusätzlich `vs` (das Gegenmuster) bzw. `l1` (den Code aus der Tabelle). Eine Antwort, die zwar richtig ist, aber nicht die geübte Form zeigt (`alt_ok`), ist **kein Fehlercode**, sondern ein Urteil.

### 1.2 Entscheidungspunkte für Claude (abschließend)

| # | Moment | Vorlage | Stufe | Auslöser | Ändert Lernwerte? |
|---|---|---|---|---|---|
| E1 | Unklare Antwort prüfen und erklären | `answer-review@1` (neu, ersetzt `grammar-judge` und `explain-answer@2` in der Übung) | quick | „Prüfen“, wenn das lokale Urteil `unsure` ist | nein |
| E2 | Einspruch „Ich lag richtig“ | `answer-review@1` mit `mode:'appeal'` | quick | Tipp des Nutzers | nein (nur Aufgabe zurückgenommen) |
| E3 | „Warum ist meins falsch?“ bei lokalem `wrong` ohne Annahme | `answer-review@1` mit `mode:'explain'` | quick | Tipp des Nutzers | nein |
| E4 | Wochen-Diagnose: Annahmen bestätigen oder verwerfen | `diagnose@2` (Nachfolger von `@1`) | default | Rundenende, ≥ 12 neue zugeordnete Fehler, einmal je ISO-Woche, `acquire` | nein, nur Text und Plan-Vorschlag |
| E5 | Aufgaben-Nachschub bei Vorratsmangel | `grammar-items@3` + `solve-check@1` | default + quick | Hintergrund nach `sampleConfirmed`, `BG_PER_DAY` | nein (Claude-Aufgaben buchen kein BKT, T-R8) |
| E6 | Satzbank für Wörter | `word-bank@1` (SB) | quick | Hintergrund, ≤ 3 am Tag | nein |
| E7 | Freie Produktion prüfen | vorhanden: `sentence-clinic@1`, `c1-mail@1`, `activate-check@1` | wie bisher | Nutzer | liefert Belege für den Gebrauch |

**Claude entscheidet ausdrücklich *nicht*, welche Aufgabe als Nächstes kommt.** Gründe: der Pflichtplan darf nicht neu würfeln (Kap. 15), die Studie von Bastani zeigt Schaden durch KI ohne Leitplanken, und die Auswahl muss ohne KI funktionieren.

---

## 2. Wie die Engine in jedem Moment entscheidet

### 2.1 Ablauf einer Antwort (XState, in der bestehenden Runden-Maschine)

```
answering → judgedLocal ─┬─(sicher)──────────────→ feedback → (selfFix?) → next
                         └─(unsure & KI bereit)→ reviewing ─→ feedback
                                    (Stopp/Bildschirmwechsel: AbortController → feedback mit lokalem unsure)
```

- `judgedLocal` zeigt **sofort** das lokale Urteil. Bei `unsure` erscheint eine Skelett-Zeile „Ich prüfe deine Fassung …“.
- `reviewing` hat **keinen** Zeitgeber (A6.2). Nach `SLOW_AFTER_MS.quick` = 8 s (`/home/user/lingo-engine-x/src/ai/gate.ts:27`) kommt der ruhige Hinweis mit Stopp-Knopf.
- `selfFix` ist der Zustand der Selbstkorrektur (Lyster/Saito): Zuerst kommt ein Hinweis und die Bitte, selbst zu korrigieren. Erst danach wird die Lösung gezeigt.

### 2.2 Zug-Entscheidung `decideMove` (rein)

Es gibt sechs Züge: `ask · hint · explain · review · win · pause`. Die Regeln gelten nach Rang, die erste zutreffende gewinnt.

| Rang | Bedingung (Sitzungszustand) | Zug | Grund (sichtbar) |
|---|---|---|---|
| 1 | Ermüdung: ≥ 12 Antworten, letzte 8 ≤ 50 % und Zeit ≥ 1,5× Median | `pause` (nur im Extra) bzw. `win` (in der Pflicht) | „Du wirst langsamer, ich mache es leichter“ |
| 2 | 3 falsche Antworten in Folge (gleich welches Muster) | `win`: bekanntes Muster mit p > 0,7, Auswahlform | „Kurz etwas, das sitzt“ |
| 3 | 2 Fehler mit derselben Ursache am gleichen Muster in dieser Sitzung | `explain`: Mini-Lektion (Regel in einem Satz, Kontrastpaar, ein Beispiel aus dem Beruf), danach `ask` mit leichterer Form | „Abfragen hilft hier gerade nicht“ |
| 4 | Offene Annahme mit ≥ 2 Belegen und ungeprüft | `ask` mit **Prüfaufgabe** (Kontrastaufgabe A gegen B) | „Ich will prüfen, ob du X und Y verwechselst“ |
| 5 | Erfolgsquote der letzten 10 > 90 % | `ask` eine Stufe schwerer (freiere Form) | – |
| 6 | Erfolgsquote der letzten 10 < 70 % | `ask` eine Stufe leichter (Gerüst, `scaffolded`) | – |
| 7 | sonst | `ask` nach `nextTasks` | Grund aus `WhyCode` |

`review` steht für die nächste fällige Wiederholung. Der Zug entsteht über `nextTasks` (fällige Einträge haben Vorrang innerhalb von `ask`).

**Schutzregeln gegen Frust (Invarianten, alle getestet):**
- Nie zwei Belehrungen hintereinander, zwischen `explain`-Zügen liegt mindestens ein `ask`.
- Nie mehr als 3 Erklärzeilen.
- Ein Kontrast nur bei belegter Verwechslung (Annahme mit ≥ 2 Belegen oder Ursache `confuse` in *dieser* Antwort).
- Die **Pflicht** wird nie durch eine Pause beendet. Sie wird leichter, aber nicht kürzer: erledigt bleibt erledigt, offen bleibt sichtbar offen.
- „Weiß nicht“ zweimal hintereinander führt zu `explain` statt zu einer weiteren Frage.

---

## 3. Rückkopplung: aus jeder Antwort wird Wissen

### 3.1 Datenfluss

```
Antwort → diagnoseAnswer → judge → (answer-review?) → Log-Eintrag (+h, +pat, +v)
        → errors[] (nur bei 'wrong' mit Ursache ≠ typo und sauberem Satz, FK-Ausschlussregeln)
        → buildLearnerModel (neu abgeleitet beim nächsten Snapshot)
        → Status (ST) · Plan (nextTasks) · Erklärung (composeFeedback)
```

**Eine Wahrheit:** Status, Plan und Erklärung lesen *ausschließlich* `LearnerModel`. Die alten Lesestellen werden auf das Modell umgestellt: `confidenceOf`, `isFest`, `unitState` „Sicher“, „Stufe n von 5“ und Hub „Jung/Fest“ (wort-lernen-plan, ST). Ein Widerspruchstest füttert ein Modell in alle Ansichten und vergleicht die Aussagen (Abschnitt 7).

### 3.2 Datenfelder (nur ergänzend, `looseObject`, `writer.transform`, nie löschen)

| Ort | Feld | Größe | Grenze |
|---|---|---|---|
| bestehende Antwort-Log-Einträge | `h` (Ursachen-Code, ≤ 12 Zeichen), `vs` (Muster-ID, ≤ 40), `v` (Urteil, 1 Zeichen: c/a/n/w/u) | etwa 50 B je Eintrag | keine neuen Dokumente |
| `errors[]` je Thema | vorhanden: `ax`, `cf`, `unclear`, `pat`; neu: `h` | etwa 20 B | ERRORS_MAX 10 |
| Grammatik-Aufgabendokument | `alt: [{a, t, by:'ai'|'teacher', pv}]` **je Aufgabe**, höchstens 6 | ≤ 600 B | Aufgabendokument bleibt deutlich unter 200 KiB |
| `diag[]` (vorhanden) | `out.hyps[]` aus `diagnose@2` | ≤ 4 KB je Woche | Ring wie bisher |
| `app/reports` (Q4, vorhanden) | Meldungen | – | – |

Weitere Festlegungen:
- **Kein Lernermodell-Dokument** und **kein `app/pool.alt`**, also keine neuen Dokumente.
- Annahmen werden **aus dem Log abgeleitet**. Gespeichert wird nur das Urteil von Claude zu einer Annahme (in `diag[]`).
- Zählwerte entstehen nie aus Lesen-dann-Schreiben (Vertrag `db.d.ts`). Jede Antwort ist ein eigener Log-Eintrag.
- Die Grenzen 5.000 Dokumente, 256 KiB und der Wächter bei 200 KiB werden eingehalten, weil kein neuer Datenstrom entsteht. data-guard prüft das.

### 3.3 Ehrlichkeit

- Annahmen werden als **Frage** formuliert („Kann es sein, dass …?“), nie als Diagnose über die Person.
- Eine Annahme ist `confirmed` erst nach einer bestandenen oder misslungenen *Prüfaufgabe*. Sie wird `fading`, wenn 14 Tage lang kein neuer Beleg kommt.
- Die Statuszeile nennt ihre Belege („frei abgerufen an 2 von 3 Tagen“, „zuletzt falsch am 17.10.“).

---

## 4. Qualität: kein falsches „falsch“

### 4.1 Urteilsregel (Invariante)

`wrong` darf das Urteil nur sein, wenn mindestens eine der drei Bedingungen gilt:
- (a) Die Antwort trifft eine bekannte falsche Form.
- (b) `diagnoseAnswer` liefert eine Ursache ≠ `unknown`.
- (c) Claude belegt den Fehler mit einer Stelle, die wörtlich in der Antwort steht (`locateEdits`).

Sonst lautet das Urteil `unsure`.

`unsure` ohne KI erscheint als „Nicht sicher prüfbar, zählt nicht gegen dich“, mit Musterlösung und lokaler Erklärung.

### 4.2 Aufgaben-Hülle und `lintTask`

Jede Aufgabe trägt `goal` (geübtes Muster), `constraint` (macht die Aufgabe eindeutig, z. B. „frühere Gewohnheit, mit *used to*“) und `accept: 'exact'|'target'|'any-correct'`.

`lintTask` lehnt eine Aufgabe ab, wenn:
- die Lösung mehrdeutig ist und weder `constraint` noch `accept:'any-correct'` gesetzt sind,
- die Lücke den ganzen Satz umfasst,
- kein Verb vorhanden ist,
- der Hinweis aus Ausgangsmaterial fehlt,
- ein Signalwort zu einem fremden Muster gehört (`foreignSignalPattern`).

`lintTask` läuft als Unit-Test über den **ganzen Bestand** und vor jeder Annahme von Claude-Aufgaben.

### 4.3 Grenzen für Claude als Prüfer

| Lokal | Claude sagt | Ergebnis | Lernwerte |
|---|---|---|---|
| correct / alt_ok | egal (wird nicht gefragt) | lokal | lokal |
| unsure | `also_right`, `edits` leer | `alt_ok` (Claude) | **unverändert** |
| unsure | `wrong`, ≥ 1 gefundene Stelle | `wrong` (belegt) | **unverändert**, Eintrag in `errors[]` erst nach „Verstanden“ |
| unsure | `wrong` ohne gefundene Stelle, `unclear` | `unsure` | unverändert |
| wrong (lokal) | Einspruch: `also_right` | Aufgabe zurückgenommen, `alt` je Aufgabe (`by:'ai'`), Meldung in `app/reports` zur Gegenlesung | BKT-Minus **zurückgerollt** (optimistisch mit Rückrollen) |

Damit gilt T-R2 weiter: Die Lernwerte bewegt nur das lokale Urteil.

### 4.4 Prüftore und Messgrößen

- **Gold-Liste** `tests/tutor/gold/grammar.json`:
  - ≥ 200 **positive** Paare (gültige Alternative, darf nie `wrong` ergeben)
  - ≥ 100 **negative** Paare (echte Fehler, dürfen nie `correct`/`alt_ok` ergeben, Schutz vor Überkorrektur in Gegenrichtung)
  - Quelle: english-teacher, Emrahs gemeldete Fälle als Pflichteinträge
- Regel-Test je gemeldeter Fehlerklasse (Q5).
- Gegenlesung zu 100 % für neue Inhalte und `l1.json`.
- Messung (Diagnose-Ansicht, `quality.ts` erweitert um `unsure`/`appealOk`):

| Messgröße | Ziel |
|---|---|
| zu Unrecht falsch (angenommene Einsprüche je falsches Urteil) | < 2 % |
| Anteil `unsure` | < 8 % |
| Melde-Quote | ≤ 5 % |
| Erfolg der Aufgabe nach einer Mini-Lektion | ≥ 70 % |
| Claude-Aufrufe im Vordergrund | Median ≤ 5 am Tag |

- **Ohne KI:** Pflicht, Serie, Urteil, Erklärung und Plan laufen vollständig lokal. Es fehlen nur E1–E7.

---

## 5. Einbettung in die Pakete und Scheibenfolge

| Paket | Rolle in der Tutor-Engine | Doppelstruktur vermieden durch |
|---|---|---|
| MD (läuft) | Teil von S1: `alt_ok`, Zielkonflikt-Regeln, Inhalts-Audit | MD liefert Familien und Hülle, keine eigene Urteilslogik |
| FK | nutzt `diagnoseAnswer` und `lintTask` für Ausschlussregeln, B1 „Sag es richtig“ wird über `judge` bewertet | keine eigene Prüfroutine |
| ST | reiner Leser von `LearnerModel.words`/`patterns` | `confidenceOf`/`isFest` entfallen als Wahrheit |
| WL | Wortseite von `nextTasks`, Regeln unverändert (Mix 1:1, Rotation ab Stufe 1) | – |
| SB | Inhaltsquelle für Satzvielfalt (E6) | – |
| T1 (`explain-answer@2`) | geht in `answer-review@1` auf; `ax` bleibt das Speicherformat | ein Aufruf statt Richter plus Erklärer |
| T2 (`grammar-items@3`) | E5 mit `goal`/`constraint` im Schema und `solve-check@1` als Antwortraum-Prüfung | – |
| KT-x, P49 | `diagnose@2` erweitert `@1` um Annahmen | gleicher Speicher `diag[]` |

**Scheiben, geordnet nach spürbarem Nutzen für Emrah:**

- **S1 „Kein falsches Falsch, Erklärung zu meiner Antwort“** (MD, Teile von FK)
  - Familie `usedTo|pastSimple|would` und weitere aus dem Audit
  - Hülle und `lintTask` über den Bestand, Urteil `unsure`
  - `answer-review@1` hinter dem Schalter `tutor.explain`, `composeFeedback` mit Kontrast nur bei Beleg
  - „Fehler finden“ nimmt jede gültige Korrektur an, auch im Hauptsatz
  - Gold-Liste mit Grundbestand
  - *Spürbar:* Die Fälle „had“ und „Walking…“ sind behoben, und die Erklärung bezieht sich auf das, was er geschrieben hat.
- **S2 „Ein Status, eine Wahrheit“** (ST, FK-Rest)
  - `learner.ts` und Statuszeile, Zeile „Warum diese Aufgabe?“
  - FK B1/B2 über `judge`
  - *Spürbar:* Liste, Wortblatt und Hub sagen dasselbe.
- **S3 „Der Tutor reagiert“**
  - `decideMove`, Hinweis-Leiter mit Selbstkorrektur, Mini-Lektion
  - Schutzregeln gegen Frust, Prüfaufgaben für Annahmen
  - `nextTasks` hinter `selectRound`/`slotPlan`
  - *Spürbar:* nach Fehlerserien leichter, nach zwei gleichen Fehlern eine kurze Erklärung statt weiter Abfragen.
- **S4 „Mehr Stoff, der passt“**
  - E5 mit `solve-check`, SB (E6)
  - `diagnose@2` mit Annahmen, Fortschrittsbelege („vor 3 Wochen 4 von 9, jetzt 8 von 9“)

S2 kann parallel zu S1 laufen, weil die beiden keine Dateien teilen.

---

## 6. Schnittstellen

### 6.1 Dateien

| Datei | Verantwortung |
|---|---|
| `src/domain/tutor/learner.ts` (neu) | `buildLearnerModel`, rein, zwischengespeichert je Snapshot |
| `src/domain/tutor/hypotheses.ts` (neu) | Annahmen aus Log und `diag[]`, Zustände |
| `src/domain/tutor/diagnose.ts` (neu) | `diagnoseAnswer` (nutzt `explainOps`, `altFamilies`, `l1.json`) |
| `src/domain/tutor/judge.ts` (neu) | `judge`, Urteilsregeln aus 4.1/4.3, umhüllt `checkGrammar` |
| `src/domain/tutor/lintTask.ts` (neu) | Prüfung der Aufgaben-Hülle |
| `src/domain/tutor/policy.ts` (neu) | `nextTasks`, `decideMove`, `WhyCode` |
| `src/domain/tutor/feedback.ts` (neu) | `composeFeedback`; ersetzt die Zeilenlogik in `grammar/explain.ts`, dessen Bausteine bleiben |
| `src/content/tutor/l1.json` (neu) | Übertragungstabelle DE→EN |
| `src/prompts/answerReview.ts` (neu), `diagnoseV2.ts` (neu), `solveCheck.ts` (neu) | Vorlagen mit zod |
| `src/features/tutor/sessionStore.ts` (neu, Zustand) | Tagesform der Sitzung (letzte 10, Serie, Langsamkeit, „weiß nicht“) |
| `src/domain/grammar/check.ts`, `rules.ts` (geändert) | neue Familien; `checkFind` mit beliebiger gültiger Korrektur |

### 6.2 Signaturen

```ts
// learner.ts
export type Verdict = 'correct' | 'alt_ok' | 'near' | 'wrong' | 'unsure';
export type Cause = 'form' | 'typo' | 'confuse' | 'l1' | 'auxform' | 'span' | 'order' | 'lexis' | 'unknown';
export type Evidence = { t: number; day: string; pat: PatternId; kind: TaskKind; form: 'mc' | 'gap' | 'free';
  v: Verdict; h: Cause | null; vs: PatternId | null; ms: number; help: 0 | 1 | 2 | 3; src: 'fixed' | 'ai' };
export type Hypothesis = { id: string; pat: PatternId; cause: Cause; vs: PatternId | null; l1: string | null;
  n: number; lastT: number; state: 'open' | 'tested' | 'confirmed' | 'fading'; ev: readonly string[] };
export type PatternKnow = { pat: PatternId; p: number; certainty: 0 | 1 | 2 | 3 | 4 | 5;
  q28: { n: number; ok: number }; freeDays: number; lastWrong: number | null; state: TopicState };
export type WordKnow = { id: string; R: number | null; freeDays: number; sentences: number; stage: number;
  status: 'recognize' | 'withHelp' | 'free' | 'newSentence' | 'used'; head: 'good' | 'shaky' | 'forgotten' | 'noGap' };
export type LearnerModel = { asOf: number; day: string;
  patterns: ReadonlyMap<PatternId, PatternKnow>; words: ReadonlyMap<string, WordKnow>;
  hyps: readonly Hypothesis[]; pace: Readonly<Record<string, number>>;
  goals: { chapter: number | null; c1: readonly PatternId[]; ctx: Ctx2 | null } };
export type LearnerSources = { grammarDocs: ReadonlyMap<string, Doc>; logs: ReadonlyMap<string, Doc>;
  vocab: ReadonlyMap<string, Doc>; act: ReadonlyMap<string, Doc>; profile: Doc | null; diag: readonly DiagEntry[] };
export function buildLearnerModel(src: LearnerSources, now: number): LearnerModel;

// diagnose.ts
export type Diagnosis = { cause: Cause; vs: PatternId | null; l1: string | null;
  span: [number, number] | null; ops: ExplainOp[]; conf: 'sure' | 'likely' | 'none' };
export function diagnoseAnswer(task: GrammarTask, given: string, ctx: { model: LearnerModel | null }): Diagnosis;

// judge.ts
export type Judgement = { v: Verdict; by: 'local' | 'ai'; books: { bkt: boolean; stage: boolean; error: boolean };
  review: 'none' | 'offer' | 'auto' };
export function judge(task: GrammarTask, given: string, dx: Diagnosis, ai: ReviewOut | null): Judgement;

// lintTask.ts
export type LintIssue = 'ambiguous' | 'no_goal' | 'gap_whole' | 'no_verb' | 'no_source' | 'foreign_signal';
export function lintTask(task: GrammarTask): readonly LintIssue[];

// policy.ts
export type WhyCode = 'due' | 'hyp_test' | 'weak' | 'chapter' | 'mix' | 'win' | 'harder' | 'easier';
export type Pick = { task: GrammarTask; why: WhyCode; ref: string | null };
export function nextTasks(m: LearnerModel, pool: readonly GrammarTask[], slot: SlotRole, seed: string, n: number): readonly Pick[];
export type Session = { last10: readonly boolean[]; wrongRun: number; idkRun: number; slow: number;
  answers: number; lastMove: Move | null; sameCause: Readonly<Record<string, number>>; duty: boolean };
export type Move = 'ask' | 'hint' | 'explain' | 'review' | 'win' | 'pause';
export function decideMove(s: Session, m: LearnerModel): { move: Move; why: WhyCode };

// feedback.ts
export type FeedbackModel = { goal: Bi; verdict: Verdict; yours: Bi | null; why: Bi; extra: Bi | null;
  action: 'next' | 'selfFix' | 'newSentence'; marks: readonly [number, number][] };
export function composeFeedback(i: { task: GrammarTask; j: Judgement; dx: Diagnosis; m: LearnerModel;
  ai: ReviewOut | null; lang: 'de' | 'en'; tired: boolean }): FeedbackModel;
```

`nextTasks` ist deterministisch: der Startwert ist `seed = Tag + Slot`, und der Plan wird gespeichert wie bisher (`u.v=1`, `u.rv`). Neu gewürfelt wird nicht.

### 6.3 Vorlagen

**`answer-review@1`** (quick)

Kopf: `header({id:'answer-review', version:1})`. Dazu kommen Rolle (Englischlehrer C1, US-Englisch, britische Formen gelten als richtig), die Regel „minimal korrigieren, Stilvarianten sind `also_right`“ und `QUOTE_RULE`.

Eingaben:

| Eingabe | Größe |
|---|---|
| Satz | ≤ 300 B |
| `goal`/`constraint` | ≤ 200 B |
| Antwort | ≤ 300 B |
| Lösung + ≤ 6 akzeptierte Antworten | ≤ 800 B |
| Muster und Regel | ≤ 400 B |
| lokale Diagnose | ≤ 200 B |
| ≤ 4 Nachbarmuster (`neighborsOf`) | ≤ 300 B |
| `mode` | – |
| UI-Sprache | – |

Summe etwa 3 KB, also weit unter `PROMPT_BUDGET_BYTES` 60.000.

```ts
z.object({
  verdict: z.enum(['correct', 'also_right', 'near', 'wrong', 'unclear']),
  fitsGoal: z.boolean(),
  edits: z.array(EditSchema).max(3),            // from muss wörtlich in der Antwort stehen
  cause: z.enum(CAUSES).nullable(), vs: PatternIdSchema.nullable(),
  why: BiSchema, nuance: BiSchema.nullable(),   // {de,en}, je ≤ 240 Zeichen
  retryHint: z.string().max(160).nullable(),
})
```

Nach dem Lesen gilt die Annahmeregel aus 4.3. Ist `vs` nicht in `patIdsOf`, wird es auf `null` gesetzt. `also_right` mit Einträgen in `edits` wird zu `unclear`.

**`diagnose@2`** (default)

- Eingaben: `patStats` (≤ 2 KB) und Belegzeilen `evidenceText` (≤ 4,9 KB, vorhanden), offene Annahmen (≤ 1 KB), `l1`-Codes, Muster-Liste (≤ 3 KB, `PAT_LIST_MAX`). Summe etwa 11 KB.
- Ausgabe: `hyps: [{id, verdict:'likely'|'unlikely'|'unclear', ev: string[] (nur IDs aus den Eingaben), why: Bi}] ≤ 5`, `focus: PatternId[] ≤ 3`, `summary: Bi`.
- IDs, die nicht in den Eingaben vorkommen, werden verworfen (T-R4).

**`solve-check@1`** (quick)

- Eingaben: Aufgabe *ohne* Lösung, mit `constraint` (≤ 600 B).
- Ausgabe: `answers: string[] ≤ 6`, `ambiguous: boolean`, `why: string ≤ 160`.
- Eine Claude-Aufgabe wird nur angenommen, wenn die Lösung in `answers` steht und jede weitere Antwort entweder in `accepted` landet (dann `accept:'any-correct'`) oder die Aufgabe verworfen wird.

**`grammar-items@3`:** wie in `ki-tutor.md`, zusätzlich die Pflichtfelder `goal` und `constraint` und `lintTask` vor der Annahme.

### 6.4 Fehlerbehandlung (über `failureFromSample`, `/home/user/lingo-engine-x/src/ai/errors.ts:68`)

| Code | Verhalten in der Übung |
|---|---|
| `cancelled` | still; lokales Urteil bleibt; kein Protokolleintrag als Fehler |
| `not_granted`, `sampling_disabled`, `not_declared`, `capability_*` | Prüfknöpfe ausblenden; `unsure` mit „nicht sicher prüfbar“; `logWarn` |
| `rate_limited` | Hinweis „Claude ist gerade ausgelastet“; Knopf bleibt, **kein** automatischer Neuversuch; Hintergrund-Aufträge für den Tag pausieren |
| `invalid_json`, `refused`, `empty_completion`, `upstream_error`, `session_expired` | Fehlerzustand mit „Erneut versuchen“ (mit `cacheFor(…, refresh)`), lokales Urteil bleibt |
| Schemafehler bei lesbarem JSON | **genau ein** Neuversuch mit `retryPrompt` (A6.3) |
| `prompt_too_large`, `invalid_request`, `transform_error`, `queue_overflow` | `logError`; Funktion für diese Aufgabe aus; Programmfehler |

### 6.5 Kosten und Wartezeit

- **Vordergrund:**
  - Bei etwa 40 Grammatik-Antworten am Tag und < 8 % `unsure` sind etwa 3 Aufrufe für E1 zu erwarten, dazu 0–3 für E2/E3.
  - Deckel `TUTOR_PER_DAY` 20 (vorhanden).
  - quick antwortet in 1–2 s, das lokale Urteil steht vorher schon da.
  - Gleiche Eingaben bedient der Cache (5 min).
- **Hintergrund:** `BG_PER_DAY` 6 für E5, E6 und E4. E4 ist für die Diagnose reserviert (`BG_RESERVED_ID`). Hintergrund läuft erst nach `sampleConfirmed`.
- **Zustimmungsdialog:** Der erste Aufruf am Tag kommt nur nach einem Tipp, nie mitten in einer laufenden Animation.
- Alles läuft über das Abo, ohne Zusatzkosten. Abgebrochene Aufrufe kosten nichts (Vertrag).

---

## 7. Tutor-Test

**Simulation** `tests/tutor/sim.test.ts` (Vitest, deterministischer Startwert, ohne KI). Vier Schülerprofile mit Antwortfunktion `answer(task, rng)`:

| Profil | Merkmale |
|---|---|
| P1 „Vertrieb B2+“ | schwach bei *used to/would/Past Simple*, Present Perfect mit *since/for*, Präpositionen; sonst etwa 80 % |
| P2 „müde“ | ab Antwort 10 langsamer und 45 % Erfolg |
| P3 „stark“ | 93 % |
| P4 „Rater“ | Auswahl immer die erste Möglichkeit, frei leer |

**Erwartungen:**
- Nach 30 Zügen liegt die Erfolgsquote bei P1/P3 im Bereich 70–90 %.
- P2 bekommt `win`/leichtere Form, nie `pause` in der Pflicht.
- P4 erreicht keine Stufe ≥ 3 (Auswahl reicht nicht).
- Für P1 entsteht nach zwei gleichen Ursachen eine Annahme `had↔usedTo`, und spätestens zwei Züge später kommt eine Prüfaufgabe.
- Nie zwei `explain` in Folge.
- Gleiche Eingabe und gleicher Startwert ergeben denselben Plan.

**Szenarien** (Einheitstests auf `judge`/`composeFeedback`):

1. **„had“:**
   - „When I was a kid, I ___ (have) a dog“ mit `goal:usedTo`, Antwort „had“: Urteil `alt_ok`, Ziel-Zeile „Geübt wird *used to*“, BKT unverändert.
   - Ohne `constraint`: `lintTask` meldet `ambiguous`.
2. **„Walking to work, my phone rang twice“:**
   - „While I was walking to work, my phone rang twice“ und „Walking to work, I heard my phone ring twice“ sind beide `correct`.
   - Die Erklärung zitiert seine Fassung, eine Kontrastzeile gibt es nicht ohne Beleg.
3. **Frust-Serie:** 4 falsche Antworten: Zug `win`, danach höchstens eine Erklärung. Die Pflicht bleibt offen, der Zähler stimmt.
4. **Ohne KI** (`?fake=nosample`): `unsure` zeigt einen Hinweis, keine Prüfknöpfe, die Serie läuft weiter.
5. **Einspruch angenommen:** BKT wird zurückgerollt, `alt` steht nur an dieser Aufgabe, eine Meldung liegt in `app/reports`.

**Widerspruchstest:** Ein Modell wird an Liste, Wortblatt, Übung und Hub übergeben, und alle zeigen dieselbe Statuszeile. **Gold-Test:** Abschnitt 4.4. **Sprachtest:** jede `Bi`-Ausgabe ist in DE und EN vorhanden. **E2E:** Szenarien 1, 2 und 4 am Handy und am Desktop, mit Antworten des Entwicklungs-Adapters für `answer-review@1`.

---

## 8. Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| quick-Modell urteilt bei feinen Grammatikfragen falsch | Claude bewegt keine Lernwerte und stuft nie ein lokales Urteil herab; Stelle muss belegt sein; Einspruchsweg; Gold-Liste mit aufgezeichneten Antworten |
| Zu viel wird angenommen (Gegenrichtung) | ≥ 100 negative Gold-Paare; `alt` nur je Aufgabe |
| Wartezeit mitten in der Übung | lokales Urteil sofort, Skelett-Zeile, Stopp, kein Zeitgeber |
| Lernermodell langsam am Handy (bis 5.000 Dokumente) | Zwischenspeicher je Snapshot, schrittweise Aggregation; Messziel < 30 ms; Test mit 5.000 erfundenen Dokumenten |
| Zwei Wahrheiten bleiben, weil alte Lesestellen weiterleben | ESLint-Regel bzw. Test: `confidenceOf`/`isFest` nur noch innerhalb von `learner.ts` |
| Umfang wächst | S1 ist klein und für sich nützlich; nach jeder Scheibe Test-Link und Emrahs Urteil |
| Übertragungstabelle fachlich schief | Gegenlesung 100 % durch english-teacher, Annahmen nur als Frage |

**Nebenbefund (aus dem Entwurf, von mir nicht nachgeprüft):** leerer `catch` in `/home/user/lingo-engine-x/src/app/flags.ts:81-83`. In S1 mit `logWarn` beheben.

### Entscheidungen für Emrah (einfache Worte)

1. **Soll Claude bei unklaren Antworten automatisch kurz mitprüfen?** Das dauert 1–2 Sekunden und passiert höchstens 20-mal am Tag. Die andere Möglichkeit: nur, wenn du „Prüfen lassen“ tippst. *Vorschlag:* automatisch, aber nur, wenn die App selbst unsicher ist.
2. **Wenn du müde wirst und vieles falsch ist:** Soll die App die restlichen Pflichtaufgaben leichter machen, oder dir eine Pause anbieten (dann bleibt die Pflicht offen)? *Vorschlag:* leichter machen.
3. **Wenn deine Antwort richtig ist, aber nicht die geübte Form** (z. B. „had“ statt „used to have“): Die Aufgabe zählt als geschafft, das Thema rückt aber nicht vor, und du wirst kurz gebeten, die geübte Form zu schreiben. Die andere Möglichkeit: Es zählt voll. *Vorschlag:* die erste Variante.

---

## 9. Prüfliste gegen Kapitel 3

| Punkt | | Fundstelle |
|---|---|---|
| Eine Datei ≤ 16 MB, alles eingebettet | ✅ | keine neuen Assets; `l1.json` etwa 15 KB eingebettet; `check:platform` |
| Kein Server, kein `fetch` | ✅ | nur `sample` über `src/ai` |
| Zugriff nur über `/src/platform` | ✅ | neue Module in `domain` sind rein; KI über `src/ai/gate.ts` |
| `claude.use` darf `null` liefern | ✅ | 4.4 „Ohne KI“, Szenario 4 |
| `sample` ohne Gedächtnis, ≤ 64 KiB | ✅ | 6.3: höchstens etwa 11 KB; jede Anfrage bringt Regel, Daten und Schema mit |
| Fehlercodes, kein Zeitgeber, Neuversuch nach A6.3 | ✅ | 6.4; 2.1 (`SLOW_AFTER_MS` nur als Hinweis) |
| `onSnapshot` einmal je Abfrage | ✅ | Modell aus vorhandenen Abos (`src/data/live.ts`), keine neuen |
| Schreiben nur bei Änderung, `update` nur auf vorhandene Dokumente | ✅ | 3.2: Felder an vorhandenen Einträgen, `writer.transform` |
| Dokumentgrenzen | ✅ | +0 Dokumente; `alt` ≤ 600 B je Aufgabe; kein `pool.alt` |
| Lernfortschritt nur in `db` | ✅ | Tagesform nur in der Sitzung (Zustand), nicht gespeichert; Budgets wie bisher lokal |
| Entwicklungs-Adapter ausgeschlossen | ✅ | unverändert; neue Vorlagen bekommen feste Antworten nur in `src/platform/dev` |
| Keine leeren `catch` | ❌ → ✅ in S1 | `src/app/flags.ts:81-83` (Nebenbefund) |
| Kein Prompt-Text in der Oberfläche, Vorlagen mit zod | ✅ | 6.1/6.3, `src/prompts/*` |
| Optimistisch mit Rückrollen, Skelette | ✅ | 4.3 Einspruch; 2.1 Skelett-Zeile |
| Stack (XState, Zustand, zod, ts-fsrs) | ✅ | 2.1 Maschine, `sessionStore.ts`, 6.3 |

**Wo der Vertrag den Auftrag schlägt:**
- Kap. 10 verlangt „Timeout“, `sample.d.ts` verbietet einen eigenen Timer. Deshalb gibt es nur den Hinweis mit Stopp (A6.2).
- Kap. 10 verlangt „einmal neu anfragen“, der Vertrag sagt „never retry“. Deshalb gibt es nur den einen Neuversuch bei Schemafehler mit geänderter Eingabe (A6.3).
- Kap. 3.1 „eine Datei“: der Mehr-Datei-Build ist laut A7 erlaubt, der Standard bleibt eine Datei.

---

**Relevante Pfade:**
- `/home/user/lingo-engine-x/docs/umbau/tutor-engine.md` (Entwurf, wird abgelöst)
- `/home/user/lingo-engine-x/docs/umbau/ki-tutor.md`
- `/home/user/lingo-engine-x/docs/umbau/wort-lernen-plan.md`
- `/home/user/lingo-engine-x/docs/umbau/gesamtkonzept.md`
- `/home/user/lingo-engine-x/docs/umbau/aktivierung.md`
- `/home/user/lingo-engine-x/docs/umbau/tagesaufbau.md`
- `/home/user/lingo-engine-x/src/domain/grammar/check.ts`
- `/home/user/lingo-engine-x/src/domain/grammar/explain.ts`
- `/home/user/lingo-engine-x/src/domain/grammar/errors.ts`
- `/home/user/lingo-engine-x/src/domain/grammar/bkt.ts`
- `/home/user/lingo-engine-x/src/domain/tutor/confusion.ts`
- `/home/user/lingo-engine-x/src/domain/tutor/explainOps.ts`
- `/home/user/lingo-engine-x/src/domain/tutor/edits.ts`
- `/home/user/lingo-engine-x/src/domain/tutor/diag.ts`
- `/home/user/lingo-engine-x/src/domain/tutor/contrast.ts`
- `/home/user/lingo-engine-x/src/ai/gate.ts`
- `/home/user/lingo-engine-x/src/ai/errors.ts`
- `/home/user/lingo-engine-x/src/ai/budget.ts`
- `/home/user/lingo-engine-x/src/ai/tutorBudget.ts`
- `/home/user/lingo-engine-x/contract/sample.d.ts`
- `/home/user/lingo-engine-x/contract/db.d.ts`

Hinweis für die Ablage: `answer-review@1` gibt es im Code noch nicht (keine Fundstelle unter `src/`). Falls der laufende MD-Agent es anders benennt, ist der Name in 6.3 anzupassen.