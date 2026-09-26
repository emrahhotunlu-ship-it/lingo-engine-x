# Analyse der Vorgänger-App („Sprachwerkstatt")

Stand: 26.09.2026, Phase 0. Quelle: Seitenquelltext der veröffentlichten Artefakte in Emrahs claude.ai-Konto, **nur gelesen**. Es wurden keine Datenbankinhalte gelesen und kein Code übernommen. Dieses Dokument hält nur fest, **was die gespeicherten Daten bedeuten**, damit die neue App sie verlustfrei weiterführt (Kap. 9).

## 1. Welche App ist die Vorgänger-App?

| Artefakt (Titel, Stand) | Befund | Rolle |
|---|---|---|
| Sprachwerkstatt, 24.09., per Link geteilt (ID beginnt mit `JLL8`) | 1,6 MB, Vertrag **0.2.49**, `db` + `sample`; Pfade decken sich mit Anhang B | **Die laufende alte App**. Ihre Adresse ist das Umzugsziel in Phase 7. |
| Sprachwerkstatt, 26.09., privat (ID beginnt mit `Czg`) | Vite-Bundle (Preact, zod, ts-fsrs, PixiJS), Vertrag 0.2.58, **eigene Datenbank mit anderem Schema** | Früherer Neubau-Versuch. Er wird nicht angefasst. Ob Daten daraus übernommen werden, steht in CLAUDE.md A7. |
| Sprachwerkstatt, 24.09. (ID beginnt mit `SjW`) | ältere Version ohne Fähigkeiten, speichert nur lokal | Test-Kopie ohne Daten |
| Exec English, Design | UI-Prototyp bzw. leere Designfläche | ohne Bedeutung für die Daten |

Alles Folgende beschreibt die laufende alte App.

## 2. Lehrplan (in der alten App fest im Code, also Daten, die übernommen werden müssen)

Es gibt 6 Einheiten mit je 4 Lektionen. Jede Lektion hat die Felder `{id, unit, grammar, level, de, en, cando_de, cando_en, situation, words:[[en,de]×6]}`. Die Schritte sind Wörter → Dialog → Grammatik → Produktion (4/4/5/4 Min.). Der Inhalt wird einmal per KI erzeugt und in `lesson/<id>` gespeichert.

Die Einheiten:
- u1 „Im Meeting bestehen" (Beruf)
- u2 „Kunden & Verhandlung" (Beruf)
- u3 „Reisen & Small Talk" (Alltag)
- u4 „Software erklären" (Beruf)
- u5 „Meinung & Diskussion" (Alltag)
- u6 „Auf C1-Niveau verhandeln" (Beruf)

| id | Einheit | Grammatik | Niveau | Titel (EN) |
|---|---|---|---|---|
| l01 | u1 | pres-perf-cont | B2 | Opening and running a meeting |
| l02 | u1 | past-simple-perfect | B2 | Reporting on project status |
| l03 | u1 | modals-deduction | B2 | Interrupting and probing politely |
| l04 | u1 | reported | B2 | Passing on results |
| l05 | u2 | conditionals | B2 | Justifying an offer |
| l06 | u2 | gerund-inf | B2 | Handling objections |
| l07 | u2 | passive | B2 | Processes and responsibilities |
| l08 | u2 | mixed-cond | B2+ | Renegotiating and regretting |
| l09 | u3 | future-forms | B1+ | Planning travel and appointments |
| l10 | u3 | past-simple-perfect | B2 | Telling an anecdote |
| l11 | u3 | relative | B1+ | Describing people and places |
| l12 | u3 | articles | B1+ | Talking about habits |
| l13 | u4 | passive | B2 | How the system works |
| l14 | u4 | relative | B2 | Describing features precisely |
| l15 | u4 | prepositions | B2 | Numbers and trends |
| l16 | u4 | future-perf-cont | B2 | Timelines and commitments |
| l17 | u5 | modals-deduction | B2 | Speculating and assessing |
| l18 | u5 | conditionals | B2 | Disagreeing without friction |
| l19 | u5 | pres-perf-cont | B2 | Describing developments |
| l20 | u5 | reported | B2+ | Passing on criticism |
| l21 | u6 | mixed-cond | B2+ | Hypotheses and regret |
| l22 | u6 | passive | B2+ | Diplomatic distance |
| l23 | u6 | future-perf-cont | B2+ | Making firm commitments |
| l24 | u6 | gerund-inf | B2+ | Closing the deal |

Beim Datenmodell (Phase 0) werden Can-Do-Ziele, Situationen und die sechs Zielwörter je Lektion vollständig aus der alten App als Daten übernommen. Die Quelle lässt sich jederzeit über das Artefakt-Werkzeug erneut lesen.

## 3. Grammatikthemen (16 Kennungen mit Start-Beherrschung p0)

