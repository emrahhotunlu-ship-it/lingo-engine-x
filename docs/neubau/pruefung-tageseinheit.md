# Prüfung Tageseinheit (learning-scientist, 27.09.2026, eine Runde)

**Status:** vom Integrator angenommen, verbindlich (plan.md §8). Muss-Befunde sind Abnahmekriterien; Sollte-Befunde sind Soll.

## Prüfung: plan.md §1.5 (Tageseinheit und Wochenplan) und §1.3 (Hub „Üben“), gegen Kap. 5, Kap. 2.4, anki-regeln.md und lehrer.md §2

Das war eine einzige Runde, nichts wurde geändert. Zusätzlich gelesen habe ich `src/domain/plan/{pflicht,buildPlan,channels}.ts`, `src/domain/srs/queue.ts` (`planRound`), `src/domain/progress/settings.ts` und `src/domain/progress/logPatch.ts`.

**Urteile**

| Element | Urteil |
|---|---|
| Blöcke | nachbessern |
| Zeitdeckel | nachbessern |
| Wochenplan Mo–So | nachbessern |
| Kurz-Einheit | nachbessern |
| Rückfälle ohne KI/Sprachausgabe | verfehlt |
| Pflicht/Serie | nachbessern |
| Hub „Üben“ | erfüllt (ein Hinweis, siehe Ü1) |

Was trägt: Anki-Modus mit `auto` und DE→EN, Output unter Druck an Di, Do, Fr und Sa, täglich Nachsprechen, Kontingent 0/2/5/10, „Pflicht“ und „Extra“ getrennt, Plan je Lerntag eingefroren.

---

### Muss

**M1 · §1.5 Block 1, Reihenfolge: neue Karten fehlen**
- **Problem:** Die Reihenfolge „Reparatur → Wochenthema → Fällige“ enthält keine neuen Karten. Wegen des 8-Minuten-Deckels fallen sie an vollen Tagen weg (Kap. 6.3, Kap. 15, anki-regeln §5). Werden nicht fällige Themenkarten vorgezogen, sieht Emrah dieselben Karten Mo–Fr jeden Tag. Das ist Massieren statt Verteilen.
- **Korrektur:**
  - Reihenfolge: fällige Reparatur-Sätze (höchstens 3, höchstens 2 Min.) → fällige Karten, Wochenthema zuerst → neue Karten, eingestreut an Position 2, 5, 8 (wie `planRound`).
  - Neuer Anteil etwa 40 % der Kartenzeit, Untergrenze `min(2, Kontingent)`. Es gibt ein Kontingent für alle Wege.
  - Themenkarten nur, wenn fällig oder neu (`isThemeCard`, Korb-Stufe 4). Nie vorziehen.

**M2 · §1.5 Zeitdeckel „≤ 8“ passt nicht zur Pflicht `review`**
- **Problem:**
  - `deriveToday`/`pflichtFor` werten `review` als „erledigt“, wenn `goal.review` verschiedene `ctx:'rev'`-Karten beantwortet sind. Die Alternative `exhausted` liegt nur im Speicher und gilt nicht auf anderen Geräten.
  - `planRound` rechnet mit 600 s. Lernkarten (`LEARNING_MAX` 15) laufen außerhalb dieses Budgets.
  - Folge: Block 1 überzieht die 8 Min. Oder, wenn nach Zeit abgebrochen wird, bleibt der Zähler auf „1 von 5“ stehen (Kap. 15, Kap. 2.2).
- **Korrektur:**
  - `unitPlanFor` liefert das Block-1-Budget in Sekunden: Voll 480, Kurz 15–20 Min. 300, Tagesziel 10 180, Sonntag 300. Die Reparatur-Zeit geht davon ab.
  - `planRound` bekommt dieses Budget, Lernkarten liegen innerhalb davon.
  - `goal.review` = Reparatur + fällig + neu, fest im Tagesplan.
  - Block 1 endet bei `goal.review` (bestehende Regel), nicht nach Zeit. Der Deckel wirkt bei der Planung, er bricht nichts ab.
  - Ist `goal.review` = 0, entfällt Block 1. „x von n“ kommt immer aus `plan.duty.length`.

