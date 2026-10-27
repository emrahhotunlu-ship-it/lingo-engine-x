# Nachprüfung Tarek (Technik, Daten) – Entwurf 2

Stand 27.10.2026. Geprüft: `konzept.md` Entwurf 2 (0.1, 3.1–3.7, 6.1, 6.4, 7.2, 14, 16.1, 18–20) gegen meine Prüfung `tarek.md` und gegen den Code (`contract/db.d.ts`, `src/data/paths.ts`, `src/data/schemas.ts`, `src/domain/srs/modes.ts`, `src/domain/capacity/docGuard.ts`). Einzige Nachprüfung, keine neue Grundsatzkritik.

## 1. Vetos

| Veto | Urteil | Was fehlt |
|---|---|---|
| V1 Datenplan | **teilweise** | Pfade, Formen, Spiegel, Übernahme, Registrierung und „nie `app/profile.plan`“ stehen. Es fehlen die Größen der **wachsenden Felder** (L3). Ersatz: siehe unten |
| V2 Speichermodell `vs` | **erfüllt** | 16.1, 18 (Stufe 2 „zuerst“), 19 Nr. 11, 20 |
| V3 Zeit je Versuch | **erfüllt** | 3.3 und 18 Stufe 1. Die Änderung durch die Leitung steht in Abschnitt 2 |
| V4 Umrechnung | **teilweise** | Der Text in 3.7 stimmt, passt aber nicht zu zwei neuen Regeln aus 3.1/3.2 (siehe Widerspruch W2) |

**Ersatztext V1** (in 16.1 die Spalte „Rückweg/Hinweis“ ergänzen):
> `app/c1.ms[]` ≤ 30 × 0,5 KB, `app/c1.can` 12 Einträge, zusammen ≤ 20 KiB · `app/levels` ≤ 10 KiB · `app/week` (`sc`, `next`, `conf`) zusammen < 3 KiB · `talk/<Monat>.runs[].mis` +0,5 KB je Lauf · `app/errq` < 1 KB, abgeleitet, jederzeit neu berechenbar. v86 ignoriert alle diese neuen Felder.

## 2. Verbesserungen

| Nr. | Urteil | Anmerkung |
|---|---|---|
| 1 Startbild | erfüllt | 14.2. Die Überschrift „ohne Datenbank-Abfrage“ meint: das Skelett kommt ohne Datenbank. Bitte so formulieren |
| 2 Ladeform Emrahs Entscheidung | erfüllt | 14.2, 19 Nr. 1 |
| 3 Hörtempo je Stimme | erfüllt | 5.2 |
| 4 Wörter pro Minute | teilweise | Ersatzsatz für 6.4: „Die Kurve nutzt nur Werte mit `in:'d'`; getippte Werte fließen nicht ein.“ |
| 5 `.bin` statt `vocab.sb` | erfüllt | 14.2 |
| 6 Inter Display ohne zweite Datei | erfüllt | 12 |
| 7 Vor Stufe 2 | erfüllt | 14.1, 18 |
| 8 `lm.sx` | erfüllt | 16.1 |

## 3. Leitungsentscheidung 1: Zeitbasis „gesprochen“

**Ja, ich trage sie mit, unter Bedingungen.** Die Zeit selbst lässt sich genau messen: Der Tipp auf „Sprechen“ und der Tipp auf „Senden“ sind zwei Ereignisse in unserer eigenen Oberfläche. Geschätzt wird nur, **ob** wirklich diktiert wurde. Das ist eine Schwäche: Am iPhone fügen auch die Wortvorschläge der Tastatur ganze Wörter ohne Tastendruck ein. Weil die App nur mit Emrahs eigenen Werten vergleicht, fällt der feste Zusatzaufwand (Tastatur, Mikrofon, Prüfen des Textes) heraus. Bedingungen:
1. Die Zeitbasis „gesprochen“ gilt nur im Sprechen-Ablauf **und** bei `in:'d'` ohne Tastendrücke. Mischfälle zählen ohne Zeitwertung und werden benotet wie „frei richtig, ≤ 2 × Basis“. Mischfälle sind: Tasten und Einfügung gemischt, Text nachbearbeitet, zweiter Versuch nach „kam auf Deutsch an“.
2. Der eigene Mittelwert (Median) ersetzt den Startwert erst ab 10 Werten. Das gilt auch für getippte Antworten. Über 45 s zählt als Unterbrechung, auch beim Sprechen.
3. Die Erkennung wird einmal auf Emrahs iPhone geprüft: 3 Antworten diktiert, 3 getippt, 3 mit Wortvorschlägen. Das Ergebnis steht in der Diagnose, bevor die Basis Noten beeinflusst.
4. Die Obergrenze gilt wie in W1 beschrieben.

