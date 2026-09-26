# Phase 2 – Lernen: verbindlicher Umsetzungsplan

Stand: 26.09.2026. Das ist die Synthese aus drei Fachentwürfen: Architektur, Lerndesign und Daten (data-guard).

**Vorrang bei Widersprüchen:**
1. `contract/*.d.ts`
2. CLAUDE.md (A7, Emrahs Vorgaben)
3. Daten-Entwurf (die Regeln zu ALARM B1/B2 sind bindend)
4. Architektur
5. Lerndesign

Weicht Code von diesem Plan ab, gilt der Plan. Ändert sich etwas, ändert der Lead zuerst diesen Plan. Es gibt genau einen Planungsdurchgang (A2 „Keine Schleifen“).

---

## 0. Ausgangslage

**Was schon da ist:**
- MVP (produktiv), WP1 (KI-Tor, Prompts) und WP3 (Text, Wörterbuch, Lautschrift).
- Der Umbau des Phase-1-Trainers läuft **parallel**: automatische Einstufung `autoGrade`, `StatusLine`, Beispiele (`prompts/cardExamples.ts`), Wort-Antippen (`engine/wordTap.ts`, `engine/EnglishText.tsx`) und Platzhalter (`domain/answer/mask.ts`).
- Phase 2 baut auf genau diesen Bausteinen auf. Jedes Paket, das sie oder eine Phase-1-Datei anfasst, startet erst **nach dem Merge des Trainer-Umbaus** (Kennzeichnung „W2“ in §10).

### Sofortmaßnahme für den laufenden Phase-1-Bau (ALARM B1/B2)
Setzt Phase 1 `pflichtSince`, muss es die Regeln aus §6.3 schon **jetzt** übernehmen:
- `pflicht[tag]` auch bei leerer `duty`, sofern an dem Tag eigene Aktivität da ist;
- Wert von `pflichtSince` = Maximum über die Aktivtage, nie rückwirkend;
- Setzen unter `acquire`.

Geht das nicht, setzt Phase 1 `pflichtSince` **nicht**, und Phase 2 übernimmt es.

Belege aus den Sonden:
- **S3:** Die Serie fällt von 17 auf 1, weil an Tagen mit `duty:[]` nie `pflicht` gesetzt wird. Stelle: `docs/phase1-plan.md:638/670` mit `src/domain/plan/buildPlan.ts:41`.
- **S4:** Eine nachgehende Uhr setzt `pflichtSince` rückwirkend, die Serie fällt von 15 auf 13. Stelle: `docs/phase1-plan.md:363`.

---

## 1. Umfang und Abgrenzung

**Ziel (Kap. 13 Nr. 3, Kap. 6.1–6.4, 6.7):**
- **Kurs:** Die 24 Lektionen werden mit dem vorhandenen Kursstand (`app/course.done`) weitergeführt, je 4 Schritte in 12 Minuten.
- **Grammatik:**
  - Regelwerk und Wort-für-Wort-Diagnose;
  - „Auch richtig“ und Fehler-Wiederholung;
  - gedämpftes BKT auf `grammar/<topic>`;
  - Aufgaben aus `daily/*` (nur lesen) und `app/pool`.
- **Vier Übungen:** Diktat, Lückenjagd, Satzbau, Sprint.
- **Heute:** Die Pflicht wird zu „Wiederholen + Lektion + 1 Pflichtkanal“, alles andere ist Angebot mit Grund. Alle Phase-2-Übungen folgen A7 vom 26.09., 18:15 Uhr (keine Bewertungsknöpfe, Statuszeile, echte Hilfe, antippbar, Platzhalter).

**In Phase 2:**
1. Reiter „Lernen“ mit den Bereichen Kurs, Grammatik und Übungen.
2. Kurs:
   - Liste der Einheiten und Lektionen;
   - Lektionslauf Wörter → Dialog → Grammatik → Produktion;
   - Inhalt aus `lesson/<id>`. Fehlt er, auf Knopfdruck per KI, sonst eine lokale Grundfassung.
3. Grammatik:
   - 16 Themen mit Sicherheit und Regelblatt;
   - Runde mit `mc`/`gap`/`transform`/`correct`;
   - Fehler-Wiederholung, KI-Urteil für freie Antworten, neue Aufgaben per Knopf.
4. Diktat, Lückenjagd, Satzbau, Sprint (ohne KI).
5. Tagesplan:
   - Kanäle mit Begründungsschlüsseln, Pflichtkanal, `duty` = review/lesson/ch;
   - `pflicht` und `pflichtSince` nach §6;
   - Verarbeitung **aller** liegengebliebenen `daily/*`.
6. Eine gemeinsame Sammel-Schreibwarteschlange (`src/features/progress/persist.ts`), einschließlich Behebung W1 und Tab-Kennung.

**Nicht in Phase 2:**

| Inhalt | Wann | Grund |
|---|---|---|
| KI-Nachgenerierung neuer Einheiten (l25+) | 6 | Es sind noch 18 Lektionen offen; die Erweiterung braucht die KI-Einschätzung aus Phase 6 und eine neue Dokumentform (`meta`). |
| KI-Absätze für die Lückenjagd (`cloze-hunt`) | 4/6 | Die Lückenjagd läuft lokal aus Emrahs Kollokationen; kein neuer Sammelpfad. |
| `profile.canDo`, `app/course.prog` | – | Neue Felder ohne Beschluss (Phase-1 E24). Can-Do steht im `writing`-Dokument, der Schrittstand lokal. |
| Kanäle listen/read/write/speak/discover | 3/4 | Module fehlen. |
| Gewichtung mit `levelModel` und Fehler-Radar-Ansicht | 6 | Kap. 13. |
| Stimmenwahl, E-Mail-Refiner | 3 | Kap. 13. |

---

## 2. Entscheidungen (je ein Satz Begründung)

| # | Frage | Entscheidung | Begründung |
|---|---|---|---|
| D1 | Fehler-Wiederholung | **Die Boxen 1/3/9 der alten App steuern** (`box`, `due`, `done`, `last`). FSRS wird **zusätzlich** als Schatten in `errors[i].fsrs` geschrieben, ab der ersten Wiederholung. Es steuert nichts und ist nur unter „Messwerte dahinter“ sichtbar. | Die Datensicherheit (Rückweg, Daten-Entwurf §2) hat Vorrang. Kap. 5 („FSRS für Fehler“) und Kap. 9, Regel 2 („zusätzlich“) sind so trotzdem erfüllt, ohne zwei Planungen gegeneinander. |
| D2 | Aufgaben-Schlüssel | **Genau wie in der alten App:** `key = legacyNorm(prompt).replace(/[^a-z]/g,'').slice(0,80)`. `legacyNorm` ist die 1:1-Portierung von `models.js:223` (§4.3). | Die Sonde fand 158 von 158 `seenText` in `seen`. Ein anderer Schlüssel zerbricht `seen`, den Pool-Abgleich und den Rückweg. |
| D3 | Menge der Pflichtkanäle | **`gram`, `cloze`, `order`.** `dictate`, `sprint` und `vocab` sind nur Angebot. | Alle drei laufen ohne KI und ohne Sprachausgabe auf jedem Gerät, die Pflicht ist also immer erfüllbar (Voraussetzung für `pflichtSince`). Diktat braucht TTS (iPhone-iframe unsicher). Sprint misst nur Tempo. Wiederholen ist schon Pflicht (Kap. 15, nichts doppelt). |
| D4 | Dauer der Lektion | **12 Min.** (3/3/3/3). Pflicht gesamt ≈ Wiederholen 10 + Lektion 12 + Kanal 5 = **27 Min.** | Emrahs Rahmen ist 25–30 Min. (Kap. 1); die alte Lektion mit 17 Min. würde ihn sprengen. |
| D5 | Schreibwarteschlange | **Genau eine** Sammel-Warteschlange für `app/profile`, `log/<tag>`, `app/radar` und den Abschluss in `app/course`. Sie liegt in `src/features/progress/persist.ts`, dorthin verschoben aus `features/vocab/persist.ts`. `grammar/<topic>`, `vocab/*` und `lesson/*` werden sofort und je Dokument geschrieben. | `lxSeq[gerät] >= seq` verwirft Stapel; zwei Warteschlangen mit verschränkten Folgenummern verlieren Antworten (Daten-Entwurf, WARNUNG `profilePatch.ts:43`). |
| D6 | Behebung W1 | Ein gescheiterter Stapel behält seine `seq` und wird **unverändert und zuerst** erneut gesendet. Neue Antworten sammeln sich in einem Folgestapel. | Wenn das scheinbar gescheiterte `update` doch angekommen war, wirkt es so nie doppelt, und es geht nichts verloren. |
| D7 | `deviceId` | **Je Tab** (`sessionStorage`, `lx:tab`, über `platform/storage.ts`). `lxSeq`-Einträge, die älter als 14 Tage sind, setzt derselbe Patch auf `null`. | Zwei Tabs mit derselben Kennung verwerfen sich gegenseitig Stapel. Das Nullen begrenzt das Wachstum (data-guard bestätigt einmal). |
| D8 | `ctx` im Log | `rev` (Wiederholen, unverändert), **`duty`** (Lektion und Pflichtkanal), `xtra`. | So im Daten-Entwurf; `deriveToday` zählt `review` weiter nur über `k:'v'` und `ctx:'rev'`. |
| D9 | Wann ist der Pflichtkanal erledigt? | `act[tag][kanal] >= 1` **ohne `~`** (live ⊕ Puffer). Eine Kanal-Runde, die gestartet wird, solange der Kanal heute Pflicht und offen ist, läuft mit `ctx:'duty'`, egal von wo aus sie gestartet wird. | Aus gespeicherten Daten ableitbar, also kann jeder Tab sich selbst heilen (Daten-Entwurf §7). Keine zweite Zählquelle. |
| D10 | Wann ist die Lektion erledigt? | `course.done[x].d === tag` oder `course.done[x].last?.d === tag` für **irgendeine** Lektion. Die Heldenkarte startet `plan.lesson`. | Ableitbar und datensicher; macht Emrah eine andere Lektion, bleibt „Lektion“ nicht widersprüchlich offen (Kap. 2.2). |
| D11 | Lektion ohne KI | **Grundfassung** (`baseLesson`, nie gespeichert) wie `fallbackLesson` der alten App (`lesson.js:95`): Wörter aus `course.json`, Aufgaben aus Pool/Seed, statt Dialog „Beispiele“ aus `rules.json`, Produktion lokal geprüft. | Die Lektion ist damit immer erfüllbar. Der Lern-Vorschlag „`lessonNoAi` = keine Pflicht“ entfällt, weil sonst die Pflicht von Tag zu Tag schwankt. |
| D12 | Übungen und Lernstand | Diktat, Lückenjagd, Satzbau und Sprint schreiben **kein** `grammar/*` und kein `vocab/*`, nur Log (außer Sprint), Zähler, `act`, Radar und `sprints`. | Daten-Entwurf (die alte App tat es ebenso); sonst planen Übungen FSRS/BKT doppelt (Architektur R10). |
| D13 | KI-Urteil für freie Antworten (`transform`, `correct`) | Lehnt die lokale Prüfung ab, hat die Antwort ≥ 3 Wörter und ist KI da, fragt **derselbe Druck auf „Prüfen“** einmal `grammar-judge@1`. Ohne KI oder bei einem Fehler gilt `near` (p sinkt nicht, kein Fehlereintrag). | „Prüfen“ ist eine ausdrückliche Handlung (`sample.d.ts`); unsichere Prüfung darf die Beherrschung nicht senken (Lerndesign B-08). |
| D14 | Begründungsschlüssel | Nur die Schlüssel der alten App: `agoNever`, `agoDaysN`, `whyFocus`, `whyThin`, `whyWeakest`, `whyDue`. Die Wochenstrafe wirkt nur auf die Punktzahl. | Rückweg: Die alte App übersetzt nur ihre Schlüssel (`today.js:249`). |
| D15 | Reihenfolge der Pflicht | `duty = ['review', 'lesson', 'ch:<id>']`. Die Heldenkarte zeigt den ersten offenen Punkt. | Fällige Karten zuerst; die Lektionswörter blähen sonst das Wiederholen auf. |
| D16 | Live-Abos | **Kein** neues Abo (bleibt bei 8 mit `chunk` aus Phase 1). `lesson/<id>`, `app/pool`, `app/radar` und `daily/*` werden per `get()` bzw. im `transform` gelesen. | Weniger Abos; die Planung braucht keinen Lektionsinhalt (D11). |
| D17 | Lektionswörter | Werden `vocab/<slug>` (`src:'lesson'`, `lesson:lid`, `origin.kind:'lesson'`, `ex` = Dialogsatz mit `[wort]`) plus `reviewWrite`. Sie zählen zu `newPerDay`, aber das Wiederholen behält mindestens `min(2, newPerDay)` andere neue Karten. | Kap. 6.3/15 (Ursprungssatz; neue Wörter nicht verdrängt). |
| D18 | Lektionsauswahl | Nächste offene Lektion in Kursreihenfolge. Nennt `assess.data.focus.action` `grammar:<topic>` (Sprache passt), zieht die nächste offene Lektion mit diesem Thema in der aktuellen oder nächsten Einheit vor (`whyFocus`). | Kap. 6.2 „berücksichtigt die KI-Einschätzung“, deterministisch und im Plan eingefroren. |
| D19 | Ausführbare Kanäle | `EXECUTABLE_CHANNELS = ['gram','cloze','order','sprint','dictate','vocab']` (Kennungen der alten App). Ein Plan der alten App von heute wird nur übernommen, wenn alle `ids` ausführbar sind **und** `ids[0]` ∈ D3. | Ein Pflichtkanal aus einem Altplan muss erfüllbar sein. |
| D20 | Rundengrößen | Pflicht (`goal.ch`): gram 6 (ohne das Thema der heutigen Lektion), cloze 8, order 6. Frei: gram 8, cloze 8, order 6, Diktat 8, Sprint 90 s. | Etwa 5 Min. je Kanal (D4); keine Grammatik dreimal an einem Tag (Kap. 15). |

