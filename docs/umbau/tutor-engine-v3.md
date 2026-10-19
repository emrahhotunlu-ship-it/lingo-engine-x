# Tutor-Engine v3: endgültiges Konzept (Stand 19.10.2026)

> Status: endgültiges Konzept (Opus, hoher Aufwand, nach unabhängiger Opus-Prüfung), 19.10.2026. Maßgeblich; ersetzt `tutor-engine.md` (v1) und v2. Emrahs Entscheidungen (19.10.2026): Claude prüft nur bei Unklarem; leichtere Aufgaben nach mehreren Fehlern: ja; „richtig, aber andere Form“ = geschafft + Zielform schreiben; „Ich lag richtig“ zählt allein auf seinen Tipp.

Ablage: `/home/user/lingo-engine-x/docs/umbau/tutor-engine-v2.md`. Der Dateiname bleibt; Inhalt ist Fassung v3. Sie ersetzt `/home/user/lingo-engine-x/docs/umbau/tutor-engine.md` und die v2-Antwort.

Grundlage:
- die Konzepte `ki-tutor.md`, `wort-lernen-plan.md`, `aktivierung.md`, `tagesaufbau.md`, `gesamtkonzept.md`
- der Stand in `stand.md` bis 19.10.
- die Verträge `contract/sample.d.ts` und `contract/db.d.ts` (0.2.49)
- der Code, Stand heute: `check.ts`, `write.ts`, `bkt.ts`, `GrammarItem.tsx`, `fit.ts`, `live.ts`, `flags.ts`

---

## 0. Was sich gegenüber v2 durch die Prüfung ändert

### 0a Übernommen (jeden Punkt am Code oder Vertrag nachgeprüft)

1. **Annahmen über Emrahs Fehler lassen sich jetzt widerlegen.**
   - Neue Zustände `refuted` (widerlegt), `quiet` (keine neuen Belege) und `resolved` (gelöst).
   - Rechnung zur Datenlage: etwa 40 Grammatikantworten am Tag auf etwa 130 Muster ergeben weniger als 0,5 Belege je Muster und Tag.
   - Deshalb ist eine Annahme erst „offen“ ab 3 getippten Belegen an mindestens 2 Tagen.
   - „Bestätigt“ heißt: mindestens 2 von 3 getippten Kontrastaufgaben in Richtung A→B falsch, nie nach einer einzelnen Auswahlaufgabe.
   - „Gelöst“ heißt: richtiger freier Gebrauch an mindestens 2 Tagen.
   - Prüfaufgaben und der Zustandsautomat kommen erst nach S4.
2. **Die Auswahl schwankt nicht mehr, und sie misst das Richtige.**
   - Erfolg wird über ein Fenster von 20 Antworten gemessen. Höchstens 1 Stufenwechsel je 5 Antworten.
   - Zielbereich 75–85 %, gemessen **nur an neu gestellten Grammatikaufgaben** (FSRS-Wiederholungen liegen bei etwa 90 % und würden das Bild verzerren).
   - Ermüdungsregel, der Zug `pause` und die Zielgröße „Erfolg nach Mini-Lektion“ sind zurückgestellt.
   - `hint` (vorhandener Zweitversuch mit Leitfrage) und `review` stehen jetzt in der Rangtabelle; `selfFix` wird nicht neu gebaut.
   - Sichtbarer Grund statt „Du wirst langsamer“: „Kurz etwas Bekanntes, dann weiter.“
3. **Verb-, Präpositions- und Kollokationsmuster sind Teil des Modells** (z. B. *depend on*, *avoid + -ing*, *make/do*).
   - Ursachen-Codes: `l1` ist als Ursache gestrichen (bleibt nur als Zusatzfeld); `prep` und `colloc` sind neu; `register` gilt als Aufwertung, nicht als Fehler.
4. **Die „had“-Falle ist entschärft.**
   - `l1:had-gewohnheit` ist gestrichen: Past Simple für frühere Zustände ist korrektes Englisch. Es gibt nur noch den Hinweis „*used to* betont den Gegensatz zu heute“.
   - Urteil `wrong` aus der lokalen Diagnose nur noch bei `form | auxform | order | span`.
   - Die Prüfung auf „Auch richtig“ läuft **immer vor** der Diagnose.
   - Höchstens 3 Erklärzeilen, die Ziel-Zeile zählt nicht mit.
   - Szenario 1 nutzt Emrahs echten Satz.
   - „Walking…“ ist eine Fehler-finden-Aufgabe (`cp-sub-f1`, `err [0,2]`). Sie bekommt `errAlt` für die zweite gültige Korrekturstelle.
5. **Technik**
   - Kein „Rückrollen“. Gebucht wird wie heute beim Tipp auf „Weiter“.
   - Späte Korrekturen nur als Ausgleichsbuchung mit Merker, und erst ab S4.
   - Gelernte Alternativen bekommen einen festen Ort: eine Objekt-Map mit Deckel in `grammar/<topic>`.
   - Emrahs eigener Einspruch „Ich lag richtig“ bleibt allein gültig.
   - `unsure` wird weiter als `near` gebucht (also wie richtig). Das ist hier ausdrücklich benannt und entschieden (siehe 4.1).
   - Vertragsregeln: Bei `refused` und `empty_completion` gibt es kein „Erneut versuchen“ mit derselben Eingabe. `session_expired` bedeutet „neu anmelden“. Ein Abbruch nach dem Absenden kostet trotzdem. Die Zustimmung gilt je Ansicht.
   - Widersprüche aus v2 aufgelöst: Claude stuft **nie** herab.
   - Vorlagen: `retryHint` als `Bi`; zu lange Listen und unbekannte IDs werden gekappt statt neu angefragt; ein JSON-Beispiel und der Satz „listed answers are examples, not exhaustive“ stehen im Prompt; `diagnose@2` läuft als `complex`.
   - Leistung: Zwischenspeicher je Dokument, Log-Fenster 56 Tage, Messung mit 4-facher CPU-Drosselung.
   - Tests: Pflichttests nach aktivierung.md Regel 9. Die Gold-Liste prüft nur das lokale Urteil; Claude wird über die KI-Stichprobe geprüft.
6. **Neuer kleinster Schritt S0**, abgestimmt auf den gebauten Stand (0c). Danach S1b, S2 und ein verkleinertes S3.
7. **Entscheidungsfragen neu formuliert** (vier Fragen, Frage 1 ist bereits beantwortet).