| id | Name | p0 |
|---|---|---|
| pres-simple-cont | Present Simple vs. Continuous | .60 |
| past-simple-perfect | Past Simple vs. Present Perfect | .60 |
| pres-perf-cont | Present Perfect Continuous | .40 |
| past-perfect | Past Perfect | .40 |
| future-forms | Future forms | .60 |
| future-perf-cont | Future Continuous & Future Perfect | .35 |
| used-to | used to / would / be used to | .40 |
| conditionals | Conditionals (0–3) | .45 |
| mixed-cond | Mixed Conditionals & wish | .30 |
| passive | Passive | .45 |
| reported | Reported speech | .40 |
| relative | Relative clauses | .55 |
| modals-deduction | Modals of deduction | .35 |
| gerund-inf | Gerund vs. infinitive | .40 |
| prepositions | Prepositions & collocations | .45 |
| articles | Articles | .55 |

Die Gruppen heißen Zeiten, Satzstrukturen, Verbformen und Präpositionen & Artikel.

## 4. Feldbedeutungen

### `vocab/<id>` (id = Slug des Wortes)
Das Modell ist **FSRS-ähnlich, aber kein echtes FSRS**. Es nutzt die Vergessenskurve `R = (1 + t/(9·S))^-1`.
- `S`: Stabilität in **Tagen**, höchstens 365. `D`: Schwierigkeit von 1 bis 10, Start bei 5.
- `due`, `last`: Zeitpunkte in **Epoch-Millisekunden**. Es gilt `due = now + S·Tag·(0,9–1,1)`, also eine feste Behaltensrate von etwa 90 %.
- Noten 1–4 bedeuten Nochmal/Schwer/Gut/Leicht.
- Neue Karte bei Note ≥ 3: `S = [0, .25, 1, 2.5, 6][g] × modeBonus`.
- Fehler (Lapse): `S × 0,3` (mindestens 0,15), dazu `lapses + 1`.
- Erfolg: S wächst um `e^1.6·(11−D)/10·S^−0.15·(e^{3(1−R)}−1+0,35)·Bonus`, bei „Schwer" mal 0,5, bei „Leicht" mal 1,4.
- `modeBonus`: recog .55 · cloze .8 · listen .95 · type 1.1 · produce 1.25 · colloc .7.
- `state`: new, learning oder review. `reps`: Anzahl Wiederholungen.
- `stage`: Leiter 0–5 (Neu, Erkennen, Zuordnen, Mit Hilfe, Frei abrufen, Anwenden).
- `pa`, `ac`, `co`: passive, aktive und Kollokations-Fertigkeit von 0 bis 1 (gleitender Mittelwert).
- `modes`: `{modus: {c, w}}` mit richtigen und falschen Antworten je Abfrageart.
- `hist`: die letzten 12 Wiederholungen als `{t, m, g}`.
- `intro`: lokales Datum der ersten Wiederholung.
- `order`: Reihenfolge im Startwortschatz, sonst 900.
- `src`: eines von seed, user, coach, ai, job, lesson, claude, preply, read, write, listen, translate, lookup.
- `col`: Kollokationen als `[{p, de, gap, opts[], ex}]`. Dazu kommen `colN`, `added`, `lesson`.
- `hidden: true` ist ein **weiches Löschen**. Ab 4 Fehlern gilt eine Karte als Blutegel (Leech).

### `grammar/<topicId>`
- `p`: Beherrschung (Bayes-Schätzung) zwischen .02 und .99. In der Anzeige verfällt sie mit `exp(−Tage/45)` Richtung p0. Eine Antwort bewegt p um höchstens ±.06, ein Tag um höchstens ±.12.
- `anchor` / `anchorD`: Wert von p zu Tagesbeginn und das zugehörige Datum.
- `n` / `c`: Antworten / davon richtig.
- `last`: Zeitpunkt in ms. `recent`: die letzten 10 Ergebnisse als 1/0.
- `due` in ms: `now + (richtig ? clamp(round(1+18p²), 1, 21) : 1)` Tage.
- `hist`: `[{d, p}]`, höchstens 40 Einträge.
- `seen`: höchstens 80 Aufgaben-Schlüssel. `seenText`: höchstens 20 Aufgabentexte.
- `errors`: höchstens 10 Einträge `{q, given, ans, t, src?, box, due, done, last}`. Wiederholung nach 1, 3 und 9 Tagen. Bei `box = 3` ist der Fehler erledigt. Eine falsche Antwort setzt box auf 0 und due auf +1 Tag.

