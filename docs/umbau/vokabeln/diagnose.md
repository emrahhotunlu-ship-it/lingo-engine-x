# Vokabeln: Diagnose (V0, Phase 0)

Stand 31.10.2026 · Paket V0 · Zweig `claude/umbau-v0` · Grundlage: Code auf `claude/umbau-fokus` (Commit `9c53d04`), Emrahs Kennzahlen (`kennzahlen-echt.md`), 60-Tage-Simulation (`ausgangsmessung.md`).
Beantwortet werden die Fragen aus Abschnitt 2 von Emrahs Auftrag (`../auftraege/vokabel-umbau-emrah.md`). Jede Aussage über den Code hat eine Fundstelle `Datei:Zeile`.

## Kurzfassung in einem Absatz
Die App plant mit **FSRS** (ts-fsrs 5.4.2), Zielquote 90 %, Fuzz an, Lernschritte 1 Min. → 10 Min. Der Zustand hängt **an der Karte, nicht am Wort**: Es gibt **eine** Spur je Karte, keine zwei. Doppelte Karten desselben Worts werden nur innerhalb einer Runde getrennt. Das „Mehrmals am Tag“ entsteht an drei Stellen:
1. **Gewollte Wiedervorlagen in der Runde:** Tag 0 bringt 2–3 Abrufe, nach jedem Fehler kommt das Wort bis zu dreimal wieder.
2. **Wege, die den Plan umgehen:** Abend-Check, „Dieses Wort üben“, Wochen-Check, Pflicht nach einer Extra-Runde. Jeder dieser Wege benotet voll.
3. **Auswahl und Aufdecken mit Selbsturteil verändern FSRS.**

Das „wochenlang weg“ hat zwei Ursachen. Für sichere Wörter ist es der gewollte Abstand (Deckel 21 Tage). Bei Emrahs echten Daten kommt ein Rückstau dazu: 112 von 253 Wörtern sind überfällig. Er stammt überwiegend aus der Zeit vor den Rückstand-Regeln und vor Wort-Lernen 2. Einen Lastausgleich gibt es nicht. Der Verlauf ist auf 12 Antworten je Karte gekürzt.

---

## 1. Planer: welcher, wo, mit welchen Werten

| Frage | Befund | Fundstelle |
|---|---|---|
| Algorithmus | **FSRS** über `ts-fsrs` (kein SM-2). Bei der Umstellung wurden alte SM-2-ähnliche Werte (`S`, `D`, `due`) nach FSRS übertragen. | `src/domain/srs/scheduler.ts:1-16`, `src/domain/srs/legacyFsrs.ts`, `docs/fsrs-umrechnung.md` |
| Version | `ts-fsrs` **5.4.2**, in `package.json` mit `^5.4.2` (ein Sprung auf 6.x wäre bei `npm install` nicht möglich, ein Sprung innerhalb von 5.x schon) | `package.json:40`, `node_modules/ts-fsrs/package.json` |
| Parameter | `request_retention: 0.9`, `maximum_interval: 365`, `enable_fuzz: true`, `enable_short_term: true`, `learning_steps: ['1m','10m']`, `relearning_steps: ['10m']`, Standardgewichte (nie angepasst) | `scheduler.ts:9-16` |
| Eigene Eingriffe nach FSRS | (a) **Dämpfung**: Der Zuwachs an Stabilität wird je Eingabeform gewichtet. Auswahl 0,55, Stütze 0,8, frei 1, eigener Satz 1,1. (b) **Tag-0-Regel**: Am Einführungstag zählt „Leicht“ als „Gut“, und nur ein freier Abruf beendet die Lernphase. (c) **Abstands-Deckel** 1 / 3 / 7 / 21 Tage, bis freie Abrufe an späteren Tagen belegt sind. (d) **Werkstatt-Ruhe**: 2–3 Tage nach einem gelungenen Abruf. | `weight.ts:8-24`, `scheduler.ts:76-88`, `applyReview.ts:180-197`, `spacing.ts:23, 138`, `applyReview.ts:204-215` |
| Zielquote einstellbar? | nein (fest 0,9) | `scheduler.ts:10` |

## 2. Ursache des Klumpens

