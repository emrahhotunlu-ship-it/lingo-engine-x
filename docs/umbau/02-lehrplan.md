# 02 · Lehrplan Wortschatz und Grammatik (B2 → C1)
Englischlehrer-Sicht (CELTA/DELTA) · 04.10.2026 · nur gelesen, nichts geändert · Pfade relativ zu `/home/user/lingo-engine-x` · **(Modell)** = Rechnung mit Annahmen · **(Gedächtnis)** = nicht neu nachgeprüft, im Umsetzungsfenster gegenprüfen
## 1. Ziel ehrlich definiert
- **„8.000 Wörter“ heißt hier: 8.000 Atlas-Einträge** = 6.200 Wortfamilien (ab Rang 2.000, das Fundament darunter wird vorausgesetzt) + 1.800 feste Wendungen. Faustregel: ab ~8.000 Wortfamilien versteht man unvereinfachte Texte flüssig (Nation 2006, **Gedächtnis**). Das ist **passives** Wissen. Aktiv, also selbst benutzen, trainiert man gezielt nur ~1.500–2.000 Einheiten, Wendungen vor Einzelwörtern (`docs/wortschatz-plan.md:6`).
- **Startstand (Annahme, die Einstufung ersetzt sie):** Emrah kennt ~55–60 % des Atlas schon (Deutsch hilft bei Verwandtem), offen sind ~3.400 Einträge.
- **Machbar bei 25 Min./Tag (12 Min. Wörter; Rechnung mit `src/domain/srs/cost.ts:9-15`, `src/domain/unit/backlog.ts:52-61`, Modell):** 3 neue aktive Einheiten pro Tag (2–5 nach Kapazität), ab Monat 4 dazu 2 „Verstehen“-Einträge. **6 Monate ≈ 450 aktiv gelernt (≈ 350 „Aktiv fest“); 12 Monate ≈ 900 (≈ 750 fest) + ≈ 450 verstehen, damit ≈ 70–75 % des Atlas bekannt.** 1.500 aktiv erst nach ≈ 19 Monaten; 4–5 Neue pro Tag brauchen 15 statt 12 Min. Wörter.
- **„Grammatik C1“ heißt (messbar):** (1) B2-Themen ≥ 90 %, C1-Themen ≥ 75 % richtig in freien Aufgaben; (2) die richtige Struktur wählen, auch wenn Themen gemischt sind; (3) dieselbe Aussage auf ≥ 2 Wegen sagen können (aktiv/passiv, Nebensatz/Partizip, direkt/abgeschwächt); (4) Deutsch-Fallen kommen selten zurück (≤ 2 Rückfälle in 28 Tagen); (5) eigene Fehler finden (≥ 80 %).
- **Ohne Lesen/Hören:** möglich sind Wissen über Wörter und Formen, Abruf und weniger Fehler; **nicht** möglich sind Lese-/Hörflüssigkeit und Aussprache. Ausgleich als Mini-Input: 3 echte Sätze je Eintrag (Meeting · Mail · Alltag), Wortpartner im Satz, Sprachausgabe nur zum Anhören eines Satzes. Außerhalb der App bleibt: ~10 Min. echter englischer Input am Tag.

