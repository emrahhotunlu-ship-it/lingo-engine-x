# Bestandsliste Praxis, Stand 04.11.2026 (HEAD 05bf4a6)

**Kernbefund:** Praxis hat keine Modulgrenze. Übungen schreiben über `features/progress/persist.ts` (`learnRecorder`), `features/repair/store.ts` und `features/vocab/persist.saveCard`. `modules/vocab/api.reportEvidence` hat **keinen** Aufrufer. `docs/umbau/anwenden-plan.md` („Stufe 2 nicht gebaut“) ist überholt.

Einstieg: Heute › Freiwillig › „Praxis“ (`features/today/ExtraRow.tsx:217`) → Route `apply` (`areas/anwenden.tsx:42`), Hub `features/apply/ApplyHub.tsx`, oben „Lesen und Sprechen“ (`areas/praxis.tsx:21-22`).

| Funktion | Einstieg | Dateien | Schreibt / plant | Claude | Pflicht |
|---|---|---|---|---|---|
| Weitere Fehlersätze | ApplyHub:169 (nur ohne neue Grammatik `!gmod` → faktisch unsichtbar) | `apply/RepairRound.tsx`, `repair/*` | Log, `recordRepair` (`app/repair`, `grammar/<t>.errors`) | repairCheck | nein |
| Wortpartner, Wortbildung, Register, Phrasal Verbs, Überleitungen, Umformen (nbdrill) | `areas/training.tsx:51-56`, ApplyHub:148-150 | `features/nbdrill/*` | `out/<Monat>`, Log (ctx extra) | nein | nein |
| Umformen C1 (kwt), Fehler finden (err), Wortbildung (wf) | ApplyHub:153-167, `startGrammar({mode:'xtra'})` | `grammar/session`, `c1x/*` | **BKT `grammar/<t>` ungedämpft**, `app/radar`, **Wort-FSRS direkt** (`c1x/lexWrite.ts:12` → `saveCard`, ≤1×/Tag) | grammarFit | nein |
| Satzbau | ApplyHub:146 | `drills/*`, `orderGen.ts` | Log, `act`, `app/radar` | orderGen | ja, wenn `ch:order` offen / Block `task.order` |
| Lückenjagd | ApplyHub:147 | `drills/*` | Log | nein | ja, wenn `ch:cloze` offen |
| Diktat | ApplyHub:145 | `drills/*` | Log | nein | nein |
| Eigener Satz (Wort + Regel, Teil B) | ApplyHub:142 | `apply/ComboSentence.tsx`, `domain/apply/combo.ts` | falsch → `app/repair` (src write) | comboCheck | **ja**, Tagesweg Schritt 3 `task.apply` |
| Hörübung mit Frage | ApplyHub:143 | `apply/ListenQuestion.tsx`, `domain/apply/listenQ.ts` | nichts | listenQ | nein |
| Hörschleife | ApplyHub:144 | `vocab/listen/ListenLoop.tsx` | nichts | nein | nein |
| Tempo | Slot `c1x/tempo.slot.tsx:42` | `c1x/TempoRound.tsx` | **BKT** über `learnRecorder.grammar` (tempo), Log | grammarFit | nein |
| Satz-Klinik | Slot `tutor/clinic.slot.tsx:113` | `tutor/SentenceClinic.tsx` | `out/<Monat>`, `app/repair` (≤2), `app/c1.prod` | sentenceClinic | nein |
| Schreibwerkstatt | Slot `tutor/writing.slot.tsx:91` | `tutor/WritingStudio.tsx` | `out/<Monat>`, `app/repair` (≤5), `app/c1.prod/.bad` | c1Mail | nein |
| Sprechen / Rollenspiel | Praxis › Sprechen | `features/speak/*` | `talk/<Monat>`, `scene/<id>`, `chunk/<id>`, `app/repair`, `app/c1.prod` | roleplayTurn, turnAnalysis, roleplayReport, repairCheck, goalCheck | nein |
| Einwand-Training | `training.tsx:58` | `features/pressure/*` | `app/levels`, `out`, Log | pressureCheck | nein |
| Wochen-Check | Heute Extra (`ExtraRow.tsx:157`), `ChecksCard.tsx:64` | `features/check/*` | Karte (FSRS), Grammatik, Log, `profile.checks[]` | nein | xtra / Block `task.check` |

**Versteckt/verwaist:** „Weitere Fehlersätze“ (mit neuer Grammatik weg, Fehlersätze laufen im Grammatik-Schritt), Sprint (Route ohne Knopf), pressure-Sets `hotseat`/`buytime` ohne Knopf (`training.tsx:45`), Business-/KI-Szenen ausgefiltert (`SpeakHub.tsx:43`).

**Stufe 2 offen:** Wort + Regel Teil A (Lücke in Regelform ohne Claude); Hörübung als Kurzantwort statt Auswahl; Hinweis „Erst Wiederholen“ ab Rückstand 40; Belege gedämpft statt direkter FSRS/BKT-Buchung (`reportEvidence` ungenutzt). Laut `funktionsinventar.md:99-130` außerdem offen: Phrasen-Baukasten, Präsentations-Coach, Shadowing, Hörtexte, Lese-Archiv.

**Modulvertrag (Vorlage vocab):** `registry.ts` (Schemas, Pfade, ohne UI) · `api.ts` einzige Tür, schwere Teile dynamisch · nur lesende Abfragen + `addLexeme` (nur `createIfMissing`) · Belege `reportEvidence({lexeme, kind:'seen'|'recalled'|'used', src, ok, typed, cued, t})` – Planwirkung nur bei getipptem Abruf, verdeckt, erste Wirkung am Lerntag, p < 0,95; sonst nur `vlog`-Beleg · `shared.ts`/`sharedUi.ts` als einzige Importtüren · `aiPort.ts` (KI wird hereingereicht) · Isolationstest. `modules/grammar/api.ts` hat nur den Schalter; keine Beleg-API (BKT über `learnRecorder.grammar`/`grammarWrite`).

**Tests:** drills, lernen, erreichbar, breiten, repair*, combo, listenQ, nbdrill, training, c1x*, sentenceClinic, writingStudio, speak, sprechen, c1Check, vocab/isolation.