**M3 · §1.5 Kurz-Einheit und Tagesziel**
- **Problem:** Die Tagesziel-Optionen sind 10/15/20/25/30/40 (`GOAL_MIN_OPTIONS`).
  - Kurz = 5 + 10 + 3 = bis 18 Min. Das sind bei Tagesziel 10 fast doppelt so viele.
  - Bei 20 läuft die volle Einheit mit 27–30 Min.
  - Samstag in Kurz: Das Rollenspiel (10–15 Min.) passt nicht hinein.
- **Korrektur:**
  - Kurz-Einheit gilt bei Tagesziel ≤ **20**.
  - Minuten: Tagesziel 10 → Block 1 ≤ 3 · Block 3 ≤ 5 · Block 5 ≤ 2. Tagesziel 15–20 → 5 · 7 · 3.
  - Samstag in Kurz: Block 3 ist das Einwand-Training (Kurzform) statt des Rollenspiels. Sonntag bleibt unverändert.
  - Eine Tagesziel-Änderung wirkt ab dem nächsten Lerntag.

**M4 · §1.5 Rückfälle ohne KI unvollständig** (Paketkriterium „ohne KI erfüllbar“, N12)
- **a) Block 3 ist nicht „ungeprüft speicherbar“, wo es ohne KI kein Gegenüber gibt:** Rollenspiel (Sa), Generalprobe (`meeting`, Do), Drei Tonlagen (Mi, gerade Kalenderwochen), Preply-Vorbereitung und -Import. Alle hängen an der KI (`useRoleplay`, `MeetingScreen`, `TonesScreen`).
  - **Korrektur:** Ohne KI wird Sa/Do zum Einwand-Training (P7a, Selbstcheck + Musterantwort), Mi zum Posteingang, und Preply-Tage laufen nach dem normalen Wochenplan. Die Blockzahl bleibt gleich.
- **b) Block 4 „zeigt die Musterlösung“:** Muster gibt es nur für Posteingang und Einwände. `content/say/situations.ts` (Mo) und `content/fluency/questions.ts` (Di/Fr) haben keine.
  - **Korrektur:** Ohne KI sucht Block 4 mit `matchTrap` im eigenen Text. Bei Treffern folgt der Mini-Drill mit 3 Sätzen, der Grund kommt aus dem Fallen-Startsatz. Ohne Treffer kommen 3 fällige Fehler- oder Fallensätze der Woche. Die Musterlösung nur, wo es eine gibt.
- **c) Block 5 ohne KI:** Reparatur-Karten entstehen nur aus lokal belegten Korrekturen (Startsatz-Lösung), **nie aus ungeprüftem eigenem Text**. Sonst wiederholt FSRS möglicherweise falsche Sätze.
- **d) KI verzögert:** Behandeln wie ohne KI. Block 4 wartet nicht. Späte Korrekturen werden Reparatur-Karten für morgen.

**M5 · §1.5 `unitPlanFor(date, week, env, prefs)` + „einmal je Lerntag eingefroren“**
- **Problem:** Wird `env` beim Einfrieren gelesen, sperrt ein iPhone-Start, bei dem die Stimmen noch nicht geladen sind (`voiceschanged` kommt verzögert, A7), „Hören → Lesen“ für den ganzen Tag. Dasselbe passiert, wenn die KI-Zustimmung erst später kommt (Kap. 15, Kap. 2.2).
- **Korrektur:**
  - Eingefroren werden nur Wochentag-Form, Blockzahl, Minuten und `plan.duty`, alles ohne `env`.
  - Die Rückfälle entscheidet `start(ctx)` beim Blockstart: listen → read, Nachsprechen entfällt, ungeprüft speichern, Ersatz für Block 3.
  - Unit-Test: derselbe Tag mit `env` an/aus ergibt identisches `plan.duty`. `dutiesFeasible` ist für `u-*` nur wahr, weil M4 greift.

**M6 · §1.5 Block 4: fällige Grammatik-Fehler fallen aus der Pflicht** (Kap. 5: FSRS auch für Fehler)
- **Problem:** Bisher hat `dueErrors ≥ 3` den Pflichtkanal `gram` angehoben. Jetzt kommen Fehlersätze nur noch über den Rückfall von Block 4 (der nur ohne Korrekturen greift) oder als Extra unter Üben. Fällige Fehler stauen sich, und BKT bekommt kaum noch Belege.
- **Korrektur:** Block 4 füllt immer auf 3 Aufgaben auf: erst Korrekturen aus Block 3, dann fällige Fehlersätze (`dueErrors`). Vorrang hat dieselbe Falle bzw. dasselbe Grammatikthema wie die Korrektur.

