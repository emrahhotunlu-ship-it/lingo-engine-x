# Prüfung des Relaunch-Konzepts: Tarek (Technik, Daten, Machbarkeit)

Stand 27.10.2026. Geprüft wurde `docs/relaunch/konzept.md` (627 Zeilen) gegen meine Recherche `docs/relaunch/recherche/tarek-technik.md` und gegen den Code: `contract/*.d.ts` (0.2.49), `src/data/{paths,writer,schemas,live}.ts`, `src/domain/srs/{applyReview,modes}.ts`, `src/domain/progress/logPatch.ts`, `src/domain/metrics/*`, `src/domain/grammar/errors.ts`, `src/domain/repair/repair.ts`, `src/domain/teacher/store.ts`, `src/domain/unit/plan.ts`, `src/domain/capacity/docGuard.ts`, `src/domain/atlas/capacity.ts`, `src/platform/speech.ts`, `src/styles/index.css`, `docs/datenstruktur.json`, `docs/entscheidungen.md`, `docs/umbau/07-datenleitplanken.md` und `docs/umbau/stand.md`.

**Korrektur an meiner eigenen Recherche:** Dort steht, `log/<Tag>` vertrage „mehr als 1.500 Antworten je Tag unkritisch“. Das stimmt nicht. `logPatch.ts` kappt bei **300 Einträgen bzw. 240 KiB**, die ältesten Einträge fallen heraus. Geschützt ist nur die erste `rev`-Antwort je Karte. Das ist für Veto 1 wichtig.

---

## 1. Leitplanken

| Nr. | Leitplanke | Urteil | Begründung (Konzept-Abschnitt) |
|---|---|---|---|
| L1 | Nur über `writer.ts` schreiben, nichts löschen oder umbenennen | **erfüllt** (mit einer Formulierungsstelle) | 3.7 und 16.1 verlangen `writer.transform`, alte Felder bleiben stehen. Nur 16.1 „je Tag überschrieben“ passt nicht zum Writer, denn `replace` ist nur für `app/lookup` erlaubt. Wird in Veto 1 mit korrigiert. |
| L2 | Kein Live-Gang ohne Sicherung, Test-Link, Rückweg und „Ja live nehmen“ | **erfüllt** | 14.1 und 18 (Test-Link je Stufe, Live nur nach „Ja live nehmen“, höchstens einmal pro Woche) |
| L3 | Keine neue Dokumentform ohne Rückweg-Plan und Kapazitätsrechnung | **verletzt** | 16.1: Die Fehlerschleife ist ohne Pfad, Größe und Rückweg („Name mit Tarek“, „Rückweg-Plan nötig“). Für die Tageszusammenfassung fehlt der Pfad. Die Messwerte liegen im gekappten `log`. `vs/<seg>` ist zwar in 16.1 genannt, kommt im Bauplan 18 aber in keiner Stufe vor, obwohl 8.3 das Wachstum festlegt. → Vetos 1 und 2 |
| L4 | Das Startbild wartet nie auf `db` oder `sample` | **teilweise** | 14.2 „Startbild ohne Datenbank“ widerspricht dem eigenen Nachsatz „rendert aus einem kleinen Zusammenfassungs-Dokument“, denn das ist selbst ein Datenbankzugriff. Die Absicht stimmt (Skelett statt falscher Zahl). Klarstellung siehe Verbesserung 1. |
| L5 | Nichts setzt das Mikrofon voraus | **erfüllt** | 2.4, 6.1 (Diktiertaste als Standard, Weg 2 nur nach Probe), 19.1, 20 |
| L6 | Kein Vertrags-Upgrade nebenbei | **erfüllt** | 16.1: Upgrade auf 0.2.91 nur als eigener, geprüfter Schritt |
| L7 | Jede Zahl kommt aus `domain/metrics` | **erfüllt** | 9.1 „eine Quelle für jede Zahl“, 14.1 |
| L8 | Nichts von außen laden | **erfüllt** | 19.2. Die Schrift „Inter Display“ (12) kostet kein zusätzliches Byte, siehe Verbesserung 6. |

---

## 2. Vetos (4)

### Veto 1: Datenplan 16.1 ist nicht baubar (L3, R1, R2)

