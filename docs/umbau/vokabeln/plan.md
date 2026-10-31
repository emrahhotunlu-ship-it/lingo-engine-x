# Vokabeln: Plan für die neue Wörter-App (V0 → V1–V5)

Stand 31.10.2026 · Paket V0 · **zur Bestätigung durch Emrah**. Gebaut wird erst nach seinem OK.
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
- **Tageswechsel** 04:00 Europe/Berlin. **US-Englisch**, britische Formen gelten als richtig.
- **„Das wusste ich eigentlich“:** Emrah hat entschieden (Antwort 2): keine Note, kein Abstieg. Das Wort kommt nach 3–5 Karten in einem neuen Satz, und nur diese Antwort zählt.
  - **Begrenzung:** höchstens einmal je Lexem und Lerntag, höchstens 3-mal je Sitzung.
  - Ist die Wiederkehr-Antwort wieder falsch, gilt sie als Fehler.
  - **Messung:** Liegt die Trefferquote übersteuerter Wörter bei der Wiederkehr unter 70 %, wird das Ventil geprüft (M42).

---

## 1. Ziel und Abnahme (Emrahs Auftrag §8, mit Messweg)
| Nr. | Abnahme | Messweg | Paket |
|---|---|---|---|
| 1 | Kein Lexem außerhalb der Lernschritte mehr als einmal am Tag. Die Last schwankt deutlich weniger. Nichts Fälliges bleibt unbegrenzt liegen. | `node scripts/vocab/simulate.mjs --adapter v1`, gleiche Szenarien und gleicher Startwert wie `ausgangsmessung.md`. Neu mitsimuliert: Abend-Check, Wochen-Check, „Dieses Wort üben“, Extra vor Pflicht. Ziele aus `ausgangsmessung.md` (unten). | V1 |
| 2 | ≥ 50 % aktive Abfragen ab Stufe 3; Auswahl nur in Lernschritten | Simulation und Unit-Test | V2 |
| 3 | Jedes Lexem zeigt Stufe und nächste Wiederholung für beide Spuren | Bild H12 `detail` (B2), Unit: angezeigtes Datum = gespeichertes `due` | V4 |
| 4 | Transfer-Aufgabe mit und ohne Claude | Unit (ohne Claude keine Planwirkung), Bild H38 beider Varianten | V4 |
| 5 | Unit-Tests für Planer, Geschwister-Regel, Lastausgleich, Bewertungsableitung, Stufenwechsel grün | `npm run verify:fast`, Testordner `tests/unit/vocab/` | V1, V2 |
| 6 | Emrah hat Lernkarte und Dashboard am Handy gesehen und abgenickt | Zwischenbilder vor dem Bau, Test-Link nach V3 und V4 | V3, V4 |

**Zielwerte der Simulation** (aus `ausgangsmessung.md`):
| Kennzahl | heute | Ziel |
|---|---|---|
| mehrfach außerhalb der Lernschritte | 0 | 0, auch mit allen Nebenwegen |
| Variationskoeffizient Tagesminuten (Lerntage) | 0,17 / 0,34 / 0,34 | ≤ 0,15 (A, B), ≤ 0,2 (C) |
| 14-Tage-Vorschau: größter Tag ÷ Mittel | 2,68 / 2,57 / 1,85 | ≤ 1,5 |
| Pause 7 Tage | – | Abbau in ≤ 7 Lerntagen, kein Lexem > 3-mal verschoben |
| Tage mit ≥ 2 neuen Lexemen | 100 % | 100 % |

---

## 2. Die Wörter-App als eigenes Modul
Emrah: „eine komplett neue Wörter-App als eigenes Modul in der Webapp, nicht Reparaturen am alten Wörter-Bereich“.

### 2.1 Ordner und Grenzen
```
src/modules/vocab/
  api.ts            einzige Tür nach außen (siehe 2.2)
  domain/           rein und testbar: lexeme, tracks, planner, fuzz, balance, ladder, grade, typo, leech, session, transfer, pick (Wortauswahl)
  data/             Pfade, zod-Schemas, Schreib-Operationen (über den EINEN Writer `src/data/writer.ts`), Umrechnung
  ui/               Bildschirme (Lernkarte, Sitzung, Abschluss, Wort-Detail, Liste, Dashboard, Einstellungen, Hinzufügen)
  prompts/          versionierte Prompts (Transfer, eigener Satz, Bedeutung frei) mit zod-Schema
tests/unit/vocab/   eigene Tests
scripts/vocab/      eigene Simulation (adapter-current.ts = heute, adapter-v1.ts = neu)
```
- **Grenze im Code:**
  - Eine ESLint-Regel (`no-restricted-imports`) verbietet Importe aus `src/modules/vocab/**` außer `api.ts`.
  - Ein Unit-Test prüft, dass außerhalb des Moduls niemand nach `vocab/*`, `chunk/*` oder `vlog/*` schreibt (Suche nach Writer-Aufrufen mit diesen Pfaden).
- **Der alte Bereich** (`src/domain/srs`, `src/features/vocab`) bleibt bis zur Umrechnung lauffähig. Er dient als Rückweg (Schalter, siehe 9.4). Danach wird er nur noch gelesen und fliegt in V5 aus dem Build. Daten werden nie gelöscht.

### 2.2 Schmale Schnittstellen (`api.ts`)
| Funktion | wer nutzt sie | was sie tut |
|---|---|---|
| `todayBlock(now)` → `{min, due, fresh, why, done}` | Heute | Wörter-Block mit Zeitbudget („Wörter · ca. 14 Min.“, „11 fällig, die gefährdetsten zuerst · 3 neue“). Der Block ist für den Lerntag eingefroren. |
| `startSession(kind)` | Heute, Wörter-Bildschirm | Pflicht, „Noch 5“ oder freies Üben. Nur das Modul baut die Runde. |
| `findLexeme(text)` → `LexemeRef \| null` | Lesen, Grammatik, Praxis, Wort-Popup | Lexem-ID zu einem Wort oder einer Wendung, auch für die Markierung im Lesetext (M59) |
| `addLexeme(input)` | Wort-Popup, Lehrer, Lesen, eigene Eingabe | neues Lexem mit Ursprungssatz (Pflicht, Kap. 15). Die Einführung plant das Modul. |
| **`reportEvidence(e)`** | Grammatik, Lesen, C1-Aufgaben, Praxis, Sprechen | **die eine Meldefunktion.** `e = {lexeme, kind: 'seen' \| 'recalled' \| 'used', src, ok, typed, text?, t}`. Andere Bereiche **planen nie**. Das Modul entscheidet allein, ob die Meldung Planwirkung hat. Regel: Nur `recalled` oder `used`, getippt und richtig, an einem Tag ohne andere Planwirkung für dieses Lexem, zählt als Abruf der passenden Spur. Alles andere ist nur ein Beleg im Verlauf. |
| `lexemeState(id)` | Fortschritt, Tutor | Stufe, Gruppe und beide Termine (nur lesen) |
| Transfer | intern | nutzt das gemeinsame KI-Tor `src/ai` mit eigenem Prompt `vocab-transfer@1` |

**Damit ist die Klumpen-Ursache „Wörter tauchen außerhalb des Planers auf“ geschlossen.**
- Abend-Check, Wochen-Check, „Dieses Wort üben“ und Extra-Runden laufen über `startSession`.
- C1-Aufgaben (`c1x/lexWrite.ts`) und künftige Bereiche melden über `reportEvidence`.
- Der Planer hält die **Tagesmarke je Lexem**. Ist sie gesetzt, hat jede weitere Antwort an diesem Tag keine Planwirkung, außer in den Lernschritten. Sie wird im Verlauf gespeichert und zählt für die Statistik.

