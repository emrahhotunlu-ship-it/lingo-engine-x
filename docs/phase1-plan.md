# Phase 1 – Kern-Erlebnis: verbindlicher Umsetzungsplan

Stand: 26.09.2026 (Synthese aus fünf Fachentwürfen: Architektur, Lerndesign, Interaktion, Daten, Tests).
Dieser Plan ist die einzige Grundlage für den Bau von Phase 1. Weicht Code davon ab, gilt der Plan; ändert sich etwas, ändert der Lead zuerst diesen Plan.
Vorrang bei Widersprüchen: `contract/*.d.ts` > CLAUDE.md > `docs/auftrag.md` > Fachentwurf.

---

## 0. Ausgangslage und Entscheidungsregister

### 0.1 Was schon da ist (Basis aller Pakete)

| Baustein | Ort | Status |
|---|---|---|
| **MVP** (Heute mit einem Knopf, Vokabeltrainer mit FSRS, kinetische Lücke, Plan v1, Zähler, Tagesprotokoll) | Arbeitsbaum `claude/affectionate-cerf-pe6ej2`, noch nicht committet | wird laut A7 („vorgezogener Umzug") auf der Produktivadresse genutzt |
| **WP1** KI-Tor, Prompts `word-lookup@1` und `produce-check@1`, Sprachausgabe, Haptik, feste Antworten, nachgebildete Sprachausgabe | Branch `worktree-agent-adacfd52a8d1dccc6`, Commit `1651f78` | fertig, nicht eingebunden |
| **WP3** Text (tokenize, Grundform, Wendungen), Wörterbuch (US-Index), US-Lautschrift aus CMUdict | Branch `worktree-agent-a3a0eb69421288c50`, Commit `779bdd0` | fertig, nicht eingebunden |

**Folge:** Alles, was das MVP in die echte Datenbank schreibt, ist ab sofort **Produktivformat**. Es darf nur ergänzt werden, nie inkompatibel geändert werden. Das betrifft: Plan v1, `xs`, Übungs-IDs, Log-Felder, `lxSeq`, Zählerlogik.

### 0.2 Entscheidungen (je ein Satz Begründung)

| # | Frage | Entscheidung | Begründung |
|---|---|---|---|
| E1 | Planformat (v2 in Architektur/Lern/Interaktion gegen v1 im Daten-Entwurf) | **v1 bleibt**: `{d, ids, why, v:1, duty, goal, lesson, at}`. `goal` wird additiv um `due`, `new` und `ahead` ergänzt. | v1 steht schon in der echten Datenbank, und `readPlan` erkennt nur `v === 1`. |
| E2 | Pflicht in Phase 1 | Nur `review` („Wiederholen"). | Ab `pflichtSince` muss die Pflicht erfüllbar sein, Lektion und Mix-Kanäle gibt es erst ab Phase 2 (A7.2). |
| E3 | Fortschritt „Wiederholen" | Zahl **verschiedener Karten** mit `ctx:'rev'` in `log/<heute>` plus Puffer, gedeckelt auf `goal.review`. Ist `profile.pflicht[heute]` gesetzt, gilt `done = total`. | Eine Quelle für Statuszeile, Ring, Häkchen und Knopf (Kap. 2.2). |
| E4 | Wann ist die Pflicht erledigt? | **Nicht** über `act.review ≥ 1` (so im Daten-Entwurf), sondern genau dann, wenn E3 `allDone` ergibt oder die Pflichtrunde mangels Karten erschöpft ist. | `act.review` entsteht auch durch eine abgebrochene Runde mit ≥ 10 Antworten und würde der Zahl „12 von 22" widersprechen. |
| E5 | Wert von `pflichtSince` | `legacyDayKey(t)`, also der Kalendertag der alten App beim ersten erfolgreichen Tagesplan mit Pflicht. Die Tests des Test-Entwurfs werden angepasst. | Gemessen (Daten-Sonde): 0 von 17.280 Fällen senken die Serie, mit `dayKey(t)` sind es 2.136 (nachts). |
| E6 | Übungskatalog (14 / 16 / 19 Arten in den Entwürfen) | **13 Arten** (§4.2). Die sechs MVP-IDs bleiben mit Stufe, `level` und `mode` unverändert, sieben kommen neu dazu. | `stage` und `xs` sind Produktivdaten und haben dieselbe Bedeutung wie in der alten App (Rückweg bis Phase 7). |
| E7 | Aufstieg auf der Leiter | Formel der alten App (`nextStage`) **plus** Bremse: höchstens eine Beförderung je Karte und Lerntag, höchstens +1 Stufe (Ausnahme 0 → 2). | So bleibt die Bedeutung von `stage`, und eine Karte klettert nicht über Wiedervorlagen an einem Tag bis „Sicher anwenden". |
| E8 | Rundengröße | MVP-Regel (Budget 600 s, 10–60 Karten), dazu die Blutegel-Grenze und die Auffüllregel (§4.5). | Läuft produktiv und passt zu „kurze Einheiten" (Kap. 5). Die Auffüllregel schließt Befund B3 (Pflicht unerfüllbar). |
| E9 | Zähler in `app/profile` | MVP-Verfahren: frischer Stand plus Delta, doppelt anwendbar über `lxSeq[gerät]`. Das Maximum-Verfahren der Architektur entfällt. | Läuft produktiv und erfüllt `db.d.ts` („retried write can apply twice"). |
| E10 | Tagesschlüssel einer Runde | Alle Antworten einer Runde zählen zum Lerntag ihres **Beginns** (MVP, Daten-Entwurf). | Pflicht, Zähler und Log einer Runde zerfallen nie auf zwei Tage. |
| E11 | Wörter aus dem Tagesauftrag (`daily.newWords`) | Werden wie in der alten App (`applyDaily` → `cardFromAI`) als `vocab/<slug>` angelegt, nur wenn das Dokument fehlt. Keine „virtuellen" Karten. | Kap. 14: „Der Tagesauftrag funktioniert unverändert". |
| E12 | Zwischenspeicher `app/lookup` | Nur KI-Ergebnisse. Einmal je Seitenaufruf per `get()` gelesen, kein Abo. Geschrieben mit `transform` → `update`. Ab 400 gefüllten Einträgen werden die ältesten auf `null` gesetzt. **Kein** `replace`. | Kein `set` auf bestehende Dokumente, kein Wettlauf zwischen Geräten. Die alte App liest `null` als „fehlt" (`lookup.js:145`). |
| E13 | Tippen am iPhone nach „Prüfen" | Touch (`pointer: coarse`): Das Feld verliert den Fokus, die Tastatur schließt, die Rückmeldung steht inline unter dem Satz. Ein Bewertungsknopf bestätigt und fokussiert die nächste Tipp-Übung synchron. Desktop: Der Fokus bleibt. | Die vier Pflichtfragen müssen sichtbar sein (Kap. 2.4). Unter einer offenen iPhone-Tastatur bleiben nur etwa 330 px. |
| E14 | Bewertung per Touch | Vier Knöpfe, ein Tipp bewertet **und** geht weiter (MVP). Der Vorschlag ist als Primärknopf markiert. | Ein Tipp statt zwei, wie bei Anki. |
| E15 | Popover „Wort antippen" | Desktop (`pointer: fine` und ≥ 640 px): verankertes Glas-Popover. Touch: Blatt von unten. | Handybreite und Bildschirmtastatur. |
| E16 | „Claude fragen" | Dieselbe Vorlage `word-lookup@1` mit dem Satz. Sie zeigt `sense` und `note`. Keine zweite Vorlage `word-explain`. | Ist in WP1 gebaut und getestet, und ein Aufruf liefert Speicherbares und Satzbedeutung zugleich. |
| E17 | `produce-check` | `modelTier: 'quick'` (WP1). **learning-scientist bestätigt einmal.** | Prüfung eines einzelnen Satzes mitten in der Runde. `default` denkt 5–60 s nach (`sample.d.ts`). |
| E18 | Funktionswörter (`the`, `our`, `is` …) | Eigene Liste `src/content/function-words.json` (≈ 150 Einträge), nie KI. | `dict.json` hat keine Funktionswörter; ohne Liste kostet jedes „the" einen KI-Aufruf (Test-Befund B6). |
| E19 | XState | Der Ablauf **einer Übung** wird eine XState-Maschine. Die Rundensteuerung bleibt der MVP-Store (zustand). | Kap. 3.2 verlangt XState für Übungsabläufe. Der produktive, getestete Rundenstore wird nicht neu geschrieben. |
| E20 | Navigation | MVP-Reiter „Heute" / „Dein Stand", kein History-API. | Läuft produktiv; der Verlauf im iframe gehört claude.ai. |
| E21 | Englische Oberfläche | Bedeutungen sind englische Definitionen (`def`, notfalls aus dem Wörterbuch). Deutsches (`de`, `chunk.why`, `col.de`) erscheint dort nie. | Sprachtreue (Kap. 10, Kap. 15). |
| E22 | Wortschatzziel 8.000 | In Phase 1 als eine Zeile auf „Dein Stand" (Formel §4.9), nicht auf Heute. | Gehört zu Kap. 6.3 (Trainer); Heute behält eine rote Linie (Kap. 2.1). |
| E23 | XP | `xp` und `xpDays` werden weitergeführt (MVP), aber nie angezeigt. | Heatmap und Serienregel der alten App bleiben für den Rückweg stimmig; Kap. 2.3. |
| E24 | Neue Datenfelder | Nur: `plan.goal.{due,new,ahead}`, `pflicht`, `pflichtSince`, `origin` (neue Karten), `stage/xs/fsrs` auch auf `chunk/*`, Lookup `ipa/ex/note_en/t/pv`. **Nicht:** `learnedAt`, `exs`, `note`, `qstat`, `ladder`, `ladOk`, `srcCtx`, `planExtra`, `goalMin`. | So wenig neue Formen wie möglich (Kap. 9); jedes weitere Feld braucht einen eigenen Beschluss. |

---

## 1. Umfang und bewusste Abgrenzung

### 1.1 In Phase 1 (über das MVP hinaus)

1. **Heute v2**
   - Statuszeile nach Kap. 6.1: „Noch nicht fertig · 0 von 1 · es fehlt: Wiederholen".
   - Heldenkarte mit Ring und Begründung „22 Karten · 17 fällig · 5 neu · etwa 10 Min.".
   - Erledigtes ist Zustand, Extra erst nach der Pflicht, Tagesbilanz.
   - Serie mit Ruhetag-Hinweis. `pflicht[tag]`, `pflichtSince` und Wörter aus dem Tagesauftrag.
2. **Trainer vollständig**
   - 13 Abfragearten, mindestens 2 je Stufe, auch ohne Sprachausgabe, KI und Kollokationen.
   - Vokabeln **und Chunks** (`chunk/*`).
   - Blutegel-Grenze, Verschachtelung und „Weiß ich nicht".
   - Zeitdruck (`speed`) und eigener Satz (`produce`) mit KI oder Selbsturteil.
   - Hören (`listen_mc`, `dictation`).
3. **Interaktions-Engine**
   - Bausteine (Tippen, Ziehen, Tastatur).
   - Rückmeldung nach Kap. 4.3: grün mit Lichtimpuls, gold mit Markierung, rot mit Korrekturzeile und Wort-für-Wort-Vergleich.
   - Übergänge mit gemeinsamem Element (Heute → Trainer), reduzierte Bewegung.
4. **Wort-Antippen** in allen englischen Texten des Trainers (Frage nach dem Prüfen, Einführung, Rückmeldung, Zusammenfassung, Popover-Beispiele).
   - Glas-Popover bzw. Blatt mit Bedeutung, US-Lautschrift, Aussprache und Beispiel.
   - „Als Karte speichern" (mit Ursprungssatz), „Claude fragen", „Wieder aufnehmen".
5. **Einstellungen:** „Neue Wörter pro Tag" (0/2/5/10) und „Quellen und Lizenzen" (CMUdict, BSD).
6. **Dein Stand:** Stufen über `stageOf` (Befund B5), Zeile Wendungen, Zeile Wortschatzziel 8.000.
7. **Testdaten, Adapter und E2E-Suite** nach §8.

### 1.2 Nicht in Phase 1

| Inhalt | Wann | Grund |
|---|---|---|
| Lektion des Tages, Mix-Kanäle als Pflicht, Kanalgewichtung (`ids`/`why` bleiben `[]`) | 2 bzw. 6 | Module fehlen; es gäbe keinen toten Code |
| Tagesziel in Minuten (`goalMin`), Ton | 6 / 7 | Kap. 13 |
| Stimmenwahl in den Einstellungen | 3 | Kap. 13 („Sprachausgabe" Phase 3). Phase 1 nutzt die beste en-US-Stimme automatisch |
| Chunks aus dem Rollenspiel mitnehmen, Rollenspiel | 3 | Phase 1 trainiert nur vorhandene `chunk/*` |
| Satzbau (`order`), E-Mail-Refiner | 2 / 3 | Nutzen dann die Bausteine-Engine aus Phase 1 |
| Übersetzer (`/`), Claude-Chat, „Im Chat weiterfragen" | 5 | Kap. 13 |
| „Kenne ich schon", Eselsbrücken, Karten bearbeiten, `transfer`, `verify` | 2 | Nicht im Auftrag für Phase 1; learning-scientist entscheidet in Phase 2 |
| Automatisches Nachfüllen neuer Wörter per KI (`autoTopUp` der alten App) | 2 | `sample` nur auf ausdrückliche Handlung (`sample.d.ts`) |
| Verdichten von `app/lookup` (`null`-Einträge entfernen) | 7 | Eigener Beschluss mit data-guard (§3.9) |
| Test mit Safari/WebKit | – | Grenze der Cloud (A7.4); Emrah prüft am Gerät (§8.6) |

---

## 2. Architektur und Dateiplan

### 2.1 Schichten (per ESLint in Schritt 0)

| Schicht | darf importieren | darf **nicht** importieren |
|---|---|---|
| `src/platform/**` | platform, Vertragstypen; `platform/dev` zusätzlich seed | alles andere |
| `src/data/**` | platform, `domain/equal` | übriges domain, ai, prompts, engine, ui, features, app |
| `src/domain/**` | domain, `data/{schemas,validate}` (Typen und Prüfung), content, `platform/{diagnostics,types}` | react, framer-motion, xstate, zustand, ai, prompts, engine, ui, features, app |
| `src/prompts/**` | zod, `domain/lang`, prompts | alles andere |
| `src/ai/**` | `platform/{capabilities,diagnostics,types}`, prompts (nur Typen), `i18n/parts/ai.*` (nur Typ), zustand, react | data, domain, engine, ui, features, app |
| `src/engine/**`, `src/ui/**` | react, framer-motion, `domain/*` (rein), `platform/{haptics,diagnostics}`, engine, ui | data, ai, prompts, features, app |
| `src/features/**`, `src/app/**` | alles | `claude.use` (bestehende Regel) |

**Umsetzung in `eslint.config.js`:** je Schicht ein `no-restricted-imports`-Block mit `patterns[].group`.
- Beispiel `src/domain/**`: `['react', 'react-dom', 'framer-motion', 'xstate', '@xstate/*', 'zustand', '**/features/**', '**/app/**', '**/engine/**', '**/ui/**', '**/ai/**', '**/prompts/**']`.
- **Ausnahme:** `src/domain/srs/*` darf `**/data/schemas` und `**/data/validate` importieren; das gilt schon heute.

### 2.2 Zielstruktur

Neu: N · geändert: Ä · bestehend: –. In Klammern der Eigentümer nach Schritt 0 (§9).

```
src/
  app/        App.tsx Ä (INT) · clock.ts – · nav.ts – · settings.ts – · actions.ts Ä (P5)
  ai/         * – (P3; WP1)
  prompts/    common.ts types.ts registry.ts wordLookup.ts – (P3) · produceCheck.ts – (P4)
  platform/   speech.ts haptics.ts – (INT; WP1) · dev/* Ä (P6)
  data/       live.ts Ä (S0→INT) · schemas.ts Ä (S0→INT) · reads.ts N (S0→INT) · writer.ts – (INT)
  domain/
    srs/      types.ts Ä (S0, danach nur Lead) · übrige Dateien Ä (P1) · chunkCards.ts N (S0→P1) · newCard.ts N (S0→P1)
    answer/   check.ts normalize.ts spelling.ts Ä (P1) · diff.ts Ä (P2) · tokens.ts N (S0→P2)
    progress/ logPatch.ts profilePatch.ts Ä (S0→P1)
    plan/     types.ts buildPlan.ts Ä (P5) · coach.ts N (P5)
    vocab/    goal.ts N (P5)
    lookup/   resolve.ts cache.ts saveCard.ts N (P3)
    text/ lexicon/ – (P3; WP3)
    lang/     detect.ts – (P3; WP1)
    content.ts Ä (S0→P1) · overview.ts Ä (P5) · streak.ts date.ts – (P5)
  content/    function-words.json N (P3) · spelling-uk-us.json N (P1) · irregular.json pron/* – (P3; WP3)
  engine/
    wordTap.ts N (S0, danach nur Lead) · EnglishText.tsx N (S0→P3)
    AnswerFeedback.tsx N (S0→P2) · KineticGap.tsx HiddenInput.tsx Ä (P2) · tiles/* N (P2)
    ExerciseFrame.tsx RatingBar.tsx Choices.tsx Ladder.tsx useHotkeys.ts Ä (P4)
  ui/         motion.ts Ä (S0→P2) · Icon.tsx Ä (P2) · Popover.tsx N (P3)
  features/
    vocab/    views/types.ts N (S0, nur Lead) · views/registry.ts N (S0→INT) · views/TilesBody.tsx N (P2)
              übrige Dateien Ä/N (P4) · exerciseMachine.ts N (P4) · produce.ts N (P4)
    lookup/   * N (P3)
    today/    * Ä (P5) · progress/OverviewScreen.tsx Ä (P5) · settings/SettingsSheet.tsx Ä (P5)
  i18n/       de.ts en.ts Ä (S0→INT) · parts/{today,trainer,learn,engine,lookup,ai}.{de,en}.ts (S0 → je Paket)
  styles/index.css Ä (P2)
scripts/      generate-seed.mjs Ä · seed-golden.mjs N · check-platform.mjs Ä (P6) · build-pron.mjs – (P3)
seed/         sample-data.json Ä (P6)
tests/        unit/* je Paket (§9) · e2e/* · support/* (P6)
docs/         datenmodell.md Ä (P5)
```

### 2.3 Laufzeit-Zustand

| Store | Datei | Inhalt |
|---|---|---|
| `useLive` | `data/live.ts` | `app/profile`, `app/course`, `app/assess`, `app/schema` sowie die Sammlungen `vocab`, `grammar` und **`chunk`** (neu); dazu `day` (`log/<heute>`). Ergibt 8 Abos, beim Tageswechsel wird genau eines neu abonniert. |
| `useClock` | `app/clock.ts` | `now`, `today` (Takt 30 s und beim Sichtbarwerden) |
| `useNav` | `app/nav.ts` | Route `today` \| `overview` \| `trainer{round}` |
| `useTodayPlan` | `features/today/store.ts` | Plan des Tages, eingefroren |
| `useSession` | `features/vocab/session.ts` | Runde (Warteschlange, Karten eingefroren) |
| `usePending` | `features/vocab/persist.ts` | Puffer für Log und Zähler, gescheiterte Karten |
| `useLookup` | `features/lookup/store.ts` | Stapel offener Nachschlage-Einträge (≤ 5), Zwischenspeicher im Speicher, KI-Phase |
| `useLookupOpen` | `engine/wordTap.ts` | `open: boolean`. Solange offen, pausiert die Übungsuhr. |
| `useAiStatus` | `ai/status.ts` | Pause nach `rate_limited`, lokale Obergrenze 20 je Minute |
| `useSpeech` | `platform/speech.ts` | `status: 'loading' \| 'ready' \| 'novoice' \| 'unsupported'` |
| `useCapabilities` | `platform/capabilities.ts` | wie bisher, `sampleRevoked` |

---

## 3. Datenformate und Schreibwege

Geschrieben wird ausschließlich über `src/data/writer.ts`: `transform`, `createIfMissing`, `update` und `patch`. Es gibt kein `delete`, und `daily/*` sowie `feed/*` werden nie geschrieben. Ein Schreibvorgang läuft nie aus Render, Snapshot-Rückruf oder einem Zeitgeber, der Unverändertes schreibt. Ausnahme: der Sammel-Schreibvorgang nach 8 s Ruhe, der nur neue Antworten schreibt.

### 3.1 Übersicht der Schreibwege

| Dokument | Auslöser | Operation | Paket |
|---|---|---|---|
| `vocab/<id>`, `chunk/<id>` | jede bewertete Antwort, **sofort** | `transform(path, cur => reviewWrite(...))` → `update(patch)`; nur für eine Startvokabel ohne Dokument `set(seedCard + patch)` | P1 (Rechnung), P4 (Aufruf) |
| `log/<tag>` | gesammelt, siehe 3.5 | `transform`: fehlt → `set({date, entries})`, sonst `update({entries})` | P1 / P4 |
| `app/profile` (Zähler, `pflicht`) | gesammelt, siehe 3.5 | `transform` → `update(profilePatch)` | P1 / P4 |
| `app/profile.plan` | `ensureDay`, einmal je Lerntag | `transform` (nur wenn kein v1-Plan von heute da ist) | P5 |
| `app/profile.pflicht[tag]` (Selbstheilung) | `ensureDay` | `transform` (nur wenn abgeleitet erledigt und nicht gesetzt) | P5 |
| `app/schema.pflichtSince` | `ensureDay`, einmal je Datenbank | `transform` (nur wenn kein gültiger Datumsschlüssel da ist) | P5 |
| `vocab/<slug>` (Tagesauftrag) | `ensureDay` | `createIfMissing` | P5 |
| `vocab/<slug>` (Wort-Antippen) | Knopf „Als Karte speichern" | `transform`: fehlt → `set(neu)`; da und `ex` leer → `update({ex, origin})`; sonst nichts | P3 |
| `vocab/<id>.hidden` | „Wieder aufnehmen" / „Rückgängig" | `update({hidden:false})` / `update({hidden:true})` | P3 |
| `app/lookup.items` | KI-Nachschlagen erfolgreich | `transform` → fehlt: `set({items:{k:e}})`, sonst `update({items:{k:e, …ältest:null}})` | P3 |
| `app/profile.newPerDay` | Einstellungen | `patch` optimistisch mit Rückrollen (Muster `app/actions.ts`) | P5 |

### 3.2 `vocab/<id>` nach einer Antwort (MVP-Format, unverändert)

`reviewWrite` in `src/domain/srs/applyReview.ts` überspringt in diesen Fällen (`skip`):
- `missing`: Dokument fehlt und ist keine Startvokabel.
- `invalid`, `hidden`, `future_fsrs` (`fsrs.v > 1`), `invalid_result`.
- `already_applied`: `last === a.t`.
- `stale_answer`: `last > a.t`.

Beispiel-Patch für `reliable`, `cloze_hint`, Gut, 27.09.2026 08:00 = `1790488800000`:

```json
{
  "fsrs": { "v": 1, "due": 1791180000000, "stability": 8.391, "difficulty": 4.99, "state": 2, "reps": 4,
            "lapses": 0, "last": 1790488800000, "scheduledDays": 8, "learningSteps": 0, "src": "lx" },
  "S": 8.391, "D": 4.99, "due": 1791180000000, "last": 1790488800000,
  "state": "review", "reps": 4, "lapses": 0, "stage": 3,
  "modes": { "cloze": { "c": 5, "w": 1 } },
  "xs": { "cloze_hint": { "c": 3, "w": 1 } },
  "hist": [ "… höchstens 11 ältere …", { "t": 1790488800000, "m": "cloze", "g": 3 } ],
  "ac": 0.736, "pa": 0.736
}
```

**Regeln (bestehen, P1 behält sie):**
- `modes` und `xs` enthalten nur den geänderten Schlüssel. `update` mischt sie ein.
- `hist` ist die frische Liste, gekürzt mit `.slice(-12)`.
- `intro = a.day` nur beim Übergang von `state:'new'`.
- `pa`/`ac`/`co`/`colN` nach `updateSkill` der alten App.
- `S = min(stability, 365)`, `D` begrenzt auf 1–10.

**Neu in P1:**
1. **Beförderungsbremse** (E7): Siehe §4.3. Sie greift in `cardPatch` auf `stage`.
2. **Uhr geht nach:** `reviewFsrs`, `previewIntervals` und `retrievability` rechnen mit `tNow = max(now, fsrs.last ?? 0)`, sonst wirft ts-fsrs `Invalid delta_t` (Test-Befund B2).

### 3.3 `chunk/<id>` nach einer Antwort (neu)

Es gilt dieselbe Funktion `reviewWrite(path, cur, a, null)` mit `a.kind === 'chunk'`, mit diesen Abweichungen:
- `modes` wird nur für die alten Chunk-Modi geschrieben:
  - `produce` → `modes.produce`.
  - Getippte Arten und Baustein-Arten (`cloze_hint`, `cloze`, `type`, `speed`, `tiles`, `dictation`) → `modes.cloze`.
  - Auswahlarten (`mc_en`, `mc_de`, `match`, `listen_mc`) → kein `modes`, nur `xs`.
- Kein `pa`/`ac`/`co`/`colN`.
- `hist[].m` ist der Modus aus dem Katalog (`recog` \| `cloze` \| `type` \| `listen` \| `produce`).
- Nie `create`. Ein fehlender Chunk gibt `skip('missing')`.
- Eigenes strenges Schema `chunkPatchSchema` = `cardPatchSchema` ohne `pa`, `ac`, `co` und `colN`, `modes` optional.
- Unberührt bleiben: `en`, `de`, `kind`, `register`, `why`, `src{}`, `created`, `also`, `seen` und alle unbekannten Felder.

### 3.4 Neue Karte (`src/domain/srs/newCard.ts`, Schritt 0, danach P1)

Das ist eine Portierung von `cardFromAI` der alten App (`vocab.js:39`):

```ts
export type CardOrigin = {
  v: 1;
  kind: 'trainer' | 'intro' | 'summary' | 'lookup' | 'daily';
  ref?: string;    // Quellpfad, z. B. 'vocab/affect', 'chunk/c-…', 'daily/2026-09-27'
  title?: string;  // ≤ 120 Zeichen
  t: number;
};
export type NewVocabInput = {
  word: string;                 // Anzeigeform: Verben mit „to " (Regel unten), Wendungen ohne
  de: string;                   // Pflicht (wie cardFromAI)
  pos?: string | null; def?: string | null; level?: string | null;
  ex?: string | null;           // Satz; ohne Klammern wird die Oberflächenform eingeklammert
  surface?: string | null;      // angetippte Form (z. B. „decided"), sonst Kernwort
  col?: unknown[] | null;       // sonst collocFor(id)
  src: 'lookup' | 'coach';
  origin: CardOrigin;
  today: string;
};
/** null, wenn word oder de fehlt oder ex keine gültige Klammer bekommt. */
export function newVocabDoc(i: NewVocabInput): { id: string; doc: Record<string, unknown> } | null;
```

Die Klammerregel für `ex`:
1. `[` → `(`, `]` → `)`. `**` und `*` entfernen, Leerraum zusammenziehen.
2. Die erste Fundstelle von `surface` bzw. vom Kernwort (ohne `to `/`to be `, Groß- und Kleinschreibung egal, Wortgrenzen) einklammern.
3. Länger als 200 Zeichen → Fenster an Wortgrenzen, `…` davor bzw. dahinter.
4. Ergebnis muss `/^[^\[\]]*\[[^\[\]]+\][^\[\]]*$/` erfüllen, sonst `ex = ""`. Das Schema erlaubt das. Beim Wort-Antippen ist Speichern dann aber nicht möglich (§5.6).

Das erzeugte Dokument:

```json
{ "id": "procurement", "word": "procurement", "pos": "noun", "de": "Beschaffung, Einkauf",
  "def": "the process of buying goods or services", "ex": "The [procurement] team signed the contract.",
  "col": [], "level": "B2", "state": "new", "S": 0, "D": 5, "last": 0, "due": 0, "reps": 0, "lapses": 0,
  "modes": {}, "order": 900, "src": "lookup", "added": "2026-09-27",
  "origin": { "v": 1, "kind": "trainer", "ref": "vocab/reliable", "title": "reliable", "t": 1790488800000 } }
```

- `id = slug(word)`, dieselbe Funktion wie in `content.ts`.
- „to " steht vor Verben nach der Regel der alten App: `/verb/i.test(pos) && !/adverb/i.test(pos) && !/^to /i.test(word) && !/\s/.test(word)`. Die Wortart `phrasal` bekommt kein „to ".
- `level`: aus der KI, sonst `'B2'`.
- Kein `fsrs`, `readFsrs` leitet ab.

### 3.5 Sammeln: `log/<tag>` und `app/profile` (MVP, `features/vocab/persist.ts`)

**Auslöser (bestehen):**
- 4 offene Antworten, 8 s Ruhe oder Rundenende;
- `visibilitychange: hidden` und `pagehide`;
- sofort bei der ersten Antwort einer Runde.

**Neu (P4):** Sofort auch dann, wenn die Antwort die Pflicht erfüllt (§4.8).

**Log-Eintrag, Vokabel** (MVP, `logEntry`):

```json
{ "t": 1790488800000, "ok": true, "lang": "de", "k": "v", "id": "reliable", "m": "tr-cloze_hint",
  "given": "reliable", "ans": "reliable", "g": 3, "ms": 4200, "ctx": "rev" }
```

**Log-Eintrag, Chunk** (neu, Form der alten App: `type:'chunk'`, kein `k`):

```json
{ "t": 1790488860000, "ok": false, "lang": "de", "type": "chunk", "id": "c-i-take-your-point-but",
  "m": "tr-tiles", "q": "I take your point, but …", "given": "I take point your, but",
  "ans": "I take your point, but", "g": 1, "ms": 9100, "ctx": "rev" }
```

**Gemeinsame Regeln:**
- `ok = g > 1`. `given`, `ans` und `q` höchstens 160 Zeichen.
- „Weiß ich nicht" → `given: "(don't know)"` (Konvention der alten App).
- Höchstens 300 Einträge, die neuesten bleiben. Doppelte fallen nach `t|id` heraus. Größe ≤ 240 KiB.

**Kartenschlüssel eines Eintrags** (Schritt 0, `logPatch.ts`):

```ts
/** 'vocab/<id>' | 'chunk/<id>' | null (Einträge ohne id). */
export function entryCardKey(e: { id?: unknown; k?: unknown; type?: unknown }): string | null;
// type === 'chunk' → `chunk/${id}`; sonst, wenn id ein String ist → `vocab/${id}`.
```

**`app/profile`-Patch** (MVP `profilePatch`, Schritt 0 ergänzt nur `pflichtDay`):

```ts
export function profilePatch(
  cur: Doc,
  answers: readonly AnswerEvent[],
  rounds: readonly RoundEnd[],
  ctx: { deviceId: string | null; seq: number; pflichtDay?: string | null },
): Doc | null;
// Neu: pflichtDay gesetzt und !cur.pflicht?.[pflichtDay] → patch.pflicht = { [pflichtDay]: 1 }.
// pflicht allein (ohne Antworten/Runden) ist ein gültiger Patch (Selbstheilung, Rundenende „erschöpft").
```

**Ergebnis für die Serie**, Beispiel:
`{ days:{'2026-09-27':23}, xpDays:{…}, xp, answers, vAnswers, ema, n, act:{'2026-09-27':{review:1}}, minutes:{'2026-09-27':11}, pflicht:{'2026-09-27':1}, lxSeq:{'d7k2p':1790489400000} }`.

- `act.review`/`act.cards` zählen **Runden** (`~` bei Abbruch mit < 10 Antworten und Rest).
- `pflicht` ist davon unabhängig (E4).

### 3.6 Tagesplan (`app/profile.plan`, v1 + additive `goal`-Felder)

```json
{ "d": "2026-09-27", "ids": [], "why": [], "v": 1, "duty": ["review"],
  "goal": { "review": 22, "due": 17, "new": 5, "ahead": 0 }, "lesson": null, "at": 1790488800000 }
```

- Es wird immer das **vollständige** Objekt geschrieben, weil `update` verschachtelt mischt.
- Ein v1-Plan von heute ist unveränderlich.
- `readPlan` liest `goal.due/new/ahead` optional. Bei MVP-Plänen fehlen sie, dann entfällt die Aufschlüsselung in der Begründung.
- Ein Plan der alten App von heute wird nur übernommen, wenn alle `ids` ausführbar sind. In Phase 1 ist das nie der Fall, also entsteht ein neuer Plan mit `ids:[]` (MVP).

### 3.7 `pflicht`, `pflichtSince`, Serie

- **`pflicht[tag] = 1`:** Wird nur gesetzt, nie `0`, nie entfernt, nie ohne eigene Aktivität. Auslöser siehe §4.8.
- **`pflichtSince`** (`app/schema`, P5 in `ensureDay`):
  ```ts
  writer.transform('app/schema', cur =>
    !cur ? null
    : isDayKey(cur.pflichtSince) ? null
    : cur.pflichtSince != null ? (logError('today:pflichtSince', …), null)   // ungültiger Altwert bleibt
    : { update: { pflichtSince: legacyDayKey(now) } })
  ```
  Aufgerufen nur, wenn für heute ein v1-Plan mit `duty.length > 0` gespeichert ist (neu oder behalten). Scheitert es, folgt der nächste Versuch beim nächsten `ensureDay`; das ist nur großzügiger.
- **Serie:** `computeStreak` bleibt unverändert (`src/domain/streak.ts`). `docs/datenmodell.md:22` wird angepasst auf: „Kalendertag der alten App (`legacyDayKey`) beim ersten gespeicherten Tagesplan mit Pflicht; nie verschoben."

### 3.8 Wörter aus dem Tagesauftrag (`src/domain/plan/coach.ts`, P5)

```ts
export function coachCards(dailies: ReadonlyArray<{ path: string; doc: Doc }>, existing: ReadonlySet<string>, today: string, nowMs: number)
  : Array<{ path: string; doc: Doc }>;
```

1. Gelesen werden `daily/<dayKey(now)>` und, falls anders, `daily/<legacyDayKey(now)>`, jeweils per `readDoc`.
2. Für jedes gültige `newWords[i]` (`word` und `de` vorhanden) gilt: `newVocabDoc({ …w, src:'coach', origin:{v:1, kind:'daily', ref:path, t:nowMs}, today })`.
3. Ausgelassen wird jede `id`, die schon in `mergedVocab` steht (auch Startvokabeln und ungültige Dokumente).
4. Geschrieben wird mit `createIfMissing`. Fehler landen im Protokoll und blockieren nichts.

### 3.9 `app/lookup` (P3, `src/domain/lookup/cache.ts`)

```ts
export const LOOKUP_MAX = 400;
export const lookupKey = (w: string) => w.toLowerCase().replace(/’/g, "'");   // Muster /^[a-z][a-z' -]{0,59}$/, sonst kein Eintrag
export type LookupEntry = {
  lemma: string; pos: string; de: string; def: string; level: string;   // alte Felder, fehlend → ''
  note_de?: string; note_en?: string;       // nur die Sprache der Anfrage
  ipa?: string; ex?: string; t: number; pv: 'word-lookup@1';
};
export function cacheEntry(out: WordLookupOut, uiLang: Lang, nowMs: number): LookupEntry;
/** Patch für update: neuer Eintrag plus null für die ältesten, sobald > 400 gefüllt wären. */
export function cachePatch(cur: Doc | undefined, key: string, entry: LookupEntry): { set?: Doc; update?: Doc };
```

- **Verdrängen:** Gefüllte Einträge nach `t` aufsteigend sortieren; Einträge ohne `t` gelten als `t = 0`, bei Gleichstand gilt die Objekt-Reihenfolge. Ergibt sich nach dem Einfügen mehr als 400, bekommen so viele den Wert `null`, dass es genau 400 sind.
- **Gibt es den Schlüssel schon:** Nur `note_<ui>` und fehlende Felder werden ergänzt. `update` mischt ein, das Vorhandene bleibt.
- **Diagnose (P5):** Größe von `app/lookup`, Warnung ab 200 KiB. Auch die `null`-Einträge wachsen nur um etwa 20 B je Verdrängung.

### 3.10 Schema-Ergänzungen (Schritt 0, `src/data/schemas.ts`, alle `nullish`, nichts verschärft)

- `profileSchema.plan.goal`: `looseObject({ review: num, due: num, new: num, ahead: num })`.
- `vocabSchema`: `origin: z.looseObject({ v: num, kind: str, ref: str, title: str, t: num }).nullish()`.
- `lookupSchema.items[*]`: `ipa, ex, note_en, pv: str`, `t: num`. Der Eintrag selbst ist schon `nullish`.
- `chunkSchema`: Es gilt schon `schedulingFields` (`stage`, `xs`, `fsrs`); nichts weiter.

### 3.11 Kapazität

- Pro Lerntag kommt 1 Dokument dazu (`log/<tag>`), dazu die Karten aus Tagesauftrag und Wort-Antippen.
- Keine Karte entsteht ohne Handlung Emrahs oder des Tagesauftrags.
- Die Diagnose zeigt die Dokumentzahl und warnt ab 4.000 (A6.6).

---

## 4. Lerndesign

### 4.1 Einheitliche Karte (`TrainCard`, Schritt 0 in `types.ts`)

Vokabeln (MVP `toTrainCard`) und Chunks (`buildChunkCards`) ergeben denselben Typ:

- **`word`:** Vokabel `word`, Chunk `en`.
- **`lemma`:** ohne führendes „to ", ohne „…".
- **Kontext:**
  - Vokabel: `ex` mit `[…]`; ohne Klammer das Wort bzw. seine Form (P1 ergänzt unregelmäßige Formen über `irregular.json` aus WP3).
  - Chunk: `src.upgraded`, wenn es die Wendung enthält (ohne „…", Vergleich über normalisierte Wörter); sonst `src.utterance` nur als Zusatzzeile; sonst kein Kontext.
- **Bedeutung** (`meaningOf`): DE → `de`; EN → `def`, sonst `dictMeaning(lemma).def` (WP3).
- **`src`:** Vokabel `src`, Chunk `'scene'`.
- **`chunk`:** `{chunkKind, register, why, utterance, sceneTitle}`.
- **`lapses`**, **`lesson`**.

### 4.2 Katalog der Abfragearten (P1, `src/domain/srs/modes.ts`)

| ex | Stufe | `level` | `mode` (alt) | Eingabe | braucht | Aufgabe | Chunk |
|---|---|---|---|---|---|---|---|
| `mc_en` (MVP) | 1 | 1 | recog | choice | Bedeutung, 3 Ablenker | Wort im Satz markiert (ohne Satz: Wort allein) → Bedeutung wählen | ja |
| `spot` | 1 | 1 | recog | spot | Kontext, Bedeutung | Bedeutung steht da → das Wort im Satz antippen | nein |
| `listen_mc` | 1 | 1 | recog | choice | TTS, Bedeutung | Satz (ohne Satz: Wort) wird vorgelesen, Text verdeckt → Bedeutung wählen | ja |
| `mc_de` (MVP) | 2 | 2 | recog | choice | Bedeutung, 3 Ablenker | Bedeutung → englisches Wort wählen | ja |
| `match` | 2 | 2 | recog | tiles | Bedeutung, 3 Ablenker | Satz mit Lücke (ohne Satz: Lücke allein), Bedeutung als Stütze; einen von 4 Wort-Bausteinen in die Lücke | ja |
| `cloze_hint` (MVP) | 3 | 3 | cloze | typed | Kontext | Lücke tippen; Stütze: Bedeutung und erster Buchstabe | ja |
| `tiles` | 3 | 3 | cloze | tiles | – | Wort aus Bausteinen in die Lücke (Regeln unten); Stütze: Bedeutung | ja (Wort-Bausteine) |
| `type` (MVP) | 4 | 4 | type | typed | Bedeutung | Bedeutung → Wort in freistehende Lücke tippen | ja |
| `cloze` (MVP) | 4 | 4 | type | typed | Kontext | Lücke tippen, ohne Buchstaben-Hilfe | ja |
| `colloc` (MVP) | 4 | 4 | colloc | choice | `col[i]` mit Kontext und ≥ 2 `opts` | Kollokationspartner wählen | nein |
| `dictation` | 5 | 5 | listen | typed | TTS, Kontext | Satz hören, fehlendes Wort in die sichtbare Lücke tippen | ja |
| `speed` | 5 | 5 | type | typed | Bedeutung | wie `cloze` (mit Kontext) bzw. `type` (ohne), gegen einen Zeitbalken | ja |
| `produce` | 5 | 5 | produce | produce | – | eigenen Satz mit dem Wort schreiben; KI-Prüfung, ohne KI Selbsturteil | ja |

**Mindestens zwei je Stufe ohne TTS, KI und `col`** (Vokabel mit Kontext und Bedeutung):
- Stufe 1: mc_en, spot
- Stufe 2: mc_de, match
- Stufe 3: cloze_hint, tiles
- Stufe 4: type, cloze
- Stufe 5: speed, produce

**Verfügbarkeit** (`availableExercises(card, env, poolSize)`):
- Die Abfragestufe ist `k = max(1, quizStage(card))`, mit `quizStage = isLeech ? min(stage, 3) : stage`.
- Genommen werden alle Arten der Stufe k, deren Bedingungen erfüllt sind.
- Sind es weniger als 2, wird aus Nachbarstufen geliehen: Abstand 1, 2, …, zuerst k+d, dann k−d, jeweils in Katalogreihenfolge, bis es 2 sind (MVP-Regel).
- Keine Art verfügbar → die Karte ist `incomplete`, `quizzable` ist falsch, und sie steht nicht im Plan.
- **Ablenker:** Liefert der eigene Kartenpool keine 3 (Chunks, kleine Decks), füllt `lexDeps()` aus WP3 auf:
  - Einzelwörter mit gleicher Wortart (`wordsByPos`), bei Chunks die Mehrwort-Schlüssel aus `dict.json`.
  - „3 Ablenker möglich" ersetzt die bisherige Bedingung `poolSize ≥ 3`.

**Auswahl** (`chooseExercise`, MVP-Regel): `score = (c+1)/(c+w+2)` aus `xs[ex]` (sonst `modes[mode]`), der kleinste Wert gewinnt.
- Gleichstand heißt Δ < 0,05. Dann entscheidet der Reihe nach:
  1. eine andere Art als `lastMode` der Karte;
  2. keine der zwei vorigen Arten der Runde;
  3. die Katalogreihenfolge.
- Neu: Liegen zwei Werte ≤ 0,1 auseinander, wird dieselbe `InputKind` wie bei der vorigen Karte bevorzugt. So geht die Tastatur seltener auf und zu.

**Bau der Übung** (`buildExercise(card, ex, env, pool, seed, lex?)`, Zufall mit `mulberry32(hash32(key|ex|seed))`):
- **`tiles`, ein Wort mit ≤ 14 Buchstaben:** Buchstaben der Lösungsform plus 2 Fremdbuchstaben aus `etaoinshrdlucmfwyp`, die nicht in der Lösung vorkommen.
- **`tiles`, mehr als 14 Buchstaben:** Zweiergruppen, keine Fremden.
- **`tiles`, Mehrwort oder Chunk:** Wort-Bausteine plus 2 Fremdwörter (aus anderen Karten, sonst `a`, `the`, `to`, `of`).
- **Mischung bei `tiles`:** nie in Lösungsreihenfolge (einmal rotieren, falls doch).
- **`match`:** 4 Wort-Bausteine: die Lösungsform plus 3 Ablenkerwörter (Regeln wie `mc_de`).
- **`speed`:** `timeLimitMs = clamp(4000 + 400·len, 6000, 14000)`, mit `len` = Länge der Lösung.
- **`listen_mc`:** `speak` = Satz ohne Klammern, ohne Satz das Wort.
- **`dictation`:** `speak` = ganzer Satz.
- **`produce`:** `accepted = []`.

**Ablenker-Wertung** (MVP, bleibt):
- Punkte: +3 gleiche Wortart, +2 Längenunterschied ≤ 6 (Bedeutungen) bzw. ≤ 3 (Wörter), +1 gleiche Stufe, +0,5·Zufall.
- Ausgeschlossen:
  - ein gemeinsames Inhaltswort mit mindestens 4 Buchstaben;
  - gleiches Lemma;
  - gleiche ersten 5 Buchstaben (Wörter).
- Alle Bedeutungs-Optionen werden auf die erste Bedeutung gekürzt, höchstens 42 Zeichen.
- `fromWord`, `fromMeaning` und `fromPos` gehen in die Begründung.

### 4.3 Leiter (P1, `ladder.ts` + `applyReview.ts`)

- **`stageOf(doc)`** (MVP, Formel der alten App):
  - `new` und `reps = 0` → 0;
  - sonst `stage`, falls vorhanden;
  - sonst aus `ac`, `pa` und `S`.
  - Das betrifft 41 echte Karten ohne `stage`; geschrieben wird erst bei der nächsten Antwort.
- **`nextStage(stage, level, g)`** (MVP, alte App), unverändert.
- **Bremse** (neu, E7), in `cardPatch`:
  ```ts
  const before = stageOf(cur);
  let after = nextStage(before, def.level, a.grade);
  if (after > before) {
    const firstToday = num(cur.last) < learningDayStart(a.t);      // neue Karten: last = 0
    after = firstToday ? Math.min(after, Math.max(2, before + 1)) as Stage : before;
  }
  ```
  - Abstieg (Note 1) bleibt wie in der alten App.
  - Eine neue Karte geht nach der ersten richtigen Abfrage von 0 auf 2 (wie in der alten App). Wiedervorlagen am selben Tag befördern nicht.
- **Blutegel:** `lapses ≥ 4` → Abfrage höchstens auf Stufe 3. Die gespeicherte `stage` bleibt. Im Trainer erscheint ein kleiner Chip „hartnäckig".
- **Anzeige:** Die Leiter hat 5 Segmente. Das aktuelle trägt den Stufennamen (`stage1..5`, i18n vorhanden). Ein Aufstieg füllt das Segment in 250 ms; nach der Bewertung steht in der Rückmeldung der Chip „↑ {Stufe}".

### 4.4 FSRS (MVP, `scheduler.ts`, bleibt)

- **Parameter:** `request_retention 0.9`, `maximum_interval 365`, `enable_fuzz`, `enable_short_term`, `learning_steps ['1m','10m']`, `relearning_steps ['10m']`, Standard-Gewichte.
- **Fällig:** `fsrs.due < learningDayEnd(now)`, also vor dem nächsten 04:00, und nicht neu.
- **Nachziehen:** Ist `fsrs` ungültig oder passt `fsrs.last` nicht zu `last`, gilt `legacyToFsrs` (`docs/fsrs-umrechnung.md`).
- **Neu:** Klemme `tNow = max(now, fsrs.last)` (§3.2).
- **Vorschau** der Intervalle je Note auf den Bewertungsknöpfen (`previewIntervals`):
  - „in {n} Min." unter 60 Min., „in {n} Std." unter 24 Std., sonst „in {n} Tagen" (MVP-Texte).

### 4.5 Runde „Wiederholen" (P1 `queue.ts`, MVP + drei Ergänzungen)

**`planRound`** (MVP):
- `ROUND_SECONDS = 600`, neue Karte 50 s, Wiederholung 12 s (Stufe ≤ 2), 20 s (3–4), 35 s (5).
- Karten in Lernschritten immer, höchstens 15.
- Mindestens 10 (Rest vorgezogen, `ahead`), höchstens 60.
- `newPerDay` wird auf 0/2/5/10 normalisiert (nächster Wert, bei Gleichstand der kleinere, fehlt → 5).
- Kontingent: `newPerDay − (Karten mit intro === heute)`.

**Neu:**
1. **Blutegel-Grenze:** Höchstens 3 Karten mit `lapses ≥ 4` je Pflichtrunde. Weitere überspringt `planRound` und `buildQueue` gleich (sie bleiben fällig, die Extra-Runde bietet sie an).
2. **Auffüllen** (Test-Befund B3): `buildQueue(… , mode: 'pflicht')` füllt in dieser Reihenfolge:
   1. fällig (nach Dringlichkeit);
   2. neu im Kontingent;
   3. vorgezogen (niedrigste Abrufwahrscheinlichkeit);
   4. **neu über das Kontingent hinaus**;
   5. danach ist die Warteschlange kürzer (die Runde meldet `exhausted`, §4.8).
3. **Verschachtelung:** Die Wiederholungen werden nach Dringlichkeit sortiert und dann gierig umgeordnet. Genommen wird das erste Element unter den nächsten 4, dessen `topicKey` sich von den beiden zuletzt gesetzten unterscheidet, sonst das erste.
   - `topicKey = lesson ? 'lesson:'+lesson : kind==='chunk' ? 'scene:'+src.scene : 'src:'+src`.

**Bleibt (MVP):**
- Neue Karten stehen an den Positionen 2, 5, 8, … (0-basiert).
- Neue Karten beginnen mit der Einführung (`phase:'intro'`); die erste Abfrage folgt an Position +3.
- Wiedervorlage: Karte in Lernschritten und `due − t ≤ 20 Min.` → Position +4, höchstens 3 Mal je Runde. Das zählt nicht zum Ziel.
- Die Karten sind für die Runde eingefroren; Live-Änderungen mischen nichts neu.

**Signaturen (Schritt 0 legt fest):**

```ts
export type ExerciseEnv = { lang: Lang; tts: boolean; ai: boolean };
export function planRound(i: { cards: readonly TrainCard[]; nowMs: number; newPerDay: unknown; introducedToday: number; env: ExerciseEnv }): RoundPlan;
export function buildQueue(i: { cards: readonly TrainCard[]; nowMs: number; target: number; newQuotaLeft: number;
  exclude: ReadonlySet<string>; env: ExerciseEnv; mode: 'pflicht' | 'extra' }): QueueItem[];
```

- `planRound` rechnet immer mit `env = {lang, tts:false, ai:false}`. Jede Stufe hat ohne TTS und KI zwei Arten, die Menge ist also gleich.
- **Pflichtrunde:** `target = goal.review − erledigt`, `exclude` = Karten mit `ctx:'rev'` heute.
- **Extra-Runde:** `target = 10`, `exclude` = alle heute beantworteten Karten, keine Auffüllung über das Kontingent hinaus.

### 4.6 Antwortprüfung (P1 `check.ts`, P2 `tokens.ts`/`diff.ts`)

**`checkTyped(given, accepted, {lemma, knownWords})`** (MVP-Reihenfolge, die erste Regel gilt):
1. gleich → `correct`
2. `toUS` gleich → `correct` + `variant:'uk'` + `us`
3. **Lemma gleich, andere Form** → `near/form`. Neu: auch unregelmäßig über `lemmaCandidates` (WP3), z. B. `took` ↔ `take`.
4. anderes bekanntes Wort → `wrong/confusable`. Neu: `knownWords` ∪ `isDictWord` (WP3).
5. Tippfehler innerhalb `typoBudget(len)` (0 bei ≤ 4, 1 bei 5–8, 2 ab 9 Zeichen) → `near/typo` mit `marks`
6. sonst `wrong`

**Neu, Mehrwort** (Lösung enthält Leerzeichen, Chunks):
- `checkTokens(given, expected)` aus `tokens.ts`, auf Wortebene.
- Gleich nach Normalisierung (Kommas und „…" ignoriert) → `correct`.
- Ein Wort Unterschied, das ein Funktionswort ist (`a, an, the, to, of, on, in, at, for, with, by, from, about, up, out, off`) oder ein Tippfehler nach `typoBudget` → `near/partial`.
- Sonst `wrong` mit `words: WordPart[]`.

**`spelling.ts`** (P1): Die Liste der britischen Formen wird ergänzt (`src/content/spelling-uk-us.json`, ≈ 120 Paare einschließlich Beugungen):
- `-our`: colour, behaviour, favour, honour, labour, neighbour, rumour, humour, flavour.
  Nie hour, four, your, tour, pour, flour, detour, contour.
- `-ise`/`-isation`: nicht advertise, advise, arise, comprise, compromise, despise, devise, disguise, enterprise, exercise, expertise, franchise, improvise, merchandise, otherwise, premise, promise, raise, revise, rise, supervise, surprise, televise, wise, praise, noise, precise, concise.
- `-yse`, `-tre` (Liste), `-ll-` (travelled, cancelled, labelled, modelled, levelled, fuelled, signalled, counselled, jewellery).
- Einzelwörter: programme, cheque, grey, tyre, aluminium, enquiry, judgement, ageing, licence, defence, offence, catalogue, analogue, practise.
- Wörter mit anderer Bedeutung (lorry → truck, flat → apartment, mobile → cell phone, CV → résumé, autumn → fall, holiday → vacation, petrol → gas, queue → line, timetable → schedule) gelten als `variant`.
- Die Anzeige nennt die US-Form als Hinweis, nie als Fehler (A7.3).

### 4.7 Notenvorschlag (P1 `grade.ts`)

**Zeitmessung:** nur mit `performance.now()`, nie mit `Date` (Test-Befund B1).
- Beginn: nach der Einblendung, bei `listen_mc`/`dictation` ab Tonende.
- Offenes Popover und `document.hidden` pausieren die Uhr.
- L = Zeit bis zum ersten Zeichen, T = Zeit bis zur Wahl bzw. bis „Prüfen".

| ex | Maß | Gut bis | Leicht bis |
|---|---|---|---|
| mc_en, spot, listen_mc | T | 8 s | nie |
| mc_de, match | T | 9 s | nie |
| colloc | T | 11 s | nie |
| cloze_hint | L | 6 s | 2,5 s |
| cloze, type | L | 8 s | 3 s |
| tiles | T − 600 ms × Bausteine | 9 s | 3,5 s |
| dictation | L ab Tonende, + 1.200 ms je Wiederholung | 6 s | 2,5 s |
| speed | T gegen die Grenze G | ≤ G → 3 | ≤ 0,6·G → 4 |
| produce | KI: `correct` → 3, `minor` → 2, `wrong` oder `usesTarget:false` → 1 · Selbsturteil (§4.10): alles bestanden → 3, Wort fehlt → 1, sonst 2 | | nie vorgeschlagen |

**Allgemeine Regeln:**
- `wrong` → 1, `near` → 2.
- Richtig, aber langsamer als „Gut" → 2.
- Hilfe (erster Buchstabe) genutzt → höchstens 2.
- 3 oder mehr Rücktasten → höchstens 3.
- `T > L + 1 s × Zeichen + 5 s` → höchstens 3.
- `speed` mit abgelaufener Zeit: Die Eingabe wird geprüft; richtig → 2, sonst 1.

**Wählbar (MVP, `allowedGrades`):** `wrong` → {1,2}, `near` → {1,2,3}, `correct` → {1,2,3,4}.

Gespeichert wird die gewählte Note (`hist.g`, `log.g`); der Vorschlag lebt nur im Speicher.

`Timing` (Schritt 0, `types.ts`):

```ts
export type Timing = { submitMs: number; firstKeyMs?: number; chars?: number; deletions?: number;
  hintUsed?: boolean; tiles?: number; replays?: number; timedOut?: boolean; limitMs?: number };
```

### 4.8 Tagesplan und Pflicht (P5 `domain/plan/*`, P4 `persist.ts`)

**`ensureDay(nowMs)`** (P5, `features/today/store.ts`) läuft einmal je (Tab, Lerntag).
- **Bedingungen:** db bereit, `useLive.status === 'ready'`, umgestellt (`schema.version ≥ 1`), Seite sichtbar.
- **Auslöser:** Start, `visibilitychange: visible`, Wechsel von `useClock.today`.
- **Ablauf in dieser Reihenfolge**, jeder Schritt protokolliert Fehler und blockiert die folgenden nicht:
  1. Karten aus dem Tagesauftrag (§3.8).
  2. Plan:
     - `planRound` über Vokabeln und Chunks (`buildTrainCards` + `buildChunkCards`);
     - `buildPlan` (MVP);
     - `goal = {review: target, due, new, ahead}`;
     - `transform('app/profile')` wie im MVP;
     - bei Fehler bleibt der lokale Plan für den Tag (`status:'local'`).
  3. `pflichtSince` (§3.7), nur bei `duty.length > 0`.
  4. Selbstheilung: `deriveToday(...).status === 'allDone'` aus dem Live-Log und `!pflicht[heute]` → `transform('app/profile', cur => cur.pflicht?.[heute] ? null : {update:{pflicht:{[heute]:1}}})`. Nur wenn `useLive.day.key === heute` geladen ist.

**`deriveToday`** (P5, erweitert; die EINE Ableitung):

```ts
export type TodayState = {
  day: string;
  status: 'noPlan' | 'nothing' | 'open' | 'allDone';
  duties: { done: number; total: number; missing: DutyId[] };   // „0 von 1 · es fehlt: Wiederholen"
  review: { done: number; total: number };                      // „12 von 22 Karten"
  extra: number;                                                // verschiedene Karten mit ctx 'xtra'
  balance: { answers: number; correct: number; minutes: number };
};
export function deriveToday(i: { day: string; plan: StoredPlan | null; entries: readonly DayEntry[];
  minutes: number; pflichtMarked?: boolean }): TodayState;
```

- **`review.done`:** `min(total, |{entryCardKey(e) : e.ctx === 'rev'}|)`. Vokabeln **und** Chunks zählen; Alt-Einträge ohne `ctx` nie.
- **`pflichtMarked`:** `review.done = total`.
- **`status`:**
  - kein Plan → `noPlan`;
  - `duty` leer oder `goal.review = 0` → `nothing`;
  - `review.done ≥ total` → `allDone`;
  - sonst `open`.
- **`duties`:** `total = duty.length`; `done` = Zahl erledigter Pflichtpunkte (Phase 1: 0 oder 1); `missing` in Plan-Reihenfolge.
- **`balance`:** alle Einträge von heute (auch ohne `ctx`), `minutes[heute]` plus Puffer.

**Pflicht setzen** (P4, `persist.ts`, in `flushOnce` vor dem Profil-Schreiben):

```ts
const plan = useTodayPlan.getState();                // nur wenn plan.day === day
const st = deriveToday({ day, plan: plan.plan, entries: todayEntries(day), minutes: 0 });
const pflichtDay = st.status === 'allDone' || exhaustedRounds.has(day) ? day : null;
profilePatch(cur, answers, rounds, { deviceId, seq, pflichtDay });
```

- `recordAnswer` löst den Sammel-Schreibvorgang **sofort** aus, sobald `deriveToday` nach dieser Antwort `allDone` ergibt.
- **Erschöpft:** Die Pflichtrunde endet (Warteschlange leer), `review.done < total`, und `buildQueue(…mode:'pflicht')` liefert für den Rest nichts mehr. Dann gilt `exhaustedRounds.add(day)`, die Zusammenfassung zeigt „Mehr Karten gibt es heute nicht – Wiederholen ist erledigt", und `pflicht[day] = 1`. Heute zeigt dann `done = total` (`pflichtMarked`).

### 4.9 Wortschatzziel 8.000 (P5, `src/domain/vocab/goal.ts`)

```ts
export type VocabGoal = { target: 8000; now: number | null; band: [number, number] | null; perWeek: number;
  weeks: number | null; reached: boolean; measured: boolean };
export function vocabGoal(i: { profile: Doc; cards: readonly TrainCard[]; nowMs: number }): VocabGoal;
```

- **Messwert V0:** letzter Eintrag in `profile.vtests[]` mit Zahl `passive` (Band `pLo`/`pHi`, Datum `d`), sonst letzter `history[].vs` ohne Band, sonst `null`.
- **Gelernt seit der Messung:** L = Vokabelkarten (keine Chunks, nicht ausgeblendet) mit `intro ≥ d` und `fsrs.stability ≥ 7`. Es gilt `now = V0 + L`.
- **Tempo:** `perWeek` = Vokabelkarten mit `intro` in den letzten 28 Lerntagen × 7/28.
- **Wochen:** `weeks = ceil((8000 − now) / perWeek)`. Bei `perWeek < 1` → `null` (Anzeige „zu wenig Daten").
- **Ziel erreicht:** `now ≥ 8000` → `reached`.
- **Anzeige** nur auf „Dein Stand": „Ziel C1: 8.000 Wörter · jetzt etwa {now} · bei {perWeek} neuen Wörtern pro Woche in rund {weeks} Wochen".

### 4.10 Eigener Satz ohne KI (P4, `src/features/vocab/produce.ts`)

```ts
export type SelfCheck = { containsTarget: boolean; longEnough: boolean; notCopied: boolean; suggested: Grade; models: string[] };
export function selfCheckProduce(sentence: string, card: TrainCard): SelfCheck;
```

- **`containsTarget`:** Eine Form des Lemmas (`formsOf` + `lemmaCandidates`) steht im Satz; bei Mehrwort alle Inhaltswörter, höchstens 2 Wörter dazwischen.
- **`longEnough`:** mindestens 6 Wörter.
- **`notCopied`:** Jaccard der Wortmengen zu `ex` und jedem `col.ex` unter 0,8.
- **`models`:** Beispielsatz und Kollokationssätze ohne Klammern.
- **Vorschlag:** alles bestanden → 3; Wort fehlt → 1; sonst 2. Wählbar sind alle vier Noten.

### 4.11 Begründungen (P1 `explain.ts`, immer 1–3 Zeilen, auch bei richtiger Antwort)

Reihenfolge; der erste passende Baustein zuerst, höchstens 3:

| Fall | Bausteine (i18n-Schlüssel) |
|---|---|
| falsch, Ablenker gewählt | `whyChoiceBelongs {chosen, word}` bzw. `whyWordIs {word, meaning}` (mc_de) bzw. `whyCollocWrong {chosen, p}` (MVP) |
| falsch, anderes echtes Wort | `whyOtherWord {given, word}` (MVP); neu mit Wörterbuch-Bedeutung: `whyOtherWordMeaning {given, meaning, word}` |
| fast, Tippfehler | `whyTypo` (MVP) |
| fast, Form | `whyForm {form, lemma}` (MVP); unregelmäßig: `whyIrregular {form, lemma}` |
| fast, Mehrwort | `whyPartial` |
| britisch | `whyUk {us}` (MVP) |
| Zeit abgelaufen | `whyTimeUp` |
| immer (auffüllen) | `whyMeaning {word, meaning}` → `whyPos {pos}` → `whyPrep {verb, prep}` (letztes Wort ∈ Präpositionsliste, z. B. rely + on) → `whyCollocDe`/`whyColloc` (MVP) → Chunk: `whyRegister {register}`, `whyChunkWhy {why}` (nur DE und nur, wenn `why` deutsch ist) |
| nichts davon | `whyWordOnly {word}` (MVP) |

Inhalte (`de`, `def`, Wörter) werden unverändert eingesetzt und im DOM mit `lang` ausgezeichnet: englisch `lang="en"`, deutsch nur in der DE-Oberfläche.

---

## 5. Interaktion und Bildschirme

### 5.1 DOM-Vertrag (für alle Pakete und die E2E-Suite verbindlich)

Vor dem Prüfen steht die Lösung **nirgends** im DOM: kein `data-correct`, kein Lösungswort in Attributen, keine versteckten Knoten.

| Bereich | Testkennungen und Attribute | Paket |
|---|---|---|
| Rahmen | `[data-screen]` (bestehend) · `tabbar`, `tab-today`, `tab-overview`, `open-settings` | INT |
| Heute | `today-status` (h1, `data-status`, `data-done`, `data-total`) · `today-streak` (`data-count`) · `today-rest` · `hero` (`data-item-id="review"`) · `hero-progress` (role=progressbar, `aria-valuenow`/`aria-valuemax` = review done/total) · `start` · `done-item` (`li[data-state="done"]` **ohne** bedienbares Kind) · `extra` (`data-count`) · `start-extra` · `balance` | P5 |
| Trainer | `trainer` · `trainer-close` · `trainer-progress` (`data-done`, `data-total`) · `exercise` (`data-ex`, `data-card`, `data-stage`, `data-input`, `data-reason`) · `ladder` (`data-stage`) · `task` · `purpose` · `sentence` (`lang="en"`) · `cue`, `cue-meaning` · `choices`, `choice` (nach dem Prüfen `data-state=correct\|wrong`) · `check` · `dont-know` · `hint` · `replay` · `speed-bar` (`data-left-ms`) · `produce-input` · `ai-phase` (`data-ai-phase`) · `ai-stop` · `ai-retry` · `self-models` · `leech` · `result` · `verdict` (`data-verdict`) · `given` · `solution` · `why` · `rating` mit `button[data-grade][data-suggested]` · `intro`, `intro-word`, `intro-continue`, `origin-sentence`, `origin` · `summary`, `summary-stats`, `summary-back`, `summary-extra`, `summary-retry-save` | P4 |
| Engine | `gap` (`data-state=input\|correct\|near\|wrong`, `data-value`) · `gap-input` · `[data-letter][data-landed]` · `[data-flyer]` · `gap-correction` · `word-diff` · `tiles-pool` · `tile` (`data-placed`) · `tile-slot` | P2 |
| Nachschlagen | `button.lx-word[data-word][data-lookup]` in `[lang="en"]` · `lookup` (role=dialog) · `lk-headword` · `lk-ipa` · `lk-pos` · `lk-meaning` · `lk-def` · `lk-example` · `lk-listen` · `lk-save` · `lk-saved` (Zustand, **kein** Knopf) · `lk-restore` · `lk-ask` (`[data-ai]`) · `lk-sense` · `lk-back` · `lk-close` | P3 |

Jeder Knopf, der Claude fragt, trägt `data-ai`.

### 5.2 Heute (P5)

**Aufbau (390 px, Ränder 16 px):**
1. Kopf: Datum des Lerntags, Serie „Serie: {n} Tage" (`tdStreak`) und dezent „Ruhetag diese Woche noch frei/genutzt".
   - Der Ruhetag-Hinweis erscheint nur ab `pflichtSince ≤ heute`: `computeStreak(...).restDays` in `isoWeek(heute)` → genutzt.
   - Bei Serie 0 entfällt die Zeile.
2. Statuszeile (h1): offen → `tdStatusOpen {done, total, missing}` mit `Intl.ListFormat` für `missing`; fertig → `tdStatusDone`, mit Extra `tdStatusDoneExtra_{one,other}`; nichts → `tdStatusNothing`.
   - Skelett, bis Plan **und** `log/<heute>` geladen sind.
3. Heldenkarte (nur bei `open`, `layoutId="task-review"`):
   - Titel „Wiederholen", Ring (`ProgressRing` 56 px, ab `lg` 64 px) mit `review.done/total`.
   - Begründung `tdReviewPlan {n, due, fresh, min}`, bei `ahead > 0` + `tdReviewAhead {ahead}`; bei MVP-Plänen ohne Aufschlüsselung `tdReviewWhy`.
   - Ein Primärknopf `start`: „Wiederholen starten" bzw. `tdContinue {n}`.
   - Minuten: `ceil(rest × 27 s / 60)` (Mittel aus 600 s / 22 Karten).
4. Erledigt: `li[data-state=done]` mit Häkchen, „Wiederholen · {total} von {total} erledigt", kein Knopf und kein `tabindex`.
5. Freiwillig (nur bei `allDone`): Sekundärknopf `start-extra` „Freiwillig weiterüben · 10 Karten", Hinweis „Zählt als Extra, nicht zum Tagesziel."
6. Tagesbilanz `balance`: „Heute: {answers} Antworten · {pct} % richtig · {min} Min.". Ohne Antworten ausgeblendet.

**Weitere Regeln:**
- **„Starten":** Im Klick-Handler synchron: `unlockSpeech()` (WP1), dann `startSession('pflicht')`, dann `focusNow()`, wenn die erste Übung getippt wird, dann `go(trainer)` (MVP-Muster).
- **Tageswechsel** bei offener App: `useClock.today` wechselt, `startDayLive` abonniert neu, `ensureDay` läuft, und Heute blendet über.
- **Enter** auf Heute startet die Hauptaufgabe, wenn kein Eingabeelement fokussiert ist.

### 5.3 Trainer (P4)

**Aufbau:**
- Leiste: ✕ (`trainer-close`, 44 px), Fortschrittsbalken, `{n}/{total}` (`layoutId="task-review"`).
- Darunter `ExerciseFrame` mit den vier Pflichtfragen an fester Stelle (MVP):
  1. `task`
  2. `purpose` mit Leiter
  3. Aufgabe und Aktionen („Prüfen", „Weiß ich nicht", „Erster Buchstabe" bei `type`/`cloze`, „Nochmal hören" bei Hör-Arten)
  4. `result` (Was hatte ich, was ist richtig?)
  5. `why`
  6. `rating`
  - Die Quelle steht als Fußzeile (`origin`).
- Karte oben ausgerichtet, Satz `text-[1.375rem]` (ab `lg` 1.75rem), Knöpfe im Fluss direkt unter dem Satz.

**Ablauf einer Übung** (`src/features/vocab/exerciseMachine.ts`, XState 5):

```
context: { exercise, env, startedAt, pausedMs, firstKeyAt, deletions, replays, hintUsed, checked: CheckedAnswer | null,
           ai: ProduceCheckOut | null, aiPhase: AiPhase | null }
states:
  presenting  entry: bei listen_mc/dictation speak(exercise.speak) → on SPOKEN → input (Uhr startet)
              sonst sofort → input
  input       on SUBMIT{answer} → checking · on TIMEOUT (nur speed) → checking(timedOut) · on HINT → input (hintUsed)
              on REPLAY → input (replays+1, speak) · on DONT_KNOW → checking(verdict wrong)
  checking    always: produce && env.ai && Satz nicht leer → aiChecking ; sonst → feedback (lokal geprüft)
  aiChecking  invoke fromPromise(askJson({ template: produceCheck, vars, signal })) ; onDone → feedback ;
              onError(kind 'cancelled') → input ; onError(sonst) → feedback (Selbsturteil, Hinweis aiMessageKey) ;
              on STOP → abort → input
  feedback    on RATE{grade} (nur allowedGrades) → done
  done        final, output { grade, given, ms, ok }
```

- Die Maschine läuft per `useMachine` je Übung (Schlüssel `step`).
- Beim Aushängen bricht `useAiScope()` das KI-Signal ab.

**Tastatur und Fokus:**
- Enter prüft bzw. übernimmt den Vorschlag.
- 1–4: Option wählen bzw. Note wählen (bewertet **und** geht weiter).
- Esc: Popover schließen, sonst Trainer verlassen.
- Leertaste: Ton wiederholen, wenn der Fokus nicht im Eingabefeld ist.
- Touch nach dem Prüfen: `api.blur()` (E13). Im Bewertungsknopf-Handler synchron `focusNow()`, wenn die nächste Übung getippt wird.

**Beenden:**
- ✕ oder Esc in der Frage → nichts gespeichert.
- In der Rückmeldung → der Vorschlag wird gespeichert.
- Danach Sammel-Schreibvorgang und zurück zu Heute (MVP).

**Hören:**
- `env.tts = useSpeech.status === 'ready'` zu Rundenbeginn.
- Liefert `speak` den Wert `'unavailable'`: Hinweis `trAudioOff`, der Satz wird sichtbar, die Übung läuft weiter, und `env.tts = false` für den Rest der Runde.

**Eigener Satz:**
- `textarea` (16 px, `autocapitalize="sentences"`, `autocorrect="on"`).
- „Prüfen lassen" (`data-ai`, nur bei `useAiAvailable()`).
- Anzeige der Phasen: „Denkt nach …" → Streaming entfällt (JSON); bei `slow` Hinweis + `ai-stop`.
- Ergebnis: `fixed` (lang=en), `why` (Oberflächensprache), `better` (lang=en).
- Ohne KI oder bei Fehler: `self-models` + Selbsturteil.

**Blutegel:** Chip `leech` „hartnäckig".

**Zusammenfassung:**
- Zahl der Antworten, Anteil richtig, Wörter der Runde als antippbare Liste.
- „Pflicht erledigt" bzw. `sumExhausted`.
- Knöpfe: „Zurück zu Heute" (primär) und bei erledigter Pflicht „Freiwillig weiter" (`summary-extra`).
- Gescheiterte Speicherungen → `summary-retry-save` (nur auf Knopfdruck).

### 5.4 Kinetische Lücke und Rückmeldung (P2)

- **Bestehend (MVP):**
  - Ein dauerhaftes, unsichtbares `<input>` über der Lücke (`HiddenInput`, 16 px, `autocapitalize="none"`, `autocorrect="off"`, `spellcheck=false`, `enterkeyhint="go"`).
  - Fliegende Buchstaben (höchstens 12, 240 ms, nur `transform`/`opacity`).
  - Die Lücke wächst mit der Textbreite; die Anfangsbreite ist fest und hängt nicht von der Lösung ab.
- **Neu:**
  - **Richtig:** `--lx-accent-soft`, Kante `--lx-accent`, Lichtimpuls `@keyframes lx-pulse` (box-shadow 0 → 10 px accent/35 % → 0, 260 ms), `haptic('success')` (WP1, nur wenn `navigator.vibrate` existiert).
  - **Fast:** `--lx-gold-soft`, abweichende Buchstaben als `<mark data-diff>` mit gewellter goldener Unterstreichung (`marks`).
  - **Falsch:** `--lx-danger-soft`. Die Korrekturzeile `gap-correction` schiebt sich unter die Lücke (Lücke `inline-flex column`, Grundlinie der ersten Zeile, Höhe 0 → auto, y −6 → 0, 220 ms). Darunter im Ergebnis der Wort-für-Wort-Vergleich `word-diff` (Mehrwort).
  - **Reduzierte Bewegung:** kein Flug, kein Impuls, Farbwechsel mit 120 ms Überblendung.
- **`AnswerFeedback`** (`src/engine/AnswerFeedback.tsx`, Schritt 0 aus dem MVP herausgelöst):
  ```ts
  export type AnswerFeedbackProps = {
    verdict: Verdict; us: string | null;
    given: string; givenLang: Lang; expected: string; expectedLang: Lang;
    marks?: boolean[]; words?: WordPart[];
    labels: { verdict: string; your: string; solution: string; empty: string; wordDiff: string };
  };
  ```
- **`KineticGap`** bekommt in Schritt 0 die Eigenschaft `solution?: string | null`. Die Korrekturzeile gibt es bei `state === 'wrong'`.

### 5.5 Bausteine (P2, `src/engine/tiles/*`, `src/features/vocab/views/TilesBody.tsx`)

```ts
export type TileState = { placed: string[] };                       // Kennungen in Reihenfolge
export function placeTile(s: TileState, id: string): TileState;     // am Ende anfügen, nie doppelt
export function removeTile(s: TileState, id: string): TileState;
export function removeLast(s: TileState): TileState;
export function insertionIndex(p: { x: number; y: number }, rects: readonly DOMRect[]): number; // nächster Mittelpunkt ≤ 48 px, links/rechts
export type TileBoardProps = { tiles: Tile[]; placed: string[]; mode: 'letters' | 'words'; slotted: 'single' | 'sequence';
  onChange(next: string[]): void; disabled: boolean; announce(text: string): void };
```

- **Tippen:** Ein Baustein im Vorrat gleitet in die Lücke (`layoutId="tile-<id>"`, Feder 520/40); ein Tipp auf einen gesetzten Baustein legt ihn zurück. Die übrigen rücken per `layout` nach.
- **Ziehen:** `drag` + `dragSnapToOrigin`, Schwelle 4 px. Loslassen über `tile-slot` setzt ab. `touch-action:none` nur auf dem Baustein.
- **Tastatur:**
  - Buchstabe legt den ersten passenden freien Baustein (`letters`);
  - Ziffer n legt den n-ten;
  - Rücktaste nimmt den letzten zurück;
  - Alt+←/→ verschiebt (`sequence`);
  - Enter prüft.
- **`match`** (`slotted:'single'`): Das Setzen eines Bausteins prüft sofort.
- **`tiles`** (`sequence`): Prüfen per Enter oder „Prüfen", sobald mindestens 1 Baustein gesetzt ist.
  - Buchstaben → `checkTyped(joined, accepted, …)`; Wörter → `checkTokens`.
- **Maße:** mindestens 44 × 44 px, Glas, Buchstaben `text-lg`. Leerzeichen als breiter Baustein „␣" mit `aria-label`.
- **`TilesBody`** implementiert `ExerciseBodyProps` (§9.0) für `input === 'tiles'`.

### 5.6 Wort-Antippen (P3)

**`EnglishText`** (`src/engine/EnglishText.tsx`, Schritt 0 Grundversion, P3 verfeinert):

```ts
export type EnglishTextProps = {
  text: string;                                           // ohne Lückenklammern
  area: WordTapArea; source?: string | null;              // z. B. 'vocab/reliable' → origin.ref
  exclude?: readonly [number, number] | null;             // nicht antippbar (Lösung während der Frage)
  highlight?: readonly [number, number] | null;           // markiertes Zielwort (mc_en)
  slot?: { start: number; end: number; node: ReactNode } | null;   // Lücke im Satz
  onPick?: (token: Token, index: number) => void;         // spot: Wort ist Antwort, kein Nachschlagen
  as?: 'p' | 'span' | 'div'; className?: string;
};
```

- **Aufbau:** Container `lang="en"`. Zerlegung mit `tokenize` (WP3).
  - Wörter als `<button type="button" class="lx-word" data-word data-lookup={key}>`, `display:inline`, Trefferfläche per Padding/negativem Margin, keine Layoutänderung.
  - Satzzeichen, Zahlen und `exclude` sind reiner Text.
  - Ohne `WordTapContext` und ohne `onPick` gibt es keine Knöpfe.
- **Wandernder Tab-Index:** genau ein Wort je Text mit `tabIndex=0`. ←/→, Pos1 und Ende bewegen, Enter und Leertaste öffnen.
- **Im Trainer:**
  - Vor dem Prüfen ist die Zielspanne `exclude`, bei `spot` alle Wörter `onPick`.
  - Nach dem Prüfen ist alles antippbar (Kap. 15).

**Anfrage** (`src/engine/wordTap.ts`, Schritt 0, fest):

```ts
export type WordTapArea = 'trainer' | 'intro' | 'summary' | 'lookup';
export type WordTapRequest = { surface: string; text: string; start: number; end: number;
  tokens: readonly Token[]; index: number; area: WordTapArea; source: string | null; anchor: HTMLElement };
export const WordTapContext: React.Context<((req: WordTapRequest) => void) | null>;
export const useLookupOpen: UseBoundStore<StoreApi<{ open: boolean }>>;
```

**Auflösung** (`src/domain/lookup/resolve.ts`, synchron bis Schritt 6; der erste Treffer gewinnt):
1. **Wendung:** `findPhrase` (WP3) mit `isPhrase` = Mehrwort-Schlüssel aus `dict.json` ∪ mehrwortige Karten ∪ Chunk-`en`. Sie wird oben angezeigt, ein Umschalter führt zum Einzelwort.
2. **Grundform:** `lemmaCandidates(surface)` (WP3); der erste Kandidat, der als Karte, im Zwischenspeicher, im Wörterbuch oder in der Funktionswortliste existiert, gewinnt.
3. **Eigene Karte** (`mergedVocab` und Chunks, auch ausgeblendete): Bedeutung der Karte, Stufe, bei `hidden` „Wieder aufnehmen".
4. **Zwischenspeicher** `app/lookup.items[lemma]` (einmal je Seitenaufruf per `readDoc` geladen). Die Notiz erscheint nur in der Oberflächensprache.
5. **`dictLookup(lemma, posHint)`** (WP3, US-Index). Die Wortart-Heuristik bestimmt `posHint`:
   - Vorgänger ∈ {a, an, the, this, that, these, those, my, your, his, her, its, our, their, some, any, no, every, each} → Nomen;
   - ∈ {to, can, could, will, would, shall, should, may, might, must, I, you, we, they, he, she, it} → Verb;
   - Endung `-ly` → Adverb.
6. **`function-words.json`**: `{ "the": { "pos": "det", "de": "der, die, das", "en": "definite article" }, "don't": { "full": "do not" }, … }`.
7. **Nichts gefunden** und `useAiAvailable()` → sofort `askJson(wordLookup, {word, sentence: text, uiLang})`. Das Antippen ist die ausdrückliche Handlung. Das Ergebnis wird gespeichert (§3.9). Ohne KI: `lkNotFound`, kein Speichern.

**Popover bzw. Blatt** (`src/ui/Popover.tsx`, `src/features/lookup/LookupPopover.tsx`):
- **Desktop:**
  - verankert, Breite `min(22rem, 100vw − 32px)`, links `clamp(mitte − B/2, 16, innerWidth − 16 − B)`;
  - unter dem Wort (8 px Abstand), sonst darüber, sonst innen scrollend;
  - `role="dialog" aria-modal="false"`;
  - Tab durch die Aktionen; Klick außerhalb schließt.
- **Touch:** Blatt unten, Glas, `max-height: 60svh`, `aria-modal="true"`, Hintergrund `inert`, Wischen nach unten (> 80 px oder > 500 px/s) schließt.
- **Fokus:** Esc schließt und gibt den Fokus an das Wort zurück.
- **Offene Tastatur beim Antippen:** Der Handler ruft `blur()` auf. Beim Schließen folgt synchron `focusNow()`, wenn das Feld vorher fokussiert war.
- **Inhalt:**
  - Stichwort (US-Form) und Wortart;
  - `/IPA/` (`ipaOf`, WP3; sonst `ipa` aus dem Zwischenspeicher);
  - 🔊 `lk-listen` (nur bei `useSpeech.status === 'ready'`);
  - Bedeutung: DE `de` + `def` (lang=en); EN nur `def`;
  - Beispiel: aktueller Satz bzw. KI-`ex`, antippbar, Stapel bis 5 mit Zurück;
  - Hinweise „Grundform von …", „… = do not", „Amerikanisch: …";
  - Quelle.
- **„Als Karte speichern"** (`lk-save`):
  - `saveCard.ts` → `transform('vocab/<slug>')` nach der Kollisionstabelle §3.1 mit `newVocabDoc` (`src:'lookup'`, `origin.kind = area`, `origin.ref = source`).
  - Ursprungssatz: Satz mit mindestens 4 Wörtern, sonst KI-`ex` mit dem Wort, sonst **kein** Speichern (`lkNoSentence`, Kap. 15).
  - Danach Zustand `lk-saved` „In deinen Karten · Neu", Toast „Als Karte gespeichert" mit „Rückgängig" → `update({hidden:true})`.
- **„Claude fragen"** (`lk-ask`, `data-ai`):
  - `wordLookup` mit dem Satz; zeigt `sense` und `note`; ergänzt `note_<ui>` im Zwischenspeicher.
  - Phasen „Denkt nach …"; nach 8 s `aiSlow` + Stopp; Fehlertexte über `aiMessageKey` (WP1).
  - „Erneut versuchen" nur auf Knopfdruck, genau ein Aufruf je Klick.

### 5.7 Übergänge (P2 Konstanten, INT Verdrahtung)

- `ui/motion.ts` (Schritt 0 ergänzt, P2 verfeinert):
  ```ts
  export const LAYOUT_ID = { review: 'task-review' } as const;
  export const SHARED = { type: 'spring', stiffness: 420, damping: 38 } as const;   // ≈ 280 ms
  export const CARD_SWAP = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 } };
  ```
- **Heute → Trainer:** Die Heldenkarte (`layoutId = LAYOUT_ID.review`) wird zur Trainerleiste, 280 ms. Zurück schrumpft sie, und das Häkchen zeichnet sich (`pathLength` 0 → 1, 240 ms).
- **Karte → Karte:** `AnimatePresence mode="wait"`, 160 ms aus, 220 ms ein.
- **App** (INT): `<LayoutGroup>` um `AnimatePresence mode="popLayout"`. `loading`, `nodb`, `offline` und `migration` blenden nur über.
- **Reduzierte Bewegung** (`MotionConfig reducedMotion="user"`, besteht): nur Überblendungen, 120 ms.

### 5.8 Design-Ergänzungen (P2, `src/styles/index.css`)

- **Tokens in allen drei Modi:**

  | Token | dunkel | gedämpft | hell |
  |---|---|---|---|
  | `--lx-gold-soft` | rgba(251,191,36,.14) | rgba(252,211,77,.14) | rgba(180,83,9,.10) |
  | `--lx-danger-soft` | rgba(248,113,113,.14) | rgba(252,165,165,.14) | rgba(185,28,28,.08) |
  | `--lx-cyan-soft` | rgba(34,211,238,.12) | rgba(126,233,247,.12) | rgba(8,145,178,.10) |

  Kontrast von `*-text` auf `*-soft` über Hintergrund und Glas mindestens 4,5:1 (`contrast.test.ts`).
- **Klassen:** `.lx-word` (hover/aktiv `--lx-cyan-soft`, Unterstreichung Cyan, `[data-active]`), `.lx-ipa`, `.lx-gap-correction`, `mark[data-diff]`, `@keyframes lx-pulse`, `.lx-tile`.
- **Schrift:** `@font-face` für Inter greek mit `unicode-range: U+03B8`, nur θ (≈ 40 KB Base64).
- **Symbole** (`Icon.tsx`): `speaker`, `stop`, `sparkle`, `bookmarkPlus`, `arrowUp`, `undo`, `lightbulb`.

---

## 6. KI-Tor und Prompts

Gebaut in WP1 (`src/ai/*`, `src/prompts/*`). Phase 1 nutzt es unverändert. Die Regeln im Überblick:

| Regel | Umsetzung |
|---|---|
| Verfügbarkeit | `getSample() === null` → `AiFailure('unavailable')` ohne Aufruf; KI-Knöpfe nur bei `useAiAvailable()` |
| Drosselung | höchstens 2 gleichzeitig (`aiQueue`), `user` vor `background`; nach `rate_limited` 60 s Pause ohne Aufruf; lokal höchstens 20 Aufrufe je 60 s |
| Abbruch | je Aufruf ein eigener `AbortController`, gekoppelt an das Bildschirm-Signal (`useAiScope`) bzw. den Stopp-Knopf; Abbruch in der Warteschlange → 0 Aufrufe; `AbortSignal.any` wird nicht verwendet (Safari 16) |
| Kein Timeout (A6.2) | `SLOW_AFTER_MS = {quick: 8000, default: 45000, complex: 90000}` → Phase `slow` mit Stopp, nie automatischer Abbruch |
| Neuversuch (A6.3) | nur bei Schemafehler, genau einmal, mit angehängter Fehlerbeschreibung (andere Eingabe, kein Cache-Treffer); `invalid_json`, `rate_limited` und alle anderen Codes nie |
| Fehlercodes | `not_granted`/`sampling_disabled`/`not_declared`/`capability_*` → `markSampleRevoked()`, KI-Teile ausblenden; `rate_limited` → `aiBusy`; `session_expired` → `aiSignin`; `refused` → Teiltext weg; `invalid_json`/`upstream_error`/unbekannt → Knopf „Erneut versuchen"; `prompt_too_large`/`invalid_request`/`transform_error`/`queue_overflow` → `logError` |
| Größe | Prompt ≤ 60.000 UTF-8-Bytes vor dem Aufruf geprüft |
| Sprachtreue | Schemas prüfen erklärende Felder mit `detectLang` (ab 4 Wörtern); falsche Sprache → Schemafehler → ein Neuversuch |

**Vorlagen in Phase 1:**
- `word-lookup@1`:
  - `tier:'quick'`, `cache:{gcTime: 86_400_000}`.
  - Variablen `{word ≤ 60, sentence ≤ 400, uiLang}`.
  - Ausgabe `{lemma, pos, ipa, level, de, def, ex, sense, note}` (`src/prompts/wordLookup.ts`).
- `produce-check@1`:
  - `tier:'quick'`, `cache:true`.
  - Variablen `{target, meaning ≤ 120, sentence ≤ 300, uiLang, kind}`.
  - Ausgabe `{verdict: correct|minor|wrong, usesTarget, fixed, why, better}` (`src/prompts/produceCheck.ts`).
  - Britische Formen gelten als richtig; `why` nennt die US-Form nur als Tipp.

Kein Prompt-Text in Oberflächendateien (Test U-PROMPT-06). Weitere Vorlagen gibt es in Phase 1 nicht.

---

## 7. Texte (i18n)

### 7.1 Aufbau (Schritt 0)

- `src/i18n/de.ts` und `en.ts` sind nur noch Sammler:
  ```ts
  export const de = { ...coreDe, ...todayDe, ...trainerDe, ...learnDe, ...engineDe, ...lookupDe, ...aiDe } as const;
  export type MessageKey = keyof typeof de;
  export const en: Record<MessageKey, string> = { ...coreEn, ...todayEn, ...trainerEn, ...learnEn, ...engineEn, ...lookupEn, ...aiEn };
  ```
- Jeder Teil `src/i18n/parts/<teil>.de.ts` exportiert `<teil>De` (`as const`), `<teil>.en.ts` exportiert `<teil>En: Record<keyof typeof <teil>De, string>`.
- **Schritt 0 verschiebt die Schlüssel:**
  - `nav*`, `td*` sowie die Schlüssel von „Dein Stand" und den Einstellungen, die P5 ändert (`streak*`, `ov*`, `vocab*`, `settings*`, `diag*`) → `today`;
  - `tr*`, `grade*`, `iv*`, `ladderLabel`, `intro*`, `sum*` → `trainer`;
  - `task_*`, `purpose*`, `why*`, `pos_*`, `srcLabel`, `src_*` → `learn`;
  - `engine` und `lookup` sind leer;
  - `ai` kommt aus WP1;
  - Übriges bleibt `core` (u. a. `mig*`, `late*`, `export*`, `theme*`, `stage0..5`) und wird von keinem Paket geändert.
- **`tests/unit/i18n.test.ts` (Schritt 0):**
  - keine gemeinsamen Schlüssel zwischen Teilen;
  - gleiche Schlüssel und Platzhalter DE/EN je Teil;
  - EN ohne Umlaute und ohne deutsche Merkmalwörter;
  - DE ohne englische Oberflächenwörter (Liste im bestehenden Test).
- **Regeln:** amerikanische Schreibweise in EN, Mehrzahl `_one`/`_other`, Listen per `Intl.ListFormat`.

### 7.2 Neue und geänderte Schlüssel (DE | EN)

**`today` (P5)**

| Schlüssel | DE | EN |
|---|---|---|
| tdStatusOpen (geändert) | Noch nicht fertig · {done} von {total} · es fehlt: {missing} | Not done yet · {done} of {total} · still open: {missing} |
| tdStatusDoneExtra_one / _other | Fertig für heute · Extra: {n} Karte / … {n} Karten | Done for today · extra: {n} card / … {n} cards |
| duty_review | Wiederholen | Review |
| tdReviewPlan_one / _other | {n} Karte · {due} fällig · {fresh} neu · etwa {min} Min. / {n} Karten · … | {n} card · {due} due · {fresh} new · about {min} min / {n} cards · … |
| tdReviewAhead | · {ahead} vorgezogen | · {ahead} ahead of schedule |
| tdProgressCards | {done} von {total} Karten | {done} of {total} cards |
| tdRestFree | Ruhetag diese Woche noch frei | Rest day still free this week |
| tdRestUsed | Ruhetag diese Woche genutzt | Rest day used this week |
| streakTodayDone (geändert) | Heute zählt schon für die Serie | Today already counts toward your streak |
| ovChunks | Wendungen: {n} · {due} fällig | Phrases: {n} · {due} due |
| ovGoalTitle | Ziel C1: {target} Wörter | C1 goal: {target} words |
| ovGoalNow | jetzt etwa {now} | about {now} now |
| ovGoalEta | bei {rate} neuen Wörtern pro Woche in rund {weeks} Wochen | at {rate} new words a week, in about {weeks} weeks |
| ovGoalNoData | Für eine Prognose fehlen noch Daten. | Not enough data for a forecast yet. |
| ovGoalNoTest | Noch keine Messung – mach einmal den Wortschatztest. | No measurement yet – take the vocabulary test once. |
| ovGoalReached | Ziel erreicht. | Goal reached. |
| setLearning | Lernen | Learning |
| setNewPerDay | Neue Wörter pro Tag | New words per day |
| setNewPerDayNote | Wirkt ab der nächsten Runde. Die Kartenzahl von heute bleibt. | Takes effect from the next round. Today's card count stays the same. |
| setLicenses | Quellen und Lizenzen | Sources and licenses |
| setLicenseCmu | Aussprache: CMU Pronouncing Dictionary, © Carnegie Mellon University, BSD-Lizenz | Pronunciation: CMU Pronouncing Dictionary, © Carnegie Mellon University, BSD license |
| diagSizes | Größe: Profil {profile} KB · Nachschlagen {lookup} KB | Size: profile {profile} KB · lookups {lookup} KB |
| diagSizeWarn | Das Dokument wird groß – bitte in claude.ai Bescheid geben. | This document is getting large – please let us know in claude.ai. |

**`trainer` (P4)**

| Schlüssel | DE | EN |
|---|---|---|
| trDontKnow | Weiß ich nicht | I don't know |
| trHintBtn | Erster Buchstabe | First letter |
| trReplay | Nochmal hören | Play again |
| trAudioOff | Ton ist hier nicht verfügbar – lies den Satz. | Audio isn't available here – read the sentence. |
| trTimeLeft | noch {s} s | {s} s left |
| trTimeUp | Zeit abgelaufen | Time's up |
| trProducePlaceholder | Dein Satz mit „{word}" … | Your sentence with "{word}" … |
| trProduceCheck | Prüfen lassen | Check it |
| trProduceSelf | Vergleiche mit den Mustersätzen und bewerte selbst. | Compare with the model sentences and rate yourself. |
| trProduceModels | Mustersätze | Model sentences |
| trProduceFixed | Korrigiert | Corrected |
| trProduceBetter | Noch natürlicher | More natural |
| trLeech | hartnäckig | tricky |
| trStageUp | Eine Stufe höher: {name} | Moved up: {name} |
| sumExhausted | Mehr Karten gibt es heute nicht – Wiederholen ist erledigt. | No more cards today – review is done. |
| sumExtra | Freiwillig weiter | Keep going (optional) |
| introChunkEyebrow | Neue Wendung | New phrase |
| introYouSaid | Du hast gesagt: | You said: |
| introBetter | Besser: | Better: |

**`learn` (P1)**

| Schlüssel | DE | EN |
|---|---|---|
| task_spot | Tippe im Satz auf das Wort mit dieser Bedeutung. | Tap the word in the sentence that has this meaning. |
| task_listen_mc | Hör zu und wähle die Bedeutung. | Listen and choose the meaning. |
| task_match | Leg das passende Wort in die Lücke. | Put the right word in the blank. |
| task_tiles | Setz das Wort aus den Bausteinen in die Lücke. | Build the word from the pieces in the blank. |
| task_dictation | Hör den Satz und tippe das fehlende Wort. | Listen to the sentence and type the missing word. |
| task_speed | Schnell: Tippe das Wort, bevor der Balken leer ist. | Quick: type the word before the bar runs out. |
| task_produce | Schreib einen eigenen Satz mit dem Wort – am besten aus deinem Arbeitsalltag. | Write your own sentence with the word – ideally from your work. |
| purpose5 | In neuen Sätzen und unter Zeitdruck nutzen – erst dann ist es aktiver Wortschatz. | Use it in new sentences and under time pressure – that makes it active vocabulary. |
| purposeListen | Verstehen, wenn es gesprochen wird. | Understand it when it's spoken. |
| purposeProduce | Was du selbst formulierst, bleibt am besten hängen. | What you phrase yourself sticks best. |
| whyOtherWordMeaning | „{given}" heißt {meaning} – gesucht war „{word}". | "{given}" means {meaning} – the word we wanted is "{word}". |
| whyIrregular | Unregelmäßige Form: „{form}" gehört zu „{lemma}". | Irregular form: "{form}" belongs to "{lemma}". |
| whyPartial | Fast: nur ein kleines Wort fehlt oder ist zu viel. | Almost: just a small word is missing or extra. |
| whyTimeUp | Die Zeit war um – das Wort kommt bald wieder. | Time was up – the word will come back soon. |
| whyPrep | Feste Präposition: „{verb} + {prep}". | Fixed preposition: "{verb} + {prep}". |
| whyRegister | Stil: {register} | Register: {register} |
| reg_formal / reg_neutral / reg_informal | formell / neutral / locker | formal / neutral / casual |
| whyChunkWhy | {why} | – (nur DE angezeigt; EN-Wert „{why}" existiert nur für die Parität, wird nie gerendert) |
| src_scene | Rollenspiel: {title} | Role-play: {title} |
| src_sceneUntitled | Rollenspiel | Role-play |
| pos_pron / pos_det | Pronomen / Artikelwort | pronoun / determiner |

**`engine` (P2)**

| Schlüssel | DE | EN |
|---|---|---|
| tilesPool | Bausteine | Pieces |
| tilePlaced | „{tile}" an Stelle {n} gelegt | "{tile}" placed at position {n} |
| tileRemoved | „{tile}" zurückgelegt | "{tile}" put back |
| tileSpace | Leerzeichen | Space |
| wordDiff | Wort für Wort | Word by word |
| diffMissing | fehlt | missing |
| diffExtra | zu viel | extra |

**`lookup` (P3)**

| Schlüssel | DE | EN |
|---|---|---|
| lkDialog | Wort nachschlagen: {word} | Look up: {word} |
| lkListen | Aussprache anhören | Hear pronunciation |
| lkInSentence | Im Satz | In this sentence |
| lkPhrase | Wendung | Phrase |
| lkSingleWord | Nur das Wort | Just the word |
| lkMoreMeanings | Weitere Bedeutungen | More meanings |
| lkExample | Beispiel | Example |
| lkBaseForm | Grundform von „{form}" | Base form of "{form}" |
| lkContraction | „{form}" = {full} | "{form}" = {full} |
| lkUsSpelling | Amerikanisch: „{us}" | American spelling: "{us}" |
| lkSave | Als Karte speichern | Save as card |
| lkSaved | Als Karte gespeichert | Saved as card |
| lkUndo | Rückgängig | Undo |
| lkInCards | In deinen Karten · {stage} | In your cards · {stage} |
| lkRestore | Wieder aufnehmen | Add back |
| lkNoSentence | Ohne Satz lässt sich keine Karte anlegen. | A card needs a sentence, so it can't be saved here. |
| lkNotFound | Nicht im eingebauten Wörterbuch. | Not in the built-in dictionary. |
| lkAsk | Claude fragen | Ask Claude |
| lkAskTitle | Claude zu „{word}" in diesem Satz | Claude on "{word}" in this sentence |
| lkBack | Zurück | Back |
| lkSrcCard / lkSrcDict / lkSrcFunction / lkSrcClaude | Aus deinen Karten / Eingebautes Wörterbuch / Häufiges Funktionswort / Von Claude erklärt | From your cards / Built-in dictionary / Common function word / Explained by Claude |

---

## 8. Testplan

Grundsätze:
- Unit-Tests mit Vitest (`TZ=Europe/Berlin`); E2E mit Playwright 1.56.1 gegen `dist/index.html`, der Adapter wird von außen eingespielt.
- Keine jsdom-Komponententests.
- Jede Domain-Prüfung läuft über mindestens 3 Zeitpunkte.
- In `src/domain/**` sind `Date.now()`/`new Date()` ohne Argument und `Math.random` verboten (ESLint, Schritt 0). Ausnahmen: `platform/dev` und die Pause in `writer.ts`.

### 8.1 Zeitpunkte (`tests/support/time.ts`, P6)

```ts
export const T = {
  anchorEvening: '2026-09-20T21:00:00+02:00', anchorNight: '2026-09-21T02:30:00+02:00',
  nextMorning: '2026-09-21T09:00:00+02:00', beforeSwitch: '2026-09-22T03:59:00+02:00', afterSwitch: '2026-09-22T04:00:00+02:00',
  weekLater: '2026-09-27T09:00:00+02:00', dstEnd: '2026-10-25T09:00:00+01:00',
  newYearNight: '2027-01-01T03:59:00+01:00', newYearDay: '2027-01-01T04:00:00+01:00', clockBehind: '2026-09-18T09:00:00+02:00',
} as const;
```

**Referenzzahlen** (fällig, neu, Blutegel je Zeitpunkt) kommen aus `scripts/seed-golden.mjs`. Das ist eine unabhängige Rechnung von etwa 40 Zeilen mit den Grundregeln aus §4.4 und §4.5. Sie schreibt `tests/support/seed-golden.json`, `npm run seed` ruft sie mit auf. So gibt es keinen Zirkelschluss.

### 8.2 Unit-Tests je Paket

**P1 – Lern-Domäne**
- `modes.test.ts`:
  - Katalog: 13 Arten, jede Stufe 1–5 hat mindestens 2.
  - Für **alle** Kombinationen (Vokabel/Chunk × Kontext {Klammer, Suche, keiner} × `col` {0, 2} × `def` {ja, Wörterbuch, nein} × `de` {ja, nein} × TTS × KI × Stufe 0–5 × Blutegel) gilt: mindestens 2 Arten oder `incomplete`. Jede Art erfüllt ihre Bedingung, keine Art mit TTS ohne TTS, keine `colloc` ohne `col`.
  - Schwächste Art: `{mc_en:{c:9,w:0}, spot:{c:0,w:3}}` → `spot`. Gleichstand → nicht `lastMode`. Δ ≤ 0,1 → gleiche InputKind.
- `ladder.test.ts`:
  - `stageOf`-Tabelle.
  - `nextStage` der alten App (bestehende Fälle).
  - Bremse: neue Karte, Gut → 2; zweite richtige Antwort am selben Lerntag → bleibt 2; am nächsten Lerntag um 04:00 → 3; `before` 3 mit Leicht und `level` 4 → 4 (nicht 5); Note 1 → Abstieg wie bisher.
  - Blutegel `lapses` 5, `stage` 4 → Abfragestufe 3, gespeicherte `stage` bleibt 4.
- `queue.test.ts`:
  - `planRound`-Tabelle (synthetische Karten, Stufe 3 = 20 s):

    | Fall | Ergebnis |
    |---|---|
    | 100 fällig, 5 neu, `newPerDay` 5 | `{target 22, due 17, new 5, ahead 0}` |
    | 100 fällig, `newPerDay` 0 | `{30, 30, 0, 0}` |
    | 100 fällig, 10 neu verfügbar, `newPerDay` 10 | `{15, 5, 10, 0}` |
    | 3 fällig (Stufe 2) + 2 neu + 50 nicht fällig | `{10, 3, 2, 5}` |
    | 40 fällig auf Stufe 1, `newPerDay` 5 | `{34, 29, 5, 0}` |
    | `introducedToday` 3 bei `newPerDay` 5 | Kontingent 2 |
    | nichts aktiv | `{0, 0, 0, 0}` |
    | 6 fällige Blutegel | höchstens 3 davon |
    | `newPerDay` 7 / 3,5 / null / '5' | 5 / 2 / 5 / 5 |

  - `buildQueue`:
    - neue Karten an den Indizes [2, 5, 8, 11, 14], auch bei 124 Fälligen (Kap. 15);
    - Verschachtelung: keine zwei gleichen `topicKey` nebeneinander, wenn unter den nächsten 4 eine andere liegt;
    - **Eigenschaft „Pflicht erfüllbar"**: 1.000 Stände (Startwert 20260920), auch nach 30 % verborgenen Karten → Länge ≥ Rest oder alle Karten beantwortet;
    - Extra-Runde ohne Auffüllung über das Kontingent.
- `exercise.test.ts`:
  - 4 Optionen, genau 1 richtig, Etiketten eindeutig, keine gemeinsame Bedeutung.
  - Wörterbuch füllt bei Pool < 3 auf (`lexMock`).
  - `tiles`: Buchstaben-Multimenge = Lösung + 2 Fremde, nie in Lösungsreihenfolge, > 14 Buchstaben → Zweiergruppen.
  - `speed`-Grenze: Länge 8 → 7.200 ms, Länge 1 → 6.000, Länge 30 → 14.000.
  - Bei getippten Arten steht die Lösung nicht in `sentence` außerhalb der Lücke.
  - DE-Optionen `lang:'de'`, EN-Optionen `lang:'en'`, nie gemischt.
  - Gleicher Startwert → gleiche Optionen.
- `grade.test.ts`: Tabelle §4.7 mit Grenzwerten (8.000/8.001 ms, L 3.000/3.001, `tiles` mit 8 Bausteinen T 8.300 → 3,5 s → 4, `speed` G 7.200: 4.320 → 4, 7.200 → 3, abgelaufen → 2/1), `allowedGrades`.
- `check.test.ts`:
  - Tabelle: `Reliable.`, `relaible`, `rel`, `fea`/`fee` (falsch, ≤ 4), `affect`/`effect` (confusable), `achieve`/`achieved` (form), `took`/`take` (form, unregelmäßig), `colour`/`color`, `organise`, `travelled`, `licence`, `lorry` (variant);
  - hour, tour, exercise, surprise bleiben unverändert;
  - Mehrwort: `rely` gegen `rely on` (partial), `I take your point but` = mit Komma (correct), `I take point your, but` (wrong, 2 Wörter markiert).
- `review.test.ts` (MVP, erweitert):
  - alle Seed-Karten × Noten 1–4 × alle Arten → nur erlaubte Schlüssel, Schema besteht, übrige Felder bytegleich;
  - Chunk-Patch ohne `pa`/`ac`/`co`, `modes` nur `cloze`/`produce`, `src{}`/`created` unverändert;
  - `clockBehind` → kein Wurf, `due ≥ last`;
  - Fuzz deterministisch;
  - `stability` 800 → `S = 365`.
- `logPatch.test.ts`: Vokabel- und Chunk-Form, `entryCardKey`, Kappung 300, Doppelte, ≤ 240 KiB.
- `profilePatch.test.ts`: MVP-Fälle + `pflichtDay` (setzt 1; schon gesetzt → kein Schlüssel; nie 0), zweites Anwenden mit gleichem `seq` → `null`.
- `newCard.test.ts`: Klammer um die Oberflächenform (`We [decided] …` für `to decide`), bereinigte Klammern, Fenster > 200 Zeichen, „to " nur bei Verben (nicht `phrasal`), `id = slug`, Schema besteht.
- `explain.test.ts`: jede Art × {correct, near, wrong} × jede Seed-Karte → 1–3 Teile; EN-Oberfläche ohne DE-Inhalt (kein `de`, kein `chunk.why`).

**P2 – Engine**
- `tiles.test.ts`: `placeTile`/`removeTile`/`removeLast` rein, nie doppelt, `insertionIndex` (links/rechts vom Mittelpunkt, > 48 px → Ende).
- `tokens.test.ts`: `checkTokens` und `wordDiff` (Ersetzung, fehlend, zu viel, Vertauschung → 2 falsch), Eigenschaft über 1.000 Paare.
- `diff.test.ts`: Markierung je Zeichen.
- `contrast.test.ts`: neue Paare.

**P3 – Wort-Antippen**
- `resolve.test.ts`: Reihenfolge Karte > Zwischenspeicher > Wörterbuch > Funktionswort > KI nötig; `carried out` → `carry out`; `reports` → `report` mit „Grundform"; `colour` → Kopfwort `color`; `the` → Funktionswort, `needsAi` falsch; Wortart-Heuristik (`still` → Adverb, `sign` nach „you" → Verb); ausgeblendete Karte → „Wieder aufnehmen".
- `cache.test.ts`: Schlüssel normalisiert; neuer Eintrag nur mit Notiz der Oberflächensprache; 400 gefüllt + 1 → genau 1 × `null` (ältester nach `t`, ohne `t` zuerst); zweite Sprache wird eingemischt; Eintrag besteht `lookupSchema`.
- `saveCard.test.ts`: Kollisionstabelle §3.1 (fehlt → `set`; da mit leerem `ex` → nur `ex`/`origin`; da mit `ex` → nichts; `hidden` → nur über „Wieder aufnehmen"); ohne Satz → verweigert.
- WP1/WP3-Tests (bestehend): `aiGate`, `aiQueue`, `aiTexts`, `detectLang`, `prompts`, `lexicon`, `pron`, `text`.

**P4 – Trainer**
- `produce.test.ts`: `selfCheckProduce` (enthält Form, 6 Wörter, abgeschrieben ≥ 0,8 → 2, Wort fehlt → 1).
- `exerciseMachine.test.ts` (`createActor` in Node):
  - `SUBMIT` in `presenting` wird ignoriert;
  - `TIMEOUT` nur bei `speed`;
  - `HINT` → Vorschlag ≤ 2;
  - KI-Fehler → `feedback` mit Selbsturteil;
  - `STOP` bricht ab (Signal `aborted`) und führt zurück zu `input`;
  - `RATE` außerhalb `allowedGrades` wird ignoriert.
- `session.test.ts` (reine Teile): Chunks in der Warteschlange, `exclude` über `entryCardKey`, `exhausted`-Erkennung, Wiedervorlage +4 und höchstens 3.
- `persist.test.ts` (`memoryDb`, zwei Schreiber): Pflicht wird genau in dem Schreibvorgang gesetzt, der `allDone` erreicht; Abbruch mit 12 von 22 → **kein** `pflicht`; erschöpfte Runde → `pflicht`; `unavailable` und dann Erfolg → keine Doppelzählung (`lxSeq`).

**P5 – Heute**
- `dayState.test.ts`: Eigenschaftstest mit 1.000 Zuständen:
  - `status === 'allDone'` ⇔ `review.done === total > 0`;
  - `duties.done` = erledigte Punkte;
  - xtra-Einträge ändern nichts an der Pflicht;
  - Doppelte und Alt-Einträge zählen nicht;
  - `pflichtMarked` → `done = total`.
- `buildPlan.test.ts`:
  - Plan bleibt über den Tag gleich (gleiche Referenz um 09:00, 23:59, 03:59);
  - neuer Plan um 04:00;
  - Plan der alten App → neuer v1-Plan mit `ids:[]`;
  - `goal`-Felder;
  - Zeitumstellung 25.10. (03:30 → `2026-10-24`).
- `coach.test.ts`: neue Wörter → Dokumente mit Klammer und `src:'coach'`; vorhandene `id` → nichts; `daily` ungültig → leer.
- `pflichtSince.test.ts`:
  - Wert `legacyDayKey` (21.09. 02:00 → `2026-09-21`);
  - einmalig; ungültiger Altwert bleibt;
  - Eigenschaft über 17.280 Zeitpunkte (alle 30 Min. über 3 Tage einschließlich beider Tage der Zeitumstellung, 40 Verläufe): Die Serie sinkt beim Setzen nie.
- `streak.test.ts` (bestehend, ergänzt):
  - Ruhetag W39;
  - zwei Fehltage in einer Woche → Abriss;
  - W53 (28.12.2026–03.01.2027);
  - `pflicht` 1/true zählt, 0/false/null nicht.
- `goal.test.ts`: `vtests` 6.400 (5.900–6.900) am 30.08. + 30 gelernte Karten → 6.430; 12 Karten in 28 Tagen → 3/Woche → 524 Wochen; ohne `vtests`, `history.vs` 3.496 → ohne Band; `perWeek` < 1 → `null`; ≥ 8.000 → erreicht; Chunks und ausgeblendete zählen nicht.
- `overview.test.ts`: Karte ohne `stage` mit `ac` 0,65 → Stufe 4 (`stageOf`), nicht 0 (Befund B5).
- **Simulation über 14 Tage** (`simulation.test.ts`, ≤ 2 s):
  - jeden Tag um 09:00 Plan → Runde (80 % Gut, 10 % Schwer, 10 % Nochmal) → Schreiben;
  - Plan stabil, Serie +1 je Tag, neue Karten im Kontingent, `due > t`, Schlüssel schrumpfen nie, kein NaN;
  - Varianten: ein Fehltag (Ruhetag), zwei Fehltage in W39 (Abriss), Woche mit Zeitumstellung, W53.

**P6 – Testdaten, Adapter, Sprache**
- `seed.test.ts`:
  - Nähe zu echten Daten: ≥ 95 % der `ex` mit Klammern außer den 3 Randfällen; ≥ 25 % der gelernten Karten ohne `stage`; alle 13 `src`-Werte; Chunks mit `modes:{}`/`hist:[]` und sinnvollem `upgraded`;
  - Dokumentzahl 196 unverändert;
  - deterministisch.
- `scenarios.test.ts`: jedes Szenario-Dokument besteht die Schemas, erlaubte Pfade, deterministisch.
- `language.test.ts`: über alle Seed- und Szenario-Dokumente `*_de` deutsch und `*_en` englisch (ab 4 Wörtern), `app/lookup.items.*.note_*` passend.
- `memoryDb.test.ts` (bestehend): `writes()` mit `keys`.

### 8.3 Seed-Änderungen (P6, `scripts/generate-seed.mjs`, deterministisch, Stichtag 20.09.2026)

Keine Dokumente kommen hinzu oder fallen weg. Die bestehenden Zahlen der Umstellungstests (196 Dokumente, Serie 12) bleiben.

| # | Änderung |
|---|---|
| S1 | `[Form]` in `ex` für alle Lektions-, Berufs- und Coach-Wörter. Genau drei Randfälle bleiben: `backlog` (Wort ohne Klammer im Satz), `agenda` (Satz ohne das Wort), `attendee` (`ex:''`). |
| S2 | `stage` wird bei gelernten Karten mit `i % 10 ∈ {1,4,7}` entfernt (≈ 38; echt 41 von 135). |
| S3 | `src` fest so verteilt, dass alle 13 Werte der alten App vorkommen. |
| S4 | Chunks: echte Paare aus `utterance` und `upgraded` (z. B. „Yes, but it is too expensive." → „I take your point, but the total cost is lower over three years."), `modes:{}`, `hist:[]`. `c-non-negotiable` ist gelernt und am Stichtag fällig, 2 Chunks bleiben neu. |
| S5 | Grenzwerte: eine Karte mit `due` = 21.09. 03:59:59,999, eine mit genau 04:00:00,000. |
| S6 | `colN:1` bei 10 Karten mit `col`, einige Lookup-Einträge mit `alt_de`/`example` und ohne `t`, einige Log-Einträge ohne `lang` und mit `type:'chunk'`. |

Danach `seed-golden.json` neu erzeugen. Die Umstellungstests zählen nach.

### 8.4 Adapter (P6, `src/platform/dev/*`)

```ts
export type SampleStep = { template?: string; code?: Claude.sample.SampleErrorCode; reply?: string; delayMs?: number; hang?: boolean };
export type FakeOptions = { /* bisher */ sampleScript?: SampleStep[]; sampleDelayMs?: number; speech?: 'fake' | 'none';
  scenario?: { id: ScenarioId; today: string; now: number } };
export type SampleCall = { template: string | null; tier: string; cache: unknown; bytes: number; input: string;
  aborted: boolean; outcome: 'pending' | 'ok' | Claude.sample.SampleErrorCode };
export type FakeControl = { /* bisher */ sampleCalls: SampleCall[];
  spoken: Array<{ text: string; lang: string; voice: string | null; t: number }> };
// memoryDb.writes(): Array<{ op: 'set' | 'update' | 'delete'; path: string; keys: string[]; t: number }>
```

**Feste Antworten** (`cannedReplies.ts` aus WP1) werden in `install.ts` eingebunden:
- `zzqx`: erst schemawidrig, im Neuversuch gültig.
- `zzjson`: kein JSON.
- `zzlang`: erst in der falschen Sprache.
- `produce-check`: `zzminor` → `minor`; ohne Zielwort → `wrong`.

**Nachgebildete Sprachausgabe** (`fakeSpeech.ts`): Stimmen Samantha (en-US, lokal) und Daniel (en-GB) nach 250 ms und `voiceschanged`, 10 ms je Zeichen. `'none'` entfernt `speechSynthesis`.

**Szenarien** (`src/platform/dev/scenarios.ts`, rein, `(seed, today, now) → Patch`, **Plan v1**):
- `planV1(today, n, due, neu) = {d: today, ids: [], why: [], v: 1, duty: ['review'], goal: {review: n, due, new: neu, ahead: 0}, lesson: null, at: 1}`.
- Log-Einträge nutzen echte Seed-ids: `{t, ok:true, lang:'de', k:'v', id, m:'tr-mc_en', given, ans, g:3, ms:3000, ctx}`.

| Szenario | Inhalt |
|---|---|
| `day-open` | `planV1(today, 10, 8, 2)` |
| `day-started` | + 4 × rev (verschieden) + 1 Doppel + 2 ohne `ctx` |
| `day-done` | 10 rev + `pflicht:{[today]:1}` |
| `day-done-extra` | + 7 xtra |
| `day-done-unmarked` | 10 rev ohne `pflicht` |
| `day-marked-nolog` | `pflicht` ohne Log |
| `day-overflow` | 14 rev bei n = 10 |
| `day-n3` | `planV1(today, 3, 3, 0)` |
| `day-empty` | alle `vocab`/`chunk` `hidden:true`, dazu die Startwörter als ausgeblendete Dokumente |
| `few-cards` | leere Datenbank + Profil + Schema + 3 gelernte Karten |
| `daily-new-word` | `daily/<today>` mit `{word:'to streamline', de:'straffen', ex:'We want to streamline approvals.'}` |
| `lookup-sentences` | `leverage.ex` „We can [leverage] this to upsell the archive module.", `supplier` mit „Our team relied on the [supplier] for years.", `app/lookup.items.procurement` |
| `invalid-days` | `app/profile.days = 'kaputt'` |

**`forceMode(ex)`** (`tests/e2e/modeScenarios.ts`) setzt die Zielkarte `reliable` (bei Chunk-Arten `c-non-negotiable`):
- `state:'review'`, `stage` = Stufe der Art, `S:0,4`, `last: now − 30 T`, `due: now − 29 T`, passendes `fsrs` → steht an Position 0;
- `xs[ex] = {c:0, w:6}`, die übrigen Arten der Stufe `{c:12, w:0}`;
- `hist` endet mit einer anderen Art;
- `newPerDay: 0`.

**`check-platform.mjs`:** neue Marker, die nicht im Build stehen dürfen: `registerCannedReplies`, `createFakeSpeech`, `installFakeSpeech`, `zzqx`, `zzjson`, `zzlang`, `Samantha`, `scenarioPatch`.

### 8.5 E2E-Suite (P6 schreibt gegen §5.1, INT bringt sie auf Grün)

| Datei | Inhalt (Auszug) | Matrix |
|---|---|---|
| `today.spec.ts` (neu geschrieben) | **E-TODAY-01** Stichtag: Start auf Heute; Status „Noch nicht fertig · 0 von 1 · es fehlt: Wiederholen"; genau 1 Primärknopf im Bild; genau 1 Schreibvorgang auf `app/profile` mit Schlüsseln `['plan']` (v1, `ids:[]`); `app/schema.pflichtSince` = `'2026-09-20'` bei 21:00; Serie 12. · **E-TODAY-02..11** je Szenario `dayConsistency` leer (Zahlen im Status = `data-done/total`, Ring = `review`, `done-item` ohne bedienbares Kind, höchstens 1 bedienbares Element je Pflichtpunkt, kein `start` bei allDone); `day-done-unmarked` → genau 1 Schreibvorgang `pflicht`. · **E-TODAY-12** Plan stabil (Neuladen 13:00, 23:59, 03:59 → 0 Plan-Schreibvorgänge; 04:00 → 1). · **E-TODAY-13** Tageswechsel ohne Neuladen (`setFixedTime` + `runFor(30_000)`), Abo-Zahl gleich. · **E-TODAY-14** Stichtage nextMorning…clockBehind. · **E-TODAY-15** unter 2 s bis `start` sichtbar. · **E-TODAY-16** Serie über 3 Tage mit Ruhetag. · **E-TODAY-17** `daily-new-word` → genau 1 `set vocab/streamline` mit Klammer, `daily/*` bytegleich. · **E-TODAY-18** Leerlauf 60 s → 0 Schreibvorgänge. | 390 DE; 3 Zustände EN; 1 × 1440 |
| `trainer-modes.spec.ts` | Für jede Art aus dem Katalog (katalog-getrieben, eine Meta-Prüfung stellt sicher, dass jede Art einen Test hat): `forceMode` → vor der Antwort `task`/`purpose`/`ladder`/`origin` sichtbar, Lösung nicht im DOM → lösen (Lösung aus dem Szenario) → `result` und `why` nicht leer, **auch bei richtig** → antippbare Wörter = Wortzahl aus `tokenize` → Enter → `dump`: `fsrs.last = now`, `hist.at(-1) = {t, m, g}`, `xs[ex].c + 1`, Log `{ctx:'rev', m:'tr-'+ex}`, `fsrs.due` = im Node-Test nachgerechnet. Dazu W1 (falsche Auswahl → Begründung nennt, wozu sie gehört), W2 (`relaible` gold, Vorschlag 2), W3 (`cure` statt `curb` rot, `gap-correction`, `word-diff`), P1/P2 (`produce` mit/ohne KI), F1 (`speed` ohne Eingabe, `runFor(14_000)`), H1 (`listen_mc`/`dictation` mit `speech:'fake'`, Leertaste wiederholt), C1 (Chunk schreibt `chunk/<id>` und `type:'chunk'`). | 1440 dark DE; getippte Arten zusätzlich 390 Touch |
| `trainer-flow.spec.ts` | Runde nur per Tastatur (1440); Zähler 1/6…; Nochmal kommt wieder, der Zähler steigt nicht; Abbrechen nach 4 → Heute sofort 4/10 (optimistisch), nach Neuladen gleich; Extra zählt als Extra; `visibilitychange`/`pagehide` → Log innerhalb 500 ms; Schreibfehler → „Erneut speichern", kein automatischer Neuversuch; neue Wörter an Position 2 bei dstEnd; Vorschlag 4 schnell, 2 nach `runFor(10_000)`; `prioritise` richtig mit US-Hinweis; Runde über 04:00 → alles auf dem Starttag (E10); `clockBehind` ohne Seitenfehler; Abbruch mit 12 von 22 → kein `pflicht`; Touch: Tastatur zu nach „Prüfen", `focusNow` nach Bewertung. | 1440, 2 × 390 |
| `gap.spec.ts` | Buchstaben landen (Flug-Rekorder, Endlage in der Lücke ±1 px, Grundlinie ±1,5 px, gleiche Schriftgröße); reduzierte Bewegung ohne Flieger; Anfangsbreite `reliable` = `counteroffer`; 12 Buchstaben ohne Querscrollen bei 390; Eingabefeld überdeckt ≥ 80 % der Lücke, 16 px; Rücktaste; Farben je Modus = Token-Werte (CSS-Spezifität); Tipp-Reaktion Median ≤ 50 ms; `navigator.vibrate`-Spion: genau 1 Aufruf bei richtig, ohne `vibrate` kein Fehler. | 1440 / 390 |
| `tiles.spec.ts` | Tippen setzt und legt zurück; Ziehen zwischen zwei → die anderen verschieben sich (Rechtecke); Ziffer, Rücktaste, Alt+→; `match` prüft beim Setzen. | 1440 / 390 |
| `lookup.spec.ts` | `still` → Adverb zuerst, 0 KI-Aufrufe; eigene Karte → `lk-saved` ist Zustand; `procurement` aus dem Zwischenspeicher; `upsell` → „Denkt nach …" → Inhalt, genau 1 Aufruf `word-lookup`/quick/`gcTime` 86.400.000, Eintrag gespeichert, zweiter Tipp ohne Aufruf; Speichern → `vocab/upsell` mit `[upsell]`, `src:'lookup'`, `origin`, Doppelklick → 1 Schreibvorgang, Rückgängig → `hidden:true`; `relied` → Wendung `rely on`; Tastatur und Esc geben den Fokus zurück; Stapel; EN ohne Deutsch; vor dem Prüfen ist die Lücke nicht antippbar; `the` lokal; 🔊 → `spoken` en-US; Touch → Blatt. | 1440 DE, 1 × EN, 1 × 390 |
| `ai-errors.spec.ts` | `not_granted` → kein `[data-ai]` mehr, Selbsturteil; `sample` null → kein `[data-ai]`; `rate_limited` → gesperrt bis +60 s, kein automatischer Aufruf; `zzjson` → 1 Aufruf + Knopf; `zzqx` → 2 Aufrufe; `zzlang` EN; langsam → nach `runFor(8_000)` Stopp → `aborted`, kein Schreiben; Verlassen bricht ab; `upstream_error`, `refused`. | 1440 |
| `screens-phase1.spec.ts` | 390/1440/2560 × dark/dim/light × DE/EN = 18 Tests, je 6 Zustände (Heute begonnen, Trainer-Frage, Trainer falsch, Nachschlagen, Zusammenfassung, Dein Stand): `layoutProblems`, `languageProblems` (Deutsch-Merkmale außerhalb `[lang=de]` in EN; Englisch-Merkmale außerhalb `[lang=en]` in DE), Hintergrund, keine Fehler, Bildschirmfotos für den ux-reviewer. | voll |
| `a11y-phase1.spec.ts` | axe `wcag2a/aa/21a/21aa` auf allen Zuständen einschließlich Auswahl und Bausteine; Touch-Ziele ≥ 44 px (außer `.lx-word`); Fokusmarke sichtbar. | 3 Modi × 390/1440 |
| `data-contract.spec.ts` | Erlaubte Pfade und Schlüssel je Pfad (§3.1); nie `delete`; `keys(vorher) ⊆ keys(nachher)` für jedes Seed-Dokument; `daily/*`/`feed/*` gleich dem Seed; Abo-Zahl bleibt 8 über 3 Durchgänge. | 1440 |
| bestehende Dateien | `fixtures.ts`: `screen()` kennt `today`/`trainer`, `boot()` kennt `scenario`/`speech`/`sampleScript`/`sampleDelayMs`, Fehlerprüfung nach jedem Test automatisch. `screens.spec` (Stand-Tests entfallen zugunsten von screens-phase1), `a11y.spec` (Einstellungen in 3 Tests geteilt), `migration`/`platform`/`settings` starten auf Heute. `today.spec`/`trainer.spec`/`trainerHelpers` des MVP gehen in den neuen Dateien auf. | – |

**Budget:**
- Wandzeit ≤ 180 s bei 4 Workern, kein Einzeltest > 40 s.
- Zeitsprünge nur mit `runFor`, nie `waitForTimeout` > 500 ms.
- Zusätzlicher JSON-Bericht (`test-results/e2e-report.json`).
- Notbremse bei > 180 s: Die Zustände 4–6 der Matrix laufen paarweise (9 Zeilen).

### 8.6 Prüfliste am iPhone (für den Drei-Satz-Bericht, Emrah)

1. „Wiederholen starten" antippen: Die Tastatur geht auf, der Satz bleibt oben sichtbar.
2. Tippen: Die Buchstaben fliegen in die Lücke, nichts ruckelt.
3. „Los" auf der Tastatur: Die Rückmeldung erscheint, die Tastatur geht zu. Ein Bewertungsknopf öffnet sie für die nächste Tipp-Aufgabe wieder.
4. Ein Wort im Satz antippen, dann den Lautsprecher: Das Wort wird vollständig vorgelesen.
5. Ein Wort am Bildschirmrand antippen: Das Blatt ist ganz sichtbar.
6. Mitten in der Runde die App wechseln und zurückkommen: Der Fortschritt ist noch da.

---

## 9. Arbeitspakete

### 9.0 Schritt 0 – Vertragsstand (Lead, allein, vor allen Paketen, 2–3 h, ein Commit)

**Ziel:** Jedes Paket baut danach gegen feste Typen und Dateien und kompiliert für sich. `npm run verify` ist grün, und es ändert sich kein Verhalten.

1. **Basis herstellen:**
   - MVP committen („Phase 1: MVP").
   - Branches `worktree-agent-adacfd52a8d1dccc6` (WP1) und `worktree-agent-a3a0eb69421288c50` (WP3) zusammenführen.
2. **`src/domain/srs/types.ts`** endgültig (danach nur der Lead):

   ```ts
   export type Grade = 1 | 2 | 3 | 4;
   export type Stage = 0 | 1 | 2 | 3 | 4 | 5;
   export type Lang = 'de' | 'en';
   export type CardKind = 'vocab' | 'chunk';
   export type ExerciseId = 'mc_en' | 'spot' | 'listen_mc' | 'mc_de' | 'match' | 'cloze_hint' | 'tiles'
     | 'type' | 'cloze' | 'colloc' | 'dictation' | 'speed' | 'produce';
   export type LegacyMode = 'recog' | 'cloze' | 'type' | 'colloc' | 'listen' | 'produce';
   export type InputKind = 'choice' | 'typed' | 'spot' | 'tiles' | 'produce';
   export type ExerciseEnv = { lang: Lang; tts: boolean; ai: boolean };
   export type ContextSpan = { sentence: string; start: number; end: number; gap: string };
   export type Colloc = { index: number; p: string; de: string; gap: string; opts: string[]; ctx: ContextSpan | null };
   export type Counts = { c: number; w: number };
   export type ChunkInfo = { chunkKind: string | null; register: string | null; why: string | null;
     utterance: string | null; sceneTitle: string | null; scene: string | null };
   export type TrainCard = {
     key: string; kind: CardKind; id: string; path: string; inDb: boolean;
     word: string; lemma: string; pos: string | null; de: string | null; def: string | null;
     context: ContextSpan | null; col: Colloc[]; src: string | null; lesson: string | null;
     fsrs: FsrsStored; stage: Stage; isNew: boolean; hidden: boolean; lapses: number;
     xs: Record<string, Counts>; modes: Record<string, Counts>; lastMode: string | null;
     intro: string | null; order: number; added: string; chunk: ChunkInfo | null;
     doc: Readonly<Record<string, unknown>>;
   };
   export type Option = { id: string; label: string; lang: Lang; correct: boolean; fromWord?: string; fromMeaning?: string; fromPos?: string };
   export type Tile = { id: string; label: string };
   export type Exercise = {
     ex: ExerciseId; input: InputKind; card: TrainCard; stage: Stage;
     sentence: ContextSpan | null; meaning: string | null; firstLetter: string | null; colloc: Colloc | null;
     options: Option[]; accepted: string[];
     tiles: Tile[]; tileMode: 'letters' | 'words' | null; timeLimitMs: number | null; speak: string | null;
   };
   export type QueueItem = { key: string; reason: 'due' | 'new' | 'ahead' | 'again'; phase: 'intro' | 'quiz' };
   export type Verdict = 'correct' | 'near' | 'wrong';
   export type WordPart = { kind: 'same' | 'wrong' | 'missing' | 'extra'; given?: string; expected?: string };
   export type CheckResult = { verdict: Verdict; variant?: 'uk'; us?: string; kind?: 'typo' | 'form' | 'confusable' | 'partial';
     marks?: boolean[]; otherWord?: string; words?: WordPart[] };
   export type Timing = { submitMs: number; firstKeyMs?: number; chars?: number; deletions?: number;
     hintUsed?: boolean; tiles?: number; replays?: number; timedOut?: boolean; limitMs?: number };
   export type AnswerEvent = { t: number; day: string; kind: 'v' | 'chunk'; id: string; ex: ExerciseId; grade: Grade;
     given: string; ans: string; q?: string; ms: number; lang: Lang; ctx: 'rev' | 'xtra'; colIndex?: number };
   export type WhyPart = { key: string; vars?: Record<string, string | number>; lang?: Lang };
   ```

3. **Signaturen anpassen**, die MVP-Aufrufer mitziehen, Verhalten gleich:
   - `availableExercises(card, env, poolSize)`, `chooseExercise(card, env, poolSize, recent?)`;
   - `buildExercise(card, ex, env, pool, seed, lex?)` (neue Felder mit `[]`/`null`);
   - `planRound({…, env})`, `buildQueue({…, env, mode})`;
   - `suggestGrade(ex, verdict, timing: Timing)`;
   - `toTrainCard` setzt `kind:'vocab'`, `lapses`, `lesson`, `chunk:null`.
4. **Neue Dateien, voll funktionsfähig und klein** (danach beim genannten Eigentümer):
   - `src/domain/srs/chunkCards.ts` `buildChunkCards(chunks, nowMs, invalidIds?)` → P1.
   - `src/domain/srs/newCard.ts` (§3.4) → P1.
   - `content.ts`: `export const collocFor = (id: string): unknown[] => COLLOC[id] ?? []` → P1.
   - `logPatch.ts`: `entryCardKey`, Chunk-Form in `logEntry` → P1.
   - `profilePatch.ts`: `pflichtDay` → P1.
   - `src/domain/answer/tokens.ts`: `checkTokens`, `wordDiff` → P2.
   - `src/engine/wordTap.ts` (§5.6, fest).
   - `src/engine/EnglishText.tsx` → P3.
   - `src/engine/AnswerFeedback.tsx` (aus dem MVP herausgelöst) → P2.
   - `KineticGap` Eigenschaft `solution` → P2.
   - `src/features/vocab/views/types.ts` (fest):
     ```ts
     export type CheckedAnswer = { result: CheckResult; given: string; chosen: Option | null; timing: Timing };
     export type ExerciseBodyProps = { exercise: Exercise; env: ExerciseEnv; checked: CheckedAnswer | null;
       onCheck(a: CheckedAnswer): void };
     ```
   - `src/features/vocab/views/registry.ts`: `export const BODIES: Partial<Record<InputKind, ComponentType<ExerciseBodyProps>>> = {};` → INT.
   - `src/data/reads.ts`: `readDoc(path): Promise<{ doc: Doc | null; valid: boolean }>` über `db.doc(path).get()` + `validateDoc` → INT.
   - `ui/motion.ts`: `LAYOUT_ID`, `SHARED`, `CARD_SWAP` → P2.
5. **Daten:**
   - `live.ts`: `LIVE_COLLECTIONS = ['vocab', 'grammar', 'chunk']`; die Auswahl in `App.tsx`/`session.ts`/`store.ts` hängt Chunks noch nicht an.
   - `schemas.ts` nach §3.10.
6. **i18n** nach §7.1 (Verschieben, Teile anlegen, Test).
7. **ESLint:** Schichtregeln §2.1 und das `Date`/`Math.random`-Verbot in `src/domain`.
8. **Abnahme:** `npm run verify` grün. Commit „Phase 1: Vertragsstand".

**Regeln für alle Pakete:**
- Ein Paket ändert **nur** seine Dateien.
- `dist/index.html` wird nie committet (`git checkout dist/index.html` vor dem Commit).
- `package.json` und die Sperrdatei ändert nur P6.
- Dateien ohne Paket gehören der Integration und werden in P1–P6 nicht geändert: `src/data/*`, `src/app/*` (außer `actions.ts`), `src/platform/*` (außer `dev/*`), `src/main.tsx`, `src/features/{migration,system}/*`, `src/domain/{migration/*,equal.ts}`, `src/ui/*` (außer `Icon.tsx`, `motion.ts`, `Popover.tsx`), `tests/unit/{i18n,schemas,writer,speech,migration,rescue}.test.ts`, `eslint.config.js`, `vite*.config.ts`.
- Braucht ein Paket eine Änderung an einer festen Datei (`types.ts`, `wordTap.ts`, `views/types.ts`, `schemas.ts`, `live.ts`, `reads.ts`, `writer.ts`, `de.ts`/`en.ts`) oder an einer Datei eines anderen Pakets, meldet es das dem Lead. Der Lead ändert zentral und benachrichtigt alle Pakete.
- Jedes Paket endet mit `npm run typecheck && npm run lint && npm test` grün (ohne E2E) und einem Commit „Phase 1 · Pn: …".

### 9.1 P1 – Lern-Domäne

**Dateien (anlegen/ändern):**
- `src/domain/srs/{modes,exercise,queue,grade,explain,ladder,applyReview,cards,context,scheduler,chunkCards,newCard,legacyFsrs}.ts`
- `src/domain/answer/{check,normalize,spelling}.ts`
- `src/domain/progress/{logPatch,profilePatch}.ts`
- `src/domain/random.ts`, `src/domain/content.ts`
- `src/content/spelling-uk-us.json`
- `src/i18n/parts/learn.{de,en}.ts`
- Tests: `tests/unit/{modes,ladder,queue,exercise,grade,check,review,logPatch,profilePatch,newCard,explain,legacyFsrs}.test.ts`

**Liefert** (Signaturen fest, §4 und §9.0):
- `availableExercises`, `chooseExercise`, `buildExercise`, `planRound`, `buildQueue`
- `quizStage(card): Stage`, `isLeech(card): boolean` (`lapses ≥ 4`), `topicKey(card): string`
- `suggestGrade`, `allowedGrades`, `checkTyped`, `explain`
- `reviewWrite` (Vokabel und Chunk), `cardPatchSchema`, `chunkPatchSchema`
- `logEntry`, `mergeLogEntries`, `entryCardKey`, `profilePatch`
- `buildTrainCards`, `buildChunkCards`, `newVocabDoc`, `collocFor`
- `previewIntervals`, `retrievability` (mit Klemme)

**Nutzt:** WP3 (`lemmaCandidates`, `lexDeps`, `isDictWord`, `usSpelling`), `tokens.ts` (P2 besitzt die Datei, P1 importiert nur).

**Tests:** §8.2 P1.

### 9.2 P2 – Bausteine, Rückmeldung, Übergänge, Design

**Dateien:**
- `src/engine/{KineticGap,HiddenInput,AnswerFeedback}.tsx`, `src/engine/tiles/{TileBoard.tsx,tiles.ts,insertion.ts}`
- `src/domain/answer/{diff,tokens}.ts`
- `src/features/vocab/views/TilesBody.tsx`
- `src/ui/{motion.ts,Icon.tsx}`, `src/styles/index.css`, Schrift-Datei für das griechische Teilset (`src/styles/fonts/inter-greek-theta.woff2` oder Base64 in der CSS)
- `src/i18n/parts/engine.{de,en}.ts`
- Tests: `tests/unit/{tiles,tokens,diff,contrast}.test.ts`

**Liefert:**
- `TileBoard`, `placeTile`, `removeTile`, `removeLast`, `insertionIndex`
- `TilesBody: ComponentType<ExerciseBodyProps>` (§5.5)
- `AnswerFeedback` (Props §5.4)
- `KineticGap` mit `solution`, Gold-Markierung, Impuls, `haptic`
- `checkTokens(given: string | string[], expected: string): CheckResult`, `wordDiff(given: string[], expected: string[]): WordPart[]`
- `LAYOUT_ID`, `SHARED`, `CARD_SWAP`
- CSS-Tokens und Klassen (§5.8), Symbole

**Nutzt:** `types.ts`, `views/types.ts`, `checkTyped` (P1, nur Import der bestehenden Signatur), `haptic` (WP1).

**Tests:** §8.2 P2.

### 9.3 P3 – Wort-Antippen und KI-Tor

**Dateien:**
- `src/features/lookup/{WordTapProvider.tsx,LookupPopover.tsx,store.ts}`
- `src/domain/lookup/{resolve,cache,saveCard}.ts`
- `src/engine/EnglishText.tsx`, `src/ui/Popover.tsx`
- `src/content/function-words.json`
- Übernommen aus WP1/WP3: `src/ai/*`, `src/prompts/{common,types,registry,wordLookup}.ts`, `src/domain/lang/detect.ts`, `src/domain/text/*`, `src/domain/lexicon/*`, `src/content/{irregular.json,pron/*}`, `scripts/build-pron.mjs`
- `src/i18n/parts/{lookup,ai}.{de,en}.ts`
- Tests: `tests/unit/{resolve,cache,saveCard,aiGate,aiQueue,aiTexts,detectLang,prompts,lexicon,pron,text}.test.ts`

**Liefert:**
- `WordTapProvider` (Kontext-Wert = Handler, der den Stapel öffnet; setzt `useLookupOpen.open`; blur/focusNow wie in §5.6)
- `LookupHost` (rendert das offene Popover bzw. Blatt; wird einmal in `App.tsx` eingehängt)
- `EnglishText` (§5.6)
- `resolveLocal(req: WordTapRequest, data: ResolveData): LookupView`

  ```ts
  export type LookupView = {
    headword: string; surface: string; lemma: string; phrase: string | null; pos: string | null; ipa: string | null;
    meaningDe: string | null; def: string | null; example: string | null; note: string | null; level: string | null;
    source: 'card' | 'chunk' | 'cache' | 'dict' | 'function' | 'ai';
    card: { path: string; stage: Stage; hidden: boolean } | null;
    needsAi: boolean; canSave: boolean;
    hints: Array<{ key: 'lkBaseForm' | 'lkUsSpelling' | 'lkContraction'; vars: Record<string, string> }>;
  };
  export type ResolveData = { vocab: ReadonlyMap<string, Doc>; chunks: ReadonlyMap<string, Doc>;
    cache: Readonly<Record<string, unknown>>; lang: Lang };
  ```

- `cacheEntry`, `cachePatch`, `lookupKey` (§3.9)
- `saveLookupCard(view, req, today, nowMs): Promise<'created' | 'filled' | 'exists' | 'hidden' | 'refused'>`, `restoreCard(path)`, `hideCard(path)`

**Nutzt:** `newVocabDoc`, `collocFor`, `slug`, `mergedVocab` (Imports), `readDoc`, `getWriter`, `askJson`, `speak`, `useHiddenInput`, `useLive`.

**Tests:** §8.2 P3.

### 9.4 P4 – Trainer-Ablauf

**Dateien:**
- `src/features/vocab/{TrainerScreen,ExerciseView,IntroCard,Summary}.tsx`, `src/features/vocab/{session,persist,exerciseMachine,produce}.ts`
- `src/features/vocab/views/{ChoiceBody,TypedBody,SpotBody,ProduceBody}.tsx`
- `src/engine/{ExerciseFrame,RatingBar,Choices,Ladder}.tsx`, `src/engine/useHotkeys.ts`
- `src/prompts/produceCheck.ts`
- `src/i18n/parts/trainer.{de,en}.ts`
- Tests: `tests/unit/{produce,exerciseMachine,session,persist}.test.ts`

**Liefert:**
- `startSession(round: 'pflicht' | 'extra'): FirstKind` (bleibt; erweitert um Chunks und `env`)
- `leaveSession()`, `continueIntro()`, `commitAnswer()` (bleiben)
- `todayEntries(day)` (mit `entryCardKey`)
- `usePending`, `flush`, `installFlushOnHide`, `retryFailed` (bleiben)
- Pflicht setzen nach §4.8
- `exerciseMachine` (§5.3), `selfCheckProduce` (§4.10)
- Trainer-DOM nach §5.1, `layoutId = LAYOUT_ID.review` auf der Trainerleiste
- `EnglishText` für jeden englischen Text mit `area` und `source`
- `BODIES[e.input]` für `tiles`

**Nutzt:**
- P1-Funktionen (Signaturen §9.1)
- `AnswerFeedback`, `KineticGap`, `HiddenInput`
- `EnglishText`, `useLookupOpen` (Uhr pausieren)
- `askJson`, `useAiScope`, `useAiAvailable`, `aiMessageKey`
- `speak`, `unlockSpeech`, `useSpeech`
- `deriveToday`, `useTodayPlan` (P5, bestehende Signaturen)

**Tests:** §8.2 P4.

### 9.5 P5 – Heute, Pflicht, Serie, Dein Stand, Einstellungen

**Dateien:**
- `src/features/today/{TodayScreen.tsx,store.ts}`
- `src/domain/plan/{types,buildPlan,coach}.ts`, `src/domain/vocab/goal.ts`
- `src/domain/{overview,streak,date}.ts`
- `src/features/progress/OverviewScreen.tsx`, `src/features/settings/SettingsSheet.tsx`, `src/app/actions.ts`
- `docs/datenmodell.md`
- `src/i18n/parts/today.{de,en}.ts`
- Tests: `tests/unit/{dayState,buildPlan,coach,pflichtSince,streak,goal,overview,simulation,date}.test.ts`

**Liefert:**
- `ensureDay(nowMs)` (§4.8), `readPlan`, `buildPlan`
- `deriveToday` (Signatur §4.8, kompatibel zur MVP-Nutzung in P4)
- `coachCards`, `vocabGoal`
- `changeNewPerDay(v: 0 | 2 | 5 | 10)`
- Heute-DOM nach §5.1 mit `layoutId = LAYOUT_ID.review`
- „Dein Stand" mit `stageOf`, Wendungszeile und Zielzeile
- Einstellungen mit „Neue Wörter pro Tag", Lizenzen (`LICENSE-cmudict.txt?raw`) und Diagnosegrößen

**Nutzt:** `planRound`, `buildTrainCards`, `buildChunkCards`, `newVocabDoc`, `stageOf` (P1), `startSession` (P4), `unlockSpeech` (WP1), `readDoc`.

**Tests:** §8.2 P5.

### 9.6 P6 – Testdaten, Adapter, E2E-Suite

**Dateien:**
- `scripts/{generate-seed.mjs,seed-golden.mjs,check-platform.mjs}`, `seed/sample-data.json`
- `src/platform/dev/{install,fakeRuntime,fakeSample,memoryDb,inject,cannedReplies,fakeSpeech,scenarios}.ts`
- `tests/support/{time.ts,rng.ts,lexMock.ts,seedFacts.ts,seed-golden.json}`
- `tests/e2e/*` (alle Dateien einschließlich `fixtures.ts`, `modeScenarios.ts`, `helpers/*`), `playwright.config.ts`
- `package.json` (nur Skripte: `test:e2e:smoke`, `seed` ruft `seed-golden` mit auf)
- Tests: `tests/unit/{seed,scenarios,language,memoryDb}.test.ts`

**Liefert:**
- Seed §8.3, Adapter §8.4, Szenarien §8.4
- E2E-Dateien §8.5 gegen den DOM-Vertrag §5.1
- Hilfen `dayConsistency(page)`, `languageProblems(page, root?)`, Flug-Rekorder, `forceMode(ex)`

**Nutzt:** nur die festen Typen und den DOM-Vertrag. Die E2E-Dateien laufen erst nach der Integration grün; das Paket selbst liefert grüne Unit-Tests und einen grünen `npm run build:runtime`.

### 9.7 Integration (Lead, nach P1–P6)

1. **Zusammenführen** in der Reihenfolge P1, P2, P3, P4, P5, P6. Konflikte sind durch die getrennten Dateien ausgeschlossen. Tritt einer auf, gilt der Plan und der Lead entscheidet.
2. **Verdrahten:**
   - `App.tsx`: `<LayoutGroup>` + `AnimatePresence mode="popLayout"`, `WordTapProvider` und `LookupHost` innerhalb `HiddenInputProvider`, `initSpeech({voice, rate})` beim Start, `setSpeechPrefs` bei Profiländerung.
   - `views/registry.ts`: `BODIES.tiles = TilesBody`.
   - Obsolete MVP-Schlüssel in `core` entfernen.
3. **Prüfen:**
   - `npm run verify` (einschließlich E2E-Suite P6).
   - Rote Tests: höchstens zwei Behebungsversuche je Ursache (CLAUDE.md A2), danach Befund offen melden.
   - Unit-Test `no-placeholders`: kein `TODO`, kein `FIXME`, keine Dev-Testseite in `src` (Kap. 12).
4. **Prüfer**, je eine Runde plus eine gezielte Nachprüfung:
   - `platform-guard`: eine Datei, < 16 MB, erwartet ≈ 1,8 MB, keine Ladeziele, keine Dev-Marker, kein `AbortSignal.any`, kein `Promise.withResolvers`, kein `requestIdleCallback`.
   - `data-guard`: §3, `set` und `delete` nur in `writer.ts`/`platform/dev`, keine Schreibvorgänge nach `daily`/`feed`.
   - `ux-reviewer`: Bildschirmfotos `screens-phase1`.
   - `learning-scientist`: Katalog, Bremse, Notentabelle, E17.
   - `qa-runner`.
5. **Ausliefern:**
   - `dist/index.html` bauen, Commit „Phase 1: Kern-Erlebnis".
   - `main` zusammenführen und pushen.
   - CLAUDE.md A4 abhaken.
   - Drei-Satz-Bericht mit der Prüfliste §8.6.
   - Veröffentlichung laut A7: erst Test-Artefakt (Kopie), nach grünen Tests und Prüfungen auf die Produktivadresse.

### 9.8 Reihenfolge und Parallelität

```
Schritt 0 (Lead) ──► P1 ─┐
                   ├► P2 ─┤
                   ├► P3 ─┼──► Integration ──► Prüfer (1 Runde + 1 Nachprüfung) ──► Commit ──► main ──► Test-Artefakt ──► Produktiv
                   ├► P4 ─┤
                   ├► P5 ─┤
                   └► P6 ─┘
```

**Risiken und Gegenmaßnahmen:**

| Risiko | Gegenmaßnahme |
|---|---|
| Tastatur im iframe am iPhone (kein WebKit in der Cloud) | Dauerhaftes Feld, synchroner Fokus, Prüfliste §8.6 |
| P4 und P5 bauen gegen Funktionen aus P1, die erst bei der Integration ihr volles Verhalten haben | Signaturen sind in Schritt 0 fest; Verhalten nur über Unit-Tests je Paket, E2E erst in der Integration |
| Blind geschriebene E2E-Suite | DOM-Vertrag §5.1 ist verbindlich; Abweichungen behebt die Integration im Code, nicht im Test, außer der Test widerspricht dem Plan |
| Wachstum `app/lookup` durch `null`-Einträge | Diagnosewarnung ab 200 KiB, Verdichtung als Beschluss in Phase 7 |
| Plan-Schreibvorgang zweier Geräte am selben Morgen | `transform` liest frisch, der Plan ist deterministisch, der zweite Schreiber findet einen v1-Plan und schreibt nicht |
| Größe des Builds | ≈ 1,8 MB (0,9 heute + Wörterbuch 0,29 + Lautschrift 0,33 + θ 0,04 + Code); `check-platform` gibt ab 3 MB einen Hinweis |
