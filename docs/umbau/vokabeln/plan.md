# Vokabeln: Plan für die neue Wörter-App (V0 → V1–V5)

Stand 31.10.2026 · Paket V0 · Fassung 2 (nach Prüfrunde 1: learning-scientist, english-teacher, architect, data-guard) · **zur Bestätigung durch Emrah**. Gebaut wird erst nach seinem OK.

Grundlagen: Emrahs Auftrag `../auftraege/vokabel-umbau-emrah.md` (Maßstab), `synthese.md` (V0a, 81 Methoden), `diagnose.md`, `ausgangsmessung.md`, `kennzahlen-echt.md`, Entscheidungen vom 30.10.2026 (Emrahs 5 Antworten, Vorschau als Untergrenze, keine Funktion fällt weg).

**Emrahs 5 Antworten gelten und werden nicht noch einmal gefragt:**
1. Lücke tippen zählt ab Tag 1 als Benutzen. Die 3-Tage-Schwelle gilt für die schweren Formen ab Stufe 4.
2. „Das wusste ich eigentlich“ ändert die Wertung nicht; es folgt eine neue Prüfung in einem neuen Satz.
3. 7 Stufen intern, 3 Gruppen sichtbar, Balken mit 7 Teilen.
4. Stufe 7: 2 eigene, geprüfte Sätze; bei Kernwörtern ist einer gesprochen.
5. Mindestens 2 neue Wörter je Lerntag, darüber nach Lernzeit bis zur Einstellung 0/2/5/10 (Standard 5).

---

## 0. Übertragung auf unsere Plattform (nicht verhandelbar)
- **KI:** „Claude-API über Cloudflare Worker“ wird zu `claude.use("sample")` im Artefakt, über das gemeinsame KI-Tor (`src/ai`). Es gibt keinen Server und keinen Schlüssel (Kap. 3.1).
  - **Ohne KI:** Die Transfer-Aufgabe zeigt Musterlösung und Selbstvergleich.
  - **Das ist keine Selbstbewertung für den Plan.** Ohne KI zählt die Transfer-Aufgabe nicht in die Spur Benutzen. Die beteiligten Lexeme behalten ihren Termin, und die Aufgabe bleibt nachholbar (Synthese W6; A7 „keine Selbstbewertung außer Anki“).
- **„PWA“:** nein. Die App bleibt Claude-Artefakt, mobil zuerst.
- **`docs/verlauf.md`:** Den Stand führt der Überchat in `docs/umbau/stand.md`; dieses Paket liefert den Bericht.
- **`docs/referenzen/`:** keine fremden Bilder im öffentlichen Repository, nur Links (`bildquellen.md`).
- **Tageswechsel** 04:00 Europe/Berlin (4.4). **US-Englisch**, britische Formen gelten als richtig.
- **„Das wusste ich eigentlich“ und die Begrenzung**, nach Emrahs Antwort 2: Die Abfrage bekommt keine Note, und das Wort steigt nicht ab. Es kommt nach 3–5 Karten in einem neuen Satz wieder; nur diese Antwort zählt.
  - Die Wiederkehr kommt kurz nach der gezeigten Lösung. Sie zählt deshalb mit **höchstens Hard**, und der nächste Termin ist **höchstens morgen**.
  - Höchstens einmal je Lexem und Lerntag, höchstens 3-mal je Sitzung. Eine wieder falsche Wiederkehr ist ein Fehler.
  - **Messung:** Die Trefferquote übersteuerter Wörter wird am **nächsten planmäßigen Termin** gemessen, nicht bei der Wiederkehr (M42). Unter 70 % wird das Ventil geprüft.

---

## 1. Ziel und Abnahme (Emrahs Auftrag §8, mit Messweg)
| Nr. | Abnahme | Messweg | Paket |
|---|---|---|---|
| 1 | Kein Lexem außerhalb der Lernschritte mehr als einmal am Tag. Die Last schwankt deutlich weniger. Nichts Fälliges bleibt unbegrenzt liegen. | `node scripts/vocab/simulate.mjs --adapter v1`: gleiche Szenarien, 5 Startwerte, schlechtester Wert. Mitsimuliert werden Nebenwege und Szenario D (Start mit Rückstand). Dazu `tests/unit/vocab/simulation.test.ts` in G0. | V1 |
| 2 | ≥ 50 % aktive Abfragen ab Stufe 3; Auswahl nur in Lernschritten | Simulation und Unit-Test; zusätzlich 30–40 % ohne Satz ab Stufe 4 | V2 |
| 3 | Jedes Lexem zeigt Stufe und nächste Wiederholung für beide Spuren | Bild H12 `detail` (B2); Unit: angezeigtes Datum = gespeichertes `due` | V4 |
| 4 | Transfer-Aufgabe mit und ohne Claude | Unit (ohne Claude keine Planwirkung); Bild H38 beider Varianten | V4 |
| 5 | Unit-Tests für Planer, Geschwister-Regel, Lastausgleich, Bewertungsableitung, Stufenwechsel grün | `npm run verify:fast`, Ordner `tests/unit/vocab/` | V1, V2 |
| 6 | Emrah hat Lernkarte und Dashboard am Handy gesehen und abgenickt | Zwischenbilder vor dem Bau, Test-Link nach V3 und V4 | V3, V4 |

**Zielwerte der Simulation** (Einzelheiten und heutige Werte in `ausgangsmessung.md`):
| Kennzahl | Ziel |
|---|---|
| mehrfach am Tag **durch den Planer** außerhalb der Lernschritte | 0. Mehrfach nur durch Emrahs eigenen Start, ohne Planwirkung, wird getrennt berichtet. |
| Variationskoeffizient der **Pflicht**minuten | ≤ 0,15 (A, B), ≤ 0,2 (C nach Abbau). Am Tag nach einer Extra-Runde ist die Pflicht nicht länger als im Mittel. |
| 14-Tage-Vorschau in Minuten: größter Tag ÷ Mittel | ≤ 1,5 |
| Rückstand nach 7 Tagen Pause | Abbau in ≤ 7 Lerntagen, kein Lexem mehr als 3-mal verschoben |
| Auswahl außerhalb der Lernschritte | 0 %; Auswahl ändert FSRS nie |
| ohne Satz ab Stufe 4 | 30–40 % |
| Tage mit ≥ 2 neuen Lexemen | 100 % |
| Transfer | ≥ 1 je Lerntag, sobald es Lexeme ab Stufe 4 gibt |
| echte Behaltensrate | Zielquote ± 3 Punkte |
| Ertrag und Haltbarkeit je Lernstunde | ≥ heute |

---

## 2. Die Wörter-App als eigenes Modul
Emrah: „eine komplett neue Wörter-App als eigenes Modul in der Webapp, nicht Reparaturen am alten Wörter-Bereich“.

### 2.1 Ordner und Grenzen
```
src/modules/vocab/
  api.ts            Tür nach außen (2.2); Bildschirme nur per dynamischem Import (Ladezeit)
  shared.ts         Tür nach innen: Erlaubnisliste dessen, was das Modul aus src/ nutzt (Writer, KI-Tor, date, platform, ui)
  domain/           rein und testbar: lexeme, tracks, planner, fuzz, balance, ladder, grade, typo, leech, session, transfer, pick
  data/             Pfade, zod-Schemas, Schreib-Operationen über den EINEN Writer (src/data/writer.ts), Umrechnung
  ui/               Lernkarte, Sitzung, Abschluss, Wort-Detail, Liste, Dashboard, Einstellungen, Hinzufügen
  content/          Wortlisten mit Lizenzdatei, Lehrer-Chargen (Deutsch-Fallen, Funktionswendungen, Muster)
src/prompts/        vocab-transfer@1, vocab-own-sentence@1, vocab-meaning@1 (registriert in registry.ts, wie Kap. 3.4)
tests/unit/vocab/   eigene Tests, auch isolation.test.ts und simulation.test.ts
scripts/vocab/      Simulation (adapter-current.ts = heute, adapter-v1.ts = neu)
```
**Grenzen im Code**, nach dem Vorbild des Lesen-Moduls (`eslint.config.js:215-275`, `tests/unit/read/isolation.test.ts`):
- `VOCAB_DOOR_PATTERN` (Regex `(^|/)modules/vocab/(?!api$)`) wird **in jedem** vorhandenen `no-restricted-imports`-Block wiederholt, weil ESLint je Datei nur einen Block anwendet.
- Ausnahmen gelten für `scripts/vocab/**` und `tests/unit/vocab/**`.
- Nach innen darf das Modul nur über `shared.ts` importieren. `isolation.test.ts` prüft beide Richtungen. Vor allem gibt es **keinen Import aus `src/domain/srs`**: Das Modul ist neu, keine Reparatur am Alten.
- Zähler für Heute (fällig, neu) kommen aus `api.ts`. Dafür bekommt `archGuards.test.ts` (Regel „Karten nur über `domain/metrics`“) eine benannte Ausnahme für `modules/vocab`.
- **Schreibgrenze:**
  - Eine Erlaubnisliste nennt, wer nach `vocab/*`, `chunk/*` und `vlog/*` schreiben darf, jeweils mit Ablaufpaket:
    - `features/vocab/**` und `domain/srs/**` nur bis V5 (alter Bereich, Rückweg),
    - `domain/migration/**` dauerhaft,
    - Import/Export dauerhaft.
  - Dazu ein Präfix-Wächter im Test-Writer, der den Aufrufer meldet. Er ist nur im Testbuild aktiv.
  - Neuanlage aus Wort-Popup, Lehrer, Lesen und C1-Aufgaben geht ab V1 über `addLexeme`.
- **Ladezeit:** Je Paket wird der Zuwachs vorab in `scripts/budget.json` genannt, und das Modul ist ein eigenes, nachgeladenes Stück (`lazy`).
  - `todayBlock` liest nur das eingefrorene `vmod/day` und braucht keinen Planer-Code in der Einstiegsdatei (Start ≤ 2 s, Kap. 14).
  - Bis V5 liegen alter und neuer Bereich doppelt im Build; `verify:single` bleibt unter 16 MB.

### 2.2 Schmale Schnittstellen (`api.ts`)
| Funktion | wer nutzt sie | was sie tut |
|---|---|---|
| `todayBlock(now)` → `{min, due, fresh, why, done}` | Heute | Wörter-Block mit Zeitbudget („Wörter · ca. 14 Min.“, „11 fällig, die gefährdetsten zuerst · 3 neue“), eingefroren je Lerntag |
| `startSession(kind)` mit `kind` = `pflicht` \| `more5` \| `free` \| `evening` \| `week` \| `word` \| `mistakes` | Heute, Wörter, Wochen-Check, Wortblatt | Nur das Modul baut die Runde. Jede Art läuft durch dieselbe Tagesmarke. |
| `findLexeme(text)` → `LexemeRef \| null` | Lesen, Grammatik, Praxis, Wort-Popup | Lexem-ID zu einem Wort oder einer Wendung, auch für die Markierung im Lesetext (M59) |
| `addLexeme(input)` | Wort-Popup, Lehrer, Lesen, eigene Eingabe, C1-Aufgaben | neues Lexem mit Ursprungssatz (Pflicht, Kap. 15). Die Einführung plant das Modul. |
| **`reportEvidence(e)`** | Grammatik, Lesen, C1-Aufgaben, Praxis, Sprechen | **die eine Meldefunktion**, siehe unten |
| `lexemeState(id)` | Fortschritt, Tutor, alte Zähler (solange das Modul an ist) | Stufe, Gruppe und beide Termine (nur lesen) |