**Widerspruch Vertrag ↔ Auftrag:**
- Kap. 6.4 „täglich neue Aufgaben“: `sample.d.ts` erlaubt KI-Aufrufe nur auf ausdrückliche Handlung („never from a loop or a timer“). Neue Aufgaben kommen daher aus `daily/*` (Tagesauftrag) und auf Knopfdruck.
- Kap. 10 „Timeout“: A6.2, kein eigener Timer.
- Kap. 4.1 „Anfangsbreite verrät Länge nicht“: gilt nicht mehr, weil A7 für die Stufen mit Hilfe Platzhalter vorsieht.

---

## 3. Architektur und Dateiplan (Kap. 3.4)

N = neu · Ä = geändert. In Klammern das Paket (§10), dazu **W1** (sofort) oder **W2** (nach dem Merge des Trainer-Umbaus).

```
src/domain/
  learn/types.ts N (S0a, danach nur Lead)          gemeinsame Typen §10.1
  learn/grade.ts N (A, W1)                          Note aus Richtigkeit/Zeit/Hilfe für Grammatik & Übungen
  answer/align.ts N (A, W1)                          Levenshtein auf Wortebene mit Rückverfolgung (eq/typo/sub/ins/del)
  grammar/key.ts N (A, W1)                           legacyNorm, legacyTaskKey (1:1 alte App)
  grammar/bkt.ts N (A, W1)                           gedämpftes BKT, Anzeige-Verfall, due, Sicherheit 0–5
  grammar/errors.ts N (A, W1)                        Boxen 1/3/9 + FSRS-Schatten, Kappung, Fälligkeit
  grammar/tasks.ts N (A, W1)                         validG-Portierung, Normalisierung, Auswahl der Runde
  grammar/check.ts N (A, W1)                         Prüfung je Typ, „Auch richtig“, UK/US, Kurzformen
  grammar/rules.ts N (A, W1)                         rules.json typisiert, Form-Hinweis, Beispiele, Sprachwahl
  grammar/write.ts N (A, W1)                         grammarWrite(cur, a) → create|update|skip
  grammar/radar.ts N (A, W1)                         mergeRadar (≤ 400, ≤ 240 KiB, Dedupe t|c|q), topicCat, normCat
  grammar/pool.ts N (A, W1)                          poolIntake/compact (nie Unverbrauchtes verwerfen), lxDaily
  course/catalog.ts next.ts baseLesson.ts lessonDoc.ts courseDone.ts production.ts N (B, W1)
  drills/sources.ts dictation.ts cloze.ts order.ts sprint.ts N (D, W1)
  plan/channels.ts N (E, W1)                         Kanalkatalog, Machbarkeit, Punktzahl + why
  plan/pflicht.ts N (E, W1)                          pflichtFor, pflichtSinceValue, dutiesFeasible
  plan/dailyIntake.ts N (E, W1)                      alle daily/* → Karten + Pool (rein)
  plan/types.ts buildPlan.ts Ä (E, W2)               duty v2, goal.ch, deriveToday v2
  progress/profilePatch.ts logPatch.ts Ä (E, W2)     g-/x-Zähler, act-Schlüssel, sprints, pflicht, lxSeq-Kappung
  srs/queue.ts Ä (E, W2)                             Mindestanteil neuer Nicht-Lektions-Karten (D17)
  srs/types.ts Ä (S0b)                               AnswerEvent.ctx + 'duty'; newCard CardOrigin.kind + 'lesson'
src/prompts/  lessonContent.ts lessonProduction.ts N (B, W1) · grammarItems.ts grammarJudge.ts N (A, W1) · registry.ts Ä (S0b)
src/data/     schemas.ts Ä (S0b) · reads.ts Ä (S0b: readCollection) · writer.ts Ä (S0b: acquire)
src/platform/ storage.ts Ä (S0b: session) · dev/cannedReplies.ts Ä (F, W2)
src/engine/   SentenceDiff.tsx N (C, W2)
src/features/
  progress/persist.ts N (S0b; aus vocab/persist.ts verschoben; danach E)   die EINE Sammel-Warteschlange
  vocab/persist.ts Ä (S0b)                          nur noch saveCard + Re-Export
  learn/LearnHub.tsx N (S0b-Gerüst → INT)
  course/{CourseScreen,LessonScreen}.tsx lessonMachine.ts store.ts steps/{Words,Dialog,Grammar,Output}.tsx N (B, W2)
  grammar/{GrammarScreen,TopicSheet,RuleSheet,SessionScreen,GrammarItem}.tsx itemMachine.ts session.ts N (C, W2)
  drills/{DictationScreen,ClozeScreen,OrderScreen,SprintScreen}.tsx drillMachine.ts sprintMachine.ts session.ts N (D, W2)
  today/{TodayScreen.tsx,store.ts} Ä (E, W2)
src/app/      nav.ts App.tsx Ä (S0b/INT)
src/i18n/parts/ learnhub.* course.* grammar.* drills.* N · today.* Ä
scripts/generate-seed.mjs, seed/sample-data.json Ä (F, W2) · tests/** (je Paket, E2E: F)
```

**Schichten:** Es gilt die ESLint-Tabelle aus phase1-plan §2.1. `domain/{learn,grammar,course,drills,plan}` sind rein: kein React, keine KI, kein `Date.now()`/`Math.random` (Zeit und Seed kommen als Parameter).

**Zustände:**
- **XState 5:**
  - `lessonMachine`: `intro → words → dialog → grammar → output → summary`; Zurück ist erlaubt, Überspringen nicht.
  - `itemMachine`: `presenting → input → checking → (judging) → feedback → done`; `STOP`/`cancelled` → `feedback` mit `near`.
  - `drillMachine`: `presenting(speak) → input → checking → feedback → done`.
  - `sprintMachine`: `ready → running → finished`; Uhr über `performance.now()`, Anzeige per rAF; die Maschine schreibt nichts.
- **zustand:**
  - `useLessonRun`: Lektion, Schritt, Inhalt eingefroren, Quelle `db|ai|base`.
  - `useGrammarSession`, `useDrillSession`: Warteschlange eingefroren.
  - `usePending` (progress/persist).
  - `useDayInputs` (today/store): die `daily/*` des Tages im Speicher, Pool-Stand.
- **Navigation (`app/nav.ts`):** `learn`, `course`, `lesson{id}`, `grammar`, `grammarSession{mode:'duty'|'xtra'|'errors'|'topic', topic?}`, `drill{kind, ctx}`. Die Reiterleiste hat 3 Reiter: Heute · Lernen · Dein Stand.
- **Lokal (Bequemlichkeit, try/catch in `platform/storage.ts`):** nur `lx:lesson:<lid>:step`, der Entwurf der Produktion und `lx:tab` (`sessionStorage`).

---

## 4. Datenformen und Schreibwege

### 4.1 Querschnittsregeln (verbindlich, Daten-Entwurf §1)
1. **Nur über `src/data/writer.ts`:**
   - `transform` → `update` für bestehende Dokumente;
   - `set` nur für fehlende Dokumente;
   - `createIfMissing` für Neuanlagen.
   - Kein `delete`, nie aus Render, Snapshot oder Timer.
   - `daily/*` und `feed/*` werden nie geschrieben (`isReadOnlyPath`).
2. **Datum und Zeit:**
   - Datumsschlüssel `dayKey(now)` (Wechsel 04:00), bei jedem Aufruf neu.
   - Alle Antworten einer Runde gehören zum Lerntag ihres Beginns (Phase-1 E10).
   - `nextT()` liefert den Zeitstempel und ist zugleich der Idempotenzschlüssel (`last === t` → bereits angewendet).
3. **Gelesene Dokumente:** Jedes läuft durch `validateDoc`. Ist es ungültig: nicht schreiben, `logError`. Arrays werden immer aus dem **frischen** Stand im `transform` berechnet.
4. **Neu im Writer (S0b):** `acquire(path, {holder, ttlMs})` → `AcquireResult` (Durchreichung von `db.d.ts`, ohne `data`). `{acquired:false}` ist ein normales Ergebnis, der nächste Versuch kommt beim nächsten `ensureDay`, keine Schleife.

### 4.2 Übersicht

| Dokument | Auslöser | Operation |
|---|---|---|
| `grammar/<topic>` | jede bewertete Grammatikantwort (Runde, Lektion, Fehler-Wiederholung), **sofort** | `transform(p, cur => grammarWrite(cur, a, now))` |
| `log/<tag>` | Sammel-Warteschlange | `mergeLogEntries` (≤ 300, ≤ 240 KiB, Dedupe `t\|(id??q)`) |
| `app/profile` | Sammel-Warteschlange | `profilePatch` v2 mit `lxSeq` |
| `app/radar` | Sammel-Warteschlange | fehlt → `set({events})`; ungültig → nichts; sonst `update({events: mergeRadar(...)})` |
| `app/course` | Lektion abgeschlossen (Sammel-Stapel, vor dem Profil) | §4.7 |
| `lesson/<lid>` | KI-Inhalt erfolgreich | §4.8 |
| `writing/lesson-<lid>-<ms>` | Produktion per KI geprüft | `createIfMissing` |
| `vocab/<slug>` | Wörter-Schritt der Lektion, je Antwort | `saveCard(a, newDoc)`: fehlt → `set(neu + reviewPatch)`; vorhanden → `reviewWrite`; verborgen oder ungültig → skip |
| `vocab/<slug>` | `daily.newWords` aller offenen Tage | `createIfMissing(newVocabDoc(...src:'coach'))` |
| `app/pool` | `ensureDay` (Abgleich `daily/*`) und „Neue Aufgaben“ (KI) | `acquire` + `transform` → `poolIntake` |
| `app/profile.plan` | `ensureDay` | wie in Phase 1 (nur ohne v1-Plan von heute) |
| `app/profile.pflicht[tag]` | Sammel-Stapel bzw. Selbstheilung in `ensureDay` | §6.3 |
| `app/schema.pflichtSince` | `ensureDay`, einmal je Datenbank | §6.3 |

