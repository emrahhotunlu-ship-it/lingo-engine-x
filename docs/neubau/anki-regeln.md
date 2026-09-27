# Anki-Modus: lernwissenschaftliche Regeln (verbindlich für P3)

**Stand:** 27.09.2026 · **Rolle:** learning-scientist (nur geprüft, nichts geändert)
**Grundlage:** CLAUDE.md A7 (Eintrag „Anki-Modus“), `docs/neubau/architektur.md` §4, `docs/neubau/lehrer.md` (W1, W2, 2.1), `docs/konzept/lernarchitektur.md` §3, `docs/produktkonzept.md` §2, Auftrag Kap. 5, 6.3, 15, Code `src/domain/srs/{modes,grade,scheduler,applyReview,ladder,confidence,queue,chunkCards}.ts`, `src/features/vocab/session.ts`

---

## 0. Prüfurteil zum Entwurf (architektur.md §4)

| Stelle | Urteil | Befund | Vorschlag |
|---|---|---|---|
| §4.1 auto-Entwurf „Stufe ≤ 2 tippen, sonst aufdecken“ | **verfehlt** | Umgekehrt zu Produktkonzept §2 („ab Stufe 3 tippen, sonst aufdecken“), Lehrer 2.1 und Lernarchitektur 3.4 (frisch aufdecken, gefestigt tippen). | Regel aus Frage 1 |
| §4.1 Vorderseite „Englisch, Ursprungssatz, ▶“ | **nachbessern** | Das ist Erkennen (EN→DE), kein Abruf. ▶ liest die Lösung vor. Lehrer W1 und Lernarchitektur 3.2 verlangen: Bedeutung plus Satz mit Lücke, Emrah formuliert im Kopf (Kap. 5 Punkt 2 aktiver Abruf, Punkt 6 Kontext). | Vorderseite: Bedeutung in der Oberflächensprache plus Ursprungssatz mit Lücke (Platzhalter je Buchstabe wie A7), **kein ▶**. ▶ und Lautschrift kommen auf die Rückseite. |
| §4.2 Stufenregel `grade===1 ? max(1,s−1) : s` | **nachbessern** | Bei einer neuen Karte ist `stageOf` = 0. Das ergibt `stage: 0`, `cardPatchSchema` und `chunkPatchSchema` verlangen aber `min(1)`. `reviewWrite` liefert dann `invalid_result`: **Die erste Bewertung jeder neuen Karte geht still verloren.** | Regel aus Frage 3 (mit `max(1, …)`), in `cardPatch` **und** `chunkPatch` |
| §4.3 Schwellen 3 s / 10 s, Wendungen × 1,5 | **nachbessern** | Der Kern stimmt. Es fehlen: Untergrenze, Deckel bei heute schon gesehen, Lesezeit, Unterbrechung. | Frage 2 |
| §4.2 `modes.recog` + `xs.flip`, `supports(flip) = false` | **erfüllt** | Aufdecken hebt nur `pa`, nie `ac`. Das ist richtig vorsichtig, denn Selbstauskunft ist keine geprüfte Produktion. | bleibt |
| Rückseite (Pflichtfragen 3 und 4) | **nachbessern** | Die Begründung muss auch bei „Leicht“ erscheinen (Kap. 2.4, Kap. 6.3). | Rückseite immer: Lösung im ganzen Satz, Wortart, typische Verbindung/Präposition (`col`), 2–3 Beispiele, bei Wendungen das Register. Jedes Wort ist antippbar. Die Knopf-Regel (Nochmal: nicht gewusst · Schwer: mit Mühe · Gut: nach kurzem Nachdenken · Leicht: sofort) steht hinter dem Info-Symbol (A7 „Status statt Erklärtexte“). |
| `queue.ts` `SRC_RANK` | **nachbessern** | `meeting`, `say` und `fluency` fehlen. Sie landen gleichauf mit `seed` ganz hinten. | Frage 5 |

---

## 1. Modus-Regel für `auto` (Tageseinheit und „Alle fälligen“)

**Entscheidung:** Aufdecken ist der Einstieg für junge Karten, Tippen die Regel für gefestigte. Hat Emrah eine Karte aufgedeckt und mit Gut oder Leicht bewertet, wird sie am nächsten Lerntag getippt geprüft.

`pickMode(card, requested, day)` in `domain/srs/flip.ts`. Die Reihenfolge gilt, der erste Treffer entscheidet:

