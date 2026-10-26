# Kartenqualität: nur feste Wendungen werden Karten (26.10.2026)

Anlass ist Emrahs Meldung zu Live v84. Der Wort-Trainer fragte „Welches englische Wort passt?“ mit dem Hinweis „adaptive Angriffsversuche“. Die erwartete Lösung war „adaptive attempts“. Üblich ist aber „adaptive attacks“, und „adaptive attempts“ ist keine feste Wendung. Die Ablenker (keep up with, digitalization, come to terms with) passten nicht zur Bauform der Lösung.

Branch `claude/umbau-card-quality`, Basis `claude/umbau-fokus`.

## 1. Ursache

1. **Routine „Tagesauftrag Lesen“ (`trig_01LxTDBs97GGemopdDnxgyXP`).**
   - Der Prompt verlangt bei `keyWords` „mindestens 2 mehrteilige Wendungen (Verb + Nomen, Adjektiv + Nomen, feste Wendungen …)“.
   - Er fordert nicht, dass die Gruppe eine feste Einheit ist, und verlangt keinen Beleg. So erfüllt jeder Satzausschnitt aus zwei Wörtern die Vorgabe, auch „adaptive attempts“.
   - Das Beispiel-JSON im Prompt zeigt selbst zwei freie Gruppen als `keyWords`: „adapt to unfamiliar hardware“ und „plausible trajectory“. Die Routine ahmt das nach.
2. **Routine „Tagesauftrag Kurse“ (`trig_01TMp36iPogaxiZpk5mHctpL`).**
   - Gleiches Muster: „mindestens 3 davon mehrteilig“, ohne Prüfung, ob die Gruppe fest ist.
   - Der Katalog-Wortschatz dort ist gut (grant access, flag a risk …). Die Gefahr liegt bei frei erfundenen Zusatz-Wendungen.
3. **App, Annahme (`src/modules/read/domain/accept.ts`).** Die Annahme zählt nur Leerzeichen (`keyWordsMultiMin` 2). Ob eine Gruppe fest ist, prüft sie nicht.
4. **App, Speichern.** `KeyWordsCard` (Leser „Wichtige Wendungen“) und das Wendungs-Popup speicherten jede Gruppe ungeprüft als Wendungs-Karte. Die deutsche Bedeutung stammte aus dem Artikel („adaptive Angriffsversuche“) und passte nicht zum englischen Text.
5. **App, Ablenker (`wordDistractors` in `src/domain/srs/exercise.ts`).** Die Ablenker wurden nur nach Kartenart, Wortart und Länge gewählt, nicht nach Bauform. Deshalb standen Phrasal Verbs und Einzelnomen neben einer Adjektiv-Nomen-Gruppe.

## 2. Audit (Prüffunktion `lexicalUnit`, nur Urteil, löscht nichts)

- Die Funktion steht in `src/domain/lexicon/unit.ts` und `unitKnown.ts`. Sie urteilt nur „ok“ oder „prüfen“ und gibt einen Grund an, bei bekannten Fällen auch einen Vorschlag (`better`).
- Als Wissen dienen alle belegten Gruppen aus den Inhalten (C1-Paket, Wortpartner, Kollokationen, Startvokabeln) und `src/content/lexicon/units.json` (260 Einheiten). Die Wortarten kommen aus Wörterbuch und Atlas.
- Audit-Test: `tests/unit/lexicalUnitAudit.test.ts`. Er prüft jede Quelle ohne ihre eigenen Einträge, damit sich kein Eintrag selbst belegt.

| Quelle | geprüft | „prüfen“ |
|---|---|---|
| c1/pack | 1430 | 2 |
| col/charge1 | 117 | 0 |
| nb (Kollokationen, Extras) | 65 | 0 |
| legacy (Vokabeln, Passagen, Feed, Wörterbuch) | 464 | 0 |
| seed/read-routine | 15 | 1 |
| seed/read-courses | 10 | 0 |
| seed/sample-data (Vokabeln, Lesen) | 103 | 1 |
| Testantworten und Testdaten Lesen | 6 | 0 |
| **gesamt** | **2210** | **4** |

