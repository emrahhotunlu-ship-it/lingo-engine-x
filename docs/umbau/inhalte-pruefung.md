# Inhalte-Prüfung Lernplattform 2.0 · P2 Stufe 1 (Pilot)

Stand 06.10.2026 · Branch `claude/umbau-fokus` · Pilotthemen `past-simple-perfect`, `mixed-cond`, `time-clauses`, `cond-alt`. Plan: `lernplattform-2.md` §3.8 (Prüfkette) und §10.4 P2. Dieses Protokoll gilt für Stufe 1; Stufe 2 (35 Themen) ergänzt es chargenweise.

## 1 Was geliefert wurde

| | Menge |
|---|---|
| Muster (Musterdateien `src/content/grammar/patterns/<thema>.json`) | 20 (psp 4 · mc 6 · tc 4 · ca 6) |
| Zuordnung vorhandener Aufgaben (`pattern-map.json`) | 66 von 66 = 100 % (20 + 20 + 13 + 13), jede mit `why.ok` und `why.wrong` |
| Neue Aufgaben (`tasks-v2.json`) | 109: 41 Schlüsselwort (`kwt`), 47 Fehler finden (`find`, davon 11 fehlerfrei = 23 %), 21 Bedeutungspaare (`meaning`); je Muster ≥ 2 kwt, ≥ 2 find, ≥ 1 meaning |
| Satzbau-Sätze mit `pat` (`c1/order.json`) | 24 (je Thema 6), davon 21 mit `trap` |
| Pfad (`path.json`) | 7 Kapitel = die 39 Themen von `GRAMMAR_PATH`, 6 Kontrastfamilien |
| Stillgelegt (`retired.json`) | 5 Fallen (siehe §4) |
| Umfang der neuen Inhalte | 239 KB (Grenze 450 KB); siehe §7 zur Hochrechnung für Stufe 2 |

Die Inhalte entstehen aus Teilen unter `scripts/grammar/parts/<thema>/{map,v2,order}.json` (`npm run grammar:build`); geprüft werden sie mit `npm run grammar:check` (gleiche Regeln wie `tests/unit/grammarContent.test.ts`).

## 2 Prüfkette

1. **Automatisch** (`scripts/grammar/validate.mjs`, jede Zeile ein Unit-Test): zod-Schema; jede Aufgabe zugeordnet, jede Kennung (`pat`, `contrast.with`, `why.pat`, `dup`) existiert; `introPlan`/`order` enthalten jedes Muster genau einmal; US-Schreibweise und keine geraden Anführungszeichen; `why`-Texte ≤ 100 Zeichen; deutsch/englisch nicht vertauscht; `opt`-Regeln nur auf wirklich falsche Optionen, jede falsche Option einer Auswahlaufgabe hat eine Regel; kwt: genau eine Lücke, Schlüsselwort steht nicht im Rahmen, aber in jeder Lösung, 2–5 Wörter, Wortzahl stimmt; find: Bereich ≤ 4 Wörter, `fixed` ist exakt der Zusammenbau aus Satz, Bereich und Ersatz, etwa ein Viertel ohne Fehler; Satzbau: Bausteine gehen im Satz und in jeder `alt`-Fassung genau auf, genau eines von `alt`/`single`; Aufgabenschlüssel je Thema über Startaufgaben, Fallen und `tasks-v2` eindeutig; kein neuer Satz wörtlich aus einer vorhandenen Aufgabe.
2. **Englischlehrer, 100 % statt 20 %** (Agent `english-teacher`, je Thema ein Durchgang über alle Muster, alle Zuordnungen, alle neuen Aufgaben und alle Satzbau-Sätze: 53 + 62 + 45 + 59 = 219 Einträge). Fachliche Eindeutigkeit der Lösungen, fehlende Varianten, Stimmigkeit der Begründungen und der behaupteten deutschen Ursachen.
3. **Nachprüfung** der geänderten Stellen (einmal, A2) – Ergebnis in §3.
4. **Lernwissenschaft** (Pflichtfragen, Erklär-Karte, `explain-answer@1`, Fehlerschlange, neue Aufgabenarten) und **data-guard** (Fehler-Datenhaltung) – Ergebnisse in §5 und §6.

## 3 Befunde des Englischlehrers und was daraus wurde

