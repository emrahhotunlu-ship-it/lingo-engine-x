# G0 – Bestandsaufnahme Grammatik + Wiederholen (Faktenbasis für Großpaket G)

Stand 02.11.2026, Branch `claude/umbau-fokus`, live `JLL8…` v89 `1793658052-a404`. Nur gelesen, nichts geändert.
Anlass: Emrah (02.11.): Grammatik- und Wiederholen-Übungen „hatten sehr oft Fehler … sollte überarbeitet werden“ (`docs/umbau/kompass.md:31`).
Vorbild ist die Wörter-App `src/modules/vocab` (live seit v87/v88).
Belege stehen als Datei:Zeile. Die Punkte M/K/LS kommen aus den Prüfberichten vom 02.11. (ux-reviewer, learning-scientist, english-teacher) und sind hier verkürzt wiedergegeben. In keinem Repo-Dokument stehen sie ausführlich, nur als Liste in `docs/umbau/stand.md:868`.

---

## 1. Was „Grammatik“ und „Wiederholen“ heute sind

### 1.1 Einbettung im Tagesweg (prefs.tw===1)
- `tagesweg()` steht in `src/domain/unit/planFor.ts:166-198`. Es gibt drei Schritte:
  - Wörter (`review`)
  - **Grammatik `ch:u-focus`** mit `args {errs: mixedErrorsFor(fixDue) ≤3}` und `n = grammarTasksFor(min)`
  - Anwenden (`task.apply`, sonntags `ch:u-check`)
- Der alte Plan steht noch daneben (`planFor.ts:94-164`, Kanäle `:60-66`).
- „Fehler korrigieren“ (`ch:u-again`, Block 5) ist **nur noch freiwillig**.
- Minutenaufteilung in `src/domain/plan/dayMinutes.ts`:
  - Wörter max(10, 40 %)
  - Grammatik 65 % vom Rest, mindestens 3
  - Anwenden bekommt den Rest, mindestens 2
- Weiterleitung in `src/features/unit/run.ts:101-126`: Block 2 geht an `grammarSession` (duty), Block 5 an `unitAgain`.
- Routen in `src/areas/lernen.tsx`:
  - `learn` (LearnHub + HubSections), `grammar` (GrammarScreen), `chapter`, `journey`, `wissen`, `patterns`
  - `grammarSession`, `drill`, `unitFocus` (FocusScreen), `unitAgain` (AgainScreen)
- Der Grammatik-Reiter beginnt mit „Test starten“ (`src/features/c1/chapterRun.ts:37`, `chapterBtnKey :43`). Darunter steht eine zweite Liste „Alle 47 Themen“ (`LearnHub.tsx:105-106`).
- Fehlersätze erscheinen an zwei Stellen: `LearnHub.tsx:71` (vgErrorsAll) und `ApplyHub.tsx:166` (hxApplyMoreFix).

### 1.2 Grammatik-Runde
- Start in `src/features/grammar/session.ts` (`startGrammar`). Modi: `duty`, `xtra`, `errors`, `topic`. Zustand: intro/test/prep/fixed/displaced, `reported` bei `:258`.
- Auswahl in `src/domain/grammar/tasks.ts:490-686` (`selectRound`), Reihenfolge:
  1. fällige Fehler (ERRORS_PER_ROUND 3)
  2. Themen (rankTopics, Fokus, Einführung, Familie)
  3. Einführungsblock (INTRO_TASKS 4, Vortest)
  4. slotPlan mit c1x (`pickUnseen`/`kindsFor`)
  5. LP2-Ersatz mit `wantTypes` nach Meisterschaft p (`:216`)
  6. Verschränken (Interleaving)
- Aufgabenarten: `GrammarTaskType` = mc, gap, transform, correct, meaning, find, kwt (`src/domain/learn/types.ts:16-65`).
  - c1x-Arten: kwt, err, mcc, ocl, wf (`useC1Item`, `kinds/*.tsx`).
  - `TaskSrc` = seed, daily, pool, lesson, ai, review.