| # | Bedingung | Modus |
|---|---|---|
| 1 | `requested = 'type'` oder keine Bedeutung in der Oberflächensprache | Tippen (Leiter wie heute) |
| 2 | Die Karte wurde heute (im Lerntag) schon bewertet, d. h. der letzte `hist`-Eintrag ist von heute | derselbe Modus wie diese Bewertung |
| 3 | `requested = 'flip'` (eigener Stapel) | Aufdecken, Ausnahme ist die Kontrolle (Frage 4) |
| 4 | auto: letzte Bewertung war Aufdecken + **Leicht** | **Kontrolle:** frei tippen, `cloze`, ohne Satz `type` (Stufe 4, nur getippte Arten) |
| 5 | auto: **gespeicherte** Stufe ≥ 3 | Tippen, Leiter der Karte |
| 6 | auto: letzte Bewertung war Aufdecken + **Gut** | **Prüfabfrage:** tippen mit Stütze, Leiter auf Stufe 3 (`cloze_hint`/`tiles`) |
| 7 | sonst (neu, Stufe 1–2, nach Nochmal oder Schwer) | Aufdecken |

- **„Gespeicherte Stufe“** heißt `stageOf(card.doc)`, **nicht** `card.stage`. Bei Wendungen hebt `chunkStage` die Stufen 1–2 in der Anzeige auf 3. Mit `card.stage` würde keine Wendung je aufgedeckt.
- **Wendungen, Mehrwort-Vokabeln und Kollokationen:** Es gilt dieselbe Regel. In `auto` bekommen sie nie Auswahlfragen. Die Stufen 1–2 ersetzt das Aufdecken, geprüft wird ab Stufe 3 getippt.
- **Weg einer neuen Karte:** Einführung → Aufdecken (heute, ggf. Wiedervorlage) → am nächsten Lerntag getippt mit Stütze → ab Stufe 3 nur noch getippt. Erneut aufgedeckt wird nur, solange eine Prüfabfrage scheitert.
- **Eigene und eingebaute Stapel außer „Alle fälligen“:** Der Modus ist der gemerkte Modus des Stapels. Standard ist Aufdecken (Emrahs Wunsch).

**Begründung:** Aufdecken ist echter, verdeckter Abruf. Im Kopf formulieren wirkt auf das Behalten ähnlich wie offener Abruf (Smith, Roediger & Karpicke 2013), geht etwa doppelt so schnell und ist besser als Auswahlfragen (Lernarchitektur 3.3). Für C1 zählt aber die geprüfte Produktion (Form, Schreibung, Verbindung). Die Selbstbewertung nach dem Aufdecken ist anfällig für den Rückschaufehler („hätte ich gewusst“). Der Wechsel Aufdecken → Prüfabfrage wirkt als eingebauter Ehrlichkeitsanker und erfüllt nebenbei Kap. 6.3/15: Auch junge Karten haben so zwei Abfragearten.

---

## 2. Vorschlag aus der Antwortzeit und Verhalten bei „Nochmal“

**Entscheidung:** Der Vorschlag ergibt sich aus der Denkzeit bis zum Aufdecken. „Leicht“ muss sofort aus der Bedeutung kommen. Die Satzlänge verlängert nur die Grenze für „Gut“.

**Messung:** `revealMs` läuft vom ersten Bild der voll sichtbaren Vorderseite bis zum Aufdecken. Zeit im Hintergrund zählt nicht.

| Fall (erster Treffer gilt) | Vorschlag |
|---|---|
| Seite war während der Vorderseite verborgen | Gut |
| `revealMs` < 1,0 s | Gut (kein glaubhafter Abrufversuch) |
| `revealMs` ≤ 3 s × f | Leicht |
| `revealMs` ≤ 10 s × f + Lesezuschlag | Gut |
| darüber | Schwer |
| – | **Nochmal nie** |

- **f:** 1,0 für ein Einzelwort, 1,5 für eine Wendung oder Mehrwort-Karte (`isPhraseCard`). Das deckt die Länge der Lösung ab.
- **Lesezuschlag:** 150 ms je Wort des Satzes auf der Vorderseite ab dem 9. Wort, höchstens 3 s, **nur für die Gut-Grenze**.
- **Deckel:** Wurde die Karte heute schon gesehen (Einführung, Wiedervorlage, frühere Runde), ist der Vorschlag höchstens Gut.
- **Bei schwacher Kalibrierung (Frage 4):** Die Leicht-Grenze sinkt auf 2 s × f.