### 0b Abgelehnt oder abgewandelt

- **Name `grammar/<topic>.alt` → `fitAlt`.** Grund: Das Inhaltsfeld `task.alt` heißt schon so (`check.ts:123`). Zwei Bedeutungen unter einem Namen führen zu Fehlern.
- **„Erfolg nach Mini-Lektion“ nicht ganz gestrichen**, sondern als *beobachtete* Größe ohne Zielwert. Ohne sie lässt sich Rang 3 nie überprüfen.
- **E2 als `default`-Einspruch entfällt ganz.** Wenn Emrahs eigener Tipp allein zählt (Frage 4), braucht der Einspruch keinen Claude-Aufruf. Der Fall kommt nur auf die Prüfliste für den Englischlehrer.

### 0c Was schon gebaut ist (wird nicht doppelt gebaut)

- **Inhaltsfeld `alt: string[]`** je Aufgabe (`check.ts:14/123`, `tasks.ts:86`). Ergebnis „Auch richtig“ mit `kind:'other'`, das bucht nie BKT (`write.ts:50-51`). Emrahs Satz hat bereits `alt:["had"]` (`grammar-extra.json:7`).
- **`grammar-fit@1`** (quick) beim Tipp auf „Prüfen“ für Lücke und Umformung (`GrammarItem.tsx:270-284`, `fit.ts`):
  - zwischengespeichert in `lx:gfit`, nur auf dem Gerät
  - wenn Claude zustimmt, wird daraus `asAlsoRight`, also ohne BKT-Buchung
- **Zweitversuch mit Leitfrage** (`GrammarItem.tsx:191-197`).
- **`unsure` wird als `near` gebucht** (`:246`, `:267`); `near` zählt als richtig (`right.ts:11`).
- **Eigener Einspruch `override`** (`:320-323`).
- **Buchung erst bei „Weiter“** (`:325ff`).
- **Lücken gegenüber dem Plan:**
  - `grammar-fit` steht **nicht** unter `tutorBudget`.
  - Es prüft **nicht** auf `sampleConfirmed`; der Zustimmungsdialog kann also mitten in der Übung erscheinen.
  - Es gibt keine Familie `usedTo`, nur den Einzelfall im Inhalt.
  - Es gibt kein `errAlt`.
  - Der `catch` in `flags.ts:81-83` enthält nur einen Kommentar und kein `logWarn`.

---

## 1. Was „Intelligenz“ konkret heißt

Die App **weiß, erklärt und prüft**:
- Sie hat ein ausdrücklich formuliertes, abgeleitetes Bild von Emrah.
- Jede Entscheidung hat einen nennbaren Grund (Kap. 2 Nr. 4).
- Bild und Entscheidungen sind reine, deterministische Funktionen in `src/domain/tutor/`.
- Claude ist ein Fachkollege an wenigen Stellen. Claude bewegt nie Lernwerte und wählt nie die nächste Aufgabe. Gründe: kein Neuwürfeln (Kap. 15), Bastani, und Pflicht ohne KI (T-R7).

### 1.1 Lernermodell: abgeleitet, nie gespeichert

| Bereich | Inhalt | Quelle |
|---|---|---|
| Grammatik | je Muster: BKT-p, `certainty`, Quote der letzten 28 Tage (nur getippte feste Aufgaben), freie Tage, letzter Fehler, `TopicState` | `grammar/*`, `bkt.ts`, `path.ts`, Log |
| Wörter | je Karte: R, freie Tage, Zahl verschiedener Sätze, Stufe, **eine** Statuszeile | `vocab/*` `hist`/`fsrs`, ST |
| Gebrauchsmuster (neu) | `use:<lemma>+<partner>` (z. B. `use:depend+on`, `use:avoid+ing`, `use:make+decision`): erkannt, frei richtig, zuletzt falsch | Wortpartner-Verlauf (`col`), Grammatik-`pats` (gerInf, prep), `act/*`, Satzklinik-`edits` (`collocation`) |
| Gebrauch | „einsatzbereit“ je Karte | `act/<JJJJ-MM>`, `ready.ts` |
| Fehlerannahmen | `Hypothesis` (siehe 3.3) | Log `h`/`vs`, `errors[]`, `diag[]` |
| Tempo | Median der Zeit je Aufgabenart und Form (ohne Unterbrechungen > 60 s) | Log `ms` |
| Ziele | Kapitel, C1-Zielmuster, `ctx2` | `slotPlan`, `ctx2.ts` |

Zwei Abgrenzungen:
- **Wort und Grammatik** sind im Modell verknüpft (Status, Diagnose). In den Runden bleiben sie getrennt: Emrahs feste Regel vom 11.10. lautet „Grammatik hat in Vokabelrunden nichts zu suchen“.
- **Tagesform** gehört nicht zum Modell. Sie lebt nur in der Sitzung (`sessionStore`).

**Übertragungstabelle** `src/content/tutor/l1.json` (neu, etwa 40 Einträge, Gegenlesung 100 %):
- Aufbau je Eintrag: `{id, pat|use, vs, trigger_de, example{de,en}, why{de,en}, kind:'error'|'note'}`.
- Beispiele für Fehler: *seit* + Präsens, *depend of*, *make a photo*, *würde* im if-Satz.
- Beispiel für einen reinen Hinweis (`note`): *used to* gegenüber Past Simple. Ein `note` erzeugt **nie** ein Fehlerurteil.

**Ursachen-Codes:** `form | auxform | order | span | typo | confuse | prep | colloc | lexis | unknown`. Zusatzfelder: `vs` (Gegenmuster), `l1` (ID aus der Tabelle). `register` ist keine Ursache, sondern eine Aufwertung (`sev:'upgrade'`, wie in `edits.ts`).

### 1.2 Entscheidungspunkte für Claude (abschließend)