---

## 3. Datenmodell

### 3.1 Lexem
Ein Lexem ist ein Wort, ein Phrasal Verb, eine Kollokation oder ein Chunk (Emrah 4.1). **Ablage (Empfehlung, Frage F1):** im bestehenden Dokument `vocab/<id>` bzw. `chunk/<id>` als neues Feld `lx`. Damit gibt es keine zusätzlichen Dokumente je Lexem, und Inhalte und Herkunft bleiben, wo sie sind.

```
lx: {
  v: 1,                         Schema-Version des Moduls
  k: 'w' | 'pv' | 'col' | 'ch', Art: Wort, Phrasal Verb, Kollokation, Chunk
  of?: '<vocab/… | chunk/…>',   Doppel: verweist auf das führende Lexem und wird nie selbst geplant
  sense?: '<lexem>',            weiterer Sinn eines mehrdeutigen Worts (M62), verknüpft
  lv: 1..7,                     Stufe (intern 7, sichtbar 3 Gruppen)
  u: Track,                     Spur Verstehen
  b: Track | null,              Spur Benutzen (null = noch nicht freigeschaltet)
  day?: 'JJJJ-MM-TT',           Tagesmarke: Lerntag der letzten Antwort mit Planwirkung (Geschwister-Regel)
  step?: {n, at, gap},          laufender Lernschritt (Karten- und Zeitabstand, M9)
  ev: {f: [JJJJ-MM-TT …≤ 8], o: n, s: n},   Belege: Tage mit freiem Abruf, eigene geprüfte Sätze, gesprochene Sätze
  sn: {[satzKey]: 'JJJJ-MM-TT'},  zuletzt gezeigt je Satz (Rotation, M57), höchstens 12
  lc: n, pair?: '<lexem>',      Fehlerzahl für die Leech-Regel, Verwechslungspartner (M14)
  core?: 1, reg?: 'f'|'n'|'i',  Kernwort (M21), Stilebene (M80)
  mv: n,                        so oft wegen Rückstand verschoben (≤ 3, M13)
  mig?: {t, from: 'srs1', h: n} Umrechnung: Zeitpunkt, Quelle, Zahl der nachgespielten Antworten
}
Track = { due, s, d, st, reps, lapses, last, sd, ls }   wie FsrsStored (ts-fsrs 5), kurz benannt
```
- **Sätze:** Die vorhandenen Felder bleiben die Quelle: `ex` (Ursprungssatz), `xEx`, `wx`, `col[].ex` und die Satzbank. Jeder Satz hat einen festen Schlüssel (wie `hist[].s` heute). Kein Lexem ohne Ursprungssatz (Kap. 15).
- **Alte Felder bleiben stehen und werden gespiegelt** (Kap. 9, Regel 2 und 5):
  - `fsrs`, `S`, `D`, `due`, `stage` (1–5), `state`, `reps`, `lapses`, `last`, `hist` (≤ 12) bekommen bei jeder Antwort mit Planwirkung den Stand der **führenden Spur**: Benutzen, wenn freigeschaltet, sonst Verstehen.
  - Stufen-Zuordnung neu → alt: 1 → 1, 2 → 2, 3 → 3, 4 → 4, 5–7 → 5.
  - So zeigen alte Leser (Heute, Fortschritt, v86-Rückweg) weiter Sinnvolles, und der Rückweg auf den alten Bereich bleibt möglich.

### 3.2 Zwei Spuren
- **Verstehen (u)** gibt es ab der Einführung. **Benutzen (b)** wird mit dem ersten freien getippten Abruf an Tag 0 angelegt. Nach Emrahs Antwort 1 zählt die getippte Lücke ab Tag 1 als Benutzen.
- Die **schweren Benutzen-Formen ab Stufe 4** (deutscher Chunk → Englisch, Variieren, eigener Satz) brauchen `u.s ≥ 3 Tage` (konfigurierbar).
- **Kopplung** (Synthese 2.1 Nr. 1): Eine Antwort auf Benutzen wird **auch** auf Verstehen gebucht, mit derselben Note. Eine Antwort auf Verstehen zählt nie für Benutzen.
- Emrahs Regel „sind beide fällig, nur eine abfragen, die andere um einen Tag verschieben“ gilt so:
  - Sind **beide** fällig, kommt Benutzen, und Verstehen ist damit mitgebucht.
  - Ist **nur Verstehen** fällig, kommt eine Verstehen-Form (Bedeutung frei nennen, Ton → Bedeutung).
  - Liegen beide Termine auf Folgetagen, wird Verstehen auf den freien Tag im Fuzz-Korridor gelegt (Nachbartage, Synthese 3.2 Nr. 2).

### 3.3 Stufen 1–7
Wie `synthese.md` §2.3, mit Emrahs Antworten 3 und 4.
- **Gruppen:** „erkennst du“ (1–2), „auf dem Weg“ (3–5), „bildest du selbst“ (6–7).
- **Aufstieg:** nur an einem Aufstiegs-Tag, also eine fällige Antwort mit Good oder Easy, ohne Hilfe; ein reiner Tippfehler zählt mit. Dazu muss die Schwelle der Spur erreicht sein:
  - 2 → 3: Abruf B frei richtig
  - 3 → 4: 2 Tage
  - 4 → 5: 3 Tage und `b.s ≥ 7`
  - 5 → 6: `b.s ≥ 21`
  - 6 → 7: Bedingung aus Synthese 2.3 und Emrahs Antwort 4
- **Abstieg:** bei einem Fehler eine Stufe, nie unter 2, mit Lernschritt. Ein zweiter Versuch und „Das wusste ich eigentlich“ kosten keine Stufe.

### 3.4 Vollständiger Verlauf
- **`vlog/<JJJJ-MM>-a`** (1.–15.) und **`-b`** (16.–Monatsende): Jede Antwort und jeder Beleg ist ein Eintrag als Zahlen-Tupel.

  ```
  [t, "lexem", spur 0|1|2 (u|b|beides), "art", note 0–4 (0 = ohne Planwirkung), ausgang, ms, fk, hilfe 0–3, "satzKey", stufe, flags]
  ```

  - `t` ist in Sekunden seit Monatsbeginn angegeben.
  - Der `ausgang` ist einer von: richtig, Tippfehler, Beugung, Wortart, anderes Wort, Synonym, Ausweichwort, Kollokation, falsch, weiß nicht.
  - `flags` ist eine Bitmaske: Lernschritt, Override, unfair gemeldet, Anki, Beleg aus einem anderen Bereich, ohne KI.
- Damit sind alle Felder da, die Emrah in §7 verlangt: Zeitpunkt, Übungstyp, Spur, Ergebnis, Antwortzeit, Hinweis und die abgeleitete Bewertung. FSRS-Parameter lassen sich später auf Emrahs Daten anpassen, ab 1.000 Antworten je Spur (M19).
- `log/<Tag>` bleibt (Tagesauftrag, Serie, Wochenbericht). `vlog` ersetzt es nicht.

### 3.5 Weitere Daten
- **Einstellungen** in `app/profile`:
  - `vx: {min: 10|15|20|30, ret: 0.85|0.9|0.95}`
  - `newPerDay` bleibt (0/2/5/10).
- **Eingefrorener Tagesblock** in `vmod/day`: `{d, plan: [lexem, spur, form]…, min, why}`. Er wird je Lerntag als Ganzes ersetzt (wie `app/today`) und ist ableitbar. Das ist 1 Dokument.

