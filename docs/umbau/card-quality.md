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

**Stand nach der Gegenlesung (26.10.2026, Zweig `claude/umbau-card-quality2`).** `units.json` hat jetzt 264 Einheiten und eine Lehrer-Sperrliste `free` mit 23 Gruppen (Abschnitt 7). Das Audit prüft 2206 Gruppen, davon 15 „prüfen“:

| Quelle | geprüft | „prüfen“ |
|---|---|---|
| c1/pack | 1430 | 1 („the recent delays“) |
| legacy/passages | 86 | 3 (satisfied peer, notorious pitfall, shape the rhythm) |
| legacy/feed-seed | 45 | 5 (we won't prejudge, a dose of accommodation, to streamline cross-border trade, leverage for investment, data quality is critical) |
| seed/read-routine | 13 | 0 |
| seed/read-courses | 10 | 3 (handle routine chores, low-risk tasks, name the constraints) |
| seed/sample-data read | 27 | 3 (dieselben drei aus den Kursen) |
| übrige Quellen | 595 | 0 |

Die vier früheren Artikel-Gruppen (plausible trajectory, adapt to unfamiliar hardware, hesitate to share, addresses the tension) gelten jetzt als „prüfen“; der Audit-Test hält das fest. Im Lese-Seed stehen sie nicht mehr (Abschnitt 7.3).

Wie viele solche Karten in Emrahs echter Datenbank liegen, lässt sich hier nicht feststellen, weil die Cloud-Umgebung keinen Zugriff hat. Die Zahl steht nach dem Live-Gang unter Einstellungen › KI-Stichprobe in der Zeile „Ruhende Lesekarten“ und in der Datei „KI-Stichprobe“ (Feld `heldUnits`).

## 3. Was gebaut wurde

1. **Prüffunktion** `lexicalUnit` mit dem Urteil `ok`/`check`. Sie löscht nie etwas und ändert nichts.
2. **Sperre beim Speichern** (Leser „Wichtige Wendungen“ und Wendungs-Popup, `src/features/lookup/unitCheck.ts`):
   - Belegte oder nach der Regel plausible Gruppen werden normal gespeichert.
   - Gruppen der Lehrer-Sperrliste (`units.json` → `free`) sind fest „prüfen“; Claude wird dafür nicht gefragt.
   - Bei sonstigem „prüfen“ wird Claude gefragt (`lexical-unit-check@1`, quick), aber nur mit Zustimmung (KI-Tor) und innerhalb der Tagesbremse (Tutor-Budget). Bestätigt Claude die Einheit, wird die Karte gespeichert und bekommt `lu: {ok: true, by: 'claude'}`.
   - Sonst entsteht keine Karte. Die App zeigt „Richtiges Englisch, aber keine feste Wendung. Darum keine Karte.“, dazu, falls vorhanden, „Feste Wendung dazu: …“ und den Knopf „Nur „{Wort}“ speichern“. Die Einzelwort-Karte bekommt den Artikelsatz als Ursprungssatz. Gibt es keine gesicherte Bedeutung, entfällt der Knopf („gar nichts“).
   - Ohne Claude (keine Zustimmung, Bremse erreicht, Fehler) entscheidet die Regel. Fehler gehen über `logWarn`.
3. **Ruhende Lesekarten.** Bestehende Karten aus Artikel oder Leser (`origin.kind` read/course bzw. `src` read) mit freier Gruppe und ohne `lu.ok` werden **nicht gelöscht**. Sie ruhen (`held`) und werden nicht abgefragt (`src/domain/lexicon/unitHeld.ts`, `toTrainCard`).
4. **Anzeige für den Lehrer.** Unter Einstellungen › KI-Stichprobe stehen die Zeile „Ruhende Lesekarten (keine feste Wendung): n“ und eine aufklappbare Liste mit Wort, Bedeutung und „Feste Wendung dazu: …“. Der Knopf „Doch lernen“ ergänzt nur `lu: {ok: true, by: 'user', t}`; das geht über den einen Schreibweg `writer.transform`, alle anderen Felder bleiben. Die Datei „KI-Stichprobe“ enthält `heldUnits`.
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

> `keyWords`: 3 bis 5, Ziel 5. Jede Wendung ist eine **feste Einheit**, die ein Muttersprachler als Ganzes kennt und in anderen Texten wieder verwendet. Wähle in dieser Reihenfolge: (1) Verb-Nomen-Kollokationen, die man im Geschäftsgespräch wiederverwenden kann („raise concerns“, „draw conclusions“, „mitigate a risk“); (2) Fachbegriffe zum Thema des Artikels („prompt injection“, „security update“, „recurring revenue“); (3) Phrasal Verbs und Verb + Präposition („roll out“, „adapt to“); (4) Redewendungen und Diskursmarker („at face value“, „in other words“). **Kein beliebiger Ausschnitt des Satzes.** Gegenbeispiele: „adaptive attempts“ (üblich: „adaptive attacks“), „adapt to unfamiliar hardware“ (Einheit: „adapt to“), „hard to shut down“ (Einheit: „shut down“). Ein allgemeines Nomen (attempt, effort, way, thing, case, step) mit einem frei gewählten Adjektiv ist keine Einheit, außer die Verbindung steht so im Kollokationswörterbuch („concerted effort“, „next step“). Prüfe jede Wendung: Würde Oxford Collocations oder ein Wörterbuch sie so aufführen? Im Zweifel nimm das **Einzelwort**, aber nur, wenn es auf C1-Niveau lohnt. Mindestens 2 mehrteilige Wendungen nur, wenn der Artikel so viele echte Einheiten hat. Keine Wörter, die im Deutschen gleich aussehen und dasselbe heißen (team, system, plan, manager). `w` steht **genau so** (Endungen erlaubt) in einem englischen Satz des Artikels. `de` ist die deutsche Bedeutung **der Wendung selbst** in der Grundform (Infinitiv, Einzahl, höchstens 60 Zeichen, wie im Wörterbuch), nicht die Übersetzung des Satzausschnitts. `i` = `[Absatz, Satz]`, nullbasiert.

(Text der Gegenlesung, wörtlich. So steht er auch in `docs/umbau/lesen-routine.md`.)

In Schritt 5 (Selbstprüfung) ergänzen:

> · jede mehrteilige `keyWords.w` ist eine feste Einheit (Kollokation, Phrasal Verb, feste Wendung, Fachbegriff), kein Satzausschnitt, im Zweifel durch das Einzelwort ersetzt; `de` passt zur Grundform, nicht zum Satz

Im Beispiel-JSON **alle fünf** Einträge tauschen (vier der fünf alten waren freie Gruppen):

```
{"w":"shut down","de":"abschalten, stilllegen","i":[0,5]}
{"w":"adapt to","de":"sich anpassen an","i":[1,3]}
{"w":"draw conclusions","de":"Schlüsse ziehen","i":[2,0]}
{"w":"weak link","de":"Schwachstelle, schwaches Glied","i":[3,1]}
{"w":"security updates","de":"Sicherheitsupdate","i":[3,4]}
```

Dazu Satz [2,0] ändern: „It is worth reading the headline carefully before **you draw** conclusions.“ (statt „before drawing conclusions“). Grund: Die App erlaubt nur Endungen am Ende der Wendung; „draw conclusions“ steht in „drawing conclusions“ nicht wörtlich und würde verworfen. In `docs/umbau/lesen-routine.md` und `seed/read-routine.json` ist das schon so; der Test `routine.test.ts` prüft das Beispiel gegen den echten Prüfer der App (nichts verworfen, jede Wendung eine feste Einheit).

### 5.2 Tagesauftrag Kurse (`trig_01TMp36iPogaxiZpk5mHctpL`)

Im Abschnitt **Wendungen (`phrases`)** nach „mindestens 3 davon mehrteilig (…)“ ergänzen:

> Jede mehrteilige Wendung ist eine **feste Einheit** (Kollokation, Phrasal Verb, feste Wendung, Fachbegriff), die man so als Ganzes lernt und in anderen Gesprächen wiederverwenden kann, kein beliebiger Satzausschnitt. Gegenbeispiel: „adaptive attempts“ (üblich: „adaptive attacks“). Keine allgemeinen Nomen wie attempt, effort, way, thing, case, step mit frei gewähltem Adjektiv, außer die Verbindung steht so im Kollokationswörterbuch („concerted effort“, „next step“, „make a case for“). Wenn du unsicher bist, ob eine Gruppe fest ist, nimm eine Wendung aus dem Katalog-Wortschatz der Lektion. `de` ist die Bedeutung der Wendung selbst, nicht die Übersetzung des Satzausschnitts.

In Schritt 6, Punkt 3 ergänzen:

> … mindestens 3 mehrteilig, **jede davon eine feste Einheit (kein Satzausschnitt)**.

### 5.3 Hinweis an die Hauptsitzung (App)

- **Gebaut (Zweig `claude/umbau-card-quality2`):** `src/modules/read/domain/accept.ts` zählt Gruppen mit `lexicalUnit(w).verdict === 'check'` nicht als „mehrteilig“ und meldet sie im Annahme-Bericht (`notSetPhrase`). Abgelehnt oder gelöscht wird deswegen nichts: Routine und Kurse prüfen nachsichtig. Nur beim eigenen Artikel-Auftrag der App kann die Meldung den einen schon vorhandenen Neuversuch auslösen; die Meldung nennt dann die freien Gruppen.
- **Achtung Kurs-Routine:** Der K1-Katalog (`src/modules/read/domain/courses.ts`, Lektion 2) nennt „name the constraints“ im Wortschatz, und das Beispiel der Kurs-Anweisung (= `seed/read-courses.json`) enthält „handle routine chores“ und „low-risk tasks“. Alle drei stehen jetzt auf der Sperrliste. Beim nächsten Überarbeiten der Kurs-Routine diese Beispiele tauschen (Seed, E2E `lesenKurse` und die Routine zusammen).
- `meaningDistractors` (deutsche Bedeutungen als Antwort) ist noch ohne Bauform-Prüfung. Das war nicht Teil der Meldung.
- „adaptive“ steht weder im Wörterbuch noch im Atlas. Deshalb bietet die App bei „adaptive attempts“ kein Einzelwort an, sondern speichert gar nichts.

## 6. Gegenlesung durch `english-teacher` (26.10.2026)

Urteil: Freigabe nach drei Pflichtkorrekturen, alle umgesetzt (Abschnitt 7). Gelobt: Bauform-Ablenker, Sperre ohne Löschen, „Doch lernen“.

## 7. Umsetzung der Gegenlesung (Zweig `claude/umbau-card-quality2`)

### 7.1 Pflicht
1. **`units.json`:** gestrichen „spread on their own“, „hard to shut down“, „false sense of progress“, „company-wide rollout“, „different approach“. Geändert: „a growing number of“, „codebase“, „cost-cutting“, „make a case for“ (+ „make the case for“). Ergänzt (optional, aus Emrahs Beruf): customer lifetime value, retention policy, single sign-on, renewal rate, net revenue retention, upsell opportunity, document management system, data residency. Neu ist die **Lehrer-Sperrliste** `free`: Wortgruppen, die keine feste Einheit sind, mit der Einheit darin bzw. der üblichen Fassung (`better`). Sie überstimmt jede Regel und jeden Beleg; Claude wird dafür nicht gefragt. Wörtlich belegte Einheiten bekommen keine abgeleitete Grundform mehr („a growing number of“ bleibt so).
2. **Routine-Text** (`docs/umbau/lesen-routine.md`): Absatz zu `keyWords` und Selbstprüfung wie in 5.1, alle fünf Beispiel-Einträge getauscht, Satz [2,0] angepasst.
3. **Texte:** DE „Richtiges Englisch, aber keine feste Wendung. Darum keine Karte.“ / EN “Correct English, but not a set phrase, so no card.”; Vorschlag „Feste Wendung dazu:“ / “Related set phrase:”; EN-Feinschliff “Claude’s assessment; it may be wrong.”, “Paused reading cards (not a set phrase): {n}”, “Paused reading cards”, “Back in practice”, “Not saved. Please try again.” und der Hinweistext zu ruhenden Karten.

### 7.2 Prompt
`lexical-unit-check@1` (Version bleibt 1): die Regeln der Gegenlesung wörtlich (Wörterbuchform ohne Beugung/Artikel/Possessiv; Einheitstypen inkl. Diskursmarker, Satzrahmen und Branchenjargon; `better` darf die feste Einheit in der Gruppe sein, Wörterbuchform, Mehrzahl nur bei Plural-Einheiten; `why` nennt richtiges Englisch nie „falsch“). Beispiel jetzt `"better":"adaptive attack"`. Die Testantwort folgt dem.

### 7.3 Inhaltsquellen (Sperr- und Korrekturliste)
Geändert (Beispieldaten und Testantworten, kein Inhalt der Live-App):
- `seed/read-routine.json`: Artikel 1 wie das Beispiel der Anleitung; Artikel 2 „hesitate to share“ → „hesitate to“, „addresses the tension“ → „tension“, „false sense of progress“ → „counterargument“; Artikel 3 „sound confident“ → „by hand“, „company-wide rollout“ → „use cases“.
- `scripts/generate-seed.mjs` (Lesetage in `seed/sample-data.json`, neu erzeugt): dieselben Tausche, dazu „scheduling another meeting“ → „respond to“, „keeps the discussion focused“ → „at once“. Die Sätze bleiben gleich.
- `src/platform/dev/canned/readArticle.ts`: „committed base volume“ → „volume commitment“ (Satz angepasst).

Bewusst **nicht** geändert (mit Grund):
- `src/content/legacy/passages.json` und `feed-seed.json`: Das sind die unverändert gesicherten Inhalte der alten App (README dort). Sie dienen nur noch Beispieldaten und Tests; Emrahs echte Beiträge liegen in seiner Datenbank. Die Sperrliste wirkt trotzdem: Wer dort eine gesperrte Gruppe als Lesekarte speichern will, bekommt keine Karte. Offen bleiben die Grundform-Korrekturen (get the work back on track, move the work forward, lend it credibility, putting the problem on the table, that buys us, well above the target, near real-time reporting, to completely overhaul, navigate this minefield, changed the game, the usual suspect, human judgement) und die Sperr-Gruppen aus Feed und Passagen.
- `seed/read-courses.json`: Das ist zugleich das Beispiel der Kurs-Routine (siehe 5.3) und die Grundlage der E2E-Tests `lesenKurse`. Erst mit der Routine zusammen tauschen.
- „to decline to commit to“ (Feed): nicht auf die Sperrliste gesetzt. Die Wendung kann als Karte in Emrahs Live-Daten liegen; eine Sperre würde sie ruhen lassen. Entscheidung durch Emrah bzw. die Hauptsitzung.