### `app/profile`
- `days[datum]`: Antworten pro Tag, wird **nie gekürzt**.
- `xpDays[datum]`: XP pro Tag. `minutes[datum]`: Minuten pro Tag.
- `act[datum][aktivität]`: Zähler je Aktivität. Ein angehängtes `~` bedeutet „begonnen, nicht beendet". `xpDays` und `act` werden auf 400 Tage gekürzt.
- Aktivitätsschlüssel: lesson, review, vocab, gram, session, cards, read, listen, shadow, write, sprint, vtest, speak, discover, chunks, preply, dictate, cloze, order.
- `history[]`: höchstens 120 Tagesbilder `{d, o, vo, gr, co, re, li, wr, fl, vs}`.
- `ema.{recog, write, listen, colloc, all}`: gleitende Trefferquote mit α = .12. `n.{…}`: Anzahl je Kanal.
- `plan {d, ids, why}`: siehe Abschnitt 6.
- `goal`: XP-Tagesziel (Standard 150), wird nur für die Heatmap genutzt.
- `newPerDay`: 0, 2, 5 oder 10 (Standard 5).
- `rate`: **Sprechtempo der Sprachausgabe** von .8 bis 1.1, keine Behaltensrate.
- `theme {m: auto|light|dim|dark, p: sage|ocean|plum|graphite}`. `lang`: de oder en. `voice`: Name der Stimme.
- `gen.{lp, wp, ar}`: Datum der letzten automatischen Erzeugung von Hörtext, Schreibaufgabe und Artikel.
- `disc[beitragsId] {prep, take, check, use}`: Datum je Entdecken-Schritt.
- `mix {work, life}`: Zähler für Beruf und Alltag.
- `vtests[]` (höchstens 20): Wortschatztests.
- Außerdem: `sprints[]` (≤ 60), `listen[]` (≤ 80), `checks[]` (≤ 20), `feed[]` (≤ 40), `canDo {id: datum}`, `lastAutoGen` sowie die Altschalter `tour11` und `seen15`.

### Weitere Dokumente
- `app/course.done[lid] = {d: lokales Datum, t: ms, n: bewertete Aufgaben, ok: richtige}`. `res` ist immer `{}`.
- `app/radar.events` (≤ 400): `{c: Fehlerkategorie, s: Quelle, t: ms, q ≤ 160, g: gegeben ≤ 100, a: richtig ≤ 100}`. Quellen: g = Grammatik/Preply, w = Schreiben, r = Lesen, v = Vokabeln, s = Sprint.
- `log/<datum>`: `{date, entries ≤ 300}`. Jeder Eintrag hat `{t, ok, lang}` und dazu eine dieser Formen:
  - Vokabel: `{k: "v", id, m, given, ans}`
  - Grammatik: `{k: "g", topic, type, q, given, ans, src}`
  - Sonstiges: `{type: lesson-q|discover|chunk|dictate|cloze|order, q, given, ans}`
- `app/pool`: `{items ≤ 90, t}`. Eine Warteschlange unbenutzter Aufgaben; ausgegebene werden entfernt.
- `app/lookup.items[kleingeschriebenes Wort]`: höchstens 400 Einträge. `app/chat.msgs`: höchstens 40.
- **`app/assess` hat im Code eine Hülle:** `{d, t, lang, answers, writings, data: {level, cefr, levelWhy, trend, trendWhy, strengths, blockers, focus, dims, c1gap, today}}`. Ein Dokument ohne `data` wird ignoriert. **Anhang B zeigt die Felder flach.** Das neue Schema muss beide Formen lesen.

## 5. Pfade, die in Anhang B fehlen

- `chunk/<id>` (Einzahl): `{id, en, de, kind: collocation|frame|phrase, register, why, src {scene, sceneTitle, utterance, upgraded, turn, ts}, level, created, seen?, also[], hidden?}` plus dieselben Planungsfelder wie Vokabelkarten.
- `scene/<id>`: `{id, title(_de), situation(_de), goal(_de), persona {name, role, org, traits}, stake, objection, opening, useful [{en, de}], level, ts, done?, band?}`. Gesprächsverläufe werden nicht gespeichert.
- `preply/pp<ms>` (Stundenplan): `{t, lang, ctx {kind, title, topic}, title, minutes, goal_en, goal_x, warmup[], talk[], say[], watch [{mistake, fix, note}], message, done, doneT}`
- `preply/pi<ms>` (Import): `{kind: "import", raw, title, summary, corrections [{wrong, right, topic, why}], tasks[], words [{en, de, ex}], homework[], applied, appliedT}`
- `articles/ai<ms>`: `{id, level, topic, topic_de, title, teaser, text, keypoints[], glossary [{w, de, def}], src}`
- `reading/r<ms>`: `{t, date, articleId, title, level, summary, words, readSec, res {score, covered[], misunderstood[], language {cefr, errors [{orig, fix, cat, why}], tips[]}, feedback, model_summary}}`
- `lpool/ai<ms>` (Hörtexte): `{level, topic_de, title, genre, text, questions [{q, options, answer, type, explain_de, explain_en}], vocab [{w, de}], src}`
- `wprompt/<datum>`: `{p: {id, genre, level, title_de, title_en, task_en, task_de, words [min, max], focus_de, focus_en, useful[], src}}`
- `writing/w<ms>`: `{date, promptId, title, task, genre, text, words, rev, res {cefr, scores {task, grammar, vocabulary, coherence, register}, summary, strengths, errors [{orig, fix, cat, sev, why}], improved, upgrades, phrases, next}}`
- `writing/lesson-<lid>-<ms>`: Hier heißen die Fehlerfelder `res.errors [{wrong, right, why, cat, sev}]`.
- `lesson/<lid>`: `{v: 1, t, words[], dialogue {title, lines [{sp, en, de}]}, questions [{q, options, answer, lang, q_alt?, options_alt?, answer_alt?}], tasks [{…, hint, expl, expl_en}], output {de, en, mustUse}}`
- `feed/<datum>` und zusätzlich `feed/<datum>-own-<b36>` (selbst hinzugefügte Beiträge): `{id, d, items[]}`