### 3.6 Kapazität (A6 Nr. 6: ≤ 5.000 Dokumente, ≤ 256 KiB je Dokument)
| Teil | Größe | Rechnung | reicht |
|---|---|---|---|
| `lx` je Lexem | ≈ 0,7–1,2 KB (zwei Spuren je ≈ 120 B, Belege, Rotation ≤ 12 Sätze × 20 B) | Kartendokument heute ≤ 64 KiB (`MAX_CARD_BYTES`); typisch 2–6 KB | ja |
| `vlog` Eintrag | ≈ 75 Byte (Tupel) | Emrahs Mittel 41 Abfragen/Tag → ≈ 615 je Halbmonat → **≈ 46 KB**; Höchstwert 98/Tag → 1.470 → **≈ 110 KB** | ja, < 256 KiB. Ab 200 KiB schreibt das Modul in `-c`, `-d` weiter. |
| `vlog` Dokumente | 24 im Jahr | 10 Jahre = 240 | ja |
| `vmod/day` | 1 Dokument, < 4 KB | – | ja |
| **Lexem-Dokumente** | 1 je Lexem (wie heute) | Bei 5 neuen je Tag sind das ≈ 1.800 im Jahr, dazu `log/<Tag>` 365 im Jahr. | **Grenze nach ≈ 2 Jahren.** Gegenmittel (V5): Lexeme ab Stufe 7 mit `b.s ≥ 180` werden in Bündel `vlexa/<n>` gepackt (≤ 150 Lexeme je Dokument, ≈ 1 KB je Lexem → ≈ 150 KB). Das Original bleibt bis zur Bestätigung mit `lx.of` stehen. Die Diagnose-Ansicht zeigt den Wert, data-guard prüft. |

Ergebnis: Der Verlauf kostet 24 Dokumente im Jahr statt ≈ 15.000 bei einem Dokument je Antwort.

---

## 4. Planer (V1)

### 4.1 ts-fsrs: Version festlegen
**Entscheidung: `ts-fsrs` exakt 5.4.2** (in `package.json` ohne `^`, Unit-Test prüft die Version).

Gründe:
1. ts-fsrs 6 schaltet still auf FSRS-7 mit neuen Standardgewichten und anderer Kurzzeit-Logik um (V0a, Synthese M1). Die umgerechneten Stände und die Ausgangsmessung beruhen auf FSRS-6-Gewichten in ts-fsrs 5.
2. Ein Wechsel wäre eine zweite Änderung gleichzeitig mit dem Umbau. Dann wäre nicht mehr messbar, was die Verbesserung bewirkt.
3. Ein Wechsel auf 6 erst nach 1.000 Antworten je Spur, nach eigener Simulation (alte gegen neue Version, gleicher Lerner) und mit Emrahs OK.

### 4.2 Ablauf je Antwort mit Planwirkung
1. **Note** aus dem Ergebnis (V2, §5).
2. **FSRS** der Spur. Benutzen bucht Verstehen mit. Zielquote aus `vx.ret` (Standard 0,9). `enable_fuzz: false`, denn die Streuung macht Schritt 4. `enable_short_term: false`, denn die Lernschritte macht das Modul nach Karten und Zeit (M9).
3. **Abstands-Deckel** 1 / 3 / 7 / 21 Tage nach den Tagen mit freiem Abruf (M77, wie heute, `spacing.ts:23`). Er kürzt nur und wirkt **vor** Fuzz und Lastausgleich.
4. **Fuzz** nach Ankis Formel ab 2,5 Tagen, mit festem Startwert aus Lexem-Kennung und Wiederholungszahl (M10).
5. **Lastausgleich im Fuzz-Korridor** nach Anki: Gewicht (1/Last)² · (1/Intervall), nur bis 90 Tage (M11). Gerechnet wird in **erwarteten Minuten**, mit Median-Zeiten je Form aus `vlog`. Weitere Regeln:
   - **Geschwister-Faktor:** Die andere Spur desselben Lexems und Verwechslungspartner meiden den Tag (Gewicht 0,000001) und die Nachbartage (0,2 / 0,4).
   - **Ruhetag** (A7) als „Easy Day“ mit Faktor „Minimum“.
6. **Tagesmarke** `lx.day` setzen (Geschwister-Regel).
7. Ein **Verlaufseintrag** in `vlog`, die alten Felder spiegeln (3.1).

### 4.3 Lernschritte (M9, W3)
- **Neu:** Einführung → **Schritt A** nach ≥ 3 anderen Karten → **Schritt B** nach ≥ 8 Karten **und** ≥ 3 Min.
- **Nach einem Fehler:** Wiederkehr nach 3–5 Karten, frei, in neuem Satz oder ohne Satz (M49, M53). Höchstens 4 Versuche je Lexem und Tag; danach morgen wieder ohne Stufenverlust (Konzept §3.2).
- **Endet die Sitzung vorher:** Der Schritt geht in die nächste Sitzung desselben Lerntags, sonst an den Folgetag. **Nur Lernschritte** dürfen ein Lexem am selben Tag mehrfach zeigen.

### 4.4 Tagesplan
- **Tageswechsel** 04:00 **Europe/Berlin**, gerechnet mit `Intl.DateTimeFormat` und Zeitzone, unabhängig vom Gerät.
- **Fällige** nach Abrufwahrscheinlichkeit (gefährdetste zuerst), Kernwörter vor Randwörtern (M13, M21).
- **Neue Lexeme:**
  - Mindestens 2 an jedem Lerntag, auch bei Rückstand. Darüber hinaus so viele, wie das Minutenbudget erlaubt, höchstens das Kontingent. Bei Kontingent 0 kommen keine (Emrahs Antwort 5, M12).
  - Eingestreut: das erste nach 3–5 Wiederholungen, das letzte spätestens bei 50 % der Sitzung (M72).
  - Nie zwei verwechselbare neue am selben Tag.
- **Zielzeit** 10/15/20/30 Min., Standard 15 (Frage F5). „Noch 5“ nimmt nur Fälliges oder Neues, nie heute Gesehenes.
- **Rückstand:**
  - Höchstens 2 Tagesbudgets je Tag.
  - Der Rest wird nach Gefährdung auf die nächsten Tage verteilt.
  - Nur Randwörter werden verschoben, jedes höchstens 3-mal (M13).
- **Leech:** Ab 6 Fehlern bekommt das Lexem eine neue Darstellung: neuer Satz, Merkhilfe, Kontrast. Dazu gibt es die Paar-Regel und die Kontrastkarte für falsche Freunde (M14). Die Werkstatt ab 2 Fehlern in 30 Tagen bleibt (W5).
- Der Plan ist **für den Lerntag eingefroren** (`vmod/day`, Kap. 15).

---

## 5. Bewertung, Übungsformen, Stufenleiter (V2)
Wie `synthese.md` §2.2–2.3 und Methoden M22–M45, M56, M78–M81. Die wichtigsten Regeln:
- **Note:**
  - Falsch oder Lösung gezeigt → Again.
  - Hinweis, sehr langsam (> 2 × Median, Zeit bis zum ersten Zeichen) oder ein Tippfehler → Hard.
  - Richtig → Good.
  - Easy: schnell (< 0,6 × Median), nur ab Stufe 5, fällig und älter als 21 Tage.
  - Die ersten 20 Antworten je Form wirken nicht über die Zeit (M38, M39).