| # | Moment | Vorlage | Stufe | Auslöser | Lernwerte |
|---|---|---|---|---|---|
| E1 | lokal abgelehnte oder unklare Antwort prüfen | `grammar-fit@2` (erweitert `@1`) | quick | „Prüfen“; automatisch nur bei `sampleConfirmed`, sonst Knopf „Claude fragen“ | nie |
| E3 | „Warum ist meins falsch?“ | vorhanden `explain-answer@2` (ExplainMine) | quick | Tipp | nie |
| E4 | Wochen-Diagnose, Annahmen | `diagnose@2` | complex | Rundenende, ≥ 12 neue zugeordnete Fehler, einmal je ISO-Woche, `acquire` | nie |
| E5 | Aufgaben-Nachschub | `grammar-items@3` + `solve-check@1` | default + quick | Hintergrund, `sampleConfirmed`, `BG_PER_DAY` | nie (T-R8) |
| E6 | Satzbank | `word-bank@1` (SB) | quick | Hintergrund, ≤ 3 am Tag | nie |
| E7 | freie Produktion | vorhanden: `sentence-clinic@1`, `c1-mail@1`, `activate-check@1` | wie bisher | Tipp | Belege für Gebrauch und „gelöst“ |

E2 entfällt (siehe 0b).

---

## 2. Wie die Engine in jedem Moment entscheidet

### 2.1 Ablauf einer Antwort (in der vorhandenen Logik von `GrammarItem`)

```
Prüfen → judge (lokal; Familien/alt/fitAlt ZUERST, dann diagnoseAnswer)
  ├ correct/alt_ok/near/wrong sicher ──────────────→ Rückmeldung
  ├ wrong im 1. Versuch ───────────────────────────→ hint (vorhandener Zweitversuch, Leitfrage)
  └ unsure/fitAskable → sampleConfirmed? → E1 (AbortController, kein Timer, Hinweis nach SLOW_AFTER_MS.quick=8 s)
                      → sonst Knopf „Claude fragen“; ohne KI: unsure
Rückmeldung → [alt_ok & !fitsGoal: Angebot Zielform schreiben] → „Weiter“ = Buchung (writer.transform)
```

### 2.2 Zug-Entscheidung `decideMove` (rein; die erste zutreffende Regel gewinnt)

| Rang | Bedingung | Zug | Sichtbarer Grund | ab |
|---|---|---|---|---|
| 1 | erster Versuch falsch (nicht bei Auswahl, Messung oder `unsure`) | `hint` | Leitfrage (vorhanden) | heute |
| 2 | 3 getippte Antworten in Folge falsch | `win`: Muster mit p > 0,7, leichtere Form | „Kurz etwas Bekanntes, dann weiter.“ | S3 |
| 3 | 2 Fehler mit derselben Ursache am selben Muster in dieser Sitzung | `explain`: Mini-Lektion (Regel in einem Satz, Beispiel aus dem Beruf, Kontrast nur mit Beleg), danach `ask` eine Stufe leichter | „Abfragen hilft hier gerade nicht.“ | S3 |
| 4 | Fälliges im Slot (FSRS/BKT `due`) | `review` | „Fällig seit …“ | heute (`selectRound`) |
| 5 | Quote der letzten 20 **neu gestellten** Grammatikaufgaben > 85 % und letzter Stufenwechsel ≥ 5 Antworten her | `ask` eine Stufe freier | – | S3 |
| 6 | dieselbe Quote < 75 % (gleiche Sperre) | `ask` eine Stufe gestützter (`scaffolded`) | – | S3 |
| 7 | sonst | `ask` nach `nextTasks` | `WhyCode` | S2/S3 |

**Zurückgestellt:** Ermüdung, `pause` und die Prüfaufgabe für Annahmen (`hyp_test`, nach S4).

**Schutzregeln** (Invarianten mit Tests):
- Nie zwei `explain` ohne `ask` dazwischen.
- Höchstens 3 Erklärzeilen.
- Kontrastzeile nur bei einer offenen Annahme oder bei Ursache `confuse` in *dieser* Antwort.
- Pflicht wird leichter, aber nie kürzer. „Erledigt“ bleibt Zustand.
- Eine Extra-Runde kann Emrah immer beenden.
- Die Stufen-Verschiebung aus Rang 5 und 6 liegt als −1/0/+1 auf der p-gesteuerten Form (`wantTypes`). Der Pflichtplan bleibt fest (`u.v=1`, `u.rv`).

---

## 3. Rückkopplung: aus jeder Antwort wird Wissen

### 3.1 Fluss

```
Antwort → judge → (E1) → „Weiter“: Log-Eintrag (+v,+h,+vs) · grammar/<topic> (wie heute) · errors[] (nur wrong, FK-Ausschlussregeln)
       → buildLearnerModel (bei Rundenstart und bei jeder Rückmeldung) → Status · Plan · Erklärung
```

**Eine Wahrheit:** Status (ST), Plan (`nextTasks`) und Erklärung (`composeFeedback`) lesen nur `LearnerModel`. `confidenceOf`, `isFest` und `unitState` „Sicher“ werden intern Teil von `learner.ts`. Eine Lint- oder Testregel verbietet ihren Aufruf an anderer Stelle.

### 3.2 Datenfelder (nur ergänzend: `looseObject`, `writer.transform`, nie löschen, +0 Dokumente)

| Ort | Feld | Größe |
|---|---|---|
| Antwort-Log (`logs`, wie `attemptsOf` in `confusion.ts`) | `v` (c/a/n/w/u), `h` (≤ 12 Zeichen), `vs` (≤ 40) | ≤ 60 B je Eintrag |
| `errors[]` | `h` neu (vorhanden: `pat`, `ax`, `cf`, `unclear`) | ≤ 20 B |
| `grammar/<topic>.fitAlt` | Objekt-Map `{[taskKey]: {[hash]: {a, t, by:'ai'\|'me', pv}}}`, höchstens 8 je Aufgabe, 60 je Thema; ältester Eintrag fällt beim Schreiben heraus (Obergrenze, kein Löschen alter Lernstände) | ≤ 8 KB je Thema |
| Inhalt (Repo) | `errAlt: [{err:[a,b], answer, accepted[], why{de,en}}]` je Fehler-finden-Aufgabe | Build |
| `diag[]` | `out.hyps[]` aus `diagnose@2` | ≤ 4 KB je Woche |

Bedeutung von `fitAlt`:
- `by:'ai'`: Claude hat ja gesagt. Das ergibt beim nächsten Mal sofort `alt_ok` **ohne Buchung**, ohne neuen Aufruf und auf jedem Gerät. Das ersetzt `lx:gfit` als Wahrheit; `lx:gfit` bleibt nur Zwischenspeicher.
- `by:'me'`: Emrahs Einspruch. Beim nächsten Mal `correct` wie `override`.
- Beide Arten landen in einer Exportliste für den Englischlehrer. Eine Bestätigung geht als `accepted`/`alt` **in den Inhalt** ins Repository, nicht in die Datenbank.