### 2.1 Geschwister-Karten (mehrere Sätze oder Spuren je Wort)
- **Sätze:** Die Sätze eines Worts sind **keine** eigenen Karten. Der Satz wechselt innerhalb derselben Karte (`rotate.ts:21, 72, 131`). Das ist richtig gebaut.
- **Spuren:** Es gibt **nur eine** FSRS-Spur je Karte (`scheduler.ts`, Feld `fsrs`). Die Spuren „Verstehen“ und „Benutzen“ aus dem Konzept §3.1 (`lm.r`) sind nicht gebaut.
- **Doppelte Karten desselben Worts** gibt es trotzdem, etwa „overcome“ und „to overcome“ oder ein Fund neben einer Paket-Karte. Sie werden nur **innerhalb einer Runde** auf eine reduziert (`claim` über das Stichwort, `queue.ts:272-281`). In der nächsten Runde desselben Tages kann die zweite Karte kommen. Eine Sperre über den Tag gibt es nicht (kein `bury`/Geschwister-Faktor, grep leer).

### 2.2 Lernschritte
- Lernschritte von ts-fsrs: 1 Min. → 10 Min., Neulernen 10 Min. (`scheduler.ts:14-15`).
- Dazu kommt die Verdrahtung der Runde:
  - Nach der Einführung folgt Abruf 1 **nach 3 Karten** (`flip.ts:159`, `session.ts:643-652`).
  - Nach einem gelungenen Abruf 1 folgt Abruf 2 **nach 8 Karten** (`flip.ts:157`).
  - Ein Wort im Lernzustand, das in ≤ 20 Min. fällig ist, kommt zurück, **höchstens dreimal je Runde** (`session.ts:115-116, 995-999`).
- **Was nach einem Fehler geschieht:** Nach einem Fehler kommt das Wort in derselben Runde 1–2 weitere Male. Das ist der größte Teil von Emrahs „mehrmals am Tag“: 195 von 258 Mehrfach-Tagen außerhalb des Einführungstags folgten einem Fehler (`kennzahlen-echt.md` §1).
- **Endet die Runde vorher:** Das Wort bleibt im Lernzustand. Am selben Tag schließt jede weitere Runde es als „heute beantwortet“ aus. Es kommt erst am nächsten Tag ganz vorn wieder (`queue.ts:88-93`).

### 2.3 Fuzz und Lastausgleich
- **Fuzz:** nur der eingebaute von ts-fsrs. Er hängt an der Karte und ist deshalb deterministisch.
- **Lastausgleich:** **keiner** (grep `load.?balanc` leer). Wörter, die am selben Tag mit ähnlicher Stabilität gelernt wurden, kommen gemeinsam wieder. In der Simulation zeigt das die 14-Tage-Vorschau: „20 · 8 · 14 · 18 · 17 · 3 · 3 · 4 …“ (`ausgangsmessung.md`).
- **Der Abstands-Deckel verstärkt die Gleichtaktung:** Er kürzt viele Wörter auf genau 1, 3, 7 oder 21 Tage (`spacing.ts:23`, `applyReview.ts:190-197`).

### 2.4 Tageswechsel
- 04:00 Uhr **Ortszeit des Geräts** (`date.ts:6, 12-18`). „Europe/Berlin“ steht nirgends im Code.
- Für Emrah in Deutschland ist das gleichwertig. Auf Reisen verschiebt sich der Lerntag, und ein Wort kann zweimal am selben „Berliner“ Tag kommen. Der Plan legt Europe/Berlin fest (Emrahs Auftrag 4.2).
- Der Tageswechsel ist **nicht** Ursache des Klumpens.