Zahlen der ersten Prüfung (unauffällig / geprüft): past-simple-perfect 36 / 53 · mixed-cond 48 / 62 · time-clauses 19 / 45 · cond-alt 35 / 59. Es gab **keinen** Fall einer falschen Lösung in den vorhandenen Aufgaben; die Funde betrafen neue Aufgaben, fehlende Varianten und zwei schiefe Ursachen.

| Art | Beispiele | Behandlung |
|---|---|---|
| **H – Aufgabe nicht eindeutig fehlerhaft** | psp.find6 („have gone to … three times“), mc.find8 (Gewohnheit lesbar), tc.nc-find2 („when the budget gets approved“ als Fahrplan lesbar), kwt11 (Meinung „time“ ohne high sei falsch) | Satz ersetzt bzw. mit Zeitanker versehen (`last week`, `predict … next quarter`); Falle `have been/gone to` auf den echten Unterschied umgestellt; kwt11 akzeptiert about/past time, Ausgangssatz „long overdue“; falsch klingende Rückmeldung entschärft |
| **H – Muster- und Satzbau-Fehler** | Satzbau „otherwise, we can't start“ mit falschem `single` (Umstellung „… can't start otherwise“ ist gültig); mc-Satz „I wish our CRM were faster during peak hours“ ebenso; vertauschte Texte bei tc.pp-m1 | `single` → `alt`; Texte korrigiert |
| **M – fehlende Varianten** | z. B. „would have gotten“, „by the time you arrive/come“, „only as long as you“, „Had we been told“, „just in case“, „wraps up / is done“ | in `accepted` ergänzt (neue Aufgaben) bzw. in den Quelldateien der vorhandenen Aufgaben ergänzt (`grammar-bank.json`, `c1/toolkit.json`, `legacy/grammar.json`: 9 Aufgaben, nur `accepted`/Erklärung, nie der Satz). Varianten mit 6 Wörtern bleiben draußen (Cambridge-Grenze 2–5) |
| **M – deutsche Ursache nicht belegt** | „Deutsch sagt Perfekt, daher …“ bei until/after + has signed off; „hätten … abgesagt“ bei but for | Ursachen als „Perfekt wird automatisch mit Vergangenheit übersetzt“ bzw. „das have wird weggelassen“ neu formuliert; Reflex „Zukunft = will“ bleibt ausdrücklich keine Übersetzung |
| **M – britisch** | „tender“ → „bid“, „film“ | ersetzt |
| **N – Stil** | Leitfragen (`nudge`), die fast die Lösung nennen; Wiederholung derselben Sätze in Muster und Aufgaben | `nudge` neutraler; Wiederholungen bleiben (dokumentiert) |

Offene Punkte aus der ersten Prüfung, die bewusst **nicht** geändert wurden: ein paar Varianten bei den Aufgaben, die direkt aus Fallen (`rules.json#traps`) entstehen, weil diese Aufgaben kein `accepted` kennen (siehe §4); die zwei Beinahe-Doppel (`dup` gesetzt bei mixed-cond und time-clauses).

Nachprüfung der geänderten Stellen (eine Runde): siehe §8.

## 4 Fallen: alle einmal geprüft (§3.9)

Alle 71 Fallen (`traps` in `rules.json` und `toolkit.json`) hat der Englischlehrer geprüft. 35 von 70 unauffällig (die 71. war die wish-Falle, schon entfernt).

**Stillgelegt** (Satz bleibt in der Datenbank, wird nur beim Lesen ausgeblendet, `retired.json`):
1. `I wish you didn't interrupt me all the time.` – richtiges Englisch (§3.9); wird Kontrastpaar in `mc.wish-would`. Dazu „behaviour“ → „behavior“ (mit der Falle entfernt).
2. `The window had broken during the storm.` – intransitives *break*, richtig.
3. `He told me that he already sent the contract.` – im US-Englisch normal.
4. `She told me that she will finish it next week.` – richtig, solange die Zukunft aussteht.
5. `I love the music, especially the jazz.` – ohne Kontext nicht falsch.

**Text korrigiert:** Falle 66 (`suggested to meet`): „suggest ist immer -ing“ war falsch → „-ing oder that-Satz, nie to + Grundform“.