## 4. Neue Felder `app/week.next` und `app/week.conf`

- **Beide sind additiv:** `app/week` ist registriert, steht in Sicherung und Export, und v86 liest es nicht mehr (`unitPlanFor` ignoriert `_week`). Keines der beiden Felder ist die einzige Quelle für eine Entscheidung, die auch v86 trifft. **Passt.**
- **`conf` braucht eine Form mit Obergrenze:** `conf:{<JJJJ-Www>: 1–5}` mit höchstens 104 Wochen, älteste fallen heraus. Das sind < 2 KiB.
- **`next` doppelt einen bestehenden Ort:** Es gibt schon die Sammlung `meeting/<JJJJ-MM>`. Sie ist registriert, und ihre Form hat `topic`, `tricky`, `when`, `prep`, `debrief`, aber auch `who`, also einen Namen. Bedingungen:
  - (a) Den Termin in `meeting/<Monat>.items[]` ablegen, mit leerem `who`. `app/week.next` ist dann nur ein Verweis `{m, id, d}`.
  - (b) Höchstens 200 Zeichen Text. Nach dem Termin-Tag wird der Termin nicht mehr verwendet.
  - (c) „Ohne Namen“ ist nur ein Hinweis in der Oberfläche. Technisch erzwingen lässt es sich nicht, denn diktierter Text kann Namen enthalten. Das bleibt in Emrahs Datenbank, ist also erlaubt.
  - (d) Seed und Tests verwenden nur erfundene Termine. Diagnose-Meldungen enthalten nie den Text.

## 5. Widersprüche durch die Überarbeitung

- **W1 15-s-Regel gegen 2 × Basis:** 3.3 behauptet, „über 15 s nie sicher“ ergebe sich aus der Tabelle. Beim Sprechen sind 2 × 8 s = 16 s und 2 × 10 s = 20 s. Auch beim Tippen gilt das nicht mehr, sobald der Median über 7,5 s steigt. Ersatz: „Grenze für ‚sicher‘ = min(2 × Basis; 15 s). Getippt wird mit `fk` verglichen, gesprochen mit `ms`.“ Ist 15 s für gesprochene Wendungen zu knapp, entscheidet Emrah zwischen 15 und 20 s.
- **W2 Umrechnung gegen 3.1/3.2:** 3.2 verlangt für S3 einen Abruf ohne Satz, 3.7 prüft das nicht. Außerdem steht `dictation` im Code als `input:'typed'` und würde nach 3.7 als freier P-Beleg zählen, obwohl Diktat nach 3.1 nur für R zählt. Ersatz für 3.7: „S3 braucht 2 freie Tage mit bekannter Aufgabenart, davon einer satzfrei (`x` ∈ type, speed); `x = dictation` und `listen_mc` zählen nur für R.“
- **W3 Volumen beim Sprechen:** Block 6 ist jetzt an jedem Lerntag diktiert und bewertet. Dazu kommen Block 5 und das Zusammenfassen. `fluency/<Monat>` und `say/<Monat>` haben im Code keine Obergrenze. Bei 8–12 Antworten je Tag mit Text und Rückmeldung sind das schnell über 200 KiB im Monat. Ersatz für 16.1: „Ein Eintrag je Block, nicht je Wendung; Text ≤ 600 Zeichen; Wächter 200 KiB mit Fortsetzung `-b` wie bei `err`.“
- **W4 `app/today`:** Die Restzeit-Anzeige (2.4, ± 20 %) braucht Zeiten über mehrere Tage, `app/today` wird aber täglich neu angelegt. Ersatz: „`bt` = gleitender Mittelwert je Block, beim Tageswechsel übernommen. Bei `d` ≠ heute wird `app/today` neu abgeleitet. Ob die Pflicht erledigt ist, steht weiter in `app/profile.pflicht`.“

## Ergebnis

**Veto aufgehoben.** Das Konzept ist jetzt technisch baubar. Die kleinen Nachträge oben (Größenangaben, Termin im bestehenden Termin-Speicher, Obergrenzen beim Sprechen, 15-Sekunden-Grenze) sind Bauauflagen und keine neuen Streitpunkte. Nur die Wahl zwischen 15 und 20 Sekunden für gesprochene Wendungen kann Emrah treffen.