**M7 · §1.5 Wochenplan Block 2: Quellen und Mischung Beruf/Alltag fehlen**
- **Problem:**
  - P7a liefert einen Themen-Text je Woche, mit festen 2 Fragen und 3 Nachsprech-Sätzen.
  - Mo/Fr Lesen und Di/Do Hören würden ohne Regel viermal denselben Text mit schon bekannten Antworten nutzen. Das ist Wiedererkennen statt Verstehen.
  - Block 2 ist immer „zum Wochenthema“. Damit sind 12 von 16 Wochen fast nur Beruf (Kap. 1: zwei Drittel/ein Drittel; Kap. 6.8: „Mischung automatisch ausgeglichen“; lehrer.md §2.2).
- **Korrektur, Quelle je Tag:**
  - Mo: Themen-Text (P7a).
  - Di: Hörtext zum Thema, von der KI während Block 1 erzeugt und gespeichert. Ohne KI: Themen-Text vorgelesen, Aufgabe „in 3 Sätzen zusammenfassen“.
  - Do: Dialog-Hörtext (KI). Ohne KI: ungelesener `feed/*`-Beitrag oder Text aus der Bibliothek.
  - Fr: in Berufswochen Alltags-Input (Feed-Beitrag Alltag oder gespeicherter Alltagstext). Das passt, weil Block 3 am Freitag die Frage A vom Dienstag wiederholt und keinen neuen Input braucht.
  - Ergebnis: Aufgaben etwa 72 % Beruf, Input etwa 60 %, zusammen etwa zwei Drittel.

**M8 · §1.5 Block 2 → 3: die kombinierte Aufgabe bricht** (Kap. 2.5, Lehrer-Lücke 1)
- **Problem:** `UnitCtx` (§4.10) trägt `sentences` für das Nachsprechen, aber nicht die in Block 2 gemerkten Wendungen. Block 3 kann sie also nicht zeigen, auch nicht auf einem zweiten Gerät.
- **Korrektur:**
  - Neues Feld `UnitCtx.phrases?: string[]` (von `input.*` an `task.*`).
  - Ersatz aus den Daten: Karten mit `src` read/listen von heute, sonst die 5 Wendungen der Woche.
  - Block 3 zeigt „Ziel: 2 deiner Wendungen · Werkzeug“ und zählt beim Tippen lokal mit (`detectTargets`).
  - Zuständig: WP0a bzw. der Integrator.

**M9 · §1.5 Blöcke 2 und 4: Pflichtfrage 4** (Kap. 2.4)
- **Problem:** In Block 4 („Hinweis → Versuch → Lösung“) fehlt der Grund. Ist der zweite Versuch richtig, erscheint weder Lösung noch Grund. Auch die Fragen in Block 2 haben keine Begründung.
- **Korrektur:**
  - Block 4: Nach jedem Versuch, richtig oder falsch, stehen Lösung und `Fix.why` (ein Satz, in der Oberflächensprache).
  - Block 2: Jede Verstehensfrage zeigt Belegstelle und Grund, auch bei richtiger Antwort.

**M10 · §1.5 Wochenthema „montags“**
- **Problem:** Ist der Montag Ruhetag oder die App wird nicht geöffnet, hat die Woche kein `app/week.cur`.
- **Korrektur:** Die Bestätigungskarte erscheint am ersten Lerntag der Kalenderwoche (Mo–So, 04:00). Bis zur Bestätigung gilt der Vorschlag aus `themeFor` (`by:'auto'`). `unitPlanFor` bekommt nie `theme: null`, solange Themen geladen sind.

### Sollte

**S1 · §1.5 Block 2 an Hör-Tagen über dem Deckel**
- **Problem:** Tempo-Leiter mit 2 Durchgängen à 1–2 Min., dazu Fragen, Wendungen und 3×3 Nachsprechen ergibt etwa 6–8 Min. statt 4–5.
- **Korrektur:** Hörtext in Block 2 60–75 s (etwa 150–180 Wörter). Nachsprechen mit 3 Sätzen und 0,9/1,0/1,1. Das ergibt etwa 5 Min.