**Offen für Emrah / Stufe 2** (Priorität H/M des Englischlehrers, nicht still geändert): 26 (*solution of this problem*: „for“ wird abgelehnt, „of“ als falsch zu hart), 60 (*was broken* ohne Kontext möglich; „burglarized“ fehlt), 15 (*admitted to being late* und *that*-Satz fehlen), 48 (*going to* fehlt), 31 (*modern small office* kein klarer Fehler), 65, 2, 10, 14, 19, 22/23, 27, 35–37, 45, 49/50, 17 (weitere richtige Fassungen fehlen). Ursache: Aufgaben aus Fallen haben kein `accepted`. **Vorschlag für Stufe 2:** `traps[].accepted` im Regelblatt zulassen (additiv, `seedTasks` reicht es durch). Als Duplikate/zu leicht gemeldet: 20/33/67 (dreimal *look forward to + -ing*, 33 im falschen Thema), 38, 44, 51.

## 5 Lernwissenschaft (Pflichtfragen, Kap. 5)

Urteil: Erklär-Karte und `explain-answer@1` erfüllt, Fehlerschlange und neue Aufgabenarten „mit Nachbesserung“. Stichprobe: mixed-cond vollständig, die übrigen nach Zählung.

Eingearbeitet: Kommentar zu `more` ehrlich („ältester Zusatzsatz wird verdrängt“); kwt11 bestraft kein richtiges Englisch mehr; `introPlan` mixed-cond nach Kontrastpaaren (past-cond + present-cond, wish-now + wish-past, wish-would + high-time).

Offen, bewusst nicht in Stufe 1 (Verbraucher liegen in anderen Paketen):
- **H3** `errorTask` stellt weiter den alten Satz; die Varianten aus `more` nutzt P8 (`variant.ts`, §5.7).
- **H2** Rückfall auf Box 0 beim Zusammenführen ist die Regel des Plans; ob ein Muster mit vielen Fehlern nie über Box 1 kommt, zeigt `errorQueueSim` (P4).
- **M1** keine „Was hatte ich“-Zeile bei *fast richtig*; **M4** alle 6 Bedeutungspaare in mixed-cond haben `answer: "a"` – P5 muss die Seiten beim Anzeigen mischen (Seed je Aufgabe) und Stufe 2 ausgleichen; **M5** Schlüsselwörter nennen teils das Verb; **M7** `explain-answer@1` nur mit bekanntem Muster anbieten und `pattern.use` als Quelle mitgeben; **M8** `rh` hat noch keinen Verbraucher (z. B. Mini-Lektion nach 2× falsch); **M9** der Deckel von 10 Fehlereinträgen zählt stillgelegte mit.

## 6 data-guard (Fehler-Datenhaltung)

Kein Alarm. Bestätigt: nichts wird gelöscht, nur ergänzende Felder (`pat` ≤ 40 Zeichen, `more` ≤ 3, `rh` ≤ 6), schreibende Pfade bleiben bei `errorsOf`, `liveErrorsOf` filtert nur beim Lesen, Einträge ohne `pat` verhalten sich wie bisher (nur „falsch = eine Box zurück“), Rückweg zur Live-Version ohne Formatbruch. Eingearbeitet: `q`/`ans` in `more` auf 300 Zeichen gekürzt.

**Pflicht vor dem Zusammenführen (P4-Nachtrag, nicht in P2):** `liveErrorsOf` ist bisher nur in `dueErrors` eingebaut. Die übrigen Leser benutzen noch `errorsOf` und zählen einen stillgelegten offenen Fehlersatz weiter mit (Bremse und „Thema fertig“): `domain/grammar/path.ts:103` und `:151`, `domain/metrics/grammar.ts:76`, `domain/plan/dayStats.ts:43`, `features/grammar/GrammarScreen.tsx:103`, `features/grammar/generate.ts:36`, `features/progress/assessRun.ts:180`, `features/apply/ComboSentence.tsx:51`. Außerdem übergibt `write.ts:77` noch kein `pat` an `addError` (P5), `pat`/`more`/`rh` stehen noch nicht in `data/schemas.ts` (laufen durch `looseObject`, zulässig).

## 7 Zahlen für die Planung von Stufe 2