**`reportEvidence`:** `e = {lexeme, kind: 'seen' | 'recalled' | 'used', src, ok, typed, cued, text?, t}`.
- Andere Bereiche **planen nie**. Das Modul entscheidet allein über die Wirkung.
- **Planwirkung** nur, wenn alle vier Bedingungen gelten:
  - `kind` ist `recalled` oder `used`,
  - die Antwort war getippt,
  - das Lexem war in der Aufgabe **nicht sichtbar** (`cued: false`; ein vorgegebenes Schlüsselwort ist kein Abruf),
  - an diesem Tag gab es noch keine Planwirkung, und die Abrufwahrscheinlichkeit der Spur liegt unter 0,95.
- Dann gilt: richtig → Good, **falsch → Again**. Fehler aus anderen Bereichen kürzen den Termin; sonst würde der Plan nur verlängern und die Behaltensrate geschönt.
- Alles andere ist ein Beleg im Verlauf ohne Planwirkung (N6).

**Damit ist die Klumpen-Ursache „Wörter tauchen außerhalb des Planers auf“ geschlossen.**
- Abend-Check, Wochen-Check, „Dieses Wort üben“, „Fehlwörter von heute“ und Extra-Runden laufen über `startSession`.
- C1-Aufgaben (`c1x/lexWrite.ts`) und künftige Bereiche melden über `reportEvidence`.
- Die **Tagesmarke** je Lexem (`lex.day`) erlaubt eine Planwirkung je Lerntag; jede weitere Antwort steht nur im Verlauf.
- Ausnahme: die Lernschritte (4.3).
- Die Marke einer **Anki-Runde** sperrt nur die Spur Verstehen, nie Benutzen (5).

---

## 3. Datenmodell

### 3.1 Lexem
Ein Lexem ist ein Wort, ein Phrasal Verb, eine Kollokation oder ein Chunk (Emrah 4.1).

**Ablage (Empfehlung, Frage F1):** im bestehenden Dokument `vocab/<id>` bzw. `chunk/<id>` als neues Feld **`lex`**. Damit gibt es keine zusätzlichen Dokumente je Lexem, und Inhalt und Herkunft bleiben, wo sie sind. Der Name `lex` ist gewählt, weil `lx` in `lessonSchema` und `profile.days[].lx` schon etwas anderes bedeutet (data-guard, Befund 8).

```
lex: {
  v: 1,                           Schema-Version des Moduls; eine höhere Version wird nie zurückgeschrieben (wie isFutureFsrs)
  k: 'w' | 'pv' | 'col' | 'ch',   Art: Wort, Phrasal Verb, Kollokation, Chunk
  of: '<vocab/… | chunk/…>' | null,  Doppel: Pfad des führenden Lexems (nur Verweis, nie Löschen; null = eigenständig)
  core: '<lexem>' | null,         Kernwort einer Kollokation/Wendung (Geschwister im Lastausgleich, 4.2)
  sense: '<lexem>' | null,        weiterer Sinn eines mehrdeutigen Worts (M62), verknüpft
  lv: 1..7,                       Stufe (intern 7, sichtbar 3 Gruppen)
  u: Track,                       Spur Verstehen
  b: Track | null,                Spur Benutzen (null = noch nicht angelegt)
  day: 'JJJJ-MM-TT' | null,       Tagesmarke (Lerntag der letzten Antwort mit Planwirkung)
  dayU: 'JJJJ-MM-TT' | null,      Tagesmarke nur für Verstehen (Anki-Runde)
  step: {n, at, gap} | null,      laufender Lernschritt; nach Ende null (Felder werden nie gelöscht, nur auf null gesetzt)
  ev: {f: ['JJJJ-MM-TT', …≤ 8], o: n, s: n},   Belege: Tage mit freiem Abruf, eigene geprüfte Sätze (ab Stufe 5), gesprochene Sätze
  sn: [['satzKey', 'JJJJ-MM-TT'], …≤ 12],      zuletzt gezeigt je Satz; Array, wird als Ganzes ersetzt (Grenze hält)
  gr: {pat?: 'discuss sth', cnt?: 'u'|'c'|'uc', sep?: 0|1, var?: ['at short notice', …]} | null,  Wortmuster, Zählbarkeit,
                                  Trennbarkeit (Umstellform nur bei sep: 1), Varianten (Auch richtig); vom Lehrer geprüft
  reg: 'f' | 'n' | 'i' | null,    Stilebene (M80)
  pri: 'core' | 'edge',           Kern- oder Randwort (M21)
  lc: n, pair: '<lexem>' | null,  Fehlerzahl (Leech), Verwechslungspartner (M14)
  mv: n,                          so oft wegen Rückstand verschoben (≤ 3, M13)
  sync: ms,                       Zeitpunkt der letzten Antwort, die das Modul kennt (Rückweg, 9.4)
  mig: {t, from: 'srs1', h: n, full: 0|1} | null   Umrechnung: Zeitpunkt, Quelle, nachgespielte Antworten, Verlauf vollständig?
}
Track = { due, s, d, st, reps, lapses, last, sd, ls }   wie FsrsStored (ts-fsrs 5), kurz benannt
```

- **Sätze:** Die vorhandenen Felder bleiben die Quelle: `ex` (Ursprungssatz), `xEx`, `wx`, `col[].ex` und die Satzbank. Jeder Satz hat einen festen Schlüssel (wie `hist[].s` heute). Kein Lexem ohne Ursprungssatz (Kap. 15).
- **Schemas** (data-guard, Befund 2; Paketinhalt V1):
  - `lexSchema` (`looseObject`, Prüfung von `v`),
  - `vlogSchema`, `vmodSchema`,
  - `vcfg` in `profileSchema`.
  - `lex` kommt als `optional()` in `cardPatchSchema` und `chunkPatchSchema`. Das `.refine` auf `fsrs.last/due` bleibt.
  - `vlog` und `vmod` kommen in `COLLECTIONS` bzw. `APP_DOCS` (Sicherung, Export), `vmod/day` in `REPLACEABLE` (`writer.ts:85`).
  - Test: Ein Patch mit `lex` besteht, ein Patch mit fremdem Feld scheitert weiter.
- **Alte Felder bleiben stehen und werden gespiegelt** (Kap. 9, Regel 2 und 5). Das geschieht erst **bei der nächsten Antwort mit Planwirkung**, nie durch die Umrechnung selbst (9.1).
  - `mirrorLegacy(lex)` schreibt `fsrs`, `S`, `D`, `due`, `stage`, `state`, `reps`, `lapses`, `last` und `hist` aus der **führenden Spur**. Führend ist Benutzen, wenn angelegt, sonst Verstehen.
  - Dabei gelten die heutigen Schemaregeln:
    - `fsrs.v = 1`, `fsrs.src = 'lx'`, `fsrs.last === last`, `fsrs.due === due`;
    - `state` `learning` (FSRS 0/1/3) oder `review` (2);
    - `S ≤ 365`, `D` 1–10, `stage` 5–7 → 5;
    - `hist` ≤ 12 mit `histNewEntrySchema`; `st` ≤ 5.
  - Ein Eigenschafts-Test schickt alle Stufen 1–7 × beide Spuren durch `cardPatchSchema`.
  - So zeigen alte Leser (Heute, Fortschritt, v86-Rückweg) weiter Sinnvolles, und der Rückweg bleibt möglich.

### 3.2 Zwei Spuren
- **Verstehen (u)** gibt es ab der Einführung.
- **Benutzen (b)** wird mit dem **ersten freien getippten Abruf** angelegt, an jedem Tag, nicht nur an Tag 0. Nach Emrahs Antwort 1 zählt die getippte Lücke ab Tag 1 als Benutzen.
- Die **schweren Benutzen-Formen ab Stufe 4** (deutscher Chunk → Englisch, Variieren, eigener Satz) brauchen `u.s ≥ 3 Tage` (konfigurierbar). Steht ein Lexem auf Stufe 4, aber mit `u.s < 3`, kommen Formen der Stufe 3.
- **Kopplung, nur nach oben** (learning-scientist, Befund 1):
  - Good oder Easy auf Benutzen bucht dieselbe Note auf Verstehen, Hard bucht Hard.
  - **Again auf Benutzen bucht auf Verstehen nichts.** Wer die Form nicht bilden kann, hat das Wort meist trotzdem verstanden.
  - Ausnahme: Der Ausgang „anderes Wort“ oder im Transfer „falscher Sinn“ bucht Again auch auf Verstehen.
  - Eine Antwort auf Verstehen zählt nie für Benutzen.
- Emrahs Regel „sind beide fällig, nur eine abfragen, die andere um einen Tag verschieben“ gilt so:
  - Sind **beide** fällig, kommt Benutzen; Verstehen ist damit nach der Kopplung gebucht.
  - Ist **nur Verstehen** fällig, kommt eine Verstehen-Form, nie eine Auswahl:
    - Bedeutung frei nennen, geprüft zuerst gegen die Bedeutungsliste des Lexems, Claude nur bei „War das auch richtig?“;
    - ohne KI und ohne Treffer in der Liste: Ton → tippen.
  - Liegen beide Termine auf Folgetagen, wird Verstehen auf einen freien Tag im Korridor gelegt (Geschwister-Faktor, 4.2).

### 3.3 Stufen 1–7
Wie `synthese.md` §2.3, mit Emrahs Antworten 3 und 4.
- **Gruppen:** „erkennst du“ (1–2), „auf dem Weg“ (3–5), „bildest du selbst“ (6–7).
- **Aufstieg** nur an einem Aufstiegs-Tag, also eine fällige Antwort mit Good oder Easy, ohne Hilfe; ein reiner Tippfehler zählt mit. Dazu muss die Schwelle der Spur erreicht sein:
  - 2 → 3: Abruf B frei richtig
  - 3 → 4: 2 Tage
  - 4 → 5: 3 Tage und `b.s ≥ 7`
  - 5 → 6: `b.s ≥ 21`
  - 6 → 7: Bedingung aus Synthese 2.3 und Emrahs Antwort 4
- Ein **eigener Satz zählt für `ev.o` und Stufe 7 nur**, wenn das Lexem beim Schreiben mindestens auf Stufe 5 stand. Frühere Sätze sind Belege ohne Wirkung auf Stufe 7 (english-teacher, Befund 11).
- **Abstieg:** bei einem Fehler eine Stufe, nie unter 2, mit Lernschritt. Ein zweiter Versuch und „Das wusste ich eigentlich“ kosten keine Stufe.