**S2 · §1.5 Preply (N16)**
- **a) Tag der Stunde:**
  - **Problem:** Der Plan setzt Kurz-Einheit + 3 Min. (etwa 18–21 Min.), lehrer.md §2.2 sagt „nur Block 1 + 3 Min.“.
  - **Korrektur:** Block 1 (≤ 5 Min.) + `pron.shadow` mit Wendungen (3 Min.), also `['review','ch:u-in']`.
- **b) Kollisionen bei 2–4 Stunden je Woche:**
  - **Problem:** Es fehlt eine Regel, wenn sich die Preply-Tage überschneiden.
  - **Korrektur:** Tag der Stunde > Tag danach > Tag vor. An mindestens 3 Tagen je Woche gilt der normale Wochenplan-Output.
- **c) Tag danach:**
  - **Problem:** Der Import braucht eingefügten Text und die KI. Ohne Ausweg reißt die Serie.
  - **Korrektur:** Knopf „Nichts zu übernehmen“ bzw. ohne KI → normaler Input. Das ist **muss**, sobald N16 gebaut wird.

**S3 · Themen-Texte (P7a), i+1**
- ≤ 5 % unbekannte Wörter (Ziel 2–3 %, also 95–98 % Abdeckung).
- Mindestens 3 der 5 Wochenwendungen und das Werkzeug der Woche stehen im Text.
- Verstehensfragen dürfen Auswahlfragen sein (Verstehen, lokal prüfbar), mit Belegstelle und Grund in DE und EN.

**S4 · §1.5 Block 5: Vergleich unklar** (Pflichtfrage 3 für die Neufassung)
- **Problem:** Offen ist, welche zwei Fassungen nebeneinander stehen.
- **Korrektur:** Neufassung ↔ `task.better` (ohne KI: Muster bzw. Startsatz). Je Korrektur aus Block 4 wird lokal geprüft, ob sie jetzt richtig ist (enthält `fix.right`, nicht `fix.mine`). `why` bleibt sichtbar.

**S5 · §1.5 Sonntag**
- **Problem:** „Danach Ruhetag möglich“ widerspricht sich: Erledigt heißt, der Tag zählt. Und „Block 1 kurz“ ist nicht beziffert.
- **Korrektur:** „So: Block 1 (≤ 5 Min.) + Wochen-Check (5 Min.). Bleibt er offen, zählt er als Ruhetag der Woche, falls der noch frei ist.“ Ein verpasster Check erscheint am Montag als Extra-Zeile.

### §1.3 Hub „Üben“

**Ü1 (sollte):** „Aus deinen Fehlern“ steht als Abschnitt 4 ganz unten und ist der einzige Abschnitt mit fälligen Elementen (Kap. 5). Mit M6 ist das unkritisch, sonst gehört er direkt unter „Dein Weg“.

Sonst erfüllt: Kollokationen und Umformung werden nur getippt (Generierungseffekt), die Fallen mischen den Startsatz mit eigenen Sätzen (Verschachtelung), das Werkzeug der Woche ist 1 Tipp entfernt, die Lektion bleibt Angebot.

---

**Zuständigkeit:** Die Befunde gehen vor allem an `unitPlanFor` / `src/domain/week`. M8 geht zusätzlich an WP0a (`UnitCtx`), M4b/c, M6, M9 und S4 an P2 (Anbieter `focus`/`again`), S3 und M7 an P7a und P4.

**Relevante Dateien:**
- /home/user/lingo-engine-x/docs/neubau/plan.md (§1.3 Z. 140–151, §1.5 Z. 194–249, §4.10 Z. 1077–1134)
- /home/user/lingo-engine-x/docs/neubau/anki-regeln.md (§5)
- /home/user/lingo-engine-x/docs/neubau/lehrer.md (§2.1, §2.2)
- /home/user/lingo-engine-x/src/domain/plan/pflicht.ts (`pflichtFor`, `dutiesFeasible`)
- /home/user/lingo-engine-x/src/domain/plan/buildPlan.ts (`deriveToday`: `review` über `goal.review`)
- /home/user/lingo-engine-x/src/domain/srs/queue.ts (`planRound`: 600 s, `LEARNING_MAX` außerhalb des Budgets)
- /home/user/lingo-engine-x/src/domain/progress/settings.ts (`GOAL_MIN_OPTIONS` 10–40)
- /home/user/lingo-engine-x/src/content/say/situations.ts
- /home/user/lingo-engine-x/src/content/fluency/questions.ts