## 6. Tagesplan-Kanäle (`app/profile.plan.ids`)

Die alte App bewertet alle Kanäle nach Bedarf und nimmt die drei besten. Der erste davon ist Pflicht. Lektion und Wiederholen kommen immer dazu.

| id | Aktivitätsschlüssel | Fertigkeit | Min. |
|---|---|---|---|
| listen | listen | li | 10 |
| read | read | re | 10 |
| write | write | wr | 15 |
| gram | gram | gr | 10 |
| vocab | **cards** | vo | 10 |
| sprint | sprint | fl | 5 |
| dictate | dictate | li | 6 |
| cloze | cloze | vo | 5 |
| order | order | gr | 5 |
| speak | speak | wr | 12 |
| discover | discover | re | 15 |

`plan.why[i]` enthält Begründungs-Schlüssel statt Sätzen: `["agoNever"]`, `["agoDaysN", n]`, `["whyFocus"]`, `["whyThin"]`, `["whyWeakest"]`, `["whyDue", n]`.

## 7. Serie und Datumsschlüssel

- **Aktiver Tag:** `days[k] > 0` oder `xpDays[k] > 0`. `act` und `minutes` zählen nicht.
- **Zählweise:** Ist heute noch nicht aktiv, beginnt die Zählung bei gestern. Dann wird rückwärts gezählt, solange Tage aktiv sind.
- **Kein Serienschutz** (keine Freeze-Tage).
- **Datumsschlüssel `JJJJ-MM-TT`:** lokales Gerätedatum, der Tag wechselt um Mitternacht.
- **Bekannter Fehler der alten App:** „heute" wird nur beim Laden berechnet. Bleibt die App über Mitternacht offen, landen Einträge auf dem alten Datum. Die neue App berechnet den Schlüssel immer aktuell.

## 8. Wichtig für die Umstellung

1. **Externer Schreiber:** Der abendliche Claude-Tagesauftrag schreibt `daily/<datum>` und `feed/<datum>`. Die alte App wandelt beim Laden `daily.newWords` in Vokabelkarten um (`src: "coach"`) und `grammarItems` in Pool-Aufgaben.
2. **Voreinstellungen stehen im Code, nicht in der Datenbank:**
   - 40 Startvokabeln (`SEED_VOCAB`) und die Grammatikthemen mit p0 existieren erst in der Datenbank, wenn sie einmal benutzt wurden.
   - Die neue App muss sie als Daten mitbringen und genauso darüberlegen: Datenbank vor Voreinstellung. Sonst sinken die Anzahlen.
3. **Keine Schema-Versionierung** außer `lesson.v = 1`. Es wird nie hart gelöscht (`hidden: true`).
4. **Zweite Speicherschicht im Browser:**
   - Jeder Pfad liegt zusätzlich in `localStorage` unter `sw2:<pfad>`.
   - `sw2:__dirty` ist ein Objekt `{pfad: Zeitpunkt in ms}` (belegt in `core/sync.js`: `Dirty.mark(p, Date.now())`). Beim nächsten Laden gewinnt dort die lokale Kopie.
   - **Lokale Kopien können neuer sein als die Datenbank.** Beim Umzug auf dieselbe Adresse (gleicher Ursprung, gleicher `localStorage`) muss die Umstellung noch nicht übertragene `sw2:`-Kopien erkennen, im Trockenlauf-Bericht zeigen und nach Bestätigung übernehmen.
5. **Größengrenzen im Code:** log 300 Einträge je Tag, radar 400, lookup 400, pool 90, chat 40, Grammatikfehler 10, Kartenverlauf 12. Bei `quota_exceeded` verwirft die alte App den Schreibvorgang mit einer Meldung.