### 2.5 Bewertung
| Eingabe | Note | Wirkung auf FSRS | Fundstelle |
|---|---|---|---|
| Auswahl richtig | 3 (langsam 2) | **verändert FSRS**, Zuwachs × 0,55 | `domain/grade/index.ts:219`, `weight.ts:19` |
| Tippen richtig | 2/3/4 nach Zeit bis zum ersten Zeichen | voll | `domain/grade/index.ts:221-229` |
| Tippfehler / falsche Form („fast richtig“) | 2 | voll | `domain/grade/index.ts:236` |
| mit Tipp | höchstens 3 bzw. 2 | Zuwachs × 0,8 | `grade/index.ts:238-240`, `weight.ts:24` |
| falsch / „Weiß ich nicht“ | 1 | Neulernen | `grade/index.ts:235` |
| **Aufdecken (Anki-Modus)** | **Selbsturteil 1–4** | **voll**, Stufe bis 2 | `anki/FlipCard.tsx:118, 299-307`, `weight.ts:15`, `flip.ts:146-151` |
| **„Als richtig werten“** | **bucht sofort Note 3** | voll | `ExerciseView.tsx:650, 731-733` |
| Fehler am Wortpartner | nur Verlauf | keine | `applyReview.ts:376` |

Emrahs Frage „zählt Auswahl als voll richtig?“: **Nein, nicht voll, aber sie zählt** (55 % des Zuwachses). Emrahs Auftrag 4.3 verlangt: gar nicht. Dasselbe gilt für das Aufdecken mit Selbsturteil.

### 2.6 Limit für neue Wörter
| Weg | Regel | Fundstelle |
|---|---|---|
| Einstellung | 0 / 2 / 5 / 10, Standard 5 | `domain/progress/settings.ts:6, 18`, `queue.ts:17` |
| Tagesplan (Pflicht) | im Budget der Einheit (480 s bei 25 Min.): ohne Rückstand bis `capacityNew` (720-s-Budget, 140 s je Wort, 2–5), **ab 15 überfälligen nur 2**; das Budget wächst mit dem Rückstand bis +50 % | `unit/review.ts:19-62`, `unit/backlog.ts:13-55`, `features/today/store.ts:200-229` |
| Trainer-Runden | nur das feste Kontingent, Untergrenze 2 | `queue.ts:205-226`, `session.ts:501` |

Das Limit hängt also **im Tagesplan** von der Last ab, **im Trainer nicht**. Es zählt Sekunden-Schätzungen je Stufe (`cost.ts:9-19`), keine gemessenen Zeiten.

### 2.7 Wo Wörter **außerhalb** des Planers abgefragt werden
Alle benoteten Wege schreiben über einen einzigen Schreibweg (`features/vocab/persist.ts:20-42` → `reviewWrite`, `applyReview.ts:478-506`). **Eine Sperre „heute schon gesehen“ gibt es dort nicht.**

| Weg | benotet? | umgeht „einmal am Tag“? | Fundstelle |
|---|---|---|---|
| Tag-0-Abruf 1/2, Gestern-Check | ja | gewollte Lernschritte | `session.ts:296-305`, `spacing.ts:165-175` |
| „Nochmal“-Wiedervorlage nach Fehler | ja, jedes Mal FSRS neu | bis 3× je Runde | `session.ts:995-999` |
| **Abend-Check** (heute eingeführte Wörter frei tippen) | ja, voll | **ja**. Entscheidung 17 vom 27.10.2026 schafft ihn ab, im Code steht er noch | `hub/VocabHub.tsx:267-273`, `domain/srs/offers.ts:12-19` |
| **„Dieses Wort üben“** (Wortblatt) | ja, voll | **ja** (`only` umgeht `buildQueue` und `exclude`) | `list/WordSheet.tsx:149`, `session.ts:517-521` |
| **Wochen-Check** | ja, `ctx:'xtra'` | **ja** (Fällige von heute werden nur nach hinten gestellt) | `features/check/session.ts:187`, `domain/check/select.ts:14-15` |
| **Pflicht nach einer Extra-Runde** | ja | **ja**: Die Pflicht schließt nur `ctx:'rev'` aus | `session.ts:491, 522` |
| Extra-Runde „Alle fälligen“ | ja | nein (`exclude: answeredToday`) | `session.ts:492, 522` |
| Wort-Werkstatt | ja; bei Erfolg 2–3 Tage Ruhe | eigene Tagesgrenze (höchstens 2) | `session.ts:456-474`, `applyReview.ts:204-215` |
| Kontrast „Welches Wort passt?“ | nur Verlauf | – | `session.ts:935-956, 1004` |
| „Sag es“ ohne erkanntes Wort | nur Verlauf (`u: 1`) | – | `session.ts:959-979` |
| C1-Aufgaben mit Wortbelegen (`c1x`) | getippt: Note; Auswahl ≤ 3 und nur nicht fällige | nein (`card.last` heute → übersprungen) | `c1x/lexWrite.ts:56-80`, `domain/c1x/lexBook.ts:51-56` |
| Grammatik, Lesen, Drills, Tutor | schreiben **nicht** nach `vocab/*` | – | `progress/persist.ts:237`, `domain/tutor/policy.ts:117` |
| „Kenne ich“, „Morgen wieder“, „Von vorn“ | keine Note, ändern `due`/`fsrs` | – | `list/actions.ts:29-45`, `persist.ts:77` |