Fälle mit „prüfen“:
- c1/pack „the recent delays“: allgemeines Adjektiv „recent“.
- c1/pack „a compelling case“: allgemeines Nomen „case“. Das ist eigentlich eine Kollokation (make a compelling case); der Lehrer soll entscheiden.
- seed/read-routine „adapt to unfamiliar hardware“: endet auf eine freie Gruppe. Diese Gruppe steht wörtlich im Beispiel-JSON der Routine.
- seed/sample-data read „adapt to unfamiliar hardware“: derselbe Fall.

Weitere **160 Gruppen** sind nur nach der Regel „ok“ und in keiner Quelle belegt. Darunter sind „plausible trajectory“, „sound confident“, „hesitate to share“ und „addresses the tension“. Sie sind nicht falsch markiert, sollen aber gegengelesen werden. Die ganze Liste erzeugt der Audit-Test.

Wie viele solche Karten in Emrahs echter Datenbank liegen, lässt sich hier nicht feststellen, weil die Cloud-Umgebung keinen Zugriff hat. Die Zahl steht nach dem Live-Gang unter Einstellungen › KI-Stichprobe in der Zeile „Ruhende Lesekarten“ und in der Datei „KI-Stichprobe“ (Feld `heldUnits`).

## 3. Was gebaut wurde

1. **Prüffunktion** `lexicalUnit` mit dem Urteil `ok`/`check`. Sie löscht nie etwas und ändert nichts.
2. **Sperre beim Speichern** (Leser „Wichtige Wendungen“ und Wendungs-Popup, `src/features/lookup/unitCheck.ts`):
   - Belegte oder nach der Regel plausible Gruppen werden normal gespeichert.
   - Bei „prüfen“ wird Claude gefragt (`lexical-unit-check@1`, quick), aber nur mit Zustimmung (KI-Tor) und innerhalb der Tagesbremse (Tutor-Budget). Bestätigt Claude die Einheit, wird die Karte gespeichert und bekommt `lu: {ok: true, by: 'claude'}`.
   - Sonst entsteht keine Karte. Die App zeigt „Keine feste Wendung, darum keine Karte.“, dazu, falls vorhanden, „Üblich ist: …“ und den Knopf „Nur „{Wort}“ speichern“. Die Einzelwort-Karte bekommt den Artikelsatz als Ursprungssatz. Gibt es keine gesicherte Bedeutung, entfällt der Knopf („gar nichts“).
   - Ohne Claude (keine Zustimmung, Bremse erreicht, Fehler) entscheidet die Regel. Fehler gehen über `logWarn`.
3. **Ruhende Lesekarten.** Bestehende Karten aus Artikel oder Leser (`origin.kind` read/course bzw. `src` read) mit freier Gruppe und ohne `lu.ok` werden **nicht gelöscht**. Sie ruhen (`held`) und werden nicht abgefragt (`src/domain/lexicon/unitHeld.ts`, `toTrainCard`).
4. **Anzeige für den Lehrer.** Unter Einstellungen › KI-Stichprobe stehen die Zeile „Ruhende Lesekarten (keine feste Wendung): n“ und eine aufklappbare Liste mit Wort, Bedeutung und „Üblich ist: …“. Der Knopf „Doch lernen“ ergänzt nur `lu: {ok: true, by: 'user', t}`; das geht über den einen Schreibweg `writer.transform`, alle anderen Felder bleiben. Die Datei „KI-Stichprobe“ enthält `heldUnits`.
5. **Ablenker nach Bauform.**
   - `phraseShape` erkennt die Bauformen Einzelwort (nach Wortart), Phrasal Verb, Verb-Gruppe, Adjektiv + Nomen, Nomen + Nomen, Präpositions-Gruppe und freie Gruppe.
   - `shapeScore` bevorzugt dieselbe Bauform und Wortzahl und bestraft den Wechsel zwischen Einzelwort und Gruppe.
   - Die Kartenart wiegt weiter mehr (8 statt 4), damit Wendungen weiter Wendungen als Ablenker bekommen.
   - Für „adaptive attacks“ sind die Ablenker jetzt Adjektiv-Nomen-Gruppen aus zwei Wörtern.