- **Arbeitsvorrat:** 35 Themen ohne Musterdatei mit 551 vorhandenen Aufgaben (`node scripts/grammar/map-patterns.mjs`), zusammen mit den 67 des Piloten die ca. 640 aus dem Plan.
- **Signalwort-Zuordnung** (Skript und `patternOf` für Pool-/Tagesaufgaben): Abdeckung auf dem schon Zugeordneten cond-alt 85 %, past-simple-perfect 85 %, mixed-cond 25 %, time-clauses 8 %; **Treffsicherheit 100 %** (kein einziger falscher Treffer). Die Planannahme „75–80 % per Skript“ gilt nur für Themen mit deutlichen Signalwörtern; bei Formthemen (wish, Zeitsätze) muss der Rest von Hand/Claude zugeordnet werden.
- **Dateigröße:** Der Pilot braucht 239 KB für 4 Themen, davon 111 KB `tasks-v2.json` (1 KB je neue Aufgabe) und 63 KB `pattern-map.json`. Dasselbe Verfahren für 35 Themen ergäbe über 1 MB und überschritte die Grenze von 450 KB. Für Stufe 2 gilt deshalb: je Muster höchstens 1 find + 1 kwt (so schon im Plan), `why`-Texte nicht länger als im Pilot, und der Grenzwert ist mit Emrah/Koordination neu zu klären (Vorschlag: 1,2 MB, lazy geparst; der Build liegt bei 4,6 MB).
- **Fehlersatz-Bereiche:** Von 143 Satzkorrektur-Aufgaben haben 120 genau einen Bereich ≤ 4 Wörter (84 %), 18 weitere zwei bis drei Bereiche (`errorSpans`); zusammen 138 von 143 (97 %).
- **Fehlerfreie find-Aufgaben:** 11 von 47 (23 %).
- **Erklär-Karte:** Bei Tiefe `full` höchstens 45 sichtbare Wörter (Muster-Name + Formel + „Deine Antwort“ + „Warum“ + ein Beispiel) für alle 67 Pilotaufgaben in beiden Sprachen (Unit-Test `grammarExplain`). Dafür wurden `name` und `form` aller Muster auf höchstens 6 Wörter gekürzt, und das kürzeste Beispiel steht zuerst.

## 8 Nachprüfung (eine Runde, A2)

Der Englischlehrer hat die geänderten Stellen noch einmal gelesen: **kein H-Fund**, Lösungen, Fehlerstellen (`err`), Erklärungen und US-Schreibweise stimmen; Namen und Formeln aller 20 Muster sind höchstens 6 Wörter lang und fachlich richtig (17 von 20 ohne Anmerkung). Die M/N-Funde sind eingearbeitet:

- kwt11 (high time): „finally time“, „really time“ ergänzt; Ausgangssatz „long overdue“.
- Satzbau: „I'll send …“ und „I don't know …“ mit großem I; cond-alt Satz 4 (but for): Ursache in DE und EN gleich erzählt.
- Formulierungen: „will is never used after wish“ statt „will never follows wish“; `mc.present-cond` „result earlier“ statt „result then“; `psp.result-now` nennt already; `ca.unless` „no extra not“.
- Weitere gültige Varianten ergänzt (kwt2/3/4, pff-kwt2, pp-kwt2, oth-k2, inv-k2, inc-k1, unl-k1), soweit sie in Cambridge-Grenzen (2–5 Wörter, Schlüsselwort enthalten) passen. **Nicht** aufgenommen, weil sie die Regeln verletzen: Kontraktionen ohne das Schlüsselwort (*would've won*, *'d have*), Lösungen mit 6 Wörtern.
- tc.nc-find2 / ca-inc-f2: Erklärung nennt „üblicherweise“ bzw. den US-Alltagsgebrauch von *in case* (Muster `ca.in-case`).

Damit ist die Prüfrunde nach A2 abgeschlossen; weitere Funde gehen als Befund mit Vorschlag an Emrah.

## 9 Technische Prüfung

Typprüfung und ESLint sauber; Unit-Tests 1625 (neue Dateien: `grammarContent`, `grammarPatterns`, `grammarExplain`, `errorSpan`, `errorsQueue`, `errorsExpl`, `explainAnswer`); betroffene E2E (`grammar`, `hint`, `repair`, `drills`, `lernen`, `patterns`, `training`, `today-duties`, `uxRules`, `stand-gaps`, `rueckstand`) siehe `stand.md`. `npm run pron` neu erzeugt.