**Folgerung:**
- Der Planer selbst fragt außerhalb der Lernschritte nie zweimal ab. In der Simulation sind es 0 Fälle (`ausgangsmessung.md`).
- Emrahs **63 Mehrfach-Tage ohne vorherigen Fehler** kommen deshalb aus den vier fett markierten Wegen und aus Doppelkarten desselben Worts. Dazu gehören auch Lernschritte, die erst ein späterer Weg schloss, etwa Tag 0 und danach der Abend-Check.
- Die 195 Fälle nach einem Fehler sind Wiedervorlagen. Sie sind gewollt, dürfen aber nicht unbegrenzt benoten (Abschnitt 6 des Plans).

### 2.8 Warum „wochenlang weg“
- **In der Simulation** (heutiger Planer, Pflicht jeden Tag) bleiben Lücken über 14 Tage auf sichere Wörter beschränkt (ab Stufe 3, Deckel 21 Tage). Bei Wörtern bis Stufe 2 sind es 0. Der Rückstau bleibt klein: 2–15 überfällig am Ende. Das ist gewollter Abstand, kein Fehler.
- **In Emrahs echten Daten** sind 44 % überfällig, bei fast leerer 14-Tage-Vorschau (`kennzahlen-echt.md` §2). Das hat drei Gründe:
  1. **Ältere Regeln:** Bis 02.10.2026 gab es keine Rückstand-Bremse, bis 21.10.2026 kein Wort-Lernen 2. Der Großteil des Verlaufs stammt aus dieser Zeit.
  2. **Der Tagesplan holt Rückstand nur langsam auf.** Das Budget wächst bei Rückstand nur bis +50 % (`backlog.ts:13-28`). Was nicht in die Pflicht passt, wartet auf freiwillige Runden.
  3. **Aufdecken mit „Leicht“ trägt Wörter weit weg.** Es gab 331 Aufdeck-Antworten, und das Selbsturteil hat volle FSRS-Wirkung.

  [Folgerung, nicht gemessen: Wie groß jeder Anteil ist, zeigt erst der vollständige Verlauf, und den gibt es nicht (§3).]

## 3. Datenmodell (Wort, Satz, Karte, Verlauf)
| Teil | heute | Fundstelle |
|---|---|---|
| Wort | `vocab/<id>` = Wort **und** Karte zugleich: `word`, `pos`, `de`, `def`, `ex` (Ursprungssatz), `col` (Wortpartner), `xEx`/`wx` (weitere Sätze), `src`, `origin`, `intro`, `hidden` | `docs/datenmodell.md`, `domain/srs/cards.ts:79-120` |
| Wendung | `chunk/<id>` mit derselben Planung, eigene Patches | `applyReview.ts:73-97, 412-449` |
| Satz | kein eigenes Dokument; Sätze hängen am Wort (`ex`, `xEx`, `wx`, Satzbank) und werden je Abfrage gewechselt, mit Schlüssel `hist[].s` | `rotate.ts`, `applyReview.ts:268` |
| Gedächtnis | `fsrs` (`v`, `due`, `stability`, `difficulty`, `state`, `reps`, `lapses`, `last`, `scheduledDays`, `learningSteps`) und gespiegelt die alten Felder `S`, `D`, `due`, `stage` (1–5), `modes`, `xs`, `pa`/`ac`/`co` | `applyReview.ts:42-71` |
| **Verlauf je Karte** | `hist[]` mit `{t, m, g, x, s?, a?, u?, ci?, h?, v?, fk?, ms?, in?, …}`, **gekürzt auf 12 Einträge** (`HIST_MAX`) | `applyReview.ts:27, 268-292, 362` |
| **Verlauf je Tag** | `log/<Tag>.entries[]` mit `{t, ok, lang, k:'v', id, m:'tr-<art>', given, ans, g, ms, ctx, override?, dev?, …}`: **jede** benotete Antwort, gekappt nach Anzahl und Größe je Tag | `domain/progress/logPatch.ts:318-345`, `features/progress/persist.ts:140-144` |