### 4.3 `grammar/<topic>` (Daten-Entwurf §2, 1:1 wie `updateTopic`/`session.js:431–436`)

**Fallunterscheidung in `grammarWrite`:**
- Dokument fehlt, Thema ∈ TOPICS → `set({...defaultTopic, ...patch})`.
- Dokument fehlt, Thema unbekannt → skip `unknown_topic`.
- Dokument ungültig → skip `invalid` + `logError`.
- `last === a.t` → skip `already_applied`.
- `last > a.t` → skip `stale_answer` (das Log behält die Antwort).
- sonst `update(patch)`.

**Felder:**
- **BKT:**
  - slip .10; guess = 1/Zahl der Optionen bei `mc`, sonst .05; transit .08.
  - Δ = clamp(post − effP, −.06, +.06); bei Hilfe (`help.level ≥ 1`) ×0,5.
  - Tagesanker: `anchorD !== dayKey` → `anchor = p_alt`, `anchorD = tag` (nur dann schreiben). Danach p ∈ [anchor − .12, anchor + .12] ∩ [.02, .99].
  - `near` zählt als richtig.
- **`due`:** `now + (ok ? clamp(round(1 + 18p²), 1, 21) : 1)` Tage.
- **`hist`:** ein Eintrag je Lerntag (letzter ersetzt), `.slice(-40)`, p auf 3 Stellen.
- **`recent`:** `.slice(-10)`.
- **`seen`:** + `legacyTaskKey(prompt)`, `.slice(-80)`. **`seenText`:** + prompt, `.slice(-20)`.
- **Neuer Fehler** (falsch, keine Wiederholung, nicht „Weiß ich nicht“): **alte Form** `{q, given≤160, ans, t, src}`.
- **Fehler-Wiederholung** (`e.t === task.errorT`):
  - `e.last >= a.t` → nichts.
  - Richtig: `box+1`, `done = box >= 3`, `due = now + [1,3,9][min(box,2)]` Tage.
  - Falsch: `box 0`, `done false`, `due +1 Tag`, `given` neu.
  - Immer `last = now`, dazu FSRS-Schatten `fsrs = reviewFsrs(fsrs ?? neu, grade, tNow=max(now, fsrs.last))`.
  - Alte Einträge ohne `box`: gelesen mit `due = e.due ?? e.t + 1 Tag`, erst beim Wiederholen ergänzt.
- **Kappung `errors` auf 10:** zuerst die ältesten mit `done:true`, erst dann die ältesten offenen (bewusste Abweichung, verlustärmer als die alte App).
- **Unverändert bleiben:** `id` und alle unbekannten Felder.
- **Mehr-Tab:** Der letzte Schreiber gewinnt, höchstens eine Antwort fehlt in `n`/`c`, nie eine Doppelzählung (akzeptiert, kommentiert, getestet).

```ts
// src/domain/grammar/key.ts (1:1 models.js:223 + grammar.js:50)
export function legacyNorm(s: unknown): string; // toLowerCase, ’‘`´→', “”„→", \s+→' ', won't→will not, can't→cannot, shan't→shall not,
                                                 // n't→' not', 'll→' will', 've→' have', 're→' are', i'm→i am, can not→cannot, [.,!?;:"] weg
export const legacyTaskKey = (prompt: string): string => legacyNorm(prompt).replace(/[^a-z]/g, '').slice(0, 80);
```

### 4.4 `log/<tag>` (additiv: `ms`, `ctx`, `lesson`, `src`)

```json
{"t":1790496000000,"ok":false,"lang":"de","k":"g","topic":"conditionals","type":"gap","q":"…≤160","given":"knew","ans":"had known","src":"lesson","m":"gr-gap","g":1,"ms":5300,"ctx":"duty"}
{"t":1790496060000,"ok":true,"lang":"de","type":"dictate","q":"…≤160","given":"…≤160","ans":"…","g":3,"ms":8000,"ctx":"xtra"}
{"t":1790496120000,"ok":true,"lang":"de","type":"lesson-q","q":"…","given":"…≤80","ans":"…","lesson":"l07","ctx":"duty"}
{"t":1790496180000,"ok":true,"lang":"de","k":"v","id":"stakeholder","m":"lesson","given":"…","ans":"…","g":3,"ms":3900,"ctx":"duty"}
```

- `type` ∈ `cloze|dictate|order|lesson-q` (Altformen).
- Grammatik: `k:"g"`; `src` ∈ `ai|seed|review|lesson|daily`.
- **Sprint schreibt keine Log-Einträge** (wie die alte App).
- „Weiß ich nicht“ → `given:"(don't know)"`.

### 4.5 `app/profile` – `profilePatch` v2 (Erweiterung der Phase-1-Signatur)

```ts
export type CountEvent = { day: string; kind: 'v' | 'g'; channel: 'recog' | 'colloc' | 'listen' | 'write' | null; ok: boolean };
export type RoundEnd = { day: string; act: 'review' | 'cards' | LearnAct; partial: boolean; n: number; right: number; activeMs: number;
  lessonAi?: boolean };
export function profilePatch(cur: Doc, answers: readonly AnswerEvent[], rounds: readonly RoundEnd[],
  ctx: { deviceId: string | null; seq: number; pflichtDay?: string | null; counts?: readonly CountEvent[];
         sprints?: readonly SprintEntry[]; pruneSeqBefore?: number }): Doc | null;
```

**Kanalzuordnung (`CountEvent`):**

| Übung | kind | channel |
|---|---|---|
| Grammatik `mc` | g | null |
| Grammatik sonst | g | write |
| Diktat | g | listen |
| Lückenjagd | v | colloc |
| Satzbau | g | null |

**Antwort:** `answers+1`, `vAnswers`/`gAnswers+1`, `days[day]+1`, XP +10 (richtig) bzw. +3, dazu `ema[channel]` und `ema.all` (α .12), `n[channel]+1`.

**Runde:** `act[day][act | act~]+1`, `minutes + clamp(round(min),1,30)`. XP-Bonus:

| Runde | Bonus |
|---|---|
| gram | n ≥ 8 → 20, sonst 5 |
| lesson | 25, +15 bei KI-geprüfter Produktion |
| Übungen | ok·12, +20 wenn alle richtig |
| Sprint | 10 + round(score/5) |

**Weitere Felder:**
- `sprints`: frisch lesen, anhängen `{t,score,ok,n,avgMs,combo}`, `.slice(-60)`.
- `pflicht:{[day]:1}`: nur, wenn noch nicht gesetzt.
- `lxSeq:{[tab]:seq}`, dazu `null` für Einträge mit `seq < now − 14 Tage`.

**Nie geschrieben:** `history`, `canDo`, `theme`, `lang`, unbekannte Felder. **Nie gekürzt:** `days`, `xpDays`, `act`, `minutes`, `pflicht`.

### 4.6 `app/radar.events` (Form der alten App)

`{c, s, t, q≤160, g≤100, a≤100}`. Quellen:

| s | Anlass | c |
|---|---|---|
| g | falsche Grammatikantwort (außer „Weiß ich nicht“) | `topicCat(topic)` |
| s | Sprint | `topicCat` bzw. `wordchoice` |
| w | Lektionsproduktion | `normCat(e.cat)` |
| v | Diktat-Tippfehler an einem Kartenwort | `spelling` |
| v | falscher Partner in der Lückenjagd | `wordchoice` |

Alle Formen kommen in der alten App vor (`cards.js:320f.`).

### 4.7 `app/course.done` (Daten-Entwurf §6.1)

```
transform('app/course', cur =>
  !cur ? {set:{done:{[lid]:E}, res:{}}}
  : invalid ? null
  : !cur.done?.[lid] ? {update:{done:{[lid]:E}}}
  : (cur.done[lid].t >= E.t || cur.done[lid].last?.t >= E.t) ? null
  : {update:{done:{[lid]:{last:E}}}})
E = {d: dayKey(Beginn), t, n, ok}
```

- `res` wird nie angefasst.
- Ein Abbruch mit ≥ 1 Antwort ergibt nur `act.lesson~` und Minuten.

### 4.8 `lesson/<lid>` (Format der alten App, Daten-Entwurf §6.2)

```json
{"v":1,"t":…,"words":[{"en","de","pos","def","ex"}×6],"dialogue":{"title","lines":[{"sp","en","de"}]≤14},
 "questions":[{"q","options","answer","lang","q_alt","options_alt","answer_alt"}]≤3,
 "tasks":[{"topic","type","prompt","answer","options","accepted","hint","expl","expl_en","src":"lesson"}]≤6,
 "output":{"de","en","mustUse"}|null,"lx":{"pv":"lesson-content@1","lang":"de"}}
```

**Schreiben** (`transform`):
- fehlt → `set`;
- mindestens ein Wort vorhanden → **nichts** (das Gespeicherte wird benutzt; l07/l08 bleiben unberührt);
- gültig, aber `words` leer oder fehlt → `update` nur der leeren Felder + `lx.regen`;
- ungültig → nie.

Aufgaben werden in `validG`-Form gespeichert (`hint`/`expl`/`expl_en`), nicht als `hint_de`. Alte Fragen ohne `lang` gelten als `de`. Die Grundfassung wird nie gespeichert.

### 4.9 `writing/lesson-<lid>-<ms>`

```json
{"id":"lesson-l07-1790497100000","t":…,"text":"…≤4000","words":84,"lesson":"l07",
 "res":{"cefr":"B2","scores":{"task","grammar","vocabulary","coherence","register"},"errors":[{"wrong","right","why","cat","sev":"minor|major"}]≤6,
        "cando":"met|partly|not","pv":"lesson-production@1"}}