6. **Schema.** `vocab/*` liest `lu` tolerant (`loose`). Neue Karten speichern `lu` nur, wenn die Gruppe geprüft wurde.

## 4. Tests

- Unit `tests/unit/lexicalUnit.test.ts`: „adaptive attempts“ = prüfen mit dem Vorschlag „adaptive attacks“, „adaptive attacks“ = ok, „come to terms with“ = ok, dazu weitere Fälle.
- Unit `tests/unit/lexicalUnitAudit.test.ts`: das Audit oben.
- Unit `tests/unit/cardQuality.test.ts` (17 Tests): Bauformen, Ablenker, Ruhen, Freigabe, Speichern mit `lu`, Prompt-Schema, Claude ja/nein/Fehler, Einzelwort.
- E2E `tests/e2e/lesenReader.spec.ts`, Abschnitt „Kartenqualität“:
  - mit Claude: Hinweis, Vorschlag, Einzelwort speichern;
  - ohne Claude: die Regel entscheidet, kein Aufruf;
  - axe dunkel/hell, Knopf mindestens 44 px.
- E2E `tests/e2e/cardQuality.spec.ts` (5 Tests):
  - ruhende Karte in der KI-Stichprobe;
  - „Doch lernen“ ergänzt nur `lu`, die feste Wendung bleibt unberührt;
  - axe dunkel/hell × DE/EN.
- Läufe: typecheck und lint grün; `npm test` 373 Dateien, 6653 Tests grün; E2E grün in lesenReader (30), cardQuality (5), phraseTap, lesenKurse und sentenceBank (35), trainer, trainerModes und wordTutor (21).

## 5. Vorschlag für die Routinen (nur Vorschlag, die Hauptsitzung wendet ihn an)

Die Routinen wurden **nicht** geändert.

### 5.1 Tagesauftrag Lesen (`trig_01LxTDBs97GGemopdDnxgyXP`)

Den Absatz zu `keyWords` in Schritt 4 durch diesen Text ersetzen:

> `keyWords`: 3 bis 5, Ziel 5. Jede Wendung ist eine **feste Einheit**, die ein Muttersprachler so als Ganzes kennt und auch in anderen Texten verwenden würde: eine Kollokation (z. B. „raise concerns“, „weak link“), ein Phrasal Verb („roll out“), eine feste Wendung („hard to shut down“, „at face value“) oder ein Fachbegriff („supply chain“, „interest rate“). **Kein beliebiger Ausschnitt des Satzes.** Gegenbeispiel: „adaptive attempts“ ist keine Einheit, üblich ist „adaptive attacks“; „adapt to unfamiliar hardware“ ist eine freie Gruppe, die Einheit darin ist „adapt to“. Keine allgemeinen Nomen wie attempt, effort, way, thing, case, step mit einem frei gewählten Adjektiv. Prüfe jede Wendung mit der Frage: Würde ein Wörterbuch oder Kollokationswörterbuch sie so aufführen? Wenn du unsicher bist, nimm das **Einzelwort** (z. B. „adaptive“), nicht die Gruppe. Mindestens 2 mehrteilige Wendungen nur, wenn der Artikel so viele echte Einheiten enthält; sonst lieber Einzelwörter als erfundene Gruppen. Keine Wörter, die im Deutschen gleich aussehen und heißen (team, system, plan, manager). `w` steht **genau so** (Endungen erlaubt) in einem englischen Satz des Artikels, `de` = deutsche Bedeutung **der Wendung selbst** (höchstens 60 Zeichen, so wie sie im Wörterbuch stünde, nicht die Übersetzung des Satzausschnitts), `i` = `[Absatz, Satz]` des Satzes, in dem es steht, nullbasiert (`[0, 2]` = dritter Satz im ersten Absatz).

In Schritt 5 (Selbstprüfung) ergänzen:

> · jede mehrteilige `keyWords.w` ist eine feste Einheit (Kollokation, Phrasal Verb, feste Wendung, Fachbegriff), kein Satzausschnitt; im Zweifel durch das Einzelwort ersetzt

