# Phase 6 (Urteil) und Phase 7 (Politur und Umzug): verbindlicher Umsetzungsplan

Stand: 26.09.2026. Synthese aus Architektur, Lerndesign, Daten, Interaktion und Tests.
Vorrang bei Widersprüchen: `contract/*.d.ts` > CLAUDE.md > `docs/auftrag.md` > dieser Plan.
Ablage laut A2: `/home/user/lingo-engine-x/docs/phase6-plan.md`. Der Lead legt ihn an, ich ändere nichts.

**Grundlage, die ich gelesen habe:**
- CLAUDE.md vollständig
- `docs/auftrag.md` Kap. 0–15
- alle fünf Verträge in `contract/`
- `docs/datenstruktur.json`, `docs/altapp-analyse.md`, `docs/datenmodell.md`
- `docs/phase1-plan.md` §0–4.9
- der Code unter `src/`, vor allem `data/{schemas,writer,live,snapshot,paths}.ts`, `domain/{overview,streak,date}.ts`, `domain/plan/*`, `domain/progress/profilePatch.ts`, `features/{today,progress,settings}/*`, `app/*`, `ai/*`, `prompts/*`, `platform/dev/{cannedReplies,memoryDb}.ts`, `content/legacy/{cefr,vtest}.json`, `scripts/{generate-seed,check-platform}.mjs`

---

## 0. Ausgangslage, Vorbedingungen, Widersprüche

### 0.1 Vorbedingung
Phase 6 setzt voraus, dass Phase 1 (Rest) und die Phasen 2–5 gemergt sind.

- Im Repository liegen heute nur das MVP und `docs/phase1-plan.md`. Pläne für Phase 2–5 gibt es noch nicht.
- Deshalb hängt Phase 6 an keiner fremden Datei direkt. Alles läuft über drei **Adapter-Schnittstellen**:
  - `src/domain/assessment/sources.ts`: Belege lesen
  - `src/domain/plan/channels.ts`: Kanal-Katalog
  - `src/features/progress/actionRoute.ts`: „Üben"-Ziele
- **Schritt 0** gleicht diese drei Dateien mit den tatsächlichen Formaten aus Phase 2–5 ab. Nur dort wird angepasst.

### 0.2 Auftrag gegen Vertrag (es gilt der Vertrag)