**Gibt es einen Verlauf für eine Umrechnung?**
- Ja, aber nur teilweise. `hist` reicht für die letzten 12 Antworten je Karte.
- `log/<Tag>` hat alle Antworten seit dem Start der neuen App, mit Zeit, Übungsart (`m`), Note und Dauer. Es fehlen die Spur, die gezeigten Hinweise und die Satzkennung.
- V1 baut aus beiden Quellen je Lexem einen Verlauf und rechnet FSRS daraus neu (`ts-fsrs` kann einen Verlauf nachspielen). Wo der Verlauf fehlt, gilt der heutige `fsrs`-Stand.
- Ob `log/<Tag>` je Tag vollständig ist, prüft V1 im Trockenlauf. Es gibt eine Kappung je Tag (`mergeLogEntries`, `logPatch.ts:335`).

## 4. Übungsarten heute: Erkennen gegenüber aktivem Abrufen
Katalog `src/domain/srs/modes.ts:22-60`. Ausgemustert sind `spot`, `speed`, `fits` und `tiles` (außer bei Wendungen) (`modes.ts:76-80`).

| Stufe (heute 1–5) | Erkennen (Auswahl/Aufdecken) | aktiver Abruf (Tippen/Bilden) |
|---|---|---|
| 1 | `mc_en`, `ctx_mc`, `listen_mc` | – |
| 2 | `mc_de`, `match` | `cloze_hint` (Anfangsbuchstabe, auch Stufe 2) |
| 3 | `colloc_gap` | `cloze_hint`, `complete` (mit Satzanfang), `tiles` (nur Wendungen) |
| 4 | `find_trap` | `cloze`, `cloze_part`, `colloc`, `wordfam`, `type`, `situation`, `say_it` |
| 5 | – | `cloze` (neuer Satz), `produce`, `dictation`, `say_it` |
| außerhalb der Leiter | `flip` (Anki, Selbsturteil), `contrast` | `act_*` (Fahrplan A2–A5) |

**Anteile:**
- **Emrahs echte Daten** (alle Wochen): Erkennen 48 %, Tippen 20 %, Lücke 19 %, Wortpartner 9 %, Hören 3 %, **Bilden 1 %**.
- In KW 44 waren es noch 32 % Erkennen und 0 % Bilden (`kennzahlen-echt.md` §4). Den größten Erkennen-Anteil hat das Aufdecken (331 Antworten).
- **Simulation des heutigen Planers** im Modus „Automatisch“ ohne Aufdecken: Auswahl nur 7–9 % aller Abfragen, ab Stufe 3 sind 100 % getippt.
- **Der Planer im Automatik-Modus ist also schon überwiegend aktiv.** Die Passivität kommt aus dem Aufdecken (Anki), aus den Stufen 1–2 und aus der Zeit vor Wort-Lernen 2.
- **Bilden** (eigener Satz, „Sag es“, Aktivierung) kommt fast nie. „Eigener Satz“ kommt nur über den Fahrplan (`session.ts:276-285`), und der Fahrplan wird bei Rückstand gebremst (`fahrplan.ts`).

## 5. Abgleich mit dem, was schon geplant war
Quellen: `docs/umbau/wort-fest-plan.md` (Wort-Lernen 2, live seit 21.10.2026), `docs/relaunch/konzept.md` §3, `docs/relaunch/vokabeltrainer.md`, Entscheidungen 15–19 vom 27.10.2026, `docs/relaunch/stufe1c-plan.md` (D4, F1). **Bei Widerspruch gilt Emrahs neuer Auftrag.**