Im Beispiel-JSON tauschen, weil das Beispiel sonst selbst freie Gruppen vormacht:
- `{"w":"adapt to unfamiliar hardware","de":"sich an unbekannte Hardware anpassen","i":[1,3]}` → `{"w":"adapt to","de":"sich anpassen an","i":[1,3]}`
- `{"w":"plausible trajectory","de":"plausible Entwicklung","i":[2,3]}` → `{"w":"draw conclusions","de":"Schlüsse ziehen","i":[2,0]}` (Satz [2,0] lautet „It is worth reading the headline carefully before drawing conclusions.“; `w` steht dort gebeugt als „drawing conclusions“, Endungen sind erlaubt)

### 5.2 Tagesauftrag Kurse (`trig_01TMp36iPogaxiZpk5mHctpL`)

Im Abschnitt **Wendungen (`phrases`)** nach „mindestens 3 davon mehrteilig (…)“ ergänzen:

> Jede mehrteilige Wendung ist eine **feste Einheit** (Kollokation, Phrasal Verb, feste Wendung, Fachbegriff), die man so als Ganzes lernt und in anderen Gesprächen wiederverwenden kann, kein beliebiger Satzausschnitt. Gegenbeispiel: „adaptive attempts“ (üblich: „adaptive attacks“). Keine allgemeinen Nomen wie attempt, effort, way, thing, case, step mit frei gewähltem Adjektiv. Wenn du unsicher bist, ob eine Gruppe fest ist, nimm eine Wendung aus dem Katalog-Wortschatz der Lektion. `de` ist die Bedeutung der Wendung selbst, nicht die Übersetzung des Satzausschnitts.

In Schritt 6, Punkt 3 ergänzen:

> … mindestens 3 mehrteilig, **jede davon eine feste Einheit (kein Satzausschnitt)**.

### 5.3 Hinweis an die Hauptsitzung (App)

- `src/modules/read/domain/accept.ts` zählt bei `keyWordsMultiMin` nur Leerzeichen. Vorschlag: Gruppen mit `lexicalUnit(w).verdict === 'check'` nicht als „mehrteilig“ mitzählen und im Annahme-Bericht melden. Nicht ablehnen und nichts löschen.
  - Das ist in diesem Branch bewusst **nicht** gebaut. Die Annahme betrifft ganze Artikel, und eine Änderung dort sollte die Hauptsitzung zusammen mit dem neuen Routine-Text entscheiden.
- `meaningDistractors` (deutsche Bedeutungen als Antwort) ist noch ohne Bauform-Prüfung. Das war nicht Teil der Meldung.
- „adaptive“ steht weder im Wörterbuch noch im Atlas. Deshalb bietet die App bei „adaptive attempts“ kein Einzelwort an, sondern speichert gar nichts.

## 6. Zur Gegenlesung durch `english-teacher` (vor dem Test-Link)

1. `src/content/lexicon/units.json`: 260 feste Einheiten. Sind alle wirklich fest und üblich (US-Englisch)?
2. Die 4 Audit-Fälle mit „prüfen“ (Abschnitt 2), besonders „a compelling case“, und die 160 Gruppen, die nur nach der Regel ok sind (Ausgabe des Audit-Tests).
3. Prompt `src/prompts/lexicalUnitCheck.ts` (`lexical-unit-check@1`): Anweisung, Beispiele und Schema `{isUnit, better|null, why}`.
4. Testantworten `src/platform/dev/canned/cardQuality.ts`.
5. Neue Texte DE/EN:
   - `src/i18n/parts/lp3/cardQuality.de.ts` / `.en.ts` (`ttCq*`: Hinweis, „Üblich ist:“, Claude-Hinweis, Einzelwort-Knopf, ruhende Lesekarten, „Doch lernen“, Erfolg/Fehler);
   - `src/modules/read/i18n/rdReader.de.ts` / `.en.ts` (`rdrNotUnit`, `rdrNotUnitBetter`, `rdrNotUnitClaude`, `rdrSaveSingle`, `rdrSingleSaved`).
6. Vorschlagstexte für die Routinen (Abschnitt 5).