**Späte Korrektur (erst ab S4, falls nötig):**
- Nur als Ausgleichsbuchung in `writer.transform`, mit Merker `fix:'<t>|<id>'` am Log-Eintrag. Ist der Merker schon gesetzt, wird nichts gebucht (`update` kann doppelt ankommen, `db.d.ts:294`).
- Betroffen: `due`, `errors[]` (Merker `void`), `pats`, `c`.
- p wird nicht zurückgerechnet. Grund: Tagesanker und Tagesband (`bkt.ts:77-79`) machen ein exaktes Rückrollen unmöglich.
- In S0–S3 gibt es keine späten Korrekturen: Claude und der Einspruch wirken **vor** „Weiter“.

### 3.3 Annahmen (`hypotheses.ts`, abgeleitet)

- **Beleg:** getippte Antwort (keine Auswahl), Urteil `wrong`, Ursache `confuse|prep|colloc` mit `vs`, innerhalb von 28 Tagen. Eine Antwort mit Hilfe zählt als halber Beleg.
- **`open`:** ≥ 3 Belege in derselben Richtung A→B, an ≥ 2 Tagen. Vorher gibt es keine Annahme und keine Kontrastzeile.
- **`quiet`:** 14 Tage ohne neuen Beleg. Anzeige „keine neuen Belege“, **nicht** „gelernt“.
- **`resolved`:** richtiger freier Gebrauch des Musters an ≥ 2 Tagen (E7-`Used ok`, `act/`) und 28 Tage ohne Beleg.
- **Ab S5:** `confirmed` bei ≥ 2 von 3 getippten Kontrastaufgaben falsch in Richtung A→B; `refuted` bei ≥ 2 von 3 richtig; sonst bleibt der Zustand.
- **Formulierung:** immer als Frage („Kann es sein, dass …?“), mit den Belegen daneben.

---

## 4. Qualität: kein falsches „falsch“

### 4.1 Urteilsregel (Invariante)

1. **Zuerst** wird auf „Auch richtig“ geprüft, in dieser Reihenfolge: genaue Lösung bzw. `accepted` → britische Form → `altFamilies` → `task.alt` → `fitAlt` → `errAlt`. Treffer ergeben `correct` oder `alt_ok`.
2. **Dann `diagnoseAnswer`.** `wrong` nur, wenn eine dieser Bedingungen gilt:
   - (a) die Antwort trifft eine bekannte falsche Form oder einen Signalwort-Konflikt (`hasSignal`, `foreignSignalPattern`),
   - (b) die Ursache ist `form | auxform | order | span`.
3. Sonst: `fitAskable` → E1, ohne KI `unsure`.
4. **Claude stuft nur hoch** (`unsure`/`wrong` → `alt_ok`) und **nie herunter**. Sagt Claude „falsch“, bleibt das lokale Urteil stehen; Claudes Korrektur erscheint nur als gekennzeichnete Erklärung (AiMark) und kommt nicht in `errors[]`.
5. **`unsure` wird weiter als `near` gebucht** (zählt für BKT als richtig, `right.ts:11`). Begründung:
   - Eine neutrale Buchung würde Umformungen und Schlüsselwort-Aufgaben mit vielen gültigen Fassungen (dauerhaft `unsure`, besonders ohne KI) auf Dauer ohne Fortschritt lassen.
   - Das Gegenrisiko, dass echte Fehler als richtig zählen, begrenzen `closeVariant` (Überlappung ≥ 0,75) und die negative Gold-Liste.

**Buchung bei `alt_ok`:**

| Fall | Erledigt? | Buchung |
|---|---|---|
| lokale Familie (z. B. `thatOpt`, `kind:'alt'`) | ja | voll |
| `fitsGoal = true` (Zielmuster in anderer Form richtig) | ja | Knopf „Zählt“ = `override`, dann voll |
| `fitsGoal = false` (anderes Muster, z. B. „had“) | ja | keine; Angebot „Schreib es einmal mit *used to*“. Diesen Zweitversuch bewertet die App selbst und bucht ihn mit halbem Gewicht (`helpLevel 1`, `bkt.ts:76`), **ohne** `firstWrong` |

### 4.2 Aufgaben-Hülle und `lintTask`

- Felder: `goal`, `constraint`, `accept: 'exact'|'target'|'any-correct'`.
- `lintTask` meldet: `ambiguous | no_goal | gap_whole | no_verb | no_source | foreign_signal`.
- Ab S1b läuft `lintTask` über den ganzen Bestand, **zunächst nur als Warnliste**. Zur Sperre wird es erst nach dem Inhalts-Audit, und vor jeder Annahme von Claude-Aufgaben (E5).

### 4.3 Prüftore und Messgrößen

- **Gold-Liste** `tests/tutor/gold/grammar.json`:
  - prüft **nur das lokale `judge`**
  - S0: etwa 40 positive Fälle (dürfen nie `wrong` ergeben) und 20 negative (dürfen nie `correct`/`alt_ok` ergeben), darunter alle gemeldeten Fälle Emrahs
  - später ≥ 200 positive und ≥ 100 negative
- **Claudes echte Urteile** werden über die KI-Stichprobe geprüft (`quality.ts` `recordShown`/`sampleFile`, wie in `ki-tutor.md`), mit Gegenlesung durch den Englischlehrer.
- Regel-Test je gemeldeter Fehlerklasse (Q5). Gegenlesung 100 % für Inhalte, `l1.json` und `errAlt`.

| Messgröße | Ziel |
|---|---|
| zu Unrecht falsch (Einsprüche, die der Lehrer bestätigt, je `wrong`) | < 2 % |
| Anteil `unsure` | < 8 % |
| Melde-Quote | ≤ 5 % |
| E1-Aufrufe | Median ≤ 5 am Tag |
| Erfolg nach Mini-Lektion | nur beobachten |

**Ohne KI** laufen Urteil, Erklärung, Pflicht, Serie und Plan vollständig lokal.

---

## 5. Einbettung und Scheibenfolge