**Was falsch ist:**
1. Für die Fehlerschleife gibt es weder Pfad noch Größe noch Rückweg. Damit fehlt genau das, was L3 verlangt.
2. Die Tageszusammenfassung soll „je Tag überschrieben“ werden. Der Writer erlaubt kein Überschreiben, und ein Pfad fehlt. Würde der neue Tagesplan in `app/profile.plan` landen, läse v86 ihn als alte Regel, weil `PLAN_RV = 2` und `rv !== 2` als alt gilt. Das wäre ein falscher Plan im Rückweg.
3. Sprech- und Hörmesswerte sollen in `log/<Tag>` stehen. `log` ist auf 300 Einträge bzw. 240 KiB gekappt, die ältesten fallen heraus. An vollen Tagen gingen also Antworten oder Messwerte verloren. Dazu kommt: v86 wertet jeden Log-Eintrag aus (`metrics/effect.ts` zählt jeden Tag mit Einträgen als Sitzung, `metrics/c1.ts` und `metrics/tempo.ts` lesen die Einträge). Fremde Einträge verfälschen im Rückweg die Zahlen.
4. Für Einstufung, Meilensteine, Kann-Beschreibungen, Missionsberichte, Hörstufe und Elo-Werte (7.1, 9.3, 9.4, 6.3) gibt es gar keinen Ort.

**Ersatztext für 16.1** (ersetzt die Tabelle und die Zeile „Kapazität“):