## 2. Wortschatz-Atlas (8.000 Einträge)
| Band | Inhalt | Einträge | aktiv | Start |
|---|---|---|---|---|
| 1 B2-Kern | Wörter ca. Rang 2.000–3.200, die B2 sicher können muss | 1.200 | 20 % | Einstufung Tag 1–3, danach nur Lücken (1 Karte/Tag) |
| 2 B2+ | ca. Rang 3.200–4.500 | 1.300 | 10 % | ab Monat 2, meist „Verstehen“ |
| 3 C1-Allgemein | ca. Rang 4.500–6.200: Verben, Adjektive, Abstrakta | 1.700 | 25 % | ab Woche 2 (1 von 3 Neuen) |
| 4 C1-Business | Verkauf, Verhandlung, Projekt, Finanzen, Recht, HR | 1.200 | 80 % | ab Tag 1 (Hauptstrom) |
| 5 Wendungen | 850 Kollokationen (feste Wortverbindungen) · 300 Phrasal Verbs · 250 Rahmen/Diskursmarker · 150 Idiome · 250 Grammatik-Wendungen (depend on, prevent … from -ing) | 1.800 | 90 % | ab Tag 1 (Hauptstrom) |
| 6 Fachbereiche | DMS/ECM/Cloud, IT-Sicherheit, Compliance, Verträge | 600 | 40 % | ab Woche 3, jede 4. Einheit |
| 7 Selten | Rang 8.000+, nur verstehen | 200 | 0 % | ab Monat 9 |
| **Σ** | 6.200 Wortfamilien + 1.800 Wendungen; Rang 1–2.000 (A1–B1) wird vorausgesetzt, nur Stichprobe | **8.000** | **≈ 45 %** | |
- **Auswahl (Priorität P, Startgewichte = Annahme):** P = 0,40·Frequenz + 0,35·Nutzen + 0,25·Emrah-Bezug (je 0–1), minus 0,2 bei Verwandtem ohne Falle (→ „Verstehen“). Frequenz = log-Rang (Spitze bei Rang 3.000–6.000) · Nutzen = 1,0 Business-Wendung, 0,8 Verb/Adjektiv zum Selbstsagen, 0,5 Fachwort, 0,3 selten · Emrah-Bezug = 1,0 angetippt/übersetzt/falsch gemacht (Korb-Stufen `src/domain/srs/queue.ts:42-51`), 0,5 DMS/ECM/Cloud/Vertrieb. **Tagesmix:** 3 Aktive = 2 aus Band 5/4 (Wendungen vor Einzelwörtern) + 1 aus Band 3 (jeder 4. Tag Band 6); „Verstehen“ (ab Monat 4) = 2 aus Band 2/3/6/7.
- **Einstufung vor jedem Band:** 25 Wörter „Kenne ich?“ + 5 Bedeutungsfragen, mit Pseudowörtern und Fehlalarm-Korrektur wie `docs/vtest.md:15-23`; ≥ 90 % bekannt → Band übersprungen, sonst nur die unbekannten Einträge.
- **Quellen (Gedächtnis, Lizenz prüfen, Ziel „verkaufbar“):** nur die Stichwörter aus NGSL/NAWL/BSL (CC BY-SA 4.0), Rang aus offenem Korpus (z. B. Leipzig, CC BY), Lautschrift aus CMU (im Repo: `src/content/pron/LICENSE-cmudict.txt`); Download aus der Cloud-Umgebung ungeprüft. **Nicht kopieren:** Oxford 3000/5000, Cambridge EVP, COCA, SUBTLEX. Definitionen, Sätze, Übersetzungen immer neu von Claude (eigene Texte); Quellenseite in der App.
- **Erzeugung zur Bauzeit, nicht in der App:** Index aller 8.000 (Stichwort, Wortart, Familie, Rang, Band, aktiv/verstehen) per Skript; Karten in Chargen à 25–40 je Band mit festem Schema (zod). Release 1 = Band 5+4, ≈ 600 voll fertig, danach +300 pro Monat (Verbrauch ≈ 90 aktive/Monat, der Vorlauf reicht).
- **Prüfkette je Charge:** (1) automatisch für 100 %: Schema, Dubletten, Satz enthält Zielform, 8–18 Wörter, ≥ 90 % übrige Wörter ≤ Rang 3.000, Deutsch erkannt, US-Schreibung; (2) Löser-Probe: ein zweiter Claude löst die Lücke ohne Lösung, Abweichung → Prüfliste; (3) Kritiker-Durchgang mit anderem Prompt; (4) Lehrer-Stichprobe 100 je Charge, dazu einmalig 200 durch Emrahs Preply-Lehrer (≈ 1 Std.). **Zulässige Fehlerquote (Stichprobe 100):** ≤ 2 harte Fehler (falsche Bedeutung/Wortart, falscher oder unnatürlicher Satz) = ok · 3–5 = markierte Muster nachbessern · > 5 = Charge neu; weiche Mängel (steif, zu allgemein) ≤ 8. Veröffentlichter Bestand mit Meldeknopf: ≤ 1 % harte Fehler, gemeldete Karte sofort ausgeblendet.
- **Technik-Grenze:** Atlas im Code (Ziel ≤ 4 MB; `dist` heute 3,7 MB, `docs/umbau/00-code-statistik.md:101`), aber **kein Dokument je Wort**: „bekannt/verstehen“ in Sammel-Dokumenten (ein Bitset je Band), Karten-Dokumente nur für gelernte Einträge (Grenze 5.000, `CLAUDE.md` A6.6).