| Paket | Rolle | keine Doppelstruktur, weil |
|---|---|---|
| MD (gebaut) | Basis: `alt`, `grammar-fit@1`, „Auch richtig“ | wird in S0/S1b erweitert, nicht ersetzt |
| FK (gebaut) | Ausschlussregeln; B1/B2 nutzen ab S2 `judge` | eine Prüfroutine |
| ST (gebaut) | wird Leser von `LearnerModel` (S2) | eine Wahrheit |
| WL (gebaut) | Wortseite von `nextTasks`, Regeln unverändert | – |
| SB | Inhaltsquelle (E6) | – |
| T1 `explain-answer@2` | E3 auf Knopfdruck | kein neuer Erklärer |
| T2 `grammar-items@3` | E5 mit `solve-check` und `lintTask` | – |
| P49 `diagnose@1` | wird `@2` mit Annahmen | gleicher Speicher `diag[]` |

**S0 „Kein falsches Falsch“** (klein, baut auf MD auf):
1. Familie `usedTo|pastSimple|would` in `rules.ts`, falls noch nicht vorhanden; heute gibt es nur den Einzelfall im Inhalt.
2. Regel 4.1 (zuerst „Auch richtig“, `wrong` nur nach (a)/(b)) mit minimalem `diagnoseAnswer`. Erkennt `form`, `auxform`, `order` und `span` aus `explainOps`.
3. `errAlt` in `checkFind` und für `cp-sub-f1` sowie die anderen Fehler-finden-Aufgaben mit zweiter gültiger Stelle.
4. Die 30–50 mehrdeutigsten Lückenaufgaben prüfen: Ergebnis des MD-Audits übernehmen, nur fehlende ergänzen.
5. `grammar-fit` unter `tutorBudget`; automatisch nur mit `sampleConfirmed`, sonst Knopf; Fehlerbehandlung nach 6.4.
6. T1 „Warum ist meins falsch?“ einschalten. Eigener Einspruch bleibt.
7. Gold-Liste 40/20.
8. `flags.ts:81-83` mit `logWarn`.

*Spürbar:* Richtige Antworten gelten nicht mehr als falsch, und die Erklärung geht auf Emrahs Fassung ein.

**S1b „Fair und gemerkt“**
- `grammar-fit@2` mit `fitsGoal`, `why: Bi`, `edits`
- `fitAlt` in der Datenbank
- `lintTask` als Warnliste
- Zielform-Angebot bei `alt_ok`
- Log-Felder `v`/`h`/`vs`
- volles `diagnoseAnswer` mit `prep`, `colloc` und `l1.json`

**S2 „Ein Status, eine Wahrheit“**
- `learner.ts`, ST und FK lesen das Modell
- Zeile „Warum diese Aufgabe?“
- Fortschrittsbelege („vor 3 Wochen 4 von 9, jetzt 8 von 9“) vorgezogen

**S3 „Der Tutor reagiert“ (verkleinert):** Rang 2, 3, 5 und 6 mit Glättung; `nextTasks` hinter `selectRound`.

**S4:** E5 und E6, `diagnose@2` mit `open`/`quiet`/`resolved`.

**S5:** Prüfaufgaben und `confirmed`/`refuted`, Ausgleichsbuchung.

---

## 6. Schnittstellen

### 6.1 Dateien

| Datei | Verantwortung |
|---|---|
| `src/domain/tutor/learner.ts` (neu) | `buildLearnerModel`, Zwischenspeicher je Dokument |
| `src/domain/tutor/hypotheses.ts` (neu) | Annahmen nach 3.3 |
| `src/domain/tutor/diagnose.ts` (neu) | `diagnoseAnswer` (`explainOps`, `l1.json`, Partnerlisten) |
| `src/domain/tutor/judge.ts` (neu) | Regel 4.1 um `checkGrammar`/`checkFind`/`checkKwt` |
| `src/domain/tutor/lintTask.ts` (neu) | Prüfung der Aufgaben-Hülle |
| `src/domain/tutor/policy.ts` (neu) | `decideMove`, `nextTasks`, `WhyCode` |
| `src/domain/tutor/feedback.ts` (neu) | `composeFeedback` (Bausteine aus `grammar/explain.ts`) |
| `src/content/tutor/l1.json` (neu) | Übertragungstabelle |
| `src/prompts/grammarFit.ts` (@2), `diagnoseV2.ts`, `solveCheck.ts` | Vorlagen |
| `src/features/tutor/sessionStore.ts` (neu, Zustand) | Sitzung: letzte 20, Serie falscher Antworten, letzter Stufenwechsel |
| geändert: `grammar/check.ts`, `rules.ts`, `features/grammar/fit.ts`, `GrammarItem.tsx` | Familien, `errAlt`, Budget und Zustimmung, Zielform-Angebot |

### 6.2 Signaturen