> | Neu | Pfad und Form | Größe | Rückweg v86 |
> |---|---|---|---|
> | Versuchsdaten je Antwort | `vocab/<id>.hist[]` neu `fk` (ms bis zum ersten Zeichen), `ms`, `in` (`t` getippt, `d` diktiert, `c` Auswahl); dieselben Felder in `log/<Tag>.entries[]` | +25 B je Eintrag, höchstens 12 Einträge | `hist` bleibt beim Anhängen mitsamt fremden Feldern erhalten (`applyReview` hängt an und schneidet bei 12 ab) |
> | Lernmodell je Wort | `vocab/<id>.lm = {v:1, s, r:{due,s,d,st,n,l,last}, said:{n,d}, mk, rt:{m,n,d}, hr, sx, at}` | ≤ 300 B | v86 schreibt `lm` nie und lässt es stehen. `lm.at` erkennt, dass v86 dazwischen geübt hat (`fsrs.last > lm.at`). Dann wird die Stufe neu abgeleitet, darf aber nur gehalten oder gesenkt werden. |
> | P-Spur | **kein** `lm.p`: Die P-Spur **ist** das bestehende `fsrs` | 0 | v86 plant weiter mit `fsrs` |
> | Stufe S0–S5 | `lm.s`; `stage` wird mit der bisherigen Regel `stageAfter` weitergerechnet | 1 B | v86 liest `stage` wie heute |
> | Neue Aufgabenformen | eigene neue `x`-Werte, in `modes` nur die sechs alten Modi | 0 | `exerciseDef` behandelt unbekannte `x` als Erkennen, das ist im Rückweg vorsichtig |
> | Kapitel-Zustand | `grammar/<id>.ch` | ≤ 0,5 KB | v86 ignoriert `ch` |
> | **Fehlerschleife** | Sammlung `err`, ein Dokument je Monat `err/<JJJJ-MM>`, bei vollem Dokument Fortsetzung `err/<JJJJ-MM>-b` (wie `act`). Einträge als Objekt-Abbildung `e:{<id>:{id,t,d,src,ref,cat,topic,w,r,why,f,fix,st}}`; `src` ∈ ex/gr/say/wri/mis/tch/c1x; `w`/`r` ≤ 160 Zeichen; `f` = FSRS kompakt; `fix` ≤ 4 Belege; `st` ∈ open/fixed/firm/rec | 0,7–1 KB je Eintrag; Wächter 200 KiB ≈ 200 Einträge je Dokument; erwartet ~150 im Monat → 12–24 Dokumente im Jahr | v86 kennt `err` nicht. **Spiegel** siehe unten |
> | Index offener Fehler | `app/errq = {m:[<Monate mit offenen Einträgen>], n, at}` | < 1 KB | abgeleitet, jederzeit neu berechenbar; v86 ignoriert es |
> | **Tagesplan und Startbild** | neues Dokument `app/today = {d, th, b:{b1…b6:{st,n,of}}, rest, ring, bt:{b1…b6}, at}`, Pflege per `update` (beim Tageswechsel per `transform`), **nie** in `app/profile.plan` | ≤ 2 KiB | v86 ignoriert es; `app/profile.pflicht[Tag]` behält dieselbe Bedeutung, die Serie läuft in beiden Versionen gleich |
> | Sprechmesswerte | bestehende Monatsdokumente: `fluency/<Monat>.rounds[]` (+ `wpm`, `in`), `say/<Monat>` | wie heute | v86 liest dieselben Felder |
> | Diktat und Hören | `out/<Monat>` mit `k:'dict'` bzw. `k:'hear'` | wie heute | v86 übergeht unbekannte `k` |
> | Missionen | `talk/<Monat>.runs[]` + `mis:{id, ok[], err[]}` | +0,5 KB je Lauf | v86 liest `runs` wie heute |
> | Vorher-Nachher | `app/compare` (bestehend, hat schon `wpm`) | wie heute | unverändert |
> | Einstufung, Meilensteine, Kann-Beschreibungen | `app/c1.ms[]` (≤ 30 × 0,5 KB), `app/c1.can{}` (12 Einträge) | ≤ 20 KiB | v86 ignoriert die neuen Felder in `app/c1` |
> | Elo je Form und Kapitel, Hörstufe | `app/levels.k.<art>` (bestehend) bzw. `app/levels.hear` | ≤ 10 KiB | v86 ignoriert unbekannte Schlüssel |
> | Wochen-Szenario | `app/week.sc` | < 1 KB | v86 ignoriert es |
>
> - **Übernahme in die Fehlerschleife:** Die offenen `grammar/<id>.errors[]`, `app/repair` und die Lehrer-Korrekturen werden einmal mit festen IDs (Quelle + Schlüssel) nach `err` übernommen. Das läuft als Trockenlauf mit Bericht, ist wiederholbar ohne Doppeleffekt, und die Quellen bleiben unverändert.
> - **Spiegel:** Neue Grammatikfehler schreibt die App zusätzlich über die bestehende Schreibfunktion in `grammar/<id>.errors[]` (Deckel 10, Überlauf nach `app/repair`). So sieht v86 sie weiter. Der Spiegel läuft nur in eine Richtung und endet frühestens 4 Wochen nach Emrahs „Ja live nehmen“ der Stufe 4.
> - **Wortfehler** bekommen keinen eigenen `err`-Eintrag. Das Wort selbst mit seiner R-Spur ist der Eintrag, sonst plant die App dasselbe doppelt.
> - **Registrieren:** `err` in `COLLECTIONS` (`src/data/paths.ts`), `app/errq` und `app/today` in `APP_DOCS`. Nur so landen sie in Sicherung und Export.
> - **Nie brechen:** wie bisher. Zusätzlich gilt: Kein neues Feld ist die **einzige** Quelle für eine Entscheidung, die v86 auch trifft.

### Veto 2: `vs/<seg>` fehlt im Bauplan, obwohl 8.3 den Wortschatz verfünffacht (L3, R3)

**Rechnung:** Heute gibt es etwa 200 Wortkarten (194 echte am 12.10.). 8.3 plant 60 neue Wörter je Woche (20 aktiv, 40 rezeptiv).
- Nach etwa **10 Wochen** stehen ~800 Karten in `vocab`. Ab da wird es eng: v86 abonniert die ganze Sammlung `vocab` (`LIVE_COLLECTIONS`), eine Abfrage liefert höchstens 1.000 Dokumente, und `live.ts` prüft nicht, ob gekappt wurde (Befund B1).
- Nach ~13 Wochen ist das 1.000er-Fenster überschritten. Ab da sieht v86 still nicht mehr alle Karten, und auch die neue App bräuchte Seitenabfragen.
- Bis C1 sind es 1.200 aktive plus 3.000 rezeptive Wörter, also 4.200 Dokumente. Dazu kommen 1.100–2.400 Dokumente im Jahr aus `log`, `daily`, `feed` und `read` sowie der heutige Bestand. Die Grenze von **5.000 Dokumenten je Artefakt wird sicher gerissen**, die eigenen Wächter sperren schon bei 4.300 (`docGuard.ts`).