## 3. Wortschatz-Karte (Pflichtfelder)
| Feld | Pflicht für | Regel | Heute |
|---|---|---|---|
| Wort/Wendung `en` | alle | Verb mit „to“, Wendung mit sb/sth, US-Schreibung | ja |
| Wortart + Familie | Wörter | Familie 2–4 Mitglieder (comply · compliance · compliant) | Wortart ja, Familie nein |
| Deutsch `de` | alle | 1–3 Varianten, wichtigste zuerst, nie nur ein Synonym des Zielworts | ja |
| Englisch kurz `def` | aktiv | ≤ 12 Wörter, einfacher als das Wort, nie das Wort selbst | ja |
| Beispielsatz mit Lücke `ex` | alle | Regeln unten | 1 Satz |
| 2 Zusatzsätze | aktiv | andere Situation (Meeting · Mail · Alltag) für den Satzwechsel ab Stufe 3 | nur von Claude zur Laufzeit |
| Wortpartner `col` (2–3) | aktiv, Wörter | je mit Satz + 2–3 typischen Fehlgriffen als Ablenker | nein (Pack leer, Claude beim 1. Aufdecken) |
| Register + Ort | alle | formal/neutral/informal · Mail/Gespräch · US/UK | Wendungen ja, Wörter gehen verloren (`src/domain/c1pack/pack.ts:75-86`) |
| Deutsch-Falle `trap` | ca. 20 % | falsch → richtig + 1 Satz Grund, Verweis auf f-ID | nur Freitext `why` bei Wendungen |
| Lautschrift + Betonung | Wörter ≥ 2 Silben | aus CMU-Daten, nie von Claude | ja (Nachschlagen) |
| Band · Rang · Thema · aktiv/verstehen · Verwandtschaft (gleich/falsch/teils) | alle | feste Felder aus dem Atlas | nein |
| Merkhilfe | optional | nur bei falschen Freunden und Dauerfehlern (≥ 5× vergessen), auf Knopfdruck | teils (`src/features/vocab/mnemonic.tsx`) |
- **Regeln für Beispielsätze:** (1) 8–18 Wörter, ein Gedanke, ganzer Satz · (2) Zielform in typischer Verbindung, Lücke hat genau eine sinnvolle Lösung (Löser-Probe) · (3) zwei Drittel Beruf (Verkauf, Verhandlung, Projekt, DMS/Cloud), ein Drittel Alltag · (4) übrige Wörter ≤ B2, keine Wortfamilie des Ziels im Satz · (5) natürliches US-Englisch, nichts Konstruiertes („The archive is archived“) · (6) Satzart wechselt (Aussage, Frage, Bedingung, Passiv), nie derselbe Anfang · (7) kein Deutsch im englischen Satz.
- **Satz 2 und 3** kommen aus anderen Situationen, damit das Wort nicht am Satz klebt (`src/domain/srs/rotate.ts:5-9`); ohne sie bleibt der Satzwechsel von Claude abhängig.

## 4. Grammatik-Lehrplan (39 Themen, B2 → C1)
39 Themen in Lehrreihenfolge; die 7 C1-Werkzeuge sind alle 4–5 Themen eingeschoben. Einstufung: 2 Aufgaben je Thema (78), verteilt auf die ersten 2 Wochen; Schwaches rückt bis zu 6 Plätze vor. **vorh.** = Themen-ID im Code (`src/content/legacy/grammar.json`, `src/content/c1/toolkit.json`), **NEU** = anlegen (≥ 24 Aufgaben je Thema ≈ 940, gleiche Prüfkette wie Abschnitt 2; heute ~5–6 je altem, ~13 je C1-Thema). **lex** = Lernstoff sind feste Verbindungen: läuft zusätzlich als Wendungskarten (Band 5), „sicher“ verlangt dort auch ≥ 80 % der Karten „Aktiv fest“.
Formen: A Auswahl · L Lücke · U Umformen · F Fehler finden + verbessern · B Satz bauen · S eigener Satz · K Schlüsselwort. **G** = „sicher“: ≥ 8 von 10 freien Aufgaben (L/U/F/K/S) richtig, an ≥ 3 Tagen, letzte Reihe ≥ 14 Tage nach der ersten, Mischrunde nach 28 Tagen ≥ 70 %. Zusatz: +F Fehler finden ≥ 80 % · +S 2 eigene Sätze fehlerfrei · +U 3 Umformungen · +K 2 Schlüsselwort-Sätze · +B 2 gebaute Sätze. `pres-simple-cont` (B1) bleibt nur als Einstufung/Wiederholung, nicht im Pfad.