| Nr. | Plan-Punkt | gebaut? | Widerspruch zum neuen Auftrag → was gilt |
|---|---|---|---|
| P1 | Tag 0: Abruf A nach 3 Karten, B nach 8 Karten, kein „Leicht“ (wort-fest) | ja (`session.ts:296-305`, `spacing.ts:149-155`) | nein. Wird zu den Lernschritten des neuen Planers (M9). |
| P2 | Gestern-Check (wort-fest) | ja | nein. Bleibt als garantierter Abruf am Folgetag (M77). |
| P3 | Abstands-Deckel 1/3/7/21 (wort-fest) | ja (`applyReview.ts:190-197`) | nein. Bleibt, wirkt **vor** Fuzz und Lastausgleich (M77). |
| P4 | Wort-Werkstatt ab 2 Fehlern (wort-fest) | ja | nein. Bleibt neben der Leech-Regel (6 Fehler), W5. |
| P5 | Menge 0/2/5/10, Untergrenze 2 (wort-fest) | ja | **ja**, teilweise: Emrah will die Menge nach Lastbudget. → Kontingent ist Obergrenze, das Minutenbudget regelt darunter, mindestens 2 (Emrahs Antwort 5). |
| P6 | Abend-Check (wort-fest, „optional“) | ja (`VocabHub.tsx:273`) | **ja**: zweiter benoteter Abruf am selben Tag; Entscheidung 17 hat ihn schon abgeschafft. → Er bleibt als Funktion, aber **ohne Planwirkung** (Plan §5, Nr. 82). |
| P7 | Dämpfung: Auswahl 0,55 (wort-fest) | ja (`weight.ts:8`) | **ja**: Emrah 4.3 sagt „Auswahl nie volle Wiederholung“, W7 „nicht“. → Auswahl ändert FSRS gar nicht. |
| P8 | Zwei Spuren P/R, R in `lm.r` (Konzept §3.1) | nein | **ja** in der Form: Das Konzept hatte R als Nebenwert. → zwei vollwertige FSRS-Spuren (Emrah 4.1), Kopplung nach Synthese 2.1 Nr. 1. |
| P9 | Stufen S0–S5 (Konzept §3.2, F1) | teilweise (`types.ts:8`, Stufen 0–5) | **ja**: Emrah verlangt 7 Stufen. → 7 intern, 3 Gruppen sichtbar (Emrahs Antwort 3). |
| P10 | S1 „höchstens 4 Versuche, sonst morgen“ (§3.2) | nein (`MAX_SHOWN = 3`) | nein. Wird zur Lernschritt-Grenze (Plan §4.3). |
| P11 | Auswahl und Aufdecken ändern P nicht (§3.3) | **nein**, der Code widerspricht | nein. Wird jetzt gebaut. |
| P12 | Zeitbasis aus `fk`/`ms` (§3.3, S1-ZEIT) | nur gespeichert, nie ausgewertet (`applyReview.ts:273`) | nein. Wird ausgewertet (M39). |
| P13 | Trainer = derselbe Plan (vokabeltrainer §3.1.1) | ja, ein Schreibweg | nein |
| P14 | Vorgezogenes Üben wirkt „ein wenig“ (§3.1.2) | ja (FSRS rechnet R ein) | **ja**, teilweise: Es erlaubt beliebig viele benotete Wiederholungen. → höchstens einmal am Tag mit Planwirkung, der Rest ohne. |
| P15 | Aufstieg nur termingerecht ±10 % (§3.1.3) | nein, nur Tagesbremse (`applyReview.ts:239-242`) | nein. Aufstiegs-Tag nach Synthese 2.3. |
| P16 | Gestern-Check schützen, heute Eingeführtes ruht (§3.4) | **nein** (Abend-Check, `only`-Runde) | nein. Wird durch die Geschwister-Regel erfüllt. |
| P17 | Anki: E→D 4 Knöpfe nur für R, D→E 2 Knöpfe ohne Planwirkung (§3.6, Entscheidung 16) | **nein** (4 Knöpfe, volle Wirkung auf die einzige Spur) | **ja**, teilweise: Selbsturteil widerspricht 4.3, ist aber durch A7 erlaubt. → Anki wirkt nur auf die Spur Verstehen, nie auf Benutzen und nie auf den Aufstieg ab Stufe 3 (Frage F3). |
| P18 | Gesehen-Regel 30 Min. ohne FSRS-Wirkung (§3.6) | nein | nein. Geht in „ohne Planwirkung“ auf. |
| P19 | Neue im Trainer, gemeinsamer Deckel 5 (Entscheidung 15) | teilweise | **ja**: fester Deckel. → Lastbudget mit Kontingent als Obergrenze. |
| P20 | Entscheidung 17: Abend-Check fällt weg | nein | Wird ersetzt durch „bleibt ohne Planwirkung“, keine Funktion fällt weg (Entscheidung 30.10.). |
| P21 | Entscheidung 18: „Wörter üben“ auf Heute erst nach der Pflicht | nicht geprüft | nein. Bleibt (Heute-Schnittstelle, Plan §2). |
| P22 | Entscheidung 19: eigene Funde höchstens 1 je Tag in der Pflicht | nicht geprüft | **ja**, teilweise: Emrah 4.6 gewichtet eigene Funde. → Gewichtung statt starrer 1; **innerhalb** des Lastbudgets (V5). |
| P23 | D4 Wörter-Bildschirm: Filterchips, `recognizeCount` (stufe1c) | nein | nein. Geht in V4 auf (Wort-Liste, Dashboard). |
| P24 | F1 „Wörter neu“: S0–S5, zwei Spuren, Speichermodell `vs` (stufe1c) | nein (nur geplant) | **ja**: 6 statt 7 Stufen, `vs` statt `lx`. → F1 geht vollständig in V1–V4 auf. |
| P25 | „Als richtig werten“ (Override) bucht Note 3 | ja (`ExerciseView.tsx:650, 731`) | **ja**: Emrahs Antwort 2 → keine Note, Wiederkehr in neuem Satz. |
| P26 | Verlauf 12 Einträge (`HIST_MAX`) | ja | **ja**: Emrah 7 verlangt den vollständigen Verlauf. → Monats-Verlauf `vlog/` (Plan §3.4). |
| P27 | Transfer-Aufgabe am Ende | nein | neu (V4) |
| P28 | Tageswechsel Ortszeit des Geräts | ja (`date.ts:12`) | **ja**, klein: Emrah sagt Europe/Berlin. → V1 stellt `date.ts` **zentral** auf Europe/Berlin um, eine einzige Datumsquelle für Planer, Serie und Log (Plan §4.4). |