16.1 sagt richtig „vor jedem Ausbau kommt `vs/<seg>`“. Der Bauplan 18 setzt aber in Stufe 2 die neue Wortlogik und mit Stufe 3/4 den Wortzuwachs um, ohne dass `vs` in irgendeiner Stufe vorkommt.

**Ersatztext für 18, Zeile „2 Wörter neu“, Spalte Inhalt** (an den Anfang):

> **Speichermodell zuerst:** Rezeptive Wörter liegen nur in Sammeldokumenten `vs/<seg>` (80–100 Karten je Teilstück, ~1,15 KB je Karte mit `lm`, < 128 KiB je Dokument, Wächter 200 KiB, Karten als Objekt-Abbildung `w:{<id>:{…}}`). Aktive Wörter bleiben einzeln in `vocab/<id>`, bis `vocab` + `chunk` 800 Dokumente erreichen, damit v86 sie sieht. Danach kommen auch neue aktive Wörter nach `vs`. Die App liest `vocab` und `vs` als eine Wortliste. `vs` wird in `paths.ts` registriert. Vorher: echte Dokumentzahl messen (Diagnose), Kappungstest bei 1.000 nachholen (`stand.md` W0, offen) und die Wächter (`docGuard`, `atlas/capacity`) auf das neue Modell umstellen.

**Ersatz in 19 (neuer Punkt 6):**

> **Rückweg und große Wortzahl:** Wörter, die in Sammeldokumenten liegen, sieht die alte Version v86 nicht. Sie sind aber nicht verloren und kommen mit der neuen Version zurück.

### Veto 3: Die Zeitbasis in 3.3 ist so nicht messbar (Machbarkeit)

**Was falsch ist:**
1. `firstKeyMs` wird heute in der Oberfläche gemessen (`ExerciseView`, `GrammarItem`, `useC1Item`), für Wörter aber **nirgends gespeichert**, nur in c1x (`domain/c1x/book.ts`). Eine „Median der Zeit bis zum ersten Zeichen in 30 Tagen“ hat also keine Datenquelle.
2. Beim **Diktieren** (6.1: Antworten in Block 5 und 6 standardmäßig gesprochen) kommt das erste Zeichen erst nach dem Sprechen, oft als ganzer Block. Die Zahl misst dann die Sprechdauer, nicht das Abrufen. Bei **Auswahl** ist sie gleich der Gesamtzeit. Ein gemeinsamer Median über alle Eingabearten würde diktierte Antworten als „zu langsam“ abwerten.

**Ersatztext für 3.3, Punkt „Zeitbasis“:**

> - **Zeitbasis:** Gespeichert werden je Versuch `hist[].fk` (ms bis zum ersten Zeichen), `hist[].ms` (bis Senden, ohne Nachschlagen) und `hist[].in` (getippt/diktiert/Auswahl), ebenso im `log`. **Zeitregeln gelten nur für getippte Antworten:** Median von `fk` bei richtigen, getippten Antworten ab S4 in 30 Tagen, global aus `log` und `hist` gerechnet; Startwert 4 s (Wort) bzw. 6 s (Wendung); über 45 s zählt als Unterbrechung. **Diktierte Antworten** bekommen keine Zeitwertung. Erkannt werden sie an einer Einfügung mehrerer Zeichen ohne Tastendruck; diese Erkennung ist eine Schätzung und wird als solche markiert (`in:'d'`). Die Aufzeichnung beginnt schon in Stufe 1, damit die Basis bei Stufe 2 aus echten Werten kommt.

### Veto 4: Die Umrechnung in 3.7 setzt Belege voraus, die es nicht gibt (Datensicherheit, ehrliche Zahl)

**Was falsch ist:** 3.7 leitet die neue Stufe aus „`hist` mit Modus, Hilfe und Note“ ab. Tatsächlich gilt:
- `hist` hat **höchstens 12 Einträge** (`HIST_MAX`).
- Einträge der alten App haben nur `{g, m, t}`. Aufgabenform `x` und Hilfe `h` gibt es erst seit dem Neubau, `h` wird nur gespeichert, wenn es größer als 0 ist.
- Im Verlauf steht **keine Zeit**. `ms` gibt es nur im gekappten `log` (Absendezeit), `fk` gar nicht.