- **Auswahl ändert FSRS nie.** Sie gibt es nur in den Lernschritten und als Rettung nach einem Fehler (M2, M23, W7).
- **Anki-Modus** bleibt freiwillig (A7). Er wirkt **nur auf Verstehen**, nie auf Benutzen und nie auf einen Aufstieg ab Stufe 3 (Frage F3).
- **Tippfehler-Regeln** (a)–(h) mit fester Prüfreihenfolge (M40), dazu „Auch richtig“ und Ausweichwort (M41), Kollokationsfehler (M56), Präposition, Zählbarkeit und Partikel (M78, M79, M81).
- **Formen je Stufe:** mindestens 2. Gewählt wird die mit der niedrigsten Trefferquote, außer sie kam zuletzt. Keine Form zweimal in Folge. Ab Stufe 4 ist jeder 3. Abruf ohne Satz, als deutscher Chunk (M22, M27).
- **„Aufgabe war unfair“:** ohne Planwirkung, geht in die Inhaltsprüfung (M43).

## 6. Sitzung, Lernkarte, Abschluss (V3)
Ablauf nach Emrah §5: fällig → neu eingestreut → Anwenden → Abschluss. Lernkarte nach Synthese 2.2:
- Der Satz ist groß, die Lücke ist das Eingabefeld, die Tastatur ist sofort offen und die Autokorrektur aus. Enter prüft.
- Ton normal und langsam. Tipp zeigt den ersten Buchstaben.
- **Ein Rückmeldeband:**
  - Urteil, Diff (nur nach Fehler), Warum (auch bei richtig).
  - 2 Wortpartner und „Kommt wieder: Mo, 9.11.“.
  - „Mehr“ (Übersetzung, weiterer Beispielsatz) und „War das auch richtig?“.
  - Nach einem Fehler zusätzlich „Das wusste ich eigentlich“.

**Abschluss:** heute gelernt · aufgestiegen · gestolpert (mit Termin) · „morgen ca. X Min.“; dazu „Fertig“ und „Noch 5“.

## 7. Transfer, Wort-Detail, Dashboard (V4)
- **Anwenden** (2–4 Min.): 3 Lexeme der Stufen 4–6 in einer Lage aus Emrahs Kontext (Business Development, Software, Familie; Berufsprofil).
  - Claude prüft nach den Regeln in Synthese 2.5.
  - Richtig benutzt → Good auf Benutzen. Falscher Sinn oder falsches Wort → Again. Nur Kollokations- oder Beugungsfehler → Hard. Nicht benutzt → keine Note.
  - Ohne Claude: Muster und Selbstvergleich, ohne Planwirkung (0).
- **Wort-Detail:** Stufenbalken mit 7 Teilen, beide Spuren mit „nächste Wiederholung am …“, Verlauf aus `vlog`, alle Sätze, eigene Sätze.
- **Dashboard:**
  - aktiver gegen passiven Wortschatz (zwei Zahlen) und Schätzung der Gesamtgröße gegen das C1-Ziel (erst mit Einstufung, V5),
  - **Lastvorschau 14 Tage in Minuten**, echte Behaltensrate (M18), Serie dezent.

### 7.1 Bild-Vorschläge an Emrah vor dem Bau
Die Vorschau `WBft3EEx7jYYv4QHdepuNm` v2 ist die Untergrenze. Jede Ergänzung im Stil der Vorschau (ein Hauptknopf, ruhige Zeilen, keine Punkte, gleiche Tokens) wird Emrah als Bild gezeigt:
- **aus der Synthese** (§4.2): B1–B13;
- **aus V0 neu:** N1–N8 (7.2).
- Je Paket ein Zwischenbild-Satz: V3 Lernkarte und Abschluss · V4 Wort-Detail, Dashboard, Anwenden · V5 Einstufung und Hinzufügen.

### 7.2 Neue Funktionen aus V0 (zusätzlich zur Synthese)
| Nr. | Funktion | Grund (Beleg) | Paket |
|---|---|---|---|
| N1 | **„Warum heute?“ je Karte** (eine Zeile im Menü „…“: „fällig seit 2 Tagen“ / „Lernschritt“ / „neu“ / „Kontrast nach Fehler“) | Emrahs Klage „willkürlich“; macht die Geschwister-Regel sichtbar | V3 |
| N2 | **„Heute schon geübt“-Hinweis** in Abend-Check, „Dieses Wort üben“, Wochen-Check: „zählt heute als Übung, nicht für den Plan“ | Diagnose §2.7; Kap. 2 Nr. 2 (keine Widersprüche) | V1 |
| N3 | **Doppel-Zusammenführung** im Wort-Detail: „Gehört zu *overcome*“ mit Rückgängig | Diagnose §2.1 (Doppelkarten) | V1 |
| N4 | **Ruhige Wiederkehr nach Pause:** „32 fällig · heute die 18 gefährdetsten, der Rest verteilt bis Do“ | M13, B11 | V3 |
| N5 | **Verlauf als Zeitleiste** im Wort-Detail (Punkte je Tag: grün frei, gelb mit Hilfe, rot falsch, grau ohne Planwirkung) | Emrah §6 „Historie“; `vlog` macht ihn erstmals vollständig | V4 |
| N6 | **Belege aus anderen Bereichen** im Wort-Detail: „im Lesen gesehen · in einer C1-Aufgabe richtig benutzt“ | `reportEvidence` (2.2), Nation-Stränge (Emrah 3.8) | V4 |
| N7 | **Plan-Ehrlichkeitszahl** auf dem Dashboard: „Ziel 90 % · erreicht 89 %“, Hinweis bei Abweichung > 5 Punkte | M18; prüft den Planer an echten Daten | V4 |
| N8 | **Kapazitätsanzeige** in der Diagnose-Ansicht: Dokumente gesamt, Jahre bis zur Grenze, `vlog`-Größe | A6 Nr. 6, 3.6 | V1 |

---

## 8. Wortauswahl C1 und Einstufung (V5)
- Neue Lexeme gewichtet aus (Emrah 4.6, M20):
  - (a) Frequenzbändern bis C1,
  - (b) eigenen Funden (Wort-Popup, Lehrer, Lesen),
  - (c) Kollokationen bereits gelernter Lexeme,
  - (d) dem Berufsprofil.
- **Einstufung** je Band: erst erkennen, dann selbst bilden mit Anfangsbuchstabe (Vorschau H25). Dazu „Kenne ich schon“ mit Probe auf jeder neuen Karte (M16).
- **Wortlisten (Lizenz geprüft 31.10.2026):**

| Liste | Lizenz | Beleg | Nutzung |
|---|---|---|---|
| **NGSL** 1.2 (New General Service List, Browne, Culligan, Phillips) | **CC BY-SA 4.0** | newgeneralservicelist.com/new-general-service-list: „licensed under a Creative Commons Attribution-ShareAlike 4.0 International License“ | ja: Frequenzband 1–2.800, mit Namensnennung; abgeleitete Listen bleiben CC BY-SA |
| **NAWL** 1.2 (New Academic Word List) | „released under Creative Commons, including commercial use“ (Startseite); Version je Liste **in V5 an der Listendatei bestätigen** | newgeneralservicelist.com (Fußzeile) | ja, nach Bestätigung |
| **BSL** 1.2 (Business Service List) | wie NAWL | newgeneralservicelist.com | ja, nach Bestätigung (Business-Kern) |
| **Oxford 3000/5000** | keine offene Lizenz gefunden; die Seite des Verlags antwortete mit 403 | oxfordlearnersdictionaries.com (nicht abrufbar) | **nein**, nur mit schriftlicher Erlaubnis des Verlags |

- **Folge von CC BY-SA:** Die abgeleiteten Wortdaten stehen im öffentlichen Repository mit Lizenzdatei und Namensnennung (`src/modules/vocab/content/LICENSE-wordlists.md`).
- **Bedeutungen, Sätze und Wortpartner** schreibt das Inhaltsteam selbst und lässt sie vom Lehrer gegenlesen (M60). Die Listen liefern nur Wort und Rang.