- Inhaltsquellen:
  - Seed: `seedTasks` und `allSeedTasks` in `tasks.ts:161-211`
  - LP2: `tasks-v2`
  - c1x-Bank
  - KI-Pool `app/pool`, aufgenommen über `acceptGrammarItem` + `solve-check@1`
- Bildschirmgrößen in Zeilen:

  | Bildschirm | Zeilen |
  |---|---|
  | GrammarItem.tsx | 1.258 |
  | ExerciseShell | 767 |
  | SessionScreen | 361 |
  | GrammarScreen | 319 |
  | IntroFlow | 300 |
  | RepairItem | 295 |
  | FkItem | 258 |

### 1.3 Auswertung (Bewertungslogik)
- `src/domain/grammar/check.ts` enthält `checkGrammar`, `checkKwt`, `checkFind`, `checkMeaning`, `altFamily` und `closeVariant`.
- `judge()` steht in `src/domain/tutor/judge.ts:131`. Ergebnisse: wrong, unsure, alt_ok.
  - Claude wird **automatisch nur bei „unsure“** gefragt (`judge.ts:163-166`).
- Zweitmeinung `grammar-fit@1` gibt es nur für gap/transform **mit Muster** (`fitAskable`, `check.ts:291`).
  - Code in `src/features/grammar/fit.ts`, gemeinsames Tagesbudget 20 (`src/ai/tutorBudget.ts`).
- c1x wird mit `scoreC1` bewertet (`src/domain/c1x/score.ts`).
- Weitere Bausteine:
  - „Auch richtig“ (Q0)
  - `lintTask` (Befunde ambiguous, no_goal, gap_whole, no_verb, no_source, foreign_signal)
  - Validator `scripts/grammar/validate.mjs` (`grammar:check`)
  - Spieler-Test `tests/unit/taskPlayer.test.ts`, der jede Aufgabe einmal löst

### 1.4 Wiederholen (Fehlersätze, Fehler korrigieren)
- `fehlersaetze.ts` führt zwei Quellen zusammen:
  - `app/repair`: eigene Sätze aus Anwenden, Boxen 1/3/9
  - `grammar/<topic>.errors`
- Dazu gehören:
  - `quality.ts`: Ausschlussregeln
  - `gate.ts`: Eingangswächter (`held`)
  - `variant.ts`: ab Box 1 eine Variantenaufgabe zum selben Muster
- `fk.ts` hat zwei Formen:
  - B1 „Sag es richtig“: `src/content/fk/b1.json`, 60 Aufgaben
  - B2 „Welche Fassung“: `b2.json`, 16 Aufgaben
- Bildschirme: AgainScreen, RepairItem, FkItem.

---

## 2. Fehlerquellen und Unfairness

### 2.1 Ausmaß
Stichprobe „James“ (`docs/relaunch/ux-neuanfang.md`):
- 11 von 78 Aufgaben (14 %) haben Befunde, 4 von 78 (5 %) harte Fehler.
- Das ist etwa **eine kaputte Aufgabe pro Tag**.

### 2.2 Fehlerklassen A–G (ux-neuanfang.md) mit Beispielen
- **Richtige Antwort abgelehnt:** „studied“ in `src/content/legacy/grammar.json:381-386`. Laut english-teacher am 02.11. weiterhin offen.
- **Erklärung passt nicht:** ocl-0003, `c1x/src/ocl/k2-1.json:123-139`.
- **Hinweis = Lösung:** `legacy/grammar.json:328`.
- **kwt mit mehreren gültigen Fassungen:** kwt-0008/0001/0018/0006/0013.
- **Konstruierte Fehler:** err-0057/0107/0085/0021/0024 (`stand.md:127-148`).
- **Vergleich „far ___ lower“ widersprüchlich.**
- **Fallen in `rules.json` ohne `accepted`:** „I'm going to meet“, „until Friday“, will/going-Familie. Außerdem: kwt auf 5 Wörter begrenzt, `legacyNorm` kann „'d“ nicht (`stand.md:203`).
- **Apostrophe in `patterns/*.json`**, Backlog LS2/LS8/LS9/LS11 (`stand.md:523`).

### 2.3 Ursachen (ux-neuanfang.md)
- Antwortlisten wurden aus dem Gedächtnis geschrieben.
- Niemand löst die Aufgaben blind.
- Die Zweitmeinung deckt nur Musterlücken ab (`check.ts:291`).