### 3.4 Vollständiger Verlauf ab V1
**`vlog/<JJJJ-MM>-a`** (Lerntage 1.–15.) und **`-b`** (16.–Monatsende). Monat, Hälfte und Zeit richten sich nach `dayKey(t)`, also nach dem Lerntag mit Wechsel um 04:00.

- **Form: Objekt-Map, kein Array** (architect, Befund 1). `{v: 1, e: {"<t base36>-<geräteKennung 4>": Tupel}}`.
  - Ein neues Halbmonatsdokument wird zuerst angelegt, wenn es fehlt (`createIfMissing`, denn `update` verlangt ein vorhandenes Dokument). Danach wird mit `writer.update({e: {[key]: Tupel}})` geschrieben. Laut `db.d.ts` werden verschachtelte Objekte zusammengeführt. Schreiben Handy und Laptop gleichzeitig, verliert keiner, und doppelte Schlüssel heben sich auf. Das macht auch die Übertragung in der Umrechnung idempotent.
  - „Rückgängig“ setzt den Schlüssel auf `null`.
  - Antworten werden gebündelt und je Pause einmal je Dokument geschrieben, nie aus Render oder Zeitgeber.
- **Tupel:** `[t, "lexemPfad", spur 0|1|2 (u|b|beides), "art", note 0–4 (0 = ohne Planwirkung), ausgang, ms, fk, hilfe 0–3, "satzKey", stufe 1–7, flags]`.
  - `ausgang` ist einer von: richtig, Tippfehler, Beugung, Wortart, anderes Wort, Synonym, Ausweichwort, Kollokation, falsch, weiß nicht.
  - `flags` ist eine Bitmaske: Lernschritt, Override, unfair gemeldet, Anki, Beleg aus anderem Bereich, ohne KI, umgerechnet.
  - Damit sind alle Felder da, die Emrah in §7 verlangt: Zeitpunkt, Übungstyp, Spur, Ergebnis, Antwortzeit, Hinweis und abgeleitete Bewertung. FSRS lässt sich später auf Emrahs Daten anpassen, ab 1.000 Antworten je Spur (M19).
- **Fortsetzung:** Über 200 KiB geht es in `-a2`, `-a3` … weiter. Den offenen Namen führt `vmod/stats.cur`; Leser fragen mit Präfix ab.
- `log/<Tag>` bleibt (Tagesauftrag, Serie, Wochenbericht). `vlog` ersetzt es nicht.

### 3.5 Weitere Daten
| Pfad | Inhalt | Art |
|---|---|---|
| `app/profile.vcfg` | `{min: 10\|15\|20\|30, ret: 0.85\|0.9\|0.95, mod: 0\|1, w: {col, job, own, band}}`. `mod` ist der Rückweg-Schalter in der Datenbank, gilt auf allen Geräten (9.4). `w` sind die Gewichte der Wortauswahl (8). `newPerDay` bleibt (0/2/5/10). | über `app/actions`, optimistisch mit Rückrollen |
| `vmod/day` | `{d, plan: [[lexem, spur, form]…], min, why}`, eingefroren je Lerntag | `REPLACEABLE`, ableitbar, 1 Dokument |
| `vmod/stats` | Median-Zeiten je Form, echte Behaltensrate, `cur` (offenes `vlog`-Dokument), Dokumentzahl | im selben Schreibschritt wie `vlog` aktualisiert, 1 Dokument |
| `app/schema.vocabModule` | `{v: 1, t, state: 'dry' \| 'running' \| 'done'}` | Versionsmarke der Umrechnung (9.1) |

### 3.6 Kapazität (A6 Nr. 6: ≤ 5.000 Dokumente, ≤ 256 KiB je Dokument)
| Teil | Größe | Rechnung | reicht |
|---|---|---|---|
| `lex` je Lexem | ≈ 0,8–1,4 KB (zwei Spuren je ≈ 120 B, Belege, `sn` ≤ 12 × 25 B, `gr`) | Kartendokument heute ≤ 64 KiB (`MAX_CARD_BYTES`), typisch 2–6 KB | ja |
| `vlog`-Eintrag | ≈ 90–125 Byte (Tupel 75–110 B + Schlüssel ≈ 15 B) | Emrahs Mittel 41 Abfragen/Tag × 15 Tage → ≈ 615 Einträge → **≈ 75 KB**; Höchstwert 98/Tag → 1.470 → **≈ 185 KB** | ja, < 256 KiB; über 200 KiB Fortsetzung |
| `vlog`-Dokumente | 24 im Jahr | 10 Jahre = 240 | ja |
| `vmod/day`, `vmod/stats` | je < 8 KB | 2 Dokumente | ja |
| **Lexem-Dokumente** | 1 je Lexem (wie heute) | Bei 5 neuen je Tag ≈ 1.800 im Jahr; dazu `log/<Tag>` 365 im Jahr. | siehe unten |

**Wann die Grenze kommt:**
- Die **heutige Gesamtzahl** der Dokumente steht nicht im Repository. V1 liest sie aus der Diagnose-Ansicht (`app/profile.history[].dc`) und trägt sie in den Bericht ein (N8).
- Bei angenommenen ≈ 1.000 heute läge die Grenze nach ≈ 1,8 Jahren.
- `db.d.ts` rät außerdem, Sammlungsabfragen bei „hundreds to low thousands“ zu halten.

**Gegenmittel:**
- **Neue** Lexeme entstehen ab V5 gleich in Bündeldokumenten `vlex/<n>`: ≤ 150 Lexeme je Dokument, ≈ 1,2 KB je Lexem, also ≈ 180 KB.
- Bestehende Dokumente werden **nie verschoben oder gelöscht** (Kap. 9 Regel 1; `writer.ts` kennt kein Löschen).
- Warnschwellen in der Diagnose: 4.000 und 4.500. Wird es trotzdem eng, entscheidet Emrah, keine Automatik.

**Ergebnis:** Der Verlauf kostet 24 Dokumente im Jahr statt ≈ 15.000 bei einem Dokument je Antwort.

---

## 4. Planer (V1)

### 4.1 ts-fsrs: Version festlegen
**Entscheidung: `ts-fsrs` exakt 5.4.2.** Heute steht in `package.json` `^5.4.2`; das wird auf `5.4.2` geändert, ein Unit-Test prüft die Version.

Gründe:
1. ts-fsrs 6 schaltet still auf FSRS-7 mit neuen Standardgewichten und anderer Kurzzeit-Logik um (V0a, Synthese M1). Die umgerechneten Stände und die Ausgangsmessung beruhen auf ts-fsrs 5.
2. Ein Wechsel wäre eine zweite Änderung gleichzeitig mit dem Umbau. Dann wäre nicht mehr messbar, was die Verbesserung bewirkt.
3. Ein Wechsel auf 6 kommt erst nach 1.000 Antworten je Spur, nach eigener Simulation (alte gegen neue Version, gleicher Lerner) und mit Emrahs OK.

### 4.2 Ablauf je Antwort mit Planwirkung
1. **Note** aus dem Ergebnis (V2, §5).
2. **Höchstens eine FSRS-Buchung je Spur und Lerntag** (learning-scientist, Befund 2; architect, Befund 3):
   - Gebucht wird die erste Antwort mit Planwirkung. Bei neuen Lexemen ist das das Ergebnis von Schritt B.
   - Weitere Antworten am selben Tag (Lernschritte, Wiederkehr) ändern nur Stufe, Verlauf und den nächsten Termin, höchstens auf morgen.
   - Tests: „drei Antworten am selben Tag → genau ein `reps++`“ und „4 × Again an einem Tag → dasselbe `d` wie 1 × Again“.
3. **FSRS** der Spur mit Kopplung (3.2) und Zielquote aus `vcfg.ret` (Standard 0,9). `enable_fuzz: false`, denn die Streuung macht Schritt 5. `enable_short_term: false`, denn die Lernschritte macht das Modul (4.3).
4. **Abstands-Deckel** 1 / 3 / 7 / 21 Tage nach den Tagen mit freiem Abruf (M77, wie heute `spacing.ts:23`).
5. **Fuzz** nach Ankis Formel ab 2,5 Tagen, mit festem Startwert aus Lexem-Kennung und Wiederholungszahl (M10).
   - **Ist ein Deckel aktiv, ist der Korridor einseitig:** von Deckel minus Fuzz-Breite bis zum Deckel. Bei Deckel 1 Tag wird nicht gestreut.
   - Test: kein Termin über dem Deckel.
6. **Lastausgleich im Korridor** nach Anki: Gewicht (1/Last)² · (1/Intervall), nur bis 90 Tage (M11).
   - Gerechnet wird in **erwarteten Minuten**, mit Median-Zeiten je Form aus `vmod/stats`.
   - **Geschwister** meiden den Tag (Gewicht 0,000001) und die Nachbartage (0,2 / 0,4): die andere Spur, Verwechslungspartner (`pair`) und **Kernwort ↔ Kollokation** (`core`; *decision* ↔ *make a decision*, english-teacher Befund 9).
   - **Ruhetag** (A7) als „Easy Day“ mit Faktor „Minimum“.
7. **Tagesmarke** setzen, ein **Verlaufseintrag** in `vlog`, die alten Felder spiegeln (3.1).

### 4.3 Lernschritte (M9, W3)
- **Neu:** Einführung → **Schritt A** nach ≥ 3 anderen Karten → **Schritt B** nach ≥ 8 Karten **und** ≥ 3 Min.
- **Nach einem Fehler:** Wiederkehr nach 3–5 Karten, frei, in neuem Satz oder ohne Satz (M49, M53). Höchstens 4 Versuche je Lexem und Tag, danach morgen wieder ohne Stufenverlust.
- **Endet die Sitzung vorher:** Der Schritt geht in die nächste Sitzung desselben Lerntags, sonst an den Folgetag.
- Lernschritt-Antworten stehen in `vlog` (Flag „Lernschritt“) und in `lex.step`. FSRS buchen sie nur nach 4.2 Nr. 2.
- **Nur Lernschritte** dürfen ein Lexem am selben Tag mehrfach zeigen. Ein Abend-Check mit heute Eingeführtem zählt als Lernschritt.

### 4.4 Tagesplan
- **Tageswechsel 04:00 Europe/Berlin, eine einzige Datumsquelle** (architect, Befund 4):
  - Das Modul nutzt nur `dayKey` und `learningDayStart` aus `src/domain/date.ts`.
  - Damit „Europe/Berlin“ (Emrah 4.2) überall gilt, auch für Serie, `log/<Tag>` und Pflicht, stellt **V1 `date.ts` zentral** auf die Zeitzone Europe/Berlin um (`Intl.DateTimeFormat` mit `timeZone`). Das läuft als eigener, kleiner Schritt mit data-guard.
  - Tests mit TZ ≠ Berlin, an den Tagen der Zeitumstellung und um 03:59/04:00, mit gleicher Serie vor und nach der Umstellung.
  - Für Emrah in Deutschland ändert sich nichts Sichtbares.