```ts
// learner.ts
export type Verdict = 'correct' | 'alt_ok' | 'near' | 'wrong' | 'unsure';
export type Cause = 'form' | 'auxform' | 'order' | 'span' | 'typo' | 'confuse' | 'prep' | 'colloc' | 'lexis' | 'unknown';
export type HypState = 'open' | 'quiet' | 'resolved' | 'confirmed' | 'refuted';
export type Hypothesis = { id: string; from: PatternId | UseId; to: PatternId | UseId; l1: string | null;
  n: number; days: number; lastT: number; state: HypState; ev: readonly string[] };
export type PatternKnow = { pat: PatternId; p: number; certainty: 0|1|2|3|4|5;
  q28: { n: number; ok: number }; freeDays: number; lastWrong: number | null; state: TopicState };
export type UseKnow = { id: UseId; seen: number; freeOk: number; lastWrong: number | null; cards: readonly string[] };
export type WordKnow = { id: string; R: number | null; freeDays: number; sentences: number; stage: number;
  status: 'recognize' | 'withHelp' | 'free' | 'newSentence' | 'used'; head: 'good' | 'shaky' | 'forgotten' | 'noGap' };
export type LearnerModel = { asOf: number; day: string;
  patterns: ReadonlyMap<PatternId, PatternKnow>; uses: ReadonlyMap<UseId, UseKnow>;
  words: ReadonlyMap<string, WordKnow>; hyps: readonly Hypothesis[];
  pace: Readonly<Record<string, number>>; goals: { chapter: number | null; c1: readonly PatternId[]; ctx: Ctx2 | null } };
export type LearnerSources = { grammarDocs: ReadonlyMap<string, Doc>; logs: ReadonlyMap<string, Doc> /* Fenster 56 Tage */;
  vocab: ReadonlyMap<string, Doc>; act: ReadonlyMap<string, Doc>; profile: Doc | null; diag: readonly DiagEntry[] };
export function buildLearnerModel(src: LearnerSources, now: number): LearnerModel;

// diagnose.ts – läuft erst NACH der „Auch richtig“-Prüfung
export type Diagnosis = { cause: Cause; vs: PatternId | UseId | null; l1: string | null;
  span: [number, number] | null; ops: ExplainOp[]; conf: 'sure' | 'likely' | 'none' };
export function diagnoseAnswer(task: GrammarTask, given: string, m: LearnerModel | null): Diagnosis;

// judge.ts
export type Judgement = { v: Verdict; kind: GrammarCheck['kind']; by: 'local' | 'ai' | 'me';
  fitsGoal: boolean | null; book: 'full' | 'half' | 'none'; askAi: 'auto' | 'button' | 'no' };
export function judge(task: GrammarTask, given: string, ctx: { fitAlt: FitAltIndex; dx?: Diagnosis;
  ai?: GrammarFitOut | null; aiState: { confirmed: boolean; available: boolean; budgetLeft: number } }): Judgement;

// lintTask.ts
export type LintIssue = 'ambiguous' | 'no_goal' | 'gap_whole' | 'no_verb' | 'no_source' | 'foreign_signal';
export function lintTask(task: GrammarTask): readonly LintIssue[];

// policy.ts
export type Move = 'ask' | 'hint' | 'explain' | 'review' | 'win';
export type WhyCode = 'due' | 'weak' | 'chapter' | 'mix' | 'known' | 'freer' | 'supported' | 'hyp';
export type Session = { lastNew20: readonly boolean[]; wrongRun: number; sameCause: Readonly<Record<string, number>>;
  sinceShift: number; shift: -1 | 0 | 1; lastMove: Move | null; duty: boolean };
export function decideMove(s: Session, m: LearnerModel, firstTryWrong: boolean): { move: Move; why: WhyCode };
export function nextTasks(m: LearnerModel, pool: readonly GrammarTask[], slot: SlotRole, seed: string, n: number, shift: -1|0|1)
  : readonly { task: GrammarTask; why: WhyCode; ref: string | null }[];

// feedback.ts – goal zählt nicht zu den 3 Erklärzeilen
export type FeedbackModel = { goal: Bi | null; verdict: Verdict; yours: Bi | null; why: Bi; extra: Bi | null;
  action: 'next' | 'targetForm' | 'counts'; marks: readonly [number, number][]; aiMark: boolean };
export function composeFeedback(i: { task: GrammarTask; j: Judgement; dx: Diagnosis | null; m: LearnerModel | null;
  ai: GrammarFitOut | null; lang: 'de' | 'en' }): FeedbackModel;
```

**Leistung:**
- `live.ts:162-188` baut bei jeder Lieferung neue Maps. `buildLearnerModel` speichert deshalb je Dokument mit Schlüssel `pfad + t`/`last` (fehlt das Feld, wird neu gerechnet) und fasst schrittweise zusammen.
- Berechnet wird nur bei Rundenstart und bei jeder Rückmeldung.
- Ziel: < 30 ms am Handy, gemessen mit 4-facher CPU-Drosselung. Achtung: Der Test „Statuszeile Großdatensatz“ ist bei 4× schon rot (`stand.md`). Das Modell darf ihn nicht verschlechtern; ideal ist, dass ST ihn über das Modell behebt.

### 6.3 Vorlagen

**`grammar-fit@2`** (quick, Nachfolger von `@1`)
- **Kopf:** `header()`, Rolle C1-Lehrer, US-Englisch, britische Formen gelten als richtig, „minimal korrigieren, Stil ist kein Fehler“, `QUOTE_RULE`, **„The listed answers are examples, not exhaustive.“**, dazu ein JSON-Beispiel.
- **Eingaben:**
  - Aufgabe/Satz ≤ 300 B, `goal`/`constraint` ≤ 200 B
  - ganzer Satz mit Antwort ≤ 300 B, erwarteter Satz ≤ 300 B
  - `accepted`/`alt` ≤ 6 (≤ 600 B), Muster und Regel ≤ 400 B
  - Modus `gap|find|transform|kwt`, UI-Sprache
  - Summe etwa 2,5 KB
- **zod-Schema:**

```ts
z.object({
  fits: z.boolean(), certain: z.boolean(), fitsGoal: z.boolean().catch(false),
  why: BiSchema,                                   // {de,en} je ≤ 240
  edits: z.array(EditSchema).transform((a) => a.slice(0, 3)).catch([]),
  vs: PatternIdSchema.nullable().catch(null),      // unbekannte IDs → null, kein Neuversuch
  retryHint: BiSchema.nullable().catch(null),
})
```

- **Nach dem Lesen:** angenommen wird nur `fits && certain`. `fits` mit `edits` vom Schweregrad `error` wird zu `certain:false`.

**`diagnose@2`** (complex)
- Eingaben: `patStats` ≤ 2 KB, `evidenceText` ≤ 4,9 KB (vorhanden), Annahmen ≤ 1 KB, `l1`-IDs, Musterliste ≤ 3 KB. Summe etwa 11 KB.
- Ausgabe: `hyps:[{id, verdict:'likely'|'unlikely'|'unclear', ev:string[], why:Bi}]` (gekappt auf 5), `focus: PatternId[]` (gekappt auf 3), `summary: Bi`.
- IDs, die nicht in den Eingaben vorkommen, werden verworfen.

**`solve-check@1`** (quick)
- Eingabe: Aufgabe ohne Lösung, mit `constraint`, ≤ 600 B.
- Ausgabe: `answers: string[]` (≤ 6, gekappt), `ambiguous`, `why: Bi`.
- Annahme der Aufgabe nur, wenn die Lösung in `answers` steht und jede weitere gültige Antwort in `accepted`/`alt` landet; sonst wird sie verworfen.

**Neuversuch:** genau einer, nur bei einem Schemafehler, der sich nicht kappen lässt (A6.3).

### 6.4 Fehlerbehandlung je Code (`failureFromSample`)