### 2.4 Erklärungen (english-teacher 02.11.)
- `explainAnswerV2.ts:122` fordert ein Signalwort auch bei Wortfehlern.
- Britische Formen fehlen in `explainAnswerV2.ts:106/126`. `grammarFit.ts:119` sagt nur „American English“.
- Kürzung bei 160 Zeichen gegen 25 Wörter (`explainAnswerV2.ts:74-75, 123`).
- „Richtig, weil“ steht doppelt (p26 `ttXWhy` und `exLineWhy`).
- Die automatische Erklärung kommt auch bei leerer Antwort.
- Der Text zum Grammatik-Schritt ist falsch (`nbHeute.de.ts:39`).
- Ohne Musterdatei gibt es keine Warum-Zeile (`explain.ts:80`).
- Die Fehlersatz-Karte hat nach einer Box keine Vertiefung und keine Hinweisleiter (`RepairItem.tsx:235`).

### 2.5 Emrahs offene Einzelfälle (`docs/umbau/feedback-sammlung.md`)
- `:20` „Walking to work“: Fehler finden ist zu schwer.
- `:32` „just announced“: Die Erklärung lobt eine andere Form als seine.
- `:34` „Have our figures … recovered?“: Grammatik und Tippfehler gemischt, Erklärung abgeschnitten.
- Offene Muster 1–6 (`:38-43`): Qualitätstor, Erklärung zur eigenen Antwort, Eindeutigkeit, ein Fehler je Fehlersatz, Hierarchie, Testorganisation.

### 2.6 Melden heute
- Grammatik: `GrammarItem.tsx:1195` ruft `reportTask('gr:'+key)` auf (`src/features/tutor/reportTask.ts:1-29`, `src/domain/c1/report.ts`).
  - Die Meldung landet in **`app/c1.bad`**, einem Ringpuffer (TASK_REPORTS_MAX 100, bad ≤300, app/c1 ≤30 KB).
- Wirkung: Die Aufgabe wird nur ausgeschlossen (`isReportedTask`, `tasks.ts:396`; c1x `select.ts:57`). LS6 „gemeldete kommen wieder“ ist damit wohl behoben.
- **Darüber hinaus wird die Meldung nicht verwertet.** Niemand liest sie aus, die E8-Lehrer-Routine ist offen.
- Das Seed hat **keine** Melde-Daten (kein `app/c1`, kein `app/repair`).
- LS7: Melden löscht die falsche Antwort spurlos (`persist.ts:269`, `session.ts:491-506`, `GrammarItem.tsx:1185`, `useC1Item.ts:607`). Eine verdächtige Aufgabe zählt im Test trotzdem.
- Vorschlag aus LS7:
  - Status „geparkt“
  - Melderate in der Diagnose
  - Anzeige „n von m gewertet“
- `useC1Item.ts:598`: Laut ux-neuanfang.md wirkte der Melde-Knopf früher nicht. Mit UX-Neuanfang D gibt es jetzt den Weg über „…“.
- Zum Vergleich die Wörter-App: „Aufgabe war unfair“ (`src/modules/vocab/ui/learnRun.ts:868-880`).
  - Die Abfrage zählt nicht und wird mit `FLAG.unfair` im Verlauf und in der Diagnose festgehalten.

---

## 3. Zurückgestellte UX-Punkte, die zu G gehören (`stand.md:868`)