**Begründung:** Die Schwellen passen zu `grade.ts`: Bei der Lücke gilt Leicht bis 3 s und Gut bis 8 s bis zum ersten Zeichen. Dazu kommen etwa 2 s für die bewusste Entscheidung „ich hab's“. Das entspricht der FSRS-Bedeutung (Leicht = sofort, Gut = nach kurzem Nachdenken, Schwer = mit Mühe). Minuten nach dem Sehen misst die Zeit nur das Kurzzeitgedächtnis, deshalb dann nie Leicht. „Nochmal“ kann die App nicht beobachten. Es ist zugleich die ehrlichste Selbstbewertung und bleibt allein Emrahs Knopf.

**Bei „Nochmal“:**
- **FSRS wie heute:** Lernschritt 1 Min., Wiederlernen 10 Min. Die Stufe folgt Frage 3.
- **Wiedervorlage in derselben Sitzung** nach **5 anderen Karten** (`splice(pos + 6)`). Beim Tippen bleibt es bei 3 (`pos + 4`). Reicht der Rest nicht, kommt die Karte ans Ende. `MAX_SHOWN = 3` und das 20-Minuten-Fenster bleiben.
- **Die Wiedervorlage wird wieder aufgedeckt** (Regel 2), der Vorschlag ist höchstens Gut. Sie zählt im Zähler mit (A7).
- **Schwer/Gut auf neuen Karten:** Die Wiedervorlage läuft wie heute über die FSRS-Lernschritte.

**Begründung:** 5 Aufdeck-Karten dauern etwa 40–60 s. Das entspricht dem Lernschritt von 1 Minute und demselben Abstand wie 3 getippte Karten. Ein längerer Abstand innerhalb der Sitzung kostet mehr Abrufmühe und hält länger (Pyc & Rawson 2009). Ein gelungener Abruf je Sitzung genügt, der Rest kommt über die Tage (successive relearning, Rawson & Dunlosky).

---

## 3. Stufenregel und Sicherheits-Punkte

**Entscheidung:** Die Stufe misst nur geprüfte Leistung. Aufdecken hebt höchstens bis Stufe 2 und verschiebt je Antwort höchstens um eine Stufe. Über Stufe 2 hinaus hebt nur eine getippte Übung (über `nextStage`).

Regel für `ex === 'flip'` in `cardPatch` und `chunkPatch`, mit `s0 = stageOf(cur)` (0 bei einer neuen Karte):

| Note | neue `stage` |
|---|---|
| Nochmal | `max(1, s0 − 1)` |
| Schwer | `max(1, s0)` |
| Gut / Leicht | `max(1, s0, min(2, s0 + 1))` |

- **Beispiele:** neu → 1 · 1 → 2 · 2 → 2 · 4 → 4 (Gut) bzw. 3 (Nochmal).
- **Leicht wirkt wie Gut**, es gibt keinen Extrasprung wie in `nextStage`.
- **`max(1, …)` ist Pflicht**, weil das Schema `stage ≥ 1` verlangt (siehe 0).
- **Übrige Felder wie im Entwurf §4.2:** `modes.recog` (nur `pa`), `xs.flip`, `hist[].x = 'flip'`, FSRS voll.
- **Sicherheits-Punkte:** `confidence.ts` bleibt unverändert. Daraus folgt: Aufdecken allein bringt höchstens 3 Punkte („wird fester“). „Sicher“ (4 Punkte) braucht Stufe ≥ 4 und S ≥ 7 Tage, also eine getippte Leistung. Hinter dem Info-Symbol steht: „Sicher wird eine Karte beim Tippen.“ Das widerspricht Kap. 2.2 nicht, denn die Punkte zeigen, was belegt ist.

**Begründung:** FSRS darf die Selbstbewertung voll nutzen, dafür ist es gebaut. Die Leiter dagegen entscheidet, welche Abfrageart als Nächstes kommt, und muss deshalb auf geprüfter Leistung stehen. „Nochmal“ senkt die Stufe, weil „nicht gewusst“ verlässlich ist. Es senkt aber nur um eine Stufe, damit eine einzelne Selbstauskunft keine getippten Belege löscht (gedämpft wie BKT, Kap. 5).

---

## 4. Kontrolle der „Leicht“-Karten