| # | Thema · Status | Regel in einer Zeile | Typischer Fehler (Deutsch) | Formen | sicher |
|---|---|---|---|---|---|
| 1 | `past-simple-perfect` · vorh. | Abgeschlossene Zeit (yesterday, ago) = Past Simple; Zeitraum bis jetzt = Present Perfect | „I have seen him yesterday“ | A L U F | G+F |
| 2 | `pres-perf-cont` · vorh. | have been + -ing: Dauer bis jetzt (for, since) | „I wait here since two hours“ | L U F | G |
| 3 | `future-forms` · vorh. (B1) | will = Entscheidung, going to = Plan, Present Continuous = Termin; C1-Teil: be due to, be set to, be likely to | „Tomorrow I go to the customer“ | A L U | G |
| 4 | `time-clauses` · NEU | Nach when, as soon as, once, before steht Präsens/Perfect, nie will | „As soon as I will know, I call you“ | L F S | G+S |
| 5 | `c1-hedging` · vorh. | Abschwächen: might, could, It seems that, a bit | „This will not work.“ (zu hart) | U S | G+S |
| 6 | `future-perf-cont` · vorh. | will have done = bis dahin fertig; will be doing = dann gerade dabei | „By Friday I finish it“ | L U | G |
| 7 | `past-perfect` · vorh. | had done = das frühere von zwei Ereignissen | „When I came, the meeting already started“ | L U F | G |
| 8 | `used-to` · vorh. | used to + Inf. = früher; be/get used to + -ing = gewöhnt | „I am used to work late“ | A L F | G |
| 9 | `c1-diplomacy` · vorh. | Distanz: I was wondering whether…, Would it be possible…? | „I want that you send it“ | U S | G+S |
| 10 | `conditionals` · vorh. | if + Present / Past / Past Perfect; nie will/would im if-Teil | „If you would sign today, …“ | L U F | G+U |
| 11 | `cond-alt` · NEU | unless, provided that, as long as, in case; formell: Should you…, Were we to… | „Unless you don't sign…“ | L U K | G+K |
| 12 | `mixed-cond` · vorh. (B2+) | wish/if only + Past (jetzt) oder Past Perfect (Bedauern); dazu would rather, it's time, as if | „I wish I would have more time“ | L U F | G+U |
| 13 | `passive` · vorh. | be + 3. Form; is being done, has been done; Täter mit by | „signed from both sides“ (statt by) | L U F | G |
| 14 | `c1-discourse` · vorh. | That said, To build on that, Coming back to… | nur „but“, „then“, „so“ | L U | G |
| 15 | `passive-plus` · NEU | It is said that…, He is said to have…; have/get something done | „We have repaired the server“ (gemeint: lassen) | U K S | G+K |
| 16 | `reported` · vorh. | Zeit einen Schritt zurück; indirekte Frage ohne do | „She asked me where do I work“ | L U F | G |
| 17 | `report-verbs` · NEU · lex | admit, deny, suggest, insist, recommend: je Verb ein festes Muster (-ing / that / to) | „He suggested to meet“ | A L U | G |
| 18 | `questions` · NEU | Subjektfrage ohne do; indirekte Frage; höflich: Would you mind -ing | „Can you tell me what do you use?“ | L U F | G+F |
| 19 | `c1-emphasis` · vorh. | Cleft (What we need is…), Inversion (Not only did we…) | „Not only we saved costs…“ | U K | G+K |
| 20 | `relative` · vorh. (B1) | who/which/whose; mit Komma kein that; C1-Teil: with whom, which = ganzer Satz, verkürzt | „the thing what we need“ | L U F | G+U |
| 21 | `modals-deduction` · vorh. | must / might / can't (have done) | „He mustn't have seen it“ | A L U | G |
| 22 | `modals-advice` · NEU | should have, needn't have, had better, be supposed to; mustn't ≠ don't have to | „You must not come“ (gemeint: musst nicht) | A L F | G |
| 23 | `gerund-inf` · vorh. | enjoy/avoid + -ing; decide/hope + to; stop/remember/try ändern den Sinn | „I look forward to see you“ | A L F | G |
| 24 | `verb-patterns` · NEU · lex | allow/enable + Objekt + to; prevent … from -ing; insist on, succeed in + -ing | „prevent us to start“ | L U F | G+F |
| 25 | `c1-participle` · vorh. | Having reviewed…, Using OCR…, Stored in…; Subjekt muss passen | hängendes Partizip („Reviewing it, the signature was…“) | U K | G+K |
| 26 | `mandative` · NEU (US) | suggest/recommend/require/essential that + Grundform („that he approve“) | „I suggest him to approve“ | L U K | G+K |
| 27 | `articles` · vorh. (B1) | the = bekannt/einmalig; Allgemeines ohne Artikel; dazu few/little, each/every/whole | „The customers want the quality“ · „I have meeting“ | A L F | G+F |
| 28 | `countable` · NEU · lex | information, advice, feedback, equipment = unzählbar; a number of ≠ the number of | „informations“, „an advice“ | L F | G |
| 29 | `prepositions` · vorh. · lex | Verb/Adjektiv + feste Präposition (depend on, interested in, comply with) | „interested for“, „depend from“ | A L F | G |
| 30 | `prep-noun` · NEU · lex | Nomen + Präposition (increase in, demand for, solution to, impact on) | „the reason of“, „an increase of sales“ | L F | G |
| 31 | `c1-nominal` · vorh. | the implementation of…, Following the approval of… (sparsam) | deutscher Nominalstil, Nomen-Ketten | U | G |
| 32 | `prep-time` · NEU · lex | by (Frist) ≠ until (Dauer); in ≠ within; for/since/during; as of | „until Friday“ (gemeint: bis spätestens) | A L F | G |
| 33 | `compound-mod` · NEU | a three-year contract, a 30-minute call (Singular!), cost-effective | „a contract of three years“ · „a 30 minutes call“ | L U F | G+U |
| 34 | `phrasal-syntax` · NEU · lex | Pronomen vor Partikel (turn it down); trennbar/untrennbar; Register (look into ↔ investigate) | „turn down it“ | A L U | G |
| 35 | `word-order` · NEU | S-V-O, Ort vor Zeit; only/also/even direkt vor dem Bezugswort; always vor dem Verb | „I like very much this idea“ | U F B | G+B |
| 36 | `c1-precision` · vorh. | roughly, just under, by the end of Q3, within two weeks | „until the end of Q3“ | L U F | G |
| 37 | `linkers` · NEU · lex | although/while/whereas; despite + -ing; owing to; so that | „Although it is expensive, but…“ · „despite of“ | L U K | G+K |
| 38 | `comparison` · NEU | the more…the more; far more; not nearly as; twice as…as | „more cheap“ · „bigger as“ | L U F | G |
| 39 | `ellipsis` · NEU | Nichts wiederholen: so do I, I hope so, one/ones, … if you'd like to | „I think yes“ | L U | G+S |