---

## 9. Umrechnung der heutigen Daten (V1, Kap. 9, data-guard)

### 9.1 Grundsätze
- **Nichts löschen.** Alte Felder (`fsrs`, `S`, `D`, `due`, `stage`, `lm`, `hist`, `modes`, `xs`, `pa`/`ac`/`co`) bleiben stehen. Neu ist nur `lx` (und `vlog/*`, `vmod/day`).
- **Idempotent:** Ist `lx.mig.from === 'srs1'` gesetzt, wird nicht noch einmal umgerechnet. Ein zweiter Lauf ändert nichts (Unit-Test).
- **Trockenlauf zuerst:** Bericht je Lexem (neue Stufe, beide Termine, Zahl der nachgespielten Antworten, Zusammenführungen). Er ist in der App unter Einstellungen → Diagnose lesbar, wie die Umstellung v1 (A6 Nr. 12, 15).
- **Sicherung vorher:** Export aller `vocab/*`, `chunk/*` und `log/*` als Datei über `downloads`. Die Umrechnung startet erst, wenn die Sicherung geschrieben ist.
- **Schreiben** nur über `writer.transform` auf dem frischen Stand. Ein Dokument mit unerwartetem Aufbau wird nie angefasst (`db_invalid`, wie A6 Nr. 12). Ausgeblendete Karten (`hidden`) bekommen `lx`, bleiben aber ausgeblendet.
- **Sperren statt raten:** Ist eine Abfrage vielleicht gekappt oder `app/profile` ungültig, ist die Umrechnung gesperrt (A6 Nr. 15).

### 9.2 Schritte
1. **Lexeme bilden:** je `vocab/<id>` und `chunk/<id>` ein Lexem. Doppel desselben Stichworts (`headwordOf`, `queue.ts:309`; etwa „to overcome“/„overcome“, Fund und Paket) werden zusammengeführt:
   - Das Dokument mit den meisten Antworten führt.
   - Die anderen bekommen `lx.of` und werden nie selbst geplant.
   - Ihre Sätze gehen in die Rotation des führenden.
   - Grenzfälle (gleiches Stichwort, andere Wortart) bleiben getrennt und erscheinen im Trockenlauf-Bericht.
2. **Verlauf sammeln:**
   - `hist[]` (≤ 12 je Karte) und alle Einträge aus `log/<Tag>` mit `k:'v'` bzw. `type:'chunk'` und passender `id`.
   - Doppelte werden über `t` erkannt.
   - Fehlende Tage sind möglich (Kappung je Tag). Der Bericht nennt die Zahl.
3. **Spuren nachspielen** mit ts-fsrs 5.4.2 (`reschedule`/`next` je Antwort, in Zeitfolge), nach den **neuen** Regeln:
   - frei getippt richtig (`cloze`, `cloze_part`, `type`, `colloc`, `wordfam`, `situation`, `dictation`) → Benutzen und Verstehen, Note wie damals;
   - `produce`, `say_it` erkannt, `act_*` geprüft → Benutzen und Verstehen;
   - `cloze_hint`, `tiles`, `complete` → Benutzen mit höchstens Hard;
   - Aufdecken (`flip`, Anki) → nur Verstehen;
   - Auswahl (`mc_*`, `ctx_mc`, `listen_mc`, `match`, `colloc_gap`, `contrast`) → **keine** Wirkung (nur Verlauf);
   - Override-Antworten → keine Wirkung.
4. **Ohne Verlauf** (alte Karte, leeres `hist`, kein Log):
   - Verstehen übernimmt den heutigen `fsrs`-Stand unverändert.
   - Benutzen ist leer; die Karte steht auf Stufe 3, wie Emrahs Auftrag §7 sagt.
   - **Ausnahme: Stufe 4–5 heute → Stufe 4.** Benutzen startet dann mit `s = min(fsrs.stability, 7)` und `due = heute`. Der erste Abruf prüft, statt zu glauben.
5. **Stufe neu:** aus den Belegen nach den Regeln in 3.3, höchstens die heutige Stufe + 1, nie über 6. Stufe 7 braucht eigene geprüfte Sätze; die gibt es im Bestand nicht.
6. **Rückstand beim Umstieg** (heute 112 überfällig): nach Gefährdung über 7 Lerntage verteilt (M13, Frage F4).
7. **Verlauf übertragen:** Die gesammelten Antworten gehen als Tupel in `vlog/*` (Flag „umgerechnet“), damit der Verlauf ab dem ersten Tag vollständig ist.

### 9.3 Prüfungen
- **Unit:**
  - Ein zweiter Lauf ändert nichts.
  - Alte Felder sind bytegleich, bis auf die Spiegelung bei einer neuen Antwort.
  - Zahl der Lexeme ≤ Zahl der Karten.
  - Kein Lexem ohne Ursprungssatz.
  - Auswahl-Antworten verändern keine Spur.
- **Seed-Test** mit `seed/sample-data.json` (erfunden), dazu ein Datensatz mit Doppeln, leerem Verlauf, `hidden`, ungültigem Dokument und künftiger `fsrs`-Version.
- **data-guard** prüft Schema, Schreibpfad und Spiegelung vor dem Test-Link.

### 9.4 Rückweg
- Schalter `vocabModule` (Einstellungen → Diagnose, nur für den Überchat): aus → der alte Bereich plant wieder aus den gespiegelten alten Feldern.
- `lx` und `vlog` bleiben stehen und werden beim nächsten Einschalten weitergeführt. Antworten, die der alte Bereich in der Zwischenzeit gibt, holt das Modul aus `hist` und `log/<Tag>` nach (wie Schritt 2).

---

## 10. Pakete V1–V5 mit Abnahme
Jede in `synthese.md` übernommene Methode steht in **genau einem** Paket, mit ihrer Prüfung (Liste `synthese.md` §5, verbindlich; 71 Methoden, keine bleibt Papier). Neu dazu N1–N8 (7.2) und die Umrechnung (9).