**Entscheidung:** Jede mit Leicht aufgedeckte Karte wird bei ihrer nächsten Fälligkeit frei getippt (Regel 4). In eigenen Anki-Stapeln wird nur kontrolliert, bis die Woche 5 Kontrollen hat.

- **Kontrollkarte:** Die letzte Bewertung ist Aufdecken + Leicht und die Karte ist heute fällig. **Nie vorziehen.**
- **Abfrage:** `cloze` (frei im Ursprungssatz), ohne Satz `type`. Die App bewertet (`grade.ts`), „Tipp“ zählt als Hilfe. Status: „Kontrolle“.
- **Tageseinheit und „Alle fälligen“:** Kontrolle immer, ohne Deckel. Das ist ohnehin der Tipp-Pfad.
- **Eigener Stapel im Aufdecken-Modus:** höchstens 1 Kontrolle je Sitzung und 2 je Lerntag, bis die Kalenderwoche (Mo–So, 04:00) **5 Kontrollen** hat. Kontrollen aus `auto` zählen mit. Verpasste werden nicht nachgeholt.
- **Kalibrierung:** Sie wird aus `hist` abgeleitet, ein neues Datenfeld ist nicht nötig. Gezählt werden die Paare „Aufdecken-Leicht → nächste Antwort getippt“ der letzten 28 Tage. Treffer heißt Note ≥ 2. Ab **10 Paaren** mit einer Trefferquote **< 75 %** gilt:
  - Die Zusammenfassung zeigt einen ruhigen Satz, höchstens alle 14 Tage (Merker in `localStorage`): „Bei ‚Leicht‘ lagst du zuletzt 6 von 10 Mal richtig. Im Zweifel ‚Gut‘.“
  - Die Leicht-Grenze des Vorschlags sinkt auf 2 s × f, bis die Quote wieder ≥ 75 % ist.
  - Kein Zwang, keine Sperre (Kap. 7).

**Begründung:** Gemessen wird bei Fälligkeit, denn genau dort sagt FSRS etwa 90 % Behalten voraus. Vorgezogen wäre die Kontrolle zu mild und würde die Planung verzerren. Bei echten 90 % ergibt die Grenze „10 Paare, < 75 %“ nur in etwa 7 % der Fälle falschen Alarm. Freies Tippen prüft genau, was „Leicht“ behauptet: sofortiger Abruf ohne Stütze.

---

## 5. Tageslimit neuer Karten und Eingangskorb

**Entscheidung:** Das Kontingent bleibt wie in Kap. 6.3: **0/2/5/10, Standard 5**, je Lerntag (04:00), **ein** Kontingent für alle Wege. Der Eingangskorb ist die Menge aller neuen, nicht ausgeblendeten Karten, geordnet nach Nutzen.

- **Geltung:** Das Limit gilt gemeinsam für Tageseinheit, „Alle fälligen“ und Stapel (`newQuotaLeft`, die D17-Lektionsregel bleibt). Aufdecken ändert daran nichts.
- **Viele Fällige:** W2 bleibt (etwa 40 % der Zeit, Untergrenze `min(2, Kontingent)`). Es gibt **keine** zusätzliche Rückstandsbremse auf 0 wie in Lernarchitektur 3.2, das widerspräche Kap. 15.
- **„Höchstens 8 pro Tag“** (Lehrer 2.1, Lernarchitektur 3.2) wird nicht übernommen. Der Auftrag geht vor, 10 bleibt wählbar.
- **Stapel:** Neue Karten kommen nur aus dem Rest-Kontingent und nur, wenn sie zum Stapel passen. Heute bekommen Stapel außer „alle“ gar keine neuen Karten. Das muss sich ändern, sonst lernt Emrah im Stapel „Aus Preply“ die neuen Preply-Wörter nie. „Jetzt üben“ am Wortblatt und „Kenne ich schon“ bleiben ausdrückliche Ausnahmen.
- **Reihenfolge** (ersetzt `SRC_RANK` in `queue.ts`, innerhalb einer Stufe die älteste zuerst):
  1. Termin: `meeting`
  2. Preply: `preply`
  3. eigener Output und eigene Korrektur: `say`, `fluency`, `scene`, `mail`, `pitch`, `biz`, `coach`
  4. Wochenthema (sobald P1 ein Themen-Merkmal liefert, bis dahin leer)
  5. eigene Funde: `lookup`, `read`, `listen`, `translate`, `write`, `user`, `claude`
  6. Lektion und Vorschläge: `lesson`, `ai`, `job`, `daily`
  7. Startwortschatz und Unbekanntes: `seed`, sonst