- **Fällige** nach Abrufwahrscheinlichkeit (gefährdetste zuerst), Kernwörter vor Randwörtern (M13, M21).
- **Neue Lexeme:**
  - Mindestens 2 an jedem Lerntag, auch bei Rückstand. Darüber so viele, wie das Minutenbudget erlaubt, höchstens das Kontingent. Bei Kontingent 0 kommen keine (Emrahs Antwort 5, M12).
  - Eingestreut: das erste nach 3–5 Wiederholungen, das letzte spätestens bei 50 % der Sitzung (M72).
  - Nie zwei verwechselbare neue am selben Tag, und nie eine Kollokation am Einführungstag ihres Kernworts.
- **Zielzeit** 10/15/20/30 Min., Standard 15 (Frage F5). „Noch 5“ nimmt nur Fälliges oder Neues, nie heute Gesehenes.
- **Rückstand:**
  - Höchstens 2 Tagesbudgets je Tag.
  - Der Rest wird nach Gefährdung auf die nächsten Tage verteilt.
  - Nur Randwörter werden verschoben, jedes höchstens 3-mal (M13).
- **Leech:** Ab 6 Fehlern bekommt das Lexem eine neue Darstellung: neuer Satz, Merkhilfe, Kontrast. Dazu gibt es die Paar-Regel und die Kontrastkarte für falsche Freunde (M14). Die Werkstatt ab 2 Fehlern in 30 Tagen bleibt (W5).
- Der Plan ist **für den Lerntag eingefroren** (`vmod/day`, Kap. 15).

---

## 5. Bewertung, Übungsformen, Stufenleiter (V2)
Wie `synthese.md` §2.2–2.3 und M22–M45, M56, M78–M81.

**Note:**
- Falsch oder Lösung gezeigt → Again.
- Hinweis, sehr langsam (> 2 × Median der Zeit bis zum ersten Zeichen) oder ein Tippfehler → Hard.
- Richtig → Good.
- Easy: schnell (< 0,6 × Median), nur ab Stufe 5, fällig und älter als 21 Tage.
- Die ersten 20 Antworten je Form wirken nicht über die Zeit (M38, M39).

**Weitere Regeln:**
- **Auswahl ändert FSRS nie.** Sie gibt es nur in den Lernschritten und als Rettung nach einem Fehler (M2, M23, W7).
- **Anki-Modus** bleibt freiwillig (A7). Er wirkt **nur auf Verstehen**, nie auf Benutzen und nie auf einen Aufstieg ab Stufe 3 (Frage F3).
  - Eine Anki-Runde setzt nur `dayU`. Die getippte Benutzen-Abfrage am selben Tag bleibt also möglich (learning-scientist, Befund 5).
- **Tippfehler-Regeln** (a)–(h) mit fester Prüfreihenfolge (M40), dazu „Auch richtig“ und Ausweichwort (M41).
- **Varianten:** Alles aus `gr.var` gilt als „Auch richtig“.
- **Kollokationsfehler** nach M56 je Art `k`: Ist das Lexem selbst die Kollokation (`k: 'col'`), gibt es Again. Ist es das Einzelwort, gibt es Hard, und das Partner-Lexem wird markiert.
- **Präposition, Zählbarkeit und Partikel** (M78, M79, M81) nur mit geprüften Daten aus `gr`. Die Umstellform (*set it up*) gibt es nur bei `sep: 1` (nie bei *look after it*, *deal with it*).
- **Formen je Stufe:** mindestens 2. Gewählt wird die mit der niedrigsten Trefferquote, außer sie kam zuletzt. Keine Form zweimal in Folge. Ab Stufe 4 ist jeder 3. Abruf ohne Satz, als deutscher Chunk (M22, M27).
  - Die deutsche Vorgabe ist so geschrieben, dass nur eine Lösung passt (Lehrer-Charge, english-teacher Befund 12).
- **Spur je Form** (Unit-Tabelle: jede Art mit Spur und höchster Note, english-teacher Befund 2):

| Form | Spur | höchstens |
|---|---|---|
| Lücke frei, ohne Satz tippen, Wortpartner tippen, Wortfamilie, Situation, deutscher Chunk → Englisch, eigener Satz, „Sag es“ (erkannt), Transfer | Benutzen (+ Verstehen nach Kopplung) | Easy |
| Lücke mit Anfangsbuchstabe, Teil einer Wendung frei (`cloze_part`), Satz vervollständigen | Benutzen | Hard |
| Hören → tippen, Diktat | Verstehen (Klang und Schreibung, kein Abruf aus der Bedeutung) | Good |
| Bausteine (`tiles`, nur Wendungen) | Verstehen | Hard |
| Bedeutung frei nennen, Ton → Bedeutung | Verstehen | Easy |
| Aufdecken (Anki) | Verstehen | Easy (Selbsturteil, A7) |
| Auswahl jeder Art, `find_trap`, Kontrast | keine | – |