| # | Auftrag | Vertrag | Entscheidung |
|---|---|---|---|
| W1 | Kap. 5: Die Einschätzung „erneuert sich automatisch" | `sample.d.ts`: „sample on an explicit viewer action … or once at load … never from a loop or a timer" | Es gibt keinen Timer. Automatisch heißt: an **zwei Handlungspunkten** Emrahs (Reiter „Dein Stand" öffnen; Pflicht wird erledigt), höchstens einmal je Lerntag über alle Geräte (Sperre per `acquire`), nie wiederholt. |
| W2 | Kap. 10: „Timeout" | `sample.d.ts`: kein eigener Timer | A6.2 bleibt: „Denkt nach …", ein Hinweis nach `SLOW_AFTER_MS.complex = 90 s`, ein Stopp-Knopf (`src/ai/gate.ts:26,89`). |
| W3 | Kap. 10: einmal neu anfragen | „NEVER retry" | A6.3 bleibt (`gate.ts:136-146`). |
| W4 | Kap. 5: `modelTier: "complex"` | `sample.json` meldet `modelTierApplied` nicht (`sample.d.ts:486`, `ai/types.ts:44`) | Das KI-Tor bekommt die Variante `verb: 'text-json'`: Aufruf `sample()` und eigenes, tolerantes Parsen nach denselben drei Regeln wie `json`. Die tatsächlich antwortende Stufe wird als `tier` gespeichert. Die Oberfläche zeigt „mit einfacherem Modell eingeschätzt", wenn `tier !== 'complex'`. |
| W5 | Phase 7: Profil auslagern „ohne Löschen" | `db.d.ts:289-296`: `update` mischt verschachtelte Objekte, eine Map kann also nie schrumpfen. Verkleinern geht nur mit `set` (ganzes Dokument). | Neue, eng bewachte Schreib-Operation `writer.compact` (§12.3): erst Archiv anlegen und prüfen, dann `set`. Sie läuft nur ab einer Schwelle, nur nach Emrahs Tipp im Trockenlauf und nur nach dem Abnahme-OK. |

---

## 1. Ziel und Umfang

**Phase 6:**
- Die KI urteilt über Emrahs Niveau:
  - Gesamtstufe mit Begründung und Trend
  - sechs Fertigkeiten mit Belastbarkeit
  - Stärken und Blocker, jeweils mit „Üben"-Knopf
  - ein Fokus, der in den Tagesplan fließt
- „Dein Stand" wird zum vollständigen Fortschritt:
  - Fehler-Radar
  - Weg nach C1 (Can-Do-Liste)
  - Verlauf
  - Wochenbericht
  - eingeklappte Messwerte zu FSRS und BKT
  - Wortschatzziel 8.000 mit Prognose
  - Wortschatztest
- Der Tagesplan gewichtet alle Kanäle nach Kap. 6.1, und jede Zeile nennt ihren Grund.
- Die Einstellungen sind vollständig (Kap. 6.14).

**Phase 7:**
- Leistung messen und verbessern
- ein letzter Design-Durchgang über alle Bildschirme
- Abschlussprüfung gegen Kap. 14 und 15, dazu die offenen Hinweise H3, H5, H6 und W1–W9
- Profil-Wachstum beherrschen (Auslagerung ohne Datenverlust)
- Veröffentlichung auf der Produktivadresse nur nach Emrahs OK

**Nicht enthalten:**
- neue Übungsarten
- Änderungen an `daily/*` und `feed/*`
- eine Serienregel, die von A6.13 abweicht

---

## 2. Entscheidungsregister

| # | Frage | Entscheidung | Begründung |
|---|---|---|---|
| E1 | Format von `app/assess` | Hülle `{d, t, lang, answers, writings, data:{…}}` wie in der alten App. Additiv kommen dazu: `v:2, pv:'assess@1', tier, basis, hist[]`. `data` wird immer **vollständig** geschrieben, fehlende Felder als `null`. | A6.10. `update` mischt Objekte, also darf kein Altschlüssel stehen bleiben. |
| E2 | Einstufung frei erfunden? | Nein. Der Code rechnet je Fertigkeit eine **Belegstärke** aus. Die Belastbarkeit ist `min(KI, Code)`. Ohne Belege gilt `level = null` mit dem Text „Noch zu wenig Belege". | Kap. 5: „Lieber dünne Datenlage". |
| E3 | Belegbindung | Jede Stärke und jeder Blocker trägt `ev: string[]` mit Beleg-Kennungen. zod lehnt unbekannte Kennungen ab. | Urteil aus echten Belegen (Kap. 2.3). |
| E4 | Werte der Belastbarkeit | `thin` \| `fair` \| `good`, wie in der alten App (Seed-Zeilen 515–520). Angezeigt als „dünn / brauchbar / gut". | Kompatibel. |
| E5 | Werte des Trends | `up` \| `flat` \| `down`. Gelesen wird tolerant. | Die alte App schreibt `up`. |
| E6 | Wann wird neu eingeschätzt | Die Regel `assessDue` (§4.4). Auslöser siehe W1. Wer auslöst, holt sich eine Sperre (`acquire`) auf `app/assess`, `ttlMs` 240 000. | Kein Doppellauf auf zwei Geräten. |
| E7 | Abbruch bei Bildschirmwechsel | Die Einschätzung läuft als **App-Aufgabe** (eigener Controller). Abbruch nur per Stopp-Knopf oder `pagehide`. | A6.2 nennt „Bildschirmwechsel" für Übungen. Ein Lauf der Stufe `complex` (30–120 s) soll beim Reiterwechsel nicht verfallen. |
| E8 | Sprachtreue | Weicht `assess.lang` von der Oberflächensprache ab: Stufen weiter zeigen (Sprache egal), Texte ausblenden und `assessDue = 'lang'` setzen. Der Lauf erzeugt die Texte neu. | Kap. 10, Kap. 15. |
| E9 | Kanalgewichtung | Reine Funktion `rankChannels` (§5), ohne Zufall. Gleichstand löst `hash32(day+id)`. Das Planformat bleibt v1. Neu: Pflicht `['lesson','review','ch:<ids[0]>']`, `ids` sind die 3 besten, `why[i]` höchstens 2 Schlüssel. | E1 aus Phase 1, Kap. 6.1, Kap. 15. |
| E10 | Grund „Claudes Fokus" mit Thema | `WhyKey` wird additiv erweitert zu `[key, n?, ref?]`, z. B. `['whyFocus', 0, 'grammar:mixed-cond']`. `ref` ist eine Kennung, kein Satz. | Kap. 6.1: nur Schlüssel speichern. Der Plan bleibt über den Tag stabil, auch wenn sich die Einschätzung ändert. |
| E11 | Tagesziel in Minuten | Neues Feld `app/profile.goalMin` ∈ {10, 15, 20, 25, 30, 40}, Standard 25. `profile.goal` (XP) bleibt unangetastet. Wirkung: (a) Minutenbudget für den Pflichtkanal (§5.3); (b) Tagesbilanz „{min} von {goal} Min."; (c) Wochenzeile im Verlauf. **Kein zweiter Ring** auf Heute. | Kap. 2.1: eine rote Linie. Kap. 7: Tagesziel. |
| E12 | Ton | Neues Feld `app/profile.sound: boolean`, Standard `false`. Klänge werden per WebAudio-Oszillator erzeugt, ohne Dateien, in `src/platform/sound.ts`. | Kap. 4.7. Nichts wird von außen geladen. |
| E13 | Stimme und Tempo | Die bestehenden Felder `voice` (Name) und `rate` (0,8–1,1). Fehlt die Stimme auf dem Gerät, gilt die beste en-US-Stimme und der Hinweis „auf diesem Gerät nicht verfügbar". | Die alte App nutzt dieselben Felder. Stimmen unterscheiden sich je Gerät. |
| E14 | Verlauf | `profile.history[]` (≤ 120) wird fortgeführt: ein Tagesbild je Lerntag in `ensureDay`, mit Markierung `lx:1`. Neue Kennzahlen sind in §7.4 definiert. Im Diagramm ist die Nahtstelle markiert. | Kontinuität. Die Formeln der alten App sind nicht belegt, deshalb offen gekennzeichnet. |
| E15 | Wochenbericht | Fakten deterministisch in `domain/progress/weekly.ts`. Dazu ein KI-Text `weekly-report@1` (`default`) je abgeschlossener ISO-Woche, gespeichert in `app/weekly.items[]` (≤ 26). Er entsteht beim Öffnen des Reiters „Verlauf", einmal je Woche. | Kap. 10: erzeugte Inhalte werden gespeichert. |
| E16 | Can-Do | `cefr.json` mit Status je Punkt: `reached` (Beleg), `self` (von Emrah markiert, in `profile.canDo[<cefrId>] = datum`), `open`, `thin`. Markierungen tragen `ev:'self'` und gehen so in die Einschätzung ein. | Die alte App nutzt `canDo` mit Lektions-Kennungen, die `cefr`-Kennungen überschneiden sich nicht. |
| E17 | Wortschatztest | XState-Maschine: Ja/Nein auf 100 Wörter plus 12 Pseudowörter → 20 Bedeutungsproben → 10 aktive Wörter. Ergebnis im alten Format `vtests[]` (§8). Englische Kurzbedeutungen liegen in der neuen Datei `src/content/vtest-en.json` (100 Einträge, von learning-scientist geprüft). | Kap. 3.2: XState. Sprachtreue: `vtest.json` hat nur `de`. |
| E18 | Aufbau von „Dein Stand" | Kopfzeile (Serie · Kurs · Karten) und vier Reiter: **Urteil · Fehler · Weg nach C1 · Verlauf**. Der zuletzt offene Reiter steht in `localStorage` (Bequemlichkeit). | Kein endloses Scrollen am Handy. Nichts erscheint doppelt (Kap. 15). |
| E19 | Abonnements | Neu nur `app/radar` und `app/weekly` (je ein Hook, solange der Reiter offen ist) und ab Phase 7 die Sammlung `archive`. Alles andere wird bei Bedarf einmal per `get()` gelesen. | ≤ 64 Abos (`db.d.ts:389`). |
| E20 | Profil verkleinern | Phase 7: Die Schwelle ist 160 KiB, die Warnung kommt ab 128 KiB. Ausgelagert werden Kalenderjahre ≤ laufendes Jahr − 2 nach `archive/profile-<JJJJ>`. Serie, Verlauf und Export lesen Archiv und Profil zusammen. | W5, A6.6. |

---

## 3. Dateiplan

Legende: N = neu, Ä = geändert. In Klammern das Paket (§11).

```
src/
  ai/gate.ts Ä (S0)                    verb 'text-json' + tierApplied
  prompts/
    assess.ts N (A)                    assess@1, complex, cache:false, Schema
    weeklyReport.ts N (B)              weekly-report@1, default
    registry.ts Ä (S0)
  data/
    schemas.ts Ä (S0)                  §4.1, §6.2, §7.1, §8.3, §12.3
    paths.ts Ä (S0)                    app/weekly, Sammlung archive
    live.ts Ä (S0)                     useDocLive(path): ein Abo je Hook-Instanz
    reads.ts Ä (S0)                    readDays(from,to), readCollection(name)
    writer.ts Ä (P7-3)                 compact() und lease()
  domain/
    assessment/
      types.ts N (S0)                  Level, Confidence, Dim, AssessData, EvidencePack
      sources.ts N (A)                 tolerante Leser je Quelle (Adapter zu Phase 2–5)
      evidence.ts N (A)                Belegpaket + Byte-Budget
      strength.ts N (A)                Belegstärke je Fertigkeit (Code)
      validate.ts N (A)                Nachprüfung: Belastbarkeit, level null, Aktionen
      due.ts N (A)                     assessDue()
      envelope.ts N (A)                readAssess (beide Formen), assessWrite()
      actions.ts N (A)                 erlaubte Aktionen, focusChannels()
    plan/
      channels.ts N (C)                Katalog: id, actKeys, skill, minutes, dueSource
      weights.ts N (C)                 rankChannels()
      buildPlan.ts Ä (C)               Pflicht lesson+review+ch:, ids/why
      types.ts Ä (S0)                  WhyKey[key,n?,ref?], DutyId
    progress/
      radar.ts N (B)                   Gruppen, Trends, Beispiele
      cando.ts N (B)                   Status je Can-Do
      weekly.ts N (B)                  Wochenfakten
      history.ts N (B)                 Tagesbild, Reihen für Diagramme
      measures.ts N (B)                FSRS/BKT-Messwerte
      settings.ts N (F)                normGoalMin, normNewPerDay, normRate
    vocab/goal.ts Ä (B)                Kurve und Prognose (Phase 1 §4.9)
    vtest/
      build.ts N (E)                   Testaufbau mit Startwert
      score.ts N (E)                   Formeln §8.2
      persist.ts N (E)                 vtestPatch() idempotent
    capacity/
      profileSize.ts N (P7-3)          Bytes, Prognose
      compact.ts N (P7-3)              Auslagerungsplan (rein)
    streak.ts Ä (P7-3)                 Tage aus dem Archiv zusammenführen (Adapter)
  content/vtest-en.json N (E)
  platform/
    sound.ts N (F)                     WebAudio, Merkmalserkennung
    speech.ts Ä (F)                    listVoices(), previewVoice()
    dev/canned/assess.ts N (A) · canned/weekly.ts N (B) · cannedReplies.ts Ä (S0)
    dev/memoryDb.ts Ä (G)              Fehler-Einspeisung für compact und Leases
  features/
    progress/
      ProgressScreen.tsx N (D)         ersetzt OverviewScreen.tsx (Ä→Weiterleitung)
      JudgeTab.tsx · ErrorsTab.tsx · PathTab.tsx · HistoryTab.tsx N (D)
      assessRun.ts N (A)               zustand-Store + Ablauf mit Sperre
      weeklyRun.ts N (B)
      actionRoute.ts N (D)             Aktion → Route oder null (Knopf ausblenden)
    vtest/VtestScreen.tsx · machine.ts N (E)
    today/store.ts Ä (C)               ensureDay: gewichteter Plan, Tagesbild
    today/TodayScreen.tsx Ä (C)        Gründe je Zeile, Minutenbilanz
    settings/SettingsSheet.tsx Ä (F) · LearningSection.tsx · VoiceSection.tsx N (F)
    settings/Diagnostics.tsx N (P7-3)  Kapazität, Profilgröße, Verdichten
  ui/charts/{LineChart,Heatmap,BarList,Dots}.tsx N (D)   SVG, jeweils mit Tabellen-Alternative
  ui/Tabs.tsx N (D)
  app/nav.ts Ä (INT)                   overview{tab?}, vtest
  app/actions.ts Ä (F)                 changeGoalMin, changeSound, changeVoice, changeRate, toggleCanDo
  app/App.tsx Ä (INT)                  Auslöser für die Einschätzung, `archive`-Abo (P7)
  i18n/parts/progress.{de,en}.ts · vtest.{de,en}.ts · settings.{de,en}.ts N (S0 → Paket)
scripts/generate-seed.mjs Ä (G)        assess.hist, radar mit Schreib-Kategorien, 2. Woche Log
tests/unit/* · tests/e2e/{progress,vtest,settings,weighting,perf,acceptance}.spec.ts (G, P7)
docs/datenmodell.md Ä · docs/vtest.md N · docs/abnahme.md N (P7-4)
```

---

## 4. KI-Einschätzung

### 4.1 Datenform `app/assess` (Hüllenform, geschrieben)
```json
{ "d":"2026-09-27","t":1790488800000,"lang":"de","answers":1932,"writings":7,
  "v":2,"pv":"assess@1","tier":"complex",
  "basis":{"answers14":412,"grammarN":1280,"writing":7,"reading":3,"listening":4,"speaking":2,"vtestD":"2026-09-06"},
  "data":{ "level":"<Satz>","cefr":"B2","levelWhy":"…","trend":"up","trendWhy":"…","today":"…",
    "c1gap":["…","…"],
    "strengths":[{"title":"…","why":"…","ev":["w:w1790…"]}],
    "blockers":[{"title":"…","why":"…","fix":"If we had tested earlier, …","action":"grammar:mixed-cond","ev":["g:mixed-cond","r:3"]}],
    "dims":[{"id":"grammar","level":"B2","confidence":"good","why":"…"}, …6],
    "focus":{"title":"…","why":"…","action":"grammar:mixed-cond","days":3,"channels":["gram","order"]} },
  "hist":[{"d":"2026-09-24","cefr":"B2","trend":"up","dims":{"grammar":"B2","speaking":null}}] }
```

**Schema** (`schemas.ts`, alles `nullish`, `looseObject`):
- `assessDataSchema`: zusätzlich `strengths[].ev`, `blockers[].ev` (`strArr`) und `focus.channels` (`strArr`)
- `assessSchema`: zusätzlich `v`, `pv`, `tier`, `basis` (`loose`) und `hist` (`looseArr`)

**Lesen** (`envelope.readAssess(doc)`):
- Ist `data` ein Objekt, gilt die Hülle, sonst die flache Form aus Anhang B.
- `lang` fehlt → `'de'` (wie `overview.ts:105`).

**Schreiben** (`assessWrite(cur, result, startedAt)`) über `writer.transform('app/assess', …)`:
- Dokument fehlt → `set(envelope)`.
- Ist `cur.t > startedAt`, war ein anderes Gerät schneller → `null`, nichts schreiben.
- Sonst `update(envelope)` mit vollständigem `data`: jeder Schlüssel wird gesetzt, fehlende als `null`.
- `hist = [...cur.hist, eintrag].slice(-60)`.
- Flache Altfelder oben im Dokument bleiben unberührt.

### 4.2 Belege (`evidence.ts`, `sources.ts`)

`buildEvidence(input): EvidencePack` liefert `{ sections: Section[], ids: Set<string>, counts }` mit Beleg-Kennungen:

| Präfix | Quelle | Inhalt (gekürzt) | Deckel |
|---|---|---|---|
| `p:` | `app/profile` | aktive Tage, Minuten und `act` der letzten 14 Tage, `ema`, `n`, `goalMin` | 1,5 KB |
| `g:<topic>` | `grammar/*` + `TOPICS` | `p`, `n`, `recent`, bis zu 3 `errors` `{q, given, ans}` | 16 × 700 B |
| `r:<i>` | `app/radar.events` (neueste 80) | `c, s, q, g, a` | 8 KB |
| `w:<id>` | `writing/*` (5 neueste) | `cefr`, `scores`, ≤ 5 Fehler (beide Formen: `orig/fix`, `wrong/right`) | 5 × 1,5 KB |
| `v:` | `vocab/*`, `chunk/*`, `vtests` | Karten je Stufe, mittlere Abrufwahrscheinlichkeit, 15 Blutegel, `ema.colloc`, letzter Test | 3 KB |
| `l:<day>` | `log/<day>` (14 Tage, einmal `get`) | Trefferquote je Art (`k:'v'`, `k:'g'`, `type:*`), oft vergessene Wörter | 3 KB |
| `rd:<id>` | `reading/*` (5) | `score`, `language.cefr`, Fehler | 3 KB |
| `li:` | `profile.listen[]`, Diktat-Einträge im Log | `n/ok`, `level`, `rate` | 1,5 KB |
| `s:<id>` | Rollenspiel-Analysen (Adapter zu Phase 3, z. B. `scene/*.report`) | Korrektheit, C1-Aufwertung, Stufe | 5 × 1,5 KB |
| `pp:<id>` | `preply/pi*` | Korrekturen `{wrong, right, topic}` | 3 KB |
| `cd:<id>` | `profile.canDo` (Can-Do-Kennungen) | selbst markiert | 0,5 KB |
| `a:prev` | letzte Einschätzung | `cefr`, `dims.level`, `d` | 0,5 KB |

**Regeln:**
- Nutzertext immer über `clip()` (`prompts/common.ts:32`).
- Das Byte-Budget für die Belege ist **46 000 B**, gesamt höchstens `PROMPT_MAX_BYTES` 60 000 B.
- `fitBudget` kürzt nach Priorität, zuerst `pp`, `li`, `rd`, dann `r`.
- `sources.ts` liest jede Quelle mit zod und `safeParse`. Eine fehlende Quelle ergibt einen leeren Abschnitt, nie einen Fehler.

### 4.3 Belegstärke im Code (`strength.ts`, Fenster 60 Tage)

| Fertigkeit | `good` | `fair` | sonst |
|---|---|---|---|
| grammar | ≥ 200 Antworten und ≥ 8 Themen | ≥ 50 | `thin`, bei 0: `none` |
| vocabulary | Test ≤ 90 Tage **und** ≥ 300 Wiederholungen in 30 Tagen | eines von beiden | |
| reading | ≥ 5 Ergebnisse | ≥ 2 | |
| listening | ≥ 6 (Hörtexte + Diktatrunden) | ≥ 2 | |
| writing | ≥ 5 korrigierte Texte | ≥ 2 | |
| speaking | ≥ 5 Analysen | ≥ 2 | |

`validate.ts` erzwingt danach:
- `confidence = min(KI, Code)`;
- bei `none` gilt `level = null` und `why` = i18n-Text, nicht KI-Text.

### 4.4 `assessDue` (rein, `due.ts`)
```ts
type DueReason = 'none'|'lang'|'age'|'answers'|'text'|'speak'|'first';
export function assessDue(i:{assess:AssessRead|null; uiLang:Lang; today:string; profileAnswers:number;
  writings:number; analyses:number; lastAutoDay:string|null}): DueReason
```

Die Regeln in dieser Reihenfolge:
1. Ist heute schon automatisch gelaufen (`lastAutoDay === today`, aus `app/assess.run.d`), gilt `none`.
2. Keine Einschätzung und `profileAnswers ≥ 100` → `first`.
3. `assess.lang ≠ uiLang` → `lang`.
4. Ist `assess.d === today`, gilt `none`.
5. Mindestens 3 Lerntage alt → `age`.
6. `profileAnswers − assess.answers ≥ 300` → `answers`.
7. `writings > assess.writings` → `text`.
8. Mindestens 2 neue Rollenspiel-Analysen → `speak`.

### 4.5 Ablauf (`features/progress/assessRun.ts`, zustand)

Zustände: `idle | locking | gathering | asking | saving | done | error(key) | busy(other device)`.

1. Auslöser:
   - `useProgressAutoAssess()`: Reiter „Dein Stand" geöffnet;
   - der Übergang `allDone` auf Heute (`TodayScreen`, einmal je Tab und Tag);
   - der Knopf „Neu einschätzen" (`data-ai`), immer erlaubt außer während eines Laufs.
2. Nur wenn `aiUsable()` (`ai/scope.ts:53`).
3. `writer.lease('app/assess', deviceId, 240_000)`:
   - Existiert das Dokument nicht, gibt es keine Sperre.
   - `acquired: false` → `busy`: „Wird gerade auf einem anderen Gerät erstellt".
4. `update({run:{d: today, t, by: deviceId}})` auf `app/assess`, nur beim automatischen Auslöser (Sperre für den Tag).
5. Belege lesen: parallel höchstens 4 `get()`, dazu die Live-Daten.
6. `askJson({template: assess, priority: 'background'})` mit eigenem Controller.
7. `validate` → `assessWrite`.

**Fehler:**
- `rate_limited` und alle anderen Codes: der alte Stand bleibt und die Zeile „Einschätzung konnte nicht erneuert werden · Erneut versuchen".
- Kein zweiter automatischer Versuch am selben Tag.

### 4.6 Vorlage `assess@1` (`prompts/assess.ts`)
- `tier: 'complex'`, `cache: false`, `verb: 'text-json'`.
- **Variablen:** `{ lang, evidence: EvidencePack, allowedActions: string[], prev: {cefr, dims} | null, today }`.
- **Aufbau:** Kopfzeile `[assess@1]`, dann in dieser Reihenfolge:
  1. Rolle: „strict CEFR examiner for a German-speaking Head of Business Development, B2 aiming for C1".
  2. Urteilsregeln:
     - nur aus den Belegen;
     - `level` A2…C1+ nur bei Belegen;
     - `thin` statt Raten;
     - Trend gegen `prev`.
  3. Sprachregeln:
     - Prosa in `{German|English}`;
     - `fix` in amerikanischem Englisch;
     - Fachbegriffe der Grammatik dürfen englisch sein.
  4. Belege als nummerierte Zeilen `[id] …`.
  5. Liste der erlaubten `action`.
  6. Beispiel-JSON (besteht selbst das Schema, Test).
  7. Längengrenzen.
- **Schema** (zod, abhängig von den Variablen):
  - `cefr` ∈ `A2|B1|B1+|B2|B2+|C1|C1+`
  - `level` 20–220 Zeichen, `levelWhy` ≤ 400
  - `trend` ∈ `up|flat|down`, `trendWhy` ≤ 300
  - `today` ≤ 160
  - `c1gap` 2–4 × ≤ 90
  - `strengths` genau 2 `{title ≤ 60, why ≤ 240, ev ≥ 1}`
  - `blockers` 2–3 `{title ≤ 60, why ≤ 240, fix ≤ 200 (Englisch), action ∈ allowed, ev ≥ 1}`
  - `dims` genau 6, eindeutige `id` ∈ {grammar, vocabulary, reading, listening, writing, speaking}, `level` Stufe oder `null`, `confidence` ∈ `thin|fair|good`, `why` ≤ 200
  - `focus {title, why, action ∈ allowed, days 1–7}`
  - `ev` ⊂ `evidence.ids`
  - `langOf([...Prosafelder], lang)`, `fix` über `isWrongLang(…, 'en')`
- **Erlaubte Aktionen** (`actions.ts`), nur solche mit Route (`actionRoute ≠ null`):
  - `grammar:<topic>`, `errors:<topic>`, `lesson:<lid>`
  - `vocab:review`, `vocab:leech`, `chunks`
  - `write`, `read`, `listen`, `dictate`, `cloze`, `order`, `sprint`, `discover`
  - `speak` bzw. `speak:<sceneId>`, `business:email|nego|present`
- **`focusChannels(action)`:**
  - `grammar:*`/`errors:*` → `['gram','order']`
  - `vocab:*`/`chunks` → `['vocab','cloze']`
  - `speak*` → `['speak']`
  - `write` → `['write']`
  - `listen`/`dictate` → `['listen','dictate']`
  - `read`/`discover` → `['read','discover']`
  - `business:*` → `['speak','write']`
  - `lesson:*` → `[]`

---

## 5. Tagesplan mit Kanalgewichtung (Kap. 6.1)

### 5.1 Katalog (`channels.ts`)
`{ id, actKeys, skill, minutes, due?: 'grammarErrors'|'vocabDue'|null }`. Grundlage ist `altapp-analyse.md` §6:

| id | actKeys | skill | minutes |
|---|---|---|---|
| listen | listen, shadow | listening | 10 |
| read | read | reading | 10 |
| write | write | writing | 15 |
| gram | gram | grammar | 10 |
| vocab | cards | vocabulary | 10 |
| sprint | sprint | vocabulary | 5 |
| dictate | dictate | listening | 6 |
| cloze | cloze | vocabulary | 5 |
| order | order | grammar | 5 |
| speak | speak | speaking | 12 |
| discover | discover | reading | 15 |

- `executable(id)` kommt aus der Routentabelle (`actionRoute`).
- Nicht ausführbare Kanäle werden nie geplant (wie `EXECUTABLE_CHANNELS`, `buildPlan.ts:9`).

### 5.2 Punkte (`weights.ts`)

`rankChannels(i:{today, profile, assess, dims, grammarDue, weekActs}) → Array<{id, score, why: WhyKey[]}>`. Beiträge je Kanal:

| Faktor | Punkte | Schlüssel |
|---|---|---|
| liegengeblieben: Tage seit dem letzten `act` (auch `~`), Fenster 60 Tage | nie → +3; sonst `min(tage,7)/7 × 3` | `agoNever` / `agoDaysN, n` (ab 2 Tagen) |
| Claudes Fokus: Einschätzung gültig (`assess.d + focus.days > today`) und Kanal in `focus.channels` | +2,5 | `whyFocus, 0, action` |
| dünne Datenlage: `dims[skill].confidence ∈ {thin, fehlt}` | +1,5 | `whyThin` |
| schwächster Bereich: niedrigste Stufe unter den Fertigkeiten ≠ `thin`; ohne Einschätzung das kleinste `history`-Maß | +2 | `whyWeakest` |
| viel Fälliges: `gram` bei ≥ 3 fälligen Fehlersätzen und Themen | +1,5 | `whyDue, n` |
| diese Woche schon oft dran: Tage mit `act` in der ISO-Woche | −1 je Tag | (kein Grund) |

- `why` = die ≤ 2 größten positiven Beiträge.
- Gleichstand: `hash32(today+'|'+id)`, danach die Katalogreihenfolge.

### 5.3 Auswahl (`buildPlan.ts`)
- **Budget:** `goalMin − 17` (Lektion, alte Schrittzeiten 4/4/5/4) `− reviewMin` (27 s je Karte).
- **Pflichtkanal:** der erste mit dem höchsten Rang, der ins Budget passt, sonst der kürzeste.
- `ids = [Pflicht, zwei weitere nach Rang]`, `duty = ['lesson','review','ch:'+ids[0]]`.
- Ohne Lektion (Kurs fertig): `duty = ['review','ch:…']`.
- **Unveränderlich:** Ein v1-Plan von heute wird nie neu gerechnet (`readPlan`, `buildPlan.ts:14`). Eine neue Einschätzung wirkt ab dem nächsten Plan. So steht es auch in der Oberfläche.

### 5.4 Tagesbild (`ensureDay`, neuer Schritt 5)

```ts
transform('app/profile', cur => hasHistory(cur, today) ? null : { update: { history: [...hist, snap].slice(-120) } })
```

- `snap` kommt aus `history.snapshot()` (§7.4).
- Nur wenn das Profil gültig ist.

### 5.5 Heute (`TodayScreen.tsx`)
- Jede Pflicht- und Angebotszeile zeigt `reason(why)` als eine kurze Zeile, z. B. „Claudes Fokus · Mixed Conditionals" oder „seit 5 Tagen nicht dran".
- Die Bilanz zeigt „{min} von {goal} Min.".
- **Keine** Einschätzung auf Heute (rote Linie).

---

## 6. Fortschritt: Datenpfade und Abonnements

### 6.1 Lesen
- **Live, vorhanden:** `app/profile`, `app/course`, `app/assess`, `vocab`, `grammar`, `chunk`, `log/<heute>`.
- **Neu per `useDocLive`:** `app/radar` (Reiter Fehler) und `app/weekly` (Reiter Verlauf).
- **Einmal per `get()`:**
  - `log/<tag>` × 7 (Wochenbericht, beim Öffnen des Reiters);
  - `log/<tag>` × 30 (FSRS-Trefferquote, erst beim Aufklappen der Messwerte);
  - `writing`, `reading`, `preply` für die Einschätzung.

### 6.2 Neues Dokument `app/weekly`
`{ items: [{ w:'2026-W39', lang:'de', t, pv:'weekly-report@1', facts:{…}, text:{ headline, learned:[{text, ref}], next } }] }`

- Schema: `weeklySchema` (`looseObject`, `items` `looseArr`).
- Schreiben: `transform`. Dokument fehlt → `set`. Sonst `update({items})` mit `[...cur ohne gleiches w+lang, neu].slice(-26)`.

---

## 7. Fortschritt: Logik (Paket B)

### 7.1 Fehler-Radar (`radar.ts`)
- `radarView(events, now, lang)` → Kategorien mit `{c, name, n30, nPrev30, trend, sources, examples ≤ 2}`.
- **Namen:** Grammatik-Kennungen über `TOPICS` (Name bzw. `name_en`). Schreibkategorien (`grammar`, `vocabulary`, `collocation`, `register`, `spelling`, …) über i18n. Unbekannte Kategorien erscheinen roh.
- **Quellen:** g, w, r, v, s.
- **Aktion:** Grammatikthema → `errors:<topic>`, sonst `null`.
- Deckel 400 nur lesend. Geschrieben wird das Radar von den Phasen 2, 4 und 5.

### 7.2 Weg nach C1 (`cando.ts`)
`canDoStatus(item, env)`. Die Belegart steht in `item.evidence`:

| Belegart | erreicht, wenn |
|---|---|
| grammar | Mittel `p` der Lektionsthemen der Stufe ≥ .75 bei `n ≥ 20` |
| vocab_passive | Test B2 ≥ 6.000 / C1 ≥ 8.000 |
| vocab_active | aktiv ≥ 4.000 / 6.000 |
| colloc | `ema.colloc ≥ .75` und `n.colloc ≥ 100` |
| errors | Radarereignisse der letzten 30 Tage ≤ 50 % der vorigen 30 und ≤ 20 |
| writing | die letzten 3 Texte mit `cefr ≥ Stufe` |
| writing_register | Mittel `scores.register ≥ 4` (≥ 3 Texte) |
| listening | `ok/n ≥ .8` auf Stufe (≥ 3) |
| fluency | Sprechstufe (Einschätzung, `confidence ≠ thin`) ≥ Stufe |
| self | nur Selbstmarkierung |

- Keine Daten → `thin`.
- Zusätzlich in der Anzeige: `c1gap` aus der Einschätzung.

### 7.3 Wochenbericht (`weekly.ts`)
`weekFacts(i:{week, logs, vocab, grammar, writing, radar, profile})`, jeder Fakt mit Kennung:

- Wörter, die „wirklich sitzen": erste Einführung in der Woche und inzwischen `fsrs.stability ≥ 3` bzw. eine richtige Wiederholung nach mindestens 1 Tag.
- Grammatikthemen mit dem Anstieg von `p` (`hist`).
- Fehlersätze, die erledigt sind (`box` 3).
- Texte, Rollenspiele.
- Minuten und Pflichttage.
- Die Woche folgt dem Lerntag (04:00) und `isoWeek`.

### 7.4 Verlauf und Tagesbild (`history.ts`)
- **Neue Definition, gekennzeichnet mit `lx:1`:**
  - `o = ema.all`, `vo = ema.recog`, `co = ema.colloc`, `li = ema.listen`, `wr = ema.write`
  - `gr` = Mittel `p` (Anzeige-Verfall `p0 + (p−p0)·e^{−t/45}` wie in der alten App)
  - `re` = Mittel `score` der letzten 5 Leseergebnisse, sonst der Vorwert
  - `fl` = Sprint-Trefferquote, sonst der Vorwert
  - `vs = vocabGoal.now`
- **Reihen:** Aktivität (Heatmap 26 Wochen aus `minutes`/`days`), Linien `gr/vo/li/wr` (120 Tage), Einschätzungsspur (`assess.hist`), Wortschatz (Testpunkte und Prognose), Meilensteine je Einheit (`course.done[*].d`).

### 7.5 Messwerte (`measures.ts`, eingeklappt)
- **FSRS:** Karten je Zustand, mittlere Abrufwahrscheinlichkeit, mittlere Stabilität, Blutegel, echte Trefferquote der letzten 30 Tage (`ctx:'rev'`).
- **BKT:** je Thema `p` (mit Verfall), `n`, Treffer der letzten 10, nächste Fälligkeit.

### 7.6 Vorlage `weekly-report@1`
- `tier: 'default'`, `cache: true`.
- Eingabe: Fakten mit Kennungen (≤ 6 KB) und Oberflächensprache.
- Schema:
  - `headline` ≤ 90
  - `learned` 2–4 `{text ≤ 160, ref ∈ Fakten}`
  - `next` ≤ 160
  - `langOf`
- Wird nur erzeugt, wenn mindestens 3 Fakten da sind. Sonst gibt es nur die Fakten.

---

## 8. Wortschatztest (Paket E)

### 8.1 Ablauf (XState `features/vtest/machine.ts`)

`intro → yesno(112) → meaning(≤20) → active(10) → scoring → saving → result`, dazu `saveError` (Knopf „Erneut speichern") und `cancelled` (nichts gespeichert, mit Rückfrage).

- **Ja/Nein:**
  - alle 100 Wörter aus `vtest.json` und 12 der 30 Pseudowörter;
  - gemischt mit `mulberry32(hash32(day))`;
  - Knöpfe „Kenne ich" / „Kenne ich nicht", Tasten J/N bzw. 1/2.
  - Das ist die Wissensabfrage des Tests, keine Bewertung einer Wiederholung. Emrahs Regel „keine Selbstbewertung" gilt hier nicht.
- **Bedeutung:**
  - 2 „Ja"-Wörter je Band, höhere Bänder zuerst;
  - 4 Optionen in der Oberflächensprache (`de` bzw. `vtest-en.json`), Ablenker gleicher Wortart.
- **Aktiv:**
  - 1 Wort je Band;
  - Bedeutung in der Oberflächensprache, kinetische Lücke mit Buchstaben-Platzhaltern (A7) und erstem Buchstaben;
  - Prüfung mit `checkTyped`.

### 8.2 Rechnung (`score.ts`, dokumentiert in `docs/vtest.md`)
- Fehlalarmquote `f = fa/faN`. Band `k_b = max(0,(h_b−f)/(1−f))`, bei `f = 1` gilt `k_b = 0`.
- Bedeutungsquote `m' = (richtig+1)/(geprüft+2)`, ohne Probe `m' = 1`.
- `bands[b] = round2(k_b·m')`.
- `passive = round50(Σ 1000·bands[b])`.
- Streuung `SE = √Σ 1000²·x(1−x)/10`, damit `pLo/pHi = passive ∓ 1,64·SE` (auf 0–10.000 begrenzt).
- `aAcc = (richtig+1)/(n+2)`, `active = round50(passive·aAcc)`, `aLo/aHi` analog.
- Außerdem gespeichert: `mAcc`, `pseudoN = faN = 12`, `dur`.

### 8.3 Schreiben (`persist.ts`)

```ts
transform('app/profile', cur => cur.vtests?.some(v => v.t === r.t) ? null : { update: {
  vtests: [...vtests, {...r, v:'lx1'}].slice(-20),
  act: {[day]: {vtest: n+1}},
  minutes: {[day]: m + round(dur/60000)} } })
```

- Doppelt ausgeführt wirkt es wie einmal, weil nach `t` abgeglichen wird.
- Der Test ist **freiwillig**, nie Pflicht. „Dein Stand" empfiehlt ihn, wenn der letzte Test älter als 8 Wochen ist.

---

## 9. Einstellungen komplett (Paket F)

Aufbau von `SettingsSheet`:
- Sprache
- Darstellung
- **Lernen:** neue Wörter pro Tag 0/2/5/10 (vorhanden); **Tagesziel** 10/15/20/25/30/40 Min.
- **Sprachausgabe:** Stimme (Auswahl aus `listVoices('en')`, US zuerst, Knopf „Probe hören"); Tempo 0,8/0,9/1,0/1,1
- **Ton:** an/aus
- Datenexport (vorhanden)
- Quellen und Lizenzen
- Diagnose

**Speichern:** jede Änderung optimistisch über `app/actions.ts`, Muster `persist()` (`actions.ts:16-30`) mit Rückrollen und Hinweis.

**Neue Schemafelder:** `profileSchema.goalMin: num`, `sound: bool`.

**`platform/sound.ts`:**
- `playCue('correct'|'near'|'wrong'|'done')`.
- `AudioContext` nur, wenn vorhanden. `resume()` im ersten Tipp (iOS).
- Standard aus. Bei stummgeschaltetem iPhone ist nichts zu hören, das ist bekannt.
- Fehler gehen nach `logWarn`.

---

## 10. Oberfläche und Texte

### 10.1 DOM-Vertrag (Testkennungen)
- **Fortschritt:**
  - Reiter: `progress-tabs` · `tab-judge` · `tab-errors` · `tab-path` · `tab-history`
  - Urteil: `assess-cefr` (`data-cefr`) · `assess-trend` (`data-trend`) · `assess-stamp` · `assess-renew` (`data-ai`) · `assess-phase` (`data-ai-phase`) · `assess-stop`
  - Fertigkeiten: `dim` (`data-id`, `data-level`, `data-confidence`)
  - Stärken und Blocker: `strength` · `blocker` · `blocker-practice` (fehlt, wenn keine Route) · `focus`
  - Fehler: `radar-row` (`data-c`, `data-trend`)
  - Weg nach C1: `cando` (`data-id`, `data-status`) · `cando-self` · `vocab-goal`
  - Verlauf: `vtest-start` · `weekly` · `weekly-fact` · `history-chart` · `heatmap` · `measures`
- **Test:** `vtest` · `vt-word` · `vt-yes` · `vt-no` · `vt-choice` · `vt-result` (`data-passive`)
- **Einstellungen:** `set-goalmin` · `set-newperday` · `set-voice` · `set-voice-preview` · `set-rate` · `set-sound` · `diag-capacity` · `diag-profile-size`
- **Heute:** `reason` in jeder Planzeile (`data-why`)

### 10.2 Anmutung
- Eine große Zahl je Karte.
- Stufen als ruhige Pillen, Belastbarkeit als 1–3 Punkte mit Text (nie nur Farbe).
- Diagramme in SVG mit `role="img"`, `aria-label` und Tabellen-Alternative in `Disclosure`.
- Skelette statt Spinner.
- „Denkt nach …" während des Laufs, der alte Stand bleibt sichtbar.
- Englischer `fix` in `EnglishText` (antippbar).
- Zweck nur hinter dem Info-Symbol (A7).

### 10.3 Neue i18n-Schlüssel (Auswahl, DE | EN)

| Schlüssel | DE | EN |
|---|---|---|
| progJudge / progErrors / progPath / progHistory | Urteil / Fehler / Weg nach C1 / Verlauf | Judgment / Mistakes / Path to C1 / History |
| assessStamp | Stand vom {date} · erneuert sich automatisch | As of {date} · updates automatically |
| assessRenew | Neu einschätzen | Reassess now |
| assessThinking | Claude wertet {n} Antworten aus … | Claude is reviewing {n} answers … |
| assessBusyOther | Wird gerade auf einem anderen Gerät erstellt. | Being created on another device right now. |
| assessFailed | Die Einschätzung konnte nicht erneuert werden. | The assessment could not be updated. |
| assessLowerTier | Mit einem einfacheren Modell eingeschätzt. | Assessed with a simpler model. |
| trendUp / trendFlat / trendDown | steigend / stabil / fallend | rising / steady / falling |
| confThin / confFair / confGood | dünne Datenlage / brauchbare Datenlage / gute Datenlage | thin evidence / fair evidence / solid evidence |
| dimNoEvidence | Noch zu wenig Belege | Not enough evidence yet |
| blockerWhyC1 / blockerFix / practice | Warum das auf C1 auffällt / So geht es richtig / Üben | Why it stands out at C1 / How to get it right / Practice |
| focusNext | Fließt ab dem nächsten Tagesplan ein. | Shapes your next daily plan. |
| whyFocusRef | Claudes Fokus · {topic} | Claude's focus · {topic} |
| whyWeek | diese Woche schon {n}× dran | already done {n}× this week |
| balanceGoal | {min} von {goal} Min. | {min} of {goal} min |
| radarTitle | Fehler-Radar · letzte 30 Tage | Mistake radar · last 30 days |
| canDoCount | {level}: {done} von {total} | {level}: {done} of {total} |
| canDoSelf | Kann ich | I can do this |
| vgLine | Ziel C1: 8.000 Wörter · jetzt etwa {now} · in rund {weeks} Wochen | C1 goal: 8,000 words · now about {now} · in about {weeks} weeks |
| vtestStart | Wortschatztest starten · etwa 8 Min. | Start vocabulary test · about 8 min |
| vtestResult | Passiv etwa {p} Wörter ({lo}–{hi}), aktiv etwa {a} | Passive about {p} words ({lo}–{hi}), active about {a} |
| weeklyTitle | Was du diese Woche wirklich dazugelernt hast | What you really learned this week |
| setGoalMin / setSound / setVoice / setVoicePreview / setVoiceMissing | Tagesziel / Ton / Stimme / Probe hören / Auf diesem Gerät nicht verfügbar – beste US-Stimme wird genutzt | Daily goal / Sound / Voice / Preview / Not available on this device – using the best US voice |
| diagProfileSize | Profilgröße: {kb} KiB von 256 KiB | Profile size: {kb} KiB of 256 KiB |
| compactOffer | Ältere Jahre auslagern (nichts geht verloren) | Move older years to the archive (nothing is lost) |

---

## 11. Arbeitspakete (Dateien überschneiden sich nicht)

**S0: Vertragsstand (Lead allein, ein Commit):**
- Schema-Ergänzungen (§4.1, §6.2, §9, §12.3), `paths.ts`, `useDocLive`, `reads.ts`
- `WhyKey`- und `DutyId`-Typen, `assessment/types.ts`
- `gate.ts` mit `text-json`
- `registry.ts` (Kennungen vorgemerkt), Gerüst der i18n-Teile, DOM-Vertrag §10.1
- Signaturen aller neuen Domänenfunktionen als Typen
- Abgleich der Adapter mit den Formaten aus Phase 2–5

**Pakete danach:**

| Paket | Dateien | Schnittstelle nach außen |
|---|---|---|
| A: Einschätzung | `domain/assessment/*` ohne `types.ts`, `prompts/assess.ts`, `features/progress/assessRun.ts`, `platform/dev/canned/assess.ts`, Unit-Tests `assess*` | `useAssessRun`, `assessDue`, `readAssess`, `focusChannels` |
| B: Fortschritt-Logik | `domain/progress/{radar,cando,weekly,history,measures}.ts`, `domain/vocab/goal.ts`, `prompts/weeklyReport.ts`, `features/progress/weeklyRun.ts`, `platform/dev/canned/weekly.ts` | reine Funktionen aus §7 |
| C: Plan | `domain/plan/{channels,weights,buildPlan}.ts`, `features/today/{store,TodayScreen}.tsx` | `rankChannels`, `buildPlan`, `ensureDay` Schritt 5 |
| D: Fortschritt-UI | `features/progress/{ProgressScreen,*Tab,actionRoute}.tsx`, `ui/charts/*`, `ui/Tabs.tsx`, `OverviewScreen.tsx` | nutzt A und B |
| E: Wortschatztest | `domain/vtest/*`, `features/vtest/*`, `content/vtest-en.json`, `docs/vtest.md` | Route `vtest` |
| F: Einstellungen | `features/settings/{SettingsSheet,LearningSection,VoiceSection}.tsx`, `app/actions.ts`, `app/settings.ts`, `domain/progress/settings.ts`, `platform/{sound,speech}.ts` | `playCue`, `changeGoalMin` … |
| G: Tests und Testdaten | `scripts/generate-seed.mjs`, `tests/e2e/*`, `tests/support/*`, `platform/dev/memoryDb.ts`, `cannedReplies.ts` (nur Anmeldung) | §13 |
| INT (Lead) | `app/{App,nav}.tsx`, `i18n/{de,en}.ts` | Verdrahtung, Auslöser |

**Reihenfolge:**
1. S0
2. A, B, C, E, F, G parallel
3. D, sobald A und B bei den Unit-Tests grün sind
4. INT
5. Prüfer
   - learning-scientist: `assess@1`, `weekly-report@1`, Wortschatztest, Can-Do-Regeln, Gewichtung
   - data-guard: `app/assess`, `app/weekly`, `history`, `vtests`, `canDo`
   - ux-reviewer
   - platform-guard
6. Commit „Phase 6: Urteil"
7. Test-Artefakt, danach die Produktivadresse (A7)

**Nach jedem Paket laufen:** `npm run typecheck`, `npm test` mit den eigenen Unit-Tests, `npm run lint`.

---

## 12. Phase 7: Politur und Umzug

### P7-1 Leistung
- **Zuerst messen.** Marke `performance.mark('lx:status')`, sobald die Statuszeile echte Daten zeigt. Im E2E mit CPU-Drossel 4× (CDP `Emulation.setCPUThrottlingRate`, nur Chromium) und dem Großdatensatz `?fake=large`: 1.500 Vokabeln, 400 Radar-Ereignisse, Profil von 2 Jahren, zur Laufzeit aus dem Seed erzeugt und nicht eingecheckt.
- **Budgets:**
  - `lx:status` < 2.000 ms (Kap. 14)
  - kein `longtask` > 100 ms während 20 Tastenanschlägen in der Lücke
  - p95 des Bildabstands < 20 ms beim Buchstabenflug
  - `dist/index.html` < 8 MB (Warngrenze aus `check-platform.mjs:11`)
- **Maßnahmen:**
  - (a) **Stufenweise bereit:** Heute braucht nur `app/profile`, `app/schema` und `log/<heute>`, wenn ein Plan von heute existiert. `markLoaded` (`live.ts:44`) bekommt dafür `ready.core` neben `ready.all`.
  - (b) Große JSON-Dateien (`dict.json`, `us-ipa.json`) als `?raw` einbinden und erst beim ersten Antippen parsen.
  - (c) `useLive`-Selektoren schmal halten, Listen memoisieren, lange Listen fenstern.
  - (d) Die Diagnose liest die Dokumentzahl nicht mehr per Voll-Snapshot (`SettingsSheet.tsx:102`), sondern je Sammlung per `get()` nur mit Zählung, einmal je Öffnen.

### P7-2 Design-Durchgang
- **Bildschirmmatrix:** alle Bildschirme aus Kap. 6 × 3 Modi × 390/1440/2560 px × DE/EN.
- **Prüfung** gegen Kap. 8: Spezifität im Dunkelmodus, Kanalfarben nur auf Symbolen und Kanten, Tabellenziffern, 8-px-Raster, ≥ 44 px, sichtbarer Fokus, reduzierte Bewegung, Leerzustände, Skelette.
- **Prüfrunden:** ux-reviewer eine Runde und eine gezielte Nachprüfung (A2).

### P7-3 Profil-Wachstum
- **Messung** (`capacity/profileSize.ts`): UTF-8-Bytes von `app/profile`, Zuwachs der letzten 90 Tage, dazu die Prognose „reicht noch etwa N Jahre". Ebenso Dokumentzahl je Sammlung und Prognose gegen 5.000 (Warnung ab 4.000).
- **Plan** (`capacity/compact.ts`, rein): Jahre `Y ≤ laufendes Jahr − 2` aus `days`, `xpDays`, `minutes`, `act`, `pflicht` → `archive/profile-Y {v:1, year, days, xpDays, minutes, act, pflicht, from:'app/profile', t}`.
- **Ablauf** `writer.compact(path, plan)`:
  1. Alle Puffer leeren (`persist.flush`).
  2. `createIfMissing` je Archiv. Existiert ein Archiv, wird inhaltsgleich geprüft; weicht es ab → Abbruch.
  3. Archive frisch lesen und tief vergleichen.
  4. Frischer `get('app/profile')`. Erneut prüfen, dass jeder auszulagernde Schlüssel im Archiv gleich ist.
  5. `set(frisch ohne diese Schlüssel)`.
  6. Neu lesen und prüfen. Alles andere ist unverändert, und alles Entfernte liegt im Archiv.
  - Jeder Fehler vor Schritt 5 bricht ohne Schreiben am Profil ab.
- **Auslöser:** nur bei mindestens 160 KiB, nur in der Diagnose nach Trockenlauf-Bericht und Tipp auf „Auslagern", mit dem Hinweis „andere Geräte vorher schließen".
- **Lesen:** Die Sammlung `archive` wird abonniert (1 Abo). `streak.ts` und `history.ts` bekommen die zusammengeführten Maps über einen Adapter. Export und Snapshot enthalten `archive/*` automatisch (`paths.ts`).
- **Dazu:** `app/lookup` verdichten (`null`-Einträge entfernen, Phase 1 §1.2) über dasselbe `compact`, ohne Archiv, denn `null` ist schon „fehlt".

### P7-4 Abschlussprüfung
`docs/abnahme.md` ordnet jedem Kriterium aus Kap. 14 und Kap. 15 einen Test oder einen iPhone-Prüfpunkt zu. Dazu kommt `tests/e2e/acceptance.spec.ts`.

**Kap. 14:**
- Alle Module bedienbar: jede Route öffnet sich und wird einmal durchgespielt.
- Daten sichtbar: Anzahlen gleich dem Seed.
- Serie läuft weiter: Vergleich mit `legacyStreak` an 6 Zeitpunkten.
- Tagesauftrag unverändert: `daily/*` und `feed/*` bytegleich, `newWords` werden Karten.
- < 2 s: P7-1.
- Die Lücke fühlt sich nativ an: P7-1 und Buchstabenflug.
- Alle Modi und Sprachen: die Matrix.
- Keine Kosten: nichts wird extern geladen.

**Kap. 15 je Punkt:**
- Plan stabil über 20 Neuzeichnungen.
- Erledigtes ist kein Knopf.
- Extra zählt nicht zur Pflicht.
- Duplikat-Wächter: gleicher Text höchstens einmal je Bildschirm, Ausnahmen gelistet.
- Neue Wörter auch an Tagen mit Wiederholungen.
- ≥ 2 Abfragearten je Stufe.
- Eingabe in der Lücke.
- Sprachtest über **alle** gespeicherten KI-Texte (`assess`, `weekly`, `lookup`, `xEx`).
- Kontrast im Dunkelmodus.
- Chat springt nicht beim Hochscrollen.
- Wörter überall antippbar.
- Karten mit Ursprungssatz.
- Zeitmatrix statt nur heute.
- ESLint `no-empty`.
- Sprachausgabe in Stücken ≤ 150 Zeichen.
- Veröffentlichung nur nach Freigabe (Prozess).

**Ebenfalls abgeschlossen:** die Hinweise H3, H5, H6 und W1–W9 aus A7 („MVP produktiv"), jeder mit Test oder begründetem Vermerk.

### P7-5 Umzug
1. Test-Artefakt mit einer Kopie der Daten.
2. Drei-Satz-Bericht an Emrah.
3. Erst nach Emrahs ausdrücklichem OK auf `JLL8…` veröffentlichen, mit den Fähigkeiten `db`, `sample`, `downloads` und Vertrag 0.2.49.
4. Den Rückweg `1790259934-2c07` in CLAUDE.md als „abgelöst" vermerken.
5. Erst danach ist `compact` zugelassen, per Konstante im Build.

**Arbeitspakete Phase 7:**

| Paket | Dateien |
|---|---|
| P7-1 | `data/live.ts`, `app/App.tsx`, `domain/lexicon/*`, `tests/e2e/perf.spec.ts` |
| P7-2 | `styles/index.css`, `ui/*`, Korrekturen je Bildschirm (Befundliste) |
| P7-3 | `data/writer.ts`, `domain/capacity/*`, `domain/streak.ts`-Adapter, `features/settings/Diagnostics.tsx` |
| P7-4 | `tests/e2e/acceptance.spec.ts`, `docs/abnahme.md` |

Danach: qa-runner, alle vier Prüfer (A2-Grenzen), Commit „Phase 7: Politur und Umzug".

---

## 13. Tests

**Zeitmatrix für jeden Domänentest** (`tests/support/time.ts`):
- 20.09.2026 (Seed-Stichtag)
- 27.09. 00:30 und 04:30
- 25.10.2026 (Ende der Sommerzeit)
- 31.12.2026 / 01.01.2027 (2026-W53)

**Unit:**
- `assessEvidence`: ≤ 46 KB beim Großdatensatz; Kürzungsreihenfolge; beide Fehlerformen; fehlende Quellen.
- `assessValidate` (Kap. 12 „Einschätzungs-Validierung"):
  - das Beispiel gilt;
  - unbekannte Stufe, falsche Sprache, `fix` auf Deutsch, unbekannte Aktion und unbekannte `ev` werden abgelehnt;
  - Belastbarkeit wird begrenzt, `none` ergibt `level: null`;
  - genau 6 eindeutige Fertigkeiten.
- `assessDue`: alle Gründe, einmal je Tag, Sprachwechsel.
- `assessEnvelope`: Hülle, flache Altfelder bleiben, `data` vollständig inkl. `null`, `hist` ≤ 60, `t` des anderen Geräts gewinnt.
- `weights`:
  - jeder Faktor einzeln;
  - ohne Zufall: gleiche Eingabe, gleiches Ergebnis;
  - Budget passt, Wochenabzug wirkt, `why` ≤ 2;
  - der Plan bleibt über den Tag stabil;
  - der Zähler steigt mit jeder Pflichtaufgabe (Kap. 12);
  - drei Pflichten, Widerspruchstabelle.
- `radar`, `cando`, `weekly` (Wochengrenze 04:00, W53), `history` (einmal je Tag, ≤ 120, `lx:1`), `measures` (Verfallsformel).
- `vtestScore`: Formeln, `f = 1`, nur Ja, nur Nein; das Seed-Beispiel wird im Format reproduziert.
- `vtestMachine`: Abbruch speichert nichts.
- `vtestPersist`: doppelt ausgeführt wirkt einmal.
- `settings`: Normalisierung; Stimme fehlt → Rückfall.
- `sound`: ohne `AudioContext` kein Fehler.
- `prompts`: Kopfzeilen, Beispiele bestehen ihr Schema, Byte-Budget beim Maximaldatensatz.
- `langStored`: alle KI-Texte im Seed in ihrer `lang`.
- P7:
  - `compact`: Hin und zurück; Serie vorher = nachher an allen Zeitpunkten; Vereinigung aus Profil und Archiv = Original; Abbruch bei Abweichung; Abbruch unter der Schwelle; ungültiges Profil wird nie angefasst.
  - `profileSize`.

**E2E** gegen `dist/index.html`, 390/1440/2560, drei Modi, DE/EN:
- `progress.spec`:
  - vier Reiter ohne `undefined`/`NaN`/`{0}`, ohne Querscrollen;
  - „Neu einschätzen" mit fester Antwort;
  - zwei Seiten zugleich → genau 1 Aufruf (`control.sampleCalls`);
  - `rate_limited` → Hinweis und kein zweiter Aufruf;
  - `?fake=nosample` → Anzeige ohne Knopf;
  - `not_granted` → Knopf ausgeblendet;
  - „Üben" öffnet die Route bzw. fehlt ohne Route;
  - bei `lang` EN und gespeicherter Einschätzung auf DE genau ein neuer Lauf.
- `weighting.spec`: Gründe sichtbar; Neuladen ergibt denselben Plan; Uhr auf den nächsten Tag → der Fokus wirkt.
- `vtest.spec`: Durchlauf per Tastatur und Touch, `vtests` wird ergänzt, das Wortschatzziel aktualisiert.
- `settings.spec`: jede Einstellung bleibt nach dem Neuladen (`persist`); Rückrollen bei eingespeistem Schreibfehler; Probe hören (nachgebildete Sprachausgabe); Ton.
- axe auf allen neuen Bildschirmen.
- Plattform: Abo-Höchststand ≤ 32 über einen ganzen Durchlauf (Zähler in `memoryDb`).
- P7: `perf.spec`, `acceptance.spec`.

**Feste Antworten:** `assess@1` und `weekly-report@1` in DE/EN. `?fake=assessbad` (erste Antwort verletzt das Schema) und `zzjson` für `invalid_json`.

**Seed** (deterministisch): `assess.hist` (3), Radar zusätzlich mit Schreibkategorien, `log/*` für 14 Tage mit `ctx`, `profile.canDo` mit 2 `cefr`-Kennungen, kein `goalMin` (Standardfall).

---

## 14. Risiken und Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| Formate aus Phase 2–5 weichen ab | Adapter `sources.ts`, `channels.ts` und `actionRoute.ts`; tolerantes zod; Abgleich in S0; fehlende Quelle ergibt „dünn", nie einen Absturz |
| Die KI erfindet Stufen | Belegkennungen mit zod, Belastbarkeit durch den Code begrenzt, `level: null` ohne Belege, Prüfung durch learning-scientist |
| Prompt > 64 KiB | Budget von 46 KB für Belege, Prüfung vor dem Aufruf (`gate.ts:31`), Test mit Großdatensatz |
| `complex` dauert bis 2 Min. | App-Aufgabe, alter Stand bleibt sichtbar, Langsam-Hinweis bei 90 s, Stopp-Knopf |
| Zustimmungsdialog zur falschen Zeit | Auslöser nur nach Emrahs Handlung; nie beim Laden von Heute |
| Doppellauf auf zwei Geräten | `acquire` und `run.d`; beim Schreiben gewinnt `cur.t > startedAt` |
| `rate_limited` oder Nutzungslimit | kein Neuversuch, Pause im KI-Tor (`ai/status.ts`), nächster Lauf frühestens am nächsten Tag |
| Plan widerspricht sich nach neuer Einschätzung | Plan unveränderlich, `ref` im `why`, Hinweis „ab dem nächsten Tagesplan" |
| Profil > 256 KiB | Messung, Warnung ab 128 KiB, `compact` ab 160 KiB, Archiv vor `set`, Prüfung nach dem Schreiben |
| Verlorener Schreibvorgang bei `compact` (`set` ist last-writer-wins) | nur per Tipp, Puffer leer, Hinweis „andere Geräte schließen", sehr seltener Lauf (Jahre), zuerst archivieren |
| Rückweg zur alten App überschreibt `app/assess` samt `hist` | nur bis zur Abnahme relevant und in der Rückweg-Notiz vermerkt |
| Stimmen am iPhone anders | Name gespeichert, Rückfall auf die beste en-US-Stimme, Emrah prüft am Gerät |
| WebAudio am iPhone stumm | Standard aus, `resume` beim Tipp, rein zusätzlich |
| Wortschatztest auf EN ohne Bedeutungen | `vtest-en.json`, 100 Einträge, geprüft |
| Leistung am echten Gerät | Drosseltest in Chromium; Safari prüft Emrah (A7.4) |

---

## 15. Prüfliste gegen Kapitel 3

| Punkt | | Fundstelle |
|---|---|---|
| Eine `dist/index.html` ≤ 16 MB, alles eingebettet | ✓ | `scripts/check-platform.mjs:10-49`; Diagramme als SVG im Code, Klänge per Oszillator, keine Dateien (§9, §10.2) |
| Kein Server, kein Schlüssel, kein fremdes `fetch` | ✓ | `check-platform.mjs:25-39`; Phase 6/7 lädt nichts von außen |
| Zugriffe auf `db`/`sample`/`downloads` nur über `/src/platform`, kein `claude.use` außerhalb | ✓ | `eslint.config.js:38`; `lease` und `compact` im Schreibpfad `data/writer.ts`, der `getDb()` nutzt (`data/index.ts:10`) |
| `claude.use` = `null` → sofort rendern, später zuschalten, Hinweis | ✓ | `App.tsx:95` (`nodb`); ohne `sample`: Einschätzung nur lesend, Knopf fehlt (§13, `nosample`) |
| `sample` ohne Gedächtnis, ≤ 64 KiB | ✓ | `assess@1` bringt Belege, Regeln und Format selbst mit (§4.6); Budget `gate.ts:19,31`, Belege 46 KB |
| Fehlercodes, kein Timer, Wiederholung nur nach A6.3 | ✓ | `gate.ts:26,89,136-146`, `ai/errors.ts:11-16`; Einschätzung ohne Auto-Wiederholung (§4.5) |
| `onSnapshot` einmal je Abfrage, ≤ 64 | ✓ | `live.ts:73-133`; neuer `useDocLive` im `useEffect` mit Pfad als stabiler Abhängigkeit; Abo-Höchststand-Test ≤ 32 |
| Nur bei echter Änderung schreiben, eine Operation je Dokument, nicht aus Render/Snapshot/Timer, `update` nur auf Bestehendes | ✓ | `writer.ts:68-81,142-158`; alle neuen Schreibwege über `transform` mit `null` bei „nichts neu" (§4.1, §5.4, §6.2, §8.3). **Ausnahme `compact` mit `set`:** bewusst, bewacht, vom Vertrag gedeckt (`set` = ganzes Dokument) |
| 256 KiB je Dokument, 5.000 Dokumente | ✓ | `app/weekly` und `app/assess.hist` gedeckelt (26/60), kein Dokument je Ereignis; P7-3 Messung und Auslagerung |
| Lernfortschritt nur in `db`, `localStorage` in try/catch | ✓ | `platform/storage.ts:17-72`; nur der zuletzt offene Reiter lokal (E18) |
| Entwicklungs-Adapter ausgeschlossen, durch Test gesichert | ✓ | `check-platform.mjs:42-43`; neue feste Antworten unter `platform/dev/canned/*`, Marker-Liste wird um `assessbad` erweitert |
| Keine leeren `catch`, Fehler ins Diagnose-Protokoll | ✓ | `eslint.config.js:20`; neue Abläufe nutzen `logError`/`logWarn` |
| Kein Prompt-Text in Oberflächen-Dateien, Vorlagen versioniert mit zod | ✓ | `prompts/assess.ts`, `prompts/weeklyReport.ts`, `registry.ts` |
| Optimistisch mit Rückrollen, Skelette statt Spinner | ✓ | `app/actions.ts:16-30` für alle Einstellungen und Can-Do; Skelette in allen Reitern |
| Stack aus Kap. 3.2 | ✓ | XState für Wortschatztest (und Übungen), zustand für Einschätzungs- und Plan-Stores, Framer Motion, ts-fsrs, zod, `vite-plugin-singlefile` (`package.json:22-52`) |
| Offener Befund im Bestand | ✗ | `SettingsSheet.tsx:102` liest für die Dokumentzahl die ganze Datenbank bei jedem Öffnen der Diagnose. Das ist teuer und widerspricht dem Ziel „schont Kontingent und Leistung". Behoben in P7-1(d). |