**Top-15 Deutsch-Fallen** (ID = `src/content/nb/traps.ts`, dort 25 vorhanden; NEU = als f26–f28 anlegen): 1 since/for + Perfect (f12) · 2 Past Simple bei Zeitpunkt (f22) · 3 indirekte Frage ohne do (f20) · 4 feste Präpositionen (f18) · 5 discuss/explain/suggest + Objekt (f15, f16) ·
6 look forward to + -ing (f17) · 7 unzählbare Nomen (f14) · 8 make/do/give/take/hold (f19, f21) · 9 falsche Freunde: actual, eventually, become, provision, prospect, serious, chance (f01–f08, f23) · 10 by ≠ until, in ≠ within (f11) ·
11 Zahlen: billion, Dezimalpunkt (f09) · 12 zu direkt: must, „not possible“ (f25) · 13 will im when-/if-Satz (NEU, Aufgabe schon in `src/content/legacy/rules.json:681`) · 14 Artikel: „the customers“, „I have meeting“ (NEU) · 15 Wortstellung: „I like very much it“ (NEU)

## 5. Aufgabenformen und Aufgabenzeilen
**Regel für jede Aufgabenzeile:** (1) was tun, (2) worauf achten bzw. welche Form gesucht ist, (3) welche Hilfe da ist; das Thema steht nur in der Lernphase dabei (in der Wiederholung muss Emrah die Regel selbst wählen); nie nur „Ergänze die Lücke.“