| Code | Verhalten |
|---|---|
| `cancelled` | still; lokales Urteil bleibt. Hinweis im Code: Ein Abbruch nach dem Beginn hat schon Kontingent verbraucht (Vertrag Z. 544-547) |
| `not_granted`, `sampling_disabled`, `not_declared`, `capability_*` | E1/E3 für diese Ansicht ausblenden; `unsure` lokal; `logWarn` |
| `rate_limited` | „Claude ist gerade ausgelastet“; Knopf bleibt, nie automatisch; Hintergrund pausiert (`backgroundPaused`) |
| `session_expired` | „Bitte in claude.ai neu anmelden“; Knopf bleibt |
| `refused`, `empty_completion` | lokales Urteil bleibt, **kein** „Erneut versuchen“ mit derselben Eingabe (Z. 595-601); Teiltext entfernen |
| `invalid_json`, `upstream_error` | „Erneut versuchen“ (Tipp, `cacheFor(…, refresh)`) |
| Schemafehler, nicht kappbar | einmal `retryPrompt` (A6.3) |
| `invalid_request`, `prompt_too_large`, `transform_error`, `queue_overflow` | `logError`, Funktion für diese Aufgabe aus |

### 6.5 Budget

- **E1:** etwa 3 am Tag (unter 8 % `unsure` bei etwa 40 Antworten). Deckel `TUTOR_PER_DAY` 20, neu auch für `grammar-fit`.
- **E3:** nach Bedarf, gleicher Deckel.
- **Hintergrund:** `BG_PER_DAY` 6 (`budget.ts:15`; `ki-tutor.md` sagt 5 und wird angeglichen). E4 ist reserviert.
- Kein Zeitgeber (A6.2). Nach 8 s (quick) erscheint ein Hinweis mit Stopp.
- Alles läuft über das Claude-Kontingent im Abo und verbraucht es.

---

## 7. Tutor-Test

**Simulation** `tests/tutor/sim.test.ts` (fester Startwert, ohne KI): P1 „Vertrieb B2+“, P2 „Fehlerserie“, P3 „stark“, P4 „Rater“.

Erwartungen:
- P1/P3 nach 40 Zügen bei 70–90 % auf neu gestellten Aufgaben.
- P2 bekommt nach 3 Fehlern `win`, die Pflicht wird nicht kürzer.
- P4 erreicht nie Stufe ≥ 3.
- Höchstens 1 Stufenwechsel je 5 Antworten.
- Nie zwei `explain` hintereinander.
- Eine Annahme ist erst `open` nach 3 Belegen an 2 Tagen; eine einzelne falsche Auswahlaufgabe erzeugt keine.
- `quiet` ist nie `resolved`.
- Gleicher Startwert ergibt denselben Plan.

**Szenarien:**
1. **„We ___ (have) a paper archive, but now everything is in the cloud.“**
   - „had“ → `alt_ok`, `fitsGoal:false`, Aufgabe erledigt, keine Buchung, Angebot Zielform.
   - „used to have“ im Zweitversuch → halbes Gewicht.
   - „have had“ → `wrong` nach Regel (a)/(b) oder `unsure`, nie `alt_ok`.
2. **„Walking to work, my phone rang twice.“** (`cp-sub-f1`)
   - Ersatz der Stelle `[0,2]` aus `accepted` → `correct`.
   - Stelle im Hauptsatz mit „I heard my phone ring twice“ über `errAlt` → `correct`, mit eigener Begründung.
   - Die Erklärung zitiert Emrahs Fassung. Ohne Beleg gibt es keine Zeile „Nicht verwechseln“.
3. **Frust-Serie:** 3 getippte Fehler → `win`, dann höchstens eine Erklärung; Zähler und Häkchen bleiben stimmig.
4. **Ohne KI** (`?fake=nosample`): `unsure` wird als `near` gebucht, mit Hinweis und ohne Claude-Knopf; die Serie läuft weiter.
5. **Ohne Zustimmung:** kein automatischer Aufruf, nur der Knopf „Claude fragen“.
6. **Aktivierung Regel 9:**
   - Zwei Geräte schreiben gleichzeitig in `fitAlt`: beide Einträge bleiben.
   - Wiederholung ohne Doppelung: ein Eintrag mit gleichem Hash entsteht nur einmal.
   - Zweimaliges Buchen derselben Antwort (`t|id`) ergibt nur eine Buchung.

**Weitere Tests:**
- **Gold:** nur das lokale `judge` (4.3). Claude über die KI-Stichprobe.
- **Widerspruch:** ein Modell in Liste, Wortblatt, Übung und Hub ergibt dieselbe Statuszeile.
- **Sprache:** jede `Bi`-Ausgabe in DE und EN vorhanden.
- **E2E:** Szenarien 1, 2, 4 und 5 am Handy und am Desktop.
- **Leistung:** Modell mit 5.000 erfundenen Dokumenten bei 4-facher Drosselung.

---

## 8. Risiken und Entscheidungen

| Risiko | Gegenmaßnahme |
|---|---|
| `unsure` als `near` lässt echte Fehler als richtig durchgehen | `closeVariant` ≥ 0,75, negative Gold-Liste, Anteil `unsure` < 8 % messen |
| Umformung und Schlüsselwort-Aufgabe ohne KI dauerhaft `unsure` | `errAlt`/`accepted` gezielt ergänzen (Audit), `solve-check` für neue Aufgaben |
| quick-Modell sagt zu oft „auch richtig“ | nur `fits && certain`, keine Buchung bei `fitsGoal:false`, Stichprobe, Lehrerliste aus `fitAlt` |
| Emrah tippt „Ich lag richtig“, obwohl er falsch lag | `by:'me'` geht auf die Lehrerliste; Bestätigung nur im Inhalt |
| Zustimmungsdialog mitten in der Übung | automatisch nur mit `sampleConfirmed` |
| Leistung am Handy (Statuszeile ist schon rot) | Zwischenspeicher je Dokument, Fenster 56 Tage, Messtest |
| Zwei Wahrheiten bleiben | Lint- bzw. Testregel gegen `confidenceOf`/`isFest` außerhalb von `learner.ts` |
| Umfang wächst | S0 klein und für sich nützlich; nach jeder Scheibe Test-Link und Emrahs Urteil |
| Übertragungstabelle fachlich schief | Gegenlesung 100 %; `note` erzeugt nie ein Fehlerurteil |

### Entscheidungen für Emrah (einfache Worte)