- **„Aufgabe war unfair“:** ohne Planwirkung, geht in die Inhaltsprüfung (M43).
- **Inhalt schon in V2** (english-teacher, Befund 4): drei Lehrer-Chargen, je höchstens 40 Einträge, 100 % english-teacher:
  1. **Deutsch-Fallen** (≈ 60–80): *eventually/actual/become/sensible*, *make/do*, *say/tell*, *borrow/lend*, *by/until*, *discuss (about)*, *informations/advices*, *possibility/opportunity*.
  2. **Business-Funktionswendungen** (≈ 150): Hedging (*I'd argue that …*), Diskursmarker (*that said*), Verhandlung, Einwand-Behandlung (*if I understand you correctly*), E-Mail-Wendungen, dazu DMS/ECM-Fachsprache (*audit trail*, *retention policy*, *rollout*, *procurement cycle*).
  3. **`k` und `gr` je Bestands-Lexem** (Muster, Zählbarkeit, Trennbarkeit, Varianten). Erst danach schaltet V2 die Formen M78–M81 frei.

## 6. Sitzung, Lernkarte, Abschluss (V3)
Ablauf nach Emrah §5: fällig → neu eingestreut → Anwenden → Abschluss.

**Lernkarte** nach Synthese 2.2:
- Der Satz ist groß, die Lücke ist das Eingabefeld, die Tastatur ist sofort offen und die Autokorrektur aus. Enter prüft.
- Ton normal und langsam. Tipp zeigt den ersten Buchstaben.
- **Ein Rückmeldeband:**
  - Urteil, Diff (nur nach Fehler), Warum (auch bei richtig).
  - 2 Wortpartner und „Kommt wieder: Mo, 9.11.“.
  - „Mehr“ (Übersetzung, weiterer Beispielsatz) und „War das auch richtig?“.
  - Nach einem Fehler zusätzlich „Das wusste ich eigentlich“.

**Abschluss:** heute gelernt · aufgestiegen · gestolpert (mit Termin) · „morgen ca. X Min.“; dazu „Fertig“ und „Noch 5“.

## 7. Transfer, Wort-Detail, Dashboard (V4)

**Anwenden** (2–4 Min.), überarbeitet nach english-teacher Befund 6 und learning-scientist Befund 5:
- **Auswahl der Lexeme:** 3 Lexeme der Stufen 4–6, bis zu 5, wenn mindestens 6 dafür in Frage kommen (Emrah: 3–5).
  - Nur Lexeme **ohne heutige Tagesmarke**, bevorzugt mit Benutzen-Termin in den nächsten 1–3 Tagen. Die Buchung zählt als deren Wiederholung.
  - Gibt es keine solchen, ist die Aufgabe ausdrücklich „nur Beleg“.
- **Rahmen:** echte Textsorte mit Stilebene, im Wechsel:
  - E-Mail an einen Kunden, Slack an einen Kollegen, Antwort auf einen Einwand im Call, ein Satz für die Präsentation;
  - einmal pro Woche Familie oder Alltag (Berufsprofil).
  - Die Lage steht auf Deutsch, die Zielwörter in der Grundform. So wird die Beugung mitgeprüft, und keine fertige Wendung wird verraten. 2–4 Sätze.
- **Antwort:** tippen oder sprechen (Diktat). Sprechen wird wie Tippen gewertet und zählt als gesprochener Beleg (Antwort 4).
- **Prüfung** durch Claude nach den Regeln in Synthese 2.5. Note je Lexem:
  - richtig benutzt → Good auf Benutzen;
  - falscher Sinn oder falsches Wort → Again (auch auf Verstehen);
  - Beugungsfehler → Hard;
  - Kollokationsfehler nach M56 je `k`;
  - nicht benutzt → keine Note.
- **Einspruch:** „War das auch richtig?“ gibt es auch hier. Einmal neu prüfen mit `modelTier: 'complex'`, ohne Selbstnote.
- **Ohne Claude:** Muster und Selbstvergleich, ohne Planwirkung.
- **KI-Regeln** (Kap. 10, A6 Nr. 2–3) für `vocab-transfer@1` (`default`), `vocab-own-sentence@1` (`default`) und `vocab-meaning@1` (`quick`):
  - kein eigener Timer; Abbruch beim Bildschirmwechsel;
  - ein Neuversuch nur bei verletztem Schema;
  - `rate_limited` und `invalid_json` → Fehlerzustand mit Knopf „Erneut versuchen“, keine Planwirkung, der Termin bleibt;
  - `not_granted` → Block ausblenden.

**Wort-Detail:** Stufenbalken mit 7 Teilen, beide Spuren mit „nächste Wiederholung am …“, Verlauf aus `vlog`, alle Sätze, eigene Sätze.

**Dashboard:**
- aktiver gegen passiver Wortschatz (zwei Zahlen) und Schätzung der Gesamtgröße gegen das C1-Ziel (erst mit Einstufung, V5),
- **Lastvorschau 14 Tage in Minuten**, echte Behaltensrate (M18), Serie dezent.

### 7.1 Bild-Vorschläge an Emrah vor dem Bau
- Die Vorschau `WBft3EEx7jYYv4QHdepuNm` v2 ist die Untergrenze. Jede Ergänzung im Stil der Vorschau (ein Hauptknopf, ruhige Zeilen, keine Punkte, gleiche Tokens) wird Emrah als Bild gezeigt: B1–B13 aus `synthese.md` §4.2, N1–N8 aus 7.2. Die vier ausdrücklich verlangten (Wort-Detail mit beiden Spuren, 14-Tage-Vorschau, Abschluss, Anwenden) sind in `referenzen.md` §2.2 beschrieben.
- Je Paket ein Satz Zwischenbilder: V3 Lernkarte und Abschluss · V4 Wort-Detail, Dashboard, Anwenden · V5 Einstufung und Hinzufügen.

### 7.2 Neue Funktionen aus V0 (zusätzlich zur Synthese)
| Nr. | Funktion | Grund | Paket |
|---|---|---|---|
| N1 | **„Warum heute?“ je Karte**: eine Zeile im Menü „…“, z. B. „fällig seit 2 Tagen“, „Lernschritt“, „neu“, „Kontrast nach Fehler“ | Emrahs Klage „willkürlich“; macht die Geschwister-Regel sichtbar | V3 |
| N2 | **„Heute schon geübt“** in Abend-Check, „Dieses Wort üben“ und Wochen-Check: „zählt heute als Übung, nicht für den Plan“ | Diagnose §2.7; Kap. 2 Nr. 2 | V1 |
| N3 | **Doppel bestätigen** im Trockenlauf und im Wort-Detail: „Gehört zu *overcome*“ mit Rückgängig | Diagnose §2.1; 9.2 | V1 |
| N4 | **Ruhige Wiederkehr nach Pause:** „32 fällig · heute die 18 gefährdetsten, der Rest verteilt bis Do“ | M13, B11 | V3 |
| N5 | **Verlauf als Zeitleiste** im Wort-Detail: Punkte je Tag, grün frei, gelb mit Hilfe, rot falsch, grau ohne Planwirkung | Emrah §6 „Historie“; erst `vlog` macht sie vollständig | V4 |
| N6 | **Belege aus anderen Bereichen** im Wort-Detail: „im Lesen gesehen · in einer C1-Aufgabe richtig benutzt“ | `reportEvidence`; Nation-Stränge (Emrah 3.8) | V4 |
| N7 | **Plan-Ehrlichkeit** auf dem Dashboard: „Ziel 90 % · erreicht 89 %“, mit Hinweis bei mehr als 5 Punkten Abweichung | M18 | V4 |
| N8 | **Kapazitätsanzeige** in der Diagnose: Dokumente gesamt, Warnschwellen, Jahre bis zur Grenze, `vlog`-Größe | A6 Nr. 6, 3.6 | V1 |

---

## 8. Wortauswahl C1 und Einstufung (V5)

**Neue Lexeme**, gewichtet. Die Startgewichte stehen in `vcfg.w`, sind konfigurierbar und werden nach 4 Wochen an der Trefferquote nachgesteuert (english-teacher, Befund 5). Tiefe geht vor Breite:
| Quelle | Startgewicht |
|---|---|
| Wortpartner gelernter Lexeme | 30 % |
| Beruf und Funktionswendungen (Charge 2, Berufsprofil) | 30 % |
| eigene Funde (Wort-Popup, Preply-Lehrer, Lesen) | 25 % |
| Häufigkeitsband ab der Einstufungsgrenze | 15 % |

**Einstufung** je Band: erst erkennen, dann selbst bilden mit Anfangsbuchstabe (Vorschau H25). Dazu „Kenne ich schon“ mit Probe auf jeder neuen Karte (M16). Bei Wendungen und Kollokationen wird die Probe getippt, aus dem Deutschen.

**Wortlisten (Lizenzen geprüft 31.10.2026):**
| Liste | Lizenz | Beleg | Nutzung |
|---|---|---|---|
| **NGSL** 1.2 (Browne, Culligan, Phillips), ≈ 2.800 Wörter | **CC BY-SA 4.0** | newgeneralservicelist.com/new-general-service-list: „licensed under a Creative Commons Attribution-ShareAlike 4.0 International License“ | ja: Band 1–2.800, mit Namensnennung |
| **NAWL** 1.2 (≈ 960), **BSL** 1.2 (Business, ≈ 1.700), **NGSL-Spoken**, **TSL** | „released under Creative Commons, including commercial use“ (Fußzeile der Seite); die Version je Liste **bestätigt V5 an der Listendatei** | newgeneralservicelist.com | ja, nach Bestätigung (Business-Kern, Sprechwortschatz) |
| **Häufigkeit Rang 3.000–9.000** (C1-Breite), z. B. Daten von `wordfreq` | Lizenz der Daten **in V5 bestätigen**, vermutlich CC BY-SA 4.0 | – | ja, nach Bestätigung; nur Rang, kein Niveau |
| **Oxford 3000/5000**, Oxford Collocations Dictionary | keine offene Lizenz gefunden; die Seite des Verlags antwortete mit 403 | oxfordlearnersdictionaries.com | **nein**, nur mit schriftlicher Erlaubnis |
| PHaVE (Phrasal Verbs mit Sinnen), Academic Collocation List, PHRASE List | nicht geprüft | – | nur nach Lizenzprüfung in V5 |

- **Häufigkeit ist kein Niveau:** NGSL, NAWL und BSL decken zusammen nur ≈ 4.000–5.000 Wortfamilien ab. Für das C1-Ziel (6.000–8.000) braucht die Schätzung das Band 3.000–9.000. **C1-Marken setzt der Lehrer.**
- **Folge von CC BY-SA:** Abgeleitete Wortdaten stehen im öffentlichen Repository mit Lizenzdatei und Namensnennung (`src/modules/vocab/content/LICENSE-wordlists.md`).
- **Bedeutungen, Sätze, Wortpartner** schreibt das Inhaltsteam selbst und lässt sie vom Lehrer gegenlesen (M60). Die Listen liefern nur Wort und Rang.

---

## 9. Umrechnung der heutigen Daten (V1, Kap. 9, data-guard)

### 9.1 Grundsätze
- **Nichts löschen, alte Felder nie anfassen:**
  - Die Umrechnung schreibt **nur** `lex` (und `vlog/*`, `vmod/*`, `app/schema.vocabModule`).
  - `fsrs`, `S`, `D`, `due`, `stage`, `lm`, `hist`, `modes`, `xs`, `pa`/`ac`/`co` bleiben **bytegleich** (Test).
  - Gespiegelt wird erst mit der nächsten Antwort (3.1).
- **Versionsmarke, Sperre, Bestätigung** (Kap. 9 Regel 3, data-guard Befund 3):
  - `app/schema.vocabModule = {v: 1, t, state}` per `transform`.
  - Kooperative Sperre über `acquire` auf einen eigenen Pfad gegen zwei Tabs.
  - **Erst Trockenlauf, dann Emrahs Knopf „Übernehmen“**, erst danach wird geschrieben.
  - `running` ist fortsetzbar: Ein Abbruch lässt keinen Mischstand, weil jedes Dokument einzeln mit `lex.mig` markiert ist und ein zweiter Lauf Markiertes überspringt.
- **Idempotent:**
  - Dokumente mit `lex.mig` werden übersprungen.
  - `vlog`-Einträge haben feste Schlüssel aus `t` und Gerät; dieselbe Antwort ergibt denselben Schlüssel.
  - Ein zweiter Lauf ändert nichts (Test, auch „zweiter Tab“).
- **Trockenlauf:** Bericht je Lexem, unter Einstellungen → Diagnose lesbar (A6 Nr. 12, 15). Er enthält:
  - neue Stufe und beide Termine,
  - nachgespielte Antworten und „Verlauf vollständig ja/nein“,
  - mögliche Doppel,
  - übersprungene Karten mit Grund,
  - die Zahl der Tage mit 300 Log-Einträgen und der Karten mit vollem `hist`.
- **Sicherung vorher:** Export aller `vocab/*`, `chunk/*` und `log/*` als Datei über `downloads`. Die Umrechnung startet erst, wenn die Sicherung geschrieben ist.
- **Schreiben** nur über `writer.transform` auf dem frischen Stand. Ein Dokument mit unerwartetem Aufbau wird nie angefasst (`db_invalid`).
- **Ausgeblendete Karten** (`hidden`) werden nicht umgerechnet, sondern beim Einblenden nachgeholt (über `sync`, 9.4). Im Bericht stehen sie als „übersprungen: ausgeblendet“.
- **Sperren statt raten:** Ist eine Abfrage vielleicht gekappt oder `app/profile` ungültig, ist die Umrechnung gesperrt (A6 Nr. 15).
- **Formeln** für Startwerte und die Verteilung des Rückstands werden in V1 in `docs/fsrs-umrechnung.md` ergänzt (Kap. 9 Regel 5); data-guard prüft das vor dem V1-Test-Link.

### 9.2 Schritte
1. **Lexeme bilden:** je gültigem, nicht ausgeblendetem `vocab/<id>` und `chunk/<id>` ein Lexem.
   - **`k` setzen:**
     - `chunk/` → `ch`;
     - `vocab/` mit mehreren Wörtern: Phrasal Verb (`pv`), wenn Verb + Partikel. Ein Verb mit fester Präposition (*look forward to*, *deal with*) wird `col`, andere Mehrwortausdrücke ebenfalls `col`;
     - sonst `w`.
     - Die Zuordnung prüft die Lehrer-Charge 3 (5).
2. **Doppel**, als **eigene, bestätigte Phase** (english-teacher Befund 1, data-guard Befund 9):
   - **Vorschlag als Doppel** nur, wenn alle vier Bedingungen gelten:
     - (a) gleiches Stichwort (`headwordOf`),
     - (b) gleiche Art `k`,
     - (c) gleiche deutsche Bedeutung nach Vereinheitlichung, oder eine Seite hat keine,
     - (d) gleiche Wortart, oder eine fehlt.
   - **Nur melden, nie automatisch:** gebeugte Form (*overcame*), britische Schreibung (*prioritise*), Artikel (*a deadline*), Platzhalter (*remind sb of sth*).
   - **Nie zusammenlegen:** Bindestrich gegen Leerzeichen (*follow-up* ↔ *follow up*), ein anderer Sinn (*address* Rede ↔ *address* Problem).
   - Jedes Paar erscheint im Trockenlauf mit „zusammenlegen / getrennt lassen“ (N3). Nur bestätigte Paare bekommen `of`.
   - **Führend** ist das Dokument mit den meisten Antworten, bei Gleichstand das mit dem jüngeren `last`, dann die kleinere Kennung (deterministisch).
   - Beide Dokumente müssen gültig und nicht ausgeblendet sein. `of` zeigt nie auf ein Doppel; der Leser folgt keiner Kette.
   - **Bei der Zusammenführung:**
     - Der Verlauf beider Dokumente wird nach `t` sortiert zusammengelegt und gemeinsam nachgespielt;
     - `ev` und `core` werden vereinigt, `lc` addiert;
     - die Sätze beider Dokumente gehen in die Rotation und sind im Wort-Detail sichtbar.
   - Unit-Tests: *address* (Rede) gegen *address* (Problem) bleiben getrennt; *follow-up* gegen *follow up* bleiben getrennt.
3. **Verlauf sammeln:** `hist[]` (≤ 12 je Karte) und alle Einträge aus `log/<Tag>` mit `k:'v'` bzw. `type:'chunk'` und passender `id`, entdoppelt über `t`.
   - `log/<Tag>` ist **nicht vollständig**: `mergeLogEntries` kappt auf 300 Einträge und 240 KiB je Tag für alle Arten (`logPatch.ts:13-14, 349-350`).
   - Also ist der Verlauf **„vollständig ab V1, davor bestmöglich“**.
4. **Spuren nachspielen** mit ts-fsrs 5.4.2, nach den **neuen** Regeln (Tabelle „Spur je Form“ in §5):
   - **Startpunkt:** Beginnt der Verlauf nicht mit der Einführung, oder hat die Karte 12 `hist`-Einträge, aber mehr `reps`, dann startet Verstehen aus dem gespeicherten `fsrs`, und nachgespielt wird nur ab dort. Benutzen wird nur aus den vorhandenen Einträgen aufgebaut (learning-scientist Befund 7, data-guard Befund 7).
   - **Fehler** laufen als Again mit; sonst würde zu gut gerechnet.
   - **Je Tag und Spur zählt nur die erste Antwort** (wie 4.2 Nr. 2).
   - **Override-Antworten** (`log.override`) haben keine Wirkung. Eine `hist`-Antwort mit Note ≥ 3 ohne passenden Log-Eintrag aus einer Runde, in der „Als richtig werten“ möglich war, zählt höchstens Hard.
   - Auswahl, `find_trap` und Kontrast wirken nicht, sie stehen nur im Verlauf.
5. **Ohne Verlauf** (alte Karte, leeres `hist`, kein Log):
   - Verstehen übernimmt den heutigen `fsrs`-Stand unverändert.
   - Benutzen ist leer; die Karte steht auf Stufe 3 (Emrahs Auftrag §7). Benutzen entsteht mit dem ersten frei getippten Abruf (3.2).
   - **Ausnahme: heute Stufe 4–5 → Stufe 4.** Benutzen startet mit `s = min(fsrs.stability, 7)` und dem alten `last`. `due` kommt aus der Rückstandsverteilung (Schritt 7), damit es am ersten Tag keine Wand gibt. Der erste Abruf prüft, statt zu glauben.
6. **Stufe neu:** aus den Belegen nach den Regeln in 3.3, höchstens die heutige Stufe + 1, nie über 6. Stufe 7 braucht eigene geprüfte Sätze ab Stufe 5; die gibt es im Bestand nicht.
7. **Rückstand beim Umstieg** (heute ≈ 112 überfällig): nach Gefährdung über 7 Lerntage verteilt (M13, Frage F4). Die Verteilung wird nur in `lex.u.due`/`lex.b.due` geschrieben.
8. **Verlauf übertragen:** Die gesammelten Antworten gehen als Tupel mit Flag „umgerechnet“ in `vlog/*`. Je Halbmonat wird einmal geschrieben; die Zahl steht im Bericht.

### 9.3 Prüfungen
- **Unit:**
  - Ein zweiter Lauf ändert nichts, auch nicht aus einem zweiten Tab.
  - Alte Felder sind bytegleich.
  - Zahl der Lexeme ≤ Zahl der Karten. Kein Lexem ohne Ursprungssatz.
  - Auswahl-Antworten verändern keine Spur.
  - `sn` bleibt nach 20 Antworten ≤ 12.
  - Kein `delete`-Aufruf (Suchtest), kein Schreiben nach `daily/*` oder `feed/*`.
- **Kap. 9 Regel 7:** `seed/sample-data.json` (erfunden) durchspielen. Danach gleiche Anzahl je Sammlung, gleiche Serie, nichts gelöscht.
  - Dazu ein Datensatz mit Doppeln, Sinn-Zwillingen, leerem Verlauf, `hidden`, ungültigem Dokument und künftiger `fsrs`/`lex`-Version.
  - Zeitzonen-Fälle: 03:59/04:00, Monatswechsel, Halbmonatsgrenze, Sommerzeit.
- **data-guard** prüft Schema, Schreibpfad, Spiegelung und den Trockenlauf-Bericht an einer **Kopie** von Emrahs Daten auf dem Test-Link (nie auf der Live-App, A3 Nr. 6).

### 9.4 Rückweg
- **Schalter `app/profile.vcfg.mod`** in der Datenbank, gilt also auf allen Geräten gleich und wird nur über den Writer geschrieben (architect Befund 7). Aus → der alte Bereich plant wieder aus den gespiegelten alten Feldern.
- **Nachholen über `lex.sync`** (data-guard Befund 4):
  - Ist `doc.last > lex.sync`, hat der alte Bereich in der Zwischenzeit geantwortet.
  - Das Modul spielt dann nur Antworten mit `t > lex.sync` aus `hist` und `log/<Tag>` nach, mit denselben Regeln wie 9.2 Schritt 4 und entdoppelt über `t|id`.
  - Ist die Lücke unvollständig (Kappung), wird das gemeldet und nicht geraten (A6 Nr. 15).
  - Test: aus → alter Bereich antwortet → an → kein doppeltes `reps`.
- **Solange das Modul an ist,** holen alte Zähler (Heute, Fortschritt) ihre Zahlen aus `api.ts`, damit nichts auseinanderläuft.
- `lex` und `vlog` bleiben bei „aus“ stehen und werden beim Einschalten weitergeführt.

---

## 10. Pakete V1–V5 mit Abnahme
Jede in `synthese.md` übernommene Methode steht in **genau einem** Paket, mit ihrer Prüfung. Verbindlich ist die Liste in `synthese.md` §5: 71 Methoden, keine bleibt Papier. Neu dazu kommen N1–N8 (7.2), die Umrechnung (9) und die Prüfbefunde dieser Fassung.

| Paket | Inhalt | Methoden (`synthese.md` §5) | Abnahme |
|---|---|---|---|
| **V1** Datenmodell, Umrechnung, Planer, Simulation | **Modul:** Gerüst, Türen und Grenzen (2.1) · `lex`, `vlog` (Map), `vmod`, `vcfg` mit Schemas (3) · `date.ts` auf Europe/Berlin (4.4) · Planer mit einer Buchung je Spur und Tag, Kopplung nach oben, einseitigem Korridor am Deckel und Lastausgleich in Minuten (4) · Umrechnung mit Versionsmarke, Sperre, Bestätigung, Doppel-Phase und `sync` (9) · N2, N3, N8.<br>**Simulation:** `adapter-v1.ts`. Die Schnittstelle wird um `session(kind)` für alle Arten, `evidence(e)`, `forecastMinutes()` und `moved()` erweitert. Der Adapter meldet den gezeigten Satz (`Task.sentence`). Szenario D startet mit Rückstand. Der heutige Planer wird mit den Nebenwegen als fairer Ausgangswert neu gemessen; auch `adapter-current` meldet dabei den gezeigten Satz, damit die Satzbindung in beiden Messungen gleich wirkt. Dazu `tests/unit/vocab/simulation.test.ts`. | M1, M6, M7, M8, M9 (Regel), M10, M11, M12, M13, M15, M17, M19, M21, M77, M58 (Umrechnung) | Simulation erreicht die Ziele in §1 (5 Startwerte, schlechtester Wert) · Unit grün: Planer, Geschwister, Fuzz-Korridor nach Ankis Testwerten (7 → 5–9, 17 → 14–20, 37 → 33–41), nie über dem Deckel, Lastausgleich, eine Buchung je Tag, Umrechnung idempotent und bytegleich, zwei Geräte ohne Verlust in `vlog` · data-guard ohne Befund · `ts-fsrs` exakt 5.4.2 · Zuwachs in `budget.json` genannt |
| **V2** Stufenleiter, Formen, Bewertung | 7 Stufen · Formen je Stufe mit der Tabelle „Spur je Form“ · Notentabelle · Tippfehler (a)–(h) · Auch richtig mit `gr.var` · Kollokation nach `k` · Leech und Paare · M78–M81 erst nach Lehrer-Charge 3 · **Lehrer-Chargen 1–3** (5) | M2/M23, M14, M22, M25–M31, M36, M38–M41, M44, M45, M56, M57, M78–M81, M80 (Marke) | Notentabelle vollständig (alle Ausgänge × Stufen) · jede Regel (a)–(h) als Test · Simulation: ≥ 50 % aktiv ab Stufe 3, 30–40 % ohne Satz ab Stufe 4, Auswahl nur in Lernschritten · english-teacher prüft Chargen 1–3, Tippfehler-Liste und Synonyme (je ≤ 40, 100 %) · learning-scientist prüft Formen |
| **V3** Lernkarte, Sitzung, Abschluss | Lernkarte und Band (6) · Sitzung nach Emrah §5 · Abschluss · Override nach Antwort 2 mit Deckel Hard/1 Tag · „unfair“ · Neues eingestreut · Reihenfolge mit Startwert · Kontrast nach Kollokationsfehler · N1, N4 | M9 (Sitzung), M24 (Karte), M34, M42, M43, M48–M54, M68, M71–M76 | Bilder B3, B4, B8, B10, B11 und N1 von Emrah vor dem Bau abgenickt · Lerntag-Durchlauf des Überchats (390 px, Dunkel und Hell) · Test-Link · Unit: angezeigtes „kommt wieder“ = gespeichertes `due` |
| **V4** Anwenden, Wort-Detail, Dashboard | Transfer nach 7 (Auswahl ohne Tagesmarke, Textsorten, Sprechen, Einspruch, Fehlerzustände) · eigener Satz Stufe 5/6 · Wort-Detail mit beiden Spuren und Verlauf · Dashboard mit 14-Tage-Vorschau und Behaltensrate · Prompts registriert · N5–N7 | M18, M32, M33, M63–M66, M80 (Form) | Prompts `vocab-transfer@1`, `vocab-own-sentence@1`, `vocab-meaning@1` durch learning-scientist und english-teacher geprüft · Bilder B1, B2, B6, B7, N5 abgenickt · Unit: ohne Claude keine Planwirkung, Trivialsatz zählt nicht, Satz unter Stufe 5 zählt nicht für Stufe 7 · Test-Link |
| **V5** Wortauswahl C1, Einstufung | Gewichte (8) · Listen nach Lizenzbestätigung, auch Band 3.000–9.000 · Einstufung · „Kenne ich schon“ mit Probe · Markierung im Lesen ohne FSRS · i+1 · Sinne als eigenes Lexem · neue Lexeme in `vlex/` · alter Bereich aus dem Build | M16, M20, M55, M59, M61, M62, M69 | Lizenzdatei vorhanden · Lehrer prüft die ersten 40 neuen Lexeme · Unit: Begegnung im Lesen ändert FSRS nicht · Einstufung als Bild abgenickt |

**D4 und F1 gehen darin auf:**
- **D4** (Wörter-Bildschirm mit Filterchips, `recognizeCount`) wird zu Liste und Dashboard in V4. Die Filter der heutigen Liste bleiben (Bestand Nr. 62).
- **F1** („Wörter neu“: zwei Spuren, Stufen, Speichermodell `vs`) wird vollständig durch V1–V4 ersetzt: `vs` → `lex`, 6 Stufen → 7.

**Prüftore je Paket** (`arbeitsweise.md`):
- G0: `verify:fast` und Simulation.
- G1: learning-scientist und english-teacher bei jeder neuen Form und jedem Prompt.
- G2: ux-reviewer gegen Vorschau und abgenickte Bilder.
- G3: data-guard (V1, V5) und platform-guard.
- G4: Gesamtlauf einmal je Test-Link durch den Überchat.

---

## 11. Alle heutigen Funktionen: übernehmen, ausbauen, überführen
Bestandsliste aus dem Code. Fundstellen sind gekürzt; Pfade liegen unter `src/features/vocab/`, außer wo anders genannt. **Keine Funktion fällt weg.**
**Ü** = übernehmen · **A** = ausbauen (wie) · **→** = in neue Funktion überführen.

### 11.1 Lernkarte und Abfrage
| Nr | Funktion | Fundstelle | Entscheidung |
|---|---|---|---|
| 1 | Formenkatalog je Stufe | `domain/srs/modes.ts:22-60` | **A** 7 Stufen, ≥ 2 Formen je Stufe, schwächste zuerst, Spur je Form (§5), neue Formen M78–M81 (V2) |
| 2 | Einführungskarte (Wort, Lautschrift, Ursprungssatz) | `IntroCard.tsx:101-196` | **A** erst kurz selbst versuchen, dann aufdecken (M36, B10); 2–3 Wortpartner; Ton (V2/V3) |
| 3 | „Vorab: Was heißt das hier?“ mit „Weiß ich nicht“ | `IntroCard.tsx:44-62` | **→** in den Versuch der Einführung (M36), straffrei |
| 4 | Aufbau der Wendung, Register, Falle, Wortfamilie | `IntroCard.tsx:218-266` | **Ü**, dazu Stilebene `reg` (M80) |
| 5 | „Sag es einmal laut“ | `IntroCard.tsx:204-208` | **Ü** (freiwillig) |
| 6 | Neue Wörter automatisch vorlesen | `IntroCard.tsx:85`, `settings/VoiceSection.tsx:141` | **Ü** |
| 7 | „Kenne ich“ mit Prüffrage | `IntroCard.tsx:158`, `session.ts:659-671` | **A** Probe → Stufe 3, Kontrolle nach 7 Tagen (M16); bei Wendungen getippt aus dem Deutschen (V5) |
| 8 | Tag-0-Abruf (Anfangsbuchstabe, dann frei) | `session.ts:296-305`, `spacing.ts:165` | **→** Lernschritte A/B nach Karten und Zeit (M9, V1) |
| 9 | Gestern-Check | `session.ts:304`, `spacing.ts:191` | **Ü** als garantierter Abruf am Folgetag (M77) |
| 10 | Anki-Modus „Aufdecken“ mit 4 Noten | `anki/FlipCard.tsx:60, 299-307` | **A** bleibt freiwillig, wirkt nur auf Verstehen (F3), sperrt Benutzen nicht |
| 11 | Notenvorschlag aus der Denkzeit, Wischen | `FlipCard.tsx:106, 286-307` | **Ü** (nur Anki) |
| 12 | „Hier hast du es gelernt“ auf der Rückseite | `FlipCard.tsx:237-242` | **Ü**, auch im Wort-Detail |
| 13 | Kontroll- und Prüfabfragen in Aufdeck-Runden | `domain/srs/flip.ts:25, 39` | **Ü**; wirken auf Benutzen, weil getippt |
| 14 | Wortpartner-Abfragen mit KI-Hinweis | `ExerciseView.tsx:1338`, `collocs.ts:14-17` | **A** eigener Ausgang „Partner falsch“ nach `k` (M56), Kontrast in der nächsten Sitzung (M74); Wortpartner vom Lehrer geprüft |
| 15 | „Sag es“ (Absicht → englischer Satz, Diktat) | `modes.ts:48`, `sayIt.ts:60, 82` | **A** Form der Stufen 5–6 und gesprochener Beleg für Stufe 7 (Antwort 4) |
| 16 | „Später am Handy sprechen“ | `ExerciseView.tsx:1150-1162` | **Ü** |
| 17 | Aktivierungen A2–A5 (Szene, Umformen, Ohne Wort, Kombi, Mail) | `ActPanel.tsx:15-90`, `fahrplan.ts` | **→** Formen der Stufen 5–6 und Textsorten des Transfers (V4); der Fahrplan geht im Planer auf |
| 18 | Kontrast „Welches Wort passt?“ | `session.ts:1004`, `ExerciseView.tsx:1374` | **A** nach Kollokations- und Verwechslungsfehler am Anfang der nächsten Sitzung (M74), ohne Planwirkung |
| 19 | Satzwechsel | `domain/srs/rotate.ts:21-131` | **A** Ankersatz Tag 0–1, dann wechselnd; Formabruf-Satz 30 Tage gesperrt; Signal „satzgebunden“ (M57) |
| 20 | KI-Satz mit Markierung und „Melden“ | `ExerciseView.tsx:1140-1145` | **Ü**; Melden → „unfair“ ohne Planwirkung (M43) |
| 21 | Wort antippen im Satz | `engine/EnglishText.tsx:37-41` | **Ü** (Kap. 15) |
| 22 | Falle / falscher Freund | `domain/srs/traps.ts:23`, `partner.ts:108` | **A** Kontrastkarte Deutsch ↔ Englisch statt Pause (M14); Charge 1 Deutsch-Fallen |

### 11.2 Bewertung und Rückmeldung
| Nr | Funktion | Fundstelle | Entscheidung |
|---|---|---|---|
| 23 | Tipp in 2 Stufen | `ExerciseView.tsx:1153-1170` | **Ü**, Note Hard (M44) |
| 24 | „Weiß ich nicht“ | `ExerciseView.tsx:726, 1157` | **Ü**, Again und Lernschritt |
| 25 | Zweiter Versuch mit Hinweis | `ExerciseView.tsx:133, 1171-1179` | **A** ergibt Again ohne Stufenverlust; war der erste Versuch nur ein Tippfehler, Hard (M45) |
| 26 | „Auch richtig“, Tippfehler, Form, UK/US | `ExerciseView.tsx:1220-1230` | **A** Regeln (a)–(h), Ausweichwort, Varianten `gr.var` (M40, M41) |
| 27 | „War das auch richtig?“ (Claude prüft Synonym) | `SynonymCheck.tsx:13-46` | **Ü**, auch im Transfer |
| 28 | „Als richtig werten“ (bucht Note 3) | `ExerciseView.tsx:650, 731` | **→** „Das wusste ich eigentlich“ nach Antwort 2 (keine Note, Wiederkehr höchstens Hard) |
| 29 | „Schreib die Lösung einmal ab“ | `ExerciseView.tsx:1288, 1348` | **Ü** freiwillig, zählt nicht (M49) |
| 30 | Vergleich „Du: … → Richtig: …“ | `ExerciseView.tsx:1256-1270` | **A** Buchstaben-Diff (M48, B3) |
| 31 | Formerklärung („overcame = Vergangenheit …“) | `ExerciseView.tsx:1274-1285` | **Ü**, Beugungsfehler mit Grammatik-Hinweis (M40c) |
| 32 | Satzkorrektur von Claude | `ExerciseView.tsx:1231-1255` | **A** Regeln aus Synthese 2.5 (3 Urteile, ≤ 2 Korrekturen) |
| 33 | „Zielwort drin“ bei „Sag es“ | `ExerciseView.tsx:1190-1197` | **Ü** |
| 34 | Tutor-Knopf „Fehler erklären“ | `ExerciseView.tsx:1291-1302` | **Ü** |
| 35 | Ergebniskopf mit Ton, Lautschrift, „Zum Wort“ | `WordExtras.tsx:47-126` | **Ü** |
| 36 | „Wieder in …“ und Stufenhinweis | `ExerciseView.tsx:1320` | **A** „Kommt wieder: Mo, 9.11.“ = gespeichertes `due` (M54) |
| 37 | Falsche Karte kommt in der Runde wieder | `session.ts:998-999` | **→** Lernschritt nach Fehler, frei, neuer Satz (M53) |
| 38 | „Schreib trotzdem einen Satz mit …“ | `ExerciseView.tsx:1349, 1485` | **Ü** freiwillig |
| 39 | Rückgängig (5 s) | `session.ts:1063, 1130`, `anki/UndoBar.tsx:22` | **Ü**, setzt auch den `vlog`-Schlüssel auf `null` |

### 11.3 Planung und Ablauf
| Nr | Funktion | Fundstelle | Entscheidung |
|---|---|---|---|
| 40 | Moduswahl Aufdecken / Tippen / Automatisch | `hub/VocabHub.tsx:51, 200-206` | **A** In der Pflicht wählt die App, die Wahl gilt im freien Üben (M76) |
| 41 | Wiederholen-Knopf mit Minuten | `VocabHub.tsx:91-99` | **A** „Wörter · ca. 14 Min.“ mit „Warum diese?“ (M68) |
| 42 | Aufholmodus (feste Wörter aufdecken) | `session.ts:525` | **→** Rückstand nach Gefährdung (M13), ohne Aufdecken in der Pflicht |
| 43 | Rückstandsbremse (2 neue) | `VocabHub.tsx:89`, `unit/backlog.ts:33` | **→** mindestens 2 neu, Rest nach Minutenbudget (M12) |
| 44 | Wort-Werkstatt (Diagnose, Bedeutung, Teile, Satz) | `werkstatt.ts:109-128`, `WerkstattCard.tsx` | **Ü** (2 Fehler in 30 Tagen) neben Leech 6 (W5) |
| 45 | Werkstatt „Brauchst du das Wort?“ / Pausieren | `WerkstattCard.tsx:96-111, 195-209` | **Ü** |
| 46 | Merkhilfe (eigene oder Claude) | `mnemonic.tsx:51, 86` | **A** automatisch beim Leech (M14) |
| 47 | Fahrplan Aktivierung (Stufen, Abstände, Erhaltung) | `domain/srs/fahrplan.ts:17-129` | **→** Stufen 5–7 und Transfer (V4); Erhaltung = Stufe 7 selten (Emrah 4.4) |
| 48 | Ähnliche neue Wörter nicht am selben Tag | `queue.ts:296`, `similar.ts:93` | **A** auch Kernwort ↔ Kollokation (4.4) |
| 49 | Überspringen, Pausieren, Fortsetzen nach Neuladen | `TrainerScreen.tsx:48-102`, `session.ts:1195-1226` | **Ü** |
| 50 | Ergebnisseite mit Fehlwörtern, „Fehlwörter nochmal“, „Weitere Runde“ | `Summary.tsx:55-158` | **A** Abschluss nach Emrah §5 (B8); „Noch 5“ ohne heute Gesehenes; „Fehlwörter nochmal“ ohne zweite Planwirkung |
| 51 | Kalibrierhinweis „Leicht“ | `Summary.tsx:27-44` | **Ü** (nur Anki) |
| 52 | Prognose „Die nächsten 7 Tage“ | `hub/Sheets.tsx:314-342`, `forecast.ts:9` | **A** 14 Tage in Minuten auf dem Dashboard (M63, B1) |
| 53 | Zielbalken Wortschatz (C1-Marke) | `VocabHub.tsx:216-244`, `domain/vocab/goal.ts` | **A** aktiv gegen passiv; Schätzung erst mit Einstufung und Band bis 9.000 (M69) |
| 54 | Satzbank (weitere Sätze nach der Runde) | `sentenceBank.ts:175` | **Ü**, Quelle der Rotation, Lehrer-Freigabe (M60) |

### 11.4 Wort-Detail und Liste
| Nr | Funktion | Fundstelle | Entscheidung |
|---|---|---|---|
| 55 | Wortblatt: Status, Stufenleiter, nächste Wiederholung | `list/WordSheet.tsx:190-220`, `StatusBlock.tsx` | **A** beide Spuren, 7 Teile (B2) |
| 56 | Beispiele, weitere Sätze, Wortpartner | `WordSheet.tsx:224-262` | **Ü**, alle Sätze mit „zuletzt gezeigt“, auch die zusammengeführter Doppel |
| 57 | Beispielsatz übersetzen | `ExampleTranslation.tsx:14-55` | **Ü** |
| 58 | Bilanz je Form, Verlauf, Rohwerte | `WordSheet.tsx:279-428` | **A** Verlauf als Zeitleiste (N5) |
| 59 | Problemwort-Hinweis und „Neues Beispiel“ | `WordSheet.tsx:292-297` | **Ü** (Leech) |
| 60 | Üben, „Kann ich sicher“, „Morgen wieder“, Ausblenden, „Von vorn“, Stapel | `WordSheet.tsx:140-405`, `list/actions.ts:29-42` | **A** „Üben“ über `startSession('word')` (zweites Mal am Tag ohne Planwirkung, N2) · **„Kann ich sicher“ → „Kenne ich schon“ mit Probe** (M16), ohne bestandene Probe kein Aufstieg · „Von vorn“ setzt beide Spuren zurück, Belege bleiben im Verlauf · „Morgen wieder“ verschiebt nur, ohne Note |
| 61 | Bedeutung und Satz bearbeiten | `WordSheet.tsx:437-469` | **Ü** |
| 62 | Liste mit Suche, Sortierung, Filterchips, Mehrfachauswahl | `list/VocabScreen.tsx`, `vocabList.ts:20` | **A** Filter nach Gruppe und Spur, „bildest du selbst“ (D4 geht hier auf) |
| 63 | Suche im Hub | `VocabHub.tsx:139-164` | **Ü** |
| 64 | Stapel (Alle, Schwierig, eigene), Eingangskorb | `VocabHub.tsx:282`, `Sheets.tsx:301-390` | **Ü**; „Schwierig“ höchstens 10 (M75) |
| 65 | Eigene Stapel mit Filter, Modus, Richtung | `Sheets.tsx:56-118`, `hub/DeckScreen.tsx` | **Ü** (freies Üben) |
| 66 | Statistik (Median-Antwortzeit, Tage) | `hub/Sections.tsx:72-85` | **A** echte Behaltensrate und Plan-Ehrlichkeit (M18, N7) |

### 11.5 Hinzufügen und Quellen
| Nr | Funktion | Fundstelle | Entscheidung |
|---|---|---|---|
| 67 | Eigenes Wort anlegen, „Ausfüllen“ durch Claude | `list/AddWordSheet.tsx:103-123` | **Ü** über `addLexeme` (Ursprungssatz Pflicht) |
| 68 | Wörter erzeugen (allgemein, Beruf) | `AddWordSheet.tsx:141-192` | **A** Quelle „Beruf“ der Wortauswahl, Lehrer prüft (M20, M60) |
| 69 | Wörter aus Text | `list/FromText.tsx` | **Ü** |
| 70 | Lehrer-Feedback einfügen | `AddWordSheet.tsx:201-212` | **Ü**, Kernwort (M21) |
| 71 | Nachschlagen per Antippen, „Als Karte merken“ | `features/lookup/LookupPopover.tsx:322-424` | **Ü** über `findLexeme` / `addLexeme` |
| 72 | Sinn-Auswahl | `LookupPopover.tsx:336-374`, `domain/lookup/sense.ts` | **A** jeder Sinn ein eigenes, verknüpftes Lexem (M62); nie zusammengelegt (9.2) |
| 73 | Mehrwort-Markierung | `features/lookup/PhraseLookup.tsx:283-386` | **Ü**, legt ein Kollokations- oder Chunk-Lexem an |
| 74 | Lautschrift (IPA) | `domain/lexicon/pron.ts:68` | **Ü** |
| 75 | Wort-Atlas | `atlas/AtlasScreen.tsx`, `atlas/add.ts` | **A** zeigt Häufigkeitsbänder und Einstufung (V5) |

### 11.6 Einstellungen
| Nr | Funktion | Fundstelle | Entscheidung |
|---|---|---|---|
| 76 | Standardmodus, Richtung, 4/2 Knöpfe | `hub/Sections.tsx:15-62` | **Ü** (freies Üben, Anki) |
| 77 | Neue Wörter je Tag, Tagesziel, Ton | `settings/LearningSection.tsx:34-95` | **A** Zielzeit 10/15/20/30, Sicherheit 85/90/95 % mit Minutenangabe (M17, B9) |
| 78 | Stimme, Tempo, Autoplay | `settings/VoiceSection.tsx:76-141` | **Ü** |
| 79 | Berufsprofil | `settings/WorkContextSection.tsx:42-68` | **A** Kontext für Transfer und eigene Sätze (Emrah 4.4 Stufe 6) |
| 80 | Export Anki-CSV und Gesamtexport | `settings/exportData.ts:15, 59` | **A** mit beiden Spuren und `vlog` |

### 11.7 Freies Üben
| Nr | Funktion | Fundstelle | Entscheidung |
|---|---|---|---|
| 81 | Extra-Runde und Blatt „Mehr“ | `VocabHub.tsx:197, 295`, `Sheets.tsx:134-165` | **Ü** über `startSession`: Fälliges mit Planwirkung, heute Gesehenes ohne |
| 82 | Abend-Check | `VocabHub.tsx:267-273`, `domain/srs/offers.ts:12-19` | **A** bleibt; heute Eingeführtes ist ein Lernschritt, sonst ohne Planwirkung; Hinweis N2 (F2) |
| 83 | „Sag es selbst“ (2 Wörter von gestern in eigenen Sätzen) | `hub/SayOwnSheet.tsx` | **→** Übung mit viel Eigenleistung. Beleg für Stufe 7 erst ab Stufe 5 (3.3); sonst Beleg ohne Wirkung (V4) |
| 84 | Hörschleife | `listen/ListenLoop.tsx` | **Ü** (schreibt nichts) |
| 85 | Hörmodus in Stapeln | `hub/DeckScreen.tsx:76-81` | **Ü**; wirkt nur auf Verstehen (§5) |

### 11.8 Anbindung an andere Bereiche
| Nr | Funktion | Fundstelle | Entscheidung |
|---|---|---|---|
| 86 | Tagesblock „Wiederholen“ (Pflicht) | `areas/wortschatz.tsx:67-110`, `today/TodayScreen.tsx:105` | **→** `todayBlock()` mit Zeitbudget (2.2) |
| 87 | Heute-Extras „Fehlwörter von heute“, „Am Laptop vertiefen“ | `today/ExtraRow.tsx:56-75` | **Ü** über `startSession`, ohne zweite Planwirkung |
| 88 | Wortziel auf Heute und Pfad | `today/store.ts:394`, `progress/PathTab.tsx:72` | **Ü** über `lexemeState` |
| 89 | „Mehr“ verlinkt Grammatik, Satzbau, Sprechen | `Sheets.tsx:202-270` | **Ü** |
| 90 | Wochen-Check (benotet Wörter) | `features/check/session.ts:187` | **A** über `startSession('week')`; heute schon Geplantes ohne Planwirkung |
| 91 | C1-Aufgaben mit Wortbelegen | `features/c1x/lexWrite.ts:56-80` | **→** `reportEvidence` mit `cued` (2.2) |

---

## 12. Risiken
| Risiko | Gegenmittel |
|---|---|
| Umrechnung trifft Emrahs echte Daten falsch | Trockenlauf mit Bericht, Bestätigung, Sicherung, Rückweg-Schalter, data-guard. Der Überchat prüft den Bericht an einer Kopie auf dem Test-Link, nie auf der Live-App. |
| Doppel werden falsch zusammengelegt | Nur bestätigte Paare, strenge Bedingungen (9.2), Tests mit Sinn-Zwillingen |
| Verlauf geht zwischen Geräten verloren | `vlog` als Map mit Geräteschlüssel (3.4), Test „zwei Geräte gleichzeitig“ |
| Simulation zirkulär oder schönrechnend | Lerner mit eigenem Gedächtnis und zwei Spuren; Lernschritt bestimmt nur der Kern; 5 Startwerte, schlechtester Wert; dazu echte Behaltensrate nach 4 Wochen (M18) |
| Dokumentgrenze 5.000 in ≈ 2 Jahren | neue Lexeme ab V5 in `vlex/`, Warnschwellen und Anzeige (N8), Entscheidung bei Emrah |
| Zweite Datumsquelle | Das Modul nutzt nur `date.ts`; die Umstellung auf Berlin geschieht zentral mit Tests (4.4) |
| Mehr Last in den ersten Wochen (Deckel, Lernschritte) | Lastbudget in Minuten, Zielzeit einstellbar; Simulation zeigt die Minuten je Tag |
| Build-Größe und Startzeit | Modul als nachgeladenes Stück, `todayBlock` ohne Planer-Code, Zuwachs je Paket in `budget.json` |
| Inhalte (Chargen, Synonyme, Muster, Sätze) mit Fehlern | Chargen ≤ 40, 100 % english-teacher, Inhalts-Validatoren (G0) |

---

## 13. Offene Fragen an Emrah (höchstens fünf, je mit Empfehlung)
| Nr. | Frage | Empfehlung |
|---|---|---|
| **F1** | Wo liegt der neue Lernstand: im bestehenden Wortdokument (neues Feld, keine zusätzlichen Dokumente, der alte Bereich bleibt als Rückweg lauffähig) oder in eigenen neuen Dokumenten je Wort? | **Im bestehenden Wortdokument.** Das spart Platz (3.6), und nichts kann auseinanderlaufen. |
| **F2** | Abend-Check, Wochen-Check, „Dieses Wort üben“ und „Fehlwörter von heute“ bleiben. Ein Wort, das heute schon dran war, zählt dort aber nur als Übung, nicht für den Plan. Einverstanden? | **Ja.** So kommt kein Wort mehr „mehrmals am Tag“ in den Plan, und keine Funktion fällt weg. |
| **F3** | Anki-Modus (Aufdecken mit 4 Knöpfen, Selbsturteil): Darf er weiter wirken, aber nur auf „Verstehen“ und nie auf „Benutzen“ oder den Aufstieg ab Stufe 3? | **Ja, nur Verstehen.** Dein Selbsturteil bleibt möglich, aber „bildest du selbst“ zeigt nur, was du wirklich getippt oder gesprochen hast. |
| **F4** | Beim Umstieg sind etwa 112 Wörter überfällig. Sollen sie nach Gefährdung über 7 Lerntage verteilt werden, statt alle am ersten Tag zu kommen? | **Ja, über 7 Tage**, die gefährdetsten zuerst. |
| **F5** | Standard-Zielzeit für den Wörter-Block: 15 Minuten (änderbar auf 10/20/30)? Heute sind es etwa 8 Minuten Wiederholen in der Tageseinheit, dazu deine freiwilligen Runden (im Mittel 41 Abfragen am Tag). | **15 Minuten.** Das deckt deine echte Menge ab, ohne dass Extra-Runden nötig sind. |