| Form | Stufe (W = Wort, G = Grammatik) | Entscheidung · Grund | Aufgabenzeile (Muster) |
|---|---|---|---|
| Aufdecken `flip` DE→EN | W 0–2 | **bleibt**, Standard: echter Abruf, schnellste Form (`docs/neubau/anki-regeln.md:43`) | „Was gehört in die Lücke? Sag es im Kopf, dann deck auf.“ |
| Aufdecken EN→DE | Verstehen-Karten | **bleibt**, billig, höchstens Stufe 2 | „Was bedeutet das markierte Wort? Denk kurz nach, dann deck auf.“ |
| `mc_en` · `mc_de` · `match` | W 1–2 | **bleiben nur** für Einzelwörter und Verstehen-Karten; Wendungen überspringen die Auswahl (`src/domain/srs/chunkCards.ts:11`) | „Welches englische Wort passt zu ‚[Bedeutung]‘? Wähle eine Antwort.“ |
| `spot` (Wort im Satz antippen) | W 1 | **entfällt**: reines Wiedererkennen, kaum C1-Gewinn | – |
| `cloze_hint` | W 3 | **bleibt**: Brücke zum freien Tippen | „Schreib das fehlende Wort (Bedeutung: [de]); der erste Buchstabe hilft.“ |
| `tiles` (Buchstaben/Wörter) | W 3 | **entfällt** für Wörter: Buchstabenpuzzle ohne C1-Nutzen, Emrahs „Bausteine sprangen“ (Vermutung: auch hier, `src/domain/srs/exercise.ts:146-178`); Wort-Bausteine nur im Satzbau | – |
| `cloze` · `type` frei | W 4 | **bleiben** (Kern) | „Schreib das fehlende Wort in die Lücke (Bedeutung: [de]).“ |
| `colloc` | W 4 | **bleibt, aber getippt** statt Auswahl (3 Ablenker = Raten) | „Welches Verb gehört fest zu ‚deadline‘? Schreib es; der erste Buchstabe hilft.“ |
| `situation` | W 4 | **bleibt**, für alle Wendungen (nicht nur mit Szene) | „Du willst sagen: [Bedeutung]. Schreib die passende englische Wendung.“ |
| `produce` eigener Satz | W 5 | **bleibt**; offline nur Zielform-Prüfung (`src/i18n/parts/trainer.de.ts:40`) | „Schreib einen Satz mit ‚[Wort]‘ über deinen Arbeitsalltag (mind. 8 Wörter).“ |
| `speed` · `dictation` · `listen_mc` | W 5 / 1 | **entfallen**: Tippen gegen die Uhr misst Tippen (`exercise.ts:188`), Hören ist nicht mehr Fokus | – |
| `mc` · `gap` · `transform` · `correct` | G | **bleiben**, Form nach Sicherheit (`src/domain/grammar/tasks.ts:137-141`): A bei Einführung, L/U mittel, F/K/S wenn sicher | A „Welche Form passt in die Lücke? Thema: [Thema].“ · L „Setz [work] in der passenden Form ein.“ · U „Schreib den Satz im Passiv neu, gleiche Bedeutung.“ |
| Satzbau `order` (57 Sätze) | G | **bleibt**, Tippen statt Ziehen | „Du willst sagen: ‚[Bedeutung]‘. Bring die Bausteine in die richtige Reihenfolge.“ |
| **NEU Fehler finden** | W + G | Wort antippen, dann verbessern; Daten: Traps (25 × 3 Drills) + `why` der Pack-Wendungen | „In diesem Satz steckt ein Fehler. Tippe auf das falsche Wort, dann verbessere es.“ |
| **NEU Umformen** (Register, Struktur, Schlüsselwort) | W + G | C1-Flexibilität, lokal prüfbar; Daten: `src/content/nb/transforms.json` (30) → ≥ 200 | „Sag dasselbe förmlicher (Mail an den CFO). Schreib den ganzen Satz.“ · K „Schreib den zweiten Satz mit MAY (3–6 Wörter) so, dass er dasselbe bedeutet.“ |
| **NEU Wortfamilie** | W | Präzision, C1-Prüfungsformat; Daten: `src/content/nb/extras.json` Wortbildung (20) → ≥ 120 | „Bilde aus ‚comply‘ das Wort, das in die Lücke passt (Adjektiv).“ |

