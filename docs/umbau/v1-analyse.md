# V1 „Varianz beim Befestigen“ – Analyse und Umsetzung (07.10.2026)

Anforderung (Emrah): Wörter, Wendungen und Muster sollen beim Wiederholen in wechselnden Abfrageformen und Sätzen vorkommen, nicht immer gleich.

## 1. Ursache (belegt)

Gemessen mit den 443 Karten des C1-Pakets (Stufe 1 bis 5, Handy und Tastatur) und mit einer 60-Tage-Simulation des echten Wahlwegs (`tests/unit/varietySim.test.ts`).

1. **Es gab pro Karte nur einen Satz.** Alle 443 Paket-Karten hatten genau einen Satz (`contextsOf` kannte nur Ursprungssatz plus Claude-Sätze `xEx`, und die kommen nur nach dem ersten Aufdecken und nur, wenn eigene Beispiele fehlen). Der Satz-Wechsel (`rotate.ts`, `reps % n`) lief dadurch fast nie. Gemessen in der Simulation (alter Code): 0 Karten ab Stufe 3 mit mindestens zwei Sätzen.
2. **Die Abfragearten je Stufe sind knapp.** Ab Stufe 3 bieten Karten oft nur zwei Arten an (Handy Stufe 5: nur `complete` und `cloze`; Stufe 4: `cloze` plus eine weitere bei 146 von 443 Karten). Es gab ein Lernplatz-Gleichgewicht, aber keine Familien-Vielfalt.
3. **„Nicht dieselbe Art wie zuletzt“ galt nur bei Gleichstand.** `chooseExercise` wählt die Art mit der schlechtesten Laplace-Quote; die zuletzt benutzte Art wurde nur bevorzugt gemieden, wenn zwei Arten innerhalb von 0,05 lagen. War eine Art klar die schwächste (z. B. nach einem Fehler), kam sie sofort wieder. Simulation (alter Code, 60 Tage, 60 Karten): **174 Mal (Handy) bzw. 124 Mal (Tastatur) dieselbe Art zweimal hintereinander bei derselben Karte.**
4. **Es gab keinen Satz-Verlauf.** `hist` trug nur Art und Note, nicht den Satz. Die Rotation war deshalb eine feste Rechnung (`reps`), kein „nicht zweimal derselbe“.
5. **Muster:** `grammar/<thema>.pats[muster]` kannte nur Zähler und Bits, keine Formen. Die Auswahl der Aufgabenart (`kindsFor`) hing nur an p und Gerät; bei Gleichstand der Vorliebe kam jedes Mal dieselbe erste Art.

## 2. Was gebaut wurde

| Teil | Wo | Wirkung |
|---|---|---|
| Verlauf je Karte | `src/domain/srs/variety.ts`, `applyReview.ts` (`hist[].s`), `AnswerEvent.sx`, `features/vocab/session.ts` | Jeder Verlaufseintrag trägt zusätzlich einen Kurzschlüssel des gezeigten Satzes (`s`, höchstens 8 Zeichen). `hist` bleibt auf 12 Einträge begrenzt, nichts wird gelöscht, alte Einträge ohne `s` bleiben gültig. |
| Art nie zweimal in Folge | `modes.ts` `chooseExercise` | Die Art der letzten Antwort dieser Karte wird ausgeschlossen, solange es eine andere gibt. Dazu ein Aufschlag auf die Rangzahl: gleiche Formenfamilie wie zuletzt +0,08; Art unter den letzten 4 Formen +0,1. |
| Formenfamilien | `variety.ts` `familyOf` | Erkennen (`mc_en`, `ctx_mc`, `listen_mc`), Zuordnen (`mc_de`, `match`), Lücke mit Stütze (`cloze_hint`, `tiles`), freie Lücke (`cloze`), Wortpartner (`colloc`, `colloc_gap`), `complete`, `wordfam`, `find_trap`, `dictation`, `produce` … |
| Satz nie zweimal in Folge | `rotate.ts` `rotatedContext` (`leastRecent`) | Der am längsten nicht gezeigte Satz kommt zuerst, der zuletzt gezeigte nie, solange es einen anderen gibt. Ohne Satz-Verlauf beginnt es mit dem Ursprungssatz. `wordfam` wechselt den Satz jetzt auch. |
| Mehr Sätze (ohne neue Inhalte) | `rotate.ts` `contextsOf`, `crossLink.ts`, `packFields.ts` `packSentences` | Zusätzliche Quellen für den Satzwechsel: Sätze der Wortpartner (`col[].ex`), feste, geprüfte Sätze aus c1x-Aufgaben (mcc, ocl, err ohne Fehler, kwt-Ausgangssatz; Treffer genau über `lex[]` oder ab 5 Buchstaben im Satz), dem Satzbau-Pool (57 Sätze) und den Beispielsätzen des C1-Pakets. Die Stelle im Satz wird wie bei `xEx` geprüft (`findContext`/`chunkContext`); ohne saubere Stelle wird der Satz nicht benutzt. Von 443 Paket-Karten haben jetzt 217 mindestens zwei Sätze (vorher 0), davon 148 mit drei oder mehr, ohne dass c1x geladen ist. |
| Vorbereitung auf „Fest“ | `modes.ts`, `variety.ts` `FEST_MIN_FORMS = 3` | Ab Stufe 4 mit weniger als drei Formenfamilien im Verlauf: neue Familien bekommen einen Vorsprung (−0,15) und, wenn die Stufe zu wenige Familien anbietet, kommen Arten der Nachbarstufe dazu (erst höher, bei Stufe 5 darunter). Das ist nur die Auswahl. |
| Muster | `metrics/pattern.ts` (`pats[muster].f`, höchstens 4 Formen, kommagetrennt), `grammar/write.ts`, `c1x/select.ts` `varyKinds`/`kindsFor(…, recent)`, `grammar/tasks.ts` | Pro Muster werden die letzten Formen gemerkt; bei der Auswahl rückt die zuletzt benutzte Art innerhalb der Stufenliste ans Ende, und innerhalb einer Runde zählt auch, was in dieser Runde schon für das Muster kam. Keine zusätzlichen Arten, die Stufenwahl bleibt. |
| Dublettenwächter | `tests/unit/dupGuard.test.ts` | Über c1x (mcc/ocl/err/kwt inkl. LP2-Adapter), Satzbau-Pool und C1-Paket: kein Satz wörtlich doppelt, keine zwei Sätze verschiedener Arten mit ≥ 80 % Überlappung der Inhaltswörter. |
| Simulation | `tests/unit/varietySim.test.ts` | 60 Tage, 60 Karten, Handy und Tastatur, mit echtem Wahlweg und echtem Schreibweg. |