Damit lassen sich „frei ohne Hilfe“ und die Zeitkriterien für alte Antworten nicht belegen. Eine Umrechnung, die so tut, würde Stufen erfinden.

**Ersatztext für 3.7, erster Punkt:**

> - Emrahs vorhandene Wörter bekommen ihre neue Stufe aus den **vorhandenen Belegen**, nach festen Regeln: frei oder Auswahl über die Eingabeart der Aufgabenform (`exerciseDef(x).input`); `m = recog` zählt als Auswahl. Alte getippte Antworten ohne `x` gelten als „frei, Hilfe unbekannt“ und tragen **höchstens bis S2**. S3 braucht zwei freie Tage mit bekannter Aufgabenform, S4 zusätzlich den alten Beleg `lg`, S5 den alten Beleg `ff` (21-Tage-Regel). Zeitkriterien werden rückwirkend **nicht** angewandt, weil der Verlauf keine Zeiten enthält. `ms` wird nur dort aus `log` nachgetragen, wo Zeitpunkt und Karte genau übereinstimmen, und nur im Trockenlauf gezeigt. Belege aus Auswahl zählen nicht für „bildest du“.

---

## 3. Datenplan konkret

| Neu | Pfad | Größe | Wachstum | Rückweg v86 | Stufe |
|---|---|---|---|---|---|
| Versuchszeit, Eingabeart | `vocab/<id>.hist[].{fk,ms,in}`, `log/<Tag>.entries[].{fk,in}` | +25 B je Eintrag | keins (`hist` ≤ 12, `log` gekappt) | fremde Felder bleiben in `hist` erhalten | 1 |
| Lernmodell | `vocab/<id>.lm` | ≤ 300 B je Wort | mit dem Wortschatz | v86 lässt `lm` stehen; `lm.at` erkennt Zwischenübungen | 2 |
| Rezeptive (später alle neuen) Wörter | `vs/<seg>` (neu, registriert) | < 128 KiB je Dokument | ~1 Dokument je 1,5 Wochen | für v86 unsichtbar, nicht verloren | 2 |
| Kapitel-Zustand | `grammar/<id>.ch` | ≤ 0,5 KB | 27 Themen | ignoriert | 3 |
| Fehlerschleife | `err/<JJJJ-MM>[-b]` (neu, registriert) | ≤ 200 KiB je Dokument | 12–24 Dokumente im Jahr | Spiegel nach `grammar.errors`/`app/repair` | 4 |
| Index offene Fehler | `app/errq` | < 1 KB | keins | ignoriert | 4 |
| Tagesplan, Startbild | `app/today` | ≤ 2 KiB | keins (ein Dokument) | ignoriert; `pflicht` gleich | 1 (Startbild), 4 (Blöcke) |
| Sprechkurve | `fluency/<Monat>`, `say/<Monat>` | wie heute | 1 je Monat (besteht) | gelesen wie heute | 4–5 |
| Diktat, Hören | `out/<Monat>` mit `k:'dict'`/`'hear'` | wie heute | 1 je Monat (besteht) | unbekannte `k` übergangen | 4 |
| Missionen | `talk/<Monat>.runs[].mis` | +0,5 KB je Lauf | 1 je Monat (besteht) | gelesen wie heute | 5 |
| Einstufung, Meilensteine, Kann | `app/c1.ms[]`, `app/c1.can` | ≤ 20 KiB | ≤ 30 Einträge | ignoriert | 6 |
| Elo, Hörstufe | `app/levels.k`, `app/levels.hear` | ≤ 10 KiB | keins | ignoriert | 4 |
| Wochen-Szenario | `app/week.sc` | < 1 KB | keins | ignoriert | 4 |

**Kapazität in Zahlen** (Grenze 5.000, eigene Sperre 4.300): Mit `vs` brauchen 4.200 Wörter bis C1 etwa 50 Dokumente statt 4.200. Die übrigen Ströme (`log`, `daily`, `feed`, `read`) wachsen um 1.100–2.400 Dokumente im Jahr und bleiben der Haupttreiber. Für sie gilt die bestehende Regel aus `07-datenleitplanken.md`: zusammenfassen statt je Eintrag ein Dokument.