## 6. Tagesaufbau (25 Min.) und Wochenrhythmus
| Block | Min. | Inhalt | Neues |
|---|---|---|---|
| 1 Wörter wiederholen | 8 | fällige Karten; junge Karten aufdecken, reife tippen; bei Rückstand bis +4 Min. (`src/domain/unit/backlog.ts`) | – |
| 2 Neue Wörter | 4 | Einführung (Bedeutung · Satz · Wortpartner · Falle) → sofort erste Abfrage → morgen Wiederholung | 3 aktiv (2–5), ab Monat 4 + 2 Verstehen |
| 3 Grammatik | 7 | 2 Min. fällige Muster/Fehler + 5 Min. Thema der Woche | 1 Thema je ~8 Lerntage |
| 4 Anwenden | 4 | 2 Aufgaben mit Wörtern von heute + Struktur der Woche (U/K/B vor S) | – |
| 5 Fehler | 2 | eigene Fehler wiederholen (Boxen 1 · 3 · 9 · 28 · 90 Tage) | – |
- **Anteile:** Wörter 12 Min. (48 %) · Grammatik 7 (28 %) · Anwenden 4 (16 %) · Fehler 2 (8 %). Sechs Lerntage, ein Ruhetag (Serie, `CLAUDE.md` A7 26.09.).
- **Woche:** Mo Thema entdecken (3 Beispiele → Regel selbst formulieren → 4 Aufgaben) · Di L · Mi U/K · Do F · Fr B/S · Sa Mischrunde (3 Themen gemischt) + 5 ungesehene Aufgaben als Mini-Check · So Ruhe oder 5-Min-Check · letzter Sa im Monat: Stichprobe statt Block 3+4. Nächstes Thema startet bei ≥ 70 % im aktuellen oder nach 10 Lerntagen; Schwaches kommt über die Wiederholung zurück.

## 7. Messung: ist Emrah „C1-reif“ bei Wörtern und Grammatik?
| Was | Wie | Schwelle |
|---|---|---|
| Wörter aktiv | „Aktiv fest“ (Stufe ≥ 4 und S ≥ 21 Tage, `src/domain/srs/retention.ts:24`) + Trefferquote reifer Karten, 28 Tage | nach 12 Monaten ≈ 750; Quote ≥ 88 % |
| Atlas bekannt | Kennen-Check alle 8 Wochen: 60 Wörter aus Band 2–7, 8 Pseudowörter, 10 Bedeutungsfragen (Methode `docs/vtest.md`) | Band „sicher“: ≥ 90 % bekannt (aktiv: „Aktiv fest“; verstehen: S ≥ 21 Tage) + Stichprobe 20 ≥ 85 % |
| Grammatik | Thema „sicher“ nach G (Abschnitt 4) | ≥ 30 von 39 sicher, keins unter „solide“ |
| 4-Wochen-Stichprobe (letzter Sa im Monat, 15 Min.) | 20 Wörter (je 5 aus: neu · 1–3 Mon. · 3–6 Mon. · älter) + 20 **ungesehene** Grammatikaufgaben (1 je geübtem Thema) | Ausgabe in 1 Satz: „31 von 40 · Wörter 85 % · Grammatik 70 % · schwächstes Thema: …“; Trend, keine Note |
| C1-Probe (alle 8 Wochen, freiwillig, 20 Min.) | Format Cambridge „Use of English“: 8 Wortwahl, 8 offene Lücken, 8 Wortbildung, 6 Schlüsselwort (**Gedächtnis**) | ≈ 60–65 % richtig in 2 Proben in Folge = Richtwert C1 (grob, nicht geeicht) |
| „C1-reif bei Wörtern + Grammatik“ | alle vier: ≥ 750 Aktiv fest und Atlas ≥ 85 % bekannt · ≥ 30 Themen sicher · Probe ≥ 65 % zweimal · ≤ 2 Fallen-Rückfälle in 28 Tagen | Ehrlich: Sprechen und Schreiben werden nicht gemessen; „C1-reif“ ≠ „spricht C1“ (Preply bleibt der Test dafür) |
- **Anzeige „Fortschritt“ (nur 4 Zahlen):** Atlas bekannt x / 8.000 · Aktiv fest y · Grammatik sicher z / 39 · Fallen offen n (jeweils mit Trend seit 4 Wochen).