## 3. Zählung, Plan, Pflicht

Unberührt: Pflicht, Serie, Tagesplan, Zähler, Note, Gewicht (`weight.ts`), Stufenregeln (`nextStage`), die Definition von „Fest“ (`isFestValues`) und die Kartenbuchung der c1x-Aufgaben (`lexBook`). Neu geschrieben werden nur kleine, rein ergänzende Felder: `hist[].s` (Karten und Wendungen) und `pats[muster].f`. Beide werden von älteren Lesern ignoriert (Loose-Schemas, `readPatEntry` nimmt `f` nur an, wenn es dem Muster `art,art` entspricht).

Größe (A6.6): `hist` höchstens 12 Einträge × zusätzlich ≤ 11 Zeichen (Test: Verlauf einer Karte unter 1,2 KB); `pats` höchstens 12 Muster × ≤ 23 Zeichen.

## 4. Mindestanzahl verschiedener Formen vor „Fest“

Nicht als harte Regel umgesetzt: „Fest“ ist die eine, zentrale Definition (`metrics/definitions`, Stufe ≥ 4 und Stabilität ≥ 21 Tage) und steht in Fortschritt, `ff` und Heute. Eine zusätzliche Bedingung würde Zahlen verschieben. Stattdessen sorgt die Auswahl dafür, dass eine Karte vor „Fest“ mindestens drei Formenfamilien gesehen hat, soweit sie so viele anbietet. Die Simulation prüft das für jede Karte, die in den 60 Tagen „Fest“ wurde (Handy und Tastatur). Eine harte Regel wäre ein eigener Beschluss von Emrah.

## 5. Offen / Grenzen

- Karten mit nur einem Satz (226 von 443 Paket-Karten, vor dem Laden der c1x-Aufgaben) behalten den einen Satz; für sie kommt weiter Claude nach dem Aufdecken (bestehende Anreicherung). Variation entsteht dort nur über die Formen.
- Erkennen auf Stufe 1 und 2 bleibt bewusst im Ursprungssatz.
- Die c1x-Sätze sind nur dann dabei, wenn die Art vorgeladen ist (`mcc`, `ocl`, `err`, `kwt` sind eingeschaltet).
- Aufgaben der alten Grammatik (LP2-Weg `fresh`/`wantTypes`) und Wiederholungs-Fehlersätze (`repeat.ts`, wählt schon eine andere Art) wurden nicht verändert; die Musterfolge gilt für den `slotPlan`-Weg (Schalter `slots`, aktuell aus).
- Der Dublettenwächter fand drei fast gleiche Sätze zwischen dem Umformen-/Fehler-Bestand und dem Satzbau-Pool (Inversion, Höflichkeitsformeln). Sie stehen mit Grund im Test; ändern kann sie nur der Englischlehrer.
- iPhone/Safari wurde nicht geprüft; die Änderung ist reine Logik ohne Oberfläche.