| Paket | Inhalt | Methoden (aus `synthese.md` §5) | Abnahme |
|---|---|---|---|
| **V1** Datenmodell, Umrechnung, Planer, Simulation | Modul-Gerüst und Grenzen (2), `lx`, `vlog`, `vmod/day` (3), Planer (4), Umrechnung (9), `adapter-v1.ts`, Tagesmarke für alle Nebenwege, N2, N3, N8 | M1, M6, M7, M8, M9 (Regel), M10, M11, M12, M13, M15, M17, M19, M21, M77, M58 (Umrechnung) | Simulation erreicht die Ziele in §1 · Unit grün (Planer, Geschwister, Fuzz-Korridor nach Ankis Testwerten, Lastausgleich, Deckel, Umrechnung idempotent) · data-guard ohne Befund · `ts-fsrs` exakt 5.4.2 |
| **V2** Stufenleiter, Formen, Bewertung | 7 Stufen, Formen je Stufe, Notentabelle, Tippfehler (a)–(h), Auch richtig, Kollokation, Leech und Paare, neue Formen M78–M81 | M2/M23, M14, M22, M25–M31, M36, M38–M41, M44, M45, M56, M57, M78–M81, M80 (Marke) | Notentabelle vollständig (alle Ausgänge × Stufen) · jede Regel (a)–(h) als Test · Simulation: ≥ 50 % aktiv ab Stufe 3, Auswahl nur in Lernschritten · english-teacher prüft Tippfehler-Liste, Synonyme und Muster (Chargen ≤ 40) · learning-scientist prüft Formen |
| **V3** Lernkarte, Sitzung, Abschluss | Lernkarte und Band (6), Sitzung nach Emrah §5, Abschluss, Override nach Antwort 2, „unfair“, Neues eingestreut, Reihenfolge mit Startwert, Kontrast nach Kollokationsfehler, N1, N4 | M9 (Sitzung), M24 (Karte), M34, M42, M43, M48–M54, M68, M71–M76 | Bilder B3, B4, B8, B10, B11 und N1 von Emrah abgenickt vor dem Bau · Lerntag-Durchlauf des Überchats (390 px, Dunkel/Hell) · Test-Link · Unit: angezeigtes „kommt wieder“ = gespeichertes `due` |
| **V4** Anwenden, Wort-Detail, Dashboard | Transfer-Block mit und ohne Claude, eigener Satz Stufe 5/6, Wort-Detail mit beiden Spuren, Verlauf, Dashboard mit 14-Tage-Vorschau und Behaltensrate, N5–N7 | M18, M32, M33, M63–M66, M80 (Form) | Prompt `vocab-transfer@1` durch learning-scientist und english-teacher geprüft · Bilder B1, B2, B6, B7, N5 abgenickt · Unit: ohne Claude keine Planwirkung, Trivialsatz zählt nicht · Test-Link |
| **V5** Wortauswahl C1, Einstufung | Bänder aus NGSL/NAWL/BSL (Lizenz bestätigt), eigene Funde, Kollokationen, Berufsprofil; Einstufung; „Kenne ich schon“ mit Probe; Markierung im Lesen ohne FSRS; i+1; Sinne als eigenes Lexem; Bündel `vlexa/` | M16, M20, M55, M59, M61, M62, M69 | Lehrer prüft die ersten 40 neuen Lexeme · Unit: Begegnung im Lesen ändert FSRS nicht · Einstufung als Bild abgenickt · alter Bereich aus dem Build |

**D4 und F1 gehen darin auf:**
- **D4** (Wörter-Bildschirm mit Filterchips, `recognizeCount`) wird zur Liste und zum Dashboard in V4. Die Filter der heutigen Liste bleiben (Bestand Nr. 62).
- **F1** („Wörter neu“: zwei Spuren, Stufen, Speichermodell `vs`) wird vollständig durch V1–V4 ersetzt. `vs` entfällt zugunsten von `lx`; die 6 Stufen werden 7.

**Prüftore je Paket** (`arbeitsweise.md`): G0 `verify:fast` und Simulation · G1 learning-scientist und english-teacher bei jeder neuen Form und jedem Prompt · G2 ux-reviewer gegen Vorschau und abgenickte Bilder · G3 data-guard (V1, V5), platform-guard · G4 Gesamtlauf einmal je Test-Link durch den Überchat.

---

## 11. Alle heutigen Funktionen: übernehmen, ausbauen, überführen
Bestandsliste aus dem Code (Fundstellen gekürzt; Pfade unter `src/features/vocab/` außer wo anders genannt). **Keine Funktion fällt weg.**
**Ü** = übernehmen · **A** = ausbauen (wie) · **→** = in neue Funktion überführen.

### 11.1 Lernkarte und Abfrage
| Nr | Funktion | Fundstelle | Entscheidung |
|---|---|---|---|
| 1 | Formenkatalog je Stufe | `domain/srs/modes.ts:22-60` | **A** 7 Stufen, ≥ 2 Formen je Stufe, schwächste zuerst, neue Formen M78–M81 (V2) |
| 2 | Einführungskarte (Wort, Lautschrift, Ursprungssatz) | `IntroCard.tsx:101-196` | **A** erst kurz selbst versuchen, dann aufdecken (M36, B10), 2–3 Wortpartner, Ton (V2/V3) |
| 3 | „Vorab: Was heißt das hier?“ mit „Weiß ich nicht“ | `IntroCard.tsx:44-62` | **→** in den Versuch der Einführung (M36), straffrei |
| 4 | Aufbau der Wendung, Register, Falle, Wortfamilie | `IntroCard.tsx:218-266` | **Ü**, zusätzlich Stilebene (M80) |
| 5 | „Sag es einmal laut“ | `IntroCard.tsx:204-208` | **Ü** (freiwillig) |
| 6 | Neue Wörter automatisch vorlesen | `IntroCard.tsx:85`, `settings/VoiceSection.tsx:141` | **Ü** |
| 7 | „Kenne ich“ mit Prüffrage | `IntroCard.tsx:158`, `session.ts:659-671` | **A** Probe → Stufe 3, Kontrolle nach 7 Tagen (M16, V5) |
| 8 | Tag-0-Abruf (Anfangsbuchstabe, dann frei) | `session.ts:296-305`, `spacing.ts:165` | **→** Lernschritte A/B nach Karten und Zeit (M9, V1) |
| 9 | Gestern-Check | `session.ts:304`, `spacing.ts:191` | **Ü** als garantierter Abruf am Folgetag (M77) |
| 10 | Anki-Modus „Aufdecken“ mit 4 Noten | `anki/FlipCard.tsx:60, 299-307` | **A** bleibt freiwillig, wirkt nur auf Verstehen (F3) |
| 11 | Notenvorschlag aus der Denkzeit, Wischen | `FlipCard.tsx:106, 286-307` | **Ü** (nur Anki) |
| 12 | „Hier hast du es gelernt“ auf der Rückseite | `FlipCard.tsx:237-242` | **Ü**, auch im Wort-Detail |
| 13 | Kontroll- und Prüfabfragen in Aufdeck-Runden | `domain/srs/flip.ts:25, 39` | **Ü**; sie wirken auf Benutzen, weil getippt |
| 14 | Wortpartner-Abfragen mit KI-Hinweis | `ExerciseView.tsx:1338`, `collocs.ts:14-17` | **A** eigener Ausgang „Partner falsch“ (M56), Kontrast in der nächsten Sitzung (M74) |
| 15 | „Sag es“ (Absicht → englischer Satz, Diktat) | `modes.ts:48`, `sayIt.ts:60, 82` | **A** als Form der Stufen 5–6 und als gesprochener Beleg für Stufe 7 (Antwort 4) |
| 16 | „Später am Handy sprechen“ | `ExerciseView.tsx:1150-1162` | **Ü** |
| 17 | Aktivierungen A2–A5 (Szene, Umformen, Ohne Wort, Kombi, Mail) | `ActPanel.tsx:15-90`, `fahrplan.ts` | **→** Formen der Stufen 5–6 und Transfer-Block (V4); der Fahrplan geht im Planer auf |
| 18 | Kontrast „Welches Wort passt?“ | `session.ts:1004`, `ExerciseView.tsx:1374` | **A** nach Kollokations- und Verwechslungsfehler am Anfang der nächsten Sitzung (M74), ohne Planwirkung |
| 19 | Satzwechsel | `domain/srs/rotate.ts:21-131` | **A** Ankersatz Tag 0–1, dann wechselnd, Formabruf-Satz 30 Tage gesperrt, Signal „satzgebunden“ (M57) |
| 20 | KI-Satz mit Markierung und „Melden“ | `ExerciseView.tsx:1140-1145` | **Ü**; Melden → „unfair“ ohne Planwirkung (M43) |
| 21 | Wort antippen im Satz | `engine/EnglishText.tsx:37-41` | **Ü** (Kap. 15) |
| 22 | Falle / falscher Freund | `domain/srs/traps.ts:23`, `partner.ts:108` | **A** Kontrastkarte Deutsch ↔ Englisch statt Pause (M14) |