## 8. Was ein CELTA/DELTA-Lehrer an der heutigen App am meisten bemängelt
1. **Kein geplanter Wortschatz, der Zulauf endet nach ~4 Monaten:** nur 250 Einträge, höchstens 2 pro Tag (`src/domain/c1pack/pack.ts:20-22`; `src/content/c1/pack.json` = 250 Einträge ≈ 125 Tage), danach Zufall. `level` wird nur geschrieben (`src/domain/srs/newCard.ts:90`), nie zur Auswahl gelesen; der Korb sortiert nach Herkunft und Alter statt nach Nutzen (`src/domain/srs/queue.ts:42-51, 92-97`). → Abschnitt 2.
2. **Karten dünn, Inhalt am Ziel vorbei:** Schema ohne Wortpartner, Falle, Familie, Zusatzsätze (`pack.ts:26-36`); Wortpartner kommen erst beim ersten Aufdecken von Claude, „kann Fehler enthalten“ (`src/domain/srs/collocs.ts:5-9`), die Übung `colloc` fehlt bis dahin (`src/domain/srs/modes.ts:62-63`). Das Pack ist zu 100 % Business (kein Alltag-Drittel) und enthält Verwandtes ohne Lernwert (`pack.json:2187, 2237, 2267, 2457, 2497`: metadata, encryption, interoperability, transparency, sustainability). → Abschnitt 3.
3. **Grammatik unter Zielniveau und zu dünn:** alle 16 alten Themen sind B1 (5), B2 (10) oder B2+ (1) (`src/content/legacy/grammar.json:18-231`); Fallen-Sätze oft B1-Fehler, die B2 kaum macht („I am knowing“ `src/content/legacy/rules.json:64`, „He have been feeling“ `:222`); nur ~5–6 Aufgaben je altem Thema (48 + 9 + 32 Fallen für 16 Themen) → danach kommen Aufgaben wörtlich wieder (`src/domain/grammar/tasks.ts:223-228, 286-292`), man lernt die Antwort statt der Regel; C1-Formen fehlen (Mandativ, Berichtspassiv, Ellipse, Konnektoren, Bedingungs-Alternativen). → Abschnitt 4.
4. **Planung zu grob, Fehler zu früh „erledigt“:** ein Wert je Thema (`src/domain/grammar/bkt.ts:4-10`), „Präpositionen“ ist ein Wert für hunderte Muster; Abstand höchstens 21 Tage (`:79-83`); ein Fehler gilt nach ~13 Tagen als erledigt (`src/domain/grammar/errors.ts:19, 73`), Fehler aus der Muttersprache halten sich viel länger. → Planung je Muster, Boxen bis 90 Tage (Abschnitt 6).
5. **Aufgabenzeilen zu allgemein, Formen mit wenig Lernwert:** „Ergänze die Lücke.“ gilt für zwei Wortschatzarten und die Grammatik (`src/i18n/de.ts:305-306`, `src/i18n/parts/learn.de.ts:193`), „Forme den Satz um.“ nennt kein Ziel (`:194`); Buchstaben-Bausteine und `speed` trainieren Tippen statt Können (`src/domain/srs/exercise.ts:146-178, 188`). → Abschnitt 5.
**Gut und behalten:** Hinweis-dann-Lösung, Satzvergleich, „Auch richtig“-Familien, Aufdecken→Tippen-Leiter, Kapazitätsregel für Neue. **Entscheidungen für Emrah:** (a) 3 Neue/Tag bei 12 Min. oder 4–5 bei 15 Min.? (b) „Verstehen“-Karten ab Monat 4 ja/nein? (c) Hören/Diktat endgültig weg? (d) Preply-Lehrer prüft einmalig 200 Karten (≈ 1 Std.)?