1. **Wenn die App bei deiner Antwort unsicher ist**, fragt sie Claude kurz: 1–2 Sekunden, etwa 3-mal am Tag, das kostet etwas von deinem Claude-Kontingent. Oder nur, wenn du „Prüfen lassen“ tippst? **Bereits beantwortet:** Emrah hat „nur bei Unklarem“ gewählt (automatisch, solange Claude in dieser Ansicht schon freigegeben ist, sonst Knopf).
2. **Wenn mehrere Antworten hintereinander falsch sind:** Soll die App leichtere Aufgaben einschieben? Eine Extra-Runde kannst du immer beenden. *Vorschlag:* ja.
3. **Ist deine Antwort richtig, aber nicht die geübte Form**, zählt die Aufgabe als geschafft. Schreibst du danach die geübte Form einmal selbst, zählt das auch für deinen Fortschritt. Benutzt du die geübte Form nur anders, zählt es sofort voll. *Vorschlag:* so umsetzen.
4. **Soll „Ich lag richtig“ weiter allein auf deinen Tipp zählen?** *Vorschlag:* ja.

---

## 9. Prüfliste gegen Kapitel 3

| Punkt | | Fundstelle |
|---|---|---|
| Eine Datei ≤ 16 MB, alles eingebettet | ✅ | nur `l1.json` (etwa 15 KB) und `errAlt` im Build; `check:platform` |
| Kein Server, kein `fetch` | ✅ | nur `sample` über `src/ai` |
| Zugriff nur über `/src/platform` | ✅ | `domain/tutor` ist rein; `fit.ts` über `useAsk`/`capabilities` |
| `claude.use` darf `null` liefern | ✅ | 4.1 Nr. 5, Szenario 4 |
| `sample` ohne Gedächtnis, ≤ 64 KiB | ✅ | 6.3: höchstens etwa 11 KB, jede Anfrage vollständig |
| Fehlercodes, kein Zeitgeber, Neuversuch nach A6.3 | ✅ | 6.4; `refused`/`empty_completion` ohne Wiederholung mit gleicher Eingabe |
| Zustimmung je Ansicht | ✅ | 2.1, Szenario 5 (`sampleConfirmed`) |
| `onSnapshot` einmal je Abfrage | ✅ | keine neuen Abos; Modell aus `live.ts` |
| Schreiben nur bei Änderung, eine Schreiboperation je Dokument, `update` nur auf vorhandene Dokumente | ✅ | Buchung bei „Weiter“; `fitAlt` als Objekt-Map in `writer.transform`; Merker gegen Doppelbuchung |
| Dokumentgrenzen | ✅ | +0 Dokumente; `fitAlt` ≤ 8 KB je Thema; Log +60 B |
| Lernfortschritt nur in `db` | ✅ | `lx:gfit` nur Zwischenspeicher, Wahrheit in `fitAlt`; Sitzungszustand ungespeichert |
| Entwicklungs-Adapter ausgeschlossen | ✅ | feste Antworten für `grammar-fit@2`/`diagnose@2`/`solve-check@1` nur in `src/platform/dev/cannedReplies.ts` |
| Keine leeren `catch`, alles im Protokoll | ❌ → S0 | `/home/user/lingo-engine-x/src/app/flags.ts:81-83`: nur ein Kommentar, kein `logWarn` |
| Kein Prompt-Text in der Oberfläche, Vorlagen mit zod | ✅ | 6.3 |
| Optimistisch mit Rückrollen, Skelette | ✅ (abgewandelt) | Urteil steht vor der Buchung; Skelett-Zeile während E1; späte Korrektur als Ausgleich (S5) statt Rückrollen, weil der Vertrag „letzter Schreiber gewinnt“ vorgibt und Tagesanker/-band (`bkt.ts:77-79`) gelten |
| Stack | ✅ | Zustand (`sessionStore`), zod, ts-fsrs unverändert; XState nur, wo heute schon genutzt |

**Wo der Vertrag den Auftrag schlägt:**
- Kap. 10 „Timeout“ → nur Hinweis mit Stopp (A6.2).
- Kap. 10 „einmal neu anfragen“ → nur ein Neuversuch bei Schemafehler, Kappen geht vor (A6.3).
- Kap. 3 „Rückrollen“ → Ausgleichsbuchung, weil `update` doppelt ankommen kann (`db.d.ts:293-295`).
- Kap. 3.1 „eine Datei“ → Mehr-Datei-Build ist erlaubt (A7), Standard bleibt eine Datei.

---

**Relevante Pfade:**
- `/home/user/lingo-engine-x/docs/umbau/tutor-engine.md`
- `/home/user/lingo-engine-x/docs/umbau/ki-tutor.md`
- `/home/user/lingo-engine-x/docs/umbau/wort-lernen-plan.md`
- `/home/user/lingo-engine-x/docs/umbau/aktivierung.md`
- `/home/user/lingo-engine-x/docs/umbau/stand.md`
- `/home/user/lingo-engine-x/src/domain/grammar/check.ts`
- `/home/user/lingo-engine-x/src/domain/grammar/write.ts`
- `/home/user/lingo-engine-x/src/domain/grammar/bkt.ts`
- `/home/user/lingo-engine-x/src/domain/learn/right.ts`
- `/home/user/lingo-engine-x/src/features/grammar/GrammarItem.tsx`
- `/home/user/lingo-engine-x/src/features/grammar/fit.ts`
- `/home/user/lingo-engine-x/src/prompts/grammarFit.ts`
- `/home/user/lingo-engine-x/src/content/grammar-extra.json`
- `/home/user/lingo-engine-x/src/content/grammar/tasks-v2.json`
- `/home/user/lingo-engine-x/src/data/live.ts`
- `/home/user/lingo-engine-x/src/ai/budget.ts`
- `/home/user/lingo-engine-x/src/ai/tutorBudget.ts`
- `/home/user/lingo-engine-x/src/platform/capabilities.ts`
- `/home/user/lingo-engine-x/src/app/flags.ts`
- `/home/user/lingo-engine-x/contract/sample.d.ts`
- `/home/user/lingo-engine-x/contract/db.d.ts`

**Hinweise:**
- `git log` konnte ich nicht ausführen (nur Lesewerkzeuge). Den gebauten Stand habe ich direkt im Code geprüft (0c).
- Zeilenangaben aus der Prüfung zu `GrammarItem.tsx` (182, 236/256, 293-313) passen nicht mehr genau zum heutigen Stand. Gültig sind 191-197, 246/267, 320-325.