### 11.2 Bewertung und Rückmeldung
| Nr | Funktion | Fundstelle | Entscheidung |
|---|---|---|---|
| 23 | Tipp in 2 Stufen | `ExerciseView.tsx:1153-1170` | **Ü**, Note Hard (M44) |
| 24 | „Weiß ich nicht“ | `ExerciseView.tsx:726, 1157` | **Ü**, Again und Lernschritt |
| 25 | Zweiter Versuch mit Hinweis | `ExerciseView.tsx:133, 1171-1179` | **A** ergibt Again ohne Stufenverlust, nur Tippfehler ergibt Hard (M45) |
| 26 | „Auch richtig“, Tippfehler, Form, UK/US | `ExerciseView.tsx:1220-1230` | **A** Regeln (a)–(h), Ausweichwort (M40, M41) |
| 27 | „War das auch richtig?“ (Claude prüft Synonym) | `SynonymCheck.tsx:13-46` | **Ü** |
| 28 | „Als richtig werten“ (bucht Note 3) | `ExerciseView.tsx:650, 731` | **→** „Das wusste ich eigentlich“ nach Antwort 2 (keine Note, Wiederkehr in neuem Satz) |
| 29 | „Schreib die Lösung einmal ab“ | `ExerciseView.tsx:1288, 1348` | **Ü** freiwillig, zählt nicht (M49) |
| 30 | Vergleich „Du: … → Richtig: …“ | `ExerciseView.tsx:1256-1270` | **A** Buchstaben-Diff (M48, B3) |
| 31 | Formerklärung („overcame = Vergangenheit …“) | `ExerciseView.tsx:1274-1285` | **Ü**, Beugungsfehler mit Grammatik-Hinweis (M40c) |
| 32 | Satzkorrektur von Claude („So ginge es“, „Noch natürlicher“) | `ExerciseView.tsx:1231-1255` | **A** Regeln Synthese 2.5 (3 Urteile, ≤ 2 Korrekturen) |
| 33 | „Zielwort drin“ bei „Sag es“ | `ExerciseView.tsx:1190-1197` | **Ü** |
| 34 | Tutor-Knopf „Fehler erklären“ | `ExerciseView.tsx:1291-1302` | **Ü** |
| 35 | Ergebniskopf mit Ton, Lautschrift, „Zum Wort“ | `WordExtras.tsx:47-126` | **Ü** |
| 36 | „Wieder in …“ und Stufenhinweis | `ExerciseView.tsx:1320` | **A** „Kommt wieder: Mo, 9.11.“ = gespeichertes `due` (M54) |
| 37 | Falsche Karte kommt in der Runde wieder | `session.ts:998-999` | **→** Lernschritt nach Fehler, frei, neuer Satz (M53) |
| 38 | „Schreib trotzdem einen Satz mit …“ | `ExerciseView.tsx:1349, 1485` | **Ü** freiwillig |
| 39 | Rückgängig (5 s) | `session.ts:1063, 1130`, `anki/UndoBar.tsx:22` | **Ü**, nimmt auch den `vlog`-Eintrag zurück |

### 11.3 Planung und Ablauf
| Nr | Funktion | Fundstelle | Entscheidung |
|---|---|---|---|
| 40 | Moduswahl Aufdecken / Tippen / Automatisch | `hub/VocabHub.tsx:51, 200-206` | **A** Pflicht wählt immer die App; die Wahl gilt im freien Üben (M76) |
| 41 | Wiederholen-Knopf mit Minuten | `VocabHub.tsx:91-99` | **A** „Wörter · ca. 14 Min.“ mit „Warum diese?“ (M68) |
| 42 | Aufholmodus (feste Wörter aufdecken) | `session.ts:525` | **→** Rückstand nach Gefährdung (M13), ohne Aufdecken in der Pflicht |
| 43 | Rückstandsbremse (2 neue) | `VocabHub.tsx:89`, `unit/backlog.ts:33` | **→** mindestens 2 neu, Rest nach Minutenbudget (M12) |
| 44 | Wort-Werkstatt (Diagnose, Bedeutung, Teile, Satz) | `werkstatt.ts:109-128`, `WerkstattCard.tsx` | **Ü** (2 Fehler in 30 Tagen) neben Leech 6 (W5) |
| 45 | Werkstatt „Brauchst du das Wort?“ / Pausieren | `WerkstattCard.tsx:96-111, 195-209` | **Ü** |
| 46 | Merkhilfe (eigene oder Claude) | `mnemonic.tsx:51, 86` | **A** automatisch beim Leech (M14) |
| 47 | Fahrplan Aktivierung (Stufen, Abstände, Erhaltung) | `domain/srs/fahrplan.ts:17-129` | **→** Stufen 5–7 und Transfer (V4); Erhaltung = Stufe 7 selten (Emrah 4.4) |
| 48 | Ähnliche neue Wörter nicht am selben Tag | `queue.ts:296`, `similar.ts:93` | **Ü** (M72) |
| 49 | Überspringen, Pausieren, Fortsetzen nach Neuladen | `TrainerScreen.tsx:48-102`, `session.ts:1195-1226` | **Ü** |
| 50 | Ergebnisseite mit Fehlwörtern, „Fehlwörter nochmal“, „Weitere Runde“ | `Summary.tsx:55-158` | **A** Abschluss nach Emrah §5 (B8), „Noch 5“ ohne heute Gesehenes |
| 51 | Kalibrierhinweis „Leicht“ | `Summary.tsx:27-44` | **Ü** (nur Anki) |
| 52 | Prognose „Die nächsten 7 Tage“ | `hub/Sheets.tsx:314-342`, `forecast.ts:9` | **A** 14 Tage in Minuten auf dem Dashboard (M63, B1) |
| 53 | Zielbalken Wortschatz (C1-Marke) | `VocabHub.tsx:216-244`, `domain/vocab/goal.ts` | **A** aktiv gegen passiv, Schätzung erst mit Einstufung (M69) |
| 54 | Satzbank (weitere Sätze nach der Runde) | `sentenceBank.ts:175` | **Ü**, Quelle der Rotation, Lehrer-Freigabe (M60) |

### 11.4 Wort-Detail und Liste
| Nr | Funktion | Fundstelle | Entscheidung |
|---|---|---|---|
| 55 | Wortblatt: Status, Stufenleiter, nächste Wiederholung | `list/WordSheet.tsx:190-220`, `StatusBlock.tsx` | **A** beide Spuren, 7 Teile (B2) |
| 56 | Beispiele, weitere Sätze, Wortpartner | `WordSheet.tsx:224-262` | **Ü**, alle Sätze mit „zuletzt gezeigt“ |
| 57 | Beispielsatz übersetzen | `ExampleTranslation.tsx:14-55` | **Ü** |
| 58 | Bilanz je Form, Verlauf, Rohwerte | `WordSheet.tsx:279-428` | **A** vollständiger Verlauf als Zeitleiste (N5) |
| 59 | Problemwort-Hinweis und „Neues Beispiel“ | `WordSheet.tsx:292-297` | **Ü** (Leech) |
| 60 | Üben, „Kann ich sicher“, „Morgen wieder“, Ausblenden, „Von vorn“, Stapel | `WordSheet.tsx:140-405`, `list/actions.ts:29-42` | **A** „Üben“ läuft über `startSession` (zweites Mal am Tag ohne Planwirkung, N2) |
| 61 | Bedeutung und Satz bearbeiten | `WordSheet.tsx:437-469` | **Ü** |
| 62 | Liste mit Suche, Sortierung, Filterchips, Mehrfachauswahl | `list/VocabScreen.tsx`, `vocabList.ts:20` | **A** Filter nach Gruppe und Spur, „bildest du selbst“ (D4 geht hier auf) |
| 63 | Suche im Hub | `VocabHub.tsx:139-164` | **Ü** |
| 64 | Stapel (Alle, Schwierig, eigene), Eingangskorb | `VocabHub.tsx:282`, `Sheets.tsx:301-390` | **Ü**; „Schwierig“ höchstens 10 (M75) |
| 65 | Eigene Stapel mit Filter, Modus, Richtung | `Sheets.tsx:56-118`, `hub/DeckScreen.tsx` | **Ü** (freies Üben) |
| 66 | Statistik (Median-Antwortzeit, Tage) | `hub/Sections.tsx:72-85` | **A** echte Behaltensrate, Plan-Ehrlichkeit (M18, N7) |