---

## 4. Verbesserungen ohne Veto (8)

1. **Startbild (14.2) genauer formulieren:** „Das Skelett erscheint ohne Datenbank. `app/today` füllt es, sobald die Datenbank antwortet. Der Knopf ist in < 2 s bedienbar, gemessen mit dem Entwicklungs-Adapter und 4-facher CPU-Bremse; die Antwortzeit von claude.ai selbst liegt außerhalb unserer Hand.“ Optional darf ein `localStorage`-Zwischenspeicher das Thema des Tages als Hinweis zeigen, Zahlen bleiben bis zur Datenbank ein Skelett (3.1: Fortschritt nur in `db`).
2. **Mehr-Datei-Build als Standard** (14.2) ist laut Entscheidung vom 07.10. **Emrahs Entscheidung**. Er gehört als eigener Punkt in Abschnitt 19, statt in 14.2 als gesetzt zu gelten. Bis dahin ist der Einzeldatei-Build mit nachgeladenen `.bin` der Weg.
3. **Hörtempi (5.2):** Die Wörter pro Minute (130/155/170) hängen von der Stimme ab, nicht nur vom Tempo-Faktor. `speech.ts` teilt Texte in Stücke zu 150 Zeichen, dazwischen entstehen Pausen. Tempo daher je Stimme einmal messen (Wörter pro Minute) und daraus den Faktor wählen. Fremde Akzente nur, wo das Gerät die Stimme hat (heute: en-GB, en-IN, en-AU, Spaß-Stimmen gefiltert), und als „wenn vorhanden“ beschriften.
4. **Wörter pro Minute (6.4):** Messen von der ersten bis zur letzten Einfügung ins Feld, nicht ab Start, sonst zählt das Nachdenken mit. Jeder Wert trägt den Kanal (`in`), die Kurve vergleicht nur Werte desselben Kanals. Bei 4/3/2 (6.2) ist unklar, ob die Diktiertaste 3–4 Minuten am Stück annimmt. Rückfall: laut sprechen mit Zeitmesser, ohne Bewertung.
5. **Inhaltsmengen (8.6):** Zusammen etwa 2 MB Rohtext, gepackt ~0,5–0,7 MB. Ausliefern als `.bin` je Woche bzw. je Grammatik-Familie (≤ 500 KB, < 100 Dateien), nicht im Einstiegsstück. Geprüfte Beispielsätze bleiben im Bundle und werden **nicht** in `vocab/<id>.sb` kopiert (spart ~1 KB je Karte und bleibt korrigierbar).
6. **Schrift (12):** Die eingebettete Datei `inter-latin-standard-normal.woff2` (73 KB) hat schon die Achse für optische Größe. „Inter Display“ ist damit `font-variation-settings: 'opsz' 32` und **keine zweite Datei**. Bitte so festschreiben, sonst wächst das Einstiegsstück um weitere ~70 KB.
7. **Bauplan (18), vor Stufe 2 fertig:** (a) Rückweg-Test: Die v86-Datei läuft in E2E gegen Daten, die die neue Version geschrieben hat (Serie, Wörter, Kurs, Plan unverändert lesbar). (b) Zeitaufzeichnung aus Veto 3. (c) Neue Pfade in `paths.ts` registriert, damit Sicherung und Export sie enthalten. (d) Dokumentzahl gemessen. **Zwischen Stufe 2 und 4** darf es für „fällig“ nicht zwei Wahrheiten geben: Solange der alte Tagesplaner läuft, liest er die neue Wortlogik, nicht umgekehrt. Rückweg jeder Stufe ist die vorherige Live-Version, v86 bleibt lesbar, bis der Spiegel endet.
8. **Keine Satzwiederholung in 30 Tagen (3.5):** Mit 12 Verlaufseinträgen geht das nicht sicher. Dafür `lm.sx` = die zuletzt gezeigten Satz-IDs (≤ 8, mit Tag) vorsehen; ist schon im Feldplan von Veto 1 enthalten.