```

### 4.10 `app/pool` und alle `daily/*` (Daten-Entwurf §8)

**Lesen:**
- In `ensureDay` Schritt 1, einmal je Tab und Lerntag: `readCollection('daily')` (`get`, kein Abo), jedes Dokument mit `validateDoc`.
- Verarbeitet werden nur `isDayKey(k) && k <= legacyDayKey(now)`.
- Genau 1.000 Treffer → `logError` und zusätzlich die letzten 30 Tage einzeln lesen.

**Offener Tag:** fehlt in `lxDaily`, anderer FNV-Hash oder `open > 0`. Die Tage werden vom ältesten an verarbeitet:
1. Wörter per `createIfMissing(newVocabDoc(... src:'coach', origin:{kind:'daily', ref}))`. Jede bekannte `id` wird ausgelassen.
2. Pool unter `acquire('app/pool',{holder:tab, ttlMs:15000})`, danach EIN `transform`:
   - fehlt → `set({items, t, lxDaily})`;
   - ungültig → nichts;
   - sonst:
     - **verdichten:** nur Aufgaben entfernen, deren Schlüssel im `seen` ihres Themas steht;
     - **ergänzen:** `validG`-gültige Aufgaben, deren Schlüssel weder im Pool noch in `seen` steht, als `{…, src:'daily', ref:'daily/<k>'}`;
     - **Obergrenze 90**, Unverbrauchtes wird **nie** verworfen (Rest = `open`);
     - `lxDaily[k] = {h, t, w, g, open, bad}` im selben Update.

**Aufgabenwahl:** Die Grammatikrunde nutzt außerdem die offenen `daily`-Aufgaben aus dem Speicher (`useDayInputs`, neueste Tage zuerst). So wird auch bei vollem Pool die Aufgabe des Tagesauftrags genutzt, ohne etwas zu schreiben.

**KI-Aufgaben:** „Neue Aufgaben“ schreibt per `poolIntake` (Platz nach dem Verdichten). Was nicht passt, lebt nur in der Runde (`logWarn`).

### 4.11 Schema-Ergänzungen (S0b, `src/data/schemas.ts`, alles `nullish`/`looseObject`, nichts verschärft)
- **`poolSchema`:** `lxDaily: record(str, looseObject({h,t,w,g,open,bad}).nullish())`; Eintrag + `ref`.
- **`grammarSchema.errors[]`:** + `src`, `box`, `due`, `done`, `last` (tolerant), `fsrs` (loose).
- **`lessonSchema`:** `questions[]` + `lang`, `q_alt`, `answer_alt`, `options_alt`; `lx` loose; `output` nullish.
- **`courseSchema.done[*]`:** + `last` loose.
- **`profileSchema`:** `sprints: array(looseObject({t,score,ok,n,avgMs,combo}))`; `lxSeq` Werte `num | null`.
- **`logSchema.entries[]`:** + `topic`, `src`, `lesson`, `ctx`.
- **`writingSchema.res`:** + `cando`, `pv`.

### 4.12 Kapazität
- **Neue Dokumente:** `writing/lesson-*` (höchstens 1 je geprüfter Abgabe) und `lesson/*` (höchstens 24). Sonst nur Karten aus Lektion oder Tagesauftrag. Die Diagnose warnt ab 4.000.
- **Größen:**

| Dokument | Grenze | etwa |
|---|---|---|
| pool | 90 Aufgaben | 48 KB |
| radar | 400 | 56 KB |
| log | 300 Einträge | ≤ 240 KiB |
| grammar | 40/10/80/20/10 | 6 KB |
| lesson | – | 8 KB |

- **WARNUNG:** `app/profile` wächst ohne Kürzung um 55–75 KB im Jahr. Die Diagnose zeigt die Größe und warnt ab 160 KiB; eine Auslagerung (nie Löschen) ist für Phase 7 einzuplanen.

---

## 5. Lerndesign je Übung

### 5.0 Gemeinsamer Rahmen (A7, Kap. 2.4)
- **Oben an fester Stelle:**
  - `StatusLine` aus Phase 1: Übungsart · Thema/Karte · Sicherheit (5 Punkte + Wort; bei Grammatik aus der Anzeige-p, bei Karten aus Stufe/FSRS);
  - Info-Symbol mit dem Zweck;
  - darunter die Aufgabe in **einer** Zeile (`task-line`).
  - Kein „Wozu“-Absatz, keine Quelle, keine Sekunden.
- **Keine Bewertungsknöpfe:**
  - Die Note (`learn/grade.ts`) ergibt sich aus Richtigkeit, Zeit (nur `performance.now()`, Pause bei offenem Nachschlagen und `document.hidden`) und Hilfe. Hilfe 1 → höchstens 3, Hilfe 2 → höchstens 2.
  - Grenzen „Gut“/„Leicht“: mc 8 s/–, gap 8 s/3 s (Zeit bis zum ersten Zeichen), transform/correct 20 s/8 s, Satzbau 9 s + 0,6 s je Baustein/–, Diktat 6 s ab Tonende/2,5 s, Lückenjagd 8 s/3 s.
  - Es gibt nur „Weiter“.
- **Nach dem Prüfen, immer an derselben Stelle, auch bei richtiger Antwort:**
  1. „Deine Antwort / Richtig“ als Wort-für-Wort-Vergleich (`SentenceDiff` über `align.ts`).
  2. Eine Zeile Form-Hinweis: `expl` in der Oberflächensprache; fehlt er oder hat er die falsche Sprache (`detectLang`), `rules.json` `core`.
  3. 2–3 Beispiele (`rules.json` forms/ex/`traps.good`, Kartenbeispiele).
  4. „Auch richtig“ (`accepted` + `rules.alts`).
  5. Jedes englische Wort über `EnglishText` antippbar.
- **Platzhalter** (`mask.ts`, einer je Buchstabe):
  - in Stufen mit Hilfe (Grammatik p < .40, Lückenjagd-Einstieg);
  - in freien Stufen deckt „Tipp“ sie auf (Hilfe 1), ein zweiter Tipp zeigt den ersten Buchstaben (Hilfe 2).
- **Prüfung** (`legacyNorm`-Äquivalenz + Phase-1-`toUS`):
  - `correct`;
  - `near`: Tippfehler im Budget, britische Form (Hinweis auf die US-Form, nie ein Fehler), Kurzform, Lemma-Form;
  - `wrong`.
  - Kurzformen (`'ve`, `n't`, `I'm`) werden allgemein aufgelöst, ohne `accepted`.
- **Rückmeldung** grün/gold/rot, kein Feuerwerk, keine Leben. Vor dem Prüfen steht die Lösung nirgends im DOM.

### 5.1 Kurs und Lektion (12 Min., Pflicht „Lektion“)
Can-Do (`cando_*` in der Oberflächensprache) steht am Anfang und am Ende.

1. **Wörter (3 Min.):**
   - 6 Zielwörter, je im Dialogsatz (Grundfassung: Kartenbeispiel oder ohne Satz).
   - Pro Wort Einführung + `mc_en`, danach ein Durchgang `cloze_hint` (Phase-1-Übungsansichten, `TrainCard` aus den Lektionswörtern).
   - Falsche Wörter kommen am Ende noch einmal.
   - Schreibweg D17; Log `k:'v'`, `m:'lesson'`, `ctx` duty/xtra.
2. **Dialog (3 Min.):**
   - Erst hören (Text verdeckt; ohne TTS sofort lesen) plus Gesamtsinn-Frage `questions[0]`.
   - Dann lesen mit antippbaren Wörtern und Übersetzung per Umschalter, 1–2 weitere Fragen.
   - Log `lesson-q`, Fragen in der Oberflächensprache über `q_alt`.
   - Grundfassung: „Beispiele“, 4–6 Sätze zur Zielstruktur, ohne Fragen.
3. **Grammatik (3 Min.):**
   - Regel als eine Zeile `core` + ein Gegensatzpaar (`traps[0]`).
   - 4 Aufgaben aus `lesson.tasks` (Grundfassung: Pool/Seed), höchstens 1 `mc`.
   - `GrammarItem` aus C, `src:'lesson'`, schreibt `grammar/<topic>`.
4. **Produktion (3 Min.):**
   - 2–3 Sätze zur Situation mit `mustUse` (≥ 2 Zielwörter + Zielstruktur). Beim Tippen werden die Wörter abgehakt.
   - Knopf „Prüfen lassen“ (`data-ai`) → `lesson-production@1` → `writing`-Dokument + Radar `w`.
   - Ohne KI: lokale Prüfung (`production.ts`: ≥ 2 `mustUse` in Grundform, ≥ 12 Wörter, Jaccard zum Mustertext < .8) + Mustertext.
   - Der Abschluss hängt nie von der KI ab.

**Abschluss:** `lessonDone` → `course.done`, Zusammenfassung mit Can-Do-Urteil (KI: met/partly/not; lokal: „Selbst prüfen am Mustertext“).

**Wiedereinstieg** über `lx:lesson:<lid>:step`.

### 5.2 Grammatik mit gedämpftem BKT
**Runde:** Pflicht 6 Aufgaben, frei 8.
- **Quellen in dieser Reihenfolge:**
  1. fällige Fehler (höchstens 3, bei Box ≥ 1 bevorzugt eine **Variante**: ungesehene Aufgabe gleichen Themas und Typs; sonst das Original);
  2. offene `daily`-Aufgaben;
  3. Pool;
  4. `lesson.tasks` erledigter Lektionen;
  5. `seedGrammar` (nicht in `seen`; notfalls auch Gesehenes, damit die Runde immer voll wird).
- **Themen:** schwächstes (Anzeige-p, `due ≤ jetzt`), Thema der nächsten Lektion (in der Pflichtrunde **nicht** das Thema der heutigen Lektion).
- **Verschachtelung:** ≥ 3 Themen, höchstens 2 gleiche hintereinander (Ausnahme: p < .35 beginnt mit 2 am Stück). Deterministisch per `hash32(tag|modus)`.

**Formen nach Beherrschung** (bevorzugt die schwächste Form des Themas):

| p | Formen |
|---|---|
| < .40 | mc, gap mit `(verb)`-Hinweis und Platzhaltern |
| .40–.70 | gap, transform |
| > .70 | correct, transform |

Die Übersetzung DE→EN entfällt in Phase 2 (braucht immer KI).

**Eingabe:**
- `gap`: kinetische Lücke im Satz.
- `transform`: Satzzeile wird Eingabezeile.
- `correct`: Satz mit Originaltext vorbefüllt, Bearbeitung an Ort und Stelle.
- Kein Eingabefeld unter dem Satz (Kap. 15).

**Themenblatt:** Sicherheit, Regelblatt (core/why/contrast/steps/forms/signals/traps/alts), fällige Fehler, „Neue Aufgaben zu {Thema}“ (`data-ai`, nur bei < 8 ungesehenen Aufgaben). Zahlen nur unter „Messwerte dahinter“.

**Anzeige der Beherrschung:** `p0 + (p − p0)·exp(−Tage/45)`.

### 5.3 Fehler-Wiederholung
Eintrittsweg „Deine Fehler“ im Grammatik-Bereich und automatisch als erste Aufgaben jeder Runde. Regeln nach §4.3 und D1. Übungen legen keine Fehlereinträge an (D12).

### 5.4 Diktat (Angebot, 8 Sätze ≈ 6 Min.)
- **Sätze:** 8–16 Wörter aus `vocab.ex` fälliger/bekannter Karten (ohne Klammern), Chunk-Äußerungen und Dialogzeilen der letzten 3 Lektionen. Überwiegend bekannter Wortschatz, höchstens 1 neues Wort.
- **Ablauf:** Der Satz spielt einmal automatisch. 2× nochmal hören ist frei, jedes weitere Mal oder langsam (0,8) ist Hilfe 1. Getippt wird der ganze Satz.
- **Wertung** (`dictation.ts`):
  - Normalisieren: `legacyNorm`, UK↔US in beide Richtungen, Zahl↔Wort (0–20, Zehner).
  - Ausrichtung pro Wort: ok/typo (Zeichen-Levenshtein im `typoBudget`)/missing/extra/wrong.
  - `score = 1 − (missing+extra+wrong+0,5·typo)/Wörter der Vorlage`.
  - ≥ .95 ohne Hilfe → correct, ≥ .80 → near, sonst wrong.
- **Rückmeldung:** markierter Vergleich, Satz noch einmal hören, verpasste Wörter antippbar (als Karte speichern über Wort-Antippen).
- Ohne Sprachausgabe ist der Knopf ausgeblendet, kein toter Knopf.

### 5.5 Lückenjagd (Kollokationen, Pflichtkanal möglich, 8 Lücken ≈ 5 Min.)
- **Material:** Emrahs Karten mit `col` und Kontextsatz (`TrainCard.col[].ctx`), Chunks mit Lückenwort, Lektionswörter. Machbar ab 8.
- **Abfrage:** freier Abruf des Partners in der kinetischen Lücke. „Tipp“ = Platzhalter (Hilfe 1), zweiter Tipp = erster Buchstabe (Hilfe 2).
- **Wertung:**
  - `near`: Tippfehler oder Lemma-Form (`made`→`make`).
  - `wrong`: falscher Partner, Kategorie `confusable`. Die Rückmeldung nennt, wozu er gehört („do → a task, business, a favor“), wenn er in den Kollokationen der Karte bzw. im Wörterbuch vorkommt.
- **Rückmeldung:** 2 Beispiele mit der Kollokation. Keine Karten-Schreibvorgänge (D12).

### 5.6 Satzbau (Pflichtkanal möglich, 6 Sätze ≈ 5 Min.)
- **Material:** 7–14 Bausteine aus `rules.json` (forms/ex/`traps.good`), eingesetzten Grammatik-Lösungen und Dialogzeilen.
  - Schwerpunkt: indirekte Frage, Stellung von Adverbien, Inversion, Passiv, Relativsatz.
  - Feste Wendungen bleiben ein Baustein (`domain/text/phrases`).
  - 1–2 Ablenker mit Grammatikbezug (`did`, `do`, `is`).
  - Die Mischung ist nie gleich der Lösung.
- **Eingabe:** Tiles-Engine aus Phase 1 (Tippen, Ziehen, Tastatur).
- **Wertung:** gegen alle gültigen Reihenfolgen (`accepted`); `near` = genau ein Baustein versetzt; Ablenker benutzt → `wrong`.
- **Rückmeldung:** falsch gesetzte Bausteine markiert, Form-Hinweis in einer Zeile + 2 Beispiele. Keine BKT-Schreibvorgänge (D12).

### 5.7 Sprint (Angebot, 90 s)
- **Material:** nur Bekanntes, verschachtelt (nie 2 gleiche Arten hintereinander):
  - Karten ab Stufe 3 (`mc_de`, `type`);
  - Themen mit p ≥ .50 (mc/gap);
  - Kollokationen (mc).
- **Ablauf:** Zeitbalken, Fehler beenden die Runde nicht, nur ein kurzer Farbimpuls. „Noch eine Runde“ ist frei.
- **Ende:** Liste aller Aufgaben; Fehler aufgeklappt mit Lösung, Zeile und Beispiel. Ruhige Tempozahl („14 richtige/Min., Wochenschnitt 11“).
- **Schreiben:** nur `sprints`, `act.sprint`, Radar `s`, kein FSRS/BKT, kein Log.

---

## 6. Tagesplan, Pflicht, pflichtSince

### 6.1 Plan (v1, nur additiv; phase1-plan E1)

```json
{"d":"2026-09-28","ids":["order","gram","sprint"],"why":[[["agoDaysN",4]],[["whyWeakest"]],[["agoNever"]]],"v":1,
 "duty":["review","lesson","ch:order"],"goal":{"review":22,"due":17,"new":5,"ahead":0,"ch":6},"lesson":"l07","at":…}
```

- `ids[0]` = Pflichtkanal ∈ {gram, cloze, order}; `ids[1..2]` = Angebote aus `EXECUTABLE_CHANNELS`.
- **Punktzahl** (`channels.ts`, Portierung von `channelNeed`, `today.js:198`):
  - `3·min(d,10)`, d = Lerntage seit `act[*][c | c~]`, nie = 14;
  - `+30·focus` (Mapping wie `today.js:210`);
  - `+14·thin` (`n[kanal] < 20`);
  - `+12·weakest` (`ema[kanal] ≤ min + .02`);
  - `+10·[gram ∧ fällige Fehler ≥ 3]`;
  - `−6·weekCount(c)`.
  - Kanal-Zuordnung: gram/order→write, cloze→colloc, dictate→listen, sprint→all.
- **why:** die ersten 2 Gründe (nur Schlüssel der alten App). Gleichstand entscheidet `hash32(tag|id)`.
- **Machbarkeit** (`feasible(c, data, env)`):
  - gram immer (Seed 48);
  - cloze ≥ 8 Kollokationen mit Kontext;
  - order ≥ 6 Sätze;
  - sprint ≥ 20 bekannte Elemente;
  - dictate: TTS bereit (nur für Angebote; beim Anzeigen erneut geprüft, sonst ausgeblendet).
- **Pflicht:** `review` wenn `target > 0`; `lesson` wenn eine offene Lektion existiert (`next.ts`, D18); `ch:<ids[0]>` immer.
- **Plan von heute ist unveränderlich:** Wird mitten am Tag ausgeliefert, bleibt der Phase-1-Plan bis 04:00. Die neue Pflicht gilt ab dem nächsten Lerntag (Test).

### 6.2 `deriveToday` v2 (die EINE Ableitung; Statuszeile, Zähler, Häkchen, Heldenkarte, Knopf)

```ts
export type DutyState = { id: DutyId; state: 'done' | 'open'; progress: { done: number; total: number } | null };
export type TodayState = { day: string; status: 'noPlan' | 'nothing' | 'open' | 'allDone';
  duties: { done: number; total: number; missing: DutyId[]; items: DutyState[] };
  review: { done: number; total: number }; extra: number; balance: { answers: number; correct: number; minutes: number } };
export function deriveToday(i: { day: string; plan: StoredPlan | null; entries: readonly DayEntry[]; minutes: number;
  pflichtMarked?: boolean; exhausted?: boolean; course: Doc | undefined; act: Doc | undefined;
  pending: { lessonDays: readonly string[]; rounds: ReadonlyArray<{ day: string; act: string; partial: boolean }> } }): TodayState;
```

- **review:** wie in Phase 1 (`k:'v'`, `ctx:'rev'`, verschiedene Karten, gedeckelt), mit Fortschritt.
- **lesson:** D10 (live ⊕ `pending.lessonDays`), ohne Fortschritt.
- **ch:** D9 (`act` live ⊕ `pending.rounds`), ohne Fortschrittszähler auf Heute. Den Rundenfortschritt zeigt nur der Trainer; kein zweiter Zähler, der widersprechen kann.
- **`pflichtMarked`:** alle Punkte gelten als erledigt.
- **Status:** `duty` leer → `nothing`.
- **Heute:**
  - Statuszeile „Noch nicht fertig · 1 von 3 · es fehlt: Lektion, Satzbau“.
  - Heldenkarte = erster offener Punkt.
  - Erledigtes als `li[data-state=done]` ohne bedienbares Kind.
  - Angebote (`ids.slice(1)`) erst bei `allDone`, mit ihrem Grund, als „Extra“.

### 6.3 `pflicht` und `pflichtSince` (verbindlich, Daten-Entwurf §7)

**Regel 1 – `pflicht[day] = 1`:** Wird nur gesetzt, nie 0, nie entfernt. Voraussetzung ist eigene Aktivität (`days[day] > 0 ∨ xpDays[day] > 0`, frischer Stand ⊕ Stapel) **und** eine dieser Bedingungen:
- (a) alle Punkte aus `plan.duty` erfüllt (review nach `deriveToday`, lesson nach D10, ch nach D9);
- (b) die Pflichtrunde „Wiederholen“ ist erschöpft und die übrigen Punkte sind erfüllt;
- (c) **`plan.duty` ist leer** (behebt B1/S3).

Ort: im Profil-`transform` des Sammel-Stapels (`pflichtFor`) und Selbstheilung in `ensureDay`. Die Punkte sind mit dem Tagesplan eingefroren.

```ts
export function pflichtFor(i: { day: string; plan: StoredPlan | null; profile: Doc; batchActivity: boolean;
  reviewDone: boolean; exhausted: boolean; course: Doc | undefined; pendingLessonDay: boolean }): boolean;
```

**Regel 2 – `pflichtSince`** (einmal je Datenbank, nur in `ensureDay`):
- **Voraussetzungen:**
  - `schema.version ≥ 1`;
  - ein v1-Plan von heute ist gespeichert (`d === dayKey(now)`);
  - dieser Build schreibt `pflicht` einschließlich Regel 1(c);
  - `dutiesFeasible(plan, {tts:false, ai:false})`.
- **Wert:** `max(legacyDayKey(now), dayKey(now), schema.cutover, größter Datumsschlüssel ≤ legacyDayKey(now) aus days ∪ xpDays ∪ minutes ∪ act ∪ pflicht)`. Behebt B2/S4.
- **Ablauf:**
  - `acquire('app/schema', {holder: tab, ttlMs: 5000})`; bei `{acquired:false}` erst beim nächsten `ensureDay`.
  - Dann `transform('app/schema', cur => !cur ? null : isDayKey(cur.pflichtSince) ? null : cur.pflichtSince != null ? (logError, null) : {update:{pflichtSince: wert}})`.
  - Danach nie wieder ändern.

```ts
export function pflichtSinceValue(i: { nowMs: number; cutover: string | null; profile: Doc }): string;
```

**Regel 3:** `computeStreak` bleibt unverändert (am Tag `pflichtSince` gilt alte Regel ∨ Pflicht).

**Regel 4 (Hinweis für Emrah):** Zwischen 0 und 4 Uhr zählt der Vortag; die Pflicht dauert jetzt etwa 27 Min.; ein Ruhetag je Woche.

### 6.4 `ensureDay` (Reihenfolge; jeder Schritt protokolliert und blockiert die folgenden nicht)
1. `dailyIntake`: Karten und Pool (§4.10); die offenen Aufgaben landen in `useDayInputs`.
2. Plan (§6.1): nur ohne v1-Plan von heute.
3. `pflichtSince` (§6.3).
4. Selbstheilung `pflicht[heute]`.

---

## 7. KI-Vorlagen (`src/prompts`, je Vorlage zod-Schema + `langOf`, alle über `askJson`)

| Vorlage | Tier | Cache | Eingabe (per `clip` gekürzt, < 60.000 B) | Ausgabe (zod) | Auslöser |
|---|---|---|---|---|---|
| `lesson-content@1` | default | `{gcTime: 86_400_000}` | Lektions-Metadaten (`id`, `level`, `grammar` + `rule_en` core/forms ≤ 1.500 Z., `cando_en`, `situation`, 6 `words`), uiLang, Verhältnis Beruf/Alltag | Format §4.8: `words[6]{en,de,pos,def,ex}` · `dialogue{title, lines[8–14]{sp,en≤220,de}}` · `questions[2–3]{q,options[4],answer∈options,lang=uiLang,q_alt,options_alt,answer_alt}` · `tasks[4–6]{topic=meta.grammar,type,prompt,answer,accepted[],options(mc: 4 inkl. answer)\|null,hint,expl(de),expl_en(en)}` · `output{de,en,mustUse[3–5]⊂words.en}`. **Refinements:** jedes Lemma im Dialog; Zielstruktur ≥ 3×; gap/mc genau ein `___`; Sprachprüfung je Feld | Knopf „Lektion vorbereiten“ (`data-ai`) beim Start ohne gespeicherten Inhalt, sonst Grundfassung |
| `grammar-items@1` | default | `false` | Thema (`name_en`, `rule_en`, `ex`), Anzeige-p, gewünschte Formen, ≤ 20 `seenText`, ≤ 5 echte Fehlersätze Emrahs zum Thema, Anzahl 6 | `items[6]{topic,type,prompt,answer,accepted[],options\|null,hint_de,explanation_de,explanation_en,src:'ai'}`, Pool-Format. **Pflichtzeile:** „Reject any item where a second option is also grammatical in some context.“ | Knopf „Neue Aufgaben zu {Thema}“ |
| `grammar-judge@1` | quick | `{gcTime: 86_400_000}` | Aufgabe, Lösung, `accepted`, Antwort (≤ 300), Thema, uiLang | `{verdict:'correct'\|'near'\|'wrong', acceptable:boolean, corrected, why(≤ 25 Wörter, uiLang)}`. **Refinement:** `acceptable ⇒ verdict ≠ 'wrong'` | D13 („Prüfen“, freie Formen) |
| `lesson-production@1` | default | `true` | Aufgabe EN, `mustUse`, Zielstruktur, Text (≤ 1.200), `cando_en`, uiLang | `{cefr, scores{task,grammar,vocabulary,coherence,register 0–100}, errors[≤6]{wrong,right,why(uiLang),cat,sev:'minor'\|'major'}, upgrades[≤3]{orig,better,why}, mustUsed[]⊂mustUse, structureUsed, cando:'met'\|'partly'\|'not', candoWhy(uiLang), model(EN)}`. „Judge only from the text given; if too short, answer `partly`, never invent evidence.“ | Knopf „Prüfen lassen“ |

**Für alle Vorlagen:**
- Lerninhalte in US-Schreibweise, britische Formen in `accepted`. Keine Fakten über Emrahs Firma („a German DMS/ECM cloud vendor“, erfundene Namen).
- Kein eigener Timeout (A6.2): „Denkt nach …“ → „dauert länger“ + Stopp.
- Neuversuch nur bei Schemafehler, genau einmal, mit Fehlerbeschreibung (A6.3).
- `rate_limited` → Hinweis, keine Wiederholung. `not_granted` & Co. blenden jedes `data-ai` aus.
- Beim Anzeigen: falsche Sprache → Rückfall auf `rules.json` statt gemischt.
- Keine Vorlage für Diktat, Satzbau, Sprint oder Lückenjagd.
- **learning-scientist** prüft die 4 Vorlagen und D13 einmal.

---

## 8. Texte (i18n)

Neue Teile `learnhub`, `course`, `grammar`, `drills` (je `.de.ts`/`.en.ts`); `today` wird ergänzt. Englisch in US-Schreibweise. Inhalte in der Oberflächensprache (`name`/`name_en`, `cando_de`/`cando_en`, `expl`/`expl_en`, `q`/`q_alt`).

| Schlüssel | DE | EN |
|---|---|---|
| `tabLearn` | Lernen | Learn |
| `lhCourse` · `lhGrammar` · `lhDrills` | Kurs · Grammatik · Übungen | Course · Grammar · Practice |
| `lsGoal` | Ziel: {cando} | Goal: {cando} |
| `lsStepWords`/`Dialog`/`Grammar`/`Output` | Wörter · Dialog · Grammatik · Anwenden | Words · Dialogue · Grammar · Apply |
| `lsExamples` | Beispiele | Examples |
| `lsPrepare` | Lektion vorbereiten | Prepare lesson |
| `lsBase` | Grundfassung ohne KI | Basic version without AI |
| `lsCheckAi` | Prüfen lassen | Get feedback |
| `lsMustUse` | Verwende: {list} | Use: {list} |
| `lsCandoMet`/`Partly`/`Not` | Ziel erreicht / teilweise / noch nicht | Goal met / partly / not yet |
| `grRule` | Regel | Rule |
| `grAlsoRight` | Auch richtig | Also correct |
| `grYourAnswer` · `grCorrect` | Deine Antwort · Richtig | Your answer · Correct |
| `grDontKnow` | Weiß ich nicht | I don't know |
| `grTip` | Tipp | Hint |
| `grNew` | Neue Aufgaben zu {topic} | New exercises on {topic} |
| `grErrors` | Deine Fehler · {n} fällig | Your mistakes · {n} due |
| `grUnsure` | Nicht sicher prüfbar – zählt nicht gegen dich | Can't check this for sure – it won't count against you |
| `grRaw` | Messwerte dahinter | The numbers behind it |
| `certainty0..5` | neu · wackelig · im Aufbau · solide · sicher · gefestigt | new · shaky · building · solid · confident · mastered |
| `drDictate` · `drCloze` · `drOrder` · `drSprint` | Diktat · Lückenjagd · Satzbau · Sprint | Dictation · Collocation hunt · Sentence builder · Sprint |
| `drReplay` · `drSlow` | Nochmal hören · Langsam | Play again · Slower |
| `drTempo` | {n} richtige/Min. · Wochenschnitt {avg} | {n} correct/min · weekly average {avg} |
| `tdDutyLesson` | Lektion: {title} · etwa 12 Min. | Lesson: {title} · about 12 min |
| `tdDutyCh` | {channel} · etwa {min} Min. | {channel} · about {min} min |
| `tdExtra` | Extra – zählt nicht zum Tagesziel | Extra – doesn't count toward today's goal |
| `whyFocus`/`whyThin`/`whyWeakest`/`whyDue`/`agoNever`/`agoDaysN` | Texte der alten App (`i18n.js:398ff.`) | ebenso |
| `purpose*` (Info-Symbol je Übung) | je ein Satz „Wozu“ | one sentence each |

Der i18n-Test prüft: gleiche Schlüssel in DE und EN, keine Platzhalter-Lücken, EN ohne britische Schreibweise.

---

## 9. Testplan (Kap. 12; `TZ=Europe/Berlin`; Zeitpunkte 10:00, 23:59, 00:30, 03:59, 04:00, Sommerzeitwechsel)

### 9.1 Unit (Vitest)

**Schlüssel und BKT (A)**
- `key.test`: 10 erfundene Prompts (Apostroph, n't, Anführungszeichen) gegen die Referenzausgabe der alten App.
- B-01: |Δ| ≤ .06, mit Hilfe ≤ .03.
- B-02: Tagesanker ±.12; eine Antwort um 03:30 zählt zum Vortag.
- B-03: p ∈ [.02, .99].
- B-04: Δ(mc mit 4 Optionen) < Δ(gap).
- B-05: Anzeige mit p = .9, p0 = .4, 45 Tagen = .584 ± .001.
- B-06: `due` bei p = .5 +6 Tage, falsch +1, immer in [1, 21].
- B-07: Kurzformen ohne `accepted` richtig.
- B-08: keine KI → `near`, p sinkt nicht.

**Fehler-Boxen (A)**
- E-01: falsch → +1, dann +3, +9, dann `done`.
- E-02: falsch in Box 2 → Box 0.
- E-03: Kappung, erledigte zuerst.
- E-04: dieselbe `q` nur einmal.
- E-05: Variante ab Box 1.
- E-06: alter Eintrag ohne `box` wird gelesen und beim Wiederholen ergänzt.
- E-07: FSRS-Schatten steuert `due` nicht; Uhr-Klemme.

**`grammarWrite` (A)**
- fehlt → create;
- unbekanntes Thema, ungültig, `already_applied`, `stale` → skip;
- Deckel 40/10/80/20/10;
- unbekannte Felder bleiben.

**`tasks` und `check` (A)**
- Normalisierung seed/daily/pool/lesson;
- Auswahl deterministisch, Verschachtelung;
- UK→US als `near` mit Hinweis;
- `correct` mit Wort-Diff; `align.test` (fehlend, zu viel, ersetzt, vertauscht, Tippfehler).

**Radar und Pool (A)**
- `radar.test`: 400, Dedupe, 240 KiB.
- `pool.test`:
  - voller Pool (90) → keine Verdrängung, `open` stimmt;
  - Hash-Änderung;
  - Tag in der Zukunft;
  - ungültiges daily bzw. ungültiger Pool.

**Diktat (D)**
- D-01: „We have been working on the migration since March.“ gegen „we been working on migration since march“ → fehlend: have, the; score .78; `wrong`.
- D-02: Tippfehler.
- D-03: „We've“ = „We have“.
- D-04: travelled ↔ traveled beidseitig.
- D-05: 20 = twenty.

**Lückenjagd (D)**
- C-01: `do` statt `make` → `confusable` mit Partnern.
- C-02: `made` → `near`.
- C-03: nach Tipp Note ≤ 3, nach zweitem Tipp ≤ 2.

**Satzbau (D)**
- S-01: zwei gültige Reihenfolgen.
- S-02: 1.000 Mischungen nie gleich der Lösung.
- S-03: Ablenker → `wrong`.
- S-04: ein versetzter Baustein → `near`.

**Sprint (D)**
- R-01: keine Änderung an `vocab/*`/`grammar/*` (Spion).
- R-02: 10 Fehler beenden die Runde nicht.
- R-03: `sprints` ≤ 60.
- R-04: nur Stufe ≥ 3 und p ≥ .5.

**Kurs (B)**
- K-01: Wiedereinstieg im selben Schritt.
- K-02: `course.done` einmal; eine Wiederholung schreibt nur `last`.
- K-04: ≥ `min(2, newPerDay)` andere neue Karten im Wiederholen (E, `queue.ts`).
- K-05: jede Lektionskarte hat den Dialogsatz als `ex`.
- `baseLesson.test`: alle 24 Lektionen ohne KI vollständig, je ≥ 4 Aufgaben.
- `lessonDoc.test`: Seed l01–l08, Fragen ohne `lang`, `q_alt`, `output:null`.
- `lessonWrite.test`: Fälle nach §4.8.

**Plan (E)**
- P-01: 50× neu zeichnen → gleiche `ids`/`why`.
- P-02: jede Zeile hat einen Grund.
- P-03: Pflichtkanal ∈ {gram, cloze, order}, nie `vocab`, `dictate` oder `sprint`.
- P-04: Wochenstrafe.
- P-05: Simulation über 14 Lerntage: jeder machbare Pflichtkanal mindestens 1×, keiner öfter als 3× je Woche, solange es Alternativen gibt.
- P-06: Pflicht-Minuten ≤ 30.
- P-07 (Widerspruchstest): alle 2³ Zustände von review/lesson/ch × live/Puffer; Statuszeile, Zähler, `missing`, Häkchen und Heldenziel stimmen überein; `xtra` und Einträge ohne `ctx` zählen nie.
- Der Plan von heute bleibt nach einem Update gleich.
- Ein Altplan mit `ids[0]='sprint'` wird nicht übernommen.

**Pflicht und Serie (E)**
- `pflichtFor`: Fälle (a), (b), (c); ohne Aktivität nie.
- `pflichtSinceValue`: S4 (Uhr geht nach), Aktivtag, 00:30, nie rückwirkend.
- Serie: S2 und S3 als Regressionstests; Tag mit `duty:[]` + Übung zählt.
- `profilePatch` v2:
  - `gAnswers`, act-Schlüssel + `~`, ema/n-Zuordnung;
  - `sprints` ≤ 60;
  - `lxSeq`: gleiche `seq` → nichts; **W1: Wiederholung mit derselben `seq` wirkt einmal**; Kappung auf `null`.

**Warteschlange (S0b/E)**
- `persist.test`:
  - gescheiterter Stapel blockiert Folgestapel und behält seine `seq`;
  - zwei Tab-Kennungen verwerfen einander nie;
  - Pflicht wird sofort gespeichert.

**Prompts (A/B)**
- Kopfzeile; das Beispiel besteht das Schema; falsche Sprache → Schemafehler.
- U-06: `answer ∉ options` wird abgelehnt.
- Maximale Eingaben < 60.000 B.
- „Kein Prompt-Text in `features/`“ (U-PROMPT-06 erweitert).

**Sprachtest (F)**
- Über `lesson/*`, `daily/*`, `app/pool`, `seedGrammar`: Anzeige nie gemischt, Rückfall auf `rules.json`.

### 9.2 Integration (Speicher-Datenbank, zwei Writer = zwei Tabs)
- 2× `ensureDay` → identischer Stand.
- Zwei Tabs verarbeiten `daily` gleichzeitig → keine doppelten Karten oder Aufgaben.
- Zwei Tabs setzen `pflichtSince` → genau ein Wert, nie früher als der letzte Aktivtag.
- **No-Loss-Test Phase 2** auf dem Seed: ein simulierter Tag mit allen Aktivitäten, zweimal ausgeführt.
  - Jedes vorherige Blatt ist noch da (außer in den dokumentierten Deckeln).
  - Anzahlen ≥ vorher, Serie ≥ vorher.
  - `daily/*` und `feed/*` bytegleich.
  - Kein `delete`, kein `set` auf ein bestehendes Dokument (Spion).

### 9.3 E2E (Playwright gegen `dist/index.html`, Adapter von außen)
- **Jeder neue Bildschirm:** 390/1440/2560 px × 3 Modi × DE/EN. Keine JS-Fehler, kein `undefined`/`NaN`/`{0}`, kein Querscrollen, axe.
- **`course.spec`:**
  - l01–l06 erledigt;
  - l07 mit gespeichertem Inhalt vollständig → `course.done.l07`, Pflichtpunkt erledigt;
  - l09 mit `?fake=nosample` über die Grundfassung vollständig;
  - `lesson-prepare` → `lesson/l09` gespeichert;
  - nach Neuladen im selben Schritt.
- **`grammar.spec`:**
  - Runde mit allen 4 Typen;
  - falsch → `sentence-diff` + Form-Hinweis + ≥ 2 Beispiele (U-02, auch bei richtig);
  - KI-Urteil `acceptable`;
  - Fehler nach +1 Tag (Testuhr) in der Wiederholung;
  - Regelblatt-Wörter antippbar.
- **`drills.spec`:** je Übung eine Runde; Diktat mit nachgebildeter Sprachausgabe; Lückenjagd: Buchstaben landen in der Lücke, Platzhalter; Satzbau: Tippen **und** Ziehen; Sprint bis zum Ende.
- **`today-duties.spec`:**
  - Widerspruchstest in 0/1/2/3 von 3;
  - erledigte Punkte ohne bedienbares Kind;
  - Wechsel um 04:00;
  - Plan von heute bleibt nach dem Update gleich (vorbereiteter Phase-1-Plan im Seed).
- **U-01:** in keiner Übungsart ein Notenknopf.
- **U-03:** `task-line` an gleicher Position.
- **U-04:** Lösung vor dem Prüfen nicht im DOM.
- **Plattform:** `nodb`/`nosample` → kein Absturz, `data-ai` ausgeblendet; `check:platform` grün.

### 9.4 DOM-Vertrag (Ergänzung zu phase1-plan §5.1)

| Bereich | Testkennungen |
|---|---|
| Rahmen | `tab-learn`, `learn-hub`, `status-line` (`data-p`, `data-kind`), `task-line`, `purpose-info` |
| Kurs | `course`, `unit[data-unit]`, `lesson-row[data-lesson][data-state=done\|open\|next]`, `lesson-prepare[data-ai]` |
| Lektion | `lesson`, `lesson-step[data-step]`, `lesson-next`, `dialog-line`, `lesson-question`, `output-input`, `output-check[data-ai]`, `must-use[data-used]`, `model-text` |
| Grammatik | `grammar`, `topic[data-topic][data-p]`, `rule-sheet`, `gr-item[data-type][data-topic]`, `sentence-diff`, `form-hint`, `examples`, `also-right`, `gr-judge-phase`, `gr-generate[data-ai]`, `gr-errors` |
| Übungen | `drill[data-kind]`, `drill-replay`, `tile`, `sprint-timer[data-left-ms]`, `sprint-summary` |
| Heute | `duty[data-duty][data-state]`, `offer[data-channel]`, `offer-why` |

### 9.5 Seed (F, deterministisch, Stichtag 20.09.2026)
- Pool mit 90 Einträgen, davon 4 gesehen;
- ≥ 8 `daily`-Tage mit Lücken, darunter einer ungültig, einer in der Zukunft, einer mit `newWords`;
- Grammatikfehler in alter Form ohne `box`;
- Lektionsfragen ohne `lang`; l07/l08 vorab erzeugt, nicht erledigt;
- Log-Einträge `type` cloze/dictate/order/lesson-q; `act.lesson~`;
- Karten mit `col` + Kontext ≥ 12; Profil mit `sprints`.

Die festen Antworten für alle 4 Vorlagen enthalten auch je eine mit falscher Sprache (für den Neuversuch).

---

## 10. Arbeitspakete

### 10.1 S0a – Typen (Lead, **sofort**, eine neue Datei `src/domain/learn/types.ts`, danach nur Lead)

```ts
import type { Grade, Lang } from '../srs/types';
export type Ctx = 'rev' | 'duty' | 'xtra';
export type LearnAct = 'lesson' | 'gram' | 'dictate' | 'cloze' | 'order' | 'sprint';
export type ChannelId = 'gram' | 'vocab' | 'sprint' | 'dictate' | 'cloze' | 'order' | 'listen' | 'read' | 'write' | 'speak' | 'discover';
export type ExecChannel = 'gram' | 'vocab' | 'sprint' | 'dictate' | 'cloze' | 'order';
export type DutyChannel = 'gram' | 'cloze' | 'order';
export type Verdict = 'correct' | 'near' | 'wrong';
export type GrammarTaskType = 'mc' | 'gap' | 'transform' | 'correct';
export type TaskSrc = 'seed' | 'daily' | 'pool' | 'lesson' | 'ai' | 'review';
export type GrammarTask = { key: string; topic: string; type: GrammarTaskType; prompt: string; answer: string; accepted: string[];
  options: string[] | null; hint: string | null; expl: { de: string | null; en: string | null };
  src: TaskSrc; ref: string | null; errorT: number | null };
export type Help = { level: 0 | 1 | 2; replays?: number };
export type WordOp = { op: 'eq' | 'typo' | 'sub' | 'ins' | 'del'; given?: string; expected?: string };
export type GrammarCheck = { verdict: Verdict; kind?: 'typo' | 'uk' | 'contraction' | 'alt' | 'form'; us?: string;
  ops: WordOp[]; needsJudge: boolean };
export type Timing = { submitMs: number; firstKeyMs?: number; units?: number; replays?: number };
export type GrammarAnswer = { kind: 'g'; t: number; day: string; lang: Lang; ctx: Ctx; task: GrammarTask; given: string;
  dontKnow: boolean; verdict: Verdict; grade: Grade; ms: number; help: Help; judged: 'local' | 'ai' | 'noai' };
export type RadarEvent = { c: string; s: 'g' | 's' | 'w' | 'v'; t: number; q: string; g: string; a: string };
export type DrillAnswer = { kind: 'x'; t: number; day: string; lang: Lang; ctx: Ctx; type: 'dictate' | 'cloze' | 'order' | 'lesson-q';
  q: string; given: string; ans: string; verdict: Verdict; grade: Grade; ms: number; lesson?: string; radar?: RadarEvent };
export type SprintEntry = { t: number; score: number; ok: number; n: number; avgMs: number; combo: number };
export type LearnRoundEnd = { day: string; act: LearnAct; ctx: Ctx; partial: boolean; n: number; right: number; activeMs: number;
  sprint?: SprintEntry; lessonAi?: boolean };
export type LessonDone = { lid: string; day: string; t: number; n: number; ok: number };
export type LessonMeta = { id: string; unit: string; kind: string; grammar: string; level: string; de: string; en: string;
  cando_de: string; cando_en: string; situation: string; words: Array<[en: string, de: string]> };
export type LessonContent = { words: Array<{ en: string; de: string; pos: string; def: string; ex: string }>;
  dialogue: { title: string; lines: Array<{ sp: string; en: string; de: string }> };
  questions: Array<{ q: string; options: string[]; answer: string }>;   // bereits in uiLang aufgelöst
  tasks: GrammarTask[]; output: { de: string; en: string; mustUse: string[] } | null; source: 'db' | 'ai' | 'base' };
export type GrammarItemProps = { task: GrammarTask; ctx: Ctx; p: number; onDone(a: GrammarAnswer): void };
/** Aufzeichnung (implementiert in features/progress/persist.ts, genutzt von B, C, D). */
export interface LearnRecorder {
  grammar(a: GrammarAnswer): Promise<boolean>;   // grammar/<topic> sofort + Log/Zähler/Radar in den Puffer
  drill(a: DrillAnswer): void;                   // Puffer (Sprint-Antworten nicht)
  radar(e: readonly RadarEvent[]): void;
  roundEnd(r: LearnRoundEnd): Promise<boolean>;  // act, Minuten, sprints; sofort speichern
  lessonDone(d: LessonDone): Promise<boolean>;   // app/course im Sammel-Stapel, sofort
}
```

Dazu feste Signaturen (Rümpfe bauen die Pakete):
- `alignWords(given: string, expected: string, opt?: { typo?: (a: string, b: string) => boolean }): WordOp[]`
- `learnGrade(kind: GrammarTaskType | 'dictate' | 'cloze' | 'order', verdict: Verdict, timing: Timing, help: Help): Grade`

### 10.2 Pakete

| Paket | Welle | Dateien (exklusiv) | Liefert | Hängt ab von |
|---|---|---|---|---|
| **A – Grammatik-Domäne + Grammatik-Vorlagen** | W1 | `src/domain/grammar/*`, `src/domain/answer/align.ts`, `src/domain/learn/grade.ts`, `src/prompts/{grammarItems,grammarJudge}.ts`, `tests/unit/{key,bkt,errors,grammarWrite,tasks,grammarCheck,align,radar,pool,learnGrade,promptsGrammar}.test.ts` | `legacyNorm`, `legacyTaskKey`; `bktStep`, `displayP`, `nextDue`, `certainty(p): {dots:0..5; word:0..5}`; `addError`, `reviewError`, `dueErrors`; `normalizeTask(raw, src, ref)`, `selectRound(i: {mode, topics, grammarDocs, pool, dailyOpen, lessonTasks, lessonTopicToday, nowMs, size, seed})`; `checkGrammar(task, given, deps)`; `ruleOf`, `formHint`, `examplesFor`; `grammarWrite(cur, a, nowMs)`; `mergeRadar`, `topicCat`, `normCat`; `poolIntake`, `compactPool`; 2 Vorlagen | S0a; Phase-1-Domäne nur per Import (`toUS`, `typoBudget`, `reviewFsrs`) |
| **B1 – Kurs-Domäne + Lektions-Vorlagen** | W1 | `src/domain/course/*`, `src/prompts/{lessonContent,lessonProduction}.ts`, `tests/unit/{catalog,next,baseLesson,lessonDoc,courseDone,production,promptsLesson}.test.ts` | `catalog()`, `pickLesson({course, assess, lang}) → {lid, why} \| null`, `baseLesson(meta, deps) → LessonContent`, `readLesson(doc, lang) → LessonContent \| null`, `lessonWrite(cur, out, nowMs)`, `courseDone(cur, e)`, `localProductionCheck(text, mustUse, model)`; 2 Vorlagen | S0a, A (Import `normalizeTask`) |
| **D1 – Übungs-Domäne** | W1 | `src/domain/drills/*`, `tests/unit/{dictation,cloze,order,sprint,drillSources}.test.ts` | `sentencePool`, `scoreDictation`, `buildCloze`/`checkCloze`, `buildOrder`/`checkOrder`, `buildSprintDeck`/`sprintScore` | S0a, `align.ts` (A, Signatur fest) |
| **E1 – Plan-/Pflicht-Domäne (neue Dateien)** | W1 | `src/domain/plan/{channels,pflicht,dailyIntake}.ts`, `tests/unit/{channels,pflicht,pflichtSince,dailyIntake,planSim}.test.ts` | `CHANNELS`, `feasible`, `rankChannels`, `pflichtFor`, `pflichtSinceValue`, `dutiesFeasible`, `dailyIntake` | S0a |
| **S0b – Vertragsstand 2 (Lead, allein)** | **nach Merge** | `src/data/{schemas,reads,writer}.ts`, `src/platform/storage.ts`, `src/domain/srs/types.ts`, `src/domain/srs/newCard.ts` (nur `kind`), `src/features/progress/persist.ts` (Umzug + D6/D7), `src/features/vocab/persist.ts`, `src/prompts/registry.ts`, `src/app/nav.ts`, `src/features/learn/LearnHub.tsx` (Gerüst), `src/i18n/{de,en}.ts` + leere Teile | §4.11, `readCollection`, `writer.acquire`, `session`, `ctx:'duty'`, `LearnRecorder`-Rumpf, Routen, Registry-Einträge, DOM-Vertrag §9.4. **Abnahme:** `npm run verify` grün, kein Verhalten geändert | Merge des Trainer-Umbaus |
| **B2 – Kurs-Oberfläche** | W2 | `src/features/course/*`, `src/i18n/parts/course.*` | Kurs-/Lektionsbildschirm, `lessonMachine`, Schritte | S0b; `GrammarItem` (C) über `GrammarItemProps` |
| **C – Grammatik-Oberfläche** | W2 | `src/features/grammar/*`, `src/engine/SentenceDiff.tsx`, `src/i18n/parts/grammar.*` | Themenliste mit `StatusLine`, Regelblatt, Runde (`itemMachine`), `GrammarItem`, „Auch richtig“, Urteil, „Neue Aufgaben“ | S0b, A |
| **D2 – Übungs-Oberfläche** | W2 | `src/features/drills/*`, `src/i18n/parts/drills.*` | 4 Übungsbildschirme, `drillMachine`, `sprintMachine` | S0b, D1, Phase-1-Engine (KineticGap, Tiles, EnglishText, speech, mask) |
| **E2 – Heute, Plan, Aufzeichnung** | W2 | `src/domain/plan/{types,buildPlan}.ts`, `src/domain/progress/*`, `src/domain/srs/queue.ts` (nur D17), `src/features/progress/persist.ts` (ab S0b), `src/features/today/*`, `src/i18n/parts/{today,learnhub}.*`, Tests `{buildPlan,dayState,profilePatch,persist,queueLesson}` | `buildPlan` v2, `deriveToday` v2, `ensureDay` (§6.4), `LearnRecorder`, Heute mit 3 Pflichtpunkten und Angeboten | S0b, E1, A (radar), B1 (`pickLesson`, `courseDone`) |
| **F – Testdaten, Adapter, E2E** | W2 | `scripts/generate-seed.mjs`, `seed/sample-data.json`, `src/platform/dev/cannedReplies.ts`, `tests/e2e/{course,grammar,drills,today-duties}.spec.ts`, `tests/support/*`, `tests/unit/{language,noLoss2}.test.ts` | §9.3–9.5 | S0b (DOM-Vertrag) |
| **INT – Integration (Lead)** | zuletzt | `src/app/App.tsx`, `LearnHub.tsx` (Verdrahtung), `docs/datenmodell.md` | Routen, Reiter, E2E grün, `npm run verify` | alle |

### 10.3 Regeln
- Ein Paket ändert nur seine Dateien. Braucht es eine feste Datei (`learn/types.ts`, `srs/types.ts`, `schemas.ts`, `writer.ts`, `reads.ts`, `registry.ts`, `de.ts`/`en.ts`), meldet es das dem Lead.
- W1-Pakete legen **nur neue Dateien** an und berühren keine Datei, die der Trainer-Umbau gerade ändert.
- Jedes Paket endet mit `npm run typecheck && npm run lint && npm test` grün und einem Commit „Phase 2 · X: …“.
- `dist/index.html` wird erst bei der Auslieferung committet.

### 10.4 Reihenfolge

```
S0a ─► A, B1, D1, E1 (parallel, sofort) ───────────────┐
Trainer-Umbau (Phase 1) ─► Merge ─► S0b ─► B2, C, D2, E2, F (parallel) ─► INT ─► Prüfer (je 1 Runde + 1 Nachprüfung) ─► Commit „Phase 2: Lernen“ ─► main ─► Test-Artefakt ─► Produktiv
```

**Prüfer:**
- learning-scientist: Übungen §5, D1, D3, D4, D13, 4 Vorlagen.
- data-guard: §4, D6/D7 (`lxSeq`-Nullen), `lxDaily`, `writing/lesson-*`.
- ux-reviewer: `screens-phase2`.
- platform-guard und qa-runner.

---

## 11. Risiken

| # | Risiko | Gegenmaßnahme |
|---|---|---|
| R1 | Phase 1 setzt `pflichtSince` mit den fehlerhaften Regeln (B1/B2), bevor Phase 2 kommt | Sofortmaßnahme §0; Regressionstests S2–S4 schon in Phase 1 |
| R2 | Phase-1-Bausteine (StatusLine, Tiles, EnglishText, autoGrade) ändern sich noch | W2 startet erst nach dem Merge; W1 nur neue Dateien; Anpassung der Props in S0b |
| R3 | Pflicht unerfüllbar → Serie reißt | D3, D11, Eigenschaftstest „Pflicht immer erfüllbar“ (200 Datenstände), `pflichtSince` nur bei `dutiesFeasible`, Regel 1(c) |
| R4 | Update mitten am Tag ändert den heutigen Plan | Plan unveränderlich; E2E mit vorbereitetem Phase-1-Plan |
| R5 | Doppel- oder Fehlzählung bei Wiederholung oder in zwei Tabs | D5–D7, Tests W1, zwei Writer im Integrationstest |
| R6 | Pflicht wird strenger (≈ 27 Min.) | Drei-Satz-Bericht an Emrah: Pflicht, Ruhetag, „nachts zählt der Vortag“ (W6) |
| R7 | KI-Inhalt in falscher Sprache, mehrdeutige Aufgaben | zod + `langOf`, ein Neuversuch (A6.3), Rückfall auf `rules.json`, Pflichtzeile in `grammar-items@1`, „Auch richtig“ + Urteil |
| R8 | Zustimmungsdialog mitten in der Runde | KI nur nach Knopf bzw. „Prüfen“ (D13); ohne Zustimmung `near` |
| R9 | Profil- und Pool-Wachstum | Diagnose (Profil ab 160 KiB, Dokumente ab 4.000), Pool ≤ 90 ohne Verwerfen, `lxSeq`-Nullen; Auslagerung in Phase 7 |
| R10 | Rückweg zur alten App | Nur Altformen (Fehlerform, `validG`, why-Schlüssel, Log-Typen); `lxDaily` geht beim `set` der alten App verloren – folgenlos (Dedupe); vorher Datenbank sichern |
| R11 | Safari-Eigenheiten (TTS, Tastatur) nicht automatisch testbar | Diktat nur als Angebot; Prüfliste am iPhone im Drei-Satz-Bericht |
| R12 | `acquire` gibt es in der Test-Datenbank nicht | F ergänzt `memoryDb.acquire` (Lease-Simulation); Unit-Test |

---

## Anhang: Prüfliste gegen Kapitel 3

| Punkt | Stand | Fundstelle |
|---|---|---|
| Eine `dist/index.html` ≤ 16 MB, alles eingebettet | ✅ | Keine neuen Assets außer vorhandenem JSON; `check:platform` bleibt Tor |
| Kein Server, kein fremdes `fetch` | ✅ | KI nur über `ai/gate.ts`, Daten nur über `writer`/`live`/`reads` |
| Jeder `db`/`sample`-Zugriff über `/src/platform` | ✅ | `readCollection`, `acquire` in `src/data` über den Platform-Db; ESLint A8 |
| `claude.use` darf `null` liefern | ✅ | D3, D11, `data-ai` ausgeblendet, E2E `nodb`/`nosample` |
| `sample` gedächtnislos, ≤ 64 KiB | ✅ | §7, Budget 60.000 B, Test mit maximalen Eingaben |
| Fehlercodes, kein Timeout, Wiederholung nur nach A6.3 | ✅ | §7; `acquire` ohne Schleife (§4.1) |
| `onSnapshot` einmal je Abfrage, ≤ 64 Abos | ✅ | D16: kein neues Abo (8) |
| Schreiben nur bei Änderung, eine Operation je Dokument, `update` nur auf Bestehendes | ✅ | §4.1/4.2, Writer-Warteschlange je Pfad, `patchIsNoop` |
| 256 KiB / 5.000 Dokumente | ✅ | §4.12 |
| Lernfortschritt nur in `db` | ✅ | lokal nur Schritt, Entwurf, Tab-Kennung |
| Entwicklungs-Adapter ausgeschlossen | ✅ | nur `platform/dev/*` ergänzt |
| Keine leeren `catch`, Fehler in der Diagnose | ✅ | ESLint; alle Schreibwege mit `logError`/`logWarn` |
| Kein Prompt-Text in Oberflächen-Dateien | ✅ | 4 Vorlagen in `src/prompts`, U-PROMPT-06 |
| Optimistisch mit Rückrollen, Skelette | ✅ | Puffer (live ⊕ pending) + „Erneut speichern“; Skelette für Kurs, Themen, Heute |
| Stack 3.2 | ✅ | XState (4 Maschinen), zustand, ts-fsrs (Fehler-Schatten), zod, Framer Motion, Tailwind, singlefile |
=====================================================================

## Zusammenfassung (15 Zeilen)
1. Ich konnte nicht schreiben (nur Lese-Werkzeuge). Der vollständige Plan oben gehört nach `/home/user/lingo-engine-x/docs/phase2-plan.md`.
2. Sofortmaßnahme: Die ALARM-Regeln B1/B2 zu `pflicht` und `pflichtSince` müssen schon in den laufenden Phase-1-Bau. Sonst darf Phase 1 `pflichtSince` nicht setzen.
3. Fehler-Wiederholung: Die Boxen 1/3/9 steuern (Form der alten App). FSRS steht nur zusätzlich als Schatten in `errors[i].fsrs`.
4. Aufgaben-Schlüssel: genau wie in der alten App, `legacyNorm(prompt).replace(/[^a-z]/g,'').slice(0,80)` (models.js:223, grammar.js:50).
5. Pflichtkanäle sind nur gram, cloze und order (ohne KI und Sprachausgabe erfüllbar). Diktat, Sprint und Karten sind Angebot.
6. Die Lektion dauert 12 Min. (3/3/3/3). Die Pflicht ist Wiederholen → Lektion → Kanal, zusammen etwa 27 Min.
7. Es gibt eine einzige Sammel-Warteschlange in `src/features/progress/persist.ts`. Ein gescheiterter Stapel behält seine Folgenummer (W1), die Kennung gilt je Tab, alte `lxSeq`-Einträge werden auf `null` gesetzt.
8. Übungen schreiben nie `grammar/*` oder `vocab/*`; Grammatik schreibt sofort per `transform` mit Anker ±.12.
9. Die Lektion ist ohne KI immer machbar (Grundfassung, nie gespeichert). `lesson/<id>` wird nie überschrieben.
10. Alle liegengebliebenen `daily/*` fließen unter `acquire` in Karten und Pool, ohne dass etwas verworfen wird.
11. Vier KI-Vorlagen: lesson-content@1, grammar-items@1, grammar-judge@1 (quick, beim Prüfen) und lesson-production@1.
12. Zurückgestellt: KI-Nachgenerierung neuer Einheiten, `cloze-hunt`, `canDo` und `course.prog`. Es gibt kein neues Live-Abo.
13. Welle 1 startet sofort und legt nur neue Dateien an: S0a-Typen, Grammatik-, Kurs-, Übungs- und Plan-Domäne sowie die Vorlagen.
14. Welle 2 (Oberflächen, Heute, Seed, E2E) startet erst nach dem Merge des Trainer-Umbaus und S0b.
15. Neue Werkzeuge: `writer.acquire`, `readCollection`, `memoryDb.acquire`. data-guard bestätigt einmal das `lxSeq`-Nullen und `lxDaily`.

Relevante Dateien:
- /home/user/lingo-engine-x/docs/phase1-plan.md (§3.7, §4.8 von B1/B2 betroffen)
- /home/user/lingo-engine-x/src/features/vocab/persist.ts (W1, `deviceId`)
- /home/user/lingo-engine-x/src/domain/plan/buildPlan.ts
- /home/user/lingo-engine-x/src/domain/progress/profilePatch.ts
- /home/user/lingo-engine-x/src/data/writer.ts (`acquire` fehlt)
- /home/user/lingo-engine-x/contract/db.d.ts (`acquire`, Z. 301–319)
- /tmp/claude-0/-home-user-lingo-engine-x/fc49be48-ccd3-5daa-ba60-72e3e74ab73c/scratchpad/jll8/js/models.js (Z. 223–229)
- /tmp/claude-0/-home-user-lingo-engine-x/fc49be48-ccd3-5daa-ba60-72e3e74ab73c/scratchpad/jll8/js/today.js (Z. 174–222)