| # | Befund (Prüfbericht 02.11.) | Beleg |
|---|---|---|
| M10 | Rechte Spalte am Laptop ist leer | `src/app/shell/ContextHost.tsx:107` (shContextEmpty) |
| M11 | KPI-Karten „Kapitelstand“ und „Wörter fest“ konkurrieren unter dem Hauptknopf; Wochenrückblick steht zwischen Knopf und freiwilligem Bereich | Heute/Lernen |
| M12 | Grammatik-Reiter beginnt mit „Test starten“; zweite Themenliste „Alle 47 Themen“; Fehlersätze an zwei Orten | `chapterRun.ts:37,43`, `LearnHub.tsx:71,105-106`, `ApplyHub.tsx:166` |
| M14 | Melden nur über „…“; „Melden“ in der Claude-Karte bedeutet etwas anderes; Melde-Blatt am Handy voll hoch mit ~75 % Leerraum | GrammarItem/ExerciseShell |
| M15 | Antippbare Wörter kleiner als 44 px („a“ 11×27, „of“ 22×38, „out“ 24×25) | Satzanzeige |
| K1 | Freiwilliger Bereich wiederholt „Extra/Freiwillig“ | LearnHub |
| K3 | Serie in drei Formulierungen; „1 von 6 Lerntagen“ falsch | Kopfzeilen |
| K5 | Kontrast im Gedämpft-Modus bei 390 px (Metazeile „Hörübung“) | – |
| K6 | Kopfzeilen uneinheitlich (Pille gegen Symbol) | – |
| K7 | „Ich lag richtig“ gegen „War das auch richtig?“ | Grammatik gegen Wörter-App |
| K8 | Rechte Spalte am Laptop läuft auf ~1.590 px über, Knöpfe unter dem Rand, ~480 px Leere in der Mitte | Laptop-Layout |
| K9 | Gestapelte Zahlen „27 56 18“ ohne Legende | Themenübersicht |
| LS5 | Fehlersätze aus Anwenden (`app/repair`) haben keinen Pflichtweg mehr. `dueErrors` liest nur Grammatik-Dokumente (`tasks.ts:491`), `fixDue` zählt sie aber für `mixedErrorsFor` | `ComboSentence.tsx:37,121-122`, `planFor.ts:173-178`, `today/store.ts:241` |
| LS7 | Melden ohne Spur, verdächtige Aufgabe zählt im Test (siehe 2.6) | `persist.ts:269`, `session.ts:491-506` |
| LS9 | Keine Zweitmeinung für alle getippten Arten (die Wörter-App hat auch keine) | `judge.ts:163-166` |
| LS12 | Testlücken im Tagesweg: errs===3, Sonntag, Neustart, verkürzt, reviewCount 0 | `dayMinutes.test.ts:35-43`, `planFor.ts:171-179` |

Weitere Befunde des learning-scientist, nicht auf der Liste:
- LS1: Die automatische Erklärung teilt sich das Budget von 20.
- LS4: Jede Themenrunde erfüllt die Pflicht (`session.ts:236-270`).

Kai-Urteil (`ux-neuanfang.md`):
- „Grammatik als Kurs 4/10“.
- Abnahmepunkt 10: Grammatik als Kurs, Test erst nach dem Lernen, keine zweite Themenliste.

---

## 4. Datenmodell

### 4.1 Dokument `grammar/<topic>`
- Schema in `src/data/schemas.ts:407-455`.
- Felder:
  - Lernstand: `id, p, anchor, anchorD, n, c, due, last, recent, seen, seenText, hist`
  - `errors[]` mit `{q, given, ans, t, box, due, done, last, src, fsrs, expl, cid, pts, ax, cf, unclear, h}`
  - Weitere: `fitAlt`, `tt`; `pats`/`vt` werden tolerant (loose) gelesen
- Doku in `docs/datenmodell.md`:
  - `grammar/c1-*` (`:79`), `tt` (`:166`), `unclear` (`:219`), `held` (`:220`)

### 4.2 Weitere Pfade
- `app/repair`: eigene Fehlersätze aus Anwenden, Boxen 1/3/9.
- `app/c1`: Meldungen (`bad`), c1x-Fortschritt, ≤30 KB (`datenmodell.md:161`).
- `app/pool`: KI-Aufgaben-Pool (`datenmodell.md:227`).
- `app/radar`: Ereignisse.

### 4.3 Seed (`seed/sample-data.json`)
- 219 Dokumente, davon 12 Grammatik-Dokumente.
- 25 Fehlersätze, **keiner mit `pat`**; 36 `seen`.
- `app/pool` hat 10 Einträge, `app/radar` 32 Ereignisse.
- **Es fehlen `app/repair` und `app/c1`.** Melde- und Anwenden-Fehler sind im Test also nicht abgedeckt.