### 11.5 Hinzufügen und Quellen
| Nr | Funktion | Fundstelle | Entscheidung |
|---|---|---|---|
| 67 | Eigenes Wort anlegen, „Ausfüllen“ durch Claude | `list/AddWordSheet.tsx:103-123` | **Ü** über `addLexeme` (Ursprungssatz Pflicht) |
| 68 | Wörter erzeugen (allgemein, Beruf) | `AddWordSheet.tsx:141-192` | **A** Quelle (d) der Wortauswahl, Lehrer prüft (M20, M60) |
| 69 | Wörter aus Text | `list/FromText.tsx` | **Ü** |
| 70 | Lehrer-Feedback einfügen | `AddWordSheet.tsx:201-212` | **Ü**, Kernwort (M21) |
| 71 | Nachschlagen per Antippen, „Als Karte merken“ | `features/lookup/LookupPopover.tsx:322-424` | **Ü** über `findLexeme` / `addLexeme` |
| 72 | Sinn-Auswahl | `LookupPopover.tsx:336-374`, `domain/lookup/sense.ts` | **A** jeder Sinn ein eigenes, verknüpftes Lexem (M62) |
| 73 | Mehrwort-Markierung | `features/lookup/PhraseLookup.tsx:283-386` | **Ü**, legt Kollokation/Chunk-Lexem an |
| 74 | Lautschrift (IPA) | `domain/lexicon/pron.ts:68` | **Ü** |
| 75 | Wort-Atlas | `atlas/AtlasScreen.tsx`, `atlas/add.ts` | **A** zeigt Frequenzbänder und Einstufung (V5) |

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
| 81 | Extra-Runde und Blatt „Mehr“ | `VocabHub.tsx:197, 295`, `Sheets.tsx:134-165` | **Ü** über `startSession`; Fälliges mit Planwirkung, heute Gesehenes ohne |
| 82 | Abend-Check | `VocabHub.tsx:267-273`, `domain/srs/offers.ts:12-19` | **A** bleibt, ohne Planwirkung (heute Eingeführtes), Hinweis N2 (F2) |
| 83 | „Sag es selbst“ (2 Wörter von gestern in eigenen Sätzen) | `hub/SayOwnSheet.tsx` | **→** Beleg für Stufe 6–7 und Transfer (V4) |
| 84 | Hörschleife | `listen/ListenLoop.tsx` | **Ü** (schreibt nichts) |
| 85 | Hörmodus in Stapeln | `hub/DeckScreen.tsx:76-81` | **Ü** |

### 11.8 Anbindung an andere Bereiche
| Nr | Funktion | Fundstelle | Entscheidung |
|---|---|---|---|
| 86 | Tagesblock „Wiederholen“ (Pflicht) | `areas/wortschatz.tsx:67-110`, `today/TodayScreen.tsx:105` | **→** `todayBlock()` mit Zeitbudget (2.2) |
| 87 | Heute-Extras „Fehlwörter von heute“, „Am Laptop vertiefen“ | `today/ExtraRow.tsx:56-75` | **Ü** über `startSession`, ohne zweite Planwirkung |
| 88 | Wortziel auf Heute und Pfad | `today/store.ts:394`, `progress/PathTab.tsx:72` | **Ü** über `lexemeState` |
| 89 | „Mehr“ verlinkt Grammatik, Satzbau, Sprechen | `Sheets.tsx:202-270` | **Ü** |
| 90 | Wochen-Check (benotet Wörter) | `features/check/session.ts:187` | **A** über `startSession`; heute schon Geplantes ohne Planwirkung |
| 91 | C1-Aufgaben mit Wortbelegen | `features/c1x/lexWrite.ts:56-80` | **→** `reportEvidence` |

---

## 12. Risiken
| Risiko | Gegenmittel |
|---|---|
| Umrechnung trifft Emrahs echte Daten falsch | Trockenlauf mit Bericht, Sicherung, Rückweg-Schalter, data-guard. Der Überchat prüft den Bericht an einer Kopie von Emrahs Daten auf dem Test-Link, nie auf der Live-App (A3 Nr. 6). |
| Simulation zirkulär (Lerner folgt FSRS) | Der Lerner hat ein eigenes Gedächtnismodell. Die Behaltensrate wird zusätzlich an echten Daten gemessen (M18, nach 4 Wochen). |
| Dokumentgrenze 5.000 nach ≈ 2 Jahren | Bündel `vlexa/` in V5, Anzeige N8 |
| Mehr Last in den ersten Wochen (Deckel, Lernschritte) | Lastbudget in Minuten, Zielzeit einstellbar; Simulation zeigt die Minuten je Tag |
| Bündel-Größe des Builds (heute 5,96 von 6 MiB laut Masterplan) | Das Modul ersetzt den alten Bereich (V5 aus dem Build); bis dahin Mehr-Datei-Build mit nachgeladenem Modul |
| Inhalte (Synonyme, Muster, Sätze) mit Fehlern | Chargen ≤ 40, 100 % english-teacher, Inhalts-Validatoren (G0) |

---

## 13. Offene Fragen an Emrah (höchstens fünf, je mit Empfehlung)
| Nr. | Frage | Empfehlung |
|---|---|---|
| **F1** | Wo liegt der neue Lernstand: im bestehenden Wortdokument (neues Feld, keine zusätzlichen Dokumente, alter Bereich bleibt als Rückweg lauffähig) oder in eigenen neuen Dokumenten je Wort? | **Im bestehenden Wortdokument.** Das spart Platz (3.6), und nichts kann auseinanderlaufen. |
| **F2** | Abend-Check, Wochen-Check, „Dieses Wort üben“ und „Fehlwörter von heute“: Sie bleiben. Ein Wort, das heute schon dran war, zählt dort aber nur als Übung, nicht für den Plan. Einverstanden? | **Ja.** So kommt kein Wort mehr „mehrmals am Tag“ in den Plan, und keine Funktion fällt weg. |
| **F3** | Anki-Modus (Aufdecken mit 4 Knöpfen, Selbsturteil): Darf er weiter wirken, aber nur auf „Verstehen“ und nie auf „Benutzen“ oder den Aufstieg ab Stufe 3? | **Ja, nur Verstehen.** Dein Selbsturteil bleibt möglich, aber „bildest du selbst“ zeigt nur, was du wirklich getippt oder gesprochen hast. |
| **F4** | Beim Umstieg sind heute etwa 112 Wörter überfällig. Sollen sie nach Gefährdung über 7 Lerntage verteilt werden (statt alle am ersten Tag)? | **Ja, über 7 Tage**, die gefährdetsten zuerst. |
| **F5** | Standard-Zielzeit für den Wörter-Block: 15 Minuten (änderbar 10/20/30)? Heute sind es etwa 8 Minuten Wiederholen in der Tageseinheit, dazu deine freiwilligen Runden (Mittel 41 Abfragen am Tag). | **15 Minuten.** Das deckt deine echte Menge ab, ohne dass Extra-Runden nötig sind. |