- **Anzeige im Wortschatz:** „Eingangskorb 42 · reicht für 9 Tage“ (Anzahl ÷ Kontingent). Ab 30 Tagen Reichweite erscheint ein ruhiger Hinweis „Korb sichten“ mit „Kenne ich schon“ und „Ausblenden“ je Karte. Nie automatisch löschen (Kap. 9), kein rotes Abzeichen (Kap. 7).

**Begründung:** Jede neue Karte zieht im ersten Monat etwa 4–6 Abrufe nach sich. Bei 5 am Tag bleibt der Deckel von 6–8 Minuten haltbar, 10 bleibt für Termin-Wochen wählbar. Emrahs eigener Kontext (Termin, Lehrer, eigene Fehler) ist am relevantesten und am besten verankert und kommt deshalb zuerst. Innerhalb einer Stufe kommt die älteste zuerst, damit keine Karte übergangen wird.

---

## 6. Konstanten (neben `grade.ts`, in `domain/srs/flip.ts`)

```ts
export const FLIP = {
  easyMs: 3000, easyStrictMs: 2000, goodMs: 10000, phraseFactor: 1.5,
  readFreeWords: 8, readPerWordMs: 150, readMaxMs: 3000, floorMs: 1000,
  againGap: 6,               // splice(pos + 6): 5 andere Karten dazwischen
};
export const CONTROL = { perWeek: 5, perDay: 2, perSession: 1, windowDays: 28, minPairs: 10, minHit: 0.75, hintEveryDays: 14 };
```

## 7. Pflicht-Tests für P3 (Unit)

- **Neue Karte:** Aufdecken + Gut schreibt `stage: 1`, kein `invalid_result`. Gilt für Vokabeln und Wendungen.
- **Stufentabelle:** Leicht springt nicht weiter als Gut, Nochmal senkt höchstens um 1 und nie unter 1.
- **`pickMode`:**
  - alle 7 Regeln in ihrer Reihenfolge,
  - eine Wendung mit gespeicherter Stufe 2 wird aufgedeckt (nicht über `chunkStage`),
  - eine Karte, die heute schon bewertet wurde, behält ihren Modus.
- **`flipSuggest`:**
  - Grenzen 1 / 3 / 10 s bei f = 1 und f = 1,5,
  - Lesezuschlag nur auf Gut,
  - „heute gesehen“ ergibt höchstens Gut,
  - „verborgen“ ergibt Gut,
  - nie 1.
- **Nochmal:** Wiedervorlage an `pos + 6`, höchstens 3 Anzeigen.
- **Kontrolle:**
  - nur fällige Karten,
  - Grenzen 1 / 2 / 5 im Stapel,
  - Kalibrierung mit 7 von 10 schaltet die strenge Grenze, mit 8 von 10 nicht.
- **Eingangskorb:** `meeting` vor `preply` vor `lookup` vor `seed`, innerhalb einer Stufe die älteste zuerst.

---
Bezug: /home/user/lingo-engine-x/docs/neubau/architektur.md · /home/user/lingo-engine-x/src/domain/srs/applyReview.ts (Schema `stage ≥ 1`) · /home/user/lingo-engine-x/src/domain/srs/queue.ts (`SRC_RANK`) · /home/user/lingo-engine-x/src/domain/srs/chunkCards.ts (`chunkStage`) · /home/user/lingo-engine-x/src/features/vocab/session.ts (Wiedervorlage, neue Karten in Stapeln) · /home/user/lingo-engine-x/src/domain/srs/confidence.ts

## 8. Ergänzung Product Owner (27.09.2026)
- **Richtung je Stapel wählbar** wie in Anki: „Deutsch → Englisch (aktiv)“ ist Standard (Vorderseite laut Regel oben: Bedeutung + Ursprungssatz mit Lücke), „Englisch → Deutsch (verstehen)“ und „Gemischt“ sind wählbar. In der Tageseinheit und in „Alle fälligen“ gilt immer Deutsch → Englisch.
- Grund: Emrah hat im Prototyp v1 die Vorderseite Englisch gesehen und den Modus gelobt; die Lernwissenschaft verlangt aktiven Abruf. Beides bleibt so möglich.