### 4.4 Vergleich mit der Wörter-App
- Die Wörter-App hat eigene Sammlungen `vlog`/`vmod` mit Verlauf je Antwort (`src/modules/vocab/domain/vlog.ts:4-6`).
- Die Grammatik kennt nur `hist`/`recent` im Themendokument. Einen vollständigen Verlauf je Antwort gibt es nicht.

---

## 5. Wiederverwendbare Muster der Wörter-App (`src/modules/vocab`)

| Muster | Datei | Nutzen für G |
|---|---|---|
| Modulgrenze: eine Tür nach außen und eine nach innen, Isolationstest | `api.ts:13-15`, `shared.ts:1-7`, `sharedUi.ts`, `registry.ts`, `tests/unit/vocab/isolation.test.ts` | eigenes Modul `src/modules/grammar` neben dem alten Bereich (Rückweg per Schalter wie `vcfg.mod`) |
| Planer je Antwort, höchstens eine Buchung je Lerntag | `domain/planner.ts:12-14`, `session.ts:10-12` | Ersatz für den Mix aus p/box/fsrs in `grammar/<topic>` |
| Tagesplan je Lerntag eingefroren, Rückstand gedeckelt | `domain/day.ts:7-9` | Kap. 15 „würfelt neu“; LS5 Pflichtweg für `app/repair` |
| Note aus Richtigkeit, Form, Hilfe und Zeit; keine Selbstbewertung | `domain/grade.ts:3-5` | ersetzt „Ich lag richtig“ (K7) |
| Feste Auswertungsregeln (a)–(h), „Auch richtig“, britische Formen | `domain/check.ts:3-5`, `shared.ts:7` | Gegenstück zu `check.ts`/judge; britische Formen fehlen dort heute (2.4) |
| Band nach jeder Antwort in fester Reihenfolge, „Kommt wieder“ aus dem gespeicherten Ergebnis | `domain/band.ts:8-10`, `ui/LearnCard.tsx:36-37` | eine Erklär-Hierarchie (Muster 5) statt doppeltem „Richtig, weil“ |
| „Warum heute?“ je Karte | `domain/reason.ts:6-8` | macht die Aufgabenwahl nachvollziehbar |
| „Aufgabe war unfair“: zählt nicht, mit Flag im Verlauf | `ui/learnRun.ts:868-880` | Lösung für LS7 und M14 |
| Stufenleiter mit zwei Spuren | `domain/ladder.ts:3-4`, `tracks.ts` | Lernstand je Regel statt Meisterschaft p |
| Verlauf als Objekt-Map, idempotent und geräte-sicher | `domain/vlog.ts:4-6`, `data/store.ts:15-17` | Grundlage für „n von m gewertet“ und Wochenauswertung |
| Claude-Vorlagen mit zod, gemeinsamer Teil | `prompts/judge.ts`, `common.ts`, `ui/aiCheck.ts`, `aiPort.ts` | Zweitmeinung für **alle** getippten Arten (LS9) |
| Ruhige Bildschirme nach Vorschau: Lernrunde, Seite, Übersicht | `ui/LearnScreen.tsx:14-15`, `WordPage.tsx:14-16`, `Overview.tsx:17-19` | Themen-Seite und Übersicht für Grammatik |
| Ablauf des Großpakets: Refinement, 9 Schritte, Prüfer je Schritt | `docs/umbau/vokabeln/grosspaket-a.md` §4 | Vorlage für den G-Plan |

---

## 6. Inhaltsmengen und Prüfstand

### 6.1 Mengen je Quelle (eigene Zählung, Skripte `scratchpad/g0/count*.mjs`)

| Quelle | Menge | Arten / Bemerkung |
|---|---|---|
| Seed `legacy` | 48 | mc 26, gap 15, correct 3, transform 4; 16 Themen |
| `grammar-extra` | 9 | – |
| `grammar-bank` | 240 | mc 96, gap 80, transform 32, correct 32; 16 Themen |
| `toolkit` | 280 | mc 86, gap 77, transform 51, correct 66; 31 Regelthemen |
| `rules.json` (Fallen) | 27 | ohne `accepted` (2.2) |
| **Seed-Weg gesamt** | **604** | – |
| `tasks-v2` (LP2) | 1.270 | kwt 465, find 572, meaning 233; 185 nur Übung; 549 mit `accepted` |
| c1x | 1.088 | err 184, kwt 121, mcc 184, ocl 182, wf 100 |
| Fehler korrigieren | 76 | `fk/b1.json` 60, `b2.json` 16 |