## 6. Was das für den Umbau heißt (Brücke zum Plan)
1. **Ein Planer, ein Tor:** Jeder Weg, der ein Wort zeigt, fragt den Planer. Nur der Planer entscheidet, ob eine Antwort **Planwirkung** hat. Das schließt die vier Umgehungen aus §2.7.
2. **Zwei Spuren je Lexem** statt einer Spur je Karte. Doppelte Karten desselben Worts werden nach Bestätigung zu einem Lexem zusammengeführt (strenge Regeln, Plan §9.2).
3. **Auswahl und Selbsturteil ohne FSRS-Wirkung**, außer im Anki-Modus auf der Spur Verstehen (F3).
4. **Lastausgleich in Minuten** zusätzlich zu Fuzz und Deckel. Die gemessene 14-Tage-Vorschau wird gleichmäßig.
5. **Vollständiger Verlauf** in Monatsdokumenten. Die Umrechnung nutzt `hist` und `log/<Tag>`.

## 7. Grenzen dieser Diagnose
- Die Simulation läuft den Planer im Modus „Automatisch“. Werkstatt, Fahrplan, Kontrast, Aufdecken, Abend-Check, Wochen-Check und Wendungen sind **nicht** simuliert (`scripts/vocab/adapter-current.ts:1-12`). Sie unterschätzt deshalb Mehrfachabfragen und Auswahl-Anteil gegenüber Emrahs echten Daten.
- Emrahs Kennzahlen stammen aus 12 Einträgen je Wort. Ältere Antworten fehlen (`kennzahlen-echt.md`, Vorbehalt).
- Die Zuordnung der echten Mehrfach-Tage ohne Fehler zu einzelnen Wegen ist eine **Folgerung** aus dem Code. Gemessen ist sie nicht: `ctx` und `m` im Tagesprotokoll würden das erlauben, das Auswerteskript des Überchats zählt sie aber nicht getrennt.