Weitere Bestände:
- c1x nach Zweck: check 82 (Probe), gate 135, place 94, pilot 6.
- c1x nach Inhalt: gram 900, lex 188; 229 im Pool, 82 Probe; **617 trainierbare Grammatik-Aufgaben**.
- Muster: `pattern-map` hat 650 Einträge (16 doppelt). 231 Muster in 47 Dateien, 7 ausgemustert.
- `path.json`: 7 Kapitel (k1 7, k2 5, k3 4, k4 7, k5 4, k6 10, k7 10) mit **47 Themen**.

### 6.2 Verteilung je Thema (Seed / v2 / c1x)
- **Kein Seed:** ellipsis, emph-plus, future-past, inversion, modals-prob, noun-phrase, quant-neg, stative-adv.
- **Kein c1x:** etwa 25 Themen, darunter articles, c1-discourse, comparison.
- **Größte Themen:**
  - word-order 12/37/0
  - cond-alt 12/34/35
  - noun-phrase 0/26/42
- Die Themen sind also sehr ungleich gefüllt. Einige laufen nur über eine einzige Quelle.

### 6.3 Was geprüft ist
- **Q0 (31.10., `docs/umbau/berichte/q0.md`):**
  - Der Spieler (`tests/unit/taskPlayer.test.ts`, `learnerView.ts`) löst jede Aufgabe.
  - Validator `kwtQ0Problems` in `scripts/grammar/validate.mjs`; Patch-Werkzeug `q0-patch.mjs` (grammar:build bleibt verboten).
  - Die Befundklassen a–e stehen jetzt auf 0. 66 Aufgaben wurden umgeschrieben und **vom Lehrer gegengelesen**.
  - Die Q0-Zählung: 1.270 LP2, 593 c1x-Seed, 246 Startaufgaben mit `accepted`.
- **Offen aus Q0:**
  - 12 f-Hinweise: 10 meaning-Aufgaben ohne Begründung für „beide“, dazu np-k1, kwt-v2-323, kwt-v2-588
  - „Fast“ bei kurzen Antworten
  - Varianten ohne Zielmuster
  - kwt-0610
  - zu lange Musterantworten (kwt-0014/0054/0536, em-wc-k2, rc-pp-k1)
- **Masterplan Schritt 1** (`docs/umbau/masterplan-9-5.md`, live v86): Qualitätstor und Inhaltsfixes, die der Lehrer geprüft hat.
- **Fehler korrigieren** (FK, live v81) mit Aufgaben-Audit (MD).
- **Nie blind von einem Menschen oder Lehrer gelöst:**
  - die Seed-Bank (604)
  - der größte Teil von c1x (ausgenommen die Q0-Klassen)
  - Erklärtexte gegen den jeweiligen Satz
  - die Fehlersätze aus `app/repair` (nur `gate.ts`/`quality.ts`)
- **Plan D in `ux-neuanfang.md`** schlägt deshalb vor:
  - alle Aufgaben blind lösen
  - Erklärung gegen den Satz prüfen
  - Zweitmeinung für alle getippten Arten
  - Melden mit sofortiger Wirkung

### 6.4 Folgerung für das Refinement (nur Fakten, keine Entscheidung)
- Etwa 2.900 Grammatik-Aufgaben aus vier Quellen mit zwei Bewertungswegen (`check.ts` und `scoreC1`) laufen in **einem** Bildschirm mit 1.258 Zeilen.
- Diese Aufgaben sind nicht vollständig blind geprüft.
- Meldungen werden gesammelt, aber nicht ausgewertet.
- Eigene Fehlersätze haben keinen Pflichtweg.
- Die Wörter-App liefert für alle diese Punkte ein fertiges Gegenmuster: Modul, Tagesplan, Band, „unfair“, Verlauf, Vorlagen.
